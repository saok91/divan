/**
 * Authoritative evaluation snapshot permissions + types (Story 7.8 / FR-56).
 * Cross-cutting substrate in audit-envelope (AD-5 / FR-46..56).
 *
 * Naming: AuthoritativeEvaluationSnapshot / evaluation.snapshot.* —
 * never export downloads, Launch Artifacts, dashboard metrics, or
 * GovernedDataTable client scrub.
 *
 * Most bind calls are system-side after the caller's own authorize —
 * bind is not a substitute for domain permission.
 * @provisional-pending-AR-ACCESS-freeze
 */

/** @provisional-pending-AR-ACCESS-freeze — inspect/list snapshot metadata */
export const EVALUATION_SNAPSHOT_READ_PERMISSION =
  "evaluation.snapshot.read";

/** @provisional-pending-AR-ACCESS-freeze — admin repair / expire tokens */
export const EVALUATION_SNAPSHOT_MANAGE_PERMISSION =
  "evaluation.snapshot.manage";

/**
 * Ordinary evaluation-snapshot category — NOT person `health`;
 * not export / report.publication / launch.artifact / data.lifecycle.
 * @provisional-pending-AR-ACCESS-freeze
 */
export const EVALUATION_SNAPSHOT_DATA_CATEGORY = "evaluation.snapshot";

export const EVALUATION_SNAPSHOT_KINDS = [
  "finalize",
  "import_execution",
  "pagination",
  "export",
  "publication",
] as const;

export type EvaluationSnapshotKind =
  | (typeof EVALUATION_SNAPSHOT_KINDS)[number]
  | (string & {});

export const EVALUATION_SNAPSHOT_STATUSES = [
  "active",
  "consumed",
  "expired",
  "superseded",
] as const;

export type EvaluationSnapshotStatus =
  (typeof EVALUATION_SNAPSHOT_STATUSES)[number];

/** Attribution — ids/fingerprints only; no unauthorized PII. */
export type EvaluationSnapshotAttribution = {
  actorAccountId: string;
  permissionFingerprint?: string | null;
  asOf?: string | null;
  buildRef?: string | null;
};

/**
 * Bound refs — ids/stamps/fingerprints only.
 * Never unauthorized person field values.
 */
export type EvaluationSnapshotBoundRefs = Record<string, unknown>;

export type AuthoritativeEvaluationSnapshot = {
  id: string;
  kind: EvaluationSnapshotKind;
  contentFingerprint: string;
  attribution: EvaluationSnapshotAttribution;
  boundRefs: EvaluationSnapshotBoundRefs | null;
  createdAt: string;
  correlationId: string;
  status: EvaluationSnapshotStatus;
  expiresAt: string | null;
  operationRef: Record<string, unknown> | null;
};

export type EvaluationSnapshotBindResult = {
  snapshot: AuthoritativeEvaluationSnapshot;
  operationRef: Record<string, unknown>;
};

export type EvaluationSnapshotConflict = {
  code: string;
  messageFa: string;
  expectedFingerprint?: string;
  liveFingerprint?: string;
};

export type BeginEvaluationSnapshotInput = {
  kind: EvaluationSnapshotKind;
  /** Canonical payload for fingerprint — kind-specific reviewed input. */
  payload: unknown;
  attribution: EvaluationSnapshotAttribution;
  correlationId: string;
  boundRefs?: EvaluationSnapshotBoundRefs | null;
  /** Persist to governance.evaluation_snapshot. Default true except finalize. */
  persist?: boolean;
  /** Optional absolute expiry ISO; pagination tokens should set short TTL. */
  expiresAt?: string | null;
  /** Optional precomputed fingerprint (e.g. export reviewed hash). */
  contentFingerprint?: string;
};

export type BindOperationToSnapshotInput = {
  operationRef: Record<string, unknown>;
  snapshot: AuthoritativeEvaluationSnapshot;
  /** Persist operation_ref + optionally mark consumed. Default true when persisted. */
  markConsumed?: boolean;
};
