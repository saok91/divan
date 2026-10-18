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

export type DashboardFilterState = {
  teamId: string;
  evaluationMode: "current" | "as_of";
  asOfDate: string | undefined;
  trendRangeStart: string | undefined;
  trendRangeEnd: string | undefined;
  trendGranularity: "daily" | "monthly";
};

export type DashboardFiltersProps = {
  value: DashboardFilterState;
  onApply: (next: DashboardFilterState) => void;
  disabled?: boolean;
};

/**
 * Shared org + time/as-of + trend range filters.
 * Applying re-queries all cards via one snapshot input object.
 */
export function DashboardFilters({
  value,
  onApply,
  disabled,
}: DashboardFiltersProps) {
  const formId = React.useId();
  const asOfRef = React.useRef<JalaliDatePickerHandle>(null);
  const rangeStartRef = React.useRef<JalaliDatePickerHandle>(null);
  const rangeEndRef = React.useRef<JalaliDatePickerHandle>(null);

  const [draftTeam, setTeam] = React.useState<EntityPickerValue>(
    value.teamId
      ? { id: value.teamId, code: "", labelFa: "تیم فیلتر" }
      : null,
  );
  const [evaluationMode, setEvaluationMode] = React.useState(
    value.evaluationMode,
  );
  const [asOfDate, setAsOfDate] = React.useState(value.asOfDate);
  const [trendRangeStart, setTrendRangeStart] = React.useState(
    value.trendRangeStart,
  );
  const [trendRangeEnd, setTrendRangeEnd] = React.useState(value.trendRangeEnd);
  const [trendGranularity, setTrendGranularity] = React.useState(
    value.trendGranularity,
  );
  const [formError, setFormError] = React.useState<string | null>(null);

  const orgUnitSearch = React.useMemo(() => createOrgUnitSearch(), []);
  const parentTeamId = value.teamId.trim();
  const teamHydrate = api.organization.get.useQuery(
    { id: parentTeamId },
    { enabled: Boolean(parentTeamId), retry: false },
  );

  const incomingKey = JSON.stringify(value);
  const [previousIncomingKey, setPreviousIncomingKey] = React.useState(incomingKey);
  if (incomingKey !== previousIncomingKey) {
    setPreviousIncomingKey(incomingKey);
    setTeam(parentTeamId ? { id: parentTeamId, code: "", labelFa: "تیم فیلتر" } : null);
    setEvaluationMode(value.evaluationMode);
    setAsOfDate(value.asOfDate);
    setTrendRangeStart(value.trendRangeStart);
    setTrendRangeEnd(value.trendRangeEnd);
    setTrendGranularity(value.trendGranularity);
  }
  const team = draftTeam?.id === teamHydrate.data?.id && teamHydrate.data
    ? { id: teamHydrate.data.id, code: teamHydrate.data.code, labelFa: teamHydrate.data.nameFa }
    : draftTeam;

  const asOfHelpId = `${formId}-asof-help`;
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
            setFormError(operationalCopy.dashboardFilterInvalid);
            return;
          }
          if (committed?.ok) nextAsOf = committed.value;
        }
        const startCommit = rangeStartRef.current?.commit();
        if (startCommit && !startCommit.ok) {
          setFormError(operationalCopy.dashboardFilterInvalid);
          return;
        }
        const endCommit = rangeEndRef.current?.commit();
        if (endCommit && !endCommit.ok) {
          setFormError(operationalCopy.dashboardFilterInvalid);
          return;
        }

        const nextStart = startCommit?.ok
          ? startCommit.value
          : trendRangeStart;
        const nextEnd = endCommit?.ok ? endCommit.value : trendRangeEnd;

        if (!nextStart?.trim() || !nextEnd?.trim()) {
          setFormError(operationalCopy.dashboardFilterInvalid);
          return;
        }
        if (evaluationMode === "as_of" && !nextAsOf?.trim()) {
          setFormError(operationalCopy.dashboardFilterInvalid);
          return;
        }

        onApply({
          teamId: team?.id?.trim() ?? "",
          evaluationMode,
          asOfDate:
            evaluationMode === "as_of" ? nextAsOf?.trim() || undefined : undefined,
          trendRangeStart: nextStart.trim(),
          trendRangeEnd: nextEnd.trim(),
          trendGranularity,
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
            aria-label="تاریخ مبنا برای داشبورد"
            aria-describedby={asOfHelpId}
            value={asOfDate}
            onChange={setAsOfDate}
            disabled={disabled}
            helperText=""
          />
        </div>
      ) : null}

      <div className="min-w-[14rem] space-y-1.5">
        <label
          htmlFor={`${formId}-range-start`}
          className={FILTER_FIELD_LABEL_CLASS}
        >
          شروع بازه روند
        </label>
        <JalaliDatePicker
          ref={rangeStartRef}
          id={`${formId}-range-start`}
          aria-label="شروع بازه روند"
          value={trendRangeStart}
          onChange={setTrendRangeStart}
          disabled={disabled}
          helperText=""
        />
      </div>

      <div className="min-w-[14rem] space-y-1.5">
        <label
          htmlFor={`${formId}-range-end`}
          className={FILTER_FIELD_LABEL_CLASS}
        >
          پایان بازه روند
        </label>
        <JalaliDatePicker
          ref={rangeEndRef}
          id={`${formId}-range-end`}
          aria-label="پایان بازه روند"
          value={trendRangeEnd}
          onChange={setTrendRangeEnd}
          disabled={disabled}
          helperText=""
        />
      </div>

      <div className="min-w-[10rem] space-y-1.5">
        <label
          htmlFor={`${formId}-granularity`}
          className={FILTER_FIELD_LABEL_CLASS}
        >
          دانه‌بندی روند
        </label>
        <select
          id={`${formId}-granularity`}
          value={trendGranularity}
          disabled={disabled}
          onChange={(e) =>
            setTrendGranularity(e.target.value as "daily" | "monthly")
          }
          className={filterSelectClass}
        >
          <option value="monthly">ماهانه</option>
          <option value="daily">روزانه</option>
        </select>
      </div>

      <div className="min-w-[16rem] flex-1 space-y-1.5">
        <LabelWithHelp
          htmlFor={`${formId}-team`}
          help={operationalCopy.dashboardTeamFilterHint}
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
          scopeNoteFa="واحدهای سازمانی قابل‌مشاهده — خالی = همه تیم‌ها"
          placeholder="کد یا نام تیم…"
          aria-describedby={teamHelpId}
        />
      </div>

      <button type="submit" disabled={disabled} className={filterSubmitClass}>
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
