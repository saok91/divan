/**
 * Governed operations health tRPC (Story 7.2 / FR-45 / UJ-5).
 * Thin web: probes in identity-access / person-employment / migration / db.
 * Never returns personId, personnel codes, bind secrets, or import row payloads.
 *
 * Gate: SysAdmin path = identity/config/health only; HR elevation remains
 * break-glass (2.5). platformStatus.recalc stays protectedProcedure so the
 * global StaleRecalcBanner remains visible to all authenticated roles.
 */

import { randomUUID } from "node:crypto";

import {
  MSG_OPS_HEALTH_DENIED_FA,
  MSG_OPS_HEALTH_PROBE_FAILED_FA,
  OPS_HEALTH_READ_PERMISSION,
  OPS_MIGRATION_HONESTY_FA,
  OPS_PLATFORM_DATA_CATEGORY,
  OpsHealthError,
  getBackupEvidenceHook,
  type OpsHealthSection,
  type OpsHealthSnapshot,
} from "@divan/audit-envelope";
import { getSharedPgPool, type Pool } from "@divan/db";
import { appendAccessEvent } from "@divan/event-store";
import {
  MSG_LDAP_UNAVAILABLE,
  probeDirectoryConnectivity,
} from "@divan/identity-access";
import { getOpsImportBatchSummary } from "@divan/migration";
import {
  getOpsRecalcAggregate,
  getPersonDb,
} from "@divan/person-employment";
import { TRPCError } from "@trpc/server";

import { operationalCopy } from "@/lib/operational-copy";

import { createTRPCRouter, governedProcedure } from "./trpc";

const MSG_DB_REQUIRED_FA = "پیکربندی پایگاه داده برای عملیات موجود نیست.";

let opsPool: Pool | null = null;

function getOpsPool(): Pool {
  if (opsPool) return opsPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: MSG_DB_REQUIRED_FA,
    });
  }
  opsPool = getSharedPgPool(url);
  return opsPool;
}

function mapOpsError(err: unknown): never {
  if (err instanceof OpsHealthError) {
    const code =
      err.code === "OPS_HEALTH_DENIED" ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR";
    throw new TRPCError({
      code,
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof TRPCError) throw err;
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: operationalCopy.opsHealthProbeFailed,
  });
}

async function actorHoldsOpsHealthRead(accountId: string): Promise<boolean> {
  const db = getPersonDb();
  const rows = await db.accountAccessRole.findMany({
    where: { accountId },
    include: {
      accessRole: { include: { permissionSet: true } },
    },
  });
  return rows.some((row) =>
    (row.accessRole.permissionSet?.permissions ?? []).includes(
      OPS_HEALTH_READ_PERMISSION,
    ),
  );
}

async function appendOpsHealthAccessEvent(input: {
  correlationId: string;
  actorAccountId: string;
  outcome: "allow" | "deny";
  reason: string;
  operation?: string;
  sectionStatuses?: Record<string, string>;
}): Promise<void> {
  const pool = getOpsPool();
  await appendAccessEvent(pool, {
    correlationId: input.correlationId,
    actorAccountId: input.actorAccountId,
    operation: input.operation ?? "ops.health.read",
    scope: {
      channel: "ops",
      purpose: "ops_health",
      volume: 1,
    },
    result: input.outcome,
    reason: input.reason,
    entityType: "ops_health",
    payload: {
      // Non-sensitive metadata only — never HR values or secrets.
      sectionStatuses: input.sectionStatuses ?? {},
    },
  });
}

/** Soft-deny: prefer FORBIDDEN even if audit-of-ops append fails. */
async function denyOpsHealthOrThrow(input: {
  correlationId: string;
  actorAccountId: string;
}): Promise<never> {
  try {
    await appendOpsHealthAccessEvent({
      correlationId: input.correlationId,
      actorAccountId: input.actorAccountId,
      outcome: "deny",
      reason: "permission_set_missing",
    });
  } catch {
    // Prefer client-visible deny over append failure masking.
  }
  throw new OpsHealthError("OPS_HEALTH_DENIED", MSG_OPS_HEALTH_DENIED_FA);
}

async function probeServiceHealth(pool: Pool): Promise<OpsHealthSection> {
  try {
    await pool.query("SELECT 1");
    return {
      status: "ok",
      detailFa: operationalCopy.opsServiceOk,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: "red",
      detailFa: operationalCopy.opsServiceDbDown,
      updatedAt: new Date().toISOString(),
    };
  }
}

async function buildOpsHealthSnapshot(
  correlationId: string,
): Promise<OpsHealthSnapshot> {
  const pool = getOpsPool();

  const [identityProbe, service, recalcAgg, importSummary, backup] =
    await Promise.all([
      probeDirectoryConnectivity(),
      probeServiceHealth(pool),
      getOpsRecalcAggregate(pool).catch(() => null),
      getOpsImportBatchSummary(pool),
      Promise.resolve(getBackupEvidenceHook()),
    ]);

  const identity: OpsHealthSection = {
    status: identityProbe.status,
    detailFa: identityProbe.detailFa,
    updatedAt: new Date().toISOString(),
  };

  let recalculation: OpsHealthSection;
  if (!recalcAgg) {
    recalculation = {
      status: "unavailable",
      detailFa: operationalCopy.opsRecalcUnavailable,
      updatedAt: new Date().toISOString(),
    };
  } else {
    const { pendingCount, failedCount, staleCount, signal, sampleJobKeys } =
      recalcAgg;
    const blocking =
      signal.blockingStale || failedCount > 0 || staleCount > 0;
    const pending = signal.recalculationPending || pendingCount > 0;
    recalculation = {
      status: blocking ? "red" : pending ? "degraded" : "ok",
      detailFa: blocking
        ? operationalCopy.opsRecalcBlocking
        : pending
          ? operationalCopy.opsRecalcPending
          : operationalCopy.opsRecalcOk,
      pendingCount,
      failedCount,
      staleCount,
      correlationId: sampleJobKeys[0],
      updatedAt: new Date().toISOString(),
    };
  }

  const failedImport = importSummary.recentFailedCount;
  let importSection: OpsHealthSection;
  if (!importSummary.schemaAvailable) {
    importSection = {
      status: "unavailable",
      detailFa: importSummary.honestyFa,
      updatedAt: new Date().toISOString(),
    };
  } else {
    const pendingCount =
      (importSummary.byStatus["confirmed-draft"] ?? 0) +
      (importSummary.byStatus.approved ?? 0) +
      (importSummary.byStatus.executing ?? 0);
    const degraded =
      failedImport > 0 || importSummary.unknownStatusCount > 0;
    importSection = {
      status: degraded ? "degraded" : "ok",
      detailFa: importSummary.honestyFa,
      failedCount: failedImport,
      pendingCount,
      updatedAt: new Date().toISOString(),
    };
  }

  const backupSection: OpsHealthSection = {
    status: backup.status,
    detailFa: backup.detailFa,
    updatedAt: backup.lastEvidenceAt,
  };

  const depParts: string[] = [];
  const depRed =
    service.status === "red" ||
    identity.status === "red" ||
    recalculation.status === "red";
  const depDegraded =
    identity.status === "not_configured" ||
    identity.status === "unavailable" ||
    recalculation.status === "degraded" ||
    recalculation.status === "unavailable" ||
    backup.status === "not_configured" ||
    backup.status === "unavailable";

  depParts.push(
    service.status === "ok"
      ? operationalCopy.opsDepPostgresOk
      : operationalCopy.opsDepPostgresDown,
  );
  depParts.push(
    identity.status === "ok"
      ? operationalCopy.opsDepLdapOk
      : identity.status === "not_configured"
        ? operationalCopy.opsDepLdapNotConfigured
        : MSG_LDAP_UNAVAILABLE,
  );
  depParts.push(
    recalculation.status === "unavailable"
      ? operationalCopy.opsDepRecalcWorkerUnavailable
      : operationalCopy.opsDepRecalcWorkerKnown,
  );

  const dependencies: OpsHealthSection = {
    status: depRed ? "red" : depDegraded ? "degraded" : "ok",
    detailFa: depParts.join(" · "),
    updatedAt: new Date().toISOString(),
  };

  const honestyFa: string[] = [
    OPS_MIGRATION_HONESTY_FA.notCutoverProof,
    OPS_MIGRATION_HONESTY_FA.eventsOnlyZeroTrace,
    OPS_MIGRATION_HONESTY_FA.ad6PersonOrphans,
    OPS_MIGRATION_HONESTY_FA.baselineProjectorUnavailable,
    OPS_MIGRATION_HONESTY_FA.backupEvidenceHook,
  ];
  if (identity.status === "not_configured") {
    honestyFa.push(OPS_MIGRATION_HONESTY_FA.ldapSeededMode);
  }

  return {
    identity,
    service,
    recalculation,
    import: importSection,
    backup: backupSection,
    dependencies,
    honestyFa,
    correlationId,
  };
}

export const operationsRouter = createTRPCRouter({
  getHealth: governedProcedure
    .meta({
      permission: OPS_HEALTH_READ_PERMISSION,
      dataCategory: OPS_PLATFORM_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "ops.health.read",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const correlationId = randomUUID();
      try {
        const soft = await actorHoldsOpsHealthRead(ctx.session.accountId);
        if (!soft) {
          await denyOpsHealthOrThrow({
            correlationId,
            actorAccountId: ctx.session.accountId,
          });
        }

        const snapshot = await buildOpsHealthSnapshot(correlationId);

        try {
          await appendOpsHealthAccessEvent({
            correlationId,
            actorAccountId: ctx.session.accountId,
            outcome: "allow",
            reason: "ops_health_read",
            sectionStatuses: {
              identity: snapshot.identity.status,
              service: snapshot.service.status,
              recalculation: snapshot.recalculation.status,
              import: snapshot.import.status,
              backup: snapshot.backup.status,
              dependencies: snapshot.dependencies.status,
            },
          });
        } catch {
          // Soft-return: prefer ops visibility over audit-writer availability.
        }

        return snapshot;
      } catch (err) {
        mapOpsError(err);
      }
    }),

  capabilities: governedProcedure
    .meta({
      permission: OPS_HEALTH_READ_PERMISSION,
      dataCategory: OPS_PLATFORM_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "ops.health.capabilities",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const correlationId = randomUUID();
      try {
        const soft = await actorHoldsOpsHealthRead(ctx.session.accountId);
        if (!soft) {
          await denyOpsHealthOrThrow({
            correlationId,
            actorAccountId: ctx.session.accountId,
          });
        }
        try {
          await appendOpsHealthAccessEvent({
            correlationId,
            actorAccountId: ctx.session.accountId,
            outcome: "allow",
            reason: "ops_health_capabilities",
            operation: "ops.health.capabilities",
          });
        } catch {
          // Soft-return: capabilities still returned if audit append fails.
        }
        return {
          canReadOpsHealth: true,
          ldapUnavailableCopy: MSG_LDAP_UNAVAILABLE,
        };
      } catch (err) {
        mapOpsError(err);
      }
    }),
});

/** Exported for selfcheck / tests — do not use from UI. */
export const __opsHealthInternals = {
  MSG_OPS_HEALTH_PROBE_FAILED_FA,
  buildOpsHealthSnapshot,
  actorHoldsOpsHealthRead,
};
