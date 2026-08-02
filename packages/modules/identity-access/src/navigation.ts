import { COARSE_ROLES, type CoarseRole } from "./types";

/**
 * Coarse navigation visibility for Epic 1 (UX-DR18 / FR43).
 * Nav visibility ≠ HR content entitlement — System Admin still has no routine HR data.
 */

export type NavItem = {
  readonly href: string;
  readonly label: string;
};

/** Frozen IA catalog — Epic-1 paths and Persian labels (Story 4b.3). */
export const NAV_CATALOG: readonly NavItem[] = Object.freeze([
  { href: "/dashboard", label: "داشبورد" },
  { href: "/personnel", label: "اطلاعات پرسنلی" },
  { href: "/personnel-events", label: "رویدادهای پرسنلی" },
  { href: "/organization", label: "ساختار سازمان" },
  { href: "/headcount", label: "ظرفیت و جذب" },
  { href: "/reports", label: "گزارش‌ها" },
  { href: "/import", label: "ورود داده" },
  { href: "/access", label: "دسترسی‌ها" },
  { href: "/audit", label: "ممیزی" },
  { href: "/operations", label: "عملیات" },
  { href: "/correction-cases", label: "اصلاح اطلاعات" },
  { href: "/settings", label: "تنظیمات" },
]);

/** Role → permitted catalog hrefs (exact Epic-1 coarse matrix + events). */
const ROLE_NAV_HREFS: Readonly<Record<CoarseRole, readonly string[]>> =
  Object.freeze({
    hr_operator: Object.freeze([
      "/dashboard",
      "/personnel",
      "/personnel-events",
      "/headcount",
      "/reports",
    ]),
    hr_admin: Object.freeze([
      "/dashboard",
      "/personnel",
      "/personnel-events",
      "/organization",
      "/headcount",
      "/reports",
      "/import",
      "/access",
      "/correction-cases",
      "/settings",
    ]),
    manager: Object.freeze([
      "/dashboard",
      "/personnel",
      "/personnel-events",
      "/headcount",
      "/reports",
    ]),
    audit_reviewer: Object.freeze(["/audit"]),
    system_admin: Object.freeze(["/operations", "/settings"]),
  });

const ROLE_LANDING: Readonly<Record<CoarseRole, string>> = Object.freeze({
  hr_operator: "/personnel/list",
  hr_admin: "/dashboard",
  manager: "/dashboard",
  audit_reviewer: "/audit",
  system_admin: "/operations",
});

const KNOWN_ROLES = new Set<string>(COARSE_ROLES);

function isKnownRole(role: string): role is CoarseRole {
  return KNOWN_ROLES.has(role);
}

/**
 * Normalize a pathname for access checks.
 * Resolves `.` / `..`, strips query/hash, rejects escape-above-root and bad encoding.
 * Returns `null` when the path must be denied (fail closed).
 */
function normalizePathname(pathname: string): string | null {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === "/") return "/";

  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;

  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return null;
  }

  if (decoded.includes("\0")) return null;

  const segments = decoded.split("/");
  const stack: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(segment);
  }

  if (stack.length === 0) return "/";
  return `/${stack.join("/")}`;
}

/** First surface after login for the caller's coarse role. */
export function getRoleLandingPath(role: CoarseRole): string {
  if (!isKnownRole(role)) return "/login";
  return ROLE_LANDING[role];
}

/** Nav items the role may see — forbidden items must be omitted from the DOM. */
export function getNavItemsForRole(role: CoarseRole): readonly NavItem[] {
  if (!isKnownRole(role)) return [];
  const allowed = new Set(ROLE_NAV_HREFS[role]);
  return NAV_CATALOG.filter((item) => allowed.has(item.href));
}

/**
 * Whether the role may open this path (exact catalog match or nested under it).
 * Unknown / non-catalog paths are denied (fail-closed).
 * Prefix is `${href}/` so `/personnel-events` is never nested under `/personnel`.
 */
export function canAccessPath(role: CoarseRole, pathname: string): boolean {
  if (!isKnownRole(role)) return false;

  const path = normalizePathname(pathname);
  if (path === null || path === "/") return false;

  const allowedHrefs = ROLE_NAV_HREFS[role];
  for (const href of allowedHrefs) {
    if (path === href || path.startsWith(`${href}/`)) {
      return true;
    }
  }

  return false;
}

/**
 * Honor only same-origin relative paths the role can access; otherwise landing.
 * Rejects protocol-relative (`//…`) and absolute URLs (open-redirect safe).
 */
export function resolvePostLoginPath(
  role: CoarseRole,
  callbackUrl: string | null | undefined,
): string {
  const landing = getRoleLandingPath(role);
  if (!callbackUrl) return landing;

  const raw = callbackUrl.trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return landing;

  const path = normalizePathname(raw);
  if (path === null || !canAccessPath(role, path)) return landing;
  return path;
}
