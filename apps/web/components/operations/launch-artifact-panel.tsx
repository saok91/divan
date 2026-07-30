/**
 * Launch Artifact Register panel under عملیات (Story 7.7 / FR-55).
 * One job: list AR ids + status signals; drawers for waiver/conflict/rebaseline.
 * Status not color-only; Persian RTL + digits; error ≠ empty.
 */

"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";

type RegisterStatus =
  | "pending"
  | "partial_freeze"
  | "approved"
  | "superseded"
  | "expired";

function registerStatusLabel(status: RegisterStatus): string {
  switch (status) {
    case "pending":
      return operationalCopy.launchArtifactStatusPending;
    case "partial_freeze":
      return operationalCopy.launchArtifactStatusPartialFreeze;
    case "approved":
      return operationalCopy.launchArtifactStatusApproved;
    case "superseded":
      return operationalCopy.launchArtifactStatusSuperseded;
    case "expired":
      return operationalCopy.launchArtifactStatusExpired;
    default:
      return status;
  }
}

function versionStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return operationalCopy.launchArtifactVersionDraft;
    case "approved":
      return operationalCopy.launchArtifactStatusApproved;
    case "superseded":
      return operationalCopy.launchArtifactStatusSuperseded;
    case "expired":
      return operationalCopy.launchArtifactStatusExpired;
    default:
      return status;
  }
}

function trpcErrorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    const msg = (err as { message: string }).message.trim();
    if (msg && !/^[A-Z0-9_]+$/.test(msg)) return msg;
  }
  return fallback;
}

export function LaunchArtifactPanel() {
  const capsQuery = api.launchArtifact.capabilities.useQuery();
  const listQuery = api.launchArtifact.listArtifacts.useQuery(undefined, {
    enabled: capsQuery.data?.canRead === true,
  });
  const conflictsQuery = api.launchArtifact.listConflicts.useQuery(undefined, {
    enabled: capsQuery.data?.canRead === true,
  });
  const rebaselinesQuery = api.launchArtifact.listRebaselines.useQuery(
    undefined,
    { enabled: capsQuery.data?.canRead === true },
  );
  const waiversQuery = api.launchArtifact.listOpenWaivers.useQuery(undefined, {
    enabled: capsQuery.data?.canRead === true,
  });

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const versionsQuery = api.launchArtifact.listVersions.useQuery(
    { artifactId: selectedId as "AR-ACCESS" },
    { enabled: !!selectedId },
  );

  const utils = api.useUtils();
  const issueWaiver = api.launchArtifact.issueWaiver.useMutation({
    onSuccess: async () => {
      await utils.launchArtifact.listArtifacts.invalidate();
      await utils.launchArtifact.listOpenWaivers.invalidate();
      setWaiverOpen(false);
    },
  });
  const closeWaiver = api.launchArtifact.closeWaiver.useMutation({
    onSuccess: async () => {
      await utils.launchArtifact.listOpenWaivers.invalidate();
      await utils.launchArtifact.listArtifacts.invalidate();
      setClosingWaiverId(null);
    },
  });
  const requireRebaseline = api.launchArtifact.requireRebaseline.useMutation({
    onSuccess: async () => {
      await utils.launchArtifact.listRebaselines.invalidate();
      await utils.launchArtifact.listArtifacts.invalidate();
      setRebaselineOpen(false);
    },
  });
  const openConflict = api.launchArtifact.openConflict.useMutation({
    onSuccess: async () => {
      await utils.launchArtifact.listConflicts.invalidate();
      await utils.launchArtifact.listArtifacts.invalidate();
      setConflictOpen(false);
    },
  });
  const resolveConflictMut = api.launchArtifact.resolveConflict.useMutation({
    onSuccess: async () => {
      await utils.launchArtifact.listConflicts.invalidate();
      await utils.launchArtifact.listArtifacts.invalidate();
      setResolvingConflictId(null);
    },
  });

  const [waiverOpen, setWaiverOpen] = React.useState(false);
  const [conflictOpen, setConflictOpen] = React.useState(false);
  const [rebaselineOpen, setRebaselineOpen] = React.useState(false);
  const [closingWaiverId, setClosingWaiverId] = React.useState<string | null>(
    null,
  );
  const [resolvingConflictId, setResolvingConflictId] = React.useState<
    string | null
  >(null);
  const [confirmApprove, setConfirmApprove] = React.useState<{
    kind: "version" | "rebaseline";
    id: string;
  } | null>(null);
  const [independentApprover, setIndependentApprover] = React.useState("");

  const approveVersion = api.launchArtifact.approveVersion.useMutation({
    onSuccess: async () => {
      await utils.launchArtifact.listVersions.invalidate();
      await utils.launchArtifact.listArtifacts.invalidate();
      setConfirmApprove(null);
      setIndependentApprover("");
    },
  });
  const approveRebaseline = api.launchArtifact.approveRebaseline.useMutation({
    onSuccess: async () => {
      await utils.launchArtifact.listRebaselines.invalidate();
      await utils.launchArtifact.listArtifacts.invalidate();
      setConfirmApprove(null);
      setIndependentApprover("");
    },
  });

  const confirmPending =
    approveVersion.isPending || approveRebaseline.isPending;
  const confirmError =
    approveVersion.isError || approveRebaseline.isError
      ? trpcErrorMessage(
          approveVersion.error ?? approveRebaseline.error,
          operationalCopy.launchArtifactActionFailed,
        )
      : null;

  const dialogRef = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (confirmApprove) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [confirmApprove]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setConfirmApprove(null);
        setIndependentApprover("");
      }
    }
    if (confirmApprove) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmApprove]);

  if (capsQuery.isLoading || (capsQuery.data?.canRead && listQuery.isLoading)) {
    return (
      <section aria-busy="true" className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  if (capsQuery.isError) {
    return (
      <p role="alert" className="text-body text-destructive">
        {trpcErrorMessage(
          capsQuery.error,
          operationalCopy.launchArtifactCapabilitiesError,
        )}
      </p>
    );
  }

  if (!capsQuery.data?.canRead) {
    return (
      <p role="status" className="text-body text-muted-foreground">
        {operationalCopy.launchArtifactDenied}
      </p>
    );
  }

  if (listQuery.isError) {
    return (
      <p role="alert" className="text-body text-destructive">
        {trpcErrorMessage(
          listQuery.error,
          operationalCopy.launchArtifactLoadError,
        )}
      </p>
    );
  }

  const artifacts = listQuery.data?.artifacts ?? [];
  const signals = listQuery.data?.signals;

  return (
    <section className="space-y-6" aria-labelledby="launch-artifact-heading">
      <div>
        <h2 id="launch-artifact-heading" className="text-title font-medium">
          {operationalCopy.launchArtifactHeading}
        </h2>
        <p className="mt-1 text-body text-muted-foreground">
          {operationalCopy.launchArtifactIntro}
        </p>
      </div>

      {signals ? (
        <ul className="flex flex-wrap gap-4 text-caption text-muted-foreground">
          <li>
            {operationalCopy.launchArtifactSignalOpenWaivers}:{" "}
            {toPersianDigits(String(signals.openWaivers))}
          </li>
          <li>
            {operationalCopy.launchArtifactSignalOpenConflicts}:{" "}
            {toPersianDigits(String(signals.openConflicts))}
          </li>
          <li>
            {operationalCopy.launchArtifactSignalOpenRebaselines}:{" "}
            {toPersianDigits(String(signals.openRebaselines))}
          </li>
          <li>
            {operationalCopy.launchArtifactSignalExpired}:{" "}
            {toPersianDigits(String(signals.expiredArtifacts))}
          </li>
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {capsQuery.data.canWaiver ? (
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-body"
            onClick={() => setWaiverOpen((v) => !v)}
          >
            {operationalCopy.launchArtifactIssueWaiver}
          </button>
        ) : null}
        {capsQuery.data.canManage ? (
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-body"
            onClick={() => setConflictOpen((v) => !v)}
          >
            {operationalCopy.launchArtifactOpenConflict}
          </button>
        ) : null}
        {capsQuery.data.canRebaseline ? (
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-body"
            onClick={() => setRebaselineOpen((v) => !v)}
          >
            {operationalCopy.launchArtifactRequireRebaseline}
          </button>
        ) : null}
      </div>

      {waiverOpen ? (
        <WaiverForm
          onCancel={() => setWaiverOpen(false)}
          pending={issueWaiver.isPending}
          error={
            issueWaiver.isError
              ? trpcErrorMessage(
                  issueWaiver.error,
                  operationalCopy.launchArtifactActionFailed,
                )
              : null
          }
          onSubmit={(values) => issueWaiver.mutate(values)}
        />
      ) : null}

      {conflictOpen ? (
        <ConflictForm
          onCancel={() => setConflictOpen(false)}
          pending={openConflict.isPending}
          error={
            openConflict.isError
              ? trpcErrorMessage(
                  openConflict.error,
                  operationalCopy.launchArtifactActionFailed,
                )
              : null
          }
          onSubmit={(values) => openConflict.mutate(values)}
        />
      ) : null}

      {rebaselineOpen ? (
        <RebaselineForm
          onCancel={() => setRebaselineOpen(false)}
          pending={requireRebaseline.isPending}
          error={
            requireRebaseline.isError
              ? trpcErrorMessage(
                  requireRebaseline.error,
                  operationalCopy.launchArtifactActionFailed,
                )
              : null
          }
          onSubmit={(values) => requireRebaseline.mutate(values)}
        />
      ) : null}

      <ul className="divide-y divide-border border border-border">
        {artifacts.map((artifact) => (
          <li key={artifact.id}>
            <button
              type="button"
              className="flex w-full flex-col items-start gap-1 px-3 py-3 text-start hover:bg-muted/40"
              onClick={() =>
                setSelectedId((prev) =>
                  prev === artifact.id ? null : artifact.id,
                )
              }
              aria-expanded={selectedId === artifact.id}
            >
              <span className="font-mono text-body" dir="ltr">
                {artifact.id}
              </span>
              <span className="text-body">{artifact.title}</span>
              <span className="text-caption text-muted-foreground">
                {registerStatusLabel(artifact.status as RegisterStatus)}
                {artifact.currentVersionId
                  ? ` · ${operationalCopy.launchArtifactHasVersion}`
                  : ` · ${operationalCopy.launchArtifactNoVersion}`}
              </span>
            </button>
            {selectedId === artifact.id ? (
              <div className="border-t border-border bg-muted/20 px-3 py-3">
                <p className="text-caption text-muted-foreground">
                  {artifact.purposeSummary}
                </p>
                {versionsQuery.isLoading ? (
                  <Skeleton className="mt-2 h-16 w-full" />
                ) : versionsQuery.isError ? (
                  <p role="alert" className="mt-2 text-body text-destructive">
                    {trpcErrorMessage(
                      versionsQuery.error,
                      operationalCopy.launchArtifactLoadError,
                    )}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {(versionsQuery.data ?? []).map((v) => (
                      <li
                        key={v.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-caption"
                      >
                        <span>
                          <span className="font-mono" dir="ltr">
                            {v.versionLabel}
                          </span>{" "}
                          — {versionStatusLabel(v.status)}
                        </span>
                        {v.status === "draft" && capsQuery.data.canApprove ? (
                          <button
                            type="button"
                            className="rounded border border-border px-2 py-1"
                            onClick={() =>
                              setConfirmApprove({
                                kind: "version",
                                id: v.id,
                              })
                            }
                          >
                            {operationalCopy.launchArtifactApproveVersion}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {conflictsQuery.isError ? (
        <p role="alert" className="text-body text-destructive">
          {trpcErrorMessage(
            conflictsQuery.error,
            operationalCopy.launchArtifactLoadError,
          )}
        </p>
      ) : (conflictsQuery.data ?? []).some((c) => c.status === "open") ? (
        <section aria-labelledby="launch-conflict-heading">
          <h3 id="launch-conflict-heading" className="text-body font-medium">
            {operationalCopy.launchArtifactConflictsHeading}
          </h3>
          <ul className="mt-2 space-y-2 text-caption">
            {(conflictsQuery.data ?? [])
              .filter((c) => c.status === "open")
              .map((c) => (
                <li key={c.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="text-destructive">
                        {operationalCopy.launchArtifactBadgeConflictOpen}
                      </span>{" "}
                      — {c.summary} ({c.artifactIds.join(", ")})
                    </span>
                    {capsQuery.data.canApprove ? (
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1"
                        onClick={() =>
                          setResolvingConflictId(
                            resolvingConflictId === c.id ? null : c.id,
                          )
                        }
                      >
                        {operationalCopy.launchArtifactResolveConflict}
                      </button>
                    ) : null}
                  </div>
                  {resolvingConflictId === c.id ? (
                    <ResolveConflictForm
                      pending={resolveConflictMut.isPending}
                      error={
                        resolveConflictMut.isError
                          ? trpcErrorMessage(
                              resolveConflictMut.error,
                              operationalCopy.launchArtifactActionFailed,
                            )
                          : null
                      }
                      onCancel={() => setResolvingConflictId(null)}
                      onSubmit={(values) =>
                        resolveConflictMut.mutate({
                          conflictId: c.id,
                          ...values,
                        })
                      }
                    />
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {waiversQuery.isError ? (
        <p role="alert" className="text-body text-destructive">
          {trpcErrorMessage(
            waiversQuery.error,
            operationalCopy.launchArtifactLoadError,
          )}
        </p>
      ) : (waiversQuery.data ?? []).length > 0 ? (
        <section aria-labelledby="launch-waiver-heading">
          <h3 id="launch-waiver-heading" className="text-body font-medium">
            {operationalCopy.launchArtifactWaiversHeading}
          </h3>
          <ul className="mt-2 space-y-2 text-caption">
            {(waiversQuery.data ?? []).map((w) => (
              <li key={w.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="text-destructive">
                      {operationalCopy.launchArtifactBadgeWaiverOpen}
                    </span>{" "}
                    — {w.artifactId} / {w.scope}
                  </span>
                  {capsQuery.data.canWaiver ? (
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1"
                      onClick={() =>
                        setClosingWaiverId(
                          closingWaiverId === w.id ? null : w.id,
                        )
                      }
                    >
                      {operationalCopy.launchArtifactCloseWaiver}
                    </button>
                  ) : null}
                </div>
                {closingWaiverId === w.id ? (
                  <CloseWaiverForm
                    pending={closeWaiver.isPending}
                    error={
                      closeWaiver.isError
                        ? trpcErrorMessage(
                            closeWaiver.error,
                            operationalCopy.launchArtifactActionFailed,
                          )
                        : null
                    }
                    onCancel={() => setClosingWaiverId(null)}
                    onSubmit={(closureEvidence) =>
                      closeWaiver.mutate({
                        waiverId: w.id,
                        closureEvidence,
                      })
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rebaselinesQuery.isError ? (
        <p role="alert" className="text-body text-destructive">
          {trpcErrorMessage(
            rebaselinesQuery.error,
            operationalCopy.launchArtifactLoadError,
          )}
        </p>
      ) : (rebaselinesQuery.data ?? []).some(
        (r) => r.status === "required" || r.status === "in_review",
      ) ? (
        <section aria-labelledby="launch-rebaseline-heading">
          <h3 id="launch-rebaseline-heading" className="text-body font-medium">
            {operationalCopy.launchArtifactRebaselinesHeading}
          </h3>
          <ul className="mt-2 space-y-2 text-caption">
            {(rebaselinesQuery.data ?? [])
              .filter(
                (r) => r.status === "required" || r.status === "in_review",
              )
              .map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    <span className="text-destructive">
                      {operationalCopy.launchArtifactBadgeRebaselineRequired}
                    </span>{" "}
                    — {r.changeSummary}
                  </span>
                  {capsQuery.data.canRebaseline ? (
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1"
                      onClick={() =>
                        setConfirmApprove({ kind: "rebaseline", id: r.id })
                      }
                    >
                      {operationalCopy.launchArtifactApproveRebaseline}
                    </button>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <dialog
        ref={dialogRef}
        className="max-w-md rounded-md border border-border bg-background p-4 text-foreground shadow-lg"
        aria-labelledby="launch-confirm-title"
        onClose={() => {
          setConfirmApprove(null);
          setIndependentApprover("");
        }}
      >
        <h3 id="launch-confirm-title" className="text-body font-medium">
          {operationalCopy.launchArtifactConfirmTitle}
        </h3>
        <p className="mt-2 text-body text-muted-foreground">
          {operationalCopy.launchArtifactConfirmBody}
        </p>
        {confirmApprove?.kind === "rebaseline" ? (
          <label className="mt-3 block text-caption">
            {operationalCopy.launchArtifactFieldApprover}
            <input
              className="mt-1 w-full rounded border border-border px-2 py-1"
              value={independentApprover}
              onChange={(e) => setIndependentApprover(e.target.value)}
              required
            />
          </label>
        ) : null}
        {confirmError ? (
          <p role="alert" className="mt-2 text-body text-destructive">
            {confirmError}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5"
            disabled={confirmPending}
            onClick={() => {
              setConfirmApprove(null);
              setIndependentApprover("");
            }}
          >
            {operationalCopy.launchArtifactConfirmCancel}
          </button>
          <button
            type="button"
            className="rounded bg-destructive px-3 py-1.5 text-destructive-foreground"
            disabled={
              confirmPending ||
              (confirmApprove?.kind === "rebaseline" &&
                !independentApprover.trim())
            }
            onClick={() => {
              if (!confirmApprove || confirmPending) return;
              if (confirmApprove.kind === "version") {
                approveVersion.mutate({ versionId: confirmApprove.id });
              } else {
                approveRebaseline.mutate({
                  rebaselineId: confirmApprove.id,
                  independentApproverAccountId: independentApprover.trim(),
                });
              }
            }}
          >
            {operationalCopy.launchArtifactConfirmProceed}
          </button>
        </div>
      </dialog>
    </section>
  );
}

function WaiverForm(props: {
  onCancel: () => void;
  pending: boolean;
  error: string | null;
  onSubmit: (values: {
    artifactId: "AR-ACCESS";
    ownerAccountId: string;
    independentApproverAccountId: string;
    scope: string;
    risk: string;
    compensatingControls: string;
    expiry: string;
    targetGateCode?: string;
  }) => void;
}) {
  const [artifactId, setArtifactId] = React.useState("AR-DATA");
  const [owner, setOwner] = React.useState("");
  const [approver, setApprover] = React.useState("");
  const [scope, setScope] = React.useState("");
  const [risk, setRisk] = React.useState("");
  const [compensating, setCompensating] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [gate, setGate] = React.useState("");

  return (
    <form
      className="space-y-3 border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit({
          artifactId: artifactId as "AR-ACCESS",
          ownerAccountId: owner,
          independentApproverAccountId: approver,
          scope,
          risk,
          compensatingControls: compensating,
          expiry,
          targetGateCode: gate || undefined,
        });
      }}
    >
      <h3 className="text-body font-medium">
        {operationalCopy.launchArtifactIssueWaiver}
      </h3>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldArtifactId}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1 font-mono"
          dir="ltr"
          value={artifactId}
          onChange={(e) => setArtifactId(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldOwner}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldApprover}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          value={approver}
          onChange={(e) => setApprover(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldScope}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldRisk}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          value={risk}
          onChange={(e) => setRisk(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldCompensating}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          value={compensating}
          onChange={(e) => setCompensating(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldExpiry}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          type="datetime-local"
          value={expiry}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw) {
              setExpiry("");
              return;
            }
            const d = new Date(raw);
            setExpiry(Number.isNaN(d.getTime()) ? "" : d.toISOString());
          }}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldGate}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1 font-mono"
          dir="ltr"
          value={gate}
          onChange={(e) => setGate(e.target.value)}
          placeholder="optional"
        />
      </label>
      {props.error ? (
        <p role="alert" className="text-body text-destructive">
          {props.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={props.pending}
          className="rounded border border-border px-3 py-1.5"
        >
          {operationalCopy.launchArtifactSubmit}
        </button>
        <button
          type="button"
          className="rounded border border-border px-3 py-1.5"
          onClick={props.onCancel}
        >
          {operationalCopy.launchArtifactConfirmCancel}
        </button>
      </div>
    </form>
  );
}

function CloseWaiverForm(props: {
  onCancel: () => void;
  pending: boolean;
  error: string | null;
  onSubmit: (closureEvidence: string) => void;
}) {
  const [evidence, setEvidence] = React.useState("");
  return (
    <form
      className="space-y-2 border border-border p-2"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit(evidence.trim());
      }}
    >
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldClosureEvidence}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          required
        />
      </label>
      {props.error ? (
        <p role="alert" className="text-body text-destructive">
          {props.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={props.pending || !evidence.trim()}
          className="rounded border border-border px-2 py-1"
        >
          {operationalCopy.launchArtifactCloseWaiver}
        </button>
        <button
          type="button"
          className="rounded border border-border px-2 py-1"
          onClick={props.onCancel}
        >
          {operationalCopy.launchArtifactConfirmCancel}
        </button>
      </div>
    </form>
  );
}

function ResolveConflictForm(props: {
  onCancel: () => void;
  pending: boolean;
  error: string | null;
  onSubmit: (values: {
    resolutionVersionIds: string[];
    jointApproverAccountId: string;
  }) => void;
}) {
  const [versions, setVersions] = React.useState("");
  const [joint, setJoint] = React.useState("");
  return (
    <form
      className="space-y-2 border border-border p-2"
      onSubmit={(e) => {
        e.preventDefault();
        const resolutionVersionIds = versions
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        props.onSubmit({
          resolutionVersionIds,
          jointApproverAccountId: joint.trim(),
        });
      }}
    >
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldResolutionVersions}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1 font-mono"
          dir="ltr"
          value={versions}
          onChange={(e) => setVersions(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldJointApprover}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          value={joint}
          onChange={(e) => setJoint(e.target.value)}
          required
        />
      </label>
      {props.error ? (
        <p role="alert" className="text-body text-destructive">
          {props.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={props.pending}
          className="rounded border border-border px-2 py-1"
        >
          {operationalCopy.launchArtifactResolveConflict}
        </button>
        <button
          type="button"
          className="rounded border border-border px-2 py-1"
          onClick={props.onCancel}
        >
          {operationalCopy.launchArtifactConfirmCancel}
        </button>
      </div>
    </form>
  );
}

function ConflictForm(props: {
  onCancel: () => void;
  pending: boolean;
  error: string | null;
  onSubmit: (values: {
    artifactIds: ["AR-DATA", "AR-REPORTING"];
    summary: string;
  }) => void;
}) {
  const [a, setA] = React.useState("AR-DATA");
  const [b, setB] = React.useState("AR-REPORTING");
  const [summary, setSummary] = React.useState("");
  return (
    <form
      className="space-y-3 border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit({
          artifactIds: [a, b] as ["AR-DATA", "AR-REPORTING"],
          summary,
        });
      }}
    >
      <h3 className="text-body font-medium">
        {operationalCopy.launchArtifactOpenConflict}
      </h3>
      <label className="block text-caption">
        AR ۱
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1 font-mono"
          dir="ltr"
          value={a}
          onChange={(e) => setA(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        AR ۲
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1 font-mono"
          dir="ltr"
          value={b}
          onChange={(e) => setB(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldScope}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          required
        />
      </label>
      {props.error ? (
        <p role="alert" className="text-body text-destructive">
          {props.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={props.pending}
          className="rounded border border-border px-3 py-1.5"
        >
          {operationalCopy.launchArtifactSubmit}
        </button>
        <button
          type="button"
          className="rounded border border-border px-3 py-1.5"
          onClick={props.onCancel}
        >
          {operationalCopy.launchArtifactConfirmCancel}
        </button>
      </div>
    </form>
  );
}

function RebaselineForm(props: {
  onCancel: () => void;
  pending: boolean;
  error: string | null;
  onSubmit: (values: {
    affectedArtifactIds: ["AR-REPORTING"];
    changeSummary: string;
    impactAssessment: string;
    requiredRegressionRefs: string[];
    buildRef?: string;
  }) => void;
}) {
  const [artifactId, setArtifactId] = React.useState("AR-REPORTING");
  const [change, setChange] = React.useState("");
  const [impact, setImpact] = React.useState("");
  const [refs, setRefs] = React.useState("acceptance-provisional");
  const [buildRef, setBuildRef] = React.useState("");
  return (
    <form
      className="space-y-3 border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit({
          affectedArtifactIds: [artifactId] as ["AR-REPORTING"],
          changeSummary: change,
          impactAssessment: impact,
          requiredRegressionRefs: refs
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          buildRef: buildRef || undefined,
        });
      }}
    >
      <h3 className="text-body font-medium">
        {operationalCopy.launchArtifactRequireRebaseline}
      </h3>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldArtifactId}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1 font-mono"
          dir="ltr"
          value={artifactId}
          onChange={(e) => setArtifactId(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldChange}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          value={change}
          onChange={(e) => setChange(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldImpact}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldRegressionRefs}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1"
          value={refs}
          onChange={(e) => setRefs(e.target.value)}
          required
        />
      </label>
      <label className="block text-caption">
        {operationalCopy.launchArtifactFieldBuildRef}
        <input
          className="mt-1 w-full rounded border border-border px-2 py-1 font-mono"
          dir="ltr"
          value={buildRef}
          onChange={(e) => setBuildRef(e.target.value)}
        />
      </label>
      {props.error ? (
        <p role="alert" className="text-body text-destructive">
          {props.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={props.pending}
          className="rounded border border-border px-3 py-1.5"
        >
          {operationalCopy.launchArtifactSubmit}
        </button>
        <button
          type="button"
          className="rounded border border-border px-3 py-1.5"
          onClick={props.onCancel}
        >
          {operationalCopy.launchArtifactConfirmCancel}
        </button>
      </div>
    </form>
  );
}
