"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatJalaliDisplayFromGregorian } from "@/lib/jalali";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const RULE_LABEL_FA: Record<string, string> = {
  shortage: "کمبود ظرفیت",
  validity: "اعتبار مجوز",
  job_title: "عنوان شغلی",
  seniority: "ارشدیت",
};

const STATUS_LABEL_FA: Record<string, string> = {
  active: "فعال",
  superseded: "جایگزین‌شده",
  voided: "باطل",
};

const STATUS_CLASS: Record<string, string> = {
  active: "status-badge-effective",
  superseded: "status-badge-scheduled",
  voided: "status-badge-cancelled",
};

function OverrideStatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL_FA[status] ?? status;
  const token = STATUS_CLASS[status] ?? "status-badge-draft";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        token,
      )}
    >
      <span
        className="size-1.5 shrink-0 rounded-full bg-current opacity-70"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function StatusMessage({
  kind,
  children,
}: {
  kind: "loading" | "error" | "empty" | "info";
  children: React.ReactNode;
}) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "text-body",
        kind === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

/**
 * Admin Headcount Override catalogue (Story 4.14 / FR-32).
 */
export function HeadcountOverridePanel() {
  const formId = React.useId();
  const [statusFilter, setStatusFilter] = React.useState<string>("active");
  const [ruleFilter, setRuleFilter] = React.useState<string>("");
  const [teamFilter, setTeamFilter] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const listQuery = api.headcount.listOverrides.useQuery({
    status:
      statusFilter === ""
        ? undefined
        : (statusFilter as "active" | "superseded" | "voided"),
    violatedRule:
      ruleFilter === ""
        ? undefined
        : (ruleFilter as "shortage" | "validity" | "job_title" | "seniority"),
    teamId: teamFilter.trim() || undefined,
  });

  const voidMutation = api.headcount.voidOverride.useMutation({
    onSuccess: async () => {
      setBusyId(null);
      setFormError(null);
      await listQuery.refetch();
    },
    onError: (err) => {
      setBusyId(null);
      setFormError(err.message);
    },
  });

  return (
    <section className="space-y-4" aria-labelledby={`${formId}-heading`}>
      <div className="space-y-1">
        <h2 id={`${formId}-heading`} className="text-title">
          لغو محدودیت ظرفیت
        </h2>
        <p className="text-body text-muted-foreground">
          فهرست قابل فیلتر لغو محدودیت‌های ممیزی‌شده؛ ظرفیت آزاد می‌تواند منفی
          شود.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span id={`${formId}-status`}>وضعیت</span>
          <select
            aria-labelledby={`${formId}-status`}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">همه</option>
            <option value="active">فعال</option>
            <option value="superseded">جایگزین‌شده</option>
            <option value="voided">باطل</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span id={`${formId}-rule`}>قاعدة نقض‌شده</span>
          <select
            aria-labelledby={`${formId}-rule`}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
          >
            <option value="">همه</option>
            <option value="shortage">کمبود ظرفیت</option>
            <option value="validity">اعتبار مجوز</option>
            <option value="job_title">عنوان شغلی</option>
            <option value="seniority">ارشدیت</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span id={`${formId}-team`}>شناسه تیم</span>
          <Input
            aria-labelledby={`${formId}-team`}
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            autoComplete="off"
            dir="ltr"
          />
        </label>
      </div>

      {formError ? <StatusMessage kind="error">{formError}</StatusMessage> : null}

      {listQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : listQuery.isError ? (
        <StatusMessage kind="error">
          {listQuery.error.message || "بارگذاری لغو محدودیت‌ها ناموفق بود."}
        </StatusMessage>
      ) : !listQuery.data?.length ? (
        <StatusMessage kind="empty">لغو محدودیتی ثبت نشده است.</StatusMessage>
      ) : (
        <ul className="space-y-3" role="list">
          {listQuery.data.map((row) => (
            <li
              key={row.id}
              className="rounded-md border border-border px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <OverrideStatusBadge status={row.status} />
                <span className="text-sm font-medium">
                  {RULE_LABEL_FA[row.violatedRule] ?? row.violatedRule}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{row.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                {formatJalaliDisplayFromGregorian(
                  row.createdAt.toISOString?.() ?? String(row.createdAt),
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                free: {row.capacitySnapshot.freeBefore} →{" "}
                {row.capacitySnapshot.freeAfter}
                {row.slotId ? ` · slot ${row.slotId}` : ""}
              </p>
              {row.status === "active" ? (
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busyId === row.id}
                    onClick={() => {
                      setBusyId(row.id);
                      voidMutation.mutate({ id: row.id });
                    }}
                  >
                    ابطال
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
