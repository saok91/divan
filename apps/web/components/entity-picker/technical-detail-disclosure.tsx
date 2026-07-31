"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TechnicalDetailDisclosureProps = {
  /** Technical identifier (UUID / correlation id) — LTR monospace when expanded. */
  value: string;
  /** Optional caption under the summary (support / audit note). */
  supportCaptionFa?: string;
  /** Optional label for the value row when expanded. */
  valueLabelFa?: string;
  className?: string;
};

/**
 * Collapsed «شناسهٔ فنی» disclosure (DESIGN technical-detail-disclosure).
 * Never open by default; copy is tertiary, not gold primary.
 */
export function TechnicalDetailDisclosure({
  value,
  supportCaptionFa = "فقط برای پشتیبانی و ممیزی",
  valueLabelFa,
  className,
}: TechnicalDetailDisclosureProps) {
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "ok" | "fail">(
    "idle",
  );
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const onCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("ok");
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("fail");
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopyStatus("idle"), 2000);
    }
  }, [value]);

  if (!value.trim()) return null;

  const announce =
    copyStatus === "ok"
      ? "شناسهٔ فنی کپی شد"
      : copyStatus === "fail"
        ? "کپی شناسهٔ فنی ناموفق بود"
        : "";

  return (
    <details
      className={cn(
        "rounded-sm border border-hairline bg-surface-subtle px-3 py-2",
        className,
      )}
      data-slot="technical-detail-disclosure"
    >
      <summary className="text-caption text-text-secondary cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex flex-col gap-0.5">
          <span>شناسهٔ فنی</span>
          {supportCaptionFa ? (
            <span className="text-text-tertiary font-normal">
              {supportCaptionFa}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-sm border border-hairline bg-surface px-2 py-1.5">
        {valueLabelFa ? (
          <span className="text-caption text-text-tertiary shrink-0">
            {valueLabelFa}
          </span>
        ) : null}
        <code
          className="text-identifier min-w-0 flex-1 truncate"
          dir="ltr"
          title={value}
        >
          {value}
        </code>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          aria-label="کپی شناسهٔ فنی"
          onClick={() => void onCopy()}
        >
          {copyStatus === "ok" ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
          {copyStatus === "ok"
            ? "کپی شد"
            : copyStatus === "fail"
              ? "ناموفق"
              : "کپی"}
        </Button>
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </span>
    </details>
  );
}
