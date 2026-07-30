/**
 * Formal decision publication domain (Story 7.6 / FR-54).
 * Immutable publication metadata + supersession notices + post-disposal reproducibility fork.
 * Distinct from live report.run (5.5) and export artifact TTL (6.5).
 *
 * @provisional-pending-AR-REPORTING-freeze / @provisional-pending-AR-DATA-freeze
 * @provisional-pending-AR-ACCESS-freeze / @provisional-pending-AR-TEMPORAL-freeze
 */

import { createHash, randomUUID } from "node:crypto";

import { appendAccessEvent } from "@divan/event-store";

import {
  DecisionPublicationError,
  MSG_PUBLICATION_ALREADY_NON_REPRODUCIBLE_FA,
  MSG_PUBLICATION_DENIED_FA,
  MSG_PUBLICATION_METADATA_INCOMPLETE_FA,
  MSG_PUBLICATION_NOT_FOUND_FA,
  MSG_PUBLICATION_PACKAGE_NOT_ALLOWED_FA,
  MSG_PUBLICATION_PACKAGE_RETAINED_FORCE_FA,
  MSG_PUBLICATION_SNAPSHOT_MISMATCH_FA,
  MSG_PUBLICATION_STALE_BLOCKED_FA,
} from "./decision-publication-errors";
import {
  PROVISIONAL_METRIC_VERSION,
  PROVISIONAL_REPORT_VERSION,
  PUBLICATION_STATUS,
  REPRODUCIBILITY_STATE,
  isPublicationPackageRetainAllowed,
  resolvePublicationVersionStrings,
  type PublicationNoticeKind,
  type PublicationStatus,
} from "./decision-publication-permissions";
import {
  clearPackageBytesForPublication,
  getDecisionPublicationById,
  getReproducibilityPackage,
  insertDecisionPublication,
  insertLifecycleEvent,
  insertPublicationNotice,
  insertReproducibilityPackage,
  listDecisionPublications,
  listPublicationNotices,
  listPublicationsByReportKey,
  listPublicationsIntersectingPerson,
  listReproduciblePublicationsForDisposal,
  updatePublicationLifecycle,
  type DecisionPublicationRecord,
  type JsonValue,
  type PgQueryable,
  type PublicationNoticeRecord,
  type ReproducibilityPackageRecord,
} from "./decision-publication-repo";
import {
  computeExportSnapshotHash,
  type StableSnapshotInput,
} from "./export-artifact";
import { withPgTransaction } from "./export-artifact-repo";
import {
  assertArtifactsUsable,
  beginEvaluationSnapshot,
  bindOperationToSnapshot,
  markEvaluationSnapshotTerminal,
  stableStringify,
  type ControllingVersionRef,
} from "@divan/audit-envelope";

export type DecisionPublication = DecisionPublicationRecord & {
  currentlyReproducible: boolean;
};

export type PublicationNotice = PublicationNoticeRecord;

export type ReproducibilityPackageRef = ReproducibilityPackageRecord;

export type PublishDecisionInput = {
  reportKey: string;
  filters: JsonValue;
  evaluationMode: "current" | "as_of";
  asOfDate?: string | null;
  /** Reviewed StableSnapshotInput — hash must match reviewedSnapshotHash. */
  stableSnapshot: StableSnapshotInput;
  reviewedSnapshotHash: string;
  publisherAccountId: string;
  /** Permission/scope codes only — never unauthorized person rows. */
  permittedAudience: readonly string[];
  /** Minimized provenance — no unauthorized field values / out-of-audience rows. */
  snapshotRef?: JsonValue;
  reportVersion?: string;
  metricVersion?: string;
  sourceExportArtifactId?: string | null;
  correlationId?: string;
  /** Platform stale/recalc blocking (7.2 gold-CTA spirit). */
  blockingStale?: boolean;
  /** Soft PermissionSet held after envelope. */
  holdsPublishPermission: boolean;
};

function toDto(row: DecisionPublicationRecord): DecisionPublication {
  return {
    ...row,
    currentlyReproducible: isCurrentlyReproducible(row),
  };
}

/**
 * Reproducibility claim helper — false when non-reproducible after disposal
 * or when evidence disposed without package (package_retained still claims via package).
 */
export function isCurrentlyReproducible(
  pub: Pick<DecisionPublicationRecord, "status" | "reproducibilityState">,
): boolean {
  if (
    pub.reproducibilityState ===
      REPRODUCIBILITY_STATE.nonReproducibleAfterDisposal ||
    pub.status === PUBLICATION_STATUS.nonReproducibleAfterDisposal
  ) {
    return false;
  }
  if (pub.reproducibilityState === REPRODUCIBILITY_STATE.packageRetained) {
    return true;
  }
  return pub.reproducibilityState === REPRODUCIBILITY_STATE.reproducible;
}

function requireVersions(reportVersion: string, metricVersion: string): void {
  if (!reportVersion.trim() || !metricVersion.trim()) {
    throw new DecisionPublicationError(
      "PUBLICATION_METADATA_INCOMPLETE",
      MSG_PUBLICATION_METADATA_INCOMPLETE_FA,
    );
  }
}

function filtersHash(filters: JsonValue): string {
  return createHash("sha256").update(stableStringify(filters)).digest("hex");
}

/**
 * Publish a formal decision report (FR-54).
 * Metadata only — no unauthorized row embed.
 */
export async function publishDecisionReport(
  db: PgQueryable,
  input: PublishDecisionInput,
): Promise<DecisionPublication> {
  if (!input.holdsPublishPermission) {
    throw new DecisionPublicationError(
      "PUBLICATION_DENIED",
      MSG_PUBLICATION_DENIED_FA,
    );
  }
  if (input.blockingStale) {
    throw new DecisionPublicationError(
      "PUBLICATION_STALE_BLOCKED",
      MSG_PUBLICATION_STALE_BLOCKED_FA,
    );
  }

  const reportVersion = (
    input.reportVersion ?? PROVISIONAL_REPORT_VERSION
  ).trim();
  const metricVersion = (
    input.metricVersion ?? PROVISIONAL_METRIC_VERSION
  ).trim();
  requireVersions(reportVersion, metricVersion);

  const computed = computeExportSnapshotHash(input.stableSnapshot);
  if (computed !== input.reviewedSnapshotHash) {
    throw new DecisionPublicationError(
      "PUBLICATION_SNAPSHOT_MISMATCH",
      MSG_PUBLICATION_SNAPSHOT_MISMATCH_FA,
      { computed, reviewed: input.reviewedSnapshotHash },
    );
  }

  const correlationId = input.correlationId ?? randomUUID();

  // Story 7.8 — bind the shared authoritative evaluation snapshot before
  // persisting the publication (one attributable validated snapshot per op).
  const evalSnap = await beginEvaluationSnapshot(db, {
    kind: "publication",
    payload: {
      sourceSurface: input.stableSnapshot.sourceSurface,
      sourceKey: input.stableSnapshot.sourceKey ?? null,
      filters: input.stableSnapshot.filters,
      fieldIds: [...input.stableSnapshot.fieldIds].sort(),
      asOf: input.stableSnapshot.asOf,
    },
    contentFingerprint: computed,
    attribution: {
      actorAccountId: input.publisherAccountId,
    },
    correlationId,
    boundRefs: { reportKey: input.reportKey },
  });

  try {
  // Story 7.7 — honor change-control blocks; provisional honesty only when
  // AR-REPORTING controlling version is unresolved / register incomplete
  // (based on the gate's own returned code — never a swallowed exception).
  let controllingVersions: ControllingVersionRef[] = [];
  let resolvedReportVersion = reportVersion;
  let resolvedMetricVersion = metricVersion;

  let gate: Awaited<ReturnType<typeof assertArtifactsUsable>>;
  try {
    gate = await assertArtifactsUsable(db, ["AR-REPORTING"]);
  } catch (err) {
    // Story 7.8 — fail-closed: gate infra failures must not continue unbound.
    throw new DecisionPublicationError(
      "PUBLICATION_DENIED",
      MSG_PUBLICATION_DENIED_FA,
      { reason: err instanceof Error ? err.message : String(err) },
    );
  }

  if (!gate.ok) {
    const provisional =
      gate.code === "CONTROLLING_VERSION_UNRESOLVED" ||
      gate.code === "LAUNCH_ARTIFACT_NOT_FOUND";
    if (!provisional) {
      await appendAccessEvent(db, {
        correlationId,
        actorAccountId: input.publisherAccountId,
        operation: "launch.artifact.gate.deny",
        scope: {
          channel: "launch_artifact",
          consumer: "decision_publication",
          code: gate.code,
        },
        result: "deny",
        reason: gate.code,
        entityType: "launch_artifact",
        entityId: "AR-REPORTING",
        payload: {
          messageFa: gate.messageFa,
          blockedArtifactIds: gate.blockedArtifactIds,
        },
      });
      throw new DecisionPublicationError(
        "PUBLICATION_DENIED",
        gate.messageFa || MSG_PUBLICATION_DENIED_FA,
      );
    }
  } else if (gate.ok && gate.controllingVersions.length > 0) {
    controllingVersions = gate.controllingVersions;
    const bound = resolvePublicationVersionStrings(
      controllingVersions[0]!.versionLabel,
    );
    if (!input.reportVersion) resolvedReportVersion = bound.reportVersion;
    if (!input.metricVersion) resolvedMetricVersion = bound.metricVersion;
  }

  const created = await withPgTransaction(db, async (tx) => {
    const row = await insertDecisionPublication(tx, {
      reportKey: input.reportKey,
      reportVersion: resolvedReportVersion,
      metricVersion: resolvedMetricVersion,
      snapshotHash: computed,
      snapshotRef: input.snapshotRef ?? {
        sourceSurface: input.stableSnapshot.sourceSurface,
        sourceKey: input.stableSnapshot.sourceKey ?? null,
        fieldIds: [...input.stableSnapshot.fieldIds].sort(),
      },
      filtersSnapshot: input.filters,
      evaluationMode: input.evaluationMode,
      asOfDate: input.asOfDate ?? null,
      publisherAccountId: input.publisherAccountId,
      permittedAudience: input.permittedAudience,
      correlationId,
      sourceExportArtifactId: input.sourceExportArtifactId ?? null,
      controllingArtifactVersions: controllingVersions.map((v) => ({
        artifactId: v.artifactId,
        versionId: v.versionId,
        versionLabel: v.versionLabel,
        status: v.status,
        registerStatus: v.registerStatus,
      })),
      evaluationSnapshotId: evalSnap.id,
    });

    await bindOperationToSnapshot(tx, {
      snapshot: evalSnap,
      operationRef: {
        entityType: "decision_publication",
        entityId: row.id,
      },
      markConsumed: true,
    });

    await insertLifecycleEvent(tx, {
      publicationId: row.id,
      eventKind: "published",
      actorAccountId: input.publisherAccountId,
      correlationId,
      reason: "decision_publication_created",
    });

    await appendAccessEvent(tx, {
      correlationId,
      actorAccountId: input.publisherAccountId,
      operation: "report.publication.publish",
      scope: {
        channel: "report_publication",
        reportKey: input.reportKey,
      },
      result: "allow",
      reason: "published",
      entityType: "decision_publication",
      entityId: row.id,
      payload: {
        snapshotHash: computed,
        reportVersion: resolvedReportVersion,
        metricVersion: resolvedMetricVersion,
        controllingArtifactVersions: controllingVersions,
        outcome: "published",
      },
    });

    return row;
  });

  return toDto(created);
  } catch (err) {
    try {
      await markEvaluationSnapshotTerminal(db, evalSnap.id, "expired", {
        reason: "publication_failed",
      });
    } catch {
      // best-effort orphan cleanup
    }
    throw err;
  }
}

export async function getDecisionPublication(
  db: PgQueryable,
  id: string,
): Promise<DecisionPublication> {
  const row = await getDecisionPublicationById(db, id);
  if (!row) {
    throw new DecisionPublicationError(
      "PUBLICATION_NOT_FOUND",
      MSG_PUBLICATION_NOT_FOUND_FA,
    );
  }
  return toDto(row);
}

export async function listDecisionPublicationDtos(
  db: PgQueryable,
  input?: { reportKey?: string; limit?: number },
): Promise<DecisionPublication[]> {
  const rows = await listDecisionPublications(db, input);
  return rows.map(toDto);
}

/**
 * Append-only supersession/correction notice.
 * Marks publication superseded / has_supersession_notice without rewriting decision columns.
 */
export async function createPublicationNotice(
  db: PgQueryable,
  input: {
    publicationId: string;
    noticeKind: PublicationNoticeKind;
    triggerRefType: string;
    triggerRefId: string;
    note?: string | null;
    actorAccountId: string;
    correlationId?: string;
    holdsSupersedePermission: boolean;
  },
): Promise<{ notice: PublicationNotice; publication: DecisionPublication }> {
  if (!input.holdsSupersedePermission) {
    throw new DecisionPublicationError(
      "PUBLICATION_DENIED",
      MSG_PUBLICATION_DENIED_FA,
    );
  }

  const current = await getDecisionPublicationById(db, input.publicationId);
  if (!current) {
    throw new DecisionPublicationError(
      "PUBLICATION_NOT_FOUND",
      MSG_PUBLICATION_NOT_FOUND_FA,
    );
  }

  const correlationId = input.correlationId ?? randomUUID();
  return withPgTransaction(db, async (tx) => {
    const notice = await insertPublicationNotice(tx, {
      publicationId: input.publicationId,
      noticeKind: input.noticeKind,
      triggerRefType: input.triggerRefType,
      triggerRefId: input.triggerRefId,
      note: input.note,
      actorAccountId: input.actorAccountId,
      correlationId,
    });

    let nextStatus: PublicationStatus = current.status;
    if (current.status === PUBLICATION_STATUS.published) {
      nextStatus = PUBLICATION_STATUS.superseded;
    }

    const updated =
      (await updatePublicationLifecycle(tx, {
        id: current.id,
        status:
          current.status === PUBLICATION_STATUS.published
            ? PUBLICATION_STATUS.superseded
            : undefined,
        hasSupersessionNotice: true,
      })) ?? current;

    await insertLifecycleEvent(tx, {
      publicationId: current.id,
      eventKind: "notice_appended",
      actorAccountId: input.actorAccountId,
      correlationId,
      reason: input.noticeKind,
      detailJson: {
        noticeId: notice.id,
        triggerRefType: input.triggerRefType,
        triggerRefId: input.triggerRefId,
        status: nextStatus,
      },
    });

    await appendAccessEvent(tx, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "report.publication.supersede",
      scope: { channel: "report_publication", publicationId: current.id },
      result: "allow",
      reason: "notice_appended",
      entityType: "decision_publication",
      entityId: current.id,
      payload: {
        noticeKind: input.noticeKind,
        noticeId: notice.id,
        outcome: "superseded_notice",
      },
    });

    return { notice, publication: toDto(updated) };
  });
}

/**
 * MVP Correction → notice: when personId appears in filters_snapshot text.
 * Ambiguous cases stay on explicit createNotice API.
 */
export async function notifyPublicationsForCorrection(
  db: PgQueryable,
  input: {
    personId: string;
    correctionEventId: string;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<PublicationNotice[]> {
  const pubs = await listPublicationsIntersectingPerson(db, input.personId);
  const notices: PublicationNotice[] = [];
  const correlationId = input.correlationId ?? randomUUID();
  for (const pub of pubs) {
    const { notice } = await createPublicationNotice(db, {
      publicationId: pub.id,
      noticeKind: "correction",
      triggerRefType: "personnel_correction",
      triggerRefId: input.correctionEventId,
      note: "اعلان جایگزینی پس از اصلاح رویداد پرسنلی",
      actorAccountId: input.actorAccountId,
      correlationId,
      holdsSupersedePermission: true,
    });
    notices.push(notice);
  }
  return notices;
}

/**
 * When catalogue provisional metric version string changes, open notices for
 * publications on that report_key still claiming current reproducibility.
 */
export async function bumpMetricVersionNotices(
  db: PgQueryable,
  input: {
    reportKey: string;
    newMetricVersion: string;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<PublicationNotice[]> {
  const pubs = await listPublicationsByReportKey(db, input.reportKey);
  const notices: PublicationNotice[] = [];
  const correlationId = input.correlationId ?? randomUUID();
  for (const pub of pubs) {
    if (!isCurrentlyReproducible(pub)) continue;
    if (pub.metricVersion === input.newMetricVersion) continue;
    const { notice } = await createPublicationNotice(db, {
      publicationId: pub.id,
      noticeKind: "metric_policy_change",
      triggerRefType: "metric_version",
      triggerRefId: input.newMetricVersion,
      note: `نسخهٔ متریک موقت تغییر کرد: ${pub.metricVersion} → ${input.newMetricVersion}`,
      actorAccountId: input.actorAccountId,
      correlationId,
      holdsSupersedePermission: true,
    });
    notices.push(notice);
  }
  return notices;
}

export async function listNoticesForPublication(
  db: PgQueryable,
  publicationId: string,
): Promise<PublicationNotice[]> {
  const pub = await getDecisionPublicationById(db, publicationId);
  if (!pub) {
    throw new DecisionPublicationError(
      "PUBLICATION_NOT_FOUND",
      MSG_PUBLICATION_NOT_FOUND_FA,
    );
  }
  return listPublicationNotices(db, publicationId);
}

/**
 * Privacy-preserving reproducibility package — metadata + contentHash only.
 * FORBIDDEN: person rows, national ids, compensation amounts, names.
 */
export async function retainReproducibilityPackage(
  db: PgQueryable,
  input: {
    publicationId: string;
    disposalRunId: string;
    actorAccountId: string;
    correlationId?: string;
    holdsManagePermission: boolean;
  },
): Promise<{
  publication: DecisionPublication;
  packageRef: ReproducibilityPackageRef;
}> {
  if (!input.holdsManagePermission) {
    throw new DecisionPublicationError(
      "PUBLICATION_DENIED",
      MSG_PUBLICATION_DENIED_FA,
    );
  }
  const pub = await getDecisionPublicationById(db, input.publicationId);
  if (!pub) {
    throw new DecisionPublicationError(
      "PUBLICATION_NOT_FOUND",
      MSG_PUBLICATION_NOT_FOUND_FA,
    );
  }
  if (
    pub.reproducibilityState ===
    REPRODUCIBILITY_STATE.nonReproducibleAfterDisposal
  ) {
    throw new DecisionPublicationError(
      "PUBLICATION_ALREADY_NON_REPRODUCIBLE",
      MSG_PUBLICATION_ALREADY_NON_REPRODUCIBLE_FA,
    );
  }
  if (!isPublicationPackageRetainAllowed(pub.reportKey)) {
    throw new DecisionPublicationError(
      "PUBLICATION_PACKAGE_NOT_ALLOWED",
      MSG_PUBLICATION_PACKAGE_NOT_ALLOWED_FA,
      { reportKey: pub.reportKey },
    );
  }

  const correlationId = input.correlationId ?? randomUUID();
  const packageBody = {
    publicationId: pub.id,
    reportKey: pub.reportKey,
    reportVersion: pub.reportVersion,
    metricVersion: pub.metricVersion,
    snapshotHash: pub.snapshotHash,
    filtersHash: filtersHash(pub.filtersSnapshot),
    asOf: pub.asOfDate,
    evaluationMode: pub.evaluationMode,
    permittedAudience: pub.permittedAudience,
    disposalRunId: input.disposalRunId,
  };
  const contentHash = createHash("sha256")
    .update(stableStringify(packageBody))
    .digest("hex");

  return withPgTransaction(db, async (tx) => {
    const packageRef = await insertReproducibilityPackage(tx, {
      publicationId: pub.id,
      packageKind: "@provisional-pending-AR-DATA-freeze",
      contentHash,
      retentionClass: "metadata_hash_only",
      packageMetadata: packageBody,
      disposalRunId: input.disposalRunId,
    });

    const updated =
      (await updatePublicationLifecycle(tx, {
        id: pub.id,
        status: PUBLICATION_STATUS.packageRetained,
        reproducibilityState: REPRODUCIBILITY_STATE.packageRetained,
      })) ?? pub;

    await insertPublicationNotice(tx, {
      publicationId: pub.id,
      noticeKind: "disposal",
      triggerRefType: "disposal_run",
      triggerRefId: input.disposalRunId,
      note: "بستهٔ بازتولید حداقلی نگهداری شد",
      actorAccountId: input.actorAccountId,
      correlationId,
    });

    await insertLifecycleEvent(tx, {
      publicationId: pub.id,
      eventKind: "package_retained",
      actorAccountId: input.actorAccountId,
      correlationId,
      reason: "reproducibility_package",
      detailJson: { packageId: packageRef.id, contentHash },
    });

    await appendAccessEvent(tx, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "report.publication.manage",
      scope: { channel: "report_publication", publicationId: pub.id },
      result: "allow",
      reason: "package_retained",
      entityType: "decision_publication",
      entityId: pub.id,
      payload: { packageId: packageRef.id, outcome: "package_retained" },
    });

    return { publication: toDto(updated), packageRef };
  });
}

export async function markNonReproducibleAfterDisposal(
  db: PgQueryable,
  input: {
    publicationId: string;
    disposalRunId: string;
    actorAccountId: string;
    correlationId?: string;
    holdsManagePermission: boolean;
    /** Required to downgrade an existing package_retained claim. */
    force?: boolean;
  },
): Promise<DecisionPublication> {
  if (!input.holdsManagePermission) {
    throw new DecisionPublicationError(
      "PUBLICATION_DENIED",
      MSG_PUBLICATION_DENIED_FA,
    );
  }
  const pub = await getDecisionPublicationById(db, input.publicationId);
  if (!pub) {
    throw new DecisionPublicationError(
      "PUBLICATION_NOT_FOUND",
      MSG_PUBLICATION_NOT_FOUND_FA,
    );
  }
  if (
    pub.reproducibilityState ===
    REPRODUCIBILITY_STATE.nonReproducibleAfterDisposal
  ) {
    throw new DecisionPublicationError(
      "PUBLICATION_ALREADY_NON_REPRODUCIBLE",
      MSG_PUBLICATION_ALREADY_NON_REPRODUCIBLE_FA,
    );
  }
  if (
    (pub.reproducibilityState === REPRODUCIBILITY_STATE.packageRetained ||
      pub.status === PUBLICATION_STATUS.packageRetained) &&
    !input.force
  ) {
    throw new DecisionPublicationError(
      "PUBLICATION_PACKAGE_NOT_ALLOWED",
      MSG_PUBLICATION_PACKAGE_RETAINED_FORCE_FA,
      { publicationId: pub.id },
    );
  }

  const correlationId = input.correlationId ?? randomUUID();
  return withPgTransaction(db, async (tx) => {
    await clearPackageBytesForPublication(tx, pub.id);

    const updated =
      (await updatePublicationLifecycle(tx, {
        id: pub.id,
        status: PUBLICATION_STATUS.nonReproducibleAfterDisposal,
        reproducibilityState:
          REPRODUCIBILITY_STATE.nonReproducibleAfterDisposal,
        hasSupersessionNotice: true,
      })) ?? pub;

    await insertPublicationNotice(tx, {
      publicationId: pub.id,
      noticeKind: "disposal",
      triggerRefType: "disposal_run",
      triggerRefId: input.disposalRunId,
      note: "غیرقابل‌بازتولید پس از امحای منبع الزامی",
      actorAccountId: input.actorAccountId,
      correlationId,
    });

    await insertLifecycleEvent(tx, {
      publicationId: pub.id,
      eventKind: "non_reproducible_after_disposal",
      actorAccountId: input.actorAccountId,
      correlationId,
      reason: "required_source_disposed",
      detailJson: {
        disposalRunId: input.disposalRunId,
        force: Boolean(input.force),
      },
    });

    await appendAccessEvent(tx, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "report.publication.manage",
      scope: { channel: "report_publication", publicationId: pub.id },
      result: "allow",
      reason: "non_reproducible_after_disposal",
      entityType: "decision_publication",
      entityId: pub.id,
      payload: {
        disposalRunId: input.disposalRunId,
        outcome: "non-reproducible-after-disposal",
      },
    });

    return toDto(updated);
  });
}

export type OnRequiredSourceDisposedResult = {
  publicationId: string;
  outcome: "package_retained" | "non-reproducible-after-disposal";
};

export type DisposalIntersectionScope = {
  scopeKind?: string;
  scopeRef?: string;
  personIds?: readonly string[];
  artifactIds?: readonly string[];
  elementCategory?: string;
};

function publicationIntersectsDisposalScope(
  pub: DecisionPublicationRecord,
  scope: DisposalIntersectionScope,
): boolean {
  const personIds = scope.personIds ?? [];
  const artifactIds = scope.artifactIds ?? [];
  if (artifactIds.length > 0 && pub.sourceExportArtifactId) {
    if (artifactIds.includes(pub.sourceExportArtifactId)) return true;
  }
  if (personIds.length > 0) {
    const text = JSON.stringify(pub.filtersSnapshot);
    if (personIds.some((id) => id.length > 0 && text.includes(id))) {
      return true;
    }
  }
  return false;
}

/**
 * Disposal fork — never refuse disposal to keep reproducibility.
 * Per-publication failures are swallowed so one bad row cannot abort the rest.
 * Catastrophic adapter/DB failure may still surface to the lifecycle soft-skip
 * (publications can remain currentlyReproducible — residual honesty).
 */
export async function onRequiredSourceDisposed(
  db: PgQueryable,
  input: {
    disposalRunId: string;
    actorAccountId: string;
    correlationId?: string;
    reportKey?: string;
    /** When present, only publications intersecting person/artifact scope are forked. */
    scope?: DisposalIntersectionScope;
  },
): Promise<OnRequiredSourceDisposedResult[]> {
  let pubs = await listReproduciblePublicationsForDisposal(db, {
    reportKey: input.reportKey,
  });

  if (input.scope) {
    const personIds = input.scope.personIds ?? [];
    const artifactIds = input.scope.artifactIds ?? [];
    if (personIds.length > 0 || artifactIds.length > 0) {
      pubs = pubs.filter((pub) =>
        publicationIntersectsDisposalScope(pub, input.scope!),
      );
    } else if (input.scope.scopeKind !== "org_scope") {
      // Scoped disposal without person/artifact ids — do not mark org-wide.
      pubs = [];
    }
  }

  const results: OnRequiredSourceDisposedResult[] = [];
  const correlationId = input.correlationId ?? randomUUID();

  for (const pub of pubs) {
    try {
      if (isPublicationPackageRetainAllowed(pub.reportKey)) {
        try {
          await retainReproducibilityPackage(db, {
            publicationId: pub.id,
            disposalRunId: input.disposalRunId,
            actorAccountId: input.actorAccountId,
            correlationId,
            holdsManagePermission: true,
          });
          results.push({
            publicationId: pub.id,
            outcome: "package_retained",
          });
          continue;
        } catch {
          // Fall through to non-reproducible — never block disposal.
        }
      }
      await markNonReproducibleAfterDisposal(db, {
        publicationId: pub.id,
        disposalRunId: input.disposalRunId,
        actorAccountId: input.actorAccountId,
        correlationId,
        holdsManagePermission: true,
        // Disposal path may clear a failed/partial package claim.
        force: true,
      });
      results.push({
        publicationId: pub.id,
        outcome: "non-reproducible-after-disposal",
      });
    } catch {
      // Per-pub soft-skip — continue remaining publications.
    }
  }
  return results;
}

export async function getPackageRefForPublication(
  db: PgQueryable,
  publicationId: string,
): Promise<ReproducibilityPackageRef | null> {
  return getReproducibilityPackage(db, publicationId);
}

export { computeExportSnapshotHash };
export type { StableSnapshotInput };
