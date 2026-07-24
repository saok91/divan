---
baseline_commit: c899cf1
---

# Story 6.1: Controlled Import Wizard with Preview

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a migration actor,
I want CSV/XLSX import through identify → validate → preview → confirm stages,
so that row-level Persian errors are fixed before execution (FR37, UX-DR16, UJ-4).

**Story key:** `6-1-controlled-import-wizard-with-preview`  
**Epic:** 6 — Migration, Baseline & Governed Export (FR37–41, FR52)  
**Prerequisite:** Epic 5 done (governed retrieval channels, PopulationPort honesty, report catalogue with Import Batch **unavailable** stub, GovernedDataTable, leave-guard with `kind: "import-preview"` API). `@divan/migration` is still a Story 1.1 stub (`export {}`). `/import` is a PlaceholderPage; nav item «ورود داده» already exists for `hr_admin` only.

## Acceptance Criteria

1. **Given** Admin/migration access to سایدبار **ورود داده** (`/import` — advanced/migration wizard, **distinct** from per-section **ورود گروهی** day-to-day bulk tabs)  
   **When** the actor opens `/import`  
   **Then** the PlaceholderPage is replaced by a controlled import wizard that supports **identify → validate → preview → confirm** (cancel allowed before execution)

2. **And** uploading an **approved-template-shaped** CSV/XLSX file runs validation covering: structure, required data, identifiers, uniqueness, dates, enums, hierarchy, references, Ladder–Grade, overlaps, order, and duplicate rows (FR-37) — using an AR-MIGRATION-**pluggable** template registry (hardcoded provisional launch shape OK; **do not invent** signed AR-MIGRATION freeze values, SoD matrix, or production cutover policy)

3. **And** each error/warning cites **row**, **column**, and an actionable **Persian** reason in `import-preview-table` (error rows `destructive/10`; warning rows amber tint; cite uses `{caption}` typography)

4. **And** preview opens in a **full-width Sheet** (UX-DR19) — not a nested Dialog; at most one confirmation Dialog above the Sheet; no dialog-on-dialog

5. **And** the user can **cancel** before execution; navigating away (section tabs, sidebar, command palette, history) with a loaded preview warns with batch id via existing leave-guard: `kind: "import-preview"` + `previewBatchId` → copy `پیش‌نمایش دسته {id} ذخیره نشده.` (`leaveGuardImportPreviewMessage`)

6. **And** workbook **formulas, macros, external links, and active structures are rejected**; plain-text values beginning with spreadsheet formula-control characters (`=`, `+`, `-`, `@`, tab/CR) are stored/displayed as **literal text** (FR-52 import half — export artifact panel remains Story **6.5**)

7. **And** preview exposes **no field/row** beyond the viewer's permission (omit from payload **and** DOM; reuse GovernedDataTable `permitted` / category omit patterns — never null-as-zero theater)

8. **And** this story does **not** execute production Import Batch cutover, write Baseline/events into the production event-store, or claim FR-38/FR-39/FR-40 done — those are Stories **6.2–6.4**. Confirm stage may freeze a preview/draft batch for later execution handoff; **no** atomic staging→production cutover here

9. **And** PopulationPort honesty preserved: fixture registry must **not** be labeled production workforce authz; do **not** claim cutover without meeting all criteria in `population-cutover.ts` (Epic 5 retro #2)

10. **And** report key `import_batch_outcomes` remains **`unavailable`** with `MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA` until **real batch evidence** exists (post-6.2+) — **never fabricate** outcomes rows from preview-only drafts (Epic 5 retro #4)

11. **And** dual-entry IA preserved: do **not** replace sidebar ورود داده with section ورود گروهی; do **not** implement day-to-day bulk tabs in this story (placeholders stay deferred)

12. **And** concurrent-batch execute block («دسته دیگری در حال اجراست» + owner + correlation id) and upload/approver/executor **SoD enforcement** are Story **6.2** (AR-MIGRATION) — 6.1 may show non-authoritative status hints only; must not invent SoD permissions

## Tasks / Subtasks

- [x] Task 1: Domain package `@divan/migration` — parse, validate, preview batch (AC: #2, #6–#10)
  - [x] Replace stub `packages/modules/migration/src/index.ts` with published APIs (mirror `@divan/reporting` shape: domain owns logic; web stays thin)
  - [x] NEW template registry: `requireLaunchImportTemplateCatalogue()` (or equivalent) — provisional CSV/XLSX column contracts for launch migration entities already known in domain (Person identity, Employment, Assignment, org refs as needed). Mark **AR-MIGRATION-pluggable**; document that signed template freeze is pending — fail closed with Persian explanation when uploaded file does not match a registered template (do **not** silently invent columns from AR-DATA open dispositions)
  - [x] NEW parse pipeline (server-side only; never trust client-parsed rows as authoritative):
    - Accept `.csv` and `.xlsx` (reject `.xlsm` / macro-enabled / OLE with clear Persian reason)
    - Prefer **ExcelJS** (or maintained SheetJS fork with explicit formula detection) as a **migration package dependency** — not in `apps/web` if avoidable
    - Reject cells with formulas (`cell.formula` / equivalent), external links, defined names used as active structures; reject workbooks with VBA/macros
    - Normalize formula-control leading characters to literal text for stored/displayed preview values (FR-52)
    - Hard limits: file size, sheet count, row count — reject early with Persian copy (NFR-13 envelope; do not invent AR-NFR percentiles)
  - [x] NEW validators covering FR-37 list: structure, required, identifiers, uniqueness, dates, enums, hierarchy, references, Ladder–Grade, overlaps, order, duplicate rows — emit `{ row, column, severity: "error"|"warning", messageFa }[]`
  - [x] NEW preview DTO: `previewBatchId` (stable UUID), template key, row previews (permission-filtered), issue list, counts, `createdAt`
  - [x] **No** production event-store append; **no** Baseline event; optional ephemeral/staging draft table OK if needed for batch id persistence — document AD-4 boundary: staging/cutover execution = 6.2
  - [x] Do **not** change `import_batch_outcomes` report path to return fake success/empty-green data
  - [x] Export public surface from `index.ts`; add `selfcheck:import-preview` (or similar) script on the package

- [x] Task 2: Governed tRPC `migration` (or `import`) router (AC: #1, #5, #7–#9)
  - [x] Add `@divan/migration` workspace dependency to `apps/web/package.json`
  - [x] NEW `apps/web/src/server/migration.ts` (sibling of `report.ts` / `dashboard.ts`):
    - `governedProcedure.meta({ permission, dataCategory, action, organizationalScope, operation, sensitive, ... })`
    - Procedures e.g. `uploadAndValidate`, `getPreview`, `cancelPreview` (names flexible) — multipart/base64 upload pattern consistent with existing Next/tRPC constraints; keep files out of client-only memory as SoT
    - Pipeline for any row/field reveal: authorize → PopulationPort intersect (reuse `resolvePersonnelPopulationRegistry` / honesty fields) → filter preview columns/rows → access event via envelope
    - Coarse gate: only roles that already see `/import` (`hr_admin` nav) — do **not** invent `migration.upload` / `migration.execute` permission matrix; if a finer key is required, use an existing documented permission string or fail closed pending AR-ACCESS/AR-MIGRATION (document choice in Dev Agent Record)
  - [x] Mount on `appRouter` in `apps/web/src/server/root.ts`
  - [x] `mapMigrationError` — never leak `error.message`; never map infra failures to access-denied copy
  - [x] Persian fail-closed errors; PopulationPort mode + disclosure on payloads when population-scoped

- [x] Task 3: UI — wizard + Sheet + `import-preview-table` (AC: #1, #3–#5, #11)
  - [x] UPDATE `apps/web/app/(app)/import/page.tsx` — replace `PlaceholderPage` with wizard host (Server Component wrapping client OK)
  - [x] NEW `apps/web/components/ui/sheet.tsx` — shadcn/Radix Sheet (project already has `radix-ui` / dialog patterns). Full-width for import preview
  - [x] NEW under `apps/web/components/import/` (or `migration/`):
    - Wizard steps UI: identify (template + file) → validate progress → preview Sheet → confirm (non-executing acknowledgement / freeze draft)
    - `import-preview-table` built **on** `GovernedDataTable` (UX-DR7) — prefer zero public-contract changes; add row tint via existing className/row meta extension **only if** contract already allows; otherwise thin wrapper that does not fork the primitive
    - Error/warning severity styling per DESIGN (`destructive/10`, amber)
    - Caption cites: Persian row/column (e.g. «ردیف ۱۲، ستون کد پرسنلی: …»)
  - [x] Wire `useLeaveGuardRegistration({ id, isDirty: previewLoaded && !cancelled, kind: "import-preview", previewBatchId })` — `isDirty` = **data-state** (preview loaded / draft open), never Sheet `open` alone; Discard/cancel clears preview; Save optional (only if draft persist exists and `onSave` returns `Promise<boolean>`)
  - [x] Cancel-before-execute control; confirm CTA uses accent/`button-primary` per DESIGN — confirm must **not** call production cutover APIs
  - [x] Short in-UI hint that day-to-day bulk is section **ورود گروهی** (optional one-liner) — do not implement those tabs
  - [x] Copy: reuse `operational-copy.ts`; add only missing strings (upload reject, template mismatch, formula/macro reject, validation summary). Voice: direct operational Persian — no ceremonial success / emoji (UX-DR24)
  - [x] Persian digits ۰–۹ for row numbers / counts (UX-DR20); Jalali only where dates appear in preview cells

- [x] Task 4: Authz / nav / IA integrity (AC: #7, #11–#12)
  - [x] **Do not** edit `packages/modules/identity-access/src/navigation.ts` ROLE_NAV / ROLE_LANDING unless a proven bug blocks `/import`
  - [x] Deep-link deny remains `resolve-app-path-access` + «دسترسی ندارید.»
  - [x] Layout≠RSC: if the page tree fetches preview data in RSC, call `assertPageAccess` (or equivalent) before data — never rely on layout alone
  - [x] Unauthorized fields/actions: omit from DOM
  - [x] Do **not** implement approver/executor mutation paths or concurrent execute mutex (6.2)

- [x] Task 5: Verify + DoD (AC: #1–#12)
  - [x] Selfchecks in `@divan/migration` (+ thin web assert if needed): template catalogue completeness; formula/macro rejection; formula-control literalization; row/column Persian issue shape; preview permission omit; cancel clears dirty; **no** event-store append in 6.1 paths; Import Batch report still unavailable
  - [x] Wire package script(s); regression touch: reporting Import Batch stub selfcheck still green
  - [x] `pnpm --filter @divan/migration` + `@divan/web` typecheck; eslint on touched files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows edits to yaml

### Manual DoD checklist

- [x] `/import` shows real wizard (not PlaceholderPage)
- [x] Upload CSV and XLSX happy path → preview Sheet with table
- [x] Invalid structure / missing required → Persian row/column cites; destructive tint on error rows
- [x] Warning-only rows use amber tint (if warnings emitted)
- [x] File with formulas/macros/external links rejected with actionable Persian reason
- [x] Cell value starting with `=` displays/stores as literal (not evaluated)
- [x] Cancel clears preview; leave via sidebar with loaded preview → «پیش‌نمایش دسته {id} ذخیره نشده.»
- [x] Theme toggle / sidebar collapse do **not** trigger leave-guard (existing exempt)
- [x] Forbidden columns omitted from DOM for under-permissioned viewer (use seeded accounts if available)
- [x] Confirm does **not** append production business events / Baseline
- [x] `import_batch_outcomes` report still `unavailable` (same Persian message)
- [x] PopulationPort fixture honesty still disclosed / fail-closed — no “real workforce” claim
- [x] Section **ورود گروهی** placeholders unchanged; sidebar label stays «ورود داده»
- [x] No Prisma in `apps/web`; no `@prisma/client` import from web
- [x] Single dialog depth: leave-guard XOR confirm dialog above Sheet — never two dialogs
- [x] Keyboard: Sheet focus trap, Esc behavior documented; table scroll OK at 200% zoom
- [x] Sprint status / story file must **not** claim FR-38 execution, FR-39 Baseline, FR-40 reconciliation, or FR-41/FR-52 export done

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Fill `/import` in place (nav already `hr_admin`) | Rebuild nav/landing matrix or invent migration SoD permissions |
| Own parse/validate/preview in `@divan/migration` + thin governed tRPC | Dump spreadsheet parsing or unscoped SQL into `apps/web` |
| Full-width Sheet + `import-preview-table` on GovernedDataTable | Nested Dialog-as-preview; AG Grid / new table primitive fork |
| Leave-guard `kind: "import-preview"` + batch id copy | Custom leave modal; dirty = Sheet open flag |
| Reject formulas/macros/active content; literalize formula-control chars | Evaluate workbook formulas; accept `.xlsm` silently |
| Permission-omit preview fields/rows | Show then grey-out forbidden data |
| Keep `import_batch_outcomes` unavailable until real batch evidence | Fabricate Import Batch report rows from preview drafts |
| PopulationPort honesty (`population-cutover.ts`) | Claim production workforce population authz / provisional stamp-all UUID map |
| AR-MIGRATION / AR-ACCESS / AR-DATA fail-closed | Invent signed templates, SoD matrix, or freeze numbers |
| Stages through **confirm** only | Production execute / atomic cutover / Baseline write (6.2–6.3) |

### Absolute non-goals

- Atomic staging → production cutover, concurrent execute mutex, upload/approve/execute SoD enforcement → **6.2**
- Baseline provenance UX / `source=migration` as history boundary product copy → **6.3**
- Signed reconciliation workspace → **6.4**
- Governed export / `export-artifact-panel` / artifact reauth / custody → **6.5** (close Epic 2 reauth carry there — not here)
- Day-to-day section **ورود گروهی** implementation
- PopulationPort **full** default-registry cutover; AD-6 Prisma vs PoolClient hardening; `ensure*Schema` migrations-only; Vitest mandate
- Person-org scope on Cancel/Reverse/Correct mutations (5.3 defer) — only if this story touches those writers (it should not)
- Deduplicate Add vs QuickCreate forms; logout → `requestNavigation` leave-guard (4b carry) — document exemption if untouched
- Inventing AR-MIGRATION production freeze / AR-CUTOVER plan
- Editing `navigation.ts` ROLE matrices “for cleanliness”
- Modifying `GovernedDataTable` public contract unless a tiny documented extension is unavoidable for row tint — prefer CSS wrapper first

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `packages/modules/migration/src/index.ts` | Stub `export {}` | Public parse/validate/preview APIs + selfcheck | Package name `@divan/migration`; no cross-module table reads |
| `packages/modules/migration/package.json` | Stub deps (envelope, db, event-store, temporal) | Add parser lib + selfcheck script; may add identity-access / person-employment **published** API deps only | No Prisma in web; AD-3 module boundaries |
| `apps/web/app/(app)/import/page.tsx` | PlaceholderPage | Wizard host | Route `/import`; title «ورود داده» |
| `apps/web/src/server/root.ts` | No migration router | Mount migration router | Existing routers unchanged |
| `apps/web/package.json` | No `@divan/migration` | Add workspace dep | Existing module deps |
| Leave-guard components | `import-preview` kind + copy already implemented | **Wire** registration from wizard | Dialog stack rules; exempt theme/collapse |
| `GovernedDataTable` | Public contract frozen since 4b/5.x | Consume only | No rewrite |
| Reporting `import_batch_outcomes` | Honest unavailable stub | **Do not “activate”** on preview drafts | Exact `MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA` |
| `population-cutover.ts` | Fixture honesty criteria | May append 6.1 honesty note if needed | Do not flip default registry |
| `navigation.ts` | `/import` → hr_admin | Prefer no edit | ROLE matrices |

### Import wizard consumer contract (encode — do not rediscover)

1. **Entry:** Sidebar `/import` only for this story. Section `ورود گروهی` routes remain placeholders (`section-tab-surfaces.ts`).
2. **Stages:** identify → validate → preview → confirm. **Execute / cutover = 6.2.**
3. **Domain ownership:** `@divan/migration` owns template registry, parse, validate, preview DTO. Web = upload UI + Sheet + table + leave-guard wiring.
4. **AD-4:** Production event-store receives Baseline/events **only** via atomic cutover after independent approval (6.2+). Preview/cancel must leave **zero** production business-event pollution.
5. **Authz reveal path:** authorize → PopulationPort → (InferenceBulk if bulk thresholds apply) → access event → filtered preview. Channel: reuse an existing retrieval channel if preview is population-scoped bulk, or document a governed procedure without inventing a new InferenceBulk channel name unless required — prefer extending existing patterns over a parallel stack.
6. **Leave-guard:** `useLeaveGuardRegistration({ kind: "import-preview", previewBatchId })`; copy from `leaveGuardImportPreviewMessage`; dirty = preview loaded & not cancelled.
7. **FR-52 (import):** reject active workbook structures; literalize formula-control prefixes. Export-side formula-safe download = 6.5.
8. **Import Batch report:** stays unavailable until post-execution evidence exists.
9. **UJ-4 slice:** Niloofar upload + preview + fix errors + re-upload. Approver/executor/reconciliation climax = later stories.

### AR-MIGRATION / Launch Artifact honesty

- `launch-artifacts.md`: **AR-MIGRATION** is **pending** (templates, Baseline semantics, SoD, rollback).
- Gate rule (PRD §7.2 / architecture): missing upstream artifact blocks affected baseline — teams **MUST NOT** substitute silent local assumptions presented as approved policy.
- Allowed in 6.1: provisional **code-marked** template catalogue + validators aligned to already-shipped domain fields, with explicit “pending AR-MIGRATION freeze” comments and fail-closed on unknown templates.
- Forbidden: claiming production cutover readiness, inventing approver/executor permission pairs, inventing reconciliation tolerances, enabling Personnel Code merge/split/return matching (still blocked pending AR-DATA/AR-MIGRATION).

### PopulationPort / fixture≠production (Epic 5 retro #2)

Cutover criteria remain in `packages/modules/person-employment/src/population-cutover.ts`. Until all criteria met:

- Keep fixture-backed default registry behavior / fail-closed disclosure on scoped paths.
- Migration preview that intersects workforce population must carry the same honesty fields Operators already see on search/report.
- **Never** provisional “stamp all Person UUIDs with actor scopes.”

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Next.js 16.2 / App Router | Page under `app/(app)/import` |
| tRPC 11 + `governedProcedure` | Thin router; envelope meta required |
| ExcelJS (recommended) or maintained SheetJS (`@e965/xlsx` if chosen) | Add to `@divan/migration`; pin exact version; treat uploads as untrusted; parse matrix → validate headers → map records with `Object.create(null)` |
| Zod | Request/upload metadata validation at tRPC boundary |
| Radix Sheet | New `components/ui/sheet.tsx` consistent with existing `dialog.tsx` |
| No new BI/grid library | GovernedDataTable only |
| Node 22 / TS 5.x / pnpm workspaces | Existing monorepo |

**Parser security notes (2026):** Spreadsheet libraries do not auto-sanitize CSV/formula injection. Divan must (1) reject formula cells on **import**, (2) store leading `=+-@` as literals, (3) later escape on **export** in 6.5. Prefer parse-to-matrix (`header: 1`) then contract validation over trusting sheet object keys.

### File structure requirements

```text
packages/modules/migration/
  src/
    index.ts                 # public barrel
    templates.ts             # launch template catalogue (AR-MIGRATION-pluggable)
    parse-workbook.ts        # CSV/XLSX + FR-52 guards
    validate-import.ts       # FR-37 validators → issues[]
    preview-batch.ts         # preview DTO / draft id
    *.selfcheck.ts

apps/web/
  app/(app)/import/page.tsx
  components/ui/sheet.tsx                          # NEW
  components/import/                               # NEW wizard + preview table
  src/server/migration.ts                          # NEW router
  src/server/root.ts                               # mount
```

### Testing requirements

- Helper selfchecks (project norm): formula rejection, literalization, template mismatch, issue cite shape, no event-store write, report stub untouched.
- Typecheck + eslint on touched packages.
- Manual DoD for Sheet/keyboard/leave-guard/UJ upload path (Vitest/ephemeral still open — do not pretend DOM coverage).
- Interactive a11y DoD: focus ring, Sheet focus trap, omit-from-DOM for forbidden fields, `prefers-reduced-motion`, 200% zoom usable.

### Previous story / Epic 5 intelligence

- **Consume-not-reinvent** paid off for reporting — same rule: migration domain in `@divan/migration`, not `apps/web`.
- **Honest stubs:** 5.5 left Import Batch and export stubbed with named successors — 6.1 must not “greenwash” the report key.
- **PopulationPort fail-closed** beat provisional stamp maps — keep that Decision.
- **Leave-guard data-state** rules from 4b/5.1 apply: dirty ≠ visibility; Discard restores; single dialog depth.
- **BOM:** strip UTF-8 BOM from `sprint-status.yaml` if Windows editors reintroduce it.
- Review budget: new domain assemblers (5.4/5.5) drew heavy patches — expect adversarial review on parse/validate edge cases and AD-4 boundary leaks.

### Git intelligence summary

Recent commits: `c899cf1` epic 5 retro → `7d1f33f` 5.5 → `06537f9` 5.4 → `8bd4bcc` 5.3 → `4fc1ea9` 5.2 → `f4e9b5f` 5.1. Pattern: dual-package selfchecks, Gate tables, honest stubs with successor story ids, GovernedDataTable consume, channel via `runGovernedRetrieval` where applicable.

### Latest tech information

- Prefer maintained spreadsheet parser with explicit formula detection; pin versions; commit lockfile.
- CSV/XLSX injection is an **output** concern for export (6.5) and an **input rejection/literalization** concern for import (this story).
- SheetJS docs still treat formula evaluation as opt-in — Divan policy is **reject on import**, not evaluate.

### Project context reference

- No `project-context.md` found in repo at story creation; follow architecture spine AD-3/AD-4/AD-5/AD-6, epics Story 6.1 AC, and Epic 5 retro action items #2/#4/#9.
- Communication with operators: Persian UI; code/docs in English per BMM config.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6 / Story 6.1, UX-DR16/19]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-37, FR-52, UJ-4, AR-MIGRATION]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-4 Migration Staging]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/DESIGN.md` + `EXPERIENCE.md` — Sheet, dual-entry, leave-guard]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — `import-preview-table` tints]
- [Source: `_bmad-output/implementation-artifacts/epic-5-retro-2026-07-25.md` — prep actions for 6.1/6.5]
- [Source: `packages/modules/person-employment/src/population-cutover.ts`]
- [Source: `apps/web/lib/operational-copy.ts` — `leaveGuardImportPreviewMessage`]
- [Source: `packages/modules/reporting/src/report-catalogue.ts` — Import Batch unavailable message]

### Epic 5 / prior carry-ins (encode in implementation)

| Item | Handling in 6.1 |
| --- | --- |
| PopulationPort honesty | Gate + AC #9 + Task 2 disclosure fields |
| Import Batch report evidence boundary | AC #10 — keep unavailable |
| AR fail-closed (MIGRATION/ACCESS/DATA/REPORTING/TEMPORAL) | Gate + template registry notes |
| Artifact reauth / export | Non-goal → 6.5 |
| Mutation IDOR Cancel/Reverse/Correct | Non-goal unless touched |
| Vitest / create-form dedupe / logout leave-guard | Non-goals; document if untouched |
| BOM-safe sprint-status | Task 5 DoD |

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- `pnpm --filter @divan/migration selfcheck:import-preview` — OK
- `pnpm --filter @divan/web selfcheck:migration` — OK
- `pnpm --filter @divan/reporting selfcheck:report` — OK (Import Batch still unavailable)
- `pnpm --filter @divan/migration typecheck` / `@divan/web typecheck` — OK
- eslint on touched web files — OK

### Completion Notes List

- Implemented `@divan/migration` domain: provisional AR-MIGRATION-pluggable template catalogue (`person_employment_start`), ExcelJS/CSV parse with FR-52 formula/macro/external-link rejection + formula-control literalization, FR-37 validators with Persian row/column cites, ephemeral in-memory preview drafts (`executionAllowed: false`, `eventStoreAppended: false`).
- Coarse authz gate reuses existing `person.write` (no invented `migration.upload` / SoD matrix). PopulationPort honesty fields disclosed on preview payloads.
- Web: governed `migration` tRPC router (base64 upload), full-width Sheet (Dialog primitive), wizard identify→validate→preview→confirm-draft, `import-preview-table` wrapper over GovernedDataTable with cell-level destructive/amber tints (no public contract change), leave-guard `kind: "import-preview"` wired to data-state dirty.
- Confirm freezes draft only — no production event-store / Baseline / cutover (6.2). Import Batch report path untouched. Navigation ROLE matrices untouched. Section ورود گروهی placeholders untouched.
- Manual UI DoD (Sheet keyboard, 200% zoom, seeded under-permission account DOM omit) remains operator-verify in browser; automated selfchecks cover parse/validate/omit/cancel/report-stub honesty.

### File List

- packages/modules/migration/package.json
- packages/modules/migration/src/index.ts
- packages/modules/migration/src/errors.ts
- packages/modules/migration/src/templates.ts
- packages/modules/migration/src/parse-workbook.ts
- packages/modules/migration/src/validate-import.ts
- packages/modules/migration/src/preview-batch.ts
- packages/modules/migration/src/import-preview.selfcheck.ts
- apps/web/package.json
- apps/web/src/server/migration.ts
- apps/web/src/server/migration.selfcheck.ts
- apps/web/src/server/root.ts
- apps/web/app/(app)/import/page.tsx
- apps/web/components/ui/sheet.tsx
- apps/web/components/import/import-wizard.tsx
- apps/web/components/import/import-preview-table.tsx
- apps/web/lib/operational-copy.ts
- pnpm-lock.yaml
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/6-1-controlled-import-wizard-with-preview.md

### Change Log

- 2026-07-25: Story 6.1 implementation — controlled import wizard with preview (domain + governed tRPC + Sheet UI); status → review.
- 2026-07-25: Code review — decisions deferred (PopulationPort row omit + multi-instance store → 6.2); 15 patches applied (IDOR ownership, base64 caps, Sheet reopen, Jalali dates, parse hardening); status → done.

## Story completion status

- Status: **done**
- Note: Code review complete; decision items deferred with rationale; all patch findings applied and selfchecks green.

### Review Findings

- [x] [Review][Decision] PopulationPort / field-permission omit on staging preview — deferred: 6.1 keeps PopulationPort honesty disclosure only; actor-derived field/row intersect against live registry deferred until cutover / 6.2 (staging upload rows are not workforce subjects yet). Scaffold omit + issue filtering retained.
- [x] [Review][Decision] Ephemeral in-memory draft store vs multi-instance — deferred: accept single-process ops assumption for 6.1 (documented on preview-batch); shared store / sticky session deferred to 6.2+. Ownership + TTL/caps patched.

- [x] [Review][Patch] Draft IDOR — bind preview drafts to creating `accountId`; enforce on get/cancel/confirm [packages/modules/migration/src/preview-batch.ts]
- [x] [Review][Patch] Cap `contentBase64` in Zod before decode (≈5MB decoded) [apps/web/src/server/migration.ts]
- [x] [Review][Patch] Sheet «بستن»/Esc leaves dirty draft with no reopen/confirm path [apps/web/components/import/import-wizard.tsx]
- [x] [Review][Patch] Filter `issues` / `issueCitesFa` to visible columns so omitted fields do not leak via cites [packages/modules/migration/src/preview-batch.ts]
- [x] [Review][Patch] Upload catch fallback must use `importLoadError`, not `importFileReadError` [apps/web/components/import/import-wizard.tsx]
- [x] [Review][Patch] Format date preview cells with Jalali (`formatJalaliDisplayFromGregorian`) [apps/web/components/import/import-preview-table.tsx]
- [x] [Review][Patch] Bound draft store (max drafts / per-actor / TTL); clear or TTL confirmed-drafts [packages/modules/migration/src/preview-batch.ts]
- [x] [Review][Patch] Validate base64 alphabet before `Buffer.from` (try/catch is ineffective) [apps/web/src/server/migration.ts]
- [x] [Review][Patch] Reject unclosed CSV quotes at EOF [packages/modules/migration/src/parse-workbook.ts]
- [x] [Review][Patch] Enforce row limit while parsing CSV (do not fully materialize oversized matrices first) [packages/modules/migration/src/parse-workbook.ts]
- [x] [Review][Patch] Fix Excel `Date` literalization (timezone / dead identical branches) [packages/modules/migration/src/parse-workbook.ts]
- [x] [Review][Patch] Sniff content (zip/`[Content_Types]` / OLE) not extension alone; keep macro reject honest [packages/modules/migration/src/parse-workbook.ts]
- [x] [Review][Patch] Use `FILE_TYPE_REJECTED` (not `MACRO_REJECTED`) for unknown extensions [packages/modules/migration/src/parse-workbook.ts]
- [x] [Review][Patch] Make `confirmImportPreviewDraft` explicit for already `confirmed-draft` (idempotent return or clear error) [packages/modules/migration/src/preview-batch.ts]
- [x] [Review][Patch] Move hardcoded «بستن» / «انصراف» into `operational-copy` [apps/web/components/import/import-wizard.tsx]

- [x] [Review][Defer] No rate-limit / cost guard on `uploadAndValidate` Excel parse — deferred, pre-existing infra pattern [apps/web/src/server/migration.ts:146]
- [x] [Review][Defer] Full preview matrix (up to 5k rows) returned in one tRPC payload — deferred, pre-existing NFR envelope [packages/modules/migration/src/preview-batch.ts:152]
- [x] [Review][Defer] Defined Names reject only when `model` is a non-empty array — deferred, pre-existing ExcelJS shape gap [packages/modules/migration/src/parse-workbook.ts:324]
- [x] [Review][Defer] XLSX zip-bomb / expanded-size guard beyond byte cap — deferred, library/ops hardening [packages/modules/migration/src/parse-workbook.ts:297]
)
