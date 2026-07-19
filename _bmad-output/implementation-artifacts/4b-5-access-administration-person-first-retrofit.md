---
baseline_commit: 51d7ad7
---

# Story 4b.5: Access Administration Person-First Retrofit

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want دسترسی‌ها organized as افراد و دسترسی · نقش‌ها · محدوده‌ها · دسترسی اضطراری,
so that I answer “who can do what?” from people first (UX-DR27, UJ-Access, FR4 UI).

## Acceptance Criteria

1. **Given** an Admin with access-administration permission on سطح دسترسی‌ها  
   **When** the Access surface opens  
   **Then** section tabs match EXPERIENCE / `mockups/key-access-admin.html`: افراد و دسترسی · نقش‌ها · محدوده‌ها · دسترسی اضطراری

2. **And** افراد و دسترسی is a person-first **governed table** for accounts → roles/scopes, directory link, active status

3. **And** نقش‌ها and محدوده‌ها preserve Story 2.3 attributable create/change behavior and toxic fail-closed rules

4. **And** OrganizationalScope CRUD remains **label + active** (not org units)

5. **And** دسترسی اضطراری uses distinct **warning posture** for break-glass administration entry points already delivered in Epic 2

6. **And** empty entitlements still show «تخصیص دسترسی‌ای ثبت نشده.»

7. **And** domain APIs and audit evidence from Epic 2 are **unchanged** — this story is **UI reshape only**

8. **And** no dialog-on-dialog; dirty create/assign forms register with the existing shell leave-guard (4b.2)

## Tasks / Subtasks

- [x] Task 1: Split monolith into tab-scoped panels (AC: #1, #7)
  - [x] Keep `apps/web/app/(app)/access/(tabs)/layout.tsx` + `SECTION_TAB_SURFACES` `/access` tabs as-is (4b.2/4b.3 — do not rename tabs or hrefs)
  - [x] Replace `SectionTabPlaceholder` on `/access/roles`, `/access/scopes`, `/access/break-glass` with real panels
  - [x] Refactor `access-admin-panel.tsx` out of the stacked mega-page into focused components under `apps/web/components/access/` (suggested names — adjust if clearer):
    - `access-people-panel.tsx` — person-first table + row selection + link/status/assign
    - `access-roles-panel.tsx` — permission sets + roles create/list (+ EntitlementGrantsPanel — see Locked decisions)
    - `access-scopes-panel.tsx` — OrganizationalScope label + active list/create
    - Keep `break-glass-panel.tsx` / `entitlement-grants-panel.tsx` as existing modules; only re-host
  - [x] Wire pages:
    - `people/page.tsx` → people panel only (`currentAccountId` from session)
    - `roles/page.tsx` → roles panel
    - `scopes/page.tsx` → scopes panel
    - `break-glass/page.tsx` → break-glass panel with warning chrome
  - [x] Remove stacked `EntitlementGrantsPanel` + `BreakGlassPanel` + roles/scopes/people from a single scroll page (EXPERIENCE rejects stacked unrelated panels)
  - [x] Drop `max-w-5xl` constraint on Access content so governed table can use full content width (DESIGN full-bleed content region)
  - [x] Preserve `assertPageAccess(session.user.coarseRole, "/access")` on every tab page
  - [x] **Do not** change `packages/modules/identity-access/**`, Prisma schema, or tRPC procedure contracts in `apps/web/src/server/access-admin.ts` except trivial import/re-export if needed for typing — prefer zero server edits

- [x] Task 2: Person-first `GovernedDataTable` on افراد و دسترسی (AC: #2, #6)
  - [x] Import `GovernedDataTable` from `@/components/governed-data-table` (4b.4 public contract — **do not** fork snapshot engine)
  - [x] Data source: existing `api.accessAdmin.listEntitlements` (`EntitlementRow`) — accounts, not workforce Person search
  - [x] Column map (Persian headers; match mock intent):
    | id | header | filter | sticky | notes |
    | --- | --- | --- | --- | --- |
    | displayName | نام نمایشی | text | identifier | primary id column |
    | username | حساب | text | — | |
    | roles | نقش‌ها | enum (multi) | — | accessor = joined `accessRoleCodes` or first code for enum match; cell shows join with «، » |
    | scopes | محدوده | text | — | joined `organizationalScopeLabels` |
    | status | وضعیت | enum | — | values `active`/`inactive`; labels فعال/غیرفعال |
    | directory | پیوند دایرکتوری | enum | — | e.g. linked / unlinked from `externalDirectoryId` |
    | actions | اقدامات | — | via `rowActions` | always visible buttons |
  - [x] `getRowId`: `row.accountId`
  - [x] `sectionDefaultFilters`: at least one non-empty default (recommend `status: ["active"]`) so «پاک کردن فیلترها» ≠ wipe-all
  - [x] `aria-label`: e.g. «جدول افراد و دسترسی»
  - [x] Toolbar/caption (person-first mental model — mock): short caption that accounts come first, then roles/scopes/status from the same table
  - [x] Row selection: clicking row / identifier selects account for the detail/actions region below (preserve today’s link/status/assign mutations)
  - [x] Row actions (visible, not hover-only): «تخصیص نقش»، «محدوده»، «فعال‌سازی» (or equivalent that call existing `assignAccountRoles` / `assignAccountScopes` / `setAccountStatus`) — improve beyond “first in list” MVP **only if** still using the same APIs (multi-select of existing roles/scopes in a **single** dialog or inline panel — no nested dialogs)
  - [x] Empty entitlements (AC #6): when **no** account has roles **and** no account has scopes (same predicate as current panel), surface `operationalCopy.emptyEntitlements` as a **status/banner above** the table — **do not** hide the accounts table (person-first must still find accounts). Filter-empty body uses `operationalCopy.emptySearch` + clear-filters from GovernedDataTable
  - [x] Loading/error: reuse existing StatusMessage patterns (role=status / alert)

- [x] Task 3: Roles + scopes tabs preserve 2.3 behavior (AC: #3, #4, #7)
  - [x] Move permission-set list + create form and role list + create form to `/access/roles` unchanged in mutation semantics (`createPermissionSet`, `createRole`)
  - [x] Move scope list + create form to `/access/scopes` (`createScope` with `labelFa`; show active/inactive — **never** org-unit tree or hierarchy APIs). Existing `updateScope` may be wired for label/active toggle if the old UI lacked it — still **no new** domain endpoints
  - [x] Toxic / self-approval: still fail-closed via existing server messages; show Persian `err.message` with `role="alert"` — do not soften or invent AR-ACCESS matrix
  - [x] Host `EntitlementGrantsPanel` on **نقش‌ها** as a clearly labeled secondary section (lifecycle UI from 2.4 must remain reachable; must **not** stay stacked on people). Pass `currentAccountId` as today
  - [x] Register leave-guard on dirty create forms (role/set/scope label fields non-empty or grants draft dirty if applicable) via `useLeaveGuardRegistration` — same pattern as personnel event form

- [x] Task 4: Break-glass tab warning posture (AC: #5, #7)
  - [x] Mount existing `BreakGlassPanel` **only** on `/access/break-glass` (remove from people)
  - [x] Wrap with distinct warning chrome using DESIGN tokens: `bg-break-glass-banner-background`, `text-break-glass-banner-foreground`, `border-break-glass-banner-border` (or equivalent Tailwind theme tokens already wired in `globals.css`)
  - [x] Keep titles/hints from `operationalCopy.breakGlassRequestTitle` / `breakGlassRequestHint`
  - [x] **Do not** change break-glass tRPC procedures, elevation rules, or export/admin deny semantics

- [x] Task 5: Verify + DoD (AC: #1–#8)
  - [x] Regression: `pnpm selfcheck:access-admin` (and lifecycle/break-glass selfchecks if package scripts exist)
  - [x] `pnpm --filter @divan/web` typecheck + eslint on **touched** files only
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done later
  - [x] BOM-safe edit of `sprint-status.yaml` on Windows (UTF-8 **without** BOM)

### Manual DoD checklist

- [x] All four Access tabs navigate; default `/access` → `/access/people`
- [x] People: GovernedDataTable filters/sort/page/sticky id+actions; clear filters restores section defaults
- [x] People: select account → link / status / assign still work; toxic failure shows Persian reason (no success tease)
- [x] Empty-assignments banner shows exact «تخصیص دسترسی‌ای ثبت نشده.» when predicate matches; accounts still listed
- [x] Roles: create permission set + role; EntitlementGrantsPanel reachable; scopes tab only label+active
- [x] Break-glass tab visually distinct (warning tokens); panel functions as before
- [x] Dirty form + tab switch / sidebar → leave-guard dialog (one dialog only)
- [x] Light + dark: sticky columns opaque; warning chrome readable
- [x] No `@prisma/client` in client; no AG Grid / infinite scroll / `@tanstack/react-table`

## Dev Notes

### Epic context

- **Epic 4b:** Shell & IA Alignment to `ux-divan-2026-07-19` — **presentation only**; domain APIs unchanged. Authorized by `sprint-change-proposal-2026-07-19`.
- **This story:** UX-DR27 / UJ-Access — retrofit Story **2.3** Access UI (plus re-host 2.4/2.5 panels) to person-first section tabs.
- **Order:** `4b.1`–`4b.4` done → **`4b.5` ∥ `4b.6`** → `4b.7` → Epic 5.
- **FRs:** FR4 (governed access admin) **UI reshape**; FR43 presentation; FR2 least privilege (UI visibility ≠ data access). **Not** FR33 personnel search.

### Locked decisions (do not reopen)

| Decision | Value | Rationale |
| --- | --- | --- |
| Scope | **UI reshape only** | Story AC + sprint-change-proposal |
| Tabs chrome | Reuse 4b.2 `section-tabs` / `SECTION_TAB_SURFACES` | Already match EXPERIENCE labels |
| People table | **`GovernedDataTable`** (4b.4) | UX-DR7; first real consumer |
| Filter state URL | **Local state** (not query string) | Same as 4b.4 — avoid sensitive residue |
| Empty entitlements | Banner/status + **keep table of accounts** | Person-first + exact copy AC |
| EntitlementGrantsPanel | Host on **نقش‌ها** | Preserve 2.4 UI without stacking on people |
| BreakGlassPanel | **Only** دسترسی اضطراری tab | UJ-Access step 4 |
| OrganizationalScope | label + active only | UX-DR27; ≠ org units (4b.6) |
| Server/domain | No API / audit / toxic rule changes | AC #7 |
| Dialog depth | Single dialog stack | SCP / EXPERIENCE modal depth |
| Accounts vs Person | `listEntitlements` / InternalAccount | Not Epic 5 workforce search |

### Absolute non-goals

| Out of scope | Belongs to |
| --- | --- |
| Changing identity-access domain APIs, Prisma, toxic matrix, audit evidence | Epic 2 (done) — preserve |
| Inventing full AR-ACCESS matrix | Still pending — fail-closed existing only |
| New break-glass elevation / entitlement lifecycle features | 2.4 / 2.5 already delivered |
| Temporal as-of authz, inference bulk | 2.6 / 2.7 |
| Org unit tree / `tree-navigator` | **4b.6** |
| Personnel scaffolds / event entry relocate | **4b.7** |
| Permission-safe Person search, IDOR, PopulationPort cutover | **5.1** (+ epic-4 action items) |
| Export artifact panel / reauth | **6.5** / Epic 7 |
| AG Grid, infinite scroll, `packages/ui`, Prisma in web | Never |
| LDAP group→role sync | Forbidden (2.3) |
| Nav IA / landings renames | **4b.3** done |

### Current code state (UPDATE targets)

| File / area | Today | This story changes | Must preserve |
| --- | --- | --- | --- |
| `access/(tabs)/people/page.tsx` | Renders full `AccessAdminPanel` monolith | People panel only | `assertPageAccess`, session gate |
| `access/(tabs)/roles\|scopes\|break-glass/page.tsx` | `SectionTabPlaceholder` | Real tab content | Auth gates |
| `access/(tabs)/layout.tsx` | `SurfaceSectionTabsLayout` | Prefer **no** change | Tabs a11y |
| `components/access/access-admin-panel.tsx` | Stacked: grants + BG + raw `<table>` + sets + scopes + roles + link/status | Split / replace with focused panels; may delete or thin to re-export | Mutation wiring semantics |
| `entitlement-grants-panel.tsx` | Embedded in monolith | Re-host on roles tab | 2.4 behavior |
| `break-glass-panel.tsx` | Embedded in monolith | Re-host on BG tab + warning chrome | 2.5 behavior |
| `governed-data-table/*` | Ready (4b.4) | **Consume** — do not modify contract unless bug blocking consumer | Public types/props |
| `src/server/access-admin.ts` + `identity-access` access-admin | Full tRPC + domain | **No contract change** | Toxic, attribution, evidence |
| `lib/section-tab-surfaces.ts` | Access tabs defined | No label/href churn | `/access/*` |
| `lib/operational-copy.ts` | `emptyEntitlements`, BG strings | Reuse exact strings | Voice consistency |
| `navigation.ts` / sidebar | دسترسی‌ها → `/access` | No change | 4b.3 |

### Architecture compliance (MUST follow)

| Rule | Implication |
| --- | --- |
| **AD-5** | Coarse authz (role/scope) in identity-access; fine category checks in audit-envelope. UI omit ≠ authorization. Keep `governedProcedure(access.administration)`. |
| **AD-6** | Next App Router; Persian RTL; **no** `@prisma/client` in `apps/web`; modules only via tRPC |
| **FR-2 / FR-4** | Admin UI must not weaken least privilege; all changes remain attributable via existing envelope |
| UX authority | Forward contract = `ux-divan-2026-07-19` (`EXPERIENCE.md` + `DESIGN.md`). Spines win over mocks when conflict |
| Consistency | Primary flat Access list = `governed-data-table`; section chrome = `section-tabs` |

[Source: `ARCHITECTURE-SPINE.md` AD-5/AD-6; `epics.md` Epic 4b / Story 4b.5; `EXPERIENCE.md` UX-DR27 / UJ-Access; `prd.md` FR-2/4/43; `sprint-change-proposal-2026-07-19.md`]

### Previous story intelligence (4b.4)

- First consumer of `GovernedDataTable` should be Access people — 4b.4 intentionally did **not** retrofit `access-admin-panel.tsx`.
- Clear filters → `sectionDefaultFilters` (not `{}`); enum empty selection = no filter; sticky `start-0` / `end-0` with opaque bg.
- Do not copy `snapshot.ts` — import the primitive.
- Selfcheck: `pnpm --filter @divan/web selfcheck:governed-table` still green after any accidental edits (prefer zero edits to primitive).
- BOM: never rewrite `sprint-status.yaml` with UTF-8 BOM on Windows.
- Epic 4 action items (person-org IDOR, PopulationPort) are for **5.1**, not this story — Access remains account-entitlement oriented.

### Git intelligence summary

Recent commits: `51d7ad7` story 4b.4 (GovernedDataTable primitive); `348b246` 4b.3 IA; `c11e77d` 4b.2 section tabs (Access tab shells already created); `c1a0c36` 4b.1 tokens/shell. Pattern: story commits touch web presentation + story md + sprint-status; domain packages untouched for 4b.x.

### Latest tech notes

- Leave-guard: project already has `LeaveGuardProvider` + `useLeaveGuardRegistration` — **reuse**; do not add third-party nav-guard libraries.
- Next App Router: keep pages as Server Components that assert access, then render client panels (`"use client"` at leaves).
- shadcn Table already present from 4b.4 — GovernedDataTable wraps it.

### Project structure notes

- Components live in `apps/web/components/access/` and `apps/web/components/governed-data-table/`.
- No new package; no `packages/ui`.
- Mock reference: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/mockups/key-access-admin.html`.

### Testing requirements

| Layer | Command / action |
| --- | --- |
| Domain regression | `pnpm selfcheck:access-admin` (root or identity-access script as documented in 2.3) |
| Table primitive | `pnpm --filter @divan/web selfcheck:governed-table` if primitive touched (prefer not) |
| Web | typecheck + eslint touched files |
| Manual | DoD checklist above; smoke `hr.admin` vs operator denial on `/access` |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4b / Story 4b.5]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-19.md`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — UX-DR27, UJ-Access, IA Access tabs]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/mockups/key-access-admin.html`]
- [Source: `_bmad-output/implementation-artifacts/4b-4-governed-data-table-primitive.md`]
- [Source: `_bmad-output/implementation-artifacts/2-3-access-administration-ui-apis.md`]
- [Source: `apps/web/components/access/access-admin-panel.tsx`]
- [Source: `apps/web/components/governed-data-table/types.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- `pnpm --filter @divan/web selfcheck:access-people` — ok
- `pnpm --filter @divan/web selfcheck:governed-table` — ok (primitive untouched)
- `pnpm selfcheck:access-admin` / `entitlement-lifecycle` / `break-glass` — ok
- `pnpm --filter @divan/web typecheck` — ok
- eslint on touched access files — ok (0 errors)

### Completion Notes List

- Split stacked AccessAdminPanel into tab-scoped panels: people / roles / scopes / break-glass.
- People tab is first GovernedDataTable consumer: person-first columns, status default filter, empty-assignments banner above table (table remains), multi-select assign dialogs (single dialog depth).
- Roles hosts permission sets + roles + EntitlementGrantsPanel; scopes is label+active with updateScope toggle; break-glass wrapped in warning banner tokens.
- Leave-guard registered on dirty create/assign/grant forms; zero identity-access / access-admin.ts contract changes.
- Ultimate context engine analysis completed - comprehensive developer guide created

### File List

- apps/web/app/(app)/access/(tabs)/people/page.tsx
- apps/web/app/(app)/access/(tabs)/roles/page.tsx
- apps/web/app/(app)/access/(tabs)/scopes/page.tsx
- apps/web/app/(app)/access/(tabs)/break-glass/page.tsx
- apps/web/components/access/access-admin-panel.tsx
- apps/web/components/access/access-people-panel.tsx
- apps/web/components/access/access-roles-panel.tsx
- apps/web/components/access/access-scopes-panel.tsx
- apps/web/components/access/access-break-glass-panel.tsx
- apps/web/components/access/access-people-helpers.ts
- apps/web/components/access/access-people.selfcheck.ts
- apps/web/components/access/access-section.tsx
- apps/web/components/access/access-status-message.tsx
- apps/web/components/access/entitlement-grants-panel.tsx
- apps/web/package.json
- _bmad-output/implementation-artifacts/4b-5-access-administration-person-first-retrofit.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-07-20: Story 4b.5 UI reshape — Access section tabs person-first retrofit; domain APIs unchanged.

### Review Findings

- [x] [Review][Decision] تعویض حساب، پیوند دایرکتوری کثیف را بی‌صدا دور می‌ریزد — resolved: مسدود کردن انتخاب حساب دیگر با پیام inline تا ذخیره/حذف پیوند
- [x] [Review][Decision] دیالوگ تخصیص محدوده، محدوده‌های غیرفعال را قابل انتخاب می‌گذارد — resolved: چک‌باکس غیرفعال برای scope غیرفعالِ انتخاب‌نشده؛ برداشتن تیکِ قبلی مجاز
- [x] [Review][Patch] دیالوگ تخصیص + leave-guard = دو دیالوگ هم‌زمان (AC #8) [`apps/web/components/access/access-people-panel.tsx:428`]
- [x] [Review][Patch] بعد از createRole موفق، `roleSetId` پاک نمی‌شود و leave-guard کاذب می‌ماند [`apps/web/components/access/access-roles-panel.tsx:198`]
- [x] [Review][Patch] بعد از createPermissionSet موفق، `setPermissions` به پیش‌فرض برنمی‌گردد [`apps/web/components/access/access-roles-panel.tsx:126`]
- [x] [Review][Patch] دیالوگ نقش/محدوده در loading/error مثل «خالی» رفتار می‌کند [`apps/web/components/access/access-people-panel.tsx:457`]
- [x] [Review][Patch] خطای mutate تخصیص پشت دیالوگ پنهان می‌ماند [`apps/web/components/access/access-people-panel.tsx:242`]
- [x] [Review][Patch] دکمه «ذخیره تخصیص» وقتی `assignDirty` نیست هم فعال است [`apps/web/components/access/access-people-panel.tsx:550`]
- [x] [Review][Patch] `updateScope` فقط `listScopes` را invalidate می‌کند (برخلاف `createScope`) [`apps/web/components/access/access-scopes-panel.tsx:22`]
- [x] [Review][Patch] `externalDirectoryId` فقط فاصله → `linkDirty` دائمی [`apps/web/components/access/access-people-panel.tsx:90`]
- [x] [Review][Defer] شناسه‌های یتیم نقش/محدوده در draft دیده و حذف نمی‌شوند [`apps/web/components/access/access-people-panel.tsx:213`] — deferred, pre-existing
- [x] [Review][Defer] selfcheck فقط helperهای خالص را پوشش می‌دهد [`apps/web/components/access/access-people.selfcheck.ts`] — deferred, pre-existing
