/**
 * Data Dictionary registry APIs (Story 3.3 / FR-7).
 *
 * Persistence: Prisma `DataElement` table (typed columns). Enablement always
 * goes through domain APIs that enforce metadata completeness — never
 * scattered hardcodes or spreadsheet presence alone.
 *
 * AD-2: Dictionary does not replace event history. Person identity/contact
 * master-data updates are allowed only when they do not rewrite historical
 * Employment / Assignment / compensation effective-dated facts — those go
 * through Epic 4 temporal events only. No silent “edit history cell” path.
 */

import type { PrismaClient } from "@divan/db";
import { parseLifecycleClass } from "@divan/audit-envelope";

import { getPersonDb } from "./db";
import {
  DATA_DICTIONARY_REGISTRY_VERSION,
  DATA_ELEMENT_MANDATORY_METADATA,
  DATA_ELEMENT_SEED,
  ELEMENT_TO_PERSON_FIELD,
  PERSON_FIELD_TO_ELEMENT,
  bindDataDictionaryRegistryVersion,
  type DataElementDisposition,
  type DataElementMandatoryMetaKey,
  type DataElementRecord,
  type PersonProfileFieldKey,
  type SeedDataElementDef,
} from "./data-dictionary-types";
import {
  DataDictionaryError,
  MSG_DATA_ELEMENT_ENABLE_INCOMPLETE_FA,
  MSG_DATA_ELEMENT_ENABLE_LATER_FA,
  MSG_DATA_ELEMENT_ENABLE_REJECT_FA,
  MSG_DATA_ELEMENT_NOT_FOUND_FA,
  MSG_DERIVED_SENSITIVITY_DOWNGRADE_FA,
  MSG_FIELD_NOT_ENABLED_FA,
  MSG_FREE_TEXT_PURPOSE_REQUIRED_FA,
  PersonIdentityError,
} from "./errors";

export {
  DATA_DICTIONARY_REGISTRY_VERSION,
  DATA_ELEMENT_MANDATORY_METADATA,
  DATA_ELEMENT_SEED,
  ELEMENT_ID,
  ELEMENT_TO_PERSON_FIELD,
  PERSON_FIELD_CATEGORY,
  PERSON_FIELD_TO_ELEMENT,
  bindDataDictionaryRegistryVersion,
} from "./data-dictionary-types";

export type {
  DataElementDisposition,
  DataElementMandatoryMetaKey,
  DataElementRecord,
  PersonProfileFieldKey,
  SeedDataElementDef,
} from "./data-dictionary-types";

function mapRow(row: {
  elementId: string;
  disposition: string;
  enabled: boolean;
  purpose: string | null;
  ownerSource: string | null;
  format: string | null;
  sensitivity: string | null;
  access: string | null;
  retention: string | null;
  export: string | null;
  audit: string | null;
  categoryId: string | null;
  freeTextPurpose: string | null;
  lineage: string | null;
  personFieldKey: string | null;
  labelFa: string;
  registryVersion: string;
}): DataElementRecord {
  return {
    elementId: row.elementId,
    disposition: row.disposition as DataElementDisposition,
    enabled: row.enabled,
    purpose: row.purpose,
    ownerSource: row.ownerSource,
    format: row.format,
    sensitivity: row.sensitivity,
    access: row.access,
    retention: row.retention,
    export: row.export,
    audit: row.audit,
    categoryId: row.categoryId,
    freeTextPurpose: row.freeTextPurpose,
    lineage: row.lineage,
    personFieldKey: row.personFieldKey,
    labelFa: row.labelFa,
    registryVersion: row.registryVersion,
  };
}

export function isMetadataComplete(
  el: Pick<DataElementRecord, DataElementMandatoryMetaKey>,
): boolean {
  for (const key of DATA_ELEMENT_MANDATORY_METADATA) {
    const v = el[key];
    if (typeof v !== "string" || v.trim().length === 0) return false;
  }
  // Story 7.3: retention must parse to a known provisional lifecycle class.
  if (!parseLifecycleClass(el.retention)) return false;
  return true;
}

/**
 * True when retention metadata is a known provisional class (or mapped seed blurb).
 * Free-text blurbs alone are insufficient for disposal enforcement.
 */
export function isRetentionLifecycleClassComplete(
  retention: string | null | undefined,
): boolean {
  return parseLifecycleClass(retention) !== null;
}

/**
 * Free-text invariant (AC #3): purpose-limited + access-controlled.
 * Reject unbounded free text without freeTextPurpose.
 */
export function assertFreeTextAllowed(el: {
  freeTextPurpose: string | null | undefined;
  access: string | null | undefined;
}): void {
  if (
    !el.freeTextPurpose ||
    el.freeTextPurpose.trim().length === 0 ||
    !el.access ||
    el.access.trim().length === 0
  ) {
    throw new DataDictionaryError(
      "FREE_TEXT_PURPOSE_REQUIRED",
      MSG_FREE_TEXT_PURPOSE_REQUIRED_FA,
    );
  }
}

/**
 * Derived-element invariant (AC #3): retain lineage; cannot classify below
 * most sensitive input without explicit assessment flag.
 * Stub for 3.4+ hooks — no derived elements in MVP seed.
 */
export function assertDerivedSensitivityAllowed(input: {
  lineage: string | null | undefined;
  outputSensitivity: string;
  inputSensitivities: readonly string[];
  assessmentRecorded?: boolean;
}): void {
  if (!input.lineage || input.lineage.trim().length === 0) {
    throw new DataDictionaryError(
      "DERIVED_SENSITIVITY_DOWNGRADE",
      MSG_DERIVED_SENSITIVITY_DOWNGRADE_FA,
      "Derived element requires lineage",
    );
  }
  const rank = (s: string): number => {
    const n = s.trim().toLowerCase();
    if (n === "sensitive" || n === "high") return 2;
    if (n === "ordinary" || n === "low") return 0;
    return 1;
  };
  const maxInput = Math.max(0, ...input.inputSensitivities.map(rank));
  if (rank(input.outputSensitivity) < maxInput && !input.assessmentRecorded) {
    throw new DataDictionaryError(
      "DERIVED_SENSITIVITY_DOWNGRADE",
      MSG_DERIVED_SENSITIVITY_DOWNGRADE_FA,
    );
  }
}

export async function getDataElement(
  elementId: string,
  db: PrismaClient = getPersonDb(),
): Promise<DataElementRecord | null> {
  const row = await db.dataElement.findUnique({ where: { elementId } });
  return row ? mapRow(row) : null;
}

export async function listDataElements(
  db: PrismaClient = getPersonDb(),
  opts?: {
    arDataControllingVersionLabel?: string | null;
    enforceArDataBinding?: boolean;
  },
): Promise<DataElementRecord[]> {
  const rows = await db.dataElement.findMany({
    orderBy: { elementId: "asc" },
  });
  const boundVersion = bindDataDictionaryRegistryVersion(
    opts?.arDataControllingVersionLabel,
    { enforce: opts?.enforceArDataBinding === true },
  );
  return rows.map((row) => {
    const mapped = mapRow(row);
    if (opts?.arDataControllingVersionLabel != null || opts?.enforceArDataBinding) {
      return { ...mapped, registryVersion: boundVersion };
    }
    return mapped;
  });
}

/**
 * Enable only when disposition=approve AND mandatory metadata complete.
 * reject → fail-closed; later → fail-closed until disposition promoted.
 */
export async function enableDataElement(
  elementId: string,
  db: PrismaClient = getPersonDb(),
): Promise<DataElementRecord> {
  const row = await db.dataElement.findUnique({ where: { elementId } });
  if (!row) {
    throw new DataDictionaryError(
      "ELEMENT_NOT_FOUND",
      MSG_DATA_ELEMENT_NOT_FOUND_FA,
    );
  }
  const el = mapRow(row);

  if (el.disposition === "reject") {
    throw new DataDictionaryError(
      "REJECT_DISPOSITION",
      MSG_DATA_ELEMENT_ENABLE_REJECT_FA,
    );
  }
  if (el.disposition !== "approve") {
    throw new DataDictionaryError(
      "ENABLE_REJECTED",
      MSG_DATA_ELEMENT_ENABLE_LATER_FA,
    );
  }
  if (!isMetadataComplete(el)) {
    throw new DataDictionaryError(
      "METADATA_INCOMPLETE",
      MSG_DATA_ELEMENT_ENABLE_INCOMPLETE_FA,
    );
  }

  const updated = await db.dataElement.update({
    where: { elementId },
    data: { enabled: true },
  });
  return mapRow(updated);
}

export async function assertFieldEnabled(
  elementId: string,
  db: PrismaClient = getPersonDb(),
): Promise<DataElementRecord> {
  const el = await getDataElement(elementId, db);
  if (
    !el ||
    !el.enabled ||
    el.disposition !== "approve" ||
    !isMetadataComplete(el)
  ) {
    throw new PersonIdentityError(
      "FIELD_NOT_ENABLED",
      MSG_FIELD_NOT_ENABLED_FA,
    );
  }
  return el;
}

export type EnabledProfileField = {
  elementId: string;
  personFieldKey: PersonProfileFieldKey;
  labelFa: string;
  categoryId: string | null;
  format: string | null;
  sensitivity: string | null;
};

/**
 * Dictionary enablement gate: enabled + approve + Person-mapped fields.
 *
 * This is **not** the full `appearOnProfile` predicate. Actor category /
 * permission omit is applied by callers via `projectPersonRecord` /
 * `omitUnauthorizedCategories` (and UI must not render keys omitted from the
 * projection). `_actorCtx` is reserved for a future grant-aware filter; MVP
 * does not resolve per-actor category grants here.
 */
export async function listEnabledProfileFields(
  _actorCtx?: { accountId: string },
  db: PrismaClient = getPersonDb(),
): Promise<EnabledProfileField[]> {
  const rows = await db.dataElement.findMany({
    where: { enabled: true, disposition: "approve" },
    orderBy: { elementId: "asc" },
  });
  const out: EnabledProfileField[] = [];
  for (const row of rows) {
    const fieldKey =
      (row.personFieldKey as PersonProfileFieldKey | null) ??
      ELEMENT_TO_PERSON_FIELD[row.elementId];
    if (!fieldKey) continue;
    out.push({
      elementId: row.elementId,
      personFieldKey: fieldKey,
      labelFa: row.labelFa,
      categoryId: row.categoryId,
      format: row.format,
      sensitivity: row.sensitivity,
    });
  }
  return out;
}

/** Set of enabled Person field keys (for write/read gating). */
export async function getEnabledPersonFieldKeys(
  db: PrismaClient = getPersonDb(),
): Promise<Set<PersonProfileFieldKey>> {
  const fields = await listEnabledProfileFields(undefined, db);
  return new Set(fields.map((f) => f.personFieldKey));
}

export async function assertPersonFieldEnabled(
  fieldKey: PersonProfileFieldKey,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const elementId = PERSON_FIELD_TO_ELEMENT[fieldKey];
  await assertFieldEnabled(elementId, db);
}

function seedRowData(
  def: SeedDataElementDef,
  registryVersion: string = DATA_DICTIONARY_REGISTRY_VERSION,
) {
  const meta = def.metadata;
  return {
    elementId: def.elementId,
    disposition: def.disposition,
    enabled: false,
    purpose: meta?.purpose ?? null,
    ownerSource: meta?.ownerSource ?? null,
    format: meta?.format ?? null,
    sensitivity: meta?.sensitivity ?? null,
    access: meta?.access ?? null,
    retention: meta?.retention ?? null,
    export: meta?.export ?? null,
    audit: meta?.audit ?? null,
    categoryId: def.categoryId ?? null,
    freeTextPurpose: def.freeTextPurpose ?? null,
    lineage: def.lineage ?? null,
    personFieldKey: def.personFieldKey ?? null,
    labelFa: def.labelFa,
    registryVersion,
  };
}

/**
 * Upsert disposition catalogue from AR-DATA partial freeze.
 * Idempotent. Spreadsheet presence alone never enables.
 *
 * - **Create:** approve + complete metadata → `enableDataElement`.
 * - **Update:** sync disposition/metadata from seed; preserve existing
 *   `enabled` for approve rows (operator disable stays durable). later/reject
 *   always forced `enabled=false`.
 *
 * Story 7.7: `arDataControllingVersionLabel` binds registryVersion via
 * `bindDataDictionaryRegistryVersion` when register-backed AR-DATA is known.
 */
export async function seedDataDictionary(
  db: PrismaClient = getPersonDb(),
  opts?: {
    arDataControllingVersionLabel?: string | null;
    enforceArDataBinding?: boolean;
  },
): Promise<{ seeded: number; enabled: number }> {
  let seeded = 0;
  let enabled = 0;

  const registryVersion = bindDataDictionaryRegistryVersion(
    opts?.arDataControllingVersionLabel,
    { enforce: opts?.enforceArDataBinding === true },
  );

  for (const def of DATA_ELEMENT_SEED) {
    const data = seedRowData(def, registryVersion);
    const existing = await db.dataElement.findUnique({
      where: { elementId: def.elementId },
    });

    if (!existing) {
      await db.dataElement.create({ data });
      seeded += 1;
      if (def.disposition === "approve" && def.metadata) {
        const el = await enableDataElement(def.elementId, db);
        if (el.enabled) enabled += 1;
      }
      continue;
    }

    await db.dataElement.update({
      where: { elementId: def.elementId },
      data: {
        disposition: data.disposition,
        purpose: data.purpose,
        ownerSource: data.ownerSource,
        format: data.format,
        sensitivity: data.sensitivity,
        access: data.access,
        retention: data.retention,
        export: data.export,
        audit: data.audit,
        categoryId: data.categoryId,
        freeTextPurpose: data.freeTextPurpose,
        lineage: data.lineage,
        personFieldKey: data.personFieldKey,
        labelFa: data.labelFa,
        registryVersion: data.registryVersion,
      },
    });
    seeded += 1;

    if (def.disposition !== "approve") {
      await db.dataElement.update({
        where: { elementId: def.elementId },
        data: { enabled: false },
      });
    } else if (existing.enabled) {
      enabled += 1;
    }
  }

  return { seeded, enabled };
}
