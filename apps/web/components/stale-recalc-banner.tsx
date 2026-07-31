"use client";

import {
  operationalCopy,
  staleRecalcMessage,
} from "@/lib/operational-copy";
import { usePlatformStatus } from "@/components/platform-status-provider";
import { cn } from "@/lib/utils";

/**
 * Blocking stale / recalculation banner (UX-DR5 / Story 8.9).
 * Keep the assertive live region mounted; toggle content when signaling.
 * Never present internal recalc timestamps as a UI deadline.
 */
export function StaleRecalcBanner() {
  const {
    blockingStale,
    recalculationPending,
    affectedPersonCount,
  } = usePlatformStatus();

  const active = blockingStale || recalculationPending;
  const message = active ? staleRecalcMessage(affectedPersonCount) : "";

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      data-banner="stale-recalc"
      data-active={active ? "true" : "false"}
      className={cn(
        "border-b border-stale-banner-border bg-stale-banner-background px-4 py-2 text-body text-stale-banner-foreground",
        !active && "hidden",
      )}
    >
      <p>{message}</p>
      {active ? (
        <details className="mt-1 text-caption" data-banner-disclosure="stale-recalc">
          <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden underline-offset-2 hover:underline">
            {operationalCopy.staleRecalcDisclosureSummary}
          </summary>
          <p className="mt-1 text-stale-banner-foreground/90">
            {operationalCopy.staleRecalcDisclosureBody}
          </p>
        </details>
      ) : null}
    </div>
  );
}
