import * as React from "react";

import { cn } from "@/lib/utils";

type SkeletonProps = React.ComponentProps<"div"> & {
  /** When true, applies shimmer (honors prefers-reduced-motion via CSS). */
  shimmer?: boolean;
};

/**
 * Loading placeholder. Shimmer is CSS-driven and disabled under reduced motion.
 */
function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-muted",
        shimmer && "animate-skeleton-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
