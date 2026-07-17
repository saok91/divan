/**
 * Person identity selfcheck (Story 3.1).
 * Run: pnpm --filter @divan/person-employment selfcheck:person-identity
 * Requires DATABASE_URL, migrated schema, seeded accounts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEV_DEMO_CATEGORIES,
  DEV_DEMO_POLICY,
  evaluateAuthorization,
  type CategoryRegistry,
} from "@divan/audit-envelope";
import { config as loadEnv } from "dotenv";

import {
  PERSON_DATA_CATEGORY,
  PERSON_READ_PERMISSION,
  PERSON_WRITE_PERMISSION,
  NATIONAL_ID_DATA_CATEGORY,
  PersonIdentityError,
  MSG_BLOCKED_IDENTITY_OPERATION_FA,
  MSG_DUPLICATE_PERSONNEL_CODE_FA,
  MSG_DUPLICATE_NATIONAL_ID_FA,
  MSG_SENTINEL_OPTIONAL_FA,
  assertPersonSurvivesEmploymentEnd,
  assertActorHasPersonWrite,
  correctPersonnelCode,
  createPerson,
  getPersonById,
  getPersonByPersonnelCode,
  getPersonDb,
  matchReturn,
  mergePersons,
  seedPersonIdentityFixtures,
  splitPerson,
  updatePersonIdentity,
  normalizeOptionalString,
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
  await seedPersonIdentityFixtures(db);

  const suffix = randomUUID().slice(0, 8);
  const codeA = `9${suffix.slice(0, 7)}`;
  const codeB = `8${suffix.slice(0, 7)}`;
  const ctx = { accountId: "selfcheck", correlationId: randomUUID() };

  // Create with unique code + names + mobile
  const person = await createPerson(
    {
      personnelCode: codeA,
      givenName: "آزما",
      familyName: "یشی",
      mobilePhone: "09120000001",
    },
    ctx,
    db,
  );
  assert.ok(person.id.length > 0, "UUID PK required");
  assert.notEqual(person.id, person.personnelCode);
  assert.equal(person.personnelCode, codeA);

  const byId = await getPersonById(person.id, db);
  assert.ok(byId);
  assert.equal(byId!.personnelCode, codeA);

  // Persian digits normalize to same canonical code
  const byCodeFa = await getPersonByPersonnelCode(
    codeA.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!),
    db,
  );
  assert.ok(byCodeFa);
  assert.equal(byCodeFa!.id, person.id);

  // Duplicate Personnel Code
  await assert.rejects(
    () =>
      createPerson(
        {
          personnelCode: codeA,
          givenName: "ب",
          familyName: "ج",
          mobilePhone: "09120000002",
        },
        ctx,
        db,
      ),
    (err: unknown) => {
      assert.ok(err instanceof PersonIdentityError);
      assert.equal(err.code, "DUPLICATE_PERSONNEL_CODE");
      assert.equal(err.messageFa, MSG_DUPLICATE_PERSONNEL_CODE_FA);
      return true;
    },
  );

  // National ID uniqueness when present (category-gated write path =
  // updatePersonIdentity; create never accepts nationalId).
  const withNidBase = await createPerson(
    {
      personnelCode: codeB,
      givenName: "ن",
      familyName: "م",
      mobilePhone: "09120000003",
    },
    ctx,
    db,
  );
  const withNid = await updatePersonIdentity(
    withNidBase.id,
    { nationalId: `00${suffix}` },
    ctx,
    db,
  );
  assert.equal(withNid.nationalId, `00${suffix}`);

  const other = await createPerson(
    {
      personnelCode: `7${suffix.slice(0, 7)}`,
      givenName: "د",
      familyName: "ه",
      mobilePhone: "09120000004",
    },
    ctx,
    db,
  );
  await assert.rejects(
    () =>
      updatePersonIdentity(
        other.id,
        { nationalId: `00${suffix}` },
        ctx,
        db,
      ),
    (err: unknown) => {
      assert.ok(err instanceof PersonIdentityError);
      assert.equal(err.code, "DUPLICATE_NATIONAL_ID");
      assert.equal(err.messageFa, MSG_DUPLICATE_NATIONAL_ID_FA);
      return true;
    },
  );

  // Empty optional → null; sentinel rejected
  assert.equal(normalizeOptionalString(""), null);
  assert.equal(normalizeOptionalString("  "), null);
  assert.throws(
    () => normalizeOptionalString("N/A"),
    (err: unknown) => {
      assert.ok(err instanceof PersonIdentityError);
      assert.equal(err.messageFa, MSG_SENTINEL_OPTIONAL_FA);
      return true;
    },
  );
  assert.throws(
    () => normalizeOptionalString("0"),
    (err: unknown) => {
      assert.ok(err instanceof PersonIdentityError);
      assert.equal(err.code, "SENTINEL_VALUE");
      return true;
    },
  );
  assert.throws(
    () => normalizeOptionalString("۰"),
    (err: unknown) => {
      assert.ok(err instanceof PersonIdentityError);
      assert.equal(err.code, "SENTINEL_VALUE");
      return true;
    },
  );

  const clearedNid = await updatePersonIdentity(
    withNid.id,
    { nationalId: "---" },
    ctx,
    db,
  );
  assert.equal(clearedNid.nationalId, null);

  const updated = await updatePersonIdentity(
    person.id,
    { fatherName: "", gender: null },
    ctx,
    db,
  );
  assert.equal(updated.fatherName, null);
  assert.equal(updated.gender, null);

  // Blocked ops
  for (const fn of [
    () => correctPersonnelCode(person.id, "99999", ctx),
    () => mergePersons(person.id, withNid.id, ctx),
    () => splitPerson(person.id, ctx),
    () => matchReturn(person.id, ctx),
  ]) {
    assert.throws(fn, (err: unknown) => {
      assert.ok(err instanceof PersonIdentityError);
      assert.equal(err.code, "BLOCKED_IDENTITY_OPERATION");
      assert.equal(err.messageFa, MSG_BLOCKED_IDENTITY_OPERATION_FA);
      return true;
    });
  }

  // AC #5 continuity — no delete-on-employment API
  assertPersonSurvivesEmploymentEnd();
  assert.equal(
    typeof (await import("./index")).createPerson,
    "function",
  );
  assert.ok(
    !("deletePersonOnEmploymentEnd" in (await import("./index"))),
  );

  // Envelope: identity.person grantable; national_id disabled in prod hooks
  const personCat = DEV_DEMO_CATEGORIES.categories.find(
    (c) => c.id === PERSON_DATA_CATEGORY,
  );
  assert.ok(personCat?.enabled === true, "identity.person enabled in demo");

  const nidCat = DEV_DEMO_CATEGORIES.categories.find(
    (c) => c.id === NATIONAL_ID_DATA_CATEGORY,
  );
  assert.ok(nidCat);
  assert.equal(nidCat!.enabled, false, "national_id stays disabled");

  const allowWrite = evaluateAuthorization(
    DEV_DEMO_POLICY,
    DEV_DEMO_CATEGORIES,
    {
      permission: PERSON_WRITE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
    },
  );
  assert.equal(allowWrite, "allow");

  const denyNid = evaluateAuthorization(
    DEV_DEMO_POLICY,
    DEV_DEMO_CATEGORIES,
    {
      permission: PERSON_WRITE_PERMISSION,
      dataCategory: NATIONAL_ID_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
    },
  );
  assert.equal(denyNid, "deny");

  // Selfcheck-only: enable national_id category + policy rule
  const enabledNid: CategoryRegistry = {
    categories: DEV_DEMO_CATEGORIES.categories.map((c) =>
      c.id === NATIONAL_ID_DATA_CATEGORY ? { ...c, enabled: true } : c,
    ),
  };
  const policyWithNid = {
    rules: [
      ...DEV_DEMO_POLICY.rules,
      {
        permission: PERSON_WRITE_PERMISSION,
        dataCategory: NATIONAL_ID_DATA_CATEGORY,
        action: "write" as const,
        organizationalScope: "org:selfcheck",
      },
      {
        permission: PERSON_READ_PERMISSION,
        dataCategory: NATIONAL_ID_DATA_CATEGORY,
        action: "read" as const,
        organizationalScope: "org:selfcheck",
      },
    ],
  };
  const allowNid = evaluateAuthorization(policyWithNid, enabledNid, {
    permission: PERSON_WRITE_PERMISSION,
    dataCategory: NATIONAL_ID_DATA_CATEGORY,
    action: "write",
    organizationalScope: "org:selfcheck",
  });
  assert.equal(allowNid, "allow");

  // PermissionSet binding: hr.admin has person.write after seed
  const hrAdmin = await db.internalAccount.findUnique({
    where: { username: "hr.admin" },
  });
  assert.ok(hrAdmin, "seeded hr.admin required for binding check");
  await assertActorHasPersonWrite(hrAdmin.id, db);

  // Manager without person.write binding → deny
  const manager = await db.internalAccount.findUnique({
    where: { username: "manager" },
  });
  if (manager) {
    await assert.rejects(
      () => assertActorHasPersonWrite(manager.id, db),
      (err: unknown) => {
        assert.ok(err instanceof PersonIdentityError);
        assert.equal(err.code, "PERMISSION_DENIED");
        return true;
      },
    );
  }

  console.log("person-identity selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
