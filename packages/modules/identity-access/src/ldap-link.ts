import type { PrismaClient } from "@divan/db";

import type { LdapConfig } from "./config";
import type { DirectoryVerifyOk } from "./ldap-client";
import { COARSE_ROLES, type CoarseRole } from "./types";

export type LinkAccountOk = {
  kind: "ok";
  accountId: string;
  username: string;
  displayName: string;
  coarseRole: CoarseRole;
  humanIdentityId: string;
};

export type LinkAccountResult =
  | LinkAccountOk
  | { kind: "inactive" }
  | { kind: "unmapped" }
  | { kind: "conflict" }
  | { kind: "invalid" };

/**
 * Resolve order (fail closed on ambiguity):
 * 1. Find InternalAccount by externalDirectoryId
 * 2. Else find by username awaiting first link and set externalDirectoryId
 * 3. Else create HumanIdentity + InternalAccount only when explicit mapping allows
 *
 * On create/link: passwordHash = null (never store directory password).
 * Coarse role must be one of the five MVP codes.
 *
 * Policy (directory blocked vs inactive linked):
 * - Directory disabled/locked/expired/removed → INVALID_CREDENTIALS upstream (no enumeration)
 * - Already-linked inactive internal account → INACTIVE_ACCOUNT (this function returns inactive)
 */
export async function linkOrCreateInternalAccount(
  db: PrismaClient,
  directory: DirectoryVerifyOk,
  config: LdapConfig,
): Promise<LinkAccountResult> {
  const externalDirectoryId = directory.externalDirectoryId.trim();
  const loginUsername = directory.username.trim();
  if (!externalDirectoryId || !loginUsername) {
    return { kind: "invalid" };
  }

  const byExternal = await db.internalAccount.findUnique({
    where: { externalDirectoryId },
    include: { humanIdentity: true },
  });

  if (byExternal) {
    if (byExternal.username !== loginUsername) {
      // Conflicting link: same directory id, different username — never merge silently.
      const other = await db.internalAccount.findUnique({
        where: { username: loginUsername },
      });
      if (other && other.id !== byExternal.id) {
        return { kind: "conflict" };
      }
    }
    if (byExternal.status === "inactive") {
      return { kind: "inactive" };
    }
    if (!isCoarseRole(byExternal.coarseRole)) {
      return { kind: "invalid" };
    }

    // Keep username aligned with login identifier used by getActiveCoarseRoleByUsername.
    // Always refresh displayName + clear any leftover local password hash.
    if (byExternal.username !== loginUsername) {
      const clash = await db.internalAccount.findUnique({
        where: { username: loginUsername },
      });
      if (clash && clash.id !== byExternal.id) {
        return { kind: "conflict" };
      }
    }

    const displayName =
      directory.displayName || byExternal.humanIdentity.displayName;

    await db.internalAccount.update({
      where: { id: byExternal.id },
      data: {
        username: loginUsername,
        passwordHash: null,
        humanIdentity: {
          update: { displayName },
        },
      },
    });

    return {
      kind: "ok",
      accountId: byExternal.id,
      username: loginUsername,
      displayName,
      coarseRole: byExternal.coarseRole as CoarseRole,
      humanIdentityId: byExternal.humanIdentityId,
    };
  }

  const byUsername = await db.internalAccount.findUnique({
    where: { username: loginUsername },
    include: { humanIdentity: true },
  });

  if (byUsername) {
    if (byUsername.externalDirectoryId && byUsername.externalDirectoryId !== externalDirectoryId) {
      return { kind: "conflict" };
    }
    if (byUsername.status === "inactive") {
      return { kind: "inactive" };
    }
    if (!isCoarseRole(byUsername.coarseRole)) {
      return { kind: "invalid" };
    }

    const displayName =
      directory.displayName || byUsername.humanIdentity.displayName;

    await db.internalAccount.update({
      where: { id: byUsername.id },
      data: {
        externalDirectoryId,
        passwordHash: null,
        humanIdentity: {
          update: { displayName },
        },
      },
    });

    return {
      kind: "ok",
      accountId: byUsername.id,
      username: byUsername.username,
      displayName,
      coarseRole: byUsername.coarseRole as CoarseRole,
      humanIdentityId: byUsername.humanIdentityId,
    };
  }

  // Create only when explicit mapping allows (directory id or username → role).
  const mappedRole =
    config.createMapping.get(externalDirectoryId) ??
    config.createMapping.get(loginUsername);

  if (!mappedRole) {
    return { kind: "unmapped" };
  }
  if (!isCoarseRole(mappedRole)) {
    return { kind: "unmapped" };
  }

  try {
    const created = await db.humanIdentity.create({
      data: {
        displayName: directory.displayName || loginUsername,
        account: {
          create: {
            username: loginUsername,
            passwordHash: null,
            externalDirectoryId,
            status: "active",
            coarseRole: mappedRole,
          },
        },
      },
      include: { account: true },
    });

    const account = created.account;
    if (!account) {
      return { kind: "invalid" };
    }

    return {
      kind: "ok",
      accountId: account.id,
      username: account.username,
      displayName: created.displayName,
      coarseRole: account.coarseRole as CoarseRole,
      humanIdentityId: created.id,
    };
  } catch (err) {
    // Concurrent first-login: unique on username / externalDirectoryId — re-fetch, never merge silently.
    if (!isUniqueConstraintError(err)) {
      throw err;
    }
    const raced =
      (await db.internalAccount.findUnique({
        where: { externalDirectoryId },
        include: { humanIdentity: true },
      })) ??
      (await db.internalAccount.findUnique({
        where: { username: loginUsername },
        include: { humanIdentity: true },
      }));

    if (!raced) {
      return { kind: "conflict" };
    }
    if (
      raced.externalDirectoryId &&
      raced.externalDirectoryId !== externalDirectoryId
    ) {
      return { kind: "conflict" };
    }
    if (raced.status === "inactive") {
      return { kind: "inactive" };
    }
    if (!isCoarseRole(raced.coarseRole)) {
      return { kind: "invalid" };
    }
    if (raced.username !== loginUsername) {
      const clash = await db.internalAccount.findUnique({
        where: { username: loginUsername },
      });
      if (clash && clash.id !== raced.id) {
        return { kind: "conflict" };
      }
    }

    const displayName =
      directory.displayName || raced.humanIdentity.displayName;

    await db.internalAccount.update({
      where: { id: raced.id },
      data: {
        username: loginUsername,
        externalDirectoryId,
        passwordHash: null,
        humanIdentity: { update: { displayName } },
      },
    });

    return {
      kind: "ok",
      accountId: raced.id,
      username: loginUsername,
      displayName,
      coarseRole: raced.coarseRole as CoarseRole,
      humanIdentityId: raced.humanIdentityId,
    };
  }
}

function isCoarseRole(value: string): value is CoarseRole {
  return (COARSE_ROLES as readonly string[]).includes(value);
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}
