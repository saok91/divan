/**
 * Governed correction-case tRPC (Story 7.5 / FR-53).
 * Thin web: orchestration in person-employment; domain in audit-envelope.
 * Soft PermissionSet gate after envelope; soft-deny on allow-path append fail.
 * Map domain errors via messageFa / operational-copy only.
 */

import {
  CORRECTION_CASE_CLOSE_PERMISSION,
  CORRECTION_CASE_DATA_CATEGORY,
  CORRECTION_CASE_DECIDE_PERMISSION,
  CORRECTION_CASE_READ_PERMISSION,
  CORRECTION_CASE_WRITE_PERMISSION,
  CorrectionCaseError,
  MSG_CORRECTION_CASE_DENIED_FA,
  loadCorrectionCaseAttachmentPolicy,
} from "@divan/audit-envelope";
import { getSharedPgPool, type Pool } from "@divan/db";
import { appendAccessEvent } from "@divan/event-store";
import {
  addCorrectionCaseEvidenceRef,
  closeCorrectionCase,
  decideCorrectionCase,
  escalateOverdueCases,
  getCorrectionCaseAttachmentDownload,
  getCorrectionCaseDetail,
  getPersonDb,
  linkCorrectionCaseOutcome,
  listCorrectionCaseSummaries,
  openCorrectionCase,
  updateCorrectionCaseProgress,
  uploadCorrectionCaseAttachment,
} from "@divan/person-employment";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { operationalCopy } from "@/lib/operational-copy";

import { createTRPCRouter, governedProcedure } from "./trpc";

const MSG_DB_REQUIRED_FA =
  "پیکربندی پایگاه داده برای پرونده اصلاح موجود نیست.";

let correctionCasePool: Pool | null = null;

function getCorrectionCasePool(): Pool {
  if (correctionCasePool) return correctionCasePool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: MSG_DB_REQUIRED_FA,
    });
  }
  correctionCasePool = getSharedPgPool(url);
  return correctionCasePool;
}

function mapCorrectionCaseError(err: unknown): never {
  if (err instanceof CorrectionCaseError) {
    const code =
      err.code === "CORRECTION_CASE_DENIED"
        ? "FORBIDDEN"
        : err.code === "CORRECTION_CASE_NOT_FOUND" ||
            err.code === "CORRECTION_CASE_INVALID_TRANSITION" ||
            err.code === "CORRECTION_CASE_DEADLINE_REQUIRED" ||
            err.code === "CORRECTION_CASE_ATTACHMENT_REJECTED" ||
            err.code === "CORRECTION_CASE_ATTACHMENT_QUARANTINED" ||
            err.code === "CORRECTION_CASE_SELF_REVIEW_BLOCKED" ||
            err.code === "CORRECTION_CASE_OUTCOME_TARGET_INVALID" ||
            err.code === "CORRECTION_CASE_ATTACHMENT_NOT_FOUND" ||
            err.code === "CORRECTION_CASE_ATTACHMENT_NOT_DOWNLOADABLE"
          ? "BAD_REQUEST"
          : err.code === "CORRECTION_CASE_ALLOWLIST_UNSET"
            ? "INTERNAL_SERVER_ERROR"
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
    message: operationalCopy.correctionCaseActionFailed,
  });
}

async function actorHoldsCorrectionCasePermission(
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

async function appendCorrectionCaseAccessEvent(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
  outcome: "allow" | "deny";
  reason: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  const pool = getCorrectionCasePool();
  await appendAccessEvent(pool, {
    correlationId: input.correlationId,
    actorAccountId: input.actorAccountId,
    operation: input.operation,
    scope: { channel: "correction_case" },
    result: input.outcome,
    reason: input.reason,
    entityType: input.entityType ?? "correction_case",
    entityId: input.entityId,
    payload: {},
  });
}

async function denyCorrectionCaseOrThrow(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
}): Promise<never> {
  try {
    await appendCorrectionCaseAccessEvent({
      ...input,
      outcome: "deny",
      reason: "permission_set_missing",
    });
  } catch {
    // Prefer client-visible deny over append failure masking.
  }
  throw new CorrectionCaseError(
    "CORRECTION_CASE_DENIED",
    MSG_CORRECTION_CASE_DENIED_FA,
  );
}

const statusSchema = z.enum([
  "open",
  "in_progress",
  "pending_decision",
  "approved",
  "rejected",
  "constrained",
  "closed",
  "breached",
]);

const evidenceKindSchema = z.enum([
  "request",
  "response",
  "internal",
  "other",
]);

const outcomeLinkSchema = z.enum([
  "personnel_correction",
  "disposal_run",
  "hold",
  "recalc",
  "published_artifact",
  "decision_publication",
  "response_evidence",
  "pending_publication_hook",
]);

export const correctionCaseRouter = createTRPCRouter({
  capabilities: governedProcedure
    .meta({
      permission: CORRECTION_CASE_READ_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.capabilities",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      try {
        const accountId = ctx.session.accountId;
        const [read, write, decide, close] = await Promise.all([
          actorHoldsCorrectionCasePermission(
            accountId,
            CORRECTION_CASE_READ_PERMISSION,
          ),
          actorHoldsCorrectionCasePermission(
            accountId,
            CORRECTION_CASE_WRITE_PERMISSION,
          ),
          actorHoldsCorrectionCasePermission(
            accountId,
            CORRECTION_CASE_DECIDE_PERMISSION,
          ),
          actorHoldsCorrectionCasePermission(
            accountId,
            CORRECTION_CASE_CLOSE_PERMISSION,
          ),
        ]);
        if (!read) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: accountId,
            operation: "correction.case.capabilities",
          });
        }
        try {
          await appendCorrectionCaseAccessEvent({
            correlationId: ctx.correlationId,
            actorAccountId: accountId,
            operation: "correction.case.capabilities",
            outcome: "allow",
            reason: "capabilities",
          });
        } catch {
          /* soft-deny secondary */
        }
        return { read, write, decide, close };
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  list: governedProcedure
    .meta({
      permission: CORRECTION_CASE_READ_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.list",
      sensitive: true,
    })
    .input(
      z
        .object({
          status: statusSchema.optional(),
          breachedOnly: z.boolean().optional(),
          personId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(200).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_READ_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.list",
          });
        }
        const cases = await listCorrectionCaseSummaries(
          getCorrectionCasePool(),
          {
            actorAccountId: ctx.session.accountId,
            status: input?.status,
            breachedOnly: input?.breachedOnly,
            personId: input?.personId,
            limit: input?.limit,
          },
        );
        try {
          await appendCorrectionCaseAccessEvent({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.list",
            outcome: "allow",
            reason: "list_cases",
          });
        } catch {
          /* soft-deny posture: never mask primary allow after envelope */
        }
        return { cases };
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  get: governedProcedure
    .meta({
      permission: CORRECTION_CASE_READ_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.get",
      sensitive: true,
    })
    .input(z.object({ caseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_READ_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.get",
          });
        }
        const detail = await getCorrectionCaseDetail(
          getCorrectionCasePool(),
          input.caseId,
          { actorAccountId: ctx.session.accountId },
        );
        try {
          await appendCorrectionCaseAccessEvent({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.get",
            outcome: "allow",
            reason: "get_case",
            entityId: input.caseId,
          });
        } catch {
          /* soft-deny secondary */
        }
        return detail;
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  open: governedProcedure
    .meta({
      permission: CORRECTION_CASE_WRITE_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.open",
      sensitive: true,
    })
    .input(
      z.object({
        requestReference: z.string().min(1).max(200),
        authorityVerifiedBy: z.string().min(1).max(200),
        personId: z.string().uuid(),
        ownerAccountId: z.string().min(1).max(200).optional(),
        deadlineAt: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_WRITE_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.open",
          });
        }
        const opened = await openCorrectionCase(getCorrectionCasePool(), {
          requestReference: input.requestReference,
          authorityVerifiedBy: input.authorityVerifiedBy,
          personId: input.personId,
          ownerAccountId: input.ownerAccountId ?? ctx.session.accountId,
          deadlineAt: input.deadlineAt,
          actorAccountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
        return { case: opened };
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  update: governedProcedure
    .meta({
      permission: CORRECTION_CASE_WRITE_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.update",
      sensitive: true,
    })
    .input(
      z.object({
        caseId: z.string().uuid(),
        toStatus: z.enum(["in_progress", "pending_decision"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_WRITE_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.update",
          });
        }
        const updated = await updateCorrectionCaseProgress(
          getCorrectionCasePool(),
          {
            caseId: input.caseId,
            toStatus: input.toStatus,
            actorAccountId: ctx.session.accountId,
            correlationId: ctx.correlationId,
          },
        );
        return { case: updated };
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  decide: governedProcedure
    .meta({
      permission: CORRECTION_CASE_DECIDE_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.decide",
      sensitive: true,
    })
    .input(
      z.object({
        caseId: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "constrained"]),
        decisionReason: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_DECIDE_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.decide",
          });
        }
        const decided = await decideCorrectionCase(getCorrectionCasePool(), {
          caseId: input.caseId,
          decision: input.decision,
          decisionReason: input.decisionReason,
          actorAccountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
        return { case: decided };
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  close: governedProcedure
    .meta({
      permission: CORRECTION_CASE_CLOSE_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.close",
      sensitive: true,
    })
    .input(
      z.object({
        caseId: z.string().uuid(),
        closureEvidence: z.record(z.string(), z.string().max(500)).refine(
          (obj) => Object.keys(obj).length > 0,
          { message: "closure evidence required" },
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_CLOSE_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.close",
          });
        }
        const closed = await closeCorrectionCase(getCorrectionCasePool(), {
          caseId: input.caseId,
          closureEvidence: input.closureEvidence,
          actorAccountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
        return { case: closed };
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  escalateOverdue: governedProcedure
    .meta({
      permission: CORRECTION_CASE_WRITE_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.escalate",
      sensitive: true,
    })
    .mutation(async ({ ctx }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_WRITE_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.escalate",
          });
        }
        const cases = await escalateOverdueCases(getCorrectionCasePool(), {
          actorAccountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
        return { cases };
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  addEvidenceRef: governedProcedure
    .meta({
      permission: CORRECTION_CASE_WRITE_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.evidence.add",
      sensitive: true,
    })
    .input(
      z.object({
        caseId: z.string().uuid(),
        kind: evidenceKindSchema,
        uriOrRef: z.string().min(1).max(500),
        metadata: z.record(z.string(), z.string().max(200)).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_WRITE_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.evidence.add",
          });
        }
        const ref = await addCorrectionCaseEvidenceRef(
          getCorrectionCasePool(),
          {
            caseId: input.caseId,
            kind: input.kind,
            uriOrRef: input.uriOrRef,
            metadata: input.metadata,
            actorAccountId: ctx.session.accountId,
            correlationId: ctx.correlationId,
          },
        );
        return { evidenceRef: ref };
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  uploadAttachment: governedProcedure
    .meta({
      permission: CORRECTION_CASE_WRITE_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.attach",
      sensitive: true,
    })
    .input(
      z.object({
        caseId: z.string().uuid(),
        filename: z.string().min(1).max(200),
        contentType: z.string().max(100).optional(),
        /** Base64 — max chars ≈ policy maxBytes * 4/3 (+pad); decoded size re-checked. */
        contentBase64: z.string().min(1).max(1_400_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_WRITE_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.attach",
          });
        }
        const policy = loadCorrectionCaseAttachmentPolicy();
        // Reject oversize base64 before decode when obviously too large.
        if (input.contentBase64.length > Math.ceil(policy.maxBytes * 4 / 3) + 8) {
          throw new CorrectionCaseError(
            "CORRECTION_CASE_ATTACHMENT_REJECTED",
            operationalCopy.correctionCaseAttachmentRejected,
            { reason: "max_bytes_b64" },
          );
        }
        const buf = Buffer.from(input.contentBase64, "base64");
        // Node does not throw on invalid base64; reject empty/corrupt round-trips.
        if (buf.length === 0) {
          throw new CorrectionCaseError(
            "CORRECTION_CASE_ATTACHMENT_REJECTED",
            operationalCopy.correctionCaseAttachmentRejected,
            { reason: "empty_decode" },
          );
        }
        if (buf.length > policy.maxBytes) {
          throw new CorrectionCaseError(
            "CORRECTION_CASE_ATTACHMENT_REJECTED",
            operationalCopy.correctionCaseAttachmentRejected,
            { reason: "max_bytes" },
          );
        }
        const bytes = Uint8Array.from(buf);
        const result = await uploadCorrectionCaseAttachment(
          getCorrectionCasePool(),
          {
            caseId: input.caseId,
            clientFilename: input.filename,
            clientMime: input.contentType,
            bytes,
            actorAccountId: ctx.session.accountId,
            correlationId: ctx.correlationId,
          },
        );
        return result;
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  getAttachmentMeta: governedProcedure
    .meta({
      permission: CORRECTION_CASE_READ_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.attach.meta",
      sensitive: true,
    })
    .input(z.object({ caseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_READ_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.attach.meta",
          });
        }
        const detail = await getCorrectionCaseDetail(
          getCorrectionCasePool(),
          input.caseId,
          { actorAccountId: ctx.session.accountId, escalate: false },
        );
        return { attachments: detail.attachments };
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  downloadAttachment: governedProcedure
    .meta({
      permission: CORRECTION_CASE_READ_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.attach.download",
      sensitive: true,
    })
    .input(
      z.object({
        attachmentId: z.string().uuid(),
        mode: z.enum(["download", "preview"]).default("download"),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_READ_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.attach.download",
          });
        }
        const result = await getCorrectionCaseAttachmentDownload(
          getCorrectionCasePool(),
          {
            attachmentId: input.attachmentId,
            mode: input.mode,
            actorAccountId: ctx.session.accountId,
            correlationId: ctx.correlationId,
          },
        );
        return {
          contentBase64: result.bytes.toString("base64"),
          headers: result.headers,
          attachment: result.attachment,
        };
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),

  linkOutcome: governedProcedure
    .meta({
      permission: CORRECTION_CASE_WRITE_PERMISSION,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
      operation: "correction.case.outcome.link",
      sensitive: true,
    })
    .input(
      z.object({
        caseId: z.string().uuid(),
        linkType: outcomeLinkSchema,
        targetId: z.string().min(1).max(200),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsCorrectionCasePermission(
          ctx.session.accountId,
          CORRECTION_CASE_WRITE_PERMISSION,
        );
        if (!soft) {
          await denyCorrectionCaseOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "correction.case.outcome.link",
          });
        }
        const link = await linkCorrectionCaseOutcome(getCorrectionCasePool(), {
          caseId: input.caseId,
          linkType: input.linkType,
          targetId: input.targetId,
          note: input.note,
          actorAccountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
        return { outcomeLink: link };
      } catch (err) {
        mapCorrectionCaseError(err);
      }
    }),
});
