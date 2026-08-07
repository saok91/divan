"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Shared filter/form-bar label line — fixed height so controls share one baseline. */
export const FILTER_FIELD_LABEL_CLASS =
  "flex h-5 min-h-5 items-center gap-1 text-field-label text-text-primary";

export type FieldHelpIconProps = {
  /** Help body shown in the tooltip (and optionally mirrored for aria-describedby). */
  content: React.ReactNode;
  /**
   * Persian accessible name for the info control — required; never empty.
   * Tooltip content supplements this; it does not replace it.
   */
  label: string;
  /** Stable id for a visually hidden help node / control `aria-describedby`. */
  contentId?: string;
  className?: string;
};

/**
 * Compact label-adjacent field help (Story 11.4 / FR-58 / UX-DR7).
 * Opens on hover and keyboard focus via Radix Tooltip. Quiet ghost icon at
 * toolbar/filter size — distinct from GlossaryTerm and row-action chrome.
 */
export function FieldHelpIcon({
  content,
  label,
  contentId,
  className,
}: FieldHelpIconProps) {
  if (!label?.trim()) {
    throw new Error("FieldHelpIcon: label is required (non-empty Persian aria-label)");
  }
  if (typeof content === "string" && !content.trim()) {
    return null;
  }
  if (content == null || content === false) {
    return null;
  }

  return (
    <span
      data-slot="field-help"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center",
        className,
      )}
    >
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-label={label.trim()}
              className="size-4 min-h-4 min-w-4 p-0 text-text-tertiary hover:bg-muted hover:text-text-primary"
              onClick={(event) => {
                // Keep filter/form submit paths undisturbed; focus still opens tooltip.
                event.preventDefault();
              }}
            >
              <Info className="size-3.5" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4} className="max-w-xs">
            {content}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {contentId ? (
        <span id={contentId} className="sr-only">
          {content}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Label text + compact field-help icon in one fixed-height row (filter bars).
 * Icon is a sibling of `<label>` (same as FormField) so help text does not
 * pollute the control's accessible name and icon clicks do not activate it.
 */
export function LabelWithHelp({
  htmlFor,
  children,
  help,
  helpLabel,
  helpId,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  help: React.ReactNode;
  /** Persian aria-label for the info icon. */
  helpLabel: string;
  helpId?: string;
  className?: string;
}) {
  return (
    <div className={cn(FILTER_FIELD_LABEL_CLASS, className)}>
      <label htmlFor={htmlFor} className="text-field-label text-text-primary">
        {children}
      </label>
      <FieldHelpIcon label={helpLabel} content={help} contentId={helpId} />
    </div>
  );
}
