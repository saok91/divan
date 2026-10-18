import { readFileSync } from "node:fs";
import type { ConnectionOptions } from "node:tls";

import { Client, type Entry } from "ldapts";

import type { LdapConfig } from "./config";

/** Exact freeze/UX outage copy — also cataloged in apps/web operationalCopy.ldapUnavailable. */
export const MSG_LDAP_UNAVAILABLE = "اتصال به سامانه هویت برقرار نیست.";

export type DirectoryVerifyOk = {
  kind: "ok";
  externalDirectoryId: string;
  username: string;
  displayName: string;
  dn: string;
};

export type DirectoryVerifyResult =
  | DirectoryVerifyOk
  | { kind: "invalid_credentials" }
  | { kind: "account_blocked" }
  | { kind: "unavailable" };

/**
 * Verify credentials against the directory (Infra-configured).
 * Never logs passwords, bind secrets, or raw LDAP payloads.
 * Always unbinds/closes the client in `finally`.
 */
export async function verifyDirectoryCredentials(
  username: string,
  password: string,
  config: LdapConfig,
): Promise<DirectoryVerifyResult> {
  if (!username || password === "") {
    return { kind: "invalid_credentials" };
  }

  const client = createLdapClient(config);

  try {
    await client.bind(config.bindDn, config.bindPassword);

    const filter = buildUserFilter(config.userFilter, username);
    const { searchEntries } = await client.search(config.baseDn, {
      scope: "sub",
      filter,
      attributes: [
        "dn",
        config.idAttribute,
        config.loginAttribute,
        config.displayNameAttribute,
        ...(config.disabledAttr ? [config.disabledAttr] : []),
        ...(config.lockedAttr ? [config.lockedAttr] : []),
        ...(config.expiredAttr ? [config.expiredAttr] : []),
      ],
      sizeLimit: 2,
    });

    if (searchEntries.length === 0) {
      return { kind: "invalid_credentials" };
    }
    if (searchEntries.length > 1) {
      // Ambiguous directory match — fail closed, no merge.
      return { kind: "invalid_credentials" };
    }

    const entry = searchEntries[0]!;
    const dn = entry.dn;
    if (!dn) {
      return { kind: "unavailable" };
    }

    if (isAccountBlocked(entry, config)) {
      return { kind: "account_blocked" };
    }

    const externalDirectoryId = attrString(entry, config.idAttribute);
    if (!externalDirectoryId) {
      return { kind: "invalid_credentials" };
    }

    // Account username must match the submitted login identifier so
    // post-login landing (`getActiveCoarseRoleByUsername`) finds the row.
    // Directory loginAttribute is only a displayName fallback source.
    const loginAttr =
      attrString(entry, config.loginAttribute) || username;
    const displayName =
      attrString(entry, config.displayNameAttribute) || loginAttr;

    // User bind verifies password — never persist it.
    await client.bind(dn, password);

    return {
      kind: "ok",
      externalDirectoryId,
      username,
      displayName,
      dn,
    };
  } catch (err) {
    return classifyLdapError(err);
  } finally {
    try {
      await client.unbind();
    } catch {
      // Ignore unbind errors — connection teardown must not mask auth outcome.
    }
  }
}

export function createLdapClient(config: LdapConfig): Client {
  const tlsOptions = buildTlsOptions(config);
  return new Client({
    url: config.url,
    timeout: config.connectTimeoutMs,
    connectTimeout: config.connectTimeoutMs,
    ...(tlsOptions ? { tlsOptions } : {}),
  });
}

function buildTlsOptions(config: LdapConfig): ConnectionOptions | undefined {
  if (!config.url.startsWith("ldaps://") && !config.tlsCa) {
    // Plain ldap:// without custom CA — no tlsOptions.
    // Prefer ldaps://:636 per infra brief when Infra provides it.
    return config.tlsRejectUnauthorized === false
      ? { rejectUnauthorized: false, minVersion: "TLSv1.2" }
      : undefined;
  }

  const opts: ConnectionOptions = {
    rejectUnauthorized: config.tlsRejectUnauthorized,
    minVersion: "TLSv1.2",
  };

  if (config.tlsCa) {
    opts.ca = loadCa(config.tlsCa);
  }

  return opts;
}

function loadCa(ca: string): string | Buffer {
  // Inline PEM or filesystem path (Infra provides).
  if (ca.includes("-----BEGIN")) {
    return ca;
  }
  return readFileSync(ca);
}

/**
 * Escape LDAP filter special characters per RFC 4515.
 */
export function escapeLdapFilterValue(value: string): string {
  return Array.from(value, (ch) =>
    ["\0", "*", "(", ")", "\\"].includes(ch)
      ? `\\${ch.charCodeAt(0).toString(16).padStart(2, "0")}`
      : ch,
  ).join("");
}

export function buildUserFilter(template: string, username: string): string {
  return template.replaceAll("{{username}}", escapeLdapFilterValue(username));
}

/**
 * Coerce an LDAP attribute to a stable string.
 * Binary values (e.g. AD objectGUID) are lowercase hex — never utf8.
 * Pre-provisioned `externalDirectoryId` values must use the same encoding.
 */
export function attrString(entry: Entry, name: string): string | null {
  const raw = entry[name];
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first === undefined || first === null) return null;
    return coerceAttrValue(first);
  }
  return coerceAttrValue(raw);
}

function coerceAttrValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  // ldapts may expose binary as Uint8Array
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("hex");
  }
  return String(value);
}

function isAccountBlocked(entry: Entry, config: LdapConfig): boolean {
  if (
    config.disabledAttr &&
    attrMatches(entry, config.disabledAttr, config.disabledValues)
  ) {
    return true;
  }
  if (
    config.lockedAttr &&
    attrMatches(entry, config.lockedAttr, config.lockedValues)
  ) {
    return true;
  }
  if (
    config.expiredAttr &&
    attrMatches(entry, config.expiredAttr, config.expiredValues)
  ) {
    return true;
  }
  return false;
}

function attrMatches(
  entry: Entry,
  attr: string,
  values: readonly string[],
): boolean {
  // ATTR without VALUES: ignore (do not treat any truthy as blocked).
  // Infra must supply both name and value list for account-state checks.
  if (values.length === 0) return false;
  const current = attrString(entry, attr);
  if (current === null) return false;
  const normalized = current.toLowerCase();
  return values.some((v) => v.toLowerCase() === normalized);
}

function classifyLdapError(
  err: unknown,
): Exclude<DirectoryVerifyResult, DirectoryVerifyOk> {
  // Invalid credentials on user bind → same code as bad password (no enumeration).
  if (isInvalidCredentialsError(err)) {
    return { kind: "invalid_credentials" };
  }
  // Connect/bind/search timeout, TLS failure, server down → unavailable.
  return { kind: "unavailable" };
}

function isInvalidCredentialsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: number | string; name?: string; message?: string };
  // LDAP invalidCredentials is result code 49.
  if (e.code === 49 || e.code === "49") return true;
  if (typeof e.name === "string" && /InvalidCredentials/i.test(e.name)) {
    return true;
  }
  if (typeof e.message === "string" && /invalid credentials/i.test(e.message)) {
    return true;
  }
  return false;
}
