import type { CoarseAuthzContext, SessionContext } from "./types";

/**
 * Map session → coarse authz context for `@divan/audit-envelope`.
 * Fine-grained permission × category × action × scope stays in the envelope.
 */
export function toEnvelopeAuthzContext(
  session: SessionContext,
): CoarseAuthzContext {
  return {
    accountId: session.accountId,
    coarseRole: session.coarseRole,
    organizationalScopeIds: session.organizationalScopeIds,
  };
}
