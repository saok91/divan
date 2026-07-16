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

### App

```bash
pnpm db:generate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — Persian RTL shell placeholder.

See `packages/db/README.md` for database details.
