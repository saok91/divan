/**
 * Permission-safe org-wide personnel event catalogue (Story 9.6 / FR-33 / FR-59).
 *
 * Pipeline: authorize → PopulationPort ∩ InferenceBulk (channel "list") →
 * optional team/person intersect → event-store UI list + batched drafts →
 * resolveLifecycleStatus → evaluation-snapshot pagination.
 *
 * Does not replace `listForPerson` (timeline SoT).
 */

import {
  EvaluationSnapshotError,
  MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
  MSG_EVAL_SNAPSHOT_REF_CHANGED_FA,
  MSG_EVAL_SNAPSHOT_VERSION_MIX_FA,
  beginEvaluationSnapshot,
  computeContentFingerprint,
  getEvaluationSnapshot,
  revalidateEvaluationSnapshot,
  throwEvaluationSnapshotConflict,
  type AuthoritativeEvaluationSnapshot,
} from "@divan/audit-envelope";
import { getSharedPgPool, type Pool } from "@divan/db";
import {
  BUSINESS_EVENTS_UI_LIST_LIMIT_MAX,
  listBusinessEventsByIds,
  listBusinessEventsForPersons,
  listChainLinksForEvents,
  type BusinessEventStatus,
} from "@divan/event-store";
import { currentAsOfDate } from "@divan/identity-access";
import {
  PERSONNEL_EVENT_DATA_CATEGORY,
  assertActorHasPersonnelEventDraft,
  getPersonDb,
  getPersonsByIds,
  listDraftsByIds,
  listOpenDraftsForPersons,
  listTeamMembersAsOf,
  ManagementRelationshipError,
  resolveLifecycleStatus,
  type ResolvedLifecycleStatus,
} from "@divan/person-employment";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import { operationalCopy } from "@/lib/operational-copy";
import { eventTypeLabelFa } from "@/lib/personnel-event-timeline";

import {
  applyDevUuidInferenceBulkGuard,
  resolvePersonnelPopulationRegistry,
  type PopulationAuthzMode,
} from "./personnel-scoped-search";
import { runGovernedRetrieval } from "./retrieval-control";
const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;
const PAGINATION_TTL_MS = 60 * 60 * 1000;
const EVAL_SNAPSHOT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PersonnelEventSearchOutcome =
  | "allowed"
  | "empty"
  | "suppressed"
  | "denied";

export type PersonnelEventListRowDto = {
  id: string;
  personId: string;
  personLabel: string;
  personnelCode: string | null;
  eventType: string;
  eventTypeLabelFa: string;
  effectiveDate: string;
  resolvedStatus: ResolvedLifecycleStatus;
  source: "event" | "draft";
};

export type PersonnelEventSearchResult = {
  outcome: PersonnelEventSearchOutcome;
  messageFa?: string;
  rows: PersonnelEventListRowDto[];
  populationAuthzMode: PopulationAuthzMode;
  populationDisclosureFa: string | null;
  truncated: boolean;
  evaluationSnapshotId: string | null;
  page: number;
  pageSize: number;
  totalInSnapshot: number | null;
};

export type RunPersonnelEventSearchInput = {
  actorAccountId: string;
  actorScopeCodes: string[];
  correlationId: string;
  page?: number;
  pageSize?: number;
  evaluationSnapshotId?: string;
  eventTypes?: string[];
  /** Resolved lifecycle statuses (post-resolve); include Draft for open drafts. */
  statuses?: ResolvedLifecycleStatus[];
  effectiveFrom?: string;
  effectiveTo?: string;
  teamId?: string;
  personId?: string;
};

type CatalogueMember = {
  memberKey: string;
  source: "event" | "draft";
  rawId: string;
  personId: string;
  eventType: string;
  effectiveDate: string;
  sortRegisteredAt: number;
  resolvedStatus: ResolvedLifecycleStatus;
};

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
    : PAGE_SIZE_DEFAULT;
  const pageSize = Math.min(Math.max(rawSize, 1), PAGE_SIZE_MAX);
  return { page, pageSize };
}

function paginationPayload(input: {
  eventTypes?: string[];
  statuses?: string[];
  effectiveFrom?: string;
  effectiveTo?: string;
  teamId?: string;
  personId?: string;
  pageSize: number;
}): Record<string, unknown> {
  return {
    channel: "list",
    surface: "personnel_event_search",
    eventTypes: (input.eventTypes ?? []).map((t) => t.trim()).filter(Boolean).sort(),
    statuses: (input.statuses ?? []).map((s) => s.trim()).filter(Boolean).sort(),
    effectiveFrom: input.effectiveFrom?.trim() || null,
    effectiveTo: input.effectiveTo?.trim() || null,
    teamId: input.teamId?.trim() || null,
    personId: input.personId?.trim() || null,
    pageSize: input.pageSize,
  };
}

function assertPaginationTokenMatches(
  snapshot: AuthoritativeEvaluationSnapshot,
  input: Parameters<typeof paginationPayload>[0],
): void {
  if (snapshot.kind !== "pagination") {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_VERSION_MIX",
      MSG_EVAL_SNAPSHOT_VERSION_MIX_FA,
    );
  }
  const live = computeContentFingerprint(paginationPayload(input));
  if (live !== snapshot.contentFingerprint) {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_VERSION_MIX",
      MSG_EVAL_SNAPSHOT_VERSION_MIX_FA,
    );
  }
}

function paginationMemberIds(
  snapshot: AuthoritativeEvaluationSnapshot,
): string[] {
  const raw = snapshot.boundRefs?.memberIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

/** Mint-time honesty fields persisted for continuation pages. */
function catalogueBoundRefs(input: {
  memberIds: string[];
  truncated: boolean;
  populationAuthzMode: PopulationAuthzMode;
  populationDisclosureFa: string | null;
}): Record<string, unknown> {
  return {
    memberIds: input.memberIds,
    truncated: input.truncated,
    populationAuthzMode: input.populationAuthzMode,
    populationDisclosureFa: input.populationDisclosureFa,
  };
}

function paginationHonestyFromBoundRefs(
  snapshot: AuthoritativeEvaluationSnapshot,
): {
  populationAuthzMode: PopulationAuthzMode;
  populationDisclosureFa: string | null;
  truncated: boolean;
} {
  const refs = snapshot.boundRefs ?? {};
  const modeRaw = refs.populationAuthzMode;
  const populationAuthzMode: PopulationAuthzMode =
    modeRaw === "fixture-fail-closed" || modeRaw === "uuid-registry"
      ? modeRaw
      : "uuid-registry";
  const disclosureRaw = refs.populationDisclosureFa;
  const populationDisclosureFa =
    typeof disclosureRaw === "string" && disclosureRaw.trim().length > 0
      ? disclosureRaw
      : null;
  return {
    populationAuthzMode,
    populationDisclosureFa,
    truncated: refs.truncated === true,
  };
}

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

async function actorPermissionFingerprint(accountId: string, scopeCodes: readonly string[]): Promise<string> {
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
  return computeContentFingerprint({ permissions: [...perms].sort(), scopeCodes: [...new Set(scopeCodes)].sort() });
}

function emptyResult(
  partial: Partial<PersonnelEventSearchResult> &
    Pick<PersonnelEventSearchResult, "page" | "pageSize" | "populationAuthzMode">,
): PersonnelEventSearchResult {
  return {
    outcome: "denied",
    rows: [],
    populationDisclosureFa: null,
    truncated: false,
    evaluationSnapshotId: null,
    totalInSnapshot: null,
    ...partial,
  };
}

function memberKey(source: "event" | "draft", id: string): string {
  return `${source}:${id}`;
}

function parseMemberKey(
  key: string,
): { source: "event" | "draft"; rawId: string } | null {
  if (key.startsWith("event:")) {
    return { source: "event", rawId: key.slice("event:".length) };
  }
  if (key.startsWith("draft:")) {
    return { source: "draft", rawId: key.slice("draft:".length) };
  }
  return null;
}

function compareCatalogueMembers(a: CatalogueMember, b: CatalogueMember): number {
  if (a.effectiveDate !== b.effectiveDate) {
    return a.effectiveDate < b.effectiveDate ? 1 : -1;
  }
  if (a.sortRegisteredAt !== b.sortRegisteredAt) {
    return a.sortRegisteredAt < b.sortRegisteredAt ? 1 : -1;
  }
  if (a.eventType !== b.eventType) {
    return a.eventType < b.eventType ? -1 : 1;
  }
  if (a.rawId !== b.rawId) {
    return a.rawId < b.rawId ? 1 : -1;
  }
  return 0;
}

function personLabelFrom(
  person: { givenName: string; familyName: string; personnelCode: string } | undefined,
): { personLabel: string; personnelCode: string | null } {
  if (!person) {
    return { personLabel: "فرد نامشخص", personnelCode: null };
  }
  const name = `${person.givenName} ${person.familyName}`.trim();
  return {
    personLabel: name || person.personnelCode || "فرد نامشخص",
    personnelCode: person.personnelCode || null,
  };
}

async function hydrateRows(
  members: CatalogueMember[],
): Promise<PersonnelEventListRowDto[]> {
  const personIds = [...new Set(members.map((m) => m.personId))];
  const people = await getPersonsByIds(personIds);
  const byId = new Map(people.map((p) => [p.id, p]));
  return members.map((m) => {
    const { personLabel, personnelCode } = personLabelFrom(
      byId.get(m.personId),
    );
    return {
      id: m.rawId,
      personId: m.personId,
      personLabel,
      personnelCode,
      eventType: m.eventType,
      eventTypeLabelFa: eventTypeLabelFa(m.eventType),
      effectiveDate: m.effectiveDate,
      resolvedStatus: m.resolvedStatus,
      source: m.source,
    };
  });
}

async function buildCatalogueMembers(input: {
  personIds: string[];
  eventTypes?: string[];
  statuses?: ResolvedLifecycleStatus[];
  effectiveFrom?: string;
  effectiveTo?: string;
  pool: Pool;
}): Promise<{ members: CatalogueMember[]; truncated: boolean }> {
  const asOf = todayDateOnlyTehran();
  const statusFilter =
    input.statuses && input.statuses.length > 0
      ? new Set(input.statuses)
      : null;
  const includeDrafts = !statusFilter || statusFilter.has("Draft");

  const { rows: events, truncated: eventsTruncated } =
    await listBusinessEventsForPersons(input.pool, input.personIds, {
      eventTypes: input.eventTypes,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      limit: BUSINESS_EVENTS_UI_LIST_LIMIT_MAX,
    });

  const linksByTarget = await listChainLinksForEvents(
    input.pool,
    events.map((e) => e.id),
  );

  const eventMembers: CatalogueMember[] = [];
  for (const event of events) {
    const links = linksByTarget.get(event.id) ?? {
      cancellations: [],
      reversals: [],
      corrections: [],
    };
    const resolvedStatus = resolveLifecycleStatus(event, links, asOf);
    if (statusFilter && !statusFilter.has(resolvedStatus)) continue;
    eventMembers.push({
      memberKey: memberKey("event", event.id),
      source: "event",
      rawId: event.id,
      personId: event.personId,
      eventType: event.eventType,
      effectiveDate: event.effectiveDate,
      sortRegisteredAt: event.registeredAt.getTime(),
      resolvedStatus,
    });
  }

  let draftsTruncated = false;
  const draftMembers: CatalogueMember[] = [];
  if (includeDrafts) {
    let drafts = await listOpenDraftsForPersons(input.personIds, {
      take: BUSINESS_EVENTS_UI_LIST_LIMIT_MAX + 1,
    });
    if (drafts.length > BUSINESS_EVENTS_UI_LIST_LIMIT_MAX) {
      draftsTruncated = true;
      drafts = drafts.slice(0, BUSINESS_EVENTS_UI_LIST_LIMIT_MAX);
    }
    if (input.eventTypes && input.eventTypes.length > 0) {
      const types = new Set(
        input.eventTypes.map((t) => t.trim()).filter((t) => t.length > 0),
      );
      drafts =
        types.size === 0 ? [] : drafts.filter((d) => types.has(d.eventType));
    }
    if (input.effectiveFrom) {
      drafts = drafts.filter((d) => d.effectiveDate >= input.effectiveFrom!);
    }
    if (input.effectiveTo) {
      drafts = drafts.filter((d) => d.effectiveDate <= input.effectiveTo!);
    }
    for (const draft of drafts) {
      draftMembers.push({
        memberKey: memberKey("draft", draft.id),
        source: "draft",
        rawId: draft.id,
        personId: draft.personId,
        eventType: draft.eventType,
        effectiveDate: draft.effectiveDate,
        sortRegisteredAt: draft.updatedAt.getTime(),
        resolvedStatus: "Draft",
      });
    }
  }

  const members = [...eventMembers, ...draftMembers].sort(compareCatalogueMembers);
  return {
    members,
    truncated: eventsTruncated || draftsTruncated,
  };
}

async function hydrateFromMemberKeys(
  keys: string[],
  pool: Pool,
): Promise<PersonnelEventListRowDto[]> {
  const parsed = keys
    .map((k) => {
      const p = parseMemberKey(k);
      return p ? { key: k, ...p } : null;
    })
    .filter((p): p is { key: string; source: "event" | "draft"; rawId: string } =>
      Boolean(p),
    );

  const eventIds = parsed.filter((p) => p.source === "event").map((p) => p.rawId);
  const draftIds = parsed.filter((p) => p.source === "draft").map((p) => p.rawId);

  const [events, drafts] = await Promise.all([
    listBusinessEventsByIds(pool, eventIds),
    listDraftsByIds(draftIds),
  ]);
  const eventById = new Map(events.map((e) => [e.id, e]));
  const draftById = new Map(drafts.map((d) => [d.id, d]));

  const asOf = todayDateOnlyTehran();
  const linksByTarget =
    eventIds.length > 0
      ? await listChainLinksForEvents(pool, eventIds)
      : new Map();

  const members: CatalogueMember[] = [];
  for (const p of parsed) {
    if (p.source === "event") {
      const event = eventById.get(p.rawId);
      if (!event) continue;
      const links = linksByTarget.get(event.id) ?? {
        cancellations: [],
        reversals: [],
        corrections: [],
      };
      members.push({
        memberKey: p.key,
        source: "event",
        rawId: event.id,
        personId: event.personId,
        eventType: event.eventType,
        effectiveDate: event.effectiveDate,
        sortRegisteredAt: event.registeredAt.getTime(),
        resolvedStatus: resolveLifecycleStatus(event, links, asOf),
      });
    } else {
      const draft = draftById.get(p.rawId);
      if (!draft) continue;
      // Skip non-open drafts on continuation (deleted/finalized → REF_CHANGED).
      if (draft.status !== "open" && draft.status !== "pending_review") continue;
      members.push({
        memberKey: p.key,
        source: "draft",
        rawId: draft.id,
        personId: draft.personId,
        eventType: draft.eventType,
        effectiveDate: draft.effectiveDate,
        sortRegisteredAt: draft.updatedAt.getTime(),
        resolvedStatus: "Draft",
      });
    }
  }

  if (members.length !== keys.length) {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_REF_CHANGED",
      MSG_EVAL_SNAPSHOT_REF_CHANGED_FA,
    );
  }

  // Preserve frozen membership order.
  const byKey = new Map(members.map((m) => [m.memberKey, m]));
  const ordered = keys
    .map((k) => byKey.get(k))
    .filter((m): m is CatalogueMember => Boolean(m));
  return hydrateRows(ordered);
}

/**
 * Org-wide permission-safe event catalogue with stable-snapshot pagination.
 */
export async function runPersonnelEventSearch(
  input: RunPersonnelEventSearchInput,
): Promise<PersonnelEventSearchResult> {
  await assertActorHasPersonnelEventDraft(input.actorAccountId);

  const { page, pageSize } = resolvePageParams(input);
  const filterFingerprintInput = {
    eventTypes: input.eventTypes,
    statuses: input.statuses,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    teamId: input.teamId,
    personId: input.personId,
    pageSize,
  };

  if (input.actorScopeCodes.length === 0) {
    return emptyResult({
      outcome: "denied",
      populationAuthzMode: "fixture-fail-closed",
      page,
      pageSize,
      messageFa: operationalCopy.accessDeniedTitle,
    });
  }

  const eventDb = getEventPool();
  if (!eventDb) {
    return emptyResult({
      outcome: "denied",
      populationAuthzMode: "fixture-fail-closed",
      page,
      pageSize,
      messageFa: operationalCopy.accessDeniedTitle,
    });
  }

  // Continuation / refresh with token
  if (page > 1 || input.evaluationSnapshotId) {
    if (!input.evaluationSnapshotId) {
      return emptyResult({
        outcome: "denied",
        populationAuthzMode: "fixture-fail-closed",
        page,
        pageSize,
        messageFa: MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
      });
    }
    if (!EVAL_SNAPSHOT_UUID_RE.test(input.evaluationSnapshotId)) {
      return emptyResult({
        outcome: "denied",
        populationAuthzMode: "fixture-fail-closed",
        page,
        pageSize,
        messageFa: MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
      });
    }
    try {
      const snapshot = await getEvaluationSnapshot(
        eventDb,
        input.evaluationSnapshotId,
      );
      if (snapshot.attribution.actorAccountId !== input.actorAccountId) {
        throw new EvaluationSnapshotError(
          "EVAL_SNAPSHOT_NOT_FOUND",
          MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
        );
      }
      assertPaginationTokenMatches(snapshot, filterFingerprintInput);

      const livePermFp = await actorPermissionFingerprint(input.actorAccountId, input.actorScopeCodes);
      const permCheck = await revalidateEvaluationSnapshot(eventDb, snapshot, {
        permissionFingerprint: livePermFp,
      });
      if (!("ok" in permCheck)) {
        throwEvaluationSnapshotConflict(permCheck);
      }

      const memberIds = paginationMemberIds(snapshot);
      const start = (page - 1) * pageSize;
      const pageKeys = memberIds.slice(start, start + pageSize);
      const rows = await hydrateFromMemberKeys(pageKeys, eventDb);
      const honesty = paginationHonestyFromBoundRefs(snapshot);

      return {
        outcome:
          memberIds.length === 0 || pageKeys.length > 0 ? "allowed" : "empty",
        rows,
        populationAuthzMode: honesty.populationAuthzMode,
        populationDisclosureFa: honesty.populationDisclosureFa,
        truncated: honesty.truncated,
        evaluationSnapshotId: snapshot.id,
        page,
        pageSize,
        totalInSnapshot: memberIds.length,
      };
    } catch (err) {
      if (err instanceof EvaluationSnapshotError) {
        return emptyResult({
          outcome: "denied",
          populationAuthzMode: "fixture-fail-closed",
          page,
          pageSize,
          messageFa: err.messageFa,
        });
      }
      if (isMissingEvaluationSnapshotRelation(err)) {
        return emptyResult({
          outcome: "denied",
          populationAuthzMode: "fixture-fail-closed",
          page,
          pageSize,
          messageFa: MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
        });
      }
      throw err;
    }
  }

  // Page 1 — mint snapshot
  const {
    registry,
    mode,
    disclosureFa,
  } = await resolvePersonnelPopulationRegistry();

  const {
    registry: inferenceRegistry,
    demoBulkApproval,
    inferenceCapped,
  } = applyDevUuidInferenceBulkGuard(registry, mode);

  const retrieval = await runGovernedRetrieval({
    actorAccountId: input.actorAccountId,
    actorScopeCodes: input.actorScopeCodes,
    channel: "list",
    asOfDate: currentAsOfDate(),
    dataCategory: PERSONNEL_EVENT_DATA_CATEGORY,
    correlationId: input.correlationId,
    purpose: "personnel_event.list",
    organizationalScope: input.actorScopeCodes[0],
    populationRegistry: inferenceRegistry,
    demoBulkApproval,
  });

  const { payload } = retrieval;
  if (payload.outcome === "suppressed") {
    return emptyResult({
      outcome: "suppressed",
      populationAuthzMode: mode,
      populationDisclosureFa: disclosureFa,
      page,
      pageSize,
      messageFa: payload.messageFa || operationalCopy.suppressedCohort,
      truncated: inferenceCapped,
    });
  }
  if (payload.outcome === "require_bulk_approval") {
    return emptyResult({
      outcome: "denied",
      populationAuthzMode: mode,
      populationDisclosureFa: disclosureFa,
      page,
      pageSize,
      messageFa:
        payload.messageFa ||
        "برای فهرست با حجم بالاتر، تأیید بازیابی انبوه لازم است.",
      truncated: inferenceCapped,
    });
  }
  if (payload.outcome !== "allowed" && payload.outcome !== "empty") {
    return emptyResult({
      outcome: "denied",
      populationAuthzMode: mode,
      populationDisclosureFa: disclosureFa,
      page,
      pageSize,
      messageFa: payload.messageFa || operationalCopy.accessDeniedTitle,
      truncated: inferenceCapped,
    });
  }

  let personIds =
    payload.outcome === "allowed" || payload.outcome === "empty"
      ? [...retrieval.subjectIds]
      : [];

  // Person filter: intersect with scoped population (IDOR → empty, not leak)
  const personFilter = input.personId?.trim();
  if (personFilter) {
    if (!personIds.includes(personFilter)) {
      personIds = [];
    } else {
      personIds = [personFilter];
    }
  }

  // Team filter: Primary/membership as-of today ∩ population
  const teamFilter = input.teamId?.trim();
  if (teamFilter && personIds.length > 0) {
    try {
      const onTeam = await listTeamMembersAsOf(
        teamFilter,
        todayDateOnlyTehran(),
        { includeManager: true },
      );
      const teamSet = new Set(onTeam);
      personIds = personIds.filter((id) => teamSet.has(id));
    } catch (err) {
      // Invalid / unknown team → empty (fail closed, no leak). Infra errors propagate.
      if (err instanceof ManagementRelationshipError) {
        personIds = [];
      } else {
        throw err;
      }
    }
  }

  if (personIds.length === 0) {
    // Mint empty snapshot so page controls stay consistent when filters yield empty.
    try {
      const permissionFingerprint = await actorPermissionFingerprint(input.actorAccountId, input.actorScopeCodes);
      const snap = await beginEvaluationSnapshot(eventDb, {
        kind: "pagination",
        payload: paginationPayload(filterFingerprintInput),
        attribution: {
          actorAccountId: input.actorAccountId,
          permissionFingerprint,
        },
        correlationId: input.correlationId,
        boundRefs: catalogueBoundRefs({
          memberIds: [],
          truncated: inferenceCapped,
          populationAuthzMode: mode,
          populationDisclosureFa: disclosureFa,
        }),
        expiresAt: new Date(Date.now() + PAGINATION_TTL_MS).toISOString(),
      });
      return {
        outcome: "empty",
        rows: [],
        populationAuthzMode: mode,
        populationDisclosureFa: disclosureFa,
        truncated: inferenceCapped,
        evaluationSnapshotId: snap.id,
        page,
        pageSize,
        totalInSnapshot: 0,
        messageFa:
          mode === "fixture-fail-closed"
            ? disclosureFa || operationalCopy.personnelPopulationFixtureEmpty
            : undefined,
      };
    } catch (err) {
      if (isMissingEvaluationSnapshotRelation(err)) {
        return {
          outcome: "empty",
          rows: [],
          populationAuthzMode: mode,
          populationDisclosureFa: disclosureFa,
          truncated: inferenceCapped,
          evaluationSnapshotId: null,
          page,
          pageSize,
          totalInSnapshot: 0,
          messageFa: MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
        };
      }
      if (err instanceof EvaluationSnapshotError) {
        return emptyResult({
          outcome: "denied",
          populationAuthzMode: mode,
          populationDisclosureFa: disclosureFa,
          page,
          pageSize,
          messageFa: err.messageFa,
        });
      }
      throw err;
    }
  }

  const { members, truncated: catalogueTruncated } = await buildCatalogueMembers({
    personIds,
    eventTypes: input.eventTypes,
    statuses: input.statuses,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    pool: eventDb,
  });

  let evaluationSnapshotId: string;
  try {
    const permissionFingerprint = await actorPermissionFingerprint(input.actorAccountId, input.actorScopeCodes);
    const snap = await beginEvaluationSnapshot(eventDb, {
      kind: "pagination",
      payload: paginationPayload(filterFingerprintInput),
      attribution: {
        actorAccountId: input.actorAccountId,
        permissionFingerprint,
      },
      correlationId: input.correlationId,
      boundRefs: catalogueBoundRefs({
        memberIds: members.map((m) => m.memberKey),
        truncated: catalogueTruncated || inferenceCapped,
        populationAuthzMode: mode,
        populationDisclosureFa: disclosureFa,
      }),
      expiresAt: new Date(Date.now() + PAGINATION_TTL_MS).toISOString(),
    });
    evaluationSnapshotId = snap.id;
  } catch (err) {
    if (isMissingEvaluationSnapshotRelation(err)) {
      return emptyResult({
        outcome: "denied",
        populationAuthzMode: mode,
        populationDisclosureFa: disclosureFa,
        page,
        pageSize,
        messageFa: MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
      });
    }
    if (err instanceof EvaluationSnapshotError) {
      return emptyResult({
        outcome: "denied",
        populationAuthzMode: mode,
        populationDisclosureFa: disclosureFa,
        page,
        pageSize,
        messageFa: err.messageFa,
      });
    }
    throw err;
  }

  const pageMembers = members.slice(0, pageSize);
  const rows = await hydrateRows(pageMembers);

  return {
    outcome: members.length === 0 ? "empty" : "allowed",
    rows,
    populationAuthzMode: mode,
    populationDisclosureFa: disclosureFa,
    truncated: catalogueTruncated || inferenceCapped,
    evaluationSnapshotId,
    page,
    pageSize,
    totalInSnapshot: members.length,
    messageFa:
      members.length === 0 && mode === "fixture-fail-closed"
        ? disclosureFa || operationalCopy.personnelPopulationFixtureEmpty
        : undefined,
  };
}

/** Status enum re-export for router input zod. */
export type { BusinessEventStatus };
