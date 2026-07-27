/**
 * Governed audit investigation tRPC (Story 7.1 / FR-42 / FR-51).
 * Thin web: query in @divan/event-store; domain helpers in @divan/audit-envelope.
 * Artifact bytes → existing export.download only (consume 6.5).
 *
 * InferenceBulk channel `"audit"` is wired for retrieval evidence only (Decision B):
 * investigation SoT is kernel_events and is not population-filtered by subjectIds.
 */
import { randomUUID } from "node:crypto";

import {
  AUDIT_CONSUME_65_ARTIFACT_CONTRACT,
  AUDIT_EVIDENCE_DATA_CATEGORY,
  AUDIT_INFERENCE_BULK_EVIDENCE_ONLY_FA,
  AUDIT_INVESTIGATE_PERMISSION,
  AuditInvestigationError,
  MSG_AUDIT_INVESTIGATE_DENIED_FA,
  MSG_AUDIT_QUERY_FAILED_FA,
  MSG_AUDIT_SELF_REVIEW_BLOCKED_FA,
  assertAuditEvidenceSelfReviewAllowed,
  buildAuditInvestigationHonesty,
  isExportArtifactEvidence,
  isMigrationRelatedEvidence,
} from "@divan/audit-envelope";
import { getSharedPgPool, type Pool } from "@divan/db";
import {
  appendAccessEvent,
  getAuditEvidenceById,
  queryAuditEvidence,
  type AuditEvidenceRecord,
  type QueryAuditEvidenceFilters,
} from "@divan/event-store";
import { getPersonDb } from "@divan/person-employment";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { operationalCopy } from "@/lib/operational-copy";

import {
  softHasPersonExport,
  softHasReportExport,
} from "./export-capability";
import {
  POPULATION_FIXTURE_DISCLOSURE_FA,
  type PopulationAuthzMode,
  resolvePersonnelPopulationRegistry,
} from "./personnel-scoped-search";
import { runGovernedRetrieval } from "./retrieval-control";
import { createTRPCRouter, governedProcedure } from "./trpc";

const MSG_DB_REQUIRED_FA = "پیکربندی پایگاه داده برای ممیزی موجود نیست.";
const DEFAULT_REVIEW_HREF = "/access";

let auditPool: Pool | null = null;

function getAuditPool(): Pool {
  if (auditPool) return auditPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: MSG_DB_REQUIRED_FA,
    });
  }
  auditPool = getSharedPgPool(url);
  return auditPool;
}

function mapAuditError(err: unknown): never {
  if (err instanceof AuditInvestigationError) {
    const code =
      err.code === "AUDIT_INVESTIGATE_DENIED" ||
      err.code === "AUDIT_SELF_REVIEW_BLOCKED"
        ? "FORBIDDEN"
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
    message: operationalCopy.auditQueryFailed,
  });
}

async function actorHoldsAuditInvestigate(accountId: string): Promise<boolean> {
  const db = getPersonDb();
  const rows = await db.accountAccessRole.findMany({
    where: { accountId },
    include: {
      accessRole: { include: { permissionSet: true } },
    },
  });
  return rows.some((row) =>
    (row.accessRole.permissionSet?.permissions ?? []).includes(
      AUDIT_INVESTIGATE_PERMISSION,
    ),
  );
}

/** Same-origin relative path only — reject open redirects. */
function sanitizeReviewHref(href: string | undefined): string {
  if (href === undefined || href.trim() === "") return DEFAULT_REVIEW_HREF;
  const t = href.trim();
  if (
    !t.startsWith("/") ||
    t.startsWith("//") ||
    t.includes("://") ||
    t.includes("\\") ||
    /[\s<>"`]/.test(t)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: operationalCopy.auditInvalidReviewHref,
    });
  }
  return t.slice(0, 400);
}

const searchInputSchema = z
  .object({
    actorAccountId: z.string().min(1).optional(),
    occurredAtFrom: z.coerce.date().optional(),
    occurredAtTo: z.coerce.date().optional(),
    operation: z.string().min(1).max(200).optional(),
    operationPrefix: z.string().min(1).max(200).optional(),
    entityType: z.string().min(1).max(120).optional(),
    entityId: z.string().min(1).max(120).optional(),
    result: z.enum(["allow", "deny"]).optional(),
    correlationId: z.string().uuid().optional(),
    eventClass: z.enum(["access", "business"]).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.occurredAtFrom &&
      val.occurredAtTo &&
      val.occurredAtFrom.getTime() > val.occurredAtTo.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: operationalCopy.auditInvalidDateRange,
        path: ["occurredAtFrom"],
      });
    }
  });

function toEvidenceDto(row: AuditEvidenceRecord) {
  const occurredAt = Number.isNaN(row.occurredAt.getTime())
    ? null
    : row.occurredAt.toISOString();
  if (!occurredAt) {
    throw new AuditInvestigationError(
      "AUDIT_QUERY_FAILED",
      MSG_AUDIT_QUERY_FAILED_FA,
    );
  }
  return {
    id: row.id,
    eventClass: row.eventClass,
    correlationId: row.correlationId,
    actorAccountId: row.actorAccountId,
    occurredAt,
    operation: row.operation,
    scope: row.scope,
    scopeSummary: summarizeScope(row.scope),
    result: row.result,
    reason: row.reason,
    entityType: row.entityType,
    entityId: row.entityId,
    migrationRelated: isMigrationRelatedEvidence({
      operation: row.operation,
      entityType: row.entityType,
    }),
    exportArtifactId: isExportArtifactEvidence({
      entityType: row.entityType,
      entityId: row.entityId,
    })
      ? row.entityId
      : null,
  };
}

function summarizeScope(scope: Record<string, unknown>): string {
  const keys = Object.keys(scope).sort();
  if (keys.length === 0) return "—";
  return keys
    .slice(0, 4)
    .map((k) => {
      const v = scope[k];
      if (v === null || v === undefined) return k;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        return `${k}=${String(v)}`;
      }
      return k;
    })
    .join(" · ");
}

async function appendInvestigationAccessEvent(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
  filters: QueryAuditEvidenceFilters;
  volume: number;
  outcome: "allow" | "deny";
  reason: string;
}): Promise<void> {
  const pool = getAuditPool();
  await appendAccessEvent(pool, {
    correlationId: input.correlationId,
    actorAccountId: input.actorAccountId,
    operation: input.operation,
    scope: {
      channel: "audit",
      purpose: "audit_investigation",
      filterKeys: Object.keys(input.filters).sort(),
      volume: input.volume,
    },
    result: input.outcome,
    reason: input.reason,
    entityType: "audit_investigation",
    payload: {
      // Non-sensitive filter metadata only — never HR values.
      eventClass: input.filters.eventClass ?? "both",
      hasActorFilter: Boolean(input.filters.actorAccountId),
      hasTimeRange: Boolean(
        input.filters.occurredAtFrom || input.filters.occurredAtTo,
      ),
      hasOperationFilter: Boolean(
        input.filters.operation || input.filters.operationPrefix,
      ),
      hasCorrelationFilter: Boolean(input.filters.correlationId),
      volume: input.volume,
    },
  });
}

/** Soft-deny: prefer FORBIDDEN even if audit-of-audit append fails. */
async function denyInvestigateOrThrow(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
}): Promise<never> {
  try {
    await appendInvestigationAccessEvent({
      correlationId: input.correlationId,
      actorAccountId: input.actorAccountId,
      operation: input.operation,
      filters: {},
      volume: 0,
      outcome: "deny",
      reason: "permission_set_missing",
    });
  } catch {
    // Prefer client-visible deny over append failure masking.
  }
  throw new AuditInvestigationError(
    "AUDIT_INVESTIGATE_DENIED",
    MSG_AUDIT_INVESTIGATE_DENIED_FA,
  );
}

function honestyBundle(input: {
  mode: PopulationAuthzMode;
  disclosureFa: string | null;
}) {
  return buildAuditInvestigationHonesty({
    populationDisclosureFa:
      input.disclosureFa ??
      (input.mode === "fixture-fail-closed"
        ? POPULATION_FIXTURE_DISCLOSURE_FA
        : null),
  });
}

export const auditRouter = createTRPCRouter({
  search: governedProcedure
    .meta({
      permission: AUDIT_INVESTIGATE_PERMISSION,
      dataCategory: AUDIT_EVIDENCE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "audit.investigate.search",
      sensitive: true,
    })
    .input(searchInputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsAuditInvestigate(ctx.session.accountId);
        if (!soft) {
          await denyInvestigateOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.investigate.search",
          });
        }

        const { mode, disclosureFa } =
          await resolvePersonnelPopulationRegistry();

        // Decision B: wire channel "audit" for retrieval evidence; do not
        // population-filter kernel_events rows by subjectIds (FR-48 Gate exception).
        const retrieval = await runGovernedRetrieval({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          channel: "audit",
          correlationId: ctx.correlationId,
          purpose: "audit.investigate.search",
          organizationalScope:
            ctx.session.organizationalScopeCodes[0] ?? "org:selfcheck",
          dataCategory: AUDIT_EVIDENCE_DATA_CATEGORY,
          skipAccessEvent: false,
        });

        const pageLimit = input.limit ?? 100;
        const filters: QueryAuditEvidenceFilters = {
          actorAccountId: input.actorAccountId,
          occurredAtFrom: input.occurredAtFrom,
          occurredAtTo: input.occurredAtTo,
          operation: input.operation,
          operationPrefix: input.operationPrefix,
          entityType: input.entityType,
          entityId: input.entityId,
          result: input.result,
          correlationId: input.correlationId,
          eventClass: input.eventClass,
          limit: pageLimit + 1,
        };

        let fetched: AuditEvidenceRecord[];
        try {
          fetched = await queryAuditEvidence(getAuditPool(), filters);
        } catch {
          throw new AuditInvestigationError(
            "AUDIT_QUERY_FAILED",
            MSG_AUDIT_QUERY_FAILED_FA,
          );
        }

        const hasMore = fetched.length > pageLimit;
        const rows = hasMore ? fetched.slice(0, pageLimit) : fetched;

        await appendInvestigationAccessEvent({
          correlationId: ctx.correlationId,
          actorAccountId: ctx.session.accountId,
          operation: "audit.investigate.search",
          filters: { ...filters, limit: pageLimit },
          volume: rows.length,
          outcome: "allow",
          reason: "investigation_search",
        });

        const honesty = honestyBundle({ mode, disclosureFa });
        const retrievalOutcome = retrieval.payload.outcome;
        const inferenceBulkEvidenceOnly =
          retrievalOutcome !== "allowed" && retrievalOutcome !== "empty";

        return {
          rows: rows.map(toEvidenceDto),
          volume: rows.length,
          hasMore,
          empty: rows.length === 0,
          emptyMessageFa: operationalCopy.auditEmptyFilter,
          populationAuthzMode: mode as PopulationAuthzMode,
          populationDisclosureFa: honesty.populationDisclosureFa,
          migrationEvidenceHonestyFa: honesty.migrationEvidenceHonestyFa,
          authAttemptNotPrimarySoTFa: honesty.authAttemptNotPrimarySoTFa,
          inferenceBulkEvidenceOnlyFa: inferenceBulkEvidenceOnly
            ? AUDIT_INFERENCE_BULK_EVIDENCE_ONLY_FA
            : null,
          consume65ArtifactContract: AUDIT_CONSUME_65_ARTIFACT_CONTRACT,
          decisionId: ctx.decisionId,
          correlationId: ctx.correlationId,
        };
      } catch (err) {
        mapAuditError(err);
      }
    }),

  getByCorrelation: governedProcedure
    .meta({
      permission: AUDIT_INVESTIGATE_PERMISSION,
      dataCategory: AUDIT_EVIDENCE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "audit.investigate.get_by_correlation",
      sensitive: true,
    })
    .input(z.object({ correlationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsAuditInvestigate(ctx.session.accountId);
        if (!soft) {
          await denyInvestigateOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.investigate.get_by_correlation",
          });
        }

        const retrieval = await runGovernedRetrieval({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          channel: "audit",
          correlationId: ctx.correlationId,
          purpose: "audit.investigate.get_by_correlation",
          organizationalScope:
            ctx.session.organizationalScopeCodes[0] ?? "org:selfcheck",
          dataCategory: AUDIT_EVIDENCE_DATA_CATEGORY,
        });

        let rows: AuditEvidenceRecord[];
        try {
          rows = await queryAuditEvidence(getAuditPool(), {
            correlationId: input.correlationId,
            limit: 200,
          });
        } catch {
          throw new AuditInvestigationError(
            "AUDIT_QUERY_FAILED",
            MSG_AUDIT_QUERY_FAILED_FA,
          );
        }

        await appendInvestigationAccessEvent({
          correlationId: ctx.correlationId,
          actorAccountId: ctx.session.accountId,
          operation: "audit.investigate.get_by_correlation",
          filters: { correlationId: input.correlationId },
          volume: rows.length,
          outcome: "allow",
          reason: "investigation_get_by_correlation",
        });

        const { mode, disclosureFa } =
          await resolvePersonnelPopulationRegistry();
        const honesty = honestyBundle({ mode, disclosureFa });
        const retrievalOutcome = retrieval.payload.outcome;
        const inferenceBulkEvidenceOnly =
          retrievalOutcome !== "allowed" && retrievalOutcome !== "empty";

        return {
          rows: rows.map(toEvidenceDto),
          volume: rows.length,
          hasMore: false,
          empty: rows.length === 0,
          emptyMessageFa: operationalCopy.auditEmptyFilter,
          populationAuthzMode: mode as PopulationAuthzMode,
          populationDisclosureFa: honesty.populationDisclosureFa,
          migrationEvidenceHonestyFa: honesty.migrationEvidenceHonestyFa,
          authAttemptNotPrimarySoTFa: honesty.authAttemptNotPrimarySoTFa,
          inferenceBulkEvidenceOnlyFa: inferenceBulkEvidenceOnly
            ? AUDIT_INFERENCE_BULK_EVIDENCE_ONLY_FA
            : null,
          decisionId: ctx.decisionId,
          correlationId: ctx.correlationId,
        };
      } catch (err) {
        mapAuditError(err);
      }
    }),

  /**
   * Independence gate for any "open review" / disposition CTA (AC #5).
   * Binds toxic parties from server-loaded evidence — client party ids ignored.
   */
  assertReviewIndependence: governedProcedure
    .meta({
      permission: AUDIT_INVESTIGATE_PERMISSION,
      dataCategory: AUDIT_EVIDENCE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "audit.investigate.assert_review_independence",
      sensitive: true,
    })
    .input(
      z.object({
        evidenceEventId: z.string().uuid(),
        /** Optional deep-link target when independence holds (same-origin relative). */
        reviewHref: z.string().min(1).max(400).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const soft = await actorHoldsAuditInvestigate(ctx.session.accountId);
        if (!soft) {
          await denyInvestigateOrThrow({
            correlationId: ctx.correlationId,
            actorAccountId: ctx.session.accountId,
            operation: "audit.investigate.assert_review_independence",
          });
        }

        const evidence = await getAuditEvidenceById(
          getAuditPool(),
          input.evidenceEventId,
        );
        if (!evidence) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: operationalCopy.auditEvidenceNotFound,
          });
        }

        const subjectAccountId = evidence.actorAccountId?.trim() || null;
        if (!subjectAccountId) {
          throw new AuditInvestigationError(
            "AUDIT_SELF_REVIEW_BLOCKED",
            MSG_AUDIT_SELF_REVIEW_BLOCKED_FA,
            { reason: "evidence_missing_actor" },
          );
        }

        const reviewHref = sanitizeReviewHref(input.reviewHref);

        try {
          assertAuditEvidenceSelfReviewAllowed({
            reviewerAccountId: ctx.session.accountId,
            subjectAccountId,
          });
        } catch (err) {
          if (
            err instanceof AuditInvestigationError &&
            err.code === "AUDIT_SELF_REVIEW_BLOCKED"
          ) {
            try {
              await appendAccessEvent(getAuditPool(), {
                correlationId: ctx.correlationId,
                actorAccountId: ctx.session.accountId,
                operation: "audit.investigate.assert_review_independence",
                scope: { channel: "audit", purpose: "self_review_gate" },
                result: "deny",
                reason: err.details?.reason ?? "self_review_blocked",
                entityType: "audit_review_gate",
                entityId: evidence.id,
                payload: {
                  evidenceEventId: evidence.id,
                  hasSubject: true,
                },
              });
            } catch {
              // Prefer FORBIDDEN over append failure masking.
            }
          }
          throw err;
        }

        await appendAccessEvent(getAuditPool(), {
          correlationId: ctx.correlationId,
          actorAccountId: ctx.session.accountId,
          operation: "audit.investigate.assert_review_independence",
          scope: { channel: "audit", purpose: "self_review_gate" },
          result: "allow",
          reason: "independence_ok",
          entityType: "audit_review_gate",
          entityId: evidence.id,
          payload: {
            evidenceEventId: evidence.id,
            hasSubject: true,
            reviewHrefPresent: Boolean(input.reviewHref),
          },
        });

        return {
          ok: true as const,
          reviewHref,
          evidenceEventId: evidence.id,
          subjectAccountId,
          correlationId: ctx.correlationId,
          noteFa: operationalCopy.auditSelfReviewGateOk,
        };
      } catch (err) {
        mapAuditError(err);
      }
    }),

  /**
   * Soft capability for UI — coarse role alone is insufficient.
   * Does not leak rows; not a substitute for governed search authorize.
   */
  capabilities: governedProcedure
    .meta({
      permission: AUDIT_INVESTIGATE_PERMISSION,
      dataCategory: AUDIT_EVIDENCE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "audit.investigate.capabilities",
      sensitive: true,
    })
    .query(async ({ ctx }) => {
      const canInvestigate = await actorHoldsAuditInvestigate(
        ctx.session.accountId,
      );
      const canOpenExportArtifact =
        (await softHasReportExport(ctx.session.accountId)) ||
        (await softHasPersonExport(ctx.session.accountId));
      return {
        canInvestigate,
        canOpenExportArtifact,
        consume65ArtifactContract: AUDIT_CONSUME_65_ARTIFACT_CONTRACT,
        /** Search-only: disposition uses assertReviewIndependence + /access. */
        dispositionMutationShipped: false,
        correlationId: ctx.correlationId ?? randomUUID(),
      };
    }),
});
