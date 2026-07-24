/**
 * Domain errors for controlled import preview (Story 6.1).
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
  | "VALIDATION_FAILED";

export class MigrationError extends Error {
  readonly code: MigrationErrorCode;
  readonly messageFa: string;

  constructor(code: MigrationErrorCode, messageFa: string) {
    super(code);
    this.name = "MigrationError";
    this.code = code;
    this.messageFa = messageFa;
  }
}
