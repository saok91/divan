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
psql "$DATABASE_URL" -f packages/db/sql/003_business_event_attributable_fields.sql
```

`apply.mjs` runs every `NNN_*.sql` file in lexical order inside a transaction per file (includes `003_business_event_attributable_fields.sql`).

For fresh installations, Prisma migration `20260716210000_kernel_events_bootstrap` first creates the base event table if absent, before the access-administration migration alters its actor column. This compatibility bridge avoids a circular bootstrap dependency. Continue to run all kernel SQL after `pnpm db:migrate`; kernel schema evolution and append-only behavior remain owned by these raw SQL files. The bridge is idempotent for databases that already have the event store.

## Conventions

- Filename: `NNN_description.sql` (zero-padded sequence)
- Migrations must be idempotent where practical (`IF NOT EXISTS` / constraint name guards)
- Event log is **append-only** at the application API — do not add UPDATE/DELETE helpers in `@divan/event-store`
- DB trigger `kernel_events_append_only_trg` blocks UPDATE/DELETE (Story 4.1); `REVOKE` remains commented until app role model is clear

### Business vs access column rules

| `event_class` | Required / rules |
| --- | --- |
| `access` | `result` NOT NULL (`allow`/`deny`); business FR-14 columns (`event_type`, `person_id`, `effective_date`, `status`, `registered_at`, `registered_by`) stay NULL |
| `business` | `event_type`, `person_id`, `effective_date`, `status`, `registered_at`, `registered_by` NOT NULL; `result` IS NULL; `employment_id` nullable until Draft/Start binds Employment |
| Both | `effective_date` is DATE (business clock); `registered_at` / `finalized_at` are timestamptz — never overload Effective Date as registration time |

Access events (`event_class=access`) must never feed projections / derived state. Projections are never source of truth (AD-2).
