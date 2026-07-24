"use client";

import * as React from "react";

import { GovernedDataTable } from "@/components/governed-data-table";
import type { GovernedColumn } from "@/components/governed-data-table";
import { useLeaveGuardOptional } from "@/components/leave-guard";
import type { PersonnelListRow } from "@/components/personnel/personnel-list-types";
import { PersonnelQuickCreateDialog } from "@/components/personnel/personnel-quick-create-dialog";
import { PersonnelQuickEditModal } from "@/components/personnel/personnel-quick-edit-modal";
import { Button } from "@/components/ui/button";
import { toPersianDigits } from "@/lib/persian-digits";

export type { PersonnelListRow } from "@/components/personnel/personnel-list-types";

/** Scaffold fixture rows — FR33 / PopulationPort = Story 5.1. */
export const PERSONNEL_LIST_FIXTURES: PersonnelListRow[] = Array.from(
  { length: 28 },
  (_, i) => {
    const n = i + 1;
    const pad = String(n).padStart(3, "0");
    const names = [
      ["علی", "محمدی"],
      ["سارا", "احمدی"],
      ["مینا", "رضایی"],
      ["رضا", "کریمی"],
      ["نگار", "حسینی"],
      ["حسین", "نوری"],
    ] as const;
    const [givenName, familyName] = names[i % 6]!;
    const teams = ["فنی", "عملیات", "منابع انسانی"] as const;
    return {
      id: `fixture-${pad}`,
      personnelCode: `P-${pad}`,
      givenName,
      familyName,
      team: teams[i % 3]!,
      role: i % 2 === 0 ? "کارشناس" : "سرپرست",
      ladder: i % 3 === 0 ? "فنی" : "عمومی",
      grade: `G${(i % 5) + 1}`,
      collaborationType: i % 4 === 0 ? "پیمانکار" : "کارمند",
      compensation: `${(n * 10_000_000).toLocaleString("en-US")}`,
      contractEndDate: i % 5 === 0 ? "۱۴۰۵/۱۲/۲۹" : "—",
      contractParty: i % 5 === 0 ? "شرکت نمونه" : "—",
      currentColleague: i % 3 === 0 ? "no" : "yes",
      mobilePhone: `0912${String(1000000 + n).slice(0, 7)}`,
    };
  },
);

export const PERSONNEL_SECTION_DEFAULT_FILTERS: Record<
  string,
  string | string[]
> = {
  currentColleague: ["yes"],
};

const COLUMNS: GovernedColumn<PersonnelListRow>[] = [
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
    id: "compensation",
    header: "جبران خدمت",
    accessor: (r) => r.compensation,
    permitted: false,
  },
  {
    id: "contractEndDate",
    header: "تاریخ پایان قرارداد",
    accessor: (r) => r.contractEndDate,
    filter: "text",
  },
  {
    id: "contractParty",
    header: "طرف قرارداد",
    accessor: (r) => r.contractParty,
    filter: "text",
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

/**
 * فهرست پرسنل scaffold — GovernedDataTable + quick-create / quick-edit (Story 4b.7).
 * Fixture data until FR33 wiring in 5.1.
 */
export function PersonnelListPanel() {
  const leaveGuard = useLeaveGuardOptional();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<PersonnelListRow | null>(null);
  const [rows, setRows] = React.useState(PERSONNEL_LIST_FIXTURES);

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

  return (
    <section className="space-y-3" aria-labelledby="personnel-list-heading">
      <header className="sr-only">
        <h2 id="personnel-list-heading">فهرست پرسنل</h2>
      </header>

      <div className="[&_[data-slot=table]]:min-w-[72rem]">
        <GovernedDataTable
          aria-label="فهرست پرسنل"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          sectionDefaultFilters={PERSONNEL_SECTION_DEFAULT_FILTERS}
          pageSize={25}
          toolbar={
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="primary" onClick={openCreate}>
                افزودن سریع
              </Button>
              <p className="text-caption text-muted-foreground">
                فیلتر پیش‌فرض: همکار فعلی = بله (اسکفولد تا داستان ۵.۱)
              </p>
            </div>
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

      <PersonnelQuickCreateDialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false);
        }}
        onCreated={(person) => {
          setRows((prev) => [
            {
              id: person.id,
              personnelCode: person.personnelCode,
              givenName: person.givenName,
              familyName: person.familyName,
              team: "—",
              role: "—",
              ladder: "—",
              grade: "—",
              collaborationType: "کارمند",
              compensation: "",
              contractEndDate: "—",
              contractParty: "—",
              currentColleague: "yes",
              mobilePhone: person.mobilePhone,
            },
            ...prev,
          ]);
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
          onSaved={(person) => {
            setRows((prev) =>
              prev.map((r) =>
                r.id === person.id
                  ? {
                      ...r,
                      givenName: person.givenName,
                      familyName: person.familyName,
                      mobilePhone: person.mobilePhone,
                    }
                  : r,
              ),
            );
            setEditRow(null);
          }}
        />
      ) : null}
    </section>
  );
}
