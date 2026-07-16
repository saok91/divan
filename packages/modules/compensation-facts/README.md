# @divan/compensation-facts

Boundary module for compensation facts (Architecture AD-3 / Story 2.2).

## Contract

- Compensation data will live in a **dedicated schema and repository** inside this package (Story 3.4).
- **Do not** import Prisma models or SQL for compensation tables from `apps/web` or other modules.
- Access compensation only via this module’s public API, after **audit-envelope** authorization (`dataCategory: "compensation"`). Export requires a separate `action: "export"` allow — never implied by view.
- The category stays **disabled** in the category registry until an AR-DATA disposition enables it.

## Current state

Typed seam / placeholders only — no domain schema, migrations, or payroll logic yet.
