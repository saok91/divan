"use client";

import { staleRecalcMessage } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { usePlatformStatus } from "@/components/platform-status-provider";
import { cn } from "@/lib/utils";

/**
 * Blocking stale / recalculation banner (UX-DR5).
 * Keep the assertive live region mounted; toggle content when signaling.
 */
export function StaleRecalcBanner() {
  const { blockingStale, recalculationPending, stalePendingUntil } =
    usePlatformStatus();

  const active = blockingStale || recalculationPending;
  const message = active
    ? staleRecalcMessage(toPersianDigits(stalePendingUntil))
    : "";

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
    </div>
  );
}
