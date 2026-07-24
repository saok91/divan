---
baseline_commit: f4e9b5f705bad2a9091388ba6ed95bfac04db97f
---

# Story 5.2: Personnel Profile Sections

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a scoped user,
I want a permission-filtered Person profile with current and prior Employment sections,
so that I can review governed facts without seeing forbidden fields (FR34, UX-DR8).

**Story key:** `5-2-personnel-profile-sections`  
**Epic:** 5 — Search, Profiles, Dashboard & Reports (FR33–36)  
**Prerequisite:** Story 5.1 done (scoped search, deep-link placeholder, `assertPersonInScopedPopulation`). Epic 4 assemblers live (`getCurrentPersonState`). Epic 4b chrome live.

## Acceptance Criteria

1. **Given** access to a Person within scope  
   **When** the profile opens at `/personnel/profile/[personId]`  
   **Then** sections include identity, current Employment, current Assignments (Primary + Secondary), approved sensitive categories (when permitted), prior Employments, and a **timeline entry point** (link/affordance only — full timeline = **5.3**)

2. **And** fields outside permission are **not rendered in the DOM** (absent keys — never CSS-hidden, `aria-hidden` theater, or null-as-zero)

3. **And** sensitivity icons mark governed Data-Dictionary categories (UX-DR8)

4. **And** current facts are distinguishable from Scheduled future changes (`scheduledChanges` / `StatusBadge` Scheduled — never fold future into current columns)

5. **And** cold load uses `Skeleton` matching section density

6. **And** profile remains reachable from quick-edit «باز کردن پروفایل کامل», command palette Enter, and the canonical deep link (Epic 4b / 5.1 seams — do not invent a parallel path)

7. **And** server person-org scope + PopulationPort honesty from 5.1 still apply on profile page/get — out-of-scope → uniform not-found / redirect (no AR-ACCESS enumeration invention)

8. **And** profile facts consume Epic 4 assembler (`getCurrentPersonState`) + existing employment list APIs — **no** parallel current-state SoT / projection tables (Epic 4 / 4b consumer contract)

## Tasks / Subtasks

- [x] Task 1: Profile read path — reuse assembler + scope (AC: #1, #2, #7, #8)
  - [x] Keep server gate on page: auth → `assertPageAccess("/personnel")` → UUID check → `assertPersonInScopedPopulation` (InferenceBulk channel `profile`) — preserve uniform `PERSON_NOT_FOUND` / redirect from 5.1
  - [x] Primary data: `api.person.getCurrentState` (already scoped in `person.ts`) — do **not** bypass with raw Prisma / unscoped `getPersonById` dumps
  - [x] Freshness fail-closed: if result is `CurrentPersonStateFreshnessBlock` (`ok: false`), show Persian fail-closed banner (`messageFa`) + Skeleton/disabled sections — **never** paint stale “truth”
  - [x] Compensation / contractual: keys already absent without `compensation.read` — UI must not invent placeholders; section “approved sensitive categories” renders only when keys exist
  - [x] Prior employments: consume `listEmploymentsForPerson` via a **new thin governed procedure** (or extend an existing read) that: requires person read + `assertPersonInScopedPopulation` + omits unauthorized categories — do **not** invent a second “profile state” table
  - [x] Labels / enablement: use `person.listEnabledFields` (`listEnabledProfileFields`) for `labelFa` + `sensitivity` — only enabled+approved dictionary fields; AR-DATA fail-closed (do not invent religion/health/national_id enablement)

- [x] Task 2: `person-profile-section` UI composition (AC: #1–#5)
  - [x] UPDATE `apps/web/app/(app)/personnel/profile/[personId]/page.tsx`: replace placeholder copy with real profile host; keep async `params: Promise<{ personId }>` (Next.js 16)
  - [x] NEW client composition under `apps/web/components/personnel/` (e.g. `person-profile-view.tsx` + section helpers) — sections as semantic cards/sections per UX-DR8:
    - identity
    - current Employment
    - current Assignments (Primary distinguishable from Secondary)
    - approved sensitive categories (compensation/contractual when keys present)
    - prior Employments
    - timeline **entry point** only (e.g. link to `/personnel-events/...` person-scoped surface or in-page anchor stub — depth = 5.3)
  - [x] Render rule: iterate **present keys only** (`Object.hasOwn` / dictionary ∩ DTO). Missing permission ⇒ no DOM node for that field
  - [x] Sensitivity icon on governed categories (`sensitivity !== "ordinary"`) — lucide or thin local icon; accessible name in Persian
  - [x] Scheduled strip: list `scheduledChanges` with `StatusBadge status="Scheduled"` + Jalali effective date (`toPersianDigits`) — visually separate from current facts (mirror `current-person-state-foreshadow.tsx` semantics; do not copy its demo form into the profile)
  - [x] Cold load: `Skeleton` blocks matching section density while `getCurrentState` / prior-employments queries pending
  - [x] Persian operational copy; numbers via `toPersianDigits`; no ceremonial success fluff
  - [x] If `components/ui/card.tsx` is missing: add a **thin** shadcn-style Card matching existing ui primitives **or** use `<section>` + existing density tokens (`text-title-sm`, spacing) — do not introduce a new design system / heavy card library

- [x] Task 3: Org / job display enrichment (AC: #1)
  - [x] Resolve team / role / title / ladder / grade labels for display the same way list projector does (lookup helpers already used by `personnel-list-projector` / scoped search) — prefer reuse over new SoT
  - [x] Do **not** embed full `TreeNavigator` / org hierarchy panel on the profile; path/label is enough

- [x] Task 4: Entry seams regression (AC: #6)
  - [x] Verify quick-edit `PROFILE_HREF_PREFIX = "/personnel/profile/"` still works; leave-guard still blocks profile navigation while dirty (data-state rules unchanged)
  - [x] Verify palette `searchPersonnel` → same scoped search → profile href
  - [x] Profile is **contextual** (not a sidebar item) — do not force it into `section-tab-surfaces` unless UX explicitly requires (it does not)

- [x] Task 5: Verify + DoD (AC: #1–#8)
  - [x] NEW thin selfcheck(s): DOM-omit / key-absence contract in any profile DTO mapper; Scheduled ≠ current regression (reuse 4.9 assertions where possible); scope denial on profile get
  - [x] Regression: `selfcheck:current-person-state`, `selfcheck:personnel-search`, `selfcheck:personnel-list-projector`, `selfcheck:data-dictionary` as touched
  - [x] `pnpm --filter @divan/web` typecheck + eslint on touched files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows

### Manual DoD checklist

- [x] Deep-link `/personnel/profile/{uuid}` shows sections for in-scope Person
- [x] Out-of-scope / unknown UUID → redirect list (or uniform not-found) — no leakage
- [x] Without `compensation.read`, compensation/contractual fields absent from DOM
- [x] Disabled / unapproved dictionary fields absent
- [x] Scheduled future changes visible separately from current Employment/Assignments; never labeled Effective early
- [x] Freshness pending/failed/stale → fail-closed Persian message, not stale facts
- [x] Skeleton on cold load; sensitivity icons on governed categories
- [x] Timeline entry point present; full timeline UX-DR9 depth **not** claimed done
- [x] Palette / quick-edit «باز کردن پروفایل کامل» still reach same URL
- [x] No Prisma in `apps/web`; no parallel profile SoT tables; no `GovernedDataTable` fork
- [x] Labels remain اطلاعات پرسنلی / پروفایل فرد — no revert to Epic 1 «پرسنل»

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Consume `getCurrentPersonState` (+ `listEmploymentsForPerson` for prior) for profile facts | Invent parallel “profile state” tables / CRUD SoT |
| Keep `assertPersonInScopedPopulation` on page + profile gets | Unscoped profile reads / client-only filtering of dumps |
| DOM omit for unauthorized / disabled fields | CSS hide, mask `***`, or null-as-zero theater |
| Scheduled only via `scheduledChanges` (and planned helpers) | Fold future into current Employment/Assignments |
| Freshness fail-closed from assembler | Show pending/stale as authoritative current |
| Extend `/personnel/profile/[personId]` | Parallel profile route without scope |
| AR-ACCESS / AR-DATA / AR-TEMPORAL / AR-REPORTING / AR-HEADCOUNT fail-closed | Invent enablement matrices, OQ-2/OQ-3 timing/masking, national_id religion |
| PopulationPort honesty (fixture ≠ production workforce) | Claim cutover without `population-cutover.ts` criteria |
| Labels: اطلاعات پرسنلی / پروفایل فرد | Revert to «پرسنل» |

### Absolute non-goals

- Full **personnel-event-timeline** depth (UX-DR9 badges, correction/neutralization chains, empty «رویداد پرسنلی ثبت نشده.») → **Story 5.3** — 5.2 only ships an entry point
- Dashboard / reports → **5.4 / 5.5**
- Governed export → **6.5**; artifact reauth (Epic 2 carry)
- PopulationPort **full** default-registry cutover; AD-6 Prisma vs PoolClient; `ensure*Schema` migrations-only; Vitest mandate
- Logout → `requestNavigation` leave-guard (Epic 4b #6 — known exemption)
- Dedupe Add vs QuickCreate forms (Epic 4b #5) unless already in touch radius
- Org-wide personnel-event list API (still `listForPerson` only)
- Mutating profile facts via CRUD (events remain SoT — AD-2)

### Profile / timeline consumer contract (Epic 4 + 4b carry-in — encode here)

**Canonical contract for Epic 5 profile + timeline consumers:**

1. **Current facts** → `getCurrentPersonState` only (`@divan/person-employment`). Same DTO semantics as list/report consumers (FR-25 / FR-26).
2. **Prior employments** → `listEmploymentsForPerson` (or as-of helpers already in module) behind scoped governed procedure — not a new projection schema.
3. **Timeline (5.3)** → existing event-store / `personnelEvent.listForPerson` (+ lifecycle APIs); sort/badge rules in 5.3. Story 5.2 may link to the person-scoped events surface or reserve an in-page mount point — **do not** reimplement timeline rows here.
4. **Scheduled vs Effective:** current section shows as-of facts; Scheduled futures live in `scheduledChanges` with `StatusBadge` Scheduled; planned/historical `viewSemantics` must not be mislabeled Effective.
5. **No parallel SoT:** no new “profile_projection” table, no dual-write, no Prisma current-state invented in `apps/web`.

### Previous story intelligence (5.1 → 5.2)

**Replace, don’t rebuild** the deep-link scaffold:

| Path | Today (5.1) | 5.2 change |
| --- | --- | --- |
| `personnel/profile/[personId]/page.tsx` | Placeholder + scope gate | Real sections host; **keep** gate |
| `person.getCurrentState` | Scoped assembler read | Primary profile wire |
| `CurrentPersonStateForeshadow` | Demo under افزودن | Pattern reference only — not the profile |
| `personnel-list-projector.ts` | List row omit/compensation | Reuse omit + label patterns; richer profile DTO/UI |
| `assertPersonInScopedPopulation` | IDOR on get/profile | Mandatory on all profile reads |
| Quick-edit / palette href | `/personnel/profile/{id}` | Unchanged URL |

5.1 learnings that still apply:

- PopulationPort fixture → fail-closed empty + honesty disclosure; never stamp-all UUID as “authz”
- Category omit = key absent; compensation gated by `compensation.read`
- InferenceBulk channel `profile` for single-person gets (avoids minimum-cohort blocking list channel)
- Helper selfchecks ≠ DOM/keyboard coverage — honest DoD ceiling
- Leave-guard dirty = data-state (if any edit affordance appears on profile — prefer read-only in 5.2)

### Architecture compliance

- **AD-2:** Projections/assemblers are read models — profile is a consumer, not a new SoT
- **AD-3:** Compensation only via `@divan/compensation-facts` inside assembler — web must not import compensation repos/schema
- **AD-5:** UI visibility ≠ authorization; `governedProcedure` + envelope
- **AD-6:** No `@prisma/client` in `apps/web`
- Capability map: profile (FR-34) → reporting + projections orchestration via person-employment + identity-access + audit-envelope
- Stack (repo): Next.js 16.2.x (async `params`), tRPC 11.x, Prisma 7.8.x, React 19, Node 22 — **no stack upgrade** in this story

### File structure (expected touch)

**UPDATE (primary):**

- `apps/web/app/(app)/personnel/profile/[personId]/page.tsx`
- `apps/web/src/server/person.ts` (optional thin prior-employments procedure; keep `getCurrentState` scope)
- Possibly tiny label helpers shared with list projector under `packages/modules/person-employment`

**NEW (as needed):**

- `apps/web/components/personnel/person-profile-*.tsx` (view + sections + sensitivity icon)
- Optional thin `components/ui/card.tsx` if Card pattern chosen
- Profile mapper/selfcheck helpers

**DO NOT modify (unless proven blocker + note):**

- `apps/web/components/governed-data-table/**` public contract
- Event-store mutation / Operator finalize semantics
- Access admin domain APIs
- `section-tab-surfaces.ts` (profile is contextual, not a tab)

### Library / framework requirements

- Reuse: `getCurrentPersonState`, `listEmploymentsForPerson`, `listEnabledProfileFields`, `assertPersonInScopedPopulation`, `StatusBadge`, `Skeleton`, `toPersianDigits`, `JalaliDatePicker` only if as-of control is in scope (optional; default today is enough for MVP profile)
- Client data: `api.person.getCurrentState.useQuery` from `@/lib/trpc/client`
- No AG Grid; no new state libraries; no direct `@divan/identity-access` imports from client components (follow existing `@/` / server boundary)
- OQ-3 default remains **omit/not-in-DOM** — do not ship masking without signed AR-ACCESS

### Testing requirements

- Thin helper selfchecks for omit contract + Scheduled≠current + scope denial
- Package regressions listed in Task 5
- Manual DoD for DOM absence, Skeleton, entry seams — do not claim covered by selfcheck alone

### Latest technical notes (2026)

- Next.js 16: `params` / `searchParams` are `Promise`s — existing page already awaits; keep that pattern; resolve once at the page boundary and pass plain `personId` to client children
- Authz boundary remains tRPC/`governedProcedure` — RSC page gate is defense-in-depth for chrome, not a substitute for procedure checks on data

### Project context reference

- No root `project-context.md` at activation; follow architecture spine + Gates + package boundaries above
- IA: contextual پروفایل فرد from list / palette / quick-edit (UX 2026-07-19 wins over 2026-07-13 where they conflict)

### Epic 4 / 4b retrospective carry-ins

From `epic-4-retro-2026-07-19.md` + `epic-4b-retro-2026-07-24.md`:

1. Encode profile/timeline consumer contract (assemblers + lifecycle APIs; no parallel SoT) — **this story’s Gate + Dev Notes**
2. Scheduled vs Effective distinguishable on profile
3. Keep AR matrices fail-closed in Epic 5
4. PopulationPort honesty + person-org IDOR already paid in 5.1 — do not regress

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5 / Story 5.2; UX-DR8]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-34, FR-25, FR-26, FR-7, FR-8, FR-47]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — person-profile-section retained]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — section list, DOM omit, OQ-3, Skeleton]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2/3/5/6]
- [Source: `_bmad-output/implementation-artifacts/5-1-permission-safe-personnel-search-lists.md`]
- [Source: `_bmad-output/implementation-artifacts/4-9-current-person-state-projection.md`]
- [Source: `_bmad-output/implementation-artifacts/epic-4b-retro-2026-07-24.md` — next epic preview]
- [Source: `packages/modules/person-employment/src/current-person-state.ts`]
- [Source: `apps/web/app/(app)/personnel/profile/[personId]/page.tsx`]
- [Source: `apps/web/components/personnel/current-person-state-foreshadow.tsx`]
- [Source: `apps/web/src/server/person.ts` — `getCurrentState`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Profile page keeps 5.1 scope gate; facts via `getCurrentState` + `listPriorEmployments` + `getProfileLabels` (no parallel profile SoT).
- `resolveLabelsForStates` extended for secondary-assignment org/role/job/ladder/grade ids; exported for profile reuse.
- Helper selfcheck covers omit / prior / Scheduled≠current; DOM/keyboard remain manual DoD ceiling.

### Implementation Plan

- Pure mapper in `apps/web/lib/person-profile-mapper.ts` for identity ∩ dictionary omit, prior closed employments, compensation key presence, Scheduled≠current guard.
- Thin governed procedures `listPriorEmployments` + `getProfileLabels` on `person` router with same IDOR scope as `getCurrentState`.
- Client `PersonProfileView` sections with Skeleton cold load, freshness fail-closed, StatusBadge Scheduled strip, sensitivity icon, timeline entry link only.

### Completion Notes List

- Replaced profile placeholder with real sections host; title «پروفایل فرد»; list back-link «اطلاعات پرسنلی».
- Compensation/contractual section renders only when `Object.hasOwn(state, "compensation")`; identity rows only for enabled ∩ present keys.
- Timeline entry point → in-page `#personnel-timeline-entry` stub (full UX-DR9 timeline = 5.3; no outbound register link).
- Entry seams unchanged: quick-edit `PROFILE_HREF_PREFIX`, palette `searchPersonnel` href `/personnel/profile/{id}`.
- Verified: `selfcheck:personnel-profile`, `selfcheck:personnel-search`, `selfcheck:personnel-list-projector`, `selfcheck:data-dictionary`, `selfcheck:current-person-state`; web typecheck + eslint on touched files.

### File List

- `apps/web/app/(app)/personnel/profile/[personId]/page.tsx`
- `apps/web/components/personnel/person-profile-view.tsx`
- `apps/web/components/personnel/person-profile-sensitivity-icon.tsx`
- `apps/web/lib/person-profile-mapper.ts`
- `apps/web/lib/person-profile.selfcheck.ts`
- `apps/web/src/server/person.ts`
- `apps/web/src/server/personnel-scoped-search.ts`
- `apps/web/package.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/5-2-personnel-profile-sections.md`

### Change Log

- 2026-07-24: Story 5.2 — permission-filtered profile sections from assembler + prior employments, DOM omit, Scheduled strip, timeline entry point; status → review.
- 2026-07-24: Code review patches applied (displayName omit, query fail-closed, compensation section gate, dictionary sensitivity, prior asOf filter, secondary ladder/grade, BOM strip, Persian errors, timeline stub); status → done.

### Review Findings

- [x] [Review][Decision] Timeline entry target — resolved: **in-page stub only** (`#personnel-timeline-entry`) until 5.3; remove outbound link to `/personnel-events/register` (mutation surface)
- [x] [Review][Patch] Timeline entry: keep section + copy; stub anchor only — no register/events outbound href until 5.3 [`apps/web/components/personnel/person-profile-view.tsx:459`]

- [x] [Review][Patch] Header `displayName` bypasses dictionary omit — builds from `givenName`/`familyName` even when those keys are disabled/absent from `presentIdentityFieldRows` [`apps/web/components/personnel/person-profile-view.tsx:160`]
- [x] [Review][Patch] `fieldsQuery` / `labelsQuery` errors ignored after cold load — empty fields/labels look like omit/deny [`apps/web/components/personnel/person-profile-view.tsx:140`]
- [x] [Review][Patch] Sensitive section opens on `Object.hasOwn(state, "compensation")` even when value is `null` (assembler sets null when permitted but no facts) — empty section title [`apps/web/lib/person-profile-mapper.ts:48`] [`apps/web/components/personnel/person-profile-view.tsx:347`]
- [x] [Review][Patch] Compensation/contractual `sensitivity="high"` hard-coded — not from `listEnabledFields` / Data-Dictionary [`apps/web/components/personnel/person-profile-view.tsx:357`]
- [x] [Review][Patch] Sensitivity icon `aria-label` embeds raw English token (`high`) — need Persian accessible name [`apps/web/components/personnel/person-profile-sensitivity-icon.tsx:24`]
- [x] [Review][Patch] `filterPriorEmployments` treats any set `endDateExclusive` as prior — future end still-current interval can appear under «اشتغال‌های قبلی» [`apps/web/lib/person-profile-mapper.ts:84`]
- [x] [Review][Patch] Secondary assignment ladder/grade labels resolved but never rendered [`apps/web/components/personnel/person-profile-view.tsx:302`]
- [x] [Review][Patch] `sprint-status.yaml` still UTF-8 BOM (`EF BB BF`) — Task 5 requires without BOM [`_bmad-output/implementation-artifacts/sprint-status.yaml:1`]
- [x] [Review][Patch] Profile error UI surfaces raw `error.message` for state/prior — prefer uniform Persian fail-closed copy [`apps/web/components/personnel/person-profile-view.tsx:110`]

- [x] [Review][Defer] Selfcheck omits scope-denial on profile get — gates exist on page + procedures; helper selfcheck cannot cover IDOR without DB [`apps/web/lib/person-profile.selfcheck.ts`] — deferred, pre-existing
- [x] [Review][Defer] `scheduledChangesAreSeparateFromCurrent` only checks employment id + `resolvedStatus` — does not assert assignment non-fold [`apps/web/lib/person-profile-mapper.ts:103`] — deferred, pre-existing
- [x] [Review][Defer] Cold load waits on all four queries — slow/failed labels|prior holds ready state behind Skeleton [`apps/web/components/personnel/person-profile-view.tsx:100`] — deferred, pre-existing
- [x] [Review][Defer] `getProfileLabels` re-runs `getCurrentPersonState` while client already loaded state — duplicate assembler cost [`apps/web/src/server/person.ts:426`] — deferred, pre-existing
