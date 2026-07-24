---
baseline_commit: 9fd0307
---

# Story 4b.7: Personnel & Events Shell Scaffolds + Event Entry Relocation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Operator,
I want اطلاعات پرسنلی and رویدادهای پرسنلی section shells with the Epic 4 event form hosted on ثبت رویداد,
so that UJ-1 shell entry points exist before full Epic 5 list/profile depth (UJ-1, UX-DR11, UX-DR28).

## Acceptance Criteria

1. **Given** the updated IA from Story 4b.3  
   **When** اطلاعات پرسنلی opens  
   **Then** section tabs are: فهرست پرسنل · افزودن · ورود گروهی · فرهنگ داده  
   **And** فرهنگ داده is **Admin-only** (`hr_admin`): omitted from the DOM for other roles; deep link → «دسترسی ندارید.» (audited via existing denial path)

2. **And** فهرست پرسنل uses shared `GovernedDataTable` with EXPERIENCE column headers (scaffold/fixture rows OK) and default filter **همکار فعلی = yes** (dismissible; clear-filters restores section defaults)  
   **And** full permission-safe FR33 search/wiring remains Story **5.1** — do not invent PopulationPort / IDOR policy here

3. **And** toolbar «افزودن سریع» opens a **minimal-create** dialog (dictionary-enabled Person fields only; reuse `person.create`)  
   **And** row action «اطلاعات کامل/ویرایش» opens `personnel-quick-edit-modal` (non-event fields; Save via `person.updateIdentity`; link «باز کردن پروفایل کامل» — link may target a placeholder/deep path until 5.2)  
   **And** dirty quick-edit: «تغییرات ذخیره نشده‌اند.» Stay · Discard · Save; block Esc/overlay dismiss, profile link, «ثبت رویداد», and shell nav until resolved (register with leave-guard; single dialog depth)

4. **When** رویدادهای پرسنلی opens  
   **Then** section tabs are: رویدادها · ثبت رویداد · ورود گروهی  
   **And** `/personnel-events` redirects to default tab رویدادها (`/personnel-events/events`)

5. **And** ثبت رویداد hosts the **existing** Epic 4 `PersonnelEventForm` (draft ≠ finalize; lifecycle Cancel/Reverse/Correct unchanged)  
   **And** the form is **removed** from `/personnel/list` (no stacked event form under the personnel list)

6. **And** row/nav/toolbar «ثبت رویداد» navigates to `/personnel-events/register?person=<personId>` (person pre-filled)  
   **And** inbound prefill while ثبت رویداد is dirty runs leave-guard first — **never** silent person swap

7. **And** رویدادها may be a scaffold `GovernedDataTable` (fixture/recent stub OK) with toolbar «ثبت رویداد»; full event-index depth is not required beyond shell chrome  
   **And** ورود گروهی tabs (personnel + events) remain thin placeholders (Epic 6 / day-to-day bulk later)

8. **And** ظرفیت و جذب keeps thin section-tab shells (هدکانت · ایجاد · ورود گروهی) for IA consistency — **no** headcount domain expansion; existing capacity panels stay on هدکانت

9. **And** full permission-safe search semantics, profile sections, and timeline depth remain **Epic 5**  
   **And** domain tRPC contracts from Epic 3/4 stay behaviorally equivalent — this story is **UI shell reshape** (+ prefill/leave-guard wiring on the existing form)

## Tasks / Subtasks

- [x] Task 1: Add رویدادهای پرسنلی to section-tab surfaces + route tree (AC: #4, #5, #7)
  - [x] Extend `apps/web/lib/section-tab-surfaces.ts` with surface `root: "/personnel-events"`:
    - tabs: `events` → `/personnel-events/events` («رویدادها»); `register` → `/personnel-events/register` («ثبت رویداد»); `bulk-import` → `/personnel-events/bulk-import` («ورود گروهی»)
    - `defaultTabId: "events"`; `surfaceLabel` / `ariaLabel` Persian per EXPERIENCE
  - [x] Replace placeholder `personnel-events/page.tsx` with index redirect → `defaultTabHref` (mirror `personnel/page.tsx`)
  - [x] Add `personnel-events/(tabs)/layout.tsx` using `SurfaceSectionTabsLayout`
  - [x] Add tab pages: `events`, `register`, `bulk-import` — each `assertPageAccess(..., "/personnel-events")` before any client work (Layout≠RSC)
  - [x] Remove `/personnel-events` from `SURFACE_LABELS` in `route-announcer.tsx` once it is tabbed (announcer must derive surface+tab from `section-tab-surfaces`)
  - [x] Prefer **zero** changes to `packages/modules/identity-access` nav matrix (already grants `/personnel-events`)

- [x] Task 2: Relocate `PersonnelEventForm` + person prefill (AC: #5, #6)
  - [x] Mount existing `PersonnelEventForm` **only** on `/personnel-events/register` (wrap in `Suspense` if using `useSearchParams`)
  - [x] Remove `<PersonnelEventForm />` (and any event-form-only chrome) from `personnel/(tabs)/list/page.tsx`
  - [x] Extend form API minimally — prefer optional props over a rewrite:
    - `initialPersonId?: string` and/or read `?person=` via `useSearchParams`
    - Apply prefill on mount / when clean URL param arrives
    - When dirty and inbound `person` differs from current `personId`: call `requestNavigation` / leave-guard resolve path **before** applying; Stay keeps current draft; Discard/Save then apply new person
    - Never overwrite dirty fields silently
  - [x] Preserve existing draft/finalize/lifecycle, capacity panel, leave-guard id `personnel-event-form`, platform-status draft handlers, `max-w-4xl`
  - [x] Do **not** nest the event form in a Dialog; it lives on the tab (DESIGN)

- [x] Task 3: Reshape فهرست پرسنل scaffold (AC: #1, #2, #3)
  - [x] Build `apps/web/components/personnel/personnel-list-panel.tsx` (client) consuming `GovernedDataTable` from `@/components/governed-data-table`
  - [x] Columns (Persian headers per EXPERIENCE; fixture accessors OK until 5.1): کد پرسنلی · نام · نام خانوادگی · تیم · نقش · نردبان · گرید · نوع همکاری · جبران خدمت (`permitted: false` unless a real permission gate exists) · تاریخ پایان قرارداد · طرف قرارداد · همکار فعلی
  - [x] `sectionDefaultFilters`: `{ currentColleague: ["yes"] }` (or equivalent enum id) — clear ≠ wipe-all
  - [x] Toolbar: primary «افزودن سریع» opens minimal-create Dialog; optional caption/count OK
  - [x] `rowActions`: always-visible (≥1280 posture) links/buttons «اطلاعات کامل/ویرایش» + «ثبت رویداد»
  - [x] «ثبت رویداد» → `requestNavigation(\`/personnel-events/register?person=${id}\`)` (not bare `router.push`)
  - [x] Data source for this story: **fixture rows** (evolve `GovernedDataTableFixtureDemo` into the list panel **or** inline fixtures). Optional: also show a thin real `person.list` strip elsewhere is **discouraged** — avoid stacked unrelated panels (EXPERIENCE anti-pattern). Prefer one table.
  - [x] Retire/relocate stacked list content: remove `GovernedDataTableFixtureDemo` host heading from list page; move `PersonnelPanel` create/list/dictionary away from list (split into add / dictionary / quick-create); relocate or drop `CurrentPersonStateForeshadow` / `PersonnelDemoSection` from default Operator landing (demo utilities must not dominate UJ-1 — move under افزودن, a collapsible admin-only area, or delete if redundant)

- [x] Task 4: `personnel-quick-edit-modal` + «افزودن سریع» (AC: #3)
  - [x] Add `apps/web/components/personnel/personnel-quick-edit-modal.tsx` (canonical id; DESIGN `max-w-3xl`)
  - [x] Fields: dictionary-enabled non-event identity fields only (`givenName`, `familyName`, `mobilePhone`, etc. via `listEnabledFields`) — **no** event registration, employment, or compensation mutation
  - [x] Save → `person.updateIdentity`; Cancel ghost; text link «باز کردن پروفایل کامل» (href may be `/personnel/...` placeholder or `#` with Persian “به‌زودی” only if no profile route — prefer a stable deep-link path Epic 5 will own)
  - [x] Dirty: register leave-guard (unique id); suppress Dialog dismiss while dirty unless Stay/Discard/Save resolved; do not open a second dialog over leave-guard
  - [x] «افزودن سریع»: small Dialog with required enabled fields → `person.create`; on success invalidate list query / refresh fixture host if still fixture-only; clear dirty + close
  - [x] Single dialog depth globally (quick-edit XOR create XOR leave-guard — never stack)

- [x] Task 5: افزودن · فرهنگ داده · ورود گروهی shells (AC: #1, #7)
  - [x] `personnel/add`: full create form (extract from `PersonnelPanel` create path) — leave-guard when dirty; `max-w-*` consistent with form posture (not full-bleed table)
  - [x] `personnel/dictionary`: show dictionary registry UI (extract from `PersonnelPanel` dictionary summary / `person.listDictionary`) — **gate** page to `hr_admin` (throw `PageAccessDeniedError` or reuse AccessDenied surface); filter dictionary tab out of `SectionTabs` for non-admin (pass filtered `tabs` into layout or extend `SurfaceSectionTabsLayout` with optional `tabs` override)
  - [x] `personnel/bulk-import` + `personnel-events/bulk-import`: keep `SectionTabPlaceholder` (dual-entry note: day-to-day bulk later; sidebar ورود داده = advanced wizard)
  - [x] Prefer deleting or thinning monolithic `personnel-panel.tsx` once split — do not leave duplicate create UIs

- [x] Task 6: رویدادها scaffold + headcount shell hygiene (AC: #7, #8)
  - [x] `personnel-events/events`: scaffold `GovernedDataTable` (fixture events: person label, type, effective date, status badge kinds if easy) + toolbar «ثبت رویداد» → `/personnel-events/register`
  - [x] **API gap (do not invent):** tRPC today exposes `personnelEvent.listForPerson` only — **no** org-wide / recent-all events list. Do **not** add a new list-all procedure in 4b.7. Options: (a) fixture rows for chrome, or (b) optional thin “enter personId → `listForPerson`” demo strip. Full catalogue = Epic 5+
  - [x] Headcount: keep existing `(tabs)` shells; on `capacity/page.tsx` drop redundant page-level `h1` «ظرفیت و جذب» if chrome already announces surface (same lesson as 4b.6); create/bulk-import stay placeholders — **no** new headcount domain APIs

- [x] Task 7: Verify + DoD (AC: #1–#9)
  - [x] `pnpm --filter @divan/web` typecheck + eslint on **touched** files
  - [x] `pnpm --filter @divan/web selfcheck:governed-table` if table contract touched
  - [x] `pnpm --filter @divan/identity-access` navigation selfcheck only if nav touched (prefer not)
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done later
  - [x] BOM-safe edit of `sprint-status.yaml` on Windows (UTF-8 **without** BOM)

### Manual DoD checklist

- [x] `/personnel` → `/personnel/list`; tabs فهرست · افزودن · ورود گروهی · فرهنگ داده (فرهنگ داده only for `hr_admin`)
- [x] `/personnel-events` → `/personnel-events/events`; tabs رویدادها · ثبت رویداد · ورود گروهی
- [x] List table: default همکار فعلی = yes; clear-filters restores defaults; sticky id + row actions visible
- [x] «افزودن سریع» creates Person (or fixture demo path documented); quick-edit dirty blocks Esc / profile / ثبت رویداد / sidebar
- [x] «ثبت رویداد» from list → register tab with person pre-filled
- [x] Dirty register form + inbound `?person=` different id → leave-guard; Stay does not swap; Discard/Save then swap
- [x] `PersonnelEventForm` absent from `/personnel/list`; draft ≠ finalize still works on register tab
- [x] Operator deep link `/personnel/dictionary` → دسترسی ندارید
- [x] Theme toggle / sidebar collapse still exempt from leave-guard
- [x] Light + dark readable; no AG Grid; no `@prisma/client` in client; no stacked unrelated panels on list
- [x] Route announcer: `رویدادهای پرسنلی — ثبت رویداد` (surface — tab)

### Review Findings

- [x] [Review][Patch] Leave-guard Save/Discard broken: dirty gated on `open`/`featureDialogOpen` — when leave-guard pending hides dialog, `isDirty` clears so Save/Discard no-ops (org modals gate dirty on modal kind, not open) [`personnel-quick-edit-modal.tsx:89`, `personnel-quick-create-dialog.tsx:82`, `personnel-list-panel.tsx:170`]
- [x] [Review][Patch] Finalize conflict path regression: removed evaluate→`setConflicts` effect; `activeConflicts` length gate falls back to empty/`conflicts` while evaluate loading; `confirmDisabled` ignores `evaluateQuery.isLoading`/`isError` [`personnel-event-form.tsx:657`, `personnel-event-form.tsx:1782`]
- [x] [Review][Patch] Inbound `?person=` uses remount `key` with no dirty check — silent draft wipe if searchParams change without `requestNavigation` (AC #6 / Task 2) [`personnel-event-form-host.tsx:16`]
- [x] [Review][Patch] Quick-edit Save can run before `listEnabledFields` resolves — empty field payload [`personnel-quick-edit-modal.tsx:104`]
- [x] [Review][Patch] Dictionary success with empty list shows blank panel — add empty state [`personnel-dictionary-panel.tsx:37`]
- [x] [Review][Patch] Dictionary status shows English `enabled`/`disabled` in Persian UI [`personnel-dictionary-panel.tsx:50`]
- [x] [Review][Patch] Duplicate JSDoc comment in route-announcer [`route-announcer.tsx:12`]
- [x] [Review][Patch] Quick-create assumes `row.id!` — guard nullish id before insert [`personnel-quick-create-dialog.tsx:109`]
- [x] [Review][Patch] Unused orphan demos still in repo after list cleanup — delete or stop exporting (`PersonnelDemoSection`, `CurrentPersonStateForeshadow`, `GovernedDataTableFixtureDemo`) [`personnel-demo-section.tsx`, `current-person-state-foreshadow.tsx`, `fixture-demo.tsx`]
- [x] [Review][Defer] Duplicated person-create form between AddPanel and QuickCreate — deferred, pre-existing tech-debt pattern from split
- [x] [Review][Defer] Incomplete `aria-describedby`/`aria-invalid` vs retired PersonnelPanel — deferred, pre-existing polish

## Dev Notes

### Epic context

- **Epic 4b:** Shell & IA Alignment to `ux-divan-2026-07-19` — **presentation first**; domain APIs unchanged unless thin UI wiring. Authorized by `sprint-change-proposal-2026-07-19`.
- **This story:** Close Epic 4b — UJ-1 shell entry (فهرست → quick-edit → ثبت رویداد prefill → رویدادها scaffold). Last story before Epic 5.
- **Order:** `4b.1`–`4b.6` done → **`4b.7`** → Epic 5 (`5.1` owns real FR33 list).
- **FRs / UX-DRs:** FR43 presentation; UX-DR11 (`personnel-event-form` on ثبت رویداد); UX-DR28 (quick-edit); UX-DR7 table reuse; UX-DR25 tabs/leave-guard already shipped.
- **Open retro carry-ins (encode, do not silently “fix”):** Epic 4 action — person-org IDOR + PopulationPort honesty belongs in **5.1** Dev Notes (scaffold must not pretend FR33 is done). Profile/timeline consumer contract → **5.2 / 5.3**.

### Locked decisions (do not reopen)

| Decision | Value | Rationale |
| --- | --- | --- |
| Scope | UI shells + relocate existing event form + prefill/leave-guard | Story AC + SCP |
| List data | Fixture/scaffold OK | Full FR33 = 5.1 |
| Event form location | `/personnel-events/register` only | UX-DR11; 4b.2 deferred this |
| Prefill param | `?person=<uuid>` | Simple; spine “person pre-filled” |
| Inbound dirty prefill | Leave-guard first; never silent swap | EXPERIENCE State Patterns |
| Quick-edit id | `personnel-quick-edit-modal` | DESIGN/EXPERIENCE canonical |
| Dictionary visibility | `hr_admin` only | EXPERIENCE Admin-only |
| Dialog depth | One | SCP / EXPERIENCE |
| Domain | No personnel-event / person rule invention | Epic 3/4 preserve |
| Headcount | Thin shells only | AC #8 |
| Events tab data | Fixture (or optional `listForPerson` only) — **no** new list-all API | Only `listForPerson` exists today |
| Filter state | Local (not URL) for tables | Same as 4b.4–4b.6 |

### Absolute non-goals

| Out of scope | Belongs to |
| --- | --- |
| Permission-safe Person search, IDOR, PopulationPort cutover | **5.1** |
| Profile sections / full «پروفایل کامل» | **5.2** |
| Event timeline / correction-from-timeline UX depth | **5.3** |
| Real bulk import / staging | **Epic 6** |
| Org-wide personnel-event list API | Out — only `listForPerson` exists; catalogue later |
| Changing draft/finalize/conflict/headcount domain rules | Epic 4 (done) |
| Inventing AR-TEMPORAL / AR-ACCESS matrices | Fail-closed existing only |
| AG Grid, infinite scroll, `packages/ui`, Prisma in web | Never |
| Nav IA / landings renames | **4b.3** done |
| New tree-navigator work | **4b.6** done |

### Current code state (UPDATE targets)

| File / area | Today | This story changes | Must preserve |
| --- | --- | --- | --- |
| `personnel-events/page.tsx` | `PlaceholderPage` only | Redirect + `(tabs)` tree | `assertPageAccess` |
| `section-tab-surfaces.ts` | No `/personnel-events` surface | Add 3-tab surface | Existing surfaces |
| `route-announcer.tsx` | `/personnel-events` in `SURFACE_LABELS` | Remove once tabbed | Polite live region |
| `personnel/(tabs)/list/page.tsx` | Stacked: fixture demo + PersonnelPanel + foreshadow + **PersonnelEventForm** + demo | List panel + quick-edit/create only | Auth gate |
| `personnel-event-form.tsx` | Lives on list; leave-guard; no `?person=` API | Prefill + dirty inbound guard; host on register | Draft≠finalize, capacity, lifecycle |
| `personnel-panel.tsx` | Create + list + dictionary monolith | Split → add / dictionary / quick-create | `person.*` mutation semantics + messageFa |
| `personnel-quick-edit-modal` | **Missing** | Create | Non-event fields only |
| `GovernedDataTable` / fixture-demo | Demo on list | Evolve into personnel list (+ events scaffold) | Public contract; no fork |
| `headcount/(tabs)/*` | Capacity has real panels; create/bulk placeholder | Optional heading hygiene | Domain panels |
| `identity-access/navigation.ts` | Events nav already shipped | Prefer **no** change | Prefix safety `/personnel-events` |
| leave-guard | Shell registry ready | Wire quick-edit + inbound prefill | Theme/collapse exempt |

### Architecture compliance (MUST follow)

| Rule | Implication |
| --- | --- |
| **AD-5** | Coarse nav ≠ authorization. Keep `governedProcedure` + existing person / personnel-event permissions. UI omit ≠ authz. |
| **AD-6** | Next App Router; Persian RTL; **no** `@prisma/client` in `apps/web`; modules only via tRPC |
| **Layout≠RSC** | Every new `page.tsx`: `auth()` + `assertPageAccess` before client data panels |
| UX authority | Forward contract = `ux-divan-2026-07-19`. **Spine wins over mocks** |
| Consistency | Lists = `governed-data-table`; chrome = `section-tabs`; forms = leave-guard; event form max-w-4xl |

[Source: `ARCHITECTURE-SPINE.md` AD-5/AD-6; `epics.md` Epic 4b / Story 4b.7; `EXPERIENCE.md` اطلاعات پرسنلی / رویدادهای پرسنلی / UJ-1; `DESIGN.md` personnel-event-form / personnel-quick-edit-modal; `prd.md` FR-43]

### Previous story intelligence (4b.6)

- Split monoliths into tab-scoped panels; **do not** leave stacked unrelated panels on one tab (list currently stacks 5 sections — primary regression risk for 4b.7).
- Reuse `GovernedDataTable` + `sectionDefaultFilters`; clear-filters ≠ wipe-all.
- Leave-guard on dirty modals; suppress Dialog while leave-guard pending (single dialog depth) — same pattern as org create/edit.
- Prefer zero domain/server contract churn; thin UI wiring only.
- Drop redundant page `h1` when surface chrome already labels the section.
- BOM: never rewrite `sprint-status.yaml` with UTF-8 BOM on Windows.
- Review lessons from 4b.2 still apply: Discard must restore last-saved snapshot (event form already patched); sidebar same-surface skip must treat `/personnel` vs `/personnel/list` as same surface; Save path must resolve leave-guard Promise.

### Git intelligence summary

Recent commits: `9fd0307` story 4b.6 review; `87e8a02` story 4b.6; `fedf948` 4b.5; `51d7ad7` 4b.4; `348b246` 4b.3. Pattern: 4b.x commits touch `apps/web` presentation + story md + sprint-status; domain packages untouched unless thin tRPC wrap. 4b.3 already added empty `/personnel-events` placeholder and nav entry — this story fills tabs + relocates the form.

### Latest tech notes

- **Next.js 16.2.x** (apps/web): `useSearchParams()` in Client Components must sit under `<Suspense>` or production build fails. Prefer reading `?person=` in a small client wrapper around `PersonnelEventForm`.
- Server pages: if reading `searchParams` prop, treat as `Promise` and `await` (Next 15+ contract).
- Prefill navigation must go through `requestNavigation` so dirty shell surfaces guard correctly.
- No new leave-guard libraries — reuse `useLeaveGuardRegistration` / `useLeaveGuard().requestNavigation`.
- WAI-ARIA: row actions are buttons/links (not hover-only); quick-edit Dialog focus trap via existing shadcn Dialog.

### Project structure notes

- New/update under `apps/web/components/personnel/` (list panel, quick-edit modal; form stays)
- New routes: `apps/web/app/(app)/personnel-events/(tabs)/…`
- Config: `apps/web/lib/section-tab-surfaces.ts`
- No new package; no `packages/ui`
- Mock reference: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/mockups/key-personnel-list.html`

### Testing requirements

| Layer | Command / action |
| --- | --- |
| Table primitive | `pnpm --filter @divan/web selfcheck:governed-table` if touched |
| Nav | identity-access navigation selfcheck only if matrix touched |
| Web | typecheck + eslint touched files |
| Manual | DoD checklist; smoke `hr_operator` vs `hr_admin` dictionary tab; dirty prefill path |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4b / Story 4b.7 / UX-DR11 / UX-DR28]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-19.md` — Story 4b.7]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — Section tabs, UJ-1, State Patterns]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/DESIGN.md` — personnel-event-form / personnel-quick-edit-modal]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/mockups/key-personnel-list.html`]
- [Source: `_bmad-output/implementation-artifacts/4b-6-organization-section-tabs-tree-navigators.md`]
- [Source: `_bmad-output/implementation-artifacts/4b-3-sidebar-ia-labels-role-landings.md`]
- [Source: `_bmad-output/implementation-artifacts/4b-2-section-tabs-chrome-routing-leave-guards.md`]
- [Source: `apps/web/components/personnel/personnel-event-form.tsx`]
- [Source: `apps/web/app/(app)/personnel/(tabs)/list/page.tsx`]
- [Source: `apps/web/app/(app)/personnel-events/page.tsx`]
- [Source: `apps/web/lib/section-tab-surfaces.ts`]
- [Source: `apps/web/components/leave-guard/`]
- [Source: `packages/modules/identity-access/src/navigation.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Prefill strategy: `PersonnelEventFormHost` remounts form via `key=?person=` only after leave-guard `requestNavigation` succeeds — Stay keeps current draft URL/state.
- Fixture list rows use `fixture-*` ids; `person.updateIdentity` save blocked with Persian scaffold message until 5.1; `person.create` from «افزودن سریع» prepends real UUID rows into the fixture host.

### Completion Notes List

- Added `/personnel-events` 3-tab surface (events / register / bulk-import) with index redirect and Layout≠RSC asserts.
- Relocated `PersonnelEventForm` to ثبت رویداد; removed stacked event form / PersonnelPanel / demos from فهرست.
- Built personnel list scaffold (`GovernedDataTable` + EXPERIENCE columns + همکار فعلی default), quick-create, quick-edit modal with leave-guard + single dialog depth.
- Split add / dictionary shells; dictionary Admin-only (tab omit + AccessDenied + `recordAccessDenial`).
- Events scaffold fixture table; headcount capacity dropped redundant h1; deleted monolithic `personnel-panel.tsx`.
- Verified: `tsc --noEmit`, eslint on touched files (0 errors), `selfcheck:governed-table` ok. Nav matrix untouched.

### File List

- apps/web/lib/section-tab-surfaces.ts
- apps/web/components/route-announcer.tsx
- apps/web/components/surface-section-tabs-layout.tsx
- apps/web/app/(app)/personnel-events/page.tsx
- apps/web/app/(app)/personnel-events/(tabs)/layout.tsx
- apps/web/app/(app)/personnel-events/(tabs)/events/page.tsx
- apps/web/app/(app)/personnel-events/(tabs)/register/page.tsx
- apps/web/app/(app)/personnel-events/(tabs)/bulk-import/page.tsx
- apps/web/app/(app)/personnel/(tabs)/layout.tsx
- apps/web/app/(app)/personnel/(tabs)/list/page.tsx
- apps/web/app/(app)/personnel/(tabs)/add/page.tsx
- apps/web/app/(app)/personnel/(tabs)/dictionary/page.tsx
- apps/web/app/(app)/personnel/(tabs)/bulk-import/page.tsx
- apps/web/app/(app)/headcount/(tabs)/capacity/page.tsx
- apps/web/components/personnel/personnel-event-form.tsx
- apps/web/components/personnel/personnel-event-form-host.tsx
- apps/web/components/personnel/personnel-list-panel.tsx
- apps/web/components/personnel/personnel-list-types.ts
- apps/web/components/personnel/personnel-quick-create-dialog.tsx
- apps/web/components/personnel/personnel-quick-edit-modal.tsx
- apps/web/components/personnel/personnel-add-panel.tsx
- apps/web/components/personnel/personnel-dictionary-panel.tsx
- apps/web/components/personnel/personnel-events-list-panel.tsx
- apps/web/components/personnel/personnel-panel.tsx (deleted)
- _bmad-output/implementation-artifacts/4b-7-personnel-events-shell-scaffolds-event-entry.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-07-24: Implemented Story 4b.7 — personnel/events shells, event form relocation + prefill, list/quick-edit scaffolds; status → review.
- 2026-07-24: Code review patches applied (leave-guard dirty, evaluate conflicts, inbound ?person=, dictionary/a11y cleanup); status → done.

---

**Completion note:** Story implementation + code-review patches complete.
