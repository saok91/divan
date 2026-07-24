---
baseline_commit: 06537f9
---

# Story 5.5: Launch Report Catalogue

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a scoped reporting user,
I want to run the approved launch report catalogue with Jalali dates and export affordance,
so that operational and historical questions use consistent metrics (FR36).

**Story key:** `5-5-launch-report-catalogue`  
**Epic:** 5 — Search, Profiles, Dashboard & Reports (FR33–36)  
**Prerequisite:** Stories 5.1–5.4 done. Channel `"report"` already reserved end-to-end (Story 2.6/2.7). `/reports` nav + placeholder live (`hr_operator` / `hr_admin` / `manager`). `@divan/reporting` owns dashboard aggregations (5.4) — this story **extends** that package for catalogue run/view. Epic 4 projections + event-store + headcount ledger available as read models.

## Acceptance Criteria

1. **Given** گزارش‌ها access (coarse nav already allows `hr_operator` / `hr_admin` / `manager`)  
   **When** the actor opens `/reports`  
   **Then** the placeholder is replaced by a launch report catalogue that lists every **required** FR-36 report scenario (hardcoded catalogue; AR-REPORTING-pluggable shape) and lets the actor select and **run/view** one at a time

2. **And** synchronized organization and time/as-of filters apply to the selected report run (same filter-sync intent as dashboard UX-DR15): changing org/time refreshes the active report result under permission-safe **current / as-of** semantics (`allowClientTemporal` + shared filter state)

3. **And** the launch catalogue covers (FR-36 consequences — keys must not silently disappear without explicit PRD change):
   - `active_persons` — active Persons
   - `all_persons` — all Persons including ended Employments
   - `org_state` — current organization state
   - `team_membership_manager` — Team membership and inferred middle manager (UJ-3 exemplar «اعضای هر تیم»)
   - `distributions` — by Organizational Role, Job Title, Ladder/Grade, Seniority, and collaboration/contract type
   - `starts` — starts (Effective-Date temporal measures)
   - `terminations` — terminations
   - `transfers` — Team transfers
   - `role_grade_compensation_changes` — Organizational Role, Grade, and compensation changes
   - `headcount_approvals_capacity` — Headcount Approvals and used/free capacity
   - `overrides` — headcount Overrides
   - `scheduled` — Scheduled events
   - `corrected_cancelled_reversed` — Corrected / Cancelled / Reversed events
   - `import_batch_outcomes` — Import Batch outcomes/errors (**stub until Epic 6** — see Gate)

4. **And** temporal measures calculate from **Effective Date**; Jalali dates display unambiguously (`JalaliDatePicker` + Persian digit cells); last calculation/update time is exposed when derived/as-of state is used

5. **And** suppressed cohorts show exactly «داده قابل نمایش نیست» in report **table cells / banners** — **never** render as `0` (`operationalCopy.suppressedCohort` — UX explicitly shares this copy across داشبورد and گزارش‌ها)

6. **And** empty scoped report results show a dedicated empty-report string (add `operationalCopy.emptyReportScope` = same Persian text as dashboard empty scope is acceptable if product wants literal reuse of «در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.» — **never** reuse `emptySearch` or `suppressedCohort` for empty)

7. **And** every report retrieval uses channel **`report`**: authorize → PopulationPort intersect → InferenceBulk → access event → payload (same plane as 5.1/5.4; FR-47 / FR-48) — **do not invent a new channel**

8. **And** report rows reconcile with list / profile / headcount / org / event surfaces under the same date, filters, scope, and metric definition (FR-25 / FR-27 / UJ-3) — deep-link to existing surfaces; **no** parallel SoT tables or client-only “safe” aggregates of unscoped dumps

9. **And** metric/report definitions remain AR-REPORTING-pluggable with launch-required keys hardcoded via `requireLaunchReportCatalogue()` (parallel to 5.4 `requireLaunchMetricCatalogue`) — Product/HR may refine formulas later; **cannot** remove required launch reports from scope without explicit PRD change

10. **And** this story delivers **run/view** only: export affordance may be present but **disabled** or routes to a stub until Story **6.5** (FR-41 / FR-52 / UX-DR17 `export-artifact-panel`). Sprint planning **MUST NOT** treat full export UX as done when only 5.5 is complete

11. **And** PopulationPort honesty preserved: fixture registry must not be labeled as production workforce authz; fail-closed / disclosure posture from 5.1 continues on every report payload

12. **And** NFR-2 provisional: common report run ≤5s for nominal envelope (~500 people) — document budget (no report-specific NFR exists; reuse dashboard provisional); do not invent AR-NFR percentiles

## Tasks / Subtasks

- [x] Task 1: Report catalogue registry + assemblers in `@divan/reporting` (AC: #1, #3–#4, #7–#9, #11)
  - [x] NEW `packages/modules/reporting/src/report-catalogue.ts` — `LAUNCH_REQUIRED_REPORT_KEYS` + `LAUNCH_REPORT_DEFINITIONS` + `requireLaunchReportCatalogue()` mirroring `metric-catalogue.ts` (Persian titles; no invented 30/60/90 / cohort thresholds)
  - [x] NEW assemblers (compose **published** APIs only — AD-3), prefer one `assembleReportRun({ reportKey, filter, authorizedSubjectIds, caps, ... })` or thin per-key helpers behind a single entry:
    - Persons / org / team / distributions → `@divan/person-employment` current + historical + management derivation (`deriveManagementEdgesAsOf` / `resolveTeamManagerAsOf` / `listManagedPersonsAsOf` as published)
    - Starts / terminations / transfers / role-grade-compensation → event-store after population ∩ InferenceBulk; **reuse** `aggregateStartsTerminations` / trend helpers where Effective-only is correct
    - **NEW** status-filtered event helpers for `scheduled` and `corrected_cancelled_reversed` — do **not** stretch `isCountableEffective` to include these; dashboard helpers deliberately exclude them
    - Headcount approvals/capacity / Overrides → `@divan/headcount` + `assertHeadcountConservation`; as-of must use historical ledger (4.11) — **never** mix live free into as-of (5.4 review pitfall)
    - `import_batch_outcomes` → **honest stub**: catalogue entry present; run returns `outcome: "unavailable"` (or equivalent) with Persian copy that Import Batch reporting activates after Epic 6 — **no fake empty success** pretending migration data exists (`packages/modules/migration` is still an empty stub)
  - [x] Surface `lastCalculatedAt` when derived projections used; fail-closed on recalc pending/failed (reuse MSG_HIST_ORG_RECALC_* patterns from 5.4)
  - [x] Prefer apply-path event load with range (not UI list cap 200); handle `EVENT_APPLY_LOAD_LIMIT` / truncation honestly if hit
  - [x] UPDATE `packages/modules/reporting/src/index.ts` — export report catalogue + assemblers **alongside** dashboard exports (do not remove 5.4 surface)

- [x] Task 2: Governed tRPC `report` router (AC: #2, #7, #10–#12)
  - [x] NEW `apps/web/src/server/report.ts` (sibling of `dashboard.ts`):
    - Reuse / share filter Zod shape with dashboard where practical (`teamId`, `evaluationMode`, `asOfDate`, range fields as needed per report) — reject `as_of` without `asOfDate`
    - `governedProcedure.meta({ permission, dataCategory, action, organizationalScope, operation, sensitive, allowClientTemporal: true })`
    - Pipeline: soft-permission probes (do **not** swallow infra errors) → `resolvePersonnelPopulationRegistry()` → `runGovernedRetrieval({ channel: "report", ... })` → branch `allowed|empty|suppressed` → assembler
    - `mapReportError` — never leak `error.message`; never map unknown/infra to access-denied copy
  - [x] Mount on `appRouter` as `report: reportRouter` in `apps/web/src/server/root.ts`
  - [x] Soft-omit report keys that need permissions the actor lacks (e.g. compensation-change rows needing compensation read) — omit from catalogue DOM or mark unavailable; no disabled theater revealing forbidden fields
  - [x] Persian fail-closed errors; PopulationPort mode + `disclosureFa` on every payload

- [x] Task 3: `/reports` UI — catalogue + result table (AC: #1–#6, #8, #10)
  - [x] UPDATE `apps/web/app/(app)/reports/page.tsx` — replace `PlaceholderPage` with host panel (Server Component wrapping client panel OK)
  - [x] NEW under `apps/web/components/reports/`:
    - `report-catalogue-panel.tsx` — catalogue list/select + shared filters + result host + last calculation time
    - `report-filters.tsx` — org + time/as-of (+ range when report needs it); reuse `JalaliDatePicker` patterns from `dashboard-filters.tsx` (disable pickers while fetching; surface filter validation)
    - Result view using **`GovernedDataTable`** (UX-DR7) — **DO NOT** modify its public contract; column builders with `permitted`, Persian-digit `cell`s, sticky identifier; pattern-copy from `personnel-list-panel.tsx`
  - [x] `exportSlot`: disabled button or stub control with Persian hint that governed export lands in 6.5 — match `fixture-demo.tsx` / GovernedDataTable `exportSlot` styling; **no** `export-artifact-panel`
  - [x] Copy: add `emptyReportScope`, `reportLoadError`, `reportFilterInvalid`, optional `reportImportBatchUnavailable` (Import Batch stub); reuse `suppressedCohort` exactly; reuse `clearFilters`
  - [x] No dedicated UX mockup exists (`key-reports.html` missing) — compose dashboard filter conventions + GovernedDataTable + UX-DR22 state copy; do not invent a second design system
  - [x] `/reports` stays a **flat** surface (no `SECTION_TAB_SURFACES` entry required unless a proven UX need appears — default: single page catalogue, not section tabs)
  - [x] Reconciliation links via `requestNavigation` when leave-guard could apply; reuse existing destinations (`/personnel/list`, `/organization/...`, `/headcount/...`, `/personnel-events/events`) — do not invent new detail routes. Full shared query-preset deep-links remain partially deferred from 5.4; pass what target surfaces already accept (e.g. `teamId`) and document gaps honestly

- [x] Task 4: Authz / nav integrity (AC: #7)
  - [x] **Do not** edit `packages/modules/identity-access/src/navigation.ts` ROLE_NAV / ROLE_LANDING unless a proven bug blocks `/reports`
  - [x] Deep-link deny remains `resolve-app-path-access` + «دسترسی ندارید.»
  - [x] Page data loaders: remember layout≠RSC — call `assertPageAccess` (or equivalent) before any report data fetch in the page tree if RSC loaders are added
  - [x] Unauthorized reports/actions: omit from DOM

- [x] Task 5: Verify + DoD (AC: #1–#12)
  - [x] NEW selfcheck(s) in `@divan/reporting` and/or `@divan/web`: catalogue completeness (`requireLaunchReportCatalogue`); suppress ≠ empty ≠ zero; status-filter helpers (Scheduled / Cancelled etc. not counted as Effective starts); Import Batch stub honesty; filter Zod identity
  - [x] Wire scripts (`selfcheck:report-catalogue` dual-package like `selfcheck:dashboard`)
  - [x] Regression: `selfcheck:dashboard`, personnel-search, inference-bulk as touched
  - [x] `pnpm --filter @divan/web` typecheck + eslint on touched files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows

### Manual DoD checklist

- [x] `/reports` shows real catalogue (not PlaceholderPage)
- [x] Every launch-required key appears in catalogue UI (including Import Batch as stub/unavailable — not silently missing)
- [x] Changing org or as-of filter refreshes the **active** report run
- [x] Suppress path → «داده قابل نمایش نیست» in cells/banners (never 0)
- [x] Empty scoped filter → empty-report copy (not emptySearch / not suppress)
- [x] Jalali filters + Persian digits in numeric/date cells
- [x] Last calculation time visible when derived/as-of used
- [x] UJ-3: dashboard → report «اعضای هر تیم» (or team membership key) reconciles same scope/date intent with list
- [x] Export control disabled/stub — **no** download / artifact panel
- [x] Channel `report` access events present for runs (ops/selfcheck or manual envelope check)
- [x] PopulationPort fixture honesty still disclosed / fail-closed
- [x] No Prisma in `apps/web`; no parallel report SoT tables
- [x] Labels stay گزارش‌ها / داشبورد / اطلاعات پرسنلی — no Epic 1 «پرسنل» regression
- [x] Sprint status / story file must **not** claim FR-41 export done

### Review Findings

- [x] [Review][Decision] فیلتر teamId — تقاطع population با اعضای تیم as-of برای کلیدهای فرد/رویداد/distributions (اعمال شد)
- [x] [Review][Decision] بازه Effective-Date — فقط برای کلیدهای رویدادی اجباری؛ snapshot اختیاری (اعمال شد)

- [x] [Review][Patch] گزارش Overrides در as-of fail-closed / unavailable [\packages/modules/reporting/src/report-run.ts\]
- [x] [Review][Patch] headcount_approvals_capacity در as-of فقط جمع تاریخی؛ detail زنده فقط در current [\packages/modules/reporting/src/report-run.ts\]
- [x] [Review][Patch] loadEventsForSubjects با toEffectiveDate در apply load [\packages/kernel/event-store\ + eport-run.ts\]
- [x] [Review][Patch] truncation استثناها در limit=500 [\packages/modules/reporting/src/report-run.ts\]
- [x] [Review][Patch] نمایش messageFa برای outcomeی allowed [\pps/web/components/reports/report-catalogue-panel.tsx\]
- [x] [Review][Patch] حذف UTF-8 BOM از sprint-status.yaml
- [x] [Review][Patch] trim روی asOfDate [\pps/web/src/server/report.ts\]
- [x] [Review][Patch] پیام کاتالوگ خالی [\pps/web/components/reports/report-catalogue-panel.tsx\]
- [x] [Review][Patch] lastCalculatedAt برای pending/error/omitted [\pps/web/components/reports/report-catalogue-panel.tsx\]
- [x] [Review][Patch] اعتبارسنجی UUID تیم و ترتیب بازه در کلاینت [\pps/web/components/reports/report-filters.tsx\]
- [x] [Review][Patch] assert برابری کپی Import Batch [\pps/web/src/server/report.selfcheck.ts\]
- [x] [Review][Patch] selfcheck مسیرهای as-of overrides / range / truncation [\packages/modules/reporting/src/report.selfcheck.ts\]
- [x] [Review][Patch] scheduled: خلاصه در messageFa، جدول فقط detail [\packages/modules/reporting/src/report-run.ts\]
- [x] [Review][Patch] distributions resolve برچسب nameFa [\packages/modules/reporting/src/report-run.ts\]
- [x] [Review][Patch] کاتالوگ با radiogroup به‌جای listbox جعلی [\pps/web/components/reports/report-catalogue-panel.tsx\]

- [x] [Review][Defer] Deep-link رویداد بدون شناسه/query preset — deferred, pre-existing
- [x] [Review][Defer] org_state/capacity بدون تقاطع subjectIds — deferred, pre-existing
- [x] [Review][Defer] بارگذاری سریالی N+1 روی subjects — deferred, pre-existing

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Fill `/reports` in place (nav already correct) | Rebuild nav/landing matrix or new reports route |
| Own aggregations in `@divan/reporting` + governed tRPC | Dump unscoped SQL into `apps/web` or invent parallel SoT |
| Channel `report` via `runGovernedRetrieval` / InferenceBulk | Invent a new channel or client-only filter of full workforce as “safe” |
| Hardcoded launch-required report keys + `requireLaunchReportCatalogue` | Invent AR-REPORTING freeze numbers or silently drop FR-36 scenarios |
| Reuse GovernedDataTable + dashboard filter conventions | Fork table primitive or AG Grid / BI suite |
| Suppress ≠ empty ≠ zero (exact Persian strings) | Render suppressed as `0` or reuse emptySearch for suppress |
| Stub export + stub Import Batch outcomes honestly | Ship governed download (6.5) or fake Import Batch data (Epic 6) |
| As-of HC via historical ledger (4.11) | Mix live free / wall-clock expiry into as-of reports |
| PopulationPort honesty (fixture ≠ production) | Claim cutover without `population-cutover.ts` criteria |
| Persian digits + Jalali filters | Latin digit metrics / Gregorian-only picker for actors |

### Absolute non-goals

- Governed file export / artifact panel / reauth / FR-41 / FR-52 → **6.5**
- Import Batch **real** outcomes data plane → **Epic 6** (6.1–6.4); 5.5 only keeps the catalogue slot + honest unavailable state
- PopulationPort **full** default-registry cutover; AD-6 Prisma vs PoolClient; `ensure*Schema` migrations-only; Vitest mandate
- Logout → `requestNavigation` leave-guard (Epic 4b open) — document exemption if untouched
- Dedupe Add vs QuickCreate forms (Epic 4b open)
- Full shared deep-link query presets on list/event routes (deferred from 5.4) — extend only where targets already accept params
- Interactive BI charts / new chart libraries
- Inventing AR-REPORTING production freeze values
- Editing `navigation.ts` ROLE matrices “for cleanliness”
- Modifying `GovernedDataTable` public contract

### Report consumer contract (encode — do not rediscover)

1. **Retrieval:** `runGovernedRetrieval({ channel: "report", ... })` — channel already in `RetrievalChannel`, `INFERENCE_CHANNELS`, `retrievalChannelSchema`. Zero new control-plane work.
2. **Population:** `resolvePersonnelPopulationRegistry()` from 5.1 — same honesty fields on report DTOs as dashboard.
3. **Counts / capacity as-of:** `getHistoricalOrgHeadcountState` / org historical semantics (4.11). Live capacity ≠ historical asOf.
4. **Active / all Persons:** PopulationPort-intersected ids + employment active vs all-including-ended semantics (FR-36).
5. **Team membership / manager:** published management derivation APIs — UJ-3 exemplar report.
6. **Event reports:** Effective-Date for temporal measures; separate status filters for Scheduled and Corrected/Cancelled/Reversed — **do not** reuse Effective-only dashboard counters for those catalogue keys.
7. **Reconciliation:** deep-link to 5.1 list / headcount / org / events with shared filter intent; FR-25 same date/scope/definition.
8. **No parallel SoT:** no `report_results` SoT table; no Prisma in web; no second InferenceBulk stack inside reporting.
9. **Export:** `exportSlot` disabled/stub only; artifact panel is 6.5.

### Suppress / empty / zero oracle (must ship)

| Outcome | UI | Volume |
| --- | --- | --- |
| `suppressed` | «داده قابل نمایش نیست» | never show numeric 0 |
| `empty` | empty-report scope copy (see AC #6) | true empty scope |
| `allowed` | Persian digits tabular cells / rows | real data |
| `unavailable` (Import Batch stub) | dedicated Persian unavailable copy | not empty success |

### Import Batch stub decision (explicit)

`packages/modules/migration/src/index.ts` is an empty stub; Epic 6 is entirely `backlog`. FR-36 still requires the catalogue **slot**. Implementation rule:

- Keep `import_batch_outcomes` in `LAUNCH_REQUIRED_REPORT_KEYS`
- Running it returns a non-success, non-empty-fake outcome with Persian explanation that data lands with Epic 6
- Selfcheck asserts the key exists and stub path does not claim zero errors as “all green”

### Live vs historical pitfall (carry from 5.4 review)

`readHeadcountCapacityPanel` / live capacity APIs are **finalize-current**. Report as-of mode **must** use historical ledger reconstruction (4.11). Mixing live free into an as-of headcount/Overrides report is a reconciliation bug.

### Effective vs Scheduled vs Corrected (carry from 5.4 review)

`workforce-events.ts` `isCountableEffective` correctly excludes Scheduled/Draft/Cancelled/Reversed from **starts/terminations totals**. Story 5.5 **needs those statuses as first-class reports** — add new helpers (e.g. `filterEventsByStatus` / `aggregateEventsByTypeAndStatus`) rather than weakening Effective-only helpers.

### UPDATE files — current state → change → preserve

| Path | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `apps/web/app/(app)/reports/page.tsx` | `PlaceholderPage` عنوان گزارش‌ها | Real catalogue + run/view host | Route `/reports`; Persian title گزارش‌ها |
| `apps/web/lib/operational-copy.ts` | Has suppress + emptyDashboardScope + dashboard errors | Add report empty/load/filter (+ Import Batch unavailable) keys | Existing exact strings (deny, emptySearch, suppress, dashboard) |
| `packages/modules/reporting/src/index.ts` | Dashboard-only exports (5.4) | Export report catalogue + assemblers | Keep all dashboard exports; InferenceBulk reminder |
| `apps/web/src/server/root.ts` | `dashboard: dashboardRouter` mounted | Mount `report: reportRouter` | Existing routers unchanged |
| `packages/modules/reporting/src/workforce-events.ts` | Effective-only starts/terms/trend | Extend with **new** status-aware helpers (or sibling file) | Do not break Effective-only dashboard semantics |
| `navigation.ts` | `/reports` for operator/admin/manager | **No change** expected | ROLE_NAV / ROLE_LANDING / canAccessPath |
| `GovernedDataTable` | Frozen UX-DR7 contract | Consume via `exportSlot` + columns | Public props/types/behavior |

### Previous story intelligence (5.4 → 5.5)

From `5-4-core-launch-dashboard.md` completion + review (2026-07-25):

- Pattern: **replace stubs in place**; domain math in `@divan/reporting`; thin governed tRPC; suppress≠empty≠zero; dual-package selfcheck scripts.
- `assembleDashboardSnapshot` + `dashboardFilterSchema` + soft permission probes + `mapDashboardError` are the **templates** for report run.
- Review patches to carry: Effective vs Finalized; apply-path event load; as-of open HC purity; reject `as_of` without date; soft probes must not swallow infra; unknown errors ≠ access-denied; disable Jalali while fetching.
- Deferred still open: N+1 employment lists under NFR-2 envelope; full reconcile query presets on list/events; team-capacity interactive sort — document, do not silently “fix” unless touching the same path.
- Absolute non-goal of 5.4 was this story — `/reports` was reserved.

From 5.1–5.3 (systemic Epic 5 rules):

- Pipeline: authorize → PopulationPort → InferenceBulk → access event → payload
- Fixture PopulationPort → fail-closed empty + disclosure
- Person-org IDOR scope on every aggregate
- Layout≠RSC gate for any page-level data loaders

### Git intelligence (recent)

- `06537f9` story 5.4 — reporting module + `dashboard.snapshot` + synchronized metric UI
- `8bd4bcc` story 5.3 — timeline + scoped `listForPerson`
- `4fc1ea9` story 5.2 — profile sections
- `f4e9b5f` story 5.1 — scoped search / IDOR / PopulationPort honesty
- `29a1575` epic 4b retro

Pattern for 5.5: treat `/reports` like 5.4 treated `/dashboard` — **swap placeholder for real governed queries**; put catalogue + assemblers in `reporting`; consume `GovernedDataTable` instead of inventing cards-for-tables.

### Architecture compliance

- **Capability map:** Dashboard & reports (FR-35..36) live in `packages/modules/reporting` — AD-2 (projections), AD-5 (envelope + InferenceBulk). Export (FR-41) is reporting via audit-envelope but **not** this story.
- **AD-3:** reporting may call **published** APIs from person-employment / headcount / event-store / (later) migration — not private schemas.
- **AD-6:** no `@prisma/client` in `apps/web`; heavy recalc stays async + pending UI.
- Stack (repo): Next.js **16.2.x**, tRPC **11.18.x**, React **19**, Node 22 — **no stack upgrade** in this story.
- Shared filter inputs: prefer reusable Zod schemas (possibly shared module between dashboard/report filters); React Query keys must include full filter + `reportKey`.

### File structure (expected touch)

**UPDATE (primary):**

- `apps/web/app/(app)/reports/page.tsx`
- `apps/web/lib/operational-copy.ts`
- `packages/modules/reporting/src/index.ts` (+ `package.json` scripts)
- `packages/modules/reporting/src/workforce-events.ts` (or sibling) for status-aware helpers
- `apps/web/src/server/root.ts` (mount router)
- Root / web `package.json` selfcheck script entries

**NEW (as needed):**

- `packages/modules/reporting/src/report-catalogue.ts`
- `packages/modules/reporting/src/report-run.ts` (or `assemble-report-run.ts`) + `report.selfcheck.ts`
- `apps/web/src/server/report.ts` + `report.selfcheck.ts`
- `apps/web/components/reports/report-catalogue-panel.tsx`
- `apps/web/components/reports/report-filters.tsx`
- Optional thin presentational pieces under `components/reports/`

**DO NOT modify (unless proven blocker + note):**

- `packages/modules/identity-access/src/navigation.ts` landing/nav matrix
- `GovernedDataTable` public contract / sort-filter-page internals
- Event finalize / Operator capacity mutation rules
- Dashboard product cards (unless extracting shared filter Zod — prefer share without churning 5.4 UI)
- Access-admin domain APIs
- Building real `export-artifact-panel` (6.5)

### Library / framework requirements

- Reuse: `JalaliDatePicker`, `toPersianDigits`, `Skeleton`, `operationalCopy`, `runGovernedRetrieval`, `GovernedDataTable`, historical org/HC helpers, headcount near-expiry / conservation, management derivation APIs, `@/lib/trpc/client` hooks, leave-guard `requestNavigation` for drills
- Client: shared filter state + selected `reportKey` → `api.report.*.useQuery` — follow existing `api.*.useQuery` repo pattern (no forced migration to `@trpc/tanstack-react-query` queryOptions)
- No AG Grid; no new BI/chart SaaS; no Prisma in web
- Next.js 16: page can stay Server Component wrapping a client `ReportCataloguePanel`
- tRPC 11: `.meta({ allowClientTemporal: true })` already supported by repo `governedProcedure` — mirror dashboard; transformers stay per existing app setup (no upgrade)

### Testing requirements

- Thin selfchecks: catalogue completeness; suppress/empty/zero/unavailable oracle; Effective helpers unchanged; new status filters correct; filter schema; Import Batch stub honesty
- Manual DoD for UJ-3 team report, Jalali/a11y focus on catalogue + table, export disabled
- Do not claim Vitest/ephemeral DB coverage (still deferred open item)
- Do not claim FR-41 export complete

### Latest technical notes (2026)

- tRPC 11 + Next App Router: keep using repo’s existing `fetchRequestHandler` + `api.*.useQuery` patterns; do **not** introduce Pages-router `@trpc/next` or drive a queryOptions migration in this story
- Share filter Zod objects; include `reportKey` in procedure input and React Query keys so catalogue switches invalidate correctly
- No dependency upgrades for this story

### Project context reference

- No root `project-context.md` at activation; follow architecture spine + Gates + package boundaries above
- UX: `ux-divan-2026-07-19` IA retains گزارش‌ها (FR-36); UJ-3 names «اعضای هر تیم»; suppress copy shared with dashboard per `ux-divan-2026-07-13` EXPERIENCE state table. No `key-reports.html` mockup — compose GovernedDataTable + dashboard filter conventions. On conflict, **epics Story 5.5 + FR-36 + UX-DR7/22** win.

### Epic 4 / 4b / 5 carry-ins

1. Person-org IDOR + PopulationPort honesty — every report aggregate path
2. Consume Epic 4 assemblers / historical HC / event-store — no parallel SoT
3. Leave-guard data-state rules — reports are read-primary; drills via `requestNavigation` when needed
4. AR matrices fail-closed in Epic 5 — do not invent AR-REPORTING freeze
5. Artifact/export reauth consumer contract remains mandatory for **6.5 / 7.x** (still open) — 5.5 only stubs the affordance
6. Still-open (do not silently “fix”): InferenceBulkPort ops doc; sticky break-glass; PopulationPort cutover; AD-6 hardening; ensure*Schema migrations-only; Vitest/ephemeral isolation

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5 / Story 5.5; FR36; UX-DR7/15/17/22]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-36 consequences; FR-41/52 boundary; FR-25/27; FR-47/48; AR-REPORTING; NFR-2]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — reporting BC; AD-2/3/5/6]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — IA گزارش‌ها; UJ-3]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — suppress copy on گزارش‌ها; export as contextual surface]
- [Source: `_bmad-output/implementation-artifacts/5-4-core-launch-dashboard.md` — prior story; reserved `/reports`; review pitfalls]
- [Source: `_bmad-output/implementation-artifacts/5-1-permission-safe-personnel-search-lists.md` — retrieval pipeline + PopulationPort]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 5.4 deferrals; Epic 4 “Still Epic 5: report catalogue”]
- [Source: `apps/web/app/(app)/reports/page.tsx`]
- [Source: `apps/web/src/server/dashboard.ts` — template router]
- [Source: `apps/web/src/server/retrieval-control.ts` — channel `report`]
- [Source: `packages/modules/reporting/src/metric-catalogue.ts` — catalogue pattern to mirror]
- [Source: `packages/modules/reporting/src/workforce-events.ts` — Effective-only helpers]
- [Source: `packages/modules/identity-access/src/navigation.ts` — `/reports` nav]
- [Source: `packages/modules/identity-access/src/population-authz.ts` — `RetrievalChannel` includes `report`]
- [Source: `apps/web/components/governed-data-table/` — UX-DR7 table + `exportSlot`]
- [Source: `packages/modules/migration/src/index.ts` — empty stub justifying Import Batch unavailable]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Mirrored Story 5.4 dashboard patterns: catalogue + assemble* + governed tRPC + dual-package selfcheck.
- Soft-omit catalogue keys by compensation/org/headcount caps (no disabled theater).
- Status-aware event helpers added without stretching isCountableEffective.

### Completion Notes List

- Implemented FR-36 launch report catalogue in @divan/reporting (requireLaunchReportCatalogue, assembleReportRun).
- Governed report.catalogue + report.run on channel report with PopulationPort honesty + soft probes.
- Replaced /reports PlaceholderPage with catalogue + Jalali filters + GovernedDataTable; export stub only (6.5).
- Import Batch returns honest unavailable (Epic 6); suppress != empty != zero oracle selfchecked.
- Scripts: root selfcheck:report dual-package; regressions dashboard / personnel-search / inference-bulk ok.
- NFR-2 provisional: same envelope as dashboard (~500 subjects, apply-path event load, truncation fail-closed); no AR-NFR invented.
- Deep-link gaps (full query presets on list/events) remain deferred from 5.4 — pass teamId where accepted.
- navigation.ts untouched; GovernedDataTable contract unchanged; FR-41 export not claimed done.

### File List

- packages/modules/reporting/src/report-catalogue.ts
- packages/modules/reporting/src/report-run.ts
- packages/modules/reporting/src/report.selfcheck.ts
- packages/modules/reporting/src/workforce-events.ts
- packages/modules/reporting/src/index.ts
- packages/modules/reporting/package.json
- apps/web/src/server/report.ts
- apps/web/src/server/report.selfcheck.ts
- apps/web/src/server/root.ts
- apps/web/lib/operational-copy.ts
- apps/web/app/(app)/reports/page.tsx
- apps/web/components/reports/report-catalogue-panel.tsx
- apps/web/components/reports/report-filters.tsx
- apps/web/package.json
- package.json
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/5-5-launch-report-catalogue.md

## Change Log

- 2026-07-25: Story context created (ready-for-dev) — ultimate context engine analysis completed.
- 2026-07-25: Implemented launch report catalogue (run/view) — Status → review.
- 2026-07-25: Code review patches applied (team intersect, range optional, as-of honesty) — Status → done.
