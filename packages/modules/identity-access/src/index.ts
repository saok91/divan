/**
 * @divan/identity-access — authentication + coarse role context (AD-5).
 * Seeded provider for local/dev/CI; LDAP lands in Story 1.8.
 *
 * Coarse nav visibility is not HR content entitlement (System Admin has no
 * routine HR data even when عملیات is their only nav item).
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
  getActiveCoarseRoleByUsername,
  signOut,
  setAccountStatus,
  type AuthenticateInput,
  type AuthenticateResult,
} from "./authenticate";

export {
  NAV_CATALOG,
  getRoleLandingPath,
  getNavItemsForRole,
  canAccessPath,
  resolvePostLoginPath,
  type NavItem,
} from "./navigation";

export {
  recordAccessDenial,
  type RecordAccessDenialInput,
  type RecordAccessDenialResult,
} from "./access-denial";

export {
  seedDevAccounts,
  assertSeedAllowed,
  SeedGuardError,
  SEED_ACCOUNTS,
  DEV_SEED_PASSWORD,
  type SeedAccountSpec,
} from "./seed";

export { getIdentityDb, setIdentityDb } from "./db";
