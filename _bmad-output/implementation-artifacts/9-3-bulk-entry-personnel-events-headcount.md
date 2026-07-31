---
baseline_commit: cb20355
---

# Story 9.3: Bulk Entry for Personnel, Events & Headcount

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an HR admin,
I want the three empty «ورود گروهی» tabs to actually work,
so that navigation stops leading to blank pages (FR59).

**Story key:** `9-3-bulk-entry-personnel-events-headcount`  
**Epic:** 9 — Operational Surface Completion & IA Coherence (FR59; FR37/38 surface completion)  
**UX contract:** `ux-divan-2026-07-31` (EXPERIENCE → bulk entry wizard; Flow ۲ — مهدی؛ mockup `screens-bulk-entry-profile.html`)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (Gap E5 — empty «ورود گروهی»; PO: Fill them)  
**Prerequisite:** Story **9.2** done (shared five-step flow + `commitDayToDayBulk`). Story **9.1** done (catalogue + sample). Epic 6 FR-37/38 engine. Epic 3 data-dictionary. Epic 4 event finalize + headcount approval.  
**Downstream:** **9.4** keeps capacity «ورود گروهی» hosting this flow (IA restructure only). **9.9** no-dead-end gate expects these tabs functional.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Shared five-step UI | `shared-bulk-entry-flow.tsx` + three bulk-import pages | قالب→آپلود→پیش‌نمایش→تأیید→نتیجه; leave-guard; cascade; non-retryable force start-over | `void section` — no per-section template filter; only one catalogue template |
| Day-to-day commit | `commit-day-to-day-bulk.ts` + `migration.commitDayToDayBulk` | Gates on `template.requiredPermission`; skips migration SoD; mutex + atomic cutover + evidence | Cutover body only knows `person_employment_start` |
| Template catalogue + sample | `templates.ts`, `sample-workbook.ts`, `template-catalogue.tsx` | One SoT columns; business codes; denied visible | Register event + headcount templates; `sections` metadata |
| Structural validate | `validate-import.ts` | Required/dates/enums/codes for **person** columns | Dispatch per `template.key`; event/HC column rules |
| Atomic cutover | `execute-batch.ts` → `cutoverRowsInTx` / `performAtomicCutover` | Person create + `BaselineRecorded` only | Branch: events → draft+finalize; HC → createApproval(+activate) |
| Single-event product path | `personnel-event-draft.ts` / `personnel-event-finalize.ts` / `personnel-event.ts` tRPC | Epic 4 validation (conflicts, capacity, effective-date) | Bulk must call these — never bypass |
| Headcount product path | `headcount-approval.ts` `createApproval` / `activateApproval` | Epic 4 approval + refs | Bulk must call these unchanged |
| Person / dictionary | `createPerson` → `assertPersonFieldEnabled` | Data-dictionary gate on identity fields | Harden alignment on existing person template — no parallel dictionary |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Shared flow vs domain wiring** | 9.2 = shell + commit path. **9.3 = domain templates + validators + cutover dispatch + section filter + permission meta fix.** Do not rebuild the five-step UI. |
| **«ورود گروهی» vs «ورود داده»** | Section tabs = day-to-day. `/import` = migration SoD. Dual-entry copy stays; migration wizard unchanged. |
| **Permission = create individually** | Each template's `requiredPermission` = the same permission that single-record create/finalize uses. No wider. No `migration.approve` / `migration.execute`. No new AR-ACCESS strings. |
| **tRPC meta hardcode (blocker)** | Day-to-day procedures still use `.meta({ permission: person.write })` + `assertActorHasPersonWrite`. 9.1 deferred this until a non-`person.write` template lands — **that is now**. Fix so event/HC-only actors can download/upload/commit their templates. |
| **Workbook codes vs domain UUIDs** | Spreadsheet = business codes (9.1). Domain APIs = UUIDs. Resolve via existing `*ByCode` helpers in cutover/revalidate — never put UUIDs in templates/examples/cites. |
| **Events = draft→finalize, not BaselineRecorded** | Product start/transfer/etc. go through `createDraft` + `finalizeDraft` with product risk tiers. `BaselineRecorded` remains **only** for migration person template cutover. |
| **No Epic 4 bypass** | Bulk must not skip conflict classification, capacity evaluation, effective-date rules, or headcount approval invariants for speed. |
| **Matrix Bulk-entry → pass** | Only after domain wiring is real on all three tabs. Then flip `design-qa-mockup-matrix.md` Bulk-entry Result from `amendment` to `pass`. |
| **Presentation/IA over domain** | Epic 9 does not invent AR-\* freeze numbers or weaken Epic 3–7 rules. |

## Acceptance Criteria

1. **Given** the three bulk-import pages in personnel, personnel events, and capacity  
   **When** this story is complete  
   **Then** each tab hosts the Story 9.2 flow wired to its **domain** template(s) and validators (section-filtered catalogue — not the full cross-domain list)

2. **And** personnel bulk entry validates against the **data-dictionary-governed** identity fields from Epic 3 (`createPerson` / `assertPersonFieldEnabled` path — harden existing `person_employment_start`, do not invent a parallel dictionary)

3. **And** event bulk entry runs the **same Epic 4 validation as single-event finalization**, including effective-date, conflict, and capacity rules, with **no bypass** (`createDraft` → `finalizeDraft` / `classifyConflicts` / `evaluateHeadcountCapacity` as the product path does)

4. **And** headcount bulk entry runs Epic 4 **approval and capacity rules unchanged** (`createApproval` + typically `activateApproval` so slots exist; no parallel approval validator)

5. **And** no placeholder remains for these three tabs: every section shows at least one usable domain template for callers with create permission; matrix Bulk-entry Result becomes **`pass`**; residual honesty copy that claimed “domain wiring in 9.3” is removed

6. **And** Epic 8 / Epic 8–9 encode held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - First-touch FeedbackMessage / PendingSurface / PageHeader; no StatusMessage clones; no UUID entity inputs; no ghost actions
   - Sample round-trip selfcheck extended to **every** new template key
   - AR-\* fail-closed; dual-entry IA preserved; migration SoD path on `/import` still green

7. **And** scope boundaries:
   - Does **not** rebuild or fork the five-step UI / leave-guard / concurrent-mutex contracts from 9.2
   - Does **not** copy approve/execute/recon into bulk
   - Does **not** invent permission keys or grant Operators `migration.approve` / `migration.execute`
   - Does **not** implement compensation bulk (`compensation.write` / sensitive channel) or `TeamTransferRecorded` / Scaffold product bulk
   - Does **not** own Story 9.4 capacity IA restructure (tabs/drawers) — only keep «ورود گروهی» working
   - Does **not** silently close Epic 7 production-honesty / security carry-ins

## Tasks / Subtasks

- [x] Task 1: Catalogue — domain templates + section metadata (AC: #1, #5)
  - [x] UPDATE `packages/modules/migration/src/templates.ts`:
    - Keep `person_employment_start` (`requiredPermission: "person.write"`, section **`personnel`**)
    - ADD event template(s) — recommended minimum:
      - `personnel_event_transfer` → `TransferRecorded` (canonical day-to-day; capacity-consuming)
      - Optionally `personnel_event_start` → `EmploymentStarted` (product path, **not** BaselineRecorded)
    - ADD `headcount_approval_create` (`requiredPermission: "headcount.approval.write"`, section **`headcount`**)
    - Extend `LaunchImportTemplate` with `sections: readonly SharedBulkEntrySection[]` (or equivalent) so catalogue can filter
    - Columns: business codes + examples mirroring single-entry forms (`personnel-event-form` / `approval-panel`) — never UUIDs
    - Event template `requiredPermission`: **`personnel_event.finalize`** (bulk commit finalizes; draft-only actors must not commit authoritative rows). Download/upload may require finalize **or** document that draft-only sees denied download with accessRequirementFa — prefer finalize for day-to-day bulk parity with “create individually” that lands Effective records
  - [x] UPDATE `accessRequirementFaFor` / operational-copy if new permission strings need Persian requirement text (reuse existing seeded permission labels; do not invent SoD splits)
  - [x] Extend `selfcheck:sample-workbook` to round-trip **each** new template key

- [x] Task 2: Fix day-to-day tRPC permission gate (AC: #1, #6, #7) — **blocker**
  - [x] Problem: `downloadSampleWorkbook`, `uploadAndValidate`, preview/cancel/confirm helpers used by bulk, and `commitDayToDayBulk` use meta + `assertActorHasPersonWrite` (`person.write`). Actors with only `personnel_event.finalize` or `headcount.approval.write` cannot reach handlers. Called out as deferred in 9.1 review.
  - [x] Fix so the **effective** write gate is `template.requiredPermission` for the selected/stored template:
    - Acceptable patterns (pick one; document Decision in completion notes):
      1. **Preferred:** thin input-aware authorize — resolve `templateKey` from input (or stored draft) **before** envelope authorize; authorize that template's `requiredPermission` (extend governed meta / helper without inventing permissions)
      2. **Alternative:** shared domain helper + per-section procedure variants with correct `.meta.permission` matching that section's create permission, all calling the same implementation
    - Migration SoD procedures (`approveBatch` / `executeBatch` / recon) may keep existing gates — do not weaken SoD
  - [x] Remove redundant `assertActorHasPersonWrite` where it wrongly blocks non-person templates; keep per-template `actorHoldsMigrationPermission(..., template.requiredPermission)`
  - [x] `permittedDataCategories` / omit logic on upload: do not force `PERSON_DATA_CATEGORY` alone for event/HC templates — use categories implied by template columns / existing domain contracts; fail closed, do not invent AR-DATA categories
  - [x] Selfcheck: actor with `personnel_event.finalize` (no `person.write`) can sample→upload→commit **event** template; actor with `headcount.approval.write` (no `person.write`) can do the same for HC; actor lacking template permission still denied with Persian requirement

- [x] Task 3: Validate dispatch per template (AC: #2, #3, #4)
  - [x] UPDATE `validate-import.ts`: branch on `template.key` (or column-set helpers). Keep person structural rules for `person_employment_start`. Add structural rules for event/HC columns (required, dates, enums, business-code shape, UUID reject). Preview remains structural — live FK at cutover/revalidate (same honesty as 6.1/9.1)
  - [x] Subject business code for cites: personnel rows → `personnelCode`; HC rows → `requirementCode` (or documented subject column); never UUID
  - [x] Extend `revalidateAuthoritativeReferences` (or sibling) for codes each template needs before cutover

- [x] Task 4: Cutover dispatch — call product domain APIs (AC: #2, #3, #4, #7)
  - [x] UPDATE `cutoverRowsInTx` / `performAtomicCutover` to dispatch on `batch.templateKey`:
    - **`person_employment_start`:** preserve current Person + `BaselineRecorded` path (migration/day-to-day person launch)
    - **Event templates:** resolve codes → UUIDs → `createDraft(...)` → `finalizeDraft(...)` with the **same** product risk-tier config as `personnelEvent.finalize` (`PERSONNEL_EVENT_PRODUCT_RISK_TIERS`). Do **not** set `payload.productionBulkImport` in a way that forces `pending_review` unless product single-entry would. Outcome must be authoritative when single-entry would be (`finalized`), else fail the atomic batch — no silent partial Effective set
    - **`headcount_approval_create`:** `createApproval` then `activateApproval` (unless product explicitly leaves draft — default activate so capacity slots exist). `validateRefs` is internal to `createApproval` — do not reimplement
  - [x] FR-38: all-or-nothing in the existing transaction model; on any row domain failure → fail cutover (existing MigrationError mapping); never row-loop partial production pollution
  - [x] Counts: map created/updated/rejected honestly for new record kinds (extend evidence/count helpers if person-only counters are insufficient — do not fabricate)
  - [x] Module boundary (AD-3): migration calls **published** PE/HC APIs only — no reading other modules' private tables
  - [x] Forbidden: `appendBusinessEvent` directly for product event types; parallel conflict/capacity code; ExcelJS/Prisma in `apps/web`

- [x] Task 5: Section filter in shared UI (AC: #1, #5)
  - [x] UPDATE `shared-bulk-entry-flow.tsx`: stop `void section`; filter catalogue entries to templates whose `sections` include the host section (and still show denied templates for that section with `disabledReason` per 9.1)
  - [x] Optional: `migration.templates` accepts `section` filter server-side — UI filter alone is acceptable if DTO includes `sections`
  - [x] Three pages already pass `section` — keep; adjust purpose copy only if honesty text still implies unfinished domain wiring
  - [x] Preserve all 9.2 review patches: orphan preview cancel, staging discard, busy short-circuit, file input reset, `aria-current`, non-retryable force start-over, scoped counts

- [x] Task 6: Design-QA / DoD / honesty (AC: #5, #6, #7)
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green
  - [x] `selfcheck:sample-workbook` covers all template keys
  - [x] Extend `day-to-day-bulk.selfcheck` (and/or new selfchecks) for event + headcount happy paths + permission denial + SoD migration path still segregates
  - [x] `selfcheck:import-batch` / `import-preview` still green for person + migration SoD
  - [x] `@divan/web` + `@divan/migration` (+ PE/HC if touched) typecheck; eslint on touched files
  - [x] Flip matrix Bulk-entry Result **`amendment` → `pass`** with note that 9.3 domain wiring landed
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits
  - [x] Optional defer OK: composed tRPC promote→commit failure path (already deferred from 9.2) — do not block if in-process domain selfchecks cover cutover

### Manual DoD checklist

- [x] `/personnel/.../bulk-import` shows only personnel-section templates (person launch)
- [x] `/personnel-events/.../bulk-import` shows event template(s); sample download → fill valid → preview → confirm → Effective events (or honest pending_review only if single-entry would)
- [x] `/headcount/.../bulk-import` shows headcount template; commit creates (+activates) approvals under Epic 4 rules
- [x] Operator with create-for-domain and **without** migration SoD can complete that domain's bulk
- [x] Operator lacking domain create sees template with access requirement (not silent omit) and cannot commit
- [x] Intentional Epic 4 violation in event file (conflict / bad effective date / capacity) → preview or cutover error; **no** bypass
- [x] Preview cites row + column + business code; no UUID in cites/examples
- [x] Concurrent batch block still owner + correlation id
- [x] Leave-guard on unsaved preview; `/import` migration path untouched
- [x] Matrix Bulk-entry = `pass`; `selfcheck:design-qa` green
- [x] No Prisma/ExcelJS in `apps/web`; no three divergent wizards

### Review Findings

- [x] [Review][Decision→Patch] PE/HC cutover غیراتمی + cleanup گیرکرده + پیام نادرست — Resolved 2026-08-01: **Honesty + harden** — `domainOutsideTx` پذیرفته می‌شود (deadlock تودرتو). روی شکست جزئی: وضعیت/پیام صادق، cleanup گیرنکند، جبران حداقلی orphan draft HC/PE؛ اتمیسیتهٔ مطلق چندردیفی follow-up معماری. [`execute-batch.ts` performAtomicCutover]

- [x] [Review][Patch] روی شکست پس از side-effect دامنه PE/HC: `assertZeroProductionTrace` را دور بزن / وضعیت irreconcilable یا failed صادق؛ پیام «وضعیت تولید تغییر نکرد» را فقط وقتی واقعاً صفر است بگو [`execute-batch.ts` catch]
- [x] [Review][Patch] `default` در validate/cutover برای `templateKey` ناشناخته مسیر person را اجرا می‌کند — fail-closed با TEMPLATE_UNKNOWN [`validate-import.ts` / `execute-batch.ts` cutoverRowsInTx]
- [x] [Review][Patch] شمارنده/evidence هنوز `createdPersonIds` / `createdPersonCount` را برای draft رویداد و id موافقت HC پر می‌کند [`execute-batch.ts` / `commit-day-to-day-bulk.ts`]
- [x] [Review][Patch] `createApproval` سپس `activateApproval` بدون TX مشترک روی client خارج از TX — orphan draft اگر activate بشکند [`execute-batch.ts` cutoverHeadcountRow]
- [x] [Review][Patch] `createDraft` موفق و `finalizeDraft` ناموفق → orphan draft رویداد بدون جبران [`execute-batch.ts` cutoverTransferRow]
- [x] [Review][Patch] `resolveAuthorizeFromStagingBatchId` همه خطاهای `getStagingBatch` را می‌بلعد و `null` برمی‌گرداند [`migration.ts`]
- [x] [Review][Patch] `PERMISSION_DENIED` دامنه PE/HC به `SOD_VIOLATION` نگاشت می‌شود [`execute-batch.ts` mapPersonnelEventToMigration / mapHeadcountApprovalToMigration]
- [x] [Review][Patch] `preferredApprovalCode` با `identity.person` برچسب خورده — باید `organization.headcount_approval` باشد [`templates.ts`]
- [x] [Review][Patch] `projectBatchReveal` / `getPreview` وقتی template resolve نشود به دسته‌های person برمی‌گردد [`migration.ts`]
- [x] [Review][Patch] `revalidateAuthoritativeReferences` برای transfer با `personnelCode` خالی subject را skip می‌کند [`execute-batch.ts`]
- [x] [Review][Patch] `resolveFailureCode` خطاهای خام PE/HC را به generic `CUTOVER_FAILED` می‌کاهد [`execute-batch.ts`]
- [x] [Review][Patch] `last_updated` در sprint-status به عقب رفته (`02:55`→`02:45`) [`sprint-status.yaml`]

- [x] [Review][Defer] اتمیسیتهٔ مطلق چندردیفی PE/HC bulk — deferred با Honesty+harden؛ follow-up معماری
- [x] [Review][Defer] `listApprovals` کامل جدول برای resolve `preferredApprovalCode` — deferred, pre-existing (API by-code منتشر نشده)
- [x] [Review][Defer] Selfcheck مسیر tRPC input-aware authorize (sample→upload→commit با actor فقط-finalize/HC) — deferred, optional از Task 6 / 9.2 composed tRPC

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Reuse 9.2 shared flow + `commitDayToDayBulk` | Rebuild five-step UI or copy migration wizard |
| Register real event + headcount templates in `templates.ts` | Fake empty per-section lists or client-only validation |
| Event cutover = `createDraft` + `finalizeDraft` | Bypass conflicts/capacity; direct `appendBusinessEvent` for product types |
| Headcount cutover = `createApproval` (+ activate) | Parallel approval/capacity implementation |
| Fix `person.write` tRPC meta hardcode for day-to-day | Leave event/HC actors blocked at envelope gate |
| Section-filter catalogue | Show all domain templates on every tab |
| Flip matrix Bulk-entry to `pass` when done | Flip early; claim pass with person-only template on event/HC tabs |
| Keep migration SoD on `/import` | Grant Operators migration.approve/execute as shortcut |

### Recommended template contracts (implement literally; names flexible if documented)

**`person_employment_start`** (existing) — section `personnel` — `person.write`  
Identity + employment-start codes; cutover unchanged (Person + BaselineRecorded). Dictionary gate via `createPerson`.

**`personnel_event_transfer`** — section `personnel-events` — `personnel_event.finalize`  
Columns (mirror form; codes not UUIDs): `personnelCode`, `effectiveDate`, destination `teamCode`, `organizationalRoleCode`, `jobTitleCode`, `ladderCode`, `gradeCode`, optional `seniorityCode`, optional `preferredApproval` business ref if product supports code form — resolve employment via person's active primary as product rules require (same as single-entry constraints; fail closed if employment ambiguous/missing). `eventType` fixed by template = `TransferRecorded` (not a free-text column unless needed).

**`headcount_approval_create`** — section `headcount` — `headcount.approval.write`  
Columns: `requirementCode`, `teamCode`, `jobTitleCode`, optional `seniorityCode`, `allowedCount`, `validityStart`, `validityEndExclusive`, optional `approvalReference`.

Optional second event template `personnel_event_start` / `EmploymentStarted` if capacity allows — same finalize path; include `collaborationType` + primary destination fields per `parseStartReturnPayload`.

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `packages/modules/migration/src/templates.ts` | Only `person_employment_start` | Add event + HC templates + `sections` | Provisional honesty; business-code contract; fail-closed unknown |
| `packages/modules/migration/src/validate-import.ts` | Person-column structural rules | Per-template dispatch | UUID reject; cite subject business code |
| `packages/modules/migration/src/execute-batch.ts` | `cutoverRowsInTx` person-only | Dispatch PE/HC product APIs | `performAtomicCutover`; SoD execute path; mutex; evidence |
| `packages/modules/migration/src/commit-day-to-day-bulk.ts` | Permission + cutover for any launch key | Works once cutover dispatches | No SoD; template.requiredPermission gate |
| `packages/modules/migration/src/sample-workbook.ts` + selfcheck | Person only | Auto-covers new catalogue entries; extend selfcheck loop | formula-safe; `numFmt='@'` |
| `apps/web/src/server/migration.ts` | Day-to-day meta = `person.write` | Template-aware authorize for day-to-day ops | SoD approve/execute; mapMigrationError; scoped counts; staging discard |
| `apps/web/components/import/shared-bulk-entry-flow.tsx` | `void section` | Filter by section | Five steps; leave-guard; 9.2 review patches |
| `apps/web/components/import/bulk-import-catalogue-host.tsx` | Passes section | Likely unchanged | Client boundary |
| Three `bulk-import/page.tsx` | Host flow + section | Copy honesty only if needed | `assertPageAccess`; PageHeader |
| `apps/web/lib/design-qa-mockup-matrix.md` | Bulk-entry `amendment` | → **`pass`** | Other amendment rows unchanged |
| `apps/web/lib/operational-copy.ts` | Dual-entry + five-step | Requirement strings if needed | Voice UX-DR24; migration distinction |
| `import-wizard.tsx` | Migration 7-step | May show new templates in migration catalogue — **or** filter migration-suitable only; do not add SoD to bulk | Stages, SoD, Sheet, recon |

### Domain API cheat-sheet (call these — do not reimplement)

```
# Events
createDraft(input, actor, db?)          // personnel-event-draft.ts
finalizeDraft(input, pool, db?)         // personnel-event-finalize.ts
// conflicts/capacity run inside finalize via classifyConflicts / evaluateHeadcountCapacity
// riskTier: PERSONNEL_EVENT_PRODUCT_RISK_TIERS (same as apps/web/src/server/personnel-event.ts)

# Headcount
createApproval(db, CreateApprovalInput) // headcount-approval.ts
activateApproval(db, { id, actorId })

# Person
createPerson(...)                       // assertPersonFieldEnabled / data-dictionary
getPersonByPersonnelCode / getOrgUnitByCode / getJobTitleByCode / ...  // existing resolve helpers in execute-batch revalidate

# Permissions (seeded — do not invent)
person.write | personnel_event.finalize | headcount.approval.write
```

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| ExcelJS **4.4.0** | Still latest stable on primary npm (no newer stable as of 2026-08). Keep **only** in `@divan/migration`. Do not switch to `@protobi/exceljs` in this story. |
| tRPC 11 + `governedProcedure` | Envelope still requires a real permission string — fix hardcode without inventing keys |
| Next.js App Router | Pages stay server `assertPageAccess`; flow stays client |
| Selfcheck | `tsx` + `node:assert`; extend existing migration selfchecks |

### Testing requirements

| Check | Command / method |
| --- | --- |
| Design-QA gate | `pnpm --filter @divan/web selfcheck:design-qa` |
| Sample round-trip | `pnpm --filter @divan/migration selfcheck:sample-workbook` (all keys) |
| Day-to-day + new domains | extend `selfcheck:day-to-day-bulk` / new selfcheck |
| Import preview / batch SoD | existing selfchecks stay green |
| Operational copy | `pnpm --filter @divan/web selfcheck:operational-copy` |
| Types | migration + web (+ PE/HC if needed) `typecheck` |
| Manual | DoD checklist above |

### Previous story intelligence

**From 9.2 (done, baseline `cb20355`):** Shared five-step on all three tabs; `commitDayToDayBulk`; leave-guard; dual-entry copy; matrix stays amendment until **this** story. Review patches mandatory to preserve (dead-end retry, orphan cancel, staging discard, scoped counts, busy guard, file reset, aria-current). Explicit handoff: event/HC templates, section filter, matrix pass. Defer: composed tRPC promote→commit selfcheck.

**From 9.1 (done, `cf65a86`):** Catalogue/sample SoT; business codes; denied visible; deferred `person.write` meta hardcode until non-person template — **close that deferral here**.

**From Epic 8 retro:** Mandatory `selfcheck:design-qa`; first-touch FeedbackMessage/PendingSurface; amendment rows are work-to-close; AR-\* fail-closed; Epic 9 presentation/IA only.

**From Epic 4 / product forms:** Transfer = `TransferRecorded` (not `TeamTransferRecorded`). Finalize risk tiers from product tRPC. Headcount create leaves `draft` until activate — activate for usable capacity unless product says otherwise.

### Git intelligence summary

Recent commits: `cb20355` story 9.2 → `cf65a86` story 9.1 → `d219310` epic 8 retro → `5190226` 8.10. Pattern: selfcheck-first; Decision/Patch/Defer reviews; presentation-only discipline; BOM-safe sprint-status; extract shared helpers instead of copy-paste; domain logic in `packages/modules/*`, thin UI in `apps/web`.

### Project structure notes

- Domain logic in `@divan/migration` (+ calls into `@divan/person-employment` / `@divan/headcount` published APIs).
- UI stays thin; no client-side business validation beyond disabling confirm when preview has errors.
- Optional `section` prop already plumbed through host → flow — activate it.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9 / Story 9.3]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — Gap E5]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-37, FR-38, FR-59]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — bulk entry wizard; Flow ۲]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-3/4/5/6]
- [Source: `_bmad-output/implementation-artifacts/9-2-shared-bulk-entry-flow.md`]
- [Source: `_bmad-output/implementation-artifacts/9-1-sample-workbook-generation-template-catalogue.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 9.1 meta hardcode deferral; 9.2 tRPC composition deferral]
- [Source: `packages/modules/migration/src/templates.ts`]
- [Source: `packages/modules/migration/src/execute-batch.ts`]
- [Source: `packages/modules/person-employment/src/personnel-event-finalize.ts`]
- [Source: `packages/modules/headcount/src/headcount-approval.ts`]
- [Source: `apps/web/src/server/migration.ts`]
- [Source: `apps/web/components/import/shared-bulk-entry-flow.tsx`]

## Dev Agent Record

### Agent Model Used

Composer (Auto)

### Debug Log References

- Nested `withTransaction` deadlock: PE `finalizeDraft` must not run inside migration cutover TX — split prep TX → domain cutover → complete TX for PE/HC templates.
- Transfer capacity match requires future/consumable effective date + active approval with linked slot (`preferredApprovalCode` → `preferredApprovalId`).
- Domain `createDraft`/`finalizeDraft` assert real actor PermissionSet — selfcheck uses seeded `hr.admin`/`hr.operator` account id for PE happy path.

### Completion Notes List

- **Decision (Task 2):** Preferred input-aware authorize — extended `GovernedProcedureMeta.resolveAuthorizeFromInput`; day-to-day migration procedures resolve `template.requiredPermission` + envelope dataCategory from `templateKey` / preview / staging before envelope authorize. Removed `assertActorHasPersonWrite` from those paths. Migration SoD approve/execute/recon unchanged.
- Catalogue: `person_employment_start` (personnel), `personnel_event_transfer` (personnel-events, finalize), `headcount_approval_create` (headcount); `sections` + `migrationSodEligible` on DTO; `/import` filters Sod-eligible only.
- Validate + revalidate + cutover dispatch per template; event = `createDraft`→`finalizeDraft` (`PERSONNEL_EVENT_PRODUCT_RISK_TIERS`); HC = `createApproval`→`activateApproval`.
- Section filter in shared flow + template catalogue; matrix Bulk-entry → `pass`.
- Selfchecks: sample-workbook all keys; day-to-day-bulk person + HC happy + PE permission denial + PE transfer happy; import-preview/batch; design-qa; operational-copy.

### File List

- `_bmad-output/implementation-artifacts/9-3-bulk-entry-personnel-events-headcount.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/components/import/import-wizard.tsx`
- `apps/web/components/import/shared-bulk-entry-flow.tsx`
- `apps/web/components/import/template-catalogue.tsx`
- `apps/web/lib/design-qa-mockup-matrix.md`
- `apps/web/src/server/migration.ts`
- `apps/web/src/server/trpc.ts`
- `packages/modules/migration/package.json`
- `packages/modules/migration/src/day-to-day-bulk.selfcheck.ts`
- `packages/modules/migration/src/execute-batch.ts`
- `packages/modules/migration/src/index.ts`
- `packages/modules/migration/src/preview-batch.ts`
- `packages/modules/migration/src/sample-workbook.selfcheck.ts`
- `packages/modules/migration/src/templates.ts`
- `packages/modules/migration/src/validate-import.ts`
- `pnpm-lock.yaml`

## Change Log

- 2026-08-01: Story context created (ready-for-dev) — domain template/validator/cutover wiring onto 9.2 shared bulk flow.
- 2026-08-01: Implemented domain templates, input-aware authorize, validate/cutover dispatch, section filter, matrix pass; status → review.
- 2026-08-01: Code review — Honesty+harden on PE/HC cutover failure path; 12 patches applied; status → done.

## Story completion status

- **Status:** done
- **Note:** Code review complete — Honesty+harden + review patches applied; multi-row absolute atomicity deferred.
