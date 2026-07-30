/**
 * External data-subject correction case domain (Story 7.5 / FR-53).
 * Preferred home: audit-envelope (mirrors 7.1–7.4).
 * Orchestration + persistence live in person-employment; web stays thin.
 *
 * Naming: CorrectionCase / correction.case.* — never overload bare "Correction"
 * (FR-17 personnel event Correction is a separate product).
 *
 * SoD: decide vs close are separate permissions so Legal/Privacy can split later.
 * MVP seeds both on hr.admin — do not auto-grant audit/ops/trust.
 */

/** @provisional-pending-AR-ACCESS-freeze — list/get cases + evidence meta */
export const CORRECTION_CASE_READ_PERMISSION = "correction.case.read";

/** @provisional-pending-AR-ACCESS-freeze — open/update/add evidence/upload */
export const CORRECTION_CASE_WRITE_PERMISSION = "correction.case.write";

/** @provisional-pending-AR-ACCESS-freeze — approve/reject/constrain */
export const CORRECTION_CASE_DECIDE_PERMISSION = "correction.case.decide";

/** @provisional-pending-AR-ACCESS-freeze — close with closure evidence */
export const CORRECTION_CASE_CLOSE_PERMISSION = "correction.case.close";

/**
 * Ordinary correction-case category — NOT person `health`;
 * not data.lifecycle / audit.evidence / audit.trust / ops.platform.
 * @provisional-pending-AR-ACCESS-freeze / @provisional-pending-AR-DATA-freeze
 */
export const CORRECTION_CASE_DATA_CATEGORY = "correction.case";

/**
 * Status machine (minimum):
 * open → in_progress → pending_decision → approved | rejected | constrained → closed
 * plus distinct `breached` («مهلت گذشته») — must not equal active open/in_progress.
 */
export const CORRECTION_CASE_STATUSES = [
  "open",
  "in_progress",
  "pending_decision",
  "approved",
  "rejected",
  "constrained",
  "closed",
  "breached",
] as const;

export type CorrectionCaseStatus = (typeof CORRECTION_CASE_STATUSES)[number];

/** Active (in-time) statuses — breached is intentionally excluded. */
export const CORRECTION_CASE_ACTIVE_STATUSES: readonly CorrectionCaseStatus[] = [
  "open",
  "in_progress",
  "pending_decision",
];

export type CorrectionCaseDecision =
  | "approved"
  | "rejected"
  | "constrained"
  | null;

export type CorrectionCaseEvidenceKind =
  | "request"
  | "response"
  | "internal"
  | "other";

export type CorrectionCaseAttachmentInspectionStatus =
  | "allowed"
  | "rejected"
  | "quarantined";

export type CorrectionCaseOutcomeLinkType =
  | "personnel_correction"
  | "disposal_run"
  | "hold"
  | "recalc"
  | "published_artifact"
  | "decision_publication"
  | "response_evidence"
  | "pending_publication_hook";

export type CorrectionCaseEvidenceRef = {
  id: string;
  caseId: string;
  kind: CorrectionCaseEvidenceKind;
  uriOrRef: string;
  /** Minimized flat metadata — no deep unredacted dumps */
  metadata: Record<string, string>;
  createdAt: string;
  actorAccountId: string;
};

export type CorrectionCaseAttachment = {
  id: string;
  caseId: string;
  storageKey: string;
  originalFilenameMinimized: string;
  contentTypeDetected: string;
  sizeBytes: number;
  inspectionStatus: CorrectionCaseAttachmentInspectionStatus;
  sha256: string | null;
  uploadedBy: string;
  uploadedAt: string;
};

export type CorrectionCaseOutcomeLinks = {
  id: string;
  caseId: string;
  linkType: CorrectionCaseOutcomeLinkType;
  targetId: string;
  note: string | null;
  createdAt: string;
  actorAccountId: string;
};

export type CorrectionCase = {
  id: string;
  requestReference: string;
  authorityVerifiedAt: string;
  authorityVerifiedBy: string;
  personId: string;
  ownerAccountId: string;
  status: CorrectionCaseStatus;
  breachedAt: string | null;
  deadlineAt: string;
  decision: CorrectionCaseDecision;
  decisionReason: string | null;
  /** Minimized closure evidence — null until closed */
  closureEvidence: Record<string, string> | null;
  correlationId: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type AttachmentInspectionResult = {
  status: CorrectionCaseAttachmentInspectionStatus;
  contentTypeDetected: string;
  extension: string;
  sizeBytes: number;
  reasonCode?: string;
  reasonFa?: string;
  /** True when policy allows inert preview for this type (image/pdf). */
  previewAllowed: boolean;
};

export type CorrectionCaseErrorCode =
  | "CORRECTION_CASE_DENIED"
  | "CORRECTION_CASE_NOT_FOUND"
  | "CORRECTION_CASE_INVALID_TRANSITION"
  | "CORRECTION_CASE_DEADLINE_REQUIRED"
  | "CORRECTION_CASE_ATTACHMENT_REJECTED"
  | "CORRECTION_CASE_ATTACHMENT_QUARANTINED"
  | "CORRECTION_CASE_ALLOWLIST_UNSET"
  | "CORRECTION_CASE_SELF_REVIEW_BLOCKED"
  | "CORRECTION_CASE_OUTCOME_TARGET_INVALID"
  | "CORRECTION_CASE_ATTACHMENT_NOT_FOUND"
  | "CORRECTION_CASE_ATTACHMENT_NOT_DOWNLOADABLE";

export class CorrectionCaseError extends Error {
  readonly code: CorrectionCaseErrorCode;
  readonly messageFa: string;
  readonly details?: Record<string, string>;

  constructor(
    code: CorrectionCaseErrorCode,
    messageFa: string,
    details?: Record<string, string>,
  ) {
    super(code);
    this.name = "CorrectionCaseError";
    this.code = code;
    this.messageFa = messageFa;
    this.details = details;
  }
}

export const MSG_CORRECTION_CASE_DENIED_FA = "دسترسی ندارید.";
export const MSG_CORRECTION_CASE_NOT_FOUND_FA =
  "پرونده اصلاح یافت نشد.";
export const MSG_CORRECTION_CASE_INVALID_TRANSITION_FA =
  "گذار وضعیت پرونده اصلاح مجاز نیست.";
export const MSG_CORRECTION_CASE_DEADLINE_REQUIRED_FA =
  "مهلت رسیدگی برای پرونده اصلاح الزامی است.";
export const MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA =
  "پیوست رد شد؛ نوع یا محتوای مجاز نیست.";
export const MSG_CORRECTION_CASE_ATTACHMENT_QUARANTINED_FA =
  "پیوست قرنطینه شد؛ پیش‌نمایش و دریافت تا بازبینی ممکن نیست.";
export const MSG_CORRECTION_CASE_ALLOWLIST_UNSET_FA =
  "فهرست مجاز پیوست پیکربندی نشده؛ بارگذاری به‌صورت امن مسدود است.";
export const MSG_CORRECTION_CASE_SELF_REVIEW_BLOCKED_FA =
  "مالک پرونده نمی‌تواند خودش تصمیم بگیرد؛ بازبینی مستقل لازم است.";
export const MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA =
  "هدف پیوند نتیجه نامعتبر یا یافت نشد.";
export const MSG_CORRECTION_CASE_ATTACHMENT_NOT_FOUND_FA =
  "پیوست یافت نشد.";
export const MSG_CORRECTION_CASE_ATTACHMENT_NOT_DOWNLOADABLE_FA =
  "این پیوست برای دریافت یا پیش‌نمایش در دسترس نیست.";
export const MSG_CORRECTION_CASE_BREACHED_FA = "مهلت گذشته";
export const MSG_CORRECTION_CASE_PENDING_PUBLICATION_HOOK_FA =
  "پیوند انتظار انتشار — وقتی شناسهٔ انتشار تصمیم (۷٫۶) مشخص نیست از این نوع استفاده کنید؛ در صورت وجود شناسه، «انتشار گزارش تصمیم» را ترجیح دهید.";

/** Allowed transitions (from → to). Closed is terminal. */
const TRANSITIONS: Readonly<
  Record<CorrectionCaseStatus, readonly CorrectionCaseStatus[]>
> = {
  open: ["in_progress", "pending_decision", "breached"],
  in_progress: ["pending_decision", "breached"],
  pending_decision: ["approved", "rejected", "constrained", "breached"],
  breached: ["approved", "rejected", "constrained", "in_progress", "pending_decision"],
  approved: ["closed"],
  rejected: ["closed"],
  constrained: ["closed"],
  closed: [],
};

export function canTransitionCorrectionCase(
  from: CorrectionCaseStatus,
  to: CorrectionCaseStatus,
): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertCorrectionCaseTransition(
  from: CorrectionCaseStatus,
  to: CorrectionCaseStatus,
): void {
  if (!canTransitionCorrectionCase(from, to)) {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_INVALID_TRANSITION",
      MSG_CORRECTION_CASE_INVALID_TRANSITION_FA,
      { from, to },
    );
  }
}

/** Pure helper: deadline passed and case still actionable (not closed). */
export function isDeadlineBreached(
  c: { deadlineAt: string; status: CorrectionCaseStatus; breachedAt?: string | null },
  now: Date = new Date(),
): boolean {
  if (c.status === "closed") return false;
  if (c.status === "breached" || c.breachedAt) return true;
  if (CORRECTION_CASE_ACTIVE_STATUSES.includes(c.status) === false) {
    // decided but not closed — still escalate visually if overdue
    if (
      c.status === "approved" ||
      c.status === "rejected" ||
      c.status === "constrained"
    ) {
      return new Date(c.deadlineAt).getTime() < now.getTime();
    }
  }
  return new Date(c.deadlineAt).getTime() < now.getTime();
}

/**
 * Whether UI/API should treat the case as «مهلت گذشته» distinct from active.
 */
export function isBreachedPresentation(
  c: { status: CorrectionCaseStatus; breachedAt?: string | null; deadlineAt: string },
  now: Date = new Date(),
): boolean {
  if (c.status === "closed") return false;
  // Align with isDeadlineBreached — decided-but-unclosed overdue still «مهلت گذشته».
  return isDeadlineBreached(c, now);
}

export function assertCorrectionCaseSelfReviewAllowed(
  ownerAccountId: string,
  actorAccountId: string,
): void {
  if (ownerAccountId === actorAccountId) {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_SELF_REVIEW_BLOCKED",
      MSG_CORRECTION_CASE_SELF_REVIEW_BLOCKED_FA,
    );
  }
}

/**
 * @provisional-pending-AR-DATA-freeze — allowlist / size caps only.
 * Not a general DMS; not commercial AV.
 */
export type CorrectionCaseAttachmentPolicy = {
  /** Extension → expected MIME (lowercase, no dot). */
  allowlist: Readonly<Record<string, readonly string[]>>;
  maxBytes: number;
  maxPerCase: number;
  /** Extensions that may be offered as inert preview (image/pdf). */
  previewExtensions: readonly string[];
  enforceConfigured: boolean;
};

/** @provisional-pending-AR-DATA-freeze */
const PROVISIONAL_DEFAULT_ALLOWLIST: Readonly<
  Record<string, readonly string[]>
> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  txt: ["text/plain"],
  csv: ["text/csv", "text/plain", "application/csv"],
};

const PROVISIONAL_DEFAULT_MAX_BYTES = 1_048_576; // 1 MiB
const PROVISIONAL_DEFAULT_MAX_PER_CASE = 10;
const PROVISIONAL_PREVIEW_EXTENSIONS = ["pdf", "png", "jpg", "jpeg"] as const;

/** Extensions always rejected (active/executable/script/unauthorized archive). */
const REJECT_EXTENSIONS = new Set([
  "exe",
  "dll",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "ps1",
  "sh",
  "bash",
  "js",
  "mjs",
  "cjs",
  "ts",
  "jsx",
  "tsx",
  "html",
  "htm",
  "xhtml",
  "svg",
  "xml",
  "php",
  "py",
  "rb",
  "pl",
  "jar",
  "war",
  "apk",
  "dmg",
  "iso",
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "tgz",
  "bz2",
  "xz",
  "url",
  "lnk",
  "webloc",
]);

/** Magic-byte signatures for allowlisted types (prefix match). */
const MAGIC: ReadonlyArray<{ mime: string; bytes: number[] }> = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
];

function parsePositiveInt(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseAllowlistEnv(
  raw: string | undefined,
): Record<string, readonly string[]> | null {
  if (raw == null || raw.trim() === "") return null;
  const out: Record<string, string[]> = {};
  for (const part of raw.split(",")) {
    const ext = part.trim().toLowerCase().replace(/^\./, "");
    if (!ext) continue;
    const defaults = PROVISIONAL_DEFAULT_ALLOWLIST[ext];
    if (defaults) {
      out[ext] = [...defaults];
    } else {
      // Unknown ext in env without MIME map → treat as unset for that entry
      return null;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Load provisional attachment policy.
 * @provisional-pending-AR-DATA-freeze
 *
 * DIVAN_CORRECTION_CASE_ENFORCE=1 → require explicit knobs (fail-closed if missing).
 * Otherwise use documented provisional defaults.
 */
export function loadCorrectionCaseAttachmentPolicy(
  env: NodeJS.ProcessEnv = process.env,
): CorrectionCaseAttachmentPolicy {
  const enforceConfigured =
    env.DIVAN_CORRECTION_CASE_ENFORCE === "1" ||
    env.DIVAN_CORRECTION_CASE_ENFORCE === "true";

  const allowlist = parseAllowlistEnv(env.DIVAN_CORRECTION_CASE_ALLOWLIST);
  const maxBytes = parsePositiveInt(env.DIVAN_CORRECTION_CASE_MAX_BYTES);
  const maxPerCase = parsePositiveInt(env.DIVAN_CORRECTION_CASE_MAX_PER_CASE);

  if (enforceConfigured) {
    if (allowlist == null || maxBytes == null || maxPerCase == null) {
      throw new CorrectionCaseError(
        "CORRECTION_CASE_ALLOWLIST_UNSET",
        MSG_CORRECTION_CASE_ALLOWLIST_UNSET_FA,
        { reason: "missing_provisional_knobs" },
      );
    }
    return {
      allowlist,
      maxBytes,
      maxPerCase,
      previewExtensions: PROVISIONAL_PREVIEW_EXTENSIONS,
      enforceConfigured: true,
    };
  }

  return {
    allowlist: allowlist ?? PROVISIONAL_DEFAULT_ALLOWLIST,
    maxBytes: maxBytes ?? PROVISIONAL_DEFAULT_MAX_BYTES,
    maxPerCase: maxPerCase ?? PROVISIONAL_DEFAULT_MAX_PER_CASE,
    previewExtensions: PROVISIONAL_PREVIEW_EXTENSIONS,
    enforceConfigured: false,
  };
}

/** Sanitize client filename — never use as storage path. */
export function minimizeAttachmentFilename(clientFilename: string): string {
  const base = clientFilename.replace(/\\/g, "/").split("/").pop() ?? "file";
  const cleaned = base
    .replace(/[^\w.\u0600-\u06FF-]+/gi, "_")
    .replace(/^\.+/, "")
    .slice(0, 80);
  return cleaned || "file";
}

export function extensionOfFilename(filename: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(filename);
  return m ? m[1]!.toLowerCase() : "";
}

function bytesMatchMagic(bytes: Uint8Array, expected: number[]): boolean {
  if (bytes.length < expected.length) return false;
  return expected.every((b, i) => bytes[i] === b);
}

function detectMagicMime(bytes: Uint8Array): string | null {
  for (const sig of MAGIC) {
    if (bytesMatchMagic(bytes, sig.bytes)) return sig.mime;
  }
  // UTF-8 / ASCII text heuristic for txt/csv
  if (bytes.length === 0) return "text/plain";
  let printable = 0;
  const sample = Math.min(bytes.length, 512);
  for (let i = 0; i < sample; i++) {
    const b = bytes[i]!;
    if (b === 0) return null; // binary null → not text
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 128) {
      printable++;
    }
  }
  if (printable / sample >= 0.95) return "text/plain";
  return null;
}

/** Formula / active spreadsheet prefix spirit (import + formula-safe export). */
const FORMULA_CONTROL_PREFIX = /^[=+\-@\t\r]/;

export function hasActiveContentPrefix(value: string): boolean {
  return FORMULA_CONTROL_PREFIX.test(value);
}

function looksLikeHtmlOrScript(text: string): boolean {
  return /<\s*(script|html|svg|iframe|object|embed)\b/i.test(text);
}

/**
 * Pure attachment inspect — fail-closed; never trusts client MIME alone.
 * @provisional-pending-AR-DATA-freeze
 */
export function inspectCorrectionCaseAttachment(
  input: {
    clientFilename: string;
    clientMime?: string | null;
    bytes: Uint8Array;
  },
  policy: CorrectionCaseAttachmentPolicy = loadCorrectionCaseAttachmentPolicy(),
): AttachmentInspectionResult {
  const sizeBytes = input.bytes.byteLength;
  const minimized = minimizeAttachmentFilename(input.clientFilename);
  const extension = extensionOfFilename(minimized);
  const previewAllowed = policy.previewExtensions.includes(extension);

  if (sizeBytes <= 0 || sizeBytes > policy.maxBytes) {
    return {
      status: "rejected",
      contentTypeDetected: "application/octet-stream",
      extension,
      sizeBytes,
      reasonCode: "size",
      reasonFa: MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
      previewAllowed: false,
    };
  }

  if (!extension || REJECT_EXTENSIONS.has(extension)) {
    return {
      status: "rejected",
      contentTypeDetected: "application/octet-stream",
      extension,
      sizeBytes,
      reasonCode: "extension_rejected",
      reasonFa: MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
      previewAllowed: false,
    };
  }

  const allowedMimes = policy.allowlist[extension];
  if (!allowedMimes) {
    return {
      status: "rejected",
      contentTypeDetected: "application/octet-stream",
      extension,
      sizeBytes,
      reasonCode: "not_allowlisted",
      reasonFa: MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
      previewAllowed: false,
    };
  }

  const magicMime = detectMagicMime(input.bytes);

  // ZIP / archive PK header even if renamed
  if (
    input.bytes.length >= 4 &&
    input.bytes[0] === 0x50 &&
    input.bytes[1] === 0x4b &&
    (input.bytes[2] === 0x03 || input.bytes[2] === 0x05 || input.bytes[2] === 0x07)
  ) {
    return {
      status: "rejected",
      contentTypeDetected: "application/zip",
      extension,
      sizeBytes,
      reasonCode: "unauthorized_archive",
      reasonFa: MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
      previewAllowed: false,
    };
  }

  if (magicMime == null) {
    return {
      status: "quarantined",
      contentTypeDetected: "application/octet-stream",
      extension,
      sizeBytes,
      reasonCode: "inspection_failed",
      reasonFa: MSG_CORRECTION_CASE_ATTACHMENT_QUARANTINED_FA,
      previewAllowed: false,
    };
  }

  if (!allowedMimes.includes(magicMime) && !(extension === "csv" && magicMime === "text/plain")) {
    // MIME/extension mismatch — quarantine (suspicious) unless clearly rejectable
    if (magicMime === "application/pdf" || magicMime.startsWith("image/")) {
      return {
        status: "quarantined",
        contentTypeDetected: magicMime,
        extension,
        sizeBytes,
        reasonCode: "mime_mismatch",
        reasonFa: MSG_CORRECTION_CASE_ATTACHMENT_QUARANTINED_FA,
        previewAllowed: false,
      };
    }
    return {
      status: "rejected",
      contentTypeDetected: magicMime,
      extension,
      sizeBytes,
      reasonCode: "mime_mismatch_reject",
      reasonFa: MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
      previewAllowed: false,
    };
  }

  // Text/csv: reject formula / script-like active content on any sampled line
  if (magicMime === "text/plain" || extension === "txt" || extension === "csv") {
    const sample = new TextDecoder("utf-8", { fatal: false }).decode(
      input.bytes.slice(0, Math.min(input.bytes.length, 8192)),
    );
    const hasFormulaLine = sample
      .split(/\r?\n/)
      .some((line) => hasActiveContentPrefix(line));
    if (hasFormulaLine || looksLikeHtmlOrScript(sample)) {
      return {
        status: "rejected",
        contentTypeDetected: magicMime,
        extension,
        sizeBytes,
        reasonCode: "active_content",
        reasonFa: MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
        previewAllowed: false,
      };
    }
  }

  return {
    status: "allowed",
    contentTypeDetected: magicMime,
    extension,
    sizeBytes,
    previewAllowed,
  };
}

/** Inert download response headers (OWASP file upload cheat sheet spirit). */
export function inertAttachmentHeaders(opts: {
  filenameMinimized: string;
  contentType: string;
  disposition: "attachment" | "inline";
}): Record<string, string> {
  const safeName = opts.filenameMinimized.replace(/"/g, "");
  return {
    "Content-Type": opts.contentType || "application/octet-stream",
    "Content-Disposition": `${opts.disposition}; filename="${safeName}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
}

export function decisionStatusFromDecision(
  decision: "approved" | "rejected" | "constrained",
): CorrectionCaseStatus {
  return decision;
}
