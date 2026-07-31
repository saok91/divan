---
baseline_commit: 81ace11
---

# Story 8.2: Visual Design Language & Layout System

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As any Divan user,
I want every surface to use the same header, spacing, panel, form, and typography system,
so that the product reads as one professional application rather than several (UX-DR38, FR58).

**Story key:** `8-2-visual-design-language-layout-system`  
**Epic:** 8 — Experience Foundation & Identifier Ergonomics (FR57, FR58; FR33, FR43 extended)  
**UX contract (forward):** `ux-divan-2026-07-31` (DESIGN.md + EXPERIENCE.md) — Direction A mockups are visual acceptance; Epic 1–7 / 4b ACs remain historically true against `ux-divan-2026-07-19`  
**Authorized by:** `sprint-change-proposal-2026-07-31` (PO-approved)  
**Prerequisite:** Story 8.1 done (`8-1-interaction-system-audit-control-contract`) — control contract + gap list published. Do **not** reopen button variant semantics.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Brand + spacing tokens | `apps/web/app/globals.css` | Light/dark brand; Epic 4b spacing (`--section-tabs-height: 44px`, `--content-padding-inline: 24px`); 8.1 control tokens (`--control-border`, `--disabled-*`, `--hairline`) | Full 2026-07-31 **neutral scale**, dense spacing, typography roles, control-height tokens |
| Button control contract | `apps/web/components/ui/button.tsx` + `lib/control-contract.selfcheck.ts` | UX-DR30 variants; ghost allowlist; `selfcheck:control-contract` | Keep green. May wire `--destructive-foreground`; align sizes to `--control-height-*` tokens. Do **not** redefine variants |
| Section tabs | `apps/web/components/section-tabs.tsx` | URL-backed tablist; height via `--section-tabs-height`; **active = `border-primary` (blue)** | Height → 30px via token; active → **2px `border-chrome` (navy)**; typography → `text-body-medium` |
| Surface tabs host | `apps/web/components/surface-section-tabs-layout.tsx` | Tabs + tabpanel only — **no page-header** | Compose `PageHeader` above tabs (or accept header slots from layouts) |
| App shell | `apps/web/components/app-shell.tsx` | Fixed chrome, RTL sidebar, content gutter | Preserve viewport gate / banner offset; apply new content padding via tokens |
| Theme | `theme-provider.tsx`, `next-themes` class strategy | Light/dark | Keep; extend CSS vars under `:root` / `.dark` |
| Form exemplar | `personnel-event-form.tsx` | Footer already Cancel · Save draft · Finalize | Adopt shared `FormLayout` chrome **without** mutation/payload changes |
| Gap list | `8-1-interaction-audit-gap-list.md` § Deferred 8.2 | Explicit handoff | Execute those items; do not re-audit buttons |
| Icons | `lucide-react` ^1.24.0 | Already in tree | **Standardize** this set — do not add a second icon library |
| Gallery | — | Does not exist | Create **dev-only** living reference |

**No** `PageHeader`, shared form-layout primitives, panel/section hairline system, or component gallery exists yet.

### Critical naming distinction (do not conflate)

| Concept | Meaning | Owner |
| --- | --- | --- |
| **Visual design language / layout** (this story) | Tokens, page-header, spacing, panel rules, form layout, typography roles, icon size/stroke + chrome mapping, gallery | **8.2** |
| **Control affordance / button variants** | Semantics → Button appearance | **8.1** (done) — consume only |
| **Row-action icon map + dead-click** | Full per-action icon-only row mapping; inert-action elimination | **8.7** — 8.2 defines size/stroke + **starter** mapping for gallery/chrome only |
| **Table readability / min-width** | Remove fixed min-widths; content-driven columns | **8.6** — may add `--table-row-dense` / `--table-header-height` tokens; do not change GovernedDataTable public API |
| **Feedback / skeleton / motion** | Loading + toast precedence | **8.8** |
| **Purpose-line copy / glossary** | Self-explaining operational copy | **8.9** — 8.2 provides the **slot**; placeholder or existing titles OK |
| **Design QA gate** | Consistency / a11y / mockup parity | **8.10** |
| **entity-picker** | Code-first selectors | **8.3** — gallery may stub visual chrome only |

## Acceptance Criteria

1. **Given** the `ux-divan-2026-07-31` DESIGN tokens  
   **When** the layout system is implemented  
   **Then** every major app surface uses one `page-header` pattern — breadcrumb, surface title, result count (when applicable), purpose line, then section tabs — with the primary action in the toolbar row beneath, **never** in the header

2. **And** the DESIGN spacing rhythm is applied, including `content-padding-inline` **16px**, `section-tabs-height` **30px** with a **2px navy** (`colors.chrome`) active border, and the three control heights (**24px** row action, **28px** toolbar, **32px** form and CTA)

3. **And** the hairline-based panel/section system is used with **documented** rules for when a surface uses a panel versus a full-bleed table (document colocated with the panel primitive or in gallery)

4. **And** every form that this story migrates uses one layout pattern — label column (`form-label-column` 168px), field grouping, required marking, help text, inline error, sticky footer with **Cancel · Save draft · Finalize** order (or Cancel · secondary · primary when draft/finalize do not apply — document mapping)

5. **And** one icon set (`lucide-react`) is used with fixed size and stroke rules and a **fixed starter per-action icon mapping** published next to the gallery (deep row-action coverage remains **8.7**)

6. **And** typography roles are used semantically with no new ad-hoc sizes or weights on migrated surfaces; full-repo purge of leftover ad-hoc classes is verified by the **8.10** gate (this story must add the utility roles and migrate page-header / form / tabs / gallery consumers)

7. **And** a **dev-only** component gallery renders every layout primitive in light and dark as the living reference

8. **And** these values **supersede** the Story 4b.1 `section-tabs-height` 44px / blue active-border assumption for **forward** work (do not rewrite historical Epic 1–7 story ACs)

9. **And** scope stays **presentation only**:
   - No domain, permission, governance, event-store, temporal, headcount, or audit-envelope **semantic** changes
   - AR-\* remain fail-closed; do not invent freeze numbers
   - Do **not** claim FR-58 / LG-6 production-complete (8.10 is the consistency gate)
   - `pnpm --filter @divan/web selfcheck:control-contract` remains green

10. **And** this story does **not** own: `entity-picker` / code resolvers (**8.3–8.5**); GovernedDataTable min-width removal / full dense chrome polish (**8.6**); full icon-only row map + dead-click (**8.7**); skeleton/toast system (**8.8**); copy/glossary overhaul (**8.9**); mockup QA gate (**8.10**); Epic 9–10 IA/settings product surfaces

## Tasks / Subtasks

- [x] Task 1: Tokens — spacing, neutrals, typography, control heights (AC: #2, #6, #8, #9)
  - [x] UPDATE `apps/web/app/globals.css`:
    - **Override spacing:** `--section-tabs-height: 30px`; `--content-padding-inline: 16px`; `--form-section-gap: 12px`
    - **Add spacing:** `--nav-item-height: 30px`; `--table-row-dense: 32px` (keep `--table-row-comfortable: 48px`; optionally alias/rename compact→dense carefully — do not break existing `h-table-row-compact` call sites without migrating them); `--table-header-height: 28px`; `--control-height-xs: 24px`; `--control-height-sm: 28px`; `--control-height: 32px`; `--form-label-column: 168px`; `--form-field-gap: 14px`; `--drawer-width: 480px`
    - **Add neutral scale (light + dark)** per DESIGN.md `colors.*` — at minimum: `surface-page`, `surface` / map to canvas, `surface-subtle`, `hairline-strong`, `text-primary` / `text-secondary` / `text-tertiary`, `row-hover`, `selection-tint` + `selection-tint-border`, `skeleton`, `keycap-background`, `destructive-background`, `dirty-border`, plus dark counterparts
    - **Add** `--destructive-foreground` (light/dark) and use it from `button.tsx` destructive variant (closes 8.1 review defer)
    - Map new tokens into `@theme inline` as `--color-*` / `--spacing-*` following the existing pattern (project already uses `:root`/`.dark` raw vars + `@theme inline` passthrough — **do not** bake hex literals into utilities that break dark mode)
    - **Rewrite typography utilities** to DESIGN dense scale; add missing roles:
      | Utility | Target |
      | --- | --- |
      | body (base `body` / `.text-body`) | 13px / 400 / 1.55 |
      | `.text-heading` | 17px / 800 |
      | `.text-heading-sm` | 12.5px / 800 |
      | `.text-body-medium` | 12.5px / 600 |
      | `.text-caption` | 11px / 400 |
      | `.text-tabular` | 12.5px / 500 + tabular-nums |
      | `.text-column-header` | **new** 10.5px / 800 |
      | `.text-field-label` | **new** 11px / 700 |
      | `.text-identifier` | **new** 11px mono LTR |
    - **Preserve** nudged brand hexes (`#006dff` / `#1e6fe0` primary; dark accent `#fbc470`); banner + status-badge tokens; 8.1 control tokens
  - [x] Do **not** introduce a parallel `@divan/ui` package

- [x] Task 2: `PageHeader` + section-tabs chrome (AC: #1, #2, #8)
  - [x] NEW `apps/web/components/page-header.tsx` (client or server-friendly presentational):
    - Props: `breadcrumb`, `title`, optional `resultCount`, optional `purpose`, optional `id` for heading
    - Structure order **fixed**: breadcrumb (`text-caption`) → title (`text-heading`) + result count (`text-caption`) → purpose (`text-caption`)
    - **No** primary Button slot in the header; **no** card / background fill / extra divider above tabs
  - [x] UPDATE `section-tabs.tsx`: active tab `border-chrome` (navy), not `border-primary`; label class `text-body-medium`; height remains token-driven (`h-section-tabs-height`)
  - [x] UPDATE `SurfaceSectionTabsLayout` (and/or each `(tabs)/layout.tsx`) so `PageHeader` sits **above** `SectionTabs`, then toolbar/primary actions remain in panel toolbars beneath
  - [x] Migrate representative surfaces to `PageHeader` (minimum): personnel, organization, access, personnel-events, headcount tab layouts; plus at least one non-tab page (e.g. import). Purpose line may be a short existing Persian description or empty slot wired for 8.9 — do not invent full glossary

- [x] Task 3: Panel / section hairline system + max-width rules (AC: #3)
  - [x] NEW thin primitives (suggested): `apps/web/components/ui/panel.tsx` or `components/layout/panel-section.tsx` — hairline separators + type weight; **default is not a bordered card**
  - [x] Document rules (gallery or colocated markdown comment):
    - **Full-bleed table:** list/index surfaces using `GovernedDataTable` — no card wrapper; hairline row rules only
    - **Panel:** forms, settings-like rows, side detail, grouped non-table content
    - **Content max-widths (lock in 8.2 — DESIGN left these underspecified):**
      | Surface type | Max width |
      | --- | --- |
      | Event / multi-section form | `max-w-4xl` (≈ 56rem) **or** `1120px` — pick one, document, use consistently |
      | Narrow confirm / single-purpose form | `max-w-xl` |
      | Full-bleed table / list | none (gutter only) |
      | Record drawer | `--drawer-width: 480px` |
  - [x] Do **not** wrap existing tables in new cards

- [x] Task 4: Form layout primitives + migrate exemplar (AC: #4, #9)
  - [x] NEW under `apps/web/components/form-layout/` (names flexible):
    - `FormLayout` / `FormSection` / `FormField` (label column 168px, required marker, help, inline error)
    - `FormFooter` sticky: **Cancel · Save draft · Finalize** visual order (Cancel = ghost per 8.1; Save draft = secondary; Finalize = primary)
  - [x] Migrate **at least** `personnel-event-form.tsx` chrome to FormLayout/FormFooter — **mutation payloads, draft/finalize semantics, capacity rules, leave-guard dirty swap unchanged**
  - [x] Document footer mapping for non-lifecycle forms: Cancel · secondary · primary (single submit)
  - [x] Do **not** change leave-guard dialog button variants

- [x] Task 5: Icon rules + starter mapping (AC: #5)
  - [x] Publish `apps/web/components/icons/icon-contract.md` (or gallery section) with:
    - Library: `lucide-react` only
    - Sizes: row-action **12px**; toolbar/nav keep existing ~16–20px where already set — document the table
    - Stroke: use Lucide default stroke; do not mix filled/outline randomly
    - Starter per-action map for chrome (edit, delete/destructive, add, filter, more, copy, external, search) — enough for gallery + any icons touched in this story
  - [x] Explicit non-goal: full table row-action icon-only retrofit → **8.7**

- [x] Task 6: Dev-only component gallery (AC: #7)
  - [x] NEW route e.g. `apps/web/app/(app)/dev/gallery/page.tsx` (or `(dev)/gallery`)
  - [x] Gate: redirect/notFound when `process.env.NODE_ENV === "production"` (and/or explicit env flag) — must not ship as a nav item for operators
  - [x] Render light **and** dark: PageHeader, SectionTabs, Button family (all 8.1 variants), FormLayout/FormFooter, Panel/Section, typography roles, icon samples, control height samples
  - [x] Stub-only slots OK for entity-picker / skeleton (label “8.3 / 8.8”) — do not implement those systems here

- [x] Task 7: Migrate ad-hoc type + gutter; Button height token alignment (AC: #2, #6, #9)
  - [x] Replace known ad-hoc heading classes on migrated surfaces: `text-title`, `text-title-sm`, `text-title-medium`, `text-title-small`, `text-heading-md`, raw `text-lg font-semibold` on page titles → semantic roles
  - [x] Ensure content regions use `px-content-padding-inline` (or equivalent) so 16px gutter applies
  - [x] Optionally map `Button` size variants to `--control-height-xs/sm/default` CSS vars if not already exact
  - [x] Do **not** require full-repo elimination of every `text-sm`/`text-xs` in one story — list remaining hotspots for **8.10** in Completion Notes

- [x] Task 8: Layout / design-token selfcheck + DoD (AC: #1–#10)
  - [x] NEW `apps/web/lib/layout-system.selfcheck.ts` (sibling to control-contract):
    - Assert CSS source contains `--section-tabs-height: 30px` and `--content-padding-inline: 16px`
    - Assert typography utility roles exist (heading, heading-sm, body-medium, caption, column-header, field-label, tabular, identifier)
    - Assert `section-tabs.tsx` active border uses chrome (not primary) — string/heuristic OK
    - Assert `PageHeader` module exports exist
    - Optional: fail new `text-title` / `text-heading-md` on files this story touches
  - [x] Wire `package.json`: `selfcheck:layout-system`
  - [x] Run: `selfcheck:layout-system`, `selfcheck:control-contract`, `typecheck` (and `a11y-floor` if still invoked via tsx)
  - [x] Spot-check RTL: page-header order, tabs 30px navy active, form footer order, one list full-bleed vs one form panel
  - [x] Story Status ↔ sprint-status alignment when marking done

## Dev Notes

### Gate (non-negotiable)

- **Presentation only** — Epic 8 intro: no domain/permission/governance rule changes except unblock unreachable governed actions.
- **Forward UX** is `ux-divan-2026-07-31`; historical Epic 1–7 / 4b ACs stay true against `2026-07-19`.
- **Consume 8.1 control contract** — do not fork Button variants; keep `selfcheck:control-contract` green.
- **Consume, don't fork** GovernedDataTable public API, leave-guard semantics, operational-copy module, Radix dialogs.
- **UI lives in `apps/web` (`@divan/web`)** — no `packages/web` / `@divan/ui`.
- **Spines win on conflict** with any mock; Direction A (`direction-a-dense-console.html` + companion screens) is visual acceptance; Directions B/C are archive only.
- **Gold rule:** one gold primary per surface region; gold is never a data color; dark CTA uses `#FBC470`, never `#FDB913` on dark canvas.

### Current state vs DESIGN (UPDATE carefully)

```62:75:apps/web/app/globals.css
  /* Spacing + radius (DESIGN.md + 2026-07-19 delta) */
  --chrome-height: 56px;
  ...
  --section-tabs-height: 44px;
  --content-padding-inline: 24px;
  ...
  --table-row-compact: 40px;
  --table-row-comfortable: 48px;
  --form-section-gap: 24px;
```

```114:118:apps/web/components/section-tabs.tsx
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
```

`SurfaceSectionTabsLayout` currently renders tabs only — no page-header. Body font is still **14px**. Typography utilities still use Epic 1 sizes (heading 20px / 700, etc.).

### DESIGN token targets (normative)

**Spacing:** see DESIGN.md `spacing:` block — content pad 16, tabs 30, control heights 24/28/32, form-label-column 168, form-field-gap 14, form-section-gap 12, drawer 480, table-row-dense 32, table-header-height 28.

**Neutrals (light):** surface-page `#F4F5F8`, surface `#FFFFFF`, hairline `#E8EAEF`, control-border `#D2D5DF`, text-primary `#11142A`, text-secondary `#4A4F63`, text-tertiary `#8A8F9E`, selection-tint `#EAF3FF`, destructive `#C92A2A` on `#FFF5F5`, dirty-border `#E09E00`.

**Dark:** surface-page/chrome `#030825`, surface `#0A1138`, hairline `#232C5E`, text-primary `#E6E9F5`, text-secondary `#9AA1C0`; accent `#FBC470`.

**Primary contrast:** keep existing AA nudges (`#006dff` / `#1e6fe0`) unless remeasured — do not silently revert to DESIGN raw `#006FFF` / `#4D9FFF` without contrast check.

### Page-header pattern (UX-DR38)

1. Breadcrumb (`caption`)
2. Title (`heading`) + result count (`caption`)
3. Purpose line (`caption`) — slot for 8.9
4. `section-tabs` (when surface has tabs)
5. **Primary action in toolbar beneath** — never inside `PageHeader`

### Form footer contract

| Role | Variant (8.1) | Placement |
| --- | --- | --- |
| Cancel / dismiss | `ghost` | Start of footer |
| Save draft / parallel | `secondary` | Middle |
| Finalize / primary submit | `primary` | End (one gold) |

### Icon boundary with 8.7

| In 8.2 | Out → 8.7 |
| --- | --- |
| Lucide-only rule; sizes/stroke; starter map; gallery samples | Full icon-only row retrofit; overflow menus; inert-action selfcheck |

### Architecture compliance

- Stack: Next.js 16.2.x App Router, React 19, Tailwind **v4.3.x**, CVA, Radix, `next-themes` — versions already pinned in `apps/web/package.json`; do not upgrade casually.
- ESLint `no-restricted-imports` Prisma gate must remain.
- Testing pattern: file-based `*.selfcheck.ts` + `pnpm --filter @divan/web selfcheck:*` (prefer over brittle ESLint for layout tokens).

### Latest tech notes (Tailwind v4)

- Continue the project's working pattern: raw CSS variables in `:root` / `.dark`, map with `@theme inline` to `var(--*)` so dark class switching works.
- Do **not** put hardcoded light hexes into `@theme` entries that generate utilities without going through cascade-friendly vars — dark mode will freeze on light values.
- Prefer semantic utilities (`bg-surface-page`, `text-text-secondary`, `h-control-height`) over scattered arbitrary values.

### Project structure notes

| Action | Path |
| --- | --- |
| UPDATE | `apps/web/app/globals.css` |
| UPDATE | `apps/web/components/section-tabs.tsx` |
| UPDATE | `apps/web/components/surface-section-tabs-layout.tsx` |
| UPDATE | `apps/web/app/(app)/**/layout.tsx` (tab surfaces) |
| UPDATE | `apps/web/components/ui/button.tsx` (destructive-fg / height tokens only) |
| UPDATE | `apps/web/components/personnel/personnel-event-form.tsx` (layout chrome only) |
| UPDATE | `apps/web/package.json` (selfcheck script) |
| NEW | `apps/web/components/page-header.tsx` |
| NEW | `apps/web/components/form-layout/*` |
| NEW | panel/section primitive |
| NEW | `apps/web/app/(app)/dev/gallery/page.tsx` (+ gate) |
| NEW | `apps/web/lib/layout-system.selfcheck.ts` |
| NEW | icon contract doc next to gallery or `components/icons/` |

### Previous story intelligence (8.1)

- Minimal tokens + migrate call sites beat “tokens only.”
- Selfcheck usage heuristics > path-only allowlists; keep approximations documented.
- Dual-gold: primary lives in **toolbar**, not header — reinforce with PageHeader having no CTA slot.
- Review deferrals owned here: `--destructive-foreground`; full neutral/spacing/typography/gallery.
- Gap list § Deferred 8.2 is the checklist seed.

### Git intelligence

| Commit | Relevance |
| --- | --- |
| `81ace11` story 8.1 | Button contract, control tokens, dialog ghost, selfcheck — **baseline** |
| `c1a0c36` / 4b.1 era | section-tabs 44px, content pad 24 — **supersede forward** |
| Epic 1 brand | Yekan Bakh, chrome navy, accent gold — **preserve** |

### Epic 8 carry-ins / open items (do not silently expand scope)

- Still open from Epic 7 retro: PopulationPort cutover, AD-6 hardening, SoD splits, etc. — **out of scope**.
- Epic 9 depends on page-header + layout system from this story — deliver primitives they can consume.
- Epic 10 settings-row will reuse hairline/panel language — keep panel API boring and reusable.

### Testing requirements

- `pnpm --filter @divan/web selfcheck:layout-system`
- `pnpm --filter @divan/web selfcheck:control-contract`
- `pnpm --filter @divan/web typecheck`
- Manual: gallery light/dark; one tabbed surface header+tabs; personnel-event form footer; list vs form panel rules
- Interactive a11y: page title landmark/`h1` once per surface; tabs keyboard behavior unchanged; focus rings intact

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8.2, UX-DR38, Epic 8]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — colors, typography, spacing, components, layout]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-58]
- [Source: `_bmad-output/implementation-artifacts/8-1-interaction-system-audit-control-contract.md`]
- [Source: `_bmad-output/implementation-artifacts/8-1-interaction-audit-gap-list.md` — Deferred 8.2]
- [Source: `apps/web/app/globals.css`, `section-tabs.tsx`, `surface-section-tabs-layout.tsx`, `button.tsx`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- control-contract initially failed on gallery `ghost` samples → allowlisted `dev/gallery/page.tsx` + FormFooter cancel heuristic in control-contract.selfcheck
- Pre-existing eslint `react-hooks/set-state-in-effect` in personnel-list-panel / platform-status-provider (not introduced by 8.2)

### Implementation Plan

1. Tokens first in `globals.css` (spacing override, neutrals, typography roles, control heights, destructive-foreground)
2. PageHeader + section-tabs chrome + SurfaceSectionTabsLayout composition
3. Panel/form-layout primitives + icon contract + gallery
4. Migrate representative surfaces + personnel-event-form chrome; layout selfcheck

### Completion Notes List

- Forward UX `ux-divan-2026-07-31`: tabs 30px + navy `border-chrome` active; content pad 16px; body 13px dense type scale
- Event/multi-section form max width locked to `max-w-4xl`; narrow forms `max-w-xl`; drawer `--drawer-width: 480px`
- `personnel-event-form` chrome → FormLayout/FormFooter; draft/finalize/leave-guard semantics untouched
- Dev gallery at `/dev/gallery` (production `notFound`); not in operator nav
- Validations: `selfcheck:layout-system` OK; `selfcheck:control-contract` OK (32 allowed ghost); `typecheck` OK
- **8.10 hotspots (legacy ad-hoc type still present):** `access-people-panel`, `access-scopes-panel`, `access-roles-panel`, `access-section`, `entitlement-grants-panel`, `break-glass-panel`, `audit-investigation-panel`, `approval-panel`, `exemption-panel`, `override-panel`, `headcount-capacity-panel`, `launch-artifact-panel`, `operations-health-panel`, `person-profile-view`, `current-person-state-foreshadow`, `historical-org-headcount-foreshadow`, `correction-cases-panel`, `sensitive-confirmation-dialog` (`text-title*` / `text-label-medium` / `text-heading-md`)

### File List

- apps/web/app/globals.css
- apps/web/components/page-header.tsx
- apps/web/components/section-tabs.tsx
- apps/web/components/surface-section-tabs-layout.tsx
- apps/web/components/layout/panel-section.tsx
- apps/web/components/form-layout/index.tsx
- apps/web/components/icons/icon-contract.md
- apps/web/components/ui/button.tsx
- apps/web/components/personnel/personnel-event-form.tsx
- apps/web/components/section-tab-placeholder.tsx
- apps/web/app/(app)/dev/gallery/page.tsx
- apps/web/app/(app)/import/page.tsx
- apps/web/app/(app)/personnel/(tabs)/layout.tsx
- apps/web/app/(app)/organization/(tabs)/layout.tsx
- apps/web/app/(app)/access/(tabs)/layout.tsx
- apps/web/app/(app)/personnel-events/(tabs)/layout.tsx
- apps/web/app/(app)/headcount/(tabs)/layout.tsx
- apps/web/app/(app)/personnel/(tabs)/list/page.tsx
- apps/web/app/(app)/personnel/(tabs)/add/page.tsx
- apps/web/app/(app)/personnel/(tabs)/bulk-import/page.tsx
- apps/web/app/(app)/personnel/(tabs)/dictionary/page.tsx
- apps/web/app/(app)/personnel/profile/[personId]/page.tsx
- apps/web/app/(app)/organization/(tabs)/hierarchy/page.tsx
- apps/web/app/(app)/organization/(tabs)/roles/page.tsx
- apps/web/app/(app)/organization/(tabs)/job-titles/page.tsx
- apps/web/app/(app)/organization/(tabs)/ladder-grade/page.tsx
- apps/web/app/(app)/organization/(tabs)/seniority/page.tsx
- apps/web/app/(app)/access/(tabs)/people/page.tsx
- apps/web/app/(app)/access/(tabs)/roles/page.tsx
- apps/web/app/(app)/access/(tabs)/scopes/page.tsx
- apps/web/app/(app)/access/(tabs)/break-glass/page.tsx
- apps/web/app/(app)/personnel-events/(tabs)/events/page.tsx
- apps/web/app/(app)/personnel-events/(tabs)/register/page.tsx
- apps/web/app/(app)/personnel-events/(tabs)/bulk-import/page.tsx
- apps/web/app/(app)/headcount/(tabs)/capacity/page.tsx
- apps/web/lib/layout-system.selfcheck.ts
- apps/web/lib/control-contract.selfcheck.ts
- apps/web/package.json
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/8-2-visual-design-language-layout-system.md

### Change Log

- 2026-07-31: Implemented Story 8.2 visual design language & layout system (tokens, PageHeader, panel/form primitives, gallery, selfcheck); status → review
- 2026-07-31: Code review patches applied (FormField migration, PageHeader expansion, Panel/FullBleed adoption, gutter/a11y/token fixes); status → done

### Review Findings

- [x] [Review][Patch] Migrate `personnel-event-form` fields to `FormField`/`FormSection` (168px label column) — resolved from Decision 1A [`apps/web/components/personnel/personnel-event-form.tsx`]
- [x] [Review][Patch] Expand `PageHeader` to remaining major surfaces (dashboard, reports, personnel profile, etc.) — resolved from Decision 2A
- [x] [Review][Patch] Adopt `Panel`/`FullBleedTableHost` on at least one form + one list product surface — resolved from Decision 3A
- [x] [Review][Patch] Double content gutter on register — outer `px-content-padding-inline` plus `FormLayout` padding → 32px [`apps/web/app/(app)/personnel-events/(tabs)/register/page.tsx:20`]
- [x] [Review][Patch] Double content gutter on placeholder hosts — `SectionTabPlaceholder` already pads; bulk-import pages pad again [`apps/web/components/section-tab-placeholder.tsx:6`, `personnel/(tabs)/bulk-import/page.tsx:18`, `personnel-events/(tabs)/bulk-import/page.tsx:18`]
- [x] [Review][Patch] Gallery Panel demo uses bordered card — contradicts colocated “default is NOT a bordered card” rule [`apps/web/app/(app)/dev/gallery/page.tsx:180`]
- [x] [Review][Patch] Dark neutrals collapse hierarchy — `--text-secondary`=`--text-tertiary`; `--surface`=`--surface-subtle`; `--destructive-background`=`--surface` [`apps/web/app/globals.css:142-152`]
- [x] [Review][Patch] Migrated event form still uses ad-hoc type (`text-xs`/`text-sm`/`text-muted-foreground`) instead of semantic roles [`apps/web/components/personnel/personnel-event-form.tsx`]
- [x] [Review][Patch] Control-contract FormFooter allowlist matches bare `border-t border-hairline` / look-ahead — tighten to `FormFooter`/`data-slot="form-footer"` only [`apps/web/lib/control-contract.selfcheck.ts:174-180`]
- [x] [Review][Patch] `FormField` required marker is `aria-hidden` only; `htmlFor` optional with no `aria-required` / describedby wiring [`apps/web/components/form-layout/index.tsx:103-113`]
- [x] [Review][Patch] Sticky `FormFooter` can obscure last fields — add bottom spacer or scroll-padding [`apps/web/components/form-layout/index.tsx:140-146`]
- [x] [Review][Patch] `.text-identifier` font stack includes proportional `Segoe UI`/`Tahoma` before reliable mono [`apps/web/app/globals.css:321-322`]
- [x] [Review][Patch] Gallery theme toggles use unresolved `theme` for `aria-pressed` (hydration/`system`) [`apps/web/app/(app)/dev/gallery/page.tsx:41-80`]
- [x] [Review][Patch] `PageHeader` wraps `purpose` in `<p>` — block children break HTML/a11y nesting [`apps/web/components/page-header.tsx:50-52`]
- [x] [Review][Patch] `FormSection` renders empty `<legend>` when `title=""` [`apps/web/components/form-layout/index.tsx:60-67`]
