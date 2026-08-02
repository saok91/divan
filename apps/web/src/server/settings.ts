/**
 * Governed settings read-only tRPC (Story 10.2 / FR-60).
 * Thin web: compose registry + resolver + override metadata.
 * Never calls upsertOverride / deleteOverride.
 */

import {
  MSG_SETTINGS_DENIED_FA,
  SETTINGS_CONFIGURATION_DATA_CATEGORY,
  SETTINGS_READ_PERMISSION,
} from "@divan/audit-envelope";
import {
  GOVERNED_SETTINGS_REGISTRY,
  getSettingsConfigurationDetailFa,
  isSettingsStoreUnavailable,
  loadAllOverrides,
  MSG_SETTINGS_STORE_UNAVAILABLE_FA,
  resolveSetting,
  warmSettingsCache,
  type SettingsOwningDomain,
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
  SettingsParameterRowDto,
} from "@/lib/settings-types";
import { operationalCopy } from "@/lib/operational-copy";

import { createTRPCRouter, governedProcedure } from "./trpc";

export type { SettingsParameterRowDto, SettingsListByDomainResult };

const owningDomainSchema = z.enum([
  "general_display",
  "data_retention",
  "import_export",
  "capacity_hiring",
  "access_session",
  "audit_integrity",
  "infrastructure",
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
async function actorHoldsSettingsRead(accountId: string): Promise<boolean> {
  try {
    const db = getPersonDb();
    const rows = await db.accountAccessRole.findMany({
      where: { accountId },
      include: {
        accessRole: { include: { permissionSet: true } },
      },
    });
    return rows.some((row) =>
      (row.accessRole.permissionSet?.permissions ?? []).includes(
        SETTINGS_READ_PERMISSION,
      ),
    );
  } catch {
    return false;
  }
}

async function appendSettingsAccessEvent(input: {
  correlationId: string;
  actorAccountId: string;
  outcome: "allow" | "deny";
  reason: string;
  operation: string;
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
    payload: {},
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
  ).map((def) => {
    const resolved = resolveSetting(def.key);
    const ov = overrideByKey.get(def.key);
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
      lastChangedBy: ov?.updatedBy ?? null,
      lastChangedAtIso: ov?.updatedAt ?? null,
      valueType: def.valueType,
    };
  });

  return { rows, storeUnavailable, detailFa };
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
});
