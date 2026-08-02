/**
 * Settings domain ↔ tab SoT (Story 10.2 / UX-DR36).
 * Lives in lib/ so tRPC authz and UI share one matrix (no components←server import).
 *
 * Deep-link hydrate: nested path segments only (no `?tab=`). One-shot URL
 * identity via Link tablist — same pattern as reports (Epic 9 action #6).
 * Cascade-clear of dependent filters is N/A for domain-scoped settings lists;
 * if cascading filters appear later, clear dependents on parent change.
 */

import {
  GOVERNED_SETTINGS_REGISTRY,
  type SettingsOwningDomain,
} from "@divan/app-settings";
import type { CoarseRole } from "@divan/identity-access";

import type { SectionTabDef, SectionTabSurface } from "@/lib/section-tab-surfaces";

export type SettingsDomainTab = {
  id: string;
  labelFa: string;
  href: string;
  owningDomain: SettingsOwningDomain;
};

/** All seven UX domains — register in SECTION_TAB_SURFACES; omit empty from visible tabs. */
export const SETTINGS_DOMAIN_TABS: readonly SettingsDomainTab[] = Object.freeze([
  {
    id: "general-display",
    labelFa: "عمومی و نمایش",
    href: "/settings/general-display",
    owningDomain: "general_display",
  },
  {
    id: "data-retention",
    labelFa: "داده و نگه‌داشت",
    href: "/settings/data-retention",
    owningDomain: "data_retention",
  },
  {
    id: "import-export",
    labelFa: "ورود و خروجی",
    href: "/settings/import-export",
    owningDomain: "import_export",
  },
  {
    id: "capacity-hiring",
    labelFa: "ظرفیت و جذب",
    href: "/settings/capacity-hiring",
    owningDomain: "capacity_hiring",
  },
  {
    id: "access-session",
    labelFa: "دسترسی و نشست",
    href: "/settings/access-session",
    owningDomain: "access_session",
  },
  {
    id: "audit-integrity",
    labelFa: "ممیزی و یکپارچگی",
    href: "/settings/audit-integrity",
    owningDomain: "audit_integrity",
  },
  {
    id: "infrastructure",
    labelFa: "زیرساخت",
    href: "/settings/infrastructure",
    owningDomain: "infrastructure",
  },
]);

/** Both roles share general_display; other domains are role-split. */
const HR_ADMIN_DOMAINS: readonly SettingsOwningDomain[] = Object.freeze([
  "general_display",
  "data_retention",
  "import_export",
  "capacity_hiring",
]);

const SYSTEM_ADMIN_DOMAINS: readonly SettingsOwningDomain[] = Object.freeze([
  "general_display",
  "access_session",
  "audit_integrity",
  "infrastructure",
]);

export function domainsForRole(
  role: CoarseRole,
): readonly SettingsOwningDomain[] {
  if (role === "hr_admin") return HR_ADMIN_DOMAINS;
  if (role === "system_admin") return SYSTEM_ADMIN_DOMAINS;
  return [];
}

/** Role domains that currently have ≥1 registry key (matches visible tabs). */
export function visibleDomainsForRole(
  role: CoarseRole,
): readonly SettingsOwningDomain[] {
  return domainsForRole(role).filter(domainHasRegistryKeys);
}

export function registryKeyCountForDomain(
  domain: SettingsOwningDomain,
): number {
  return GOVERNED_SETTINGS_REGISTRY.filter((d) => d.owningDomain === domain)
    .length;
}

export function domainHasRegistryKeys(domain: SettingsOwningDomain): boolean {
  return registryKeyCountForDomain(domain) > 0;
}

export function tabForDomain(
  domain: SettingsOwningDomain,
): SettingsDomainTab | undefined {
  return SETTINGS_DOMAIN_TABS.find((t) => t.owningDomain === domain);
}

export function tabForHref(href: string): SettingsDomainTab | undefined {
  return SETTINGS_DOMAIN_TABS.find((t) => t.href === href);
}

export function roleMaySeeDomain(
  role: CoarseRole,
  domain: SettingsOwningDomain,
): boolean {
  return domainsForRole(role).includes(domain);
}

/**
 * Visible tabs: role membership ∩ domains with ≥1 registry key.
 * Empty domains (e.g. audit_integrity today) are never rendered.
 */
export function visibleSettingsTabsForRole(
  role: CoarseRole,
): readonly SectionTabDef[] {
  const allowed = new Set(domainsForRole(role));
  return SETTINGS_DOMAIN_TABS.filter(
    (t) => allowed.has(t.owningDomain) && domainHasRegistryKeys(t.owningDomain),
  ).map((t) => ({
    id: t.id,
    label: t.labelFa,
    href: t.href,
  }));
}

/**
 * First visible non-empty tab href for the role.
 * Prefer general-display when present; fail-closed returns null when none.
 */
export function defaultSettingsTabHref(role: CoarseRole): string | null {
  const tabs = visibleSettingsTabsForRole(role);
  if (tabs.length === 0) return null;
  const general = tabs.find((t) => t.id === "general-display");
  return general?.href ?? tabs[0]!.href;
}

export function settingsSurfaceFromTabs(
  tabs: readonly SectionTabDef[],
): SectionTabSurface {
  return {
    root: "/settings",
    surfaceLabel: "تنظیمات",
    ariaLabel: "بخش‌های تنظیمات",
    defaultTabId: "general-display",
    tabs,
  };
}
