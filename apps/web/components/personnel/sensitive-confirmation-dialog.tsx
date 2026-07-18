"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Sensitive confirmation dialog (UX-DR14) — Story 4.2 finalize gate.
 * Focus moves into dialog; Escape returns to trigger; blocked when confirmDisabled.
 */
export function SensitiveConfirmationDialog({
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel = "تأیید نهایی‌سازی",
  cancelLabel = "انصراف",
  confirmDisabled = false,
  blockedReason,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  consequence: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Block confirm when conflicts blocking / authz stale / recalc. */
  confirmDisabled?: boolean;
  blockedReason?: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
}) {
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => {
        const btn = document.querySelector<HTMLButtonElement>(
          '[data-confirm-primary="true"]',
        );
        btn?.focus();
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DialogHeader>
          <DialogTitle id={titleId}>{title}</DialogTitle>
          <DialogDescription id={descId} className="sr-only">
            تأیید عملیات حساس
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-foreground" role="region" aria-label="پیامد">
          {consequence}
          {blockedReason ? (
            <p role="alert" className="text-destructive">
              {blockedReason}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            data-confirm-primary="true"
            disabled={busy || confirmDisabled}
            aria-disabled={busy || confirmDisabled}
            onClick={() => {
              void onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConflictList({
  conflicts,
}: {
  conflicts: Array<{
    code: string;
    severity: "blocking" | "warning";
    messageFa: string;
  }>;
}) {
  if (conflicts.length === 0) return null;
  return (
    <ul
      className="space-y-2"
      role="list"
      aria-label="فهرست تعارض‌ها"
    >
      {conflicts.map((c) => (
        <li
          key={c.code}
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            c.severity === "blocking"
              ? "border-destructive/40 text-destructive"
              : "border-border text-foreground",
          )}
        >
          <span className="sr-only">
            {c.severity === "blocking" ? "مسدودکننده: " : "هشدار: "}
          </span>
          <span aria-live="polite">{c.messageFa}</span>
        </li>
      ))}
    </ul>
  );
}
