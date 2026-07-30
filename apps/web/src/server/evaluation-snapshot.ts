/**
 * Governed evaluation-snapshot tRPC (Story 7.8 / FR-56).
 * Thin web: orchestration in @divan/audit-envelope.
 * Soft PermissionSet gate after envelope; soft-deny on secondary list.
 * Domain mutations stay on existing routers — do not invent a second finalize API.
 */

import {
  EVALUATION_SNAPSHOT_DATA_CATEGORY,
  EVALUATION_SNAPSHOT_MANAGE_PERMISSION,
  EVALUATION_SNAPSHOT_READ_PERMISSION,
  EvaluationSnapshotError,
  MSG_EVAL_SNAPSHOT_DENIED_FA,
  countEvaluationSnapshotSignals,
  getEvaluationSnapshot,
  listRecentEvaluationSnapshots,
} from "@divan/audit-envelope";
import { getSharedPgPool, type Pool } from "@divan/db";
import { appendAccessEvent } from "@divan/event-store";
import { getPersonDb } from "@divan/person-employment";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { operationalCopy } from "@/lib/operational-copy";

import { createTRPCRouter, governedProcedure } from "./trpc";

const MSG_DB_REQUIRED_FA =
  "پیکربندی پایگاه داده برای اسنپ‌شات ارزیابی موجود نیست.";

let evaluationSnapshotPool: Pool | null = null;

function getEvaluationSnapshotPool(): Pool {
  if (evaluationSnapshotPool) return evaluationSnapshotPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: MSG_DB_REQUIRED_FA,
    });
  }
  evaluationSnapshotPool = getSharedPgPool(url);
  return evaluationSnapshotPool;
}

function mapEvaluationSnapshotError(err: unknown): never {
  if (err instanceof EvaluationSnapshotError) {
    const code =
      err.code === "EVAL_SNAPSHOT_DENIED"
        ? "FORBIDDEN"
        : err.code === "EVAL_SNAPSHOT_NOT_FOUND"
          ? "NOT_FOUND"
          : "BAD_REQUEST";
    throw new TRPCError({
      code,
      message: err.messageFa,
      cause: err,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: operationalCopy.evaluationSnapshotActionFailed,
    cause: err instanceof Error ? err : undefined,
  });
}

async function actorHoldsEvalSnapshotPermission(
  accountId: string,
  permission: string,
): Promise<boolean> {
  const db = getPersonDb();
  const rows = await db.accountAccessRole.findMany({
    where: { accountId },
    include: { accessRole: { include: { permissionSet: true } } },
  });
  for (const row of rows) {
    const raw = row.accessRole.permissionSet?.permissions;
    const perms = Array.isArray(raw) ? raw : [];
    if (perms.includes(permission)) return true;
  }
  return false;
}

async function softSecondaryListAppend(
  pool: Pool,
  opts: {
    actorAccountId: string;
    correlationId: string;
    operation: string;
  },
): Promise<void> {
  try {
    await appendAccessEvent(pool, {
      correlationId: opts.correlationId,
      actorAccountId: opts.actorAccountId,
      operation: opts.operation,
      scope: { channel: "evaluation_snapshot", secondary: true },
      result: "allow",
      reason: "list",
    });
  } catch {
    // Soft-deny secondary — never mask primary allow
  }
}

export const evaluationSnapshotRouter = createTRPCRouter({
  capabilities: governedProcedure
    .meta({
      permission: EVALUATION_SNAPSHOT_READ_PERMISSION,
      dataCategory: EVALUATION_SNAPSHOT_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "evaluation.snapshot.capabilities",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const accountId = ctx.session.accountId;
      try {
        const [canRead, canManage] = await Promise.all([
          actorHoldsEvalSnapshotPermission(
            accountId,
            EVALUATION_SNAPSHOT_READ_PERMISSION,
          ),
          actorHoldsEvalSnapshotPermission(
            accountId,
            EVALUATION_SNAPSHOT_MANAGE_PERMISSION,
          ),
        ]);
        return { canRead, canManage };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: operationalCopy.evaluationSnapshotCapabilitiesError,
        });
      }
    }),

  get: governedProcedure
    .meta({
      permission: EVALUATION_SNAPSHOT_READ_PERMISSION,
      dataCategory: EVALUATION_SNAPSHOT_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "evaluation.snapshot.get",
      sensitive: true,
    })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const holds = await actorHoldsEvalSnapshotPermission(
        ctx.session.accountId,
        EVALUATION_SNAPSHOT_READ_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_EVAL_SNAPSHOT_DENIED_FA,
        });
      }
      try {
        const pool = getEvaluationSnapshotPool();
        const snap = await getEvaluationSnapshot(pool, input.id);
        return {
          id: snap.id,
          kind: snap.kind,
          contentFingerprint: snap.contentFingerprint,
          status: snap.status,
          createdAt: snap.createdAt,
          expiresAt: snap.expiresAt,
          correlationId: snap.correlationId,
          attribution: {
            actorAccountId: snap.attribution.actorAccountId,
            asOf: snap.attribution.asOf,
            permissionFingerprint: snap.attribution.permissionFingerprint,
          },
          // boundRefs may contain member ids — never expose unauthorized PII fields
          boundRefKeys: snap.boundRefs ? Object.keys(snap.boundRefs) : [],
        };
      } catch (err) {
        mapEvaluationSnapshotError(err);
      }
    }),

  listRecent: governedProcedure
    .meta({
      permission: EVALUATION_SNAPSHOT_READ_PERMISSION,
      dataCategory: EVALUATION_SNAPSHOT_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "evaluation.snapshot.list",
      sensitive: true,
    })
    .input(
      z
        .object({
          kind: z.string().min(1).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const holds = await actorHoldsEvalSnapshotPermission(
        ctx.session.accountId,
        EVALUATION_SNAPSHOT_READ_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_EVAL_SNAPSHOT_DENIED_FA,
        });
      }
      try {
        const pool = getEvaluationSnapshotPool();
        const rows = await listRecentEvaluationSnapshots(pool, {
          kind: input?.kind,
          limit: input?.limit ?? 20,
        });
        await softSecondaryListAppend(pool, {
          actorAccountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          operation: "evaluation.snapshot.list",
        });
        return {
          rows: rows.map((s) => ({
            id: s.id,
            kind: s.kind,
            status: s.status,
            contentFingerprint: s.contentFingerprint.slice(0, 12),
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
          })),
        };
      } catch (err) {
        // Secondary list — soft-deny: return empty rather than mask primary
        if (err instanceof EvaluationSnapshotError) {
          mapEvaluationSnapshotError(err);
        }
        return { rows: [], softDenied: true as const };
      }
    }),

  integritySignals: governedProcedure
    .meta({
      permission: EVALUATION_SNAPSHOT_READ_PERMISSION,
      dataCategory: EVALUATION_SNAPSHOT_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "evaluation.snapshot.signals",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const holds = await actorHoldsEvalSnapshotPermission(
        ctx.session.accountId,
        EVALUATION_SNAPSHOT_READ_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_EVAL_SNAPSHOT_DENIED_FA,
        });
      }
      try {
        const pool = getEvaluationSnapshotPool();
        const counts = await countEvaluationSnapshotSignals(pool);
        await softSecondaryListAppend(pool, {
          actorAccountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          operation: "evaluation.snapshot.signals",
        });
        return {
          active: counts.active ?? 0,
          consumed: counts.consumed ?? 0,
          expired: counts.expired ?? 0,
          superseded: counts.superseded ?? 0,
        };
      } catch {
        return {
          active: 0,
          consumed: 0,
          expired: 0,
          superseded: 0,
          softDenied: true as const,
        };
      }
    }),
});
