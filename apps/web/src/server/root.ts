import {
  DEMO_OMIT_FIELD_CATEGORIES,
  DEMO_OMIT_FIXTURE_PAYLOAD,
  DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE,
  DEMO_SENSITIVE_EXPORT_DENY_TUPLE,
  DEMO_SENSITIVE_HR_READ_TUPLE,
  DEMO_SENSITIVE_TUPLE,
  DEV_DEMO_CATEGORIES,
  omitUnauthorizedCategories,
} from "@divan/audit-envelope";
import {
  AccessAdminError,
  assertActorHasBreakGlassPrivilegedRead,
  assertBreakGlassElevationLimits,
  currentAsOfDate,
} from "@divan/identity-access";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  governedProcedure,
  publicProcedure,
  protectedProcedure,
} from "./trpc";
import { accessAdminRouter } from "./access-admin";
import { dashboardRouter } from "./dashboard";
import { headcountRouter } from "./headcount";
import { jobReferenceRouter } from "./job-reference";
import { migrationRouter } from "./migration";
import { organizationRouter } from "./organization";
import { personRouter } from "./person";
import { personnelEventRouter } from "./personnel-event";
import { platformStatusRouter } from "./platform-status";
import { reportRouter } from "./report";
import { exportArtifactRouter } from "./export-artifact";
import { auditRouter } from "./audit";
import { operationsRouter } from "./operations";
import { retentionRouter } from "./retention";
import {
  actorHasActiveBulkGrant,
  runGovernedDrillDown,
  runGovernedRetrieval,
} from "./retrieval-control";

const retrievalChannelSchema = z.enum([
  "profile",
  "timeline",
  "search",
  "list",
  "count",
  "dashboard",
  "report",
  "export",
  "audit",
]);

/**
 * `me` is session-only identity (not sensitive HR content) — deliberately
 * NOT routed through the audit-envelope. It must not become a backdoor for
 * category data; returns only accountId / username / displayName / coarseRole /
 * organizationalScopeIds / authz fingerprint / breakGlass summary.
 *
 * Privileged HR-content elevation uses break-glass binding (Story 2.5).
 */
export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({
    status: "ok" as const,
    app: "دیوان",
  })),
  me: protectedProcedure.query(({ ctx }) => ({
    accountId: ctx.session.accountId,
    username: ctx.session.username,
    displayName: ctx.session.displayName,
    coarseRole: ctx.session.coarseRole,
    organizationalScopeIds: ctx.session.organizationalScopeIds,
    organizationalScopeCodes: ctx.session.organizationalScopeCodes,
    authzBindingFingerprint: ctx.session.authzBindingFingerprint,
    priorAuthzBindingFingerprint: ctx.priorAuthzBindingFingerprint,
    authzChanged:
      Boolean(ctx.priorAuthzBindingFingerprint?.trim()) &&
      ctx.priorAuthzBindingFingerprint !==
        ctx.session.authzBindingFingerprint,
    breakGlass: ctx.session.breakGlass,
  })),

  accessAdmin: accessAdminRouter,

  person: personRouter,

  organization: organizationRouter,

  jobReference: jobReferenceRouter,

  headcount: headcountRouter,

  personnelEvent: personnelEventRouter,

  platformStatus: platformStatusRouter,

  dashboard: dashboardRouter,

  report: reportRouter,

  export: exportArtifactRouter,

  audit: auditRouter,

  operations: operationsRouter,

  retention: retentionRouter,

  migration: migrationRouter,

  /**
   * Demo governed read — controlled allow via DEV_DEMO_POLICY fixture.
   * Proves envelope + access event on allow. Coarse role labels do not grant.
   * `devOnly`: production returns NOT_FOUND before envelope (no audit noise).
   * Requires org:selfcheck membership (Story 2.6).
   */
  demoGovernedRead: governedProcedure
    .meta({
      permission: "demo.selfcheck.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "demo.selfcheck.read",
      sensitive: true,
      devOnly: true,
    })
    .query(({ ctx }) => ({
      ok: true as const,
      fixture: "non_hr_demo" as const,
      accountId: ctx.session.accountId,
    })),

  /**
   * Privileged demo HR read under break-glass elevation (Story 2.5).
   * Envelope allow + PermissionSet binding from active break-glass activate.
   * Story 2.6: still runs population intersection — no out-of-scope bypass.
   * Story 2.7: InferenceBulkPort still evaluates — BG cannot bypass thresholds.
   */
  demoBreakGlassPrivilegedHrRead: governedProcedure
    .meta({
      permission: DEMO_SENSITIVE_HR_READ_TUPLE.permission,
      dataCategory: DEMO_SENSITIVE_HR_READ_TUPLE.dataCategory,
      action: DEMO_SENSITIVE_HR_READ_TUPLE.action,
      organizationalScope: DEMO_SENSITIVE_HR_READ_TUPLE.organizationalScope,
      operation: "demo.break_glass.privileged_hr_read",
      sensitive: true,
      devOnly: true,
    })
    .input(
      z
        .object({
          objectIds: z.array(z.string()).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        await assertActorHasBreakGlassPrivilegedRead(ctx.session.accountId);
      } catch (err) {
        if (err instanceof AccessAdminError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: err.messageFa,
          });
        }
        throw err;
      }

      const result = await runGovernedRetrieval({
        actorAccountId: ctx.session.accountId,
        actorScopeCodes: ctx.session.organizationalScopeCodes,
        channel: "profile",
        objectIds: input?.objectIds,
        dataCategory: DEMO_SENSITIVE_HR_READ_TUPLE.dataCategory,
        correlationId: ctx.correlationId,
        purpose: "break_glass_privileged_hr_read",
        organizationalScope: DEMO_SENSITIVE_HR_READ_TUPLE.organizationalScope,
      });

      return {
        ok: true as const,
        fixture: "break_glass_privileged_hr_read" as const,
        incidentId: ctx.session.breakGlass.incidentId,
        grantId: ctx.session.breakGlass.grantId,
        retrieval: result.payload,
        // No HR field values — purpose/incident correlation only (FR-51).
      };
    }),

  /**
   * Demo scoped retrieval — PopulationPort ∩ InferenceBulkPort (Stories 2.6–2.7).
   * Out-of-scope ids omitted (not masked as 0). Suppress ≠ empty ≠ zero.
   * All channels (search|list|count|dashboard|report|export|…) share this plane.
   */
  demoScopedRetrieval: governedProcedure
    .meta({
      permission: "demo.retrieval.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "demo.retrieval.scoped",
      sensitive: true,
      devOnly: true,
      allowClientTemporal: true,
    })
    .input(
      z
        .object({
          channel: retrievalChannelSchema.default("search"),
          asOfDate: z.string().optional(),
          evaluationMode: z.enum(["current", "as_of"]).optional(),
          objectIds: z.array(z.string()).optional(),
          /** Clamped to session membership — cannot invent out-of-membership codes. */
          actorScopeCodesOverride: z.array(z.string()).optional(),
          unreconciled: z.boolean().optional(),
          cellKey: z.string().optional(),
          fields: z.array(z.string()).optional(),
          /** Aggregate sensitivity — may require activated bulk grant. */
          sensitiveAggregate: z.boolean().optional(),
          /** Explicit demo co-approval (in addition to activated bulk grant). */
          demoBulkApproval: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const held = ctx.session.organizationalScopeCodes;
      const requested = input?.actorScopeCodesOverride;
      const codes = requested?.length
        ? requested.filter((c) => held.includes(c))
        : held;
      const asOf =
        ctx.evaluationMode === "as_of" && ctx.asOfDate
          ? ctx.asOfDate
          : currentAsOfDate();
      const channel = input?.channel ?? "search";
      const result = await runGovernedRetrieval({
        actorAccountId: ctx.session.accountId,
        actorScopeCodes: codes,
        channel,
        asOfDate: asOf,
        objectIds: input?.objectIds,
        dataCategory: "demo.non_hr",
        unreconciled: input?.unreconciled,
        correlationId: ctx.correlationId,
        purpose: "demo.retrieval.scoped",
        organizationalScope: "org:selfcheck",
        cellKey: input?.cellKey,
        fields: input?.fields,
        sensitivity: input?.sensitiveAggregate === true,
        demoBulkApproval: input?.demoBulkApproval === true,
      });

      return {
        ok: true as const,
        channel,
        retrieval: result.payload,
        resultSemantics: ctx.resultSemantics,
        evaluationMode: ctx.evaluationMode,
        asOfDate: asOf,
      };
    }),

  /**
   * Drill-down from aggregate — same authorized set (recomputed identically).
   * Widening beyond parent set → deny. Suppressed parent → fail closed (2.7).
   */
  demoRetrievalDrillDown: governedProcedure
    .meta({
      permission: "demo.retrieval.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "demo.retrieval.drill_down",
      sensitive: true,
      devOnly: true,
      allowClientTemporal: true,
    })
    .input(
      z.object({
        objectId: z.string().min(1),
        actorScopeCodesOverride: z.array(z.string()).optional(),
        demoBulkApproval: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const held = ctx.session.organizationalScopeCodes;
      const requested = input.actorScopeCodesOverride;
      const codes = requested?.length
        ? requested.filter((c) => held.includes(c))
        : held;
      const asOf =
        ctx.evaluationMode === "as_of" && ctx.asOfDate
          ? ctx.asOfDate
          : currentAsOfDate();
      const result = await runGovernedDrillDown({
        actorAccountId: ctx.session.accountId,
        actorScopeCodes: codes,
        objectId: input.objectId,
        dataCategory: "demo.non_hr",
        asOfDate: asOf,
        correlationId: ctx.correlationId,
        purpose: "demo.retrieval.drill_down",
        organizationalScope: "org:selfcheck",
        demoBulkApproval: input.demoBulkApproval === true,
      });

      return {
        retrieval: result.payload,
      };
    }),

  /**
   * Multi-channel inference parity probe — same control plane for count vs export.
   * Does not invent export permission; uses read + channel facet for FR-48 demos.
   * Runs full runGovernedRetrieval (evidence + window) per channel.
   */
  demoInferenceBulkProbe: governedProcedure
    .meta({
      permission: "demo.retrieval.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "demo.inference_bulk.probe",
      sensitive: true,
      devOnly: true,
    })
    .input(
      z.object({
        channels: z
          .array(retrievalChannelSchema)
          .min(1)
          .default(["count", "dashboard", "export"]),
        objectIds: z.array(z.string()).optional(),
        actorScopeCodesOverride: z.array(z.string()).optional(),
        sensitiveAggregate: z.boolean().optional(),
        demoBulkApproval: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const held = ctx.session.organizationalScopeCodes;
      const requested = input.actorScopeCodesOverride;
      const codes = requested?.length
        ? requested.filter((c) => held.includes(c))
        : held;
      const hasBulk =
        input.demoBulkApproval === true ||
        (await actorHasActiveBulkGrant(ctx.session.accountId));
      const results: Record<
        string,
        Awaited<ReturnType<typeof runGovernedRetrieval>>["payload"]
      > = {};
      for (const channel of input.channels) {
        const result = await runGovernedRetrieval({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: codes,
          channel,
          objectIds: input.objectIds,
          dataCategory: "demo.non_hr",
          correlationId: ctx.correlationId,
          purpose: "demo.inference_bulk.probe",
          organizationalScope: "org:selfcheck",
          sensitivity: input.sensitiveAggregate === true,
          demoBulkApproval: input.demoBulkApproval === true,
        });
        results[channel] = result.payload;
      }
      return { ok: true as const, results, bulkApprovalPresent: hasBulk };
    }),

  /**
   * Demo sensitive fixture — no policy rule. system_admin / manager / any
   * coarse label must deny; proves UI/role label ≠ entitlement.
   * Handler body must never run on deny (no payload leakage).
   * `devOnly`: production returns NOT_FOUND before envelope.
   */
  demoSensitiveRead: governedProcedure
    .meta({
      permission: DEMO_SENSITIVE_TUPLE.permission,
      dataCategory: DEMO_SENSITIVE_TUPLE.dataCategory,
      action: DEMO_SENSITIVE_TUPLE.action,
      organizationalScope: DEMO_SENSITIVE_TUPLE.organizationalScope,
      operation: DEMO_SENSITIVE_TUPLE.operation,
      sensitive: true,
      devOnly: true,
    })
    .query(() => ({
      secret: "SHOULD_NEVER_RETURN",
    })),

  /**
   * Ordinary view (demo.non_hr) + omit projection — proves AC#1:
   * view without category-view for `demo.sensitive_hr` → sensitive key
   * **absent** from the success body (not masked; not FORBIDDEN-only).
   * UI profile DOM omit follows the same contract in Story 5.2+.
   */
  demoOmitProjection: governedProcedure
    .meta({
      permission: "demo.selfcheck.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "demo.omit.projection",
      sensitive: true,
      devOnly: true,
    })
    .query(() =>
      omitUnauthorizedCategories(
        { ...DEMO_OMIT_FIXTURE_PAYLOAD },
        DEMO_OMIT_FIELD_CATEGORIES,
        new Set(["demo.non_hr"]),
        DEV_DEMO_CATEGORIES,
      ),
    ),

  /**
   * Export with read permission tuple — must deny (read ≠ export).
   * Even when a related read rule exists, export needs an explicit export rule.
   * Under active break-glass without exceptional export approval → also deny.
   */
  demoSensitiveExport: governedProcedure
    .meta({
      permission: DEMO_SENSITIVE_EXPORT_DENY_TUPLE.permission,
      dataCategory: DEMO_SENSITIVE_EXPORT_DENY_TUPLE.dataCategory,
      action: DEMO_SENSITIVE_EXPORT_DENY_TUPLE.action,
      organizationalScope: DEMO_SENSITIVE_EXPORT_DENY_TUPLE.organizationalScope,
      operation: DEMO_SENSITIVE_EXPORT_DENY_TUPLE.operation,
      sensitive: true,
      devOnly: true,
    })
    .mutation(async ({ ctx }) => {
      try {
        await assertBreakGlassElevationLimits(ctx.session.accountId, "export");
      } catch (err) {
        if (err instanceof AccessAdminError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: err.messageFa,
          });
        }
        throw err;
      }
      return {
        exported: true as const,
      };
    }),

  /**
   * Explicit export allow fixture (demo only) — positive export path.
   * Not a real CSV/artifact export (Story 6.5).
   * Hard-deny under active break-glass without exceptional co-approval.
   */
  demoSensitiveExportAllowed: governedProcedure
    .meta({
      permission: DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE.permission,
      dataCategory: DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE.dataCategory,
      action: DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE.action,
      organizationalScope: DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE.organizationalScope,
      operation: DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE.operation,
      sensitive: true,
      devOnly: true,
    })
    .mutation(async ({ ctx }) => {
      try {
        await assertBreakGlassElevationLimits(ctx.session.accountId, "export");
      } catch (err) {
        if (err instanceof AccessAdminError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: err.messageFa,
          });
        }
        throw err;
      }
      return {
        exported: true as const,
        fixture: "sensitive_hr_export_demo" as const,
      };
    }),
});

export type AppRouter = typeof appRouter;
