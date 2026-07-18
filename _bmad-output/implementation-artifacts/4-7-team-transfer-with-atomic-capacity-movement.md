---
baseline_commit: 669c8a8
---

# Story 4.7: Team Transfer with Atomic Capacity Movement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Operator (Mina journey),
I want an effective-dated Team transfer that atomically moves Primary Assignment and capacity,
So that the Person never has zero or two Primaries and today's totals stay correct until Effective (FR22, FR30, FR31, UJ-1).

## Gate (read first)

**This story ships the Transfer Personnel Event Operator (`TransferRecorded`) — atomic Primary close+open, narrow destination Reservation on Scheduled finalize, and atomic source-release + destination-consume at effect — via the existing Draft→Finalize→AD-6 hook. It does not ship job/level/contract/comp Operators, reconstruction UIs, or full Headcount Approval / Matching / Override catalogue product.**

| Allowed in 4.7 | Forbidden in 4.7 |
| --- | --- |
| Product event type `TransferRecorded` (PascalCase past-tense per architecture taxonomy) | Shipping `TeamTransferRecorded` as a second product type; claiming job/comp done (→ 4.8) |
| Wire hook for Effective Transfer → close source Primary + open destination Primary **atomically**, then coverage assert | Any product CRUD `transferPrimary` / `assignPersonToTeam` / public mutation outside Draft→Finalize |
| Narrow headcount **reserve** + convert-to-consume / atomic release(source)+consume(dest) port | Full Headcount Approval lifecycle / Matching oracle / 14-day expiry UI / Override catalogue (→ 4.12–4.14) |
| Scheduled Transfer: durable destination Reservation; **no** current Primary/profile/source-count mutation (FR-16 + UJ-1) | Weakening FR-16; mutating today's Primary on Scheduled finalize |
| No-op reject when resolved destination ≡ source Primary (no Reservation / no movement) | Silent no-op finalize that appends an empty Transfer |
| `headcount-capacity-panel` on Transfer form (used/reserved/free for destination) before finalize (UX-DR13) | Building the full `/headcount` product surface or Approval admin UI |
| Cancel of Scheduled Transfer **releases** its Reservation (FR-30 consequence — minimal port hook) | Leaving orphan reservations; inventing a second Cancel API |
| Concurrent last-unit: `SELECT … FOR UPDATE` on capacity slot (or equivalent) so two txns cannot both reserve/consume the last unit (NFR4) | Optimistic decrement without lock that can over-subscribe |
| Selfcheck(s) proving FR-22/30/31 oracles + 4.1–4.6 regressions green | UTF-8 BOM on `sprint-status.yaml`; inventing open AR numbers |
| Fix recalc `applyToCurrentProjection` to use **evaluation-by-date** (`evaluationStatusAsOf`) so storage-Scheduled Transfer (and other Operators) apply when ED ≤ asOf | `UPDATE` flipping original `status` to Effective (forbidden by 4.3) |

### Mandated design — event path only (non-negotiable)

```text
PersonnelEventDraft (Prisma, mutable)
        │ finalizeDraft (withTransaction) — EXISTING 4.2
        ▼
classifyConflicts → appendBusinessEvent
        │
        ▼
runProjectionRefreshHook({ applyToCurrentProjection: evaluationEffective })
        │
        ├─ TransferRecorded + Scheduled (storage; ED > asOf)
        │     → reserveHeadcountCapacity(destination)  // FR-30; same txn
        │     → NO Primary close/open; today's profile/counts unchanged
        │
        ├─ TransferRecorded + Effective (ED ≤ asOf at finalize OR evaluation-by-date on recalc)
        │     → close source Primary (endExclusive = ED)
        │     → open destination Primary (startDate = ED; sourceEventId = Transfer event id)
        │     → assertPrimaryCoverageForActiveEmployment  // AFTER close+open only
        │     → capacity: release source consumption + consume dest
        │         (or convert existing Reservation → consumption) — one atomic outcome
        │     → compensate on orphan / partial failure
        │
        └─ applyToCurrentProjection=false without reserve path → record invoked only
           (Cancel-of-Scheduled uses reserve-release, not Primary mutation)
```

- **Do not** call projectors from Draft save.
- **Do not** add public Transfer CRUD verbs.
- **Do not** run `assertPrimaryCoverageForActiveEmployment` on the mid-Transfer “source closed, dest not yet open” shape (false-fail).
- Employment usually **stays open**; Transfer does not terminate Employment (Termination remains 4.6).
- Secondary Assignments: do **not** invent Transfer-of-Secondary product; leave open Secondaries unless an explicit conflict requires dispose (prefer leave untouched).

### Mandated design — event type name

| Operator | `eventType` string | Notes |
| --- | --- | --- |
| Team Transfer | `TransferRecorded` | Architecture taxonomy + existing `HEADCOUNT_CONSUMING_EVENT_TYPES` foreshadow — **product type** |
| `TeamTransferRecorded` | non-product | Keep fail-closed / reject at draft validation; do not ship as alternate Operator |
| Scaffold / Start / Return / Termination | unchanged | Must remain green |

### Mandated design — Effective Date ↔ Primary intervals (half-open)

Active Primary ⇔ `start ≤ D < endExclusive`.

| Effect | Effective Date maps to |
| --- | --- |
| Close source Primary | `endDateExclusive = ED` (not on source team as-of ED) |
| Open destination Primary | `startDate = ED` (on dest team as-of ED) |

Example: Transfer ED `2026-03-01` → source ends exclusive `2026-03-01` (last day on source `2026-02-28`); dest starts `2026-03-01`. As-of ED the Person has **exactly one** active Primary (destination). Never zero, never two.

Use `@divan/temporal-engine` date-only helpers; never `toISOString().slice(0,10)` for PG DATE semantics. Prefer noon-UTC `dateOnlyToDb` + hybrid `dateOnlyFromDb` (4.6 lesson).

### Mandated design — no-op rejection (FR-22)

Resolved destination is **equivalent** to the open source Primary when all of these match:

- `teamId`
- `organizationalRoleId`
- `jobTitleId`
- `ladderId`
- `gradeId`
- `seniorityId` (both null/absent counts as equal)

→ Blocking conflict (e.g. `TRANSFER_NOOP`); **no** append, **no** Reservation, **no** capacity movement.

### Mandated design — capacity (narrow FR-30 / FR-31; not 4.12–4.14 product)

Extend `@divan/headcount` (mirror consume/release patterns from 4.5–4.6):

| API | Behavior |
| --- | --- |
| `reserveHeadcountCapacity` | On Scheduled Transfer finalize: lock destination slot (`FOR UPDATE`), decrement free / increment reserved (schema as needed), row keyed by Transfer `event_id` (idempotent). Fail closed if no free unit. |
| Panel read | Return used / reserved / free for Team(+title) so UI can render `headcount-capacity-panel` |
| Effective capacity move | Same txn as Primary close+open: release source consumption (via existing Start/Return `sourceEventId` / open Primary consume id) **and** consume destination (or convert reservation → consumption for this Transfer `event_id`). Idempotent on Transfer event id. Failure → full rollback (NFR4 / FR-31). |
| `releaseReservation` (or Cancel hook) | Cancel of Scheduled `TransferRecorded` restores reserved unit; idempotent |

**Locking (NFR4):** Capacity mutate paths MUST `SELECT … FOR UPDATE` the target `headcount_capacity_slot` row (or equivalent atomic `UPDATE … WHERE free_units > 0 RETURNING`) so two concurrent finalizes cannot both take the last unit.

**Out of scope:** Approval CRUD, oldest-compatible Matching catalogue, 14-day expiry warn UI, negative-free Override catalogue, durable reserve for Scheduled Start (may remain deferred — Transfer AC forces reserve for Transfer only).

Document remainder in `deferred-work.md`.

### Mandated design — evaluation-by-date apply (closes UJ-1 gap)

Storage keeps `Scheduled` for future finalizations (4.3 — no status UPDATE).

Today recalc uses `applyToCurrentProjection: event.status === "Effective"` which **never** applies storage-Scheduled events after ED arrives. **This story MUST** derive apply as:

```ts
evaluationStatusAsOf(event, asOfDate) === "Effective"
```

(for Transfer at minimum; prefer all product Operators: Start/Return/Termination/Transfer) inside recalc replay (and any apply path that materializes “current” after ED).

Selfcheck: finalize future Transfer → reserve only → advance asOf / run recalc → Primaries moved + reservation converted; storage status may remain `Scheduled`.

### Mandated design — conflicts

Before append, `classifyConflicts` MUST:

| Gate | Behavior |
| --- | --- |
| No open Employment / no open Primary | Blocking |
| Missing destination Team / required job facts | Blocking (mirror Start minimum facts for **destination** Primary) |
| Inactive Team/Job/Ladder/Grade/Seniority as-of ED | Blocking (AR-TEMPORAL — no silent attach) |
| Destination ≡ source (no-op) | Blocking `TRANSFER_NOOP` |
| Destination capacity incompatible / unavailable | Blocking `HEADCOUNT_CAPACITY_MISSING` (Override path only if existing 4.5 Override seam applies — do not invent Override catalogue) |
| Incompatible future Scheduled peers | Blocking `INCOMPATIBLE_FUTURE_EVENTS` — include peer Scheduled `TransferRecorded` / `EmploymentTerminated` / Start-Return on same Employment/Person that collide; **explicit Cancel dispose** only (no auto-Cancel) |

Move `TransferRecorded` from unconditional `HEADCOUNT_UNAPPROVED` stub into `HEADCOUNT_CAPACITY_PORT_EVENT_TYPES` (or Transfer-specific set) using the real port.

### Mandated design — UI / UJ-1 (Mina)

Follow `EXPERIENCE.md` UJ-1:

1. Transfer option on `personnel-event-form` (Persian label **انتقال**).
2. Show current source Primary summary; destination Team/title fields.
3. Embed **`headcount-capacity-panel`** for destination (used / reserved / free with tabular numerals) before Finalize (UX-DR13).
4. Jalali date picker; Save draft ≠ Finalize (UX-DR11).
5. `sensitive-confirmation-dialog` on Finalize (UX-DR14).
6. After Scheduled finalize: badge Scheduled; profile / source team counts unchanged.
7. Permissions: `personnel_event.draft` / `.finalize` (coarse role insufficient).
8. Interactive a11y: focus order, error association, confirm dialog.

Full `personnel-event-timeline` product remains Epic 5.3 — foreshadow existing list/badges only.

### Mandated design — risk tier

Do **not** invent a toxic Transfer AR-ACCESS matrix. Transfer need not enter `pending_review` by default (unlike Termination's `termination` tier). If you add a `transfer` tier, web must pass authorize config; omit → fail-closed pending is OK only if intentional and selfchecked.

[Source: `epics.md` Story 4.7; `prd.md` FR-22, FR-30, FR-31, UJ-1, NFR-4; `ARCHITECTURE-SPINE.md` AD-2/AD-6 + TransferRecorded naming; Stories 4.1–4.6; UX EXPERIENCE UJ-1 / UX-DR5/11/13/14]

## Acceptance Criteria

1. **Given** a Person with an active Primary Assignment and a destination Team/title  
   **When** a **future** Transfer is finalized  
   **Then** destination capacity is immediately reserved; source capacity remains consumed until Effective; today's profile and source team counts are unchanged

2. **When** the Effective point is reached (ED ≤ asOf at finalize **or** evaluation-by-date apply via recalc)  
   **Then** source Primary close + destination Primary open + source release + destination consumption occur as **one** atomic business outcome; failure leaves the prior valid state unchanged; Person never has zero or two required Primaries

3. **And** a Transfer whose resolved destination equals the source Primary is rejected as no-op (no Reservation, no capacity movement, no append)

4. **And** `headcount-capacity-panel` shows used/reserved/free for the destination before finalize (UX-DR13)

5. **And** concurrent transactions cannot both reserve or consume the same last capacity unit (NFR4)

6. **And** Cancel of a Scheduled Transfer releases its Reservation; incompatible future events require explicit Cancel dispose before finalize

7. **And** Stories 4.1–4.6 invariants remain green; this story does **not** deliver job/comp Operators (4.8), reconstruction products (4.9–4.11), or full Headcount Approval/Matching/Override catalogue (4.12–4.14)

## Tasks / Subtasks

- [x] Task 1: Domain event type + Draft/finalize catalogue (AC: #1, #3, #7)
  - [x] Register `TransferRecorded` as product type (validation, form option, payload parse)
  - [x] Reject `TeamTransferRecorded` as non-product (keep stub block or draft validation error)
  - [x] Draft payload: destination `teamId` + org/job facts (mirror Start fields needed for Primary); `employmentId`; optional `capacitySlotId`; `assertNoSensitiveEvidence` clean
  - [x] Keep Scaffold / Start / Return / Termination green

- [x] Task 2: Projection hook — Scheduled reserve + Effective apply (AC: #1, #2, #7)
  - [x] New `personnel-event-transfer.ts` (parse + apply + compensate) imported by `personnel-event-projection-hook.ts`
  - [x] Scheduled path: reserve destination only; no Primary mutation
  - [x] Effective path: close source Primary → open dest Primary → **then** `assertPrimaryCoverageForActiveEmployment` → atomic capacity move
  - [x] Idempotent replay / orphan compensate (mirror Start/Termination patterns; AD-6 Prisma vs PoolClient)
  - [x] Map domain errors to finalize failures with Persian `messageFa`; ALS hook only
  - [x] Recalc: `applyToCurrentProjection` from `evaluationStatusAsOf` (not storage status alone)

- [x] Task 3: Conflicts — no-op, capacity, inactive refs, future peers (AC: #3, #6, #7)
  - [x] Remove Transfer from unconditional `HEADCOUNT_UNAPPROVED` stub; use capacity port
  - [x] `TRANSFER_NOOP` when destination ≡ source Primary
  - [x] Inactive refs as-of ED → blocking
  - [x] `INCOMPATIBLE_FUTURE_EVENTS` including peer Scheduled Transfers/Terminations; Cancel-then-finalize path in selfcheck
  - [x] Wire Termination incompatible-future list to include Scheduled `TransferRecorded` (and Transfer list to include Termination)

- [x] Task 4: Headcount reserve + atomic move port (AC: #1, #2, #5, #6)
  - [x] Schema + APIs: reserve / releaseReservation / Effective convert-or-move; slot row lock
  - [x] Panel aggregate read for used/reserved/free
  - [x] Hook Cancel (lifecycle) to release Reservation for Scheduled Transfer
  - [x] Document FR-30 Start remainder + 4.12–4.14 in `deferred-work.md`

- [x] Task 5: UI / tRPC (AC: #1, #4, #6)
  - [x] Extend form: Transfer fieldset + `headcount-capacity-panel` + confirm; Save ≠ Finalize
  - [x] Surface conflicts in Persian; gold Finalize disabled on recalc pending (UX-DR5)
  - [x] Permissions `personnel_event.draft` / `.finalize`
  - [x] Interactive a11y DoD (focus, errors, dialog)

- [x] Task 6: Selfchecks + DoD (AC: #1–#7)
  - [x] New `personnel-event-transfer.selfcheck.ts` with exact cardinality oracles
  - [x] Prove: Scheduled → reserve; profile/source counts unchanged; Cancel releases reserve
  - [x] Prove: Effective finalize → one source close + one dest open; coverage holds; capacity moved once
  - [x] Prove: evaluation-by-date / recalc applies due Scheduled Transfer without status UPDATE
  - [x] Prove: no-op reject; last-unit concurrency (or transactional lock oracle); missing facts / inactive refs block
  - [x] Prove: retry finalize / recalc replay idempotent (no double reserve/consume/release)
  - [x] Re-run event-store, draft, lifecycle, ordering, recalc, start-return, termination, workers — all green
  - [x] Update `deferred-work.md`; align story Status ↔ `sprint-status.yaml`; **no UTF-8 BOM**

### Review Findings

- [x] [Review][Decision] Cancel vs Reverse when due Scheduled Transfer still only reserved — resolved: **both** (Cancel while storage=`Scheduled` + effect unapplied; Reverse undoes reserve/Primaries/capacity via `undoTransferApply`)

- [x] [Review][Patch] Effective capacity move can release source without consuming destination [`packages/modules/person-employment/src/personnel-event-transfer.ts:615`]
- [x] [Review][Patch] Mid-move throw leaves `didReleaseSource` false so compensate cannot undo source release [`packages/modules/person-employment/src/personnel-event-transfer.ts:572`]
- [x] [Review][Patch] Recalc reapplies neutralized Transfers — apply set ignores Cancel/Reverse children [`packages/modules/person-employment/src/personnel-event-recalc.ts:464`]
- [x] [Review][Patch] Recalc Scheduled path re-reserves Cancelled future Transfers [`packages/modules/person-employment/src/personnel-event-projection-hook.ts:117`]
- [x] [Review][Patch] Close+open Primary not wrapped in one Prisma transaction — mid-window zero Primaries visible [`packages/modules/person-employment/src/personnel-event-transfer.ts:532`]
- [x] [Review][Patch] Idempotent `existingDest` path runs capacity move without try/catch or accurate compensate flags [`packages/modules/person-employment/src/personnel-event-transfer.ts:462`]
- [x] [Review][Patch] Idempotent path without closed source can convert/consume dest without releasing source seat [`packages/modules/person-employment/src/personnel-event-transfer.ts:476`]
- [x] [Review][Patch] Null `sourcePrimary.sourceEventId` silently skips source capacity release (`requireConsumption: false`) [`packages/modules/person-employment/src/personnel-event-transfer.ts:624`]
- [x] [Review][Patch] Scheduled reserve path missing `isTransferNoop` guard [`packages/modules/person-employment/src/personnel-event-transfer.ts:332`]
- [x] [Review][Patch] Transfer form missing current source Primary summary (UJ-1) [`apps/web/components/personnel/personnel-event-form.tsx:680`]
- [x] [Review][Patch] Narrow incompatible-future query to peer types only (drop catch-all same-employment) [`packages/modules/person-employment/src/personnel-event-transfer.ts:270`]
- [x] [Review][Patch] `ensureHeadcountCapacitySchema` adds `reserved_units` without CHECK matching SQL migration [`packages/modules/headcount/src/index.ts:140`]
- [x] [Review][Patch] Capacity panel treats missing/error slot like used/reserved/free = 0 [`apps/web/components/personnel/headcount-capacity-panel.tsx:19`]
- [x] [Review][Patch] Cancel reserved-only Transfer after ED ≤ asOf [`personnel-event-lifecycle.ts`]
- [x] [Review][Patch] Reverse undoes Transfer Primaries/capacity/reservation [`undoTransferApply`]

- [x] [Review][Defer] Prisma Primary projectors vs PoolClient finalize txn (AD-6) [`personnel-event-transfer.ts` / finalize] — deferred, pre-existing
- [x] [Review][Defer] `evaluateHeadcountCapacity` TOCTOU before locked reserve/consume — same Start pattern; writes still FOR UPDATE [`packages/modules/headcount/src/index.ts:191`] — deferred, pre-existing

## Dev Notes

### Current code state (READ BEFORE CODING)

| Area | Path | Today | 4.7 change |
| --- | --- | --- | --- |
| Projection hook | `packages/modules/person-employment/src/personnel-event-projection-hook.ts` | Start/Return/Termination; Transfer comment no-op | **Wire** Transfer reserve/apply + compensate |
| Conflicts | `personnel-event-conflicts.ts` | Transfer in consuming set → unconditional `HEADCOUNT_UNAPPROVED` | Real port + no-op + peers |
| Finalize | `personnel-event-finalize.ts` | AD-6 hook; status Scheduled\|Effective by ED vs asOf | VERIFY compensate path for Transfer; risk if any |
| Recalc | `personnel-event-recalc.ts` | `applyToCurrentProjection: event.status === "Effective"` | **Use** `evaluationStatusAsOf` |
| Resolve | `personnel-event-resolve.ts` | `evaluationStatusAsOf` already treats due Scheduled as Effective for readers | Reuse for apply decisions |
| Lifecycle Cancel | `personnel-event-lifecycle.ts` | Cancel Scheduled | **Release** Transfer reservation on Cancel |
| Primary writers | `primary-assignment.ts` | `applyPrimaryAssignmentProjection` / `closePrimaryAssignmentProjection` | Call from Transfer apply only |
| Coverage | `primary-assignment-invariants.ts` | `assertPrimaryCoverageForActiveEmployment` | Call **after** close+open |
| Headcount | `packages/modules/headcount/src/index.ts` | evaluate / consume / release | **Add** reserve + panel read + locks |
| Form | `apps/web/components/personnel/personnel-event-form.tsx` | Scaffold/Start/Return/Termination | Add Transfer + capacity panel |
| tRPC | `apps/web/src/server/personnel-event.ts` | Draft/finalize/lifecycle | Transfer payloads + panel query if needed |

### What must be preserved

- Append-only kernel event-store; Cancel/Reverse/Correction chains only via lifecycle writers
- FR-16: Scheduled must not mutate **current** Primary/Employment projections (reserve ≠ Primary mutation)
- Half-open `[start, endExclusive)`; Asia/Tehran date-only
- Start/Return/Termination Operators and release/consume idempotency
- ALS projection hook (not module-global production hook)
- Evidence blobs without national ID / compensation / sensitive narratives
- No UTF-8 BOM on `sprint-status.yaml`

### Architecture compliance

- **AD-2:** SoT = append-only business events; Employment/Primary/headcount = projections
- **AD-3:** Kernel owns event-store / temporal-engine / audit-envelope
- **AD-6:** Critical current refresh (Primary move + capacity) in same txn as append; heavy historical via recalc + pending UI
- **Naming:** `TransferRecorded` only for product Transfer
- **Authz:** `governedProcedure` + fine permissions + audit envelope
- **Module boundary:** headcount port stays thin; person-employment owns Transfer Operator

### AR / fail-closed (do not invent)

| Artifact | Rule for 4.7 |
| --- | --- |
| AR-TEMPORAL | Inactive refs as-of ED block; exclusive ends; evaluation-by-date; pre-Baseline disposition C unchanged |
| AR-HEADCOUNT | Narrow reserve/consume/release only; no Approval/Matching/Override catalogue |
| AR-DATA | Lean codes; no inventing full catalogues |
| AR-ACCESS | No toxic Transfer matrix invention |
| AR-SECONDARY | Do not expand Secondary Transfer product |
| AR-IDENTITY | Person untouched; PopulationPort cutover criteria only — do not execute cutover |

### Previous story intelligence (4.5–4.6)

- Pattern: `personnel-event-{domain}.ts` + hook branch + conflicts + selfcheck + form fieldset
- Capacity APIs idempotent on `event_id` / `release_event_id` — reserve must be too
- AD-6 Prisma projector vs `PoolClient` finalize → **compensate** on post-hook failure (4.5/4.6 patches)
- Coverage asserts **after** combined writes — Transfer false-fails if asserted mid-close (Epic 3 / 4.1 handoff)
- Termination closes Employment; Transfer must **not**
- Review lessons: multi-consumption fail-closed; do not clear release markers when undo skipped; peer Scheduled same-type in incompatible-future; `didClose*` flags only when mutation actually occurred; seed real Secondaries if asserting Secondary behavior; noon-UTC dates; no BOM
- Deferred: single-connection projector SQL; finalize early-return orphan heal; Scheduled Start durable reserve (Transfer forces Transfer reserve only)

### Git intelligence

Recent commits: `669c8a8` story 4.6 → `fe658a6` story 4.5 → `752d64f` story 4.4 → `367c3a0` story 4.3.

Continue: tsx selfchecks, governed tRPC, raw SQL kernel + headcount port, Prisma projections, Persian `messageFa`, thin `@divan/headcount` expansion.

### Latest tech notes

- **Concurrency:** Prefer `SELECT id FROM headcount_capacity_slot WHERE … FOR UPDATE` then conditional `UPDATE … free_units` / reserved counters in the same txn (PostgreSQL row lock). Atomic `UPDATE … WHERE free_units > 0 RETURNING` is acceptable if reserved accounting stays consistent.
- **Half-open intervals:** Do not switch to inclusive-end BETWEEN.
- **pg-boss:** Reuse existing recalc queue — no second queue for Transfer.
- **Reservation schema:** Minimal table or columns (e.g. `headcount_capacity_reservation` with `UNIQUE(event_id)` + reserved_units, or reserved counter on slot + reservation row). Keep Approval product out.

### Project structure notes

```text
packages/modules/person-employment/src/
  personnel-event-transfer.ts              # NEW — parse + apply + compensate
  personnel-event-transfer.selfcheck.ts    # NEW
  personnel-event-projection-hook.ts       # UPDATE — Transfer branch
  personnel-event-conflicts.ts             # UPDATE — port + no-op + peers
  personnel-event-recalc.ts                # UPDATE — evaluationStatusAsOf apply flag
  personnel-event-lifecycle.ts             # UPDATE — release reservation on Cancel
  personnel-event-finalize.ts              # VERIFY — compensate wiring
  primary-assignment.ts                    # CALL close/apply helpers
packages/modules/headcount/src/index.ts    # UPDATE — reserve / panel / locks
packages/db/sql/                           # NEW e.g. 008_headcount_reservation.sql
apps/web/src/server/personnel-event.ts
apps/web/components/personnel/
  personnel-event-form.tsx                 # UPDATE
  headcount-capacity-panel.tsx             # NEW (or colocated fieldset) — UX-DR13
```

### Testing requirements

- Pattern: `tsx` + `node:assert` + real `DATABASE_URL` (Vitest still deferred).
- Exact cardinality: N finalize retries → one event; one reservation or one capacity move per Transfer `event_id`; exactly one open Primary as-of ED.
- Matrix: Scheduled reserve + unchanged today; Effective atomic move; recalc due-Scheduled apply; no-op; last-unit concurrency; Cancel releases; incompatible future + Cancel dispose; inactive refs; past-dated + pending CTA; Start/Return/Termination regression.
- Regression: `@divan/event-store`, draft, lifecycle, ordering, recalc, start-return, termination, workers.
- Seed DoD: FK-shaped fixtures (two teams with capacity); `$transaction` / `withTransaction`; exact counts.

### Absolute non-goals

- Job/level/contract/compensation change Operators (4.8)
- Current/historical Person or org reconstruction products (4.9–4.11)
- Full Headcount Approval / Matching / Reservation-expiry / Override catalogue UI (4.12–4.14)
- PopulationPort cutover execution; IDOR hardening on list/get (unless explicitly pulled)
- Auto-Cancel of future events inside finalize
- Public Transfer CRUD / mid-close coverage asserts
- Weakening append-only / Scheduled Primary discipline / Start-Return-Termination behaviors
- Inventing open AR numbers

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.7]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-22, FR-30, FR-31, UJ-1, NFR-4]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-6, TransferRecorded naming]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — UJ-1, headcount-capacity-panel, UX-DR5/11/13/14]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — headcount-capacity-panel token]
- [Source: `_bmad-output/implementation-artifacts/4-6-termination-events.md` — mirror close/release + review patches]
- [Source: `_bmad-output/implementation-artifacts/4-5-start-return-events.md` — mirror open/consume]
- [Source: `_bmad-output/implementation-artifacts/4-1-append-only-event-store-attributable-event-record.md` — Transfer coverage sequencing handoff]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/modules/person-employment/src/personnel-event-projection-hook.ts`]
- [Source: `packages/modules/person-employment/src/personnel-event-resolve.ts` — `evaluationStatusAsOf`]
- [Source: `packages/modules/headcount/src/index.ts` — consume/release port to extend]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Concurrent last-unit oracle initially false-passed when Transfer preferred slot fell through to another team slot; fixed by dedicating a single-slot team for the concurrency case.

### Completion Notes List

- Shipped `TransferRecorded` Operator: Scheduled destination reserve (FR-30), Effective atomic Primary close+open + coverage-after + source release / dest convert-or-consume (FR-22/31), Cancel releases reservation, `TRANSFER_NOOP`, evaluation-by-date recalc apply via `evaluationStatusAsOf` without storage status UPDATE.
- Extended `@divan/headcount` with reservation schema (`008_headcount_reservation.sql`), `reserveHeadcountCapacity` / `releaseHeadcountReservation` / `convertReservationToConsumption` / `readHeadcountCapacityPanel`, slot `FOR UPDATE` on mutate paths (NFR4).
- UI: Transfer fieldset + `headcount-capacity-panel` + tRPC `personnelEvent.headcountCapacity`; permissions unchanged (`personnel_event.draft` / `.finalize`).
- Selfcheck `personnel-event-transfer` green; regressions green: event-store, draft, lifecycle, recalc, start-return, termination; typecheck green for person-employment, headcount, web.

### File List

- packages/db/sql/008_headcount_reservation.sql
- packages/modules/headcount/src/index.ts
- packages/modules/person-employment/src/personnel-event-transfer.ts
- packages/modules/person-employment/src/personnel-event-transfer.selfcheck.ts
- packages/modules/person-employment/src/personnel-event-projection-hook.ts
- packages/modules/person-employment/src/personnel-event-conflicts.ts
- packages/modules/person-employment/src/personnel-event-termination.ts
- packages/modules/person-employment/src/personnel-event-recalc.ts
- packages/modules/person-employment/src/personnel-event-finalize.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/package.json
- apps/web/components/personnel/headcount-capacity-panel.tsx
- apps/web/components/personnel/personnel-event-form.tsx
- apps/web/src/server/personnel-event.ts
- apps/web/package.json
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-7-team-transfer-with-atomic-capacity-movement.md

### Change Log

- 2026-07-18: Implemented Story 4.7 Team Transfer with atomic capacity movement (FR-22/30/31, UJ-1).
- 2026-07-18: Code review patches — Cancel reserved-only + Reverse undo; capacity fail-closed; recalc skip neutralized; Prisma close+open txn; UI source Primary summary.

## Story completion status

Status: **done**

Completion note: Transfer Operator + review patches applied (Cancel reserved-only + Reverse undo, capacity atomicity, recalc neutralization skip, UI source Primary summary); selfchecks green.
