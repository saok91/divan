"use client";

import * as React from "react";

import { ImportPreviewTable } from "@/components/import/import-preview-table";
import { MigrationReconciliationWorkspace } from "@/components/import/migration-reconciliation-workspace";
import { TemplateCatalogue } from "@/components/import/template-catalogue";
import { useLeaveGuardRegistration } from "@/components/leave-guard";
import { SensitiveConfirmationDialog } from "@/components/personnel/sensitive-confirmation-dialog";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toastBackground } from "@/components/ui/toast";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type WizardStep =
  | "identify"
  | "validate"
  | "preview"
  | "confirm"
  | "approve"
  | "execute"
  | "result";

/** Prefer ArrayBuffer over FileReader — avoids NotReadableError on some OS/file locks. */
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function uploadErrorMessage(
  err: unknown,
  fallback: string = operationalCopy.importLoadError,
): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    const msg = (err as { message: string }).message;
    if (/[\u0600-\u06FF]/.test(msg)) return msg;
    if (/could not be read|NotReadableError|read_failed/i.test(msg)) {
      return operationalCopy.importFileReadError;
    }
  }
  return fallback;
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "identify", label: operationalCopy.importStepIdentify },
  { id: "validate", label: operationalCopy.importStepValidate },
  { id: "preview", label: operationalCopy.importStepPreview },
  { id: "confirm", label: operationalCopy.importStepConfirm },
  { id: "approve", label: operationalCopy.importStepApprove },
  { id: "execute", label: operationalCopy.importStepExecute },
  { id: "result", label: operationalCopy.importStepResult },
];

const TERMINAL_STATUSES = new Set([
  "cutover-complete",
  "failed",
  "rolled-back",
]);

export function ImportWizard() {
  const [step, setStep] = React.useState<WizardStep>("identify");
  const [templateKey, setTemplateKey] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [executeOpen, setExecuteOpen] = React.useState(false);
  const [executeTier, setExecuteTier] = React.useState<"trial" | "production">(
    "trial",
  );
  const [reconRunId, setReconRunId] = React.useState<string | null>(null);
  const [reconProductionReady, setReconProductionReady] = React.useState(false);
  const [reconDirty, setReconDirty] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [localMessage, setLocalMessage] = React.useState<string | null>(null);
  const [stagingBatchId, setStagingBatchId] = React.useState<string | null>(
    null,
  );

  const templatesQuery = api.migration.templates.useQuery();
  const uploadMutation = api.migration.uploadAndValidate.useMutation();
  const cancelMutation = api.migration.cancelPreview.useMutation();
  const confirmMutation = api.migration.confirmDraft.useMutation();
  const approveMutation = api.migration.approveBatch.useMutation();
  const executeMutation = api.migration.executeBatch.useMutation();

  const usableTemplates =
    templatesQuery.data?.templates.filter((t) => t.callerMayUse) ?? [];
  const resolvedTemplateKey =
    (templateKey && usableTemplates.some((t) => t.key === templateKey)
      ? templateKey
      : usableTemplates[0]?.key) || "";

  const preview = confirmMutation.data ?? uploadMutation.data ?? null;
  const previewBatchId = preview?.previewBatchId;
  const previewLoaded = Boolean(preview && preview.status !== "cancelled");

  const stagingBatch =
    executeMutation.data?.batch ??
    approveMutation.data?.batch ??
    null;
  const evidence = executeMutation.data?.evidence ?? null;
  const contentsReadOnly =
    approveMutation.data?.contentsReadOnly === true ||
    Boolean(stagingBatch && stagingBatch.payloadFrozen);

  const clearPreview = React.useCallback(async () => {
    const id = previewBatchId;
    setSheetOpen(false);
    setConfirmOpen(false);
    setExecuteOpen(false);
    setStep("identify");
    setLocalMessage(null);
    setStagingBatchId(null);
    uploadMutation.reset();
    confirmMutation.reset();
    approveMutation.reset();
    executeMutation.reset();
    if (id) {
      try {
        await cancelMutation.mutateAsync({ previewBatchId: id });
      } catch {
        // Draft may already be gone — local clear still applies.
      }
    }
  }, [
    previewBatchId,
    uploadMutation,
    confirmMutation,
    approveMutation,
    executeMutation,
    cancelMutation,
  ]);

  const stagingOpenNonTerminal = Boolean(
    stagingBatchId &&
      (!stagingBatch || !TERMINAL_STATUSES.has(stagingBatch.status)),
  );

  useLeaveGuardRegistration({
    id: "import-wizard-preview",
    // Data-state dirty: open preview draft OR non-terminal staging OR recon edits —
    // never Dialog open alone.
    isDirty:
      Boolean(preview && preview.status === "preview") ||
      stagingOpenNonTerminal ||
      reconDirty,
    kind: stagingOpenNonTerminal ? "import-staging" : "import-preview",
    previewBatchId: previewBatchId,
    stagingBatchId: stagingBatchId ?? undefined,
    onDiscard: () => {
      void clearPreview();
    },
  });

  async function onUpload() {
    setUploadError(null);
    setLocalMessage(null);
    confirmMutation.reset();
    approveMutation.reset();
    executeMutation.reset();
    setStagingBatchId(null);
    if (!resolvedTemplateKey || !file) {
      setUploadError(operationalCopy.importUploadReject);
      return;
    }
    setStep("validate");
    try {
      const contentBase64 = await fileToBase64(file);
      await uploadMutation.mutateAsync({
        templateKey: resolvedTemplateKey,
        fileName: file.name,
        contentBase64,
      });
      setStep("preview");
      setSheetOpen(true);
    } catch (err) {
      setStep("identify");
      setUploadError(uploadErrorMessage(err, operationalCopy.importLoadError));
    }
  }

  async function onConfirmDraft() {
    if (!previewBatchId) return;
    try {
      const res = await confirmMutation.mutateAsync({ previewBatchId });
      setConfirmOpen(false);
      setStep("confirm");
      setLocalMessage(operationalCopy.importDraftConfirmed);
      if (res.stagingBatchId) {
        setStagingBatchId(res.stagingBatchId);
        setStep("approve");
      }
    } catch (err) {
      setUploadError(uploadErrorMessage(err));
      setConfirmOpen(false);
    }
  }

  async function onApprove() {
    if (!stagingBatchId) return;
    setUploadError(null);
    try {
      await approveMutation.mutateAsync({ batchId: stagingBatchId });
      setStep("execute");
      setLocalMessage(operationalCopy.importContentsReadOnly);
    } catch (err) {
      setUploadError(uploadErrorMessage(err, operationalCopy.importSodBlocked));
    }
  }

  async function onExecute() {
    if (!stagingBatchId) return;
    setUploadError(null);
    try {
      await executeMutation.mutateAsync({
        batchId: stagingBatchId,
        cutoverTier: executeTier,
        reconciliationRunId:
          executeTier === "production" ? (reconRunId ?? undefined) : undefined,
      });
      setExecuteOpen(false);
      setStep("result");
      // Background-job result → toast only (one channel). Result step stays
      // as the workspace (evidence / disclosure); no second celebratory inline.
      const successMessage =
        executeTier === "production"
          ? operationalCopy.importExecuteSuccess
          : `${operationalCopy.importExecuteSuccess} — ${operationalCopy.reconTrialExecuteStatus}`;
      toastBackground({
        message: `${successMessage} — ${stagingBatchId}`,
        href: "/import",
        hrefLabel: operationalCopy.importToastBatchLink,
      });
      setLocalMessage(null);
    } catch (err) {
      setExecuteOpen(false);
      setStep("result");
      const detail = uploadErrorMessage(err);
      // Include staging batch id so operators can correlate failures (UX-DR16).
      setUploadError(
        `${operationalCopy.importExecuteFailed}: ${detail} — ${stagingBatchId}`,
      );
    }
  }

  const busy =
    uploadMutation.isPending ||
    cancelMutation.isPending ||
    confirmMutation.isPending ||
    approveMutation.isPending ||
    executeMutation.isPending;

  const tableColumns =
    stagingBatch?.visibleColumns ?? preview?.visibleColumns ?? [];
  const tableRows =
    stagingBatch?.rows.map((r) => ({
      rowId: r.rowId,
      sourceRow: r.sourceRow,
      severity: "ok" as const,
      values: r.values,
    })) ??
    preview?.rows ??
    [];

  return (
    <div className="space-y-6">
      <p className="text-caption text-muted-foreground">
        {operationalCopy.importBulkDayHint}
      </p>

      <ol className="flex flex-wrap gap-2" aria-label="مراحل ویزارد">
        {STEPS.map((s) => (
          <li
            key={s.id}
            className={cn(
              "rounded-md border px-3 py-1 text-caption",
              step === s.id
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {s.label}
          </li>
        ))}
      </ol>

      <section className="space-y-4" aria-labelledby="import-identify-heading">
        <h2 id="import-identify-heading" className="text-body-medium">
          {operationalCopy.importStepIdentify}
        </h2>

        {templatesQuery.isLoading ? (
          <FeedbackMessage kind="loading">
            {operationalCopy.actionPending}
          </FeedbackMessage>
        ) : templatesQuery.isError ? (
          <FeedbackMessage kind="error">
            {templatesQuery.error.message || operationalCopy.importLoadError}
          </FeedbackMessage>
        ) : (templatesQuery.data?.templates.length ?? 0) === 0 ? (
          <FeedbackMessage kind="empty">
            {operationalCopy.importNoTemplates}
          </FeedbackMessage>
        ) : (
          <div className="space-y-4">
            <TemplateCatalogue
              variant="migration"
              selectedTemplateKey={resolvedTemplateKey}
              disabled={busy || previewLoaded}
              onSelectTemplate={(key) => {
                if (key === resolvedTemplateKey) return;
                setTemplateKey(key);
                // Cascade (8.3): clear file bound to previous template.
                setFile(null);
                setUploadError(null);
              }}
            />
            <div className="space-y-2">
              <label className="text-caption" htmlFor="import-template">
                {operationalCopy.importSelectTemplate}
              </label>
              <select
                id="import-template"
                className="flex h-9 w-full max-w-md rounded-md border border-border bg-background px-3 text-body"
                value={resolvedTemplateKey}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next !== resolvedTemplateKey) {
                    setTemplateKey(next);
                    setFile(null);
                    setUploadError(null);
                  }
                }}
                disabled={busy || previewLoaded || usableTemplates.length === 0}
              >
                {usableTemplates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.titleFa}
                  </option>
                ))}
              </select>
              <p className="text-caption text-muted-foreground">
                قالب موقتی — انجماد AR-MIGRATION هنوز انجام نشده.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-caption" htmlFor="import-file">
            {operationalCopy.importSelectFile}
          </label>
          <input
            id="import-file"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full max-w-md text-caption file:me-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5"
            disabled={busy || previewLoaded}
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setFile(next);
              setUploadError(null);
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={previewLoaded ? "tertiary" : "primary"}
            disabled={busy || !resolvedTemplateKey || !file || previewLoaded}
            onClick={() => void onUpload()}
            disabledReason={
              busy
                ? operationalCopy.actionPending
                : previewLoaded
                  ? operationalCopy.importPreviewAlreadyLoaded
                  : !resolvedTemplateKey || !file
                    ? operationalCopy.importUploadPrerequisites
                    : undefined
            }
          >
            {uploadMutation.isPending
              ? operationalCopy.importStepValidate
              : operationalCopy.importUploadAction}
          </Button>
          {previewLoaded ? (
            <>
              {!sheetOpen ? (
                <Button
                  type="button"
                  variant="tertiary"
                  disabled={busy}
                  onClick={() => setSheetOpen(true)}
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.importReopenPreview}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="tertiary"
                disabled={busy}
                onClick={() => void clearPreview()}
              
            disabledReason={operationalCopy.actionPending}
          >
                {operationalCopy.importCancelPreview}
              </Button>
            </>
          ) : null}
          {stagingBatchId && step === "approve" ? (
            <Button
              type="button"
              variant={sheetOpen ? "tertiary" : "primary"}
              disabled={busy}
              onClick={() => void onApprove()}
            
            disabledReason={operationalCopy.actionPending}
          >
              {operationalCopy.importApproveAction}
            </Button>
          ) : null}
          {stagingBatchId && step === "execute" ? (
            <>
              <Button
                type="button"
                variant={sheetOpen ? "tertiary" : "primary"}
                disabled={busy || executeOpen}
                onClick={() => {
                  // Single dialog depth: SensitiveConfirmationDialog only (no confirm Dialog).
                  setConfirmOpen(false);
                  setExecuteTier("trial");
                  setExecuteOpen(true);
                }}
              
            disabledReason={operationalCopy.actionPending}
          >
                {operationalCopy.reconTrialExecuteOnly}
              </Button>
              <Button
                type="button"
                variant="tertiary"
                disabled={
                  busy || executeOpen || !reconProductionReady || !reconRunId
                }
                onClick={() => {
                  setConfirmOpen(false);
                  setExecuteTier("production");
                  setExecuteOpen(true);
                }}
                disabledReason={
                  busy
                    ? operationalCopy.actionPending
                    : executeOpen
                      ? operationalCopy.actionPending
                      : !reconProductionReady || !reconRunId
                        ? operationalCopy.importReconRequired
                        : undefined
                }
              >
                {operationalCopy.reconProductionExecute}
              </Button>
            </>
          ) : null}
        </div>

        {uploadError ? (
          <p className="text-caption text-destructive" role="alert">
            {uploadError}
          </p>
        ) : null}
        {localMessage ? (
          <p className="text-caption" role="status">
            {localMessage}
          </p>
        ) : null}
        {contentsReadOnly ? (
          <p className="text-caption text-muted-foreground">
            {operationalCopy.importContentsReadOnly}
          </p>
        ) : null}
        {preview?.populationDisclosureFa ||
        approveMutation.data?.populationDisclosureFa ||
        executeMutation.data?.populationDisclosureFa ? (
          <p className="text-caption text-muted-foreground">
            {operationalCopy.importPopulationHint}:{" "}
            {executeMutation.data?.populationDisclosureFa ??
              approveMutation.data?.populationDisclosureFa ??
              preview?.populationDisclosureFa}
          </p>
        ) : null}

        {evidence ? (
          <section
            className="space-y-2 rounded-md border border-border p-3"
            aria-labelledby="import-evidence-heading"
          >
            <h3 id="import-evidence-heading" className="text-body-medium">
              {operationalCopy.importEvidenceLabel}
            </h3>
            <p className="text-caption text-muted-foreground">
              {operationalCopy.importFr39BaselineEstablishedFa}
            </p>
            <p className="text-caption text-muted-foreground">
              {operationalCopy.importFr39BoundaryHonestyFa}
            </p>
            <p className="text-caption text-muted-foreground">
              {operationalCopy.importFr39ProvenanceMetadataOnlyFa}
            </p>
            <p className="text-caption">
              {operationalCopy.importCorrelationLabel}:{" "}
              {toPersianDigits(evidence.correlationId)}
            </p>
            <p className="text-caption">
              {operationalCopy.importRowsLabel}:{" "}
              {toPersianDigits(evidence.counts.rowCount)} · رویداد:{" "}
              {toPersianDigits(evidence.counts.createdEventCount)} · فرد:{" "}
              {toPersianDigits(evidence.counts.createdPersonCount)}
            </p>
            {evidence.createdEventIds.length > 0 ? (
              <p className="text-caption text-muted-foreground break-all">
                {evidence.createdEventIds.map((id) => toPersianDigits(id)).join("، ")}
              </p>
            ) : null}
          </section>
        ) : null}

        {stagingBatchId &&
        (step === "execute" || step === "result" || step === "approve") ? (
          <MigrationReconciliationWorkspace
            batchId={stagingBatchId}
            onProductionGateChange={({ ready, runId }) => {
              setReconProductionReady(ready);
              setReconRunId(runId);
            }}
            onDirtyChange={setReconDirty}
          />
        ) : null}
      </section>

      {/* Preview Sheet — confirm Dialog XOR execute SensitiveConfirmationDialog */}
      <Sheet
        open={sheetOpen && previewLoaded}
        onOpenChange={(open) => {
          if (!open) {
            setSheetOpen(false);
          }
        }}
      >
        <SheetContent
          side="bottom"
          fullWidth
          className="gap-0 p-0"
          onEscapeKeyDown={() => setSheetOpen(false)}
        >
          <SheetHeader className="border-b">
            <SheetTitle>{operationalCopy.importPreviewTitle}</SheetTitle>
            <SheetDescription>
              {preview
                ? `${preview.templateTitleFa} — ${operationalCopy.importRowsLabel} ${toPersianDigits(preview.rowCount)} · ${operationalCopy.importErrorsLabel} ${toPersianDigits(preview.errorCount)} · ${operationalCopy.importWarningsLabel} ${toPersianDigits(preview.warningCount)} · دسته ${toPersianDigits(preview.previewBatchId)}`
                : null}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tableColumns.length > 0 ? (
              <ImportPreviewTable
                columns={tableColumns}
                rows={tableRows}
                issueCitesFa={preview?.issueCitesFa ?? []}
              />
            ) : null}
            {preview?.statusHintFa ? (
              <p className="mt-3 text-caption text-muted-foreground">
                {preview.statusHintFa}
              </p>
            ) : null}
            {step === "approve" ? (
              <p className="mt-3 text-caption text-muted-foreground">
                {operationalCopy.importApproveHint}
              </p>
            ) : null}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void clearPreview()}
            
            disabledReason={operationalCopy.actionPending}
          >
              {operationalCopy.importCancelPreview}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setSheetOpen(false)}
            
            disabledReason={operationalCopy.actionPending}
          >
              {operationalCopy.importClosePreview}
            </Button>
            {preview?.status !== "confirmed-draft" ? (
              <Button
                type="button"
                variant="primary"
                disabled={
                  busy ||
                  !preview ||
                  preview.errorCount > 0 ||
                  confirmOpen ||
                  executeOpen
                }
                onClick={() => {
                  setExecuteOpen(false);
                  setConfirmOpen(true);
                }}
              
            disabledReason={operationalCopy.actionPending}
          >
                {operationalCopy.importConfirmDraft}
              </Button>
            ) : null}
            {stagingBatchId && step === "approve" ? (
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={() => void onApprove()}
              
            disabledReason={operationalCopy.actionPending}
          >
                {operationalCopy.importApproveAction}
              </Button>
            ) : null}
            {stagingBatchId && step === "execute" ? (
              <>
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy || executeOpen}
                  onClick={() => {
                    setConfirmOpen(false);
                    setExecuteTier("trial");
                    setExecuteOpen(true);
                  }}
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.reconTrialExecuteOnly}
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  disabled={
                    busy || executeOpen || !reconProductionReady || !reconRunId
                  }
                  onClick={() => {
                    setConfirmOpen(false);
                    setExecuteTier("production");
                    setExecuteOpen(true);
                  }}
                  disabledReason={
                    busy
                      ? operationalCopy.actionPending
                      : executeOpen
                        ? operationalCopy.actionPending
                        : !reconProductionReady || !reconRunId
                          ? operationalCopy.importReconRequired
                          : undefined
                  }
                >
                  {operationalCopy.reconProductionExecute}
                </Button>
              </>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Confirm draft Dialog — XOR with execute SensitiveConfirmationDialog */}
      <Dialog
        open={confirmOpen && !executeOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>{operationalCopy.importStepConfirm}</DialogTitle>
            <DialogDescription>
              {operationalCopy.importConfirmHint}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
            >
              {operationalCopy.importConfirmDismiss}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => void onConfirmDraft()}
            
            disabledReason={operationalCopy.actionPending}
          >
              {operationalCopy.importConfirmDraft}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SensitiveConfirmationDialog
        open={executeOpen && !confirmOpen}
        onOpenChange={setExecuteOpen}
        title={
          executeTier === "production"
            ? operationalCopy.reconProductionExecuteConfirmTitle
            : operationalCopy.importExecuteConfirmTitle
        }
        consequence={
          executeTier === "production"
            ? operationalCopy.reconProductionExecuteConsequence
            : operationalCopy.importExecuteConsequence
        }
        confirmLabel={
          executeTier === "production"
            ? operationalCopy.reconProductionExecute
            : operationalCopy.reconTrialExecuteOnly
        }
        cancelLabel={operationalCopy.importConfirmDismiss}
        busy={executeMutation.isPending}
        confirmDisabled={
          executeTier === "production" &&
          (!reconProductionReady || !reconRunId)
        }
        blockedReason={
          executeTier === "production" && !reconProductionReady
            ? operationalCopy.reconNotProductionReady
            : undefined
        }
        onConfirm={() => void onExecute()}
      />
    </div>
  );
}
