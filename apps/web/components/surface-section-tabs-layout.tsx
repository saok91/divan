"use client";

import { usePathname } from "next/navigation";

import { SectionTabs } from "@/components/section-tabs";
import {
  activeTabForPath,
  type SectionTabSurface,
} from "@/lib/section-tab-surfaces";

type SurfaceSectionTabsLayoutProps = {
  surface: SectionTabSurface;
  children: React.ReactNode;
};

const PANEL_ID = "section-tab-panel";

/**
 * Thin URL-backed tabs chrome + tabpanel host for a major nav surface.
 */
export function SurfaceSectionTabsLayout({
  surface,
  children,
}: SurfaceSectionTabsLayoutProps) {
  const pathname = usePathname();
  const active = activeTabForPath(pathname, surface);
  const labelledBy = active ? `section-tab-${active.id}` : undefined;

  return (
    <div className="flex min-h-0 flex-col">
      <SectionTabs
        ariaLabel={surface.ariaLabel}
        tabs={surface.tabs}
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
