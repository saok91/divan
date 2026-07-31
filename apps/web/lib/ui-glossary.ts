/**
 * Lean Persian UI glossary for operator-facing domain terms (Story 8.9 / UX-DR37).
 * Distinct from TechnicalDetailDisclosure (UUID) — never mix the two.
 */

export type UiGlossaryEntry = {
  termFa: string;
  definitionFa: string;
};

export const uiGlossary = {
  personnelEvent: {
    termFa: "رویداد پرسنلی",
    definitionFa:
      "تغییر کسب‌وکاری قابل‌انتساب و تاریخ‌مؤثر که ممکن است وضعیت مشتق نیروی کار را عوض کند.",
  },
  draft: {
    termFa: "پیش‌نویس",
    definitionFa:
      "رویداد قابل‌ویرایش و غیرقطعی؛ تا نهایی‌سازی در وضعیت جاری لحاظ نمی‌شود.",
  },
  finalize: {
    termFa: "نهایی‌سازی",
    definitionFa:
      "پذیرش رویداد به‌عنوان حقیقت ثبت‌شده؛ پس از آن ویرایش مستقیم یا حذف سخت مجاز نیست.",
  },
  headcount: {
    termFa: "هدکانت",
    definitionFa:
      "مجوز ظرفیت برای استقرارهای اصلی در محدودهٔ تیم و عنوان شغلی (و در صورت نیاز ارشدیت).",
  },
  reservation: {
    termFa: "رزرو",
    definitionFa:
      "ادعای ظرفیت آینده از شروع یا انتقال ورودی نهایی‌شده قبل از تاریخ مؤثر.",
  },
  breakGlass: {
    termFa: "شکست شیشه",
    definitionFa:
      "ارتفاع اضطراری دسترسی با حادثه، هدف و انقضا؛ خروجی و مدیریت مجوز به‌صورت پیش‌فرض انکار می‌شود.",
  },
  organizationalScope: {
    termFa: "محدودهٔ سازمانی",
    definitionFa:
      "مرز جمعیتی که کاربر مجاز است ببیند یا روی آن عمل کند (تیم، واحد، شخصیت حقوقی یا سلسله‌مراتب).",
  },
  currentState: {
    termFa: "وضعیت جاری",
    definitionFa:
      "وضعیت مشتق فرد در تاریخ مؤثر جاری پس از اعمال رویدادهای نهایی‌شده و بازمحاسبه.",
  },
  baseline: {
    termFa: "خط مبنا",
    definitionFa:
      "وضعیت مهاجرتی تأییدشده در شروع تاریخچهٔ قابل‌بازسازی قابل‌اتکا.",
  },
  effectiveDate: {
    termFa: "تاریخ مؤثر",
    definitionFa:
      "تاریخ کسب‌وکاری که تغییر وضعیت از آن اعمال می‌شود؛ متمایز از زمان ثبت و نهایی‌سازی.",
  },
} as const satisfies Record<string, UiGlossaryEntry>;

export type UiGlossaryKey = keyof typeof uiGlossary;

export function getGlossaryEntry(key: UiGlossaryKey): UiGlossaryEntry {
  return uiGlossary[key];
}
