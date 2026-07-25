/**
 * Event-origin classification contracts (Story 6.3 / FR-39).
 * Run: pnpm --filter @divan/migration selfcheck:event-origin
 */
import assert from "node:assert/strict";

import {
  BASELINE_RECORDED_EVENT_TYPE,
  classifyEventOrigin,
  isMigrationProvenance,
} from "./event-origin";

function run() {
  assert.equal(BASELINE_RECORDED_EVENT_TYPE, "BaselineRecorded");

  assert.equal(isMigrationProvenance({ source: "migration" }), true);
  assert.equal(isMigrationProvenance({ source: " migration " }), true);
  assert.equal(isMigrationProvenance({ source: "selfcheck" }), false);
  assert.equal(isMigrationProvenance({ source: 1 }), false);
  assert.equal(isMigrationProvenance({}), false);
  assert.equal(isMigrationProvenance(null), false);
  assert.equal(isMigrationProvenance(undefined), false);

  assert.equal(
    classifyEventOrigin({
      eventType: BASELINE_RECORDED_EVENT_TYPE,
      provenance: { source: "migration", batchId: "b1" },
    }),
    "baseline",
  );
  assert.equal(
    classifyEventOrigin({
      eventType: BASELINE_RECORDED_EVENT_TYPE,
      provenance: null,
    }),
    "baseline",
  );
  assert.equal(
    classifyEventOrigin({
      eventType: "EmploymentStarted",
      provenance: { source: "migration", batchId: "b1" },
    }),
    "imported",
  );
  assert.equal(
    classifyEventOrigin({
      eventType: "EmploymentStarted",
      provenance: {},
    }),
    "native",
  );
  assert.equal(
    classifyEventOrigin({
      eventType: "EventCancelled",
      provenance: { source: "cancel" },
    }),
    "native",
  );
  assert.equal(
    classifyEventOrigin({
      eventType: "EventReversed",
      provenance: { source: "reverse" },
    }),
    "native",
  );
  assert.equal(
    classifyEventOrigin({
      eventType: "EventCorrected",
      provenance: { source: "correct" },
    }),
    "native",
  );

  console.log("event-origin.selfcheck: ok");
}

run();
