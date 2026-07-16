import { randomUUID } from "node:crypto";

import {
  AuthorizationError,
  MSG_ACCESS_DENIED_FA,
  createAuditEnvelope,
  loadCategoryRegistry,
  loadPolicyRegistry,
  type AuditEnvelope,
} from "@divan/audit-envelope";
import { createPgPool, type Pool } from "@divan/db";
import {
  getSessionContext,
  toEnvelopeAuthzContext,
  type SessionContext,
} from "@divan/identity-access";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { operationalCopy } from "@/lib/operational-copy";

export type TrpcContext = {
  session: SessionContext | null;
};

/**
 * Static authz declaration for governed procedures (tRPC meta).
 * Handlers must not omit this — default-deny at the envelope.
 */
export type GovernedProcedureMeta = {
  permission: string;
  dataCategory: string;
  action: string;
  organizationalScope: string;
  operation: string;
  /** Default true — access event mandatory. */
  sensitive?: boolean;
  /**
   * Dev/selfcheck fixtures only. In production, rejected with NOT_FOUND
   * before envelope authorize (no access-event noise).
   */
  devOnly?: boolean;
};

const t = initTRPC
  .context<TrpcContext>()
  .meta<Partial<GovernedProcedureMeta>>()
  .create({
    transformer: superjson,
  });

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "برای دسترسی باید وارد شوید.",
    });
  }
  return next({
    ctx: {
      session: ctx.session,
    },
  });
});

let envelopePool: Pool | null = null;
let envelope: AuditEnvelope | null = null;

function getEnvelope(): AuditEnvelope {
  if (envelope) return envelope;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: operationalCopy.accessDeniedTitle,
    });
  }
  envelopePool = createPgPool(url);
  envelope = createAuditEnvelope({
    pool: envelopePool,
    getPolicy: () => loadPolicyRegistry(),
    getCategories: () => loadCategoryRegistry(),
  });
  return envelope;
}

/** Test/selfcheck hook — inject envelope without process-wide pool. */
export function setGovernedEnvelopeForTests(next: AuditEnvelope | null): void {
  envelope = next;
}

/**
 * Logged-in → DB revalidate authz context → audit-envelope authorize → handler.
 * Coarse JWT claims alone never authorize governed data.
 */
export const governedProcedure = protectedProcedure.use(
  async ({ ctx, next, meta }) => {
    if (meta?.devOnly && process.env.NODE_ENV === "production") {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    if (
      !meta?.permission?.trim() ||
      !meta.dataCategory?.trim() ||
      !meta.action?.trim() ||
      !meta.organizationalScope?.trim() ||
      !meta.operation?.trim()
    ) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: operationalCopy.accessDeniedTitle,
      });
    }

    const fresh = await getSessionContext(ctx.session.accountId);
    if (!fresh) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: operationalCopy.inactiveAccount,
      });
    }

    const correlationId = randomUUID();
    let decisionId: string | undefined;
    try {
      const authorized = await getEnvelope().authorizeOrThrow({
        context: toEnvelopeAuthzContext(fresh),
        permission: meta.permission.trim(),
        dataCategory: meta.dataCategory.trim(),
        action: meta.action.trim(),
        organizationalScope: meta.organizationalScope.trim(),
        operation: meta.operation.trim(),
        correlationId,
        sensitive: meta.sensitive !== false,
      });
      decisionId = authorized.decisionId;
    } catch (err) {
      if (err instanceof AuthorizationError) {
        console.error(
          "[governed]",
          err.code,
          "correlationId=",
          err.correlationId,
          err.decisionId ? `decisionId=${err.decisionId}` : "",
        );
        throw new TRPCError({
          code: "FORBIDDEN",
          message: err.messageFa || MSG_ACCESS_DENIED_FA,
        });
      }
      throw err;
    }

    return next({
      ctx: {
        session: fresh,
        correlationId,
        decisionId: decisionId ?? correlationId,
      },
    });
  },
);
