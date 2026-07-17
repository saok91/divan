/**
 * PopulationPort cutover note (Story 3.1 / Epic 2 retro #4).
 *
 * Fixture subject ids (`person:a1`, …) remain until Assignment / Org
 * projections exist (Stories 3.5–3.9 / 4.x). The **subject id target** for
 * the real port is the Person UUID (`Person.id`).
 *
 * Do not invent a parallel population checker in this module. Multi-subject
 * retrieval demos must use real Person UUIDs **or** stay on the fixture path
 * in `@divan/identity-access` `population-authz.ts`.
 *
 * Pipeline order (unchanged): authorize → PopulationPort → InferenceBulkPort
 * → access event → payload.
 *
 * Named cutover tracked in deferred-work.md — not "fixture forever".
 */

export const POPULATION_SUBJECT_ID_TARGET =
  "Person.id (UUID) — replace fixture person:* when Assignment/Org projections land";
