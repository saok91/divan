import { randomUUID } from "node:crypto";

import {
  AuditTrustError,
  AuthorizationError,
  MSG_ACCESS_DENIED_FA,
  createAuditEnvelope,
  isAuditTrustApiDistinctCode,
  loadCategoryRegistry,
  loadPolicyRegistry,
  type AuditEnvelope,
  type EvaluationMode,
} from "@divan/audit-envelope";
import { getSharedPgPool, type Pool } from "@divan/db";
import {
  AccessAdminError,
  AuthzChangedError,
  assertBreakGlassElevationLimits,
  getSessionContext,
  toEnvelopeAuthzContext,
  type SessionContext,
} from "@divan/identity-access";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { operationalCopy } from "@/lib/operational-copy";

export type TrpcContext = {
  session: SessionContext | null;
  /** Login-time fingerprint from JWT — null when anonymous. */
  priorAuthzBindingFingerprint: string | null;
};

/**
 * Static authz declaration for governed procedures (tRPC meta).
 * Handlers must not omit this — default-deny at the envelope.
 */
export type GovernedProcedureMeta = {
  /**
   * Coarse permission for envelope authorize.
   * Optional when `resolveAuthorizeFromInput` supplies permission+dataCategory.
   */
  permission?: string;
  dataCategory?: string;
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
  /** Default current. as_of requires input.asOfDate date-only. */
  evaluationMode?: EvaluationMode;
  /**
   * When true, client may supply evaluationMode/asOfDate on input.
   * Default false — raw client temporal fields are ignored (Story 2.6 review).
   */
  allowClientTemporal?: boolean;
  /**
   * Story 9.3 — resolve permission + dataCategory from raw input before
   * envelope authorize (template-aware day-to-day bulk). Fail closed when
   * resolver returns null / incomplete. Does not invent permission keys.
   */
  resolveAuthorizeFromInput?: (
    rawInput: unknown,
  ) =>
    | { permission: string; dataCategory: string }
    | Promise<{ permission: string; dataCategory: string } | null>
    | null;
};

const t = initTRPC
  .context<TrpcContext>()
  .meta<Partial<GovernedProcedureMeta>>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      const cause = error.cause;
      const authzChanged =
        cause instanceof AuthzChangedError ||
        (typeof cause === "object" &&
          cause !== null &&
          "code" in cause &&
          (cause as { code: unknown }).code === "AUTHZ_CHANGED");
      const personCode =
        typeof cause === "object" &&
        cause !== null &&
        "name" in cause &&
        ((cause as { name: unknown }).name === "PersonIdentityError" ||
          (cause as { name: unknown }).name === "DataDictionaryError" ||
          (cause as { name: unknown }).name === "OrgUnitError" ||
          (cause as { name: unknown }).name === "JobRefError" ||
          (cause as { name: unknown }).name === "PersonnelEventError") &&
        "code" in cause &&
        typeof (cause as { code: unknown }).code === "string"
          ? (cause as { code: string }).code
          : undefined;
      const conflicts =
        typeof cause === "object" &&
        cause !== null &&
        "name" in cause &&
        (cause as { name: unknown }).name === "PersonnelEventError" &&
        "conflicts" in cause &&
        Array.isArray((cause as { conflicts: unknown }).conflicts)
          ? (cause as { conflicts: unknown[] }).conflicts
          : undefined;
      return {
        ...shape,
        data: {
          ...shape.data,
          divanCode: authzChanged
            ? ("AUTHZ_CHANGED" as const)
            : personCode,
          ...(conflicts !== undefined ? { conflicts } : {}),
        },
      };
    },
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
      priorAuthzBindingFingerprint: ctx.priorAuthzBindingFingerprint,
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
  envelopePool = getSharedPgPool(url);
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

function throwAuthzChanged(): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: operationalCopy.scopeRevoked,
    cause: new AuthzChangedError(operationalCopy.scopeRevoked),
  });
}

/**
 * Logged-in → DB revalidate authz context → mid-session binding check →
 * audit-envelope authorize → handler.
 * Coarse JWT claims alone never authorize governed data.
 */
export const governedProcedure = protectedProcedure.use(
  async ({ ctx, next, meta, getRawInput }) => {
    if (meta?.devOnly && process.env.NODE_ENV === "production") {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    if (
      !meta?.action?.trim() ||
      !meta?.organizationalScope?.trim() ||
      !meta?.operation?.trim()
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

    // Story 2.6 AC #4: binding change vs login-time snapshot → AUTHZ_CHANGED.
    // Empty prior is legacy/unhydrated — jwt callback hydrates; do not loop the modal.
    const prior = ctx.priorAuthzBindingFingerprint?.trim() ?? "";
    if (prior && prior !== fresh.authzBindingFingerprint) {
      throwAuthzChanged();
    }

    const rawInput = (await getRawInput()) as
      | { asOfDate?: unknown; evaluationMode?: EvaluationMode }
      | undefined;

    let permission = meta.permission?.trim() ?? "";
    let dataCategory = meta.dataCategory?.trim() ?? "";
    if (meta.resolveAuthorizeFromInput) {
      const resolved = await meta.resolveAuthorizeFromInput(rawInput);
      if (
        !resolved?.permission?.trim() ||
        !resolved?.dataCategory?.trim()
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: MSG_ACCESS_DENIED_FA,
        });
      }
      permission = resolved.permission.trim();
      dataCategory = resolved.dataCategory.trim();
    }
    if (!permission || !dataCategory) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: operationalCopy.accessDeniedTitle,
      });
    }

    // Only honor client temporal fields when meta explicitly allows it.
    const allowClientTemporal = meta.allowClientTemporal === true;
    const evaluationMode: EvaluationMode =
      meta.evaluationMode ??
      (allowClientTemporal &&
      (rawInput?.evaluationMode === "current" ||
        rawInput?.evaluationMode === "as_of")
        ? rawInput.evaluationMode
        : undefined) ??
      "current";

    let asOfDate: string | undefined;
    if (evaluationMode === "as_of") {
      const rawAsOf = allowClientTemporal ? rawInput?.asOfDate : undefined;
      if (typeof rawAsOf !== "string" && rawAsOf != null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: MSG_ACCESS_DENIED_FA,
        });
      }
      asOfDate = typeof rawAsOf === "string" ? rawAsOf : undefined;
    }

    const correlationId = randomUUID();
    let decisionId: string | undefined;
    let resultSemantics: "effective" | "planned" | undefined;
    try {
      const authorized = await getEnvelope().authorizeOrThrow({
        context: toEnvelopeAuthzContext(fresh),
        permission,
        dataCategory,
        action: meta.action.trim(),
        organizationalScope: meta.organizationalScope.trim(),
        operation: meta.operation.trim(),
        correlationId,
        sensitive: meta.sensitive !== false,
        evaluationMode,
        asOfDate,
      });
      decisionId = authorized.decisionId;
      resultSemantics = authorized.resultSemantics;
    } catch (err) {
      if (err instanceof AuthorizationError) {
        console.error(
          "[governed]",
          err.code,
          "correlationId=",
          err.correlationId,
          err.decisionId ? `decisionId=${err.decisionId}` : "",
          err.denyReason ? `denyReason=${err.denyReason}` : "",
        );
        // Story 7.4: append/trust failure ≠ ordinary FORBIDDEN (mirror retrieval-control)
        throw new TRPCError({
          code: isAuditTrustApiDistinctCode(err.code)
            ? "INTERNAL_SERVER_ERROR"
            : "FORBIDDEN",
          message: err.messageFa || MSG_ACCESS_DENIED_FA,
        });
      }
      if (err instanceof AuditTrustError) {
        console.error(
          "[governed]",
          err.code,
          err.details ? JSON.stringify(err.details) : "",
        );
        throw new TRPCError({
          code: isAuditTrustApiDistinctCode(err.code)
            ? "INTERNAL_SERVER_ERROR"
            : err.code === "AUDIT_TRUST_DENIED"
              ? "FORBIDDEN"
              : "BAD_REQUEST",
          message: err.messageFa,
        });
      }
      throw err;
    }

    // Story 2.5 AC #2: under live break-glass, export is denied unless exceptional.
    if (meta.action.trim() === "export") {
      try {
        await assertBreakGlassElevationLimits(fresh.accountId, "export");
      } catch (err) {
        if (err instanceof AccessAdminError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: err.messageFa,
          });
        }
        throw err;
      }
    }

    return next({
      ctx: {
        session: fresh,
        priorAuthzBindingFingerprint: ctx.priorAuthzBindingFingerprint,
        correlationId,
        decisionId: decisionId ?? correlationId,
        resultSemantics: resultSemantics ?? "effective",
        evaluationMode,
        asOfDate: asOfDate ?? null,
      },
    });
  },
);
