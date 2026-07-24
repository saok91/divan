/**
 * Controlled import preview governed router (Story 6.1 / FR-37, FR-52).
 *
 * Pipeline: authorize (person.write — existing; no invented migration.upload)
 * → parse/validate in @divan/migration → permission-omit preview columns
 * → PopulationPort honesty fields on payload.
 *
 * AC #7 note (review decision): staging upload rows are not live workforce
 * registry subjects — 6.1 discloses PopulationPort honesty only. Actor-derived
 * field/row intersect against production population is deferred until cutover /
 * 6.2 when under-permission omit has live registry subjects to match.
 *
 * AD-4: no production event-store append / Baseline / cutover (6.2).
 * Import Batch report remains unavailable (do not fabricate outcomes).
 */
import {
  IMPORT_MAX_FILE_BYTES,
  MigrationError,
  buildImportPreviewBatch,
  cancelImportPreviewBatch,
  confirmImportPreviewDraft,
  getImportPreviewBatch,
  isLaunchImportTemplateKey,
  parseImportFile,
  requireLaunchImportTemplateCatalogue,
  type ImportPreviewBatch,
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

/**
 * Coarse gate: reuse person.write (hr_admin already holds it for /import nav).
 * Do not invent migration.upload / migration.execute (AR-MIGRATION / SoD → 6.2).
 */
function mapMigrationError(err: unknown): never {
  if (err instanceof MigrationError) {
    const code =
      err.code === "PERMISSION_DENIED"
        ? "FORBIDDEN"
        : err.code === "PREVIEW_NOT_FOUND"
          ? "NOT_FOUND"
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
  /** Non-authoritative status hint only — SoD/execute mutex = 6.2 */
  statusHintFa: string | null;
};

function toPreviewResponse(
  batch: ImportPreviewBatch,
  population: {
    mode: "fixture-fail-closed" | "uuid-registry";
    disclosureFa: string | null;
  },
): MigrationPreviewResponse {
  return {
    ...batch,
    populationAuthzMode: population.mode,
    populationDisclosureFa: population.disclosureFa,
    statusHintFa:
      "تأیید فقط پیش‌نویس را منجمد می‌کند؛ اجرای دسته و قطعی‌سازی تولید در داستان ۶٫۲ است.",
    executionAllowed: false,
    eventStoreAppended: false,
  };
}

const uploadInputSchema = z.object({
  templateKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  /** Base64 of file bytes — keeps multipart out of client SoT. */
  contentBase64: z.string().min(1).max(CONTENT_BASE64_MAX_CHARS),
});

const batchIdSchema = z.object({
  previewBatchId: z.string().uuid(),
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

        // Preview is template-shaped staging data, not live workforce rows —
        // still disclose PopulationPort honesty when UI shows population context.
        // Category omit scaffold remains for selfcheck / future actor-derived sets.
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
        return toPreviewResponse(batch, {
          mode: population.mode,
          disclosureFa: population.disclosureFa,
        });
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
   * Freeze draft acknowledgement only — NOT production cutover (6.2).
   * Always returns executionAllowed: false / eventStoreAppended: false.
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
        return toPreviewResponse(batch, {
          mode: population.mode,
          disclosureFa: population.disclosureFa,
        });
      } catch (err) {
        mapMigrationError(err);
      }
    }),
});
