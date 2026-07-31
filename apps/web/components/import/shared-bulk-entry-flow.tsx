"use client";

import * as React from "react";

import { ImportPreviewTable } from "@/components/import/import-preview-table";
import { TemplateCatalogue } from "@/components/import/template-catalogue";
import { useLeaveGuardRegistration } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { PendingSurface, pendingLabel } from "@/components/ui/pending-surface";
import { fileToBase64, uploadErrorMessage } from "@/lib/import-file";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type BulkStep = "template" | "upload" | "preview" | "confirm" | "result";

const STEPS: { id: BulkStep; label: string }[] = [
  { id: "template", label: operationalCopy.bulkStepTemplate },
  { id: "upload", label: operationalCopy.bulkStepUpload },
  { id: "preview", label: operationalCopy.bulkStepPreview },
  { id: "confirm", label: operationalCopy.bulkStepConfirm },
  { id: "result", label: operationalCopy.bulkStepResult },
];

/** Server messages that mean this preview/staging cannot be retried. */
function isNonRetryableBulkCommitError(err: unknown): boolean {
  const msg = uploadErrorMessage(err, "");
  return (
    msg.includes("بارگذاری جدید") ||
    msg.includes("وضعیت دسته برای ورود گروهی معتبر نیست") ||
    msg.includes("دسته ناموفق است")
  );
}

export type SharedBulkEntrySection =
  | "personnel"
  | "personnel-events"
  | "headcount";

/**
 * Shared five-step day-to-day bulk entry (Story 9.2 / 9.3).
 * Mounted on all «ورود گروهی» tabs — not the `/import` migration wizard.
 */
export function SharedBulkEntryFlow({
  section,
}: {
  /** Host section — filters catalogue to matching template.sections (Story 9.3). */
  section?: SharedBulkEntrySection;
}) {
  const [step, setStep] = React.useState<BulkStep>("template");
  const [templateKey, setTemplateKey] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [commitError, setCommitError] = React.useState<string | null>(null);
  const [stagingBatchId, setStagingBatchId] = React.useState<string | null>(
    null,
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const templatesQuery = api.migration.templates.useQuery();
  const uploadMutation = api.migration.uploadAndValidate.useMutation();
  const cancelMutation = api.migration.cancelPreview.useMutation();
  const commitMutation = api.migration.commitDayToDayBulk.useMutation();

  const sectionTemplates = React.useMemo(() => {
    const all = templatesQuery.data?.templates ?? [];
    if (!section) return all;
    return all.filter((t) => t.sections?.includes(section));
  }, [templatesQuery.data?.templates, section]);

  const usableTemplates = sectionTemplates.filter((t) => t.callerMayUse);
  const resolvedTemplateKey =
    (templateKey && usableTemplates.some((t) => t.key === templateKey)
      ? templateKey
      : usableTemplates[0]?.key) || "";

  const preview = uploadMutation.data ?? null;
  const previewBatchId = preview?.previewBatchId;
  const hasErrors = (preview?.errorCount ?? 0) > 0;
  const commitResult = commitMutation.data ?? null;

  const busy =
    uploadMutation.isPending ||
    cancelMutation.isPending ||
    commitMutation.isPending;

  function resetFileInput() {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function cancelPreviewIfAny(id: string | undefined) {
    if (!id) return;
    try {
      await cancelMutation.mutateAsync({ previewBatchId: id });
    } catch {
      // Draft may already be gone.
    }
  }

  const clearLocal = React.useCallback(async () => {
    const id = previewBatchId;
    setStep("template");
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setUploadError(null);
    setCommitError(null);
    setStagingBatchId(null);
    uploadMutation.reset();
    commitMutation.reset();
    if (id) {
      try {
        await cancelMutation.mutateAsync({ previewBatchId: id });
      } catch {
        // Draft may already be gone.
      }
    }
  }, [previewBatchId, uploadMutation, commitMutation, cancelMutation]);

  const stagingOpenNonTerminal = Boolean(
    stagingBatchId && !commitResult && step !== "result",
  );
  const previewDirty = Boolean(
    preview &&
      preview.status === "preview" &&
      !commitResult &&
      step !== "result",
  );

  useLeaveGuardRegistration({
    id: "shared-bulk-entry-preview",
    isDirty: previewDirty || stagingOpenNonTerminal || commitMutation.isPending,
    kind: stagingOpenNonTerminal ? "import-staging" : "import-preview",
    previewBatchId,
    stagingBatchId: stagingBatchId ?? undefined,
    onDiscard: () => {
      void clearLocal();
    },
  });

  async function onSelectTemplate(key: string) {
    if (key === resolvedTemplateKey) return;
    const priorId = previewBatchId;
    setTemplateKey(key);
    // Cascade (8.3): clear file + preview bound to previous template.
    resetFileInput();
    setUploadError(null);
    setCommitError(null);
    setStagingBatchId(null);
    uploadMutation.reset();
    commitMutation.reset();
    setStep("template");
    await cancelPreviewIfAny(priorId);
  }

  async function onUpload() {
    if (busy) return;
    setUploadError(null);
    setCommitError(null);
    commitMutation.reset();
    if (!resolvedTemplateKey || !file) {
      setUploadError(operationalCopy.importUploadReject);
      return;
    }
    const priorId = previewBatchId;
    try {
      await cancelPreviewIfAny(priorId);
      setStagingBatchId(null);
      if (priorId) {
        uploadMutation.reset();
      }
      await uploadMutation.mutateAsync({
        templateKey: resolvedTemplateKey,
        fileName: file.name,
        contentBase64: await fileToBase64(file),
      });
      setStep("preview");
    } catch (err) {
      setUploadError(uploadErrorMessage(err, operationalCopy.importLoadError));
    }
  }

  async function onConfirmCommit() {
    if (busy || !previewBatchId || hasErrors) return;
    setCommitError(null);
    setStep("confirm");
    try {
      const res = await commitMutation.mutateAsync({ previewBatchId });
      if (res.stagingBatchId) {
        setStagingBatchId(res.stagingBatchId);
      }
      setStep("result");
    } catch (err) {
      const message = uploadErrorMessage(
        err,
        operationalCopy.bulkCommitFailed,
      );
      if (isNonRetryableBulkCommitError(err)) {
        // Failed cutover / invalid status → force new upload (no dead-end retry).
        await clearLocal();
        setUploadError(message);
        setStep("upload");
        return;
      }
      setCommitError(message);
    }
  }

  return (
    <div className="space-y-4" data-shared-bulk-entry="">
      <p className="text-body-small text-text-secondary">
        {operationalCopy.bulkFlowPurpose}
      </p>

      <ol className="flex flex-wrap gap-2" aria-label="مراحل ورود گروهی">
        {STEPS.map((s) => (
          <li
            key={s.id}
            aria-current={step === s.id ? "step" : undefined}
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

      <PendingSurface pending={busy} className="space-y-6">
        <section className="space-y-3" aria-labelledby="bulk-template-heading">
          <h2 id="bulk-template-heading" className="text-body-medium">
            {operationalCopy.bulkStepTemplate}
          </h2>
          <TemplateCatalogue
            variant="bulk"
            section={section}
            selectedTemplateKey={resolvedTemplateKey}
            disabled={busy || Boolean(preview && preview.status === "preview")}
            onSelectTemplate={(key) => {
              void onSelectTemplate(key);
            }}
          />
          {resolvedTemplateKey ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !resolvedTemplateKey}
              disabledReason={
                busy
                  ? operationalCopy.actionPending
                  : !resolvedTemplateKey
                    ? operationalCopy.importUploadPrerequisites
                    : undefined
              }
              onClick={() => setStep("upload")}
            >
              {operationalCopy.bulkContinueToUpload}
            </Button>
          ) : null}
        </section>

        {(step === "upload" ||
          step === "preview" ||
          step === "confirm" ||
          step === "result") && (
          <section className="space-y-3" aria-labelledby="bulk-upload-heading">
            <h2 id="bulk-upload-heading" className="text-body-medium">
              {operationalCopy.bulkStepUpload}
            </h2>
            <label className="block space-y-1 text-body-small">
              <span>{operationalCopy.importSelectFile}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                disabled={busy}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setUploadError(null);
                }}
              />
            </label>
            {file ? (
              <p className="text-caption text-text-secondary">{file.name}</p>
            ) : null}
            {uploadError ? (
              <FeedbackMessage kind="error">{uploadError}</FeedbackMessage>
            ) : null}
            <Button
              type="button"
              disabled={busy || !file || !resolvedTemplateKey}
              disabledReason={
                busy
                  ? operationalCopy.actionPending
                  : !resolvedTemplateKey
                    ? operationalCopy.importUploadPrerequisites
                    : !file
                      ? operationalCopy.importSelectFile
                      : undefined
              }
              onClick={() => {
                void onUpload();
              }}
            >
              {pendingLabel(
                uploadMutation.isPending,
                operationalCopy.importUploadAction,
                operationalCopy.actionPending,
              )}
            </Button>
          </section>
        )}

        {preview &&
          (step === "preview" ||
            step === "confirm" ||
            step === "result") && (
            <section
              className="space-y-3"
              aria-labelledby="bulk-preview-heading"
            >
              <h2 id="bulk-preview-heading" className="text-body-medium">
                {operationalCopy.bulkStepPreview}
              </h2>
              <p className="text-caption text-text-secondary">
                {operationalCopy.importRowsLabel}:{" "}
                {toPersianDigits(preview.rowCount)} —{" "}
                {operationalCopy.importErrorsLabel}:{" "}
                {toPersianDigits(preview.errorCount)} —{" "}
                {operationalCopy.importWarningsLabel}:{" "}
                {toPersianDigits(preview.warningCount)}
              </p>
              {preview.populationDisclosureFa ? (
                <FeedbackMessage kind="info">
                  {preview.populationDisclosureFa}
                </FeedbackMessage>
              ) : null}
              <ImportPreviewTable
                columns={preview.visibleColumns}
                rows={preview.rows}
                issueCitesFa={preview.issueCitesFa}
              />
              {hasErrors ? (
                <FeedbackMessage kind="error">
                  {operationalCopy.bulkPreviewHasErrors}
                </FeedbackMessage>
              ) : (
                <Button
                  type="button"
                  disabled={busy}
                  disabledReason={
                    busy ? operationalCopy.actionPending : undefined
                  }
                  onClick={() => setStep("confirm")}
                >
                  {operationalCopy.bulkContinueToConfirm}
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                disabledReason={
                  busy ? operationalCopy.actionPending : undefined
                }
                onClick={() => {
                  void clearLocal();
                }}
              >
                {operationalCopy.importCancelPreview}
              </Button>
            </section>
          )}

        {step === "confirm" && preview && !commitResult ? (
          <section
            className="space-y-3"
            aria-labelledby="bulk-confirm-heading"
          >
            <h2 id="bulk-confirm-heading" className="text-body-medium">
              {operationalCopy.bulkStepConfirm}
            </h2>
            <p className="text-body-small text-text-secondary">
              {operationalCopy.bulkConfirmHint}
            </p>
            {commitError ? (
              <FeedbackMessage kind="error">{commitError}</FeedbackMessage>
            ) : null}
            <Button
              type="button"
              disabled={busy || hasErrors}
              disabledReason={
                hasErrors
                  ? operationalCopy.bulkPreviewHasErrors
                  : busy
                    ? operationalCopy.actionPending
                    : undefined
              }
              onClick={() => {
                void onConfirmCommit();
              }}
            >
              {pendingLabel(
                commitMutation.isPending,
                operationalCopy.bulkConfirmAction,
                operationalCopy.actionPending,
              )}
            </Button>
          </section>
        ) : null}

        {step === "result" && commitResult ? (
          <section className="space-y-3" aria-labelledby="bulk-result-heading">
            <h2 id="bulk-result-heading" className="text-body-medium">
              {operationalCopy.bulkStepResult}
            </h2>
            <FeedbackMessage kind="success">
              {operationalCopy.bulkCommitSuccess}
            </FeedbackMessage>
            <ul className="space-y-1 text-body-small" role="list">
              <li>
                {operationalCopy.bulkResultCreated}:{" "}
                {toPersianDigits(commitResult.created)}
              </li>
              <li>
                {operationalCopy.bulkResultUpdated}:{" "}
                {toPersianDigits(commitResult.updated)}
              </li>
              <li>
                {operationalCopy.bulkResultRejected}:{" "}
                {toPersianDigits(commitResult.rejected)}
              </li>
            </ul>
            <p className="text-caption text-text-secondary">
              {operationalCopy.importCorrelationLabel}:{" "}
              {toPersianDigits(commitResult.correlationId)}
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              disabledReason={
                busy ? operationalCopy.actionPending : undefined
              }
              onClick={() => {
                void clearLocal();
              }}
            >
              {operationalCopy.bulkStartOver}
            </Button>
          </section>
        ) : null}
      </PendingSurface>
    </div>
  );
}
