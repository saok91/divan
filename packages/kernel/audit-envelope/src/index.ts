import { readFileSync } from "node:fs";

import {
  appendAccessEvent,
  withTransaction,
} from "@divan/event-store";
import {
  isFutureAsOf,
  parseDateOnly,
} from "@divan/temporal-engine";
import type { Pool } from "pg";

import {
  isCategoryGrantable,
  loadCategoryRegistry,
  type CategoryRegistry,
} from "./categories";
import {
  AuthorizationError,
  MSG_ACCESS_DENIED_FA,
} from "./authorization-error";

export {
  AuthorizationError,
  MSG_ACCESS_DENIED_FA,
  type AuthorizationErrorCode,
} from "./authorization-error";

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

export {
  DEMO_INFERENCE_BULK_HOOKS,
  DISABLED_INFERENCE_BULK_HOOKS,
  MSG_SUPPRESSED_COHORT_FA,
  clearInferenceBulkWindowsForTests,
  evaluateInferenceBulk,
  fingerprintAuthorizedSet,
  getInferenceBulkHooks,
  isIdentityRetrievalChannel,
  loadInferenceBulkHooks,
  newInferenceCorrelationId,
  recordInferenceBulkAccessEvent,
  setInferenceBulkHooksForTests,
  symmetricDifferenceSize,
  toGovernedRetrievalPayload,
  type GovernedRetrievalPayload,
  type InferenceBulkAccessOutcome,
  type InferenceBulkChannel,
  type InferenceBulkDecision,
  type InferenceBulkEvaluateInput,
  type InferenceBulkEvaluateResult,
  type InferenceBulkHooks,
  type QueryFingerprint,
  type RecordInferenceBulkAccessInput,
} from "./inference-bulk";

export type EvaluationMode = "current" | "as_of";

export type CoarseAuthzContext = {
  accountId: string;
  /** Navigation context only — never an implicit allow for sensitive categories. */
  coarseRole: string;
  /** Prisma OrganizationalScope ids the actor holds (active). */
  organizationalScopeIds: string[];
  /**
   * Stable scope codes/aliases (e.g. org:selfcheck) matching policy tokens.
   * Story 2.6: one identity space for demos — codes seed-aligned with policy.
   */
  organizationalScopeCodes?: string[];
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
  /**
   * Evaluation time semantics (Story 2.6 / FR-47). Default `current`.
   * `as_of` requires a valid date-only `asOfDate` (Asia/Tehran calendar day).
   */
  evaluationMode?: EvaluationMode;
  /** Date-only YYYY-MM-DD when evaluationMode is as_of. Timestamps → deny. */
  asOfDate?: string;
};

export type AuthorizeResult = {
  decisionId: string;
  /** Future as-of demos are planned, not Effective (AR-TEMPORAL). */
  resultSemantics?: "effective" | "planned";
  evaluationMode: EvaluationMode;
  asOfDate: string | null;
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

/**
 * Tiny local/dev fixture — proves default-deny + controlled allows.
 * Not the AR-ACCESS launch matrix. Coarse roles never appear as allow keys.
 *
 * Read ≠ export: `demo.sensitive_hr.read` allows read only; export on the same
 * (or related) tuple denies unless an explicit `action: "export"` rule exists.
 *
 * Scope tokens (`org:selfcheck`) must match OrganizationalScope.code bindings
 * (Story 2.6 membership). `org:any` is for access.administration only — actor
 * must still hold at least one active scope (no unbounded HR retrieval).
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
    {
      permission: "demo.retrieval.read",
      dataCategory: "demo.non_hr",
      action: "read",
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
    // Story 3.1 — Person identity (coarse role is never an allow key)
    {
      permission: "person.read",
      dataCategory: "identity.person",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "person.write",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 3.5 — Organization hierarchy (coarse role is never an allow key)
    {
      permission: "organization.read",
      dataCategory: "organization.unit",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "organization.write",
      dataCategory: "organization.unit",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 3.6 — Job reference concepts (FR-10)
    {
      permission: "job_reference.read",
      dataCategory: "organization.job_reference",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "job_reference.write",
      dataCategory: "organization.job_reference",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 4.12 — Headcount Approval lifecycle (FR-28)
    {
      permission: "headcount.approval.read",
      dataCategory: "organization.headcount_approval",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "headcount.approval.write",
      dataCategory: "organization.headcount_approval",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 4.13 — Exemption + match reselect (FR-29)
    {
      permission: "headcount.exemption.read",
      dataCategory: "organization.headcount_exemption",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "headcount.exemption.write",
      dataCategory: "organization.headcount_exemption",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "headcount.match.reselect",
      dataCategory: "organization.headcount_approval",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 4.14 — Override catalogue (FR-32)
    {
      permission: "headcount.override.read",
      dataCategory: "organization.headcount_override",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "headcount.override.write",
      dataCategory: "organization.headcount_override",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 6.2 — provisional migration SoD (AR-MIGRATION pending freeze)
    {
      permission: "migration.approve",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "migration.execute",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
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
 * Actor must hold the request scope (Story 2.6).
 * - `org:any`: access-admin wildcard — requires ≥1 active membership (not unbounded HR).
 * - otherwise: match by scope code alias OR by cuid id.
 */
export function actorHoldsOrganizationalScope(
  context: CoarseAuthzContext,
  requestScope: string,
): boolean {
  const scope = requestScope.trim();
  if (!scope) return false;

  const ids = context.organizationalScopeIds ?? [];
  const codes = context.organizationalScopeCodes ?? [];

  if (scope === "org:any") {
    return ids.length > 0;
  }

  if (codes.includes(scope)) return true;
  if (ids.includes(scope)) return true;
  return false;
}

export type EvaluationTimeResult =
  | {
      ok: true;
      evaluationMode: EvaluationMode;
      asOfDate: string | null;
      resultSemantics: "effective" | "planned";
    }
  | { ok: false; reason: string };

/**
 * Resolve evaluation mode / as-of. Invalid or ambiguous as-of → fail-closed.
 */
export function resolveEvaluationTime(input: {
  evaluationMode?: EvaluationMode;
  asOfDate?: string;
  now?: Date;
}): EvaluationTimeResult {
  const mode: EvaluationMode = input.evaluationMode ?? "current";
  const now = input.now ?? new Date();

  if (mode === "current") {
    if (input.asOfDate !== undefined && input.asOfDate.trim() !== "") {
      // Explicit asOf with current mode is ambiguous → deny
      return { ok: false, reason: "as_of_ambiguous_with_current" };
    }
    return {
      ok: true,
      evaluationMode: "current",
      asOfDate: null,
      resultSemantics: "effective",
    };
  }

  const parsed = parseDateOnly(input.asOfDate);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason };
  }

  const planned = isFutureAsOf(parsed.value, now);
  return {
    ok: true,
    evaluationMode: "as_of",
    asOfDate: parsed.value,
    resultSemantics: planned ? "planned" : "effective",
  };
}

/**
 * Full authorization eval: category registry gate **first**, then policy.
 * Disabled/unknown category → deny even if a rogue policy rule mentions it.
 * Does **not** check membership — use {@link evaluateAuthorizationWithMembership}.
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
 * Policy + membership. Prefer this for Story 2.6+ paths.
 */
export function evaluateAuthorizationWithMembership(
  policy: PolicyRegistry,
  categories: CategoryRegistry,
  request: {
    permission: string;
    dataCategory: string;
    action: string;
    organizationalScope: string;
  },
  context: CoarseAuthzContext,
): "allow" | "deny" {
  if (evaluateAuthorization(policy, categories, request) === "deny") {
    return "deny";
  }
  return actorHoldsOrganizationalScope(context, request.organizationalScope)
    ? "allow"
    : "deny";
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
 * Category registry gates before policy. Membership is mandatory (Story 2.6).
 * Evaluation time / as-of validated fail-closed. Sensitive decisions append
 * `event_class=access` atomically with the outcome.
 */
export function createAuditEnvelope(deps: AuditEnvelopeDeps): AuditEnvelope {
  const getCategories = deps.getCategories ?? (() => loadCategoryRegistry());

  return {
    async authorizeOrThrow(input: AuthorizeInput): Promise<AuthorizeResult> {
      const sensitive = input.sensitive !== false;

      const time = resolveEvaluationTime({
        evaluationMode: input.evaluationMode,
        asOfDate: input.asOfDate,
      });

      let decision: "allow" | "deny" = "deny";
      let denyReason: string | null = null;

      try {
        if (!time.ok) {
          decision = "deny";
          denyReason = time.reason;
        } else {
          const policyDecision = evaluateAuthorization(
            deps.getPolicy(),
            getCategories(),
            {
              permission: input.permission,
              dataCategory: input.dataCategory,
              action: input.action,
              organizationalScope: input.organizationalScope,
            },
          );
          if (policyDecision === "deny") {
            decision = "deny";
            denyReason = "default_deny_or_no_matching_rule";
          } else if (
            !actorHoldsOrganizationalScope(
              input.context,
              input.organizationalScope,
            )
          ) {
            decision = "deny";
            denyReason = "scope_membership_missing";
          } else {
            decision = "allow";
          }
        }
      } catch {
        throw new AuthorizationError(
          "FORBIDDEN",
          MSG_ACCESS_DENIED_FA,
          input.correlationId,
          null,
          "authz_dependency_failed",
        );
      }

      const evaluationMode: EvaluationMode = time.ok
        ? time.evaluationMode
        : (input.evaluationMode ?? "current");
      const asOfDate = time.ok ? time.asOfDate : null;
      const resultSemantics = time.ok ? time.resultSemantics : "effective";

      const scope = {
        permission: input.permission,
        dataCategory: input.dataCategory,
        action: input.action,
        organizationalScope: input.organizationalScope,
        actorCoarseRole: input.context.coarseRole,
        actorOrganizationalScopeIds: input.context.organizationalScopeIds,
        actorOrganizationalScopeCodes:
          input.context.organizationalScopeCodes ?? [],
        evaluationMode,
        asOfDate,
        resultSemantics,
      };

      const eventPayload = {
        ...input.payload,
        ...(denyReason ? { denyReason } : {}),
        evaluationMode,
        asOfDate,
        resultSemantics,
      };

      if (!sensitive) {
        if (decision === "deny") {
          throw new AuthorizationError(
            "FORBIDDEN",
            MSG_ACCESS_DENIED_FA,
            input.correlationId,
            null,
            denyReason,
          );
        }
        return {
          decisionId: input.correlationId,
          evaluationMode,
          asOfDate,
          resultSemantics,
        };
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
                ? (denyReason ?? "default_deny_or_no_matching_rule")
                : "explicit_allow_rule",
            payload: eventPayload,
          });
          return id;
        });
      } catch (err) {
        if (err instanceof AuthorizationError) throw err;
        throw new AuthorizationError(
          "AUDIT_APPEND_FAILED",
          MSG_ACCESS_DENIED_FA,
          input.correlationId,
          null,
          "audit_append_failed",
        );
      }

      if (decision === "deny") {
        throw new AuthorizationError(
          "FORBIDDEN",
          MSG_ACCESS_DENIED_FA,
          input.correlationId,
          decisionId,
          denyReason,
        );
      }

      return {
        decisionId,
        evaluationMode,
        asOfDate,
        resultSemantics,
      };
    },
  };
}
