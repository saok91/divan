"use client";

import { getGlossaryEntry, type UiGlossaryKey } from "@/lib/ui-glossary";
import { cn } from "@/lib/utils";

export type GlossaryTermProps = {
  termKey: UiGlossaryKey;
  /** Override visible term label (defaults to glossary termFa). */
  labelFa?: string;
  className?: string;
};

/**
 * Inline domain-term glossary disclosure (Story 8.9).
 * Native details/summary — keyboard operable; distinct from technical UUID disclosure.
 */
export function GlossaryTerm({
  termKey,
  labelFa,
  className,
}: GlossaryTermProps) {
  const entry = getGlossaryEntry(termKey);
  const label = labelFa ?? entry.termFa;

  return (
    <details
      className={cn(
        "inline-block max-w-full rounded-sm border border-hairline bg-surface-subtle px-2 py-1 align-baseline",
        className,
      )}
      data-slot="glossary-term"
      data-term-key={termKey}
    >
      <summary className="text-caption text-text-secondary cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="underline-offset-2 hover:underline">{label}</span>
        <span className="text-text-tertiary mx-1" aria-hidden>
          ·
        </span>
        <span className="text-text-tertiary">تعریف</span>
      </summary>
      <p className="mt-1 max-w-prose text-caption text-text-secondary">
        {entry.definitionFa}
      </p>
    </details>
  );
}
