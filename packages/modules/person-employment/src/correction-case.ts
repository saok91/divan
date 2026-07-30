/**
 * Correction-case orchestration (Story 7.5 / FR-53).
 * Person-linked + outcome links to FR-17 Correction / 7.3 disposal_run / hold.
 * Does not rewrite personnel lifecycle writers or retention core.
 * Home: person-employment (mirrors data-lifecycle); domain constants in audit-envelope.
 */

import { randomUUID } from "node:crypto";

import {
  CorrectionCaseError,
  MSG_CORRECTION_CASE_ATTACHMENT_NOT_DOWNLOADABLE_FA,
  MSG_CORRECTION_CASE_ATTACHMENT_NOT_FOUND_FA,
  MSG_CORRECTION_CASE_ATTACHMENT_QUARANTINED_FA,
  MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
  MSG_CORRECTION_CASE_DEADLINE_REQUIRED_FA,
  MSG_CORRECTION_CASE_INVALID_TRANSITION_FA,
  MSG_CORRECTION_CASE_NOT_FOUND_FA,
  MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA,
  MSG_CORRECTION_CASE_PENDING_PUBLICATION_HOOK_FA,
  assertCorrectionCaseSelfReviewAllowed,
  assertCorrectionCaseTransition,
  decisionStatusFromDecision,
  inertAttachmentHeaders,
  inspectCorrectionCaseAttachment,
  isBreachedPresentation,
  loadCorrectionCaseAttachmentPolicy,
  minimizeAttachmentFilename,
  type CorrectionCase,
  type CorrectionCaseAttachment,
  type CorrectionCaseEvidenceKind,
  type CorrectionCaseEvidenceRef,
  type CorrectionCaseOutcomeLinkType,
  type CorrectionCaseOutcomeLinks,
  type CorrectionCaseStatus,
} from "@divan/audit-envelope";
import { appendAccessEvent } from "@divan/event-store";

import {
  getDisposalRun,
  getLegalHoldById,
} from "./data-lifecycle-repo";
import { isMissingRelationError } from "./data-lifecycle";
import {
  correctionEventExists,
  countAttachmentsForCase,
  getAttachmentById,
  getCorrectionCaseById,
  insertAttachment,
  insertCaseEvent,
  insertCorrectionCase,
  insertEvidenceRef,
  insertOutcomeLink,
  listAttachments,
  listCorrectionCases,
  listEvidenceRefs,
  listOutcomeLinks,
  lockCorrectionCaseForUpdate,
  markCorrectionCasesBreached,
  personRegistryExists,
  sha256Hex,
  updateCorrectionCaseStatus,
  withCorrectionCaseTransaction,
  type PgQueryable,
} from "./correction-case-repo";

export type CorrectionCaseDetail = {
  case: CorrectionCase;
  evidenceRefs: CorrectionCaseEvidenceRef[];
  attachments: CorrectionCaseAttachment[];
  outcomeLinks: CorrectionCaseOutcomeLinks[];
  breachedPresentation: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DECIDED_STATUSES: readonly CorrectionCaseStatus[] = [
  "approved",
  "rejected",
  "constrained",
];

async function requireCase(
  db: PgQueryable,
  caseId: string,
): Promise<CorrectionCase> {
  const c = await getCorrectionCaseById(db, caseId);
  if (!c) {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_NOT_FOUND",
      MSG_CORRECTION_CASE_NOT_FOUND_FA,
    );
  }
  return c;
}

function assertCaseNotClosed(c: CorrectionCase): void {
  if (c.status === "closed") {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_INVALID_TRANSITION",
      MSG_CORRECTION_CASE_INVALID_TRANSITION_FA,
      { from: "closed", reason: "terminal_case" },
    );
  }
}

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err != null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Lazy escalate overdue active cases on read/list, plus durable case_event.
 * Also exposed as escalateOverdueCases for explicit job/procedure hook.
 */
export async function escalateOverdueCases(
  db: PgQueryable,
  input: {
    actorAccountId: string;
    correlationId?: string;
    now?: Date;
  },
): Promise<CorrectionCase[]> {
  const correlationId = input.correlationId ?? randomUUID();
  const escalated = await markCorrectionCasesBreached(db, {
    actorAccountId: input.actorAccountId,
    now: input.now,
  });
  for (const c of escalated) {
    try {
      await insertCaseEvent(db, {
        caseId: c.id,
        kind: "deadline_breached",
        detail: {
          deadlineAt: c.deadlineAt,
          previousNote: "مهلت گذشته",
        },
        actorAccountId: input.actorAccountId,
        correlationId,
      });
    } catch {
      /* durable case row already flipped */
    }
    try {
      await appendAccessEvent(db, {
        correlationId,
        actorAccountId: input.actorAccountId,
        operation: "correction.case.escalate",
        scope: { channel: "correction_case" },
        result: "allow",
        reason: "deadline_breached",
        entityType: "correction_case",
        entityId: c.id,
        payload: { outcome: "breached" },
      });
    } catch {
      /* soft — breach already persisted; secondary path */
    }
  }
  return escalated;
}

export async function openCorrectionCase(
  db: PgQueryable,
  input: {
    requestReference: string;
    authorityVerifiedAt?: Date;
    authorityVerifiedBy: string;
    personId: string;
    ownerAccountId: string;
    deadlineAt: Date;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<CorrectionCase> {
  const requestReference = input.requestReference.trim();
  if (!requestReference) {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_DEADLINE_REQUIRED",
      "مرجع درخواست الزامی است.",
    );
  }
  if (!(input.deadlineAt instanceof Date) || Number.isNaN(input.deadlineAt.getTime())) {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_DEADLINE_REQUIRED",
      MSG_CORRECTION_CASE_DEADLINE_REQUIRED_FA,
    );
  }
  if (!UUID_RE.test(input.personId.trim())) {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_NOT_FOUND",
      "فرد یافت نشد.",
      { reason: "person_id_invalid" },
    );
  }
  const personOk = await personRegistryExists(db, input.personId.trim());
  if (!personOk) {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_NOT_FOUND",
      "فرد یافت نشد.",
      { reason: "person_not_found" },
    );
  }

  const correlationId = input.correlationId ?? randomUUID();
  return withCorrectionCaseTransaction(db, async (tx) => {
    let opened: CorrectionCase;
    try {
      opened = await insertCorrectionCase(tx, {
        requestReference,
        authorityVerifiedAt: input.authorityVerifiedAt ?? new Date(),
        authorityVerifiedBy:
          input.authorityVerifiedBy.trim() || input.actorAccountId,
        personId: input.personId.trim(),
        ownerAccountId: input.ownerAccountId,
        deadlineAt: input.deadlineAt,
        correlationId,
        actorAccountId: input.actorAccountId,
      });
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        throw new CorrectionCaseError(
          "CORRECTION_CASE_INVALID_TRANSITION",
          "برای این فرد و مرجع درخواست، پرونده فعال دیگری وجود دارد.",
          { reason: "duplicate_active_request" },
        );
      }
      throw err;
    }
    // Required capture — fail-closed (AC6): rollback if append fails.
    await appendAccessEvent(tx, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "correction.case.open",
      scope: { channel: "correction_case", personId: input.personId },
      result: "allow",
      reason: "case_opened",
      entityType: "correction_case",
      entityId: opened.id,
      payload: { outcome: "opened" },
    });
    return opened;
  });
}

export async function updateCorrectionCaseProgress(
  db: PgQueryable,
  input: {
    caseId: string;
    toStatus: Extract<
      CorrectionCaseStatus,
      "in_progress" | "pending_decision"
    >;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<CorrectionCase> {
  const correlationId = input.correlationId ?? randomUUID();
  return withCorrectionCaseTransaction(db, async (tx) => {
    const current = await requireCase(tx, input.caseId);
    assertCorrectionCaseTransition(current.status, input.toStatus);
    const updated = await updateCorrectionCaseStatus(tx, {
      caseId: input.caseId,
      status: input.toStatus,
      expectedStatus: current.status,
      actorAccountId: input.actorAccountId,
    });
    if (!updated) {
      throw new CorrectionCaseError(
        "CORRECTION_CASE_INVALID_TRANSITION",
        MSG_CORRECTION_CASE_INVALID_TRANSITION_FA,
        { reason: "concurrent_status_change" },
      );
    }
    await appendAccessEvent(tx, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "correction.case.update",
      scope: { channel: "correction_case" },
      result: "allow",
      reason: input.toStatus,
      entityType: "correction_case",
      entityId: updated.id,
      payload: { outcome: input.toStatus, from: current.status },
    });
    return updated;
  });
}

export async function decideCorrectionCase(
  db: PgQueryable,
  input: {
    caseId: string;
    decision: "approved" | "rejected" | "constrained";
    decisionReason: string;
    actorAccountId: string;
    correlationId?: string;
    /** When true, skip owner≠actor SoD (tests only). Default enforces SoD. */
    skipSelfReview?: boolean;
  },
): Promise<CorrectionCase> {
  const correlationId = input.correlationId ?? randomUUID();
  return withCorrectionCaseTransaction(db, async (tx) => {
    const current = await requireCase(tx, input.caseId);
    if (!input.skipSelfReview) {
      assertCorrectionCaseSelfReviewAllowed(
        current.ownerAccountId,
        input.actorAccountId,
      );
    }
    const toStatus = decisionStatusFromDecision(input.decision);
    assertCorrectionCaseTransition(current.status, toStatus);
    const reason = input.decisionReason.trim();
    if (!reason) {
      throw new CorrectionCaseError(
        "CORRECTION_CASE_INVALID_TRANSITION",
        "دلیل تصمیم الزامی است.",
      );
    }
    const updated = await updateCorrectionCaseStatus(tx, {
      caseId: input.caseId,
      status: toStatus,
      expectedStatus: current.status,
      decision: input.decision,
      decisionReason: reason,
      actorAccountId: input.actorAccountId,
    });
    if (!updated) {
      throw new CorrectionCaseError(
        "CORRECTION_CASE_INVALID_TRANSITION",
        MSG_CORRECTION_CASE_INVALID_TRANSITION_FA,
        { reason: "concurrent_status_change" },
      );
    }
    await appendAccessEvent(tx, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "correction.case.decide",
      scope: { channel: "correction_case" },
      result: "allow",
      reason: input.decision,
      entityType: "correction_case",
      entityId: updated.id,
      payload: { outcome: input.decision },
    });
    return updated;
  });
}

export async function closeCorrectionCase(
  db: PgQueryable,
  input: {
    caseId: string;
    closureEvidence: Record<string, string>;
    actorAccountId: string;
    correlationId?: string;
    /** When true, skip owner≠actor SoD (tests only). Default enforces SoD. */
    skipSelfReview?: boolean;
  },
): Promise<CorrectionCase> {
  const correlationId = input.correlationId ?? randomUUID();
  return withCorrectionCaseTransaction(db, async (tx) => {
    const current = await requireCase(tx, input.caseId);
    if (!input.skipSelfReview) {
      assertCorrectionCaseSelfReviewAllowed(
        current.ownerAccountId,
        input.actorAccountId,
      );
    }
    assertCorrectionCaseTransition(current.status, "closed");
    const evidence: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.closureEvidence)) {
      if (typeof v === "string" && v.trim()) {
        evidence[k.slice(0, 64)] = v.trim().slice(0, 500);
      }
    }
    if (Object.keys(evidence).length === 0) {
      throw new CorrectionCaseError(
        "CORRECTION_CASE_INVALID_TRANSITION",
        "شواهد بستن پرونده الزامی است.",
      );
    }
    const updated = await updateCorrectionCaseStatus(tx, {
      caseId: input.caseId,
      status: "closed",
      expectedStatus: current.status,
      closureEvidence: evidence,
      actorAccountId: input.actorAccountId,
    });
    if (!updated) {
      throw new CorrectionCaseError(
        "CORRECTION_CASE_INVALID_TRANSITION",
        MSG_CORRECTION_CASE_INVALID_TRANSITION_FA,
        { reason: "concurrent_status_change" },
      );
    }
    await appendAccessEvent(tx, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "correction.case.close",
      scope: { channel: "correction_case" },
      result: "allow",
      reason: "case_closed",
      entityType: "correction_case",
      entityId: updated.id,
      payload: { outcome: "closed" },
    });
    return updated;
  });
}

export async function getCorrectionCaseDetail(
  db: PgQueryable,
  caseId: string,
  opts?: { actorAccountId?: string; escalate?: boolean },
): Promise<CorrectionCaseDetail> {
  if (opts?.escalate !== false && opts?.actorAccountId) {
    await escalateOverdueCases(db, {
      actorAccountId: opts.actorAccountId,
    });
  }
  const c = await requireCase(db, caseId);
  const [evidenceRefs, attachments, outcomeLinks] = await Promise.all([
    listEvidenceRefs(db, caseId),
    listAttachments(db, caseId),
    listOutcomeLinks(db, caseId),
  ]);
  return {
    case: c,
    evidenceRefs,
    attachments,
    outcomeLinks,
    breachedPresentation: isBreachedPresentation(c),
  };
}

export async function listCorrectionCaseSummaries(
  db: PgQueryable,
  input: {
    actorAccountId: string;
    status?: CorrectionCaseStatus;
    breachedOnly?: boolean;
    personId?: string;
    limit?: number;
  },
): Promise<Array<CorrectionCase & { breachedPresentation: boolean }>> {
  await escalateOverdueCases(db, { actorAccountId: input.actorAccountId });
  const rows = await listCorrectionCases(db, {
    status: input.status,
    breachedOnly: input.breachedOnly,
    personId: input.personId,
    limit: input.limit,
  });
  return rows.map((c) => ({
    ...c,
    breachedPresentation: isBreachedPresentation(c),
  }));
}

export async function addCorrectionCaseEvidenceRef(
  db: PgQueryable,
  input: {
    caseId: string;
    kind: CorrectionCaseEvidenceKind;
    uriOrRef: string;
    metadata?: Record<string, string>;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<CorrectionCaseEvidenceRef> {
  const correlationId = input.correlationId ?? randomUUID();
  return withCorrectionCaseTransaction(db, async (tx) => {
    const current = await requireCase(tx, input.caseId);
    assertCaseNotClosed(current);
    const uriOrRef = input.uriOrRef.trim().slice(0, 500);
    if (!uriOrRef) {
      throw new CorrectionCaseError(
        "CORRECTION_CASE_INVALID_TRANSITION",
        "مرجع شواهد الزامی است.",
      );
    }
    const metadata: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.metadata ?? {})) {
      if (typeof v === "string") metadata[k.slice(0, 64)] = v.slice(0, 200);
    }
    const ref = await insertEvidenceRef(tx, {
      caseId: input.caseId,
      kind: input.kind,
      uriOrRef,
      metadata,
      actorAccountId: input.actorAccountId,
    });
    await appendAccessEvent(tx, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "correction.case.evidence.add",
      scope: { channel: "correction_case" },
      result: "allow",
      reason: "evidence_ref_added",
      entityType: "correction_case_evidence",
      entityId: ref.id,
      payload: { kind: input.kind },
    });
    return ref;
  });
}

export async function uploadCorrectionCaseAttachment(
  db: PgQueryable,
  input: {
    caseId: string;
    clientFilename: string;
    clientMime?: string | null;
    bytes: Uint8Array;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<{
  attachment: CorrectionCaseAttachment;
  inspectionStatus: "allowed" | "rejected" | "quarantined";
}> {
  const correlationId = input.correlationId ?? randomUUID();
  const policy = loadCorrectionCaseAttachmentPolicy();
  const inspection = inspectCorrectionCaseAttachment(
    {
      clientFilename: input.clientFilename,
      clientMime: input.clientMime,
      bytes: input.bytes,
    },
    policy,
  );

  const result = await withCorrectionCaseTransaction(db, async (tx) => {
    const locked = await lockCorrectionCaseForUpdate(tx, input.caseId);
    if (!locked) {
      throw new CorrectionCaseError(
        "CORRECTION_CASE_NOT_FOUND",
        MSG_CORRECTION_CASE_NOT_FOUND_FA,
      );
    }
    assertCaseNotClosed(locked);

    const count = await countAttachmentsForCase(tx, input.caseId);
    if (count >= policy.maxPerCase) {
      throw new CorrectionCaseError(
        "CORRECTION_CASE_ATTACHMENT_REJECTED",
        MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
        { reason: "max_per_case" },
      );
    }

    const storageKey = randomUUID();
    const minimized = minimizeAttachmentFilename(input.clientFilename);
    const storeBytes =
      inspection.status === "allowed" || inspection.status === "quarantined"
        ? Buffer.from(input.bytes)
        : null;
    const hash = storeBytes != null ? sha256Hex(input.bytes) : null;

    const attachment = await insertAttachment(tx, {
      caseId: input.caseId,
      storageKey,
      originalFilenameMinimized: minimized,
      contentTypeDetected: inspection.contentTypeDetected,
      sizeBytes: inspection.sizeBytes,
      inspectionStatus: inspection.status,
      sha256: hash,
      contentBytes: storeBytes,
      uploadedBy: input.actorAccountId,
    });

    await appendAccessEvent(tx, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "correction.case.attach",
      scope: { channel: "correction_case" },
      result: inspection.status === "allowed" ? "allow" : "deny",
      reason: inspection.reasonCode ?? inspection.status,
      entityType: "correction_case_attachment",
      entityId: attachment.id,
      payload: {
        outcome: inspection.status,
        sizeBytes: inspection.sizeBytes,
      },
    });

    return {
      attachment,
      inspectionStatus: inspection.status as
        | "allowed"
        | "rejected"
        | "quarantined",
    };
  });

  // Persist reject/quarantine rows, then fail-closed to caller (do not roll back).
  if (result.inspectionStatus === "rejected") {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_ATTACHMENT_REJECTED",
      MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
      { attachmentId: result.attachment.id },
    );
  }
  if (result.inspectionStatus === "quarantined") {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_ATTACHMENT_QUARANTINED",
      MSG_CORRECTION_CASE_ATTACHMENT_QUARANTINED_FA,
      { attachmentId: result.attachment.id },
    );
  }

  return { attachment: result.attachment, inspectionStatus: "allowed" };
}

export async function getCorrectionCaseAttachmentDownload(
  db: PgQueryable,
  input: {
    attachmentId: string;
    mode: "download" | "preview";
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<{
  bytes: Buffer;
  headers: Record<string, string>;
  attachment: CorrectionCaseAttachment;
}> {
  const row = await getAttachmentById(db, input.attachmentId);
  if (!row) {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_ATTACHMENT_NOT_FOUND",
      MSG_CORRECTION_CASE_ATTACHMENT_NOT_FOUND_FA,
    );
  }
  if (row.inspectionStatus !== "allowed" || row.contentBytes == null) {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_ATTACHMENT_NOT_DOWNLOADABLE",
      MSG_CORRECTION_CASE_ATTACHMENT_NOT_DOWNLOADABLE_FA,
      { status: row.inspectionStatus },
    );
  }

  const policy = loadCorrectionCaseAttachmentPolicy();
  const ext = row.originalFilenameMinimized.split(".").pop()?.toLowerCase() ?? "";
  const previewOk =
    input.mode === "preview" && policy.previewExtensions.includes(ext);
  const disposition =
    input.mode === "preview" && previewOk ? "inline" : "attachment";

  // Preview only for explicitly allowlisted types; otherwise force download.
  if (input.mode === "preview" && !previewOk) {
    // Still deliver as inert download — no auto-execute
  }

  const headers = inertAttachmentHeaders({
    filenameMinimized: row.originalFilenameMinimized,
    contentType: row.contentTypeDetected,
    disposition: disposition === "inline" ? "inline" : "attachment",
  });

  try {
    await appendAccessEvent(db, {
      correlationId: input.correlationId ?? randomUUID(),
      actorAccountId: input.actorAccountId,
      operation:
        input.mode === "preview"
          ? "correction.case.attach.preview"
          : "correction.case.attach.download",
      scope: { channel: "correction_case" },
      result: "allow",
      reason: input.mode,
      entityType: "correction_case_attachment",
      entityId: row.id,
      payload: {},
    });
  } catch {
    /* soft-deny secondary after allow */
  }

  const { contentBytes, ...attachment } = row;
  return { bytes: contentBytes!, headers, attachment };
}

async function validateOutcomeTarget(
  db: PgQueryable,
  linkType: CorrectionCaseOutcomeLinkType,
  targetId: string,
): Promise<void> {
  const id = targetId.trim();
  if (!id) {
    throw new CorrectionCaseError(
      "CORRECTION_CASE_OUTCOME_TARGET_INVALID",
      MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA,
    );
  }
  switch (linkType) {
    case "personnel_correction": {
      if (!UUID_RE.test(id)) {
        throw new CorrectionCaseError(
          "CORRECTION_CASE_OUTCOME_TARGET_INVALID",
          MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA,
          { linkType, targetId: id },
        );
      }
      const ok = await correctionEventExists(db, id);
      if (!ok) {
        throw new CorrectionCaseError(
          "CORRECTION_CASE_OUTCOME_TARGET_INVALID",
          MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA,
          { linkType, targetId: id },
        );
      }
      return;
    }
    case "disposal_run":
    case "hold": {
      if (!UUID_RE.test(id)) {
        throw new CorrectionCaseError(
          "CORRECTION_CASE_OUTCOME_TARGET_INVALID",
          MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA,
          { linkType, targetId: id },
        );
      }
      if (linkType === "disposal_run") {
        const run = await getDisposalRun(db, id);
        if (!run) {
          throw new CorrectionCaseError(
            "CORRECTION_CASE_OUTCOME_TARGET_INVALID",
            MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA,
            { linkType, targetId: id },
          );
        }
      } else {
        const hold = await getLegalHoldById(db, id);
        if (!hold) {
          throw new CorrectionCaseError(
            "CORRECTION_CASE_OUTCOME_TARGET_INVALID",
            MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA,
            { linkType, targetId: id },
          );
        }
      }
      return;
    }
    case "pending_publication_hook":
    case "recalc":
    case "response_evidence":
      // Honesty stubs — pending_publication_hook for backlog when no publication id;
      // prefer decision_publication / published_artifact when a real id exists.
      return;
    case "published_artifact":
    case "decision_publication": {
      // FR-54: prefer decision_publication; published_artifact aliases same store.
      if (!UUID_RE.test(id)) {
        throw new CorrectionCaseError(
          "CORRECTION_CASE_OUTCOME_TARGET_INVALID",
          MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA,
          { linkType, targetId: id },
        );
      }
      let pub;
      try {
        pub = await db.query(
          `SELECT 1 AS ok FROM reporting.decision_publication WHERE id = $1::uuid`,
          [id],
        );
      } catch (err) {
        if (isMissingRelationError(err)) {
          throw new CorrectionCaseError(
            "CORRECTION_CASE_OUTCOME_TARGET_INVALID",
            MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA,
            { linkType, targetId: id, reason: "schema_missing" },
          );
        }
        throw err;
      }
      if (pub.rows.length === 0) {
        throw new CorrectionCaseError(
          "CORRECTION_CASE_OUTCOME_TARGET_INVALID",
          MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA,
          { linkType, targetId: id },
        );
      }
      return;
    }
  }
}

export async function linkCorrectionCaseOutcome(
  db: PgQueryable,
  input: {
    caseId: string;
    linkType: CorrectionCaseOutcomeLinkType;
    targetId: string;
    note?: string | null;
    actorAccountId: string;
    correlationId?: string;
  },
): Promise<CorrectionCaseOutcomeLinks> {
  const correlationId = input.correlationId ?? randomUUID();
  return withCorrectionCaseTransaction(db, async (tx) => {
    const current = await requireCase(tx, input.caseId);
    assertCaseNotClosed(current);
    if (!DECIDED_STATUSES.includes(current.status)) {
      throw new CorrectionCaseError(
        "CORRECTION_CASE_INVALID_TRANSITION",
        "پیوند نتیجه فقط پس از ثبت تصمیم مجاز است.",
        { status: current.status },
      );
    }
    await validateOutcomeTarget(tx, input.linkType, input.targetId);
    let note = input.note?.trim().slice(0, 500) ?? null;
    if (input.linkType === "pending_publication_hook" && !note) {
      note = MSG_CORRECTION_CASE_PENDING_PUBLICATION_HOOK_FA;
    }
    const link = await insertOutcomeLink(tx, {
      caseId: input.caseId,
      linkType: input.linkType,
      targetId: input.targetId.trim(),
      note,
      actorAccountId: input.actorAccountId,
    });
    await appendAccessEvent(tx, {
      correlationId,
      actorAccountId: input.actorAccountId,
      operation: "correction.case.outcome.link",
      scope: { channel: "correction_case" },
      result: "allow",
      reason: input.linkType,
      entityType: "correction_case_outcome",
      entityId: link.id,
      payload: { linkType: input.linkType },
    });
    return link;
  });
}

export { getCorrectionCaseById, listAttachments, listOutcomeLinks };
