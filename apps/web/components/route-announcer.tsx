"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { routeAnnounce } from "@/lib/operational-copy";

const SURFACE_LABELS: Record<string, string> = {
  "/dashboard": "داشبورد",
  "/personnel": "پرسنل، جستجو",
  "/organization": "ساختار سازمان",
  "/headcount": "ظرفیت و جذب",
  "/reports": "گزارش‌ها",
  "/import": "ورود داده",
  "/access": "دسترسی‌ها",
  "/audit": "ممیزی",
  "/operations": "عملیات",
  "/correction-cases": "پرونده‌های اصلاح",
};

function labelForPath(pathname: string): string {
  if (SURFACE_LABELS[pathname]) return SURFACE_LABELS[pathname];
  const match = Object.keys(SURFACE_LABELS)
    .sort((a, b) => b.length - a.length)
    .find((href) => pathname === href || pathname.startsWith(`${href}/`));
  return match ? SURFACE_LABELS[match]! : "دیوان";
}

/**
 * Polite live region: announces authenticated surface on route change.
 */
export function RouteAnnouncer() {
  const pathname = usePathname();
  const [message, setMessage] = React.useState("");
  const skipFirst = React.useRef(true);

  React.useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    setMessage(routeAnnounce(labelForPath(pathname)));
  }, [pathname]);

  return (
    <div
      className="sr-only"
      aria-live="polite"
      aria-atomic="true"
      data-route-announcer
    >
      {message}
    </div>
  );
}
