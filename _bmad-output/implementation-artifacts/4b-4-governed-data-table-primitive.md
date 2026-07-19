---
baseline_commit: 348b246
---

# Story 4b.4: Governed Data Table Primitive

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer of list surfaces,
I want a shared `governed-data-table` primitive,
so that Epic 5+ lists share filter/sort/snapshot/a11y behavior (UX-DR7).

## Acceptance Criteria

1. **Given** the shared UI component library in `apps/web`  
   **When** `governed-data-table` is rendered with demo or fixture rows  
   **Then** it is full-width and compact; supports per-column **enum multi-select** (Excel-like) and **text typeahead** (substring) filters

2. **And** header sort exposes `aria-sort`; pagination uses a **stable query snapshot** with **deterministic ordering**  
   **And** any filter or sort change creates a **new snapshot** and resets **page to 1**; result count is announced via a **polite live region**

3. **And** sticky **RTL identifier** column (`sticky start-0` / inline-start) and sticky **row-actions** column (`sticky end-0` / inline-end) remain visible during horizontal scroll **inside the table container** (not page-level)

4. **And** columns the caller lacks permission for are **omitted from the DOM** (not rendered disabled/hidden)

5. **And** empty state shows «نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.» with «پاک کردن فیلترها» resetting to **section defaults** (not “clear everything to blank”)

6. **And** AG Grid is **not** used; infinite scroll is **not** used  
   **And** Epic 5.1 may replace fixture data with permission-safe personnel queries **without changing the primitive contract**

## Tasks / Subtasks

- [x] Task 1: shadcn Table primitive + tokens wiring (AC: #1, #3, #6)
  - [x] Add shadcn Table: `npx shadcn@latest add table` → `apps/web/components/ui/table.tsx` (new-york style; match existing `components.json`)
  - [x] Prefer adding `checkbox` (and reuse existing `popover` + `input` + `button`) for enum multi-select popover — **do not** add AG Grid, `@tanstack/react-table`, or a new `packages/ui`
  - [x] Consume existing DESIGN tokens already in `globals.css` from 4b.1: `--filter-row-height` (36px), `--table-row-compact` (40px), caption-scale headers (`text-caption` / 12px)
  - [x] Table chrome: `w-full`; row height ≈ `h-table-row-compact` / `min-h-[var(--table-row-compact)]`; filter row ≈ `h-filter-row-height`
  - [x] Horizontal scroll **only** on an inner container (`overflow-x-auto`); page/body must not gain horizontal scroll from the table
  - [x] Scroll container: when content overflows horizontally, ensure keyboard reachability (`tabIndex={0}` on the scroll region when overflowed is acceptable — prior spine keyboard note)

- [x] Task 2: `GovernedDataTable` public contract + snapshot engine (AC: #1, #2, #4, #6)
  - [x] Create `apps/web/components/governed-data-table/` (preferred) or single `governed-data-table.tsx` plus colocated helpers:
    - `index.tsx` / `governed-data-table.tsx` — presentational shell
    - `use-governed-table-snapshot.ts` (or pure `snapshot.ts`) — filter → sort → page math
    - `types.ts` — column/row/filter types
    - Fixture demo module (see Task 4)
  - [x] **Public contract (lock — Epic 5.1 must not break this):**
    ```ts
    type FilterKind = "text" | "enum";
    type GovernedColumn<T> = {
      id: string;
      header: string;                 // Persian label
      accessor: (row: T) => string | number | boolean | null | undefined;
      filter?: FilterKind;
      enumOptions?: { value: string; label: string }[]; // required when filter === "enum"
      sortable?: boolean;
      sticky?: "identifier" | "actions"; // at most one of each
      permitted?: boolean;            // default true; false → omit from DOM
      /** Optional cell renderer; default stringifies accessor */
      cell?: (row: T) => React.ReactNode;
    };
    type GovernedDataTableProps<T> = {
      columns: GovernedColumn<T>[];
      rows: T[];                      // caller-supplied; fixture OK in 4b.4
      getRowId: (row: T) => string;
      /** Section defaults restored by «پاک کردن فیلترها» */
      sectionDefaultFilters: Record<string, string | string[]>;
      pageSize?: number;              // default 25 (reasonable desktop density)
      toolbar?: React.ReactNode;      // title / primary CTA slot — caller owns
      rowActions?: (row: T) => React.ReactNode; // sticky end column when provided
      /** Optional export affordance — wire only when permitted; no panel in 4b.4 */
      exportSlot?: React.ReactNode;
      "aria-label": string;           // table accessible name (Persian)
    };
    ```
  - [x] **Permission omit:** never render column header, filter control, or cells when `permitted === false`; strip that column’s filter/sort from active state if it becomes omitted (no sensitive values in URL — do not put filter state in the query string in 4b.4)
  - [x] **Text filter:** substring match (casefold + digit-normalize via existing `normalizeDigitsForMatch` / `toLatinDigits` where useful); debounce ~200–300ms
  - [x] **Enum filter:** multi-select; **empty selection = no filter** (same as «همه») — never silently zero rows without empty-state CTA; apply on selection change (no debounce)
  - [x] **Sort:** clickable header when `sortable`; cycle none → asc → desc → none (or none → asc → desc); set `aria-sort="none"|"ascending"|"descending"` on the active sort column only; others omit or `none`
  - [x] **Snapshot:** on any filter/sort change: bump snapshot identity, recompute filtered+sorted list, **pageIndex = 0** (display page ۱)
  - [x] **Pagination:** page buttons / prev-next; **no infinite scroll**; deterministic tie-break: primary sort then `getRowId` ascending so equal keys stay stable
  - [x] **Counts:** visible result count with `formatPersianInteger`; polite `aria-live="polite"` region announces count on filter/sort/page-size-affecting changes (reuse command-palette live-region pattern)
  - [x] Extract pure functions (`applyFilters`, `applySort`, `paginate`) so a small `*.selfcheck.ts` can assert snapshot/page-reset/omit without a browser

- [x] Task 3: Empty state, clear-filters, a11y DoD (AC: #5; UX floor)
  - [x] Add `operationalCopy.clearFilters = "پاک کردن فیلترها"` (exact EXPERIENCE CTA)
  - [x] Reuse `operationalCopy.emptySearch` for empty body copy (already exact)
  - [x] Empty UI: message + button that resets filters to **`sectionDefaultFilters`** (not `{}`)
  - [x] Filter inputs: each labeled by column (`aria-label` / `<label>` tied to column header text)
  - [x] Keyboard: rows focusable (`tabIndex={0}` on `tr` or row container); visible focus ring; ArrowUp/ArrowDown move row focus within current page (Enter action optional — leave profile navigation to consumers)
  - [x] Row actions always visible (not hover-only) when `rowActions` provided
  - [x] Sticky cells: solid `bg-background` (and header `bg-background` / `bg-muted` if used) so scroll does not show through — mirror access-admin sticky pattern with **both** start and end stickies
  - [x] Interactive a11y DoD (must pass before done):
    - [x] Focus visible on sort headers, filter controls, pagination, clear-filters, row focus
    - [x] `aria-sort` correct after sort toggles
    - [x] Live region updates when filters change result count
    - [x] Unauthorized column absent from accessibility tree / DOM
    - [x] Light + dark: sticky columns remain opaque

- [x] Task 4: Fixture demo host (AC: #1–#6 — prove contract without FR33)
  - [x] Ship a **fixture demo** that exercises: text + enum filters, sort, pagination across >1 page, sticky id + actions, one `permitted: false` column omitted, empty → clear restores section defaults
  - [x] Suggested fixture shape (Persian labels OK): identifier, name text, team enum, status enum, fake «جبران خدمت» column with `permitted: false`
  - [x] Mount demo on `apps/web/app/(app)/personnel/(tabs)/list/page.tsx` **or** a clearly labeled section in the list tab — do **not** delete/break `PersonnelPanel` domain CRUD; prefer a separate «پیش‌نمایش جدول» / demo region above or below existing panel, or replace only the non-governed `<ul>` list preview if that is already stub-only
  - [x] Section defaults for demo: include at least one non-empty default (e.g. status = active) so clear ≠ wipe
  - [x] **Do not** wire real `person.list` pagination/FR33 semantics — that is Story **5.1**
  - [x] **Do not** implement `export-artifact-panel` / reauth — optional disabled or omitted `exportSlot` only

- [x] Task 5: Verify + DoD (AC: #1–#6)
  - [x] Add `apps/web` selfcheck for pure snapshot helpers (e.g. `governed-data-table.selfcheck.ts` or under `lib/`) and wire a package script if cheap (`selfcheck:governed-table`) — mirror existing `tsx` selfcheck pattern
  - [x] `pnpm --filter @divan/web` typecheck + lint on **touched** files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done later
  - [x] BOM-safe edit if touching `sprint-status.yaml` on Windows (UTF-8 **without** BOM)

## Dev Notes

### Epic context

- **Epic 4b:** Shell & IA Alignment to `ux-divan-2026-07-19` — presentation only; domain APIs unchanged. Authorized by `sprint-change-proposal-2026-07-19`.
- **This story:** UX-DR7 — shared `governed-data-table` (name **supersedes** prior `personnel-data-table`).
- **Order:** `4b.1` (done) → `4b.2` (done) → `4b.3` (done) → **`4b.4`** → (`4b.5` ∥ `4b.6`) → `4b.7` → Epic 5.
- **Gate:** No Epic 5 story implementation until **4b.1–4b.4 (minimum)** ready — preferably full 4b before 5.1.
- **FRs:** Primitive supports FR33/FR43 presentation contracts; **FR33 data wiring is Epic 5.1**. View≠export (FR3) — export slot only when caller permits.

### Locked decisions (do not reopen in implementation)

| Decision | Value | Rationale |
| --- | --- | --- |
| Component id | `governed-data-table` | UX-DR7 / EXPERIENCE; never name files `personnel-data-table` |
| Location | `apps/web/components/…` | Story Given + AD-6; **no** `packages/ui` |
| Grid library | **No AG Grid**; no infinite scroll | EXPERIENCE Banned + Story AC |
| Table engine | shadcn `Table` + local snapshot hook; **no** `@tanstack/react-table` unless already present (it is not) | Keep public contract explicit for 5.1; avoid coupling |
| Enum empty multi | **No filter** (= همه) | Edge-case closure; avoid silent zero without CTA |
| Clear filters | Reset to **`sectionDefaultFilters`** | EXPERIENCE / 5.1 «همکار فعلی = yes» pattern |
| Filter state URL | **Not in 4b.4** | Avoid sensitive residue / share leaks; mid-session omit simpler |
| Demo data | Fixture rows OK | Story AC + sprint-change-proposal |
| Page size default | **25** | Desktop compact; callers may override |
| Sticky physical classes | `sticky start-0` + `sticky end-0` with opaque bg | RTL-safe; matches access-admin start sticky |

### Absolute non-goals (do not implement here)

| Out of scope | Belongs to |
| --- | --- |
| Permission-safe `person` search, facets, real FR33 queries | **5.1** |
| Default chip «همکار فعلی» product wiring on live personnel query | **4b.7** / **5.1** (primitive must *support* section defaults) |
| Person-first Access table retrofit | **4b.5** |
| Org flat refs using this table | **4b.6** |
| `tree-navigator` | **4b.6** |
| `personnel-quick-edit-modal`, event form move, row «ثبت رویداد» navigation | **4b.7** / Epic 5 |
| `export-artifact-panel`, reauth, custody | **6.5** / Epic 7 |
| Replacing Access admin HTML table in this story | **4b.5** (will consume primitive) |
| Brand hex / FaNum / mobile / AG Grid / Prisma in web | Never |
| AD-1…AD-6 changes | No architecture change |

### Current code state (UPDATE targets)

| File / area | Today | This story changes | Must preserve |
| --- | --- | --- | --- |
| `apps/web/components/ui/table.tsx` | **Missing** | NEW via shadcn | — |
| `apps/web/components/governed-data-table/*` | **Missing** | NEW primitive + snapshot + fixture | — |
| `apps/web/app/globals.css` | Tokens `--filter-row-height`, `--table-row-compact` already set (4b.1) | Consume only; no brand rethink | Existing chrome/theme tokens |
| `apps/web/lib/operational-copy.ts` | `emptySearch` exact; **no** `clearFilters` | Add `clearFilters` | All other copy strings |
| `apps/web/lib/persian-digits.ts` | `formatPersianInteger`, `normalizeDigitsForMatch` | Reuse for counts + text match | API unchanged |
| `apps/web/components/access/access-admin-panel.tsx` | Raw `<table>` + `sticky start-0` + `overflow-x-auto` | **Do not retrofit** here (inspiration only) | 2.3 behavior |
| `apps/web/components/personnel/personnel-panel.tsx` | `<ul>` list; DOM-omit via dictionary `show(key)` | Optional coexistence with demo; do not break CRUD | Domain create/list |
| `apps/web/components/ui/popover.tsx` | Exists | Reuse for enum filter panel | — |
| Leave-guard / section-tabs / sidebar | 4b.1–4b.3 done | **No changes** unless demo mount touches list layout | Guards, IA, landings |

### Architecture compliance (MUST follow)

| Rule | Implication |
| --- | --- |
| **AD-5** | UI omit is not authorization. Primitive omits columns by caller `permitted`; real category checks stay in audit-envelope at query time (5.1+) |
| **AD-6** | Next **16.2.x** App Router; Persian RTL; **no** `@prisma/client` in `apps/web`; tRPC for server data later |
| **FR-2 / FR-3** | Results/filters/counts/columns must not leak out-of-scope; view ≠ export |
| **FR-33** | Lists: sort, stable-snapshot pagination, deterministic order, count, filtered export when permitted, Persian empty — **primitive implements the chrome**; data in 5.1 |
| UX authority | Forward contract = `ux-divan-2026-07-19`. `ux-divan-2026-07-13` historical (`personnel-data-table` name retired). **Spines win** over mocks |
| Consistency | Surfaces must reuse governed-data-table for primary flat lists; deviations need UX memlog override |

[Source: `ARCHITECTURE-SPINE.md` AD-5/AD-6; `epics.md` UX-DR7 + Story 4b.4; `EXPERIENCE.md` Component Patterns; `prd.md` FR-2/3/33]

### Snapshot algorithm (implement exactly)

```text
inputs: rows[], columns[], filters, sort, pageIndex, pageSize, getRowId

1. visibleColumns = columns.filter(c => c.permitted !== false)
2. activeFilters = filters without keys not in visibleColumns
3. filtered = rows where every active filter matches:
     - text: substring on String(accessor(row)) after digit-normalize
     - enum: if selectedValues.length === 0 → pass; else accessor in selectedValues
4. sorted = stable sort(filtered):
     - if sort: compare accessor by asc/desc (string localeCompare fa, numeric if both numbers)
     - tie-break: getRowId(a) < getRowId(b)
5. snapshotId = hash/serialize(activeFilters + sort)  // identity for “new snapshot”
6. on filters/sort change: pageIndex = 0
7. pageRows = sorted.slice(pageIndex * pageSize, (pageIndex+1) * pageSize)
8. announce formatPersianInteger(sorted.length)
```

### Visual / UX specifics

| Topic | Spec |
| --- | --- |
| Density | Compact rows 40px; filter row 36px; full available width after sidebar |
| Headers | Caption / 12px; sort control keyboard-activatable |
| Sticky id | RTL start — first data column typically; `sticky: "identifier"` |
| Sticky actions | Inline-end; `sticky: "actions"` when `rowActions` provided |
| Empty | Exact `emptySearch` + `clearFilters` → section defaults |
| Export | UX-DR7 “when permitted” — slot only; no Epic 6 panel |
| Mock ref | `ux-divan-2026-07-19/mockups/key-personnel-list.html` (filter row + sticky visual) |
| 200% zoom | Table container may scroll; page-level H-scroll not OK |

### Previous story intelligence (4b.1–4b.3)

- **4b.1:** Tokens for filter-row / table-row-compact already in `globals.css` + `@theme inline`. Collapse reclaim width exists — wide tables benefit; do not regress sidebar.
- **4b.2:** Section tabs + leave-guard substrate. Table demo on `/personnel/list` must not break leave-guard on dirty event form still hosted there. Theme/collapse remain exempt.
- **4b.3:** IA labels «اطلاعات پرسنلی» / events top-level; Operator lands `/personnel/list`. Demo host belongs on that list tab. Do not rename surfaces again.
- **Patterns:** `operationalCopy` for exact Persian strings; `toPersianDigits` / `formatPersianInteger` for counts; `tsx` selfchecks; eslint touched-only; **no BOM** on sprint-status; story Status ↔ sprint-status on done.
- **Access-admin sticky:** reuse mental model (`sticky start-0 bg-background` inside `overflow-x-auto`) and extend with `end-0` for actions.
- **PersonnelPanel DOM-omit:** dictionary `show(key)` is the product pattern for field omit — table’s `permitted` is the list-column analogue.

### Git intelligence

```text
348b246 story 4b.3   ← IA labels + landings + personnel-events placeholder
c11e77d story 4b.2   ← section tabs + leave-guard
c1a0c36 story 4b.1   ← collapse shell + table/filter tokens
```

Commit style: short `story 4b.N`. Touch `apps/web` UI only (plus story/sprint artifacts).

### Latest tech notes

- **shadcn Table** (new-york): add via CLI into `components/ui/table.tsx`. Sticky columns: Tailwind `sticky` + logical `start-0` / `end-0` + opaque background; avoid nested `overflow:hidden` ancestors that break sticky.
- **Do not** introduce AG Grid “just for Excel filters” — build enum multi-select with existing Popover + Checkbox/Button.
- **React 19 / Next 16.2.x:** client component for interactive table (`"use client"`); keep page RSC wrappers thin; Layout≠RSC gate unchanged.
- **aria-sort:** only on sorted column header; values `ascending` | `descending` | `none` per ARIA.
- Optional later: `@tanstack/react-table` is the upstream shadcn data-table default — **out of scope unless already a dependency** (currently absent). Revisit only with explicit UX/arch note.

### Project Structure Notes

```text
apps/web/components/
  governed-data-table/          ← NEW (primitive)
    governed-data-table.tsx
    use-governed-table-snapshot.ts
    types.ts
    fixture-demo.tsx            ← optional colocated demo
    *.selfcheck.ts              ← pure logic asserts
  ui/table.tsx                  ← NEW shadcn
  ui/popover.tsx                ← reuse
  ui/checkbox.tsx               ← add if needed
lib/operational-copy.ts         ← clearFilters
app/(app)/personnel/(tabs)/list ← demo mount point
```

- Do **not** create `packages/ui`
- Do **not** put table state machines in domain modules

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4b.4, UX-DR7]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/DESIGN.md` — `components.governed-data-table`, Layout & Spacing, Do's/Don'ts]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/review-edge-cases.md` — clear-filters vs defaults; enum empty; filter→page 1; sensitive omit]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/mockups/key-personnel-list.html`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-19.md` — Story 4b.4 + gate]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5/AD-6]
- [Source: `_bmad-output/implementation-artifacts/4b-1-design-delta-tokens-collapsible-app-shell.md`]
- [Source: `_bmad-output/implementation-artifacts/4b-2-section-tabs-chrome-routing-leave-guards.md`]
- [Source: `_bmad-output/implementation-artifacts/4b-3-sidebar-ia-labels-role-landings.md`]

### Manual DoD checklist

1. Demo table full-width compact; filter row visible; uses token heights
2. Text filter debounced substring; enum multi-select applies immediately; empty multi = no filter
3. Sort toggles `aria-sort`; filter/sort → page resets to ۱; count Persian + polite live region
4. Wide fixture: horizontal scroll inside table only; sticky identifier (start) + actions (end) stay visible
5. Column with `permitted: false` absent from DOM (inspect); no disabled tease
6. Force empty via filters → exact empty copy + «پاک کردن فیلترها» restores **section defaults**
7. No AG Grid in `package.json`; no infinite scroll
8. Keyboard: tab to filters/sort/pagination; row focus moves with arrows; focus rings visible light+dark
9. Existing personnel domain panel / leave-guard / sidebar IA still work on `/personnel/list`
10. Selfcheck + web typecheck/lint clean on touched files

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Selfcheck: `pnpm --filter @divan/web selfcheck:governed-table` → ok
- Typecheck: `pnpm --filter @divan/web typecheck` → ok
- Lint (touched): eslint on governed-data-table + ui/table + ui/checkbox + operational-copy + list page → ok

### Completion Notes List

- Added shadcn `table` + `checkbox` (new-york); reused popover/input/button; no AG Grid / `@tanstack/react-table`.
- Implemented `GovernedDataTable` with locked public contract, pure snapshot helpers (`applyFilters` / `applySort` / `paginate` / omit), text debounce 250ms, enum multi-select (empty = no filter), sort cycle with `aria-sort`, page reset on filter/sort, Persian counts + polite live region.
- Sticky identifier (`start-0`) + actions (`end-0`) with opaque backgrounds; horizontal scroll only on table container (`tabIndex={0}` when overflowed).
- Empty state uses exact `emptySearch` + `clearFilters` restoring `sectionDefaultFilters`.
- Fixture demo «پیش‌نمایش جدول» mounted above `PersonnelPanel` on `/personnel/list` (32 rows, default status=active, compensation column `permitted: false`).
- Package script: `selfcheck:governed-table`.

### File List

- apps/web/components/ui/table.tsx
- apps/web/components/ui/checkbox.tsx
- apps/web/components/governed-data-table/types.ts
- apps/web/components/governed-data-table/snapshot.ts
- apps/web/components/governed-data-table/use-governed-table-snapshot.ts
- apps/web/components/governed-data-table/governed-data-table.tsx
- apps/web/components/governed-data-table/fixture-demo.tsx
- apps/web/components/governed-data-table/governed-data-table.selfcheck.ts
- apps/web/components/governed-data-table/index.tsx
- apps/web/lib/operational-copy.ts
- apps/web/package.json
- apps/web/app/(app)/personnel/(tabs)/list/page.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4b-4-governed-data-table-primitive.md

### Review Findings

- [x] [Review][Patch] Mid-session omit does not scrub sort/filters from React state or reset page — `scrubFilters` only in `computeSnapshot`; dead `sort` stays in identity; filters linger in state [`use-governed-table-snapshot.ts:51`] [`snapshot.ts:204`]
- [x] [Review][Patch] Enum `sectionDefaultFilters` string values ignored (`Array.isArray` only) despite locked `string | string[]` contract [`snapshot.ts:73`]
- [x] [Review][Patch] Text debounce page-reset uses `shouldResetPage` flag outside `setState` updater — fragile under concurrent React [`use-governed-table-snapshot.ts:66`]
- [x] [Review][Patch] Sticky cells use fixed `bg-background` while rows use `hover:bg-muted/50` / focus tint — sticky band not opaque on hover/focus [`governed-data-table.tsx:29`]
- [x] [Review][Patch] Result count announced twice (sr-only `aria-live` + visible `<p aria-hidden={false}>`) [`governed-data-table.tsx:220`]
- [x] [Review][Patch] Fixture demo lacks forced horizontal overflow — sticky start/end may never prove under wide desktop [`fixture-demo.tsx:117`]
- [x] [Review][Patch] `sprint-status.yaml` saved with UTF-8 BOM (`EF BB BF`) — Task 5 requires UTF-8 without BOM [`sprint-status.yaml:1`]
- [x] [Review][Patch] Non-finite `pageSize` (`NaN`/`Infinity`): `Math.max(1, pageSize)` stays `NaN` → broken pagination [`snapshot.ts:135`]
- [x] [Review][Patch] ArrowUp/Down on row handler fires when focus is inside nested controls (e.g. row action button) [`governed-data-table.tsx:185`]
- [x] [Review][Patch] `focusedRowIndex` not clamped when `pageRows.length` shrinks without identity/page change [`governed-data-table.tsx:134`]
- [x] [Review][Patch] Selfcheck misses sort-omit scrub + page-reset contract coverage called out in Task 2 [`governed-data-table.selfcheck.ts`]
- [x] [Review][Patch] `TableCell` checkbox padding uses physical `pr-0` while `TableHead` uses logical `pe-0` — RTL asymmetry [`table.tsx:102`]
- [x] [Review][Patch] Identifier and actions sticky share `z-10` — end sticky should stack above on overlap [`governed-data-table.tsx:29`]
- [x] [Review][Patch] Enum filter `role="listbox"` with Checkbox widgets — mismatched ARIA pattern [`governed-data-table.tsx:72`]
- [x] [Review][Patch] Debounce effect depends on `columns` array identity — unstable caller arrays continually reset timer [`use-governed-table-snapshot.ts:88`]
- [x] [Review][Patch] No guard when caller supplies sticky `actions` column and also `rowActions` (duplicate end stickies) [`governed-data-table.tsx:150`]
- [x] [Review][Patch] No guard for multiple columns with same `sticky` kind [`snapshot.ts:10`]
- [x] [Review][Patch] Stale enum selections not in `enumOptions` are never pruned [`governed-data-table.tsx:303`]
- [x] [Review][Patch] Text `sectionDefaultFilters` given as `string[]` is ignored (`typeof raw === "string"` only) [`snapshot.ts:68`]

## Change Log

- 2026-07-20: Story context created (ready-for-dev) — ultimate context engine analysis completed
- 2026-07-20: Implemented governed-data-table primitive + fixture demo; status → review
- 2026-07-20: Code review findings appended (19 patch, 0 decision, 0 defer)
- 2026-07-20: Applied all 19 review patches; status → done
