"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLeaveGuard } from "@/components/leave-guard/leave-guard-context";
import {
  leaveGuardImportPreviewMessage,
  leaveGuardImportStagingMessage,
  operationalCopy,
} from "@/lib/operational-copy";

/**
 * Single leave-guard dialog stack — Stay · Discard · Save (when onSave exists).
 * Esc = Stay (cancel leave). Pattern after authz-changed-modal.
 */
export function LeaveGuardDialog() {
  const { pending, dirtyEntries, resolvePending, busy } = useLeaveGuard();
  const open = pending !== null;

  const stagingEntry = dirtyEntries.find((e) => e.kind === "import-staging");
  const previewEntry = dirtyEntries.find((e) => e.kind === "import-preview");
  const body =
    stagingEntry?.stagingBatchId != null
      ? leaveGuardImportStagingMessage(stagingEntry.stagingBatchId)
      : previewEntry?.previewBatchId != null
        ? leaveGuardImportPreviewMessage(previewEntry.previewBatchId)
        : operationalCopy.unsavedForm;

  // Save only when every dirty registration can persist (avoid markClean of unsaved entries).
  const canSave =
    dirtyEntries.length > 0 &&
    dirtyEntries.every((e) => typeof e.onSave === "function");
  const saveLabel = canSave
    ? operationalCopy.authzChangedSaveDraft
    : null;

  const titleId = "leave-guard-title";
  const descId = "leave-guard-desc";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void resolvePending("stay");
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-labelledby={titleId}
        aria-describedby={descId}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          void resolvePending("stay");
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle id={titleId}>
            {operationalCopy.leaveGuardTitle}
          </DialogTitle>
          <DialogDescription id={descId}>{body}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            autoFocus
            onClick={() => {
              void resolvePending("stay");
            }}
          >
            {operationalCopy.leaveGuardStay}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              void resolvePending("discard");
            }}
          >
            {operationalCopy.authzChangedDiscard}
          </Button>
          {saveLabel ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                void resolvePending("save");
              }}
            >
              {saveLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
