/**
 * Governed retention / legal hold / disposal tRPC (Story 7.3 / FR-50).
 * Thin web: orchestration in person-employment; export dispose via reporting.
 * Soft PermissionSet gate after envelope; soft-deny on allow-path append fail.
 * Map domain errors via messageFa / operational-copy only.
 */

import { randomUUID } from "node:crypto";

import {
  DATA_LIFECYCLE_DATA_CATEGORY,
  DATA_LIFECYCLE_DISPOSE_PERMISSION,
  DATA_LIFECYCLE_HOLD_PERMISSION,
  DATA_LIFECYCLE_READ_PERMISSION,
  DataLifecycleError,
  MSG_LIFECYCLE_DENIED_FA,
} from "@divan/audit-envelope";
import { getSharedPgPool, type Pool } from "@divan/db";
import { appendAccessEvent } from "@divan/event-store";
import {
  getDisposalRun,
  getPersonDb,
  listDisposalRuns,
  listLegalHolds,
  listPropagationResults,
  placeHold,
  releaseHold,
  runDisposal,
} from "@divan/person-employment";
import {
  disposeExportArtifact,
  listExportArtifactIdsForScope,
  onRequiredSourceDisposed,
} from "@divan/reporting";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { operationalCopy } from "@/lib/operational-copy";

import { createTRPCRouter, governedProcedure } from "./trpc";

const MSG_DB_REQUIRED_FA = "پیکربندی پایگاه داده برای چرخهٔ عمر موجود نیست.";

let retentionPool: Pool | null = null;

function getRetentionPool(): Pool {
  if (retentionPool) return retentionPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: MSG_DB_REQUIRED_FA,
    });
  }
  retentionPool = getSharedPgPool(url);
  return retentionPool;
}

function mapLifecycleError(err: unknown): never {
  if (err instanceof DataLifecycleError) {
    const code =
      err.code === "LIFECYCLE_DENIED"
        ? "FORBIDDEN"
        : err.code === "DISPOSAL_BLOCKED_BY_HOLD" ||
            err.code === "LEGAL_HOLD_ACTIVE" ||
            err.code === "LIFECYCLE_METADATA_INCOMPLETE" ||
            err.code === "HOLD_NOT_FOUND" ||
            err.code === "DISPOSAL_SCOPE_INCOMPLETE"
          ? "BAD_REQUEST"
          : "INTERNAL_SERVER_ERROR";
    throw new TRPCError({
      code,
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof TRPCError) throw err;
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: operationalCopy.lifecycleActionFailed,
  });
}

async function actorHoldsLifecyclePermission(
  accountId: string,
  permission: string,
): Promise<boolean> {
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
}

async function appendLifecycleAccessEvent(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
  outcome: "allow" | "deny";
  reason: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  const pool = getRetentionPool();
  await appendAccessEvent(pool, {
    correlationId: input.correlationId,
    actorAccountId: input.actorAccountId,
    operation: input.operation,
    scope: { channel: "data_lifecycle" },
    result: input.outcome,
    reason: input.reason,
    entityType: input.entityType ?? "data_lifecycle",
    entityId: input.entityId,
    payload: {},
  });
}

async function denyLifecycleOrThrow(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
}): Promise<never> {
  try {
    await appendLifecycleAccessEvent({
      ...input,
      outcome: "deny",
      reason: "permission_set_missing",
    });
  } catch {
    // Prefer client-visible deny over append failure masking.
  }
  throw new DataLifecycleError("LIFECYCLE_DENIED", MSG_LIFECYCLE_DENIED_FA);
}

const scopeKindSchema = z.enum([
  "person",
  "element_category",
  "artifact",
  "org_scope",
]);

export const retentionRouter = createTRPCRouter({
  listHolds: governedProcedure
    .meta({
      permission: DATA_LIFECYCLE_READ_PERMISSION,
      dataCategory: DATA_LIFECYCLE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "data.lifecycle.hold.list",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      try {
        const soft = await actorHoldsLifecyclePermission(
          ctx.session.accountId,
          DATA_LIFECYCLE_READ_PERMISSION,
        );
        if (!soft) {
          await denyLifecycleOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "data.lifecycle.hold.list",
          });
        }
        const holds = await listLegalHolds(getRetentionPool());
        try {
          await appendLifecycleAccessEvent({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "data.lifecycle.hold.list",
            outcome: "allow",
            reason: "list_holds",
          });
        } catch {
          /* soft-deny posture: never mask primary allow after envelope */
        }
        return {
          holds,
          exportTtlNoteFa: operationalCopy.lifecycleExportTtlNotRetention,
        };
      } catch (err) {
        mapLifecycleError(err);
      }
    }),

  placeHold: governedProcedure
    .meta({
      permission: DATA_LIFECYCLE_HOLD_PERMISSION,
      dataCategory: DATA_LIFECYCLE_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "data.lifecycle.hold.place",
      sensitive: true,
    })
    .input(
      z.object({
        scopeKind: scopeKindSchema,
        scopeRef: z.string().min(1).max(200),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsLifecyclePermission(
          ctx.session.accountId,
          DATA_LIFECYCLE_HOLD_PERMISSION,
        );
        if (!soft) {
          await denyLifecycleOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "data.lifecycle.hold.place",
          });
        }
        const hold = await placeHold(getRetentionPool(), {
          scopeKind: input.scopeKind,
          scopeRef: input.scopeRef,
          reason: input.reason,
          actorAccountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
        return { hold };
      } catch (err) {
        mapLifecycleError(err);
      }
    }),

  releaseHold: governedProcedure
    .meta({
      permission: DATA_LIFECYCLE_HOLD_PERMISSION,
      dataCategory: DATA_LIFECYCLE_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "data.lifecycle.hold.release",
      sensitive: true,
    })
    .input(z.object({ holdId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsLifecyclePermission(
          ctx.session.accountId,
          DATA_LIFECYCLE_HOLD_PERMISSION,
        );
        if (!soft) {
          await denyLifecycleOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "data.lifecycle.hold.release",
          });
        }
        const hold = await releaseHold(getRetentionPool(), {
          holdId: input.holdId,
          actorAccountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
        return { hold };
      } catch (err) {
        mapLifecycleError(err);
      }
    }),

  runDisposal: governedProcedure
    .meta({
      permission: DATA_LIFECYCLE_DISPOSE_PERMISSION,
      dataCategory: DATA_LIFECYCLE_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "data.lifecycle.dispose",
      sensitive: true,
    })
    .input(
      z.object({
        scopeKind: z.enum([
          "person",
          "element_category",
          "artifact",
          "org_scope",
          "mixed",
        ]),
        scopeRef: z.string().min(1).max(200),
        reason: z.string().min(1).max(500),
        personIds: z.array(z.string().uuid()).max(50).optional(),
        artifactIds: z.array(z.string().uuid()).max(50).optional(),
        elementCategory: z.string().max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsLifecyclePermission(
          ctx.session.accountId,
          DATA_LIFECYCLE_DISPOSE_PERMISSION,
        );
        if (!soft) {
          await denyLifecycleOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "data.lifecycle.dispose",
          });
        }
        const pool = getRetentionPool();
        const result = await runDisposal(
          pool,
          {
            scope: {
              scopeKind: input.scopeKind,
              scopeRef: input.scopeRef,
              personIds: input.personIds,
              artifactIds: input.artifactIds,
              elementCategory: input.elementCategory,
            },
            actorAccountId: ctx.session.accountId,
            correlationId: ctx.correlationId,
            reason: input.reason,
          },
          {
            disposeExportArtifact,
            listExportArtifactIds: (db, scope) =>
              listExportArtifactIdsForScope(db, {
                artifactIds: scope.artifactIds,
                personIds: scope.personIds,
                scopeKind: scope.scopeKind,
                scopeRef: scope.scopeRef,
              }),
            onRequiredSourceDisposed: async (db, pubInput) =>
              onRequiredSourceDisposed(db, {
                disposalRunId: pubInput.disposalRunId,
                actorAccountId: pubInput.actorAccountId,
                correlationId: pubInput.correlationId,
                scope: {
                  scopeKind: pubInput.scope.scopeKind,
                  scopeRef: pubInput.scope.scopeRef,
                  personIds: pubInput.scope.personIds,
                  artifactIds: pubInput.scope.artifactIds,
                  elementCategory: pubInput.scope.elementCategory,
                },
              }),
          },
        );
        return {
          run: result.run,
          results: result.results,
          restoreCatchUpRequiredFa: result.restoreCatchUpRequiredFa,
          custodyBoundaryNoteFa: operationalCopy.lifecycleCustodyBoundary,
        };
      } catch (err) {
        mapLifecycleError(err);
      }
    }),

  getRun: governedProcedure
    .meta({
      permission: DATA_LIFECYCLE_READ_PERMISSION,
      dataCategory: DATA_LIFECYCLE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "data.lifecycle.run.get",
      sensitive: true,
    })
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsLifecyclePermission(
          ctx.session.accountId,
          DATA_LIFECYCLE_READ_PERMISSION,
        );
        if (!soft) {
          await denyLifecycleOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "data.lifecycle.run.get",
          });
        }
        const pool = getRetentionPool();
        const run = await getDisposalRun(pool, input.runId);
        if (!run) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: operationalCopy.lifecycleRunNotFound,
          });
        }
        const results = await listPropagationResults(pool, input.runId);
        try {
          await appendLifecycleAccessEvent({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "data.lifecycle.run.get",
            outcome: "allow",
            reason: "get_run",
            entityType: "disposal_run",
            entityId: run.id,
          });
        } catch {
          /* soft */
        }
        return { run, results };
      } catch (err) {
        mapLifecycleError(err);
      }
    }),

  listRuns: governedProcedure
    .meta({
      permission: DATA_LIFECYCLE_READ_PERMISSION,
      dataCategory: DATA_LIFECYCLE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "data.lifecycle.run.list",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      try {
        const soft = await actorHoldsLifecyclePermission(
          ctx.session.accountId,
          DATA_LIFECYCLE_READ_PERMISSION,
        );
        if (!soft) {
          await denyLifecycleOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "data.lifecycle.run.list",
          });
        }
        const runs = await listDisposalRuns(getRetentionPool());
        return { runs };
      } catch (err) {
        mapLifecycleError(err);
      }
    }),
});

/** Test helper — stable correlation without importing crypto at call sites. */
export function newRetentionCorrelationId(): string {
  return randomUUID();
}
