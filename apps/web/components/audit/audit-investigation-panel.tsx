/**
 * Audit investigation panel (Story 7.1 / FR-42 / UX-DR7 / UX-DR22).
 * Search-only surface — disposition independence via assertReviewIndependence.
 * Export artifact bytes → existing export.getArtifact / export.download only.
 */

"use client";

import * as React from "react";

import { GovernedDataTable } from "@/components/governed-data-table";
import type { GovernedColumn } from "@/components/governed-data-table";
import {
  useLeaveGuardOptional,
  useLeaveGuardRegistration,
} from "@/components/leave-guard";
import { JalaliDatePicker } from "@/components/jalali-date-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatJalaliDateTimeFromIso, gregorianDateTimePartsToIso } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";

type AuditRow = {
  id: string;
  eventClass: "access" | "business";
  correlationId: string;
  actorAccountId: string | null;
  occurredAt: string;
  operation: string;
  scopeSummary: string;
  result: "allow" | "deny" | null;
  reason: string | null;
  entityType: string | null;
  entityId: string | null;
  migrationRelated: boolean;
  exportArtifactId: string | null;
};

type DraftFilters = {
  actorAccountId: string;
  operation: string;
  entityType: string;
  entityId: string;
  result: "" | "allow" | "deny";
  correlationId: string;
  eventClass: "" | "access" | "business";
  fromGregorian: string | undefined;
  toGregorian: string | undefined;
};

const EMPTY_DRAFT: DraftFilters = {
  actorAccountId: "",
  operation: "",
  entityType: "",
  entityId: "",
  result: "",
  correlationId: "",
  eventClass: "",
  fromGregorian: undefined,
  toGregorian: undefined,
};

function draftToInput(draft: DraftFilters) {
  const fromIso = draft.fromGregorian
    ? gregorianDateTimePartsToIso({ date: draft.fromGregorian, time: "00:00" })
    : null;
  const toIso = draft.toGregorian
    ? gregorianDateTimePartsToIso({ date: draft.toGregorian, time: "23:59" })
    : null;
  return {
    actorAccountId: draft.actorAccountId.trim() || undefined,
    operation: draft.operation.trim() || undefined,
    entityType: draft.entityType.trim() || undefined,
    entityId: draft.entityId.trim() || undefined,
    result: draft.result || undefined,
    correlationId: draft.correlationId.trim() || undefined,
    eventClass: draft.eventClass || undefined,
    occurredAtFrom: fromIso ? new Date(fromIso) : undefined,
    // Inclusive end-of-day: bump to next ms after 23:59 Tehran wall.
    occurredAtTo: toIso
      ? new Date(new Date(toIso).getTime() + 59_000 + 999)
      : undefined,
  };
}

function trpcErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = String((err as { message: unknown }).message ?? "").trim();
    // Prefer mapped Persian operational copy; avoid leaking infra stacks.
    if (msg && !/^(Error|INTERNAL|prisma|ECONN|failed to)/i.test(msg)) {
      return msg;
    }
  }
  return fallback;
}

function resultLabel(result: AuditRow["result"]): string {
  if (result === "allow") return "اجازه";
  if (result === "deny") return "رد";
  return "—";
}

const COLUMNS: GovernedColumn<AuditRow>[] = [
  {
    id: "occurredAt",
    header: "زمان",
    accessor: (r) => r.occurredAt,
    sortable: true,
    sticky: "identifier",
    cell: (r) => (
      <span className="text-tabular" dir="ltr" title={r.occurredAt}>
        {toPersianDigits(
          formatJalaliDateTimeFromIso(r.occurredAt) || r.occurredAt,
        )}
      </span>
    ),
  },
  {
    id: "actorAccountId",
    header: "بازیگر",
    accessor: (r) => r.actorAccountId ?? "",
    filter: "text",
    cell: (r) =>
      r.actorAccountId ? (
        <span className="text-tabular" dir="ltr">
          {toPersianDigits(r.actorAccountId)}
        </span>
      ) : (
        "—"
      ),
  },
  {
    id: "operation",
    header: "عملیات",
    accessor: (r) => r.operation,
    filter: "text",
    sortable: true,
  },
  {
    id: "entity",
    header: "موجودیت",
    accessor: (r) =>
      [r.entityType, r.entityId].filter(Boolean).join(" / ") || "",
    cell: (r) => {
      const label = [r.entityType, r.entityId].filter(Boolean).join(" / ");
      return label ? (
        <span className="text-tabular" dir="ltr">
          {toPersianDigits(label)}
        </span>
      ) : (
        "—"
      );
    },
  },
  {
    id: "scopeSummary",
    header: "محدوده",
    accessor: (r) => r.scopeSummary,
  },
  {
    id: "result",
    header: "نتیجه",
    accessor: (r) => r.result ?? "",
    filter: "enum",
    enumOptions: [
      { value: "allow", label: "اجازه" },
      { value: "deny", label: "رد" },
    ],
    cell: (r) => resultLabel(r.result),
  },
  {
    id: "reason",
    header: "دلیل",
    accessor: (r) => r.reason ?? "",
    cell: (r) => r.reason || "—",
  },
  {
    id: "correlationId",
    header: "همبستگی",
    accessor: (r) => r.correlationId,
    filter: "text",
    cell: (r) => (
      <span className="text-tabular text-caption" dir="ltr">
        {toPersianDigits(r.correlationId)}
      </span>
    ),
  },
];

/**
 * سطح تحقیق ممیزی — GovernedDataTable + فیلترهای حاکمیتی.
 */
export function AuditInvestigationPanel() {
  const leaveGuard = useLeaveGuardOptional();
  const [draft, setDraft] = React.useState<DraftFilters>(EMPTY_DRAFT);
  const [applied, setApplied] = React.useState<DraftFilters>(EMPTY_DRAFT);
  const [detail, setDetail] = React.useState<AuditRow | null>(null);
  const [artifactBusy, setArtifactBusy] = React.useState(false);
  const [artifactError, setArtifactError] = React.useState<string | null>(null);
  const [custodyAck, setCustodyAck] = React.useState(false);
  const [recipient, setRecipient] = React.useState("");

  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);

  useLeaveGuardRegistration({
    id: "audit-investigation-filters",
    isDirty: dirty,
    onSave: async () => {
      setApplied(draft);
      setDetail(null);
      return true;
    },
    onDiscard: () => {
      setDraft(applied);
      setDetail(null);
      setArtifactError(null);
      setCustodyAck(false);
      setRecipient("");
    },
  });

  const searchQuery = api.audit.search.useQuery(draftToInput(applied), {
    refetchOnWindowFocus: false,
  });

  const capsQuery = api.audit.capabilities.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const canOpenExportArtifact = capsQuery.data?.canOpenExportArtifact === true;

  const downloadMutation = api.export.download.useMutation();
  const getArtifactQuery = api.export.getArtifact.useQuery(
    { artifactId: detail?.exportArtifactId ?? "" },
    {
      enabled: Boolean(detail?.exportArtifactId) && canOpenExportArtifact,
    },
  );
  const assertReview = api.audit.assertReviewIndependence.useMutation();

  const rows = React.useMemo((): AuditRow[] => {
    return (searchQuery.data?.rows ?? []).map((r) => ({
      id: r.id,
      eventClass: r.eventClass,
      correlationId: r.correlationId,
      actorAccountId: r.actorAccountId,
      occurredAt: r.occurredAt,
      operation: r.operation,
      scopeSummary: r.scopeSummary,
      result: r.result,
      reason: r.reason,
      entityType: r.entityType,
      entityId: r.entityId,
      migrationRelated: r.migrationRelated,
      exportArtifactId: r.exportArtifactId,
    }));
  }, [searchQuery.data?.rows]);

  function updateDraft<K extends keyof DraftFilters>(
    key: K,
    value: DraftFilters[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setApplied({ ...draft });
    setDetail(null);
  }

  function clearFilters() {
    setDraft(EMPTY_DRAFT);
    setApplied(EMPTY_DRAFT);
    setDetail(null);
  }

  async function openExportArtifact() {
    if (!detail?.exportArtifactId || !canOpenExportArtifact) return;
    setArtifactBusy(true);
    setArtifactError(null);
    try {
      if (getArtifactQuery.isError) {
        setArtifactError(operationalCopy.exportLoadError);
        return;
      }
      const artifact = getArtifactQuery.data;
      if (!artifact) {
        setArtifactError(operationalCopy.exportArtifactNotFound);
        return;
      }
      if (artifact.requiresCustodyAck && !custodyAck) {
        setArtifactError(operationalCopy.exportDownloadDisabledReason);
        return;
      }
      if (!recipient.trim()) {
        setArtifactError(operationalCopy.exportRecipientRequired);
        return;
      }
      const file = await downloadMutation.mutateAsync({
        artifactId: detail.exportArtifactId,
        recipient: recipient.trim(),
        destinationClass: "local_download",
        custodyAck: artifact.requiresCustodyAck ? custodyAck : true,
      });
      const binary = atob(file.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: file.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setArtifactError(trpcErrorMessage(err, operationalCopy.exportLoadError));
    } finally {
      setArtifactBusy(false);
    }
  }

  async function openIndependentReview() {
    if (!detail?.id) return;
    try {
      const result = await assertReview.mutateAsync({
        evidenceEventId: detail.id,
        reviewHref: "/access",
      });
      const href = result.reviewHref;
      if (leaveGuard) {
        void leaveGuard.requestNavigation(href);
      } else {
        window.location.assign(href);
      }
    } catch (err) {
      setArtifactError(
        trpcErrorMessage(err, operationalCopy.auditSelfReviewBlocked),
      );
    }
  }

  const honestyLines = searchQuery.data?.migrationEvidenceHonestyFa ?? [];
  const populationDisclosure = searchQuery.data?.populationDisclosureFa;
  const authAttemptHonesty = searchQuery.data?.authAttemptNotPrimarySoTFa;
  const inferenceBulkHonesty = searchQuery.data?.inferenceBulkEvidenceOnlyFa;
  const tableEmptyMessage = searchQuery.isLoading
    ? operationalCopy.auditLoadingResults
    : searchQuery.isError
      ? operationalCopy.auditLoadError
      : operationalCopy.auditEmptyFilter;

  return (
    <section
      className="space-y-4"
      aria-labelledby="audit-investigation-heading"
    >
      <header className="space-y-1">
        <h1 id="audit-investigation-heading" className="text-title">
          ممیزی
        </h1>
        <p className="text-body text-muted-foreground">
          {operationalCopy.auditSearchHeading}
        </p>
      </header>

      {searchQuery.isError ? (
        <p className="text-body text-destructive" role="alert">
          {operationalCopy.auditLoadError}
        </p>
      ) : null}

      {populationDisclosure ? (
        <p className="text-body text-muted-foreground" role="status">
          {populationDisclosure}
        </p>
      ) : null}

      {authAttemptHonesty ? (
        <p className="text-caption text-muted-foreground" role="note">
          {authAttemptHonesty}
        </p>
      ) : null}

      {inferenceBulkHonesty ? (
        <p className="text-caption text-muted-foreground" role="note">
          {inferenceBulkHonesty}
        </p>
      ) : null}

      {honestyLines.length > 0 ? (
        <div
          className="space-y-1"
          role="note"
          aria-label={operationalCopy.auditMigrationHonestyTitle}
        >
          <p className="text-caption text-muted-foreground">
            {operationalCopy.auditMigrationHonestyTitle}
          </p>
          <ul className="list-disc space-y-1 pe-5 text-caption text-muted-foreground">
            {honestyLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className="grid gap-3 rounded-md border border-border/60 bg-muted/20 p-3 md:grid-cols-2 lg:grid-cols-3"
        onSubmit={applyFilters}
        aria-label="فیلترهای تحقیق ممیزی"
      >
        <label className="block space-y-1.5 text-caption" htmlFor="audit-filter-actor">
          {operationalCopy.auditFilterActor}
          <Input
            id="audit-filter-actor"
            value={draft.actorAccountId}
            onChange={(e) => updateDraft("actorAccountId", e.target.value)}
            dir="ltr"
            autoComplete="off"
          />
        </label>
        <label
          className="block space-y-1.5 text-caption"
          htmlFor="audit-filter-operation"
        >
          {operationalCopy.auditFilterOperation}
          <Input
            id="audit-filter-operation"
            value={draft.operation}
            onChange={(e) => updateDraft("operation", e.target.value)}
            dir="ltr"
            autoComplete="off"
          />
        </label>
        <label
          className="block space-y-1.5 text-caption"
          htmlFor="audit-filter-entity-type"
        >
          {operationalCopy.auditFilterEntityType}
          <Input
            id="audit-filter-entity-type"
            value={draft.entityType}
            onChange={(e) => updateDraft("entityType", e.target.value)}
            dir="ltr"
            autoComplete="off"
          />
        </label>
        <label
          className="block space-y-1.5 text-caption"
          htmlFor="audit-filter-entity-id"
        >
          {operationalCopy.auditFilterEntityId}
          <Input
            id="audit-filter-entity-id"
            value={draft.entityId}
            onChange={(e) => updateDraft("entityId", e.target.value)}
            dir="ltr"
            autoComplete="off"
          />
        </label>
        <label
          className="block space-y-1.5 text-caption"
          htmlFor="audit-filter-result"
        >
          {operationalCopy.auditFilterResult}
          <select
            id="audit-filter-result"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.result}
            onChange={(e) =>
              updateDraft("result", e.target.value as DraftFilters["result"])
            }
          >
            <option value="">همه</option>
            <option value="allow">اجازه</option>
            <option value="deny">رد</option>
          </select>
        </label>
        <label
          className="block space-y-1.5 text-caption"
          htmlFor="audit-filter-event-class"
        >
          {operationalCopy.auditFilterEventClass}
          <select
            id="audit-filter-event-class"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.eventClass}
            onChange={(e) =>
              updateDraft(
                "eventClass",
                e.target.value as DraftFilters["eventClass"],
              )
            }
          >
            <option value="">همه</option>
            <option value="access">دسترسی</option>
            <option value="business">کسب‌وکار</option>
          </select>
        </label>
        <label
          className="block space-y-1.5 text-caption"
          htmlFor="audit-filter-correlation"
        >
          {operationalCopy.auditFilterCorrelation}
          <Input
            id="audit-filter-correlation"
            value={draft.correlationId}
            onChange={(e) => updateDraft("correlationId", e.target.value)}
            dir="ltr"
            autoComplete="off"
          />
        </label>
        <div className="space-y-1.5">
          <span className="text-caption">{operationalCopy.auditFilterFrom}</span>
          <JalaliDatePicker
            value={draft.fromGregorian}
            onChange={(g) => updateDraft("fromGregorian", g)}
            aria-label={operationalCopy.auditFilterFrom}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-caption">{operationalCopy.auditFilterTo}</span>
          <JalaliDatePicker
            value={draft.toGregorian}
            onChange={(g) => updateDraft("toGregorian", g)}
            aria-label={operationalCopy.auditFilterTo}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2 lg:col-span-3">
          <Button type="submit" variant="primary">
            {operationalCopy.auditApplyFilters}
          </Button>
          <Button type="button" variant="secondary" onClick={clearFilters}>
            {operationalCopy.clearFilters}
          </Button>
        </div>
      </form>

      <div className="[&_[data-slot=table]]:min-w-[72rem]">
        <GovernedDataTable
          aria-label="نتایج تحقیق ممیزی"
          columns={COLUMNS}
          rows={searchQuery.isLoading || searchQuery.isError ? [] : rows}
          getRowId={(row) => row.id}
          sectionDefaultFilters={{}}
          pageSize={25}
          emptyMessage={tableEmptyMessage}
          rowActions={(row) => (
            <Button
              type="button"
              variant="rowAction"
              size="xs"
              onClick={() => {
                setDetail(row);
                setArtifactError(null);
                setCustodyAck(false);
                setRecipient("");
              }}
            >
              جزئیات
            </Button>
          )}
        />
      </div>

      {searchQuery.data?.hasMore ? (
        <p className="text-caption text-muted-foreground" role="status">
          {operationalCopy.auditTruncatedResults}
        </p>
      ) : null}

      <Dialog
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null);
            setArtifactError(null);
            setCustodyAck(false);
            setRecipient("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{operationalCopy.auditDetailTitle}</DialogTitle>
            <DialogDescription className="sr-only">
              جزئیات یک ردیف شواهد ممیزی
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <dl className="space-y-2 text-body">
              <div>
                <dt className="text-caption text-muted-foreground">زمان</dt>
                <dd className="text-tabular" dir="ltr">
                  {toPersianDigits(
                    formatJalaliDateTimeFromIso(detail.occurredAt) ||
                      detail.occurredAt,
                  )}
                  <span className="ms-2 text-caption text-muted-foreground">
                    ({detail.occurredAt})
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">بازیگر</dt>
                <dd className="text-tabular" dir="ltr">
                  {detail.actorAccountId
                    ? toPersianDigits(detail.actorAccountId)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">عملیات</dt>
                <dd dir="ltr">{detail.operation}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">موجودیت</dt>
                <dd dir="ltr">
                  {[detail.entityType, detail.entityId]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">محدوده</dt>
                <dd>{detail.scopeSummary}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">نتیجه</dt>
                <dd>{resultLabel(detail.result)}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">دلیل</dt>
                <dd>{detail.reason || "—"}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">همبستگی</dt>
                <dd className="text-tabular" dir="ltr">
                  {toPersianDigits(detail.correlationId)}
                </dd>
              </div>
              {detail.migrationRelated ? (
                <p className="text-caption text-muted-foreground" role="note">
                  {operationalCopy.auditMigrationHonestyTitle}:{" "}
                  {honestyLines[0] ??
                    "حوزه‌های اشتغال/انتصاب ممکن است unavailable باشند."}
                </p>
              ) : null}
              {detail.exportArtifactId && canOpenExportArtifact ? (
                <div className="space-y-2 rounded-md border border-border/50 p-3">
                  <p className="text-caption text-muted-foreground">
                    {operationalCopy.exportCustodyBoundary}
                  </p>
                  {getArtifactQuery.isError ? (
                    <p className="text-caption text-destructive" role="alert">
                      {operationalCopy.exportLoadError}
                    </p>
                  ) : null}
                  <label
                    className="block space-y-1 text-caption"
                    htmlFor="audit-export-recipient"
                  >
                    {operationalCopy.exportRecipientLabel}
                    <Input
                      id="audit-export-recipient"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <label className="flex items-start gap-2 text-caption">
                    <input
                      type="checkbox"
                      checked={custodyAck}
                      onChange={(e) => setCustodyAck(e.target.checked)}
                      className="mt-1"
                    />
                    <span>{operationalCopy.exportCustodyAckLabel}</span>
                  </label>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={
                      artifactBusy ||
                      getArtifactQuery.isLoading ||
                      getArtifactQuery.isError
                    }
                    onClick={() => void openExportArtifact()}
                  >
                    {operationalCopy.auditOpenExportArtifact}
                  </Button>
                </div>
              ) : null}
              {detail.actorAccountId ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={assertReview.isPending}
                  onClick={() => void openIndependentReview()}
                >
                  {operationalCopy.auditOpenReview}
                </Button>
              ) : null}
              {artifactError ? (
                <p className="text-body text-destructive" role="alert">
                  {artifactError}
                </p>
              ) : null}
            </dl>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDetail(null)}
            >
              بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
