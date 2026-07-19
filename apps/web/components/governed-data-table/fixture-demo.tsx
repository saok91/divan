"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

import { GovernedDataTable } from "./governed-data-table";
import type { GovernedColumn } from "./types";

export type FixturePerson = {
  id: string;
  identifier: string;
  name: string;
  team: string;
  status: string;
  compensation: string;
};

/** >25 rows so pagination spans multiple pages at default pageSize 25. */
export const FIXTURE_PERSONS: FixturePerson[] = Array.from(
  { length: 32 },
  (_, i) => {
    const n = i + 1;
    const pad = String(n).padStart(3, "0");
    const teams = ["eng", "ops", "hr"] as const;
    const statuses = ["active", "inactive"] as const;
    return {
      id: `fixture-${pad}`,
      identifier: `P-${pad}`,
      name: [
        "علی محمدی",
        "سارا احمدی",
        "مینا رضایی",
        "رضا کریمی",
        "نگار حسینی",
        "حسین نوری",
      ][i % 6]!,
      team: teams[i % 3]!,
      status: statuses[i % 2]!,
      compensation: `${(n * 10_000_000).toLocaleString("en-US")}`,
    };
  },
);

export const FIXTURE_COLUMNS: GovernedColumn<FixturePerson>[] = [
  {
    id: "identifier",
    header: "شناسه",
    accessor: (r) => r.identifier,
    sticky: "identifier",
    sortable: true,
    filter: "text",
  },
  {
    id: "name",
    header: "نام",
    accessor: (r) => r.name,
    filter: "text",
    sortable: true,
  },
  {
    id: "team",
    header: "تیم",
    accessor: (r) => r.team,
    filter: "enum",
    enumOptions: [
      { value: "eng", label: "فنی" },
      { value: "ops", label: "عملیات" },
      { value: "hr", label: "منابع انسانی" },
    ],
    sortable: true,
  },
  {
    id: "status",
    header: "وضعیت",
    accessor: (r) => r.status,
    filter: "enum",
    enumOptions: [
      { value: "active", label: "فعال" },
      { value: "inactive", label: "غیرفعال" },
    ],
    sortable: true,
  },
  {
    id: "compensation",
    header: "جبران خدمت",
    accessor: (r) => r.compensation,
    permitted: false,
  },
];

/** Non-empty section default so clear ≠ wipe (status = active). */
export const FIXTURE_SECTION_DEFAULTS: Record<string, string | string[]> = {
  status: ["active"],
};

/**
 * Fixture host proving governed-data-table contract (Story 4b.4).
 * Not wired to person.list / FR33 — that is Story 5.1.
 */
export function GovernedDataTableFixtureDemo() {
  return (
    <section
      className="space-y-3 border-t border-border pt-8"
      aria-labelledby="governed-table-demo-heading"
    >
      <header className="space-y-1">
        <h2 id="governed-table-demo-heading" className="text-heading-sm">
          پیش‌نمایش جدول
        </h2>
        <p className="text-caption text-muted-foreground">
          پیش‌نمایش قرارداد جدول حاکمیتی با دادهٔ نمونه؛ اتصال به فهرست واقعی
          پرسنل در داستان ۵.۱ انجام می‌شود.
        </p>
      </header>

      {/* Force horizontal overflow so sticky id/actions are demonstrable. */}
      <div className="[&_[data-slot=table]]:min-w-[72rem]">
        <GovernedDataTable
          aria-label="پیش‌نمایش فهرست پرسنل"
          columns={FIXTURE_COLUMNS}
          rows={FIXTURE_PERSONS}
          getRowId={(row) => row.id}
          sectionDefaultFilters={FIXTURE_SECTION_DEFAULTS}
          pageSize={25}
          toolbar={
            <p className="text-body-medium text-muted-foreground">
              فیلتر پیش‌فرض بخش: وضعیت = فعال
            </p>
          }
          rowActions={(row) => (
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2">
              مشاهده {row.identifier}
            </Button>
          )}
        />
      </div>
    </section>
  );
}
