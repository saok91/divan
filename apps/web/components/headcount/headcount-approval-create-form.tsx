"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  EntityPicker,
  createJobTitleSearch,
  createOrgUnitSearch,
  type EntityPickerValue,
} from "@/components/entity-picker";
import {
  FormField,
  FormFooter,
  FormLayout,
  FormSection,
} from "@/components/form-layout";
import { JalaliDatePicker } from "@/components/jalali-date-picker";
import { useLeaveGuardOptional, useLeaveGuardRegistration } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";

type SubmitIntent = "draft" | "activate";

/**
 * Full approval creation form on «ایجاد» tab (Story 9.4 / 11.6).
 * Dual CTA: draft-only or create-then-activate (never INSERT as Active).
 */
export function HeadcountApprovalCreateForm() {
  const formId = React.useId();
  const router = useRouter();
  const leaveGuard = useLeaveGuardOptional();
  const intentRef = React.useRef<SubmitIntent>("draft");
  const [pendingIntent, setPendingIntent] = React.useState<SubmitIntent | null>(
    null,
  );
  const [pendingDraftId, setPendingDraftId] = React.useState<string | null>(
    null,
  );
  const [requirementCode, setRequirementCode] = React.useState("");
  const [team, setTeam] = React.useState<EntityPickerValue>(null);
  const [jobTitle, setJobTitle] = React.useState<EntityPickerValue>(null);
  const [allowedCount, setAllowedCount] = React.useState("1");
  const [validityStart, setValidityStart] = React.useState<string | undefined>();
  const [validityEnd, setValidityEnd] = React.useState<string | undefined>();
  const [approvalReference, setApprovalReference] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);
  const [offerListNav, setOfferListNav] = React.useState(false);

  const utils = api.useUtils();
  const teamsQuery = api.organization.list.useQuery({ includeInactive: false });

  const teamIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const u of teamsQuery.data ?? []) {
      if (u.unitType === "TEAM") set.add(u.id);
    }
    return set;
  }, [teamsQuery.data]);

  const baseOrgSearch = React.useMemo(() => createOrgUnitSearch(), []);
  const teamSearch = React.useMemo(
    () => async (normalizedQuery: string) => {
      const opts = await baseOrgSearch(normalizedQuery);
      if (teamIds.size === 0) return [];
      return opts.filter((o) => teamIds.has(o.id));
    },
    [baseOrgSearch, teamIds],
  );
  const jobTitleSearch = React.useMemo(() => createJobTitleSearch(), []);

  const dirty =
    requirementCode.trim() !== "" ||
    team != null ||
    jobTitle != null ||
    allowedCount.trim() !== "1" ||
    Boolean(validityStart) ||
    Boolean(validityEnd) ||
    approvalReference.trim() !== "";

  const clearFields = React.useCallback(() => {
    setRequirementCode("");
    setTeam(null);
    setJobTitle(null);
    setAllowedCount("1");
    setValidityStart(undefined);
    setValidityEnd(undefined);
    setApprovalReference("");
  }, []);

  const resetForm = React.useCallback(() => {
    clearFields();
    setFormError(null);
    setFormSuccess(null);
    setOfferListNav(false);
    setPendingIntent(null);
    setPendingDraftId(null);
  }, [clearFields]);

  useLeaveGuardRegistration({
    id: "headcount-approval-create-form",
    isDirty: dirty,
    onDiscard: resetForm,
  });

  const createMutation = api.headcount.createApproval.useMutation();
  const activateMutation = api.headcount.activateApproval.useMutation();

  function navigateCapacity() {
    const href = "/headcount/capacity";
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
      return;
    }
    router.push(href);
  }

  async function invalidateApprovalsList() {
    try {
      await utils.headcount.listApprovals.invalidate();
    } catch {
      // Keep success / partial-failure UI; list may stay stale until next nav.
    }
  }

  function validate():
    | {
        requirementCode: string;
        teamId: string;
        jobTitleId: string;
        allowedCount: number;
        validityStart: string;
        validityEndExclusive: string;
        approvalReference: string | null;
      }
    | null {
    setFormError(null);
    setFormSuccess(null);
    setOfferListNav(false);
    const teamId = team?.id?.trim() ?? "";
    const jobTitleId = jobTitle?.id?.trim() ?? "";
    const allowedRaw = allowedCount.trim();
    if (!requirementCode.trim() || !teamId || !jobTitleId) {
      setFormError("کد نیازمندی، تیم و عنوان شغلی الزامی است.");
      return null;
    }
    if (!teamIds.has(teamId)) {
      setFormError("فقط واحد سازمانی از نوع تیم قابل انتخاب است.");
      return null;
    }
    if (!/^\d+$/.test(allowedRaw)) {
      setFormError("سقف مجاز باید عدد صحیح غیرمنفی باشد.");
      return null;
    }
    const allowed = Number.parseInt(allowedRaw, 10);
    if (!Number.isInteger(allowed) || allowed < 0) {
      setFormError("سقف مجاز باید عدد صحیح غیرمنفی باشد.");
      return null;
    }
    if (!validityStart || !validityEnd) {
      setFormError("بازه اعتبار الزامی است.");
      return null;
    }
    if (validityEnd <= validityStart) {
      setFormError("پایان اعتبار باید بعد از شروع اعتبار باشد.");
      return null;
    }
    return {
      requirementCode: requirementCode.trim(),
      teamId,
      jobTitleId,
      allowedCount: allowed,
      validityStart,
      validityEndExclusive: validityEnd,
      approvalReference: approvalReference.trim() || null,
    };
  }

  function activateFailureMessage(err: unknown): string {
    const detail =
      err instanceof Error && err.message ? err.message : "خطای نامشخص";
    return `پیش‌نویس ثبت شد اما فعال‌سازی نشد: ${detail}. می‌توانید دوباره تلاش کنید یا از جدول هدکانت فعال کنید.`;
  }

  async function completeActivated(id: string) {
    await activateMutation.mutateAsync({ id });
    clearFields();
    setPendingDraftId(null);
    setFormError(null);
    setFormSuccess("مجوز ظرفیت فعال شد.");
    setOfferListNav(true);
    await invalidateApprovalsList();
  }

  async function runSubmit(intent: SubmitIntent) {
    const input = validate();
    if (!input) return;

    setPendingIntent(intent);
    setPendingDraftId(null);
    try {
      const created = await createMutation.mutateAsync(input);
      if (intent === "draft") {
        clearFields();
        setFormSuccess("پیش‌نویس مجوز ظرفیت ثبت شد.");
        setOfferListNav(true);
        await invalidateApprovalsList();
        return;
      }

      try {
        await completeActivated(created.id);
      } catch (activateErr) {
        setPendingDraftId(created.id);
        setFormError(activateFailureMessage(activateErr));
        setOfferListNav(true);
        await invalidateApprovalsList();
      }
    } catch (createErr) {
      setFormSuccess(null);
      setOfferListNav(false);
      setPendingDraftId(null);
      setFormError(
        createErr instanceof Error && createErr.message
          ? createErr.message
          : "ثبت مجوز ناموفق بود.",
      );
    } finally {
      setPendingIntent(null);
    }
  }

  async function retryActivate() {
    if (!pendingDraftId) return;
    setFormError(null);
    setFormSuccess(null);
    setPendingIntent("activate");
    try {
      await completeActivated(pendingDraftId);
    } catch (activateErr) {
      setFormError(activateFailureMessage(activateErr));
      setOfferListNav(true);
      await invalidateApprovalsList();
    } finally {
      setPendingIntent(null);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pendingDraftId) return;
    void runSubmit(intentRef.current);
  }

  const busy =
    pendingIntent != null ||
    createMutation.isPending ||
    activateMutation.isPending;
  const teamsPending = teamsQuery.isLoading;
  const teamsFailed = teamsQuery.isError;
  const awaitingActivateRetry = pendingDraftId != null;
  const teamPickerDisabled =
    busy || teamsPending || teamsFailed || awaitingActivateRetry;
  const submitDisabled =
    busy || teamsPending || teamsFailed || awaitingActivateRetry;
  const submitDisabledReason = awaitingActivateRetry
    ? "پیش‌نویس ثبت شده؛ فعال‌سازی را دوباره تلاش کنید یا به فهرست بروید."
    : teamsPending
      ? "در حال بارگذاری تیم‌ها…"
      : teamsFailed
        ? "بارگذاری تیم‌ها ناموفق بود."
        : operationalCopy.actionPending;

  const activatePendingLabel =
    pendingIntent === "activate"
      ? createMutation.isPending
        ? "در حال ثبت…"
        : "در حال فعال‌سازی…"
      : "ثبت و فعال‌سازی";

  return (
    <FormLayout aria-labelledby={`${formId}-title`}>
      <header className="space-y-1">
        <h2 id={`${formId}-title`} className="text-heading">
          ایجاد مجوز ظرفیت
        </h2>
        <p className="text-caption text-text-secondary">
          مجوز را به‌صورت پیش‌نویس ثبت کنید، یا همین‌جا ثبت و فعال‌سازی کنید.
          پیش‌نویس تا فعال‌سازی قابل‌مصرف نیست؛ در صورت نیاز، مسیر جایگزین در
          جدول هدکانت هم در دسترس است.
        </p>
      </header>

      <form className="space-y-form-section-gap" onSubmit={onSubmit} noValidate>
        <FormSection title="مشخصات مجوز" titleId={`${formId}-section`}>
          <FormField
            label="کد نیازمندی"
            htmlFor={`${formId}-code`}
            required
          >
            <Input
              id={`${formId}-code`}
              value={requirementCode}
              onChange={(e) => setRequirementCode(e.target.value)}
              autoComplete="off"
              disabled={busy || awaitingActivateRetry}
            />
          </FormField>
          <FormField label="تیم" htmlFor={`${formId}-team`} required>
            <EntityPicker
              id={`${formId}-team`}
              search={teamSearch}
              value={team}
              onValueChange={setTeam}
              scopeNoteFa="فقط واحدهای نوع تیم"
              placeholder={
                teamsPending ? "در حال بارگذاری تیم‌ها…" : "کد یا نام تیم…"
              }
              aria-required
              disabled={teamPickerDisabled}
            />
          </FormField>
          <FormField label="عنوان شغلی" htmlFor={`${formId}-title`} required>
            <EntityPicker
              id={`${formId}-title`}
              search={jobTitleSearch}
              value={jobTitle}
              onValueChange={setJobTitle}
              scopeNoteFa="جستجو با کد یا نام عنوان شغلی"
              placeholder="کد یا نام عنوان شغلی…"
              aria-required
              disabled={busy || awaitingActivateRetry}
            />
          </FormField>
          <FormField label="سقف مجاز" htmlFor={`${formId}-allowed`} required>
            <Input
              id={`${formId}-allowed`}
              className="text-tabular"
              inputMode="numeric"
              value={allowedCount}
              onChange={(e) => setAllowedCount(e.target.value)}
              disabled={busy || awaitingActivateRetry}
            />
          </FormField>
          <FormField
            label="مرجع تصویب (اختیاری)"
            htmlFor={`${formId}-ref`}
          >
            <Input
              id={`${formId}-ref`}
              value={approvalReference}
              onChange={(e) => setApprovalReference(e.target.value)}
              disabled={busy || awaitingActivateRetry}
            />
          </FormField>
          <FormField label="شروع اعتبار" required>
            <JalaliDatePicker
              aria-label="شروع اعتبار مجوز ظرفیت"
              value={validityStart}
              onChange={setValidityStart}
              disabled={busy || awaitingActivateRetry}
            />
          </FormField>
          <FormField label="پایان اعتبار (انحصاری)" required>
            <JalaliDatePicker
              aria-label="پایان اعتبار انحصاری مجوز ظرفیت"
              value={validityEnd}
              onChange={setValidityEnd}
              disabled={busy || awaitingActivateRetry}
            />
          </FormField>
        </FormSection>

        {teamsFailed ? (
          <FeedbackMessage kind="error">
            {teamsQuery.error.message || "بارگذاری فهرست تیم‌ها ناموفق بود."}
          </FeedbackMessage>
        ) : null}
        {formError ? (
          <FeedbackMessage kind="error">{formError}</FeedbackMessage>
        ) : null}
        {formSuccess ? (
          <FeedbackMessage kind="success">{formSuccess}</FeedbackMessage>
        ) : null}

        <FormFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            disabledReason={operationalCopy.actionPending}
            onClick={() => navigateCapacity()}
          >
            انصراف
          </Button>
          <Button
            type="submit"
            variant="secondary"
            disabled={submitDisabled}
            disabledReason={submitDisabledReason}
            className="min-w-32"
            onClick={() => {
              intentRef.current = "draft";
            }}
          >
            {pendingIntent === "draft" ? "در حال ثبت…" : "ثبت پیش‌نویس"}
          </Button>
          <Button
            type="submit"
            disabled={submitDisabled}
            disabledReason={submitDisabledReason}
            className="min-w-32"
            onClick={() => {
              intentRef.current = "activate";
            }}
          >
            {activatePendingLabel}
          </Button>
          {awaitingActivateRetry ? (
            <Button
              type="button"
              disabled={busy}
              disabledReason={operationalCopy.actionPending}
              className="min-w-32"
              onClick={() => {
                void retryActivate();
              }}
            >
              {pendingIntent === "activate" && activateMutation.isPending
                ? "در حال فعال‌سازی…"
                : "تلاش مجدد فعال‌سازی"}
            </Button>
          ) : null}
          {offerListNav ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigateCapacity()}
            >
              بازگشت به هدکانت
            </Button>
          ) : null}
        </FormFooter>
      </form>
    </FormLayout>
  );
}
