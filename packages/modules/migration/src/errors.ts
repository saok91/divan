/**
 * Domain errors for controlled import preview + staging cutover (Stories 6.1–6.2).
 * Always expose messageFa to operators; never leak raw infra messages upward.
 */

export type MigrationErrorCode =
  | "TEMPLATE_UNKNOWN"
  | "TEMPLATE_MISMATCH"
  | "FILE_TYPE_REJECTED"
  | "FILE_TOO_LARGE"
  | "SHEET_LIMIT"
  | "ROW_LIMIT"
  | "FORMULA_REJECTED"
  | "MACRO_REJECTED"
  | "EXTERNAL_LINK_REJECTED"
  | "ACTIVE_STRUCTURE_REJECTED"
  | "PARSE_FAILED"
  | "PREVIEW_NOT_FOUND"
  | "PREVIEW_CANCELLED"
  | "PERMISSION_DENIED"
  | "VALIDATION_FAILED"
  /** Story 6.2 — provisional SoD / cutover codes (AR-MIGRATION pending freeze). */
  | "SOD_VIOLATION"
  | "CONCURRENT_BATCH"
  | "CUTOVER_FAILED"
  | "STAGING_NOT_FOUND"
  | "BATCH_NOT_APPROVED"
  | "IDEMPOTENCY_CONFLICT"
  | "REVALIDATION_FAILED"
  | "BATCH_IMMUTABLE"
  | "STAGING_ROLLBACK_FAILED";

export class MigrationError extends Error {
  readonly code: MigrationErrorCode;
  readonly messageFa: string;
  /** Optional structured extras (owner, correlation) for concurrent / SoD UX. */
  readonly details?: Record<string, string>;

  constructor(
    code: MigrationErrorCode,
    messageFa: string,
    details?: Record<string, string>,
  ) {
    super(code);
    this.name = "MigrationError";
    this.code = code;
    this.messageFa = messageFa;
    this.details = details;
  }
}
