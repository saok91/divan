/**
 * Pure helpers for permission-safe personnel search (Story 5.1).
 * Kept free of Next/tRPC so selfcheck can assert without app bootstrap.
 */

import { isPersonUuid } from "@divan/person-employment";
import type { PopulationFixtureRegistry } from "@divan/identity-access";

export const POPULATION_FIXTURE_DISCLOSURE_FA =
  "محدودهٔ جمعیت فعلاً fixture است — تا cutover رجیستری UUID واقعی، فهرست/جستجو خالی (fail-closed) است؛ نه احراز هویت نیروی کار تولیدی.";

/**
 * Honest disclosure when local/dev opts into provisional Person-UUID population.
 * Not AR-IDENTITY cutover — never claim production workforce authz.
 */
export const POPULATION_DEV_UUID_DISCLOSURE_FA =
  "رجیستری موقت توسعه (Person UUID + org:selfcheck) — فقط با ALLOW_DEV_POPULATION_UUID_REGISTRY؛ cutover تولید نیست.";

export type PopulationAuthzMode =
  | "fixture-fail-closed"
  | "uuid-registry";

export function registryUsesFixtureSubjects(
  registry: PopulationFixtureRegistry,
): boolean {
  if (registry.subjects.length === 0) return true;
  return registry.subjects.some((s) => !isPersonUuid(s.id));
}

/** Empty registry used while default PopulationPort stays fixture-backed. */
export function emptyFailClosedPopulationRegistry(): PopulationFixtureRegistry {
  return {
    subjects: [],
    relationships: [],
    crossTimeGrants: [],
    facts: [],
  };
}

export function personnelProfileHref(personId: string): string {
  return `/personnel/profile/${encodeURIComponent(personId)}`;
}
