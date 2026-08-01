---
baseline_commit: d6e6814
---

# Story 9.7: Profile Access & Cross-Surface Drill-Through

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As any authorized user,
I want to move between a person, their events, and the numbers that reference them,
so that I can follow a question to its answer without retyping anything (FR34, FR59).

**Story key:** `9-7-profile-access-cross-surface-drill-through`  
**Epic:** 9 — Operational Surface Completion & IA Coherence (FR59; FR34 surface completion)  
**UX contract:** `ux-divan-2026-07-31` (EXPERIENCE §IA cross-surface drill-through bidirectional; Key Flow ۴ contextual «ثبت درخواست اصلاح»; Empty — not permitted; Identifier Model code+name; UX-DR6/8/9/28/30)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (row→profile, personnel-code deep-link + canonical redirect, dashboard/report reconcile → filtered detail)  
**Prerequisite:** Stories **5.1–5.5** (search, profile, timeline, dashboard, reports), **7.5** (correction cases), **8.x** primitives, **9.5** (shareable report URLs), **9.6** (real events list + open-event/open-person + `?event=`).  
**Downstream:** **9.8** owns «اصلاح اطلاعات» rename + purpose line + broader governance discoverability (this story only ships the **profile contextual CTA**); **9.9** no-dead-end gate expects these paths functional.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Profile page | `app/(app)/personnel/profile/[personId]/page.tsx` | UUID-only gate; `assertPersonInScopedPopulation`; hosts `PersonProfileView` | Rejects non-UUID → list; no code deep-link; no not-permitted surface for page-level deny paths that should explain |
| Profile view | `components/personnel/person-profile-view.tsx` | Sections + embedded timeline; link back to list | No `?event=` focus; no «ثبت درخواست اصلاح» CTA |
| Timeline | `personnel-event-timeline.tsx` + `event-timeline-row.tsx` | `listForPerson` + lifecycle controls | No event-id anchor / highlight; no outbound “open in events list” needed if in-page focus works |
| Events list (9.6) | `personnel-events-list-panel.tsx` | Real search; `profileHref(personId, eventId?)` with `?event=`; RowActionCluster | Does **not** hydrate URL filter presets (`teamId`, dates, type) |
| Personnel list (5.1) | `personnel-list-panel.tsx` | Scoped search; row click → **quick-edit**; row actions edit + register | Row does **not** open full profile; no URL `teamId` hydrate; raw `<p>` alerts (first-touch FeedbackMessage when rewriting navigation) |
| Quick-edit | `personnel-quick-edit-modal.tsx` | «باز کردن پروفایل کامل» already leave-guard navigates to `/personnel/profile/{uuid}` | Keep; row-click semantics change to profile (UX-DR30) |
| Code resolve API | `person.getByPersonnelCode` in `apps/web/src/server/person.ts` + `getPersonByPersonnelCode` | Scoped lookup by business code | Page route does not call it / redirect |
| Profile href helpers | `lib/personnel-search.ts`, `personnel-scoped-search-helpers.ts`, events panel local `profileHref` | UUID path only | Optional shared helper for UUID + optional `event` query — avoid third copy |
| Dashboard cards | `packages/modules/reporting/src/dashboard-snapshot.ts` + `dashboard-metric-card.tsx` | `reconcileHref` / leave-guard navigate | Most hrefs are bare section roots; events lack type/range query; list lacks `teamId` |
| Report reconcile | `packages/modules/reporting/src/report-run.ts` + `report-workspace.tsx` | Some `teamId` on list; events → bare `/personnel-events/events`; reports URL contract from 9.5 | Enrich presets to match **filters that produced the figure**; consumers must read query |
| Correction cases | `correction-cases-panel.tsx` + `correctionCase.open` | Open dialog with EntityPicker person | No URL `?person=` prefill / contextual entry from profile |
| Access denied | `components/access-denied.tsx` + `operationalCopy.accessDenied*` | Deep-link denial (UX-DR18) | Use for coarse route deny; profile IDOR stays anti-enumeration (see distinctions) |
| Design-QA | `pnpm --filter @divan/web selfcheck:design-qa` | Epic 8/9 gate | Mandatory green |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Row click → profile vs quick-edit** | UX-DR30 + AC: **row click opens the record** = full profile. Quick-edit stays a **row action** (and modal link to full profile). Do **not** leave `onRowClick → openEdit` as today. |
| **Canonical profile URL** | Canonical path is always `/personnel/profile/{personUuid}` (+ optional `?event=`). Personnel-code URLs **resolve then redirect** (replace) to UUID — never leave code as the long-lived path identity. |
| **Anti-enumeration vs not-permitted empty** | **Out-of-scope / unknown person** (UUID or code): keep Story 5.1/5.2 posture — uniform not-found / redirect to list (or equivalent non-leaking deny). Do **not** invent “این فرد خارج از محدوده شماست” that confirms existence. **Not-permitted surface** (AC): when the caller lands on a **capability** they lack (e.g. correction write, report they cannot run) or a filtered detail that would otherwise look blank — use FeedbackMessage / AccessDenied / locked requirement copy — **never** a silent empty table. |
| **Event → person vs person → event** | 9.6 already navigates event → profile(`?event=`). This story makes profile/timeline **honor** `event` (scroll + highlight + `id` anchor). Timeline does **not** need a second event-detail route. |
| **Reconcile “filtered detail” vs bare section** | Bare `/personnel-events/events` or `/personnel/list` is insufficient when the metric was produced under team / date / type filters. Pass those as query params the **target UI already understands** (or add hydrate for existing filter state). Prefer reusing EntityPicker filter fields — no UUID text inputs. |
| **Report workspace vs operational lists** | Dashboard/report figures that are catalogue metrics may deep-link into **9.5 report URLs** (`/reports/{subject}/{key}?…&run=1`) when that is the honest “detail that produced the figure”; list/events when the figure is a headcount/list/events aggregate. Do not invent parallel report SoT. |
| **9.7 CTA vs 9.8 governance IA** | 9.7: profile button «ثبت درخواست اصلاح» → correction surface with person context. 9.8: rename «پرونده‌های اصلاح» → «اصلاح اطلاعات», purpose line, other governance surfaces. Do **not** claim 9.8 done. |
| **Presentation / IA only** | No new AR-\* freeze numbers; no Prisma in `apps/web`; no change to PopulationPort / InferenceBulk / evaluation-snapshot rules; no Cancel/Reverse/Correct mutation IDOR invent (still open carry-in). |

### Personnel-code deep-link algorithm (non-negotiable)

1. Route param `personId` (name may stay for compatibility) may be **UUID** or **personnel code** (trim; normalize Latin/Persian digits if project already has a helper — reuse, don’t invent ad-hoc).
2. If `isPersonUuid(param)` → existing scope gate → render.
3. Else treat as personnel code → server resolve (`getPersonByPersonnelCode` / existing domain) → if missing or out-of-scope → **same** not-found posture as unknown UUID (redirect list; no code-existence leak).
4. If in-scope → **`redirect` (replace) to** `/personnel/profile/{uuid}` preserving safe query (`event` only if present and well-formed UUID).
5. Client bookmarks and share links should converge on UUID URL after one hop.

### Reconcile query contract (minimum)

Document and implement hydrate for these (extend only if already trivial):

| Target | Query keys (examples) | Source |
| --- | --- | --- |
| `/personnel/list` | `teamId` | Dashboard active-persons / distributions; report personnel keys with team filter |
| `/personnel-events/events` | `teamId`, `eventType` (or multi), `effectiveFrom`/`effectiveTo` or `rangeStart`/`rangeEnd` (pick **one** naming and align dashboard+report+panel), optional `person` | starts/terminations/trend cards; event report keys |
| `/headcount/capacity` | `teamId` (already partially wired) | team_capacity / HC cards |
| `/reports/{subject}/{key}` | existing 9.5 params + `run=1` | When figure is a report run, not a list |

On hydrate: set filter draft + apply (new evaluation snapshot / page=1 where lists use snapshots). Invalid ids → honest empty / FeedbackMessage, not crash.

## Acceptance Criteria

1. **Given** the personnel list  
   **When** the operator activates a row (row click)  
   **Then** navigation opens the **full profile** for that person (leave-guard `requestNavigation`), and quick-edit remains available via row action (not as the sole row-click target)

2. **And** the profile is reachable by **personnel code** deep-link with **canonical redirect** to `/personnel/profile/{uuid}` (algorithm above); command palette / quick-edit UUID links remain valid

3. **And** an event links to its person (preserve 9.6 open-event / open-person) **and** a person's timeline honors `?event={eventId}` (scroll into view + visible highlight / focus on that row; stable `id` on the row)

4. **And** dashboard and report **reconcile** links land on the **filtered detail** that produced the figure (enriched `reconcileHref` + consumer URL hydrate — not bare section roots when filters applied)

5. **And** every drill-through target respects the caller's permissions and shows the **standard not-permitted / requirement** state rather than an empty unexplained surface (FeedbackMessage / AccessDenied / locked copy; person IDOR anti-enumeration preserved)

6. **And** «ثبت درخواست اصلاح» is available from the profile as contextual entry into the correction-cases surface with the person prefilled (or open dialog ready); if caller lacks write capability, state the access requirement — do not show a dead control

7. **And** Epic 8 / Epic 9 encode held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green (and `selfcheck:row-actions` if list row semantics change)
   - First-touch FeedbackMessage / RowActionCluster / leave-guard on touched panels; no new UUID entity inputs; no StatusMessage clones
   - AR-\* fail-closed; presentation/IA over unchanged domain rules

8. **And** scope boundaries:
   - Does **not** implement Story **9.8** rename/purpose-line for «اصلاح اطلاعات» / other governance surfaces (only profile CTA)
   - Does **not** invent a standalone event-detail route
   - Does **not** change FR-33 search/export semantics, FR-34 field DOM-omit, or lifecycle mutation rules
   - Does **not** silently close unpaid carry-ins (PopulationPort cutover, mutation IDOR, AD-6, etc.) — honesty only
   - Does **not** claim 9.9 / 9.10

## Tasks / Subtasks

- [x] Task 1: Personnel list → full profile (AC: #1, #5, #7)
  - [x] UPDATE `personnel-list-panel.tsx`:
    - `onRowClick` → leave-guard navigate to `/personnel/profile/{id}` (reuse shared href helper)
    - Keep RowActionCluster: «اطلاعات کامل/ویرایش» (quick-edit) + «ثبت رویداد»; optionally ensure labels still match UX-DR28
    - When touching status/error chrome: prefer **FeedbackMessage** over raw `<p role=alert|status>` (first-touch rule)
  - [x] UPDATE `row-actions.selfcheck.ts` / list selfcheck if assertions assume row→edit
  - [x] Manual: row click ≠ fire when clicking actions (`stopPropagation` already on RowActionButton)

- [x] Task 2: Personnel-code deep-link + canonical redirect (AC: #2, #5)
  - [x] UPDATE `app/(app)/personnel/profile/[personId]/page.tsx`:
    - Branch UUID vs code; resolve code server-side; redirect to canonical UUID URL preserving `event` query when valid
    - Out-of-scope / unknown → existing non-leaking posture (redirect list)
  - [x] Reuse `getPersonByPersonnelCode` + `assertPersonInScopedPopulation` — **do not** add unscoped Prisma lookups in the page
  - [x] Optional thin selfcheck: page source contains code-resolve / redirect branch; UUID path still gated
  - [x] Next.js 16: `params` / `searchParams` are **Promises** — await them

- [x] Task 3: Bidirectional event ↔ person (AC: #3)
  - [x] UPDATE profile host / `PersonProfileView` / timeline:
    - Read `event` from `useSearchParams` (or server-passed prop)
    - Ensure timeline row DOM `id={`event-${eventId}`}` (or equivalent stable)
    - On load when `event` present: scrollIntoView + highlight ring / `aria-current` / focus management; missing event → FeedbackMessage “رویداد در بازهٔ قابل نمایش نیست” (or load-more honesty) — not silent ignore forever
  - [x] Confirm 9.6 events list still uses `?event=` on open-event; do not regress drafts → register path
  - [x] Do **not** invent `/personnel-events/event/[id]` page

- [x] Task 4: Reconcile href enrichment + URL hydrate (AC: #4, #5)
  - [x] UPDATE `dashboard-snapshot.ts` and `report-run.ts` `reconcileHref` builders:
    - Encode applied filter context (team, date range, event type) into target URLs
    - Where the honest detail is a **report**, link to 9.5 workspace URL with params + `run=1`
    - Keep Persian `reconcileLabelFa` operator-facing
  - [x] UPDATE `personnel-list-panel.tsx` and `personnel-events-list-panel.tsx` to **hydrate** known query keys on mount (apply filters → reset snapshot/page)
  - [x] Headcount capacity: verify `teamId` hydrate still works; fix if broken by IA moves (9.4)
  - [x] Leave-guard: metric card / report reconcile already use `requestNavigation` — preserve
  - [x] Package selfchecks for reporting if href shapes are asserted; else add minimal structural asserts

- [x] Task 5: Profile «ثبت درخواست اصلاح» contextual entry (AC: #6, #5)
  - [x] UPDATE `person-profile-view.tsx` (toolbar/header actions region): primary/secondary button «ثبت درخواست اصلاح»
    - If `correction.case.write` (or existing capabilities query) allowed → leave-guard navigate to `/correction-cases?person={uuid}` (and optional `open=1`)
    - Else → disabled-with-reason **or** navigate to surface that states requirement (no inert gold button)
  - [x] UPDATE `correction-cases-panel.tsx`: read `person` (UUID) from URL; hydrate EntityPicker; if `open=1` and permitted, open the existing open-case dialog with person prefilled
  - [x] Reuse `correctionCase.capabilities` / open mutation — **no** parallel write API
  - [x] Copy via `operationalCopy` — add keys if missing; Persian operational voice
  - [x] **Stop at CTA + prefill** — sidebar rename / purpose line = **9.8**

- [x] Task 6: Design-QA / DoD / honesty (AC: #7–#8)
  - [x] NEW optional `drill-through.selfcheck.ts` (structural: list onRowClick → profile; profile page code redirect; events/list URL hydrate; profile CTA string) — wire if cheap
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green; `selfcheck:row-actions` green
  - [x] `@divan/web` typecheck; eslint on touched files; reporting package selfchecks if touched
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits
  - [x] Close deferred-work note for full reconcile presets (5.4/5.5) when this story delivers them — or leave residual honesty if partial

### Manual DoD checklist

- [x] Personnel list: row click → profile; row action edit → quick-edit; register still works; actions don’t navigate as side effect of row click
- [x] `/personnel/profile/{personnelCode}` → 307/redirect → `/personnel/profile/{uuid}`; unknown code → non-leaking deny
- [x] Events list open-event → profile with `?event=`; timeline scrolls/highlights that event
- [x] Dashboard card reconcile with team/range → list/events/capacity/report with filters applied (visible in UI)
- [x] Report reconcile similarly filtered; locked/unauthorized paths explain requirement
- [x] Profile «ثبت درخواست اصلاح» → correction panel with person filled; no-write role sees reason
- [x] `selfcheck:design-qa` green; no new AR-\*; no Prisma in web; 9.8 not claimed

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Row click → full profile | Keep row click → quick-edit only |
| Code deep-link → canonical UUID redirect | Persist code as canonical route identity |
| Timeline honors `?event=` | New event-detail route / parallel timeline SoT |
| Reconcile hrefs carry filter context + consumers hydrate | Bare section links when filters existed |
| Not-permitted / requirement copy on capability denials | Silent empty tables; person existence enumeration |
| Profile correction CTA + URL prefill | Claim 9.8 governance IA rename done |
| `selfcheck:design-qa` green | Domain rule / AR-\* invent |

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `personnel-list-panel.tsx` | Row → quick-edit; no URL hydrate | Row → profile; hydrate `teamId`; FeedbackMessage on touch | search snapshot pagination; export slot; RowActionCluster actions |
| `profile/[personId]/page.tsx` | UUID-only | Code resolve + redirect; await searchParams for `event` pass-through | scope gate; PageHeader; PersonProfileView |
| `person-profile-view.tsx` | Sections + timeline | `?event=` focus; correction CTA | DOM-omit fields; assembler consumer; sensitivity icons |
| `personnel-event-timeline.tsx` / `event-timeline-row.tsx` | No anchors | id + highlight API | lifecycle controls; listForPerson |
| `personnel-events-list-panel.tsx` | Real data; no URL presets | Hydrate query filters | search API; RowActionCluster; FeedbackMessage; snapshot |
| `dashboard-snapshot.ts` / `report-run.ts` | Sparse reconcile hrefs | Enrich query presets | outcomes, PopulationPort honesty, labels |
| `correction-cases-panel.tsx` | Manual open dialog | URL person (+ open) hydrate | governed mutations; EntityPicker; caps |

### Architecture compliance

- **AD-3:** Web talks tRPC / server helpers only; domain resolve in `person-employment`; reporting hrefs in `packages/modules/reporting`; no Prisma in `apps/web`.
- **AD-5:** Profile/correction/list reads stay on `governedProcedure` + envelope; default-deny; drill-through must not bypass PopulationPort.
- **FR-33 / FR-47:** Cross-boundary drill-down preserves authorized intersection; no wider dump via deep-link params.
- Errors: typed + Persian at boundary; correlation behind technical disclosure where already patterned.

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Next.js 16 App Router | `redirect` for canonical; await `params` / `searchParams`; client `useSearchParams` for event focus |
| tRPC 11 + React Query | Reuse `person.getByPersonnelCode`, `correctionCase.*`, list search queries — no new infinite-query invent |
| Leave-guard | All cross-route navigations via `requestNavigation` |
| FeedbackMessage / AccessDenied | Capability denials and empty-filtered honesty |
| EntityPicker | Prefill correction person; list filters — no UUID inputs |
| RowActionCluster / UX-DR30 | List actions unchanged semantically except row-click target |
| Jalali / Persian digits | Display only; normalize digits on code input if helper exists |

### File structure requirements

- Prefer small shared `profileHref(personId, { eventId?: string })` under `apps/web/lib/` if three+ call sites diverge
- Reporting reconcile builders stay in `packages/modules/reporting` (single SoT for href strings)
- No new top-level nav entries; profile remains contextual (not sidebar)
- Selfchecks under `apps/web/lib/*.selfcheck.ts` wired into design-qa or package scripts

### Testing requirements

| Check | Command / method |
| --- | --- |
| Design-QA gate | `pnpm --filter @divan/web selfcheck:design-qa` |
| Row actions | `pnpm --filter @divan/web selfcheck:row-actions` |
| Types / lint | `@divan/web` typecheck; eslint touched files |
| Reporting | Existing package selfchecks if href/catalogue touched |
| Grep / structural | Optional drill-through selfcheck |
| Manual | DoD checklist above |

### Previous story intelligence

**From 9.6 (done, baseline `d6e6814`):** Open-event → `profile?event=`; open-person → profile; URL presets **explicitly deferred to 9.7**; FeedbackMessage + EntityPicker + snapshot pagination patterns; review patches on placeholderData / filter reset — apply same care when hydrating URL filters (don’t re-apply stale snapshot tokens). Batched person labels — keep. Do not regress fixture removal.

**From 9.5:** Shareable report URLs are the reconcile target when the figure is a report; `run=1` explicit; FeedbackMessage; subject validity — invalid deep-link keys → FeedbackMessage not 500.

**From 9.4 / 9.1–9.3 / Epic 8:** First-touch discipline; design-qa mandatory; BOM-safe sprint-status; presentation/IA only.

**From 5.1 / 5.2 / 5.3:** Profile IDOR = uniform not-found/redirect; DOM-omit fields; timeline consumes `listForPerson` only; command palette already opens profile by UUID.

**From 5.4 / 5.5 deferred-work:** Full reconcile query presets on list + events were deferred — **this story closes that intent**. Capacity already passes `teamId` in some paths.

**From 7.5:** Correction open requires `personId` UUID + write permission; capabilities query exists — consume it for CTA enablement.

**From EXPERIENCE Key Flow ۴:** Profile CTA is the natural path into correction — button copy «ثبت درخواست اصلاح».

### Git intelligence summary

Recent commits: `d6e6814` story 9.6 → `168d7d9` 9.5 → `b33345b` 9.4 → `112209e` 9.3 → `cb20355` 9.2`. Pattern: thin web IA/wiring; domain in packages; selfcheck + matrix honesty; no domain churn. 9.6 intentionally left reconcile presets and profile correction CTA to **9.7**.

### Project structure notes

- Profile is **not** a section tab — keep outside `section-tab-surfaces` personnel tabs
- Correction route remains `/correction-cases` until 9.8 renames nav label
- Detected variance: personnel list still uses raw alert `<p>` — fix on touch; do not copy that debt elsewhere
- Events list `profileHref` is local — consolidate if list/profile/palette diverge

### Latest tech information

- Next.js 16 App Router: dynamic `params` / `searchParams` as Promises on server components — **await** before branch/redirect.
- Prefer `redirect()` from `next/navigation` for canonical code→UUID (replace semantics).
- Client highlight: `scrollIntoView({ block: "nearest" })` + focusable row; honor `prefers-reduced-motion` (instant scroll if reduced).
- Do not adopt generic “infinite query” pagination for list hydrate — keep evaluation-snapshot contract.

### Project context reference

No `project-context.md` found in repo at story creation; follow Architecture Spine AD-3/AD-5, UX 2026-07-31, Epic 9 gates, and FR-33 anti-enumeration from Stories 5.1–5.2.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9 / Story 9.7]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — 9.7 intent]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — drill-through, Key Flow ۴, not-permitted empty]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-3/AD-5]
- [Source: `_bmad-output/implementation-artifacts/9-6-personnel-events-list-real-data.md`]
- [Source: `_bmad-output/implementation-artifacts/9-5-reports-section-tabs-workspace.md`]
- [Source: `_bmad-output/implementation-artifacts/5-2-personnel-profile-sections.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 5.4/5.5 reconcile presets]
- [Source: `apps/web/app/(app)/personnel/profile/[personId]/page.tsx`]
- [Source: `apps/web/components/personnel/personnel-list-panel.tsx`]
- [Source: `apps/web/components/personnel/personnel-events-list-panel.tsx`]
- [Source: `apps/web/src/server/person.ts` — `getByPersonnelCode`]
- [Source: `packages/modules/reporting/src/dashboard-snapshot.ts`]
- [Source: `packages/modules/reporting/src/report-run.ts`]

## Dev Agent Record

### Agent Model Used

Composer (bmad-dev-story)

### Debug Log References

- Red/green: selfcheck:row-actions asserted 
avigateProfile before list change; green after Task 1.
- Gate: pnpm --filter @divan/web selfcheck:design-qa (includes drill-through) ok; reporting dashboard/report selfchecks ok; @divan/web typecheck ok.
- ESLint toolchain missing eslint-module-utils/resolve in this environment (pre-existing); typecheck used as static gate.

### Completion Notes List

- Task 1: List row click → full profile via leave-guard + shared profileHref; quick-edit remains row action; FeedbackMessage first-touch on list chrome.
- Task 2: Profile page resolves personnel code → scoped redirect to UUID URL; preserves valid ?event=; unknown/out-of-scope → list (anti-enumeration).
- Task 3: Timeline honors ocusEventId with id=event-*, scroll/highlight/ria-current, auto load-more then honest FeedbackMessage if missing.
- Task 4: Reporting 
econcile-href builders enrich team/range/type; list/events hydrate URL; capacity 	eamId hydrate; person.search optional 	eamId filter in snapshot fingerprint.
- Task 5: Profile CTA «ثبت درخواست اصلاح» → /correction-cases?person=&open=1 when write allowed; otherwise disabled-with-reason; correction panel URL hydrate + open dialog.
- Task 6: drill-through.selfcheck.ts wired into design-qa; deferred-work 5.4 reconcile presets closed with residual honesty for sOf on lists; 9.8 not claimed.

### File List

- _bmad-output/implementation-artifacts/9-7-profile-access-cross-surface-drill-through.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/deferred-work.md
- pps/web/app/(app)/correction-cases/page.tsx
- pps/web/app/(app)/headcount/(tabs)/capacity/page.tsx
- pps/web/app/(app)/personnel-events/(tabs)/events/page.tsx
- pps/web/app/(app)/personnel/(tabs)/list/page.tsx
- pps/web/app/(app)/personnel/profile/[personId]/page.tsx
- pps/web/components/correction-cases/correction-cases-panel.tsx
- pps/web/components/headcount/headcount-approvals-table.tsx
- pps/web/components/personnel/event-timeline-row.tsx
- pps/web/components/personnel/person-profile-view.tsx
- pps/web/components/personnel/personnel-event-timeline.tsx
- pps/web/components/personnel/personnel-events-list-panel.tsx
- pps/web/components/personnel/personnel-list-panel.tsx
- pps/web/components/personnel/personnel-quick-edit-modal.tsx
- pps/web/lib/design-qa.selfcheck.ts
- pps/web/lib/drill-through.selfcheck.ts
- pps/web/lib/operational-copy.ts
- pps/web/lib/personnel-profile-href.ts
- pps/web/lib/personnel-search.ts
- pps/web/lib/row-actions.selfcheck.ts
- pps/web/package.json
- pps/web/src/server/person.ts
- pps/web/src/server/personnel-scoped-search.ts
- packages/modules/reporting/src/dashboard-snapshot.ts
- packages/modules/reporting/src/index.ts
- packages/modules/reporting/src/reconcile-href.ts
- packages/modules/reporting/src/report-run.ts

### Change Log

- 2026-08-02: Implemented Story 9.7 cross-surface drill-through (profile access, reconcile presets, correction CTA). Status → review.
- 2026-08-02: Code review patches applied (reconcile honesty, URL hydrate, timeline focus, team intersect). Status → done.

### Review Findings

- [x] [Review][Patch] Team filter: intersect subjectIds with team membership before project/cap (report-run pattern; decision A) [apps/web/src/server/personnel-scoped-search.ts:818]
- [x] [Review][Patch] Dashboard reconcile passes `teamId` for cards that do not narrow by team (`active_persons`, `starts_terminations`, `workforce_trend`) — href detail ≠ figure [packages/modules/reporting/src/dashboard-snapshot.ts:314]
- [x] [Review][Patch] Empty timeline early-return hides `profileEventFocusMissing` when `?event=` is set [apps/web/components/personnel/personnel-event-timeline.tsx:159]
- [x] [Review][Patch] `focusAttemptedRef` latches before DOM node exists — scroll/focus skipped permanently [apps/web/components/personnel/personnel-event-timeline.tsx:114]
- [x] [Review][Patch] One-shot `urlHydratedRef` ignores later `searchParams` changes on list/events/correction panels [apps/web/components/personnel/personnel-list-panel.tsx:210]
- [x] [Review][Patch] `teamsQuery` error during hydrate latches and mislabels team as invalid/out-of-scope [apps/web/components/personnel/personnel-list-panel.tsx:209]
- [x] [Review][Patch] Correction `open=1` + capabilities query error shows access-denied copy instead of load failure [apps/web/components/correction-cases/correction-cases-panel.tsx:307]
- [x] [Review][Patch] Unknown URL `eventType` silently coerced to empty with no FeedbackMessage [apps/web/components/personnel/personnel-events-list-panel.tsx:208]
- [x] [Review][Patch] Non-UUID URL `teamId` on events panel silently dropped (list panel warns) [apps/web/components/personnel/personnel-events-list-panel.tsx:213]
- [x] [Review][Patch] Hydrate applies `effectiveFrom`/`effectiveTo` without from>to / format validation used by manual apply [apps/web/components/personnel/personnel-events-list-panel.tsx:204]
- [x] [Review][Patch] Suspense fallbacks use raw `<p role="status">` instead of FeedbackMessage loading [apps/web/app/(app)/personnel/(tabs)/list/page.tsx:25]
- [x] [Review][Patch] Capacity `?teamId=` non-UUID / non-TEAM silently dropped or empty without invalid-filter hint [apps/web/app/(app)/headcount/(tabs)/capacity/page.tsx:36]
- [x] [Review][Patch] `exportSnapshotHash` omits `teamId` while list filter/snapshot include it [apps/web/src/server/personnel-scoped-search.ts:836]
- [x] [Review][Defer] Local `isUuid` helper remains in quick-edit modal beside shared `@/lib/is-uuid` [apps/web/components/personnel/personnel-quick-edit-modal.tsx] — deferred, pre-existing

---

**Completion note:** Ultimate context engine analysis completed - comprehensive developer guide created
