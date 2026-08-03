/**
 * Governed settings tRPC (Story 10.2–10.4 / FR-60).
 * Thin web: compose registry + resolver + store mutations + RO inventory export.
 * Apply/reset validate via shared parse; RO keys never mutate via this router.
 */

import {
  AuditTrustError,
  DEV_DEMO_CATEGORIES,
  MSG_SETTINGS_DENIED_FA,
  SETTINGS_CONFIGURATION_DATA_CATEGORY,
  SETTINGS_READ_PERMISSION,
  SETTINGS_WRITE_PERMISSION,
  assertAuditTrustWriterAllowed,
  enforceClockAnomalyOrThrow,
  loadCategoryRegistry,
} from "@divan/audit-envelope";
import {
  GOVERNED_SETTINGS_REGISTRY,
  GovernedSettingsError,
  assertValidSettingsValue,
  deleteOverride,
  getCodeDefault,
  getSettingsConfigurationDetailFa,
  getSettingsParameter,
  invalidateSettingsCache,
  invalidSettingsValueMessageFa,
  isSettingsStoreUnavailable,
  loadAllOverrides,
  MSG_SETTINGS_STORE_UNAVAILABLE_FA,
  resolveSetting,
  serializeSettingsInventoryValue,
  upsertOverride,
  warmSettingsCache,
  warmSettingsCacheFromEnvOnly,
  type SettingsOwningDomain,
  type SettingsParameterDefinition,
  type SettingsScalar,
} from "@divan/app-settings";
import { getSharedPgPool, type Pool } from "@divan/db";
import { appendAccessEvent, withTransaction } from "@divan/event-store";
import {
  currentAsOfDate,
  reauthorizeForQueuedOrArtifactWork,
  type CoarseRole,
} from "@divan/identity-access";
import { getPersonDb } from "@divan/person-employment";
import {
  ExportError,
  computeExportSnapshotHash,
  createExportArtifact,
  downloadExportArtifact,
  getExportArtifactById,
  panelDtoFromArtifact,
  type ExportFieldDef,
} from "@divan/reporting";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  domainHasRegistryKeys,
  roleMaySeeDomain,
  visibleDomainsForRole,
} from "@/lib/settings-domain-map";
import type {
  SettingsListByDomainResult,
  SettingsMutationResult,
  SettingsParameterRowDto,
} from "@/lib/settings-types";
import { operationalCopy } from "@/lib/operational-copy";

import { createTRPCRouter, governedProcedure } from "./trpc";

export type {
  SettingsParameterRowDto,
  SettingsListByDomainResult,
  SettingsMutationResult,
};

const owningDomainSchema = z.enum([
  "general_display",
  "data_retention",
  "import_export",
  "capacity_hiring",
  "access_session",
  "audit_integrity",
  "infrastructure",
]);

const reasonSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(10).max(500));

const settingsValueSchema = z.union([
  z.number(),
  z.string(),
  z.boolean(),
  z.array(z.string().min(1)).min(1),
]);

/** Domains whose inventory view/export is security-relevant (Story 10.4 AC #5). */
const SECURITY_INVENTORY_DOMAINS = new Set<SettingsOwningDomain>([
  "access_session",
  "audit_integrity",
  "infrastructure",
]);

const INVENTORY_EXPORT_FIELDS: readonly ExportFieldDef[] = Object.freeze([
  {
    id: "key",
    headerFa: "کلید",
    dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
  },
  {
    id: "labelFa",
    headerFa: "برچسب",
    dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
  },
  {
    id: "domain",
    headerFa: "دامنه",
    dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
  },
  {
    id: "value",
    headerFa: "مقدار موثر",
    dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
  },
  {
    id: "source",
    headerFa: "منبع",
    dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
  },
  {
    id: "changePathFa",
    headerFa: "مسیر تغییر",
    dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
  },
]);

let settingsPool: Pool | null = null;

/** Returns null when DATABASE_URL is absent — callers fail closed to code defaults. */
function tryGetSettingsPool(): Pool | null {
  if (settingsPool) return settingsPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  settingsPool = getSharedPgPool(url);
  return settingsPool;
}

function categoryRegistryForExport() {
  try {
    return loadCategoryRegistry();
  } catch {
    return DEV_DEMO_CATEGORIES;
  }
}

function makeExportReauth(accountId: string, actorScopeCodes: string[]) {
  return (input: {
    accountId: string;
    populationChannel: "export";
    objectIds?: string[];
    actorScopeCodes?: string[];
    asOfDate?: string;
  }) =>
    reauthorizeForQueuedOrArtifactWork({
      accountId: input.accountId || accountId,
      populationChannel: "export",
      objectIds: input.objectIds,
      actorScopeCodes: input.actorScopeCodes ?? actorScopeCodes,
      asOfDate: input.asOfDate,
    });
}

/**
 * Soft PermissionSet check. Infra/DB failure → false (fail closed to deny).
 */
async function actorHoldsSettingsPermission(
  accountId: string,
  permission: string,
): Promise<boolean> {
  try {
    const db = getPersonDb();
    const rows = await db.accountAccessRole.findMany({
      where: { accountId },
      include: {
        accessRole: { include: { permissionSet: true } },
      },
    });
    return rows.some((row) =>
      (row.accessRole.permissionSet?.permissions ?? []).includes(permission),
    );
  } catch {
    return false;
  }
}

async function actorHoldsSettingsRead(accountId: string): Promise<boolean> {
  return actorHoldsSettingsPermission(accountId, SETTINGS_READ_PERMISSION);
}

async function actorHoldsSettingsWrite(accountId: string): Promise<boolean> {
  return actorHoldsSettingsPermission(accountId, SETTINGS_WRITE_PERMISSION);
}

async function appendSettingsAccessEvent(input: {
  correlationId: string;
  actorAccountId: string;
  outcome: "allow" | "deny";
  reason: string;
  operation: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const pool = tryGetSettingsPool();
  if (!pool) return;
  await appendAccessEvent(pool, {
    correlationId: input.correlationId,
    actorAccountId: input.actorAccountId,
    operation: input.operation,
    scope: {
      channel: "settings",
      purpose: "settings_configuration",
      volume: 1,
    },
    result: input.outcome,
    reason: input.reason,
    entityType: "settings_configuration",
    payload: input.payload ?? {},
  });
}

/** Soft-deny: prefer FORBIDDEN even if access-event append fails. */
async function denySettings(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
}): Promise<never> {
  try {
    await appendSettingsAccessEvent({
      correlationId: input.correlationId,
      actorAccountId: input.actorAccountId,
      outcome: "deny",
      reason: "permission_set_missing",
      operation: input.operation,
    });
  } catch {
    // Prefer client-visible deny over append failure masking.
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: MSG_SETTINGS_DENIED_FA,
  });
}

/** Marks required access-event append failure inside the FR51 transaction. */
class SettingsEvidenceAppendError extends Error {
  override readonly cause: unknown;
  constructor(cause: unknown) {
    super("settings_evidence_append_failed");
    this.name = "SettingsEvidenceAppendError";
    this.cause = cause;
  }
}

/**
 * FR51 allow-path: trust/append failure must not leave unaudited overrides.
 * Non-evidence failures keep generic apply/reset ops copy (TX already rolled back).
 */
function throwSettingsEvidenceRequired(
  err: unknown,
  kind: "apply" | "reset",
): never {
  if (err instanceof TRPCError) throw err;
  if (err instanceof GovernedSettingsError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err.messageFa,
    });
  }
  if (
    err instanceof AuditTrustError ||
    err instanceof SettingsEvidenceAppendError
  ) {
    // Trust suspend / append failure → INTERNAL ops copy (never «دسترسی ندارید.»).
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: operationalCopy.settingsEvidenceRequiredFail,
      cause: err instanceof AuditTrustError ? err : err.cause,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message:
      kind === "reset"
        ? operationalCopy.settingsResetError
        : operationalCopy.settingsApplyError,
    cause: err,
  });
}

/** After a committed FR51 TX, never surface cache/projection noise as mutation failure. */
async function projectRowAfterEvidenceCommit(
  pool: Pool,
  key: string,
): Promise<SettingsParameterRowDto> {
  try {
    await invalidateSettingsCache(pool);
  } catch {
    // Override + access event already committed — prefer mutation success.
  }
  try {
    return await projectFreshRow(pool, key);
  } catch {
    const def = getSettingsParameter(key);
    return toRowDto(def, null);
  }
}

function serializeValue(
  def: SettingsParameterDefinition,
  value: SettingsScalar,
): string | number | boolean | string[] {
  // Fail closed on secret-shaped registry mistakes (list + export share helper).
  return serializeSettingsInventoryValue(def, value);
}

function toRowDto(
  def: SettingsParameterDefinition,
  overrideMeta?: { updatedBy: string | null; updatedAt: string } | null,
): SettingsParameterRowDto {
  const resolved = resolveSetting(def.key);
  const defaultForDto =
    def.editability === "read_only_with_evidence" &&
    resolved.source === "code_default"
      ? resolved.value
      : def.defaultValue;
  return {
    key: def.key,
    labelFa: def.labelFa,
    descriptionFa: def.descriptionFa,
    unitFa: def.unitFa,
    value: serializeValue(def, resolved.value),
    defaultValue: serializeValue(def, defaultForDto),
    source: resolved.source,
    range: def.range,
    allowlist: def.allowlist,
    editability: def.editability,
    changePathFa: def.changePathFa,
    lastChangedBy: overrideMeta?.updatedBy ?? null,
    lastChangedAtIso: overrideMeta?.updatedAt ?? null,
    valueType: def.valueType,
    highImpact: def.highImpact,
    blastRadiusFa: def.blastRadiusFa,
  };
}

async function listRowsForDomain(
  domain: SettingsOwningDomain,
): Promise<Omit<SettingsListByDomainResult, "domain">> {
  const pool = tryGetSettingsPool();
  let storeUnavailable = pool == null;
  let detailFa: string | null = storeUnavailable
    ? MSG_SETTINGS_STORE_UNAVAILABLE_FA
    : null;

  if (pool) {
    try {
      await warmSettingsCache(pool);
    } catch {
      // Resolver fails closed to code defaults when store unavailable.
    }

    storeUnavailable = isSettingsStoreUnavailable();
    if (storeUnavailable) {
      detailFa =
        getSettingsConfigurationDetailFa() ?? MSG_SETTINGS_STORE_UNAVAILABLE_FA;
    }
  } else {
    // No DB — still overlay env for honest inventory (Story 10.4).
    await warmSettingsCacheFromEnvOnly();
  }

  let overrideByKey = new Map<
    string,
    { updatedBy: string | null; updatedAt: string }
  >();
  if (pool) {
    try {
      const overrides = await loadAllOverrides(pool);
      overrideByKey = new Map(
        overrides.map((o) => [
          o.parameterKey,
          { updatedBy: o.updatedBy, updatedAt: o.updatedAt },
        ]),
      );
    } catch {
      // Display without last-change metadata when store unavailable.
      storeUnavailable = true;
      detailFa =
        getSettingsConfigurationDetailFa() ?? MSG_SETTINGS_STORE_UNAVAILABLE_FA;
    }
  }

  const rows: SettingsParameterRowDto[] = GOVERNED_SETTINGS_REGISTRY.filter(
    (d) => d.owningDomain === domain,
  ).map((def) => toRowDto(def, overrideByKey.get(def.key) ?? null));

  return { rows, storeUnavailable, detailFa };
}

async function projectFreshRow(
  pool: Pool,
  key: string,
): Promise<SettingsParameterRowDto> {
  await warmSettingsCache(pool);
  const def = getSettingsParameter(key);
  let overrideMeta: { updatedBy: string | null; updatedAt: string } | null =
    null;
  try {
    const overrides = await loadAllOverrides(pool);
    const ov = overrides.find((o) => o.parameterKey === key);
    if (ov) {
      overrideMeta = { updatedBy: ov.updatedBy, updatedAt: ov.updatedAt };
    }
  } catch {
    // Row still projects from resolver.
  }
  return toRowDto(def, overrideMeta);
}

/**
 * Shared mutation gates (Story 10.3 algorithm steps 1–5).
 * Returns registry def + pool when authorized.
 */
async function gateSettingsMutation(input: {
  accountId: string;
  correlationId: string;
  coarseRole: CoarseRole;
  key: string;
  operation: string;
}): Promise<{ def: SettingsParameterDefinition; pool: Pool }> {
  const soft = await actorHoldsSettingsWrite(input.accountId);
  if (!soft) {
    await denySettings({
      correlationId: input.correlationId,
      actorAccountId: input.accountId,
      operation: input.operation,
    });
  }

  let def: SettingsParameterDefinition;
  try {
    def = getSettingsParameter(input.key);
  } catch (err) {
    if (
      err instanceof GovernedSettingsError &&
      err.code === "SETTINGS_UNKNOWN_KEY"
    ) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: operationalCopy.settingsUnknownKey,
      });
    }
    throw err;
  }

  if (def.editability !== "admin_editable") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: operationalCopy.settingsReadOnlyRefuse,
    });
  }

  if (!roleMaySeeDomain(input.coarseRole, def.owningDomain)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: MSG_SETTINGS_DENIED_FA,
    });
  }

  const pool = tryGetSettingsPool();
  if (!pool) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: operationalCopy.settingsStoreUnavailableApply,
    });
  }

  // Align with listByDomain: warm then honor storeUnavailable (not pool-only).
  try {
    await warmSettingsCache(pool);
  } catch {
    // warmSettingsCache fail-closes via isSettingsStoreUnavailable.
  }
  if (isSettingsStoreUnavailable()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: operationalCopy.settingsStoreUnavailableApply,
    });
  }

  return { def, pool };
}

function collectInventoryDefsForRole(
  coarseRole: CoarseRole,
): SettingsParameterDefinition[] {
  const visible = new Set(visibleDomainsForRole(coarseRole));
  return GOVERNED_SETTINGS_REGISTRY.filter(
    (d) =>
      d.editability === "read_only_with_evidence" &&
      visible.has(d.owningDomain),
  ) as SettingsParameterDefinition[];
}

function mapExportError(err: unknown): never {
  if (err instanceof ExportError) {
    const code =
      err.code === "EXPORT_DENIED" ||
      err.code === "REAUTH_FAILED" ||
      err.code === "SENSITIVE_EXPORT_DENIED"
        ? "FORBIDDEN"
        : err.code === "ARTIFACT_NOT_FOUND"
          ? "NOT_FOUND"
          : "BAD_REQUEST";
    throw new TRPCError({
      code,
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof TRPCError) throw err;
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: operationalCopy.settingsInventoryExportError,
    cause: err,
  });
}

export const settingsRouter = createTRPCRouter({
  listByDomain: governedProcedure
    .meta({
      permission: SETTINGS_READ_PERMISSION,
      dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "settings.listByDomain",
      sensitive: true,
    })
    .input(z.object({ domain: owningDomainSchema }))
    .query(async ({ ctx, input }): Promise<SettingsListByDomainResult> => {
      const operation = "settings.listByDomain";
      const soft = await actorHoldsSettingsRead(ctx.session.accountId);
      if (!soft) {
        await denySettings({
          correlationId: ctx.correlationId,
          actorAccountId: ctx.session.accountId,
          operation,
        });
      }

      const coarseRole = ctx.session.coarseRole as CoarseRole;
      if (
        !roleMaySeeDomain(coarseRole, input.domain) ||
        !domainHasRegistryKeys(input.domain)
      ) {
        await denySettings({
          correlationId: ctx.correlationId,
          actorAccountId: ctx.session.accountId,
          operation,
        });
      }

      try {
        const listed = await listRowsForDomain(input.domain);

        if (SECURITY_INVENTORY_DOMAINS.has(input.domain)) {
          // AC #5: security-relevant inventory view must be audited — fail closed.
          await appendSettingsAccessEvent({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            outcome: "allow",
            reason: "inventory_view",
            operation: "settings.inventory.view",
            payload: {
              domain: input.domain,
              parameterKeys: listed.rows.map((r) => r.key),
            },
          });
        }

        return { domain: input.domain, ...listed };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: operationalCopy.settingsLoadError,
          cause: err,
        });
      }
    }),

  capabilities: governedProcedure
    .meta({
      permission: SETTINGS_READ_PERMISSION,
      dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "settings.capabilities",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const operation = "settings.capabilities";
      const soft = await actorHoldsSettingsRead(ctx.session.accountId);
      if (!soft) {
        await denySettings({
          correlationId: ctx.correlationId,
          actorAccountId: ctx.session.accountId,
          operation,
        });
      }

      const coarseRole = ctx.session.coarseRole as CoarseRole;
      return {
        domains: [...visibleDomainsForRole(coarseRole)],
      };
    }),

  exportInventory: governedProcedure
    .meta({
      permission: SETTINGS_READ_PERMISSION,
      dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
      action: "export",
      organizationalScope: "org:selfcheck",
      operation: "settings.inventory.export",
      sensitive: true,
    })
    .input(
      z.object({
        format: z.enum(["csv", "xlsx"]).default("csv"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const operation = "settings.inventory.export";
      const soft = await actorHoldsSettingsRead(ctx.session.accountId);
      if (!soft) {
        await denySettings({
          correlationId: ctx.correlationId,
          actorAccountId: ctx.session.accountId,
          operation,
        });
      }

      const coarseRole = ctx.session.coarseRole as CoarseRole;
      const pool = tryGetSettingsPool();
      if (!pool) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: operationalCopy.settingsInventoryExportUnavailable,
        });
      }

      try {
        await warmSettingsCache(pool);
      } catch {
        // continue with fail-closed defaults
      }

      const defs = collectInventoryDefsForRole(coarseRole);
      if (defs.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_SETTINGS_DENIED_FA,
        });
      }

      const asOf = currentAsOfDate();
      const filtersSnapshot = {
        purpose: "settings.inventory",
        domains: [...new Set(defs.map((d) => d.owningDomain))],
        keys: defs.map((d) => d.key),
      };
      const fieldIds = INVENTORY_EXPORT_FIELDS.map((f) => f.id);
      const reviewedSnapshotHash = computeExportSnapshotHash({
        sourceSurface: "settings_inventory",
        sourceKey: "settings.inventory",
        filters: filtersSnapshot,
        fieldIds,
        asOf,
      });

      let rows: Array<{
        id: string;
        cells: Record<string, string | number | null>;
      }>;
      try {
        rows = defs.map((def) => {
          const resolved = resolveSetting(def.key);
          const safeValue = serializeSettingsInventoryValue(def, resolved.value);
          const cellValue =
            typeof safeValue === "boolean"
              ? safeValue
                ? "true"
                : "false"
              : typeof safeValue === "string" || typeof safeValue === "number"
                ? safeValue
                : JSON.stringify(safeValue);
          return {
            id: def.key,
            cells: {
              key: def.key,
              labelFa: def.labelFa,
              domain: def.owningDomain,
              value: cellValue,
              source: resolved.source,
              changePathFa: def.changePathFa ?? "",
            },
          };
        });
      } catch (err) {
        if (err instanceof GovernedSettingsError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: operationalCopy.settingsInventoryExportError,
            cause: err,
          });
        }
        throw err;
      }

      try {
        const created = await createExportArtifact(pool, {
          ownerAccountId: ctx.session.accountId,
          purpose: "settings.inventory",
          sourceSurface: "settings_inventory",
          sourceKey: "settings.inventory",
          filtersSnapshot,
          reviewedSnapshotHash,
          asOf,
          format: input.format,
          fields: INVENTORY_EXPORT_FIELDS,
          rows,
          categoryRegistry: categoryRegistryForExport(),
          holdsCategoryExport: () => true,
          reauth: makeExportReauth(
            ctx.session.accountId,
            ctx.session.organizationalScopeCodes,
          ),
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          objectIds: [],
          correlationId: ctx.correlationId,
        });

        try {
          await appendSettingsAccessEvent({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            outcome: "allow",
            reason: "inventory_export",
            operation,
            payload: {
              parameterKeys: defs.map((d) => d.key),
              format: input.format,
              artifactId: created.artifact.id,
            },
          });
        } catch {
          // Artifact exists; soft-fail append must not undo create.
        }

        return panelDtoFromArtifact(created.artifact, {
          omittedSensitiveIds: created.omittedSensitiveIds,
          custodyBoundaryFa: created.custodyBoundaryFa,
        });
      } catch (err) {
        mapExportError(err);
      }
    }),

  downloadInventoryExport: governedProcedure
    .meta({
      permission: SETTINGS_READ_PERMISSION,
      dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
      action: "export",
      organizationalScope: "org:selfcheck",
      operation: "settings.inventory.export.download",
      sensitive: true,
    })
    .input(
      z.object({
        artifactId: z.string().uuid(),
        recipient: z.string().trim().min(1).max(200),
        destinationClass: z
          .enum(["local_download", "shared_drive", "email", "other"])
          .default("local_download"),
        custodyAck: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const soft = await actorHoldsSettingsRead(ctx.session.accountId);
      if (!soft) {
        await denySettings({
          correlationId: ctx.correlationId,
          actorAccountId: ctx.session.accountId,
          operation: "settings.inventory.export.download",
        });
      }

      const pool = tryGetSettingsPool();
      if (!pool) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: operationalCopy.settingsInventoryExportUnavailable,
        });
      }

      try {
        const existing = await getExportArtifactById(pool, input.artifactId);
        if (
          !existing ||
          existing.ownerAccountId !== ctx.session.accountId ||
          existing.sourceSurface !== "settings_inventory"
        ) {
          throw new ExportError(
            "ARTIFACT_NOT_FOUND",
            operationalCopy.exportArtifactNotFound,
          );
        }

        const result = await downloadExportArtifact(pool, {
          artifactId: input.artifactId,
          retrieverAccountId: ctx.session.accountId,
          recipient: input.recipient.trim(),
          destinationClass: input.destinationClass,
          custodyAck: input.custodyAck,
          reauth: makeExportReauth(
            ctx.session.accountId,
            ctx.session.organizationalScopeCodes,
          ),
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          objectIds: [],
          correlationId: ctx.correlationId,
        });

        return {
          artifactId: result.artifact.id,
          filename: result.contentFilename,
          contentType: result.contentType,
          contentBase64: result.contentBytes.toString("base64"),
          custodyBoundaryFa: result.custodyBoundaryFa,
          retrievalId: result.retrievalId,
          classificationFa: result.artifact.classificationFa,
          handlingFa: result.artifact.handlingFa,
          expiresAt: result.artifact.expiresAt,
        };
      } catch (err) {
        mapExportError(err);
      }
    }),

  applyParameter: governedProcedure
    .meta({
      permission: SETTINGS_WRITE_PERMISSION,
      dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "settings.apply",
      sensitive: true,
    })
    .input(
      z.object({
        key: z.string().min(1).max(200),
        value: settingsValueSchema,
        reason: reasonSchema,
      }),
    )
    .mutation(async ({ ctx, input }): Promise<SettingsMutationResult> => {
      const operation = "settings.apply";
      const coarseRole = ctx.session.coarseRole as CoarseRole;
      const { def, pool } = await gateSettingsMutation({
        accountId: ctx.session.accountId,
        correlationId: ctx.correlationId,
        coarseRole,
        key: input.key,
        operation,
      });

      let parsed: SettingsScalar;
      try {
        parsed = assertValidSettingsValue(def, input.value);
      } catch (err) {
        if (err instanceof GovernedSettingsError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.messageFa || invalidSettingsValueMessageFa(def),
          });
        }
        throw err;
      }

      const previous = resolveSetting(def.key).value;
      const effectAt = new Date().toISOString();
      const previousValue = serializeValue(def, previous);
      const newValue = serializeValue(def, parsed);

      try {
        await withTransaction(pool, async (client) => {
          await assertAuditTrustWriterAllowed(client, {
            correlationId: ctx.correlationId,
            permission: SETTINGS_WRITE_PERMISSION,
          });
          await enforceClockAnomalyOrThrow(client, {
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            permission: SETTINGS_WRITE_PERMISSION,
          });
          await upsertOverride(client, {
            parameterKey: def.key,
            value: parsed,
            updatedBy: ctx.session.accountId,
            reason: input.reason,
            effectAt,
            skipCacheRefresh: true,
          });
          try {
            await appendAccessEvent(client, {
              correlationId: ctx.correlationId,
              actorAccountId: ctx.session.accountId,
              operation,
              scope: {
                channel: "settings",
                purpose: "settings_configuration",
                volume: 1,
              },
              result: "allow",
              reason: "configuration_change",
              entityType: "settings_configuration",
              entityId: def.key,
              payload: {
                parameterKey: def.key,
                action: "apply",
                reason: input.reason,
                previousValue,
                newValue,
                effectAt,
              },
            });
          } catch (appendErr) {
            throw new SettingsEvidenceAppendError(appendErr);
          }
        });
      } catch (err) {
        throwSettingsEvidenceRequired(err, "apply");
      }

      const row = await projectRowAfterEvidenceCommit(pool, def.key);
      return { row, correlationId: ctx.correlationId };
    }),

  reset: governedProcedure
    .meta({
      permission: SETTINGS_WRITE_PERMISSION,
      dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "settings.reset",
      sensitive: true,
    })
    .input(
      z.object({
        key: z.string().min(1).max(200),
        reason: reasonSchema,
      }),
    )
    .mutation(async ({ ctx, input }): Promise<SettingsMutationResult> => {
      const operation = "settings.reset";
      const coarseRole = ctx.session.coarseRole as CoarseRole;
      const { def, pool } = await gateSettingsMutation({
        accountId: ctx.session.accountId,
        correlationId: ctx.correlationId,
        coarseRole,
        key: input.key,
        operation,
      });

      const previous = resolveSetting(def.key).value;
      const effectAt = new Date().toISOString();
      const previousValue = serializeValue(def, previous);
      const newValue = serializeValue(def, getCodeDefault(def.key));

      try {
        await withTransaction(pool, async (client) => {
          await assertAuditTrustWriterAllowed(client, {
            correlationId: ctx.correlationId,
            permission: SETTINGS_WRITE_PERMISSION,
          });
          await enforceClockAnomalyOrThrow(client, {
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            permission: SETTINGS_WRITE_PERMISSION,
          });
          const deleted = await deleteOverride(client, def.key, {
            skipCacheRefresh: true,
          });
          if (!deleted) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: operationalCopy.settingsResetDisabledReason,
            });
          }
          try {
            await appendAccessEvent(client, {
              correlationId: ctx.correlationId,
              actorAccountId: ctx.session.accountId,
              operation,
              scope: {
                channel: "settings",
                purpose: "settings_configuration",
                volume: 1,
              },
              result: "allow",
              reason: "configuration_reset",
              entityType: "settings_configuration",
              entityId: def.key,
              payload: {
                parameterKey: def.key,
                action: "reset",
                reason: input.reason,
                previousValue,
                newValue,
                effectAt,
              },
            });
          } catch (appendErr) {
            throw new SettingsEvidenceAppendError(appendErr);
          }
        });
      } catch (err) {
        throwSettingsEvidenceRequired(err, "reset");
      }

      const row = await projectRowAfterEvidenceCommit(pool, def.key);
      return { row, correlationId: ctx.correlationId };
    }),
});
