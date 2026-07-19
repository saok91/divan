---
name: Divan HRIS
description: Governed Persian RTL desktop HRIS. Brand layer inherits ux-divan-2026-07-13; this revision adds collapsible sidebar tokens, section-tab chrome, and governed-table density.
status: final
updated: 2026-07-19
inherits: "{planning_artifacts}/ux-designs/ux-divan-2026-07-13/DESIGN.md"
colors:
  primary: '#006FFF'
  primary-foreground: '#FFFFFF'
  primary-dark: '#4D9FFF'
  primary-foreground-dark: '#FFFFFF'
  accent: '#FDB913'
  accent-foreground: '#1A1208'
  accent-dark: '#FBC470'
  accent-foreground-dark: '#1A1208'
  chrome: '#051061'
  chrome-foreground: '#FFFFFF'
  chrome-dark: '#030825'
  chrome-foreground-dark: '#F1F3F5'
  muted-brand: '#808184'
  muted-brand-dark: '#9E9EA0'
  sidebar-active-background: 'rgba(255,255,255,0.12)'
  sidebar-active-background-dark: 'rgba(255,255,255,0.08)'
typography:
  body:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.6'
  body-medium:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.6'
  heading:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1.3'
  heading-sm:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.35'
  caption:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.5'
  tabular:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    fontVariantNumeric: 'tabular-nums'
rounded:
  sm: 4px
  md: 6px
  lg: 8px
spacing:
  chrome-height: 56px
  sidebar-width: 240px
  sidebar-width-collapsed: 64px
  content-padding-inline: 24px
  table-row-compact: 40px
  table-row-comfortable: 48px
  form-section-gap: 24px
  section-tabs-height: 44px
components:
  button-primary:
    background: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    background-dark: '{colors.accent-dark}'
    foreground-dark: '{colors.accent-foreground-dark}'
    radius: '{rounded.md}'
  button-secondary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  app-chrome:
    background: '{colors.chrome}'
    foreground: '{colors.chrome-foreground}'
  sidebar-active-item:
    background: '{colors.sidebar-active-background}'
    background-dark: '{colors.sidebar-active-background-dark}'
    foreground: '{colors.chrome-foreground}'
    border: '2px solid {colors.accent}'
  sidebar-collapsed:
    width: '{spacing.sidebar-width-collapsed}'
    icon-size: 20px
  section-tabs:
    height: '{spacing.section-tabs-height}'
    active-border: '2px solid {colors.primary}'
  governed-data-table:
    row-height: '{spacing.table-row-compact}'
    header-typography: '{caption}'
    filter-row-height: 36px
  tree-navigator:
    indent: 16px
    row-height: '{spacing.table-row-compact}'
  command-palette-result-active:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
  status-badge-scheduled:
    background: '#E7F5FF'
    foreground: '#1864AB'
    background-dark: '#1A3A5C'
    foreground-dark: '#A5D8FF'
  status-badge-effective:
    background: '#D3F9D8'
    foreground: '#2B8A3E'
    background-dark: '#1B3D2F'
    foreground-dark: '#8CE99A'
  status-badge-cancelled:
    background: '#F1F3F5'
    foreground: '#495057'
    background-dark: '#2E2E32'
    foreground-dark: '#CED4DA'
  status-badge-reversed:
    background: '#F1F3F5'
    foreground: '#495057'
    background-dark: '#2E2E32'
    foreground-dark: '#CED4DA'
  status-badge-draft:
    background: '#FFF9DB'
    foreground: '#E67700'
    background-dark: '#3D3200'
    foreground-dark: '#FFE066'
  status-badge-override:
    background: '#FFF3BF'
    foreground: '#862E00'
    border: '1px solid {colors.accent}'
    background-dark: '#3D3200'
    foreground-dark: '#FFE066'
  stale-banner:
    background: '#FFF3BF'
    foreground: '#862E00'
    border: '1px solid #FDB913'
    background-dark: '#3D3200'
    foreground-dark: '#FFE066'
    border-dark: '1px solid {colors.accent-dark}'
  break-glass-banner:
    background: '#E7F5FF'
    foreground: '#1864AB'
    border: '1px solid {colors.primary}'
    background-dark: '#1A3A5C'
    foreground-dark: '#A5D8FF'
    border-dark: '1px solid {colors.primary-dark}'
  jalali-date-picker:
    radius: '{rounded.sm}'
    border: 'shadcn input border'
    calendar-popover-radius: '{rounded.lg}'
  sensitive-confirmation-dialog:
    maxWidth: 'max-w-2xl'
    consequenceTypography: '{body}'
    metaTypography: '{caption}'
  personnel-event-form:
    maxWidth: 'max-w-4xl'
    sectionTitle: '{heading-sm}'
    sectionGap: '{spacing.form-section-gap}'
  export-artifact-panel:
    classificationTypography: '{body-medium}'
    expiryTypography: '{caption}'
  # Canonical id matches EXPERIENCE; alias `quick-edit-modal` → same token
  personnel-quick-edit-modal:
    maxWidth: 'max-w-3xl'
---

# Divan HRIS — Design Spine (Shell Redesign)

> Revision of `ux-divan-2026-07-13`. Brand tokens, typography, and chrome color posture are unchanged unless listed below. **Spines win on conflict** with prior mocks/wireframes.

## Brand & Style

Same enterprise premise as the prior spine: navy chrome, gold primary CTA, blue structure, Yekan Bakh, light/dark content canvases. This revision emphasizes **dense operational tables** and a **collapsible icon sidebar** so operators reclaim horizontal space without losing wayfinding.

Font files remain at the prior run's `imports/fonts/yekan-bakh/` (or symlink/copy into this workspace at finalize). **Do not use FaNum variants.**

→ IA: `wireframes/ia-2026-07-19.excalidraw`. Key mocks: `mockups/key-personnel-list.html`, `mockups/key-access-admin.html`, `mockups/key-org-ladder-grade.html`. Prior visual mocks remain reference until replaced. **Spines win on conflict.**

## Colors

Unchanged palette from prior DESIGN.md (org tokens + status/banner pairs). YAML frontmatter is source for values.

**Primary CTA contrast contract (`button-primary`):**

- **Light content:** `{colors.accent}` `#FDB913` + `{colors.accent-foreground}` only.
- **Dark content:** `{colors.accent-dark}` `#FBC470` + `{colors.accent-foreground-dark}` only.
- **Forbidden:** `#FDB913` fill on dark content without the dark pair — fails AA at 14px.
- Gate: measured contrast ≥ 4.5:1 for CTA label at 14px in both themes before story baseline.

**Chrome:** nav labels on `{colors.chrome}` / `{colors.chrome-dark}` MUST meet WCAG 2.2 AA. Badge and banner light/dark pairs MUST meet AA at 14px on their intended canvas.

## Typography

Unchanged. Page titles use `{heading}`; section/tab labels use `{heading-sm}` / `{body-medium}`; table headers `{caption}`; numeric columns `{tabular}` with app-level Persian digits.

## Layout & Spacing

Desktop-only MVP (1280×720 minimum, 1920×1080 reference).

- **App chrome:** fixed header `{spacing.chrome-height}`; RTL sidebar `{spacing.sidebar-width}` expanded or `{spacing.sidebar-width-collapsed}` collapsed; content padding `{spacing.content-padding-inline}`; content scrolls independently.
- **Content width:** main workspace uses **full available width** after sidebar — no narrow centered card for primary list/tree surfaces. Forms may keep `{personnel-event-form.maxWidth}` centering.
- **Section tabs:** horizontal tab strip under the surface title; height `{spacing.section-tabs-height}`; active tab uses `{section-tabs.active-border}` (primary blue).
- **Density:** governed tables and trees use `{spacing.table-row-compact}`; forms/profile use comfortable density + `{spacing.form-section-gap}`.
- **Wide tables:** horizontal scroll in the table container; sticky RTL identifier column + sticky row-actions column (inline-end).
- **Dialogs:** confirmations `max-w-2xl`; quick-edit `{personnel-quick-edit-modal.maxWidth}`; event forms `max-w-4xl` on tab (not nested in dialog); import preview = full-width `Sheet`.

## Elevation & Depth

Inherited from shadcn. Chrome remains flat. Collapsed sidebar tooltips use shadcn `Tooltip` elevation.

## Shapes

Unchanged: `{rounded.sm}` inputs/badges, `{rounded.md}` buttons, `{rounded.lg}` dialogs.

## Components

**Inherited brand overrides (unchanged behavior visually):** `button-primary`, `button-secondary`, `app-chrome`, `sidebar-active-item`, `command-palette-result-active`, `status-badge-*`, `stale-banner` (EXPERIENCE behavior id: `stale-recalc-banner`), `break-glass-banner`, prior compositions (`person-profile-section`, `event-timeline-row`, `headcount-capacity-panel`, etc.).

**`import-preview-table`:** visual inherits prior `ux-divan-2026-07-13/DESIGN.md` (Sheet + error row chrome); no new tokens in this revision.

**New / revised compositions:**

| Component | Visual spec |
|---|---|
| **sidebar-nav** | Part of `app-shell` chrome. Expanded: icon + label; collapsed: icon only at `{sidebar-collapsed.icon-size}`; active = `{sidebar-active-item}`; footer collapse toggle on chrome |
| **section-tabs** | Full-width strip; active underline/border `{colors.primary}`; overflow scroll horizontally if needed at 1280 |
| **governed-data-table** | Compact rows; filter controls in a second header row (`{governed-data-table.filter-row-height}`); `{caption}` column headers; sticky id + actions |
| **tree-navigator** | Indented rows (`{tree-navigator.indent}` per level); expand/collapse control (`+`/`−` or chevron) before label; same compact row height as tables |
| **personnel-quick-edit-modal** | Canonical id (YAML alias of prior `quick-edit-modal`). shadcn `Dialog` `{personnel-quick-edit-modal.maxWidth}`; sectioned fields; footer Save (`button-primary`) · Cancel ghost · text link to full profile |

→ Visual refs: `mockups/key-personnel-list.html`, `mockups/key-access-admin.html`, `mockups/key-org-ladder-grade.html`.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Collapse sidebar to reclaim table width | Keep forced narrow content columns on list tabs |
| Show icon + Persian tooltip when collapsed | Hide nav identity with unlabeled icons only |
| One gold CTA region per tab toolbar | Multiple competing gold buttons in the same toolbar |
| Inherit prior light/dark CTA contrast contract | Place `#FDB913` on dark content without dark pair |
| Use tree chrome for hierarchy and ladder→grade | Force LE→Team or ladder→grade into flat tables |
| Prefer shadcn Table + filters for MVP lists | Introduce AG Grid in MVP without a new UX decision |
| Use `personnel-quick-edit-modal` as the component id | Split `quick-edit-modal` vs EXPERIENCE naming |
