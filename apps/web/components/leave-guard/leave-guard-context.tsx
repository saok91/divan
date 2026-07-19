"use client";

import * as React from "react";

export type LeaveGuardRegistration = {
  id: string;
  isDirty: boolean;
  onSave?: () => Promise<boolean>;
  onDiscard?: () => void;
  /** When true, dialog uses import-preview copy with batch id. */
  kind?: "form" | "import-preview";
  previewBatchId?: string;
};

export type PendingNavigation = {
  href: string | null;
  mode: "push" | "history-back";
  resolve: (allowed: boolean) => void;
};

export type LeaveGuardContextValue = {
  upsert: (entry: LeaveGuardRegistration) => void;
  unregister: (id: string) => void;
  isAnyDirty: boolean;
  /**
   * Returns true if navigation may proceed.
   * When dirty, opens the leave dialog and resolves after Stay/Discard/Save.
   * On allow for href mode, performs router.push.
   */
  requestNavigation: (href: string) => Promise<boolean>;
  dirtyEntries: readonly LeaveGuardRegistration[];
  pending: PendingNavigation | null;
  resolvePending: (
    action: "stay" | "discard" | "save",
  ) => Promise<void>;
  busy: boolean;
};

export const LeaveGuardContext =
  React.createContext<LeaveGuardContextValue | null>(null);

export function useLeaveGuard(): LeaveGuardContextValue {
  const ctx = React.useContext(LeaveGuardContext);
  if (!ctx) {
    throw new Error("useLeaveGuard must be used within LeaveGuardProvider");
  }
  return ctx;
}

/** Safe for chrome that may render outside the provider during tests. */
export function useLeaveGuardOptional(): LeaveGuardContextValue | null {
  return React.useContext(LeaveGuardContext);
}
