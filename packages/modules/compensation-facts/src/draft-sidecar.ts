/**
 * Sensitive draft sidecar for CompensationChanged monetary values (Story 4.8 / FR-24).
 * Values blocked by assertNoSensitiveEvidence live here keyed by draftId — never in
 * Draft/event payload. Production writers take+clear inside finalize AD-6 txn.
 */

import type { PrismaClient } from "@divan/db";

import { getCompensationDb } from "./db";
import { CompensationError } from "./errors";

export type DraftCompensationValues = {
  amount?: string | null;
  components?: unknown | null;
};

type Queryable = {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

function isPrisma(db: unknown): db is PrismaClient {
  return (
    typeof db === "object" &&
    db !== null &&
    "$executeRawUnsafe" in db &&
    typeof (db as PrismaClient).$executeRawUnsafe === "function"
  );
}

/**
 * Ensure sidecar table exists (idempotent). Call from seed / selfcheck bootstrap.
 */
export async function ensureCompensationDraftSidecarSchema(
  db: Queryable | PrismaClient = getCompensationDb(),
): Promise<void> {
  const ddl = `
    CREATE SCHEMA IF NOT EXISTS compensation;
    CREATE TABLE IF NOT EXISTS compensation.draft_sensitive_values (
      draft_id    UUID PRIMARY KEY,
      values_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;
  if (isPrisma(db)) {
    await db.$executeRawUnsafe(ddl);
    return;
  }
  await db.query(ddl);
}

function normalizeValues(
  values: DraftCompensationValues,
): DraftCompensationValues {
  const out: DraftCompensationValues = {};
  if (values.amount !== undefined) {
    out.amount =
      values.amount === null || values.amount === ""
        ? null
        : String(values.amount).trim();
  }
  if (values.components !== undefined) {
    out.components = values.components;
  }
  return out;
}

export async function putDraftCompensationValues(
  draftId: string,
  values: DraftCompensationValues,
  db: PrismaClient = getCompensationDb(),
): Promise<void> {
  const id = draftId.trim();
  if (!id) {
    throw new CompensationError(
      "VALIDATION",
      "شناسه پیش‌نویس برای مقادیر حساس الزامی است.",
      "missing_draft_id",
    );
  }
  await ensureCompensationDraftSidecarSchema(db);
  const payload = JSON.stringify(normalizeValues(values));
  await db.$executeRawUnsafe(
    `INSERT INTO compensation.draft_sensitive_values (draft_id, values_json, updated_at)
     VALUES ($1::uuid, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (draft_id) DO UPDATE
       SET values_json = EXCLUDED.values_json,
           updated_at = CURRENT_TIMESTAMP`,
    id,
    payload,
  );
}

export async function peekDraftCompensationValues(
  draftId: string,
  db: PrismaClient = getCompensationDb(),
): Promise<DraftCompensationValues | null> {
  const id = draftId.trim();
  if (!id) return null;
  await ensureCompensationDraftSidecarSchema(db);
  const rows = await db.$queryRawUnsafe<Array<{ values_json: unknown }>>(
    `SELECT values_json FROM compensation.draft_sensitive_values
     WHERE draft_id = $1::uuid`,
    id,
  );
  const row = rows[0];
  if (!row) return null;
  const raw = row.values_json;
  if (raw == null || typeof raw !== "object") return {};
  return normalizeValues(raw as DraftCompensationValues);
}

/** Read and delete sidecar values (finalize AD-6 path). */
export async function takeDraftCompensationValues(
  draftId: string,
  db: PrismaClient = getCompensationDb(),
): Promise<DraftCompensationValues | null> {
  const id = draftId.trim();
  if (!id) return null;
  await ensureCompensationDraftSidecarSchema(db);
  const rows = await db.$queryRawUnsafe<Array<{ values_json: unknown }>>(
    `DELETE FROM compensation.draft_sensitive_values
     WHERE draft_id = $1::uuid
     RETURNING values_json`,
    id,
  );
  const row = rows[0];
  if (!row) return null;
  const raw = row.values_json;
  if (raw == null || typeof raw !== "object") return {};
  return normalizeValues(raw as DraftCompensationValues);
}

export async function clearDraftCompensationValues(
  draftId: string,
  db: PrismaClient = getCompensationDb(),
): Promise<void> {
  const id = draftId.trim();
  if (!id) return;
  await ensureCompensationDraftSidecarSchema(db);
  await db.$executeRawUnsafe(
    `DELETE FROM compensation.draft_sensitive_values WHERE draft_id = $1::uuid`,
    id,
  );
}

/** Best-effort restore after compensate (post-hook failure). */
export async function restoreDraftCompensationValues(
  draftId: string,
  values: DraftCompensationValues,
  db: PrismaClient = getCompensationDb(),
): Promise<void> {
  await putDraftCompensationValues(draftId, values, db);
}
