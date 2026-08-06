/**
 * Operations health panel (Story 7.2 / FR-45 / UJ-5).
 * Sectioned status list — not a marketing card farm; no personnel rows or deep-links.
 */

"use client";

import * as React from "react";

import { useLeaveGuardOptional } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatJalaliDateTimeFromIso } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { useSession } from "next-auth/react";

type SectionStatus =
  | "ok"
  | "degraded"
  | "red"
  | "unavailable"
  | "not_configured"
  | "evidence_recorded";

type SectionView = {
  status: SectionStatus;
  detailFa?: string;
  correlationId?: string;
  updatedAt?: string;
  pendingCount?: number;
  failedCount?: number;
  staleCount?: number;
};

function statusLabel(status: SectionStatus): string {
  switch (status) {
    case "ok":
      return operationalCopy.opsStatusOk;
    case "degraded":
      return operationalCopy.opsStatusDegraded;
    case "red":
      return operationalCopy.opsStatusRed;
    case "unavailable":
      return operationalCopy.opsStatusUnavailable;
    case "not_configured":
      return operationalCopy.opsStatusNotConfigured;
    case "evidence_recorded":
      return operationalCopy.opsStatusEvidenceRecorded;
    default:
      return operationalCopy.opsStatusUnavailable;
  }
}

/** Text + semantic token color — never color-only. */
function statusClass(status: SectionStatus): string {
  switch (status) {
    case "ok":
    case "evidence_recorded":
      return "text-foreground";
    case "degraded":
    case "not_configured":
      return "text-muted-foreground";
    case "red":
      return "text-destructive";
    case "unavailable":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

function formatCount(n: number | undefined): string | null {
  if (n === undefined) return null;
  return toPersianDigits(String(n));
}

function HealthSection(props: {
  id: string;
  title: string;
  section: SectionView;
}) {
  const { id, title, section } = props;
  const headingId = `${id}-heading`;
  const isAlert = section.status === "red";
  const pending = formatCount(section.pendingCount);
  const failed = formatCount(section.failedCount);
  const stale = formatCount(section.staleCount);

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="scroll-mt-4 border-b border-border py-4 last:border-b-0 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-title-sm font-medium text-foreground">
          {title}
        </h2>
        <p
          className={`text-body font-medium ${statusClass(section.status)}`}
          role={isAlert ? "alert" : "status"}
          aria-label={`${title}: ${statusLabel(section.status)}`}
        >
          {statusLabel(section.status)}
        </p>
      </div>
      {section.detailFa ? (
        <p className="mt-2 text-body text-muted-foreground">{section.detailFa}</p>
      ) : null}
      {(pending !== null || failed !== null || stale !== null) && (
        <ul className="mt-2 flex flex-wrap gap-4 text-caption text-muted-foreground">
          {pending !== null ? (
            <li>
              {operationalCopy.opsCountPending}: {pending}
            </li>
          ) : null}
          {failed !== null ? (
            <li>
              {operationalCopy.opsCountFailed}: {failed}
            </li>
          ) : null}
          {stale !== null ? (
            <li>
              {operationalCopy.opsCountStale}: {stale}
            </li>
          ) : null}
        </ul>
      )}
      {section.correlationId ? (
        <p className="mt-2 text-caption text-muted-foreground" dir="ltr">
          {operationalCopy.opsCorrelationLabel}:{" "}
          <span className="font-mono">{section.correlationId}</span>
        </p>
      ) : null}
      {section.updatedAt ? (
        <p className="mt-1 text-caption text-muted-foreground">
          {toPersianDigits(formatJalaliDateTimeFromIso(section.updatedAt))}
        </p>
      ) : null}
    </section>
  );
}

function OpsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function trpcErrorMessage(_err: unknown, fallback: string): string {
  // Never forward raw tRPC/infra error.message to the ops UI (7.1 lesson).
  return fallback;
}

/** App Router may not scroll to hash on client navigate — focus real section. */
function useOpsHashScroll(ready: boolean) {
  React.useEffect(() => {
    if (!ready || typeof window === "undefined") return;

    function scrollToHash() {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      const el = document.getElementById(hash);
      if (!el) return;
      el.scrollIntoView({ block: "start" });
      if (typeof el.focus === "function") {
        el.focus({ preventScroll: true });
      }
    }

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [ready]);
}

export function OperationsHealthPanel() {
  const leaveGuard = useLeaveGuardOptional();
  const { data: session } = useSession();
  // Client-safe SoD gate — do not widen ROLE_NAV_HREFS; /audit is audit_reviewer-only.
  const canOpenAuditTrust = session?.user?.coarseRole === "audit_reviewer";
  const healthQuery = api.operations.getHealth.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  useOpsHashScroll(Boolean(healthQuery.data) && !healthQuery.isLoading);

  function navigateAuditTrustReview() {
    const href = "/audit?trust=review";
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
      return;
    }
    window.location.assign(href);
  }

  if (healthQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <h2 className="text-heading-sm text-text-primary">
          {operationalCopy.opsHealthHeading}
        </h2>
        <p className="mt-2 text-body text-muted-foreground" role="status">
          {operationalCopy.opsHealthLoading}
        </p>
        <div className="mt-6">
          <OpsSkeleton />
        </div>
      </div>
    );
  }

  if (healthQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <h2 className="text-heading-sm text-text-primary">
          {operationalCopy.opsHealthHeading}
        </h2>
        <p className="mt-4 text-body text-destructive" role="alert">
          {trpcErrorMessage(
            healthQuery.error,
            operationalCopy.opsHealthLoadError,
          )}
        </p>
      </div>
    );
  }

  const snapshot = healthQuery.data;
  if (!snapshot) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <h2 className="text-heading-sm text-text-primary">
          {operationalCopy.opsHealthHeading}
        </h2>
        <p className="mt-4 text-body text-destructive" role="alert">
          {operationalCopy.opsHealthLoadError}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6">
        <h2 className="text-heading-sm text-text-primary">
          {operationalCopy.opsHealthHeading}
        </h2>
        <p className="mt-2 text-body text-muted-foreground">
          {operationalCopy.opsHealthIntro}
        </p>
        <p className="mt-2 text-caption text-muted-foreground" role="note">
          {operationalCopy.opsGateNote}
        </p>
        <p className="mt-1 text-caption text-muted-foreground" dir="ltr">
          {operationalCopy.opsCorrelationLabel}:{" "}
          <span className="font-mono">{snapshot.correlationId}</span>
        </p>
      </header>

      {snapshot.honestyFa && snapshot.honestyFa.length > 0 ? (
        <aside
          className="mb-6 rounded-md border border-border bg-muted/30 p-4"
          aria-labelledby="ops-honesty-title"
          role="status"
        >
          <h2
            id="ops-honesty-title"
            className="text-title-sm font-medium text-foreground"
          >
            {operationalCopy.opsHonestyTitle}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pe-5 text-body text-muted-foreground">
            {snapshot.honestyFa.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </aside>
      ) : null}

      <div className="flex flex-col">
        <HealthSection
          id="ops-identity"
          title={operationalCopy.opsSectionIdentity}
          section={snapshot.identity}
        />
        <HealthSection
          id="ops-service"
          title={operationalCopy.opsSectionService}
          section={snapshot.service}
        />
        <HealthSection
          id="ops-recalc"
          title={operationalCopy.opsSectionRecalc}
          section={snapshot.recalculation}
        />
        <HealthSection
          id="ops-import"
          title={operationalCopy.opsSectionImport}
          section={snapshot.import}
        />
        <HealthSection
          id="ops-backup"
          title={operationalCopy.opsSectionBackup}
          section={snapshot.backup}
        />
        <HealthSection
          id="ops-dependencies"
          title={operationalCopy.opsSectionDependencies}
          section={snapshot.dependencies}
        />
        {snapshot.configuration ? (
          <HealthSection
            id="ops-configuration"
            title={operationalCopy.opsSectionConfiguration}
            section={snapshot.configuration}
          />
        ) : null}
        {snapshot.auditTrust ? (
          <HealthSection
            id="ops-audit-trust"
            title={operationalCopy.opsSectionAuditTrust}
            section={snapshot.auditTrust}
          />
        ) : null}
      </div>
      {snapshot.auditTrust?.status === "red" ||
      snapshot.auditTrust?.status === "degraded" ? (
        <div className="mt-4 space-y-2">
          {snapshot.auditTrust.status === "red" ? (
            <p className="text-body text-destructive" role="alert">
              {operationalCopy.auditTrustSuspendedBanner}
            </p>
          ) : null}
          <p className="text-body">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-body underline underline-offset-4"
              onClick={
                canOpenAuditTrust ? navigateAuditTrustReview : undefined
              }
              disabled={!canOpenAuditTrust}
              disabledReason={
                canOpenAuditTrust
                  ? undefined
                  : operationalCopy.auditTrustReviewRequiresAuditor
              }
            >
              {operationalCopy.auditTrustReviewDeepLink}
            </Button>
          </p>
        </div>
      ) : null}
    </div>
  );
}
