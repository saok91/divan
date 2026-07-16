"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type SidebarNavItem = {
  href: string;
  label: string;
};

type AppSidebarProps = {
  /** Pre-filtered by server via getNavItemsForRole — never include forbidden items. */
  navItems: readonly SidebarNavItem[];
};

function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ navItems }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed inset-y-0 inset-inline-start-0 z-30 flex w-sidebar-width flex-col bg-chrome text-chrome-foreground"
      style={{
        paddingTop:
          "calc(var(--chrome-height) + var(--banner-stack-height, 0px))",
      }}
      aria-label="ناوبری اصلی"
    >
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-body-medium focus-ring-chrome",
                isActive
                  ? "border-s-2 border-accent bg-sidebar-active-background"
                  : "border-s-2 border-transparent hover:bg-sidebar-active-background/60",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
