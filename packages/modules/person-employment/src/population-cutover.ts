/**
 * PopulationPort cutover note (Story 3.1 / Epic 2 retro #4; updated Stories 3.5–3.9).
 *
 * OrgUnit projections exist (3.5). Primary Assignment read model +
 * `resolveTeamMembershipAsOf` exist (3.7). Secondary Assignment read helpers
 * (`listActiveSecondaryAssignmentsAsOf`, list-by-person/employment) exist (3.8).
 * Derived management APIs exist (3.9): `resolveTeamManagerAsOf`,
 * `listManagedPersonsAsOf`, `deriveManagementEdgesAsOf`, plus
 * `buildManagementRelationshipsFromDerivation` adapter (Person→AccountId
 * resolver injected — no permanent Person.accountId FK).
 *
 * **Honesty:** default `intersectPopulation` registry in identity-access is
 * still fixture-backed (`person:a1`, …). Derivation APIs live; full default
 * PopulationPort registry replacement remains open until Account↔Person link
 * policy (AR-IDENTITY) + event-backed wiring (4.x). Do **not** claim cutover
 * complete.
 *
 * Subject id target for the real port remains Person UUID (`Person.id`).
 *
 * Pipeline order (unchanged): authorize → PopulationPort → InferenceBulkPort
 * → access event → payload.
 *
 * Named cutover tracked in deferred-work.md — not "fixture forever".
 */

export const POPULATION_SUBJECT_ID_TARGET =
  "Person.id (UUID) — OrgUnit live (3.5); Primary Team membership helper live (3.7); Secondary read helpers live (3.8); management derive APIs + adapter live (3.9); default PopulationPort registry still fixture-backed pending AR-IDENTITY / 4.x";
