"use client";

/**
 * Ops honesty line for evaluation-snapshot integrity (Story 7.8 / FR-56).
 * No HR rows — counts only. Enforcement stays on domain paths.
 */

import { toPersianDigits } from "@/lib/persian-digits";
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";

export function EvaluationSnapshotHonestyLine() {
  const capsQuery = api.evaluationSnapshot.capabilities.useQuery();
  const signalsQuery = api.evaluationSnapshot.integritySignals.useQuery(
    undefined,
    { enabled: capsQuery.data?.canRead === true },
  );

  if (capsQuery.isError) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {operationalCopy.evaluationSnapshotCapabilitiesError}
      </p>
    );
  }

  if (capsQuery.data && !capsQuery.data.canRead) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {operationalCopy.evaluationSnapshotDenied}
      </p>
    );
  }

  if (!capsQuery.data?.canRead) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {operationalCopy.evaluationSnapshotLoading}
      </p>
    );
  }

  if (signalsQuery.isError || signalsQuery.data?.softDenied) {
    return (
      <section aria-labelledby="eval-snap-honesty-heading" className="space-y-1">
        <h2 id="eval-snap-honesty-heading" className="text-base font-medium">
          {operationalCopy.evaluationSnapshotHonestyHeading}
        </h2>
        <p className="text-sm text-muted-foreground" role="status">
          {operationalCopy.evaluationSnapshotLoadError}
        </p>
      </section>
    );
  }

  const s = signalsQuery.data;
  if (!s) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {operationalCopy.evaluationSnapshotLoading}
      </p>
    );
  }

  return (
    <section aria-labelledby="eval-snap-honesty-heading" className="space-y-2">
      <h2 id="eval-snap-honesty-heading" className="text-base font-medium">
        {operationalCopy.evaluationSnapshotHonestyHeading}
      </h2>
      <p className="text-sm text-muted-foreground">
        {operationalCopy.evaluationSnapshotHonestyIntro}
      </p>
      <ul className="flex flex-wrap gap-4 text-sm" role="list">
        <li>
          {operationalCopy.evaluationSnapshotSignalActive}:{" "}
          <span>{toPersianDigits(String(s.active))}</span>
        </li>
        <li>
          {operationalCopy.evaluationSnapshotSignalConsumed}:{" "}
          <span>{toPersianDigits(String(s.consumed))}</span>
        </li>
        <li>
          {operationalCopy.evaluationSnapshotSignalExpired}:{" "}
          <span>{toPersianDigits(String(s.expired))}</span>
        </li>
      </ul>
    </section>
  );
}
