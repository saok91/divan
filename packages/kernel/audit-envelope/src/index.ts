import { readFileSync } from "node:fs";

import {
  appendAccessEvent,
  withTransaction,
} from "@divan/event-store";
import type { Pool } from "pg";

/**
 * Persian FORBIDDEN copy — must stay aligned with
 * `operationalCopy.accessDeniedTitle` in apps/web (`دسترسی ندارید.`).
 */
export const MSG_ACCESS_DENIED_FA = "دسترسی ندارید.";

export type CoarseAuthzContext = {
  accountId: string;
  /** Navigation context only — never an implicit allow for sensitive categories. */
  coarseRole: string;
  organizationalScopeIds: string[];
};

export type AuthorizeAction = "read" | "write" | "export" | string;

export type AuthorizeInput = {
  context: CoarseAuthzContext;
  permission: string;
  dataCategory: string;
  action: AuthorizeAction;
  organizationalScope: string;
  operation: string;
  correlationId: string;
  /**
   * When true (default), access event append is mandatory with the outcome.
   * Append failure fails the operation (FR-51 direction).
   */
  sensitive?: boolean;
};

export type AuthorizeResult = {
  decisionId: string;
};

export type PolicyRule = {
  permission: string;
  dataCategory: string;
  action: string;
  organizationalScope: string;
};

export type PolicyRegistry = {
  rules: readonly PolicyRule[];
};

export type AuthorizationErrorCode = "FORBIDDEN" | "AUDIT_APPEND_FAILED";

/**
 * Envelope-owned deny / audit-failure error.
 * API boundary maps FORBIDDEN → TRPCError FORBIDDEN with messageFa.
 */
export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;
  readonly messageFa: string;
  readonly correlationId: string;
  readonly decisionId: string | null;

  constructor(
    code: AuthorizationErrorCode,
    messageFa: string,
    correlationId: string,
    decisionId: string | null = null,
  ) {
    super(code);
    this.name = "AuthorizationError";
    this.code = code;
    this.messageFa = messageFa;
    this.correlationId = correlationId;
    this.decisionId = decisionId;
  }
}

/**
 * Tiny local/dev fixture — proves default-deny + one controlled allow.
 * Not the AR-ACCESS launch matrix. Coarse roles never appear as allow keys.
 */
export const DEV_DEMO_POLICY: PolicyRegistry = {
  rules: [
    {
      permission: "demo.selfcheck.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
  ],
};

/** Sensitive fixture category — no rule; every coarse role must deny. */
export const DEMO_SENSITIVE_TUPLE = {
  permission: "demo.sensitive.read",
  dataCategory: "demo.sensitive_hr",
  action: "read",
  organizationalScope: "org:any",
  operation: "demo.sensitive.read",
} as const;

export function emptyPolicyRegistry(): PolicyRegistry {
  return { rules: [] };
}

/**
 * Load policy registry.
 * - `AUDIT_ENVELOPE_POLICY_PATH` → JSON `{ "rules": [...] }`
 * - `AUDIT_ENVELOPE_USE_DEV_FIXTURE=false` → empty (all deny)
 * - otherwise non-production → DEV_DEMO_POLICY; production → empty
 *
 * Fail-closed: unreadable/invalid policy file or bad shape → empty registry (deny all).
 * Production matrix is owned by AR-ACCESS — this is a configurable fail-closed hook only.
 */
export function loadPolicyRegistry(
  env: NodeJS.ProcessEnv = process.env,
): PolicyRegistry {
  const path = env.AUDIT_ENVELOPE_POLICY_PATH?.trim();
  if (path) {
    try {
      const raw = readFileSync(path, "utf8");
      const parsed = JSON.parse(raw) as { rules?: unknown };
      const rules = Array.isArray(parsed?.rules) ? parsed.rules : [];
      return { rules: rules as PolicyRule[] };
    } catch {
      return emptyPolicyRegistry();
    }
  }

  if (env.AUDIT_ENVELOPE_USE_DEV_FIXTURE?.trim() === "false") {
    return emptyPolicyRegistry();
  }

  if ((env.NODE_ENV ?? "").toLowerCase() === "production") {
    return emptyPolicyRegistry();
  }

  return DEV_DEMO_POLICY;
}

export function evaluatePolicy(
  registry: PolicyRegistry,
  request: {
    permission: string;
    dataCategory: string;
    action: string;
    organizationalScope: string;
  },
): "allow" | "deny" {
  if (!registry.rules.length) return "deny";

  const hit = registry.rules.some(
    (r) =>
      r.permission === request.permission &&
      r.dataCategory === request.dataCategory &&
      r.action === request.action &&
      r.organizationalScope === request.organizationalScope,
  );
  return hit ? "allow" : "deny";
}

export type AuditEnvelopeDeps = {
  pool: Pool;
  getPolicy: () => PolicyRegistry;
};

export type AuditEnvelope = {
  authorizeOrThrow: (input: AuthorizeInput) => Promise<AuthorizeResult>;
};

/**
 * Default-deny authorize API. Coarse role is context only — never an allow key.
 * Sensitive decisions append `event_class=access` atomically with the outcome.
 */
export function createAuditEnvelope(deps: AuditEnvelopeDeps): AuditEnvelope {
  return {
    async authorizeOrThrow(input: AuthorizeInput): Promise<AuthorizeResult> {
      const sensitive = input.sensitive !== false;

      let decision: "allow" | "deny";
      try {
        const registry = deps.getPolicy();
        decision = evaluatePolicy(registry, {
          permission: input.permission,
          dataCategory: input.dataCategory,
          action: input.action,
          organizationalScope: input.organizationalScope,
        });
      } catch {
        throw new AuthorizationError(
          "FORBIDDEN",
          MSG_ACCESS_DENIED_FA,
          input.correlationId,
        );
      }

      const scope = {
        permission: input.permission,
        dataCategory: input.dataCategory,
        action: input.action,
        organizationalScope: input.organizationalScope,
        actorCoarseRole: input.context.coarseRole,
        actorOrganizationalScopeIds: input.context.organizationalScopeIds,
      };

      if (!sensitive) {
        if (decision === "deny") {
          throw new AuthorizationError(
            "FORBIDDEN",
            MSG_ACCESS_DENIED_FA,
            input.correlationId,
          );
        }
        return { decisionId: input.correlationId };
      }

      let decisionId: string;
      try {
        decisionId = await withTransaction(deps.pool, async (client) => {
          const { id } = await appendAccessEvent(client, {
            correlationId: input.correlationId,
            actorAccountId: input.context.accountId,
            operation: input.operation,
            scope,
            result: decision,
            reason:
              decision === "deny"
                ? "default_deny_or_no_matching_rule"
                : "explicit_allow_rule",
          });
          return id;
        });
      } catch (err) {
        if (err instanceof AuthorizationError) throw err;
        throw new AuthorizationError(
          "AUDIT_APPEND_FAILED",
          MSG_ACCESS_DENIED_FA,
          input.correlationId,
        );
      }

      if (decision === "deny") {
        throw new AuthorizationError(
          "FORBIDDEN",
          MSG_ACCESS_DENIED_FA,
          input.correlationId,
          decisionId,
        );
      }

      return { decisionId };
    },
  };
}
