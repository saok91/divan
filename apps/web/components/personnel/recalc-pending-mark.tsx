"use client";

import { operationalCopy } from "@/lib/operational-copy";
import { cn } from "@/lib/utils";

/**
 * In-place mark when a person's current state is pending/stale/failed (Story 8.9).
 */
export function RecalcPendingMark({
  className,
  compact = false,
}: {
  className?: string;
  /** Row badge — shorter chrome. */
  compact?: boolean;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      data-recalc-pending-mark="true"
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-stale-banner-border bg-stale-banner-background px-1.5 py-0.5 text-caption text-stale-banner-foreground",
        className,
      )}
    >
      {compact
        ? operationalCopy.figureRecalculatingCompact
        : operationalCopy.figureRecalculating}
    </span>
  );
}
