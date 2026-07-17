/**
 * Project Person records through Data Dictionary + category omit (Story 3.3).
 * Unauthorized / disabled fields → key absence (never mask).
 */

import {
  omitUnauthorizedCategories,
  type CategoryRegistry,
} from "@divan/audit-envelope";
import type { PrismaClient } from "@divan/db";

import {
  getEnabledPersonFieldKeys,
  PERSON_FIELD_CATEGORY,
  type PersonProfileFieldKey,
} from "./data-dictionary";
import { getPersonDb } from "./db";
import type { PersonRecord } from "./person";

const PROFILE_VALUE_KEYS: readonly PersonProfileFieldKey[] = [
  "personnelCode",
  "givenName",
  "familyName",
  "mobilePhone",
  "fatherName",
  "birthDate",
  "gender",
  "nationality",
  "nationalId",
];

export type ProjectPersonOptions = {
  /** Enabled Person field keys from dictionary. */
  enabledFields: ReadonlySet<PersonProfileFieldKey>;
  /** Categories the actor may read (must also be grantable in registry). */
  allowedCategories: ReadonlySet<string>;
  categories: CategoryRegistry;
};

/**
 * Omit disabled dictionary fields, then omit unauthorized categories.
 * Always drops internal-only keys that must never leak when gated.
 */
export function projectPersonRecord(
  person: PersonRecord,
  options: ProjectPersonOptions,
): Partial<PersonRecord> {
  const gated: Record<string, unknown> = {
    id: person.id,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };

  for (const key of PROFILE_VALUE_KEYS) {
    if (!options.enabledFields.has(key)) continue;
    gated[key] = person[key];
  }

  return omitUnauthorizedCategories(
    gated,
    PERSON_FIELD_CATEGORY,
    options.allowedCategories,
    options.categories,
  ) as Partial<PersonRecord>;
}

export async function projectPersonForRead(
  person: PersonRecord,
  options: {
    allowedCategories: ReadonlySet<string>;
    categories: CategoryRegistry;
  },
  db: PrismaClient = getPersonDb(),
): Promise<Partial<PersonRecord>> {
  const enabledFields = await getEnabledPersonFieldKeys(db);
  return projectPersonRecord(person, {
    enabledFields,
    allowedCategories: options.allowedCategories,
    categories: options.categories,
  });
}
