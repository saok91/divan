import type { DefaultSession } from "next-auth";
import type { CoarseRole } from "@divan/identity-access";

declare module "next-auth" {
  interface User {
    accountId: string;
    username: string;
    coarseRole: CoarseRole;
    humanIdentityId: string;
    correlationId?: string;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      accountId: string;
      username: string;
      coarseRole: CoarseRole;
      humanIdentityId: string;
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
    lastActivityAt?: number;
    absoluteExp?: number;
  }
}
