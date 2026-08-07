import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Panel / section hairline system (Story 8.2 / UX-DR38 / Story 11.5).
 *
 * ## When to use what
 *
 * | Surface | Pattern | Notes |
 * | --- | --- | --- |
 * | List / index with GovernedDataTable | **Full-bleed table** | No card wrapper; hairline row rules only; gutter via `px-content-padding-inline` |
 * | Form tabs (PE register, headcount create, …) | **FormSurfaceHost** + FormLayout | Full-bleed content `surface` plane (mockup `.main`); do **not** nest Panel fill around the form |
 * | Settings rows, side detail, grouped non-table (non-form) | **Panel** | Hairline section edges; default is NOT a bordered card |
 * | Record drawer | width `--drawer-width` (480px) | |
 *
 * ## Content max-widths (locked in 8.2)
 *
 * | Surface type | Max width |
 * | --- | --- |
 * | Event / multi-section form | `max-w-4xl` (≈ 56rem) |
 * | Narrow confirm / single-purpose form | `max-w-xl` |
 * | Full-bleed table / list | none (gutter only) |
 * | Record drawer | `--drawer-width: 480px` |
 */

export type PanelProps = {
  children: ReactNode;
  className?: string;
  /** Optional labelled landmark. */
  "aria-labelledby"?: string;
};

/** Grouped non-table content surface — hairline, no card chrome by default. */
export function Panel({ children, className, ...props }: PanelProps) {
  return (
    <section
      data-slot="panel"
      className={cn("bg-surface text-text-primary", className)}
      {...props}
    >
      {children}
    </section>
  );
}

/**
 * Full-bleed form content plane for tabs sitting on `surface-page` shell
 * (Story 11.5 / UX mockup `.main`). Hosts FormLayout without nested Panel fill.
 * Fills remaining tabpanel height via flex (`flex-1`) so short forms still sit
 * on a continuous content plane — not a content-height island over page gray.
 */
export function FormSurfaceHost({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="form-surface-host"
      className={cn(
        "min-h-0 min-w-0 flex-1 bg-surface text-text-primary",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type PanelSectionProps = {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  titleId?: string;
};

/** Section inside a panel — separated by hairline, not a nested card. */
export function PanelSection({
  children,
  className,
  title,
  titleId,
}: PanelSectionProps) {
  return (
    <div
      data-slot="panel-section"
      className={cn(
        "border-b border-hairline py-form-section-gap last:border-b-0",
        className,
      )}
    >
      {title != null ? (
        <h2 id={titleId} className="text-heading-sm mb-form-section-gap text-text-primary">
          {title}
        </h2>
      ) : null}
      {children}
    </div>
  );
}

/** Full-bleed list host — documents intent; no visual card. */
export function FullBleedTableHost({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="full-bleed-table"
      className={cn("min-w-0 px-content-padding-inline", className)}
    >
      {children}
    </div>
  );
}

/** Event / multi-section form width lock. */
export function FormContentWidth({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-4xl", className)}>{children}</div>
  );
}

/** Narrow confirm / single-purpose form width lock. */
export function NarrowFormContentWidth({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-xl", className)}>{children}</div>
  );
}
