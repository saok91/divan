import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  /** Breadcrumb trail — caption typography. */
  breadcrumb?: ReactNode;
  /** Surface title — rendered as h1 with heading typography. */
  title: ReactNode;
  /** Optional result count shown beside the title (caption). */
  resultCount?: ReactNode;
  /** Purpose line slot (Story 8.9 owns copy); caption. */
  purpose?: ReactNode;
  /** Optional id for the heading landmark. */
  id?: string;
  className?: string;
};

/**
 * UX-DR38 page-header — breadcrumb → title (+ count) → purpose.
 * Primary actions belong in the toolbar beneath, never here.
 * No card fill, no divider above section-tabs.
 */
export function PageHeader({
  breadcrumb,
  title,
  resultCount,
  purpose,
  id = "page-header-title",
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "space-y-1 bg-transparent px-content-padding-inline pt-4 pb-3",
        className,
      )}
    >
      {breadcrumb ? (
        <div className="text-caption text-text-secondary">{breadcrumb}</div>
      ) : null}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h1 id={id} className="text-heading text-text-primary">
          {title}
        </h1>
        {resultCount != null && resultCount !== "" ? (
          <span className="text-caption text-text-tertiary">{resultCount}</span>
        ) : null}
      </div>
      {purpose ? (
        <div className="text-caption text-text-secondary">{purpose}</div>
      ) : null}
    </header>
  );
}
