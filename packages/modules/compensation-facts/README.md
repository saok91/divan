# @divan/compensation-facts

Isolated compensation and contractual facts module (Architecture AD-3 / Story 3.4 / FR-8).

## Schema ownership

- PostgreSQL schema: **`compensation`**
- Table: `compensation.CompensationFact` (single table; `factKind` = `compensation` | `contractual`)
- Persistence: Prisma multi-schema (`@@schema("compensation")`)
- **Only this package** may access Prisma models / SQL for that schema. Other modules and `apps/web` MUST use this public API.

## Public API (projection writers + reads)

| Function | Role |
| --- | --- |
| `applyCompensationProjection` | Internal / seed / Epic-4-ready writer for compensation facts |
| `applyContractualProjection` | Same for contractual facts |
| `closeCompensationProjection` | Close an open interval (no Person delete, no event append) |
| `getCompensationAsOf` / `getContractualAsOf` | Current vs historical as-of reads |
| `listCompensationFactsForPerson` | List intervals for a person |
| `projectCompensationRecord` | Omit unauthorized category keys (never mask) |

**Update semantics:** `apply*Projection` with `id` is a **full snapshot replace** of projection attributes (same pattern as Employment 3.2). Omitted optionals are stored as `null` — callers (Story 4.8) must send the complete intended fact state, not a partial patch.

**Amount:** `"0"` / numeric `0` are real monetary zeros. Missing amount → `null`. Identity-style sentinels (`N/A`, verified absence) are rejected.

**Forbidden product verbs:** `createCompensation`, `changeSalary`, `updateContract`, `calculatePayroll`, etc.

## Temporal rules

Half-open intervals via `@divan/temporal-engine`:

```
Active at as-of D ⇔ startDate ≤ D < endDateExclusive
Overlap(A,B)      ⇔ intervalsOverlap(...)
Back-to-back OK   ⇔ A.endDateExclusive === B.startDate
```

Non-overlap also enforced with PostgreSQL `EXCLUDE` on `(personId, factKind)`.

## Category & dictionary

- Audit-envelope category: `compensation` — **production `enabled: false` until AR-DATA**
- Writes call Data Dictionary `assertFieldEnabled` unless `skipDictionaryGate` (seed/selfcheck only; **rejected when `NODE_ENV=production`**)
- Seed catalogue elements are disposition **`later`** — spreadsheet presence never enables
- Contractual free-text `notes` share `compensation.notes` until AR-DATA adds a separate contract-notes element
- `assertDerivedSensitivityAllowed` for derived `components` lineage → wire when AR-DATA defines derived compensation elements

## Epic 4 handoff

See `COMPENSATION_MINIMUM_FACTS` in `compensation-minimum-facts.ts`. Story **4.8** calls the same `apply*Projection` surface after Personnel Event finalize. No payroll/tax/payment calculation ever.

## Selfcheck

```bash
pnpm selfcheck:compensation-facts
```
