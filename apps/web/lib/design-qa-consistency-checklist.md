# Design QA — Cross-Surface Consistency Checklist (Story 8.10)

Machine-checkable areas are enforced by Epic 8 selfchecks invoked from `selfcheck:design-qa`.
Manual residuals are signed in Story 8.10 Completion Notes.

| Area | Automated proof | Manual residual | Gate |
| --- | --- | --- | --- |
| Page header | `selfcheck:layout-system` — PageHeader / purpose non-empty on proof surfaces | Visual order breadcrumb→title→purpose→tabs | pass |
| Panel system | `selfcheck:layout-system` — PanelSection / tokens | Panel vs full-bleed table rule on proof surfaces | pass |
| Form layout | FormLayout / FormFooter presence (layout + event form paths) | Label column + sticky footer order Cancel · Save draft · Finalize | pass |
| Table chrome | `selfcheck:governed-table` — no fixed min-width; density; sticky separators | 1280 readability; no page-level H-scroll | pass |
| Button variants | `selfcheck:control-contract` | One gold primary per region | pass |
| Icon mapping | `selfcheck:row-actions` + `icons/icon-contract.md` | Same action → same icon across 2+ surfaces | pass |
| Feedback channel | `selfcheck:feedback` + `feedback/FEEDBACK.md` | One channel per event on proof flows | pass |

## Required subprocess suite (fail-closed)

1. `selfcheck:control-contract`
2. `selfcheck:layout-system`
3. `selfcheck:entity-picker`
4. `selfcheck:governed-table`
5. `selfcheck:row-actions`
6. `selfcheck:leave-guard`
7. `selfcheck:feedback`
8. `selfcheck:operational-copy`
9. `selfcheck:a11y-floor`

## Hotspot triage (Task 0)

| Hotspot source | Disposition |
| --- | --- |
| 8.2 ad-hoc typography panels (access-*, entitlement, break-glass, audit, approval, exemption, override, headcount-capacity, launch-artifact, operations-health, person-profile residual, foreshadows, correction, sensitive-confirmation) | **amendment** — not blocking Epic 8 proof set; migrate on next touch / Epic 9 polish. Proof surfaces (personnel list, event form, gallery, dashboard banners) use semantic roles. |
| 8.6 sticky `thead` vertical pin | **amendment** 8.10-A4 — optional; horizontal sticky id/actions remain |
| 8.8 blob skeletons / local StatusMessage clones on deferred panels | **amendment** — proof set uses FeedbackMessage + TableSkeleton; remaining panels Epic 9 polish |
| 8.9 remaining glossary placements; optional personnel-list live mark; dual live-region review | **amendment** — copy selfcheck green; optional polish deferred |
