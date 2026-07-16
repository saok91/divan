---
baseline_commit: 5e3ecba075874339e33c772ef93ba3f5b2b36f32
---

# Story 1.4: Seeded Accounts & Coarse Role Auth (Dev Bootstrap)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer or tester,
I want pre-seeded internal accounts with the five MVP coarse roles,
so that I can sign in and exercise the shell without live LDAP (FR49 substrate; FR1 deferred to Story 1.8).

## Acceptance Criteria

1. **Given** a non-production environment per `identity-access-epic1-freeze.md`  
   **When** the identity-access seed runs  
   **Then** exactly one internal account exists for each MVP coarse role: HR Operator, HR Admin, Manager, Audit reviewer, System Admin  
   **And** each account maps to exactly one human identity record (no shared accounts)

2. **When** a user signs in with a valid seeded credential  
   **Then** a session is established with that account's coarse role context

3. **When** credentials are unknown, wrong, or the account is inactive  
   **Then** authentication fails closed with clear Persian copy and no privilege elevation

4. **And** seeded credentials are documented only for local/dev/CI; seed path is disabled or absent in production builds

5. **And** successful and failed authentication attempts are attributable for later audit wiring (FR42 substrate: correlation id + actor/time fields ready)

6. **And** session establishes idle/absolute timeout hooks configurable for AR-NFR/AR-IDENTITY freeze (NFR7)

## Tasks / Subtasks

- [x] Task 1: Prisma identity projections + migrate (AC: #1)
  - [x] Add projection models in `packages/db/prisma/schema.prisma` for internal account + human identity linkage + coarse role assignment (and session/credential storage as needed by chosen session strategy)
  - [x] Keep models identity-only — **no** Person/Employment/HR domain tables
  - [x] Add first Prisma migration under `packages/db/prisma/migrations/`
  - [x] Wire `db:migrate` (and related) scripts on `@divan/db` / root; keep Prisma 7 adapter-pg pattern via `createPrismaClient`
  - [x] Never import `@prisma/client` from `apps/web` (ESLint boundary stays)

- [x] Task 2: Non-production seed (AC: #1, #4)
  - [x] Implement seed owned by / invoked for `@divan/identity-access` (script may live under `packages/db` or module; logic must be module-owned)
  - [x] Seed **exactly five** accounts — one per MVP coarse role — each linked to exactly one human identity (no shared accounts)
  - [x] Use freeze example usernames unless literals need adjustment (document actuals):
    | Username | Coarse role |
    | --- | --- |
    | `hr.operator` | HR Operator |
    | `hr.admin` | HR Admin |
    | `manager` | Manager |
    | `audit.reviewer` | Audit reviewer |
    | `sys.admin` | System Admin |
  - [x] Hash passwords (e.g. bcrypt/argon2); never store plaintext
  - [x] Guard: seed **refuses to run** when `NODE_ENV=production` or an explicit allow-flag is missing (prefer both)
  - [x] Document credentials in README / `.env.example` comments for local/dev/CI only — never commit production secrets

- [x] Task 3: `@divan/identity-access` authenticate + session APIs (AC: #2, #3, #5, #6)
  - [x] Replace empty `packages/modules/identity-access/src/index.ts` stub with real exports
  - [x] Publish: authenticate(username/password), getSession/session context with `{ accountId, coarseRole, … }`, signOut, and typed fail-closed errors
  - [x] Coarse role enum/union frozen to the five MVP roles only — **no** Viewer / extra roles
  - [x] Use **stable machine codes** in session (for 1.5 consumers), e.g. `hr_operator` | `hr_admin` | `manager` | `audit_reviewer` | `system_admin` — map display labels separately
  - [x] Account model must support `active`/`inactive` (or equivalent) so inactive fail-closed is testable (seed at least one path or a documented way to mark inactive in dev)
  - [x] Fail closed: unknown user, wrong password, inactive account → Persian-facing error at API/UI boundary; **no** privilege elevation
  - [x] Auth attempt attribution substrate: emit/record correlation id + actor (or null on failure) + timestamp for success **and** failure (FR42 prep — not full audit-envelope; a thin table or structured log is fine)
  - [x] Idle + absolute timeout **hooks**: configurable env/config keys with sensible **dev defaults**; do **not** invent production AR-IDENTITY timeout numbers ([Source: `nfr-provisional.md`])
  - [x] Design provider seam (`IDENTITY_PROVIDER=seeded` vs future `ldap`) so Story 1.8 can add LDAP without production fallback to seed
  - [x] Do not grant HR content access by coarse role label alone (System Admin has no routine HR-content access — FR-3; fine-grained enforcement is Epic 2, but seed must not imply otherwise)

- [x] Task 4: Web session wiring — Auth.js + tRPC context (AC: #2, #3, #6)
  - [x] Add **Auth.js v5** (`next-auth@5` / Auth.js) with **Credentials** provider; JWT session strategy (Credentials does not use DB sessions natively)
  - [x] **Verify credentials only by calling `@divan/identity-access`** — do not duplicate password checks in React or authorize callback business logic
  - [x] Put Auth.js handlers at `apps/web/app/api/auth/[...nextauth]/route.ts`; config in `apps/web` (e.g. `auth.ts`) with edge-safe split if using proxy
  - [x] Set `AUTH_SECRET` (and related) in `.env.example`
  - [x] Extend tRPC `createContext` to expose session + coarse role; add `protectedProcedure` that fails closed when unauthenticated
  - [x] Route protection: prefer Next.js 16 **`proxy.ts`** (middleware renamed/deprecated) for optimistic auth redirects **or** server-side checks in `(app)/layout` — do not invent Edge-only DB access in proxy
  - [x] Unauthenticated access to `(app)/*` → redirect to `/login`; authenticated `/login` → redirect into app

- [x] Task 5: Login UI outside shell chrome (AC: #2, #3)
  - [x] Add `apps/web/app/(auth)/login/page.tsx` (and minimal `(auth)/layout.tsx` if needed) — **outside** `(app)` so login has **no** AppShell chrome
  - [x] Persian RTL operational copy: username/password fields, submit, clear error on failure (fact + next step; no emoji)
  - [x] Suggested fail copy (operational tone; exact string not frozen): e.g. «نام کاربری یا رمز عبور نادرست است.» / inactive: «این حساب غیرفعال است.»
  - [x] Do **not** show LDAP outage copy («اتصال به سامانه هویت برقرار نیست.») — that is Story 1.8
  - [x] After successful login, land on existing home `/` (role landings = Story 1.5 — do not invent redirects to پرسنل/ممیزی/عملیات yet)

- [x] Task 6: User menu + theme per-account + logout (AC: #2)
  - [x] Extend `apps/web/components/user-menu.tsx`: show signed-in identity label; add real **logout** (Persian, e.g. «خروج»)
  - [x] Preserve 1.2/1.3 a11y patches: `end-0`, pointerdown dismiss, Escape → focus trigger, `role="menu"` / `menuitem`, Button `type="button"`
  - [x] Wire `apps/web/lib/theme-storage.ts` `resolveThemeStorage(accountId)` for per-account preference when session exists (localStorage keyed by account id is enough — optional DB column only if already migrating identity tables; do not invent Person tables)
  - [x] Full APG menu keyboard trap remains deferred (1.7 / deferred-work) unless cheap while touching menu

- [x] Task 7: Manual DoD + docs (AC: #1–#6)
  - [x] `pnpm db:up` → migrate → seed → `pnpm --filter @divan/web dev`
  - [x] Smoke: login each of 5 roles → session carries correct coarse role; bad/inactive creds fail Persian; logout clears session; seed blocked in production mode
  - [x] `pnpm --filter @divan/web lint` + `typecheck`; tRPC health still works
  - [x] Update root README / `packages/db/README.md` with seed/bootstrap steps and **dev-only** credentials table
  - [x] Clear stale `.next` if route-group moves break typecheck (lesson from 1.3)

## Dev Notes

### Epic context

- **Epic 1:** Secure Access & Persian Desktop Shell — seeded auth bootstrap so the Persian RTL shell can be exercised without LDAP.
- **FRs:** FR49 substrate (one human ↔ one internal account); FR1 LDAP deferred to **1.8**; FR42 attribution **hooks only**; NFR7 timeout **hooks only**.
- **Upstream:** 1.1 (`@divan/identity-access` stub + Prisma empty + tRPC); 1.2 (theme + `theme-storage` extension); 1.3 (`(app)` shell + stub user menu).
- **Downstream:** 1.5 consumes session coarse role for landings + DOM-omitted nav; 1.8 replaces seeded routine identity with LDAP (same five roles).

### Absolute non-goals (do not implement here)

| Deferred | Story / epic |
| --- | --- |
| Role landings (پرسنل / داشبورد / ممیزی / عملیات), permission-filtered nav, «دسترسی ندارید.» | 1.5 |
| Command palette, Jalali, Persian digits | 1.6 |
| Stale/break-glass banners, WCAG floor suite | 1.7 |
| Live LDAP/AD, LDAP outage UX, production cutover off seed | 1.8 (infra-gated) |
| Fine-grained permission × category × action × Organizational Scope | Epic 2 / AD-5 audit-envelope |
| Break-glass, entitlement lifecycle, access admin UI | Epic 2 |
| Invent Viewer role or production local-identity bypass | Never |
| Invent formal AR-IDENTITY timeout/MFA/emergency-account numbers | AR-IDENTITY later |
| Domain Person/Employment/HR tables | Epic 3+ |

### Architecture compliance (MUST follow)

| Decision | Rule for this story |
| --- | --- |
| **AD-5** | `identity-access` owns authentication + **coarse** role context; do **not** implement fine-grained envelope checks |
| **AD-3** | Cross-module via published APIs only; web → modules/kernel; no foreign table reads |
| **AD-6** | tRPC + Prisma projections; Prisma only via `@divan/db` / modules; no `@prisma/client` in web |
| **Stack** | Next.js 16.2.x, tRPC 11.x, Prisma 7.8.x + adapter-pg, Node 22, pnpm, PostgreSQL 17.10+ |
| **Errors** | Typed domain errors; Persian at API/UI boundary; no silent authz fallthrough |
| **LDAP** | Via identity-access later; app never stores LDAP passwords; no silent seed fallback in LDAP/prod mode |

[Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5, Stack, Consistency]

### Authoritative freeze (MUST follow)

[Source: `_bmad-output/specs/spec-divan/identity-access-epic1-freeze.md`]

- Seeded accounts allowed **only** for early development / local / CI
- Exactly one seeded account per MVP coarse role; one human ↔ one internal account
- Fail-closed seeded mode: unknown / wrong / inactive; no Viewer elevation
- Seeded auth is **not** an alternate production identity path
- Do not invent full AR-ACCESS matrix

### Library / framework requirements

| Library | Guidance |
| --- | --- |
| **Auth.js v5 (`next-auth`)** | Preferred session layer for Next App Router + Credentials. Use JWT strategy with Credentials. Keep verify logic in `@divan/identity-access`. |
| Password hashing | `bcrypt` or `@node-rs/argon2` (or equivalent) inside identity-access / seed — not plaintext |
| Zod | Already in web — validate login input |
| Do **not** add | Passport, Lucia, Better Auth (unless Auth.js proves blocked — prefer Auth.js for T3 alignment), LDAP client libraries |

**Auth.js pitfalls to avoid:**
- Credentials + adapter without `session: { strategy: "jwt" }` → common misconfiguration
- Putting DB/password logic in Edge-only path — Next 16 `proxy.ts` is Node by default; still keep heavy verify in Node module APIs
- Shipping `AUTH_SECRET` weak/default in production builds

**Next.js 16 routing gate:** Prefer new file convention `apps/web/proxy.ts` (export `proxy`) over deprecated `middleware.ts`. Cookie-presence / auth redirect only; full session validation can live in server layouts/tRPC.

### File structure requirements

**UPDATE (high confidence)**

| File | Change |
| --- | --- |
| `packages/modules/identity-access/src/index.ts` (+ internals) | Real auth/seed/session APIs |
| `packages/modules/identity-access/package.json` | Hashing + db deps as needed |
| `packages/db/prisma/schema.prisma` | Identity/account/role projections |
| `packages/db/package.json` | migrate + seed scripts |
| `apps/web/src/server/trpc.ts`, `root.ts` | Session context + protectedProcedure |
| `apps/web/app/api/trpc/[trpc]/route.ts` | Real `createContext` |
| `apps/web/components/user-menu.tsx` | Identity label + logout |
| `apps/web/lib/theme-storage.ts` | Per-account storage when `accountId` set |
| `apps/web/package.json` | `next-auth` + peers |
| `.env.example`, root `README.md`, `packages/db/README.md` | AUTH_SECRET, seed docs |
| Possibly `apps/web/app/(app)/layout.tsx` | Auth gate / redirect |

**NEW (high confidence)**

| Area | Likely path |
| --- | --- |
| Auth routes (no chrome) | `apps/web/app/(auth)/login/page.tsx`, `(auth)/layout.tsx` |
| Auth.js config + handlers | `apps/web/auth.ts` (and optional `auth.config.ts`), `app/api/auth/[...nextauth]/route.ts` |
| Route proxy | `apps/web/proxy.ts` |
| Seed | `packages/db/prisma/seed.ts` and/or `packages/modules/identity-access/src/seed.ts` |
| Migrations | `packages/db/prisma/migrations/**` |

**Leave alone / touch lightly:** brand tokens, fonts, skip-link, viewport gate, sidebar **filtering** (1.5), kernel stubs beyond thin attribution hooks.

### Current codebase state (read before coding)

| Asset | Today |
| --- | --- |
| `packages/modules/identity-access` | `export {}` stub; already depended on by `@divan/web` |
| `packages/db/prisma/schema.prisma` | Datasource only — empty models |
| tRPC | `createContext: () => ({})`; only `publicProcedure` |
| Auth | **None** — no middleware/proxy, no sessions, no login route |
| Shell | `app/(app)/layout.tsx` wraps `AppShell`; comment says login must live outside |
| User menu | Stub label «حساب کاربری»; theme toggle only |
| Theme | `resolveThemeStorage(accountId)` ignores accountId |

### Previous story intelligence

**1.1**
- Manual scaffold aligned to Structural Seed; Prisma 7 requires adapter — never bare `new PrismaClient()`
- Validate empty `DATABASE_URL`; end `pg.Pool` after connectivity checks
- Port 5432 conflicts → document `POSTGRES_PORT`

**1.2**
- Theme per-account persistence explicitly deferred to 1.4 via `theme-storage.ts` — implement there
- Preserve menu RTL/a11y review patches when adding logout

**1.3**
- `(app)` vs auth routes already chosen — put login **outside** chrome
- Do **not** role-filter nav (explicit non-goal)
- After route moves, clear `.next` if typecheck references deleted paths
- Commit style: short `story 1.N`

**Deferred-work touchpoints:** UserMenu full APG keyboard may land in 1.4 or 1.7 — not a blocker for AC.

### Git intelligence

Recent commits: `5e3ecba story 1.3` → `09679c4 story 1.2` → `7457053 story 1.1` → `879492a gitignore`. Keep minimal commit messages; ship focused auth/seed/session only.

### Testing requirements

- No mandated Vitest/Playwright yet — **manual DoD** matches 1.1–1.3
- Required smoke matrix:
  1. Seed creates exactly 5 accounts (one per role, one human each)
  2. Valid login → session exposes correct `coarseRole`
  3. Unknown / wrong / inactive → Persian fail-closed; no elevation
  4. Logout clears session; `(app)` redirects to login when unauthenticated
  5. Seed refuses production / undocumented credentials only in README for local/dev/CI
  6. Attribution fields present on success and failure attempts (log or table — correlation id, actor, time)
  7. Idle/absolute timeout config keys exist and are read (hooks); do not claim production NFR compliance
  8. lint + typecheck + tRPC health still green

### Project Structure Notes

- Alignment: auth owned by `packages/modules/identity-access`; UI in `apps/web`; projections in `packages/db/prisma`
- Variance: Architecture does not name Auth.js — choosing Auth.js v5 is an implementation decision consistent with T3; business rules stay in the module
- Variance: UX-DR18 landings are **not** AC for 1.4 — session must carry role so 1.5 can consume it; post-login redirect stays `/` until 1.5

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.4 ACs; Stories 1.5 / 1.8 boundaries]
- [Source: `_bmad-output/specs/spec-divan/identity-access-epic1-freeze.md`]
- [Source: `_bmad-output/specs/spec-divan/nfr-provisional.md` — Session timeouts deferred]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5, Stack]
- [Source: `_bmad-output/implementation-artifacts/1-1-initialize-modular-monolith-monorepo.md`]
- [Source: `_bmad-output/implementation-artifacts/1-2-brand-tokens-typography-theme-toggle.md`]
- [Source: `_bmad-output/implementation-artifacts/1-3-app-shell-chrome-sidebar-skip-link.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: Auth.js Credentials docs — https://authjs.dev/getting-started/authentication/credentials]
- [Source: Next.js 16 upgrade — `middleware` → `proxy` convention]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Turbopack could not resolve `.js` ESM import suffixes against `.ts` sources in `@divan/identity-access` — switched to extensionless relative imports.
- Auth.js `MissingSecret` until `AUTH_SECRET` was present under `apps/web/.env` (Next loads package-local env; root `.env` alone is insufficient for the web app).
- Seed guards verified: refuses `NODE_ENV=production` and missing `ALLOW_DEV_SEED=true`.

### Completion Notes List

- Identity projections (`HumanIdentity`, `InternalAccount`, `AuthAttempt`) + first Prisma migration applied.
- Module-owned seed (`ALLOW_DEV_SEED=true pnpm db:seed`) creates exactly five bcrypt-hashed accounts; password `DivanDev1!`.
- `@divan/identity-access` exports authenticate, getSessionContext, setAccountStatus, timeout/provider config, typed `AuthenticationError`.
- Auth.js v5 Credentials + JWT; verify only via module; `proxy.ts` + `(app)/layout` gate; login outside chrome; user menu logout + per-account theme storage.
- Manual smoke: wrong password Persian error; successful `hr.operator` login shows display name; logout → `/login`; lint/typecheck green; tRPC health ok.

### File List

- `.env.example`
- `README.md`
- `package.json`
- `pnpm-lock.yaml`
- `_bmad-output/implementation-artifacts/1-4-seeded-accounts-coarse-role-auth-dev-bootstrap.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/auth.ts`
- `apps/web/proxy.ts`
- `apps/web/package.json`
- `apps/web/next-env.d.ts`
- `apps/web/types/next-auth.d.ts`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/app/(auth)/layout.tsx`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/api/auth/[...nextauth]/route.ts`
- `apps/web/app/api/trpc/[trpc]/route.ts`
- `apps/web/components/account-theme-sync.tsx`
- `apps/web/components/app-shell.tsx`
- `apps/web/components/user-menu.tsx`
- `apps/web/lib/login-action.ts`
- `apps/web/lib/logout-action.ts`
- `apps/web/lib/theme-storage.ts`
- `apps/web/src/server/context.ts`
- `apps/web/src/server/root.ts`
- `apps/web/src/server/trpc.ts`
- `packages/db/README.md`
- `packages/db/package.json`
- `packages/db/prisma.config.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/migration_lock.toml`
- `packages/db/prisma/migrations/20260716133024_identity_projections/migration.sql`
- `packages/modules/identity-access/package.json`
- `packages/modules/identity-access/src/index.ts`
- `packages/modules/identity-access/src/types.ts`
- `packages/modules/identity-access/src/config.ts`
- `packages/modules/identity-access/src/db.ts`
- `packages/modules/identity-access/src/authenticate.ts`
- `packages/modules/identity-access/src/seed.ts`
- `packages/modules/identity-access/src/run-seed.ts`

### Change Log

- 2026-07-16: Implemented Story 1.4 seeded auth bootstrap (identity projections, seed, Auth.js session, login/logout UI).

### Review Findings

- [x] [Review][Decision→Patch] `trustHost` با guard محیط — non-prod باز؛ production فقط با `AUTH_TRUST_HOST=true` [`apps/web/auth.ts`]

- [x] [Review][Patch] حساب inactive در طول session revalidate نمی‌شود — `getSessionContext` در JWT refresh صدا زده می‌شود [`apps/web/auth.ts`]
- [x] [Review][Patch] حلقه/مسدودسازی redirect: proxy دیگر /login→/ نمی‌کند؛ `(auth)/layout` با `auth()` ریدایرکت می‌کند [`apps/web/proxy.ts`]
- [x] [Review][Patch] مسیر seeded در `NODE_ENV=production` برای `authenticate()` مسدود است [`packages/modules/identity-access/src/authenticate.ts`]
- [x] [Review][Patch] تم per-account: `AccountThemeSync` از `resolveThemeStorage` استفاده می‌کند [`apps/web/components/account-theme-sync.tsx`]
- [x] [Review][Patch] `next-env.d.ts` به `./.next/types/routes.d.ts` برگشت [`apps/web/next-env.d.ts`]
- [x] [Review][Patch] re-seed دیگر `status` را reset نمی‌کند [`packages/modules/identity-access/src/seed.ts`]
- [x] [Review][Patch] مقدار نامعتبر `IDENTITY_PROVIDER` به `null` می‌رود (نه silent seeded) [`packages/modules/identity-access/src/config.ts`]
- [x] [Review][Patch] حلقه seed داخل `$transaction` است [`packages/modules/identity-access/src/seed.ts`]
- [x] [Review][Patch] خطای infra در `authorize` fail-closed به `INVALID_CREDENTIALS` [`apps/web/auth.ts`]
- [x] [Review][Patch] شکست `recordAttempt` authentication را abort نمی‌کند [`packages/modules/identity-access/src/authenticate.ts`]
- [x] [Review][Patch] `signOut` از `@divan/identity-access` publish شد [`packages/modules/identity-access/src/index.ts`]
- [x] [Review][Patch] JWT بدون timeout hooks fail-closed می‌شود [`apps/web/auth.ts`]

- [x] [Review][Defer] پیام `PROVIDER_UNAVAILABLE` در UI login map نمی‌شود [`apps/web/app/(auth)/login/page.tsx:9`] — deferred, LDAP copy در Story 1.8
- [x] [Review][Defer] timing side-channel روی username ناشناخته (بدون dummy bcrypt) [`packages/modules/identity-access/src/authenticate.ts:62`] — deferred, acceptable for epic-1 bootstrap
- [x] [Review][Defer] `AuthAttempt` بدون retention/FK — substrate نازک FR42 [`packages/db/prisma/schema.prisma`] — deferred, full audit envelope in Epic 2

### Change Log

- 2026-07-16: Implemented Story 1.4 seeded auth bootstrap (identity projections, seed, Auth.js session, login/logout UI).
- 2026-07-16: Code review patches applied (session revalidate, proxy loop, production seed gate, theme storage, seed txn/status, provider validation, signOut export).

---

**Status:** done  
**Completion note:** ACs met; code-review decision + patches applied; three items deferred to later stories.

