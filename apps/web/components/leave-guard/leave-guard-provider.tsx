"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { LeaveGuardDialog } from "@/components/leave-guard/leave-guard-dialog";
import {
  decideRequestNavigation,
  decideSaveGate,
} from "@/components/leave-guard/leave-guard-algorithm";
import {
  LeaveGuardContext,
  type LeaveGuardContextValue,
  type LeaveGuardRegistration,
  type PendingNavigation,
} from "@/components/leave-guard/leave-guard-context";

type LeaveGuardProviderProps = {
  children: React.ReactNode;
};

function isLeaveGuardState(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    "__divanLeaveGuard" in state &&
    (state as { __divanLeaveGuard?: unknown }).__divanLeaveGuard === true
  );
}

/**
 * Shell-level dirty registry + Persian leave dialog (ماندن · دور انداختن · ذخیره).
 * Theme toggle and sidebar collapse must never call requestNavigation.
 *
 * Leave-guard honesty (Story 8.7):
 * - Second requestNavigation while pending → replace waiter + keep dialog visible
 *   (previous waiter resolves false; operator still sees LeaveGuardDialog).
 * - Save when some dirty entries lack onSave → keep dialog + explicit Persian reason.
 */
export function LeaveGuardProvider({ children }: LeaveGuardProviderProps) {
  const router = useRouter();
  const [registrations, setRegistrations] = React.useState<
    ReadonlyMap<string, LeaveGuardRegistration>
  >(() => new Map());
  const [pending, setPending] = React.useState<PendingNavigation | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [saveBlockedReason, setSaveBlockedReason] = React.useState<
    string | null
  >(null);
  const pendingRef = React.useRef<PendingNavigation | null>(null);
  const busyRef = React.useRef(false);
  const historyTrapArmed = React.useRef(false);
  const allowNextPopRef = React.useRef(false);
  /** Latest committed map for event handlers, before browser input can run. */
  const registrationsLive = React.useRef(registrations);
  React.useLayoutEffect(() => { registrationsLive.current = registrations; }, [registrations]);

  const upsert = React.useCallback((entry: LeaveGuardRegistration) => {
    setRegistrations((prev) => {
      const existing = prev.get(entry.id);
      if (
        existing &&
        existing.isDirty === entry.isDirty &&
        existing.kind === entry.kind &&
        existing.previewBatchId === entry.previewBatchId &&
        Boolean(existing.onSave) === Boolean(entry.onSave) &&
        Boolean(existing.onDiscard) === Boolean(entry.onDiscard)
      ) {
        return prev;
      }
      const next = new Map(prev);
      next.set(entry.id, entry);
      return next;
    });
  }, []);

  const unregister = React.useCallback((id: string) => {
    setRegistrations((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const dirtyEntries = React.useMemo(
    () => [...registrations.values()].filter((e) => e.isDirty),
    [registrations],
  );

  const isAnyDirty = dirtyEntries.length > 0;

  const openPending = React.useCallback((nav: PendingNavigation) => {
    pendingRef.current = nav;
    setPending(nav);
    setSaveBlockedReason(null);
  }, []);

  const markClean = React.useCallback((dirty: LeaveGuardRegistration[]) => {
    setRegistrations((prev) => {
      const next = new Map(prev);
      for (const entry of dirty) {
        const current = next.get(entry.id);
        if (current) {
          next.set(entry.id, { ...current, isDirty: false });
        }
      }
      return next;
    });
  }, []);

  const navigatePush = React.useCallback((href: string) => {
    // Reuse the duplicate history entry so clean-state cleanup cannot cancel
    // an approved navigation with a concurrent history.back().
    const replaceTrap = historyTrapArmed.current;
    historyTrapArmed.current = false;
    if (replaceTrap) router.replace(href);
    else router.push(href);
  }, [router]);

  const proceedNavigation = React.useCallback(
    (current: PendingNavigation) => {
      if (current.mode === "push" && current.href) {
        navigatePush(current.href);
        return;
      }
      if (current.mode === "history-back") {
        // Stack after intercept: [..., Prev, Current, Trap]. go(-2) leaves Current for Prev.
        allowNextPopRef.current = true;
        historyTrapArmed.current = false;
        window.history.go(-2);
      }
    },
    [navigatePush],
  );

  const focusLeaveDialog = React.useCallback(() => {
    // Keep dialog visible and move focus to the Stay CTA after paint
    // (dialog may not be mounted yet on the same turn as openPending).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById("leave-guard-stay")?.focus();
      });
    });
  }, []);

  const clearPendingAndNavigate = React.useCallback(
    (href: string): Promise<boolean> => {
      const previous = pendingRef.current;
      if (previous) {
        previous.resolve(true);
        pendingRef.current = null;
        setPending(null);
        setSaveBlockedReason(null);
      }
      navigatePush(href);
      return Promise.resolve(true);
    },
    [navigatePush],
  );

  const requestNavigation = React.useCallback(
    (href: string): Promise<boolean> => {
      const dirty = [...registrationsLive.current.values()].filter(
        (e) => e.isDirty,
      );
      const decision = decideRequestNavigation({
        dirtyCount: dirty.length,
        hasPending: pendingRef.current !== null,
      });

      if (decision.kind === "navigate-clean") {
        navigatePush(href);
        return Promise.resolve(true);
      }

      if (decision.kind === "clear-pending-and-navigate") {
        return clearPendingAndNavigate(href);
      }

      if (decision.kind === "replace-waiter") {
        const previous = pendingRef.current!;
        // Previous waiter already saw the dialog; resolve it without hiding UI.
        previous.resolve(false);
        return new Promise<boolean>((resolve) => {
          openPending({ href, mode: "push", resolve });
          focusLeaveDialog();
        });
      }

      return new Promise<boolean>((resolve) => {
        openPending({ href, mode: "push", resolve });
      });
    },
    [clearPendingAndNavigate, focusLeaveDialog, openPending, navigatePush],
  );

  const resolvePending = React.useCallback(
    async (action: "stay" | "discard" | "save") => {
      const current = pendingRef.current;
      if (!current || busyRef.current) return;

      if (action === "stay") {
        current.resolve(false);
        pendingRef.current = null;
        setPending(null);
        setSaveBlockedReason(null);
        return;
      }

      const dirty = [...registrationsLive.current.values()].filter(
        (e) => e.isDirty,
      );

      if (action === "discard") {
        for (const entry of dirty) {
          entry.onDiscard?.();
        }
        markClean(dirty);
        current.resolve(true);
        pendingRef.current = null;
        setPending(null);
        setSaveBlockedReason(null);
        proceedNavigation(current);
        return;
      }

      // Save: every dirty entry must expose onSave (dialog gates this; defend here too).
      const saveGate = decideSaveGate({
        everyDirtyHasOnSave: dirty.every((e) => typeof e.onSave === "function"),
      });
      if (saveGate.kind === "blocked-no-save") {
        setSaveBlockedReason(saveGate.reason);
        focusLeaveDialog();
        return;
      }

      busyRef.current = true;
      setBusy(true);
      setSaveBlockedReason(null);
      try {
        for (const entry of dirty) {
          const ok = await entry.onSave!();
          if (!ok) {
            // Stay on page; keep dialog open for retry / Stay / Discard (spec).
            return;
          }
        }
        markClean(dirty);
        current.resolve(true);
        pendingRef.current = null;
        setPending(null);
        proceedNavigation(current);
      } catch {
        // Keep dialog open; caller can Stay / retry / Discard.
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [focusLeaveDialog, markClean, proceedNavigation],
  );

  React.useEffect(() => {
    if (!isAnyDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isAnyDirty]);

  React.useEffect(() => {
    if (!isAnyDirty) {
      // Drop orphan trap entry when dirty clears in place (save without leave).
      if (historyTrapArmed.current && isLeaveGuardState(window.history.state)) {
        allowNextPopRef.current = true;
        historyTrapArmed.current = false;
        window.history.back();
      } else {
        historyTrapArmed.current = false;
      }
      return;
    }

    if (!historyTrapArmed.current) {
      window.history.pushState({ __divanLeaveGuard: true }, "");
      historyTrapArmed.current = true;
    }
  }, [isAnyDirty]);

  React.useEffect(() => {
    const onPopState = () => {
      if (allowNextPopRef.current) {
        allowNextPopRef.current = false;
        return;
      }
      if (![...registrationsLive.current.values()].some((entry) => entry.isDirty)) return;
      // Re-arm trap so Stay keeps the user on this page (same URL pushState).
      window.history.pushState({ __divanLeaveGuard: true }, "");
      historyTrapArmed.current = true;
      if (pendingRef.current) return;
      openPending({
        href: null,
        mode: "history-back",
        resolve: () => {
          /* resolved via resolvePending */
        },
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [openPending]);

  const value = React.useMemo<LeaveGuardContextValue>(
    () => ({
      upsert,
      unregister,
      isAnyDirty,
      requestNavigation,
      dirtyEntries,
      pending,
      resolvePending,
      busy,
      saveBlockedReason,
    }),
    [
      upsert,
      unregister,
      isAnyDirty,
      requestNavigation,
      dirtyEntries,
      pending,
      resolvePending,
      busy,
      saveBlockedReason,
    ],
  );

  return (
    <LeaveGuardContext.Provider value={value}>
      {children}
      <LeaveGuardDialog />
    </LeaveGuardContext.Provider>
  );
}
