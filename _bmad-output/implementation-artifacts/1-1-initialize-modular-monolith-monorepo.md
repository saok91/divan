---
baseline_commit: 879492a75283a1c7868ba27e2eaa717f23851a75
---

# Story 1.1: Initialize Modular-Monolith Monorepo

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer delivering Divan,
I want a runnable T3 monorepo with the Architecture structural seed,
So that subsequent stories can add auth and UX on a consistent substrate.

## Acceptance Criteria

1. **Given** a greenfield Divan workspace  
   **When** the monorepo is initialized per Architecture Stack (Next.js App Router, tRPC 11, Prisma 7, TypeScript 5, pnpm workspaces, Node 22)  
   **Then** `apps/web` starts locally and renders a minimal Persian RTL page

2. **And** package folders exist for:
   - `packages/kernel/{event-store,temporal-engine,audit-envelope}`
   - `packages/modules/{identity-access,person-employment,headcount,compensation-facts,reporting,migration}`
   - `packages/db/{prisma,sql}`
   - `workers/`

3. **And** ESLint restricts direct `@prisma/client` imports from `apps/web`

4. **And** PostgreSQL connectivity is configured for local/dev without inventing production AR-NFR host sizing

5. **And** no domain business tables beyond the minimum needed to boot the app are created in this story

## Tasks / Subtasks

- [x] Task 1: Bootstrap pnpm monorepo + Node/TS toolchain (AC: #1)
  - [x] Require Node.js **22.x LTS** via `engines` (and optionally `.nvmrc` / `.node-version`)
  - [x] Create root `package.json`, `pnpm-workspace.yaml` covering `apps/*`, `packages/*`, `workers`
  - [x] Add root TypeScript 5.x base config; enable strict mode
  - [x] Update `.gitignore` for Node/Next/Prisma (keep existing BMAD ignores; remove stale “tech stack TBD” comment)
  - [x] Add root scripts: `dev`, `build`, `lint`, `db:generate` (filter-based via pnpm)

- [x] Task 2: Scaffold Architecture structural seed packages (AC: #2)
  - [x] Create exact folder tree from Structural Seed (stub `package.json` + minimal `src/index.ts` exports per package)
  - [x] Use **kebab-case** package directory names; workspace package names like `@divan/event-store`, `@divan/identity-access`, `@divan/db`, etc.
  - [x] Wire dependency direction only: `apps/web` → modules/kernel/db; modules → kernel/db; **no** cross-module internal imports
  - [x] Leave kernel/module packages as stubs (no domain logic, no real event-store yet)

- [x] Task 3: Create `apps/web` Next.js App Router + tRPC skeleton (AC: #1)
  - [x] Next.js **16.2.x** (pin latest 16.2 patch available at install time; currently 16.2.10), App Router only
  - [x] tRPC **11.x** router + HTTP handler under App Router (e.g. `app/api/trpc/[trpc]/route.ts`)
  - [x] Minimal home page: `lang="fa"`, `dir="rtl"`, Persian visible text (e.g. «دیوان» / short placeholder) — **not** English LTR placeholder
  - [x] Do **not** implement brand tokens, Yekan Bakh, app-shell, theme toggle, or auth (Stories 1.2–1.4)

- [x] Task 4: Configure `packages/db` Prisma 7.8 + local PostgreSQL (AC: #4, #5)
  - [x] Prisma **7.8.x** in `packages/db/prisma` with `prisma.config.ts` + `@prisma/adapter-pg` + `pg` (Prisma 7 requires driver adapter)
  - [x] Schema: provider `postgresql`; **no Person/Employment/event/headcount/compensation domain models**
  - [x] Allowed minimum: empty schema or a single non-domain health/bootstrap marker table if required to prove connectivity — prefer proving connect via `prisma db execute` / `$queryRaw` without domain tables
  - [x] `packages/db/sql/` placeholder for future kernel raw SQL migrations (README or empty dir with `.gitkeep`)
  - [x] `.env.example` with `DATABASE_URL` for local Postgres 17.10+ only — no HA/sizing/backup RPO invention
  - [x] Document local Postgres setup in root or `packages/db` README (docker one-liner or native install) — optional Compose is fine for **dev only**

- [x] Task 5: ESLint boundary guardrail (AC: #3)
  - [x] ESLint flat or legacy config covering monorepo
  - [x] `no-restricted-imports` (or ESLint override) **blocks `@prisma/client` and generated Prisma client paths from `apps/web`**
  - [x] Verify: intentional forbidden import in `apps/web` fails lint; modules/db may import Prisma

- [x] Task 6: Workers stub + verify locally (AC: #1, #2)
  - [x] `workers/` package stub ready for pg-boss **12.26.x** (dependency may be declared; **no** production job handlers required)
  - [x] `pnpm install` + `pnpm dev` (or filter web) starts `apps/web`
  - [x] Confirm RTL Persian page in browser; confirm Postgres env documented/connectable
  - [x] Confirm all structural seed paths exist on disk

### Review Findings

- [x] [Review][Decision] `checkDatabaseConnectivity` API contract — Resolved: catch and return `false` (boolean check semantics)
- [x] [Review][Patch] `pg.Pool` never ended after connectivity check [`packages/db/src/index.ts:9`]
- [x] [Review][Patch] `packages/db` typecheck fails: `prisma.config.ts` outside `rootDir` [`packages/db/tsconfig.json:7`]
- [x] [Review][Patch] `export { PrismaClient }` bypasses AC3 ESLint guardrail via `@divan/db` [`packages/db/src/index.ts:30`]
- [x] [Review][Patch] Root `build` does not run `db:generate` first [`package.json:11`]
- [x] [Review][Patch] Empty/whitespace `connectionString` not validated before `pg.Pool` [`packages/db/src/index.ts:9`]
- [x] [Review][Patch] `.gitignore` misses non-local env variants (e.g. `.env.development`) [`.gitignore:26`]
- [x] [Review][Patch] Unused root `eslint-config-next` devDependency [`package.json:18`]
- [x] [Review][Patch] Add Docker Compose local Postgres + `pnpm db:up`/`db:down` [`docker-compose.yml`]

## Dev Notes

### Epic context

- **Epic 1:** Secure Access & Persian Desktop Shell — auth (seeded then LDAP), Persian RTL desktop shell, brand/theme, command palette; this story only establishes the **modular-monolith substrate**.
- **FRs this story partially enables (does not fully implement):** FR43 (minimal RTL Persian page starts the substrate); FR1/FR44/FR49 land in later Epic 1 stories.
- **Downstream:** Story 1.2 assumes runnable `apps/web`; Story 2.1 assumes kernel package folders; Epic 4 assumes event-store/temporal/workers paths exist.

### Architecture compliance (MUST follow)

| Rule | Implication for 1.1 |
| --- | --- |
| **AD-1** One process, one PostgreSQL | No microservices, no second DB, no separate worker deploy required |
| **AD-3** Kernel owns event-store / temporal-engine / audit-envelope | Create folders + stubs only; modules must not “own” an event log |
| **AD-6** T3 + guardrails | Prisma for projections only; raw SQL later for kernel store; **ESLint blocks `@prisma/client` in `apps/web`** |
| Stack versions | Node 22.x, TS 5.x, Next 16.2.x, tRPC 11.x, Prisma 7.8.x, PG 17.10+, pg-boss 12.26.x, pnpm workspaces |
| Structural seed | Exact tree under `apps/`, `packages/kernel/`, `packages/modules/`, `packages/db/`, `workers/` |

[Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — Stack, Structural Seed, AD-1/AD-3/AD-6]

### Absolute non-goals (do not implement here)

- Brand tokens, Yekan Bakh fonts, light/dark theme → **Story 1.2**
- App shell (header/sidebar/skip/banner) → **Story 1.3**
- Seeded accounts / roles / sessions → **Story 1.4**
- LDAP → **Story 1.8** (infra-gated)
- Real event-store, temporal engine, audit-envelope logic → later epics
- Domain tables (Person, Employment, headcount, compensation, migration staging) → later epics
- Production host sizing, HA, SaaS telemetry, alternate .NET/Java stack
- Expanding into extra “developer-only” epics (readiness: keep as Story 1.1 only)

### Project structure notes

**Greenfield:** Repo has **no** application code today (only `.gitignore` tracked historically; planning artifacts untracked). Create the entire monorepo from scratch.

**Target tree:**

```text
divan/
  apps/web/                    # Next.js UI + tRPC entry
  packages/
    kernel/
      event-store/
      temporal-engine/
      audit-envelope/
    modules/
      identity-access/
      person-employment/
      headcount/
      compensation-facts/
      reporting/
      migration/
    db/
      prisma/
      sql/
  workers/                     # pg-boss bootstrap stub
```

**Preserve:** `_bmad/`, `.agents/`, `.claude/`, `_bmad-output/`, `docs/` — do not relocate planning/agent tooling into app packages.

**Conflict note:** Root `.gitignore` still says “tech stack TBD” — update ignores for Node artifacts while retaining BMAD ignore rules.

### Library / framework requirements

| Package | Pin guidance | Notes |
| --- | --- | --- |
| `next` | `16.2.x` (prefer latest patch, e.g. 16.2.10) | App Router; Turbopack default in Next 16 |
| `@trpc/server` / `@trpc/client` / `@trpc/react-query` | `11.x` (latest 11.x OK) | No direct Prisma in routers |
| `prisma` / `@prisma/client` | `7.8.x` | **Requires** `@prisma/adapter-pg` + `pg`; use `prisma.config.ts` |
| `pg-boss` | `12.26.x` | Declare in workers stub; handlers later |
| TypeScript | `5.x` | Strict |
| pnpm | workspaces | Prefer pnpm over npm/yarn for this repo |

**Prisma 7 pitfalls (critical):**

1. Do **not** use Prisma 6-style `new PrismaClient()` without adapter — it errors in v7.
2. Put datasource URL in `prisma.config.ts` (CLI); runtime client uses `@prisma/adapter-pg`.
3. In pnpm monorepos, hoist Prisma if TS2742 appears: `.npmrc` → `public-hoist-pattern[]=*prisma*` (or at least `@prisma/client-runtime-utils`).
4. Keep Prisma client **only** inside `packages/db` (and later modules that consume `@divan/db`) — never from `apps/web`.

**Bootstrap approach:** Manual scaffold matching Structural Seed is preferred over stock `create-t3-app` (T3 app layout ≠ Divan seed). You may use `create-next-app` **inside** `apps/web` then reshape, or hand-roll — either is fine if ACs pass.

### File structure requirements

| Path | Action |
| --- | --- |
| `pnpm-workspace.yaml`, root `package.json`, root `tsconfig*.json` | **NEW** |
| `apps/web/**` | **NEW** — Next App Router + minimal RTL page + tRPC stub |
| `packages/kernel/*`, `packages/modules/*` | **NEW** — stub packages |
| `packages/db/prisma/**`, `packages/db/sql/**` | **NEW** — Prisma 7 config; no domain models |
| `workers/**` | **NEW** — stub |
| ESLint config (root and/or `apps/web`) | **NEW** — restricted imports |
| `.env.example` | **NEW** — `DATABASE_URL` only for local/dev |
| `.gitignore` | **UPDATE** — Node/Next/env ignores |

### Testing requirements

- Architecture does **not** mandate a test runner yet — do not block on Vitest/Jest/Playwright unless already adding them for lint/dev convenience.
- **Definition of done (manual):**
  1. `pnpm install` succeeds on Node 22
  2. With local Postgres up and `DATABASE_URL` set, Prisma can connect (generate and/or a trivial connectivity check)
  3. `pnpm --filter web dev` (or root `dev`) serves a page with `dir="rtl"` and Persian text
  4. Lint fails if `apps/web` imports `@prisma/client`
  5. All Structural Seed directories exist

### Previous story intelligence

- None — this is the first implementation story. No prior story files or app commits to learn from.
- Git history: single commit `gitignore` — greenfield confirmed.

### Git intelligence summary

- No application patterns established yet.
- First commit will define conventions: package naming (`@divan/...`), ESLint boundaries, env handling — keep them aligned with Architecture Consistency Conventions.

### Latest tech information (as of 2026-07-16)

- **Next.js:** 16.2 line current; npm latest patch **16.2.10**. Requires Node ≥20; project pins **22.x LTS**. Turbopack is default bundler — avoid adding custom webpack unless necessary.
- **tRPC:** 11.x latest observed **11.18.0** — stay on 11.x.
- **Prisma:** Architecture pin **7.8.x** (npm `7.8.0`). Driver adapters mandatory; follow [Upgrade to Prisma ORM 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) and [pnpm workspaces + Prisma](https://www.prisma.io/docs/guides/deployment/pnpm-workspaces).
- **pg-boss:** **12.26.0** matches Architecture pin.

### Project context reference

- No `project-context.md` found in repo. Treat Architecture Spine + this story as the implementation contract.
- SPEC companions (`identity-access-epic1-freeze.md`) apply from Story 1.4 onward — do not implement freeze roles here.
- Sprint Planning: Epic 1 Stories **1.1–1.7** unblocked; **1.8** infra-gated.

### Dev Agent guardrails (anti-patterns)

| Do | Don't |
| --- | --- |
| Stub packages with published empty APIs | Implement domain business logic “while here” |
| Prove Postgres local connectivity | Invent production CPU/RAM/HA from AR-NFR |
| Block Prisma in `apps/web` via ESLint | Import Prisma in React Server Components “just once” |
| Persian RTL minimal page | English “Welcome to Next.js” left as ship state |
| One app process layout | Split API into a separate Nest/Express service |
| Keep `packages/db/sql` for future raw SQL | Put kernel event tables into Prisma models now |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.1, Additional Requirements]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-1..AD-6, Stack, Structural Seed]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md` — single-server MVP, outbound LDAP+NTP only]
- [Source: `_bmad-output/specs/spec-divan/SPEC.md` — modular monolith / T3 constraints]
- [Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-16.md` — Story 1.1 developer persona accepted; do not expand]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Prisma generate initially failed with `env('DATABASE_URL')`; switched to `process.env.DATABASE_URL` + dotenv so generate works without a live DB.
- Host port 5432 was already allocated; verified connectivity against Postgres 17.10 on mapped port 5433 while documenting default 5432 in `.env.example`.
- ESLint FlatCompat + `eslint-config-next` circular JSON error; fixed by importing Next 16 flat configs directly.

### Implementation Plan

- Manual Structural Seed scaffold (not create-t3-app) with `@divan/*` workspace packages.
- `apps/web`: Next 16.2.10 App Router + tRPC 11 HTTP handler + minimal Persian RTL page.
- `packages/db`: Prisma 7.8 with `@prisma/adapter-pg`, empty schema, `$queryRaw` connectivity helper.
- ESLint `no-restricted-imports` blocks `@prisma/client` from `apps/web`.
- `workers`: pg-boss 12.26.0 declared, no handlers.

### Completion Notes List

- All six tasks completed; ACs 1–5 satisfied.
- `pnpm install`, `pnpm db:generate`, `pnpm lint`, `pnpm --filter @divan/web typecheck`, and `pnpm dev` verified.
- Homepage returns `lang="fa"` / `dir="rtl"` with «دیوان»; tRPC `health` OK; Prisma `$queryRaw` connectivity true against local Postgres 17.10.
- Intentional `@prisma/client` import in `apps/web` fails lint with restricted-imports error.

### File List

- `.gitignore`
- `docker-compose.yml`
- `.env.example`
- `.node-version`
- `.npmrc`
- `.nvmrc`
- `README.md`
- `eslint.config.mjs`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next.config.ts`
- `apps/web/next-env.d.ts`
- `apps/web/eslint.config.mjs`
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/api/trpc/[trpc]/route.ts`
- `apps/web/src/server/trpc.ts`
- `apps/web/src/server/root.ts`
- `packages/db/package.json`
- `packages/db/tsconfig.json`
- `packages/db/prisma.config.ts`
- `packages/db/README.md`
- `packages/db/prisma/schema.prisma`
- `packages/db/src/index.ts`
- `packages/db/sql/.gitkeep`
- `packages/db/sql/README.md`
- `packages/kernel/event-store/package.json`
- `packages/kernel/event-store/tsconfig.json`
- `packages/kernel/event-store/src/index.ts`
- `packages/kernel/temporal-engine/package.json`
- `packages/kernel/temporal-engine/tsconfig.json`
- `packages/kernel/temporal-engine/src/index.ts`
- `packages/kernel/audit-envelope/package.json`
- `packages/kernel/audit-envelope/tsconfig.json`
- `packages/kernel/audit-envelope/src/index.ts`
- `packages/modules/identity-access/package.json`
- `packages/modules/identity-access/tsconfig.json`
- `packages/modules/identity-access/src/index.ts`
- `packages/modules/person-employment/package.json`
- `packages/modules/person-employment/tsconfig.json`
- `packages/modules/person-employment/src/index.ts`
- `packages/modules/headcount/package.json`
- `packages/modules/headcount/tsconfig.json`
- `packages/modules/headcount/src/index.ts`
- `packages/modules/compensation-facts/package.json`
- `packages/modules/compensation-facts/tsconfig.json`
- `packages/modules/compensation-facts/src/index.ts`
- `packages/modules/reporting/package.json`
- `packages/modules/reporting/tsconfig.json`
- `packages/modules/reporting/src/index.ts`
- `packages/modules/migration/package.json`
- `packages/modules/migration/tsconfig.json`
- `packages/modules/migration/src/index.ts`
- `workers/package.json`
- `workers/tsconfig.json`
- `workers/src/index.ts`
- `_bmad-output/implementation-artifacts/1-1-initialize-modular-monolith-monorepo.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-07-16: Initialized modular-monolith monorepo substrate (Story 1.1) — pnpm workspaces, structural seed stubs, Next/tRPC web app, Prisma 7.8 local Postgres, ESLint Prisma guardrail, workers stub.
- 2026-07-16: Code review patches — db connectivity API/pool lifecycle, AC3 type-only Prisma export, tsconfig, build→generate, env gitignore, Docker Compose `pnpm db:up`.

---

**Status:** done
