"use client";

import { useRouter } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Button } from "@/components/ui/button";
import {
  emptyStateCopy,
  type EmptyStateKind,
} from "@/lib/empty-state";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  kind: EmptyStateKind;
  /** Override body for filtered/notPermitted — ignored for taxonomy defaults when unset. */
  messageFa?: string;
  /** Surface-specific no-data-yet body (and title). */
  noDataYetBodyFa?: string;
  noDataYetActionFa?: string;
  onAction?: () => void;
  className?: string;
};

/**
 * Empty taxonomy renderer (Story 8.9). Uses FeedbackMessage empty channel.
 */
export function EmptyState({
  kind,
  messageFa,
  noDataYetBodyFa,
  noDataYetActionFa,
  onAction,
  className,
}: EmptyStateProps) {
  const router = useRouter();
  const copy = emptyStateCopy(kind, { noDataYetBodyFa, noDataYetActionFa });
  const body =
    kind === "noDataYet"
      ? (noDataYetBodyFa ?? messageFa ?? copy.bodyFa)
      : (messageFa ?? copy.bodyFa);
  const showTitle =
    kind === "notPermitted" &&
    copy.titleFa !== body &&
    Boolean(copy.titleFa.trim());
  const actionLabel =
    kind === "noDataYet"
      ? (noDataYetActionFa ?? copy.actionLabelFa)
      : copy.actionLabelFa;
  const resolvedAction =
    onAction ??
    (kind === "notPermitted"
      ? () => {
          router.push("/");
        }
      : undefined);

  return (
    <div
      className={cn("flex flex-col items-center gap-3 py-4 text-center", className)}
      data-empty-kind={kind}
    >
      {showTitle ? (
        <p className="text-body font-medium text-foreground">{copy.titleFa}</p>
      ) : null}
      <FeedbackMessage kind="empty">{body}</FeedbackMessage>
      {actionLabel && resolvedAction ? (
        <Button type="button" variant="secondary" size="sm" onClick={resolvedAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
