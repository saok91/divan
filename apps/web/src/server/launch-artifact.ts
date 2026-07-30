/**
 * Governed Launch Artifact Register tRPC (Story 7.7 / FR-55).
 * Thin web: orchestration in @divan/audit-envelope.
 * Soft PermissionSet gate after envelope; soft-deny on secondary list append fail.
 * Map domain errors via messageFa / operational-copy only.
 */

import { randomUUID } from "node:crypto";

import {
  LAUNCH_ARTIFACT_APPROVE_PERMISSION,
  LAUNCH_ARTIFACT_DATA_CATEGORY,
  LAUNCH_ARTIFACT_IDS,
  LAUNCH_ARTIFACT_MANAGE_PERMISSION,
  LAUNCH_ARTIFACT_READ_PERMISSION,
  LAUNCH_ARTIFACT_REBASELINE_PERMISSION,
  LAUNCH_ARTIFACT_WAIVER_PERMISSION,
  LaunchArtifactError,
  MSG_LAUNCH_ARTIFACT_DENIED_FA,
  approveRebaseline,
  approveVersion,
  closeWaiver,
  createVersion,
  issueWaiver,
  listArtifacts,
  listConflicts,
  listOpenWaivers,
  listRebaselines,
  listVersions,
  openConflict,
  requireRebaseline,
  resolveConflict,
  resolveControllingVersion,
  seedLaunchArtifactRegister,
  countChangeControlSignals,
} from "@divan/audit-envelope";
import { getSharedPgPool, type Pool } from "@divan/db";
import { appendAccessEvent } from "@divan/event-store";
import { getPersonDb } from "@divan/person-employment";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { operationalCopy } from "@/lib/operational-copy";

import { createTRPCRouter, governedProcedure } from "./trpc";

const MSG_DB_REQUIRED_FA =
  "پیکربندی پایگاه داده برای ثبت آرتیفکت پرتاب موجود نیست.";

let launchArtifactPool: Pool | null = null;

function getLaunchArtifactPool(): Pool {
  if (launchArtifactPool) return launchArtifactPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: MSG_DB_REQUIRED_FA,
    });
  }
  launchArtifactPool = getSharedPgPool(url);
  return launchArtifactPool;
}

function mapLaunchArtifactError(err: unknown): never {
  if (err instanceof LaunchArtifactError) {
    const code =
      err.code === "LAUNCH_ARTIFACT_DENIED"
        ? "FORBIDDEN"
        : err.code === "LAUNCH_ARTIFACT_NOT_FOUND"
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
    message: operationalCopy.launchArtifactActionFailed,
    cause: err instanceof Error ? err : undefined,
  });
}

async function actorHoldsLaunchPermission(
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
      scope: { channel: "launch_artifact", secondary: true },
      result: "allow",
      reason: "list",
    });
  } catch {
    // Soft-deny secondary — never mask primary allow
  }
}

const artifactIdSchema = z.enum(
  LAUNCH_ARTIFACT_IDS as unknown as [string, ...string[]],
);

export const launchArtifactRouter = createTRPCRouter({
  capabilities: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_READ_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.capabilities",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const accountId = ctx.session.accountId;
      try {
        const [canRead, canManage, canApprove, canWaiver, canRebaseline] =
          await Promise.all([
            actorHoldsLaunchPermission(accountId, LAUNCH_ARTIFACT_READ_PERMISSION),
            actorHoldsLaunchPermission(
              accountId,
              LAUNCH_ARTIFACT_MANAGE_PERMISSION,
            ),
            actorHoldsLaunchPermission(
              accountId,
              LAUNCH_ARTIFACT_APPROVE_PERMISSION,
            ),
            actorHoldsLaunchPermission(
              accountId,
              LAUNCH_ARTIFACT_WAIVER_PERMISSION,
            ),
            actorHoldsLaunchPermission(
              accountId,
              LAUNCH_ARTIFACT_REBASELINE_PERMISSION,
            ),
          ]);
        return {
          canRead,
          canManage,
          canApprove,
          canWaiver,
          canRebaseline,
        };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: operationalCopy.launchArtifactCapabilitiesError,
        });
      }
    }),

  listArtifacts: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_READ_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.list",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_READ_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        const pool = getLaunchArtifactPool();
        await seedLaunchArtifactRegister(pool);
        const artifacts = await listArtifacts(pool);
        const signals = await countChangeControlSignals(pool);
        await softSecondaryListAppend(pool, {
          actorAccountId: ctx.session.accountId,
          correlationId: randomUUID(),
          operation: "launch.artifact.list",
        });
        if (artifacts.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: operationalCopy.launchArtifactEmptyInfraError,
          });
        }
        return { artifacts, signals };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        mapLaunchArtifactError(err);
      }
    }),

  listVersions: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_READ_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.list_versions",
      sensitive: true,
    })
    .input(z.object({ artifactId: artifactIdSchema }))
    .query(async ({ ctx, input }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_READ_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        const pool = getLaunchArtifactPool();
        return await listVersions(pool, input.artifactId);
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  getControlling: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_READ_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.get_controlling",
      sensitive: true,
    })
    .input(z.object({ artifactId: artifactIdSchema }))
    .query(async ({ ctx, input }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_READ_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        const pool = getLaunchArtifactPool();
        await seedLaunchArtifactRegister(pool);
        return await resolveControllingVersion(pool, input.artifactId);
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  createVersion: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_MANAGE_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.version.create",
      sensitive: true,
    })
    .input(
      z.object({
        artifactId: artifactIdSchema,
        versionLabel: z.string().min(1).max(200),
        scopeSummary: z.string().min(1).max(2000),
        contentRef: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_MANAGE_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        return await createVersion(getLaunchArtifactPool(), {
          ...input,
          actorAccountId: ctx.session.accountId,
        });
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  approveVersion: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_APPROVE_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.version.approve",
      sensitive: true,
    })
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_APPROVE_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        return await approveVersion(getLaunchArtifactPool(), {
          versionId: input.versionId,
          actorAccountId: ctx.session.accountId,
        });
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  issueWaiver: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_WAIVER_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.waiver.issue",
      sensitive: true,
    })
    .input(
      z.object({
        artifactId: artifactIdSchema,
        targetGateCode: z.string().max(100).optional(),
        ownerAccountId: z.string().min(1),
        independentApproverAccountId: z.string().min(1),
        scope: z.string().min(1),
        risk: z.string().min(1),
        compensatingControls: z.string().min(1),
        expiry: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_WAIVER_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        return await issueWaiver(getLaunchArtifactPool(), {
          artifactId: input.artifactId,
          targetGateCode: input.targetGateCode,
          waiver: {
            ownerAccountId: input.ownerAccountId,
            independentApproverAccountId: input.independentApproverAccountId,
            requesterAccountId: ctx.session.accountId,
            scope: input.scope,
            risk: input.risk,
            compensatingControls: input.compensatingControls,
            expiry: input.expiry,
          },
        });
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  closeWaiver: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_WAIVER_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.waiver.close",
      sensitive: true,
    })
    .input(
      z.object({
        waiverId: z.string().uuid(),
        closureEvidence: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_WAIVER_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        return await closeWaiver(getLaunchArtifactPool(), {
          ...input,
          actorAccountId: ctx.session.accountId,
        });
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  listConflicts: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_READ_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.list_conflicts",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_READ_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        return await listConflicts(getLaunchArtifactPool());
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  openConflict: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_MANAGE_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.conflict.open",
      sensitive: true,
    })
    .input(
      z.object({
        artifactIds: z.array(artifactIdSchema).min(2),
        summary: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_MANAGE_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        return await openConflict(getLaunchArtifactPool(), {
          ...input,
          actorAccountId: ctx.session.accountId,
        });
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  resolveConflict: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_APPROVE_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.conflict.resolve",
      sensitive: true,
    })
    .input(
      z.object({
        conflictId: z.string().uuid(),
        resolutionVersionIds: z.array(z.string().uuid()).min(1),
        jointApproverAccountId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_APPROVE_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        return await resolveConflict(getLaunchArtifactPool(), {
          ...input,
          actorAccountId: ctx.session.accountId,
        });
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  listRebaselines: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_READ_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.list_rebaselines",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_READ_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        return await listRebaselines(getLaunchArtifactPool());
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  listOpenWaivers: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_READ_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.list_waivers",
      sensitive: true,
    })
    .input(z.object({ artifactId: artifactIdSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_READ_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        return await listOpenWaivers(
          getLaunchArtifactPool(),
          input?.artifactId,
        );
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  requireRebaseline: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_REBASELINE_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.rebaseline.require",
      sensitive: true,
    })
    .input(
      z.object({
        affectedArtifactIds: z.array(artifactIdSchema).min(1),
        changeSummary: z.string().min(1),
        impactAssessment: z.string().min(1),
        requiredRegressionRefs: z.array(z.string()).default([]),
        buildRef: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_REBASELINE_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        return await requireRebaseline(getLaunchArtifactPool(), {
          ...input,
          requesterAccountId: ctx.session.accountId,
        });
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),

  approveRebaseline: governedProcedure
    .meta({
      permission: LAUNCH_ARTIFACT_REBASELINE_PERMISSION,
      dataCategory: LAUNCH_ARTIFACT_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "launch.artifact.rebaseline.approve",
      sensitive: true,
    })
    .input(
      z.object({
        rebaselineId: z.string().uuid(),
        independentApproverAccountId: z.string().min(1),
        buildRef: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const holds = await actorHoldsLaunchPermission(
        ctx.session.accountId,
        LAUNCH_ARTIFACT_REBASELINE_PERMISSION,
      );
      if (!holds) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_LAUNCH_ARTIFACT_DENIED_FA,
        });
      }
      try {
        return await approveRebaseline(getLaunchArtifactPool(), {
          ...input,
          actorAccountId: ctx.session.accountId,
        });
      } catch (err) {
        mapLaunchArtifactError(err);
      }
    }),
});
