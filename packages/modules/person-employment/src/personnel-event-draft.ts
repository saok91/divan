/**
 * Mutable Draft working store (Story 4.2 / FR-15).
 * Non-authoritative — never mutates kernel_events or projections on save.
 */

import { assertNoSensitiveEvidence, BusinessEventValidationError } from "@divan/event-store";
import { parseDateOnly } from "@divan/temporal-engine";
import type { Prisma, PrismaClient } from "@divan/db";

import { getPersonDb } from "./db";
import {
  MSG_DRAFT_ALREADY_FINALIZED_FA,
  MSG_DRAFT_DELETED_FA,
  MSG_DRAFT_NOT_EDITABLE_FA,
  MSG_DRAFT_NOT_FOUND_FA,
  MSG_DRAFT_VERSION_CONFLICT_FA,
  MSG_INVALID_DRAFT_EFFECTIVE_DATE_FA,
  MSG_PERSON_NOT_FOUND_FA,
  MSG_REQUIRED_FIELD_FA,
  MSG_SENSITIVE_DRAFT_PAYLOAD_FA,
  PersonnelEventError,
} from "./errors";
import { requireNonEmpty as requireNonEmptyBase } from "./normalize";
import { dateOnlyFromDb } from "./personnel-event-conflicts";

function requireNonEmpty(value: string | null | undefined, field: string): string {
  return requireNonEmptyBase(value, `${MSG_REQUIRED_FIELD_FA} (${field})`);
}

const EVENT_TYPE_PASCAL_RE = /^[A-Z][A-Za-z0-9]*$/;

export type DraftStatus =
  | "open"
  | "finalized"
  | "deleted"
  | "pending_review";

export type PersonnelEventDraftRecord = {
  id: string;
  personId: string;
  employmentId: string | null;
  eventType: string;
  effectiveDate: string;
  payload: Record<string, unknown>;
  status: DraftStatus;
  version: number;
  createdBy: string;
  updatedBy: string;
  finalizedEventId: string | null;
  idempotencyKey: string | null;
  warningAcks: unknown;
  overrideEvidence: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateDraftInput = {
  personId: string;
  employmentId?: string | null;
  eventType: string;
  effectiveDate: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
};

export type UpdateDraftInput = {
  draftId: string;
  expectedVersion: number;
  employmentId?: string | null;
  eventType?: string;
  effectiveDate?: string;
  payload?: Record<string, unknown>;
};

function dateOnlyToDb(dateOnly: string): Date {
  // Noon UTC — avoids PG DATE session-TZ off-by-one for Asia/Tehran midnights.
  return new Date(`${dateOnly}T12:00:00.000Z`);
}

function asPayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapDraft(row: {
  id: string;
  personId: string;
  employmentId: string | null;
  eventType: string;
  effectiveDate: Date;
  payload: unknown;
  status: string;
  version: number;
  createdBy: string;
  updatedBy: string;
  finalizedEventId: string | null;
  idempotencyKey: string | null;
  warningAcks: unknown;
  overrideEvidence: unknown;
  createdAt: Date;
  updatedAt: Date;
}): PersonnelEventDraftRecord {
  return {
    id: row.id,
    personId: row.personId,
    employmentId: row.employmentId,
    eventType: row.eventType,
    effectiveDate: dateOnlyFromDb(row.effectiveDate),
    payload: asPayload(row.payload),
    status: row.status as DraftStatus,
    version: row.version,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    finalizedEventId: row.finalizedEventId,
    idempotencyKey: row.idempotencyKey,
    warningAcks: row.warningAcks,
    overrideEvidence: row.overrideEvidence,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertValidEventType(eventType: string): string {
  const trimmed = requireNonEmpty(eventType, "eventType");
  if (!EVENT_TYPE_PASCAL_RE.test(trimmed)) {
    throw new PersonnelEventError(
      "VALIDATION",
      "نوع رویداد نامعتبر است. باید PascalCase باشد (مثلاً ScaffoldChangeRecorded).",
      "invalid_event_type",
    );
  }
  return trimmed;
}

function assertValidEffectiveDate(raw: string): string {
  const parsed = parseDateOnly(raw);
  if (!parsed.ok) {
    throw new PersonnelEventError(
      "INVALID_EFFECTIVE_DATE",
      MSG_INVALID_DRAFT_EFFECTIVE_DATE_FA,
      parsed.reason,
    );
  }
  return parsed.value;
}

function assertSafePayload(payload: Record<string, unknown>): void {
  try {
    assertNoSensitiveEvidence("draft.payload", payload);
  } catch (err) {
    if (err instanceof BusinessEventValidationError) {
      throw new PersonnelEventError(
        "SENSITIVE_PAYLOAD",
        MSG_SENSITIVE_DRAFT_PAYLOAD_FA,
        err.code,
      );
    }
    throw err;
  }
}

function assertPlainPayload(payload: unknown): Record<string, unknown> {
  if (payload == null) return {};
  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new PersonnelEventError(
      "VALIDATION",
      "بارِ پیش‌نویس باید یک شیء ساده باشد.",
      "invalid_payload_shape",
    );
  }
  return payload as Record<string, unknown>;
}

function assertEditable(draft: PersonnelEventDraftRecord): void {
  if (draft.status === "deleted") {
    throw new PersonnelEventError("DRAFT_DELETED", MSG_DRAFT_DELETED_FA);
  }
  if (draft.status === "finalized") {
    throw new PersonnelEventError(
      "DRAFT_ALREADY_FINALIZED",
      MSG_DRAFT_ALREADY_FINALIZED_FA,
    );
  }
  if (draft.status !== "open" && draft.status !== "pending_review") {
    throw new PersonnelEventError(
      "DRAFT_NOT_EDITABLE",
      MSG_DRAFT_NOT_EDITABLE_FA,
    );
  }
}

/** Public guard for sidecar / other draft-adjacent writers. */
export function assertDraftEditable(draft: PersonnelEventDraftRecord): void {
  assertEditable(draft);
}

export async function createDraft(
  input: CreateDraftInput,
  actor: { accountId: string },
  db: PrismaClient = getPersonDb(),
): Promise<PersonnelEventDraftRecord> {
  const personId = requireNonEmpty(input.personId, "personId");
  const person = await db.person.findUnique({ where: { id: personId } });
  if (!person) {
    throw new PersonnelEventError("PERSON_NOT_FOUND", MSG_PERSON_NOT_FOUND_FA);
  }

  const eventType = assertValidEventType(input.eventType);
  const effectiveDate = assertValidEffectiveDate(input.effectiveDate);
  const payload = assertPlainPayload(input.payload);
  assertSafePayload(payload);

  if (input.employmentId?.trim()) {
    const emp = await db.employment.findUnique({
      where: { id: input.employmentId.trim() },
    });
    if (!emp || emp.personId !== personId) {
      throw new PersonnelEventError(
        "EMPLOYMENT_NOT_FOUND",
        "سابقه همکاری یافت نشد یا به این فرد تعلق ندارد.",
      );
    }
  }

  const actorId = requireNonEmpty(actor.accountId, "accountId");
  const row = await db.personnelEventDraft.create({
    data: {
      personId,
      employmentId: input.employmentId?.trim() || null,
      eventType,
      effectiveDate: dateOnlyToDb(effectiveDate),
      payload: payload as Prisma.InputJsonValue,
      status: "open",
      version: 1,
      createdBy: actorId,
      updatedBy: actorId,
      idempotencyKey: input.idempotencyKey?.trim() || null,
    },
  });
  return mapDraft(row);
}

export async function getDraft(
  draftId: string,
  db: PrismaClient = getPersonDb(),
): Promise<PersonnelEventDraftRecord> {
  const id = requireNonEmpty(draftId, "draftId");
  const row = await db.personnelEventDraft.findUnique({ where: { id } });
  if (!row) {
    throw new PersonnelEventError("DRAFT_NOT_FOUND", MSG_DRAFT_NOT_FOUND_FA);
  }
  return mapDraft(row);
}

export async function updateDraft(
  input: UpdateDraftInput,
  actor: { accountId: string },
  db: PrismaClient = getPersonDb(),
): Promise<PersonnelEventDraftRecord> {
  const existing = await getDraft(input.draftId, db);
  assertEditable(existing);

  if (existing.version !== input.expectedVersion) {
    throw new PersonnelEventError(
      "DRAFT_VERSION_CONFLICT",
      MSG_DRAFT_VERSION_CONFLICT_FA,
    );
  }

  const eventType =
    input.eventType !== undefined
      ? assertValidEventType(input.eventType)
      : existing.eventType;
  const effectiveDate =
    input.effectiveDate !== undefined
      ? assertValidEffectiveDate(input.effectiveDate)
      : existing.effectiveDate;
  const payload =
    input.payload !== undefined
      ? assertPlainPayload(input.payload)
      : existing.payload;
  assertSafePayload(payload);

  const employmentId =
    input.employmentId !== undefined
      ? input.employmentId?.trim() || null
      : existing.employmentId;

  if (employmentId) {
    const emp = await db.employment.findUnique({ where: { id: employmentId } });
    if (!emp || emp.personId !== existing.personId) {
      throw new PersonnelEventError(
        "EMPLOYMENT_NOT_FOUND",
        "سابقه همکاری یافت نشد یا به این فرد تعلق ندارد.",
      );
    }
  }

  const updated = await db.personnelEventDraft.updateMany({
    where: {
      id: existing.id,
      version: input.expectedVersion,
      status: { in: ["open", "pending_review"] },
    },
    data: {
      employmentId,
      eventType,
      effectiveDate: dateOnlyToDb(effectiveDate),
      payload: payload as Prisma.InputJsonValue,
      updatedBy: requireNonEmpty(actor.accountId, "accountId"),
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new PersonnelEventError(
      "DRAFT_VERSION_CONFLICT",
      MSG_DRAFT_VERSION_CONFLICT_FA,
    );
  }

  return getDraft(existing.id, db);
}

export async function deleteDraft(
  draftId: string,
  expectedVersion: number,
  actor: { accountId: string },
  db: PrismaClient = getPersonDb(),
): Promise<PersonnelEventDraftRecord> {
  const existing = await getDraft(draftId, db);
  assertEditable(existing);

  if (existing.version !== expectedVersion) {
    throw new PersonnelEventError(
      "DRAFT_VERSION_CONFLICT",
      MSG_DRAFT_VERSION_CONFLICT_FA,
    );
  }

  const updated = await db.personnelEventDraft.updateMany({
    where: {
      id: existing.id,
      version: expectedVersion,
      status: { in: ["open", "pending_review"] },
    },
    data: {
      status: "deleted",
      updatedBy: requireNonEmpty(actor.accountId, "accountId"),
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    // Race: may have been finalized or soft-deleted concurrently
    const again = await getDraft(draftId, db);
    if (again.status === "finalized") {
      throw new PersonnelEventError(
        "DRAFT_ALREADY_FINALIZED",
        MSG_DRAFT_ALREADY_FINALIZED_FA,
      );
    }
    if (again.status === "deleted") {
      throw new PersonnelEventError("DRAFT_DELETED", MSG_DRAFT_DELETED_FA);
    }
    throw new PersonnelEventError(
      "DRAFT_VERSION_CONFLICT",
      MSG_DRAFT_VERSION_CONFLICT_FA,
    );
  }

  return getDraft(existing.id, db);
}

export async function listOpenDraftsForPerson(
  personId: string,
  db: PrismaClient = getPersonDb(),
): Promise<PersonnelEventDraftRecord[]> {
  const rows = await db.personnelEventDraft.findMany({
    where: {
      personId: requireNonEmpty(personId, "personId"),
      status: { in: ["open", "pending_review"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapDraft);
}
