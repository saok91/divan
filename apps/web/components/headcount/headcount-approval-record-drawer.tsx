"use client";

import * as React from "react";
import { Ban } from "lucide-react";

import {
  EntityPicker,
  TechnicalDetailDisclosure,
  createPersonSearch,
  createPrimaryAssignmentSearch,
  useEntityPickerCascade,
  type EntityPickerValue,
} from "@/components/entity-picker";
import { JalaliDatePicker } from "@/components/jalali-date-picker";
import { Panel, PanelSection } from "@/components/layout/panel-section";
import { HistoricalOrgHeadcountForeshadow } from "@/components/organization/historical-org-headcount-foreshadow";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { RowActionButton } from "@/components/ui/row-action-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { GlossaryTerm } from "@/components/glossary/glossary-term";
import type { HeadcountApprovalRow } from "@/components/headcount/headcount-approval-types";
import { formatJalaliDisplayFromGregorian } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const EXEMPTION_STATUS_LABEL_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  revoked: "لغوشده",
  expired: "منقضی",
};

const EXEMPTION_STATUS_CLASS: Record<string, string> = {
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

const RULE_LABEL_FA: Record<string, string> = {
  shortage: "کمبود ظرفیت",
  validity: "اعتبار مجوز",
  job_title: "عنوان شغلی",
  seniority: "ارشدیت",
};

const OVERRIDE_STATUS_LABEL_FA: Record<string, string> = {
  active: "فعال",
  superseded: "جایگزین‌شده",
  voided: "باطل",
};

const OVERRIDE_STATUS_CLASS: Record<string, string> = {
  active: "status-badge-effective",
  superseded: "status-badge-scheduled",
  voided: "status-badge-cancelled",
};

const APPROVAL_STATUS_LABEL_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  cancelled: "لغوشده",
  expired: "منقضی",
};

function StatusPill({
  label,
  token,
}: {
  label: string;
  token: string;
}) {
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

type DrawerProps = {
  open: boolean;
  approval: HeadcountApprovalRow | null;
  triggerEl: HTMLElement | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * Record-drawer for one approval row (Story 9.4 / UX-DR34).
 * Exemptions / overrides / historical open in context of the row — no fake FK.
 */
export function HeadcountApprovalRecordDrawer({
  open,
  approval,
  triggerEl,
  onOpenChange,
}: DrawerProps) {
  const formId = React.useId();
  const exemptionFormRef = React.useRef<HTMLDivElement | null>(null);
  const focusReturnRef = React.useRef<HTMLElement | null>(null);
  const [showExemptionForm, setShowExemptionForm] = React.useState(false);
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
  const [sectionError, setSectionError] = React.useState<string | null>(null);
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
  const teamId = approval?.teamId;
  const approvalId = approval?.id;

  const exemptionsQuery = api.headcount.listExemptions.useQuery(undefined, {
    enabled: open,
  });
  const overridesQuery = api.headcount.listOverrides.useQuery(
    { teamId: teamId || undefined },
    { enabled: open && Boolean(teamId) },
  );

  const initialTeam = React.useMemo((): EntityPickerValue => {
    if (!approval) return null;
    return {
      id: approval.teamId,
      code: approval.teamCode || approval.teamId,
      labelFa: approval.teamNameFa || approval.teamLabel,
    };
  }, [approval]);

  React.useEffect(() => {
    if (open && triggerEl?.isConnected) {
      focusReturnRef.current = triggerEl;
    }
  }, [open, triggerEl]);

  React.useEffect(() => {
    if (!open) {
      setShowExemptionForm(false);
      setSectionError(null);
      setPolicyCode("");
      setPerson(null);
      setPrimaryAssignment(null);
      setReason("");
      setReportingTreatment("exclude_from_used");
      setValidityStart(undefined);
      setValidityEnd(undefined);
      setBusyId(null);
    }
  }, [open, approvalId]);

  React.useEffect(() => {
    if (!showExemptionForm) return;
    const node = exemptionFormRef.current
      ?.querySelector<HTMLElement>("input,button,[tabindex]");
    node?.focus();
  }, [showExemptionForm]);

  const createExemption = api.headcount.createExemption.useMutation({
    onSuccess: async () => {
      setSectionError(null);
      setPolicyCode("");
      setPerson(null);
      setPrimaryAssignment(null);
      setReason("");
      setValidityStart(undefined);
      setValidityEnd(undefined);
      setShowExemptionForm(false);
      await utils.headcount.listExemptions.invalidate();
    },
    onError: (err) => setSectionError(err.message),
  });
  const activateExemption = api.headcount.activateExemption.useMutation({
    onSuccess: async () => {
      setBusyId(null);
      await utils.headcount.listExemptions.invalidate();
    },
    onError: (err) => {
      setBusyId(null);
      setSectionError(err.message);
    },
  });
  const revokeExemption = api.headcount.revokeExemption.useMutation({
    onSuccess: async () => {
      setBusyId(null);
      await utils.headcount.listExemptions.invalidate();
    },
    onError: (err) => {
      setBusyId(null);
      setSectionError(err.message);
    },
  });
  const voidOverride = api.headcount.voidOverride.useMutation({
    onSuccess: async () => {
      setBusyId(null);
      await overridesQuery.refetch();
    },
    onError: (err) => {
      setBusyId(null);
      setSectionError(err.message);
    },
  });

  const scopedOverrides = React.useMemo(() => {
    const all = overridesQuery.data ?? [];
    if (!approvalId) return all;
    return all.filter(
      (row) => row.approvalId == null || row.approvalId === approvalId,
    );
  }, [overridesQuery.data, approvalId]);

  function onCreateExemption(e: React.FormEvent) {
    e.preventDefault();
    setSectionError(null);
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
      setSectionError("همهٔ فیلدهای الزامی را تکمیل کنید.");
      return;
    }
    if (validityEnd <= validityStart) {
      setSectionError("پایان اعتبار باید بعد از شروع اعتبار باشد.");
      return;
    }
    createExemption.mutate({
      policyCode: policyCode.trim(),
      primaryAssignmentId,
      personId,
      reason: reason.trim(),
      validityStart,
      validityEndExclusive: validityEnd,
      reportingTreatment,
    });
  }

  function focusExemptionForm() {
    setShowExemptionForm(true);
  }

  const statusLabel =
    APPROVAL_STATUS_LABEL_FA[approval?.status ?? ""] ?? approval?.status ?? "";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        className="w-[var(--drawer-width)] max-w-[var(--drawer-width)] gap-0 overflow-y-auto p-0"
        onEscapeKeyDown={() => onOpenChange(false)}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusReturnRef.current?.focus();
        }}
      >
        <SheetHeader className="border-b border-hairline">
          <SheetTitle>
            {approval
              ? `${approval.requirementCode} — ${approval.teamLabel}`
              : "جزئیات مجوز"}
          </SheetTitle>
          <SheetDescription>
            {approval ? statusLabel : null}
          </SheetDescription>
          {approval ? (
            <div className="space-y-2 pt-1">
              <dl
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                aria-label="خلاصهٔ ظرفیت مجوز"
              >
                <div>
                  <dt className="text-muted-foreground text-xs">مصوب</dt>
                  <dd className="text-tabular font-medium">
                    {toPersianDigits(String(approval.allowedCount))}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">مصرف‌شده</dt>
                  <dd className="text-tabular font-medium">
                    {toPersianDigits(String(approval.used))}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">رزرو</dt>
                  <dd className="text-tabular font-medium">
                    {toPersianDigits(String(approval.reserved))}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">آزاد</dt>
                  <dd className="text-tabular font-medium">
                    {toPersianDigits(String(approval.free))}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <GlossaryTerm termKey="headcountApprovalLifecycle" />
                <GlossaryTerm termKey="headcountApproved" />
                <GlossaryTerm termKey="headcountUsed" />
                <GlossaryTerm termKey="reservation" />
                <GlossaryTerm termKey="headcountFree" />
              </div>
            </div>
          ) : null}
        </SheetHeader>

        <Panel className="flex-1 px-4">
          {sectionError ? (
            <FeedbackMessage kind="error" className="my-3">
              {sectionError}
            </FeedbackMessage>
          ) : null}

          <PanelSection title="معافیت‌ها" titleId={`${formId}-exemptions`}>
            <p className="text-caption text-muted-foreground mb-2">
              معافیت‌ها به انتصاب اصلی وابسته‌اند (نه به شناسهٔ مجوز). فهرست
              سراسری معافیت‌هاست؛ هویت این مجوز فقط در هدر drawer است.
            </p>
            <div className="mb-3">
              <GlossaryTerm termKey="headcountExemption" />
            </div>
            {exemptionsQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : exemptionsQuery.isError ? (
              <FeedbackMessage kind="error">
                {exemptionsQuery.error.message ||
                  "بارگذاری معافیت‌ها ناموفق بود."}
              </FeedbackMessage>
            ) : !exemptionsQuery.data?.length ? (
              <FeedbackMessage kind="empty">معافیتی ثبت نشده است.</FeedbackMessage>
            ) : (
              <ul className="space-y-3" role="list">
                {exemptionsQuery.data.map((row) => (
                  <li
                    key={row.id}
                    className="border-border space-y-1 rounded-md border px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill
                        label={
                          EXEMPTION_STATUS_LABEL_FA[row.status] ?? row.status
                        }
                        token={
                          EXEMPTION_STATUS_CLASS[row.status] ??
                          "status-badge-draft"
                        }
                      />
                      <span className="text-sm font-medium">{row.policyCode}</span>
                      <span className="text-muted-foreground text-xs">
                        {TREATMENT_LABEL_FA[row.reportingTreatment] ??
                          row.reportingTreatment}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">{row.reason}</p>
                    <p className="text-muted-foreground text-xs" dir="ltr">
                      {formatJalaliDisplayFromGregorian(row.validityStart)} →{" "}
                      {formatJalaliDisplayFromGregorian(row.validityEndExclusive)}
                    </p>
                    <TechnicalDetailDisclosure
                      value={row.primaryAssignmentId}
                      valueLabelFa="شناسهٔ فنی انتصاب اصلی"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.status === "draft" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === row.id}
                          disabledReason={operationalCopy.actionPending}
                          onClick={() => {
                            setBusyId(row.id);
                            activateExemption.mutate({ id: row.id });
                          }}
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
                          onClick={() => {
                            setBusyId(row.id);
                            revokeExemption.mutate({ id: row.id });
                          }}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {showExemptionForm ? (
              <div ref={exemptionFormRef} className="mt-4 space-y-3">
                <form
                  className="grid gap-3 sm:grid-cols-1"
                  onSubmit={onCreateExemption}
                  noValidate
                >
                  <label className="space-y-1 text-sm">
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
                      disabledReasonFa={
                        primaryAssignmentCascade.disabledReasonFa
                      }
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
                  <label className="space-y-1 text-sm">
                    <span id={`${formId}-reason`}>دلیل</span>
                    <Input
                      aria-labelledby={`${formId}-reason`}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <div className="space-y-1 text-sm">
                    <span>شروع اعتبار</span>
                    <JalaliDatePicker
                      aria-label="شروع اعتبار معافیت"
                      value={validityStart}
                      onChange={setValidityStart}
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <span>پایان اعتبار (اختصاصی)</span>
                    <JalaliDatePicker
                      aria-label="پایان اعتبار معافیت"
                      value={validityEnd}
                      onChange={setValidityEnd}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={createExemption.isPending}
                    disabledReason={operationalCopy.actionPending}
                  >
                    ثبت پیش‌نویس معافیت
                  </Button>
                </form>
              </div>
            ) : null}
          </PanelSection>

          <PanelSection title="بازنویسی‌ها" titleId={`${formId}-overrides`}>
            <p className="text-caption text-muted-foreground mb-2">
              فهرست ممیزی‌شدهٔ لغو محدودیت برای تیم این مجوز؛ صدور بازنویسی از
              مسیر رویداد است. «بازنویسی» همان مفهوم «لغو محدودیت» در پنل ظرفیت
              است.
            </p>
            <div className="mb-3">
              <GlossaryTerm termKey="headcountOverride" />
            </div>
            {overridesQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : overridesQuery.isError ? (
              <FeedbackMessage kind="error">
                {overridesQuery.error.message ||
                  "بارگذاری بازنویسی‌ها ناموفق بود."}
              </FeedbackMessage>
            ) : !scopedOverrides.length ? (
              <FeedbackMessage kind="empty">
                بازنویسی‌ای برای این تیم ثبت نشده است. ثبت بازنویسی از مسیر
                نهایی‌سازی رویداد انجام می‌شود.
              </FeedbackMessage>
            ) : (
              <ul className="space-y-3" role="list">
                {scopedOverrides.map((row) => (
                  <li
                    key={row.id}
                    className="border-border space-y-1 rounded-md border px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill
                        label={
                          OVERRIDE_STATUS_LABEL_FA[row.status] ?? row.status
                        }
                        token={
                          OVERRIDE_STATUS_CLASS[row.status] ??
                          "status-badge-draft"
                        }
                      />
                      <span className="text-sm font-medium">
                        {RULE_LABEL_FA[row.violatedRule] ?? row.violatedRule}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">{row.reason}</p>
                    {row.status === "active" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="mt-2"
                        disabled={busyId === row.id}
                        disabledReason={operationalCopy.actionPending}
                        onClick={() => {
                          setBusyId(row.id);
                          voidOverride.mutate({ id: row.id });
                        }}
                      >
                        ابطال
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </PanelSection>

          <PanelSection
            title="بازسازی تاریخی"
            titleId={`${formId}-historical`}
            className="last:border-b-0"
          >
            <HistoricalOrgHeadcountForeshadow
              initialTeam={initialTeam}
              embedded
            />
          </PanelSection>
        </Panel>

        <SheetFooter>
          <Button type="button" variant="secondary" onClick={focusExemptionForm}>
            افزودن معافیت
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            بستن
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
