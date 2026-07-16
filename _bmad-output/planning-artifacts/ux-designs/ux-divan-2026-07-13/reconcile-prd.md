# Source Reconciliation — PRD trio

**Workspace:** `ux-divan-2026-07-13`  
**Sources:** `prd.md`, `addendum.md`, `research-hris-practices.md` (optional: `pre-prd.md` — not read)

## Carried into spines

| PRD / addendum input | DESIGN.md | EXPERIENCE.md |
|---|---|---|
| Persian RTL desktop (FR-43) | Typography, layout, chrome RTL | Foundation, Responsive |
| Jalali dates (FR-44) | — | Interaction Primitives |
| Org brand colors (user) | Colors tokens light/dark | — |
| Yekan Bakh (user imports) | Typography | — |
| shadcn (user) | Brand-layer delta pattern | Foundation, Component inheritance |
| UJ-1–UJ-5 | — | Key Flows (verbatim IDs) |
| addendum §9 UX inputs | Components, Do's/Don'ts | Component Patterns, State Patterns |
| FR-33–36 search/dashboard/reports | personnel-data-table, dashboard-metric-card | IA surfaces |
| Permission-safe UI (FR-2, FR-47) | — | IA visibility rules, State Patterns |
| Sensitive confirmations (addendum §9) | button-primary accent for confirm | Sensitive confirmation dialog |
| Stale/recalc (FR-45) | stale-banner | Stale state patterns |
| Light/dark (user decision) | Color dark pairs, Do's | Foundation theme modes |

## Dropped / deferred (not contradicted)

- Workstation / floor map (post-MVP) — noted in PRD only; no MVP surface
- Mobile / bilingual — explicitly out of scope
- `research-hris-practices.md` — not source-extracted in this pass; no unique UX decisions identified without read `[NOTE]`
- pre-prd.md — not loaded

## Qualitative ideas preserved in memlog / coaching

- V2 gold CTA + V4 navy chrome hybrid
- Operator lands on personnel search, not dashboard
- Global Ctrl+K personnel search
- Mixed density delegated to UX with table in DESIGN.md

## Gaps surfaced (Open Questions in EXPERIENCE.md)

- AR-NFR accessibility thresholds
- AR-ACCESS enumeration-safe messages
- Masking vs omit for sensitive profile fields
- Export digit interchange for codes

No PRD scope items silently lost for MVP UX surfaces covered by IA table.
