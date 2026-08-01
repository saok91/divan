/**
 * Personnel events list structural selfcheck (Story 9.6).
 * Run: pnpm --filter @divan/web selfcheck:personnel-events-list
 *
 * Filesystem heuristics — no Playwright:
 * - FIXTURE_EVENTS / scaffold caption gone
 * - Panel binds personnelEvent.search + RowActionCluster + FeedbackMessage
 * - EntityPicker for person/team filters
 * - Server search procedure present
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const repoRoot = path.resolve(webRoot, "../..");

function read(relFromWeb: string): string {
  return fs.readFileSync(path.join(webRoot, relFromWeb), "utf8");
}

function readRepo(relFromRepo: string): string {
  return fs.readFileSync(path.join(repoRoot, relFromRepo), "utf8");
}

const panel = read("components/personnel/personnel-events-list-panel.tsx");
assert.doesNotMatch(panel, /FIXTURE_EVENTS/);
assert.doesNotMatch(panel, /EventFixtureRow/);
assert.doesNotMatch(panel, /دادهٔ نمونه برای پوسته/);
assert.match(panel, /personnelEvent\.search/);
assert.match(panel, /RowActionCluster/);
assert.match(panel, /FeedbackMessage/);
assert.match(panel, /EntityPicker/);
assert.match(panel, /createPersonSearch/);
assert.match(panel, /createOrgUnitSearch/);
assert.match(panel, /preferencesKey=["']personnel-events-list["']/);
assert.match(panel, /باز کردن رویداد/);
assert.match(panel, /باز کردن فرد/);
assert.match(panel, /onRowClick/);
assert.match(panel, /evaluationSnapshotId/);
assert.match(panel, /keepPreviousData/);
assert.match(panel, /StatusBadge/);

const router = read("src/server/personnel-event.ts");
assert.match(router, /operation:\s*["']personnel_event\.search["']/);
assert.match(router, /runPersonnelEventSearch/);

const search = read("src/server/personnel-event-search.ts");
assert.match(search, /beginEvaluationSnapshot/);
assert.match(search, /listBusinessEventsForPersons/);
assert.match(search, /listOpenDraftsForPersons/);
assert.match(search, /listTeamMembersAsOf/);
assert.match(search, /channel:\s*["']list["']/);
assert.match(search, /resolveLifecycleStatus/);

const store = readRepo("packages/kernel/event-store/src/business-event.ts");
assert.match(store, /export async function listBusinessEventsForPersons/);
assert.match(store, /BUSINESS_EVENTS_UI_LIST_LIMIT_MAX/);

// Repo-wide fixture gate
function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
      continue;
    }
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTs(abs, out);
      continue;
    }
    if (/\.(ts|tsx|md)$/.test(entry.name)) out.push(abs);
  }
  return out;
}

for (const file of walkTs(path.join(webRoot, "components"))) {
  const src = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(
    src,
    /FIXTURE_EVENTS/,
    `${path.relative(webRoot, file)} still references FIXTURE_EVENTS`,
  );
}

console.log("personnel-events-list.selfcheck: ok");
