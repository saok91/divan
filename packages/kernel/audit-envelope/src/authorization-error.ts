/**
 * Envelope-owned deny / audit-failure error + Persian FORBIDDEN copy.
 * Split from index so inference-bulk can import without cycles.
 */

/**
 * Persian FORBIDDEN copy — must stay aligned with
 * `operationalCopy.accessDeniedTitle` in apps/web (`دسترسی ندارید.`).
 */
export const MSG_ACCESS_DENIED_FA = "دسترسی ندارید.";

export type AuthorizationErrorCode = "FORBIDDEN" | "AUDIT_APPEND_FAILED";

/**
 * Envelope-owned deny / audit-failure error.
 * API boundary maps FORBIDDEN → TRPCError FORBIDDEN with messageFa.
 */
export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;
  readonly messageFa: string;
  readonly correlationId: string;
  readonly decisionId: string | null;
  /** Internal deny reason for access-event payload (never shown to user). */
  readonly denyReason: string | null;

  constructor(
    code: AuthorizationErrorCode,
    messageFa: string,
    correlationId: string,
    decisionId: string | null = null,
    denyReason: string | null = null,
  ) {
    super(code);
    this.name = "AuthorizationError";
    this.code = code;
    this.messageFa = messageFa;
    this.correlationId = correlationId;
    this.decisionId = decisionId;
    this.denyReason = denyReason;
  }
}
