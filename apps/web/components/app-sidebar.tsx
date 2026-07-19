"use client";

import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  ChartBar,
  ChevronRight,
  FileBarChart,
  FolderOpen,
  LayoutDashboard,
  Network,
  PanelRightClose,
  PanelRightOpen,
  ScrollText,
  Settings,
  Shield,
  Upload,
  Users,
} from "lucide-react";

import { useLeaveGuardOptional } from "@/components/leave-guard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  readSidebarCollapsed,
  subscribeSidebarCollapsed,
  writeSidebarCollapsed,
} from "@/lib/sidebar-storage";
import { cn } from "@/lib/utils";

export type SidebarNavItem = {
  href: string;
  label: string;
};

type AppSidebarProps = {
  /** Pre-filtered by server via getNavItemsForRole — never include forbidden items. */
  navItems: readonly SidebarNavItem[];
  /** Account id for per-account collapse preference. */
  accountId: string;
};

/** Epic-1 catalog href → Lucide icon. */
const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/personnel": Users,
  "/personnel-events": CalendarClock,
  "/organization": Network,
  "/headcount": ChartBar,
  "/reports": FileBarChart,
  "/import": Upload,
  "/access": Shield,
  "/audit": ScrollText,
  "/operations": Settings,
  "/correction-cases": FolderOpen,
};

function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useSidebarCollapsed(accountId: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      subscribeSidebarCollapsed(accountId, onStoreChange),
    [accountId],
  );
  const getSnapshot = useCallback(
    () => readSidebarCollapsed(accountId),
    [accountId],
  );
  // SSR + first client paint before hydration: expanded (fail open)
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function AppSidebar({ navItems, accountId }: AppSidebarProps) {
  const pathname = usePathname();
  const leaveGuard = useLeaveGuardOptional();
  const asideRef = useRef<HTMLElement>(null);
  const collapsed = useSidebarCollapsed(accountId);

  useLayoutEffect(() => {
    const root = asideRef.current?.closest(".app-shell-root");
    if (!(root instanceof HTMLElement)) return;
    root.dataset.sidebar = collapsed ? "collapsed" : "expanded";
    return () => {
      delete root.dataset.sidebar;
    };
  }, [collapsed]);

  function toggleCollapsed() {
    // 4b.2 leave-guards must exempt sidebar collapse + theme toggle
    writeSidebarCollapsed(accountId, !readSidebarCollapsed(accountId));
  }

  const toggleLabel = collapsed
    ? "باز کردن نوار کناری"
    : "جمع کردن نوار کناری";

  return (
    <TooltipProvider delayDuration={350}>
      <aside
        ref={asideRef}
        className={cn(
          "fixed inset-y-0 inset-inline-start-0 z-30 flex w-sidebar-current-width flex-col bg-chrome text-chrome-foreground",
          "motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out",
        )}
        style={{
          paddingTop:
            "calc(var(--chrome-height) + var(--banner-stack-height, 0px))",
        }}
        aria-label="ناوبری اصلی"
        data-sidebar={collapsed ? "collapsed" : "expanded"}
      >
        <nav
          id="app-sidebar-nav"
          className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
        >
          {navItems.map((item) => {
            const isActive = isNavActive(pathname, item.href);
            const Icon = NAV_ICONS[item.href] ?? ChevronRight;

            const link = (
              <Link
                href={item.href}
                className={cn(
                  "flex h-10 min-w-0 items-center gap-3 overflow-hidden rounded-md px-3 text-body-medium leading-none focus-ring-chrome",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "border-s-2 border-accent bg-sidebar-active-background"
                    : "border-s-2 border-transparent hover:bg-sidebar-active-background/60",
                )}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                onNavigate={(event) => {
                  // Same surface (e.g. /personnel vs /personnel/list): no remount, no leave dialog.
                  if (isNavActive(pathname, item.href)) {
                    event.preventDefault();
                    return;
                  }
                  if (!leaveGuard?.isAnyDirty) return;
                  event.preventDefault();
                  void leaveGuard.requestNavigation(item.href);
                }}
              >
                <Icon
                  className="size-5 shrink-0"
                  aria-hidden
                  strokeWidth={1.75}
                />
                <span
                  className={cn(
                    "min-w-0 truncate leading-none",
                    collapsed && "sr-only",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );

            if (!collapsed) {
              return <div key={item.href}>{link}</div>;
            }

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="left" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-chrome-foreground/15 p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex h-10 w-full min-w-0 items-center gap-3 overflow-hidden rounded-md px-3 text-body-medium leading-none focus-ring-chrome",
              "hover:bg-sidebar-active-background/60",
              collapsed && "justify-center px-2",
            )}
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar-nav"
          >
            {collapsed ? (
              <PanelRightOpen
                className="size-5 shrink-0"
                aria-hidden
                strokeWidth={1.75}
              />
            ) : (
              <PanelRightClose
                className="size-5 shrink-0"
                aria-hidden
                strokeWidth={1.75}
              />
            )}
            <span
              className={cn(
                "min-w-0 truncate leading-none",
                collapsed && "sr-only",
              )}
            >
              {toggleLabel}
            </span>
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
