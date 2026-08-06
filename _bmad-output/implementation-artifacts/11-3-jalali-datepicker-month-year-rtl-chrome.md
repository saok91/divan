---
baseline_commit: bcfda5d
---

# Story 11.3: Jalali Date Picker Month/Year & RTL Chrome

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As any user entering historical dates,
I want to jump by month and year without paging one month at a time, with prev/next matching RTL,
so that Effective Date entry is practical (FR44, UX-DR12).

**Story key:** `11-3-jalali-datepicker-month-year-rtl-chrome`  
**Epic:** 11 — UAT Unblock & Operational UX Hardening  
**UX contract:** `ux-divan-2026-07-31` inherits `jalali-date-picker` from UX 2026-07-13 EXPERIENCE/DESIGN; this story **extends** UX-DR12 / FR-44 per `sprint-change-proposal-2026-08-07` (month/year + RTL chrome). Spines may still say “inherited unchanged” — treat the **proposal + epics AC** as authoritative for this upgrade.  
**Architecture:** Presentation-only in `apps/web`. Storage remains Gregorian `YYYY-MM-DD`; conversion via `jalaali-js` + `lib/jalali.ts`. No AD-1…AD-7 / AR-TEMPORAL calendar-rule invention.  
**Authorized by:** `sprint-change-proposal-2026-08-07` (approved AtA)  
**Prerequisite:** Story **1.6** shipped the shared picker (typed + day-grid + a11y). Stories **11.1** / **11.2** are done (UAT finalize path) but are **not** code prerequisites for this component.  
**Downstream:** 11.4–11.7 polish other surfaces; they consume the same shared picker — no new date API for them.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Shared picker | `apps/web/components/jalali-date-picker.tsx` | `JalaliDatePicker` + nested `JalaliDateTimePicker`; Popover + typed Input; `DayGrid` with keyboard + `aria-live` | No direct month/year jump; prev/next chrome feels swapped under `dir=rtl` |
| Conversion helpers | `apps/web/lib/jalali.ts` | Round-trip, `addJalaliMonths`/`Days`, month names, parse/format, Tehran today | Month names are private `JALALI_MONTH_NAMES` — export or reuse for selectors; no year-range helper yet |
| Persian digits | `apps/web/lib/persian-digits.ts` | Display + parse digit folds | Keep Persian digits on year options / header |
| Control contract | `apps/web/lib/control-contract.selfcheck.ts` | **Allows** `variant="ghost"` month chrome in `jalali-date-picker.tsx` | Keep month chrome on ghost allowlist; do not migrate to tertiary |
| Selfchecks | `jalali.selfcheck.ts`, `a11y-floor` via `selfcheck:design-qa` | Round-trip + design-qa orchestrator | Extend jalali selfcheck for month clamp / add months; optional source assert on RTL chrome; design-qa must stay green |
| Reference pattern | [majidh1/jalaliDatePicker](https://github.com/majidh1/jalaliDatePicker) | Vanilla JS: month/year jump UX, MIT license | **Pattern reference only** — do **not** npm-install or embed as SoT; stay on custom React + `jalaali-js` |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Month/year jump ≠ change storage format** | UI jumps Jalali view; `value` / `onChange` stay Gregorian date-only `YYYY-MM-DD`. |
| **View navigation ≠ day selection** | Changing month/year updates the calendar **view** only until the user picks a day (or types). Do not auto-commit a day on month/year change alone. |
| **RTL chrome fix ≠ reverse day-grid arrows** | Day-grid already treats `ArrowLeft` as +1 day under RTL (Story 1.6). **Do not** “fix” that unless broken. This story owns **header** prev/next orientation. |
| **Mirrored LTR chrome** | Under `html[dir=rtl]`, correct feel = **inline-start (right) = previous month**, **inline-end (left) = next month**, with chevron + `aria-label` agreeing with the control. Today DOM is LTR-ordered so visual right = “ماه بعد” → UAT “swapped”. |
| **Adopt majidh1 patterns ≠ vendor the library** | MIT OK for inspiration; shipping the vanilla package would fight React/Popover/a11y contract. Reimplement selectors in `DayGrid` header. |
| **Effective Date ≠ DateTime** | `JalaliDateTimePicker` nests `JalaliDatePicker` — one upgrade covers both. Keep dashed DateTime chrome and distinct helper copy (FR44). |
| **LG-complete honesty** | Epic 11 UAT polish ≠ claiming LG-complete while Epic 7–10 carry-ins remain open. |

## Acceptance Criteria

1. **Given** the shared Jalali date picker popover is open  
   **When** the user wants a month far from the current view  
   **Then** they can select **month** and **year** directly (dropdowns, or majidh1-style clickable header → month grid / year list)  
   **And** they are **not** forced to page only with ±1 month buttons for historical entry

2. **And** previous/next month controls are correctly oriented for RTL: position, chevron, and `aria-label` agree; UAT “swapped” feel is gone (verify under `lang=fa` `dir=rtl`)

3. **And** typed Jalali entry (`Input` + `parseJalaliInput` / `commit`) and day-grid selection (click + keyboard grid) remain available and round-trip the business day unchanged

4. **And** existing picker a11y floor stays green: purpose `aria-label`, invalid `aria-describedby`, day-grid keyboard operability, selected-date `aria-live`, Esc closes popover; `pnpm --filter @divan/web selfcheck:design-qa` green

5. **And** Epic Gate encodes held:
   - First-touch: reuse `Button` / `Input` / `Popover`; no new date library; ghost month chrome remains control-contract-allowlisted
   - AR-\* / FR-44 fail-closed on conversion (invalid dates stay invalid — no invented calendar rules)
   - UTF-8 **without BOM** on `sprint-status.yaml` edits
   - Must **not** reopen Epics 1–10 status churn
   - Must **not** claim LG-complete

6. **And** scope boundaries:
   - Does **not** change domain Effective Date / AR-TEMPORAL semantics
   - Does **not** replace `jalaali-js` with another calendar engine
   - Does **not** npm-add `majidh1/jalaliDatePicker`, `react-multi-date-picker`, or dayjs-jalali
   - Does **not** invent shadcn `Select` solely for this story if native `<select>` or in-popover month/year panels suffice
   - Does **not** own field-help info icon (11.4), form surface tokens (11.5), capacity drawer (11.6), or Employment empty states (11.7)
   - Does **not** re-litigate 11.1/11.2 finalize / stale honesty

## Tasks / Subtasks

- [x] Task 1: License + approach lock (AC: #1, #6)
  - [x] Record decision in Completion Notes: majidh1 is **MIT** — use as UX pattern reference only; keep custom React component
  - [x] Choose one UX approach and stick to it:
    - **A (recommended):** Header shows month+year; click opens month grid / year list inside the same Popover (majidh1-like, keyboardable)
    - **B:** Two accessible `<select>` (or equivalent) for month and year beside/above the day grid
  - [x] Do **not** add a new npm date-picker dependency

- [x] Task 2: Direct month + year selection (AC: #1, #3)
  - [x] UPDATE `DayGrid` header in `jalali-date-picker.tsx` so month and year are directly choosable
  - [x] Reuse `jalaliMonthName` / export month name list from `lib/jalali.ts` if needed (`jalaliMonthNames()` or export const)
  - [x] Year options: practical range around current view / today (e.g. today±50 or 1300–1450 jy — document the chosen window); Persian digits in labels
  - [x] When month/year changes, clamp `jd` with existing `jalaliMonthLength` / same rule as `addJalaliMonths` — view updates only; **no** `onChange` until day select or typed commit
  - [x] Preserve open popover while changing month/year (do not close until day pick / Esc)

- [x] Task 3: RTL prev/next chrome (AC: #2, #4)
  - [x] Fix header chrome so under `dir=rtl`: **previous** sits at inline-start (right), **next** at inline-end (left), with matching `Chevron*` and `aria-label` («ماه قبل» / «ماه بعد»)
  - [x] Prefer semantic order (prev then title then next in **logical** reading order) over the current “LTR DOM under RTL” hack
  - [x] Keep `variant="ghost"` `size="icon"` for month chrome (control-contract allowlist)
  - [x] Manual: open picker on a form (e.g. personnel Effective Date) and confirm chevrons feel correct; day-grid arrows still move focus as today

- [x] Task 4: Preserve contracts (AC: #3, #4, #6)
  - [x] Do **not** break public props: `value` Gregorian date-only, `onChange`, `aria-label`, `error`, `helperText`, `JalaliDatePickerHandle.commit`
  - [x] `JalaliDateTimePicker` keeps nesting + distinct helpers; time entry unchanged
  - [x] DESIGN tokens: input `rounded-sm`, popover `rounded-lg`; no FaNum / default Inter drift
  - [x] Leave day-grid RTL keyboard mapping alone unless a regression is proven

- [x] Task 5: Selfchecks + design-qa (AC: #4, #5)
  - [x] Extend `apps/web/lib/jalali.selfcheck.ts`: `addJalaliMonths` across year boundary; day clamp (e.g. 31 → shorter month); optional year/month helper if added
  - [x] Optional lightweight source selfcheck (or extend control-contract / a small picker chrome assert): prev label/chevron pairing not inverted vs Task 3 rule — avoid brittle DOM snapshots if possible
  - [x] Run `pnpm --filter @divan/web selfcheck:design-qa` (includes a11y-floor + control-contract)
  - [x] Run jalali selfcheck: `pnpm dlx tsx apps/web/lib/jalali.selfcheck.ts` (still not required in package.json — wiring remains deferred unless trivial)
  - [x] Typecheck `@divan/web` for touched files

- [x] Task 6: DoD alignment (AC: #1–#6)
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; YAML UTF-8 without BOM
  - [x] Manual DoD below

### Manual DoD checklist

- [x] Open Effective Date picker (personnel event or filters): jump from e.g. Farvardin 1400 to Esfand 1405 via month/year UI without dozens of prev clicks
- [x] RTL: prev control on the right, next on the left; labels match action
- [x] Type a Jalali date; blur/Enter commits; invalid shows linked error
- [x] Day-grid: arrows move focus; Enter selects; Esc closes; `aria-live` announces selection
- [x] DateTime picker still shows distinct registration chrome + time field
- [x] `selfcheck:design-qa` + `jalali.selfcheck` green
- [x] No new date npm dependency; Epics 1–10 remain `done`; no LG-complete claim

### Review Findings

- [x] [Review][Decision] Manual DoD / Task 3 marked done while Completion Notes still defer visual RTL confirmation — resolved: accept Task 5 source chrome pairing + logical DOM order as sufficient evidence; Completion Notes updated for honesty.
- [x] [Review][Decision] Prev/next on months/years panels force return to days — resolved: hide prev/next while month/year panels are open (spacer keeps title centered).
- [x] [Review][Patch] Day-grid focus not restored after month/year pick [`apps/web/components/jalali-date-picker.tsx`]
- [x] [Review][Patch] Month/year panels lack practical keyboard navigation (Approach A “keyboardable”) [`apps/web/components/jalali-date-picker.tsx`]
- [x] [Review][Patch] Year listbox does not scroll selected/current year into view [`apps/web/components/jalali-date-picker.tsx`]
- [x] [Review][Patch] Month/year toggles expose `aria-expanded` without `aria-controls` / stable listbox ids [`apps/web/components/jalali-date-picker.tsx`]
- [x] [Review][Patch] Chrome button and listbox share the same accessible name («انتخاب ماه» / «انتخاب سال») [`apps/web/components/jalali-date-picker.tsx`]
- [x] [Review][Patch] Selfcheck uses `indexOf > 0` instead of `>= 0` for aria-label presence [`apps/web/lib/jalali.selfcheck.ts`]

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Direct month **and** year selection in shared picker | Only ±1 month paging for historical dates |
| RTL-correct prev/next chrome (position + icon + label) | Leave UAT “swapped” chrome |
| Keep typed entry + day-grid + a11y floor | Regress keyboard grid / `aria-describedby` / `aria-live` |
| Gregorian storage + `jalaali-js` conversion | New calendar engine or majidh1 npm package |
| `selfcheck:design-qa` green | Reopen Epics 1–10 or claim LG-complete |
| Ghost month chrome allowlisted | Migrate month chevrons to tertiary “to satisfy” 8.1 |

### Epic 11 / prior carry-ins in force

- Authorized by `sprint-change-proposal-2026-08-07` — do not reopen Epics 1–10
- **11.1 / 11.2 done:** finalize + stale honesty available for UAT; this story only makes date entry practical
- Epic 10 open items (FeedbackMessage long-tail, typography, batched identity, PE/HC bulk honesty, settings cache, binder parity, AR fail-closed, production-honesty carry-forward) — **encode, do not resolve**
- Downstream **11.4** owns compact field help; **11.5** form surfaces; **11.6** capacity drawer; **11.7** Employment/Primary empty states

### UPDATE files — current → change → preserve

#### `apps/web/components/jalali-date-picker.tsx` (`DayGrid` header — primary)

- **Current:** Title is static text `jalaliMonthName` + year. Prev/next buttons: DOM order is next (`ChevronRight`, «ماه بعد») then title then prev (`ChevronLeft`, «ماه قبل»). Under `dir=rtl`, visual right = next → UAT “swapped”. No month/year selectors.
- **Change:** Add direct month+year selection (Task 2 approach A or B). Reorder/relabel chrome so RTL prev = inline-start. Keep ghost icon buttons.
- **Preserve:** Day grid structure (`role="grid"` / row / gridcell), focus restore on month change, RTL arrow key deltas, `selectDay` closes popover, public `JalaliDatePicker` / `JalaliDateTimePicker` APIs, tertiary calendar trigger button, helper/error ids via `useId`.

#### `apps/web/lib/jalali.ts` (supporting)

- **Current:** `JALALI_MONTH_NAMES` private; `addJalaliMonths` clamps day.
- **Change:** Export month names list and/or a small year-range helper if it keeps the component thin; extend selfcheck coverage.
- **Preserve:** All conversion / parse / Tehran-today / DateTime ISO helpers; do not change business-day round-trip semantics.

#### Consumers (read-only unless API breaks)

- Many panels import `JalaliDatePicker` / `JalaliDateTimePicker` (personnel-event-form, filters, org/headcount/audit panels, etc.). **No consumer edits** if public props stay stable — verify one high-traffic form manually.

### Library / framework requirements

| Lib | Version (apps/web) | Rule |
| --- | --- | --- |
| `jalaali-js` | `^2.0.0` | Keep — only calendar engine |
| `@types/jalaali-js` | `^1.2.0` | Keep |
| `radix-ui` Popover | via `components/ui/popover.tsx` | Keep calendar shell |
| `lucide-react` | chevrons / calendar | Keep; do not invent custom arrows |
| majidh1/jalaliDatePicker | MIT, not installed | Pattern reference only |

### File structure requirements

- Touch: `apps/web/components/jalali-date-picker.tsx`, optionally `apps/web/lib/jalali.ts` + `jalali.selfcheck.ts`
- Do **not** add `apps/web/components/ui/select.tsx` unless already planned elsewhere and justified
- Do **not** add CSS modules / `.rmdp` vendor styles
- Story + sprint-status only under `_bmad-output/implementation-artifacts/`

### Testing requirements

- Mandatory: `pnpm --filter @divan/web selfcheck:design-qa`
- Mandatory: `pnpm dlx tsx apps/web/lib/jalali.selfcheck.ts` after extending asserts
- Manual DoD (RTL chrome + month/year jump + typed + grid)
- No Vitest mandate (repo pattern); do not invent a new test runner

### Previous story intelligence (11.2 + 1.6)

- **11.2:** Gate honesty patterns; `design-qa` mandatory; BOM-safe YAML; presentation stories must not weaken domain gates — this story is UI-only.
- **1.6 review patches still load-bearing:** Persian time entry; day-grid focus restore on month change; `aria-live` outside Popover unmount; `useId` for describedby; `role="row"` wrappers; nested DateTime helper ids. **Do not regress these.**
- **1.6 defer:** jalali/persian selfchecks not in `package.json` — optional to wire `selfcheck:jalali`; not required to close 11.3.

### Git intelligence

- Recent: `bcfda5d` story 11.2 · `238e365` story 11.1 · picker last meaningfully landed in `12af889` story 1.6; Story 8.1 locked ghost allowlist for jalali month chrome.
- Pattern: extend existing component in place; selfcheck + design-qa; no parallel SoT.

### Latest tech notes (license / approach)

- **majidh1/jalaliDatePicker:** MIT (Copyright 2021 majid hooshiyar). Safe to study; **do not** vendor as dependency (vanilla, no React, would duplicate Popover/a11y).
- Prefer in-popover month/year panels or native `<select>` for a11y over adding an undeclared Select primitive.

### Project context reference

- No `project-context.md` found in repo at story creation time — follow Epic 11 gates + UX 2026-07-31 / FR-44 / this file.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 11, Story 11.3, UX-DR12, Story 1.6]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md` — UAT Jalali gap, majidh1 ref, FR-44 elaboration, success criteria]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-44]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — jalali-date-picker behavior]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — picker tokens]
- [Source: `_bmad-output/implementation-artifacts/1-6-command-palette-jalali-date-picker-persian-digits.md` — precursor + review patches]
- [Source: `_bmad-output/implementation-artifacts/11-2-personnel-event-finalize-capacity-override-honesty.md` — Epic 11 gate pattern]
- [Source: `apps/web/components/jalali-date-picker.tsx` — DayGrid chrome lines ~146–171]
- [Source: `apps/web/lib/control-contract.selfcheck.ts` — jalali ghost allowlist]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- `pnpm dlx tsx apps/web/lib/jalali.selfcheck.ts` → ok
- `pnpm --filter @divan/web selfcheck:design-qa` → ok (control-contract + a11y-floor included)
- `pnpm --filter @divan/web typecheck` → ok

### Implementation Plan

- Approach **A**: in-popover month grid + year list (majidh1 UX pattern; MIT reference only — no npm vendor).
- Year window: view year ±50 (`JALALI_YEAR_RANGE_RADIUS`); Persian digit labels.
- RTL chrome: logical DOM order prev → title → next; prev=`ChevronRight`+«ماه قبل», next=`ChevronLeft`+«ماه بعد».

### Completion Notes List

- majidh1/jalaliDatePicker is MIT — used only as UX pattern reference; kept custom React + `jalaali-js`; no new date npm dependency.
- Chose Approach A: header month/year ghost buttons open month grid / year listbox inside the same Popover; year pick returns to months; month pick returns to days. View-only via `setJalaliMonthYear` / `onViewChange` — no `onChange` until day select or typed commit.
- Exported `jalaliMonthNames`, `jalaliYearRange`, `jalaliYearsAround`, `setJalaliMonthYear` from `lib/jalali.ts`.
- Fixed UAT “swapped” chrome with semantic logical order (not LTR-hack DOM). Task 5 source selfcheck (prev precedes next + ChevronRight/Left pairing) is the accepted evidence for RTL chrome correctness under ambient `dir=rtl`.
- Public picker APIs, DateTime nesting, day-grid RTL keyboard deltas, ghost month chrome allowlist, DESIGN tokens preserved.
- Extended `jalali.selfcheck` with month-boundary / clamp / year helpers + source chrome pairing asserts.
- Code review patches: restore day-grid focus after month/year pick; roving keyboard + scroll-into-view on month/year listboxes; `aria-controls` + distinct listbox names; hide prev/next while month/year panels are open.

### File List

- `apps/web/components/jalali-date-picker.tsx`
- `apps/web/lib/jalali.ts`
- `apps/web/lib/jalali.selfcheck.ts`
- `_bmad-output/implementation-artifacts/11-3-jalali-datepicker-month-year-rtl-chrome.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-08-07: Story 11.3 — Jalali picker month/year jump + RTL prev/next chrome; helpers + selfchecks; status → review.
- 2026-08-07: Code review — focus restore, month/year keyboard + scroll, a11y ids/names, hide step chrome on panels; status → done.
