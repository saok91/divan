import { readFileSync } from "node:fs";

import {
  appendAccessEvent,
  withTransaction,
} from "@divan/event-store";
import type { Pool } from "pg";

import {
  isCategoryGrantable,
  loadCategoryRegistry,
  type CategoryRegistry,
} from "./categories";

export {
  DEV_DEMO_CATEGORIES,
  PRODUCTION_SENSITIVE_CATEGORY_HOOKS,
  emptyCategoryRegistry,
  isCategoryGrantable,
  loadCategoryRegistry,
  type CategoryRegistry,
  type CategorySensitivity,
  type SensitiveCategory,
} from "./categories";

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
  /**
   * Optional non-sensitive detail for the access event (e.g. before/after
   * snapshots). Never include HR field values or passwords.
   */
  payload?: Record<string, unknown>;
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
 * Tiny local/dev fixture — proves default-deny + controlled allows.
 * Not the AR-ACCESS launch matrix. Coarse roles never appear as allow keys.
 *
 * Read ≠ export: `demo.sensitive_hr.read` allows read only; export on the same
 * (or related) tuple denies unless an explicit `action: "export"` rule exists.
 */
export const DEV_DEMO_POLICY: PolicyRegistry = {
  rules: [
    {
      permission: "demo.selfcheck.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "demo.sensitive_hr.read",
      dataCategory: "demo.sensitive_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "demo.sensitive_hr.export",
      dataCategory: "demo.sensitive_hr",
      action: "export",
      organizationalScope: "org:selfcheck",
    },
    // Story 2.3 — access administration (coarse role is never an allow key)
    {
      permission: "access.administration",
      dataCategory: "identity.access_admin",
      action: "read",
      organizationalScope: "org:any",
    },
    {
      permission: "access.administration",
      dataCategory: "identity.access_admin",
      action: "write",
      organizationalScope: "org:any",
    },
  ],
};

/** Sensitive fixture with no policy rule — every coarse role must deny. */
export const DEMO_SENSITIVE_TUPLE = {
  permission: "demo.sensitive.read",
  dataCategory: "demo.sensitive_hr",
  action: "read",
  organizationalScope: "org:any",
  operation: "demo.sensitive.read",
} as const;

/**
 * Category-view read allow (demo) — does **not** imply export.
 * Used for omit-when-authorized and read≠export proofs.
 */
export const DEMO_SENSITIVE_HR_READ_TUPLE = {
  permission: "demo.sensitive_hr.read",
  dataCategory: "demo.sensitive_hr",
  action: "read",
  organizationalScope: "org:selfcheck",
  operation: "demo.sensitive_hr.read",
} as const;

/**
 * Export attempt on the read permission tuple — must deny (no export rule for
 * this 4-tuple even though a related read rule exists).
 */
export const DEMO_SENSITIVE_EXPORT_DENY_TUPLE = {
  permission: "demo.sensitive_hr.read",
  dataCategory: "demo.sensitive_hr",
  action: "export",
  organizationalScope: "org:selfcheck",
  operation: "demo.sensitive.export",
} as const;

/** Explicit export allow fixture (demo only). */
export const DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE = {
  permission: "demo.sensitive_hr.export",
  dataCategory: "demo.sensitive_hr",
  action: "export",
  organizationalScope: "org:selfcheck",
  operation: "demo.sensitive_hr.export",
} as const;

/** Fixture row for omit selfcheck / demo query. */
export const DEMO_OMIT_FIXTURE_PAYLOAD = {
  displayName: "نمونه",
  teamLabel: "تیم الف",
  compensationHint: "SHOULD_OMIT_WHEN_UNAUTHORIZED",
} as const;

/** Field → category map for {@link DEMO_OMIT_FIXTURE_PAYLOAD}. */
export const DEMO_OMIT_FIELD_CATEGORIES: Record<
  keyof typeof DEMO_OMIT_FIXTURE_PAYLOAD,
  string
> = {
  displayName: "demo.non_hr",
  teamLabel: "demo.non_hr",
  compensationHint: "demo.sensitive_hr",
};

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

  if (env.AUDIT_ENVELOPE_USE_DEV_FIXTURE?.trim().toLowerCase() === "false") {
    return emptyPolicyRegistry();
  }

  if ((env.NODE_ENV ?? "").toLowerCase() === "production") {
    return emptyPolicyRegistry();
  }

  return DEV_DEMO_POLICY;
}

/**
 * Exact-match policy only — **not** a public authz API.
 * Callers must use {@link evaluateAuthorization} so the category registry
 * gate cannot be bypassed.
 */
function evaluatePolicyExact(
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

/**
 * Full authorization eval: category registry gate **first**, then policy.
 * Disabled/unknown category → deny even if a rogue policy rule mentions it.
 */
export function evaluateAuthorization(
  policy: PolicyRegistry,
  categories: CategoryRegistry,
  request: {
    permission: string;
    dataCategory: string;
    action: string;
    organizationalScope: string;
  },
): "allow" | "deny" {
  if (!isCategoryGrantable(categories, request.dataCategory)) {
    return "deny";
  }
  return evaluatePolicyExact(policy, request);
}

/**
 * Project a row so unauthorized / disabled category keys are **absent**
 * (not masked as `0`, `null`, `"—"`, or redacted placeholders).
 *
 * **Map completeness contract:** keys absent from `fieldCategory` pass through
 * unchanged (ordinary / uncategorized fields). Callers must map every
 * sensitive field — an unmapped sensitive key will leak. Prefer exhaustive
 * maps (e.g. `Record<keyof Row, string>`) at each call site.
 *
 * `allowedCategories` alone is not enough: a category must also be
 * grantable in `categories` (registered + enabled). Disabled / unknown ids
 * in the allow set are ignored.
 *
 * API/response omit is authoritative in Story 2.2; profile DOM omit follows
 * the same rule when person profiles land (Story 5.2+ / UX OQ-3).
 */
export function omitUnauthorizedCategories<T extends Record<string, unknown>>(
  row: T,
  fieldCategory: Record<string, string>,
  allowedCategories: ReadonlySet<string>,
  categories: CategoryRegistry,
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(row) as (keyof T & string)[]) {
    const categoryId = fieldCategory[key];
    if (categoryId === undefined) {
      out[key] = row[key];
      continue;
    }
    if (
      allowedCategories.has(categoryId) &&
      isCategoryGrantable(categories, categoryId)
    ) {
      out[key] = row[key];
    }
  }
  return out;
}

export type AuditEnvelopeDeps = {
  pool: Pool;
  getPolicy: () => PolicyRegistry;
  /** Defaults to {@link loadCategoryRegistry} when omitted. */
  getCategories?: () => CategoryRegistry;
};

export type AuditEnvelope = {
  authorizeOrThrow: (input: AuthorizeInput) => Promise<AuthorizeResult>;
};

/**
 * Default-deny authorize API. Coarse role is context only — never an allow key.
 * Category registry gates before policy. Sensitive decisions append
 * `event_class=access` atomically with the outcome.
 */
export function createAuditEnvelope(deps: AuditEnvelopeDeps): AuditEnvelope {
  const getCategories = deps.getCategories ?? (() => loadCategoryRegistry());

  return {
    async authorizeOrThrow(input: AuthorizeInput): Promise<AuthorizeResult> {
      const sensitive = input.sensitive !== false;

      let decision: "allow" | "deny";
      try {
        decision = evaluateAuthorization(
          deps.getPolicy(),
          getCategories(),
          {
            permission: input.permission,
            dataCategory: input.dataCategory,
            action: input.action,
            organizationalScope: input.organizationalScope,
          },
        );
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
            payload: input.payload,
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
