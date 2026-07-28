/**
 * Governed audit trust tRPC (Story 7.4 / FR-51 / NFR-9).
 * Thin web: domain + repo in audit-envelope; soft PermissionSet gate;
 * soft-deny on secondary allow-path append; SoD self-review on assign/close.
 */

import { randomUUID } from "node:crypto";

import {
  AUDIT_TRUST_DATA_CATEGORY,
  AUDIT_TRUST_READ_PERMISSION,
  AUDIT_TRUST_REVIEW_PERMISSION,
  AuditTrustError,
  MSG_AUDIT_TRUST_DENIED_FA,
  MSG_AUDIT_TRUST_INCIDENT_NOT_FOUND_FA,
  acknowledgeTrustIncident,
  assertAuditTrustSelfReviewAllowed,
  assignTrustIncident,
  clearWriterSuspend,
  closeTrustIncident,
  getTrustIncident,
  getWriterState,
  listTrustIncidents,
  runIntegrityVerification,
} from "@divan/audit-envelope";
import { getSharedPgPool, type Pool } from "@divan/db";
import { appendAccessEvent } from "@divan/event-store";
import { getPersonDb } from "@divan/person-employment";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { operationalCopy } from "@/lib/operational-copy";

import { createTRPCRouter, governedProcedure } from "./trpc";

const MSG_DB_REQUIRED_FA = "پیکربندی پایگاه داده برای اعتماد ممیزی موجود نیست.";

let trustPool: Pool | null = null;

function getTrustPool(): Pool {
  if (trustPool) return trustPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: MSG_DB_REQUIRED_FA,
    });
  }
  trustPool = getSharedPgPool(url);
  return trustPool;
}

function mapTrustError(err: unknown): never {
  if (err instanceof AuditTrustError) {
    const code =
      err.code === "AUDIT_TRUST_DENIED"
        ? "FORBIDDEN"
        : err.code === "AUDIT_TRUST_SELF_REVIEW_BLOCKED" ||
            err.code === "AUDIT_TRUST_INCIDENT_NOT_FOUND" ||
            err.code === "AUDIT_TRUST_METADATA_INCOMPLETE"
          ? "BAD_REQUEST"
          : err.code === "AUDIT_TRUST_SUSPENDED" ||
              err.code === "AUDIT_CLOCK_ANOMALY" ||
              err.code === "AUDIT_INTEGRITY_FAILED" ||
              err.code === "AUDIT_TRUST_CONFIG_MISSING"
            ? "INTERNAL_SERVER_ERROR"
            : "INTERNAL_SERVER_ERROR";
    throw new TRPCError({
      code,
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof TRPCError) throw err;
  if (err instanceof Error && err.message === "AUDIT_TRUST_INCIDENT_NOT_FOUND") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: MSG_AUDIT_TRUST_INCIDENT_NOT_FOUND_FA,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: operationalCopy.auditTrustActionFailed,
  });
}

async function actorHoldsTrustPermission(
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

async function appendTrustAccessEvent(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
  outcome: "allow" | "deny";
  reason: string;
  entityId?: string;
}): Promise<void> {
  const pool = getTrustPool();
  await appendAccessEvent(pool, {
    correlationId: input.correlationId,
    actorAccountId: input.actorAccountId,
    operation: input.operation,
    scope: { channel: "audit_trust" },
    result: input.outcome,
    reason: input.reason,
    entityType: "audit_trust",
    entityId: input.entityId,
    payload: {},
  });
}

async function denyTrustOrThrow(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
}): Promise<never> {
  try {
    await appendTrustAccessEvent({
      ...input,
      outcome: "deny",
      reason: "permission_set_missing",
    });
  } catch {
    // soft — primary deny still thrown
  }
  throw new AuditTrustError("AUDIT_TRUST_DENIED", MSG_AUDIT_TRUST_DENIED_FA);
}

export const auditTrustRouter = createTRPCRouter({
  getState: governedProcedure
    .meta({
      permission: AUDIT_TRUST_READ_PERMISSION,
      dataCategory: AUDIT_TRUST_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "audit.trust.getState",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const correlationId = randomUUID();
      try {
        if (
          !(await actorHoldsTrustPermission(
            ctx.session.accountId,
            AUDIT_TRUST_READ_PERMISSION,
          ))
        ) {
          await denyTrustOrThrow({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.getState",
          });
        }
        const state = await getWriterState(getTrustPool());
        try {
          await appendTrustAccessEvent({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.getState",
            outcome: "allow",
            reason: "audit_trust_read",
          });
        } catch {
          // soft-deny secondary
        }
        return state;
      } catch (err) {
        mapTrustError(err);
      }
    }),

  listIncidents: governedProcedure
    .meta({
      permission: AUDIT_TRUST_READ_PERMISSION,
      dataCategory: AUDIT_TRUST_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "audit.trust.listIncidents",
      sensitive: true,
    })
    .input(
      z
        .object({
          openOnly: z.boolean().optional(),
          limit: z.number().int().min(1).max(200).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const correlationId = randomUUID();
      try {
        if (
          !(await actorHoldsTrustPermission(
            ctx.session.accountId,
            AUDIT_TRUST_READ_PERMISSION,
          ))
        ) {
          await denyTrustOrThrow({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.listIncidents",
          });
        }
        const incidents = await listTrustIncidents(getTrustPool(), {
          statusIn: input?.openOnly
            ? ["open", "assigned", "acknowledged"]
            : undefined,
          limit: input?.limit,
        });
        try {
          await appendTrustAccessEvent({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.listIncidents",
            outcome: "allow",
            reason: "audit_trust_list",
          });
        } catch {
          // soft-deny secondary
        }
        return { incidents, correlationId };
      } catch (err) {
        mapTrustError(err);
      }
    }),

  assignIncident: governedProcedure
    .meta({
      permission: AUDIT_TRUST_REVIEW_PERMISSION,
      dataCategory: AUDIT_TRUST_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "audit.trust.assignIncident",
      sensitive: true,
    })
    .input(
      z.object({
        incidentId: z.string().uuid(),
        assignedTo: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const correlationId = randomUUID();
      try {
        if (
          !(await actorHoldsTrustPermission(
            ctx.session.accountId,
            AUDIT_TRUST_REVIEW_PERMISSION,
          ))
        ) {
          await denyTrustOrThrow({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.assignIncident",
          });
        }
        const existing = await getTrustIncident(
          getTrustPool(),
          input.incidentId,
        );
        if (!existing) {
          throw new AuditTrustError(
            "AUDIT_TRUST_INCIDENT_NOT_FOUND",
            MSG_AUDIT_TRUST_INCIDENT_NOT_FOUND_FA,
          );
        }
        assertAuditTrustSelfReviewAllowed({
          reviewerAccountId: ctx.session.accountId,
          subjectAccountId: existing.subjectAccountId,
          incidentKind: existing.kind,
        });
        const incident = await assignTrustIncident(getTrustPool(), {
          incidentId: input.incidentId,
          assignedTo: input.assignedTo,
        });
        try {
          await appendTrustAccessEvent({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.assignIncident",
            outcome: "allow",
            reason: "audit_trust_assign",
            entityId: incident.id,
          });
        } catch {
          // soft-deny secondary
        }
        return incident;
      } catch (err) {
        mapTrustError(err);
      }
    }),

  acknowledgeIncident: governedProcedure
    .meta({
      permission: AUDIT_TRUST_REVIEW_PERMISSION,
      dataCategory: AUDIT_TRUST_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "audit.trust.acknowledgeIncident",
      sensitive: true,
    })
    .input(z.object({ incidentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const correlationId = randomUUID();
      try {
        if (
          !(await actorHoldsTrustPermission(
            ctx.session.accountId,
            AUDIT_TRUST_REVIEW_PERMISSION,
          ))
        ) {
          await denyTrustOrThrow({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.acknowledgeIncident",
          });
        }
        const existing = await getTrustIncident(
          getTrustPool(),
          input.incidentId,
        );
        if (!existing) {
          throw new AuditTrustError(
            "AUDIT_TRUST_INCIDENT_NOT_FOUND",
            MSG_AUDIT_TRUST_INCIDENT_NOT_FOUND_FA,
          );
        }
        assertAuditTrustSelfReviewAllowed({
          reviewerAccountId: ctx.session.accountId,
          subjectAccountId: existing.subjectAccountId,
          incidentKind: existing.kind,
        });
        const incident = await acknowledgeTrustIncident(getTrustPool(), {
          incidentId: input.incidentId,
        });
        try {
          await appendTrustAccessEvent({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.acknowledgeIncident",
            outcome: "allow",
            reason: "audit_trust_ack",
            entityId: incident.id,
          });
        } catch {
          // soft-deny secondary
        }
        return incident;
      } catch (err) {
        mapTrustError(err);
      }
    }),

  closeIncident: governedProcedure
    .meta({
      permission: AUDIT_TRUST_REVIEW_PERMISSION,
      dataCategory: AUDIT_TRUST_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "audit.trust.closeIncident",
      sensitive: true,
    })
    .input(z.object({ incidentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const correlationId = randomUUID();
      try {
        if (
          !(await actorHoldsTrustPermission(
            ctx.session.accountId,
            AUDIT_TRUST_REVIEW_PERMISSION,
          ))
        ) {
          await denyTrustOrThrow({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.closeIncident",
          });
        }
        const existing = await getTrustIncident(
          getTrustPool(),
          input.incidentId,
        );
        if (!existing) {
          throw new AuditTrustError(
            "AUDIT_TRUST_INCIDENT_NOT_FOUND",
            MSG_AUDIT_TRUST_INCIDENT_NOT_FOUND_FA,
          );
        }
        assertAuditTrustSelfReviewAllowed({
          reviewerAccountId: ctx.session.accountId,
          subjectAccountId: existing.subjectAccountId,
          incidentKind: existing.kind,
        });
        const incident = await closeTrustIncident(getTrustPool(), {
          incidentId: input.incidentId,
          closedBy: ctx.session.accountId,
        });
        try {
          await appendTrustAccessEvent({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.closeIncident",
            outcome: "allow",
            reason: "audit_trust_close",
            entityId: incident.id,
          });
        } catch {
          // soft-deny secondary
        }
        return incident;
      } catch (err) {
        mapTrustError(err);
      }
    }),

  runIntegrityCheck: governedProcedure
    .meta({
      permission: AUDIT_TRUST_REVIEW_PERMISSION,
      dataCategory: AUDIT_TRUST_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "audit.trust.runIntegrityCheck",
      sensitive: true,
    })
    .mutation(async ({ ctx }) => {
      const correlationId = randomUUID();
      try {
        if (
          !(await actorHoldsTrustPermission(
            ctx.session.accountId,
            AUDIT_TRUST_REVIEW_PERMISSION,
          ))
        ) {
          await denyTrustOrThrow({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.runIntegrityCheck",
          });
        }
        const result = await runIntegrityVerification(getTrustPool(), {
          actorAccountId: ctx.session.accountId,
          correlationId,
          throwOnFail: false,
        });
        try {
          await appendTrustAccessEvent({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.runIntegrityCheck",
            outcome: "allow",
            reason: "audit_trust_integrity",
            entityId: result.runId,
          });
        } catch {
          // soft-deny secondary
        }
        return result;
      } catch (err) {
        mapTrustError(err);
      }
    }),

  clearSuspend: governedProcedure
    .meta({
      permission: AUDIT_TRUST_REVIEW_PERMISSION,
      dataCategory: AUDIT_TRUST_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "audit.trust.clearSuspend",
      sensitive: true,
    })
    .mutation(async ({ ctx }) => {
      const correlationId = randomUUID();
      try {
        if (
          !(await actorHoldsTrustPermission(
            ctx.session.accountId,
            AUDIT_TRUST_REVIEW_PERMISSION,
          ))
        ) {
          await denyTrustOrThrow({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.clearSuspend",
          });
        }
        const state = await clearWriterSuspend(getTrustPool(), {
          clearedBy: ctx.session.accountId,
          correlationId,
        });
        try {
          await appendTrustAccessEvent({
            correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.trust.clearSuspend",
            outcome: "allow",
            reason: "audit_trust_clear_suspend",
          });
        } catch {
          // soft-deny secondary
        }
        return state;
      } catch (err) {
        mapTrustError(err);
      }
    }),

  capabilities: governedProcedure
    .meta({
      permission: AUDIT_TRUST_READ_PERMISSION,
      dataCategory: AUDIT_TRUST_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "audit.trust.capabilities",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const [canRead, canReview] = await Promise.all([
        actorHoldsTrustPermission(
          ctx.session.accountId,
          AUDIT_TRUST_READ_PERMISSION,
        ),
        actorHoldsTrustPermission(
          ctx.session.accountId,
          AUDIT_TRUST_REVIEW_PERMISSION,
        ),
      ]);
      return { canRead, canReview };
    }),
});
