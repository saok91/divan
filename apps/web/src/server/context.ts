import { auth } from "@/auth";
import type { SessionContext } from "@divan/identity-access";

import type { TrpcContext } from "./trpc";

export async function createContext(): Promise<TrpcContext> {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    return { session: null };
  }

  const mapped: SessionContext = {
    accountId: session.user.accountId,
    username: session.user.username,
    displayName: session.user.name ?? session.user.username,
    coarseRole: session.user.coarseRole,
    humanIdentityId: session.user.humanIdentityId,
  };

  return { session: mapped };
}
