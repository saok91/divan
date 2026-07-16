/**
 * Self-check for temporal + cross-boundary authorization (Story 2.6 / FR-47).
 * Run: pnpm --filter @divan/identity-access selfcheck:temporal-authz
 * Requires DATABASE_URL + seed.
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AuthorizationError,
  DEV_DEMO_CATEGORIES,
  DEV_DEMO_POLICY,
  actorHoldsOrganizationalScope,
  createAuditEnvelope,
  evaluateAuthorizationWithMembership,
  resolveEvaluationTime,
} from "@divan/audit-envelope";
import { createPgPool } from "@divan/db";
import {
  parseDateOnly,
  todayDateOnlyTehran,
} from "@divan/temporal-engine";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";

import {
  AuthzChangedError,
  computeAuthzBindingFingerprint,
  getIdentityDb,
  getSessionContext,
  intersectPopulation,
  drillDownPopulation,
  reauthorizeForQueuedOrArtifactWork,
  seedAccessAdministrationFixtures,
  setPopulationPortEnabledForTests,
  DEMO_POPULATION_FIXTURES,
  kindRequiresIndependentApproval,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

async function main() {
  // --- Pure temporal helpers ---
  assert.equal(parseDateOnly("2024-06-15").ok, true);
  assert.equal(parseDateOnly("2024-06-15T12:00:00Z").ok, false);
  assert.equal(parseDateOnly("15/06/2024").ok, false);
  assert.ok(todayDateOnlyTehran().match(/^\d{4}-\d{2}-\d{2}$/));

  const timeOk = resolveEvaluationTime({
    evaluationMode: "as_of",
    asOfDate: "2024-01-01",
  });
  assert.equal(timeOk.ok, true);
  if (timeOk.ok) assert.equal(timeOk.resultSemantics, "effective");

  const timeBad = resolveEvaluationTime({
    evaluationMode: "as_of",
    asOfDate: "2024-01-01T00:00:00Z",
  });
  assert.equal(timeBad.ok, false);

  // --- Membership ---
  assert.equal(
    actorHoldsOrganizationalScope(
      {
        accountId: "a",
        coarseRole: "hr_operator",
        organizationalScopeIds: ["cuid1"],
        organizationalScopeCodes: ["org:selfcheck"],
      },
      "org:selfcheck",
    ),
    true,
  );
  assert.equal(
    actorHoldsOrganizationalScope(
      {
        accountId: "a",
        coarseRole: "hr_operator",
        organizationalScopeIds: [],
        organizationalScopeCodes: [],
      },
      "org:selfcheck",
    ),
    false,
  );
  assert.equal(
    evaluateAuthorizationWithMembership(
      DEV_DEMO_POLICY,
      DEV_DEMO_CATEGORIES,
      {
        permission: "demo.selfcheck.read",
        dataCategory: "demo.non_hr",
        action: "read",
        organizationalScope: "org:selfcheck",
      },
      {
        accountId: "a",
        coarseRole: "hr_operator",
        organizationalScopeIds: [],
        organizationalScopeCodes: [],
      },
    ),
    "deny",
  );

  assert.equal(kindRequiresIndependentApproval("cross_time_scope"), true);

  // --- Population intersection fixtures ---
  const scoped = intersectPopulation({
    actorAccountId: "account:hr",
    actorScopeCodes: ["org:fixture-a"],
    asOfDate: "2024-06-01",
    channel: "search",
  });
  assert.equal(scoped.ok, true);
  if (scoped.ok) {
    assert.ok(scoped.subjectIds.includes("person:a1"));
    assert.ok(scoped.subjectIds.includes("person:ab"));
    assert.equal(scoped.subjectIds.includes("person:b1"), false);
  }

  const parent = {
    actorAccountId: "account:hr",
    actorScopeCodes: ["org:fixture-a"],
    asOfDate: "2024-06-01",
    channel: "search" as const,
  };
  const parentIds = intersectPopulation(parent);
  assert.ok(parentIds.ok);
  const drill = drillDownPopulation(parent, "person:a1");
  assert.ok(drill.ok);
  if (drill.ok && parentIds.ok) {
    assert.deepEqual(drill.subjectIds, ["person:a1"]);
    assert.equal(
      drill.subjectIds.some((id) => !parentIds.subjectIds.includes(id)),
      false,
    );
  }

  // Current manager — fact inside interval
  const mgrIn = intersectPopulation({
    actorAccountId: "account:manager-current",
    actorScopeCodes: ["org:fixture-a"],
    asOfDate: "2024-06-01",
    channel: "timeline",
    facts: DEMO_POPULATION_FIXTURES.facts,
  });
  assert.ok(mgrIn.ok);
  if (mgrIn.ok) {
    assert.ok(
      mgrIn.factKeys.includes("person:mgr-sub|2024-06-01|assignment"),
    );
  }

  // Current manager — pre-scope WITHOUT cross-time grant → omit
  const mgrPreNoGrant = intersectPopulation({
    actorAccountId: "account:manager-current",
    actorScopeCodes: ["org:fixture-a"],
    asOfDate: "2022-06-01",
    channel: "timeline",
    facts: [
      { subjectId: "person:mgr-sub", asOf: "2022-06-01", kind: "assignment" },
    ],
  });
  assert.ok(mgrPreNoGrant.ok);
  if (mgrPreNoGrant.ok) {
    assert.equal(mgrPreNoGrant.factKeys.length, 0);
  }

  // Current manager — pre-scope WITH cross-time grant → allow slice
  const mgrPreWithGrant = intersectPopulation({
    actorAccountId: "account:manager-current",
    actorScopeCodes: ["org:fixture-a"],
    asOfDate: "2023-03-15",
    channel: "timeline",
    facts: [
      { subjectId: "person:mgr-sub", asOf: "2023-03-15", kind: "assignment" },
    ],
  });
  assert.ok(mgrPreWithGrant.ok);
  if (mgrPreWithGrant.ok) {
    assert.ok(mgrPreWithGrant.factKeys.length === 1);
  }

  // Former manager — post-scope fact without grant window → omit
  const formerPost = intersectPopulation({
    actorAccountId: "account:manager-former",
    actorScopeCodes: ["org:fixture-a"],
    asOfDate: "2024-06-01",
    channel: "timeline",
    facts: [
      { subjectId: "person:mgr-sub", asOf: "2024-06-01", kind: "assignment" },
    ],
  });
  assert.ok(formerPost.ok);
  if (formerPost.ok) {
    assert.equal(formerPost.factKeys.length, 0);
  }

  // Former manager — post-scope with bounded cross-time grant
  const formerGranted = intersectPopulation({
    actorAccountId: "account:manager-former",
    actorScopeCodes: ["org:fixture-a"],
    asOfDate: "2023-09-01",
    channel: "timeline",
    facts: [
      { subjectId: "person:mgr-sub", asOf: "2023-09-01", kind: "assignment" },
    ],
  });
  assert.ok(formerGranted.ok);
  if (formerGranted.ok) {
    assert.equal(formerGranted.factKeys.length, 1);
  }

  // Unreconciled / missing port → fail closed
  const unrec = intersectPopulation({
    actorAccountId: "account:hr",
    actorScopeCodes: ["org:fixture-a"],
    asOfDate: "2024-06-01",
    channel: "search",
    unreconciled: true,
  });
  assert.equal(unrec.ok, false);

  setPopulationPortEnabledForTests(false);
  const noPort = intersectPopulation({
    actorAccountId: "account:hr",
    actorScopeCodes: ["org:fixture-a"],
    asOfDate: "2024-06-01",
    channel: "search",
  });
  assert.equal(noPort.ok, false);
  setPopulationPortEnabledForTests(true);

  // Fingerprint change (ids and codes both contribute)
  const fp1 = computeAuthzBindingFingerprint({
    coarseRole: "hr_operator",
    organizationalScopeIds: ["s1"],
    organizationalScopeCodes: ["org:selfcheck"],
    accessRoleIds: [],
  });
  const fp2 = computeAuthzBindingFingerprint({
    coarseRole: "hr_operator",
    organizationalScopeIds: ["s1"],
    organizationalScopeCodes: ["org:other"],
    accessRoleIds: [],
  });
  assert.notEqual(fp1, fp2);
  const changed = new AuthzChangedError();
  assert.equal(changed.code, "AUTHZ_CHANGED");
  assert.equal(changed.messageFa, "دسترسی شما تغییر کرد.");

  // Manager aggregates also narrow by relationship (not full scope membership)
  const mgrSearch = intersectPopulation({
    actorAccountId: "account:manager-current",
    actorScopeCodes: ["org:fixture-a"],
    asOfDate: "2024-06-01",
    channel: "search",
  });
  assert.ok(mgrSearch.ok);
  if (mgrSearch.ok) {
    assert.deepEqual(mgrSearch.subjectIds, ["person:mgr-sub"]);
  }

  // Session-aligned org:selfcheck subjects (non-empty for seeded demos)
  const selfcheckPop = intersectPopulation({
    actorAccountId: "account:hr",
    actorScopeCodes: ["org:selfcheck"],
    asOfDate: "2024-06-01",
    channel: "search",
  });
  assert.ok(selfcheckPop.ok);
  if (selfcheckPop.ok) {
    assert.ok(selfcheckPop.subjectIds.includes("person:a1"));
    assert.equal(selfcheckPop.subjectIds.includes("person:b1"), false);
  }

  // Cross-time purpose/category: wrong category → omit
  const wrongCat = intersectPopulation({
    actorAccountId: "account:manager-current",
    actorScopeCodes: ["org:fixture-a"],
    asOfDate: "2023-03-15",
    channel: "timeline",
    dataCategory: "demo.sensitive_hr",
    facts: [
      { subjectId: "person:mgr-sub", asOf: "2023-03-15", kind: "assignment" },
    ],
  });
  assert.ok(wrongCat.ok);
  if (wrongCat.ok) {
    assert.equal(wrongCat.factKeys.length, 0);
  }

  // --- DB probes ---
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");
  const pool = createPgPool(url);
  const db = getIdentityDb();
  await seedAccessAdministrationFixtures(db);

  const envelope = createAuditEnvelope({
    pool,
    getPolicy: () => DEV_DEMO_POLICY,
    getCategories: () => DEV_DEMO_CATEGORIES,
  });

  try {
    const hrOp = await db.internalAccount.findUnique({
      where: { username: "hr.operator" },
    });
    assert.ok(hrOp, "seeded hr.operator required");
    const session = await getSessionContext(hrOp.id);
    assert.ok(session);
    assert.ok(session.organizationalScopeCodes.includes("org:selfcheck"));
    assert.ok(session.authzBindingFingerprint.length > 0);

    await envelope.authorizeOrThrow({
      context: {
        accountId: session.accountId,
        coarseRole: session.coarseRole,
        organizationalScopeIds: session.organizationalScopeIds,
        organizationalScopeCodes: session.organizationalScopeCodes,
      },
      permission: "demo.selfcheck.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "temporal.selfcheck.membership_allow",
      correlationId: randomUUID(),
      sensitive: true,
    });

    // sys.admin typically has no org:selfcheck membership → deny
    const sys = await db.internalAccount.findUnique({
      where: { username: "sys.admin" },
    });
    assert.ok(sys);
    const sysSession = await getSessionContext(sys.id);
    assert.ok(sysSession);
    await assert.rejects(
      () =>
        envelope.authorizeOrThrow({
          context: {
            accountId: sysSession.accountId,
            coarseRole: sysSession.coarseRole,
            organizationalScopeIds: sysSession.organizationalScopeIds,
            organizationalScopeCodes: sysSession.organizationalScopeCodes,
          },
          permission: "demo.selfcheck.read",
          dataCategory: "demo.non_hr",
          action: "read",
          organizationalScope: "org:selfcheck",
          operation: "temporal.selfcheck.sysadmin_no_membership",
          correlationId: randomUUID(),
          sensitive: true,
        }),
      AuthorizationError,
    );

    const reauth = await reauthorizeForQueuedOrArtifactWork({
      accountId: hrOp.id,
      asOfDate: "2024-06-01",
      actorScopeCodes: ["org:fixture-a"],
      objectIds: ["person:a1"],
      populationChannel: "audit",
    });
    assert.equal(reauth.allowed, true);

    const reauthDeny = await reauthorizeForQueuedOrArtifactWork({
      accountId: hrOp.id,
      asOfDate: "not-a-date",
      actorScopeCodes: ["org:fixture-a"],
      objectIds: ["person:a1"],
    });
    assert.equal(reauthDeny.allowed, false);

    console.log("temporal-cross-boundary.selfcheck: ok");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
