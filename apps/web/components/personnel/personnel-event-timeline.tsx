"use client";

import * as React from "react";

import { EventTimelineRow } from "@/components/personnel/event-timeline-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TIMELINE_EMPTY_COPY_FA,
  TIMELINE_LOAD_MORE_LABEL_FA,
  TIMELINE_MAX_LIMIT,
  TIMELINE_PAGE_SIZE,
  TIMELINE_TRUNCATED_COPY_FA,
  shouldShowSameDayRegistrationHint,
} from "@/lib/personnel-event-timeline";
import { api } from "@/lib/trpc/client";

const TIMELINE_LOAD_ERROR_FA =
  "بارگذاری گاه‌شمار رویدادها ممکن نشد. دوباره تلاش کنید.";
const LIFECYCLE_CAPS_LOAD_ERROR_FA =
  "بارگذاری مجوزهای چرخه رویداد ممکن نشد. عملیات چرخه موقتاً در دسترس نیست.";

type PersonnelEventTimelineProps = {
  personId: string;
};

function TimelineSkeleton() {
  return (
    <div
      className="space-y-4"
      aria-busy="true"
      aria-label="در حال بارگذاری گاه‌شمار"
    >
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function timelineErrorMessage(message: string | undefined): string {
  const t = message?.trim();
  if (!t) return TIMELINE_LOAD_ERROR_FA;
  if (/[\u0600-\u06FF]/.test(t)) return t;
  return TIMELINE_LOAD_ERROR_FA;
}

/**
 * Profile timeline host at `#personnel-timeline-entry` (Story 5.3).
 * Cold-load is independent of profile section queries.
 */
export function PersonnelEventTimeline({ personId }: PersonnelEventTimelineProps) {
  const [limit, setLimit] = React.useState(TIMELINE_PAGE_SIZE);

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

  if (timelineQuery.isPending && !timelineQuery.data) {
    return <TimelineSkeleton />;
  }

  if (timelineQuery.isError) {
    return (
      <p role="alert" className="text-body text-destructive">
        {timelineErrorMessage(timelineQuery.error.message)}
      </p>
    );
  }

  const rows = timelineQuery.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-body text-muted-foreground">{TIMELINE_EMPTY_COPY_FA}</p>
    );
  }

  const hitPageCeiling = rows.length >= limit;
  const canLoadMore = hitPageCeiling && limit < TIMELINE_MAX_LIMIT;
  const atMaxAndFull = hitPageCeiling && limit >= TIMELINE_MAX_LIMIT;

  return (
    <div className="space-y-4">
      {lifecycleCapsQuery.isError ? (
        <p role="alert" className="text-body text-destructive">
          {LIFECYCLE_CAPS_LOAD_ERROR_FA}
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
          variant="outline"
          size="sm"
          disabled={timelineQuery.isFetching}
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
        <p className="text-xs text-muted-foreground">{TIMELINE_TRUNCATED_COPY_FA}</p>
      ) : null}
    </div>
  );
}
