import NextAuth, { type NextAuthResult } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import { z } from "zod";

import {
  AuthenticationError,
  authenticate,
  getSessionContext,
  getSessionTimeoutConfig,
  type CoarseRole,
} from "@divan/identity-access";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/** Maps identity-access failures into Auth.js CredentialsSignin codes. */
export class DivanCredentialsSignin extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

const { idleTimeoutSeconds, absoluteTimeoutSeconds } =
  getSessionTimeoutConfig();

const nextAuth = NextAuth({
  providers: [
    Credentials({
      id: "credentials",
      name: "Divan",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) {
          throw new DivanCredentialsSignin("INVALID_CREDENTIALS");
        }

        try {
          const result = await authenticate({
            username: parsed.data.username,
            password: parsed.data.password,
          });
          return {
            id: result.accountId,
            name: result.displayName,
            email: undefined,
            accountId: result.accountId,
            username: result.username,
            coarseRole: result.coarseRole,
            humanIdentityId: result.humanIdentityId,
            organizationalScopeIds: result.organizationalScopeIds,
            authzBindingFingerprint: result.authzBindingFingerprint,
            correlationId: result.correlationId,
          };
        } catch (err) {
          if (err instanceof AuthenticationError) {
            throw new DivanCredentialsSignin(err.code);
          }
          // Fail closed: never leak infra details to the login boundary.
          throw new DivanCredentialsSignin("INVALID_CREDENTIALS");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: absoluteTimeoutSeconds,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      const now = Math.floor(Date.now() / 1000);
      const timeouts = getSessionTimeoutConfig();

      if (user) {
        token.accountId = user.accountId;
        token.username = user.username;
        token.coarseRole = user.coarseRole;
        token.humanIdentityId = user.humanIdentityId;
        token.displayName = user.name ?? user.username;
        token.organizationalScopeIds = user.organizationalScopeIds ?? [];
        // Login-time snapshot — do NOT overwrite on refresh (Story 2.6 mid-session).
        token.authzBindingFingerprint = user.authzBindingFingerprint ?? "";
        token.lastActivityAt = now;
        token.absoluteExp = now + timeouts.absoluteTimeoutSeconds;
        return token;
      }

      // Explicit session.update() after mid-session authz ack — refresh fingerprint.
      if (trigger === "update" && typeof token.accountId === "string") {
        const ctx = await getSessionContext(token.accountId);
        if (!ctx) return null;
        token.username = ctx.username;
        token.coarseRole = ctx.coarseRole;
        token.humanIdentityId = ctx.humanIdentityId;
        token.displayName = ctx.displayName;
        token.organizationalScopeIds = ctx.organizationalScopeIds;
        token.authzBindingFingerprint = ctx.authzBindingFingerprint;
        token.lastActivityAt = now;
        return token;
      }

      // Malformed/legacy tokens without timeout hooks → fail closed.
      if (
        typeof token.absoluteExp !== "number" ||
        typeof token.lastActivityAt !== "number" ||
        typeof token.accountId !== "string"
      ) {
        return null;
      }

      if (now > token.absoluteExp) {
        return null;
      }

      if (now - token.lastActivityAt > timeouts.idleTimeoutSeconds) {
        return null;
      }

      const ctx = await getSessionContext(token.accountId);
      if (!ctx) {
        return null;
      }

      token.username = ctx.username;
      token.coarseRole = ctx.coarseRole;
      token.humanIdentityId = ctx.humanIdentityId;
      token.displayName = ctx.displayName;
      token.organizationalScopeIds = ctx.organizationalScopeIds;
      // Login-time snapshot for mid-session detect. Empty/legacy → hydrate once
      // (do not leave blank — blank was treated as perpetual AUTHZ_CHANGED).
      if (
        typeof token.authzBindingFingerprint !== "string" ||
        !token.authzBindingFingerprint.trim()
      ) {
        token.authzBindingFingerprint = ctx.authzBindingFingerprint;
      }
      token.lastActivityAt = now;
      return token;
    },
    async session({ session, token }) {
      if (!token?.accountId || !token.coarseRole) {
        return session;
      }
      session.user = {
        ...session.user,
        id: token.accountId as string,
        accountId: token.accountId as string,
        username: token.username as string,
        coarseRole: token.coarseRole as CoarseRole,
        humanIdentityId: token.humanIdentityId as string,
        organizationalScopeIds: Array.isArray(token.organizationalScopeIds)
          ? token.organizationalScopeIds.filter(
              (x): x is string => typeof x === "string",
            )
          : [],
        authzBindingFingerprint:
          typeof token.authzBindingFingerprint === "string"
            ? token.authzBindingFingerprint
            : "",
        name: (token.displayName as string) ?? session.user?.name,
      };
      return session;
    },
  },
  // Local/dev: trust host. Production: only with explicit AUTH_TRUST_HOST=true.
  trustHost:
    process.env.NODE_ENV !== "production" ||
    process.env.AUTH_TRUST_HOST === "true",
  secret: process.env.AUTH_SECRET,
});

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;

/** Re-export timeout constants used at config load for clarity in docs. */
export const authTimeoutHooks = {
  idleTimeoutSeconds,
  absoluteTimeoutSeconds,
};
