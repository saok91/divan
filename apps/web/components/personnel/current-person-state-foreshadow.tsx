"use client";

import * as React from "react";

import { StatusBadge } from "@/components/personnel/status-badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Optional foreshadow of current Person state on /personnel (Story 4.9).
 * Read-only summary + Scheduled badges — not full profile sections (→ 5.2).
 */
export function CurrentPersonStateForeshadow() {
  const formId = React.useId();
  const [personId, setPersonId] = React.useState("");
  const [submittedId, setSubmittedId] = React.useState<string | null>(null);

  const query = api.person.getCurrentState.useQuery(
    { personId: submittedId ?? "" },
    { enabled: Boolean(submittedId) },
  );

  return (
    <section
      className="space-y-4"
      aria-labelledby={`${formId}-heading`}
    >
      <div className="space-y-1">
        <h2 id={`${formId}-heading`} className="text-title-sm font-semibold">
          وضعیت جاری فرد
        </h2>
        <p className="text-body text-muted-foreground">
          پیش‌نمایش فقط‌خواندنی از اسمبلر مشترک وضعیت جاری (نه پروفایل کامل).
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const id = personId.trim();
          setSubmittedId(id.length > 0 ? id : null);
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

      {!submittedId ? null : query.isLoading ? (
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
          <p>
            <span className="text-muted-foreground">تاریخ مبنا: </span>
            <span dir="ltr">{toPersianDigits(query.data.asOf)}</span>
          </p>
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
          ) : (
            <p className="text-muted-foreground">
              تغییر زمان‌بندی‌شده‌ای برای آینده ثبت نشده است.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
