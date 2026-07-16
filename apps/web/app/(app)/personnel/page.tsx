"use client";

import * as React from "react";

import {
  JalaliDatePicker,
  JalaliDateTimePicker,
} from "@/components/jalali-date-picker";
import { formatPersianCurrency } from "@/lib/persian-digits";

/**
 * Story 1.6 demo host: Effective Date vs registration date+time (FR44).
 * Not a domain form — Epic 4/5 own persistence.
 */
export default function PersonnelPage() {
  const [effectiveDate, setEffectiveDate] = React.useState<string | undefined>();
  const [registration, setRegistration] = React.useState<{
    date?: string;
    time?: string;
  }>({ time: "09:30" });

  return (
    <div className="mx-auto max-w-3xl space-y-8 bg-background p-6 text-foreground">
      <header className="space-y-2">
        <h1 className="text-heading">پرسنل</h1>
        <p className="text-body text-muted-foreground">
          فهرست و پروندهٔ پرسنل در این بخش در دسترس خواهد بود. نمونهٔ انتخابگر
          تاریخ جلالی برای تأیید دستی Story 1.6:
        </p>
      </header>

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
