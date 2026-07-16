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
} from "@divan/identity-access";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  governedProcedure,
  publicProcedure,
  protectedProcedure,
} from "./trpc";
import { accessAdminRouter } from "./access-admin";

/**
 * `me` is session-only identity (not sensitive HR content) — deliberately
 * NOT routed through the audit-envelope. It must not become a backdoor for
 * category data; returns only accountId / username / displayName / coarseRole /
 * organizationalScopeIds / breakGlass summary.
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
    breakGlass: ctx.session.breakGlass,
  })),

  accessAdmin: accessAdminRouter,

  /**
   * Demo governed read — controlled allow via DEV_DEMO_POLICY fixture.
   * Proves envelope + access event on allow. Coarse role labels do not grant.
   * `devOnly`: production returns NOT_FOUND before envelope (no audit noise).
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
   * Without binding → deny. Export / access-admin stay separately gated.
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
    .query(async ({ ctx }) => {
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
      return {
        ok: true as const,
        fixture: "break_glass_privileged_hr_read" as const,
        incidentId: ctx.session.breakGlass.incidentId,
        grantId: ctx.session.breakGlass.grantId,
        // No HR field values — purpose/incident correlation only (FR-51).
      };
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
