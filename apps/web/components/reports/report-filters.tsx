"use client";

import * as React from "react";

import {
  JalaliDatePicker,
  type JalaliDatePickerHandle,
} from "@/components/jalali-date-picker";
import { Input } from "@/components/ui/input";
import { operationalCopy } from "@/lib/operational-copy";
import { cn } from "@/lib/utils";

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
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Shared org + time/as-of + Effective-Date range filters for report runs.
 * Applying re-queries the active report via one filter identity object.
 * Range is optional for snapshot reports; event keys require it server-side.
 */
export function ReportFilters({
  value,
  onApply,
  disabled,
}: ReportFiltersProps) {
  const formId = React.useId();
  const asOfRef = React.useRef<JalaliDatePickerHandle>(null);
  const rangeStartRef = React.useRef<JalaliDatePickerHandle>(null);
  const rangeEndRef = React.useRef<JalaliDatePickerHandle>(null);

  const [teamId, setTeamId] = React.useState(value.teamId);
  const [evaluationMode, setEvaluationMode] = React.useState(
    value.evaluationMode,
  );
  const [asOfDate, setAsOfDate] = React.useState(value.asOfDate);
  const [rangeStart, setRangeStart] = React.useState(value.rangeStart);
  const [rangeEnd, setRangeEnd] = React.useState(value.rangeEnd);
  const [formError, setFormError] = React.useState<string | null>(null);

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

        const teamTrim = teamId.trim();
        if (teamTrim && !UUID_RE.test(teamTrim)) {
          setFormError(operationalCopy.reportFilterInvalid);
          return;
        }

        onApply({
          teamId: teamTrim,
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
        <label htmlFor={`${formId}-mode`} className="text-label">
          حالت زمانی
        </label>
        <select
          id={`${formId}-mode`}
          value={evaluationMode}
          disabled={disabled}
          onChange={(e) =>
            setEvaluationMode(e.target.value as "current" | "as_of")
          }
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3",
            "text-body text-foreground",
          )}
        >
          <option value="current">جاری</option>
          <option value="as_of">مبنا (as-of)</option>
        </select>
      </div>

      {evaluationMode === "as_of" ? (
        <div className="min-w-[14rem] space-y-1.5">
          <label htmlFor={`${formId}-asof`} className="text-label">
            تاریخ مبنا
          </label>
          <JalaliDatePicker
            ref={asOfRef}
            id={`${formId}-asof`}
            aria-label="تاریخ مبنا برای گزارش"
            value={asOfDate}
            onChange={setAsOfDate}
            disabled={disabled}
            helperText="الزامی در حالت مبنا"
          />
        </div>
      ) : null}

      <div className="min-w-[14rem] space-y-1.5">
        <label htmlFor={`${formId}-range-start`} className="text-label">
          شروع بازه
        </label>
        <JalaliDatePicker
          ref={rangeStartRef}
          id={`${formId}-range-start`}
          aria-label="شروع بازه گزارش"
          value={rangeStart}
          onChange={setRangeStart}
          disabled={disabled}
          helperText="برای گزارش‌های رویدادی الزامی"
        />
      </div>

      <div className="min-w-[14rem] space-y-1.5">
        <label htmlFor={`${formId}-range-end`} className="text-label">
          پایان بازه
        </label>
        <JalaliDatePicker
          ref={rangeEndRef}
          id={`${formId}-range-end`}
          aria-label="پایان بازه گزارش"
          value={rangeEnd}
          onChange={setRangeEnd}
          disabled={disabled}
        />
      </div>

      <div className="min-w-[16rem] flex-1 space-y-1.5">
        <label htmlFor={`${formId}-team`} className="text-label">
          شناسه تیم (اختیاری)
        </label>
        <Input
          id={`${formId}-team`}
          value={teamId}
          disabled={disabled}
          onChange={(e) => setTeamId(e.target.value)}
          dir="ltr"
          autoComplete="off"
          placeholder="UUID — برای اعضای تیم الزامی"
        />
        <p className="text-caption text-muted-foreground">
          {operationalCopy.reportTeamFilterHint}
        </p>
      </div>

      <button
        type="submit"
        disabled={disabled}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-md px-4",
          "bg-primary text-primary-foreground text-label",
          "disabled:opacity-50",
        )}
      >
        اعمال فیلتر
      </button>

      {formError ? (
        <p role="alert" className="w-full text-body text-destructive">
          {formError}
        </p>
      ) : null}
    </form>
  );
}
