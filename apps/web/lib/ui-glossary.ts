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
  headcountApproved: {
    termFa: "مصوب",
    definitionFa:
      "سقف مجاز ظرفیت روی این مجوز؛ تعداد استقرار اصلی که در محدودهٔ تیم و عنوان شغلی مجاز است.",
  },
  headcountUsed: {
    termFa: "مصرف‌شده",
    definitionFa:
      "تعداد استقرار اصلی فعال که هم‌اکنون از این مجوز ظرفیت استفاده می‌کنند.",
  },
  reservation: {
    termFa: "رزرو",
    definitionFa:
      "ادعای ظرفیت آینده از شروع یا انتقال ورودی نهایی‌شده قبل از تاریخ مؤثر.",
  },
  headcountFree: {
    termFa: "آزاد",
    definitionFa:
      "ظرفیت باقی‌ماندهٔ قابل‌استفاده: مصوب منهای مصرف‌شده و رزرو (منفی یعنی کمبود).",
  },
  headcountExemption: {
    termFa: "معافیت",
    definitionFa:
      "استثنای گزارش‌دهی وابسته به انتصاب اصلی؛ مصرف را از قواعد ظرفیت جدا می‌کند — با بازنویسی/لغو محدودیت یکی نیست.",
  },
  headcountOverride: {
    termFa: "بازنویسی",
    definitionFa:
      "لغو محدودیت ممیزی‌شده برای یک قاعدهٔ ظرفیت (کمبود، اعتبار، عنوان شغلی، ارشدیت)؛ صدور از مسیر نهایی‌سازی رویداد است، نه از این drawer.",
  },
  headcountApprovalLifecycle: {
    termFa: "چرخهٔ مجوز",
    definitionFa:
      "پیش‌نویس تا فعال‌سازی قابل‌مصرف نیست؛ فقط وضعیت فعال می‌تواند مصرف یا رزرو جدید بپذیرد. لغوشده و منقضی نیز غیرقابل‌مصرف‌اند.",
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
  correctionCase: {
    termFa: "اصلاح اطلاعات",
    definitionFa:
      "رسیدگی به درخواست اصلاح دادهٔ صاحب‌دادهٔ خارجی؛ ادمین منابع انسانی با تصمیم و شواهد پرونده را می‌بندد — نه خودخدمتی کارمند.",
  },
  legalHold: {
    termFa: "نگهداری قانونی",
    definitionFa:
      "مسدودسازی حذف تا آزادسازی؛ حذف فقط روی مقادیر عملیاتی و خروجی‌های مدیریت‌شده است و ردیف ممیزی را پاک نمی‌کند.",
  },
  auditInvestigation: {
    termFa: "ممیزی",
    definitionFa:
      "تحقیق شواهد قابل‌انتساب توسط بازبین مستقل — جدا از عملیات روزمرهٔ منابع انسانی.",
  },
  employment: {
    termFa: "همکاری",
    definitionFa:
      "دورهٔ همکاری باز یا تاریخی یک فرد. در خاتمه/انتقال/تغییر شغل معمولاً همکاری موجود لازم است؛ در شروع/بازگشت، رویداد می‌تواند همکاری جدید بسازد و انتخاب قبلی اختیاری است.",
  },
  collaborationType: {
    termFa: "نوع همکاری",
    definitionFa:
      "طبقهٔ همکاری (مثلاً رسمی یا قراردادی). روی شروع/بازگشت واقعیت الزامی فرم است و با انتخاب یک همکاری قبلی در فهرست یکی نیست.",
  },
  primaryAssignment: {
    termFa: "انتصاب اولیه",
    definitionFa:
      "انتصاب اولیه‌ای که عضویت تیمی و مصرف هدکانت را تعریف می‌کند. در شروع/بازگشت می‌تواند با خود رویداد ثبت شود؛ در سایر رویدادها معمولاً از سوابق موجود انتخاب می‌شود.",
  },
} as const satisfies Record<string, UiGlossaryEntry>;

export type UiGlossaryKey = keyof typeof uiGlossary;

export function getGlossaryEntry(key: UiGlossaryKey): UiGlossaryEntry {
  return uiGlossary[key];
}
