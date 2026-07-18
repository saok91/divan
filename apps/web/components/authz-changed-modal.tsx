"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { operationalCopy } from "@/lib/operational-copy";
import { usePlatformStatus } from "@/components/platform-status-provider";

/**
 * Mid-session authz change modal (Story 2.6 AC #4 / EXPERIENCE).
 * Exact title: «دسترسی شما تغییر کرد.»
 * Required acknowledgement — Esc does not dismiss (blocking).
 * Story 4.2: real Draft save/discard when فرم رویداد has registered a handler;
 * finalize remains blocked while authz-changed is active.
 *
 * After ack: refresh JWT fingerprint, then go straight to role safe landing.
 * Do NOT hop via `/` + router.refresh() — that caused a redirect/RSC reload loop.
 */
export function AuthzChangedModal({
  landingPath,
}: {
  /** Role safe landing from server layout (post-change role may differ after update). */
  landingPath: string;
}) {
  const router = useRouter();
  const { update } = useSession();
  const {
    authzChanged,
    clearAuthzChanged,
    demoDraftOpen,
    setDemoDraftOpen,
    setDemoDraftSaved,
    isFinalizeBlockedByAuthzChange,
    runPersonnelDraftSave,
  } = usePlatformStatus();
  const [acking, setAcking] = React.useState(false);

  const open = authzChanged;
  const titleId = "authz-changed-title";
  const descId = "authz-changed-desc";

  async function acknowledgeAndRedirect(opts: {
    saveDraft: boolean;
  }) {
    if (acking) return;
    setAcking(true);
    try {
      // Refresh JWT fingerprint first — then clear UI gate.
      await update();
      if (opts.saveDraft) {
        const saved = await runPersonnelDraftSave();
        setDemoDraftSaved(saved);
        if (!saved) {
          setAcking(false);
          return;
        }
      } else {
        setDemoDraftSaved(false);
      }
      setDemoDraftOpen(false);
      clearAuthzChanged();
      // Direct landing — avoid `/` layout redirect + refresh storm.
      router.replace(landingPath || "/dashboard");
    } finally {
      setAcking(false);
    }
  }

  return (
    <Dialog open={open} modal>
      <DialogContent
        showCloseButton={false}
        aria-labelledby={titleId}
        aria-describedby={descId}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle id={titleId}>{operationalCopy.scopeRevoked}</DialogTitle>
          <DialogDescription id={descId} className="sr-only">
            {operationalCopy.scopeRevoked}
          </DialogDescription>
        </DialogHeader>

        <div
          role="status"
          aria-live="assertive"
          className="text-sm text-foreground"
        >
          {demoDraftOpen
            ? operationalCopy.authzChangedDraftHint
            : operationalCopy.authzChangedFinalizeBlocked}
        </div>

        {isFinalizeBlockedByAuthzChange ? (
          <p className="text-sm text-muted-foreground">
            {operationalCopy.authzChangedFinalizeBlocked}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-start">
          {demoDraftOpen ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={acking}
                onClick={() => {
                  void acknowledgeAndRedirect({ saveDraft: true });
                }}
              >
                {operationalCopy.authzChangedSaveDraft}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={acking}
                onClick={() => {
                  void acknowledgeAndRedirect({ saveDraft: false });
                }}
              >
                {operationalCopy.authzChangedDiscard}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="primary"
              disabled={acking}
              onClick={() => void acknowledgeAndRedirect({ saveDraft: false })}
            >
              {operationalCopy.authzChangedAcknowledge}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
