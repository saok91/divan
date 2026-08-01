---
baseline_commit: b33345b
---

# Story 9.5: Reports Section Tabs & Report Workspace

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an HR business partner,
I want reports grouped by subject with a clear run-and-export flow,
so that finding and running a report is not a hunt (UX-DR33, FR36, FR59).

**Story key:** `9-5-reports-section-tabs-workspace`  
**Epic:** 9 — Operational Surface Completion & IA Coherence (FR59; UX-DR33; FR36 surface completion)  
**UX contract:** `ux-divan-2026-07-31` (EXPERIENCE §IA گزارش‌ها + report surface pattern; DESIGN page-header/section-tabs; mockup `screens-reports-capacity.html` §۱)  
**Authorized by:** `sprint-change-proposal-2026-07-31`  
**Prerequisite:** Stories **5.5** (launch catalogue + run semantics), **6.5** (governed export), **Epic 8** primitives, **9.4** section-tabs IA pattern (mirror).  
**Downstream:** **9.7** drill-through needs shareable report URLs; **9.9** no-dead-end gate expects every گزارش‌ها tab functional; **9.10** chart visual quality applied *onto* this workspace (do not claim 9.10 here).

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Flat reports page | `app/(app)/reports/page.tsx` | PageHeader + `ReportCataloguePanel`; **no** section tabs; **no** `assertPageAccess`; stale purpose copy (“خروجی در ۶٫۵”) | Become index **redirect** + access gate; tabs host the workspace |
| Catalogue panel | `components/reports/report-catalogue-panel.tsx` | All-keys card grid; React state only; **auto** `report.run` on apply; raw `<p role=alert>`; lastCalc in table toolbar; export + decision publication wired | Reshape to **rail · params · explicit run · result + meta**; URL sync; FeedbackMessage; subject filter |
| Filters | `components/reports/report-filters.tsx` | EntityPicker team + current/as-of + range; apply identity | Keep semantics; embed as **parameters strip** (primary CTA = اجرا in strip, not header) |
| Export | `components/export/export-artifact-panel.tsx` | FR41/FR52 reauth + custody via `exportSlot` | **Unchanged rules** — keep binding to `exportSnapshotHash` + filter |
| Decision publication | `components/reports/decision-publication-panel.tsx` | Epic 7 publication after successful run | Preserve mount after allowed run |
| Catalogue defs | `packages/modules/reporting/src/report-catalogue.ts` | 14 launch keys + titles + cap flags; **no** `subject` / `purposeFa` | Add subject + one-line purpose; do not drop keys |
| tRPC report | `apps/web/src/server/report.ts` | `catalogue` soft-omits unauthorized keys; `run` via retrieval | Enrich catalogue entries for denied-with-requirement; keep run fail-closed |
| Section-tabs chrome | `section-tabs.tsx`, `surface-section-tabs-layout.tsx`, `section-tab-surfaces.ts` | URL Link tablist; leave-guard; headcount/personnel precedents | **Register `/reports`** + 5 subject tabs; reuse layout unchanged |
| Headcount IA (9.4) | `headcount/page.tsx` + `(tabs)/layout.tsx` | Root redirect + `SurfaceSectionTabsLayout` + purpose | **Mirror** for `/reports` |
| Design-QA matrix | `lib/design-qa-mockup-matrix.md` | Reports workspace row = `amendment` — “Epic **9.5** owns…” | Flip Result to **`pass`** when workspace real (structure only — not 9.10 charts) |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Subject tabs vs report keys** | Tabs = five UX subjects (نیروی انسانی · سازمان · رویدادها · ظرفیت و جذب · ورود داده). Keys = 14 `LaunchReportKey` values grouped under those tabs. One workspace host; filter catalogue by subject. |
| **«ورود داده» (reports) vs «ورود گروهی» / migration** | Reports tab «ورود داده» hosts **`import_batch_outcomes`** (and only that subject’s catalogue). It is **not** the bulk-entry wizard and **not** sidebar migration. Dual-entry honesty from 9.1–9.3 still applies. |
| **Soft-omit vs state access requirement** | Today `catalogueForCaps` **omits** locked reports. AC + EXPERIENCE require: absent **or** shown with access requirement — **never fail after click**. Prefer **show locked with `accessRequirementFa` / disabledReason** (aligns 9.1 template honesty + mockup locked rail). Soft-omit alone is insufficient for the AC wording. |
| **Explicit run vs auto-query** | Today run fires whenever `effectiveKey` + applied filters exist. AC requires a **run action**. Selection/params may hydrate URL; **result** loads only after explicit «اجرا» (or after opening a URL that already encodes a completed run intent — see URL contract below). Do not surprise-run on every keystroke. |
| **URL identity vs filter state** | Path segments = subject (+ optional report key). Query = evaluationMode, asOf, teamId, rangeStart, rangeEnd (and `run=1` or equivalent if distinguishing “selected” vs “executed”). Next.js 15+/16: `params` / `searchParams` are **Promises** on server pages — await them. Client updates via `useRouter` + `URLSearchParams` preserving other keys. |
| **Metadata chrome vs table toolbar** | Result area must show **as-of · last calculation · row count** as run metadata (mock `meta-run`). lastCalc already exists on run payload; surface **row count** explicitly (Persian digits / tabular). |
| **Presentation/IA over domain** | Epic 5 current vs as-of, Effective-Date ranges, PopulationPort ∩ InferenceBulk, suppressed cohort copy — **unchanged**. No new AR-\* keys. No Prisma/SQL in `apps/web`. |
| **Charts / metric cards** | Mock shows metric cards + chart. **Story 9.10 / UX-DR40** owns visual quality. 9.5 may keep existing table result; do **not** invent chart SoT or claim matrix chart completeness. |
| **StatusMessage / raw alerts** | First-touch: replace raw `<p role=alert|status>` error/status blocks in rewritten reports UI with **FeedbackMessage**. |

## Acceptance Criteria

1. **Given** the approved launch report catalogue  
   **When** the report workspace is implemented  
   **Then** section tabs group reports by subject: **نیروی انسانی · سازمان · رویدادها · ظرفیت و جذب · ورود داده**

2. **And** each tab shows a **catalogue rail** with report names and **one-line purposes**, a **parameters strip**, a **run action**, and a **result area**

3. **And** report selection and parameters are reflected in the **URL** so a run is shareable and re-openable

4. **And** the result shows run metadata: **as-of date**, **last calculation time**, and **row count**

5. **And** export follows **FR41** and **FR52** unchanged, including reauth and custody rules (reuse `ExportArtifactPanel` / Story 6.5 path)

6. **And** a report the caller may not run **states its access requirement** rather than failing after the click (locked rail item; run disabled)

7. **And** current versus as-of semantics from Epic 5 are **unchanged** (filters, range keys, team intersect, outcomes: allowed/empty/suppressed/pending/unavailable/omitted)

8. **And** Epic 8 / Epic 9 encode held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - First-touch FeedbackMessage / PageHeader / EntityPicker; no StatusMessage clones; no UUID entity inputs
   - Matrix **Reports workspace** → Result **`pass`** with honest note (structure/IA; charts deferred to 9.10)
   - AR-\* fail-closed; presentation/IA only

9. **And** scope boundaries:
   - Does **not** invent new report metrics or drop FR-36 launch keys
   - Does **not** implement chart visual quality (9.10) or drill-through (9.7)
   - Does **not** add saved/personal report filters (PRD deferred)
   - Does **not** rewrite export governance, decision-publication rules, or assembleReportRun
   - Does **not** silently close Epic 7/8 production-honesty / security carry-ins

## Tasks / Subtasks

- [x] Task 1: Register گزارش‌ها section-tabs IA (AC: #1, #8)
  - [x] UPDATE `apps/web/lib/section-tab-surfaces.ts` — add surface:
    - `root: "/reports"`, `surfaceLabel: "گزارش‌ها"`, `ariaLabel: "بخش‌های گزارش‌ها"`
    - Tabs (labels exact Persian; hrefs English path segments):
      | id | label | href |
      | --- | --- | --- |
      | `personnel` | نیروی انسانی | `/reports/personnel` |
      | `organization` | سازمان | `/reports/organization` |
      | `events` | رویدادها | `/reports/events` |
      | `capacity` | ظرفیت و جذب | `/reports/capacity` |
      | `data-entry` | ورود داده | `/reports/data-entry` |
    - `defaultTabId: "personnel"`
  - [x] REFACTOR `app/(app)/reports/page.tsx` → index: `auth` + `assertPageAccess(role, "/reports")` + `redirect(defaultTabHref(SURFACE))` (mirror `headcount/page.tsx`)
  - [x] NEW `app/(app)/reports/(tabs)/layout.tsx` — `SurfaceSectionTabsLayout` with purpose:  
    `کاتالوگ گزارش‌های تأییدشدهٔ راه‌اندازی — انتخاب بر اساس موضوع، سپس پارامتر و اجرا.`  
    (Match EXPERIENCE / mock; refresh stale “خروجی در ۶٫۵” copy.)
  - [x] NEW thin tab pages under `(tabs)/{personnel|organization|events|capacity|data-entry}/[[...slug]]/page.tsx` — each mounts shared workspace with `subject` prop (catch-all for shareable report key path)
  - [x] UPDATE `route-announcer.tsx` if needed so nested `/reports/*` announce surface + tab coherently
  - [x] Keep sidebar `navigation.ts` href `/reports` (prefix access already allows `/reports/*`) — do **not** invent parallel nav entries

- [x] Task 2: Subject metadata on catalogue (AC: #1–#2, #6)
  - [x] UPDATE `packages/modules/reporting/src/report-catalogue.ts`:
    - Extend `ReportDefinitionHook` with `subject: ReportSubject` and `purposeFa: string` (one-line)
    - `ReportSubject` = `"personnel" | "organization" | "events" | "capacity" | "data-entry"`
    - Canonical key → subject mapping (do not invent extra keys):

      | Subject | Keys |
      | --- | --- |
      | personnel | `active_persons`, `all_persons`, `distributions` |
      | organization | `org_state`, `team_membership_manager` |
      | events | `starts`, `terminations`, `transfers`, `role_grade_compensation_changes`, `scheduled`, `corrected_cancelled_reversed` |
      | capacity | `headcount_approvals_capacity`, `overrides` |
      | data-entry | `import_batch_outcomes` |

    - Write honest one-line `purposeFa` per key (operator-facing; not internal ids)
  - [x] UPDATE `apps/web/src/server/report.ts` catalogue response:
    - Return **all** launch defs visible to the surface, each with `{ key, titleFa, purposeFa, subject, runnable: boolean, accessRequirementFa?: string }`
    - When caps fail: `runnable: false` + Persian requirement (e.g. نیازمند دسترسی: خواندن سازمان / جبران خدمت / تأیید ظرفیت) — **do not** omit if AC path chooses show-locked
    - Keep `run` path fail-closed (unauthorized run still denied server-side — UI must not enable click-to-fail)
  - [x] Add/adjust package selfcheck if catalogue shape is asserted today (`requireLaunchReportCatalogue` already guards keys)

- [x] Task 3: Report workspace host — rail · params · run · result (AC: #2–#7)
  - [x] REFACTOR `report-catalogue-panel.tsx` → workspace host (rename optional e.g. `report-workspace.tsx`; update imports):
    - **Catalogue rail** (vertical list preferred — mock): name + purpose; selected state; locked items `disabled` + `accessRequirementFa` / FeedbackMessage pattern; `role="listbox"` or keep radiogroup with clear labels
    - **Parameters strip**: reuse `ReportFilters` fields; primary gold/primary «اجرا»; secondary «خروجی اکسل» only when export snapshot exists (or keep export in result `exportSlot` — do not duplicate two divergent export SoTs; prefer existing `ExportArtifactPanel` binding)
    - **Explicit run**: `enabled` query only when URL/run intent says execute (e.g. `run=1` after button, or router push that sets it). Changing params clears stale result / clears `run` flag until next اجرا
    - **Result area**: GovernedDataTable as today for `allowed`; FeedbackMessage for suppressed/empty/pending/unavailable/error/omitted (replace raw `<p>`)
    - **Run metadata row**: as-of (from run payload / applied mode), `lastCalculatedAt`, **row count** (`rows.length` or server-provided count — Persian tabular digits)
    - Preserve decision publication panel after successful allowed run
    - Preserve leave-guard navigation for reconcile hrefs
  - [x] Prop `subject: ReportSubject` filters rail to that subject’s keys only
  - [x] Default selection: first **runnable** report in subject (or URL-selected key if valid for subject)

- [x] Task 4: URL contract — shareable selection + parameters (AC: #3)
  - [x] Canonical shape (identity vs state):
    - Path: `/reports/{subject}` and optionally `/reports/{subject}/{reportKey}` **or** `?report={key}` — pick **one** and document in Dev Notes; prefer path report key when it keeps `activeTabForPath` working (`pathname.startsWith(tab.href)` already supports deeper segments)
    - Query (examples): `evaluationMode=current|as_of`, `asOf=YYYY-MM-DD`, `teamId=`, `rangeStart=`, `rangeEnd=`, `run=1`
  - [x] On mount: hydrate selection + filter draft from URL; if `run=1` and key runnable → execute
  - [x] On select report / apply params / اجرا: `router.replace` or leave-guard-aware navigate preserving unrelated params
  - [x] Invalid key for subject → FeedbackMessage + fall back to default runnable; do not 500
  - [x] Server pages: if reading `params`/`searchParams`, **await** (Next 16 / Promise contract)

- [x] Task 5: Design-QA / DoD / honesty (AC: #5, #8–#9)
  - [x] NEW optional `reports-ia.selfcheck.ts` (structural: SECTION_TAB_SURFACES has `/reports` + 5 tabs; workspace not flat page) — wire into design-qa or package script if cheap
  - [x] UPDATE `design-qa-mockup-matrix.md` Reports row → `pass`; note “9.5 subject tabs + rail/params/run/meta/export; charts → 9.10”
  - [x] First-touch FeedbackMessage on rewritten surface; EntityPicker remains for team
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green
  - [x] `@divan/web` typecheck; eslint on touched files
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits
  - [x] Do not weaken `@divan/reporting` / export selfchecks

### Manual DoD checklist

- [x] `/reports` redirects to `/reports/personnel` (or defaultTabHref) after access check
- [x] Five subject tabs visible with exact Persian labels; URL reflects active tab
- [x] Each tab’s rail lists only that subject’s reports with one-line purposes
- [x] Locked report shows access requirement; cannot run; no post-click failure theater
- [x] Selecting report + setting params updates URL; pasting URL restores selection/params
- [x] «اجرا» loads result; metadata shows as-of, last calculation, row count (Persian digits)
- [x] Export still uses ExportArtifactPanel with reauth/custody (smoke one allowed run)
- [x] current vs as_of + range-required event keys behave as Epic 5
- [x] Decision publication still available after allowed run (if previously visible)
- [x] `selfcheck:design-qa` green; matrix Reports = pass; no chart-completeness claim
- [x] No Prisma in `apps/web`; no new AR-\*; headcount/bulk/migration untouched

### Review Findings

- [x] [Review][Patch] Cross-subject launch key not treated as invalid-for-subject — `reportKeyFromPathname` only checks `isLaunchReportKey`; workspace sets `invalidPathKey` only when segment is non-key; hydrate never repairs; with `run=1` the default runnable for the tab can execute under the wrong URL (AC3 / Task 4) [`apps/web/lib/report-url.ts:23`]
- [x] [Review][Patch] Stale run status/error shown when `runIntent` is false — `statusMessage` and `runQuery.error` are not gated by `runIntent`, so cached react-query data/errors remain beside the «اجرا را بزنید» prompt [`apps/web/components/reports/report-workspace.tsx:510`]
- [x] [Review][Patch] Locked catalogue rail items use `aria-disabled` but not `disabled` — spec requires locked items `disabled` + access requirement; keyboard/AT still focus and activate radios that only early-return in `onClick` [`apps/web/components/reports/report-workspace.tsx:412`]
- [x] [Review][Patch] Stale «catalogue soft-omits» comments on `requires*` fields — server now returns locked+`accessRequirementFa`; comments still describe soft-omit [`packages/modules/reporting/src/report-catalogue.ts:46`]

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Five subject section tabs under `/reports` | Leave flat single-page catalogue |
| Catalogue rail + purpose + params + explicit run + result meta | Auto-run-only UX without run action / URL |
| Show access requirement for non-runnable reports | Soft-omit-only if it violates “states its access requirement” |
| Reuse `report.run` + ExportArtifactPanel | Reimplement assemble/export/reauth |
| Preserve Epic 5 temporal/filter semantics | Change as-of / range / team-intersect rules |
| `selfcheck:design-qa` green; matrix pass for structure | Claim 9.10 chart polish or 9.7 drill-through done |
| FeedbackMessage on first-touch | Raw alert `<p>` / StatusMessage clones |

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `app/(app)/reports/page.tsx` | Flat host; no assertPageAccess | Index redirect + assertPageAccess | Auth session redirect to login |
| `lib/section-tab-surfaces.ts` | No `/reports` | Add 5-tab surface | Existing 5 surfaces untouched |
| `components/reports/report-catalogue-panel.tsx` | Card grid; auto-run; React state | Workspace rail/params/run/URL/meta/FeedbackMessage | GDT + exportSlot + publication |
| `components/reports/report-filters.tsx` | Shared filter strip | Embed in params strip; possibly expose run CTA via parent | EntityPicker; evaluationMode; ranges |
| `packages/modules/reporting/src/report-catalogue.ts` | Keys + titles + caps | + subject + purposeFa | Launch key set; range/team helper sets |
| `apps/web/src/server/report.ts` | Soft-omit catalogue | Full list + runnable + accessRequirementFa | runGovernedRetrieval; softHas* caps; error mapping |
| `lib/design-qa-mockup-matrix.md` | Reports `amendment` | → `pass` + honest note | Other rows |
| `components/route-announcer.tsx` | `"/reports": "گزارش‌ها"` | Nested announce if needed | Other routes |
| `section-tabs.tsx` / `surface-section-tabs-layout.tsx` | Stable 4b.2 | Prefer **unchanged** | Leave-guard Links |

### Recommended NEW files

| File | Role |
| --- | --- |
| `app/(app)/reports/(tabs)/layout.tsx` | SurfaceSectionTabsLayout + purpose |
| `app/(app)/reports/(tabs)/personnel/page.tsx` (etc. ×5) | Thin subject hosts |
| `components/reports/report-workspace.tsx` | Optional extract if panel rename clarifies |
| `components/reports/reports-ia.selfcheck.ts` | Structural IA gate |
| `lib/report-url.ts` (optional) | Encode/decode URL ↔ filter + key helpers |

### Subject → key mapping (authoritative for this story)

```
personnel:     active_persons, all_persons, distributions
organization:  org_state, team_membership_manager
events:        starts, terminations, transfers, role_grade_compensation_changes,
               scheduled, corrected_cancelled_reversed
capacity:      headcount_approvals_capacity, overrides
data-entry:    import_batch_outcomes
```

### Domain / API cheat-sheet (call — do not reimplement)

```
report.catalogue()  → enrich: purposeFa, subject, runnable, accessRequirementFa
report.run({ reportKey, teamId?, evaluationMode, asOfDate?, rangeStart?, rangeEnd? })
  → asOf, lastCalculatedAt, rows, columns, outcome, messageFa, exportSnapshotHash, reconcileHref?
export.* / ExportArtifactPanel  → FR41/FR52 unchanged (create + download reauth)
decision publication panel     → bind to reviewed snapshot after allowed run
```

Permissions / caps already used (do not invent strings): organization.read, headcount approval read, compensation.read, person.read — mirror existing `softHas*` / `actorHasCompensationRead` helpers in `report.ts`.

### URL contract (implemented)

| Piece | Location | Example |
| --- | --- | --- |
| Subject | path | `/reports/events` |
| Report key | path segment (chosen over `?report=`) | `/reports/events/starts` |
| Filters | searchParams | `?evaluationMode=as_of&asOf=2026-07-01&teamId=…&rangeStart=…&rangeEnd=…` |
| Executed | searchParams | `&run=1` |

Helpers: `apps/web/lib/report-url.ts`. Shareable = open URL → same subject tab + selected report + filters + (if `run=1`) automatic result fetch. Selecting another report or changing filters drops `run` until user presses اجرا again.

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Next.js 16 App Router | Nested `(tabs)` route group; await `params`/`searchParams` on server; client `useRouter` + `useSearchParams` / `usePathname` for sync |
| Section tabs 4b.2 | Nested path segments — **not** `?tab=` / hash for subject |
| tRPC 11 | Continue `api.report.*`; no Prisma in web |
| GovernedDataTable | Keep preferencesKey per report key; sticky identifier |
| FeedbackMessage / EntityPicker | Epic 8 first-touch mandatory on rewritten surface |
| Design-QA | Mandatory green before baseline claim |

### Testing requirements

| Check | Command / method |
| --- | --- |
| Design-QA gate | `pnpm --filter @divan/web selfcheck:design-qa` |
| Types / lint | `@divan/web` typecheck; eslint touched files |
| Reporting module | Existing catalogue/run selfchecks remain green; extend if subject fields asserted |
| Operational copy | Add keys for new access-requirement / purpose strings if not inline from catalogue |
| Manual | DoD checklist |
| Export smoke | One allowed run → export panel still functions |

### Previous story intelligence

**From 9.4 (done, baseline `b33345b`):** Mirror root redirect + `(tabs)/layout` + `SECTION_TAB_SURFACES`. Thin pages; fat client hosts. Presentation/IA only. Mandatory `selfcheck:design-qa`. Matrix honesty — do not claim report/chart completeness from headcount work. BOM-safe yaml. FeedbackMessage discipline. Carry-forward named reports subject tab «ظرفیت و جذب».

**From 9.1–9.3:** Dual-entry «ورود داده» ≠ «ورود گروهی»; denied visibility prefers show + reason over silent omit for catalogues; shared host pattern; PageHeader/purpose lines.

**From Epic 8 retro / 9.1 gate:** First-touch EntityPicker / RowActionButton / FeedbackMessage; amendment rows are work-to-close (Reports row is **this** story); AR-\* fail-closed; Epic 9 presentation/IA over unchanged domain.

**From 5.5 / 6.5:** Launch catalogue + run pipeline + export artifact panel are the SoT. Import batch report may still surface unavailable messaging when evidence missing — keep honesty; do not fabricate batch outcomes.

**Review patterns from 9.4:** Decision/Patch/Defer; catch mutateAsync; FeedbackMessage for loading/errors; no bare UUID primary cells; focus return where dialogs/drawers appear (N/A unless you add drawers).

### Git intelligence summary

Recent commits: `b33345b` story 9.4 → `112209e` 9.3 → `cb20355` 9.2 → `cf65a86` 9.1 → `d219310` epic 8 retro. Pattern: thin `apps/web` IA/restructure stories; domain stays in `packages/modules/*`; selfcheck + matrix honesty; extract shared hosts; no domain rule churn.

### Project structure notes

- UI under `apps/web/components/reports/` + thin routes under `app/(app)/reports/(tabs)/`
- Catalogue metadata lives in `@divan/reporting` (`report-catalogue.ts`) — web must not hardcode divergent subject maps
- Module boundary AD-3: web → tRPC only; no `@prisma/client` in `apps/web`
- Reporting governed by AD-2 (projections/temporal) + AD-5 (authz + audit-envelope)

### Latest tech information

- **Next.js 15+/16:** `params` and `searchParams` are Promises in Server Components — always `await` (or `Promise.all`). Use **params for identity** (subject / report key) and **searchParams for filter state** (evaluationMode, dates, team, run flag).
- Prefer nested path segments for section tabs (existing Divan convention) over parallel `@slot` routes — do **not** introduce parallel routes for this workspace.
- Client URL updates: clone `URLSearchParams`, set/delete keys, `router.replace(`${pathname}?${qs}`)` to avoid history spam; use leave-guard `requestNavigation` when dirty (params draft dirty ≠ executed result).

### Project context reference

No `project-context.md` found in repo at story creation; follow Architecture Spine AD-3/AD-5 and UX 2026-07-31 spines as forward contract.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9 / Story 9.5 / UX-DR33]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-36, FR-41, FR-52, FR-59]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — گزارش‌ها IA + report surface]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — page-header / section-tabs]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/screens-reports-capacity.html` — §۱ reports workspace]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — reporting module, AD-3/AD-5]
- [Source: `_bmad-output/implementation-artifacts/9-4-capacity-hiring-ia-restructure.md`]
- [Source: `_bmad-output/implementation-artifacts/5-5-launch-report-catalogue.md` / `6-5-governed-export-artifact-panel.md` (patterns)]
- [Source: `apps/web/app/(app)/reports/page.tsx`]
- [Source: `apps/web/components/reports/report-catalogue-panel.tsx`]
- [Source: `apps/web/lib/section-tab-surfaces.ts`]
- [Source: `apps/web/src/server/report.ts`]
- [Source: `packages/modules/reporting/src/report-catalogue.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- `pnpm --filter @divan/reporting selfcheck:report` — ok (subject/purposeFa asserted)
- `pnpm --filter @divan/web selfcheck:reports-ia` — ok
- `pnpm --filter @divan/web selfcheck:design-qa` — ok
- `pnpm --filter @divan/web typecheck` — ok
- eslint on touched files: pre-existing `eslint-module-utils/resolve` resolve failure in workspace (not introduced by this story)

### Completion Notes List

- Registered `/reports` as fifth section-tab surface with five exact Persian subject tabs; index redirects after `assertPageAccess`.
- Catalogue now returns full launch set with `subject`, `purposeFa`, `runnable`, and `accessRequirementFa` (show-locked); run remains fail-closed.
- New `ReportWorkspace` host: vertical rail · params strip with «اجرا» · explicit `run=1` URL intent · result meta (as-of / lastCalc / row count) · FeedbackMessage · ExportArtifactPanel + DecisionPublicationPanel preserved.
- URL contract: `/reports/{subject}/{reportKey}?evaluationMode&asOf&teamId&rangeStart&rangeEnd&run=1` via `lib/report-url.ts`.
- Matrix Reports workspace → `pass` (structure/IA; charts deferred to 9.10). `selfcheck:reports-ia` added.

### File List

- `_bmad-output/implementation-artifacts/9-5-reports-section-tabs-workspace.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/app/(app)/reports/page.tsx`
- `apps/web/app/(app)/reports/(tabs)/layout.tsx`
- `apps/web/app/(app)/reports/(tabs)/personnel/[[...slug]]/page.tsx`
- `apps/web/app/(app)/reports/(tabs)/organization/[[...slug]]/page.tsx`
- `apps/web/app/(app)/reports/(tabs)/events/[[...slug]]/page.tsx`
- `apps/web/app/(app)/reports/(tabs)/capacity/[[...slug]]/page.tsx`
- `apps/web/app/(app)/reports/(tabs)/data-entry/[[...slug]]/page.tsx`
- `apps/web/components/reports/report-workspace.tsx`
- `apps/web/components/reports/report-catalogue-panel.tsx`
- `apps/web/components/reports/report-filters.tsx`
- `apps/web/components/reports/reports-ia.selfcheck.ts`
- `apps/web/components/route-announcer.tsx`
- `apps/web/lib/report-url.ts`
- `apps/web/lib/section-tab-surfaces.ts`
- `apps/web/lib/design-qa-mockup-matrix.md`
- `apps/web/lib/control-contract.selfcheck.ts`
- `apps/web/lib/row-actions.selfcheck.ts`
- `apps/web/package.json`
- `apps/web/src/server/report.ts`
- `apps/web/src/server/decision-publication.selfcheck.ts`
- `packages/modules/reporting/src/report-catalogue.ts`
- `packages/modules/reporting/src/report.selfcheck.ts`
- `packages/modules/reporting/src/index.ts`

## Change Log

- 2026-08-02: Story context created (ready-for-dev) — ultimate context engine analysis completed.
- 2026-08-02: Implemented reports section-tabs workspace (rail/params/run/URL/meta/export); status → review.
- 2026-08-02: Code review patches applied (subject-scoped URL keys, runIntent-gated status, locked `disabled`, catalogue comments); status → done.

## Story completion status

Status: **done**  
Completion note: All tasks/ACs implemented; design-qa green; code-review patches applied.
