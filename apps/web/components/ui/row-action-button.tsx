"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type RowActionButtonBase = {
  /** Persian accessible name — also shown in the tooltip. Required; no escape hatch. */
  label: string;
  icon: LucideIcon;
  /** Required when enabled — FR-58 / LG-6 forbid inert activation. */
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};

export type RowActionButtonProps = RowActionButtonBase &
  (
    | { disabled?: false; disabledReason?: undefined }
    | { disabled: true; disabledReason: string }
    /** Dynamic disable (e.g. busy flag) — reason still required. */
    | { disabled: boolean; disabledReason: string }
  );

/**
 * Icon-only outlined row action (UX-DR30 / DESIGN `row-action-button`).
 * Always stopPropagation so GovernedDataTable `onRowClick` does not fire.
 * Expects an ambient TooltipProvider, or use `RowActionButton` which supplies one.
 */
export function RowActionButtonInner({
  label,
  icon: Icon,
  onClick,
  className,
  disabled,
  disabledReason,
}: RowActionButtonProps) {
  if (!label?.trim()) {
    throw new Error("RowActionButton: label is required (non-empty)");
  }
  if (disabled && !disabledReason?.trim()) {
    throw new Error(
      `RowActionButton "${label}": disabledReason is required when disabled`,
    );
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled) return;
    onClick(event);
  };

  return (
    <span className="inline-flex shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="rowAction"
            size="xs"
            aria-label={label}
            disabled={disabled}
            disabledReason={disabled ? disabledReason : undefined}
            className={cn(
              "size-control-height-xs min-w-control-height-xs px-0",
              className,
            )}
            onClick={handleClick}
          >
            <Icon className="size-3" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {label}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

/**
 * Standalone row action — supplies its own TooltipProvider (delay 0).
 * Prefer `RowActionCluster` in tables so one provider covers the action strip.
 */
export function RowActionButton(props: RowActionButtonProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <RowActionButtonInner {...props} />
    </TooltipProvider>
  );
}
