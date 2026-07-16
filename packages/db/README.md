# @divan/db

Prisma-managed projections live here. Kernel append-only store uses raw SQL under `sql/` (later stories).

## Local PostgreSQL (dev only)

Requires PostgreSQL **17.10+**. From the repo root:

```bash
pnpm db:up
```

Port override when 5432 is busy:

```bash
POSTGRES_PORT=5433 pnpm db:up
```

(Update `DATABASE_URL` host port to match.)

Stop: `pnpm db:down`. Logs: `pnpm db:logs`.

Copy root `.env.example` to `.env`, then:

```bash
pnpm db:generate
pnpm db:migrate
```

### Dev seed (identity-access owned)

Seed logic lives in `@divan/identity-access`. From repo root:

```bash
ALLOW_DEV_SEED=true pnpm db:seed
```

Guards: refuses `NODE_ENV=production` and requires `ALLOW_DEV_SEED=true`.

Creates exactly five internal accounts (one human ↔ one account ↔ one MVP coarse role). Credentials are documented in the root README for local/dev/CI only.

Connectivity helper: `checkDatabaseConnectivity(process.env.DATABASE_URL!)` — returns `false` on failure.
