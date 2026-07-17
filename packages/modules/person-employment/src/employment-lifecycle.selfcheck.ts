/**
 * Employment lifecycle selfcheck (Story 3.2 / FR-6).
 * Run: pnpm --filter @divan/person-employment selfcheck:employment-lifecycle
 * Requires DATABASE_URL, migrated schema (Employment + EXCLUDE), seeded accounts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  EMPLOYMENT_MINIMUM_FACTS,
  EmploymentError,
  MSG_CONCURRENT_EMPLOYMENT_FORBIDDEN_FA,
  MSG_OVERLAPPING_EMPLOYMENT_FA,
  SEED_EMPLOYMENT_LIFECYCLE,
  SEED_PERSON_IDENTITY,
  applyEmploymentProjection,
  assertAtMostOneActiveAsOf,
  assertPersonSurvivesEmploymentEnd,
  assertValidEmploymentInterval,
  closeEmploymentProjection,
  createPerson,
  getActiveEmploymentAsOf,
  getEmploymentById,
  getPersonById,
  getPersonDb,
  listEmploymentsForPerson,
  seedEmploymentLifecycleFixtures,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getPersonDb();
  await seedEmploymentLifecycleFixtures(db);

  // Seed: closed + open adjacent for demo Person 10001
  const demo = await db.person.findUnique({
    where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
  });
  assert.ok(demo, "demo person 10001 required");
  const seeded = await listEmploymentsForPerson(demo.id, db);
  assert.ok(seeded.length >= 2, "seed ≥2 employments");
  const hist = seeded.find(
    (e) =>
      e.startDate === SEED_EMPLOYMENT_LIFECYCLE.historicalStart &&
      e.endDateExclusive === SEED_EMPLOYMENT_LIFECYCLE.historicalEndExclusive,
  );
  const open = seeded.find(
    (e) =>
      e.startDate === SEED_EMPLOYMENT_LIFECYCLE.activeStart &&
      e.endDateExclusive === null,
  );
  assert.ok(hist, "historical closed employment");
  assert.ok(open, "open active employment");
  assert.equal(
    hist!.endDateExclusive,
    open!.startDate,
    "adjacent half-open: endExclusive of first === start of second",
  );

  // Active as-of inside open interval
  const activeNow = await getActiveEmploymentAsOf(demo.id, "2025-06-15", db);
  assert.ok(activeNow);
  assert.equal(activeNow!.id, open!.id);

  // As-of only in closed historical
  const activeHist = await getActiveEmploymentAsOf(demo.id, "2022-06-15", db);
  assert.ok(activeHist);
  assert.equal(activeHist!.id, hist!.id);

  // Never two active at once
  assertAtMostOneActiveAsOf(seeded, "2022-06-15");
  assertAtMostOneActiveAsOf(seeded, "2025-06-15");

  // Fresh person for mutation cases
  const suffix = randomUUID().slice(0, 8);
  const person = await createPerson(
    {
      personnelCode: `7${suffix.slice(0, 7)}`,
      givenName: "همکار",
      familyName: "آزمون",
      mobilePhone: "09121112233",
    },
    { accountId: "selfcheck", correlationId: randomUUID() },
    db,
  );

  const first = await applyEmploymentProjection(
    {
      personId: person.id,
      startDate: "2021-01-01",
      endDateExclusive: "2023-01-01",
      collaborationType: "contractor",
    },
    db,
  );
  const second = await applyEmploymentProjection(
    {
      personId: person.id,
      startDate: "2023-01-01",
      endDateExclusive: null,
      collaborationType: "employee",
    },
    db,
  );
  assert.equal(first.endDateExclusive, second.startDate);

  // Overlapping interval rejected (domain)
  await assert.rejects(
    () =>
      applyEmploymentProjection(
        {
          personId: person.id,
          startDate: "2022-06-01",
          endDateExclusive: "2022-12-01",
        },
        db,
      ),
    (err: unknown) => {
      assert.ok(err instanceof EmploymentError);
      assert.equal(err.code, "OVERLAPPING_EMPLOYMENT");
      assert.equal(err.messageFa, MSG_OVERLAPPING_EMPLOYMENT_FA);
      return true;
    },
  );

  // Second open while one open exists → ConcurrentEmploymentForbidden
  await assert.rejects(
    () =>
      applyEmploymentProjection(
        {
          personId: person.id,
          startDate: "2026-01-01",
          endDateExclusive: null,
        },
        db,
      ),
    (err: unknown) => {
      assert.ok(err instanceof EmploymentError);
      assert.equal(err.code, "CONCURRENT_EMPLOYMENT_FORBIDDEN");
      assert.equal(err.messageFa, MSG_CONCURRENT_EMPLOYMENT_FORBIDDEN_FA);
      return true;
    },
  );

  // Invalid interval (end ≤ start)
  assert.throws(
    () => assertValidEmploymentInterval("2024-01-01", "2024-01-01"),
    (err: unknown) => {
      assert.ok(err instanceof EmploymentError);
      assert.equal(err.code, "INVALID_EMPLOYMENT_INTERVAL");
      return true;
    },
  );

  // Timestamp-shaped rejected
  assert.throws(
    () => assertValidEmploymentInterval("2024-01-01T00:00:00Z", null),
    (err: unknown) => {
      assert.ok(err instanceof EmploymentError);
      assert.equal(err.code, "INVALID_EMPLOYMENT_INTERVAL");
      return true;
    },
  );

  // Trimmed start accepted
  const trimmed = assertValidEmploymentInterval("  2024-01-01  ", "2024-06-01");
  assert.equal(trimmed.startDate, "2024-01-01");

  // Invalid as-of must throw (not silent false/null)
  assert.throws(
    () => assertAtMostOneActiveAsOf(seeded, "not-a-date"),
    (err: unknown) => {
      assert.ok(err instanceof EmploymentError);
      assert.equal(err.code, "INVALID_EMPLOYMENT_INTERVAL");
      return true;
    },
  );
  await assert.rejects(
    () => getActiveEmploymentAsOf(demo.id, "2024-01-01T12:00:00Z", db),
    (err: unknown) => {
      assert.ok(err instanceof EmploymentError);
      assert.equal(err.code, "INVALID_EMPLOYMENT_INTERVAL");
      return true;
    },
  );

  // Empty/whitespace close end rejected while still open
  await assert.rejects(
    () => closeEmploymentProjection(second.id, "   ", db),
    (err: unknown) => {
      assert.ok(err instanceof EmploymentError);
      assert.equal(err.code, "INVALID_EMPLOYMENT_INTERVAL");
      return true;
    },
  );

  // closeEmploymentProjection → Person intact
  const closed = await closeEmploymentProjection(second.id, "2025-12-31", db);
  assert.equal(closed.endDateExclusive, "2025-12-31");
  const afterClose = await getPersonById(person.id, db);
  assert.ok(afterClose);
  assert.equal(afterClose!.id, person.id);
  await assertPersonSurvivesEmploymentEnd(person.id, db);

  // Second close of already-closed → already closed
  await assert.rejects(
    () => closeEmploymentProjection(second.id, "2026-01-01", db),
    (err: unknown) => {
      assert.ok(err instanceof EmploymentError);
      assert.equal(err.code, "VALIDATION");
      return true;
    },
  );

  // ON DELETE RESTRICT: Person cannot be deleted while Employment rows exist
  await assert.rejects(
    () => db.person.delete({ where: { id: person.id } }),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      assert.ok(
        /P2003|Foreign key|RESTRICT|Employment_personId_fkey/i.test(msg) ||
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

  const byId = await getEmploymentById(closed.id, db);
  assert.ok(byId);
  assert.equal(byId!.endDateExclusive, "2025-12-31");

  // No operator Start/Return/Terminate product verbs on public surface
  const pub = await import("./index");
  assert.ok(!("createEmployment" in pub));
  assert.ok(!("startEmployment" in pub));
  assert.ok(!("terminateEmployment" in pub));
  assert.ok(!("returnEmployment" in pub));
  assert.equal(typeof pub.applyEmploymentProjection, "function");
  assert.equal(typeof pub.closeEmploymentProjection, "function");

  // Minimum facts checklist documented for Epic 4
  assert.ok(EMPLOYMENT_MINIMUM_FACTS.length >= 5);
  assert.ok(
    EMPLOYMENT_MINIMUM_FACTS.some((f) => f.ownerStory.startsWith("3.2")),
  );
  assert.ok(
    EMPLOYMENT_MINIMUM_FACTS.some((f) => f.ownerStory.includes("3.7")),
  );

  // Prefer DB EXCLUDE: raw Prisma create overlapping must fail (23P01 → mapped if via apply;
  // direct create proves constraint even when domain is bypassed).
  await assert.rejects(
    () =>
      db.employment.create({
        data: {
          personId: person.id,
          startDate: new Date("2021-06-01T00:00:00.000Z"),
          endDateExclusive: new Date("2021-09-01T00:00:00.000Z"),
        },
      }),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      assert.ok(
        /23P01|exclusion|Employment_person_effective_excl/i.test(msg) ||
          (typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: unknown }).code === "23P01"),
        `expected exclusion violation, got: ${msg}`,
      );
      return true;
    },
  );

  // Empty optional / sentinel strip via apply
  const third = await applyEmploymentProjection(
    {
      personId: person.id,
      startDate: "2026-01-01",
      endDateExclusive: "2026-06-01",
      collaborationType: "",
      terminationReason: "   ",
    },
    db,
  );
  assert.equal(third.collaborationType, null);
  assert.equal(third.terminationReason, null);

  // Sentinel on lean Employment fields → EmploymentError (not PersonIdentityError)
  await assert.rejects(
    () =>
      applyEmploymentProjection(
        {
          personId: person.id,
          startDate: "2027-01-01",
          endDateExclusive: "2027-06-01",
          collaborationType: "N/A",
        },
        db,
      ),
    (err: unknown) => {
      assert.ok(err instanceof EmploymentError);
      assert.equal(err.code, "SENTINEL_VALUE");
      return true;
    },
  );

  console.log("employment-lifecycle selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
