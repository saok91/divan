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
  jalaliMonthStartWeekday,
  jalaliToGregorian,
  jalaliWeekdayLabels,
  parseGregorianDateOnly,
  parseJalaliInput,
  parseTimeInput,
  todayJalaliInTehran,
  type JalaliDateOnly,
} from "@/lib/jalali";
import { toPersianDigits } from "@/lib/persian-digits";
import { cn } from "@/lib/utils";

type BasePickerProps = {
  id?: string;
  /** Accessible purpose label, e.g. «تاریخ مؤثر». */
  "aria-label": string;
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
  const length = jalaliMonthLength(view.jy, view.jm);
  const startPad = jalaliMonthStartWeekday(view.jy, view.jm);
  const cells: Array<number | null> = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = chunkRows(cells, 7);

  const initialFocus =
    selected?.jy === view.jy && selected?.jm === view.jm ? selected.jd : 1;
  const [focusDay, setFocusDay] = React.useState(initialFocus);
  const safeFocusDay = Math.min(Math.max(1, focusDay), length);
  const focusRef = React.useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = React.useRef(false);

  React.useLayoutEffect(() => {
    if (!restoreFocusRef.current) return;
    focusRef.current?.focus();
    restoreFocusRef.current = false;
  }, [view.jy, view.jm, safeFocusDay]);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="ماه بعد"
          onClick={() => onViewChange(addJalaliMonths(view, 1))}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
        <p className="text-body-medium text-foreground">
          {jalaliMonthName(view.jm)}{" "}
          <span className="text-tabular">{toPersianDigits(view.jy)}</span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="ماه قبل"
          onClick={() => onViewChange(addJalaliMonths(view, -1))}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
      </div>

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

/**
 * Effective Date control — date-only Jalali entry + popover calendar.
 */
export function JalaliDatePicker({
  id,
  "aria-label": ariaLabel,
  value,
  onChange,
  disabled,
  className,
  error,
  helperText = "فقط تاریخ مؤثر (بدون ساعت)",
}: JalaliDatePickerProps) {
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
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const commitTyped = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setInvalid(false);
      setDraft(null);
      onChange?.(undefined);
      return;
    }
    const j = parseJalaliInput(trimmed);
    if (!j) {
      setInvalid(true);
      return;
    }
    const g = jalaliToGregorian(j);
    if (!g) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(null);
    setView(j);
    onChange?.(formatGregorianDateOnly(g));
  };

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
    <div className={cn("space-y-1.5", className)}>
      <div className="flex gap-2">
        <Input
          id={fieldId}
          className="rounded-sm text-tabular"
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
              variant="outline"
              size="icon"
              disabled={disabled}
              aria-label={`${ariaLabel} — باز کردن تقویم`}
              className="shrink-0 rounded-sm"
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
}

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
