/**
 * Scoped personnel search helpers + PopulationPort honesty (Story 5.1).
 * Run: pnpm --filter @divan/web selfcheck:personnel-search
 *
 * Scope-denial oracle uses an injected UUID registry — does not require DB.
 */
import assert from "node:assert/strict";

import type { PopulationFixtureRegistry } from "@divan/identity-access";
import { intersectPopulation } from "@divan/identity-access";
import { isPersonUuid } from "@divan/person-employment";

import {
  POPULATION_FIXTURE_DISCLOSURE_FA,
  emptyFailClosedPopulationRegistry,
  registryUsesFixtureSubjects,
} from "./personnel-scoped-search-helpers";

const IN_SCOPE = "11111111-1111-4111-8111-111111111111";
const OUT_SCOPE = "22222222-2222-4222-8222-222222222222";

assert.equal(isPersonUuid("person:a1"), false);
assert.equal(isPersonUuid(IN_SCOPE), true);

const fixtureLike: PopulationFixtureRegistry = {
  subjects: [
    { id: "person:a1", scopeCodes: ["org:selfcheck"] },
    { id: "person:a2", scopeCodes: ["org:selfcheck"] },
  ],
  relationships: [],
  crossTimeGrants: [],
  facts: [],
};
assert.equal(registryUsesFixtureSubjects(fixtureLike), true);

const uuidRegistry: PopulationFixtureRegistry = {
  subjects: [
    { id: IN_SCOPE, scopeCodes: ["org:team-a"] },
    { id: OUT_SCOPE, scopeCodes: ["org:team-b"] },
  ],
  relationships: [],
  crossTimeGrants: [],
  facts: [],
};
assert.equal(registryUsesFixtureSubjects(uuidRegistry), false);

/** Fail-closed empty registry has no subjects. */
const empty = emptyFailClosedPopulationRegistry();
assert.equal(empty.subjects.length, 0);
assert.equal(registryUsesFixtureSubjects(empty), true);

/** Scope-denial oracle: actor with org:team-a must not see OUT_SCOPE subject. */
const scoped = intersectPopulation(
  {
    actorAccountId: "account:hr-op",
    actorScopeCodes: ["org:team-a"],
    asOfDate: "2026-07-24",
    channel: "list",
  },
  uuidRegistry,
);
assert.equal(scoped.ok, true);
if (scoped.ok) {
  assert.ok(scoped.subjectIds.includes(IN_SCOPE));
  assert.equal(scoped.subjectIds.includes(OUT_SCOPE), false);
}

/** Fail-closed empty ∩ any actor → empty subject set (no stamp-all IDOR). */
const failClosed = intersectPopulation(
  {
    actorAccountId: "account:hr-op",
    actorScopeCodes: ["org:team-a"],
    asOfDate: "2026-07-24",
    channel: "list",
  },
  empty,
);
assert.equal(failClosed.ok, true);
if (failClosed.ok) {
  assert.equal(failClosed.subjectIds.length, 0);
}

assert.ok(POPULATION_FIXTURE_DISCLOSURE_FA.includes("fixture"));
assert.ok(POPULATION_FIXTURE_DISCLOSURE_FA.includes("fail-closed"));
assert.ok(
  !POPULATION_FIXTURE_DISCLOSURE_FA.toLowerCase().includes(
    "production workforce authz",
  ),
);

console.log("personnel-search selfcheck: ok");
