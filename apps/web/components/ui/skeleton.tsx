import * as React from "react";

import { cn } from "@/lib/utils";

type SkeletonProps = React.ComponentProps<"div"> & {
  /**
   * When true, applies opacity pulse (honors prefers-reduced-motion via CSS).
   * Renamed from shimmer — DESIGN.md prefers pulse over translate shimmer (Story 8.8).
   */
  pulse?: boolean;
};

/**
 * Loading placeholder. Pulse is CSS-driven and disabled under reduced motion.
 * Default fill uses `--skeleton` token (`bg-skeleton`), not muted.
 */
function Skeleton({ className, pulse = true, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-skeleton",
        pulse && "animate-skeleton-pulse",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
