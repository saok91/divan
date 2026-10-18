# Divan

Modular-monolith HRIS monorepo (T3 stack).

## Prerequisites

- **Node.js 22.x LTS** (see `.nvmrc`)
- **pnpm** 10+
- **Docker** (for local PostgreSQL) — or any PostgreSQL **17.10+** install

## Setup

```bash
pnpm install
cp .env.example .env
```

### Local Postgres (Docker Compose)

```bash
pnpm db:up
```

Starts `postgres:17.10` with database `divan` (user/password `postgres`, matches `.env.example`).

If host port **5432** is already taken:

```bash
# PowerShell
$env:POSTGRES_PORT=5433; pnpm db:up

# bash
POSTGRES_PORT=5433 pnpm db:up
```

Then set `DATABASE_URL` to the same host port, e.g. `...@localhost:5433/divan?...`.

Useful commands:

```bash
pnpm db:logs   # follow Postgres logs
pnpm db:down   # stop Compose service (volume kept)
```

### Migrate + seed (dev/CI only)

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:sql:apply   # kernel raw SQL (event-store) — see packages/db/sql/README.md
# PowerShell
$env:ALLOW_DEV_SEED="true"; pnpm db:seed
# bash
ALLOW_DEV_SEED=true pnpm db:seed
```

Seed **refuses** to run when `NODE_ENV=production` or `ALLOW_DEV_SEED` is not exactly `true`.

#### Kernel SQL (audit envelope / event-store)

After Prisma migrate, apply append-only `kernel_events` via:

```bash
pnpm db:sql:apply
```

Selfcheck (wired): `pnpm selfcheck:audit-envelope`, `pnpm selfcheck:governed` (freshness + governed path; categories + read≠export + omit). Other Epic-1 selfchecks remain manual (`tsx`).

#### Dev-only seeded accounts

| Username | Coarse role | Password |
| --- | --- | --- |
| `hr.operator` | `hr_operator` | `DivanDev1!` |
| `hr.admin` | `hr_admin` | `DivanDev1!` |
| `manager` | `manager` | `DivanDev1!` |
| `audit.reviewer` | `audit_reviewer` | `DivanDev1!` |
| `sys.admin` | `system_admin` | `DivanDev1!` |

Never ship these credentials to production. Inactive fail-closed testing: use `setAccountStatus(username, "inactive")` from `@divan/identity-access`.

### Identity provider cutover

| Mode | When | Notes |
| --- | --- | --- |
| `IDENTITY_PROVIDER=seeded` | Local / CI (default) | Five seeded accounts above; seed requires `ALLOW_DEV_SEED=true` |
| `IDENTITY_PROVIDER=ldap` | Only after Infrastructure / AR-IDENTITY approval | Fill `LDAP_*` placeholders in `.env.example` from Infra; missing config fails closed with «اتصال به سامانه هویت برقرار نیست.» — **no** seeded login fallback |
| Unsupported value | Misconfiguration | Fail closed (not seeded) |

LDAP-linked accounts store `passwordHash = null` and a unique `externalDirectoryId`. Directory passwords are never persisted. Group→role sync, MFA, and emergency accounts remain AR-IDENTITY open items.

### App

```bash
pnpm db:generate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — unauthenticated visitors redirect to `/login`. After login, each coarse role lands on its first surface (`/personnel`, `/dashboard`, `/audit`, or `/operations`); see Story 1.5 nav matrix. Command palette: `Ctrl+K` / `Cmd+K`, or `/` when focus is not in a text field. Jalali date-picker + platform banner smoke toggles (stale / break-glass / gold CTA): `/personnel`. At 200% zoom on a ≥1280×720 display the shell stays usable; resize the window below that floor to see the viewport gate.

### Recalc worker (local UAT)

Personnel-event mutations mark `recalculation_status` pending in the web process; the platform stale banner stays up until `@divan/workers` **successfully runs** `temporal.recalculate` against the **same** `DATABASE_URL` as the web app. If only `pnpm dev` is running, pending/failed/stale rows remain and gold CTAs stay blocked (expected fail-closed).

```bash
# same DATABASE_URL as apps/web (root .env)
pnpm --filter @divan/workers start
```

The worker loads the root `.env` when launched through its CLI (explicit environment values take precedence). On boot and every 30 seconds after the previous recovery pass completes, it **re-enqueues** orphan pending/failed/stale rows in batches of at most 100. A cursor prevents permanently failing early rows from starving later rows. Reclaim does not clear status; the banner clears only after processing succeeds. Positive recovery logs use `[workers] reclaimed N pending/failed/stale recalc job(s)`. Shutdown stops future recovery and waits for the current pass. Do not SQL-clear status rows as a product happy path.

Required env (see `.env.example`): `AUTH_SECRET`, `IDENTITY_PROVIDER` (`seeded` for local), session timeout hooks.
For LDAP mode (Infra-gated): `LDAP_URL`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_BASE_DN`, `LDAP_USER_FILTER`, `LDAP_ID_ATTRIBUTE`, plus optional TLS / create-mapping keys.
Copy auth-related vars into `apps/web/.env` as well (Next.js loads env from the app package directory).

See `packages/db/README.md` for database details.

### Verification

Use Node 22.x and the installed pnpm version. The web typecheck regenerates Next route types before checking source, so a stale development cache does not invalidate the check.

```bash
pnpm -r --if-present typecheck
pnpm lint
pnpm --filter @divan/web selfcheck:design-qa
pnpm --filter @divan/web selfcheck:session-token
pnpm --filter @divan/web selfcheck:product-ui
pnpm --filter @divan/web selfcheck:database-health
pnpm --filter @divan/workers selfcheck:recovery-loop
pnpm build
```

Database integration checks **create test people and artifacts** and temporarily test account deactivation. Run them only against a separate, migrated and seeded database, with its exact database name confirmed in `DIVAN_TEST_DATABASE_CONFIRM`. Explicit `DATABASE_URL` takes precedence over `.env`. Start the worker against that same database before the durable-recovery check.

```powershell
$env:DATABASE_URL = '<isolated test PostgreSQL URL>'
$env:DIVAN_TEST_DATABASE_CONFIRM = '<test database name>'
$env:ALLOW_DEV_POPULATION_UUID_REGISTRY = 'true'
pnpm --filter @divan/web selfcheck:product-hardening
pnpm --filter @divan/workers selfcheck:durable-recovery
```

Browser verification covers role login, global search, create/profile navigation, team-filter history, Jalali entry, unsaved-change confirmation, report execution, settings validation, light/dark themes, and scrollable dialogs at a constrained 640×360 CSS viewport. This viewport reproduces the content space of 200% zoom on the minimum desktop display; it is not a claim of testing the browser's own zoom setting. Evidence images are in `docs/qa/2026-10-18/`.

Production cutover still requires the real population adapter and approved scope/bulk policy, identity-provider configuration, and the migration baseline boundary. Fixture registries and the development UUID flag do not establish production workforce authorization. Run web and worker against the same database and keep development accounts out of production.

The provisional development population and bulk ceiling apply before text matching; an exact match outside that capped set cannot be found. The interface discloses truncation and disables incomplete exports. The 61-person integration scenario uses explicit test-only bulk hooks; it does not widen the default application policy.

For a loopback-only production-build preview, set `AUTH_URL=http://127.0.0.1:3000` and `AUTH_TRUST_HOST=true`, and bind Next to `127.0.0.1`. The application explicitly requires this trusted-host flag in production mode. In deployment, configure the canonical origin and trusted reverse proxy before enabling it.
