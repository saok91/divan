"use client";

import * as React from "react";

import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { cn } from "@/lib/utils";
import { useLeaveGuardOptional } from "@/components/leave-guard/leave-guard-context";

export type DashboardMetricCardProps = {
  titleFa: string;
  outcome:
    | "allowed"
    | "empty"
    | "suppressed"
    | "error"
    | "pending"
    | "omitted";
  value: number | null;
  messageFa?: string;
  detailsLines?: string[];
  reconcileHref?: string;
  reconcileLabelFa?: string;
  className?: string;
};

/**
 * UX-DR15 metric card: heading-sm name, heading value (Persian digits),
 * caption reconciliation link; suppress ≠ empty ≠ zero.
 */
export function DashboardMetricCard({
  titleFa,
  outcome,
  value,
  messageFa,
  detailsLines,
  reconcileHref,
  reconcileLabelFa,
  className,
}: DashboardMetricCardProps) {
  const leaveGuard = useLeaveGuardOptional();
  const headingId = React.useId();

  if (outcome === "omitted") return null;

  let body: React.ReactNode;
  if (outcome === "suppressed") {
    body = (
      <p role="status" aria-live="polite" className="text-heading text-foreground">
        {messageFa || operationalCopy.suppressedCohort}
      </p>
    );
  } else if (outcome === "empty") {
    body = (
      <p
        role="status"
        aria-live="polite"
        className="text-body text-muted-foreground"
      >
        {messageFa || operationalCopy.emptyDashboardScope}
      </p>
    );
  } else if (outcome === "pending") {
    body = (
      <p
        role="status"
        aria-live="polite"
        className="text-body text-text-tertiary"
      >
        {messageFa || operationalCopy.figureRecalculating}
      </p>
    );
  } else if (outcome === "error") {
    body = (
      <p role="alert" className="text-body text-destructive">
        {messageFa || operationalCopy.dashboardLoadError}
      </p>
    );
  } else {
    body = (
      <p className="text-heading tabular-nums text-foreground">
        {value == null ? "—" : toPersianDigits(value)}
      </p>
    );
  }

  const onReconcile = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!reconcileHref) return;
    if (!leaveGuard) return;
    e.preventDefault();
    void leaveGuard.requestNavigation(reconcileHref);
  };

  return (
    <article
      aria-labelledby={headingId}
      tabIndex={0}
      className={cn(
        "flex flex-col gap-2 rounded-md border border-border bg-background p-4",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <h3 id={headingId} className="text-heading-sm text-foreground">
        {titleFa}
      </h3>
      {body}
      {outcome === "allowed" && detailsLines && detailsLines.length > 0 ? (
        <ul className="space-y-0.5 text-caption text-muted-foreground">
          {detailsLines.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>
      ) : null}
      {reconcileHref && reconcileLabelFa && outcome === "allowed" ? (
        <a
          href={reconcileHref}
          onClick={onReconcile}
          className="text-caption text-primary underline-offset-2 hover:underline"
        >
          {reconcileLabelFa}
        </a>
      ) : null}
    </article>
  );
}
