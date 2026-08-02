# Design QA — Mockup Screen-by-Screen Matrix (Story 8.10)

Forward UX: `ux-divan-2026-07-31`. Spines win on conflict with mocks.
Result values: `pass` | `fixed` | `amendment` (required non-empty for gate).

| Screen | Mockup file | App route / proof surface | Result | Notes |
| --- | --- | --- | --- | --- |
| Personnel list | `direction-a-dense-console.html` | `/personnel/list` + gallery FullBleedTableHost | pass | Dense console chrome, PageHeader, governed table density match Direction A; light/dark via theme + gallery |
| Personnel event form | `direction-a-dense-console.html` | `/personnel-events/register` (`PersonnelEventFormHost`) | pass | FormLayout + FormFooter + EntityPicker identifier-first; Cancel · Save draft · Finalize order held by 8.4 |
| Person profile | `screens-bulk-entry-profile.html` (profile sections) | `/personnel/profile/[personId]` | amendment | Sectioned profile + status badges; residual ad-hoc title classes deferred to Epic 9 polish (8.2 hotspot) — not silent pass |
| Reports workspace | `screens-reports-capacity.html` | `/reports/*` subject tabs + rail/params/run/meta (9.5) | pass | Story **9.5** IA + Story **9.10** optional categorical chart companion (shared SVG chrome) above GovernedDataTable for `distributions` / `org_state` plus generic `count`+label shape (skips list-id columns); table remains SoT |
| Dashboard | Direction A / capacity screens | `/dashboard` | pass | Story **9.10**: Panel/hairline metric cards + FeedbackMessage + lastCalc; `workforce_trend` / `starts_terminations` use shared chart chrome; DESIGN categorical CSS tokens |
| Headcount + drawer | `screens-reports-capacity.html` | `/headcount/*` governed table + row record-drawer (9.4) | pass | Story **9.4** IA: one approvals GovernedDataTable on هدکانت; create FormLayout on ایجاد; exemptions/overrides/historical in 480px Sheet record-drawer; Escape + focus return; drawer focus trap covered by a11y probes |
| Bulk-entry wizard | `screens-bulk-entry-profile.html` | `/personnel/*/bulk-import`, `/personnel-events/*/bulk-import`, `/headcount/*/bulk-import` | pass | Story **9.3** domain templates + validators + cutover wiring on shared five-step flow (person / TransferRecorded / headcount approval) |
| Settings | `screens-settings.html` | no production settings route yet | amendment | Epic **10.1–10.2** owns settings registry/surface; mock retained as target — amendment recorded |
| Chart palettes | `chart-palettes.html` | DESIGN `chart.categorical` + dashboard/report consumers | fixed | Light series-2 cyan `#087A90` (8.10-A1); Story **9.10** wired CSS `--chart-*` + runtime consumers (dashboard + reports + `/dev/gallery`); dark categorical unchanged |

## Light / dark parity

| Surface class | Light | Dark | Notes |
| --- | --- | --- | --- |
| Proof product routes | pass | pass | Theme toggle + gallery explicit light/dark buttons |
| Status badges | fixed | pass | Light effective/draft fg nudged for AA (8.10-A2) |
| Stale / break-glass banners | pass | pass | Token pairs asserted in `a11y-floor.selfcheck` |
| Chart series | fixed | pass | See 8.10-A1 |

## Spine amendments (this gate)

| ID | Change | Owner |
| --- | --- | --- |
| 8.10-A1 | `chart.categorical` series-2 `#0B8FA8` → `#087A90` (AA on light canvas) | Story 8.10 / DESIGN |
| 8.10-A2 | Light `--status-badge-effective-fg` `#2b8a3e`→`#1f7a32`; `--status-badge-draft-fg` `#e67700`→`#a85700`; `--text-tertiary` light `#8a8f9e`→`#6b7080`, dark `#6e7594`→`#8a91b0` | Story 8.10 / globals |
| 8.10-A3 | Settings / bulk-entry wizard / reports tabs product completeness deferred to Epics 9–10 | Epic 9 / 10 |
| 8.10-A4 | Optional sticky `thead` vertical pin remains deferred (filter-row risk); horizontal sticky id/actions remain SoT | Epic 8 residual / optional DESIGN align |
