---
baseline_commit: 914ab55
---

# Story 3.7: Primary Assignment Integrity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want every active Employment to have exactly one active Primary Assignment,
so that Team membership and headcount anchoring stay unambiguous (FR11).

## Gate (read first)

**Epic 3 ↔ Epic 4 sequencing remains inviolable — Primary Assignment is a projection + integrity substrate, not a product mutation surface.**

Epic 3 delivers master-data entities, integrity constraints, reference schemas, and read/display fidelity. Authoritative mutations that create or change **Employment, Primary Assignment, Secondary Assignment, or compensation/contractual *state* through Personnel Events** land only in **Epic 4** after the append-only event store (Story 4.1). Epic 3 MUST NOT introduce a temporary CRUD write path for those workforce-state mutations that later must be thrown away.

**This story mirrors Story 3.2 (Employment invariants), not Stories 3.5–3.6 (Admin master-data CRUD).**

| Allowed in 3.7 | Forbidden in 3.7 |
| --- | --- |
| `PrimaryAssignment` projection schema + FKs to Employment, Team (OrgUnit), job refs | Operator/Admin **product** create/change/end Primary Assignment APIs or UI |
| Domain invariants: non-overlap, exactly-one-active-as-of, coverage of active Employment | Start / Return / Transfer / Termination / job-change **Personnel Event** flows (4.5–4.8) |
| Internal / seed / selfcheck **projection writers** (`applyPrimaryAssignmentProjection`, `closePrimaryAssignmentProjection`) | Names like `createPrimaryAssignment` / `transferPrimary` / `assignPersonToTeam` implying event authority |
| Read models: active-as-of, list-by-employment, Team membership from Primary | Headcount Approval / consumption / Reservation / Override (FR-28..FR-32) |
| Wire OrgUnit + job-ref **dependency hooks** so deactivate-with-active-Primary fail-closes | Secondary Assignment schema/inventory (Story 3.8) |
| Seed + `selfcheck:primary-assignment` | Management derivation (Story 3.9); profile Assignments UI (Epic 5 UX-DR8) |
| Update `EMPLOYMENT_MINIMUM_FACTS` — Primary now schema-enforced | Merge Primary into Employment row; invent `Employment.orgUnitId` as Team surrogate |
| Document headcount link column as **null / deferred** until Epic 4 | Workplace Placement / desk as Primary surrogate |

- **AD-2:** Primary Assignment rows are **projections**, not event-store authority. Projection upsert is not a substitute for Start/Transfer/job-change events.
- **AD-3:** Lives in **`@divan/person-employment`** — not a new package, not identity-access, not compensation-facts, not headcount. Public API from `src/index.ts` only; `apps/web` must not import Prisma models.
- **AD-5 / AD-6:** If optional governed read tRPC is added: `governedProcedure` + envelope; no `@prisma/client` in `apps/web`; Layout ≠ RSC. **Default: module selfcheck only** (same as Employment — no employment tRPC today).
- **FR-11 / addendum §2.1–2.2:** Exactly one active Primary per active Employment at an instant; Primary periods do not overlap and **cover** active Employment; Primary determines **Team membership** and carries approved org/job facts (Role, Title, Ladder, Grade, Seniority).
- **Reuse:** `@divan/temporal-engine` half-open intervals; Employment EXCLUDE/`btree_gist` pattern; OrgUnit + job-ref dependency hook registries; Grade∈Ladder via existing `assertGradeBelongsToLadder`.
- Prefer hand-written migration + `prisma migrate deploy` (Shadow DB pain from 3.1).
- **AR numbers fail-closed:** do not invent AR-TEMPORAL disposition workflows; do not invent AR-HEADCOUNT matching; do not invent AR-SECONDARY scenarios here.

[Source: `epics.md` Epic 3 sequencing + Story 3.7; `prd.md` FR-11 + Glossary; `addendum.md` §2.1–2.2; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6; Stories 3.2 / 3.5 / 3.6; `deferred-work.md`]

## Acceptance Criteria

1. **Given** Primary Assignment schema and integrity rules in person-employment  
   **When** Primary Assignment state is evaluated at an instant for an active Employment  
   **Then** domain constraints require exactly one active Primary Assignment; overlapping Primaries for the same Employment are blocked (prefer DB `EXCLUDE` + domain asserts)

2. **And** Primary Assignment determines Team membership (FK to OrgUnit with `unitType = TEAM`) and carries approved organization/job facts: Organizational Role, Job Title, Ladder, Grade, and optional Seniority (Grade must belong to the Assignment’s Ladder)

3. **And** create/change/end of Primary Assignment occurs only through authoritative Personnel Events in Epic 4 — direct mutable overwrite **product** APIs are rejected in this epic (projection writers are seed/Epic-4-ready internals only; not exported as HR mutation verbs)

4. **And** this story ships constraint enforcement and read models; it does **not** ship Start / Transfer / job-change UI flows

5. **And** Primary intervals are half-open `[start, endExclusive)`, reuse temporal-engine; back-to-back Primaries OK; Primaries must lie within their Employment interval; active Employment coverage is enforceable (gaps under an active Employment rejected)

6. **And** deactivating an OrgUnit (Team) or job reference used by an active/open Primary is blocked via existing dependency hook registries (fail-closed Persian + stable codes)

7. **And** Layout ≠ RSC / UI ≠ data access / default-deny / no client `@prisma/client` / OrganizationalScope ≠ OrgUnit / job-ref independence / Employment non-overlap remain intact

8. **And** this story does **not** deliver Secondary Assignment (3.8), management derivation (3.9), headcount consumption (Epic 4), Personnel Event append (4.1+), or profile Assignments section UI (Epic 5)

## Tasks / Subtasks

- [x] Task 1: Primary Assignment projection schema in `@divan/db` (AC: #1, #2, #5)
  - [x] Add Prisma model `PrimaryAssignment` in `public` schema (owned by person-employment):
    - `id` — UUID v7 PK (`@default(uuid(7))`)
    - `employmentId` — FK → `Employment.id` **`onDelete: Restrict`**
    - `teamId` — FK → `OrganizationalUnit.id` **`onDelete: Restrict`** (domain: must be `TEAM`)
    - `organizationalRoleId` — FK → `OrganizationalRole` Restrict
    - `jobTitleId` — FK → `JobTitle` Restrict
    - `ladderId` — FK → `Ladder` Restrict
    - `gradeId` — FK → `Grade` Restrict (domain: `grade.ladderId === ladderId`)
    - `seniorityId` — FK → `Seniority` Restrict **optional** (`String?`) — no Grade↔Seniority map
    - Half-open: `startDate` `DateTime @db.Date`, `endDateExclusive` `DateTime? @db.Date` (`null` = open)
    - `sourceEventId` `String?` null until Epic 4 events exist
    - `createdAt` / `updatedAt`
    - Indexes: `employmentId`, `teamId`
  - [x] Relation on `Employment`: `primaryAssignments PrimaryAssignment[]`
  - [x] Optional reverse relations on OrgUnit / job-ref models **only if** Prisma needs them for FK — keep comments clear: Primary is the carrier; refs remain master-data
  - [x] Update `schema.prisma` header: Primary Assignment projection (3.7); Secondary = 3.8; mutations = Epic 4; headcount link deferred
  - [x] Hand-written migration SQL + `prisma migrate deploy`:
    - Mirror Employment: `CREATE EXTENSION IF NOT EXISTS btree_gist` (idempotent)
    - `EXCLUDE USING gist (employmentId WITH =, daterange(startDate, endDateExclusive, '[)') WITH &&)`
    - All FKs `ON DELETE RESTRICT`
  - [x] **Do not** add `headcountApprovalId` / exemption columns as required product fields — document as Epic 4 (nullable stub OK only if explicitly marked deferred and unused)
  - [x] **Do not** add Secondary Assignment table here; **do not** add `Employment.teamId` / `orgUnitId` Team surrogate

- [x] Task 2: Domain invariants + projection API in `@divan/person-employment` (AC: #1–#5)
  - [x] New files (mirror employment pattern): e.g. `primary-assignment.ts`, `primary-assignment-invariants.ts`, extend `errors.ts`, `primary-assignment.selfcheck.ts`, README section
  - [x] Pure validators (reuse temporal-engine + job-ref helpers):
    - `assertValidPrimaryInterval` — same half-open rules as Employment
    - `assertNoOverlapWithExistingPrimaries(employmentId, …)`
    - `isPrimaryActiveAsOf` / `assertExactlyOneActivePrimaryAsOf(employmentId, asOf)` when Employment is active at `asOf`
    - `assertPrimaryWithinEmployment(primary, employment)` — primary ⊆ employment interval
    - `assertPrimaryCoverageForActiveEmployment` — no gaps across Primaries covering the Employment’s active span (seed + apply must prove; document Epic 4 finalization will also call this)
    - `assertTeamUnitIsTeam(team)` — `unitType === "TEAM"`
    - `assertGradeMatchesLadder(gradeId, ladderId)` — reuse `assertGradeBelongsToLadder`
    - Reject sentinel `""` / `"N/A"` on optional seniority via existing normalize helpers
  - [x] Writers (internal / seed / Epic-4-ready — **not** product HR verbs):
    - `applyPrimaryAssignmentProjection(input)` — validate + upsert; map `23P01` / unique / FK to typed errors
    - `closePrimaryAssignmentProjection(id, endDateExclusive)` — close open interval only; conditional update so second close fails; does **not** append events
  - [x] Reads:
    - `getPrimaryAssignmentById`
    - `listPrimaryAssignmentsForEmployment`
    - `getActivePrimaryAssignmentAsOf(employmentId, asOf)`
    - `resolveTeamMembershipAsOf(personId, asOf)` — via active Employment → active Primary → Team (read model for FR-11 Team membership)
  - [x] Typed errors + Persian `messageFa` + stable codes (clients match **codes**): e.g. `OVERLAPPING_PRIMARY_ASSIGNMENT`, `PRIMARY_ASSIGNMENT_REQUIRED`, `PRIMARY_COVERAGE_GAP`, `PRIMARY_OUTSIDE_EMPLOYMENT`, `TEAM_UNIT_REQUIRED`, `GRADE_NOT_IN_LADDER`, `PRIMARY_ASSIGNMENT_NOT_FOUND`, `PRIMARY_ALREADY_CLOSED`, `INVALID_PRIMARY_INTERVAL`, `FK`/`REF_NOT_FOUND` variants as needed
  - [x] Export from `src/index.ts` only
  - [x] **Do not** export `createPrimaryAssignment` / `transferPrimary` / `assignPersonToTeam` / Secondary writers / Personnel Event verbs
  - [x] Update `EMPLOYMENT_MINIMUM_FACTS`: mark Team + job facts + “exactly one active Primary” as **schema + invariants live (3.7)**; mutations still Epic 4; headcount still Epic 4

- [x] Task 3: Wire OrgUnit + job-ref dependency hooks (AC: #6)
  - [x] Register Primary-active dependency checks on:
    - `registerOrgUnitDependencyHook` — block Team (or ancestor, if policy is Team-only: **block the Team row used as `teamId`**) deactivate when open/active Primary references it
    - `registerJobRefDependencyHook` (existing job-ref registry) — block deactivate/change when Primaries reference the Role/Title/Ladder/Grade/Seniority
  - [x] Prefer registering from primary-assignment module init or seed/bootstrap so hooks are live in process — document call site in README
  - [x] Fail-closed with existing `DEACTIVATION_BLOCKED_DEPENDENCIES` (or Primary-specific code if clearer) + Persian explanation — **do not** invent AR-TEMPORAL disposition UI
  - [x] Selfcheck: deactivate Team/JobTitle while open Primary exists → blocked; after close Primary → deactivate allowed

- [x] Task 4: Authz / tRPC — read-only or none (AC: #3, #4, #7)
  - [x] **Default (recommended):** no new tRPC — prove via selfcheck (Employment has no web router today)
  - [x] If thin governed read is added: `primaryAssignment.activeAsOf` / `listForEmployment` behind `person.read` (or new `assignment.read` seeded into hr PermissionSets); `governedProcedure` meta; domain blocks → `BAD_REQUEST` not `FORBIDDEN`; no mutation procedures
  - [x] **Forbidden:** Start/Transfer/job-change procedures or UI forms on `/personnel` or `/organization`

- [x] Task 5: Seed + selfcheck + deferred-work + DoD (AC: #1–#8)
  - [x] Seed ≥1 open Primary for the demo Person’s **open** Employment: Team from org seed, Role/Title/Ladder/Grade (+ optional Seniority) from job-ref seed; interval aligns with Employment (full coverage)
  - [x] Optional: one closed historical Primary adjacent to a later Primary on a closed Employment — proves back-to-back + coverage
  - [x] `primary-assignment.selfcheck.ts` + package script + root `selfcheck:primary-assignment`
  - [x] Cases in Testing table below
  - [x] Update `deferred-work.md`: Primary schema + integrity landed; product mutations = Epic 4; Secondary = 3.8; headcount = Epic 4; AR-TEMPORAL disposition still open; PopulationPort — Team membership helper available; **full fixture cutover still not claimed complete** (3.8/3.9/4.x)
  - [x] Update `population-cutover.ts` notes: Primary read model exists; do **not** silently swap Production PopulationPort fixtures unless a minimal, tested path is clearly scoped — prefer documenting + helper over incomplete cutover
  - [x] Preserve prior selfchecks green: `person-identity`, `employment-lifecycle`, `data-dictionary`, `organization-hierarchy`, `job-reference`, `compensation-facts`, `audit-envelope` (as applicable)
  - [x] `pnpm` typecheck: `@divan/person-employment`, `@divan/db`, `@divan/temporal-engine` (+ web / identity-access only if touched)
  - [x] **When marking done:** sync story-file `Status: done` with `sprint-status.yaml` key `3-7-primary-assignment-integrity`

### Review Findings

- [x] [Review][Defer] Enforce coverage inside apply/close vs assert-only — deferred: keep assert-only on projection writers; Epic 4 event finalization must call `assertPrimaryCoverageForActiveEmployment` after atomic Transfer/close+open (enforcing on `close` alone would break mid-Transfer). Seed + selfcheck already prove the assert. Reason: Epic 3↔4 sequencing / Transfer atomicity.
- [x] [Review][Patch] Dependency hooks only match `endDateExclusive: null`, missing finite-end Primaries still active as-of today [packages/modules/person-employment/src/primary-assignment.ts:549]
- [x] [Review][Patch] `resolveTeamMembershipAsOf` throws `PRIMARY_ASSIGNMENT_REQUIRED` via `getActivePrimaryAssignmentAsOf` instead of returning null when active Employment has zero Primaries [packages/modules/person-employment/src/primary-assignment.ts:512]
- [x] [Review][Patch] Call `ensurePrimaryAssignmentHooksRegistered` from OrgUnit/job-ref deactivation assert paths so hooks are live without prior Primary seed/apply [packages/modules/person-employment/src/org-unit.ts / job-reference.ts]
- [x] [Review][Patch] `applyPrimaryAssignmentProjection` update path does not reject already-closed rows (can reopen/mutate without `closePrimaryAssignmentProjection`) [packages/modules/person-employment/src/primary-assignment.ts:333]
- [x] [Review][Patch] Seed idempotency early-return checks interval shape only, not team/job FKs vs expected fixtures [packages/modules/person-employment/src/seed.ts:750]
- [x] [Review][Patch] `sprint-status.yaml` gained UTF-8 BOM and mojibake on Unicode arrows in comments [_bmad-output/implementation-artifacts/sprint-status.yaml]
- [x] [Review][Patch] Selfcheck does not exercise DB EXCLUDE `23P01` → `OVERLAPPING_PRIMARY_ASSIGNMENT` mapping [packages/modules/person-employment/src/primary-assignment.selfcheck.ts]
- [x] [Review][Patch] Collapse duplicate branches in `getActivePrimaryAssignmentAsOf` (`!empActive` vs active) [packages/modules/person-employment/src/primary-assignment.ts:501]
- [x] [Review][Defer] `assertRefsExist` does not validate Team/job-ref active-as-of Primary interval [packages/modules/person-employment/src/primary-assignment.ts:183] — deferred, pre-existing
- [x] [Review][Defer] Hook registry API has no deactivate-as-of date, so future-start vs current-active filtering cannot be precise [packages/modules/person-employment/src/org-unit.ts / job-reference.ts] — deferred, pre-existing

## Dev Notes

### Epic 2 / 3.1–3.6 carry-in

| Item | How 3.7 absorbs it |
| --- | --- |
| Epic 3↔4 no temporary CRUD | Gate + Tasks 2–4: projection writers only; no Start/Transfer product API/UI |
| Employment projection pattern (3.2) | Same class: EXCLUDE + apply/close/read + selfcheck; no operator CRUD |
| OrgUnit dual active + hooks (3.5) | Register Primary deps on Team deactivate |
| Job refs + hooks (3.6) | FKs carry facts; register Primary deps on job-ref deactivate/change |
| Compensation isolation (3.4) | Primary is not a compensation fact |
| OrganizationalScope ≠ OrgUnit | Team membership ≠ authz scope population (until PopulationPort cutover) |
| Status ↔ sprint alignment | Task 5 DoD on done transition |
| AR numbers fail-closed | No invented disposition / headcount / secondary inventory |
| Error UX | Stable **codes**; BAD_REQUEST vs FORBIDDEN if tRPC added |
| Review anti-patterns | No production skip-gates; whitespace dates → validation; map `23P01` / `P2003`; Prisma from `@divan/db`; conditional close |

### Epic context

- **Epic 3:** Workforce Master Data & Organization — FR5–FR13.
- **This story:** FR-11 — Primary Assignment schema, exactly-one + non-overlap + coverage, Team membership + job facts carriers, read models; mutations deferred to Epic 4.
- **Upstream (done):** 3.1 Person; 3.2 Employment; 3.3 Dictionary; 3.4 Compensation; 3.5 Org hierarchy; 3.6 Job refs.
- **Downstream:** 3.8 Secondary; 3.9 management derivation from Primary; 4.5 Start/Return creates Employment+Primary; 4.6 Termination ends Assignments; 4.7 Transfer replaces Primary atomically; 4.8 job/level change events; FR-29 headcount coverage.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Product create/change/end Primary UI or event append | Stories 4.5–4.8 |
| Secondary Assignment | Story 3.8 |
| Derived management relationships | Story 3.9 |
| Headcount Approval / consumption / Reservation / Override | Epic 4 FR-28..FR-32 |
| Profile “Assignments” section UI | Epic 5 / UX-DR8 |
| PopulationPort full fixture replacement | Named cutover; complete after 3.8/3.9/4.x as needed |
| Workplace Placement / desk as Team surrogate | Non-MVP addendum |
| Vitest/CI full suite | Thin selfcheck continues |
| Treating Primary projection as event-store | Forbidden (AD-2) |

### Architecture compliance

| Decision | Implication for 3.7 |
| --- | --- |
| AD-1 | Single process + one PostgreSQL; no assignment microservice |
| AD-2 | Primary table = projection; writers prepare for Epic 4 refresh |
| AD-3 | All Primary logic in `@divan/person-employment`; web uses published APIs only |
| AD-5 | Envelope only if governed read routes added |
| AD-6 | Prisma projection + raw SQL EXCLUDE; no web Prisma |
| FR-11 | Exactly one active Primary; overlap blocked; Team + job facts; event-only mutations |
| NFR-4 | Prefer DB exclusion so concurrent overlapping Primaries cannot both commit |
| AR-TEMPORAL partial freeze | Asia/Tehran; date-only; exclusive ends; reuse temporal-engine |

### Conceptual model (must follow)

```
Person 1──* Employment (non-overlapping; ≤1 active as-of)
              │
              └──* PrimaryAssignment (non-overlapping per Employment; cover active Employment)
                    ├── teamId → OrganizationalUnit (TEAM only)     // Team membership
                    ├── organizationalRoleId → OrganizationalRole
                    ├── jobTitleId → JobTitle
                    ├── ladderId → Ladder
                    ├── gradeId → Grade (grade.ladderId === ladderId)
                    └── seniorityId → Seniority? (NO Grade↔Seniority map)

SecondaryAssignment = Story 3.8 (separate)
Headcount consumption = Epic 4 (not required FK here)
Personnel Events = Epic 4 (authoritative writers)
```

Glossary (Persian): Primary Assignment = تخصیص اصلی; Team membership = عضویت تیم; Job facts as in 3.6.

### Temporal / interval rules (must follow)

```
Active at as-of D  ⇔  startDate ≤ D < endDateExclusive
                      (if endDateExclusive is null, treat as +∞)

Overlap(A,B)       ⇔  intervalsOverlap(...)   // same Employment

Back-to-back OK    ⇔  A.endDateExclusive === B.startDate

Primary ⊆ Employment
Coverage           ⇔  every D where Employment active ⇒ exactly one Primary active
```

Do **not** use closed-closed intervals or store end-inclusive dates without converting at the boundary.

### UPDATE files — current state (read before editing)

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `packages/db/prisma/schema.prisma` | Person, Employment, OrgUnit, five job refs; **no** Assignment | Add `PrimaryAssignment` + relations | Employment EXCLUDE semantics; OrgUnit/job-ref master-data unchanged |
| `packages/modules/person-employment/src/employment*.ts` | Projection apply/close/read | Unchanged API; Primary FKs from Employment | No product Employment CRUD |
| `packages/modules/person-employment/src/org-unit.ts` | Dependency hook registry empty of Assignment | Register Primary Team deps | Master-data create/activate/deactivate |
| `packages/modules/person-employment/src/job-reference.ts` | Hook registry for future Assignment | Register Primary job-ref deps | Five distinct refs; no Grade↔Seniority map |
| `packages/modules/person-employment/src/employment-minimum-facts.ts` | Job facts “carriers still 3.7” | Mark Primary schema + invariants live | Headcount still Epic 4 |
| `packages/modules/person-employment/src/population-cutover.ts` | Fixtures until Assignment | Note Primary read helper; no false “cutover complete” | Subject id = Person UUID |
| `packages/modules/person-employment/src/index.ts` | Exports through 3.6 | Export Primary API | Prior exports; no forbidden verbs |
| `packages/modules/person-employment/src/seed.ts` | Org + job-ref + Employment fixtures | Seed Primary covering open Employment | Idempotent seed shape validation |
| `apps/web/**` | No employment router | Prefer **no** UI; optional read-only tRPC only | No Start/Transfer forms |

### Previous story intelligence (3.6 → 3.7)

- Delivery shape for **constraint stories** follows **3.2**, not 3.6: hand-written migration → invariants → `apply*Projection` / `close*Projection` → seed → selfcheck → deferred-work + sprint sync. **No Admin CRUD panel.**
- 3.6 completed job-ref carriers and empty dependency hooks — 3.7 fills FKs and wires those hooks.
- 3.5/3.6 Admin UI on `/organization` stays master-data only; do not imply Assignment write capability.
- Writer naming: `applyPrimaryAssignmentProjection` correct; keep `createPrimaryAssignment` / `transferPrimary` reserved for event-backed product language in Epic 4.
- Must not repeat review misses: empty/whitespace end normalizing to open null on close; invalid `asOf` silently returning null; last-writer-wins close; domain blocks as FORBIDDEN; seed “any length ≥ N” success without shape validation; unmapped `23P01` / `P2003`.
- `baseline_commit`: `914ab55` (story 3.6).

### Git intelligence summary

Recent commits: `914ab55` story 3.6 → `d2e67c4` 3.5 → `d89a2d6` 3.4 → `f271a15` 3.3 → `51eb947` 3.2 → `ce31f55` 3.1. Follow story-commit discipline and selfcheck scripting (`selfcheck:primary-assignment` alongside `selfcheck:employment-lifecycle` / `selfcheck:job-reference`).

### Latest tech information

- **PostgreSQL EXCLUDE + `btree_gist` + half-open `daterange(..., '[)')`:** still the correct NFR-4 pattern; adjacent intervals do not `&&`. Prisma still cannot express EXCLUDE — raw SQL in migration (same as Employment 3.2 / compensation 3.4). Map SQLSTATE `23P01` to `OVERLAPPING_PRIMARY_ASSIGNMENT`.
- **Prisma 7.x (repo):** UUID v7 PKs; `Restrict` FKs; Date `@db.Date` mapping via existing `dateOnlyToDb` / `dateOnlyFromDb` helpers — do not invent a third date codec.
- **Do not add Drizzle** — stack is Prisma.
- No new npm dependencies expected for this story.

### Library / framework requirements

| Lib | Use |
| --- | --- |
| `@divan/temporal-engine` | Interval math / as-of / overlap |
| `@divan/db` | Prisma client accessor inside module |
| Existing job-ref / org-unit helpers | Grade∈Ladder; TEAM type; dependency hooks |
| `@divan/audit-envelope` | Only if optional governed read router added |
| Next.js / tRPC | Optional read-only only — default none |

### File structure requirements

```
packages/db/prisma/schema.prisma                                      # UPDATE — PrimaryAssignment
packages/db/prisma/migrations/<ts>_primary_assignment_integrity/      # NEW — SQL + EXCLUDE
packages/modules/person-employment/src/primary-assignment.ts          # NEW
packages/modules/person-employment/src/primary-assignment-invariants.ts
packages/modules/person-employment/src/primary-assignment.selfcheck.ts
packages/modules/person-employment/src/errors.ts                      # UPDATE
packages/modules/person-employment/src/index.ts                       # UPDATE exports
packages/modules/person-employment/src/seed.ts                        # UPDATE
packages/modules/person-employment/src/employment-minimum-facts.ts    # UPDATE
packages/modules/person-employment/src/population-cutover.ts          # UPDATE notes
packages/modules/person-employment/src/org-unit.ts                    # hook registration call-site OR document import
packages/modules/person-employment/src/job-reference.ts               # hook registration call-site OR document import
packages/modules/person-employment/README.md                          # UPDATE
packages/modules/person-employment/package.json                       # selfcheck script
package.json (root)                                                   # selfcheck:primary-assignment
apps/web/src/server/primary-assignment.ts                             # OPTIONAL read-only
apps/web/src/server/root.ts                                           # OPTIONAL
_bmad-output/implementation-artifacts/deferred-work.md                # UPDATE
```

### Testing requirements

| Case | Expect |
| --- | --- |
| Apply Primary covering open Employment (Team + Role + Title + Ladder + Grade) | Succeeds |
| Second overlapping Primary same Employment | Reject `OVERLAPPING_PRIMARY_ASSIGNMENT` (domain and/or `23P01`) |
| Back-to-back Primaries (`end === next.start`) | Succeeds |
| Active Employment as-of D with zero Primaries | `assertExactlyOne…` / coverage rejects |
| Active Employment as-of D with two Primaries | Impossible if overlap blocked; assert fails closed |
| Primary interval outside Employment | Reject `PRIMARY_OUTSIDE_EMPLOYMENT` |
| Coverage gap under active Employment | Reject `PRIMARY_COVERAGE_GAP` |
| `teamId` points to DEPARTMENT/LEGAL_ENTITY/… | Reject `TEAM_UNIT_REQUIRED` |
| Grade from wrong Ladder | Reject `GRADE_NOT_IN_LADDER` |
| Seniority omitted | Succeeds (optional; proves no Grade↔Seniority map) |
| `closePrimaryAssignmentProjection` then Person/Employment still readable | OK; no cascade delete |
| Second close on already-closed | Reject already-closed |
| Deactivate Team while open Primary references it | Blocked via hook |
| Deactivate JobTitle while open Primary references it | Blocked via hook |
| After Primary closed, deactivate Team/Title | Allowed (no active dep) |
| Public exports include `applyPrimaryAssignmentProjection` | OK |
| Public exports include `createPrimaryAssignment` / `transferPrimary` | Must **not** exist |
| Employment / OrgUnit / job-ref prior selfchecks | Remain green |
| No Start/Transfer UI or mutation tRPC | Assert absence |

### Project context reference

- No `project-context.md` in repo; follow `ARCHITECTURE-SPINE.md`, `epics.md`, Stories 3.1–3.6, and this file.
- Communication with user: Persian; story artifact language: English (document_output_language).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 3.7 / Epic 3 sequencing]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md`#FR-11 / Glossary Assignment]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md`#§2.1–2.2]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/source-extract-pre-prd.md`#BR-ASG-001/003/004/007/009]
- [Source: `_bmad-output/specs/spec-divan/SPEC.md`#CAP-3 success — exactly one active Primary; overlap blocked]
- [Source: `_bmad-output/specs/spec-divan/glossary.md`#Primary Assignment]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md`#AD-2–AD-6 / capability map FR-9..FR-13]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md`#person-profile-section — Assignments = Epic 5]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/mockups/key-profile.html`#تخصیص فعلی — display only; Epic 5]
- [Source: `_bmad-output/implementation-artifacts/3-2-employment-lifecycle-invariants.md` Gate/projection pattern]
- [Source: `_bmad-output/implementation-artifacts/3-6-independent-job-reference-concepts.md` job facts + hooks]
- [Source: `packages/db/prisma/migrations/20260717040000_employment_projection/migration.sql` EXCLUDE pattern]
- [Source: `packages/modules/person-employment/src/employment.ts` apply/close/read]
- [Source: `packages/modules/person-employment/src/org-unit.ts` / `job-reference.ts` dependency hooks]
- [Source: `packages/modules/person-employment/src/employment-minimum-facts.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Migration `20260717230000_primary_assignment_integrity` applied via `prisma migrate deploy`
- Selfchecks: `primary-assignment`, `employment-lifecycle`, `organization-hierarchy`, `job-reference`, `person-identity`, `data-dictionary`, `compensation-facts` — all green
- Typecheck: `@divan/person-employment`, `@divan/db` — pass

### Completion Notes List

- Implemented Primary Assignment projection mirroring Employment 3.2: Prisma model + EXCLUDE per `employmentId`, domain invariants (non-overlap, within-Employment, coverage, Team type, Grade∈Ladder), `applyPrimaryAssignmentProjection` / `closePrimaryAssignmentProjection` (race-safe close), reads including `resolveTeamMembershipAsOf`
- Wired OrgUnit + job-ref dependency hooks via `ensurePrimaryAssignmentHooksRegistered` (seed / apply / close); open Primary blocks deactivate
- No product tRPC/UI; no `createPrimaryAssignment` / `transferPrimary` / `assignPersonToTeam` exports
- Seed: historical closed Primary + open Primary covering demo Employments; `EMPLOYMENT_MINIMUM_FACTS` and `deferred-work.md` updated; PopulationPort cutover not claimed complete

### File List

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260717230000_primary_assignment_integrity/migration.sql`
- `packages/modules/person-employment/src/primary-assignment.ts`
- `packages/modules/person-employment/src/primary-assignment-invariants.ts`
- `packages/modules/person-employment/src/primary-assignment.selfcheck.ts`
- `packages/modules/person-employment/src/errors.ts`
- `packages/modules/person-employment/src/index.ts`
- `packages/modules/person-employment/src/seed.ts`
- `packages/modules/person-employment/src/employment-minimum-facts.ts`
- `packages/modules/person-employment/src/population-cutover.ts`
- `packages/modules/person-employment/README.md`
- `packages/modules/person-employment/package.json`
- `packages/modules/identity-access/src/seed.ts`
- `package.json`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-7-primary-assignment-integrity.md`

### Change Log

- 2026-07-17: Story 3.7 implemented — Primary Assignment schema, integrity, hooks, seed, selfcheck; status → review
- 2026-07-18: Code review patches — active-as-of hooks, read-model null, closed-row guard, seed FK idempotency, deactivate ensure, 23P01 selfcheck, sprint-status encoding; coverage write-path deferred to Epic 4; status → done

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
