import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@divan/db";

import { getIdentityDb } from "./db";
import type { CoarseRole } from "./types";

export type RecordAccessDenialInput = {
  accountId: string;
  coarseRole: CoarseRole;
  path: string;
  /** Optional correlation id; generated when omitted (FR42 substrate). */
  correlationId?: string;
};

export type RecordAccessDenialResult = {
  correlationId: string;
};

/**
 * FR42 attribution substrate for deep-link denials (Epic 1).
 * Not the full audit-envelope kernel (Story 2.1).
 */
export async function recordAccessDenial(
  input: RecordAccessDenialInput,
  db: PrismaClient = getIdentityDb(),
): Promise<RecordAccessDenialResult> {
  const correlationId = input.correlationId?.trim() || randomUUID();

  try {
    await db.accessDenial.create({
      data: {
        correlationId,
        accountId: input.accountId,
        coarseRole: input.coarseRole,
        path: input.path,
        outcome: "denied",
      },
    });
  } catch (err) {
    // Attribution must not block the denial UI (best-effort substrate).
    console.error("[identity-access] accessDenial record failed", err);
  }

  return { correlationId };
}
