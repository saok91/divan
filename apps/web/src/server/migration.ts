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
  MIGRATION_RECONCILE_PERMISSION,
  MIGRATION_SIGN_PERMISSION,
  MigrationError,
  approveStagingBatch,
  assertMigrationApprovePermission,
  buildDomainComparisonRows,
  buildImportPreviewBatch,
  cancelImportPreviewBatch,
  confirmImportPreviewDraft,
  createReconciliationRun,
  executeImportBatch,
  generateSampleWorkbook,
  getImportPreviewBatch,
  getLaunchImportTemplate,
  getLatestBatchEvidence,
  getReconciliation,
  getStagingBatch,
  getStagingBatchByPreviewId,
  getStoredDraftForStaging,
  isLaunchImportTemplateKey,
  listReconciliationRuns,
  parseImportFile,
  projectStagingBatchForViewer,
  promoteConfirmedDraftToStaging,
  requireLaunchImportTemplateCatalogue,
  rollbackImportStaging,
  runReconciliationCompare,
  setDiscrepancyDisposition,
  signReconciliation,
  upsertReconciliationControls,
  verifyProductionGateOnRun,
  type ImportBatchEvidence,
  type ImportPreviewBatch,
  type ReconciliationRun,
  type StagingBatchRecord,
} from "@divan/migration";
import {
  PERSON_DATA_CATEGORY,
  PERSON_READ_PERMISSION,
  PERSON_WRITE_PERMISSION,
  PersonIdentityError,
  assertActorHasPersonRead,
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
  purposeFa: string;
  requiredPermission: string;
  /** True when the caller holds `requiredPermission`. */
  callerMayUse: boolean;
  /** Persian access requirement when `!callerMayUse`; null when usable. */
  accessRequirementFa: string | null;
  arMigrationStatus: "provisional-pending-freeze";
  columns: Array<{
    key: string;
    headerFa: string;
    required: boolean;
    exampleValue: string;
  }>;
};

export type MigrationSampleWorkbookResponse = {
  fileName: string;
  contentBase64: string;
  contentType: string;
  templateKey: string;
  purpose: string;
  classificationFa: string;
  arMigrationStatus: "provisional-pending-freeze";
  samplePurpose: "sample_workbook";
};

function accessRequirementFaFor(permission: string): string {
  return operationalCopy.importTemplateAccessRequired.replace(
    "{permission}",
    permission,
  );
}

async function mapCatalogueEntry(
  accountId: string,
  t: ReturnType<typeof requireLaunchImportTemplateCatalogue>[number],
): Promise<MigrationTemplateEntry> {
  const callerMayUse = await actorHoldsMigrationPermission(
    accountId,
    t.requiredPermission,
  );
  return {
    key: t.key,
    titleFa: t.titleFa,
    purposeFa: t.purposeFa,
    requiredPermission: t.requiredPermission,
    callerMayUse,
    accessRequirementFa: callerMayUse
      ? null
      : accessRequirementFaFor(t.requiredPermission),
    arMigrationStatus: t.arMigrationStatus,
    columns: t.columns.map((c) => ({
      key: c.key,
      headerFa: c.headerFa,
      required: c.required,
      exampleValue: c.exampleValue,
    })),
  };
}

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
      permission: PERSON_READ_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "migration.templates",
      sensitive: false,
    })
    .query(async ({ ctx }): Promise<{ templates: MigrationTemplateEntry[] }> => {
      try {
        // Surface visibility: person.read. Per-template usability via callerMayUse.
        await assertActorHasPersonRead(ctx.session.accountId);
        const catalogue = requireLaunchImportTemplateCatalogue();
        const templates = await Promise.all(
          catalogue.map((t) => mapCatalogueEntry(ctx.session.accountId, t)),
        );
        return { templates };
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  downloadSampleWorkbook: governedProcedure
    .meta({
      permission: PERSON_WRITE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.sample_workbook",
      sensitive: true,
    })
    .input(z.object({ templateKey: z.string().min(1) }))
    .mutation(
      async ({ ctx, input }): Promise<MigrationSampleWorkbookResponse> => {
        try {
          await assertActorHasPersonWrite(ctx.session.accountId);

          if (!isLaunchImportTemplateKey(input.templateKey)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: MSG_TEMPLATE_INVALID_FA,
            });
          }

          const template = getLaunchImportTemplate(input.templateKey);
          if (!template) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: MSG_TEMPLATE_INVALID_FA,
            });
          }

          const mayUse = await actorHoldsMigrationPermission(
            ctx.session.accountId,
            template.requiredPermission,
          );
          if (!mayUse) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: accessRequirementFaFor(template.requiredPermission),
            });
          }

          const sample = await generateSampleWorkbook(input.templateKey);
          return {
            fileName: sample.fileName,
            contentBase64: sample.buffer.toString("base64"),
            contentType: sample.contentType,
            templateKey: sample.templateKey,
            purpose: sample.purposeFa,
            classificationFa: operationalCopy.importSampleClassificationFa,
            arMigrationStatus: sample.arMigrationStatus,
            samplePurpose: "sample_workbook",
          };
        } catch (err) {
          mapMigrationError(err);
        }
      },
    ),

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

        const uploadTemplate = getLaunchImportTemplate(input.templateKey);
        if (!uploadTemplate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: MSG_TEMPLATE_INVALID_FA,
          });
        }
        const mayUpload = await actorHoldsMigrationPermission(
          ctx.session.accountId,
          uploadTemplate.requiredPermission,
        );
        if (!mayUpload) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: accessRequirementFaFor(uploadTemplate.requiredPermission),
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
        reconciliationRunId: z.string().uuid().optional(),
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
          reconciliationRunId: input.reconciliationRunId ?? null,
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

  listReconciliationRuns: governedProcedure
    .meta({
      permission: MIGRATION_RECONCILE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "migration.list_reconciliation_runs",
      sensitive: true,
    })
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        void MIGRATION_RECONCILE_PERMISSION;
        void ctx;
        return await listReconciliationRuns(
          getMigrationPool(),
          input.batchId,
        );
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  getReconciliation: governedProcedure
    .meta({
      permission: MIGRATION_RECONCILE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "migration.get_reconciliation",
      sensitive: true,
    })
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        void MIGRATION_RECONCILE_PERMISSION;
        void ctx;
        const run = await getReconciliation(getMigrationPool(), input.runId);
        if (!run) {
          throw new MigrationError(
            "RECONCILIATION_REQUIRED",
            "اجرای تطبیق یافت نشد.",
          );
        }
        return {
          run,
          comparison: buildDomainComparisonRows(run),
          productionGate: verifyProductionGateOnRun(run, run.batchId),
        };
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  createReconciliationRun: governedProcedure
    .meta({
      permission: MIGRATION_RECONCILE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.create_reconciliation_run",
      sensitive: true,
    })
    .input(
      z.object({
        batchId: z.string().uuid(),
        tier: z
          .enum(["trial", "final", "production-candidate"])
          .optional(),
        sourceExtractVersion: z.string().max(200).optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ReconciliationRun> => {
      try {
        return await createReconciliationRun(getMigrationPool(), {
          batchId: input.batchId,
          createdBy: ctx.session.accountId,
          permissionHolder: permissionHolder(ctx.session.accountId),
          tier: input.tier,
          sourceExtractVersion: input.sourceExtractVersion,
          notes: input.notes,
        });
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  upsertReconciliationControls: governedProcedure
    .meta({
      permission: MIGRATION_RECONCILE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.upsert_reconciliation_controls",
      sensitive: true,
    })
    .input(
      z.object({
        runId: z.string().uuid(),
        controls: z
          .array(
            z.object({
              domainKey: z.string().min(1).max(64),
              controlValue: z.unknown(),
              labelFa: z.string().max(200).optional(),
            }),
          )
          .min(1)
          .max(32),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ReconciliationRun> => {
      try {
        return await upsertReconciliationControls(getMigrationPool(), {
          runId: input.runId,
          attestedBy: ctx.session.accountId,
          permissionHolder: permissionHolder(ctx.session.accountId),
          controls: input.controls.map((c) => ({
            domainKey: c.domainKey,
            controlValue: c.controlValue as import("@divan/migration").JsonValue,
            labelFa: c.labelFa,
          })),
        });
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  runReconciliationCompare: governedProcedure
    .meta({
      permission: MIGRATION_RECONCILE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.run_reconciliation_compare",
      sensitive: true,
    })
    .input(z.object({ runId: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<ReconciliationRun> => {
      try {
        return await runReconciliationCompare(getMigrationPool(), {
          runId: input.runId,
          permissionHolder: permissionHolder(ctx.session.accountId),
        });
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  setDiscrepancyDisposition: governedProcedure
    .meta({
      permission: MIGRATION_RECONCILE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.set_discrepancy_disposition",
      sensitive: true,
    })
    .input(
      z.object({
        runId: z.string().uuid(),
        discrepancyId: z.string().uuid(),
        status: z.enum(["accepted", "waived", "resolved"]),
        dispositionCode: z.string().min(1).max(64),
        dispositionRationaleFa: z.string().min(1).max(2000),
        ownerAccountId: z.string().min(1).max(128),
        ownerDisplay: z.string().max(200).optional(),
        waiver: z
          .object({
            independentApprover: z.string().min(1).max(128),
            scope: z.string().min(1).max(500),
            risk: z.string().min(1).max(500),
            compensatingControl: z.string().min(1).max(500),
            expiry: z.string().min(1).max(64),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await setDiscrepancyDisposition(getMigrationPool(), {
          discrepancyId: input.discrepancyId,
          runId: input.runId,
          permissionHolder: permissionHolder(ctx.session.accountId),
          actorAccountId: ctx.session.accountId,
          actorDisplay: ctx.session.displayName || ctx.session.username,
          status: input.status,
          dispositionCode: input.dispositionCode,
          dispositionRationaleFa: input.dispositionRationaleFa,
          ownerAccountId: input.ownerAccountId,
          ownerDisplay: input.ownerDisplay,
          waiver: input.waiver ?? null,
        });
      } catch (err) {
        mapMigrationError(err);
      }
    }),

  signReconciliation: governedProcedure
    .meta({
      permission: MIGRATION_SIGN_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "migration.sign_reconciliation",
      sensitive: true,
    })
    .input(
      z.object({
        runId: z.string().uuid(),
        roleCode: z.enum(["migration_lead", "hr_data_owner"]),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ReconciliationRun> => {
      try {
        void MIGRATION_SIGN_PERMISSION;
        return await signReconciliation(getMigrationPool(), {
          runId: input.runId,
          roleCode: input.roleCode,
          signerAccountId: ctx.session.accountId,
          permissionHolder: permissionHolder(ctx.session.accountId),
        });
      } catch (err) {
        mapMigrationError(err);
      }
    }),
});
