"use client";

import { GovernedDataTable } from "@/components/governed-data-table";
import type { GovernedColumn } from "@/components/governed-data-table";
import { useLeaveGuardOptional } from "@/components/leave-guard";
import { GlossaryTerm } from "@/components/glossary/glossary-term";
import { RecalcPendingMark } from "@/components/personnel/recalc-pending-mark";
import {
  StatusBadge,
  type StatusBadgeKind,
} from "@/components/personnel/status-badge";
import { Button } from "@/components/ui/button";

type EventFixtureRow = {
  id: string;
  personLabel: string;
  eventType: string;
  effectiveDate: string;
  status: StatusBadgeKind;
  /** Demo mark for Story 8.9 — fixture only. */
  recalcPending?: boolean;
};

const FIXTURE_EVENTS: EventFixtureRow[] = [
  {
    id: "ev-001",
    personLabel: "علی محمدی",
    eventType: "شروع همکاری",
    effectiveDate: "۱۴۰۴/۰۱/۱۵",
    status: "Effective",
  },
  {
    id: "ev-002",
    personLabel: "سارا احمدی",
    eventType: "انتقال",
    effectiveDate: "۱۴۰۴/۰۲/۰۱",
    status: "Draft",
    recalcPending: true,
  },
  {
    id: "ev-003",
    personLabel: "مینا رضایی",
    eventType: "تغییر جبران‌خدمت",
    effectiveDate: "۱۴۰۴/۰۳/۱۰",
    status: "Scheduled",
  },
  {
    id: "ev-004",
    personLabel: "رضا کریمی",
    eventType: "خاتمه همکاری",
    effectiveDate: "۱۴۰۳/۱۲/۲۹",
    status: "Cancelled",
  },
  {
    id: "ev-005",
    personLabel: "نگار حسینی",
    eventType: "تغییر نقش سازمانی",
    effectiveDate: "۱۴۰۴/۰۴/۰۱",
    status: "Effective",
  },
];

const COLUMNS: GovernedColumn<EventFixtureRow>[] = [
  {
    id: "personLabel",
    header: "فرد",
    accessor: (r) => r.personLabel,
    sticky: "identifier",
    filter: "text",
    sortable: true,
    cell: (r) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>{r.personLabel}</span>
        {r.recalcPending ? <RecalcPendingMark compact /> : null}
      </span>
    ),
  },
  {
    id: "eventType",
    header: "نوع رویداد",
    accessor: (r) => r.eventType,
    filter: "text",
    sortable: true,
  },
  {
    id: "effectiveDate",
    header: "تاریخ مؤثر",
    accessor: (r) => r.effectiveDate,
    filter: "text",
    sortable: true,
  },
  {
    id: "status",
    header: "وضعیت",
    accessor: (r) => r.status,
    filter: "enum",
    enumOptions: [
      { value: "Draft", label: "پیش‌نویس" },
      { value: "Effective", label: "مؤثر" },
      { value: "Scheduled", label: "زمان‌بندی‌شده" },
      { value: "Cancelled", label: "لغوشده" },
    ],
    cell: (r) => <StatusBadge status={r.status} />,
  },
];

const SECTION_DEFAULTS: Record<string, string | string[]> = {};

/**
 * رویدادها scaffold table — fixture only; no org-wide list API (Story 4b.7).
 * Story 8.9: one fixture row proves in-place recalc mark on a governed table.
 */
export function PersonnelEventsListPanel() {
  const leaveGuard = useLeaveGuardOptional();

  function goRegister() {
    const href = "/personnel-events/register";
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
      return;
    }
    window.location.assign(href);
  }

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
      <GovernedDataTable
        aria-label="فهرست رویدادهای پرسنلی"
        preferencesKey="personnel-events-list"
        columns={COLUMNS}
        rows={FIXTURE_EVENTS}
        getRowId={(r) => r.id}
        sectionDefaultFilters={SECTION_DEFAULTS}
        pageSize={25}
        emptyMessage="رویداد پرسنلی ثبت نشده. می‌توانید یک رویداد ایجاد کنید."
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="primary" onClick={goRegister}>
              ثبت رویداد
            </Button>
            <p className="text-caption text-muted-foreground">
              دادهٔ نمونه برای پوستهٔ بخش؛ فهرست کامل رویدادها بعداً تکمیل
              می‌شود.
            </p>
          </div>
        }
      />
    </section>
  );
}
