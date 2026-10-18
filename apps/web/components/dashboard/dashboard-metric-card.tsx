"use client";

import * as React from "react";

import { useLeaveGuardOptional } from "@/components/leave-guard/leave-guard-context";
import { Panel } from "@/components/layout/panel-section";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { formatJalaliDateTimeFromIso } from "@/lib/jalali";
import { cn } from "@/lib/utils";

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
  /** ISO / display timestamp — visible on allowed and banner-adjacent cards. */
  lastCalculatedAt?: string | null;
  /** Optional chart slot (workforce trend / dual-series). */
  chart?: React.ReactNode;
  className?: string;
};

/**
 * UX-DR15 metric surface: Panel/hairline posture (8.2), FeedbackMessage outcomes,
 * lastCalc, suppress ≠ empty ≠ zero (Story 9.10).
 */
export function DashboardMetricCard({
  titleFa,
  outcome,
  value,
  messageFa,
  detailsLines,
  reconcileHref,
  reconcileLabelFa,
  lastCalculatedAt,
  chart,
  className,
}: DashboardMetricCardProps) {
  const leaveGuard = useLeaveGuardOptional();
  const headingId = React.useId();

  if (outcome === "omitted") return null;

  let body: React.ReactNode;
  if (outcome === "suppressed") {
    body = (
      <FeedbackMessage kind="info">
        {messageFa || operationalCopy.suppressedCohort}
      </FeedbackMessage>
    );
  } else if (outcome === "empty") {
    body = (
      <FeedbackMessage kind="empty">
        {messageFa || operationalCopy.emptyDashboardScope}
      </FeedbackMessage>
    );
  } else if (outcome === "pending") {
    body = (
      <FeedbackMessage kind="pending" className="opacity-70">
        {messageFa || operationalCopy.figureRecalculating}
      </FeedbackMessage>
    );
  } else if (outcome === "error") {
    body = (
      <FeedbackMessage kind="error">
        {messageFa || operationalCopy.dashboardLoadError}
      </FeedbackMessage>
    );
  } else {
    body = (
      <p className="text-heading text-tabular text-foreground tabular-nums">
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

  const lastCalc =
    lastCalculatedAt != null && lastCalculatedAt !== "" ? (
      <p className="text-caption text-muted-foreground">
        آخرین محاسبه:{" "}
        <span className="text-tabular tabular-nums" dir="ltr">
          {formatJalaliDateTimeFromIso(lastCalculatedAt)}
        </span>
      </p>
    ) : null;

  return (
    <Panel
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-2 border-b border-hairline p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <h3 id={headingId} className="text-heading-sm text-foreground">
        {titleFa}
      </h3>
      {body}
      {outcome === "allowed" && chart ? chart : null}
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
      {lastCalc}
    </Panel>
  );
}
