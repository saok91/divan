---
baseline_commit: 752d64f15143f59eaab4a3c66154da9599521434
---

# Story 4.5: Start & Return Events

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Operator,
I want effective-dated start and return events,
So that Employment begin correctly creates Employment + Primary Assignment against headcount (FR20).

## Gate (read first)

**This story ships the first domain Personnel Event Operators — Start (`EmploymentStarted`) and Return (`EmploymentReturned`) — wiring real Employment + Primary Assignment projectors into the existing AD-6 finalize/recalc hook. It does not ship Termination, Transfer, job/comp changes, reconstruction UIs, or full Headcount Approval / Matching / Reservation product.**

| Allowed in 4.5 | Forbidden in 4.5 |
| --- | --- |
| Product event types `EmploymentStarted` and `EmploymentReturned` (PascalCase past-tense); keep `ScaffoldChangeRecorded` for substrate selfchecks | Claiming Termination / Transfer / job-level / contract-comp done (→ 4.6–4.8) |
| Wire `defaultProjectionRefreshHook` to call `applyEmploymentProjection` + `applyPrimaryAssignmentProjection` inside the finalize/lifecycle/recalc txn when `applyToCurrentProjection === true` | Any product CRUD API that creates active Employment / Primary outside Draft→Finalize→append |
| Conflict gates: overlap, minimum facts, inactive refs as-of Effective Date (AR-TEMPORAL), Return rematch fail-closed, capacity / Admin Override | Inventing AR-DATA rehire-token schema or silently restoring anonymized identity via `matchReturn` |
| Narrow headcount **capacity port**: Operator blocked without compatible capacity; HR Admin Override + Persian evidence/ack may proceed; consume/link on Effective apply | Full Headcount Approval lifecycle, Matching matrix, Reservation expiry exceptions, Override catalogue UI (→ 4.12–4.14 / AR-HEADCOUNT) |
| Return: same Person + Personnel Code; **new** Employment + Primary; prior history untouched | Closing prior Employment as part of Return (that is Termination / separate path); deleting Person |
| Scheduled Start/Return: `applyToCurrentProjection: false` — no current Employment/Primary mutation; past-dated Effective uses 4.4 recalc enqueue | Weakening FR-16 Scheduled discipline; sync-only deep rebuild that skips pending UI |
| Extend `IRRECONCILABLE_ORDERING` / Primary-overlap findings where Start/Return make collisions detectable | Inventing full AR-TEMPORAL scenario/oracle matrix; PopulationPort cutover; Vitest mandate without ephemeral DB |
| Selfcheck(s) proving FR-20 oracles + 4.1–4.4 regressions green | UTF-8 BOM on `sprint-status.yaml`; inventing open AR numbers |

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
        ├─ EmploymentStarted / EmploymentReturned + applyToCurrentProjection
        │     → applyEmploymentProjection (open Employment)
        │     → applyPrimaryAssignmentProjection (sourceEventId = event id)
        │     → capacity port consume/link (narrow; not full headcount product)
        │
        └─ Scheduled / applyToCurrentProjection=false → record invoked only (FR-16)
```

- **Do not** call projectors from Draft save.
- **Do not** add public `startEmployment` / `returnEmployment` product verbs on `person.ts` / `employment.ts`.
- Bind `employmentId` on the authoritative event / Draft after projection create when the store supports it (Start may begin with null employment ref — see 4.1 notes).

### Mandated design — event type names

| Operator | `eventType` string | Notes |
| --- | --- | --- |
| Start | `EmploymentStarted` | Already foreshadowed in `HEADCOUNT_CONSUMING_EVENT_TYPES` + overlap conflict |
| Return | `EmploymentReturned` | New; same PascalCase past-tense family — **do not** invent alternate spellings mid-story |
| Scaffold | `ScaffoldChangeRecorded` | Keep for substrate tests; must not create Employment |

### Mandated design — Return vs Start

| | Start | Return |
| --- | --- | --- |
| Person | Existing stable Person | **Same** Person + Personnel Code |
| Employment | Create **new** open Employment | Create **new** open Employment (prior Employments preserved) |
| Primary | Create one Primary on that Employment | Create one Primary on the **new** Employment |
| Active-as-of gate | Block if another Employment already active as-of Effective Date | Same overlap gate — prior Employment must already be closed (via prior Termination / history); Return does not close |
| Anonymized Person | N/A (normal Start) | Rematch only via AR-DATA rehire token **or** verified manual rematch with independent audit evidence — **never** silent restore. Keep `matchReturn` fail-closed (`blockedOp`) unless implementing an audited manual-rematch path that does not restore disposed identity values |

### Mandated design — headcount boundary (narrow port)

Today `HEADCOUNT_CONSUMING_EVENT_TYPES` unconditionally emits blocking `HEADCOUNT_UNAPPROVED` ("capacity check not ready"). **4.5 must replace that stub for Start/Return** with a fail-closed capacity port:

| Outcome | Operator | HR Admin Override path |
| --- | --- | --- |
| Compatible capacity | May finalize | May finalize |
| Incompatible / none | **Block** finalize | Override + mandatory reason/evidence + audit access event (`requiresOverride: true`) |
| Port/module unavailable | Fail closed (block) — do not silent-allow | Same — Override only if product policy explicitly allows "capacity system down" (default: **no**) |

**In scope:** thin interface (prefer `@divan/headcount` export or `person-employment` port file), seed/fixture capacity so selfchecks can prove Operator-with-capacity path, consume/link on Effective apply inside AD-6 txn, Persian `messageFa`.

**Out of scope:** Approval CRUD UI, oldest-compatible Matching oracle, 14-day Reservation expiry, negative free display catalogue, FR-30 full Reservation product claims. If Scheduled future Start needs a durable reservation row to avoid lying about FR-30, add only a **minimal** reservation write behind the same port and document remaining FR-30/4.14 work in `deferred-work.md` — do not ship 4.12–4.14 UX.

### Mandated design — minimum facts at finalize

Enforce `EMPLOYMENT_MINIMUM_FACTS` (required rows) from Draft payload / refs before projection apply:

- Stable Person + Personnel Code
- Employment start date (= Effective Date for open Start/Return)
- Collaboration / approved employment status (lean string; exact codes AR-DATA — do not invent catalogue)
- Team (Primary org) + Organizational Role + Job Title + Ladder + Grade (Seniority optional)
- Exactly one Primary created for the new Employment

Missing required fact → blocking conflict with Persian `messageFa` (new codes OK; do not weaken existing taxonomy).

### Mandated design — AR-TEMPORAL active-as-of (from 4.1 handoff)

If Draft attaches Team / Job Title / Ladder / Grade / Seniority / Organizational Role that is **inactive** as-of Effective Date → **blocking** conflict. Never silent attach. Use `@divan/temporal-engine` date-only helpers; never `toISOString().slice(0,10)` for PG DATE semantics.

[Source: `epics.md` Story 4.5; `prd.md` FR-20, FR-6, FR-11; `ARCHITECTURE-SPINE.md` AD-2/AD-6; Stories 4.1–4.4; `employment-minimum-facts.ts`; Epic 3 retro Transfer/AR-TEMPORAL action items]

## Acceptance Criteria

1. **Given** compatible headcount (or Admin Override path) and Epic 3 Employment/Primary invariants  
   **When** Start or Return is finalized through the Personnel Event flow  
   **Then** one Employment and one Primary Assignment are created against applicable headcount; Operator cannot finalize without capacity

2. **And** Return reuses the same Person and Personnel Code; a new Employment and Primary Assignment are created; prior history is preserved

3. **And** approved minimum Person, Employment, organization, and Primary Assignment facts are required at finalization

4. **And** anonymized-Person return matching uses AR-DATA rehire token or verified manual rematch — never silent restore of disposed identity

5. **And** no CRUD bypass exists outside this event path for creating active Employment

6. **And** Story 4.1–4.4 invariants remain green: append-only store, Draft→Finalize conflicts, Scheduled/Cancel/Reverse/Correction, FR-18 ordering + recalc pending/UX-DR5, AD-6 sync seam; this story does **not** deliver Termination/Transfer/job-comp Operators or reconstruction products

## Tasks / Subtasks

- [x] Task 1: Domain event types + Draft/finalize catalogue (AC: #1, #5, #6)
  - [x] Register `EmploymentStarted` / `EmploymentReturned` as product types (validation, seed demos, form options as needed)
  - [x] Keep `ScaffoldChangeRecorded` working for 4.1–4.4 selfchecks
  - [x] Ensure Draft payload carries Primary refs + collaborationType without sensitive evidence fields (`assertNoSensitiveEvidence`)
  - [x] After Successful Effective apply, bind created `employmentId` onto event/draft linkage if supported

- [x] Task 2: Projection hook — real Start/Return apply (AC: #1, #2, #5, #6)
  - [x] Implement domain branch in `personnel-event-projection-hook.ts` (or dedicated module imported by default hook)
  - [x] Effective Start/Return: `applyEmploymentProjection` then `applyPrimaryAssignmentProjection` with `sourceEventId = ctx.eventId`, open intervals, coverage asserts **after** both writes
  - [x] Honor `applyToCurrentProjection === false` (Scheduled / Cancel-of-Scheduled) — no Employment/Primary mutation
  - [x] Map domain errors to finalize failures with Persian `messageFa`; keep ALS hook scoping (no module-global production hook)
  - [x] Recalc handler path must apply the same projectors when replaying ordered events (4.4 substrate already invokes hook)

- [x] Task 3: Conflicts + minimum facts + AR-TEMPORAL refs (AC: #1, #3, #6)
  - [x] Extend overlap check to `EmploymentReturned` (same as Start)
  - [x] Add minimum-facts blocking findings from required `EMPLOYMENT_MINIMUM_FACTS`
  - [x] Inactive Team/job-ref as-of Effective Date → blocking
  - [x] Primary-overlap / within-Employment coverage: rely on projector EXCLUDE + pre-check where detectable
  - [x] Extend exclusive-key / dependent-ordering stub where Start/Return make collisions detectable — fail closed

- [x] Task 4: Headcount capacity port (narrow) (AC: #1)
  - [x] Replace unconditional Start/Return `HEADCOUNT_UNAPPROVED` stub with capacity evaluation
  - [x] Operator without capacity cannot finalize; Admin Override path sets `requiresOverride` + audit evidence
  - [x] On Effective apply, consume/link via port inside same txn; do not invent Approval UI
  - [x] Seed/fixture path so selfcheck can finalize Start as Operator with capacity
  - [x] Document FR-30 / 4.12–4.14 remainder in `deferred-work.md`

- [x] Task 5: Return rematch policy (AC: #2, #4)
  - [x] Happy-path Return on known Person — no identity mutation; new Employment + Primary
  - [x] Keep `matchReturn` fail-closed for anonymized/automatic rematch until AR-DATA token exists
  - [x] If manual rematch is exposed: require independent evidence + audit; never restore disposed national-id / PII fields
  - [x] Prove prior Employments/events still readable after Return

- [x] Task 6: UI / tRPC wiring (AC: #1, #3)
  - [x] Extend `PersonnelEventForm` / tRPC payloads for Start & Return fields (minimum facts); Save draft ≠ Finalize (UX-DR11)
  - [x] Surface capacity/Override conflicts in Persian; gold CTA stays disabled while recalc pending (UX-DR5)
  - [x] Permissions remain `personnel_event.draft` / `.finalize` (coarse role insufficient)
  - [x] Interactive a11y: focus order, error association, dialog confirm for Override (UX-DR14)

- [x] Task 7: Selfchecks + DoD (AC: #1–#6)
  - [x] New `personnel-event-start-return.selfcheck.ts` (name flexible) with exact cardinality oracles
  - [x] Prove: Start → 1 Employment + 1 Primary with `sourceEventId`; retry finalize idempotent
  - [x] Prove: Scheduled Start does not mutate current Employment/Primary
  - [x] Prove: past-dated Effective Start enqueues recalc / pending blocks gold CTA
  - [x] Prove: overlap / missing facts / no-capacity Operator block; Admin Override path
  - [x] Prove: Return same Person/code; history preserved; anonymized auto-rematch blocked
  - [x] Re-run event-store, draft, lifecycle, ordering, recalc, workers selfchecks — all green
  - [x] Update `deferred-work.md`; align story Status ↔ `sprint-status.yaml`; **no UTF-8 BOM**

### Review Findings

- [x] [Review][Patch] AD-6 Prisma vs PoolClient orphan risk — compensate on consume/post-hook failure (`compensateOrphanStartReturnProjections`); single-connection projector SQL still deferred hardening
- [x] [Review][Patch] Remove UTF-8 BOM from `sprint-status.yaml` [`_bmad-output/implementation-artifacts/sprint-status.yaml:1`]
- [x] [Review][Patch] Reject non-empty `rehireToken` without AR-DATA validation — any string currently bypasses `ANONYMIZED_RETURN_BLOCKED` [`packages/modules/person-employment/src/personnel-event-conflicts.ts:523`]
- [x] [Review][Patch] Manual rematch path must append access-event audit evidence (payload flags alone are insufficient) [`packages/modules/person-employment/src/personnel-event-conflicts.ts:526`]
- [x] [Review][Patch] Selfcheck missing past-dated Effective Start → recalc enqueue / pending gold-CTA proof (Task 7 claimed) [`packages/modules/person-employment/src/personnel-event-start-return.selfcheck.ts`]
- [x] [Review][Patch] Generation TOCTOU in `runHistoricalRecalculation` now harmful — stale job can mutate live Employment after 4.5 projector wiring; re-check generation inside txn before apply [`packages/modules/person-employment/src/personnel-event-recalc.ts:410`]
- [x] [Review][Patch] Same-day Start/Return peer check fails open when conflict reader is null — fail closed like capacity port [`packages/modules/person-employment/src/personnel-event-conflicts.ts:566`]
- [x] [Review][Patch] Start/Return form fields (`collaborationType`, team/job refs) do not call `setDirty` [`apps/web/components/personnel/personnel-event-form.tsx:491`]
- [x] [Review][Patch] When both PRE_BASELINE and HEADCOUNT_CAPACITY_MISSING need override, audit writes a single `operation` (capacity wins) [`packages/modules/person-employment/src/personnel-event-finalize.ts:672`]
- [x] [Review][Patch] Anonymized gate requires both names blank/`[REDACTED]` — partial redaction bypasses fail-closed rematch [`packages/modules/person-employment/src/personnel-event-conflicts.ts:517`]
- [x] [Review][Patch] `EmploymentReturned` with zero prior Employments is allowed — should block as first-hire-via-Return [`packages/modules/person-employment/src/personnel-event-conflicts.ts:516`]
- [x] [Review][Patch] Selfcheck zeros all slots for a team then restores only one `slotId` — other demo slots stay drained [`packages/modules/person-employment/src/personnel-event-start-return.selfcheck.ts:343`]
- [x] [Review][Patch] `HEADCOUNT_PORT_UNAVAILABLE` when reader null uses `MSG_HEADCOUNT_CHECK_BLOCKED_FA` instead of port-unavailable message [`packages/modules/person-employment/src/personnel-event-conflicts.ts:628`]
- [x] [Review][Patch] Malformed non-UUID ref ids in Start/Return payload can throw from Prisma instead of becoming blocking conflicts [`packages/modules/person-employment/src/personnel-event-start-return.ts:330`]
- [x] [Review][Defer] Scheduled Start evaluates capacity but does not durable-reserve — deferred, pre-existing FR-30/4.14 remainder
- [x] [Review][Defer] Duplicate capacity Persian messages between `@divan/headcount` and `person-employment/errors` — deferred, pre-existing drift risk

## Dev Notes

### Current code state (READ BEFORE CODING)

| Area | Path | Today | 4.5 change |
| --- | --- | --- | --- |
| Projection hook | `packages/modules/person-employment/src/personnel-event-projection-hook.ts` | Scaffold no-op; records `ctx.invoked`; respects `applyToCurrentProjection === false` | **Wire** Start/Return projectors |
| Conflicts | `personnel-event-conflicts.ts` | `EmploymentStarted` overlap; unconditional headcount stub for consuming types; exclusive-key ordering stub | Unlock Start/Return capacity; add Return + minimum facts + inactive-ref |
| Finalize / recalc | `personnel-event-finalize.ts`, `personnel-event-recalc.ts` | Full pipeline; hook + past-dated enqueue | Consume new hook behavior; bind employment id if needed |
| Employment projector | `employment.ts` | `applyEmploymentProjection` — **no** `sourceEventId` column on Employment | Call from hook; do not add product CRUD |
| Primary projector | `primary-assignment.ts` | `applyPrimaryAssignmentProjection` + `sourceEventId` + EXCLUDE | Set `sourceEventId` from event id |
| Minimum facts | `employment-minimum-facts.ts` | Catalogue only | **Enforce** at classify/finalize |
| Return rematch | `person.ts` `matchReturn` | `blockedOp` | Keep fail-closed unless audited manual path |
| Headcount pkg | `packages/modules/headcount/src/index.ts` | `export {}` stub | Thin capacity port exports (no full product) |
| Draft / form | `personnel-event-draft.ts`, `apps/web/.../personnel-event-form.tsx` | Scaffold-oriented | Start/Return fields |
| Seed | `seed.ts` | Uses projectors for fixtures | May seed capacity fixture; product Start still via events |

### Architecture compliance

- **AD-2:** SoT = append-only business events; Employment/Primary = projections only.
- **AD-3:** Kernel owns event-store / temporal-engine / audit-envelope — modules do not grow a second log.
- **AD-6:** Critical current refresh in same txn as append; heavy historical via existing `temporal.recalculate` + pending UI.
- **Naming:** PascalCase past-tense event types only.
- **Dates:** Asia/Tehran date-only Effective Date; exclusive interval ends `[start, endExclusive)`; helpers from `@divan/temporal-engine`.
- **Authz:** `governedProcedure` + fine permissions + audit envelope; never trust client Override booleans.
- **Evidence:** no national ID / compensation amounts in draft payload or before/after evidence blobs.

### AR / fail-closed (do not invent)

| Artifact | Rule for 4.5 |
| --- | --- |
| AR-TEMPORAL | Frozen calendar/order rules; inactive ref attach = block; pre-Baseline disposition C unchanged |
| AR-DATA | Rehire token / collaboration code catalogue / concurrent-Employment exceptions — fail closed |
| AR-HEADCOUNT | Full Matching/Reservation/Override catalogue — out of scope; narrow capacity port only |
| AR-SECONDARY | Secondary not created by Start/Return |
| AR-IDENTITY / AR-ACCESS | No group→role invention; sticky break-glass debt remains open (Epic 2) |

### Previous story intelligence (4.1–4.4)

- Substrate complete: Draft→Finalize→append→hook→(enqueue recalc). **4.5 fills domain projectors**, does not reinvent pipeline.
- `applyToCurrentProjection: false` for Scheduled — **do not weaken**.
- ALS projection hook only — never module-global in production.
- Web process must keep `recalc-enqueue.ts` registration; worker reclaim/generation singleton already fixed in 4.4 review.
- Apply-list LIMIT cap refuses clear-as-fresh — preserve when replaying Start/Return in recalc.
- Transfer coverage-after-atomic-close+open → **4.7** (document only).
- PopulationPort cutover criteria in `population-cutover.ts` — **do not cut over**.
- Cancel/Reverse/Correction Employment effects remain limited until domain types exist — Start/Return apply enables future reverse semantics; do not silently invent Terminate-on-Reverse.
- Review lesson: exact cardinality asserts; no BOM on yaml; story Status ↔ sprint-status alignment on done.

### Git intelligence

Recent commits: `752d64f` story 4.4 → `367c3a0` story 4.3 → `15d1bb9` story 4.2 → `43b8ffa` story 4.1 → `3c17d56` epic 3 retro.

Continue: tsx selfchecks, governed tRPC, raw SQL kernel event-store, Prisma projections, Persian `messageFa` at boundaries.

### Latest tech notes

- **Half-open intervals:** Keep `[start, endExclusive)` — PostgreSQL range canonical form and existing EXCLUDE constraints already assume exclusive ends; do not switch to inclusive-end BETWEEN semantics.
- **pg-boss 12.26.x:** Already wired for recalc — reuse; do not add a second queue for Start/Return.
- **Employment.schema:** No `sourceEventId` on Employment — provenance for Start lives on PrimaryAssignment.sourceEventId + `kernel_events.id`; do not drive a speculative Employment column migration unless product explicitly requires it this story.

### Project structure notes

```text
packages/modules/person-employment/src/
  personnel-event-projection-hook.ts   # UPDATE — domain apply
  personnel-event-conflicts.ts         # UPDATE — Return, facts, capacity
  personnel-event-finalize.ts          # UPDATE — bind employmentId / override evidence as needed
  personnel-event-recalc.ts            # VERIFY — same hook applies Start/Return on replay
  personnel-event-start-return.ts      # NEW optional — pure helpers / payload parse
  personnel-event-start-return.selfcheck.ts  # NEW
  employment.ts / primary-assignment.ts      # CALL from hook (no new public product verbs)
  employment-minimum-facts.ts          # ENFORCE
  person.ts                            # matchReturn stays fail-closed
packages/modules/headcount/src/        # THIN capacity port (optional location)
apps/web/src/server/personnel-event.ts
apps/web/components/personnel/personnel-event-form.tsx
```

### Testing requirements

- Pattern: `tsx` + `node:assert` + real `DATABASE_URL` (Vitest still deferred unless deliberately adding ephemeral DB).
- Exact cardinality: N finalize retries → still one Employment + one Primary + one authoritative event id for the Start.
- Matrix: Operator+capacity happy path; Operator+no capacity block; Admin Override; Scheduled non-mutation; past-dated + pending CTA; Return history; anonymized rematch block; overlap block; missing Team/Grade block; inactive ref block.
- Regression: `@divan/event-store`, personnel-event-draft/lifecycle/recalc, order-business-events, workers recalc selfchecks.
- Seed DoD: FK-shaped fixtures; `$transaction` / `withTransaction`; exact counts.

### Absolute non-goals

- Termination (4.6), Transfer atomic capacity (4.7), job/level/contract/comp events (4.8)
- Current/historical Person or org reconstruction products (4.9–4.11)
- Headcount Approval lifecycle / Matching / Reservation expiry UI (4.12–4.14)
- PopulationPort cutover; IDOR hardening on list/get (unless explicitly pulled)
- Inventing AR-DATA rehire token bytes or collaboration code enum
- Weakening append-only / Scheduled / recalc fail-closed behaviors from 4.1–4.4

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.5]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-20, FR-6, FR-11, FR-30/31 boundary]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-6, event naming]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — personnel-event-form, UX-DR5/11/14]
- [Source: `_bmad-output/implementation-artifacts/4-1-*.md` … `4-4-*.md` — substrate + handoffs]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/modules/person-employment/src/personnel-event-projection-hook.ts`]
- [Source: `packages/modules/person-employment/src/employment-minimum-facts.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Kernel `employment_id` UPDATE aborted txn (append-only) — draft-only bind retained
- Capacity Override uses warning + `requiresOverride` (Operator blocked; HR Admin + reason + ack)

### Completion Notes List

- Wired Effective `EmploymentStarted` / `EmploymentReturned` through AD-6 hook → Employment + Primary (`sourceEventId`), idempotent via Primary sourceEventId
- Narrow `@divan/headcount` capacity port replaces Start/Return unconditional `HEADCOUNT_UNAPPROVED` stub; Transfer types remain stub-blocked
- Conflicts: minimum facts, inactive refs as-of Effective Date, overlap for Return, anonymized Return fail-closed, same-day Start/Return ordering collision
- UI: Start/Return fieldset + Override reason; tRPC binds Override actor to session
- Selfcheck green; draft/lifecycle/recalc/event-store/workers regressions green
- FR-30 / 4.12–4.14 remainder documented in `deferred-work.md`

### File List

- packages/db/sql/006_headcount_capacity_port.sql
- packages/modules/headcount/src/index.ts
- packages/modules/person-employment/package.json
- packages/modules/person-employment/src/personnel-event-start-return.ts
- packages/modules/person-employment/src/personnel-event-start-return.selfcheck.ts
- packages/modules/person-employment/src/personnel-event-projection-hook.ts
- packages/modules/person-employment/src/personnel-event-conflicts.ts
- packages/modules/person-employment/src/personnel-event-finalize.ts
- packages/modules/person-employment/src/personnel-event-recalc.ts
- packages/modules/person-employment/src/errors.ts
- packages/modules/person-employment/src/index.ts
- apps/web/components/personnel/personnel-event-form.tsx
- apps/web/src/server/personnel-event.ts
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-5-start-return-events.md

### Change Log

- 2026-07-18: Implemented Story 4.5 Start & Return events (FR-20) — domain projectors, capacity port, conflicts, UI, selfchecks
- 2026-07-18: Code review patches — AD-6 orphan compensate, rematch audit, generation FOR UPDATE, BOM strip, selfcheck past-dated

---

## Story completion status

Status: **done**

Ultimate context engine analysis completed — comprehensive developer guide created.
