/**
 * Launch Artifact change-control errors (Story 7.7 / FR-55).
 * Map at API via messageFa — never forward raw error.message to UI.
 */

export type LaunchArtifactErrorCode =
  | "LAUNCH_ARTIFACT_DENIED"
  | "LAUNCH_ARTIFACT_NOT_FOUND"
  | "LAUNCH_ARTIFACT_VERSION_CONFLICT"
  | "LAUNCH_ARTIFACT_EXPIRED"
  | "LAUNCH_ARTIFACT_SUPERSEDED"
  | "WAIVER_INVALID"
  | "WAIVER_NON_WAIVERABLE"
  | "WAIVER_EXPIRED"
  | "WAIVER_APPROVER_NOT_INDEPENDENT"
  | "CONFLICT_UNRESOLVED"
  | "REBASELINE_REQUIRED"
  | "REBASELINE_INCOMPLETE"
  | "CONTROLLING_VERSION_UNRESOLVED";

export class LaunchArtifactError extends Error {
  readonly code: LaunchArtifactErrorCode;
  readonly messageFa: string;
  readonly details?: Record<string, string>;

  constructor(
    code: LaunchArtifactErrorCode,
    messageFa: string,
    details?: Record<string, string>,
  ) {
    super(code);
    this.name = "LaunchArtifactError";
    this.code = code;
    this.messageFa = messageFa;
    this.details = details;
  }
}

export const MSG_LAUNCH_ARTIFACT_DENIED_FA = "دسترسی ندارید.";
export const MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA =
  "آرتیفکت پرتاب یافت نشد.";
export const MSG_LAUNCH_ARTIFACT_VERSION_CONFLICT_FA =
  "تعارض نسخهٔ آرتیفکت پرتاب؛ عملیات مسدود است.";
export const MSG_LAUNCH_ARTIFACT_EXPIRED_FA =
  "نسخه یا معافیت آرتیفکت پرتاب منقضی شده است.";
export const MSG_LAUNCH_ARTIFACT_SUPERSEDED_FA =
  "این نسخه جایگزین شده است؛ از نسخهٔ کنترل‌کننده استفاده کنید.";
export const MSG_WAIVER_INVALID_FA =
  "معافیت ناقص است؛ مالک، تأییدکننده مستقل، دامنه، ریسک، کنترل جبرانی و انقضا الزامی است.";
export const MSG_WAIVER_NON_WAIVERABLE_FA =
  "این کنترل قابل معافیت نیست (منع پیش‌فرض، استقلال حسابرسی، یکپارچگی، یا دروازهٔ بالادستی).";
export const MSG_WAIVER_EXPIRED_FA =
  "معافیت منقضی شده و نمی‌تواند ادامهٔ استفاده را مجاز کند.";
export const MSG_WAIVER_APPROVER_NOT_INDEPENDENT_FA =
  "تأییدکننده معافیت باید مستقل از مالک و درخواست‌کننده باشد.";
export const MSG_CONFLICT_UNRESOLVED_FA =
  "تعارض باز بین آرتیفکت‌های پرتاب؛ عملیات تا حل مشترک مسدود است.";
export const MSG_REBASELINE_REQUIRED_FA =
  "بازپایه الزامی است؛ عملیات تا تأیید بازپایه مسدود است.";
export const MSG_REBASELINE_INCOMPLETE_FA =
  "سابقهٔ بازپایه ناقص است؛ ارزیابی اثر و مراجع پذیرش الزامی است.";
export const MSG_CONTROLLING_VERSION_UNRESOLVED_FA =
  "نسخهٔ کنترل‌کننده آرتیفکت پرتاب قابل تعیین نیست.";
