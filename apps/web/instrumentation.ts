/**
 * Next.js instrumentation — warm governed settings cache at process boot (Story 10.1 / AD-7).
 * Fail closed: if warm fails, leave unwarmed so resolve/health report degraded (not silent OK).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) return;

  try {
    const { getSharedPgPool } = await import("@divan/db");
    const { warmSettingsCache } = await import("@divan/app-settings");
    await warmSettingsCache(getSharedPgPool(url));
  } catch {
    // Leave cache unwarmed — FR45 configuration section surfaces degraded.
  }
}
