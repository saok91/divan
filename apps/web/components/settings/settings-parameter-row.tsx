/**
 * Registry-driven settings parameter row (Story 10.2 / DESIGN settings-row).
 * Read-only: plain text + lock + change path for RO — never a disabled fake input.
 * No apply / reset / blast-radius controls (those are Story 10.3).
 */

"use client";

import { Lock } from "lucide-react";

import { formatJalaliDateTimeFromIso } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import type { SettingsParameterRowDto } from "@/lib/settings-types";
import { cn } from "@/lib/utils";

export type SettingsParameterRowView = SettingsParameterRowDto;

function sourceLabelFa(source: SettingsParameterRowDto["source"]): string {
  switch (source) {
    case "store":
      return operationalCopy.settingsSourceStore;
    case "environment":
      return operationalCopy.settingsSourceEnvironment;
    default:
      return operationalCopy.settingsSourceCodeDefault;
  }
}

function formatScalar(
  value: string | number | boolean | string[],
  valueType: string,
  unitFa: string | null,
): string {
  let text: string;
  if (Array.isArray(value)) {
    text = value.join("، ");
  } else if (typeof value === "boolean") {
    text = value ? "بله" : "خیر";
  } else if (typeof value === "number") {
    text = toPersianDigits(String(value));
  } else if (valueType === "duration_ms" && typeof value === "string") {
    text = toPersianDigits(value);
  } else if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) {
    text = toPersianDigits(value);
  } else {
    text = String(value);
  }
  if (unitFa) return `${text} ${unitFa}`;
  return text;
}

function formatRange(
  range: { min?: number; max?: number } | null,
  allowlist: readonly string[] | null,
): string {
  if (allowlist && allowlist.length > 0) {
    return allowlist.join(" · ");
  }
  if (!range) return "—";
  const parts: string[] = [];
  if (range.min != null) parts.push(`حداقل ${toPersianDigits(String(range.min))}`);
  if (range.max != null) parts.push(`حداکثر ${toPersianDigits(String(range.max))}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function formatLastChange(row: SettingsParameterRowDto): string {
  if (!row.lastChangedAtIso) {
    return operationalCopy.settingsNeverChanged;
  }
  const when =
    formatJalaliDateTimeFromIso(row.lastChangedAtIso) || row.lastChangedAtIso;
  const actor = row.lastChangedBy?.trim() || "—";
  return `${actor} · ${when}`;
}

type SettingsParameterRowProps = {
  row: SettingsParameterRowDto;
};

export function SettingsParameterRow({ row }: SettingsParameterRowProps) {
  const isReadOnly = row.editability === "read_only_with_evidence";
  const editabilityLabel = isReadOnly
    ? operationalCopy.settingsEditabilityReadOnly
    : operationalCopy.settingsEditabilityAdmin;

  return (
    <div
      className={cn(
        "grid gap-3 border-b border-hairline py-4 last:border-b-0 md:grid-cols-[1fr_348px]",
        isReadOnly && "bg-surface-subtle/60",
      )}
      data-settings-key={row.key}
      data-editability={row.editability}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-body-medium text-foreground">{row.labelFa}</h3>
          {isReadOnly ? (
            <span
              className="inline-flex items-center gap-1 text-caption text-text-secondary"
              title={row.changePathFa ?? editabilityLabel}
            >
              <Lock className="size-3.5 shrink-0" aria-hidden />
              <span>{editabilityLabel}</span>
            </span>
          ) : (
            <span className="text-caption text-text-secondary">
              {editabilityLabel}
            </span>
          )}
        </div>
        <p className="text-caption text-text-secondary">{row.descriptionFa}</p>
        <p className="text-caption text-text-tertiary">
          {sourceLabelFa(row.source)}
          {" · "}
          پیش‌فرض: {formatScalar(row.defaultValue, row.valueType, row.unitFa)}
          {" · "}
          آخرین تغییر: {formatLastChange(row)}
        </p>
        {isReadOnly && row.changePathFa ? (
          <p className="text-caption text-text-secondary" role="note">
            مسیر تغییر: {row.changePathFa}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 space-y-1 md:border-s md:border-hairline md:ps-4">
        <p className="text-body text-foreground" data-settings-value>
          {formatScalar(row.value, row.valueType, row.unitFa)}
        </p>
        <p className="text-caption text-text-tertiary">
          محدوده / فهرست مجاز: {formatRange(row.range, row.allowlist)}
        </p>
      </div>
    </div>
  );
}
