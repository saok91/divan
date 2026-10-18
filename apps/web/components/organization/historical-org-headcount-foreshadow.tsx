"use client";

import * as React from "react";

import {
  EntityPicker,
  createOrgUnitSearch,
  type EntityPickerValue,
} from "@/components/entity-picker";
import { LabelWithHelp, FILTER_FIELD_LABEL_CLASS } from "@/components/form-layout";
import { JalaliDatePicker, type JalaliDatePickerHandle } from "@/components/jalali-date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const VIEW_SEMANTICS_LABEL_FA: Record<
  "current" | "historical" | "planned",
  string
> = {
  current: "جاری",
  historical: "تاریخی",
  planned: "برنامه‌ریزی‌شده",
};

type HistoricalOrgHeadcountForeshadowProps = {
  /** Prefill team from approval row context (Story 9.4 drawer). */
  initialTeam?: EntityPickerValue;
  /** Compact chrome when embedded in record-drawer. */
  embedded?: boolean;
};

/**
 * Optional foreshadow of org/headcount as-of counts (Story 4.11 / FR-27).
 * Not Approval admin UI (→ 4.12) or dashboard (→ 5.4).
 */
export function HistoricalOrgHeadcountForeshadow({
  initialTeam,
  embedded,
}: HistoricalOrgHeadcountForeshadowProps) {
  return <HistoricalCountsForm key={initialTeam?.id ?? "all"} initialTeam={initialTeam} embedded={embedded} />;
}

function HistoricalCountsForm({
  initialTeam = null,
  embedded = false,
}: HistoricalOrgHeadcountForeshadowProps) {
  const formId = React.useId();
  const asOfPickerRef = React.useRef<JalaliDatePickerHandle>(null);
  const [team, setTeam] = React.useState<EntityPickerValue>(initialTeam);
  const [asOf, setAsOf] = React.useState<string | undefined>(undefined);
  const orgUnitSearch = React.useMemo(() => createOrgUnitSearch(), []);
  const [submitted, setSubmitted] = React.useState<{
    asOf: string;
    teamId?: string;
  } | null>(null);

  const query = api.organization.getHistoricalCounts.useQuery(
    {
      asOf: submitted?.asOf ?? "",
      teamId: submitted?.teamId,
    },
    { enabled: Boolean(submitted?.asOf) },
  );

  return (
    <section className="space-y-4" aria-labelledby={`${formId}-heading`}>
      {embedded ? (
        <p className="text-caption text-muted-foreground">
          پیش‌نمایش فقط‌خواندنی عضویت تیم و ظرفیت — نه داشبورد کامل و نه تأیید ظرفیت.
        </p>
      ) : (
        <div className="space-y-1">
          <h2 id={`${formId}-heading`} className="text-title-sm font-semibold">
            شمارش سازمان و ظرفیت (تاریخی)
          </h2>
          <p className="text-body text-muted-foreground">
            پیش‌نمایش فقط‌خواندنی عضویت تیم و ظرفیت — نه داشبورد کامل و نه تأیید ظرفیت.
          </p>
        </div>
      )}
      {embedded ? <h2 id={`${formId}-heading`} className="sr-only">بازسازی تاریخی</h2> : null}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const committed = asOfPickerRef.current?.commit();
          if (committed && !committed.ok) return;
          const asOfValue = committed?.ok
            ? committed.value?.trim()
            : asOf?.trim();
          if (!asOfValue) return;
          const tid = team?.id?.trim() ?? "";
          setSubmitted({
            asOf: asOfValue,
            teamId: tid.length > 0 ? tid : undefined,
          });
        }}
      >
        <div className="min-w-[14rem] space-y-1.5">
          <LabelWithHelp
            htmlFor={`${formId}-asof`}
            help="الزامی — تاریخ فقط (تهران)"
            helpLabel="راهنمای تاریخ مبنا"
            helpId={`${formId}-asof-help`}
          >
            تاریخ مبنا
          </LabelWithHelp>
          <JalaliDatePicker
            ref={asOfPickerRef}
            id={`${formId}-asof`}
            aria-label="تاریخ مبنا برای بازسازی شمارش سازمان و ظرفیت"
            aria-describedby={`${formId}-asof-help`}
            value={asOf}
            onChange={setAsOf}
            helperText=""
          />
        </div>
        <div className="min-w-[16rem] flex-1 space-y-1.5">
          <label htmlFor={`${formId}-team`} className={FILTER_FIELD_LABEL_CLASS}>
            تیم (اختیاری)
          </label>
          <EntityPicker
            id={`${formId}-team`}
            search={orgUnitSearch}
            value={team}
            onValueChange={setTeam}
            scopeNoteFa="خالی = همه تیم‌ها"
            placeholder="کد یا نام تیم…"
          />
        </div>
        <button
          type="submit"
          className={cn(
            "inline-flex h-control-height items-center justify-center rounded-md px-4",
            "bg-primary text-primary-foreground text-field-label",
          )}
        >
          نمایش
        </button>
      </form>

      {!submitted ? null : query.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError ? (
        <p role="alert" className="text-body text-destructive">
          {query.error.message}
        </p>
      ) : query.data && query.data.ok === false ? (
        <p role="alert" className="text-body text-destructive">
          {query.data.messageFa}
        </p>
      ) : query.data && query.data.ok === true ? (
        <div className="space-y-3 text-body">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">نوع نما: </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                query.data.viewSemantics === "planned"
                  ? "status-badge-scheduled"
                  : query.data.viewSemantics === "historical"
                    ? "bg-muted text-muted-foreground"
                    : "status-badge-effective",
              )}
            >
              {VIEW_SEMANTICS_LABEL_FA[query.data.viewSemantics]}
            </span>
            {query.data.viewSemantics === "planned" ? (
              <span className="text-muted-foreground text-sm">
                (حقایق مؤثر امروز؛ نه برچسب مؤثر برای آینده)
              </span>
            ) : null}
          </p>
          <p>
            <span className="text-muted-foreground">تاریخ مبنا: </span>
            <span dir="ltr" className="tabular-nums">
              {toPersianDigits(query.data.asOf)}
            </span>
          </p>
          {query.data.baselineDisclosure.limited ||
          !query.data.baselineDisclosure.configured ? (
            <p role="alert" className="text-body text-amber-800 dark:text-amber-200">
              {query.data.baselineDisclosure.messageFa}
            </p>
          ) : null}
          <table className="w-full max-w-lg text-sm">
            <caption className="sr-only">
              شمارش عضویت و ظرفیت
            </caption>
            <tbody>
              <tr>
                <th scope="row" className="py-1 text-muted-foreground text-start">
                  عضویت تیم
                </th>
                <td className="py-1 tabular-nums" dir="ltr">
                  {toPersianDigits(String(query.data.aggregate.teamMembershipCount))}
                </td>
              </tr>
              <tr>
                <th scope="row" className="py-1 text-muted-foreground text-start">
                  واحدهای تیم
                </th>
                <td className="py-1 tabular-nums" dir="ltr">
                  {toPersianDigits(String(query.data.aggregate.orgUnitCounts.TEAM))}
                </td>
              </tr>
              <tr>
                <th scope="row" className="py-1 text-muted-foreground text-start">
                  تأییدشده
                </th>
                <td className="py-1 tabular-nums" dir="ltr">
                  {toPersianDigits(String(query.data.aggregate.approved))}
                </td>
              </tr>
              <tr>
                <th scope="row" className="py-1 text-muted-foreground text-start">
                  مصرف‌شده
                </th>
                <td className="py-1 tabular-nums" dir="ltr">
                  {toPersianDigits(String(query.data.aggregate.used))}
                </td>
              </tr>
              <tr>
                <th scope="row" className="py-1 text-muted-foreground text-start">
                  رزرو
                </th>
                <td className="py-1 tabular-nums" dir="ltr">
                  {toPersianDigits(String(query.data.aggregate.reserved))}
                </td>
              </tr>
              <tr>
                <th scope="row" className="py-1 text-muted-foreground text-start">
                  آزاد
                </th>
                <td className="py-1 tabular-nums" dir="ltr">
                  {toPersianDigits(String(query.data.aggregate.free))}
                </td>
              </tr>
            </tbody>
          </table>
          {query.data.viewSemantics === "planned" &&
          query.data.plannedMembershipDeltas.length > 0 ? (
            <ul
              className="space-y-1"
              aria-label="انتقال‌های برنامه‌ریزی‌شده تا تاریخ مبنا"
            >
              {query.data.plannedMembershipDeltas.map((d) => (
                <li key={d.eventId} className="text-sm text-muted-foreground">
                  <span>برنامه‌ریزی‌شده </span>
                  <span dir="ltr" className="font-mono">
                    {d.eventType}
                  </span>
                  <span> </span>
                  <span dir="ltr" className="tabular-nums">
                    {toPersianDigits(d.effectiveDate)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
