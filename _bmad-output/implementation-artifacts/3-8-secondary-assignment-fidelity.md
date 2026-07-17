---
baseline_commit: e5830d7
---

# Story 3.8: Secondary Assignment Fidelity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want the finite AR-SECONDARY Secondary Assignment scenarios representable and maintainable,
so that current organizational dual roles remain faithful without consuming headcount (FR12).

## Gate (read first)

**Epic 3 ↔ Epic 4 sequencing remains inviolable — Secondary Assignment is a projection + integrity substrate, not a product mutation surface.**

Epic 3 delivers master-data entities, integrity constraints, reference schemas, and read/display fidelity. Authoritative mutations that create or change **Employment, Primary Assignment, Secondary Assignment, or compensation/contractual *state* through Personnel Events** land only in **Epic 4** after the append-only event store (Story 4.1). Epic 3 MUST NOT introduce a temporary CRUD write path for those workforce-state mutations that later must be thrown away. Migration of Secondary rows lands in **Epic 6**.

**This story mirrors Story 3.7 (Primary Assignment integrity) and Story 3.2 (Employment invariants) — not Stories 3.5–3.6 (Admin master-data CRUD).**

| Allowed in 3.8 | Forbidden in 3.8 |
| --- | --- |
| `SecondaryAssignment` projection schema (table **separate** from Primary) + FKs to Employment, OrgUnit target, optional job refs | Operator/Admin **product** create/change/end Secondary Assignment APIs or UI |
| Domain invariants: required reason/type; Secondary ⊆ Employment coverage for full interval; equivalent-overlap reject; inventory gate | Start / Return / Transfer / Termination / Secondary create-change-end **Personnel Event** flows (4.5–4.8 / catalogue) |
| Internal / seed / selfcheck **projection writers** (`applySecondaryAssignmentProjection`, `closeSecondaryAssignmentProjection`) | Names like `createSecondaryAssignment` / `assignSecondaryRole` / `endSecondary` implying event authority |
| Read models: active-as-of, list-by-employment/person, inventory validation helpers | Headcount Approval / consumption / Reservation / Override (FR-28..FR-32); **no** `headcountApprovalId` on Secondary |
| Wire OrgUnit + job-ref **dependency hooks** so deactivate-with-active-Secondary fail-closes (extend 3.7 hooks) | Merging Secondary into `PrimaryAssignment`; inventing Team membership from Secondary |
| Seed + `selfcheck:secondary-assignment` | Management derivation (Story 3.9); profile Assignments UI (Epic 5 UX-DR8) |
| AR-SECONDARY inventory **registry stub** — fail-closed for codes outside approved list | Inventing full AR-SECONDARY scenario catalogue, approval workflows, effort %, billing, matrix-org |
| Document: Secondary does **not** consume headcount by default (FR-12 / FR-29 contrast) | Default headcount consumption; Primary coverage / exactly-one rules changing |

- **AD-2:** Secondary Assignment rows are **projections**, not event-store authority. Projection upsert is not a substitute for Secondary create/change/end events.
- **AD-3:** Lives in **`@divan/person-employment`** — not a new package, not identity-access, not compensation-facts, not headcount. Public API from `src/index.ts` only; `apps/web` must not import Prisma models.
- **AD-5 / AD-6:** If optional governed read tRPC is added: `governedProcedure` + envelope; no `@prisma/client` in `apps/web`; Layout ≠ RSC. **Default: module selfcheck only** (same as Primary/Employment — no assignment tRPC today).
- **FR-12 / addendum §2.1–2.4:** Multiple concurrent Secondaries allowed; each requires reason/type; active Employment must cover the Secondary’s full effective interval; equivalent Secondary (same Person + organizational target + reason/type + overlapping interval) rejected; no headcount consumption by default; scenarios outside approved inventory blocked.
- **Reuse:** `@divan/temporal-engine` half-open intervals; Primary EXCLUDE/`btree_gist` pattern (multi-equality columns); OrgUnit + job-ref dependency hook registries (extend, do not replace Primary hooks); Grade∈Ladder when Grade/Ladder present on Secondary.
- Prefer hand-written migration + `prisma migrate deploy` (Shadow DB pain from 3.1).
- **AR numbers fail-closed:** do **not** invent AR-SECONDARY scenario inventory beyond a provisional registry stub; do not invent AR-TEMPORAL disposition workflows; do not invent AR-HEADCOUNT Secondary consumption exceptions.

[Source: `epics.md` Epic 3 sequencing + Story 3.8; `prd.md` FR-12 + Glossary; `addendum.md` §2.1–2.4 / §6.1 / §12.3; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6; Story 3.7; `deferred-work.md`]

## Acceptance Criteria

1. **Given** AR-SECONDARY launch inventory configuration (provisional registry until artifact approved)  
   **When** Secondary Assignment records are validated, viewed, or prepared for migration  
   **Then** required fields, reason/type, and active Employment coverage for the full effective interval are enforceable as domain rules

2. **And** an equivalent Secondary for the same Person, organizational target, reason/type, and overlapping interval is rejected (prefer DB `EXCLUDE` + domain asserts)

3. **And** Secondary Assignments do not consume headcount by default (no headcount FK/columns; document non-consumption; do not wire `@divan/headcount`)

4. **And** scenarios / reason-type codes outside the approved inventory are out of scope and blocked (fail-closed)

5. **And** authoritative create/change/end of Secondary Assignments is delivered via Epic 4 Personnel Event flows (and migration in Epic 6); Epic 3 does **not** add a bypass CRUD write API (projection writers are seed/Epic-4-ready internals only; not exported as HR mutation verbs)

6. **And** Secondary intervals are half-open `[start, endExclusive)`, reuse temporal-engine; back-to-back equivalent Secondaries OK; Secondary must lie within its Employment interval for the full Secondary span (Employment covers Secondary — **not** Secondary covering Employment like Primary)

7. **And** deactivating an OrgUnit or job reference used by an active/open Secondary is blocked via dependency hook registries (fail-closed Persian + stable codes) — Primary hooks from 3.7 remain intact

8. **And** Layout ≠ RSC / UI ≠ data access / default-deny / no client `@prisma/client` / OrganizationalScope ≠ OrgUnit / job-ref independence / Employment non-overlap / Primary exactly-one + Team membership remain intact

9. **And** this story does **not** deliver management derivation (3.9), headcount consumption (Epic 4), Personnel Event append (4.1+), profile Assignments section UI (Epic 5), or product Secondary mutation UI

## Tasks / Subtasks

- [x] Task 1: Secondary Assignment projection schema in `@divan/db` (AC: #1–#3, #6)
  - [x] Add Prisma model `SecondaryAssignment` in `public` schema (owned by person-employment) — **separate table**, not a flag on Primary:
    - `id` — UUID v7 PK (`@default(uuid(7))`)
    - `personId` — FK → `Person.id` **`onDelete: Restrict`** (denormalized for equivalence EXCLUDE; must match `employment.personId`)
    - `employmentId` — FK → `Employment.id` **`onDelete: Restrict`**
    - `orgUnitId` — FK → `OrganizationalUnit.id` **`onDelete: Restrict`** — organizational target (BU / Dept / Team / approved higher level per AR-SECONDARY; **not** TEAM-only; **does not** define Team membership)
    - `reasonType` — `String` — required machine code from inventory registry (normalize Latin; reject empty/sentinel)
    - Optional job facts **when used** (nullable FKs — unlike Primary’s required Role/Title/Ladder/Grade):
      - `organizationalRoleId` — FK → `OrganizationalRole` Restrict optional
      - `jobTitleId` — FK → `JobTitle` Restrict optional
      - `ladderId` — FK → `Ladder` Restrict optional
      - `gradeId` — FK → `Grade` Restrict optional (if both grade+ladder set: `grade.ladderId === ladderId`)
      - `seniorityId` — FK → `Seniority` Restrict optional — no Grade↔Seniority map
    - Half-open: `startDate` `DateTime @db.Date`, `endDateExclusive` `DateTime? @db.Date` (`null` = open)
    - `sourceEventId` `String?` null until Epic 4 events exist
    - `createdAt` / `updatedAt`
    - Indexes: `personId`, `employmentId`, `orgUnitId`, `reasonType`
  - [x] Relations: `Employment.secondaryAssignments`; `Person.secondaryAssignments`; reverse on OrgUnit / optional job-refs **only if** Prisma needs them — comments: Secondary is carrier; refs remain master-data; Secondary ≠ Team membership
  - [x] Update `schema.prisma` header: Secondary Assignment projection (3.8 / FR-12); no headcount consumption; mutations = Epic 4; migration prep = Epic 6
  - [x] Hand-written migration SQL + `prisma migrate deploy`:
    - `CREATE EXTENSION IF NOT EXISTS btree_gist` (idempotent)
    - `EXCLUDE USING gist (personId WITH =, orgUnitId WITH =, reasonType WITH =, daterange(startDate, endDateExclusive, '[)') WITH &&)` — equivalent-overlap reject at DB (NFR-4)
    - All FKs `ON DELETE RESTRICT`
  - [x] **Do not** add `headcountApprovalId` / consumption columns
  - [x] **Do not** add `isPrimary` discriminator on Primary; **do not** put Secondary on Employment as JSON

- [x] Task 2: AR-SECONDARY inventory registry stub + domain invariants + projection API (AC: #1–#6)
  - [x] New files (mirror Primary pattern): `secondary-assignment.ts`, `secondary-assignment-invariants.ts`, `secondary-assignment-inventory.ts` (or colocated registry), extend `errors.ts`, `secondary-assignment.selfcheck.ts`, README section
  - [x] Inventory registry (fail-closed):
    - Export `AR_SECONDARY_INVENTORY` / `assertReasonTypeInInventory(reasonType)` — finite set of provisional codes documented as **pending AR-SECONDARY approval**
    - Seed ≥1 demo reason/type code used by fixtures (e.g. a single Latin code like `acting_manager` — label Persian in comments only; do **not** invent a large catalogue)
    - Unknown / empty / sentinel reason → typed reject (`SECONDARY_REASON_OUT_OF_INVENTORY` / `SECONDARY_REASON_REQUIRED`)
    - When AR-SECONDARY artifact is approved later, replace provisional codes without changing schema shape
  - [x] Pure validators (reuse temporal-engine + Primary/Employment helpers where applicable):
    - `assertValidSecondaryInterval` — same half-open rules as Employment/Primary
    - `assertPersonMatchesEmployment(personId, employmentId)`
    - `assertSecondaryWithinEmployment(secondary, employment)` — Secondary ⊆ Employment (Employment covers Secondary for full Secondary interval)
    - `assertNoEquivalentOverlap(personId, orgUnitId, reasonType, interval, excludeId?)` — domain mirror of EXCLUDE
    - `isSecondaryActiveAsOf` / list active Secondaries as-of (0..* — **not** exactly-one)
    - `assertReasonTypeInInventory`
    - Optional job-fact asserts: if grade+ladder both set → `assertGradeMatchesLadder`; reject sentinel `""` / `"N/A"` on optional FKs via normalize helpers
    - **Do not** require TEAM unit type on `orgUnitId` (unlike Primary `teamId`)
    - **Do not** assert Secondary coverage of Employment span (Primary-only rule)
  - [x] Writers (internal / seed / Epic-4-ready — **not** product HR verbs):
    - `applySecondaryAssignmentProjection(input)` — validate + upsert; reject already-closed rows on update (3.7 review lesson); map `23P01` / FK to typed errors
    - `closeSecondaryAssignmentProjection(id, endDateExclusive)` — close open interval only; conditional `updateMany` where `endDateExclusive: null` (race-safe); does **not** append events
  - [x] Reads:
    - `getSecondaryAssignmentById`
    - `listSecondaryAssignmentsForEmployment`
    - `listSecondaryAssignmentsForPerson`
    - `listActiveSecondaryAssignmentsAsOf(personId | employmentId, asOf)` — zero OK; many OK
  - [x] Typed errors + Persian `messageFa` + stable codes (clients match **codes**): e.g. `OVERLAPPING_EQUIVALENT_SECONDARY`, `SECONDARY_OUTSIDE_EMPLOYMENT`, `SECONDARY_REASON_REQUIRED`, `SECONDARY_REASON_OUT_OF_INVENTORY`, `SECONDARY_PERSON_MISMATCH`, `SECONDARY_ASSIGNMENT_NOT_FOUND`, `SECONDARY_ALREADY_CLOSED`, `INVALID_SECONDARY_INTERVAL`, `SECONDARY_REF_NOT_FOUND`, `GRADE_NOT_IN_LADDER` (reuse message if shared)
  - [x] Export from `src/index.ts` only
  - [x] **Do not** export `createSecondaryAssignment` / `assignSecondaryRole` / `endSecondary` / Primary forbidden verbs / Personnel Event verbs
  - [x] Update `EMPLOYMENT_MINIMUM_FACTS` (or adjacent note): Secondary schema + invariants live (3.8); dual-role fidelity; no headcount; mutations still Epic 4

- [x] Task 3: Extend OrgUnit + job-ref dependency hooks (AC: #7)
  - [x] Register Secondary-active dependency checks **in addition to** Primary (do not remove 3.7 registrations):
    - OrgUnit deactivate — block when open/active-as-of-today Secondary references `orgUnitId` (use active-as-of filter, not only `endDateExclusive: null` — 3.7 review lesson)
    - Job-ref deactivate — block when open/active Secondary references Role/Title/Ladder/Grade/Seniority
  - [x] `ensureSecondaryAssignmentHooksRegistered()` idempotent; call from seed/apply/close **and** from OrgUnit/job-ref deactivation assert paths (dynamic import pattern from 3.7)
  - [x] Fail-closed with existing `DEACTIVATION_BLOCKED_DEPENDENCIES` (or Secondary-specific code if clearer) + Persian — **do not** invent AR-TEMPORAL disposition UI
  - [x] Selfcheck: deactivate OrgUnit/JobTitle while open Secondary exists → blocked; after close Secondary → deactivate allowed; Primary hook cases still pass

- [x] Task 4: Authz / tRPC — read-only or none (AC: #5, #8, #9)
  - [x] **Default (recommended):** no new tRPC — prove via selfcheck (Primary has no web router)
  - [x] If thin governed read is added: list/activeAsOf behind `person.read` (or `assignment.read`); `governedProcedure` meta; domain blocks → `BAD_REQUEST` not `FORBIDDEN`; no mutation procedures
  - [x] **Forbidden:** Secondary create/change/end procedures or UI forms on `/personnel` or `/organization`

- [x] Task 5: Seed + selfcheck + deferred-work + DoD (AC: #1–#9)
  - [x] Seed ≥1 Secondary on demo Person’s open Employment: inventory reason/type, org target (e.g. Department or Team distinct from Primary team OK), optional job facts; interval within Employment
  - [x] Optional: second concurrent Secondary with **different** reason/type or target (proves multi concurrent); one closed historical Secondary
  - [x] `secondary-assignment.selfcheck.ts` + package script + root `selfcheck:secondary-assignment`
  - [x] Cases in Testing table below — include raw Prisma create for DB `23P01` → typed overlap mapping
  - [x] Update `deferred-work.md`: Secondary schema + integrity landed; product mutations = Epic 4; migration = Epic 6; AR-SECONDARY artifact still pending (provisional inventory); headcount non-consumption confirmed for Secondary; PopulationPort full cutover still not claimed (3.9/4.x)
  - [x] Update `population-cutover.ts` notes: Secondary read helpers exist; do **not** claim full PopulationPort cutover
  - [x] Preserve prior selfchecks green: `person-identity`, `employment-lifecycle`, `data-dictionary`, `organization-hierarchy`, `job-reference`, `primary-assignment`, `compensation-facts`, `audit-envelope` (as applicable)
  - [x] `pnpm` typecheck: `@divan/person-employment`, `@divan/db`, `@divan/temporal-engine` (+ web / identity-access only if touched)
  - [x] **When marking done:** sync story-file `Status: done` with `sprint-status.yaml` key `3-8-secondary-assignment-fidelity`

### Review Findings

- [x] [Review][Patch] Remove UTF-8 BOM from `sprint-status.yaml` [_bmad-output/implementation-artifacts/sprint-status.yaml:1]
- [x] [Review][Patch] Seed Secondary idempotency must match optional job FKs (e.g. `organizationalRoleId`), not only interval/org/reason [_bmad-output/... via packages/modules/person-employment/src/seed.ts:870]
- [x] [Review][Patch] `applySecondaryAssignmentProjection` update path races with close — use conditional `updateMany` where `endDateExclusive: null` (reject count===0 as already closed) [packages/modules/person-employment/src/secondary-assignment.ts:389]
- [x] [Review][Patch] Wrap Secondary seed `deleteMany` + applies in a transaction so a mid-seed failure cannot leave zero/partial fixtures [packages/modules/person-employment/src/seed.ts:963]
- [x] [Review][Patch] `closeSecondaryAssignmentProjection` `updateMany` should set `updatedAt` explicitly (Prisma `@updatedAt` often skips `updateMany`) [packages/modules/person-employment/src/secondary-assignment.ts:487]
- [x] [Review][Patch] Seed early-return `shapeOk && existing.length >= 3` tolerates unexpected extra Secondary rows — require exact fixture cardinality (or delete+reseed when extras present) [packages/modules/person-employment/src/seed.ts:956]
- [x] [Review][Defer] `assertRefsExist` does not validate OrgUnit/job-ref active-as-of Secondary interval [packages/modules/person-employment/src/secondary-assignment.ts:181] — deferred, pre-existing
- [x] [Review][Defer] Hook registry API has no deactivate-as-of date; future-start vs currently-active Secondary filtering cannot be precise beyond active-as-of-today [packages/modules/person-employment/src/secondary-assignment.ts:592] — deferred, pre-existing

## Dev Notes

### Epic 2 / 3.1–3.7 carry-in

| Item | How 3.8 absorbs it |
| --- | --- |
| Epic 3↔4 no temporary CRUD | Gate + Tasks 2–4: projection writers only; no Secondary product API/UI |
| Primary projection pattern (3.7) | Same class: EXCLUDE + apply/close/read + selfcheck + hooks; **separate** table; different cardinality/overlap key |
| Employment projection (3.2) | Secondary ⊆ Employment; Employment non-overlap unchanged |
| OrgUnit dual active + hooks (3.5) | Register Secondary deps on OrgUnit deactivate (alongside Primary) |
| Job refs + hooks (3.6/3.7) | Optional Secondary FKs; register Secondary deps |
| Compensation isolation (3.4) | Secondary is not a compensation fact |
| OrganizationalScope ≠ OrgUnit | Secondary org target ≠ authz scope population |
| Status ↔ sprint alignment | Task 5 DoD on done transition |
| AR numbers fail-closed | Provisional inventory only; no invented AR-SECONDARY scenarios |
| 3.7 review lessons | Active-as-of hooks; closed-row update reject; race-safe close; seed FK shape idempotency; map `23P01`; ensure hooks from deactivate paths; no UTF-8 BOM on sprint-status |

### Epic context

- **Epic 3:** Workforce Master Data & Organization — FR5–FR13.
- **This story:** FR-12 — Secondary Assignment schema, reason/type + inventory gate, Employment coverage, equivalent-overlap reject, no headcount, read/migration-prep; mutations deferred to Epic 4 (+ Epic 6 import).
- **Upstream (done):** 3.1 Person; 3.2 Employment; 3.3 Dictionary; 3.4 Compensation; 3.5 Org hierarchy; 3.6 Job refs; **3.7 Primary Assignment**.
- **Downstream:** 3.9 management derivation (from **Primary**, not Secondary); 4.1 event store; Secondary create/change/end events (addendum §5.4); 4.6 Termination ends Assignments; 4.9 current state includes in-scope Secondaries; Epic 5 profile Assignments display; Epic 6 migration with provenance.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Product create/change/end Secondary UI or event append | Epic 4 Personnel Events (+ catalogue) |
| Full AR-SECONDARY approved inventory / acceptance oracle | Pending artifact — stub only here |
| Derived management relationships | Story 3.9 |
| Headcount Approval / consumption for Secondary | Forbidden by default; post-MVP policy only |
| Profile “Assignments” section UI (Primary + Secondary display) | Epic 5 / UX-DR8 |
| Migration / Baseline Secondary import | Epic 6 |
| PopulationPort full fixture replacement | Named cutover; after 3.9/4.x as needed |
| Effort %, billing, scheduling, matrix-org, Secondary approval workflow | Explicit AR-SECONDARY non-goals |
| Treating Secondary as Team membership or headcount anchor | Forbidden (Primary only) |
| Vitest/CI full suite | Thin selfcheck continues |
| Treating Secondary projection as event-store | Forbidden (AD-2) |

### Architecture compliance

| Decision | Implication for 3.8 |
| --- | --- |
| AD-1 | Single process + one PostgreSQL; no assignment microservice |
| AD-2 | Secondary table = projection; writers prepare for Epic 4 refresh |
| AD-3 | All Secondary logic in `@divan/person-employment`; web uses published APIs only |
| AD-5 | Envelope only if governed read routes added |
| AD-6 | Prisma projection + raw SQL EXCLUDE; no web Prisma |
| FR-12 | Inventory scenarios representable; reason/type; Employment coverage; equivalent overlap reject; no headcount by default |
| FR-11 | Primary rules unchanged — Secondary must not weaken exactly-one Primary / Team membership |
| FR-29 | Only Primary consumes headcount (unless exemption) — Secondary never by default |
| NFR-4 | Multi-column EXCLUDE so concurrent equivalent Secondaries cannot both commit |
| AR-TEMPORAL partial freeze | Asia/Tehran; date-only; exclusive ends; reuse temporal-engine |
| AR-SECONDARY pending | Provisional registry + fail-closed; do not claim full inventory approval |

### Conceptual model (must follow)

```
Person 1──* Employment (non-overlapping; ≤1 active as-of)
              ├──* PrimaryAssignment (exactly one active when Employment active; Team membership)
              └──* SecondaryAssignment (0..* concurrent; non-equivalent overlaps OK)
                    ├── personId (denormalized; == employment.personId)
                    ├── orgUnitId → OrganizationalUnit (target — not Team-membership)
                    ├── reasonType (required; inventory-gated)
                    ├── optional Role / Title / Ladder / Grade / Seniority when used
                    └── NO headcount consumption

Equivalence key = (personId, orgUnitId, reasonType, overlapping interval)
Team membership / headcount anchor = Primary ONLY
Personnel Events = Epic 4 (authoritative writers)
Migration = Epic 6
```

Glossary (Persian): Secondary Assignment = تخصیص ثانویه; reason/type = دلیل/نوع; dual role = نقش دوگانه سازمانی.

### Temporal / interval rules (must follow)

```
Active at as-of D  ⇔  startDate ≤ D < endDateExclusive
                      (if endDateExclusive is null, treat as +∞)

Equivalent overlap ⇔  same personId ∧ same orgUnitId ∧ same reasonType
                      ∧ intervalsOverlap(...)

Back-to-back OK    ⇔  A.endDateExclusive === B.startDate  (same equivalence key)

Secondary ⊆ Employment
                       (Employment must cover every day of Secondary interval)
                       ≠ Primary coverage rule (Primary must cover Employment)
```

Do **not** use closed-closed intervals or store end-inclusive dates without converting at the boundary.

### Primary vs Secondary (do not confuse)

| Aspect | Primary (3.7 — preserve) | Secondary (3.8) |
| --- | --- | --- |
| Cardinality | Exactly one active per active Employment | Multiple concurrent OK |
| Overlap key | per `employmentId` | per `(personId, orgUnitId, reasonType)` |
| Org FK | `teamId` TEAM-only | `orgUnitId` broader target |
| Job facts | Role/Title/Ladder/Grade required | Optional when used |
| reason/type | N/A | Required + inventory |
| Headcount | Deferred Epic 4 (consumes) | Never by default |
| Team membership | Yes (`resolveTeamMembershipAsOf`) | No |
| Coverage | Primary covers Employment | Employment covers Secondary |

### UPDATE files — current state (read before editing)

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `packages/db/prisma/schema.prisma` | Person, Employment, PrimaryAssignment, OrgUnit, job refs; header notes Secondary = 3.8 | Add `SecondaryAssignment` + relations; update header | Primary EXCLUDE semantics; Employment; OrgUnit/job-ref master-data |
| `packages/modules/person-employment/src/primary-assignment.ts` | apply/close/read + Primary hooks | Unchanged API; hooks remain registered | Exactly-one, Team membership, coverage asserts |
| `packages/modules/person-employment/src/org-unit.ts` | Primary hooks via `ensurePrimaryAssignmentHooksRegistered` | Also ensure Secondary hooks on deactivate | Master-data create/activate/deactivate |
| `packages/modules/person-employment/src/job-reference.ts` | Primary hooks wired | Also Secondary job-ref deps | Five distinct refs; no Grade↔Seniority map |
| `packages/modules/person-employment/src/employment-minimum-facts.ts` | Primary live; Secondary still future | Mark Secondary schema + invariants live | Headcount still Epic 4; Primary facts unchanged |
| `packages/modules/person-employment/src/population-cutover.ts` | Notes wait on 3.8/3.9/4.x | Note Secondary helpers; cutover still incomplete | Subject id = Person UUID |
| `packages/modules/person-employment/src/index.ts` | Exports through Primary | Export Secondary API + inventory helpers | Prior exports; no forbidden verbs |
| `packages/modules/person-employment/src/seed.ts` | Primary fixtures | Seed Secondary + inventory code | Idempotent seed shape validation (interval + FKs + reason) |
| `packages/modules/person-employment/src/errors.ts` | PrimaryAssignmentError | SecondaryAssignmentError + messages | Existing codes stable |
| `apps/web/**` | No assignment router | Prefer **no** UI; optional read-only tRPC only | No Secondary mutation forms |
| `_bmad-output/implementation-artifacts/deferred-work.md` | Secondary = 3.8 | Mark Secondary landed; AR-SECONDARY still pending | Keep other open items |

### Previous story intelligence (3.7 → 3.8)

- Delivery shape for **constraint stories** follows **3.2 / 3.7**, not 3.5/3.6: hand-written migration → invariants → `apply*Projection` / `close*Projection` → seed → selfcheck → deferred-work + sprint sync. **No Admin CRUD panel.**
- 3.7 completed Primary + hooks; explicitly deferred Secondary table — 3.8 fills that gap without touching Primary cardinality.
- Writer naming: `applySecondaryAssignmentProjection` / `closeSecondaryAssignmentProjection` correct; keep `createSecondaryAssignment` reserved for event-backed product language in Epic 4.
- Must apply 3.7 review patches as defaults: active-as-of hooks; reject update on already-closed rows; `ensure*HooksRegistered` from deactivate paths; seed idempotency checks FKs not only intervals; selfcheck raw `23P01`; race-safe close via `updateMany`; no sprint-status BOM/mojibake.
- Coverage: Secondary uses **within-Employment** assert only — do **not** copy `assertPrimaryCoverageForActiveEmployment` onto Secondary writers.
- `baseline_commit`: `e5830d7` (story 3.7).

### Git intelligence summary

Recent commits: `e5830d7` story 3.7 → `914ab55` story 3.6 → `d2e67c4` 3.5 → `d89a2d6` 3.4 → `f271a15` 3.3. Follow story-commit discipline and selfcheck scripting (`selfcheck:secondary-assignment` alongside `selfcheck:primary-assignment` / `selfcheck:employment-lifecycle`).

### Latest tech information

- **PostgreSQL EXCLUDE + `btree_gist` + multi-equality columns + half-open `daterange(..., '[)')`:** correct NFR-4 pattern for equivalent Secondary overlap (`personId`, `orgUnitId`, `reasonType`, range). Adjacent intervals do not `&&`. Prisma cannot express EXCLUDE — raw SQL in migration (same as Employment 3.2 / Primary 3.7). Map SQLSTATE `23P01` to `OVERLAPPING_EQUIVALENT_SECONDARY`.
- **Prisma 7.x (repo):** UUID v7 PKs; `Restrict` FKs; Date `@db.Date` via existing `dateOnlyToDb` / `dateOnlyFromDb` — do not invent a third date codec.
- **Do not add Drizzle** — stack is Prisma.
- No new npm dependencies expected for this story.

### Library / framework requirements

| Lib | Use |
| --- | --- |
| `@divan/temporal-engine` | Interval math / as-of / overlap |
| `@divan/db` | Prisma client accessor inside module |
| Existing Primary / Employment / org / job-ref helpers | Within-Employment; Grade∈Ladder; dependency hooks |
| `@divan/headcount` | **Do not import** for Secondary |
| `@divan/audit-envelope` | Only if optional governed read router added |
| Next.js / tRPC | Optional read-only only — default none |

### File structure requirements

```
packages/db/prisma/schema.prisma                                         # UPDATE — SecondaryAssignment
packages/db/prisma/migrations/<ts>_secondary_assignment_fidelity/        # NEW — SQL + EXCLUDE
packages/modules/person-employment/src/secondary-assignment.ts           # NEW
packages/modules/person-employment/src/secondary-assignment-invariants.ts
packages/modules/person-employment/src/secondary-assignment-inventory.ts # NEW — provisional AR-SECONDARY stub
packages/modules/person-employment/src/secondary-assignment.selfcheck.ts
packages/modules/person-employment/src/errors.ts                         # UPDATE
packages/modules/person-employment/src/index.ts                          # UPDATE exports
packages/modules/person-employment/src/seed.ts                           # UPDATE
packages/modules/person-employment/src/employment-minimum-facts.ts       # UPDATE
packages/modules/person-employment/src/population-cutover.ts             # UPDATE notes
packages/modules/person-employment/src/org-unit.ts                       # ensure Secondary hooks on deactivate
packages/modules/person-employment/src/job-reference.ts                  # ensure Secondary hooks on deactivate
packages/modules/person-employment/README.md                             # UPDATE
packages/modules/person-employment/package.json                          # selfcheck script
package.json (root)                                                      # selfcheck:secondary-assignment
packages/modules/identity-access/src/seed.ts                             # OPTIONAL — call Secondary seed if Primary is chained here
apps/web/src/server/secondary-assignment.ts                              # OPTIONAL read-only
_bmad-output/implementation-artifacts/deferred-work.md                   # UPDATE
```

### Testing requirements

| Case | Expect |
| --- | --- |
| Apply Secondary within open Employment + inventory reasonType + org target | Succeeds |
| Missing / empty / sentinel reasonType | Reject `SECONDARY_REASON_REQUIRED` |
| reasonType not in inventory | Reject `SECONDARY_REASON_OUT_OF_INVENTORY` |
| Equivalent overlap (same Person + orgUnit + reasonType + overlapping interval) | Reject `OVERLAPPING_EQUIVALENT_SECONDARY` (domain and/or `23P01`) |
| Concurrent Secondaries different reasonType or different orgUnit | Succeeds |
| Back-to-back equivalent Secondaries (`end === next.start`) | Succeeds |
| Secondary interval outside Employment | Reject `SECONDARY_OUTSIDE_EMPLOYMENT` |
| `personId` ≠ `employment.personId` | Reject `SECONDARY_PERSON_MISMATCH` |
| Optional job facts omitted | Succeeds |
| Grade + Ladder mismatch when both set | Reject `GRADE_NOT_IN_LADDER` |
| `orgUnitId` is DEPARTMENT (not TEAM) | Succeeds (not TEAM-only) |
| `closeSecondaryAssignmentProjection` then Person/Employment/Primary still readable | OK; no cascade |
| Second close on already-closed | Reject already-closed |
| Update via apply on already-closed row | Reject (3.7 lesson) |
| Deactivate OrgUnit while open Secondary references it | Blocked via hook |
| Deactivate JobTitle while open Secondary references it | Blocked via hook |
| After Secondary closed, deactivate OrgUnit/Title | Allowed |
| Primary exactly-one / Team membership / Primary hooks | Still green (`selfcheck:primary-assignment`) |
| Public exports include `applySecondaryAssignmentProjection` | OK |
| Public exports include `createSecondaryAssignment` / `assignSecondaryRole` | Must **not** exist |
| No Secondary mutation tRPC/UI | Assert absence |
| Employment / Org / job-ref / Primary prior selfchecks | Remain green |

### Project context reference

- No `project-context.md` in repo; follow `ARCHITECTURE-SPINE.md`, `epics.md`, Stories 3.1–3.7, and this file.
- Communication with user: Persian; story artifact language: English (document_output_language).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 3.8 / Epic 3 sequencing]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md`#FR-12 / Glossary Secondary Assignment / FR-29]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md`#§2.1–2.4 AR-SECONDARY / §5.4 event catalogue / §6.1 / §12.3]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/source-extract-pre-prd.md`#BR-ASG-002/005/006 / BR-CHG-010]
- [Source: `_bmad-output/specs/spec-divan/SPEC.md`#CAP-3 — Secondary required fields; no headcount by default]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md`#AD-2–AD-6 / capability map FR-9..FR-13]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md`#person-profile-section — Assignments = Epic 5]
- [Source: `_bmad-output/implementation-artifacts/3-7-primary-assignment-integrity.md` Gate/Tasks/review lessons]
- [Source: `_bmad-output/implementation-artifacts/3-2-employment-lifecycle-invariants.md` projection pattern]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`#Story 3.7 deferred — Secondary = 3.8]
- [Source: `packages/db/prisma/migrations/20260717230000_primary_assignment_integrity/migration.sql` EXCLUDE pattern]
- [Source: `packages/modules/person-employment/src/primary-assignment.ts` apply/close/hooks]
- [Source: `packages/modules/person-employment/src/org-unit.ts` / `job-reference.ts` dependency hooks]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Seed historical Secondary initially started before open Employment (`2023-06-01` vs `activeStart=2024-01-01`) → adjusted seed dates to lie within Employment.

### Completion Notes List

- Implemented `SecondaryAssignment` projection (separate table) + multi-column EXCLUDE for equivalent overlap `(personId, orgUnitId, reasonType, daterange)`.
- Provisional AR-SECONDARY inventory stub (`acting_manager`, `cross_dept_support`) fail-closed; no headcount columns / no `@divan/headcount`.
- Projection writers: `applySecondaryAssignmentProjection` / `closeSecondaryAssignmentProjection` (not product HR verbs); Employment covers Secondary; concurrent non-equivalent OK.
- Extended OrgUnit + job-ref deactivate hooks with active-as-of-today Secondary checks alongside Primary 3.7 hooks.
- No Secondary tRPC/UI. Seed + `selfcheck:secondary-assignment` green; Primary / Employment / Org / Job-ref selfchecks remain green.

### File List

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260718010000_secondary_assignment_fidelity/migration.sql`
- `packages/modules/person-employment/src/secondary-assignment.ts`
- `packages/modules/person-employment/src/secondary-assignment-invariants.ts`
- `packages/modules/person-employment/src/secondary-assignment-inventory.ts`
- `packages/modules/person-employment/src/secondary-assignment.selfcheck.ts`
- `packages/modules/person-employment/src/errors.ts`
- `packages/modules/person-employment/src/index.ts`
- `packages/modules/person-employment/src/seed.ts`
- `packages/modules/person-employment/src/employment-minimum-facts.ts`
- `packages/modules/person-employment/src/population-cutover.ts`
- `packages/modules/person-employment/src/org-unit.ts`
- `packages/modules/person-employment/src/job-reference.ts`
- `packages/modules/person-employment/README.md`
- `packages/modules/person-employment/package.json`
- `packages/modules/identity-access/src/seed.ts`
- `package.json`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-8-secondary-assignment-fidelity.md`

### Change Log

- 2026-07-18: Story 3.8 Secondary Assignment fidelity — schema, inventory stub, projection API, hooks, seed, selfcheck; status → review.
- 2026-07-18: Code review patches applied (BOM, seed FK/cardinality/transaction, race-safe apply update, close updatedAt); status → done.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
