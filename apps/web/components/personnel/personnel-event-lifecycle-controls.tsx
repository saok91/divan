"use client";

import * as React from "react";

import { SensitiveConfirmationDialog } from "@/components/personnel/sensitive-confirmation-dialog";
import { Button } from "@/components/ui/button";
import { usePlatformStatus } from "@/components/platform-status-provider";
import { api } from "@/lib/trpc/client";

export type LifecycleOp = "cancel" | "reverse" | "correct";

type PersonnelEventLifecycleControlsProps = {
  eventId: string;
  resolvedStatus: string;
  canCancel: boolean;
  canReverse: boolean;
  canCorrect: boolean;
  onSuccess?: () => void;
};

/**
 * Thin in-profile Cancel / Reverse / Correct (Story 5.3 / UJ-2).
 * Unauthorized ops are absent from DOM (not disabled theater).
 */
export function PersonnelEventLifecycleControls({
  eventId,
  resolvedStatus,
  canCancel,
  canReverse,
  canCorrect,
  onSuccess,
}: PersonnelEventLifecycleControlsProps) {
  const { isMutationBlockedByAuthzChange } = usePlatformStatus();
  const [lifecycleOp, setLifecycleOp] = React.useState<LifecycleOp | null>(
    null,
  );
  const [lifecycleReason, setLifecycleReason] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const utils = api.useUtils();
  const cancelMut = api.personnelEvent.cancel.useMutation();
  const reverseMut = api.personnelEvent.reverse.useMutation();
  const correctMut = api.personnelEvent.correct.useMutation();

  const showCancel = canCancel && resolvedStatus === "Scheduled";
  const showReverse = canReverse && resolvedStatus === "Effective";
  const showCorrect =
    canCorrect &&
    (resolvedStatus === "Scheduled" || resolvedStatus === "Effective");

  if (!showCancel && !showReverse && !showCorrect && !lifecycleOp) {
    return null;
  }

  function openLifecycle(op: LifecycleOp) {
    setLifecycleOp(op);
    setLifecycleReason("");
    setErrorMsg(null);
  }

  async function onLifecycleConfirm() {
    if (!lifecycleOp || !lifecycleReason.trim()) return;
    if (isMutationBlockedByAuthzChange) return;
    setErrorMsg(null);
    try {
      const input = {
        eventId,
        reason: lifecycleReason.trim(),
        idempotencyKey: `ui-timeline-${lifecycleOp}-${eventId}`,
      };
      if (lifecycleOp === "cancel") {
        await cancelMut.mutateAsync(input);
      } else if (lifecycleOp === "reverse") {
        await reverseMut.mutateAsync(input);
      } else {
        await correctMut.mutateAsync(input);
      }
      setLifecycleOp(null);
      setLifecycleReason("");
      await utils.personnelEvent.listForPerson.invalidate();
      onSuccess?.();
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "عملیات چرخه رویداد ناموفق بود.";
      setErrorMsg(
        /[\u0600-\u06FF]/.test(msg)
          ? msg
          : "عملیات چرخه رویداد ناموفق بود. دوباره تلاش کنید.",
      );
    }
  }

  const lifecycleBusy =
    cancelMut.isPending || reverseMut.isPending || correctMut.isPending;

  const lifecycleTitle =
    lifecycleOp === "cancel"
      ? "تأیید لغو رویداد"
      : lifecycleOp === "reverse"
        ? "تأیید بازگشت رویداد"
        : "تأیید اصلاح رویداد";

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {showCancel ? (
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            disabled={isMutationBlockedByAuthzChange}
            onClick={() => openLifecycle("cancel")}
          >
            لغو
          </Button>
        ) : null}
        {showReverse ? (
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            disabled={isMutationBlockedByAuthzChange}
            onClick={() => openLifecycle("reverse")}
          >
            بازگشت
          </Button>
        ) : null}
        {showCorrect ? (
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            disabled={isMutationBlockedByAuthzChange}
            onClick={() => openLifecycle("correct")}
          >
            اصلاح
          </Button>
        ) : null}
      </div>

      {errorMsg ? (
        <p role="alert" className="text-xs text-destructive">
          {errorMsg}
        </p>
      ) : null}

      <SensitiveConfirmationDialog
        open={Boolean(lifecycleOp)}
        onOpenChange={(open) => {
          if (!open) {
            setLifecycleOp(null);
            setLifecycleReason("");
            setErrorMsg(null);
          }
        }}
        title={lifecycleTitle}
        confirmLabel="ثبت"
        consequence={
          <div className="space-y-2">
            <p>
              {lifecycleOp === "cancel"
                ? "این رویداد تاریخچه را پاک نمی‌کند؛ رویداد لغو مرتبط ثبت می‌شود."
                : lifecycleOp === "reverse"
                  ? "این رویداد تاریخچه را پاک نمی‌کند؛ رویداد بازگشت مرتبط ثبت می‌شود."
                  : "این رویداد تاریخچه را پاک نمی‌کند؛ اصلاح مرتبط ثبت می‌شود."}
            </p>
            <p className="text-muted-foreground" dir="ltr">
              هدف: {eventId}
            </p>
          </div>
        }
        reasonRequired
        reason={lifecycleReason}
        onReasonChange={setLifecycleReason}
        confirmDisabled={isMutationBlockedByAuthzChange || lifecycleBusy}
        blockedReason={
          isMutationBlockedByAuthzChange
            ? "عملیات تا تأیید تغییر دسترسی ممکن نیست."
            : undefined
        }
        busy={lifecycleBusy}
        onConfirm={onLifecycleConfirm}
      />
    </>
  );
}
