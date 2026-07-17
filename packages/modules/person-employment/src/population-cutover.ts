/**
 * PopulationPort cutover note (Story 3.1 / Epic 2 retro #4; updated Story 3.5).
 *
 * OrgUnit projections now exist (Story 3.5). Fixture subject ids (`person:a1`, …)
 * remain until Assignment projections exist (Stories 3.7+ / 4.x). The **subject
 * id target** for the real port is still the Person UUID (`Person.id`).
 *
 * Do not claim PopulationPort cutover complete — Assignment membership is the
 * remaining gate. Do not invent a parallel population checker in this module.
 *
 * Pipeline order (unchanged): authorize → PopulationPort → InferenceBulkPort
 * → access event → payload.
 *
 * Named cutover tracked in deferred-work.md — not "fixture forever".
 */

export const POPULATION_SUBJECT_ID_TARGET =
  "Person.id (UUID) — OrgUnit live (3.5); replace fixture person:* when Assignment projections land (3.7+/4.x)";
