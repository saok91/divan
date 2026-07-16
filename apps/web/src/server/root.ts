import {
  DEMO_SENSITIVE_TUPLE,
} from "@divan/audit-envelope";

import {
  createTRPCRouter,
  governedProcedure,
  publicProcedure,
  protectedProcedure,
} from "./trpc";

/**
 * `me` is session-only identity (not sensitive HR content) — deliberately
 * NOT routed through the audit-envelope. It must not become a backdoor for
 * category data; returns only accountId / username / displayName / coarseRole /
 * organizationalScopeIds.
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
  })),

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
});

export type AppRouter = typeof appRouter;
