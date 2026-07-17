/**
 * Derived management relationships — pure derive/read (Story 3.9 / FR-13).
 *
 * Computed from Primary Assignment + OrgUnit hierarchy + Role registry.
 * AD-2: not event-store truth; not an editable shadow table.
 *
 * Do NOT export setManager / assignManager / createManagementRelationship /
 * updateReportingLine. Do NOT read Secondary for derivation.
 *
 * Ambiguity policy (review Decision B): `deriveManagementEdgesAsOf` throws the
 * same typed fail-closed errors as access paths (`resolveTeamManagerAsOf` /
 * `listManagedPersonsAsOf`) — never silent skip / invent a winner.
 */

import type { PrismaClient } from "@divan/db";
import { dateOnlyInInterval } from "@divan/temporal-engine";

import { getPersonDb } from "./db";
import {
  ManagementRelationshipError,
  MSG_ORG_UNIT_NOT_FOUND_FA,
} from "./errors";
import {
  assertValidAsOfDate,
  intersectHalfOpenIntervals,
  throwAmbiguousManagementScope,
  throwAmbiguousTeamManager,
  type HalfOpenInterval,
} from "./management-relationship-invariants";
import {
  AR_MANAGEMENT_ROLE_REGISTRY,
  isMiddleManagerRoleCode,
  isSeniorManagerRoleCode,
  normalizeManagementRoleCode,
} from "./management-role-registry";
import { getOrgUnitAsOf, listChildren } from "./org-unit";
import { resolveTeamMembershipAsOf } from "./primary-assignment";

export type TeamManagerAsOf = {
  managerPersonId: string;
  primaryAssignmentId: string;
  organizationalRoleId: string;
};

export type ManagementEdge = {
  managerPersonId: string;
  subjectPersonId: string;
  scopeKind: "team" | "senior";
  orgUnitId: string;
  validFrom: string;
  validToExclusive: string | null;
};

/**
 * PopulationPort-compatible edge shape (Story 2.6 / FR-47).
 * `subjectId` = Person UUID. Manager account resolved via injected mapper.
 */
export type PopulationManagementRelationship = {
  managerAccountId: string;
  subjectId: string;
  validFrom: string;
  validToExclusive: string | null;
};

export type ListTeamMembersOptions = {
  /** Default true — include the Team manager Person when they also have membership. */
  includeManager?: boolean;
};

type PrimaryWithRole = {
  id: string;
  employmentId: string;
  teamId: string;
  organizationalRoleId: string;
  startDate: string;
  endDateExclusive: string | null;
  roleCode: string;
  personId: string;
};

function dateOnlyToDb(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function dateOnlyFromDb(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function asOfFilter(asOf: string): {
  startDate: { lte: Date };
  OR: Array<{ endDateExclusive: null } | { endDateExclusive: { gt: Date } }>;
} {
  const d = dateOnlyToDb(asOf);
  return {
    startDate: { lte: d },
    OR: [{ endDateExclusive: null }, { endDateExclusive: { gt: d } }],
  };
}

/** Employment half-open active as-of — aligns with `resolveTeamMembershipAsOf`. */
function employmentActiveAsOfFilter(asOf: string): {
  startDate: { lte: Date };
  OR: Array<{ endDateExclusive: null } | { endDateExclusive: { gt: Date } }>;
} {
  return asOfFilter(asOf);
}

async function requireTeamOrgUnitAsOf(
  teamId: string,
  asOf: string,
  db: PrismaClient,
): Promise<{ id: string }> {
  const team = await getOrgUnitAsOf(teamId, asOf, db);
  if (!team || team.unitType !== "TEAM") {
    throw new ManagementRelationshipError(
      "ORG_UNIT_NOT_FOUND",
      MSG_ORG_UNIT_NOT_FOUND_FA,
      teamId,
    );
  }
  return team;
}

function mapPrimaryWithRole(r: {
  id: string;
  employmentId: string;
  teamId: string;
  organizationalRoleId: string;
  startDate: Date;
  endDateExclusive: Date | null;
  organizationalRole: { code: string };
  employment: { personId: string };
}): PrimaryWithRole {
  return {
    id: r.id,
    employmentId: r.employmentId,
    teamId: r.teamId,
    organizationalRoleId: r.organizationalRoleId,
    startDate: dateOnlyFromDb(r.startDate),
    endDateExclusive: r.endDateExclusive
      ? dateOnlyFromDb(r.endDateExclusive)
      : null,
    roleCode: r.organizationalRole.code,
    personId: r.employment.personId,
  };
}

async function loadActivePrimariesOnTeamAsOf(
  teamId: string,
  asOf: string,
  db: PrismaClient,
): Promise<PrimaryWithRole[]> {
  const rows = await db.primaryAssignment.findMany({
    where: {
      teamId,
      ...asOfFilter(asOf),
      employment: employmentActiveAsOfFilter(asOf),
    },
    include: {
      organizationalRole: { select: { code: true } },
      employment: { select: { personId: true } },
    },
  });
  return rows.map(mapPrimaryWithRole);
}

async function loadActivePrimariesForPersonAsOf(
  personId: string,
  asOf: string,
  db: PrismaClient,
): Promise<PrimaryWithRole[]> {
  const rows = await db.primaryAssignment.findMany({
    where: {
      ...asOfFilter(asOf),
      employment: {
        personId,
        ...employmentActiveAsOfFilter(asOf),
      },
    },
    include: {
      organizationalRole: { select: { code: true } },
      employment: { select: { personId: true } },
    },
  });
  return rows.map(mapPrimaryWithRole);
}

/**
 * Resolve the unique middle-manager for a Team as-of.
 * 0 → null; 1 → success; >1 → AMBIGUOUS_TEAM_MANAGER (fail-closed).
 * Secondary Assignment is never consulted.
 */
export async function resolveTeamManagerAsOf(
  teamId: string,
  asOf: string,
  db: PrismaClient = getPersonDb(),
): Promise<TeamManagerAsOf | null> {
  const asOfDate = assertValidAsOfDate(asOf);
  await requireTeamOrgUnitAsOf(teamId, asOfDate, db);

  const candidates = (await loadActivePrimariesOnTeamAsOf(teamId, asOfDate, db))
    .filter((p) => isMiddleManagerRoleCode(p.roleCode));

  if (candidates.length === 0) return null;
  if (candidates.length > 1) {
    throwAmbiguousTeamManager(
      `team=${teamId};asOf=${asOfDate};count=${candidates.length}`,
    );
  }

  const hit = candidates[0]!;
  return {
    managerPersonId: hit.personId,
    primaryAssignmentId: hit.id,
    organizationalRoleId: hit.organizationalRoleId,
  };
}

/**
 * Person ids with Primary Team membership on `teamId` as-of.
 * Reuses `resolveTeamMembershipAsOf` path semantics (Primary only).
 */
export async function listTeamMembersAsOf(
  teamId: string,
  asOf: string,
  options: ListTeamMembersOptions = {},
  db: PrismaClient = getPersonDb(),
): Promise<string[]> {
  const asOfDate = assertValidAsOfDate(asOf);
  const includeManager = options.includeManager !== false;

  await requireTeamOrgUnitAsOf(teamId, asOfDate, db);

  const onTeam = await loadActivePrimariesOnTeamAsOf(teamId, asOfDate, db);
  const personIds = [...new Set(onTeam.map((p) => p.personId))];

  // Confirm Team membership via Primary-only helper (FR-11 / FR-13).
  const verified: string[] = [];
  for (const personId of personIds) {
    const membership = await resolveTeamMembershipAsOf(personId, asOfDate, db);
    if (membership?.teamId === teamId) {
      verified.push(personId);
    }
  }

  if (includeManager) return verified;

  const manager = await resolveTeamManagerAsOf(teamId, asOfDate, db);
  if (!manager) return verified;
  return verified.filter((id) => id !== manager.managerPersonId);
}

/**
 * MVP senior scope rule (documented — pending AR-ACCESS matrix):
 * Senior-manager Primary still sits on a TEAM (3.7 schema unchanged).
 * Scope org unit = **Department parent** of that Team when the Role is in
 * `seniorManagerRoleCodes`. Managed population = Persons whose Primary Team
 * sits under that Department subtree as-of.
 */
export async function resolveSeniorManagerScopeOrgUnitAsOf(
  managerPersonId: string,
  asOf: string,
  db: PrismaClient = getPersonDb(),
): Promise<{ orgUnitId: string; unitType: string; primaryAssignmentId: string } | null> {
  const asOfDate = assertValidAsOfDate(asOf);
  const primaries = await loadActivePrimariesForPersonAsOf(
    managerPersonId,
    asOfDate,
    db,
  );
  const senior = primaries.filter((p) => isSeniorManagerRoleCode(p.roleCode));
  if (senior.length === 0) return null;
  if (senior.length > 1) {
    throwAmbiguousManagementScope(
      `senior_primaries=${senior.length};person=${managerPersonId};asOf=${asOfDate}`,
    );
  }

  const hit = senior[0]!;
  const team = await getOrgUnitAsOf(hit.teamId, asOfDate, db);
  if (!team || team.unitType !== "TEAM" || !team.parentId) {
    throw new ManagementRelationshipError(
      "ORG_UNIT_NOT_FOUND",
      MSG_ORG_UNIT_NOT_FOUND_FA,
      `senior_team_or_parent:${hit.teamId}`,
    );
  }
  const dept = await getOrgUnitAsOf(team.parentId, asOfDate, db);
  if (!dept || dept.unitType !== "DEPARTMENT") {
    throw new ManagementRelationshipError(
      "ORG_UNIT_NOT_FOUND",
      MSG_ORG_UNIT_NOT_FOUND_FA,
      `senior_dept:${team.parentId}`,
    );
  }
  return {
    orgUnitId: dept.id,
    unitType: dept.unitType,
    primaryAssignmentId: hit.id,
  };
}

/** Collect TEAM unit ids under an org unit (inclusive if unit itself is TEAM). */
async function collectTeamIdsUnder(
  rootOrgUnitId: string,
  asOf: string,
  db: PrismaClient,
): Promise<string[]> {
  const root = await getOrgUnitAsOf(rootOrgUnitId, asOf, db);
  if (!root) {
    throw new ManagementRelationshipError(
      "ORG_UNIT_NOT_FOUND",
      MSG_ORG_UNIT_NOT_FOUND_FA,
      rootOrgUnitId,
    );
  }

  const teamIds: string[] = [];
  if (root.unitType === "TEAM") {
    teamIds.push(root.id);
    return teamIds;
  }

  async function walk(parentId: string): Promise<void> {
    const kids = await listChildren(parentId, { includeInactive: true }, db);
    for (const child of kids) {
      if (!dateOnlyInInterval(asOf, child.startDate, child.endDateExclusive)) {
        continue;
      }
      if (child.unitType === "TEAM") {
        teamIds.push(child.id);
      } else {
        await walk(child.id);
      }
    }
  }
  await walk(root.id);
  return teamIds;
}

/**
 * Subject Person ids managed by `managerPersonId` as-of.
 * Middle-manager: members of Teams where this Person is the unique Team manager.
 * Senior-manager: Persons whose Primary teamId is under the scoped Department.
 * Ambiguous Team under span → AMBIGUOUS_TEAM_MANAGER / AMBIGUOUS_MANAGEMENT_SCOPE.
 */
export async function listManagedPersonsAsOf(
  managerPersonId: string,
  asOf: string,
  db: PrismaClient = getPersonDb(),
): Promise<string[]> {
  const asOfDate = assertValidAsOfDate(asOf);
  const subjects = new Set<string>();

  // Middle-manager path: teams where this person is the unique resolved manager
  const allTeams = await db.organizationalUnit.findMany({
    where: { unitType: "TEAM" },
    select: { id: true },
  });
  for (const t of allTeams) {
    let resolved: TeamManagerAsOf | null;
    try {
      resolved = await resolveTeamManagerAsOf(t.id, asOfDate, db);
    } catch (err) {
      if (
        err instanceof ManagementRelationshipError &&
        err.code === "ORG_UNIT_NOT_FOUND"
      ) {
        // Team inactive / not TEAM as-of — not in scope for this as-of
        continue;
      }
      if (
        err instanceof ManagementRelationshipError &&
        err.code === "AMBIGUOUS_TEAM_MANAGER"
      ) {
        // Only fail-closed when this manager is among the ambiguous candidates
        const candidates = (
          await loadActivePrimariesOnTeamAsOf(t.id, asOfDate, db)
        ).filter((p) => isMiddleManagerRoleCode(p.roleCode));
        if (candidates.some((c) => c.personId === managerPersonId)) {
          throw err;
        }
        continue;
      }
      throw err;
    }
    if (resolved?.managerPersonId !== managerPersonId) continue;
    const members = await listTeamMembersAsOf(t.id, asOfDate, {}, db);
    for (const m of members) {
      if (m !== managerPersonId) subjects.add(m);
    }
  }

  // Senior-manager path: Department subtree
  const seniorScope = await resolveSeniorManagerScopeOrgUnitAsOf(
    managerPersonId,
    asOfDate,
    db,
  );
  if (seniorScope) {
    const teamIds = await collectTeamIdsUnder(
      seniorScope.orgUnitId,
      asOfDate,
      db,
    );
    for (const teamId of teamIds) {
      // Ambiguity on any team in senior span fails closed for access paths
      try {
        await resolveTeamManagerAsOf(teamId, asOfDate, db);
      } catch (err) {
        if (
          err instanceof ManagementRelationshipError &&
          err.code === "AMBIGUOUS_TEAM_MANAGER"
        ) {
          throwAmbiguousManagementScope(
            `senior_span_team=${teamId};asOf=${asOfDate}`,
          );
        }
        throw err;
      }
      const members = await listTeamMembersAsOf(teamId, asOfDate, {}, db);
      for (const m of members) {
        if (m !== managerPersonId) subjects.add(m);
      }
    }
  }

  return [...subjects].sort();
}

/**
 * Reporting edges for FR-36 foreshadow.
 * Interval = intersection of manager Primary interval ∩ subject Primary interval.
 * Ambiguity → same typed fail-closed errors as access paths (Decision B).
 */
export async function deriveManagementEdgesAsOf(
  asOf: string,
  db: PrismaClient = getPersonDb(),
): Promise<ManagementEdge[]> {
  const asOfDate = assertValidAsOfDate(asOf);
  const edges: ManagementEdge[] = [];
  const seen = new Set<string>();

  const allTeams = await db.organizationalUnit.findMany({
    where: { unitType: "TEAM" },
    select: { id: true },
  });

  for (const t of allTeams) {
    // Inactive / non-TEAM as-of → skip (not found for this as-of)
    try {
      await requireTeamOrgUnitAsOf(t.id, asOfDate, db);
    } catch (err) {
      if (
        err instanceof ManagementRelationshipError &&
        err.code === "ORG_UNIT_NOT_FOUND"
      ) {
        continue;
      }
      throw err;
    }

    const manager = await resolveTeamManagerAsOf(t.id, asOfDate, db);
    if (!manager) continue;

    const managerPrimaries = await loadActivePrimariesForPersonAsOf(
      manager.managerPersonId,
      asOfDate,
      db,
    );
    const mgrPrimary = managerPrimaries.find(
      (p) => p.id === manager.primaryAssignmentId,
    );
    if (!mgrPrimary) continue;

    const mgrInterval: HalfOpenInterval = {
      startDate: mgrPrimary.startDate,
      endDateExclusive: mgrPrimary.endDateExclusive,
    };

    const onTeam = await loadActivePrimariesOnTeamAsOf(t.id, asOfDate, db);
    for (const member of onTeam) {
      if (member.personId === manager.managerPersonId) continue;
      const intersection = intersectHalfOpenIntervals(mgrInterval, {
        startDate: member.startDate,
        endDateExclusive: member.endDateExclusive,
      });
      if (!intersection) continue;
      if (
        !dateOnlyInInterval(
          asOfDate,
          intersection.startDate,
          intersection.endDateExclusive,
        )
      ) {
        continue;
      }
      const key = `team:${manager.managerPersonId}:${member.personId}:${t.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        managerPersonId: manager.managerPersonId,
        subjectPersonId: member.personId,
        scopeKind: "team",
        orgUnitId: t.id,
        validFrom: intersection.startDate,
        validToExclusive: intersection.endDateExclusive,
      });
    }
  }

  // Senior edges: managers with senior Role → subjects under Department
  const seniorRoleCodes = AR_MANAGEMENT_ROLE_REGISTRY.seniorManagerRoleCodes.map(
    (c) => normalizeManagementRoleCode(c),
  );
  const seniorPrimaries = await db.primaryAssignment.findMany({
    where: {
      ...asOfFilter(asOfDate),
      employment: employmentActiveAsOfFilter(asOfDate),
      organizationalRole: { code: { in: seniorRoleCodes } },
    },
    include: {
      organizationalRole: { select: { code: true } },
      employment: { select: { personId: true } },
    },
  });

  for (const row of seniorPrimaries) {
    if (!isSeniorManagerRoleCode(row.organizationalRole.code)) continue;
    const managerPersonId = row.employment.personId;
    const scope = await resolveSeniorManagerScopeOrgUnitAsOf(
      managerPersonId,
      asOfDate,
      db,
    );
    if (!scope) continue;

    const mgrInterval: HalfOpenInterval = {
      startDate: dateOnlyFromDb(row.startDate),
      endDateExclusive: row.endDateExclusive
        ? dateOnlyFromDb(row.endDateExclusive)
        : null,
    };

    const teamIds = await collectTeamIdsUnder(scope.orgUnitId, asOfDate, db);
    for (const teamId of teamIds) {
      try {
        await resolveTeamManagerAsOf(teamId, asOfDate, db);
      } catch (err) {
        if (
          err instanceof ManagementRelationshipError &&
          err.code === "AMBIGUOUS_TEAM_MANAGER"
        ) {
          throwAmbiguousManagementScope(
            `senior_span_team=${teamId};asOf=${asOfDate}`,
          );
        }
        throw err;
      }

      const onTeam = await loadActivePrimariesOnTeamAsOf(teamId, asOfDate, db);
      for (const member of onTeam) {
        if (member.personId === managerPersonId) continue;
        const intersection = intersectHalfOpenIntervals(mgrInterval, {
          startDate: member.startDate,
          endDateExclusive: member.endDateExclusive,
        });
        if (!intersection) continue;
        if (
          !dateOnlyInInterval(
            asOfDate,
            intersection.startDate,
            intersection.endDateExclusive,
          )
        ) {
          continue;
        }
        const key = `senior:${managerPersonId}:${member.personId}:${scope.orgUnitId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({
          managerPersonId,
          subjectPersonId: member.personId,
          scopeKind: "senior",
          orgUnitId: scope.orgUnitId,
          validFrom: intersection.startDate,
          validToExclusive: intersection.endDateExclusive,
        });
      }
    }
  }

  return edges;
}

/**
 * Adapter: Person-centric edges → PopulationPort `ManagementRelationship` shape.
 * Person→AccountId resolver is **injected** — no permanent Person.accountId FK.
 * Rows without a resolvable manager account are omitted (fail-closed, not invent).
 * Duplicate managerAccountId+subjectId pairs are collapsed (first wins).
 */
export function buildManagementRelationshipsFromDerivation(
  edges: ReadonlyArray<ManagementEdge>,
  resolveAccountIdForPerson: (personId: string) => string | null | undefined,
): PopulationManagementRelationship[] {
  const out: PopulationManagementRelationship[] = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    const accountId = resolveAccountIdForPerson(edge.managerPersonId);
    if (!accountId) continue;
    const key = `${accountId}:${edge.subjectPersonId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      managerAccountId: accountId,
      subjectId: edge.subjectPersonId,
      validFrom: edge.validFrom,
      validToExclusive: edge.validToExclusive,
    });
  }
  return out;
}
