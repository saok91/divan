/**
 * Pure projector selfcheck (Story 5.1).
 * Run: pnpm --filter @divan/person-employment selfcheck:personnel-list-projector
 */
import assert from "node:assert/strict";

import {
  comparePersonnelListRows,
  currentColleagueFromState,
  isPersonUuid,
  projectPersonnelListRow,
  rowMatchesPersonnelQuery,
  type PersonnelListRowDto,
} from "./personnel-list-projector";
import type { CurrentPersonState } from "./current-person-state";

assert.equal(isPersonUuid("person:a1"), false);
assert.equal(isPersonUuid("fixture-001"), false);
assert.equal(
  isPersonUuid("550e8400-e29b-41d4-a716-446655440000"),
  true,
);

const baseState = {
  ok: true as const,
  asOf: "2026-07-24",
  personId: "550e8400-e29b-41d4-a716-446655440000",
  viewSemantics: "current" as const,
  baselineDisclosure: {
    configured: false,
    boundaryDate: null,
    limited: false,
    messageFa: "",
  },
  disposalDisclosure: {
    limited: false,
    disposedFieldKeys: [],
    messageFa: null,
  },
  person: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    personnelCode: "10001",
    givenName: "علی",
    familyName: "محمدی",
    mobilePhone: "09121234501",
  },
  employment: {
    id: "emp-1",
    personId: "550e8400-e29b-41d4-a716-446655440000",
    startDate: "2024-01-01",
    endDateExclusive: null,
    collaborationType: "کارمند",
    terminationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  primaryAssignment: null,
  teamMembership: null,
  secondaryAssignments: [],
  scheduledChanges: [],
  plannedChangesThroughAsOf: [],
} satisfies CurrentPersonState;

assert.equal(currentColleagueFromState(baseState), "yes");
assert.equal(
  currentColleagueFromState({ ...baseState, employment: null }),
  "no",
);

const withoutComp = projectPersonnelListRow(baseState);
assert.equal(withoutComp.compensationPermitted, false);
assert.equal(withoutComp.compensation, "");
assert.equal(withoutComp.contractEndDate, "");
assert.equal(withoutComp.contractParty, "");
assert.equal(withoutComp.currentColleague, "yes");
assert.equal(withoutComp.givenName, "علی");
assert.equal(withoutComp.jobTitle, "—");
assert.equal(withoutComp.disposalLimited, false);
assert.equal(withoutComp.disposalMessageFa, null);

const disposedState = {
  ...baseState,
  disposalDisclosure: {
    limited: true,
    disposedFieldKeys: ["givenName", "mobilePhone"],
    messageFa: "محدود پس از حذف",
  },
  person: {
    ...baseState.person,
    givenName: "نباید-دیده-شود",
    mobilePhone: "09120000000",
  },
};
const disposedRow = projectPersonnelListRow(disposedState);
assert.equal(disposedRow.disposalLimited, true);
assert.equal(disposedRow.disposalMessageFa, "محدود پس از حذف");
assert.equal(disposedRow.givenName, "—");
assert.equal(disposedRow.mobilePhone, undefined);
assert.equal(disposedRow.familyName, "محمدی");

const withComp = projectPersonnelListRow({
  ...baseState,
  compensation: { amount: "10000000" },
  contractual: {
    contractingEntity: "شرکت نمونه",
    contractEndDateExclusive: "2027-01-01",
  },
});
assert.equal(withComp.compensationPermitted, true);
assert.equal(withComp.compensation, "10000000");
assert.equal(withComp.contractParty, "شرکت نمونه");

const labeled = projectPersonnelListRow(
  {
    ...baseState,
    primaryAssignment: {
      id: "pa-1",
      employmentId: "emp-1",
      teamId: "team-1",
      organizationalRoleId: "role-1",
      jobTitleId: "jt-1",
      ladderId: "lad-1",
      gradeId: "gr-1",
      seniorityId: null,
      startDate: "2024-01-01",
      endDateExclusive: null,
      sourceEventId: null,
      headcountApprovalId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  {
    teamNameById: new Map(),
    roleNameById: new Map([["role-1", "نقش الف"]]),
    jobTitleNameById: new Map([["jt-1", "کارشناس"]]),
    ladderNameById: new Map(),
    gradeNameById: new Map(),
  },
);
assert.equal(labeled.role, "نقش الف");
assert.equal(labeled.jobTitle, "کارشناس");
assert.equal(rowMatchesPersonnelQuery(labeled, "کارشناس"), true);
assert.equal(rowMatchesPersonnelQuery(labeled, "نقش"), true);

const a: PersonnelListRowDto = {
  ...withoutComp,
  personnelCode: "10002",
  id: "a",
};
const b: PersonnelListRowDto = {
  ...withoutComp,
  personnelCode: "10001",
  id: "b",
};
assert.ok(comparePersonnelListRows(b, a) < 0);

assert.equal(rowMatchesPersonnelQuery(withoutComp, "محمد"), true);
assert.equal(rowMatchesPersonnelQuery(withoutComp, "99999"), false);
assert.equal(rowMatchesPersonnelQuery(withoutComp, "0912"), true);

console.log("personnel-list-projector selfcheck: ok");
