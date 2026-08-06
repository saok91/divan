/**
 * Web smoke for operations health surface (Story 7.2).
 * Run: pnpm --filter @divan/web selfcheck:operations
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MSG_OPS_HEALTH_DENIED_FA,
  OPS_HEALTH_READ_PERMISSION,
  OPS_PLATFORM_DATA_CATEGORY,
  opsHealthDtoContainsForbiddenKeys,
} from "@divan/audit-envelope";
import { MSG_LDAP_UNAVAILABLE } from "@divan/identity-access";

import { operationalCopy } from "../../lib/operational-copy";

const here = fileURLToPath(new URL(".", import.meta.url));
const opsPage = resolve(here, "../../app/(app)/operations/page.tsx");
const panelPath = resolve(
  here,
  "../../components/operations/operations-health-panel.tsx",
);
const rootPath = resolve(here, "./root.ts");
const opsRouterPath = resolve(here, "./operations.ts");
const healthRoute = resolve(here, "../../app/api/health/route.ts");
const platformStatusPath = resolve(here, "./platform-status.ts");

function main() {
  assert.equal(operationalCopy.ldapUnavailable, MSG_LDAP_UNAVAILABLE);
  assert.equal(operationalCopy.opsHealthDenied, MSG_OPS_HEALTH_DENIED_FA);
  assert.equal(OPS_HEALTH_READ_PERMISSION, "ops.health.read");
  assert.equal(OPS_PLATFORM_DATA_CATEGORY, "ops.platform");

  const pageSrc = readFileSync(opsPage, "utf8");
  assert.ok(
    pageSrc.includes("OperationsHealthPanel"),
    "operations page mounts health panel",
  );
  assert.ok(
    !pageSrc.includes("PlaceholderPage"),
    "placeholder removed from /operations",
  );
  assert.ok(
    pageSrc.includes("assertPageAccess"),
    "Layout≠RSC assertPageAccess present",
  );

  const panelSrc = readFileSync(panelPath, "utf8");
  assert.ok(
    panelSrc.includes("operations.getHealth"),
    "panel calls operations.getHealth",
  );
  assert.ok(
    !panelSrc.includes("GovernedDataTable"),
    "ops panel must not use people GovernedDataTable",
  );
  assert.ok(
    !panelSrc.includes("personId"),
    "ops panel source must not reference personId",
  );
  assert.ok(panelSrc.includes("opsSectionIdentity"));
  assert.ok(panelSrc.includes("opsSectionService"));
  assert.ok(panelSrc.includes("opsSectionRecalc"));
  assert.ok(panelSrc.includes("opsSectionImport"));
  assert.ok(panelSrc.includes("opsSectionBackup"));
  assert.ok(panelSrc.includes("opsSectionDependencies"));
  assert.ok(
    panelSrc.includes('id="ops-recalc"'),
    "ops recalc section must keep deep-link id ops-recalc",
  );
  assert.ok(
    /scrollIntoView|useOpsHashScroll/.test(panelSrc),
    "ops panel must honor #ops-recalc hash scroll (Story 11.1)",
  );
  assert.ok(
    panelSrc.includes("hashchange"),
    "ops hash scroll must listen for hashchange (same-page deep-link)",
  );
  assert.ok(
    /focus(?:-visible)?:ring/.test(panelSrc),
    "ops section focus after hash scroll must keep a visible focus ring",
  );
  assert.equal(operationalCopy.opsSectionRecalc, "بازمحاسبه");

  const rootSrc = readFileSync(rootPath, "utf8");
  assert.ok(rootSrc.includes("operations: operationsRouter"));
  assert.ok(rootSrc.includes("health: publicProcedure"));

  const routerSrc = readFileSync(opsRouterPath, "utf8");
  assert.ok(routerSrc.includes("governedProcedure"));
  assert.ok(routerSrc.includes("OPS_HEALTH_READ_PERMISSION"));
  assert.ok(routerSrc.includes("OPS_PLATFORM_DATA_CATEGORY"));
  assert.ok(routerSrc.includes("appendAccessEvent"));
  assert.ok(routerSrc.includes("probeDirectoryConnectivity"));
  assert.ok(routerSrc.includes("getOpsRecalcAggregate"));
  assert.ok(routerSrc.includes("getOpsImportBatchSummary"));
  assert.ok(!routerSrc.includes("listPendingRecalculationJobs"));
  assert.ok(!routerSrc.includes("getStagingBatch"));

  // Banner feed stays coarse-auth for all roles (Gate).
  const platformSrc = readFileSync(platformStatusPath, "utf8");
  assert.ok(
    platformSrc.includes("protectedProcedure"),
    "platformStatus.recalc stays protectedProcedure for global banner",
  );
  assert.ok(platformSrc.includes("getPlatformRecalcSignal"));

  const healthSrc = readFileSync(healthRoute, "utf8");
  assert.ok(healthSrc.includes("force-dynamic"));
  assert.ok(healthSrc.includes("no-store"));
  assert.ok(healthSrc.includes("503"));
  assert.ok(!healthSrc.includes("personId"));
  assert.ok(!healthSrc.includes("bindPassword"));

  // Sample DTO shape redaction.
  const sample = {
    identity: { status: "red", detailFa: MSG_LDAP_UNAVAILABLE },
    service: { status: "ok" },
    recalculation: { status: "ok", pendingCount: 0 },
    import: { status: "ok" },
    backup: { status: "not_configured" },
    dependencies: { status: "degraded" },
    correlationId: "x",
  };
  assert.equal(opsHealthDtoContainsForbiddenKeys(sample), false);

  console.log("operations selfcheck: ok");
}

main();
