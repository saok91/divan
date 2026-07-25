/**
 * Personnel event timeline helpers (Story 5.3 / FR-34 / UX-DR9; Story 6.3 / FR-39).
 * Sort contract mirrors server ORDER BY; chain/empty copy shared with form.
 */

import {
  BASELINE_RECORDED_EVENT_TYPE,
  classifyEventOrigin,
  type EventOrigin,
} from "@divan/migration";

import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";

export const TIMELINE_EMPTY_COPY_FA = "رویداد پرسنلی ثبت نشده.";

/** Initial page size / load-more step for profile timeline. */
export const TIMELINE_PAGE_SIZE = 50;
/** Matches event-store list clamp; tRPC listForPerson max must stay in sync. */
export const TIMELINE_MAX_LIMIT = 200;
export const TIMELINE_TRUNCATED_COPY_FA =
  "ممکن است رویدادهای قدیمی‌تر در این فهرست نباشد.";
export const TIMELINE_LOAD_MORE_LABEL_FA = "بارگذاری بیشتر";

/** Form draft/create options only — do not add lifecycle system types here. */
export const EVENT_TYPE_OPTIONS = [
  { value: "ScaffoldChangeRecorded", labelFa: "اسکفولد (آزمایش بستر)" },
  { value: "EmploymentStarted", labelFa: "شروع همکاری (EmploymentStarted)" },
  { value: "EmploymentReturned", labelFa: "بازگشت همکاری (EmploymentReturned)" },
  {
    value: "EmploymentTerminated",
    labelFa: "خاتمه همکاری (EmploymentTerminated)",
  },
  { value: "TransferRecorded", labelFa: "انتقال (TransferRecorded)" },
  {
    value: "OrganizationalRoleChanged",
    labelFa: "تغییر نقش سازمانی",
  },
  { value: "JobTitleChanged", labelFa: "تغییر عنوان شغلی" },
  { value: "SeniorityChanged", labelFa: "تغییر ارشدیت" },
  { value: "LadderChanged", labelFa: "تغییر لدر" },
  { value: "GradeChanged", labelFa: "تغییر گرید" },
  { value: "PromotionRecorded", labelFa: "ثبت ارتقا (نتیجه نهایی)" },
  { value: "CompensationChanged", labelFa: "تغییر جبران‌خدمت" },
  { value: "ContractChanged", labelFa: "تغییر قرارداد" },
] as const;

/** Display-only labels for append-only lifecycle / migration events (not form create). */
const LIFECYCLE_EVENT_TYPE_LABELS = [
  { value: "EventCancelled", labelFa: "لغو رویداد" },
  { value: "EventReversed", labelFa: "بازگشت رویداد" },
  { value: "EventCorrected", labelFa: "اصلاح رویداد" },
  {
    value: BASELINE_RECORDED_EVENT_TYPE,
    labelFa: operationalCopy.eventTypeBaselineRecordedFa,
  },
] as const;

const EVENT_TYPE_LABEL_BY_VALUE = new Map<string, string>([
  ...EVENT_TYPE_OPTIONS.map((o) => [o.value, o.labelFa] as const),
  ...LIFECYCLE_EVENT_TYPE_LABELS.map((o) => [o.value, o.labelFa] as const),
]);

const ORIGIN_LABEL_FA: Record<EventOrigin, string> = {
  baseline: operationalCopy.eventOriginBaselineFa,
  imported: operationalCopy.eventOriginImportedFa,
  native: operationalCopy.eventOriginNativeFa,
};

export function eventTypeLabelFa(eventType: string): string {
  return EVENT_TYPE_LABEL_BY_VALUE.get(eventType) ?? eventType;
}

export function eventOriginLabelFa(origin: EventOrigin): string {
  return ORIGIN_LABEL_FA[origin];
}

export function formatChainLinksFa(links: {
  cancellations: string[];
  reversals: string[];
  corrections: string[];
}): string | null {
  const parts: string[] = [];
  if (links.cancellations.length > 0) {
    parts.push(
      `لغو: ${links.cancellations.map((id) => id.slice(0, 8)).join("، ")}`,
    );
  }
  if (links.reversals.length > 0) {
    parts.push(
      `بازگشت: ${links.reversals.map((id) => id.slice(0, 8)).join("، ")}`,
    );
  }
  if (links.corrections.length > 0) {
    parts.push(
      `اصلاح: ${links.corrections.map((id) => id.slice(0, 8)).join("، ")}`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Safe MVP actor label — truncate InternalAccount id (no new directory module). */
export function truncateActorLabel(accountId: string | null | undefined): string {
  const t = accountId?.trim();
  if (!t) return "—";
  return t.length <= 8 ? t : `${t.slice(0, 8)}…`;
}

function truncateRef(value: string, max = 8): string {
  const t = value.trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function provenanceRefParts(
  provenance: Record<string, unknown>,
): string[] {
  const parts: string[] = [];
  const batchId = provenance.batchId;
  if (typeof batchId === "string" && batchId.trim()) {
    parts.push(`دسته: ${toPersianDigits(truncateRef(batchId))}`);
  }
  const sourceRow = provenance.sourceRow;
  if (typeof sourceRow === "number" && Number.isFinite(sourceRow)) {
    parts.push(`ردیف: ${toPersianDigits(sourceRow)}`);
  } else if (typeof sourceRow === "string" && sourceRow.trim()) {
    parts.push(`ردیف: ${toPersianDigits(sourceRow.trim())}`);
  }
  const templateKey = provenance.templateKey;
  if (typeof templateKey === "string" && templateKey.trim()) {
    parts.push(`قالب: ${truncateRef(templateKey, 24)}`);
  }
  return parts;
}

/**
 * Compact provenance caption for FR-34 / FR-39 — refs/codes only, never payload dump.
 * Baseline / imported / native produce distinct Persian origin captions.
 */
export function formatProvenanceCaption(input: {
  eventType?: string;
  provenance?: Record<string, unknown> | null;
  referenceCode?: string | null;
}): string | null {
  const parts: string[] = [];
  const ref = input.referenceCode?.trim();
  if (ref) parts.push(`کد مرجع: ${toPersianDigits(ref)}`);

  const eventType = input.eventType ?? "";
  const provenance = input.provenance;
  const origin = classifyEventOrigin({
    eventType,
    provenance: provenance ?? null,
  });

  if (origin === "baseline" || origin === "imported") {
    parts.push(ORIGIN_LABEL_FA[origin]);
    if (provenance && typeof provenance === "object") {
      parts.push(...provenanceRefParts(provenance));
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  // native — always verbal Persian origin when eventType is known (AC #1)
  if (eventType) {
    parts.push(ORIGIN_LABEL_FA.native);
  }
  if (provenance && typeof provenance === "object") {
    const source = provenance.source;
    if (typeof source === "string" && source.trim()) {
      const trimmed = source.trim();
      // migration here is defensive-only (classify should have returned imported)
      if (trimmed !== "migration") {
        parts.push(`منبع: ${trimmed}`);
      } else {
        parts.push(...provenanceRefParts(provenance));
      }
    } else {
      const keys = Object.keys(provenance).filter((k) => provenance[k] != null);
      if (keys.length > 0) {
        parts.push(`منشأ: ${keys.slice(0, 3).join("، ")}`);
      }
    }
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export type TimelineBoundaryEvent = {
  eventType: string;
  effectiveDate: string;
  provenance?: Record<string, unknown> | null;
};

/**
 * One FR-39 boundary statement for the timeline header when Baseline exists.
 * Honest "where applicable": does not claim Baseline was chronologically first
 * when earlier-dated events are present, or when the loaded window may omit older rows.
 * Boundary chronology uses Effective Date only (same-day registeredAt order is out of scope).
 */
export function resolveTimelineBoundaryStatement(
  events: TimelineBoundaryEvent[],
  options?: { historyMayBeIncomplete?: boolean },
): {
  messageFa: string;
  baselineEffectiveDate: string;
  /** True when Baseline is chronologically first (show Effective Date after copy). */
  showBaselineDate: boolean;
} | null {
  const baselines = events.filter(
    (e) => e.eventType === BASELINE_RECORDED_EVENT_TYPE,
  );
  if (baselines.length === 0) return null;

  // Earliest Baseline by Effective Date (stable tie-break: first in input order)
  let baseline = baselines[0]!;
  for (const b of baselines) {
    if (b.effectiveDate < baseline.effectiveDate) baseline = b;
  }

  const hasEarlierNonBaseline = events.some(
    (e) =>
      e.eventType !== BASELINE_RECORDED_EVENT_TYPE &&
      e.effectiveDate < baseline.effectiveDate,
  );

  if (hasEarlierNonBaseline) {
    return {
      baselineEffectiveDate: baseline.effectiveDate,
      showBaselineDate: false,
      messageFa: operationalCopy.timelineBoundaryWithEarlierNativeFa,
    };
  }

  if (options?.historyMayBeIncomplete) {
    return {
      baselineEffectiveDate: baseline.effectiveDate,
      showBaselineDate: false,
      messageFa: operationalCopy.timelineBoundaryHistoryIncompleteFa,
    };
  }

  return {
    baselineEffectiveDate: baseline.effectiveDate,
    showBaselineDate: true,
    messageFa: operationalCopy.timelineBoundaryStartsAtBaselineFa,
  };
}

export type TimelineSortFields = {
  effectiveDate: string;
  registeredAt: string | Date;
  eventType: string;
};

/**
 * AC #2: Effective Date desc → registration time desc → event type asc (stable).
 * Mirrors server ORDER BY for selfcheck / client re-sort documentation.
 */
export function compareTimelineSort(
  a: TimelineSortFields,
  b: TimelineSortFields,
): number {
  if (a.effectiveDate !== b.effectiveDate) {
    return a.effectiveDate < b.effectiveDate ? 1 : -1;
  }
  const aReg =
    typeof a.registeredAt === "string"
      ? a.registeredAt
      : a.registeredAt.toISOString();
  const bReg =
    typeof b.registeredAt === "string"
      ? b.registeredAt
      : b.registeredAt.toISOString();
  if (aReg !== bReg) {
    return aReg < bReg ? 1 : -1;
  }
  if (a.eventType === b.eventType) return 0;
  return a.eventType < b.eventType ? -1 : 1;
}

/** UX-DR9: consecutive same Effective Date → show registration-time secondary hint. */
export function shouldShowSameDayRegistrationHint(
  previousEffectiveDate: string | null | undefined,
  currentEffectiveDate: string,
): boolean {
  return (
    typeof previousEffectiveDate === "string" &&
    previousEffectiveDate === currentEffectiveDate
  );
}

export { classifyEventOrigin, type EventOrigin };
