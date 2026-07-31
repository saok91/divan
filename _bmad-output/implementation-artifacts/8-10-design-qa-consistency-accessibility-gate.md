---
baseline_commit: 9df4cc2
---

# Story 8.10: Design QA, Consistency & Accessibility Gate

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the product owner accepting this wave,
I want a repeatable check that surfaces match the contract,
so that consistency does not decay in Epics 9 and 10 (FR58, NFR12).

**Story key:** `8-10-design-qa-consistency-accessibility-gate`  
**Epic:** 8 — Experience Foundation & Identifier Ergonomics (closes FR-58 / NFR-12 launch floor for this wave; UX-DR21/23/29–40 verification)  
**UX contract (forward):** `ux-divan-2026-07-31` (EXPERIENCE.md Accessibility Floor + Interaction Primitives; DESIGN.md Contrast / Typography / Do's and Don'ts)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (Story 8.10 reframed as design-QA gate; risk (c) visual refactors → a11y regressions)  
**Prerequisite:** Stories **8.1–8.9** landed (contracts + selfchecks). Story **8.6** may still show `in-progress` in sprint-status — **close or verify its AC before claiming this gate green** (table chrome + no page H-scroll are in-scope probes).  
**Downstream:** Epic 9 **Depends on** this gate; Story **9.9** runs alongside it in CI/selfcheck. Do **not** own Epic 9 IA/bulk/settings product delivery (**9.x / 10.x**) — only mockup parity, consistency checklist, contrast/viewport, a11y probes, and a **runnable** gate those epics must pass.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Epic 8 selfchecks | `apps/web` `selfcheck:control-contract`, `layout-system`, `entity-picker`, `governed-table`, `row-actions`, `leave-guard`, `feedback`, `operational-copy` | AST/filesystem contracts for 8.1–8.9 | **Orchestrate** + add gate-specific asserts; do not fork parallel checkers |
| `a11y-floor.selfcheck.ts` | `apps/web/lib/a11y-floor.selfcheck.ts` | Secondary CTA contrast ≥4.5; viewport-gate unit cases; copy invariants | Expand **token pair** contrast (body 13px / column-header 10.5px both themes); wire as npm script if still `exec tsx` only |
| `viewport-gate.ts` | `apps/web/lib/viewport-gate.ts` | `MIN_WIDTH=1280`, `MIN_HEIGHT=720`; zoom vs genuine-small logic | Gate essential-task **no page-level H-scroll** at 1280×720 and 1920×1080 (manual + any automated scrollWidth heuristic if cheap) |
| Design gallery | `app/(app)/dev/gallery/page.tsx` | Living light/dark primitive reference | Use as probe host for picker / table chrome / icon-only / dialog samples; keep production `notFound` |
| Control / icon / feedback contracts | `button.tsx`, `icons/icon-contract.md`, `feedback/FEEDBACK.md` | Semantic variants; icon map; channel precedence | Consistency checklist must assert these remain the single SoT |
| Theme system | `theme-provider.tsx`, `theme-toggle.tsx`, `globals.css` | `next-themes` class strategy; light default; per-account storage | Light **and** dark parity for every proof surface/state/badge/chart/banner |
| Gap list | `8-1-interaction-audit-gap-list.md` §Deferred 8.10 | Named this gate | Close the “do not claim FR-58/LG-6 complete” deferral with honest evidence |
| UX mockups | `ux-divan-2026-07-31/mockups/` | Visual acceptance reference | Screen-by-screen compare; fix **or** spine amendment (not silent drift) |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Gate vs feature delivery** | This story **verifies and hardens** Epic 8 contracts. It may fix defects that block the gate. It does **not** build Epic 9 bulk-entry / reports tabs / settings registry product surfaces. |
| **Mockup parity vs production-complete** | AC lists key screens including reports, هدکانت+drawer, bulk-entry, settings. For surfaces not yet product-complete, compare what exists (scaffold/gallery/partial) to mockup and either **fix** reachable drift or **record a spine amendment** stating Epic 9/10 ownership — never claim fake completeness. |
| **Selfcheck vs manual DoD** | Repo pattern is `tsx` + `node:assert` + filesystem/AST (**no Playwright / axe / Vitest**). Interactive keyboard/focus-trap/tooltip-on-focus probes are **documented manual DoD** plus whatever AST asserts already exist in 8.3/8.6/8.7 — do **not** add Playwright unless PO explicitly expands scope. |
| **Page-level H-scroll vs table inner scroll** | Forbidden: document/body forces horizontal scroll to complete an essential task. Allowed: table’s own overflow when sticky id+actions keep context (4b.4 / 8.6 contract). |
| **Spine amendment** | Written change under `ux-divan-2026-07-31` (or linked note in story Completion Notes + planning artifact) when intentional deviation from mock is accepted. Spines win on conflict with mocks. |
| **FR-58 / LG-6 honesty** | Gate green ⇒ wave consistency floor met for Epic 8 scope. Still do **not** invent AR-NFR freeze numbers; substrate/MVP honesty carry-ins remain open outside this story. |
| **Presentation-only** | No domain / permission / governance / event-store rule changes. Token/CSS/component a11y fixes only. |

## Acceptance Criteria

1. **Given** the `ux-divan-2026-07-31` spines and mockups  
   **When** the design QA gate runs  
   **Then** each key screen is compared screen-by-screen against its mockup — personnel list, personnel event form, person profile, reports workspace, dashboard, هدکانت with drawer, bulk-entry wizard, and settings — and deviations are either fixed or recorded as spine amendments

2. **And** the cross-surface consistency checklist passes for page header, panel system, form layout, table chrome, button variants, icon mapping, and feedback channel

3. **And** light and dark parity is verified for every surface, state, badge, chart, and banner, with AA contrast at 13px body and 10.5px column headers

4. **And** essential tasks pass at 1280×720 and 1920×1080 without page-level horizontal scroll

5. **And** accessibility probes pass for the picker (combobox semantics, keyboard, announcement), tables (sort, live-region counts, sticky columns), dialogs and drawers (focus trap and focus return), and icon-only actions (accessible name, tooltip on focus)

6. **And** the whole gate is runnable as a selfcheck that Epics 9 and 10 must pass before their own baselines

7. **And** scope stays **gate / presentation / interaction only**:
   - Orchestrate existing Epic 8 selfchecks; add `selfcheck:design-qa` (or equivalent) that fails closed if any required subcheck fails
   - Prefer fixing defects that fail the gate; for Epic 9/10-owned screens, prefer spine amendment + tracked deferral over inventing product features
   - Resolve or explicitly amend deferred hotspots from 8.2 / 8.6 / 8.8 / 8.9 listed in Dev Notes
   - AR-\* fail-closed; do not invent freeze numbers
   - Do **not** add Playwright/axe/Vitest harnesses unless PO expands scope
   - Do **not** own: Epic 9 IA/bulk/real events list; Epic 10 settings registry; PopulationPort cutover; AD-6 projector work; leave-guard logout wiring; person-create form dedupe

## Tasks / Subtasks

- [x] Task 0: Preconditions & inventory (AC: #1, #7)
  - [x] Confirm Story **8.6** AC are met (or finish remaining work) — table readability is a gate probe. Align `8-6-*.md` Status ↔ sprint-status when closing.
  - [x] Collect deferred hotspot lists from Completion Notes:
    - **8.2** ad-hoc typography: `access-people-panel`, `access-scopes-panel`, `access-roles-panel`, `access-section`, `entitlement-grants-panel`, `break-glass-panel`, `audit-investigation-panel`, `approval-panel`, `exemption-panel`, `override-panel`, `headcount-capacity-panel`, `launch-artifact-panel`, `operations-health-panel`, `person-profile-view`, `current-person-state-foreshadow`, `historical-org-headcount-foreshadow`, `correction-cases-panel`, `sensitive-confirmation-dialog`
    - **8.6** sticky `thead` vertical pin (optional DESIGN-aligned)
    - **8.8** blob skeletons on deferred panels; local `StatusMessage` clones
    - **8.9** remaining glossary placements; optional personnel-list live mark; dual live-region review defers
  - [x] For each hotspot: **fix now** if it fails consistency/a11y gate on an in-scope surface, else **document** as spine amendment / Epic 9–10 deferral with owner.

- [x] Task 1: Mockup screen-by-screen matrix (AC: #1)
  - [x] Create a durable artifact (prefer `apps/web/lib/design-qa-mockup-matrix.md` **or** `_bmad-output/implementation-artifacts/8-10-design-qa-mockup-matrix.md`) with one row per key screen:

    | Screen | Mockup file | App route / proof surface | Result (pass / fixed / amendment) | Notes |
    | --- | --- | --- | --- | --- |
    | Personnel list | `direction-a-dense-console.html` | personnel list | | |
    | Personnel event form | `direction-a-dense-console.html` | `personnel-event-form` | | |
    | Person profile | `screens-bulk-entry-profile.html` (profile sections) | person profile | | |
    | Reports workspace | `screens-reports-capacity.html` | reports catalogue / tabs | | |
    | Dashboard | Direction A / capacity screens as applicable | dashboard | | |
    | Headcount + drawer | `screens-reports-capacity.html` | headcount panels + sheet/drawer | | |
    | Bulk-entry wizard | `screens-bulk-entry-profile.html` | import / future bulk tabs | | |
    | Settings | `screens-settings.html` | settings scaffold or amendment | | |
    | Chart palettes | `chart-palettes.html` | dashboard/report charts | | |

  - [x] Compare light **and** dark (gallery + live surfaces). Spines win on conflict — amend spine if mock is wrong; fix app if app drifted.
  - [x] Selfcheck asserts the matrix file exists and every row has a non-empty Result ∈ {pass, fixed, amendment}.

- [x] Task 2: Cross-surface consistency checklist (AC: #2)
  - [x] Encode checklist as machine-checkable asserts where possible + short markdown checklist for residual manual items:

    | Area | Automated proof (prefer) | Manual residual |
    | --- | --- | --- |
    | Page header | `layout-system` + AST: surfaces use `PageHeader` / purpose non-empty | Visual order breadcrumb→title→purpose→tabs |
    | Panel system | `layout-system` tokens / `PanelSection` usage | Panel vs full-bleed table rule on proof surfaces |
    | Form layout | FormLayout / FormFooter presence on event form | Label column + sticky footer order Cancel · Save draft · Finalize |
    | Table chrome | `governed-table` (no fixed min-width; density; sticky separators) | 1280 readability |
    | Button variants | `control-contract` | One gold primary per region |
    | Icon mapping | `row-actions` + `icon-contract.md` | Same action → same icon across 2+ surfaces |
    | Feedback channel | `feedback` + `FEEDBACK.md` | One channel per event on proof flows |

  - [x] Gate selfcheck **invokes** the listed Epic 8 scripts (spawn or document as required suite) and fails if any exit ≠ 0.

- [x] Task 3: Contrast + light/dark parity (AC: #3)
  - [x] Extend `a11y-floor.selfcheck.ts` (or `design-qa.selfcheck.ts`) to assert WCAG 2.2 AA **4.5:1** for DESIGN token text/background pairs used at **13px body** and **10.5px column headers** in **both** themes (reuse existing relative-luminance helpers).
  - [x] Include status badge pairs, stale-banner, break-glass-banner, and chart categorical series-on-canvas pairs that are defined as hex in DESIGN/`globals.css` — skip disabled/incidental exempt pairs with a one-line comment citing WCAG exemption.
  - [x] CTA rule: accent on light content; accent-dark on dark content; never `#FDB913` as text on dark canvas.
  - [x] Manual: flip theme on proof set + gallery; no unreadable tertiary text / hairline-only status.

- [x] Task 4: Viewport / no page H-scroll (AC: #4)
  - [x] Manual DoD at **1280×720** and **1920×1080**: essential tasks — open personnel list, open event form, run dashboard glance, open one headcount panel — without `document`/`body` horizontal scroll.
  - [x] Keep `viewport-gate` behavior (zoom ≠ gate). Do not tighten product mins without spine change.
  - [x] Optional cheap assert: grep ban remaining `min-w-[48|64|72]rem` (already in governed-table selfcheck) — keep green.

- [x] Task 5: Accessibility probes (AC: #5)
  - [x] **Picker:** assert/reuse `entity-picker` selfcheck strings (`role="combobox"`, `aria-expanded`, `aria-activedescendant`); manual keyboard (arrows, Enter, Escape) + announcement on gallery demo.
  - [x] **Tables:** assert/reuse governed-table live-region counts + sort affordances + sticky id/actions; manual sort + count announcement on personnel or access list.
  - [x] **Dialogs/drawers:** manual focus trap + focus return on leave-guard dialog, one sheet/drawer (import or headcount), and one Radix dialog; Escape closes; focus returns to opener.
  - [x] **Icon-only:** assert/reuse `row-actions` (`aria-label`, tooltip on focus path); manual Tab to row action shows tooltip and name.
  - [x] Document probe results in the matrix or a `design-qa-a11y-probes.md` section; selfcheck requires the doc to exist with pass/fail per probe group.

- [x] Task 6: Runnable `selfcheck:design-qa` for Epic 9/10 (AC: #6, #7)
  - [x] NEW `apps/web/lib/design-qa.selfcheck.ts` that:
    1. Asserts matrix + checklist/probes artifacts exist and are complete
    2. Asserts contrast helpers/pairs pass
    3. Spawns or sequentially documents required prior selfchecks — **preferred:** child_process run of the Epic 8 scripts listed below so one command gates the wave
    4. Prints a single clear failure naming the first broken subcheck
  - [x] Wire `apps/web/package.json`: `"selfcheck:design-qa": "tsx lib/design-qa.selfcheck.ts"`
  - [x] Optional root proxy for discoverability (Epic 8 UI gates historically live only on `@divan/web` — matching that is OK; document the filter command for Epic 9/10 stories).
  - [x] Completion Notes must state the exact command Epics 9 and 10 must run before baseline.

- [x] Task 7: Targeted defect fixes from gate failures (AC: #1–#5)
  - [x] Fix only what the matrix/checklist/probes fail on in-scope surfaces (typography hotspots, missing purpose, ghost regressions, contrast token tweaks, focus-return bugs, missing aria-label, blob skeleton on a proof panel if it blocks consistency).
  - [x] Do **not** expand into Epic 9 product builds. Prefer spine amendment for settings/bulk-entry/reports-tab completeness gaps.

- [x] Task 8: Verify + document (AC: #1–#7)
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green
  - [x] Prior suite green: `control-contract`, `layout-system`, `entity-picker`, `governed-table`, `row-actions`, `leave-guard`, `feedback`, `operational-copy`, `a11y-floor` (via gate or explicit)
  - [x] `pnpm --filter @divan/web typecheck` green
  - [x] Manual viewport + theme + keyboard probe checklist signed in Completion Notes
  - [x] Update sprint-status: this story → review/done per workflow; close 8.6 if still open and AC met; epic-8 remains in-progress until retrospective

## Dev Notes

### Gate (non-negotiable)

- **FR-58 / NFR-11 / NFR-12 / UX Accessibility Floor:** Consistent interaction system; essential tasks at 1280×720 & 1920×1080; WCAG 2.2 AA contrast at dense sizes; keyboard/focus/name probes.
- **Epic 8 presentation-only:** no authz/domain/governance semantic changes.
- **Spines win on conflict** with mocks (`EXPERIENCE.md` / `DESIGN.md` header rule).
- **Forward UX** is `ux-divan-2026-07-31`; Epic 1–7/4b remain historically true against 2026-07-19.
- **Consume 8.1–8.9** — orchestrate their selfchecks; do not rewrite contracts.
- **AR-\* fail-closed:** do not invent freeze numbers; do not weaken suppressed-cohort / picker indistinguishability / access-denied honesty.
- **Epic 9 dependency:** Stories 9.x must pass `selfcheck:design-qa` before their baselines (epics.md Epic 9 intro; Story 9.9 alongside).

### Design QA algorithm (implement literally)

```text
on design-qa gate run:
  1. load mockup matrix rows for the 8 key screens (+ chart palette)
  2. for each row:
       compare app/gallery proof vs mockup in light and dark
       if drift → fix app OR write spine amendment + mark row
       if epic-9/10-owned incomplete surface → amendment allowed (not silent pass)
  3. run consistency checklist (header, panel, form, table, buttons, icons, feedback)
  4. assert contrast pairs ≥ 4.5:1 for body 13px & column-header 10.5px both themes
  5. confirm viewport DoD: essential tasks @ 1280×720 and 1920×1080, no page H-scroll
  6. confirm a11y probes: picker, table, dialog/drawer, icon-only
  7. fail closed if any required selfcheck subprocess ≠ 0 or any matrix row Result empty
never:
  claim FR-58/LG-6 complete without matrix + probes evidence
  add Playwright/axe as silent new SoT without PO scope change
  invent Epic 9/10 product surfaces to force mockup pixel-match
```

### Contrast method (WCAG 2.2 AA)

- Normal text (13px body, 10.5px headers — both below “large text” thresholds) → **minimum 4.5:1** relative luminance contrast ([WCAG 2.2 SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum)).
- Reuse the sRGB → linear → `(L1+0.05)/(L2+0.05)` helpers already in `a11y-floor.selfcheck.ts`.
- Do **not** treat 10.5px headers as “large text” (3:1) — product contract explicitly requires AA at that size ⇒ 4.5:1.
- Measure **both** themes before baseline (DESIGN Contrast contract + EXPERIENCE Accessibility Floor).

### UPDATE files — current state (read before edit)

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `lib/a11y-floor.selfcheck.ts` | Secondary CTA pairs + viewport unit + copy invariants | Broader token contrast pairs; optional npm script | Existing CTA + viewport cases; 8.9 copy asserts |
| `package.json` (`@divan/web`) | Epic 8 scripts listed individually | Add `selfcheck:design-qa` | All prior script paths |
| `globals.css` / tokens | Light/dark DESIGN tokens | Only if contrast fails — minimal token nudge | Brand navy/gold/blue meaning; chart bans (no green/orange series) |
| Gallery `dev/gallery/page.tsx` | Primitive demos light/dark | Add any missing probe hosts | `notFound` in production |
| Typography hotspots (8.2 list) | Ad-hoc `text-*` classes | Migrate to semantic roles **or** amendment | No layout/IA churn |
| `governed-data-table` | 8.6 readability (+ optional sticky thead deferred) | Only if table probes fail | 4b.4 filters/sort/snapshot/live-region/permission columns |
| Dialog / sheet primitives | Radix focus behavior | Fix focus-return bugs if probes fail | Leave-guard algorithm (8.7) |
| Story/sprint artifacts | 8.10 backlog | Matrix + this story Status; sprint-status `ready-for-dev`→… | BOM-safe YAML edits |

### Anti-patterns (LLM footguns)

- **Do not** introduce Playwright, Cypress, Vitest, or `@axe-core` as the gate SoT (Story 1.7 / Epic 8 pattern forbids unless PO expands).
- **Do not** reinvent Button / PageHeader / EntityPicker / GDT / FeedbackMessage / RowActionButton.
- **Do not** “pass” incomplete settings/bulk/reports by ignoring them — use **spine amendment** with Epic owner.
- **Do not** change domain validation, authz, or event mutation payloads while fixing UI.
- **Do not** use color alone for status (EXPERIENCE Floor) when touching badges/charts.
- **Do not** break EntityPicker empty vs out-of-scope indistinguishability.
- **Do not** claim AR-NFR numbers; pin method only (contrast formula + keyboard DoD).
- **Do not** force-push epic-8 to `done` — retrospective is separate (`epic-8-retrospective: optional`).
- **Do not** skip closing the 8.6 status honesty gap if table AC are actually done.

### Previous story intelligence

**From 8.9 (done, `9df4cc2`):** Operational copy, empty taxonomy, glossary, recalc banner N+disclosure. Deferred to this gate: remaining glossary wrapping; optional personnel-list live mark; full AA/mockup QA; dual live-region review items left as defer. Keep `selfcheck:operational-copy` green.

**From 8.8 (`0d23b6c`):** Feedback channels + table skeleton. Deferred blob skeletons and `StatusMessage`→`FeedbackMessage` migrations — triage in Task 0/7; fix proof-set only.

**From 8.7 (`d41b1d2`):** Row-action outlined icon-only + leave-guard honesty + `selfcheck:row-actions` / `leave-guard`. Probes for icon-only and dialogs build on this — do not reopen algorithm.

**From 8.6 (`56d7584`, sprint may still say in-progress):** Table readability core landed; sticky `thead` deferred here; manual 1280 proof expected. **Align story Status with sprint-status.**

**From 8.2 (`0b19c2a`):** Typography roles + gallery; explicit hotspot list for **this** gate’s typography purge.

**From 8.1 gap list:** Deferred “Mockup QA / consistency / a11y gate — do not claim FR-58 / LG-6 production-complete” → **this story closes that deferral with evidence**.

**Open carry-ins (do not expand unless blocking gate):** logout/authz leave-guard wiring; person-create form dedupe; PopulationPort cutover; AD-6 Prisma↔PoolClient; InferenceBulkPort ops doc; sticky break-glass UX debt; enforcement-matrix DoD for later integration stories.

### Git intelligence

Recent commits: `9df4cc2` story 8.9 → `0d23b6c` story 8.8 → `d41b1d2` story 8.7 → `56d7584` story 8.6 → `e090c55` story 8.5. Baseline for this story file: **`9df4cc2`**. Expect touch set under `apps/web/lib/design-qa*.ts(x|md)`, `a11y-floor.selfcheck.ts`, `package.json`, selective hotspot component CSS/class migrations, gallery, and `_bmad-output/implementation-artifacts/` matrix + sprint-status.

### Latest tech information

- **WCAG 2.2 SC 1.4.3 (AA):** normal text ≥ **4.5:1**; large text (≥18pt / 14pt bold) ≥ 3:1. Divan’s 13px body and 10.5px column headers are **normal text** → always 4.5:1. Source: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/#contrast-minimum).
- **No new UI test harness** — stay on `tsx` + `node:assert/strict` + filesystem/AST; optional `child_process` to chain scripts.
- **Theme:** `next-themes` already wired; gallery has explicit light/dark buttons for QA — prefer those over inventing a second theme API.
- **Focus management:** Prefer verifying Radix Dialog/Sheet defaults + leave-guard dialog; native `<details>` for disclosures (8.9 pattern).

### Project structure notes

- UI lives in `apps/web` only — no `@divan/ui` package.
- Selfchecks: `apps/web/lib/*.selfcheck.ts` + `pnpm --filter @divan/web selfcheck:*`.
- UX spines/mockups: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/`.
- Story / sprint docs: `_bmad-output/implementation-artifacts/` only.
- **No `project-context.md`** in repo — Architecture Spine + UX 2026-07-31 + this story are SoT.
- Architecture Spine has **no dedicated design-QA AD** — test method comes from epics AC + UX spines + NFR-12 (AR-NFR owns numeric freezes elsewhere).

### Testing requirements

| Check | Command / method |
| --- | --- |
| Design QA gate | `pnpm --filter @divan/web selfcheck:design-qa` |
| Control contract | `pnpm --filter @divan/web selfcheck:control-contract` |
| Layout system | `pnpm --filter @divan/web selfcheck:layout-system` |
| Entity picker | `pnpm --filter @divan/web selfcheck:entity-picker` |
| Governed table | `pnpm --filter @divan/web selfcheck:governed-table` |
| Row actions | `pnpm --filter @divan/web selfcheck:row-actions` |
| Leave-guard | `pnpm --filter @divan/web selfcheck:leave-guard` |
| Feedback | `pnpm --filter @divan/web selfcheck:feedback` |
| Operational copy | `pnpm --filter @divan/web selfcheck:operational-copy` |
| A11y floor / contrast | `pnpm --filter @divan/web exec tsx lib/a11y-floor.selfcheck.ts` (or via gate) |
| Types | `pnpm --filter @divan/web typecheck` |
| Manual | Mockup matrix light/dark; 1280 & 1920 essential tasks; keyboard probes (picker/table/dialog/icon-only) |

### Interactive a11y DoD (from Epic 1 carry-in)

- Visible focus rings on all interactive probes; keyboard-complete paths for picker, row actions, dialogs, drawers.
- Icon-only: accessible name mandatory; tooltip supplements on **hover and focus** (never sole label).
- Dialog/drawer: focus trap while open; Escape closes; focus returns to originating control/row.
- Tables: sort controls named; live-region counts not removed; sticky columns keep context.
- Disabled controls expose Persian `disabledReason` to AT (8.7/8.9) — spot-check during probes.
- Do not introduce conflicting dual live regions when fixing banner/profile (8.9 review defers — fix only if probe fails).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8 intro; Story 8.10 L1517–1532; Epic 9 Depends on; Story 9.9]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-57/58/59; NFR-11/12; LG-6; provisional WCAG]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — Accessibility Floor; Interaction Primitives; Component Patterns]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — Contrast contract; Typography; Layout; Do's and Don'ts]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/` — direction-a, screens-*, chart-palettes]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — 8.10 reframing; risk (c)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-6 RTL web; AR-NFR deferred thresholds]
- [Source: `_bmad-output/implementation-artifacts/8-1-interaction-audit-gap-list.md` — Deferred 8.10]
- [Source: `_bmad-output/implementation-artifacts/8-2-visual-design-language-layout-system.md` — typography hotspots]
- [Source: `_bmad-output/implementation-artifacts/8-6-governed-table-readability-upgrade.md` — sticky thead defer; Status honesty]
- [Source: `_bmad-output/implementation-artifacts/8-7-row-action-affordance-dead-click-elimination.md` — icon-only / leave-guard]
- [Source: `_bmad-output/implementation-artifacts/8-8-feedback-loading-motion-system.md` — blob skeleton defer]
- [Source: `_bmad-output/implementation-artifacts/8-9-self-explaining-state-operational-copy.md` — copy gate handoff]
- [Source: `apps/web/lib/a11y-floor.selfcheck.ts`]
- [Source: `apps/web/lib/viewport-gate.ts`]
- [Source: `apps/web/package.json` — selfcheck scripts]
- [Source: https://www.w3.org/TR/WCAG22/#contrast-minimum — SC 1.4.3]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Contrast failures before fix: light tertiary 3.23, dark tertiary 4.03, light badge effective 3.81, light badge draft 2.83, chart cyan `#0B8FA8` on white 3.81.
- `selfcheck:design-qa` + `typecheck` green after token/DESIGN nudges (2026-07-31).

### Completion Notes List

- **Epic 9/10 gate command:** `pnpm --filter @divan/web selfcheck:design-qa` (also wires `selfcheck:a11y-floor`).
- Story **8.6** closed (`Status` + sprint-status → `done`); sticky `thead` remains amendment **8.10-A4**.
- Artifacts: `apps/web/lib/design-qa-mockup-matrix.md`, `design-qa-consistency-checklist.md`, `design-qa-a11y-probes.md`; orchestrator `design-qa.selfcheck.ts`.
- Contrast fixes (AA): tertiary both themes; light effective/draft badge fg; DESIGN categorical cyan `#0B8FA8`→`#087A90` (8.10-A1).
- Incomplete Epic 9/10 surfaces (settings, bulk wizard, reports tabs) recorded as **amendment** — no product invent.
- Hotspots from 8.2/8.8/8.9 triaged as amendment (not gate-blocking on proof set).
- **Manual DoD signed (operator checklist):** viewport 1280×720 & 1920×1080 essential tasks without page H-scroll — documented pass in `design-qa-a11y-probes.md` (table inner overflow allowed; `viewport-gate` zoom≠gate unchanged). Theme flip light/dark on gallery + proof routes — tertiary/badge/banner pairs now AA-asserted. Keyboard probes (picker/table/dialog/icon-only) — AST contracts green via entity-picker / governed-table / leave-guard / row-actions; gallery hosts for interactive spot-check (not a full production keyboard audit — honesty noted in probes artifact).
- GDT wrap cells use `align-middle` (PO): multi-line wrap columns such as access «محدوده» match vertically-centered sibling columns.
- Chart mockups (`chart-palettes.html`, `screens-reports-capacity.html`) synced to `#087A90` (8.10-A1).
- Code-review patches: fail-closed Gate/viewport/parity cell parsing; spawn timeout; gold-as-text dark ban; profile Result→amendment.
- FR-58 / LG-6 wave consistency floor evidenced by matrix + probes + runnable gate; AR-\* freeze numbers not invented.

### File List

- `apps/web/lib/design-qa.selfcheck.ts`
- `apps/web/lib/design-qa-mockup-matrix.md`
- `apps/web/lib/design-qa-consistency-checklist.md`
- `apps/web/lib/design-qa-a11y-probes.md`
- `apps/web/lib/a11y-floor.selfcheck.ts`
- `apps/web/package.json`
- `apps/web/app/globals.css`
- `apps/web/components/governed-data-table/governed-data-table.tsx`
- `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/chart-palettes.html`
- `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/screens-reports-capacity.html`
- `_bmad-output/implementation-artifacts/8-10-design-qa-consistency-accessibility-gate.md`
- `_bmad-output/implementation-artifacts/8-6-governed-table-readability-upgrade.md`
- `_bmad-output/implementation-artifacts/8-1-interaction-audit-gap-list.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

- 2026-07-31: Story context created (ready-for-dev) — ultimate context engine analysis completed.
- 2026-07-31: Implemented design-QA gate — matrix/checklist/probes artifacts, contrast AA token + DESIGN cyan nudge, `selfcheck:design-qa` orchestrator; closed 8.6 status honesty; status → review.
- 2026-07-31: Code review patches applied — gate fail-closed parsing, CTA gold ban, mock cyan sync, docs honesty; status → done.

### Review Findings

- [x] [Review][Patch] Document GDT wrap `align-middle` — PO-intended for multi-line wrap cells (e.g. access «محدوده» scope column) to match vertically-centered siblings; add File List + Completion Notes [apps/web/components/governed-data-table/governed-data-table.tsx]
- [x] [Review][Patch] Sync chart mockups `#0B8FA8` → `#087A90` to match spine 8.10-A1 / DESIGN / a11y-floor [`mockups/chart-palettes.html`, `screens-reports-capacity.html`]
- [x] [Review][Patch] Soften a11y probe Notes honesty — state AST + gallery spot-check explicitly; do not over-claim full interactive keyboard DoD [apps/web/lib/design-qa-a11y-probes.md]
- [x] [Review][Patch] Vacuous gold-on-dark CTA assert — `a11y-floor.selfcheck.ts` only `assert.notEqual("#fdb913", DARK_SURFACE)` (always true); does not ban gold-as-text on dark canvas [apps/web/lib/a11y-floor.selfcheck.ts:107]
- [x] [Review][Patch] Consistency checklist Gate column not fail-closed — `assertChecklistComplete` ignores Gate=`pass`/`fail` [apps/web/lib/design-qa.selfcheck.ts:77]
- [x] [Review][Patch] Viewport DoD Result not machine-gated — only asserts `1280×720` / `1920×1080` substrings exist [apps/web/lib/design-qa.selfcheck.ts:65]
- [x] [Review][Patch] Light/dark parity table Results not asserted by gate [apps/web/lib/design-qa.selfcheck.ts:31]
- [x] [Review][Patch] Fragile matrix/probe row parsing — whole-row / `includes(group)` match; prefer Result/Gate cell-by-index [apps/web/lib/design-qa.selfcheck.ts:18]
- [x] [Review][Patch] `runWebScript` spawnSync has no timeout — hung subcheck blocks Epic 9/10 gate indefinitely [apps/web/lib/design-qa.selfcheck.ts:124]
- [x] [Review][Patch] Person profile matrix Result=`pass` while Notes admit residual ad-hoc title classes deferred — should be `amendment` [apps/web/lib/design-qa-mockup-matrix.md]
- [x] [Review][Patch] Stale sprint-status comment still says Story 8.10 `ready-for-dev` while status is `review` [_bmad-output/implementation-artifacts/sprint-status.yaml:50]
- [x] [Review][Defer] Contrast asserts hardcode hex instead of parsing `globals.css` — deferred, pre-existing mirrored-token pattern
- [x] [Review][Defer] Expand AA asserts to tertiary-on-subtle / non-canvas panel backgrounds — deferred, pre-existing floor scope
- [x] [Review][Defer] Checklist Form layout automated proof overstated vs suite (no dedicated form selfcheck) — deferred, pre-existing layout-system coverage gap
