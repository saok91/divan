---
baseline_commit: c1d52a7
---

# Story 4.14: Reservation Expiry Exceptions & Headcount Override

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want reservation expiry handling and explicit Overrides,
So that shortages are visible and governed rather than hidden (FR30, FR32).

## Gate (read first)

**This story ships FR-30 remainder + FR-32: durable reserve for Scheduled Start (parity with Transfer), 14-day Approval-expiry warning, Scheduled-exception with no partial apply, Override catalogue (shortage / validity / title / seniority) with mandatory context and negative free, distinct filterable Override rows, and Cancel/superseding-Correction release/replace of Reservation. It does not invent formal AR-HEADCOUNT escalation owners, orphan-claim disposition policy beyond Override-governed resolution paths already frozen in SPEC, Secondary consumption, or Epic 5 dashboard/report catalogue.**

| Allowed in 4.14 | Forbidden in 4.14 |
| --- | --- |
| Durable `reserveHeadcountCapacity` for **Scheduled StartEmployment** (FR-30 remainder) | Using exemption to mean “allow over capacity” |
| 14-day horizon warning when linked Approval validity end approaches (N=14 default; constant, retunable) | Inventing escalation owners / formal AR versioning |
| Scheduled-exception product state when Approval expired/incompatible before effect — no partial Employment/Assignment/capacity apply | Silent apply-at-effect when Approval no longer valid |
| Override catalogue: shortage, validity, title, seniority — mandatory reason + context | Flooring `free` at 0 / `GREATEST(free,0)` to hide overbook |
| Drop/relax `CHECK (free_units >= 0)` so Override consume may drive free negative | Matching on Grade / Ladder / compensation |
| Distinct filterable Override rows + panel `overridden` real (not muted foreshadow) | Inventing Position / named-seat model |
| Wire finalize Override path for `HEADCOUNT_UNAPPROVED` (and related) with permission + audit | Client-trusted override flags without server verify |
| Cancel / superseding Correction → release/replace Reservation (Start + Transfer + Job-level Scheduled reserves) | Weakening FR-16 (Scheduled ≠ current membership) |
| Permissions `headcount.override.*` + audit category `organization.headcount_override` | Import cycle `headcount → person-employment` |
| Selfchecks + seed DoD | UTF-8 BOM on `sprint-status.yaml`; Vitest mandate without ephemeral DB |

### Mandated design — Durable Start reservation (FR-30 remainder)

Today Transfer reserves at Scheduled finalize; Start only evaluates and consumes at Effective. **4.14 closes the gap:**

```text
StartEmployment finalize with future effectiveDate (status → Scheduled):
  1. Approval-first match (4.13) OR covering exemption OR Override path
  2. If consuming (not exempt): reserveHeadcountCapacity on matched Approval's linked slot
     (same ledger as Transfer — headcount_capacity_reservation UNIQUE(event_id))
  3. Stash headcountApprovalId + capacitySlotId on event payload
  4. On Effective apply: convert reservation → consumption (reuse Transfer convert path pattern)
  5. On Cancel / superseding Correction: releaseHeadcountReservation (idempotent)

ReturnFromAbsence: keep Effective-only consume unless product explicitly requires reserve
  (Return is not FR-30 "future start or inbound transfer" — do not invent Return reserve)
```

**Concurrency (NFR4):** `SELECT … FOR UPDATE` on slot; `UPDATE … WHERE free_units > 0` for normal reserve; Override path uses explicit override-aware mutate (see below).

### Mandated design — 14-day expiry warning

```text
Constant: HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS = 14  // AR-HEADCOUNT may retune N

When: Scheduled event with active Reservation linked to Approval A
Evaluation: approval.validity_end_exclusive - today (Tehran date-only) <= 14 days
            AND approval still consumable today (not already expired)
Then: ConflictFinding severity "warning", code e.g. HEADCOUNT_APPROVAL_EXPIRY_SOON
      requiresAck: true (Operator/Admin must acknowledge before finalize of related ops
      OR surface on event detail / capacity panel for already-Scheduled events)
UI: Persian messageFa; show on event form + optionally headcount admin list of at-risk reservations
```

Do **not** invent escalation routing to named owners — warn + visible state only.

### Mandated design — Scheduled-exception (no partial apply)

```text
Trigger (before effect / at effect-attempt):
  - Linked Approval status no longer consumable at evaluationDate
    (expired / cancelled / soft-expired / validity no longer contains date)
  - OR match dims became incompatible (JobTitle/Seniority/Team change on draft path,
    or Approval identity dims no longer match Assignment successor)
  - OR linked slot/Approval orphaned in a way that blocks convert

Behavior:
  - Event remains Scheduled (FR-16) with visible exception marker
  - DO NOT open Employment/Assignment
  - DO NOT convert reservation → consumption
  - DO NOT silently release reservation without audited resolution
  - Effect/apply path fails closed with typed code + Persian message
  - Resolution paths (audited):
      a) Admin Override (record Override row + allow proceed under FR-32 rules)
      b) Cancel → release Reservation
      c) Superseding Correction → release/replace Reservation per Correction replay
      d) Rebind to another compatible Approval (audited reselection) when still pre-effect
         — reuse 4.13 preferredApprovalId / match APIs; do not invent free-form orphan UI

Persist exception visibility:
  Prefer draft/event payload flag + queryable field, e.g.:
    headcountException: { code, detectedAt, approvalId?, messageFa }
  AND/OR statusBadge "exception" on Scheduled list (UX-DR10)
  Panel/list must make exception obvious — not buried in logs only
```

**Product freeze (SPEC L95):** “stays Scheduled in a visible exception and applies no partial Employment, Assignment, or capacity change until authorized audited resolution.”

### Mandated design — Override catalogue (FR-32)

**Exemption ≠ Override.** Exemption (4.13) = coverage without consume. Override = explicit rule violation with audit; free may go negative.

```text
headcount_override (NEW, raw SQL — pattern twin of headcount_exemption):
  id UUID PK
  violated_rule TEXT NOT NULL
    -- enum: shortage | validity | job_title | seniority
  reason TEXT NOT NULL                    -- mandatory ops/Persian reason
  actor_account_id TEXT NOT NULL          -- InternalAccount cuid
  related_event_id UUID NULL              -- Personnel Event / draft linkage
  related_assignment_id TEXT NULL         -- PrimaryAssignment.id when known
  team_id TEXT NOT NULL
  job_title_id TEXT NOT NULL
  seniority_id TEXT NULL
  approval_id UUID NULL                   -- when overriding Approval gate
  slot_id UUID NULL
  capacity_snapshot JSONB NOT NULL        -- { used, reserved, freeBefore, freeAfter, ... }
  status TEXT NOT NULL                    -- active | superseded | voided
  created_at / updated_at / provenance
```

**Rules:**

| Rule | Behavior |
| --- | --- |
| Permission | Only actor with `headcount.override.write` (seed `hr.admin`); read via `headcount.override.read` |
| Shortage | When no free unit / incompatible match would block → Admin may Override → consume/reserve **even if free goes negative** |
| Validity | Override Approval validity / soft-expire gate for this claim only — record violated_rule=`validity` |
| Job Title / Seniority | Override match-dimension mismatch — record violated_rule accordingly; still stash attributable link |
| Mandatory context | `reason` non-empty; capture violated rule + Team + title + capacity snapshot + related event/Assignment |
| Negative free | Drop `CHECK (free_units >= 0)` (named constraint drop IF EXISTS); **never** `GREATEST(free,0)` on Override path; panel shows negative free |
| Distinct rows | Overrides list/filter on `/headcount`; panel `overridden` count from active Override rows (not muted placeholder) |
| Audit envelope | Category `organization.headcount_override`; access event on finalize with actor/time/reason/codes |
| Operator | Still blocked without Override permission — `requiresOverride: true` on shortage/incompatibility findings |
| Finalize wire | Update `capacityResultToConflict` so `incompatible` → warning+`requiresOverride` (Admin) / blocking (Operator); extend finalize audit beyond legacy `HEADCOUNT_CAPACITY_MISSING` to include `HEADCOUNT_UNAPPROVED` Override codes |
| Orphan claims | Cancel/expire/reduce Approval with active claims stays fail-closed (`ORPHAN_CLAIMS`) unless resolution uses documented Override/Cancel/Correction paths — **do not invent** full AR disposition matrix |

### Mandated design — Slot ledger / negative free

```text
SQL 012 (or next free):
  ALTER TABLE headcount_capacity_slot
    DROP CONSTRAINT IF EXISTS headcount_capacity_slot_free_units_check;
  -- Also drop any auto-named CHECK on free_units >= 0 from CREATE TABLE
  -- Document: free_units MAY be negative when Override-backed consume/reserve occurred

Normal path (no Override):
  Keep WHERE free_units > 0 on reserve/consume — Operators cannot overbook

Override path:
  New APIs e.g. consumeHeadcountCapacityWithOverride / reserve…WithOverride
  Decrement free without free>0 guard; write headcount_override row in same txn (AD-6)
  reserved_units CHECK (>=0) stays — do not invent negative reserved
```

Historical reconstruction (4.11): conservation must **surface** over-capacity / Override — never silently floor. Extend quantities or notes so as-of views can show overridden/negative free when present.

### Mandated design — CapacityCheckResult + conflicts

```text
CapacityCheckResult — keep compatible | exempt | incompatible | unavailable
Optional extension when Override will be used at finalize:
  (no silent auto-override in evaluate)

capacityResultToConflict (UPDATE from 4.13 blocking-only):
  incompatible → {
    code: "HEADCOUNT_UNAPPROVED",
    severity: "warning",           // was blocking for everyone
    requiresOverride: true,        // Admin path
    messageFa: …
  }
  // Classifier / finalize still BLOCKS Operator (no override permission)
  // via existing codesRequiringOverride + actorMayOverride gate

unavailable → still blocking HEADCOUNT_PORT_UNAVAILABLE (no Override bypass for port down)

New warning:
  HEADCOUNT_APPROVAL_EXPIRY_SOON → requiresAck (14-day horizon)
```

Selfcheck today asserts Admin Override on shortage **stays rejected** until 4.14 — **invert that oracle** in this story.

### Mandated design — Cancel / Correction Reservation release

| Path | Today | 4.14 |
| --- | --- | --- |
| Transfer Cancel | `releaseTransferReservationOnCancel` via projection hook | Keep; regression green |
| Start Cancel | No durable reserve | After Start reserve lands: release on Cancel (wire lifecycle/hook like Transfer) |
| JobTitle/Seniority Scheduled reserve | Existing reserve paths | Ensure Cancel/Correction release/replace |
| Superseding Correction | Capacity replay exists | Must release/replace Reservation; no orphan reserved unit |

### Mandated design — UI / API (UX-DR10 / UX-DR13 / UX-DR14)

| Layer | Delivery |
| --- | --- |
| `@divan/headcount` | Override CRUD + list/filter; expiry-horizon helper; override-aware consume/reserve; export from `index.ts` |
| tRPC | Extend `apps/web/src/server/headcount.ts`: override **list/get/void** (create is finalize/event-only — Override rows are written with capacity mutate); map domain errors → `TRPCError` + `messageFa` |
| Event forms | Override reason via sensitive confirmation (UX-DR14); show 14-day warning; exception badge on Scheduled |
| Panel UX-DR13 | Real **overridden** count; allow **negative free** display (primary color only when free > 0; negative uses destructive/warning token) |
| `/headcount` | Admin Override catalogue panel — keep Approval + Exemption panels |
| Status badge | Override + exception variants (UX-DR10) |
| Audit | `organization.headcount_override` category + finalize access events |
| a11y DoD | Labelled controls, keyboard operable, `role="alert"` / live errors, focus move into confirmation dialog |

### Mandated design — AR-HEADCOUNT fail-closed

Product partial freeze (SPEC CAP-7 / PRD 2026-07-16): immediate Reservation, oldest-match, **14-day warning → Scheduled exception**, **Override negative free + distinct rows** — **implement that**.

Do **not** invent: formal AR version string, escalation owner directory, named Position seats, Secondary consumption, dashboard Override aging metrics (SM-5 → Epic 5/reporting).

[Source: `epics.md` Story 4.14; `prd.md` FR-30, FR-32; `SPEC.md` L95; Stories 4.12–4.13, 4.5, 4.7]

## Acceptance Criteria

1. **Given** a Scheduled start/transfer with Reservation  
   **When** linked approval approaches expiry  
   **Then** a warning appears at the 14-day horizon (AR-HEADCOUNT may retune N)

2. **When** approval expiry or incompatibility occurs before effect  
   **Then** the event remains Scheduled in a visible exception state with no partial Employment/Assignment/capacity apply until audited resolution

3. **When** Admin Override is used for shortage/validity/title/seniority rules  
   **Then** mandatory context is captured; free capacity may go negative; Overrides appear as distinct filterable rows and never floor free at zero

4. **And** audit retains actor, time, reason, violated rule, related event/Assignment, Team, title, and capacity state

5. **And** Cancel or superseding Correction releases/replaces Reservation

6. **And** Finalizing a future **StartEmployment** immediately reserves one compatible destination unit (FR-30 parity with Transfer); Stories 4.1–4.13 invariants remain green; this story does **not** deliver Epic 5 dashboard/report catalogue or invent AR-HEADCOUNT escalation owners

## Tasks / Subtasks

- [x] Task 1: Durable Start reservation + Cancel/Correction release (AC: #5, #6)
  - [x] On Scheduled Start finalize: `reserveHeadcountCapacity` after Approval match (skip when exempt)
  - [x] On Effective: convert reservation → consume (reuse Transfer pattern)
  - [x] Wire Cancel / superseding Correction → `releaseHeadcountReservation` for Start (and verify Transfer/Job-level)
  - [x] Keep Return Effective-only consume (no invented Return reserve)

- [x] Task 2: 14-day expiry warning (AC: #1)
  - [x] Constant N=14 (Tehran date-only vs Approval `validity_end_exclusive`)
  - [x] Emit `HEADCOUNT_APPROVAL_EXPIRY_SOON` warning + `requiresAck` for at-risk Scheduled reservations
  - [x] Surface Persian warning on event UI / capacity context

- [x] Task 3: Scheduled-exception state (AC: #2)
  - [x] Detect Approval expiry/incompatibility before/at effect
  - [x] Persist visible exception marker; block partial apply
  - [x] Resolution only via Override / Cancel / Correction / audited rebind
  - [x] Effect path fail-closed with typed code + `messageFa`

- [x] Task 4: Override domain + negative free (AC: #3, #4)
  - [x] SQL `012_headcount_override.sql` + drop `free_units >= 0` check; `ensureHeadcountOverrideSchema`
  - [x] `headcount-override.ts`: CRUD, list/filter, permission asserts, audit category
  - [x] Override-aware consume/reserve APIs; write Override row + capacity snapshot in same txn
  - [x] Historical path: never silent floor; surface negative/overridden when present

- [x] Task 5: Conflict + finalize wiring (AC: #3, #4)
  - [x] Update `capacityResultToConflict` → `requiresOverride` for incompatible shortage
  - [x] Finalize: Admin + reason + ack; audit `personnel_event.headcount_capacity_override` for `HEADCOUNT_UNAPPROVED` (not only legacy `HEADCOUNT_CAPACITY_MISSING`)
  - [x] Invert start-return selfcheck oracle (Admin Override may proceed)
  - [x] Seed `headcount.override.read/write` for `hr.admin`

- [x] Task 6: tRPC + UI (AC: #1–#4)
  - [x] Override admin panel on `/headcount`; filterable rows
  - [x] Event form: UX-DR14 confirmation + reason; exception badge; 14-day warning
  - [x] `HeadcountCapacityPanel`: real overridden + negative free display
  - [x] Interactive a11y DoD

- [x] Task 7: Selfchecks + DoD (AC: #1–#6)
  - [x] New `headcount-override.selfcheck.ts` and/or reservation-expiry selfcheck with oracles:
    - Scheduled Start creates reservation row; Cancel releases
    - 14-day horizon warning fires; >14 days silent
    - Expired Approval before effect → Scheduled-exception; no Employment/Assignment/convert
    - Admin Override shortage → free negative; Override row filterable; Operator still blocked
    - Validity/title/seniority Override records correct `violated_rule`
    - Audit fields present (actor, time, reason, rule, Team, title, capacity snapshot)
    - Correction/Cancel release/replace reservation
  - [x] Regression: matching, approval, exemption, start-return, transfer, job-level, historical-org-headcount — green
  - [x] Typecheck `@divan/headcount`, `@divan/person-employment`, `web`
  - [x] Update `deferred-work.md`; align story Status ↔ `sprint-status.yaml`; **no UTF-8 BOM**

### Review Findings

- [x] [Review][Decision] voidOverride ledger semantics — **resolved (C):** reject void while linked consumption/reservation is active; do not invent silent ledger reverse. → patch below.
- [x] [Review][Decision] Override catalogue create surface — **resolved (B):** finalize/event path is the only create surface; update mandated UI/API delivery note (no standalone tRPC create).

- [x] [Review][Patch] Persist visible Scheduled-exception marker + UX badge; do not only throw at apply [`personnel-event-start-return.ts:289`] [`personnel-event-conflicts.ts:1403`] [`status-badge.tsx`]
- [x] [Review][Patch] Do not skip exception gate on incomplete Override flags; never fall through to normal convert/consume without Override row [`personnel-event-start-return.ts:290`] [`personnel-event-start-return.ts:429`]
- [x] [Review][Patch] After Override convert of existing reservation, still write Override catalogue row (or consumeWithOverride path) [`personnel-event-start-return.ts:359`]
- [x] [Review][Patch] Superseding Correction must release Start/Transfer/Job-level reservations (hook currently Cancel-only) [`personnel-event-projection-hook.ts:147`] [`personnel-event-lifecycle.ts:577`]
- [x] [Review][Patch] Infer `violated_rule` for validity/seniority/title; pass `skipConsumableGate` for validity Overrides [`personnel-event-finalize.ts:1070`]
- [x] [Review][Patch] Wire Transfer/Job-level Scheduled-exception detect + Override-aware reserve/consume/convert [`personnel-event-transfer.ts`] [`personnel-event-job-level.ts`]
- [x] [Review][Patch] Surface 14-day expiry warning for already-Scheduled reserved events (not only draft classify) [`personnel-event-conflicts.ts:1374`] [`headcount-reservation-expiry.ts`]
- [x] [Review][Patch] Reject client-trusted `headcountOverride*` / `headcountException` payload without server re-verify (permission + re-detect) [`personnel-event-start-return.ts:165`] [`personnel-event-conflicts.ts:1404`]
- [x] [Review][Patch] Detect Scheduled-exception before durable Start reserve (do not reserve against already-expired/incompatible Approval) [`personnel-event-start-return.ts:451`]
- [x] [Review][Patch] Add selfcheck oracles for Correction release, apply-time exception with zero partial apply, and correct `violated_rule` attribution via finalize path [`headcount-override.selfcheck.ts`] [`personnel-event-start-return.selfcheck.ts`]
- [x] [Review][Patch] Reject `voidOverride` while linked consumption/reservation claim is active [`headcount-override.ts:486`]
- [x] [Review][Patch] Update story UI/API note: Override create is finalize/event-only; tRPC exposes list/get/void [`4-14-…md` Mandated UI/API]

- [x] [Review][Defer] Unscoped `listOverrides` / `getOverride` IDOR class — deferred, pre-existing
- [x] [Review][Defer] `ensureHeadcountOverrideSchema` DDL on every tRPC request — deferred, pre-existing

## Dev Notes

### Current code state (READ BEFORE CODING)

| Area | Path | Today | 4.14 change |
| --- | --- | --- | --- |
| Evaluate / ledger | `packages/modules/headcount/src/index.ts` | Approval-first + exempt; `CHECK (free_units >= 0)`; reserve/consume require `free > 0` | Drop free≥0 check; Override mutate path; panel overridden |
| Matching | `headcount-matching.ts` | FR-29 oldest Approval | Reuse; exception/incompatibility detection |
| Exemption | `headcount-exemption.ts` | Coverage without consume | **Do not overload** for shortage |
| Approval | `headcount-approval.ts` | Lifecycle + soft-expire; orphan reject | Expiry horizon helper input; keep orphan fail-closed |
| Historical | `historical-headcount.ts` | Conservation; comment “never silently floor” | Surface Override/negative |
| Conflicts | `personnel-event-conflicts.ts` | Stash Approval/exemption | Expiry warning + exception findings |
| `capacityResultToConflict` | `personnel-event-start-return.ts` | incompatible → blocking, no `requiresOverride` | **UPDATE** → overrideable warning |
| Finalize | `personnel-event-finalize.ts` | Override skeleton for `HEADCOUNT_CAPACITY_MISSING` / baseline | Wire `HEADCOUNT_UNAPPROVED` + Override catalogue id |
| Start/Return | `personnel-event-start-return.ts` | Effective consume only | **ADD** Scheduled Start reserve + convert |
| Transfer | `personnel-event-transfer.ts` | Reserve/convert/Cancel release | Keep; regression; Correction parity |
| Lifecycle / hook | `personnel-event-lifecycle.ts`, `personnel-event-projection-hook.ts` | Transfer Cancel release | Start Cancel release |
| Panel | `headcount-capacity-panel.tsx` | exempt + muted overridden foreshadow | Real overridden + negative free |
| Headcount UI | `approval-panel.tsx`, `exemption-panel.tsx` | Admin surfaces | **ADD** override-panel |
| Seed / audit | `seed.ts`, `categories.ts` | approval + exemption perms/categories | override perms + category |
| Selfcheck | `personnel-event-start-return.selfcheck.ts` | Asserts Admin Override still blocked | Invert for 4.14 |

### What this story changes vs preserves

**Changes:** Start durable reserve; 14-day warning; Scheduled-exception visibility; Override entity + negative free; conflict/finalize Override wire; panel overridden; Cancel/Correction reservation completeness.

**Preserves:** AD-2 / AD-3 / AD-6; FR-16 Scheduled≠current membership; Approval lifecycle (4.12); Approval-first matching + exemptions (4.13); Transfer reserve-at-finalize; Secondary non-consumption; append-only event-store; Persian `messageFa` at API boundary; no UTF-8 BOM; Status ↔ sprint-status alignment.

### Architecture compliance

- **AD-2:** Capacity remains projection/ledger derived from events; Override does not rewrite history — it records an attributable exception and mutates ledger under audit
- **AD-3:** All Override/expiry/reservation math in `@divan/headcount`; person-employment only calls public APIs
- **AD-6:** Override consume/reserve + Override row + event append in **same transaction**; critical finalize paths stay sync
- **Stack:** raw SQL for override (+ constraint drop); Prisma only if event/draft exception field needs it (prefer payload JSON first); tRPC web only; `tsx` selfchecks

### AR / fail-closed (do not invent)

| Artifact | Rule for 4.14 |
| --- | --- |
| AR-HEADCOUNT | Ship freeze: 14-day warn, Scheduled-exception, Override negative free + distinct rows; **do not invent** escalation owners / formal AR version / full orphan disposition matrix |
| AR-TEMPORAL | Date-only Tehran; half-open validity; Scheduled ≠ membership |
| AR-ACCESS / FR-47 | Coarse `headcount.override.*`; no toxic matrix; high-impact Override may later need independent pre-auth — MVP = permission + mandatory reason + audit |
| AR-DATA | New envelope category for override; no new sensitive PII categories |
| AR-SECONDARY | Secondary still non-consuming |
| AR-IDENTITY | No PopulationPort cutover |
| AR-REPORTING | Panel + admin list only; no launch report catalogue (5.5) |

### Previous story intelligence (4.13)

- Approval-first fail-closed — after match miss do **not** fall through to Grade/Ladder legacy as product path
- Exemption ≠ Override — shortage must not use exemption
- Reselect: permission + audit on finalize; never trust client-only flags
- Revoke/uncover: server-verify rebind — same spirit for Override context
- Transfer never inherits source exemption; destination always needs Approval (or Override/exemption on dest)
- Pattern: domain module + `ensure*Schema` + `tsx` selfcheck + thin tRPC + `/headcount` admin panel
- Review deferrals to avoid repeating unless blocking: IDOR list/get, ensure-* DDL every request
- Never UTF-8 BOM on `sprint-status.yaml`
- Seed DoD: FK-shaped fixtures; exact cardinalities; `$transaction` for fixture writes

### Git intelligence

```text
c1d52a7 story 4.13  ← matching + exemption + Primary Approval FK — Override builds on this
37518e2 story 4.12  ← Approval lifecycle + orphan reject + soft bridge
5b839a5 story 4.11  ← historical quantities (must not silent-floor Override)
ea232af story 4.10
7bb4f50 story 4.9
```

Pattern: one story commit with artifact + domain + tRPC/UI + selfcheck + deferred/sprint; review patches follow in-story.

### Latest tech notes

- Dropping PostgreSQL `CHECK (free_units >= 0)` is the correct way to allow Override-driven negative free; use `DROP CONSTRAINT IF EXISTS` (idempotent). Keep application-level `free > 0` guard on **non-Override** paths.
- Do **not** use `GREATEST(free_units - 1, 0)` on Override consume — that floors and violates FR-32.
- Industry HRIS separates policy exemption (no seat consumed) from managerial override (explicit over-capacity) — Divan mirrors this as Exemption (FR-29) vs Override (FR-32).
- Reservation ledger already has `UNIQUE(event_id)` — Start reserve must reuse it (one reservation per event).

### Project structure notes

```text
packages/db/sql/
  012_headcount_override.sql              # NEW — override table + drop free>=0 check
packages/modules/headcount/src/
  index.ts                                # UPDATE — override consume/reserve; panel overridden
  headcount-override.ts                   # NEW
  headcount-reservation-expiry.ts         # NEW (optional split) — 14-day + exception helpers
  headcount-override.selfcheck.ts         # NEW
  historical-headcount.ts                 # UPDATE — surface negative/override
  package.json                            # UPDATE — selfcheck script
packages/modules/person-employment/src/
  personnel-event-start-return.ts         # UPDATE — reserve/convert + capacityResultToConflict
  personnel-event-conflicts.ts            # UPDATE — expiry warning + exception
  personnel-event-finalize.ts             # UPDATE — Override wire for HEADCOUNT_UNAPPROVED
  personnel-event-transfer.ts             # VERIFY Cancel/Correction release
  personnel-event-job-level.ts            # VERIFY Scheduled reserve release
  personnel-event-lifecycle.ts            # UPDATE — Start Cancel release if needed
  personnel-event-projection-hook.ts      # UPDATE — Start Cancel release hook
  personnel-event-start-return.selfcheck.ts  # UPDATE — invert Override oracle
  seed.ts                                 # UPDATE — override permissions
packages/kernel/audit-envelope/src/
  categories.ts / index.ts                # UPDATE — organization.headcount_override
apps/web/src/server/
  headcount.ts                            # UPDATE — override procedures
apps/web/components/personnel/
  headcount-capacity-panel.tsx            # UPDATE — real overridden + negative free
  personnel-event-form.tsx                # UPDATE — warning, exception, Override dialog
apps/web/components/headcount/
  override-panel.tsx                      # NEW
apps/web/app/(app)/headcount/page.tsx     # UPDATE — mount override panel
_bmad-output/implementation-artifacts/
  deferred-work.md                        # UPDATE
  sprint-status.yaml                      # UPDATE — ready-for-dev → (dev moves further)
```

### Testing requirements

- Pattern: `tsx` + `node:assert` + real `DATABASE_URL` (Vitest still open action item — do not mandate here).
- Seed DoD: Team + JobTitle + Seniority FK shape; Approval near expiry; Approval already expired; zero-free slot for Override oracle; Scheduled Start + Transfer fixtures; `$transaction`; exact cardinalities (reservation count, free before/after including negative).
- Regression green: 4.5 start-return, 4.7 transfer, 4.8 job-level, 4.12 approval, 4.13 matching/exemption, 4.11 historical-org-headcount.

### Absolute non-goals

- Inventing AR-HEADCOUNT escalation owners / formal AR version sign-off
- Full orphan-claim disposition matrix beyond Override/Cancel/Correction freeze
- Using exemption as overbook backdoor
- Secondary consumption; Grade/Ladder/compensation match; Position/named seats
- ReturnFromAbsence durable reserve (not in FR-30 wording)
- Epic 5 dashboard / open-headcount product / report catalogue / SM-5 Override aging metrics UI
- PopulationPort cutover; import cycle headcount → person-employment
- Weakening FR-16 / append-only / Secondary non-consumption
- UTF-8 BOM on `sprint-status.yaml`
- Flooring free at zero anywhere on Override or historical paths

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.14]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-30, FR-32, §8.7; AR-HEADCOUNT freeze]
- [Source: `_bmad-output/specs/spec-divan/SPEC.md` — L95 Reservation/Override freeze]
- [Source: `_bmad-output/specs/spec-divan/launch-artifacts.md` — AR-HEADCOUNT partial freeze]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-6, headcount module]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — headcount-capacity-panel; Override confirmation]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — UX-DR10/13/14]
- [Source: `_bmad-output/implementation-artifacts/4-13-universal-coverage-matching-exemptions.md`]
- [Source: `_bmad-output/implementation-artifacts/4-12-headcount-approval-lifecycle.md`]
- [Source: `_bmad-output/implementation-artifacts/4-7-team-transfer-with-atomic-capacity-movement.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/modules/headcount/src/index.ts`]
- [Source: `packages/modules/person-employment/src/personnel-event-start-return.ts` — `capacityResultToConflict`]
- [Source: `packages/modules/person-employment/src/personnel-event-finalize.ts` — override audit skeleton]
- [Source: `packages/db/sql/008_headcount_reservation.sql`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Fixed `isPool` discriminator in approval/exemption/override — PoolClient also exposes `connect`, which aborted Job-level exemption rebind inside finalize txn.

### Completion Notes List

- Durable Scheduled Start reserve + convert on Effective; Cancel releases via projection hook; Return stays Effective-only consume.
- Override catalogue (`012_headcount_override.sql`, domain module, negative free, panel overridden); finalize resolves slot + writes Override on `HEADCOUNT_UNAPPROVED`.
- 14-day `HEADCOUNT_APPROVAL_EXPIRY_SOON` (`requiresAck`); Scheduled-exception detect fail-closed before Employment/Assignment apply.
- `capacityResultToConflict` → warning + `requiresOverride`; Operator blocked; Admin + `headcount.override.write` + reason proceeds.
- Selfchecks green: headcount-override, start-return (inverted Override oracle), matching, approval, transfer, job-level, historical-org-headcount; typecheck headcount / person-employment / web.

### File List

- packages/db/sql/012_headcount_override.sql
- packages/modules/headcount/src/headcount-override.ts
- packages/modules/headcount/src/headcount-reservation-expiry.ts
- packages/modules/headcount/src/headcount-override.selfcheck.ts
- packages/modules/headcount/src/headcount-matching.ts
- packages/modules/headcount/src/headcount-approval.ts
- packages/modules/headcount/src/headcount-exemption.ts
- packages/modules/headcount/src/historical-headcount.ts
- packages/modules/headcount/src/index.ts
- packages/modules/headcount/package.json
- packages/modules/person-employment/src/personnel-event-start-return.ts
- packages/modules/person-employment/src/personnel-event-projection-hook.ts
- packages/modules/person-employment/src/personnel-event-finalize.ts
- packages/modules/person-employment/src/personnel-event-conflicts.ts
- packages/modules/person-employment/src/personnel-event-start-return.selfcheck.ts
- packages/modules/person-employment/src/seed.ts
- packages/modules/person-employment/src/index.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/src/index.ts
- apps/web/src/server/headcount.ts
- apps/web/components/headcount/override-panel.tsx
- apps/web/components/personnel/headcount-capacity-panel.tsx
- apps/web/components/personnel/personnel-event-form.tsx
- apps/web/app/(app)/headcount/page.tsx
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-14-reservation-expiry-exceptions-headcount-override.md

## Change Log

- 2026-07-19: Story context created (ready-for-dev) — ultimate context engine analysis completed
- 2026-07-19: Implemented FR-30 Start reserve + FR-32 Override catalogue, expiry warning, Scheduled-exception; status → review
- 2026-07-19: Code review patches applied (exception persist, Correction release, Transfer/Job Override, void reject, violated_rule inference); status → done

## Story completion status

Status: **done**

Completion note: Code review findings patched; typecheck green (`@divan/headcount`, `@divan/person-employment`, `web`); Override create remains finalize/event-only; void rejects linked claims.
