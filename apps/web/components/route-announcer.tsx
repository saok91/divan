"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { routeAnnounce } from "@/lib/operational-copy";
import {
  activeTabForPath,
  surfaceForPath,
} from "@/lib/section-tab-surfaces";

/** Non-tabbed surfaces only — tabbed labels come from section-tab-surfaces. */
const SURFACE_LABELS: Record<string, string> = {
  "/dashboard": "داشبورد",
  "/import": "ورود داده",
  "/audit": "ممیزی",
  "/operations": "عملیات",
  "/correction-cases": "پرونده‌های اصلاح",
};

function announceForPath(pathname: string): string {
  const surface = surfaceForPath(pathname);
  if (surface) {
    const tab = activeTabForPath(pathname, surface);
    return routeAnnounce(surface.surfaceLabel, tab?.label);
  }
  if (SURFACE_LABELS[pathname]) {
    return routeAnnounce(SURFACE_LABELS[pathname]!);
  }
  const match = Object.keys(SURFACE_LABELS)
    .sort((a, b) => b.length - a.length)
    .find((href) => pathname === href || pathname.startsWith(`${href}/`));
  return routeAnnounce(match ? SURFACE_LABELS[match]! : "دیوان");
}

/**
 * Polite live region: announces surface + selected tab on route change (UX-DR21).
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
    setMessage(announceForPath(pathname));
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
