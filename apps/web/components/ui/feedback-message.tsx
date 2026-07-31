import { cn } from "@/lib/utils";

export type FeedbackMessageKind =
  | "loading"
  | "pending"
  | "error"
  | "empty"
  | "info"
  | "success";

export type FeedbackMessageProps = {
  kind: FeedbackMessageKind;
  children: React.ReactNode;
  className?: string;
};

/**
 * Shared inline feedback message (UX-DR39 / Story 8.8).
 *
 * Precedence: field / form / row results use this channel — not toast.
 * `pending` / `loading` must never read as committed success.
 * `success` is only for server-confirmed outcomes (optimistic nothing).
 */
export function FeedbackMessage({
  kind,
  children,
  className,
}: FeedbackMessageProps) {
  const isError = kind === "error";
  const isSuccess = kind === "success";

  return (
    <p
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      data-feedback-kind={kind}
      className={cn(
        "text-body-medium",
        isError
          ? "text-destructive"
          : isSuccess
            ? "text-foreground"
            : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
