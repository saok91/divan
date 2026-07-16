/**
 * @divan/identity-access — authentication + coarse role context (AD-5).
 * Seeded provider for local/dev/CI; LDAP lands in Story 1.8.
 */

export {
  COARSE_ROLES,
  COARSE_ROLE_LABELS_FA,
  AuthenticationError,
  DEV_DEFAULT_IDLE_TIMEOUT_SECONDS,
  DEV_DEFAULT_ABSOLUTE_TIMEOUT_SECONDS,
  type CoarseRole,
  type AccountStatus,
  type SessionContext,
  type AuthAttemptOutcome,
  type AuthenticationErrorCode,
  type IdentityProvider,
  type SessionTimeoutConfig,
} from "./types";

export {
  getIdentityProvider,
  getSessionTimeoutConfig,
} from "./config";

export {
  authenticate,
  getSessionContext,
  signOut,
  setAccountStatus,
  type AuthenticateInput,
  type AuthenticateResult,
} from "./authenticate";

export {
  seedDevAccounts,
  assertSeedAllowed,
  SeedGuardError,
  SEED_ACCOUNTS,
  DEV_SEED_PASSWORD,
  type SeedAccountSpec,
} from "./seed";

export { getIdentityDb, setIdentityDb } from "./db";
