---
baseline_commit: cf65a86
---

# Story 9.2: Shared Bulk-Entry Flow

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator permitted to create records one at a time,
I want the same bulk path in every section,
so that entering forty records does not mean forty forms (UX-DR35, FR37, FR59).

**Story key:** `9-2-shared-bulk-entry-flow`  
**Epic:** 9 — Operational Surface Completion & IA Coherence (FR59; FR33/36/37/53 surface completion)  
**UX contract:** `ux-divan-2026-07-31` (EXPERIENCE → Component Patterns → bulk entry wizard; Flow ۲ — مهدی؛ mockup `screens-bulk-entry-profile.html`)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (Gap E5 — empty «ورود گروهی»; PO decision: Fill them)  
**Prerequisite:** Story **9.1** done (catalogue + sample workbook). Epic 6 FR-37 engine (`uploadAndValidate` / preview / staging / execute / concurrent-mutex). Epic 8 primitives + `selfcheck:design-qa`.  
**Downstream:** Story **9.3** wires per-domain templates/validators (events, headcount) onto this shared flow. **9.4** keeps capacity «ورود گروهی» tab hosting the same flow.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Template catalogue + sample | `template-catalogue.tsx`, `bulk-import-catalogue-host.tsx`, `migration.downloadSampleWorkbook` | Step «قالب» substrate on three tabs + `/import` | Host must become step 1 of a five-step flow — not catalogue-only |
| Import wizard (migration) | `import-wizard.tsx` + `/import` | 7-step identify→…→approve→execute→result; Sheet preview; leave-guard; SoD | **Do not copy** approve/recon UI into bulk. Extract shared helpers (file→base64, upload error map) if needed; keep migration wizard intact |
| `ImportPreviewTable` | `import-preview-table.tsx` | GovernedDataTable + severity tint + issue cites | Mount inline in bulk step 3 (Sheet optional; UX prefers inline five-step) |
| FR-37 engine | `@divan/migration` parse/validate/preview-batch/staging/execute | Structural validate; ephemeral preview; durable staging; atomic cutover; evidence | Need a **day-to-day commit** path gated by `template.requiredPermission` — not `migration.approve` / `migration.execute` SoD |
| Concurrent mutex | `concurrent-mutex.ts` + `importConcurrentBatchMessage` | «دسته دیگری در حال اجراست» + owner + correlation id | Inherit unchanged on bulk commit |
| Leave-guard | `useLeaveGuardRegistration` `kind: "import-preview"` | Cites `previewBatchId` | Wire on unsaved bulk preview (`status === "preview"`) |
| Epic 8 primitives | PageHeader, FeedbackMessage, PendingSurface, Button `disabledReason` | Experience foundation | First-touch on every new bulk surface |
| Design-QA gate | `pnpm --filter @divan/web selfcheck:design-qa` | Orchestrator + matrix | Mandatory; Bulk-entry matrix stays `amendment` until **9.3** completes domain wiring |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **«ورود گروهی» vs «ورود داده»** | Section tabs = day-to-day bulk (this story). Sidebar `/import` = advanced **migration** wizard (Epic 6). Copy must state the difference both ways. Neither UI may look like the other. |
| **Five steps vs seven** | Bulk: قالب → آپلود → پیش‌نمایش و خطاها → تأیید → نتیجه. Migration keeps identify/validate/preview/confirm/**approve**/execute/result + recon. |
| **Permission scope (FR-59)** | Whoever may **create** that record individually (`template.requiredPermission`, today `person.write`) may run bulk for that template — **and no wider**. Do **not** require `migration.approve` / `migration.execute` for day-to-day commit. Do **not** invent new permission strings. |
| **Migration SoD vs day-to-day** | SoD (upload≠approve≠execute) stays on `/import` cutover. Day-to-day commit is a **separate entry mode** that reuses parse/validate/atomic-write/evidence/mutex but skips migration SoD + reconciliation workspace. |
| **Shared flow vs domain wiring** | 9.2 = reusable shell + commit path proven on the **existing** launch template (`person_employment_start`). 9.3 = additional domain templates/validators for events & headcount + remove any remaining honesty placeholders. |
| **Business code in errors** | Preview cites: row number + column name + **subject business code** when present — never UUID (FR-57 / UX-DR35). |
| **Atomic result counts** | Result step reports **created / updated / rejected** (FR-38 / UX). Map from evidence + row outcomes; do not invent fake counts. |
| **Amendment vs pass** | Matrix row **Bulk-entry wizard** stays `amendment` until **9.3**. 9.2 may note shared flow landed; do **not** flip Result to `pass` early. |
| **Presentation/IA over domain** | Epic 9 does not invent AR-MIGRATION freeze numbers or change Epic 3–7 domain rules. |

## Acceptance Criteria

1. **Given** the FR37 import engine and `import-preview-table`  
   **When** the shared bulk-entry flow is implemented  
   **Then** every «ورود گروهی» tab (`/personnel/*/bulk-import`, `/personnel-events/*/bulk-import`, `/headcount/*/bulk-import`) hosts **one** inline five-step flow: قالب → آپلود → پیش‌نمایش و خطاها → تأیید → نتیجه

2. **And** the flow is **permission-scoped** so every role that may create a record individually (`template.requiredPermission`) may also create it in bulk, and **no wider** — day-to-day commit must succeed for a seeded operator with create permission **without** `migration.approve` / `migration.execute`

3. **And** preview errors cite **row number**, **column name**, and the **business code of the subject** when available, never an internal identifier

4. **And** commit is **atomic per FR38** and the result reports **created**, **updated**, and **rejected** counts

5. **And** the concurrent-batch block message, owner, and correlation id rules from Epic 6 are inherited unchanged (`MSG_CONCURRENT_BATCH_FA` / `importConcurrentBatchMessage`)

6. **And** an unsaved preview (`status === "preview"`) triggers the leave-guard citing the batch (`kind: "import-preview"`, `previewBatchId`)

7. **And** copy distinguishes this day-to-day path from the sidebar migration wizard, and neither is presented as the other (update/replace the 9.1 “story 9.2 will complete…” deferral hint)

8. **And** Epic 8 / Epic 8 retro encode held:
   - `pnpm --filter @divan/web selfcheck:design-qa` stays green
   - First-touch: FeedbackMessage / PendingSurface / PageHeader; no new `StatusMessage` clones; no raw UUID entity inputs; no ghost row/toolbar actions
   - Matrix Bulk-entry Result remains `amendment` until 9.3
   - AR-\* fail-closed; presentation/IA only over unchanged domain cutover rules

9. **And** scope boundaries:
   - Does **not** replace or regress the `/import` migration wizard (approve/execute/recon remain)
   - Does **not** add events/headcount domain templates or Epic 4 event/headcount validators — that is **9.3**
   - Does **not** claim FR-58 product-complete across unfinished IA surfaces
   - Does **not** silently resolve Epic 7 production-honesty / security carry-ins

## Tasks / Subtasks

- [x] Task 1: Day-to-day bulk commit API (AC: #2, #4, #5, #9)
  - [x] NEW domain helper in `@divan/migration` (name flexible, e.g. `commit-day-to-day-bulk.ts` / extend execute with `entryMode: "day_to_day"`):
    - Input: confirmed preview/staging identity + actor
    - Gate: actor holds **`template.requiredPermission` only** — assert via existing permission holder; **skip** `assertMigrationApprovePermission` / `assertMigrationExecutePermission` / same-actor SoD for this mode
    - Reuse: overlap mutex (`acquireOverlapLocks`), atomic write path that today backs `executeImportBatch` cutover for the launch template, evidence write
    - Output: `{ created, updated, rejected, evidence?, correlationId?, … }` — map matched→updated; structural/revalidation failures that abort or skip rows→rejected; never partial production pollution (FR-38 atomicity)
    - Concurrent conflict: throw existing `CONCURRENT_BATCH` with `formatConcurrentBatchMessage` unchanged
  - [x] NEW tRPC mutation e.g. `migration.commitDayToDayBulk` (operation name flexible):
    - `governedProcedure` meta permission = create permission already used for upload (today `person.write`) + re-check `template.requiredPermission`
    - Orchestrate: ensure draft confirmed/staging ready → day-to-day commit → return counts for UI
    - `mapMigrationError` — never leak `error.message`; concurrent message stays Persian with owner + correlation id
  - [x] Selfcheck: operator-shaped actor with `person.write` (no migration SoD perms) can commit a valid sample-shaped batch; concurrent lock still blocks; migration `/import` SoD path still rejects same-actor approve+execute
  - [x] **Forbidden:** granting Operators `migration.approve`/`migration.execute` as a shortcut; inventing new AR-ACCESS permission keys; calling recon workspace from bulk UI

- [x] Task 2: Shared five-step UI component (AC: #1, #3, #6, #7, #8)
  - [x] NEW `apps/web/components/import/shared-bulk-entry-flow.tsx` (name flexible):
    - Steps (labels via `operationalCopy` — add five-step keys distinct from migration seven-step labels where needed): قالب | آپلود | پیش‌نمایش و خطاها | تأیید | نتیجه
    - Step قالب: mount existing `TemplateCatalogue variant="bulk"` (download sample); selecting a denied template stays blocked per 9.1 patches
    - Step آپلود: file input + upload via existing `migration.uploadAndValidate` (reuse `fileToBase64` / `uploadErrorMessage` patterns from wizard — extract shared util if drift risk)
    - Step پیش‌نمایش: **inline** `ImportPreviewTable` + `issueCitesFa`; enhance cites if needed so subject **business code** appears (extend `formatImportIssueCite` or UI caption — never UUID)
    - Step تأیید: confirm action → day-to-day commit mutation (may internally confirmDraft + commit); block confirm when error-severity rows remain (fail closed)
    - Step نتیجه: show created / updated / rejected (Persian digits); optional background toast with batch link if commit is async — only if engine actually backgrounds; do not fake toast
    - `PendingSurface` / FeedbackMessage for upload/commit pending & errors
    - `useLeaveGuardRegistration`: dirty when preview `status === "preview"`; `kind: "import-preview"`; `previewBatchId`; `onDiscard` → `cancelPreview` + local reset
    - Cascade: changing `templateKey` clears file + preview (8.3 lesson)
  - [x] Do **not** mount `MigrationReconciliationWorkspace`, approve/execute SoD dialogs, or seven-step chrome

- [x] Task 3: Mount on all three bulk-import tabs (AC: #1, #7)
  - [x] UPDATE `bulk-import-catalogue-host.tsx` → host `SharedBulkEntryFlow` (or replace with thin page mount)
  - [x] UPDATE three pages under `personnel` / `personnel-events` / `headcount` `(tabs)/bulk-import/page.tsx`:
    - Keep `assertPageAccess` + PageHeader title «ورود گروهی»
    - Purpose copy = day-to-day vs migration distinction (**remove** “جریان پنج‌مرحله‌ای… در داستان ۹٫۲” deferral)
    - Mount shared flow once — optional `section` prop for future 9.3 template filter; 9.2 may show all usable launch templates (currently one)
  - [x] UPDATE `operational-copy.ts` (+ selfcheck): five-step labels, result count labels, day-to-day purpose lines, concurrent reuse; keep migration wizard hints pointing to section tabs

- [x] Task 4: Preview cite + result honesty (AC: #3, #4)
  - [x] Ensure issue list shown to operators includes subject business code when the row has `personnelCode` (or template subject column) — update `formatImportIssueCite` and/or preview response projection
  - [x] Result UI binds only to server-returned counts; zero is allowed; never fabricate updated/rejected

- [x] Task 5: Design-QA / DoD / honesty (AC: #8–#9)
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green
  - [x] migration selfchecks: import-preview, sample-workbook, import-batch (SoD still green), **new** day-to-day commit selfcheck
  - [x] `@divan/web` + `@divan/migration` typecheck; eslint on touched files
  - [x] Annotate `design-qa-mockup-matrix.md` Bulk-entry notes: shared five-step flow landed in 9.2 — **Result stays `amendment`** until 9.3
  - [x] Manual DoD below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits

### Manual DoD checklist

- [x] All three «ورود گروهی» tabs show the same five-step flow (not catalogue-only)
- [x] Seeded operator with create (`person.write`) and **without** migration SoD can upload sample → preview → confirm → see counts
- [x] Seeded account lacking create cannot commit; denied templates still visible with requirement (9.1)
- [x] Preview errors show row + column + business code; no UUID in cites
- [x] Concurrent execute block still shows owner + correlation id (force overlap if feasible in selfcheck)
- [x] Navigate away with open unsaved preview → leave-guard cites batch id
- [x] `/import` still shows seven-step migration path + recon; copy says bulk lives in section tabs
- [x] Bulk copy says migration wizard is «ورود داده» — not the same path
- [x] FeedbackMessage / PendingSurface used; no StatusMessage clone; light/dark readable
- [x] `selfcheck:design-qa` green; matrix Bulk-entry still `amendment`
- [x] No Prisma in `apps/web`; no ExcelJS in web; no reporting↔migration cycle
- [x] Sprint/story do **not** claim 9.3 domain event/headcount bulk done

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| One reusable five-step component on all three bulk tabs | Three divergent wizard copies |
| Day-to-day commit gated by `template.requiredPermission` | Require `migration.approve` / `migration.execute` for Operators |
| Reuse FR-37 parse/validate/preview + `ImportPreviewTable` + mutex + FR-38 atomicity | Parallel Excel parser / fake client-side validation / non-atomic row loop |
| Leave-guard on unsaved preview citing batch | Dirty=false while preview open; dialog-open-only dirty |
| Distinct copy from `/import` migration wizard | Present bulk as “the migration tool” or remove dual-entry |
| `selfcheck:design-qa` green; first-touch FeedbackMessage / PendingSurface | StatusMessage clones; UUID inputs; ghost actions; early matrix `pass` |
| Keep migration SoD path working on `/import` | Break approve≠execute segregation while “simplifying” |
| Leave 9.3 domain templates explicit | Implement events/headcount validators “while we’re here” |

### Day-to-day commit algorithm (implement literally)

1. **Upload/preview:** existing `uploadAndValidate` → ephemeral preview (same as migration identify/validate/preview). Permission = create + `template.requiredPermission`.
2. **Confirm intent (UI step تأیید):** call server orchestration that (a) `confirmImportPreviewDraft` + promote staging if not already, (b) runs **day-to-day commit** without SoD approve/execute gates.
3. **Commit body:** acquire overlap locks → revalidate → atomic append/write in one transaction → evidence with counts → release. On lock conflict → concurrent Persian message unchanged.
4. **Counts:** `created` = new subjects/records; `updated` = matched existing updated; `rejected` = rows not applied (pre-commit error rows should already block confirm; commit-time revalidation failures count as rejected or fail the whole batch per FR-38 — prefer **all-or-nothing** atomic failure with clear message over silent partial apply).
5. **Cancel/discard:** `cancelPreview` + clear local state; leave-guard `onDiscard` uses same path.
6. **Migration path untouched:** `approveBatch` / `executeBatch` / recon remain SoD-gated for `/import` only.

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `apps/web/components/import/bulk-import-catalogue-host.tsx` | Catalogue-only host | Host shared five-step flow | Client boundary; no server secrets |
| `apps/web/app/(app)/*/bulk-import/page.tsx` (×3) | PageHeader + catalogue + 9.2 deferral purpose | Mount flow; update purpose copy | `assertPageAccess`; dual-entry IA |
| `apps/web/components/import/import-wizard.tsx` | Full migration 7-step | Optional extract shared file/base64 helpers only | Stages, SoD, Sheet, recon, leave-guard |
| `apps/web/src/server/migration.ts` | upload/confirm/approve/execute | Add day-to-day commit procedure | Existing migration contracts + catalogue/sample |
| `packages/modules/migration/src/execute-batch.ts` (and/or NEW sibling) | SoD execute only | Factor shared atomic write usable by day-to-day mode **or** dedicated commit that reuses mutex/evidence | SoD asserts on migration execute path |
| `packages/modules/migration/src/validate-import.ts` | `formatImportIssueCite` row+column | Include subject business code when present | Fail-closed UUID; no live FK invent |
| `apps/web/lib/operational-copy.ts` | Deferral hint for 9.2 | Five-step + result + dual-entry copy | Voice UX-DR24; migration strings |
| `apps/web/lib/design-qa-mockup-matrix.md` | Bulk-entry `amendment` → 9.2–9.3 | Note 9.2 shared flow landed | Result remains `amendment` until 9.3 |
| `apps/web/components/import/template-catalogue.tsx` | Works in bulk+migration | Reuse as step 1 | Denied visibility + disabledReason patches from 9.1 review |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| ExcelJS **4.4.0** | Still latest stable on npm (no newer stable as of 2026-08). Used only inside `@divan/migration` for sample/parse — **not** in `apps/web`. |
| tRPC 11 + governedProcedure | Same meta/envelope patterns as `uploadAndValidate`; new operation id for day-to-day commit |
| Next.js App Router | Server pages keep `assertPageAccess`; flow is a client component |
| Leave-guard | Data-state dirty only; never Dialog-open alone (Epic 4b lesson) |
| Selfcheck | `tsx` + `node:assert` — repo standard; no Playwright mandate |

### Testing requirements

| Check | Command / method |
| --- | --- |
| Design-QA gate | `pnpm --filter @divan/web selfcheck:design-qa` |
| Sample round-trip | `pnpm --filter @divan/migration selfcheck:sample-workbook` |
| Import preview | `selfcheck:import-preview` |
| Import batch / SoD | `selfcheck:import-batch` (migration path still segregates) |
| Day-to-day commit | new `selfcheck:…` proving create-perm commit without SoD |
| Operational copy | `pnpm --filter @divan/web selfcheck:operational-copy` |
| Types | migration + web `typecheck` |
| Manual | DoD checklist above |

### Previous story intelligence

**From 9.1 (done, baseline `cf65a86`):** Catalogue + sample on all bulk tabs; business-code columns; `callerMayUse` / denied download disabledReason; upload gated by `template.requiredPermission`; FeedbackMessage on identify; matrix Bulk-entry stays `amendment`. Explicitly deferred five-step flow + leave-guard bulk wiring + atomic commit counts to **this story**. Review patches: do not omit denied controls; cascade clear on template change; no UUID examples; `numFmt='@'` on sample cells.

**From Epic 8 retro:** Mandatory `selfcheck:design-qa`; first-touch FeedbackMessage / PendingSurface; amendment rows are work-to-close; AR-\* fail-closed; Epic 9 presentation/IA only. Open: FeedbackMessage long-tail, typography hotspots, personnel-events `rowActions` → 9.6, Button forwardRef if needed.

**From 6.1 / 6.2:** Dual-entry IA; `ImportPreviewTable`; concurrent mutex message contract; SoD on migration path only; PopulationPort honesty disclosure on preview payloads — keep disclosing, do not fabricate production authz.

**From 8.3 / 8.7:** Cascade clear dependents; leave-guard silent-`false` honesty — register dirty correctly for preview.

### Git intelligence summary

Recent commits: `cf65a86` story 9.1 → `d219310` epic 8 retro → `5190226` story 8.10 → `9df4cc2` 8.9 → `0d23b6c` 8.8. Pattern: selfcheck-first, Decision/Patch/Defer reviews, presentation-only scope discipline, BOM-safe sprint-status edits, extract shared UI helpers instead of copy-paste.

### Project structure notes

- Domain logic stays in `packages/modules/migration`; UI thin in `apps/web/components/import/*`.
- Shared flow must be importable from all three section tab pages without duplicating permission logic client-side (server DTO + mutations enforce).
- Optional `section?: "personnel" | "personnel-events" | "headcount"` prop prepares 9.3 filtering — do not invent fake empty template lists per section in 9.2.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9 / Story 9.2; UX-DR35]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — Gap E5; UX-DR35; Fill them]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-37, FR-38, FR-59]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — bulk entry wizard; Flow ۲]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/screens-bulk-entry-profile.html`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-4 migration staging]
- [Source: `_bmad-output/implementation-artifacts/9-1-sample-workbook-generation-template-catalogue.md`]
- [Source: `_bmad-output/implementation-artifacts/6-1-controlled-import-wizard-with-preview.md`]
- [Source: `apps/web/components/import/import-wizard.tsx`]
- [Source: `apps/web/src/server/migration.ts`]
- [Source: `packages/modules/migration/src/sod.ts`]
- [Source: `packages/modules/migration/src/concurrent-mutex.ts`]
- [Source: `apps/web/lib/design-qa-mockup-matrix.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Fixed pre-existing `isPool` mis-detection in audit-envelope (`PoolClient.connect` treated as Pool) which blocked all cutover selfchecks with "Client has already been connected".
- Extracted shared `performAtomicCutover` for migration SoD execute and day-to-day commit.

### Completion Notes List

- Day-to-day commit (`commitDayToDayBulk`) gates on `template.requiredPermission` only; skips migration.approve/execute SoD and recon gate; reuses mutex + atomic cutover + evidence; returns created/updated/rejected.
- tRPC `migration.commitDayToDayBulk` confirms draft + promotes staging + commits; mapMigrationError preserves concurrent Persian message.
- Shared five-step UI on all three bulk tabs; leave-guard on unsaved preview; cascade clear on template change; FeedbackMessage/PendingSurface first-touch.
- `formatImportIssueCite` includes subject business code when present (never UUID).
- Matrix Bulk-entry remains `amendment` until 9.3; design-qa / typecheck / selfchecks green.

### File List

- packages/modules/migration/src/commit-day-to-day-bulk.ts
- packages/modules/migration/src/day-to-day-bulk.selfcheck.ts
- packages/modules/migration/src/execute-batch.ts
- packages/modules/migration/src/validate-import.ts
- packages/modules/migration/src/index.ts
- packages/modules/migration/package.json
- packages/kernel/audit-envelope/src/evaluation-snapshot.ts
- packages/kernel/audit-envelope/src/audit-trust-gate.ts
- apps/web/src/server/migration.ts
- apps/web/components/import/shared-bulk-entry-flow.tsx
- apps/web/components/import/bulk-import-catalogue-host.tsx
- apps/web/components/import/import-wizard.tsx
- apps/web/lib/import-file.ts
- apps/web/lib/operational-copy.ts
- apps/web/lib/operational-copy.selfcheck.ts
- apps/web/lib/design-qa-mockup-matrix.md
- apps/web/app/(app)/personnel/(tabs)/bulk-import/page.tsx
- apps/web/app/(app)/personnel-events/(tabs)/bulk-import/page.tsx
- apps/web/app/(app)/headcount/(tabs)/bulk-import/page.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/9-2-shared-bulk-entry-flow.md

## Change Log

- 2026-08-01: Story context created (ready-for-dev) — shared five-step bulk flow over FR-37 with day-to-day commit permission model.
- 2026-08-01: Implemented shared five-step day-to-day bulk flow + commit API; status → review.
- 2026-08-01: Code review patches applied (dead-end retry, preview orphan cancel, staging leave/discard, scoped counts, busy guard, file input reset, aria-current); status → done.

## Story completion status

- **Status:** done
- **Note:** Code review complete — all patch findings applied; one defer retained

### Review Findings

- [x] [Review][Patch] Failed cutover leaves same-preview retry as a dead end — `promoteConfirmedDraftToStaging` returns the existing failed staging by `preview_batch_id`; `commitDayToDayBulk` then rejects non-`confirmed-draft`; UI Confirm still retries the same id. Force start-over (clear + new upload) on non-retryable commit errors. [`apps/web/components/import/shared-bulk-entry-flow.tsx` / `packages/modules/migration/src/staging-repo.ts:183`]
- [x] [Review][Patch] Re-upload / template change orphans prior preview draft — `onUpload` and `onSelectTemplate` do not `cancelPreview` the previous `previewBatchId` before replacing mutation data. Cancel prior draft (best-effort) before new upload or template cascade. [`apps/web/components/import/shared-bulk-entry-flow.tsx:116`]
- [x] [Review][Patch] Leave/discard ignores durable staging created inside confirm/commit — tRPC promotes staging before cutover; leave-guard is only `kind: "import-preview"` and `clearLocal` only cancels the ephemeral draft (unlike `import-wizard` staging path). Track/promote-aware discard or rollback non-terminal staging on discard/failure. [`apps/web/components/import/shared-bulk-entry-flow.tsx:89` / `apps/web/src/server/migration.ts:758`]
- [x] [Review][Patch] Result counts ignore population-scoped evidence filtering — `created`/`updated`/`rejected` are returned unfiltered while `evidence` passes `filterEvidenceRecordIds`; org-scoped operators can see counts that do not match visible record IDs. Derive response counts from the filtered evidence (or otherwise keep counts honest to the reveal). [`apps/web/src/server/migration.ts:777`]
- [x] [Review][Patch] Confirm handler lacks busy short-circuit — button is `disabled={busy}` but `onConfirmCommit` only guards `previewBatchId`/`hasErrors`; double-click can fire a second mutation before pending flips. Add `if (busy) return` (and prefer disabling retry after non-retryable errors). [`apps/web/components/import/shared-bulk-entry-flow.tsx:136`]
- [x] [Review][Patch] File input DOM value not cleared on template/reset — `setFile(null)` does not reset the `<input type="file">` value; stale filename can remain visible after cascade/`clearLocal`. [`apps/web/components/import/shared-bulk-entry-flow.tsx:72`]
- [x] [Review][Patch] Step indicator lacks `aria-current` — five step labels render equally with no current-step semantics. [`apps/web/components/import/shared-bulk-entry-flow.tsx:156`]
- [x] [Review][Defer] Day-to-day selfcheck never exercises composed tRPC promote→commit failure/retry path [`packages/modules/migration/src/day-to-day-bulk.selfcheck.ts`] — deferred, pre-existing domain-selfcheck pattern; story DoD covered in-process commit
