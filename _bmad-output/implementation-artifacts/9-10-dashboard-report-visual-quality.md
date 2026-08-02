---
baseline_commit: b9760aeccdc0141fe01e60053dddc14481699a5e
---

# Story 9.10: Dashboard & Report Visual Quality

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a manager reading numbers,
I want charts and metrics that are legible, honest, and consistent,
so that I can trust what I take into a meeting (UX-DR40, FR35, FR36).

**Story key:** `9-10-dashboard-report-visual-quality`  
**Epic:** 9 — Operational Surface Completion & IA Coherence (closes Epic 9 visual-quality last mile; FR59 surface completion; FR58 chart theme parity)  
**UX contract:** `ux-divan-2026-07-31` (DESIGN chart tokens + UX-DR40; mockups `chart-palettes.html`, `screens-reports-capacity.html`)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (§4.2.5 Story 9.10 — UX-DR40 on dashboard + report workspace)  
**Prerequisite:** Stories **9.1–9.9** done (report workspace IA, no-dead-end gate); Story **8.2** Panel system; Story **8.10** `selfcheck:design-qa` + 8.10-A1 cyan AA nudge; Story **5.4** dashboard snapshot + suppress≠empty≠zero.  
**Downstream:** Epic **10** settings; Epic 9 retrospective optional. This story closes Epic 9’s last backlog item.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| DESIGN chart tokens | `ux-divan-2026-07-31/DESIGN.md` frontmatter `chart.*` | Canonical categorical / categorical-dark / sequential / gridline / typography; gold+status forbidden as data | **Not wired into `globals.css`**; no runtime consumer |
| Chart AA gate | `apps/web/lib/a11y-floor.selfcheck.ts` | Hardcoded light+dark categorical AA on canvas (8.10-A1 `#087A90`) | Prefer CSS-token SoT; keep AA; ban gold/status-as-series in chart selfcheck |
| Chart palette mock | `mockups/chart-palettes.html` | Option 2 (distinct multi-hue) = accepted spine | Living gallery demo of shared chart chrome missing |
| Dashboard host | `apps/web/components/dashboard/dashboard-panel.tsx` | Shared filters + snapshot query + 2–4 col grid + footer lastCalc; `workforce_trend` as **text lines** | No chart; raw `<p role=alert\|status>`; cards not Panel 8.2 |
| Metric card | `apps/web/components/dashboard/dashboard-metric-card.tsx` | UX-DR15 outcomes; suppress≠empty≠zero; reconcile + leave-guard | Bordered card chrome; no per-card lastCalc; raw status `<p>` |
| Dashboard filters | `apps/web/components/dashboard/dashboard-filters.tsx` | EntityPicker + Jalali + trend range | Preserve; first-touch FeedbackMessage only if rewritten |
| Snapshot SoT | `packages/modules/reporting/src/dashboard-snapshot.ts` | Permission-safe cards + trend buckets + outcomes | **Presentation only** — do not change assemble math / suppress oracles |
| Report workspace | `apps/web/components/reports/report-workspace.tsx` | Rail · params · `run=1` · meta · **GovernedDataTable** · FeedbackMessage · export | Mock shows chart-box; **no chart region**; keep GDT as tabular SoT |
| Panel system (8.2) | `apps/web/components/layout/panel-section.tsx` | `Panel` / `PanelSection` / hairline — not bordered cards | Metric cards must adopt this posture |
| FeedbackMessage (8.8) | `apps/web/components/ui/feedback-message.tsx` | empty / error / loading / info / suppressed patterns | Dashboard chrome still uses raw `<p>` |
| Design-QA | `selfcheck:design-qa` + `design-qa-mockup-matrix.md` | Reports structure `pass` (charts → 9.10); Chart palettes `fixed` (token AA) | Record **consumer** chart chrome; optional new chart selfcheck in REQUIRED_SCRIPTS |
| No-dead-end (9.9) | `selfcheck:no-dead-end-ia` | Nav + tabs functional | Must stay green; do not regress |

### Critical distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Visual quality vs new metrics** | Apply UX-DR40 to **existing** FR35/FR36 surfaces. Do **not** invent report keys, metric formulae, cohort thresholds, or AR-REPORTING freezes. |
| **Shared chart chrome vs BI suite** | One reusable chart treatment (tokens + typography + empty/suppress/stale) for dashboard **and** reports. Story **5.4** absolute non-goal: no BI/chart SaaS shopping. Prefer a **thin shared SVG** primitive under `apps/web/components/charts/`. Recharts only if justified — and then pin React 19 `react-is` override (see Latest tech). |
| **Categorical vs sequential** | Multi-series / named categories → `chart.categorical` (light) / `chart.categorical-dark` (dark). Single-measure ramps / heat → `chart.sequential` only. Never mix roles. |
| **Gold / status vs data** | Gold CTA and status badge hues (green effective, amber draft, scheduled blue, override, …) are **forbidden** as series fills/strokes. Green and orange/amber bands stay excluded from the data palette forever. |
| **Suppress ≠ empty ≠ zero ≠ pending** | Suppressed cohort → `operationalCopy.suppressedCohort` («داده قابل نمایش نیست») — **never `0`**. Empty scope → empty copy. Pending/stale → muted + «در حال محاسبه — عدد ممکن است تغییر کند.» / figureRecalculating. Exact strings from operational-copy SoT. |
| **Panel vs card spam** | DESIGN Do: hairlines + type. Don't: wrap every region in a bordered card. Metric cards adopt **8.2 `Panel` / hairline** posture — not heavier shadcn Card chrome. |
| **Table vs chart on reports** | GovernedDataTable remains the authoritative run result. Chart is an **optional visual companion** when the result/distribution shape supports it (e.g. categorical breakdown already in rows) — never a second SoT, never replaces the table. |
| **Presentation only** | No Prisma in web; no domain assemble changes “for prettier charts”; no PopulationPort / N+1 / Settings claims. |
| **Matrix honesty** | Update Dashboard / Reports / Chart palettes **notes** to record consumer chrome. Do not flip Settings (Epic 10) or invent silent pass for untouched hotspots. |

## Acceptance Criteria

1. **Given** the DESIGN chart tokens  
   **When** the visual quality pass is complete  
   **Then** categorical series use `chart.categorical` on light and `chart.categorical-dark` on dark, and single-measure ramps use `chart.sequential`  
   **And** those values are available as CSS custom properties (or a single token helper) consumed by shared chart chrome — not scattered hardcoded hex in components (a11y-floor may read the same SoT)

2. **And** gold is never used as a data color and status colors are never used as a data series (selfcheck asserts palette ∩ forbidden sets is empty; stroke/fill props resolve only to chart tokens)

3. **And** chart typography, axis and label treatment, legend, tooltip, and tabular numerals follow DESIGN **once** and are **reused** by dashboard and reports:
   - axis / labels → `{caption}` / `text-caption`
   - values → `{tabular}` / `text-tabular` + `toPersianDigits`
   - gridlines → `chart.gridline` (dark: `chart.gridline-dark` / hairline-dark)
   - legend **inline above** the plot
   - tooltip uses DESIGN tooltip chrome (navy caption), not a white default

4. **And** series remain distinguishable in both themes and under common color-vision deficiency, verified at the stroke widths actually rendered (~4px twelve-month trends per DESIGN) — prefer distinct shapes **or** direct labels in addition to color (EXPERIENCE: nothing by color alone)

5. **And** empty, suppressed-cohort, and stale/pending chart treatments are consistent across dashboard and reports:
   - suppressed → `operationalCopy.suppressedCohort` («داده قابل نمایش نیست») and **never** zero (FR48, UX-DR15)
   - empty → empty-scope / empty-result copy (not suppress wording)
   - stale/pending → muted figure treatment + `operationalCopy.figureRecalculating` (or FeedbackMessage loading/info) — never masquerade as current truth (FR45 / NFR-3)

6. **And** metric cards adopt the Story **8.2** panel system (`Panel` / hairline posture from `panel-section.tsx`) and show **last calculation time** (per card and/or grid — must be visible on allowed **and** on empty/suppress banner paths, preserving 5.4 review posture)

7. **And** nothing is communicated by color alone (legend and/or series labels / patterns)

8. **And** Epic 8 / Epic 9 encode held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green (includes `selfcheck:no-dead-end-ia`)
   - First-touch on rewritten dashboard (+ any new report chart region): **FeedbackMessage** / PendingSurface — no new StatusMessage clones; no raw `<p role=alert|status>` on touched chrome
   - AR-\* fail-closed; presentation/visual only over unchanged domain rules

9. **And** scope boundaries:
   - Does **not** change `assembleDashboardSnapshot` / `assembleReportRun` math, soft-omit, or cohort thresholds
   - Does **not** replace GovernedDataTable as report result SoT
   - Does **not** invent Epic 10 settings, new report catalogue keys, or BI SaaS
   - Does **not** silently close unpaid carry-ins (PopulationPort, mutation IDOR, AD-6, Vitest, Settings, …)
   - Does **not** introduce Playwright / Vitest solely for this story (AST/token selfcheck + gallery/manual light+dark)

## Tasks / Subtasks

- [x] Task 1: Wire DESIGN chart tokens into the app theme (AC: #1, #2)
  - [x] UPDATE `apps/web/app/globals.css`: add `--chart-categorical-1…5` (light), dark theme counterparts, `--chart-sequential-1…7`, `--chart-gridline` / dark — **exact** hex from DESIGN (series-2 cyan `#087A90`, not `#0B8FA8`)
  - [x] Expose Tailwind theme aliases if the repo pattern uses `@theme` / `--color-chart-*` (match existing hairline/surface pattern)
  - [x] NEW thin helper e.g. `apps/web/lib/chart-tokens.ts` exporting ordered series arrays + forbidden-color set for components **and** selfchecks (single SoT with CSS)
  - [x] UPDATE `a11y-floor.selfcheck.ts` to assert against the helper/CSS SoT (keep AA; do not regress 8.10-A1)

- [x] Task 2: Shared chart chrome primitive (AC: #2–#5, #7)
  - [x] NEW `apps/web/components/charts/` (name flexible): e.g. `chart-frame.tsx` + `categorical-line-chart.tsx` / `categorical-bar-chart.tsx` (only what dashboard + reports need)
  - [x] Contract: theme-aware series colors; legend above plot; caption axis; tabular values; Persian digits; empty / suppressed / pending slots via FeedbackMessage (or shared chart empty state)
  - [x] Series not color-only: legend labels + optional stroke dash / marker shape for ≥2 series
  - [x] **Library policy:** default = thin SVG (no new dependency). If adding Recharts: document React 19 + `react-is` pnpm override in Completion Notes; still route all colors through chart tokens — never library defaults
  - [x] NEW optional gallery section on `/dev/gallery` proving light+dark categorical + sequential swatches + one sample chart (mirrors `chart-palettes.html`)

- [x] Task 3: Dashboard metric visual quality (AC: #5–#8)
  - [x] UPDATE `dashboard-metric-card.tsx`: adopt `Panel` / hairline posture (drop bordered-card spam); FeedbackMessage for suppress/empty/error/pending; show lastCalc when provided; keep reconcile + leave-guard; preserve omit-on-`omitted`
  - [x] UPDATE `dashboard-panel.tsx`: pass `lastCalculatedAt` into cards; replace raw alert/status `<p>` with FeedbackMessage; render real chart for `workforce_trend` (and preferably `starts_terminations` dual-series) using shared chrome + existing `trend` buckets — retire text-only trend list as the primary viz (caption details may remain secondary)
  - [x] Preserve UX-DR15 grid (2 cols @1280; 3/4 at wider breakpoints), `keepPreviousData`, filter sync
  - [x] Do **not** touch `dashboard-snapshot.ts` outcomes/math except if a presentation-only DTO field is already present and unused

- [x] Task 4: Report workspace chart companion (AC: #3–#5, #7–#9)
  - [x] UPDATE `report-workspace.tsx`: when run result is `allowed` and rows admit a categorical distribution (document the heuristic — e.g. known distribution keys / numeric columns already returned), render shared chart **above** GovernedDataTable using the same chrome; suppressed cells/cohorts use suppress copy never zero
  - [x] If no safe distribution shape exists for a report key, skip chart honestly — do **not** invent fake series from unrelated columns
  - [x] Preserve URL/`run=1`/FeedbackMessage/export/publication contracts from 9.5; do not re-litigate IA
  - [x] Keep `reports-ia` + no-dead-end green

- [x] Task 5: Design-QA / DoD / honesty (AC: #8–#9)
  - [x] NEW `selfcheck:chart-visual` (or extend a11y-floor + layout probes): token SoT present; forbidden gold/status hex absent from chart module; dashboard + reports import shared chrome; metric card uses Panel/`data-slot="panel"` posture; suppress string exact
  - [x] Wire into `package.json` + `design-qa.selfcheck.ts` `REQUIRED_SCRIPTS` if new script
  - [x] UPDATE `design-qa-mockup-matrix.md`: Dashboard + Reports notes record chart consumer chrome; Chart palettes remain `fixed`/`pass` with honesty that runtime consumers landed in 9.10
  - [x] Manual DoD: light **and** dark; 1280×720 + 1920×1080; suppressed never 0; legend not color-only; lastCalc visible; `selfcheck:design-qa` green; `@divan/web` typecheck
  - [x] Completion Notes: CI honesty (design-qa = CI surrogate); library choice; what report keys got charts vs skipped

### Review Findings

- [x] [Review][Decision] Text details vs chart-only for dashboard metrics — resolved: restore `starts`/`terminations` captions as secondary; keep `workforce_trend` chart-primary (no full bucket text list).
- [x] [Review][Decision] Keyboard/touch access to chart values — deferred: mouse-only tooltips kept; captions + GDT remain non-pointer value path. See deferred-work.
- [x] [Review][Decision] RTL axis layout — resolved: keep LTR SVG plot coordinates intentional for thin chart chrome.

- [x] [Review][Patch] Axis/tooltip typography misses AC #3 `text-caption` / `text-tabular` [`apps/web/components/charts/categorical-line-chart.tsx`] [`apps/web/components/charts/categorical-bar-chart.tsx`] [`apps/web/components/charts/chart-frame.tsx`]
- [x] [Review][Patch] Single-series bar uses per-category colors while legend shows one swatch [`apps/web/components/charts/categorical-bar-chart.tsx`]
- [x] [Review][Patch] ChartFrame empty/error defaults use dashboard copy [`apps/web/components/charts/chart-frame.tsx`]
- [x] [Review][Patch] Selfcheck does not assert full token↔CSS hex parity [`apps/web/lib/chart-visual.selfcheck.ts`]
- [x] [Review][Patch] Design-QA matrix understates report chart heuristic [`apps/web/lib/design-qa-mockup-matrix.md`]
- [x] [Review][Patch] No category/bucket cap — dense distributions overflow fixed viewBox [`apps/web/components/charts/categorical-bar-chart.tsx`]
- [x] [Review][Patch] Non-finite / non-number count coercion [`apps/web/components/charts/report-chart-distribution.ts`] [`apps/web/components/dashboard/dashboard-panel.tsx`]
- [x] [Review][Patch] Duplicate category labels not aggregated [`apps/web/components/charts/report-chart-distribution.ts`]
- [x] [Review][Patch] Duplicate `aria-label` on `<figure>` and nested `<svg role="img">` [`apps/web/components/charts/*`]
- [x] [Review][Patch] Zero values still draw a 1px filled bar [`apps/web/components/charts/categorical-bar-chart.tsx`]
- [x] [Review][Patch] Empty-string `lastCalculatedAt` still renders caption [`apps/web/components/dashboard/dashboard-metric-card.tsx`]
- [x] [Review][Patch] Fragile React keys on legend / line X ticks [`apps/web/components/charts/chart-frame.tsx`] [`apps/web/components/charts/categorical-line-chart.tsx`]

- [x] [Review][Defer] Sequential palette has no dark-theme override [`apps/web/app/globals.css`] — deferred, pre-existing-scope (AC #1 does not require dark sequential)
- [x] [Review][Defer] Negative series values invert outside plot scale [`apps/web/components/charts/categorical-bar-chart.tsx`] — deferred, pre-existing (current dashboard SoT starts/terminations are non-negative); clamp-to-zero applied for render safety

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| DESIGN `chart.*` exact hex (incl. `#087A90`) | Invent a second palette / regress to `#0B8FA8` |
| Shared chrome used by dashboard **and** reports | Duplicate chart styling per surface |
| Panel 8.2 for metric cards | Bordered card / shadcn Card spam |
| FeedbackMessage on rewritten chrome | Raw `<p role=alert\|status>` / StatusMessage clones |
| suppress ≠ empty ≠ zero | Render suppressed as `0` or empty-search copy |
| `selfcheck:design-qa` green | Claim Playwright CI / Settings / domain freezes done |
| Presentation/visual only | Change assemble math, catalogue keys, permissions |

### Current state → change → preserve (UPDATE files)

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `globals.css` | No `--chart-*` | Add chart CSS vars light+dark | Existing neutrals, status badges, banners, 8.10 nudges |
| `a11y-floor.selfcheck.ts` | Hardcoded categorical AA | Align to token SoT; keep AA | Banner/status/CTA asserts |
| `dashboard-metric-card.tsx` | Bordered `article`; raw status `<p>`; no lastCalc prop | Panel posture; FeedbackMessage; lastCalc; optional chart slot | Outcomes enum; suppress copy; reconcile+leave-guard; omit |
| `dashboard-panel.tsx` | Text trend lines; raw alerts; footer lastCalc only | Shared chart for trend; FeedbackMessage; pass lastCalc to cards | Filter sync; snapshot query; grid breakpoints; `keepPreviousData` |
| `dashboard-filters.tsx` | EntityPicker filters | Touch only if feedback polish needed | Filter semantics |
| `report-workspace.tsx` | Table-only result | Optional chart companion via shared chrome | Rail/params/run/meta/GDT/export/FeedbackMessage/URL |
| `dashboard-snapshot.ts` / `report-run.ts` | Domain SoT | **No math changes** | Outcomes, soft-omit, reconcileHref |
| `design-qa-mockup-matrix.md` | Charts → 9.10 note | Consumer landed notes | Settings amendment; unrelated rows |
| `design-qa.selfcheck.ts` | REQUIRED_SCRIPTS thru no-dead-end | Append chart-visual if added | spawnSync shell:true pattern |

### Architecture compliance

- Dashboard & reports capability → `@divan/reporting` (AD-2, AD-5); UI in `apps/web` only.
- No Prisma in web; no parallel metric SoT tables.
- Authz / InferenceBulk / suppress oracles remain domain — UI only renders outcomes honestly.
- Persian RTL / Jalali / tabular digits unchanged (FR-43).
- Deferred: saved personal filters; interactive org chart / advanced analytics (PRD non-goals).

### Library / framework requirements

| Choice | Guidance |
| --- | --- |
| **Preferred** | Thin shared SVG chart components; CSS variables for series; no new dependency |
| **If Recharts** | React is `^19.1.0` — Recharts 2.15.x needs matching `react-is` + root `pnpm.overrides`; theme via explicit props from chart tokens (no default light theme); ResponsiveContainer; custom Tooltip |
| **Forbidden** | Chart SaaS, AG Grid charts, second design-system chart kit, inventing green/orange series “because it looks nice” |

### File structure requirements

- Shared viz: `apps/web/components/charts/*` (or `components/viz/*`) — **one** package path imported by dashboard + reports.
- Tokens: `globals.css` + optional `lib/chart-tokens.ts`.
- Selfcheck: `apps/web/lib/chart-visual.selfcheck.ts` (name flexible) wired like other Epic 9 gates.
- Do not put chart React under `packages/modules/reporting` (domain stays data-only).

### Testing requirements

| Check | Command / method |
| --- | --- |
| Design-QA | `pnpm --filter @divan/web selfcheck:design-qa` |
| A11y / tokens | `selfcheck:a11y-floor` (+ new chart-visual) |
| Dashboard domain | existing `@divan/reporting` / web `selfcheck:dashboard` — suppress≠empty≠zero must stay green |
| Reports IA | `selfcheck:reports-ia` / no-dead-end |
| Manual | Light+dark; CVD sanity at real stroke width; suppressed never 0; lastCalc; gallery |

### Previous story intelligence

**From 9.9 (`b9760ae`, done):** Tooling-heavy gate locked; `selfcheck:no-dead-end-ia` in REQUIRED_SCRIPTS; CI = design-qa surrogate; explicit downstream left **9.10** chart work unclaimed. Do not regress placeholder ban or UX-DR3.

**From 9.5 (`168d7d9`, done):** Report workspace IA complete; matrix note «charts → 9.10»; FeedbackMessage already on workspace — extend, don't fork. Keep subject URL + `run=1` + GDT.

**From 9.1 gate (all Epic 9):** First-touch FeedbackMessage / Panel; matrix honesty; presentation only; BOM-safe YAML; AR-\* fail-closed.

**From 5.4 / Epic 5 retro:** `suppress ≠ empty ≠ zero` is law; lastCalc visible on empty/suppress paths; dual-package selfcheck habit; **no BI suite**.

**From Epic 8 retro / sprint actions (still open — acknowledge):** FeedbackMessage adoption on panels **touched** this story (dashboard is a target — partially closable); typography hotspots only on files touched; do not claim batched DTOs / Button forwardRef / Epic 7 security items done.

### Git intelligence summary

Recent commits: `b9760ae` 9.9 → `fe4ea92` 9.8 → `967ca65` 9.7 → `d6e6814` 9.6 → `168d7d9` 9.5. Pattern: one commit per story; thin web presentation; design-qa REQUIRED_SCRIPTS append; sprint-status + story Status flip together; no domain churn. 9.10 should be **visual/token-heavy**, domain-light.

### Latest tech information

- App: Next `16.2.10`, React `^19.1.0`, Tailwind v4 CSS-first tokens in `globals.css`.
- **No chart library in repo today** — introducing Recharts pulls React 19 `react-is` override debt; thin SVG avoids it and matches 5.4 “simple trend OK”.
- Recharts theming has no built-in dark mode — all strokes/fills/ticks must be props from CSS variables (same requirement as a custom SVG layer).
- Prefer `getComputedStyle` / exported token arrays in selfchecks over brittle screenshot gates.

### Project context reference

- No `project-context.md` found in repo at create time; follow Epic 9 story conventions above + ARCHITECTURE-SPINE AD-2/AD-5/AD-6 (no Prisma in web; reporting module owns FR35–36 data).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 9.10; UX-DR40]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — §9.10 / UX-DR40]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — chart tokens + chart component + Data color]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — color-alone ban; report flow; suppress copy]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/chart-palettes.html`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/screens-reports-capacity.html`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-35, FR-36, FR-48, FR-58]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — reporting capability]
- [Source: `_bmad-output/implementation-artifacts/9-5-reports-section-tabs-workspace.md`]
- [Source: `_bmad-output/implementation-artifacts/9-9-no-dead-end-ia-gate.md`]
- [Source: `_bmad-output/implementation-artifacts/5-4-core-launch-dashboard.md`]
- [Source: `apps/web/components/layout/panel-section.tsx`]
- [Source: `apps/web/lib/design-qa-mockup-matrix.md`]
- [Source: `apps/web/lib/a11y-floor.selfcheck.ts`]
- [Source: `apps/web/lib/operational-copy.ts` — `suppressedCohort`, `figureRecalculating`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- `pnpm --filter @divan/web selfcheck:design-qa` → ok (includes new `selfcheck:chart-visual`)
- `pnpm --filter @divan/web exec tsc --noEmit` → ok
- `selfcheck:dashboard` / `selfcheck:reports-ia` / `selfcheck:a11y-floor` → ok

### Completion Notes List

- Wired DESIGN `chart.*` into `globals.css` + `@theme` `--color-chart-*`; SoT helper `lib/chart-tokens.ts` (series-2 `#087A90`); a11y-floor asserts against helper.
- Shared thin SVG chrome under `components/charts/` (no Recharts / no new dependency): `ChartFrame` + line + bar; legend above plot; navy tooltip chip; dash/marker non-color cues; FeedbackMessage empty/suppress/pending.
- Dashboard: Panel/hairline metric cards; FeedbackMessage replaces raw alert/status `<p>`; lastCalc on cards + footer; `workforce_trend` line chart + `starts_terminations` bar chart; domain snapshot untouched.
- Reports: chart companion only when `extractReportCategoricalDistribution` finds a safe shape — **charts for** `distributions` + `org_state` (+ generic count+label without list ids); **skipped** for person/event list keys (e.g. `active_persons`, `starts`, `overrides`). GDT remains SoT.
- `selfcheck:chart-visual` added to package.json + design-qa REQUIRED_SCRIPTS; matrix notes updated for Dashboard / Reports / Chart palettes consumers.
- CI honesty: design-qa remains the CI surrogate (no Playwright added). Gallery `/dev/gallery` shows categorical + sequential swatches + sample charts.

### File List

- `apps/web/app/globals.css`
- `apps/web/lib/chart-tokens.ts`
- `apps/web/lib/a11y-floor.selfcheck.ts`
- `apps/web/lib/chart-visual.selfcheck.ts`
- `apps/web/lib/design-qa.selfcheck.ts`
- `apps/web/lib/design-qa-mockup-matrix.md`
- `apps/web/package.json`
- `apps/web/components/charts/index.ts`
- `apps/web/components/charts/chart-frame.tsx`
- `apps/web/components/charts/categorical-line-chart.tsx`
- `apps/web/components/charts/categorical-bar-chart.tsx`
- `apps/web/components/charts/report-chart-distribution.ts`
- `apps/web/components/dashboard/dashboard-metric-card.tsx`
- `apps/web/components/dashboard/dashboard-panel.tsx`
- `apps/web/components/reports/report-workspace.tsx`
- `apps/web/app/(app)/dev/gallery/page.tsx`
- `_bmad-output/implementation-artifacts/9-10-dashboard-report-visual-quality.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-08-03: Story 9.10 — chart tokens, shared SVG chrome, dashboard/report visual quality, chart-visual selfcheck; status → review.
- 2026-08-03: Code review patches applied (typography, bar series color, ChartFrame copy, token↔CSS parity, matrix honesty, bucket cap, count coercion, aggregation, a11y aria, zero bars, lastCalc empty guard, React keys); decisions resolved; status → done.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
)
