"use client";

import * as React from "react";

import { JalaliDatePicker } from "@/components/jalali-date-picker";
import {
  ConflictList,
  SensitiveConfirmationDialog,
} from "@/components/personnel/sensitive-confirmation-dialog";
import {
  StatusBadge,
  isStatusBadgeKind,
  type StatusBadgeKind,
} from "@/components/personnel/status-badge";
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

type LifecycleOp = "cancel" | "reverse" | "correct";

function formatChainLinksFa(links: {
  cancellations: string[];
  reversals: string[];
  corrections: string[];
}): string | null {
  const parts: string[] = [];
  if (links.cancellations.length > 0) {
    parts.push(
      `لغو: ${links.cancellations.map((id) => id.slice(0, 8)).join("، ")}`,
    );
  }
  if (links.reversals.length > 0) {
    parts.push(
      `بازگشت: ${links.reversals.map((id) => id.slice(0, 8)).join("، ")}`,
    );
  }
  if (links.corrections.length > 0) {
    parts.push(
      `اصلاح: ${links.corrections.map((id) => id.slice(0, 8)).join("، ")}`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Minimal فرم رویداد (UX-DR11) — Stories 4.2–4.3.
 * Save draft ≠ Finalize. Lifecycle Cancel/Reverse/Correct append-only.
 */
export function PersonnelEventForm() {
  const formId = React.useId();
  const {
    isGoldCtaBlocked,
    isFinalizeBlockedByAuthzChange,
    isMutationBlockedByAuthzChange,
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

  const [lifecycleOp, setLifecycleOp] = React.useState<LifecycleOp | null>(
    null,
  );
  const [lifecycleEventId, setLifecycleEventId] = React.useState<string | null>(
    null,
  );
  const [lifecycleReason, setLifecycleReason] = React.useState("");

  const createMut = api.personnelEvent.draftCreate.useMutation();
  const updateMut = api.personnelEvent.draftUpdate.useMutation();
  const deleteMut = api.personnelEvent.draftDelete.useMutation();
  const finalizeMut = api.personnelEvent.finalize.useMutation();
  const cancelMut = api.personnelEvent.cancel.useMutation();
  const reverseMut = api.personnelEvent.reverse.useMutation();
  const correctMut = api.personnelEvent.correct.useMutation();
  const evaluateQuery = api.personnelEvent.evaluate.useQuery(
    { draftId: draftId! },
    { enabled: Boolean(draftId) && confirmOpen },
  );
  const eventsQuery = api.personnelEvent.listForPerson.useQuery(
    { personId: personId.trim(), limit: 20 },
    { enabled: Boolean(personId.trim()) },
  );
  const lifecycleCapsQuery = api.personnelEvent.lifecycleCaps.useQuery();
  const canCancel = lifecycleCapsQuery.data?.cancel === true;
  const canReverse = lifecycleCapsQuery.data?.reverse === true;
  const canCorrect = lifecycleCapsQuery.data?.correct === true;

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
        void eventsQuery.refetch();
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

  function openLifecycle(op: LifecycleOp, eventId: string) {
    setLifecycleOp(op);
    setLifecycleEventId(eventId);
    setLifecycleReason("");
    setErrorMsg(null);
  }

  async function onLifecycleConfirm() {
    if (!lifecycleOp || !lifecycleEventId || !lifecycleReason.trim()) return;
    if (isMutationBlockedByAuthzChange) return;
    setErrorMsg(null);
    try {
      const input = {
        eventId: lifecycleEventId,
        reason: lifecycleReason.trim(),
        idempotencyKey: `ui-${lifecycleOp}-${lifecycleEventId}`,
      };
      if (lifecycleOp === "cancel") {
        const r = await cancelMut.mutateAsync(input);
        setStatusMsg(
          `لغو ثبت شد: ${r.neutralizingEventId} (وضعیت حل‌شده: لغوشده)`,
        );
      } else if (lifecycleOp === "reverse") {
        const r = await reverseMut.mutateAsync(input);
        setStatusMsg(
          `بازگشت ثبت شد: ${r.neutralizingEventId} (وضعیت حل‌شده: بازگشت‌خورده)`,
        );
      } else {
        const r = await correctMut.mutateAsync(input);
        setStatusMsg(
          `اصلاح ثبت شد: ${r.neutralizingEventId} — اصل تاریخچه حفظ می‌شود`,
        );
      }
      setLifecycleOp(null);
      setLifecycleEventId(null);
      setLifecycleReason("");
      void eventsQuery.refetch();
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "عملیات چرخه رویداد ناموفق بود.";
      setErrorMsg(msg);
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
          می‌سازد. لغو/بازگشت/اصلاح اصل را پاک نمی‌کند.
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

      {personId.trim() ? (
        <section
          className="space-y-3 border-t border-border pt-6"
          aria-labelledby={`${formId}-events`}
        >
          <h3 id={`${formId}-events`} className="text-label-medium">
            رویدادهای معتبر (نمایش وضعیت حل‌شده)
          </h3>
          <p className="text-xs text-muted-foreground">
            زمان‌بندی‌شده تا تاریخ مؤثر وضعیت فعلی را تغییر نمی‌دهد. جدول زمانی
            کامل در Epic ۵.۳.
          </p>
          {eventsQuery.isLoading ? (
            <p role="status">در حال بارگذاری…</p>
          ) : eventsQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {eventsQuery.error.message || "بارگذاری رویدادها ناموفق بود."}
            </p>
          ) : (eventsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">رویدادی ثبت نشده است.</p>
          ) : (
            <ul className="space-y-3" role="list">
              {eventsQuery.data?.map((row) => {
                const badge: StatusBadgeKind = isStatusBadgeKind(
                  row.resolvedStatus,
                )
                  ? row.resolvedStatus
                  : "Effective";
                const chainHint = formatChainLinksFa(row.links);
                const showCancel =
                  canCancel && row.resolvedStatus === "Scheduled";
                const showReverse =
                  canReverse && row.resolvedStatus === "Effective";
                const showCorrect =
                  canCorrect &&
                  (row.resolvedStatus === "Scheduled" ||
                    row.resolvedStatus === "Effective");
                return (
                  <li
                    key={row.event.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={badge} />
                        <span className="text-sm font-medium" dir="ltr">
                          {row.event.eventType}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {row.event.id.slice(0, 8)}… · مؤثر{" "}
                        {row.event.effectiveDate}
                      </p>
                      {chainHint ? (
                        <p className="text-xs text-muted-foreground">
                          زنجیره: {chainHint}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {showCancel ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isMutationBlockedByAuthzChange}
                          onClick={() => openLifecycle("cancel", row.event.id)}
                        >
                          لغو
                        </Button>
                      ) : null}
                      {showReverse ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isMutationBlockedByAuthzChange}
                          onClick={() => openLifecycle("reverse", row.event.id)}
                        >
                          بازگشت
                        </Button>
                      ) : null}
                      {showCorrect ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isMutationBlockedByAuthzChange}
                          onClick={() => openLifecycle("correct", row.event.id)}
                        >
                          اصلاح
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

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

      <SensitiveConfirmationDialog
        open={Boolean(lifecycleOp && lifecycleEventId)}
        onOpenChange={(open) => {
          if (!open) {
            setLifecycleOp(null);
            setLifecycleEventId(null);
            setLifecycleReason("");
          }
        }}
        title={lifecycleTitle}
        confirmLabel="ثبت"
        consequence={
          <div className="space-y-2">
            <p>
              این رویداد تاریخچه را پاک نمی‌کند؛ اصلاح مرتبط ثبت می‌شود.
            </p>
            <p className="text-muted-foreground" dir="ltr">
              هدف: {lifecycleEventId}
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
    </section>
  );
}
