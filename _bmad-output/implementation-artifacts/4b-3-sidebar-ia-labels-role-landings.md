---
baseline_commit: c11e77d
---

# Story 4b.3: Sidebar IA, Labels & Role Landings

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a role-filtered user,
I want the 2026-07-19 sidebar order and landings,
so that Personnel Events are top-level and Operator lands on اطلاعات پرسنلی (UX-DR18, UX-DR19).

## Acceptance Criteria

1. **Given** an authenticated session with coarse role context  
   **When** the sidebar renders  
   **Then** nav order is: داشبورد · اطلاعات پرسنلی · رویدادهای پرسنلی · ساختار سازمان · ظرفیت و جذب · گزارش‌ها · ورود داده · دسترسی‌ها · ممیزی · عملیات · پرونده‌های اصلاح  
   **And** unauthorized items are omitted from the DOM (not shown disabled)

2. **When** login completes  
   **Then** HR Operator lands on اطلاعات پرسنلی / فهرست پرسنل (`/personnel/list`); HR Admin and Manager on داشبورد; Audit reviewer on ممیزی; System Admin on عملیات

3. **When** the user opens a deep link they are not permitted to access  
   **Then** the UI shows «دسترسی ندارید.» with a link to their role landing and the denial is audited

4. **And** this story supersedes Story 1.5 landing label «پرسنل» and Story 1.3 fixed 240px-only sidebar assumption for forward work  
   **And** the primary surface label «پرسنل» is gone from sidebar, section-tab surface labels, route announcer, and personnel shell `<h1>` (domain field copy like «کد پرسنلی» stays)

## Tasks / Subtasks

- [x] Task 1: Update coarse nav catalog + role matrix (AC: #1, #2, #4)
  - [x] Edit `packages/modules/identity-access/src/navigation.ts`:
    - Rename `/personnel` label → `اطلاعات پرسنلی`
    - Insert `{ href: "/personnel-events", label: "رویدادهای پرسنلی" }` **immediately after** `/personnel` in `NAV_CATALOG` (catalog length **11**)
    - Keep all other Epic-1 kebab hrefs unchanged (`/dashboard`, `/organization`, …)
    - Update `ROLE_NAV_HREFS` so `/personnel-events` is granted to the same roles that already have `/personnel`: `hr_operator`, `hr_admin`, `manager` — **not** `audit_reviewer` / `system_admin`
    - Set `ROLE_LANDING.hr_operator` → `"/personnel/list"` (explicit فهرست پرسنل; other landings unchanged)
  - [x] **Do not** invent new nav APIs — keep `NavItem`, `getNavItemsForRole`, `getRoleLandingPath`, `canAccessPath`, `resolvePostLoginPath`, `normalizePathname`
  - [x] Preserve fail-closed path normalize, open-redirect rejection (`//…`, absolute URLs), and prefix match `path === href || path.startsWith(`${href}/`)` — critical so `/personnel-events` is **not** treated as nested under `/personnel`
  - [x] Comment: nav visibility ≠ HR content entitlement (SysAdmin still ops-only)

- [x] Task 2: Selfcheck + consumers stay wiring-only (AC: #1–#3)
  - [x] Update `packages/modules/identity-access/src/navigation.selfcheck.ts`:
    - `NAV_CATALOG.length === 11`
    - `EXPECTED_LANDINGS.hr_operator === "/personnel/list"`
    - Each role’s expected href list includes `/personnel-events` where granted; catalog order asserted
    - Keep traversal / open-redirect / unknown-role cases
    - Add `canAccessPath("hr_operator", "/personnel-events") === true` and `canAccessPath("hr_operator", "/personnel-events/anything") === true`
    - Add `canAccessPath("system_admin", "/personnel-events") === false`
    - Update `resolvePostLoginPath` expectations that previously returned `"/personnel"` for operator
  - [x] Run: `pnpm --filter @divan/identity-access exec tsx src/navigation.selfcheck.ts`
  - [x] Confirm login / `/` / auth layout / `AccessDenied` / `AuthzChangedModal` pick up new landing **without** logic changes (they already call `getRoleLandingPath` / `resolvePostLoginPath`)

- [x] Task 3: Empty shell route for رویدادهای پرسنلی (AC: #1)
  - [x] Add `apps/web/app/(app)/personnel-events/page.tsx` using `PlaceholderPage` (pattern: `reports/page.tsx`)
    - Title: `رویدادهای پرسنلی`
    - Description: short operational Persian placeholder (e.g. content arrives in 4b.7) — **not** ceremonial copy
  - [x] Call `assertPageAccess` before any data work (Layout≠RSC) — follow existing placeholder pages that gate access
  - [x] **Do not** add section tabs, relocate `PersonnelEventForm`, or create `/personnel-events/(tabs)/…` — that is **4b.7**
  - [x] **Do not** add contextual surfaces (پروفایل فرد، خروجی/بازیابی) to the sidebar

- [x] Task 4: Sidebar icons + leave-guard regression (AC: #1)
  - [x] Add Lucide icon for `/personnel-events` in `NAV_ICONS` (`apps/web/components/app-sidebar.tsx`) — OQ-R1 free choice; prefer a distinct icon from `Users` (e.g. `History` / `RefreshCw` / `CalendarClock`); remove stale “until 4b.3” comments
  - [x] Keep `isNavActive` prefix helper, `onNavigate` → `requestNavigation`, collapse toggle exempt
  - [x] Smoke: dirty form on `/personnel/list` → sidebar click to `/personnel-events` must still open leave-guard (4b.2 channel)

- [x] Task 5: Consolidate surface labels (AC: #2, #4)
  - [x] `apps/web/lib/section-tab-surfaces.ts`: `surfaceLabel` + `ariaLabel` for `/personnel` → `اطلاعات پرسنلی` / `بخش‌های اطلاعات پرسنلی` (tab hrefs unchanged)
  - [x] `apps/web/components/route-announcer.tsx`: `SURFACE_LABELS["/personnel"]` → `اطلاعات پرسنلی`; add `/personnel-events` → `رویدادهای پرسنلی`
  - [x] Prefer single source of truth where cheap: for tabbed surfaces, announcer already uses `surface.surfaceLabel` — keep `SURFACE_LABELS` only for non-tabbed surfaces + new events href (close 4b.2 deferred dual-label drift for personnel rename)
  - [x] Align visible shell heading in personnel UI (`personnel-panel.tsx` `<h1>`) to `اطلاعات پرسنلی` if it still says `پرسنل`
  - [x] **Do not** rename command-palette search group heading «پرسنل» unless it is clearly the nav surface label (person-search group ≠ sidebar IA)

- [x] Task 6: Verify + DoD (AC: #1–#4)
  - [x] `pnpm --filter @divan/identity-access` + `pnpm --filter @divan/web` typecheck
  - [x] Lint clean on **touched** files only
  - [x] Manual DoD (five seeded roles) below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done later
  - [x] BOM-safe edit if touching `sprint-status.yaml` on Windows (UTF-8 **without** BOM)

### Review Findings

- [x] [Review][Defer] `PageAccessDeniedError` has no `error.tsx` boundary [`apps/web/app/(app)/personnel-events/page.tsx`] — deferred, pre-existing

## Dev Notes

### Epic context

- **Epic 4b:** Shell & IA Alignment to `ux-divan-2026-07-19` — presentation only; domain APIs unchanged. Authorized by `sprint-change-proposal-2026-07-19`. After Epic 4 (done), before Epic 5.
- **This story:** UX-DR18 (role landings + denial) + UX-DR19 (sidebar IA order/labels) + UX-DR3 (omit unauthorized from DOM).
- **Order:** `4b.1` (done) → `4b.2` (done) → **`4b.3`** → `4b.4` → (`4b.5` ∥ `4b.6`) → `4b.7` → Epic 5.
- **Downstream:** 4b.7 AC starts with `Given the updated IA from Story 4b.3`. Epic 5.1 assumes Operator path `اطلاعات پرسنلی / فهرست پرسنل`. Story 1.5 note: do not implement Epic 5+ against «پرسنل».

### Locked decisions (do not reopen in implementation)

| Decision | Value | Rationale |
| --- | --- | --- |
| Events href | `/personnel-events` | Epic-1 kebab English paths; Persian labels only. Not locked in prior code — **this story locks it**. |
| Events in ROLE_NAV | `hr_operator`, `hr_admin`, `manager` | Same coarse set as `/personnel`. UX spine left matrix open (`review-edge-cases.md`); conservative default. Document in PR if product later adds Manager exclusion. |
| Operator landing | `/personnel/list` | AC requires فهرست پرسنل; 4b.2 already redirects `/personnel` → list — explicit landing is clearer for selfcheck + post-login. |
| Events depth this story | Single `PlaceholderPage` | Full tabs (رویدادها · ثبت رویداد · ورود گروهی) + form move = **4b.7**. |
| Collapse / 240px | Already solved in 4b.1 | AC #4 only reaffirms; do **not** reintroduce fixed-240-only. |

### Absolute non-goals (do not implement here)

| Out of scope | Belongs to |
| --- | --- |
| Section-tabs chrome / leave-guard substrate changes | **4b.2** (done — preserve) |
| `governed-data-table` | **4b.4** |
| Person-first Access domain UI | **4b.5** |
| `tree-navigator` / org tab content | **4b.6** |
| Relocate `PersonnelEventForm`; events section tabs; quick-edit; full list | **4b.7** / Epic 5 |
| Import wizard product | Epic 6 |
| Fine-grained category / audit-envelope rewrite | Epic 2 (exists) |
| Brand hex, FaNum, AG Grid, mobile, `packages/ui` | Never |
| AD-1…AD-6 / Prisma / domain modules | No architecture change |

### Current code state (UPDATE targets)

| File | Today | This story changes | Must preserve |
| --- | --- | --- | --- |
| `packages/modules/identity-access/src/navigation.ts` | 10-item catalog; label «پرسنل»; no events; operator landing `/personnel` | Rename, insert events, matrix, landing `/personnel/list` | normalize / fail-closed / open-redirect / prefix `href/` |
| `navigation.selfcheck.ts` | Expects length 10, landing `/personnel` | Match new contract | Unknown-role + traversal asserts |
| `apps/web/app/(app)/personnel-events/page.tsx` | **Missing** | NEW placeholder + access gate | — |
| `apps/web/components/app-sidebar.tsx` | `NAV_ICONS` without events | Add icon key | leave-guard `onNavigate`, collapse exempt, `isNavActive` |
| `section-tab-surfaces.ts` | `surfaceLabel: "پرسنل"` | Rename to اطلاعات پرسنلی | tab hrefs / nested strategy |
| `route-announcer.tsx` | `SURFACE_LABELS` «پرسنل» | Rename + events entry | polite live region, skip-first-mount |
| Login / layout / deny consumers | Call helpers | Usually **no code change** | Layout≠RSC + `assertPageAccess` / `recordAccessDenial` |

### Architecture compliance (MUST follow)

| Rule | Implication |
| --- | --- |
| **AD-5** | Coarse nav/landing stays in `identity-access`; no fine-grained category work here |
| **AD-6** | Next **16.2.x** App Router; Persian RTL; no `@prisma/client` in `apps/web` |
| FR-2 | UI omit ≠ authorization — keep `canAccessPath` + `assertPageAccess` + audited denial |
| UX authority | Forward contract = `ux-divan-2026-07-19`. `ux-divan-2026-07-13` historical only; spines win over mocks |
| Server-resolved nav | `getNavItemsForRole` on server → plain `{href,label}` to client (never ship `pg` to browser) |

[Source: `ARCHITECTURE-SPINE.md` AD-5/AD-6; `epics.md` Story 4b.3; `EXPERIENCE.md` Sidebar + Role landings]

### Target catalog (exact order)

```text
/dashboard          داشبورد
/personnel          اطلاعات پرسنلی
/personnel-events   رویدادهای پرسنلی   ← NEW
/organization       ساختار سازمان
/headcount          ظرفیت و جذب
/reports            گزارش‌ها
/import             ورود داده
/access             دسترسی‌ها
/audit              ممیزی
/operations         عملیات
/correction-cases   پرونده‌های اصلاح
```

### Target ROLE_NAV_HREFS (after insert)

```text
hr_operator:     /dashboard, /personnel, /personnel-events, /headcount, /reports
hr_admin:        /dashboard, /personnel, /personnel-events, /organization, /headcount, /reports, /import, /access, /correction-cases
manager:         /dashboard, /personnel, /personnel-events, /headcount, /reports
audit_reviewer:  /audit
system_admin:    /operations
```

### Target ROLE_LANDING

```text
hr_operator:     /personnel/list
hr_admin:        /dashboard
manager:         /dashboard
audit_reviewer:  /audit
system_admin:    /operations
```

### Data flow (reuse — do not reinvent)

```text
loginAction → resolvePostLoginPath(role, callback)
                └─ getRoleLandingPath / canAccessPath

(app)/layout
  ├─ getNavItemsForRole → AppShell → AppSidebar + CommandPalette
  ├─ resolveAppPathAccess(canAccessPath) → children | AccessDenied
  └─ getRoleLandingPath → AuthzChangedModal

page loaders → assertPageAccess(canAccessPath)   // Layout ≠ RSC

RouteAnnouncer ← surfaceForPath / SURFACE_LABELS + activeTabForPath
```

### Previous story intelligence (4b.1 / 4b.2)

- **4b.1:** Collapsible 240↔64, tokens, `NAV_ICONS`, collapse/theme exempt from leave-guard. Do not regress.
- **4b.2:** Nested section tabs; `/personnel` → `/personnel/list`; leave-guard via `Link onNavigate` + `requestNavigation`; deferred dual `SURFACE_LABELS` vs `surfaceLabel` → **fix in this story** on rename.
- **4b.2 review patches to keep:** `isNavActive` prefix (same-surface skip), safe index redirects (`if (!SURFACE) redirect`), no BOM on `sprint-status.yaml`.
- **Explicit 4b.2 non-goal handoff:** «do not rename sidebar پرسنل (that is 4b.3)» / «do not relocate PersonnelEventForm (that is 4b.7)».
- Testing pattern: package selfcheck via `tsx`; web typecheck; eslint touched-only; Vitest not required unless already present for these files.

### Git intelligence

```text
c11e77d story 4b.2   ← tabs + leave-guard + nested routes (baseline)
c1a0c36 story 4b.1   ← collapse shell + tokens + NAV_ICONS
f1fde05 epic 4b correct course
```

Commit style: short `story 4b.N`. Touch `identity-access` + `apps/web` chrome only.

### Latest tech notes

- Next.js `Link` `onNavigate` + `preventDefault` (since 15.3) already powers leave-guards — **keep** that pattern; do not add third-party leave-guard packages.
- No new dependencies for this story.

### Project Structure Notes

- Nav SoT: `packages/modules/identity-access/src/navigation.ts`
- Web shells: `apps/web/app/(app)/…`
- Chrome: `apps/web/components/app-sidebar.tsx`, `route-announcer.tsx`, `leave-guard/*`
- Do **not** create `packages/ui` or move chrome into a new package

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4b.3, UX-DR18/19]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — Sidebar IA, Role landings]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/DESIGN.md` — sidebar-nav, collapse]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/review-edge-cases.md` — role×events matrix gap]
- [Source: `_bmad-output/implementation-artifacts/4b-2-section-tabs-chrome-routing-leave-guards.md`]
- [Source: `_bmad-output/implementation-artifacts/4b-1-design-delta-tokens-collapsible-app-shell.md`]
- [Source: `packages/modules/identity-access/src/navigation.ts`]

### Manual DoD checklist

1. **Operator:** after login → `/personnel/list`; sidebar shows اطلاعات پرسنلی + رویدادهای پرسنلی in positions 2–3; no Admin-only items in DOM
2. **Admin / Manager:** landing `/dashboard`; both see events item; Admin also sees org/access/import/correction-cases
3. **Audit:** only ممیزی; deep-link `/personnel-events` → «دسترسی ندارید.» + link to `/audit` + denial audited
4. **SysAdmin:** only عملیات; no HR surfaces in DOM
5. Catalog order matches EXPERIENCE 11-item list; collapsed tooltips use new labels
6. Announce on `/personnel/list` ≈ `اطلاعات پرسنلی — فهرست پرسنل`; on `/personnel-events` ≈ `رویدادهای پرسنلی`
7. Dirty event form on list → navigate to events via sidebar → leave-guard still works
8. No visible primary-surface label «پرسنل» in sidebar / shell h1 / announcer map

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- navigation.selfcheck: ok
- `@divan/identity-access` + `@divan/web` typecheck: pass
- eslint on touched files: pass

### Completion Notes List

- Updated `NAV_CATALOG` to 11 items: renamed پرسنل → اطلاعات پرسنلی; inserted رویدادهای پرسنلی at `/personnel-events` after `/personnel`.
- Granted `/personnel-events` to `hr_operator` / `hr_admin` / `manager`; operator landing → `/personnel/list`.
- Prefix match `${href}/` preserved so `/personnel-events` is not nested under `/personnel`.
- Selfcheck covers catalog order, landings, events access, open-redirect, unknown-role.
- Added gated placeholder page at `personnel-events/page.tsx` (content deferred to 4b.7).
- Sidebar: `CalendarClock` icon for events; leave-guard / `isNavActive` / collapse exempt unchanged.
- Surface labels consolidated: section-tab + panel h1 → اطلاعات پرسنلی; announcer `SURFACE_LABELS` reduced to non-tabbed + `/personnel-events` (tabbed via `surface.surfaceLabel`).
- Command-palette person-search group heading «پرسنل» left unchanged (not nav surface label).
- Login / AccessDenied / AuthzChangedModal consume new landing via existing helpers — no consumer logic changes.

### File List

- packages/modules/identity-access/src/navigation.ts
- packages/modules/identity-access/src/navigation.selfcheck.ts
- apps/web/app/(app)/personnel-events/page.tsx
- apps/web/components/app-sidebar.tsx
- apps/web/components/route-announcer.tsx
- apps/web/lib/section-tab-surfaces.ts
- apps/web/components/personnel/personnel-panel.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4b-3-sidebar-ia-labels-role-landings.md

### Change Log

- 2026-07-20: Implemented Story 4b.3 — sidebar IA (11-item catalog), role landings, events placeholder, surface label rename; status → review.
- 2026-07-20: Code review complete — 0 patch / 0 decision-needed; 1 defer (pre-existing); status → done.

## Story completion status

- Status: **done**
- Note: Code review passed; one pre-existing defer recorded
