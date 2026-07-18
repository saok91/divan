---
baseline_commit: fe658a6f611757f7545b113d4c4363b37c785b4e
---

# Story 4.6: Termination Events

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Operator,
I want effective-dated termination events,
So that Employment end releases Assignments and headcount at effect (FR21).

## Gate (read first)

**This story ships the Termination Personnel Event Operator (`EmploymentTerminated`) — closing Employment + all open Assignments and releasing headcount via the existing Draft→Finalize→AD-6 hook. It does not ship Transfer, job/comp changes, reconstruction UIs, or full Headcount Approval / Matching / Reservation product.**

| Allowed in 4.6 | Forbidden in 4.6 |
| --- | --- |
| Product event type `EmploymentTerminated` (PascalCase past-tense); keep `ScaffoldChangeRecorded` + Start/Return | Claiming Transfer / job-level / contract-comp done (→ 4.7–4.8) |
| Wire hook for Effective Termination → close Employment + Primary/Secondary + release capacity | Any product CRUD `terminateEmployment` / public close verbs on `person.ts` / `employment.ts` |
| Conflict gates: no active Employment, missing reason/date, incompatible future events undisposed, already-closed | Inventing AR-DATA termination-reason catalogue enums beyond lean seed codes |
| Narrow headcount **release** port (mirror 4.5 consume) | Full Headcount Approval / Matching / Reservation expiry / Override catalogue (→ 4.12–4.14) |
| Explicit dispose of incompatible future events via existing Cancel (4.3) before finalize | Silent auto-Cancel / auto-Reverse of future events |
| Person + permitted history preserved after Employment ends (FR-5) | Deleting Person, anonymizing on terminate, or mutating prior Employments |
| Scheduled Termination: `applyToCurrentProjection: false` — no current close/release | Weakening FR-16 Scheduled discipline |
| Risk-tier: supply finalize `riskTier` config so authorized Termination can append; omit → pending_review (keep stub semantics) | Inventing full AR-ACCESS termination matrix / toxic combos |
| Selfcheck(s) proving FR-21 oracles + 4.1–4.5 regressions green | UTF-8 BOM on `sprint-status.yaml`; inventing open AR numbers |

### Mandated design — event path only (non-negotiable)

```text
PersonnelEventDraft (Prisma, mutable)
        │ finalizeDraft (withTransaction) — EXISTING 4.2
        ▼
classifyConflicts → appendBusinessEvent
        │
        ▼
runProjectionRefreshHook({ applyToCurrentProjection: status === "Effective" })
        │
        ├─ EmploymentTerminated + applyToCurrentProjection
        │     → close all open Primary + Secondary on Employment (same endDateExclusive)
        │     → close Employment (endDateExclusive + terminationReason)
        │     → releaseHeadcountCapacity (narrow port; same txn)
        │     → coverage asserts AFTER closes (not mid-close)
        │
        └─ Scheduled / applyToCurrentProjection=false → record invoked only (FR-16)
```

- **Do not** call projectors from Draft save.
- **Do not** add public `terminateEmployment` product verbs.
- Prefer extending close helpers to accept/set `terminationReason` rather than inventing a second Employment writer.
- Close Assignments **before** Employment when coverage asserts require Employment to still cover Assignment ends at the exclusive boundary (Assignments endExclusive ≤ Employment endExclusive).

### Mandated design — event type name

| Operator | `eventType` string | Notes |
| --- | --- | --- |
| Termination | `EmploymentTerminated` | Already foreshadowed in `inferRiskTiers` + draft selfcheck — **do not** ship `TerminationRecorded` as the product type (keep recognizing it only as legacy risk alias if already present) |
| Scaffold / Start / Return | unchanged | Must remain green |

### Mandated design — Effective Date ↔ interval end (half-open)

Active ⇔ `start ≤ D < endExclusive` (`isEmploymentActiveAsOf`).

| Event | Effective Date maps to |
| --- | --- |
| Start / Return | `Employment.startDate` / Primary `startDate` (inclusive — employed on ED) |
| Termination | `endDateExclusive` on Employment **and** all closed Assignments (exclusive — **not** employed as-of ED) |

Example: Termination ED `2025-12-31` → intervals end with `endDateExclusive = 2025-12-31` → last active day `2025-12-30`. Selfchecks must assert `getActiveEmploymentAsOf(person, ED) === null` and prior day still active when start ≤ prior < ED.

Use `@divan/temporal-engine` date-only helpers; never `toISOString().slice(0,10)` for PG DATE semantics.

### Mandated design — close effects (FR-21 / FR-5 / BR-EMP-005..007)

| Projection | Effect |
| --- | --- |
| Employment | Set `endDateExclusive = Effective Date`; set lean `terminationReason` (required); Person untouched |
| Primary Assignment(s) | Close **every open** Primary on that Employment with same `endDateExclusive` |
| Secondary Assignment(s) | Close **every open** Secondary on that Employment with same `endDateExclusive` (in-scope fidelity; do not invent new Secondary product) |
| Headcount | **Release** capacity consumed by the Start/Return that opened this Employment (FR-31) |

Idempotency: replaying the same Termination event (recalc / retry) must not double-release or fail with “already closed” when ends already match this event’s ED/reason. Prefer “already applied for this `eventId`” detection (e.g. Primary/Employment already closed to that exclusive end + release row keyed by termination `event_id`).

### Mandated design — incompatible future events (FR-21 consequence)

Before append, `classifyConflicts` MUST identify authoritative **Scheduled** (and any other pre-effect Finalized) events for the **same Person** that are incompatible with Termination at ED, including at least:

- Scheduled `EmploymentStarted` / `EmploymentReturned` with Effective Date ≥ Termination ED
- Scheduled events bound to the **same Employment** that would mutate Assignments/Employment after ED (when such types exist; Transfer/job-comp may still be scaffold — still list known Scheduled peers on that employment/person that cannot coexist)

**Blocking** finding (new code OK, e.g. `INCOMPATIBLE_FUTURE_EVENTS`) with Persian `messageFa` listing event id(s) / types / EDs.

**Explicit dispose** = Operator/Admin runs existing `cancelPersonnelEvent` (4.3) on each incompatible Scheduled target **before** Termination finalize. **Do not** auto-Cancel inside finalize. Do not invent a second dispose API.

UI: surface blocking list; gold Finalize stays disabled / fails until cleared (UX-DR5 still applies for recalc pending).

### Mandated design — headcount release port (narrow; FR-31)

Mirror `@divan/headcount` consume from 4.5:

| API | Behavior |
| --- | --- |
| `releaseHeadcountCapacity` | Idempotent on termination `event_id`; restore `free_units` for the slot previously consumed for this Person/Employment; fail closed if release target ambiguous/missing when Employment had a consumption |
| Schema | Minimal — e.g. `release_event_id` / release row or mark consumption released; do not build Reservation product |

**Out of scope:** Approval CRUD, Matching oracle, 14-day Reservation expiry, FR-30 durable reserve for Scheduled Termination.

If no consumption exists (seed Employment closed via projector-only path), document fail-closed vs allow-with-warning in Dev Notes and pick **fail-closed for event-sourced Start/Return Employments**; fixture-only Employments without consumption may use an explicit selfcheck seed that consumed first.

### Mandated design — risk tier (do not break 4.2 stub)

`inferRiskTiers` already tags `EmploymentTerminated` → `termination`. Absent config → `pending_review` (no append) — **keep that fail-closed default**.

For product happy path, web/tRPC finalize **must** pass `riskTier` config that authorizes the `termination` tier for actors with `personnel_event.finalize` (e.g. `requiresPreAuth: false` **or** preAuth token). Document that full AR-ACCESS termination matrix remains open — do not invent toxic combinations.

Sensitive confirm dialog: Termination finalize requires explicit Persian confirmation (UX extract: termination is a confirm surface). Reason field: lean code (seed examples like `contract_ended`); avoid free-text essays; do not put narrative reason into before/after evidence blobs if key names trip `assertNoSensitiveEvidence`.

### Mandated design — minimum facts at finalize

Required Draft fields for Termination:

- Stable Person + target **open** Employment (`employmentId` bound; must be active as-of day before ED / open interval covering prior day)
- Effective Date (date-only)
- Lean `terminationReason` (non-blank)
- No Start/Return minimum org/job facts required (those already exist on Employment)

Missing → blocking Persian conflicts.

[Source: `epics.md` Story 4.6; `prd.md` FR-21, FR-5, FR-31, FR-3; `ARCHITECTURE-SPINE.md` AD-2/AD-6; Stories 4.1–4.5; Epic 3 close projectors]

## Acceptance Criteria

1. **Given** an active Employment with Assignments  
   **When** Termination is finalized through the Personnel Event flow  
   **Then** active Employment and Assignments end at effect (`endDateExclusive = Effective Date`) and associated headcount releases; date and lean reason are retained on Employment

2. **And** incompatible future events are identified as blocking conflicts and must be explicitly disposed (Cancel) before finalization succeeds

3. **And** the Person and permitted history remain after Employment ends (no Person delete; prior Employments/events readable)

4. **And** no CRUD bypass exists outside this event path for ending active Employment / releasing capacity for event-sourced Employments

5. **And** Story 4.1–4.5 invariants remain green: append-only store, Draft→Finalize conflicts, Scheduled/Cancel/Reverse/Correction, FR-18 ordering + recalc pending/UX-DR5, AD-6 sync seam, Start/Return projectors + capacity consume; this story does **not** deliver Transfer/job-comp Operators or reconstruction products

## Tasks / Subtasks

- [x] Task 1: Domain event type + Draft/finalize catalogue (AC: #1, #4, #5)
  - [x] Register `EmploymentTerminated` as product type (validation, form option, payload parse)
  - [x] Keep Scaffold + Start/Return working; do not remove risk-tier recognition of type
  - [x] Draft payload: `terminationReason` lean code + `employmentId`; `assertNoSensitiveEvidence` clean
  - [x] Wire tRPC finalize `riskTier` so authorized Termination can leave `pending_review` path

- [x] Task 2: Projection hook — Effective Termination apply (AC: #1, #3, #4, #5)
  - [x] Branch in `personnel-event-projection-hook.ts` (or `personnel-event-termination.ts` imported by default hook)
  - [x] Effective: close open Primary(s) → Secondary(s) → Employment with ED + reason; then release capacity
  - [x] Honor `applyToCurrentProjection === false` (Scheduled) — no close/release
  - [x] Idempotent replay / orphan compensate pattern analogous to Start/Return (release + closes)
  - [x] Map domain errors to finalize failures with Persian `messageFa`; ALS hook only
  - [x] Recalc handler applies same projectors when replaying ordered events

- [x] Task 3: Conflicts — active Employment, reason, future dispose (AC: #1, #2, #5)
  - [x] Block if no open Employment / employment not owned by Person / already closed
  - [x] Block if missing `terminationReason` or invalid ED vs start (`end ≤ start`)
  - [x] Detect incompatible future Scheduled events → blocking `INCOMPATIBLE_FUTURE_EVENTS` (or equivalent)
  - [x] Do not auto-dispose; prove Cancel-then-finalize path in selfcheck

- [x] Task 4: Headcount release port (AC: #1, #4)
  - [x] Add `releaseHeadcountCapacity` (+ schema as needed) in `@divan/headcount`
  - [x] Call on Effective apply inside AD-6 txn; idempotent on termination event id
  - [x] Fail closed when release cannot be resolved for event-sourced consumption
  - [x] Document FR-30 / 4.12–4.14 remainder unchanged in `deferred-work.md`

- [x] Task 5: Extend close Employment for reason (AC: #1)
  - [x] Today `closeEmploymentProjection` sets only `endDateExclusive` — extend to accept/set `terminationReason` (or dedicated internal helper used only from Termination apply)
  - [x] Open interval must not retain a reason; closed must retain lean reason

- [x] Task 6: UI / tRPC wiring (AC: #1, #2)
  - [x] Extend `PersonnelEventForm` for Termination fields + confirm dialog; Save draft ≠ Finalize (UX-DR11)
  - [x] Surface future-event conflicts in Persian; list dispose targets
  - [x] Permissions remain `personnel_event.draft` / `.finalize` (coarse role insufficient)
  - [x] Interactive a11y: focus order, error association, confirm dialog (UX-DR14)

- [x] Task 7: Selfchecks + DoD (AC: #1–#5)
  - [x] New `personnel-event-termination.selfcheck.ts` with exact cardinality oracles
  - [x] Prove: Start→Terminate → Employment+Assignments closed at ED; reason retained; Person intact; capacity free_units restored
  - [x] Prove: retry finalize / recalc replay idempotent (no double-release)
  - [x] Prove: Scheduled Termination does not close/release
  - [x] Prove: past-dated Effective Termination enqueues recalc / pending blocks gold CTA when applicable
  - [x] Prove: incompatible Scheduled Start blocks; Cancel then finalize succeeds
  - [x] Prove: missing reason / no open Employment block
  - [x] Re-run event-store, draft, lifecycle, ordering, recalc, start-return, workers selfchecks — all green
  - [x] Update `deferred-work.md`; align story Status ↔ `sprint-status.yaml`; **no UTF-8 BOM**

### Review Findings

- [x] [Review][Patch] Clamp Primary/Secondary with `endDateExclusive >` Termination ED (or still active past ED) down to Termination ED — decided: clamp/close (not conflict-only) [`packages/modules/person-employment/src/personnel-event-termination.ts`]
- [x] [Review][Patch] Multi-consumption / partial release is not fail-closed — same-slot unreased rows each do `free_units + 1` (over-restore); mid-loop race can return `{ released: false }` after earlier rows already updated without undo [`packages/modules/headcount/src/index.ts:347`]
- [x] [Review][Patch] `undoHeadcountRelease` clears `release_event_id` even when `free_units` decrement is skipped (`free_units` already 0) [`packages/modules/headcount/src/index.ts:409`]
- [x] [Review][Patch] Peer Scheduled `EmploymentTerminated` on same Employment excluded from incompatible-future query (`event_type <> EmploymentTerminated`) [`packages/modules/person-employment/src/personnel-event-termination.ts:212`]
- [x] [Review][Patch] `didCloseEmployment = true` even when `closeEmploymentProjection` was an idempotent hit — compensate can reopen a concurrently closed Employment [`packages/modules/person-employment/src/personnel-event-termination.ts:456`]
- [x] [Review][Patch] No conflict when open Primary/Secondary `startDate >=` Termination ED — apply can close some rows then fail interval validation [`packages/modules/person-employment/src/personnel-event-conflicts.ts`]
- [x] [Review][Patch] Termination `dateOnlyFromDb` is UTC-only while Employment/Assignment writers use noon-UTC + hybrid decode — idempotent close equality can disagree [`packages/modules/person-employment/src/personnel-event-termination.ts:85`]
- [x] [Review][Patch] UTF-8 BOM on `sprint-status.yaml` (Gate / Task 7 forbid) [`_bmad-output/implementation-artifacts/sprint-status.yaml`]
- [x] [Review][Patch] Termination UI still labels Employment ID as optional while save requires it [`apps/web/components/personnel/personnel-event-form.tsx:462`]
- [x] [Review][Patch] Selfcheck Secondary close-at-ED is vacuous (no Secondary seeded; only `every(end !== null)`) [`packages/modules/person-employment/src/personnel-event-termination.selfcheck.ts:268`]
- [x] [Review][Patch] Selfcheck does not prove recalc apply/replay idempotency (no double-release) — only finalize retry + past-dated enqueue [`packages/modules/person-employment/src/personnel-event-termination.selfcheck.ts`]

- [x] [Review][Defer] Prisma projectors vs finalize `PoolClient` txn split — deferred, pre-existing [`packages/modules/person-employment/src/personnel-event-projection-hook.ts:79`] — deferred, pre-existing
- [x] [Review][Defer] Idempotent finalize early-return skips projection hook (orphan close without durable release not healed by retry) — deferred, pre-existing [`packages/modules/person-employment/src/personnel-event-finalize.ts:333`] — deferred, pre-existing

## Dev Notes

### Current code state (READ BEFORE CODING)

| Area | Path | Today | 4.6 change |
| --- | --- | --- | --- |
| Projection hook | `packages/modules/person-employment/src/personnel-event-projection-hook.ts` | Start/Return apply; Terminate comment stub | **Wire** Termination close + release |
| Conflicts | `personnel-event-conflicts.ts` | Start/Return capacity, overlap, facts | Add Termination gates + future-event dispose check |
| Finalize / risk | `personnel-event-finalize.ts` | `EmploymentTerminated` → risk tier pending without config | Pass config from web; keep omit→pending_review |
| Lifecycle Cancel | `personnel-event-lifecycle.ts` | Cancel Scheduled | **Reuse** as dispose — no new API |
| Employment close | `employment.ts` `closeEmploymentProjection` | Sets `endDateExclusive` only; **no** reason | Extend for reason |
| Primary/Secondary close | `primary-assignment.ts` / `secondary-assignment.ts` | Ready | Call from hook |
| Headcount | `packages/modules/headcount/src/index.ts` | evaluate/consume/seed only | **Add** release |
| Form | `apps/web/components/personnel/personnel-event-form.tsx` | Scaffold/Start/Return | Add Termination |
| tRPC | `apps/web/src/server/personnel-event.ts` | Draft/finalize | riskTier + Termination payloads |

### Architecture compliance

- **AD-2:** SoT = append-only business events; Employment/Assignments/headcount counts = projections only.
- **AD-3:** Kernel owns event-store / temporal-engine / audit-envelope.
- **AD-6:** Critical current refresh (close + release) in same txn as append; heavy historical via existing recalc + pending UI.
- **Naming:** PascalCase past-tense — `EmploymentTerminated` only for product.
- **Dates:** Asia/Tehran date-only; exclusive ends; temporal-engine helpers.
- **Authz:** `governedProcedure` + fine permissions + audit envelope.
- **Evidence:** no national ID / compensation amounts / free-text sensitive narratives in evidence blobs.

### AR / fail-closed (do not invent)

| Artifact | Rule for 4.6 |
| --- | --- |
| AR-TEMPORAL | Frozen calendar/order rules; ED = endExclusive; pre-Baseline disposition C unchanged |
| AR-DATA | Termination reason catalogue / concurrent-Employment exceptions — lean codes only; fail closed on blank |
| AR-HEADCOUNT | Full Matching/Reservation/Override catalogue — out of scope; narrow release only |
| AR-ACCESS | Termination risk-tier matrix — minimal authorize config only; do not invent toxic combos |
| AR-SECONDARY | Close open Secondaries on terminate; do not expand Secondary product |
| AR-IDENTITY | Person survives; no account revoke invention in this story |

### Previous story intelligence (4.5)

- Pattern to mirror: `personnel-event-start-return.ts` + hook branch + conflicts + selfcheck + form fieldset.
- Capacity: consume is idempotent on `event_id` — release must be too.
- AD-6 Prisma vs PoolClient orphan risk — compensate on post-hook failure (extend compensate helper for Termination closes/release).
- Review lessons from 4.5: exact cardinality; no BOM; story Status ↔ sprint-status; fail closed when readers null; generation FOR UPDATE before recalc apply; `setDirty` on form fields; do not accept bogus tokens to bypass gates.
- Return does **not** close prior Employment — Termination is the only product close path.
- Transfer coverage-after-atomic-close+open remains **4.7**.

### Git intelligence

Recent commits: `fe658a6` story 4.5 → `752d64f` story 4.4 → `367c3a0` story 4.3 → `15d1bb9` story 4.2 → `43b8ffa` story 4.1.

Continue: tsx selfchecks, governed tRPC, raw SQL kernel event-store, Prisma projections, Persian `messageFa` at boundaries, thin `@divan/headcount` port expansion.

### Latest tech notes

- **Half-open intervals:** Keep `[start, endExclusive)` — Termination ED = exclusive end; do not switch to inclusive-end BETWEEN.
- **pg-boss:** Reuse existing recalc queue — no second queue for Termination.
- **Sensitive evidence keys:** `terminationReason` is not currently in `SENSITIVE_EVIDENCE_KEYS`; still avoid stuffing narrative PII; prefer lean codes in payload and projection column.

### Project structure notes

```text
packages/modules/person-employment/src/
  personnel-event-projection-hook.ts   # UPDATE — Termination branch
  personnel-event-conflicts.ts         # UPDATE — future events + terminate gates
  personnel-event-finalize.ts          # VERIFY — risk tier config path
  personnel-event-recalc.ts            # VERIFY — replay applies closes
  personnel-event-termination.ts       # NEW — parse + apply + compensate
  personnel-event-termination.selfcheck.ts  # NEW
  employment.ts                        # UPDATE — close + reason
  primary-assignment.ts / secondary-assignment.ts  # CALL close*
packages/modules/headcount/src/index.ts  # UPDATE — release API + schema
packages/db/sql/                       # NEW optional 007_headcount_release.sql if needed
apps/web/src/server/personnel-event.ts
apps/web/components/personnel/personnel-event-form.tsx
```

### Testing requirements

- Pattern: `tsx` + `node:assert` + real `DATABASE_URL` (Vitest still deferred).
- Exact cardinality: N finalize retries → one closed Employment, Assignments closed once, one release for termination event id.
- Matrix: happy Terminate after Start+consume; Scheduled non-mutation; past-dated + pending CTA; incompatible future block + Cancel dispose; missing reason; already closed; Person intact; Start/Return regression.
- Regression: `@divan/event-store`, personnel-event-draft/lifecycle/recalc/start-return, order-business-events, workers recalc.
- Seed DoD: FK-shaped fixtures; `$transaction` / `withTransaction`; exact counts.

### Absolute non-goals

- Transfer atomic capacity (4.7), job/level/contract/comp events (4.8)
- Current/historical Person or org reconstruction products (4.9–4.11)
- Headcount Approval lifecycle / Matching / Reservation expiry UI (4.12–4.14)
- PopulationPort cutover; IDOR hardening on list/get (unless explicitly pulled)
- Inventing full AR-DATA termination reason enum or AR-ACCESS toxic matrix
- Auto-Cancel of future events inside finalize
- Weakening append-only / Scheduled / Start-Return / recalc fail-closed behaviors

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.6]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-21, FR-5, FR-31, FR-3]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-6]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — personnel-event-form, UX-DR5/11/14]
- [Source: `_bmad-output/implementation-artifacts/4-5-start-return-events.md` — mirror pattern + review lessons]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/modules/person-employment/src/personnel-event-projection-hook.ts`]
- [Source: `packages/modules/person-employment/src/employment.ts` — `closeEmploymentProjection`]
- [Source: `packages/modules/headcount/src/index.ts` — consume port to mirror]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- PG DATE Asia/Tehran off-by-one: Draft/Employment/Assignment `dateOnlyToDb` switched to noon UTC; `dateOnlyFromDb` handles local vs UTC midnight.
- Cancel does not mutate original Scheduled status — `findIncompatibleFutureEvents` excludes rows with `cancels_event_id` / `reverses_event_id` chain.

### Completion Notes List

- Shipped `EmploymentTerminated` Operator on Draft→Finalize→AD-6 path only (no public terminate CRUD).
- Effective apply: close Primaries → Secondaries → Employment(+lean reason) → `releaseHeadcountCapacity`; Scheduled skips mutation (FR-16).
- Conflicts: missing reason/employment, already closed, invalid ED, `INCOMPATIBLE_FUTURE_EVENTS` with Cancel dispose path.
- Web passes `TERMINATION_PRODUCT_RISK_TIERS`; omit still → `pending_review`.
- Selfcheck green; regressions: start-return, draft, lifecycle, recalc, employment-lifecycle, event-store green.

### File List

- packages/modules/person-employment/src/personnel-event-termination.ts (new)
- packages/modules/person-employment/src/personnel-event-termination.selfcheck.ts (new)
- packages/modules/person-employment/src/personnel-event-projection-hook.ts
- packages/modules/person-employment/src/personnel-event-conflicts.ts
- packages/modules/person-employment/src/personnel-event-finalize.ts
- packages/modules/person-employment/src/personnel-event-draft.ts
- packages/modules/person-employment/src/personnel-event-draft.selfcheck.ts
- packages/modules/person-employment/src/employment.ts
- packages/modules/person-employment/src/primary-assignment.ts
- packages/modules/person-employment/src/secondary-assignment.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/package.json
- packages/modules/headcount/src/index.ts
- packages/db/sql/007_headcount_capacity_release.sql (new)
- apps/web/src/server/personnel-event.ts
- apps/web/components/personnel/personnel-event-form.tsx
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-6-termination-events.md

### Change Log

- 2026-07-18: Implemented Story 4.6 Termination Events (EmploymentTerminated Operator, release port, conflicts, UI, selfchecks).
- 2026-07-18: Code review patches applied (release fail-closed, clamp assignments, peer Termination conflict, UI/BOM/selfcheck hardening).

## Story completion status

Status: **done**
