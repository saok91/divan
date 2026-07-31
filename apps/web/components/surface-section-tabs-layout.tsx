"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";
import {
  activeTabForPath,
  type SectionTabDef,
  type SectionTabSurface,
} from "@/lib/section-tab-surfaces";

type SurfaceSectionTabsLayoutProps = {
  surface: SectionTabSurface;
  children: React.ReactNode;
  /** Optional filtered tabs (e.g. Admin-only dictionary omitted for operators). */
  tabs?: readonly SectionTabDef[];
  /** Optional purpose line (Story 8.9 owns glossary copy). */
  purpose?: ReactNode;
  /** Optional breadcrumb override; defaults to surface label trail. */
  breadcrumb?: ReactNode;
  /** Optional result count for the surface header. */
  resultCount?: ReactNode;
};

const PANEL_ID = "section-tab-panel";

/**
 * PageHeader + URL-backed tabs chrome + tabpanel host for a major nav surface.
 * Primary actions stay in panel toolbars beneath — never inside PageHeader.
 */
export function SurfaceSectionTabsLayout({
  surface,
  children,
  tabs: tabsOverride,
  purpose,
  breadcrumb,
  resultCount,
}: SurfaceSectionTabsLayoutProps) {
  const pathname = usePathname();
  const tabs = tabsOverride ?? surface.tabs;
  const surfaceForActive = tabsOverride
    ? { ...surface, tabs: [...tabsOverride] }
    : surface;
  const active = activeTabForPath(pathname, surfaceForActive);
  const labelledBy = active ? `section-tab-${active.id}` : undefined;

  return (
    <div className="flex min-h-0 flex-col bg-surface-page">
      <PageHeader
        breadcrumb={
          breadcrumb ?? (
            <span>
              دیوان
              <span className="mx-1 text-text-tertiary" aria-hidden>
                /
              </span>
              {surface.surfaceLabel}
            </span>
          )
        }
        title={surface.surfaceLabel}
        purpose={purpose}
        resultCount={resultCount}
        id={`surface-header-${surface.root.replace(/\//g, "") || "root"}`}
      />
      <SectionTabs
        ariaLabel={surface.ariaLabel}
        tabs={tabs}
        panelId={PANEL_ID}
      />
      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={labelledBy}
        className="min-w-0"
      >
        {children}
      </div>
    </div>
  );
}
