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
    /** Login-time authz fingerprint — mid-session change detect (Story 2.6). */
    authzBindingFingerprint?: string;
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
      authzBindingFingerprint?: string;
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
    /** Frozen at login — compared to fresh DB fingerprint on governed entry. */
    authzBindingFingerprint?: string;
    lastActivityAt?: number;
    absoluteExp?: number;
  }
}
