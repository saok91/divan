/**
 * Access-administration APIs (Story 2.3 / FR-4).
 * Pure server module — no React. Coarse roles never imply envelope allows.
 */
import type { PrismaClient } from "@divan/db";

import { getIdentityDb } from "./db";

/** Stable envelope permission required for the Admin surface. */
export const ACCESS_ADMINISTRATION_PERMISSION = "access.administration";

/** Non-HR admin data category (demo/local enabled; not an HR-content category). */
export const ACCESS_ADMIN_DATA_CATEGORY = "identity.access_admin";

export const MSG_TOXIC_COMBINATION_FA =
  "این ترکیب دسترسی مجاز نیست. عملیات مسدود شد.";

export const MSG_ROLE_REQUIRES_PERMISSION_SET_FA =
  "نقش باید به یک مجموعهٔ مجوز صریح متصل باشد.";

export const MSG_PERMISSION_OUTSIDE_SET_FA =
  "مجوز خارج از مجموعهٔ صریح نقش قابل اعطا نیست.";

export const MSG_EMPTY_PERMISSION_SET_FA =
  "مجموعهٔ مجوز نمی‌تواند خالی باشد.";

export const MSG_ACCESS_ADMIN_REQUIRED_FA = "دسترسی ندارید.";

export const EMPTY_ENTITLEMENTS_COPY_FA = "تخصیص دسترسی‌ای ثبت نشده.";

/** FR-46: elevated creates/mass assigns must use entitlement lifecycle. */
export const MSG_LIFECYCLE_APPROVAL_REQUIRED_FA =
  "ایجاد نقش/محدوده یا تخصیص حساس نیازمند تأیید مستقل است. از درخواست entitlement استفاده کنید.";

export type AccessAdminActor = {
  accountId: string;
  correlationId: string;
};

export type Snapshot = Record<string, unknown>;

export type MutateResult<T> = {
  entity: T;
  before: Snapshot | null;
  after: Snapshot;
};

export class AccessAdminError extends Error {
  readonly code:
    | "TOXIC_COMBINATION"
    | "VALIDATION"
    | "NOT_FOUND"
    | "CONFLICT";
  readonly messageFa: string;

  constructor(
    code: AccessAdminError["code"],
    messageFa: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AccessAdminError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export type ToxicOperation =
  | "grant.request"
  | "grant.approve"
  | "grant.waive"
  | "grant.recertify"
  | "grant.activate"
  | "access.role.assign"
  | "access.scope.assign"
  | "access.permission_set.create"
  | "access.permission_set.update"
  | "access.account.link"
  | "access.account.status"
  | "access.scope.create"
  | "access.scope.update"
  | "access.role.create"
  | "access.role.update"
  | "demo.non_toxic";

const SELF_TOXIC_OPERATIONS = new Set<string>([
  // grant.request self-block is kind-aware in requestGrant (elevated binding only)
  "grant.approve",
  "grant.waive",
  "grant.recertify",
  "grant.activate",
  "access.role.assign",
  "access.scope.assign",
  "access.account.status",
  "access.account.link",
]);

export type ToxicCombinationInput = {
  actorAccountId: string;
  subjectAccountId?: string | null;
  operation: ToxicOperation | string;
  /** True when permission-admin path is combined with approving the same grant. */
  combinesPermissionAdminWithSameGrantApproval?: boolean;
};

export type ToxicRule = {
  operation: string;
  /** When true, rule matches self-target (actor === subject). */
  selfTarget?: boolean;
  combinesPermissionAdminWithSameGrantApproval?: boolean;
  effect: "allow" | "deny";
};

/**
 * Toxic-combination registry. Empty by default → fail-closed for named
 * toxic paths (self-approval; admin+approve-same-grant). AR-ACCESS owns
 * the production matrix — do not invent it here.
 */
let toxicRegistry: readonly ToxicRule[] = Object.freeze([]);

export function getToxicCombinationRegistry(): readonly ToxicRule[] {
  return toxicRegistry;
}

/** Test/selfcheck hook only. */
export function setToxicCombinationRegistryForTests(
  rules: readonly ToxicRule[] | null,
): void {
  toxicRegistry = Object.freeze(rules ?? []);
}

function isSelfTarget(input: ToxicCombinationInput): boolean {
  return Boolean(
    input.subjectAccountId &&
      input.actorAccountId === input.subjectAccountId,
  );
}

function matchesRule(
  rule: ToxicRule,
  input: ToxicCombinationInput,
  self: boolean,
): boolean {
  if (rule.operation !== input.operation) return false;
  if (rule.selfTarget === true && !self) return false;
  if (
    rule.combinesPermissionAdminWithSameGrantApproval === true &&
    input.combinesPermissionAdminWithSameGrantApproval !== true
  ) {
    return false;
  }
  return true;
}

/**
 * Fail-closed toxic guard. Missing matrix path for a toxic combination → deny.
 * Named self-target paths (role/scope assign, account status/link, grant
 * approve) and admin+approve-same-grant are blocked when the matrix is empty.
 */
export function assertToxicCombinationAllowed(
  input: ToxicCombinationInput,
): void {
  const self = isSelfTarget(input);
  const isSelfToxic = self && SELF_TOXIC_OPERATIONS.has(input.operation);
  const isAdminApproveSame =
    input.combinesPermissionAdminWithSameGrantApproval === true;

  if (!isSelfToxic && !isAdminApproveSame) {
    return;
  }

  const hit = toxicRegistry.find((r) => matchesRule(r, input, self));
  if (!hit || hit.effect !== "allow") {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_TOXIC_COMBINATION_FA,
      "toxic_combination_blocked",
    );
  }
}

/**
 * Envelope policy is 4-tuple only — PermissionSet bindings unlock admin APIs.
 * Callers without `access.administration` on an assigned role's set are denied.
 */
export async function assertActorHasAccessAdministration(
  accountId: string,
  db: PrismaClient = getIdentityDb(),
): Promise<void> {
  const rows = await db.accountAccessRole.findMany({
    where: { accountId },
    include: {
      accessRole: { include: { permissionSet: true } },
    },
  });
  const has = rows.some((row) =>
    (row.accessRole.permissionSet?.permissions ?? []).includes(
      ACCESS_ADMINISTRATION_PERMISSION,
    ),
  );
  if (!has) {
    throw new AccessAdminError(
      "TOXIC_COMBINATION",
      MSG_ACCESS_ADMIN_REQUIRED_FA,
      "access_administration_required",
    );
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

async function createOrConflict<T>(
  create: () => Promise<T>,
  messageFa = "رکورد تکراری است.",
): Promise<T> {
  try {
    return await create();
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new AccessAdminError("CONFLICT", messageFa);
    }
    throw err;
  }
}

function scopeSnapshot(row: {
  id: string;
  labelFa: string;
  active: boolean;
}): Snapshot {
  return {
    id: row.id,
    labelFa: row.labelFa,
    active: row.active,
  };
}

function permissionSetSnapshot(row: {
  id: string;
  name: string;
  permissions: string[];
}): Snapshot {
  return {
    id: row.id,
    name: row.name,
    permissions: [...row.permissions].sort(),
  };
}

function roleSnapshot(row: {
  id: string;
  code: string;
  labelFa: string;
  permissionSetId: string;
}): Snapshot {
  return {
    id: row.id,
    code: row.code,
    labelFa: row.labelFa,
    permissionSetId: row.permissionSetId,
  };
}

export async function listOrganizationalScopes(
  db: PrismaClient = getIdentityDb(),
) {
  return db.organizationalScope.findMany({
    orderBy: { labelFa: "asc" },
  });
}

export async function createOrganizationalScope(
  input: {
    labelFa: string;
    active?: boolean;
    /**
     * Only set by entitlement activateGrant (scope_create). Direct Admin
     * create is blocked — FR-46 requires independent approval.
     */
    viaLifecycleActivation?: boolean;
  },
  _actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<{ id: string; labelFa: string; active: boolean }>> {
  if (!input.viaLifecycleActivation) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_LIFECYCLE_APPROVAL_REQUIRED_FA,
      "scope_create_requires_lifecycle",
    );
  }

  assertToxicCombinationAllowed({
    actorAccountId: _actor.accountId,
    operation: "access.scope.create",
  });

  const labelFa = input.labelFa.trim();
  if (!labelFa) {
    throw new AccessAdminError(
      "VALIDATION",
      "برچسب محدوده الزامی است.",
    );
  }

  const created = await createOrConflict(() =>
    db.organizationalScope.create({
      data: {
        labelFa,
        active: input.active !== false,
      },
    }),
  );
  const after = scopeSnapshot(created);
  return { entity: created, before: null, after };
}

export async function updateOrganizationalScope(
  input: { id: string; labelFa?: string; active?: boolean },
  _actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<{ id: string; labelFa: string; active: boolean }>> {
  assertToxicCombinationAllowed({
    actorAccountId: _actor.accountId,
    operation: "access.scope.update",
  });

  const existing = await db.organizationalScope.findUnique({
    where: { id: input.id },
  });
  if (!existing) {
    throw new AccessAdminError("NOT_FOUND", "محدوده یافت نشد.");
  }

  const before = scopeSnapshot(existing);

  if (input.labelFa !== undefined) {
    const labelFa = input.labelFa.trim();
    if (!labelFa) {
      throw new AccessAdminError("VALIDATION", "برچسب محدوده الزامی است.");
    }
  }

  if (input.active === false) {
    const bound = await db.accountOrganizationalScope.count({
      where: { organizationalScopeId: input.id },
    });
    if (bound > 0) {
      throw new AccessAdminError(
        "CONFLICT",
        "محدوده در استفاده است.",
      );
    }
  }

  const updated = await db.organizationalScope.update({
    where: { id: input.id },
    data: {
      ...(input.labelFa !== undefined
        ? { labelFa: input.labelFa.trim() }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
  return { entity: updated, before, after: scopeSnapshot(updated) };
}

export async function listPermissionSets(
  db: PrismaClient = getIdentityDb(),
) {
  return db.permissionSet.findMany({ orderBy: { name: "asc" } });
}

export async function createPermissionSet(
  input: { name: string; permissions: string[] },
  _actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<
  MutateResult<{ id: string; name: string; permissions: string[] }>
> {
  assertToxicCombinationAllowed({
    actorAccountId: _actor.accountId,
    operation: "access.permission_set.create",
  });

  const name = input.name.trim();
  const permissions = normalizePermissionCodes(input.permissions);
  if (!name) {
    throw new AccessAdminError("VALIDATION", "نام مجموعه مجوز الزامی است.");
  }
  if (permissions.length === 0) {
    throw new AccessAdminError("VALIDATION", MSG_EMPTY_PERMISSION_SET_FA);
  }

  const created = await createOrConflict(() =>
    db.permissionSet.create({
      data: { name, permissions },
    }),
  );
  return {
    entity: created,
    before: null,
    after: permissionSetSnapshot(created),
  };
}

export async function updatePermissionSet(
  input: { id: string; name?: string; permissions?: string[] },
  _actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<
  MutateResult<{ id: string; name: string; permissions: string[] }>
> {
  assertToxicCombinationAllowed({
    actorAccountId: _actor.accountId,
    operation: "access.permission_set.update",
  });

  const existing = await db.permissionSet.findUnique({
    where: { id: input.id },
  });
  if (!existing) {
    throw new AccessAdminError("NOT_FOUND", "مجموعه مجوز یافت نشد.");
  }

  const before = permissionSetSnapshot(existing);
  const nextName =
    input.name !== undefined ? input.name.trim() : existing.name;
  if (input.name !== undefined && !nextName) {
    throw new AccessAdminError("VALIDATION", "نام مجموعه مجوز الزامی است.");
  }
  const nextPermissions =
    input.permissions !== undefined
      ? normalizePermissionCodes(input.permissions)
      : existing.permissions;
  if (input.permissions !== undefined && nextPermissions.length === 0) {
    throw new AccessAdminError("VALIDATION", MSG_EMPTY_PERMISSION_SET_FA);
  }

  const updated = await createOrConflict(() =>
    db.permissionSet.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: nextName } : {}),
        ...(input.permissions !== undefined
          ? { permissions: nextPermissions }
          : {}),
      },
    }),
  );
  return {
    entity: updated,
    before,
    after: permissionSetSnapshot(updated),
  };
}

export async function listAccessRoles(db: PrismaClient = getIdentityDb()) {
  return db.accessRole.findMany({
    include: { permissionSet: true },
    orderBy: { code: "asc" },
  });
}

export async function createAccessRole(
  input: {
    code: string;
    labelFa: string;
    permissionSetId: string;
    /** Only set by entitlement activateGrant (role_create). */
    viaLifecycleActivation?: boolean;
  },
  _actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<
  MutateResult<{
    id: string;
    code: string;
    labelFa: string;
    permissionSetId: string;
  }>
> {
  if (!input.viaLifecycleActivation) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_LIFECYCLE_APPROVAL_REQUIRED_FA,
      "role_create_requires_lifecycle",
    );
  }

  assertToxicCombinationAllowed({
    actorAccountId: _actor.accountId,
    operation: "access.role.create",
  });

  const code = input.code.trim();
  const labelFa = input.labelFa.trim();
  if (!code || !labelFa) {
    throw new AccessAdminError("VALIDATION", "کد و برچسب نقش الزامی است.");
  }
  if (!input.permissionSetId.trim()) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_ROLE_REQUIRES_PERMISSION_SET_FA,
    );
  }

  const set = await db.permissionSet.findUnique({
    where: { id: input.permissionSetId },
  });
  if (!set) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_ROLE_REQUIRES_PERMISSION_SET_FA,
    );
  }
  if (!set.permissions.length) {
    throw new AccessAdminError("VALIDATION", MSG_EMPTY_PERMISSION_SET_FA);
  }

  const created = await createOrConflict(() =>
    db.accessRole.create({
      data: {
        code,
        labelFa,
        permissionSetId: set.id,
      },
    }),
  );
  return { entity: created, before: null, after: roleSnapshot(created) };
}

export async function updateAccessRole(
  input: {
    id: string;
    code?: string;
    labelFa?: string;
    permissionSetId?: string;
  },
  _actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<
  MutateResult<{
    id: string;
    code: string;
    labelFa: string;
    permissionSetId: string;
  }>
> {
  assertToxicCombinationAllowed({
    actorAccountId: _actor.accountId,
    operation: "access.role.update",
  });

  const existing = await db.accessRole.findUnique({
    where: { id: input.id },
  });
  if (!existing) {
    throw new AccessAdminError("NOT_FOUND", "نقش یافت نشد.");
  }

  if (input.permissionSetId !== undefined) {
    if (!input.permissionSetId.trim()) {
      throw new AccessAdminError(
        "VALIDATION",
        MSG_ROLE_REQUIRES_PERMISSION_SET_FA,
      );
    }
    const set = await db.permissionSet.findUnique({
      where: { id: input.permissionSetId },
    });
    if (!set) {
      throw new AccessAdminError(
        "VALIDATION",
        MSG_ROLE_REQUIRES_PERMISSION_SET_FA,
      );
    }
  }

  const before = roleSnapshot(existing);
  if (input.code !== undefined && !input.code.trim()) {
    throw new AccessAdminError("VALIDATION", "کد و برچسب نقش الزامی است.");
  }
  if (input.labelFa !== undefined && !input.labelFa.trim()) {
    throw new AccessAdminError("VALIDATION", "کد و برچسب نقش الزامی است.");
  }

  const updated = await createOrConflict(() =>
    db.accessRole.update({
      where: { id: input.id },
      data: {
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.labelFa !== undefined
          ? { labelFa: input.labelFa.trim() }
          : {}),
        ...(input.permissionSetId !== undefined
          ? { permissionSetId: input.permissionSetId }
          : {}),
      },
    }),
  );
  return { entity: updated, before, after: roleSnapshot(updated) };
}

export type EntitlementRow = {
  accountId: string;
  username: string;
  displayName: string;
  status: string;
  coarseRole: string;
  accessRoleIds: string[];
  accessRoleCodes: string[];
  organizationalScopeIds: string[];
  organizationalScopeLabels: string[];
  externalDirectoryId: string | null;
};

export async function listEntitlements(
  db: PrismaClient = getIdentityDb(),
): Promise<EntitlementRow[]> {
  const accounts = await db.internalAccount.findMany({
    include: {
      humanIdentity: true,
      accessRoles: { include: { accessRole: true } },
      organizationalScopes: { include: { organizationalScope: true } },
    },
    orderBy: { username: "asc" },
  });

  return accounts.map((a) => ({
    accountId: a.id,
    username: a.username,
    displayName: a.humanIdentity.displayName,
    status: a.status,
    coarseRole: a.coarseRole,
    accessRoleIds: a.accessRoles.map((r) => r.accessRoleId),
    accessRoleCodes: a.accessRoles.map((r) => r.accessRole.code),
    organizationalScopeIds: a.organizationalScopes.map(
      (s) => s.organizationalScopeId,
    ),
    organizationalScopeLabels: a.organizationalScopes.map(
      (s) => s.organizationalScope.labelFa,
    ),
    externalDirectoryId: a.externalDirectoryId,
  }));
}

/**
 * Assign or replace an account's access roles. Roles only grant their
 * explicit PermissionSet (AC #2 — structural FK + non-empty set).
 * Self-assign is toxic when matrix missing.
 *
 * Mass assignment (>1 role) requires entitlement lifecycle (FR-46) unless
 * `viaLifecycleActivation` is set by activateGrant.
 * Single-role assign remains for Admin convenience as `standard`.
 */
export async function assignAccountAccessRoles(
  input: {
    accountId: string;
    accessRoleIds: string[];
    viaLifecycleActivation?: boolean;
  },
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<{ accountId: string; accessRoleIds: string[] }>> {
  assertToxicCombinationAllowed({
    actorAccountId: actor.accountId,
    subjectAccountId: input.accountId,
    operation: "access.role.assign",
  });

  const uniqueRoleIds = [...new Set(input.accessRoleIds)];
  if (uniqueRoleIds.length > 1 && !input.viaLifecycleActivation) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_LIFECYCLE_APPROVAL_REQUIRED_FA,
      "mass_role_assign_requires_lifecycle",
    );
  }

  const account = await db.internalAccount.findUnique({
    where: { id: input.accountId },
    include: { accessRoles: true },
  });
  if (!account) {
    throw new AccessAdminError("NOT_FOUND", "حساب یافت نشد.");
  }

  const roles = await db.accessRole.findMany({
    where: { id: { in: uniqueRoleIds } },
    include: { permissionSet: true },
  });
  if (roles.length !== uniqueRoleIds.length) {
    throw new AccessAdminError("VALIDATION", "نقش نامعتبر است.");
  }

  for (const role of roles) {
    if (!role.permissionSetId || !role.permissionSet) {
      throw new AccessAdminError(
        "VALIDATION",
        MSG_ROLE_REQUIRES_PERMISSION_SET_FA,
      );
    }
    // Role capabilities are exactly the permission set — nothing beyond.
    if (!role.permissionSet.permissions.length) {
      throw new AccessAdminError(
        "VALIDATION",
        MSG_EMPTY_PERMISSION_SET_FA,
      );
    }
    if (
      !input.viaLifecycleActivation &&
      role.permissionSet.permissions.includes(ACCESS_ADMINISTRATION_PERMISSION)
    ) {
      throw new AccessAdminError(
        "VALIDATION",
        MSG_LIFECYCLE_APPROVAL_REQUIRED_FA,
        "privileged_role_requires_lifecycle",
      );
    }
  }

  const before: Snapshot = {
    accountId: account.id,
    accessRoleIds: account.accessRoles.map((r) => r.accessRoleId).sort(),
  };

  await db.$transaction(async (tx) => {
    await tx.accountAccessRole.deleteMany({
      where: { accountId: account.id },
    });
    if (uniqueRoleIds.length) {
      await tx.accountAccessRole.createMany({
        data: uniqueRoleIds.map((accessRoleId) => ({
          accountId: account.id,
          accessRoleId,
        })),
      });
    }
  });

  const after: Snapshot = {
    accountId: account.id,
    accessRoleIds: [...uniqueRoleIds].sort(),
  };
  return {
    entity: { accountId: account.id, accessRoleIds: uniqueRoleIds },
    before,
    after,
  };
}

export async function assignAccountScopes(
  input: {
    accountId: string;
    organizationalScopeIds: string[];
    viaLifecycleActivation?: boolean;
  },
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<
  MutateResult<{ accountId: string; organizationalScopeIds: string[] }>
> {
  assertToxicCombinationAllowed({
    actorAccountId: actor.accountId,
    subjectAccountId: input.accountId,
    operation: "access.scope.assign",
  });

  const uniqueScopeIds = [...new Set(input.organizationalScopeIds)];
  if (uniqueScopeIds.length > 1 && !input.viaLifecycleActivation) {
    throw new AccessAdminError(
      "VALIDATION",
      MSG_LIFECYCLE_APPROVAL_REQUIRED_FA,
      "mass_scope_assign_requires_lifecycle",
    );
  }

  const account = await db.internalAccount.findUnique({
    where: { id: input.accountId },
    include: { organizationalScopes: true },
  });
  if (!account) {
    throw new AccessAdminError("NOT_FOUND", "حساب یافت نشد.");
  }

  const scopes = await db.organizationalScope.findMany({
    where: { id: { in: uniqueScopeIds } },
  });
  if (scopes.length !== uniqueScopeIds.length) {
    throw new AccessAdminError("VALIDATION", "محدوده نامعتبر است.");
  }
  if (scopes.some((s) => !s.active)) {
    throw new AccessAdminError("VALIDATION", "محدوده غیرفعال است.");
  }

  const before: Snapshot = {
    accountId: account.id,
    organizationalScopeIds: account.organizationalScopes
      .map((s) => s.organizationalScopeId)
      .sort(),
  };

  await db.$transaction(async (tx) => {
    await tx.accountOrganizationalScope.deleteMany({
      where: { accountId: account.id },
    });
    if (uniqueScopeIds.length) {
      await tx.accountOrganizationalScope.createMany({
        data: uniqueScopeIds.map((organizationalScopeId) => ({
          accountId: account.id,
          organizationalScopeId,
        })),
      });
    }
  });

  const after: Snapshot = {
    accountId: account.id,
    organizationalScopeIds: [...uniqueScopeIds].sort(),
  };
  return {
    entity: {
      accountId: account.id,
      organizationalScopeIds: uniqueScopeIds,
    },
    before,
    after,
  };
}

export async function getAccountLink(
  accountId: string,
  db: PrismaClient = getIdentityDb(),
) {
  const account = await db.internalAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      username: true,
      externalDirectoryId: true,
      status: true,
    },
  });
  if (!account) {
    throw new AccessAdminError("NOT_FOUND", "حساب یافت نشد.");
  }
  return {
    accountId: account.id,
    username: account.username,
    externalDirectoryId: account.externalDirectoryId,
    status: account.status,
  };
}

/**
 * View/clear/relink directory id only — never accepts or stores LDAP passwords.
 */
export async function updateAccountLink(
  input: {
    accountId: string;
    /** null clears the link; string sets/replaces externalDirectoryId. */
    externalDirectoryId: string | null;
  },
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<
  MutateResult<{
    accountId: string;
    externalDirectoryId: string | null;
  }>
> {
  assertToxicCombinationAllowed({
    actorAccountId: actor.accountId,
    subjectAccountId: input.accountId,
    operation: "access.account.link",
  });

  const existing = await db.internalAccount.findUnique({
    where: { id: input.accountId },
  });
  if (!existing) {
    throw new AccessAdminError("NOT_FOUND", "حساب یافت نشد.");
  }

  const nextId =
    input.externalDirectoryId === null
      ? null
      : input.externalDirectoryId.trim() || null;

  if (nextId) {
    const conflict = await db.internalAccount.findFirst({
      where: {
        externalDirectoryId: nextId,
        NOT: { id: input.accountId },
      },
    });
    if (conflict) {
      throw new AccessAdminError(
        "CONFLICT",
        "شناسهٔ دایرکتوری به حساب دیگری متصل است.",
      );
    }
  }

  const before: Snapshot = {
    accountId: existing.id,
    externalDirectoryId: existing.externalDirectoryId,
  };

  const updated = await createOrConflict(
    () =>
      db.internalAccount.update({
        where: { id: input.accountId },
        data: { externalDirectoryId: nextId },
      }),
    "شناسهٔ دایرکتوری به حساب دیگری متصل است.",
  );

  return {
    entity: {
      accountId: updated.id,
      externalDirectoryId: updated.externalDirectoryId,
    },
    before,
    after: {
      accountId: updated.id,
      externalDirectoryId: updated.externalDirectoryId,
    },
  };
}

export async function setAccountActiveStatus(
  input: { accountId: string; status: "active" | "inactive" },
  actor: AccessAdminActor,
  db: PrismaClient = getIdentityDb(),
): Promise<MutateResult<{ accountId: string; status: string }>> {
  assertToxicCombinationAllowed({
    actorAccountId: actor.accountId,
    subjectAccountId: input.accountId,
    operation: "access.account.status",
  });

  const existing = await db.internalAccount.findUnique({
    where: { id: input.accountId },
  });
  if (!existing) {
    throw new AccessAdminError("NOT_FOUND", "حساب یافت نشد.");
  }

  const before: Snapshot = {
    accountId: existing.id,
    status: existing.status,
  };

  const updated = await db.internalAccount.update({
    where: { id: input.accountId },
    data: { status: input.status },
  });

  // FR-49: directory disablement → revoke grants before next protected action.
  if (input.status === "inactive") {
    const { revokeActiveGrantsForAccount } = await import(
      "./entitlement-lifecycle"
    );
    await revokeActiveGrantsForAccount(
      input.accountId,
      "directory_disablement",
      db,
    );
  }

  return {
    entity: { accountId: updated.id, status: updated.status },
    before,
    after: { accountId: updated.id, status: updated.status },
  };
}

/**
 * Stub/preview approve-grant path — toxic guard must already block
 * self-approval and admin+approve-same-grant when matrix missing.
 * Full lifecycle approvals land in Story 2.4.
 */
export function previewApproveGrant(input: {
  actorAccountId: string;
  subjectAccountId: string;
  grantId: string;
  combinesPermissionAdminWithSameGrantApproval?: boolean;
}): { ok: true; grantId: string } {
  assertToxicCombinationAllowed({
    actorAccountId: input.actorAccountId,
    subjectAccountId: input.subjectAccountId,
    operation: "grant.approve",
    combinesPermissionAdminWithSameGrantApproval:
      input.combinesPermissionAdminWithSameGrantApproval,
  });
  return { ok: true, grantId: input.grantId };
}

export async function loadOrganizationalScopeIdsForAccount(
  accountId: string,
  db: PrismaClient = getIdentityDb(),
): Promise<string[]> {
  const rows = await db.accountOrganizationalScope.findMany({
    where: {
      accountId,
      organizationalScope: { active: true },
    },
    select: { organizationalScopeId: true },
  });
  return rows.map((r) => r.organizationalScopeId);
}

function normalizePermissionCodes(codes: string[]): string[] {
  return [
    ...new Set(
      codes
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
    ),
  ].sort();
}

/** Seed fixture ids — stable for local/dev selfcheck. */
export const SEED_ACCESS_ADMIN = {
  scopeLabelFa: "محدودهٔ نمونه",
  permissionSetName: "access-administration",
  roleCode: "access_admin",
  roleLabelFa: "مدیر دسترسی",
} as const;

/**
 * Ensure minimal access-admin fixtures and bind hr.admin.
 * Idempotent; does not grant sensitive/export categories.
 */
export async function seedAccessAdministrationFixtures(
  db: PrismaClient,
): Promise<void> {
  const permissionSet = await db.permissionSet.upsert({
    where: { name: SEED_ACCESS_ADMIN.permissionSetName },
    create: {
      name: SEED_ACCESS_ADMIN.permissionSetName,
      permissions: [ACCESS_ADMINISTRATION_PERMISSION],
    },
    update: {
      permissions: [ACCESS_ADMINISTRATION_PERMISSION],
    },
  });

  let scope = await db.organizationalScope.findFirst({
    where: { labelFa: SEED_ACCESS_ADMIN.scopeLabelFa },
  });
  if (!scope) {
    scope = await db.organizationalScope.create({
      data: {
        labelFa: SEED_ACCESS_ADMIN.scopeLabelFa,
        active: true,
      },
    });
  }

  const role = await db.accessRole.upsert({
    where: { code: SEED_ACCESS_ADMIN.roleCode },
    create: {
      code: SEED_ACCESS_ADMIN.roleCode,
      labelFa: SEED_ACCESS_ADMIN.roleLabelFa,
      permissionSetId: permissionSet.id,
    },
    update: {
      labelFa: SEED_ACCESS_ADMIN.roleLabelFa,
      permissionSetId: permissionSet.id,
    },
  });

  const hrAdmin = await db.internalAccount.findUnique({
    where: { username: "hr.admin" },
  });
  if (!hrAdmin) return;

  await db.accountAccessRole.upsert({
    where: {
      accountId_accessRoleId: {
        accountId: hrAdmin.id,
        accessRoleId: role.id,
      },
    },
    create: {
      accountId: hrAdmin.id,
      accessRoleId: role.id,
    },
    update: {},
  });

  await db.accountOrganizationalScope.upsert({
    where: {
      accountId_organizationalScopeId: {
        accountId: hrAdmin.id,
        organizationalScopeId: scope.id,
      },
    },
    create: {
      accountId: hrAdmin.id,
      organizationalScopeId: scope.id,
    },
    update: {},
  });
}
