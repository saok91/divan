import { getSessionContext } from "@divan/identity-access";

import { auth } from "@/auth";

import type { TrpcContext } from "./trpc";

/**
 * tRPC context — JWT proves login; DB session is authz source of truth.
 * Break-glass summary is hydrated from active grants (Story 2.5).
 */
export async function createContext(): Promise<TrpcContext> {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    return { session: null };
  }

  const fresh = await getSessionContext(session.user.accountId);
  if (!fresh) {
    return { session: null };
  }

  return { session: fresh };
}
