import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@divan/db";
import bcrypt from "bcryptjs";

import { getIdentityDb } from "./db";
import { getIdentityProvider, getLdapConfig } from "./config";
import {
  MSG_LDAP_UNAVAILABLE,
  verifyDirectoryCredentials,
} from "./ldap-client";
import { linkOrCreateInternalAccount } from "./ldap-link";
import { loadOrganizationalScopeIdsForAccount } from "./access-admin";
import {
  AuthenticationError,
  type AuthAttemptOutcome,
  type CoarseRole,
  type SessionContext,
} from "./types";

const MSG_INVALID = "نام کاربری یا رمز عبور نادرست است.";
const MSG_INACTIVE = "این حساب غیرفعال است.";
/** Operator-facing when IDENTITY_PROVIDER is unknown/mis-set (not LDAP directory outage). */
const MSG_PROVIDER_SEEDED =
  "ارائه‌دهنده هویت پیکربندی‌شده در دسترس نیست. برای ورود seeded از IDENTITY_PROVIDER=seeded استفاده کنید.";

export type AuthenticateInput = {
  username: string;
  password: string;
  /** Optional correlation id; generated when omitted (FR42 substrate). */
  correlationId?: string;
};

export type AuthenticateResult = SessionContext & {
  correlationId: string;
};

/**
 * Verify credentials against the active identity provider.
 * - seeded: bcrypt against InternalAccount (refused when NODE_ENV=production)
 * - ldap: directory verify + link/create; never store LDAP password
 * - null / misconfigured ldap → PROVIDER_UNAVAILABLE (never fall back to seeded)
 */
export async function authenticate(
  input: AuthenticateInput,
  db: PrismaClient = getIdentityDb(),
): Promise<AuthenticateResult> {
  const correlationId = input.correlationId?.trim() || randomUUID();
  const username = input.username.trim();
  const password = input.password;

  const provider = getIdentityProvider();

  if (provider === null) {
    await recordAttempt(db, {
      correlationId,
      accountId: null,
      usernameAttempted: username,
      outcome: "failure_provider_unavailable",
    });
    throw new AuthenticationError(
      "PROVIDER_UNAVAILABLE",
      MSG_LDAP_UNAVAILABLE,
      correlationId,
    );
  }

  if (provider === "ldap") {
    return authenticateLdap({ username, password, correlationId }, db);
  }

  // provider === "seeded"
  if (process.env.NODE_ENV === "production") {
    await recordAttempt(db, {
      correlationId,
      accountId: null,
      usernameAttempted: username,
      outcome: "failure_provider_unavailable",
    });
    throw new AuthenticationError(
      "PROVIDER_UNAVAILABLE",
      MSG_PROVIDER_SEEDED,
      correlationId,
    );
  }

  return authenticateSeeded({ username, password, correlationId }, db);
}

async function authenticateLdap(
  input: { username: string; password: string; correlationId: string },
  db: PrismaClient,
): Promise<AuthenticateResult> {
  const { username, password, correlationId } = input;
  const config = getLdapConfig();

  if (!config) {
    await recordAttempt(db, {
      correlationId,
      accountId: null,
      usernameAttempted: username,
      outcome: "failure_provider_unavailable",
    });
    throw new AuthenticationError(
      "PROVIDER_UNAVAILABLE",
      MSG_LDAP_UNAVAILABLE,
      correlationId,
    );
  }

  const directory = await verifyDirectoryCredentials(username, password, config);

  if (directory.kind !== "ok") {
    if (directory.kind === "unavailable") {
      await recordAttempt(db, {
        correlationId,
        accountId: null,
        usernameAttempted: username,
        outcome: "failure_provider_unavailable",
      });
      throw new AuthenticationError(
        "PROVIDER_UNAVAILABLE",
        MSG_LDAP_UNAVAILABLE,
        correlationId,
      );
    }

    // account_blocked | invalid_credentials — fail closed; no user enumeration.
    await recordAttempt(db, {
      correlationId,
      accountId: null,
      usernameAttempted: username,
      outcome:
        directory.kind === "account_blocked"
          ? "failure_directory_blocked"
          : "failure_wrong_password",
    });
    throw new AuthenticationError(
      "INVALID_CREDENTIALS",
      MSG_INVALID,
      correlationId,
    );
  }

  const linked = await linkOrCreateInternalAccount(db, directory, config);

  if (linked.kind !== "ok") {
    if (linked.kind === "inactive") {
      await recordAttempt(db, {
        correlationId,
        accountId: null,
        usernameAttempted: username,
        outcome: "failure_inactive",
      });
      throw new AuthenticationError(
        "INACTIVE_ACCOUNT",
        MSG_INACTIVE,
        correlationId,
      );
    }

    await recordAttempt(db, {
      correlationId,
      accountId: null,
      usernameAttempted: username,
      outcome:
        linked.kind === "unmapped"
          ? "failure_unmapped"
          : linked.kind === "conflict"
            ? "failure_link_conflict"
            : "failure_unknown",
    });
    throw new AuthenticationError(
      "INVALID_CREDENTIALS",
      MSG_INVALID,
      correlationId,
    );
  }

  await recordAttempt(db, {
    correlationId,
    accountId: linked.accountId,
    usernameAttempted: username,
    outcome: "success",
  });

  const organizationalScopeIds = await loadOrganizationalScopeIdsForAccount(
    linked.accountId,
    db,
  );

  return {
    correlationId,
    accountId: linked.accountId,
    username: linked.username,
    displayName: linked.displayName,
    coarseRole: linked.coarseRole,
    humanIdentityId: linked.humanIdentityId,
    organizationalScopeIds,
  };
}

async function authenticateSeeded(
  input: { username: string; password: string; correlationId: string },
  db: PrismaClient,
): Promise<AuthenticateResult> {
  const { username, password, correlationId } = input;

  const account = await db.internalAccount.findUnique({
    where: { username },
    include: { humanIdentity: true },
  });

  if (!account) {
    await recordAttempt(db, {
      correlationId,
      accountId: null,
      usernameAttempted: username,
      outcome: "failure_unknown",
    });
    throw new AuthenticationError(
      "INVALID_CREDENTIALS",
      MSG_INVALID,
      correlationId,
    );
  }

  if (account.status === "inactive") {
    await recordAttempt(db, {
      correlationId,
      accountId: account.id,
      usernameAttempted: username,
      outcome: "failure_inactive",
    });
    throw new AuthenticationError(
      "INACTIVE_ACCOUNT",
      MSG_INACTIVE,
      correlationId,
    );
  }

  if (!account.passwordHash) {
    // LDAP-linked or hash-less row cannot authenticate via seeded path.
    await recordAttempt(db, {
      correlationId,
      accountId: account.id,
      usernameAttempted: username,
      outcome: "failure_wrong_password",
    });
    throw new AuthenticationError(
      "INVALID_CREDENTIALS",
      MSG_INVALID,
      correlationId,
    );
  }

  const passwordOk = await bcrypt.compare(password, account.passwordHash);
  if (!passwordOk) {
    await recordAttempt(db, {
      correlationId,
      accountId: account.id,
      usernameAttempted: username,
      outcome: "failure_wrong_password",
    });
    throw new AuthenticationError(
      "INVALID_CREDENTIALS",
      MSG_INVALID,
      correlationId,
    );
  }

  await recordAttempt(db, {
    correlationId,
    accountId: account.id,
    usernameAttempted: username,
    outcome: "success",
  });

  const organizationalScopeIds = await loadOrganizationalScopeIdsForAccount(
    account.id,
    db,
  );

  return {
    correlationId,
    accountId: account.id,
    username: account.username,
    displayName: account.humanIdentity.displayName,
    coarseRole: account.coarseRole as CoarseRole,
    humanIdentityId: account.humanIdentityId,
    organizationalScopeIds,
  };
}

/**
 * Load session context by account id (JWT refresh / governed-path revalidation).
 * Returns null when account missing or inactive (fail-closed).
 *
 * Authz freshness policy (Story 2.1): DB is source of truth for `coarseRole` and
 * status. Governed paths must call this and use the returned context — never
 * authorize solely from a stale JWT claim. If JWT role ≠ DB role, prefer DB
 * (caller replaces session with this result). Full Auth.js revoke remains deferred.
 */
export async function getSessionContext(
  accountId: string,
  db: PrismaClient = getIdentityDb(),
): Promise<SessionContext | null> {
  const account = await db.internalAccount.findUnique({
    where: { id: accountId },
    include: { humanIdentity: true },
  });
  if (!account || account.status !== "active") return null;

  const organizationalScopeIds = await loadOrganizationalScopeIdsForAccount(
    account.id,
    db,
  );

  return {
    accountId: account.id,
    username: account.username,
    displayName: account.humanIdentity.displayName,
    coarseRole: account.coarseRole as CoarseRole,
    humanIdentityId: account.humanIdentityId,
    organizationalScopeIds,
  };
}

/**
 * Active coarse role by username — for post-login landing after Auth.js
 * signIn (same-request auth() often cannot read the new session cookie yet).
 */
export async function getActiveCoarseRoleByUsername(
  username: string,
  db: PrismaClient = getIdentityDb(),
): Promise<CoarseRole | null> {
  const account = await db.internalAccount.findUnique({
    where: { username: username.trim() },
    select: { coarseRole: true, status: true },
  });
  if (!account || account.status !== "active") return null;
  return account.coarseRole as CoarseRole;
}

/**
 * Session clear for JWT is owned by Auth.js in apps/web.
 * Server-side revoke / JWT stale-role after demote deferred (see deferred-work.md).
 */
export async function signOut(_accountId?: string): Promise<void> {
  // no-op — Auth.js JWT clear is apps/web; module revoke hook deferred
}

/**
 * Dev helper: mark an account active/inactive so inactive fail-closed is testable.
 * Not a production admin API.
 */
export async function setAccountStatus(
  username: string,
  status: "active" | "inactive",
  db: PrismaClient = getIdentityDb(),
): Promise<void> {
  await db.internalAccount.update({
    where: { username },
    data: { status },
  });
}

async function recordAttempt(
  db: PrismaClient,
  row: {
    correlationId: string;
    accountId: string | null;
    usernameAttempted: string | null;
    outcome: AuthAttemptOutcome;
  },
): Promise<void> {
  try {
    await db.authAttempt.create({
      data: {
        correlationId: row.correlationId,
        accountId: row.accountId,
        usernameAttempted: row.usernameAttempted,
        outcome: row.outcome,
      },
    });
  } catch (err) {
    // Attribution must not block authentication (FR42 substrate is best-effort).
    console.error("[identity-access] authAttempt record failed", err);
  }
}
