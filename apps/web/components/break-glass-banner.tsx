"use client";

import { operationalCopy } from "@/lib/operational-copy";
import { usePlatformStatus } from "@/components/platform-status-provider";

/**
 * Break-glass banner — below stale; dismissible only after grant expiry.
 * Real grant lifecycle is Story 2.5; this is the UI contract + mock.
 *
 * Expiry UI: when grant was active and is no longer live but `active` is still
 * true with an expiresAt, show dismiss. Dismiss clears grant state in provider.
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
    setBreakGlass({ active: false, expiresAt: null });
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-banner="break-glass"
      className="border-b border-break-glass-banner-border bg-break-glass-banner-background px-4 py-2 text-body text-break-glass-banner-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          {isBreakGlassLive
            ? operationalCopy.breakGlassActive
            : operationalCopy.breakGlassExpired}
        </p>
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
