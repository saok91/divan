/**
 * URL-backed section-tab configs for major nav surfaces (Story 4b.2).
 * Nested path segments — preferred over ?tab= / hash.
 */

export type SectionTabDef = {
  id: string;
  label: string;
  /** Full path including surface prefix, e.g. `/personnel/list`. */
  href: string;
};

export type SectionTabSurface = {
  /** Surface root, e.g. `/personnel`. */
  root: string;
  /** Visible / announce surface label. */
  surfaceLabel: string;
  ariaLabel: string;
  defaultTabId: string;
  tabs: readonly SectionTabDef[];
};

export const SECTION_TAB_SURFACES: readonly SectionTabSurface[] = [
  {
    root: "/personnel",
    surfaceLabel: "اطلاعات پرسنلی",
    ariaLabel: "بخش‌های اطلاعات پرسنلی",
    defaultTabId: "list",
    tabs: [
      { id: "list", label: "فهرست پرسنل", href: "/personnel/list" },
      { id: "add", label: "افزودن", href: "/personnel/add" },
      {
        id: "bulk-import",
        label: "ورود گروهی",
        href: "/personnel/bulk-import",
      },
      {
        id: "dictionary",
        label: "فرهنگ داده",
        href: "/personnel/dictionary",
      },
    ],
  },
  {
    root: "/organization",
    surfaceLabel: "ساختار سازمان",
    ariaLabel: "بخش‌های ساختار سازمان",
    defaultTabId: "hierarchy",
    tabs: [
      {
        id: "hierarchy",
        label: "سلسله‌مراتب",
        href: "/organization/hierarchy",
      },
      {
        id: "roles",
        label: "نقش سازمانی",
        href: "/organization/roles",
      },
      {
        id: "job-titles",
        label: "عنوان شغلی",
        href: "/organization/job-titles",
      },
      {
        id: "ladder-grade",
        label: "لدر و گرید",
        href: "/organization/ladder-grade",
      },
      {
        id: "seniority",
        label: "ارشدیت",
        href: "/organization/seniority",
      },
    ],
  },
  {
    root: "/headcount",
    surfaceLabel: "ظرفیت و جذب",
    ariaLabel: "بخش‌های ظرفیت و جذب",
    defaultTabId: "capacity",
    tabs: [
      { id: "capacity", label: "هدکانت", href: "/headcount/capacity" },
      { id: "create", label: "ایجاد", href: "/headcount/create" },
      {
        id: "bulk-import",
        label: "ورود گروهی",
        href: "/headcount/bulk-import",
      },
    ],
  },
  {
    root: "/access",
    surfaceLabel: "دسترسی‌ها",
    ariaLabel: "بخش‌های دسترسی",
    defaultTabId: "people",
    tabs: [
      { id: "people", label: "افراد و دسترسی", href: "/access/people" },
      { id: "roles", label: "نقش‌ها", href: "/access/roles" },
      { id: "scopes", label: "محدوده‌ها", href: "/access/scopes" },
      {
        id: "break-glass",
        label: "دسترسی اضطراری",
        href: "/access/break-glass",
      },
    ],
  },
  {
    root: "/personnel-events",
    surfaceLabel: "رویدادهای پرسنلی",
    ariaLabel: "بخش‌های رویدادهای پرسنلی",
    defaultTabId: "events",
    tabs: [
      {
        id: "events",
        label: "رویدادها",
        href: "/personnel-events/events",
      },
      {
        id: "register",
        label: "ثبت رویداد",
        href: "/personnel-events/register",
      },
      {
        id: "bulk-import",
        label: "ورود گروهی",
        href: "/personnel-events/bulk-import",
      },
    ],
  },
  {
    root: "/reports",
    surfaceLabel: "گزارش‌ها",
    ariaLabel: "بخش‌های گزارش‌ها",
    defaultTabId: "personnel",
    tabs: [
      { id: "personnel", label: "نیروی انسانی", href: "/reports/personnel" },
      {
        id: "organization",
        label: "سازمان",
        href: "/reports/organization",
      },
      { id: "events", label: "رویدادها", href: "/reports/events" },
      {
        id: "capacity",
        label: "ظرفیت و جذب",
        href: "/reports/capacity",
      },
      {
        id: "data-entry",
        label: "ورود داده",
        href: "/reports/data-entry",
      },
    ],
  },
  {
    root: "/settings",
    surfaceLabel: "تنظیمات",
    ariaLabel: "بخش‌های تنظیمات",
    defaultTabId: "general-display",
    tabs: [
      {
        id: "general-display",
        label: "عمومی و نمایش",
        href: "/settings/general-display",
      },
      {
        id: "data-retention",
        label: "داده و نگه‌داشت",
        href: "/settings/data-retention",
      },
      {
        id: "import-export",
        label: "ورود و خروجی",
        href: "/settings/import-export",
      },
      {
        id: "capacity-hiring",
        label: "ظرفیت و جذب",
        href: "/settings/capacity-hiring",
      },
      {
        id: "access-session",
        label: "دسترسی و نشست",
        href: "/settings/access-session",
      },
      {
        id: "audit-integrity",
        label: "ممیزی و یکپارچگی",
        href: "/settings/audit-integrity",
      },
      {
        id: "infrastructure",
        label: "زیرساخت",
        href: "/settings/infrastructure",
      },
    ],
  },
] as const;

export function surfaceForPath(
  pathname: string,
): SectionTabSurface | undefined {
  return SECTION_TAB_SURFACES.find(
    (s) => pathname === s.root || pathname.startsWith(`${s.root}/`),
  );
}

export function activeTabForPath(
  pathname: string,
  surface: SectionTabSurface,
): SectionTabDef | undefined {
  const exact = surface.tabs.find((t) => t.href === pathname);
  if (exact) return exact;
  return surface.tabs.find(
    (t) => pathname === t.href || pathname.startsWith(`${t.href}/`),
  );
}

export function defaultTabHref(surface: SectionTabSurface, searchParams?: URLSearchParams): string {
  const tab = surface.tabs.find((t) => t.id === surface.defaultTabId);
  const href = tab?.href ?? surface.tabs[0]!.href;
  const query = searchParams?.toString();
  return `${href}${query ? `?${query}` : ""}`;
}
