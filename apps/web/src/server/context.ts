import { getSessionContext } from "@divan/identity-access";

import { auth } from "@/auth";

import type { TrpcContext } from "./trpc";

/**
 * tRPC context — JWT proves login; DB session is authz source of truth.
 * Break-glass summary is hydrated from active grants (Story 2.5).
 * Login-time authz fingerprint is preserved for mid-session change (Story 2.6).
 */
export async function createContext(): Promise<TrpcContext> {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    return { session: null, priorAuthzBindingFingerprint: null };
  }

  const fresh = await getSessionContext(session.user.accountId);
  if (!fresh) {
    return { session: null, priorAuthzBindingFingerprint: null };
  }

  return {
    session: fresh,
    priorAuthzBindingFingerprint:
      session.user.authzBindingFingerprint?.trim() || null,
  };
}
