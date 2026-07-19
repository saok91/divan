"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLeaveGuardOptional } from "@/components/leave-guard/leave-guard-context";
import { cn } from "@/lib/utils";

export type SectionTabItem = {
  id: string;
  label: string;
  href: string;
};

export type SectionTabsProps = {
  ariaLabel: string;
  tabs: readonly SectionTabItem[];
  className?: string;
  /** id of the tabpanel region controlled by these tabs */
  panelId?: string;
};

function resolveActiveIndex(pathname: string, tabs: readonly SectionTabItem[]): number {
  const exact = tabs.findIndex((t) => t.href === pathname);
  if (exact >= 0) return exact;
  const prefix = tabs.findIndex(
    (t) => pathname === t.href || pathname.startsWith(`${t.href}/`),
  );
  // -1 when unmatched — do not falsely aria-select tab 0
  return prefix >= 0 ? prefix : -1;
}

/**
 * Shared section-tabs chrome (UX-DR25). URL is source of truth via Link hrefs.
 * Hand-rolled tablist (section-tabs chrome; Story 4b.2).
 */
export function SectionTabs({
  ariaLabel,
  tabs,
  className,
  panelId = "section-tab-panel",
}: SectionTabsProps) {
  const pathname = usePathname();
  const leaveGuard = useLeaveGuardOptional();
  const activeIndex = resolveActiveIndex(pathname, tabs);
  const tabRefs = React.useRef<(HTMLAnchorElement | null)[]>([]);

  const focusTab = React.useCallback((index: number) => {
    const el = tabRefs.current[index];
    el?.focus();
  }, []);

  const onTabKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLAnchorElement>, index: number) => {
      const { key } = event;
      if (key === " " || key === "Spacebar") {
        event.preventDefault();
        event.currentTarget.click();
        return;
      }
      if (
        key !== "ArrowLeft" &&
        key !== "ArrowRight" &&
        key !== "Home" &&
        key !== "End"
      ) {
        return;
      }
      event.preventDefault();
      const last = tabs.length - 1;
      let next = index;
      // RTL visual order: ArrowLeft → next, ArrowRight → previous
      if (key === "ArrowLeft") next = index >= last ? 0 : index + 1;
      else if (key === "ArrowRight") next = index <= 0 ? last : index - 1;
      else if (key === "Home") next = 0;
      else if (key === "End") next = last;
      focusTab(next);
    },
    [focusTab, tabs.length],
  );

  return (
    <div
      className={cn(
        "w-full border-b border-border bg-background",
        className,
      )}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex h-section-tabs-height w-full items-stretch overflow-x-auto"
      >
        {tabs.map((tab, index) => {
          const selected = index === activeIndex;
          const tabDomId = `section-tab-${tab.id}`;
          // When no tab matches the URL, keep the first tab in the tab order.
          const inTabOrder =
            selected || (activeIndex < 0 && index === 0);
          return (
            <Link
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              id={tabDomId}
              href={tab.href}
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={inTabOrder ? 0 : -1}
              className={cn(
                "inline-flex h-full shrink-0 items-center whitespace-nowrap border-b-2 px-4 text-body transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              onNavigate={(event) => {
                if (!leaveGuard?.isAnyDirty) return;
                if (tab.href === pathname) return;
                event.preventDefault();
                void leaveGuard.requestNavigation(tab.href);
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
