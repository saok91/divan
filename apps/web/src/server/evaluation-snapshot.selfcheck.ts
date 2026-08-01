/**
 * Static selfcheck for evaluation-snapshot web wiring (Story 7.8 / FR-56).
 * Run: pnpm --filter @divan/web selfcheck:evaluation-snapshot
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const rootSrc = readFileSync(join(here, "root.ts"), "utf8");
const routerSrc = readFileSync(join(here, "evaluation-snapshot.ts"), "utf8");
const personSrc = readFileSync(join(here, "person.ts"), "utf8");
const searchSrc = readFileSync(
  join(here, "personnel-scoped-search.ts"),
  "utf8",
);
const honestySrc = readFileSync(
  join(here, "../../components/operations/evaluation-snapshot-honesty.tsx"),
  "utf8",
);
const pageSrc = readFileSync(
  join(here, "../../app/(app)/operations/page.tsx"),
  "utf8",
);
const copySrc = readFileSync(
  join(here, "../../lib/operational-copy.ts"),
  "utf8",
);
const sqlSrc = readFileSync(
  join(here, "../../../../packages/db/sql/021_evaluation_snapshots.sql"),
  "utf8",
);
const seedSrc = readFileSync(
  join(
    here,
    "../../../../packages/modules/identity-access/src/seed-evaluation-snapshot.ts",
  ),
  "utf8",
);
const finalizeSrc = readFileSync(
  join(
    here,
    "../../../../packages/modules/person-employment/src/personnel-event-finalize.ts",
  ),
  "utf8",
);
const executeSrc = readFileSync(
  join(
    here,
    "../../../../packages/modules/migration/src/execute-batch.ts",
  ),
  "utf8",
);
const exportSrc = readFileSync(
  join(
    here,
    "../../../../packages/modules/reporting/src/export-artifact.ts",
  ),
  "utf8",
);
const publicationSrc = readFileSync(
  join(
    here,
    "../../../../packages/modules/reporting/src/decision-publication.ts",
  ),
  "utf8",
);
const envelopeIndex = readFileSync(
  join(
    here,
    "../../../../packages/kernel/audit-envelope/src/index.ts",
  ),
  "utf8",
);

assert.match(rootSrc, /evaluationSnapshot:\s*evaluationSnapshotRouter/);
assert.match(routerSrc, /capabilities:\s*governedProcedure/);
assert.match(routerSrc, /get:\s*governedProcedure/);
assert.match(routerSrc, /listRecent:\s*governedProcedure/);
assert.match(routerSrc, /integritySignals:\s*governedProcedure/);
assert.match(routerSrc, /sensitive:\s*true/);
assert.match(routerSrc, /evaluation\.snapshot\./);
assert.doesNotMatch(routerSrc, /error\.message(?!Fa)/);

assert.match(personSrc, /evaluationSnapshotId/);
assert.match(searchSrc, /beginEvaluationSnapshot/);
assert.match(searchSrc, /kind:\s*["']pagination["']/);
assert.match(searchSrc, /pageSize/);
assert.match(searchSrc, /permissionFingerprint/);
assert.match(searchSrc, /EVAL_SNAPSHOT_REF_CHANGED/);
assert.doesNotMatch(
  searchSrc,
  /Soft-fail \(\§6\): a bind failure must not block/,
);

const eventSearchSrc = readFileSync(
  join(here, "./personnel-event-search.ts"),
  "utf8",
);
assert.match(eventSearchSrc, /beginEvaluationSnapshot/);
assert.match(eventSearchSrc, /kind:\s*["']pagination["']/);
assert.match(eventSearchSrc, /EVAL_SNAPSHOT_REF_CHANGED/);
assert.match(eventSearchSrc, /personnel_event_search/);

const panelSrc = readFileSync(
  join(here, "../../components/personnel/personnel-list-panel.tsx"),
  "utf8",
);
assert.match(panelSrc, /evaluationSnapshotId/);
assert.match(panelSrc, /pageSize/);
assert.match(panelSrc, /channel:\s*["']list["']/);

assert.match(honestySrc, /EvaluationSnapshotHonestyLine/);
assert.match(honestySrc, /evaluationSnapshotHonestyHeading/);
assert.match(honestySrc, /toPersianDigits/);
assert.match(pageSrc, /EvaluationSnapshotHonestyLine/);
assert.match(pageSrc, /assertPageAccess/);

assert.match(copySrc, /evaluationSnapshotHonestyHeading/);
assert.match(copySrc, /اسنپ‌شات ارزیابی/);
assert.match(copySrc, /evaluationSnapshotVersionMix/);

assert.match(sqlSrc, /governance\.evaluation_snapshot/);
assert.match(sqlSrc, /forbid_evaluation_snapshot_delete/);
assert.match(sqlSrc, /guard_evaluation_snapshot_update/);
assert.match(sqlSrc, /evaluation_snapshot_id/);

assert.match(seedSrc, /hr\.admin/);
assert.match(seedSrc, /evaluation\.snapshot\.read/);
assert.match(seedSrc, /do NOT auto-grant to audit\.investigate/);
assert.doesNotMatch(
  seedSrc,
  /permissions\s*=\s*\[[^\]]*audit\.investigate/s,
);

assert.match(finalizeSrc, /beginEvaluationSnapshot/);
assert.match(finalizeSrc, /kind:\s*["']finalize["']/);
assert.match(finalizeSrc, /persist:\s*false/);

assert.match(executeSrc, /beginEvaluationSnapshot/);
assert.match(executeSrc, /import_execution/);
assert.match(executeSrc, /revalidateEvaluationSnapshot/);
assert.match(executeSrc, /revalidateAuthoritativeReferences/);
assert.match(executeSrc, /FOR UPDATE/);
assert.match(executeSrc, /markEvaluationSnapshotTerminal|liveFingerprint/);

assert.match(exportSrc, /beginEvaluationSnapshot/);
assert.match(exportSrc, /kind:\s*["']export["']/);
assert.match(exportSrc, /stableStringify/);
assert.match(exportSrc, /markEvaluationSnapshotTerminal/);

assert.match(publicationSrc, /beginEvaluationSnapshot/);
assert.match(publicationSrc, /kind:\s*["']publication["']/);
assert.match(publicationSrc, /fail-closed/);
assert.match(publicationSrc, /stableStringify/);
assert.match(publicationSrc, /markEvaluationSnapshotTerminal/);
assert.doesNotMatch(
  publicationSrc,
  /function stableStringify\(/,
);

assert.match(envelopeIndex, /beginEvaluationSnapshot/);
assert.match(envelopeIndex, /EVALUATION_SNAPSHOT_READ_PERMISSION/);

console.log("evaluation-snapshot web static selfcheck: ok");
