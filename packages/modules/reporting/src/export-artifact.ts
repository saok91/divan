/**
 * Governed export artifact domain (Story 6.5 / FR-41 / FR-52).
 *
 * Pipeline (normative):
 * authorize → PopulationPort ∩ InferenceBulk (channel export) → assemble snapshot
 * → reauthorizeForQueuedOrArtifactWork → persist → custody ack → reauth → stream.
 *
 * Reauth is injected (web passes identity-access hook) — first production consumer.
 */

import { createHash, randomUUID } from "node:crypto";

import type { CategoryRegistry } from "@divan/audit-envelope";
import { appendAccessEvent } from "@divan/event-store";

import {
  CLASSIFICATION_INTERNAL_FA,
  CLASSIFICATION_SENSITIVE_FA,
  CUSTODY_BOUNDARY_FA,
  EXPORT_ARTIFACT_TTL_MS,
  EXPORT_CUSTODY_BULK_ROW_THRESHOLD,
  HANDLING_DEFAULT_FA,
} from "./export-permissions";
import {
  ExportError,
  MSG_ARTIFACT_DISPOSED_FA,
  MSG_ARTIFACT_EXPIRED_FA,
  MSG_ARTIFACT_NOT_FOUND_FA,
  MSG_ARTIFACT_REVOKED_FA,
  MSG_CONTENT_MISSING_FA,
  MSG_CUSTODY_ACK_REQUIRED_FA,
  MSG_FORMAT_UNSUPPORTED_FA,
  MSG_REAUTH_FAILED_FA,
  MSG_SENSITIVE_EXPORT_DENIED_FA,
  MSG_SNAPSHOT_MISMATCH_FA,
} from "./export-errors";
import {
  getExportArtifactById,
  getExportArtifactWithBytes,
  insertExportArtifact,
  insertLifecycleEvent,
  insertRetrieval,
  updateExportArtifactState,
  withPgTransaction,
  type ExportArtifactRecord,
  type ExportFormat,
  type ExportSourceSurface,
  type JsonValue,
  type PgQueryable,
} from "./export-artifact-repo";
import {
  writeFormulaSafeCsv,
  writeFormulaSafeXlsx,
  type ExportColumn,
  type ExportRow,
} from "./formula-safe-export";

export type ExportReauthFn = (input: {
  accountId: string;
  populationChannel: "export";
  objectIds?: string[];
  actorScopeCodes?: string[];
  asOfDate?: string;
}) => Promise<{ allowed: boolean; reason: string }>;

export type ExportFieldDef = {
  id: string;
  headerFa: string;
  /** Category id when field maps to a sensitive registry entry. */
  dataCategory?: string | null;
};

export type StableSnapshotInput = {
  sourceSurface: ExportSourceSurface;
  sourceKey?: string | null;
  filters: JsonValue;
  fieldIds: readonly string[];
  asOf: string;
};

/**
 * Canonical SHA-256 over filters + fields + as-of + source — tamper evidence.
 */
export function computeExportSnapshotHash(input: StableSnapshotInput): string {
  const canonical = {
    sourceSurface: input.sourceSurface,
    sourceKey: input.sourceKey ?? null,
    filters: input.filters,
    fieldIds: [...input.fieldIds].sort(),
    asOf: input.asOf,
  };
  return createHash("sha256")
    .update(stableStringify(canonical))
    .digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/**
 * Omit fields whose category requiresSeparateExport unless actor holds
 * category-specific `*.export` entitlement. View/read never unlocks export.
 * Omit — never mask as zeros.
 */
export function filterExportFields(input: {
  fields: readonly ExportFieldDef[];
  categoryRegistry: CategoryRegistry;
  /** True when actor holds export entitlement for that category id. */
  holdsCategoryExport: (categoryId: string) => boolean;
}): {
  permitted: ExportFieldDef[];
  omittedSensitiveIds: string[];
  hasSensitiveIncluded: boolean;
} {
  const permitted: ExportFieldDef[] = [];
  const omittedSensitiveIds: string[] = [];
  let hasSensitiveIncluded = false;

  for (const field of input.fields) {
    const catId = field.dataCategory?.trim();
    if (!catId) {
      permitted.push(field);
      continue;
    }
    const entry = input.categoryRegistry.categories.find((c) => c.id === catId);
    if (!entry || !entry.requiresSeparateExport) {
      permitted.push(field);
      continue;
    }
    if (!input.holdsCategoryExport(catId)) {
      omittedSensitiveIds.push(field.id);
      continue;
    }
    hasSensitiveIncluded = true;
    permitted.push(field);
  }

  return { permitted, omittedSensitiveIds, hasSensitiveIncluded };
}

export function assertNoSensitiveWithoutExport(input: {
  omittedSensitiveIds: readonly string[];
  /** When true, attempting to force-include omitted ids is a hard deny. */
  clientRequestedSensitiveIds?: readonly string[];
}): void {
  const forced = (input.clientRequestedSensitiveIds ?? []).filter((id) =>
    input.omittedSensitiveIds.includes(id),
  );
  if (forced.length > 0) {
    throw new ExportError(
      "SENSITIVE_EXPORT_DENIED",
      MSG_SENSITIVE_EXPORT_DENIED_FA,
    );
  }
}

export function resolveClassification(hasSensitive: boolean): {
  classification: string;
  classificationFa: string;
} {
  if (hasSensitive) {
    return {
      classification: "sensitive_restricted",
      classificationFa: CLASSIFICATION_SENSITIVE_FA,
    };
  }
  return {
    classification: "internal_restricted",
    classificationFa: CLASSIFICATION_INTERNAL_FA,
  };
}

export function requiresCustodyAcknowledgement(input: {
  hasSensitiveFields: boolean;
  rowCount: number;
}): boolean {
  return (
    input.hasSensitiveFields ||
    input.rowCount >= EXPORT_CUSTODY_BULK_ROW_THRESHOLD
  );
}

function projectRows(
  rows: readonly ExportRow[],
  fieldIds: readonly string[],
): ExportRow[] {
  return rows.map((row) => {
    const cells: Record<string, string | number | null> = {};
    for (const id of fieldIds) {
      cells[id] = row.cells[id] ?? null;
    }
    return { id: row.id, cells };
  });
}

export type CreateExportArtifactInput = {
  ownerAccountId: string;
  purpose: string;
  sourceSurface: ExportSourceSurface;
  sourceKey?: string | null;
  filtersSnapshot: JsonValue;
  /** Client-reviewed hash — must match recomputed hash. */
  reviewedSnapshotHash: string;
  asOf: string;
  format: ExportFormat;
  fields: readonly ExportFieldDef[];
  rows: readonly ExportRow[];
  categoryRegistry: CategoryRegistry;
  holdsCategoryExport: (categoryId: string) => boolean;
  reauth: ExportReauthFn;
  actorScopeCodes?: string[];
  objectIds?: string[];
  correlationId: string;
  populationAuthzMode?: string | null;
  /** Optional override TTL (ms); default EXPORT_ARTIFACT_TTL_MS. */
  ttlMs?: number;
};

export type CreateExportArtifactResult = {
  artifact: ExportArtifactRecord;
  omittedSensitiveIds: string[];
  custodyBoundaryFa: string;
};

export async function createExportArtifact(
  db: PgQueryable,
  input: CreateExportArtifactInput,
): Promise<CreateExportArtifactResult> {
  if (input.format !== "csv" && input.format !== "xlsx") {
    throw new ExportError("FORMAT_UNSUPPORTED", MSG_FORMAT_UNSUPPORTED_FA);
  }

  const filtered = filterExportFields({
    fields: input.fields,
    categoryRegistry: input.categoryRegistry,
    holdsCategoryExport: input.holdsCategoryExport,
  });
  assertNoSensitiveWithoutExport({
    omittedSensitiveIds: filtered.omittedSensitiveIds,
  });

  const fieldIds = filtered.permitted.map((f) => f.id);
  const recomputedHash = computeExportSnapshotHash({
    sourceSurface: input.sourceSurface,
    sourceKey: input.sourceKey,
    filters: input.filtersSnapshot,
    fieldIds: input.fields.map((f) => f.id),
    asOf: input.asOf,
  });
  // Hash uses the *reviewed* field list (pre-omit) so soft-omit of unauthorized
  // sensitive columns does not break snapshot binding; client must not tamper filters.
  if (recomputedHash !== input.reviewedSnapshotHash) {
    throw new ExportError("SNAPSHOT_MISMATCH", MSG_SNAPSHOT_MISMATCH_FA);
  }

  const reauth = await input.reauth({
    accountId: input.ownerAccountId,
    populationChannel: "export",
    objectIds: input.objectIds,
    actorScopeCodes: input.actorScopeCodes,
    asOfDate: input.asOf,
  });
  if (!reauth.allowed) {
    throw new ExportError("REAUTH_FAILED", MSG_REAUTH_FAILED_FA, {
      reason: reauth.reason,
    });
  }

  const projected = projectRows(input.rows, fieldIds);
  const columns: ExportColumn[] = filtered.permitted.map((f) => ({
    id: f.id,
    headerFa: f.headerFa,
  }));

  const contentBytes =
    input.format === "csv"
      ? writeFormulaSafeCsv(columns, projected)
      : await writeFormulaSafeXlsx(columns, projected, {
          sheetName: "export",
        });

  const { classification, classificationFa } = resolveClassification(
    filtered.hasSensitiveIncluded,
  );
  const requiresCustodyAck = requiresCustodyAcknowledgement({
    hasSensitiveFields: filtered.hasSensitiveIncluded,
    rowCount: projected.length,
  });

  const ttl = input.ttlMs ?? EXPORT_ARTIFACT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  const safeName = `divan-export-${input.sourceSurface}-${Date.now()}.${input.format}`;

  const artifact = await withPgTransaction(db, async (tx) => {
    const created = await insertExportArtifact(tx, {
      ownerAccountId: input.ownerAccountId,
      purpose: input.purpose,
      classification,
      classificationFa,
      handlingFa: HANDLING_DEFAULT_FA,
      scopeJson: {
        sourceSurface: input.sourceSurface,
        sourceKey: input.sourceKey ?? null,
        asOf: input.asOf,
        fieldIds,
        rowCount: projected.length,
        subjectIds: input.objectIds ?? [],
      },
      fieldIds,
      sourceSurface: input.sourceSurface,
      sourceKey: input.sourceKey,
      filtersSnapshot: input.filtersSnapshot,
      snapshotHash: recomputedHash,
      format: input.format,
      expiresAt,
      rowCount: projected.length,
      requiresCustodyAck,
      hasSensitiveFields: filtered.hasSensitiveIncluded,
      correlationId: input.correlationId,
      contentBytes,
      contentFilename: safeName,
      populationAuthzMode: input.populationAuthzMode,
    });

    await insertLifecycleEvent(tx, {
      artifactId: created.id,
      eventKind: "ready",
      actorAccountId: input.ownerAccountId,
      reason: `reauth:${reauth.reason}`,
      correlationId: input.correlationId,
    });

    await appendAccessEvent(tx, {
      correlationId: input.correlationId,
      actorAccountId: input.ownerAccountId,
      operation: "export.artifact.create",
      scope: {
        channel: "export",
        purpose: input.purpose,
        sourceSurface: input.sourceSurface,
        format: input.format,
        volumeAuthorized: projected.length,
        fieldCount: fieldIds.length,
        fieldIds,
        filtersSnapshot: input.filtersSnapshot,
        classification,
        requiresCustodyAck,
      },
      result: "allow",
      reason: reauth.reason,
      entityType: "export_artifact",
      entityId: created.id,
      payload: {
        snapshotHash: recomputedHash,
        omittedSensitiveCount: filtered.omittedSensitiveIds.length,
        outcome: "ready",
      },
    });

    return created;
  });

  return {
    artifact,
    omittedSensitiveIds: filtered.omittedSensitiveIds,
    custodyBoundaryFa: CUSTODY_BOUNDARY_FA,
  };
}

export type DownloadExportArtifactInput = {
  artifactId: string;
  retrieverAccountId: string;
  recipient: string;
  destinationClass: string;
  custodyAck: boolean;
  reauth: ExportReauthFn;
  actorScopeCodes?: string[];
  objectIds?: string[];
  asOfDate?: string;
  correlationId: string;
  /** When reauth fails, revoke managed link (fail-closed). Default true. */
  revokeOnReauthFailure?: boolean;
};

export type DownloadExportArtifactResult = {
  artifact: ExportArtifactRecord;
  contentBytes: Buffer;
  contentFilename: string;
  contentType: string;
  custodyBoundaryFa: string;
  retrievalId: string;
};

function assertArtifactDownloadable(artifact: ExportArtifactRecord): void {
  if (artifact.state === "revoked") {
    throw new ExportError("ARTIFACT_REVOKED", MSG_ARTIFACT_REVOKED_FA);
  }
  if (artifact.state === "disposed") {
    throw new ExportError("ARTIFACT_DISPOSED", MSG_ARTIFACT_DISPOSED_FA);
  }
  if (
    artifact.state === "expired" ||
    new Date(artifact.expiresAt).getTime() <= Date.now()
  ) {
    throw new ExportError("ARTIFACT_EXPIRED", MSG_ARTIFACT_EXPIRED_FA);
  }
  if (artifact.state !== "ready") {
    throw new ExportError("CONTENT_MISSING", MSG_CONTENT_MISSING_FA);
  }
}

function scopeSubjectIds(scope: JsonValue): string[] | undefined {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return undefined;
  }
  const raw = (scope as Record<string, JsonValue>).subjectIds;
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter((v): v is string => typeof v === "string");
  return ids.length > 0 ? ids : undefined;
}

function scopeAsOf(scope: JsonValue): string | undefined {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return undefined;
  }
  const raw = (scope as Record<string, JsonValue>).asOf;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export async function downloadExportArtifact(
  db: PgQueryable,
  input: DownloadExportArtifactInput,
): Promise<DownloadExportArtifactResult> {
  const loaded = await getExportArtifactWithBytes(db, input.artifactId);
  if (!loaded) {
    throw new ExportError("ARTIFACT_NOT_FOUND", MSG_ARTIFACT_NOT_FOUND_FA);
  }
  if (loaded.ownerAccountId !== input.retrieverAccountId) {
    throw new ExportError("ARTIFACT_NOT_FOUND", MSG_ARTIFACT_NOT_FOUND_FA);
  }

  // Lazy expiry mark — clear bytes so expired rows are not PII stores.
  if (
    loaded.state === "ready" &&
    new Date(loaded.expiresAt).getTime() <= Date.now()
  ) {
    await withPgTransaction(db, async (tx) => {
      await updateExportArtifactState(tx, loaded.id, "expired", {
        clearContent: true,
      });
      await insertLifecycleEvent(tx, {
        artifactId: loaded.id,
        eventKind: "expired",
        actorAccountId: input.retrieverAccountId,
        reason: "ttl",
        correlationId: input.correlationId,
      });
    });
    throw new ExportError("ARTIFACT_EXPIRED", MSG_ARTIFACT_EXPIRED_FA);
  }

  assertArtifactDownloadable(loaded);

  if (loaded.requiresCustodyAck && !input.custodyAck) {
    throw new ExportError("CUSTODY_ACK_REQUIRED", MSG_CUSTODY_ACK_REQUIRED_FA);
  }

  const objectIds = input.objectIds ?? scopeSubjectIds(loaded.scopeJson);
  const asOfDate = input.asOfDate ?? scopeAsOf(loaded.scopeJson);

  const reauth = await input.reauth({
    accountId: input.retrieverAccountId,
    populationChannel: "export",
    objectIds,
    actorScopeCodes: input.actorScopeCodes,
    asOfDate,
  });

  if (!reauth.allowed) {
    await withPgTransaction(db, async (tx) => {
      await insertRetrieval(tx, {
        artifactId: loaded.id,
        retrieverAccountId: input.retrieverAccountId,
        recipient: input.recipient,
        destinationClass: input.destinationClass,
        custodyAckAt: input.custodyAck ? new Date() : null,
        reauthReason: reauth.reason,
        reauthOutcome: "denied",
        correlationId: input.correlationId,
      });
      await insertLifecycleEvent(tx, {
        artifactId: loaded.id,
        eventKind: "download_denied",
        actorAccountId: input.retrieverAccountId,
        reason: reauth.reason,
        correlationId: input.correlationId,
      });
      await appendAccessEvent(tx, {
        correlationId: input.correlationId,
        actorAccountId: input.retrieverAccountId,
        operation: "export.artifact.download",
        scope: {
          channel: "export",
          purpose: loaded.purpose,
          artifactId: loaded.id,
          filtersSnapshot: loaded.filtersSnapshot,
          fieldIds: loaded.fieldIds,
        },
        result: "deny",
        reason: reauth.reason,
        entityType: "export_artifact",
        entityId: loaded.id,
        payload: { outcome: "reauth_denied" },
      });

      if (input.revokeOnReauthFailure !== false) {
        await updateExportArtifactState(tx, loaded.id, "revoked", {
          clearContent: true,
        });
        await insertLifecycleEvent(tx, {
          artifactId: loaded.id,
          eventKind: "revoked",
          actorAccountId: input.retrieverAccountId,
          reason: `reauth_fail:${reauth.reason}`,
          correlationId: input.correlationId,
        });
      }
    });

    throw new ExportError("REAUTH_FAILED", MSG_REAUTH_FAILED_FA, {
      reason: reauth.reason,
    });
  }

  if (!loaded.contentBytes || !loaded.contentFilename) {
    throw new ExportError("CONTENT_MISSING", MSG_CONTENT_MISSING_FA);
  }

  const { retrieval } = await withPgTransaction(db, async (tx) => {
    const row = await insertRetrieval(tx, {
      artifactId: loaded.id,
      retrieverAccountId: input.retrieverAccountId,
      recipient: input.recipient,
      destinationClass: input.destinationClass,
      custodyAckAt: input.custodyAck ? new Date() : null,
      reauthReason: reauth.reason,
      reauthOutcome: "allowed",
      correlationId: input.correlationId,
    });

    await appendAccessEvent(tx, {
      correlationId: input.correlationId,
      actorAccountId: input.retrieverAccountId,
      operation: "export.artifact.download",
      scope: {
        channel: "export",
        purpose: loaded.purpose,
        artifactId: loaded.id,
        recipient: input.recipient,
        destinationClass: input.destinationClass,
        volumeAuthorized: loaded.rowCount,
        fieldCount: loaded.fieldIds.length,
        fieldIds: loaded.fieldIds,
        filtersSnapshot: loaded.filtersSnapshot,
        classification: loaded.classification,
        handlingFa: loaded.handlingFa,
        custodyTransfer: true,
      },
      result: "allow",
      reason: reauth.reason,
      entityType: "export_artifact",
      entityId: loaded.id,
      payload: {
        outcome: "delivered",
        retrievalId: row.id,
        format: loaded.format,
      },
    });

    return { retrieval: row };
  });

  const contentType =
    loaded.format === "csv"
      ? "text/csv; charset=utf-8"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return {
    artifact: loaded,
    contentBytes: loaded.contentBytes,
    contentFilename: loaded.contentFilename,
    contentType,
    custodyBoundaryFa: CUSTODY_BOUNDARY_FA,
    retrievalId: retrieval.id,
  };
}

export async function revokeExportArtifact(
  db: PgQueryable,
  input: {
    artifactId: string;
    actorAccountId: string;
    reason?: string;
    correlationId: string;
  },
): Promise<ExportArtifactRecord> {
  const existing = await getExportArtifactById(db, input.artifactId);
  if (!existing) {
    throw new ExportError("ARTIFACT_NOT_FOUND", MSG_ARTIFACT_NOT_FOUND_FA);
  }
  if (existing.state === "disposed") {
    throw new ExportError("ARTIFACT_DISPOSED", MSG_ARTIFACT_DISPOSED_FA);
  }
  const updated = await withPgTransaction(db, async (tx) => {
    const next = await updateExportArtifactState(
      tx,
      input.artifactId,
      "revoked",
      { clearContent: true },
    );
    if (!next) {
      throw new ExportError("ARTIFACT_NOT_FOUND", MSG_ARTIFACT_NOT_FOUND_FA);
    }
    await insertLifecycleEvent(tx, {
      artifactId: input.artifactId,
      eventKind: "revoked",
      actorAccountId: input.actorAccountId,
      reason: input.reason ?? "manual_revoke",
      correlationId: input.correlationId,
    });
    await appendAccessEvent(tx, {
      correlationId: input.correlationId,
      actorAccountId: input.actorAccountId,
      operation: "export.artifact.revoke",
      scope: { channel: "export", artifactId: input.artifactId },
      result: "allow",
      reason: input.reason ?? "manual_revoke",
      entityType: "export_artifact",
      entityId: input.artifactId,
      payload: { outcome: "revoked" },
    });
    return next;
  });
  return updated;
}

export async function disposeExportArtifact(
  db: PgQueryable,
  input: {
    artifactId: string;
    actorAccountId: string;
    reason?: string;
    correlationId: string;
  },
): Promise<ExportArtifactRecord> {
  const existing = await getExportArtifactById(db, input.artifactId);
  if (!existing) {
    throw new ExportError("ARTIFACT_NOT_FOUND", MSG_ARTIFACT_NOT_FOUND_FA);
  }
  const updated = await withPgTransaction(db, async (tx) => {
    const next = await updateExportArtifactState(
      tx,
      input.artifactId,
      "disposed",
      { clearContent: true },
    );
    if (!next) {
      throw new ExportError("ARTIFACT_NOT_FOUND", MSG_ARTIFACT_NOT_FOUND_FA);
    }
    await insertLifecycleEvent(tx, {
      artifactId: input.artifactId,
      eventKind: "disposed",
      actorAccountId: input.actorAccountId,
      reason: input.reason ?? "dispose",
      correlationId: input.correlationId,
    });
    await appendAccessEvent(tx, {
      correlationId: input.correlationId,
      actorAccountId: input.actorAccountId,
      operation: "export.artifact.dispose",
      scope: { channel: "export", artifactId: input.artifactId },
      result: "allow",
      reason: input.reason ?? "dispose",
      entityType: "export_artifact",
      entityId: input.artifactId,
      payload: { outcome: "disposed" },
    });
    return next;
  });
  return updated;
}

export function panelDtoFromArtifact(
  artifact: ExportArtifactRecord,
  extras?: { omittedSensitiveIds?: string[]; custodyBoundaryFa?: string },
): {
  artifactId: string;
  classificationFa: string;
  handlingFa: string;
  expiresAt: string;
  fieldIds: string[];
  rowCount: number;
  format: ExportFormat;
  requiresCustodyAck: boolean;
  hasSensitiveFields: boolean;
  custodyBoundaryFa: string;
  omittedSensitiveIds: string[];
  sourceSurface: ExportSourceSurface;
  purpose: string;
} {
  return {
    artifactId: artifact.id,
    classificationFa: artifact.classificationFa,
    handlingFa: artifact.handlingFa,
    expiresAt: artifact.expiresAt,
    fieldIds: artifact.fieldIds,
    rowCount: artifact.rowCount,
    format: artifact.format,
    requiresCustodyAck: artifact.requiresCustodyAck,
    hasSensitiveFields: artifact.hasSensitiveFields,
    custodyBoundaryFa: extras?.custodyBoundaryFa ?? CUSTODY_BOUNDARY_FA,
    omittedSensitiveIds: extras?.omittedSensitiveIds ?? [],
    sourceSurface: artifact.sourceSurface,
    purpose: artifact.purpose,
  };
}

/** Test helper — build a correlation id without importing crypto at call sites. */
export function newExportCorrelationId(): string {
  return randomUUID();
}
