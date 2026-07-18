/**
 * PermissionSet binding gate for Person + Organization APIs (Stories 3.1 / 3.5).
 * Envelope policy is 4-tuple only — assigned PermissionSet unlocks the API.
 */

import { COMPENSATION_READ_PERMISSION } from "@divan/compensation-facts";
import type { PrismaClient } from "@divan/db";

import { getPersonDb } from "./db";
import {
  JOB_REFERENCE_READ_PERMISSION,
  JOB_REFERENCE_WRITE_PERMISSION,
  JobRefError,
  MSG_JOB_REF_PERMISSION_REQUIRED_FA,
  MSG_ORG_PERMISSION_REQUIRED_FA,
  MSG_PERSONNEL_EVENT_PERMISSION_REQUIRED_FA,
  MSG_COMPENSATION_WRITE_REQUIRED_FA,
  ORGANIZATION_READ_PERMISSION,
  ORGANIZATION_WRITE_PERMISSION,
  OrgUnitError,
  PERSON_READ_PERMISSION,
  PERSON_WRITE_PERMISSION,
  PERSONNEL_EVENT_DRAFT_PERMISSION,
  PERSONNEL_EVENT_FINALIZE_PERMISSION,
  PERSONNEL_EVENT_CANCEL_PERMISSION,
  PERSONNEL_EVENT_REVERSE_PERMISSION,
  PERSONNEL_EVENT_CORRECT_PERMISSION,
  COMPENSATION_WRITE_PERMISSION,
  PersonIdentityError,
  PersonnelEventError,
} from "./errors";

export const MSG_PERSON_PERMISSION_REQUIRED_FA = "دسترسی ندارید.";

async function actorHoldsPermission(
  accountId: string,
  permission: string,
  db: PrismaClient,
): Promise<boolean> {
  const rows = await db.accountAccessRole.findMany({
    where: { accountId },
    include: {
      accessRole: { include: { permissionSet: true } },
    },
  });
  return rows.some((row) =>
    (row.accessRole.permissionSet?.permissions ?? []).includes(permission),
  );
}

export async function assertActorHasPersonRead(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    PERSON_READ_PERMISSION,
    db,
  );
  if (!has) {
    throw new PersonIdentityError(
      "PERMISSION_DENIED",
      MSG_PERSON_PERMISSION_REQUIRED_FA,
      "person_read_required",
    );
  }
}

export async function assertActorHasPersonWrite(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    PERSON_WRITE_PERMISSION,
    db,
  );
  if (!has) {
    throw new PersonIdentityError(
      "PERMISSION_DENIED",
      MSG_PERSON_PERMISSION_REQUIRED_FA,
      "person_write_required",
    );
  }
}

export async function assertActorHasOrganizationRead(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    ORGANIZATION_READ_PERMISSION,
    db,
  );
  if (!has) {
    throw new OrgUnitError(
      "PERMISSION_DENIED",
      MSG_ORG_PERMISSION_REQUIRED_FA,
      "organization_read_required",
    );
  }
}

export async function assertActorHasOrganizationWrite(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    ORGANIZATION_WRITE_PERMISSION,
    db,
  );
  if (!has) {
    throw new OrgUnitError(
      "PERMISSION_DENIED",
      MSG_ORG_PERMISSION_REQUIRED_FA,
      "organization_write_required",
    );
  }
}

export async function assertActorHasJobReferenceRead(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    JOB_REFERENCE_READ_PERMISSION,
    db,
  );
  if (!has) {
    throw new JobRefError(
      "PERMISSION_DENIED",
      MSG_JOB_REF_PERMISSION_REQUIRED_FA,
      "job_reference_read_required",
    );
  }
}

export async function assertActorHasJobReferenceWrite(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    JOB_REFERENCE_WRITE_PERMISSION,
    db,
  );
  if (!has) {
    throw new JobRefError(
      "PERMISSION_DENIED",
      MSG_JOB_REF_PERMISSION_REQUIRED_FA,
      "job_reference_write_required",
    );
  }
}

export async function assertActorHasPersonnelEventDraft(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    PERSONNEL_EVENT_DRAFT_PERMISSION,
    db,
  );
  if (!has) {
    throw new PersonnelEventError(
      "PERMISSION_DENIED",
      MSG_PERSONNEL_EVENT_PERMISSION_REQUIRED_FA,
      "personnel_event_draft_required",
    );
  }
}

export async function assertActorHasPersonnelEventFinalize(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    PERSONNEL_EVENT_FINALIZE_PERMISSION,
    db,
  );
  if (!has) {
    throw new PersonnelEventError(
      "PERMISSION_DENIED",
      MSG_PERSONNEL_EVENT_PERMISSION_REQUIRED_FA,
      "personnel_event_finalize_required",
    );
  }
}

export async function assertActorHasPersonnelEventCancel(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    PERSONNEL_EVENT_CANCEL_PERMISSION,
    db,
  );
  if (!has) {
    throw new PersonnelEventError(
      "PERMISSION_DENIED",
      MSG_PERSONNEL_EVENT_PERMISSION_REQUIRED_FA,
      "personnel_event_cancel_required",
    );
  }
}

export async function assertActorHasPersonnelEventReverse(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    PERSONNEL_EVENT_REVERSE_PERMISSION,
    db,
  );
  if (!has) {
    throw new PersonnelEventError(
      "PERMISSION_DENIED",
      MSG_PERSONNEL_EVENT_PERMISSION_REQUIRED_FA,
      "personnel_event_reverse_required",
    );
  }
}

export async function assertActorHasPersonnelEventCorrect(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    PERSONNEL_EVENT_CORRECT_PERMISSION,
    db,
  );
  if (!has) {
    throw new PersonnelEventError(
      "PERMISSION_DENIED",
      MSG_PERSONNEL_EVENT_PERMISSION_REQUIRED_FA,
      "personnel_event_correct_required",
    );
  }
}

export async function assertActorHasCompensationWrite(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    COMPENSATION_WRITE_PERMISSION,
    db,
  );
  if (!has) {
    throw new PersonnelEventError(
      "PERMISSION_DENIED",
      MSG_COMPENSATION_WRITE_REQUIRED_FA,
      "compensation_write_required",
    );
  }
}

/** Non-throwing — Story 4.9 current-state omits compensation block when false. */
export async function actorHasCompensationRead(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<boolean> {
  return actorHoldsPermission(accountId, COMPENSATION_READ_PERMISSION, db);
}

/** Non-throwing caps for UI gating (server still enforces on mutate). */
export async function getPersonnelEventLifecycleCaps(
  accountId: string,
  db: PrismaClient = getPersonDb(),
): Promise<{ cancel: boolean; reverse: boolean; correct: boolean }> {
  const [cancel, reverse, correct] = await Promise.all([
    actorHoldsPermission(accountId, PERSONNEL_EVENT_CANCEL_PERMISSION, db),
    actorHoldsPermission(accountId, PERSONNEL_EVENT_REVERSE_PERMISSION, db),
    actorHoldsPermission(accountId, PERSONNEL_EVENT_CORRECT_PERMISSION, db),
  ]);
  return { cancel, reverse, correct };
}
