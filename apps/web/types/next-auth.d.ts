import type { DefaultSession } from "next-auth";
import type { CoarseRole } from "@divan/identity-access";

declare module "next-auth" {
  interface User {
    accountId: string;
    username: string;
    coarseRole: CoarseRole;
    humanIdentityId: string;
    /** Coarse org scope hooks — empty until Story 2.3. */
    organizationalScopeIds?: string[];
    correlationId?: string;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      accountId: string;
      username: string;
      coarseRole: CoarseRole;
      humanIdentityId: string;
      organizationalScopeIds?: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accountId?: string;
    username?: string;
    coarseRole?: CoarseRole;
    humanIdentityId?: string;
    displayName?: string;
    organizationalScopeIds?: string[];
    lastActivityAt?: number;
    absoluteExp?: number;
  }
}
