/**
 * Dashboard metric assembly (Story 5.4 / FR-35).
 * Composes published person-employment / headcount / event-store APIs —
 * AD-3: no private table reads from other modules.
 */

import type { Pool, PoolClient } from "@divan/db";
import {
  HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS,
  HeadcountLedgerError,
  effectiveApprovalStatus,
  isApprovalConsumableAt,
  isApprovalExpiryWithinWarningHorizon,
  listApprovals,
  type HeadcountApprovalRecord,
} from "@divan/headcount";
import {
  listBusinessEventsForPersonForApply,
  type BusinessEventRecord,
} from "@divan/event-store";
import {
  MSG_HIST_ORG_TEAM_NOT_ACTIVE_FA,
  PersonIdentityError,
  getHistoricalOrgHeadcountState,
  isEmploymentActiveAsOf,
  listEmploymentsForPerson,
  type GetHistoricalOrgHeadcountStateResult,
  type OrgUnitCountsByType,
} from "@divan/person-employment";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  assertHeadcountConservation,
  MSG_DASHBOARD_HEADCOUNT_CONSERVATION_FA,
} from "./headcount-conservation";
import {
  LAUNCH_METRIC_DEFINITIONS,
  type LaunchMetricKey,
  requireLaunchMetricCatalogue,
} from "./metric-catalogue";
import {
  aggregateStartsTerminations,
  buildWorkforceTrendBuckets,
  type TrendBucket,
  type TrendGranularity,
} from "./workforce-events";
import {
  capacityReconcileHref,
  eventsReconcileHref,
  personnelListReconcileHref,
} from "./reconcile-href";

export type DashboardMetricOutcome =
  | "allowed"
  | "empty"
  | "suppressed"
  | "error"
  | "pending"
  | "omitted";

export type DashboardMetricCardDto = {
  key: LaunchMetricKey;
  titleFa: string;
  outcome: DashboardMetricOutcome;
  /** Numeric primary value — null when suppress/error/pending/omitted. */
  value: number | null;
  messageFa?: string;
  reconcileHref?: string;
  reconcileLabelFa?: string;
  /** Secondary structured facts for compound cards. */
  details?: Record<string, number | string | boolean | null>;
  trend?: TrendBucket[];
};

export type DashboardSnapshotFilter = {
  asOf: string;
  teamId?: string;
  trendRangeStart: string;
  trendRangeEnd: string;
  trendGranularity: TrendGranularity;
};

export type DashboardSnapshotCaps = {
  /** When false, org/HC/team cards omitted (not zero). */
  hasOrganizationRead: boolean;
  /** When false, open-headcount / near-expiry card omitted. */
  hasHeadcountApprovalRead: boolean;
};

export type AssembleDashboardSnapshotInput = {
  /** Authorized subject ids AFTER PopulationPort ∩ InferenceBulk. */
  subjectIds: readonly string[];
  /** Retrieval-plane outcome for the cohort. */
  retrievalOutcome: "allowed" | "empty" | "suppressed";
  suppressedMessageFa?: string;
  emptyMessageFa: string;
  filter: DashboardSnapshotFilter;
  caps: DashboardSnapshotCaps;
  eventDb: Pool | PoolClient;
  /** Optional injected historical state (tests / parity). */
  historicalState?: GetHistoricalOrgHeadcountStateResult;
  /** Optional injected approvals (tests). */
  approvals?: HeadcountApprovalRecord[];
  /** Optional injected events by person (tests). */
  eventsByPersonId?: ReadonlyMap<string, readonly BusinessEventRecord[]>;
};

export type DashboardSnapshotResult = {
  cards: DashboardMetricCardDto[];
  /** ISO-ish wall clock when derived/as-of projections were assembled. */
  lastCalculatedAt: string;
  asOf: string;
  populationVolume: number | null;
  warningDays: number;
};

/** Matches `listBusinessEventsForPersonForApply` max — refuse silent truncation. */
const EVENT_APPLY_LOAD_LIMIT = 2000;

const MSG_EVENTS_TRUNCATED_FA =
  "بارگذاری رویدادها برای داشبورد ناقص بود؛ شمارش روند نمایش داده نمی‌شود.";

const TITLE = Object.fromEntries(
  LAUNCH_METRIC_DEFINITIONS.map((d) => [d.key, d.titleFa]),
) as Record<LaunchMetricKey, string>;

function cardBase(
  key: LaunchMetricKey,
  outcome: DashboardMetricOutcome,
  extras: Partial<DashboardMetricCardDto> = {},
): DashboardMetricCardDto {
  return {
    key,
    titleFa: TITLE[key],
    outcome,
    value: null,
    ...extras,
  };
}

function allCardsWithOutcome(
  outcome: DashboardMetricOutcome,
  messageFa: string,
): DashboardMetricCardDto[] {
  requireLaunchMetricCatalogue();
  return LAUNCH_METRIC_DEFINITIONS.map((d) =>
    cardBase(d.key, outcome, { messageFa }),
  );
}

async function countActivePersons(
  subjectIds: readonly string[],
  asOf: string,
): Promise<number> {
  let active = 0;
  for (const personId of subjectIds) {
    const employments = await listEmploymentsForPerson(personId);
    const hasActive = employments.some((e) =>
      isEmploymentActiveAsOf(
        { startDate: e.startDate, endDateExclusive: e.endDateExclusive },
        asOf,
      ),
    );
    if (hasActive) active += 1;
  }
  return active;
}

type LoadedEvents = {
  events: BusinessEventRecord[];
  truncated: boolean;
};

async function loadEventsForSubjects(
  subjectIds: readonly string[],
  eventDb: Pool | PoolClient,
  rangeStart: string,
  injected?: ReadonlyMap<string, readonly BusinessEventRecord[]>,
): Promise<LoadedEvents> {
  if (injected) {
    const out: BusinessEventRecord[] = [];
    for (const id of subjectIds) {
      const rows = injected.get(id);
      if (rows) out.push(...rows);
    }
    return { events: out, truncated: false };
  }
  const out: BusinessEventRecord[] = [];
  let truncated = false;
  for (const personId of subjectIds) {
    const rows = await listBusinessEventsForPersonForApply(eventDb, personId, {
      fromEffectiveDate: rangeStart,
      limit: EVENT_APPLY_LOAD_LIMIT,
    });
    if (rows.length >= EVENT_APPLY_LOAD_LIMIT) truncated = true;
    out.push(...rows);
  }
  return { events: out, truncated };
}

function orgUnitDetails(counts: OrgUnitCountsByType): Record<string, number> {
  return {
    legalEntity: counts.LEGAL_ENTITY,
    businessUnit: counts.BUSINESS_UNIT,
    department: counts.DEPARTMENT,
    team: counts.TEAM,
  };
}

function summarizeOpenHeadcount(
  approvals: HeadcountApprovalRecord[],
  asOf: string,
  teamId?: string,
): {
  openFree: number;
  nearExpiryCount: number;
  expiredNonConsumableCount: number;
  nearExpiryApprovalIds: string[];
} {
  let openFree = 0;
  let nearExpiryCount = 0;
  let expiredNonConsumableCount = 0;
  const nearExpiryApprovalIds: string[] = [];

  for (const a of approvals) {
    if (teamId && a.teamId !== teamId) continue;
    // Evaluate soft-expire / consumability against asOf (not wall clock).
    const consumable = isApprovalConsumableAt(
      a.status,
      a.validityStart,
      a.validityEndExclusive,
      asOf,
      asOf,
    );
    if (consumable) {
      openFree += a.free;
      if (
        isApprovalExpiryWithinWarningHorizon(a.validityEndExclusive, {
          today: asOf,
          warningDays: HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS(),
        })
      ) {
        nearExpiryCount += 1;
        nearExpiryApprovalIds.push(a.id);
      }
    } else {
      const gate = effectiveApprovalStatus(
        a.status,
        a.validityEndExclusive,
        asOf,
      );
      if (gate === "expired" || a.status === "expired") {
        // Non-consumable expired display — never merge into open free.
        expiredNonConsumableCount += 1;
      }
    }
  }

  return {
    openFree,
    nearExpiryCount,
    expiredNonConsumableCount,
    nearExpiryApprovalIds,
  };
}

function isInactiveTeamError(err: unknown): boolean {
  return (
    err instanceof PersonIdentityError &&
    (err.message === "team_not_active_as_of" ||
      err.messageFa === MSG_HIST_ORG_TEAM_NOT_ACTIVE_FA)
  );
}

function isHeadcountLedgerError(err: unknown): err is HeadcountLedgerError {
  return err instanceof HeadcountLedgerError;
}

/**
 * Assemble permission-safe dashboard cards from authorized subjects + published APIs.
 */
export async function assembleDashboardSnapshot(
  input: AssembleDashboardSnapshotInput,
): Promise<DashboardSnapshotResult> {
  requireLaunchMetricCatalogue();
  const lastCalculatedAt = new Date().toISOString();
  const { filter, caps } = input;

  if (input.retrievalOutcome === "suppressed") {
    return {
      cards: allCardsWithOutcome(
        "suppressed",
        input.suppressedMessageFa ?? "داده قابل نمایش نیست",
      ),
      lastCalculatedAt,
      asOf: filter.asOf,
      populationVolume: null,
      warningDays: HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS(),
    };
  }

  if (input.retrievalOutcome === "empty" || input.subjectIds.length === 0) {
    return {
      cards: allCardsWithOutcome("empty", input.emptyMessageFa),
      lastCalculatedAt,
      asOf: filter.asOf,
      populationVolume: 0,
      warningDays: HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS(),
    };
  }

  const cards: DashboardMetricCardDto[] = [];

  // --- active persons (PopulationPort cohort; teamId does not narrow this card) ---
  const activeCount = await countActivePersons(input.subjectIds, filter.asOf);
  cards.push(
    cardBase("active_persons", "allowed", {
      value: activeCount,
      // Omit teamId — figure is cohort-wide; filtered detail would not match the number.
      reconcileHref: personnelListReconcileHref({}),
      reconcileLabelFa: "فهرست پرسنل",
    }),
  );

  // --- historical org / HC / team capacity ---
  let historical: GetHistoricalOrgHeadcountStateResult | null = null;
  if (caps.hasOrganizationRead) {
    try {
      historical =
        input.historicalState ??
        (await getHistoricalOrgHeadcountState(
          { asOf: filter.asOf, teamId: filter.teamId },
          { eventDb: input.eventDb },
        ));
    } catch (err) {
      if (isInactiveTeamError(err)) {
        for (const key of [
          "org_unit_counts",
          "headcount_conservation",
          "team_capacity",
        ] as const) {
          cards.push(
            cardBase(key, "empty", { messageFa: input.emptyMessageFa }),
          );
        }
        historical = null;
      } else if (isHeadcountLedgerError(err)) {
        // Fail-closed on ledger ambiguity for HC/org cards only — do not blank the whole dashboard.
        for (const key of [
          "org_unit_counts",
          "headcount_conservation",
          "team_capacity",
        ] as const) {
          cards.push(cardBase(key, "error", { messageFa: err.messageFa }));
        }
        historical = null;
      } else {
        throw err;
      }
    }

    if (historical && !historical.ok) {
      const msg = historical.messageFa;
      const pending =
        historical.code === "RECALCULATION_PENDING" ||
        historical.code === "RECALCULATION_STALE";
      const outcome: DashboardMetricOutcome = pending ? "pending" : "error";
      for (const key of [
        "org_unit_counts",
        "headcount_conservation",
        "team_capacity",
      ] as const) {
        cards.push(cardBase(key, outcome, { messageFa: msg }));
      }
    } else if (historical?.ok) {
      const agg = historical.aggregate;
      // Org unit counts remain organization-wide hierarchy totals (not team-local).
      cards.push(
        cardBase("org_unit_counts", "allowed", {
          value:
            agg.orgUnitCounts.LEGAL_ENTITY +
            agg.orgUnitCounts.BUSINESS_UNIT +
            agg.orgUnitCounts.DEPARTMENT +
            agg.orgUnitCounts.TEAM,
          details: orgUnitDetails(agg.orgUnitCounts),
          reconcileHref: "/organization/hierarchy",
          reconcileLabelFa: "ساختار سازمان",
        }),
      );

      const conservation = assertHeadcountConservation({
        approved: agg.approved,
        used: agg.used,
        reserved: agg.reserved,
        free: agg.free,
      });
      if (!conservation.ok) {
        cards.push(
          cardBase("headcount_conservation", "error", {
            messageFa: conservation.messageFa,
          }),
        );
      } else {
        cards.push(
          cardBase("headcount_conservation", "allowed", {
            value: agg.approved,
            details: {
              approved: agg.approved,
              used: agg.used,
              reserved: agg.reserved,
              free: agg.free,
            },
            reconcileHref: capacityReconcileHref({ teamId: filter.teamId }),
            reconcileLabelFa: "ظرفیت و جذب",
          }),
        );
      }

      const teams = [...historical.detail.teams].sort((a, b) => {
        if (b.teamMembershipCount !== a.teamMembershipCount) {
          return b.teamMembershipCount - a.teamMembershipCount;
        }
        return a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0;
      });
      cards.push(
        cardBase("team_capacity", "allowed", {
          value: agg.teamMembershipCount,
          details: {
            teamCount: teams.length,
            free: agg.free,
            used: agg.used,
            reserved: agg.reserved,
            approved: agg.approved,
            topTeamId: teams[0]?.teamId ?? null,
            topTeamMembers: teams[0]?.teamMembershipCount ?? 0,
          },
          reconcileHref: capacityReconcileHref({ teamId: filter.teamId }),
          reconcileLabelFa: "جزئیات ظرفیت تیم",
        }),
      );
    }
  } else {
    for (const key of [
      "org_unit_counts",
      "headcount_conservation",
      "team_capacity",
    ] as const) {
      cards.push(cardBase(key, "omitted"));
    }
  }

  // --- starts / terminations + trend ---
  const { events, truncated } = await loadEventsForSubjects(
    input.subjectIds,
    input.eventDb,
    filter.trendRangeStart,
    input.eventsByPersonId,
  );
  if (truncated) {
    for (const key of ["starts_terminations", "workforce_trend"] as const) {
      cards.push(
        cardBase(key, "error", { messageFa: MSG_EVENTS_TRUNCATED_FA }),
      );
    }
  } else {
    const st = aggregateStartsTerminations(
      events,
      filter.trendRangeStart,
      filter.trendRangeEnd,
    );
    const trend = buildWorkforceTrendBuckets(
      events,
      filter.trendRangeStart,
      filter.trendRangeEnd,
      filter.trendGranularity,
    );

    cards.push(
      cardBase("starts_terminations", "allowed", {
        value: st.starts + st.terminations,
        details: {
          starts: st.starts,
          terminations: st.terminations,
          net: st.net,
          rangeStart: filter.trendRangeStart,
          rangeEnd: filter.trendRangeEnd,
        },
        // Omit teamId — events loaded for full subjectIds cohort, not team-narrowed.
        reconcileHref: eventsReconcileHref({
          effectiveFrom: filter.trendRangeStart,
          effectiveTo: filter.trendRangeEnd,
        }),
        reconcileLabelFa: "رویدادهای پرسنلی",
      }),
    );

    cards.push(
      cardBase("workforce_trend", "allowed", {
        value: trend.reduce((n, b) => n + b.net, 0),
        details: {
          granularity: filter.trendGranularity,
          bucketCount: trend.length,
          rangeStart: filter.trendRangeStart,
          rangeEnd: filter.trendRangeEnd,
        },
        trend,
        reconcileHref: eventsReconcileHref({
          effectiveFrom: filter.trendRangeStart,
          effectiveTo: filter.trendRangeEnd,
        }),
        reconcileLabelFa: "روند رویدادها",
      }),
    );
  }

  // --- open headcount / near-expiry / expired non-consumable ---
  if (caps.hasHeadcountApprovalRead) {
    const approvals =
      input.approvals ??
      (await listApprovals(input.eventDb, {
        teamId: filter.teamId,
      }));
    const open = summarizeOpenHeadcount(
      approvals,
      filter.asOf,
      filter.teamId,
    );
    // Prefer historical ledger free when available (as-of / current reconstruction).
    const openFreeValue =
      historical?.ok === true ? historical.aggregate.free : open.openFree;
    cards.push(
      cardBase("open_headcount", "allowed", {
        value: openFreeValue,
        details: {
          openFree: openFreeValue,
          nearExpiryCount: open.nearExpiryCount,
          expiredNonConsumableCount: open.expiredNonConsumableCount,
          warningDays: HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS(),
          freeSource: historical?.ok === true ? "historical" : "approval_slots",
        },
        reconcileHref: capacityReconcileHref({ teamId: filter.teamId }),
        reconcileLabelFa: "ظرفیت باز و نزدیک انقضا",
      }),
    );
  } else {
    cards.push(cardBase("open_headcount", "omitted"));
  }

  return {
    cards,
    lastCalculatedAt,
    asOf: filter.asOf,
    populationVolume: input.subjectIds.length,
    warningDays: HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS(),
  };
}

/** Pure helper for tests — conservation identity without DB. */
export function conservationOrFail(
  approved: number,
  used: number,
  reserved: number,
  free: number,
): { ok: true } | { ok: false; messageFa: string } {
  const r = assertHeadcountConservation({ approved, used, reserved, free });
  if (!r.ok) return { ok: false, messageFa: MSG_DASHBOARD_HEADCOUNT_CONSERVATION_FA };
  return { ok: true };
}

export function defaultAsOfToday(): string {
  return todayDateOnlyTehran();
}
