"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { EntityPickerOption } from "./types";

export type EntityTokenProps = {
  option: EntityPickerOption;
  onClear?: () => void;
  clearLabelFa?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Selected-value chip for entity-picker (DESIGN entity-token).
 * Clear is dismiss chrome — not a primary CTA.
 */
export function EntityToken({
  option,
  onClear,
  clearLabelFa = "پاک کردن انتخاب",
  className,
  disabled,
}: EntityTokenProps) {
  return (
    <span
      data-slot="entity-token"
      className={cn(
        "inline-flex h-control-height-xs max-w-full items-center gap-1.5 rounded-sm border border-selection-tint-border bg-selection-tint pe-0.5 ps-2 text-caption",
        className,
      )}
    >
      {option.code ? (
        <span className="shrink-0 text-primary text-identifier" dir="ltr">
          {option.code}
        </span>
      ) : null}
      <span className="min-w-0 truncate text-foreground">{option.labelFa}</span>
      {onClear && !disabled ? (
        <button
          type="button"
          data-slot="entity-token-clear"
          aria-label={clearLabelFa}
          className="inline-flex size-control-height-xs shrink-0 items-center justify-center rounded-sm text-text-secondary hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClear();
          }}
          onMouseDown={(e) => {
            // Keep focus on picker input when clearing from within form rows.
            e.preventDefault();
          }}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
