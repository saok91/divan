/**
 * Controlled import governed router (Stories 6.1–6.2 / FR-37, FR-38, FR-52).
 *
 * Pipeline: authorize → parse/validate / staging approve / atomic cutover
 * → PopulationPort intersect/omit + honesty fields on reveal payloads.
 *
 * SoD (provisional): upload/confirm = person.write; approve = migration.approve;
 * execute = migration.execute. AR-MIGRATION pending freeze.
 * SoD PermissionSet seed is bootstrap/selfcheck only — not per-request.
 *
 * AD-4: production event-store append only via executeBatch cutover.
 */
import { getSharedPgPool, getSharedPrismaClient, type Pool } from "@divan/db";
import { intersectPopulation } from "@divan/identity-access";
import {
  IMPORT_MAX_FILE_BYTES,
  MIGRATION_APPROVE_PERMISSION,
  MIGRATION_EXECUTE_PERMISSION,
  MigrationError,
  approveStagingBatch,
  assertMigrationApprovePermission,
  buildImportPreviewBatch,
  cancelImportPreviewBatch,
  confirmImportPreviewDraft,
  executeImportBatch,
  getImportPreviewBatch,
  getLatestBatchEvidence,
  getStagingBatch,
  getStagingBatchByPreviewId,
  getStoredDraftForStaging,
  isLaunchImportTemplateKey,
  parseImportFile,
  projectStagingBatchForViewer,
  promoteConfirmedDraftToStaging,
  requireLaunchImportTemplateCatalogue,
  rollbackImportStaging,
  type ImportBatchEvidence,
  type ImportPreviewBatch,
  type StagingBatchRecord,
} from "@divan/migration";
import {
  PERSON_DATA_CATEGORY,
  PERSON_WRITE_PERMISSION,
  PersonIdentityError,
  assertActorHasPersonWrite,
} from "@divan/person-employment";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { operationalCopy } from "@/lib/operational-copy";

import { resolvePersonnelPopulationRegistry } from "./personnel-scoped-search";
import { createTRPCRouter, governedProcedure } from "./trpc";

const MSG_TEMPLATE_INVALID_FA = "کلید قالب واردسازی نامعتبر است.";
const MSG_UPLOAD_INVALID_FA = "فایل واردسازی نامعتبر است.";

/** Base64 length ceiling ≈ decoded IMPORT_MAX_FILE_BYTES (+ padding slack). */
const CONTENT_BASE64_MAX_CHARS =
  Math.ceil((IMPORT_MAX_FILE_BYTES * 4) / 3) + 8;

const BASE64_BODY_RE = /^[A-Za-z0-9+/]*={0,2}$/;

let migrationPool: Pool | null = null;

function getMigrationPool(): Pool {
  if (migrationPool) return migrationPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: operationalCopy.importLoadError,
    });
  }
  migrationPool = getSharedPgPool(url);
  return migrationPool;
}

async function actorHoldsMigrationPermission(
  accountId: string,
  permission: string,
): Promise<boolean> {
  const db = getSharedPrismaClient();
  const rows = await db.accountAccessRole.findMany({
    where: { accountId },
    include: {
      accessRole: { include: { permissionSet: true } },
    },
  });
  return rows.some((row) =>
    (row.accessRole.permissionSet?.permissions ?? []).includes(permission),
  );
}

function permissionHolder(accountId: string) {
  return {
    holds: (permission: string) =>
      actorHoldsMigrationPermission(accountId, permission),
  };
}

function projectBatchReveal(batch: StagingBatchRecord): StagingBatchRecord {
  return projectStagingBatchForViewer(batch, {
    permittedDataCategories: new Set([PERSON_DATA_CATEGORY]),
  });
}

function filterEvidenceRecordIds(
  evidence: ImportBatchEvidence,
  opts: {
    accountId: string;
    organizationalScopeCodes: string[];
    registry: Awaited<
      ReturnType<typeof resolvePersonnelPopulationRegistry>
    >["registry"];
    mode: "fixture-fail-closed" | "uuid-registry";
  },
): ImportBatchEvidence {
  const ids = evidence.createdRecordIds ?? [];
  if (ids.length === 0) return evidence;
  // Fixture default: no live workforce subjects to intersect — honesty via disclosure.
  if (opts.mode === "fixture-fail-closed") return evidence;
  const asOfDate = new Date().toISOString().slice(0, 10);
  const pop = intersectPopulation(
    {
      actorAccountId: opts.accountId,
      actorScopeCodes: opts.organizationalScopeCodes,
      asOfDate,
      channel: "list",
      objectIds: ids,
    },
    opts.registry,
  );
  if (!pop.ok) {
    return { ...evidence, createdRecordIds: [] };
  }
  return { ...evidence, createdRecordIds: pop.subjectIds };
}

function mapMigrationError(err: unknown): never {
  if (err instanceof MigrationError) {
    const code =
      err.code === "PERMISSION_DENIED" || err.code === "SOD_VIOLATION"
        ? "FORBIDDEN"
        : err.code === "PREVIEW_NOT_FOUND" || err.code === "STAGING_NOT_FOUND"
          ? "NOT_FOUND"
          : err.code === "CONCURRENT_BATCH"
            ? "CONFLICT"
            : "BAD_REQUEST";
    throw new TRPCError({
      code,
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof PersonIdentityError) {
    throw new TRPCError({
      code: err.code === "PERMISSION_DENIED" ? "FORBIDDEN" : "BAD_REQUEST",
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof TRPCError) throw err;
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: operationalCopy.importLoadError,
  });
}

function assertValidBase64(contentBase64: string): void {
  if (
    contentBase64.length % 4 !== 0 ||
    !BASE64_BODY_RE.test(contentBase64)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: MSG_UPLOAD_INVALID_FA,
    });
  }
}

export type MigrationTemplateEntry = {
  key: string;
  titleFa: string;
  arMigrationStatus: "provisional-pending-freeze";
  columns: Array<{ key: string; headerFa: string; required: boolean }>;
};

export type MigrationPreviewResponse = ImportPreviewBatch & {
  populationAuthzMode: "fixture-fail-closed" | "uuid-registry";
  populationDisclosureFa: string | null;
  statusHintFa: string | null;
  stagingBatchId?: string | null;
};

export type MigrationStagingResponse = {
  batch: StagingBatchRecord;
  populationAuthzMode: "fixture-fail-closed" | "uuid-registry";
  populationDisclosureFa: string | null;
  /** Rows are frozen after approve — executor UI must treat as read-only. */
  contentsReadOnly: boolean;
};

export type MigrationExecuteResponse = {
  batch: StagingBatchRecord;
  evidence: ImportBatchEvidence;
  idempotentReplay: boolean;
  populationAuthzMode: "fixture-fail-closed" | "uuid-registry";
  populationDisclosureFa: string | null;
};

function toPreviewResponse(
  batch: ImportPreviewBatch,
  population: {
    mode: "fixture-fail-closed" | "uuid-registry";
    disclosureFa: string | null;
  },
  stagingBatchId?: string | null,
): MigrationPreviewResponse {
  return {
    ...batch,
    populationAuthzMode: population.mode,
    populationDisclosureFa: population.disclosureFa,
    statusHintFa:
      batch.status === "confirmed-draft"
        ? "پیش‌نویس منجمد شد؛ مرحله بعد تأیید جداگانه و سپس اجراست."
        : "تأیید فقط پیش‌نویس را منجمد می‌کند؛ اجرا پس از تأیید جداگانه است.",
    executionAllowed: false,
    eventStoreAppended: false,
    stagingBatchId: stagingBatchId ?? null,
  };
}

const uploadInputSchema = z.object({
  templateKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentBase64: z.string().min(1).max(CONTENT_BASE64_MAX_CHARS),
});

const batchIdSchema = z.object({
  previewBatchId: z.string().uuid(),
});

const stagingIdSchema = z.object({
  batchId: z.string().uuid(),
});

export const migrationRouter = createTRPCRouter({
  templates: governedProcedure
    .meta({
      permission: PERSON_WRITE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.templates",
      sensitive: false,
    })
    .query(async ({ ctx }): Promise<{ templates: MigrationTemplateEntry[] }> => {
      try {
        await assertActorHasPersonWrite(ctx.session.accountId);
        const catalogue = requireLaunchImportTemplateCatalogue();
        return {
          templates: catalogue.map((t) => ({
            key: t.key,
            titleFa: t.titleFa,
            arMigrationStatus: t.arMigrationStatus,
            columns: t.columns.map((c) => ({
              key: c.key,
              headerFa: c.headerFa,
              required: c.required,
            })),
          })),
        };
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  uploadAndValidate: governedProcedure
    .meta({
      permission: PERSON_WRITE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.upload_and_validate",
      sensitive: true,
    })
    .input(uploadInputSchema)
    .mutation(async ({ ctx, input }): Promise<MigrationPreviewResponse> => {
      try {
        await assertActorHasPersonWrite(ctx.session.accountId);

        if (!isLaunchImportTemplateKey(input.templateKey)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: MSG_TEMPLATE_INVALID_FA,
          });
        }

        assertValidBase64(input.contentBase64);
        const buffer = Buffer.from(input.contentBase64, "base64");
        if (buffer.byteLength === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: MSG_UPLOAD_INVALID_FA,
          });
        }
        if (buffer.byteLength > IMPORT_MAX_FILE_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `حجم فایل از حد مجاز (${Math.floor(IMPORT_MAX_FILE_BYTES / (1024 * 1024))} مگابایت) بیشتر است.`,
          });
        }

        const population = await resolvePersonnelPopulationRegistry();
        const parsed = await parseImportFile({
          buffer,
          fileName: input.fileName,
          templateKey: input.templateKey,
        });

        const batch = buildImportPreviewBatch(parsed, {
          permittedDataCategories: new Set([PERSON_DATA_CATEGORY]),
          createdByAccountId: ctx.session.accountId,
        });

        return toPreviewResponse(batch, {
          mode: population.mode,
          disclosureFa: population.disclosureFa,
        });
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  getPreview: governedProcedure
    .meta({
      permission: PERSON_WRITE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "migration.get_preview",
      sensitive: true,
    })
    .input(batchIdSchema)
    .query(async ({ ctx, input }): Promise<MigrationPreviewResponse> => {
      try {
        await assertActorHasPersonWrite(ctx.session.accountId);
        const population = await resolvePersonnelPopulationRegistry();
        const batch = getImportPreviewBatch(input.previewBatchId, {
          actorAccountId: ctx.session.accountId,
          permittedDataCategories: new Set([PERSON_DATA_CATEGORY]),
        });
        const staging = await getStagingBatchByPreviewId(
          getMigrationPool(),
          input.previewBatchId,
        ).catch(() => null);
        return toPreviewResponse(
          batch,
          {
            mode: population.mode,
            disclosureFa: population.disclosureFa,
          },
          staging?.id ?? null,
        );
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  cancelPreview: governedProcedure
    .meta({
      permission: PERSON_WRITE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.cancel_preview",
      sensitive: false,
    })
    .input(batchIdSchema)
    .mutation(async ({ ctx, input }): Promise<{ cancelled: true }> => {
      try {
        await assertActorHasPersonWrite(ctx.session.accountId);
        cancelImportPreviewBatch(
          input.previewBatchId,
          ctx.session.accountId,
        );
        return { cancelled: true as const };
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  /**
   * Freeze draft + promote to durable staging (multi-instance handoff).
   * Still NOT production cutover.
   */
  confirmDraft: governedProcedure
    .meta({
      permission: PERSON_WRITE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.confirm_draft",
      sensitive: true,
    })
    .input(batchIdSchema)
    .mutation(async ({ ctx, input }): Promise<MigrationPreviewResponse> => {
      try {
        await assertActorHasPersonWrite(ctx.session.accountId);
        const population = await resolvePersonnelPopulationRegistry();
        const batch = confirmImportPreviewDraft(
          input.previewBatchId,
          ctx.session.accountId,
        );
        const stored = getStoredDraftForStaging(input.previewBatchId);
        if (!stored) {
          throw new MigrationError(
            "STAGING_NOT_FOUND",
            "پیش‌نویس برای انتقال به انبار موقت در دسترس نیست.",
          );
        }
        const staging = await promoteConfirmedDraftToStaging(
          getMigrationPool(),
          {
            preview: stored.batch,
            fullRows: stored.fullRows,
            uploadedByAccountId: stored.createdByAccountId,
            ownerDisplayName: ctx.session.displayName || ctx.session.username,
          },
        );
        return toPreviewResponse(
          batch,
          {
            mode: population.mode,
            disclosureFa: population.disclosureFa,
          },
          staging.id,
        );
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  approveBatch: governedProcedure
    .meta({
      permission: MIGRATION_APPROVE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.approve_batch",
      sensitive: true,
    })
    .input(stagingIdSchema)
    .mutation(async ({ ctx, input }): Promise<MigrationStagingResponse> => {
      try {
        await assertMigrationApprovePermission(
          permissionHolder(ctx.session.accountId),
        );
        const population = await resolvePersonnelPopulationRegistry();
        const batch = await approveStagingBatch(getMigrationPool(), {
          batchId: input.batchId,
          approverAccountId: ctx.session.accountId,
          ownerDisplayName: ctx.session.displayName || ctx.session.username,
        });
        return {
          batch: projectBatchReveal(batch),
          populationAuthzMode: population.mode,
          populationDisclosureFa: population.disclosureFa,
          contentsReadOnly: true,
        };
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  getBatch: governedProcedure
    .meta({
      permission: PERSON_WRITE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "migration.get_batch",
      sensitive: true,
    })
    .input(stagingIdSchema)
    .query(async ({ ctx, input }): Promise<MigrationStagingResponse> => {
      try {
        await assertActorHasPersonWrite(ctx.session.accountId);
        const population = await resolvePersonnelPopulationRegistry();
        const batch = await getStagingBatch(getMigrationPool(), input.batchId);
        return {
          batch: projectBatchReveal(batch),
          populationAuthzMode: population.mode,
          populationDisclosureFa: population.disclosureFa,
          contentsReadOnly: batch.payloadFrozen,
        };
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  executeBatch: governedProcedure
    .meta({
      permission: MIGRATION_EXECUTE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.execute_batch",
      sensitive: true,
    })
    .input(
      z.object({
        batchId: z.string().uuid(),
        cutoverTier: z.enum(["trial", "staging", "production"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<MigrationExecuteResponse> => {
      try {
        // Coarse gate string is provisional; domain re-checks PermissionSet.
        void MIGRATION_EXECUTE_PERMISSION;
        const population = await resolvePersonnelPopulationRegistry();
        const result = await executeImportBatch(getMigrationPool(), {
          batchId: input.batchId,
          executorAccountId: ctx.session.accountId,
          executorDisplayName: ctx.session.displayName || ctx.session.username,
          permissionHolder: permissionHolder(ctx.session.accountId),
          cutoverTier: input.cutoverTier ?? "trial",
        });
        const evidence = filterEvidenceRecordIds(result.evidence, {
          accountId: ctx.session.accountId,
          organizationalScopeCodes: ctx.session.organizationalScopeCodes,
          registry: population.registry,
          mode: population.mode,
        });
        return {
          ...result,
          batch: projectBatchReveal(result.batch),
          evidence,
          populationAuthzMode: population.mode,
          populationDisclosureFa: population.disclosureFa,
        };
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  rollbackStaging: governedProcedure
    .meta({
      permission: MIGRATION_EXECUTE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.rollback_staging",
      sensitive: true,
    })
    .input(stagingIdSchema)
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<{ batch: StagingBatchRecord; evidence: ImportBatchEvidence }> => {
        try {
          const holdsExecute = await actorHoldsMigrationPermission(
            ctx.session.accountId,
            MIGRATION_EXECUTE_PERMISSION,
          );
          const holdsApprove = await actorHoldsMigrationPermission(
            ctx.session.accountId,
            MIGRATION_APPROVE_PERMISSION,
          );
          if (!holdsExecute && !holdsApprove) {
            throw new MigrationError(
              "SOD_VIOLATION",
              "مجوز بازگشت انبار موقت را ندارید.",
            );
          }
          return await rollbackImportStaging(getMigrationPool(), {
            batchId: input.batchId,
          });
        } catch (err) {
          mapMigrationError(err);
        }
      },
    ),

  getBatchEvidence: governedProcedure
    .meta({
      permission: PERSON_WRITE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "migration.get_batch_evidence",
      sensitive: true,
    })
    .input(stagingIdSchema)
    .query(
      async ({
        ctx,
        input,
      }): Promise<{
        evidence: ImportBatchEvidence | null;
        populationAuthzMode: "fixture-fail-closed" | "uuid-registry";
        populationDisclosureFa: string | null;
      }> => {
        try {
          await assertActorHasPersonWrite(ctx.session.accountId);
          const population = await resolvePersonnelPopulationRegistry();
          const evidence = await getLatestBatchEvidence(
            getMigrationPool(),
            input.batchId,
          );
          return {
            evidence: evidence
              ? filterEvidenceRecordIds(evidence, {
                  accountId: ctx.session.accountId,
                  organizationalScopeCodes: ctx.session.organizationalScopeCodes,
                  registry: population.registry,
                  mode: population.mode,
                })
              : null,
            populationAuthzMode: population.mode,
            populationDisclosureFa: population.disclosureFa,
          };
        } catch (err) {
          mapMigrationError(err);
        }
      },
    ),
});
