/**
 * Launch report run assembly (Story 5.5 / FR-36).
 * Composes published person-employment / headcount / event-store APIs —
 * AD-3: no private table reads; no parallel report SoT.
 */

import type { Pool, PoolClient } from "@divan/db";
import {
  listBusinessEventsForPersonForApply,
  type BusinessEventRecord,
} from "@divan/event-store";
import {
  listApprovals,
  listOverrides,
  type HeadcountApprovalRecord,
  type HeadcountOverrideRecord,
} from "@divan/headcount";
import {
  countSuccessfulCutoverEvidence,
  listSuccessfulCutoverEvidence,
} from "@divan/migration";
import {
  MSG_HIST_ORG_TEAM_NOT_ACTIVE_FA,
  PRODUCT_COMPENSATION_EVENT_TYPE,
  PRODUCT_CONTRACT_EVENT_TYPE,
  PRODUCT_GRADE_CHANGED,
  PRODUCT_JOB_TITLE_CHANGED,
  PRODUCT_ORG_ROLE_CHANGED,
  PRODUCT_START_EVENT_TYPE,
  PRODUCT_TERMINATION_EVENT_TYPE,
  PRODUCT_TRANSFER_EVENT_TYPE,
  PersonIdentityError,
  getActivePrimaryAssignmentAsOf,
  getGradeById,
  getHistoricalOrgHeadcountState,
  getJobTitleById,
  getLadderById,
  getOrganizationalRoleById,
  getPersonById,
  getSeniorityById,
  isEmploymentActiveAsOf,
  listEmploymentsForPerson,
  listTeamMembersAsOf,
  resolveTeamManagerAsOf,
  type GetHistoricalOrgHeadcountStateResult,
} from "@divan/person-employment";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  assertHeadcountConservation,
  MSG_DASHBOARD_HEADCOUNT_CONSERVATION_FA,
} from "./headcount-conservation";
import {
  LAUNCH_REPORT_DEFINITIONS,
  MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA,
  reportRequiresEffectiveDateRange,
  reportUsesTeamPopulationIntersect,
  type LaunchReportKey,
  requireLaunchReportCatalogue,
} from "./report-catalogue";
import {
  aggregateEventsByTypeAndStatus,
  aggregateStartsTerminations,
  filterEventsByStatus,
  type WorkforceEventRow,
} from "./workforce-events";

export type ReportRunOutcome =
  | "allowed"
  | "empty"
  | "suppressed"
  | "error"
  | "pending"
  | "unavailable"
  | "omitted";

export type ReportColumnDef = {
  id: string;
  headerFa: string;
  /** When false, column is omitted from the table (soft-omit). */
  permitted?: boolean;
};

export type ReportCellValue = string | number | null;

export type ReportRowDto = {
  id: string;
  cells: Record<string, ReportCellValue>;
  /** Deep-link path when leave-guard may apply. */
  href?: string;
};

export type ReportRunFilter = {
  asOf: string;
  /** `current` uses live override/approval detail; `as_of` stays on historical ledger. */
  evaluationMode: "current" | "as_of";
  teamId?: string;
  /** Required for event / Effective-Date measure keys. */
  rangeStart?: string;
  rangeEnd?: string;
};

export type ReportRunCaps = {
  hasOrganizationRead: boolean;
  hasHeadcountApprovalRead: boolean;
  hasCompensationRead: boolean;
};

export type AssembleReportRunInput = {
  reportKey: LaunchReportKey;
  subjectIds: readonly string[];
  retrievalOutcome: "allowed" | "empty" | "suppressed";
  suppressedMessageFa?: string;
  emptyMessageFa: string;
  filter: ReportRunFilter;
  caps: ReportRunCaps;
  eventDb: Pool | PoolClient;
  historicalState?: GetHistoricalOrgHeadcountStateResult;
  approvals?: HeadcountApprovalRecord[];
  overrides?: HeadcountOverrideRecord[];
  eventsByPersonId?: ReadonlyMap<string, readonly BusinessEventRecord[]>;
};

export type ReportRunResult = {
  reportKey: LaunchReportKey;
  titleFa: string;
  outcome: ReportRunOutcome;
  messageFa?: string;
  columns: ReportColumnDef[];
  rows: ReportRowDto[];
  lastCalculatedAt: string;
  asOf: string;
  populationVolume: number | null;
  reconcileHref?: string;
  reconcileLabelFa?: string;
};

/** Matches `listBusinessEventsForPersonForApply` max — refuse silent truncation. */
const EVENT_APPLY_LOAD_LIMIT = 2000;
const OVERRIDES_LIST_LIMIT = 500;

const MSG_EVENTS_TRUNCATED_FA =
  "بارگذاری رویدادها برای گزارش ناقص بود؛ نتیجه نمایش داده نمی‌شود.";

const MSG_OVERRIDES_TRUNCATED_FA =
  "فهرست استثناهای ظرفیت ناقص بود؛ نتیجه نمایش داده نمی‌شود.";

const MSG_OVERRIDES_ASOF_UNAVAILABLE_FA =
  "گزارش استثناهای ظرفیت در حالت مبنا (as-of) از ledger تاریخی هنوز در دسترس نیست؛ فقط حالت جاری پشتیبانی می‌شود.";

const MSG_RANGE_REQUIRED_FA =
  "برای این گزارش، بازهٔ تاریخ مؤثر (شروع و پایان) الزامی است.";

const TITLE = Object.fromEntries(
  LAUNCH_REPORT_DEFINITIONS.map((d) => [d.key, d.titleFa]),
) as Record<LaunchReportKey, string>;

const ROLE_GRADE_COMP_TYPES = [
  PRODUCT_ORG_ROLE_CHANGED,
  PRODUCT_JOB_TITLE_CHANGED,
  PRODUCT_GRADE_CHANGED,
  PRODUCT_COMPENSATION_EVENT_TYPE,
  PRODUCT_CONTRACT_EVENT_TYPE,
] as const;

const SCHEDULED_STATUSES = ["Scheduled"] as const;
const CORRECTED_CANCELLED_REVERSED_STATUSES = [
  "Cancelled",
  "Reversed",
] as const;

type LoadedEvents = {
  events: BusinessEventRecord[];
  truncated: boolean;
};

async function loadEventsForSubjects(
  subjectIds: readonly string[],
  eventDb: Pool | PoolClient,
  rangeStart: string,
  rangeEnd: string,
  injected?: ReadonlyMap<string, readonly BusinessEventRecord[]>,
): Promise<LoadedEvents> {
  if (injected) {
    const out: BusinessEventRecord[] = [];
    for (const id of subjectIds) {
      const rows = injected.get(id);
      if (rows) {
        out.push(
          ...rows.filter(
            (e) =>
              e.effectiveDate >= rangeStart && e.effectiveDate <= rangeEnd,
          ),
        );
      }
    }
    return { events: out, truncated: false };
  }
  const out: BusinessEventRecord[] = [];
  let truncated = false;
  for (const personId of subjectIds) {
    const rows = await listBusinessEventsForPersonForApply(eventDb, personId, {
      fromEffectiveDate: rangeStart,
      toEffectiveDate: rangeEnd,
      limit: EVENT_APPLY_LOAD_LIMIT,
    });
    if (rows.length >= EVENT_APPLY_LOAD_LIMIT) truncated = true;
    out.push(...rows);
  }
  return { events: out, truncated };
}

function toWorkforceRows(
  events: readonly BusinessEventRecord[],
): WorkforceEventRow[] {
  return events.map((e) => ({
    eventType: e.eventType,
    effectiveDate: e.effectiveDate,
    status: e.status,
  }));
}

function emptyResult(
  reportKey: LaunchReportKey,
  outcome: ReportRunOutcome,
  messageFa: string,
  asOf: string,
  lastCalculatedAt: string,
  populationVolume: number | null,
  extras: Partial<ReportRunResult> = {},
): ReportRunResult {
  return {
    reportKey,
    titleFa: TITLE[reportKey],
    outcome,
    messageFa,
    columns: [],
    rows: [],
    lastCalculatedAt,
    asOf,
    populationVolume,
    ...extras,
  };
}

function isInactiveTeamError(err: unknown): boolean {
  return (
    err instanceof PersonIdentityError &&
    (err.message === "team_not_active_as_of" ||
      err.messageFa === MSG_HIST_ORG_TEAM_NOT_ACTIVE_FA)
  );
}

async function buildActivePersons(
  subjectIds: readonly string[],
  asOf: string,
): Promise<ReportRowDto[]> {
  const rows: ReportRowDto[] = [];
  for (const personId of subjectIds) {
    const employments = await listEmploymentsForPerson(personId);
    const hasActive = employments.some((e) =>
      isEmploymentActiveAsOf(
        { startDate: e.startDate, endDateExclusive: e.endDateExclusive },
        asOf,
      ),
    );
    if (!hasActive) continue;
    const person = await getPersonById(personId);
    rows.push({
      id: personId,
      href: `/personnel/profile/${personId}`,
      cells: {
        personId,
        personnelCode: person?.personnelCode ?? "—",
        displayName: person
          ? `${person.givenName} ${person.familyName}`
          : "—",
      },
    });
  }
  return rows;
}

async function buildAllPersons(
  subjectIds: readonly string[],
): Promise<ReportRowDto[]> {
  const rows: ReportRowDto[] = [];
  for (const personId of subjectIds) {
    const employments = await listEmploymentsForPerson(personId);
    if (employments.length === 0) continue;
    const person = await getPersonById(personId);
    const ended = employments.every((e) => e.endDateExclusive != null);
    rows.push({
      id: personId,
      href: `/personnel/profile/${personId}`,
      cells: {
        personId,
        personnelCode: person?.personnelCode ?? "—",
        displayName: person
          ? `${person.givenName} ${person.familyName}`
          : "—",
        employmentCount: employments.length,
        allEnded: ended ? "بله" : "خیر",
      },
    });
  }
  return rows;
}

async function buildDistributions(
  subjectIds: readonly string[],
  asOf: string,
): Promise<ReportRowDto[]> {
  const buckets = new Map<
    string,
    { dimension: string; key: string; label: string; count: number }
  >();
  const labelCache = new Map<string, string>();

  const resolveLabel = async (
    kind: "role" | "job" | "ladder" | "grade" | "seniority",
    id: string,
  ): Promise<string> => {
    const cacheKey = `${kind}:${id}`;
    const hit = labelCache.get(cacheKey);
    if (hit) return hit;
    let name: string | undefined;
    if (kind === "role") {
      name = (await getOrganizationalRoleById(id))?.nameFa;
    } else if (kind === "job") {
      name = (await getJobTitleById(id))?.nameFa;
    } else if (kind === "ladder") {
      name = (await getLadderById(id))?.nameFa;
    } else if (kind === "grade") {
      name = (await getGradeById(id))?.nameFa;
    } else {
      name = (await getSeniorityById(id))?.nameFa;
    }
    const label = name?.trim() || id;
    labelCache.set(cacheKey, label);
    return label;
  };

  const bump = (dimension: string, key: string, label: string) => {
    const id = `${dimension}\0${key}`;
    const row = buckets.get(id) ?? { dimension, key, label, count: 0 };
    row.count += 1;
    buckets.set(id, row);
  };

  for (const personId of subjectIds) {
    const employments = await listEmploymentsForPerson(personId);
    const activeEmp = employments.find((e) =>
      isEmploymentActiveAsOf(
        { startDate: e.startDate, endDateExclusive: e.endDateExclusive },
        asOf,
      ),
    );
    if (!activeEmp) continue;
    const collab = activeEmp.collaborationType?.trim() || "نامشخص";
    bump("collaboration", collab, collab);
    const primary = await getActivePrimaryAssignmentAsOf(
      activeEmp.id,
      asOf,
    );
    if (!primary) continue;
    const roleLabel = await resolveLabel(
      "role",
      primary.organizationalRoleId,
    );
    bump("organizationalRole", primary.organizationalRoleId, roleLabel);
    const jobLabel = await resolveLabel("job", primary.jobTitleId);
    bump("jobTitle", primary.jobTitleId, jobLabel);
    const ladderLabel = await resolveLabel("ladder", primary.ladderId);
    const gradeLabel = await resolveLabel("grade", primary.gradeId);
    bump(
      "ladderGrade",
      `${primary.ladderId}/${primary.gradeId}`,
      `${ladderLabel} / ${gradeLabel}`,
    );
    if (primary.seniorityId) {
      const senLabel = await resolveLabel("seniority", primary.seniorityId);
      bump("seniority", primary.seniorityId, senLabel);
    } else {
      bump("seniority", "نامشخص", "نامشخص");
    }
  }

  return [...buckets.values()]
    .sort((a, b) => {
      if (a.dimension !== b.dimension) {
        return a.dimension < b.dimension ? -1 : 1;
      }
      return b.count - a.count;
    })
    .map((b, i) => ({
      id: `dist-${i}-${b.dimension}-${b.key}`,
      cells: {
        dimension: b.dimension,
        key: b.label,
        count: b.count,
      },
    }));
}

function eventRowsInRange(
  events: readonly BusinessEventRecord[],
  eventType: string,
  rangeStart: string,
  rangeEnd: string,
  status = "Effective",
): ReportRowDto[] {
  return events
    .filter(
      (e) =>
        e.eventType === eventType &&
        e.status === status &&
        e.effectiveDate >= rangeStart &&
        e.effectiveDate <= rangeEnd,
    )
    .map((e) => ({
      id: e.id,
      href: "/personnel-events/events",
      cells: {
        eventId: e.id,
        personId: e.personId,
        eventType: e.eventType,
        effectiveDate: e.effectiveDate,
        status: e.status,
      },
    }));
}

/**
 * Import batch outcomes — evidence-backed only (Story 6.2 / AC #8).
 * Never fabricate from preview drafts. Until first successful cutover evidence,
 * keep exact unavailable message.
 */
async function assembleImportBatchOutcomesReport(
  eventDb: Pool | PoolClient,
  asOf: string,
  lastCalculatedAt: string,
  populationVolume: number | null,
): Promise<ReportRunResult> {
  const evidenceCount = await countSuccessfulCutoverEvidence(eventDb);
  if (evidenceCount === 0) {
    return emptyResult(
      "import_batch_outcomes",
      "unavailable",
      MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA,
      asOf,
      lastCalculatedAt,
      populationVolume,
    );
  }

  const evidence = await listSuccessfulCutoverEvidence(eventDb, 200);
  const columns: ReportColumnDef[] = [
    { id: "batchId", headerFa: "شناسه دسته" },
    { id: "correlationId", headerFa: "شناسه همبستگی" },
    { id: "status", headerFa: "وضعیت" },
    { id: "createdAt", headerFa: "زمان" },
    { id: "rowCount", headerFa: "ردیف" },
    { id: "eventCount", headerFa: "رویداد" },
  ];
  const rows: ReportRowDto[] = evidence.map((e) => {
    const counts =
      typeof e.counts === "object" && e.counts != null
        ? (e.counts as { rowCount?: number; createdEventCount?: number })
        : {};
    return {
      id: e.batchId,
      cells: {
        batchId: e.batchId,
        correlationId: e.correlationId,
        status: e.status,
        createdAt: e.createdAt,
        rowCount: counts.rowCount ?? null,
        eventCount: counts.createdEventCount ?? null,
      },
    };
  });

  return {
    reportKey: "import_batch_outcomes",
    titleFa: TITLE.import_batch_outcomes,
    outcome: "allowed",
    columns,
    rows,
    lastCalculatedAt,
    asOf,
    populationVolume,
  };
}

/**
 * Assemble one permission-safe report run from authorized subjects + published APIs.
 */
export async function assembleReportRun(
  input: AssembleReportRunInput,
): Promise<ReportRunResult> {
  requireLaunchReportCatalogue();
  const lastCalculatedAt = new Date().toISOString();
  const { reportKey, filter, caps } = input;
  const titleFa = TITLE[reportKey];
  let subjectIds = [...input.subjectIds];

  if (input.retrievalOutcome === "suppressed") {
    return emptyResult(
      reportKey,
      "suppressed",
      input.suppressedMessageFa ?? "داده قابل نمایش نیست",
      filter.asOf,
      lastCalculatedAt,
      null,
    );
  }

  if (input.retrievalOutcome === "empty" || subjectIds.length === 0) {
    // Import batch: evidence-backed or unavailable — never fabricate from drafts.
    if (reportKey === "import_batch_outcomes") {
      return assembleImportBatchOutcomesReport(
        input.eventDb,
        filter.asOf,
        lastCalculatedAt,
        0,
      );
    }
    return emptyResult(
      reportKey,
      "empty",
      input.emptyMessageFa,
      filter.asOf,
      lastCalculatedAt,
      0,
    );
  }

  // Soft-omit by caps — router should omit from catalogue; assembler fail-closed.
  const def = LAUNCH_REPORT_DEFINITIONS.find((d) => d.key === reportKey);
  if (def?.requiresCompensationRead && !caps.hasCompensationRead) {
    return emptyResult(
      reportKey,
      "omitted",
      "برای این گزارش دسترسی جبران خدمت لازم است.",
      filter.asOf,
      lastCalculatedAt,
      null,
    );
  }
  if (def?.requiresOrganizationRead && !caps.hasOrganizationRead) {
    return emptyResult(
      reportKey,
      "omitted",
      "برای این گزارش دسترسی سازمان لازم است.",
      filter.asOf,
      lastCalculatedAt,
      null,
    );
  }
  if (
    def?.requiresHeadcountApprovalRead &&
    !caps.hasHeadcountApprovalRead
  ) {
    return emptyResult(
      reportKey,
      "omitted",
      "برای این گزارش دسترسی ظرفیت لازم است.",
      filter.asOf,
      lastCalculatedAt,
      null,
    );
  }

  if (reportKey === "import_batch_outcomes") {
    return assembleImportBatchOutcomesReport(
      input.eventDb,
      filter.asOf,
      lastCalculatedAt,
      subjectIds.length,
    );
  }

  // AC#2: org team filter intersects authorized population for person/event keys.
  if (
    reportUsesTeamPopulationIntersect(reportKey) &&
    filter.teamId?.trim()
  ) {
    const members = await listTeamMembersAsOf(
      filter.teamId.trim(),
      filter.asOf,
    );
    const allow = new Set(members);
    subjectIds = subjectIds.filter((id) => allow.has(id));
    if (subjectIds.length === 0) {
      return emptyResult(
        reportKey,
        "empty",
        input.emptyMessageFa,
        filter.asOf,
        lastCalculatedAt,
        0,
      );
    }
  }

  if (reportRequiresEffectiveDateRange(reportKey)) {
    const rs = filter.rangeStart?.trim();
    const re = filter.rangeEnd?.trim();
    if (!rs || !re) {
      return emptyResult(
        reportKey,
        "error",
        MSG_RANGE_REQUIRED_FA,
        filter.asOf,
        lastCalculatedAt,
        subjectIds.length,
      );
    }
  }

  const rangeStart = filter.rangeStart?.trim() ?? "";
  const rangeEnd = filter.rangeEnd?.trim() ?? "";

  const personColumns: ReportColumnDef[] = [
    { id: "personnelCode", headerFa: "کد پرسنلی" },
    { id: "displayName", headerFa: "نام" },
  ];

  switch (reportKey) {
    case "active_persons": {
      const rows = await buildActivePersons(subjectIds, filter.asOf);
      if (rows.length === 0) {
        return emptyResult(
          reportKey,
          "empty",
          input.emptyMessageFa,
          filter.asOf,
          lastCalculatedAt,
          subjectIds.length,
          {
            columns: personColumns,
            reconcileHref: "/personnel/list",
            reconcileLabelFa: "فهرست پرسنل",
          },
        );
      }
      return {
        reportKey,
        titleFa,
        outcome: "allowed",
        columns: personColumns,
        rows,
        lastCalculatedAt,
        asOf: filter.asOf,
        populationVolume: subjectIds.length,
        reconcileHref: "/personnel/list",
        reconcileLabelFa: "فهرست پرسنل",
      };
    }

    case "all_persons": {
      const rows = await buildAllPersons(subjectIds);
      if (rows.length === 0) {
        return emptyResult(
          reportKey,
          "empty",
          input.emptyMessageFa,
          filter.asOf,
          lastCalculatedAt,
          subjectIds.length,
          {
            columns: [
              ...personColumns,
              { id: "employmentCount", headerFa: "تعداد اشتغال" },
              { id: "allEnded", headerFa: "همه خاتمه‌یافته" },
            ],
            reconcileHref: "/personnel/list",
            reconcileLabelFa: "فهرست پرسنل",
          },
        );
      }
      return {
        reportKey,
        titleFa,
        outcome: "allowed",
        columns: [
          ...personColumns,
          { id: "employmentCount", headerFa: "تعداد اشتغال" },
          { id: "allEnded", headerFa: "همه خاتمه‌یافته" },
        ],
        rows,
        lastCalculatedAt,
        asOf: filter.asOf,
        populationVolume: subjectIds.length,
        reconcileHref: "/personnel/list",
        reconcileLabelFa: "فهرست پرسنل",
      };
    }

    case "org_state":
    case "headcount_approvals_capacity": {
      let historical: GetHistoricalOrgHeadcountStateResult;
      try {
        historical =
          input.historicalState ??
          (await getHistoricalOrgHeadcountState(
            { asOf: filter.asOf, teamId: filter.teamId },
            { eventDb: input.eventDb },
          ));
      } catch (err) {
        if (isInactiveTeamError(err)) {
          return emptyResult(
            reportKey,
            "empty",
            input.emptyMessageFa,
            filter.asOf,
            lastCalculatedAt,
            subjectIds.length,
          );
        }
        throw err;
      }
      if (!historical.ok) {
        const pending =
          historical.code === "RECALCULATION_PENDING" ||
          historical.code === "RECALCULATION_STALE";
        return emptyResult(
          reportKey,
          pending ? "pending" : "error",
          historical.messageFa,
          filter.asOf,
          lastCalculatedAt,
          subjectIds.length,
        );
      }
      const agg = historical.aggregate;
      if (reportKey === "org_state") {
        const rows: ReportRowDto[] = [
          {
            id: "org-legal",
            cells: {
              unitType: "LEGAL_ENTITY",
              count: agg.orgUnitCounts.LEGAL_ENTITY,
            },
          },
          {
            id: "org-bu",
            cells: {
              unitType: "BUSINESS_UNIT",
              count: agg.orgUnitCounts.BUSINESS_UNIT,
            },
          },
          {
            id: "org-dept",
            cells: {
              unitType: "DEPARTMENT",
              count: agg.orgUnitCounts.DEPARTMENT,
            },
          },
          {
            id: "org-team",
            cells: { unitType: "TEAM", count: agg.orgUnitCounts.TEAM },
          },
          {
            id: "org-members",
            cells: {
              unitType: "teamMembership",
              count: agg.teamMembershipCount,
            },
          },
        ];
        return {
          reportKey,
          titleFa,
          outcome: "allowed",
          columns: [
            { id: "unitType", headerFa: "نوع" },
            { id: "count", headerFa: "تعداد" },
          ],
          rows,
          lastCalculatedAt,
          asOf: filter.asOf,
          populationVolume: subjectIds.length,
          reconcileHref: "/organization/hierarchy",
          reconcileLabelFa: "ساختار سازمان",
        };
      }

      // Historical ledger for aggregate. Live approval used/free only in current mode.
      const conservation = assertHeadcountConservation({
        approved: agg.approved,
        used: agg.used,
        reserved: agg.reserved,
        free: agg.free,
      });
      if (!conservation.ok) {
        return emptyResult(
          reportKey,
          "error",
          MSG_DASHBOARD_HEADCOUNT_CONSERVATION_FA,
          filter.asOf,
          lastCalculatedAt,
          subjectIds.length,
        );
      }
      const rows: ReportRowDto[] = [
        {
          id: "hc-aggregate",
          cells: {
            label: "جمع ظرفیت (تاریخی)",
            approved: agg.approved,
            used: agg.used,
            reserved: agg.reserved,
            free: agg.free,
            approvalCount: null,
            status: "—",
          },
        },
      ];
      if (filter.evaluationMode === "current") {
        const approvals =
          input.approvals ??
          (await listApprovals(input.eventDb, { teamId: filter.teamId }));
        rows[0]!.cells.approvalCount = approvals.length;
        for (const a of approvals) {
          rows.push({
            id: a.id,
            href: filter.teamId
              ? `/headcount/capacity?teamId=${encodeURIComponent(filter.teamId)}`
              : "/headcount/capacity",
            cells: {
              label: a.id,
              approved: a.allowedCount,
              used: a.used,
              reserved: a.reserved,
              free: a.free,
              approvalCount: 1,
              teamId: a.teamId,
              status: a.status,
            },
          });
        }
      }
      return {
        reportKey,
        titleFa,
        outcome: "allowed",
        messageFa:
          filter.evaluationMode === "as_of"
            ? "در حالت مبنا فقط جمع تاریخی ظرفیت نمایش داده می‌شود؛ ردیف‌های تأیید زنده اعمال نمی‌شوند."
            : undefined,
        columns: [
          { id: "label", headerFa: "شناسه / برچسب" },
          { id: "approved", headerFa: "تأییدشده" },
          { id: "used", headerFa: "مصرف" },
          { id: "reserved", headerFa: "رزرو" },
          { id: "free", headerFa: "آزاد" },
          { id: "status", headerFa: "وضعیت" },
        ],
        rows,
        lastCalculatedAt,
        asOf: filter.asOf,
        populationVolume: subjectIds.length,
        reconcileHref: filter.teamId
          ? `/headcount/capacity?teamId=${encodeURIComponent(filter.teamId)}`
          : "/headcount/capacity",
        reconcileLabelFa: "ظرفیت و جذب",
      };
    }

    case "team_membership_manager": {
      if (!filter.teamId?.trim()) {
        return emptyResult(
          reportKey,
          "empty",
          "برای گزارش اعضای تیم، شناسه تیم را در فیلتر وارد کنید.",
          filter.asOf,
          lastCalculatedAt,
          subjectIds.length,
          {
            reconcileHref: "/personnel/list",
            reconcileLabelFa: "فهرست پرسنل",
          },
        );
      }
      const teamId = filter.teamId.trim();
      let memberIds: string[];
      let managerPersonId: string | null = null;
      try {
        memberIds = await listTeamMembersAsOf(teamId, filter.asOf);
        const manager = await resolveTeamManagerAsOf(teamId, filter.asOf);
        managerPersonId = manager?.managerPersonId ?? null;
      } catch (err) {
        if (isInactiveTeamError(err)) {
          return emptyResult(
            reportKey,
            "empty",
            input.emptyMessageFa,
            filter.asOf,
            lastCalculatedAt,
            subjectIds.length,
          );
        }
        throw err;
      }
      const allowed = new Set(subjectIds);
      const scoped = memberIds.filter((id) => allowed.has(id));
      if (scoped.length === 0) {
        return emptyResult(
          reportKey,
          "empty",
          input.emptyMessageFa,
          filter.asOf,
          lastCalculatedAt,
          subjectIds.length,
          {
            reconcileHref: `/personnel/list?teamId=${encodeURIComponent(teamId)}`,
            reconcileLabelFa: "فهرست پرسنل",
          },
        );
      }
      const rows: ReportRowDto[] = [];
      for (const personId of scoped) {
        const person = await getPersonById(personId);
        rows.push({
          id: personId,
          href: `/personnel/profile/${personId}`,
          cells: {
            personId,
            personnelCode: person?.personnelCode ?? "—",
            displayName: person
              ? `${person.givenName} ${person.familyName}`
              : "—",
            isManager: managerPersonId === personId ? "بله" : "خیر",
            managerPersonId: managerPersonId ?? "—",
          },
        });
      }
      return {
        reportKey,
        titleFa,
        outcome: "allowed",
        columns: [
          ...personColumns,
          { id: "isManager", headerFa: "مدیر میانی تیم" },
          { id: "managerPersonId", headerFa: "شناسه مدیر" },
        ],
        rows,
        lastCalculatedAt,
        asOf: filter.asOf,
        populationVolume: subjectIds.length,
        reconcileHref: `/personnel/list?teamId=${encodeURIComponent(teamId)}`,
        reconcileLabelFa: "فهرست پرسنل",
      };
    }

    case "distributions": {
      const rows = await buildDistributions(subjectIds, filter.asOf);
      if (rows.length === 0) {
        return emptyResult(
          reportKey,
          "empty",
          input.emptyMessageFa,
          filter.asOf,
          lastCalculatedAt,
          subjectIds.length,
        );
      }
      return {
        reportKey,
        titleFa,
        outcome: "allowed",
        columns: [
          { id: "dimension", headerFa: "بُعد" },
          { id: "key", headerFa: "کلید" },
          { id: "count", headerFa: "تعداد" },
        ],
        rows,
        lastCalculatedAt,
        asOf: filter.asOf,
        populationVolume: subjectIds.length,
        reconcileHref: "/personnel/list",
        reconcileLabelFa: "فهرست پرسنل",
      };
    }

    case "overrides": {
      if (filter.evaluationMode === "as_of") {
        return emptyResult(
          reportKey,
          "unavailable",
          MSG_OVERRIDES_ASOF_UNAVAILABLE_FA,
          filter.asOf,
          lastCalculatedAt,
          subjectIds.length,
          {
            reconcileHref: "/headcount/capacity",
            reconcileLabelFa: "ظرفیت و جذب",
          },
        );
      }
      const overrides =
        input.overrides ??
        (await listOverrides(input.eventDb, {
          teamId: filter.teamId,
          status: "active",
          limit: OVERRIDES_LIST_LIMIT,
        }));
      if (overrides.length >= OVERRIDES_LIST_LIMIT) {
        return emptyResult(
          reportKey,
          "error",
          MSG_OVERRIDES_TRUNCATED_FA,
          filter.asOf,
          lastCalculatedAt,
          subjectIds.length,
          {
            reconcileHref: "/headcount/capacity",
            reconcileLabelFa: "ظرفیت و جذب",
          },
        );
      }
      if (overrides.length === 0) {
        return emptyResult(
          reportKey,
          "empty",
          input.emptyMessageFa,
          filter.asOf,
          lastCalculatedAt,
          subjectIds.length,
          {
            reconcileHref: "/headcount/capacity",
            reconcileLabelFa: "ظرفیت و جذب",
          },
        );
      }
      return {
        reportKey,
        titleFa,
        outcome: "allowed",
        columns: [
          { id: "overrideId", headerFa: "شناسه استثنا" },
          { id: "teamId", headerFa: "تیم" },
          { id: "violatedRule", headerFa: "قاعده نقض‌شده" },
          { id: "status", headerFa: "وضعیت" },
          { id: "reason", headerFa: "دلیل" },
        ],
        rows: overrides.map((o) => ({
          id: o.id,
          href: "/headcount/capacity",
          cells: {
            overrideId: o.id,
            teamId: o.teamId,
            violatedRule: o.violatedRule,
            status: o.status,
            reason: o.reason,
          },
        })),
        lastCalculatedAt,
        asOf: filter.asOf,
        populationVolume: subjectIds.length,
        reconcileHref: "/headcount/capacity",
        reconcileLabelFa: "ظرفیت و جذب",
      };
    }

    case "starts":
    case "terminations":
    case "transfers":
    case "role_grade_compensation_changes":
    case "scheduled":
    case "corrected_cancelled_reversed": {
      const { events, truncated } = await loadEventsForSubjects(
        subjectIds,
        input.eventDb,
        rangeStart,
        rangeEnd,
        input.eventsByPersonId,
      );
      if (truncated) {
        return emptyResult(
          reportKey,
          "error",
          MSG_EVENTS_TRUNCATED_FA,
          filter.asOf,
          lastCalculatedAt,
          subjectIds.length,
        );
      }

      const eventColumns: ReportColumnDef[] = [
        { id: "eventId", headerFa: "شناسه رویداد" },
        { id: "personId", headerFa: "شناسه فرد" },
        { id: "eventType", headerFa: "نوع" },
        { id: "effectiveDate", headerFa: "تاریخ مؤثر" },
        { id: "status", headerFa: "وضعیت" },
      ];

      if (reportKey === "starts") {
        const st = aggregateStartsTerminations(
          toWorkforceRows(events),
          rangeStart,
          rangeEnd,
        );
        const rows = eventRowsInRange(
          events,
          PRODUCT_START_EVENT_TYPE,
          rangeStart,
          rangeEnd,
        );
        if (rows.length === 0) {
          return emptyResult(
            reportKey,
            "empty",
            input.emptyMessageFa,
            filter.asOf,
            lastCalculatedAt,
            subjectIds.length,
            {
              columns: eventColumns,
              reconcileHref: "/personnel-events/events",
              reconcileLabelFa: "رویدادهای پرسنلی",
            },
          );
        }
        return {
          reportKey,
          titleFa,
          outcome: "allowed",
          messageFa: `شروع مؤثر: ${st.starts}`,
          columns: eventColumns,
          rows,
          lastCalculatedAt,
          asOf: filter.asOf,
          populationVolume: subjectIds.length,
          reconcileHref: "/personnel-events/events",
          reconcileLabelFa: "رویدادهای پرسنلی",
        };
      }

      if (reportKey === "terminations") {
        const st = aggregateStartsTerminations(
          toWorkforceRows(events),
          rangeStart,
          rangeEnd,
        );
        const rows = eventRowsInRange(
          events,
          PRODUCT_TERMINATION_EVENT_TYPE,
          rangeStart,
          rangeEnd,
        );
        if (rows.length === 0) {
          return emptyResult(
            reportKey,
            "empty",
            input.emptyMessageFa,
            filter.asOf,
            lastCalculatedAt,
            subjectIds.length,
            {
              columns: eventColumns,
              reconcileHref: "/personnel-events/events",
              reconcileLabelFa: "رویدادهای پرسنلی",
            },
          );
        }
        return {
          reportKey,
          titleFa,
          outcome: "allowed",
          messageFa: `خاتمه مؤثر: ${st.terminations}`,
          columns: eventColumns,
          rows,
          lastCalculatedAt,
          asOf: filter.asOf,
          populationVolume: subjectIds.length,
          reconcileHref: "/personnel-events/events",
          reconcileLabelFa: "رویدادهای پرسنلی",
        };
      }

      if (reportKey === "transfers") {
        const rows = eventRowsInRange(
          events,
          PRODUCT_TRANSFER_EVENT_TYPE,
          rangeStart,
          rangeEnd,
        );
        if (rows.length === 0) {
          return emptyResult(
            reportKey,
            "empty",
            input.emptyMessageFa,
            filter.asOf,
            lastCalculatedAt,
            subjectIds.length,
            {
              columns: eventColumns,
              reconcileHref: "/personnel-events/events",
              reconcileLabelFa: "رویدادهای پرسنلی",
            },
          );
        }
        return {
          reportKey,
          titleFa,
          outcome: "allowed",
          columns: eventColumns,
          rows,
          lastCalculatedAt,
          asOf: filter.asOf,
          populationVolume: subjectIds.length,
          reconcileHref: "/personnel-events/events",
          reconcileLabelFa: "رویدادهای پرسنلی",
        };
      }

      if (reportKey === "role_grade_compensation_changes") {
        const rows = events
          .filter(
            (e) =>
              (ROLE_GRADE_COMP_TYPES as readonly string[]).includes(
                e.eventType,
              ) &&
              e.status === "Effective" &&
              e.effectiveDate >= rangeStart &&
              e.effectiveDate <= rangeEnd,
          )
          .map((e) => ({
            id: e.id,
            href: "/personnel-events/events",
            cells: {
              eventId: e.id,
              personId: e.personId,
              eventType: e.eventType,
              effectiveDate: e.effectiveDate,
              status: e.status,
            },
          }));
        if (rows.length === 0) {
          return emptyResult(
            reportKey,
            "empty",
            input.emptyMessageFa,
            filter.asOf,
            lastCalculatedAt,
            subjectIds.length,
            {
              columns: eventColumns,
              reconcileHref: "/personnel-events/events",
              reconcileLabelFa: "رویدادهای پرسنلی",
            },
          );
        }
        return {
          reportKey,
          titleFa,
          outcome: "allowed",
          columns: eventColumns,
          rows,
          lastCalculatedAt,
          asOf: filter.asOf,
          populationVolume: subjectIds.length,
          reconcileHref: "/personnel-events/events",
          reconcileLabelFa: "رویدادهای پرسنلی",
        };
      }

      if (reportKey === "scheduled") {
        const filtered = filterEventsByStatus(
          toWorkforceRows(events),
          SCHEDULED_STATUSES,
          rangeStart,
          rangeEnd,
        );
        const aggregates = aggregateEventsByTypeAndStatus(
          toWorkforceRows(events),
          SCHEDULED_STATUSES,
          rangeStart,
          rangeEnd,
        );
        const detailRows = events
          .filter(
            (e) =>
              e.status === "Scheduled" &&
              e.effectiveDate >= rangeStart &&
              e.effectiveDate <= rangeEnd,
          )
          .map((e) => ({
            id: e.id,
            href: "/personnel-events/events",
            cells: {
              eventId: e.id,
              personId: e.personId,
              eventType: e.eventType,
              effectiveDate: e.effectiveDate,
              status: e.status,
              count: 1,
            },
          }));
        if (filtered.length === 0) {
          return emptyResult(
            reportKey,
            "empty",
            input.emptyMessageFa,
            filter.asOf,
            lastCalculatedAt,
            subjectIds.length,
            {
              columns: eventColumns,
              reconcileHref: "/personnel-events/events",
              reconcileLabelFa: "رویدادهای پرسنلی",
            },
          );
        }
        const summaryFa = aggregates
          .map((a) => `${a.eventType}/${a.status}: ${a.count}`)
          .join("؛ ");
        return {
          reportKey,
          titleFa,
          outcome: "allowed",
          messageFa: summaryFa ? `خلاصه زمان‌بندی‌شده — ${summaryFa}` : undefined,
          columns: eventColumns,
          rows: detailRows,
          lastCalculatedAt,
          asOf: filter.asOf,
          populationVolume: subjectIds.length,
          reconcileHref: "/personnel-events/events",
          reconcileLabelFa: "رویدادهای پرسنلی",
        };
      }

      // corrected_cancelled_reversed
      {
        // Corrected events appear as Effective successors; Cancelled/Reversed
        // are first-class statuses. Include events with correctsEventId set
        // OR Cancelled/Reversed status.
        const statusFiltered = filterEventsByStatus(
          toWorkforceRows(events),
          CORRECTED_CANCELLED_REVERSED_STATUSES,
          rangeStart,
          rangeEnd,
        );
        const corrected = events.filter(
          (e) =>
            e.correctsEventId != null &&
            e.effectiveDate >= rangeStart &&
            e.effectiveDate <= rangeEnd,
        );
        const cancelledReversed = events.filter(
          (e) =>
            (e.status === "Cancelled" || e.status === "Reversed") &&
            e.effectiveDate >= rangeStart &&
            e.effectiveDate <= rangeEnd,
        );
        const seen = new Set<string>();
        const rows: ReportRowDto[] = [];
        for (const e of [...cancelledReversed, ...corrected]) {
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          rows.push({
            id: e.id,
            href: "/personnel-events/events",
            cells: {
              eventId: e.id,
              personId: e.personId,
              eventType: e.eventType,
              effectiveDate: e.effectiveDate,
              status: e.status,
              correctsEventId: e.correctsEventId ?? "—",
            },
          });
        }
        if (rows.length === 0 && statusFiltered.length === 0) {
          return emptyResult(
            reportKey,
            "empty",
            input.emptyMessageFa,
            filter.asOf,
            lastCalculatedAt,
            subjectIds.length,
            {
              columns: eventColumns,
              reconcileHref: "/personnel-events/events",
              reconcileLabelFa: "رویدادهای پرسنلی",
            },
          );
        }
        return {
          reportKey,
          titleFa,
          outcome: "allowed",
          columns: [
            ...eventColumns,
            { id: "correctsEventId", headerFa: "اصلاحِ رویداد" },
          ],
          rows,
          lastCalculatedAt,
          asOf: filter.asOf,
          populationVolume: subjectIds.length,
          reconcileHref: "/personnel-events/events",
          reconcileLabelFa: "رویدادهای پرسنلی",
        };
      }
    }

    default: {
      const _exhaustive: never = reportKey;
      return emptyResult(
        _exhaustive,
        "error",
        "کلید گزارش ناشناخته است.",
        filter.asOf,
        lastCalculatedAt,
        null,
      );
    }
  }
}

export function defaultReportAsOfToday(): string {
  return todayDateOnlyTehran();
}
