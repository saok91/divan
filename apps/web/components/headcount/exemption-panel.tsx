"use client";

import * as React from "react";

import {
  EntityPicker,
  TechnicalDetailDisclosure,
  createPersonSearch,
  createPrimaryAssignmentSearch,
  useEntityPickerCascade,
  type EntityPickerValue,
} from "@/components/entity-picker";
import { JalaliDatePicker } from "@/components/jalali-date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatJalaliDisplayFromGregorian } from "@/lib/jalali";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const STATUS_LABEL_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  revoked: "لغوشده",
  expired: "منقضی",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "status-badge-draft",
  active: "status-badge-effective",
  revoked: "status-badge-cancelled",
  expired: "status-badge-reversed",
};

const TREATMENT_LABEL_FA: Record<string, string> = {
  exclude_from_used: "خارج از مصرف‌شده",
  count_as_used_exempt: "مصرف‌شدهٔ معاف",
  other: "سایر",
};

function ExemptionStatusBadge({ status }: { status: string }) {
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
 * Admin Headcount Exemption surface (Story 4.13 / FR-29).
 */
export function HeadcountExemptionPanel() {
  const formId = React.useId();
  const [policyCode, setPolicyCode] = React.useState("");
  const [person, setPerson] = React.useState<EntityPickerValue>(null);
  const [primaryAssignment, setPrimaryAssignment] =
    React.useState<EntityPickerValue>(null);
  const [reason, setReason] = React.useState("");
  const [reportingTreatment, setReportingTreatment] = React.useState<
    "exclude_from_used" | "count_as_used_exempt" | "other"
  >("exclude_from_used");
  const [validityStart, setValidityStart] = React.useState<
    string | undefined
  >();
  const [validityEnd, setValidityEnd] = React.useState<string | undefined>();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const personSearch = React.useMemo(() => createPersonSearch(), []);
  const primaryAssignmentSearch = React.useMemo(
    () => createPrimaryAssignmentSearch(person?.id ?? null),
    [person?.id],
  );
  const primaryAssignmentCascade = useEntityPickerCascade(person, "فرد", {
    value: primaryAssignment,
    onValueChange: setPrimaryAssignment,
  });

  const utils = api.useUtils();
  const listQuery = api.headcount.listExemptions.useQuery(undefined);

  const createMutation = api.headcount.createExemption.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setPolicyCode("");
      setPerson(null);
      setPrimaryAssignment(null);
      setReason("");
      setValidityStart(undefined);
      setValidityEnd(undefined);
      await utils.headcount.listExemptions.invalidate();
    },
    onError: (err) => setFormError(err.message),
  });

  const activateMutation = api.headcount.activateExemption.useMutation({
    onSuccess: async () => {
      setBusyId(null);
      await utils.headcount.listExemptions.invalidate();
    },
    onError: (err) => {
      setBusyId(null);
      setFormError(err.message);
    },
  });

  const revokeMutation = api.headcount.revokeExemption.useMutation({
    onSuccess: async () => {
      setBusyId(null);
      await utils.headcount.listExemptions.invalidate();
    },
    onError: (err) => {
      setBusyId(null);
      setFormError(err.message);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const personId = person?.id?.trim() ?? "";
    const primaryAssignmentId = primaryAssignment?.id?.trim() ?? "";
    if (
      !policyCode.trim() ||
      !primaryAssignmentId ||
      !personId ||
      !reason.trim() ||
      !validityStart ||
      !validityEnd
    ) {
      setFormError("همهٔ فیلدهای الزامی را تکمیل کنید.");
      return;
    }
    createMutation.mutate({
      policyCode: policyCode.trim(),
      primaryAssignmentId,
      personId,
      reason: reason.trim(),
      validityStart,
      validityEndExclusive: validityEnd,
      reportingTreatment,
    });
  };

  return (
    <section className="space-y-6" aria-labelledby={`${formId}-heading`}>
      <div className="space-y-1">
        <h2 id={`${formId}-heading`} className="text-title">
          معافیت ظرفیت
        </h2>
        <p className="text-body text-muted-foreground">
          معافیت‌های پوشش‌دهندهٔ انتصاب اصلی بدون مصرف مجوز ظرفیت.
        </p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={onSubmit}
        noValidate
      >
        <label className="space-y-1 text-sm sm:col-span-1">
          <span id={`${formId}-policy`}>کد سیاست</span>
          <Input
            aria-labelledby={`${formId}-policy`}
            value={policyCode}
            onChange={(e) => setPolicyCode(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span id={`${formId}-person`}>فرد</span>
          <EntityPicker
            id={`${formId}-person`}
            search={personSearch}
            value={person}
            onValueChange={(next) => {
              setPerson(next);
              setPrimaryAssignment(null);
            }}
            scopeNoteFa="جستجو با کد پرسنلی یا نام"
            placeholder="کد یا نام پرسنل…"
            aria-labelledby={`${formId}-person`}
            aria-required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span id={`${formId}-primary`}>انتصاب اصلی</span>
          <EntityPicker
            id={`${formId}-primary`}
            search={primaryAssignmentSearch}
            value={primaryAssignmentCascade.value}
            onValueChange={primaryAssignmentCascade.onValueChange}
            disabled={primaryAssignmentCascade.disabled}
            disabledReasonFa={primaryAssignmentCascade.disabledReasonFa}
            scopeNoteFa="انتصاب‌های اصلی فرد انتخاب‌شده"
            placeholder="کد یا عنوان انتصاب…"
            aria-labelledby={`${formId}-primary`}
            aria-required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span id={`${formId}-treatment`}>نحوه گزارش‌دهی</span>
          <select
            aria-labelledby={`${formId}-treatment`}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={reportingTreatment}
            onChange={(e) =>
              setReportingTreatment(
                e.target.value as typeof reportingTreatment,
              )
            }
          >
            <option value="exclude_from_used">خارج از مصرف‌شده</option>
            <option value="count_as_used_exempt">مصرف‌شدهٔ معاف</option>
            <option value="other">سایر</option>
          </select>
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span id={`${formId}-reason`}>دلیل</span>
          <Input
            aria-labelledby={`${formId}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="space-y-1 text-sm">
          <span id={`${formId}-start`}>شروع اعتبار</span>
          <JalaliDatePicker
            aria-label="شروع اعتبار معافیت"
            value={validityStart}
            onChange={setValidityStart}
          />
        </div>
        <div className="space-y-1 text-sm">
          <span id={`${formId}-end`}>پایان اعتبار (اختصاصی)</span>
          <JalaliDatePicker
            aria-label="پایان اعتبار معافیت"
            value={validityEnd}
            onChange={setValidityEnd}
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={createMutation.isPending}
            aria-busy={createMutation.isPending}
          >
            ثبت پیش‌نویس معافیت
          </Button>
        </div>
      </form>

      {formError ? (
        <StatusMessage kind="error">{formError}</StatusMessage>
      ) : null}

      {listQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : listQuery.isError ? (
        <StatusMessage kind="error">
          {listQuery.error.message || "بارگذاری معافیت‌ها ناموفق بود."}
        </StatusMessage>
      ) : !listQuery.data?.length ? (
        <StatusMessage kind="empty">معافیتی ثبت نشده است.</StatusMessage>
      ) : (
        <ul className="space-y-3" role="list">
          {listQuery.data.map((row) => (
            <li
              key={row.id}
              className="rounded-md border border-border px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <ExemptionStatusBadge status={row.status} />
                <span className="text-sm font-medium">{row.policyCode}</span>
                <span className="text-xs text-muted-foreground">
                  {TREATMENT_LABEL_FA[row.reportingTreatment] ??
                    row.reportingTreatment}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{row.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                {formatJalaliDisplayFromGregorian(row.validityStart)} →{" "}
                {formatJalaliDisplayFromGregorian(row.validityEndExclusive)}
              </p>
              <div className="mt-1 space-y-1">
                <p className="text-xs text-muted-foreground">انتصاب اصلی</p>
                <TechnicalDetailDisclosure
                  value={row.primaryAssignmentId}
                  valueLabelFa="شناسهٔ فنی انتصاب اصلی"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {row.status === "draft" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busyId === row.id}
                    onClick={() => {
                      setBusyId(row.id);
                      activateMutation.mutate({ id: row.id });
                    }}
                  >
                    فعال‌سازی
                  </Button>
                ) : null}
                {row.status === "draft" || row.status === "active" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="rowAction"
                    disabled={busyId === row.id}
                    onClick={() => {
                      setBusyId(row.id);
                      revokeMutation.mutate({ id: row.id });
                    }}
                  >
                    لغو
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
