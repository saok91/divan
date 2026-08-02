/**
 * Guard: prevent re-introduction of pre-10.1 naked literal SoT for registered
 * admin_editable parameters outside the settings substrate.
 * Run: pnpm --filter @divan/app-settings selfcheck:guard
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  listAdminEditableKeys,
  requireGovernedSettingsRegistry,
} from "./registry";

requireGovernedSettingsRegistry();

const REPO_ROOT = resolve(process.cwd(), "../../..");

/**
 * Banned pre-cutover assignment fingerprints. Presence outside allowlisted
 * substrate paths means a dual SoT was reintroduced.
 */
const BANNED_ASSIGNMENTS: Array<{ key: string; pattern: string }> = [
  {
    key: "import.max_file_bytes",
    pattern: "IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024",
  },
  {
    key: "import.max_data_rows",
    pattern: "IMPORT_MAX_DATA_ROWS = 5_000",
  },
  {
    key: "import.max_drafts_global",
    pattern: "IMPORT_MAX_DRAFTS_GLOBAL = 50",
  },
  {
    key: "import.max_drafts_per_actor",
    pattern: "IMPORT_MAX_DRAFTS_PER_ACTOR = 5",
  },
  {
    key: "import.draft_ttl_ms",
    pattern: "IMPORT_DRAFT_TTL_MS = 60 * 60 * 1000",
  },
  {
    key: "export.artifact_ttl_ms",
    pattern: "EXPORT_ARTIFACT_TTL_MS = 4 * 60 * 60 * 1000",
  },
  {
    key: "list.personnel_max_rows",
    pattern: "PERSONNEL_LIST_MAX_ROWS = 500",
  },
  {
    key: "list.search_page_size_default",
    pattern: "PERSONNEL_SEARCH_PAGE_SIZE_DEFAULT = 50",
  },
  {
    key: "list.search_page_size_max",
    pattern: "PERSONNEL_SEARCH_PAGE_SIZE_MAX = 100",
  },
  {
    key: "headcount.reservation_expiry_warning_days",
    pattern: "HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS = 14",
  },
  {
    key: "correction.attachment_max_bytes",
    pattern: "PROVISIONAL_DEFAULT_MAX_BYTES = 1_048_576",
  },
  {
    key: "correction.attachment_max_per_case",
    pattern: "PROVISIONAL_DEFAULT_MAX_PER_CASE = 10",
  },
  {
    key: "correction.attachment_allowlist",
    pattern: "CORRECTION_ATTACHMENT_ALLOWLIST = [",
  },
  {
    key: "entitlement.recert_window_ms",
    pattern: "DEFAULT_RECERT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000",
  },
];

/** Env aliases for registered params — only ENFORCE path in correction-case may mention these. */
const BANNED_ENV_ALIASES: Array<{ key: string; pattern: string }> = [
  {
    key: "correction.attachment_max_bytes",
    pattern: "DIVAN_CORRECTION_CASE_MAX_BYTES",
  },
  {
    key: "correction.attachment_max_per_case",
    pattern: "DIVAN_CORRECTION_CASE_MAX_PER_CASE",
  },
  {
    key: "correction.attachment_allowlist",
    pattern: "DIVAN_CORRECTION_CASE_ALLOWLIST",
  },
];

const ENV_ALIAS_ALLOW_SUBSTRINGS = [
  "packages/kernel/audit-envelope/src/correction-case.ts",
  "packages\\kernel\\audit-envelope\\src\\correction-case.ts",
];

function rgAvailable(): boolean {
  try {
    execFileSync("rg", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function searchFixed(pattern: string): string[] {
  const args = [
    "-n",
    "-F",
    "--glob",
    "!**/node_modules/**",
    "--glob",
    "!**/dist/**",
    "--glob",
    "!**/.next/**",
    "--glob",
    "!**/_bmad-output/**",
    "--glob",
    "!**/*.md",
    "--glob",
    "!packages/kernel/app-settings/**",
    "--glob",
    "!packages/db/sql/022_governed_settings.sql",
    pattern,
    "packages",
    "apps",
  ];
  try {
    const out = execFileSync("rg", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch (err) {
    const e = err as { status?: number };
    if (e.status === 1) return [];
    throw err;
  }
}

assert.ok(existsSync(REPO_ROOT), "repo root");
assert.ok(
  rgAvailable(),
  "ripgrep (rg) required for governed-settings guard selfcheck",
);

const adminKeys = listAdminEditableKeys();
const adminKeySet = new Set(adminKeys);
const violations: string[] = [];

const coveredKeys = new Set(BANNED_ASSIGNMENTS.map((b) => b.key));
for (const key of adminKeys) {
  if (!coveredKeys.has(key)) {
    violations.push(`[${key}] admin_editable key missing from BANNED_ASSIGNMENTS`);
  }
}

for (const banned of BANNED_ASSIGNMENTS) {
  assert.ok(
    adminKeySet.has(banned.key),
    `guard map key missing from admin_editable registry: ${banned.key}`,
  );
  const hits = searchFixed(banned.pattern);
  for (const hit of hits) {
    violations.push(`[${banned.key}] banned assignment → ${hit}`);
  }
}

for (const banned of BANNED_ENV_ALIASES) {
  const hits = searchFixed(banned.pattern);
  for (const hit of hits) {
    if (ENV_ALIAS_ALLOW_SUBSTRINGS.some((s) => hit.includes(s))) continue;
    violations.push(`[${banned.key}] banned env alias → ${hit}`);
  }
}

// Client must not mirror code defaults from registry at module load.
const clientRegistryHits = searchFixed(
  'from "@divan/app-settings/registry"',
);
for (const hit of clientRegistryHits) {
  if (hit.includes("correction-cases-panel")) {
    violations.push(
      `[correction.attachment_max_bytes] client registry import → ${hit}`,
    );
  }
}

if (violations.length > 0) {
  console.error("governed-settings guard FAILED:");
  for (const v of violations) console.error("  ", v);
  process.exit(1);
}

console.log(
  `governed-settings guard: ok (${BANNED_ASSIGNMENTS.length} cutover fingerprints + ${BANNED_ENV_ALIASES.length} env aliases + admin coverage)`,
);
