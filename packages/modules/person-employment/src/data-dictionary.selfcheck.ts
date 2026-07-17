/**
 * Data Dictionary selfcheck (Story 3.3 / FR-7).
 * Run: pnpm --filter @divan/person-employment selfcheck:data-dictionary
 * Requires DATABASE_URL, migrated schema (DataElement), seeded accounts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEV_DEMO_CATEGORIES,
} from "@divan/audit-envelope";
import { config as loadEnv } from "dotenv";

import {
  DataDictionaryError,
  ELEMENT_ID,
  MSG_DATA_ELEMENT_ENABLE_INCOMPLETE_FA,
  MSG_DATA_ELEMENT_ENABLE_LATER_FA,
  MSG_DATA_ELEMENT_ENABLE_REJECT_FA,
  MSG_DERIVED_SENSITIVITY_DOWNGRADE_FA,
  MSG_FIELD_NOT_ENABLED_FA,
  MSG_FREE_TEXT_PURPOSE_REQUIRED_FA,
  MSG_MOBILE_PHONE_FORMAT_FA,
  PersonIdentityError,
  assertDerivedSensitivityAllowed,
  assertFreeTextAllowed,
  createPerson,
  enableDataElement,
  getDataElement,
  getPersonById,
  getPersonDb,
  listEnabledProfileFields,
  normalizeIranianMobilePhone,
  projectPersonRecord,
  seedDataDictionaryFixtures,
  updatePersonIdentity,
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
  await seedDataDictionaryFixtures(db);

  const ctx = { accountId: "selfcheck", correlationId: randomUUID() };
  const suffix = randomUUID().slice(0, 8);

  // Approve + complete metadata → enabled; appear in listEnabledProfileFields
  const mobile = await getDataElement(ELEMENT_ID.mobilePhone, db);
  assert.ok(mobile);
  assert.equal(mobile!.disposition, "approve");
  assert.equal(mobile!.enabled, true);

  const enabled = await listEnabledProfileFields(undefined, db);
  const enabledIds = new Set(enabled.map((f) => f.elementId));
  assert.ok(enabledIds.has(ELEMENT_ID.mobilePhone));
  assert.ok(enabledIds.has(ELEMENT_ID.personnelCode));
  assert.ok(enabledIds.has(ELEMENT_ID.givenName));
  assert.equal(enabledIds.has(ELEMENT_ID.religion), false);
  assert.equal(enabledIds.has(ELEMENT_ID.landline), false);

  // later cannot enable
  await assert.rejects(
    () => enableDataElement(ELEMENT_ID.landline, db),
    (err: unknown) => {
      assert.ok(err instanceof DataDictionaryError);
      assert.equal(err.code, "ENABLE_REJECTED");
      assert.equal(err.messageFa, MSG_DATA_ELEMENT_ENABLE_LATER_FA);
      return true;
    },
  );

  // reject cannot enable
  await assert.rejects(
    () => enableDataElement(ELEMENT_ID.religion, db),
    (err: unknown) => {
      assert.ok(err instanceof DataDictionaryError);
      assert.equal(err.code, "REJECT_DISPOSITION");
      assert.equal(err.messageFa, MSG_DATA_ELEMENT_ENABLE_REJECT_FA);
      return true;
    },
  );

  // Incomplete metadata cannot enable — temporarily strip purpose on a later row
  // then promote disposition in-memory path: use landline after forcing approve+empty meta
  await db.dataElement.update({
    where: { elementId: ELEMENT_ID.landline },
    data: {
      disposition: "approve",
      purpose: null,
      ownerSource: null,
      format: null,
      sensitivity: null,
      access: null,
      retention: null,
      export: null,
      audit: null,
      enabled: false,
    },
  });
  await assert.rejects(
    () => enableDataElement(ELEMENT_ID.landline, db),
    (err: unknown) => {
      assert.ok(err instanceof DataDictionaryError);
      assert.equal(err.code, "METADATA_INCOMPLETE");
      assert.equal(err.messageFa, MSG_DATA_ELEMENT_ENABLE_INCOMPLETE_FA);
      return true;
    },
  );
  // Restore landline to later/disabled (seed semantics)
  await db.dataElement.update({
    where: { elementId: ELEMENT_ID.landline },
    data: {
      disposition: "later",
      enabled: false,
      purpose: null,
      ownerSource: null,
      format: null,
      sensitivity: null,
      access: null,
      retention: null,
      export: null,
      audit: null,
    },
  });

  // mobilePhone Persian digits → Latin canonical
  assert.equal(
    normalizeIranianMobilePhone("۰۹۱۲۳۴۵۶۷۸۹"),
    "09123456789",
  );
  assert.equal(
    normalizeIranianMobilePhone("+989123456789"),
    "09123456789",
  );
  assert.throws(
    () => normalizeIranianMobilePhone("12345"),
    (err: unknown) => {
      assert.ok(err instanceof PersonIdentityError);
      assert.equal(err.code, "MOBILE_PHONE_FORMAT");
      assert.equal(err.messageFa, MSG_MOBILE_PHONE_FORMAT_FA);
      return true;
    },
  );

  const person = await createPerson(
    {
      personnelCode: `7${suffix.slice(0, 7)}`,
      givenName: "دیکت",
      familyName: "آزما",
      mobilePhone: "۰۹۱۲۱۱۱۲۲۳۳",
    },
    ctx,
    db,
  );
  assert.equal(person.mobilePhone, "09121112233");

  await assert.rejects(
    () =>
      updatePersonIdentity(
        person.id,
        { mobilePhone: "not-a-phone" },
        ctx,
        db,
      ),
    (err: unknown) => {
      assert.ok(err instanceof PersonIdentityError);
      assert.equal(err.code, "MOBILE_PHONE_FORMAT");
      return true;
    },
  );

  // Write to disabled field — temporarily disable givenName
  await db.dataElement.update({
    where: { elementId: ELEMENT_ID.givenName },
    data: { enabled: false },
  });
  await assert.rejects(
    () =>
      updatePersonIdentity(person.id, { givenName: "مسدود" }, ctx, db),
    (err: unknown) => {
      assert.ok(err instanceof PersonIdentityError);
      assert.equal(err.code, "FIELD_NOT_ENABLED");
      assert.equal(err.messageFa, MSG_FIELD_NOT_ENABLED_FA);
      return true;
    },
  );
  await db.dataElement.update({
    where: { elementId: ELEMENT_ID.givenName },
    data: { enabled: true },
  });

  // Read projection: nationalId omitted without category grant
  await updatePersonIdentity(
    person.id,
    { nationalId: `00${suffix.padEnd(8, "0").slice(0, 8)}` },
    ctx,
    db,
  );
  const full = await getPersonById(person.id, db);
  assert.ok(full);
  const enabledFields = new Set(
    (await listEnabledProfileFields(undefined, db)).map(
      (f) => f.personFieldKey,
    ),
  );
  const projected = projectPersonRecord(full!, {
    enabledFields,
    allowedCategories: new Set(["identity.person"]),
    categories: DEV_DEMO_CATEGORIES,
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(projected, "nationalId"),
    false,
  );
  assert.equal(projected.mobilePhone, "09121112233");

  // Free-text / derived helpers
  assert.throws(
    () => assertFreeTextAllowed({ freeTextPurpose: null, access: "x" }),
    (err: unknown) => {
      assert.ok(err instanceof DataDictionaryError);
      assert.equal(err.code, "FREE_TEXT_PURPOSE_REQUIRED");
      assert.equal(err.messageFa, MSG_FREE_TEXT_PURPOSE_REQUIRED_FA);
      return true;
    },
  );
  assertFreeTextAllowed({
    freeTextPurpose: "notes for HR ops",
    access: "identity.person",
  });

  assert.throws(
    () =>
      assertDerivedSensitivityAllowed({
        lineage: "a+b",
        outputSensitivity: "ordinary",
        inputSensitivities: ["sensitive"],
      }),
    (err: unknown) => {
      assert.ok(err instanceof DataDictionaryError);
      assert.equal(err.code, "DERIVED_SENSITIVITY_DOWNGRADE");
      assert.equal(err.messageFa, MSG_DERIVED_SENSITIVITY_DOWNGRADE_FA);
      return true;
    },
  );
  assertDerivedSensitivityAllowed({
    lineage: "a+b",
    outputSensitivity: "ordinary",
    inputSensitivities: ["sensitive"],
    assessmentRecorded: true,
  });

  // Religion never on profile
  assert.equal(
    (await listEnabledProfileFields(undefined, db)).some(
      (f) => f.elementId === ELEMENT_ID.religion,
    ),
    false,
  );

  // No silent historical Employment overwrite API on this module surface
  assert.equal(
    typeof (await import("./index")).applyEmploymentProjection,
    "function",
  );
  // Profile update path is updatePersonIdentity only — no edit-history API export
  const mod = await import("./index");
  assert.equal(
    "editEmploymentHistory" in mod || "overwriteEmploymentFact" in mod,
    false,
  );

  console.log("data-dictionary selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
