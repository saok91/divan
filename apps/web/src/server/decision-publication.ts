/**
 * Governed decision-publication tRPC (Story 7.6 / FR-54).
 * Thin web: orchestration in @divan/reporting.
 * Soft PermissionSet gate after envelope; soft-deny on secondary list append fail.
 * Map domain errors via messageFa / operational-copy only.
 */

import { randomUUID } from "node:crypto";

import { getSharedPgPool, type Pool } from "@divan/db";
import { appendAccessEvent } from "@divan/event-store";
import { currentAsOfDate } from "@divan/identity-access";
import {
  PERSON_DATA_CATEGORY,
  getPersonDb,
  getPlatformRecalcSignal,
} from "@divan/person-employment";
import {
  DecisionPublicationError,
  MSG_PUBLICATION_DENIED_FA,
  MSG_PUBLICATION_IMMUTABLE_REWRITE_FA,
  MSG_PUBLICATION_METADATA_INCOMPLETE_FA,
  MSG_PUBLICATION_SNAPSHOT_MISMATCH_FA,
  PROVISIONAL_METRIC_VERSION,
  PROVISIONAL_REPORT_VERSION,
  REPORT_PUBLICATION_DATA_CATEGORY,
  REPORT_PUBLICATION_MANAGE_PERMISSION,
  REPORT_PUBLICATION_PUBLISH_PERMISSION,
  REPORT_PUBLICATION_READ_PERMISSION,
  REPORT_PUBLICATION_SUPERSEDE_PERMISSION,
  createPublicationNotice,
  getDecisionPublication,
  listDecisionPublicationDtos,
  listNoticesForPublication,
  markNonReproducibleAfterDisposal,
  publishDecisionReport,
} from "@divan/reporting";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { operationalCopy } from "@/lib/operational-copy";

import { computeReportExportSnapshotHash } from "./export-capability";
import {
  applyDevUuidInferenceBulkGuard,
  resolvePersonnelPopulationRegistry,
} from "./personnel-scoped-search";
import { runGovernedRetrieval } from "./retrieval-control";
import { createTRPCRouter, governedProcedure } from "./trpc";

const MSG_DB_REQUIRED_FA =
  "پیکربندی پایگاه داده برای انتشار گزارش تصمیم موجود نیست.";

let publicationPool: Pool | null = null;

function getPublicationPool(): Pool {
  if (publicationPool) return publicationPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: MSG_DB_REQUIRED_FA,
    });
  }
  publicationPool = getSharedPgPool(url);
  return publicationPool;
}

function mapPublicationError(err: unknown): never {
  if (err instanceof DecisionPublicationError) {
    const code =
      err.code === "PUBLICATION_DENIED"
        ? "FORBIDDEN"
        : err.code === "PUBLICATION_NOT_FOUND"
          ? "NOT_FOUND"
          : err.code === "PUBLICATION_STALE_BLOCKED" ||
              err.code === "PUBLICATION_SNAPSHOT_MISMATCH" ||
              err.code === "PUBLICATION_IMMUTABLE_REWRITE" ||
              err.code === "PUBLICATION_REPRODUCIBILITY_FORBIDDEN" ||
              err.code === "PUBLICATION_PACKAGE_NOT_ALLOWED" ||
              err.code === "PUBLICATION_ALREADY_NON_REPRODUCIBLE" ||
              err.code === "PUBLICATION_METADATA_INCOMPLETE"
            ? "BAD_REQUEST"
            : "INTERNAL_SERVER_ERROR";
    throw new TRPCError({
      code,
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof TRPCError) throw err;
  const msg = err instanceof Error ? err.message : String(err);
  if (/PUBLICATION_IMMUTABLE_REWRITE/i.test(msg)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: MSG_PUBLICATION_IMMUTABLE_REWRITE_FA,
      cause: err,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: operationalCopy.publicationActionFailed,
  });
}

async function actorHoldsPublicationPermission(
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

async function appendPublicationAccessEvent(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
  outcome: "allow" | "deny";
  reason: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  const pool = getPublicationPool();
  await appendAccessEvent(pool, {
    correlationId: input.correlationId,
    actorAccountId: input.actorAccountId,
    operation: input.operation,
    scope: { channel: "report_publication" },
    result: input.outcome,
    reason: input.reason,
    entityType: input.entityType ?? "decision_publication",
    entityId: input.entityId,
    payload: {},
  });
}

async function denyPublicationOrThrow(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
}): Promise<never> {
  try {
    await appendPublicationAccessEvent({
      ...input,
      outcome: "deny",
      reason: "permission_set_missing",
    });
  } catch {
    // Prefer client-visible deny over append failure masking.
  }
  throw new DecisionPublicationError(
    "PUBLICATION_DENIED",
    MSG_PUBLICATION_DENIED_FA,
  );
}

const noticeKindSchema = z.enum([
  "correction",
  "metric_policy_change",
  "disposal",
  "supersession",
]);

export const decisionPublicationRouter = createTRPCRouter({
  capabilities: governedProcedure
    .meta({
      permission: REPORT_PUBLICATION_READ_PERMISSION,
      dataCategory: REPORT_PUBLICATION_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "report.publication.capabilities",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      try {
        const accountId = ctx.session.accountId;
        const [read, publish, supersede, manage] = await Promise.all([
          actorHoldsPublicationPermission(
            accountId,
            REPORT_PUBLICATION_READ_PERMISSION,
          ),
          actorHoldsPublicationPermission(
            accountId,
            REPORT_PUBLICATION_PUBLISH_PERMISSION,
          ),
          actorHoldsPublicationPermission(
            accountId,
            REPORT_PUBLICATION_SUPERSEDE_PERMISSION,
          ),
          actorHoldsPublicationPermission(
            accountId,
            REPORT_PUBLICATION_MANAGE_PERMISSION,
          ),
        ]);
        return { read, publish, supersede, manage };
      } catch {
        // Soft-fail capabilities — never silently hide all actions as "allowed"
        return {
          read: false,
          publish: false,
          supersede: false,
          manage: false,
          capabilitiesError: operationalCopy.publicationCapabilitiesError,
        };
      }
    }),

  list: governedProcedure
    .meta({
      permission: REPORT_PUBLICATION_READ_PERMISSION,
      dataCategory: REPORT_PUBLICATION_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "report.publication.list",
      sensitive: true,
    })
    .input(
      z
        .object({
          reportKey: z.string().min(1).max(100).optional(),
          limit: z.number().int().min(1).max(200).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsPublicationPermission(
          ctx.session.accountId,
          REPORT_PUBLICATION_READ_PERMISSION,
        );
        if (!soft) {
          await denyPublicationOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "report.publication.list",
          });
        }
        const items = await listDecisionPublicationDtos(getPublicationPool(), {
          reportKey: input?.reportKey,
          limit: input?.limit,
        });
        try {
          await appendPublicationAccessEvent({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "report.publication.list",
            outcome: "allow",
            reason: "listed",
          });
        } catch {
          /* soft-deny secondary */
        }
        return { items };
      } catch (err) {
        mapPublicationError(err);
      }
    }),

  get: governedProcedure
    .meta({
      permission: REPORT_PUBLICATION_READ_PERMISSION,
      dataCategory: REPORT_PUBLICATION_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "report.publication.get",
      sensitive: true,
    })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsPublicationPermission(
          ctx.session.accountId,
          REPORT_PUBLICATION_READ_PERMISSION,
        );
        if (!soft) {
          await denyPublicationOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "report.publication.get",
          });
        }
        const publication = await getDecisionPublication(
          getPublicationPool(),
          input.id,
        );
        try {
          await appendPublicationAccessEvent({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "report.publication.get",
            outcome: "allow",
            reason: "retrieved",
            entityId: input.id,
          });
        } catch {
          /* soft-deny secondary */
        }
        return { publication };
      } catch (err) {
        mapPublicationError(err);
      }
    }),

  listNotices: governedProcedure
    .meta({
      permission: REPORT_PUBLICATION_READ_PERMISSION,
      dataCategory: REPORT_PUBLICATION_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "report.publication.list_notices",
      sensitive: true,
    })
    .input(z.object({ publicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsPublicationPermission(
          ctx.session.accountId,
          REPORT_PUBLICATION_READ_PERMISSION,
        );
        if (!soft) {
          await denyPublicationOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "report.publication.list_notices",
          });
        }
        const notices = await listNoticesForPublication(
          getPublicationPool(),
          input.publicationId,
        );
        return { notices };
      } catch (err) {
        mapPublicationError(err);
      }
    }),

  publish: governedProcedure
    .meta({
      permission: REPORT_PUBLICATION_PUBLISH_PERMISSION,
      dataCategory: REPORT_PUBLICATION_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "report.publication.publish",
      sensitive: true,
    })
    .input(
      z.object({
        reportKey: z.string().min(1).max(100),
        evaluationMode: z.enum(["current", "as_of"]),
        asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        teamId: z.string().max(100).optional().nullable(),
        rangeStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        rangeEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        reviewedSnapshotHash: z.string().min(16).max(128),
        fieldIds: z.array(z.string().min(1).max(100)).min(1).max(200),
        sourceExportArtifactId: z.string().uuid().optional().nullable(),
        permittedAudience: z
          .array(z.string().min(1).max(120))
          .min(1)
          .max(50)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsPublicationPermission(
          ctx.session.accountId,
          REPORT_PUBLICATION_PUBLISH_PERMISSION,
        );
        if (!soft) {
          await denyPublicationOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "report.publication.publish",
          });
        }

        let blockingStale = false;
        try {
          const signal = await getPlatformRecalcSignal(getPublicationPool());
          blockingStale =
            signal.blockingStale || signal.recalculationPending;
        } catch {
          // Fail-closed on platform signal errors (7.2 spirit).
          blockingStale = true;
        }

        // Reviewed-run asOf from report.run filter (Tehran date) — required for hash bind.
        const boundAsOf = input.asOfDate?.trim();
        if (!boundAsOf) {
          throw new DecisionPublicationError(
            "PUBLICATION_METADATA_INCOMPLETE",
            MSG_PUBLICATION_METADATA_INCOMPLETE_FA,
            { field: "asOfDate" },
          );
        }

        // PopulationPort ∩ InferenceBulk (channel report) — same gate spirit as report.run.
        const populationAsOf =
          input.evaluationMode === "as_of" ? boundAsOf : currentAsOfDate();
        const { registry, mode } = await resolvePersonnelPopulationRegistry();
        const guarded = applyDevUuidInferenceBulkGuard(registry, mode);
        const retrieval = await runGovernedRetrieval({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          channel: "report",
          asOfDate: populationAsOf,
          dataCategory: PERSON_DATA_CATEGORY,
          correlationId: ctx.correlationId,
          purpose: `report.publication.publish:${input.reportKey}`,
          organizationalScope:
            ctx.session.organizationalScopeCodes[0] ?? "org:selfcheck",
          populationRegistry: guarded.registry,
          demoBulkApproval: guarded.demoBulkApproval,
        });
        const outcome = retrieval.payload.outcome;
        if (
          outcome !== "allowed" &&
          outcome !== "empty" &&
          outcome !== "suppressed"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              ("messageFa" in retrieval.payload
                ? retrieval.payload.messageFa
                : undefined) ?? operationalCopy.accessDeniedTitle,
          });
        }

        const filters = {
          reportKey: input.reportKey,
          teamId: input.teamId ?? null,
          asOf: boundAsOf,
          rangeStart: input.rangeStart ?? null,
          rangeEnd: input.rangeEnd ?? null,
          evaluationMode: input.evaluationMode,
        };

        // Bind with the same canonical helper as report.run / export (reuse hash spirit).
        const expectedHash = computeReportExportSnapshotHash({
          reportKey: input.reportKey,
          teamId: input.teamId,
          asOf: boundAsOf,
          rangeStart: input.rangeStart,
          rangeEnd: input.rangeEnd,
          evaluationMode: input.evaluationMode,
          fieldIds: input.fieldIds,
        });
        if (expectedHash !== input.reviewedSnapshotHash) {
          throw new DecisionPublicationError(
            "PUBLICATION_SNAPSHOT_MISMATCH",
            MSG_PUBLICATION_SNAPSHOT_MISMATCH_FA,
            { expected: expectedHash, reviewed: input.reviewedSnapshotHash },
          );
        }

        const publication = await publishDecisionReport(getPublicationPool(), {
          reportKey: input.reportKey,
          filters: filters as never,
          evaluationMode: input.evaluationMode,
          asOfDate: input.evaluationMode === "as_of" ? boundAsOf : null,
          stableSnapshot: {
            sourceSurface: "report",
            sourceKey: input.reportKey,
            filters: filters as never,
            fieldIds: input.fieldIds,
            asOf: boundAsOf,
          },
          reviewedSnapshotHash: input.reviewedSnapshotHash,
          publisherAccountId: ctx.session.accountId,
          permittedAudience: input.permittedAudience ?? [
            REPORT_PUBLICATION_READ_PERMISSION,
            "org:selfcheck",
          ],
          reportVersion: PROVISIONAL_REPORT_VERSION,
          metricVersion: PROVISIONAL_METRIC_VERSION,
          sourceExportArtifactId: input.sourceExportArtifactId ?? null,
          correlationId: ctx.correlationId ?? randomUUID(),
          blockingStale,
          holdsPublishPermission: true,
        });
        return { publication };
      } catch (err) {
        mapPublicationError(err);
      }
    }),

  createNotice: governedProcedure
    .meta({
      permission: REPORT_PUBLICATION_SUPERSEDE_PERMISSION,
      dataCategory: REPORT_PUBLICATION_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "report.publication.supersede",
      sensitive: true,
    })
    .input(
      z.object({
        publicationId: z.string().uuid(),
        noticeKind: noticeKindSchema,
        triggerRefType: z.string().min(1).max(100),
        triggerRefId: z.string().min(1).max(200),
        note: z.string().max(1000).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsPublicationPermission(
          ctx.session.accountId,
          REPORT_PUBLICATION_SUPERSEDE_PERMISSION,
        );
        if (!soft) {
          await denyPublicationOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "report.publication.supersede",
          });
        }
        const result = await createPublicationNotice(getPublicationPool(), {
          publicationId: input.publicationId,
          noticeKind: input.noticeKind,
          triggerRefType: input.triggerRefType,
          triggerRefId: input.triggerRefId,
          note: input.note,
          actorAccountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          holdsSupersedePermission: true,
        });
        return result;
      } catch (err) {
        mapPublicationError(err);
      }
    }),

  markNonReproducible: governedProcedure
    .meta({
      permission: REPORT_PUBLICATION_MANAGE_PERMISSION,
      dataCategory: REPORT_PUBLICATION_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "report.publication.manage",
      sensitive: true,
    })
    .input(
      z.object({
        publicationId: z.string().uuid(),
        disposalRunId: z.string().min(1).max(200),
        force: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsPublicationPermission(
          ctx.session.accountId,
          REPORT_PUBLICATION_MANAGE_PERMISSION,
        );
        if (!soft) {
          await denyPublicationOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "report.publication.manage",
          });
        }
        const publication = await markNonReproducibleAfterDisposal(
          getPublicationPool(),
          {
            publicationId: input.publicationId,
            disposalRunId: input.disposalRunId,
            actorAccountId: ctx.session.accountId,
            correlationId: ctx.correlationId,
            holdsManagePermission: true,
            force: input.force === true,
          },
        );
        return { publication };
      } catch (err) {
        mapPublicationError(err);
      }
    }),
});
