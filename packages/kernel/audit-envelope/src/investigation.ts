/**
 * Audit investigation domain helpers (Story 7.1 / FR-42 / FR-51).
 * Option A: orchestration constants + honesty + self-review gate in audit-envelope.
 * Authorize + append stay on governedProcedure / runGovernedRetrieval (web).
 * Query SoT remains @divan/event-store read APIs — no parallel Prisma audit table.
 */

/** @provisional-pending-AR-ACCESS-freeze — investigation search/list */
export const AUDIT_INVESTIGATE_PERMISSION = "audit.investigate";

/**
 * @provisional-pending-AR-ACCESS-freeze — disposition/ack of sensitive evidence.
 * Only required when a mutation path completes independence review.
 */
export const AUDIT_EVIDENCE_REVIEW_PERMISSION = "audit.evidence.review";

/**
 * Category for audit investigation tuples.
 * Provisional — AR-DATA / AR-ACCESS pending freeze. Enabled in DEV_DEMO_CATEGORIES.
 */
export const AUDIT_EVIDENCE_DATA_CATEGORY = "audit.evidence";

export type AuditInvestigationErrorCode =
  | "AUDIT_INVESTIGATE_DENIED"
  | "AUDIT_SELF_REVIEW_BLOCKED"
  | "AUDIT_QUERY_FAILED";

export class AuditInvestigationError extends Error {
  readonly code: AuditInvestigationErrorCode;
  readonly messageFa: string;
  readonly details?: Record<string, string>;

  constructor(
    code: AuditInvestigationErrorCode,
    messageFa: string,
    details?: Record<string, string>,
  ) {
    super(code);
    this.name = "AuditInvestigationError";
    this.code = code;
    this.messageFa = messageFa;
    this.details = details;
  }
}

export const MSG_AUDIT_INVESTIGATE_DENIED_FA = "دسترسی ندارید.";
export const MSG_AUDIT_SELF_REVIEW_BLOCKED_FA =
  "بازبینی فعالیت حساس خودتان مجاز نیست. بازبین مستقل الزامی است.";
export const MSG_AUDIT_QUERY_FAILED_FA = "بازیابی شواهد ممیزی ممکن نشد.";

/** Exact empty-filter operational copy (UX-DR22) — mirrored in web operational-copy. */
export const MSG_AUDIT_EMPTY_FILTER_FA = "رویدادی با این فیلتر نیست.";

/**
 * Migration / cutover honesty (Epic 6 retro → 7.1).
 * Never upgrade events-only zero-trace or Baseline-without-projection to integrity proof.
 */
export const AUDIT_MIGRATION_HONESTY_FA = {
  eventsOnlyZeroTrace:
    "صفر بودن رد تولید فقط در لایهٔ رویدادهاست — اثبات تمامیت cutover نیست.",
  baselineProjectorUnavailable:
    "حوزه‌های اشتغال/انتصاب ممکن است unavailable باشند؛ از payload پایه عدد یا واقعیت اختراع نکنید.",
  ad6PersonOrphans:
    "ممکن است Person یتیم بماند در حالی که رویدادهای پایه برگشته‌اند (AD-6).",
  authAttemptNotPrimarySoT:
    "جداول قدیمی AuthAttempt/AccessDenial منبع اولیهٔ تحقیق نیستند؛ SoT = kernel_events. پر کردن تاریخی معوق است.",
  populationFixture:
    "محدودهٔ جمعیت فعلاً fixture است — نه احراز هویت نیروی کار تولیدی.",
} as const;

export type AuditInvestigationHonesty = {
  migrationEvidenceHonestyFa: string[];
  authAttemptNotPrimarySoTFa: string;
  populationDisclosureFa: string | null;
};

/**
 * Build honesty banners for investigation responses.
 * populationDisclosureFa is supplied by the web PopulationPort resolver.
 */
export function buildAuditInvestigationHonesty(input?: {
  populationDisclosureFa?: string | null;
}): AuditInvestigationHonesty {
  return {
    migrationEvidenceHonestyFa: [
      AUDIT_MIGRATION_HONESTY_FA.eventsOnlyZeroTrace,
      AUDIT_MIGRATION_HONESTY_FA.baselineProjectorUnavailable,
      AUDIT_MIGRATION_HONESTY_FA.ad6PersonOrphans,
    ],
    authAttemptNotPrimarySoTFa: AUDIT_MIGRATION_HONESTY_FA.authAttemptNotPrimarySoT,
    populationDisclosureFa:
      input?.populationDisclosureFa === undefined
        ? null
        : input.populationDisclosureFa,
  };
}

/**
 * True when operation/entity suggests migration/recon domain — UI must not
 * invent employment/assignment facts from Baseline payload alone.
 */
export function isMigrationRelatedEvidence(input: {
  operation: string;
  entityType?: string | null;
}): boolean {
  const op = input.operation.toLowerCase();
  const entity = (input.entityType ?? "").toLowerCase();
  return (
    op.startsWith("migration.") ||
    op.includes("baseline") ||
    op.includes("import.") ||
    op.includes("reconcil") ||
    entity.includes("migration") ||
    entity.includes("baseline") ||
    entity.includes("staging")
  );
}

const EXPORT_ARTIFACT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * True when the evidence row links a managed export artifact (Story 6.5).
 * Bytes must be retrieved only via export.download / ExportArtifactPanel.
 */
export function isExportArtifactEvidence(input: {
  entityType?: string | null;
  entityId?: string | null;
}): boolean {
  return (
    input.entityType === "export_artifact" &&
    typeof input.entityId === "string" &&
    EXPORT_ARTIFACT_ID_RE.test(input.entityId.trim())
  );
}

/**
 * Honesty when InferenceBulk is wired for evidence on channel `"audit"` but
 * investigation SoT is not population-filtered (Decision B / FR-48 Gate exception).
 */
export const AUDIT_INFERENCE_BULK_EVIDENCE_ONLY_FA =
  "کنترل InferenceBulk روی کانال ممیزی فقط برای ثبت شواهد بازیابی است؛ نتایج تحقیق از انبار رویداد فیلتر جمعیت نمی‌شوند.";

/**
 * No self-review gate (FR-51 / AC #5).
 * Search of public metadata about self is allowed; completing independence
 * review / disposition of own sensitive activity is blocked.
 *
 * Reuses the break-glass toxic pattern: reviewer ∉ {subject, requester, priorApprover}.
 * Wire any "open review" / disposition CTA through this before completing review.
 * At least one toxic party id is required — vacuous pass is not independence.
 */
export function assertAuditEvidenceSelfReviewAllowed(input: {
  reviewerAccountId: string;
  subjectAccountId?: string | null;
  requesterAccountId?: string | null;
  priorApproverAccountId?: string | null;
}): void {
  const reviewer = input.reviewerAccountId.trim();
  if (!reviewer) {
    throw new AuditInvestigationError(
      "AUDIT_SELF_REVIEW_BLOCKED",
      MSG_AUDIT_SELF_REVIEW_BLOCKED_FA,
      { reason: "missing_reviewer" },
    );
  }

  const blocked = new Set(
    [
      input.subjectAccountId,
      input.requesterAccountId,
      input.priorApproverAccountId,
    ]
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map((id) => id.trim()),
  );

  if (blocked.size === 0) {
    throw new AuditInvestigationError(
      "AUDIT_SELF_REVIEW_BLOCKED",
      MSG_AUDIT_SELF_REVIEW_BLOCKED_FA,
      { reason: "missing_toxic_party" },
    );
  }

  if (blocked.has(reviewer)) {
    throw new AuditInvestigationError(
      "AUDIT_SELF_REVIEW_BLOCKED",
      MSG_AUDIT_SELF_REVIEW_BLOCKED_FA,
      { reason: "self_or_party_review_blocked" },
    );
  }
}

/**
 * Consume-6.5 algorithm (encode — do not rediscover):
 *
 * on audit.openArtifact(artifactId):
 *   authorize export.retrieve (existing 6.5 keys) — NOT a new audit-byte permission
 *   load artifact; expired|revoked|disposed → deny (existing codes)
 *   sensitive|bulk → custody ack required (existing panel)
 *   reauth = reauthorizeForQueuedOrArtifactWork({ populationChannel: "export"|"audit", ... })
 *   if !reauth.allowed → REAUTH_FAILED
 *   stream via existing export.download — never new Base64 endpoint under audit.*
 *
 * Investigation search uses populationChannel / InferenceBulk "audit".
 * Artifact bytes remain on the export control plane.
 */
export const AUDIT_CONSUME_65_ARTIFACT_CONTRACT =
  "export.getArtifact + export.download + reauthorizeForQueuedOrArtifactWork — no audit.* byte path" as const;
