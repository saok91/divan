/**
 * PermissionSet binding gate for Person APIs (Story 3.1).
 * Envelope policy is 4-tuple only — assigned PermissionSet unlocks the API.
 */

import type { PrismaClient } from "@divan/db";

import { getPersonDb } from "./db";
import {
  PERSON_READ_PERMISSION,
  PERSON_WRITE_PERMISSION,
  PersonIdentityError,
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
