/**
 * Static selfcheck for decision-publication web wiring (Story 7.6 / FR-54).
 * Run: pnpm --filter @divan/web selfcheck:decision-publication
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const rootSrc = readFileSync(join(here, "root.ts"), "utf8");
const routerSrc = readFileSync(join(here, "decision-publication.ts"), "utf8");
const panelSrc = readFileSync(
  join(here, "../../components/reports/decision-publication-panel.tsx"),
  "utf8",
);
const catalogueSrc = readFileSync(
  join(here, "../../components/reports/report-workspace.tsx"),
  "utf8",
);
const copySrc = readFileSync(
  join(here, "../../lib/operational-copy.ts"),
  "utf8",
);
const retentionSrc = readFileSync(join(here, "retention.ts"), "utf8");
const correctionSrc = readFileSync(join(here, "correction-case.ts"), "utf8");
const sqlSrc = readFileSync(
  join(here, "../../../../packages/db/sql/019_decision_publications.sql"),
  "utf8",
);

assert.match(rootSrc, /decisionPublication:\s*decisionPublicationRouter/);
assert.match(routerSrc, /list:\s*governedProcedure/);
assert.match(routerSrc, /get:\s*governedProcedure/);
assert.match(routerSrc, /publish:\s*governedProcedure/);
assert.match(routerSrc, /listNotices:\s*governedProcedure/);
assert.match(routerSrc, /createNotice:\s*governedProcedure/);
assert.match(routerSrc, /capabilities:\s*governedProcedure/);
assert.match(routerSrc, /markNonReproducible:\s*governedProcedure/);
assert.match(routerSrc, /sensitive:\s*true/);
assert.match(routerSrc, /report\.publication\.publish/);
assert.match(routerSrc, /PUBLICATION_STALE_BLOCKED|blockingStale/);
assert.doesNotMatch(routerSrc, /error\.message(?!Fa)/);

assert.match(panelSrc, /publicationPublishCta/);
assert.match(panelSrc, /useStaleBlocking/);
assert.match(panelSrc, /isGoldCtaBlocked/);
assert.match(catalogueSrc, /DecisionPublicationPanel/);

assert.match(copySrc, /publicationPublishCta/);
assert.match(copySrc, /publicationStatusNonReproducible/);
assert.match(
  copySrc,
  /شناسهٔ انتشار تصمیم مشخص نیست|انتشار گزارش تصمیم/,
);
assert.doesNotMatch(
  copySrc,
  /محصول بازتولید گزارش \(۷٫۶\) هنوز ساخته نشده/,
);

assert.match(retentionSrc, /onRequiredSourceDisposed/);
assert.match(correctionSrc, /decision_publication/);

assert.match(sqlSrc, /decision_publication/);
assert.match(sqlSrc, /non-reproducible-after-disposal/);
assert.match(sqlSrc, /forbid_decision_publication_rewrite/);
assert.match(sqlSrc, /publication_notice/);
assert.match(sqlSrc, /reproducibility_package/);

console.log("decision-publication web static selfcheck: ok");
