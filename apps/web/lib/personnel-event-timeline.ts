/**
 * Personnel event timeline helpers (Story 5.3 / FR-34 / UX-DR9).
 * Sort contract mirrors server ORDER BY; chain/empty copy shared with form.
 */

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

/** Display-only labels for append-only lifecycle events (not form create options). */
const LIFECYCLE_EVENT_TYPE_LABELS = [
  { value: "EventCancelled", labelFa: "لغو رویداد" },
  { value: "EventReversed", labelFa: "بازگشت رویداد" },
  { value: "EventCorrected", labelFa: "اصلاح رویداد" },
] as const;

const EVENT_TYPE_LABEL_BY_VALUE = new Map<string, string>([
  ...EVENT_TYPE_OPTIONS.map((o) => [o.value, o.labelFa] as const),
  ...LIFECYCLE_EVENT_TYPE_LABELS.map((o) => [o.value, o.labelFa] as const),
]);

export function eventTypeLabelFa(eventType: string): string {
  return EVENT_TYPE_LABEL_BY_VALUE.get(eventType) ?? eventType;
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

/**
 * Compact provenance caption for FR-34 — refs/codes only, never payload dump.
 */
export function formatProvenanceCaption(input: {
  provenance?: Record<string, unknown> | null;
  referenceCode?: string | null;
}): string | null {
  const parts: string[] = [];
  const ref = input.referenceCode?.trim();
  if (ref) parts.push(`کد مرجع: ${ref}`);

  const prov = input.provenance;
  if (prov && typeof prov === "object") {
    const source = prov.source;
    if (typeof source === "string" && source.trim()) {
      parts.push(`منبع: ${source.trim()}`);
    } else {
      const keys = Object.keys(prov).filter((k) => prov[k] != null);
      if (keys.length > 0) {
        parts.push(`منشأ: ${keys.slice(0, 3).join("، ")}`);
      }
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
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
