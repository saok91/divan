---
name: Divan HRIS
description: Governed Persian RTL desktop HRIS for a single on-premise organization. shadcn/ui brand-layer delta with org palette, Yekan Bakh, and light/dark modes.
status: final
updated: 2026-07-15
colors:
  # Brand overrides on shadcn defaults. Unlisted tokens inherit shadcn theme (background, foreground, muted, border, input, ring, destructive, card, popover).
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
  table-row-compact: 40px
  table-row-comfortable: 48px
  form-section-gap: 24px
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
---

## Brand & Style

Divan is a governed HRIS for authorized staff — not a consumer app, not an employee portal in MVP. The product premise is *trustworthy workforce state*: who works here, where, what changed, and whether capacity rules hold. The brand expression follows: **enterprise dark chrome** (navy header and sidebar) framing a **light or dark content canvas**, **blue for structure and navigation**, **gold for the one primary action on a surface**, and **typographic clarity in Yekan Bakh** across Persian RTL copy.

Divan inherits shadcn/ui defaults wholesale. This DESIGN.md specifies only the brand-layer deltas — org palette, typography, chrome treatment, density tokens, light/dark pairs, and named brand components. Standard shadcn components (`Button`, `Card`, `Dialog`, `Sheet`, `Command`, `Table`, `Tabs`, `Toast`, `Alert`, `Badge`, `DropdownMenu`, `Popover`, `Skeleton`) inherit shadcn visual specs except where explicitly overridden below. Org colors are **preferred, not mandatory** — implementation may adjust for contrast while preserving the V2+V4 hybrid posture (gold primary CTA, blue structure, navy chrome).

Font files: `imports/fonts/yekan-bakh/` (Fa-En weights). **Do not use FaNum variants.** Persian digit shaping is handled by application formatting, not font features.

→ Visual references: `mockups/key-personnel.html`, `mockups/key-profile.html`, `mockups/key-dashboard.html`, `wireframes/ia-2026-07-15.excalidraw`, `wireframes/flow-mina-transfer-2026-07-13.excalidraw`. **Spines win on conflict.**

## Colors

Palette maps the org colors into semantic roles with light/dark pairs.

| Token | Light | Dark | Role |
|---|---|---|---|
| `primary` | `#006FFF` | `#4D9FFF` | Links, secondary buttons, active command-palette row, chart series, focus ring companion |
| `accent` | `#FDB913` | `#FBC470` | **Primary CTA** on each surface — finalize, save, confirm import, run report |
| `chrome` | `#051061` | `#030825` | Header bar and RTL sidebar background |
| `muted-brand` | `#808184` | `#9E9EA0` | De-emphasized labels, column headers, helper text on chrome |
| `sidebar-active-background` | `rgba(255,255,255,0.12)` | `rgba(255,255,255,0.08)` | Active nav item fill on chrome |
| `primary-foreground` / `accent-foreground` / `chrome-foreground` | per YAML | per YAML | Text/icons on filled surfaces |

**Light mode content canvas:** shadcn default `background` / `card` (white and near-white). **Dark mode content canvas:** shadcn dark `background` / `card`; chrome stays navy for continuity (V4 enterprise shell).

**Status badge tokens** (YAML `status-badge-*`): each has light and dark background/foreground pairs for use on content canvas — never reuse light tints on dark cards.

**Global banners:** `stale-banner` (blocking/recalc warning) and `break-glass-banner` (secondary, time-bound privileged access notice) stack below header — stale blocking takes visual precedence; see EXPERIENCE.md App shell.

**Primary CTA contrast contract (`button-primary`):**

- **Light content:** use `{colors.accent}` + `{colors.accent-foreground}` only.
- **Dark content:** use `{colors.accent-dark}` + `{colors.accent-foreground-dark}` only.
- **Forbidden:** `{colors.accent}` `#FDB913` fill on dark content cards — fails AA at 14px if misapplied.
- Implementation gate: measured contrast ratio ≥ 4.5:1 for CTA label at 14px in both theme modes before story baseline.

Load-bearing contrast: all badge and banner pairs above MUST meet WCAG 2.2 AA at 14px on their intended canvas. Chrome text on `{colors.chrome}` MUST meet AA for nav labels.

→ Theme exploration: `.working/color-themes-1.html`, `.working/color-themes-2.html`.

## Typography

All UI text uses **Yekan Bakh Fa-En** from `imports/fonts/yekan-bakh/` — Regular (400) body, Medium (500) labels and table emphasis, Bold/SemiBold (600–700) headings. No secondary display face; Divan reads as one sober enterprise type family.

| Role | Token | Use |
|---|---|---|
| Page title | `heading` | Surface H1 — «پرسنل», «داشبورد» |
| Section title | `heading-sm` | Profile sections, form sections, dashboard groups |
| Body | `body` | Paragraphs, table cells (comfortable surfaces) |
| Label / emphasis | `body-medium` | Field labels, nav group titles |
| Meta / helper | `caption` | Timestamps, provenance, column hints |
| Numeric columns | `tabular` | Counts, codes in tables — paired with app-level Persian digit formatting |

**Digit display:** typography does NOT auto-localize digits. The app renders Persian digits (۰–۹) via locale/formatting layer. Financial amounts additionally use thousand separators (٬). See EXPERIENCE.md Interaction Primitives.

Minimum body size: 14px at 1920×1080 reference viewport.

## Layout & Spacing

Desktop-only MVP (1280×720 minimum, 1920×1080 reference). shadcn / Tailwind 4-based scale inherited; Divan adds:

- **App chrome:** fixed header `{spacing.chrome-height}`; RTL sidebar `{spacing.sidebar-width}`; content scrolls independently. Banner stack (stale, break-glass) sits directly below header.
- **Density (mixed):** personnel lists and report tables use `{spacing.table-row-compact}`; profile, timeline, and event forms use `{spacing.table-row-comfortable}` and `{spacing.form-section-gap}` between sections.
- **Wide tables:** horizontal scroll within a card that **pins row actions and primary identifier column** (RTL: rightmost column sticky). No full-page horizontal scroll.
- **Dashboard:** responsive grid 2–4 columns at ≥1280px; single column at 1280×720.
- **Dialogs:** `max-w-2xl` for confirmations; `max-w-4xl` for event forms; full-width sheet only for import preview tables.

## Elevation & Depth

Inherited from shadcn — subtle shadow on `card`, `popover`, `dialog`. Divan adds no custom elevation tokens. **Chrome is flat** (no shadow); content cards use shadcn default shadow-sm on hover for interactive rows only.

## Shapes

Slightly tighter than shadcn defaults: `{rounded.sm}` inputs and badges, `{rounded.md}` buttons and cards, `{rounded.lg}` dialogs and command palette. Pill badges (`rounded/full`) for Scheduled/Effective/Cancelled/Reversed/Draft/Override status.

## Components

**Inherited unchanged (behavioral specs in EXPERIENCE.md):** shadcn `Table`, `Tabs`, `DropdownMenu`, `Toast`, `Alert`, `Skeleton`, `Separator`, `Avatar`, `Tooltip`.

**Brand-layer overrides:**

| Component | Visual spec |
|---|---|
| **button-primary** | Theme-aware gold CTA per Colors contract — one per surface region |
| **button-secondary** | `{colors.primary}` fill — save draft, secondary export |
| **app-chrome** | Header + sidebar `{colors.chrome}`; logo right (RTL); user menu left |
| **sidebar-active-item** | `{colors.sidebar-active-background}` + `{colors.accent}` RTL leading border |
| **command-palette-result-active** | `{colors.primary}` highlight row |
| **status-badge-*** | Semantic tints per YAML; pill shape; dark pairs on dark canvas |
| **stale-banner** | `{stale-banner}` tokens; full-width; blocking variant non-dismissible |
| **break-glass-banner** | `{break-glass-banner}` tokens; secondary to stale; dismissible when time expires |

**Custom compositions (shadcn primitives composed):**

| Component | Visual spec |
|---|---|
| **person-profile-section** | shadcn `Card`; `{heading-sm}` title; `{spacing.form-section-gap}` padding; sensitivity icon on governed categories |
| **personnel-data-table** | Compact row height; `{caption}` headers; sticky identifier column (RTL right) |
| **event-timeline-row** | Decorative status dot (`aria-hidden`); `{body}` type + text **status badge**; `{caption}` timestamps; chain icon for correction/neutralization |
| **headcount-capacity-panel** | used / reserved / free / exempt / overridden with `{tabular}` numerals; free > 0 uses `{colors.primary}` |
| **dashboard-metric-card** | shadcn `Card`; `{heading-sm}` name; `{heading}` value; `{caption}` reconciliation link |
| **import-preview-table** | Error rows `destructive/10`; warning rows amber tint; `{caption}` Persian row/column cite |
| **jalali-date-picker** | shadcn `Input` + `Popover` calendar; `{rounded.sm}` input; `{rounded.lg}` calendar; Jalali month grid |
| **personnel-event-form** | Sectioned `Form` in `{personnel-event-form.maxWidth}`; section titles `{heading-sm}`; footer: ghost Cancel · `{button-secondary}` Save draft · `{button-primary}` Finalize |
| **sensitive-confirmation-dialog** | shadcn `Dialog` `{sensitive-confirmation-dialog.maxWidth}`; consequence block `{body}`; meta `{caption}`; reason field when required; `{button-primary}` confirm |
| **export-artifact-panel** | Classification `{body-medium}`; expiry/handling `{caption}`; download uses `{button-secondary}`; custody acknowledgement checkbox before sensitive bulk |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Offer **light and dark** theme toggle; persist preference | Ship light-only or hard-code colors without dark pairs |
| Use theme-aware **gold CTA** per Colors contract | Place `#FDB913` button fill on dark content canvas |
| Use `{colors.primary}` for links, secondary actions, chart emphasis | Replace shadcn `destructive` with custom reds |
| Keep navy chrome in **both** modes | White sidebar in light mode |
| Format Persian digits in code; use Fa-En font files | Enable FaNum font features |
| Apply thousand separators on **financial** amounts | Mix Latin digits in user-facing numeric copy |
| Mark timeline dot decorative; badge text is status source | Rely on dot color alone for status |
| Stack stale banner above break-glass banner | Collapse or hide stale warning behind break-glass |
