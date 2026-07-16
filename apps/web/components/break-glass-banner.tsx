"use client";

import { operationalCopy } from "@/lib/operational-copy";
import { usePlatformStatus } from "@/components/platform-status-provider";

/**
 * Break-glass banner — below stale; dismissible only after grant expiry.
 * Hydrated from server grant state (Story 2.5). Dismiss clears local display
 * only — does not resurrect elevation.
 */
export function BreakGlassBanner() {
  const { breakGlass, isBreakGlassLive, setBreakGlass } = usePlatformStatus();

  const expiresMs = breakGlass.expiresAt
    ? Date.parse(breakGlass.expiresAt)
    : Number.NaN;
  const expiredPendingDismiss =
    !isBreakGlassLive &&
    breakGlass.active &&
    Number.isFinite(expiresMs);

  if (!isBreakGlassLive && !expiredPendingDismiss) return null;

  function onDismissExpired() {
    setBreakGlass({
      active: false,
      expiresAt: null,
      incidentId: null,
      grantId: null,
    });
  }

  const liveCopy = breakGlass.incidentId
    ? `${operationalCopy.breakGlassActive} ${operationalCopy.breakGlassIncidentHint.replace("{incident}", breakGlass.incidentId)}`
    : operationalCopy.breakGlassActive;

  return (
    <div
      role="status"
      aria-live="polite"
      data-banner="break-glass"
      className="border-b border-break-glass-banner-border bg-break-glass-banner-background px-4 py-2 text-body text-break-glass-banner-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{isBreakGlassLive ? liveCopy : operationalCopy.breakGlassExpired}</p>
        {expiredPendingDismiss ? (
          <button
            type="button"
            className="rounded-md px-3 py-1 text-body-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={onDismissExpired}
          >
            {operationalCopy.breakGlassDismiss}
          </button>
        ) : null}
      </div>
    </div>
  );
}
