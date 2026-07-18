/**
 * Historical organization + headcount reconstruction coordinator (Story 4.11 / FR-27).
 * Composes Primary membership as-of, OrgUnit hierarchy as-of, and headcount ledger as-of.
 * Does not replay the event log or write a historical SoT table.
 */

import type { PrismaClient } from "@divan/db";
import {
  reconstructHeadcountQuantitiesAsOf,
  type ReconstructHeadcountQuantitiesResult,
} from "@divan/headcount";
import {
  listBusinessEventsForPersonForApply,
  listChainLinksForEvents,
  type PgQueryable,
} from "@divan/event-store";
import {
  parseDateOnly,
  todayDateOnlyTehran,
} from "@divan/temporal-engine";

import { getBaselineBoundaryDate } from "./baseline-boundary";
import {
  buildBaselineDisclosure,
  type BaselineDisclosure,
  type PersonViewSemantics,
} from "./current-person-state";
import { getPersonDb } from "./db";
import {
  MSG_ASOF_INVALID_FA,
  MSG_BASELINE_BOUNDARY_INVALID_FA,
  PersonIdentityError,
} from "./errors";
import { listEmploymentsForPerson } from "./employment";
import { listTeamMembersAsOf } from "./management-relationship";
import {
  getHierarchyAsOf,
  type OrgUnitHierarchyNode,
} from "./org-unit";
import { ORG_UNIT_TYPES, type OrgUnitType } from "./org-unit-invariants";
import {
  getRecalculationStatus,
  type RecalculationRowStatus,
  type RecalcQueryable,
} from "./personnel-event-recalc";
import { resolveLifecycleStatus } from "./personnel-event-resolve";
import { getActivePrimaryAssignmentAsOf } from "./primary-assignment";

export const MSG_HIST_ORG_RECALC_PENDING_FA =
  "بازمحاسبه برای افراد در محدوده در جریان است؛ شمارش تاریخی قطعی ارائه نمی‌شود.";

export const MSG_HIST_ORG_RECALC_FAILED_FA =
  "بازمحاسبه برای افراد در محدوده ناموفق بوده است؛ شمارش تاریخی قطعی ارائه نمی‌شود.";

export const MSG_HIST_ORG_RECALC_STALE_FA =
  "وضعیت بازمحاسبه برای افراد در محدوده کهنه است؛ شمارش تاریخی قطعی ارائه نمی‌شود.";

export const MSG_HIST_ORG_TEAM_NOT_ACTIVE_FA =
  "تیم انتخاب‌شده در تاریخ مبنا در سلسله‌مراتب فعال نیست؛ شمارش تاریخی ارائه نمی‌شود.";

export type OrgUnitCountsByType = Record<OrgUnitType, number>;

export type TeamMembershipDetail = {
  teamId: string;
  teamMembershipCount: number;
  memberPersonIds: string[];
};

export type PlannedMembershipDelta = {
  eventId: string;
  eventType: string;
  effectiveDate: string;
  sourceTeamId: string | null;
  destinationTeamId: string | null;
  /** Never labeled Effective — planned channel only. */
  channel: "planned";
};

export type HistoricalOrgHeadcountFreshnessCode =
  | "RECALCULATION_PENDING"
  | "RECALCULATION_FAILED"
  | "RECALCULATION_STALE";

export type HistoricalOrgHeadcountFreshnessBlock = {
  ok: false;
  code: HistoricalOrgHeadcountFreshnessCode;
  personId: string;
  status: RecalculationRowStatus;
  messageFa: string;
};

export type HistoricalOrgHeadcountState = {
  ok: true;
  asOf: string;
  /** Date used for membership/org/headcount facts (today when planned). */
  factsAsOf: string;
  viewSemantics: PersonViewSemantics;
  baselineDisclosure: BaselineDisclosure;
  detail: {
    teams: TeamMembershipDetail[];
    orgUnitCounts: OrgUnitCountsByType;
    headcount: ReconstructHeadcountQuantitiesResult;
  };
  aggregate: {
    teamMembershipCount: number;
    orgUnitCounts: OrgUnitCountsByType;
    approved: number;
    used: number;
    reserved: number;
    free: number;
  };
  /**
   * Planned channel (future asOf only): Scheduled transfers with
   * today < effectiveDate <= asOf. Empty for current/historical.
   */
  plannedMembershipDeltas: PlannedMembershipDelta[];
};

export type GetHistoricalOrgHeadcountStateResult =
  | HistoricalOrgHeadcountState
  | HistoricalOrgHeadcountFreshnessBlock;

export type GetHistoricalOrgHeadcountStateOptions = {
  asOf?: string;
  /** When set, restrict membership + headcount to this Team. */
  teamId?: string;
  baselineBoundaryDate?: string | null;
};

export type GetHistoricalOrgHeadcountStateDeps = {
  personDb?: PrismaClient;
  eventDb: PgQueryable & RecalcQueryable;
};

function resolveViewSemantics(
  asOf: string,
  today: string,
): PersonViewSemantics {
  if (asOf > today) return "planned";
  if (asOf === today) return "current";
  return "historical";
}

function resolveBaselineBoundaryOverride(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = parseDateOnly(trimmed);
  if (!parsed.ok) {
    throw new PersonIdentityError(
      "VALIDATION",
      MSG_BASELINE_BOUNDARY_INVALID_FA,
      parsed.reason,
    );
  }
  return parsed.value;
}

function emptyOrgUnitCounts(): OrgUnitCountsByType {
  return {
    LEGAL_ENTITY: 0,
    BUSINESS_UNIT: 0,
    DEPARTMENT: 0,
    TEAM: 0,
  };
}

function countOrgUnitsByType(
  nodes: OrgUnitHierarchyNode[],
): OrgUnitCountsByType {
  const counts = emptyOrgUnitCounts();
  const walk = (n: OrgUnitHierarchyNode) => {
    if ((ORG_UNIT_TYPES as readonly string[]).includes(n.unitType)) {
      counts[n.unitType] += 1;
    }
    for (const child of n.children) walk(child);
  };
  for (const root of nodes) walk(root);
  return counts;
}

function collectTeamIds(
  nodes: OrgUnitHierarchyNode[],
  filterTeamId?: string,
): string[] {
  const ids: string[] = [];
  const walk = (n: OrgUnitHierarchyNode) => {
    if (n.unitType === "TEAM") {
      if (!filterTeamId || n.id === filterTeamId) ids.push(n.id);
    }
    for (const child of n.children) walk(child);
  };
  for (const root of nodes) walk(root);
  return ids;
}

function freshnessCodeForStatus(
  status: RecalculationRowStatus,
): HistoricalOrgHeadcountFreshnessCode | null {
  if (status === "pending") return "RECALCULATION_PENDING";
  if (status === "failed") return "RECALCULATION_FAILED";
  if (status === "stale") return "RECALCULATION_STALE";
  return null;
}

function freshnessMessageFa(code: HistoricalOrgHeadcountFreshnessCode): string {
  if (code === "RECALCULATION_PENDING") return MSG_HIST_ORG_RECALC_PENDING_FA;
  if (code === "RECALCULATION_FAILED") return MSG_HIST_ORG_RECALC_FAILED_FA;
  return MSG_HIST_ORG_RECALC_STALE_FA;
}

/**
 * Oracle helper: deep-equal detail rollup vs aggregate under the metric catalogue.
 * Ignores wall-clock / non-catalogue metadata.
 */
export function historicalOrgHeadcountFactsForCompare(
  state: HistoricalOrgHeadcountState,
): unknown {
  return {
    asOf: state.asOf,
    factsAsOf: state.factsAsOf,
    viewSemantics: state.viewSemantics,
    baselineDisclosure: {
      configured: state.baselineDisclosure.configured,
      boundaryDate: state.baselineDisclosure.boundaryDate,
      limited: state.baselineDisclosure.limited,
    },
    detail: {
      teams: [...state.detail.teams]
        .map((t) => ({
          teamId: t.teamId,
          teamMembershipCount: t.teamMembershipCount,
          memberPersonIds: [...t.memberPersonIds].sort(),
        }))
        .sort((a, b) => a.teamId.localeCompare(b.teamId)),
      orgUnitCounts: { ...state.detail.orgUnitCounts },
      headcount: {
        asOf: state.detail.headcount.asOf,
        slots: [...state.detail.headcount.slots]
          .map((s) => ({
            slotId: s.slotId,
            teamId: s.teamId,
            approved: s.approved,
            used: s.used,
            reserved: s.reserved,
            free: s.free,
          }))
          .sort((a, b) => a.slotId.localeCompare(b.slotId)),
        aggregate: { ...state.detail.headcount.aggregate },
      },
    },
    aggregate: { ...state.aggregate },
    plannedMembershipDeltas: [...state.plannedMembershipDeltas]
      .map((d) => ({
        eventId: d.eventId,
        eventType: d.eventType,
        effectiveDate: d.effectiveDate,
        sourceTeamId: d.sourceTeamId,
        destinationTeamId: d.destinationTeamId,
        channel: d.channel,
      }))
      .sort((a, b) => a.eventId.localeCompare(b.eventId)),
  };
}

async function loadPlannedTransferDeltas(
  personIds: string[],
  today: string,
  asOf: string,
  eventDb: PgQueryable,
  personDb: PrismaClient,
): Promise<PlannedMembershipDelta[]> {
  const deltas: PlannedMembershipDelta[] = [];
  const seen = new Set<string>();

  for (const personId of personIds) {
    const events = await listBusinessEventsForPersonForApply(eventDb, personId, {
      limit: 2000,
    });
    const transferish = events.filter(
      (e) =>
        e.eventType === "TransferRecorded" &&
        e.effectiveDate > today &&
        e.effectiveDate <= asOf,
    );
    if (transferish.length === 0) continue;
    const links = await listChainLinksForEvents(
      eventDb,
      transferish.map((e) => e.id),
    );
    const employments = await listEmploymentsForPerson(personId, personDb);
    for (const ev of transferish) {
      if (seen.has(ev.id)) continue;
      const resolved = resolveLifecycleStatus(
        ev,
        links.get(ev.id) ?? {
          cancellations: [],
          reversals: [],
          corrections: [],
        },
        today,
      );
      if (resolved !== "Scheduled") continue;
      seen.add(ev.id);
      const payload = ev.payload as Record<string, unknown>;
      const dest =
        typeof payload.teamId === "string" ? payload.teamId : null;
      const payloadEmpId =
        typeof payload.employmentId === "string"
          ? payload.employmentId
          : null;
      const employmentId = payloadEmpId ?? employments[0]?.id ?? null;
      let source: string | null = null;
      if (employmentId) {
        const primary = await getActivePrimaryAssignmentAsOf(
          employmentId,
          today,
          personDb,
        );
        source = primary?.teamId ?? null;
      }
      deltas.push({
        eventId: ev.id,
        eventType: ev.eventType,
        effectiveDate: ev.effectiveDate,
        sourceTeamId: source,
        destinationTeamId: dest,
        channel: "planned",
      });
    }
  }

  return deltas.sort((a, b) =>
    a.effectiveDate === b.effectiveDate
      ? a.eventId.localeCompare(b.eventId)
      : a.effectiveDate.localeCompare(b.effectiveDate),
  );
}

type LedgerPersonRow = { person_id: string };

/** Person ids on in-scope capacity ledger rows (consumption + reservation). */
async function listLedgerPersonIdsInScope(
  eventDb: PgQueryable,
  factsAsOf: string,
  scopeTeamId: string | undefined,
): Promise<string[]> {
  const params: unknown[] = [factsAsOf];
  let teamFilter = "";
  if (scopeTeamId) {
    params.push(scopeTeamId);
    teamFilter = ` AND s.team_id = $${params.length}::uuid`;
  }
  const rows = await eventDb.query<LedgerPersonRow>(
    `SELECT DISTINCT person_id FROM (
       SELECT c.person_id
       FROM headcount_capacity_consumption c
       INNER JOIN headcount_capacity_slot s ON s.id = c.slot_id
       WHERE s.start_date <= $1::date
         AND (s.end_date_exclusive IS NULL OR s.end_date_exclusive > $1::date)
         ${teamFilter}
       UNION
       SELECT r.person_id
       FROM headcount_capacity_reservation r
       INNER JOIN headcount_capacity_slot s ON s.id = r.slot_id
       WHERE s.start_date <= $1::date
         AND (s.end_date_exclusive IS NULL OR s.end_date_exclusive > $1::date)
         ${teamFilter}
     ) p`,
    params,
  );
  return rows.rows.map((r) => r.person_id);
}

/**
 * Compose org membership counts + unit-type counts + headcount ledger as-of.
 */
export async function getHistoricalOrgHeadcountState(
  options: GetHistoricalOrgHeadcountStateOptions,
  deps: GetHistoricalOrgHeadcountStateDeps,
): Promise<GetHistoricalOrgHeadcountStateResult> {
  const today = todayDateOnlyTehran();
  let asOf: string;
  if (options.asOf !== undefined) {
    const parsed = parseDateOnly(options.asOf);
    if (!parsed.ok) {
      throw new PersonIdentityError(
        "VALIDATION",
        MSG_ASOF_INVALID_FA,
        parsed.reason,
      );
    }
    asOf = parsed.value;
  } else {
    asOf = today;
  }

  const viewSemantics = resolveViewSemantics(asOf, today);
  const factsAsOf = viewSemantics === "planned" ? today : asOf;

  const boundary =
    options.baselineBoundaryDate !== undefined
      ? resolveBaselineBoundaryOverride(options.baselineBoundaryDate)
      : getBaselineBoundaryDate();
  const baselineDisclosure = buildBaselineDisclosure(asOf, boundary);

  const personDb = deps.personDb ?? getPersonDb();
  const { eventDb } = deps;
  const scopeTeamId = options.teamId?.trim() || undefined;

  const hierarchy = await getHierarchyAsOf(factsAsOf, personDb);
  const orgUnitCounts = countOrgUnitsByType(hierarchy);
  const teamIds = collectTeamIds(hierarchy, scopeTeamId);

  if (scopeTeamId && !teamIds.includes(scopeTeamId)) {
    throw new PersonIdentityError(
      "VALIDATION",
      MSG_HIST_ORG_TEAM_NOT_ACTIVE_FA,
      "team_not_active_as_of",
    );
  }

  const teams: TeamMembershipDetail[] = [];
  const allMemberIds = new Set<string>();

  for (const teamId of teamIds) {
    const members = await listTeamMembersAsOf(teamId, factsAsOf, {}, personDb);
    teams.push({
      teamId,
      teamMembershipCount: members.length,
      memberPersonIds: members,
    });
    for (const id of members) allMemberIds.add(id);
  }

  const ledgerPersonIds = await listLedgerPersonIdsInScope(
    eventDb,
    factsAsOf,
    scopeTeamId,
  );
  for (const id of ledgerPersonIds) allMemberIds.add(id);

  // Freshness: fail-closed if any counted / ledger person has pending/failed/stale recalc.
  for (const personId of allMemberIds) {
    const recalc = await getRecalculationStatus(eventDb, personId);
    if (recalc) {
      const code = freshnessCodeForStatus(recalc.status);
      if (code) {
        return {
          ok: false,
          code,
          personId,
          status: recalc.status,
          messageFa: freshnessMessageFa(code),
        };
      }
    }
  }

  const headcount = await reconstructHeadcountQuantitiesAsOf(eventDb, {
    asOf: factsAsOf,
    teamId: scopeTeamId,
  });

  // When scoped to a team that has no slots, still return empty headcount OK.
  const teamMembershipCount = teams.reduce(
    (sum, t) => sum + t.teamMembershipCount,
    0,
  );

  let plannedMembershipDeltas: PlannedMembershipDelta[] = [];
  if (viewSemantics === "planned") {
    // Scan members at today + any person with future transfers is harder;
    // use today's members in scope as the seed set (MVP).
    plannedMembershipDeltas = await loadPlannedTransferDeltas(
      [...allMemberIds],
      today,
      asOf,
      eventDb,
      personDb,
    );
  }

  return {
    ok: true,
    asOf,
    factsAsOf,
    viewSemantics,
    baselineDisclosure,
    detail: {
      teams: teams.sort((a, b) => a.teamId.localeCompare(b.teamId)),
      orgUnitCounts,
      headcount,
    },
    aggregate: {
      teamMembershipCount,
      orgUnitCounts: { ...orgUnitCounts },
      approved: headcount.aggregate.approved,
      used: headcount.aggregate.used,
      reserved: headcount.aggregate.reserved,
      free: headcount.aggregate.free,
    },
    plannedMembershipDeltas,
  };
}
