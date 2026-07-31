import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * UX-DR30 / FR-58 control contract — action semantics → appearance:
 *
 * | Semantics                      | Variant       | DESIGN token / notes                                      |
 * | ------------------------------ | ------------- | --------------------------------------------------------- |
 * | Primary CTA                    | `primary`     | Gold (`button-primary`); **one per surface region**; ~32px |
 * | Secondary / draft / parallel   | `secondary`   | Blue (`button-secondary`)                                 |
 * | Default toolbar / non-primary  | `tertiary`    | Surface + control border (`button-tertiary`)              |
 * | Row action                     | `rowAction`   | Outlined at rest (`row-action-button`); compact ~24px     |
 * | Destructive                    | `destructive` | Typed destructive; still confirm via existing dialogs     |
 * | Dialog cancel / inline dismiss | `ghost`       | **Only** allowed `ghost` contexts                         |
 * | Text link                      | `link`        | Not a row/toolbar substitute                              |
 * | Deprecated alias of tertiary   | `outline`     | Same classes as `tertiary` (one-story compat)             |
 *
 * Leave-guard Discard uses `tertiary` (not `ghost`). Stay remains the sole gold CTA there.
 * Pagination / filter chrome uses `tertiary` — never `ghost`.
 * When `disabled` + `disabledReason`, reason is exposed via wrapper `title` +
 * `aria-describedby` + visually hidden helper (hover reaches the wrapper).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-body-medium transition-colors disabled:pointer-events-none disabled:opacity-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-foreground hover:brightness-95 rounded-md border border-transparent disabled:bg-disabled-surface disabled:text-disabled-foreground disabled:border-hairline",
        secondary:
          "bg-primary text-primary-foreground hover:brightness-95 rounded-md border border-transparent disabled:bg-disabled-surface disabled:text-disabled-foreground disabled:border-hairline",
        tertiary:
          "border border-control-border bg-background text-foreground shadow-xs hover:bg-muted rounded-md disabled:bg-disabled-surface disabled:text-disabled-foreground disabled:border-hairline",
        /** @deprecated Alias of `tertiary` — prefer `tertiary` for new call sites. */
        outline:
          "border border-control-border bg-background text-foreground shadow-xs hover:bg-muted rounded-md disabled:bg-disabled-surface disabled:text-disabled-foreground disabled:border-hairline",
        rowAction:
          "border border-control-border bg-background text-foreground hover:bg-muted rounded-sm disabled:bg-disabled-surface disabled:text-disabled-foreground disabled:border-hairline",
        destructive:
          "bg-destructive text-white hover:brightness-95 rounded-md border border-transparent disabled:bg-disabled-surface disabled:text-disabled-foreground disabled:border-hairline",
        ghost:
          "hover:bg-muted rounded-md border border-transparent disabled:text-disabled-foreground",
        link: "text-primary underline-offset-4 hover:underline border-transparent disabled:text-disabled-foreground",
      },
      size: {
        default: "h-8 px-4 py-2",
        sm: "h-7 px-3",
        xs: "h-6 px-2 text-caption",
        lg: "h-10 px-6",
        icon: "size-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  disabled,
  disabledReason,
  title,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Persian (or short) reason when the control is disabled — not required on every disabled Button in 8.1. */
    disabledReason?: string;
  }) {
  const Comp = asChild ? Slot : "button";
  const reasonId = React.useId();
  const reason = disabledReason?.trim() || undefined;
  const showReason = Boolean(disabled && reason);
  const describedBy = [
    showReason ? reasonId : null,
    typeof props["aria-describedby"] === "string"
      ? props["aria-describedby"]
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const control = (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
      disabled={disabled}
      title={showReason ? undefined : title}
      aria-describedby={describedBy || undefined}
    />
  );

  if (!showReason || !reason) {
    return control;
  }

  return (
    <span className="inline-flex" title={reason}>
      {control}
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </span>
  );
}

export { Button, buttonVariants };
