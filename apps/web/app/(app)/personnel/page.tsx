"use client";

import * as React from "react";

import {
  JalaliDatePicker,
  JalaliDateTimePicker,
} from "@/components/jalali-date-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformStatus } from "@/components/platform-status-provider";
import { operationalCopy } from "@/lib/operational-copy";
import { formatPersianCurrency } from "@/lib/persian-digits";

/**
 * Story 1.6–1.7 demo host: Jalali pickers + stale/gold-CTA smoke controls.
 * Break-glass is grant-backed (Story 2.5) — no mock elevation toggle.
 */
export default function PersonnelPage() {
  const [effectiveDate, setEffectiveDate] = React.useState<string | undefined>();
  const [registration, setRegistration] = React.useState<{
    date?: string;
    time?: string;
  }>({ time: "09:30" });

  const {
    blockingStale,
    setBlockingStale,
    isBreakGlassLive,
    isGoldCtaBlocked,
  } = usePlatformStatus();

  return (
    <div className="mx-auto max-w-3xl space-y-8 bg-background p-6 text-foreground">
      <header className="space-y-2">
        <h1 className="text-heading">پرسنل</h1>
        <p className="text-body text-muted-foreground">
          فهرست و پروندهٔ پرسنل در این بخش در دسترس خواهد بود. نمونهٔ انتخابگر
          تاریخ جلالی و کنترل بنر دادهٔ کهنه برای تأیید دستی:
        </p>
      </header>

      <section
        className="space-y-3 rounded-md border border-border p-4"
        aria-labelledby="platform-banner-demo"
      >
        <h2 id="platform-banner-demo" className="text-heading-sm">
          نمونهٔ بنر و CTA طلایی
        </h2>
        <p className="text-caption text-muted-foreground">
          {operationalCopy.staleGoldCtaHint}
        </p>
        {isBreakGlassLive ? (
          <p className="text-caption text-muted-foreground" role="status">
            {operationalCopy.breakGlassActiveHint}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            aria-pressed={blockingStale}
            onClick={() => setBlockingStale(!blockingStale)}
          >
            {blockingStale ? "خاموش کردن دادهٔ کهنه" : "فعال‌سازی دادهٔ کهنه"}
          </Button>
          <Button type="button" variant="secondary" asChild>
            <a href="/access">{operationalCopy.breakGlassAdminLink}</a>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="primary" disabled={isGoldCtaBlocked}>
            نهایی‌سازی (نمونه)
          </Button>
          <Button type="button" variant="primary" disabled={isGoldCtaBlocked}>
            خروجی گزارش (نمونه)
          </Button>
        </div>
        {isGoldCtaBlocked ? (
          <Skeleton className="h-3 w-40" aria-hidden />
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby="effective-date-demo">
        <h2 id="effective-date-demo" className="text-heading-sm">
          تاریخ مؤثر
        </h2>
        <JalaliDatePicker
          id="demo-effective-date"
          aria-label="تاریخ مؤثر"
          value={effectiveDate}
          onChange={setEffectiveDate}
        />
        {effectiveDate ? (
          <p className="text-caption text-muted-foreground">
            ذخیرهٔ تاریخ‌فقط (گرگوری):{" "}
            <span className="text-tabular text-foreground" dir="ltr">
              {effectiveDate}
            </span>
          </p>
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby="registration-demo">
        <h2 id="registration-demo" className="text-heading-sm">
          تاریخ و ساعت ثبت
        </h2>
        <JalaliDateTimePicker
          id="demo-registration"
          aria-label="تاریخ و ساعت ثبت"
          value={registration}
          onChange={setRegistration}
        />
      </section>

      <section className="space-y-1" aria-labelledby="currency-demo">
        <h2 id="currency-demo" className="text-heading-sm">
          نمونهٔ مبلغ
        </h2>
        <p className="text-body text-tabular">
          {formatPersianCurrency(12345678, { currencyLabel: "ریال" })}
        </p>
      </section>
    </div>
  );
}
