---
baseline_commit: 29a15752c3155e37a0790d6c25b8895ad72c6524
---

# Story 5.1: Permission-Safe Personnel Search & Lists

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an HR Operator, Admin, or Manager,
I want to search and filter personnel with stable pagination and Persian empty states,
so that I only see populations and fields I am allowed to see (FR33, UX-DR7).

**Story key:** `5-1-permission-safe-personnel-search-lists`  
**Epic:** 5 — Search, Profiles, Dashboard & Reports (FR33–36)  
**Prerequisite:** Epic 4b done (`governed-data-table`, section tabs, IA landings, leave-guard). Epic 4 assemblers live.

## Acceptance Criteria

1. **Given** an authenticated scoped user on اطلاعات پرسنلی / فهرست پرسنل  
   **When** they search/filter by approved identifiers/categories (name, surname, Personnel Code, national ID, email, phone, Job Title, Team, Department, Business Unit, ladder, grade, employment type, and other EXPERIENCE columns where permitted)  
   **Then** results, facets, counts, and columns reveal no out-of-scope values

2. **And** the list uses `governed-data-table` with Excel-like column filters, sorting (`aria-sort`), pagination over a stable query snapshot with deterministic ordering, result count, and filtered export when permitted

3. **And** default filter همکار فعلی = yes is active and dismissible; «پاک کردن فیلترها» restores section defaults including that default

4. **And** sticky RTL identifier and sticky row actions remain visible; horizontal scroll stays inside the table container

5. **And** row actions include «اطلاعات کامل/ویرایش» (`personnel-quick-edit-modal` + link to full profile) and «ثبت رویداد» (navigate to رویدادهای پرسنلی / ثبت رویداد with person pre-filled)

6. **And** empty search shows «نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.» with clear-filters action (`operationalCopy.emptySearch` / `clearFilters`)

7. **And** command palette Enter opens the selected profile using the **same** permission-safe search (not a parallel unscoped path)

8. **And** server-enforced **person-org scope** applies to list/search/get used by this surface — permission-only unscoped `person.list` / `listPersons` is **not** FR33-complete (Epic 4 / 4b retro)

9. **And** PopulationPort / fixture honesty: do **not** claim production workforce population authz while default `intersectPopulation` registry remains fixture-backed; document disclosure or fail-closed behavior explicitly

10. **And** current-fact list columns consume Epic 4 projection/assembler semantics (via shared list-row projector / `getCurrentPersonState` helpers) — **no** parallel SoT tables

## Tasks / Subtasks

- [x] Task 1: Server permission-safe search/list + IDOR scope (AC: #1, #8, #9)
  - [x] Add (or harden) a governed tRPC procedure for personnel search/list (prefer `person.search` / scoped list — do **not** ship unscoped `listPersons` as the FR33 source)
  - [x] Pipeline (mandatory): `governedProcedure` authorize → `intersectPopulation` (channel `search`|`list`) → `evaluateInferenceBulk` → access event → payload — reuse `runGovernedRetrieval` / `retrieval-control.ts` patterns; never accept client threshold overrides
  - [x] Subject ids = `Person.id` (UUID). Empty PopulationPort intersection → safe empty (no out-of-scope leakage via counts/facets/errors)
  - [x] Scope every get path used by list/quick-edit/palette (`getById` / identity update targets) with the same population intersection — deny/not-found must not distinguish out-of-scope from missing in a way that invents AR-ACCESS enumeration policy (keep existing uniform Persian deny / TODO(OQ-2) timing; do **not** invent timing/masking matrices)
  - [x] Support identifier/category filters from AC #1 when Data-Dictionary + category permission allow; omit forbidden fields from payload/DOM
  - [x] Deterministic ordering for the returned population (stable tie-break e.g. personnelCode + id); snapshot semantics for the UI table remain in `GovernedDataTable` (client filter/sort → page 1)
  - [x] PopulationPort honesty: if still on fixture registry, either (a) gate product claim behind explicit demo/fixture disclosure in Dev Agent Record + UI caption for Operators, or (b) fail-closed empty for non-demo — **never** label fixtures as “real workforce authz.” Do **not** execute full default-registry cutover unless all criteria in `population-cutover.ts` are met in this story (unlikely; prefer honesty + scoped wire)

- [x] Task 2: List-row projector from Epic 4 reads (AC: #1, #10)
  - [x] Map authorized Person ids → `PersonnelListRow` using projection/as-of helpers and/or batched `getCurrentPersonState` (avoid naive N+1 without documenting budget; prefer shared projector composing `projectPersonForRead`, employment/assignment/team as-of, contractual fields)
  - [x] `currentColleague` = yes/no from current employment/active membership semantics (align with “همکار فعلی”); Scheduled future must **not** pollute current columns
  - [x] Compensation column: `permitted: false` unless actor has `compensation.read` (category omit — never null-as-zero theater)
  - [x] Freshness fail-closed: if assembler returns recalc pending/failed/stale for a row, exclude or surface fail-closed — do not show stale “truth”
  - [x] Extend `PersonnelListRow` only if needed for Dept/BU/Job Title search display; keep EXPERIENCE visible headers; extra identifier fields may be filter-only / server-only when not in column set

- [x] Task 3: Wire `PersonnelListPanel` — swap fixtures (AC: #2–#6)
  - [x] UPDATE `apps/web/components/personnel/personnel-list-panel.tsx`: replace `PERSONNEL_LIST_FIXTURES` host with tRPC query; remove scaffold caption “اسکفولد تا داستان ۵.۱”
  - [x] Keep `GovernedDataTable` public contract unchanged — import from `@/components/governed-data-table`; **prefer zero primitive edits**
  - [x] Keep `PERSONNEL_SECTION_DEFAULT_FILTERS = { currentColleague: ["yes"] }`; clear-filters restores defaults (not wipe-all)
  - [x] Preserve sticky identifier (`personnelCode`) + `rowActions`; toolbar «افزودن سریع»; invalidate query after create/updateIdentity
  - [x] Empty → table empty state already uses `operationalCopy.emptySearch` + clear-filters inside primitive — verify still wired
  - [x] `exportSlot`: show only when export permission exists; otherwise omit/disable (full governed download = Story 6.5 — affordance may stub)
  - [x] Pattern reference: `access-people-panel.tsx` (query → table → invalidate) — Access is accounts, not workforce; copy **shape**, not domain

- [x] Task 4: Quick-edit / register / profile deep-link seams (AC: #5, #7)
  - [x] Keep `PersonnelQuickEditModal` + `PersonnelQuickCreateDialog`; enable real `person.updateIdentity` for UUID rows (remove fixture-only block message for real ids)
  - [x] «ثبت رویداد» → `requestNavigation(\`/personnel-events/register?person=${id}\`)` (already in list panel)
  - [x] Canonical profile deep-link for palette + quick-edit «باز کردن پروفایل کامل»: e.g. `/personnel/profile/[personId]` (thin placeholder page OK — full sections = **5.2**). Replace `PROFILE_HREF_PLACEHOLDER = "/personnel/list"`
  - [x] Leave-guard rules (Epic 4b retro — mandatory):
    - `isDirty` = **data-state** (field delta vs last-saved snapshot), **never** dialog `open` / visibility flags
    - Discard restores last-saved snapshot
    - Save resolves leave-guard Promise (`onSave` → `Promise<boolean>`)
    - Single dialog depth: quick-edit XOR create XOR leave-guard — no dialog-on-dialog
  - [x] Optional when touching create paths: dedupe Add panel vs QuickCreate form module (Epic 4b action #5) — nice-to-have if in touch radius; not a blocker if deferred with note

- [x] Task 5: Command palette same search (AC: #7)
  - [x] UPDATE `apps/web/lib/personnel-search.ts` `searchPersonnel` to call the same permission-safe server search (tRPC server caller or fetch to shared module) — preserve `PersonnelSearchHit` shape `{ id, label, href }`
  - [x] `href` = profile deep-link from Task 4; Enter already uses `requestNavigation`
  - [x] Do **not** invent AR-ACCESS enumeration-safe timing/copy (keep OQ-2 TODO unless AR signed)

- [x] Task 6: Verify + DoD (AC: #1–#10)
  - [x] NEW selfcheck: scope denial (out-of-scope id absent from results/counts); fixture/PopulationPort honesty assertion; row mapper helpers; regression `selfcheck:governed-table`
  - [x] Relevant package selfchecks green (`person-identity`, `temporal-authz`, `inference-bulk` as touched)
  - [x] `pnpm --filter @divan/web` typecheck + eslint on touched files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows

### Manual DoD checklist

- [x] Operator landing `/personnel/list`: همکار فعلی default on; dismissible; clear-filters restores yes
- [x] Out-of-scope Person never appears in rows, result count, or palette hits
- [x] Compensation column absent from DOM without permission
- [x] Sticky کد پرسنلی + row actions; horizontal scroll contained
- [x] Quick-edit dirty → Stay · Discard · Save; Save/Discard work while leave-guard pending (not gated on `open`)
- [x] «ثبت رویداد» prefill; inbound dirty register still leave-guards (4b.7 regression)
- [x] Palette search → Enter → profile deep-link via same search
- [x] No `GovernedDataTable` public API churn; no AG Grid; no Prisma in `apps/web`
- [x] Theme toggle / sidebar collapse still leave-guard exempt
- [x] Logout/authz `router.replace` bypass still known debt — do not silently “fix” without product exemption note

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Server person-org scope on search/list/get for this surface | Claim FR33 done with permission-only unscoped `person.list` |
| `authorize → PopulationPort → InferenceBulk → access event → payload` | Client-side-only filtering of a full dump as “permission-safe” |
| Consume Epic 4 projections/assembler for current columns | Invent parallel current-state SoT / CRUD mutation path |
| Bind UI to locked `GovernedDataTable` | Fork primitive / rewrite snapshot engine / AG Grid |
| PopulationPort honesty vs fixtures | Claim default registry cutover without `population-cutover.ts` criteria |
| Leave-guard dirty = data-state | Gate dirty on dialog open flags |
| AR-ACCESS / AR-TEMPORAL / AR-DATA / AR-REPORTING / AR-HEADCOUNT fail-closed | Invent production matrices, enumeration timing, or orphan-role policy |
| Labels: اطلاعات پرسنلی / فهرست پرسنل | Revert to Epic 1 «پرسنل» |

### Absolute non-goals

- Full profile sections (→ **5.2**); event timeline depth (→ **5.3**); dashboard/reports (→ **5.4/5.5**)
- Org-wide personnel-event list API (still `listForPerson` only — 4b.7)
- PopulationPort **full** default-registry cutover (unless criteria truly met — track honesty instead)
- AD-6 Prisma vs PoolClient unification; headcount `ensure*Schema` migrations-only; Vitest/ephemeral DB mandate
- Governed export artifact panel (→ **6.5**); artifact reauth (Epic 2 carry)
- Logout → `requestNavigation` (Epic 4b action #6 — document exemption if untouched)
- Inventing FR33 event/org/headcount search beyond **personnel** list scope of this story

### Epic 4b retrospective carry-ins (encode — do not rediscover)

From `epic-4b-retro-2026-07-24.md` (critical prep for 5.1):

1. **Leave-guard data-state:** dirty ≠ dialog visibility; Discard = snapshot restore; Save resolves Promise; single dialog depth
2. **Epic 4 carry:** person-org **IDOR**; PopulationPort honesty; consume assemblers; `GovernedDataTable` without contract churn
3. Shell completion ≠ permission-safe search — IDOR/PopulationPort unpaid until this story addresses them honestly
4. Team agreement: Epic 4b chrome is forward UX contract; list UIs bind to `GovernedDataTable`

From `epic-4-retro-2026-07-19.md`:

- “Permission-safe lists require **server-enforced person-org scope**, not permission checks alone.”
- IDOR on list/get was systemic; UI theater FR33 is the failure mode to prevent

### Previous story intelligence (4b.7 → 5.1)

**Replace, don’t rebuild** the list chrome:

| Path | Today | 5.1 change |
| --- | --- | --- |
| `personnel-list-panel.tsx` | `PERSONNEL_LIST_FIXTURES` + GovernedDataTable | Real scoped query |
| `personnel-list-types.ts` | `PersonnelListRow` | Extend if needed; keep EXPERIENCE columns |
| `lib/personnel-search.ts` | Stub `[]` | Same permission-safe search |
| `person.list` / `listPersons` | Unscoped `findMany` take 50 | Harden or bypass for FR33 |
| `GovernedDataTable` | Locked (4b.4) | **No churn** |
| Quick-edit / quick-create | Leave-guard patched in 4b.7 review | Preserve data-state dirty rules |

Review bugs already fixed in 4b.7 — **do not reintroduce:** dirty gated on `open`; inbound `?person=` remount without leave-guard; Save blocked on unresolved `listEnabledFields`.

### Architecture compliance

- **AD-2:** Projections are read models — list columns from projections/assembler, not new SoT
- **AD-5:** Coarse identity-access + fine envelope; UI visibility ≠ data access
- **AD-6:** Prisma only in modules/db; `apps/web` no `@prisma/client` (ESLint); tRPC exposes envelope-wrapped repos only
- Capability map: Search (FR-33) → reporting + projections (module orchestration via person-employment + identity-access + audit-envelope)
- Stack (repo): Next.js 16.2.x, tRPC 11.x, Prisma 7.8.x, React 19, Node 22 — follow existing package versions; no stack upgrade in this story

### File structure (expected touch)

**UPDATE (primary):**

- `apps/web/components/personnel/personnel-list-panel.tsx`
- `apps/web/components/personnel/personnel-list-types.ts`
- `apps/web/components/personnel/personnel-quick-edit-modal.tsx` (profile href + identity save)
- `apps/web/lib/personnel-search.ts`
- `apps/web/src/server/person.ts` (and/or new search helper module under `packages/modules/person-employment` + thin router)
- `apps/web/src/server/retrieval-control.ts` (reuse; extend only if needed)

**NEW (as needed):**

- List-row projector helper + `*.selfcheck.ts`
- Thin profile placeholder route under `apps/web/app/(app)/personnel/...` for deep-link
- Optional `personnel-list-helpers.ts` (mirror access-people-helpers)

**DO NOT modify (unless proven blocker + dedicated note):**

- `apps/web/components/governed-data-table/**` public contract
- Event-store / Operator mutation semantics
- Access admin domain APIs

### Library / framework requirements

- Reuse: `GovernedDataTable`, `useLeaveGuard` / `useLeaveGuardRegistration`, `operationalCopy`, `toPersianDigits` / `normalizeDigitsForMatch`, `intersectPopulation`, `evaluateInferenceBulk`, `getCurrentPersonState`
- No new grid libraries; no `@tanstack/react-table` as list engine; no AG Grid
- Pagination UX: GovernedDataTable client snapshot over the **already permission-filtered** row set (≈500 NFR envelope). Server returns scoped population with deterministic order — not infinite scroll. If payload size becomes an issue, document cursor plan in Completion Notes; do not break table snapshot contract without a primitive story

### Testing requirements

- Prefer thin helper selfchecks (project pattern) + at least one scope-denial oracle
- Do not claim DOM/keyboard/leave-guard covered by helper selfchecks (Epic 4b ceiling — honest)
- Scoped fixtures only; shared seed Teams are not cardinality oracles
- Run: `pnpm --filter @divan/web selfcheck:governed-table` + new personnel search selfcheck script wiring

### Latest technical notes (2026)

- Authz must live in tRPC/procedures — middleware/UI is not the security boundary
- Prefer deterministic `orderBy` with unique tie-breaker for stable pages
- Cursor pagination is industry default for large offsets; MVP may return full scoped set into GovernedDataTable snapshot given ~500 population — document choice; do not invent infinite scroll (banned in EXPERIENCE)

### Project context reference

- No root `project-context.md` found at activation; follow architecture spine + story Gates + package boundaries above
- IA: Operator lands on اطلاعات پرسنلی → فهرست پرسنل (`navigation.ts` / section tabs)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5 / Story 5.1]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-33, FR-47, FR-48]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — فهرست پرسنل, governed-data-table, UJ-1]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2/5/6]
- [Source: `_bmad-output/implementation-artifacts/epic-4b-retro-2026-07-24.md` — leave-guard + 5.1 prep]
- [Source: `_bmad-output/implementation-artifacts/epic-4-retro-2026-07-19.md` — IDOR + PopulationPort]
- [Source: `_bmad-output/implementation-artifacts/4b-7-personnel-events-shell-scaffolds-event-entry.md`]
- [Source: `_bmad-output/implementation-artifacts/4b-4-governed-data-table-primitive.md`]
- [Source: `_bmad-output/implementation-artifacts/4-9-current-person-state-projection.md`]
- [Source: `packages/modules/person-employment/src/population-cutover.ts`]
- [Source: `apps/web/src/server/retrieval-control.ts`]
- [Source: `apps/web/lib/personnel-search.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- PopulationPort default registry still fixture (`person:a1`); FR-33 **fail-closed** empty population + Operator disclosure until UUID registry cutover (no provisional stamp-all map).
- Single-person IDOR gate uses InferenceBulk channel `profile` so minimum-cohort does not block get/update.
- MVP returns full scoped set (≤500) into GovernedDataTable snapshot; N+1 assembler calls parallelized per authorized id (budget documented); `truncated` flag when capped.

### Completion Notes List

- Added `person.search` with authorize → PopulationPort → InferenceBulk → list-row projector; `person.list` hardened to same scoped search (no unscoped dump).
- Fixture PopulationPort → fail-closed empty + UI/Dev disclosure (not production workforce authz; not stamp-all UUID map).
- Scoped IDOR on `getById`, `getCurrentState`, `getByPersonnelCode`, `updateIdentity`, `setNationalId`, and profile placeholder (uniform NOT_FOUND / redirect).
- `PersonnelListPanel` wired to `api.person.search`; Job Title + mobile phone columns; compensation/contract columns gated by `compensation.read`; export stub only if `hasExportPermission` (always false until 6.5).
- Profile placeholder `/personnel/profile/[personId]`; palette `searchPersonnel` → same `person.search` via vanilla tRPC (empty query / errors → `[]`).
- AC #1 MVP: EXPERIENCE + phone + independent Job Title; **Dept/BU / national ID / email search deferred** (filter-only / later story).
- Deferred: Add panel vs QuickCreate form dedupe (Epic 4b action #5). Logout/`router.replace` leave-guard bypass remains known debt (Epic 4b action #6) — product exemption, not silently fixed.
- Selfchecks: `selfcheck:personnel-search`, `selfcheck:personnel-list-projector`, plus governed-table / person-identity / temporal-authz / inference-bulk green; web typecheck + eslint on touched files.
- Code review 2026-07-24: decisions (fail-closed, harden list, EXPERIENCE MVP) + patches applied.

### File List

- `apps/web/src/server/personnel-scoped-search.ts` (new)
- `apps/web/src/server/personnel-scoped-search-helpers.ts` (new)
- `apps/web/src/server/personnel-search.selfcheck.ts` (new)
- `apps/web/src/server/retrieval-control.ts`
- `apps/web/src/server/person.ts`
- `apps/web/components/personnel/personnel-list-panel.tsx`
- `apps/web/components/personnel/personnel-quick-edit-modal.tsx`
- `apps/web/lib/personnel-search.ts`
- `apps/web/lib/trpc/vanilla.ts` (new)
- `apps/web/app/(app)/personnel/profile/[personId]/page.tsx` (new)
- `apps/web/package.json`
- `packages/modules/person-employment/src/personnel-list-projector.ts` (new)
- `packages/modules/person-employment/src/personnel-list-projector.selfcheck.ts` (new)
- `packages/modules/person-employment/src/person.ts`
- `packages/modules/person-employment/src/index.ts`
- `packages/modules/person-employment/src/population-cutover.ts`
- `packages/modules/person-employment/package.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/5-1-permission-safe-personnel-search-lists.md`

### Review Findings

- [x] [Review][Decision] Provisional stamp-all map → **fail-closed** until UUID registry cutover (empty population + disclosure)
- [x] [Review][Decision] Unscoped `person.list` → **hardened** via same `runPersonnelScopedSearch` path
- [x] [Review][Decision] AC #1 → **EXPERIENCE MVP** + Job Title/phone this story; Dept/BU/national ID/email deferred

- [x] [Review][Patch] Gate `contractEndDate` / `contractParty` with `compensation.read`; omit placeholders when not permitted
- [x] [Review][Patch] Profile placeholder: UUID validate + `assertPersonInScopedPopulation`
- [x] [Review][Patch] Palette `searchPersonnel`: empty query / errors / non-browser → `[]`
- [x] [Review][Patch] Clear table rows when `searchQuery.isError`
- [x] [Review][Patch] Early `denied` when `actorScopeCodes.length === 0`
- [x] [Review][Patch] Surface `truncated` + Operator caption at `PERSONNEL_LIST_MAX_ROWS`
- [x] [Review][Patch] Independent `jobTitle` field + search haystack
- [x] [Review][Patch] Phone column filter on list surface
- [x] [Review][Patch] Normalize IDOR assert errors to uniform `PERSON_NOT_FOUND`
- [x] [Review][Patch] `searchPersonnel` browser-only no-op guard

- [x] [Review][Defer] Up to 500 parallel `getCurrentPersonState` per request — deferred, pre-existing MVP budget documented in story Completion Notes
- [x] [Review][Defer] `organizationalScope` uses only `actorScopeCodes[0]` in retrieval purpose — deferred, pre-existing multi-scope reduction pattern
- [x] [Review][Defer] Invalidate-after-save error feedback only — deferred, pre-existing toast/status pattern gap
- [x] [Review][Defer] Dept/BU / national ID / email list-search identifiers — deferred, AC #1 MVP EXPERIENCE + phone/Job Title only

### Change Log

- 2026-07-24: Story 5.1 — permission-safe personnel search/list, IDOR scope, projector, list/palette wire-up, fixture PopulationPort honesty disclosure; status → review.
- 2026-07-24: Code review triage — decision/patch/defer findings recorded.
- 2026-07-24: Code review apply — fail-closed population, harden `person.list`, EXPERIENCE MVP + patches; status → done.
