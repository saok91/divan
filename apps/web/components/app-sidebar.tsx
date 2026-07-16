"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Top-level IA surfaces — all visible; role filtering is Story 1.5. */
const NAV_ITEMS = [
  { href: "/", label: "داشبورد" },
  { href: "#", label: "پرسنل" },
  { href: "#", label: "ساختار سازمان" },
  { href: "#", label: "ظرفیت و جذب" },
  { href: "#", label: "گزارش‌ها" },
  { href: "#", label: "ورود داده" },
  { href: "#", label: "دسترسی‌ها" },
  { href: "#", label: "ممیزی" },
  { href: "#", label: "عملیات" },
  { href: "#", label: "پرونده‌های اصلاح" },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed inset-y-0 inset-inline-start-0 z-30 flex w-sidebar-width flex-col bg-chrome pt-chrome-height text-chrome-foreground"
      aria-label="ناوبری اصلی"
    >
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-body-medium focus-ring-chrome",
                isActive
                  ? "border-s-2 border-accent bg-sidebar-active-background"
                  : "border-s-2 border-transparent hover:bg-sidebar-active-background/60",
              )}
              aria-current={isActive ? "page" : undefined}
              onClick={
                item.href === "#"
                  ? (event) => {
                      event.preventDefault();
                    }
                  : undefined
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
