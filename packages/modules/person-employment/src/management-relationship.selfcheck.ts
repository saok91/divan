/**
 * Derived management relationships selfcheck (Story 3.9 / FR-13).
 * Run: pnpm --filter @divan/person-employment selfcheck:management-relationships
 * Requires DATABASE_URL, migrated schema, seeded fixtures.
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  AR_MANAGEMENT_ROLE_REGISTRY,
  EMPLOYMENT_MINIMUM_FACTS,
  ManagementRelationshipError,
  SEED_JOB_REFERENCES,
  SEED_MANAGEMENT_RELATIONSHIPS,
  SEED_ORGANIZATION_HIERARCHY,
  SEED_PERSON_IDENTITY,
  applyPrimaryAssignmentProjection,
  assertManagementRoleRegistryValid,
  buildManagementRelationshipsFromDerivation,
  clearJobRefDependencyHooksForTests,
  clearOrgUnitDependencyHooksForTests,
  closePrimaryAssignmentProjection,
  deriveManagementEdgesAsOf,
  ensurePrimaryAssignmentHooksRegistered,
  getPersonDb,
  isMiddleManagerRoleCode,
  listManagedPersonsAsOf,
  listPrimaryAssignmentsForEmployment,
  listTeamMembersAsOf,
  resetPrimaryAssignmentHooksRegistrationForTests,
  resolveSeniorManagerScopeOrgUnitAsOf,
  resolveTeamManagerAsOf,
  seedManagementRelationshipFixtures,
  seedSecondaryAssignmentFixtures,
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

  clearOrgUnitDependencyHooksForTests();
  clearJobRefDependencyHooksForTests();
  resetPrimaryAssignmentHooksRegistrationForTests();
  ensurePrimaryAssignmentHooksRegistered();

  await seedSecondaryAssignmentFixtures(db);
  await seedManagementRelationshipFixtures(db);

  assertManagementRoleRegistryValid();
  assert.ok(
    AR_MANAGEMENT_ROLE_REGISTRY.middleManagerRoleCodes.includes("ROLE-MID-MGR"),
  );
  assert.ok(
    AR_MANAGEMENT_ROLE_REGISTRY.seniorManagerRoleCodes.includes("ROLE-SNR-MGR"),
  );
  assert.equal(isMiddleManagerRoleCode("role-mid-mgr"), true);
  assert.equal(isMiddleManagerRoleCode(SEED_JOB_REFERENCES.role.code), false);

  const mgmtFact = EMPLOYMENT_MINIMUM_FACTS.find(
    (f) => f.fact === "Derived management relationships",
  );
  assert.ok(mgmtFact);
  assert.match(mgmtFact!.notes, /3\.9/);

  const team = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.teamActive.code },
  });
  assert.ok(team);
  const dept = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.department.code },
  });
  assert.ok(dept);

  const midPerson = await db.person.findUnique({
    where: {
      personnelCode:
        SEED_MANAGEMENT_RELATIONSHIPS.middleManagerPerson.personnelCode,
    },
  });
  const snrPerson = await db.person.findUnique({
    where: {
      personnelCode:
        SEED_MANAGEMENT_RELATIONSHIPS.seniorManagerPerson.personnelCode,
    },
  });
  const member = await db.person.findUnique({
    where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
  });
  assert.ok(midPerson && snrPerson && member);

  const asOf = "2025-06-15";

  // One middle-manager → resolve
  const resolved = await resolveTeamManagerAsOf(team!.id, asOf, db);
  assert.ok(resolved);
  assert.equal(resolved!.managerPersonId, midPerson!.id);

  // Zero middle-manager on a team without one
  const histTeam = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.teamHistorical.code },
  });
  assert.ok(histTeam);
  // Historical team may be inactive as-of; still returns null (not throw) when no mid-mgr
  const noMgr = await resolveTeamManagerAsOf(histTeam!.id, "2022-06-01", db);
  assert.equal(noMgr, null);

  // Member list includes member; managed set includes member
  const members = await listTeamMembersAsOf(team!.id, asOf, {}, db);
  assert.ok(members.includes(member!.id));
  const managed = await listManagedPersonsAsOf(midPerson!.id, asOf, db);
  assert.ok(managed.includes(member!.id));
  assert.equal(managed.includes(midPerson!.id), false);

  // Senior path: Department parent scope
  const seniorScope = await resolveSeniorManagerScopeOrgUnitAsOf(
    snrPerson!.id,
    asOf,
    db,
  );
  assert.ok(seniorScope);
  assert.equal(seniorScope!.orgUnitId, dept!.id);
  assert.equal(seniorScope!.unitType, "DEPARTMENT");
  const seniorManaged = await listManagedPersonsAsOf(snrPerson!.id, asOf, db);
  assert.ok(seniorManaged.includes(member!.id));

  // Edges
  const edges = await deriveManagementEdgesAsOf(asOf, db);
  assert.ok(
    edges.some(
      (e) =>
        e.managerPersonId === midPerson!.id &&
        e.subjectPersonId === member!.id &&
        e.scopeKind === "team",
    ),
  );

  // Secondary acting_manager alone does NOT make demo person Team manager
  // (demo has acting_manager Secondary but ROLE-HR-SPEC Primary)
  assert.notEqual(resolved!.managerPersonId, member!.id);

  // As-of before manager Primary start → no manager
  const before = await resolveTeamManagerAsOf(team!.id, "2023-01-01", db);
  assert.equal(before, null);

  // Forbidden product verbs
  const pub = await import("./index");
  assert.equal("setManager" in pub, false);
  assert.equal("assignManager" in pub, false);
  assert.equal("createManagementRelationship" in pub, false);
  assert.equal("updateReportingLine" in pub, false);
  assert.ok("resolveTeamManagerAsOf" in pub);
  assert.ok("buildManagementRelationshipsFromDerivation" in pub);

  // Ambiguity: temporary second middle-manager Primary → AMBIGUOUS_TEAM_MANAGER
  const midRole = await db.organizationalRole.findUnique({
    where: { code: SEED_MANAGEMENT_RELATIONSHIPS.middleManagerRole.code },
  });
  const title = await db.jobTitle.findUnique({
    where: { code: SEED_JOB_REFERENCES.jobTitle.code },
  });
  const ladder = await db.ladder.findUnique({
    where: { code: SEED_JOB_REFERENCES.ladder.code },
  });
  const grade = ladder
    ? await db.grade.findUnique({
        where: {
          ladderId_code: {
            ladderId: ladder.id,
            code: SEED_JOB_REFERENCES.gradeLow.code,
          },
        },
      })
    : null;
  assert.ok(midRole && title && ladder && grade);

  // Use senior person's Employment temporarily as second mid-mgr (then restore)
  const snrEmp = (
    await db.employment.findMany({ where: { personId: snrPerson!.id } })
  ).find((e) => e.endDateExclusive === null);
  assert.ok(snrEmp);

  const snrPrimariesBefore = await listPrimaryAssignmentsForEmployment(
    snrEmp!.id,
    db,
  );
  const snrOpen = snrPrimariesBefore.find((p) => p.endDateExclusive === null);
  assert.ok(snrOpen);

  let ambiguousThrown = false;
  let ambiguousScopeThrown = false;
  let deriveAmbiguousThrown = false;
  try {
    await db.primaryAssignment.deleteMany({
      where: { employmentId: snrEmp!.id },
    });
    await applyPrimaryAssignmentProjection(
      {
        employmentId: snrEmp!.id,
        teamId: team!.id,
        organizationalRoleId: midRole!.id,
        jobTitleId: title!.id,
        ladderId: ladder!.id,
        gradeId: grade!.id,
        startDate: SEED_MANAGEMENT_RELATIONSHIPS.activeStart,
        endDateExclusive: null,
      },
      db,
    );
    try {
      await resolveTeamManagerAsOf(team!.id, asOf, db);
    } catch (err) {
      assert.ok(err instanceof ManagementRelationshipError);
      assert.equal(err.code, "AMBIGUOUS_TEAM_MANAGER");
      ambiguousThrown = true;
    }
    assert.equal(ambiguousThrown, true);

    // Ambiguous Team inside senior span → AMBIGUOUS_MANAGEMENT_SCOPE
    // (senior Primary temporarily replaced by mid — use midPerson as "senior"
    //  after restoring is wrong; instead check while two mids exist via
    //  listManagedPersonsAsOf on a Person who still has senior Role — none.
    //  Re-apply senior on a *third* path: mid remains; create temporary senior
    //  by keeping ambiguity and calling derive which must throw.)
    try {
      await deriveManagementEdgesAsOf(asOf, db);
    } catch (err) {
      assert.ok(err instanceof ManagementRelationshipError);
      assert.ok(
        err.code === "AMBIGUOUS_TEAM_MANAGER" ||
          err.code === "AMBIGUOUS_MANAGEMENT_SCOPE",
      );
      deriveAmbiguousThrown = true;
    }
    assert.equal(deriveAmbiguousThrown, true);

    // Restore senior Role on snr, keep a *second* mid via temporary apply on
    // a closed historical interval is heavy — instead: after restore below,
    // open a dedicated ambiguity block for senior span using mid + second mid.
  } finally {
    // Best-effort restore senior Primary
    await db.primaryAssignment.deleteMany({
      where: { employmentId: snrEmp!.id },
    });
    const snrRole = await db.organizationalRole.findUnique({
      where: { code: SEED_MANAGEMENT_RELATIONSHIPS.seniorManagerRole.code },
    });
    assert.ok(snrRole);
    await applyPrimaryAssignmentProjection(
      {
        employmentId: snrEmp!.id,
        teamId: team!.id,
        organizationalRoleId: snrRole!.id,
        jobTitleId: title!.id,
        ladderId: ladder!.id,
        gradeId: grade!.id,
        startDate: SEED_MANAGEMENT_RELATIONSHIPS.activeStart,
        endDateExclusive: null,
      },
      db,
    );
  }

  // Senior span ambiguity: second mid-manager on TEAM-DEMO while senior active
  {
    const memberEmpForAmb = (
      await db.employment.findMany({ where: { personId: member!.id } })
    ).find((e) => e.endDateExclusive === null);
    assert.ok(memberEmpForAmb);
    const memberPrimariesBefore = await listPrimaryAssignmentsForEmployment(
      memberEmpForAmb!.id,
      db,
    );
    const memberOpenBefore = memberPrimariesBefore.find(
      (p) => p.endDateExclusive === null,
    );
    assert.ok(memberOpenBefore);

    try {
      await db.primaryAssignment.deleteMany({
        where: { employmentId: memberEmpForAmb!.id },
      });
      await applyPrimaryAssignmentProjection(
        {
          employmentId: memberEmpForAmb!.id,
          teamId: team!.id,
          organizationalRoleId: midRole!.id,
          jobTitleId: title!.id,
          ladderId: ladder!.id,
          gradeId: grade!.id,
          startDate: SEED_MANAGEMENT_RELATIONSHIPS.activeStart,
          endDateExclusive: null,
        },
        db,
      );

      try {
        await listManagedPersonsAsOf(snrPerson!.id, asOf, db);
      } catch (err) {
        assert.ok(err instanceof ManagementRelationshipError);
        assert.equal(err.code, "AMBIGUOUS_MANAGEMENT_SCOPE");
        ambiguousScopeThrown = true;
      }
      assert.equal(ambiguousScopeThrown, true);

      let deriveScopeThrown = false;
      try {
        await deriveManagementEdgesAsOf(asOf, db);
      } catch (err) {
        assert.ok(err instanceof ManagementRelationshipError);
        assert.ok(
          err.code === "AMBIGUOUS_TEAM_MANAGER" ||
            err.code === "AMBIGUOUS_MANAGEMENT_SCOPE",
        );
        deriveScopeThrown = true;
      }
      assert.equal(deriveScopeThrown, true);
    } finally {
      await db.primaryAssignment.deleteMany({
        where: { employmentId: memberEmpForAmb!.id },
      });
      await applyPrimaryAssignmentProjection(
        {
          employmentId: memberEmpForAmb!.id,
          teamId: team!.id,
          organizationalRoleId: memberOpenBefore!.organizationalRoleId,
          jobTitleId: memberOpenBefore!.jobTitleId,
          ladderId: memberOpenBefore!.ladderId,
          gradeId: memberOpenBefore!.gradeId,
          seniorityId: memberOpenBefore!.seniorityId,
          startDate: memberOpenBefore!.startDate,
          endDateExclusive: null,
        },
        db,
      );
    }
  }

  // Subject leaves Team → not in managed set after end exclusive
  const memberEmp = (
    await db.employment.findMany({ where: { personId: member!.id } })
  ).find((e) => e.endDateExclusive === null);
  assert.ok(memberEmp);
  const memberPrimaries = await listPrimaryAssignmentsForEmployment(
    memberEmp!.id,
    db,
  );
  const memberOpen = memberPrimaries.find((p) => p.endDateExclusive === null);
  assert.ok(memberOpen);

  const leaveDate = "2025-12-01";
  try {
    await closePrimaryAssignmentProjection(memberOpen!.id, leaveDate, db);
    const afterLeave = await listManagedPersonsAsOf(midPerson!.id, leaveDate, db);
    assert.equal(afterLeave.includes(member!.id), false);
  } finally {
    // Restore open Primary for member (seed shape) — closed rows cannot reopen by id
    await db.primaryAssignment.deleteMany({
      where: { employmentId: memberEmp!.id },
    });
    await applyPrimaryAssignmentProjection(
      {
        employmentId: memberEmp!.id,
        teamId: team!.id,
        organizationalRoleId: memberOpen!.organizationalRoleId,
        jobTitleId: memberOpen!.jobTitleId,
        ladderId: memberOpen!.ladderId,
        gradeId: memberOpen!.gradeId,
        seniorityId: memberOpen!.seniorityId,
        startDate: memberOpen!.startDate,
        endDateExclusive: null,
      },
      db,
    );
  }

  // PopulationPort adapter (injected Account resolver) — honesty: fixtures still default
  const derivedEdges = await deriveManagementEdgesAsOf(asOf, db);
  const teamEdges = derivedEdges.filter(
    (e) =>
      e.managerPersonId === midPerson!.id && e.subjectPersonId === member!.id,
  );
  assert.ok(teamEdges.length >= 1);
  const adapterRels = buildManagementRelationshipsFromDerivation(
    teamEdges,
    (personId) =>
      personId === midPerson!.id
        ? `account:${SEED_MANAGEMENT_RELATIONSHIPS.demoManagerAccountUsername}`
        : null,
  );
  assert.equal(adapterRels.length, teamEdges.length);
  assert.equal(
    adapterRels[0]!.managerAccountId,
    `account:${SEED_MANAGEMENT_RELATIONSHIPS.demoManagerAccountUsername}`,
  );
  assert.equal(adapterRels[0]!.subjectId, member!.id);

  // Dedupe: team + senior edges for same manager/subject → one PopulationPort row
  const midAccount = `account:${SEED_MANAGEMENT_RELATIONSHIPS.demoManagerAccountUsername}`;
  const deduped = buildManagementRelationshipsFromDerivation(
    [
      {
        managerPersonId: midPerson!.id,
        subjectPersonId: member!.id,
        scopeKind: "team",
        orgUnitId: team!.id,
        validFrom: "2024-01-01",
        validToExclusive: null,
      },
      {
        managerPersonId: midPerson!.id,
        subjectPersonId: member!.id,
        scopeKind: "senior",
        orgUnitId: dept!.id,
        validFrom: "2024-06-01",
        validToExclusive: null,
      },
    ],
    (personId) => (personId === midPerson!.id ? midAccount : null),
  );
  assert.equal(deduped.length, 1);

  // FR-47 foreshadow: management-derived cover only inside relationship interval
  // (full PopulationPort registry remains fixture-backed — no identity-access import).
  function managementCoversLocal(
    accountId: string,
    subjectId: string,
    asOfDate: string,
    rels: typeof adapterRels,
  ): boolean {
    return rels.some(
      (r) =>
        r.managerAccountId === accountId &&
        r.subjectId === subjectId &&
        r.validFrom <= asOfDate &&
        (r.validToExclusive === null || r.validToExclusive > asOfDate),
    );
  }
  const edge = teamEdges[0]!;
  assert.equal(
    managementCoversLocal(midAccount, member!.id, asOf, adapterRels),
    true,
  );
  assert.equal(
    managementCoversLocal(midAccount, member!.id, "2023-01-01", adapterRels),
    false,
  );
  assert.ok(edge.validFrom <= asOf);
  assert.ok(
    edge.validToExclusive === null || edge.validToExclusive > asOf,
  );

  // Secondary inventory still intact (acting_manager ≠ management source)
  const { assertReasonTypeInInventory } = await import("./index");
  assert.equal(assertReasonTypeInInventory("acting_manager"), "acting_manager");

  console.log("management-relationships selfcheck: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
