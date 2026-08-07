---
baseline_commit: 8785f3e
---

# Story 11.4: Compact Field Help (Label + Info Icon)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a user of dashboard filters and dense forms,
I want helper text on an info icon beside the label, not under the control,
so that filter/control rows stay vertically aligned (FR58, UX-DR7, UX-DR38).

**Story key:** `11-4-compact-field-help-label-info-icon`  
**Epic:** 11 — UAT Unblock & Operational UX Hardening  
**UX contract:** `ux-divan-2026-07-31` + **sprint-change-proposal-2026-08-07** filter-help amendment (label + `i` + tooltip; controls share one baseline). Spines still describe “help text” under the field-layout contract — treat **proposal §4.4 / §4.5 Filter help OLD→NEW + epics AC** as authoritative for this chrome change.  
**Architecture:** Presentation-only in `apps/web`. No domain/API/authz changes. No AD-* / AR-* invention.  
**Authorized by:** `sprint-change-proposal-2026-08-07` (approved AtA)  
**Prerequisite:** Story **8.2** shipped `FormLayout` / `FormField` (help under control). Story **8.7** shipped Tooltip + icon-only a11y (`RowActionButton`). Story **11.3** done (Jalali chrome) — public `helperText` API preserved; this story owns moving compact help off the under-control block.  
**Downstream:** **11.5** form surface tokens; **11.6** capacity drawer glossary (≠ field-help tooltip); **11.7** Employment empty states. Do not bleed into those.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| `FormField` | `apps/web/components/form-layout/index.tsx` | Two-column label + control; `help` → always-visible `<p>` under control; wires `aria-describedby` | Compact filters/forms misalign; help not label-adjacent |
| Tooltip primitives | `apps/web/components/ui/tooltip.tsx` | Radix Tooltip; opens on hover **and** keyboard focus; theme-matching popover chip | No shared field-help trigger |
| Icon + tooltip pattern | `apps/web/components/ui/row-action-button.tsx` | `aria-label` required; `TooltipProvider delayDuration={0}`; lucide icon | Wrong visual (rowAction outlined) for label info — **pattern** only |
| Jalali `helperText` | `apps/web/components/jalali-date-picker.tsx` | Under-control caption; default Effective Date copy; `aria-describedby` | Filter call sites pass under-control helpers that break baselines |
| Operational copy | `apps/web/lib/operational-copy.ts` | `dashboardTeamFilterHint`, `reportTeamFilterHint`, etc. | Content stays; chrome moves |
| Glossary | `apps/web/components/glossary/glossary-term.tsx` | `<details>` domain-term disclosure | **Not** field help — do not merge |
| Icon contract | `apps/web/components/icons/icon-contract.md` | lucide-only; row-action / toolbar sizes | No `Info` / `CircleHelp` entry yet |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Compact field help ≠ GlossaryTerm** | Field help = short operational hint for one control. Glossary = domain-term definition disclosure (UX-DR32/37 / 8.9). Keep separate. |
| **Compact field help ≠ FeedbackMessage / PageHeader purpose** | Banner / purpose line stay as-is. |
| **Compact field help ≠ EntityPicker `scopeNoteFa`** | Scope note lives inside picker popover — leave alone unless it is a separate under-control `<p>` (team filter hint is the latter). |
| **FormField.help chrome ≠ JalaliDateTimePicker mode banner** | DateTime’s primary dashed/caption mode line (`helperText` above nested date) is **mode chrome**, not compact filter help. Do not strip it as “under-control misalignment.” |
| **Label-adjacent tooltip ≠ only accessible name** | Info icon must have its own `aria-label` (e.g. «راهنمای فیلد» / «راهنمای {label}»). Tooltip content = help text; tooltip supplements, never replaces the accessible name (UX EXPERIENCE a11y floor). |
| **Error stays under control** | Only `help` moves. `error` + `role="alert"` + `aria-invalid` remain below the control. |
| **Reusable pattern ≠ DashboardFilters-only CSS** | Shared primitive used by filters **and** `FormField` (AC + proposal §2 technical impact). |
| **LG-complete honesty** | Epic 11 UAT polish ≠ claiming LG-complete while Epic 7–10 carry-ins remain open. |

## Acceptance Criteria

1. **Given** `DashboardFilters` (and equivalent compact filter/form rows) that currently render help under the field  
   **When** help is present  
   **Then** it appears as a **label-adjacent info control** with tooltip/disclosure on **hover and keyboard focus**  
   **And** control baselines align across the filter row (no extra vertical help block in compact bars)

2. **And** the same pattern is **reusable** (shared form-field help primitive / `FormField` behavior) — not one-off CSS on dashboard only

3. **And** `ReportFilters` team/date helpers that use the same under-control `<p>` / `helperText` misalignment are migrated to the shared pattern (same epic evidence class)

4. **And** `FormField.help` consumers (at least personnel-event form + gallery demo) render compact label-adjacent help; inline **errors** still appear under the control

5. **And** a11y floor holds:
   - Info control has a non-empty Persian `aria-label`
   - Help text reachable via tooltip on hover **and** focus (reuse Radix Tooltip)
   - Prefer also exposing help to the **field control** via `aria-describedby` (visually hidden or stable id) so AT users who land on the input still hear the hint without finding the icon
   - `pnpm --filter @divan/web selfcheck:design-qa` green

6. **And** Epic Gate encodes held:
   - First-touch: reuse `Tooltip` / `Button` / lucide; no new tooltip library
   - AR-\* / FR-58 fail-closed on interaction consistency — do not invent a second form-layout
   - UTF-8 **without BOM** on `sprint-status.yaml` edits
   - Must **not** reopen Epics 1–10 status churn
   - Must **not** claim LG-complete

7. **And** scope boundaries:
   - Does **not** own form surface / panel background tokens (**11.5**)
   - Does **not** own capacity drawer glossary / activate CTA (**11.6**)
   - Does **not** own Employment / Primary empty states (**11.7**)
   - Does **not** change Jalali month/year / RTL chrome (**11.3** done)
   - Does **not** rewrite operational copy meaning — only chrome placement
   - Does **not** replace `GlossaryTerm` / `TechnicalDetailDisclosure` / `FeedbackMessage`

## Tasks / Subtasks

- [x] Task 1: Shared compact field-help primitive (AC: #1, #2, #5)
  - [x] Add a reusable component (recommended name: `FieldHelpIcon` or `LabelWithHelp`) co-located with form-layout — e.g. export from `apps/web/components/form-layout/index.tsx` or `form-layout/field-help.tsx`
  - [x] API sketch (adjust names, keep intent):
    - `content: ReactNode` (help body)
    - `label: string` for `aria-label` of the icon button (Persian; required non-empty)
    - optional `contentId` for `aria-describedby` wiring
  - [x] Implementation: lucide `Info` or `CircleHelp` (pick one; document in icon-contract) at **toolbar/filter size `size-4`** or slightly smaller if it keeps label baseline tidy — **not** row-action `size-3` unless visually proven
  - [x] Wrap with existing `Tooltip` / `TooltipTrigger asChild` / `TooltipContent` + local or ambient `TooltipProvider delayDuration={0}` (same as `RowActionButton`)
  - [x] Button chrome: prefer quiet icon button; if `variant="ghost"`, **allowlist** in `control-contract.selfcheck.ts` (same class as jalali month chrome) — do not ship unclassified ghost
  - [x] Update `apps/web/components/icons/icon-contract.md` with the chosen lucide export + context (“field help / label info”)

- [x] Task 2: Wire into `FormField` (AC: #2, #4, #5)
  - [x] UPDATE `FormField`: when `help` is set, render info control **in the label row** (inline after label text / required marker), **not** as under-control `<p>`
  - [x] Keep under-control **error** block unchanged
  - [x] Preserve `htmlFor` / cloneElement wiring for `id`, `aria-required`, `aria-invalid`
  - [x] `aria-describedby`: keep linking the control to help (and error) ids — use a visually hidden element with the help id if the visible caption is removed, **or** document an equally strong AT path; do not silently drop describedby
  - [x] Label layout: `inline-flex items-center gap-1` (or equivalent) so the info icon sits beside the label without blowing `--form-label-column` (168px)

- [x] Task 3: Compact filter bars — UAT primary (AC: #1, #3)
  - [x] UPDATE `apps/web/components/dashboard/dashboard-filters.tsx`:
    - Move `operationalCopy.dashboardTeamFilterHint` from under-control `<p>` to label-adjacent help on «تیم (اختیاری)»
    - Move as-of `helperText="الزامی در حالت مبنا"` to label-adjacent help on «تاریخ مبنا»; pass `helperText=""` (falsy) to `JalaliDatePicker` so under-control caption is gone
  - [x] UPDATE `apps/web/components/reports/report-filters.tsx` the same way for team hint + as-of / range `helperText` strings that add vertical blocks
  - [x] Prefer `items-end` row alignment preserved; after change, control tops/baselines should match siblings without help-induced extra height

- [x] Task 4: Form surfaces + Jalali double-help honesty (AC: #4, #7)
  - [x] Migrate `FormField help=…` call sites so they pick up new chrome automatically (personnel-event, settings-parameter-editor, gallery)
  - [x] Where `FormField` wraps `JalaliDatePicker` **and** FormField already explains Effective Date, pass `helperText=""` to suppress the picker default under-control caption (avoid double help). Where FormField has no help, leaving the picker default is OK.
  - [x] Do **not** strip `JalaliDateTimePicker` mode banner / nested “بخش تاریخ” distinction without an explicit product decision — out of compact-filter misalignment scope unless it clearly duplicates FormField.help
  - [x] Gallery: update FormLayout demo help so reviewers see the new pattern

- [x] Task 5: Selfchecks + design-qa (AC: #5, #6)
  - [x] Extend `layout-system.selfcheck.ts` (or small dedicated assert): FormField no longer renders always-visible under-control help paragraph when help is set (source-level assert on pattern — avoid brittle snapshots)
  - [x] Ensure control-contract allowlist covers any new ghost usage
  - [x] Run `pnpm --filter @divan/web selfcheck:design-qa`
  - [x] Typecheck `@divan/web` for touched files

- [x] Task 6: DoD alignment (AC: #1–#7)
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; YAML UTF-8 without BOM
  - [x] Manual DoD below

### Manual DoD checklist

- [x] Dashboard filters: team hint and as-of helper are info-icon tooltips beside labels; filter controls share one visual baseline
- [x] Report filters: same for team / date helpers that previously sat under controls
- [x] Tab to info icon → tooltip appears; hover also works; Esc dismisses per Radix
- [x] Screen-reader / describedby path: field still associated with help text (manual spot-check or documented AT note)
- [x] Personnel-event `FormField` help appears on label row; validation errors still under control
- [x] No double Effective Date captions (FormField + Jalali default) on migrated fields
- [x] `selfcheck:design-qa` green; icon-contract updated; no new tooltip npm dependency
- [x] Epics 1–10 remain `done`; no LG-complete claim

### Review Findings

- [x] [Review][Patch] LabelWithHelp puts FieldHelpIcon + sr-only help inside `<label>` (pollutes control accessible name; click may activate control) — mismatch with FormField sibling pattern [apps/web/components/form-layout/field-help.tsx:105]
- [x] [Review][Patch] Personnel events filter action row uses fixed `h-control-height` with `flex-wrap` — wrapped buttons can clip/overlap [apps/web/components/personnel/personnel-events-list-panel.tsx:588]
- [x] [Review][Patch] FieldHelpIcon does not guard empty/whitespace-only `content` — empty tooltip + empty describedby target [apps/web/components/form-layout/field-help.tsx:37]
- [x] [Review][Defer] JalaliDatePicker default `helperText` not auto-suppressed when external `aria-describedby` is set — deferred, pre-existing default API; migrated call sites pass `helperText=""` [apps/web/components/jalali-date-picker.tsx:494]
- [x] [Review][Defer] Duplicated `filterSelectClass` / `filterSubmitClass` across dashboard and report filters — deferred, pre-existing [apps/web/components/dashboard/dashboard-filters.tsx:19]

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Label-adjacent info + tooltip on hover/focus | Leave under-control help paragraphs in compact filter bars |
| Shared reusable primitive + `FormField` | One-off DashboardFilters-only CSS |
| Keep errors under control + a11y describedby intent | Drop `aria-describedby` / invent parallel form layout |
| lucide + existing Tooltip | New icon/tooltip library; emoji “ⓘ” |
| `selfcheck:design-qa` green | Reopen Epics 1–10 or claim LG-complete |
| Allowlist ghost if used | Unclassified `variant="ghost"` (control-contract fail) |

### Epic 11 / prior carry-ins in force

- Authorized by `sprint-change-proposal-2026-08-07` — do not reopen Epics 1–10
- **11.1–11.3 done:** stale honesty, finalize path, Jalali month/year+RTL available for UAT
- Epic 10 open items (FeedbackMessage long-tail, typography, batched identity, PE/HC bulk honesty, settings cache, binder parity, AR fail-closed, production-honesty carry-forward) — **encode, do not resolve**
- Downstream **11.5** form surfaces; **11.6** capacity drawer; **11.7** Employment empty states — out of scope

### UPDATE files — current → change → preserve

#### `apps/web/components/form-layout/index.tsx` (`FormField` — primary)

- **Current:** `help` renders `<p id={helpId} className="text-caption text-text-tertiary">` under the control inside `space-y-1`. Label is plain text + required markers. `aria-describedby` merges help+error ids onto single-element children when `htmlFor` is set.
- **Change:** Move help chrome to label-adjacent `FieldHelpIcon` (or equivalent). Keep error under control. Preserve describedby association to help content for the control.
- **Preserve:** `FormLayout` max-width / padding / sticky `FormFooter`; `FormSection` fieldset/legend; required `*` + sr-only «(الزامی)»; `--form-label-column` / `--form-field-gap`; cloneElement a11y wiring.

#### `apps/web/components/dashboard/dashboard-filters.tsx` + `reports/report-filters.tsx`

- **Current:** Team hint = under-control `<p className="text-caption text-muted-foreground">`. As-of (and report range) use `JalaliDatePicker helperText` under the input. Form uses `flex flex-wrap items-end gap-3` — extra help height misaligns siblings (UAT evidence #1).
- **Change:** Label row + shared info icon; clear under-control helper blocks / falsy `helperText` on those pickers.
- **Preserve:** Apply/submit validation, EntityPicker hydrate, operational copy **strings**, filter state shape, commit() flow.

#### `apps/web/components/jalali-date-picker.tsx` (consumer discipline — light touch)

- **Current:** `helperText` default `"فقط تاریخ مؤثر (بدون ساعت)"`; renders under input when truthy. Empty string suppresses.
- **Change:** Prefer **call-site** `helperText=""` when FormField/label help owns the hint. Only change picker internals if needed for a clear API (e.g. document that `""` opts out of default) — avoid breaking DateTime mode chrome.
- **Preserve:** Public props from 11.3 (`value` Gregorian, `commit`, month/year panels, RTL chrome, ghost allowlist).

#### Icon contract + control-contract

- **Change:** Register chosen lucide icon; allowlist any new ghost field-help usage with an explicit reason string.
- **Preserve:** Existing row-action map and jalali ghost allowlist.

### Library / framework requirements

| Lib | Rule |
| --- | --- |
| `radix-ui` Tooltip via `components/ui/tooltip.tsx` | Keep — opens on focus + hover |
| `lucide-react` | Only icon library; add Info or CircleHelp to contract |
| `@divan/web` Button | Quiet icon trigger; ghost only if allowlisted |
| No new npm tooltip/popover packages | — |

### File structure requirements

- Touch primarily: `form-layout/*`, `dashboard-filters.tsx`, `report-filters.tsx`, icon-contract, layout-system / control-contract selfchecks, gallery demo; light consumer tweaks (`personnel-event-form` Jalali `helperText=""` where double-help)
- Do **not** add a parallel `packages/` form primitive — FormLayout lives in `apps/web`
- Do **not** add CSS modules solely for this pattern
- Story + sprint-status only under `_bmad-output/implementation-artifacts/`

### Testing requirements

- Mandatory: `pnpm --filter @divan/web selfcheck:design-qa`
- Extend layout-system (or equivalent) source assert for compact help pattern
- Manual DoD (dashboard + report filters + one FormField form + keyboard tooltip)
- No Vitest mandate; do not invent a new test runner

### Previous story intelligence (11.3)

- Presentation-only Epic 11 stories: Gate table, BOM-safe YAML, `design-qa` mandatory, explicit non-goals for sibling stories
- **11.3** left `helperText` public API stable — consume it; do not regress month/year or RTL chrome
- Review culture: source selfchecks preferred over brittle DOM snapshots; a11y ids/names must stay distinct
- Pattern: extend existing primitives in place; no parallel SoT

### Git intelligence

- Recent: `8785f3e` story 11.3 · `bcfda5d` story 11.2 · `238e365` story 11.1
- `FormField` / layout from Epic 8.2; Tooltip + `RowActionButton` from 8.7 (`d41b1d2`); dashboard filters EntityPicker retrofit in 8.5 (`e090c55`)
- Pattern: in-place chrome upgrade + selfcheck + design-qa; no domain churn

### Latest tech notes

- **Radix Tooltip:** content is exposed as accessible description via `aria-describedby` on the **trigger** (the info button). That does **not** automatically describe the **input**. Hence Task 2’s visually hidden / control `aria-describedby` requirement for field-level help.
- Prefer `TooltipProvider delayDuration={0}` for operational density (matches row actions).
- DESIGN.md tooltip tokens say navy chrome; shipped `tooltip.tsx` uses theme-matching `bg-popover` — **keep shipped primitive**; do not restyle to inverted navy solely for this story (would fight Epic 8 consistency).

### Project context reference

- No `project-context.md` found in repo at story creation time — follow Epic 11 gates + UX 2026-07-31 / FR-58 / proposal filter-help amendment + this file.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 11, Story 11.4, UX-DR7, UX-DR38, Story 8.2 / 8.9]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md` — Evidence #1, §4.4 Filter/form help, §4.5 Filter help OLD→NEW, success #4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-58, FR-59]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — tooltip, field-label, form spacing]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — tooltip a11y floor]
- [Source: `_bmad-output/implementation-artifacts/11-3-jalali-datepicker-month-year-rtl-chrome.md` — scope boundary + helperText preserve]
- [Source: `apps/web/components/form-layout/index.tsx` — FormField help under control]
- [Source: `apps/web/components/dashboard/dashboard-filters.tsx` — UAT misalignment]
- [Source: `apps/web/components/ui/row-action-button.tsx` — tooltip + aria-label pattern]
- [Source: `apps/web/components/icons/icon-contract.md`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- `pnpm --filter @divan/web selfcheck:design-qa` — green (control-contract + layout-system + remaining design-qa suite)
- `pnpm --filter @divan/web exec tsc --noEmit` — green

### Completion Notes List

- Added shared `FieldHelpIcon` + `LabelWithHelp` (lucide `Info`, quiet ghost, Radix Tooltip delay 0) under form-layout; ghost allowlisted in control-contract.
- `FormField.help` now renders label-adjacent info icon with sr-only help node for control `aria-describedby`; errors remain under the control.
- Migrated `DashboardFilters` and `ReportFilters` team/as-of/range helpers off under-control captions onto `LabelWithHelp`; compact pickers use `helperText=""`.
- Personnel-event Effective Date suppresses Jalali default caption when FormField owns help; DateTime mode banner untouched.
- Gallery FormLayout demo copy updated to describe label-adjacent help; icon-contract documents field-help `Info`.
- Migrated additional compact filter bars (personnel-events list team hint + date helpers; org historical as-of) to label-adjacent help. Left `current-person-state-foreshadow` under-control helper intact (اطلاعات پرسنلی exclusion).

### File List

- `apps/web/components/form-layout/field-help.tsx` (new)
- `apps/web/components/form-layout/index.tsx`
- `apps/web/components/dashboard/dashboard-filters.tsx`
- `apps/web/components/reports/report-filters.tsx`
- `apps/web/components/jalali-date-picker.tsx`
- `apps/web/components/personnel/personnel-event-form.tsx`
- `apps/web/components/personnel/personnel-events-list-panel.tsx`
- `apps/web/components/organization/historical-org-headcount-foreshadow.tsx`
- `apps/web/components/icons/icon-contract.md`
- `apps/web/app/(app)/dev/gallery/page.tsx`
- `apps/web/lib/control-contract.selfcheck.ts`
- `apps/web/lib/layout-system.selfcheck.ts`
- `_bmad-output/implementation-artifacts/11-4-compact-field-help-label-info-icon.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-08-07: Story context created (ready-for-dev) — compact label-adjacent field help for filters + FormField.
- 2026-08-07: Implemented compact field help (FieldHelpIcon / FormField / dashboard + report filters); design-qa green; status → review.
- 2026-08-07: Code review patches — LabelWithHelp sibling outside label; empty content guard; PE filter actions min-height; status → done.
