/**
 * Governed export artifact selfcheck (Story 6.5 / FR-41 / FR-52).
 * Run: pnpm --filter @divan/reporting selfcheck:export-artifact
 *
 * Pure matrix always runs (formula-safe, field filter, custody, snapshot hash).
 * Optional DB path when DATABASE_URL + 015 schema applied.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import type { CategoryRegistry } from "@divan/audit-envelope";
import { getSharedPgPool } from "@divan/db";
import ExcelJS from "exceljs";

import {
  CUSTODY_BOUNDARY_FA,
  ExportError,
  FORMULA_SAFE_TAB_PREFIX,
  computeExportSnapshotHash,
  createExportArtifact,
  csvContainsUnquotedFormulaRisk,
  downloadExportArtifact,
  filterExportFields,
  getExportArtifactById,
  listRetrievalsForArtifact,
  neutralizeExportCellValue,
  requiresCustodyAcknowledgement,
  revokeExportArtifact,
  writeFormulaSafeCsv,
  writeFormulaSafeXlsx,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

const demoCategories: CategoryRegistry = {
  categories: [
    {
      id: "demo.sensitive_hr",
      enabled: true,
      sensitivity: "sensitive",
      requiresSeparateExport: true,
    },
    {
      id: "identity.person",
      enabled: true,
      sensitivity: "ordinary",
      requiresSeparateExport: false,
    },
  ],
};

/** Formula neutralization — `=` and `@` get tab prefix */
assert.equal(neutralizeExportCellValue("=1+1"), `${FORMULA_SAFE_TAB_PREFIX}=1+1`);
assert.equal(neutralizeExportCellValue("@SUM"), `${FORMULA_SAFE_TAB_PREFIX}@SUM`);
assert.equal(
  neutralizeExportCellValue("  =CMD"),
  `${FORMULA_SAFE_TAB_PREFIX}=CMD`,
);
assert.equal(neutralizeExportCellValue("safe"), "safe");
assert.equal(neutralizeExportCellValue(42), "42");
assert.equal(neutralizeExportCellValue(null), "");

const csvBuf = writeFormulaSafeCsv(
  [
    { id: "name", headerFa: "=evilHeader" },
    { id: "evil", headerFa: "مقدار" },
  ],
  [
    {
      id: "r1",
      cells: { name: "علی", evil: "=CMD|calc" },
    },
    {
      id: "r2",
      cells: { name: "سارا", evil: "@SUM(A1)" },
    },
    {
      id: "r3",
      cells: { name: "نرگس", evil: "  =PADDED" },
    },
  ],
);
const csvText = csvBuf.toString("utf8");
assert.equal(csvContainsUnquotedFormulaRisk(csvText), false);
assert.ok(csvText.includes(`${FORMULA_SAFE_TAB_PREFIX}=CMD|calc`));
assert.ok(csvText.includes(`${FORMULA_SAFE_TAB_PREFIX}@SUM(A1)`));

const xlsxBuf = await writeFormulaSafeXlsx(
  [{ id: "evil", headerFa: "مقدار" }],
  [{ id: "r1", cells: { evil: "=1+1" } }],
);
{
  const wb = new ExcelJS.Workbook();
  // ExcelJS typings expect Node Buffer; Buffer.from ensures compatibility.
  await wb.xlsx.load(Buffer.from(xlsxBuf) as never);
  const sheet = wb.worksheets[0];
  assert.ok(sheet);
  const cell = sheet.getRow(2).getCell(1);
  assert.equal(cell.formula, undefined);
  assert.equal(String(cell.value), `${FORMULA_SAFE_TAB_PREFIX}=1+1`);
}

/** Sensitive omit without category export — not masked as zero */
{
  const filtered = filterExportFields({
    fields: [
      { id: "name", headerFa: "نام", dataCategory: "identity.person" },
      {
        id: "secret",
        headerFa: "حساس",
        dataCategory: "demo.sensitive_hr",
      },
    ],
    categoryRegistry: demoCategories,
    holdsCategoryExport: () => false,
  });
  assert.deepEqual(
    filtered.permitted.map((f) => f.id),
    ["name"],
  );
  assert.deepEqual(filtered.omittedSensitiveIds, ["secret"]);
  assert.equal(filtered.hasSensitiveIncluded, false);
}

/** With category export — sensitive included */
{
  const filtered = filterExportFields({
    fields: [
      {
        id: "secret",
        headerFa: "حساس",
        dataCategory: "demo.sensitive_hr",
      },
    ],
    categoryRegistry: demoCategories,
    holdsCategoryExport: (id) => id === "demo.sensitive_hr",
  });
  assert.equal(filtered.hasSensitiveIncluded, true);
  assert.equal(filtered.permitted.length, 1);
}

/** Custody threshold */
assert.equal(
  requiresCustodyAcknowledgement({ hasSensitiveFields: true, rowCount: 1 }),
  true,
);
assert.equal(
  requiresCustodyAcknowledgement({ hasSensitiveFields: false, rowCount: 25 }),
  true,
);
assert.equal(
  requiresCustodyAcknowledgement({ hasSensitiveFields: false, rowCount: 3 }),
  false,
);

/** Snapshot hash stable + tamper detect */
const snapA = computeExportSnapshotHash({
  sourceSurface: "report",
  sourceKey: "active_persons",
  filters: { asOf: "2026-07-26", teamId: null },
  fieldIds: ["name", "team"],
  asOf: "2026-07-26",
});
const snapB = computeExportSnapshotHash({
  sourceSurface: "report",
  sourceKey: "active_persons",
  filters: { asOf: "2026-07-26", teamId: null },
  fieldIds: ["team", "name"],
  asOf: "2026-07-26",
});
assert.equal(snapA, snapB);
const snapTamper = computeExportSnapshotHash({
  sourceSurface: "report",
  sourceKey: "active_persons",
  filters: { asOf: "2026-07-26", teamId: "other" },
  fieldIds: ["name", "team"],
  asOf: "2026-07-26",
});
assert.notEqual(snapA, snapTamper);

assert.ok(CUSTODY_BOUNDARY_FA.includes("محلی"));

console.log("export-artifact pure matrix: ok");

/** Optional DB path */
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.log(
    "export-artifact DB path: skipped (set DATABASE_URL + apply 015_export_artifacts.sql)",
  );
  process.exit(0);
}

const pool = getSharedPgPool(databaseUrl);

async function schemaReady(): Promise<boolean> {
  try {
    await pool.query(`SELECT 1 FROM reporting.export_artifact LIMIT 0`);
    return true;
  } catch {
    return false;
  }
}

if (!(await schemaReady())) {
  console.log(
    "export-artifact DB path: skipped (reporting.export_artifact missing — apply 015)",
  );
  await pool.end();
  process.exit(0);
}

const allowReauth = async () => ({ allowed: true, reason: "reauthorized" });
const denyReauth = async () => ({
  allowed: false,
  reason: "role_binding_missing",
});

const correlationId = randomUUID();
const ownerId = randomUUID();
const fields = [
  { id: "name", headerFa: "نام", dataCategory: "identity.person" as const },
  {
    id: "secret",
    headerFa: "حساس",
    dataCategory: "demo.sensitive_hr" as const,
  },
];
const filters = { asOf: "2026-07-26", reportKey: "active_persons" };
const reviewedHash = computeExportSnapshotHash({
  sourceSurface: "report",
  sourceKey: "active_persons",
  filters,
  fieldIds: fields.map((f) => f.id),
  asOf: "2026-07-26",
});

/** Happy path: generate → ack → download → retrieval row */
{
  const created = await createExportArtifact(pool, {
    ownerAccountId: ownerId,
    purpose: "selfcheck.export",
    sourceSurface: "report",
    sourceKey: "active_persons",
    filtersSnapshot: filters,
    reviewedSnapshotHash: reviewedHash,
    asOf: "2026-07-26",
    format: "csv",
    fields,
    rows: [
      {
        id: "p1",
        cells: { name: "علی", secret: "=HACK", team: null },
      },
    ],
    categoryRegistry: demoCategories,
    holdsCategoryExport: () => false,
    reauth: allowReauth,
    correlationId,
  });
  assert.equal(created.artifact.state, "ready");
  assert.deepEqual(created.omittedSensitiveIds, ["secret"]);
  assert.equal(created.artifact.fieldIds.includes("secret"), false);
  assert.ok(created.artifact.contentFilename);

  /** Missing custody when required — force sensitive path for ack gate */
  const sensitiveHash = computeExportSnapshotHash({
    sourceSurface: "report",
    sourceKey: "active_persons",
    filters,
    fieldIds: ["secret"],
    asOf: "2026-07-26",
  });
  const sensitiveCreated = await createExportArtifact(pool, {
    ownerAccountId: ownerId,
    purpose: "selfcheck.sensitive",
    sourceSurface: "report",
    sourceKey: "active_persons",
    filtersSnapshot: filters,
    reviewedSnapshotHash: sensitiveHash,
    asOf: "2026-07-26",
    format: "csv",
    fields: [fields[1]!],
    rows: [{ id: "p1", cells: { secret: "x" } }],
    categoryRegistry: demoCategories,
    holdsCategoryExport: () => true,
    reauth: allowReauth,
    correlationId: randomUUID(),
  });
  assert.equal(sensitiveCreated.artifact.requiresCustodyAck, true);

  let custodyThrown = false;
  try {
    await downloadExportArtifact(pool, {
      artifactId: sensitiveCreated.artifact.id,
      retrieverAccountId: ownerId,
      recipient: "selfcheck-recipient",
      destinationClass: "local_download",
      custodyAck: false,
      reauth: allowReauth,
      correlationId: randomUUID(),
    });
  } catch (err) {
    custodyThrown = true;
    assert.ok(err instanceof ExportError);
    assert.equal(err.code, "CUSTODY_ACK_REQUIRED");
  }
  assert.equal(custodyThrown, true);

  const downloaded = await downloadExportArtifact(pool, {
    artifactId: sensitiveCreated.artifact.id,
    retrieverAccountId: ownerId,
    recipient: "selfcheck-recipient",
    destinationClass: "local_download",
    custodyAck: true,
    reauth: allowReauth,
    correlationId: randomUUID(),
  });
  assert.ok(downloaded.contentBytes.length > 0);
  const retrievals = await listRetrievalsForArtifact(
    pool,
    sensitiveCreated.artifact.id,
  );
  assert.ok(retrievals.some((r) => r.reauthOutcome === "allowed"));

  /** Reauth failure at download → deny */
  const singleHash = computeExportSnapshotHash({
    sourceSurface: "report",
    sourceKey: "active_persons",
    filters,
    fieldIds: ["name"],
    asOf: "2026-07-26",
  });
  const forReauthFail2 = await createExportArtifact(pool, {
    ownerAccountId: ownerId,
    purpose: "selfcheck.reauth-fail",
    sourceSurface: "report",
    sourceKey: "active_persons",
    filtersSnapshot: filters,
    reviewedSnapshotHash: singleHash,
    asOf: "2026-07-26",
    format: "csv",
    fields: [fields[0]!],
    rows: [{ id: "p1", cells: { name: "علی" } }],
    categoryRegistry: demoCategories,
    holdsCategoryExport: () => false,
    reauth: allowReauth,
    correlationId: randomUUID(),
  });
  let reauthThrown = false;
  try {
    await downloadExportArtifact(pool, {
      artifactId: forReauthFail2.artifact.id,
      retrieverAccountId: ownerId,
      recipient: "x",
      destinationClass: "local_download",
      custodyAck: false,
      reauth: denyReauth,
      correlationId: randomUUID(),
    });
  } catch (err) {
    reauthThrown = true;
    assert.ok(err instanceof ExportError);
    assert.equal(err.code, "REAUTH_FAILED");
  }
  assert.equal(reauthThrown, true);
  const revoked = await getExportArtifactById(pool, forReauthFail2.artifact.id);
  assert.equal(revoked?.state, "revoked");

  /** Snapshot mismatch */
  let mismatchThrown = false;
  try {
    await createExportArtifact(pool, {
      ownerAccountId: ownerId,
      purpose: "tamper",
      sourceSurface: "report",
      sourceKey: "active_persons",
      filtersSnapshot: filters,
      reviewedSnapshotHash: "deadbeef",
      asOf: "2026-07-26",
      format: "csv",
      fields: [fields[0]!],
      rows: [{ id: "p1", cells: { name: "x" } }],
      categoryRegistry: demoCategories,
      holdsCategoryExport: () => false,
      reauth: allowReauth,
      correlationId: randomUUID(),
    });
  } catch (err) {
    mismatchThrown = true;
    assert.ok(err instanceof ExportError);
    assert.equal(err.code, "SNAPSHOT_MISMATCH");
  }
  assert.equal(mismatchThrown, true);

  /** Expired / revoked deny */
  const shortLived = await createExportArtifact(pool, {
    ownerAccountId: ownerId,
    purpose: "ttl",
    sourceSurface: "personnel_list",
    sourceKey: null,
    filtersSnapshot: { q: "" },
    reviewedSnapshotHash: computeExportSnapshotHash({
      sourceSurface: "personnel_list",
      sourceKey: null,
      filters: { q: "" },
      fieldIds: ["name"],
      asOf: "2026-07-26",
    }),
    asOf: "2026-07-26",
    format: "csv",
    fields: [fields[0]!],
    rows: [{ id: "p1", cells: { name: "x" } }],
    categoryRegistry: demoCategories,
    holdsCategoryExport: () => false,
    reauth: allowReauth,
    correlationId: randomUUID(),
    ttlMs: 1,
  });
  await new Promise((r) => setTimeout(r, 5));
  let expiredThrown = false;
  try {
    await downloadExportArtifact(pool, {
      artifactId: shortLived.artifact.id,
      retrieverAccountId: ownerId,
      recipient: "x",
      destinationClass: "local_download",
      custodyAck: false,
      reauth: allowReauth,
      correlationId: randomUUID(),
    });
  } catch (err) {
    expiredThrown = true;
    assert.ok(err instanceof ExportError);
    assert.equal(err.code, "ARTIFACT_EXPIRED");
  }
  assert.equal(expiredThrown, true);

  const toRevoke = await createExportArtifact(pool, {
    ownerAccountId: ownerId,
    purpose: "revoke",
    sourceSurface: "personnel_list",
    filtersSnapshot: { q: "" },
    reviewedSnapshotHash: computeExportSnapshotHash({
      sourceSurface: "personnel_list",
      sourceKey: null,
      filters: { q: "" },
      fieldIds: ["name"],
      asOf: "2026-07-26",
    }),
    asOf: "2026-07-26",
    format: "xlsx",
    fields: [fields[0]!],
    rows: [{ id: "p1", cells: { name: "+cmd" } }],
    categoryRegistry: demoCategories,
    holdsCategoryExport: () => false,
    reauth: allowReauth,
    correlationId: randomUUID(),
  });
  await revokeExportArtifact(pool, {
    artifactId: toRevoke.artifact.id,
    actorAccountId: ownerId,
    correlationId: randomUUID(),
  });
  let revokedThrown = false;
  try {
    await downloadExportArtifact(pool, {
      artifactId: toRevoke.artifact.id,
      retrieverAccountId: ownerId,
      recipient: "x",
      destinationClass: "local_download",
      custodyAck: false,
      reauth: allowReauth,
      correlationId: randomUUID(),
    });
  } catch (err) {
    revokedThrown = true;
    assert.ok(err instanceof ExportError);
    assert.equal(err.code, "ARTIFACT_REVOKED");
  }
  assert.equal(revokedThrown, true);

  /** Create-time reauth deny */
  let createReauthThrown = false;
  try {
    await createExportArtifact(pool, {
      ownerAccountId: ownerId,
      purpose: "create-reauth",
      sourceSurface: "report",
      sourceKey: "active_persons",
      filtersSnapshot: filters,
      reviewedSnapshotHash: singleHash,
      asOf: "2026-07-26",
      format: "csv",
      fields: [fields[0]!],
      rows: [{ id: "p1", cells: { name: "x" } }],
      categoryRegistry: demoCategories,
      holdsCategoryExport: () => false,
      reauth: denyReauth,
      correlationId: randomUUID(),
    });
  } catch (err) {
    createReauthThrown = true;
    assert.ok(err instanceof ExportError);
    assert.equal(err.code, "REAUTH_FAILED");
  }
  assert.equal(createReauthThrown, true);
}

console.log("export-artifact DB path: ok");
await pool.end();
