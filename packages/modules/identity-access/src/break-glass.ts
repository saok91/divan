/**
 * Break-glass privileged access (Story 2.5 / FR-46).
 *
 * Specializes EntitlementGrant `kind: break_glass` — does **not** fork a parallel
 * privilege system. Reuses request → approve → activate → revoke/expire fail-safes.
 *
 * Configurable hooks (empty/missing → fail-closed; AR-ACCESS owns production):
 * - `maxDemoDurationMs` — reject expiresAt beyond this ceiling (demo default 8h;
 *   **not** a production SLA millisecond)
 * - `allowedElevationPermissionCodes` — activation role may only include these
 * - `allowExceptionalExportCoApproval` / `allowExceptionalPermissionAdminCoApproval`
 *   (default **false** — export + permission-admin stay denied under elevation)
 *
 * Story 2.7: elevation does **not** bypass InferenceBulkPort — privileged
 * retrieval demos still evaluate small-cohort / volume / differencing hooks.
 *
 * NFR-6 deferred hook: restored emergency grants remain invalid until catch-up.
 * No backup-restore path exists yet — do not fake invalidate-on-restore here.
 */
import type { EntitlementGrant, PrismaClient } from "@divan/db";

import {
  ACCESS_ADMINISTRATION_PERMISSION,
  AccessAdminError,
  MSG_ACCESS_ADMIN_REQUIRED_FA,
  MSG_TOXIC_COMBINATION_FA,
  assertToxicCombinationAllowed,
  type AccessAdminActor,
  type MutateResult,
} from "./access-admin";
import { getIdentityDb } from "./db";
import {
  grantSnapshot,
  kindRequiresIndependentApproval,
  requestGrant,
  toGrantView,
  type GrantCreatePayload,
  type GrantView,
  type RequestGrantInput,
} from "./entitlement-lifecycle";

/** Demo minimal privileged HR-read permission — never export / access.administration. */
export const BREAK_GLASS_PRIVILEGED_READ_PERMISSION =
  "demo.sensitive_hr.read";

export const SEED_BREAK_GLASS = {
  permissionSetName: "break-glass-hr-read",
  roleCode: "break_glass_hr_read",
  roleLabelFa: "خواندن اضطراری منابع انسانی",
  permissions: [BREAK_GLASS_PRIVILEGED_READ_PERMISSION] as const,
} as const;

export const MSG_BREAK_GLASS_INCIDENT_REQUIRED_FA =
  "شناسهٔ حادثه و هدف دسترسی اضطراری الزامی است.";

export const MSG_BREAK_GLASS_EXPIRES_REQUIRED_FA =
  "تاریخ انقضای دسترسی اضطراری الزامی است.";

export const MSG_BREAK_GLASS_DURATION_EXCEEDED_FA =
  "مدت دسترسی اضطراری از سقف مجاز نمونه بیشتر است.";

export const MSG_BREAK_GLASS_ELEVATION_DENIED_FA =
  "این ارتقای اضطراری شامل مجوزهای غیرمجاز است.";

export const MSG_BREAK_GLASS_EXPORT_DENIED_FA =
  "خروجی تحت دسترسی اضطراری مجاز نیست.";

export const MSG_BREAK_GLASS_ADMIN_DENIED_FA =
  "مدیریت دسترسی تحت ارتفاع اضطراری مجاز نیست.";

export const MSG_BREAK_GLASS_REVIEW_TOXIC_FA =
  "بازبینی استفاده اضطراری توسط بازیگر مستقل الزامی است.";

export const MSG_BREAK_GLASS_PRIVILEGED_READ_REQUIRED_FA =
  "دسترسی ندارید.";

export const MSG_BREAK_GLASS_SELF_REQUEST_FA =
  "درخواست دسترسی اضطراری برای خودتان مجاز نیست.";

export const MSG_BREAK_GLASS_OVERLAP_FA =
  "برای این حساب هم‌اکنون یک دسترسی اضطراری فعال وجود دارد.";

export const MSG_BREAK_GLASS_ROLE_LIFECYCLE_ONLY_FA =
  "نقش ارتفاع اضطراری فقط از مسیر دسترسی اضطراری قابل تخصیص است.";

export const MSG_BREAK_GLASS_RECERTIFY_DENIED_FA =
  "بازتأیید برای دسترسی اضطراری مجاز نیست؛ درخواست جدید ثبت کنید.";

/** Demo ceiling only — AR-ACCESS owns production max duration. */
export const DEMO_BREAK_GLASS_MAX_DURATION_MS = 8 * 60 * 60 * 1000;

/** FR-51: keep incident/purpose short — no HR field dumps. */
export const BREAK_GLASS_INCIDENT_MAX_LEN = 128;
export const BREAK_GLASS_PURPOSE_MAX_LEN = 500;

export type BreakGlassHooks = {
  maxDemoDurationMs: number;
  allowedElevationPermissionCodes: readonly string[];
  allowExceptionalExportCoApproval: boolean;
  allowExceptionalPermissionAdminCoApproval: boolean;
};

const DEFAULT_BREAK_GLASS_HOOKS: BreakGlassHooks = Object.freeze({
  maxDemoDurationMs: DEMO_BREAK_GLASS_MAX_DURATION_MS,
  allowedElevationPermissionCodes: Object.freeze([
    BREAK_GLASS_PRIVILEGED_READ_PERMISSION,
  ]),
  allowExceptionalExportCoApproval: false,
  allowExceptionalPermissionAdminCoApproval: false,
});

let breakGlassHooks: BreakGlassHooks = { ...DEFAULT_BREAK_GLASS_HOOKS };

export function getBreakGlassHooks(): BreakGlassHooks {
  return breakGlassHooks;
}

/** Test/selfcheck hook only. Pass null to restore defaults. */
export function setBreakGlassHooksForTests(
  hooks: Partial<BreakGlassHooks> | null,
): void {
  if (hooks === null) {
    breakGlassHooks = { ...DEFAULT_BREAK_GLASS_HOOKS };
    return;
  }
  breakGlassHooks = {
    maxDemoDurationMs:
      hooks.maxDemoDurationMs ?? breakGlassHooks.maxDemoDurationMs,
    allowedElevationPermissionCodes:
      hooks.allowedElevationPermissionCodes ??
      breakGlassHooks.allowedElevationPermissionCodes,
    allowExceptionalExportCoApproval:
      hooks.allowExceptionalExportCoApproval ??
      breakGlassHooks.allowExceptionalExportCoApproval,
    allowExceptionalPermissionAdminCoApproval:
      hooks.allowExceptionalPermissionAdminCoApproval ??
      breakGlassHooks.allowExceptionalPermissionAdminCoApproval,
  };
}

export type ActiveBreakGlassSummary =
  | {
      active: true;
      grantId: string;
      expiresAt: string;
      incidentId: string | null;
      purpose: string | null;
      exceptionalExportApproved: boolean;
      exceptionalPermissionAdminApproved: boolean;
    }
  | { active: false };

export type RequestBreakGlassInput = {
  subjectAccountId: string;
  incidentId: string;
  purpose: string;
  expiresAt: Date;
  accessRoleId?: string | null;
  organizationalScopeId?: string | null;
  createPayload?: GrantCreatePayload | null;
  startsAt?: Date | null;
  /** Only honored when hooks allow exceptional co-approval (default false). */
  exceptionalExportApproved?: boolean;
  exceptionalPermissionAdminApproved?: boolean;
};

function normalizeIncident(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

function normalizePurpose(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

function assertValidFutureExpiresAt(expiresAt: Date, now: Date): void {
  if (Number.isNaN(expiresAt.getTime())) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_EXPIRES_REQUIRED_FA,
      "break_glass_expires_invalid",
    );
  }
  if (expiresAt <= now) {
    throw new AccessAdminError(
      "VALIDATION",
      "تاریخ انقضا باید در آینده باشد.",
    );
  }
  const wallMs = expiresAt.getTime() - now.getTime();
  if (wallMs > breakGlassHooks.maxDemoDurationMs) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_DURATION_EXCEEDED_FA,
      "break_glass_duration_ceiling",
    );
  }
}

/**
 * Validate break-glass request fields. Called from requestGrant specialization
 * and requestBreakGlassGrant.
 */
export async function validateBreakGlassRequestInput(
  input: RequestGrantInput & {
    incidentId?: string | null;
    purpose?: string | null;
    exceptionalExportApproved?: boolean;
    exceptionalPermissionAdminApproved?: boolean;
  },
  actor: AccessAdminActor,
  db: PrismaClient,
): Promise<void> {
  const incidentId = normalizeIncident(input.incidentId);
  const purpose = normalizePurpose(input.purpose);
  if (!incidentId || !purpose) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_INCIDENT_REQUIRED_FA,
      "break_glass_incident_purpose_required",
    );
  }
  if (incidentId.length > BREAK_GLASS_INCIDENT_MAX_LEN) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_INCIDENT_REQUIRED_FA,
      "break_glass_incident_too_long",
    );
  }
  if (purpose.length > BREAK_GLASS_PURPOSE_MAX_LEN) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_INCIDENT_REQUIRED_FA,
      "break_glass_purpose_too_long",
    );
  }
  if (!input.expiresAt) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_EXPIRES_REQUIRED_FA,
      "break_glass_expires_required",
    );
  }

  const now = new Date();
  assertValidFutureExpiresAt(input.expiresAt, now);

  const start = input.startsAt ?? now;
  if (Number.isNaN(start.getTime())) {
    throw new AccessAdminError(
      "VALIDATION",
      "زمان شروع نامعتبر است.",
      "break_glass_starts_invalid",
    );
  }
  const durationMs = input.expiresAt.getTime() - start.getTime();
  if (durationMs > breakGlassHooks.maxDemoDurationMs) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_DURATION_EXCEEDED_FA,
      "break_glass_duration_ceiling",
    );
  }

  // Break-glass always blocks self-request (independence).
  if (actor.accountId === input.subjectAccountId) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_BREAK_GLASS_SELF_REQUEST_FA,
      "break_glass_self_request_blocked",
    );
  }

  assertToxicCombinationAllowed({
    actorAccountId: actor.accountId,
    subjectAccountId: input.subjectAccountId,
    operation: "grant.break_glass.request",
  });

  if (
    input.exceptionalExportApproved === true &&
    !breakGlassHooks.allowExceptionalExportCoApproval
  ) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_EXPORT_DENIED_FA,
      "break_glass_exceptional_export_disabled",
    );
  }
  if (
    input.exceptionalPermissionAdminApproved === true &&
    !breakGlassHooks.allowExceptionalPermissionAdminCoApproval
  ) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_ADMIN_DENIED_FA,
      "break_glass_exceptional_admin_disabled",
    );
  }

  // Role is mandatory for break-glass (allowlist runs here). Scope-only is rejected.
  if (!input.accessRoleId) {
    throw new AccessAdminError(
      "VALIDATION",
      "نقش ارتفاع اضطراری برای درخواست الزامی است.",
      "break_glass_role_required",
    );
  }

  await assertRoleAllowedForBreakGlassElevation(
    input.accessRoleId,
    {
      exceptionalExportApproved: input.exceptionalExportApproved === true,
      exceptionalPermissionAdminApproved:
        input.exceptionalPermissionAdminApproved === true,
    },
    db,
  );
}

export async function assertRoleAllowedForBreakGlassElevation(
  accessRoleId: string,
  flags: {
    exceptionalExportApproved: boolean;
    exceptionalPermissionAdminApproved: boolean;
  },
  db: PrismaClient,
): Promise<void> {
  const role = await db.accessRole.findUnique({
    where: { id: accessRoleId },
    include: { permissionSet: true },
  });
  if (!role) {
    throw new AccessAdminError("VALIDATION", "نقش نامعتبر است.");
  }
  const perms = role.permissionSet?.permissions ?? [];
  const allow = new Set(breakGlassHooks.allowedElevationPermissionCodes);

  for (const perm of perms) {
    if (perm === ACCESS_ADMINISTRATION_PERMISSION) {
      if (
        !flags.exceptionalPermissionAdminApproved ||
        !breakGlassHooks.allowExceptionalPermissionAdminCoApproval
      ) {
        throw new AccessAdminError(
          "VALIDATION",
          MSG_BREAK_GLASS_ELEVATION_DENIED_FA,
          "break_glass_admin_perm_denied",
        );
      }
      continue;
    }
    if (perm.includes("export") || perm.endsWith(".export")) {
      if (
        !flags.exceptionalExportApproved ||
        !breakGlassHooks.allowExceptionalExportCoApproval
      ) {
        throw new AccessAdminError(
          "VALIDATION",
          MSG_BREAK_GLASS_ELEVATION_DENIED_FA,
          "break_glass_export_perm_denied",
        );
      }
      continue;
    }
    if (!allow.has(perm)) {
      throw new AccessAdminError(
        "VALIDATION",
        MSG_BREAK_GLASS_ELEVATION_DENIED_FA,
        "break_glass_perm_not_on_allowlist",
      );
    }
  }
  if (perms.length === 0) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_ELEVATION_DENIED_FA,
      "break_glass_empty_permission_set",
    );
  }
}

/**
 * Activation gate for break_glass: required future expiresAt + denylist.
 */
export async function assertBreakGlassActivationAllowed(
  grant: EntitlementGrant,
  db: PrismaClient,
): Promise<void> {
  if (!grant.expiresAt) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_EXPIRES_REQUIRED_FA,
      "break_glass_activate_expires_required",
    );
  }
  const now = new Date();
  assertValidFutureExpiresAt(grant.expiresAt, now);
  if (!normalizeIncident(grant.incidentId) || !normalizePurpose(grant.purpose)) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_BREAK_GLASS_INCIDENT_REQUIRED_FA,
    );
  }
  if (!grant.accessRoleId) {
    throw new AccessAdminError(
      "VALIDATION",
      "نقش ارتفاع اضطراری برای فعال‌سازی الزامی است.",
    );
  }

  const overlapping = await db.entitlementGrant.count({
    where: {
      id: { not: grant.id },
      subjectAccountId: grant.subjectAccountId,
      kind: "break_glass",
      status: "active",
      expiresAt: { gt: now },
    },
  });
  if (overlapping > 0) {
    throw new AccessAdminError(
      "CONFLICT",
      MSG_BREAK_GLASS_OVERLAP_FA,
      "break_glass_overlap_active",
    );
  }

  await assertRoleAllowedForBreakGlassElevation(
    grant.accessRoleId,
    {
      exceptionalExportApproved: grant.exceptionalExportApproved,
      exceptionalPermissionAdminApproved:
        grant.exceptionalPermissionAdminApproved,
    },
    db,
  );
}

/**
 * Dedicated request API — fills default minimal HR-read role when omitted.
 */
export async function requestBreakGlassGrant(
  input: RequestBreakGlassInput,
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<GrantView>> {
  let accessRoleId = input.accessRoleId ?? null;
  if (!accessRoleId) {
    const role = await db.accessRole.findUnique({
      where: { code: SEED_BREAK_GLASS.roleCode },
    });
    if (!role) {
      throw new AccessAdminError(
        "VALIDATION",
        "نقش ارتفاع اضطراری نمونه یافت نشد.",
        "break_glass_seed_role_missing",
      );
    }
    accessRoleId = role.id;
  }

  return requestGrant(
    {
      subjectAccountId: input.subjectAccountId,
      kind: "break_glass",
      accessRoleId,
      organizationalScopeId: input.organizationalScopeId ?? null,
      createPayload: input.createPayload ?? null,
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt,
      incidentId: input.incidentId,
      purpose: input.purpose,
      exceptionalExportApproved: input.exceptionalExportApproved === true,
      exceptionalPermissionAdminApproved:
        input.exceptionalPermissionAdminApproved === true,
    },
    actor,
    db,
  );
}

/**
 * Independent post-use review. Toxic vs subject, requester, and prior approver
 * of the same grant/incident. Required after activate; incomplete review does
 * not keep the grant active past expiry (expiry still wins).
 */
export async function completeBreakGlassPostUseReview(
  input: { grantId: string },
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<GrantView>> {
  const grant = await db.entitlementGrant.findUnique({
    where: { id: input.grantId },
  });
  if (!grant) {
    throw new AccessAdminError("NOT_FOUND", "درخواست دسترسی یافت نشد.");
  }
  if (grant.kind !== "break_glass") {
    throw new AccessAdminError(
      "VALIDATION",
      "بازبینی پس از استفاده فقط برای دسترسی اضطراری است.",
    );
  }
  if (grant.postUseReviewStatus === "completed") {
    throw new AccessAdminError(
      "VALIDATION",
      "بازبینی این دسترسی اضطراری قبلاً ثبت شده است.",
    );
  }
  // Reviewable after activate (active/expired/revoked/suspended) — not before.
  if (
    grant.status !== "active" &&
    grant.status !== "expired" &&
    grant.status !== "revoked" &&
    grant.status !== "suspended"
  ) {
    throw new AccessAdminError(
      "VALIDATION",
      "بازبینی پس از فعال‌سازی دسترسی اضطراری ممکن است.",
    );
  }

  const blockedActors = new Set(
    [
      grant.subjectAccountId,
      grant.requesterAccountId,
      grant.approverAccountId,
    ].filter(Boolean) as string[],
  );
  // Gate / AC #6: independence at incident scope, not only this grant row.
  const incidentId = normalizeIncident(grant.incidentId);
  if (incidentId) {
    const related = await db.entitlementGrant.findMany({
      where: {
        kind: "break_glass",
        incidentId,
        id: { not: grant.id },
      },
      select: {
        subjectAccountId: true,
        requesterAccountId: true,
        approverAccountId: true,
      },
    });
    for (const row of related) {
      if (row.subjectAccountId) blockedActors.add(row.subjectAccountId);
      if (row.requesterAccountId) blockedActors.add(row.requesterAccountId);
      if (row.approverAccountId) blockedActors.add(row.approverAccountId);
    }
  }
  if (blockedActors.has(actor.accountId)) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_BREAK_GLASS_REVIEW_TOXIC_FA,
      "break_glass_self_review_blocked",
    );
  }

  assertToxicCombinationAllowed({
    actorAccountId: actor.accountId,
    subjectAccountId: grant.subjectAccountId,
    operation: "grant.break_glass.review",
  });

  const before = grantSnapshot(grant);
  const reviewedAt = new Date();
  const claimed = await db.entitlementGrant.updateMany({
    where: {
      id: grant.id,
      postUseReviewStatus: "pending",
    },
    data: {
      postUseReviewStatus: "completed",
      postUseReviewedAt: reviewedAt,
      postUseReviewerAccountId: actor.accountId,
      correlationId: actor.correlationId,
    },
  });
  if (claimed.count !== 1) {
    throw new AccessAdminError(
      "CONFLICT",
      "بازبینی این دسترسی اضطراری قبلاً ثبت شده است.",
      "break_glass_review_race",
    );
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

export async function getActiveBreakGlassForAccount(
  accountId: string,
  db: PrismaClient = getIdentityDb(),
  now: Date = new Date(),
): Promise<ActiveBreakGlassSummary> {
  const grant = await db.entitlementGrant.findFirst({
    where: {
      subjectAccountId: accountId,
      kind: "break_glass",
      status: "active",
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: "asc" },
  });
  if (!grant || !grant.expiresAt) {
    return { active: false };
  }
  return {
    active: true,
    grantId: grant.id,
    expiresAt: grant.expiresAt.toISOString(),
    incidentId: grant.incidentId,
    purpose: grant.purpose,
    exceptionalExportApproved: grant.exceptionalExportApproved,
    exceptionalPermissionAdminApproved:
      grant.exceptionalPermissionAdminApproved,
  };
}

export async function listBreakGlassGrants(
  filter: {
    status?: GrantView["status"] | GrantView["status"][];
    subjectAccountId?: string;
    postUseReviewStatus?: "pending" | "completed" | "not_required";
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
      kind: "break_glass",
      status: statusFilter,
      subjectAccountId: filter.subjectAccountId,
      postUseReviewStatus: filter.postUseReviewStatus,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toGrantView);
}

/**
 * Privileged demo HR read requires a **live** break_glass grant **and** the
 * minimal elevation PermissionSet binding. Standing role alone ≠ allow.
 */
export async function assertActorHasBreakGlassPrivilegedRead(
  accountId: string,
  db: PrismaClient = getIdentityDb(),
): Promise<void> {
  const bg = await getActiveBreakGlassForAccount(accountId, db);
  if (!bg.active) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_BREAK_GLASS_PRIVILEGED_READ_REQUIRED_FA,
      "break_glass_privileged_read_required",
    );
  }

  const rows = await db.accountAccessRole.findMany({
    where: { accountId },
    include: {
      accessRole: { include: { permissionSet: true } },
    },
  });
  const has = rows.some((row) =>
    (row.accessRole.permissionSet?.permissions ?? []).includes(
      BREAK_GLASS_PRIVILEGED_READ_PERMISSION,
    ),
  );
  if (!has) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_BREAK_GLASS_PRIVILEGED_READ_REQUIRED_FA,
      "break_glass_privileged_read_required",
    );
  }
}

/** True when role code is the seeded break-glass elevation role. */
export function isBreakGlassElevationRoleCode(code: string): boolean {
  return code === SEED_BREAK_GLASS.roleCode;
}

/**
 * Hard invariant under active break-glass (AC #2):
 * export and access.administration denied unless exceptional co-approval on that grant.
 */
export async function assertBreakGlassElevationLimits(
  accountId: string,
  attempt: "export" | "access.administration",
  db: PrismaClient = getIdentityDb(),
): Promise<void> {
  const bg = await getActiveBreakGlassForAccount(accountId, db);
  if (!bg.active) return;

  if (attempt === "export" && !bg.exceptionalExportApproved) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_BREAK_GLASS_EXPORT_DENIED_FA,
      "break_glass_export_denied",
    );
  }
  if (
    attempt === "access.administration" &&
    !bg.exceptionalPermissionAdminApproved
  ) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_BREAK_GLASS_ADMIN_DENIED_FA,
      "break_glass_admin_denied",
    );
  }
}

/**
 * Seed minimal break-glass HR-read PermissionSet + role. Idempotent.
 * Does **not** bind to any account (no standing SysAdmin HR access).
 */
export async function seedBreakGlassFixtures(
  db: PrismaClient,
): Promise<void> {
  const permissionSet = await db.permissionSet.upsert({
    where: { name: SEED_BREAK_GLASS.permissionSetName },
    create: {
      name: SEED_BREAK_GLASS.permissionSetName,
      permissions: [...SEED_BREAK_GLASS.permissions],
    },
    update: {
      permissions: [...SEED_BREAK_GLASS.permissions],
    },
  });

  await db.accessRole.upsert({
    where: { code: SEED_BREAK_GLASS.roleCode },
    create: {
      code: SEED_BREAK_GLASS.roleCode,
      labelFa: SEED_BREAK_GLASS.roleLabelFa,
      permissionSetId: permissionSet.id,
    },
    update: {
      labelFa: SEED_BREAK_GLASS.roleLabelFa,
      permissionSetId: permissionSet.id,
    },
  });
}

/** Ensure elevated kinds still require approval when break_glass is added. */
export function breakGlassRequiresIndependentApproval(): boolean {
  return kindRequiresIndependentApproval("break_glass");
}
