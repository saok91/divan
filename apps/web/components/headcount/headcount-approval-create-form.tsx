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

/**
 * Full approval creation form on «ایجاد» tab (Story 9.4).
 * EntityPicker for team + job title; FormLayout 8.2 chrome.
 */
export function HeadcountApprovalCreateForm() {
  const formId = React.useId();
  const router = useRouter();
  const leaveGuard = useLeaveGuardOptional();
  const [requirementCode, setRequirementCode] = React.useState("");
  const [team, setTeam] = React.useState<EntityPickerValue>(null);
  const [jobTitle, setJobTitle] = React.useState<EntityPickerValue>(null);
  const [allowedCount, setAllowedCount] = React.useState("1");
  const [validityStart, setValidityStart] = React.useState<string | undefined>();
  const [validityEnd, setValidityEnd] = React.useState<string | undefined>();
  const [approvalReference, setApprovalReference] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);

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

  const resetForm = React.useCallback(() => {
    setRequirementCode("");
    setTeam(null);
    setJobTitle(null);
    setAllowedCount("1");
    setValidityStart(undefined);
    setValidityEnd(undefined);
    setApprovalReference("");
    setFormError(null);
    setFormSuccess(null);
  }, []);

  useLeaveGuardRegistration({
    id: "headcount-approval-create-form",
    isDirty: dirty,
    onDiscard: resetForm,
  });

  const createMutation = api.headcount.createApproval.useMutation({
    onSuccess: async () => {
      setRequirementCode("");
      setTeam(null);
      setJobTitle(null);
      setAllowedCount("1");
      setValidityStart(undefined);
      setValidityEnd(undefined);
      setApprovalReference("");
      setFormError(null);
      setFormSuccess("پیش‌نویس مجوز ظرفیت ثبت شد.");
      await utils.headcount.listApprovals.invalidate();
    },
    onError: (err) => {
      setFormSuccess(null);
      setFormError(err.message);
    },
  });

  function navigateCapacity() {
    const href = "/headcount/capacity";
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
      return;
    }
    router.push(href);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const teamId = team?.id?.trim() ?? "";
    const jobTitleId = jobTitle?.id?.trim() ?? "";
    const allowedRaw = allowedCount.trim();
    if (!requirementCode.trim() || !teamId || !jobTitleId) {
      setFormError("کد نیازمندی، تیم و عنوان شغلی الزامی است.");
      return;
    }
    if (!teamIds.has(teamId)) {
      setFormError("فقط واحد سازمانی از نوع تیم قابل انتخاب است.");
      return;
    }
    if (!/^\d+$/.test(allowedRaw)) {
      setFormError("سقف مجاز باید عدد صحیح غیرمنفی باشد.");
      return;
    }
    const allowed = Number.parseInt(allowedRaw, 10);
    if (!Number.isInteger(allowed) || allowed < 0) {
      setFormError("سقف مجاز باید عدد صحیح غیرمنفی باشد.");
      return;
    }
    if (!validityStart || !validityEnd) {
      setFormError("بازه اعتبار الزامی است.");
      return;
    }
    if (validityEnd <= validityStart) {
      setFormError("پایان اعتبار باید بعد از شروع اعتبار باشد.");
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
  }

  const busy = createMutation.isPending;
  const teamsPending = teamsQuery.isLoading;
  const teamsFailed = teamsQuery.isError;
  const teamPickerDisabled = busy || teamsPending || teamsFailed;

  return (
    <FormLayout aria-labelledby={`${formId}-title`}>
      <header className="space-y-1">
        <h2 id={`${formId}-title`} className="text-heading">
          ایجاد مجوز ظرفیت
        </h2>
        <p className="text-caption text-text-secondary">
          ثبت پیش‌نویس مجوز ظرفیت؛ فعال‌سازی از فهرست هدکانت انجام می‌شود.
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
              disabled={busy}
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
              disabled={busy}
            />
          </FormField>
          <FormField label="سقف مجاز" htmlFor={`${formId}-allowed`} required>
            <Input
              id={`${formId}-allowed`}
              className="text-tabular"
              inputMode="numeric"
              value={allowedCount}
              onChange={(e) => setAllowedCount(e.target.value)}
              disabled={busy}
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
              disabled={busy}
            />
          </FormField>
          <FormField label="شروع اعتبار" required>
            <JalaliDatePicker
              aria-label="شروع اعتبار مجوز ظرفیت"
              value={validityStart}
              onChange={setValidityStart}
              disabled={busy}
            />
          </FormField>
          <FormField label="پایان اعتبار (انحصاری)" required>
            <JalaliDatePicker
              aria-label="پایان اعتبار انحصاری مجوز ظرفیت"
              value={validityEnd}
              onChange={setValidityEnd}
              disabled={busy}
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
            disabled={busy || teamsPending || teamsFailed}
            disabledReason={
              teamsPending
                ? "در حال بارگذاری تیم‌ها…"
                : teamsFailed
                  ? "بارگذاری تیم‌ها ناموفق بود."
                  : operationalCopy.actionPending
            }
            className="min-w-32"
          >
            {busy ? "در حال ثبت…" : "ایجاد پیش‌نویس"}
          </Button>
          {formSuccess ? (
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
