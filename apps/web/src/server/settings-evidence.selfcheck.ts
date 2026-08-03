/**
 * Settings evidence / FR51 selfcheck (Story 10.5).
 * Source-level gates: trust gate on apply/reset, no swallow-catch on allow append,
 * payload keys, audit href builder, boundary suite wired.
 * Run: pnpm --filter @divan/web selfcheck:settings-evidence
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  listAdminEditableKeys,
  getSettingsParameter,
} from "@divan/app-settings";

import { operationalCopy } from "../../lib/operational-copy";
import {
  buildSettingsAuditHref,
  settingsApplyAuditHref,
  settingsHistoryAuditHref,
  settingsResetAuditHref,
} from "../../lib/settings-audit-href";

const here = dirname(fileURLToPath(import.meta.url));
const routerSrc = readFileSync(join(here, "settings.ts"), "utf8");
const editorSrc = readFileSync(
  join(here, "../../components/settings/settings-parameter-editor.tsx"),
  "utf8",
);
const panelSrc = readFileSync(
  join(here, "../../components/settings/settings-domain-panel.tsx"),
  "utf8",
);
const auditPanelSrc = readFileSync(
  join(here, "../../components/audit/audit-investigation-panel.tsx"),
  "utf8",
);
const auditPageSrc = readFileSync(
  join(here, "../../app/(app)/audit/page.tsx"),
  "utf8",
);
const storeSrc = readFileSync(
  join(
    here,
    "../../../../packages/kernel/app-settings/src/store.ts",
  ),
  "utf8",
);
const appSettingsPkg = JSON.parse(
  readFileSync(
    join(here, "../../../../packages/kernel/app-settings/package.json"),
    "utf8",
  ),
) as { scripts?: Record<string, string> };
const webPkg = JSON.parse(
  readFileSync(join(here, "../../package.json"), "utf8"),
) as { scripts?: Record<string, string> };

// --- FR51 wiring on allow path ---
assert.match(routerSrc, /assertAuditTrustWriterAllowed/);
assert.match(routerSrc, /enforceClockAnomalyOrThrow/);
assert.match(routerSrc, /withTransaction/);
assert.match(routerSrc, /effectAt/);
assert.match(routerSrc, /skipCacheRefresh:\s*true/);
assert.match(routerSrc, /invalidateSettingsCache/);
assert.match(routerSrc, /SettingsEvidenceAppendError|settings_evidence_append_failed/);
assert.match(routerSrc, /projectRowAfterEvidenceCommit/);
assert.match(routerSrc, /throwSettingsEvidenceRequired\(err,\s*"apply"\)/);
assert.match(routerSrc, /throwSettingsEvidenceRequired\(err,\s*"reset"\)/);
assert.match(routerSrc, /settingsEvidenceRequiredFail/);
assert.match(routerSrc, /correlationId:\s*ctx\.correlationId/);
assert.match(routerSrc, /action:\s*"apply"/);
assert.match(routerSrc, /action:\s*"reset"/);
assert.match(routerSrc, /previousValue/);
assert.match(routerSrc, /newValue/);
assert.match(routerSrc, /getCodeDefault/);
assert.match(routerSrc, /entityId:\s*def\.key/);
assert.doesNotMatch(
  routerSrc,
  /Prefer successful mutation visibility; full FR51/,
);
// Soft-deny still best-effort (deny path catch remains)
assert.match(routerSrc, /Prefer client-visible deny over append failure masking/);

// No effectAt: null on allow apply
assert.doesNotMatch(routerSrc, /effectAt:\s*null/);

// Store supports TX-safe skip refresh
assert.match(storeSrc, /skipCacheRefresh/);

// --- Audit href builder ---
assert.equal(
  settingsApplyAuditHref("11111111-1111-4111-8111-111111111111"),
  "/audit?operation=settings.apply&correlationId=11111111-1111-4111-8111-111111111111",
);
assert.equal(
  settingsResetAuditHref("22222222-2222-4222-8222-222222222222"),
  "/audit?operation=settings.reset&correlationId=22222222-2222-4222-8222-222222222222",
);
assert.equal(
  settingsHistoryAuditHref("import.max_file_bytes"),
  "/audit?operationPrefix=settings.&entityType=settings_configuration&entityId=import.max_file_bytes",
);
assert.equal(
  buildSettingsAuditHref({ operationPrefix: "settings." }),
  "/audit?operationPrefix=settings.",
);
// Bad correlation ignored
assert.equal(
  buildSettingsAuditHref({
    operation: "settings.apply",
    correlationId: "not-a-uuid",
  }),
  "/audit?operation=settings.apply",
);

// --- UI live audit link ---
assert.match(editorSrc, /settingsHistoryAuditHref\(row\.key\)/);
assert.match(editorSrc, /settingsAuditLinkHint/);
assert.match(panelSrc, /settingsViewInAuditCta|مشاهده در ممیزی/);
assert.match(panelSrc, /feedback\.auditHref/);

// --- Audit panel URL hydrate ---
assert.match(auditPanelSrc, /hydrateDraftFromSearchParams|operationPrefix/);
assert.match(auditPanelSrc, /entityType|entityTechnicalId/);
assert.match(auditPanelSrc, /useSearchParams/);
assert.doesNotMatch(auditPanelSrc, /hydratedOnce/);
assert.match(auditPageSrc, /Suspense/);
assert.match(auditPageSrc, /AuditInvestigationPanel/);

// --- Copy honesty ---
assert.ok(
  operationalCopy.settingsEvidenceRequiredFail.includes("شواهد"),
);
assert.ok(
  !operationalCopy.settingsEvidenceRequiredFail.includes("دسترسی ندارید"),
);
assert.equal(operationalCopy.settingsViewInAuditCta, "مشاهده در ممیزی");
assert.ok(operationalCopy.settingsApplySuccess.includes("ممیزی"));

// --- RO inventory still non-mutable ---
for (const key of [
  "export.custody_bulk_row_threshold",
  "audit.trust_enforce",
  "session.idle_timeout_seconds",
  "infra.pg_pool_max",
] as const) {
  const def = getSettingsParameter(key);
  assert.equal(def.editability, "read_only_with_evidence", key);
  assert.ok(!listAdminEditableKeys().includes(key), key);
}

// --- Scripts wired ---
assert.ok(
  String(appSettingsPkg.scripts?.["selfcheck:boundary"] ?? "").includes(
    "boundary-guard",
  ),
  "app-settings selfcheck:boundary wired",
);
assert.ok(
  String(webPkg.scripts?.["selfcheck:settings-evidence"] ?? "").includes(
    "settings-evidence",
  ),
  "web selfcheck:settings-evidence wired",
);

console.log("settings-evidence selfcheck: ok");
