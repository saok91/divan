/**
 * Day-to-day bulk commit selfcheck (Story 9.2).
 * Run: pnpm --filter @divan/migration selfcheck:day-to-day-bulk
 *
 * Proves: operator with person.write (no migration SoD) can commit;
 * concurrent lock still blocks; migration approve≠execute SoD still holds.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPgPool, createPrismaClient } from "@divan/db";
import { config as loadEnv } from "dotenv";

import {
  MSG_CONCURRENT_BATCH_FA,
  MSG_SOD_SAME_ACTOR_FA,
  assertApproveExecuteSegregation,
  buildImportPreviewBatch,
  clearImportPreviewDraftStore,
  commitDayToDayBulk,
  confirmImportPreviewDraft,
  executeImportBatch,
  formatImportIssueCite,
  getStoredDraftForStaging,
  parseCsvBuffer,
  promoteConfirmedDraftToStaging,
  approveStagingBatch,
  validateImportMatrix,
} from "./index";

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
  "کد تیم",
  "کد نقش سازمانی",
  "کد عنوان شغلی",
  "کد نردبان",
  "کد گرید",
  "کد ارشدیت",
];

function csvLine(cells: string[]): string {
  return cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(",");
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required for day-to-day-bulk selfcheck");

  const pool = createPgPool(url);
  const prisma = createPrismaClient(url);

  try {
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

    const teamCode = team!.code;
    const roleCode = role!.code;
    const jobCode = job!.code;
    const ladderCode = ladder!.code;
    const gradeCode = grade!.code;

    const suffix = randomUUID().slice(0, 8);
    const code1 = `D${suffix.slice(0, 7)}`;
    const operator = `op-day-${suffix}`;

    /** Operator-shaped holder: person.write only — no migration SoD. */
    const operatorHolder = {
      holds: async (p: string) => p === "person.write",
    };

    const goodRow = [
      code1,
      "روزمره",
      "آزمایشی",
      "09123334455",
      "",
      "",
      "",
      "",
      "2026-02-01",
      "employee",
      teamCode,
      roleCode,
      jobCode,
      ladderCode,
      gradeCode,
      "",
    ];
    const csv = [csvLine(headers), csvLine(goodRow)].join("\n");
    const parsed = await parseCsvBuffer(
      Buffer.from(csv, "utf8"),
      templateKey,
      "day.csv",
    );

    // Preview cite honesty — subject business code present
    const citeParsed = await parseCsvBuffer(
      Buffer.from(
        [
          csvLine(headers),
          csvLine([
            code1,
            "",
            "خانوادگی",
            "09120000000",
            "",
            "",
            "",
            "",
            "2026-02-01",
            "employee",
            teamCode,
            roleCode,
            jobCode,
            ladderCode,
            gradeCode,
            "",
          ]),
        ].join("\n"),
        "utf8",
      ),
      templateKey,
      "cite.csv",
    );
    const issues = validateImportMatrix(citeParsed);
    const errorIssue = issues.find((i) => i.severity === "error");
    assert.ok(errorIssue, "expected validation error for empty givenName");
    const cite = formatImportIssueCite(errorIssue!);
    assert.ok(cite.includes(`ردیف ${errorIssue!.row}`));
    assert.ok(cite.includes(errorIssue!.columnCaptionFa));
    assert.ok(cite.includes(`موضوع ${code1}`));
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(cite));

    clearImportPreviewDraftStore();
    const preview = buildImportPreviewBatch(parsed, {
      permittedDataCategories: new Set(["identity.person"]),
      createdByAccountId: operator,
    });
    assert.equal(preview.errorCount, 0);

    confirmImportPreviewDraft(preview.previewBatchId, operator);
    const stored = getStoredDraftForStaging(preview.previewBatchId);
    assert.ok(stored);

    const staging = await promoteConfirmedDraftToStaging(pool, {
      preview: stored!.batch,
      fullRows: stored!.fullRows,
      uploadedByAccountId: operator,
      ownerDisplayName: "Day Operator",
      sourceFileName: "day.csv",
    });
    assert.equal(staging.status, "confirmed-draft");

    // Denied without create permission
    let denied = false;
    try {
      await commitDayToDayBulk(pool, {
        batchId: staging.id,
        actorAccountId: operator,
        actorDisplayName: "Denied",
        permissionHolder: { holds: async () => false },
      });
    } catch (err) {
      denied = true;
      assert.equal((err as { code: string }).code, "PERMISSION_DENIED");
    }
    assert.equal(denied, true);

    // Happy path — person.write only, no migration.approve/execute
    const commit = await commitDayToDayBulk(pool, {
      batchId: staging.id,
      actorAccountId: operator,
      actorDisplayName: "Day Operator",
      permissionHolder: operatorHolder,
    });
    assert.equal(commit.idempotentReplay, false);
    assert.equal(commit.batch.status, "cutover-complete");
    assert.equal(commit.created, 1);
    assert.equal(commit.updated, 0);
    assert.equal(commit.rejected, 0);
    assert.ok(commit.correlationId);

    // Idempotent replay preserves counts
    const replay = await commitDayToDayBulk(pool, {
      batchId: staging.id,
      actorAccountId: operator,
      permissionHolder: operatorHolder,
    });
    assert.equal(replay.idempotentReplay, true);
    assert.equal(replay.created, 1);
    assert.equal(replay.updated, 0);
    assert.equal(replay.rejected, 0);

    // Concurrent lock still blocks a second day-to-day commit on overlapping code
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
        operator,
        "Holder",
        staging.correlationId,
      ],
    );

    const overlapRow = [...goodRow];
    overlapRow[0] = code1;
    const csv2 = [csvLine(headers), csvLine(overlapRow)].join("\n");
    const parsed2 = await parseCsvBuffer(
      Buffer.from(csv2, "utf8"),
      templateKey,
      "day2.csv",
    );
    clearImportPreviewDraftStore();
    const preview2 = buildImportPreviewBatch(parsed2, {
      permittedDataCategories: new Set(["identity.person"]),
      createdByAccountId: operator,
    });
    confirmImportPreviewDraft(preview2.previewBatchId, operator);
    const stored2 = getStoredDraftForStaging(preview2.previewBatchId)!;
    const staging2 = await promoteConfirmedDraftToStaging(pool, {
      preview: stored2.batch,
      fullRows: stored2.fullRows,
      uploadedByAccountId: operator,
      ownerDisplayName: "Day Operator 2",
    });

    let concurrentBlocked = false;
    try {
      await commitDayToDayBulk(pool, {
        batchId: staging2.id,
        actorAccountId: operator,
        actorDisplayName: "Day Operator 2",
        permissionHolder: operatorHolder,
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

    // Migration SoD path still rejects same-actor approve+execute
    const code3 = `F${suffix.slice(0, 7)}`;
    const row3 = [...goodRow];
    row3[0] = code3;
    const csv3 = [csvLine(headers), csvLine(row3)].join("\n");
    const parsed3 = await parseCsvBuffer(
      Buffer.from(csv3, "utf8"),
      templateKey,
      "mig.csv",
    );
    clearImportPreviewDraftStore();
    const preview3 = buildImportPreviewBatch(parsed3, {
      permittedDataCategories: new Set(["identity.person"]),
      createdByAccountId: operator,
    });
    confirmImportPreviewDraft(preview3.previewBatchId, operator);
    const stored3 = getStoredDraftForStaging(preview3.previewBatchId)!;
    const staging3 = await promoteConfirmedDraftToStaging(pool, {
      preview: stored3.batch,
      fullRows: stored3.fullRows,
      uploadedByAccountId: "uploader-mig",
      ownerDisplayName: "Uploader",
    });
    const approved = await approveStagingBatch(pool, {
      batchId: staging3.id,
      approverAccountId: "approver-mig",
      ownerDisplayName: "Approver",
      segregationOn: true,
    });
    assert.equal(approved.status, "approved");

    let sodBlocked = false;
    try {
      assertApproveExecuteSegregation({
        approvedByAccountId: "approver-mig",
        executorAccountId: "approver-mig",
        segregationOn: true,
      });
    } catch (err) {
      sodBlocked = true;
      assert.equal((err as { code: string }).code, "SOD_VIOLATION");
      assert.equal(
        (err as { messageFa: string }).messageFa,
        MSG_SOD_SAME_ACTOR_FA,
      );
    }
    assert.equal(sodBlocked, true);

    let execSodBlocked = false;
    try {
      await executeImportBatch(pool, {
        batchId: staging3.id,
        executorAccountId: "approver-mig",
        permissionHolder: { holds: async () => true },
        segregationOn: true,
        cutoverTier: "trial",
      });
    } catch (err) {
      execSodBlocked = true;
      assert.equal((err as { code: string }).code, "SOD_VIOLATION");
    }
    assert.equal(execSodBlocked, true);

    // Matched (updated) count: existing personnel code → updated
    const matchRow = [...goodRow];
    matchRow[0] = code1;
    matchRow[1] = "به‌روز";
    const csvMatch = [csvLine(headers), csvLine(matchRow)].join("\n");
    const parsedMatch = await parseCsvBuffer(
      Buffer.from(csvMatch, "utf8"),
      templateKey,
      "match.csv",
    );
    clearImportPreviewDraftStore();
    const previewMatch = buildImportPreviewBatch(parsedMatch, {
      permittedDataCategories: new Set(["identity.person"]),
      createdByAccountId: operator,
    });
    confirmImportPreviewDraft(previewMatch.previewBatchId, operator);
    const storedMatch = getStoredDraftForStaging(previewMatch.previewBatchId)!;
    const stagingMatch = await promoteConfirmedDraftToStaging(pool, {
      preview: storedMatch.batch,
      fullRows: storedMatch.fullRows,
      uploadedByAccountId: operator,
      ownerDisplayName: "Day Operator Match",
    });
    const matchCommit = await commitDayToDayBulk(pool, {
      batchId: stagingMatch.id,
      actorAccountId: operator,
      permissionHolder: operatorHolder,
    });
    assert.equal(matchCommit.created, 0);
    assert.equal(matchCommit.updated, 1);
    assert.equal(matchCommit.rejected, 0);

    console.log("selfcheck:day-to-day-bulk OK");
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
