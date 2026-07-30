/**
 * Permission-safe personnel search / list (Story 5.1 / FR-33).
 *
 * Pipeline: authorize (caller) → PopulationPort → InferenceBulk → access event
 * → list-row projector from Epic 4 current-state assembler.
 *
 * PopulationPort honesty: default registry remains fixture-backed (`person:a1`).
 * Until cutover criteria in population-cutover.ts are met, FR-33 fails closed
 * (empty population + Operator disclosure) — never stamps real Person UUIDs
 * with the actor's scopes as fake org authz *in production*.
 *
 * Local/dev only: `ALLOW_DEV_POPULATION_UUID_REGISTRY=true` (+ `ALLOW_DEV_SEED=true`,
 * non-production) may build a provisional Person UUID ∩ `org:selfcheck` registry
 * with an honest disclosure — still not default-registry cutover.
 */

import {
  DEV_DEMO_CATEGORIES,
  EvaluationSnapshotError,
  MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
  MSG_EVAL_SNAPSHOT_REF_CHANGED_FA,
  MSG_EVAL_SNAPSHOT_VERSION_MIX_FA,
  beginEvaluationSnapshot,
  clearInferenceBulkWindowsForTests,
  computeContentFingerprint,
  getEvaluationSnapshot,
  getInferenceBulkHooks,
  revalidateEvaluationSnapshot,
  throwEvaluationSnapshotConflict,
  type AuthoritativeEvaluationSnapshot,
} from "@divan/audit-envelope";
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
  getPersonDb,
  isPersonUuid,
  projectPersonnelListRow,
  rowMatchesPersonnelQuery,
  type PersonnelListLabelBundle,
  type PersonnelListRowDto,
} from "@divan/person-employment";

import { operationalCopy } from "@/lib/operational-copy";

import {
  computePersonnelExportSnapshotHash,
  softHasPersonExport,
  PERSONNEL_EXPORT_FIELDS,
} from "./export-capability";
import {
  POPULATION_DEV_UUID_DISCLOSURE_FA,
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
  POPULATION_DEV_UUID_DISCLOSURE_FA,
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
  /** Governed export affordance (Story 6.5) — false when unauthorized. */
  hasExportPermission: boolean;
  /** Snapshot hash for export.createFromPersonnel when hasExportPermission. */
  exportSnapshotHash: string | null;
  /** True when authorized subject set exceeded PERSONNEL_LIST_MAX_ROWS. */
  truncated: boolean;
  decisionId?: string;
  /** Story 7.8 — pagination snapshot token; null when not applicable. */
  evaluationSnapshotId: string | null;
  page: number;
  pageSize: number;
  /** Frozen membership size for the active snapshot token; null when not applicable. */
  totalInSnapshot: number | null;
};

/** Story 7.8 — FR-33 authoritative pagination defaults. */
export const PERSONNEL_SEARCH_PAGE_SIZE_DEFAULT = 50;
export const PERSONNEL_SEARCH_PAGE_SIZE_MAX = 100;
const PERSONNEL_SEARCH_PAGINATION_TTL_MS = 60 * 60 * 1000;
const EVAL_SNAPSHOT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolvePageParams(input: {
  page?: number;
  pageSize?: number;
}): { page: number; pageSize: number } {
  const page =
    Number.isInteger(input.page) && (input.page as number) >= 1
      ? (input.page as number)
      : 1;
  const rawSize = Number.isInteger(input.pageSize)
    ? (input.pageSize as number)
    : PERSONNEL_SEARCH_PAGE_SIZE_DEFAULT;
  const pageSize = Math.min(
    Math.max(rawSize, 1),
    PERSONNEL_SEARCH_PAGE_SIZE_MAX,
  );
  return { page, pageSize };
}

/** Canonical fingerprint payload — filter/sort/pageSize change must mint a new snapshot. */
function personnelPaginationPayload(input: {
  channel: "search" | "list";
  normalizedQuery?: string;
  sortKey?: string;
  pageSize: number;
}): Record<string, unknown> {
  return {
    channel: input.channel,
    normalizedQuery: input.normalizedQuery?.trim() || null,
    sortKey: input.sortKey?.trim() || null,
    pageSize: input.pageSize,
  };
}

/** Filter/sort/pageSize drift vs the token's frozen payload → VERSION_MIX (restart at page 1). */
function assertPaginationTokenMatches(
  snapshot: AuthoritativeEvaluationSnapshot,
  input: {
    channel: "search" | "list";
    normalizedQuery?: string;
    sortKey?: string;
    pageSize: number;
  },
): void {
  if (snapshot.kind !== "pagination") {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_VERSION_MIX",
      MSG_EVAL_SNAPSHOT_VERSION_MIX_FA,
    );
  }
  const liveFingerprint = computeContentFingerprint(
    personnelPaginationPayload(input),
  );
  if (liveFingerprint !== snapshot.contentFingerprint) {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_VERSION_MIX",
      MSG_EVAL_SNAPSHOT_VERSION_MIX_FA,
    );
  }
}

async function actorPermissionFingerprint(accountId: string): Promise<string> {
  const db = getPersonDb();
  const rows = await db.accountAccessRole.findMany({
    where: { accountId },
    include: { accessRole: { include: { permissionSet: true } } },
  });
  const perms = new Set<string>();
  for (const row of rows) {
    const raw = row.accessRole.permissionSet?.permissions;
    if (!Array.isArray(raw)) continue;
    for (const p of raw) {
      if (typeof p === "string" && p.trim()) perms.add(p.trim());
    }
  }
  return computeContentFingerprint([...perms].sort());
}

function paginationMemberIds(
  snapshot: AuthoritativeEvaluationSnapshot,
): string[] {
  const raw = snapshot.boundRefs?.memberIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

/**
 * Story 7.8 §6 — soft-fail only: local envs without migration `021_*` applied
 * must not hard-crash page 1 search; pagination just runs without a token.
 */
function isMissingEvaluationSnapshotRelation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: unknown }).code) : "";
  if (code === "42P01") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /governance\.evaluation_snapshot|does not exist|undefined_table/i.test(
    msg,
  );
}

let eventPool: Pool | null = null;

function getEventPool(): Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (eventPool) return eventPool;
  eventPool = getSharedPgPool(url);
  return eventPool;
}

/** Soft cap for provisional DEV population subjects (projector still uses PERSONNEL_LIST_MAX_ROWS). */
const DEV_POPULATION_UUID_SUBJECT_CAP = 2000;

function isDevUuidPopulationRegistryEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.ALLOW_DEV_SEED !== "true") return false;
  return env.ALLOW_DEV_POPULATION_UUID_REGISTRY === "true";
}

/**
 * Provisional local registry: Person.id ∩ org:selfcheck.
 * Opt-in only — does not satisfy population-cutover.ts production criteria.
 */
async function tryBuildDevUuidPopulationRegistry(): Promise<{
  registry: PopulationFixtureRegistry;
  mode: PopulationAuthzMode;
  disclosureFa: string;
} | null> {
  if (!isDevUuidPopulationRegistryEnabled()) return null;

  const people = await getPersonDb().person.findMany({
    select: { id: true },
    take: DEV_POPULATION_UUID_SUBJECT_CAP,
  });
  const subjects = people
    .map((p) => p.id)
    .filter(isPersonUuid)
    .map((id) => ({
      id,
      scopeCodes: ["org:selfcheck"] as string[],
    }));

  return {
    registry: {
      subjects,
      relationships: [],
      crossTimeGrants: [],
      facts: [],
    },
    mode: "uuid-registry",
    disclosureFa: POPULATION_DEV_UUID_DISCLOSURE_FA,
  };
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

  const provisional = await tryBuildDevUuidPopulationRegistry();
  if (provisional) {
    return provisional;
  }

  return {
    registry: emptyFailClosedPopulationRegistry(),
    mode: "fixture-fail-closed",
    disclosureFa: POPULATION_FIXTURE_DISCLOSURE_FA,
  };
}

/**
 * Provisional DEV UUID registry can be hundreds of subjects; DEMO InferenceBulk
 * ceilings (`maxVolumePerRequest=10`) otherwise hard-deny dashboard/report/list.
 * Cap + local bulk-approval mirror list/search — not production cutover.
 */
export function applyDevUuidInferenceBulkGuard(
  registry: PopulationFixtureRegistry,
  mode: PopulationAuthzMode,
): {
  registry: PopulationFixtureRegistry;
  demoBulkApproval: boolean;
  inferenceCapped: boolean;
} {
  const hooks = getInferenceBulkHooks();
  const devUuid =
    isDevUuidPopulationRegistryEnabled() && mode === "uuid-registry";
  if (!devUuid) {
    return { registry, demoBulkApproval: false, inferenceCapped: false };
  }

  // Prior oversized denies charge DEMO windows and brick the actor for 60s —
  // clear for provisional local retrieval surfaces only.
  clearInferenceBulkWindowsForTests();
  const cap = hooks.maxVolumePerRequest > 0 ? hooks.maxVolumePerRequest : 10;
  if (registry.subjects.length > cap) {
    return {
      registry: {
        ...registry,
        subjects: registry.subjects.slice(0, cap),
      },
      demoBulkApproval: true,
      inferenceCapped: true,
    };
  }
  return { registry, demoBulkApproval: true, inferenceCapped: false };
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
    case "require_bulk_approval":
      return {
        outcome: "denied",
        messageFa:
          payload.messageFa ||
          "برای فهرست با حجم بالاتر، تأیید بازیابی انبوه لازم است.",
        volume: null,
        decisionId: payload.decisionId,
      };
    default:
      return {
        outcome: "denied",
        messageFa:
          payload.reason != null
            ? `${payload.messageFa || operationalCopy.accessDeniedTitle} (${payload.reason})`
            : payload.messageFa || operationalCopy.accessDeniedTitle,
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
    page: number;
    pageSize: number;
  },
): PersonnelScopedSearchResult {
  return {
    outcome: "denied",
    messageFa: operationalCopy.accessDeniedTitle,
    rows: [],
    volume: null,
    hasExportPermission: false,
    exportSnapshotHash: null,
    truncated: false,
    evaluationSnapshotId: null,
    totalInSnapshot: null,
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
  /** Story 7.8 — 1-based page number. Defaults to 1. */
  page?: number;
  /** Default 50, capped at 100. */
  pageSize?: number;
  /** Continuation token from a prior page===1 response; required for page>1. */
  evaluationSnapshotId?: string;
  /** Opaque sort key — part of the pagination snapshot fingerprint. */
  sortKey?: string;
};

/**
 * Full FR-33 search/list: PopulationPort ∩ InferenceBulk → projector.
 */
export async function runPersonnelScopedSearch(
  input: RunPersonnelScopedSearchInput,
): Promise<PersonnelScopedSearchResult> {
  const { page, pageSize } = resolvePageParams(input);
  const hasCompensationRead = await actorHasCompensationRead(
    input.actorAccountId,
  );

  if (input.actorScopeCodes.length === 0) {
    return emptyDeniedResult({
      populationAuthzMode: "fixture-fail-closed",
      populationDisclosureFa: null,
      hasCompensationRead,
      page,
      pageSize,
    });
  }

  // Story 7.8 — pagination continuation: page>1 always requires a token; a
  // token supplied on page 1 re-serves the same frozen membership (refresh).
  if (page > 1 || input.evaluationSnapshotId) {
    if (!input.evaluationSnapshotId) {
      return emptyDeniedResult({
        populationAuthzMode: "fixture-fail-closed",
        populationDisclosureFa: null,
        hasCompensationRead,
        page,
        pageSize,
        messageFa: MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
      });
    }
    if (!EVAL_SNAPSHOT_UUID_RE.test(input.evaluationSnapshotId)) {
      return emptyDeniedResult({
        populationAuthzMode: "fixture-fail-closed",
        populationDisclosureFa: null,
        hasCompensationRead,
        page,
        pageSize,
        messageFa: MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
      });
    }
    const eventDb = getEventPool();
    if (!eventDb) {
      return emptyDeniedResult({
        populationAuthzMode: "fixture-fail-closed",
        populationDisclosureFa: null,
        hasCompensationRead,
        page,
        pageSize,
        messageFa: operationalCopy.accessDeniedTitle,
      });
    }
    try {
      const snapshot = await getEvaluationSnapshot(
        eventDb,
        input.evaluationSnapshotId,
      );
      // Never serve another actor's frozen membership (IDOR).
      if (snapshot.attribution.actorAccountId !== input.actorAccountId) {
        throw new EvaluationSnapshotError(
          "EVAL_SNAPSHOT_NOT_FOUND",
          MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
        );
      }
      assertPaginationTokenMatches(snapshot, {
        channel: input.channel,
        normalizedQuery: input.normalizedQuery,
        sortKey: input.sortKey,
        pageSize,
      });

      const livePermFp = await actorPermissionFingerprint(input.actorAccountId);
      const permCheck = await revalidateEvaluationSnapshot(eventDb, snapshot, {
        permissionFingerprint: livePermFp,
      });
      if (!("ok" in permCheck)) {
        throwEvaluationSnapshotConflict(permCheck);
      }

      const memberIds = paginationMemberIds(snapshot);
      const start = (page - 1) * pageSize;
      const pageIds = memberIds.slice(start, start + pageSize);

      const projected = await projectAuthorizedPersonnelRows({
        subjectIds: pageIds,
        accountId: input.actorAccountId,
        hasCompensationRead,
      });

      if (pageIds.length > 0 && projected.rows.length !== pageIds.length) {
        throw new EvaluationSnapshotError(
          "EVAL_SNAPSHOT_REF_CHANGED",
          MSG_EVAL_SNAPSHOT_REF_CHANGED_FA,
        );
      }

      const hasExportPermission = await softHasPersonExport(
        input.actorAccountId,
      );
      const fieldIds = PERSONNEL_EXPORT_FIELDS.filter(
        (f) => hasCompensationRead || f.id !== "compensation",
      ).map((f) => f.id);
      const exportSnapshotHash = hasExportPermission
        ? computePersonnelExportSnapshotHash({
            normalizedQuery: input.normalizedQuery?.trim() || null,
            asOf: currentAsOfDate(),
            fieldIds,
          })
        : null;

      return {
        outcome: memberIds.length === 0 || pageIds.length > 0 ? "allowed" : "empty",
        rows: projected.rows,
        volume: projected.rows.length,
        populationAuthzMode: "uuid-registry",
        populationDisclosureFa: null,
        hasCompensationRead,
        hasExportPermission,
        exportSnapshotHash,
        truncated: false,
        evaluationSnapshotId: snapshot.id,
        page,
        pageSize,
        totalInSnapshot: memberIds.length,
      };
    } catch (err) {
      // Map snapshot conflicts to operational Persian copy, never raw 500.
      if (err instanceof EvaluationSnapshotError) {
        return emptyDeniedResult({
          populationAuthzMode: "fixture-fail-closed",
          populationDisclosureFa: null,
          hasCompensationRead,
          page,
          pageSize,
          messageFa: err.messageFa,
        });
      }
      if (isMissingEvaluationSnapshotRelation(err)) {
        return emptyDeniedResult({
          populationAuthzMode: "fixture-fail-closed",
          populationDisclosureFa: null,
          hasCompensationRead,
          page,
          pageSize,
          messageFa: MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
        });
      }
      throw err;
    }
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

  /**
   * DEMO InferenceBulk: maxVolumePerRequest=10 and bulkApprovalVolumeThreshold=5.
   * A full Person UUID registry otherwise hard-denies (≥5 without bulk grant, >10 always).
   * Provisional DEV path: cap + treat as bulk-approved for local UI only.
   */
  const {
    registry: inferenceRegistry,
    demoBulkApproval,
    inferenceCapped,
  } = applyDevUuidInferenceBulkGuard(registry, mode);

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
    populationRegistry: inferenceRegistry,
    skipAccessEvent: input.skipAccessEvent,
    demoBulkApproval,
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
      exportSnapshotHash: null,
      truncated: inferenceCapped,
      evaluationSnapshotId: null,
      page,
      pageSize,
      totalInSnapshot: null,
    };
  }

  const eventDb = getEventPool();
  if (!eventDb) {
    return emptyDeniedResult({
      populationAuthzMode: mode,
      populationDisclosureFa: disclosureFa,
      hasCompensationRead,
      page,
      pageSize,
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

  const hasExportPermission = await softHasPersonExport(input.actorAccountId);
  const fieldIds = PERSONNEL_EXPORT_FIELDS.filter(
    (f) => hasCompensationRead || f.id !== "compensation",
  ).map((f) => f.id);
  const exportSnapshotHash = hasExportPermission
    ? computePersonnelExportSnapshotHash({
        normalizedQuery: q ?? null,
        asOf: currentAsOfDate(),
        fieldIds,
      })
    : null;

  // Story 7.8 — mint the pagination snapshot over the full (pre-slice) membership.
  // Fail-closed (AC1/AC6): no allowed page-1 without an attributable snapshot token.
  const permissionFingerprint = await actorPermissionFingerprint(
    input.actorAccountId,
  );
  let evaluationSnapshotId: string;
  try {
    const snap = await beginEvaluationSnapshot(eventDb, {
      kind: "pagination",
      payload: personnelPaginationPayload({
        channel: input.channel,
        normalizedQuery: q,
        sortKey: input.sortKey,
        pageSize,
      }),
      attribution: {
        actorAccountId: input.actorAccountId,
        permissionFingerprint,
      },
      correlationId: input.correlationId,
      boundRefs: { memberIds: rows.map((r) => r.id) },
      expiresAt: new Date(
        Date.now() + PERSONNEL_SEARCH_PAGINATION_TTL_MS,
      ).toISOString(),
    });
    evaluationSnapshotId = snap.id;
  } catch (err) {
    if (isMissingEvaluationSnapshotRelation(err)) {
      return emptyDeniedResult({
        populationAuthzMode: mode,
        populationDisclosureFa: disclosureFa,
        hasCompensationRead,
        page,
        pageSize,
        messageFa: MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
      });
    }
    if (err instanceof EvaluationSnapshotError) {
      return emptyDeniedResult({
        populationAuthzMode: mode,
        populationDisclosureFa: disclosureFa,
        hasCompensationRead,
        page,
        pageSize,
        messageFa: err.messageFa,
      });
    }
    throw err;
  }

  const totalInSnapshot = rows.length;
  const pageRows = rows.slice(0, pageSize);

  return {
    outcome: "allowed",
    rows: pageRows,
    volume: rows.length,
    populationAuthzMode: mode,
    populationDisclosureFa: disclosureFa,
    hasCompensationRead,
    hasExportPermission,
    exportSnapshotHash,
    truncated: projected.truncated || inferenceCapped,
    decisionId: mapped.decisionId,
    evaluationSnapshotId,
    page,
    pageSize,
    totalInSnapshot,
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
