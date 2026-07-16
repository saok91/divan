/**
 * Epic-1 operational Persian copy catalog (EXPERIENCE State Patterns / Voice).
 * Fact + next step; no emoji; no ceremonial success. Persian-only UI.
 */

export const operationalCopy = {
  /** UX-DR18 deep-link deny — exact string. */
  accessDeniedTitle: "دسترسی ندارید.",
  accessDeniedBody:
    "به این مسیر دسترسی ندارید. می‌توانید به صفحهٔ شروع نقش خود بازگردید.",
  accessDeniedReturn: "بازگشت به صفحهٔ شروع",

  /** Prep for Story 1.8 LDAP outage — catalog only until wired. */
  ldapUnavailable: "اتصال به سامانه هویت برقرار نیست.",

  /** Empty search (palette / personnel stub). */
  emptySearch: "نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.",

  /** Viewport gate (genuine small window). */
  viewportGateBody:
    "برای استفاده از دیوان، حداقل وضوح صفحهٔ نمایش {size} لازم است. لطفاً پنجره را بزرگ‌تر کنید یا از نمایشگر دسکتاپ استفاده کنید.",

  /** Scope revoked — catalog until Epic 2 surfaces exist. */
  scopeRevoked: "دسترسی شما تغییر کرد.",

  /** Unsaved form — catalog until Epic 4 surfaces exist. */
  unsavedForm:
    "تغییرات ذخیره نشده‌اند. قبل از ترک صفحه آن‌ها را ذخیره یا لغو کنید.",

  loginPrompt: "برای ادامه وارد حساب کاربری شوید.",
  inactiveAccount: "این حساب غیرفعال است.",
  invalidCredentials: "نام کاربری یا رمز عبور نادرست است.",

  breakGlassActive: "دسترسی اضطراری فعال است.",
  breakGlassExpired: "دسترسی اضطراری پایان یافت.",
  breakGlassDismiss: "بستن",

  staleGoldCtaHint:
    "تا به‌روز شدن داده، نهایی‌سازی و خروجی غیرفعال است.",
} as const;

/**
 * Stale/recalc banner — Voice pattern: fact + time + next step.
 * `pendingUntilLabel` should already use Persian digits (e.g. ۰۹:۱۴).
 */
export function staleRecalcMessage(pendingUntilLabel: string): string {
  return `داده به‌روز نیست — تا ${pendingUntilLabel} محاسبه نشده.`;
}

/** Short route landmark announce (EXPERIENCE landmarks). */
export function routeAnnounce(surfaceLabel: string): string {
  return surfaceLabel;
}
