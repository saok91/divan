---
baseline_commit: d219310
---

# Story 9.1: Sample-Workbook Generation & Template Catalogue

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As anyone about to enter data in bulk,
I want a downloadable sample workbook for the template I need,
so that I can prepare a file that is accepted the first time (FR37, FR59).

**Story key:** `9-1-sample-workbook-generation-template-catalogue`  
**Epic:** 9 — Operational Surface Completion & IA Coherence (FR59; FR33/36/37/53 surface completion)  
**UX contract (forward):** `ux-divan-2026-07-31` (EXPERIENCE bulk-entry wizard + IA; mockup `screens-bulk-entry-profile.html`)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (Gap E8 — registry exists, no sample download)  
**Prerequisite:** Epic 8 done (primitives + Story **8.10** `selfcheck:design-qa` gate). Epic 6 template registry / parse / validate / import wizard exist.  
**Downstream:** Story **9.2** shared five-step bulk flow; **9.3** wires three placeholder tabs. This story supplies **sample generation + catalogue substrate** — not the full wizard.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Launch template catalogue | `packages/modules/migration/src/templates.ts` | `LAUNCH_IMPORT_TEMPLATES` + `requireLaunchImportTemplateCatalogue()` / `templateHeaderMap` | No `purposeFa`, `requiredPermission`, `exampleValue`, value-format hints; entity columns still UUID-shaped |
| Parse / validate | `parse-workbook.ts`, `validate-import.ts` | FR-52 reject formulas; structural validators; UUID shape on org/job refs | Must evolve with authoritative definition so sample ↔ validate stay one SoT |
| Formula-safe XLSX/CSV write | `packages/modules/reporting/src/formula-safe-export.ts` | `writeFormulaSafeXlsx` / `writeFormulaSafeCsv` + tab neutralize (CWE-1236) | reporting already depends on migration (`hasFormulaControlPrefix`) — **do not** add reverse dep (cycle). Replicate algorithm inside migration or extract shared helper **into migration** |
| Import wizard | `apps/web/components/import/import-wizard.tsx` + `/import` | identify → validate → preview → confirm; `<select>` of `titleFa` only | No sample download; no purpose/permission catalogue UI |
| Governed tRPC migration | `apps/web/src/server/migration.ts` | `templates` query requires `person.write`; returns key/title/columns | Enrich catalogue DTO; add sample download procedure; denied-template visibility |
| Download UX pattern | `export-artifact-panel.tsx` `downloadBase64File` | Client base64 → file save | Reuse pattern for sample bytes — **not** a parallel ExportArtifact custody SoT |
| Epic 8 primitives | PageHeader, FormLayout, FeedbackMessage, EntityPicker, RowActionButton | Experience foundation | First-touch on every panel this story touches |
| Design-QA gate | `pnpm --filter @divan/web selfcheck:design-qa` | Orchestrates 8.1–8.9 + matrix/checklist/probes | **Mandatory** before claiming this story baseline |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **«ورود داده» vs «ورود گروهی»** | Sidebar `/import` = advanced **migration** wizard (Epic 6). Section tabs «ورود گروهی» = day-to-day bulk (9.2–9.3). Catalogue + sample appear in **both**; copy must keep them distinct. |
| **Sample workbook vs batch commit** | 9.1 = generate/download sample + catalogue. Execute/cutover/atomic commit remain Epic 6 / Story **9.2**. |
| **Authoritative definition** | One registry drives headers, order, value formats, examples, **and** validation. Never hand-maintain a second column list for samples. |
| **Business code vs internal id** | Sample entity columns + documented examples use **business codes** (personnel code, org/job codes). Never UUID in sample cells or headers meant for operators. |
| **Catalogue visibility vs usability** | Templates the caller may not use are **shown** with access requirement — never silently omitted. Download disabled; FeedbackMessage / caption explains permission. |
| **FR-52 sample lifecycle vs 6.5 ExportArtifact** | Samples must be **formula-safe** and **attributable** (template key/version, purpose, actor, access event). Do **not** invent a second queued ExportArtifact custody pipeline for every sample click — reuse neutralization algorithm; thin metadata + envelope; defer full custody/revoke product to existing 6.5 paths. |
| **Amendment vs pass** | Matrix row **Bulk-entry wizard** stays `amendment` until **9.2–9.3**. 9.1 may note catalogue/sample landed; do **not** flip Result to `pass` early. |
| **Presentation/IA over domain** | Epic 9 completes surfaces; do **not** invent AR-MIGRATION freeze numbers, SoD splits, or new permission strings without an existing documented key. |

## Acceptance Criteria

1. **Given** the registered import template definitions  
   **When** an operator requests a sample for a template  
   **Then** the workbook is generated from the **same authoritative definition** used for validation — same columns, same headers, same value formats, same order

2. **And** a downloaded sample, filled with valid values and re-uploaded unchanged in structure, **passes validation**

3. **And** generated workbooks are **formula-safe per FR52** (no `cell.formula` / macros / external links; formula-control prefixes neutralized on write) and follow a **thin FR-52 sample lifecycle**: attributable download (actor, purpose=`sample_workbook`, template key + provisional version/status, classification stated), access-event via existing envelope patterns — **without** forking a parallel ExportArtifact store

4. **And** sample columns that reference entities use **business codes** with a **documented example value**, never internal identifiers (UUID)

5. **And** a template catalogue is visible in **«ورود داده»** and in **each** bulk-entry tab (`/personnel/*/bulk-import`, `/personnel-events/*/bulk-import`, `/headcount/*/bulk-import`), showing template **name**, **purpose**, and **permission required**

6. **And** a template a caller may not use **states its access requirement** rather than being silently absent (download disabled + Persian requirement copy)

7. **And** Epic 8 / Epic 8 retro encode held:
   - `pnpm --filter @divan/web selfcheck:design-qa` stays green
   - First-touch: FeedbackMessage / PageHeader / FormLayout (or Panel) on new catalogue UI; no new `StatusMessage` clones; no raw UUID entity inputs; no ghost row/toolbar actions
   - Matrix amendment rows are work-to-close, not inherited green
   - AR-\* fail-closed; presentation/IA only over unchanged domain cutover rules (live FK still not fabricated in preview)

8. **And** scope boundaries:
   - Does **not** implement the full five-step bulk flow (**9.2**) or replace placeholders with domain-wired commit (**9.3**)
   - Does **not** claim FR-58 product-complete across unfinished IA surfaces
   - Does **not** silently resolve Epic 7 production-honesty / security carry-ins

## Tasks / Subtasks

- [x] Task 1: Authoritative catalogue enrichment + business-code column contract (AC: #1, #4, #7)
  - [x] UPDATE `packages/modules/migration/src/templates.ts`:
    - Extend `ImportTemplateColumn` with `exampleValue: string` (and optional `valueFormatHintFa` if needed for dates/enums)
    - Extend `LaunchImportTemplate` with `purposeFa: string`, `requiredPermission: string` (existing documented permission string — prefer `person.write` / already-seeded keys; **do not invent** AR-ACCESS SoD splits)
    - Evolve entity ref columns from UUID headers (`شناسه تیم`, …) to **business-code** headers/keys aligned with Epic 8 identifier-first language (e.g. team/org/job **codes**). Keep `arMigrationStatus: "provisional-pending-freeze"`.
    - Document that old UUID-header files fail closed (intentional contract evolution — not silent dual accept)
  - [x] UPDATE `validate-import.ts` so structural checks match the new authoritative definition (code-shape for entity refs, not `UUID_RE` for those columns). Live DB FK resolution remains cutover / later stories — do not fabricate production authz.
  - [x] UPDATE `import-preview.selfcheck.ts` golden rows/headers to the new contract; keep formula/macro rejection asserts green.

- [x] Task 2: Sample workbook generation in `@divan/migration` (AC: #1–#4)
  - [x] NEW `packages/modules/migration/src/sample-workbook.ts` (name flexible):
    - `generateSampleWorkbook(templateKey)` → formula-safe **XLSX** Buffer (+ CSV optional if cheap) from `getLaunchImportTemplate`
    - Header row = exact `headerFa` order from template
    - One example data row from each column’s `exampleValue`
    - ExcelJS write: **literal** cells only; neutralize via same rules as `writeFormulaSafeXlsx` (tab prefix + `numFmt='@'` for formula-looking strings); RTL sheet OK
    - **Forbidden:** depend on `@divan/reporting` (cycle). Prefer implementing shared neutralize/write helper in migration and optionally thin-wrapping from reporting later — or duplicate the small neutralize algorithm with a comment pointing at the 6.5 SoT.
  - [x] NEW `sample-workbook.selfcheck.ts`: generate → `parseImportFile` → `validateImportMatrix` → **zero structural errors** on the example row; assert no formula cells in workbook; assert headers === template headers; assert no UUID-shaped example in entity columns.
  - [x] Export from `index.ts`; add `selfcheck:sample-workbook` script on `@divan/migration`.

- [x] Task 3: Governed tRPC — catalogue visibility + sample download (AC: #3, #5, #6)
  - [x] UPDATE `MigrationTemplateEntry` (+ catalogue mapper): `purposeFa`, `requiredPermission`, `callerMayUse: boolean`, `accessRequirementFa: string | null`, column `exampleValue` as needed for UI hints.
  - [x] Change `migration.templates` (or add `migration.templateCatalogue`) so callers who can **see** the surface receive the **full** registered list; set `callerMayUse` from permission check — **do not omit** denied templates.
  - [x] NEW mutation/query e.g. `migration.downloadSampleWorkbook`:
    - Input: `templateKey`
    - Deny download when `!callerMayUse` with Persian access copy (not empty 404 theater)
    - Return `{ fileName, contentBase64, contentType, templateKey, purpose, classificationFa }` (+ any thin lifecycle fields)
    - Emit access/audit via existing governedProcedure / envelope patterns (`operation: "migration.sample_workbook"` or similar)
  - [x] `mapMigrationError` — never leak `error.message`; never map infra to access-denied copy.

- [x] Task 4: UI — shared catalogue + download on ورود داده and bulk tabs (AC: #5–#7)
  - [x] NEW shared component e.g. `apps/web/components/import/template-catalogue.tsx`:
    - Lists name, purpose, permission required
    - «دانلود قالب نمونه» (or operationalCopy key) when `callerMayUse`
    - Denied: show requirement via **FeedbackMessage** (channel per FEEDBACK.md) — no silent hide; no new StatusMessage clone
    - Use PageHeader/section heading patterns already on `/import`; FormLayout/Panel only if it clarifies the identify step — avoid card spam
  - [x] UPDATE `import-wizard.tsx` identify step: mount catalogue + download beside/above template select; keep wizard stages otherwise unchanged.
  - [x] UPDATE three bulk-import pages to host the **same** catalogue component (replace empty-only placeholder chrome). Keep an honest one-liner that full five-step flow arrives in **9.2** — do not fake upload/preview/commit.
  - [x] Reuse `downloadBase64File` pattern (extract shared helper if trivial; do not copy-paste thrice with drift).
  - [x] Add operational-copy keys (download sample, access required, purpose lines, migration vs bulk distinction). Keep `selfcheck:operational-copy` green. Voice: direct Persian; no ceremonial success.

- [x] Task 5: Design-QA / DoD / honesty (AC: #7–#8)
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green
  - [x] `pnpm --filter @divan/migration` sample + import-preview selfchecks green
  - [x] `@divan/web` + migration typecheck; eslint on touched files
  - [x] Optionally annotate `design-qa-mockup-matrix.md` Bulk-entry notes that **catalogue/sample substrate** landed in 9.1 — **Result stays `amendment`** until 9.2–9.3
  - [x] Manual DoD below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits

### Manual DoD checklist

- [x] `/import` identify step shows catalogue (name, purpose, permission) + sample download
- [x] Each of the three «ورود گروهی» tabs shows the same catalogue (not a blank dead end for templates)
- [x] Download XLSX → headers match UI/validation → example row validates on re-upload without structural edits
- [x] Entity example cells are business codes (no UUID)
- [x] Formula/macro-shaped workbook still rejected on upload path; sample itself has no formulas
- [x] Under-permissioned viewer still **sees** template row with access requirement; download blocked with Persian reason
- [x] FeedbackMessage used (no new StatusMessage clone); light/dark readable
- [x] Copy distinguishes «ورود داده» migration wizard from day-to-day «ورود گروهی»
- [x] `selfcheck:design-qa` green; matrix Bulk-entry still `amendment`
- [x] No Prisma in `apps/web`; no `@divan/reporting` → migration dependency cycle
- [x] Sprint/story do **not** claim 9.2 five-step flow or 9.3 domain commit done

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Generate sample from **one** authoritative template definition | Hand-maintained second column list / stale Excel checked into repo |
| Business-code entity columns + documented examples | UUID headers or UUID example cells for selectable entities |
| Catalogue on `/import` **and** all three bulk-import tabs | Catalogue only on migration wizard |
| Show denied templates with access requirement | Silent omit of unauthorized templates |
| Formula-safe write + attributable sample download | `cell.formula`; raw formula-control export; parallel ExportArtifact custody fork |
| `selfcheck:design-qa` green; first-touch FeedbackMessage / layout primitives | New StatusMessage clones; raw UUID inputs; ghost row actions; fake matrix `pass` |
| Keep AR-MIGRATION provisional honesty | Invent signed template freeze / SoD permission matrix |
| Leave 9.2/9.3 ownership explicit | Implement full five-step commit path “while we’re here” |

### UX alignment honesty (Epic 8 retro — AtA doubt)

| Layer | Status | Implication for 9.1 |
| --- | --- | --- |
| Experience foundation (tokens, PageHeader, FormLayout, EntityPicker, GDT, row actions, feedback, operational copy) | Largely delivered on Epic 8 proof surfaces | Consume primitives on first touch |
| Direction A proof screens | Largely on spine | Out of scope unless regression |
| **8.10-A3 amendments** | Bulk wizard → **9.2–9.3**; reports tabs → **9.5**; settings → **10.1–10.2** | 9.1 closes **sample/catalogue substrate** only; do not claim mockup wizard parity |
| Residual Epic 8 hotspots | FeedbackMessage long-tail, typography, sticky thead (A4), hydrate N+1, Button forwardRef | Adopt FeedbackMessage on touched panels; do not expand unrelated hotspots |
| Interactive a11y ceiling | AST + gallery spot-check — **not** full keyboard DoD | Do not over-claim |

**Verdict:** Alignment is strong on foundation + proof set, honestly incomplete where Epics 9–10 own product surfaces, and partially residual on long-tail migration. Spines win; amendments are written.

### Absolute non-goals

- Shared five-step bulk flow, leave-guard `import-preview` wiring for bulk tabs, atomic commit counts → **9.2**
- Domain-complete personnel / events / headcount bulk validators beyond template/sample substrate → **9.3**
- Reports section tabs → **9.5**; personnel-events list `rowActions` → **9.6**; «اصلاح اطلاعات» rename → **9.8**; settings → Epic **10**
- PopulationPort cutover; AD-6 Prisma↔PoolClient; Baseline projector; InferenceBulkPort ops doc; list IDOR narrowing; SoD PermissionSet split; Vitest/ephemeral mandate
- Person-create form dedupe; logout → `requestNavigation` leave-guard (document exemption if untouched)
- Full 6.5 export custody/reauth/revoke product for samples
- Playwright / axe / Vitest harnesses unless PO expands scope

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `packages/modules/migration/src/templates.ts` | One provisional template; UUID entity columns; no purpose/permission/examples | Enrich + business-code contract | `arMigrationStatus` honesty; fail-closed unknown templates |
| `packages/modules/migration/src/validate-import.ts` | UUID_RE on team/role/job/ladder/grade ids | Validate code-shaped entity refs per new headers | Persian row/column cites; no live FK fabrication |
| `packages/modules/migration/src/import-preview.selfcheck.ts` | Golden UUID-shaped happy path | Retarget to business-code examples + sample round-trip hooks | Formula/macro rejection cases |
| `packages/modules/migration/src/index.ts` | Exports parse/validate/preview | Export sample APIs | Module boundary — no web Prisma |
| `apps/web/src/server/migration.ts` | `templates` → key/title/columns; `person.write` gate | Catalogue enrichment + denied visibility + sample download | Existing upload/preview/staging/execute contracts |
| `apps/web/components/import/import-wizard.tsx` | Select-only identify | Mount catalogue + download | Stage machine; leave-guard; preview Sheet |
| `apps/web/app/(app)/personnel/(tabs)/bulk-import/page.tsx` (+ events/headcount siblings) | `SectionTabPlaceholder` + deferral caption | Host shared catalogue; honest 9.2 deferral line | Route access asserts; dual-entry IA |
| `apps/web/lib/operational-copy.ts` (+ selfcheck) | Import/migration strings | Sample/catalogue/access keys | Voice rules UX-DR24 |
| `apps/web/lib/design-qa-mockup-matrix.md` | Bulk-entry `amendment` → 9.2–9.3 | Optional note that 9.1 sample/catalogue landed | Result remains `amendment` |
| `formula-safe-export.ts` | SoT write in reporting | Prefer **no** migration→reporting import; optional later consolidate into migration | Existing export panel behavior |

### Algorithm (implement literally)

1. **Catalogue read:** `requireLaunchImportTemplateCatalogue()` → map each template to UI DTO with `purposeFa`, `requiredPermission`, `callerMayUse = hasPermission(requiredPermission)`, `accessRequirementFa` when denied.
2. **Sample generate:** load template by key → build columns from `headerFa` order → one row of `exampleValue` → formula-safe XLSX buffer → base64 response with filename like `{templateKey}-sample.xlsx`.
3. **Round-trip proof (selfcheck + manual):** buffer → `parseImportFile` → `validateImportMatrix` → no structural errors on example row.
4. **Download deny:** if `!callerMayUse` → TRPC forbidden/bad-request with Persian requirement; UI still lists the row.
5. **Cascade lesson (8.3):** if identify step changes `templateKey`, clear any stale file/preview state already owned by wizard (do not leave dependent upload bound to previous template).

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| ExcelJS **4.4.0** | Already on `@divan/migration` and `@divan/reporting`. Write literals only; never set `cell.formula`. |
| Formula injection | Neutralize leading `= + - @` / tab / CR (OWASP CSV injection / CWE-1236). Prefer existing tab-prefix strategy for consistency with 6.5. |
| tRPC 11 + governedProcedure | Same meta/permission patterns as `migration.templates` / upload. |
| Next.js App Router | Server pages keep `assertPageAccess`; client catalogue is a client component. |
| Selfcheck | `tsx` + `node:assert` — repo standard; no Playwright. |

### Testing requirements

| Check | Command / method |
| --- | --- |
| Design-QA gate | `pnpm --filter @divan/web selfcheck:design-qa` |
| Sample round-trip | `pnpm --filter @divan/migration selfcheck:sample-workbook` (new) |
| Import preview regression | existing `selfcheck:import-preview` |
| Operational copy | `pnpm --filter @divan/web selfcheck:operational-copy` |
| Types | `pnpm --filter @divan/migration typecheck` + `pnpm --filter @divan/web typecheck` |
| Manual | DoD checklist above |

### Previous story intelligence

**From Epic 8 retro (2026-07-31):** Encode mandatory `selfcheck:design-qa`; amendment rows are work-to-close; first-touch EntityPicker / RowActionButton / FeedbackMessage (no UUID inputs, ghost actions, StatusMessage clones). Publish layered UX honesty (foundation pass vs 8.10-A3 vs residual hotspots). Close FeedbackMessage on touched panels. Personnel-events `rowActions` wait for **9.6**. Prefer batched identity DTOs when expanding correction/audit lists (not primary 9.1). AR-\* fail-closed; Epic 9 remains presentation/IA over unchanged domain rules. Carry Epic 7 production-honesty opens without claiming LG-complete.

**From 8.10 (done):** Gate orchestrator is the Epic 9/10 baton. A1/A2 contrast nudges must stay green. A3 owns incomplete bulk/reports/settings. Interactive a11y evidence ceiling = AST + gallery.

**From 8.9:** Operational copy / empty / not-permitted voice; no timestamp-as-deadline; keep operational-copy selfcheck green.

**From 8.3:** Business-code-first identity; cascade clear-on-mode-change; empty vs out-of-scope indistinguishability for pickers.

**From 8.7:** Leave-guard silent-`false` honesty already fixed — if 9.1 adds dirty state, register correctly; download-only should not invent dirty.

**From 6.1 / 6.5:** Reuse AR-MIGRATION-pluggable catalogue + formula reject/literalize + formula-safe write algorithm; dual-entry IA; downloadBase64 pattern from export panel without forking custody SoT.

### Git intelligence summary

Recent commits: `d219310` epic 8 retro → `5190226` story 8.10 → `9df4cc2` 8.9 → feedback/row-action wave. Pattern: selfcheck-first, Decision/Patch/Defer reviews, presentation-only scope discipline, BOM-safe sprint-status edits.

### Project structure notes

- Domain logic in `packages/modules/migration`; UI thin in `apps/web/components/import/*`.
- Do not put ExcelJS in `apps/web`.
- Shared catalogue component must be importable from personnel / personnel-events / headcount tab pages without duplicating permission logic client-side (server DTO carries `callerMayUse`).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9 / Story 9.1]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — Gap E8]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-37 sample workbook; FR-52; FR-59]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — bulk entry wizard]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/screens-bulk-entry-profile.html`]
- [Source: `_bmad-output/implementation-artifacts/epic-8-retro-2026-07-31.md` — create-story encodes]
- [Source: `_bmad-output/implementation-artifacts/8-10-design-qa-consistency-accessibility-gate.md`]
- [Source: `_bmad-output/implementation-artifacts/6-1-controlled-import-wizard-with-preview.md`]
- [Source: `packages/modules/migration/src/templates.ts`]
- [Source: `packages/modules/reporting/src/formula-safe-export.ts`]
- [Source: `apps/web/lib/design-qa-mockup-matrix.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- `getGradeByCode` requires `(ladderId, code)` — cutover revalidation resolves ladder by code first, then grade.
- Sample formula-safe write duplicated neutralize algorithm in migration (no reporting import) to avoid cycle.

### Completion Notes List

- Authoritative catalogue enriched with `purposeFa`, `requiredPermission`, `exampleValue`; entity columns evolved to business-code keys/headers (`teamCode`, …).
- `validate-import` structural checks use business-code shape; old UUID headers fail closed via header mismatch.
- `generateSampleWorkbook` + `selfcheck:sample-workbook` prove round-trip parse/validate with zero structural errors and no formula cells.
- tRPC: `migration.templates` gated by `person.read` for surface visibility; `callerMayUse` / `accessRequirementFa` per template; `migration.downloadSampleWorkbook` (`operation: migration.sample_workbook`) with thin FR-52 lifecycle fields.
- Shared `TemplateCatalogue` on `/import` identify + three bulk-import tabs; `downloadBase64File` extracted to shared helper; FeedbackMessage for access/empty/error.
- `execute-batch` revalidation adapted to `*ByCode` so Epic 6 cutover stays coherent with the new contract.
- `selfcheck:design-qa`, `selfcheck:import-preview`, `selfcheck:sample-workbook`, `selfcheck:migration`, `selfcheck:operational-copy`, migration + web typecheck green. Matrix Bulk-entry Result remains `amendment`.

### File List

- packages/modules/migration/src/templates.ts
- packages/modules/migration/src/validate-import.ts
- packages/modules/migration/src/sample-workbook.ts
- packages/modules/migration/src/sample-workbook.selfcheck.ts
- packages/modules/migration/src/import-preview.selfcheck.ts
- packages/modules/migration/src/import-batch.selfcheck.ts
- packages/modules/migration/src/execute-batch.ts
- packages/modules/migration/src/index.ts
- packages/modules/migration/package.json
- apps/web/src/server/migration.ts
- apps/web/src/server/migration.selfcheck.ts
- apps/web/lib/operational-copy.ts
- apps/web/lib/download-base64-file.ts
- apps/web/lib/design-qa-mockup-matrix.md
- apps/web/components/import/template-catalogue.tsx
- apps/web/components/import/bulk-import-catalogue-host.tsx
- apps/web/components/import/import-wizard.tsx
- apps/web/components/export/export-artifact-panel.tsx
- apps/web/app/(app)/personnel/(tabs)/bulk-import/page.tsx
- apps/web/app/(app)/personnel-events/(tabs)/bulk-import/page.tsx
- apps/web/app/(app)/headcount/(tabs)/bulk-import/page.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/9-1-sample-workbook-generation-template-catalogue.md

## Change Log

- 2026-08-01: Implemented Story 9.1 — sample workbook generation, business-code catalogue contract, governed download, shared catalogue UI on migration + bulk tabs; status → review.
- 2026-08-01: Code review patches applied — denied download disabled control, callerMayUse select/upload gates, seniority revalidation, UUID/digit normalize, sample numFmt + neutralize selfcheck; status → done.

## Story completion status

- **Status:** done
- **Note:** Code review complete; all decision/patch findings applied. Catalogue/sample substrate only; 9.2/9.3 ownership unchanged.

### Review Findings

- [x] [Review][Patch] Denied-template download: render disabled Button with `disabledReason` (not omit) + keep FeedbackMessage [`apps/web/components/import/template-catalogue.tsx:120`] — decided: AC #6 disabled control
- [x] [Review][Patch] Block selecting denied templates in catalogue title click [`apps/web/components/import/template-catalogue.tsx:102`]
- [x] [Review][Patch] Filter `<select>` + default `templateKey` to `callerMayUse` templates [`apps/web/components/import/import-wizard.tsx:117`]
- [x] [Review][Patch] Enforce `template.requiredPermission` on `uploadAndValidate` (not only sample download) [`apps/web/src/server/migration.ts:414`]
- [x] [Review][Patch] Deduplicate `importBulkCatalogueHint` (PageHeader.purpose vs catalogue FeedbackMessage) [`apps/web/app/(app)/personnel/(tabs)/bulk-import/page.tsx:24`]
- [x] [Review][Patch] Force `numFmt='@'` on all sample data cells to reduce Excel coercion [`packages/modules/migration/src/sample-workbook.ts:69`]
- [x] [Review][Patch] Revalidate `seniorityCode` via `getSeniorityByCode` in cutover revalidation [`packages/modules/migration/src/execute-batch.ts:220`]
- [x] [Review][Patch] Identify-step loading/error: replace raw `<p>` with FeedbackMessage [`apps/web/components/import/import-wizard.tsx:318`]
- [x] [Review][Patch] Reject UUID-shaped values (32-hex / hyphenated UUID) in business-code validation [`packages/modules/migration/src/validate-import.ts:118`]
- [x] [Review][Patch] Normalize entity/personnel codes with `toLatinDigits` before shape checks [`packages/modules/migration/src/validate-import.ts:107`]
- [x] [Review][Patch] Guard `downloadBase64File` against empty/invalid base64 [`apps/web/lib/download-base64-file.ts:10`]
- [x] [Review][Patch] `generateSampleWorkbook` unknown-key: Persian/domain error, not English `Error` [`packages/modules/migration/src/sample-workbook.ts:49`]
- [x] [Review][Patch] Selfcheck: cover formula-control-prefix neutralize path in sample write [`packages/modules/migration/src/sample-workbook.selfcheck.ts`]
- [x] [Review][Defer] `downloadBase64File` immediate `revokeObjectURL` / no DOM append — deferred, pre-existing export-panel pattern [`apps/web/lib/download-base64-file.ts:21`]
- [x] [Review][Defer] Catalogue `mapCatalogueEntry` N+1 permission reads — deferred, single template today [`apps/web/src/server/migration.ts:234`]
- [x] [Review][Defer] Wire `selfcheck:sample-workbook` into design-qa / aggregate CI — deferred, story DoD ran it standalone [`packages/modules/migration/package.json`]
- [x] [Review][Defer] Catalogue selection `aria-pressed` / a11y affordance — deferred, interactive a11y ceiling = AST + gallery [`apps/web/components/import/template-catalogue.tsx:94`]
- [x] [Review][Defer] `downloadSampleWorkbook` governed meta hard-codes `person.write` vs future non-write `requiredPermission` — deferred until multi-permission templates exist [`apps/web/src/server/migration.ts:346`]
