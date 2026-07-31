"use client";

import * as React from "react";

import { JalaliDatePicker } from "@/components/jalali-date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionButton } from "@/components/ui/row-action-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Ban } from "lucide-react";
import { formatJalaliDisplayFromGregorian } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const STATUS_LABEL_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  cancelled: "لغوشده",
  expired: "منقضی",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "status-badge-draft",
  active: "status-badge-effective",
  cancelled: "status-badge-cancelled",
  expired: "status-badge-reversed",
};

function ApprovalStatusBadge({ status }: { status: string }) {
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
 * Admin Headcount Approval surface (Story 4.12 / FR-28).
 * Create → activate → cancel; list with status-badge + tabular counts + Jalali.
 */
export function HeadcountApprovalPanel() {
  const formId = React.useId();
  const [requirementCode, setRequirementCode] = React.useState("");
  const [teamId, setTeamId] = React.useState("");
  const [jobTitleId, setJobTitleId] = React.useState("");
  const [allowedCount, setAllowedCount] = React.useState("1");
  const [validityStart, setValidityStart] = React.useState<
    string | undefined
  >();
  const [validityEnd, setValidityEnd] = React.useState<string | undefined>();
  const [approvalReference, setApprovalReference] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const utils = api.useUtils();
  const listQuery = api.headcount.listApprovals.useQuery();
  const teamsQuery = api.organization.list.useQuery({
    includeInactive: false,
  });
  const titlesQuery = api.jobReference.listJobTitles.useQuery({
    includeInactive: false,
  });

  const teams = React.useMemo(
    () => (teamsQuery.data ?? []).filter((u) => u.unitType === "TEAM"),
    [teamsQuery.data],
  );
  const titles = titlesQuery.data ?? [];

  React.useEffect(() => {
    if (!teamId && teams[0]) setTeamId(teams[0].id);
  }, [teamId, teams]);
  React.useEffect(() => {
    if (!jobTitleId && titles[0]) setJobTitleId(titles[0].id);
  }, [jobTitleId, titles]);

  const createMutation = api.headcount.createApproval.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setRequirementCode("");
      setAllowedCount("1");
      setApprovalReference("");
      await utils.headcount.listApprovals.invalidate();
    },
    onError: (err) => setFormError(err.message),
  });
  const activateMutation = api.headcount.activateApproval.useMutation({
    onSuccess: async () => {
      setFormError(null);
      await utils.headcount.listApprovals.invalidate();
    },
    onError: (err) => setFormError(err.message),
  });
  const cancelMutation = api.headcount.cancelApproval.useMutation({
    onSuccess: async () => {
      setFormError(null);
      await utils.headcount.listApprovals.invalidate();
    },
    onError: (err) => setFormError(err.message),
  });

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const allowed = Number.parseInt(allowedCount, 10);
    if (!requirementCode.trim() || !teamId || !jobTitleId) {
      setFormError("کد نیازمندی، تیم و عنوان شغلی الزامی است.");
      return;
    }
    if (!Number.isInteger(allowed) || allowed < 0) {
      setFormError("سقف مجاز باید عدد صحیح غیرمنفی باشد.");
      return;
    }
    if (!validityStart || !validityEnd) {
      setFormError("بازه اعتبار الزامی است.");
      return;
    }
    createMutation.mutate({
      requirementCode: requirementCode.trim(),
      teamId,
      jobTitleId,
      allowedCount: allowed,
      validityStart,
      validityEndExclusive: validityEnd,
      approvalReference: approvalReference.trim() || null,
    });
  };

  const runAction = async (
    id: string,
    action: "activate" | "cancel",
  ): Promise<void> => {
    setBusyId(id);
    setFormError(null);
    try {
      if (action === "activate") {
        await activateMutation.mutateAsync({ id });
      } else {
        await cancelMutation.mutateAsync({ id });
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby={`${formId}-heading`}>
      <div className="space-y-1">
        <h2 id={`${formId}-heading`} className="text-title">
          مجوزهای ظرفیت
        </h2>
        <p className="text-body text-muted-foreground">
          ایجاد، فعال‌سازی و لغو مجوز ظرفیت (سقف مجاز مصرف و رزرو).
        </p>
      </div>

      <form
        className="grid max-w-3xl gap-4 sm:grid-cols-2"
        onSubmit={onCreate}
        noValidate
      >
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor={`${formId}-code`}>
            کد نیازمندی
          </label>
          <Input
            id={`${formId}-code`}
            value={requirementCode}
            onChange={(e) => setRequirementCode(e.target.value)}
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor={`${formId}-team`}>
            تیم
          </label>
          <select
            id={`${formId}-team`}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            required
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameFa} ({t.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor={`${formId}-title`}>
            عنوان شغلی
          </label>
          <select
            id={`${formId}-title`}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={jobTitleId}
            onChange={(e) => setJobTitleId(e.target.value)}
            required
          >
            {titles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameFa} ({t.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor={`${formId}-allowed`}>
            سقف مجاز
          </label>
          <Input
            id={`${formId}-allowed`}
            className="tabular-nums"
            inputMode="numeric"
            value={allowedCount}
            onChange={(e) => setAllowedCount(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor={`${formId}-ref`}>
            مرجع تصویب (اختیاری)
          </label>
          <Input
            id={`${formId}-ref`}
            value={approvalReference}
            onChange={(e) => setApprovalReference(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium" id={`${formId}-start-label`}>
            شروع اعتبار
          </span>
          <JalaliDatePicker
            aria-label="شروع اعتبار مجوز ظرفیت"
            value={validityStart}
            onChange={setValidityStart}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium" id={`${formId}-end-label`}>
            پایان اعتبار (انحصاری)
          </span>
          <JalaliDatePicker
            aria-label="پایان اعتبار انحصاری مجوز ظرفیت"
            value={validityEnd}
            onChange={setValidityEnd}
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="min-w-32"
          >
            {createMutation.isPending ? "در حال ثبت…" : "ایجاد پیش‌نویس"}
          </Button>
        </div>
      </form>

      {formError ? (
        <StatusMessage kind="error">{formError}</StatusMessage>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-medium">فهرست مجوزها</h3>
        {listQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : listQuery.isError ? (
          <StatusMessage kind="error">
            {listQuery.error.message || "بارگذاری مجوزهای ظرفیت ممکن نشد."}
          </StatusMessage>
        ) : !listQuery.data?.length ? (
          <StatusMessage kind="empty">
            هنوز مجوزی ثبت نشده است.
          </StatusMessage>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {listQuery.data.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.requirementCode}</span>
                    <ApprovalStatusBadge status={row.status} />
                  </div>
                  <p className="text-muted-foreground text-sm tabular-nums">
                    سقف {toPersianDigits(String(row.allowedCount))} · مصرف{" "}
                    {toPersianDigits(String(row.used))} · رزرو{" "}
                    {toPersianDigits(String(row.reserved))} · آزاد{" "}
                    {toPersianDigits(String(row.free))}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    اعتبار:{" "}
                    {formatJalaliDisplayFromGregorian(row.validityStart)} –{" "}
                    {formatJalaliDisplayFromGregorian(row.validityEndExclusive)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.status === "draft" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void runAction(row.id, "activate")}
                    >
                      فعال‌سازی
                    </Button>
                  ) : null}
                  {row.status === "draft" || row.status === "active" ? (
                    <RowActionButton
                      label="لغو"
                      icon={Ban}
                      disabled={busyId === row.id}
                      disabledReason="در حال انجام عملیات…"
                      onClick={() => void runAction(row.id, "cancel")}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
