"use client";

import { useLeaveGuardOptional } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";

export type CorrectionRequestCtaProps = {
  personId: string;
  /** Visual size — profile header vs timeline chrome. */
  size?: "sm" | "default";
};

/**
 * Shared profile/timeline CTA into correction cases (Story 9.7 / 9.8).
 * Caps query failure ≠ access-denied; no-write → disabledReason.
 */
export function CorrectionRequestCta({
  personId,
  size = "sm",
}: CorrectionRequestCtaProps) {
  const leaveGuard = useLeaveGuardOptional();
  const capsQuery = api.correctionCase.capabilities.useQuery(undefined, { retry: false });

  const canOpen = capsQuery.data?.write === true;
  const capsLoading = capsQuery.isLoading;
  const capsFailed = capsQuery.isError && capsQuery.error.data?.code !== "FORBIDDEN";

  function navigateCorrection() {
    const href = `/correction-cases?person=${encodeURIComponent(personId)}&open=1`;
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
      return;
    }
    window.location.assign(href);
  }

  if (canOpen) {
    return (
      <Button
        type="button"
        variant="secondary"
        size={size}
        onClick={navigateCorrection}
      >
        {operationalCopy.profileCorrectionRequestCta}
      </Button>
    );
  }

  if (capsFailed) {
    return (
      <FeedbackMessage kind="error">
        {operationalCopy.correctionCaseCapabilitiesError}
      </FeedbackMessage>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      disabled
      disabledReason={
        capsLoading
          ? operationalCopy.actionPending
          : operationalCopy.profileCorrectionRequestDenied
      }
    >
      {operationalCopy.profileCorrectionRequestCta}
    </Button>
  );
}
