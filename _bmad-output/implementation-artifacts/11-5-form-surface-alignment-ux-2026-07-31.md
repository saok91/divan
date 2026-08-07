---
baseline_commit: 75dbe10
---

# Story 11.5: Form Surface Alignment to UX 2026-07-31

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator on create/edit panels (e.g. personnel events),
I want form chrome to match the latest mockup surface treatment,
so that the panel does not appear as an abrupt different background band (FR58, UX-DR38).

**Story key:** `11-5-form-surface-alignment-ux-2026-07-31`  
**Epic:** 11 — UAT Unblock & Operational UX Hardening  
**UX contract:** `ux-divan-2026-07-31` + **sprint-change-proposal-2026-08-07** §4.4 Form chrome amendment (align panel background with page `surface` / mockups — avoid abrupt band behind form).  
**Architecture:** Presentation-only in `apps/web`. No domain/API/authz/AD-* changes. No AR-* invention.  
**Authorized by:** `sprint-change-proposal-2026-08-07` (approved AtA)  
**Prerequisite:** Story **8.2** shipped `FormLayout` / `Panel` / surface tokens. Story **11.4** done (`FieldHelpIcon` / label-adjacent help) — **this story owns surface/background/spacing/hairline chrome only**, not help placement.  
**Downstream:** **11.6** capacity drawer glossary + activate CTA; **11.7** Employment / Primary empty states. Do not bleed into those.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Surface tokens | `apps/web/app/globals.css` | `--surface-page`, `--surface`, `--surface-subtle`, hairline tokens wired to Tailwind `bg-surface*` | Token values OK; **composition** of page vs form host vs Panel vs footer mismatches mock |
| `SurfaceSectionTabsLayout` | `apps/web/components/surface-section-tabs-layout.tsx` | Page shell with `bg-surface-page` + PageHeader + SectionTabs + tabpanel | Tabpanel children sit on gray page backdrop; mockup `.main` is white content surface |
| `Panel` | `apps/web/components/layout/panel-section.tsx` | `bg-surface` section for grouped non-table content; docs say “NOT a bordered card” | Nested white `Panel` inside gray page creates abrupt white band behind form fields |
| `FormLayout` / `FormFooter` | `apps/web/components/form-layout/index.tsx` | Max-width, padding, section hairlines; sticky footer with `bg-surface-subtle` + `border-hairline-strong` | Footer subtle tint ≠ mockup `.fbar` white (`#FFFFFF` / `surface`); may read as glued band under fields |
| `PersonnelEventForm` | `apps/web/components/personnel/personnel-event-form.tsx` | Wraps body in `<FormLayout>` → header → `<Panel>` → `<form>` → sections → `FormFooter` | Primary UAT surface — nested Panel is the abrupt band |
| Peer form | `apps/web/components/headcount/headcount-approval-create-form.tsx` | `FormLayout` + `FormFooter` **without** nested `Panel` | Align footer/host treatment when touching shared FormLayout; do not invent drawer work (11.6) |
| Mockup authority | `ux-divan-2026-07-31/mockups/direction-a-dense-console.html` | `.main{background:#FFFFFF}`; `.form-wrap` no separate bg; `.fbar{background:#FFFFFF; border-top:#DCDFE7}` | Source of truth for “no abrupt band” |
| Field help (11.4) | `form-layout/field-help.tsx` | Label-adjacent `FieldHelpIcon` | **Preserve** — do not move help back under control |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Form surface chrome ≠ Field help (11.4)** | This story fixes background / spacing / hairline / footer plane. Help stays label-adjacent. |
| **Form surface ≠ Capacity drawer (11.6)** | Do not rewrite drawer labels, glossary, or «ثبت و فعال‌سازی». |
| **Form surface ≠ Employment empty states (11.7)** | Do not change EntityPicker empty copy for Start. |
| **`surface-page` ≠ `surface`** | Page backdrop = gray `#F4F5F8`. Content / form plane = white `#FFFFFF`. Mockup puts the form on **white main**, not a white card floating on gray. |
| **`surface-subtle` for sticky footer** | DESIGN lists subtle for “headers, footers, disclosures”; UAT mockup `.fbar` is **white**. For PE + peer FormLayout footers, prefer **mockup + proposal** (same plane as form — no abrupt tint band). Keep `surface-subtle` for table headers / settings disclosures unless they sit inside the touched form plane. |
| **Panel ≠ card** | Do not add borders, shadows, or radius to “fix” the band — remove or neutralize the band. |
| **Content controls `bg-surface`** | Inputs/selects using `bg-surface` for control fill are fine — do not strip control backgrounds thinking they are the panel band. |
| **LG-complete honesty** | Epic 11 UAT polish ≠ claiming LG-complete while Epic 7–10 carry-ins remain open. |

## Acceptance Criteria

1. **Given** the personnel-event (and peer) form panels called out in UAT  
   **When** rendered on the page shell  
   **Then** background / spacing / hairline treatment matches UX 2026-07-31 intent for those surfaces  
   **And** there is **no unexplained color break** glued to field labels or abrupt different background band behind the form body

2. **And** the personnel-event register form visually matches mockup intent:
   - Form body shares the **content `surface` plane** (white in light theme) with surrounding main content — not a nested “card island” on `surface-page`
   - Section separators remain hairline-only (`border-hairline` / FormSection rules)
   - Sticky `FormFooter` sits on the **same content plane** as the form (mockup `.fbar`), separated by `border-hairline-strong` — not a contrasting tint band that reads as a second panel

3. **And** at least one peer FormLayout consumer used in day-to-day UAT (headcount create form) inherits the shared FormLayout/footer surface fix without one-off PE-only CSS

4. **And** gallery FormLayout / Panel demos updated so reviewers can see the aligned treatment (and any intentional Panel usage for non-form grouped content remains documented)

5. **And** Epic Gate encodes held:
   - Presentation-only — no tRPC / Prisma / authz / event-store / worker changes
   - Reuse existing tokens (`bg-surface`, `bg-surface-page`, `bg-surface-subtle`, hairline) — no new color hex literals in components
   - First-touch: extend `FormLayout` / `Panel` / surface host — no parallel form shell
   - AR-\* / FR-58 fail-closed on interaction consistency — do not invent a second form-layout
   - UTF-8 **without BOM** on `sprint-status.yaml` edits
   - Must **not** reopen Epics 1–10 status churn
   - Must **not** claim LG-complete
   - `pnpm --filter @divan/web selfcheck:design-qa` green

6. **And** scope boundaries:
   - Does **not** change FieldHelp / LabelWithHelp chrome (**11.4** done)
   - Does **not** own capacity drawer glossary / activate CTA (**11.6**)
   - Does **not** own Employment / Primary empty-state copy (**11.7**)
   - Does **not** change Jalali month/year / RTL chrome (**11.3** done)
   - Does **not** restyle EntityPicker / Button / control borders except where a wrapper background forces a visible break
   - Does **not** convert full-bleed tables to Panels or add card chrome

## Tasks / Subtasks

- [x] Task 1: Diagnose and fix PE form nesting (AC: #1, #2)
  - [x] Inspect live composition: `SurfaceSectionTabsLayout` (`bg-surface-page`) → register tab → `PersonnelEventFormHost` → `PersonnelEventForm` (`FormLayout` + nested `Panel`)
  - [x] Preferred fix pattern (pick the minimal one that removes the band — document choice in Completion Notes):
    1. **Remove nested `<Panel>`** around the PE `<form>` so FormLayout sits directly on a white content host, **or**
    2. Give the tabpanel / form host `bg-surface` for form tabs and keep Panel transparent / without competing fill, **or**
    3. Equivalent shared host utility — **not** PE-only one-off class soup
  - [x] Ensure section titles / labels have **no** ad-hoc background; hairlines only between sections
  - [x] Preserve leave-guard, finalize honesty, EntityPicker wiring, FormField help from 11.4

- [x] Task 2: Align shared `FormFooter` + FormLayout plane (AC: #2, #3)
  - [x] UPDATE `FormFooter` so sticky bar matches mockup `.fbar`: content `surface` + `border-t border-hairline-strong` (drop contrasting `bg-surface-subtle` on the form footer unless product explicitly wants subtle — mockup/UAT wins)
  - [x] Keep sticky behavior, `-mx-content-padding-inline` gutter cancel, z-index, action order (Cancel · draft · Finalize)
  - [x] VERIFY `headcount-approval-create-form.tsx` footer picks up the shared change

- [x] Task 3: Content host honesty for form tabs (AC: #1, #2)
  - [x] If tabpanel remains on `surface-page`, introduce a **documented** form content host (e.g. wrap FormLayout consumers in `bg-surface` full-bleed of the tabpanel, or set tabpanel `bg-surface` when the active surface is a form) so mockup `.main` white plane is real
  - [x] Do **not** paint the entire app shell white if lists/tables rely on page backdrop contrast — scope to form surfaces / PE register (+ peer create) unless a single shared rule is cleaner and list tabs stay correct
  - [x] Lists that use full-bleed tables must keep hairline-only treatment (Panel docs)

- [x] Task 4: Gallery + selfchecks (AC: #4, #5)
  - [x] Update gallery FormLayout demo notes / chrome so the “aligned surface” is visible; clarify Panel demo vs form plane if both remain
  - [x] Extend `layout-system.selfcheck.ts` with source asserts that encode the chosen contract, e.g.:
    - `FormFooter` uses `bg-surface` (or documented token) and `border-hairline-strong`
    - PE form does **not** nest `Panel` with competing fill **or** assert the host composition pattern you chose
  - [x] Run `pnpm --filter @divan/web selfcheck:design-qa`
  - [x] Typecheck `@divan/web` for touched files

- [x] Task 5: DoD alignment (AC: #1–#6)
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; YAML UTF-8 without BOM
  - [x] Manual DoD below

### Manual DoD checklist

- [x] Personnel-events → ثبت رویداد: form body and footer share one continuous white (light) / content-surface plane — no gray→white “card band” glued behind labels
- [x] Section hairlines still separate blocks; no bordered card around the whole form
- [x] Sticky footer: same plane as form + strong hairline top; primary gold still once
- [x] Headcount create form footer matches shared FormFooter treatment
- [x] Compact field help (11.4) still label-adjacent; errors still under control
- [x] Dark theme: form plane uses `--surface` / `--surface-page` tokens correctly (no hard-coded light hex)
- [x] `selfcheck:design-qa` green; Epics 1–10 remain `done`; no LG-complete claim

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Match mockup form plane (no abrupt band) | Leave PE form as white Panel island on `surface-page` |
| Shared FormLayout/footer fix for peers | PE-only one-off CSS / duplicate form shell |
| Token utilities only (`bg-surface*`, hairline) | New hex colors in TSX; new card chrome |
| Preserve 11.4 FieldHelp + FormField a11y | Move help under control; strip describedby |
| `selfcheck:design-qa` green | Reopen Epics 1–10 or claim LG-complete |
| Presentation-only | Domain/API/authz/worker/settings registry changes |

### Epic 11 / prior carry-ins in force

- Authorized by `sprint-change-proposal-2026-08-07` — do not reopen Epics 1–10
- **11.1–11.4 done:** stale honesty, finalize path, Jalali chrome, compact field help
- Epic 10 open items (FeedbackMessage long-tail, typography, batched identity, PE/HC bulk honesty, settings cache, binder parity, AR fail-closed, production-honesty carry-forward) — **encode, do not resolve**
- Downstream **11.6** / **11.7** — out of scope

### UPDATE files — current → change → preserve

#### `apps/web/components/personnel/personnel-event-form.tsx` (primary UAT)

- **Current:** `FormLayout` → header → `<Panel>` (`bg-surface`) wrapping entire `<form>` including `FormFooter`. Parent tab shell is `bg-surface-page` → white band on gray (UAT evidence #6).
- **Change:** Remove competing nested fill so form sits on continuous content surface (see Task 1 preferred patterns).
- **Preserve:** All lifecycle ops, capacity override honesty (11.2), FieldHelp/Jalali `helperText=""` discipline (11.4), leave-guard dirty state, sticky footer action order.

#### `apps/web/components/form-layout/index.tsx` (`FormFooter` — shared)

- **Current:** `sticky … border-t border-hairline-strong bg-surface-subtle …`
- **Change:** Align to mockup `.fbar` — `bg-surface` (same plane as form body) unless a measured product exception is recorded.
- **Preserve:** Sticky positioning, padding tokens, flex wrap, children API, FormLayout max-width / section gaps / FormField help chrome.

#### `apps/web/components/layout/panel-section.tsx` (`Panel`)

- **Current:** Default `bg-surface` for all Panel usages (forms, drawers, settings groupings).
- **Change:** Only if needed for a shared “transparent on content host” variant — prefer **not** breaking drawer/settings that still want `bg-surface`. Prefer removing Panel from PE form over mutating global Panel fill.
- **Preserve:** PanelSection hairlines; FormContentWidth / FullBleedTableHost contracts; docs table “forms use Panel / tables full-bleed”.

#### `apps/web/components/surface-section-tabs-layout.tsx` (optional host)

- **Current:** Root `bg-surface-page`; tabpanel has no background of its own.
- **Change:** Only if form tabs need a white content plane at the host level — keep list tabs honest.
- **Preserve:** PageHeader / SectionTabs composition; primary actions stay out of PageHeader.

#### `apps/web/components/headcount/headcount-approval-create-form.tsx` (peer)

- **Current:** FormLayout + FormFooter, no nested Panel.
- **Change:** Should inherit FormFooter token fix automatically; verify visually.
- **Preserve:** Create permissions, EntityPicker, draft submit — **no** activate CTA (11.6).

#### `apps/web/lib/layout-system.selfcheck.ts` + gallery

- **Change:** Assert new surface contract; update gallery copy/demo.
- **Preserve:** Existing FieldHelp / FormField / PageHeader asserts from 8.2 / 11.4.

### Recommended composition (target)

```text
SurfaceSectionTabsLayout
  └─ (page chrome may stay surface-page for shell)
  └─ tabpanel content host for FORM tabs → bg-surface  (mockup .main)
       └─ FormLayout (no nested Panel fill)
            ├─ sections / fields (hairline only)
            └─ FormFooter → bg-surface + border-hairline-strong  (mockup .fbar)
```

### Library / framework requirements

| Lib | Rule |
| --- | --- |
| Existing CSS tokens in `globals.css` | Reuse `--surface*` / Tailwind `bg-surface*` — do not invent new palette |
| Tailwind v4 `@theme` utilities already wired | Prefer utilities over inline styles |
| No new npm packages | — |
| No new icon/tooltip work | 11.4 owns help chrome |

### File structure requirements

- Touch primarily: `personnel-event-form.tsx`, `form-layout/index.tsx`, optionally `surface-section-tabs-layout.tsx` / register host, `layout-system.selfcheck.ts`, gallery; light verify headcount create
- Do **not** add a parallel `packages/` layout primitive
- Do **not** add CSS modules solely for a band fix
- Story + sprint-status only under `_bmad-output/implementation-artifacts/`

### Testing requirements

- Mandatory: `pnpm --filter @divan/web selfcheck:design-qa`
- Extend layout-system source asserts for FormFooter / PE Panel composition
- Manual DoD (PE register + headcount create + dark theme spot-check)
- No Vitest mandate; do not invent a new test runner

### Previous story intelligence (11.4)

- Presentation-only Epic 11 pattern: Gate table, BOM-safe YAML, `design-qa` mandatory, explicit non-goals for siblings
- **11.4** shipped `FieldHelpIcon` + FormField label-adjacent help — **must not regress**; LabelWithHelp keeps icon **outside** `<label>` (review patch)
- Review culture: source selfchecks over brittle DOM snapshots; allowlist ghost if touching buttons
- Pattern: in-place chrome upgrade + selfcheck + design-qa; no domain churn
- 11.4 explicitly deferred form surface tokens to **this** story

### Git intelligence

- Recent: `75dbe10` story 11.4 · `8785f3e` story 11.3 · `bcfda5d` story 11.2 · `238e365` story 11.1
- FormLayout / Panel from Epic 8.2; surface tokens from design-language work
- Pattern: extend shared primitives; update gallery + layout-system.selfcheck; no parallel SoT

### Latest tech notes

- Project already maps `--color-surface*` in `globals.css` for Tailwind v4 utilities (`bg-surface`, `bg-surface-page`, `bg-surface-subtle`) — extend composition, do not redefine tokens unless a real token bug is found
- Prefer composition (`bg-surface` host) over inventing new semantic tokens like `bg-form-panel`
- Dark theme overrides already exist for surface tokens — verify both themes after footer/host change

### Project context reference

- No `project-context.md` found in repo at story creation time — follow Epic 11 gates + UX 2026-07-31 / FR-58 / proposal Form chrome amendment + this file.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 11, Story 11.5, UX-DR38, FR58]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md` — Evidence #6, §4.4 Form chrome, success #6]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — surface tokens, Forms layout, Do’s (hairlines not cards)]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/direction-a-dense-console.html` — `.main` / `.form-wrap` / `.fbar`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-58]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-3/AD-5/AD-6; apps/web presentation boundary]
- [Source: `_bmad-output/implementation-artifacts/11-4-compact-field-help-label-info-icon.md` — scope boundary: 11.5 owns surface]
- [Source: `apps/web/components/personnel/personnel-event-form.tsx` — nested Panel]
- [Source: `apps/web/components/form-layout/index.tsx` — FormFooter `bg-surface-subtle`]
- [Source: `apps/web/components/surface-section-tabs-layout.tsx` — `bg-surface-page`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Chose pattern **1 + 3**: remove nested PE `<Panel>` and introduce shared `FormSurfaceHost` (`bg-surface`) on form tabs only — list tabs keep `surface-page` contrast.
- `FormFooter` default chrome: `bg-surface-subtle` → `bg-surface` + keep `border-hairline-strong` (mockup `.fbar`).
- `pnpm --filter @divan/web selfcheck:design-qa` → ok; `selfcheck:layout-system` → ok; `selfcheck:headcount-ia` → ok; `tsc --noEmit` → ok.

### Completion Notes List

- Removed competing nested `Panel` fill from `PersonnelEventForm` so FormLayout sits on the content plane (no white card island on gray).
- Added documented `FormSurfaceHost` in `panel-section.tsx`; wrapped PE register + headcount create pages (scoped — not whole app shell).
- Shared `FormFooter` now uses content `surface` (same plane as form body); headcount create inherits automatically.
- Gallery clarifies Panel (non-form grouped content) vs FormSurfaceHost + FormLayout (aligned form plane).
- Layout-system + headcount-ia source asserts encode FormFooter / PE no-Panel / FormSurfaceHost contract.
- Presentation-only; no domain/API/authz changes; FieldHelp 11.4 preserved; no LG-complete claim.

### File List

- `apps/web/components/personnel/personnel-event-form.tsx`
- `apps/web/components/form-layout/index.tsx`
- `apps/web/components/layout/panel-section.tsx`
- `apps/web/components/surface-section-tabs-layout.tsx`
- `apps/web/components/app-shell.tsx`
- `apps/web/app/(app)/personnel-events/(tabs)/register/page.tsx`
- `apps/web/app/(app)/headcount/(tabs)/create/page.tsx`
- `apps/web/app/(app)/dev/gallery/page.tsx`
- `apps/web/lib/layout-system.selfcheck.ts`
- `apps/web/components/headcount/headcount-ia.selfcheck.ts`
- `_bmad-output/implementation-artifacts/11-5-form-surface-alignment-ux-2026-07-31.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Decision] FormSurfaceHost height fill vs content-height — Resolved: fill remaining tab height via flex chain (`main` flex-col → SurfaceSectionTabsLayout `flex-1` → tabpanel flex column → FormSurfaceHost `flex-1 bg-surface`).
- [x] [Review][Patch] Restore create-page form mount assert beside FormSurfaceHost [apps/web/components/headcount/headcount-ia.selfcheck.ts:41]
- [x] [Review][Patch] Assert FormSurfaceHost default chrome includes `bg-surface` (+ `flex-1`) [apps/web/lib/layout-system.selfcheck.ts]

### Change Log

- 2026-08-07: Story context created (ready-for-dev) — form surface / chrome alignment to UX 2026-07-31 mockups.
- 2026-08-07: Implemented form surface alignment — FormSurfaceHost + FormFooter `bg-surface` + remove PE nested Panel; status → review.
- 2026-08-07: Code review — 1 decision-needed, 2 patch; ~12 dismissed (scope-intentional / false positive).
- 2026-08-07: Review patches applied — FormSurfaceHost flex-1 height fill via shell/tabpanel flex chain; headcount-ia + layout-system asserts tightened; status → done.
