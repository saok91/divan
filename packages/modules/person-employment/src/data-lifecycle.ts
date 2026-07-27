/**
 * Data lifecycle orchestration (Story 7.3 / FR-50).
 * Hold place/release, disposal propagation, reconstruction honesty hooks.
 * Export artifact dispose is injected (avoids person-employment ↔ reporting cycle).
 * AD-2: does not rewrite Employment/Assignment history cells.
 *
 * Review decisions applied:
 * - org_scope holds gate only exact org_scope dispose (no invented org membership).
 * - element_category / org_scope dispose require personIds and/or artifactIds.
 * - Re-check active holds immediately before each destructive write.
 */

import { randomUUID } from "node:crypto";

import {
  DataLifecycleError,
  MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
  MSG_DISPOSAL_PROPAGATION_FAILED_FA,
  MSG_DISPOSAL_SCOPE_INCOMPLETE_FA,
  MSG_HOLD_NOT_FOUND_FA,
  MSG_LEGAL_HOLD_ACTIVE_FA,
  MSG_LIFECYCLE_METADATA_INCOMPLETE_FA,
  MSG_RESTORE_CATCHUP_REQUIRED_FA,
  disposalActionForClass,
  parseLifecycleClass,
  type DisposalRunRecord,
  type LegalHoldRecord,
  type LegalHoldScopeKind,
  type PropagationTargetResult,
} from "@divan/audit-envelope";
import type { PrismaClient } from "@divan/db";
import { appendAccessEvent } from "@divan/event-store";

import {
  ELEMENT_TO_PERSON_FIELD,
  type PersonProfileFieldKey,
} from "./data-dictionary-types";
import { listDataElements } from "./data-dictionary";
import { getPersonDb } from "./db";
import {
  completeDisposalRun,
  findActiveHoldsIntersecting,
  getDisposalRun,
  insertDisposalRun,
  insertLegalHold,
  insertPropagationResult,
  listDisposedFieldsForPerson,
  listDisposalRuns,
  listLegalHolds,
  listPropagationResults,
  releaseLegalHold,
  upsertDisposedField,
  withLifecycleTransaction,
  type DisposalScope,
  type DisposedFieldMarker,
  type PgQueryable,
} from "./data-lifecycle-repo";

export const MSG_DISPOSAL_LIMIT_DISCLOSURE_FA =
  "برخی مقادیر پروفایل پس از حذف/ناشناس‌سازی در دسترس نیستند؛ مقدار قبلی بازسازی نمی‌شود.";

export type DisposeArtifactFn = (
  db: PgQueryable,
  input: {
    artifactId: string;
    actorAccountId: string;
    reason?: string;
    correlationId: string;
  },
) => Promise<unknown>;

export type ListArtifactsForScopeFn = (
  db: PgQueryable,
  scope: DisposalScope,
) => Promise<string[]>;

export type RunDisposalDeps = {
  disposeExportArtifact: DisposeArtifactFn;
  listExportArtifactIds: ListArtifactsForScopeFn;
  /** Prisma for Person/DataElement reads — defaults to getPersonDb(). */
  prisma?: PrismaClient;
};

/** Postgres undefined_table / missing relation — schema not applied yet. */
export function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: unknown }).code) : "";
  if (code === "42P01") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /does not exist|undefined_table|relation .* does not exist/i.test(msg);
}

/**
 * Assert no active legal hold intersects artifact (and optional subject ids).
 * Throws DataLifecycleError DISPOSAL_BLOCKED_BY_HOLD.
 * org_scope holds are NOT auto-applied (no org-membership resolver in MVP).
 */
export async function assertNoActiveHoldForArtifact(
  db: PgQueryable,
  input: {
    artifactId: string;
    personIds?: string[];
    elementCategory?: string;
  },
): Promise<void> {
  const holds = await findActiveHoldsIntersecting(db, {
    artifactId: input.artifactId,
    personIds: input.personIds,
    elementCategory: input.elementCategory,
  });
  if (holds.length > 0) {
    throw new DataLifecycleError(
      "DISPOSAL_BLOCKED_BY_HOLD",
      MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
      {
        holdId: holds[0]!.id,
        scopeKind: holds[0]!.scopeKind,
        scopeRef: holds[0]!.scopeRef,
      },
    );
  }
}

async function assertNoActiveHoldForPersonWrite(
  db: PgQueryable,
  input: {
    personId: string;
    elementCategory?: string | null;
  },
): Promise<void> {
  const holds = await findActiveHoldsIntersecting(db, {
    personIds: [input.personId],
    elementCategory: input.elementCategory ?? undefined,
  });
  if (holds.length > 0) {
    throw new DataLifecycleError(
      "DISPOSAL_BLOCKED_BY_HOLD",
      MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
      {
        holdId: holds[0]!.id,
        scopeKind: holds[0]!.scopeKind,
        scopeRef: holds[0]!.scopeRef,
      },
    );
  }
}

export async function placeHold(
  db: PgQueryable,
  input: {
    scopeKind: LegalHoldScopeKind;
    scopeRef: string;
    reason: string;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<LegalHoldRecord> {
  const scopeRef = input.scopeRef.trim();
  const reason = input.reason.trim();
  if (!scopeRef || !reason) {
    throw new DataLifecycleError(
      "DISPOSAL_SCOPE_INCOMPLETE",
      "دلیل و شناسه محدوده الزامی است.",
    );
  }
  const correlationId = input.correlationId ?? randomUUID();
  const hold = await insertLegalHold(db, {
    scopeKind: input.scopeKind,
    scopeRef,
    reason,
    placedBy: input.actorAccountId,
    correlationId,
  });
  try {
    await appendAccessEvent(db, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "data.lifecycle.hold.place",
      scope: {
        channel: "data_lifecycle",
        scopeKind: input.scopeKind,
        scopeRef,
      },
      result: "allow",
      reason: "legal_hold_placed",
      entityType: "legal_hold",
      entityId: hold.id,
      payload: { outcome: "placed" },
    });
  } catch {
    /* soft — hold already persisted */
  }
  return hold;
}

export async function releaseHold(
  db: PgQueryable,
  input: {
    holdId: string;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<LegalHoldRecord> {
  const correlationId = input.correlationId ?? randomUUID();
  const hold = await releaseLegalHold(db, {
    holdId: input.holdId,
    releasedBy: input.actorAccountId,
    correlationId,
  });
  if (!hold) {
    throw new DataLifecycleError("HOLD_NOT_FOUND", MSG_HOLD_NOT_FOUND_FA);
  }
  try {
    await appendAccessEvent(db, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "data.lifecycle.hold.release",
      scope: {
        channel: "data_lifecycle",
        holdId: input.holdId,
      },
      result: "allow",
      reason: "legal_hold_released",
      entityType: "legal_hold",
      entityId: hold.id,
      payload: { outcome: "released" },
    });
  } catch {
    /* soft */
  }
  return hold;
}

export type RunDisposalResult = {
  run: DisposalRunRecord;
  results: PropagationTargetResult[];
  restoreCatchUpRequiredFa: string;
};

/**
 * On-demand disposal orchestrator (MVP — no retention-end scheduler).
 * 1. Refuse if active hold intersects scope
 * 2. Propagate: exports → disposeExportArtifact; staging clear; person fields per class
 * 3. Persist propagation_result; never claim full success with silent skips
 */
export async function runDisposal(
  db: PgQueryable,
  input: {
    scope: DisposalScope;
    actorAccountId: string;
    trigger?: string;
    correlationId?: string;
    reason?: string;
  },
  deps: RunDisposalDeps,
): Promise<RunDisposalResult> {
  const correlationId = input.correlationId ?? randomUUID();
  const prisma = deps.prisma ?? getPersonDb();
  const disposeReason = input.reason?.trim() || "lifecycle_disposal";
  const personIds =
    input.scope.personIds ??
    (input.scope.scopeKind === "person" ? [input.scope.scopeRef] : []);
  const artifactIds =
    input.scope.artifactIds ??
    (input.scope.scopeKind === "artifact" ? [input.scope.scopeRef] : []);
  const elementCategory =
    input.scope.elementCategory ??
    (input.scope.scopeKind === "element_category"
      ? input.scope.scopeRef
      : undefined);

  // Decision: element_category / org_scope require concrete subject/artifact ids.
  if (
    (input.scope.scopeKind === "element_category" ||
      input.scope.scopeKind === "org_scope") &&
    personIds.length === 0 &&
    artifactIds.length === 0
  ) {
    throw new DataLifecycleError(
      "DISPOSAL_SCOPE_INCOMPLETE",
      MSG_DISPOSAL_SCOPE_INCOMPLETE_FA,
    );
  }

  if (
    input.scope.scopeKind === "mixed" &&
    personIds.length === 0 &&
    artifactIds.length === 0 &&
    !elementCategory
  ) {
    throw new DataLifecycleError(
      "DISPOSAL_SCOPE_INCOMPLETE",
      MSG_DISPOSAL_SCOPE_INCOMPLETE_FA,
    );
  }

  // Initial hold gate: person + artifact + exact scope match.
  // org_scope holds only match when disposing with scopeKind=org_scope (exact).
  // element_category holds on person fields are re-checked per write below.
  const intersecting = await findActiveHoldsIntersecting(db, {
    artifactId: artifactIds[0],
    personIds: personIds.length > 0 ? personIds : undefined,
    elementCategory:
      input.scope.scopeKind === "element_category" ? elementCategory : undefined,
    scopeKind:
      input.scope.scopeKind === "mixed" ? undefined : input.scope.scopeKind,
    scopeRef:
      input.scope.scopeKind === "mixed" ? undefined : input.scope.scopeRef,
  });

  for (const aid of artifactIds) {
    const more = await findActiveHoldsIntersecting(db, { artifactId: aid });
    for (const h of more) {
      if (!intersecting.find((x) => x.id === h.id)) intersecting.push(h);
    }
  }

  if (intersecting.length > 0) {
    const run = await insertDisposalRun(db, {
      trigger: input.trigger ?? "on_demand",
      scopeKind: input.scope.scopeKind,
      scopeRef: input.scope.scopeRef,
      actorAccountId: input.actorAccountId,
      correlationId,
      status: "blocked",
    });
    await completeDisposalRun(db, run.id, "blocked");
    await insertPropagationResult(db, {
      runId: run.id,
      targetKind: "scope",
      targetId: input.scope.scopeRef,
      outcome: "blocked_by_hold",
      detailFa: MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
      correlationId,
    });
    try {
      await appendAccessEvent(db, {
        correlationId,
        actorAccountId: input.actorAccountId,
        operation: "data.lifecycle.dispose",
        scope: {
          channel: "data_lifecycle",
          scopeKind: input.scope.scopeKind,
          scopeRef: input.scope.scopeRef,
        },
        result: "deny",
        reason: "legal_hold_active",
        entityType: "disposal_run",
        entityId: run.id,
        payload: { holdId: intersecting[0]!.id },
      });
    } catch {
      /* soft */
    }
    throw new DataLifecycleError(
      "DISPOSAL_BLOCKED_BY_HOLD",
      MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
      { holdId: intersecting[0]!.id, runId: run.id },
    );
  }

  const run = await insertDisposalRun(db, {
    trigger: input.trigger ?? "on_demand",
    scopeKind: input.scope.scopeKind,
    scopeRef: input.scope.scopeRef,
    actorAccountId: input.actorAccountId,
    correlationId,
  });

  const results: PropagationTargetResult[] = [];
  let anyFailed = false;
  let anyApplied = false;

  // --- Export artifacts ---
  let exportIds: string[] = [...artifactIds];
  try {
    const listed = await deps.listExportArtifactIds(db, {
      ...input.scope,
      personIds: personIds.length > 0 ? personIds : undefined,
      artifactIds: artifactIds.length > 0 ? artifactIds : undefined,
      elementCategory,
    });
    for (const id of listed) {
      if (!exportIds.includes(id)) exportIds.push(id);
    }
  } catch {
    anyFailed = true;
    results.push(
      await insertPropagationResult(db, {
        runId: run.id,
        targetKind: "export_list",
        outcome: "failed",
        detailFa: MSG_DISPOSAL_PROPAGATION_FAILED_FA,
        correlationId,
      }),
    );
    exportIds = [...artifactIds];
  }

  for (const artifactId of exportIds) {
    try {
      // Re-check hold immediately before destructive export clear.
      await assertNoActiveHoldForArtifact(db, {
        artifactId,
        personIds: personIds.length > 0 ? personIds : undefined,
        elementCategory,
      });
      await deps.disposeExportArtifact(db, {
        artifactId,
        actorAccountId: input.actorAccountId,
        reason: disposeReason,
        correlationId,
      });
      anyApplied = true;
      results.push(
        await insertPropagationResult(db, {
          runId: run.id,
          targetKind: "export_artifact",
          targetId: artifactId,
          outcome: "applied",
          detailFa: "بایت‌های خروجی مدیریت‌شده پاک شد.",
          correlationId,
        }),
      );
    } catch (err) {
      if (
        err instanceof DataLifecycleError &&
        err.code === "DISPOSAL_BLOCKED_BY_HOLD"
      ) {
        anyFailed = true;
        results.push(
          await insertPropagationResult(db, {
            runId: run.id,
            targetKind: "export_artifact",
            targetId: artifactId,
            outcome: "blocked_by_hold",
            detailFa: MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
            correlationId,
          }),
        );
        continue;
      }
      anyFailed = true;
      results.push(
        await insertPropagationResult(db, {
          runId: run.id,
          targetKind: "export_artifact",
          targetId: artifactId,
          outcome: "failed",
          detailFa: MSG_DISPOSAL_PROPAGATION_FAILED_FA,
          correlationId,
        }),
      );
    }
  }

  // --- Staging / error blobs (scoped only — never wipe-all) ---
  if (personIds.length === 0) {
    results.push(
      await insertPropagationResult(db, {
        runId: run.id,
        targetKind: "import_staging",
        outcome: "skipped",
        detailFa: "بدون شناسه فرد، پاک‌سازی staging اعمال نشد.",
        correlationId,
      }),
    );
  } else {
    try {
      // Re-check person holds before staging wipe.
      for (const personId of personIds) {
        await assertNoActiveHoldForPersonWrite(db, { personId });
      }
      const staging = await db.query(
        `UPDATE migration_staging.import_batch_row r
         SET values = '{}'::jsonb
         FROM migration_staging.import_batch b
         WHERE r.batch_id = b.id
           AND b.status IN ('confirmed-draft', 'approved', 'staging-loaded', 'failed', 'rolled-back')
           AND (
             COALESCE(r.values->>'personId', '') = ANY($1::text[])
             OR COALESCE(r.values->>'person_id', '') = ANY($1::text[])
             OR COALESCE(r.values->>'id', '') = ANY($1::text[])
             OR EXISTS (
               SELECT 1
               FROM jsonb_each_text(r.values) AS kv(key, value)
               WHERE kv.value = ANY($1::text[])
             )
           )
         RETURNING r.id`,
        [personIds],
      );
      const cleared = staging.rowCount ?? 0;
      if (cleared > 0) {
        anyApplied = true;
        results.push(
          await insertPropagationResult(db, {
            runId: run.id,
            targetKind: "import_staging",
            outcome: "applied",
            detailFa: `ردیف‌های پیش‌نویس/خطا پاک‌سازی شدند (${cleared}).`,
            correlationId,
          }),
        );
      } else {
        results.push(
          await insertPropagationResult(db, {
            runId: run.id,
            targetKind: "import_staging",
            outcome: "skipped",
            detailFa: "ردیف staging در محدوده نبود.",
            correlationId,
          }),
        );
      }
    } catch (err) {
      if (isMissingRelationError(err)) {
        results.push(
          await insertPropagationResult(db, {
            runId: run.id,
            targetKind: "import_staging",
            outcome: "skipped",
            detailFa: "طرح migration_staging در این محیط موجود نیست.",
            correlationId,
          }),
        );
      } else {
        anyFailed = true;
        results.push(
          await insertPropagationResult(db, {
            runId: run.id,
            targetKind: "import_staging",
            outcome: "failed",
            detailFa: MSG_DISPOSAL_PROPAGATION_FAILED_FA,
            correlationId,
          }),
        );
      }
    }
  }

  // --- Person dictionary fields (operational values only — AD-2) ---
  if (personIds.length > 0) {
    const elements = await listDataElements(prisma);
    for (const personId of personIds) {
      for (const el of elements) {
        if (!el.enabled || !el.personFieldKey) continue;
        const fieldKey = el.personFieldKey as PersonProfileFieldKey;
        if (!ELEMENT_TO_PERSON_FIELD[el.elementId]) continue;

        // When disposing by element_category, only touch matching category.
        if (
          elementCategory &&
          el.categoryId != null &&
          el.categoryId !== elementCategory &&
          el.elementId !== elementCategory
        ) {
          continue;
        }
        if (
          elementCategory &&
          el.categoryId == null &&
          el.elementId !== elementCategory
        ) {
          // No category on element — match elementId only when filter set.
          continue;
        }

        let action: "skip" | "anonymize" | "delete" | "restrict";
        try {
          action = disposalActionForClass(el.retention);
        } catch {
          anyFailed = true;
          results.push(
            await insertPropagationResult(db, {
              runId: run.id,
              targetKind: "person_field",
              targetId: `${personId}:${fieldKey}`,
              outcome: "failed",
              detailFa: MSG_LIFECYCLE_METADATA_INCOMPLETE_FA,
              correlationId,
            }),
          );
          continue;
        }

        if (action === "skip") {
          results.push(
            await insertPropagationResult(db, {
              runId: run.id,
              targetKind: "person_field",
              targetId: `${personId}:${fieldKey}`,
              outcome: "skipped",
              detailFa: "کلاس retain — حذف عملیاتی اعمال نشد.",
              correlationId,
            }),
          );
          continue;
        }

        try {
          // Re-check person + element_category hold immediately before write.
          await assertNoActiveHoldForPersonWrite(db, {
            personId,
            elementCategory: el.categoryId,
          });
          await applyPersonFieldDisposal(prisma, personId, fieldKey, action);
          await upsertDisposedField(db, {
            personId,
            fieldKey,
            elementId: el.elementId,
            action,
            runId: run.id,
            correlationId,
          });
          anyApplied = true;
          results.push(
            await insertPropagationResult(db, {
              runId: run.id,
              targetKind: "person_field",
              targetId: `${personId}:${fieldKey}`,
              outcome: "applied",
              detailFa:
                action === "anonymize"
                  ? "مقدار ناشناس شد."
                  : action === "restrict"
                    ? "مقدار محدود شد."
                    : "مقدار پاک شد.",
              correlationId,
            }),
          );
        } catch (err) {
          if (
            err instanceof DataLifecycleError &&
            err.code === "DISPOSAL_BLOCKED_BY_HOLD"
          ) {
            anyFailed = true;
            results.push(
              await insertPropagationResult(db, {
                runId: run.id,
                targetKind: "person_field",
                targetId: `${personId}:${fieldKey}`,
                outcome: "blocked_by_hold",
                detailFa: MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
                correlationId,
              }),
            );
            continue;
          }
          anyFailed = true;
          results.push(
            await insertPropagationResult(db, {
              runId: run.id,
              targetKind: "person_field",
              targetId: `${personId}:${fieldKey}`,
              outcome: "failed",
              detailFa: MSG_DISPOSAL_PROPAGATION_FAILED_FA,
              correlationId,
            }),
          );
        }
      }
    }
  }

  // Backup / restore honesty hook — evidence note, not a successful restore apply.
  results.push(
    await insertPropagationResult(db, {
      runId: run.id,
      targetKind: "backup_restore_hook",
      outcome: "skipped",
      detailFa: MSG_RESTORE_CATCHUP_REQUIRED_FA,
      correlationId,
    }),
  );

  const finalStatus =
    anyFailed && anyApplied
      ? "partial"
      : anyFailed
        ? "failed"
        : "completed";
  const completed = await completeDisposalRun(db, run.id, finalStatus);
  if (!completed) {
    throw new DataLifecycleError(
      "DISPOSAL_PROPAGATION_FAILED",
      MSG_DISPOSAL_PROPAGATION_FAILED_FA,
    );
  }

  try {
    await appendAccessEvent(db, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "data.lifecycle.dispose",
      scope: {
        channel: "data_lifecycle",
        scopeKind: input.scope.scopeKind,
        scopeRef: input.scope.scopeRef,
      },
      // partial is attributable success-with-gaps, not an authz deny
      result: finalStatus === "failed" ? "deny" : "allow",
      reason: finalStatus,
      entityType: "disposal_run",
      entityId: completed.id,
      payload: {
        outcome: finalStatus,
        restoreCatchUpRequired: true,
        disposeReason,
      },
    });
  } catch {
    /* soft */
  }

  if (finalStatus === "failed") {
    throw new DataLifecycleError(
      "DISPOSAL_PROPAGATION_FAILED",
      MSG_DISPOSAL_PROPAGATION_FAILED_FA,
      { runId: completed.id },
    );
  }

  return {
    run: completed,
    results,
    restoreCatchUpRequiredFa: MSG_RESTORE_CATCHUP_REQUIRED_FA,
  };
}

async function applyPersonFieldDisposal(
  prisma: PrismaClient,
  personId: string,
  fieldKey: PersonProfileFieldKey,
  action: "anonymize" | "delete" | "restrict",
): Promise<void> {
  // Opaque token must not embed personId (stable identity leak).
  const opaque = `disposed-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const data: Record<string, unknown> = {};

  switch (fieldKey) {
    case "personnelCode":
      data.personnelCode =
        action === "anonymize" || action === "restrict"
          ? `X-${opaque}`
          : `D-${opaque}`;
      break;
    case "givenName":
    case "familyName":
    case "fatherName":
      data[fieldKey] =
        action === "anonymize" || action === "restrict" ? "—" : "";
      break;
    case "mobilePhone":
    case "nationalId":
    case "nationality":
    case "gender":
      data[fieldKey] = null;
      break;
    case "birthDate":
      data.birthDate = null;
      break;
    default:
      data[fieldKey] = null;
  }

  await prisma.person.update({
    where: { id: personId },
    data,
  });
}

export async function getDisposalLimitDisclosure(
  db: PgQueryable,
  personId: string,
): Promise<{
  limited: boolean;
  disposedFields: DisposedFieldMarker[];
  messageFa: string | null;
}> {
  const disposedFields = await listDisposedFieldsForPerson(db, personId);
  if (disposedFields.length === 0) {
    return { limited: false, disposedFields: [], messageFa: null };
  }
  return {
    limited: true,
    disposedFields,
    messageFa: MSG_DISPOSAL_LIMIT_DISCLOSURE_FA,
  };
}

export {
  findActiveHoldsIntersecting,
  getDisposalRun,
  listDisposalRuns,
  listLegalHolds,
  listPropagationResults,
  parseLifecycleClass,
  withLifecycleTransaction,
  MSG_LEGAL_HOLD_ACTIVE_FA,
  type DisposalScope,
  type DisposedFieldMarker,
  type PgQueryable,
};
