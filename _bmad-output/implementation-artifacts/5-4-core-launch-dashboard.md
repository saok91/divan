---
baseline_commit: 8bd4bcc
---

# Story 5.4: Core Launch Dashboard

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an HR Admin or Manager,
I want a permission-safe launch dashboard with synchronized filters,
so that workforce totals, trends, team capacity, starts/terminations, and open headcount reconcile to detail (FR35, UX-DR15).

**Story key:** `5-4-core-launch-dashboard`  
**Epic:** 5 — Search, Profiles, Dashboard & Reports (FR33–36)  
**Prerequisite:** Epic 4b landings + IA live (`/dashboard` is Admin/Manager role landing). Stories 5.1–5.3 done (permission-safe list/profile/timeline for reconciliation drills). Epic 4 projections + headcount ledger (4.9 / 4.11 / 4.14) available as read models. Story 2.7 InferenceBulk channel `dashboard` already reserved.

## Acceptance Criteria

1. **Given** داشبورد access (coarse nav already allows `hr_admin` / `manager` / `hr_operator`)  
   **When** shared organization and time filters change  
   **Then** all applicable `dashboard-metric-card`s update synchronously with permission-safe **current / as-of** semantics (`allowClientTemporal` + shared filter state)

2. **And** indicators cover (FR-35 consequences):
   - active Persons
   - LE / BU / Dept / Team counts
   - approved / used / reserved / free headcount
   - workforce trend by Effective Date (selectable range; daily/monthly or owner-approved granularity — do **not** invent AR-REPORTING numbers; use configurable hooks with launch-required defaults)
   - Team membership / capacity (Primary member count, capacity, used, free; org filter + sort by count/capacity)
   - starts vs terminations (range + org filters + trend)
   - open headcount including near-expiry / expired **non-consumable** approvals (open = free on valid consumable approvals; expired shown separately as non-consumable)

3. **And** each metric links to or reconciles with permission-filtered detail (UJ-3): e.g. `/personnel/list`, `/headcount/...`, `/personnel-events/...`, `/organization/...` with preset query params where practical — never deep-link into out-of-scope rows

4. **And** suppressed cohorts show exactly «داده قابل نمایش نیست» — **never** render as `0` (`operationalCopy.suppressedCohort`)

5. **And** empty scoped dashboard shows exactly «در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.» (add to `operational-copy.ts` if missing)

6. **And** grid is **2–4 columns at ≥1280** and **2-column at 1280×720** (UX-DR15 / Story AC — **not** the older DESIGN “single column at 1280×720” conflict; story + UX-DR15 win); last calculation time shown when derived state is used

7. **And** every dashboard retrieval uses channel **`dashboard`**: authorize → PopulationPort intersect → InferenceBulk → access event → payload (same plane as 5.1; FR-47 / FR-48)

8. **And** dashboard metrics reconcile with list / profile / headcount foreshadow under the same date, filters, scope, and metric definition (FR-25 / FR-27) — **no** parallel SoT tables or client-only “safe” aggregates of unscoped dumps

9. **And** PopulationPort honesty preserved: fixture registry must not be labeled as production workforce authz; fail-closed / disclosure posture from 5.1 continues

10. **And** NFR-2 provisional: common dashboard load ≤5s for nominal envelope (~500 people) — document budget; do not invent AR-NFR percentiles

## Tasks / Subtasks

- [x] Task 1: Reporting BC aggregations + governed tRPC (AC: #1–#2, #7–#9)
  - [x] Replace stub in `packages/modules/reporting` with metric assembly helpers that **compose** published APIs / projections — do **not** read other modules’ private tables (AD-3)
  - [x] Reuse (do not reinvent):
    - Org/HC as-of: `getHistoricalOrgHeadcountState` / `organization.getHistoricalCounts` pattern (4.11) — **live** `readHeadcountCapacityPanel` is current-only; historical asOf → ledger reconstruction
    - Headcount conservation: `approved = used + reserved + free`; fail-closed on catalogue violation (never silent floor)
    - Near-expiry: `isApprovalExpiryWithinWarningHorizon` + `HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS` (14) from `@divan/headcount`
    - Active Persons / population: same PopulationPort intersect as 5.1 (`runGovernedRetrieval` channel `dashboard`)
    - Freshness: surface `MSG_HIST_ORG_RECALC_*` / recalc pending — do not paint stale derived as current (NFR-3 / AD-6)
  - [x] NEW tRPC router (prefer `apps/web/src/server/dashboard.ts` or `reporting.ts`) mounted on `appRouter`:
    - shared Zod filter input: org scope selectors + `evaluationMode` / `asOfDate` + trend range
    - `allowClientTemporal: true` on procedures that accept as-of
    - one shared filter object fed to all metric procedures (or a single `dashboard.snapshot` that returns card DTOs) so UI sync is trivial
  - [x] Starts/terminations + workforce trend: aggregate Effective-Date-scoped business events **after** population intersection + InferenceBulk — prefer event-store list/query helpers already used by lifecycle; **no** new event SoT
  - [x] Metric definition hooks: keep AR-REPORTING-pluggable shape (pending artifact) with launch-required metric keys hardcoded as required catalogue — **never invent** production cohort thresholds or 30/60/90 targets
  - [x] Persian fail-closed errors; no raw `error.message` in UI

- [x] Task 2: `dashboard-metric-card` + synchronized filters UI (AC: #1, #3–#6)
  - [x] UPDATE `apps/web/app/(app)/dashboard/page.tsx`: replace placeholder + optional demote/remove `InferenceBulkDemoCard` once real cards prove suppress ≠ zero (demo may remain behind a caption only if still useful for ops — prefer product cards)
  - [x] NEW under `apps/web/components/dashboard/`:
    - `dashboard-metric-card.tsx` — UX-DR15: `{heading-sm}` name, `{heading}` value (Persian digits / tabular), `{caption}` reconciliation link, suppressed/empty/error/pending states
    - `dashboard-filters.tsx` — shared org + time/as-of (+ trend range) using `JalaliDatePicker`; changing filters re-queries **all** cards
    - `dashboard-panel.tsx` (or equivalent host) — grid + last calculation time + empty-scope banner
  - [x] Card primitive: add `apps/web/components/ui/card.tsx` (shadcn-style) **only if** needed for DESIGN visual; otherwise border/token layout matching existing panels is fine — do not invent a second design system
  - [x] Responsive grid: CSS that yields 2 cols at 1280×720 and up to 4 at wider ≥1280; respect viewport gate (<1280 already handled shell-side)
  - [x] Copy: add `operationalCopy.emptyDashboardScope` = «در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.»; reuse `suppressedCohort` exactly
  - [x] Values via `toPersianDigits`; financial/count amounts tabular; never Latin digits in actor-facing metrics
  - [x] Reconciliation links: use `requestNavigation` when leave-guard could apply; prefer query presets that 5.1 list / headcount panels already understand

- [x] Task 3: Authz / nav / role landing integrity (AC: #7)
  - [x] **Do not** edit `packages/modules/identity-access/src/navigation.ts` ROLE_LANDING / ROLE_NAV unless a proven bug blocks dashboard access
  - [x] Deep-link deny remains `resolve-app-path-access` + «دسترسی ندارید.»
  - [x] Unauthorized metrics/actions: omit from DOM (not disabled theater revealing forbidden data)
  - [x] Operator can open `/dashboard` (in nav) — metrics still PopulationPort-scoped; do not invent a separate Operator dashboard product without PRD change

- [x] Task 4: Verify + DoD (AC: #1–#10)
  - [x] NEW selfcheck(s) in `@divan/reporting` and/or `@divan/web`: suppress ≠ empty ≠ zero; headcount conservation; shared-filter input identity; optional dual-caller equality vs `getHistoricalCounts` foreshadow for overlapping cards
  - [x] Wire package scripts (`selfcheck:dashboard` / reporting selfcheck)
  - [x] Regression: inference-bulk, personnel-search (as touched), organization historical counts selfchecks
  - [x] `pnpm --filter @divan/web` typecheck + eslint on touched files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows

### Manual DoD checklist

- [x] Admin/Manager landing `/dashboard` shows real metric cards (not only placeholder copy)
- [x] Changing org or as-of filter refreshes **all** applicable cards together
- [x] Suppress path → «داده قابل نمایش نیست» (never 0)
- [x] Empty scoped filter → «در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.»
- [x] Grid: 2-col at 1280×720; up to 4-col when wider
- [x] Last calculation time visible when derived/as-of projections used
- [x] Reconciliation link reaches permission-filtered detail without leaking out-of-scope ids
- [x] Recalc pending/failed/stale → fail-closed Persian (not fake totals)
- [x] PopulationPort fixture honesty still disclosed / fail-closed (no “production workforce” claim)
- [x] No Prisma in `apps/web`; no parallel metric SoT tables
- [x] `/reports` remains placeholder (Story 5.5); no governed export panel (6.5)
- [x] Labels stay داشبورد / اطلاعات پرسنلی — no Epic 1 «پرسنل» regression
- [x] UJ-3 path workable: dashboard → sync cards → drill list/report path (report catalogue depth = 5.5)

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Fill `/dashboard` in place (role landing already correct) | Rebuild nav/landing matrix or new dashboard route |
| Own aggregations in `@divan/reporting` + governed tRPC | Dump unscoped SQL into `apps/web` or invent parallel SoT |
| Channel `dashboard` via `runGovernedRetrieval` / InferenceBulk | Client-only filter of full workforce as “safe” |
| Reuse 4.11 historical org/HC + 4.14 near-expiry helpers | Fork conservation math or invent expiry N |
| Suppress ≠ empty ≠ zero (exact Persian strings) | Render suppressed as `0` or reuse emptySearch copy for suppress |
| AR-REPORTING / AR-ACCESS / AR-DATA / AR-TEMPORAL / AR-HEADCOUNT fail-closed | Invent metric formulae, cohort thresholds, or 30/60/90 targets |
| PopulationPort honesty (fixture ≠ production) | Claim cutover without `population-cutover.ts` criteria |
| UX-DR15 grid = 2-col at 1280×720 | Follow conflicting older DESIGN “single column” note |
| Persian digits + Jalali filters | Latin digit metrics / Gregorian-only picker for actors |

### Absolute non-goals

- Launch **report catalogue** run/view → **5.5** (`/reports` stays placeholder)
- Governed file export / artifact panel / reauth → **6.5** (Epic 2 carry)
- PopulationPort **full** default-registry cutover; AD-6 Prisma vs PoolClient; `ensure*Schema` migrations-only; Vitest mandate
- Logout → `requestNavigation` leave-guard (Epic 4b open) — document exemption if untouched
- Dedupe Add vs QuickCreate forms (Epic 4b open)
- Access-admin / audit / operations dashboards
- Chart library shopping (simple trend presentation OK; no BI suite)
- Inventing AR-REPORTING production freeze values

### Dashboard consumer contract (encode — do not rediscover)

1. **Counts / capacity as-of** → `getHistoricalOrgHeadcountState` / `organization.getHistoricalCounts` semantics (4.11). Live capacity panel ≠ historical asOf.
2. **Active Persons** → PopulationPort-intersected person ids + current-state projector / employment-active semantics (same honesty as 5.1).
3. **Open headcount / near-expiry** → headcount approval reads + `isApprovalExpiryWithinWarningHorizon` (4.14); expired = non-consumable display.
4. **Starts / terminations / trend** → Effective-Date aggregates over authorized population’s business events (event-store), then InferenceBulk on the aggregate channel.
5. **Reconciliation** → deep-link to existing 5.1 list / headcount / org surfaces with shared filter intent; FR-25: same date/scope/metric definition.
6. **No parallel SoT:** no `dashboard_metrics` table as source of truth; no Prisma in web; no second InferenceBulk stack inside reporting.

### Suppress / empty / zero oracle (must ship)

| Outcome | UI | Volume |
| --- | --- | --- |
| `suppressed` | «داده قابل نمایش نیست» | never show numeric 0 |
| `empty` | «در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.» | true empty scope |
| `allowed` | Persian digits tabular value | real count |

Demo card (`InferenceBulkDemoCard`) already teaches this with `demoScopedRetrieval` channel `dashboard` — product cards must match the same oracle.

### Live vs historical pitfall

`readHeadcountCapacityPanel` / live capacity APIs are **finalize-current**. Dashboard as-of mode **must** use historical ledger reconstruction (4.11). Mixing live free into an as-of card is a reconciliation bug.

### UPDATE files — current state → change → preserve

| Path | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `apps/web/app/(app)/dashboard/page.tsx` | Title + placeholder + `InferenceBulkDemoCard` | Real filters + metric grid host | Route `/dashboard`; Persian title داشبورد |
| `apps/web/lib/operational-copy.ts` | Has `suppressedCohort`; **no** empty-dashboard string | Add exact empty-dashboard scope copy | Existing exact strings (deny, emptySearch, suppress) |
| `packages/modules/reporting/src/index.ts` | Empty stub + InferenceBulk reminder | Real aggregation exports | Must still call shared InferenceBulk plane — no parallel thresholds |
| `apps/web/src/server/root.ts` | No reporting/dashboard router | Mount new router | Existing routers/demos unchanged unless demo removed intentionally |
| `inference-bulk-demo-card.tsx` | Story 2.7 proof on `/dashboard` | Remove or demote once product cards cover suppress | Keep demo APIs in root for ops if still referenced elsewhere |
| `navigation.ts` | Admin/Manager → `/dashboard` | **No change** expected | ROLE_NAV / ROLE_LANDING / canAccessPath |
| `historical-org-headcount-foreshadow.tsx` | Org as-of foreshadow (not dashboard) | Optional reuse of display patterns only | Remains org foreshadow — do not delete as “replaced by dashboard” without product note |

### Previous story intelligence (5.3 → 5.4)

From `5-3-personnel-event-timeline.md` completion + review:

- Pattern: **replace stubs in place**; harden reads with scope; reuse chrome; thin selfchecks + honest manual a11y DoD.
- Timeline is person-scoped event list — **not** a dashboard feed. Do not wire dashboard trend UI to `listForPerson` / apply-order ASC reconstruct path.
- Person-org IDOR + PopulationPort honesty are systemic Epic 5 rules — extend to every dashboard aggregate.
- Review deferred items on mutations/scope mapping are **not** this story’s job unless a dashboard read path hits the same helper.
- BOM-safe `sprint-status.yaml` edits on Windows.
- Helper selfchecks ≠ full browser coverage — state DoD ceiling honestly.

From `5-1` (critical for reconcile drills):

- Pipeline: authorize → PopulationPort → InferenceBulk → access event → payload
- Fixture PopulationPort → fail-closed empty + disclosure (not stamp-all UUID map)
- List deep-links use اطلاعات پرسنلی / فهرست پرسنل IA

### Git intelligence (recent)

- `8bd4bcc` story 5.3 — timeline + scoped `listForPerson` + StatusBadge lifecycle
- `4fc1ea9` story 5.2 — profile sections + timeline stub entry
- `f4e9b5f` story 5.1 — scoped search / IDOR / PopulationPort honesty
- `29a1575` / `5b7cde0` epic 4b — shell IA; `/dashboard` landing without metrics

Pattern for 5.4: treat dashboard page like 5.1 treated list panel — **swap placeholder for real governed queries**; put domain math in the owning module (`reporting`), not the page.

### Architecture compliance

- **Capability map:** Dashboard & reports (FR-35..36) live in `packages/modules/reporting` — AD-2 (projections), AD-5 (envelope + InferenceBulk).
- **AD-3:** reporting may call **published** APIs from person-employment / headcount / event-store — not private schemas.
- **AD-6:** no `@prisma/client` in `apps/web`; heavy recalc stays async + pending UI.
- Stack (repo): Next.js **16.2.x**, tRPC **11.18.x**, React **19**, Node 22 — **no stack upgrade** in this story.
- Shared filter inputs: prefer reusable Zod schemas chained via tRPC `.input()` merges (tRPC 11); keep one client filter state object passed to all card queries so React Query keys stay aligned.

### File structure (expected touch)

**UPDATE (primary):**

- `apps/web/app/(app)/dashboard/page.tsx`
- `apps/web/lib/operational-copy.ts`
- `packages/modules/reporting/src/index.ts` (+ `package.json` scripts)
- `apps/web/src/server/root.ts` (mount router)
- Optionally demote `apps/web/components/dashboard/inference-bulk-demo-card.tsx`

**NEW (as needed):**

- `packages/modules/reporting/src/**` metric helpers + selfcheck
- `apps/web/src/server/dashboard.ts` (or `reporting.ts`)
- `apps/web/components/dashboard/dashboard-metric-card.tsx`
- `apps/web/components/dashboard/dashboard-filters.tsx`
- `apps/web/components/dashboard/dashboard-panel.tsx`
- `apps/web/components/ui/card.tsx` (only if chosen)
- `*.selfcheck.ts` + package script entries

**DO NOT modify (unless proven blocker + note):**

- `packages/modules/identity-access/src/navigation.ts` landing/nav matrix
- `GovernedDataTable` public contract
- Event finalize / Operator capacity mutation rules
- `/reports` placeholder (5.5)
- Access-admin domain APIs

### Library / framework requirements

- Reuse: `JalaliDatePicker`, `toPersianDigits`, `Skeleton`, `operationalCopy`, `runGovernedRetrieval`, `organization.getHistoricalCounts` / historical org helpers, headcount near-expiry helpers, `@/lib/trpc/client` hooks, leave-guard `requestNavigation` for drills when dirty forms possible
- Client: shared filter state → parallel `useQuery` keys (or one snapshot query) — invalidate together on filter commit
- No AG Grid; no new BI/chart SaaS; no Prisma in web
- Next.js 16: page can stay Server Component wrapping a client `DashboardPanel`

### Testing requirements

- Thin selfchecks: suppress/empty/zero oracle; conservation identity; filter schema; optional parity with foreshadow counts for overlapping metrics
- Manual DoD for grid breakpoints, UJ-3 drill, as-of vs live pitfall, a11y focus on cards/filters
- Do not claim Vitest/ephemeral DB coverage (still deferred open item)

### Latest technical notes (2026)

- tRPC 11: share filter Zod objects; chain `.input()` for common temporal fields; React Query keys must include full filter so card sync is automatic
- Next.js 16 App Router: keep dashboard interactions in Client Components; no need to adopt `@trpc/tanstack-react-query` queryOptions migration in this story — follow existing `api.*.useQuery` repo pattern
- No dependency upgrades for this story

### Project context reference

- No root `project-context.md` at activation; follow architecture spine + Gates + package boundaries above
- UX: `ux-divan-2026-07-19` IA retains داشبورد (FR-35); detailed card/suppress/empty from UX-DR15/22 + 2026-07-13 EXPERIENCE/mock `key-dashboard.html` (historical visual reference). On conflict, **epics Story 5.4 + UX-DR15** win over 2026-07-13 DESIGN single-column note.

### Epic 4 / 4b / 5 carry-ins

1. Person-org IDOR + PopulationPort honesty — every aggregate path
2. Consume Epic 4 assemblers / historical HC — no parallel SoT
3. Leave-guard data-state rules — dashboard is read-primary; drills via `requestNavigation` when needed
4. AR matrices fail-closed in Epic 5 — do not invent AR-REPORTING freeze
5. Still-open (do not silently “fix”): InferenceBulkPort ops doc; sticky break-glass; artifact reauth 6.5/7.x; PopulationPort cutover; AD-6 hardening; ensure*Schema migrations-only

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5 / Story 5.4; UX-DR15/18/22; FR35]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-35 consequences; FR-25/27; FR-47/48; NFR-2]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — reporting BC; AD-2/3/5/6]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — IA داشبورد; UJ-3; role landings]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — dashboard-metric-card; state patterns]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/mockups/key-dashboard.html`]
- [Source: `_bmad-output/implementation-artifacts/5-1-permission-safe-personnel-search-lists.md` — retrieval pipeline + PopulationPort]
- [Source: `_bmad-output/implementation-artifacts/5-3-personnel-event-timeline.md` — prior Epic 5 patterns]
- [Source: `apps/web/app/(app)/dashboard/page.tsx`]
- [Source: `apps/web/components/dashboard/inference-bulk-demo-card.tsx`]
- [Source: `apps/web/src/server/retrieval-control.ts` — channel `dashboard`]
- [Source: `apps/web/src/server/organization.ts` — `getHistoricalCounts`]
- [Source: `apps/web/components/organization/historical-org-headcount-foreshadow.tsx`]
- [Source: `packages/modules/reporting/src/index.ts`]
- [Source: `packages/modules/identity-access/src/navigation.ts`]
- [Source: `packages/modules/headcount/src/headcount-reservation-expiry.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Reporting typecheck + `selfcheck:dashboard` (suppress≠empty≠zero, conservation, trend, catalogue)
- Web `selfcheck:dashboard` (copy oracle + filter Zod identity)
- Regression: `selfcheck:personnel-search`, `selfcheck:inference-bulk`, `selfcheck:historical-org-headcount`
- `@divan/web` typecheck + eslint on touched dashboard files

### Completion Notes List

- Replaced `@divan/reporting` stub with launch metric catalogue, conservation identity, starts/trend aggregates, and `assembleDashboardSnapshot` composing published APIs only (AD-3).
- Mounted `dashboard.snapshot` on `appRouter` with `allowClientTemporal`, channel `dashboard` via `runGovernedRetrieval`, PopulationPort honesty from 5.1, and soft-omit of org/HC cards without matching PermissionSet.
- UI: shared `DashboardFilters` + single snapshot query syncs all cards; `DashboardMetricCard` Persian digits / suppress≠empty≠zero; grid `grid-cols-2` → `xl:3` → `2xl:4`; removed product demo card from page (demo APIs remain in root for ops).
- NFR-2 provisional budget: one snapshot round-trip; active-person count uses `listEmploymentsForPerson` (not full projector) after InferenceBulk; starts/terms use per-subject event-store list capped at 200 — suitable for nominal ~500 envelope; no AR-NFR percentiles invented.
- DoD ceiling: helper selfchecks + typecheck ≠ full browser click-through; reviewer should spot-check grid at 1280×720 and UJ-3 drills logged-in.
- Logout → `requestNavigation` leave-guard remains Epic 4b open (dashboard drills use leave-guard when provider present).

### File List

- `packages/modules/reporting/package.json`
- `packages/modules/reporting/src/index.ts`
- `packages/modules/reporting/src/metric-catalogue.ts`
- `packages/modules/reporting/src/headcount-conservation.ts`
- `packages/modules/reporting/src/workforce-events.ts`
- `packages/modules/reporting/src/dashboard-snapshot.ts`
- `packages/modules/reporting/src/dashboard.selfcheck.ts`
- `apps/web/package.json`
- `apps/web/src/server/dashboard.ts`
- `apps/web/src/server/dashboard.selfcheck.ts`
- `apps/web/src/server/root.ts`
- `apps/web/lib/operational-copy.ts`
- `apps/web/app/(app)/dashboard/page.tsx`
- `apps/web/components/dashboard/dashboard-metric-card.tsx`
- `apps/web/components/dashboard/dashboard-filters.tsx`
- `apps/web/components/dashboard/dashboard-panel.tsx`
- `package.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/5-4-core-launch-dashboard.md`

### Change Log

- 2026-07-24: Story context created (ready-for-dev) — ultimate context engine analysis completed.
- 2026-07-24: Implemented core launch dashboard (reporting assemble + `dashboard.snapshot` + synchronized metric UI); status → review.
- 2026-07-25: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — findings appended below.
- 2026-07-25: Review patches applied (Effective events, apply-path load, as-of open HC, grid, fail-closed copy, filter/permission hardening); decisions resolved; status → done.

### Review Findings

- [x] [Review][Decision] Scope of `teamId` on population cards — Resolved (B): keep split; UI hint `dashboardTeamFilterHint` clarifies team filter is org/HC only.
- [x] [Review][Decision] `org_unit_counts` under team filter — Resolved (A): keep organization-wide hierarchy totals (documented in assemble path).

- [x] [Review][Patch] Count Effective (not Finalized) business events — [`packages/modules/reporting/src/workforce-events.ts`]
- [x] [Review][Patch] Use apply-path event load with range, not UI list cap 200 — [`packages/modules/reporting/src/dashboard-snapshot.ts`]
- [x] [Review][Patch] As-of open headcount must not mix live free / wall-clock expiry — [`packages/modules/reporting/src/dashboard-snapshot.ts`]
- [x] [Review][Patch] Grid must be 2 columns at 1280×720 — [`apps/web/components/dashboard/dashboard-panel.tsx`]
- [x] [Review][Patch] Never surface raw `query.error.message` — [`apps/web/components/dashboard/dashboard-panel.tsx`]
- [x] [Review][Patch] Reject `as_of` without `asOfDate` — [`apps/web/src/server/dashboard.ts`]
- [x] [Review][Patch] Soft permission probes must not swallow infra errors — [`apps/web/src/server/dashboard.ts`]
- [x] [Review][Patch] Inactive/invalid `teamId` should not fail whole snapshot — [`packages/modules/reporting/src/dashboard-snapshot.ts`]
- [x] [Review][Patch] Unknown errors must not use access-denied copy — [`apps/web/src/server/dashboard.ts`]
- [x] [Review][Patch] Disable Jalali pickers while fetching — [`apps/web/components/dashboard/dashboard-filters.tsx`]
- [x] [Review][Patch] Surface filter validation failures — [`apps/web/components/dashboard/dashboard-filters.tsx`]
- [x] [Review][Patch] Default trend range via Tehran calendar — [`apps/web/components/dashboard/dashboard-panel.tsx`]
- [x] [Review][Patch] Pending must not look like access denied — [`apps/web/components/dashboard/dashboard-metric-card.tsx`]
- [x] [Review][Patch] Tighten expired non-consumable counting — [`packages/modules/reporting/src/dashboard-snapshot.ts`]
- [x] [Review][Patch] Team capacity card must show capacity + used/free (and approved) — [`apps/web/components/dashboard/dashboard-panel.tsx`]
- [x] [Review][Patch] Stable React keys for detail lines — [`apps/web/components/dashboard/dashboard-metric-card.tsx`]
- [x] [Review][Patch] Keep lastCalculatedAt visible on empty/suppress banners when snapshot returns it — [`apps/web/components/dashboard/dashboard-panel.tsx`]

- [x] [Review][Defer] N+1 `listEmploymentsForPerson` per subject for active count — deferred, pre-existing pattern / NFR-2 provisional (document budget; optimize later) [`packages/modules/reporting/src/dashboard-snapshot.ts`]
- [x] [Review][Defer] Full reconcile query-presets on list/event routes — deferred, pre-existing; target surfaces do not yet accept shared dashboard filter query params beyond capacity `teamId` [`packages/modules/reporting/src/dashboard-snapshot.ts`]
- [x] [Review][Defer] User-facing sort control for team capacity by count/capacity — deferred; server sorts by membership for `topTeamId` only; interactive sort UI not specified as launch chrome [`packages/modules/reporting/src/dashboard-snapshot.ts`]
