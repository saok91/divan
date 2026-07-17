/**
 * Compensation facts selfcheck (Story 3.4 / FR-8).
 * Run: pnpm --filter @divan/compensation-facts selfcheck:compensation-facts
 * Requires DATABASE_URL, migrated schema (compensation + EXCLUDE), seeded accounts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEV_DEMO_CATEGORIES,
  evaluateAuthorization,
  loadCategoryRegistry,
  omitUnauthorizedCategories,
} from "@divan/audit-envelope";
import { config as loadEnv } from "dotenv";
import {
  createPerson,
  getPersonById,
  SEED_PERSON_IDENTITY,
} from "@divan/person-employment";

import {
  applyCompensationProjection,
  applyContractualProjection,
  assertAtMostOneActiveAsOf,
  assertValidCompensationInterval,
  closeCompensationProjection,
  COMPENSATION_DATA_CATEGORY,
  COMPENSATION_FIELD_CATEGORY,
  COMPENSATION_MINIMUM_FACTS,
  CompensationError,
  describeCompensationFactsBoundary,
  FACT_KIND,
  getCompensationAsOf,
  getCompensationDb,
  getCompensationFactById,
  listCompensationFactsForPerson,
  MSG_OVERLAPPING_COMPENSATION_FA,
  projectCompensationRecord,
  SEED_COMPENSATION_FACTS,
  seedCompensationFactsFixtures,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getCompensationDb();
  await seedCompensationFactsFixtures(db);

  const boundary = describeCompensationFactsBoundary();
  assert.equal(boundary.category, COMPENSATION_DATA_CATEGORY);
  assert.equal(boundary.schemaOwner, "@divan/compensation-facts");
  assert.equal(boundary.prismaImportAllowedOutsideModule, false);
  assert.equal(boundary.dbSchema, "compensation");

  // Seed: closed + open adjacent for demo Person 10001
  const demo = await db.person.findUnique({
    where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
  });
  assert.ok(demo, "demo person 10001 required");
  const seeded = await listCompensationFactsForPerson(demo.id, undefined, db);
  assert.ok(seeded.length >= 4, "seed ≥4 facts (2 compensation + 2 contractual)");
  const comps = seeded.filter((f) => f.factKind === FACT_KIND.compensation);
  const hist = comps.find(
    (e) =>
      e.startDate === SEED_COMPENSATION_FACTS.historicalStart &&
      e.endDateExclusive === SEED_COMPENSATION_FACTS.historicalEndExclusive,
  );
  const open = comps.find(
    (e) =>
      e.startDate === SEED_COMPENSATION_FACTS.activeStart &&
      e.endDateExclusive === null,
  );
  assert.ok(hist, "historical closed compensation");
  assert.ok(open, "open active compensation");
  assert.equal(
    hist!.endDateExclusive,
    open!.startDate,
    "adjacent half-open: endExclusive of first === start of second",
  );

  // asOf distinguishes current vs historical
  const activeNow = await getCompensationAsOf(demo.id, "2025-06-15", db);
  assert.ok(activeNow);
  assert.equal(activeNow!.id, open!.id);
  assert.equal(activeNow!.amount, SEED_COMPENSATION_FACTS.activeAmount);

  const activeHist = await getCompensationAsOf(demo.id, "2022-06-15", db);
  assert.ok(activeHist);
  assert.equal(activeHist!.id, hist!.id);

  // Outside all intervals → null (not fabricated zeros)
  const outside = await getCompensationAsOf(demo.id, "2019-01-01", db);
  assert.equal(outside, null);

  assertAtMostOneActiveAsOf(comps, "2022-06-15");
  assertAtMostOneActiveAsOf(comps, "2025-06-15");

  // Fresh person for mutation cases
  const suffix = randomUUID().slice(0, 8);
  const person = await createPerson(
    {
      personnelCode: `8${suffix.slice(0, 7)}`,
      givenName: "جبران",
      familyName: "آزمون",
      mobilePhone: "09121113344",
    },
    { accountId: "selfcheck", correlationId: randomUUID() },
    db,
  );

  const first = await applyCompensationProjection(
    {
      personId: person.id,
      startDate: "2021-01-01",
      endDateExclusive: "2023-01-01",
      amount: "1000000",
      currency: "IRR",
      skipDictionaryGate: true,
    },
    db,
  );
  const second = await applyCompensationProjection(
    {
      personId: person.id,
      startDate: "2023-01-01",
      endDateExclusive: null,
      amount: "1200000",
      currency: "IRR",
      skipDictionaryGate: true,
    },
    db,
  );
  assert.equal(first.endDateExclusive, second.startDate);

  // Overlapping rejected (domain)
  await assert.rejects(
    () =>
      applyCompensationProjection(
        {
          personId: person.id,
          startDate: "2022-06-01",
          endDateExclusive: "2022-12-01",
          amount: "1100000",
          skipDictionaryGate: true,
        },
        db,
      ),
    (err: unknown) => {
      assert.ok(err instanceof CompensationError);
      assert.equal(err.code, "OVERLAPPING_COMPENSATION");
      assert.equal(err.messageFa, MSG_OVERLAPPING_COMPENSATION_FA);
      return true;
    },
  );

  // Second open while one open exists
  await assert.rejects(
    () =>
      applyCompensationProjection(
        {
          personId: person.id,
          startDate: "2026-01-01",
          endDateExclusive: null,
          amount: "1300000",
          skipDictionaryGate: true,
        },
        db,
      ),
    (err: unknown) => {
      assert.ok(err instanceof CompensationError);
      assert.equal(err.code, "CONCURRENT_COMPENSATION_FORBIDDEN");
      return true;
    },
  );

  // Dictionary gate: without skip → FIELD_NOT_ENABLED (later elements)
  await assert.rejects(
    () =>
      applyCompensationProjection(
        {
          personId: person.id,
          startDate: "2028-01-01",
          endDateExclusive: "2028-06-01",
          amount: "1400000",
          currency: "IRR",
        },
        db,
      ),
    (err: unknown) => {
      assert.ok(err instanceof CompensationError);
      assert.equal(err.code, "FIELD_NOT_ENABLED");
      return true;
    },
  );

  // Invalid interval
  assert.throws(
    () => assertValidCompensationInterval("2024-01-01", "2024-01-01"),
    (err: unknown) => {
      assert.ok(err instanceof CompensationError);
      assert.equal(err.code, "INVALID_COMPENSATION_INTERVAL");
      return true;
    },
  );

  // close → Person intact
  const closed = await closeCompensationProjection(second.id, "2025-12-31", db);
  assert.equal(closed.endDateExclusive, "2025-12-31");
  const afterClose = await getPersonById(person.id, db);
  assert.ok(afterClose);
  assert.equal(afterClose!.id, person.id);

  // ON DELETE RESTRICT: Person cannot be deleted while compensation rows exist
  await assert.rejects(
    () => db.person.delete({ where: { id: person.id } }),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      assert.ok(
        /P2003|Foreign key|RESTRICT|CompensationFact_personId_fkey/i.test(msg) ||
          (typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: unknown }).code === "P2003"),
        `expected Restrict FK failure, got: ${msg}`,
      );
      return true;
    },
  );
  const stillThere = await getPersonById(person.id, db);
  assert.ok(stillThere, "Person survives failed cascade delete");

  const byId = await getCompensationFactById(closed.id, db);
  assert.ok(byId);
  assert.equal(byId!.endDateExclusive, "2025-12-31");

  // Contractual adjacent OK independently of compensation stream
  const c1 = await applyContractualProjection(
    {
      personId: person.id,
      startDate: "2021-01-01",
      endDateExclusive: "2023-01-01",
      contractType: "fixed_term",
      skipDictionaryGate: true,
    },
    db,
  );
  const c2 = await applyContractualProjection(
    {
      personId: person.id,
      startDate: "2023-01-01",
      endDateExclusive: null,
      contractType: "indefinite",
      skipDictionaryGate: true,
    },
    db,
  );
  assert.equal(c1.endDateExclusive, c2.startDate);

  // No operator mutation product verbs; no payroll helpers
  const pub = await import("./index");
  assert.ok(!("createCompensation" in pub));
  assert.ok(!("changeSalary" in pub));
  assert.ok(!("updateContract" in pub));
  assert.ok(!("calculatePayroll" in pub));
  assert.ok(!("calculateTax" in pub));
  assert.ok(!("calculatePayment" in pub));
  assert.equal(typeof pub.applyCompensationProjection, "function");
  assert.equal(typeof pub.applyContractualProjection, "function");
  assert.equal(typeof pub.closeCompensationProjection, "function");

  assert.ok(COMPENSATION_MINIMUM_FACTS.length >= 5);
  assert.ok(
    COMPENSATION_MINIMUM_FACTS.some((f) => f.ownerStory.startsWith("3.4")),
  );
  assert.ok(
    COMPENSATION_MINIMUM_FACTS.some((f) => f.ownerStory.includes("4.8")),
  );

  // DB EXCLUDE: raw create overlapping must fail
  await assert.rejects(
    () =>
      db.compensationFact.create({
        data: {
          personId: person.id,
          factKind: FACT_KIND.compensation,
          startDate: new Date("2021-06-01T00:00:00.000Z"),
          endDateExclusive: new Date("2021-09-01T00:00:00.000Z"),
          amount: "999",
        },
      }),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      assert.ok(
        /23P01|exclusion|CompensationFact_person_kind_effective_excl/i.test(
          msg,
        ) ||
          (typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: unknown }).code === "23P01"),
        `expected exclusion violation, got: ${msg}`,
      );
      return true;
    },
  );

  // Envelope: production compensation category disabled → deny + omit
  const categories = loadCategoryRegistry();
  const deny = evaluateAuthorization(
    {
      rules: [
        {
          permission: "compensation.read",
          dataCategory: COMPENSATION_DATA_CATEGORY,
          action: "read",
          organizationalScope: "org:any",
        },
      ],
    },
    categories,
    {
      permission: "compensation.read",
      dataCategory: COMPENSATION_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:any",
    },
  );
  assert.equal(deny, "deny");

  const omitted = omitUnauthorizedCategories(
    { amount: "1", currency: "IRR", id: "x" },
    { amount: COMPENSATION_DATA_CATEGORY, currency: COMPENSATION_DATA_CATEGORY },
    new Set([COMPENSATION_DATA_CATEGORY]),
    categories,
  );
  assert.equal(Object.prototype.hasOwnProperty.call(omitted, "amount"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(omitted, "currency"), false);

  // Injected test registry may grant — proves omit path when enabled
  const testRegistry = {
    categories: [
      ...DEV_DEMO_CATEGORIES.categories.filter(
        (c) => c.id !== COMPENSATION_DATA_CATEGORY,
      ),
      {
        id: COMPENSATION_DATA_CATEGORY,
        enabled: true,
        sensitivity: "sensitive" as const,
        requiresSeparateExport: true,
      },
    ],
  };
  const projected = projectCompensationRecord(open!, {
    allowedCategories: new Set([COMPENSATION_DATA_CATEGORY]),
    categories: testRegistry,
  });
  assert.ok(Object.prototype.hasOwnProperty.call(projected, "amount"));
  assert.equal(projected.amount, open!.amount);

  const projectedDenied = projectCompensationRecord(open!, {
    allowedCategories: new Set(["demo.non_hr"]),
    categories: testRegistry,
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(projectedDenied, "amount"),
    false,
  );
  assert.ok(Object.prototype.hasOwnProperty.call(projectedDenied, "id"));

  // Field category map covers sensitive keys
  assert.equal(
    COMPENSATION_FIELD_CATEGORY.amount,
    COMPENSATION_DATA_CATEGORY,
  );

  console.log("compensation-facts selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
