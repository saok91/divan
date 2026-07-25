"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatJalaliDateTimeFromIso } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type ExportSource =
  | {
      kind: "report";
      filter: {
        reportKey: string;
        teamId?: string;
        evaluationMode?: "current" | "as_of";
        asOfDate?: string;
        rangeStart?: string;
        rangeEnd?: string;
      };
      reviewedSnapshotHash: string;
    }
  | {
      kind: "personnel_list";
      reviewedSnapshotHash: string;
      normalizedQuery?: string;
    };

type PanelState = {
  artifactId: string;
  classificationFa: string;
  handlingFa: string;
  expiresAt: string;
  fieldIds: string[];
  rowCount: number;
  format: "csv" | "xlsx";
  requiresCustodyAck: boolean;
  hasSensitiveFields: boolean;
  custodyBoundaryFa: string;
  omittedSensitiveIds: string[];
};

function downloadBase64File(
  base64: string,
  filename: string,
  contentType: string,
) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Governed export artifact panel (Story 6.5 / UX-DR17).
 * Server reauth is mandatory — custody checkbox is NOT reauth.
 */
export function ExportArtifactPanel({
  source,
  disabled,
  className,
}: {
  source: ExportSource | null;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [format, setFormat] = React.useState<"csv" | "xlsx">("csv");
  const [panel, setPanel] = React.useState<PanelState | null>(null);
  const [custodyAck, setCustodyAck] = React.useState(false);
  const [recipient, setRecipient] = React.useState("");
  const [destinationClass, setDestinationClass] = React.useState<
    "local_download" | "shared_drive" | "email" | "other"
  >("local_download");
  const [errorFa, setErrorFa] = React.useState<string | null>(null);
  const generateInFlight = React.useRef(false);

  const utils = api.useUtils();
  const createReport = api.export.createFromReport.useMutation();
  const createPersonnel = api.export.createFromPersonnel.useMutation();
  const download = api.export.download.useMutation();

  const busy =
    createReport.isPending ||
    createPersonnel.isPending ||
    download.isPending;

  const titleId = React.useId();
  const descId = React.useId();
  const custodyId = React.useId();
  const recipientId = React.useId();

  function resetPanelState() {
    setPanel(null);
    setCustodyAck(false);
    setErrorFa(null);
    setRecipient("");
    setDestinationClass("local_download");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetPanelState();
  }

  const canOpen = Boolean(source) && !disabled;

  async function handleGenerate() {
    if (!source || generateInFlight.current) return;
    generateInFlight.current = true;
    setErrorFa(null);
    try {
      if (source.kind === "report") {
        const result = await createReport.mutateAsync({
          filter: source.filter,
          evaluationMode: source.filter.evaluationMode,
          asOfDate: source.filter.asOfDate,
          reviewedSnapshotHash: source.reviewedSnapshotHash,
          format,
        });
        setPanel(result);
      } else {
        const result = await createPersonnel.mutateAsync({
          reviewedSnapshotHash: source.reviewedSnapshotHash,
          format,
          normalizedQuery: source.normalizedQuery,
        });
        setPanel(result);
      }
      void utils.export.invalidate();
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : operationalCopy.exportLoadError;
      setErrorFa(message || operationalCopy.exportLoadError);
    } finally {
      generateInFlight.current = false;
    }
  }

  async function handleDownload() {
    if (!panel) return;
    if (panel.requiresCustodyAck && !custodyAck) {
      setErrorFa(operationalCopy.exportDownloadDisabledReason);
      return;
    }
    if (!recipient.trim()) {
      setErrorFa(operationalCopy.exportRecipientRequired);
      return;
    }
    setErrorFa(null);
    try {
      const result = await download.mutateAsync({
        artifactId: panel.artifactId,
        recipient: recipient.trim(),
        destinationClass,
        custodyAck: panel.requiresCustodyAck ? custodyAck : true,
      });
      downloadBase64File(
        result.contentBase64,
        result.filename,
        result.contentType,
      );
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : operationalCopy.exportLoadError;
      setErrorFa(message || operationalCopy.exportLoadError);
    }
  }

  const downloadEnabled =
    Boolean(panel) &&
    (!panel?.requiresCustodyAck || custodyAck) &&
    recipient.trim().length > 0 &&
    !busy;

  const expiryDisplay = panel?.expiresAt
    ? toPersianDigits(
        formatJalaliDateTimeFromIso(panel.expiresAt) ?? panel.expiresAt,
      )
    : null;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={className}
        disabled={!canOpen}
        onClick={() => setOpen(true)}
      >
        {operationalCopy.exportOpenPanel}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-lg"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <DialogHeader>
            <DialogTitle id={titleId}>
              {operationalCopy.exportPanelTitle}
            </DialogTitle>
            <DialogDescription id={descId} className="text-caption">
              {operationalCopy.exportCustodyBoundary}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {!panel ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="export-format" className="text-caption">
                    {operationalCopy.exportFormatLabel}
                  </label>
                  <select
                    id="export-format"
                    className="border-input bg-background h-9 rounded-md border px-2 text-body"
                    value={format}
                    onChange={(e) =>
                      setFormat(e.target.value === "xlsx" ? "xlsx" : "csv")
                    }
                    disabled={busy}
                  >
                    <option value="csv">{operationalCopy.exportFormatCsv}</option>
                    <option value="xlsx">
                      {operationalCopy.exportFormatXlsx}
                    </option>
                  </select>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy || !source}
                  onClick={() => void handleGenerate()}
                >
                  {busy
                    ? operationalCopy.exportBusy
                    : operationalCopy.exportGenerate}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-body-medium">
                  {operationalCopy.exportClassificationLabel}:{" "}
                  {panel.classificationFa}
                </p>
                <p className="text-caption text-muted-foreground">
                  {operationalCopy.exportHandlingLabel}: {panel.handlingFa}
                </p>
                <p className="text-caption text-muted-foreground">
                  {operationalCopy.exportExpiryLabel}: {expiryDisplay}
                </p>
                <p className="text-caption text-muted-foreground">
                  {operationalCopy.exportRowCountLabel}:{" "}
                  {toPersianDigits(String(panel.rowCount))}
                </p>
                <div>
                  <p className="text-body-medium mb-1">
                    {operationalCopy.exportFieldScopeLabel}
                  </p>
                  <ul className="text-caption list-inside list-disc">
                    {panel.fieldIds.map((id) => (
                      <li key={id}>{id}</li>
                    ))}
                  </ul>
                </div>
                {panel.omittedSensitiveIds.length > 0 ? (
                  <p className="text-caption text-muted-foreground" role="status">
                    {operationalCopy.exportOmittedSensitiveHint}
                  </p>
                ) : null}
                <p className="text-caption" role="note">
                  {panel.custodyBoundaryFa ||
                    operationalCopy.exportCustodyBoundary}
                </p>

                <div className="flex flex-col gap-1">
                  <label htmlFor={recipientId} className="text-caption">
                    {operationalCopy.exportRecipientLabel}
                  </label>
                  <Input
                    id={recipientId}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    disabled={busy}
                    autoComplete="off"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="export-destination" className="text-caption">
                    {operationalCopy.exportDestinationLabel}
                  </label>
                  <select
                    id="export-destination"
                    className="border-input bg-background h-9 rounded-md border px-2 text-body"
                    value={destinationClass}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (
                        v === "local_download" ||
                        v === "shared_drive" ||
                        v === "email" ||
                        v === "other"
                      ) {
                        setDestinationClass(v);
                      }
                    }}
                    disabled={busy}
                  >
                    <option value="local_download">
                      {operationalCopy.exportDestinationLocal}
                    </option>
                    <option value="shared_drive">
                      {operationalCopy.exportDestinationShared}
                    </option>
                    <option value="email">
                      {operationalCopy.exportDestinationEmail}
                    </option>
                    <option value="other">
                      {operationalCopy.exportDestinationOther}
                    </option>
                  </select>
                </div>

                {panel.requiresCustodyAck ? (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id={custodyId}
                      checked={custodyAck}
                      onCheckedChange={(v) => setCustodyAck(v === true)}
                      disabled={busy}
                    />
                    <label
                      htmlFor={custodyId}
                      className="text-caption leading-relaxed font-normal"
                    >
                      {operationalCopy.exportCustodyAckLabel}
                    </label>
                  </div>
                ) : null}
              </div>
            )}

            {errorFa ? (
              <p className="text-body text-destructive" role="alert">
                {errorFa}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            {panel ? (
              <Button
                type="button"
                variant="secondary"
                disabled={!downloadEnabled}
                title={
                  !downloadEnabled
                    ? operationalCopy.exportDownloadDisabledReason
                    : undefined
                }
                aria-disabled={!downloadEnabled}
                onClick={() => void handleDownload()}
                className={cn(!downloadEnabled && "opacity-60")}
              >
                {operationalCopy.exportDownload}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={busy}
            >
              {operationalCopy.exportClose}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
