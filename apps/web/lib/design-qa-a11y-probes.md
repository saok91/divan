# Design QA — Accessibility Probes (Story 8.10)

Automated strings come from Epic 8 selfchecks. Interactive keyboard/focus probes are manual DoD (no Playwright).
Each probe group Result: `pass` | `fail` (required for gate).

Honesty: Result=`pass` means AST/selfcheck contracts are green and gallery hosts were spot-checked for the listed Manual DoD paths — not a Playwright/axe run and not a full production-surface keyboard audit.

| Probe group | Automated | Manual DoD | Result | Notes |
| --- | --- | --- | --- | --- |
| Picker | `selfcheck:entity-picker` — `role="combobox"`, `aria-expanded`, `aria-activedescendant` | Gallery EntityPicker: arrows, Enter, Escape; announcement on selection | pass | Empty vs out-of-scope indistinguishability preserved; interactive = gallery spot-check + AST |
| Tables | `selfcheck:governed-table` — live-region counts, sort affordances, sticky id/actions | Personnel or access list: sort + count announcement; sticky context while scrolling | pass | Page-level H-scroll forbidden; table inner overflow allowed; interactive = spot-check + AST |
| Dialogs / drawers | `selfcheck:leave-guard` algorithm + Radix Dialog/Sheet defaults | Leave-guard dialog, one sheet/drawer (import or headcount), one Radix dialog: focus trap, Escape closes, focus returns to opener | pass | Documented manual spot-check on proof primitives; no focus-return defects found |
| Icon-only | `selfcheck:row-actions` — `aria-label`, tooltip on focus path | Gallery RowActionCluster: Tab shows tooltip + accessible name | pass | Tooltip never sole label; interactive = gallery spot-check + AST |

## Viewport DoD (AC #4)

| Viewport | Essential tasks | Page-level H-scroll | Result |
| --- | --- | --- | --- |
| 1280×720 | Open personnel list; open event form; dashboard glance; open one headcount panel | none required | pass |
| 1920×1080 | Same essential tasks | none required | pass |

Zoom ≠ gate (`viewport-gate` behavior unchanged).
