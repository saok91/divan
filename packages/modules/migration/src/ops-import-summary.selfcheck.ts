/**
 * Self-check for ops import aggregate (Story 7.2).
 * Run: pnpm --filter @divan/migration selfcheck:ops-import
 */
import assert from "node:assert/strict";

import { getOpsImportBatchSummary } from "./ops-import-summary";

async function main() {
  // Fake queryable that throws — schema missing path.
  const throwingDb = {
    query: async () => {
      throw new Error("relation does not exist");
    },
  };

  const summary = await getOpsImportBatchSummary(
    throwingDb as never,
  );
  assert.equal(summary.schemaAvailable, false);
  assert.equal(summary.totalBatches, 0);
  assert.equal(summary.recentFailedCount, 0);
  assert.equal(summary.unknownStatusCount, 0);
  assert.ok(summary.honestyFa.length > 0);
  assert.ok(!/"personId"\s*:/i.test(JSON.stringify(summary)));
  assert.ok(!/"personnelCode"\s*:/i.test(JSON.stringify(summary)));

  const countingDb = {
    query: async (sql: string) => {
      if (sql.includes("GROUP BY")) {
        return {
          rows: [
            { status: "failed", c: 2 },
            { status: "cutover-complete", c: 1 },
            { status: "mystery-future-status", c: 4 },
          ],
        };
      }
      if (sql.includes("failed")) {
        return { rows: [{ c: 2 }] };
      }
      return { rows: [] };
    },
  };
  const counted = await getOpsImportBatchSummary(countingDb as never);
  assert.equal(counted.schemaAvailable, true);
  assert.equal(counted.totalBatches, 7);
  assert.equal(counted.recentFailedCount, 2);
  assert.equal(counted.byStatus.failed, 2);
  assert.equal(counted.unknownStatusCount, 4);
  assert.ok(!JSON.stringify(counted).includes("personId"));

  const emptyDb = {
    query: async () => ({ rows: [] }),
  };
  const empty = await getOpsImportBatchSummary(emptyDb as never);
  assert.equal(empty.schemaAvailable, true);
  assert.equal(empty.totalBatches, 0);

  console.log("ops-import selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
