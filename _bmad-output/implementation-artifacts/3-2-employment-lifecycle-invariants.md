---
baseline_commit: ce31f55
---

# Story 3.2: Employment Lifecycle Invariants

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR user,
I want Employment periods modeled with non-overlap and at most one active Employment per Person,
so that workforce periods stay temporally coherent once events create them (FR6).

## Gate (read first)

**Epic 3 ↔ Epic 4 sequencing remains inviolable.** This story ships **Employment projection schema + temporal invariants + seed/test writers** — **not** Start / Return / Termination user flows, **not** append of authoritative Personnel Events, and **not** a throwaway operator CRUD that Epic 4 must delete.

- **Allowed write path:** internal / seed / selfcheck **projection writers** in `@divan/person-employment` that enforce invariants and will be the same surface Epic 4 projection refresh calls later. Prefer names like `applyEmploymentProjection` / `assertEmploymentIntervals` — never “createEmployment for HR UI.”
- **Forbidden:** tRPC or UI that lets operators Start/Return/Terminate Employment; temporary CRUD that mutates Employment/Assignment/compensation *as product truth*; inventing concurrent-Employment exceptions (AR-DATA open → **fail closed**).
- **FR-5 continuity:** Employment → Person FK must use `onDelete: Restrict` (or equivalent). Ending Employment **never** cascade-deletes Person. Extend `assertPersonSurvivesEmploymentEnd` to assert schema + API contract once Employment exists.
- **AD-2:** Employment rows are **projections**, not the authoritative source of truth. Do not treat projection upsert as a substitute for event-store append (Story 4.1+).
- **Reuse:** `@divan/temporal-engine` (`parseDateOnly`, `dateOnlyInInterval`, `intervalsOverlap`, Asia/Tehran date-only, **exclusive interval ends**). Do not fork a second date/interval library.
- **Primary Assignment / Org FKs:** not required as live columns in 3.2 (Stories 3.5 / 3.7). Document the **minimum facts checklist** for Epic 4 finalization — do not invent incomplete Legal Entity / Team / Assignment tables here.
- Layout ≠ RSC / UI ≠ data access / default-deny / no client import of module internals remain intact. **No new personnel mutation UI required for this story.**

[Source: `epics.md` Epic 3 sequencing + Story 3.2; `prd.md` FR-5/FR-6; SPEC-divan AR-TEMPORAL partial freeze; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-6; Story 3.1 Gate]

## Acceptance Criteria

1. **Given** the person-employment module schema and invariants  
   **When** Employment records exist (seeded for tests, projected after Epic 4 events, or migrated later)  
   **Then** overlapping Employments for the same Person are rejected by domain constraints (and preferably a DB exclusion constraint)

2. **And** MVP enforces at most one active Employment per Person at any evaluated instant (half-open `[start, endExclusive)`; null end = unbounded open)

3. **And** ending an Employment (when performed via Epic 4 Termination — simulated in selfcheck by closing an interval) preserves the Person and permitted history (FR5 continuity — no cascade delete)

4. **And** this story does **not** implement Start/Return/Termination user flows or append authoritative Employment-creating events — those are Stories 4.5–4.6

5. **And** approved minimum facts required for a valid Employment + Primary Assignment pair are documented as invariants for Epic 4 finalization checks (module README or `employment-invariants.ts` comment block)

## Tasks / Subtasks

- [x] Task 1: Employment projection schema in `@divan/db` (AC: #1, #2, #3)
  - [x] Add Prisma `Employment` model owned by person-employment semantics:
    - `id` — `String @id @default(uuid(7))` (same UUID v7 pattern as Person — **not** Personnel Code)
    - `personId` — FK → `Person.id` with **`onDelete: Restrict`** (never `Cascade`; never `SetNull` that orphans silently without explicit policy)
    - `startDate` — `DateTime @db.Date` (date-only Effective interval start, inclusive)
    - `endDateExclusive` — `DateTime? @db.Date` (exclusive end per AR-TEMPORAL; `null` = still open / active unbounded)
    - Optional lean attributes allowed without inventing org modules: e.g. `collaborationType` `String?`, `terminationReason` `String?` (only meaningful when closed) — **do not** add Legal Entity / Team / Assignment FKs yet
    - `createdAt` / `updatedAt` timestamps
    - Relation on `Person`: `employments Employment[]`
  - [x] Update schema header comment: Person + Employment projections (3.1–3.2); Assignment / event-store ownership still Epic 3.7+ / Epic 4
  - [x] Migration SQL: prefer PostgreSQL **`daterange` + `EXCLUDE USING gist (person_id WITH =, effective_range WITH &&)`** via `btree_gist` for concurrency-safe non-overlap (NFR-4). Prisma cannot express EXCLUDE — add raw SQL in migration after `CREATE TABLE`. Document fallback if extension unavailable in local Docker (domain check still mandatory).
  - [x] Half-open mapping: store `daterange(startDate, endDateExclusive, '[)')`; open end → `daterange(start, NULL, '[)')`
  - [x] Empty optional rule: strip `""` / sentinel strings → `null` (reuse Person normalize helpers)

- [x] Task 2: Domain invariants + projection API in `@divan/person-employment` (AC: #1–#5)
  - [x] Pure validators using `@divan/temporal-engine`:
    - `assertValidEmploymentInterval(start, endExclusive)` — parseDateOnly; reject end ≤ start; reject timestamp-shaped strings
    - `assertNoOverlapWithExisting(personId, start, endExclusive, excludeId?)` — use `intervalsOverlap` against sibling rows
    - `isEmploymentActiveAsOf(employment, asOfDate)` — `dateOnlyInInterval`
    - `assertAtMostOneActiveAsOf(personId, asOfDate)` — derive from non-overlap + open intervals (selfcheck must prove)
  - [x] `applyEmploymentProjection(input)` — **internal/seed/Epic-4-ready** writer: validates invariants, upserts projection, maps unique/exclusion violations to typed domain errors (`OverlappingEmployment`, `InvalidEmploymentInterval`, `EmploymentNotFound`, `ConcurrentEmploymentForbidden`)
  - [x] `closeEmploymentProjection(id, endDateExclusive)` — closes open interval only (simulates Termination effect for tests); **does not** delete Person; **does not** append events
  - [x] Reads: `listEmploymentsForPerson`, `getEmploymentById`, `getActiveEmploymentAsOf(personId, asOf)`
  - [x] **Do not** export operator-facing `createEmployment` / `startEmployment` / `terminateEmployment` product verbs that imply event authority
  - [x] Harden `assertPersonSurvivesEmploymentEnd`: after close, Person still readable; no `deletePerson` / cascade path; document FK Restrict
  - [x] Export public types from `src/index.ts` only
  - [x] Document Epic 4 minimum-facts checklist (AC #5) in README or `employment-minimum-facts.ts`:
    | Fact | Owner story | Notes |
    | --- | --- | --- |
    | Stable Person + Personnel Code | 3.1 | Required |
    | Employment start date (date-only) | 3.2 | Required |
    | Collaboration / approved employment status | 3.2 lean / AR-DATA | Required for Start; exact codes AR-DATA |
    | Legal Entity → … → Team (Primary org) | 3.5 | Required at finalization |
    | Exactly one active Primary Assignment | 3.7 + Epic 4 | Required; mutations only via events |
    | Headcount capacity / Override | Epic 4 / FR-20 | Not this story |
  - [x] Concurrent multi-active Employment exceptions: **fail closed** with Persian message until AR-DATA — no second open interval

- [x] Task 3: Authz / tRPC surface — read-only or none (AC: #4)
  - [x] **Default:** no new operator mutation procedures. Optional thin governed **read** (`employment.listForPerson` / `employment.activeAsOf`) behind `person.read` (or `employment.read` if seeding a new code into existing hr PermissionSets) — only if useful for continuity smoke; otherwise module selfcheck alone is enough
  - [x] If read tRPC added: `governedProcedure` + envelope meta; Persian deny copy; no client Prisma
  - [x] **Forbidden:** Start/Return/Termination procedures or UI forms

- [x] Task 4: Seed + selfcheck + deferred-work (AC: #1–#5)
  - [x] Seed ≥2 Employments for demo Person `10001` (or new persons): one **closed** historical interval + one **open** active — adjacent half-open (endExclusive of first === start of second) must succeed; overlapping must fail in selfcheck
  - [x] `employment-lifecycle.selfcheck.ts` + root/package script `selfcheck:employment-lifecycle`
  - [x] Cases in Testing table below
  - [x] Update `deferred-work.md`: Employment projection + invariants landed; Start/Return/Termination = 4.5–4.6; concurrent-Employment exceptions still AR-DATA; Primary Assignment integrity = 3.7; PopulationPort cutover still waits on org/assignment
  - [x] Preserve prior selfchecks green (`person-identity`, audit-envelope, inference-bulk as applicable)
  - [x] `pnpm` typecheck: `@divan/person-employment`, `@divan/db`, `@divan/temporal-engine` (+ web if tRPC touched)
  - [x] **When marking done:** sync story-file `Status: done` with `sprint-status.yaml` key `3-2-employment-lifecycle-invariants`

### Review Findings

- [x] [Review][Patch] `closeEmploymentProjection` rejects empty/whitespace end — empty string currently normalizes to open `null`, then `dateOnlyToDb(null!)` writes Invalid Date [`employment.ts` / `employment-invariants.ts`]
- [x] [Review][Patch] Invalid `asOf` must throw domain error — `isEmploymentActiveAsOf` / `getActiveEmploymentAsOf` currently return false/null and hide bad dates [`employment-invariants.ts:100-101`]
- [x] [Review][Patch] Concurrent `closeEmploymentProjection` last-writer-wins — use conditional update (`endDateExclusive: null`) so second close fails as already-closed [`employment.ts:237-242`]
- [x] [Review][Patch] Wrap lean-field sentinel normalization as `EmploymentError` (`SENTINEL_VALUE`) instead of leaking `PersonIdentityError` [`employment.ts:132-137`]
- [x] [Review][Patch] Selfcheck must prove `ON DELETE RESTRICT` — attempt `person.delete` while Employment rows exist and expect FK failure [`employment-lifecycle.selfcheck.ts`]
- [x] [Review][Patch] `seedDemoEmployments` must not treat any `length >= 2` as success — validate adjacent closed+open seed shape (or repair) [`seed.ts:126-130`]
- [x] [Review][Patch] Use `MSG_CONCURRENT_EMPLOYMENT_FORBIDDEN_FA` in `assertAtMostOneActiveAsOf` (stop hardcoding Persian) [`employment-invariants.ts:121-124`]
- [x] [Review][Patch] Trim `start` in `assertValidEmploymentInterval` like `end` [`employment-invariants.ts:31-38`]
- [x] [Review][Patch] Map mid-flight missing-Person FK on create/update to `PERSON_NOT_FOUND` [`employment.ts:170-200`]
- [x] [Review][Defer] Domain check-then-act race maps concurrent second-open to `OVERLAPPING_EMPLOYMENT` via `23P01` — deferred, pre-existing concurrency design (EXCLUDE is NFR-4 backstop)
- [x] [Review][Defer] `dateOnlyFromDb` via `toISOString().slice(0,10)` — deferred, pre-existing (same Person 3.1 DATE mapping pattern)
- [x] [Review][Defer] No DB `CHECK (endDateExclusive > startDate)` — deferred, pre-existing domain-only interval validation pattern
- [x] [Review][Defer] temporal-engine open-end sentinel `9999-12-31` vs PG unbounded `daterange` — deferred, pre-existing engine behavior

## Dev Notes

### Epic 2 / 3.1 carry-in

| Item | How 3.2 absorbs it |
| --- | --- |
| Epic 3↔4 no temporary CRUD | Gate + Task 2–3: projection writer + invariants only; no Start/Return/Terminate product API |
| Person UUID / FK | Employment.personId → Person.id; Restrict delete |
| Status ↔ sprint alignment | Task 4 DoD on done transition |
| AR numbers fail-closed | Concurrent Employment exceptions blocked |
| PopulationPort fixtures | Unchanged — still waits 3.5–3.9 / 4.x |
| 3.1 review patches | Reuse digit/sentinel normalize; typed error codes (not Persian substring matching) for any UI that surfaces overlap errors later |

### Epic context

- **Epic 3:** Workforce Master Data & Organization — FR5–FR13.
- **This story:** FR-6 — non-overlapping Employments; ≤1 active per Person at an instant; document minimum facts for Epic 4; preserve Person on end.
- **Upstream (done):** 3.1 Person identity; Epic 2 envelope/authz; temporal-engine date-only helpers (2.6).
- **Downstream:** 3.3 profile dictionary; 3.4 compensation store; 3.5–3.9 org/job/assignments; Epic 4 events (4.5 Start/Return, 4.6 Termination) write projections through these invariants.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Start / Return / Termination UI or event append | Stories 4.5–4.6 |
| Primary Assignment schema / exactly-one enforcement as live FK | Story 3.7 |
| Org hierarchy tables | Story 3.5 |
| Job reference concepts | Story 3.6 |
| Concurrent multi-Employment policy exceptions | AR-DATA |
| Personnel Code correction / merge / split / return-match | AR-DATA / AR-MIGRATION (still blocked) |
| Full profile / search / timeline UI | Epic 5 |
| Treating Employment projection as event-store | Forbidden (AD-2) |

### Architecture compliance

| Decision | Implication for 3.2 |
| --- | --- |
| AD-2 | Employment table = projection; writers prepare for Epic 4 refresh; no business-event append here |
| AD-3 | All Employment logic in `@divan/person-employment`; web uses published APIs only |
| AD-6 | Prisma for Employment projection; exclusion constraint via raw SQL migration; no `@prisma/client` in `apps/web` |
| AR-TEMPORAL freeze | Asia/Tehran; date-only; **exclusive ends**; reuse temporal-engine |
| NFR-4 | Prefer DB exclusion so concurrent overlapping inserts cannot both commit |

### Temporal / interval rules (must follow)

```
Active at as-of D  ⇔  startDate ≤ D < endDateExclusive
                      (if endDateExclusive is null, treat as +∞)

Overlap(A,B)       ⇔  intervalsOverlap(A.start, A.endEx, B.start, B.endEx)

Back-to-back OK    ⇔  A.endDateExclusive === B.startDate  (half-open; no shared active day)
```

Do **not** use closed-closed intervals or store end-inclusive dates without converting at the boundary.

### UX

- No new EXPERIENCE surface required. If optional read APIs are added, Persian errors only at boundary; no Start/Terminate forms on `/personnel`.
- Profile “current Employment / prior Employments” cards remain Epic 5 (UX-DR8).

### Library / stack

| Package | Pin / note |
| --- | --- |
| Prisma | **7.8.x** — projections; EXCLUDE via raw SQL |
| PostgreSQL | **17.x** — `daterange`, `btree_gist`, exclusion constraints |
| `@divan/temporal-engine` | Already a person-employment dependency — **reuse** |
| Next.js / tRPC | Only if optional read router added |

### File structure (expected touch set)

| Path | Action |
| --- | --- |
| `packages/db/prisma/schema.prisma` | UPDATE — `Employment` + Person relation |
| `packages/db/prisma/migrations/*` | NEW — table + `btree_gist` + EXCLUDE |
| `packages/modules/person-employment/src/employment*.ts` | NEW — invariants, projection apply/close/read |
| `packages/modules/person-employment/src/errors.ts` | UPDATE — Employment error codes + Persian msgs |
| `packages/modules/person-employment/src/index.ts` | UPDATE — exports |
| `packages/modules/person-employment/src/seed.ts` | UPDATE — historical + active Employment fixtures |
| `packages/modules/person-employment/src/person.ts` | UPDATE — strengthen `assertPersonSurvivesEmploymentEnd` |
| `packages/modules/person-employment/README.md` | UPDATE — Employment + minimum-facts checklist |
| `packages/modules/person-employment/package.json` | UPDATE — selfcheck script |
| `apps/web/src/server/employment.ts` + `root.ts` | OPTIONAL — read-only governed router |
| `package.json` (root) | UPDATE — `selfcheck:employment-lifecycle` |
| `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE |

### UPDATE file — current state (must preserve)

**`packages/db/prisma/schema.prisma`:** Person master-data only; header says no Employment yet. **Change:** add Employment with Restrict FK; keep HumanIdentity distinct; keep identity tables untouched.

**`packages/modules/person-employment/src/person.ts`:** Identity APIs + stub `assertPersonSurvivesEmploymentEnd`. **Change:** keep identity APIs intact; strengthen continuity assert once Employment exists; do not merge Employment into Person create.

**`packages/kernel/temporal-engine`:** Already implements half-open overlap helpers. **Change:** consume — do not duplicate.

**`/personnel` UI (3.1):** Person create/list + demos. **Preserve:** do not replace with Employment event forms.

### Testing requirements

| Case | Expect |
| --- | --- |
| Seed closed + open adjacent Employments for one Person | Both stored; second starts at first’s `endDateExclusive` |
| Insert overlapping interval for same Person | Rejected (domain + preferably EXCLUDE `23P01`) |
| Second **open** Employment while one open exists | Rejected (≤1 active / non-overlap) |
| `getActiveEmploymentAsOf` on day inside open interval | Returns that Employment |
| `getActiveEmploymentAsOf` on day only in closed historical | Returns historical or none per interval math — never two |
| `closeEmploymentProjection` then read Person | Person intact; Employment has endDateExclusive set |
| Cascade delete Person via Employment end | Impossible / not offered |
| Operator Start/Return/Terminate API | Must not exist in public module surface |
| Prior `selfcheck:person-identity` | Still green |

### Previous story intelligence (3.1)

- Delivery shape: Prisma migration → domain module → seed → selfcheck script → deferred-work — **follow the same**; skip UI unless optional read.
- Shadow DB / `migrate dev` pain: prefer hand-written migration SQL + `prisma migrate deploy` when shadow fails (documented in 3.1 Dev Agent Record).
- Review patches taught: stable error **codes** for clients; sentinel/`۰` normalization; category gates on sensitive fields (Employment lean fields are ordinary unless marked otherwise).
- Do not invent grant-lifecycle deepening for Employment reads unless you add tRPC — PermissionSet-only remains acceptable for thin demo reads (same 3.1 defer).

### Git intelligence

Recent: `ce31f55` story 3.1 → `319be13` epic 2 retro → `0979b61` 2.7. Pattern: module + Prisma migration + selfcheck + deferred-work. 3.2 should look the same without a large web UI delta.

### Latest tech notes

- PostgreSQL exclusion constraints with `daterange` + `EXCLUDE USING gist (person_id WITH =, range WITH &&)` and `btree_gist` remain the standard concurrency-safe non-overlap approach; Prisma still needs raw SQL for EXCLUDE.
- Map PG error `23P01` (exclusion_violation) to `OverlappingEmployment`.
- Prefer half-open `[)` so back-to-back Employments do not false-conflict (aligned with SPEC exclusive ends).

### Project context reference

No `project-context.md` in repo. Rely on Architecture Spine, epics sequencing, SPEC-divan temporal freeze, Story 3.1, and this file.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3 sequencing; Story 3.2]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-5, FR-6; NFR-4]
- [Source: `_bmad-output/specs/spec-divan/SPEC.md` — temporal partial freeze; Person/Employment intent]
- [Source: `_bmad-output/specs/spec-divan/glossary.md` — Employment]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-6]
- [Source: `docs/pre-prd.md` §9.3, §10.2 — Employment rules + minimum activate facts]
- [Source: `packages/kernel/temporal-engine/src/date-only.ts`]
- [Source: `_bmad-output/implementation-artifacts/3-1-stable-person-identity.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Migration `20260717040000_employment_projection` applied via `prisma migrate deploy` (btree_gist + EXCLUDE).
- Selfchecks: `selfcheck:employment-lifecycle`, `selfcheck:person-identity`, `selfcheck:audit-envelope`, `selfcheck:inference-bulk` — all green.
- Typecheck: `@divan/person-employment`, `@divan/db`, `@divan/temporal-engine`, `@divan/identity-access`.

### Completion Notes List

- Employment projection schema with `onDelete: Restrict` FK; half-open intervals; PG EXCLUDE for concurrency-safe non-overlap.
- Domain writers `applyEmploymentProjection` / `closeEmploymentProjection` only — no Start/Return/Terminate product APIs or tRPC.
- Seed: demo Person `10001` gets adjacent closed + open Employments; identity-access seed calls `seedEmploymentLifecycleFixtures`.
- Epic 4 minimum-facts checklist in README + `EMPLOYMENT_MINIMUM_FACTS`.
- Concurrent second-open fail-closed with `CONCURRENT_EMPLOYMENT_FORBIDDEN` + Persian copy.
- Task 3: chose module selfcheck only (no optional employment read tRPC).

### File List

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260717040000_employment_projection/migration.sql`
- `packages/modules/person-employment/src/errors.ts`
- `packages/modules/person-employment/src/employment-invariants.ts`
- `packages/modules/person-employment/src/employment-minimum-facts.ts`
- `packages/modules/person-employment/src/employment.ts`
- `packages/modules/person-employment/src/employment-lifecycle.selfcheck.ts`
- `packages/modules/person-employment/src/person.ts`
- `packages/modules/person-employment/src/person-identity.selfcheck.ts`
- `packages/modules/person-employment/src/seed.ts`
- `packages/modules/person-employment/src/index.ts`
- `packages/modules/person-employment/package.json`
- `packages/modules/person-employment/README.md`
- `packages/modules/identity-access/src/seed.ts`
- `package.json`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-2-employment-lifecycle-invariants.md`

### Change Log

- 2026-07-17: Story 3.2 implemented — Employment projection + temporal invariants + seed/selfcheck; status → review.
- 2026-07-17: Code review patches applied (close/asOf/seed/RESTRICT/sentinel/FK mapping); status → done.

---

**Ultimate context engine analysis completed — comprehensive developer guide created.**
