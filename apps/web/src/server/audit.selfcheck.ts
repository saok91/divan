/**
 * Web smoke for audit investigation copy + surface contracts (Story 7.1).
 * Run: pnpm --filter @divan/web exec tsx src/server/audit.selfcheck.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MSG_AUDIT_EMPTY_FILTER_FA } from "@divan/audit-envelope";

import { operationalCopy } from "../../lib/operational-copy";

const here = fileURLToPath(new URL(".", import.meta.url));
const auditPage = resolve(here, "../../app/(app)/audit/page.tsx");
const panelPath = resolve(
  here,
  "../../components/audit/audit-investigation-panel.tsx",
);
const rootPath = resolve(here, "./root.ts");
const auditRouterPath = resolve(here, "./audit.ts");

function main() {
  assert.equal(operationalCopy.auditEmptyFilter, "رویدادی با این فیلتر نیست.");
  assert.equal(operationalCopy.auditEmptyFilter, MSG_AUDIT_EMPTY_FILTER_FA);

  const pageSrc = readFileSync(auditPage, "utf8");
  assert.ok(
    pageSrc.includes("AuditInvestigationPanel"),
    "audit page mounts investigation panel",
  );
  assert.ok(
    !pageSrc.includes("PlaceholderPage"),
    "placeholder removed from /audit",
  );
  assert.ok(
    pageSrc.includes("assertPageAccess"),
    "Layout≠RSC assertPageAccess present",
  );

  const panelSrc = readFileSync(panelPath, "utf8");
  assert.ok(panelSrc.includes("GovernedDataTable"));
  assert.ok(panelSrc.includes("auditEmptyFilter"));
  assert.ok(panelSrc.includes("export.download"));
  assert.ok(panelSrc.includes("assertReviewIndependence"));
  assert.ok(panelSrc.includes("evidenceEventId"));
  assert.ok(
    panelSrc.includes("JSON.stringify(draft) !== JSON.stringify(applied)"),
  );
  assert.ok(
    !panelSrc.includes("|| detail !== null"),
    "leave-guard dirty excludes dialog open",
  );
  assert.ok(panelSrc.includes("canOpenExportArtifact"));
  assert.ok(panelSrc.includes("gregorianDateTimePartsToIso"));

  const rootSrc = readFileSync(rootPath, "utf8");
  assert.ok(rootSrc.includes("audit: auditRouter"));

  const routerSrc = readFileSync(auditRouterPath, "utf8");
  assert.ok(routerSrc.includes("audit.investigate"));
  assert.ok(routerSrc.includes('channel: "audit"'));
  assert.ok(routerSrc.includes("getAuditEvidenceById"));
  assert.ok(routerSrc.includes("sanitizeReviewHref") || routerSrc.includes("reviewHref"));
  assert.ok(routerSrc.includes("hasMore"));
  assert.ok(routerSrc.includes("AUDIT_INFERENCE_BULK_EVIDENCE_ONLY_FA"));
  assert.ok(!routerSrc.includes("updateAudit") && !routerSrc.includes(".update("));
  assert.ok(routerSrc.includes("export.getArtifact") === false); // bytes via export router only
  assert.ok(routerSrc.includes("AUDIT_CONSUME_65_ARTIFACT_CONTRACT"));

  console.log("audit web smoke selfcheck: ok");
}

main();
