# Kernel raw SQL migrations

Append-only event-store and other kernel tables live here — **not** via Prisma models (AD-3 / AD-6).

## Apply

Requires `DATABASE_URL` (same as Prisma). From repo root:

```bash
# PowerShell
$env:DATABASE_URL = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=','' -replace '"',''
pnpm --filter @divan/db exec node ./sql/apply.mjs

# or with psql if installed
psql "$DATABASE_URL" -f packages/db/sql/001_kernel_events.sql
```

`apply.mjs` runs every `NNN_*.sql` file in lexical order inside a transaction per file.

## Conventions

- Filename: `NNN_description.sql` (zero-padded sequence)
- Migrations must be idempotent where practical (`IF NOT EXISTS`)
- Event log is **append-only** at the application API — do not add UPDATE/DELETE helpers in `@divan/event-store`
- Access events (`event_class=access`) must never feed projections / derived state
