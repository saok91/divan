/**
 * Timeline helper contracts (Story 5.3 / 6.3).
 * Run: pnpm --filter @divan/web selfcheck:personnel-timeline
 */
import assert from "node:assert/strict";

import { BASELINE_RECORDED_EVENT_TYPE } from "@divan/migration/event-origin";

import { operationalCopy } from "./operational-copy";
import {
  EVENT_TYPE_OPTIONS,
  TIMELINE_EMPTY_COPY_FA,
  TIMELINE_MAX_LIMIT,
  TIMELINE_PAGE_SIZE,
  compareTimelineSort,
  eventTypeLabelFa,
  formatChainLinksFa,
  formatProvenanceCaption,
  resolveTimelineBoundaryStatement,
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
  assert.equal(
    eventTypeLabelFa(BASELINE_RECORDED_EVENT_TYPE),
    operationalCopy.eventTypeBaselineRecordedFa,
  );
  assert.ok(
    !EVENT_TYPE_OPTIONS.some(
      (o) => (o.value as string) === BASELINE_RECORDED_EVENT_TYPE,
    ),
    "BaselineRecorded must not appear in form create EVENT_TYPE_OPTIONS",
  );

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

  const baselineCaption = formatProvenanceCaption({
    eventType: BASELINE_RECORDED_EVENT_TYPE,
    referenceCode: "SC-6.3",
    provenance: {
      source: "migration",
      batchId: "batch-abcdefgh",
      sourceRow: 12,
    },
  });
  assert.ok(baselineCaption);
  assert.ok(
    baselineCaption!.includes(operationalCopy.eventOriginBaselineFa),
    "Baseline caption must use Persian Baseline origin label",
  );
  assert.ok(
    !/^کد مرجع:.*· منبع: migration$/.test(baselineCaption!) &&
      !baselineCaption!.includes("منبع: migration"),
    "Baseline must not rely on sole raw منبع: migration distinguisher",
  );

  const importedCaption = formatProvenanceCaption({
    eventType: "EmploymentStarted",
    provenance: { source: "migration", batchId: "batch-imported1" },
  });
  assert.ok(importedCaption);
  assert.ok(
    importedCaption!.includes(operationalCopy.eventOriginImportedFa),
  );
  assert.notEqual(importedCaption, baselineCaption);

  const nativeCaption = formatProvenanceCaption({
    eventType: "EmploymentStarted",
    referenceCode: "SC-4.1",
    provenance: { source: "selfcheck" },
  });
  assert.ok(nativeCaption);
  assert.ok(nativeCaption!.includes(operationalCopy.eventOriginNativeFa));
  assert.ok(nativeCaption!.includes("منبع: selfcheck"));
  assert.notEqual(nativeCaption, baselineCaption);
  assert.notEqual(nativeCaption, importedCaption);

  const nativeEmptyProvenance = formatProvenanceCaption({
    eventType: "EmploymentStarted",
  });
  assert.ok(nativeEmptyProvenance);
  assert.equal(
    nativeEmptyProvenance,
    operationalCopy.eventOriginNativeFa,
    "Native with empty provenance must still show Persian origin label",
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

  const startsAt = resolveTimelineBoundaryStatement([
    {
      eventType: BASELINE_RECORDED_EVENT_TYPE,
      effectiveDate: "2026-03-01",
      provenance: { source: "migration" },
    },
    {
      eventType: "EmploymentStarted",
      effectiveDate: "2026-04-01",
      provenance: {},
    },
  ]);
  assert.ok(startsAt);
  assert.equal(startsAt!.showBaselineDate, true);
  assert.equal(
    startsAt!.messageFa,
    operationalCopy.timelineBoundaryStartsAtBaselineFa,
  );

  const withEarlierNative = resolveTimelineBoundaryStatement([
    {
      eventType: "EmploymentStarted",
      effectiveDate: "2025-01-01",
      provenance: {},
    },
    {
      eventType: BASELINE_RECORDED_EVENT_TYPE,
      effectiveDate: "2026-03-01",
      provenance: { source: "migration" },
    },
  ]);
  assert.ok(withEarlierNative);
  assert.equal(withEarlierNative!.showBaselineDate, false);
  assert.equal(
    withEarlierNative!.messageFa,
    operationalCopy.timelineBoundaryWithEarlierNativeFa,
  );
  assert.notEqual(withEarlierNative!.messageFa, startsAt!.messageFa);
  assert.ok(
    !withEarlierNative!.messageFa.includes("بومی"),
    "Earlier-events honesty must not mislabel as native-only",
  );

  const withEarlierImported = resolveTimelineBoundaryStatement([
    {
      eventType: "EmploymentStarted",
      effectiveDate: "2025-06-01",
      provenance: { source: "migration", batchId: "batch-early" },
    },
    {
      eventType: BASELINE_RECORDED_EVENT_TYPE,
      effectiveDate: "2026-03-01",
      provenance: { source: "migration" },
    },
  ]);
  assert.ok(withEarlierImported);
  assert.equal(withEarlierImported!.showBaselineDate, false);
  assert.equal(
    withEarlierImported!.messageFa,
    operationalCopy.timelineBoundaryWithEarlierNativeFa,
  );

  const incompleteWindow = resolveTimelineBoundaryStatement(
    [
      {
        eventType: BASELINE_RECORDED_EVENT_TYPE,
        effectiveDate: "2026-03-01",
        provenance: { source: "migration" },
      },
      {
        eventType: "EmploymentStarted",
        effectiveDate: "2026-04-01",
        provenance: {},
      },
    ],
    { historyMayBeIncomplete: true },
  );
  assert.ok(incompleteWindow);
  assert.equal(incompleteWindow!.showBaselineDate, false);
  assert.equal(
    incompleteWindow!.messageFa,
    operationalCopy.timelineBoundaryHistoryIncompleteFa,
  );
  assert.notEqual(
    incompleteWindow!.messageFa,
    operationalCopy.timelineBoundaryStartsAtBaselineFa,
  );

  // Same Effective Date as Baseline: Effective Date–only boundary (not registeredAt)
  const sameDayNative = resolveTimelineBoundaryStatement([
    {
      eventType: "EmploymentStarted",
      effectiveDate: "2026-03-01",
      provenance: {},
    },
    {
      eventType: BASELINE_RECORDED_EVENT_TYPE,
      effectiveDate: "2026-03-01",
      provenance: { source: "migration" },
    },
  ]);
  assert.ok(sameDayNative);
  assert.equal(sameDayNative!.showBaselineDate, true);
  assert.equal(
    sameDayNative!.messageFa,
    operationalCopy.timelineBoundaryStartsAtBaselineFa,
  );

  assert.equal(resolveTimelineBoundaryStatement([]), null);

  assert.ok(operationalCopy.importFr39BaselineEstablishedFa.trim().length > 0);
  assert.ok(operationalCopy.importFr39BoundaryHonestyFa.trim().length > 0);
  assert.ok(
    operationalCopy.importFr39ProvenanceMetadataOnlyFa.trim().length > 0,
  );
  assert.ok(
    operationalCopy.timelineBoundaryHistoryIncompleteFa.trim().length > 0,
  );

  console.log("personnel-event-timeline.selfcheck: ok");
}

run();
