/**
 * Event origin classification for FR-39 Baseline provenance UX.
 *
 * AD-4 / FR-39: `provenance.source === "migration"` is **audit metadata only**.
 * It is never a substitute for cutover controls (approve / execute / staging /
 * SoD / evidence) and must not gate security or cutover authorization.
 */

/** PascalCase past-tense Baseline event introduced for migration cutover. */
export const BASELINE_RECORDED_EVENT_TYPE = "BaselineRecorded";

export type EventOrigin = "baseline" | "imported" | "native";

/**
 * Documented shape of migration cutover provenance (audit metadata).
 * Append callers may still use `Record<string, unknown>`; this alias is
 * for docs/selfcheck — not a hard rewrite of the append input type.
 */
export type MigrationProvenance = {
  source: "migration";
  batchId?: string;
  previewBatchId?: string;
  templateKey?: string;
  sourceRow?: number | string;
};

/** True when provenance.source is the string `"migration"` (string-safe). */
export function isMigrationProvenance(
  provenance: Record<string, unknown> | null | undefined,
): boolean {
  if (!provenance || typeof provenance !== "object") return false;
  const source = provenance.source;
  return typeof source === "string" && source.trim() === "migration";
}

/**
 * Product origin taxonomy:
 * - baseline = BaselineRecorded (approved migrated starting state)
 * - imported = migration provenance and not BaselineRecorded
 * - native = everything else (including lifecycle with non-migration sources)
 */
export function classifyEventOrigin(input: {
  eventType: string;
  provenance?: Record<string, unknown> | null;
}): EventOrigin {
  if (input.eventType === BASELINE_RECORDED_EVENT_TYPE) {
    return "baseline";
  }
  if (isMigrationProvenance(input.provenance)) {
    return "imported";
  }
  return "native";
}
