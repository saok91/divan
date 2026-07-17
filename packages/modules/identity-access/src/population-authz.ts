/**
 * PopulationPort — temporal + cross-boundary intersection (Story 2.6 / FR-47).
 *
 * Fixture-backed until Epic 3/4 Person / Assignment projections exist.
 * Story 3.1 cutover target: subject id = Person UUID (`Person.id`).
 * Fixture ids (`person:a1`, …) remain until Account↔Person (AR-IDENTITY) /
 * event-backed wiring (4.x). Story 3.9 delivers Person-centric derive APIs +
 * `buildManagementRelationshipsFromDerivation` adapter — default registry is
 * still fixture-backed (honest cutover). See person-employment
 * `population-cutover.ts` and deferred-work.md. Do not invent a parallel
 * population checker.
 * Callers: after envelope allow (or as part of authorize path for demos).
 * Empty intersection → safe empty / omit — never invent out-of-scope rows.
 *
 * Story 2.7: after intersect, callers MUST run InferenceBulkPort
 * (`evaluateInferenceBulk` in `@divan/audit-envelope`) before returning
 * counts/lists/exports — cohort size is on the authorized set only.
 *
 * Management-derived default: only facts inside the authorized relationship
 * interval. Pre-scope (current manager) and post-scope (former manager)
 * require an active cross_time_scope grant — never silent widen.
 *
 * Demo identity space: subjects also carry `org:selfcheck` so seeded sessions
 * get a non-empty intersection; `org:fixture-a|b` remain for A∩B selfchecks.
 */

import {
  dateOnlyInInterval,
  parseDateOnly,
  todayDateOnlyTehran,
} from "@divan/temporal-engine";

export type RetrievalChannel =
  | "profile"
  | "timeline"
  | "search"
  | "list"
  | "count"
  | "dashboard"
  | "report"
  | "export"
  | "audit";

export type PopulationSubject = {
  id: string;
  /** Scope codes this subject belongs to (fixture). */
  scopeCodes: string[];
};

export type ManagementRelationship = {
  managerAccountId: string;
  subjectId: string;
  /** Inclusive start YYYY-MM-DD. */
  validFrom: string;
  /** Exclusive end YYYY-MM-DD; null = still current. */
  validToExclusive: string | null;
};

export type CrossTimeGrantFixture = {
  /** Lifecycle grant id when registered from activate; omit for static demos. */
  grantId?: string;
  accountId: string;
  purpose: string;
  category: string;
  /** Inclusive start. */
  validFrom: string;
  /** Exclusive end. */
  validToExclusive: string;
  /** Subject ids covered by this bounded grant. */
  subjectIds: string[];
  active: boolean;
};

export type PopulationFact = {
  subjectId: string;
  /** Fact validity date (date-only). */
  asOf: string;
  kind: string;
};

export type PopulationPortInput = {
  actorAccountId: string;
  actorScopeCodes: string[];
  /** Evaluation date — current mode uses today Tehran. */
  asOfDate: string;
  channel: RetrievalChannel;
  /** Optional object/subject id filters (drill-down / profile). */
  objectIds?: string[];
  /**
   * When set, intersect against these facts (timeline). Otherwise use
   * subject membership only.
   */
  facts?: PopulationFact[];
  /**
   * When set, cross-time grants must match this category (purpose/category bound).
   */
  dataCategory?: string;
  /**
   * Unreconciled / stale membership flag — fail closed when true.
   */
  unreconciled?: boolean;
  /**
   * Missing port dependency simulation — fail closed when true.
   */
  portUnavailable?: boolean;
};

export type PopulationPortDeny = {
  ok: false;
  reason: string;
};

export type PopulationPortAllow = {
  ok: true;
  /** Authorized subject ids — intersection only. */
  subjectIds: string[];
  /** When facts were requested, authorized fact keys (subjectId|asOf|kind). */
  factKeys: string[];
};

export type PopulationPortResult = PopulationPortAllow | PopulationPortDeny;

export type PopulationFixtureRegistry = {
  subjects: PopulationSubject[];
  relationships: ManagementRelationship[];
  crossTimeGrants: CrossTimeGrantFixture[];
  facts: PopulationFact[];
};

/**
 * Demo fixture population — proves FR-47 without Person tables.
 * Scope A ∩ B subjects; management intervals; cross-time grants.
 */
export const DEMO_POPULATION_FIXTURES: PopulationFixtureRegistry = {
  subjects: [
    { id: "person:a1", scopeCodes: ["org:fixture-a", "org:selfcheck"] },
    { id: "person:a2", scopeCodes: ["org:fixture-a", "org:selfcheck"] },
    { id: "person:b1", scopeCodes: ["org:fixture-b"] },
    {
      id: "person:ab",
      scopeCodes: ["org:fixture-a", "org:fixture-b", "org:selfcheck"],
    },
    { id: "person:mgr-sub", scopeCodes: ["org:fixture-a", "org:selfcheck"] },
  ],
  relationships: [
    {
      // Current manager for person:mgr-sub from 2024-01-01 (open-ended)
      managerAccountId: "account:manager-current",
      subjectId: "person:mgr-sub",
      validFrom: "2024-01-01",
      validToExclusive: null,
    },
    {
      // Former manager — relationship ended 2023-06-01 (exclusive)
      managerAccountId: "account:manager-former",
      subjectId: "person:mgr-sub",
      validFrom: "2020-01-01",
      validToExclusive: "2023-06-01",
    },
  ],
  crossTimeGrants: [
    {
      accountId: "account:manager-current",
      purpose: "pre_scope_history_review",
      category: "demo.non_hr",
      validFrom: "2023-01-01",
      validToExclusive: "2024-01-01",
      subjectIds: ["person:mgr-sub"],
      active: true,
    },
    {
      accountId: "account:manager-former",
      purpose: "post_scope_audit_slice",
      category: "demo.non_hr",
      validFrom: "2023-06-01",
      validToExclusive: "2023-12-01",
      subjectIds: ["person:mgr-sub"],
      active: true,
    },
  ],
  facts: [
    { subjectId: "person:mgr-sub", asOf: "2023-03-15", kind: "assignment" },
    { subjectId: "person:mgr-sub", asOf: "2024-06-01", kind: "assignment" },
    { subjectId: "person:mgr-sub", asOf: "2023-09-01", kind: "assignment" },
  ],
};

function cloneRegistry(
  registry: PopulationFixtureRegistry,
): PopulationFixtureRegistry {
  return {
    subjects: registry.subjects.map((s) => ({
      ...s,
      scopeCodes: [...s.scopeCodes],
    })),
    relationships: registry.relationships.map((r) => ({ ...r })),
    crossTimeGrants: registry.crossTimeGrants.map((g) => ({
      ...g,
      subjectIds: [...g.subjectIds],
    })),
    facts: registry.facts.map((f) => ({ ...f })),
  };
}

let activeRegistry: PopulationFixtureRegistry = cloneRegistry(
  DEMO_POPULATION_FIXTURES,
);
let portEnabled = true;

export function getPopulationFixtureRegistry(): PopulationFixtureRegistry {
  return activeRegistry;
}

/** Test/selfcheck hook. Pass null to restore demo fixtures. */
export function setPopulationFixtureRegistryForTests(
  registry: PopulationFixtureRegistry | null,
): void {
  activeRegistry = registry
    ? cloneRegistry(registry)
    : cloneRegistry(DEMO_POPULATION_FIXTURES);
}

export function setPopulationPortEnabledForTests(enabled: boolean): void {
  portEnabled = enabled;
}

/**
 * Register or replace a lifecycle-activated cross_time_scope grant in the
 * fixture registry (Story 2.6 decision: activate → PopulationPort).
 */
export function upsertCrossTimeGrantFixture(grant: CrossTimeGrantFixture): void {
  if (!grant.purpose.trim() || !grant.category.trim()) {
    return;
  }
  const without = activeRegistry.crossTimeGrants.filter((g) =>
    grant.grantId ? g.grantId !== grant.grantId : g !== grant,
  );
  activeRegistry = {
    ...activeRegistry,
    crossTimeGrants: [...without, { ...grant, active: true }],
  };
}

/** Remove a lifecycle-registered cross_time grant (revoke/expire/suspend). */
export function removeCrossTimeGrantFixture(grantId: string): void {
  activeRegistry = {
    ...activeRegistry,
    crossTimeGrants: activeRegistry.crossTimeGrants.filter(
      (g) => g.grantId !== grantId,
    ),
  };
}

function factKey(f: PopulationFact): string {
  return `${f.subjectId}|${f.asOf}|${f.kind}`;
}

function subjectInActorScopes(
  subject: PopulationSubject,
  actorScopeCodes: string[],
): boolean {
  return subject.scopeCodes.some((c) => actorScopeCodes.includes(c));
}

function activeCrossTimeFor(
  accountId: string,
  subjectId: string,
  asOfDate: string,
  registry: PopulationFixtureRegistry,
  dataCategory?: string,
): boolean {
  return registry.crossTimeGrants.some((g) => {
    if (!g.active || g.accountId !== accountId) return false;
    if (!g.purpose.trim() || !g.category.trim()) return false;
    if (dataCategory && g.category !== dataCategory) return false;
    if (!g.subjectIds.includes(subjectId)) return false;
    return dateOnlyInInterval(asOfDate, g.validFrom, g.validToExclusive);
  });
}

function managementCovers(
  accountId: string,
  subjectId: string,
  asOfDate: string,
  registry: PopulationFixtureRegistry,
): boolean {
  return registry.relationships.some(
    (r) =>
      r.managerAccountId === accountId &&
      r.subjectId === subjectId &&
      dateOnlyInInterval(asOfDate, r.validFrom, r.validToExclusive),
  );
}

function subjectAllowedForManager(
  accountId: string,
  subjectId: string,
  asOfDate: string,
  registry: PopulationFixtureRegistry,
  dataCategory?: string,
): boolean {
  return (
    managementCovers(accountId, subjectId, asOfDate, registry) ||
    activeCrossTimeFor(accountId, subjectId, asOfDate, registry, dataCategory)
  );
}

/**
 * Intersect authorized population for a retrieval channel.
 * Fail-closed on unreconciled / missing port / invalid as-of.
 */
export function intersectPopulation(
  input: PopulationPortInput,
  registry: PopulationFixtureRegistry = activeRegistry,
): PopulationPortResult {
  if (!portEnabled || input.portUnavailable) {
    return { ok: false, reason: "population_port_unavailable" };
  }
  if (input.unreconciled) {
    return { ok: false, reason: "membership_unreconciled" };
  }

  const asOfParsed = parseDateOnly(input.asOfDate);
  if (!asOfParsed.ok) {
    return { ok: false, reason: asOfParsed.reason };
  }
  const asOf = asOfParsed.value;

  if (!input.actorScopeCodes.length) {
    return { ok: false, reason: "scope_membership_missing" };
  }

  const scopedSubjects = registry.subjects.filter((s) =>
    subjectInActorScopes(s, input.actorScopeCodes),
  );

  let candidateIds = new Set(scopedSubjects.map((s) => s.id));

  if (input.objectIds?.length) {
    const wanted = new Set(input.objectIds);
    candidateIds = new Set([...candidateIds].filter((id) => wanted.has(id)));
  }

  // Management-derived: further narrow by relationship interval
  // (or explicit cross-time grant). Non-manager actors keep scope intersection.
  const isManagerActor =
    input.actorAccountId.startsWith("account:manager-") ||
    registry.relationships.some(
      (r) => r.managerAccountId === input.actorAccountId,
    );

  if (isManagerActor) {
    const facts =
      input.facts ??
      (input.channel === "timeline" || input.channel === "profile"
        ? registry.facts.filter((f) => candidateIds.has(f.subjectId))
        : []);

    if (facts.length > 0) {
      const authorizedFacts: PopulationFact[] = [];
      for (const f of facts) {
        if (!candidateIds.has(f.subjectId)) continue;
        if (
          subjectAllowedForManager(
            input.actorAccountId,
            f.subjectId,
            f.asOf,
            registry,
            input.dataCategory,
          )
        ) {
          authorizedFacts.push(f);
        }
      }
      return {
        ok: true,
        subjectIds: [...new Set(authorizedFacts.map((f) => f.subjectId))],
        factKeys: authorizedFacts.map(factKey),
      };
    }

    // All manager channels (including search/count/dashboard/export/audit):
    // subject must be in relationship interval or bounded cross-time grant.
    const allowed: string[] = [];
    for (const id of candidateIds) {
      if (
        subjectAllowedForManager(
          input.actorAccountId,
          id,
          asOf,
          registry,
          input.dataCategory,
        )
      ) {
        allowed.push(id);
      }
    }
    return { ok: true, subjectIds: allowed, factKeys: [] };
  }

  // Non-manager aggregates: intersection of scope membership only.
  return {
    ok: true,
    subjectIds: [...candidateIds],
    factKeys: [],
  };
}

/**
 * Drill-down MUST reuse the same authorized id set as the parent aggregate.
 * Documented choice: recompute identically with the same inputs (deterministic).
 */
export function drillDownPopulation(
  parent: PopulationPortInput,
  objectId: string,
  registry: PopulationFixtureRegistry = activeRegistry,
): PopulationPortResult {
  const parentResult = intersectPopulation(parent, registry);
  if (!parentResult.ok) return parentResult;
  if (!parentResult.subjectIds.includes(objectId)) {
    return { ok: true, subjectIds: [], factKeys: [] };
  }
  return intersectPopulation(
    { ...parent, objectIds: [objectId] },
    registry,
  );
}

/** Convenience: current-mode as-of = today Tehran. */
export function currentAsOfDate(now: Date = new Date()): string {
  return todayDateOnlyTehran(now);
}
