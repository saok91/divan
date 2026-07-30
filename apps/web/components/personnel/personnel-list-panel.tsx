/**
 * Personnel list panel — permission-safe search via person.search (Story 5.1).
 */

"use client";

import * as React from "react";

import { ExportArtifactPanel } from "@/components/export/export-artifact-panel";
import { GovernedDataTable } from "@/components/governed-data-table";
import type { GovernedColumn } from "@/components/governed-data-table";
import { useLeaveGuardOptional } from "@/components/leave-guard";
import type { PersonnelListRow } from "@/components/personnel/personnel-list-types";
import { PersonnelQuickCreateDialog } from "@/components/personnel/personnel-quick-create-dialog";
import { PersonnelQuickEditModal } from "@/components/personnel/personnel-quick-edit-modal";
import { Button } from "@/components/ui/button";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";

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
      sortable: true,
      filter: "text",
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
      filter: "text",
      sortable: true,
    },
    {
      id: "familyName",
      header: "نام خانوادگی",
      accessor: (r) => r.familyName,
      filter: "text",
      sortable: true,
    },
    {
      id: "team",
      header: "تیم",
      accessor: (r) => r.team,
      filter: "text",
      sortable: true,
    },
    {
      id: "role",
      header: "نقش",
      accessor: (r) => r.role,
      filter: "text",
    },
    {
      id: "jobTitle",
      header: "عنوان شغلی",
      accessor: (r) => r.jobTitle,
      filter: "text",
      sortable: true,
    },
    {
      id: "ladder",
      header: "نردبان",
      accessor: (r) => r.ladder,
      filter: "text",
    },
    {
      id: "grade",
      header: "گرید",
      accessor: (r) => r.grade,
      filter: "text",
    },
    {
      id: "collaborationType",
      header: "نوع همکاری",
      accessor: (r) => r.collaborationType,
      filter: "enum",
      enumOptions: [
        { value: "کارمند", label: "کارمند" },
        { value: "پیمانکار", label: "پیمانکار" },
      ],
    },
    {
      id: "mobilePhone",
      header: "تلفن همراه",
      accessor: (r) => r.mobilePhone ?? "",
      filter: "text",
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
      filter: "text",
      permitted: hasCompensationRead,
    },
    {
      id: "contractParty",
      header: "طرف قرارداد",
      accessor: (r) => r.contractParty,
      filter: "text",
      permitted: hasCompensationRead,
    },
    {
      id: "currentColleague",
      header: "همکار فعلی",
      accessor: (r) => r.currentColleague,
      filter: "enum",
      enumOptions: [
        { value: "yes", label: "بله" },
        { value: "no", label: "خیر" },
      ],
      sortable: true,
      cell: (r) => (r.currentColleague === "yes" ? "بله" : "خیر"),
    },
  ];
}

/**
 * فهرست پرسنل — GovernedDataTable bound to person.search (FR-33 / Story 7.8).
 * Server snapshot token + page drive membership; client table shows one server page.
 */
export function PersonnelListPanel() {
  const leaveGuard = useLeaveGuardOptional();
  const utils = api.useUtils();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<PersonnelListRow | null>(null);
  const [page, setPage] = React.useState(1);
  const [evaluationSnapshotId, setEvaluationSnapshotId] = React.useState<
    string | undefined
  >(undefined);
  const snapshotTokenRef = React.useRef<string | undefined>(undefined);
  const pageSize = 25;

  const searchQuery = api.person.search.useQuery({
    channel: "list",
    page,
    pageSize,
    evaluationSnapshotId,
  });

  React.useEffect(() => {
    const token = searchQuery.data?.evaluationSnapshotId;
    if (typeof token === "string" && token.length > 0) {
      snapshotTokenRef.current = token;
      setEvaluationSnapshotId(token);
    }
  }, [searchQuery.data?.evaluationSnapshotId]);

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

  function navigateRegister(personId: string) {
    const href = `/personnel-events/register?person=${encodeURIComponent(personId)}`;
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
      return;
    }
    window.location.assign(href);
  }

  async function invalidateList() {
    setPage(1);
    snapshotTokenRef.current = undefined;
    setEvaluationSnapshotId(undefined);
    await utils.person.search.invalidate();
  }

  function goToServerPage(next: number) {
    const token =
      evaluationSnapshotId ??
      snapshotTokenRef.current ??
      searchQuery.data?.evaluationSnapshotId ??
      undefined;
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped > 1 && !token) return;
    if (token) {
      snapshotTokenRef.current = token;
      setEvaluationSnapshotId(token);
    }
    setPage(clamped);
  }

  const tableRows =
    searchQuery.isLoading || searchQuery.isError || suppressed ? [] : rows;
  // One server page of rows — disable client re-slice of the same page.
  const clientPageSize = Math.max(tableRows.length, 1);

  return (
    <section className="space-y-3" aria-labelledby="personnel-list-heading">
      <header className="sr-only">
        <h2 id="personnel-list-heading">فهرست پرسنل</h2>
      </header>

      {searchQuery.isError ? (
        <p className="text-body text-destructive" role="alert">
          {searchQuery.error.message || operationalCopy.accessDeniedTitle}
        </p>
      ) : null}

      {statusMessage ? (
        <p className="text-body text-muted-foreground" role="status">
          {statusMessage}
        </p>
      ) : null}

      {!suppressed &&
      rows.some((r) => r.disposalLimited) ? (
        <p className="text-body text-muted-foreground" role="status">
          {operationalCopy.lifecycleListDisposalLimited}
        </p>
      ) : null}

      <div className="[&_[data-slot=table]]:min-w-[72rem]">
        <GovernedDataTable
          aria-label="فهرست پرسنل"
          columns={columns}
          rows={tableRows}
          getRowId={(row) => row.id}
          sectionDefaultFilters={PERSONNEL_SECTION_DEFAULT_FILTERS}
          pageSize={clientPageSize}
          toolbar={
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="primary" onClick={openCreate}>
                افزودن سریع
              </Button>
              <p className="text-caption text-muted-foreground">
                می‌توانید با فیلتر «همکار فعلی» فقط شاغلان جاری را ببینید.
                {disclosure ? ` — ${disclosure}` : null}
                {truncated
                  ? " — فهرست به سقف حجم بازیابی محدود شده است."
                  : null}
              </p>
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
                  normalizedQuery: undefined,
                }}
              />
            ) : undefined
          }
          rowActions={(row) => (
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => openEdit(row)}
              >
                اطلاعات کامل/ویرایش
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => navigateRegister(row.id)}
              >
                ثبت رویداد
              </Button>
            </div>
          )}
        />
      </div>

      {!suppressed && totalInSnapshot != null && totalInSnapshot > pageSize ? (
        <nav
          className="flex flex-wrap items-center gap-3"
          aria-label="صفحه‌بندی فهرست پرسنل"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page <= 1 || searchQuery.isFetching}
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
            variant="ghost"
            size="sm"
            disabled={page >= totalPages || searchQuery.isFetching}
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
