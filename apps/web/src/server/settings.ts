/**
 * Governed settings tRPC (Story 10.2–10.3 / FR-60).
 * Thin web: compose registry + resolver + store mutations.
 * Apply/reset validate via shared parse; RO keys never mutate via this router.
 */

import {
  MSG_SETTINGS_DENIED_FA,
  SETTINGS_CONFIGURATION_DATA_CATEGORY,
  SETTINGS_READ_PERMISSION,
  SETTINGS_WRITE_PERMISSION,
} from "@divan/audit-envelope";
import {
  GOVERNED_SETTINGS_REGISTRY,
  GovernedSettingsError,
  assertValidSettingsValue,
  deleteOverride,
  getSettingsConfigurationDetailFa,
  getSettingsParameter,
  invalidSettingsValueMessageFa,
  isSettingsStoreUnavailable,
  loadAllOverrides,
  MSG_SETTINGS_STORE_UNAVAILABLE_FA,
  resolveSetting,
  upsertOverride,
  warmSettingsCache,
  type SettingsOwningDomain,
  type SettingsParameterDefinition,
  type SettingsScalar,
} from "@divan/app-settings";
import { getSharedPgPool, type Pool } from "@divan/db";
import { appendAccessEvent } from "@divan/event-store";
import type { CoarseRole } from "@divan/identity-access";
import { getPersonDb } from "@divan/person-employment";
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

let settingsPool: Pool | null = null;

/** Returns null when DATABASE_URL is absent — callers fail closed to code defaults. */
function tryGetSettingsPool(): Pool | null {
  if (settingsPool) return settingsPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  settingsPool = getSharedPgPool(url);
  return settingsPool;
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

function serializeValue(value: SettingsScalar): string | number | boolean | string[] {
  if (Array.isArray(value)) return [...value];
  return value as string | number | boolean;
}

function toRowDto(
  def: SettingsParameterDefinition,
  overrideMeta?: { updatedBy: string | null; updatedAt: string } | null,
): SettingsParameterRowDto {
  const resolved = resolveSetting(def.key);
  return {
    key: def.key,
    labelFa: def.labelFa,
    descriptionFa: def.descriptionFa,
    unitFa: def.unitFa,
    value: serializeValue(resolved.value),
    defaultValue: serializeValue(def.defaultValue),
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

      try {
        await upsertOverride(pool, {
          parameterKey: def.key,
          value: parsed,
          updatedBy: ctx.session.accountId,
          reason: input.reason,
          effectAt: null,
        });
      } catch (err) {
        if (err instanceof GovernedSettingsError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.messageFa,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: operationalCopy.settingsApplyError,
          cause: err,
        });
      }

      try {
        await appendSettingsAccessEvent({
          correlationId: ctx.correlationId,
          actorAccountId: ctx.session.accountId,
          outcome: "allow",
          reason: "configuration_change",
          operation,
          payload: {
            parameterKey: def.key,
            action: "apply",
            reason: input.reason,
            previousValue: serializeValue(previous),
            newValue: serializeValue(parsed),
          },
        });
      } catch {
        // Prefer successful mutation visibility; full FR51 = 10.5.
      }

      const row = await projectFreshRow(pool, def.key);
      return { row };
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

      let deleted = false;
      try {
        deleted = await deleteOverride(pool, def.key);
      } catch (err) {
        if (err instanceof GovernedSettingsError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.messageFa,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: operationalCopy.settingsResetError,
          cause: err,
        });
      }

      if (!deleted) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: operationalCopy.settingsResetDisabledReason,
        });
      }

      try {
        await appendSettingsAccessEvent({
          correlationId: ctx.correlationId,
          actorAccountId: ctx.session.accountId,
          outcome: "allow",
          reason: "configuration_reset",
          operation,
          payload: {
            parameterKey: def.key,
            action: "reset",
            reason: input.reason,
            previousValue: serializeValue(previous),
          },
        });
      } catch {
        // Prefer successful mutation visibility; full FR51 = 10.5.
      }

      const row = await projectFreshRow(pool, def.key);
      return { row };
    }),
});
