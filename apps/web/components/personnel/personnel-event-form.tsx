"use client";

import * as React from "react";

import { JalaliDatePicker } from "@/components/jalali-date-picker";
import {
  ConflictList,
  SensitiveConfirmationDialog,
} from "@/components/personnel/sensitive-confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlatformStatus } from "@/components/platform-status-provider";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Conflict = {
  code: string;
  severity: "blocking" | "warning";
  messageFa: string;
  requiresAck?: boolean;
};

/**
 * Minimal فرم رویداد (UX-DR11) — Story 4.2.
 * Save draft ≠ Finalize. Authoritative events are not editable here.
 */
export function PersonnelEventForm() {
  const formId = React.useId();
  const {
    isGoldCtaBlocked,
    isFinalizeBlockedByAuthzChange,
    setDemoDraftOpen,
    setDemoDraftSaved,
    registerPersonnelDraftSaveHandler,
  } = usePlatformStatus();

  const [personId, setPersonId] = React.useState("");
  const [employmentId, setEmploymentId] = React.useState("");
  const [eventType, setEventType] = React.useState("ScaffoldChangeRecorded");
  const [effectiveDate, setEffectiveDate] = React.useState("");
  const [draftId, setDraftId] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(1);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [conflicts, setConflicts] = React.useState<Conflict[]>([]);
  const [ackCodes, setAckCodes] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const createMut = api.personnelEvent.draftCreate.useMutation();
  const updateMut = api.personnelEvent.draftUpdate.useMutation();
  const deleteMut = api.personnelEvent.draftDelete.useMutation();
  const finalizeMut = api.personnelEvent.finalize.useMutation();
  const evaluateQuery = api.personnelEvent.evaluate.useQuery(
    { draftId: draftId! },
    { enabled: Boolean(draftId) && confirmOpen },
  );

  React.useEffect(() => {
    setDemoDraftOpen(Boolean(draftId) || dirty);
  }, [draftId, dirty, setDemoDraftOpen]);

  const saveDraft = React.useCallback(async (): Promise<boolean> => {
    setErrorMsg(null);
    try {
      if (!personId.trim() || !effectiveDate.trim() || !eventType.trim()) {
        setErrorMsg("فرد، نوع رویداد و تاریخ مؤثر الزامی است.");
        return false;
      }
      if (draftId) {
        const updated = await updateMut.mutateAsync({
          draftId,
          expectedVersion: version,
          employmentId: employmentId.trim() || null,
          eventType: eventType.trim(),
          effectiveDate: effectiveDate.trim(),
          payload: {},
        });
        setVersion(updated.version);
        setDraftId(updated.id);
      } else {
        const created = await createMut.mutateAsync({
          personId: personId.trim(),
          employmentId: employmentId.trim() || null,
          eventType: eventType.trim(),
          effectiveDate: effectiveDate.trim(),
          payload: {},
        });
        setDraftId(created.id);
        setVersion(created.version);
      }
      setDirty(false);
      setDemoDraftSaved(true);
      setStatusMsg("پیش‌نویس ذخیره شد (غیررسمی — وضعیت فعلی تغییر نکرد).");
      return true;
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "ذخیره پیش‌نویس ناموفق بود.";
      setErrorMsg(msg);
      return false;
    }
  }, [
    personId,
    employmentId,
    eventType,
    effectiveDate,
    draftId,
    version,
    createMut,
    updateMut,
    setDemoDraftSaved,
  ]);

  React.useEffect(() => {
    registerPersonnelDraftSaveHandler(saveDraft);
    return () => registerPersonnelDraftSaveHandler(null);
  }, [registerPersonnelDraftSaveHandler, saveDraft]);

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  React.useEffect(() => {
    if (evaluateQuery.data?.conflicts) {
      setConflicts(evaluateQuery.data.conflicts as Conflict[]);
    }
  }, [evaluateQuery.data]);

  const blocking = conflicts.some((c) => c.severity === "blocking");
  const warningsNeedingAck = conflicts.filter(
    (c) => c.severity === "warning" && c.requiresAck,
  );
  const ackComplete = warningsNeedingAck.every((w) => ackCodes.has(w.code));
  const finalizeBlocked =
    isGoldCtaBlocked ||
    isFinalizeBlockedByAuthzChange ||
    blocking ||
    !ackComplete;

  async function onFinalizeConfirm() {
    if (!draftId || finalizeBlocked) return;
    setErrorMsg(null);
    try {
      const result = await finalizeMut.mutateAsync({
        draftId,
        expectedVersion: version,
        idempotencyKey: `ui-${draftId}`,
        acknowledgement:
          warningsNeedingAck.length > 0
            ? { warningCodes: [...ackCodes] }
            : undefined,
      });
      if (result.outcome === "finalized") {
        setStatusMsg(
          `نهایی شد. رویداد معتبر: ${result.eventId} (${result.status})`,
        );
        setDraftId(null);
        setVersion(1);
        setDirty(false);
        setDemoDraftOpen(false);
        setConfirmOpen(false);
        setConflicts([]);
      } else if (result.outcome === "pending_review") {
        setStatusMsg(result.messageFa);
        setVersion(result.draft.version);
        setConfirmOpen(false);
      }
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "نهایی‌سازی ناموفق بود.";
      setErrorMsg(msg);
    }
  }

  async function onDelete() {
    if (!draftId) return;
    try {
      await deleteMut.mutateAsync({
        draftId,
        expectedVersion: version,
      });
      setDraftId(null);
      setVersion(1);
      setDirty(false);
      setDemoDraftOpen(false);
      setStatusMsg("پیش‌نویس حذف شد.");
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "حذف پیش‌نویس ناموفق بود.";
      setErrorMsg(msg);
    }
  }

  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-labelledby={`${formId}-title`}
    >
      <header className="space-y-1">
        <h2 id={`${formId}-title`} className="text-title-medium">
          فرم رویداد پرسنلی
        </h2>
        <p className="text-body text-muted-foreground">
          ذخیره پیش‌نویس وضعیت فعلی را تغییر نمی‌دهد. نهایی‌سازی رویداد معتبر
          می‌سازد.
        </p>
      </header>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void saveDraft();
        }}
        onChange={() => setDirty(true)}
      >
        <fieldset className="space-y-3">
          <legend className="text-label-medium">شناسه‌ها</legend>
          <label className="block space-y-1">
            <span className="text-label-medium">
              شناسه فرد <span className="text-destructive">*</span>
            </span>
            <Input
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              required
              dir="ltr"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-label-medium">شناسه همکاری (اختیاری)</span>
            <Input
              value={employmentId}
              onChange={(e) => setEmploymentId(e.target.value)}
              dir="ltr"
              autoComplete="off"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-label-medium">رویداد</legend>
          <label className="block space-y-1">
            <span className="text-label-medium">
              نوع رویداد <span className="text-destructive">*</span>
            </span>
            <Input
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              required
              dir="ltr"
              autoComplete="off"
            />
          </label>
          <div className="space-y-1">
            <span className="text-label-medium">
              تاریخ مؤثر <span className="text-destructive">*</span>
            </span>
            <p className="text-xs text-muted-foreground">
              متمایز از زمان ثبت/نهایی‌سازی — فقط روز تقویمی.
            </p>
            <JalaliDatePicker
              aria-label="تاریخ مؤثر"
              value={effectiveDate || undefined}
              onChange={(v) => {
                setEffectiveDate(v ?? "");
                setDirty(true);
              }}
            />
          </div>
        </fieldset>

        {conflicts.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-label-medium">تعارض‌ها</h3>
            <ConflictList conflicts={conflicts} />
            {warningsNeedingAck.map((w) => (
              <label
                key={w.code}
                className="flex items-start gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ackCodes.has(w.code)}
                  onChange={(e) => {
                    setAckCodes((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(w.code);
                      else next.delete(w.code);
                      return next;
                    });
                  }}
                  aria-describedby={`${formId}-ack-${w.code}`}
                />
                <span id={`${formId}-ack-${w.code}`}>
                  پیامد را می‌پذیرم: {w.messageFa}
                </span>
              </label>
            ))}
          </div>
        ) : null}

        {errorMsg ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMsg}
          </p>
        ) : null}
        {statusMsg ? (
          <p role="status" className="text-sm text-muted-foreground">
            {statusMsg}
          </p>
        ) : null}

        <footer
          className={cn(
            "flex flex-wrap items-center gap-2 border-t border-border pt-4",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPersonId("");
              setEmploymentId("");
              setEventType("ScaffoldChangeRecorded");
              setEffectiveDate("");
              setDraftId(null);
              setVersion(1);
              setDirty(false);
              setConflicts([]);
              setErrorMsg(null);
              setStatusMsg(null);
              setDemoDraftOpen(false);
            }}
          >
            انصراف
          </Button>
          <Button
            type="submit"
            variant="secondary"
            disabled={createMut.isPending || updateMut.isPending}
          >
            ذخیره پیش‌نویس
          </Button>
          {draftId ? (
            <Button
              type="button"
              variant="outline"
              disabled={deleteMut.isPending}
              onClick={() => void onDelete()}
            >
              حذف پیش‌نویس
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            disabled={!draftId || isFinalizeBlockedByAuthzChange}
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            نهایی‌سازی
          </Button>
        </footer>
      </form>

      <SensitiveConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="تأیید نهایی‌سازی رویداد"
        consequence={
          <div className="space-y-2">
            <p>
              با تأیید، یک رویداد معتبر در دفتر رویداد ثبت می‌شود و قابل ویرایش
              یا حذف مستقیم نیست.
            </p>
            <p className="text-muted-foreground">
              تاریخ مؤثر: {effectiveDate || "—"} · نوع: {eventType}
            </p>
            {evaluateQuery.isLoading ? (
              <p role="status">در حال بررسی تعارض‌ها…</p>
            ) : (
              <ConflictList conflicts={conflicts} />
            )}
          </div>
        }
        confirmDisabled={finalizeBlocked || finalizeMut.isPending}
        blockedReason={
          isFinalizeBlockedByAuthzChange
            ? "نهایی‌سازی تا تأیید تغییر دسترسی ممکن نیست."
            : blocking
              ? "تعارض مسدودکننده وجود دارد."
              : !ackComplete
                ? "تأیید هشدارها الزامی است."
                : isGoldCtaBlocked
                  ? "وضعیت کهنه یا بازمحاسبه مانع نهایی‌سازی است."
                  : undefined
        }
        busy={finalizeMut.isPending}
        onConfirm={onFinalizeConfirm}
      />
    </section>
  );
}
