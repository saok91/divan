---
baseline_commit: abbe8ba92e06da7e05afba1af33ea6c15afa3149
---

# Story 1.5: Role Landings & Permission-Filtered Navigation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user in a known launch role,
I want to land on my role's first surface with only permitted nav items visible,
so that I start work in the right place without seeing forbidden areas.

## Acceptance Criteria

1. **Given** an authenticated session with coarse role context from identity-access (seeded or later LDAP-linked)  
   **When** login completes  
   **Then** HR Operator lands on پرسنل; HR Admin and Manager on داشبورد; Audit reviewer on ممیزی; System Admin on عملیات (UX-DR18)

2. **And** nav items outside the caller's permission are omitted from the DOM (not shown disabled)

3. **When** the user opens a deep link they are not permitted to access  
   **Then** the UI shows «دسترسی ندارید.» with a link to their role landing and the denial is audited

4. **And** placeholder destination routes render empty Persian shells without requiring Epic 5 domain features

## Tasks / Subtasks

- [x] Task 1: Coarse navigation + landing APIs in `@divan/identity-access` (AC: #1, #2, #3)
  - [x] Publish pure helpers (no React): `getRoleLandingPath(role)`, `getNavItemsForRole(role)`, `canAccessPath(role, pathname)`, and a frozen `NAV_CATALOG` / route→roles map
  - [x] Use existing machine codes only: `hr_operator` | `hr_admin` | `manager` | `audit_reviewer` | `system_admin`
  - [x] Freeze Epic-1 coarse nav matrix below — do **not** invent fine-grained AR-ACCESS category/scope rules
  - [x] Export from `packages/modules/identity-access/src/index.ts` for web consumption
  - [x] Document that coarse nav visibility ≠ HR content entitlement (System Admin still has no routine HR data)

- [x] Task 2: Placeholder Persian route shells (AC: #1, #4)
  - [x] Add App Router pages under `apps/web/app/(app)/` for every top-level IA nav href (empty shells: H1 + one short operational sentence; no domain tables/metrics)
  - [x] Recommended hrefs (kebab-case paths; Persian labels stay in nav):

    | Label (FA) | Path |
    | --- | --- |
    | داشبورد | `/dashboard` |
    | پرسنل | `/personnel` |
    | ساختار سازمان | `/organization` |
    | ظرفیت و جذب | `/headcount` |
    | گزارش‌ها | `/reports` |
    | ورود داده | `/import` |
    | دسترسی‌ها | `/access` |
    | ممیزی | `/audit` |
    | عملیات | `/operations` |
    | پرونده‌های اصلاح | `/correction-cases` |

  - [x] Replace current `(app)/page.tsx` branding demo: authenticated `/` **redirects to role landing** (do not leave `/` as a fake dashboard for all roles)
  - [x] Keep shells RTL/Persian; no Epic 5 search/dashboard/report implementations

- [x] Task 3: Post-login + authenticated entry redirects (AC: #1)
  - [x] After successful login, navigate to `getRoleLandingPath(session.user.coarseRole)` — not hardcoded `/`
  - [x] Update `(auth)/layout.tsx`: authenticated users hitting `/login` redirect to **their** role landing (not `/`)
  - [x] Optional safe `callbackUrl`: only honor same-origin paths the role `canAccessPath`; otherwise fall through to role landing (prevent open redirects + forbidden bounce)
  - [x] Preserve 1.4 fail-closed login copy; do not add LDAP outage messaging

- [x] Task 4: Permission-filtered sidebar (AC: #2)
  - [x] Pass `coarseRole` from `(app)/layout.tsx` → `AppShell` → `AppSidebar` (server session → client sidebar)
  - [x] Render **only** `getNavItemsForRole(coarseRole)` — forbidden items must not exist in the DOM (no `hidden`, no `disabled`, no `aria-disabled` stubs)
  - [x] Fix active-state matching for nested paths: prefix/segment strategy (deferred-work from 1.3) — e.g. `/personnel/...` marks پرسنل active; exact match alone is insufficient once landings move off `/`
  - [x] Preserve 1.3 chrome: 240px RTL sidebar, sidebar-active-background + accent leading border, `aria-current="page"`, skip-link/main landmark unchanged

- [x] Task 5: Deep-link denial surface + audit substrate (AC: #3)
  - [x] Gate protected routes: if authenticated but `!canAccessPath(role, pathname)`, render denial UI (do **not** silently redirect-only)
  - [x] Exact copy: «دسترسی ندارید.» plus a link to the caller's role landing (operational tone; no emoji)
  - [x] Audit the denial with FR42 **substrate** (same spirit as 1.4 `AuthAttempt`): correlation id + actor account id + timestamp + path + coarse role + outcome `denied` — thin table or structured module API is fine; **not** full kernel audit-envelope (Epic 2 / Story 2.1)
  - [x] Prefer implementing the guard in a shared server helper used by `(app)` layout or a small route-group pattern so every placeholder page is covered without copy-paste
  - [x] Proxy (`proxy.ts`) stays cookie-presence optimistic auth only — do **not** put DB/role matrix in Edge; role checks stay in Node server components / identity-access

- [x] Task 6: Manual DoD + docs (AC: #1–#4)
  - [x] Smoke matrix for all five seeded accounts (login → correct landing; sidebar item set matches matrix; deep-link to foreign route → denial + landing link; permitted route loads empty shell)
  - [x] Confirm forbidden nav labels absent from DOM (View Source / accessibility tree), not merely invisible
  - [x] `pnpm --filter @divan/web lint` + `typecheck`; tRPC health still green
  - [x] Touch README only if route map / landing paths need a one-line pointer for testers

### Epic-1 coarse nav matrix (MUST implement exactly)

Derived from EXPERIENCE.md IA “Typical roles” + FR-3 (System Admin: no routine HR content) + role landings. This is **navigation visibility only** for Epic 1 — not field/category authz.

| Nav item | Path | `hr_operator` | `hr_admin` | `manager` | `audit_reviewer` | `system_admin` |
| --- | --- | --- | --- | --- | --- | --- |
| داشبورد | `/dashboard` | ✓ | ✓ | ✓ | — | — |
| پرسنل | `/personnel` | ✓ | ✓ | ✓ | — | — |
| ساختار سازمان | `/organization` | — | ✓ | — | — | — |
| ظرفیت و جذب | `/headcount` | ✓ | ✓ | ✓ | — | — |
| گزارش‌ها | `/reports` | ✓ | ✓ | ✓ | — | — |
| ورود داده | `/import` | — | ✓ | — | — | — |
| دسترسی‌ها | `/access` | — | ✓ | — | — | — |
| ممیزی | `/audit` | — | — | — | ✓ | — |
| عملیات | `/operations` | — | — | — | — | ✓ |
| پرونده‌های اصلاح | `/correction-cases` | — | ✓ | — | — | — |

**Role landings:**

| Coarse role | Landing path | Label |
| --- | --- | --- |
| `hr_operator` | `/personnel` | پرسنل |
| `hr_admin` | `/dashboard` | داشبورد |
| `manager` | `/dashboard` | داشبورد |
| `audit_reviewer` | `/audit` | ممیزی |
| `system_admin` | `/operations` | عملیات |

## Dev Notes

### Epic context

- **Epic 1:** Secure Access & Persian Desktop Shell — after seeded auth (1.4), users must land on the correct first surface with fail-closed nav visibility.
- **FRs / UX:** FR43 (Persian RTL surfaces); UX-DR18 (landings + deep-link denial); FR49 substrate already in session; FR42 denial audit **hooks only**; FR2 fine-grained authz is **Epic 2**.
- **Upstream:** 1.4 session carries `coarseRole`; 1.3 sidebar lists all IA items unfiltered; login hardcodes `router.replace("/")`.
- **Downstream:** 1.6 command palette must respect the same permission-safe surfaces; 1.8 LDAP keeps the same five coarse roles/landings; Epic 2 replaces coarse nav with real permission × scope checks without changing UX copy.

### Absolute non-goals (do not implement here)

| Deferred | Story / epic |
| --- | --- |
| Fine-grained permission × category × action × Organizational Scope | Epic 2 / AD-5 audit-envelope |
| Real dashboard metrics, personnel search/lists, audit investigation data, ops health probes | Epic 5 / 7 |
| Command palette, Jalali, Persian digits | 1.6 |
| Stale/break-glass banners, WCAG floor suite | 1.7 |
| Live LDAP / LDAP outage UX | 1.8 |
| Scope-revoked mid-session modal («دسترسی شما تغییر کرد.») | Later / Epic 2 |
| Invent Viewer role or show forbidden nav as disabled | Never |
| Full APG menu keyboard / 200% zoom gate changes | 1.7 / deferred-work |

### Architecture compliance (MUST follow)

| Decision | Rule for this story |
| --- | --- |
| **AD-5** | `identity-access` owns **coarse** role → nav/landing/path checks; do **not** implement audit-envelope category checks |
| **AD-3** | Web imports published `@divan/identity-access` APIs only; no ad-hoc role strings duplicated only in React |
| **AD-6** | No new Prisma domain tables beyond optional thin access-denial attribution (identity schema); no `@prisma/client` in web |
| **Errors** | Persian at UI boundary; denial is explicit surface, not empty 404 pretending to be success |
| **Stack** | Next.js 16 App Router, Auth.js v5 session already wired, tRPC context already has `coarseRole` |

[Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5, AD-3]

### Authoritative freeze (MUST follow)

[Source: `_bmad-output/specs/spec-divan/identity-access-epic1-freeze.md`]

- Five MVP coarse roles only; landings match freeze table
- Nav items outside caller permission **omitted from DOM**
- Deep-link denial: «دسترسی ندارید.» + link to role landing + audited
- Do not invent full AR-ACCESS matrix

[Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — Role landing pages; State Patterns permission denied]

### Library / framework requirements

| Library | Guidance |
| --- | --- |
| **Auth.js v5** | Already in place — read `session.user.coarseRole`; do not add a second auth library |
| **Next.js 16** | App Router pages + server `auth()`; keep `proxy.ts` as cookie gate only (1.4 lesson: do not bounce `/login`→app on cookie alone) |
| **No new UI kit** | Reuse existing `Button`, tokens, shell; denial page is plain Persian content in `main` |

**Auth / redirect pitfalls (from 1.4 + current Auth.js practice):**
- Login currently `router.replace("/")` in `apps/web/app/(auth)/login/page.tsx` — must become role landing
- `(auth)/layout.tsx` currently `redirect("/")` for signed-in users — must become role landing
- If supporting `callbackUrl`, validate path is relative + `canAccessPath` before honoring
- Do not move role matrix into `proxy.ts` (no DB / avoid Edge coupling); server layout/guard is authoritative

### File structure requirements

**UPDATE (high confidence)**

| File | Change |
| --- | --- |
| `packages/modules/identity-access/src/index.ts` (+ new nav/landing module file) | Export landing/nav/path helpers |
| `apps/web/components/app-sidebar.tsx` | Role-filtered items; real hrefs; prefix active state |
| `apps/web/components/app-shell.tsx` | Accept + pass `coarseRole` |
| `apps/web/app/(app)/layout.tsx` | Pass role; optional shared path guard / denial branch |
| `apps/web/app/(app)/page.tsx` | Redirect to role landing |
| `apps/web/app/(auth)/login/page.tsx` | Post-login → role landing (or safe callback) |
| `apps/web/app/(auth)/layout.tsx` | Authenticated → role landing |
| `apps/web/lib/login-action.ts` | Only if redirect/callback handled server-side |

**NEW (high confidence)**

| Area | Likely path |
| --- | --- |
| Nav/landing pure logic | `packages/modules/identity-access/src/navigation.ts` (name flexible) |
| Placeholder pages | `apps/web/app/(app)/dashboard/page.tsx`, `personnel/page.tsx`, `organization/page.tsx`, `headcount/page.tsx`, `reports/page.tsx`, `import/page.tsx`, `access/page.tsx`, `audit/page.tsx`, `operations/page.tsx`, `correction-cases/page.tsx` |
| Denial UI helper | e.g. `apps/web/components/access-denied.tsx` or inline in guard |
| Denial audit substrate | identity-access recorder + optional Prisma model under identity schema |

**Leave alone / touch lightly:** brand tokens, fonts, viewport gate, user-menu a11y, Auth.js credential verify path, seed account set, kernel stubs, LDAP.

### Current codebase state (read before coding)

| Asset | Today |
| --- | --- |
| `apps/web/components/app-sidebar.tsx` | Hardcoded `NAV_ITEMS` — all 10 IA labels; only `/` is a real href; comment says filtering is 1.5 |
| `apps/web/app/(app)/page.tsx` | Branding/demo home used as «داشبورد» active target |
| Login success | `router.replace("/")` — ignores role |
| `(auth)/layout` | Signed-in → `redirect("/")` |
| Session | `session.user.coarseRole` populated (Auth.js JWT + `types/next-auth.d.ts`) |
| `@divan/identity-access` | Auth/seed/session APIs; **no** nav helpers yet |
| `proxy.ts` | Cookie presence → protect non-login routes; does **not** redirect login→app |
| deferred-work | Sidebar active state needs prefix strategy when landings leave `/` |

### Previous story intelligence

**1.4 (done — baseline `abbe8ba`)**
- Coarse role machine codes frozen in `types.ts` — **reuse**; do not redefine
- Auth.js Credentials + JWT; verify only via identity-access
- Proxy cookie loop lesson: never bounce `/login` on cookie alone; use `auth()` in layouts
- FR42 substrate pattern: thin `AuthAttempt` table — mirror for access denials, do not build audit-envelope
- Turbopack: extensionless relative imports inside identity-access
- `AUTH_SECRET` must exist under `apps/web/.env` for local runs
- Seed: `hr.operator`, `hr.admin`, `manager`, `audit.reviewer`, `sys.admin` / password `DivanDev1!`

**1.3**
- Explicit non-goal was role-filtered nav — now implement it
- Preserve skip-link, chrome heights, banner stack slot empty for 1.7
- Clear `.next` if route-group moves confuse typecheck

**1.2 / 1.1**
- Theme per-account already wired; do not regress `AccountThemeSync`
- Commit style: short `story 1.N`

### Git intelligence

Recent commits: `abbe8ba story 1.4` → `5e3ecba story 1.3` → `09679c4 story 1.2` → `7457053 story 1.1`. Keep the change set focused on landings, nav filter, placeholder routes, and thin denial audit — no auth rewrite.

### Latest tech information

- Auth.js v5 + App Router: after `signIn(..., { redirect: false })`, client/server must explicitly navigate; prefer role landing helper over hardcoding `/`
- Next.js 16: continue using `proxy.ts` (not deprecated `middleware.ts`) for optimistic cookie gate only
- RBAC checks belong in server components / shared Node helpers reading session role — aligns with AD-5 coarse ownership in identity-access

### Testing requirements

- No mandated Vitest/Playwright yet — **manual DoD** matches 1.1–1.4
- Required smoke matrix:
  1. `hr.operator` → `/personnel`; sidebar shows Operator set only (داشبورد، پرسنل، ظرفیت و جذب، گزارش‌ها)
  2. `hr.admin` → `/dashboard`; Admin nav includes ساختار سازمان، ورود داده، دسترسی‌ها، پرونده‌های اصلاح; excludes ممیزی/عملیات
  3. `manager` → `/dashboard`; Manager nav matches matrix (no Admin-only items)
  4. `audit.reviewer` → `/audit`; sidebar **only** ممیزی
  5. `sys.admin` → `/operations`; sidebar **only** عملیات
  6. As Operator, open `/operations` (or `/audit`) → «دسترسی ندارید.» + link to `/personnel`; denial recorded with correlation id
  7. Forbidden labels not in DOM for Audit/SysAdmin sessions
  8. Each permitted nav click loads empty Persian shell (H1 matches label)
  9. lint + typecheck + tRPC health green
  10. Logout / unauthenticated still redirect to `/login` (1.4 preserved)

### Project Structure Notes

- Alignment: coarse navigation policy owned by `packages/modules/identity-access`; UI filtering in `apps/web` components; routes under `(app)`
- Variance: Architecture does not prescribe URL path strings — kebab-case English paths above are the Epic-1 convention for this story; keep labels Persian
- Variance: EXPERIENCE “All scoped” / “Scoped” for داشبورد/گزارش‌ها interpreted for Epic 1 as Operator+Admin+Manager (not Audit/SysAdmin), consistent with FR-3 and landings

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.5 ACs; UX-DR18]
- [Source: `_bmad-output/specs/spec-divan/identity-access-epic1-freeze.md`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — IA, landings, permission-denied states]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/.working/ia-notes.md`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5]
- [Source: `_bmad-output/implementation-artifacts/1-4-seeded-accounts-coarse-role-auth-dev-bootstrap.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — sidebar prefix active state]
- [Source: `apps/web/components/app-sidebar.tsx`, `apps/web/auth.ts`, `packages/modules/identity-access/src/types.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Client barrel import of `@divan/identity-access` pulled `pg` into the browser bundle — fixed by resolving nav items on the server and passing plain `{href,label}` props to `AppSidebar`.
- Post-`signIn` `auth()` in the same server action could not read the new session cookie — fixed with `getActiveCoarseRoleByUsername` for landing path resolution.
- Proxy forwards `x-divan-pathname` only (no role matrix on Edge).

### Completion Notes List

- Epic-1 coarse nav/landing matrix implemented in `@divan/identity-access` (`navigation.ts`) with `resolvePostLoginPath` for safe callbacks.
- Ten Persian placeholder shells under `(app)/`; `/` redirects to role landing.
- Sidebar renders only permitted items (omitted from DOM); prefix active-state matching.
- Deep-link denial UI «دسترسی ندارید.» + landing link; `AccessDenial` FR42 substrate table + `recordAccessDenial`.
- Smoke-verified: operator→`/personnel`, admin nav set, audit→`/audit` (only ممیزی), sys.admin→`/operations` (only عملیات), denial audited; lint/typecheck/tRPC health green.

### File List

- `packages/modules/identity-access/src/navigation.ts`
- `packages/modules/identity-access/src/navigation.selfcheck.ts`
- `packages/modules/identity-access/src/access-denial.ts`
- `packages/modules/identity-access/src/authenticate.ts`
- `packages/modules/identity-access/src/index.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260716150012_access_denial_substrate/migration.sql`
- `apps/web/proxy.ts`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/app/(app)/page.tsx`
- `apps/web/app/(app)/dashboard/page.tsx`
- `apps/web/app/(app)/personnel/page.tsx`
- `apps/web/app/(app)/organization/page.tsx`
- `apps/web/app/(app)/headcount/page.tsx`
- `apps/web/app/(app)/reports/page.tsx`
- `apps/web/app/(app)/import/page.tsx`
- `apps/web/app/(app)/access/page.tsx`
- `apps/web/app/(app)/audit/page.tsx`
- `apps/web/app/(app)/operations/page.tsx`
- `apps/web/app/(app)/correction-cases/page.tsx`
- `apps/web/app/(auth)/layout.tsx`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/components/app-shell.tsx`
- `apps/web/components/app-sidebar.tsx`
- `apps/web/components/access-denied.tsx`
- `apps/web/components/placeholder-page.tsx`
- `apps/web/components/login-form.tsx`
- `apps/web/lib/login-action.ts`
- `apps/web/lib/resolve-app-path-access.tsx`
- `README.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-5-role-landings-permission-filtered-navigation.md`

### Change Log

- 2026-07-16: Implemented role landings, permission-filtered nav, placeholder routes, and thin access-denial audit (Story 1.5).
- 2026-07-16: Code review patches — path normalize/`..` reject, orphan-session signOut, proxy callbackUrl + broader matcher, unknown-role fail-closed.

### Review Findings

- [x] [Review][Defer] Layout-only path gate still runs forbidden page RSC — deferred: Epic-1 placeholders have no data loaders; when pages fetch domain data, add a shared per-page assert before loaders (layout swap alone does not stop RSC page execution)
- [x] [Review][Patch] Normalize/`..` rejection in `canAccessPath` / `resolvePostLoginPath` so callbackUrl cannot prefix-escape [`packages/modules/identity-access/src/navigation.ts:66`]
- [x] [Review][Patch] After successful `signIn`, if role lookup is null, clear the session (signOut) before returning credentials error [`apps/web/lib/login-action.ts:37`]
- [x] [Review][Patch] Proxy should pass `callbackUrl` when redirecting unauthenticated users to `/login` [`apps/web/proxy.ts:20`]
- [x] [Review][Patch] Guard unknown `coarseRole` in nav helpers (fail closed, no throw) [`packages/modules/identity-access/src/navigation.ts:82`]
- [x] [Review][Patch] Ensure app routes always get trusted pathname (matcher skips `.*\..*`; missing header defaults to `/`) [`apps/web/proxy.ts:33`]
- [x] [Review][Patch] Remove dead `HREF_SET` dual-`false` branch in `canAccessPath` [`packages/modules/identity-access/src/navigation.ts:102`]
- [x] [Review][Defer] AccessDenial write amplification / no accountId index — deferred, pre-existing substrate pattern [`packages/modules/identity-access/src/access-denial.ts:24`]
- [x] [Review][Defer] JWT coarseRole stale until session refresh after DB demote — deferred, pre-existing [`apps/web/app/(app)/layout.tsx:22`]
- [x] [Review][Defer] `isRedirectError` from `next/dist/...` — deferred, pre-existing from 1.4 [`apps/web/lib/login-action.ts:8`]
- [x] [Review][Defer] `navigation.selfcheck.ts` not wired to package script/CI — deferred, no Vitest yet [`packages/modules/identity-access/src/navigation.selfcheck.ts:1`]
- [x] [Review][Defer] Dual role source at login (JWT vs username re-lookup) race — deferred, needed because same-request `auth()` cannot read new cookie [`apps/web/lib/login-action.ts:37`]

---

**Status:** done
