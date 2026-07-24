/**
 * Permission-safe personnel search / list (Story 5.1 / FR-33).
 *
 * Pipeline: authorize (caller) → PopulationPort → InferenceBulk → access event
 * → list-row projector from Epic 4 current-state assembler.
 *
 * PopulationPort honesty: default registry remains fixture-backed (`person:a1`).
 * Until cutover criteria in population-cutover.ts are met, FR-33 fails closed
 * (empty population + Operator disclosure) — never stamps real Person UUIDs
 * with the actor's scopes as fake org authz.
 */

import { DEV_DEMO_CATEGORIES } from "@divan/audit-envelope";
import { COMPENSATION_DATA_CATEGORY } from "@divan/compensation-facts";
import { getSharedPgPool, type Pool } from "@divan/db";
import {
  currentAsOfDate,
  getPopulationFixtureRegistry,
  type PopulationFixtureRegistry,
} from "@divan/identity-access";
import {
  PERSON_DATA_CATEGORY,
  PERSONNEL_LIST_MAX_ROWS,
  actorHasCompensationRead,
  comparePersonnelListRows,
  getCurrentPersonState,
  getGradeById,
  getJobTitleById,
  getLadderById,
  getOrgUnitById,
  getOrganizationalRoleById,
  isPersonUuid,
  projectPersonnelListRow,
  rowMatchesPersonnelQuery,
  type PersonnelListLabelBundle,
  type PersonnelListRowDto,
} from "@divan/person-employment";

import { operationalCopy } from "@/lib/operational-copy";

import {
  POPULATION_FIXTURE_DISCLOSURE_FA,
  emptyFailClosedPopulationRegistry,
  registryUsesFixtureSubjects,
  type PopulationAuthzMode,
} from "./personnel-scoped-search-helpers";
import {
  runGovernedRetrieval,
  type RunGovernedRetrievalResult,
} from "./retrieval-control";

export {
  POPULATION_FIXTURE_DISCLOSURE_FA,
  registryUsesFixtureSubjects,
  emptyFailClosedPopulationRegistry,
  personnelProfileHref,
  type PopulationAuthzMode,
} from "./personnel-scoped-search-helpers";

export type PersonnelSearchOutcome =
  | "allowed"
  | "empty"
  | "suppressed"
  | "denied";

export type PersonnelScopedSearchResult = {
  outcome: PersonnelSearchOutcome;
  messageFa?: string;
  rows: PersonnelListRowDto[];
  /** Facet / count volume — never invented for suppressed. */
  volume: number | null;
  populationAuthzMode: PopulationAuthzMode;
  populationDisclosureFa: string | null;
  hasCompensationRead: boolean;
  /** Story 6.5 owns governed export — stub affordance only when true. */
  hasExportPermission: boolean;
  /** True when authorized subject set exceeded PERSONNEL_LIST_MAX_ROWS. */
  truncated: boolean;
  decisionId?: string;
};

let eventPool: Pool | null = null;

function getEventPool(): Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (eventPool) return eventPool;
  eventPool = getSharedPgPool(url);
  return eventPool;
}

export async function resolvePersonnelPopulationRegistry(): Promise<{
  registry: PopulationFixtureRegistry;
  mode: PopulationAuthzMode;
  disclosureFa: string | null;
}> {
  const active = getPopulationFixtureRegistry();
  if (!registryUsesFixtureSubjects(active)) {
    return {
      registry: active,
      mode: "uuid-registry",
      disclosureFa: null,
    };
  }
  return {
    registry: emptyFailClosedPopulationRegistry(),
    mode: "fixture-fail-closed",
    disclosureFa: POPULATION_FIXTURE_DISCLOSURE_FA,
  };
}

/**
 * Resolve org/job display labels for assembler states (list + profile).
 * Includes secondary-assignment org/role/job/ladder/grade ids (Story 5.2).
 */
export async function resolveLabelsForStates(
  states: Awaited<ReturnType<typeof getCurrentPersonState>>[],
): Promise<PersonnelListLabelBundle & { orgUnitNameById: Map<string, string> }> {
  const teamIds = new Set<string>();
  const orgUnitIds = new Set<string>();
  const roleIds = new Set<string>();
  const jobTitleIds = new Set<string>();
  const ladderIds = new Set<string>();
  const gradeIds = new Set<string>();

  for (const s of states) {
    if (!s || !("ok" in s) || !s.ok) continue;
    const teamId = s.teamMembership?.teamId ?? s.primaryAssignment?.teamId;
    if (teamId) teamIds.add(teamId);
    const primary = s.primaryAssignment;
    if (primary) {
      roleIds.add(primary.organizationalRoleId);
      jobTitleIds.add(primary.jobTitleId);
      ladderIds.add(primary.ladderId);
      gradeIds.add(primary.gradeId);
    }
    for (const sec of s.secondaryAssignments) {
      orgUnitIds.add(sec.orgUnitId);
      if (sec.organizationalRoleId) roleIds.add(sec.organizationalRoleId);
      if (sec.jobTitleId) jobTitleIds.add(sec.jobTitleId);
      if (sec.ladderId) ladderIds.add(sec.ladderId);
      if (sec.gradeId) gradeIds.add(sec.gradeId);
    }
  }

  const teamNameById = new Map<string, string>();
  const orgUnitNameById = new Map<string, string>();
  const roleNameById = new Map<string, string>();
  const jobTitleNameById = new Map<string, string>();
  const ladderNameById = new Map<string, string>();
  const gradeNameById = new Map<string, string>();

  await Promise.all([
    ...[...teamIds].map(async (id) => {
      const u = await getOrgUnitById(id);
      if (u) teamNameById.set(id, u.nameFa);
    }),
    ...[...orgUnitIds].map(async (id) => {
      const u = await getOrgUnitById(id);
      if (u) orgUnitNameById.set(id, u.nameFa);
    }),
    ...[...roleIds].map(async (id) => {
      const r = await getOrganizationalRoleById(id);
      if (r) roleNameById.set(id, r.nameFa);
    }),
    ...[...jobTitleIds].map(async (id) => {
      const t = await getJobTitleById(id);
      if (t) jobTitleNameById.set(id, t.nameFa);
    }),
    ...[...ladderIds].map(async (id) => {
      const l = await getLadderById(id);
      if (l) ladderNameById.set(id, l.nameFa);
    }),
    ...[...gradeIds].map(async (id) => {
      const g = await getGradeById(id);
      if (g) gradeNameById.set(id, g.nameFa);
    }),
  ]);

  return {
    teamNameById,
    orgUnitNameById,
    roleNameById,
    jobTitleNameById,
    ladderNameById,
    gradeNameById,
  };
}

/**
 * Hydrate authorized Person UUIDs → list rows via getCurrentPersonState.
 * Freshness fail-closed: pending/failed/stale rows are excluded (not shown as truth).
 * Budget: up to PERSONNEL_LIST_MAX_ROWS parallel assembler calls (MVP envelope).
 */
export async function projectAuthorizedPersonnelRows(input: {
  subjectIds: readonly string[];
  accountId: string;
  hasCompensationRead: boolean;
}): Promise<{ rows: PersonnelListRowDto[]; truncated: boolean }> {
  const uuidIds = [...new Set(input.subjectIds.filter(isPersonUuid))];
  if (uuidIds.length === 0) return { rows: [], truncated: false };

  const truncated = uuidIds.length > PERSONNEL_LIST_MAX_ROWS;
  const cappedIds = truncated
    ? uuidIds.slice(0, PERSONNEL_LIST_MAX_ROWS)
    : uuidIds;

  const allowedCategories = new Set<string>([PERSON_DATA_CATEGORY]);
  if (input.hasCompensationRead) {
    allowedCategories.add(COMPENSATION_DATA_CATEGORY);
  }

  const eventDb = getEventPool();
  if (!eventDb) {
    return { rows: [], truncated: false };
  }

  const states = await Promise.all(
    cappedIds.map((personId) =>
      getCurrentPersonState(
        personId,
        {
          actorAuthz: {
            allowedCategories,
            categories: DEV_DEMO_CATEGORIES,
            hasCompensationRead: input.hasCompensationRead,
          },
        },
        { eventDb },
      ).catch(() => null),
    ),
  );

  const presentStates = states.filter(
    (s): s is NonNullable<(typeof states)[number]> => s != null,
  );
  const okStates = presentStates.filter(
    (s): s is Extract<(typeof presentStates)[number], { ok: true }> =>
      s.ok === true,
  );

  const labels = await resolveLabelsForStates(presentStates);
  const rows = okStates.map((s) => projectPersonnelListRow(s, labels));
  rows.sort(comparePersonnelListRows);
  return { rows, truncated };
}

function mapRetrievalOutcome(
  result: RunGovernedRetrievalResult,
): Pick<
  PersonnelScopedSearchResult,
  "outcome" | "messageFa" | "volume" | "decisionId"
> {
  const { payload } = result;
  switch (payload.outcome) {
    case "allowed":
      return {
        outcome: "allowed",
        volume: payload.volume,
        decisionId: payload.decisionId,
      };
    case "empty":
      return {
        outcome: "empty",
        volume: 0,
        decisionId: payload.decisionId,
      };
    case "suppressed":
      return {
        outcome: "suppressed",
        messageFa: payload.messageFa || operationalCopy.suppressedCohort,
        volume: null,
        decisionId: payload.decisionId,
      };
    default:
      return {
        outcome: "denied",
        messageFa: payload.messageFa || operationalCopy.accessDeniedTitle,
        volume: null,
        decisionId: payload.decisionId,
      };
  }
}

function emptyDeniedResult(
  partial: Partial<PersonnelScopedSearchResult> & {
    populationAuthzMode: PopulationAuthzMode;
    populationDisclosureFa: string | null;
    hasCompensationRead: boolean;
  },
): PersonnelScopedSearchResult {
  return {
    outcome: "denied",
    messageFa: operationalCopy.accessDeniedTitle,
    rows: [],
    volume: null,
    hasExportPermission: false,
    truncated: false,
    ...partial,
  };
}

export type RunPersonnelScopedSearchInput = {
  actorAccountId: string;
  actorScopeCodes: string[];
  correlationId: string;
  channel: "search" | "list";
  /** Optional Latin-normalized query (palette / server filter). */
  normalizedQuery?: string;
  /** When set, further narrow objectIds (e.g. getById scope probe). */
  objectIds?: string[];
  skipAccessEvent?: boolean;
  /** Inject registry for selfchecks (scope-denial oracle). */
  populationRegistryOverride?: PopulationFixtureRegistry;
  populationAuthzModeOverride?: PopulationAuthzMode;
  populationDisclosureOverride?: string | null;
};

/**
 * Full FR-33 search/list: PopulationPort ∩ InferenceBulk → projector.
 */
export async function runPersonnelScopedSearch(
  input: RunPersonnelScopedSearchInput,
): Promise<PersonnelScopedSearchResult> {
  const hasCompensationRead = await actorHasCompensationRead(
    input.actorAccountId,
  );

  if (input.actorScopeCodes.length === 0) {
    return emptyDeniedResult({
      populationAuthzMode: "fixture-fail-closed",
      populationDisclosureFa: null,
      hasCompensationRead,
    });
  }

  let registry: PopulationFixtureRegistry;
  let mode: PopulationAuthzMode;
  let disclosureFa: string | null;

  if (input.populationRegistryOverride) {
    registry = input.populationRegistryOverride;
    mode = input.populationAuthzModeOverride ?? "uuid-registry";
    disclosureFa =
      input.populationDisclosureOverride === undefined
        ? null
        : input.populationDisclosureOverride;
  } else {
    const resolved = await resolvePersonnelPopulationRegistry();
    registry = resolved.registry;
    mode = resolved.mode;
    disclosureFa = resolved.disclosureFa;
  }

  const retrieval = await runGovernedRetrieval({
    actorAccountId: input.actorAccountId,
    actorScopeCodes: input.actorScopeCodes,
    channel: input.channel,
    asOfDate: currentAsOfDate(),
    objectIds: input.objectIds,
    dataCategory: PERSON_DATA_CATEGORY,
    correlationId: input.correlationId,
    purpose: `personnel.${input.channel}`,
    organizationalScope: input.actorScopeCodes[0],
    populationRegistry: registry,
    skipAccessEvent: input.skipAccessEvent,
  });

  const mapped = mapRetrievalOutcome(retrieval);
  if (mapped.outcome !== "allowed") {
    return {
      ...mapped,
      rows: [],
      populationAuthzMode: mode,
      populationDisclosureFa: disclosureFa,
      hasCompensationRead,
      hasExportPermission: false,
      truncated: false,
    };
  }

  if (!getEventPool()) {
    return emptyDeniedResult({
      populationAuthzMode: mode,
      populationDisclosureFa: disclosureFa,
      hasCompensationRead,
      messageFa: operationalCopy.accessDeniedTitle,
    });
  }

  const projected = await projectAuthorizedPersonnelRows({
    subjectIds: retrieval.subjectIds,
    accountId: input.actorAccountId,
    hasCompensationRead,
  });

  let rows = projected.rows;
  const q = input.normalizedQuery?.trim();
  if (q) {
    rows = rows.filter((r) => rowMatchesPersonnelQuery(r, q));
  }

  return {
    outcome: "allowed",
    rows,
    volume: rows.length,
    populationAuthzMode: mode,
    populationDisclosureFa: disclosureFa,
    hasCompensationRead,
    hasExportPermission: false,
    truncated: projected.truncated,
    decisionId: mapped.decisionId,
  };
}

/**
 * Same population intersection used by list/search — for get/update IDOR gate.
 * Default identity channel `profile`; timeline list uses `timeline` (Story 5.3).
 * Missing vs out-of-scope: uniform NOT_FOUND (do not invent AR-ACCESS enumeration timing).
 */
export async function assertPersonInScopedPopulation(input: {
  personId: string;
  actorAccountId: string;
  actorScopeCodes: string[];
  correlationId: string;
  skipAccessEvent?: boolean;
  /** Defaults to `profile` so 5.1/5.2 callers stay stable. */
  channel?: "profile" | "timeline";
}): Promise<void> {
  const { PersonIdentityError } = await import("@divan/person-employment");
  const channel = input.channel ?? "profile";

  if (!isPersonUuid(input.personId)) {
    throw new PersonIdentityError("PERSON_NOT_FOUND", "پرسنل یافت نشد.");
  }

  if (input.actorScopeCodes.length === 0) {
    throw new PersonIdentityError("PERSON_NOT_FOUND", "پرسنل یافت نشد.");
  }

  try {
    const { registry } = await resolvePersonnelPopulationRegistry();

    const retrieval = await runGovernedRetrieval({
      actorAccountId: input.actorAccountId,
      actorScopeCodes: input.actorScopeCodes,
      channel,
      asOfDate: currentAsOfDate(),
      objectIds: [input.personId],
      dataCategory: PERSON_DATA_CATEGORY,
      correlationId: input.correlationId,
      purpose:
        channel === "timeline"
          ? "personnel.timeline_scope"
          : "personnel.get_scope",
      organizationalScope: input.actorScopeCodes[0],
      populationRegistry: registry,
      skipAccessEvent: input.skipAccessEvent ?? true,
    });

    if (!retrieval.subjectIds.includes(input.personId)) {
      throw new PersonIdentityError("PERSON_NOT_FOUND", "پرسنل یافت نشد.");
    }
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name: string }).name === "PersonIdentityError" &&
      "code" in err &&
      (err as { code: string }).code === "PERSON_NOT_FOUND"
    ) {
      throw err;
    }
    throw new PersonIdentityError("PERSON_NOT_FOUND", "پرسنل یافت نشد.");
  }
}
