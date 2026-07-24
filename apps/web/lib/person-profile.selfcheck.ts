/**
 * Person profile omit / prior / Scheduled≠current contracts (Story 5.2).
 * Run: pnpm --filter @divan/web selfcheck:personnel-profile
 */
import assert from "node:assert/strict";

import type {
  CurrentPersonState,
  EnabledProfileField,
  EmploymentRecord,
} from "@divan/person-employment";

import {
  dictionaryFieldMeta,
  displayNameFromIdentityRows,
  filterPriorEmployments,
  presentIdentityFieldRows,
  scheduledChangesAreSeparateFromCurrent,
  stateHasCompensationCategory,
} from "./person-profile-mapper";

const PERSON_ID = "550e8400-e29b-41d4-a716-446655440000";
const AS_OF = "2026-07-24";

const enabledFields: EnabledProfileField[] = [
  {
    elementId: "person.given_name",
    personFieldKey: "givenName",
    labelFa: "نام",
    categoryId: "identity.ordinary",
    format: "text",
    sensitivity: "ordinary",
  },
  {
    elementId: "person.family_name",
    personFieldKey: "familyName",
    labelFa: "نام خانوادگی",
    categoryId: "identity.ordinary",
    format: "text",
    sensitivity: "ordinary",
  },
  {
    elementId: "person.national_id",
    personFieldKey: "nationalId",
    labelFa: "کد ملی",
    categoryId: "identity.national_id",
    format: "text",
    sensitivity: "high",
  },
];

const baseState = {
  ok: true as const,
  asOf: AS_OF,
  personId: PERSON_ID,
  viewSemantics: "current" as const,
  baselineDisclosure: {
    configured: false,
    boundaryDate: null,
    limited: false,
    messageFa: "",
  },
  person: {
    id: PERSON_ID,
    personnelCode: "10001",
    givenName: "علی",
    familyName: "محمدی",
    mobilePhone: "09121234501",
  },
  employment: {
    id: "emp-current",
    personId: PERSON_ID,
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
  scheduledChanges: [
    {
      id: "evt-sched-1",
      eventType: "TeamTransfer",
      effectiveDate: "2026-08-01",
      resolvedStatus: "Scheduled" as const,
    },
  ],
  plannedChangesThroughAsOf: [],
} satisfies CurrentPersonState;

/** Key-absence / null facts: category helper is false. */
assert.equal(stateHasCompensationCategory(baseState), false);
assert.equal(
  stateHasCompensationCategory({
    ...baseState,
    compensation: { amount: "1000" },
  }),
  true,
);
assert.equal(
  stateHasCompensationCategory({
    ...baseState,
    compensation: null,
  }),
  false,
);
assert.equal(
  stateHasCompensationCategory({
    ...baseState,
    contractual: { contractingEntity: "شرکت نمونه" },
  }),
  true,
);

/** DOM-omit identity: nationalId absent from person ⇒ no row even if enabled. */
const identityRows = presentIdentityFieldRows(baseState.person, enabledFields);
assert.equal(identityRows.length, 2);
assert.equal(
  identityRows.some((r) => r.personFieldKey === "nationalId"),
  false,
);
assert.equal(identityRows[0]?.personFieldKey, "givenName");
assert.equal(identityRows[1]?.personFieldKey, "familyName");
assert.equal(displayNameFromIdentityRows(identityRows), "علی محمدی");

/** Disabled familyName ⇒ header must not invent full name from raw person. */
const onlyGiven: EnabledProfileField[] = [enabledFields[0]!];
const gated = presentIdentityFieldRows(
  {
    ...baseState.person,
    nationalId: "0012345678",
    fatherName: "حسن",
  },
  onlyGiven,
);
assert.equal(gated.length, 1);
assert.equal(gated[0]?.personFieldKey, "givenName");
assert.equal(displayNameFromIdentityRows(gated), "علی");
assert.equal(
  gated.some((r) => r.personFieldKey === "nationalId"),
  false,
);
assert.equal(
  gated.some((r) => r.personFieldKey === "fatherName"),
  false,
);

/** Dictionary meta for compensation sensitivity / labels. */
const amountMeta = dictionaryFieldMeta(
  [
    {
      elementId: "compensation.amount",
      disposition: "approve",
      enabled: true,
      labelFa: "مبلغ جبران",
      sensitivity: "sensitive",
    },
  ],
  "compensation.amount",
  "مبلغ",
);
assert.equal(amountMeta.labelFa, "مبلغ جبران");
assert.equal(amountMeta.sensitivity, "sensitive");

/** Prior = ended on/before asOf; open + future-end excluded. */
const employments: EmploymentRecord[] = [
  {
    id: "emp-old",
    personId: PERSON_ID,
    startDate: "2020-01-01",
    endDateExclusive: "2024-01-01",
    collaborationType: "پیمانکار",
    terminationReason: "پایان قرارداد",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "emp-future-end",
    personId: PERSON_ID,
    startDate: "2024-01-01",
    endDateExclusive: "2027-01-01",
    collaborationType: "کارمند",
    terminationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "emp-current",
    personId: PERSON_ID,
    startDate: "2024-01-01",
    endDateExclusive: null,
    collaborationType: "کارمند",
    terminationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
const prior = filterPriorEmployments(employments, AS_OF);
assert.equal(prior.length, 1);
assert.equal(prior[0]?.id, "emp-old");
assert.equal(prior[0]?.endDateExclusive, "2024-01-01");

/** Scheduled ≠ current: futures stay Scheduled and do not reuse employment id. */
assert.equal(scheduledChangesAreSeparateFromCurrent(baseState), true);
assert.equal(
  scheduledChangesAreSeparateFromCurrent({
    ...baseState,
    scheduledChanges: [
      {
        id: "emp-current",
        eventType: "Start",
        effectiveDate: "2026-09-01",
        resolvedStatus: "Scheduled",
      },
    ],
  }),
  false,
);

console.log("personnel-profile selfcheck: ok");
