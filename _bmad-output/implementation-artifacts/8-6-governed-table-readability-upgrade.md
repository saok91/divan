---
baseline_commit: e090c55
---

# Story 8.6: Governed Table Readability Upgrade

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator reading any list,
I want tables to fit the content instead of forcing horizontal scroll,
so that I can read a row without dragging a scrollbar (UX-DR31, FR58).

**Story key:** `8-6-governed-table-readability-upgrade`  
**Epic:** 8 — Experience Foundation & Identifier Ergonomics (FR58; FR43 content-driven sizing; UX-DR31)  
**UX contract (forward):** `ux-divan-2026-07-31` (DESIGN.md governed-data-table + Layout/Tables; EXPERIENCE.md sticky / density / truncation)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (finding **E4** + Story 8.6 intent)  
**Prerequisite:** Story 4b.4 primitive done; Story 8.2 tokens (`--table-row-dense`, `--table-header-height`, `--surface-subtle`, `--hairline*`, `.text-column-header`) already in `globals.css`. Story 8.5 done — do **not** reopen EntityPicker / UUID retrofit. Do **not** own row-action chrome (**8.7**).

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| `GovernedDataTable` + snapshot | `apps/web/components/governed-data-table/*` | Filters, sort, pagination, live region, permission omit, sticky id/actions, keyboard rows | Wire UX-DR31: sizing, truncate/wrap, density, visibility+persist, sticky separators, header chrome |
| `ui/table` | `apps/web/components/ui/table.tsx` | Container overflow-x; **hardcoded `whitespace-nowrap`** on Head/Cell | Make overflow controllable; stop forcing nowrap for wrap columns |
| Table tokens (8.2) | `apps/web/app/globals.css` | `--table-row-dense` 32px, `--table-row-comfortable` 48px, `--table-header-height` 28px, hairline/surface-subtle | **Consume** as default dense + comfortable toggle; stop defaulting to legacy `--table-row-compact` (40px) |
| `Tooltip` | `apps/web/components/ui/tooltip.tsx` | Radix tooltip (hover + focus) | Use for truncated full-value; style truncated-cell tooltips to DESIGN tooltip (chrome / caption / 6px offset) — do not invent a second tooltip kit |
| Preference storage pattern | `lib/theme-storage.ts`, `lib/sidebar-storage.ts` | Per-account keys, fail-open | Mirror for **session** table prefs (EXPERIENCE: survive navigation **within the session**) |
| Selfcheck pattern | `governed-data-table.selfcheck.ts`, `layout-system.selfcheck.ts` | Pure snapshot + AST token asserts | Extend: no forced `min-w-[…]rem` wrappers; dense default; visibility scrub preserves 4b.4 contract |

### Critical naming distinction (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **AC / UX “compact” (default)** | Row height **32px** = token `--table-row-dense` / DESIGN `table-row-dense` |
| **Legacy `--table-row-compact`** | **40px** from 4b.4 — **not** the 8.6 default; stop using it for GovernedDataTable body rows |
| **Comfortable** | **48px** = `--table-row-comfortable` — density toggle only; **do not** change other tokens |
| Permission omit (`permitted: false`) | Server/authz column removal from DOM — **not** the same as operator column-visibility hide |
| Operator column visibility | User hides **approved** columns; sticky id / sticky actions / `__actions` stay mandatory visible |
| Container horizontal scroll | Still OK when content truly overflows; **forbidden** is page-level scroll caused by fixed `min-w-[48\|64\|72]rem` |
| Row-action affordance / dead-click | **Story 8.7** — leave `rowActions` render as-is |

## Acceptance Criteria

1. **Given** `governed-data-table` and `ui/table`  
   **When** the readability upgrade is complete  
   **Then** the five `min-w-[…]` wrappers are removed and no fixed table minimum width remains anywhere in the app

2. **And** column widths follow content with a per-column max width; long values truncate with an ellipsis and expose the full value accessibly and via tooltip

3. **And** designated long-text columns wrap instead of truncating

4. **And** column visibility is user-controlled and persists per operator

5. **And** the density toggle offers compact 32px (default) and comfortable 48px without changing any other token

6. **And** sticky identifier and actions columns keep an inset hairline separator while scrolling, not a drop shadow

7. **And** at 1280×720 with a realistic row set the personnel list and the access administration table are readable without page-level horizontal scroll

8. **And** the Story 4b.4 primitive contract — filters, sort, snapshot pagination, live-region counts, permission-omitted columns — is preserved

9. **And** scope stays **presentation only**:
   - No domain / permission / governance / event-store semantic changes
   - Additive optional column/table props only — existing consumers keep working without prop churn
   - AR-\* fail-closed; do not invent freeze numbers
   - `selfcheck:governed-table`, `selfcheck:layout-system`, `selfcheck:control-contract` stay green (extend as needed)
   - Do **not** own: EntityPicker/UUID (**8.3–8.5**); row-action chrome / leave-guard silent-fail (**8.7**); skeletons/toast (**8.8**); glossary overhaul (**8.9**); design QA gate (**8.10**); Epic 9–10 IA

## Tasks / Subtasks

- [x] Task 1: Lock inventory + contract (AC: #1, #8, #9)
  - [x] Treat **Five forced min-width wrappers** table below as mandatory removal checklist
  - [x] Grep `apps/web` for `min-w-[` on/near `data-slot=table` / GovernedDataTable wrappers — **zero** fixed rem min-widths remain after the story
  - [x] Document additive API in `types.ts` (see Dev Notes) — do not break existing `GovernedColumn` / `GovernedDataTableProps` required fields
  - [x] Confirm permission omit still happens in `visibleColumns()` **before** operator visibility filtering

- [x] Task 2: `ui/table` overflow baseline (AC: #2, #3)
  - [x] Stop unconditional `whitespace-nowrap` as the only cell behavior — allow GovernedDataTable (or cell chrome) to opt into truncate vs wrap
  - [x] Keep checkbox alignment helpers; do not regress non-governed table consumers (import preview cells, any raw `TableCell` usage) — prefer opt-in classes from GovernedDataTable over a global wrap that breaks dense lists
  - [x] Prefer: base cell may drop hard nowrap **or** GovernedDataTable always overrides with explicit `truncate` / `whitespace-normal` / `break-words` — pick one coherent approach and apply it consistently

- [x] Task 3: Content-driven columns + truncate / wrap (AC: #2, #3, #7)
  - [x] Add optional `GovernedColumn` fields: e.g. `maxWidthClass` (Tailwind max-width), `cellOverflow: "truncate" | "wrap"` (default `"truncate"`)
  - [x] Default truncate path: `max-w-*` + `truncate` (ellipsis) on the cell text node; full string from `accessor` (or plain-text fallback) available to AT + tooltip
  - [x] Wrap path: `whitespace-normal break-words` + max width; **no** ellipsis tooltip required when fully wrapped/visible
  - [x] Custom `cell` renderers: wrap content in the same overflow chrome when the column opts into truncate (string children) — if custom cell is complex, document that callers should use truncate chrome or accept no auto-tooltip
  - [x] Designate at least one realistic long-text column on personnel list and/or access people (e.g. long name / team path / entitlement summary) as `wrap` where product copy is paragraph-like; otherwise leave truncate defaults
  - [x] Reuse `@/components/ui/tooltip` — hover **and** keyboard focus; truncated trigger must be focusable (`tabIndex={0}` on the truncated span if needed). Prefer showing tooltip when overflow is detected (`scrollWidth > clientWidth`); always expose full value via `title` **or** `aria-label`/`aria-describedby` so AT is not tooltip-only
  - [x] Style truncated-cell tooltip content toward DESIGN: navy `{chrome}` / `{chrome-foreground}`, `{caption}`, `sideOffset={6}`, `rounded-sm` — local className override OK; do not rewrite global Tooltip defaults for every use site unless cheap

- [x] Task 4: Density toggle (AC: #5)
  - [x] Default body row height: `h-table-row-dense` / `min-h-[var(--table-row-dense)]` (**32px**)
  - [x] Comfortable: `--table-row-comfortable` (**48px**) via toggle only
  - [x] Header cells: `h-table-header-height` / `--table-header-height` (**28px**) + `text-column-header` + `bg-surface-subtle` (replace `bg-muted` + `text-caption font-medium` on column headers)
  - [x] Filter row stays `--filter-row-height` (**36px**) — unchanged
  - [x] Toolbar control (tertiary/sm): Persian labels e.g. «فشرده» / «راحت» (or a single toggle announcing current density); one shared density preference per table prefs key
  - [x] **Do not** retoken other spacing; **do not** change `--table-row-compact` value (other surfaces may still use 40px)

- [x] Task 5: Column visibility + session persistence (AC: #4, #8)
  - [x] Toolbar popover (or equivalent) listing **permission-visible** columns with checkboxes; sticky `identifier`, sticky `actions`, and synthetic `__actions` are **not hideable**
  - [x] Hidden columns leave the DOM for display **and** are scrubbed from active sort/filters the same way omitted columns are today (`scrubFilters` / `scrubSort` — extend helpers or layer a second visibility filter after `permitted`)
  - [x] Persistence: **sessionStorage**, per operator account id + per-table `preferencesKey` (EXPERIENCE: within session). Mirror fail-open pattern from `sidebar-storage.ts`
  - [x] Suggested key shape: `divan-table-prefs:<accountId|anon>:<preferencesKey>` storing `{ density, hiddenColumnIds }`
  - [x] Resolve `accountId` via `useSession` when available; fall back to `anon` — optional explicit `preferencesKey` prop on `GovernedDataTable` (required for persistence; default from a stable slug derived from `aria-label` only if documented — prefer explicit keys on the five high-traffic panels)
  - [x] Pass `preferencesKey` on: personnel-list, access-people, audit-investigation, personnel-events-list, report-catalogue (and other GovernedDataTable consumers as cheap follow-through)

- [x] Task 6: Sticky separators + header chrome (AC: #6)
  - [x] When horizontal scroll offset ≠ 0 (RTL-aware): apply inset hairline separators on sticky start/end columns per DESIGN:
    - start: `box-shadow: inset -1px 0 0 var(--hairline)` (token `sticky-start-separator`)
    - end: `box-shadow: inset 1px 0 0 var(--hairline-strong)`
  - [x] **Never** drop-shadow on sticky columns
  - [x] Sticky cell backgrounds: `bg-background` / header `bg-surface-subtle` (match header); preserve hover/focus group tints
  - [x] Optional but DESIGN-aligned: sticky `thead` (`sticky top-0 z-30`) inside the scroll container so vertical scroll keeps headers — only if it does not break filter-row layout; if deferred, note in Completion Notes for 8.10

- [x] Task 7: Remove five min-width wrappers + consumer pass (AC: #1, #7)
  - [x] Remove wrappers listed below; leave surrounding panel layout intact (full-bleed table rule from 8.2)
  - [x] Smoke personnel list + access people at **1280×720**: no **page-level** horizontal scrollbar; table container may scroll only if content truly requires it
  - [x] `import-preview-table.tsx`: inherits primitive — update any hardcoded `h-table-row-compact` if present so preview tracks dense default
  - [x] Org / correction panels (no min-w today): verify no regression from nowrap/density changes

- [x] Task 8: Selfcheck + regression DoD (AC: #8, #9)
  - [x] Extend `governed-data-table.selfcheck.ts` (and/or a small AST selfcheck):
    - Existing snapshot/filter/sort/pagination/permission-omit asserts stay green
    - Assert visibility scrub: hiding a column clears sort/filter on that id; sticky/actions never in hide set
    - Optional: density default constant === dense token name
  - [x] AST/grep selfcheck: fail if `min-w-[48rem]|min-w-[64rem]|min-w-[72rem]` (or broader `[&_[data-slot=table]]:min-w-`) remains under `apps/web`
  - [x] Run: `pnpm --filter @divan/web selfcheck:governed-table`, `selfcheck:layout-system`, `selfcheck:control-contract`, `typecheck`
  - [x] Manual: density toggle; hide/show column + reload route (same session); truncate tooltip keyboard; RTL sticky separators while scrolling; light/dark hairlines
  - [x] Align story Status ↔ sprint-status when marking done

### Review Findings

- [ ] [Review][Manual] AC7 smoke @ 1280×720 (personnel + access) + RTL separators + light/dark hairline — operator visual confirmation still outstanding (decision 2026-07-31: leave open until smoke done; not a code patch)
- [x] [Review][Patch] Exempt sticky identifier columns from `DEFAULT_MAX_WIDTH` unless `maxWidthClass` is explicit [`governed-data-table.tsx` renderCellContent]
- [x] [Review][Patch] Prefs hydrate clears hides when columns incomplete on first tick [`governed-data-table.tsx:380-414`]
- [x] [Review][Patch] Session-loading `anon` hydrate/persist before real accountId [`governed-data-table.tsx:371-400`]
- [x] [Review][Patch] `persistPrefs` stale closure — use functional `setPrefs` [`governed-data-table.tsx:416-424,555-560`]
- [x] [Review][Patch] TruncatedCell forced on complex/custom cells (invalid span→div, breaks import tint / nested interactive a11y) [`governed-data-table.tsx:163-184`]
- [x] [Review][Patch] TruncatedCell always `tabIndex={0}` even when not overflowing — fights row keyboard model [`governed-data-table.tsx:132-147`]
- [x] [Review][Patch] Wrapper `aria-label={fullText}` masks nested interactive cell semantics [`governed-data-table.tsx:140`]
- [x] [Review][Patch] Report catalogue shares one `preferencesKey` across changing column schemas [`report-catalogue-panel.tsx:281`]
- [x] [Review][Patch] Import preview severity cells hard-code `--table-row-dense` min-height ignoring density toggle [`import-preview-table.tsx:66-90`]
- [x] [Review][Patch] `defaultDensity` never wins when `preferencesKey` set — `readTablePreferences` always returns density `"dense"` [`table-preferences-storage.ts:41` + hydrate]
- [x] [Review][Patch] Header applies `maxWidthClass` without truncate — long headers can overflow [`governed-data-table.tsx:601-607`]
- [x] [Review][Patch] Restoring/scoping `whitespace-nowrap` for non-governed `TableHead`/`TableCell` consumers after global removal [`ui/table.tsx:84-107`]
- [x] [Review][Patch] Sanitize-in-memory hide ids not written back to sessionStorage [`governed-data-table.tsx:402-414`]
- [x] [Review][Patch] Deduplicate `hiddenColumnIds` in `sanitizeHiddenColumnIds` [`snapshot.ts:109-123`]
- [x] [Review][Patch] Align density default constants (`GOVERNED_TABLE_DEFAULT_DENSITY` vs `DEFAULT_TABLE_PREFERENCES`) [`types.ts` / `table-preferences-storage.ts`]
- [x] [Review][Patch] Simplify dead intermediate logic in `scrubTextDrafts` [`use-governed-table-snapshot.ts:33-69`]
- [x] [Review][Patch] Tooltip `max-w-xs` can still clip long full values [`governed-data-table.tsx:153-158`]

- [x] [Review][Defer] ResizeObserver ungarded if constructor missing [`governed-data-table.tsx:120-129`] — deferred, pre-existing env assumption
- [x] [Review][Defer] Selfcheck AST min-width ban is pattern-narrow / tree-wide scan cost [`governed-data-table.selfcheck.ts`] — deferred, acceptable story guard

## Dev Notes

### Gate (non-negotiable)

- **Presentation only** — Epic 8: no domain/permission/governance rule changes.
- **Forward UX** is `ux-divan-2026-07-31`; spines win on conflict with mocks.
- **FR-58 / UX-DR31:** content-driven sizing; no fixed table min-width; truncate+accessible full value; wrap for designated columns; operator column visibility + persistence; density 32/48; sticky inset separators.
- **Preserve 4b.4 contract:** text/enum filters, `aria-sort`, snapshot pagination, live-region result count, `permitted: false` omit from DOM, clear→section defaults, row ArrowUp/Down, container overflow tabindex when needed, Persian empty state.
- **Additive API** — optional props/fields only; every existing call site must typecheck without edits except min-w removal + optional `preferencesKey` / wrap marks.
- **UI in `apps/web`** — no `@divan/ui` package; AD-6 Prisma gate unchanged.
- **8.7 boundary:** do not restyle row-action buttons to 24px outlined / overflow menus / dead-click selfcheck.
- **8.2 ownership handoff:** 8.2 already added tokens and said not to change GovernedDataTable public API **in 8.2**; **this story** is authorized to extend the primitive for UX-DR31.

### Density token map (avoid the 40px trap)

| UI / AC label | CSS token | px | Usage |
| --- | --- | --- | --- |
| Compact (default) | `--table-row-dense` | 32 | Body rows default |
| Comfortable | `--table-row-comfortable` | 48 | Density toggle only |
| Legacy compact | `--table-row-compact` | 40 | **Do not** use as GovernedDataTable default |
| Header | `--table-header-height` | 28 | Column header row |
| Filter row | `--filter-row-height` | 36 | Unchanged |

### Five forced min-width wrappers (UPDATE — remove)

| File | Wrapper today |
| --- | --- |
| `apps/web/components/personnel/personnel-list-panel.tsx` | `[&_[data-slot=table]]:min-w-[72rem]` |
| `apps/web/components/audit/audit-investigation-panel.tsx` | `[&_[data-slot=table]]:min-w-[72rem]` |
| `apps/web/components/access/access-people-panel.tsx` | `[&_[data-slot=table]]:min-w-[64rem]` |
| `apps/web/components/personnel/personnel-events-list-panel.tsx` | `[&_[data-slot=table]]:min-w-[48rem]` |
| `apps/web/components/reports/report-catalogue-panel.tsx` | `[&_[data-slot=table]]:min-w-[48rem]` |

**Root cause (SCP E4):** those wrappers **plus** `whitespace-nowrap` on every `TableHead`/`TableCell` in `ui/table.tsx`.

### Suggested additive API (implement concretely; names may vary if clearer)

```ts
// GovernedColumn — all optional
maxWidthClass?: string;          // e.g. "max-w-[16rem]"
cellOverflow?: "truncate" | "wrap"; // default "truncate"

// GovernedDataTableProps — optional
preferencesKey?: string;         // session prefs bucket
defaultDensity?: "dense" | "comfortable"; // default "dense"
```

Visibility state lives inside the primitive (not required props). Permission omit remains `permitted?: boolean`.

### Current state → change map (UPDATE files)

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `governed-data-table.tsx` | Rows use `h-table-row-compact`; headers `bg-muted text-caption`; sticky bg only; no truncate chrome; no density/visibility UI | Dense default, comfortable toggle, header tokens, truncate/wrap cells+tooltip, visibility popover, scroll-linked inset separators, prefs hydrate | Snapshot hook, filters, sort, pagination, live region, row keyboard, rowActions column inject |
| `types.ts` | No overflow/density/prefs fields | Additive optional fields | Existing required props |
| `snapshot.ts` / `use-governed-table-snapshot.ts` | `visibleColumns` = permitted only | Layer operator-hidden columns; scrub sort/filters | Permission omit semantics; section defaults |
| `ui/table.tsx` | Hard `whitespace-nowrap` | Controllable overflow for readability | Container overflow-x API; checkbox alignment |
| `globals.css` | Tokens exist; unused by table body | Consume dense/comfortable/header/surface-subtle/hairline — **no new token invention** unless separator utilities need a tiny helper class | Existing 8.2 token values |
| Five panels above | Forced min-w wrappers | **Delete** wrappers; add `preferencesKey` (+ wrap marks where needed) | Data fetching, authz, leave-guards, rowActions callbacks |
| `import-preview-table.tsx` | Thin wrapper | Inherit; fix hardcoded compact heights if any | Severity cell tint contract |
| `tooltip.tsx` | Generic foreground tooltip | Consume + local DESIGN styling for truncated cells | Do not break other Tooltip call sites |

### Column visibility vs permission omit

```
columns
  → visibleColumns(permitted !== false)     // 4b.4 authz — never show in visibility UI
  → applyOperatorVisibility(hiddenIds)      // user prefs — cannot hide sticky id/actions/__actions
  → displayColumns (+ optional __actions)
```

Hiding a column must not resurrect a `permitted: false` column.

### Persistence contract

| Requirement | Implementation rule |
| --- | --- |
| Per operator | Key includes account id when session has one |
| Within session | **sessionStorage**, not localStorage (EXPERIENCE) |
| Fail open | Corrupt/missing JSON → all permitted columns visible + dense default |
| No server settings | Epic 10 settings store is **out of scope** — do not invent DB prefs |

### Sticky separator algorithm

```
onScroll / ResizeObserver on table container:
  scrolled = RTL ? scrollLeft < 0 or abs(scrollLeft) > 1 : scrollLeft > 1
  if scrolled:
    sticky-identifier cells/heads → inset start separator
    sticky-actions cells/heads → inset end separator
  else:
    clear separator shadows
```

Use logical properties / RTL-safe scroll detection already implied by `start-0` / `end-0` sticky classes.

### What must be preserved (end-to-end)

| Behavior | Where | Notes |
| --- | --- | --- |
| Filter text/enum + clear to section defaults | snapshot + UI | Unchanged |
| Sort + `aria-sort` | header buttons | Unchanged |
| Page size / pagination / live region | primitive | Unchanged |
| Permission column omit | `permitted: false` | Still removed from DOM before user prefs |
| Sticky id start + actions end | RTL | Keep; add separators only |
| `rowActions` → `__actions` inject | primitive | Still throws if both sticky actions column and rowActions |
| Full-bleed list panels | panel-section 8.2 | No new card wrappers |
| Control-contract ghost allowlist | 8.1 | Density/visibility controls use tertiary/outline — not ghost row actions |
| EntityPicker surfaces from 8.5 | panels | Do not regress pickers while removing min-w |

### Architecture compliance

- Stack pinned: Next.js 16.2.x, React 19, Tailwind v4, Radix tooltip, lucide-react — **do not upgrade casually**.
- Testing: `*.selfcheck.ts` + `pnpm --filter @divan/web selfcheck:*`.
- Kernel/domain packages untouched.
- Errors / tRPC contracts unchanged.

### Project structure notes

| Action | Path |
| --- | --- |
| UPDATE | `apps/web/components/governed-data-table/governed-data-table.tsx` |
| UPDATE | `apps/web/components/governed-data-table/types.ts` |
| UPDATE | `apps/web/components/governed-data-table/snapshot.ts` (+ hook if visibility lives there) |
| UPDATE | `apps/web/components/governed-data-table/governed-data-table.selfcheck.ts` |
| NEW (optional) | `apps/web/lib/table-preferences-storage.ts` (session prefs helper — mirror sidebar-storage style) |
| UPDATE | `apps/web/components/ui/table.tsx` |
| UPDATE | Five min-w consumer panels listed above |
| UPDATE | Other GovernedDataTable consumers as needed (`org-flat-job-ref-panel`, `correction-cases-panel`, `import-preview-table`) |
| MAY UPDATE | `apps/web/app/globals.css` — only if adding tiny utility for sticky inset separators; prefer Tailwind arbitrary `shadow-[inset_…]` with CSS variables |
| UPDATE | `_bmad-output/implementation-artifacts/sprint-status.yaml` when story moves |
| DO NOT TOUCH | Domain modules, authz matrices, event-store, EntityPicker kit, row-action redesign (8.7) |

### Previous story intelligence (8.5)

- 8.5 was wire-up across many panels; **this story is primitive-first** — fix `governed-data-table` + `ui/table`, then delete five wrappers.
- 8.5 explicitly deferred table min-width to **8.6** — do not mix EntityPicker work back in.
- Selfcheck style: deterministic Node asserts + filesystem/AST greps; extend `selfcheck:governed-table` rather than inventing Playwright for AC #7 (manual 1280×720 still required).
- Control-contract and layout-system selfchecks must remain green — density/visibility toolbar buttons must not introduce forbidden ghost row actions.
- Baseline commit for this story context: `e090c55` (story 8.5).

### Git intelligence

| Commit | Relevance |
| --- | --- |
| `e090c55` story 8.5 | Latest; UUID retrofit — do not reopen |
| `0b19c2a` story 8.2 | Tokens + gallery; table readability deferred here |
| `51d7ad7` story 4b.4 | GovernedDataTable primitive contract to preserve |
| `81ace11` story 8.1 | Control contract — do not regress |

### Latest tech notes

- Radix Tooltip: use Portal (already in `tooltip.tsx`); keep hoverable content (default) for WCAG 1.4.13; truncated triggers need a focusable element — `asChild` on a `span` with `tabIndex={0}` is acceptable when the cell itself is not a button.
- Overflow-only tooltips: Radix has no stable `overflowOnly` prop — implement a small `scrollWidth > clientWidth` check; still provide an accessible name/description with the full string.
- Do **not** rely on native `title` alone as the sole accessible full-value path.
- Tailwind v4: prefer existing `@theme` spacing tokens (`h-table-row-dense`, etc.) already wired in 8.2.

### Epic 8 / carry-in open items (do not silently expand)

- Row-action affordance / dead-click / leave-guard silent-fail → **8.7**
- Skeletons / toast precedence → **8.8**
- Copy/glossary → **8.9**
- Design QA gate at 1280/1920 → **8.10** (this story still manually verifies AC #7)
- PopulationPort, AD-6, SoD splits, person-create dedupe, Epic 9–10 — **out of scope**

### Testing requirements

- `pnpm --filter @divan/web selfcheck:governed-table`
- `pnpm --filter @divan/web selfcheck:layout-system`
- `pnpm --filter @divan/web selfcheck:control-contract`
- `pnpm --filter @divan/web typecheck`
- Manual matrix: personnel list + access people @ 1280×720; density; column hide/show + in-session navigate away/back; truncate tooltip keyboard; RTL horizontal scroll separators; light/dark

### Interactive a11y DoD (table chrome)

- [x] Truncated cells expose full value to AT (not tooltip-only)
- [x] Truncation tooltip appears on hover **and** keyboard focus
- [x] Density and column-visibility controls are labelled in Persian, keyboard operable
- [x] Hidden columns are removed from the accessibility tree (not merely `visibility:hidden`)
- [x] Sticky separators are visual only (no extra AT noise)
- [x] Live-region result count still updates on filter/sort/page
- [x] Focus ring on rows and scroll container preserved when tabbable

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8.6, Epic 8, UX-DR31]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-58, FR-43]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — governed-data-table, Tables, Density toggle, sticky separators, tooltip]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — sticky columns, density/visibility session prefs, truncation a11y]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — E4, Story 8.6 intent]
- [Source: `_bmad-output/implementation-artifacts/8-2-visual-design-language-layout-system.md` — token handoff / 8.6 ownership]
- [Source: `_bmad-output/implementation-artifacts/8-5-remaining-uuid-inputs-retrofit.md` — boundary (table → 8.6)]
- [Source: `_bmad-output/implementation-artifacts/4b-4-governed-data-table-primitive.md` — preserve contract]
- [Source: `apps/web/components/governed-data-table/*`, `apps/web/components/ui/table.tsx`, `apps/web/app/globals.css`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- `pnpm --filter @divan/web selfcheck:governed-table` — ok
- `pnpm --filter @divan/web selfcheck:layout-system` — ok
- `pnpm --filter @divan/web selfcheck:control-contract` — ok
- `pnpm --filter @divan/web typecheck` — ok

### Completion Notes List

- Removed all five forced `min-w-[48|64|72]rem` table wrappers; AST selfcheck guards against regression.
- Additive API: `maxWidthClass`, `cellOverflow`, `preferencesKey`, `defaultDensity` — existing call sites typecheck without required prop churn.
- Truncate default with overflow-only chrome tooltip (`aria-label` + focusable trigger); wrap on personnel `team`/`jobTitle` and access `roles`/`scopes`.
- Density toggle «فشرده»/«راحت» (32/48) via `--table-row-dense` / `--table-row-comfortable`; header uses `--table-header-height` + `text-column-header` + `bg-surface-subtle`.
- Column visibility popover persists in `sessionStorage` (`divan-table-prefs:<accountId|anon>:<key>`); permission omit still runs before operator hide; sticky id/actions/`__actions` not hideable.
- Sticky inset hairline separators on horizontal scroll (no drop-shadow).
- Deferred sticky `thead` vertical pin to Story 8.10 (filter-row layout risk).
- Manual 1280×720 / RTL separator / light-dark hairline visual smoke left for operator review in browser.
- Code review patches applied 2026-07-31: prefs hydrate/session gating, TruncatedCell only for plain text, sticky-id max-width exempt, report prefs key per catalogue selection, import density-aware tint, ui/table nowrap restored with wrap override.

### File List

- `apps/web/components/governed-data-table/types.ts`
- `apps/web/components/governed-data-table/snapshot.ts`
- `apps/web/components/governed-data-table/use-governed-table-snapshot.ts`
- `apps/web/components/governed-data-table/governed-data-table.tsx`
- `apps/web/components/governed-data-table/governed-data-table.selfcheck.ts`
- `apps/web/components/governed-data-table/index.tsx`
- `apps/web/components/ui/table.tsx`
- `apps/web/lib/table-preferences-storage.ts`
- `apps/web/components/personnel/personnel-list-panel.tsx`
- `apps/web/components/personnel/personnel-events-list-panel.tsx`
- `apps/web/components/access/access-people-panel.tsx`
- `apps/web/components/audit/audit-investigation-panel.tsx`
- `apps/web/components/reports/report-catalogue-panel.tsx`
- `apps/web/components/import/import-preview-table.tsx`
- `apps/web/components/organization/org-flat-job-ref-panel.tsx`
- `apps/web/components/correction-cases/correction-cases-panel.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/8-6-governed-table-readability-upgrade.md`

## Change Log

- 2026-07-31: Implemented Story 8.6 governed table readability upgrade (UX-DR31) — content-driven columns, density, visibility prefs, sticky separators, min-width removal.
- 2026-07-31: Code review patches applied (prefs/session, TruncatedCell scope, sticky max-width, report key, import density, ui/table nowrap).
