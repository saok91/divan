/**
 * Launch Artifact change-control pure helpers + orchestration APIs (Story 7.7 / FR-55).
 * Shared waiver expiry/shape helpers are consumed by migration reconciliation
 * to avoid divergent FR-55 rules.
 */

import { randomUUID } from "node:crypto";

import { appendAccessEvent, withTransaction } from "@divan/event-store";
import type { Pool, PoolClient } from "pg";

import { assertAuditTrustWriterAllowed, enforceClockAnomalyOrThrow } from "./audit-trust-gate";
import {
  LaunchArtifactError,
  MSG_CONFLICT_UNRESOLVED_FA,
  MSG_CONTROLLING_VERSION_UNRESOLVED_FA,
  MSG_LAUNCH_ARTIFACT_EXPIRED_FA,
  MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA,
  MSG_LAUNCH_ARTIFACT_SUPERSEDED_FA,
  MSG_REBASELINE_INCOMPLETE_FA,
  MSG_REBASELINE_REQUIRED_FA,
  MSG_WAIVER_APPROVER_NOT_INDEPENDENT_FA,
  MSG_WAIVER_EXPIRED_FA,
  MSG_WAIVER_INVALID_FA,
  MSG_WAIVER_NON_WAIVERABLE_FA,
} from "./launch-artifact-errors";
import {
  isLaunchArtifactId,
  isNonWaiverableGate,
  LAUNCH_ARTIFACT_SEED_META,
  type ChangeControlGateResult,
  type ControllingVersionRef,
  type LaunchArtifactConflict,
  type LaunchArtifactId,
  type LaunchArtifactRegisterRow,
  type LaunchArtifactVersion,
  type LaunchArtifactWaiver,
  type RebaselineRecord,
  type WaiverInput,
} from "./launch-artifact-permissions";
import * as repo from "./launch-artifact-repo";

export * from "./launch-artifact-errors";
export * from "./launch-artifact-permissions";

export type PgQueryable = repo.PgQueryable;

/**
 * Shared FR-55 expiry helper (also consumed by migration reconciliation).
 * Empty / invalid expiry → expired (fail-closed).
 */
export function isWaiverExpired(
  expiry: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!expiry?.trim()) return true;
  const t = Date.parse(expiry);
  if (Number.isNaN(t)) return true;
  return t < nowMs;
}

/**
 * Assert FR-55 waiver shape + independence + non-waiverable gate.
 * Does not persist — pure validation for issueWaiver and recon alignment.
 */
export function assertWaiverAllowed(
  targetGateCode: string | null | undefined,
  waiverInput: WaiverInput,
): void {
  const scope = waiverInput.scope?.trim() ?? "";
  const risk = waiverInput.risk?.trim() ?? "";
  const compensating = waiverInput.compensatingControls?.trim() ?? "";
  const expiry = waiverInput.expiry?.trim() ?? "";
  const owner = waiverInput.ownerAccountId?.trim() ?? "";
  const approver = waiverInput.independentApproverAccountId?.trim() ?? "";
  const requester = waiverInput.requesterAccountId?.trim() ?? "";

  if (!owner || !approver || !requester || !scope || !risk || !compensating || !expiry) {
    throw new LaunchArtifactError("WAIVER_INVALID", MSG_WAIVER_INVALID_FA);
  }

  if (approver === owner || approver === requester) {
    throw new LaunchArtifactError(
      "WAIVER_APPROVER_NOT_INDEPENDENT",
      MSG_WAIVER_APPROVER_NOT_INDEPENDENT_FA,
    );
  }

  if (targetGateCode && isNonWaiverableGate(targetGateCode)) {
    throw new LaunchArtifactError(
      "WAIVER_NON_WAIVERABLE",
      MSG_WAIVER_NON_WAIVERABLE_FA,
      { gate: targetGateCode },
    );
  }

  if (isWaiverExpired(expiry)) {
    throw new LaunchArtifactError("WAIVER_EXPIRED", MSG_WAIVER_EXPIRED_FA);
  }
}

export function recordOperationEvidence(
  controllingVersions: ControllingVersionRef[],
  buildRef?: string | null,
): {
  controllingVersions: ControllingVersionRef[];
  buildRef: string | null;
  recordedAt: string;
} {
  return {
    controllingVersions: [...controllingVersions],
    buildRef: buildRef ?? null,
    recordedAt: new Date().toISOString(),
  };
}

export async function resolveControllingVersion(
  db: PgQueryable,
  artifactId: string,
  asOf?: Date | string | null,
): Promise<ControllingVersionRef> {
  if (!isLaunchArtifactId(artifactId)) {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_NOT_FOUND",
      MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA,
      { artifactId },
    );
  }
  const asOfDate =
    asOf == null
      ? new Date()
      : typeof asOf === "string"
        ? new Date(asOf)
        : asOf;
  if (Number.isNaN(asOfDate.getTime())) {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_NOT_FOUND",
      MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA,
      { artifactId },
    );
  }

  await refreshExpiryStates(db, [artifactId]);

  const artifact = await repo.getArtifact(db, artifactId);
  if (!artifact) {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_NOT_FOUND",
      MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA,
      { artifactId },
    );
  }

  const version = await repo.findControllingVersion(db, artifactId, asOfDate);
  if (!version) {
    throw new LaunchArtifactError(
      "CONTROLLING_VERSION_UNRESOLVED",
      MSG_CONTROLLING_VERSION_UNRESOLVED_FA,
      { artifactId },
    );
  }

  if (version.status === "expired") {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_EXPIRED",
      MSG_LAUNCH_ARTIFACT_EXPIRED_FA,
      { artifactId, versionId: version.id },
    );
  }

  if (version.status === "superseded") {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_SUPERSEDED",
      MSG_LAUNCH_ARTIFACT_SUPERSEDED_FA,
      { artifactId, versionId: version.id },
    );
  }

  return {
    artifactId,
    versionId: version.id,
    versionLabel: version.versionLabel,
    status: version.status,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    registerStatus: artifact.status,
  };
}

export async function assertArtifactsUsable(
  db: PgQueryable,
  artifactIds: string[],
  opts?: {
    denyEvidence?: {
      actorAccountId: string;
      correlationId: string;
    };
  },
): Promise<ChangeControlGateResult> {
  const ids = artifactIds.filter(isLaunchArtifactId);
  const blocked: LaunchArtifactId[] = [];
  let denyCode = "CONTROLLING_VERSION_UNRESOLVED";
  let messageFa = MSG_CONTROLLING_VERSION_UNRESOLVED_FA;
  const controlling: ControllingVersionRef[] = [];

  if (ids.length === 0) {
    const emptyDeny: ChangeControlGateResult = {
      ok: false,
      code: "CONTROLLING_VERSION_UNRESOLVED",
      messageFa: MSG_CONTROLLING_VERSION_UNRESOLVED_FA,
      blockedArtifactIds: [],
    };
    await maybeRecordGateDeny(db, emptyDeny, opts?.denyEvidence);
    return emptyDeny;
  }

  await refreshExpiryStates(db, ids);

  const openConflicts = await repo.listOpenConflictsIntersecting(db, ids);
  if (openConflicts.length > 0) {
    for (const c of openConflicts) {
      for (const id of c.artifactIds) {
        if (ids.includes(id) && !blocked.includes(id)) blocked.push(id);
      }
    }
    const deny: ChangeControlGateResult = {
      ok: false,
      code: "CONFLICT_UNRESOLVED",
      messageFa: MSG_CONFLICT_UNRESOLVED_FA,
      blockedArtifactIds: blocked,
    };
    await maybeRecordGateDeny(db, deny, opts?.denyEvidence);
    return deny;
  }

  const openRebaselines = await repo.listOpenRebaselinesIntersecting(db, ids);
  if (openRebaselines.length > 0) {
    for (const r of openRebaselines) {
      for (const id of r.affectedArtifactIds) {
        if (ids.includes(id) && !blocked.includes(id)) blocked.push(id);
      }
    }
    const deny: ChangeControlGateResult = {
      ok: false,
      code: "REBASELINE_REQUIRED",
      messageFa: MSG_REBASELINE_REQUIRED_FA,
      blockedArtifactIds: blocked,
    };
    await maybeRecordGateDeny(db, deny, opts?.denyEvidence);
    return deny;
  }

  for (const id of ids) {
    try {
      controlling.push(await resolveControllingVersion(db, id));
    } catch (err) {
      if (err instanceof LaunchArtifactError) {
        blocked.push(id);
        denyCode = err.code;
        messageFa = err.messageFa;
      } else {
        throw err;
      }
    }
  }

  if (blocked.length > 0) {
    const deny: ChangeControlGateResult = {
      ok: false,
      code: denyCode,
      messageFa,
      blockedArtifactIds: blocked,
    };
    await maybeRecordGateDeny(db, deny, opts?.denyEvidence);
    return deny;
  }

  return { ok: true, controllingVersions: controlling };
}

async function maybeRecordGateDeny(
  db: PgQueryable,
  deny: Extract<ChangeControlGateResult, { ok: false }>,
  evidence?: { actorAccountId: string; correlationId: string },
): Promise<void> {
  if (!evidence) return;
  await appendAccessEvent(db, {
    correlationId: evidence.correlationId,
    actorAccountId: evidence.actorAccountId,
    operation: "launch.artifact.gate.deny",
    scope: {
      channel: "launch_artifact",
      code: deny.code,
      blockedArtifactIds: deny.blockedArtifactIds,
    },
    result: "deny",
    reason: deny.code,
    entityType: "launch_artifact",
    payload: {
      messageFa: deny.messageFa,
      blockedArtifactIds: deny.blockedArtifactIds,
    },
  });
}

export async function refreshExpiryStates(
  db: PgQueryable,
  artifactIds?: string[],
): Promise<{ expiredWaivers: number; expiredVersions: number }> {
  const expiredWaivers = await repo.markExpiredWaivers(db, artifactIds);
  const expiredVersions = await repo.markExpiredVersions(db, artifactIds);
  return { expiredWaivers, expiredVersions };
}

async function requireTrustAndAppend(
  db: Pool | PoolClient,
  opts: {
    actorAccountId: string;
    correlationId: string;
    operation: string;
    permission: string;
    entityId?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await assertAuditTrustWriterAllowed(db, {
    correlationId: opts.correlationId,
    permission: opts.permission,
  });
  await enforceClockAnomalyOrThrow(db, {
    correlationId: opts.correlationId,
    actorAccountId: opts.actorAccountId,
    permission: opts.permission,
  });
  await appendAccessEvent(db, {
    correlationId: opts.correlationId,
    actorAccountId: opts.actorAccountId,
    operation: opts.operation,
    scope: {
      channel: "launch_artifact",
      permission: opts.permission,
    },
    result: "allow",
    reason: opts.operation,
    entityType: "launch_artifact",
    entityId: opts.entityId,
    payload: opts.payload,
  });
}

export async function seedLaunchArtifactRegister(
  db: PgQueryable,
  actorAccountId = "system:seed",
): Promise<void> {
  const correlationId = randomUUID();
  for (const meta of LAUNCH_ARTIFACT_SEED_META) {
    await repo.upsertArtifact(db, {
      id: meta.id,
      title: meta.title,
      purposeSummary: meta.purposeSummary,
      status: meta.status,
      ownerAccountId: null,
      currentVersionId: null,
    });

    if (!meta.versionLabel) continue;

    const existing = await repo.findVersionByLabel(
      db,
      meta.id,
      meta.versionLabel,
    );
    if (existing) {
      const art = await repo.getArtifact(db, meta.id);
      if (art && !art.currentVersionId) {
        await repo.setCurrentVersion(db, meta.id, existing.id);
      }
      continue;
    }

    const versionId = randomUUID();
    await repo.insertVersion(db, {
      id: versionId,
      artifactId: meta.id,
      versionLabel: meta.versionLabel,
      status: "approved",
      effectiveFrom: new Date().toISOString(),
      effectiveTo: null,
      scopeSummary: `Honest ${meta.status} seed — not production-approved`,
      affectedFrNfr: ["FR-55"],
      approvalHistory: [
        {
          at: new Date().toISOString(),
          by: actorAccountId,
          decision: "partial_freeze_seed",
        },
      ],
      supersedesVersionId: null,
      contentRef: meta.contentRef,
      contentHash: null,
      createdBy: actorAccountId,
      correlationId,
    });
    await repo.setCurrentVersion(db, meta.id, versionId);
  }
}

export async function listArtifacts(
  db: PgQueryable,
): Promise<LaunchArtifactRegisterRow[]> {
  await seedLaunchArtifactRegister(db);
  await refreshExpiryStates(db);
  return repo.listArtifacts(db);
}

export async function listVersions(
  db: PgQueryable,
  artifactId: string,
): Promise<LaunchArtifactVersion[]> {
  if (!isLaunchArtifactId(artifactId)) {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_NOT_FOUND",
      MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA,
    );
  }
  return repo.listVersions(db, artifactId);
}

export async function createVersion(
  db: Pool,
  input: {
    artifactId: string;
    versionLabel: string;
    scopeSummary: string;
    affectedFrNfr?: string[];
    contentRef?: string | null;
    contentHash?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<LaunchArtifactVersion> {
  const artifactId = input.artifactId;
  if (!isLaunchArtifactId(artifactId)) {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_NOT_FOUND",
      MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA,
    );
  }
  const correlationId = input.correlationId ?? randomUUID();
  const versionLabel = input.versionLabel.trim();
  const scopeSummary = input.scopeSummary.trim();
  if (!versionLabel || !scopeSummary) {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_VERSION_CONFLICT",
      "برچسب نسخه و خلاصهٔ دامنه الزامی است.",
    );
  }

  return withTransaction(db, async (client) => {
    let art = await repo.getArtifact(client, artifactId);
    if (!art) {
      await seedLaunchArtifactRegister(client);
      art = await repo.getArtifact(client, artifactId);
    }
    if (!art) {
      throw new LaunchArtifactError(
        "LAUNCH_ARTIFACT_NOT_FOUND",
        MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA,
      );
    }

    await requireTrustAndAppend(client, {
      actorAccountId: input.actorAccountId,
      correlationId,
      operation: "launch.artifact.version.create",
      permission: "launch.artifact.manage",
      payload: { artifactId, versionLabel },
    });

    const id = randomUUID();
    const version = await repo.insertVersion(client, {
      id,
      artifactId,
      versionLabel,
      status: "draft",
      effectiveFrom: input.effectiveFrom ?? null,
      effectiveTo: input.effectiveTo ?? null,
      scopeSummary,
      affectedFrNfr: input.affectedFrNfr ?? [],
      approvalHistory: [],
      supersedesVersionId: null,
      contentRef: input.contentRef ?? null,
      contentHash: input.contentHash ?? null,
      createdBy: input.actorAccountId,
      correlationId,
    });
    return version;
  });
}

export async function approveVersion(
  db: Pool,
  input: {
    versionId: string;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<LaunchArtifactVersion> {
  const correlationId = input.correlationId ?? randomUUID();
  return withTransaction(db, async (client) => {
    const existing = await repo.getVersion(client, input.versionId);
    if (!existing) {
      throw new LaunchArtifactError(
        "LAUNCH_ARTIFACT_NOT_FOUND",
        MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA,
      );
    }
    if (existing.status !== "draft") {
      throw new LaunchArtifactError(
        "LAUNCH_ARTIFACT_VERSION_CONFLICT",
        "فقط نسخهٔ پیش‌نویس قابل تأیید است.",
      );
    }

    await requireTrustAndAppend(client, {
      actorAccountId: input.actorAccountId,
      correlationId,
      operation: "launch.artifact.version.approve",
      permission: "launch.artifact.approve",
      payload: {
        versionId: input.versionId,
        artifactId: existing.artifactId,
      },
    });

    const prior = await repo.findControllingVersion(
      client,
      existing.artifactId,
      new Date(),
    );
    if (prior && prior.id !== existing.id && prior.status === "approved") {
      await repo.markVersionSuperseded(client, prior.id);
    }

    const approved = await repo.approveVersion(client, {
      versionId: existing.id,
      actorAccountId: input.actorAccountId,
      supersedesVersionId: prior?.id ?? null,
      effectiveFrom: existing.effectiveFrom ?? new Date().toISOString(),
    });
    if (!approved) {
      throw new LaunchArtifactError(
        "LAUNCH_ARTIFACT_VERSION_CONFLICT",
        "فقط نسخهٔ پیش‌نویس قابل تأیید است.",
      );
    }
    await repo.setCurrentVersion(client, existing.artifactId, existing.id);
    return approved;
  });
}

export async function issueWaiver(
  db: Pool,
  input: {
    artifactId: string;
    artifactVersionId?: string | null;
    targetGateCode?: string | null;
    waiver: WaiverInput;
    correlationId?: string;
  },
): Promise<LaunchArtifactWaiver> {
  const artifactId = input.artifactId;
  if (!isLaunchArtifactId(artifactId)) {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_NOT_FOUND",
      MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA,
    );
  }

  try {
    assertWaiverAllowed(input.targetGateCode, input.waiver);
  } catch (err) {
    if (
      err instanceof LaunchArtifactError &&
      err.code === "WAIVER_NON_WAIVERABLE"
    ) {
      // Persist reject audit trail via access event only (no open waiver row)
      const correlationId = input.correlationId ?? randomUUID();
      await withTransaction(db, async (client) => {
        await requireTrustAndAppend(client, {
          actorAccountId: input.waiver.requesterAccountId,
          correlationId,
          operation: "launch.artifact.waiver.reject_non_waiverable",
          permission: "launch.artifact.waiver",
          payload: {
            artifactId,
            gate: input.targetGateCode,
          },
        });
        await repo.insertRejectedWaiverAttempt(client, {
          id: randomUUID(),
          artifactId,
          artifactVersionId: input.artifactVersionId ?? null,
          ownerAccountId: input.waiver.ownerAccountId,
          independentApproverAccountId:
            input.waiver.independentApproverAccountId,
          requesterAccountId: input.waiver.requesterAccountId,
          scope: input.waiver.scope,
          risk: input.waiver.risk,
          compensatingControls: input.waiver.compensatingControls,
          expiry: input.waiver.expiry,
          targetGateCode: input.targetGateCode ?? null,
          nonWaiverableAttemptCode: input.targetGateCode ?? "unknown",
          correlationId,
        });
      });
    }
    throw err;
  }

  const correlationId = input.correlationId ?? randomUUID();
  return withTransaction(db, async (client) => {
    await requireTrustAndAppend(client, {
      actorAccountId: input.waiver.requesterAccountId,
      correlationId,
      operation: "launch.artifact.waiver.issue",
      permission: "launch.artifact.waiver",
      payload: { artifactId },
    });

    return repo.insertWaiver(client, {
      id: randomUUID(),
      artifactId,
      artifactVersionId: input.artifactVersionId ?? null,
      ownerAccountId: input.waiver.ownerAccountId.trim(),
      independentApproverAccountId:
        input.waiver.independentApproverAccountId.trim(),
      requesterAccountId: input.waiver.requesterAccountId.trim(),
      scope: input.waiver.scope.trim(),
      risk: input.waiver.risk.trim(),
      compensatingControls: input.waiver.compensatingControls.trim(),
      expiry: input.waiver.expiry.trim(),
      status: "open",
      closureEvidence: null,
      targetGateCode: input.targetGateCode ?? null,
      nonWaiverableAttemptCode: null,
      correlationId,
    });
  });
}

export async function closeWaiver(
  db: Pool,
  input: {
    waiverId: string;
    closureEvidence: string;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<LaunchArtifactWaiver> {
  const evidence = input.closureEvidence.trim();
  if (!evidence) {
    throw new LaunchArtifactError("WAIVER_INVALID", MSG_WAIVER_INVALID_FA);
  }
  const correlationId = input.correlationId ?? randomUUID();
  return withTransaction(db, async (client) => {
    const existing = await repo.getWaiver(client, input.waiverId);
    if (!existing) {
      throw new LaunchArtifactError(
        "LAUNCH_ARTIFACT_NOT_FOUND",
        MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA,
      );
    }
    if (existing.status !== "open") {
      throw new LaunchArtifactError("WAIVER_INVALID", MSG_WAIVER_INVALID_FA);
    }
    await requireTrustAndAppend(client, {
      actorAccountId: input.actorAccountId,
      correlationId,
      operation: "launch.artifact.waiver.close",
      permission: "launch.artifact.waiver",
      payload: { waiverId: input.waiverId },
    });
    const closed = await repo.closeWaiver(client, input.waiverId, evidence);
    if (!closed) {
      throw new LaunchArtifactError("WAIVER_INVALID", MSG_WAIVER_INVALID_FA);
    }
    return closed;
  });
}

export async function openConflict(
  db: Pool,
  input: {
    artifactIds: string[];
    summary: string;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<LaunchArtifactConflict> {
  const ids = [
    ...new Set(input.artifactIds.filter(isLaunchArtifactId)),
  ];
  if (ids.length < 2) {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_VERSION_CONFLICT",
      "برای تعارض باز حداقل دو شناسهٔ AR متمایز لازم است.",
    );
  }
  const summary = input.summary.trim();
  if (!summary) {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_VERSION_CONFLICT",
      "خلاصهٔ تعارض الزامی است.",
    );
  }
  const correlationId = input.correlationId ?? randomUUID();
  return withTransaction(db, async (client) => {
    await requireTrustAndAppend(client, {
      actorAccountId: input.actorAccountId,
      correlationId,
      operation: "launch.artifact.conflict.open",
      permission: "launch.artifact.manage",
      payload: { artifactIds: ids },
    });
    return repo.insertConflict(client, {
      id: randomUUID(),
      status: "open",
      artifactIds: ids,
      summary,
      resolutionVersionIds: null,
      openedBy: input.actorAccountId,
      resolvedBy: null,
      correlationId,
    });
  });
}

export async function resolveConflict(
  db: Pool,
  input: {
    conflictId: string;
    resolutionVersionIds: string[];
    actorAccountId: string;
    jointApproverAccountId: string;
    correlationId?: string;
  },
): Promise<LaunchArtifactConflict> {
  if (
    !input.resolutionVersionIds.length ||
    input.actorAccountId === input.jointApproverAccountId
  ) {
    throw new LaunchArtifactError(
      "LAUNCH_ARTIFACT_VERSION_CONFLICT",
      "حل تعارض به نسخه‌های جدید و تأیید مشترک مستقل نیاز دارد.",
    );
  }
  const correlationId = input.correlationId ?? randomUUID();
  return withTransaction(db, async (client) => {
    const existing = await repo.getConflict(client, input.conflictId);
    if (!existing || existing.status !== "open") {
      throw new LaunchArtifactError(
        "CONFLICT_UNRESOLVED",
        MSG_CONFLICT_UNRESOLVED_FA,
      );
    }
    for (const vid of input.resolutionVersionIds) {
      const v = await repo.getVersion(client, vid);
      if (!v || !existing.artifactIds.includes(v.artifactId)) {
        throw new LaunchArtifactError(
          "LAUNCH_ARTIFACT_VERSION_CONFLICT",
          "حل تعارض به نسخه‌های متعلق به آرتیفکت‌های همان تعارض نیاز دارد.",
        );
      }
    }
    await requireTrustAndAppend(client, {
      actorAccountId: input.actorAccountId,
      correlationId,
      operation: "launch.artifact.conflict.resolve",
      permission: "launch.artifact.approve",
      payload: {
        conflictId: input.conflictId,
        jointApprover: input.jointApproverAccountId,
        resolutionVersionIds: input.resolutionVersionIds,
      },
    });
    const resolved = await repo.resolveConflict(client, {
      conflictId: input.conflictId,
      resolutionVersionIds: input.resolutionVersionIds,
      resolvedBy: input.actorAccountId,
    });
    if (!resolved) {
      throw new LaunchArtifactError(
        "CONFLICT_UNRESOLVED",
        MSG_CONFLICT_UNRESOLVED_FA,
      );
    }
    return resolved;
  });
}

export async function requireRebaseline(
  db: Pool,
  input: {
    affectedArtifactIds: string[];
    changeSummary: string;
    impactAssessment: string;
    requiredRegressionRefs?: string[];
    buildRef?: string | null;
    requesterAccountId: string;
    correlationId?: string;
  },
): Promise<RebaselineRecord> {
  const ids = input.affectedArtifactIds.filter(isLaunchArtifactId);
  const changeSummary = input.changeSummary.trim();
  const impactAssessment = input.impactAssessment.trim();
  if (!ids.length || !changeSummary || !impactAssessment) {
    throw new LaunchArtifactError(
      "REBASELINE_INCOMPLETE",
      MSG_REBASELINE_INCOMPLETE_FA,
    );
  }
  const correlationId = input.correlationId ?? randomUUID();
  return withTransaction(db, async (client) => {
    await requireTrustAndAppend(client, {
      actorAccountId: input.requesterAccountId,
      correlationId,
      operation: "launch.artifact.rebaseline.require",
      permission: "launch.artifact.rebaseline",
      payload: { affectedArtifactIds: ids },
    });
    return repo.insertRebaseline(client, {
      id: randomUUID(),
      status: "required",
      changeSummary,
      impactAssessment,
      affectedArtifactIds: ids,
      requiredRegressionRefs: input.requiredRegressionRefs ?? [],
      buildRef: input.buildRef ?? null,
      controllingVersions: [],
      requesterAccountId: input.requesterAccountId,
      independentApproverAccountId: null,
      approvedAt: null,
      correlationId,
    });
  });
}

export async function approveRebaseline(
  db: Pool,
  input: {
    rebaselineId: string;
    independentApproverAccountId: string;
    actorAccountId: string;
    buildRef?: string | null;
    correlationId?: string;
  },
): Promise<RebaselineRecord> {
  const correlationId = input.correlationId ?? randomUUID();
  return withTransaction(db, async (client) => {
    const existing = await repo.getRebaseline(client, input.rebaselineId);
    if (!existing) {
      throw new LaunchArtifactError(
        "REBASELINE_INCOMPLETE",
        MSG_REBASELINE_INCOMPLETE_FA,
      );
    }
    if (existing.status !== "required" && existing.status !== "in_review") {
      throw new LaunchArtifactError(
        "REBASELINE_INCOMPLETE",
        MSG_REBASELINE_INCOMPLETE_FA,
      );
    }
    if (
      !existing.impactAssessment.trim() ||
      existing.requiredRegressionRefs.length === 0
    ) {
      throw new LaunchArtifactError(
        "REBASELINE_INCOMPLETE",
        MSG_REBASELINE_INCOMPLETE_FA,
      );
    }
    if (input.independentApproverAccountId === existing.requesterAccountId) {
      throw new LaunchArtifactError(
        "WAIVER_APPROVER_NOT_INDEPENDENT",
        MSG_WAIVER_APPROVER_NOT_INDEPENDENT_FA,
      );
    }

    const controlling: ControllingVersionRef[] = [];
    for (const id of existing.affectedArtifactIds) {
      try {
        controlling.push(await resolveControllingVersion(client, id));
      } catch (err) {
        if (err instanceof LaunchArtifactError) {
          throw new LaunchArtifactError(
            "REBASELINE_INCOMPLETE",
            MSG_REBASELINE_INCOMPLETE_FA,
            { artifactId: id, cause: err.code },
          );
        }
        throw err;
      }
    }
    if (controlling.length !== existing.affectedArtifactIds.length) {
      throw new LaunchArtifactError(
        "REBASELINE_INCOMPLETE",
        MSG_REBASELINE_INCOMPLETE_FA,
      );
    }

    await requireTrustAndAppend(client, {
      actorAccountId: input.actorAccountId,
      correlationId,
      operation: "launch.artifact.rebaseline.approve",
      permission: "launch.artifact.rebaseline",
      payload: {
        rebaselineId: input.rebaselineId,
        buildRef: input.buildRef ?? existing.buildRef,
        controllingVersions: controlling,
      },
    });

    const approved = await repo.approveRebaseline(client, {
      rebaselineId: input.rebaselineId,
      independentApproverAccountId: input.independentApproverAccountId,
      buildRef: input.buildRef ?? existing.buildRef,
      controllingVersions: controlling,
    });
    if (!approved) {
      throw new LaunchArtifactError(
        "REBASELINE_INCOMPLETE",
        MSG_REBASELINE_INCOMPLETE_FA,
      );
    }
    return approved;
  });
}

export async function listConflicts(
  db: PgQueryable,
): Promise<LaunchArtifactConflict[]> {
  return repo.listConflicts(db);
}

export async function listRebaselines(
  db: PgQueryable,
): Promise<RebaselineRecord[]> {
  return repo.listRebaselines(db);
}

export async function listOpenWaivers(
  db: PgQueryable,
  artifactId?: string,
): Promise<LaunchArtifactWaiver[]> {
  await refreshExpiryStates(db, artifactId ? [artifactId] : undefined);
  return repo.listWaivers(db, { artifactId, status: "open" });
}

export async function countChangeControlSignals(
  db: PgQueryable,
): Promise<{
  expiredArtifacts: number;
  openConflicts: number;
  openRebaselines: number;
  openWaivers: number;
}> {
  await refreshExpiryStates(db);
  return repo.countSignals(db);
}
