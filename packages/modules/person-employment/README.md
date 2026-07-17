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

## Story 3.2 — Employment lifecycle invariants

Projection writers (seed / Epic 4 refresh — **not** HR product verbs):

- `applyEmploymentProjection` — create/update after non-overlap + interval checks
- `closeEmploymentProjection` — close an open interval (simulates Termination effect)
- `listEmploymentsForPerson` / `getEmploymentById` / `getActiveEmploymentAsOf`

**Do not** export `createEmployment` / `startEmployment` / `terminateEmployment`.
Start / Return / Termination user flows and event append = Stories 4.5–4.6.

Half-open `[startDate, endDateExclusive)`; null end = unbounded open.
Non-overlap: domain + PostgreSQL `EXCLUDE` (`btree_gist` + `daterange`).
Concurrent multi-active Employment exceptions: **fail closed** until AR-DATA.

### Epic 4 minimum facts (Employment + Primary Assignment)

| Fact | Owner story | Notes |
| --- | --- | --- |
| Stable Person + Personnel Code | 3.1 | Required |
| Employment start date (date-only) | 3.2 | Required |
| Collaboration / approved employment status | 3.2 lean / AR-DATA | Required for Start; exact codes AR-DATA |
| Legal Entity → … → Team (Primary org) | 3.5 | Required at finalization |
| Exactly one active Primary Assignment | 3.7 + Epic 4 | Required; mutations only via events |
| Headcount capacity / Override | Epic 4 / FR-20 | Not this story |

Also exported as `EMPLOYMENT_MINIMUM_FACTS` from `employment-minimum-facts.ts`.

### Continuity (FR-5)

`Employment.personId` → `Person.id` uses `onDelete: Restrict`.
`closeEmploymentProjection` never deletes Person. Ending Employment preserves
Person and permitted history.

### PopulationPort cutover

Fixture ids (`person:a1`, …) remain in `@divan/identity-access` until
Assignment / Org projections (3.5–3.9 / 4.x). **Target subject id = Person UUID.**
See `population-cutover.ts` and `deferred-work.md`.

### Selfchecks

```bash
pnpm selfcheck:person-identity
pnpm selfcheck:employment-lifecycle
```
