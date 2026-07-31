"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { downloadBase64File } from "@/lib/download-base64-file";
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";

export type TemplateCatalogueVariant = "migration" | "bulk";

export type TemplateCatalogueSection =
  | "personnel"
  | "personnel-events"
  | "headcount";

/**
 * Shared template catalogue + sample download (Story 9.1 / 9.3).
 * Mounted on «ورود داده» identify step and each «ورود گروهی» tab.
 * Denied templates stay visible with FeedbackMessage access requirement.
 */
export function TemplateCatalogue({
  variant,
  section,
  selectedTemplateKey,
  onSelectTemplate,
  disabled,
}: {
  variant: TemplateCatalogueVariant;
  /** Bulk host section — filter to templates whose sections include this. */
  section?: TemplateCatalogueSection;
  /** When provided, highlights/selects a row for the migration wizard. */
  selectedTemplateKey?: string;
  onSelectTemplate?: (key: string) => void;
  disabled?: boolean;
}) {
  const templatesQuery = api.migration.templates.useQuery();
  const downloadMutation = api.migration.downloadSampleWorkbook.useMutation();
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = React.useState<string | null>(
    null,
  );

  const visibleTemplates = React.useMemo(() => {
    const all = templatesQuery.data?.templates ?? [];
    if (variant === "migration") {
      return all.filter((t) => t.migrationSodEligible === true);
    }
    if (section) {
      return all.filter((t) => t.sections?.includes(section));
    }
    return all;
  }, [templatesQuery.data?.templates, variant, section]);

  async function onDownload(templateKey: string) {
    setDownloadError(null);
    setDownloadingKey(templateKey);
    try {
      const res = await downloadMutation.mutateAsync({ templateKey });
      downloadBase64File(res.contentBase64, res.fileName, res.contentType);
    } catch (err) {
      const msg =
        err &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string" &&
        /[\u0600-\u06FF]/.test((err as { message: string }).message)
          ? (err as { message: string }).message
          : operationalCopy.importSampleDownloadError;
      setDownloadError(msg);
    } finally {
      setDownloadingKey(null);
    }
  }

  return (
    <div className="space-y-3" data-template-catalogue={variant}>
      <h3 className="text-body-medium text-text-primary">
        {operationalCopy.importCatalogueTitle}
      </h3>

      {templatesQuery.isLoading ? (
        <FeedbackMessage kind="loading">
          {operationalCopy.actionPending}
        </FeedbackMessage>
      ) : templatesQuery.isError ? (
        <FeedbackMessage kind="error">
          {templatesQuery.error.message || operationalCopy.importLoadError}
        </FeedbackMessage>
      ) : visibleTemplates.length === 0 ? (
        <FeedbackMessage kind="empty">
          {operationalCopy.importNoTemplates}
        </FeedbackMessage>
      ) : (
        <ul className="space-y-3" role="list">
          {visibleTemplates.map((t) => {
            const selected = selectedTemplateKey === t.key;
            const accessReason =
              t.accessRequirementFa ??
              operationalCopy.importTemplateAccessRequired.replace(
                "{permission}",
                t.requiredPermission,
              );
            return (
              <li
                key={t.key}
                className="space-y-2 border-b border-border pb-3 last:border-b-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    {onSelectTemplate ? (
                      <button
                        type="button"
                        className={
                          selected
                            ? "text-body-medium text-text-primary underline-offset-2 underline"
                            : "text-body-medium text-text-primary hover:underline underline-offset-2"
                        }
                        disabled={disabled || !t.callerMayUse}
                        onClick={() => {
                          if (!t.callerMayUse || disabled) return;
                          onSelectTemplate(t.key);
                        }}
                      >
                        {t.titleFa}
                      </button>
                    ) : (
                      <p className="text-body-medium text-text-primary">
                        {t.titleFa}
                      </p>
                    )}
                    <p className="text-caption text-text-secondary">
                      {operationalCopy.importCataloguePurposeLabel}:{" "}
                      {t.purposeFa}
                    </p>
                    <p className="text-caption text-text-tertiary">
                      {operationalCopy.importCataloguePermissionLabel}:{" "}
                      {t.requiredPermission}
                    </p>
                  </div>
                  {t.callerMayUse ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        disabled ||
                        downloadMutation.isPending ||
                        downloadingKey === t.key
                      }
                      onClick={() => void onDownload(t.key)}
                      disabledReason={
                        downloadMutation.isPending
                          ? operationalCopy.actionPending
                          : undefined
                      }
                    >
                      {operationalCopy.importSampleDownload}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled
                      disabledReason={accessReason}
                    >
                      {operationalCopy.importSampleDownload}
                    </Button>
                  )}
                </div>
                {!t.callerMayUse && t.accessRequirementFa ? (
                  <FeedbackMessage kind="info">
                    {t.accessRequirementFa}
                  </FeedbackMessage>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {downloadError ? (
        <FeedbackMessage kind="error">{downloadError}</FeedbackMessage>
      ) : null}
    </div>
  );
}
