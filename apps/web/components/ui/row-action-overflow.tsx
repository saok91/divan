"use client";

import * as React from "react";
import { Ellipsis, type LucideIcon } from "lucide-react";

import { RowActionButtonInner } from "@/components/ui/row-action-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type RowActionItem = {
  id?: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  disabledReason?: string;
};

const OVERFLOW_LABEL = "اقدامات بیشتر";

function assertActionHonesty(action: RowActionItem, where: string): void {
  if (!action.label?.trim()) {
    throw new Error(`${where}: label is required (non-empty)`);
  }
  if (action.disabled && !action.disabledReason?.trim()) {
    throw new Error(
      `${where} "${action.label}": disabledReason is required when disabled`,
    );
  }
}

type RowActionOverflowProps = {
  items: RowActionItem[];
  /** Accessible name for the overflow trigger. Default: اقدامات بیشتر */
  label?: string;
  className?: string;
};

/**
 * Labelled overflow menu for row actions beyond the two primary icons.
 * Trigger is icon-only Ellipsis with aria-label + tooltip; menu items show Persian text.
 * Expects an ambient TooltipProvider (provided by RowActionCluster).
 */
export function RowActionOverflow({
  items,
  label = OVERFLOW_LABEL,
  className,
}: RowActionOverflowProps) {
  for (const item of items) {
    assertActionHonesty(item, "RowActionOverflow");
  }

  return (
    <DropdownMenu>
      <span className="inline-flex shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="rowAction"
                size="xs"
                aria-label={label}
                className={cn(
                  "size-control-height-xs min-w-control-height-xs px-0",
                  className,
                )}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <Ellipsis className="size-3" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {label}
          </TooltipContent>
        </Tooltip>
      </span>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onClick={(event) => event.stopPropagation()}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const disabled = Boolean(item.disabled);
          return (
            <DropdownMenuItem
              key={item.id ?? item.label}
              disabled={disabled}
              title={disabled ? item.disabledReason : undefined}
              onSelect={(event) => {
                event.stopPropagation();
                if (disabled) return;
                item.onSelect();
              }}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{item.label}</span>
              {disabled && item.disabledReason ? (
                <span className="sr-only">{item.disabledReason}</span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type RowActionClusterProps = {
  /** Ordered actions. First two render as icons; remainder go into overflow. */
  actions: RowActionItem[];
  className?: string;
};

/**
 * Renders ≤2 icon row actions; action #3+ collapse into a labelled overflow menu.
 * One TooltipProvider covers the whole strip (avoids per-button nesting under tables).
 */
export function RowActionCluster({ actions, className }: RowActionClusterProps) {
  if (actions.length === 0) return null;

  for (const action of actions) {
    assertActionHonesty(action, "RowActionCluster");
  }

  const visible = actions.slice(0, 2);
  const overflow = actions.slice(2);

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "inline-flex flex-nowrap items-center gap-1 shrink-0",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {visible.map((action) =>
          action.disabled ? (
            <RowActionButtonInner
              key={action.id ?? action.label}
              label={action.label}
              icon={action.icon}
              disabled
              disabledReason={action.disabledReason!}
              onClick={() => action.onSelect()}
            />
          ) : (
            <RowActionButtonInner
              key={action.id ?? action.label}
              label={action.label}
              icon={action.icon}
              onClick={() => action.onSelect()}
            />
          ),
        )}
        {overflow.length > 0 ? <RowActionOverflow items={overflow} /> : null}
      </div>
    </TooltipProvider>
  );
}
