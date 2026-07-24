/**
 * Timeline helper contracts (Story 5.3).
 * Run: pnpm --filter @divan/web selfcheck:personnel-timeline
 */
import assert from "node:assert/strict";

import {
  TIMELINE_EMPTY_COPY_FA,
  TIMELINE_MAX_LIMIT,
  TIMELINE_PAGE_SIZE,
  compareTimelineSort,
  eventTypeLabelFa,
  formatChainLinksFa,
  formatProvenanceCaption,
  shouldShowSameDayRegistrationHint,
  truncateActorLabel,
} from "./personnel-event-timeline";

function run() {
  assert.equal(TIMELINE_EMPTY_COPY_FA, "رویداد پرسنلی ثبت نشده.");
  assert.equal(TIMELINE_PAGE_SIZE, 50);
  assert.equal(TIMELINE_MAX_LIMIT, 200);
  assert.equal(eventTypeLabelFa("EventCancelled"), "لغو رویداد");
  assert.equal(eventTypeLabelFa("EventReversed"), "بازگشت رویداد");
  assert.equal(eventTypeLabelFa("EventCorrected"), "اصلاح رویداد");
  assert.equal(eventTypeLabelFa("EmploymentStarted"), "شروع همکاری (EmploymentStarted)");

  const sorted = [
    {
      effectiveDate: "2026-01-01",
      registeredAt: "2026-01-02T10:00:00.000Z",
      eventType: "B",
    },
    {
      effectiveDate: "2026-06-01",
      registeredAt: "2026-06-01T08:00:00.000Z",
      eventType: "A",
    },
    {
      effectiveDate: "2026-06-01",
      registeredAt: "2026-06-01T12:00:00.000Z",
      eventType: "Z",
    },
    {
      effectiveDate: "2026-06-01",
      registeredAt: "2026-06-01T12:00:00.000Z",
      eventType: "A",
    },
  ].sort(compareTimelineSort);

  assert.deepEqual(
    sorted.map((r) => `${r.effectiveDate}|${r.registeredAt}|${r.eventType}`),
    [
      "2026-06-01|2026-06-01T12:00:00.000Z|A",
      "2026-06-01|2026-06-01T12:00:00.000Z|Z",
      "2026-06-01|2026-06-01T08:00:00.000Z|A",
      "2026-01-01|2026-01-02T10:00:00.000Z|B",
    ],
  );

  assert.equal(
    formatChainLinksFa({
      cancellations: ["aaaaaaaa-1111"],
      reversals: [],
      corrections: ["bbbbbbbb-2222", "cccccccc-3333"],
    }),
    "لغو: aaaaaaaa · اصلاح: bbbbbbbb، cccccccc",
  );
  assert.equal(
    formatChainLinksFa({
      cancellations: [],
      reversals: [],
      corrections: [],
    }),
    null,
  );

  assert.equal(
    formatProvenanceCaption({
      referenceCode: "SC-4.1",
      provenance: { source: "selfcheck" },
    }),
    "کد مرجع: SC-4.1 · منبع: selfcheck",
  );
  assert.equal(formatProvenanceCaption({}), null);

  assert.equal(truncateActorLabel("clabcdefghijklmnop"), "clabcdef…");
  assert.equal(truncateActorLabel(""), "—");

  assert.equal(shouldShowSameDayRegistrationHint(null, "2026-06-01"), false);
  assert.equal(
    shouldShowSameDayRegistrationHint("2026-06-01", "2026-06-01"),
    true,
  );
  assert.equal(
    shouldShowSameDayRegistrationHint("2026-05-01", "2026-06-01"),
    false,
  );

  console.log("personnel-event-timeline.selfcheck: ok");
}

run();
