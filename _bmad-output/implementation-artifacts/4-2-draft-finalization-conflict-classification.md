---
baseline_commit: 43b8ffa6b0d28ecebe57759141d8099b0b1e3a66
---

# Story 4.2: Draft, Finalization & Conflict Classification

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Operator or Admin,
I want to create, edit, and delete Drafts and finalize routine valid Drafts,
so that day-to-day changes become authoritative without a universal second approval (FR15, FR19).

## Gate (read first)

**This story ships the Draft→Finalize product substrate on top of Story 4.1’s append-only event store. It does not ship Cancel/Reverse/Correction, temporal ordering/recalc, or Start/Transfer/Terminate domain flows.**

| Allowed in 4.2 | Forbidden in 4.2 |
| --- | --- |
| Mutable **Draft working store** (Prisma) for create/edit/delete — Drafts are non-authoritative | `UPDATE` / `DELETE` on `kernel_events` (trigger + API forbid it; AD-2) |
| Finalize path: validate → conflict classify → `appendBusinessEvent` with `finalized_*` + authoritative status in **one** `withTransaction` | Parallel event log / Prisma `KernelEvent` model / domain-owned event table |
| Conflict classifier: blocking vs warning + Persian consequence text; warning ack / Override hooks where policy allows | Inventing full AR-TEMPORAL scenario/oracle matrix or AR-ACCESS review thresholds as if frozen |
| Evaluation snapshot object for finalize (FR-56 spirit): one attributable as-of point for refs/permission/headcount checks | Mixing versions mid-finalize; silently accepting stale refs |
| Idempotent finalize + atomic race with edit/delete (row lock / txn) | Soft-hiding successful finalization; authorizing a deleted Draft |
| Risk-tier gate stubs for termination / compensation / retro-beyond-window / high-impact Override / production bulk import — fail-closed when configured, else leave non-authoritative pending review | Claiming AR-ACCESS/AR-AUDIT/AR-MIGRATION tiers approved |
| Minimal `personnel-event-form` UI: Save draft ≠ Finalize; conflict list in Persian; sensitive confirm when required | Full Start/Return/Terminate/Transfer/job-comp Operators UX (→ 4.5–4.8); UX-DR10 Cancel/Reverse badges (→ 4.3) |
| Sync projection-refresh **hook** in same txn as finalize (AD-6) for scaffold/critical path | Claiming current/historical person/org reconstruction products done (→ 4.9–4.11); full headcount Reservation lifecycle (→ 4.12–4.14) |
| Governed tRPC + PermissionSet binding; Persian `messageFa` at API boundary | Coarse JWT-only authz; English-only user errors on web |
| Keep `appendAccessEvent` + audit-envelope green | Feeding projections from `event_class=access` |
| Replace Story 2.6 `demoDraftOpen` / `demoDraftSaved` seams with real Draft awareness where the mid-session authz modal offers save-draft vs discard | Silent PopulationPort default-registry cutover |

- **AD-2 / AD-3:** Authoritative mutations = append-only business events in `@divan/event-store`. Domain module `@divan/person-employment` **consumes** the API; does not own the log.
- **AD-6:** Critical finalize mutations refresh affected projections in the **same** DB transaction as event append. Prisma = projections + Draft working store only; event append = raw SQL via `withTransaction`.
- **Status vocabulary:** Product “Finalized / Authoritative” ≠ a separate storage token. After successful finalize, store `status` as `Scheduled` (future Effective Date) or `Effective` (as-of/past) per FR-16 spirit. Tokens remain `Draft | Scheduled | Effective | Cancelled | Reversed` from 4.1 — do **not** add `Finalized` to CHECK.
- **AR fail-closed (Epic 3 retro, still open):** Do not invent AR-TEMPORAL calendar/reorg matrices, AR-ACCESS exact review matrix, AR-AUDIT hash-chain, AR-IDENTITY Person↔Account FK, or AR-HEADCOUNT matching beyond stub checks. Encode dispositions as typed fail-closed stubs + Dev Notes.
- **Epic 3↔4 sequencing:** Still no Operator-facing temporary CRUD that mutates Employment/Primary/Secondary/compensation **state** outside finalize→projection. Epic 3 `apply*Projection` helpers may be called **only** from finalize txn hooks, not from Draft save.
- **actor_account_id / registered_by / finalized_by:** TEXT cuid InternalAccount ids — do not re-UUID.

[Source: `epics.md` Story 4.2; `prd.md` FR-15, FR-19, FR-56 + glossary; `addendum.md` §5 + §12.3; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6; Story 4.1 Gate + deferred-work; UX `DESIGN.md` / `EXPERIENCE.md` personnel-event-form]

## Acceptance Criteria

1. **Given** a permitted user on فرم رویداد  
   **When** they save a Draft  
   **Then** the Draft is editable and deletable, stored outside the authoritative event log (or otherwise non-mutating of Finalized rows), and is **non-authoritative** (does not change projections / current state)

2. **When** they finalize a routine valid Draft  
   **Then** permission, required data, temporal/domain conflicts, and headcount checks run against **one** authoritative evaluation snapshot (FR56) — stale or newly invalid refs **block**

3. **And** known conflicts are classified **blocking** or **warning** with Persian consequence text; warnings proceed only with recorded acknowledgement and/or Override where policy explicitly allows (addendum: hard block / warning-ack / HR Admin Override)

4. **And** repeating the same finalize request yields **at most one** authoritative business event; concurrent edit / delete / finalize resolve atomically (deleted Draft cannot become authoritative; successful finalization cannot be hidden by deletion)

5. **And** Finalized (authoritative) events cannot be directly edited or hard-deleted — no UPDATE/DELETE API on `kernel_events`; UI must not offer edit/delete on authoritative events

6. **And** termination, compensation change, retroactive beyond window, high-impact Override, and production bulk import require independent pre-authorization tiers **when configured**; otherwise remain non-authoritative pending review (do not invent thresholds — stub + config hook)

7. **And** critical mutations refresh affected projections **synchronously in the same DB transaction** as event append (AD-6); scaffold/no-op types may no-op the projector but the txn seam must exist and be selfcheck-proven

8. **And** Story 4.1 invariants remain green: `appendBusinessEvent` / append-only trigger / access path / evidence sanitizer; this story does **not** deliver Cancel/Reverse/Correction writers, ordering engine, or Start/Transfer/Terminate product domain flows

## Tasks / Subtasks

- [x] Task 1: Draft working store + domain API (AC: #1, #5)
  - [x] Add Prisma model for mutable Draft (suggested: `PersonnelEventDraft`) under `@divan/db` — fields at minimum: `id`, `personId`, `employmentId?`, `eventType`, `effectiveDate` (date-only string/Date), `payload` JSON, `status` (`open` | `finalized` | `deleted` or equivalent), `version`/`updatedAt` for optimistic concurrency, `createdBy`/`updatedBy`, `finalizedEventId?`, `idempotencyKey?`, warning-ack / Override evidence refs as needed
  - [x] Migrate via normal Prisma migrate path (Draft is a **projection/working** table — not the event log)
  - [x] Domain module (`@divan/person-employment`): `createDraft`, `updateDraft`, `deleteDraft`, `getDraft` — edit/delete only while non-finalized; never call `apply*Projection` on draft save
  - [x] **Hard rule:** Draft mutability ≠ `kernel_events` mutability. Do not weaken `kernel_events_append_only_trg`. Do not add `updateBusinessEvent` / `deleteBusinessEvent`

- [x] Task 2: Evaluation snapshot + conflict classification (AC: #2, #3)
  - [x] Define `EvaluationSnapshot` (name flexible): attributable as-of date (Asia/Tehran date-only per AR-TEMPORAL partial freeze), actor PermissionSet fingerprint / account id, correlation id, and frozen refs used for checks (Person/Employment/org/job ids + versions or `updatedAt` stamps as available)
  - [x] Implement `classifyConflicts(draft, snapshot) → ConflictFinding[]` with `severity: "blocking" | "warning"`, `code`, `messageFa` (consequence in Persian)
  - [x] **Known blocking stubs (FR-19 — implement what you can prove with Epic 3 invariants; fail-closed otherwise):** overlapping Employments/Primary; invalid dates; Ladder–Grade invalid; inactive Employment mutation; broken correction refs (if draft carries them); irreconcilable ordering when detectable; unapproved headcount consumption for types that would consume (stub block if headcount module still empty for consuming types)
  - [x] **Warning path:** only when an explicit allow-list / policy flag exists; require acknowledgement payload on finalize; Override path only for HR Admin (or configured role) with reason + audit-friendly evidence — do not invent Override approver matrix
  - [x] Pre-Baseline native event: if Effective Date is before Baseline boundary when known — block or require Override + Persian warning + audit per AR-TEMPORAL partial freeze; if Baseline not configured, fail-closed document disposition (do not silently accept)

- [x] Task 3: Finalize service — idempotency, races, risk tiers, AD-6 (AC: #2–#7)
  - [x] `finalizeDraft({ draftId, actorId, acknowledgement?, override?, idempotencyKey?, clientSnapshot? })` inside `withTransaction`:
    1. Lock draft row (`FOR UPDATE`) — reject if missing / deleted / already finalized
    2. Re-build or re-validate evaluation snapshot (reject stale client snapshot)
    3. Permission + required-data + conflict + headcount checks
    4. Risk-tier gate (Task 3b)
    5. `appendBusinessEvent` with `finalizedBy`/`finalizedAt` pair, `registeredBy` from draft provenance, `status` = `Scheduled` | `Effective` from Effective Date vs snapshot as-of
    6. Mark draft finalized + store `finalizedEventId`; unique constraint so retry returns same event id
    7. Call projection refresh hook(s) in **same** txn (AD-6)
  - [x] Concurrent delete vs finalize: one atomic winner; deleted cannot authorize; finalized cannot disappear
  - [x] Concurrent edits: version check or last-write-with-lock — never silently overwrite after finalize started; prefer reject stale version
  - [x] Map kernel `BusinessEventValidationError` → domain error with `messageFa` at boundary
  - [x] Task 3b Risk tiers: config/env or PermissionSet flag map for `termination` | `compensation_change` | `retro_beyond_window` | `high_impact_override` | `production_bulk_import`. When tier applies and pre-auth missing → do **not** append authoritative event; leave Draft open or mark `pending_review` (non-authoritative). When tier config absent → document “pending review / non-authoritative” behavior for those event types rather than inventing thresholds

- [x] Task 4: Governed tRPC + permissions (AC: #1–#6)
  - [x] New router e.g. `apps/web/src/server/personnel-event.ts` mounted on `appRouter`
  - [x] Procedures: `draft.create` / `draft.update` / `draft.delete` / `draft.get` / `finalize` (names flexible) via `governedProcedure` + PermissionSet permissions (introduce `personnel_event.draft` + `personnel_event.finalize` or equivalent — **seed via `packages/modules/person-employment/src/seed.ts`** into HR Operator/Admin demo PermissionSets the same way `person.write` is bound; coarse role alone never authorizes)
  - [x] Persian errors via existing TRPC mapping patterns (`messageFa` like `person.ts` / `organization.ts`)
  - [x] Envelope meta: operation names, data categories fail-closed; do not invent sensitive category beyond existing AR-DATA freezes
  - [x] `@divan/person-employment` already depends on `@divan/event-store` — reuse; do not add a second event client

- [x] Task 5: Minimal فرم رویداد UI (AC: #1–#5) + a11y DoD
  - [x] Place under existing personnel surface: `apps/web/app/(app)/personnel/` (page exists; extend with event form route/section — do not invent a parallel top-level nav without navigation PermissionSet wiring)
  - [x] Implement `personnel-event-form` pattern (UX-DR11): sectioned form, max-w-4xl, required markers, inline validation, unsaved-change warning; footer: Cancel · Save draft (`button-secondary`) · Finalize (`button-primary`) — **draft save ≠ finalize**
  - [x] Show Effective Date distinctly from registration/finalization timestamps (FR-14 / FR-44) — Jalali picker already exists from Epic 1
  - [x] Surface blocking conflicts in Persian before finalize; warnings require explicit ack UI
  - [x] Use `sensitive-confirmation-dialog` (UX-DR14) for finalize when validation passes; block confirm when conflicts blocking or authz/recalc stale
  - [x] Wire mid-session scope revoke (`AuthzChangedModal`): offer real save-draft / discard; **block finalize** when scope revoked (replace pure `demoDraft*` lies where this story owns the surface)
  - [x] Interactive a11y DoD: focus moves into dialog; Escape returns; primary/secondary contrast; keyboard reachable CTAs; RTL Persian copy

- [x] Task 6: Selfcheck + docs (AC: #1–#8)
  - [x] `personnel-event-draft.selfcheck.ts` (or similar) under person-employment: create/edit/delete Draft; finalize happy path → one `kernel_events` business row with `finalized_*` set; retry finalize same idempotency → same event id; delete-vs-finalize race; blocking conflict rejects; warning requires ack; no UPDATE on `kernel_events`; projection hook invoked inside txn (assert call or `sourceEventId` on a scaffold touch if used)
  - [x] Keep `@divan/event-store` selfcheck green; `@divan/web` governed selfcheck green if touched
  - [x] Update `deferred-work.md`: Draft/finalize/conflict landed; Cancel/Reverse/Correction → 4.3; ordering → 4.4; domain event types → 4.5–4.8; headcount Reservation product → 4.12+
  - [x] Sync story Status ↔ `sprint-status.yaml` key `4-2-draft-finalization-conflict-classification`; **no UTF-8 BOM**

### Review Findings

- [x] [Review][Decision] Baseline unset disposition — resolved as option C: gate inactive until `conflictPolicy.baselineBoundaryDate` configured; document disposition in Dev Notes; drafts may set `payload.requireBaselineCheck=true` to force fail-closed while unset. Do not invent a default epoch.
- [x] [Review][Patch] Do not trust client `actorMayOverride` — derive solely from session (e.g. `hr_admin` / Override permission); ignore request body boolean [`apps/web/src/server/personnel-event.ts:241`]
- [x] [Review][Patch] Rebuild evaluation snapshot + classifyConflicts on same transactional connection as Draft `FOR UPDATE` / append (not Prisma on a separate connection) [`packages/modules/person-employment/src/personnel-event-finalize.ts:377`]
- [x] [Review][Patch] Employment active/overlap checks must use `draft.effectiveDate`, not only `snapshot.asOfDate` [`packages/modules/person-employment/src/personnel-event-conflicts.ts:249`]
- [x] [Review][Patch] Reject employment in snapshot when `emp.personId !== draft.personId` [`packages/modules/person-employment/src/personnel-event-conflicts.ts:119`]
- [x] [Review][Patch] `assertSnapshotFresh` must also compare `asOfDate` (and ideally permission fingerprint) [`packages/modules/person-employment/src/personnel-event-conflicts.ts:170`]
- [x] [Review][Patch] Avoid `toISOString().slice(0,10)` for PG `@db.Date` mapping; align overlap queries with Tehran date-only (not `T00:00:00.000Z`) [`packages/modules/person-employment/src/personnel-event-conflicts.ts:92`]
- [x] [Review][Patch] Snapshot person-missing / invalid asOf must throw `PersonnelEventError`, not generic `Error` [`packages/modules/person-employment/src/personnel-event-conflicts.ts:111`]
- [x] [Review][Patch] Unparseable `conflictPolicy.baselineBoundaryDate` must block (fail-closed), not skip the pre-baseline gate [`packages/modules/person-employment/src/personnel-event-conflicts.ts:339`]
- [x] [Review][Patch] Idempotent finalize retry must return stored authoritative `status` from `kernel_events` (or persist it), not re-resolve from a new as-of [`packages/modules/person-employment/src/personnel-event-finalize.ts:299`]
- [x] [Review][Patch] Map `evaluateRiskTiers` `pre_auth_missing:*` to `FinalizeDraftResult.reason: "pre_auth_missing"` [`packages/modules/person-employment/src/personnel-event-finalize.ts:463`]
- [x] [Review][Patch] Handle `status=finalized` with null `finalizedEventId` as explicit validation error [`packages/modules/person-employment/src/personnel-event-finalize.ts:297`]
- [x] [Review][Patch] Replace module-global `activeHook` with per-call / ALS hook to avoid cross-request leakage under concurrency [`packages/modules/person-employment/src/personnel-event-projection-hook.ts:38`]
- [x] [Review][Patch] Catch unique-violation when binding `idempotencyKey` on finalize UPDATE (race across drafts) [`packages/modules/person-employment/src/personnel-event-finalize.ts:548`]
- [x] [Review][Patch] Reject non-plain-object draft payload (array / null) before persist [`packages/modules/person-employment/src/personnel-event-draft.ts:197`]
- [x] [Review][Patch] Soft-delete race: if draft already deleted after version miss, throw `DRAFT_DELETED` not only `DRAFT_VERSION_CONFLICT` [`packages/modules/person-employment/src/personnel-event-draft.ts:310`]
- [x] [Review][Defer] Primary-assignment overlap stub beyond EmploymentStarted employment overlap — deferred to 4.5–4.7 when Primary-mutating event types land; EXCLUDE remains on `applyPrimaryAssignmentProjection`
- [x] [Review][Defer] Irreconcilable ordering conflict stub — deferred to Story 4.4 ordering engine (`when detectable`)
- [x] [Review][Defer] Selfcheck delete↔finalize is sequential not concurrent — deferred with Vitest/ephemeral isolation action item

### Interactive a11y DoD (Epic 1 retro carry-in)

For فرم رویداد + sensitive confirm + conflict list:
- Keyboard: Tab order logical; Finalize/Save draft reachable; dialog focus trap; Escape closes to trigger
- Screen reader: conflict severity announced; consequence text associated with control
- Contrast: `button-primary` / `button-secondary` brand contract (UX-DR2)
- Authz modal: finalize blocked when scope revoked mid-session

### Seed / DoD snippet

- Prefer `$transaction` / `withTransaction` for multi-step finalize fixtures
- Exact cardinality asserts (one authoritative event after N finalize retries)
- Draft Person UUID must exist if FK’d by Prisma; kernel event `person_id` remains application-level (no FK to Person) unless you deliberately add one — prefer consistency with 4.1 (no FK)

## Dev Notes

### Current state (UPDATE files — read before coding)

| File | Today | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/kernel/event-store/src/business-event.ts` | `appendBusinessEvent`; `finalized_*` optional pair; status default `Draft`; no transition engine | May add thin helpers (e.g. status assert) **without** UPDATE API; prefer domain finalize owning transitions | Append-only; sanitizer; PascalCase; TEXT actors |
| `packages/kernel/event-store/src/index.ts` | Re-exports access + business + `withTransaction` | Re-export any new helpers | Access path |
| `packages/db/sql/003_*.sql` + append-only trigger | Blocks UPDATE/DELETE on `kernel_events` | **Do not weaken** | Trigger + CHECKs |
| `packages/db/prisma/schema.prisma` | No Draft model; projections have nullable `sourceEventId` | **NEW** Draft working model + migrate | Never Prisma-map `kernel_events` |
| `packages/modules/person-employment/src/*` | Epic 3 projections + invariants; already depends on `@divan/event-store` | Draft/finalize/conflict services + selfcheck + permission asserts | `apply*Projection` only from finalize txn |
| `packages/modules/person-employment/src/seed.ts` | Binds `person.read` / `person.write` (+ org/job) into demo PermissionSets | Add `personnel_event.draft` / `personnel_event.finalize` (or chosen keys) to Operator/Admin sets | Existing person/org/job bindings |
| `apps/web/src/server/root.ts` + routers | person/org/job/accessAdmin | Mount personnel-event router | `governedProcedure` envelope |
| `apps/web/components/platform-status-provider.tsx` + `authz-changed-modal.tsx` | Demo draft flags for Story 2.6 | Real Draft save/discard where this UI owns the flow | Authz fingerprint change detection |
| `packages/modules/headcount` | Stub (`export {}`) | Finalize may call a **port stub** that fail-closes for consuming types | Do not invent full AR-HEADCOUNT matching |

### Draft vs append-only — mandated design

```text
┌──────────────────────────┐     finalize (same DB txn)     ┌─────────────────────────┐
│ PersonnelEventDraft      │ ────────────────────────────► │ kernel_events (business) │
│ Prisma, mutable          │   appendBusinessEvent +       │ append-only INSERT only  │
│ non-authoritative        │   projection refresh hook     │ finalized_* set          │
└──────────────────────────┘                               └─────────────────────────┘
```

**Rejected alternatives:** UPDATE Draft rows inside `kernel_events`; soft-delete via UPDATE status on event log; compensating “draft deleted” event as substitute for working-store delete (overkill for 4.2 — use mutable Draft table).

### Status after finalize

| Condition | `kernel_events.status` |
| --- | --- |
| `effective_date` > snapshot as-of (Asia/Tehran date-only) | `Scheduled` |
| else | `Effective` |

UI distinction Scheduled vs Effective badges / Cancel race = **Story 4.3**. 4.2 must still set the correct storage token so 4.3 is not blocked.

### Scaffold event types

4.2 owns the **pipeline**, not the full domain catalogue. Allow PascalCase `eventType` on Draft; for selfcheck use a clearly scaffold type (e.g. `ScaffoldChangeRecorded`). Domain effects for Start/Return/Terminate/Transfer/job-comp = 4.5–4.8 calling the same finalize substrate. Projection hook may no-op for scaffold types but must be invoked.

### Conflict taxonomy (addendum §5 / FR-19)

| Class | Behavior |
| --- | --- |
| Hard block | Finalize rejected; Persian consequence; no Override unless separately configured later |
| Warning + acknowledgement | Finalize allowed only with recorded ack |
| HR Admin Override | Allowed only when policy flag says so; reason + audit evidence; do not invent approver roster |

AR-TEMPORAL partial freeze already fixed: Asia/Tehran; date-only Effective Date; exclusive ends; same-date order by registration/finalization time (ordering engine still 4.4); future as-of = planned not Effective; pre-Baseline via Override+Persian warning+audit.

**Baseline unset disposition (code review 2026-07-18):** When `conflictPolicy.baselineBoundaryDate` is absent, the pre-baseline gate is **inactive** (no invented default epoch). This is the documented fail-closed disposition until AR-TEMPORAL baseline config lands. Callers that must refuse pre-baseline dates while unset may set `payload.requireBaselineCheck=true` (blocks with `BASELINE_NOT_CONFIGURED`). When boundary is configured, Effective Date before boundary blocks (or warning+Override if `allowPreBaselineOverride`). Unparseable boundary strings block with `BASELINE_BOUNDARY_INVALID`.

### Architecture compliance

- **Kernel ownership:** `@divan/event-store` only for SoT append; person-employment orchestrates Draft + finalize.
- **Naming:** PascalCase past-tense event types; kebab-case packages; server UUID for event ids (`randomUUID`); Draft ids may be cuid/uuid per Prisma norms.
- **Dates:** Effective Date = DATE / `YYYY-MM-DD` via `@divan/temporal-engine` `parseDateOnly`; registration/finalization = timestamptz. Never store Effective Date as timestamptz.
- **Errors:** Domain errors with `code` + `messageFa` (mirror `PersonIdentityError` / `EmploymentError`). Kernel may throw English `BusinessEventValidationError`; map at tRPC.
- **Evidence:** Reuse `assertNoSensitiveEvidence` — never put compensation amounts / national id into draft payload or event evidence.
- **Authz:** `governedProcedure` + PermissionSet; mid-session fingerprint change blocks finalize.

### Library / framework requirements

| Tech | Note |
| --- | --- |
| PostgreSQL 17.x | Prefer `FOR UPDATE` on Draft row; optional `pg_advisory_xact_lock` for finalize serialization — use **transaction-scoped** advisory locks only (auto-release on commit/rollback; PgBouncer-safe) |
| `pg` + `withTransaction` | Event append + finalize orchestration |
| Prisma | Draft working store + existing projections only |
| tRPC + zod | Router input validation |
| Vitest | Still deferred (Epic 3 retro) — continue `tsx` selfcheck unless deliberately introducing ephemeral DB |
| Node 22 / TypeScript 5.x | Unchanged |

### File structure requirements

```text
packages/db/prisma/schema.prisma                                      # UPDATE — PersonnelEventDraft
packages/db/prisma/migrations/...                                     # NEW — Draft table
packages/modules/person-employment/src/personnel-event-draft.ts       # NEW (names flexible)
packages/modules/person-employment/src/personnel-event-finalize.ts    # NEW
packages/modules/person-employment/src/personnel-event-conflicts.ts   # NEW
packages/modules/person-employment/src/personnel-event-errors.ts      # NEW or extend errors.ts
packages/modules/person-employment/src/permissions.ts                 # UPDATE — draft/finalize asserts
packages/modules/person-employment/src/index.ts                       # UPDATE — exports
packages/modules/person-employment/src/personnel-event*.selfcheck.ts  # NEW
packages/modules/person-employment/package.json                       # UPDATE — selfcheck script
apps/web/src/server/personnel-event.ts                                # NEW
apps/web/src/server/root.ts                                           # UPDATE — mount router
apps/web/components/.../personnel-event-form.tsx                      # NEW (path per app conventions)
apps/web/components/authz-changed-modal.tsx                           # UPDATE — real draft seam
apps/web/components/platform-status-provider.tsx                      # UPDATE if demo flags retired
_bmad-output/implementation-artifacts/deferred-work.md                # UPDATE
_bmad-output/implementation-artifacts/sprint-status.yaml              # UPDATE status
```

Optional thin touch (only if needed): `packages/kernel/event-store/src/business-event.ts` for shared finalize status helper — **no** mutation API.

Do **not** create `packages/modules/*/event-log` or SQL that drops the append-only trigger.

### Testing requirements

| Case | Expect |
| --- | --- |
| Create / edit / delete Draft | Mutable; no `kernel_events` row; no projection change |
| Finalize valid routine Draft | One business event; `finalized_at`/`finalized_by` set; status Scheduled or Effective |
| Retry finalize (same idempotency) | Same `finalizedEventId`; still one authoritative row |
| Delete concurrent with finalize | Single atomic outcome |
| Blocking conflict | Finalize rejected; Persian `messageFa` |
| Warning without ack | Rejected |
| Warning with ack (if policy allows) | Succeeds; ack recorded |
| Risk tier without pre-auth | Non-authoritative (no append) when configured / documented |
| Authoritative edit/delete attempt | Impossible via API; UI hidden |
| AD-6 | Projection hook runs inside same txn as append (rollback rolls both back) |
| Access path | Still green |

### Previous story intelligence (4.1 → 4.2)

| Build on | Do not reinvent |
| --- | --- |
| `appendBusinessEvent`, `BusinessEventValidationError`, `assertNoSensitiveEvidence`, `assertValidBusinessEventType`, `withTransaction` | New event table or Prisma KernelEvent |
| `BusinessEventStatus` tokens + nullable `finalized_*` columns | Token `Finalized` in DB CHECK |
| Append-only trigger + selfcheck DATE `::text` discipline | Weakening trigger for “Draft edits” |
| Evidence/scope sanitizer case-normalize + depth guards | Storing sensitive keys in draft payload |
| Epic 3 `apply*Projection` + EXCLUDE invariants | Operator CRUD bypass around events |
| `demoDraftOpen` / `demoDraftSaved` seams | Leaving demo lies after real Draft ships |
| Permission assert pattern in `permissions.ts` + `messageFa` errors | JWT coarse-role authz for finalize |

**4.1 review lessons:** require `finalizedAt`∧`finalizedBy` together; coerce empty optional UUIDs; reject Invalid `Date`; sanitize `scope`; avoid `toISOString().slice(0,10)` for PG DATE in asserts.

**Handoffs still owned later:** Cancel/Reverse/Correction (4.3); ordering/pg-boss (4.4); Transfer coverage-after-atomic-close+open (4.7); PopulationPort cutover only when `population-cutover.ts` criteria all true.

### Git intelligence summary

Recent commits: `43b8ffa story 4.1`, `3c17d56 epic 3 retro`, `5cb0107 story 3.9`, … Pattern: `story N.M` messages; Gate + absolute non-goals; `tsx` selfcheck; raw SQL for kernel; Prisma for projections; honest `deferred-work.md`.

### Latest technical information

- **PostgreSQL concurrency:** Prefer row `FOR UPDATE` on the Draft for edit/delete/finalize races. If advisory locks are needed for cross-resource serialization, use **`pg_advisory_xact_lock` / `pg_try_advisory_xact_lock`** (transaction-scoped) — not session-level locks (leak risk under poolers). Advisory locks are a traffic light; idempotency still requires durable `finalizedEventId` / unique idempotency key.
- **AD-6:** Keep critical path synchronous in one txn; heavy historical recalc remains async pg-boss in Story 4.4 — do not invent queue workers here.
- **pg `^8.16.x` / Prisma / Next:** Stay on workspace versions; no new event-sourcing framework.

### Project context reference

No `project-context.md` found at story creation. Follow Architecture Spine + this Gate. User communication: Persian; this story file: English.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Cancel / Reverse / Correction writers + UX-DR10 full badge set | 4.3 |
| Deterministic same-day ordering + pg-boss recalc UI | 4.4 |
| Start / Return / Terminate / Transfer / job-comp domain Operators | 4.5–4.8 |
| Current/historical person & org reconstruction products | 4.9–4.11 |
| Headcount Approval / Reservation / Override product lifecycle | 4.12–4.14 |
| Hash-chain (NFR-10) | AR-AUDIT deferred |
| PopulationPort default registry cutover | Criteria only until met |
| Vitest/ephemeral DB isolation | Prefer when quality opportunity lands (open retro item) |

### UX notes

- Footer CTAs: ghost/Cancel · secondary Save draft · primary Finalize (`DESIGN.md` personnel-event-form).
- Conflicts before finalize in Persian; capacity panel patterns foreshadow headcount UI but full panel = later stories.
- Scope revoked mid-session: save draft or discard; never finalize.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.2, Epic 4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-15, FR-19, FR-56, §7.1 AR-TEMPORAL]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §5 lifecycle, §12.3 races]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-5, AD-6]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — personnel-event-form, UX-DR11/14]
- [Source: `_bmad-output/implementation-artifacts/4-1-append-only-event-store-attributable-event-record.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- `pnpm --filter @divan/person-employment selfcheck:personnel-event-draft` → OK
- `pnpm --filter @divan/event-store selfcheck` → OK
- `pnpm --filter @divan/web selfcheck:governed` → OK
- `pnpm --filter @divan/person-employment typecheck` / `@divan/web typecheck` → OK

### Implementation Plan

- Mutable `PersonnelEventDraft` Prisma table separate from `kernel_events`; CRUD never touches event log or projections.
- Finalize orchestrates `FOR UPDATE` + evaluation snapshot + conflicts + risk tiers + `appendBusinessEvent` + draft mark + AD-6 projection hook inside one `withTransaction`.
- Conflict stubs fail-closed (headcount consuming types, pre-baseline, inactive employment, ladder/grade); warning ack allow-list + Override evidence.
- Governed tRPC + `personnel_event.draft` / `finalize` PermissionSet seed; minimal فرم رویداد + sensitive confirm; authz modal calls real draft save handler.

### Completion Notes List

- Draft working store + create/update/delete/get with optimistic versioning; soft-delete; sensitive payload rejected.
- EvaluationSnapshot (Tehran as-of) + classifyConflicts with Persian `messageFa`; stale client snapshot blocks.
- finalizeDraft idempotent (`finalizedEventId` / idempotencyKey); status Scheduled|Effective; risk tier → `pending_review` without append when unconfigured/missing pre-auth.
- AD-6: projection hook in same txn; selfcheck proves rollback leaves no kernel row and draft open.
- tRPC `personnelEvent.*` + seed permissions for hr.admin/hr.operator; UI on `/personnel`; authz modal save-draft wired.
- deferred-work.md updated; sprint-status ↔ story Status = review.

### File List

- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/20260718033000_personnel_event_draft/migration.sql
- packages/modules/person-employment/src/errors.ts
- packages/modules/person-employment/src/permissions.ts
- packages/modules/person-employment/src/seed.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/package.json
- packages/modules/person-employment/src/personnel-event-draft.ts
- packages/modules/person-employment/src/personnel-event-conflicts.ts
- packages/modules/person-employment/src/personnel-event-finalize.ts
- packages/modules/person-employment/src/personnel-event-projection-hook.ts
- packages/modules/person-employment/src/personnel-event-draft.selfcheck.ts
- apps/web/src/server/personnel-event.ts
- apps/web/src/server/root.ts
- apps/web/src/server/trpc.ts
- apps/web/app/(app)/personnel/page.tsx
- apps/web/components/personnel/personnel-event-form.tsx
- apps/web/components/personnel/sensitive-confirmation-dialog.tsx
- apps/web/components/platform-status-provider.tsx
- apps/web/components/authz-changed-modal.tsx
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-2-draft-finalization-conflict-classification.md

### Change Log

- 2026-07-18: Story 4.2 implemented — Draft store, finalize/conflict/AD-6 substrate, governed API, minimal فرم رویداد, selfcheck green; status → review
- 2026-07-18: Code review — Baseline unset disposition documented (opt C); patched Override trust, txn snapshot reads, effectiveDate checks, ALS projection hook, idempotent status, etc.; status → done

## Story completion status

- Status: **done**
- Completion note: Code-review patches applied (Baseline disposition C + 15 patches); deferred items remain in deferred-work.md
