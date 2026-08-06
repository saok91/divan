/**
 * Operational copy / self-explaining state selfcheck (Story 8.9).
 * Run: pnpm --filter @divan/web selfcheck:operational-copy
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isStaleRecalcOpsRole,
  operationalCopy,
  staleRecalcDisclosureBody,
  staleRecalcMessage,
} from "./operational-copy";
import { emptyStateCopy } from "./empty-state";
import { uiGlossary } from "./ui-glossary";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(webRoot, rel), "utf8");
}

// --- Recalc banner copy: no clock deadline ---
const msg = staleRecalcMessage(3);
assert.match(msg, /محاسبهٔ وضعیت جاری برای ۳ فرد/);
assert.doesNotMatch(
  msg,
  /تا\s*[۰-۹0-9]{1,2}:[۰-۹0-9]{2}/,
  "staleRecalcMessage must not embed HH:MM deadline",
);
assert.doesNotMatch(msg, /محاسبه نشده/);

const unknownMsg = staleRecalcMessage(null);
assert.equal(unknownMsg, operationalCopy.staleRecalcUnknownScope);
assert.doesNotMatch(unknownMsg, /۰ فرد|0 فرد/);

assert.equal(
  operationalCopy.figureRecalculating,
  "در حال محاسبه — عدد ممکن است تغییر کند.",
);
assert.equal(
  operationalCopy.figureRecalculatingCompact,
  "در حال محاسبه",
);
assert.equal(operationalCopy.staleRecalcDisclosureSummary, "توضیح بیشتر");
assert.ok(
  operationalCopy.staleRecalcDisclosureBodySysAdmin.includes("۱۵ دقیقه"),
  "SysAdmin disclosure must mention 15-minute ops check without clock deadline",
);
assert.ok(
  operationalCopy.staleRecalcDisclosureBodyNonOps.includes("۱۵ دقیقه"),
  "non-ops disclosure must mention 15-minute wait without clock deadline",
);
assert.doesNotMatch(
  operationalCopy.staleRecalcDisclosureBodySysAdmin,
  /تا\s*[۰-۹0-9]{1,2}:[۰-۹0-9]{2}/,
);
assert.doesNotMatch(
  operationalCopy.staleRecalcDisclosureBodyNonOps,
  /تا\s*[۰-۹0-9]{1,2}:[۰-۹0-9]{2}/,
);

// Story 11.1 — ban invented «صف محاسبه»; role-honest next steps
for (const body of [
  operationalCopy.staleRecalcDisclosureBodySysAdmin,
  operationalCopy.staleRecalcDisclosureBodyNonOps,
  operationalCopy.staleRecalcDisclosureBodySessionLoading,
  staleRecalcDisclosureBody("system_admin"),
  staleRecalcDisclosureBody("hr_operator"),
  staleRecalcDisclosureBody("hr_admin"),
  staleRecalcDisclosureBody("manager"),
  staleRecalcDisclosureBody(undefined),
]) {
  assert.doesNotMatch(
    body,
    /صف محاسبه/,
    "stale disclosure must never invent «صف محاسبه»",
  );
  assert.doesNotMatch(body, /عملیات\s*←\s*صف محاسبه/);
}
assert.doesNotMatch(
  operationalCopy.staleRecalcDisclosureBodySessionLoading,
  /\/operations|SysAdmin|مدیر سامانه/,
  "session-loading disclosure must not assume role next step",
);
assert.ok(isStaleRecalcOpsRole("system_admin"));
assert.equal(isStaleRecalcOpsRole("hr_operator"), false);
assert.ok(
  operationalCopy.staleRecalcDisclosureBodySysAdmin.includes("بازمحاسبه"),
  "SysAdmin disclosure must name real section «بازمحاسبه»",
);
assert.equal(
  operationalCopy.staleRecalcOpsDeepLinkHref,
  "/operations#ops-recalc",
);
assert.match(
  operationalCopy.staleRecalcOpsDeepLinkLabel,
  /بازمحاسبه/,
);
assert.doesNotMatch(
  operationalCopy.staleRecalcDisclosureBodyNonOps,
  /\/operations/,
  "non-ops disclosure must not require /operations as next step",
);
assert.doesNotMatch(
  operationalCopy.staleRecalcDisclosureBodyNonOps,
  /عملیات/,
  "non-ops disclosure must not point at «عملیات» nav",
);
assert.equal(
  staleRecalcDisclosureBody("system_admin"),
  operationalCopy.staleRecalcDisclosureBodySysAdmin,
);
assert.equal(
  staleRecalcDisclosureBody("hr_operator"),
  operationalCopy.staleRecalcDisclosureBodyNonOps,
);

const banner = read("components/stale-recalc-banner.tsx");
assert.match(banner, /توضیح بیشتر|staleRecalcDisclosureSummary/);
assert.match(banner, /<details/);
assert.doesNotMatch(
  banner,
  /stalePendingUntil/,
  "banner must not render stalePendingUntil",
);
assert.match(banner, /affectedPersonCount/);
assert.match(banner, /useSession/);
assert.match(banner, /staleRecalcDisclosureBody/);
assert.match(banner, /staleRecalcOpsDeepLinkHref|\/operations#ops-recalc/);
assert.match(banner, /isStaleRecalcOpsRole|system_admin/);
assert.match(banner, /requestNavigation/);
assert.match(banner, /sessionStatus|status !== ["']loading["']|!== "loading"/);
assert.doesNotMatch(banner, /صف محاسبه/);

const opsPanel = read("components/operations/operations-health-panel.tsx");
assert.match(opsPanel, /id=["']ops-recalc["']/);
assert.match(opsPanel, /scrollIntoView|useOpsHashScroll/);
assert.match(opsPanel, /hashchange/);
assert.match(opsPanel, /focus(?:-visible)?:ring/);

const provider = read("components/platform-status-provider.tsx");
assert.match(provider, /affectedPersonCount/);
assert.match(provider, /setAffectedPersonCount/);

// --- Empty taxonomy ---
assert.equal(emptyStateCopy("filtered").actionLabelFa, operationalCopy.clearFilters);
assert.equal(
  emptyStateCopy("notPermitted").titleFa,
  operationalCopy.accessDeniedTitle,
);
assert.ok(emptyStateCopy("noDataYet").bodyFa.length > 0);
assert.ok(fs.existsSync(path.join(webRoot, "lib/empty-state.ts")));
assert.ok(fs.existsSync(path.join(webRoot, "components/ui/empty-state.tsx")));

const gdtTypes = read("components/governed-data-table/types.ts");
assert.match(gdtTypes, /emptyKind\?:/);

// --- Glossary ---
assert.ok(fs.existsSync(path.join(webRoot, "lib/ui-glossary.ts")));
assert.ok(
  fs.existsSync(path.join(webRoot, "components/glossary/glossary-term.tsx")),
);
const glossarySrc = read("components/glossary/glossary-term.tsx");
assert.match(glossarySrc, /data-slot="glossary-term"/);
assert.match(glossarySrc, /تعریف/);
assert.doesNotMatch(
  glossarySrc,
  /data-slot="technical-detail-disclosure"/,
);
assert.ok(Object.keys(uiGlossary).length >= 8);
assert.ok(Object.keys(uiGlossary).length <= 15);

// Story 9.2 — day-to-day bulk five-step labels + dual-entry distinction
assert.equal(operationalCopy.bulkStepTemplate, "قالب");
assert.equal(operationalCopy.bulkStepUpload, "آپلود");
assert.equal(operationalCopy.bulkStepPreview, "پیش‌نمایش و خطاها");
assert.equal(operationalCopy.bulkStepConfirm, "تأیید");
assert.equal(operationalCopy.bulkStepResult, "نتیجه");
assert.ok(operationalCopy.importBulkCatalogueHint.includes("ورود داده"));
assert.doesNotMatch(
  operationalCopy.importBulkCatalogueHint,
  /داستان ۹٫۲/,
  "9.2 deferral hint must be removed from bulk purpose copy",
);
assert.ok(operationalCopy.importBulkDayHint.includes("ورود گروهی"));
assert.ok(operationalCopy.bulkResultCreated.length > 0);
assert.ok(operationalCopy.bulkResultUpdated.length > 0);
assert.ok(operationalCopy.bulkResultRejected.length > 0);

// --- Disabled reason scan (Button call sites under components) ---
function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsx(full, out);
    else if (/\.tsx$/.test(entry.name) && !entry.name.endsWith(".selfcheck.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** Allowlist: filter chrome / theme toggles / native-disabled without AT reason when unavoidable. */
const ALLOWLIST_REL = new Set([
  "components/jalali-date-picker.tsx", // disabled={disabled} prop passthrough
  "components/entity-picker/entity-picker.tsx", // uses disabledReasonFa
  "components/governed-data-table/governed-data-table.tsx", // filter popover Checkbox chrome while loading
  "components/dev/gallery/page.tsx",
  "app/(app)/dev/gallery/page.tsx",
]);

const missing: string[] = [];
for (const file of walkTsx(path.join(webRoot, "components"))) {
  const rel = path.relative(webRoot, file).replaceAll("\\", "/");
  if (ALLOWLIST_REL.has(rel)) continue;
  if (rel.includes("entity-picker/")) continue;
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/<Button\b/g)) {
    const window = src.slice(m.index!, m.index! + 700);
    if (!/\bdisabled=\{/.test(window)) continue;
    // opening tag only
    let depth = 0;
    let inStr: string | null = null;
    let end = -1;
    for (let i = 0; i < window.length; i++) {
      const ch = window[i]!;
      if (inStr) {
        if (ch === inStr && window[i - 1] !== "\\") inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inStr = ch;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") depth = Math.max(0, depth - 1);
      else if (depth === 0 && ch === ">") {
        end = i + 1;
        break;
      }
    }
    if (end < 0) continue;
    const tag = window.slice(0, end);
    if (!/\bdisabled=\{/.test(tag)) continue;
    if (/disabledReason/.test(tag)) continue;
    const line = src.slice(0, m.index!).split("\n").length;
    missing.push(`${rel}:${line}`);
  }
}

assert.equal(
  missing.length,
  0,
  `Button disabled without disabledReason:\n${missing.slice(0, 40).join("\n")}`,
);

console.log("operational-copy selfcheck: ok");
