"use client";

import * as React from "react";

import { useStaleBlocking } from "@/components/platform-status-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type PublicationListItem = {
  id: string;
  reportKey: string;
  status: string;
  reproducibilityState: string;
  currentlyReproducible: boolean;
  hasSupersessionNotice: boolean;
  publishedAt: string;
  snapshotHash: string;
};

function statusLabel(status: string, hasNotice: boolean): string {
  if (status === "non-reproducible-after-disposal") {
    return operationalCopy.publicationStatusNonReproducible;
  }
  if (status === "package_retained") {
    return operationalCopy.publicationStatusPackageRetained;
  }
  if (status === "superseded" || hasNotice) {
    return operationalCopy.publicationStatusSuperseded;
  }
  return operationalCopy.publicationStatusPublished;
}

function noticeKindLabel(kind: string): string {
  switch (kind) {
    case "correction":
      return operationalCopy.publicationNoticeKindCorrection;
    case "metric_policy_change":
      return operationalCopy.publicationNoticeKindMetricPolicyChange;
    case "disposal":
      return operationalCopy.publicationNoticeKindDisposal;
    case "supersession":
      return operationalCopy.publicationNoticeKindSupersession;
    default:
      return kind;
  }
}

export type DecisionPublicationPanelProps = {
  reportKey: string;
  reviewedSnapshotHash: string;
  fieldIds: readonly string[];
  evaluationMode: "current" | "as_of";
  asOfDate?: string;
  teamId?: string;
  rangeStart?: string;
  rangeEnd?: string;
};

/**
 * Formal decision publish affordance + publications list (Story 7.6 / FR-54).
 * Extends reports catalogue — distinct from export TTL panel.
 */
export function DecisionPublicationPanel({
  reportKey,
  reviewedSnapshotHash,
  fieldIds,
  evaluationMode,
  asOfDate,
  teamId,
  rangeStart,
  rangeEnd,
}: DecisionPublicationPanelProps) {
  const { isGoldCtaBlocked } = useStaleBlocking();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const utils = api.useUtils();
  const publishTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);

  const capsQuery = api.decisionPublication.capabilities.useQuery(undefined, {
    staleTime: 60_000,
  });
  const listQuery = api.decisionPublication.list.useQuery(
    { reportKey, limit: 20 },
    { staleTime: 15_000 },
  );
  const noticesQuery = api.decisionPublication.listNotices.useQuery(
    { publicationId: selectedId! },
    { enabled: Boolean(selectedId), staleTime: 15_000 },
  );

  const publishMutation = api.decisionPublication.publish.useMutation({
    onSuccess: async () => {
      setConfirmOpen(false);
      await utils.decisionPublication.list.invalidate({ reportKey });
      queueMicrotask(() => publishTriggerRef.current?.focus());
    },
  });

  const closeConfirm = React.useCallback(() => {
    setConfirmOpen(false);
    publishMutation.reset();
    queueMicrotask(() => publishTriggerRef.current?.focus());
  }, [publishMutation]);

  React.useEffect(() => {
    if (!confirmOpen) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfirm();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen, closeConfirm]);

  const canPublish = capsQuery.data?.publish === true;
  const publishDisabled =
    !canPublish ||
    isGoldCtaBlocked ||
    publishMutation.isPending ||
    !reviewedSnapshotHash;

  return (
    <section
      className="mt-4 space-y-3 border-t border-border pt-4"
      aria-label={operationalCopy.publicationListTitle}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-body font-medium">
          {operationalCopy.publicationListTitle}
        </h3>
        {canPublish ? (
          <Button
            ref={publishTriggerRef}
            type="button"
            variant="secondary"
            size="sm"
            disabled={publishDisabled}
            title={
              isGoldCtaBlocked
                ? operationalCopy.staleGoldCtaHint
                : operationalCopy.publicationPublishCta
            }
            aria-label={operationalCopy.publicationPublishCta}
            onClick={() => setConfirmOpen(true)}
            disabledReason={
              publishMutation.isPending
                ? operationalCopy.actionPending
                : isGoldCtaBlocked
                  ? operationalCopy.staleGoldCtaHint
                  : !reviewedSnapshotHash
                    ? operationalCopy.publicationSnapshotRequired
                    : !canPublish
                      ? operationalCopy.accessDeniedTitle
                      : undefined
            }
          >
            {operationalCopy.publicationPublishCta}
          </Button>
        ) : null}
        {isGoldCtaBlocked ? (
          <p className="text-caption text-muted-foreground" role="status">
            {operationalCopy.staleGoldCtaHint}
          </p>
        ) : null}
      </div>

      {capsQuery.data &&
      "capabilitiesError" in capsQuery.data &&
      capsQuery.data.capabilitiesError ? (
        <p className="text-caption text-destructive" role="alert">
          {String(capsQuery.data.capabilitiesError)}
        </p>
      ) : null}

      {listQuery.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : listQuery.isError ? (
        <p className="text-caption text-destructive" role="alert">
          {listQuery.error.message || operationalCopy.publicationLoadError}
        </p>
      ) : !listQuery.data?.items.length ? (
        <p className="text-caption text-muted-foreground">
          {operationalCopy.publicationEmpty}
        </p>
      ) : (
        <ul className="space-y-2" role="list">
          {listQuery.data.items.map((item: PublicationListItem) => (
            <li key={item.id}>
              <button
                type="button"
                className={cn(
                  "w-full rounded border border-border bg-background px-3 py-2 text-start text-caption",
                  selectedId === item.id && "ring-2 ring-ring",
                )}
                onClick={() =>
                  setSelectedId((prev) => (prev === item.id ? null : item.id))
                }
                aria-expanded={selectedId === item.id}
                aria-label={`${statusLabel(item.status, item.hasSupersessionNotice)} — ${item.id}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded bg-muted px-2 py-0.5"
                    aria-label={statusLabel(
                      item.status,
                      item.hasSupersessionNotice,
                    )}
                  >
                    {statusLabel(item.status, item.hasSupersessionNotice)}
                  </span>
                  {item.hasSupersessionNotice ? (
                    <span className="text-muted-foreground">
                      {operationalCopy.publicationHasNoticeBadge}
                    </span>
                  ) : null}
                  {!item.currentlyReproducible ? (
                    <span className="text-muted-foreground">
                      {operationalCopy.publicationNotReproducible}
                    </span>
                  ) : null}
                  <span className="text-tabular" dir="ltr">
                    {toPersianDigits(
                      new Date(item.publishedAt).toLocaleString("fa-IR"),
                    )}
                  </span>
                </span>
                <span
                  className="mt-1 block truncate font-mono text-[0.7rem] text-muted-foreground"
                  dir="ltr"
                  title={item.snapshotHash}
                >
                  {operationalCopy.publicationSnapshotHash}:{" "}
                  {item.snapshotHash.slice(0, 16)}…
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedId ? (
        <div className="space-y-1 rounded border border-border p-3">
          <p className="text-caption font-medium">
            {operationalCopy.publicationNoticesTitle}
          </p>
          {noticesQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : noticesQuery.isError ? (
            <p className="text-caption text-destructive" role="alert">
              {noticesQuery.error.message ||
                operationalCopy.publicationLoadError}
            </p>
          ) : !noticesQuery.data?.notices.length ? (
            <p className="text-caption text-muted-foreground">—</p>
          ) : (
            <ul className="space-y-1 text-caption" role="list">
              {noticesQuery.data.notices.map((n) => (
                <li key={n.id}>
                  <span className="font-medium">
                    {noticeKindLabel(n.noticeKind)}
                  </span>
                  {" — "}
                  <span dir="ltr" className="text-tabular">
                    {toPersianDigits(
                      new Date(n.createdAt).toLocaleString("fa-IR"),
                    )}
                  </span>
                  {n.note ? ` — ${n.note}` : null}
                </li>
              ))}
            </ul>
          )}
          {listQuery.data?.items.find((i) => i.id === selectedId)
            ?.currentlyReproducible === false ? (
            <p className="text-caption text-muted-foreground" role="status">
              {operationalCopy.publicationReproduceForbidden}
            </p>
          ) : null}
        </div>
      ) : null}

      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="publication-confirm-title"
          aria-describedby="publication-confirm-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConfirm();
          }}
        >
          <div className="max-w-md space-y-4 rounded-lg border border-border bg-background p-4 shadow-lg">
            <h4 id="publication-confirm-title" className="text-body font-medium">
              {operationalCopy.publicationPublishCta}
            </h4>
            <p id="publication-confirm-desc" className="text-caption">
              {operationalCopy.publicationPublishConfirm}
            </p>
            {publishMutation.isError ? (
              <p className="text-caption text-destructive" role="alert">
                {publishMutation.error.message ||
                  operationalCopy.publicationActionFailed}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                ref={cancelRef}
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeConfirm}
              >
                {operationalCopy.publicationConfirmCancel}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={publishMutation.isPending || isGoldCtaBlocked}
                onClick={() => {
                  publishMutation.mutate({
                    reportKey,
                    evaluationMode,
                    asOfDate: asOfDate ?? null,
                    teamId: teamId ?? null,
                    rangeStart: rangeStart || null,
                    rangeEnd: rangeEnd || null,
                    reviewedSnapshotHash,
                    fieldIds: [...fieldIds],
                  });
                }}
              
            disabledReason={operationalCopy.actionPending}
          >
                {operationalCopy.publicationConfirmProceed}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
