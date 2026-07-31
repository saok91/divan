---
name: Divan HRIS
description: Persian RTL desktop HRIS. Dense-console revision — inherits the ux-divan-2026-07-19 brand layer and adds the page-layout system, neutral scale, control-affordance contract, dense table chrome, entity picker, feedback/skeleton language, and chart tokens.
status: final
updated: 2026-07-31
inherits: "{planning_artifacts}/ux-designs/ux-divan-2026-07-19/DESIGN.md"
colors:
  primary: '#006FFF'
  primary-foreground: '#FFFFFF'
  primary-dark: '#4D9FFF'
  accent: '#FDB913'
  accent-foreground: '#1A1208'
  accent-dark: '#FBC470'
  accent-foreground-dark: '#1A1208'
  chrome: '#051061'
  chrome-foreground: '#FFFFFF'
  chrome-dark: '#030825'
  muted-brand: '#808184'
  surface-page: '#F4F5F8'
  surface: '#FFFFFF'
  surface-subtle: '#FAFBFC'
  hairline: '#E8EAEF'
  hairline-strong: '#DCDFE7'
  control-border: '#D2D5DF'
  text-primary: '#11142A'
  text-secondary: '#4A4F63'
  text-tertiary: '#8A8F9E'
  row-hover: '#F2F4F8'
  selection-tint: '#EAF3FF'
  selection-tint-border: '#C7DEFF'
  disabled-surface: '#F9FAFB'
  disabled-foreground: '#B8BCC8'
  skeleton: '#E9EAF0'
  keycap-background: '#EEF1F6'
  destructive: '#C92A2A'
  destructive-background: '#FFF5F5'
  dirty-border: '#E09E00'
  surface-page-dark: '#030825'
  surface-dark: '#0A1138'
  hairline-dark: '#232C5E'
  row-hover-dark: '#131C4A'
  text-primary-dark: '#E6E9F5'
  text-secondary-dark: '#9AA1C0'
typography:
  body:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.55'
  body-medium:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 12.5px
    fontWeight: '600'
    lineHeight: '1.55'
  heading:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 17px
    fontWeight: '800'
    lineHeight: '1.3'
    letterSpacing: '-0.01em'
  heading-sm:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 12.5px
    fontWeight: '800'
    lineHeight: '1.35'
  caption:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.5'
  column-header:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 10.5px
    fontWeight: '800'
    letterSpacing: '0.03em'
  field-label:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 11px
    fontWeight: '700'
  tabular:
    fontFamily: 'Yekan Bakh Fa-En'
    fontSize: 12.5px
    fontWeight: '500'
    lineHeight: '1.4'
    fontVariantNumeric: 'tabular-nums'
  identifier:
    fontFamily: 'ui-monospace, Segoe UI, Tahoma, monospace'
    fontSize: 11px
    direction: 'ltr'
rounded:
  sm: 4px
  md: 6px
  lg: 8px
spacing:
  chrome-height: 56px
  sidebar-width: 240px
  sidebar-width-collapsed: 64px
  nav-item-height: 30px
  content-padding-inline: 16px
  section-tabs-height: 30px
  table-row-dense: 32px
  table-header-height: 28px
  control-height-xs: 24px
  control-height-sm: 28px
  control-height: 32px
  form-label-column: 168px
  form-field-gap: 14px
  form-section-gap: 12px
  drawer-width: 480px
components:
  page-header:
    breadcrumbTypography: '{caption}'
    titleTypography: '{heading}'
    purposeTypography: '{caption}'
    background: 'none'
    border: 'none'
  section-tabs:
    height: '{spacing.section-tabs-height}'
    active-border: '2px solid {colors.chrome}'
    typography: '{body-medium}'
  button-primary:
    background: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    background-dark: '{colors.accent-dark}'
    height: '{spacing.control-height}'
    radius: '{rounded.md}'
  button-secondary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    height: '{spacing.control-height-sm}'
    radius: '{rounded.md}'
  button-tertiary:
    background: '{colors.surface}'
    border: '1px solid {colors.control-border}'
    foreground: '{colors.text-primary}'
    hover-background: '{colors.row-hover}'
    height: '{spacing.control-height-sm}'
    radius: '{rounded.md}'
  button-disabled:
    background: '{colors.disabled-surface}'
    border: '1px solid {colors.hairline}'
    foreground: '{colors.disabled-foreground}'
  row-action-button:
    size: '{spacing.control-height-xs}'
    border: '1px solid {colors.control-border}'
    background: '{colors.surface}'
    radius: '{rounded.sm}'
    icon-size: 12px
    background-dark: '{colors.surface-dark}'
    border-dark: '1px solid {colors.hairline-dark}'
  governed-data-table:
    row-height: '{spacing.table-row-dense}'
    header-height: '{spacing.table-header-height}'
    header-background: '{colors.surface-subtle}'
    header-typography: '{column-header}'
    row-border: '1px solid {colors.hairline}'
    row-hover: '{colors.row-hover}'
    sticky-start-separator: 'inset -1px 0 0 {colors.hairline}'
    sticky-end-separator: 'inset 1px 0 0 {colors.hairline-strong}'
    zebra: 'none'
  entity-picker:
    control-height: '{spacing.control-height}'
    popover-radius: '{rounded.sm}'
    popover-border: '1px solid {colors.control-border}'
    popover-shadow: '0 6px 18px rgba(5,16,97,0.13)'
    option-primary: '{body-medium}'
    option-secondary: '{caption}'
    option-code-color: '{colors.primary}'
    active-option-background: '{colors.selection-tint}'
    active-option-marker: 'inset 2px 0 0 {colors.primary}'
  entity-token:
    height: '{spacing.control-height-xs}'
    background: '{colors.selection-tint}'
    border: '1px solid {colors.selection-tint-border}'
    code-color: '{colors.primary}'
    radius: '{rounded.sm}'
  technical-detail-disclosure:
    background: '{colors.surface-subtle}'
    border: '1px solid {colors.hairline}'
    valueTypography: '{identifier}'
    radius: '{rounded.sm}'
  skeleton:
    background: '{colors.skeleton}'
    radius: '3px'
    animation: 'opacity pulse 1.5s ease-in-out infinite'
  tooltip:
    background: '{colors.chrome}'
    foreground: '{colors.chrome-foreground}'
    typography: '{caption}'
    radius: '{rounded.sm}'
  record-drawer:
    width: '{spacing.drawer-width}'
    background: '{colors.surface}'
    border: '1px solid {colors.hairline-strong}'
    shadow: '0 6px 24px rgba(5,16,97,0.16)'
  settings-row:
    height: 'auto'
    layout: 'two-column 1fr / 348px with hairline separator; per-parameter apply, no global save bar'
    labelTypography: '{body-medium}'
    descriptionTypography: '{caption}'
    metaTypography: '{caption}'
    border: '1px solid {colors.hairline}'
    readonly-background: '{colors.surface-subtle}'
    dirty-border: '1px solid {colors.dirty-border}'
    error-foreground: '{colors.destructive}'
    error-background: '{colors.destructive-background}'
    reset-control: 'icon-only row-action with tooltip «بازگشت به پیش‌فرض»'
    readonly-pattern: 'plain value text with lock glyph and stated change path — never a disabled input'
  keycap:
    background: '{colors.keycap-background}'
    border: '1px solid {colors.hairline}'
    typography: '{caption}'
    radius: '3px'
  chart:
    categorical: '#1B3BBB, #087A90, #C2255C, #7048E8, #495057'
    categorical-dark: '#6C8CFF, #3BC9DB, #F06595, #A98BFF, #ADB5BD'
    sequential: '#E8F1FF, #C2DBFF, #8FBEFF, #4D9BFF, #0F7BFF, #0A4FCC, #051061'
    gridline: '{colors.hairline}'
    gridline-dark: '{colors.hairline-dark}'
    axisTypography: '{caption}'
    valueTypography: '{tabular}'
    gold-as-data: 'forbidden'
    status-color-as-series: 'forbidden'
---

# Divan HRIS — Design Spine (Dense Console Revision)

> Revision of `ux-divan-2026-07-19`. The brand layer — navy chrome, gold CTA, blue structure, Yekan Bakh, light/dark canvases — is unchanged. This revision adds what the prior spine left to each implementer: a neutral scale, a page-layout system, a control-affordance contract, dense table chrome, the entity picker, and the feedback/skeleton language. **Spines win on conflict** with any mock. Authorized by `sprint-change-proposal-2026-07-31.md` (FR-57–FR-60).

→ Visual reference: `mockups/direction-a-dense-console.html` (personnel list, event form, states), `mockups/screens-settings.html`, `mockups/screens-reports-capacity.html`, `mockups/screens-bulk-entry-profile.html`, and `mockups/chart-palettes.html` (data color). `mockups/explored-direction-b-*.html` and `-c-*.html` are the rejected alternatives, kept as the record of why the dense register was chosen.

## Brand & Style

A dense professional console. The operator lives in this product all day, so the screen spends its pixels on data, not on decoration: hairline rules instead of boxes, typographic hierarchy instead of cards, compact controls, and no ornament that does not carry meaning. The register is Linear-like restraint applied to a governed Persian enterprise system — quiet by default, emphatic only where a decision or a risk lives.

Chrome stays navy in both themes. Gold appears once per surface region, on the single primary action, and **never** as a data color. Blue carries structure, selection, and identifier codes.

## Colors

Brand pairs are inherited unchanged. This revision adds the neutral scale the prior spine never fixed, which is why sections drifted apart visually.

| Role | Light | Dark |
|---|---|---|
| Page backdrop | `{colors.surface-page}` | `{colors.surface-page-dark}` |
| Content surface | `{colors.surface}` | `{colors.surface-dark}` |
| Subtle surface (headers, footers, disclosures) | `{colors.surface-subtle}` | `{colors.surface-dark}` |
| Hairline (row rules) | `{colors.hairline}` | `{colors.hairline-dark}` |
| Hairline strong (section edges, sticky separators) | `{colors.hairline-strong}` | `{colors.hairline-dark}` |
| Control border | `{colors.control-border}` | `{colors.hairline-dark}` |
| Text primary / secondary / tertiary | `{colors.text-primary}` / `{colors.text-secondary}` / `{colors.text-tertiary}` | `{colors.text-primary-dark}` / `{colors.text-secondary-dark}` / `{colors.text-secondary-dark}` |
| Row hover | `{colors.row-hover}` | `{colors.row-hover-dark}` |
| Selection tint (picker option, token, active filter chip) | `{colors.selection-tint}` + `{colors.selection-tint-border}` | `{colors.row-hover-dark}` + `{colors.hairline-dark}` |
| Disabled | `{colors.disabled-surface}` + `{colors.disabled-foreground}` | `{colors.surface-dark}` + `{colors.text-secondary-dark}` |
| Destructive / validation error | `{colors.destructive}` on `{colors.destructive-background}` | `{colors.destructive}` on `{colors.surface-dark}` |
| Dirty / unsaved confirm border | `{colors.dirty-border}` | `{colors.accent-dark}` |

Status badge pairs, `stale-banner`, and `break-glass-banner` are inherited unchanged and remain reserved for status meaning. **A status color never encodes a data series.**

### Data color

Charts use the distinct multi-hue categorical palette `{chart.categorical}` (dark canvas: `{chart.categorical-dark}`), because most Divan charts carry four or more series and stepped blues stop separating at the 4px stroke widths a twelve-month trend actually renders at.

Three bands are deliberately absent from that palette, and must stay absent: **green** reads as «اعمال‌شده», **orange/amber** collides with «پیش‌نویس», «بازنویسی», and the gold CTA, and mid-blue was pushed to indigo `#1B3BBB` to clear «زمان‌بندی‌شده» `#1864AB`. Adding a "nice" green or orange series later re-breaks the status vocabulary across the whole product. Story 8.10 nudged the light cyan series from `#0B8FA8` to `#087A90` so every categorical swatch meets ≥4.5:1 on the white canvas without introducing green/orange bands.

Single-measure ramps and heat scales use the single-hue `{chart.sequential}`, where ordering is the meaning and hue variety would be noise.

**Contrast contract:** every pair above and every badge/banner meets WCAG 2.2 AA at 13px on its intended canvas, measured in both themes before story baseline. The inherited CTA rule holds: `{colors.accent}` on light content, `{colors.accent-dark}` on dark content, never `#FDB913` on a dark canvas.

## Typography

One family, one scale, used semantically. Base body drops to 13px for console density; numeric content uses `{tabular}` and the app-level Persian digit layer.

| Role | Use |
|---|---|
| `{heading}` | Surface title in `page-header`, one per screen |
| `{heading-sm}` | Form section titles, drawer titles, panel titles |
| `{body-medium}` | Control labels, tab labels, table cell emphasis, picker option primary line |
| `{body}` | Prose, help text, banner copy |
| `{column-header}` | Table column headers only |
| `{field-label}` | Form field labels |
| `{caption}` | Breadcrumb, purpose line, secondary picker line, metadata, hints |
| `{tabular}` | Any figure, count, capacity number, or date |
| `{identifier}` | Technical identifiers (UUID, correlation id) — LTR, monospace, inside a `technical-detail-disclosure` only |

Ad-hoc font sizes and weights outside this table are a defect, not a preference.

## Layout & Spacing

Desktop only: 1280×720 minimum, 1920×1080 reference.

- **Shell:** fixed navy header `{spacing.chrome-height}`; RTL sidebar `{spacing.sidebar-width}` / `{spacing.sidebar-width-collapsed}`; nav items `{spacing.nav-item-height}`; active nav item keeps the inherited gold RTL leading border.
- **Content gutter:** `{spacing.content-padding-inline}` — tightened from the prior 24px so wide governed tables reclaim horizontal space.
- **Page header:** breadcrumb, then title + inline result count, then optional purpose line, then `section-tabs`. No card, no background fill, no divider above the tabs other than the tab strip's own rule.
- **Section tabs:** `{spacing.section-tabs-height}` with a 2px navy active border. *(Override of the prior spine's 44px / primary-blue active border — the dense register needs the shorter strip, and navy keeps blue free for selection and identifier meaning.)*
- **Tables:** header `{spacing.table-header-height}`, rows `{spacing.table-row-dense}`, no zebra, hairline row rules. Column widths follow content with per-column max width and ellipsis truncation; **no fixed table min-width** is permitted.
- **Forms:** two-column layout — a `{spacing.form-label-column}` section-description column at the inline-start, fields at the inline-end; `{spacing.form-field-gap}` between fields, `{spacing.form-section-gap}` between sections, sections separated by a hairline. Sticky footer action bar.
- **Control heights:** `{spacing.control-height-xs}` row actions, `{spacing.control-height-sm}` toolbar controls and filters, `{spacing.control-height}` form inputs and the primary CTA.
- **Drawer:** `{spacing.drawer-width}`, inline-end, for record-scoped detail (capacity exemptions/overrides) — replaces stacking panels on one page.
- **Density toggle:** compact is default; the comfortable option raises the row to the inherited 48px without changing any other token.

## Elevation & Depth

Flat by default. Only three things lift: the picker popover (`{entity-picker.popover-shadow}`), the record drawer (`{record-drawer.shadow}`), and dialogs (inherited shadcn). Sticky table columns and sticky headers separate with an inset hairline shadow, never with a drop shadow.

## Shapes

Unchanged: `{rounded.sm}` inputs, badges, tokens, row actions; `{rounded.md}` buttons; `{rounded.lg}` dialogs and framed regions.

## Components

Inherited unchanged: `app-shell`, `sidebar-nav`, `status-badge-*`, `stale-banner`, `break-glass-banner`, `jalali-date-picker`, `sensitive-confirmation-dialog`, `personnel-quick-edit-modal`, `import-preview-table`, `tree-navigator`, `command-palette`.

New and revised:

| Component | Visual spec |
|---|---|
| **page-header** | Breadcrumb `{caption}` → title `{heading}` + result count `{caption}` → purpose line `{caption}` → `section-tabs`. Primary action sits in the toolbar row beneath, never in the header. |
| **button family** | `button-primary` gold, `{spacing.control-height}`, one per surface region. `button-secondary` blue for draft/parallel commits. `button-tertiary` white with `{colors.control-border}` — the default for everything else. **`ghost` is no longer permitted for row or toolbar actions**; it survives only for dialog cancel and inline dismiss. Disabled uses `button-disabled` and always carries a reason. |
| **row-action-button** | `{spacing.control-height-xs}` square, **outlined at rest** with `{row-action-button.border}` and `{colors.surface}` fill, 12px icon, `{rounded.sm}`. Icon-only in the table; the label lives in `aria-label` and the tooltip. Hover deepens the border to `{colors.text-tertiary}`; the blue variant tints border and icon with `{colors.primary}`. Never hover-revealed, never borderless. |
| **governed-data-table** | Hairline rules, no zebra, no card wrapper, sticky `{surface-subtle}` header, sticky identifier column at inline-start and sticky actions column at inline-end — both separated by inset hairlines, not shadows. Truncated cells show a full-value tooltip. Filter row inherits the prior 36px. |
| **entity-picker** | `{spacing.control-height}` input with a leading search glyph. Popover: header `{caption}` with scope note, options as two lines — primary `«{code} — {name}»` with the code in `{colors.primary}` `800`, secondary `{caption}` disambiguator — active option tinted `{colors.selection-tint}` with a 2px blue inline-start marker; footer strip shows keyboard hints as `keycap`. Selected value renders as an `entity-token`. |
| **entity-token** | Chip with `{colors.selection-tint}` fill, blue code, dark label, and an inline-end clear control. |
| **technical-detail-disclosure** | Collapsed row labelled «شناسهٔ فنی»; expanded shows the value in `{identifier}` on `{colors.surface}` inside a hairline box with a copy control. Never expanded by default. |
| **skeleton** | `{colors.skeleton}` blocks shaped like the content they replace — table rows keep row height and column rhythm; cards keep their box. Opacity pulse only; static under `prefers-reduced-motion`. |
| **tooltip** | Navy `{colors.chrome}` on `{colors.chrome-foreground}`, `{caption}`, `{rounded.sm}`, 6px offset. Appears on hover **and** on keyboard focus. |
| **record-drawer** | Inline-end panel `{spacing.drawer-width}` with its own header (record identity + close), hairline-separated sections, and a sticky footer for its actions. One drawer at a time; never over a dialog. |
| **settings-row** | Two-column hairline row (`1fr / 348px`): label `{body-medium}` + operational description `{caption}` + meta line (source · default · last change) on one side; value control and icon-only «بازگشت به پیش‌فرض» on the other. Dirty rows grow a full-width confirm bar with blast-radius note and per-parameter «اعمال تغییر» — there is no global save bar. Invalid values use `{colors.destructive}` on `{colors.destructive-background}` and disable apply. Read-only rows use `{settings-row.readonly-background}` with a lock glyph and the real change path stated in plain Persian; they are never a disabled input that implies a missing permission. |
| **keycap** | Small key chip for keyboard hints in nav, picker footer, and toolbar. |
| **chart** | Categorical series follow `{chart.categorical}` in order, swapped for `{chart.categorical-dark}` on the dark canvas; single-measure ramps and heat scales use the single-hue `{chart.sequential}`. Gridlines `{chart.gridline}`, axis labels `{caption}`, values `{tabular}`, legend inline above the plot. Gold is forbidden as a data color; status colors encode status only. |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Separate with hairlines and type weight | Wrap every region in a bordered card |
| Give every actionable control a visible boundary at rest | Use `ghost` for row or toolbar actions |
| Let column width follow content, truncate with a tooltip | Set a table min-width that forces horizontal scroll |
| Keep one gold CTA per surface region | Compete two gold buttons in one toolbar |
| Show the business code in blue, the name in ink | Show a UUID as a record's identity |
| Put technical identifiers behind «شناسهٔ فنی» | Print a raw UUID in a table cell or a heading |
| Shape skeletons like their eventual content | Replace a table with a spinner |
| Reserve status colors for status | Use a status color as a chart series |
| Verify each surface in light and dark before baseline | Ship a surface specified in one theme only |
