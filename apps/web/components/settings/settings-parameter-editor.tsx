/**
 * Editable settings parameter chrome (Story 10.3).
 * Per-row apply/reset with FormLayout confirm Dialog, leave-guard.
 * Mutation FeedbackMessage is owned by the domain panel.
 */

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getSettingsParameter } from "@divan/app-settings/registry";
import {
  invalidSettingsValueMessageFa,
  validateSettingsValue,
} from "@divan/app-settings/validate";
import { RotateCcw } from "lucide-react";

import {
  FormField,
  FormFooter,
  FormLayout,
  FormSection,
} from "@/components/form-layout";
import { useLeaveGuardOptional } from "@/components/leave-guard";
import { useLeaveGuardRegistration } from "@/components/leave-guard/use-leave-guard-registration";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RowActionButton } from "@/components/ui/row-action-button";
import { formatJalaliDateTimeFromIso } from "@/lib/jalali";
import { initialDraft, shouldRefreshSettingsDraft, isDraftDirty } from "@/lib/settings-draft";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import {
  settingsApplyAuditHref,
  settingsHistoryAuditHref,
  settingsResetAuditHref,
} from "@/lib/settings-audit-href";
import type { SettingsParameterRowDto } from "@/lib/settings-types";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export type SettingsMutationFeedback = {
  kind: "success" | "error";
  message: string;
  /** Live deep-link to investigation (Story 10.5). */
  auditHref?: string;
  /** Optional history prefix search. */
  historyHref?: string;
};

type SettingsParameterEditorProps = {
  row: SettingsParameterRowDto;
  storeUnavailable: boolean;
  onRowUpdated: (row: SettingsParameterRowDto) => void;
  onFeedback: (feedback: SettingsMutationFeedback) => void;
};

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
  } else if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) {
    text = toPersianDigits(value);
  } else {
    text = String(value);
  }
  if (unitFa) return `${text} ${unitFa}`;
  return text;
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

function draftToCandidate(
  row: SettingsParameterRowDto,
  draft: string | string[],
): unknown {
  if (row.valueType === "string_list") {
    return Array.isArray(draft) ? draft : [];
  }
  if (row.valueType === "number" || row.valueType === "duration_ms") {
    const raw = typeof draft === "string" ? draft.trim() : "";
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (row.valueType === "boolean") {
    return draft === "true";
  }
  return typeof draft === "string" ? draft : String(draft);
}

type ConfirmMode = "apply" | "reset" | null;

export function SettingsParameterEditor({
  row,
  storeUnavailable,
  onRowUpdated,
  onFeedback,
}: SettingsParameterEditorProps) {
  const fieldId = useId();
  const leaveGuard = useLeaveGuardOptional();
  const utils = api.useUtils();

  const [draft, setDraft] = useState<string | string[]>(() => initialDraft(row));
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);
  const [reason, setReason] = useState("");
  const [blastAck, setBlastAck] = useState(false);

  const candidate = draftToCandidate(row, draft);
  let def = null;
  try {
    def = getSettingsParameter(row.key);
  } catch {
    def = null;
  }
  const parsed = def != null ? validateSettingsValue(def, candidate) : null;
  const clientValid = parsed != null;
  const validationError =
    !clientValid && def
      ? invalidSettingsValueMessageFa(def)
      : !clientValid
        ? operationalCopy.settingsValueInvalid
        : null;

  const dirtySimple = isDraftDirty(row, draft);
  const isDirty = dirtySimple || confirmMode != null;
  const busyRef = useRef(false);
  const rowVersion = JSON.stringify([row.key, row.value, row.source, row.lastChangedAtIso]);
  const [previousRow, setPreviousRow] = useState({ row, version: rowVersion });
  if (previousRow.version !== rowVersion) {
    setPreviousRow({ row, version: rowVersion });
    // Refresh clean forms, but never erase edits due to another row's refetch.
    if (shouldRefreshSettingsDraft(previousRow.row, row, draft, confirmMode != null)) {
      setDraft(initialDraft(row)); setConfirmMode(null); setReason(""); setBlastAck(false);
    }
  }

  useLeaveGuardRegistration({
    id: `settings-row-${row.key}`,
    isDirty,
    onDiscard: () => {
      // Do not clear chrome while a mutation is in flight (would still commit).
      if (busyRef.current) return;
      setDraft(initialDraft(row));
      setConfirmMode(null);
      setReason("");
      setBlastAck(false);
    },
  });

  const applyMutation = api.settings.applyParameter.useMutation({
    onSuccess: async (data) => {
      setDraft(initialDraft(data.row));
      onRowUpdated(data.row);
      onFeedback({
        kind: "success",
        message: operationalCopy.settingsApplySuccess,
        auditHref: settingsApplyAuditHref(data.correlationId),
        historyHref: settingsHistoryAuditHref(row.key),
      });
      setConfirmMode(null);
      setReason("");
      setBlastAck(false);
      await utils.settings.listByDomain.invalidate();
    },
    onError: (err) => {
      onFeedback({
        kind: "error",
        message: err.message || operationalCopy.settingsApplyError,
      });
    },
  });

  const resetMutation = api.settings.reset.useMutation({
    onSuccess: async (data) => {
      setDraft(initialDraft(data.row));
      onRowUpdated(data.row);
      onFeedback({
        kind: "success",
        message: operationalCopy.settingsResetSuccess,
        auditHref: settingsResetAuditHref(data.correlationId),
        historyHref: settingsHistoryAuditHref(row.key),
      });
      setConfirmMode(null);
      setReason("");
      setBlastAck(false);
      await utils.settings.listByDomain.invalidate();
    },
    onError: (err) => {
      onFeedback({
        kind: "error",
        message: err.message || operationalCopy.settingsResetError,
      });
    },
  });

  const busy = applyMutation.isPending || resetMutation.isPending;
  useEffect(() => { busyRef.current = busy; }, [busy]);
  // Override metadata may exist even when warm degraded to code_default.
  const atDefault =
    row.source === "code_default" && row.lastChangedAtIso == null;
  const reasonOk = reason.trim().length >= 10;
  const needsBlast = row.highImpact === true;
  const blastOk = !needsBlast || blastAck;
  const canCommitApply =
    clientValid && reasonOk && blastOk && !busy && !storeUnavailable;
  const canCommitReset = reasonOk && blastOk && !busy && !storeUnavailable;

  const dialogOpen = confirmMode != null && leaveGuard?.pending == null;
  const catalog = row.allowlist ?? [];

  function openApplyConfirm() {
    if (storeUnavailable || !clientValid || !dirtySimple) return;
    setBlastAck(false);
    setReason("");
    setConfirmMode("apply");
  }

  function openResetConfirm() {
    if (storeUnavailable || atDefault) return;
    setBlastAck(false);
    setReason("");
    setConfirmMode("reset");
  }

  function submitConfirm() {
    if (confirmMode === "apply") {
      if (!canCommitApply || parsed == null) return;
      const valueForApi: string | number | boolean | string[] = Array.isArray(
        parsed,
      )
        ? [...parsed]
        : (parsed as string | number | boolean);
      applyMutation.mutate({
        key: row.key,
        value: valueForApi,
        reason: reason.trim(),
      });
      return;
    }
    if (confirmMode === "reset") {
      if (!canCommitReset) return;
      resetMutation.mutate({
        key: row.key,
        reason: reason.trim(),
      });
    }
  }

  function toggleListItem(item: string) {
    if (!Array.isArray(draft)) return;
    setDraft(
      draft.includes(item)
        ? draft.filter((x) => x !== item)
        : [...draft, item],
    );
  }

  const applyDisabledReason = storeUnavailable
    ? operationalCopy.settingsEditDisabledStore
    : !dirtySimple
      ? "تغییری برای اعمال نیست."
      : !clientValid
        ? (validationError ?? operationalCopy.settingsValueInvalid)
        : undefined;

  return (
    <div
      className="grid gap-3 border-b border-hairline py-4 last:border-b-0 md:grid-cols-[1fr_348px]"
      data-settings-key={row.key}
      data-editability={row.editability}
      data-editable="true"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-body-medium text-foreground">{row.labelFa}</h3>
          <span className="text-caption text-text-secondary">
            {operationalCopy.settingsEditabilityAdmin}
          </span>
        </div>
        <p className="text-caption text-text-secondary">{row.descriptionFa}</p>
        <p className="text-caption text-text-tertiary">
          {sourceLabelFa(row.source)}
          {" · "}
          پیش‌فرض: {formatScalar(row.defaultValue, row.valueType, row.unitFa)}
          {" · "}
          آخرین تغییر: {formatLastChange(row)}
        </p>
      </div>

      <div className="min-w-0 space-y-2 md:border-s md:border-hairline md:ps-4">
        <FormLayout className="mx-0 max-w-none space-y-3 px-0 py-0 pb-0">
          <FormSection title={row.labelFa} className="space-y-2">
            {row.valueType === "string_list" ? (
              <FormField
                label="فهرست مجاز"
                htmlFor={`${fieldId}-list`}
                error={dirtySimple && validationError ? validationError : null}
              >
                <div
                  id={`${fieldId}-list`}
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={row.labelFa}
                >
                  {catalog.map((item) => {
                    const selected =
                      Array.isArray(draft) && draft.includes(item);
                    return (
                      <Button
                        key={item}
                        type="button"
                        size="xs"
                        variant={selected ? "primary" : "outline"}
                        disabled={storeUnavailable || busy}
                        disabledReason={
                          storeUnavailable
                            ? operationalCopy.settingsEditDisabledStore
                            : "در حال انجام عملیات…"
                        }
                        aria-pressed={selected}
                        onClick={() => toggleListItem(item)}
                      >
                        {item}
                      </Button>
                    );
                  })}
                </div>
              </FormField>
            ) : row.valueType === "boolean" ? (
              <FormField
                label="مقدار"
                htmlFor={`${fieldId}-bool`}
                error={dirtySimple && validationError ? validationError : null}
              >
                <select
                  id={`${fieldId}-bool`}
                  className="h-9 w-full rounded-sm border border-input bg-transparent px-3 text-sm"
                  value={typeof draft === "string" ? draft : "false"}
                  disabled={storeUnavailable || busy}
                  onChange={(e) => setDraft(e.target.value)}
                >
                  <option value="true">بله</option>
                  <option value="false">خیر</option>
                </select>
              </FormField>
            ) : (
              <FormField
                label="مقدار"
                htmlFor={`${fieldId}-value`}
                help={
                  row.range
                    ? `حداقل ${toPersianDigits(String(row.range.min ?? "—"))} · حداکثر ${toPersianDigits(String(row.range.max ?? "—"))}`
                    : row.unitFa
                }
                error={dirtySimple && validationError ? validationError : null}
              >
                <Input
                  id={`${fieldId}-value`}
                  type={row.valueType === "duration_ms" ? "text" : "number"}
                  inputMode="numeric"
                  autoComplete="off"
                  value={typeof draft === "string" ? draft : ""}
                  disabled={storeUnavailable || busy}
                  aria-invalid={Boolean(dirtySimple && validationError)}
                  className={cn(
                    dirtySimple &&
                      validationError &&
                      "border-destructive focus-visible:ring-destructive/30",
                  )}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </FormField>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={
                  storeUnavailable || busy || !dirtySimple || !clientValid
                }
                disabledReason={applyDisabledReason}
                onClick={openApplyConfirm}
              >
                {operationalCopy.settingsApplyOpenConfirm}
              </Button>
              <RowActionButton
                label={operationalCopy.settingsResetLabel}
                icon={RotateCcw}
                disabled={storeUnavailable || atDefault || busy}
                disabledReason={
                  storeUnavailable
                    ? operationalCopy.settingsEditDisabledStore
                    : atDefault
                      ? operationalCopy.settingsResetDisabledReason
                      : operationalCopy.settingsResetLabel
                }
                onClick={openResetConfirm}
              />
              <a
                href={settingsHistoryAuditHref(row.key)}
                className="text-caption text-primary underline-offset-2 hover:underline"
                title={operationalCopy.settingsAuditLinkHint}
              >
                {operationalCopy.settingsParameterHistoryCta}
              </a>
            </div>
          </FormSection>
        </FormLayout>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setConfirmMode(null);
            setReason("");
            setBlastAck(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmMode === "reset"
                ? operationalCopy.settingsResetConfirmTitle
                : operationalCopy.settingsApplyConfirmTitle}
            </DialogTitle>
            <DialogDescription>
              {needsBlast
                ? operationalCopy.settingsHighImpactConfirm
                : row.labelFa}
            </DialogDescription>
          </DialogHeader>

          <FormLayout className="mx-0 max-w-none space-y-4 px-0 py-0 pb-0">
            <FormSection title={row.labelFa}>
              <FormField label={operationalCopy.settingsPreviousValue}>
                <p className="text-body text-foreground" data-settings-previous>
                  {formatScalar(row.value, row.valueType, row.unitFa)}
                </p>
              </FormField>
              <FormField label={operationalCopy.settingsNewValue}>
                <p className="text-body text-foreground" data-settings-new>
                  {confirmMode === "apply" && parsed != null
                    ? formatScalar(
                        Array.isArray(parsed)
                          ? [...parsed]
                          : (parsed as string | number | boolean),
                        row.valueType,
                        row.unitFa,
                      )
                    : formatScalar(row.defaultValue, row.valueType, row.unitFa)}
                </p>
              </FormField>
              {needsBlast && row.blastRadiusFa ? (
                <FormField label={operationalCopy.settingsBlastRadiusLabel}>
                  <p
                    className="text-body text-foreground"
                    data-settings-blast-radius
                    role="note"
                  >
                    {row.blastRadiusFa}
                  </p>
                </FormField>
              ) : null}
              {needsBlast ? (
                <label className="flex items-start gap-2 text-caption text-foreground">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={blastAck}
                    disabled={busy}
                    onChange={(e) => setBlastAck(e.target.checked)}
                  />
                  <span>{operationalCopy.settingsConfirmUnderstood}</span>
                </label>
              ) : null}
              <FormField
                label={operationalCopy.settingsReasonLabel}
                htmlFor={`${fieldId}-reason`}
                required
                help={operationalCopy.settingsReasonHelp}
                error={
                  reason.trim().length > 0 && !reasonOk
                    ? operationalCopy.settingsReasonTooShort
                    : null
                }
              >
                <textarea
                  id={`${fieldId}-reason`}
                  value={reason}
                  disabled={busy}
                  rows={3}
                  className="min-h-20 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onChange={(e) => setReason(e.target.value)}
                />
              </FormField>
            </FormSection>
            <FormFooter className="static translate-y-0 border-0 bg-transparent p-0 shadow-none">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                disabledReason="در حال انجام عملیات…"
                onClick={() => {
                  setConfirmMode(null);
                  setReason("");
                  setBlastAck(false);
                }}
              >
                {operationalCopy.settingsCancel}
              </Button>
              <Button
                type="button"
                disabled={
                  confirmMode === "apply" ? !canCommitApply : !canCommitReset
                }
                disabledReason={
                  busy
                    ? "در حال انجام عملیات…"
                    : !reasonOk
                      ? operationalCopy.settingsReasonTooShort
                      : needsBlast && !blastAck
                        ? operationalCopy.settingsHighImpactConfirm
                        : confirmMode === "apply" && !clientValid
                          ? (validationError ??
                            operationalCopy.settingsValueInvalid)
                          : storeUnavailable
                            ? operationalCopy.settingsEditDisabledStore
                            : "اعمال هنوز آماده نیست."
                }
                onClick={submitConfirm}
              >
                {confirmMode === "reset"
                  ? operationalCopy.settingsResetLabel
                  : operationalCopy.settingsApplyCta}
              </Button>
            </FormFooter>
          </FormLayout>
        </DialogContent>
      </Dialog>
    </div>
  );
}
