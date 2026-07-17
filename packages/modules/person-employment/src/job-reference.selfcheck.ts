/**
 * Job-reference concepts selfcheck (Story 3.6 / FR-10).
 * Run: pnpm --filter @divan/person-employment selfcheck:job-reference
 * Requires DATABASE_URL, migrated job-ref schema, seeded accounts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  JOB_REF_NO_GRADE_SENIORITY_MAPPING,
  JobRefError,
  SEED_JOB_REFERENCES,
  assertValidHalfGradeRank,
  clearJobRefDependencyHooksForTests,
  createGrade,
  createLadder,
  createOrganizationalRole,
  createSeniority,
  deactivateLadder,
  deactivateOrganizationalRole,
  deactivateSeniority,
  getPersonDb,
  listGradesForLadder,
  registerJobRefDependencyHook,
  seedJobReferenceFixtures,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

async function expectJobRefErrorAsync(
  fn: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await fn();
    assert.fail(`expected JobRefError ${code}`);
  } catch (err) {
    assert.ok(err instanceof JobRefError, `got ${String(err)}`);
    assert.equal(err.code, code);
  }
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getPersonDb();
  clearJobRefDependencyHooksForTests();
  await seedJobReferenceFixtures(db);

  const seed = SEED_JOB_REFERENCES;

  const ladder = await db.ladder.findUnique({
    where: { code: seed.ladder.code },
  });
  assert.ok(ladder, "seed ladder");
  assert.equal(ladder!.active, true);

  const gradeHalf = await db.grade.findUnique({
    where: {
      ladderId_code: { ladderId: ladder!.id, code: seed.gradeHalf.code },
    },
  });
  assert.ok(gradeHalf, "seed half-grade");
  assert.equal(Number(gradeHalf!.rank), 12.5);

  const role = await db.organizationalRole.findUnique({
    where: { code: seed.role.code },
  });
  assert.ok(role, "seed role");

  const jobTitle = await db.jobTitle.findUnique({
    where: { code: seed.jobTitle.code },
  });
  assert.ok(jobTitle, "seed job title");

  const seniority = await db.seniority.findUnique({
    where: { code: seed.seniority.code },
  });
  assert.ok(seniority, "seed seniority");

  const senHist = await db.seniority.findUnique({
    where: { code: seed.seniorityHistorical.code },
  });
  assert.ok(senHist, "seed historical seniority");
  assert.equal(senHist!.active, false);

  // AC #1: listGradesForLadder only returns that ladder's grades (incl. half-grade)
  const grades = await listGradesForLadder(ladder!.id, {}, db);
  assert.ok(grades.length >= 2);
  assert.ok(grades.some((g) => g.rank === "12.5"));
  assert.ok(grades.every((g) => g.ladderId === ladder!.id));

  const suffix = randomUUID().slice(0, 8);
  const otherLadder = await createLadder(
    {
      code: `LAD-X-${suffix}`,
      nameFa: "لدر ایزوله",
      startDate: "2020-01-01",
    },
    db,
  );
  const otherGrade = await createGrade(
    {
      code: `GX-${suffix}`,
      nameFa: "گرید ایزوله",
      ladderId: otherLadder.id,
      rank: "1.0",
      startDate: "2020-01-01",
    },
    db,
  );
  const onlyOther = await listGradesForLadder(otherLadder.id, {}, db);
  assert.equal(onlyOther.length, 1);
  assert.equal(onlyOther[0]!.code, `GX-${suffix}`);
  assert.ok(!onlyOther.some((g) => g.ladderId === ladder!.id));

  await expectJobRefErrorAsync(
    () =>
      createGrade(
        {
          code: `BAD-${suffix}`,
          nameFa: "گرید بد",
          ladderId: randomUUID(),
          rank: "2.0",
          startDate: "2020-01-01",
        },
        db,
      ),
    "JOB_REF_NOT_FOUND",
  );

  // AC #2: Seniority without Grade link succeeds
  const freeSen = await createSeniority(
    {
      code: `SEN-FREE-${suffix}`,
      nameFa: "ارشدیت آزاد",
      startDate: "2021-01-01",
    },
    db,
  );
  assert.ok(freeSen.id);
  assert.equal(JOB_REF_NO_GRADE_SENIORITY_MAPPING, true);

  await expectJobRefErrorAsync(
    () =>
      createOrganizationalRole(
        {
          code: seed.role.code,
          nameFa: "تکراری",
          startDate: "2020-01-01",
        },
        db,
      ),
    "DUPLICATE_JOB_REF_CODE",
  );

  await expectJobRefErrorAsync(
    () =>
      createOrganizationalRole(
        {
          code: `ROLE-SEN-${suffix}`,
          nameFa: "N/A",
          startDate: "2020-01-01",
        },
        db,
      ),
    "SENTINEL_VALUE",
  );

  await expectJobRefErrorAsync(
    () =>
      createGrade(
        {
          code: `G-BAD-RANK-${suffix}`,
          nameFa: "رتبه بد",
          ladderId: otherLadder.id,
          rank: "12.3",
          startDate: "2020-01-01",
        },
        db,
      ),
    "INVALID_HALF_GRADE_RANK",
  );
  assert.equal(assertValidHalfGradeRank("12.5").toFixed(1), "12.5");
  await expectJobRefErrorAsync(async () => {
    assertValidHalfGradeRank("0");
  }, "INVALID_HALF_GRADE_RANK");
  await expectJobRefErrorAsync(async () => {
    assertValidHalfGradeRank("-1");
  }, "INVALID_HALF_GRADE_RANK");
  await expectJobRefErrorAsync(async () => {
    assertValidHalfGradeRank("1000");
  }, "INVALID_HALF_GRADE_RANK");

  // Deactivate with no deps succeeds; row retained
  const tempRole = await createOrganizationalRole(
    {
      code: `ROLE-TMP-${suffix}`,
      nameFa: "نقش موقت",
      startDate: "2020-01-01",
    },
    db,
  );
  const deactivated = await deactivateOrganizationalRole(
    tempRole.id,
    "2025-01-01",
    db,
  );
  assert.equal(deactivated.active, false);
  assert.equal(deactivated.endDateExclusive, "2025-01-01");
  const stillThere = await db.organizationalRole.findUnique({
    where: { id: tempRole.id },
  });
  assert.ok(stillThere);

  // Dependency hook blocks deactivation
  registerJobRefDependencyHook(async (concept, refId) => {
    if (concept === "seniority" && refId === freeSen.id) {
      return { blocked: true, reasons: ["assignment_active"] };
    }
    return { blocked: false };
  });
  await expectJobRefErrorAsync(
    () => deactivateSeniority(freeSen.id, "2025-06-01", db),
    "DEACTIVATION_BLOCKED_DEPENDENCIES",
  );
  clearJobRefDependencyHooksForTests();

  // Ladder with active grades cannot deactivate
  await expectJobRefErrorAsync(
    () => deactivateLadder(otherLadder.id, "2025-01-01", db),
    "LADDER_HAS_ACTIVE_GRADES",
  );

  // DB Restrict: deleting ladder with grades must fail
  await assert.rejects(
    () => db.ladder.delete({ where: { id: otherLadder.id } }),
    (err: unknown) =>
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2003",
  );

  // No Assignment mutation / Grade↔Seniority mapping APIs on public surface
  const pe = await import("./index");
  assert.equal("assignJobTitle" in pe, false);
  assert.equal("changeGrade" in pe, false);
  assert.equal("assertGradeSeniorityCompatible" in pe, false);

  // Cleanup isolated selfcheck rows (hard-delete only test noise)
  await db.grade.delete({ where: { id: otherGrade.id } });
  await db.ladder.delete({ where: { id: otherLadder.id } });
  await db.seniority.delete({ where: { id: freeSen.id } });
  await db.organizationalRole.delete({ where: { id: tempRole.id } });

  clearJobRefDependencyHooksForTests();
  console.log("job-reference selfcheck: OK");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
