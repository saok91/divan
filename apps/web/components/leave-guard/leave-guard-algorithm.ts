/**
 * Pure leave-guard navigation decisions (Story 8.7 / FR-58 / LG-6).
 * Keeps dialog-or-reason honesty testable without React/router.
 */

export type LeaveGuardRequestDecision =
  | { kind: "navigate-clean" }
  | { kind: "clear-pending-and-navigate" }
  | { kind: "open-dialog" }
  | { kind: "replace-waiter" };

/**
 * When dirty work exists and a dialog is already open, never resolve false
 * with zero UI — keep/replace the waiter so the operator still sees the dialog.
 * When dirty has cleared but a dialog is still pending, clear that waiter then navigate.
 */
export function decideRequestNavigation(input: {
  dirtyCount: number;
  hasPending: boolean;
}): LeaveGuardRequestDecision {
  if (input.dirtyCount === 0) {
    return input.hasPending
      ? { kind: "clear-pending-and-navigate" }
      : { kind: "navigate-clean" };
  }
  if (input.hasPending) return { kind: "replace-waiter" };
  return { kind: "open-dialog" };
}

export type LeaveGuardSaveGate =
  | { kind: "proceed" }
  | { kind: "blocked-no-save"; reason: string };

/** Persian reason when Save is reached but some dirty entries lack onSave. */
export const LEAVE_GUARD_SAVE_UNAVAILABLE_REASON =
  "ذخیره برای این تغییرات در دسترس نیست. «ماندن» یا «دور انداختن» را انتخاب کنید.";

/**
 * Save must never silent-return. Either proceed or keep dialog with an explicit reason.
 */
export function decideSaveGate(input: {
  everyDirtyHasOnSave: boolean;
}): LeaveGuardSaveGate {
  if (!input.everyDirtyHasOnSave) {
    return {
      kind: "blocked-no-save",
      reason: LEAVE_GUARD_SAVE_UNAVAILABLE_REASON,
    };
  }
  return { kind: "proceed" };
}
