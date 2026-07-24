/**
 * Import batch staging/cutover selfcheck (Story 6.2).
 * Run: pnpm --filter @divan/migration selfcheck:import-batch
 *
 * Requires DATABASE_URL and applied sql/001…013 (via packages/db sql:apply).
 * Covers: SoD segregation; staging without production events; cutover Baseline;
 * failure zero-trace; concurrent overlap; idempotent repeat; preview non-append.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPgPool, createPrismaClient } from "@divan/db";
import { config as loadEnv } from "dotenv";

import {
  BASELINE_RECORDED_EVENT_TYPE,
  MSG_CONCURRENT_BATCH_FA,
  MSG_SOD_SAME_ACTOR_FA,
  MSG_SOD_UPLOAD_APPROVE_FA,
  assertApproveExecuteSegregation,
  assertNoEventStoreAppendInDrafts,
  assertUploadApproveSegregation,
  assertZeroProductionTrace,
  buildImportPreviewBatch,
  buildOverlapKeys,
  clearImportPreviewDraftStore,
  confirmImportPreviewDraft,
  executeImportBatch,
  formatConcurrentBatchMessage,
  getStoredDraftForStaging,
  parseCsvBuffer,
  promoteConfirmedDraftToStaging,
  approveStagingBatch,
  rollbackImportStaging,
  seedMigrationSodPermissionFixtures,
} from "./index";

import { withTransaction as esWithTransaction } from "@divan/event-store";
import {
  SEED_JOB_REFERENCES,
  SEED_ORGANIZATION_HIERARCHY,
  seedJobReferenceFixtures,
  seedOrganizationHierarchyFixtures,
  seedPersonIdentityFixtures,
} from "@divan/person-employment";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

clearImportPreviewDraftStore();

/** Pure SoD — same actor rejected when segregation on */
let sodThrown = false;
try {
  assertApproveExecuteSegregation({
    approvedByAccountId: "actor-1",
    executorAccountId: "actor-1",
    segregationOn: true,
  });
} catch (err) {
  sodThrown = true;
  assert.ok(err instanceof Error);
  const mig = err as { code?: string; messageFa?: string };
  assert.equal(mig.code, "SOD_VIOLATION");
  assert.equal(mig.messageFa, MSG_SOD_SAME_ACTOR_FA);
}
assert.equal(sodThrown, true);

assertApproveExecuteSegregation({
  approvedByAccountId: "actor-1",
  executorAccountId: "actor-2",
  segregationOn: true,
});

/** Upload ≠ approve SoD */
let uploadApproveThrown = false;
try {
  assertUploadApproveSegregation({
    uploadedByAccountId: "actor-1",
    approverAccountId: "actor-1",
    segregationOn: true,
  });
} catch (err) {
  uploadApproveThrown = true;
  assert.equal((err as { code?: string }).code, "SOD_VIOLATION");
  assert.equal((err as { messageFa?: string }).messageFa, MSG_SOD_UPLOAD_APPROVE_FA);
}
assert.equal(uploadApproveThrown, true);

assertUploadApproveSegregation({
  uploadedByAccountId: "actor-1",
  approverAccountId: "actor-2",
  segregationOn: true,
});

/** Concurrent message shape (UX-DR16) */
const concurrentMsg = formatConcurrentBatchMessage({
  ownerDisplayName: "اپراتور",
  correlationId: "corr-xyz",
});
assert.ok(concurrentMsg.startsWith(MSG_CONCURRENT_BATCH_FA));
assert.ok(concurrentMsg.includes("اپراتور"));
assert.ok(concurrentMsg.includes("corr-xyz"));

assert.deepEqual(
  buildOverlapKeys([
    { rowId: "b", values: { personnelCode: "Z" } },
    { rowId: "a", values: { personnelCode: "A" } },
  ]),
  ["pc:A", "pc:Z"],
);

const templateKey = "person_employment_start";
const headers = [
  "کد پرسنلی",
  "نام",
  "نام خانوادگی",
  "موبایل",
  "نام پدر",
  "تاریخ تولد",
  "جنسیت",
  "ملیت",
  "تاریخ شروع",
  "نوع همکاری",
  "شناسه تیم",
  "شناسه نقش سازمانی",
  "شناسه عنوان شغلی",
  "شناسه نردبان",
  "شناسه گرید",
  "شناسه ارشدیت",
];

function csvLine(cells: string[]): string {
  return cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(",");
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required for import-batch selfcheck");

  const pool = createPgPool(url);
  const prisma = createPrismaClient(url);

  try {
    // Schema present?
    const schemaCheck = await pool.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'migration_staging'`,
    );
    assert.ok(
      schemaCheck.rows.length > 0,
      "migration_staging schema missing — run packages/db sql:apply",
    );

    await seedPersonIdentityFixtures(prisma);
    await seedOrganizationHierarchyFixtures(prisma);
    await seedJobReferenceFixtures(prisma);
    await seedMigrationSodPermissionFixtures(prisma);

    const team = await prisma.organizationalUnit.findUnique({
      where: { code: SEED_ORGANIZATION_HIERARCHY.teamActive.code },
    });
    const role = await prisma.organizationalRole.findUnique({
      where: { code: SEED_JOB_REFERENCES.role.code },
    });
    const job = await prisma.jobTitle.findUnique({
      where: { code: SEED_JOB_REFERENCES.jobTitle.code },
    });
    const ladder = await prisma.ladder.findUnique({
      where: { code: SEED_JOB_REFERENCES.ladder.code },
    });
    const grade = await prisma.grade.findFirst({
      where: {
        ladderId: ladder?.id,
        code: SEED_JOB_REFERENCES.gradeLow.code,
      },
    });
    assert.ok(team && role && job && ladder && grade, "seed refs missing");

    const teamId = team!.id;
    const roleId = role!.id;
    const jobId = job!.id;
    const ladderId = ladder!.id;
    const gradeId = grade!.id;

    const suffix = randomUUID().slice(0, 8);
    const code1 = `M${suffix.slice(0, 7)}`;
    const uploader = `upload-${suffix}`;
    const approver = `approve-${suffix}`;
    const executor = `execute-${suffix}`;

    const goodRow = [
      code1,
      "مهاجر",
      "آزمایشی",
      "09121112233",
      "",
      "",
      "",
      "",
      "2026-01-15",
      "employee",
      teamId,
      roleId,
      jobId,
      ladderId,
      gradeId,
      "",
    ];
    const csv = [csvLine(headers), csvLine(goodRow)].join("\n");
    const parsed = await parseCsvBuffer(
      Buffer.from(csv, "utf8"),
      templateKey,
      "batch.csv",
    );

    clearImportPreviewDraftStore();
    const preview = buildImportPreviewBatch(parsed, {
      permittedDataCategories: new Set(["identity.person"]),
      createdByAccountId: uploader,
    });
    assert.equal(preview.executionAllowed, false);
    assert.equal(preview.eventStoreAppended, false);
    assertNoEventStoreAppendInDrafts();

    confirmImportPreviewDraft(preview.previewBatchId, uploader);
    const stored = getStoredDraftForStaging(preview.previewBatchId);
    assert.ok(stored);

    const staging = await promoteConfirmedDraftToStaging(pool, {
      preview: stored!.batch,
      fullRows: stored!.fullRows,
      uploadedByAccountId: uploader,
      ownerDisplayName: "Uploader",
      sourceFileName: "batch.csv",
    });
    assert.equal(staging.status, "confirmed-draft");
    assert.ok(staging.rows.length >= 1);

    // Staging write must leave zero production events for correlation
    await esWithTransaction(pool, async (client) => {
      await assertZeroProductionTrace(client, staging.correlationId);
    });

    // Same-actor upload+approve rejected
    let uploadApproveBlocked = false;
    try {
      await approveStagingBatch(pool, {
        batchId: staging.id,
        approverAccountId: uploader,
        ownerDisplayName: "Uploader",
        segregationOn: true,
      });
    } catch (err) {
      uploadApproveBlocked = true;
      assert.equal((err as { code: string }).code, "SOD_VIOLATION");
    }
    assert.equal(uploadApproveBlocked, true);

    const approved = await approveStagingBatch(pool, {
      batchId: staging.id,
      approverAccountId: approver,
      ownerDisplayName: "Approver",
    });
    assert.equal(approved.status, "approved");
    assert.equal(approved.payloadFrozen, true);

    // Same-actor execute rejected
    let sameActorBlocked = false;
    try {
      await executeImportBatch(pool, {
        batchId: staging.id,
        executorAccountId: approver,
        permissionHolder: { holds: async () => true },
        segregationOn: true,
        cutoverTier: "trial",
      });
    } catch (err) {
      sameActorBlocked = true;
      assert.equal((err as { code: string }).code, "SOD_VIOLATION");
    }
    assert.equal(sameActorBlocked, true);

    const cutover = await executeImportBatch(pool, {
      batchId: staging.id,
      executorAccountId: executor,
      executorDisplayName: "Executor",
      permissionHolder: { holds: async () => true },
      segregationOn: true,
      cutoverTier: "trial",
    });
    assert.equal(cutover.idempotentReplay, false);
    assert.equal(cutover.batch.status, "cutover-complete");
    assert.equal(cutover.evidence.status, "cutover-complete");
    assert.ok(cutover.evidence.createdEventIds.length >= 1);
    assert.ok(cutover.evidence.createdRecordIds.length >= 1);

    const events = await pool.query(
      `SELECT event_type, correlation_id FROM kernel_events
       WHERE id = $1::uuid AND event_class = 'business'`,
      [cutover.evidence.createdEventIds[0]],
    );
    assert.equal(events.rows[0]?.event_type, BASELINE_RECORDED_EVENT_TYPE);
    assert.equal(
      String(events.rows[0]?.correlation_id),
      staging.correlationId,
    );

    // Idempotent repeat — no duplicate events
    const eventCountBefore = await pool.query(
      `SELECT COUNT(*)::int AS c FROM kernel_events
       WHERE correlation_id = $1::uuid AND event_class = 'business'`,
      [staging.correlationId],
    );
    const replay = await executeImportBatch(pool, {
      batchId: staging.id,
      executorAccountId: executor,
      permissionHolder: { holds: async () => true },
      segregationOn: true,
      cutoverTier: "trial",
    });
    assert.equal(replay.idempotentReplay, true);
    const eventCountAfter = await pool.query(
      `SELECT COUNT(*)::int AS c FROM kernel_events
       WHERE correlation_id = $1::uuid AND event_class = 'business'`,
      [staging.correlationId],
    );
    assert.equal(
      Number(eventCountAfter.rows[0]?.c),
      Number(eventCountBefore.rows[0]?.c),
    );

    // Concurrent overlap: hold key then attempt second batch with same personnel code
    await pool.query(
      `INSERT INTO migration_staging.execution_overlap_key (
         overlap_key, batch_id, owner_account, owner_display, correlation_id
       ) VALUES ($1, $2::uuid, $3, $4, $5::uuid)
       ON CONFLICT (overlap_key) DO UPDATE
         SET batch_id = EXCLUDED.batch_id,
             owner_account = EXCLUDED.owner_account,
             owner_display = EXCLUDED.owner_display,
             correlation_id = EXCLUDED.correlation_id`,
      [
        `pc:${code1}`,
        staging.id,
        executor,
        "Holder",
        staging.correlationId,
      ],
    );

    const row2 = [...goodRow];
    row2[0] = code1; // same code → overlap
    const csv2 = [csvLine(headers), csvLine(row2)].join("\n");
    const parsed2 = await parseCsvBuffer(
      Buffer.from(csv2, "utf8"),
      templateKey,
      "batch2.csv",
    );
    clearImportPreviewDraftStore();
    const preview2 = buildImportPreviewBatch(parsed2, {
      permittedDataCategories: new Set(["identity.person"]),
      createdByAccountId: uploader,
    });
    confirmImportPreviewDraft(preview2.previewBatchId, uploader);
    const stored2 = getStoredDraftForStaging(preview2.previewBatchId)!;
    const staging2 = await promoteConfirmedDraftToStaging(pool, {
      preview: stored2.batch,
      fullRows: stored2.fullRows,
      uploadedByAccountId: uploader,
      ownerDisplayName: "Uploader2",
    });
    await approveStagingBatch(pool, {
      batchId: staging2.id,
      approverAccountId: approver,
      ownerDisplayName: "Approver",
    });

    let concurrentBlocked = false;
    try {
      await executeImportBatch(pool, {
        batchId: staging2.id,
        executorAccountId: executor,
        executorDisplayName: "Executor2",
        permissionHolder: { holds: async () => true },
        segregationOn: true,
        cutoverTier: "trial",
      });
    } catch (err) {
      concurrentBlocked = true;
      assert.equal((err as { code: string }).code, "CONCURRENT_BATCH");
      assert.ok(
        String((err as { messageFa: string }).messageFa).includes(
          MSG_CONCURRENT_BATCH_FA,
        ),
      );
    }
    assert.equal(concurrentBlocked, true);

    await pool.query(
      `DELETE FROM migration_staging.execution_overlap_key WHERE overlap_key = $1`,
      [`pc:${code1}`],
    );

    // Pre-cutover rollback path on a fresh third batch
    const code3 = `P${suffix.slice(0, 7)}`;
    const row3 = [...goodRow];
    row3[0] = code3;
    const csv3 = [csvLine(headers), csvLine(row3)].join("\n");
    const parsed3 = await parseCsvBuffer(
      Buffer.from(csv3, "utf8"),
      templateKey,
      "batch3.csv",
    );
    clearImportPreviewDraftStore();
    const preview3 = buildImportPreviewBatch(parsed3, {
      permittedDataCategories: new Set(["identity.person"]),
      createdByAccountId: uploader,
    });
    confirmImportPreviewDraft(preview3.previewBatchId, uploader);
    const stored3 = getStoredDraftForStaging(preview3.previewBatchId)!;
    const staging3 = await promoteConfirmedDraftToStaging(pool, {
      preview: stored3.batch,
      fullRows: stored3.fullRows,
      uploadedByAccountId: uploader,
    });
    const rolled = await rollbackImportStaging(pool, { batchId: staging3.id });
    assert.equal(rolled.batch.status, "rolled-back");
    assert.equal(rolled.evidence.status, "rolled-back");
    await esWithTransaction(pool, async (client) => {
      await assertZeroProductionTrace(client, staging3.correlationId);
    });

    // Preview paths still never claim event-store append
    assertNoEventStoreAppendInDrafts();

    console.log("selfcheck:import-batch OK");
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
