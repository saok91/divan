---
baseline_commit: ea232af
---

# Story 4.11: Historical Organization & Headcount Reconstruction

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized user,
I want historical Team/organization counts and headcount quantities for a supported date,
So that transfers and corrections affect totals only at resolved effective points (FR27).

## Gate (read first)

**This story ships FR-27 as-of reconstruction of Team membership counts, organization unit counts, and approved/used/reserved/free headcount quantities under one metric catalogue — built on existing Primary/OrgUnit as-of helpers + an event-linked headcount ledger read (not live slot counters for historical dates). It does not ship Headcount Approval lifecycle, Matching, Override catalogue, dashboard/report products, or new write Operators.**

| Allowed in 4.11 | Forbidden in 4.11 |
| --- | --- |
| Product `asOf` date-only (Tehran) for org + headcount reconstruction | Treating `headcount_capacity_slot.free_units` / `reserved_units` as historical truth for `asOf < today` |
| Metric catalogue: membership, org-unit counts by type, approved/used/reserved/free | Inventing Headcount Approval entity / lifecycle (→ 4.12) |
| Membership from Primary half-open as-of (Transfer moves count only at Effective) | Counting Secondary as Team membership; inventing AR-SECONDARY headcount |
| Headcount used/reserved reconstructed from consumption + reservation rows **joined to business events** (effective + lifecycle) | Full event-log replay on GET to rebuild Primary/OrgUnit; new denormalized historical SoT table |
| Detail rows + aggregate totals that deep-equal under the same catalogue | Divergent ad-hoc SQL in web routers that disagree with module metrics |
| Thin governed tRPC + optional foreshadow (Jalali as-of + tabular numerals) | Full dashboard (→ 5.4); launch report catalogue (→ 5.5); `/headcount` Approval admin UI (→ 4.12) |
| Baseline disclosure + future `asOf` planned semantics (mirror 4.10 patterns where applicable) | Inventing default Baseline epoch; labeling future totals as Effective early |
| Selfchecks: Transfer effective-point membership; Scheduled reserve vs Effective consume; detail≡aggregate | UTF-8 BOM on `sprint-status.yaml`; Vitest mandate without ephemeral DB; PopulationPort cutover |

### Mandated design — compose as-of projections (non-negotiable)

```text
kernel_events (SoT)
  → AD-6 hooks → Primary / OrgUnit / headcount_capacity_* rows
        │
        ├─ membership: listTeamMembersAsOf / Primary active-as-of (person-employment)
        ├─ org counts: getHierarchyAsOf / OrgUnit active-as-of by unitType
        └─ headcount quantities: NEW reconstructHeadcountQuantitiesAsOf (headcount module)
              used/reserved from ledger + getBusinessEventById (effective + lifecycle)
              approved / free via metric catalogue identity (below)
                    │
                    ▼
getHistoricalOrgHeadcountState({ asOf, scope? })   # coordinator (person-employment)
  → same catalogue for detail + aggregate
  → viewSemantics + baselineDisclosure (reuse 4.10 helpers)
```

- **Do not** create `OrgHeadcountSnapshot` / historical SoT Prisma table.
- **Do not** call `apply*Projection` / capacity mutate APIs from the read path.
- **Do not** use `readHeadcountCapacityPanel` alone for historical `asOf` — that API reads **live** counters (correct for UX-DR13 finalize panel / today; wrong as FR-27 history).
- **Do not** import `@divan/person-employment` from `@divan/headcount` (dependency direction: person-employment → headcount already exists). Put capacity as-of **in headcount**; put org/membership assembly + coordinator **in person-employment** (or thin web adapter that only calls public APIs).

### Mandated design — metric catalogue (FR-27 reconcile)

Single catalogue used by detail rows and aggregates. Names may vary in code; semantics must not.

| Metric key | Definition (MVP / pre-Approval) | Source of truth for as-of |
| --- | --- | --- |
| `teamMembershipCount` | Persons with **Primary** Team membership active at `asOf` (FR-11) | `listTeamMembersAsOf(teamId, asOf)` length (or equivalent Primary query with same half-open rules) |
| `orgUnitCount` by `unitType` | OrgUnits active at `asOf` (LE / BU / DEPARTMENT / TEAM, …) | `getHierarchyAsOf` / `isOrgUnitActiveAsOf` |
| `used` | Capacity units **consumed and not yet released** as of `asOf` | `headcount_capacity_consumption` where consume event Effective ≤ asOf **and** (no release **or** release event Effective > asOf); Cancelled/Reversed consume events excluded via lifecycle |
| `reserved` | Capacity units held by active Reservation as of `asOf` | `headcount_capacity_reservation` linked to Finalized transfer/title event that is still **Scheduled** at `asOf` (lifecycle), or reservation `status='reserved'` and event not yet Effective at `asOf`; converted/released do not count |
| `approved` | Slot capacity ceiling for the as-of interval | **Until 4.12:** conserved slot size `approved = used_live + reserved_live + free_live` from **current** counters (or equivalent seed ceiling) for slots whose validity contains `asOf` — document as Approval-stand-in; **do not invent** Approval rows |
| `free` | `approved - used - reserved` (may be computed; never silently floor negative if Override later — Override → 4.14) | Catalogue identity; for MVP without Override, free ≥ 0 |

**Conservation (selfcheck):** for each in-scope slot at a given `asOf`, `approved === used + reserved + free`.

**Detail vs aggregate:** `sum(detail.teamMembershipCount)` over scoped teams === aggregate membership; same for headcount quantities. Oracle: two callers / detail-rollups deep-equal under `*FactsForCompare` helper.

### Mandated design — effective points (FR-27 / UJ-1)

| Change | Membership / org counts | Headcount used | Headcount reserved |
| --- | --- | --- | --- |
| Future Transfer **Finalized** (Scheduled) | Source Team count unchanged until Effective | Source still used | Destination **reserved** (FR-30) |
| Transfer **Effective** | Source −1 / dest +1 at Effective date | Source released; dest used (convert) | Reservation converted — not reserved |
| Correction / Reverse | Only at resolved lifecycle + projection intervals | Follow release/consume undo already written by Operators | Follow reservation release/convert already written |
| Secondary Assignment | **Never** in membership counts by default | No headcount | — |

### Mandated design — past / today / future as-of

Reuse `@divan/temporal-engine` `parseDateOnly`, `todayDateOnlyTehran`, `isFutureAsOf`, and `getBaselineBoundaryDate` from 4.10.

| `asOf` vs today | `viewSemantics` | Behavior |
| --- | --- | --- |
| `asOf === today` | `current` | Membership/org as-of today; headcount may use live panel **or** ledger path if ledger ≡ live (selfcheck both agree for fixture) |
| `asOf < today` | `historical` | Membership/org as-of; headcount **must** use ledger reconstruction — **not** live `free_units` |
| `asOf > today` | `planned` | Membership/org facts stay at **today**; expose planned capacity/membership deltas separately (Scheduled transfers through asOf) — **never** label future membership/capacity as Effective |

Invalid `asOf` → fail-closed. Baseline disclosure: same honesty rules as 4.10 (`limited` / not configured) — attach to reconstruction payload.

### Mandated design — API / UI surface

| Layer | Delivery |
| --- | --- |
| `@divan/headcount` | `reconstructHeadcountQuantitiesAsOf(db, { asOf, teamId?, slotId? })` (+ types); keep `readHeadcountCapacityPanel` for finalize UX |
| `@divan/person-employment` | `getHistoricalOrgHeadcountState` (or equivalent) composing membership + org counts + headcount public API |
| tRPC | Governed procedure e.g. `organization.getHistoricalCounts` and/or `headcount.getStateAsOf` — Zod date-only via `parseDateOnly`; coarse `person.read` / `organization.read` (reuse existing) — **do not invent** FR-47 toxic matrix |
| UI | Optional foreshadow near `/personnel` or org surface: Jalali as-of, membership + capacity table with `{tabular}` numerals (UX-DR13 family); Persian empty/error — **not** full dashboard |
| Permissions | Coarse read only; omit out-of-scope Teams if scope filter already exists — fail closed if required inputs missing |

### Mandated design — freshness

If platform exposes org-/slot-level recalc pending for affected Persons in scope, fail-closed or return typed freshness (do not serve gold historical totals while known recalc is pending for people in the counted set). Prefer reusing existing recalculation signals; do not invent a second banner system.

[Source: `epics.md` Story 4.11; `prd.md` FR-27, FR-11, FR-16, FR-18, FR-25–FR-26, FR-30; `ARCHITECTURE-SPINE.md` AD-2, AD-3, AD-6, PROJECTION_HISTORICAL; Stories 4.7, 4.9, 4.10; UX-DR13]

## Acceptance Criteria

1. **Given** a supported historical date (Asia/Tehran date-only) and permitted scope  
   **When** historical Team/org/headcount counts are requested for `asOf ≤ today`  
   **Then** Team membership counts, organization unit counts, and approved/used/reserved/free headcount reconstruct under the metric catalogue above — membership from Primary as-of helpers; headcount from event-linked ledger (not live counters for historical dates)

2. **And** transfers and corrections affect membership totals only at resolved Effective points; Scheduled Transfer keeps source membership until Effective while destination shows reserved capacity (FR-30 / UJ-1)

3. **And** detailed and aggregate results reconcile under the same metric catalogue (selfcheck: rollup equality)

4. **And** future `asOf` uses planned semantics (facts @ today + planned channel); Baseline limitations disclosed; invalid `asOf` rejected fail-closed

5. **And** Stories 4.1–4.10 invariants remain green; this story does **not** deliver Headcount Approval/Matching/Override (4.12–4.14), Epic 5 dashboard/reports, PopulationPort cutover, or new Personnel Event Operators

## Tasks / Subtasks

- [x] Task 1: Headcount as-of ledger reader (AC: #1, #2)
  - [x] Add `reconstructHeadcountQuantitiesAsOf` in `@divan/headcount` (used/reserved/approved/free per slot or Team+title)
  - [x] Join consumption/reservation `event_id` → `getBusinessEventById`; apply Effective + `resolveLifecycleStatus` / Cancelled-Reversed exclusion
  - [x] Document that `readHeadcountCapacityPanel` remains live/finalize-only; historical path must not silently call it for `asOf < today`
  - [x] Selfcheck: live panel ≡ ledger at `asOf=today` for fixture slot after Start+Scheduled Transfer

- [x] Task 2: Org + membership reconstruction coordinator (AC: #1, #2, #3)
  - [x] Implement `getHistoricalOrgHeadcountState` in person-employment composing `listTeamMembersAsOf`, org-unit as-of counts, headcount public API
  - [x] Detail + aggregate DTOs; `*FactsForCompare` ignoring wall-clock metadata
  - [x] `viewSemantics` + `baselineDisclosure` via existing 4.10 helpers (`parseDateOnly`, `isFutureAsOf`, `getBaselineBoundaryDate`)
  - [x] Planned path for future asOf (AC #4)

- [x] Task 3: tRPC + optional foreshadow (AC: #1, #4, #5)
  - [x] Governed procedure with Zod date-only `asOf`; map validation errors to Persian `messageFa`
  - [x] Optional foreshadow: Jalali picker, tabular numerals, semantics/Baseline banners; interactive a11y (labelled picker, `role="alert"`, keyboard submit)
  - [x] Web never imports `@prisma/client` / compensation Prisma

- [x] Task 4: Module boundaries & non-goals (AC: #5)
  - [x] No Approval lifecycle / Matching matrix / Override catalogue
  - [x] No new historical SoT table; no projection-hook / Operator edits unless proven read bug
  - [x] No PopulationPort cutover; no dashboard/report catalogue product
  - [x] `@divan/headcount` must not depend on person-employment

- [x] Task 5: Selfchecks + DoD (AC: #1–#5)
  - [x] New `historical-org-headcount.selfcheck.ts` (and/or headcount selfcheck) with oracles:
    - Past as-of after Effective Transfer: source membership −1, dest +1; capacity used moved
    - After Scheduled (not Effective) Transfer finalize: source membership unchanged; dest reserved ≥ 1; source still used
    - Detail rollup === aggregate for same `(asOf, scope)`
    - Future asOf planned (no Effective label on future membership)
    - Baseline disclosure limited/unset
    - Invalid asOf rejected
    - `asOf=today` ledger ≡ `readHeadcountCapacityPanel` for fixture
  - [x] Re-run event-store → current-person-state + workers + transfer/start/termination selfchecks — all green
  - [x] Update `deferred-work.md`; align story Status ↔ `sprint-status.yaml`; **no UTF-8 BOM**

## Dev Notes

### Current code state (READ BEFORE CODING)

| Area | Path | Today | 4.11 change |
| --- | --- | --- | --- |
| Capacity port | `packages/modules/headcount/src/index.ts` | Mutate + `readHeadcountCapacityPanel` (**live** counters) | **ADD** as-of ledger reconstruct; keep panel |
| Schema | `packages/db/sql/006–008_headcount_*.sql` | slot / consumption / reservation | **Read only** — no Approval table |
| Membership | `primary-assignment.ts` `resolveTeamMembershipAsOf`; `management-relationship.ts` `listTeamMembersAsOf` | As-of Primary members | **Reuse** for counts |
| Org hierarchy | `org-unit.ts` `getHierarchyAsOf` | As-of tree | **Reuse** for unit-type counts |
| Person as-of | `current-person-state.ts` + `baseline-boundary.ts` | FR-26 product | **Reuse** validation/disclosure helpers; do not fork date logic |
| Events | `@divan/event-store` `getBusinessEventById` | Effective + status | **Join** from capacity ledger |
| tRPC panel | `apps/web/src/server/personnel-event.ts` `headcountCapacity` | Live panel for form | Keep; add separate historical procedure |
| Headcount page | `apps/web/app/(app)/headcount/page.tsx` | Placeholder | Optional foreshadow only — not Approval admin |
| Projection hooks | `personnel-event-projection-hook.ts` | 4.5–4.8 | **Do not modify** |

### What this story changes vs preserves

**Changes:** FR-27 read APIs; headcount as-of ledger reconstruction; org/membership aggregate DTO; thin tRPC + optional foreshadow; metric catalogue + selfchecks.

**Preserves:** AD-2 projections-never-SoT; FR-16 Scheduled≠current membership before Effective; FR-30 reserve-on-finalize for Scheduled Transfer; half-open intervals; live capacity panel for finalize UX; append-only store; 4.10 Person as-of; no UTF-8 BOM; Status ↔ sprint-status alignment.

### Architecture compliance

- **AD-2:** Historical org/headcount = derived reads — never authoritative mutation
- **AD-3:** Capacity ledger math in `@divan/headcount`; membership/org in `person-employment`; coordinator must not create headcount→person-employment import cycle
- **AD-6:** Heavy recalc remains async pg-boss (4.4); this story is **read** — no sync full-replay-on-GET; `PROJECTION_HISTORICAL` via as-of composition
- **Stack:** Prisma for OrgUnit/Primary; raw SQL/Pool for capacity tables + event-store; tRPC web only; `tsx` selfcheck pattern

### AR / fail-closed (do not invent)

| Artifact | Rule for 4.11 |
| --- | --- |
| AR-TEMPORAL | Date-only Tehran; exclusive ends; future as-of = planned; Baseline honesty |
| AR-HEADCOUNT | Reconstruct used/reserved/free with MVP approved stand-in; **do not invent** Approval/Matching/Override product (→ 4.12–4.14); keep fail-closed on ambiguous ledger joins |
| AR-ACCESS / FR-47 | Coarse read permissions only |
| AR-DATA | No new sensitive categories |
| AR-IDENTITY | No PopulationPort cutover |
| AR-REPORTING | No launch report/dashboard product (→ 5.4 / 5.5) |
| AR-MIGRATION / FR-39 | Disclosure only — no import provenance UI |
| AR-SECONDARY | Secondary never counts as membership / headcount by default |

### Previous story intelligence (4.10)

- Extend shared date/Baseline helpers — do not duplicate `parseDateOnly` / `isFutureAsOf` / boundary reader.
- Review patches from 4.10 that apply here: fail-closed invalid Baseline env; midnight-safe semantics using captured `today`; Zod `parseDateOnly` on tRPC (not `z.string().min(1)` alone); foreshadow commit Jalali value before submit; a11y `htmlFor` / `aria-labelledby`; avoid brittle `JSON.stringify().includes('"Effective"')` oracles.
- Leave deferred: planned double-scan TOCTOU; torn sequential projection reads; Vitest isolation; PopulationPort; FR-47 matrix.
- Never use `listBusinessEventsForPerson` DESC for derive; never `toISOString().slice(0,10)` for PG DATE; noon-UTC DB dates.
- Past-dated Start may leave `recalculation_status=pending` — clear before gold-truth selfcheck reads.
- Pattern continuity: domain module + `tsx` selfcheck + thin governed tRPC + optional foreshadow; Persian `messageFa`; no new write Operators.

### Git intelligence

```text
ea232af story 4.10  ← Person as-of / Baseline / planned — reuse helpers
7bb4f50 story 4.9   ← assembler pattern
8de3f2e story 4.8   ← Title capacity move
1e29400 story 4.7   ← Transfer reserve vs Effective Primary + capacity
669c8a8 story 4.6   ← Termination release
```

Pattern: module public API + selfcheck oracles + thin tRPC; capacity mutations stay in Operators (4.5–4.8) — 4.11 is read-only reconstruction.

### Latest tech notes

- Industry practice (2025–26): cohort/as-of aggregates should use **validity-interval projections** (Primary/OrgUnit already) or purpose-built ledgers — **not** per-request full stream replay. Live mutable counters are not a historical store.
- For capacity, reconstruct from consumption/reservation rows + event Effective/lifecycle (state-transition ledger), with conservation identity for approved/free until Approval entity exists (4.12).
- Keep planned future state explicit in the API so clients cannot mistake Scheduled reserves/membership moves for Effective history.
- MVP (~500 people): interval + ledger composition is enough; no new snapshot table.

### Project structure notes

```text
packages/modules/headcount/src/
  index.ts                                 # UPDATE — reconstructHeadcountQuantitiesAsOf
  historical-headcount.selfcheck.ts        # NEW (optional if coordinator selfcheck covers)
  package.json                             # UPDATE — selfcheck script if added
packages/modules/person-employment/src/
  historical-org-headcount.ts              # NEW — coordinator
  historical-org-headcount.selfcheck.ts    # NEW
  index.ts                                 # UPDATE — exports
  package.json                             # UPDATE — selfcheck script
  baseline-boundary.ts / current-person-state.ts  # REUSE helpers only
apps/web/src/server/
  organization.ts or headcount.ts          # UPDATE/NEW — governed as-of procedure
apps/web/components/…                      # OPTIONAL foreshadow
_bmad-output/implementation-artifacts/
  deferred-work.md                         # UPDATE
  sprint-status.yaml                       # UPDATE — ready-for-dev → (later done)
```

### Testing requirements

- Pattern: `tsx` + `node:assert` + real `DATABASE_URL` (Vitest still deferred).
- Exact oracles in Task 5; dual-consumer / detail≡aggregate deep-equal.
- Seed DoD: FK-shaped Persons + Employments + Primaries + capacity slots; Effective Start; Scheduled Transfer (reserve); Effective Transfer; `$transaction` for fixture writes; exact counts.
- Regression: 4.1–4.10 + workers selfchecks green; typecheck `@divan/headcount`, `@divan/person-employment`, `web`.

### Absolute non-goals

- Headcount Approval lifecycle / Matching / Reservation-expiry UI / Override catalogue (4.12–4.14)
- Full dashboard, search, profile sections, timeline, report catalogue (Epic 5)
- PopulationPort default-registry cutover
- New Personnel Event Operators or projection-hook domain branches (unless critical read bug)
- New authoritative historical Prisma snapshot table; sync full-event replay on GET
- Using live `free_units`/`reserved_units` as historical as-of truth
- Import cycle headcount → person-employment
- Inventing open AR numbers; enabling reject-disposition dictionary elements
- Full FR-47 temporal/cross-boundary as-of authorization matrix
- Weakening FR-16 / FR-30 / append-only / Secondary non-consumption
- UTF-8 BOM on `sprint-status.yaml`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.11]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-27, FR-11, FR-16, FR-18, FR-26, FR-30, UJ-1]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-6, PROJECTION_HISTORICAL]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — headcount-capacity-panel; jalali-date-picker]
- [Source: `_bmad-output/implementation-artifacts/4-10-historical-person-reconstruction.md`]
- [Source: `_bmad-output/implementation-artifacts/4-9-current-person-state-projection.md`]
- [Source: `_bmad-output/implementation-artifacts/4-7-team-transfer-with-atomic-capacity-movement.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/modules/headcount/src/index.ts` — `readHeadcountCapacityPanel`]
- [Source: `packages/modules/person-employment/src/management-relationship.ts` — `listTeamMembersAsOf`]
- [Source: `packages/modules/person-employment/src/org-unit.ts` — `getHierarchyAsOf`]
- [Source: `packages/modules/person-employment/src/current-person-state.ts`]
- [Source: `packages/kernel/temporal-engine/src/date-only.ts`]
- [Source: `packages/kernel/event-store/src/business-event.ts` — `getBusinessEventById`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Selfcheck fixture initially used shared seed Team (polluted membership count 34); switched to scoped source Team for exact oracles.
- Cancel of Scheduled Transfer required `hr.admin` (not operator) for `personnel_event_cancel`.
- Stripped accidental UTF-8 BOM from `sprint-status.yaml` on status update.

### Completion Notes List

- ✅ `reconstructHeadcountQuantitiesAsOf` — event-linked used/reserved; MVP approved stand-in from live counters; free = approved − used − reserved; fail-closed on missing event joins; does not call live panel for historical dates.
- ✅ `getHistoricalOrgHeadcountState` — membership via `listTeamMembersAsOf`, org counts via `getHierarchyAsOf`, headcount public API; `viewSemantics` + Baseline disclosure; planned channel; freshness fail-closed on recalc pending/failed/stale.
- ✅ tRPC `organization.getHistoricalCounts` with Zod `parseDateOnly`; Persian validation messages; optional `/headcount` Jalali foreshadow with tabular numerals + a11y.
- ✅ Module boundary preserved: headcount ↛ person-employment; no Approval/Matching/Override/SoT table/Operators.
- ✅ Selfcheck oracles green; regressions: current-person-state, transfer, start-return green.

### File List

- packages/modules/headcount/src/historical-headcount.ts (new)
- packages/modules/headcount/src/index.ts
- packages/modules/headcount/package.json
- packages/modules/person-employment/src/historical-org-headcount.ts (new)
- packages/modules/person-employment/src/historical-org-headcount.selfcheck.ts (new)
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/package.json
- apps/web/src/server/organization.ts
- apps/web/components/organization/historical-org-headcount-foreshadow.tsx (new)
- apps/web/app/(app)/headcount/page.tsx
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-11-historical-organization-headcount-reconstruction.md

### Change Log

- 2026-07-19: Implemented FR-27 historical org & headcount reconstruction (ledger as-of + coordinator + tRPC + foreshadow + selfcheck); status → review.
- 2026-07-19: Code review patches applied (lifecycle as-of, conservation fail-closed, freshness/ledger persons, sourceTeamId, scoped team, tRPC uuid/DB error, selfcheck); status → done.

## Story completion status

Status: **done**

Completion note: FR-27 as-of reconstruction shipped; code review findings patched or deferred.

### Review Findings

- [x] [Review][Defer] Planned capacity deltas missing — AC #4 partial: membership planned channel ships now; planned **capacity** deltas deferred (MVP: facts@today already expose live reserved; full planned capacity channel later / with 4.12). Reason: keep 4.11 scoped to FR-27 historical ledger; avoid inventing capacity-delta DTO mid-review.

- [x] [Review][Patch] Lifecycle as-of incomplete for Cancel/Reverse and stored Effective [`packages/modules/headcount/src/historical-headcount.ts`] — fixed: ED-gated evaluation; Cancel/Reverse gate on registeredAt day
- [x] [Review][Patch] Silent `free < 0` floor breaks catalogue conservation [`packages/modules/headcount/src/historical-headcount.ts`] — fixed: CONSERVATION fail-closed
- [x] [Review][Patch] Freshness only checks current team members, not ledger personIds [`packages/modules/person-employment/src/historical-org-headcount.ts`] — fixed
- [x] [Review][Patch] `sourceTeamId` always null in planned deltas [`packages/modules/person-employment/src/historical-org-headcount.ts`] — fixed via Primary as-of
- [x] [Review][Patch] Scoped `teamId` absent from hierarchy as-of returns empty membership without fail-closed [`packages/modules/person-employment/src/historical-org-headcount.ts`] — fixed
- [x] [Review][Patch] `teamId` input not UUID-validated [`apps/web/src/server/organization.ts`] — fixed
- [x] [Review][Patch] Missing `DATABASE_URL` throws raw `Error` not `TRPCError` [`apps/web/src/server/organization.ts`] — fixed
- [x] [Review][Patch] Headcount package script points at non-existent selfcheck [`packages/modules/headcount/package.json`] — removed broken script
- [x] [Review][Patch] Strengthen selfcheck oracles [`packages/modules/person-employment/src/historical-org-headcount.selfcheck.ts`] — fixed; selfcheck green

- [x] [Review][Defer] Planned Transfer scan seeds only from today's scoped members [`packages/modules/person-employment/src/historical-org-headcount.ts`:406-415] — deferred, pre-existing (already in Story 4.11 deferred-work)
- [x] [Review][Defer] N+1 `getBusinessEventById` per ledger event id [`packages/modules/headcount/src/historical-headcount.ts`:239-250] — deferred, pre-existing (MVP scale; batch read later)
- [x] [Review][Defer] Unscoped path O(teams×members) membership + per-person freshness [`packages/modules/person-employment/src/historical-org-headcount.ts`:368-393] — deferred, pre-existing (MVP ~500)
- [x] [Review][Defer] Shared `resolveLifecycleStatus` in person-employment also ignores cancel asOf [`packages/modules/person-employment/src/personnel-event-resolve.ts`:57-68] — deferred, pre-existing (fix local historical-headcount copy in patch; shared helper is wider surface)
- [x] [Review][Defer] When `teamId` scoped, `orgUnitCounts` remain org-wide [`packages/modules/person-employment/src/historical-org-headcount.ts`:361-362] — deferred, pre-existing (foreshadow only surfaces TEAM count; product polish)
