"use client";

import * as React from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  addJalaliDays,
  addJalaliMonths,
  formatGregorianDateOnly,
  formatJalaliDisplay,
  gregorianToJalali,
  jalaliMonthLength,
  jalaliMonthName,
  jalaliMonthNames,
  jalaliMonthStartWeekday,
  jalaliToGregorian,
  jalaliWeekdayLabels,
  jalaliYearsAround,
  parseGregorianDateOnly,
  parseJalaliInput,
  parseTimeInput,
  setJalaliMonthYear,
  todayJalaliInTehran,
  type JalaliDateOnly,
} from "@/lib/jalali";
import { toPersianDigits } from "@/lib/persian-digits";
import { cn } from "@/lib/utils";

type BasePickerProps = {
  id?: string;
  /** Accessible purpose label, e.g. «تاریخ مؤثر». */
  "aria-label": string;
  /** Merged onto the date input with helper/error ids (FormField / label help). */
  "aria-describedby"?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
};

export type JalaliDatePickerProps = BasePickerProps & {
  /** Gregorian date-only `YYYY-MM-DD` (business Effective Date storage). */
  value?: string;
  onChange?: (value: string | undefined) => void;
  /** Helper text under the field (visually distinct modes). */
  helperText?: string;
};

export type JalaliDateTimePickerProps = BasePickerProps & {
  /**
   * Gregorian date-only + 24h time as `{ date: 'YYYY-MM-DD', time: 'HH:mm' }`.
   * Registration / finalization timestamps (FR44) — distinct from Effective Date.
   */
  value?: { date?: string; time?: string };
  onChange?: (value: { date?: string; time?: string }) => void;
  helperText?: string;
};

type DayGridPanel = "days" | "months" | "years";

function displayFromValue(value: string | undefined): string {
  const g = parseGregorianDateOnly(value);
  return g ? formatJalaliDisplay(gregorianToJalali(g)) : "";
}

function chunkRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function DayGrid({
  view,
  selected,
  onSelectDay,
  onViewChange,
}: {
  view: JalaliDateOnly;
  selected: JalaliDateOnly | null;
  onSelectDay: (day: JalaliDateOnly) => void;
  onViewChange: (next: JalaliDateOnly) => void;
}) {
  const listboxId = React.useId();
  const monthsListId = `${listboxId}-months`;
  const yearsListId = `${listboxId}-years`;
  const [panel, setPanel] = React.useState<DayGridPanel>("days");
  const length = jalaliMonthLength(view.jy, view.jm);
  const startPad = jalaliMonthStartWeekday(view.jy, view.jm);
  const cells: Array<number | null> = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = chunkRows(cells, 7);
  const monthNames = jalaliMonthNames();
  const yearOptions = jalaliYearsAround(view.jy);

  const initialFocus =
    selected?.jy === view.jy && selected?.jm === view.jm ? selected.jd : 1;
  const [focusDay, setFocusDay] = React.useState(initialFocus);
  const safeFocusDay = Math.min(Math.max(1, focusDay), length);
  const focusRef = React.useRef<HTMLButtonElement | null>(null);
  const optionFocusRef = React.useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = React.useRef(false);
  const [optionFocus, setOptionFocus] = React.useState(0);

  React.useLayoutEffect(() => {
    if (!restoreFocusRef.current || panel !== "days") return;
    focusRef.current?.focus();
    restoreFocusRef.current = false;
  }, [view.jy, view.jm, safeFocusDay, panel]);

  React.useLayoutEffect(() => {
    if (panel === "days") return;
    optionFocusRef.current?.focus();
    optionFocusRef.current?.scrollIntoView({ block: "nearest" });
  }, [panel, optionFocus]);

  const openMonths = () => {
    setOptionFocus(view.jm - 1);
    setPanel("months");
  };

  const openYears = () => {
    const idx = yearOptions.indexOf(view.jy);
    setOptionFocus(idx >= 0 ? idx : 0);
    setPanel("years");
  };

  const moveFocus = (delta: number) => {
    const next = addJalaliDays(
      { jy: view.jy, jm: view.jm, jd: safeFocusDay },
      delta,
    );
    restoreFocusRef.current = true;
    if (next.jm !== view.jm || next.jy !== view.jy) {
      onViewChange(next);
    }
    setFocusDay(next.jd);
  };

  const onGridKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(1);
        break;
      case "ArrowRight":
        event.preventDefault();
        moveFocus(-1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(-7);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveFocus(7);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onSelectDay({ jy: view.jy, jm: view.jm, jd: safeFocusDay });
        break;
      default:
        break;
    }
  };

  const moveOptionFocus = (delta: number, count: number) => {
    setOptionFocus((current) => {
      const next = current + delta;
      if (next < 0) return 0;
      if (next >= count) return count - 1;
      return next;
    });
  };

  const onOptionListKeyDown = (
    event: React.KeyboardEvent,
    count: number,
    columns: number,
    onCommit: (index: number) => void,
  ) => {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        moveOptionFocus(1, count);
        break;
      case "ArrowRight":
        event.preventDefault();
        moveOptionFocus(-1, count);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveOptionFocus(-columns, count);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveOptionFocus(columns, count);
        break;
      case "Home":
        event.preventDefault();
        setOptionFocus(0);
        break;
      case "End":
        event.preventDefault();
        setOptionFocus(count - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onCommit(optionFocus);
        break;
      default:
        break;
    }
  };

  const applyMonthYear = (jm: number, jy: number, nextPanel: DayGridPanel) => {
    const next = setJalaliMonthYear(view, jm, jy);
    onViewChange(next);
    setFocusDay(next.jd);
    if (nextPanel === "days") {
      restoreFocusRef.current = true;
      setPanel("days");
      return;
    }
    if (nextPanel === "months") {
      setOptionFocus(jm - 1);
      setPanel("months");
      return;
    }
    setPanel(nextPanel);
  };

  // Logical order: prev → title → next. Under dir=rtl, prev sits at
  // inline-start (right) and next at inline-end (left). ChevronRight on
  // prev / ChevronLeft on next mirrors LTR chrome so icons agree with action.
  // Prev/next only on days panel — hide while browsing month/year lists.
  const showMonthStep = panel === "days";
  const monthChrome = (
    <div className="flex items-center justify-between gap-2">
      {showMonthStep ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="ماه قبل"
          onClick={() => onViewChange(addJalaliMonths(view, -1))}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      ) : (
        <span className="size-8 shrink-0" aria-hidden="true" />
      )}
      <div className="flex min-w-0 items-center justify-center gap-1">
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-2 text-body-medium"
          aria-label="انتخاب ماه"
          aria-expanded={panel === "months"}
          aria-controls={panel === "months" ? monthsListId : undefined}
          onClick={() =>
            panel === "months" ? setPanel("days") : openMonths()
          }
        >
          {jalaliMonthName(view.jm)}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-2 text-body-medium text-tabular"
          aria-label="انتخاب سال"
          aria-expanded={panel === "years"}
          aria-controls={panel === "years" ? yearsListId : undefined}
          onClick={() => (panel === "years" ? setPanel("days") : openYears())}
        >
          {toPersianDigits(view.jy)}
        </Button>
      </div>
      {showMonthStep ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="ماه بعد"
          onClick={() => onViewChange(addJalaliMonths(view, 1))}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
      ) : (
        <span className="size-8 shrink-0" aria-hidden="true" />
      )}
    </div>
  );

  if (panel === "months") {
    return (
      <div className="space-y-3">
        {monthChrome}
        <div
          id={monthsListId}
          role="listbox"
          aria-label="فهرست ماه‌ها"
          className="grid grid-cols-3 gap-1"
          onKeyDown={(event) =>
            onOptionListKeyDown(event, 12, 3, (index) =>
              applyMonthYear(index + 1, view.jy, "days"),
            )
          }
        >
          {monthNames.map((name, index) => {
            const jm = index + 1;
            const isSelected = view.jm === jm;
            const isFocused = optionFocus === index;
            return (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={isFocused ? 0 : -1}
                ref={isFocused ? optionFocusRef : undefined}
                className={cn(
                  "rounded-sm px-2 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
                onClick={() => applyMonthYear(jm, view.jy, "days")}
                onFocus={() => setOptionFocus(index)}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (panel === "years") {
    return (
      <div className="space-y-3">
        {monthChrome}
        <div
          id={yearsListId}
          role="listbox"
          aria-label="فهرست سال‌ها"
          className="grid max-h-56 grid-cols-3 gap-1 overflow-y-auto"
          onKeyDown={(event) =>
            onOptionListKeyDown(event, yearOptions.length, 3, (index) => {
              const jy = yearOptions[index];
              if (jy == null) return;
              applyMonthYear(view.jm, jy, "months");
            })
          }
        >
          {yearOptions.map((jy, index) => {
            const isSelected = view.jy === jy;
            const isFocused = optionFocus === index;
            return (
              <button
                key={jy}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={isFocused ? 0 : -1}
                ref={isFocused ? optionFocusRef : undefined}
                className={cn(
                  "rounded-sm px-2 py-2 text-body text-tabular outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
                onClick={() => applyMonthYear(view.jm, jy, "months")}
                onFocus={() => setOptionFocus(index)}
              >
                {toPersianDigits(jy)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {monthChrome}

      <div
        role="grid"
        aria-label="تقویم جلالی"
        className="space-y-1"
        onKeyDown={onGridKeyDown}
      >
        <div role="row" className="grid grid-cols-7 gap-1">
          {jalaliWeekdayLabels().map((label) => (
            <div
              key={label}
              role="columnheader"
              className="py-1 text-center text-caption text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
        {rows.map((row, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            role="row"
            className="grid grid-cols-7 gap-1"
          >
            {row.map((day, colIndex) => {
              if (day === null) {
                return (
                  <div
                    key={`e-${rowIndex}-${colIndex}`}
                    role="gridcell"
                  />
                );
              }
              const isSelected =
                selected?.jy === view.jy &&
                selected?.jm === view.jm &&
                selected?.jd === day;
              const isFocused = safeFocusDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  ref={isFocused ? focusRef : undefined}
                  tabIndex={isFocused ? 0 : -1}
                  aria-selected={isSelected}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-sm text-body outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                  onClick={() =>
                    onSelectDay({ jy: view.jy, jm: view.jm, jd: day })
                  }
                  onFocus={() => setFocusDay(day)}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export type JalaliDatePickerHandle = {
  /**
   * Flush any typed draft into `onChange`.
   * Returns `{ ok: false }` when the draft is invalid (caller should block submit).
   * On success, `value` is the committed Gregorian date-only (or undefined if cleared).
   */
  commit: () => { ok: true; value: string | undefined } | { ok: false };
};

/**
 * Effective Date control — date-only Jalali entry + popover calendar.
 */
export const JalaliDatePicker = React.forwardRef<
  JalaliDatePickerHandle,
  JalaliDatePickerProps
>(function JalaliDatePicker(
  {
    id,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    value,
    onChange,
    disabled,
    className,
    error,
    helperText = "فقط تاریخ مؤثر (بدون ساعت)",
  },
  ref,
) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;
  const [draft, setDraft] = React.useState<string | null>(null);
  const [invalid, setInvalid] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [announce, setAnnounce] = React.useState("");

  const display = draft ?? displayFromValue(value);
  const selected = React.useMemo(() => {
    const g = parseGregorianDateOnly(value);
    return g ? gregorianToJalali(g) : null;
  }, [value]);

  const [view, setView] = React.useState<JalaliDateOnly>(
    () => selected ?? todayJalaliInTehran(),
  );

  const showError = Boolean(error) || invalid;
  const errorMessage =
    error ?? (invalid ? "تاریخ واردشده معتبر نیست" : undefined);
  const describedBy =
    [
      showError ? errorId : null,
      helperText ? helperId : null,
      ariaDescribedBy,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const commitTyped = (raw: string): string | undefined | false => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setInvalid(false);
      setDraft(null);
      onChange?.(undefined);
      return undefined;
    }
    const j = parseJalaliInput(trimmed);
    if (!j) {
      setInvalid(true);
      return false;
    }
    const g = jalaliToGregorian(j);
    if (!g) {
      setInvalid(true);
      return false;
    }
    setInvalid(false);
    setDraft(null);
    setView(j);
    const formatted = formatGregorianDateOnly(g);
    onChange?.(formatted);
    return formatted;
  };

  React.useImperativeHandle(ref, () => ({
    commit: () => {
      if (draft === null) {
        if (invalid) return { ok: false };
        return { ok: true, value };
      }
      const result = commitTyped(display);
      if (result === false) return { ok: false };
      return { ok: true, value: result };
    },
  }));

  const selectDay = (j: JalaliDateOnly) => {
    const g = jalaliToGregorian(j);
    if (!g) return;
    setInvalid(false);
    setDraft(null);
    setView(j);
    onChange?.(formatGregorianDateOnly(g));
    setAnnounce(`تاریخ انتخاب‌شده: ${formatJalaliDisplay(j)}`);
    setOpen(false);
  };

  return (
    <div className={cn((helperText || showError) && "space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <Input
          id={fieldId}
          className="h-control-height rounded-sm text-tabular"
          value={display}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={showError || undefined}
          aria-describedby={describedBy}
          placeholder={toPersianDigits("۱۴۰۵/۰۱/۰۱")}
          onChange={(event) => {
            setDraft(toPersianDigits(event.target.value));
            setInvalid(false);
          }}
          onBlur={() => commitTyped(display)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitTyped(display);
            }
          }}
        />
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (next) setView(selected ?? todayJalaliInTehran());
            setOpen(next);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="tertiary"
              size="icon"
              disabled={disabled}
              aria-label={`${ariaLabel} — باز کردن تقویم`}
              className="size-control-height shrink-0 rounded-sm"
            >
              <CalendarIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto rounded-lg p-3"
            onEscapeKeyDown={() => setOpen(false)}
          >
            <DayGrid
              view={view}
              selected={selected}
              onSelectDay={selectDay}
              onViewChange={setView}
            />
          </PopoverContent>
        </Popover>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
      {helperText ? (
        <p id={helperId} className="text-caption text-muted-foreground">
          {helperText}
        </p>
      ) : null}
      {showError && errorMessage ? (
        <p id={errorId} className="text-caption text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
});

/**
 * Registration / finalization control — date + time, visually distinct from Effective Date.
 */
export function JalaliDateTimePicker({
  id,
  "aria-label": ariaLabel,
  value,
  onChange,
  disabled,
  className,
  error,
  helperText = "تاریخ و ساعت ثبت / نهایی‌سازی",
}: JalaliDateTimePickerProps) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const dateId = `${fieldId}-date`;
  const timeId = `${fieldId}-time`;
  const timeHelperId = `${fieldId}-time-helper`;
  const timeErrorId = `${fieldId}-time-error`;

  const [timeDraft, setTimeDraft] = React.useState<string | null>(null);
  const [timeInvalid, setTimeInvalid] = React.useState(false);

  const timeDisplay =
    timeDraft ?? (value?.time ? toPersianDigits(value.time) : "");

  const commitTime = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setTimeInvalid(false);
      setTimeDraft(null);
      onChange?.({ date: value?.date, time: undefined });
      return;
    }
    const parsed = parseTimeInput(trimmed);
    if (!parsed) {
      setTimeInvalid(true);
      return;
    }
    setTimeInvalid(false);
    setTimeDraft(null);
    onChange?.({ date: value?.date, time: parsed });
  };

  const timeDescribedBy =
    [
      timeInvalid ? timeErrorId : null,
      timeHelperId,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border border-dashed border-primary/40 bg-muted/30 p-3",
        className,
      )}
    >
      <p className="text-caption text-primary">{helperText}</p>
      <JalaliDatePicker
        id={dateId}
        aria-label={ariaLabel}
        value={value?.date}
        disabled={disabled}
        error={error}
        helperText="بخش تاریخ"
        onChange={(date) =>
          onChange?.({
            date,
            time: date ? (value?.time ?? "00:00") : undefined,
          })
        }
      />
      <div className="space-y-1.5">
        <label htmlFor={timeId} className="text-caption text-muted-foreground">
          ساعت (۲۴ ساعته)
        </label>
        <Input
          id={timeId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="max-w-[10rem] rounded-sm text-tabular"
          value={timeDisplay}
          disabled={disabled}
          aria-label={`${ariaLabel} — ساعت`}
          aria-invalid={timeInvalid || undefined}
          aria-describedby={timeDescribedBy}
          placeholder={toPersianDigits("۰۹:۳۰")}
          onChange={(event) => {
            setTimeDraft(toPersianDigits(event.target.value));
            setTimeInvalid(false);
          }}
          onBlur={() => commitTime(timeDisplay)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitTime(timeDisplay);
            }
          }}
        />
        <p id={timeHelperId} className="text-caption text-muted-foreground">
          متمایز از تاریخ مؤثر — شامل زمان ثبت (مثلاً{" "}
          {toPersianDigits("۰۹:۳۰")})
        </p>
        {timeInvalid ? (
          <p
            id={timeErrorId}
            className="text-caption text-destructive"
            role="alert"
          >
            ساعت واردشده معتبر نیست
          </p>
        ) : null}
      </div>
    </div>
  );
}
