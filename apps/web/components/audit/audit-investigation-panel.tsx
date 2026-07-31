/**
 * Audit investigation panel (Story 7.1 / FR-42 / UX-DR7 / UX-DR22).
 * Search-only surface — disposition independence via assertReviewIndependence.
 * Export artifact bytes → existing export.getArtifact / export.download only.
 */

"use client";

import * as React from "react";

import {
  EntityPicker,
  TechnicalDetailDisclosure,
  createAccountSearch,
  createOrgUnitSearch,
  createPersonSearch,
  type EntityPickerValue,
} from "@/components/entity-picker";
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
import { RowActionButton } from "@/components/ui/row-action-button";
import { Eye } from "lucide-react";
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
  actor: EntityPickerValue;
  actorTechnicalId: string;
  operation: string;
  entityType: string;
  entity: EntityPickerValue;
  entityTechnicalId: string;
  result: "" | "allow" | "deny";
  correlationId: string;
  eventClass: "" | "access" | "business";
  fromGregorian: string | undefined;
  toGregorian: string | undefined;
};

const EMPTY_DRAFT: DraftFilters = {
  actor: null,
  actorTechnicalId: "",
  operation: "",
  entityType: "",
  entity: null,
  entityTechnicalId: "",
  result: "",
  correlationId: "",
  eventClass: "",
  fromGregorian: undefined,
  toGregorian: undefined,
};

function resolveActorId(draft: DraftFilters): string {
  return draft.actor?.id?.trim() || draft.actorTechnicalId.trim() || "";
}

function resolveEntityId(draft: DraftFilters): string {
  return draft.entity?.id?.trim() || draft.entityTechnicalId.trim() || "";
}

function draftToInput(draft: DraftFilters) {
  const fromIso = draft.fromGregorian
    ? gregorianDateTimePartsToIso({ date: draft.fromGregorian, time: "00:00" })
    : null;
  const toIso = draft.toGregorian
    ? gregorianDateTimePartsToIso({ date: draft.toGregorian, time: "23:59" })
    : null;
  return {
    actorAccountId: resolveActorId(draft) || undefined,
    operation: draft.operation.trim() || undefined,
    entityType: draft.entityType.trim() || undefined,
    entityId: resolveEntityId(draft) || undefined,
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

function entityTypeImpliesPicker(entityType: string): "person" | "account" | "org" | null {
  const t = entityType.trim().toLowerCase();
  if (!t) return null;
  if (t === "پرسنل") return "person";
  const tokens = t.split(/[^a-z0-9_\u0600-\u06ff]+/).filter(Boolean);
  if (
    tokens.includes("person") ||
    tokens.includes("personnel") ||
    tokens.includes("پرسنل")
  ) {
    return "person";
  }
  if (
    tokens.includes("account") ||
    tokens.includes("user") ||
    tokens.includes("حساب")
  ) {
    return "account";
  }
  if (
    tokens.includes("org") ||
    tokens.includes("org_unit") ||
    tokens.includes("organization") ||
    tokens.includes("team") ||
    tokens.includes("unit") ||
    tokens.includes("تیم")
  ) {
    return "org";
  }
  return null;
}

function AuditActorCell({ accountId }: { accountId: string | null }) {
  const entitlements = api.accessAdmin.listEntitlements.useQuery(undefined, {
    enabled: Boolean(accountId),
    retry: false,
  });
  if (!accountId) return <>—</>;
  if (entitlements.isLoading || (entitlements.isFetching && !entitlements.data)) {
    return <span className="text-caption text-muted-foreground">…</span>;
  }
  const row = entitlements.data?.find((r) => r.accountId === accountId);
  if (row) {
    return (
      <span className="text-caption">
        <span className="text-identifier text-primary" dir="ltr">
          {row.username}
        </span>
        {" — "}
        {row.displayName}
      </span>
    );
  }
  return (
    <TechnicalDetailDisclosure
      value={accountId}
      valueLabelFa="شناسهٔ فنی بازیگر"
    />
  );
}

function AuditEntityCell({
  entityType,
  entityId,
}: {
  entityType: string | null;
  entityId: string | null;
}) {
  const kind = entityTypeImpliesPicker(entityType ?? "");
  const personQ = api.person.getById.useQuery(
    { id: entityId ?? "" },
    { enabled: kind === "person" && Boolean(entityId), retry: false },
  );
  const orgQ = api.organization.get.useQuery(
    { id: entityId ?? "" },
    { enabled: kind === "org" && Boolean(entityId), retry: false },
  );
  const entitlements = api.accessAdmin.listEntitlements.useQuery(undefined, {
    enabled: kind === "account" && Boolean(entityId),
    retry: false,
  });

  if (!entityId && !entityType) return <>—</>;

  if (kind === "person" && entityId && (personQ.isLoading || (personQ.isFetching && !personQ.data))) {
    return <span className="text-caption text-muted-foreground">…</span>;
  }
  if (kind === "org" && entityId && (orgQ.isLoading || (orgQ.isFetching && !orgQ.data))) {
    return <span className="text-caption text-muted-foreground">…</span>;
  }
  if (
    kind === "account" &&
    entityId &&
    (entitlements.isLoading || (entitlements.isFetching && !entitlements.data))
  ) {
    return <span className="text-caption text-muted-foreground">…</span>;
  }

  if (kind === "person" && personQ.data) {
    const code = personQ.data.personnelCode?.trim() || "";
    const name =
      `${personQ.data.givenName ?? ""} ${personQ.data.familyName ?? ""}`.trim() ||
      code ||
      "پرسنل";
    return (
      <span className="text-caption">
        {entityType ? `${entityType} / ` : null}
        {code ? (
          <span className="text-identifier text-primary" dir="ltr">
            {toPersianDigits(code)}
          </span>
        ) : null}
        {code ? " — " : null}
        {name}
      </span>
    );
  }
  if (kind === "org" && orgQ.data) {
    return (
      <span className="text-caption">
        {entityType ? `${entityType} / ` : null}
        {orgQ.data.code} — {orgQ.data.nameFa}
      </span>
    );
  }
  if (kind === "account" && entitlements.data) {
    const row = entitlements.data.find((r) => r.accountId === entityId);
    if (row) {
      return (
        <span className="text-caption">
          {entityType ? `${entityType} / ` : null}
          <span className="text-identifier text-primary" dir="ltr">
            {row.username}
          </span>
          {" — "}
          {row.displayName}
        </span>
      );
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-caption">
      {entityType ? <span>{entityType}</span> : null}
      {entityId ? (
        <TechnicalDetailDisclosure
          value={entityId}
          valueLabelFa="شناسهٔ فنی موجودیت"
        />
      ) : (
        "—"
      )}
    </span>
  );
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
    cell: (r) => <AuditActorCell accountId={r.actorAccountId} />,
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
    cell: (r) => (
      <AuditEntityCell entityType={r.entityType} entityId={r.entityId} />
    ),
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

  const accountSearch = React.useMemo(() => createAccountSearch(), []);
  const personSearch = React.useMemo(() => createPersonSearch(), []);
  const orgUnitSearch = React.useMemo(() => createOrgUnitSearch(), []);
  const entityPickerKind = entityTypeImpliesPicker(draft.entityType);
  const entitySearch =
    entityPickerKind === "person"
      ? personSearch
      : entityPickerKind === "account"
        ? accountSearch
        : entityPickerKind === "org"
          ? orgUnitSearch
          : null;

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
        <div className="block space-y-1.5 text-caption md:col-span-1">
          <span id="audit-filter-actor-label">
            {operationalCopy.auditFilterActor}
          </span>
          <EntityPicker
            id="audit-filter-actor"
            search={accountSearch}
            value={draft.actor}
            onValueChange={(next) => {
              setDraft((prev) => ({
                ...prev,
                actor: next,
                actorTechnicalId: next ? "" : prev.actorTechnicalId,
              }));
            }}
            scopeNoteFa="جستجو با نام کاربری یا نام نمایشی"
            placeholder="حساب…"
            aria-labelledby="audit-filter-actor-label"
          />
          <details className="rounded border border-border/50 px-2 py-1">
            <summary className="cursor-pointer text-muted-foreground">
              جستجو با شناسهٔ فنی
            </summary>
            <p className="mt-1 text-muted-foreground" id="audit-actor-tech-hint">
              مسیر پشتیبانی برای همبستگی با شناسهٔ داخلی حساب — پیش‌فرض انتخابگر است.
            </p>
            <Input
              id="audit-filter-actor-tech"
              className="mt-1"
              value={draft.actorTechnicalId}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  actorTechnicalId: e.target.value,
                  actor: e.target.value.trim() ? null : prev.actor,
                }))
              }
              dir="ltr"
              autoComplete="off"
              placeholder="UUID حساب"
              aria-describedby="audit-actor-tech-hint"
            />
          </details>
        </div>
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
            onChange={(e) => {
              setDraft((prev) => ({
                ...prev,
                entityType: e.target.value,
                entity: null,
                entityTechnicalId: "",
              }));
            }}
            dir="ltr"
            autoComplete="off"
          />
        </label>
        <div className="block space-y-1.5 text-caption">
          <span id="audit-filter-entity-label">
            {operationalCopy.auditFilterEntityId}
          </span>
          {entitySearch ? (
            <EntityPicker
              id="audit-filter-entity-id"
              search={entitySearch}
              value={draft.entity}
              onValueChange={(next) => {
                setDraft((prev) => ({
                  ...prev,
                  entity: next,
                  entityTechnicalId: next ? "" : prev.entityTechnicalId,
                }));
              }}
              scopeNoteFa="بر اساس نوع موجودیت"
              placeholder="کد یا نام…"
              aria-labelledby="audit-filter-entity-label"
            />
          ) : (
            <p className="text-muted-foreground">
              برای انتخابگر کسب‌وکار، نوع موجودیت را person / account / org وارد کنید؛
              در غیر این صورت از مسیر فنی زیر استفاده کنید.
            </p>
          )}
          <details className="rounded border border-border/50 px-2 py-1">
            <summary className="cursor-pointer text-muted-foreground">
              جستجو با شناسهٔ فنی
            </summary>
            <p className="mt-1 text-muted-foreground" id="audit-entity-tech-hint">
              مسیر پشتیبانی برای همبستگی با شناسهٔ داخلی موجودیت.
            </p>
            <Input
              id="audit-filter-entity-tech"
              className="mt-1"
              value={draft.entityTechnicalId}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  entityTechnicalId: e.target.value,
                  entity: e.target.value.trim() ? null : prev.entity,
                }))
              }
              dir="ltr"
              autoComplete="off"
              placeholder="UUID موجودیت"
              aria-describedby="audit-entity-tech-hint"
            />
          </details>
        </div>
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

      <GovernedDataTable
          aria-label="نتایج تحقیق ممیزی"
          preferencesKey="audit-investigation"
          columns={COLUMNS}
          rows={searchQuery.isLoading || searchQuery.isError ? [] : rows}
          getRowId={(row) => row.id}
          sectionDefaultFilters={{}}
          pageSize={25}
          emptyMessage={tableEmptyMessage}
          rowActions={(row) => (
            <RowActionButton
              label="جزئیات"
              icon={Eye}
              onClick={() => {
                setDetail(row);
                setArtifactError(null);
                setCustodyAck(false);
                setRecipient("");
              }}
            />
          )}
        />

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
                <dd>
                  <AuditActorCell accountId={detail.actorAccountId} />
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">عملیات</dt>
                <dd dir="ltr">{detail.operation}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">موجودیت</dt>
                <dd>
                  <AuditEntityCell
                    entityType={detail.entityType}
                    entityId={detail.entityId}
                  />
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
