"use client";

import { usePathname } from "next/navigation";

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
};

const PANEL_ID = "section-tab-panel";

/**
 * Thin URL-backed tabs chrome + tabpanel host for a major nav surface.
 */
export function SurfaceSectionTabsLayout({
  surface,
  children,
  tabs: tabsOverride,
}: SurfaceSectionTabsLayoutProps) {
  const pathname = usePathname();
  const tabs = tabsOverride ?? surface.tabs;
  const surfaceForActive = tabsOverride
    ? { ...surface, tabs: [...tabsOverride] }
    : surface;
  const active = activeTabForPath(pathname, surfaceForActive);
  const labelledBy = active ? `section-tab-${active.id}` : undefined;

  return (
    <div className="flex min-h-0 flex-col">
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
