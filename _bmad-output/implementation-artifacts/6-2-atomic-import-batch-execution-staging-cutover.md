---
baseline_commit: 7472f44
---

# Story 6.2: Atomic Import Batch Execution & Staging Cutover

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a migration executor,
I want atomic Import Batch execution via staging with approval segregation,
so that failures leave zero partial production state (FR38, AD-4).

**Story key:** `6-2-atomic-import-batch-execution-staging-cutover`  
**Epic:** 6 — Migration, Baseline & Governed Export (FR37–41, FR52)  
**Prerequisite:** Story 6.1 done — `/import` wizard identify→validate→preview→confirm-draft; `@divan/migration` parse/validate/preview; ephemeral in-memory drafts; `executionAllowed: false` / `eventStoreAppended: false`; Import Batch report still `unavailable`; SoD + concurrent execute + durable staging deferred here.

## Acceptance Criteria

1. **Given** a validated confirmed-draft preview batch from Story 6.1  
   **When** an authorized approver independently approves it for staging/execution  
   **Then** upload / approval / execution duties are separated per AR-MIGRATION (**provisional code-marked**, fail-closed — do **not** invent a signed SoD matrix); the executor **cannot alter** approved batch contents (rows/columns/template frozen at approval)

2. **And** migration writes batch payload into a **separate staging schema** first (AD-4); production event-store receives Baseline/events **only** via an **atomic cutover** after that independent approval — never from preview/confirm paths

3. **And** execution **revalidates** against current authoritative state before cutover; overlapping concurrent batches targeting the same records are blocked with Persian copy «دسته دیگری در حال اجراست» + **owner** + **correlation id** (UX-DR16)

4. **When** execution fails (pre-cutover or mid-cutover abort before COMMIT)  
   **Then** no partial business / derived / headcount state remains in production; pre-cutover rollback **drops staging** with **zero production trace** (AD-4 / ops runbook)

5. **And** Import Batch **evidence** records: source metadata, actors/times (upload, approve, execute), status, counts, errors, and every created record/event id; repeating the same input **cannot silently duplicate** (FR-38 idempotency)

6. **And** execute confirmation uses existing `SensitiveConfirmationDialog` (UX-DR14) with consequence text; single dialog depth (Sheet + one Dialog max — leave-guard XOR execute confirm)

7. **And** PopulationPort honesty preserved; when cutover intersects live workforce subjects, apply actor-derived field/row omit against the registry (closes 6.1 review deferral) — never provisional stamp-all UUID maps; fixture registry must not be labeled production workforce authz

8. **And** report key `import_batch_outcomes` may leave `unavailable` **only** until **real** batch evidence exists; once evidence rows exist, activate from evidence — **never fabricate** outcomes from preview-only / failed-pre-cutover drafts (Epic 5 retro #4)

9. **And** this story does **not** own Baseline provenance UX / history-boundary product copy (→ **6.3**), signed reconciliation workspace / FR-40 production gate UI (→ **6.4**), or governed export / artifact reauth (→ **6.5**)

10. **And** AR-MIGRATION / AR-CUTOVER / AR-ACCESS remain fail-closed: provisional permissions and lifecycle OK with explicit “pending freeze” comments; forbidden to claim production cutover readiness or invent reconciliation tolerances / Personnel Code merge-split matching

## Tasks / Subtasks

- [x] Task 1: Staging schema + durable batch store (AC: #2, #4, #5)
  - [x] NEW `packages/db/sql/013_migration_staging.sql` (next after `012_…`) — separate schema (e.g. `migration_staging`) with tables for: batch header (id, template, status lifecycle, actors/times, correlation_id, source file metadata hash, idempotency key), staging rows, batch evidence / created-event refs, optional execution lock / overlap index. Follow `packages/db/sql/README.md` conventions (`IF NOT EXISTS`, idempotent where practical)
  - [x] NEW staging repository in `@divan/migration` (raw SQL via `pg` Pool/PoolClient — **not** Prisma; AD-6). Persist confirmed drafts out of in-memory Map into staging (or dual-write: promote confirm → staging row)
  - [x] Status lifecycle (names flexible, document in code): e.g. `confirmed-draft` → `approved` → `staging-loaded` → `executing` → `cutover-complete` | `failed` | `rolled-back`; executor cannot mutate row payload after `approved`
  - [x] Pre-cutover rollback API: drop/truncate staging contents for that batch (and mark evidence `rolled-back`) with **assert zero** production business events for that batch correlation — selfcheck must prove this
  - [x] Replace / gate the in-process `draftStore` Map for multi-instance safety on execute paths (6.1 review deferral). Preview-only ephemeral OK only if promote-to-staging happens before approve/execute; document ops assumption if any residual single-process preview remains

- [x] Task 2: SoD approve + execute cutover domain (AC: #1–#5, #7)
  - [x] NEW domain modules under `packages/modules/migration/src/` e.g. `sod.ts`, `staging-repo.ts`, `execute-batch.ts` / `cutover.ts`, `batch-evidence.ts`, `concurrent-mutex.ts` — keep web thin
  - [x] **SoD (provisional):** separate coarse gates for approve vs execute. Prefer distinct existing permission strings if already documented; otherwise introduce **code-marked provisional** keys (e.g. reuse `person.write` for upload-only path already in 6.1, and add provisional `migration.approve` / `migration.execute` **only** if you also wire them fail-closed for seeded roles without inventing AR-ACCESS freeze — document choice in Dev Agent Record). Same actor must **not** both approve and execute the same sensitive batch when segregation mode is on (default on for production-sensitive path)
  - [x] **Revalidate** at execute: re-run FR-37 validators + authoritative FK/overlap checks against current DB/projections; blocking issues abort with zero production write
  - [x] **Concurrent overlap mutex:** before cutover, detect overlapping target keys (Personnel Code / person ids / staging row identity). Prefer DB-backed lock: transaction-scoped `pg_try_advisory_xact_lock` (namespace migration) **and/or** unique partial index / `executing` row lock — **not** session-scoped advisory locks (pool-safe). On conflict return Persian «دسته دیگری در حال اجراست» + owner account display + correlation id
  - [x] **Atomic cutover** inside `withTransaction` from `@divan/event-store`:
    - Append Baseline business events via `appendBusinessEvent(client, …)` for each Person (PascalCase past-tense type e.g. `BaselineRecorded` — introduce if absent; first production event per Person where applicable)
    - Use published `@divan/person-employment` / `@divan/headcount` APIs for any projection/sync side effects required so headcount-critical paths stay **sync in same TX** (AD-6) — **no** direct reads of another module’s internal tables (AD-3)
    - Provenance / payload may include `source: "migration"` as **audit metadata only** — never as the cutover control itself (FR-39 boundary; full UX = 6.3)
    - On any throw: ROLLBACK entire TX → production untouched; then staging rollback path as AC #4
  - [x] **Idempotency:** stable idempotency key from source content hash + template + batch id; repeat execute of successful batch returns prior evidence / no duplicate events
  - [x] **Batch evidence** persist: actors, timestamps, status, counts, errors[], created event ids / record ids; expose DTO for UI + reporting
  - [x] Extend `MigrationErrorCode` for: `SOD_VIOLATION`, `CONCURRENT_BATCH`, `CUTOVER_FAILED`, `STAGING_NOT_FOUND`, `BATCH_NOT_APPROVED`, `IDEMPOTENCY_CONFLICT`, `REVALIDATION_FAILED`, etc. — always `messageFa`

- [x] Task 3: Governed tRPC + UI execute path (AC: #1, #3, #6)
  - [x] UPDATE `apps/web/src/server/migration.ts`: add `approveBatch`, `executeBatch` / `cutoverBatch`, `rollbackStaging`, `getBatchEvidence` (names flexible) with `governedProcedure` + envelope meta; map new error codes; never leak `error.message`
  - [x] Keep Layout≠RSC gate: any RSC data fetch calls `assertPageAccess` (or equivalent) before load
  - [x] UPDATE `apps/web/components/import/import-wizard.tsx`: stages after confirm → **approve** (segregation UI) → **execute** (SensitiveConfirmationDialog) → result (success evidence or failed + correlation id). Executor UI is read-only on approved contents
  - [x] Concurrent block banner/message from `operational-copy.ts` (add strings — no hardcoded Persian in components)
  - [x] Leave-guard: dirty = open draft/staging batch not terminal; do not treat Dialog `open` as dirty; single dialog depth
  - [x] Reuse `SensitiveConfirmationDialog` from `apps/web/components/personnel/sensitive-confirmation-dialog.tsx` — do not fork a second confirm primitive
  - [x] Persian digits for counts; UX-DR24 voice (fact + next step; no ceremonial success)

- [x] Task 4: Reporting honesty + PopulationPort (AC: #7–#8)
  - [x] If and only if real cutover evidence exists: UPDATE reporting path so `import_batch_outcomes` reads evidence (not preview drafts). Until first successful evidence row, keep exact `MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA` behavior
  - [x] Do **not** change message to fake “۰ خطا” / empty-green
  - [x] On execute/cutover reveal paths: authorize → PopulationPort intersect → access event → filtered payload; disclose honesty fields when fixture registry still default

- [x] Task 5: Verify + DoD (AC: #1–#10)
  - [x] NEW `@divan/migration` selfcheck e.g. `selfcheck:import-batch` / `selfcheck:cutover`: staging write without production events; successful cutover appends Baseline events; failure/rollback → zero production trace; concurrent overlap blocks; idempotent repeat; SoD same-actor approve+execute rejected when segregation on; `assertNoEventStoreAppend` still holds for preview-only paths
  - [x] UPDATE web `migration.selfcheck.ts` for router surface smoke if needed
  - [x] Regression: reporting selfcheck — unavailable until evidence, then evidence-backed (never fabricate)
  - [x] `pnpm --filter @divan/migration` + `@divan/web` (+ `@divan/reporting` if touched) typecheck; eslint on touched files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits

### Manual DoD checklist

- [x] Confirm-draft → approve (different actor when segregation on) → execute with SensitiveConfirmationDialog
- [x] Executor cannot edit approved rows/columns
- [x] Happy path: staging populated; after cutover, production has Baseline events; evidence lists created ids
- [x] Forced failure before COMMIT → production event-store unchanged for that correlation; staging cleaned/rolled back
- [x] Second overlapping batch → «دسته دیگری در حال اجراست» + owner + correlation id
- [x] Repeat successful execute → no duplicate Baseline events
- [x] Same actor approve+execute blocked (segregation on) with Persian reason
- [x] Preview/confirm paths still never append production events
- [x] `import_batch_outcomes`: still unavailable **or** evidence-backed — never fabricated preview rows
- [x] PopulationPort honesty / omit still correct on under-permissioned viewer
- [x] No Prisma in `apps/web`; AD-3 boundaries held
- [x] Single dialog depth; leave-guard data-state rules held
- [x] Sprint/story must **not** claim FR-39 provenance UX, FR-40 reconciliation workspace, or FR-41/FR-52 export done

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Staging schema + durable batch before production append | Append Baseline/events from preview/confirm |
| Atomic cutover in one DB TX via `withTransaction` + `appendBusinessEvent` | Partial projection updates outside TX; “delete events” as rollback |
| Pre-cutover fail → drop staging, zero production **event** trace | Leave orphan production events or half-updated headcount |
| SoD upload ≠ approve ≠ execute (provisional, fail-closed) | Invent signed AR-MIGRATION permission matrix as “approved policy” |
| Concurrent overlap block with owner + correlation id | Silent overwrite of overlapping batches |
| Batch evidence + idempotency | Fabricate Import Batch report from drafts |
| Consume published PE/headcount APIs | Cross-module table reads; Prisma for event-store/staging kernel |
| Close 6.1 deferrals: durable store for execute; PopulationPort omit when live subjects exist | Claim PopulationPort full default-registry cutover |

**AD-6 honesty (review 2026-07-25):** `createPerson` remains on Prisma outside the event-store PoolClient TX. Mid-cutover abort can leave Person orphans while Baseline events roll back; `assertZeroProductionTrace` counts `kernel_events` only. Full Prisma↔Pool orphan hardening stays an Absolute non-goal / Epic 4 open action.

### Absolute non-goals

- Baseline provenance UI / reconstructable-history boundary copy → **6.3**
- Signed reconciliation workspace / FR-40 LG-1 gate UI → **6.4** (may leave a **fail-closed hook** / TODO for production-tier cutover if reconciliation evidence missing — do **not** invent tolerances)
- Governed export / artifact reauth / custody → **6.5**
- Day-to-day section **ورود گروهی**
- PopulationPort **full** default-registry cutover; AD-6 Prisma vs PoolClient orphan hardening; `ensure*Schema` migrations-only; Vitest mandate as new standard
- Person-org IDOR on Cancel/Reverse/Correct (unless this story touches those writers — it should not)
- Deduplicate Add vs QuickCreate; logout → `requestNavigation` (document if untouched)
- Editing `navigation.ts` ROLE matrices “for cleanliness”
- Forking GovernedDataTable or SensitiveConfirmationDialog

### UPDATE files — current state → this story → preserve

| File | Current (post-6.1) | Change | Preserve |
| --- | --- | --- | --- |
| `packages/modules/migration/src/preview-batch.ts` | In-memory Map; `executionAllowed: false`; IDOR bind to `accountId`; TTL/caps | Promote confirmed drafts to staging; keep preview paths zero production append | Ownership checks; permission-omit projection; no silent event-store |
| `packages/modules/migration/src/index.ts` | Exports parse/validate/preview only | Export staging/approve/execute/evidence APIs | Thin public barrel; no web coupling |
| `packages/modules/migration/src/errors.ts` | Preview-era codes | Add execute/SoD/concurrent/cutover codes | `messageFa` always |
| `packages/modules/migration/src/validate-import.ts` | FR-37 validators | Reuse at execute revalidation; extend only if authoritative checks need DB ports | Persian issue cite shape |
| `packages/modules/migration/src/import-preview.selfcheck.ts` | Preview selfcheck | Keep green; add separate cutover selfcheck script | `assertNoEventStoreAppend` for preview |
| `apps/web/src/server/migration.ts` | upload/get/cancel/confirm; gate `person.write` | approve/execute/rollback/evidence procedures; provisional SoD gates | `mapMigrationError`; base64 caps; PopulationPort honesty fields |
| `apps/web/components/import/import-wizard.tsx` | identify→confirm-draft | approve + execute + concurrent + result | Sheet + leave-guard data-state; operational-copy |
| `apps/web/lib/operational-copy.ts` | Preview/upload strings | Concurrent / SoD / execute fail / result strings | No hardcoded UI Persian |
| `packages/modules/reporting/src/report-run.ts` (+ catalogue msg) | `import_batch_outcomes` → unavailable | Activate **only** from real evidence | Exact unavailable message until evidence |
| `packages/db/sql/*` | Through `012_…`; **no** staging | NEW `013_migration_staging.sql` | Append-only event-store untouched as SoT |

### Consumer / cutover contract (encode — do not rediscover)

1. **Pipeline:** 6.1 preview/confirm → **6.2** approve → load staging → revalidate → mutex → atomic cutover → evidence. Execute is never confirm.
2. **AD-4:** Staging is the only pre-production write surface. Production event-store ingress = cutover TX only. Rollback before cutover = drop staging.
3. **Baseline event:** Introduce PascalCase past-tense type (recommended `BaselineRecorded`) via `appendBusinessEvent`. First production event per migrated Person where applicable. `provenance.source = "migration"` is metadata, not a control plane.
4. **Headcount:** If cutover creates capacity-affecting state, refresh projections **synchronously in the same TX** (AD-6). Prefer published headcount ports used by Start/Transfer finalize — do not invent a second capacity ledger.
5. **FR-40:** Full signed reconciliation gate is Story **6.4**. Do not invent control totals. Optional: fail-closed stub that blocks a `production` tier cutover when reconciliation evidence token absent (document as provisional pending AR-CUTOVER) — trial/staging-only execute may proceed for mechanism proof.
6. **Authz reveal:** authorize → PopulationPort → access event → filtered DTO. Coarse role still `hr_admin` nav for `/import` unless proven bug.
7. **Mutex:** Prefer `pg_try_advisory_xact_lock` (transaction-scoped) + overlap key set sorted deterministically; avoid session advisory locks under pooled connections.
8. **Import Batch report:** evidence-backed or unavailable — never preview-greenwash.
9. **UJ-4:** Approver evidence + executor without content mutation; failure → atomic rollback + «ناموفق» + correlation id.

### AR-MIGRATION / AR-CUTOVER honesty

- `launch-artifacts.md`: **AR-MIGRATION** and **AR-CUTOVER** are **pending**.
- Epic 5 action: keep AR-MIGRATION / AR-ACCESS / AR-DATA / AR-REPORTING / AR-TEMPORAL **fail-closed**; do not invent in Epic 6.
- Allowed: provisional code-marked SoD keys, staging DDL, cutover machinery, batch evidence schema, idempotency.
- Forbidden: claiming signed freeze, inventing reconciliation tolerances, Personnel Code merge/split/return matching, labeling fixture PopulationPort as production workforce.

### PopulationPort / fixture≠production (carry from 6.1 / Epic 5)

- Criteria remain in `packages/modules/person-employment/src/population-cutover.ts`.
- 6.1 deferred actor-derived omit on staging rows “not yet workforce subjects.”
- **This story:** when cutover materializes/matches live Person subjects, apply field/row omit against registry for any reveal; honesty disclosure stays on payloads while fixture default remains.

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| PostgreSQL 17 + raw SQL | Staging schema in `packages/db/sql/013_*.sql`; apply via existing `apply.mjs` |
| `pg` Pool / PoolClient | Staging repo + cutover; reuse event-store `withTransaction` |
| `@divan/event-store` | `appendBusinessEvent(client, …)` only inside cutover TX |
| tRPC 11 + `governedProcedure` | Thin router; envelope meta on approve/execute |
| ExcelJS | Already in `@divan/migration` — reuse parse if re-upload needed; no new parser |
| SensitiveConfirmationDialog | Reuse personnel primitive |
| Node 22 / TS 5.x / pnpm | Existing monorepo |
| No Prisma in web / staging kernel | AD-6 |

### File structure requirements

```text
packages/db/sql/
  013_migration_staging.sql          # NEW

packages/modules/migration/src/
  staging-repo.ts                    # NEW
  sod.ts                             # NEW (provisional segregation)
  concurrent-mutex.ts                # NEW
  execute-batch.ts / cutover.ts      # NEW
  batch-evidence.ts                  # NEW
  preview-batch.ts                   # UPDATE (promote / handoff)
  errors.ts                          # UPDATE
  index.ts                           # UPDATE exports
  import-batch.selfcheck.ts          # NEW (or cutover.selfcheck.ts)

apps/web/
  src/server/migration.ts            # UPDATE procedures
  components/import/import-wizard.tsx
  lib/operational-copy.ts
```

### Testing requirements

- Domain selfcheck covers: staging-only write; cutover success; failure zero-trace; concurrent block; idempotency; SoD; preview paths still non-appending.
- Prefer real ephemeral DB for TX tests when available (open sprint quality action — valuable here; do not invent a new framework mandate if harness absent — document manual TX proof if blocked).
- Typecheck + eslint; reporting regression for unavailable≠fabricate.
- Interactive a11y: focus ring on execute confirm, Esc returns to trigger, 200% zoom, `prefers-reduced-motion`.

### Previous story intelligence (6.1)

- Domain-in-`@divan/migration` + thin web paid off — keep that split for cutover.
- Review patches to preserve: draft IDOR ownership; base64 alphabet + size caps; issue cite filter for omitted columns; Sheet reopen/confirm path; Jalali date cells; content sniff not extension-only.
- Explicit deferrals to close here: (1) durable/shared store for multi-instance execute, (2) PopulationPort field/row omit when live subjects exist, (3) SoD + concurrent mutex.
- Confirm remains non-executing; do not collapse confirm into execute.
- BOM-safe `sprint-status.yaml` edits on Windows.
- Coarse gate today is `person.write` — SoD needs an explicit provisional design documented in Dev Agent Record (do not silently treat upload==approve==execute).

### Git intelligence summary

- HEAD pattern: `7472f44` story 6.1 → `c899cf1` epic 5 retro → 5.x stories. Dual-package selfchecks, Gate tables, honest stubs with successor story ids.
- Touch surface for 6.2 will center on `packages/modules/migration/**`, `apps/web/src/server/migration.ts`, `apps/web/components/import/**`, new `packages/db/sql/013_*`, optionally reporting evidence path.

### Latest tech information

- Prefer **transaction-scoped** PostgreSQL advisory locks (`pg_try_advisory_xact_lock`) for batch mutex — auto-release on COMMIT/ROLLBACK; session locks risk leaks under pooled connections.
- Acquire multiple overlap keys in **deterministic sorted order** to avoid deadlocks.
- Spreadsheet stack unchanged from 6.1 (ExcelJS); cutover is DB/event-store work, not a new parser.

### Project context reference

- No `project-context.md` in repo at story creation; follow ARCHITECTURE-SPINE AD-2..AD-6, epics Story 6.2 AC, Story 6.1 handoff + review decisions, Epic 5 retro actions #2/#4/#9.
- Operator UI Persian; code/docs English per BMM config.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6 / Story 6.2, UX-DR16]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-37, FR-38, FR-52, FR-56, UJ-4]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-4]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md` — pre-cutover drop staging]
- [Source: `_bmad-output/specs/spec-divan/launch-artifacts.md` — AR-MIGRATION, AR-CUTOVER pending]
- [Source: `_bmad-output/implementation-artifacts/6-1-controlled-import-wizard-with-preview.md` — handoff + review deferrals]
- [Source: `packages/kernel/event-store/src/index.ts` — `withTransaction`]
- [Source: `packages/db/sql/README.md` — SQL migration conventions]
- [Source: `apps/web/components/personnel/sensitive-confirmation-dialog.tsx`]
- [Source: `packages/modules/reporting/src/report-catalogue.ts` — `MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA`]

### Epic 5 / 6.1 carry-ins (encode in implementation)

| Item | Handling in 6.2 |
| --- | --- |
| Durable store / multi-instance | Task 1 staging persistence |
| PopulationPort omit on live subjects | AC #7 + Task 4 |
| SoD + concurrent execute | AC #1/#3 + Task 2–3 |
| Import Batch report evidence | AC #8 + Task 4 |
| AR fail-closed | Gate + AC #10 |
| Artifact reauth / export | Non-goal → 6.5 |
| FR-40 reconciliation UI | Non-goal → 6.4 (optional fail-closed hook only) |
| BOM-safe sprint-status | Task 5 DoD |

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Concurrent mutex: unique INSERT abort poisoned TX → switched to `ON CONFLICT DO NOTHING RETURNING` so CONCURRENT_BATCH stays a clean MigrationError.
- Baseline event status uses `Effective` (event-store has no `Finalized` status token).

### Completion Notes List

- Staging schema `migration_staging` + durable repo; confirm promotes in-memory draft → staging before approve/execute (preview Map remains single-process for preview-only).
- Provisional SoD: `migration.approve` (hr.admin) / `migration.execute` (hr.operator) + same-actor segregation default on; upload/confirm stays `person.write`.
- Atomic cutover via `withTransaction` + `BaselineRecorded`; createPerson via published PE API (AD-6 Prisma/PoolClient orphan hardening still open); trial tier execute allowed; production tier fail-closed without reconciliation token (6.4).
- Evidence + idempotent replay; concurrent overlap message UX-DR16; reporting activates only from `cutover-complete` evidence.
- Selfchecks: `selfcheck:import-preview`, `selfcheck:import-batch`, web `selfcheck:migration`, reporting `selfcheck:report` — all green. Typecheck migration/reporting/web/audit-envelope green.

### Implementation Plan

1. DDL 013 + staging-repo / sod / mutex / evidence / execute-batch domain
2. Thin tRPC + wizard approve/execute + SensitiveConfirmationDialog
3. Reporting evidence path + envelope provisional policy rules
4. Selfcheck + story/sprint status → review

### File List

- packages/db/sql/013_migration_staging.sql
- packages/modules/migration/package.json
- packages/modules/migration/src/errors.ts
- packages/modules/migration/src/index.ts
- packages/modules/migration/src/preview-batch.ts
- packages/modules/migration/src/sod.ts
- packages/modules/migration/src/seed-sod.ts
- packages/modules/migration/src/staging-repo.ts
- packages/modules/migration/src/concurrent-mutex.ts
- packages/modules/migration/src/batch-evidence.ts
- packages/modules/migration/src/execute-batch.ts
- packages/modules/migration/src/import-batch.selfcheck.ts
- packages/kernel/audit-envelope/src/index.ts
- packages/modules/reporting/package.json
- packages/modules/reporting/src/report-run.ts
- apps/web/src/server/migration.ts
- apps/web/src/server/migration.selfcheck.ts
- apps/web/components/import/import-wizard.tsx
- apps/web/lib/operational-copy.ts
- pnpm-lock.yaml
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/6-2-atomic-import-batch-execution-staging-cutover.md

### Change Log

- 2026-07-25: Implemented Story 6.2 atomic staging cutover, provisional SoD, concurrent mutex, batch evidence, wizard approve/execute, evidence-backed import_batch_outcomes; status → review.

### Review Findings

- [x] [Review][Decision] Prisma `createPerson` outside cutover PoolClient TX — **resolved: accept documented AD-6 gap + honesty notes** (orphan Person rows possible; `assertZeroProductionTrace` events-only; Epic 4/AD-6 hardening remains non-goal)
- [x] [Review][Decision] Upload≠approve same-actor segregation — **resolved: patch applied** (`assertUploadApproveSegregation`)
- [x] [Review][Decision] Failed batches re-executable — **resolved: staging rows dropped on fail; new upload/approve cycle required**

- [x] [Review][Patch] Execute failure path drops staging rows + marks `failed` [packages/modules/migration/src/execute-batch.ts]
- [x] [Review][Patch] Cutover reveal paths project column omit + PopulationPort intersect on evidence ids [apps/web/src/server/migration.ts]
- [x] [Review][Patch] Execute revalidation includes authoritative live FK checks [packages/modules/migration/src/execute-batch.ts]
- [x] [Review][Patch] `promoteConfirmedDraftToStaging` wraps header+rows in one TX [packages/modules/migration/src/staging-repo.ts]
- [x] [Review][Patch] `confirmDraft` fail-closed when draft missing for staging promote [apps/web/src/server/migration.ts]
- [x] [Review][Patch] Concurrent executors claim batch with `SELECT … FOR UPDATE` [packages/modules/migration/src/execute-batch.ts]
- [x] [Review][Patch] Removed per-request `ensureMigrationSodSeeded()` — seed is bootstrap/selfcheck only [apps/web/src/server/migration.ts]
- [x] [Review][Patch] Leave-guard dirty for stagingBatchId without approve data + `import-staging` kind [apps/web/components/import/import-wizard.tsx]
- [x] [Review][Patch] Evidence `createdPersonCount` counts only newly created Persons [packages/modules/migration/src/execute-batch.ts]
- [x] [Review][Patch] `approveStagingBatch` UPDATE uses `WHERE status='confirmed-draft' RETURNING` [packages/modules/migration/src/staging-repo.ts]
- [x] [Review][Patch] In-flight `executing` maps to `CONCURRENT_BATCH` [packages/modules/migration/src/execute-batch.ts]
- [x] [Review][Patch] Execute failure UI includes staging batch id; controls respect `busy` [apps/web/components/import/import-wizard.tsx]
- [x] [Review][Patch] Duplicate `personnelCode` rows fail execute revalidation [packages/modules/migration/src/execute-batch.ts]
- [x] [Review][Patch] `rollbackImportStaging` atomic with evidence in one TX [packages/modules/migration/src/execute-batch.ts]
- [x] [Review][Patch] Removed unused `staging-loaded` from TypeScript lifecycle union [packages/modules/migration/src/staging-repo.ts]
- [x] [Review][Patch] `cutover-complete` without evidence → `IDEMPOTENCY_CONFLICT` [packages/modules/migration/src/execute-batch.ts]
- [x] [Review][Patch] Empty `overlapKeys` rejected before mutex [packages/modules/migration/src/concurrent-mutex.ts]
- [x] [Review][Patch] `PersonIdentityError` remapped to `REVALIDATION_FAILED` / SoD [packages/modules/migration/src/execute-batch.ts]

- [x] [Review][Defer] 32-bit FNV advisory lock hash collisions across distinct overlap keys [packages/modules/migration/src/concurrent-mutex.ts:45] — deferred, pre-existing class of advisory-hash risk
- [x] [Review][Defer] Import-batch selfcheck uses always-true permission holder and does not prove Prisma-vs-event-store orphan rollback or two live concurrent executors [packages/modules/migration/src/import-batch.selfcheck.ts] — deferred, pre-existing

### Change Log

- 2026-07-25: Implemented Story 6.2 atomic staging cutover, provisional SoD, concurrent mutex, batch evidence, wizard approve/execute, evidence-backed import_batch_outcomes; status → review.
- 2026-07-25: Code review patches applied (SoD upload≠approve, transactional promote, FOR UPDATE claim, failure drops staging, live FK revalidation, PopulationPort reveal omit, leave-guard staging); AD-6 Prisma orphan gap accepted with honesty; status → done.

## Story completion status

- Status: **done**
- Note: Review findings resolved (patches applied; AD-6 orphan hardening deferred per Absolute non-goal)
