/**
 * Personnel list panel — permission-safe search via person.search (Story 5.1).
 */

"use client";

import { collaborationTypeLabel } from "@/lib/collaboration-type";
import * as React from "react";
import { useSearchParams } from "next/navigation";

import {
  EntityPicker,
  createOrgUnitSearch,
  type EntityPickerValue,
} from "@/components/entity-picker";
import { ExportArtifactPanel } from "@/components/export/export-artifact-panel";
import { GovernedDataTable } from "@/components/governed-data-table";
import type { GovernedColumn } from "@/components/governed-data-table";
import { useLeaveGuardOptional } from "@/components/leave-guard";
import type { PersonnelListRow } from "@/components/personnel/personnel-list-types";
import { PersonnelQuickCreateDialog } from "@/components/personnel/personnel-quick-create-dialog";
import { PersonnelQuickEditModal } from "@/components/personnel/personnel-quick-edit-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { RowActionCluster } from "@/components/ui/row-action-overflow";
import { CalendarPlus, Pencil } from "lucide-react";
import { operationalCopy } from "@/lib/operational-copy";
import { profileHref } from "@/lib/personnel-profile-href";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { isUuid } from "@/lib/is-uuid";

export type { PersonnelListRow } from "@/components/personnel/personnel-list-types";

export const PERSONNEL_SECTION_DEFAULT_FILTERS: Record<
  string,
  string | string[]
> = {
  // No default currentColleague filter — imported/migrated people often have no
  // active Employment yet (`currentColleague: no`) and would render an empty table.
};

function buildColumns(
  hasCompensationRead: boolean,
): GovernedColumn<PersonnelListRow>[] {
  return [
    {
      id: "personnelCode",
      header: "کد پرسنلی",
      accessor: (r) => r.personnelCode,
      sticky: "identifier",
      cell: (r) => (
        <span className="text-tabular" dir="ltr">
          {toPersianDigits(r.personnelCode)}
        </span>
      ),
    },
    {
      id: "givenName",
      header: "نام",
      accessor: (r) => r.givenName,
    },
    {
      id: "familyName",
      header: "نام خانوادگی",
      accessor: (r) => r.familyName,
    },
    {
      id: "team",
      header: "تیم",
      accessor: (r) => r.team,
      cellOverflow: "wrap",
      maxWidthClass: "max-w-[14rem]",
    },
    {
      id: "role",
      header: "نقش",
      accessor: (r) => r.role,
    },
    {
      id: "jobTitle",
      header: "عنوان شغلی",
      accessor: (r) => r.jobTitle,
      cellOverflow: "wrap",
      maxWidthClass: "max-w-[14rem]",
    },
    {
      id: "ladder",
      header: "نردبان",
      accessor: (r) => r.ladder,
    },
    {
      id: "grade",
      header: "گرید",
      accessor: (r) => r.grade,
    },
    {
      id: "collaborationType",
      header: "نوع همکاری",
      accessor: (r) => r.collaborationType,
      cell: (r) => collaborationTypeLabel(r.collaborationType),
    },
    {
      id: "mobilePhone",
      header: "تلفن همراه",
      accessor: (r) => r.mobilePhone ?? "",
      cell: (r) =>
        r.mobilePhone ? (
          <span className="text-tabular" dir="ltr">
            {toPersianDigits(r.mobilePhone)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "compensation",
      header: "جبران خدمت",
      accessor: (r) => r.compensation,
      permitted: hasCompensationRead,
    },
    {
      id: "contractEndDate",
      header: "تاریخ پایان قرارداد",
      accessor: (r) => r.contractEndDate,
      permitted: hasCompensationRead,
    },
    {
      id: "contractParty",
      header: "طرف قرارداد",
      accessor: (r) => r.contractParty,
      permitted: hasCompensationRead,
    },
    {
      id: "currentColleague",
      header: "همکار فعلی",
      accessor: (r) => r.currentColleague,
      cell: (r) => (r.currentColleague === "yes" ? "بله" : "خیر"),
    },
  ];
}

/**
 * فهرست پرسنل — GovernedDataTable bound to person.search (FR-33 / Story 7.8).
 * Server snapshot token + page drive membership; client table shows one server page.
 */
export function PersonnelListPanel() {
  const params = useSearchParams();
  return <PersonnelListContent key={params.toString()} />;
}

function PersonnelListContent() {
  const leaveGuard = useLeaveGuardOptional();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const formId = React.useId();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<PersonnelListRow | null>(null);
  const [page, setPage] = React.useState(1);
  const [evaluationSnapshotId, setEvaluationSnapshotId] = React.useState<
    string | undefined
  >(undefined);
  const rawTeamId = searchParams.get("teamId")?.trim() || undefined;
  const appliedTeamId = rawTeamId && isUuid(rawTeamId) ? rawTeamId : undefined;
  const normalizedQuery = searchParams.get("q")?.trim() || undefined;
  const [queryDraft, setQueryDraft] = React.useState(normalizedQuery ?? "");
  const pageSize = 25;

  const teamsQuery = api.organization.list.useQuery({ includeInactive: false }, { retry: false });
  const teamReadDenied = teamsQuery.error?.data?.code === "FORBIDDEN";
  const teamIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const u of teamsQuery.data ?? []) {
      if (u.unitType === "TEAM") set.add(u.id);
    }
    return set;
  }, [teamsQuery.data]);
  const baseOrgSearch = React.useMemo(() => createOrgUnitSearch(), []);
  const teamSearch = React.useMemo(
    () => async (normalizedQuery: string) => {
      const opts = await baseOrgSearch(normalizedQuery);
      if (teamIds.size === 0) return [];
      return opts.filter((o) => teamIds.has(o.id));
    },
    [baseOrgSearch, teamIds],
  );

  const unit = teamsQuery.data?.find((u) => u.id === appliedTeamId && u.unitType === "TEAM");
  const teamFilter: EntityPickerValue | null = unit
    ? { id: unit.id, code: unit.code, labelFa: unit.nameFa }
    : appliedTeamId ? { id: appliedTeamId, code: "", labelFa: "تیم انتخاب‌شده" } : null;
  const filterHintFa = rawTeamId && !appliedTeamId
    ? "شناسه تیم در نشانی معتبر نیست؛ فیلتر را پاک کنید."
    : teamsQuery.isError && !teamReadDenied ? operationalCopy.orgListError : null;
  function updateFilters(query: string, teamId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) params.set("q", query.trim()); else params.delete("q");
    if (teamId) params.set("teamId", teamId); else params.delete("teamId");
    const queryString = params.toString();
    navigate(`/personnel/list${queryString ? `?${queryString}` : ""}`);
  }

  const searchQuery = api.person.search.useQuery(
    {
      channel: "list",
      page,
      pageSize,
      evaluationSnapshotId,
      teamId: appliedTeamId,
      normalizedQuery,
    },
    { enabled: !rawTeamId || Boolean(appliedTeamId) },
  );

  const rows = React.useMemo((): PersonnelListRow[] => {
    return (searchQuery.data?.rows ?? []).map((r) => ({
      id: r.id,
      personnelCode: r.personnelCode,
      givenName: r.givenName,
      familyName: r.familyName,
      team: r.team,
      role: r.role,
      jobTitle: r.jobTitle,
      ladder: r.ladder,
      grade: r.grade,
      collaborationType: r.collaborationType,
      compensation: r.compensation,
      contractEndDate: r.contractEndDate,
      contractParty: r.contractParty,
      currentColleague: r.currentColleague,
      mobilePhone: r.mobilePhone,
      disposalLimited: r.disposalLimited,
      disposalMessageFa: r.disposalMessageFa,
    }));
  }, [searchQuery.data?.rows]);

  const hasCompensationRead = searchQuery.data?.hasCompensationRead === true;
  const columns = React.useMemo(
    () => buildColumns(hasCompensationRead),
    [hasCompensationRead],
  );

  const disclosure = searchQuery.data?.populationDisclosureFa;
  const truncated = searchQuery.data?.truncated === true;
  const populationFailClosed =
    searchQuery.data?.populationAuthzMode === "fixture-fail-closed";
  const suppressed =
    searchQuery.data?.outcome === "suppressed" ||
    searchQuery.data?.outcome === "denied";
  const statusMessage = suppressed
    ? searchQuery.data?.messageFa || operationalCopy.suppressedCohort
    : populationFailClosed
      ? disclosure || operationalCopy.personnelPopulationFixtureEmpty
      : searchQuery.data?.outcome === "empty" && disclosure
        ? disclosure
        : null;

  const totalInSnapshot = searchQuery.data?.totalInSnapshot ?? null;
  const totalPages =
    totalInSnapshot != null && totalInSnapshot > 0
      ? Math.max(1, Math.ceil(totalInSnapshot / pageSize))
      : 1;

  function openCreate() {
    setEditRow(null);
    setCreateOpen(true);
  }

  function openEdit(row: PersonnelListRow) {
    setCreateOpen(false);
    setEditRow(row);
  }

  function navigate(href: string) {
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
      return;
    }
    window.location.assign(href);
  }

  function navigateProfile(personId: string) {
    navigate(profileHref(personId));
  }

  function navigateRegister(personId: string) {
    navigate(
      `/personnel-events/register?person=${encodeURIComponent(personId)}`,
    );
  }

  async function invalidateList() {
    setPage(1);
    setEvaluationSnapshotId(undefined);
    await utils.person.search.invalidate();
  }

  function applyTeamFilter(next: EntityPickerValue | null) {
    updateFilters(normalizedQuery ?? "", next?.id);
  }

  function goToServerPage(next: number) {
    const token =
      evaluationSnapshotId ??
      searchQuery.data?.evaluationSnapshotId ??
      undefined;
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped > 1 && !token) return;
    if (token) {
      setEvaluationSnapshotId(token);
    }
    setPage(clamped);
  }

  const tableRows =
    searchQuery.isError || suppressed ? [] : rows;
  // One server page of rows — disable client re-slice of the same page.
  const clientPageSize = Math.max(tableRows.length, 1);
  const coldLoading =
    searchQuery.isLoading &&
    !searchQuery.data &&
    !searchQuery.isError &&
    !suppressed;

  return (
    <section className="space-y-3" aria-labelledby="personnel-list-heading">
      <header className="sr-only">
        <h2 id="personnel-list-heading">فهرست پرسنل</h2>
      </header>

      {searchQuery.isError ? (
        <div className="flex flex-wrap items-center gap-3">
          <FeedbackMessage kind="error">{searchQuery.error.message || "بارگذاری فهرست ممکن نشد."}</FeedbackMessage>
          <Button variant="tertiary" size="sm" onClick={() => { void invalidateList(); }}>تلاش دوباره</Button>
        </div>
      ) : null}

      {statusMessage ? (
        <FeedbackMessage kind={suppressed ? "error" : "info"}>
          {statusMessage}
        </FeedbackMessage>
      ) : null}

      {!suppressed && rows.some((r) => r.disposalLimited) ? (
        <FeedbackMessage kind="info">
          {operationalCopy.lifecycleListDisposalLimited}
        </FeedbackMessage>
      ) : null}

      {filterHintFa ? (
        <FeedbackMessage kind="info">{filterHintFa}</FeedbackMessage>
      ) : null}

      <div
        className="flex flex-wrap items-end gap-3"
        role="search"
        aria-label="فیلتر فهرست پرسنل"
      >
        <form className="flex flex-1 items-end gap-2" onSubmit={(event) => {
          event.preventDefault(); updateFilters(queryDraft, appliedTeamId);
        }}>
          <div className="flex-1 space-y-1.5">
            <label className="text-label" htmlFor={`${formId}-query`}>جست‌وجوی پرسنل</label>
            <Input id={`${formId}-query`} value={queryDraft} maxLength={200}
              placeholder="نام، نام خانوادگی یا کد پرسنلی" onChange={(event) => setQueryDraft(event.target.value)} />
          </div>
          <Button type="submit" variant="tertiary">جست‌وجو</Button>
          {normalizedQuery ? <Button type="button" variant="tertiary" onClick={() => updateFilters("", appliedTeamId)}>پاک کردن جست‌وجو</Button> : null}
        </form>
        {!teamReadDenied ? <div className="min-w-[14rem] flex-1 space-y-1.5">
          <span className="text-label" id={`${formId}-team-label`}>
            تیم
          </span>
          <EntityPicker
            aria-labelledby={`${formId}-team-label`}
            value={teamFilter}
            onValueChange={applyTeamFilter}
            search={teamSearch}
            placeholder="همه تیم‌ها"
            disabled={teamsQuery.isLoading}
            disabledReasonFa={
              teamsQuery.isLoading ? operationalCopy.actionPending : undefined
            }
          />
        </div> : null}
        {rawTeamId ? (
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            onClick={() => applyTeamFilter(null)}
          >
            پاک کردن فیلتر تیم
          </Button>
        ) : null}
      </div>

      <GovernedDataTable
          aria-label="فهرست پرسنل"
          preferencesKey="personnel-list"
          columns={columns}
          rows={tableRows}
          loading={coldLoading}
          getRowId={(row) => row.id}
          sectionDefaultFilters={PERSONNEL_SECTION_DEFAULT_FILTERS}
          pageSize={clientPageSize}
          toolbar={
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="primary" onClick={openCreate}>
                افزودن سریع
              </Button>
              <p className="text-caption text-muted-foreground">
                {teamReadDenied ? "جست‌وجو پیش از صفحه‌بندی اعمال می‌شود. ترتیب: کد پرسنلی." : "جست‌وجو و فیلتر تیم پیش از صفحه‌بندی اعمال می‌شوند. ترتیب: کد پرسنلی."}
                {truncated
                  ? " — دامنهٔ جست‌وجو به سقف بازیابی محدود است و ممکن است فرد موردنظر در آن نباشد. خروجی کامل تا بررسی سقف بازیابی و تنظیم محدوده توسط مدیر سامانه در دسترس نیست."
                  : null}
              </p>
              {disclosure ? <details className="max-w-full text-caption text-muted-foreground">
                <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-ring">محیط آزمایشی — اطلاعات محدودهٔ داده‌ها</summary>
                <p className="mt-2 max-w-prose break-words">{disclosure}</p>
              </details> : null}
            </div>
          }
          exportSlot={
            searchQuery.data?.hasExportPermission &&
            searchQuery.data.exportSnapshotHash &&
            !truncated ? (
              <ExportArtifactPanel
                source={{
                  kind: "personnel_list",
                  reviewedSnapshotHash: searchQuery.data.exportSnapshotHash,
                  // Server-side search query when wired; client table filters are not SoT.
                  normalizedQuery,
                  teamId: appliedTeamId,
                }}
              />
            ) : undefined
          }
          rowActions={(row) => (
            <RowActionCluster
              actions={[
                {
                  id: "edit",
                  label: "اطلاعات کامل/ویرایش",
                  icon: Pencil,
                  onSelect: () => openEdit(row),
                },
                {
                  id: "register",
                  label: "ثبت رویداد",
                  icon: CalendarPlus,
                  onSelect: () => navigateRegister(row.id),
                },
              ]}
            />
          )}
          onRowClick={(row) => navigateProfile(row.id)}
          rowActivateLabel="باز کردن پروفایل کامل"
        />

      {!suppressed && totalInSnapshot != null && totalInSnapshot > pageSize ? (
        <nav
          className="flex flex-wrap items-center gap-3"
          aria-label="صفحه‌بندی فهرست پرسنل"
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
            disabled={page >= totalPages || searchQuery.isFetching}
            disabledReason={
              page >= totalPages
                ? "شما در آخرین صفحه هستید."
                : searchQuery.isFetching
                  ? "در حال بارگذاری صفحه…"
                  : undefined
            }
            onClick={() => goToServerPage(page + 1)}
          >
            صفحه بعد
          </Button>
        </nav>
      ) : null}

      <PersonnelQuickCreateDialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false);
        }}
        onCreated={() => {
          void invalidateList();
          setCreateOpen(false);
        }}
      />

      {editRow ? (
        <PersonnelQuickEditModal
          key={editRow.id}
          open
          row={editRow}
          onOpenChange={(open) => {
            if (!open) setEditRow(null);
          }}
          onSaved={() => {
            void invalidateList();
            setEditRow(null);
          }}
        />
      ) : null}
    </section>
  );
}
