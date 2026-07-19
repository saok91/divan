# Rubric Pass 1 Re-check — divan shell redesign

## Verdict readiness

**ready for final** — Prior critical/high blockers (UJ identity, component joins, state edges, visual index) are closed in the patched spines; Pass 1 mechanical coverage holds with only medium/low residue.

## Per category

### 1 Flow — strong

| Journey | Protagonist | Numbered steps | Climax | Failure |
|---|---|---|---|---|
| UJ-1 | Mina, HR Operator | Yes (1–6) | Yes | Yes |
| UJ-2 (correction) | Reza, HR Admin | Yes (1–6) | Yes | Yes |
| UJ-Access | Reza, HR Admin | Yes (1–4) | Yes | Yes |
| UJ-3 | Sara, manager | Yes (1–5) | Yes | Yes |
| UJ-4 | Niloofar + approver/executor | Yes (1–6) | Yes | Yes |
| UJ-5 | Arman, System Admin | Yes (1–4) | Yes | Yes |

UJ-2 restored as correction; access is separately named `UJ-Access` with toxic/self-approval failure. Condensed UJ-3/4/5 are extractable inline (not stubs).

### 2 Token — adequate

YAML colors all have hex/rgba; light/dark pairs present for CTA, chrome, badges, banners, sidebar-active. Contrast contract restated in this DESIGN (CTA ≥4.5:1, chrome AA, badge/banner pairs). Component `{refs}` resolve under local shorthand (`{caption}`, `{personnel-quick-edit-modal.maxWidth}`, etc.). No missing hex.

Remaining: shorthand vs strict `{typography.caption}` paths; `button-secondary` still lacks dark component mappings; a few prose/Tailwind literals (`shadcn input border`, `max-w-*`).

### 3 Component — strong

| Id | DESIGN | EXPERIENCE | Join |
|---|---|---|---|
| app-shell / sidebar-nav | sidebar-nav visual + YAML chrome/collapse; Compose: part of app-shell | app-shell ⊃ sidebar-nav | Explicit |
| section-tabs | YAML + table | Component Patterns | Match |
| governed-data-table | YAML + table | Component Patterns | Match |
| tree-navigator | YAML + table | Component Patterns | Match |
| personnel-quick-edit-modal | Canonical YAML id + table (alias of prior quick-edit-modal) | Component Patterns | Match |
| personnel-event-form | YAML | Component Patterns | Match |
| import-preview-table | Explicit inherit prior DESIGN visual | Behavior + inherit note | Explicit inherit OK |

`stale-recalc-banner` ↔ `{stale-banner}` aliased.

### 4 State — strong

Checklist items present in State Patterns and/or Component Patterns:

| Required | Covered |
|---|---|
| Dirty quick-edit | Stay · Discard · Save; blocks Esc/profile/ثبت رویداد/nav |
| Prefill guard | Inbound prefill vs dirty — guard first; no silent swap |
| Leave-guard | Dirty form/preview leave on tabs/sidebar/palette/history; theme/collapse exempt |
| Toxic access | Block save; Persian reason; audit; افراد و دسترسی or نقش‌ها |
| Clear-filters → section default | Empty table + همکار فعلی = yes restore |
| Tree deactivate | Fail-closed; list blockers; grade-without-parent disabled |
| Filter/sort → page 1 | New snapshot; page = 1 |

Residual (not Pass 1 blockers): dedicated empty/cold-load copy for tree roots still thinner than table empty.

### 5 Visual — strong

**Inventory (published):**

| Path | Files |
|---|---|
| `mockups/` | `key-personnel-list.html`, `key-access-admin.html`, `key-org-ladder-grade.html` |
| `wireframes/` | `ia-2026-07-19.excalidraw` |

All four linked from both spines (Foundation/Brand, IA sections, Components, Key Flows, Mock coverage). Mock coverage marks them `mocked` / `wireframed`. No orphans under `mockups/` or `wireframes/`. `.working/` duplicates are draft-only and not cited as canonical.

## Remaining findings

- **[medium]** Token `{refs}` still use local shorthand (`{caption}`, `{heading-sm}`) rather than strict `{typography.caption}` — document resolver or expand paths.
- **[medium]** Empty/cold-load copy for `tree-navigator` roots (سلسله‌مراتب / لدر و گرید) not a dedicated State Patterns row (deactivate + parent-required are covered).
- **[low]** `button-secondary` lacks dark background/foreground component mappings.
- **[low]** `jalali-date-picker.border: 'shadcn input border'` and several `max-w-*` Tailwind literals are not tokenized.
- **[low]** Prior-run mocks still referenced as `../ux-divan-2026-07-13/mockups/*` (acceptable with “spine wins”; naming each file optional).

**Critical/high count: 0**

## Recommendation

**set status final** — Pass 1 mechanical coverage is satisfied; residual items are medium/low polish, not extract blockers.
