"use client";

import { cn } from "@/lib/utils";

export type StatusBadgeKind =
  | "Scheduled"
  | "Effective"
  | "Cancelled"
  | "Reversed"
  | "Draft"
  | "Override"
  | "Exception";

const LABELS_FA: Record<StatusBadgeKind, string> = {
  Scheduled: "زمان‌بندی‌شده",
  Effective: "مؤثر",
  Cancelled: "لغوشده",
  Reversed: "بازگشت‌خورده",
  Draft: "پیش‌نویس",
  Override: "لغو محدودیت",
  Exception: "استثنا",
};

const TOKEN_CLASS: Record<StatusBadgeKind, string> = {
  Scheduled: "status-badge-scheduled",
  Effective: "status-badge-effective",
  Cancelled: "status-badge-cancelled",
  Reversed: "status-badge-reversed",
  Draft: "status-badge-draft",
  Override: "status-badge-override",
  Exception: "status-badge-reversed",
};

const STATUS_BADGE_KINDS = new Set<string>(Object.keys(LABELS_FA));

export function isStatusBadgeKind(value: string): value is StatusBadgeKind {
  return STATUS_BADGE_KINDS.has(value);
}

/**
 * UX-DR10 status badge — pill; badge text is the sole status announcement.
 * Decorative dot is aria-hidden.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: StatusBadgeKind;
  className?: string;
}) {
  const label = LABELS_FA[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TOKEN_CLASS[status],
        className,
      )}
    >
      <span
        className="size-1.5 shrink-0 rounded-full bg-current opacity-70"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function statusBadgeLabelFa(status: StatusBadgeKind): string {
  return LABELS_FA[status];
}
