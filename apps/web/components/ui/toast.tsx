"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Background-work toast channel (UX-DR39 / Story 8.8).
 *
 * HARD RULE: toast is illegal for ordinary form/row save or finalize.
 * Those stay inline at the origin. Toast is only for background jobs
 * (import execute, export/artifact jobs, long recompute) and must carry
 * a link back to the work when a destination exists.
 *
 * One channel per event — do not also fire an inline success celebration
 * for the same background result.
 *
 * Optimistic nothing: call only after the server confirms success.
 */

export type BackgroundToastInput = {
  message: string;
  href?: string;
  hrefLabel?: string;
};

type ToastItem = BackgroundToastInput & {
  id: string;
};

type ToastListener = (items: ToastItem[]) => void;

const TOAST_TTL_MS = 8_000;

let items: ToastItem[] = [];
const listeners = new Set<ToastListener>();
const dismissTimers = new Map<string, number>();

function emit() {
  for (const listener of listeners) {
    listener(items);
  }
}

function clearDismissTimer(id: string) {
  const timer = dismissTimers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }
}

function dismiss(id: string) {
  clearDismissTimer(id);
  items = items.filter((t) => t.id !== id);
  emit();
}

/**
 * Show a background-work toast after server confirmation.
 * Do not use for form/row save — use FeedbackMessage / inline status instead.
 */
export function toastBackground(input: BackgroundToastInput): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  items = [...items, { ...input, id }];
  emit();
  if (typeof window !== "undefined") {
    clearDismissTimer(id);
    dismissTimers.set(
      id,
      window.setTimeout(() => dismiss(id), TOAST_TTL_MS),
    );
  }
  return id;
}

function subscribe(listener: ToastListener): () => void {
  listeners.add(listener);
  listener(items);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Single toast host — mount once under authenticated app chrome.
 * Host stays mounted (empty queue included) so the live region is stable for AT.
 */
export function Toaster({ className }: { className?: string }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => subscribe(setToasts), []);

  React.useEffect(() => {
    return () => {
      for (const id of [...dismissTimers.keys()]) {
        clearDismissTimer(id);
      }
    };
  }, []);

  return (
    <div
      data-slot="toaster"
      className={cn(
        // RTL: bottom-start = bottom-right visually in LTR terms when dir=rtl
        "pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-start gap-2 px-4",
        className,
      )}
      aria-live="polite"
      aria-relevant="additions"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-slot="toast"
          className="pointer-events-auto animate-toast-slide max-w-md rounded-md border border-border bg-background px-4 py-3 text-body-medium text-foreground shadow-md"
        >
          <p>{toast.message}</p>
          {toast.href ? (
            <Link
              href={toast.href}
              className="mt-1 inline-block text-caption text-primary underline-offset-4 hover:underline"
            >
              {toast.hrefLabel ?? "مشاهده کار"}
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}
