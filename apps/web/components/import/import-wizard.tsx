"use client";

import * as React from "react";

import { ImportPreviewTable } from "@/components/import/import-preview-table";
import { useLeaveGuardRegistration } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
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
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type WizardStep = "identify" | "validate" | "preview" | "confirm";

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
    // tRPC / MigrationError Persian messages are usable as-is
    if (/[\u0600-\u06FF]/.test(msg)) return msg;
    // File read NotReadableError (English DOMException)
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
];

export function ImportWizard() {
  const [step, setStep] = React.useState<WizardStep>("identify");
  const [templateKey, setTemplateKey] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [localMessage, setLocalMessage] = React.useState<string | null>(null);

  const templatesQuery = api.migration.templates.useQuery();
  const uploadMutation = api.migration.uploadAndValidate.useMutation();
  const cancelMutation = api.migration.cancelPreview.useMutation();
  const confirmMutation = api.migration.confirmDraft.useMutation();

  const resolvedTemplateKey =
    templateKey || templatesQuery.data?.templates[0]?.key || "";

  const preview = confirmMutation.data ?? uploadMutation.data ?? null;
  const previewBatchId = preview?.previewBatchId;
  const previewLoaded = Boolean(preview && preview.status !== "cancelled");

  const clearPreview = React.useCallback(async () => {
    const id = previewBatchId;
    setSheetOpen(false);
    setConfirmOpen(false);
    setStep("identify");
    setLocalMessage(null);
    uploadMutation.reset();
    confirmMutation.reset();
    if (id) {
      try {
        await cancelMutation.mutateAsync({ previewBatchId: id });
      } catch {
        // Draft may already be gone — local clear still applies.
      }
    }
  }, [previewBatchId, uploadMutation, confirmMutation, cancelMutation]);

  useLeaveGuardRegistration({
    id: "import-wizard-preview",
    // Data-state dirty: preview draft open — never Sheet open alone.
    isDirty: Boolean(preview && preview.status === "preview"),
    kind: "import-preview",
    previewBatchId: previewBatchId,
    onDiscard: () => {
      void clearPreview();
    },
  });

  async function onUpload() {
    setUploadError(null);
    setLocalMessage(null);
    confirmMutation.reset();
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
      await confirmMutation.mutateAsync({ previewBatchId });
      setConfirmOpen(false);
      setStep("confirm");
      setLocalMessage(operationalCopy.importDraftConfirmed);
    } catch (err) {
      setUploadError(uploadErrorMessage(err));
      setConfirmOpen(false);
    }
  }

  const busy =
    uploadMutation.isPending ||
    cancelMutation.isPending ||
    confirmMutation.isPending;

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
          <p className="text-caption text-muted-foreground">…</p>
        ) : templatesQuery.isError ? (
          <p className="text-caption text-destructive" role="alert">
            {templatesQuery.error.message || operationalCopy.importLoadError}
          </p>
        ) : (templatesQuery.data?.templates.length ?? 0) === 0 ? (
          <p className="text-caption">{operationalCopy.importNoTemplates}</p>
        ) : (
          <div className="space-y-2">
            <label className="text-caption" htmlFor="import-template">
              {operationalCopy.importSelectTemplate}
            </label>
            <select
              id="import-template"
              className="flex h-9 w-full max-w-md rounded-md border border-border bg-background px-3 text-body"
              value={resolvedTemplateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              disabled={busy || previewLoaded}
            >
              {templatesQuery.data?.templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.titleFa}
                </option>
              ))}
            </select>
            <p className="text-caption text-muted-foreground">
              قالب موقتی — انجماد AR-MIGRATION هنوز نهایی شده.
            </p>
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
            variant="primary"
            disabled={busy || !resolvedTemplateKey || !file || previewLoaded}
            onClick={() => void onUpload()}
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
                  variant="outline"
                  disabled={busy}
                  onClick={() => setSheetOpen(true)}
                >
                  {operationalCopy.importReopenPreview}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void clearPreview()}
              >
                {operationalCopy.importCancelPreview}
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
        {preview?.populationDisclosureFa ? (
          <p className="text-caption text-muted-foreground">
            {operationalCopy.importPopulationHint}:{" "}
            {preview.populationDisclosureFa}
          </p>
        ) : null}
      </section>

      {/* Preview Sheet — full width; confirm Dialog is the only dialog above it */}
      <Sheet
        open={sheetOpen && previewLoaded}
        onOpenChange={(open) => {
          if (!open) {
            // Closing sheet does not cancel draft — dirty leave-guard remains.
            setSheetOpen(false);
          }
        }}
      >
        <SheetContent
          side="bottom"
          fullWidth
          className="gap-0 p-0"
          // Esc closes sheet only; leave-guard handles navigation away.
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
            {preview ? (
              <ImportPreviewTable
                columns={preview.visibleColumns}
                rows={preview.rows}
                issueCitesFa={preview.issueCitesFa}
              />
            ) : null}
            {preview?.statusHintFa ? (
              <p className="mt-3 text-caption text-muted-foreground">
                {preview.statusHintFa}
              </p>
            ) : null}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void clearPreview()}
            >
              {operationalCopy.importCancelPreview}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setSheetOpen(false)}
            >
              {operationalCopy.importClosePreview}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={
                busy ||
                !preview ||
                preview.errorCount > 0 ||
                preview.status === "confirmed-draft"
              }
              onClick={() => {
                // Single dialog depth: close is not needed — Dialog stacks above Sheet.
                setConfirmOpen(true);
              }}
            >
              {operationalCopy.importConfirmDraft}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          // Only one confirmation Dialog above the Sheet.
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
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              {operationalCopy.importConfirmDismiss}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => void onConfirmDraft()}
            >
              {operationalCopy.importConfirmDraft}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
