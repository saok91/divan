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
# PowerShell
$env:ALLOW_DEV_SEED="true"; pnpm db:seed
# bash
ALLOW_DEV_SEED=true pnpm db:seed
```

Seed **refuses** to run when `NODE_ENV=production` or `ALLOW_DEV_SEED` is not exactly `true`.

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

Required env (see `.env.example`): `AUTH_SECRET`, `IDENTITY_PROVIDER` (`seeded` for local), session timeout hooks.
For LDAP mode (Infra-gated): `LDAP_URL`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_BASE_DN`, `LDAP_USER_FILTER`, `LDAP_ID_ATTRIBUTE`, plus optional TLS / create-mapping keys.
Copy auth-related vars into `apps/web/.env` as well (Next.js loads env from the app package directory).

See `packages/db/README.md` for database details.
