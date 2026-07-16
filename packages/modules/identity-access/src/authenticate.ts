import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@divan/db";
import bcrypt from "bcryptjs";

import { getIdentityDb } from "./db";
import { getIdentityProvider } from "./config";
import {
  AuthenticationError,
  type AuthAttemptOutcome,
  type CoarseRole,
  type SessionContext,
} from "./types";

const MSG_INVALID = "نام کاربری یا رمز عبور نادرست است.";
const MSG_INACTIVE = "این حساب غیرفعال است.";
const MSG_PROVIDER =
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
 * Verify username/password against seeded internal accounts.
 * Fail-closed: unknown / wrong / inactive — no privilege elevation.
 * Seeded path is refused when NODE_ENV=production (AC #4).
 */
export async function authenticate(
  input: AuthenticateInput,
  db: PrismaClient = getIdentityDb(),
): Promise<AuthenticateResult> {
  const correlationId = input.correlationId?.trim() || randomUUID();
  const username = input.username.trim();

  const provider = getIdentityProvider();
  if (
    provider !== "seeded" ||
    process.env.NODE_ENV === "production"
  ) {
    await recordAttempt(db, {
      correlationId,
      accountId: null,
      usernameAttempted: username,
      outcome: "failure_unknown",
    });
    throw new AuthenticationError(
      "PROVIDER_UNAVAILABLE",
      MSG_PROVIDER,
      correlationId,
    );
  }

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

  const passwordOk = await bcrypt.compare(input.password, account.passwordHash);
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

  return {
    correlationId,
    accountId: account.id,
    username: account.username,
    displayName: account.humanIdentity.displayName,
    coarseRole: account.coarseRole as CoarseRole,
    humanIdentityId: account.humanIdentityId,
  };
}

/**
 * Load session context by account id (for JWT refresh / getSession hooks).
 * Returns null when account missing or inactive (fail-closed).
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

  return {
    accountId: account.id,
    username: account.username,
    displayName: account.humanIdentity.displayName,
    coarseRole: account.coarseRole as CoarseRole,
    humanIdentityId: account.humanIdentityId,
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
 * Module hook reserved for future server-side revoke / LDAP logout (Story 1.8).
 */
export async function signOut(_accountId?: string): Promise<void> {
  // no-op for seeded JWT sessions
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
