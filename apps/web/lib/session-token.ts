import type { JWT } from "next-auth/jwt";
import type { SessionContext } from "@divan/identity-access";

/** Validate before loading identity, including explicit session.update requests. */
export async function refreshSessionToken(
  token: JWT,
  trigger: string | undefined,
  now: number,
  timeouts: { idleTimeoutSeconds: number },
  loadContext: (accountId: string) => Promise<SessionContext | null>,
): Promise<JWT | null> {
  if (
    typeof token.accountId !== "string" || !token.accountId.trim() ||
    typeof token.absoluteExp !== "number" || !Number.isFinite(token.absoluteExp) ||
    typeof token.lastActivityAt !== "number" || !Number.isFinite(token.lastActivityAt) ||
    token.lastActivityAt > now || now >= token.absoluteExp ||
    now - token.lastActivityAt >= timeouts.idleTimeoutSeconds
  ) return null;

  const context = await loadContext(token.accountId);
  if (!context) return null;
  token.username = context.username;
  token.coarseRole = context.coarseRole;
  token.humanIdentityId = context.humanIdentityId;
  token.displayName = context.displayName;
  token.organizationalScopeIds = context.organizationalScopeIds;
  if (trigger === "update" || typeof token.authzBindingFingerprint !== "string" || !token.authzBindingFingerprint.trim()) {
    token.authzBindingFingerprint = context.authzBindingFingerprint;
  }
  token.lastActivityAt = now;
  return token;
}
