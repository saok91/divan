"use client";

import * as React from "react";

import { BreakGlassBanner } from "@/components/break-glass-banner";
import { StaleRecalcBanner } from "@/components/stale-recalc-banner";

/**
 * Host for global banners: stale (blocking) above break-glass.
 * Measures stack height into `--banner-stack-height` so main is not obscured.
 */
export function BannerStack() {
  const stackRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = stackRef.current;
    if (!el) return;

    function publishHeight() {
      const height = el?.offsetHeight ?? 0;
      document.documentElement.style.setProperty(
        "--banner-stack-height",
        `${height}px`,
      );
    }

    publishHeight();
    const ro = new ResizeObserver(publishHeight);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty("--banner-stack-height", "0px");
    };
  }, []);

  return (
    <div ref={stackRef} data-banner-stack-inner className="flex w-full flex-col">
      <StaleRecalcBanner />
      <BreakGlassBanner />
    </div>
  );
}
