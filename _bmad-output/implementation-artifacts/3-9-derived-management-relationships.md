---
baseline_commit: abb8f16
---

# Story 3.9: Derived Management Relationships

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Manager or reporting consumer,
I want management relationships derived from governed Assignment and organization facts,
so that Team/senior manager inference is consistent and access ambiguity fails closed (FR13).

## Gate (read first)

**Epic 3 ↔ Epic 4 sequencing remains inviolable — management relationships are derived read models, not a product mutation surface and not an editable shadow table.**

Epic 3 delivers master-data entities, integrity constraints, reference schemas, and read/display fidelity. Authoritative mutations that create or change **Employment, Primary Assignment, Secondary Assignment, or compensation/contractual *state* through Personnel Events** land only in **Epic 4** after the append-only event store (Story 4.1). Epic 3 MUST NOT introduce a temporary CRUD write path for workforce-state mutations that later must be thrown away.

**This story mirrors Stories 3.2 / 3.7 / 3.8 (constraint + derive/read substrate) — not Stories 3.5–3.6 (Admin master-data CRUD).**

| Allowed in 3.9 | Forbidden in 3.9 |
| --- | --- |
| Pure **derive/read** APIs from Primary Assignment + OrgUnit hierarchy + Role config | Editable `Manager` / `ReportingLine` / `ManagementRelationship` **shadow table** with independent CRUD |
| Provisional **middle-manager / senior-manager Role registry** (fail-closed stub until AR-ACCESS) | Inventing acting / interim / co-manager / reorganization winner rules |
| Team manager from middle-manager Primary on a TEAM; senior-manager targeting approved org levels | Deriving management from **Secondary** Assignment (explicitly forbidden — 3.8) |
| Ambiguity (0 or >1 managers where policy expects one) → typed fail-closed for **access** | Silent pick-first / last-write-wins when duplicate middle managers exist |
| Optional PopulationPort **adapter** (Person-centric edges → fixture `ManagementRelationship` when Account↔Person resolver supplied) | Claiming full PopulationPort cutover complete without documenting remaining Account↔Person gap |
| Seed fixtures: middle-manager Role + Primary on Team + managed member Primary; selfcheck | Admin “set my manager” UI; org-chart UI (post-MVP addendum §14.2) |
| Document FR-13 / BR-ORG-015..017; update deferred-work + population-cutover | Headcount, Personnel Event append, profile Assignments UI, interactive org chart |

- **AD-2:** Derived management is **computed from projections** (Primary + OrgUnit + Role). Recompute on read (or refresh into a non-authoritative cache only if explicitly non-editable and discardable). Never treat a management row as event-store truth.
- **AD-3:** Lives in **`@divan/person-employment`**. Public API from `src/index.ts` only. PopulationPort consumption stays in `@divan/identity-access` via published derive helpers / adapter — no cross-module Prisma imports.
- **AD-5 / AD-6:** Default: **module selfcheck only** (same as Primary/Secondary). If thin governed read tRPC is added: `governedProcedure` + envelope; no `@prisma/client` in `apps/web`; Layout ≠ RSC.
- **FR-13 / BR-ORG-015..017:** Middle-manager Primary on Team X ⇒ Team X manager; detect second active middle manager when policy expects one; senior-manager Assignment may target Team / Department / Business Unit / Legal Entity; ambiguity fails closed for access until AR-ACCESS / AR-TEMPORAL define behavior.
- **Reuse:** `resolveTeamMembershipAsOf`, `getActivePrimaryAssignmentAsOf`, OrgUnit parent walk / `getHierarchyAsOf` / `listChildren`, `@divan/temporal-engine` half-open intervals, Secondary inventory stub pattern for Role registry.
- Prefer **no new Prisma model** unless a non-editable materialization is proven necessary for NFR-13 (~500 people). Default = pure compute. If a table is added, it MUST have no product update API and MUST be regenerable from Primary/org facts alone.
- **AR numbers fail-closed:** do **not** invent AR-ACCESS duplicate/acting/interim/co-manager/reorg policies; do not invent AR-TEMPORAL manager-scope history widening; do not invent AR-IDENTITY Person↔Account permanent FK.

[Source: `epics.md` Epic 3 sequencing + Story 3.9; `prd.md` FR-13 + FR-47; `addendum.md` §8.3 / §12.3 / §14.2; `source-extract-pre-prd.md` BR-ORG-015..018; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6; Stories 3.7–3.8; `population-authz.ts`; `deferred-work.md`]

## Acceptance Criteria

1. **Given** configured middle-manager Primary Assignments (Role codes in provisional management-role registry)  
   **When** management relationships are derived for reporting or scope as-of a date  
   **Then** the Team manager can be identified from the middle-manager’s Primary Assignment to that Team

2. **And** approved senior-manager Role + Primary Assignment targeting an approved organization level (Team / Department / Business Unit / Legal Entity) can derive managed population as Persons whose active Primary Team sits under that org unit in the hierarchy as-of

3. **And** duplicate / acting / interim / co-manager / reorganization behavior follows AR-ACCESS / AR-TEMPORAL; while those artifacts are undefined, **access fails closed** on ambiguity (e.g. two active middle managers on the same Team as-of → typed ambiguity error / empty authorized set — never silent choose-one)

4. **And** derived relationships are **not independently editable** as shadow truth — no Admin/product API to set/edit/delete a “manager link” apart from changing governed Primary / org / Role facts

5. **And** Secondary Assignment is **never** used as the source of management derivation (including inventory code `acting_manager`)

6. **And** derivation is half-open as-of aware (`[start, endExclusive)` via temporal-engine); Team membership continues to come only from Primary (`resolveTeamMembershipAsOf`)

7. **And** a PopulationPort cutover step is delivered **without lying**: either (a) an adapter builds `ManagementRelationship`-compatible edges from Person-centric derivation when a Person→AccountId resolver is provided, with seed wiring for demo manager account, **or** (b) Person-centric APIs land and `population-cutover.ts` / `deferred-work.md` explicitly state what remains (Account↔Person link / fixture subject ids). Do **not** claim full fixture replacement if fixtures remain.

8. **And** Layout ≠ RSC / UI ≠ data access / default-deny / no client `@prisma/client` / OrganizationalScope ≠ OrgUnit / Primary exactly-one + Secondary fidelity + Employment non-overlap remain intact

9. **And** this story does **not** deliver interactive org chart UI (post-MVP), headcount, Personnel Event append (4.1+), profile Assignments section (Epic 5), or product manager-edit UI

## Tasks / Subtasks

- [x] Task 1: Management-role registry stub + pure derivation domain (AC: #1–#6)
  - [x] New files in `@divan/person-employment` (mirror Secondary inventory pattern):
    - `management-relationship.ts` — derive/read APIs
    - `management-relationship-invariants.ts` — pure validators / ambiguity rules
    - `management-role-registry.ts` — provisional Role-code sets (pending AR-ACCESS)
    - `management-relationship.selfcheck.ts`
    - extend `errors.ts`, README, `index.ts`
  - [x] Registry (fail-closed):
    - Export something like `AR_MANAGEMENT_ROLE_REGISTRY` with:
      - `middleManagerRoleCodes: readonly string[]` (e.g. seed `ROLE-MID-MGR`)
      - `seniorManagerRoleCodes: readonly string[]` (e.g. seed `ROLE-SNR-MGR`)
      - `seniorManagerTargetUnitTypes: readonly OrgUnitType[]` — allow `TEAM | DEPARTMENT | BUSINESS_UNIT | LEGAL_ENTITY` per BR-ORG-017
    - Document codes as **provisional until AR-ACCESS**; unknown Role ⇒ not a manager designation (not an error by itself)
    - Empty / sentinel Role codes rejected at registry load/assert helpers
  - [x] Core derive APIs (Person-centric — preferred public surface):
    - `resolveTeamManagerAsOf(teamId, asOf)` → `{ managerPersonId, primaryAssignmentId, organizationalRoleId } | null`
      - Find active Primaries as-of with `teamId` + Role ∈ middleManagerRoleCodes
      - **0** → `null` (no manager configured — callers decide; access consumers fail-closed when manager scope required)
      - **1** → success
      - **>1** → throw typed `AMBIGUOUS_TEAM_MANAGER` (fail-closed for access)
    - `listTeamMembersAsOf(teamId, asOf)` → Person ids with Primary Team membership on that Team (reuse membership path; exclude or include manager per explicit option default **include**)
    - `listManagedPersonsAsOf(managerPersonId, asOf)` → subject Person ids:
      - Middle-manager case: members of Teams where this Person is the unique resolved Team manager
      - Senior-manager case: Persons whose Primary `teamId` is under any org unit targeted by this Person’s active senior-manager Primary (walk ancestors / subtree via OrgUnit parent links)
      - Ambiguous Team under manager’s span → fail-closed (throw or omit with typed reason — **prefer throw** for access paths)
    - `deriveManagementEdgesAsOf(asOf)` → list of `{ managerPersonId, subjectPersonId, scopeKind: "team" | "senior", orgUnitId, validFrom, validToExclusive }` for reporting (FR-36 foreshadow)
    - Interval on edges: intersect manager’s Primary interval with subject’s Primary (Team membership) interval — half-open
  - [x] Senior-manager targeting:
    - Senior manager’s Primary still requires a `teamId` (TEAM) per 3.7 schema — **do not** change Primary schema to allow non-TEAM org FK in 3.9
    - Interpret “targets approved organization level” via registry + **optional** convention documented in Dev Notes:
      - **Recommended MVP interpretation (no schema change):** senior-manager Role on a Primary whose Team’s **ancestor chain** includes the intended scope unit; managed population = all Persons with Primary Team under that ancestor. Prefer explicit `resolveSeniorManagerScopeOrgUnitAsOf(managerPersonId, asOf)` that walks from manager’s Team up to the highest ancestor whose unitType is in an approved “senior scope stop” list — **OR** simpler: senior Role manages the **Department** (parent of Team) subtree by default when Role ∈ seniorManagerRoleCodes.
      - Document chosen interpretation in README + deferred-work; do **not** invent AR-ACCESS senior-manager scope matrix beyond one clear, tested rule
    - If interpretation cannot be expressed without inventing policy, implement Team middle-manager path fully and stub senior path as fail-closed (`SENIOR_MANAGER_POLICY_UNDEFINED`) until registry flag enables the single documented rule — **prefer shipping one clear senior rule over two vague ones**
  - [x] Typed errors + Persian `messageFa` + stable codes (clients match **codes**), e.g.:
    - `AMBIGUOUS_TEAM_MANAGER`
    - `AMBIGUOUS_MANAGEMENT_SCOPE`
    - `MANAGEMENT_ROLE_REGISTRY_INVALID`
    - `SENIOR_MANAGER_POLICY_UNDEFINED` (only if senior path gated)
    - `ORG_UNIT_NOT_FOUND` / reuse existing where applicable
  - [x] Export from `src/index.ts` only
  - [x] **Do not** export `setManager` / `assignManager` / `createManagementRelationship` / `updateReportingLine`
  - [x] **Do not** read Secondary for derivation

- [x] Task 2: Schema decision — prefer no table (AC: #4)
  - [x] **Default:** no Prisma model / no migration for management links
  - [x] If performance evidence requires materialization (~500 people should not): only a **regenerable** projection table with `refreshManagementProjectionAsOf` / full rebuild from Primary+org — **no** row-level product edits; document regeneration as source of truth refresh (AD-2)
  - [x] Update `schema.prisma` header comment: management relationships derived (3.9 / FR-13); not independently editable
  - [x] Prefer hand-written migration only if table added (`prisma migrate deploy`)

- [x] Task 3: PopulationPort adapter / cutover honesty (AC: #7)
  - [x] Update `population-cutover.ts` with precise 3.9 status (what landed vs remaining)
  - [x] In `@divan/identity-access` **or** person-employment adapter module:
    - Provide `buildManagementRelationshipsFromDerivation(edges, resolveAccountIdForPerson)` → `ManagementRelationship[]` matching existing type (`managerAccountId`, `subjectId`, `validFrom`, `validToExclusive`)
    - `subjectId` target remains **Person UUID** (`Person.id`) per Story 3.1 cutover note
    - Person→AccountId resolver is **injected** — do **not** add permanent `Person.accountId` FK without AR-IDENTITY
  - [x] Seed path: map demo middle-manager Person → seeded `manager` InternalAccount id (username `manager`) via explicit seed registry / test hook; wire optional `setPopulationFixtureRegistryForTests` **only in selfcheck**, not silently in production boot unless a deliberate dual-run flag exists
  - [x] Preserve Story 2.6 FR-47 semantics: management-derived default only inside relationship interval; cross_time_scope still required for pre/post-scope
  - [x] **Honesty rule:** if fixture subjects (`person:a1`, …) still power default `intersectPopulation`, say so in deferred-work — “derivation APIs live; default PopulationPort registry still fixture-backed” is an acceptable done state for 3.9 **if** documented. Completing full default-registry replacement is best-effort when seed Account↔Person mapping is solid.

- [x] Task 4: Authz / tRPC — read-only or none (AC: #4, #8, #9)
  - [x] **Default (recommended):** no new tRPC — prove via selfcheck
  - [x] If thin governed read added: `resolveTeamManagerAsOf` / `listManagedPersonsAsOf` behind existing person/org read permissions; `governedProcedure`; domain ambiguity → `BAD_REQUEST` (or dedicated fail-closed mapping), not silent empty success for access-critical paths
  - [x] **Forbidden:** manager create/edit UI on `/personnel` or `/organization`; interactive org chart

- [x] Task 5: Seed + selfcheck + deferred-work + DoD (AC: #1–#9)
  - [x] Seed:
    - OrganizationalRole codes for middle-manager (+ senior if implemented)
    - Register codes in `management-role-registry.ts`
    - Person A: Primary with middle-manager Role on `TEAM-DEMO` (or dedicated team)
    - Person B: Primary member on same Team (non-manager Role — reuse `ROLE-HR-SPEC` or add `ROLE-IC`)
    - Optional: second middle-manager Primary overlapping same Team in a **closed** historical interval or a selfcheck-only temporary apply to prove `AMBIGUOUS_TEAM_MANAGER`
    - Optional senior-manager fixture if senior path ships
  - [x] `management-relationship.selfcheck.ts` + package script + root `selfcheck:management-relationships`
  - [x] Cases in Testing table below
  - [x] Update `deferred-work.md`: FR-13 derivation landed; AR-ACCESS/AR-TEMPORAL still pending; Secondary not source; PopulationPort status honest; org chart still post-MVP
  - [x] Update `employment-minimum-facts.ts` / README: management derivation live (3.9)
  - [x] Preserve prior selfchecks green: person-identity, employment-lifecycle, data-dictionary, organization-hierarchy, job-reference, primary-assignment, secondary-assignment, compensation-facts, audit-envelope / temporal-cross-boundary as applicable
  - [x] `pnpm` typecheck: `@divan/person-employment`, `@divan/db`, `@divan/temporal-engine`, `@divan/identity-access` (if touched)
  - [x] **When marking done:** sync story-file `Status: done` with `sprint-status.yaml` key `3-9-derived-management-relationships`
  - [x] No UTF-8 BOM on `sprint-status.yaml`

### Review Findings

- [x] [Review][Decision] Derive/adapter ambiguity vs access fail-closed — **Resolved: B** — `deriveManagementEdgesAsOf` throws the same typed fail-closed errors as access paths (`AMBIGUOUS_TEAM_MANAGER` / `AMBIGUOUS_MANAGEMENT_SCOPE`); no silent skip for reporting when ambiguity exists.

- [x] [Review][Patch] Strip UTF-8 BOM from `sprint-status.yaml` [`_bmad-output/implementation-artifacts/sprint-status.yaml:1`]
- [x] [Review][Patch] Use as-of OrgUnit + require `unitType === "TEAM"` in team manager/member resolution [`packages/modules/person-employment/src/management-relationship.ts:164`]
- [x] [Review][Patch] Align manager candidate load with active Employment (same path as `resolveTeamMembershipAsOf`) [`packages/modules/person-employment/src/management-relationship.ts:95`]
- [x] [Review][Patch] Replace bare `catch { continue }` on senior scope in `deriveManagementEdgesAsOf` — rethrow unknown; handle ambiguity per Decision above [`packages/modules/person-employment/src/management-relationship.ts:514`]
- [x] [Review][Patch] Wrap `ensureManagerPrimary` deleteMany + apply in a transaction [`packages/modules/person-employment/src/seed.ts:1268`]
- [x] [Review][Patch] Selfcheck: add `AMBIGUOUS_MANAGEMENT_SCOPE` (ambiguous team inside senior span) + FR-47 `managementCovers` via derived adapter edges [`packages/modules/person-employment/src/management-relationship.selfcheck.ts`]
- [x] [Review][Patch] Normalize senior Role codes in Prisma `in` filter to match `isSeniorManagerRoleCode` uppercase semantics [`packages/modules/person-employment/src/management-relationship.ts:489`]
- [x] [Review][Patch] Dedupe adapter output on `managerAccountId`+`subjectId` (team+senior can emit same pair) [`packages/modules/person-employment/src/management-relationship.ts:568`]
- [x] [Review][Patch] Registry assert: reject overlapping middle/senior Role codes [`packages/modules/person-employment/src/management-role-registry.ts:123`]

- [x] [Review][Defer] N+1 / O(teams×members) derive queries without batching [`packages/modules/person-employment/src/management-relationship.ts:421`] — deferred, pre-existing scale concern for ~500 MVP; revisit if NFR-13 pressure appears
- [x] [Review][Defer] `dateOnlyFromDb` via `toISOString().slice(0,10)` UTC mapping [`packages/modules/person-employment/src/management-relationship.ts:80`] — deferred, pre-existing
- [x] [Review][Defer] Management selfcheck mutates shared seed DB with best-effort restore [`packages/modules/person-employment/src/management-relationship.selfcheck.ts`] — deferred, pre-existing thin-selfcheck pattern

## Dev Notes

### Epic 2 / 3.1–3.8 carry-in

| Item | How 3.9 absorbs it |
| --- | --- |
| Epic 3↔4 no temporary CRUD | Gate + Tasks 1–4: derive/read only; no manager product API/UI |
| Primary projection (3.7) | **Sole** management source + Team membership |
| Secondary (3.8) | Explicitly **not** a management source (`acting_manager` inventory ≠ derivation) |
| OrgUnit hierarchy (3.5) | Parent walk / subtree for senior scope + Team identity |
| Job refs / Role (3.6) | Middle/senior designation via Role **code registry**, not a new Role attribute column unless unavoidable |
| PopulationPort (2.6) | Adapter + honest cutover notes; keep FR-47 interval + cross_time_scope |
| OrganizationalScope ≠ OrgUnit | Derived management feeds population edges; does not redefine OrgUnit master-data |
| Status ↔ sprint alignment | Task 5 DoD on done transition |
| AR numbers fail-closed | Provisional Role registry; ambiguity → typed fail-closed |
| 3.7/3.8 review lessons | Seed shape/cardinality; no BOM; selfcheck restore; don’t invent Vitest suite |

### Epic context

- **Epic 3:** Workforce Master Data & Organization — FR5–FR13. **This is the last story.**
- **This story:** FR-13 — derive/report management from Assignment + org facts; fail-closed ambiguity; no editable shadow truth.
- **Upstream (done):** 3.1–3.8 (Person → Employment → Dictionary → Compensation → Org → Job refs → Primary → Secondary).
- **Downstream:** Epic 3 retrospective (optional); Epic 4 events mutate Primary (derivation follows automatically); Epic 5 reports FR-36 “inferred middle manager”; Epic 6 reconciliation “manager counts”; FR-47 consumers keep fail-closed on stale/ambiguous.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Interactive org chart / hierarchy visualization | Post-MVP addendum §14.2 |
| Acting / interim / co-manager winner policy | AR-ACCESS (+ AR-TEMPORAL) |
| Reorganization manager-scope rules | AR-ACCESS / AR-TEMPORAL |
| Permanent Person↔Account FK / AR-IDENTITY merge | AR-IDENTITY |
| Product create/change/end Assignment | Epic 4 |
| Profile Assignments UI | Epic 5 / UX-DR8 |
| Headcount | Epic 4 |
| Treating Secondary `acting_manager` as Team manager | Forbidden |
| Vitest/CI full suite | Thin selfcheck continues |
| Editable management shadow table as authority | Forbidden (AD-2 / FR-13) |

### Architecture compliance

| Decision | Implication for 3.9 |
| --- | --- |
| AD-1 | Single process + one PostgreSQL; no management microservice |
| AD-2 | Derived edges recomputed from Primary/org projections |
| AD-3 | Logic in `@divan/person-employment`; identity-access consumes published API |
| AD-5 | Envelope only if governed read routes added |
| AD-6 | No web Prisma |
| FR-13 | Middle-manager Team inference; senior targets approved levels; ambiguity fail-closed |
| FR-11 | Primary / Team membership unchanged |
| FR-12 | Secondary unchanged and unused for derivation |
| FR-47 | Management-derived scope bounded by relationship interval |
| NFR-3 | Stale/unreconciled derived state must not present as current truth — fail-closed when unreconciled flag set (existing PopulationPort) |
| NFR-13 | ~500 people — pure compute is enough; avoid premature materialization |
| AR-ACCESS / AR-TEMPORAL pending | Registry stub + fail-closed ambiguity; no invented policies |

### Conceptual model (must follow)

```
Person
  └── Employment (active as-of)
        └── PrimaryAssignment (exactly one active)
              ├── teamId → TEAM OrgUnit
              ├── organizationalRoleId → Role code
              │     └── ∈ middleManagerRoleCodes  ⇒ candidate Team manager
              │     └── ∈ seniorManagerRoleCodes  ⇒ senior scope (documented rule)
              └── job facts (Title/Ladder/Grade/Seniority) — not management source alone

OrgUnit: LEGAL_ENTITY → BUSINESS_UNIT → DEPARTMENT → TEAM

SecondaryAssignment — NOT a management source

Derived (computed, not editable):
  TeamManager(teamId, asOf) → Person | null | AMBIGUOUS
  ManagedPersons(managerPersonId, asOf) → Person[]
  ManagementEdge { managerPersonId, subjectPersonId, interval }

PopulationPort (identity-access):
  ManagementRelationship { managerAccountId, subjectId=Person.id, validFrom, validToExclusive }
  ← adapter(Person edges + Person→AccountId resolver) — optional / partial cutover OK if honest
```

Glossary (Persian): management relationship = رابطه مدیریتی; middle manager = مدیر میانی; senior manager = مدیر ارشد; derived = مشتق‌شده; fail closed = رد امن / بدون حدس.

### Temporal / interval rules (must follow)

```
Active at as-of D  ⇔  startDate ≤ D < endDateExclusive
                      (null endDateExclusive = +∞)

Edge validity      ⇔  intersection of manager Primary interval
                      and subject Primary (membership) interval

Ambiguity at D     ⇔  >1 middle-manager Primary active on same Team at D
                      → AMBIGUOUS_TEAM_MANAGER (access fail-closed)
```

### Primary vs Secondary vs Derived management (do not confuse)

| Aspect | Primary (3.7) | Secondary (3.8) | Management (3.9) |
| --- | --- | --- | --- |
| Storage | Projection table | Projection table | **Computed** (default) |
| Editable product API | Epic 4 events | Epic 4 events | **Never** independent |
| Team membership | Yes | No | Uses Primary membership |
| Headcount | Epic 4 | Never by default | N/A |
| Manager inference source | **Yes** (Role + Team) | **No** | Output of derivation |

### UPDATE files — current state (read before editing)

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `packages/modules/person-employment/src/primary-assignment.ts` | apply/close/read + `resolveTeamMembershipAsOf` | **Reuse** for membership; do not weaken exactly-one | EXCLUDE, hooks, coverage asserts |
| `packages/modules/person-employment/src/secondary-assignment.ts` | Secondary projection + inventory | Unchanged; **not** called by derivation | Inventory + EXCLUDE |
| `packages/modules/person-employment/src/org-unit.ts` | Hierarchy CRUD + `getHierarchyAsOf` / `listChildren` | Reuse parent/subtree walks | LE→BU→Dept→Team rules |
| `packages/modules/person-employment/src/job-reference.ts` | Role master-data | Seed extra Role codes; no Grade↔Seniority map | Five distinct refs |
| `packages/modules/person-employment/src/population-cutover.ts` | Notes wait on 3.9/4.x | Update honest 3.9 cutover status | Subject id = Person UUID |
| `packages/modules/person-employment/src/employment-minimum-facts.ts` | Through Secondary | Note management derivation live | Epic 4 mutations still deferred |
| `packages/modules/person-employment/src/seed.ts` | Primary + Secondary fixtures | Middle-manager (+ member) Primaries; Role codes | Idempotent FK/shape/cardinality checks |
| `packages/modules/person-employment/src/index.ts` | Through Secondary | Export derive APIs + registry | No forbidden verbs |
| `packages/modules/person-employment/src/errors.ts` | Primary/Secondary errors | ManagementRelationshipError (+ codes) | Existing codes stable |
| `packages/modules/identity-access/src/population-authz.ts` | Fixture `ManagementRelationship` + `intersectPopulation` | Optional adapter / selfcheck wiring; keep FR-47 | Fixture selfchecks still green |
| `packages/db/prisma/schema.prisma` | Primary + Secondary | Header note; **prefer no new model** | Existing EXCLUDEs / FKs |
| `apps/web/**` | No management UI | Prefer **no** UI | No manager-edit forms; no org chart |
| `_bmad-output/implementation-artifacts/deferred-work.md` | 3.9 still open | Mark derivation landed; remaining AR/cutover gaps | Keep other open items |

### Previous story intelligence (3.8 → 3.9)

- Delivery shape for **constraint/derive stories** follows **3.2 / 3.7 / 3.8**, not 3.5/3.6: domain module → (optional migration) → seed → selfcheck → deferred-work + sprint sync. **No Admin CRUD panel.**
- 3.8 completed Secondary and explicitly deferred management derivation to 3.9 **from Primary only**.
- Writer naming for projections was `apply*Projection` / `close*Projection`. For 3.9 prefer `resolve*` / `list*` / `derive*` — **not** `applyManagementRelationshipProjection` unless a regenerable cache table is justified.
- Inventory stub pattern (`secondary-assignment-inventory.ts`) is the template for `management-role-registry.ts`.
- Must apply 3.7/3.8 quality bar: seed FK shape + exact cardinality; race-safe patterns if writers exist; no sprint-status BOM; selfcheck mutates shared DB with best-effort restore; map domain errors to stable codes.
- `baseline_commit`: `abb8f16` (story 3.8).

### Git intelligence summary

Recent commits: `abb8f16` story 3.8 → `e5830d7` story 3.7 → `914ab55` story 3.6 → `d2e67c4` 3.5 → `d89a2d6` 3.4. Follow story-commit discipline and selfcheck scripting (`selfcheck:management-relationships` alongside primary/secondary/employment).

### Latest tech information

- **Prefer application-layer derivation over Prisma result extensions** for cross-model graph walks (Primary + Role + OrgUnit parents). Prisma Client `result` extensions only support scalar `needs` on a single model and are a poor fit for management graphs ([Prisma result extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions/result)).
- **Do not** store editable derived manager FKs on Person/Employment — violates FR-13 “not independently editable as shadow truth.”
- Half-open `daterange` / temporal-engine patterns from 3.2/3.7/3.8 remain the interval source of truth; reuse `dateOnlyInInterval` / `intervalsOverlap` rather than inventing a third date codec.
- NFR-13 ~500 people: in-process derive over Primary rows filtered by `teamId` + as-of is sufficient; avoid Redis/cache unless measured.

### Project Structure Notes

- Package: `packages/modules/person-employment` (FR-9..FR-13 capability map).
- Identity bridge: `packages/modules/identity-access/src/population-authz.ts` (consumer).
- No separate `organization` package — org hierarchy already in person-employment.
- Web: no default surface; org IA “ساختار سازمان” is Admin master-data (3.5/3.6), not org-chart.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.9]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-13, FR-36, FR-47]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §8.3 inferred middle manager; §14.2 org chart post-MVP]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/source-extract-pre-prd.md` — BR-ORG-015..018]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2/AD-3; FR-9..FR-13 → person-employment]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — org IA FR-9–FR-13; no org-chart MVP]
- [Source: `packages/modules/identity-access/src/population-authz.ts` — `ManagementRelationship`, FR-47]
- [Source: `packages/modules/person-employment/src/primary-assignment.ts` — `resolveTeamMembershipAsOf`]
- [Source: `_bmad-output/implementation-artifacts/3-8-secondary-assignment-fidelity.md` — prior intelligence]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

## Testing requirements

| Case | Expected |
| --- | --- |
| One middle-manager Primary on Team T as-of D | `resolveTeamManagerAsOf(T,D)` → that Person |
| Zero middle-manager on Team T | `null` (not throw) |
| Two active middle-managers on Team T as-of D | `AMBIGUOUS_TEAM_MANAGER` |
| Member Primary on T; manager resolved | `listManagedPersonsAsOf(manager,D)` includes member Person id |
| Subject leaves Team (Primary ends) | No longer in managed set after end exclusive |
| Manager Role not in registry | Not treated as Team manager |
| Secondary `acting_manager` only (no middle-manager Primary) | Does **not** make Person Team manager |
| As-of before manager Primary start | No manager / not in edges |
| Senior path (if enabled) | Persons under scoped org subtree included; document rule in assertion comments |
| Ambiguous Team inside senior span | Fail-closed typed error |
| PopulationPort adapter selfcheck (if wired) | `managementCovers` true inside derived interval for mapped account; false outside; cross_time_scope still required for out-of-interval |
| Prior selfchecks | primary / secondary / org / job-ref / employment still green |

Run: `pnpm selfcheck:management-relationships` (and prior selfchecks listed in Task 5).

### Interactive a11y DoD

N/A for default (no UI). If a governed read surface is added later, apply Epic 1 a11y checklist (focus order, Persian copy, no info-only color).

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Selfcheck restore: closed Primary cannot reopen by id — deleteMany + re-apply for member leave-team case.
- Typecheck: const registry length===0 check narrowed by TS — assert via copied string arrays.

### Completion Notes List

- Implemented pure FR-13 derive/read in `@divan/person-employment`: registry stub, team middle-manager resolution (fail-closed ambiguity), Department-parent senior scope MVP, management edges with half-open interval intersection, PopulationPort adapter with injected Account resolver.
- No Prisma management table; schema header documents derived-only. No tRPC/UI. Secondary never consulted.
- Seed: ROLE-MID-MGR / ROLE-SNR-MGR + Persons 10002/10003 on TEAM-DEMO; demo 10001 remains IC member. Honest PopulationPort cutover docs.
- Verified: `selfcheck:management-relationships`, primary/secondary/org/job-ref selfchecks, typecheck on person-employment/db/temporal-engine/identity-access.

### File List

- packages/modules/person-employment/src/management-relationship.ts
- packages/modules/person-employment/src/management-relationship-invariants.ts
- packages/modules/person-employment/src/management-role-registry.ts
- packages/modules/person-employment/src/management-relationship.selfcheck.ts
- packages/modules/person-employment/src/errors.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/src/seed.ts
- packages/modules/person-employment/src/population-cutover.ts
- packages/modules/person-employment/src/employment-minimum-facts.ts
- packages/modules/person-employment/README.md
- packages/modules/person-employment/package.json
- packages/modules/identity-access/src/seed.ts
- packages/modules/identity-access/src/population-authz.ts
- packages/db/prisma/schema.prisma
- package.json
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/3-9-derived-management-relationships.md

### Change Log

- 2026-07-18: Implemented Story 3.9 derived management relationships (FR-13) — pure compute + seed + selfcheck; PopulationPort adapter honest cutover; status → review.
- 2026-07-18: Code review patches applied (Decision B fail-closed derive; OrgUnit/Employment as-of; seed txn; selfcheck ambiguity/FR-47; BOM strip); status → done.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
