"use client";

import type { MouseEvent } from "react";
import { useSession } from "next-auth/react";

import { useLeaveGuardOptional } from "@/components/leave-guard";
import { usePlatformStatus } from "@/components/platform-status-provider";
import {
  isStaleRecalcOpsRole,
  operationalCopy,
  staleRecalcDisclosureBody,
  staleRecalcMessage,
} from "@/lib/operational-copy";
import { cn } from "@/lib/utils";

/**
 * Blocking stale / recalculation banner (UX-DR5 / Story 8.9 / 11.1).
 * Keep the assertive live region mounted; toggle content when signaling.
 * Never present internal recalc timestamps as a UI deadline.
 * Role-honest next step: SysAdmin deep-links to «بازمحاسبه»; others wait/contact.
 */
export function StaleRecalcBanner() {
  const {
    blockingStale,
    recalculationPending,
    affectedPersonCount,
  } = usePlatformStatus();
  const { data: session, status: sessionStatus } = useSession();
  const leaveGuard = useLeaveGuardOptional();
  const roleReady = sessionStatus !== "loading";
  const coarseRole = session?.user?.coarseRole;
  const showOpsLink = roleReady && isStaleRecalcOpsRole(coarseRole);

  const active = blockingStale || recalculationPending;
  const message = active ? staleRecalcMessage(affectedPersonCount) : "";
  const disclosure = active
    ? roleReady
      ? staleRecalcDisclosureBody(coarseRole)
      : operationalCopy.staleRecalcDisclosureBodySessionLoading
    : "";

  function navigateOpsRecalc(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const href = operationalCopy.staleRecalcOpsDeepLinkHref;
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
      return;
    }
    window.location.assign(href);
  }

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
          <p className="mt-1 text-stale-banner-foreground/90">{disclosure}</p>
          {showOpsLink ? (
            <p className="mt-1">
              <a
                href={operationalCopy.staleRecalcOpsDeepLinkHref}
                onClick={navigateOpsRecalc}
                className="underline underline-offset-2 hover:text-stale-banner-foreground"
              >
                {operationalCopy.staleRecalcOpsDeepLinkLabel}
              </a>
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
