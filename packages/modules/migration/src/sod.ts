/**
 * Provisional SoD gates for import approve vs execute (Story 6.2).
 *
 * AR-MIGRATION / AR-ACCESS are pending freeze — these permission strings are
 * code-marked provisional and fail-closed when absent from PermissionSet.
 * Do not treat this matrix as signed production policy.
 *
 * Choice (Dev Agent Record):
 * - Upload/confirm remains `person.write` (Story 6.1).
 * - Approve requires provisional `migration.approve`.
 * - Execute requires provisional `migration.execute`.
 * - Default segregation mode rejects same actor approve+execute on one batch.
 */

import { MigrationError } from "./errors";

/** @provisional-pending-AR-MIGRATION-freeze */
export const MIGRATION_APPROVE_PERMISSION = "migration.approve";

/** @provisional-pending-AR-MIGRATION-freeze */
export const MIGRATION_EXECUTE_PERMISSION = "migration.execute";

export const MSG_SOD_APPROVE_REQUIRED_FA =
  "مجوز تأیید دسته واردسازی را ندارید.";

export const MSG_SOD_EXECUTE_REQUIRED_FA =
  "مجوز اجرای دسته واردسازی را ندارید.";

export const MSG_SOD_SAME_ACTOR_FA =
  "همان کاربر نمی‌تواند هم تأیید و هم اجرای یک دسته حساس را انجام دهد.";

export const MSG_SOD_UPLOAD_APPROVE_FA =
  "همان کاربر نمی‌تواند هم بارگذاری و هم تأیید یک دسته حساس را انجام دهد.";

export type SodPermissionHolder = {
  /** True when actor's PermissionSet includes the permission. */
  holds: (permission: string) => boolean | Promise<boolean>;
};

export async function assertMigrationApprovePermission(
  holder: SodPermissionHolder,
): Promise<void> {
  const ok = await holder.holds(MIGRATION_APPROVE_PERMISSION);
  if (!ok) {
    throw new MigrationError("SOD_VIOLATION", MSG_SOD_APPROVE_REQUIRED_FA);
  }
}

export async function assertMigrationExecutePermission(
  holder: SodPermissionHolder,
): Promise<void> {
  const ok = await holder.holds(MIGRATION_EXECUTE_PERMISSION);
  if (!ok) {
    throw new MigrationError("SOD_VIOLATION", MSG_SOD_EXECUTE_REQUIRED_FA);
  }
}

/**
 * Segregation of duties: approver ≠ executor when mode is on (default).
 */
export function assertApproveExecuteSegregation(opts: {
  approvedByAccountId: string;
  executorAccountId: string;
  /** Default true for production-sensitive path. */
  segregationOn?: boolean;
}): void {
  const on = opts.segregationOn !== false;
  if (!on) return;
  if (opts.approvedByAccountId === opts.executorAccountId) {
    throw new MigrationError("SOD_VIOLATION", MSG_SOD_SAME_ACTOR_FA);
  }
}

/**
 * Segregation of duties: uploader ≠ approver when mode is on (default).
 * AC #1 — upload / approval / execution duties separated.
 */
export function assertUploadApproveSegregation(opts: {
  uploadedByAccountId: string;
  approverAccountId: string;
  /** Default true for production-sensitive path. */
  segregationOn?: boolean;
}): void {
  const on = opts.segregationOn !== false;
  if (!on) return;
  if (opts.uploadedByAccountId === opts.approverAccountId) {
    throw new MigrationError("SOD_VIOLATION", MSG_SOD_UPLOAD_APPROVE_FA);
  }
}
