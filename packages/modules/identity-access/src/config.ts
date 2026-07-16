import type { IdentityProvider, SessionTimeoutConfig } from "./types";
import {
  DEV_DEFAULT_ABSOLUTE_TIMEOUT_SECONDS,
  DEV_DEFAULT_IDLE_TIMEOUT_SECONDS,
} from "./types";

/**
 * Active identity provider. Seeded is for local/dev/CI only.
 * Unknown values do NOT silently fall back to seeded (freeze: no silent seed path).
 * Returns null when IDENTITY_PROVIDER is set to an unsupported value.
 */
export function getIdentityProvider(
  env: NodeJS.ProcessEnv = process.env,
): IdentityProvider | null {
  const raw = (env.IDENTITY_PROVIDER ?? "seeded").trim().toLowerCase();
  if (raw === "ldap") return "ldap";
  if (raw === "seeded") return "seeded";
  return null;
}

/**
 * Session idle/absolute timeout hooks (NFR7 substrate).
 * Reads env; falls back to documented dev defaults — do not claim AR-IDENTITY compliance.
 */
export function getSessionTimeoutConfig(
  env: NodeJS.ProcessEnv = process.env,
): SessionTimeoutConfig {
  return {
    idleTimeoutSeconds: parsePositiveInt(
      env.AUTH_SESSION_IDLE_TIMEOUT_SECONDS,
      DEV_DEFAULT_IDLE_TIMEOUT_SECONDS,
    ),
    absoluteTimeoutSeconds: parsePositiveInt(
      env.AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS,
      DEV_DEFAULT_ABSOLUTE_TIMEOUT_SECONDS,
    ),
  };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}
