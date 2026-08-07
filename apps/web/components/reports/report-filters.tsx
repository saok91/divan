"use client";

import * as React from "react";

import {
  EntityPicker,
  createOrgUnitSearch,
  type EntityPickerValue,
} from "@/components/entity-picker";
import { LabelWithHelp, FILTER_FIELD_LABEL_CLASS } from "@/components/form-layout";
import {
  JalaliDatePicker,
  type JalaliDatePickerHandle,
} from "@/components/jalali-date-picker";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const filterSelectClass = cn(
  "flex h-control-height w-full rounded-md border border-input bg-background px-3",
  "text-body text-foreground",
);

const filterSubmitClass = cn(
  "inline-flex h-control-height items-center justify-center rounded-md px-4",
  "bg-primary text-primary-foreground text-field-label",
  "disabled:opacity-50",
);

export type ReportFilterState = {
  teamId: string;
  evaluationMode: "current" | "as_of";
  asOfDate: string | undefined;
  rangeStart: string | undefined;
  rangeEnd: string | undefined;
};

export type ReportFiltersProps = {
  value: ReportFilterState;
  onApply: (next: ReportFilterState) => void;
  disabled?: boolean;
  /** Primary submit label — workspace uses «اجرا» (Story 9.5). */
  submitLabel?: string;
};

/**
 * Shared org + time/as-of + Effective-Date range filters for report runs.
 * Applying re-queries the active report via one filter identity object.
 * Range is optional for snapshot reports; event keys require it server-side.
 */
export function ReportFilters({
  value,
  onApply,
  disabled,
  submitLabel = "اعمال فیلتر",
}: ReportFiltersProps) {
  const formId = React.useId();
  const asOfRef = React.useRef<JalaliDatePickerHandle>(null);
  const rangeStartRef = React.useRef<JalaliDatePickerHandle>(null);
  const rangeEndRef = React.useRef<JalaliDatePickerHandle>(null);

  const [team, setTeam] = React.useState<EntityPickerValue>(
    value.teamId
      ? { id: value.teamId, code: "", labelFa: "تیم فیلتر" }
      : null,
  );
  const [evaluationMode, setEvaluationMode] = React.useState(
    value.evaluationMode,
  );
  const [asOfDate, setAsOfDate] = React.useState(value.asOfDate);
  const [rangeStart, setRangeStart] = React.useState(value.rangeStart);
  const [rangeEnd, setRangeEnd] = React.useState(value.rangeEnd);
  const [formError, setFormError] = React.useState<string | null>(null);

  const orgUnitSearch = React.useMemo(() => createOrgUnitSearch(), []);
  const parentTeamId = value.teamId.trim();
  const teamHydrate = api.organization.get.useQuery(
    { id: parentTeamId },
    { enabled: Boolean(parentTeamId), retry: false },
  );

  React.useEffect(() => {
    if (!parentTeamId) {
      setTeam(null);
      return;
    }
    setTeam((prev) =>
      prev?.id === parentTeamId
        ? prev
        : { id: parentTeamId, code: "", labelFa: "تیم فیلتر" },
    );
  }, [parentTeamId]);

  React.useEffect(() => {
    if (
      !parentTeamId ||
      !teamHydrate.data ||
      teamHydrate.data.id !== parentTeamId
    ) {
      return;
    }
    setTeam((prev) => {
      if (prev?.id !== parentTeamId) return prev;
      return {
        id: teamHydrate.data.id,
        code: teamHydrate.data.code,
        labelFa: teamHydrate.data.nameFa,
      };
    });
  }, [parentTeamId, teamHydrate.data]);

  React.useEffect(() => {
    setEvaluationMode(value.evaluationMode);
    setAsOfDate(value.asOfDate);
    setRangeStart(value.rangeStart);
    setRangeEnd(value.rangeEnd);
  }, [
    value.evaluationMode,
    value.asOfDate,
    value.rangeStart,
    value.rangeEnd,
  ]);

  const asOfHelpId = `${formId}-asof-help`;
  const rangeStartHelpId = `${formId}-range-start-help`;
  const teamHelpId = `${formId}-team-help`;

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        let nextAsOf = asOfDate;
        if (evaluationMode === "as_of") {
          const committed = asOfRef.current?.commit();
          if (committed && !committed.ok) {
            setFormError(operationalCopy.reportFilterInvalid);
            return;
          }
          if (committed?.ok) nextAsOf = committed.value;
        }
        const startCommit = rangeStartRef.current?.commit();
        if (startCommit && !startCommit.ok) {
          setFormError(operationalCopy.reportFilterInvalid);
          return;
        }
        const endCommit = rangeEndRef.current?.commit();
        if (endCommit && !endCommit.ok) {
          setFormError(operationalCopy.reportFilterInvalid);
          return;
        }

        const nextStart = startCommit?.ok ? startCommit.value : rangeStart;
        const nextEnd = endCommit?.ok ? endCommit.value : rangeEnd;
        const startTrim = nextStart?.trim() ?? "";
        const endTrim = nextEnd?.trim() ?? "";

        if ((startTrim && !endTrim) || (!startTrim && endTrim)) {
          setFormError(operationalCopy.reportFilterInvalid);
          return;
        }
        if (startTrim && endTrim && startTrim > endTrim) {
          setFormError(operationalCopy.reportFilterInvalid);
          return;
        }
        if (evaluationMode === "as_of" && !nextAsOf?.trim()) {
          setFormError(operationalCopy.reportFilterInvalid);
          return;
        }

        onApply({
          teamId: team?.id?.trim() ?? "",
          evaluationMode,
          asOfDate:
            evaluationMode === "as_of"
              ? nextAsOf?.trim() || undefined
              : undefined,
          rangeStart: startTrim || undefined,
          rangeEnd: endTrim || undefined,
        });
      }}
    >
      <div className="min-w-[10rem] space-y-1.5">
        <label htmlFor={`${formId}-mode`} className={FILTER_FIELD_LABEL_CLASS}>
          حالت زمانی
        </label>
        <select
          id={`${formId}-mode`}
          value={evaluationMode}
          disabled={disabled}
          onChange={(e) =>
            setEvaluationMode(e.target.value as "current" | "as_of")
          }
          className={filterSelectClass}
        >
          <option value="current">جاری</option>
          <option value="as_of">مبنا (as-of)</option>
        </select>
      </div>

      {evaluationMode === "as_of" ? (
        <div className="min-w-[14rem] space-y-1.5">
          <LabelWithHelp
            htmlFor={`${formId}-asof`}
            help="الزامی در حالت مبنا"
            helpLabel="راهنمای تاریخ مبنا"
            helpId={asOfHelpId}
          >
            تاریخ مبنا
          </LabelWithHelp>
          <JalaliDatePicker
            ref={asOfRef}
            id={`${formId}-asof`}
            aria-label="تاریخ مبنا برای گزارش"
            aria-describedby={asOfHelpId}
            value={asOfDate}
            onChange={setAsOfDate}
            disabled={disabled}
            helperText=""
          />
        </div>
      ) : null}

      <div className="min-w-[14rem] space-y-1.5">
        <LabelWithHelp
          htmlFor={`${formId}-range-start`}
          help="برای گزارش‌های رویدادی الزامی"
          helpLabel="راهنمای شروع بازه"
          helpId={rangeStartHelpId}
        >
          شروع بازه
        </LabelWithHelp>
        <JalaliDatePicker
          ref={rangeStartRef}
          id={`${formId}-range-start`}
          aria-label="شروع بازه گزارش"
          aria-describedby={rangeStartHelpId}
          value={rangeStart}
          onChange={setRangeStart}
          disabled={disabled}
          helperText=""
        />
      </div>

      <div className="min-w-[14rem] space-y-1.5">
        <label
          htmlFor={`${formId}-range-end`}
          className={FILTER_FIELD_LABEL_CLASS}
        >
          پایان بازه
        </label>
        <JalaliDatePicker
          ref={rangeEndRef}
          id={`${formId}-range-end`}
          aria-label="پایان بازه گزارش"
          value={rangeEnd}
          onChange={setRangeEnd}
          disabled={disabled}
          helperText=""
        />
      </div>

      <div className="min-w-[16rem] flex-1 space-y-1.5">
        <LabelWithHelp
          htmlFor={`${formId}-team`}
          help={operationalCopy.reportTeamFilterHint}
          helpLabel="راهنمای تیم (اختیاری)"
          helpId={teamHelpId}
        >
          تیم (اختیاری)
        </LabelWithHelp>
        <EntityPicker
          id={`${formId}-team`}
          search={orgUnitSearch}
          value={team}
          onValueChange={setTeam}
          disabled={disabled}
          scopeNoteFa="واحدهای سازمانی قابل‌مشاهده — برای اعضای تیم الزامی"
          placeholder="کد یا نام تیم…"
          aria-describedby={teamHelpId}
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        title={disabled ? operationalCopy.reportCatalogueBusy : undefined}
        aria-description={
          disabled ? operationalCopy.reportCatalogueBusy : undefined
        }
        className={filterSubmitClass}
      >
        {submitLabel}
      </button>

      {formError ? (
        <FeedbackMessage kind="error" className="w-full">
          {formError}
        </FeedbackMessage>
      ) : null}
    </form>
  );
}
