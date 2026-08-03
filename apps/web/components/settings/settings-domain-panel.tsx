/**
 * Settings domain panel — registry-driven list via tRPC (Story 10.2–10.4).
 * FeedbackMessage for loading / empty / error / store-unavailable / mutation / export.
 */

"use client";

import { Download } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { SettingsOwningDomain } from "@divan/app-settings";

import type { SettingsMutationFeedback } from "@/components/settings/settings-parameter-editor";
import { SettingsParameterRow } from "@/components/settings/settings-parameter-row";
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
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { RowActionButton } from "@/components/ui/row-action-button";
import { downloadBase64File } from "@/lib/download-base64-file";
import { formatJalaliDateTimeFromIso } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import type { SettingsParameterRowDto } from "@/lib/settings-types";
import { api } from "@/lib/trpc/client";

type SettingsDomainPanelProps = {
  domain: SettingsOwningDomain;
};

const TECHNICAL_INVENTORY_DOMAINS = new Set<SettingsOwningDomain>([
  "access_session",
  "audit_integrity",
  "infrastructure",
]);

type InventoryExportPanel = {
  artifactId: string;
  classificationFa: string;
  handlingFa: string;
  expiresAt: string;
  fieldIds: string[];
  rowCount: number;
  requiresCustodyAck: boolean;
  custodyBoundaryFa: string;
  omittedSensitiveIds: string[];
};

export function SettingsDomainPanel({ domain }: SettingsDomainPanelProps) {
  const query = api.settings.listByDomain.useQuery(
    { domain },
    { refetchOnWindowFocus: false },
  );
  /** Optimistic patches until query refetch lands — never start as [] while data exists. */
  const [rowPatches, setRowPatches] = useState<
    Record<string, SettingsParameterRowDto>
  >({});
  const [feedback, setFeedback] = useState<SettingsMutationFeedback | null>(
    null,
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPanel, setExportPanel] = useState<InventoryExportPanel | null>(
    null,
  );
  const [custodyAck, setCustodyAck] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [destinationClass, setDestinationClass] = useState<
    "local_download" | "shared_drive" | "email" | "other"
  >("local_download");
  const [exportErrorFa, setExportErrorFa] = useState<string | null>(null);

  const titleId = useId();
  const descId = useId();
  const custodyId = useId();
  const recipientId = useId();

  const exportMutation = api.settings.exportInventory.useMutation({
    onSuccess: (artifact) => {
      setExportPanel({
        artifactId: artifact.artifactId,
        classificationFa: artifact.classificationFa,
        handlingFa: artifact.handlingFa,
        expiresAt: artifact.expiresAt,
        fieldIds: artifact.fieldIds,
        rowCount: artifact.rowCount,
        requiresCustodyAck: artifact.requiresCustodyAck,
        custodyBoundaryFa: artifact.custodyBoundaryFa,
        omittedSensitiveIds: artifact.omittedSensitiveIds,
      });
      setCustodyAck(false);
      setRecipient("");
      setDestinationClass("local_download");
      setExportErrorFa(null);
      setExportOpen(true);
      setFeedback(null);
    },
    onError: (err) => {
      setFeedback({
        kind: "error",
        message: err.message || operationalCopy.settingsInventoryExportError,
      });
    },
  });

  const downloadMutation = api.settings.downloadInventoryExport.useMutation({
    onSuccess: (file) => {
      downloadBase64File(file.contentBase64, file.filename, file.contentType);
      setFeedback({
        kind: "success",
        message: operationalCopy.settingsInventoryExportSuccess,
      });
      setExportOpen(false);
      setExportPanel(null);
    },
    onError: (err) => {
      setExportErrorFa(err.message || operationalCopy.exportLoadError);
    },
  });

  useEffect(() => {
    setRowPatches({});
  }, [domain, query.dataUpdatedAt]);

  useEffect(() => {
    setFeedback(null);
    setExportOpen(false);
    setExportPanel(null);
    setExportErrorFa(null);
  }, [domain]);

  if (query.isLoading || (query.isFetching && !query.data)) {
    return (
      <FeedbackMessage kind="loading">{operationalCopy.settingsLoading}</FeedbackMessage>
    );
  }

  if (query.isError) {
    return (
      <FeedbackMessage kind="error">
        {query.error.message || operationalCopy.settingsLoadError}
      </FeedbackMessage>
    );
  }

  const queryRows = query.data?.rows ?? [];
  const rows = queryRows.map((r) => rowPatches[r.key] ?? r);
  const storeUnavailable = query.data?.storeUnavailable === true;
  const storeDetail =
    query.data?.detailFa?.trim() || operationalCopy.settingsStoreUnavailable;
  const showInventoryExport = TECHNICAL_INVENTORY_DOMAINS.has(domain);
  const hasReadOnlyRows = rows.some(
    (r) => r.editability === "read_only_with_evidence",
  );

  if (rows.length === 0) {
    return (
      <FeedbackMessage kind="empty">{operationalCopy.settingsEmpty}</FeedbackMessage>
    );
  }

  function handleRowUpdated(updated: SettingsParameterRowDto) {
    setRowPatches((prev) => ({ ...prev, [updated.key]: updated }));
  }

  function handleExportOpenChange(next: boolean) {
    setExportOpen(next);
    if (!next) {
      setExportPanel(null);
      setExportErrorFa(null);
      setCustodyAck(false);
      setRecipient("");
    }
  }

  const downloadBusy = downloadMutation.isPending;
  const downloadEnabled =
    Boolean(exportPanel) &&
    (!exportPanel?.requiresCustodyAck || custodyAck) &&
    recipient.trim().length > 0 &&
    !downloadBusy;

  const expiryDisplay = exportPanel?.expiresAt
    ? toPersianDigits(
        formatJalaliDateTimeFromIso(exportPanel.expiresAt) ??
          exportPanel.expiresAt,
      )
    : null;

  return (
    <div className="space-y-4">
      {showInventoryExport && hasReadOnlyRows ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-subtle/60 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            {operationalCopy.settingsInventorySectionHint}
          </p>
          <RowActionButton
            label={operationalCopy.settingsInventoryExportCta}
            icon={Download}
            disabled={exportMutation.isPending}
            disabledReason={operationalCopy.settingsLoading}
            onClick={() => {
              if (exportMutation.isPending) return;
              setFeedback(null);
              exportMutation.mutate({ format: "csv" });
            }}
          />
        </div>
      ) : null}
      {storeUnavailable ? (
        <FeedbackMessage kind="info">{storeDetail}</FeedbackMessage>
      ) : null}
      {feedback ? (
        <FeedbackMessage kind={feedback.kind}>
          <span className="block">{feedback.message}</span>
          {feedback.kind === "success" && feedback.auditHref ? (
            <span className="mt-2 flex flex-wrap items-center gap-3">
              <a
                href={feedback.auditHref}
                className="text-caption font-medium underline-offset-2 hover:underline"
              >
                {operationalCopy.settingsViewInAuditCta}
              </a>
              {feedback.historyHref ? (
                <a
                  href={feedback.historyHref}
                  className="text-caption underline-offset-2 hover:underline"
                >
                  {operationalCopy.settingsParameterHistoryCta}
                </a>
              ) : null}
            </span>
          ) : null}
        </FeedbackMessage>
      ) : null}
      <div className="divide-y-0" role="list" aria-label="پارامترهای تنظیمات">
        {rows.map((row) => (
          <div key={row.key} role="listitem">
            <SettingsParameterRow
              row={row}
              storeUnavailable={storeUnavailable}
              onRowUpdated={handleRowUpdated}
              onFeedback={setFeedback}
            />
          </div>
        ))}
      </div>

      <Dialog open={exportOpen} onOpenChange={handleExportOpenChange}>
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
              {operationalCopy.settingsInventoryExportDialogHint}
            </DialogDescription>
          </DialogHeader>

          {exportPanel ? (
            <div className="flex flex-col gap-3">
              <p className="text-body-medium">
                {operationalCopy.exportClassificationLabel}:{" "}
                {exportPanel.classificationFa}
              </p>
              <p className="text-caption text-muted-foreground">
                {operationalCopy.exportHandlingLabel}: {exportPanel.handlingFa}
              </p>
              <p className="text-caption text-muted-foreground">
                {operationalCopy.exportExpiryLabel}: {expiryDisplay}
              </p>
              <p className="text-caption text-muted-foreground">
                {operationalCopy.exportRowCountLabel}:{" "}
                {toPersianDigits(String(exportPanel.rowCount))}
              </p>
              <div>
                <p className="text-body-medium mb-1">
                  {operationalCopy.exportFieldScopeLabel}
                </p>
                <ul className="text-caption list-inside list-disc">
                  {exportPanel.fieldIds.map((id) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
              </div>
              {exportPanel.omittedSensitiveIds.length > 0 ? (
                <p className="text-caption text-muted-foreground" role="status">
                  {operationalCopy.exportOmittedSensitiveHint}
                </p>
              ) : null}
              <p className="text-caption" role="note">
                {exportPanel.custodyBoundaryFa ||
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
                  disabled={downloadBusy}
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="settings-export-destination" className="text-caption">
                  {operationalCopy.exportDestinationLabel}
                </label>
                <select
                  id="settings-export-destination"
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
                  disabled={downloadBusy}
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

              {exportPanel.requiresCustodyAck ? (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={custodyId}
                    checked={custodyAck}
                    onCheckedChange={(v) => setCustodyAck(v === true)}
                    disabled={downloadBusy}
                  />
                  <label
                    htmlFor={custodyId}
                    className="text-caption leading-relaxed font-normal"
                  >
                    {operationalCopy.exportCustodyAckLabel}
                  </label>
                </div>
              ) : null}

              {exportErrorFa ? (
                <p className="text-body text-destructive" role="alert">
                  {exportErrorFa}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleExportOpenChange(false)}
              disabled={downloadBusy}
              disabledReason={operationalCopy.actionPending}
            >
              {operationalCopy.exportClose}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!downloadEnabled}
              disabledReason={
                exportPanel?.requiresCustodyAck && !custodyAck
                  ? operationalCopy.exportDownloadDisabledReason
                  : !recipient.trim()
                    ? operationalCopy.exportRecipientRequired
                    : downloadBusy
                      ? operationalCopy.actionPending
                      : undefined
              }
              onClick={() => {
                if (!exportPanel || !downloadEnabled) return;
                if (exportPanel.requiresCustodyAck && !custodyAck) {
                  setExportErrorFa(operationalCopy.exportDownloadDisabledReason);
                  return;
                }
                if (!recipient.trim()) {
                  setExportErrorFa(operationalCopy.exportRecipientRequired);
                  return;
                }
                setExportErrorFa(null);
                downloadMutation.mutate({
                  artifactId: exportPanel.artifactId,
                  recipient: recipient.trim(),
                  destinationClass,
                  custodyAck: exportPanel.requiresCustodyAck ? custodyAck : true,
                });
              }}
            >
              {downloadBusy
                ? operationalCopy.exportBusy
                : operationalCopy.exportDownload}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
