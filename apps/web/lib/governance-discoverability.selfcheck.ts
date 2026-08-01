/**
 * Governance surface discoverability structural selfcheck (Story 9.8).
 * Run: pnpm --filter @divan/web selfcheck:governance-discoverability
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { operationalCopy } from "./operational-copy";
import { uiGlossary } from "./ui-glossary";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const repoRoot = path.resolve(webRoot, "../..");

function read(relFromWeb: string): string {
  return fs.readFileSync(path.join(webRoot, relFromWeb), "utf8");
}

function readRepo(relFromRepo: string): string {
  return fs.readFileSync(path.join(repoRoot, relFromRepo), "utf8");
}

// --- Rename: surface chrome says «اصلاح اطلاعات»; href stays /correction-cases ---
const nav = readRepo("packages/modules/identity-access/src/navigation.ts");
assert.match(nav, /href:\s*"\/correction-cases"/);
assert.match(nav, /label:\s*"اصلاح اطلاعات"/);
assert.doesNotMatch(nav, /label:\s*"پرونده‌های اصلاح"/);

const announcer = read("components/route-announcer.tsx");
assert.match(announcer, /"\/correction-cases":\s*"اصلاح اطلاعات"/);

const correctionPage = read("app/(app)/correction-cases/page.tsx");
assert.match(correctionPage, /correctionCaseHeading/);
assert.match(correctionPage, /correctionCasePurpose/);
assert.doesNotMatch(correctionPage, /پرونده‌های اصلاح/);

assert.equal(operationalCopy.correctionCaseHeading, "اصلاح اطلاعات");
assert.match(operationalCopy.correctionCasePurpose, /صاحب‌داده/);
assert.match(operationalCopy.correctionCasePurpose, /ادمین منابع انسانی/);
assert.match(operationalCopy.correctionCasePurpose, /می‌بندد/);
assert.match(operationalCopy.correctionCaseLoading, /اصلاح اطلاعات/);
assert.doesNotMatch(operationalCopy.correctionCaseHeading, /پرونده‌های اصلاح/);

// --- Timeline + shared CTA ---
const cta = read("components/personnel/correction-request-cta.tsx");
assert.match(cta, /profileCorrectionRequestCta/);
assert.match(cta, /correction-cases\?person=/);
assert.match(cta, /correctionCase\.capabilities/);
assert.match(cta, /requestNavigation/);
assert.match(cta, /correctionCaseCapabilitiesError/);
assert.match(cta, /profileCorrectionRequestDenied/);

const timeline = read("components/personnel/personnel-event-timeline.tsx");
assert.match(timeline, /CorrectionRequestCta/);
assert.match(timeline, /from "@\/components\/personnel\/correction-request-cta"/);
assert.match(timeline, /showCorrectionCta/);

const profileView = read("components/personnel/person-profile-view.tsx");
assert.match(profileView, /CorrectionRequestCta/);
assert.match(profileView, /profileAccessManageCta/);
assert.match(profileView, /profileLifecycleManageCta/);
assert.match(profileView, /profileAccessManageHint/);
assert.match(profileView, /\/access\/people/);
assert.match(profileView, /\/personnel\/dictionary/);
assert.match(profileView, /showCorrectionCta=\{false\}/);
assert.match(profileView, /sessionStatus === "authenticated"/);
assert.doesNotMatch(
  profileView,
  /from "@divan\/identity-access"/,
  "profile must not import identity-access (pg) into client",
);

// --- Other governance purpose keys ---
assert.ok(operationalCopy.accessSurfacePurpose.length > 0);
assert.ok(operationalCopy.auditSurfacePurpose.length > 0);
assert.ok(operationalCopy.operationsSurfacePurpose.length > 0);
assert.ok(operationalCopy.lifecycleHostPurpose.length > 0);

const accessLayout = read("app/(app)/access/(tabs)/layout.tsx");
assert.match(accessLayout, /accessSurfacePurpose/);

const auditPage = read("app/(app)/audit/page.tsx");
assert.match(auditPage, /auditSurfacePurpose/);

const opsPage = read("app/(app)/operations/page.tsx");
assert.match(opsPage, /operationsSurfacePurpose/);

const dictPage = read("app/(app)/personnel/(tabs)/dictionary/page.tsx");
assert.match(dictPage, /lifecycleHostPurpose/);
assert.match(
  dictPage,
  /PersonnelDictionaryPanel[\s\S]*lifecycleHostPurpose[\s\S]*PersonnelLifecyclePanel/,
);

const lifecyclePanel = read("components/personnel/personnel-lifecycle-panel.tsx");
assert.match(lifecyclePanel, /legalHold/);
assert.match(lifecyclePanel, /GlossaryTerm/);

const opsHealth = read("components/operations/operations-health-panel.tsx");
assert.match(opsHealth, /auditTrustReviewDeepLink/);
assert.match(opsHealth, /\/audit\?trust=review/);
assert.match(opsHealth, /requestNavigation/);
assert.match(opsHealth, /auditTrustReviewRequiresAuditor/);
assert.match(opsHealth, /audit_reviewer/);

assert.ok(operationalCopy.auditTrustReviewRequiresAuditor.length > 0);
assert.match(operationalCopy.correctionCaseCapabilitiesError, /اصلاح اطلاعات/);

// --- Glossary ---
assert.ok(uiGlossary.correctionCase);
assert.ok(uiGlossary.legalHold);
assert.ok(uiGlossary.auditInvestigation);
assert.equal(uiGlossary.correctionCase.termFa, "اصلاح اطلاعات");

const panel = read("components/correction-cases/correction-cases-panel.tsx");
assert.match(panel, /GlossaryTerm/);
assert.match(panel, /correctionCase/);

// No settings nav claimed
assert.doesNotMatch(nav, /تنظیمات/);

console.log("governance-discoverability.selfcheck: ok");
