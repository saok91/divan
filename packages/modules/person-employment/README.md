# `@divan/person-employment`

Person / Employment domain module (AD-3).

## Story 3.1 — Person identity

Public APIs: `createPerson`, `updatePersonIdentity`, `getPersonById`,
`getPersonByPersonnelCode`, `listPersons`.

Blocked until AR-DATA / AR-MIGRATION: `correctPersonnelCode`, `mergePersons`,
`splitPerson`, `matchReturn` (fail-closed Persian explanation).

**Personnel Code** is the domain identifier (unique, Latin-digit canonical).
**Person.id** is a server-generated UUID — never use Personnel Code as PK.

`HumanIdentity` / `InternalAccount` are login projections — do not merge with
Person. Link policy is AR-IDENTITY.

### PopulationPort cutover

Fixture ids (`person:a1`, …) remain in `@divan/identity-access` until
Assignment / Org projections (3.5–3.9 / 4.x). **Target subject id = Person UUID.**
See `population-cutover.ts` and `deferred-work.md`.

Pipeline: authorize → PopulationPort → InferenceBulkPort → access event → payload.

### Continuity (AC #5)

No API deletes Person when Employment ends. Future Employment FKs must not
`onDelete: Cascade` onto Person.
