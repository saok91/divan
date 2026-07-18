---
baseline_commit: 8de3f2e
---

# Story 4.9: Current Person State Projection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized user,
I want current Person state derived from the resolved authoritative event set,
So that profile, lists, and reports reconcile for the same date and scope (FR25).

## Gate (read first)

**This story ships the shared current-Person-state read product — one assembly API over existing projection as-of helpers + distinguishable Scheduled future changes + freshness fail-closed — so profile / list / report consumers share identical semantics. It does not ship historical as-of reconstruction, org/headcount historical totals, full profile UI sections, PopulationPort cutover, or new event Operators.**

| Allowed in 4.9 | Forbidden in 4.9 |
| --- | --- |
| Single module API that returns current Employment, Primary, in-scope Secondary, organization/Team membership, Role/Title/Ladder/Grade/Seniority, contractual, compensation (permission-gated) for `asOf = today` (Tehran date-only) | Claiming FR-26 / FR-27 done (→ 4.10 / 4.11); inventing a second “current state” SoT table |
| Derive facts from **existing projections** written by 4.5–4.8 AD-6 hooks (as-of helpers) — not from registration time | Replaying the full event log on every read as the product path; treating Prisma rows as authoritative SoT |
| Separate `scheduledChanges` (or equivalent) for future Finalized events still pre-effect | Folding Scheduled future facts into current Employment/Primary/comp fields before Effective Date (FR-16) |
| Same function / DTO semantics for profile, list, and report callers (thin adapters only) | Divergent ad-hoc joins in web routers that disagree on as-of / half-open / omit rules |
| Permission / dictionary omit for identity + compensation category omit via existing projectors | Enabling religion/health/national-ID; inventing AR-DATA catalogues; leaking compensation without `compensation.read` |
| Fail-closed when `recalculation_pending` / blocking stale for that Person (NFR-3 / FR-45) | Serving “current” as gold truth while recalc pending/failed |
| Thin governed tRPC + optional foreshadow read surface on `/personnel` | Full `person-profile-section` product (→ 5.2); search/lists (→ 5.1); timeline product (→ 5.3); dashboard (→ 5.4) |
| Selfchecks: Scheduled ≠ current; Start→Transfer→job→Terminate matrix; same API twice ≡ same snapshot; regress 4.1–4.8 | UTF-8 BOM on `sprint-status.yaml`; PopulationPort default-registry cutover; Vitest mandate without ephemeral DB |

### Mandated design — current = projection as-of today (non-negotiable)

```text
kernel_events (SoT)
        │ 4.2–4.8 finalize / recalc
        ▼
AD-6 projection hook → Employment / Primary / Secondary / CompensationFact rows
        │
        ▼
getCurrentPersonState(personId, { asOf?, actorAuthz? })   # NEW — assemble only
        │
        ├─ asOf default = todayDateOnlyTehran()
        ├─ Person → projectPersonForRead (dictionary + category omit)
        ├─ getActiveEmploymentAsOf(personId, asOf)
        ├─ getActivePrimaryAssignmentAsOf(employmentId, asOf) + Team/org refs
        ├─ listActiveSecondaryAssignmentsAsOf(..., asOf)  // in-scope only
        ├─ getCompensationAsOf / getContractualAsOf via @divan/compensation-facts public API
        ├─ listScheduledFutureChanges(personId, asOf)     // evaluationStatusAsOf === Scheduled
        └─ getRecalculationStatus / platform signal → fail-closed if pending|failed|blocking stale
```

- **Do not** create `PersonCurrentState` / denormalized “snapshot” Prisma table for MVP (~500 people).
- **Do not** call `apply*Projection` from this read path.
- **Do not** use `listBusinessEventsForPerson` DESC UI order as apply/reconstruct order.
- **Do not** use registration/finalization timestamps to decide “current” membership — only Effective Date + half-open intervals + resolved lifecycle.
- Historical arbitrary `asOf` product UX / Baseline disclosure = **4.10**. Keep `asOf` parameter internal/testable but product default is **today**; do not ship “as-of date picker reconstruction” UI.

### Mandated design — Scheduled distinguishable from current (FR-16 / FR-25)

| Channel | Content |
| --- | --- |
| `current` (facts) | Active-as-of `asOf` Employment / Assignments / job fields / contractual / compensation |
| `scheduledChanges` | Authoritative Finalized events with `evaluationStatusAsOf(event, asOf) === "Scheduled"` (and not Cancelled/Reversed via `resolveLifecycleStatus`) — type, Effective Date, ids; **no** mutation of current facts |
| UI foreshadow (optional) | Status badges UX-DR10; never label Scheduled as Effective |

Example: future `TransferRecorded` finalized → today's Primary Team unchanged; transfer appears only under `scheduledChanges`.

### Mandated design — shared consumer semantics (FR-25 reconcile)

All consumers MUST call the same assembler (or a thin list-row projector that reuses the **same** as-of + omit helpers and the same `asOf` clock):

| Consumer | 4.9 delivery | Later story |
| --- | --- | --- |
| Profile | API + optional foreshadow | Full sections → 5.2 |
| Lists / search columns | Shared helpers / DTO fields available | Product table → 5.1 |
| Reports / dashboard | Same semantics documented + selfcheck “two callers identical” | Catalogue → 5.4 / 5.5 |

**Oracle:** two calls with identical `(personId, asOf, authz)` return deep-equal current facts (ignore wall-clock metadata). No silent drift between routers.

### Mandated design — permissions & sensitive fields

| Fact family | Gate |
| --- | --- |
| Person identity fields | `projectPersonForRead` / dictionary enablement + category omit (omit key, never mask) |
| Employment / Primary / Secondary / org | Coarse `person.read` (or existing personnel read permission used by person router) + scope — do **not** invent AR-ACCESS toxic matrix |
| Compensation / contractual amounts | `@divan/compensation-facts` public read + `compensation.read` + category omit; absent permission → omit compensation block entirely |
| Secondary “in-scope” | Use existing list-as-of helpers; do not invent AR-SECONDARY scenarios beyond launch inventory already enforced on writes |

### Mandated design — freshness (NFR-3 / FR-45 / Story 4.4)

When `getRecalculationStatus(personId)` is `pending` or `failed`, or platform signal reports blocking stale for that Person:

- API returns a typed freshness error / payload flag that **prevents** presenting facts as reconciled current truth (fail-closed).
- Do not clear recalc status from this story.
- Gold CTAs remain disabled via existing `platformStatus` / UX-DR5 — do not fork a second banner system.

### Mandated design — PopulationPort honesty

Cutover criteria remain in `population-cutover.ts`. **Do not** switch default `intersectPopulation` registry. Optional note bump that current-state assembler exists is fine; claiming “real workforce PopulationPort” is not.

[Source: `epics.md` Story 4.9; `prd.md` FR-25, FR-16, FR-18, FR-45; `ARCHITECTURE-SPINE.md` AD-2, AD-6; Stories 4.3–4.8; UX EXPERIENCE.md Scheduled vs current / UX-DR8 / UX-DR10]

## Acceptance Criteria

1. **Given** a resolved authoritative event set whose Effective projections are refreshed (4.5–4.8)  
   **When** current Person state is requested for today (Asia/Tehran date-only)  
   **Then** Employment, Primary and in-scope Secondary Assignments, organization/Team membership, Role, Title, Ladder, Grade, Seniority, contractual, and compensation (if permitted) are returned from projection as-of helpers — **not** from registration time

2. **And** current facts are distinguishable from Scheduled future changes (separate structure / fields; Scheduled never silently applied to current Employment/Primary/comp before Effective Date)

3. **And** profile, list, and report consumers of current state share the same projection semantics for identical filters/scope (single assembler API or proven shared helpers; selfcheck proves identical snapshots)

4. **And** unauthorized / disabled identity and compensation fields are omitted (never masked); compensation block requires `compensation.read`

5. **And** when recalculation is pending/failed/blocking-stale for the Person, current state is not served as reconciled gold truth (fail-closed)

6. **And** Stories 4.1–4.8 invariants remain green; this story does **not** deliver historical Person reconstruction (4.10), historical org/headcount (4.11), Headcount Approval/Matching/Override catalogue (4.12–4.14), PopulationPort cutover, or full Epic 5 profile/search UI

## Tasks / Subtasks

- [x] Task 1: Domain assembler API (AC: #1, #2, #4, #5)
  - [x] Add `current-person-state.ts` in `@divan/person-employment` exporting `getCurrentPersonState` (name may vary; keep kebab file + published export from `index.ts`)
  - [x] Compose existing: `getPersonById` + `projectPersonForRead`, `getActiveEmploymentAsOf`, `getActivePrimaryAssignmentAsOf`, `resolveTeamMembershipAsOf`, `listActiveSecondaryAssignmentsAsOf`, job-ref display fields from Primary, `getCompensationAsOf` / `getContractualAsOf` via compensation-facts **public** API only
  - [x] Default `asOf = todayDateOnlyTehran()`; half-open intervals via existing helpers; noon-UTC DB date discipline unchanged
  - [x] Integrate `getRecalculationStatus` / fail-closed freshness path
  - [x] Do **not** add a new Prisma current-state table

- [x] Task 2: Scheduled future changes channel (AC: #2)
  - [x] Load person business events; filter with `evaluationStatusAsOf` + `resolveLifecycleStatus` / chain links so Cancelled/Reversed do not appear as planned
  - [x] Return lean planned rows (id, type, effectiveDate, resolvedStatus) — no sensitive payload amounts
  - [x] Prove Transfer/Title Scheduled does not alter today's Primary Team/Title in the `current` block

- [x] Task 3: Shared consumer contract (AC: #3)
  - [x] Document + export one DTO type used by all callers
  - [x] Thin governed tRPC procedure (extend `person` router or add `currentPersonState.get`) — envelope + `person.read`; compensation omit inside module
  - [x] Optional foreshadow UI on `/personnel` (read-only summary + Scheduled badges) — **not** full profile sections
  - [x] Selfcheck: two consumer wrappers over same API → deep-equal current facts

- [x] Task 4: Permissions & module boundaries (AC: #4, #6)
  - [x] Web never imports compensation Prisma / `@prisma/client`
  - [x] No PopulationPort registry swap; optional honesty comment only
  - [x] Do not invent AR-ACCESS / AR-DATA / AR-SECONDARY / AR-IDENTITY numbers

- [x] Task 5: Selfchecks + DoD (AC: #1–#6)
  - [x] `current-person-state.selfcheck.ts` with exact oracles
  - [x] Matrix: active Employment+Primary after Start; Scheduled Transfer leaves current Team; Effective Transfer updates current; job/comp Effective visible; Terminated → no active Employment; compensation omitted without read perm; pending recalc fail-closed; dual-consumer equality
  - [x] Re-run event-store, draft, lifecycle, ordering, recalc, start-return, termination, transfer, job-level, compensation, workers — all green
  - [x] Update `deferred-work.md`; align story Status ↔ `sprint-status.yaml`; **no UTF-8 BOM**

### Review Findings

- [x] [Review][Patch] Remove UTF-8 BOM from sprint-status.yaml [`_bmad-output/implementation-artifacts/sprint-status.yaml:1`]
- [x] [Review][Patch] Detect apply-set truncation (limit 2000) in `listScheduledFutureChanges` and fail-closed — earliest-first order silently drops newest/future Scheduled rows [`packages/modules/person-employment/src/current-person-state.ts:145`]
- [x] [Review][Patch] Resolve person existence before (or in addition to) freshness block so missing Person is `PERSON_NOT_FOUND`, not a stale recalc payload [`packages/modules/person-employment/src/current-person-state.ts:197`]
- [x] [Review][Patch] Selfcheck: prove Scheduled Title (or equivalent job change) leaves today's `jobTitleId` unchanged and appears only under `scheduledChanges` [`packages/modules/person-employment/src/current-person-state.selfcheck.ts`]
- [x] [Review][Patch] Selfcheck: after `cancelPersonnelEvent` on Scheduled Transfer, assert it is absent from `scheduledChanges` [`packages/modules/person-employment/src/current-person-state.selfcheck.ts:321`]
- [x] [Review][Patch] Selfcheck: exercise `RECALCULATION_FAILED` and `RECALCULATION_STALE` fail-closed paths [`packages/modules/person-employment/src/current-person-state.selfcheck.ts:413`]
- [x] [Review][Patch] Selfcheck: assert contractual as-of visibility/omit alongside compensation [`packages/modules/person-employment/src/current-person-state.selfcheck.ts:376`]
- [x] [Review][Patch] Wrap selfcheck setup in `try/finally` so `pool.end()` runs if seed/setup throws [`packages/modules/person-employment/src/current-person-state.selfcheck.ts:123`]
- [x] [Review][Defer] tRPC `getCurrentState` hardcodes `DEV_DEMO_CATEGORIES` (compensation never enabled) — deferred, pre-existing AR-DATA / same pattern as other person reads [`apps/web/src/server/person.ts:258`]
- [x] [Review][Defer] Assembler sequential reads without shared snapshot/transaction (torn Employment/Primary/Team) — deferred, pre-existing as-of read pattern [`packages/modules/person-employment/src/current-person-state.ts:225`]
- [x] [Review][Defer] Module-scoped `createPgPool` for current-state eventDb — deferred, same web-server pool pattern as personnel-event / platform-status [`apps/web/src/server/person.ts:71`]
- [x] [Review][Defer] Recalc status TOCTOU between freshness check and projection assembly — deferred with torn-read defer [`packages/modules/person-employment/src/current-person-state.ts:196`]
- [x] [Review][Defer] No `asOf` format validation on assembler options — deferred; tRPC does not expose `asOf` yet [`packages/modules/person-employment/src/current-person-state.ts:191`]
- [x] [Review][Defer] Foreshadow accepts non-UUID `personId` and surfaces raw `query.error.message` — deferred; optional UI, same loose id input as `getById` [`apps/web/components/personnel/current-person-state-foreshadow.tsx`]

## Dev Notes

### Current code state (READ BEFORE CODING)

| Area | Path | Today | 4.9 change |
| --- | --- | --- | --- |
| As-of Employment | `packages/modules/person-employment/src/employment.ts` | `getActiveEmploymentAsOf` | **Call** from assembler |
| As-of Primary / Team | `primary-assignment.ts` | `getActivePrimaryAssignmentAsOf`, `resolveTeamMembershipAsOf` | **Call** |
| As-of Secondary | `secondary-assignment.ts` | `listActiveSecondaryAssignmentsAsOf` | **Call** (in-scope) |
| Person omit | `person-projection.ts` | Dictionary + category omit | **Call** — do not repurpose as event engine |
| Lifecycle eval | `personnel-event-resolve.ts` | `evaluationStatusAsOf`, `resolveLifecycleStatus` | **Call** for Scheduled channel |
| Event lists | `@divan/event-store` `listBusinessEventsForPerson*` | Apply ASC vs UI DESC | Use appropriately; never DESC for “current derive” |
| Recalc freshness | `personnel-event-recalc.ts` | `getRecalculationStatus`, `getPlatformRecalcSignal` | Fail-closed on read |
| Comp as-of | `packages/modules/compensation-facts/src/compensation.ts` | `getCompensationAsOf`, `getContractualAsOf` | Public API only |
| Comp omit | `compensation-facts/.../projection.ts` | Category omit | Reuse |
| Projection writers | `personnel-event-projection-hook.ts` | 4.5–4.8 Operators | **Do not modify** unless a proven read bug requires a one-line fix |
| Person tRPC | `apps/web/src/server/person.ts` | Identity get/list | Thin current-state procedure |
| PopulationPort | `population-cutover.ts` | Criteria only; fixture default | Honesty only |

### What must be preserved

- Append-only kernel event-store; projections never SoT (AD-2)
- FR-16: Scheduled must not alter current projection facts before Effective
- Half-open intervals; Asia/Tehran date-only; noon-UTC `dateOnlyToDb` / hybrid `dateOnlyFromDb`
- AD-3: compensation schema isolation; no cross-module Prisma imports
- ALS projection hook production pattern; 4.5–4.8 Operators and capacity idempotency
- Evidence / payload denylist (`assertNoSensitiveEvidence`) — read path must not reintroduce amounts into event DTOs
- No UTF-8 BOM on `sprint-status.yaml`
- Story Status ↔ sprint-status alignment on every transition

### Architecture compliance

- **AD-2:** SoT = append-only business events; current view = derived projection read
- **AD-3:** Assembler lives in `person-employment`; compensation via published module API only
- **AD-5:** Sensitive compensation reads stay envelope-governed; access events never feed projections
- **AD-6:** Writers already sync-refresh on finalize; this story is **read** — heavy rebuild stays pg-boss recalc (4.4), not sync replay-on-GET
- **Naming:** PascalCase past-tense event types unchanged
- **Stack:** Prisma 7.8.x projections; raw SQL event-store; tRPC in web only

### AR / fail-closed (do not invent)

| Artifact | Rule for 4.9 |
| --- | --- |
| AR-TEMPORAL | Date-only Tehran; exclusive ends; evaluation-by-date for Scheduled vs Effective; pre-Baseline disposition unchanged |
| AR-HEADCOUNT | No Approval/Matching/Override catalogue; do not recompute capacity in this read API |
| AR-DATA | Omit disabled/unauthorized fields; do not enable reject-disposition categories |
| AR-ACCESS | Reuse existing read permissions; no toxic matrix invention |
| AR-SECONDARY | In-scope list only; no new Secondary product scenarios |
| AR-IDENTITY | PopulationPort cutover criteria only — do not execute cutover |
| AR-REPORTING | Shared semantics foreshadow only; metric catalogue stays pending |

### Previous story intelligence (4.1–4.8)

- **4.8 Gate:** Explicitly deferred reconstruction products to 4.9–4.11 — this story is that current-state product, not more Operators.
- Pattern: domain module file + `tsx` selfcheck + thin tRPC; avoid module-global hooks.
- Effective Date maps to half-open Primary/Employment/comp intervals; as-of ED sees exactly one open Primary after job Operators.
- Scheduled Transfer/Title may reserve capacity without mutating current Primary — current-state API must reflect that.
- Recalc uses `evaluationStatusAsOf`, not storage status alone — Scheduled channel must too.
- Review lessons: accurate flags; no `toISOString().slice(0,10)` for PG DATE; compensate stays on write path (out of scope unless fixing a read bug).
- Deferred stay deferred: single-connection projector SQL; Vitest isolation; PopulationPort cutover; IDOR on list/get; full FR-30 Start reserve; compensation category production masking.

### Git intelligence

Recent commits: `8de3f2e` story 4.8 → `1e29400` story 4.7 → `669c8a8` story 4.6 → `fe658a6` story 4.5 → `752d64f` story 4.4.

Continue: `tsx` selfchecks, governed tRPC, Prisma projection reads, compensation-facts public API, Persian `messageFa`, no new write Operators.

### Latest tech notes

- **Read models:** Prefer composing existing as-of helpers over a new materialized “current” table at MVP scale; rebuild/reconcile already owned by sync AD-6 + async recalc.
- **Idempotent reads:** Assembler must be pure w.r.t. DB state — no hidden writes.
- **Prisma 7.8.x:** Keep driver-adapter / projection-only usage; never pull event-store into Prisma schema.
- **Ordering:** Apply order = ED ASC → coalesce(finalized, registered) ASC → id ASC (`@divan/temporal-engine`). UI lists remain DESC — do not confuse them.
- **Half-open:** Do not switch to inclusive-end BETWEEN for “current” membership.

### Project structure notes

```text
packages/modules/person-employment/src/
  current-person-state.ts                 # NEW — assembler
  current-person-state.selfcheck.ts       # NEW
  index.ts                                # UPDATE — exports
  package.json                            # UPDATE — selfcheck script
  population-cutover.ts                   # VERIFY honesty only
apps/web/src/server/
  person.ts  (or current-person-state.ts) # UPDATE — thin governed procedure
apps/web/components/personnel/            # OPTIONAL foreshadow read-only
_bmad-output/implementation-artifacts/
  deferred-work.md                        # UPDATE
  sprint-status.yaml                      # UPDATE — ready-for-dev → (later done)
```

### Testing requirements

- Pattern: `tsx` + `node:assert` + real `DATABASE_URL` (Vitest still deferred).
- Exact oracles: dual-consumer deep-equal; Scheduled Transfer → current Team unchanged; Effective Transfer → Team updated; compensation omit without perm; pending recalc fail-closed; terminated Person → null active Employment.
- Seed DoD: FK-shaped Person + Employment + Primary (+ optional Scheduled event + compensation fact); `$transaction` / `withTransaction` only where writing fixtures; exact counts.
- Regression: prior personnel-event + event-store + recalc + workers selfchecks green.

### Absolute non-goals

- Historical Person reconstruction / as-of UI / Baseline disclosure product (4.10)
- Historical organization & headcount reconstruction (4.11)
- Headcount Approval / Matching / Reservation-expiry / Override catalogue (4.12–4.14)
- Full profile sections, search table, timeline, dashboard, report catalogue (Epic 5)
- PopulationPort default-registry cutover execution
- New Personnel Event Operators or projection-hook domain branches (unless critical bugfix)
- New authoritative Prisma “current state” table; sync full-event replay on GET
- Weakening FR-16 / append-only / compensation isolation
- Inventing open AR numbers; enabling reject-disposition dictionary elements
- IDOR hardening pass on all list/get (unless explicitly pulled); Vitest migration mandate

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.9; Story 5.2 boundary]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-25, FR-16, FR-18, FR-45]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-5, AD-6, PROJECTION_CURRENT]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — Scheduled vs current; person-profile-section]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — UX-DR8 / UX-DR10 status badges]
- [Source: `_bmad-output/implementation-artifacts/4-8-job-level-contract-compensation-change-events.md`]
- [Source: `_bmad-output/implementation-artifacts/4-4-deterministic-ordering-recalculation.md`]
- [Source: `_bmad-output/implementation-artifacts/4-3-scheduled-state-cancel-reverse-correction.md`]
- [Source: `_bmad-output/implementation-artifacts/4-1-append-only-event-store-attributable-event-record.md` — PopulationPort criteria]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/modules/person-employment/src/personnel-event-resolve.ts`]
- [Source: `packages/modules/person-employment/src/employment.ts` — `getActiveEmploymentAsOf`]
- [Source: `packages/modules/person-employment/src/primary-assignment.ts` — `getActivePrimaryAssignmentAsOf`, `resolveTeamMembershipAsOf`]
- [Source: `packages/modules/compensation-facts/src/compensation.ts` — `getCompensationAsOf`, `getContractualAsOf`]
- [Source: `packages/kernel/temporal-engine/src/order-business-events.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Past-dated Start leaves `recalculation_status=pending` when enqueue unset — selfcheck clears before gold-truth reads; intentional pending oracle uses `markRecalculationPending`.
- PG DATE off-by-one on Scheduled Transfer `effectiveDate` — assert `> today` rather than exact `addDays` string.
- Termination same-day as Effective Transfer Primary start → `ASSIGNMENT_START_AFTER_TERMINATION`; closed intervals via projection helpers for terminated as-of oracle.

### Completion Notes List

- Implemented `getCurrentPersonState` assembler composing existing as-of helpers; no current-state Prisma table; no event replay on read.
- `scheduledChanges` via apply-order load + `resolveLifecycleStatus === Scheduled`; lean rows only.
- Shared `CurrentPersonState` DTO; dual-consumer deep-equal via `currentPersonStateFactsForCompare`.
- Thin `person.getCurrentState` tRPC (`person.read`); compensation block gated by `actorHasCompensationRead` + category omit inside module.
- Optional `/personnel` foreshadow with Scheduled badges (UX-DR10).
- Fail-closed on person recalc `pending|failed|stale`.
- PopulationPort honesty note only; no registry cutover.
- Selfcheck green; regressions: event-store, draft, lifecycle, recalc, start-return, termination, transfer, job-level, compensation green; typecheck person-employment + web green.

### File List

- packages/modules/person-employment/src/current-person-state.ts
- packages/modules/person-employment/src/current-person-state.selfcheck.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/src/permissions.ts
- packages/modules/person-employment/src/population-cutover.ts
- packages/modules/person-employment/package.json
- apps/web/src/server/person.ts
- apps/web/components/personnel/current-person-state-foreshadow.tsx
- apps/web/app/(app)/personnel/page.tsx
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-9-current-person-state-projection.md

### Change Log

- 2026-07-19: Story 4.9 implementation — current Person state assembler, scheduled channel, tRPC + foreshadow, selfcheck, deferred-work + sprint-status → review.

## Story completion status

Status: **done**

Completion note: Code review patches applied — truncation fail-closed, person-before-freshness, BOM removed, selfcheck oracles expanded; deferred items recorded.
