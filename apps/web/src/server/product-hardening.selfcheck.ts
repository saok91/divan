import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getSharedPrismaClient } from "@divan/db";
import { getSessionContext, setPopulationFixtureRegistryForTests } from "@divan/identity-access";
import { createPerson } from "@divan/person-employment";
import { getInferenceBulkHooks, setInferenceBulkHooksForTests } from "@divan/audit-envelope";
import { appRouter } from "./root";
import { runPersonnelScopedSearch } from "./personnel-scoped-search";

/** Mutates fixtures: requires explicit confirmation of an isolated DB name. */
async function main() {
  const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
  assert.ok(process.env.NODE_ENV !== "production" && databaseName &&
    process.env.DIVAN_TEST_DATABASE_CONFIRM === databaseName,
  "Set DIVAN_TEST_DATABASE_CONFIRM to the isolated test database name");
  const db = getSharedPrismaClient();
  const admin = await db.internalAccount.findUniqueOrThrow({ where: { username: "hr.admin" } });
  const operator = await db.internalAccount.findUniqueOrThrow({ where: { username: "hr.operator" } });
  const adminContext = await getSessionContext(admin.id);
  assert.ok(adminContext);
  const suffix = randomUUID().slice(0, 8);
  const fixtures: string[] = [];
  for (let index = 0; index < 61; index++) {
    const person = await createPerson({
      personnelCode: `QA-${suffix}-${String(index).padStart(3, "0")}`,
      givenName: "آزمون", familyName: `صفحه${suffix}`, mobilePhone: "09120000200",
    }, { accountId: admin.id, correlationId: randomUUID() }, db);
    fixtures.push(person.id);
  }
  const oldHooks = getInferenceBulkHooks();
  // Local selfcheck configuration only. Production policy is unchanged.
  setInferenceBulkHooksForTests({ ...oldHooks, enabled: true, minimumCohortSize: 1,
    maxVolumePerRequest: 500, maxVolumePerWindow: 10000, maxFieldCumulative: 10000,
    bulkApprovalVolumeThreshold: 500 });
  setPopulationFixtureRegistryForTests({
    subjects: fixtures.map((id) => ({id, scopeCodes: ["org:selfcheck"]})),
    relationships: [], crossTimeGrants: [], facts: [],
  });
  try {
    const caller = appRouter.createCaller({ session: adminContext, priorAuthzBindingFingerprint: adminContext.authzBindingFingerprint });
    const started = performance.now();
    const first = await caller.person.search({channel: "list", pageSize: 25, normalizedQuery: suffix});
    const firstMs = Math.round(performance.now() - started);
    assert.equal(first.outcome, "allowed");
    assert.equal(first.rows.length, 25);
    assert.equal(first.totalInSnapshot, 61);
    assert.ok(first.evaluationSnapshotId);
    assert.ok(!first.rows.some((row) => row.id === fixtures[60]));
    const queryStarted = performance.now();
    const match = await caller.person.search({channel: "list", pageSize: 25, normalizedQuery: `QA-${suffix}-060`});
    const searchMs = Math.round(performance.now() - queryStarted);
    assert.equal(match.rows.length, 1);
    assert.ok(match.rows[0]);
    assert.equal(match.rows[0].id, fixtures[60], "Global search must find a person beyond the first page");
    const second = await caller.person.search({channel: "list", pageSize: 25, page: 2,
      normalizedQuery: suffix, evaluationSnapshotId: first.evaluationSnapshotId});
    assert.equal(second.rows.length, 25);
    assert.equal(new Set([...first.rows, ...second.rows].map((row) => row.id)).size, 50);
    const changed = await runPersonnelScopedSearch({actorAccountId: admin.id, actorScopeCodes: [],
      correlationId: randomUUID(), channel: "list", page: 2, pageSize: 25,
      normalizedQuery: suffix, evaluationSnapshotId: first.evaluationSnapshotId});
    assert.equal(changed.outcome, "denied", "A scope change invalidates old snapshot membership");
    assert.ok(first.exportSnapshotHash);
    const artifact = await caller.export.createFromPersonnel({reviewedSnapshotHash: first.exportSnapshotHash,
      format: "csv", normalizedQuery: suffix, purpose: "isolated_product_selfcheck"});
    assert.equal(artifact.rowCount, 61, "Export must include all authorized continuation pages, beyond default 50");

    const prior = await getSessionContext(operator.id);
    assert.ok(prior);
    const operatorCaller = appRouter.createCaller({session: prior, priorAuthzBindingFingerprint: prior.authzBindingFingerprint});
    await assert.rejects(() => operatorCaller.organization.list({includeInactive:false}),
      (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "FORBIDDEN"));
    await db.internalAccount.update({where:{id:operator.id},data:{status:"inactive"}});
    try {
      await assert.rejects(() => operatorCaller.me(), (error: unknown) =>
        Boolean(error && typeof error === "object" && "code" in error && error.code === "UNAUTHORIZED"));
      await assert.rejects(() => operatorCaller.person.search({channel:"list"}), (error: unknown) =>
        Boolean(error && typeof error === "object" && "code" in error && error.code === "UNAUTHORIZED"));
    } finally { await db.internalAccount.update({where:{id:operator.id},data:{status:operator.status}}); }
    console.log(`product-hardening.selfcheck: ok; 61 authorized people; first page ${firstMs}ms; global match ${searchMs}ms; export 61 rows`);
  } finally {
    setInferenceBulkHooksForTests(oldHooks);
    setPopulationFixtureRegistryForTests(null);
  }
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
