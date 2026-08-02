/**
 * @divan/identity-access — authentication + coarse role context (AD-5).
 * Seeded provider for local/dev/CI; LDAP behind IDENTITY_PROVIDER=ldap (Infra-gated).
 *
 * Coarse nav visibility is not HR content entitlement (System Admin has no
 * routine HR data even when عملیات is their only nav item).
 *
 * Story 2.6: OrganizationalScope.code aligns policy tokens (org:selfcheck) with
 * membership; PopulationPort fixtures prove FR-47 until Epic 3/4 projections.
 * Mid-session authz change uses authzBindingFingerprint (JWT login snapshot).
 */

export {
  COARSE_ROLES,
  COARSE_ROLE_LABELS_FA,
  AuthenticationError,
  AuthzChangedError,
  computeAuthzBindingFingerprint,
  DEV_DEFAULT_IDLE_TIMEOUT_SECONDS,
  DEV_DEFAULT_ABSOLUTE_TIMEOUT_SECONDS,
  type CoarseRole,
  type AccountStatus,
  type SessionContext,
  type CoarseAuthzContext,
  type AuthAttemptOutcome,
  type AuthenticationErrorCode,
  type IdentityProvider,
  type SessionTimeoutConfig,
} from "./types";

export { toEnvelopeAuthzContext } from "./authz-context";

export {
  getIdentityProvider,
  getSessionTimeoutConfig,
  getLdapConfig,
  type LdapConfig,
} from "./config";

export { MSG_LDAP_UNAVAILABLE } from "./ldap-client";

export {
  probeDirectoryConnectivity,
  type DirectoryConnectivityProbe,
} from "./directory-probe";

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

export {
  SEED_SETTINGS_PERMISSIONS,
  seedSettingsPermissionFixtures,
} from "./seed-settings";

export {
  ACCESS_ADMINISTRATION_PERMISSION,
  ACCESS_ADMIN_DATA_CATEGORY,
  EMPTY_ENTITLEMENTS_COPY_FA,
  MSG_TOXIC_COMBINATION_FA,
  MSG_ROLE_REQUIRES_PERMISSION_SET_FA,
  MSG_PERMISSION_OUTSIDE_SET_FA,
  MSG_EMPTY_PERMISSION_SET_FA,
  MSG_ACCESS_ADMIN_REQUIRED_FA,
  MSG_LIFECYCLE_APPROVAL_REQUIRED_FA,
  SEED_ACCESS_ADMIN,
  AccessAdminError,
  assertToxicCombinationAllowed,
  assertActorHasAccessAdministration,
  getToxicCombinationRegistry,
  setToxicCombinationRegistryForTests,
  previewApproveGrant,
  listOrganizationalScopes,
  createOrganizationalScope,
  updateOrganizationalScope,
  listPermissionSets,
  createPermissionSet,
  updatePermissionSet,
  listAccessRoles,
  createAccessRole,
  updateAccessRole,
  listEntitlements,
  assignAccountAccessRoles,
  assignAccountScopes,
  getAccountLink,
  updateAccountLink,
  setAccountActiveStatus,
  loadOrganizationalScopeIdsForAccount,
  loadOrganizationalScopesForAccount,
  loadAccessRoleIdsForAccount,
  seedAccessAdministrationFixtures,
  type AccessAdminActor,
  type MutateResult,
  type Snapshot,
  type EntitlementRow,
  type ToxicCombinationInput,
  type ToxicOperation,
  type ToxicRule,
} from "./access-admin";

export {
  requestGrant,
  approveGrant,
  activateGrant,
  revokeGrant,
  waiveGrant,
  recertifyGrant,
  listGrants,
  getGrant,
  compensateActivateGrant,
  applyExpiryFailSafe,
  applyOverdueRecertificationFailSafe,
  applyProtectedEntryFailSafes,
  revokeActiveGrantsForAccount,
  reauthorizeForQueuedOrArtifactWork,
  getEntitlementLifecycleHooks,
  setEntitlementLifecycleHooksForTests,
  kindRequiresIndependentApproval,
  grantSnapshot,
  toGrantView,
  MSG_GRANT_SELF_REQUEST_FA,
  MSG_GRANT_NOT_FOUND_FA,
  MSG_GRANT_INVALID_TRANSITION_FA,
  MSG_GRANT_INDEPENDENT_APPROVER_FA,
  MSG_TOXIC_OWN_GRANT_FA,
  type GrantKind,
  type GrantStatus,
  type GrantView,
  type GrantCreatePayload,
  type RequestGrantInput,
  type EntitlementLifecycleHooks,
  type RecertOverdueAction,
} from "./entitlement-lifecycle";

export {
  BREAK_GLASS_PRIVILEGED_READ_PERMISSION,
  DEMO_BREAK_GLASS_MAX_DURATION_MS,
  SEED_BREAK_GLASS,
  MSG_BREAK_GLASS_INCIDENT_REQUIRED_FA,
  MSG_BREAK_GLASS_EXPIRES_REQUIRED_FA,
  MSG_BREAK_GLASS_DURATION_EXCEEDED_FA,
  MSG_BREAK_GLASS_ELEVATION_DENIED_FA,
  MSG_BREAK_GLASS_EXPORT_DENIED_FA,
  MSG_BREAK_GLASS_ADMIN_DENIED_FA,
  MSG_BREAK_GLASS_REVIEW_TOXIC_FA,
  MSG_BREAK_GLASS_PRIVILEGED_READ_REQUIRED_FA,
  MSG_BREAK_GLASS_SELF_REQUEST_FA,
  MSG_BREAK_GLASS_OVERLAP_FA,
  MSG_BREAK_GLASS_ROLE_LIFECYCLE_ONLY_FA,
  MSG_BREAK_GLASS_RECERTIFY_DENIED_FA,
  isBreakGlassElevationRoleCode,
  requestBreakGlassGrant,
  completeBreakGlassPostUseReview,
  getActiveBreakGlassForAccount,
  listBreakGlassGrants,
  assertActorHasBreakGlassPrivilegedRead,
  assertBreakGlassElevationLimits,
  assertBreakGlassActivationAllowed,
  validateBreakGlassRequestInput,
  seedBreakGlassFixtures,
  getBreakGlassHooks,
  setBreakGlassHooksForTests,
  type BreakGlassHooks,
  type ActiveBreakGlassSummary,
  type RequestBreakGlassInput,
} from "./break-glass";

export {
  DEMO_POPULATION_FIXTURES,
  intersectPopulation,
  drillDownPopulation,
  currentAsOfDate,
  getPopulationFixtureRegistry,
  setPopulationFixtureRegistryForTests,
  setPopulationPortEnabledForTests,
  upsertCrossTimeGrantFixture,
  removeCrossTimeGrantFixture,
  type RetrievalChannel,
  type PopulationPortInput,
  type PopulationPortResult,
  type PopulationFixtureRegistry,
  type PopulationSubject,
  type ManagementRelationship,
  type CrossTimeGrantFixture,
  type PopulationFact,
} from "./population-authz";

export { getIdentityDb, setIdentityDb } from "./db";
