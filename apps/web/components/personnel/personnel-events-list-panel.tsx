/**
 * Personnel events list — permission-safe org-wide catalogue (Story 9.6).
 * Real search bind; timeline remains listForPerson SoT.
 */

"use client";

import * as React from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { Eye, UserRound } from "lucide-react";
import { useSearchParams } from "next/navigation";

import {
  EntityPicker,
  createOrgUnitSearch,
  createPersonSearch,
  type EntityPickerValue,
} from "@/components/entity-picker";
import { GovernedDataTable } from "@/components/governed-data-table";
import type { GovernedColumn } from "@/components/governed-data-table";
import { GlossaryTerm } from "@/components/glossary/glossary-term";
import {
  JalaliDatePicker,
} from "@/components/jalali-date-picker";
import { useLeaveGuardOptional } from "@/components/leave-guard";
import {
  StatusBadge,
} from "@/components/personnel/status-badge";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { RowActionCluster } from "@/components/ui/row-action-overflow";
import { formatJalaliDisplayFromGregorian } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { EVENT_TYPE_OPTIONS } from "@/lib/personnel-event-timeline";
import { profileHref } from "@/lib/personnel-profile-href";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { isUuid } from "@/lib/is-uuid";

type EventLifecycleStatus =
  | "Draft"
  | "Scheduled"
  | "Effective"
  | "Cancelled"
  | "Reversed";

type EventListRow = {
  id: string;
  personId: string;
  personLabel: string;
  personnelCode: string | null;
  eventType: string;
  eventTypeLabelFa: string;
  effectiveDate: string;
  resolvedStatus: EventLifecycleStatus;
  source: "event" | "draft";
};

type StatusFilter = EventLifecycleStatus | "";

type AppliedFilters = {
  eventType: string;
  status: StatusFilter;
  effectiveFrom: string | undefined;
  effectiveTo: string | undefined;
  teamId: string | undefined;
  personId: string | undefined;
};

const EMPTY_FILTERS: AppliedFilters = {
  eventType: "",
  status: "",
  effectiveFrom: undefined,
  effectiveTo: undefined,
  teamId: undefined,
  personId: undefined,
};

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "Draft", label: "پیش‌نویس" },
  { value: "Scheduled", label: "زمان‌بندی‌شده" },
  { value: "Effective", label: "مؤثر" },
  { value: "Cancelled", label: "لغوشده" },
  { value: "Reversed", label: "بازگشت‌خورده" },
];

const SECTION_DEFAULTS: Record<string, string | string[]> = {};

const COLUMNS: GovernedColumn<EventListRow>[] = [
  {
    id: "personLabel",
    header: "فرد",
    accessor: (r) =>
      r.personnelCode
        ? `${r.personnelCode} ${r.personLabel}`
        : r.personLabel,
    sticky: "identifier",
    sortable: true,
    cell: (r) => (
      <span className="inline-flex flex-col gap-0.5">
        <span>{r.personLabel}</span>
        {r.personnelCode ? (
          <span className="text-caption text-muted-foreground text-tabular" dir="ltr">
            {toPersianDigits(r.personnelCode)}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: "eventType",
    header: "نوع رویداد",
    accessor: (r) => r.eventTypeLabelFa,
    sortable: true,
  },
  {
    id: "effectiveDate",
    header: "تاریخ مؤثر",
    accessor: (r) => r.effectiveDate,
    sortable: true,
    cell: (r) => (
      <span className="text-tabular">
        {toPersianDigits(formatJalaliDisplayFromGregorian(r.effectiveDate))}
      </span>
    ),
  },
  {
    id: "status",
    header: "وضعیت",
    accessor: (r) => r.resolvedStatus,
    cell: (r) => <StatusBadge status={r.resolvedStatus} />,
  },
];

function draftRegisterHref(personId: string): string {
  return `/personnel-events/register?person=${encodeURIComponent(personId)}`;
}

function firstParam(
  params: URLSearchParams,
  key: string,
): string | undefined {
  const v = params.get(key)?.trim();
  return v || undefined;
}

/**
 * فهرست رویدادهای پرسنلی — GovernedDataTable + personnelEvent.search.
 */
export function PersonnelEventsListPanel() {
  const leaveGuard = useLeaveGuardOptional();
  const searchParams = useSearchParams();
  const formId = React.useId();
  const urlHydratedKeyRef = React.useRef<string | null>(null);

  const teamsQuery = api.organization.list.useQuery({ includeInactive: false });
  const teamIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const u of teamsQuery.data ?? []) {
      if (u.unitType === "TEAM") set.add(u.id);
    }
    return set;
  }, [teamsQuery.data]);

  const personSearch = React.useMemo(() => createPersonSearch(), []);
  const baseOrgSearch = React.useMemo(() => createOrgUnitSearch(), []);
  const teamSearch = React.useMemo(
    () => async (normalizedQuery: string) => {
      const opts = await baseOrgSearch(normalizedQuery);
      if (teamIds.size === 0) return [];
      return opts.filter((o) => teamIds.has(o.id));
    },
    [baseOrgSearch, teamIds],
  );

  const [draftEventType, setDraftEventType] = React.useState("");
  const [draftStatus, setDraftStatus] = React.useState<StatusFilter>("");
  const [draftFrom, setDraftFrom] = React.useState<string | undefined>();
  const [draftTo, setDraftTo] = React.useState<string | undefined>();
  const [draftPerson, setDraftPerson] =
    React.useState<EntityPickerValue | null>(null);
  const [draftTeam, setDraftTeam] =
    React.useState<EntityPickerValue | null>(null);

  const [applied, setApplied] = React.useState<AppliedFilters>(EMPTY_FILTERS);
  const [page, setPage] = React.useState(1);
  const [evaluationSnapshotId, setEvaluationSnapshotId] = React.useState<
    string | undefined
  >(undefined);
  const snapshotTokenRef = React.useRef<string | undefined>(undefined);
  const [filterHintFa, setFilterHintFa] = React.useState<string | null>(null);
  const pageSize = 25;

  const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

  // Story 9.7 — hydrate reconcile query presets; re-run when searchParams change.
  const searchKey = searchParams.toString();
  React.useEffect(() => {
    if (urlHydratedKeyRef.current === searchKey) return;
    if (teamsQuery.isLoading) return;

    const teamId = firstParam(searchParams, "teamId");
    const eventTypeRaw = firstParam(searchParams, "eventType") ?? "";
    const effectiveFromRaw = firstParam(searchParams, "effectiveFrom");
    const effectiveToRaw = firstParam(searchParams, "effectiveTo");
    const personId = firstParam(searchParams, "person");

    const hasTeamPreset = Boolean(teamId);
    if (hasTeamPreset && teamsQuery.isError) {
      setFilterHintFa(operationalCopy.orgListError);
      return;
    }

    urlHydratedKeyRef.current = searchKey;

    const hints: string[] = [];

    let knownEventType = "";
    if (eventTypeRaw) {
      if (EVENT_TYPE_OPTIONS.some((o) => o.value === eventTypeRaw)) {
        knownEventType = eventTypeRaw;
      } else {
        hints.push("نوع رویداد در فیلتر URL ناشناخته نادیده گرفته شد.");
      }
    }

    let teamValue: EntityPickerValue | null = null;
    if (teamId) {
      if (!isUuid(teamId)) {
        hints.push("شناسه تیم در فیلتر URL معتبر نیست.");
      } else {
        const unit = (teamsQuery.data ?? []).find((u) => u.id === teamId);
        if (unit && unit.unitType === "TEAM") {
          teamValue = {
            id: unit.id,
            code: unit.code,
            labelFa: unit.nameFa,
          };
        } else {
          hints.push(
            "شناسه تیم در فیلتر URL معتبر نیست یا در محدوده نیست.",
          );
        }
      }
    }

    let effectiveFrom = effectiveFromRaw;
    let effectiveTo = effectiveToRaw;
    if (effectiveFrom && !DATE_ONLY_RE.test(effectiveFrom)) {
      hints.push("تاریخ «از» در فیلتر URL معتبر نیست.");
      effectiveFrom = undefined;
    }
    if (effectiveTo && !DATE_ONLY_RE.test(effectiveTo)) {
      hints.push("تاریخ «تا» در فیلتر URL معتبر نیست.");
      effectiveTo = undefined;
    }
    if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
      hints.push("تاریخ «از» نباید بعد از تاریخ «تا» باشد.");
      effectiveFrom = undefined;
      effectiveTo = undefined;
    }

    let personValue: EntityPickerValue | null = null;
    if (personId && isUuid(personId)) {
      personValue = { id: personId, code: "", labelFa: "فرد از پیوند" };
    }

    setFilterHintFa(hints.length > 0 ? hints.join(" ") : null);
    setDraftEventType(knownEventType);
    setDraftFrom(effectiveFrom);
    setDraftTo(effectiveTo);
    setDraftTeam(teamValue);
    setDraftPerson(personValue);
    setApplied({
      eventType: knownEventType,
      status: "",
      effectiveFrom,
      effectiveTo,
      teamId: teamValue?.id,
      personId: personValue?.id,
    });
    setPage(1);
    snapshotTokenRef.current = undefined;
    setEvaluationSnapshotId(undefined);
  }, [
    searchKey,
    searchParams,
    teamsQuery.data,
    teamsQuery.isLoading,
    teamsQuery.isError,
  ]);

  const searchQuery = api.personnelEvent.search.useQuery(
    {
      page,
      pageSize,
      evaluationSnapshotId,
      eventTypes: applied.eventType ? [applied.eventType] : undefined,
      statuses: applied.status ? [applied.status] : undefined,
      effectiveFrom: applied.effectiveFrom,
      effectiveTo: applied.effectiveTo,
      teamId: applied.teamId,
      personId: applied.personId,
    },
    { placeholderData: keepPreviousData },
  );

  React.useEffect(() => {
    if (searchQuery.isPlaceholderData) return;
    const token = searchQuery.data?.evaluationSnapshotId;
    if (typeof token === "string" && token.length > 0) {
      snapshotTokenRef.current = token;
      setEvaluationSnapshotId(token);
    }
  }, [searchQuery.data?.evaluationSnapshotId, searchQuery.isPlaceholderData]);

  const rows = React.useMemo((): EventListRow[] => {
    return (searchQuery.data?.rows ?? []).map((r) => ({
      id: r.id,
      personId: r.personId,
      personLabel: r.personLabel,
      personnelCode: r.personnelCode,
      eventType: r.eventType,
      eventTypeLabelFa: r.eventTypeLabelFa,
      effectiveDate: r.effectiveDate,
      resolvedStatus: r.resolvedStatus as EventLifecycleStatus,
      source: r.source,
    }));
  }, [searchQuery.data?.rows]);

  const disclosure = searchQuery.data?.populationDisclosureFa;
  const truncated = searchQuery.data?.truncated === true;
  const populationFailClosed =
    searchQuery.data?.populationAuthzMode === "fixture-fail-closed";
  const suppressed =
    searchQuery.data?.outcome === "suppressed" ||
    searchQuery.data?.outcome === "denied";
  const emptyAllowed =
    searchQuery.data?.outcome === "empty" ||
    (searchQuery.data?.outcome === "allowed" && rows.length === 0);

  const totalInSnapshot = searchQuery.data?.totalInSnapshot ?? null;
  const totalPages =
    totalInSnapshot != null && totalInSnapshot > 0
      ? Math.max(1, Math.ceil(totalInSnapshot / pageSize))
      : 1;

  function navigate(href: string) {
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
      return;
    }
    window.location.assign(href);
  }

  function goRegister() {
    navigate("/personnel-events/register");
  }

  function openEvent(row: EventListRow) {
    if (row.source === "draft") {
      navigate(draftRegisterHref(row.personId));
      return;
    }
    navigate(profileHref(row.personId, { eventId: row.id }));
  }

  function openPerson(row: EventListRow) {
    navigate(profileHref(row.personId));
  }

  function resetSnapshotAndPage() {
    setPage(1);
    snapshotTokenRef.current = undefined;
    setEvaluationSnapshotId(undefined);
  }

  function applyFilters() {
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setFilterHintFa("تاریخ «از» نباید بعد از تاریخ «تا» باشد.");
      return;
    }
    setFilterHintFa(null);
    setApplied({
      eventType: draftEventType,
      status: draftStatus,
      effectiveFrom: draftFrom,
      effectiveTo: draftTo,
      teamId: draftTeam?.id,
      personId: draftPerson?.id,
    });
    resetSnapshotAndPage();
  }

  function clearFilters() {
    setFilterHintFa(null);
    setDraftEventType("");
    setDraftStatus("");
    setDraftFrom(undefined);
    setDraftTo(undefined);
    setDraftPerson(null);
    setDraftTeam(null);
    setApplied(EMPTY_FILTERS);
    resetSnapshotAndPage();
  }

  function goToServerPage(next: number) {
    const token =
      evaluationSnapshotId ??
      snapshotTokenRef.current ??
      (!searchQuery.isPlaceholderData
        ? searchQuery.data?.evaluationSnapshotId
        : undefined) ??
      undefined;
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped > 1 && !token) {
      setFilterHintFa("اسنپ‌شات صفحه هنوز آماده نیست؛ کمی صبر کنید.");
      return;
    }
    setFilterHintFa(null);
    if (token) {
      snapshotTokenRef.current = token;
      setEvaluationSnapshotId(token);
    }
    setPage(clamped);
  }

  const snapshotReady = Boolean(
    evaluationSnapshotId ??
      snapshotTokenRef.current ??
      (!searchQuery.isPlaceholderData &&
        searchQuery.data?.evaluationSnapshotId),
  );
  const teamsLoading = teamsQuery.isLoading;
  const teamsErrored = teamsQuery.isError;

  const tableRows = searchQuery.isError || suppressed ? [] : rows;
  const clientPageSize = Math.max(tableRows.length, 1);
  const coldLoading =
    searchQuery.isLoading &&
    !searchQuery.data &&
    !searchQuery.isError &&
    !suppressed;

  const selectClass = cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3",
    "text-body text-foreground",
  );

  return (
    <section
      className="space-y-3"
      aria-labelledby="personnel-events-list-heading"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 id="personnel-events-list-heading" className="sr-only">
          رویدادها
        </h2>
        <GlossaryTerm termKey="personnelEvent" />
        <GlossaryTerm termKey="draft" />
        <GlossaryTerm termKey="finalize" />
      </header>

      <div
        className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
        role="search"
        aria-label="فیلتر فهرست رویدادها"
      >
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <label htmlFor={`${formId}-type`} className="text-label">
            نوع رویداد
          </label>
          <select
            id={`${formId}-type`}
            value={draftEventType}
            onChange={(e) => setDraftEventType(e.target.value)}
            className={selectClass}
          >
            <option value="">همه انواع</option>
            {EVENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.labelFa}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[10rem] space-y-1.5">
          <label htmlFor={`${formId}-status`} className="text-label">
            وضعیت
          </label>
          <select
            id={`${formId}-status`}
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value as StatusFilter)}
            className={selectClass}
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[12rem] space-y-1.5">
          <label htmlFor={`${formId}-from`} className="text-label">
            از تاریخ مؤثر
          </label>
          <JalaliDatePicker
            id={`${formId}-from`}
            aria-label="از تاریخ مؤثر"
            value={draftFrom}
            onChange={setDraftFrom}
          />
        </div>

        <div className="min-w-[12rem] space-y-1.5">
          <label htmlFor={`${formId}-to`} className="text-label">
            تا تاریخ مؤثر
          </label>
          <JalaliDatePicker
            id={`${formId}-to`}
            aria-label="تا تاریخ مؤثر"
            value={draftTo}
            onChange={setDraftTo}
          />
        </div>

        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <span className="text-label" id={`${formId}-person-label`}>
            فرد
          </span>
          <EntityPicker
            aria-labelledby={`${formId}-person-label`}
            value={draftPerson}
            onValueChange={setDraftPerson}
            search={personSearch}
            placeholder="جستجوی فرد…"
          />
        </div>

        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <span className="text-label" id={`${formId}-team-label`}>
            تیم
          </span>
          <EntityPicker
            aria-labelledby={`${formId}-team-label`}
            value={draftTeam}
            onValueChange={setDraftTeam}
            search={teamSearch}
            placeholder={
              teamsLoading
                ? "در حال بارگذاری تیم‌ها…"
                : teamsErrored
                  ? "بارگذاری تیم‌ها ناموفق"
                  : "جستجوی تیم…"
            }
            scopeNoteFa="فقط واحدهای نوع تیم"
            disabled={teamsLoading || teamsErrored}
            disabledReasonFa={
              teamsLoading
                ? "فهرست تیم‌ها در حال بارگذاری است."
                : teamsErrored
                  ? "فهرست تیم‌ها بارگذاری نشد؛ فیلتر تیم موقتاً غیرفعال است."
                  : undefined
            }
          />
          <p className="text-caption text-muted-foreground">
            فیلتر تیم بر اساس عضویت اصلی فرد در تاریخ امروز است، نه فقط
            فیلد تیم داخل محتوای رویداد.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={applyFilters}>
            اعمال فیلتر
          </Button>
          <Button type="button" variant="tertiary" onClick={clearFilters}>
            پاک کردن
          </Button>
        </div>
      </div>

      {filterHintFa ? (
        <FeedbackMessage kind="info">{filterHintFa}</FeedbackMessage>
      ) : null}

      {coldLoading ? (
        <FeedbackMessage kind="loading">در حال بارگذاری فهرست رویدادها…</FeedbackMessage>
      ) : null}

      {searchQuery.isError ? (
        <FeedbackMessage kind="error">
          {searchQuery.error.message || operationalCopy.accessDeniedTitle}
        </FeedbackMessage>
      ) : null}

      {suppressed ? (
        <FeedbackMessage kind="error">
          {searchQuery.data?.messageFa || operationalCopy.suppressedCohort}
        </FeedbackMessage>
      ) : null}

      {!suppressed && populationFailClosed && disclosure ? (
        <FeedbackMessage kind="info">{disclosure}</FeedbackMessage>
      ) : null}

      {!suppressed && truncated ? (
        <FeedbackMessage kind="info">
          فهرست به سقف حجم بازیابی محدود شده است.
        </FeedbackMessage>
      ) : null}

      {!suppressed &&
      !searchQuery.isError &&
      !coldLoading &&
      emptyAllowed ? (
        <FeedbackMessage kind="empty">
          {searchQuery.data?.messageFa ||
            "رویداد پرسنلی در محدوده دسترسی شما یافت نشد. می‌توانید یک رویداد ایجاد کنید."}
        </FeedbackMessage>
      ) : null}

      <GovernedDataTable
        aria-label="فهرست رویدادهای پرسنلی"
        preferencesKey="personnel-events-list"
        columns={COLUMNS}
        rows={tableRows}
        loading={coldLoading}
        getRowId={(r) => `${r.source}:${r.id}`}
        sectionDefaultFilters={SECTION_DEFAULTS}
        pageSize={clientPageSize}
        emptyMessage="رویداد پرسنلی ثبت نشده. می‌توانید یک رویداد ایجاد کنید."
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="primary" onClick={goRegister}>
              ثبت رویداد
            </Button>
          </div>
        }
        rowActions={(row) => (
          <RowActionCluster
            actions={[
              {
                id: "open-event",
                label: "باز کردن رویداد",
                icon: Eye,
                onSelect: () => openEvent(row),
              },
              {
                id: "open-person",
                label: "باز کردن فرد",
                icon: UserRound,
                onSelect: () => openPerson(row),
              },
            ]}
          />
        )}
        onRowClick={(row) => openEvent(row)}
      />

      {!suppressed && totalInSnapshot != null && totalInSnapshot > pageSize ? (
        <nav
          className="flex flex-wrap items-center gap-3"
          aria-label="صفحه‌بندی فهرست رویدادها"
        >
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            disabled={page <= 1 || searchQuery.isFetching}
            disabledReason={
              page <= 1
                ? "شما در اولین صفحه هستید."
                : searchQuery.isFetching
                  ? "در حال بارگذاری صفحه…"
                  : undefined
            }
            onClick={() => goToServerPage(page - 1)}
          >
            صفحه قبل
          </Button>
          <p className="text-caption text-muted-foreground" role="status">
            صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
            {" — "}
            {toPersianDigits(totalInSnapshot)} ردیف در اسنپ‌شات
          </p>
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            disabled={
              page >= totalPages ||
              searchQuery.isFetching ||
              (page < totalPages && !snapshotReady)
            }
            disabledReason={
              page >= totalPages
                ? "شما در آخرین صفحه هستید."
                : searchQuery.isFetching
                  ? "در حال بارگذاری صفحه…"
                  : !snapshotReady
                    ? "اسنپ‌شات صفحه هنوز آماده نیست."
                    : undefined
            }
            onClick={() => goToServerPage(page + 1)}
          >
            صفحه بعد
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
