import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Keeps a mounted surface while a mutation/refetch is in flight.
 * Sets `aria-busy` — does not unmount children into a cold-load skeleton.
 *
 * Filter refetch / save / finalize: use this (or disable the submitting
 * control) rather than swapping the whole table/form for a skeleton.
 */
export function PendingSurface({
  pending,
  children,
  className,
  as: Comp = "div",
}: {
  pending: boolean;
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "form" | "fieldset";
}) {
  return (
    <Comp
      aria-busy={pending || undefined}
      data-pending={pending ? "true" : undefined}
      className={cn(className)}
    >
      {children}
    </Comp>
  );
}

/**
 * Idle vs pending label helper. Pending copy must not imply success
 * (no «ذخیره شد» until the server confirms — use inline success after resolve).
 */
export function pendingLabel(
  pending: boolean,
  idle: string,
  pendingText: string,
): string {
  return pending ? pendingText : idle;
}
