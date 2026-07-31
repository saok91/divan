/**
 * Organizational Unit master-data writers + reads (Story 3.5 / FR-9).
 *
 * Product verbs for org hierarchy — NOT Assignment / Employment mutations.
 * AD-2: org upsert is not a substitute for Transfer/Start personnel events.
 */

import type { PrismaClient } from "@divan/db";

import { getPersonDb } from "./db";
import { normalizeDigitsForMatch, toLatinDigits } from "./digits";
import {
  MSG_CORRUPT_ORG_UNIT_TYPE_FA,
  MSG_DEACTIVATION_BLOCKED_DEPENDENCIES_FA,
  MSG_DUPLICATE_ORG_CODE_FA,
  MSG_IMPOSSIBLE_REPARENT_FA,
  MSG_INACTIVE_PARENT_FA,
  MSG_INVALID_ORG_UNIT_TYPE_FA,
  MSG_INVALID_PARENT_TYPE_FA,
  MSG_ORG_CODE_REQUIRED_FA,
  MSG_ORG_DEACTIVATE_END_REQUIRED_FA,
  MSG_ORG_NAME_REQUIRED_FA,
  MSG_ORG_UNIT_NOT_FOUND_FA,
  MSG_SENTINEL_OPTIONAL_FA,
  OrgUnitError,
  PersonIdentityError,
} from "./errors";
import { requireNonEmpty } from "./normalize";
import {
  assertChildWithinParent,
  assertValidOrgInterval,
  assertValidParentType,
  isOrgUnitActiveAsOf,
  isOrgUnitType,
  type OrgInterval,
  type OrgUnitType,
} from "./org-unit-invariants";

export type OrgUnitRecord = {
  id: string;
  code: string;
  nameFa: string;
  unitType: OrgUnitType;
  parentId: string | null;
  startDate: string;
  endDateExclusive: string | null;
  active: boolean;
  sourceEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateOrgUnitInput = {
  code: string;
  nameFa: string;
  unitType: OrgUnitType;
  parentId?: string | null;
  startDate: string;
  endDateExclusive?: string | null;
};

export type UpdateOrgUnitIdentityInput = {
  code?: string;
  nameFa?: string;
};

export type OrgUnitHierarchyNode = OrgUnitRecord & {
  children: OrgUnitHierarchyNode[];
};

/**
 * Named deactivation dependency probe.
 * Full member / Reservation / Personnel Event checks land in 3.7+ / Epic 4 /
 * AR-HEADCOUNT — do not invent disposition workflows here.
 * Returns OK when no hooks report blockers (and no active children).
 */
export type OrgUnitDependencyCheckResult = {
  blocked: boolean;
  /** Stable reason codes for logs; Persian message is on OrgUnitError. */
  reasons?: string[];
};

export type OrgUnitDependencyHook = (
  unitId: string,
  db: PrismaClient,
) => Promise<OrgUnitDependencyCheckResult>;

const dependencyHooks: OrgUnitDependencyHook[] = [];

/** Test / future Assignment hooks — fail-closed when any hook reports blocked. */
export function registerOrgUnitDependencyHook(
  hook: OrgUnitDependencyHook,
): void {
  dependencyHooks.push(hook);
}

/** Selfcheck / test cleanup only. */
export function clearOrgUnitDependencyHooksForTests(): void {
  dependencyHooks.length = 0;
}

function dateOnlyToDb(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function dateOnlyFromDb(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapOrgUnit(row: {
  id: string;
  code: string;
  nameFa: string;
  unitType: string;
  parentId: string | null;
  startDate: Date;
  endDateExclusive: Date | null;
  active: boolean;
  sourceEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OrgUnitRecord {
  if (!isOrgUnitType(row.unitType)) {
    throw new OrgUnitError(
      "VALIDATION",
      MSG_CORRUPT_ORG_UNIT_TYPE_FA,
      `corrupt_unit_type:${row.unitType}`,
    );
  }
  return {
    id: row.id,
    code: row.code,
    nameFa: row.nameFa,
    unitType: row.unitType,
    parentId: row.parentId,
    startDate: dateOnlyFromDb(row.startDate),
    endDateExclusive: row.endDateExclusive
      ? dateOnlyFromDb(row.endDateExclusive)
      : null,
    active: row.active,
    sourceEventId: row.sourceEventId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toInterval(row: OrgUnitRecord): OrgInterval {
  return {
    startDate: row.startDate,
    endDateExclusive: row.endDateExclusive,
  };
}

function requireOrgName(value: string | null | undefined): string {
  try {
    return requireNonEmpty(value, MSG_ORG_NAME_REQUIRED_FA);
  } catch (err) {
    if (err instanceof PersonIdentityError) {
      if (err.code === "SENTINEL_VALUE") {
        throw new OrgUnitError("SENTINEL_VALUE", MSG_SENTINEL_OPTIONAL_FA);
      }
      throw new OrgUnitError("VALIDATION", err.messageFa);
    }
    throw err;
  }
}

function requireOrgCode(value: string | null | undefined): string {
  try {
    const raw = requireNonEmpty(value, MSG_ORG_CODE_REQUIRED_FA);
    return toLatinDigits(raw).trim();
  } catch (err) {
    if (err instanceof PersonIdentityError) {
      if (err.code === "SENTINEL_VALUE") {
        throw new OrgUnitError("SENTINEL_VALUE", MSG_SENTINEL_OPTIONAL_FA);
      }
      throw new OrgUnitError("VALIDATION", err.messageFa);
    }
    throw err;
  }
}

async function loadParentOrThrow(
  parentId: string,
  db: PrismaClient,
): Promise<OrgUnitRecord> {
  const row = await db.organizationalUnit.findUnique({
    where: { id: parentId },
  });
  if (!row) {
    throw new OrgUnitError(
      "ORG_UNIT_NOT_FOUND",
      MSG_ORG_UNIT_NOT_FOUND_FA,
      "parent_not_found",
    );
  }
  return mapOrgUnit(row);
}

/**
 * Built-in structural gate: active children block deactivation.
 * Future Assignment / Reservation / Event hooks register via
 * {@link registerOrgUnitDependencyHook}.
 */
export async function assertOrgUnitDeactivationAllowed(
  unitId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  // Ensure Primary + Secondary Assignment hooks are registered even if seed/apply never ran.
  const { ensurePrimaryAssignmentHooksRegistered } = await import(
    "./primary-assignment"
  );
  ensurePrimaryAssignmentHooksRegistered();
  const { ensureSecondaryAssignmentHooksRegistered } = await import(
    "./secondary-assignment"
  );
  ensureSecondaryAssignmentHooksRegistered();

  const children = await db.organizationalUnit.findMany({
    where: { parentId: unitId, active: true },
    select: { id: true, code: true },
  });
  if (children.length > 0) {
    throw new OrgUnitError(
      "DEACTIVATION_BLOCKED_DEPENDENCIES",
      MSG_DEACTIVATION_BLOCKED_DEPENDENCIES_FA,
      `active_children:${children.map((c) => c.code).join(",")}`,
    );
  }

  for (const hook of dependencyHooks) {
    let result: OrgUnitDependencyCheckResult;
    try {
      result = await hook(unitId, db);
    } catch (err) {
      throw new OrgUnitError(
        "DEACTIVATION_BLOCKED_DEPENDENCIES",
        MSG_DEACTIVATION_BLOCKED_DEPENDENCIES_FA,
        err instanceof Error ? err.message : "hook_threw",
      );
    }
    if (result.blocked) {
      throw new OrgUnitError(
        "DEACTIVATION_BLOCKED_DEPENDENCIES",
        MSG_DEACTIVATION_BLOCKED_DEPENDENCIES_FA,
        result.reasons?.join(",") ?? "hook_blocked",
      );
    }
  }
}

export async function createOrgUnit(
  input: CreateOrgUnitInput,
  db: PrismaClient = getPersonDb(),
): Promise<OrgUnitRecord> {
  if (!isOrgUnitType(input.unitType)) {
    throw new OrgUnitError(
      "VALIDATION",
      MSG_INVALID_ORG_UNIT_TYPE_FA,
      `invalid_unit_type:${String(input.unitType)}`,
    );
  }

  const code = requireOrgCode(input.code);
  const nameFa = requireOrgName(input.nameFa);
  const interval = assertValidOrgInterval(
    input.startDate,
    input.endDateExclusive,
  );
  // Synced dual model: closed interval on create ⇒ inactive; open ⇒ active.
  const active = interval.endDateExclusive === null;

  const parentId =
    input.parentId === undefined || input.parentId === null
      ? null
      : input.parentId.trim() || null;

  if (input.unitType === "LEGAL_ENTITY") {
    assertValidParentType("LEGAL_ENTITY", null);
    if (parentId !== null) {
      throw new OrgUnitError(
        "INVALID_PARENT_TYPE",
        MSG_INVALID_PARENT_TYPE_FA,
        "legal_entity_parent_provided",
      );
    }
  } else {
    if (!parentId) {
      throw new OrgUnitError(
        "INVALID_PARENT_TYPE",
        MSG_INVALID_PARENT_TYPE_FA,
        "parent_required",
      );
    }
    const parent = await loadParentOrThrow(parentId, db);
    if (!parent.active) {
      throw new OrgUnitError(
        "BLOCKED_ORG_OPERATION",
        MSG_INACTIVE_PARENT_FA,
        "parent_inactive",
      );
    }
    assertValidParentType(input.unitType, parent.unitType);
    assertChildWithinParent(interval, toInterval(parent));
  }

  const existing = await db.organizationalUnit.findUnique({
    where: { code },
  });
  if (existing) {
    throw new OrgUnitError("DUPLICATE_ORG_CODE", MSG_DUPLICATE_ORG_CODE_FA);
  }

  try {
    const row = await db.organizationalUnit.create({
      data: {
        code,
        nameFa,
        unitType: input.unitType,
        parentId,
        startDate: dateOnlyToDb(interval.startDate),
        endDateExclusive: interval.endDateExclusive
          ? dateOnlyToDb(interval.endDateExclusive)
          : null,
        active,
        sourceEventId: null,
      },
    });
    return mapOrgUnit(row);
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: unknown }).code === "P2002"
    ) {
      throw new OrgUnitError("DUPLICATE_ORG_CODE", MSG_DUPLICATE_ORG_CODE_FA);
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: unknown }).code === "P2003"
    ) {
      throw new OrgUnitError(
        "ORG_UNIT_NOT_FOUND",
        MSG_ORG_UNIT_NOT_FOUND_FA,
        "fk_parent",
      );
    }
    throw err;
  }
}

export async function activateOrgUnit(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<OrgUnitRecord> {
  const existing = await getOrgUnitById(id, db);
  if (!existing) {
    throw new OrgUnitError("ORG_UNIT_NOT_FOUND", MSG_ORG_UNIT_NOT_FOUND_FA);
  }

  // Synced dual: reactivate reopens the validity interval.
  const reopened: OrgInterval = {
    startDate: existing.startDate,
    endDateExclusive: null,
  };

  if (existing.parentId) {
    const parent = await loadParentOrThrow(existing.parentId, db);
    if (!parent.active) {
      throw new OrgUnitError(
        "BLOCKED_ORG_OPERATION",
        MSG_INACTIVE_PARENT_FA,
        "parent_inactive",
      );
    }
    assertChildWithinParent(reopened, toInterval(parent));
  }

  const row = await db.organizationalUnit.update({
    where: { id },
    data: { active: true, endDateExclusive: null },
  });
  return mapOrgUnit(row);
}

export async function deactivateOrgUnit(
  id: string,
  endDateExclusive?: string | null,
  db: PrismaClient = getPersonDb(),
): Promise<OrgUnitRecord> {
  const existing = await getOrgUnitById(id, db);
  if (!existing) {
    throw new OrgUnitError("ORG_UNIT_NOT_FOUND", MSG_ORG_UNIT_NOT_FOUND_FA);
  }

  await assertOrgUnitDeactivationAllowed(id, db);

  // Synced dual: deactivate always closes the interval + active=false.
  let nextEnd = existing.endDateExclusive;
  if (endDateExclusive !== undefined && endDateExclusive !== null) {
    const closed = assertValidOrgInterval(existing.startDate, endDateExclusive);
    nextEnd = closed.endDateExclusive;
  } else if (existing.endDateExclusive === null) {
    throw new OrgUnitError(
      "INVALID_ORG_INTERVAL",
      MSG_ORG_DEACTIVATE_END_REQUIRED_FA,
      "deactivate_end_required",
    );
  }

  if (existing.parentId) {
    const parent = await loadParentOrThrow(existing.parentId, db);
    assertChildWithinParent(
      { startDate: existing.startDate, endDateExclusive: nextEnd },
      toInterval(parent),
    );
  }

  // Closing this unit must keep every child's interval ⊆ new parent interval.
  if (nextEnd !== existing.endDateExclusive) {
    const children = await db.organizationalUnit.findMany({
      where: { parentId: id },
    });
    const parentInterval: OrgInterval = {
      startDate: existing.startDate,
      endDateExclusive: nextEnd,
    };
    for (const child of children) {
      assertChildWithinParent(toInterval(mapOrgUnit(child)), parentInterval);
    }
  }

  const row = await db.organizationalUnit.update({
    where: { id },
    data: {
      active: false,
      endDateExclusive: nextEnd ? dateOnlyToDb(nextEnd) : null,
    },
  });
  return mapOrgUnit(row);
}

/**
 * Non-structural identity edits only — does not change parentId.
 */
export async function updateOrgUnitIdentity(
  id: string,
  input: UpdateOrgUnitIdentityInput,
  db: PrismaClient = getPersonDb(),
): Promise<OrgUnitRecord> {
  const existing = await getOrgUnitById(id, db);
  if (!existing) {
    throw new OrgUnitError("ORG_UNIT_NOT_FOUND", MSG_ORG_UNIT_NOT_FOUND_FA);
  }

  const data: { code?: string; nameFa?: string } = {};
  if (input.code !== undefined) {
    data.code = requireOrgCode(input.code);
  }
  if (input.nameFa !== undefined) {
    data.nameFa = requireOrgName(input.nameFa);
  }
  if (Object.keys(data).length === 0) {
    return existing;
  }

  try {
    const row = await db.organizationalUnit.update({
      where: { id },
      data,
    });
    return mapOrgUnit(row);
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: unknown }).code === "P2002"
    ) {
      throw new OrgUnitError("DUPLICATE_ORG_CODE", MSG_DUPLICATE_ORG_CODE_FA);
    }
    throw err;
  }
}

/**
 * Reparent only when type + interval nesting remain valid.
 * No force flag — impossible reparent fails closed.
 */
export async function reparentOrgUnit(
  id: string,
  newParentId: string | null,
  db: PrismaClient = getPersonDb(),
): Promise<OrgUnitRecord> {
  const existing = await getOrgUnitById(id, db);
  if (!existing) {
    throw new OrgUnitError("ORG_UNIT_NOT_FOUND", MSG_ORG_UNIT_NOT_FOUND_FA);
  }

  if (newParentId === existing.parentId) {
    return existing;
  }

  if (newParentId === id) {
    throw new OrgUnitError(
      "IMPOSSIBLE_REPARENT",
      MSG_IMPOSSIBLE_REPARENT_FA,
      "self_parent",
    );
  }

  try {
    if (existing.unitType === "LEGAL_ENTITY") {
      assertValidParentType("LEGAL_ENTITY", null);
      if (newParentId !== null) {
        throw new OrgUnitError(
          "IMPOSSIBLE_REPARENT",
          MSG_IMPOSSIBLE_REPARENT_FA,
          "legal_entity_cannot_reparent",
        );
      }
    } else {
      if (!newParentId) {
        throw new OrgUnitError(
          "IMPOSSIBLE_REPARENT",
          MSG_IMPOSSIBLE_REPARENT_FA,
          "parent_required",
        );
      }
      // Prevent cycles: walk ancestors of new parent
      let cursor: string | null = newParentId;
      const seen = new Set<string>([id]);
      while (cursor) {
        if (seen.has(cursor)) {
          throw new OrgUnitError(
            "IMPOSSIBLE_REPARENT",
            MSG_IMPOSSIBLE_REPARENT_FA,
            "cycle",
          );
        }
        seen.add(cursor);
        const ancestorRow: { parentId: string | null } | null =
          await db.organizationalUnit.findUnique({
            where: { id: cursor },
            select: { parentId: true },
          });
        cursor = ancestorRow?.parentId ?? null;
      }

      const parent = await loadParentOrThrow(newParentId, db);
      assertValidParentType(existing.unitType, parent.unitType);
      assertChildWithinParent(toInterval(existing), toInterval(parent));
    }

    const row = await db.organizationalUnit.update({
      where: { id },
      data: { parentId: newParentId },
    });
    return mapOrgUnit(row);
  } catch (err) {
    if (err instanceof OrgUnitError) {
      if (
        err.code === "INVALID_PARENT_TYPE" ||
        err.code === "CHILD_OUTSIDE_PARENT_VALIDITY"
      ) {
        throw new OrgUnitError(
          "IMPOSSIBLE_REPARENT",
          MSG_IMPOSSIBLE_REPARENT_FA,
          err.message,
        );
      }
      throw err;
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: unknown }).code === "P2003"
    ) {
      throw new OrgUnitError(
        "IMPOSSIBLE_REPARENT",
        MSG_IMPOSSIBLE_REPARENT_FA,
        "fk_parent",
      );
    }
    throw err;
  }
}

export async function getOrgUnitById(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<OrgUnitRecord | null> {
  const row = await db.organizationalUnit.findUnique({ where: { id } });
  return row ? mapOrgUnit(row) : null;
}

/**
 * Resolve org unit by business code (Latin/Persian/Arabic-Indic digits normalized).
 * Missing / empty code → null (caller maps to uniform NOT_FOUND).
 */
export async function getOrgUnitByCode(
  code: string,
  db: PrismaClient = getPersonDb(),
): Promise<OrgUnitRecord | null> {
  const latin = toLatinDigits(code).trim();
  const compact = normalizeDigitsForMatch(code);
  if (!latin && !compact) return null;
  let row = latin
    ? await db.organizationalUnit.findUnique({ where: { code: latin } })
    : null;
  if (!row && compact && compact !== latin) {
    row = await db.organizationalUnit.findUnique({ where: { code: compact } });
  }
  if (!row || !row.active) return null;
  return mapOrgUnit(row);
}

export async function getOrgUnitAsOf(
  id: string,
  asOfDate: string,
  db: PrismaClient = getPersonDb(),
): Promise<OrgUnitRecord | null> {
  const unit = await getOrgUnitById(id, db);
  if (!unit) return null;
  if (!isOrgUnitActiveAsOf(unit, asOfDate)) return null;
  return unit;
}

export async function listOrgUnits(
  options: { includeInactive?: boolean } = {},
  db: PrismaClient = getPersonDb(),
): Promise<OrgUnitRecord[]> {
  const rows = await db.organizationalUnit.findMany({
    where: options.includeInactive ? undefined : { active: true },
    orderBy: [{ unitType: "asc" }, { code: "asc" }],
  });
  return rows.map(mapOrgUnit);
}

export async function listChildren(
  parentId: string,
  options: { includeInactive?: boolean } = {},
  db: PrismaClient = getPersonDb(),
): Promise<OrgUnitRecord[]> {
  const rows = await db.organizationalUnit.findMany({
    where: {
      parentId,
      ...(options.includeInactive ? {} : { active: true }),
    },
    orderBy: { code: "asc" },
  });
  return rows.map(mapOrgUnit);
}

/**
 * Nest LE→BU→Dept→Team in memory (depth ≤ 4).
 * As-of truth = half-open interval (synced with `active` on write paths).
 * Units whose parent is not also in the as-of set are omitted (invalid nesting
 * / parent closed for that date) — never silently re-rooted.
 */
export async function getHierarchyAsOf(
  asOfDate: string,
  db: PrismaClient = getPersonDb(),
): Promise<OrgUnitHierarchyNode[]> {
  const rows = await db.organizationalUnit.findMany({
    orderBy: [{ unitType: "asc" }, { code: "asc" }],
  });
  const inInterval = rows
    .map(mapOrgUnit)
    .filter((u) => isOrgUnitActiveAsOf(u, asOfDate));
  const byId = new Map(inInterval.map((u) => [u.id, u]));
  const units = inInterval.filter(
    (u) => u.parentId === null || byId.has(u.parentId),
  );
  const byParent = new Map<string | null, OrgUnitRecord[]>();
  for (const u of units) {
    const key = u.parentId;
    const list = byParent.get(key) ?? [];
    list.push(u);
    byParent.set(key, list);
  }

  function nest(parentId: string | null): OrgUnitHierarchyNode[] {
    const kids = byParent.get(parentId) ?? [];
    return kids.map((u) => ({
      ...u,
      children: nest(u.id),
    }));
  }

  return nest(null);
}

export {
  assertValidOrgInterval,
  assertChildWithinParent,
  assertValidParentType,
  isOrgUnitActiveAsOf,
} from "./org-unit-invariants";

export type { OrgInterval, OrgUnitType } from "./org-unit-invariants";
