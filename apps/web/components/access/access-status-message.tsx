import { FeedbackMessage } from "@/components/ui/feedback-message";

/**
 * @deprecated Prefer `FeedbackMessage` for new call sites (Story 8.8).
 * Thin alias preserving access-panel imports.
 */
export function AccessStatusMessage({
  kind,
  children,
}: {
  kind: "loading" | "error" | "empty" | "info";
  children: React.ReactNode;
}) {
  return <FeedbackMessage kind={kind}>{children}</FeedbackMessage>;
}
