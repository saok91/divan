/**
 * Organization hierarchy selfcheck (Story 3.5 / FR-9).
 * Run: pnpm --filter @divan/person-employment selfcheck:organization-hierarchy
 * Requires DATABASE_URL, migrated OrganizationalUnit schema, seeded accounts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  MSG_CHILD_OUTSIDE_PARENT_VALIDITY_FA,
  MSG_DEACTIVATION_BLOCKED_DEPENDENCIES_FA,
  MSG_DUPLICATE_ORG_CODE_FA,
  MSG_IMPOSSIBLE_REPARENT_FA,
  MSG_INVALID_PARENT_TYPE_FA,
  OrgUnitError,
  SEED_ORGANIZATION_HIERARCHY,
  activateOrgUnit,
  assertChildWithinParent,
  assertValidParentType,
  clearOrgUnitDependencyHooksForTests,
  createOrgUnit,
  deactivateOrgUnit,
  getHierarchyAsOf,
  getOrgUnitAsOf,
  getOrgUnitByCode,
  getOrgUnitById,
  getPersonDb,
  isOrgUnitActiveAsOf,
  registerOrgUnitDependencyHook,
  reparentOrgUnit,
  seedOrganizationHierarchyFixtures,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

function expectOrgError(fn: () => unknown, code: string): void {
  try {
    fn();
    assert.fail(`expected OrgUnitError ${code}`);
  } catch (err) {
    assert.ok(err instanceof OrgUnitError, `got ${String(err)}`);
    assert.equal(err.code, code);
  }
}

async function expectOrgErrorAsync(
  fn: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await fn();
    assert.fail(`expected OrgUnitError ${code}`);
  } catch (err) {
    assert.ok(err instanceof OrgUnitError, `got ${String(err)}`);
    assert.equal(err.code, code);
  }
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getPersonDb();
  clearOrgUnitDependencyHooksForTests();
  await seedOrganizationHierarchyFixtures(db);

  const seed = SEED_ORGANIZATION_HIERARCHY;
  const le = await db.organizationalUnit.findUnique({
    where: { code: seed.legalEntity.code },
  });
  assert.ok(le, "seed LE");
  const bu = await db.organizationalUnit.findUnique({
    where: { code: seed.businessUnit.code },
  });
  assert.ok(bu, "seed BU");
  const dept = await db.organizationalUnit.findUnique({
    where: { code: seed.department.code },
  });
  assert.ok(dept, "seed Dept");
  const teamHist = await db.organizationalUnit.findUnique({
    where: { code: seed.teamHistorical.code },
  });
  assert.ok(teamHist, "seed historical team");
  assert.equal(teamHist!.active, false);
  assert.ok(teamHist!.endDateExclusive);
  const teamActive = await db.organizationalUnit.findUnique({
    where: { code: seed.teamActive.code },
  });
  assert.ok(teamActive, "seed active team");
  assert.equal(teamActive!.active, true);

  // Story 8.3: getOrgUnitByCode happy path + missing → null
  const byCode = await getOrgUnitByCode(seed.teamActive.code, db);
  assert.ok(byCode);
  assert.equal(byCode!.id, teamActive!.id);
  const missingOrg = await getOrgUnitByCode("NO-SUCH-ORG-CODE-8-3", db);
  assert.equal(missingOrg, null);

  // Hierarchy as-of current: historical team omitted
  const treeNow = await getHierarchyAsOf("2024-06-01", db);
  assert.equal(treeNow.length, 1);
  assert.equal(treeNow[0]!.code, seed.legalEntity.code);
  assert.equal(treeNow[0]!.children[0]!.code, seed.businessUnit.code);
  assert.equal(
    treeNow[0]!.children[0]!.children[0]!.code,
    seed.department.code,
  );
  const teamsNow = treeNow[0]!.children[0]!.children[0]!.children;
  assert.ok(teamsNow.some((t) => t.code === seed.teamActive.code));
  assert.ok(!teamsNow.some((t) => t.code === seed.teamHistorical.code));

  // as-of inside historical team interval
  const histAsOf = await getOrgUnitAsOf(teamHist!.id, "2021-06-01", db);
  assert.ok(histAsOf);
  assert.equal(histAsOf!.code, seed.teamHistorical.code);
  const histGone = await getOrgUnitAsOf(teamHist!.id, "2024-06-01", db);
  assert.equal(histGone, null);

  // Wrong parent type
  const suffix = randomUUID().slice(0, 8);
  await expectOrgErrorAsync(
    () =>
      createOrgUnit(
        {
          code: `BAD-BU-${suffix}`,
          nameFa: "واحد اشتباه",
          unitType: "BUSINESS_UNIT",
          parentId: dept!.id,
          startDate: "2021-01-01",
        },
        db,
      ),
    "INVALID_PARENT_TYPE",
  );

  // Child outside parent validity
  await expectOrgErrorAsync(
    () =>
      createOrgUnit(
        {
          code: `EARLY-TEAM-${suffix}`,
          nameFa: "تیم زودرس",
          unitType: "TEAM",
          parentId: dept!.id,
          startDate: "2019-01-01",
        },
        db,
      ),
    "CHILD_OUTSIDE_PARENT_VALIDITY",
  );

  // Pure invariant helpers
  expectOrgError(
    () => assertValidParentType("TEAM", "LEGAL_ENTITY"),
    "INVALID_PARENT_TYPE",
  );
  expectOrgError(
    () =>
      assertChildWithinParent(
        { startDate: "2019-01-01", endDateExclusive: null },
        { startDate: "2020-01-01", endDateExclusive: null },
      ),
    "CHILD_OUTSIDE_PARENT_VALIDITY",
  );

  // Create valid chain under seed LE
  const isoLe = await createOrgUnit(
    {
      code: `LE-${suffix}`,
      nameFa: "نهاد آزمون",
      unitType: "LEGAL_ENTITY",
      startDate: "2020-01-01",
    },
    db,
  );
  const isoBu = await createOrgUnit(
    {
      code: `BU-${suffix}`,
      nameFa: "واحد آزمون",
      unitType: "BUSINESS_UNIT",
      parentId: isoLe.id,
      startDate: "2020-06-01",
    },
    db,
  );
  const isoDept = await createOrgUnit(
    {
      code: `DEPT-${suffix}`,
      nameFa: "دپارتمان آزمون",
      unitType: "DEPARTMENT",
      parentId: isoBu.id,
      startDate: "2021-01-01",
    },
    db,
  );
  const isoTeam = await createOrgUnit(
    {
      code: `TEAM-${suffix}`,
      nameFa: "تیم آزمون",
      unitType: "TEAM",
      parentId: isoDept.id,
      startDate: "2021-06-01",
    },
    db,
  );
  assert.ok(isOrgUnitActiveAsOf(isoTeam, "2022-01-01"));

  // Duplicate code
  await expectOrgErrorAsync(
    () =>
      createOrgUnit(
        {
          code: `LE-${suffix}`,
          nameFa: "تکراری",
          unitType: "LEGAL_ENTITY",
          startDate: "2020-01-01",
        },
        db,
      ),
    "DUPLICATE_ORG_CODE",
  );

  // Sentinel name
  await expectOrgErrorAsync(
    () =>
      createOrgUnit(
        {
          code: `LE-SENT-${suffix}`,
          nameFa: "N/A",
          unitType: "LEGAL_ENTITY",
          startDate: "2020-01-01",
        },
        db,
      ),
    "SENTINEL_VALUE",
  );

  // Deactivate leaf OK; row retained
  const closed = await deactivateOrgUnit(isoTeam.id, "2025-01-01", db);
  assert.equal(closed.active, false);
  assert.equal(closed.endDateExclusive, "2025-01-01");
  const retained = await getOrgUnitById(isoTeam.id, db);
  assert.ok(retained);
  assert.equal(retained!.id, isoTeam.id);

  // Reactivate — synced dual reopens interval
  const reopened = await activateOrgUnit(isoTeam.id, db);
  assert.equal(reopened.active, true);
  assert.equal(reopened.endDateExclusive, null);

  // Deactivate without end — fail closed
  await expectOrgErrorAsync(
    () => deactivateOrgUnit(isoTeam.id, null, db),
    "INVALID_ORG_INTERVAL",
  );

  // Deactivate parent blocked by active child
  await expectOrgErrorAsync(
    () => deactivateOrgUnit(isoDept.id, "2025-06-01", db),
    "DEACTIVATION_BLOCKED_DEPENDENCIES",
  );

  // Dependency hook fail-closed
  registerOrgUnitDependencyHook(async () => ({
    blocked: true,
    reasons: ["selfcheck_hook"],
  }));
  await expectOrgErrorAsync(
    () => deactivateOrgUnit(isoTeam.id, "2025-12-01", db),
    "DEACTIVATION_BLOCKED_DEPENDENCIES",
  );
  clearOrgUnitDependencyHooksForTests();

  // Impossible reparent (wrong type / interval)
  await expectOrgErrorAsync(
    () => reparentOrgUnit(isoTeam.id, isoBu.id, db),
    "IMPOSSIBLE_REPARENT",
  );

  // Parent delete Restrict — attempt via Prisma should fail when children exist
  await assert.rejects(
    () => db.organizationalUnit.delete({ where: { id: isoDept.id } }),
    (err: unknown) =>
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: unknown }).code === "P2003",
  );

  // No Assignment mutation APIs on public surface
  const pub = await import("./index");
  assert.equal(
    "assignPersonToTeam" in pub,
    false,
    "must not export assignPersonToTeam",
  );
  assert.equal(
    "transferPrimary" in pub,
    false,
    "must not export transferPrimary",
  );

  // MessageFa stability (codes, not substring matching for clients)
  assert.ok(MSG_INVALID_PARENT_TYPE_FA.length > 0);
  assert.ok(MSG_CHILD_OUTSIDE_PARENT_VALIDITY_FA.length > 0);
  assert.ok(MSG_IMPOSSIBLE_REPARENT_FA.length > 0);
  assert.ok(MSG_DEACTIVATION_BLOCKED_DEPENDENCIES_FA.length > 0);
  assert.ok(MSG_DUPLICATE_ORG_CODE_FA.length > 0);

  // Best-effort cleanup of isolated tree (leaves first)
  await db.organizationalUnit.delete({ where: { id: isoTeam.id } });
  await db.organizationalUnit.delete({ where: { id: isoDept.id } });
  await db.organizationalUnit.delete({ where: { id: isoBu.id } });
  await db.organizationalUnit.delete({ where: { id: isoLe.id } });

  console.log("organization-hierarchy selfcheck: OK");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
