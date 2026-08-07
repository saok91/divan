"use client";

import * as React from "react";
import { Search } from "lucide-react";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { normalizeDigitsForMatch } from "@/lib/persian-digits";
import { cn } from "@/lib/utils";

import { EntityToken } from "./entity-token";
import type {
  EntityPickerOption,
  EntityPickerSearchFn,
  EntityPickerValue,
} from "./types";

const DEFAULT_DEBOUNCE_MS = 200;
const EMPTY_COPY_FA = "نتیجه‌ای یافت نشد.";
const LOADING_COPY_FA = "در حال جستجو…";

export type EntityPickerProps = {
  id?: string;
  /** Async search — receives digit-normalized query (may be empty). */
  search: EntityPickerSearchFn;
  value: EntityPickerValue;
  onValueChange: (next: EntityPickerValue) => void;
  disabled?: boolean;
  /** Persian reason when disabled or after cascade clear (FR58 / UX-DR30). */
  disabledReasonFa?: string;
  /** Popover header scope note (caption). */
  scopeNoteFa?: string;
  placeholder?: string;
  debounceMs?: number;
  /** Optional create-on-empty slot — wire only; no create UI in 8.3. */
  emptyCreateAction?: () => void;
  /**
   * Override empty list + live-region copy (Story 11.7).
   * Default keeps search-miss tone for unrelated surfaces.
   */
  emptyCopyFa?: string;
  className?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
};

function formatPrimaryLine(opt: EntityPickerOption): React.ReactNode {
  if (opt.code) {
    return (
      <>
        <span className="text-primary" dir="ltr">
          «{opt.code}
        </span>
        <span className="text-foreground"> — {opt.labelFa}»</span>
      </>
    );
  }
  return <span className="text-foreground">{opt.labelFa}</span>;
}

/**
 * Async combobox for business-code / name entity selection (Story 8.3).
 * Focus stays on the input; options use aria-activedescendant (APG combobox).
 */
export function EntityPicker({
  id,
  search,
  value,
  onValueChange,
  disabled = false,
  disabledReasonFa,
  scopeNoteFa,
  placeholder = "جستجو با کد یا نام…",
  debounceMs = DEFAULT_DEBOUNCE_MS,
  emptyCreateAction,
  emptyCopyFa,
  className,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
}: EntityPickerProps) {
  const listboxId = React.useId();
  const liveId = React.useId();
  const reasonId = React.useId();
  const optionIdPrefix = React.useId();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const tokenWrapRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<EntityPickerOption[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);
  const [liveMessage, setLiveMessage] = React.useState("");
  const [focusInputAfterClear, setFocusInputAfterClear] = React.useState(false);
  const searchGen = React.useRef(0);
  const resolvedEmptyCopy = emptyCopyFa ?? EMPTY_COPY_FA;

  const describedBy =
    [ariaDescribedBy, disabledReasonFa ? reasonId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const runSearch = React.useCallback(
    async (raw: string) => {
      const normalized = normalizeDigitsForMatch(raw);
      const gen = ++searchGen.current;
      setLoading(true);
      try {
        const rows = await search(normalized);
        if (gen !== searchGen.current) return;
        setOptions(rows);
        setActiveIndex(rows.length > 0 ? 0 : -1);
        // Override is for expected empty (no query). Filtered miss + errors keep search-miss tone.
        const emptyCopy =
          normalized.length > 0 ? EMPTY_COPY_FA : resolvedEmptyCopy;
        setLiveMessage(
          rows.length === 0 ? emptyCopy : `${rows.length} نتیجه`,
        );
      } catch {
        if (gen !== searchGen.current) return;
        setOptions([]);
        setActiveIndex(-1);
        setLiveMessage(EMPTY_COPY_FA);
      } finally {
        if (gen === searchGen.current) setLoading(false);
      }
    },
    [search, resolvedEmptyCopy],
  );

  React.useEffect(() => {
    if (disabled) {
      setOptions([]);
      setQuery("");
      setOpen(false);
      setActiveIndex(-1);
      setLiveMessage("");
      setLoading(false);
      searchGen.current += 1;
      return;
    }
  }, [disabled]);

  React.useEffect(() => {
    if (!open || disabled || value) return;
    setLoading(true);
    const t = window.setTimeout(() => {
      void runSearch(query.trim());
    }, debounceMs);
    return () => window.clearTimeout(t);
  }, [query, open, disabled, value, debounceMs, runSearch]);

  React.useEffect(() => {
    if (!value && focusInputAfterClear) {
      inputRef.current?.focus();
      setFocusInputAfterClear(false);
    }
  }, [value, focusInputAfterClear]);

  const selectOption = (opt: EntityPickerOption) => {
    searchGen.current += 1;
    onValueChange(opt);
    setQuery("");
    setOptions([]);
    setOpen(false);
    setActiveIndex(-1);
    setLiveMessage("");
    setLoading(false);
    queueMicrotask(() => tokenWrapRef.current?.focus());
  };

  const clearSelection = () => {
    searchGen.current += 1;
    onValueChange(null);
    setQuery("");
    setOptions([]);
    setOpen(false);
    setActiveIndex(-1);
    setLiveMessage("");
    setLoading(false);
    setFocusInputAfterClear(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      if (options.length === 0) return;
      setActiveIndex((i) => (i + 1) % options.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (options.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
      return;
    }
    if (e.key === "Enter") {
      if (open && activeIndex >= 0 && options[activeIndex]) {
        e.preventDefault();
        selectOption(options[activeIndex]!);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (open) {
        setOpen(false);
        setOptions([]);
        setActiveIndex(-1);
      }
      return;
    }
  };

  const activeOptionId =
    open && activeIndex >= 0
      ? `${optionIdPrefix}-opt-${activeIndex}`
      : undefined;

  const reasonCaption = disabledReasonFa ? (
    <span id={reasonId} className="text-caption text-text-secondary">
      {disabledReasonFa}
    </span>
  ) : null;

  if (value) {
    return (
      <div
        className={cn("flex w-full flex-col gap-1", className)}
        data-slot="entity-picker"
      >
        <div
          ref={tokenWrapRef}
          id={id}
          role="combobox"
          tabIndex={disabled ? undefined : 0}
          aria-expanded={false}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-labelledby={ariaLabelledBy}
          aria-describedby={describedBy}
          aria-invalid={ariaInvalid}
          aria-required={ariaRequired}
          aria-disabled={disabled || undefined}
          title={disabled ? disabledReasonFa : undefined}
          className={cn(
            "flex h-control-height w-full items-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            disabled && "cursor-not-allowed",
          )}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Backspace" || e.key === "Delete") {
              e.preventDefault();
              clearSelection();
            }
          }}
        >
          <EntityToken
            option={value}
            onClear={disabled ? undefined : clearSelection}
            disabled={disabled}
          />
        </div>
        {reasonCaption}
      </div>
    );
  }

  return (
    <div
      className={cn("relative w-full", className)}
      data-slot="entity-picker"
    >
      <Popover
        open={open && !disabled}
        onOpenChange={(next) => {
          if (disabled) return;
          setOpen(next);
          if (!next) {
            setOptions([]);
            setActiveIndex(-1);
          }
        }}
      >
        <PopoverAnchor asChild>
          <div
            className={cn(
              "relative flex h-control-height w-full items-center rounded-sm border border-control-border bg-background",
              disabled && "bg-disabled-surface opacity-100",
            )}
          >
            <Search
              className="pointer-events-none absolute start-2.5 size-3.5 text-text-tertiary"
              aria-hidden
            />
            <input
              ref={inputRef}
              id={id}
              type="text"
              role="combobox"
              aria-expanded={open && !disabled}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-labelledby={ariaLabelledBy}
              aria-describedby={describedBy}
              aria-invalid={ariaInvalid}
              aria-required={ariaRequired}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              title={disabled ? disabledReasonFa : undefined}
              autoComplete="off"
              placeholder={placeholder}
              value={query}
              className={cn(
                "h-full w-full min-w-0 bg-transparent pe-3 ps-8 text-body outline-none placeholder:text-muted-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                disabled && "cursor-not-allowed text-disabled-foreground",
              )}
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                if (!disabled) setOpen(true);
              }}
              onKeyDown={onKeyDown}
              onFocus={() => {
                if (!disabled) setOpen(true);
              }}
            />
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] overflow-hidden rounded-sm border border-control-border bg-popover p-0 text-popover-foreground shadow-[0_6px_18px_rgba(5,16,97,0.13)]"
        >
          {scopeNoteFa ? (
            <div className="border-b border-hairline px-3 py-1.5 text-caption text-text-secondary">
              {scopeNoteFa}
            </div>
          ) : null}

          <ul
            id={listboxId}
            className="max-h-60 overflow-y-auto py-1"
            role="listbox"
          >
            {loading && options.length === 0 ? (
              <li className="px-3 py-2 text-caption text-text-secondary" role="presentation">
                {LOADING_COPY_FA}
              </li>
            ) : null}
            {!loading && options.length === 0 && liveMessage ? (
              <li className="px-3 py-2 text-caption text-text-secondary" role="presentation">
                {liveMessage}
                {emptyCreateAction ? (
                  <button
                    type="button"
                    className="ms-2 text-primary underline-offset-2 hover:underline"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => emptyCreateAction()}
                  >
                    ایجاد
                  </button>
                ) : null}
              </li>
            ) : null}
            {options.map((opt, index) => {
              const active = index === activeIndex;
              return (
                <li
                  key={opt.id}
                  id={`${optionIdPrefix}-opt-${index}`}
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "cursor-pointer px-3 py-1.5 text-body-medium",
                    active &&
                      "bg-selection-tint shadow-[inset_2px_0_0_var(--primary)]",
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    // Prevent input blur before click registers.
                    e.preventDefault();
                  }}
                  onClick={() => selectOption(opt)}
                >
                  <div className="text-body-medium">{formatPrimaryLine(opt)}</div>
                  {opt.secondaryFa ? (
                    <div className="text-caption text-text-secondary">
                      {opt.secondaryFa}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2 border-t border-hairline px-3 py-1.5 text-caption text-text-tertiary">
            <kbd className="rounded-sm bg-keycap-background px-1">↑↓</kbd>
            <span>حرکت</span>
            <kbd className="rounded-sm bg-keycap-background px-1">Enter</kbd>
            <span>انتخاب</span>
            <kbd className="rounded-sm bg-keycap-background px-1">Esc</kbd>
            <span>بستن</span>
          </div>
        </PopoverContent>
      </Popover>

      <div id={liveId} className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>

      {reasonCaption ? <div className="mt-1">{reasonCaption}</div> : null}
    </div>
  );
}
