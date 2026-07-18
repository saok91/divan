/**
 * PopulationPort cutover note (Story 3.1 / Epic 2 retro #4; updated Stories 3.5–3.9 / 4.1).
 *
 * OrgUnit projections exist (3.5). Primary Assignment read model +
 * `resolveTeamMembershipAsOf` exist (3.7). Secondary Assignment read helpers
 * (`listActiveSecondaryAssignmentsAsOf`, list-by-person/employment) exist (3.8).
 * Derived management APIs exist (3.9): `resolveTeamManagerAsOf`,
 * `listManagedPersonsAsOf`, `deriveManagementEdgesAsOf`, plus
 * `buildManagementRelationshipsFromDerivation` adapter (Person→AccountId
 * resolver injected — no permanent Person.accountId FK).
 *
 * Story 4.1 lands attributable business event store substrate only — does **not**
 * execute PopulationPort default-registry cutover.
 *
 * Story 4.9 lands `getCurrentPersonState` (projection as-of assembler) — does **not**
 * switch default `intersectPopulation` registry or claim real-workforce PopulationPort.
 *
 * **Cutover criteria (all required before switching default registry):**
 * 1. Subject ids are Person UUIDs (`Person.id`) end-to-end for populations being authorized.
 * 2. Team membership edges come from Primary Assignment as-of helpers (3.7+), not `person:a1` fixtures.
 * 3. Management edges (if used) come from 3.9 derive/adapter with explicit Person→Account resolver.
 * 4. Account↔Person linking policy is AR-IDENTITY-approved **or** an explicitly documented
 *    provisional seed map scoped to demo — not a silent production FK.
 * 5. This file + `deferred-work.md` updated in the same change; selfcheck proves at least one
 *    non-fixture population path.
 * 6. Until then: keep fixtures; do **not** claim authz population is “real workforce.”
 *
 * **Honesty:** default `intersectPopulation` registry in identity-access is
 * still fixture-backed (`person:a1`, …). Derivation APIs live; full default
 * PopulationPort registry replacement remains open until Account↔Person link
 * policy (AR-IDENTITY) + event-backed wiring. Do **not** claim cutover complete.
 *
 * Subject id target for the real port remains Person UUID (`Person.id`).
 *
 * Pipeline order (unchanged): authorize → PopulationPort → InferenceBulkPort
 * → access event → payload.
 *
 * Named cutover tracked in deferred-work.md — not "fixture forever".
 */

export const POPULATION_SUBJECT_ID_TARGET =
  "Person.id (UUID) — OrgUnit live (3.5); Primary Team membership helper live (3.7); Secondary read helpers live (3.8); management derive APIs + adapter live (3.9); business event store attributable (4.1); current-state assembler live (4.9); default PopulationPort registry still fixture-backed pending AR-IDENTITY + cutover criteria";
