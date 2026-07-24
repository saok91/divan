"use client";

import { ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

const SENSITIVITY_LABEL_FA: Record<string, string> = {
  ordinary: "عادی",
  high: "بالا",
  sensitive: "حساس",
  confidential: "محرمانه",
};

function sensitivityLabelFa(token: string): string {
  const key = token.toLowerCase();
  return SENSITIVITY_LABEL_FA[key] ?? "حساس";
}

/**
 * Governed-category sensitivity marker (UX-DR8).
 * Render only when dictionary sensitivity is present and not ordinary.
 */
export function PersonProfileSensitivityIcon({
  sensitivity,
  className,
}: {
  sensitivity: string | null | undefined;
  className?: string;
}) {
  const trimmed = sensitivity?.trim() ?? "";
  if (!trimmed || trimmed.toLowerCase() === "ordinary") return null;

  return (
    <ShieldAlert
      className={cn("size-3.5 shrink-0 text-amber-700 dark:text-amber-300", className)}
      aria-label={`حساسیت داده: ${sensitivityLabelFa(trimmed)}`}
      role="img"
    />
  );
}
