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

  return {
    // Authentication only here. Each protected operation loads current DB access
    // at its boundary, avoiding a redundant hydration for the entire batch.
    session: null,
    authenticatedAccountId: session.user.accountId,
    priorAuthzBindingFingerprint:
      session.user.authzBindingFingerprint?.trim() || null,
  };
}
