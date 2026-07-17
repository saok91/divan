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

## Story 3.3 — Data-Dictionary-governed profile fields (FR-7)

**Persistence (MVP):** Prisma `DataElement` table with typed metadata columns.
Enablement always goes through `enableDataElement` — spreadsheet/addendum
presence alone never enables a field.

```
enable(element) ⇔ disposition=approve ∧ metadataComplete ∧ not reject
dictionaryEnabled (listEnabledProfileFields) ⇔ enabled ∧ approve ∧ Person-mapped
appearOnProfile (values / DOM) ⇔ dictionaryEnabled ∧ actor authorized for
  access/category → otherwise OMIT key (API) / omit from DOM (UI)
```

`listEnabledProfileFields` is the **dictionary enablement** list only. Category /
permission omit for profile values is applied by `projectPersonRecord` /
`omitUnauthorizedCategories` (callers must not render keys omitted from the
projection). Per-actor grant filtering inside `listEnabledProfileFields` is
reserved for a later story when grant resolution is wired end-to-end.

`seedDataDictionary` syncs disposition/metadata from the AR-DATA seed; it
enables approve rows on **create** only and preserves operator `enabled` on
re-seed (later/reject stay force-disabled).

Public APIs:

- `seedDataDictionary` / `listDataElements` / `getDataElement`
- `enableDataElement` — rejects later, reject, incomplete metadata
- `listEnabledProfileFields` / `assertFieldEnabled` / `assertPersonFieldEnabled`
- `projectPersonRecord` / `projectPersonForRead` — dictionary gate + category omit
- `normalizeIranianMobilePhone` — dictionary format rule for mobile
- `assertFreeTextAllowed` / `assertDerivedSensitivityAllowed` — AC #3 helpers

MVP approve values stay on **Person columns** (not EAV). Disposition `approve`
for National ID ≠ enabling production `identity.national_id` category (FR-3).

Historical Employment / Assignment / compensation facts are **not** rewritten by
Person identity updates — those require Epic 4 temporal events (AD-2).

### Selfchecks

```bash
pnpm selfcheck:person-identity
pnpm selfcheck:employment-lifecycle
pnpm selfcheck:data-dictionary
```
