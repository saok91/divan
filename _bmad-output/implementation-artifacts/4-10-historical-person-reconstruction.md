---
baseline_commit: 7bb4f50
---

# Story 4.10: Historical Person Reconstruction

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized user,
I want as-of reconstruction of supported Person state,
So that historical investigation is deterministic and Baseline limits are disclosed (FR26).

## Gate (read first)

**This story ships the historical / as-of Person reconstruction product on top of the 4.9 assembler — validated arbitrary `asOf`, Baseline limitation disclosure, and future-as-of planned-state semantics. It does not ship org/headcount historical totals, full profile sections, PopulationPort cutover, Baseline migration provenance (FR-39), or new event Operators.**

| Allowed in 4.10 | Forbidden in 4.10 |
| --- | --- |
| Product `asOf` date-only (Tehran) on the shared Person-state read path | Second assembler / replay engine / denormalized historical SoT table |
| Baseline limitation disclosure when boundary configured or honesty when unset | Inventing a default Baseline epoch; inventing FR-39 migration provenance UI |
| Future `asOf` → explicit **planned** semantics; never label as Effective early | Calling `getActive*AsOf(future)` as if Scheduled projections were already applied |
| Thin governed tRPC + as-of Jalali picker foreshadow (extend 4.9 foreshadow) | Full `person-profile-section` (→ 5.2); search (→ 5.1); timeline (→ 5.3); reports (→ 5.5) |
| Close 4.9 defer: validate `asOf` with `parseDateOnly` | Claiming FR-27 done (→ 4.11); PopulationPort cutover; new Operators / projection-hook branches |
| Selfchecks: past as-of after Transfer; future planned; Baseline disclosure; dual-consumer equality at same `asOf` | UTF-8 BOM on `sprint-status.yaml`; Vitest mandate without ephemeral DB |

### Mandated design — extend 4.9 assembler (non-negotiable)

```text
kernel_events (SoT)
  → AD-6 hooks (4.5–4.8) → Employment / Primary / Secondary / Comp rows
  → getCurrentPersonState / getPersonStateAsOf (SAME assembly helpers)
        │
        ├─ parseDateOnly(asOf) — fail-closed invalid
        ├─ asOf <= today → assemble(asOf) + viewSemantics: historical|current
        ├─ asOf > today  → planned path (see below) — NEVER Effective label
        ├─ baselineDisclosure from baselineBoundaryDate policy/env
        └─ freshness fail-closed unchanged
```

- **Do not** create `PersonHistoricalState` / snapshot Prisma table.
- **Do not** replay `listBusinessEventsForPerson*` to rebuild Employment/Primary on GET.
- **Do not** call `apply*Projection` from the read path.
- **Do not** invent a second DTO family that drifts from `CurrentPersonState` facts — extend with metadata fields (`viewSemantics`, `baselineDisclosure`) or a thin wrapper that reuses the same facts + `currentPersonStateFactsForCompare`.

### Mandated design — past / today as-of (historical + current)

| `asOf` vs today (Tehran) | `viewSemantics` | Facts assembly |
| --- | --- | --- |
| `asOf === today` | `current` | Existing 4.9 path (default) |
| `asOf < today` | `historical` | `getCurrentPersonState(..., { asOf })` — projection as-of helpers |

- Half-open intervals, Asia/Tehran date-only, noon-UTC DB discipline unchanged.
- `scheduledChanges` remains the lean channel for Finalized events still pre-effect **as of that `asOf`**.
- Freshness: `pending|failed|stale` still fail-closed (NFR-3) — do not serve gold historical truth while recalc is broken for that Person.

### Mandated design — future as-of = planned (AR-TEMPORAL / FR-26) — CRITICAL

Projection writers apply Scheduled→Effective only when evaluation-by-date reaches Effective (and AD-6 / recalc have run). Naively calling `getActive*AsOf(personId, futureDate)` while a Transfer is still Scheduled can **hide** the Transfer from `scheduledChanges` (lifecycle resolves to Effective at that future `asOf`) **without** Primary rows having moved — torn “fake history.”

**Required future path (`isFutureAsOf(asOf) === true`):**

```text
viewSemantics = "planned"
effectiveFactsAsOf = todayDateOnlyTehran()     # assemble facts at TODAY only
plannedChangesThroughAsOf = Finalized events where
  today < effectiveDate <= asOf
  AND resolveLifecycleStatus(..., today) === "Scheduled"
  (lean rows: id, eventType, effectiveDate, resolvedStatus: "Scheduled")
remainingScheduledAfterAsOf = Finalized events where effectiveDate > asOf
  AND resolveLifecycleStatus(..., asOf) === "Scheduled"  # still pre-effect even at planned date
```

| Rule | Detail |
| --- | --- |
| Never label Effective | Response / UI must say planned / برنامه‌ریزی‌شده — not Effective / مؤثر for the future as-of view |
| Facts stay today’s Effective | Do **not** fold `plannedChangesThroughAsOf` into Employment/Primary/comp fact fields |
| Use `isFutureAsOf` | `@divan/temporal-engine` already exports it — do not reimplement calendar compare |
| UI | Distinct badge / copy for planned view (UX-DR10 family); Scheduled badges for planned changes |

### Mandated design — Baseline limitation disclosure (FR-26)

Write-path already gates pre-Baseline via `ConflictPolicy.baselineBoundaryDate` in `classifyConflicts` (inactive when unset — do **not** invent an epoch).

| Config | Disclosure behavior |
| --- | --- |
| `baselineBoundaryDate` configured and `asOf < boundary` | Return structured `baselineDisclosure` with `limited: true`, boundary date, Persian `messageFa` explaining reconstructable-history limits before Baseline — **still return best-effort projection facts** with the disclosure (do not invent pre-Baseline state; do not silently pretend full fidelity) |
| Boundary unset | `baselineDisclosure.configured: false` + Persian honesty that Baseline boundary is not configured / reconstructable-history limit unknown — **do not invent** a default date |
| `asOf >= boundary` (or today/future with boundary set) | `limited: false` (or omit limited flag); may still echo configured boundary for transparency |

Implementation sketch (prefer one shared reader used by finalize + as-of read):

- Resolve boundary from the same source finalize will use (env e.g. `DIVAN_BASELINE_BOUNDARY_DATE` or existing policy injection). If web finalize does not yet pass boundary, introduce a **single** `getBaselineBoundaryDate(): string | null` helper in `person-employment` and wire both conflict policy (when callers omit) and as-of disclosure — avoid two divergent configs.
- New Persian copy for **read disclosure** (distinct from write Override `MSG_BASELINE_BOUNDARY_BLOCKED_FA`).

### Mandated design — API / UI surface

| Layer | Delivery |
| --- | --- |
| Module | Extend `current-person-state.ts` (or thin `historical-person-state.ts` that only adds semantics + disclosure and calls the assembler) |
| tRPC | Expose optional `asOf` on `person.getCurrentState` **or** add `person.getStateAsOf` that shares the same module function — Zod: date-only via `parseDateOnly` (reject timestamps) |
| UI | Extend `current-person-state-foreshadow.tsx` with `JalaliDatePicker` for as-of; show `viewSemantics` + Baseline banner; Persian digits — **not** full profile |
| Permissions | Same as 4.9: `person.read` + compensation omit; do not invent AR-ACCESS toxic matrix / as-of scope grants (FR-47 full temporal authz stays open — reuse coarse read) |

### Mandated design — shared consumer semantics

- Profile / list / report callers must use the same module API for a given `(personId, asOf, authz)`.
- Oracle: two wrappers → deep-equal comparable facts via `currentPersonStateFactsForCompare` (extend compare helper to ignore or separately assert `viewSemantics` / `baselineDisclosure` metadata).

[Source: `epics.md` Story 4.10; `prd.md` FR-26, FR-16, FR-18, FR-25, FR-39, FR-47; `ARCHITECTURE-SPINE.md` AD-2, AD-6, PROJECTION_HISTORICAL; Story 4.9 Gate; AR-TEMPORAL partial freeze]

## Acceptance Criteria

1. **Given** a selected as-of date (Asia/Tehran date-only)  
   **When** historical Person state is requested for `asOf ≤ today`  
   **Then** supported Person state reconstructs from projection as-of helpers (Employment status, organization/Team, Assignment, Role, Title, Ladder, Grade, Seniority, contractual/compensation if permitted, and other approved categories already on the 4.9 DTO) — **not** from registration time and **not** via event-log replay on read

2. **And** Baseline limitations are disclosed (structured field + Persian `messageFa`): limited when `asOf` is before configured boundary; honest “not configured” when boundary unset — never invent a default Baseline epoch or fabricated pre-Baseline history

3. **And** future as-of (`asOf > today`) uses planned-state semantics (`viewSemantics: "planned"`), keeps Effective facts at **today**, lists planned changes through `asOf` separately, and **never** labels the future view as Effective

4. **And** invalid `asOf` (non date-only / ambiguous timestamp) is rejected fail-closed; recalculation pending/failed/stale still fail-closed; Person-not-found precedes freshness (4.9 patches preserved)

5. **And** Stories 4.1–4.9 invariants remain green; this story does **not** deliver historical org/headcount (4.11), Headcount Approval/Matching/Override (4.12–4.14), FR-39 Baseline provenance product, PopulationPort cutover, or full Epic 5 profile/search/timeline/report UI

## Tasks / Subtasks

- [x] Task 1: As-of validation + semantics metadata (AC: #1, #3, #4)
  - [x] Validate `options.asOf` with `parseDateOnly` from `@divan/temporal-engine`; Persian validation error on fail
  - [x] Branch on `isFutureAsOf`; implement planned path (facts @ today + `plannedChangesThroughAsOf`)
  - [x] Add `viewSemantics: "current" | "historical" | "planned"` to success DTO (name may vary; keep explicit)
  - [x] Preserve `scheduledChanges` meaning for ≤ today; do not break 4.9 default (`asOf` omitted → today / `current`)

- [x] Task 2: Baseline disclosure (AC: #2)
  - [x] Single helper to resolve `baselineBoundaryDate` (null if unset)
  - [x] Attach `baselineDisclosure` to success payloads; distinct Persian read-side copy
  - [x] Selfcheck: configured boundary + `asOf < boundary` → `limited: true`; unset → configured false / honesty message
  - [x] Do not invent FR-39 migrated-vs-native provenance UI

- [x] Task 3: tRPC + foreshadow UI (AC: #1, #3, #5)
  - [x] Expose product `asOf` on governed procedure (extend `getCurrentState` or add `getStateAsOf`)
  - [x] Extend foreshadow with `JalaliDatePicker`; show semantics + Baseline banner; Scheduled/planned badges
  - [x] Keep compensation omit / `DEV_DEMO_CATEGORIES` pattern (defer production category enablement)
  - [x] Interactive a11y: labelled picker, alert roles for disclosure/errors, keyboard-reachable submit (DoD snippet)

- [x] Task 4: Module boundaries & non-goals (AC: #5)
  - [x] No new Prisma historical table; no projection-hook / Operator edits unless proven read bug
  - [x] No PopulationPort registry swap; no FR-27 org/headcount reconstruction
  - [x] Web never imports compensation Prisma / `@prisma/client`

- [x] Task 5: Selfchecks + DoD (AC: #1–#5)
  - [x] Extend `current-person-state.selfcheck.ts` or add `historical-person-state.selfcheck.ts`
  - [x] Oracles: past as-of after Effective Transfer shows destination Team; future as-of planned (facts @ today Team; Transfer in planned channel; no Effective label); Baseline disclosure; invalid asOf rejected; dual-consumer equality at same asOf; regress 4.9 Scheduled≠current oracles
  - [x] Re-run event-store, draft, lifecycle, ordering, recalc, start-return, termination, transfer, job-level, compensation, current-person-state, workers — all green
  - [x] Update `deferred-work.md`; align story Status ↔ `sprint-status.yaml`; **no UTF-8 BOM**

### Review Findings

- [x] [Review][Decision] Invalid `DIVAN_BASELINE_BOUNDARY_DATE` silently treated as unset — resolved: **fail-closed** (`getBaselineBoundaryDate` throws; conflicts push `BASELINE_BOUNDARY_INVALID`)
- [x] [Review][Patch] `resolveViewSemantics` re-calls `isFutureAsOf` (fresh `todayDateOnlyTehran`) instead of using captured `today` — midnight Tehran can mislabel future asOf as `historical` and assemble facts at a future date [packages/modules/person-employment/src/current-person-state.ts:206]
- [x] [Review][Patch] tRPC `asOf` is `z.string().min(1)` only; spec mandates Zod date-only via `parseDateOnly` [apps/web/src/server/person.ts:246]
- [x] [Review][Patch] Selfcheck «historical after Effective Transfer → destination Team» uses `asOf: today` (`viewSemantics: current`); no `asOf < today` after a past Effective Transfer [packages/modules/person-employment/src/current-person-state.selfcheck.ts:547]
- [x] [Review][Patch] `options.baselineBoundaryDate` override only `trim`s — invalid calendar string can yield wrong `limited` via lexicographic compare [packages/modules/person-employment/src/current-person-state.ts:353]
- [x] [Review][Patch] Foreshadow submit can use stale/omitted `asOf` if JalaliDatePicker draft was typed but not blurred/committed [apps/web/components/personnel/current-person-state-foreshadow.tsx:59]
- [x] [Review][Patch] As-of visible label is `<span>` without `htmlFor` / `aria-labelledby` wiring to the picker [apps/web/components/personnel/current-person-state-foreshadow.tsx:86]
- [x] [Review][Patch] Planned «never Effective» oracle uses brittle `JSON.stringify(...).includes('"Effective"')` [packages/modules/person-employment/src/current-person-state.selfcheck.ts:637]
- [x] [Review][Patch] Planned path does not assert `scheduledChanges` (remaining after asOf) [packages/modules/person-employment/src/current-person-state.selfcheck.ts:620]
- [x] [Review][Patch] Dual-consumer equality does not assert `baselineDisclosure`; env reader path untested in selfcheck [packages/modules/person-employment/src/current-person-state.selfcheck.ts:569]
- [x] [Review][Defer] Planned path double `scanScheduledChanges` (planned + remaining) TOCTOU / torn lists — deferred, pre-existing [packages/modules/person-employment/src/current-person-state.ts:409]

## Dev Notes

### Current code state (READ BEFORE CODING)

| Area | Path | Today | 4.10 change |
| --- | --- | --- | --- |
| Assembler | `packages/modules/person-employment/src/current-person-state.ts` | `getCurrentPersonState`; `asOf` optional, **unvalidated**; no semantics/Baseline metadata | **UPDATE** — validate; planned branch; disclosure |
| Selfcheck | `current-person-state.selfcheck.ts` | Today / Scheduled / freshness oracles | **Extend** with historical + planned + Baseline |
| Date helpers | `packages/kernel/temporal-engine/src/date-only.ts` | `parseDateOnly`, `todayDateOnlyTehran`, **`isFutureAsOf`** | **Call** — do not duplicate |
| Lifecycle | `personnel-event-resolve.ts` | `evaluationStatusAsOf`, `resolveLifecycleStatus` | Use for planned-change filters; careful with future asOf |
| Baseline write gate | `personnel-event-conflicts.ts` `ConflictPolicy.baselineBoundaryDate` | Inactive when unset; selfchecks pass explicit policy | Shared reader for disclosure; optional wire to finalize later |
| Baseline copy (write) | `errors.ts` `MSG_BASELINE_BOUNDARY_BLOCKED_FA` | Override / block on finalize | Keep; add **read** disclosure messages separately |
| tRPC | `apps/web/src/server/person.ts` `getCurrentState` | Input: `personId` only | Add `asOf` (optional) + map validation errors |
| Foreshadow | `apps/web/components/personnel/current-person-state-foreshadow.tsx` | Person id + current summary | Jalali as-of + semantics/Baseline UI |
| Jalali picker | `apps/web/components/jalali-date-picker.tsx` | Used on forms | Reuse |
| Projection writers | `personnel-event-projection-hook.ts` | 4.5–4.8 | **Do not modify** |
| Event lists | `@divan/event-store` | Apply ASC vs UI DESC | Apply order only for Scheduled/planned scans; truncation fail-closed at 2000 |

### What this story changes vs preserves

**Changes:** product as-of, validation, `viewSemantics`, Baseline disclosure, future planned path, thin UI picker, tRPC input.

**Preserves:** AD-2 projections-never-SoT; FR-16 Scheduled≠current facts before Effective; half-open intervals; compensation isolation; 4.9 freshness fail-closed; person-before-freshness; Scheduled scan truncation fail-closed; append-only store; no UTF-8 BOM; Status ↔ sprint-status alignment.

### Architecture compliance

- **AD-2:** Historical view = derived projection read / planned overlay — never authoritative mutation
- **AD-3:** Logic stays in `person-employment` (+ temporal-engine helpers); compensation via public API only
- **AD-6:** Heavy historical **recalc** remains async pg-boss (4.4); this story is **read** — no sync full-replay-on-GET; `PROJECTION_HISTORICAL` satisfied by as-of projection assembly + planned semantics, not a new table
- **Stack:** Prisma projections; raw SQL event-store; tRPC web only; existing `tsx` selfcheck pattern

### AR / fail-closed (do not invent)

| Artifact | Rule for 4.10 |
| --- | --- |
| AR-TEMPORAL | Date-only Tehran; exclusive ends; future as-of = planned not Effective; Baseline boundary honesty; pre-Baseline Override stays write-path |
| AR-MIGRATION / FR-39 | Disclosure of limitation only — no full Baseline provenance / import identity product |
| AR-ACCESS / FR-47 | Coarse `person.read` only; do not invent management as-of scope grants |
| AR-DATA | Omit unauthorized/disabled fields; do not enable reject-disposition categories |
| AR-HEADCOUNT | No historical headcount/org counts (→ 4.11) |
| AR-IDENTITY | No PopulationPort cutover |
| AR-REPORTING | No report catalogue as-of product (→ 5.5) |

### Previous story intelligence (4.9)

- Assembler **already** accepts `asOf` internally — productize it; do not fork.
- Review patches mandatory: truncation fail-closed; person existence before freshness; Scheduled Title/Transfer oracles; Cancel removes from scheduled; FAILED+STALE paths; contractual omit with compensation; `try/finally` + `pool.end()`.
- Open defer this story **closes:** `asOf` format validation when product-exposed.
- Leave deferred: `DEV_DEMO_CATEGORIES`; torn sequential reads; separate `createPgPool`; TOCTOU freshness; foreshadow non-UUID / raw error (optional light harden only if touching foreshadow).
- Never use `listBusinessEventsForPerson` DESC for derive; never `toISOString().slice(0,10)` for PG DATE.
- Past-dated Start may leave `recalculation_status=pending` — clear before gold-truth selfcheck reads.

### Git intelligence

```text
7bb4f50 story 4.9  ← current-person-state assembler (extend here)
8de3f2e story 4.8  ← job/comp operators — do not retouch unless read bug
1e29400 story 4.7  ← Transfer Scheduled reserve vs Effective Primary
669c8a8 story 4.6  ← Termination
fe658a6 story 4.5  ← Start/Return
```

Pattern continuity: domain module + `tsx` selfcheck + thin governed tRPC + optional foreshadow; Persian `messageFa`; no new write Operators.

### Latest tech notes

- Industry practice (2025–26): temporal as-of queries are first-class **reads**; at scale prefer purpose-built projections over per-request full stream replay. Divan already materializes interval projections — **compose as-of helpers**, do not rehydrate from the raw log on every GET.
- Snapshots/checkpoints are an optimization for long streams; MVP (~500 people) does **not** need a new historical snapshot table (AD-6 + existing projections suffice).
- Keep planned future state explicit in the API contract so clients cannot mistake it for Effective history.

### Project structure notes

```text
packages/modules/person-employment/src/
  current-person-state.ts              # UPDATE — validate, planned, disclosure
  current-person-state.selfcheck.ts    # UPDATE (or NEW historical-*.selfcheck.ts)
  index.ts                             # UPDATE — exports
  package.json                         # UPDATE — script if new selfcheck file
  personnel-event-conflicts.ts         # OPTIONAL shared baseline reader only
apps/web/src/server/person.ts          # UPDATE — asOf input
apps/web/components/personnel/
  current-person-state-foreshadow.tsx  # UPDATE — Jalali as-of + banners
_bmad-output/implementation-artifacts/
  deferred-work.md                     # UPDATE
  sprint-status.yaml                   # UPDATE — ready-for-dev → (later done)
```

### Testing requirements

- Pattern: `tsx` + `node:assert` + real `DATABASE_URL` (Vitest still deferred).
- Exact oracles listed in Task 5; dual-consumer deep-equal at identical `(personId, asOf, authz)`.
- Seed DoD: FK-shaped Person + Employment + Primary + Effective Transfer (or Start→Transfer) + optional Scheduled future Transfer + optional `baselineBoundaryDate` in test policy/env; `$transaction` only for fixture writes; exact counts.
- Regression: 4.1–4.9 + workers selfchecks green; typecheck `@divan/person-employment` + `web`.

### Absolute non-goals

- Historical organization & headcount reconstruction (4.11 / FR-27)
- FR-39 Baseline migration provenance / imported-vs-native event identity UI
- Headcount Approval / Matching / Reservation-expiry / Override catalogue (4.12–4.14)
- Full profile sections, search, timeline, dashboard, report catalogue (Epic 5)
- PopulationPort default-registry cutover
- New Personnel Event Operators or projection-hook domain branches (unless critical read bug)
- New authoritative historical Prisma table; sync full-event replay on GET
- Inventing open AR numbers; enabling reject-disposition dictionary elements
- Full FR-47 temporal/cross-boundary as-of authorization matrix
- Weakening FR-16 / append-only / compensation isolation
- UTF-8 BOM on `sprint-status.yaml`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.10]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-26, FR-16, FR-18, FR-25, FR-39, FR-47, AR-TEMPORAL]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-6, PROJECTION_HISTORICAL]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — status badges; jalali-date-picker]
- [Source: `_bmad-output/implementation-artifacts/4-9-current-person-state-projection.md`]
- [Source: `_bmad-output/implementation-artifacts/4-4-deterministic-ordering-recalculation.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/modules/person-employment/src/current-person-state.ts`]
- [Source: `packages/kernel/temporal-engine/src/date-only.ts` — `parseDateOnly`, `isFutureAsOf`]
- [Source: `packages/modules/person-employment/src/personnel-event-conflicts.ts` — Baseline policy]
- [Source: `packages/modules/person-employment/src/personnel-event-resolve.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Workers recalc selfcheck initially failed due to backlog of pending `temporal.recalculate` jobs from prior selfchecks (singleton coalesce); cleared `pgboss.job` + pending/failed/stale `recalculation_status`, then green — not a 4.10 code regression.

### Completion Notes List

- Extended `getCurrentPersonState` with `parseDateOnly` validation, `viewSemantics` (current|historical|planned), future planned path (facts @ today + `plannedChangesThroughAsOf` + remaining `scheduledChanges`), and `baselineDisclosure`.
- Added shared `getBaselineBoundaryDate()` (`DIVAN_BASELINE_BOUNDARY_DATE`); wired into conflict policy when callers omit boundary; distinct Persian read-side disclosure copy.
- Product `asOf` on `person.getCurrentState`; foreshadow Jalali picker + semantics/Baseline banners (a11y labels + `role="alert"`).
- Selfcheck oracles: invalid asOf, Baseline limited/unset, historical Team after Transfer, planned Transfer channel, dual-consumer equality, 4.9 regressions; event-store→compensation + workers green.
- No historical Prisma table; no projection-hook/Operator edits; no PopulationPort/FR-27/FR-39 UI.

### File List

- packages/modules/person-employment/src/baseline-boundary.ts
- packages/modules/person-employment/src/current-person-state.ts
- packages/modules/person-employment/src/current-person-state.selfcheck.ts
- packages/modules/person-employment/src/personnel-event-conflicts.ts
- packages/modules/person-employment/src/errors.ts
- packages/modules/person-employment/src/index.ts
- apps/web/src/server/person.ts
- apps/web/components/personnel/current-person-state-foreshadow.tsx
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-10-historical-person-reconstruction.md

### Change Log

- 2026-07-19: Story 4.10 implementation — historical/planned as-of Person reconstruction + Baseline disclosure; status → review
- 2026-07-19: Code review — fail-closed Baseline env, midnight-safe viewSemantics, Zod asOf, foreshadow commit/a11y, selfcheck oracles; status → done

## Story completion status

Status: **done**

Completion note: Code review patches applied (fail-closed Baseline env, midnight-safe semantics, Zod asOf, foreshadow commit/a11y, strengthened selfchecks); deferred TOCTOU double-scan remains documented.
