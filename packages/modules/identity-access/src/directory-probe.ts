/**
 * Directory connectivity probe for ops health (Story 7.2 / FR-45).
 * Service bind only — never user passwords; never log secrets or entries.
 */

import type { LdapConfig } from "./config";
import { getIdentityProvider, getLdapConfig } from "./config";
import { createLdapClient, MSG_LDAP_UNAVAILABLE } from "./ldap-client";

export type DirectoryConnectivityProbe = {
  status: "ok" | "red" | "not_configured" | "unavailable";
  detailFa: string;
};

/**
 * Probe LDAP/directory reachability without authenticating an end user.
 * - seeded / missing LDAP config → honesty (`not_configured`), never fake green
 * - unreachable / bind fail → `red` with exact MSG_LDAP_UNAVAILABLE
 * Always unbinds in `finally`. Never returns bind password or entries.
 */
export async function probeDirectoryConnectivity(
  env: NodeJS.ProcessEnv = process.env,
  configOverride?: LdapConfig | null,
): Promise<DirectoryConnectivityProbe> {
  const provider = getIdentityProvider(env);
  if (provider === "seeded") {
    return {
      status: "not_configured",
      detailFa:
        "حالت seeded-dev: اتصال LDAP پیکربندی نشده — سبز جعلی نمایش داده نمی‌شود.",
    };
  }
  if (provider === null) {
    return {
      status: "unavailable",
      detailFa: MSG_LDAP_UNAVAILABLE,
    };
  }

  const config =
    configOverride === undefined ? getLdapConfig(env) : configOverride;
  if (!config) {
    return {
      status: "not_configured",
      detailFa: MSG_LDAP_UNAVAILABLE,
    };
  }

  let client: ReturnType<typeof createLdapClient> | undefined;
  try {
    client = createLdapClient(config);
    await client.bind(config.bindDn, config.bindPassword);
    // Cheap reachability: RootDSE-style base search with sizeLimit 1.
    await client.search("", {
      scope: "base",
      filter: "(objectClass=*)",
      attributes: ["namingContexts"],
      sizeLimit: 1,
    });
    return {
      status: "ok",
      detailFa: "اتصال به سامانه هویت برقرار است.",
    };
  } catch {
    return {
      status: "red",
      detailFa: MSG_LDAP_UNAVAILABLE,
    };
  } finally {
    if (client) {
      try {
        await client.unbind();
      } catch {
        // Ignore unbind errors — must not mask probe outcome.
      }
    }
  }
}
