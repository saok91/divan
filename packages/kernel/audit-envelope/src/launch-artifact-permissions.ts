/**
 * Launch Artifact Register permissions + catalogue (Story 7.7 / FR-55).
 * Cross-cutting substrate in audit-envelope (AD-5 / FR-46..56).
 *
 * Naming: LaunchArtifact / launch.artifact.* — never export downloads,
 * recon dispositions, or decision publications.
 *
 * SoD: approve vs manage are separate keys so owners can split later.
 * MVP seeds both on hr.admin — do NOT auto-grant audit/ops/trust.
 * @provisional-pending-AR-ACCESS-freeze
 */

/** @provisional-pending-AR-ACCESS-freeze — list register / versions / conflicts */
export const LAUNCH_ARTIFACT_READ_PERMISSION = "launch.artifact.read";

/** @provisional-pending-AR-ACCESS-freeze — draft/create versions */
export const LAUNCH_ARTIFACT_MANAGE_PERMISSION = "launch.artifact.manage";

/** @provisional-pending-AR-ACCESS-freeze — approve version / joint conflict resolve */
export const LAUNCH_ARTIFACT_APPROVE_PERMISSION = "launch.artifact.approve";

/** @provisional-pending-AR-ACCESS-freeze — issue/close waivers */
export const LAUNCH_ARTIFACT_WAIVER_PERMISSION = "launch.artifact.waiver";

/** @provisional-pending-AR-ACCESS-freeze — require/approve rebaseline */
export const LAUNCH_ARTIFACT_REBASELINE_PERMISSION =
  "launch.artifact.rebaseline";

/**
 * Ordinary launch-artifact category — NOT person `health`;
 * not export / report.publication / data.lifecycle / correction.case.
 * @provisional-pending-AR-ACCESS-freeze
 */
export const LAUNCH_ARTIFACT_DATA_CATEGORY = "launch.artifact";

/** Canonical AR ids from PRD §7.1 / launch-artifacts.md */
export const LAUNCH_ARTIFACT_IDS = [
  "AR-ACCESS",
  "AR-TEMPORAL",
  "AR-HEADCOUNT",
  "AR-DATA",
  "AR-IDENTITY",
  "AR-AUDIT",
  "AR-MIGRATION",
  "AR-REPORTING",
  "AR-NFR",
  "AR-SECONDARY",
  "AR-CUTOVER",
] as const;

export type LaunchArtifactId = (typeof LAUNCH_ARTIFACT_IDS)[number];

export function isLaunchArtifactId(value: string): value is LaunchArtifactId {
  return (LAUNCH_ARTIFACT_IDS as readonly string[]).includes(value);
}

/**
 * Gates that must never be waived (FR-55 + 6.4 unavailable spirit).
 * Documented code set — mirror recon "unavailable never unlocked by waiver".
 */
export const NON_WAIVERABLE_GATE_CODES = [
  "default_deny",
  "audit_independence",
  "integrity",
  "mandatory_upstream_gate",
  "observation_unavailable",
] as const;

export type NonWaiverableGateCode =
  (typeof NON_WAIVERABLE_GATE_CODES)[number];

export function isNonWaiverableGate(code: string): boolean {
  const normalized = code.trim().toLowerCase();
  return (NON_WAIVERABLE_GATE_CODES as readonly string[]).includes(normalized);
}

/** Register-level artifact status (honest seed — not production-complete). */
export const LAUNCH_ARTIFACT_REGISTER_STATUSES = [
  "pending",
  "partial_freeze",
  "approved",
  "superseded",
  "expired",
] as const;

export type LaunchArtifactRegisterStatus =
  (typeof LAUNCH_ARTIFACT_REGISTER_STATUSES)[number];

export const LAUNCH_ARTIFACT_VERSION_STATUSES = [
  "draft",
  "approved",
  "superseded",
  "expired",
] as const;

export type LaunchArtifactVersionStatus =
  (typeof LAUNCH_ARTIFACT_VERSION_STATUSES)[number];

export const LAUNCH_ARTIFACT_WAIVER_STATUSES = [
  "open",
  "closed",
  "expired",
] as const;

export type LaunchArtifactWaiverStatus =
  (typeof LAUNCH_ARTIFACT_WAIVER_STATUSES)[number];

export const LAUNCH_ARTIFACT_CONFLICT_STATUSES = [
  "open",
  "resolved",
] as const;

export type LaunchArtifactConflictStatus =
  (typeof LAUNCH_ARTIFACT_CONFLICT_STATUSES)[number];

export const LAUNCH_ARTIFACT_REBASELINE_STATUSES = [
  "required",
  "in_review",
  "approved",
  "rejected",
] as const;

export type LaunchArtifactRebaselineStatus =
  (typeof LAUNCH_ARTIFACT_REBASELINE_STATUSES)[number];

export type LaunchArtifactVersion = {
  id: string;
  artifactId: LaunchArtifactId;
  versionLabel: string;
  status: LaunchArtifactVersionStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  scopeSummary: string;
  affectedFrNfr: string[];
  approvalHistory: Array<Record<string, string>>;
  supersedesVersionId: string | null;
  contentRef: string | null;
  contentHash: string | null;
  createdAt: string;
  createdBy: string;
  correlationId: string;
};

export type LaunchArtifactRegisterRow = {
  id: LaunchArtifactId;
  title: string;
  purposeSummary: string;
  ownerAccountId: string | null;
  currentVersionId: string | null;
  status: LaunchArtifactRegisterStatus;
};

export type LaunchArtifactWaiver = {
  id: string;
  artifactId: LaunchArtifactId;
  artifactVersionId: string | null;
  ownerAccountId: string;
  independentApproverAccountId: string;
  requesterAccountId: string;
  scope: string;
  risk: string;
  compensatingControls: string;
  expiry: string;
  status: LaunchArtifactWaiverStatus;
  closureEvidence: string | null;
  targetGateCode: string | null;
  nonWaiverableAttemptCode: string | null;
  createdAt: string;
  closedAt: string | null;
  correlationId: string;
};

export type LaunchArtifactConflict = {
  id: string;
  status: LaunchArtifactConflictStatus;
  artifactIds: LaunchArtifactId[];
  summary: string;
  resolutionVersionIds: string[] | null;
  openedAt: string;
  resolvedAt: string | null;
  openedBy: string;
  resolvedBy: string | null;
  correlationId: string;
};

export type RebaselineRecord = {
  id: string;
  status: LaunchArtifactRebaselineStatus;
  changeSummary: string;
  impactAssessment: string;
  affectedArtifactIds: LaunchArtifactId[];
  requiredRegressionRefs: string[];
  buildRef: string | null;
  controllingVersions: ControllingVersionRef[];
  requesterAccountId: string;
  independentApproverAccountId: string | null;
  approvedAt: string | null;
  correlationId: string;
  createdAt: string;
};

export type ControllingVersionRef = {
  artifactId: LaunchArtifactId;
  versionId: string;
  versionLabel: string;
  status: LaunchArtifactVersionStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  registerStatus: LaunchArtifactRegisterStatus;
};

export type ChangeControlGateResult =
  | { ok: true; controllingVersions: ControllingVersionRef[] }
  | {
      ok: false;
      code: string;
      messageFa: string;
      blockedArtifactIds: LaunchArtifactId[];
    };

export type WaiverInput = {
  ownerAccountId: string;
  independentApproverAccountId: string;
  requesterAccountId: string;
  scope: string;
  risk: string;
  compensatingControls: string;
  expiry: string;
  targetGateCode?: string | null;
};

/** Known partial-freeze version labels for honest seed (not production-approved). */
export const LAUNCH_ARTIFACT_SEED_META: ReadonlyArray<{
  id: LaunchArtifactId;
  title: string;
  purposeSummary: string;
  status: LaunchArtifactRegisterStatus;
  versionLabel: string | null;
  contentRef: string | null;
}> = [
  {
    id: "AR-ACCESS",
    title: "دسترسی و اختیار",
    purposeSummary:
      "Access, entitlement, break-glass, bulk and inference policy",
    status: "partial_freeze",
    versionLabel: "identity-access-epic1-freeze",
    contentRef: "identity-access-epic1-freeze.md",
  },
  {
    id: "AR-TEMPORAL",
    title: "زمان‌مندی مؤثر",
    purposeSummary: "Effective-time and event resolution contract",
    status: "partial_freeze",
    versionLabel: "temporal-partial-freeze",
    contentRef: null,
  },
  {
    id: "AR-HEADCOUNT",
    title: "ظرفیت نیروی انسانی",
    purposeSummary: "Headcount policy and acceptance oracle",
    status: "partial_freeze",
    versionLabel: "headcount-partial-freeze",
    contentRef: null,
  },
  {
    id: "AR-DATA",
    title: "دیکشنری داده",
    purposeSummary: "Data Dictionary and lifecycle register",
    status: "partial_freeze",
    versionLabel: "ar-data-partial-freeze-2026-07-16",
    contentRef: "data-element-dispositions.md",
  },
  {
    id: "AR-IDENTITY",
    title: "هویت و حساب",
    purposeSummary: "Identity and account lifecycle contract",
    status: "partial_freeze",
    versionLabel: "identity-access-epic1-freeze",
    contentRef: "identity-access-epic1-freeze.md",
  },
  {
    id: "AR-AUDIT",
    title: "حسابرسی",
    purposeSummary: "Audit envelope and review contract",
    status: "pending",
    versionLabel: null,
    contentRef: null,
  },
  {
    id: "AR-MIGRATION",
    title: "مهاجرت",
    purposeSummary: "Migration, Baseline, import and reconciliation contract",
    status: "pending",
    versionLabel: null,
    contentRef: null,
  },
  {
    id: "AR-REPORTING",
    title: "گزارش و انتشار",
    purposeSummary: "Search, metric, report, publication catalogue",
    status: "pending",
    versionLabel: "@provisional-pending-AR-REPORTING-freeze",
    contentRef: null,
  },
  {
    id: "AR-NFR",
    title: "نیازمندی‌های غیرکارکردی",
    purposeSummary: "Operational and security acceptance profile",
    status: "partial_freeze",
    versionLabel: "nfr-provisional",
    contentRef: "nfr-provisional.md",
  },
  {
    id: "AR-SECONDARY",
    title: "انتساب ثانویه",
    purposeSummary: "Secondary Assignment launch inventory",
    status: "pending",
    versionLabel: null,
    contentRef: null,
  },
  {
    id: "AR-CUTOVER",
    title: "برش تولید",
    purposeSummary: "Cutover, parallel operation, rollback plan",
    status: "pending",
    versionLabel: null,
    contentRef: null,
  },
];
