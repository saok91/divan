"use client";

import {
  StatusBadge,
  isStatusBadgeKind,
  type StatusBadgeKind,
} from "@/components/personnel/status-badge";
import { PersonnelEventLifecycleControls } from "@/components/personnel/personnel-event-lifecycle-controls";
import {
  classifyEventOrigin,
  eventTypeLabelFa,
  formatChainLinksFa,
  formatProvenanceCaption,
  truncateActorLabel,
} from "@/lib/personnel-event-timeline";
import {
  formatJalaliDateTimeFromIso,
  formatJalaliDisplayFromGregorian,
} from "@/lib/jalali";
import { toPersianDigits } from "@/lib/persian-digits";
import { cn } from "@/lib/utils";

export type EventTimelineRowData = {
  event: {
    id: string;
    eventType: string;
    effectiveDate: string;
    registeredBy: string;
    registeredAt: string | Date;
    finalizedBy: string | null;
    finalizedAt: string | Date | null;
    referenceCode?: string | null;
    provenance?: Record<string, unknown> | null;
  };
  resolvedStatus: string;
  links: {
    cancellations: string[];
    reversals: string[];
    corrections: string[];
  };
};

type EventTimelineRowProps = {
  row: EventTimelineRowData;
  showSameDayRegistrationHint: boolean;
  canCancel: boolean;
  canReverse: boolean;
  canCorrect: boolean;
  /** Story 9.7 — `?event=` focus ring / aria-current. */
  highlighted?: boolean;
  onLifecycleSuccess?: () => void;
};

function toIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

/**
 * One timeline row — type, Jalali Effective Date, actor+time, StatusBadge,
 * provenance, chain links, lifecycle actions (Story 5.3 / UX-DR9; Story 6.3 FR-39).
 */
export function EventTimelineRow({
  row,
  showSameDayRegistrationHint,
  canCancel,
  canReverse,
  canCorrect,
  highlighted = false,
  onLifecycleSuccess,
}: EventTimelineRowProps) {
  const badge: StatusBadgeKind = isStatusBadgeKind(row.resolvedStatus)
    ? row.resolvedStatus
    : "Effective";

  const effectiveJalali = formatJalaliDisplayFromGregorian(
    row.event.effectiveDate,
  );
  const registeredIso = toIso(row.event.registeredAt);
  const registeredCaption = formatJalaliDateTimeFromIso(registeredIso);
  const finalizedCaption = formatJalaliDateTimeFromIso(
    toIso(row.event.finalizedAt),
  );
  const chainHint = formatChainLinksFa(row.links);
  const origin = classifyEventOrigin({
    eventType: row.event.eventType,
    provenance: row.event.provenance,
  });
  const provenanceCaption = formatProvenanceCaption({
    eventType: row.event.eventType,
    provenance: row.event.provenance,
    referenceCode: row.event.referenceCode,
  });

  return (
    <li
      id={`event-${row.event.id}`}
      tabIndex={highlighted ? -1 : undefined}
      aria-current={highlighted ? "true" : undefined}
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4 last:border-b-0 outline-none",
        highlighted &&
          "rounded-md ring-2 ring-accent ring-offset-2 ring-offset-background",
      )}
      data-origin={origin}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={badge} />
          <span className="text-body font-medium">
            {eventTypeLabelFa(row.event.eventType)}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          تاریخ مؤثر:{" "}
          <span dir="ltr">{toPersianDigits(effectiveJalali || "—")}</span>
        </p>

        <p className="text-xs text-muted-foreground">
          ثبت: {truncateActorLabel(row.event.registeredBy)}
          {registeredCaption ? (
            <>
              {" · "}
              <span dir="ltr">{registeredCaption}</span>
            </>
          ) : null}
        </p>

        {showSameDayRegistrationHint && registeredCaption ? (
          <p className="text-xs text-muted-foreground">
            مرتب‌سازی هم‌روز بر اساس زمان ثبت:{" "}
            <span dir="ltr">{registeredCaption}</span>
          </p>
        ) : null}

        {row.event.finalizedBy || finalizedCaption ? (
          <p className="text-xs text-muted-foreground">
            نهایی‌سازی: {truncateActorLabel(row.event.finalizedBy)}
            {finalizedCaption ? (
              <>
                {" · "}
                <span dir="ltr">{finalizedCaption}</span>
              </>
            ) : null}
          </p>
        ) : null}

        {provenanceCaption ? (
          <p
            className="text-xs text-muted-foreground"
            dir="auto"
            data-origin={origin}
          >
            {provenanceCaption}
          </p>
        ) : null}

        {chainHint ? (
          <p className="text-xs text-muted-foreground">زنجیره: {chainHint}</p>
        ) : null}
      </div>

      <PersonnelEventLifecycleControls
        eventId={row.event.id}
        resolvedStatus={row.resolvedStatus}
        canCancel={canCancel}
        canReverse={canReverse}
        canCorrect={canCorrect}
        onSuccess={onLifecycleSuccess}
      />
    </li>
  );
}

