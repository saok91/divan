"use client";

/**
 * Migration reconciliation workspace (Story 6.4 / FR-40 / LG-1).
 * Mounted from import wizard after approve / trial execute.
 * Does not claim production readiness when unsigned or incomplete.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { formatJalaliDateTimeFromIso } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Props = {
  batchId: string;
  /** Called when production gate turns green with a signed run id. */
  onProductionGateChange?: (opts: {
    ready: boolean;
    runId: string | null;
  }) => void;
  /** Dirty when open edits — for leave-guard (Dialog open ≠ dirty). */
  onDirtyChange?: (dirty: boolean) => void;
};

type DispositionDraft = {
  discrepancyId: string;
  rationale: string;
  owner: string;
  independentApprover: string;
  scope: string;
  risk: string;
  compensatingControl: string;
  expiry: string;
};

function statusLabelFa(status: string): string {
  switch (status) {
    case "match":
      return operationalCopy.reconStatusMatch;
    case "mismatch":
      return operationalCopy.reconStatusMismatch;
    case "missing_control":
      return operationalCopy.reconStatusMissingControl;
    case "unavailable":
      return operationalCopy.reconStatusUnavailable;
    case "open":
      return operationalCopy.reconStatusOpen;
    case "closed":
      return operationalCopy.reconStatusClosed;
    case "draft":
      return operationalCopy.reconStatusDraft;
    case "in-progress":
      return operationalCopy.reconStatusInProgress;
    case "signed":
      return operationalCopy.reconStatusSigned;
    default:
      return status;
  }
}

function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.status === "unavailable") {
      return operationalCopy.reconStatusUnavailable;
    }
    if (typeof o.count === "number") {
      return toPersianDigits(o.count);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  if (typeof value === "number") return toPersianDigits(value);
  return String(value);
}

function defaultExpiryIso(): string {
  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
}

export function MigrationReconciliationWorkspace({
  batchId,
  onProductionGateChange,
  onDirtyChange,
}: Props) {
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [controlDraft, setControlDraft] = React.useState("");
  const [dispositionDraft, setDispositionDraft] =
    React.useState<DispositionDraft | null>(null);

  React.useEffect(() => {
    setSelectedRunId(null);
    setControlDraft("");
    setDispositionDraft(null);
    setError(null);
  }, [batchId]);

  const listQuery = api.migration.listReconciliationRuns.useQuery(
    { batchId },
    { enabled: Boolean(batchId) },
  );

  const activeRunId = selectedRunId ?? listQuery.data?.[0]?.id ?? null;

  const runQuery = api.migration.getReconciliation.useQuery(
    { runId: activeRunId! },
    { enabled: Boolean(activeRunId) },
  );

  const createMutation = api.migration.createReconciliationRun.useMutation();
  const upsertControlsMutation =
    api.migration.upsertReconciliationControls.useMutation();
  const compareMutation = api.migration.runReconciliationCompare.useMutation();
  const dispositionMutation =
    api.migration.setDiscrepancyDisposition.useMutation();
  const signMutation = api.migration.signReconciliation.useMutation();

  const utils = api.useUtils();

  const gate = runQuery.data?.productionGate;
  const run = runQuery.data?.run;
  const comparison = runQuery.data?.comparison ?? [];

  React.useEffect(() => {
    const ready = Boolean(gate && gate.ok === true && activeRunId);
    onProductionGateChange?.({
      ready,
      runId: ready ? activeRunId : null,
    });
  }, [gate, activeRunId, onProductionGateChange]);

  React.useEffect(() => {
    const dirty =
      Boolean(dispositionDraft) || Boolean(controlDraft.trim());
    onDirtyChange?.(dirty);
  }, [dispositionDraft, controlDraft, onDirtyChange]);

  async function refresh() {
    await listQuery.refetch();
    if (activeRunId) {
      await utils.migration.getReconciliation.invalidate({ runId: activeRunId });
    }
  }

  async function onCreate() {
    setError(null);
    try {
      const created = await createMutation.mutateAsync({
        batchId,
        tier: "production-candidate",
      });
      setSelectedRunId(created.id);
      await refresh();
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : operationalCopy.reconLoadError,
      );
    }
  }

  async function onAttestControls() {
    if (!activeRunId) return;
    setError(null);
    try {
      if (!controlDraft.trim()) {
        setError(operationalCopy.reconControlsJsonRequired);
        return;
      }
      const parsed = JSON.parse(controlDraft) as Record<string, unknown>;
      const domainKeys = comparison.length
        ? comparison.map((c) => c.domainKey)
        : [
            "person",
            "employment",
            "assignment",
            "personnel_event",
            "current_state",
            "team_totals",
            "reference_mappings",
            "headcount",
            "duplicates",
            "orphans",
            "approved_control_totals",
          ];
      const missing = domainKeys.filter(
        (k) => parsed[k] === undefined || parsed[k] === null,
      );
      if (missing.length > 0) {
        setError(operationalCopy.reconControlsJsonRequired);
        return;
      }
      await upsertControlsMutation.mutateAsync({
        runId: activeRunId,
        controls: domainKeys.map((domainKey) => ({
          domainKey,
          controlValue: parsed[domainKey] as unknown,
        })),
      });
      setControlDraft("");
      await refresh();
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : operationalCopy.reconLoadError,
      );
    }
  }

  async function onCompare() {
    if (!activeRunId) return;
    setError(null);
    try {
      await compareMutation.mutateAsync({ runId: activeRunId });
      await refresh();
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : operationalCopy.reconLoadError,
      );
    }
  }

  function patchDisposition(
    discrepancyId: string,
    patch: Partial<DispositionDraft>,
  ) {
    setDispositionDraft((prev) => {
      const base: DispositionDraft =
        prev?.discrepancyId === discrepancyId
          ? prev
          : {
              discrepancyId,
              rationale: "",
              owner: "",
              independentApprover: "",
              scope: "",
              risk: "",
              compensatingControl: "",
              expiry: defaultExpiryIso(),
            };
      return { ...base, ...patch, discrepancyId };
    });
  }

  async function onDisposition(discrepancyId: string) {
    if (!activeRunId || !dispositionDraft) return;
    if (dispositionDraft.discrepancyId !== discrepancyId) return;
    if (
      !dispositionDraft.owner.trim() ||
      !dispositionDraft.rationale.trim() ||
      !dispositionDraft.independentApprover.trim() ||
      !dispositionDraft.scope.trim() ||
      !dispositionDraft.risk.trim() ||
      !dispositionDraft.compensatingControl.trim() ||
      !dispositionDraft.expiry.trim()
    ) {
      setError(operationalCopy.reconWaiverFieldsRequired);
      return;
    }
    setError(null);
    try {
      const expiryIso = dispositionDraft.expiry.includes("T")
        ? dispositionDraft.expiry
        : new Date(`${dispositionDraft.expiry}T23:59:59.000Z`).toISOString();
      await dispositionMutation.mutateAsync({
        runId: activeRunId,
        discrepancyId,
        status: "waived",
        dispositionCode: "waive_with_fr55",
        dispositionRationaleFa: dispositionDraft.rationale,
        ownerAccountId: dispositionDraft.owner,
        waiver: {
          independentApprover: dispositionDraft.independentApprover.trim(),
          scope: dispositionDraft.scope.trim(),
          risk: dispositionDraft.risk.trim(),
          compensatingControl: dispositionDraft.compensatingControl.trim(),
          expiry: expiryIso,
        },
      });
      setDispositionDraft(null);
      await refresh();
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : operationalCopy.reconLoadError,
      );
    }
  }

  async function onSign(roleCode: "migration_lead" | "hr_data_owner") {
    if (!activeRunId) return;
    setError(null);
    try {
      await signMutation.mutateAsync({ runId: activeRunId, roleCode });
      await refresh();
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : operationalCopy.reconLoadError,
      );
    }
  }

  const busy =
    createMutation.isPending ||
    upsertControlsMutation.isPending ||
    compareMutation.isPending ||
    dispositionMutation.isPending ||
    signMutation.isPending;

  const productionReady = Boolean(gate && gate.ok === true);

  return (
    <section
      className="space-y-3 border-t border-border pt-4"
      aria-labelledby="recon-workspace-heading"
    >
      <div className="space-y-1">
        <h3 id="recon-workspace-heading" className="text-body-medium">
          {operationalCopy.reconWorkspaceTitle}
        </h3>
        <p className="text-caption text-muted-foreground">
          {operationalCopy.reconWorkspaceHint}
        </p>
      </div>

      {!productionReady ? (
        <p className="text-caption text-destructive" role="alert">
          {gate && !gate.ok
            ? `${operationalCopy.reconProductionBlocked} ${gate.messageFa}`
            : operationalCopy.reconNotProductionReady}
        </p>
      ) : (
        <p className="text-caption" role="status">
          {operationalCopy.reconProductionReady}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void onCreate()}
        >
          {operationalCopy.reconCreateRun}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !activeRunId}
          onClick={() => void onCompare()}
        >
          {operationalCopy.reconCompare}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !activeRunId}
          onClick={() => void onAttestControls()}
        >
          {operationalCopy.reconAttestControls}
        </Button>
      </div>

      {!activeRunId && !listQuery.isLoading ? (
        <p className="text-caption text-muted-foreground">
          {operationalCopy.reconNoRunYet}
        </p>
      ) : null}

      {run ? (
        <p className="text-caption">
          {statusLabelFa(run.status)}
          {run.frozenAt
            ? ` · ${toPersianDigits(formatJalaliDateTimeFromIso(run.frozenAt) ?? run.frozenAt)}`
            : null}
          {run.evidenceHash
            ? ` · ${toPersianDigits(run.evidenceHash.slice(0, 12))}…`
            : null}
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-caption text-muted-foreground">
          {operationalCopy.reconControlJsonHint}
        </span>
        <textarea
          className="min-h-16 w-full rounded-md border border-border bg-background p-2 text-caption"
          value={controlDraft}
          onChange={(e) => setControlDraft(e.target.value)}
          disabled={busy || !activeRunId}
          dir="ltr"
          placeholder='{"person":{"count":1},...}'
        />
      </label>

      {comparison.length > 0 ? (
        <div className="overflow-x-auto">
          <table
            className="w-full text-caption"
            aria-label={operationalCopy.reconWorkspaceTitle}
          >
            <thead>
              <tr className="border-b border-border text-start">
                <th className="p-2 font-medium">
                  {operationalCopy.reconDomainColumn}
                </th>
                <th className="p-2 font-medium">
                  {operationalCopy.reconControlColumn}
                </th>
                <th className="p-2 font-medium">
                  {operationalCopy.reconObservedColumn}
                </th>
                <th className="p-2 font-medium">
                  {operationalCopy.reconStatusColumn}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.domainKey} className="border-b border-border/60">
                  <td className="p-2">{row.labelFa}</td>
                  <td className="p-2 font-mono text-[0.85em]" dir="ltr">
                    {formatValue(row.controlValue)}
                  </td>
                  <td className="p-2 font-mono text-[0.85em]" dir="ltr">
                    {formatValue(row.observedValue)}
                  </td>
                  <td
                    className={cn(
                      "p-2",
                      row.status === "open" ||
                        row.status === "mismatch" ||
                        row.status === "missing_control" ||
                        row.status === "unavailable"
                        ? "text-destructive"
                        : undefined,
                    )}
                  >
                    {statusLabelFa(row.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {run && run.discrepancies.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-caption font-medium">
            {operationalCopy.reconDiscrepanciesTitle}
          </h4>
          <ul className="space-y-2">
            {run.discrepancies.map((d) => {
              const draft =
                dispositionDraft?.discrepancyId === d.id
                  ? dispositionDraft
                  : null;
              return (
                <li key={d.id} className="space-y-1 text-caption">
                  <p>
                    {d.domainKey} · {d.severity} · {statusLabelFa(d.status)}
                  </p>
                  {d.status === "open" ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <input
                        className="rounded-md border border-border bg-background px-2 py-1"
                        placeholder={operationalCopy.reconOwnerPlaceholder}
                        dir="ltr"
                        value={draft?.owner ?? ""}
                        onChange={(e) =>
                          patchDisposition(d.id, { owner: e.target.value })
                        }
                      />
                      <input
                        className="min-w-[10rem] flex-1 rounded-md border border-border bg-background px-2 py-1"
                        placeholder={operationalCopy.reconRationalePlaceholder}
                        value={draft?.rationale ?? ""}
                        onChange={(e) =>
                          patchDisposition(d.id, { rationale: e.target.value })
                        }
                      />
                      <input
                        className="rounded-md border border-border bg-background px-2 py-1"
                        placeholder={
                          operationalCopy.reconIndependentApproverPlaceholder
                        }
                        dir="ltr"
                        value={draft?.independentApprover ?? ""}
                        onChange={(e) =>
                          patchDisposition(d.id, {
                            independentApprover: e.target.value,
                          })
                        }
                      />
                      <input
                        className="rounded-md border border-border bg-background px-2 py-1"
                        placeholder={operationalCopy.reconWaiverScopePlaceholder}
                        value={draft?.scope ?? ""}
                        onChange={(e) =>
                          patchDisposition(d.id, { scope: e.target.value })
                        }
                      />
                      <input
                        className="rounded-md border border-border bg-background px-2 py-1"
                        placeholder={operationalCopy.reconWaiverRiskPlaceholder}
                        value={draft?.risk ?? ""}
                        onChange={(e) =>
                          patchDisposition(d.id, { risk: e.target.value })
                        }
                      />
                      <input
                        className="rounded-md border border-border bg-background px-2 py-1"
                        placeholder={
                          operationalCopy.reconWaiverControlPlaceholder
                        }
                        value={draft?.compensatingControl ?? ""}
                        onChange={(e) =>
                          patchDisposition(d.id, {
                            compensatingControl: e.target.value,
                          })
                        }
                      />
                      <input
                        className="rounded-md border border-border bg-background px-2 py-1"
                        placeholder={
                          operationalCopy.reconWaiverExpiryPlaceholder
                        }
                        dir="ltr"
                        type="date"
                        value={draft?.expiry?.slice(0, 10) ?? defaultExpiryIso()}
                        onChange={(e) =>
                          patchDisposition(d.id, { expiry: e.target.value })
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void onDisposition(d.id)}
                      >
                        {operationalCopy.reconDispositionAction}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <h4 className="text-caption font-medium">
          {operationalCopy.reconSignaturesTitle}
        </h4>
        {run?.signatures.map((s) => (
          <p key={s.id} className="text-caption text-muted-foreground">
            {s.roleCode} ·{" "}
            {toPersianDigits(
              formatJalaliDateTimeFromIso(s.signedAt) ?? s.signedAt,
            )}
          </p>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !activeRunId}
            onClick={() => void onSign("migration_lead")}
          >
            {operationalCopy.reconSignMigrationLead}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !activeRunId}
            onClick={() => void onSign("hr_data_owner")}
          >
            {operationalCopy.reconSignHrDataOwner}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-caption text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
