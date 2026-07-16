/**
 * Entitlement grant lifecycle (Story 2.4 / FR-46 + Story 2.5 break-glass).
 *
 * State machine (pure + Prisma projection):
 *   requested → approved → active → (expired | revoked | suspended)
 *   requested → rejected (waive)
 *   suspended → active (via recertify)
 *
 * `break_glass` specializes this machine (incident/purpose/required expiresAt /
 * post-use review) via `./break-glass` — not a parallel privilege system.
 * Ordinary `standard` assign must not become “break-glass without review”.
 *
 * Configurable hooks (AR-ACCESS owns production values):
 *   - kinds requiring independent approval (empty/missing → fail-closed for those kinds)
 *   - overdue recertification action: suspend | revoke (default suspend — never leave active)
 *
 * Effective bindings stay on AccountAccessRole / AccountOrganizationalScope.
 * Activation applies bindings; revoke/expire/suspend withdraws them when no
 * other active grant still requires the same binding.
 *
 * Direct createAccessRole / createOrganizationalScope / mass assign are gated
 * in access-admin.ts — use requestGrant → approve → activate instead.
 */
import type {
  EntitlementGrant,
  EntitlementGrantKind,
  EntitlementGrantStatus,
  Prisma,
  PrismaClient,
} from "@divan/db";

import { randomUUID } from "node:crypto";

import { createPgPool } from "@divan/db";
import { appendAccessEvent } from "@divan/event-store";

import {
  ACCESS_ADMINISTRATION_PERMISSION,
  AccessAdminError,
  MSG_LIFECYCLE_APPROVAL_REQUIRED_FA,
  assertToxicCombinationAllowed,
  createAccessRole,
  createOrganizationalScope,
  type AccessAdminActor,
  type MutateResult,
  type Snapshot,
} from "./access-admin";
import { getIdentityDb } from "./db";

export { MSG_LIFECYCLE_APPROVAL_REQUIRED_FA };

export const MSG_GRANT_SELF_REQUEST_FA =
  "درخواست دسترسی حساس برای خودتان مجاز نیست.";

export const MSG_GRANT_NOT_FOUND_FA = "درخواست دسترسی یافت نشد.";

export const MSG_GRANT_INVALID_TRANSITION_FA =
  "انتقال وضعیت این درخواست مجاز نیست.";

export const MSG_GRANT_INDEPENDENT_APPROVER_FA =
  "تأیید باید توسط بازیگر مستقل انجام شود.";

export const MSG_TOXIC_OWN_GRANT_FA =
  "لغو یا تأیید دسترسی خودتان مجاز نیست.";

export type GrantKind = EntitlementGrantKind;
export type GrantStatus = EntitlementGrantStatus;

export type RecertOverdueAction = "suspend" | "revoke";

/**
 * Demo/dev lifecycle hooks. Empty approval-kind list fails closed for
 * elevated kinds (treated as requiring approval). AR-ACCESS replaces values.
 */
export type EntitlementLifecycleHooks = {
  /** Kinds that require requester ≠ approver ≠ subject. */
  kindsRequiringIndependentApproval: readonly GrantKind[];
  /** Fail-safe when recertifyBy < now and status is active. */
  overdueRecertificationAction: RecertOverdueAction;
  /**
   * Demo finite “revocation objective”: enforcement is on the next protected
   * action (governed entry / session freshness) — not a production SLA number.
   */
  enforceOnNextProtectedAction: true;
};

const DEFAULT_APPROVAL_KINDS: readonly GrantKind[] = Object.freeze([
  "sensitive",
  "global",
  "bulk",
  "mass_assignment",
  "role_create",
  "scope_create",
  "break_glass",
]);

let lifecycleHooks: EntitlementLifecycleHooks = {
  kindsRequiringIndependentApproval: DEFAULT_APPROVAL_KINDS,
  overdueRecertificationAction: "suspend",
  enforceOnNextProtectedAction: true,
};

export function getEntitlementLifecycleHooks(): EntitlementLifecycleHooks {
  return lifecycleHooks;
}

/** Test/selfcheck hook only. Pass null to restore defaults. */
export function setEntitlementLifecycleHooksForTests(
  hooks: Partial<EntitlementLifecycleHooks> | null,
): void {
  if (hooks === null) {
    lifecycleHooks = {
      kindsRequiringIndependentApproval: DEFAULT_APPROVAL_KINDS,
      overdueRecertificationAction: "suspend",
      enforceOnNextProtectedAction: true,
    };
    return;
  }
  lifecycleHooks = {
    kindsRequiringIndependentApproval:
      hooks.kindsRequiringIndependentApproval ??
      lifecycleHooks.kindsRequiringIndependentApproval,
    overdueRecertificationAction:
      hooks.overdueRecertificationAction ??
      lifecycleHooks.overdueRecertificationAction,
    enforceOnNextProtectedAction: true,
  };
}

export function kindRequiresIndependentApproval(kind: GrantKind): boolean {
  // Elevated kinds always require independent approval (fail-closed), even when
  // a non-empty configured list omits them. `standard` only if explicitly listed.
  if (kind !== "standard" && DEFAULT_APPROVAL_KINDS.includes(kind)) {
    return true;
  }
  const list = lifecycleHooks.kindsRequiringIndependentApproval;
  if (list.length === 0) {
    return kind !== "standard";
  }
  return list.includes(kind);
}

export type GrantCreatePayload = {
  roleCode?: string;
  roleLabelFa?: string;
  permissionSetId?: string;
  scopeLabelFa?: string;
  scopeActive?: boolean;
  /** Set on activate: true when this grant created the role join (withdraw only then). */
  appliedRoleBinding?: boolean;
  /** Set on activate: true when this grant created the scope join (withdraw only then). */
  appliedScopeBinding?: boolean;
};

export type RequestGrantInput = {
  subjectAccountId: string;
  kind: GrantKind;
  accessRoleId?: string | null;
  organizationalScopeId?: string | null;
  createPayload?: GrantCreatePayload | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  /** Optional initial recert due; usually set on activate. */
  recertifyBy?: Date | null;
  /** Default recert window after activate when not provided (ms). Demo: 30d. */
  recertWindowMs?: number;
  /** Break-glass: incident / ticket reference (required when kind=break_glass). */
  incidentId?: string | null;
  /** Break-glass: attributable purpose — no HR field values. */
  purpose?: string | null;
  exceptionalExportApproved?: boolean;
  exceptionalPermissionAdminApproved?: boolean;
};

export type GrantView = {
  id: string;
  subjectAccountId: string;
  requesterAccountId: string;
  approverAccountId: string | null;
  kind: GrantKind;
  status: GrantStatus;
  accessRoleId: string | null;
  organizationalScopeId: string | null;
  createPayload: GrantCreatePayload | null;
  startsAt: string | null;
  expiresAt: string | null;
  recertifyBy: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  correlationId: string | null;
  incidentId: string | null;
  purpose: string | null;
  postUseReviewStatus: "pending" | "completed" | "not_required";
  postUseReviewedAt: string | null;
  postUseReviewerAccountId: string | null;
  exceptionalExportApproved: boolean;
  exceptionalPermissionAdminApproved: boolean;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_RECERT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function parseCreatePayload(
  raw: Prisma.JsonValue | null | undefined,
): GrantCreatePayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as GrantCreatePayload;
}

export function grantSnapshot(row: EntitlementGrant): Snapshot {
  return {
    id: row.id,
    subjectAccountId: row.subjectAccountId,
    requesterAccountId: row.requesterAccountId,
    approverAccountId: row.approverAccountId,
    kind: row.kind,
    status: row.status,
    accessRoleId: row.accessRoleId,
    organizationalScopeId: row.organizationalScopeId,
    createPayload: parseCreatePayload(row.createPayload),
    startsAt: toIso(row.startsAt),
    expiresAt: toIso(row.expiresAt),
    recertifyBy: toIso(row.recertifyBy),
    revokedAt: toIso(row.revokedAt),
    revokeReason: row.revokeReason,
    correlationId: row.correlationId,
    incidentId: row.incidentId,
    purpose: row.purpose,
    postUseReviewStatus: row.postUseReviewStatus,
    postUseReviewedAt: toIso(row.postUseReviewedAt),
    postUseReviewerAccountId: row.postUseReviewerAccountId,
    exceptionalExportApproved: row.exceptionalExportApproved,
    exceptionalPermissionAdminApproved: row.exceptionalPermissionAdminApproved,
  };
}

export function toGrantView(row: EntitlementGrant): GrantView {
  return {
    id: row.id,
    subjectAccountId: row.subjectAccountId,
    requesterAccountId: row.requesterAccountId,
    approverAccountId: row.approverAccountId,
    kind: row.kind,
    status: row.status,
    accessRoleId: row.accessRoleId,
    organizationalScopeId: row.organizationalScopeId,
    createPayload: parseCreatePayload(row.createPayload),
    startsAt: toIso(row.startsAt),
    expiresAt: toIso(row.expiresAt),
    recertifyBy: toIso(row.recertifyBy),
    revokedAt: toIso(row.revokedAt),
    revokeReason: row.revokeReason,
    correlationId: row.correlationId,
    incidentId: row.incidentId,
    purpose: row.purpose,
    postUseReviewStatus: row.postUseReviewStatus,
    postUseReviewedAt: toIso(row.postUseReviewedAt),
    postUseReviewerAccountId: row.postUseReviewerAccountId,
    exceptionalExportApproved: row.exceptionalExportApproved,
    exceptionalPermissionAdminApproved: row.exceptionalPermissionAdminApproved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireAccount(
  accountId: string,
  db: PrismaClient,
  opts: { requireActive?: boolean } = {},
): Promise<void> {
  const row = await db.internalAccount.findUnique({
    where: { id: accountId },
    select: { id: true, status: true },
  });
  if (!row) {
    throw new AccessAdminError("NOT_FOUND", "حساب یافت نشد.");
  }
  if (opts.requireActive !== false && row.status !== "active") {
    throw new AccessAdminError(
      "VALIDATION",
      "حساب موضوع باید فعال باشد.",
    );
  }
}

let failSafeEvidencePool: ReturnType<typeof createPgPool> | null = null;

function getFailSafeEvidencePool() {
  if (failSafeEvidencePool) return failSafeEvidencePool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  failSafeEvidencePool = createPgPool(url);
  return failSafeEvidencePool;
}

async function emitLifecycleTransitionEvidence(
  results: MutateResult<GrantView>[],
  operation: string,
): Promise<void> {
  if (!results.length) return;
  const pool = getFailSafeEvidencePool();
  if (!pool) {
    console.error(
      "[entitlement-lifecycle] skip fail-safe evidence: DATABASE_URL missing",
    );
    return;
  }
  for (const result of results) {
    try {
      const kind = String(result.after.kind ?? "");
      const op =
        operation === "grant.expire" && kind === "break_glass"
          ? "grant.break_glass.expire"
          : operation === "grant.revoke" && kind === "break_glass"
            ? "grant.break_glass.revoke"
            : operation;
      await appendAccessEvent(pool, {
        correlationId: randomUUID(),
        actorAccountId: null,
        operation: op,
        entityType: "EntitlementGrant",
        entityId: String(result.after.id ?? ""),
        scope: {
          permission: ACCESS_ADMINISTRATION_PERMISSION,
          dataCategory: "identity.access_admin",
          action: "write",
          organizationalScope: "org:any",
        },
        result: "allow",
        reason: "entitlement_lifecycle_fail_safe",
        payload: { before: result.before, after: result.after },
      });
    } catch (err) {
      // Privilege removal already applied — keep fail-closed; log evidence gap.
      console.error(
        "[entitlement-lifecycle] fail-safe evidence append failed",
        operation,
        err,
      );
    }
  }
}

/**
 * Request a grant. Toxic: cannot request elevated kinds for self.
 * Break-glass always requires incidentId, purpose, expiresAt (see break-glass.ts).
 */
export async function requestGrant(
  input: RequestGrantInput,
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<GrantView>> {
  assertToxicCombinationAllowed({
    actorAccountId: actor.accountId,
    subjectAccountId: input.subjectAccountId,
    operation:
      input.kind === "break_glass"
        ? "grant.break_glass.request"
        : "grant.request",
  });

  if (input.kind === "break_glass") {
    const { validateBreakGlassRequestInput } = await import("./break-glass");
    await validateBreakGlassRequestInput(input, actor, db);
  } else if (
    kindRequiresIndependentApproval(input.kind) &&
    actor.accountId === input.subjectAccountId &&
    input.kind !== "role_create" &&
    input.kind !== "scope_create"
  ) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_GRANT_SELF_REQUEST_FA,
      "grant_self_request_blocked",
    );
  }

  await requireAccount(input.subjectAccountId, db);
  await requireAccount(actor.accountId, db);

  const now = new Date();
  if (input.expiresAt && input.expiresAt <= now) {
    throw new AccessAdminError(
      "VALIDATION",
      "تاریخ انقضا باید در آینده باشد.",
    );
  }
  if (
    input.startsAt &&
    input.expiresAt &&
    input.expiresAt <= input.startsAt
  ) {
    throw new AccessAdminError(
      "VALIDATION",
      "تاریخ انقضا باید بعد از زمان شروع باشد.",
    );
  }

  if (input.kind === "role_create") {
    const p = input.createPayload;
    if (!p?.roleCode?.trim() || !p.roleLabelFa?.trim() || !p.permissionSetId?.trim()) {
      throw new AccessAdminError(
        "VALIDATION",
        "برای ایجاد نقش، کد، برچسب و مجموعهٔ مجوز الزامی است.",
      );
    }
    const set = await db.permissionSet.findUnique({
      where: { id: p.permissionSetId.trim() },
    });
    if (!set || !set.permissions.length) {
      throw new AccessAdminError(
        "VALIDATION",
        "مجموعهٔ مجوز نامعتبر یا خالی است.",
      );
    }
  } else if (input.kind === "scope_create") {
    if (!input.createPayload?.scopeLabelFa?.trim()) {
      throw new AccessAdminError(
        "VALIDATION",
        "برای ایجاد محدوده، برچسب الزامی است.",
      );
    }
  } else if (
    input.kind !== "standard" &&
    !input.accessRoleId &&
    !input.organizationalScopeId
  ) {
    // elevated binding grants need a target
    throw new AccessAdminError(
      "VALIDATION",
      "نقش یا محدودهٔ هدف برای این درخواست الزامی است.",
    );
  }

  if (input.accessRoleId) {
    const role = await db.accessRole.findUnique({
      where: { id: input.accessRoleId },
      include: { permissionSet: true },
    });
    if (!role) {
      throw new AccessAdminError("VALIDATION", "نقش نامعتبر است.");
    }
    if (input.kind !== "break_glass") {
      const {
        isBreakGlassElevationRoleCode,
        MSG_BREAK_GLASS_ROLE_LIFECYCLE_ONLY_FA,
      } = await import("./break-glass");
      if (isBreakGlassElevationRoleCode(role.code)) {
        throw new AccessAdminError(
          "VALIDATION",
          MSG_BREAK_GLASS_ROLE_LIFECYCLE_ONLY_FA,
          "break_glass_role_lifecycle_only",
        );
      }
    }
    const perms = role.permissionSet?.permissions ?? [];
    if (
      perms.includes(ACCESS_ADMINISTRATION_PERMISSION) &&
      !kindRequiresIndependentApproval(input.kind)
    ) {
      throw new AccessAdminError(
        "VALIDATION",
        MSG_LIFECYCLE_APPROVAL_REQUIRED_FA,
        "privileged_role_requires_lifecycle",
      );
    }
  }
  if (input.organizationalScopeId) {
    const scope = await db.organizationalScope.findUnique({
      where: { id: input.organizationalScopeId },
    });
    if (!scope || !scope.active) {
      throw new AccessAdminError("VALIDATION", "محدوده نامعتبر یا غیرفعال است.");
    }
  }

  const created = await db.entitlementGrant.create({
    data: {
      subjectAccountId: input.subjectAccountId,
      requesterAccountId: actor.accountId,
      kind: input.kind,
      status: "requested",
      accessRoleId: input.accessRoleId ?? null,
      organizationalScopeId: input.organizationalScopeId ?? null,
      createPayload: (input.createPayload ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt ?? null,
      recertifyBy: input.recertifyBy ?? null,
      correlationId: actor.correlationId,
      incidentId:
        input.kind === "break_glass"
          ? (input.incidentId ?? "").trim() || null
          : null,
      purpose:
        input.kind === "break_glass"
          ? (input.purpose ?? "").trim() || null
          : null,
      postUseReviewStatus:
        input.kind === "break_glass" ? "pending" : "not_required",
      exceptionalExportApproved:
        input.kind === "break_glass"
          ? input.exceptionalExportApproved === true
          : false,
      exceptionalPermissionAdminApproved:
        input.kind === "break_glass"
          ? input.exceptionalPermissionAdminApproved === true
          : false,
    },
  });

  const after = grantSnapshot(created);
  return { entity: toGrantView(created), before: null, after };
}

/**
 * Independent approve. Replaces Story 2.3 previewApproveGrant for real grants.
 * Approver ≠ requester; approver ≠ subject; admin+same-grant → toxic flag.
 */
export async function approveGrant(
  input: {
    grantId: string;
    combinesPermissionAdminWithSameGrantApproval?: boolean;
  },
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<GrantView>> {
  const grant = await db.entitlementGrant.findUnique({
    where: { id: input.grantId },
  });
  if (!grant) {
    throw new AccessAdminError("NOT_FOUND", MSG_GRANT_NOT_FOUND_FA);
  }
  if (grant.status !== "requested") {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_GRANT_INVALID_TRANSITION_FA,
    );
  }

  const needsIndependent = kindRequiresIndependentApproval(grant.kind);
  if (needsIndependent) {
    if (
      actor.accountId === grant.requesterAccountId ||
      actor.accountId === grant.subjectAccountId
    ) {
      throw new AccessAdminError(
        "TOXIC_COMBINATION",
        MSG_GRANT_INDEPENDENT_APPROVER_FA,
        "grant_independent_approver_required",
      );
    }
  }

  const combines =
    input.combinesPermissionAdminWithSameGrantApproval === true ||
    (needsIndependent && actor.accountId === grant.requesterAccountId);

  assertToxicCombinationAllowed({
    actorAccountId: actor.accountId,
    subjectAccountId: grant.subjectAccountId,
    operation:
      grant.kind === "break_glass"
        ? "grant.break_glass.approve"
        : "grant.approve",
    combinesPermissionAdminWithSameGrantApproval: combines,
  });

  const before = grantSnapshot(grant);
  const updated = await db.entitlementGrant.update({
    where: { id: grant.id },
    data: {
      status: "approved",
      approverAccountId: actor.accountId,
      correlationId: actor.correlationId,
    },
  });

  return {
    entity: toGrantView(updated),
    before,
    after: grantSnapshot(updated),
  };
}

/**
 * Waive / reject a requested grant. Cannot waive own grant (subject or requester
 * when elevated).
 */
export async function waiveGrant(
  input: { grantId: string; reason?: string },
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<GrantView>> {
  const grant = await db.entitlementGrant.findUnique({
    where: { id: input.grantId },
  });
  if (!grant) {
    throw new AccessAdminError("NOT_FOUND", MSG_GRANT_NOT_FOUND_FA);
  }
  if (grant.status !== "requested" && grant.status !== "approved") {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_GRANT_INVALID_TRANSITION_FA,
    );
  }

  assertToxicCombinationAllowed({
    actorAccountId: actor.accountId,
    subjectAccountId: grant.subjectAccountId,
    operation: "grant.waive",
  });

  if (
    kindRequiresIndependentApproval(grant.kind) &&
    (actor.accountId === grant.subjectAccountId ||
      actor.accountId === grant.requesterAccountId)
  ) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_TOXIC_OWN_GRANT_FA,
      "grant_self_waive_blocked",
    );
  }

  const before = grantSnapshot(grant);
  const updated = await db.entitlementGrant.update({
    where: { id: grant.id },
    data: {
      status: "rejected",
      revokeReason: input.reason?.trim() || null,
      revokedAt: new Date(),
      correlationId: actor.correlationId,
    },
  });

  return {
    entity: toGrantView(updated),
    before,
    after: grantSnapshot(updated),
  };
}

async function applyRoleBinding(
  accountId: string,
  accessRoleId: string,
  db: PrismaClient,
): Promise<void> {
  await db.accountAccessRole.upsert({
    where: {
      accountId_accessRoleId: { accountId, accessRoleId },
    },
    create: { accountId, accessRoleId },
    update: {},
  });
}

async function applyScopeBinding(
  accountId: string,
  organizationalScopeId: string,
  db: PrismaClient,
): Promise<void> {
  await db.accountOrganizationalScope.upsert({
    where: {
      accountId_organizationalScopeId: {
        accountId,
        organizationalScopeId,
      },
    },
    create: { accountId, organizationalScopeId },
    update: {},
  });
}

async function otherActiveGrantNeedsRole(
  excludeGrantId: string,
  accountId: string,
  accessRoleId: string,
  db: PrismaClient,
): Promise<boolean> {
  const count = await db.entitlementGrant.count({
    where: {
      id: { not: excludeGrantId },
      subjectAccountId: accountId,
      accessRoleId,
      status: "active",
    },
  });
  return count > 0;
}

async function otherActiveGrantNeedsScope(
  excludeGrantId: string,
  accountId: string,
  organizationalScopeId: string,
  db: PrismaClient,
): Promise<boolean> {
  const count = await db.entitlementGrant.count({
    where: {
      id: { not: excludeGrantId },
      subjectAccountId: accountId,
      organizationalScopeId,
      status: "active",
    },
  });
  return count > 0;
}

async function withdrawGrantBindings(
  grant: EntitlementGrant,
  db: PrismaClient,
): Promise<void> {
  const payload = parseCreatePayload(grant.createPayload);
  // Break-glass always withdraws its elevation role (review decision: force withdraw).
  // Other kinds: only remove joins this grant applied. Legacy (flags unset) keep
  // prior withdraw behavior. Explicit false preserves pre-lifecycle bindings.
  const forceBreakGlassWithdraw = grant.kind === "break_glass";
  const mayWithdrawRole =
    forceBreakGlassWithdraw || payload?.appliedRoleBinding !== false;
  const mayWithdrawScope = payload?.appliedScopeBinding !== false;

  if (grant.accessRoleId && mayWithdrawRole) {
    // When flag is true, this grant owns the join — withdraw unless another
    // active grant still needs it. When unset (legacy), same as true.
    // Break-glass always owns its elevation role for withdraw purposes.
    if (
      forceBreakGlassWithdraw ||
      payload?.appliedRoleBinding === true ||
      payload?.appliedRoleBinding === undefined
    ) {
      const keep = await otherActiveGrantNeedsRole(
        grant.id,
        grant.subjectAccountId,
        grant.accessRoleId,
        db,
      );
      if (!keep) {
        await db.accountAccessRole.deleteMany({
          where: {
            accountId: grant.subjectAccountId,
            accessRoleId: grant.accessRoleId,
          },
        });
      }
    }
  }
  if (grant.organizationalScopeId && mayWithdrawScope) {
    if (
      payload?.appliedScopeBinding === true ||
      payload?.appliedScopeBinding === undefined
    ) {
      const keep = await otherActiveGrantNeedsScope(
        grant.id,
        grant.subjectAccountId,
        grant.organizationalScopeId,
        db,
      );
      if (!keep) {
        await db.accountOrganizationalScope.deleteMany({
          where: {
            accountId: grant.subjectAccountId,
            organizationalScopeId: grant.organizationalScopeId,
          },
        });
      }
    }
  }
}

/**
 * Activate an approved grant (or standard requested that skips approval).
 * role_create / scope_create are catalog-only (no subject bind).
 * Binding grants apply AccountAccessRole / scope joins.
 */
export async function activateGrant(
  input: {
    grantId: string;
    /** Override recert due; otherwise startsAt/now + window. */
    recertifyBy?: Date | null;
    recertWindowMs?: number;
  },
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<GrantView>> {
  const grant = await db.entitlementGrant.findUnique({
    where: { id: input.grantId },
  });
  if (!grant) {
    throw new AccessAdminError("NOT_FOUND", MSG_GRANT_NOT_FOUND_FA);
  }

  const needsApproval = kindRequiresIndependentApproval(grant.kind);
  const canActivate =
    grant.status === "approved" ||
    (!needsApproval && grant.status === "requested");
  if (!canActivate) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_GRANT_INVALID_TRANSITION_FA,
    );
  }

  assertToxicCombinationAllowed({
    actorAccountId: actor.accountId,
    // role/scope create subjects are catalog owners — self-activate after
    // independent approval is allowed; binding grants remain self-toxic.
    subjectAccountId:
      grant.kind === "role_create" || grant.kind === "scope_create"
        ? undefined
        : grant.subjectAccountId,
    operation:
      grant.kind === "break_glass"
        ? "grant.break_glass.activate"
        : "grant.activate",
  });

  if (
    needsApproval &&
    actor.accountId === grant.subjectAccountId &&
    grant.kind !== "role_create" &&
    grant.kind !== "scope_create"
  ) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_TOXIC_OWN_GRANT_FA,
      "grant_self_activate_blocked",
    );
  }

  const now = new Date();
  if (grant.startsAt && grant.startsAt > now) {
    throw new AccessAdminError(
      "VALIDATION",
      "زمان شروع این دسترسی هنوز نرسیده است.",
    );
  }
  if (grant.expiresAt && grant.expiresAt <= now) {
    throw new AccessAdminError(
      "VALIDATION",
      "این درخواست منقضی شده و قابل فعال‌سازی نیست.",
    );
  }

  if (grant.kind === "break_glass") {
    const { assertBreakGlassActivationAllowed } = await import("./break-glass");
    await assertBreakGlassActivationAllowed(grant, db);
  }

  const before = grantSnapshot(grant);
  const expectedStatus = grant.status;
  const payload = parseCreatePayload(grant.createPayload);
  const catalogOnly =
    grant.kind === "role_create" || grant.kind === "scope_create";

  const updated = await db.$transaction(async (tx) => {
    let accessRoleId = grant.accessRoleId;
    let organizationalScopeId = grant.organizationalScopeId;
    let appliedRoleBinding = false;
    let appliedScopeBinding = false;

    if (grant.kind === "role_create") {
      if (!payload?.roleCode || !payload.roleLabelFa || !payload.permissionSetId) {
        throw new AccessAdminError(
          "VALIDATION",
          "پارامترهای ایجاد نقش ناقص است.",
        );
      }
      const createdRole = await createAccessRole(
        {
          code: payload.roleCode,
          labelFa: payload.roleLabelFa,
          permissionSetId: payload.permissionSetId,
          viaLifecycleActivation: true,
        },
        actor,
        tx as PrismaClient,
      );
      accessRoleId = createdRole.entity.id;
    } else if (grant.kind === "scope_create") {
      if (!payload?.scopeLabelFa) {
        throw new AccessAdminError(
          "VALIDATION",
          "پارامترهای ایجاد محدوده ناقص است.",
        );
      }
      const createdScope = await createOrganizationalScope(
        {
          labelFa: payload.scopeLabelFa,
          active: payload.scopeActive !== false,
          viaLifecycleActivation: true,
        },
        actor,
        tx as PrismaClient,
      );
      organizationalScopeId = createdScope.entity.id;
    }

    if (!catalogOnly && accessRoleId) {
      const role = await tx.accessRole.findUnique({
        where: { id: accessRoleId },
      });
      if (!role) {
        throw new AccessAdminError("VALIDATION", "نقش نامعتبر است.");
      }
      const preexisting = await tx.accountAccessRole.findUnique({
        where: {
          accountId_accessRoleId: {
            accountId: grant.subjectAccountId,
            accessRoleId,
          },
        },
      });
      if (!preexisting) {
        await applyRoleBinding(grant.subjectAccountId, accessRoleId, tx as PrismaClient);
        appliedRoleBinding = true;
      } else if (grant.kind === "break_glass") {
        // Decision (code review): claim ownership so expire/revoke always withdraws.
        appliedRoleBinding = true;
      }
    }
    if (!catalogOnly && organizationalScopeId) {
      const scope = await tx.organizationalScope.findUnique({
        where: { id: organizationalScopeId },
      });
      if (!scope || !scope.active) {
        throw new AccessAdminError(
          "VALIDATION",
          "محدوده نامعتبر یا غیرفعال است.",
        );
      }
      const preexisting = await tx.accountOrganizationalScope.findUnique({
        where: {
          accountId_organizationalScopeId: {
            accountId: grant.subjectAccountId,
            organizationalScopeId,
          },
        },
      });
      if (!preexisting) {
        await applyScopeBinding(
          grant.subjectAccountId,
          organizationalScopeId,
          tx as PrismaClient,
        );
        appliedScopeBinding = true;
      }
    }

    const windowMs = input.recertWindowMs ?? DEFAULT_RECERT_WINDOW_MS;
    const recertifyBy =
      input.recertifyBy !== undefined
        ? input.recertifyBy
        : grant.recertifyBy ?? new Date(now.getTime() + windowMs);

    const nextPayload: GrantCreatePayload = {
      ...(payload ?? {}),
      appliedRoleBinding: catalogOnly ? false : appliedRoleBinding,
      appliedScopeBinding: catalogOnly ? false : appliedScopeBinding,
    };

    const claimed = await tx.entitlementGrant.updateMany({
      where: { id: grant.id, status: expectedStatus },
      data: {
        status: "active",
        accessRoleId,
        organizationalScopeId,
        startsAt: grant.startsAt ?? now,
        recertifyBy,
        correlationId: actor.correlationId,
        approverAccountId: grant.approverAccountId ?? actor.accountId,
        createPayload: nextPayload as Prisma.InputJsonValue,
      },
    });
    if (claimed.count !== 1) {
      throw new AccessAdminError(
        "CONFLICT",
        MSG_GRANT_INVALID_TRANSITION_FA,
        "grant_activate_race",
      );
    }

    return tx.entitlementGrant.findUniqueOrThrow({ where: { id: grant.id } });
  });

  return {
    entity: toGrantView(updated),
    before,
    after: grantSnapshot(updated),
  };
}

/**
 * Best-effort FR-51 compensate after activate evidence failure.
 * Withdraws bindings this grant applied; deletes catalog rows for create kinds.
 */
export async function compensateActivateGrant(
  result: MutateResult<GrantView>,
  db: PrismaClient = getIdentityDb(),
): Promise<void> {
  const id = String(result.after.id ?? "");
  const beforeStatus = result.before?.status as GrantStatus | undefined;
  if (!id || !beforeStatus) return;

  const grant = await db.entitlementGrant.findUnique({ where: { id } });
  if (!grant) return;

  if (grant.kind !== "role_create" && grant.kind !== "scope_create") {
    await withdrawGrantBindings(grant, db);
  }

  if (grant.kind === "role_create" && grant.accessRoleId) {
    await db.accountAccessRole.deleteMany({
      where: { accessRoleId: grant.accessRoleId },
    });
    await db.accessRole
      .delete({ where: { id: grant.accessRoleId } })
      .catch(() => undefined);
  }
  if (grant.kind === "scope_create" && grant.organizationalScopeId) {
    await db.accountOrganizationalScope.deleteMany({
      where: { organizationalScopeId: grant.organizationalScopeId },
    });
    await db.organizationalScope
      .delete({ where: { id: grant.organizationalScopeId } })
      .catch(() => undefined);
  }

  await db.entitlementGrant.update({
    where: { id },
    data: {
      status: beforeStatus,
      accessRoleId: (result.before?.accessRoleId as string | null) ?? null,
      organizationalScopeId:
        (result.before?.organizationalScopeId as string | null) ?? null,
      createPayload: (result.before?.createPayload ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });
}

export async function revokeGrant(
  input: { grantId: string; reason?: string },
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<GrantView>> {
  const grant = await db.entitlementGrant.findUnique({
    where: { id: input.grantId },
  });
  if (!grant) {
    throw new AccessAdminError("NOT_FOUND", MSG_GRANT_NOT_FOUND_FA);
  }
  if (
    grant.status !== "active" &&
    grant.status !== "approved" &&
    grant.status !== "suspended"
  ) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_GRANT_INVALID_TRANSITION_FA,
    );
  }

  const before = grantSnapshot(grant);
  if (grant.status === "active" || grant.status === "suspended") {
    await withdrawGrantBindings(grant, db);
  }

  const updated = await db.entitlementGrant.update({
    where: { id: grant.id },
    data: {
      status: "revoked",
      revokedAt: new Date(),
      revokeReason: input.reason?.trim() || null,
      correlationId: actor.correlationId,
    },
  });

  return {
    entity: toGrantView(updated),
    before,
    after: grantSnapshot(updated),
  };
}

/**
 * Independent recertification — advances recertifyBy; restores suspended → active.
 */
export async function recertifyGrant(
  input: {
    grantId: string;
    recertifyBy?: Date;
    recertWindowMs?: number;
  },
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<GrantView>> {
  const grant = await db.entitlementGrant.findUnique({
    where: { id: input.grantId },
  });
  if (!grant) {
    throw new AccessAdminError("NOT_FOUND", MSG_GRANT_NOT_FOUND_FA);
  }
  if (grant.kind === "break_glass") {
    const { MSG_BREAK_GLASS_RECERTIFY_DENIED_FA } = await import("./break-glass");
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_RECERTIFY_DENIED_FA,
      "break_glass_recertify_denied",
    );
  }
  if (grant.status !== "active" && grant.status !== "suspended") {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_GRANT_INVALID_TRANSITION_FA,
    );
  }

  assertToxicCombinationAllowed({
    actorAccountId: actor.accountId,
    subjectAccountId: grant.subjectAccountId,
    operation: "grant.recertify",
  });

  if (actor.accountId === grant.subjectAccountId) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_TOXIC_OWN_GRANT_FA,
      "grant_self_recertify_blocked",
    );
  }

  if (
    kindRequiresIndependentApproval(grant.kind) &&
    actor.accountId === grant.requesterAccountId
  ) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_GRANT_INDEPENDENT_APPROVER_FA,
      "grant_requester_recertify_blocked",
    );
  }

  const before = grantSnapshot(grant);
  const now = new Date();
  if (grant.expiresAt && grant.expiresAt <= now) {
    throw new AccessAdminError(
      "VALIDATION",
      "این دسترسی منقضی شده و قابل بازتأیید نیست.",
    );
  }
  const windowMs = input.recertWindowMs ?? DEFAULT_RECERT_WINDOW_MS;
  const recertifyBy =
    input.recertifyBy ?? new Date(now.getTime() + windowMs);

  // Re-apply bindings if restoring from suspended
  if (grant.status === "suspended") {
    if (grant.accessRoleId) {
      await applyRoleBinding(
        grant.subjectAccountId,
        grant.accessRoleId,
        db,
      );
    }
    if (grant.organizationalScopeId) {
      await applyScopeBinding(
        grant.subjectAccountId,
        grant.organizationalScopeId,
        db,
      );
    }
  }

  const updated = await db.entitlementGrant.update({
    where: { id: grant.id },
    data: {
      status: "active",
      recertifyBy,
      correlationId: actor.correlationId,
    },
  });

  return {
    entity: toGrantView(updated),
    before,
    after: grantSnapshot(updated),
  };
}

export async function getGrant(
  grantId: string,
  db: PrismaClient = getIdentityDb(),
): Promise<GrantView | null> {
  const row = await db.entitlementGrant.findUnique({ where: { id: grantId } });
  return row ? toGrantView(row) : null;
}

export async function listGrants(
  filter: {
    status?: GrantStatus | GrantStatus[];
    subjectAccountId?: string;
  } = {},
  db: PrismaClient = getIdentityDb(),
): Promise<GrantView[]> {
  const statusFilter = filter.status
    ? Array.isArray(filter.status)
      ? { in: filter.status }
      : filter.status
    : undefined;
  const rows = await db.entitlementGrant.findMany({
    where: {
      status: statusFilter,
      subjectAccountId: filter.subjectAccountId,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toGrantView);
}

async function transitionFailSafe(
  grant: EntitlementGrant,
  next: "expired" | "suspended" | "revoked",
  reason: string,
  db: PrismaClient,
): Promise<MutateResult<GrantView> | null> {
  const before = grantSnapshot(grant);
  await withdrawGrantBindings(grant, db);
  const claimed = await db.entitlementGrant.updateMany({
    where: { id: grant.id, status: "active" },
    data: {
      status: next,
      revokedAt: next === "expired" ? null : new Date(),
      revokeReason: reason,
    },
  });
  if (claimed.count !== 1) {
    return null;
  }
  const updated = await db.entitlementGrant.findUniqueOrThrow({
    where: { id: grant.id },
  });
  return {
    entity: toGrantView(updated),
    before,
    after: grantSnapshot(updated),
  };
}

/**
 * Expire active grants past expiresAt. Returns mutated grants for evidence.
 */
export async function applyExpiryFailSafe(
  now: Date = new Date(),
  db: PrismaClient = getIdentityDb(),
  subjectAccountId?: string,
): Promise<MutateResult<GrantView>[]> {
  const due = await db.entitlementGrant.findMany({
    where: {
      status: "active",
      expiresAt: { lt: now },
      ...(subjectAccountId ? { subjectAccountId } : {}),
    },
  });
  const results: MutateResult<GrantView>[] = [];
  for (const grant of due) {
    const result = await transitionFailSafe(
      grant,
      "expired",
      "expiry_fail_safe",
      db,
    );
    if (result) results.push(result);
  }
  await emitLifecycleTransitionEvidence(results, "grant.expire");
  return results;
}

/**
 * Suspend or revoke active grants past recertifyBy (configurable; never leave active).
 */
export async function applyOverdueRecertificationFailSafe(
  now: Date = new Date(),
  db: PrismaClient = getIdentityDb(),
  subjectAccountId?: string,
): Promise<MutateResult<GrantView>[]> {
  const action = lifecycleHooks.overdueRecertificationAction;
  const due = await db.entitlementGrant.findMany({
    where: {
      status: "active",
      recertifyBy: { lt: now },
      ...(subjectAccountId ? { subjectAccountId } : {}),
    },
  });
  const results: MutateResult<GrantView>[] = [];
  for (const grant of due) {
    const result = await transitionFailSafe(
      grant,
      action === "revoke" ? "revoked" : "suspended",
      "recertification_overdue_fail_safe",
      db,
    );
    if (result) results.push(result);
  }
  await emitLifecycleTransitionEvidence(
    results,
    action === "revoke" ? "grant.revoke" : "grant.suspend",
  );
  return results;
}

/**
 * Directory disablement / account inactive → revoke or suspend active grants
 * so the next protected action fails closed (FR-49).
 */
export async function revokeActiveGrantsForAccount(
  accountId: string,
  reason: string = "directory_disablement",
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<GrantView>[]> {
  const active = await db.entitlementGrant.findMany({
    where: {
      subjectAccountId: accountId,
      status: { in: ["active", "approved", "suspended", "requested"] },
    },
  });
  const results: MutateResult<GrantView>[] = [];
  for (const grant of active) {
    if (grant.status === "active" || grant.status === "suspended") {
      await withdrawGrantBindings(grant, db);
    }
    const before = grantSnapshot(grant);
    const updated = await db.entitlementGrant.update({
      where: { id: grant.id },
      data: {
        status: "revoked",
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
    results.push({
      entity: toGrantView(updated),
      before,
      after: grantSnapshot(updated),
    });
  }
  await emitLifecycleTransitionEvidence(results, "grant.revoke");
  return results;
}

/**
 * Lazy fail-safe on protected entry: expiry + overdue recert for the subject.
 * Call from getSessionContext / governedProcedure before authorizing.
 */
export async function applyProtectedEntryFailSafes(
  subjectAccountId: string,
  now: Date = new Date(),
  db: PrismaClient = getIdentityDb(),
): Promise<{
  expired: MutateResult<GrantView>[];
  overdue: MutateResult<GrantView>[];
}> {
  const expired = await applyExpiryFailSafe(now, db, subjectAccountId);
  const overdue = await applyOverdueRecertificationFailSafe(
    now,
    db,
    subjectAccountId,
  );
  return { expired, overdue };
}

/**
 * Reauthorize hook for future queued work / artifact retrieval (Stories 6.x / 7.x).
 * Consumers MUST call this before serving queued/export artifacts.
 * Fail-closed: returns false when account inactive or no longer has the binding.
 */
export async function reauthorizeForQueuedOrArtifactWork(
  input: {
    accountId: string;
    /** Optional role that must still be effectively bound. */
    requiredAccessRoleId?: string;
    /** Optional scope that must still be effectively bound. */
    requiredOrganizationalScopeId?: string;
  },
  db: PrismaClient = getIdentityDb(),
): Promise<{ allowed: boolean; reason: string }> {
  await applyProtectedEntryFailSafes(input.accountId, new Date(), db);

  const account = await db.internalAccount.findUnique({
    where: { id: input.accountId },
    select: { status: true },
  });
  if (!account || account.status !== "active") {
    return { allowed: false, reason: "account_inactive" };
  }

  if (input.requiredAccessRoleId) {
    const role = await db.accountAccessRole.findUnique({
      where: {
        accountId_accessRoleId: {
          accountId: input.accountId,
          accessRoleId: input.requiredAccessRoleId,
        },
      },
    });
    if (!role) {
      return { allowed: false, reason: "role_binding_missing" };
    }
  }

  if (input.requiredOrganizationalScopeId) {
    const scope = await db.accountOrganizationalScope.findUnique({
      where: {
        accountId_organizationalScopeId: {
          accountId: input.accountId,
          organizationalScopeId: input.requiredOrganizationalScopeId,
        },
      },
    });
    if (!scope) {
      return { allowed: false, reason: "scope_binding_missing" };
    }
  }

  return { allowed: true, reason: "reauthorized" };
}
