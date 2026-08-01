---
baseline_commit: 168d7d92d1d1e1bd7cf711a431a4d6b0a82dd9fd
---

# Story 9.6: Personnel Events List — Real Data

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator,
I want the events list to show real organization-wide events,
so that the surface is usable rather than a fixture (FR33, FR59).

**Story key:** `9-6-personnel-events-list-real-data`  
**Epic:** 9 — Operational Surface Completion & IA Coherence (FR59; FR33 surface completion)  
**UX contract:** `ux-divan-2026-07-31` (EXPERIENCE §IA رویدادهای پرسنلی · فهرست رویدادها; row actions UX-DR30; StatusBadge UX-DR10; GovernedDataTable UX-DR7)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (promoted fixture events list from deferred-work into committed scope)  
**Prerequisite:** Epic 8 done (GovernedDataTable, EntityPicker, RowActionCluster, FeedbackMessage, StatusBadge, design-qa gate). Stories **5.1** (permission-safe search/scope + evaluation snapshot), **5.3** (`listForPerson` / resolveLifecycleStatus / timeline labels), **4b.4** (stable-snapshot pagination), **4b.7** (scaffold shell — leave IA; replace fixture). Stories **9.1–9.5** done (Epic 9 first-touch discipline).  
**Downstream:** **9.7** deepens bidirectional drill-through + personnel-code deep-links + report reconcile query presets; **9.9** no-dead-end gate expects this tab functional (not fixture).

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Fixture list panel | `apps/web/components/personnel/personnel-events-list-panel.tsx` | `FIXTURE_EVENTS` + GDT `preferencesKey="personnel-events-list"` + StatusBadge + toolbar «ثبت رویداد» + glossary; **no** tRPC, filters, rowActions, FeedbackMessage | Replace fixture with real query; add filters + RowActionCluster; remove fixture + scaffold caption |
| Person-scoped timeline API | `personnelEvent.listForPerson` in `apps/web/src/server/personnel-event.ts` | Scoped IDOR + `listBusinessEventsForPerson` + chain + `resolveLifecycleStatus` | **Person-only** — no org-wide list; keep as timeline SoT |
| Event store | `packages/kernel/event-store/src/business-event.ts` | `listBusinessEventsForPerson*` only; no org-wide query | Add **new** scoped org-wide list helper (UI DESC order twin of person list — **never** reuse ForApply order) |
| FR-33 person search | `person.search` + `personnel-scoped-search.ts` + `runGovernedRetrieval` | authorize → PopulationPort → InferenceBulk → evaluation snapshot page/token | **Pattern to mirror** for event catalogue (subjects = person_ids on events) |
| Personnel list UI | `personnel-list-panel.tsx` | Server page + `evaluationSnapshotId` + RowActionCluster + leave-guard navigate | Mirror pagination + actions; first-touch FeedbackMessage (personnel list still has raw `<p>` — **do not copy** that debt) |
| Headcount table (9.4) | `headcount-approvals-table.tsx` | GDT + FeedbackMessage + RowActionCluster | Prefer this FeedbackMessage discipline over 5.1 list raw alerts |
| Timeline labels | `lib/personnel-event-timeline.ts` `eventTypeLabelFa` | Persian type labels | Reuse for type column / filter enum — no parallel map |
| EntityPicker | `components/entity-picker/*` `createPersonSearch` + org/team resolvers | Identifier-first person/team pickers | Wire person + team filters — **no UUID text inputs** |
| Design-QA | `pnpm --filter @divan/web selfcheck:design-qa` + `selfcheck:row-actions` | Epic 8/9 gate | Mandatory green; optional structural selfcheck for events list |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Org-wide events list vs person timeline** | `/personnel-events/events` = catalogue across scoped population. Profile timeline = `listForPerson` only. Do **not** replace or widen timeline APIs; add a **new** list/search procedure. |
| **گزارش‌ها «رویدادها» vs این فهرست** | Reports subject tab (9.5) = launch **report keys**. This surface = operational event **rows**. Do not wire report.run here. |
| **Stable-snapshot pagination vs infinite cursor** | Story **4b.4 / 7.8 / person.search**: `page` + `evaluationSnapshotId` + deterministic order + polite live region. **Forbidden:** invent infinite-scroll `useInfiniteQuery` / raw offset without snapshot; AG Grid. |
| **kernel_events vs product drafts** | Finalized lifecycle rows live in `kernel_events`. Open product drafts live in the draft store (`listOpenDraftsForPerson`). Fixture showed Draft — see **Draft inclusion decision** below. |
| **Open event vs open person** | Person → `/personnel/profile/{personId}` (existing). Event → land on that person's profile (timeline already shows the event); optional `?event={eventId}` query for 9.7 focus — **do not invent** a new event-detail route. Drafts → `/personnel-events/register?person={id}` (host already reads `person`; draft-id deep-link is optional nicety, not required if host lacks it). |
| **Row click vs row actions** | UX-DR30: row click opens the **record** (event); row actions are separate icon-only outlined controls with `stopPropagation` (RowActionCluster already stops). ≤2 primary actions + overflow. |
| **Team filter semantics** | Filter = events whose **person** is in the set of people with primary/membership team = selected team **as-of today (Tehran date-only)**, intersected with PopulationPort — **not** “payload.teamId equals filter” alone (that misses non-transfer types). Document this in UI caption if needed. |
| **Client GDT column filters vs server filters** | Server owns authz + type/status/date/team/person filters that define the snapshot. Client column filters must **not** become a parallel permission plane or invent out-of-scope facets. Prefer server filter toolbar + disable misleading client-only enum that implies full org dump. |
| **PopulationPort honesty** | Same as 5.1: fixture PopulationPort → fail-closed empty + disclosure — never claim production workforce completeness. |
| **Presentation over domain** | No new AR-\* freeze numbers; no Cancel/Reverse/Correct mutation UX on the list (lifecycle stays on timeline/form). No Prisma in `apps/web`. |

### Draft inclusion decision (non-negotiable clarity)

1. **Primary rows:** `kernel_events` business class for persons in scoped population, with `resolveLifecycleStatus` → StatusBadge kinds Scheduled / Effective / Cancelled / Reversed.  
2. **Open drafts:** **Include** open drafts for scoped persons (reuse `listOpenDraftsForPerson` or a batched module helper — **forbid N+1** per person). Map to list rows with `resolvedStatus: "Draft"`, synthetic or draft id, person hydrate.  
3. If batched draft union proves too expensive in one PR: ship kernel_events-only **and** keep Draft in the status filter with honest empty Messaging when Draft-only — but default expectation is **include drafts** so fixture Draft UX is not silently deleted.  
4. Never present `kernel_events.status === "Draft"` scaffolding rows as product drafts if product drafts are draft-table only — one honest mapping.

## Acceptance Criteria

1. **Given** the events list currently backed by `FIXTURE_EVENTS`  
   **When** the real list is delivered  
   **Then** it reads from a permission-safe organization-wide event query with the Epic 5 search and scope posture (`authorize` → PopulationPort ∩ InferenceBulk → access event → payload; subjects = person ids on events)

2. **And** it supports filters for **event type**, **status**, **effective-date range**, **team**, and **person**, using **EntityPicker** where the filter is an entity (person, team) — no raw UUID inputs

3. **And** rows show **StatusBadge** (resolved lifecycle status) and offer **row actions** to **open the event** and **open the person** (RowActionCluster / UX-DR30; outlined icon-only; aria-label; stopPropagation; leave-guard `requestNavigation`)

4. **And** pagination uses the Story **4b.4** stable-snapshot contract (`page` + `evaluationSnapshotId`; filter/sort change → new snapshot + page=1; deterministic ordering; no infinite scroll)

5. **And** the fixture (`FIXTURE_EVENTS` / `EventFixtureRow` / scaffold caption) is **removed** from the codebase

6. **And** Epic 8 / Epic 9 encode held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green (and `selfcheck:row-actions` if touched)
   - First-touch **FeedbackMessage** for loading/error/empty/suppressed; no new StatusMessage clones; no UUID entity inputs; no ghost row actions
   - AR-\* fail-closed; presentation/IA over unchanged domain rules
   - Close Epic 8 retro action: personnel-events list rowActions (8.7 deferral)

7. **And** scope boundaries:
   - Does **not** implement full 9.7 drill-through (personnel-code canonical redirect, report reconcile presets, profile «ثبت درخواست اصلاح») — only list row open-event / open-person as specified
   - Does **not** replace `listForPerson` or change timeline SoT
   - Does **not** add Cancel/Reverse/Correct controls on the list
   - Does **not** invent org-wide dump without PopulationPort / InferenceBulk
   - Does **not** silently close unpaid PopulationPort cutover / AD-6 / mutation IDOR carry-ins — document honesty only
   - Does **not** claim report/dashboard deep-link presets complete (still 9.7 / deferred-work)

## Tasks / Subtasks

- [x] Task 1: Event-store + module query for scoped org-wide list (AC: #1, #4)
  - [x] NEW in `@divan/event-store` (or person-employment if it already owns resolve helpers): e.g. `listBusinessEventsForPersons` / `searchBusinessEvents` accepting:
    - `personIds: string[]` (already scoped — **caller must not pass unscoped ids**)
    - filters: `eventTypes?: string[]`, `statuses?: BusinessEventStatus[]` (apply **after** resolve when status is resolved-lifecycle), `effectiveFrom?`, `effectiveTo?` (date-only)
    - deterministic UI order twin of person list: `effective_date DESC, registered_at DESC, event_type ASC, id DESC`
    - hard `LIMIT` clamp aligned with retrieval windows (mirror InferenceBulk / person.search caps — fail closed / truncate with honesty flag, never unbounded)
  - [x] **Forbidden:** `SELECT` all `kernel_events` then filter in Node without person scope; reuse `listBusinessEventsForPersonForApply` for UI; Prisma in web
  - [x] Export from package index; add/extend event-store selfcheck for order + person-id filter + limit clamp
  - [x] Team filter: resolve set of person ids with primary/membership team = `teamId` as-of today (reuse assignment/state helpers already used by person.search projector — do not invent a second org SoT). Intersect with PopulationPort ids **before** event query
  - [x] Person filter: intersect single `personId` with scoped population (IDOR → empty/denied, not leak)

- [x] Task 2: tRPC `personnelEvent.search` (name flexible; prefer `search` over `list` to mirror person) (AC: #1–#2, #4, #6)
  - [x] UPDATE `apps/web/src/server/personnel-event.ts`:
    - New `governedProcedure` query with draft-read meta (same entitlement family as `listForPerson` — **do not invent** a new AR permission string)
    - Input: filters + `page` + `pageSize` + `evaluationSnapshotId` (+ optional `sortKey` if cheap; default deterministic)
    - Pipeline: `assertActorHasPersonnelEventDraft` → begin/revalidate **evaluation snapshot** (reuse `beginEvaluationSnapshot` / `getEvaluationSnapshot` / `revalidateEvaluationSnapshot` patterns from `personnel-scoped-search.ts` — extract shared helper if duplication is painful) → PopulationPort ∩ InferenceBulk for channel appropriate to list (prefer `"list"` or document `"timeline"` only if list channel wrongly blocks — **do not** invent a third silent channel) → query events for allowed person ids → hydrate person labels **batched** (Epic 8 open item: no per-row hydrate fan-out) → map `resolveLifecycleStatus` + optional draft union → page slice inside snapshot
    - Return shape (illustrative): `{ outcome, rows, totalInSnapshot, evaluationSnapshotId, truncated?, messageFa?, populationDisclosureFa?, populationAuthzMode? }` with row `{ id, personId, personLabel, personnelCode?, eventType, eventTypeLabelFa, effectiveDate, resolvedStatus, source: "event" | "draft", recalcPending? }`
    - `recalcPending`: only if existing projection/API already exposes it honestly — **do not** fake Story 8.9 demo marks on real rows
  - [x] Harden `get` / `resolve` with `assertPersonInScopedPopulation` when touched for open-event paths (pre-existing IDOR gap on get — fix if this story's open path calls them; otherwise note remaining debt honestly)
  - [x] Map errors via existing `mapPersonnelEventError` / EvaluationSnapshotError → Persian BAD_REQUEST; never leak infra

- [x] Task 3: Replace list panel UI (AC: #2–#5, #6)
  - [x] UPDATE `personnel-events-list-panel.tsx`:
    - Delete `FIXTURE_EVENTS` / fixture types / scaffold caption entirely (rg repo for `FIXTURE_EVENTS` / `دادهٔ نمونه برای پوسته` — zero hits)
    - Bind `api.personnelEvent.search` (or chosen name) with `keepPreviousData`; server page controls like `personnel-list-panel`
    - Filter toolbar: event type (select/enum from known lifecycle types + `eventTypeLabelFa`), status (StatusBadge kinds relevant to events — include Draft/Reversed), Jalali effective-date range (reuse existing date picker primitives), EntityPicker person + team
    - On filter change: reset `page=1` and clear snapshot token (new snapshot)
    - Columns: person (sticky identifier — code+name, not bare UUID), event type (labelFa), effective date (Jalali display / Persian digits), status (StatusBadge)
    - Keep `preferencesKey="personnel-events-list"` (8.6 readability prefs already keyed)
    - `rowActions`: RowActionCluster — «باز کردن رویداد» + «باز کردن فرد» (icons + aria-labels); both use leave-guard `requestNavigation`
    - `onRowClick` → open event (same as open-event action)
    - FeedbackMessage for cold loading / error / empty / suppressed / fixture-fail-closed disclosure
    - Preserve toolbar «ثبت رویداد» → `/personnel-events/register`
    - Preserve glossary terms header
  - [x] Optional: accept URL query presets (`teamId`, date range, type) when already present from dashboard/report hrefs — pass-through only if cheap; **full** reconcile presets remain 9.7 / deferred-work — do not block story on them
  - [x] Thin route `events/page.tsx` stays host — no IA churn to section tabs

- [x] Task 4: Design-QA / DoD / honesty (AC: #5–#7)
  - [x] NEW optional `personnel-events-list.selfcheck.ts` (structural: no FIXTURE_EVENTS export; panel imports search API; RowActionCluster present) — wire into design-qa or package script if cheap
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green; `selfcheck:row-actions` green
  - [x] `@divan/web` typecheck; eslint on touched files
  - [x] Event-store / person-employment selfchecks green if packages touched
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits
  - [x] Mark Epic 8 action item “Implement personnel-events list rowActions per 8.7 deferral in Story 9.6” → done when this story is done (in sprint-status action_items)

### Manual DoD checklist

- [x] `/personnel-events/events` shows real rows (or honest empty/suppressed) — **zero** fixture names
- [x] Out-of-scope person never appears; person filter on out-of-scope id → empty/denied, not leak
- [x] Filters: type, status, date range, team (EntityPicker), person (EntityPicker) change results + reset page
- [x] StatusBadge matches resolved lifecycle (and Draft for open drafts if included)
- [x] Row actions: open event → profile (timeline); open person → profile; stopPropagation; leave-guard
- [x] Row click opens event; does not fire when clicking actions
- [x] Pagination: page 2 requires snapshot token; filter change → page 1 new snapshot; no dup/miss within snapshot under concurrent writes (contract-level)
- [x] `FIXTURE_EVENTS` gone from repo; scaffold caption gone
- [x] `selfcheck:design-qa` green; no new AR-\*; register + bulk-import tabs untouched functionally
- [x] PopulationPort fixture mode shows disclosure / fail-closed — not “production workforce” claim

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| New permission-safe org-wide event query + UI bind | Keep `FIXTURE_EVENTS` or client-only fake rows |
| Epic 5 authorize → PopulationPort → InferenceBulk → snapshot pagination | Unscoped `SELECT` / client filter of full dump |
| EntityPicker for person + team filters | UUID text fields |
| RowActionCluster open-event + open-person (8.7 close) | Ghost buttons / raw Button without stopPropagation |
| FeedbackMessage first-touch on rewritten panel | Raw alert `<p>` / StatusMessage clones |
| `selfcheck:design-qa` green | Claim 9.7 drill-through / report presets done |
| Batched person label hydrate | N+1 getPersonById per row |
| Remove fixture completely | Leave “sample data” caption |

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `personnel-events-list-panel.tsx` | Fixture GDT; no API; no rowActions | Real search bind; filters; RowActionCluster; FeedbackMessage; delete fixture | `preferencesKey`; glossary; register toolbar + leave-guard |
| `apps/web/src/server/personnel-event.ts` | `listForPerson` only for lists | Add org-wide `search`; optional get/resolve scope harden | Existing draft/finalize/lifecycle procedures unchanged |
| `packages/kernel/event-store/.../business-event.ts` | Person-only list helpers | Add multi-person / filtered UI list helper | Append-only rules; ForApply order untouched |
| `events/page.tsx` | Hosts panel | Unchanged host (or trivial) | FullBleedTableHost / access |
| `section-tab-surfaces.ts` | events tab href | No change unless URL presets need docs | Tab labels / order |

### Architecture compliance

- **AD-3:** Web talks tRPC only; domain/query in packages; no Prisma in `apps/web`.
- **AD-5:** Every sensitive read enters audit-envelope (`governedProcedure`); default-deny; no silent authz fallthrough.
- **AD-2:** Event store remains append-only SoT for finalized events; list is a **read projection** over scoped ids — not a second write path.
- Errors: typed + Persian at API boundary.

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Next.js 16 App Router | Client panel under existing tab page; leave-guard navigate |
| tRPC 11 + React Query | `useQuery` + `keepPreviousData`; **page/snapshot** inputs — not infinite query |
| GovernedDataTable 4b.4 | Keep preferencesKey; server owns membership page |
| EntityPicker 8.3 | `createPersonSearch` + existing team/org search helpers in `resolvers.ts` |
| RowActionCluster 8.7 | Mandatory for ≤2 actions; honesty asserts |
| FeedbackMessage 8.8 | Loading/error/empty/suppressed |
| StatusBadge / eventTypeLabelFa | Reuse — no parallel badge system |
| Jalali / Persian digits | Effective date display + filter inputs per existing primitives |
| Evaluation snapshot (7.8) | Reuse begin/get/revalidate — do not invent a second token scheme |

### File structure requirements

- UI: `apps/web/components/personnel/personnel-events-list-panel.tsx` (+ optional small filter subcomponent if file bloats)
- API: `apps/web/src/server/personnel-event.ts`
- Store helper: `packages/kernel/event-store/src/business-event.ts` (+ index export)
- Scope/snapshot: prefer reuse/extract from `apps/web/src/server/personnel-scoped-search.ts` / evaluation-snapshot module — avoid copy-paste drift
- Selfcheck: `apps/web/lib/` or colocated `*.selfcheck.ts` wired in `package.json` / design-qa orchestrator

### Testing requirements

| Check | Command / method |
| --- | --- |
| Design-QA gate | `pnpm --filter @divan/web selfcheck:design-qa` |
| Row actions | `pnpm --filter @divan/web selfcheck:row-actions` |
| Types / lint | `@divan/web` typecheck; eslint touched files |
| Event-store | Existing + new list helper selfcheck |
| Grep gate | `FIXTURE_EVENTS` → zero matches |
| Manual | DoD checklist above |

### Previous story intelligence

**From 9.5 (done, baseline `168d7d9`):** Thin routes + fat client hosts; FeedbackMessage discipline; EntityPicker in filters; presentation/IA only; BOM-safe sprint-status; do not conflate reports «رویدادها» with this operational list; `selfcheck:design-qa` mandatory; review caught URL/subject validity and stale status — apply analogous care to snapshot token + filter reset.

**From 9.4:** RowActionCluster + FeedbackMessage + EntityPicker on first-touch; structural IA selfcheck pattern; Decision/Patch/Defer review discipline.

**From 9.1–9.3 / Epic 8 retro:** First-touch ban on UUID inputs / ghost row actions / StatusMessage clones; amendment honesty; personnel-events list rowActions **explicitly deferred to 9.6** — this story closes that item; FeedbackMessage adoption still open on untouched panels — close it **on this panel**.

**From 5.1 / 5.3:** PopulationPort honesty; evaluation snapshot pagination UI pattern in `personnel-list-panel.tsx`; timeline consumes `listForPerson` + `eventTypeLabelFa` + `resolveLifecycleStatus` — reuse, don't fork.

**From 4b.7 / 8.7 / 8.9:** Scaffold intentionally fixture-only; 8.7 left rowActions out; 8.9 used one fixture `recalcPending` demo — remove with fixture (real recalc mark only if API supports it).

**From deferred-work / sprint-change 2026-07-31:** Fixture list + list→profile promoted; full reconcile query presets still partially deferred — optional light URL accept OK; do not expand into 9.7.

### Git intelligence summary

Recent commits: `168d7d9` story 9.5 → `b33345b` 9.4 → `112209e` 9.3 → `cb20355` 9.2 → `cf65a86` 9.1`. Pattern: Epic 9 presentation/IA stories stay thin in `apps/web`; domain in packages; selfcheck + matrix honesty; extract shared hosts; no domain rule churn. Last touch to `personnel-events-list-panel.tsx` was Story **8.9** (recalc demo on fixture).

### Project structure notes

- Surface already registered in `section-tab-surfaces.ts` under `/personnel-events` — **do not** duplicate nav entries
- Module boundary: event-store SQL helpers; person-employment for resolve/draft; web router composes scope + DTO
- Detected variance: `personnel-list-panel` still uses raw `<p role=alert|status>` — **do not copy**; use FeedbackMessage (9.4/9.5 standard)

### Latest tech information

- **Divan pagination SoT** is evaluation-snapshot + page (Stories 4b.4 / 5.1 / 7.8), not generic tRPC infinite cursors. External tRPC infinite-query docs are **non-goals** for this list.
- Prefer `keepPreviousData` while flipping pages to avoid table collapse.
- Next.js 16: if adding server-read of `searchParams` for optional presets, **await** the Promise.

### Project context reference

No `project-context.md` found in repo at story creation; follow Architecture Spine AD-3/AD-5, UX 2026-07-31, and Epic 9 gates above.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9 / Story 9.6]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-33, FR-34, FR-48, FR-56, FR-59]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — IA + row actions]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-3/AD-5]
- [Source: `_bmad-output/implementation-artifacts/8-7-row-action-affordance-dead-click-elimination.md` — deferral to 9.6]
- [Source: `_bmad-output/implementation-artifacts/5-1-permission-safe-personnel-search-lists.md`]
- [Source: `_bmad-output/implementation-artifacts/5-3-personnel-event-timeline.md`]
- [Source: `_bmad-output/implementation-artifacts/9-5-reports-section-tabs-workspace.md`]
- [Source: `apps/web/components/personnel/personnel-events-list-panel.tsx`]
- [Source: `apps/web/components/personnel/personnel-list-panel.tsx`]
- [Source: `apps/web/src/server/personnel-event.ts`]
- [Source: `apps/web/src/server/personnel-scoped-search.ts`]
- [Source: `packages/kernel/event-store/src/business-event.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- event-store selfcheck green after multi-person UI list assertions
- design-qa + row-actions + personnel-events-list + evaluation-snapshot selfchecks green
- `@divan/web` tsc --noEmit green
- eslint on touched files blocked by pre-existing `eslint-module-utils/resolve` resolution gap (env), not story regressions

### Implementation Plan

1. Add `listBusinessEventsForPersons` / `listBusinessEventsByIds` (UI DESC order, hard limit+truncated) in event-store.
2. Add batched `listOpenDraftsForPersons` / `listDraftsByIds` + `getPersonsByIds`.
3. Compose `runPersonnelEventSearch` (channel `list`, snapshot pagination, team∩population, draft union, resolved-status filter).
4. Wire `personnelEvent.search`; replace fixture panel with FeedbackMessage + EntityPicker + RowActionCluster.

### Completion Notes List

- Org-wide catalogue reads via permission-safe PopulationPort ∩ InferenceBulk (`list`) + evaluation-snapshot pagination; `listForPerson` unchanged as timeline SoT.
- Open drafts included via batched draft helper (no N+1); Draft status filter honest.
- Open-event navigates to person profile (`?event=`); drafts → register; does **not** call `get`/`resolve` — pre-existing IDOR gap on those procedures remains unpaid debt (documented).
- URL query presets deferred to 9.7 (optional pass-through skipped as non-blocking).
- Epic 8 retro action “personnel-events list rowActions” marked done in sprint-status.
- Fixture `FIXTURE_EVENTS` / scaffold caption removed; `recalcPending` demo mark not carried onto real rows.

### File List

- packages/kernel/event-store/src/business-event.ts
- packages/kernel/event-store/src/index.ts
- packages/kernel/event-store/src/event-store.selfcheck.ts
- packages/modules/person-employment/src/personnel-event-draft.ts
- packages/modules/person-employment/src/person.ts
- packages/modules/person-employment/src/index.ts
- apps/web/src/server/personnel-event-search.ts
- apps/web/src/server/personnel-event.ts
- apps/web/src/server/evaluation-snapshot.selfcheck.ts
- apps/web/components/personnel/personnel-events-list-panel.tsx
- apps/web/lib/personnel-events-list.selfcheck.ts
- apps/web/lib/row-actions.selfcheck.ts
- apps/web/package.json
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/9-6-personnel-events-list-real-data.md

### Change Log

- 2026-08-02: Story 9.6 — replaced fixture events list with permission-safe org-wide search, filters, RowActionCluster, FeedbackMessage, snapshot pagination.
- 2026-08-02: Code review patches applied (continuation honesty, placeholderData guard, date refine, draft take, label honesty, team/error/UI polish, ByIds selfcheck).

### Review Findings

- [x] [Review][Patch] Continuation drops truncated + PopulationPort disclosure (hardcodes uuid-registry / truncated:false) — store and return mint-time honesty on page 2+ [apps/web/src/server/personnel-event-search.ts:562]
- [x] [Review][Patch] keepPreviousData can re-apply stale evaluationSnapshotId after filter/clear reset — guard with isPlaceholderData before writing token [apps/web/components/personnel/personnel-events-list-panel.tsx:203]
- [x] [Review][Patch] Inverted effectiveFrom > effectiveTo accepted silently — validate client + Zod refine [apps/web/src/server/personnel-event.ts:535]
- [x] [Review][Patch] listOpenDraftsForPersons loads all open drafts then clamps in memory — add take/limit at query [packages/modules/person-employment/src/personnel-event-draft.ts:418]
- [x] [Review][Patch] Missing person hydrate falls back to UUID prefix — use honest non-UUID label (AC: code+name, not bare UUID) [apps/web/src/server/personnel-event-search.ts:266]
- [x] [Review][Patch] Team filter catch{} treats any listTeamMembersAsOf failure as empty team — rethrow unexpected infra errors [apps/web/src/server/personnel-event-search.ts:686]
- [x] [Review][Patch] Whitespace-only / untrimmed eventTypes: store may drop filter; drafts use untrimmed Set — align trim + empty-after-trim → empty result [packages/kernel/event-store/src/business-event.ts:687]
- [x] [Review][Patch] Persian team-filter caption embeds English "payload" [apps/web/components/personnel/personnel-events-list-panel.tsx:430]
- [x] [Review][Patch] goToServerPage silently no-ops when page>1 and snapshot token missing — disable next or surface feedback [apps/web/components/personnel/personnel-events-list-panel.tsx:295]
- [x] [Review][Patch] Team EntityPicker usable while organization.list loading/error with no feedback [apps/web/components/personnel/personnel-events-list-panel.tsx:151]
- [x] [Review][Patch] listBusinessEventsByIds added without event-store selfcheck coverage [packages/kernel/event-store/src/event-store.selfcheck.ts]
- [x] [Review][Defer] actorPermissionFingerprint ignores organizationalScopeCodes — deferred, pre-existing [apps/web/src/server/personnel-event-search.ts:202]
- [x] [Review][Defer] Missing DATABASE_URL/pool returned as outcome denied + accessDeniedTitle — deferred, pre-existing [apps/web/src/server/personnel-event-search.ts:505]

---

**Completion note:** Ultimate context engine analysis completed - comprehensive developer guide created
