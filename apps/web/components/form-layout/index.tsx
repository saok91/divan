import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { FieldHelpIcon } from "@/components/form-layout/field-help";
import { cn } from "@/lib/utils";

export { FieldHelpIcon, LabelWithHelp, FILTER_FIELD_LABEL_CLASS } from "@/components/form-layout/field-help";
export type { FieldHelpIconProps } from "@/components/form-layout/field-help";

function fieldHelpAriaLabel(label: ReactNode): string {
  if (typeof label === "string" && label.trim()) {
    return `راهنمای ${label.trim()}`;
  }
  return "راهنمای فیلد";
}

/**
 * Shared form layout chrome (Story 8.2 / UX-DR38).
 *
 * Footer mapping:
 * - Lifecycle (draft/finalize): Cancel (ghost) · Save draft (secondary) · Finalize (primary)
 * - Non-lifecycle: Cancel (ghost) · secondary · primary (single submit)
 * Delete/destructive extras sit between draft and finalize when needed.
 */

export type FormLayoutProps = {
  children: ReactNode;
  className?: string;
  "aria-labelledby"?: string;
};

export function FormLayout({
  children,
  className,
  ...props
}: FormLayoutProps) {
  return (
    <div
      data-slot="form-layout"
      className={cn(
        // pb clears sticky FormFooter so last fields stay reachable
        "mx-auto w-full max-w-4xl space-y-form-section-gap px-content-padding-inline py-4 pb-24",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type FormSectionProps = {
  children: ReactNode;
  title?: ReactNode;
  titleId?: string;
  className?: string;
};

export function FormSection({
  children,
  title,
  titleId,
  className,
}: FormSectionProps) {
  const hasTitle =
    title != null && title !== "" && !(typeof title === "string" && title.trim() === "");

  return (
    <fieldset
      data-slot="form-section"
      className={cn(
        "space-y-form-field-gap border-b border-hairline pb-form-section-gap last:border-b-0",
        className,
      )}
    >
      {hasTitle ? (
        <legend
          id={titleId}
          className="text-heading-sm mb-form-field-gap w-full text-text-primary"
        >
          {title}
        </legend>
      ) : null}
      {children}
    </fieldset>
  );
}

export type FormFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Two-column field: label column (`--form-label-column` 168px) + control.
 * When `htmlFor` is set and `children` is a single element, wires id /
 * aria-required / aria-invalid / aria-describedby onto that control.
 * Help chrome is label-adjacent (`FieldHelpIcon`); errors stay under the control.
 */
export function FormField({
  label,
  htmlFor,
  required,
  help,
  error,
  children,
  className,
}: FormFieldProps) {
  const helpId = htmlFor && help ? `${htmlFor}-help` : undefined;
  const errorId = htmlFor && error ? `${htmlFor}-error` : undefined;
  const describedBy =
    [helpId, errorId].filter(Boolean).join(" ") || undefined;

  const control = (() => {
    if (!htmlFor || !isValidElement(children)) return children;
    const el = children as ReactElement<Record<string, unknown>>;
    const prevDescribed =
      typeof el.props["aria-describedby"] === "string"
        ? el.props["aria-describedby"]
        : undefined;
    const mergedDescribed = [prevDescribed, describedBy]
      .filter(Boolean)
      .join(" ");
    return cloneElement(el, {
      id: (el.props.id as string | undefined) ?? htmlFor,
      "aria-required": required === true ? true : el.props["aria-required"],
      "aria-invalid": error ? true : el.props["aria-invalid"],
      ...(mergedDescribed
        ? { "aria-describedby": mergedDescribed }
        : {}),
    });
  })();

  return (
    <div
      data-slot="form-field"
      className={cn(
        "grid grid-cols-1 items-start gap-2 sm:grid-cols-[var(--form-label-column)_minmax(0,1fr)] sm:gap-form-field-gap",
        className,
      )}
    >
      <div className="inline-flex items-center gap-1 pt-1.5">
        <label
          htmlFor={htmlFor}
          className="text-field-label text-text-primary"
        >
          {label}
          {required ? (
            <span className="text-destructive" aria-hidden>
              {" "}
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (الزامی)</span> : null}
        </label>
        {help ? (
          <FieldHelpIcon
            label={fieldHelpAriaLabel(label)}
            content={help}
            contentId={helpId}
          />
        ) : null}
      </div>
      <div className="min-w-0 space-y-1">
        {control}
        {error ? (
          <p id={errorId} role="alert" className="text-caption text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type FormFooterProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Sticky footer action bar.
 * Visual order for lifecycle: Cancel · Save draft · Finalize (one gold).
 */
export function FormFooter({ children, className }: FormFooterProps) {
  return (
    <footer
      data-slot="form-footer"
      className={cn(
        // Same content plane as form body (mockup .fbar) — not surface-subtle tint band
        "sticky bottom-0 z-10 -mx-content-padding-inline mt-form-section-gap flex flex-wrap items-center gap-2 border-t border-hairline-strong bg-surface px-content-padding-inline py-3",
        className,
      )}
    >
      {children}
    </footer>
  );
}
