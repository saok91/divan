/**
 * Canonical sorted-key stringify + SHA-256 (Story 7.8 / FR-56).
 * Single hash path shared with export/publication — never a second algorithm.
 */

import { createHash } from "node:crypto";

/**
 * Deterministic JSON-like stringify with sorted object keys.
 * Lifted from reporting computeExportSnapshotHash spirit — keep identical
 * so export/publication fingerprints stay stable across modules.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/** SHA-256 hex fingerprint over canonical stableStringify(payload). */
export function computeContentFingerprint(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
