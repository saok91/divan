"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type HeadcountCapacityPanelProps = {
  used: number;
  reserved: number;
  free: number;
  /** Active covering exemption foreshadow (UX-DR13). */
  exempt?: number;
  /** Active Override count for the resolved slot (FR-32). */
  overridden?: number;
  /** False when no matching slot was found (distinct from free=0). */
  slotFound?: boolean;
  loading?: boolean;
  errorFa?: string | null;
  className?: string;
};

/**
 * UX-DR13 — destination capacity panel (used / reserved / free / exempt).
 */
export function HeadcountCapacityPanel({
  used,
  reserved,
  free,
  exempt = 0,
  overridden,
  slotFound = true,
  loading,
  errorFa,
  className,
}: HeadcountCapacityPanelProps) {
  if (loading) {
    return (
      <p
        className={cn("text-sm text-muted-foreground", className)}
        role="status"
      >
        در حال بارگذاری ظرفیت مقصد…
      </p>
    );
  }

  if (errorFa) {
    return (
      <p
        className={cn("text-sm text-destructive", className)}
        role="alert"
      >
        {errorFa}
      </p>
    );
  }

  if (!slotFound && exempt === 0) {
    return (
      <p
        className={cn("text-sm text-muted-foreground", className)}
        role="status"
      >
        اسلات ظرفیت برای این مقصد یافت نشد.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-muted/30 px-3 py-2",
        className,
      )}
      role="region"
      aria-label="ظرفیت نیروی انسانی مقصد"
    >
      <p className="text-label-medium mb-2">ظرفیت مقصد</p>
      <dl className="grid grid-cols-2 gap-2 text-sm tabular-nums sm:grid-cols-5">
        <div>
          <dt className="text-muted-foreground text-xs">مصرف‌شده</dt>
          <dd className="font-medium" dir="ltr">
            {used}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">رزرو</dt>
          <dd className="font-medium" dir="ltr">
            {reserved}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">آزاد</dt>
          <dd
            className={cn(
              "font-medium",
              free > 0
                ? "text-foreground"
                : free < 0
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
            dir="ltr"
          >
            {free}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">معاف</dt>
          <dd className="font-medium" dir="ltr">
            {exempt}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">لغو محدودیت</dt>
          <dd className="font-medium" dir="ltr">
            {overridden ?? 0}
          </dd>
        </div>
      </dl>
    </div>
  );
}
