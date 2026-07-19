"use client";

import { BreakGlassPanel } from "@/components/access/break-glass-panel";
import { operationalCopy } from "@/lib/operational-copy";

/**
 * Break-glass tab host with distinct warning chrome (Story 4b.5).
 * Domain panel behavior is unchanged — presentation wrapper only.
 */
export function AccessBreakGlassPanel({
  currentAccountId,
}: {
  currentAccountId?: string;
}) {
  return (
    <div className="flex w-full flex-col gap-6">
      <header
        className="rounded-md border border-break-glass-banner-border bg-break-glass-banner-background px-4 py-3 text-break-glass-banner-foreground"
        role="status"
      >
        <h1 className="text-headline-small">
          {operationalCopy.breakGlassRequestTitle}
        </h1>
        <p className="mt-1 text-body-medium opacity-90">
          {operationalCopy.breakGlassRequestHint}
        </p>
      </header>

      <BreakGlassPanel currentAccountId={currentAccountId} />
    </div>
  );
}
