"use client";

import * as React from "react";

import {
  useLeaveGuard,
  type LeaveGuardRegistration,
} from "@/components/leave-guard/leave-guard-context";

type UseLeaveGuardRegistrationArgs = {
  id: string;
  isDirty: boolean;
  onSave?: () => Promise<boolean>;
  onDiscard?: () => void;
  kind?: LeaveGuardRegistration["kind"];
  previewBatchId?: string;
  stagingBatchId?: string;
};

/**
 * Register a dirty surface with the shell leave-guard.
 * Callbacks are held in refs so parent re-renders (e.g. new saveDraft identity)
 * do not re-upsert and loop setState → Maximum update depth.
 */
export function useLeaveGuardRegistration({
  id,
  isDirty,
  onSave,
  onDiscard,
  kind = "form",
  previewBatchId,
  stagingBatchId,
}: UseLeaveGuardRegistrationArgs): void {
  const { upsert, unregister } = useLeaveGuard();
  const onSaveRef = React.useRef(onSave);
  const onDiscardRef = React.useRef(onDiscard);
  const hasSave = typeof onSave === "function";
  const hasDiscard = typeof onDiscard === "function";

  React.useEffect(() => {
    onSaveRef.current = onSave;
    onDiscardRef.current = onDiscard;
  }, [onSave, onDiscard]);

  React.useEffect(() => {
    upsert({
      id,
      isDirty,
      kind,
      previewBatchId,
      stagingBatchId,
      onSave: hasSave
        ? async () => {
            const fn = onSaveRef.current;
            if (!fn) return false;
            return fn();
          }
        : undefined,
      onDiscard: hasDiscard
        ? () => {
            onDiscardRef.current?.();
          }
        : undefined,
    });
  }, [
    upsert,
    id,
    isDirty,
    kind,
    previewBatchId,
    stagingBatchId,
    hasSave,
    hasDiscard,
  ]);

  React.useEffect(() => {
    return () => unregister(id);
  }, [unregister, id]);
}
