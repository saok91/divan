"use client";

import * as React from "react";

import { JalaliDatePicker, type JalaliDatePickerHandle } from "@/components/jalali-date-picker";
import { StatusBadge } from "@/components/personnel/status-badge";
import { Input } from "@/components/ui/input";
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

/**
 * Optional foreshadow of Person state on /personnel (Stories 4.9–4.10).
 * Jalali as-of + semantics / Baseline banners — not full profile (→ 5.2).
 */
export function CurrentPersonStateForeshadow() {
  const formId = React.useId();
  const asOfPickerRef = React.useRef<JalaliDatePickerHandle>(null);
  const [personId, setPersonId] = React.useState("");
  const [asOf, setAsOf] = React.useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = React.useState<{
    personId: string;
    asOf?: string;
  } | null>(null);

  const query = api.person.getCurrentState.useQuery(
    {
      personId: submitted?.personId ?? "",
      asOf: submitted?.asOf,
    },
    { enabled: Boolean(submitted?.personId) },
  );

  return (
    <section
      className="space-y-4"
      aria-labelledby={`${formId}-heading`}
    >
      <div className="space-y-1">
        <h2 id={`${formId}-heading`} className="text-title-sm font-semibold">
          وضعیت فرد (جاری / تاریخی / برنامه‌ریزی‌شده)
        </h2>
        <p className="text-body text-muted-foreground">
          پیش‌نمایش فقط‌خواندنی از اسمبلر مشترک — نه پروفایل کامل.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const id = personId.trim();
          if (id.length === 0) {
            setSubmitted(null);
            return;
          }
          const committed = asOfPickerRef.current?.commit();
          if (committed && !committed.ok) {
            return;
          }
          setSubmitted({
            personId: id,
            asOf: committed?.ok
              ? committed.value?.trim() || undefined
              : asOf?.trim() || undefined,
          });
        }}
      >
        <div className="min-w-[16rem] flex-1 space-y-1.5">
          <label htmlFor={`${formId}-person`} className="text-label">
            شناسه فرد
          </label>
          <Input
            id={`${formId}-person`}
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            dir="ltr"
            autoComplete="off"
            placeholder="UUID"
          />
        </div>
        <div className="min-w-[14rem] space-y-1.5">
          <label htmlFor={`${formId}-asof`} className="text-label">
            تاریخ مبنا (اختیاری)
          </label>
          <JalaliDatePicker
            ref={asOfPickerRef}
            id={`${formId}-asof`}
            aria-label="تاریخ مبنا برای بازسازی وضعیت فرد"
            value={asOf}
            onChange={setAsOf}
            helperText="خالی = امروز (تهران)"
          />
        </div>
        <button
          type="submit"
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-md px-4",
            "bg-primary text-primary-foreground text-label",
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
            <span dir="ltr">{toPersianDigits(query.data.asOf)}</span>
          </p>
          {query.data.baselineDisclosure.limited ||
          !query.data.baselineDisclosure.configured ? (
            <p role="alert" className="text-body text-amber-800 dark:text-amber-200">
              {query.data.baselineDisclosure.messageFa}
              {query.data.baselineDisclosure.boundaryDate ? (
                <>
                  {" "}
                  <span dir="ltr">
                    ({toPersianDigits(query.data.baselineDisclosure.boundaryDate)})
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">اشتغال فعال: </span>
            {query.data.employment
              ? toPersianDigits(query.data.employment.id.slice(0, 8))
              : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">تیم اصلی: </span>
            {query.data.teamMembership
              ? toPersianDigits(query.data.teamMembership.teamId.slice(0, 8))
              : "—"}
          </p>
          {query.data.viewSemantics === "planned" &&
          query.data.plannedChangesThroughAsOf.length > 0 ? (
            <ul className="space-y-2" aria-label="تغییرات برنامه‌ریزی‌شده تا تاریخ مبنا">
              {query.data.plannedChangesThroughAsOf.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-2"
                >
                  <StatusBadge status="Scheduled" />
                  <span className="text-xs text-muted-foreground">برنامه‌ریزی‌شده</span>
                  <span dir="ltr" className="font-mono text-sm">
                    {row.eventType}
                  </span>
                  <span className="text-muted-foreground" dir="ltr">
                    {toPersianDigits(row.effectiveDate)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {query.data.scheduledChanges.length > 0 ? (
            <ul className="space-y-2" aria-label="تغییرات زمان‌بندی‌شده">
              {query.data.scheduledChanges.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-2"
                >
                  <StatusBadge status="Scheduled" />
                  <span dir="ltr" className="font-mono text-sm">
                    {row.eventType}
                  </span>
                  <span className="text-muted-foreground" dir="ltr">
                    {toPersianDigits(row.effectiveDate)}
                  </span>
                </li>
              ))}
            </ul>
          ) : query.data.viewSemantics !== "planned" ||
            query.data.plannedChangesThroughAsOf.length === 0 ? (
            <p className="text-muted-foreground">
              تغییر زمان‌بندی‌شده‌ای برای آینده ثبت نشده است.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
