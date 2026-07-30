/**
 * Decision publication selfcheck (Story 7.6 / FR-54).
 * Run: pnpm --filter @divan/reporting selfcheck:decision-publication
 *
 * Pure matrix always runs. Optional DB path when DATABASE_URL + 019 schema applied.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { getSharedPgPool } from "@divan/db";

import {
  DecisionPublicationError,
  PROVISIONAL_METRIC_VERSION,
  PROVISIONAL_REPORT_VERSION,
  PUBLICATION_STATUS,
  REPRODUCIBILITY_STATE,
  REPORT_PUBLICATION_DATA_CATEGORY,
  REPORT_PUBLICATION_MANAGE_PERMISSION,
  REPORT_PUBLICATION_PUBLISH_PERMISSION,
  REPORT_PUBLICATION_READ_PERMISSION,
  REPORT_PUBLICATION_SUPERSEDE_PERMISSION,
  computeExportSnapshotHash,
  createPublicationNotice,
  getDecisionPublicationById,
  isCurrentlyReproducible,
  isPublicationPackageRetainAllowed,
  markNonReproducibleAfterDisposal,
  onRequiredSourceDisposed,
  publishDecisionReport,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

assert.equal(REPORT_PUBLICATION_READ_PERMISSION, "report.publication.read");
assert.equal(REPORT_PUBLICATION_PUBLISH_PERMISSION, "report.publication.publish");
assert.equal(
  REPORT_PUBLICATION_SUPERSEDE_PERMISSION,
  "report.publication.supersede",
);
assert.equal(REPORT_PUBLICATION_MANAGE_PERMISSION, "report.publication.manage");
assert.equal(REPORT_PUBLICATION_DATA_CATEGORY, "report.publication");
assert.ok(PROVISIONAL_REPORT_VERSION.includes("@provisional-pending-AR-REPORTING"));
assert.ok(PROVISIONAL_METRIC_VERSION.includes("@provisional-pending-AR-REPORTING"));
assert.equal(
  PUBLICATION_STATUS.nonReproducibleAfterDisposal,
  "non-reproducible-after-disposal",
);
assert.equal(
  REPRODUCIBILITY_STATE.nonReproducibleAfterDisposal,
  "non-reproducible-after-disposal",
);

assert.equal(
  isCurrentlyReproducible({
    status: "published",
    reproducibilityState: "reproducible",
  }),
  true,
);
assert.equal(
  isCurrentlyReproducible({
    status: "non-reproducible-after-disposal",
    reproducibilityState: "non-reproducible-after-disposal",
  }),
  false,
);
assert.equal(
  isCurrentlyReproducible({
    status: "package_retained",
    reproducibilityState: "package_retained",
  }),
  true,
);

// Default AR-DATA provisional: package retain deny (empty allowlist)
assert.equal(isPublicationPackageRetainAllowed("active_persons"), false);

const filters = {
  reportKey: "active_persons",
  teamId: null,
  asOf: "2026-07-29",
  rangeStart: null,
  rangeEnd: null,
  evaluationMode: "current",
};
const fieldIds = ["personId", "displayName"];
const hash = computeExportSnapshotHash({
  sourceSurface: "report",
  sourceKey: "active_persons",
  filters,
  fieldIds,
  asOf: "2026-07-29",
});
assert.equal(typeof hash, "string");
assert.equal(hash.length, 64);

// Denied without permission
const noopDb = {
  query: async () =>
    ({
      rows: [],
      rowCount: 0,
      command: "",
      oid: 0,
      fields: [],
    }) as never,
};
await assert.rejects(
  () =>
    publishDecisionReport(noopDb, {
      reportKey: "active_persons",
      filters,
      evaluationMode: "current",
      stableSnapshot: {
        sourceSurface: "report",
        sourceKey: "active_persons",
        filters,
        fieldIds,
        asOf: "2026-07-29",
      },
      reviewedSnapshotHash: hash,
      publisherAccountId: "acct-1",
      permittedAudience: ["report.publication.read"],
      holdsPublishPermission: false,
    }),
  (err: unknown) =>
    err instanceof DecisionPublicationError && err.code === "PUBLICATION_DENIED",
);

// Stale blocked
await assert.rejects(
  () =>
    publishDecisionReport(noopDb, {
      reportKey: "active_persons",
      filters,
      evaluationMode: "current",
      stableSnapshot: {
        sourceSurface: "report",
        sourceKey: "active_persons",
        filters,
        fieldIds,
        asOf: "2026-07-29",
      },
      reviewedSnapshotHash: hash,
      publisherAccountId: "acct-1",
      permittedAudience: ["report.publication.read"],
      holdsPublishPermission: true,
      blockingStale: true,
    }),
  (err: unknown) =>
    err instanceof DecisionPublicationError &&
    err.code === "PUBLICATION_STALE_BLOCKED",
);

// Snapshot mismatch
await assert.rejects(
  () =>
    publishDecisionReport(noopDb, {
      reportKey: "active_persons",
      filters,
      evaluationMode: "current",
      stableSnapshot: {
        sourceSurface: "report",
        sourceKey: "active_persons",
        filters,
        fieldIds,
        asOf: "2026-07-29",
      },
      reviewedSnapshotHash: "0".repeat(64),
      publisherAccountId: "acct-1",
      permittedAudience: ["report.publication.read"],
      holdsPublishPermission: true,
    }),
  (err: unknown) =>
    err instanceof DecisionPublicationError &&
    err.code === "PUBLICATION_SNAPSHOT_MISMATCH",
);

console.log("decision-publication pure matrix: ok");

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.log("decision-publication DB path: skipped (no DATABASE_URL)");
  process.exit(0);
}

const pool = getSharedPgPool(url);
try {
  await pool.query(`SELECT 1 FROM reporting.decision_publication LIMIT 1`);
} catch {
  console.log(
    "decision-publication DB path: skipped (019 schema not applied)",
  );
  process.exit(0);
}

const actor = `pub-selfcheck-${randomUUID()}`;
const correlationId = randomUUID();

const published = await publishDecisionReport(pool, {
  reportKey: "active_persons",
  filters,
  evaluationMode: "current",
  asOfDate: null,
  stableSnapshot: {
    sourceSurface: "report",
    sourceKey: "active_persons",
    filters,
    fieldIds,
    asOf: "2026-07-29",
  },
  reviewedSnapshotHash: hash,
  publisherAccountId: actor,
  permittedAudience: ["report.publication.read", "org:selfcheck"],
  reportVersion: PROVISIONAL_REPORT_VERSION,
  metricVersion: PROVISIONAL_METRIC_VERSION,
  correlationId,
  holdsPublishPermission: true,
});

assert.equal(published.status, "published");
assert.equal(published.snapshotHash, hash);
assert.equal(published.currentlyReproducible, true);
assert.ok(!JSON.stringify(published.filtersSnapshot).includes("nationalId"));

const originalFilters = JSON.stringify(published.filtersSnapshot);
const originalHash = published.snapshotHash;

const { publication: afterNotice } = await createPublicationNotice(pool, {
  publicationId: published.id,
  noticeKind: "correction",
  triggerRefType: "personnel_correction",
  triggerRefId: randomUUID(),
  note: "selfcheck notice",
  actorAccountId: actor,
  correlationId,
  holdsSupersedePermission: true,
});
assert.equal(afterNotice.status, "superseded");
assert.equal(afterNotice.hasSupersessionNotice, true);
assert.equal(JSON.stringify(afterNotice.filtersSnapshot), originalFilters);
assert.equal(afterNotice.snapshotHash, originalHash);

const disposalRunId = randomUUID();
const skippedByScope = await onRequiredSourceDisposed(pool, {
  disposalRunId: randomUUID(),
  actorAccountId: actor,
  correlationId,
  reportKey: "active_persons",
  scope: {
    scopeKind: "person",
    personIds: ["00000000-0000-4000-8000-000000000099"],
  },
});
assert.equal(
  skippedByScope.find((f) => f.publicationId === published.id),
  undefined,
  "non-intersecting person scope must not fork this publication",
);

const fork = await onRequiredSourceDisposed(pool, {
  disposalRunId,
  actorAccountId: actor,
  correlationId,
  reportKey: "active_persons",
});
const ours = fork.find((f) => f.publicationId === published.id);
assert.ok(ours);
assert.equal(ours!.outcome, "non-reproducible-after-disposal");

const afterDispose = await getDecisionPublicationById(pool, published.id);
assert.ok(afterDispose);
assert.equal(
  afterDispose!.reproducibilityState,
  "non-reproducible-after-disposal",
);
assert.equal(isCurrentlyReproducible(afterDispose!), false);
assert.equal(JSON.stringify(afterDispose!.filtersSnapshot), originalFilters);
assert.equal(afterDispose!.snapshotHash, originalHash);

await assert.rejects(
  () =>
    markNonReproducibleAfterDisposal(pool, {
      publicationId: published.id,
      disposalRunId: randomUUID(),
      actorAccountId: actor,
      holdsManagePermission: true,
    }),
  (err: unknown) =>
    err instanceof DecisionPublicationError &&
    err.code === "PUBLICATION_ALREADY_NON_REPRODUCIBLE",
);

console.log("decision-publication DB path: ok");
process.exit(0);
