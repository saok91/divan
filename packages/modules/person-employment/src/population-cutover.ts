/**
 * PopulationPort cutover note (Story 3.1 / Epic 2 retro #4; updated Stories 3.5–3.8).
 *
 * OrgUnit projections exist (3.5). Primary Assignment read model +
 * `resolveTeamMembershipAsOf` exist (3.7). Secondary Assignment read helpers
 * (`listActiveSecondaryAssignmentsAsOf`, list-by-person/employment) exist (3.8).
 *
 * Fixture subject ids (`person:a1`, …) remain until management / event-backed
 * population wiring (3.9 / 4.x). Do **not** claim PopulationPort cutover
 * complete — Secondary helpers alone do not finish fixture replacement.
 *
 * Subject id target for the real port remains Person UUID (`Person.id`).
 *
 * Pipeline order (unchanged): authorize → PopulationPort → InferenceBulkPort
 * → access event → payload.
 *
 * Named cutover tracked in deferred-work.md — not "fixture forever".
 */

export const POPULATION_SUBJECT_ID_TARGET =
  "Person.id (UUID) — OrgUnit live (3.5); Primary Team membership helper live (3.7); Secondary read helpers live (3.8); full PopulationPort fixture cutover still 3.9/4.x";
