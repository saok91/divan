"use client";

import * as React from "react";

import { EventTimelineRow } from "@/components/personnel/event-timeline-row";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Skeleton } from "@/components/ui/skeleton";
import { operationalCopy } from "@/lib/operational-copy";
import {
  TIMELINE_EMPTY_COPY_FA,
  TIMELINE_LOAD_MORE_LABEL_FA,
  TIMELINE_MAX_LIMIT,
  TIMELINE_PAGE_SIZE,
  TIMELINE_TRUNCATED_COPY_FA,
  resolveTimelineBoundaryStatement,
  shouldShowSameDayRegistrationHint,
} from "@/lib/personnel-event-timeline";
import { formatJalaliDisplayFromGregorian } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";

const TIMELINE_LOAD_ERROR_FA =
  "بارگذاری گاه‌شمار رویدادها ممکن نشد. دوباره تلاش کنید.";
const LIFECYCLE_CAPS_LOAD_ERROR_FA =
  "بارگذاری مجوزهای چرخه رویداد ممکن نشد. عملیات چرخه موقتاً در دسترس نیست.";

type PersonnelEventTimelineProps = {
  personId: string;
  /** Story 9.7 — honor `?event=` with scroll + highlight. */
  focusEventId?: string;
};

function TimelineSkeleton() {
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label="در حال بارگذاری گاه‌شمار"
      data-slot="timeline-skeleton"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 border-b border-hairline pb-3 last:border-b-0"
        >
          <Skeleton className="mt-1 size-3 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function timelineErrorMessage(message: string | undefined): string {
  const t = message?.trim();
  if (!t) return TIMELINE_LOAD_ERROR_FA;
  if (/[\u0600-\u06FF]/.test(t)) return t;
  return TIMELINE_LOAD_ERROR_FA;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Profile timeline host at `#personnel-timeline-entry` (Story 5.3 / 9.7).
 * Cold-load is independent of profile section queries.
 */
export function PersonnelEventTimeline({
  personId,
  focusEventId,
}: PersonnelEventTimelineProps) {
  const [limit, setLimit] = React.useState(TIMELINE_PAGE_SIZE);
  const [focusMissing, setFocusMissing] = React.useState(false);
  const focusAttemptedRef = React.useRef(false);

  const timelineQuery = api.personnelEvent.listForPerson.useQuery(
    { personId, limit },
    { enabled: Boolean(personId.trim()) },
  );
  const lifecycleCapsQuery = api.personnelEvent.lifecycleCaps.useQuery(
    undefined,
    { enabled: Boolean(personId.trim()) },
  );

  const canCancel =
    !lifecycleCapsQuery.isError && lifecycleCapsQuery.data?.cancel === true;
  const canReverse =
    !lifecycleCapsQuery.isError && lifecycleCapsQuery.data?.reverse === true;
  const canCorrect =
    !lifecycleCapsQuery.isError && lifecycleCapsQuery.data?.correct === true;

  const rows = timelineQuery.data ?? [];
  const focusPresent =
    Boolean(focusEventId) && rows.some((r) => r.event.id === focusEventId);

  React.useEffect(() => {
    focusAttemptedRef.current = false;
    setFocusMissing(false);
  }, [focusEventId, personId]);

  React.useEffect(() => {
    if (!focusEventId || timelineQuery.isPending || timelineQuery.isError) {
      return;
    }
    if (focusPresent) {
      setFocusMissing(false);
      if (focusAttemptedRef.current) return;
      const el = document.getElementById(`event-${focusEventId}`);
      // Do not latch until the row is in the DOM — first paint can race the effect.
      if (!el) return;
      focusAttemptedRef.current = true;
      el.scrollIntoView({
        block: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      if (typeof el.focus === "function") {
        el.focus({ preventScroll: true });
      }
      return;
    }

    const hitPageCeiling = rows.length >= limit;
    const canLoadMore = hitPageCeiling && limit < TIMELINE_MAX_LIMIT;
    if (canLoadMore && !timelineQuery.isFetching) {
      setLimit((prev) => Math.min(prev + TIMELINE_PAGE_SIZE, TIMELINE_MAX_LIMIT));
      return;
    }
    if (!timelineQuery.isFetching) {
      setFocusMissing(true);
    }
  }, [
    focusEventId,
    focusPresent,
    limit,
    rows.length,
    timelineQuery.isPending,
    timelineQuery.isError,
    timelineQuery.isFetching,
  ]);

  if (timelineQuery.isPending && !timelineQuery.data) {
    return <TimelineSkeleton />;
  }

  if (timelineQuery.isError) {
    return (
      <FeedbackMessage kind="error">
        {timelineErrorMessage(timelineQuery.error.message)}
      </FeedbackMessage>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        {focusEventId ? (
          <FeedbackMessage kind="info">
            {operationalCopy.profileEventFocusMissing}
          </FeedbackMessage>
        ) : null}
        <FeedbackMessage kind="empty">{TIMELINE_EMPTY_COPY_FA}</FeedbackMessage>
      </div>
    );
  }

  const hitPageCeiling = rows.length >= limit;
  const canLoadMore = hitPageCeiling && limit < TIMELINE_MAX_LIMIT;
  const atMaxAndFull = hitPageCeiling && limit >= TIMELINE_MAX_LIMIT;
  // Newest-first page may omit older rows — never claim Baseline is chronologically first.
  const historyMayBeIncomplete = hitPageCeiling;
  const boundary = resolveTimelineBoundaryStatement(
    rows.map((r) => ({
      eventType: r.event.eventType,
      effectiveDate: r.event.effectiveDate,
      provenance: r.event.provenance,
    })),
    { historyMayBeIncomplete },
  );
  const boundaryJalali = boundary
    ? formatJalaliDisplayFromGregorian(boundary.baselineEffectiveDate)
    : null;

  return (
    <div className="space-y-4">
      {lifecycleCapsQuery.isError ? (
        <FeedbackMessage kind="error">
          {LIFECYCLE_CAPS_LOAD_ERROR_FA}
        </FeedbackMessage>
      ) : null}

      {focusMissing ? (
        <FeedbackMessage kind="info">
          {operationalCopy.profileEventFocusMissing}
        </FeedbackMessage>
      ) : null}

      {boundary ? (
        <p className="text-sm text-muted-foreground" role="note">
          {boundary.messageFa}
          {boundary.showBaselineDate && boundaryJalali ? (
            <>
              {" "}
              <span dir="ltr">{toPersianDigits(boundaryJalali)}</span>
            </>
          ) : null}
        </p>
      ) : null}

      <ul className="space-y-4" role="list">
        {rows.map((row, index) => {
          const previousEffectiveDate =
            index > 0 ? rows[index - 1]?.event.effectiveDate : null;
          return (
            <EventTimelineRow
              key={row.event.id}
              row={row}
              highlighted={focusEventId === row.event.id}
              showSameDayRegistrationHint={shouldShowSameDayRegistrationHint(
                previousEffectiveDate,
                row.event.effectiveDate,
              )}
              canCancel={canCancel}
              canReverse={canReverse}
              canCorrect={canCorrect}
              onLifecycleSuccess={() => {
                void timelineQuery.refetch();
              }}
            />
          );
        })}
      </ul>

      {canLoadMore ? (
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          disabled={timelineQuery.isFetching}
          disabledReason={operationalCopy.actionPending}
          onClick={() =>
            setLimit((prev) =>
              Math.min(prev + TIMELINE_PAGE_SIZE, TIMELINE_MAX_LIMIT),
            )
          }
        >
          {timelineQuery.isFetching
            ? "در حال بارگذاری…"
            : TIMELINE_LOAD_MORE_LABEL_FA}
        </Button>
      ) : null}

      {atMaxAndFull ? (
        <FeedbackMessage kind="info">
          {TIMELINE_TRUNCATED_COPY_FA}
        </FeedbackMessage>
      ) : null}
    </div>
  );
}
