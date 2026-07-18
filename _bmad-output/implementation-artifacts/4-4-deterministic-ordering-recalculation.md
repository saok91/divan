---
baseline_commit: 367c3a0
---

# Story 4.4: Deterministic Ordering & Recalculation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want identical reconstruction from the same authoritative event set, including retroactive changes,
so that current and historical views never diverge silently (FR18, NFR3, NFR4).

## Gate (read first)

**This story ships the deterministic same-day ordering comparator (FR-18), recalc-from-earliest-affected-point substrate with failure/staleness visibility (NFR3), async heavy path via pg-boss + real `recalculation_pending` + gold-CTA disable (AD-6 / UX-DR5), irreconcilable-ordering conflict when detectable, and pre-Baseline Override+Persian ack+audit wiring on the existing conflict path. It does not ship domain Start–Transfer projectors or product current/as-of reconstruction UIs.**

| Allowed in 4.4 | Forbidden in 4.4 |
| --- | --- |
| Canonical apply-order comparator: same Effective Date → registration/finalization time **ASC**; UUID/`id` only when times equal (Asia/Tehran; date-only Effective Date; exclusive interval ends) | Claiming current/as-of Person or org reconstruction products done (→ 4.9–4.11) |
| Recalc trigger from earliest affected Effective Date after past-dated finalize / Cancel / Reverse / Correction; expose pending/failed/stale — **never** silent stale-as-current | `UPDATE` / `DELETE` on `kernel_events`; flipping original `status` Scheduled→Effective in place (keep evaluation-by-date from 4.3) |
| Heavy historical recalc via **pg-boss** queue `temporal.recalculate` (idempotent handler); wire `PlatformStatusProvider.recalculationPending` + `StaleRecalcBanner` + gold CTA block to **real** backend signal | Sync-only deep backdate that blocks the request without pending UI; inventing a second queue infra |
| Extend `classifyConflicts` with detectable **irreconcilable ordering** blocking finding + Persian `messageFa` | Replacing conflict taxonomy; inventing full AR-TEMPORAL scenario/oracle matrix |
| Pre-Baseline: keep disposition **C** (gate inactive until `conflictPolicy.baselineBoundaryDate`); Override + mandatory Persian warning ack + audit on existing `PRE_BASELINE_EFFECTIVE_DATE` / `WARNING_ACK_ALLOW_LIST` path — never silent pre-Baseline invention | Inventing a default Baseline epoch; parallel baseline gate outside `personnel-event-conflicts.ts` |
| Pure helpers in `@divan/temporal-engine`; enqueue from domain finalize/lifecycle; worker in `workers/` | Prisma `KernelEvent` / module-local event log; silent PopulationPort cutover; hash-chain; Reservation math |
| Selfcheck(s) proving order stability + pending visibility + append-only / 4.2–4.3 regressions green | Vitest mandate without ephemeral DB; fixing deferred IDOR on list/get (out of scope unless explicitly pulled in) |

### Mandated design — apply order vs list order (non-negotiable)

```text
UI / timeline list (already in listBusinessEventsForPerson):
  ORDER BY effective_date DESC, registered_at DESC, id DESC   ← display only

Authoritative apply / reconstruct order (THIS STORY):
  1. effective_date ASC (date-only)
  2. coalesce(finalized_at, registered_at) ASC
  3. id ASC (UUID) only when timestamps equal

Never reuse DESC list SQL as the reconstruct comparator.
```

Place the comparator in `@divan/temporal-engine` (package comment already reserves Epic 4 for ordering/rebuild). Domain and workers **import** it — do not duplicate sort keys in SQL ad hoc without calling the same helper (or a documented SQL twin that matches the helper exactly).

### Mandated design — AD-6 sync vs async

| Work class | Behavior |
| --- | --- |
| **Critical** (finalize/lifecycle that must refresh **current** projections now) | Same DB txn as append + existing `runProjectionRefreshHook` (scaffold OK while domain projectors absent) |
| **Heavy historical** (past-dated change / Reverse / Correction that requires rebuild from an earlier Effective Date) | Enqueue `temporal.recalculate`; set durable `recalculation_pending` (or equivalent) for affected person/scope; UI banner + disable gold CTAs on affected finalize/export/report actions; on failure mark stale/failed — **do not serve stale as current** |

Recalc **must not** mutate original `kernel_events` rows. Rebuild means re-running projection hooks / future projectors over the ordered authoritative set from the earliest affected point forward. Domain projectors for Start/Transfer remain stubs (4.5–4.8) — prove the **engine + queue + pending contract** with a no-op or test double projector if needed.

### Pre-Baseline (AC #3) — extend, do not reinvent

Already in `personnel-event-conflicts.ts` / finalize:

- Unset `baselineBoundaryDate` → gate **inactive** (disposition C); `payload.requireBaselineCheck=true` → `BASELINE_NOT_CONFIGURED` blocking.
- Set boundary + `effectiveDate < baseline` → `PRE_BASELINE_EFFECTIVE_DATE` warning (Override path) or blocking.
- Finalize requires ack codes on `WARNING_ACK_ALLOW_LIST` (`PRE_BASELINE_EFFECTIVE_DATE`).

**4.4 owns:** prove Override + Persian warning acknowledgement + audit envelope evidence on that path; never silent accept. Governed Baseline **revision** product path stays out of scope (AR-MIGRATION / Epic 6) — document as alternate future path only.

[Source: `epics.md` Story 4.4; `prd.md` FR-18, NFR3, NFR4, LG-4, AR-TEMPORAL §7.1; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-6 + Consistency Conventions; Stories 4.1–4.3; `deferred-work.md`; UX `EXPERIENCE.md` stale-recalc-banner / UX-DR5]

## Acceptance Criteria

1. **Given** Asia/Tehran; Effective Date date-only; exclusive interval ends (AR-TEMPORAL partial freeze)  
   **When** same-Effective-Date events collide  
   **Then** ordering is registration/finalization time ascending; UUID only if times collide

2. **When** past-dated change, Cancel, Reverse, or Correction occurs  
   **Then** affected derived state recalculates from the earliest affected point; failure/staleness is exposed (not silently served)  
   **And** heavy historical recalc may run async via pg-boss with visible `recalculation_pending` and disabled gold CTAs on affected actions

3. **When** a native event earlier than Baseline is submitted  
   **Then** it requires explicit Override, mandatory Persian warning acknowledgement, and audit (or governed Baseline revision path) — never silent pre-Baseline invention

4. **And** Story 4.1–4.3 invariants remain green: append-only trigger, Draft→Finalize, Cancel/Reverse/Correction chains, evaluation-by-date Scheduled→Effective, AD-6 sync seam, conflict classifier disposition C; this story does **not** deliver Start/Transfer/Terminate domain projectors or current/historical reconstruction products

## Tasks / Subtasks

- [x] Task 1: Canonical ordering in `@divan/temporal-engine` (AC: #1, #4)
  - [x] Add pure `compareBusinessEventsForApply` / `orderBusinessEventsForApply` (names flexible) using: `effectiveDate` ASC → `coalesce(finalizedAt, registeredAt)` ASC → `id` ASC
  - [x] Document exclusive interval ends remain via existing `dateOnlyInInterval` / `intervalsOverlap` — do not invent new calendar rules
  - [x] Unit-style selfcheck (no DB required) with fixed fixtures proving stability and UUID tie-break
  - [x] Export from package `index.ts`; keep date helpers unchanged

- [x] Task 2: Irreconcilable ordering conflict (AC: #1, #4)
  - [x] Extend `personnel-event-conflicts.ts` with blocking code e.g. `IRRECONCILABLE_ORDERING` when same-day dependent collision is **detectable** with current stubs (fail-closed; Persian `messageFa`)
  - [x] Wire into finalize classify path; do not weaken existing Employment/headcount/baseline findings
  - [x] If full dependent-graph detection needs domain events not yet shipped (4.5+), ship the code + a conservative detectable case + Dev Notes for extension — do not invent Transfer/Start semantics

- [x] Task 3: Recalc substrate + pg-boss (AC: #2, #4)
  - [x] Define durable pending/failed signal for affected person (or scope) — prefer kernel/module table or documented status row; **must outlive** React mock state. Wire read into web `PlatformStatusProvider` (replace demo-only toggle as source of truth for real pending)
  - [x] Unstub `workers/`: `pg-boss@12.26.0` — `createQueue('temporal.recalculate')`, `send`, `work`; handler **idempotent** (singleton key or dedupe on personId+fromDate+generation)
  - [x] From past-dated finalize / Reverse / Correction (and Cancel when it affects derived history): compute earliest affected Effective Date; enqueue in same txn when pg-boss supports transactional send, else enqueue immediately after commit with exactly-once guard
  - [x] Critical path: keep sync `runProjectionRefreshHook` for current-touching ops; do not move critical headcount-style work solely to async
  - [x] Handler: load authoritative business events for person from earliest point, apply `orderBusinessEventsForApply`, invoke projection refresh seam (no-op OK); clear pending on success; set failed/stale on error (retry per pg-boss; UI stays blocking while pending/failed)

- [x] Task 4: UI / UX-DR5 wiring (AC: #2)
  - [x] Drive `recalculationPending` / `blockingStale` from server status (tRPC query or existing platform status path) — keep `StaleRecalcBanner` `role="alert"`
  - [x] Ensure gold CTAs on affected finalize/export/report stay disabled while pending/stale (`isGoldCtaBlocked`)
  - [x] Sensitive-confirmation remains blocked when stale/recalc gates active (UX-DR14) — do not regress Story 1.7 / 4.2 dialogs
  - [x] Demo toggles on personnel demo may remain for a11y demos but must not be the only way to show pending in production path

- [x] Task 5: Pre-Baseline Override + ack + audit proof (AC: #3)
  - [x] Selfcheck or governed path proof: pre-Baseline finalize without Override/ack fails; with Override + ack succeeds and leaves audit/access evidence
  - [x] Preserve disposition C when baseline unset; no invented epoch

- [x] Task 6: Regression selfchecks + DoD (AC: #4)
  - [x] New `@divan/temporal-engine` and/or `@divan/person-employment` / `@divan/workers` selfcheck scripts; root script optional
  - [x] Re-run event-store + personnel-event-draft + personnel-event-lifecycle selfchecks — all green
  - [x] Exact cardinality on enqueue/idempotent recalc; no silent duplicate jobs that double-apply
  - [x] Update `deferred-work.md`: move ordering/recalc / irreconcilable stub items to landed; leave 4.5–4.11 / IDOR / Vitest as deferred
  - [x] Align story Status ↔ `sprint-status.yaml`; **no UTF-8 BOM** on yaml edits

### Review Findings

- [x] [Review][Decision→Dismiss] Cancel never schedules heavy recalc — resolved: Cancel-of-Scheduled does not affect derived history (Task 3 qualifier; `applyToCurrentProjection: false`); leave without enqueue until domain projectors need otherwise.
- [x] [Review][Decision→Defer] `stale` status never transitions in production — deferred: substrate + UI ready; no timeout policy in 4.4; `failed` already blocks; revisit with ops/retry policy.
- [x] [Review][Patch] Web/API process never registers recalc enqueue — pending rows orphan without jobs [`personnel-event-recalc.ts:316`] — fixed: `apps/web/src/server/recalc-enqueue.ts` + `readyFinalizePool`
- [x] [Review][Patch] No reclaim/outbox for pending after failed/missing post-commit enqueue [`personnel-event-recalc.ts:316`] — fixed: worker `reclaimPendingRecalculations` on bootstrap
- [x] [Review][Patch] `singletonSeconds: 1` + generation bump can leave permanent pending (stale job skipped, new job coalesced away) [`workers/src/index.ts:51`] — fixed: singletonKey includes generation
- [x] [Review][Patch] Apply list silent LIMIT 500/2000 then clear pending — truncated history served as fresh [`business-event.ts:635`] [`personnel-event-recalc.ts:359`] — fixed: refuse clear + mark failed at cap
- [x] [Review][Patch] `platformStatus.recalc` catch returns non-blocking false (comment claims fail-closed) [`platform-status.ts:29`] — fixed: fail closed to blocking
- [x] [Review][Patch] Invalid worker job payload `continue`s as success — pending never fails/retries [`workers/src/index.ts:65`] — fixed: throw on invalid payload
- [x] [Review][Patch] `getPlatformRecalcSignal` LIMIT 50 can miss pending/failed outside window [`personnel-event-recalc.ts:286`] — fixed: EXISTS aggregates
- [x] [Review][Patch] Idempotent Reverse/Correct replay skips re-enqueue after prior enqueue gap [`personnel-event-lifecycle.ts:291`] — fixed: `reenqueuePendingRecalculationIfNeeded`
- [x] [Review][Patch] `toEpochMs` NaN/invalid Date collapses ordering non-deterministically [`order-business-events.ts:21`] — fixed: NaN → 0
- [x] [Review][Patch] `APPLY_ORDER_SQL_ORDER_BY` unused — SQL ORDER BY hard-coded twin drift risk [`business-event.ts:642`] — fixed: SQL uses constant
- [x] [Review][Patch] UTF-8 BOM on `sprint-status.yaml` (Task 6 forbids) [`sprint-status.yaml:1`] — fixed: BOM stripped
- [x] [Review][Defer] Generation check outside txn (TOCTOU) before apply+clear — deferred, clear still generation-gated; stub projectors limit blast radius [`personnel-event-recalc.ts:351`]

## Dev Notes

### Current code state (READ BEFORE CODING)

| Area | Path | Today | 4.4 change |
| --- | --- | --- | --- |
| Temporal package | `packages/kernel/temporal-engine/src/` | Date-only helpers only; comment says ordering/rebuild = Epic 4 | **NEW** comparator + exports |
| Event store list | `listBusinessEventsForPerson` | `ORDER BY effective_date DESC, registered_at DESC, id DESC` | **Preserve** for UI; add apply-order API or helper usage separately |
| Chain lists | `listChainLinksForEvent(s)` | `ORDER BY registered_at ASC, id ASC` | Align with FR-18 tie-break; do not break batching |
| Lifecycle | `personnel-event-lifecycle.ts` | Cancel/Reverse/Correction append-only; past-dated rebuild deferred | **Enqueue** recalc |
| Finalize | `personnel-event-finalize.ts` | AD-6 sync hook; baseline ack | Past-dated → enqueue; keep sync hook |
| Conflicts | `personnel-event-conflicts.ts` | PRE_BASELINE / disposition C; **no** IRRECONCILABLE_* code yet | **Add** ordering conflict |
| Resolve | `personnel-event-resolve.ts` | Evaluation-by-date Scheduled→Effective | **Preserve** — no status UPDATE |
| Projection hook | `personnel-event-projection-hook.ts` | Scaffold no-op | Invoked by sync path + recalc handler |
| Workers | `workers/src/index.ts` | `WORKERS_STUB = true`; dep `pg-boss@12.26.0` | **Real** bootstrap + handler |
| UI pending | `platform-status-provider.tsx`, `stale-recalc-banner.tsx` | Client mock/`setRecalculationPending` | Wire to durable backend |

### Architecture compliance

- **AD-2:** Projections rebuilt by temporal-engine path; never in-place SoT.
- **AD-3:** Kernel owns `event-store`, `temporal-engine`, `audit-envelope`.
- **AD-6:** Critical = sync in append txn; heavy = pg-boss + visible pending.
- **Queue naming:** `temporal.recalculate` (domain-prefixed); idempotent handlers.
- **Stack pin:** pg-boss **12.26.x** (workers already on `12.26.0`). API: `new PgBoss(connection)`, `start()`, `createQueue(name)`, `send(name, data, options)`, `work(name, handler)` — Node 22+ / PG 13+ per package.
- **Ops:** Stuck recalc → pg-boss retry; UI shows pending; restore = replay append-only store (`infra-security-brief.md` §7).

### AR-TEMPORAL partial freeze (fail-closed)

**Frozen:** Asia/Tehran; Effective Date date-only; exclusive ends; same-date order by registration/finalization time (UUID if times equal); future as-of = planned not Effective; pre-Baseline native events need Override + Persian warning + audit.

**Do not invent:** full Override approver matrix; Baseline-revision product details; complete scenario/oracle inventory; reorganization/reference validity; published-report supersession triggers (FR-54 stays later).

### Previous story intelligence (4.1–4.3)

- Append-only neutralization is law: Cancel/Reverse/Correction = **new** rows; originals never UPDATEd.
- Cancel↔effect: `FOR UPDATE` + Tehran as-of; transaction-scoped advisory locks only.
- `applyToCurrentProjection: false` for Scheduled finalize and Cancel-of-Scheduled — **do not weaken**.
- Dates: always `@divan/temporal-engine`; never `toISOString().slice(0,10)` for PG DATE.
- ALS projection hook — not module-global in production path.
- Persian `messageFa` at tRPC boundary; Admin-only lifecycle PermissionSets for Reverse/Correction.
- PopulationPort cutover criteria exist (`population-cutover.ts`) — **do not cut over**.
- Deferred IDOR on get/resolve/listForPerson — out of scope.
- Optional `004_business_event_chain_indexes.sql` — wire only if ordering/recalc queries need it.

### Git intelligence

Recent commits: `367c3a0` story 4.3 → `15d1bb9` story 4.2 → `43b8ffa` story 4.1. Continue tsx selfcheck + governed tRPC + raw SQL kernel patterns from those commits.

### Latest tech notes (pg-boss 12.26)

- Prefer `send` uniqueness/singleton options so duplicate enqueues coalesce.
- `work` handlers receive job arrays in v12 — handle batch shape per current docs.
- Same PostgreSQL as app DB (architecture: no extra broker).
- Keep `WORKERS_STUB` export only if tests need it; production path must not leave stub as default once handlers exist (or gate behind explicit env with fail-closed messaging).

### Project structure notes

```text
packages/kernel/temporal-engine/src/   # NEW ordering helpers + selfcheck
packages/kernel/event-store/src/       # optional apply-order list helper; NO UPDATE API
packages/modules/person-employment/src/
  personnel-event-conflicts.ts         # IRRECONCILABLE_ORDERING
  personnel-event-finalize.ts          # enqueue past-dated
  personnel-event-lifecycle.ts         # enqueue past-dated R/C/(C)
  personnel-event-projection-hook.ts   # keep AD-6 seam
workers/src/                           # temporal.recalculate handler
apps/web/src/server/                   # status query for pending/stale
apps/web/components/platform-status-provider.tsx
apps/web/components/stale-recalc-banner.tsx
packages/db/sql/                       # NEW migration only if pending table needed; never edit applied 001–003 history
```

### Testing requirements

- Pattern: `tsx` + `node:assert` + real `DATABASE_URL` for DB paths; pure comparator can be DB-free.
- Exact cardinality assertions (enqueue, neutralizing events, pending rows).
- Prove: two same-`effective_date` events order stable; past-dated Correction → pending visible and gold CTA blocked; pre-Baseline path; append-only still rejects UPDATE.
- Do not claim Vitest/ephemeral isolation done (Epic 3 open item) unless you deliberately add it.

### Absolute non-goals

- Start / Return / Terminate / Transfer / job-comp domain Operators (4.5–4.8)
- Current person projection product / historical Person / org headcount reconstruction UIs (4.9–4.11)
- Headcount Approval / Reservation / Override product (4.12–4.14)
- Timeline product UX-DR9 (5.3) — UI sort there is DESC display, separate from this engine
- Hash-chain / AuthAttempt migration / PopulationPort cutover / IDOR fix

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-18, NFR3, NFR4, LG-4, AR-TEMPORAL §7.1]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-6, Consistency Conventions, Stack]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md` — §7 stuck recalculation]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — stale-recalc-banner]
- [Source: `_bmad-output/implementation-artifacts/4-3-scheduled-state-cancel-reverse-correction.md` — handoffs]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- PG DATE ↔ JS Date TZ skew (Asia/Tehran) can make date-equality miss; exclusive-key IRRECONCILABLE stub queries by `payload->>'orderingExclusiveKey'` (fail-closed). Recalc status dates returned via `to_char(..., 'YYYY-MM-DD')`.
- Lifecycle selfcheck self-ref assertion fixed to use a fresh target (prior correction caused idempotent replay before self-ref check).

### Completion Notes List

- FR-18 apply-order comparator + SQL twin `listBusinessEventsForPersonForApply`; UI DESC list preserved.
- Durable `recalculation_status` + post-commit enqueue; pg-boss queue `temporal.recalculate` with singleton coalesce; idempotent handler by generation.
- `IRRECONCILABLE_ORDERING` detectable stub via `orderingExclusiveKey`; full dependent graph deferred to 4.5+.
- Pre-Baseline Override writes `personnel_event.pre_baseline_override` access event + draft overrideEvidence/warningAcks; disposition C when baseline unset.
- PlatformStatusProvider polls `platformStatus.recalc`; gold CTA block unchanged (`isGoldCtaBlocked`).
- Selfchecks green: ordering, personnel-event-recalc, draft, lifecycle, event-store, workers recalc.

### Implementation Plan

1. Pure ordering helpers in temporal-engine + DB-free selfcheck
2. Conflict code + recalc table/module + finalize/lifecycle enqueue
3. Workers unstub + UI/tRPC wiring + regression suite

### File List

- packages/kernel/temporal-engine/src/order-business-events.ts
- packages/kernel/temporal-engine/src/order-business-events.selfcheck.ts
- packages/kernel/temporal-engine/src/index.ts
- packages/kernel/temporal-engine/src/date-only.ts
- packages/kernel/temporal-engine/package.json
- packages/kernel/temporal-engine/tsconfig.json
- packages/kernel/event-store/src/business-event.ts
- packages/kernel/event-store/src/index.ts
- packages/db/sql/005_recalculation_status.sql
- packages/modules/person-employment/src/personnel-event-recalc.ts
- packages/modules/person-employment/src/personnel-event-recalc.selfcheck.ts
- packages/modules/person-employment/src/personnel-event-conflicts.ts
- packages/modules/person-employment/src/personnel-event-finalize.ts
- packages/modules/person-employment/src/personnel-event-lifecycle.ts
- packages/modules/person-employment/src/personnel-event-lifecycle.selfcheck.ts
- packages/modules/person-employment/src/errors.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/package.json
- workers/src/index.ts
- workers/src/recalc.selfcheck.ts
- workers/package.json
- apps/web/src/server/platform-status.ts
- apps/web/src/server/recalc-enqueue.ts
- apps/web/src/server/root.ts
- apps/web/components/platform-status-provider.tsx
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-4-deterministic-ordering-recalculation.md

### Change Log

- 2026-07-18: Story 4.4 implementation — deterministic apply ordering, recalc pending substrate, pg-boss worker, UX-DR5 server wiring, pre-Baseline audit evidence.
