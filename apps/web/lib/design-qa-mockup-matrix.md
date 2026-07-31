# Design QA — Mockup Screen-by-Screen Matrix (Story 8.10)

Forward UX: `ux-divan-2026-07-31`. Spines win on conflict with mocks.
Result values: `pass` | `fixed` | `amendment` (required non-empty for gate).

| Screen | Mockup file | App route / proof surface | Result | Notes |
| --- | --- | --- | --- | --- |
| Personnel list | `direction-a-dense-console.html` | `/personnel/list` + gallery FullBleedTableHost | pass | Dense console chrome, PageHeader, governed table density match Direction A; light/dark via theme + gallery |
| Personnel event form | `direction-a-dense-console.html` | `/personnel-events/register` (`PersonnelEventFormHost`) | pass | FormLayout + FormFooter + EntityPicker identifier-first; Cancel · Save draft · Finalize order held by 8.4 |
| Person profile | `screens-bulk-entry-profile.html` (profile sections) | `/personnel/profile/[personId]` | amendment | Sectioned profile + status badges; residual ad-hoc title classes deferred to Epic 9 polish (8.2 hotspot) — not silent pass |
| Reports workspace | `screens-reports-capacity.html` | `/reports` (catalogue scaffold) | amendment | Epic **9.5** owns reports section-tabs workspace; catalogue scaffold compared — no silent product completeness claim |
| Dashboard | Direction A / capacity screens | `/dashboard` | pass | Metric cards + stale banner tokens; chart series colors gated via DESIGN categorical (cyan AA nudge — see amendments) |
| Headcount + drawer | `screens-reports-capacity.html` | `/headcount/*` panels + sheet/drawer primitives | pass | Capacity/approval/exemption/override panels present; drawer focus trap covered by a11y probes |
| Bulk-entry wizard | `screens-bulk-entry-profile.html` | `/personnel/*/bulk-import`, `/personnel-events/*/bulk-import`, `/headcount/*/bulk-import` | amendment | Story **9.2** landed shared five-step day-to-day flow on all three tabs; Result stays `amendment` until **9.3** domain template/validator wiring |
| Settings | `screens-settings.html` | no production settings route yet | amendment | Epic **10.1–10.2** owns settings registry/surface; mock retained as target — amendment recorded |
| Chart palettes | `chart-palettes.html` | DESIGN `chart.categorical` + dashboard/report consumers | fixed | Light series-2 cyan `#0B8FA8` → `#087A90` for ≥4.5:1 on white canvas (spine amendment 8.10-A1); mockups synced to `#087A90`; dark categorical unchanged |

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
