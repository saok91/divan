/**
 * Approval-first capacity matching (Story 4.13 / FR-29).
 * Team + Job Title + optional Seniority; oldest valid compatible Approval.
 * Grade / Ladder / compensation MUST NOT filter Approval-backed candidates.
 */

import type { Pool, PoolClient } from "@divan/db";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  HeadcountApprovalError,
  isApprovalConsumableAt,
  type HeadcountApprovalStatus,
} from "./headcount-approval";

export const MSG_HEADCOUNT_MANUAL_APPROVAL_INCOMPATIBLE_FA =
  "مجوز ظرفیت انتخاب‌شده با ابعاد انتصاب سازگار نیست یا قابل مصرف نیست.";

export const MSG_HEADCOUNT_NO_COMPATIBLE_APPROVAL_FA =
  "مجوز ظرفیت سازگار برای این انتصاب یافت نشد؛ بدون معافیت یا Override نهایی‌سازی مجاز نیست.";

export type MatchApprovalInput = {
  teamId: string;
  jobTitleId: string;
  seniorityId?: string | null;
  evaluationDate: string;
  /** Manual reselection — must still be compatible + consumable. */
  preferredApprovalId?: string | null;
};

export type CompatibleApprovalCandidate = {
  approvalId: string;
  slotId: string;
  validityStart: string;
  createdAt: Date;
  seniorityId: string | null;
  freeUnits: number;
};

export type MatchApprovalResult =
  | {
      outcome: "matched";
      approvalId: string;
      slotId: string;
      matchedBy: "default" | "manual";
      candidates: CompatibleApprovalCandidate[];
    }
  | {
      outcome: "none";
      candidates: CompatibleApprovalCandidate[];
      messageFa: string;
    }
  | {
      outcome: "manual_incompatible";
      candidates: CompatibleApprovalCandidate[];
      messageFa: string;
    };

type Queryable = Pool | PoolClient;

type CandidateRow = {
  approval_id: string;
  slot_id: string;
  status: string;
  validity_start: Date | string;
  validity_end_exclusive: Date | string;
  created_at: Date;
  seniority_id: string | null;
  free_units: number;
};

async function query<T extends Record<string, unknown>>(
  db: Queryable,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r = await db.query(sql, params);
  return r.rows as T[];
}

function dateOnlyFromPg(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Seniority compatibility (product default):
 * - Approval.seniority_id IS NULL → matches any Assignment seniority (including null)
 * - Approval.seniority_id IS NOT NULL → matches only when Assignment.seniority_id equals it
 */
export function seniorityCompatible(
  approvalSeniorityId: string | null,
  assignmentSeniorityId: string | null | undefined,
): boolean {
  if (approvalSeniorityId == null) return true;
  return approvalSeniorityId === (assignmentSeniorityId ?? null);
}

export type ListCandidatesOptions = {
  /**
   * When false, include slots with free_units <= 0 (Override shortage path).
   * Default true — Operators cannot overbook via normal match.
   */
  requireFree?: boolean;
  /**
   * When true, skip consumable-at gate (validity Override path only).
   * Still returns dimension-matched Approvals ordered oldest-first.
   */
  skipConsumableGate?: boolean;
};

/**
 * List consumable Approvals for Team+Title with free capacity on linked slot,
 * filtered by seniority rule, ordered oldest-first.
 */
export async function listCompatibleApprovalCandidates(
  db: Queryable,
  input: Omit<MatchApprovalInput, "preferredApprovalId">,
  opts: ListCandidatesOptions = {},
): Promise<CompatibleApprovalCandidate[]> {
  const today = todayDateOnlyTehran();
  const requireFree = opts.requireFree !== false;
  const freeClause = requireFree ? "AND s.free_units > 0" : "";
  const rows = await query<CandidateRow>(
    db,
    `SELECT a.id AS approval_id,
            s.id AS slot_id,
            a.status,
            a.validity_start,
            a.validity_end_exclusive,
            a.created_at,
            a.seniority_id,
            s.free_units
     FROM headcount_approval a
     INNER JOIN headcount_capacity_slot s ON s.approval_id = a.id
     WHERE a.team_id = $1::uuid
       AND a.job_title_id = $2::uuid
       ${freeClause}
       AND s.start_date <= $3::date
       AND (s.end_date_exclusive IS NULL OR s.end_date_exclusive > $3::date)
     ORDER BY a.validity_start ASC, a.created_at ASC, a.id ASC`,
    [input.teamId, input.jobTitleId, input.evaluationDate],
  );

  const out: CompatibleApprovalCandidate[] = [];
  for (const row of rows) {
    const validityStart = dateOnlyFromPg(row.validity_start);
    const validityEnd = dateOnlyFromPg(row.validity_end_exclusive);
    if (!opts.skipConsumableGate) {
      if (
        !isApprovalConsumableAt(
          row.status as HeadcountApprovalStatus,
          validityStart,
          validityEnd,
          input.evaluationDate,
          today,
        )
      ) {
        continue;
      }
    }
    if (!seniorityCompatible(row.seniority_id, input.seniorityId)) {
      continue;
    }
    out.push({
      approvalId: row.approval_id,
      slotId: row.slot_id,
      validityStart,
      createdAt: row.created_at,
      seniorityId: row.seniority_id,
      freeUnits: Number(row.free_units),
    });
  }
  return out;
}

/**
 * Match for Override finalize — dimension-compatible even when free <= 0.
 */
export async function matchApprovalsForOverride(
  db: Queryable,
  input: MatchApprovalInput,
  opts: { skipConsumableGate?: boolean } = {},
): Promise<MatchApprovalResult> {
  const candidates = await listCompatibleApprovalCandidates(db, input, {
    requireFree: false,
    skipConsumableGate: opts.skipConsumableGate,
  });
  const preferred = input.preferredApprovalId?.trim() || null;

  if (preferred) {
    const hit = candidates.find((c) => c.approvalId === preferred);
    if (!hit) {
      return {
        outcome: "manual_incompatible",
        candidates,
        messageFa: MSG_HEADCOUNT_MANUAL_APPROVAL_INCOMPATIBLE_FA,
      };
    }
    return {
      outcome: "matched",
      approvalId: hit.approvalId,
      slotId: hit.slotId,
      matchedBy: "manual",
      candidates,
    };
  }

  const oldest = candidates[0];
  if (!oldest) {
    return {
      outcome: "none",
      candidates,
      messageFa: MSG_HEADCOUNT_NO_COMPATIBLE_APPROVAL_FA,
    };
  }
  return {
    outcome: "matched",
    approvalId: oldest.approvalId,
    slotId: oldest.slotId,
    matchedBy: "default",
    candidates,
  };
}

/**
 * Match oldest compatible Approval, or enforce preferredApprovalId when set.
 */
export async function matchCompatibleApprovals(
  db: Queryable,
  input: MatchApprovalInput,
): Promise<MatchApprovalResult> {
  const candidates = await listCompatibleApprovalCandidates(db, input);
  const preferred = input.preferredApprovalId?.trim() || null;

  if (preferred) {
    const hit = candidates.find((c) => c.approvalId === preferred);
    if (!hit) {
      return {
        outcome: "manual_incompatible",
        candidates,
        messageFa: MSG_HEADCOUNT_MANUAL_APPROVAL_INCOMPATIBLE_FA,
      };
    }
    return {
      outcome: "matched",
      approvalId: hit.approvalId,
      slotId: hit.slotId,
      matchedBy: "manual",
      candidates,
    };
  }

  const oldest = candidates[0];
  if (!oldest) {
    return {
      outcome: "none",
      candidates,
      messageFa: MSG_HEADCOUNT_NO_COMPATIBLE_APPROVAL_FA,
    };
  }
  return {
    outcome: "matched",
    approvalId: oldest.approvalId,
    slotId: oldest.slotId,
    matchedBy: "default",
    candidates,
  };
}

/**
 * Record audited manual Approval reselection (domain helper for finalize).
 * Throws HeadcountApprovalError when preferred is incompatible.
 */
export async function assertPreferredApprovalCompatible(
  db: Queryable,
  input: MatchApprovalInput & { preferredApprovalId: string },
): Promise<CompatibleApprovalCandidate> {
  const result = await matchCompatibleApprovals(db, input);
  if (result.outcome !== "matched" || result.matchedBy !== "manual") {
    throw new HeadcountApprovalError(
      "VALIDATION",
      MSG_HEADCOUNT_MANUAL_APPROVAL_INCOMPATIBLE_FA,
      "manual_approval_incompatible",
    );
  }
  const hit = result.candidates.find((c) => c.approvalId === result.approvalId);
  if (!hit) {
    throw new HeadcountApprovalError(
      "VALIDATION",
      MSG_HEADCOUNT_MANUAL_APPROVAL_INCOMPATIBLE_FA,
      "manual_approval_missing",
    );
  }
  return hit;
}
