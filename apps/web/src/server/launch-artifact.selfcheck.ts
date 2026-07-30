/**
 * Static selfcheck for launch-artifact web wiring (Story 7.7 / FR-55).
 * Run: pnpm --filter @divan/web selfcheck:launch-artifact
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const rootSrc = readFileSync(join(here, "root.ts"), "utf8");
const routerSrc = readFileSync(join(here, "launch-artifact.ts"), "utf8");
const panelSrc = readFileSync(
  join(here, "../../components/operations/launch-artifact-panel.tsx"),
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
  join(
    here,
    "../../../../packages/db/sql/020_launch_artifact_change_control.sql",
  ),
  "utf8",
);
const seedSrc = readFileSync(
  join(
    here,
    "../../../../packages/modules/identity-access/src/seed-launch-artifact.ts",
  ),
  "utf8",
);

assert.match(rootSrc, /launchArtifact:\s*launchArtifactRouter/);
assert.match(routerSrc, /listArtifacts:\s*governedProcedure/);
assert.match(routerSrc, /getControlling:\s*governedProcedure/);
assert.match(routerSrc, /createVersion:\s*governedProcedure/);
assert.match(routerSrc, /approveVersion:\s*governedProcedure/);
assert.match(routerSrc, /issueWaiver:\s*governedProcedure/);
assert.match(routerSrc, /closeWaiver:\s*governedProcedure/);
assert.match(routerSrc, /openConflict:\s*governedProcedure/);
assert.match(routerSrc, /resolveConflict:\s*governedProcedure/);
assert.match(routerSrc, /requireRebaseline:\s*governedProcedure/);
assert.match(routerSrc, /approveRebaseline:\s*governedProcedure/);
assert.match(routerSrc, /capabilities:\s*governedProcedure/);
assert.match(routerSrc, /sensitive:\s*true/);
assert.match(routerSrc, /launch\.artifact\./);
assert.doesNotMatch(routerSrc, /error\.message(?!Fa)/);

assert.match(panelSrc, /launchArtifactHeading/);
assert.match(panelSrc, /LaunchArtifactPanel/);
assert.match(panelSrc, /toPersianDigits/);
assert.match(pageSrc, /LaunchArtifactPanel/);
assert.match(pageSrc, /assertPageAccess/);

assert.match(copySrc, /launchArtifactHeading/);
assert.match(copySrc, /ثبت آرتیفکت‌های پرتاب/);
assert.match(copySrc, /معافیت/);
assert.match(copySrc, /بازپایه/);

assert.match(sqlSrc, /governance\.launch_artifact/);
assert.match(sqlSrc, /forbid_launch_artifact_delete/);
assert.match(sqlSrc, /forbid_approved_version_rewrite/);
assert.match(sqlSrc, /controlling_artifact_versions/);

assert.match(seedSrc, /hr\.admin/);
assert.match(seedSrc, /launch\.artifact\.read/);
assert.match(seedSrc, /do NOT auto-grant to audit\.investigate/);
assert.doesNotMatch(
  seedSrc,
  /permissions\s*=\s*\[[^\]]*audit\.investigate/s,
);

console.log("launch-artifact web static selfcheck: ok");
