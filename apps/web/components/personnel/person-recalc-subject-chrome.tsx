"use client";

import { RecalcPendingMark } from "@/components/personnel/recalc-pending-mark";
import { GlossaryTerm } from "@/components/glossary/glossary-term";
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";

/**
 * Subject chrome when the selected person is pending/stale/failed (Story 8.9).
 * Uses authorized getCurrentState only — no unscoped pending listing.
 */
export function PersonRecalcSubjectChrome({ personId }: { personId: string }) {
  const stateQuery = api.person.getCurrentState.useQuery(
    { personId },
    { enabled: Boolean(personId.trim()), retry: false },
  );

  const glossary = (
    <div className="flex flex-wrap gap-2">
      <GlossaryTerm termKey="personnelEvent" />
      <GlossaryTerm termKey="currentState" />
    </div>
  );

  if (!personId.trim()) {
    return glossary;
  }

  if (stateQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {glossary}
        <RecalcPendingMark />
      </div>
    );
  }

  if (stateQuery.isError) {
    return (
      <div className="flex flex-col gap-2">
        {glossary}
        <p className="text-caption text-destructive" role="alert">
          {operationalCopy.personListError}
        </p>
      </div>
    );
  }

  const data = stateQuery.data;
  if (data && data.ok === false) {
    const recalcBlocked =
      data.code === "RECALCULATION_PENDING" ||
      data.code === "RECALCULATION_FAILED" ||
      data.code === "RECALCULATION_STALE";

    return (
      <div className="flex flex-col gap-2">
        {glossary}
        {recalcBlocked ? <RecalcPendingMark /> : null}
        <p
          className={
            recalcBlocked
              ? "text-caption text-text-tertiary"
              : "text-caption text-destructive"
          }
          role={recalcBlocked ? "status" : "alert"}
        >
          {data.messageFa}
        </p>
      </div>
    );
  }

  return glossary;
}
