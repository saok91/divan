---
baseline_commit: f271a15
---

# Story 3.4: Compensation & Contractual Facts Module

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized HR user with compensation permission,
I want effective-dated compensation and contractual facts without payroll calculation,
so that current and historical values remain attributable (FR8).

## Gate (read first)

**Epic 3 ↔ Epic 4 sequencing remains inviolable.** This story ships the **isolated compensation/contractual facts store + temporal invariants + read APIs + seed/selfcheck projection writers** — **not** user-facing contract/compensation change flows, **not** append of Personnel Events, and **not** a throwaway operator CRUD that Epic 4 must delete.

- **Allowed write path:** internal / seed / selfcheck **projection writers** in `@divan/compensation-facts` (names like `applyCompensationProjection` / `applyContractualProjection` / `closeCompensationProjection`) that enforce invariants and will be the same surface Story **4.8** projection refresh calls later.
- **Forbidden:** tRPC/UI that lets operators change salary, contract type, insurer, or effective compensation/contractual *state as product truth*; temporary CRUD; payroll/tax/insurance/payslip/payment calculation helpers; enabling production `compensation` category in `categories.ts`.
- **AD-3 isolation:** Compensation facts live in a **separate PostgreSQL schema** with a dedicated repository owned by `@divan/compensation-facts`. Other modules and `apps/web` MUST NOT import Prisma models, raw SQL table names, or DB clients for that schema. Callers use this module’s public API only.
- **AD-2:** Compensation/contractual rows are **projections / read models**, not event-store authority. Do not treat projection upsert as a substitute for event-store append (Story 4.1+).
- **Category ≠ Dictionary:** Story 2.2 `compensation` category stays `enabled: false` until AR-DATA. Story 3.3 Data Element registry may gain compensation/contractual `ELEMENT_ID` rows (default `later`) — disposition/enablement ≠ category grant.
- **Reuse:** `@divan/temporal-engine` half-open intervals; `@divan/audit-envelope` omit + authorize; Employment 3.2 projection/EXCLUDE patterns; Data Dictionary `assertFieldEnabled` / `assertDerivedSensitivityAllowed` hooks from 3.3. Do not fork a second date library or a second omit/mask path.
- **Ownership split with Employment lean fields:** `Employment.collaborationType` remains a **lean** Employment projection attribute (3.2). Rich contractual facts (contract type/entity, insurer, contract dates, etc.) belong in **compensation-facts** as effective-dated facts. Do **not** duplicate authoritative contract history onto `Employment` columns. Do **not** add compensation amount columns to `Person` or `Employment`.
- **Military-service compensation** (if modeled) still lives in this same isolated schema/repo — not in person-employment or identity-access (AD-3).
- **Headcount:** grade or compensation change alone does **not** consume/release headcount capacity (FR-23 / BR-HC-009 foreshadow) — do not invent headcount side effects here.
- If optional multi-subject list reads are added: preserve PopulationPort + InferenceBulkPort pipeline; do not bypass under break-glass.
- Layout ≠ RSC / UI ≠ data access / default-deny / no client `@prisma/client` remain intact. **No compensation editor UI required for this story.**

[Source: `epics.md` Epic 3 sequencing + Story 3.4; `prd.md` FR-3/FR-7/FR-8/FR-24; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6; Stories 2.2, 3.1–3.3]

## Acceptance Criteria

1. **Given** the compensation-facts module with separate DB schema and repository  
   **When** approved compensation/contractual facts are stored or projected  
   **Then** authorized users can distinguish current vs historical values and provenance

2. **And** the system performs no payroll, tax, insurance, payslip, or payment calculation

3. **And** modules outside compensation-facts cannot import its repository/schema

4. **And** reads/writes pass audit-envelope category checks

5. **And** user-facing *changes* to compensation/contractual state are authored only via Epic 4 Personnel Events (Story 4.8); this story delivers the isolated store, read APIs, and invariants

6. **And** this story does **not** deliver full Epic 5 profile compensation sections, export artifact panel, or production enablement of the `compensation` category (5.2 / 6.5 / AR-DATA)

## Tasks / Subtasks

- [x] Task 1: Separate schema + tables in `@divan/db` owned by compensation-facts (AC: #1, #3)
  - [x] Create PostgreSQL schema `compensation` (or `compensation_facts` — pick one; document in module README) via migration SQL
  - [x] Persistence choice (pick one; document in README — preferred first):
    - **Preferred:** Prisma multi-schema — add schema name to `datasource.schemas`, models with `@@schema("compensation")`, FK to `Person.id` across schemas; Prisma client access **only** inside `@divan/compensation-facts` repository helpers (never re-export raw models from web)
    - **Acceptable:** Raw SQL tables in `packages/db/sql/` + module repository via `@divan/db` pool — if chosen, still only this module may touch those tables
  - [x] Models / tables (effective-dated facts; UUID v7 PKs):
    - Link to `Person.id` with **`onDelete: Restrict`** (never Cascade; ending facts must not delete Person)
    - Optional `employmentId` FK to `Employment.id` when the fact is employment-scoped — Restrict; nullable until always known
    - Half-open interval: `startDate` `DateTime @db.Date`, `endDateExclusive` `DateTime? @db.Date` (`null` = open)
    - **Compensation fact fields** (store only dictionary-allowed attributes when writing): amount/components (Json or typed columns), currency, changeType, notes/reason/reference — empty optionals → `null` (no `""` / `"0"` / `"N/A"` sentinels)
    - **Contractual fact fields** (same interval pattern; may be same table with `factKind` or sibling table — pick one coherent design): collaborationType (rich history), contractType, contractingEntity, insuringEntity, contract dates/reference — align names with addendum §3.2 candidates but **do not auto-enable**
    - **Provenance:** `sourceEventId` `String?` (null until Epic 4; placeholder for Story 4.8), `recordedAt` / `createdAt` / `updatedAt` — Effective Date ≠ registration/system time (FR-44 foreshadow)
    - Prefer PostgreSQL `btree_gist` + `EXCLUDE` for non-overlapping intervals per `(personId, factKind/componentKey)` where applicable (mirror Employment 3.2); domain check still mandatory
  - [x] Update `packages/db/prisma/schema.prisma` header comment: 3.1–3.4; note compensation schema ownership
  - [x] Prefer hand-written migration + `prisma migrate deploy` (avoid Shadow DB / `migrate dev` pain from 3.1)

- [x] Task 2: Domain invariants + projection API in `@divan/compensation-facts` (AC: #1, #2, #5)
  - [x] Replace placeholder `CompensationFactsRepository` brand type with real public surface; keep `COMPENSATION_DATA_CATEGORY = "compensation"` aligned with audit-envelope
  - [x] Pure validators using `@divan/temporal-engine`:
    - `assertValidCompensationInterval(start, endExclusive)`
    - `assertNoOverlapWithExisting(...)` via `intervalsOverlap`
    - `isCompensationActiveAsOf` / `getCompensationAsOf` / `listCompensationFactsForPerson` (and contractual equivalents)
  - [x] `applyCompensationProjection(input)` / `applyContractualProjection(input)` — **internal/seed/Epic-4-ready** writers: validate interval + dictionary gates; upsert projection; map unique/EXCLUDE violations to typed domain errors
  - [x] `closeCompensationProjection(id, endDateExclusive)` — closes open interval only; does not delete Person; does not append events
  - [x] Dictionary gate on writes: call `@divan/person-employment` `assertFieldEnabled(elementId)` (or thin local wrapper) for each compensation/contractual field being stored — reject with stable code when not enabled+approved
  - [x] Read DTO projection: omit unauthorized compensation keys via `omitUnauthorizedCategories` / field→category map — **key absence, never mask** (`0`, `***`, placeholders forbidden)
  - [x] **Do not** export operator verbs: `createCompensation`, `changeSalary`, `updateContract`, `calculatePayroll`, etc.
  - [x] Typed errors in `src/errors.ts`: stable codes + Persian `messageFa` at API boundary; clients match **codes**, not Persian substrings
  - [x] Document Epic 4 handoff checklist in README or `compensation-minimum-facts.ts`:
    | Fact | Owner | Notes |
    | --- | --- | --- |
    | Isolated schema + projection writers | 3.4 | Required before 4.8 |
    | Dictionary-approved field set | 3.3 + AR-DATA | Only approved fields retained on finalize |
    | Separate compensation view/export permissions | 2.2 / AD-5 | Category still disabled until AR-DATA |
    | Personnel Event finalize → projection refresh | 4.8 | Calls same `apply*Projection` surface |
    | Current/historical person state | 4.9–4.10 | Reads from events + projections |
    | Payroll / tax / payment | Out of scope | Must never appear |

- [x] Task 3: Data Dictionary seed rows for compensation/contractual candidates (AC: #1, #6)
  - [x] Add `ELEMENT_ID` entries to `data-dictionary-types.ts` / `DATA_ELEMENT_SEED` for candidate compensation + contractual fields (addendum §3.2 / §3.4 catalogue) with disposition **`later`**, `enabled=false`, and `categoryId: "compensation"` where sensitive
  - [x] Do **not** invent production enablement or flip dispositions to `approve` without AR-DATA walk — spreadsheet/addendum alone never enables
  - [x] Wire derived-sensitivity stub availability: `assertDerivedSensitivityAllowed` reused from 3.3 when AR-DATA defines derived compensation `components` (storage allowed; lineage gate deferred — see deferred-work)
  - [x] Free-text notes: require purpose-limited free-text rules if notes element is modeled

- [x] Task 4: Authz / optional thin read tRPC (AC: #4, #5)
  - [x] **Default (recommended, mirrors 3.2):** module selfcheck proves envelope category checks; **no** operator mutation procedures
  - [x] Optional: thin governed read router (`compensation.listForPerson` / `compensation.asOf`) with `governedProcedure` meta:
    - `permission`: e.g. `compensation.read`
    - `dataCategory`: `"compensation"`
    - `action`: `"read"` (export path, if any demo, must use `action: "export"` separately)
    - `sensitive: true`
    - `operation`: stable audit name
  - [x] If read tRPC added: add `@divan/compensation-facts` to `apps/web` deps; Persian deny copy; map domain errors → `TRPCError` with `divanCode`; `FIELD_NOT_ENABLED`-style config misses → `BAD_REQUEST` (not `FORBIDDEN`) — lesson from 3.3 review
  - [x] Production `categories.ts`: leave `compensation` **`enabled: false`**. Selfchecks may inject a test registry / policy like other modules — never flip production hook as part of this story
  - [x] **Forbidden:** compensation editor UI, Finalize dialogs, `personnel-event-form` (Epic 4 / UX-DR11/14)

- [x] Task 5: Seed + selfcheck + deferred-work (AC: #1–#6)
  - [x] Seed fixtures for demo Person `10001` (or new persons): ≥1 closed historical compensation interval + ≥1 open current; adjacent half-open must succeed; overlapping must fail
  - [x] Prefer `seedCompensationFactsFixtures()` owned by `@divan/compensation-facts`; wire from `identity-access` seed after employment fixtures (preserve AD-3 — do not put SQL in person-employment)
  - [x] `compensation-facts.selfcheck.ts` + package script + root `selfcheck:compensation-facts`
  - [x] Cases in Testing table below
  - [x] Update `deferred-work.md`: close “Real compensation schema + repository”; note AR-DATA compensation enablement list / masking still open; Story 4.8 owns mutations; 5.2 owns profile section; 6.5 owns export panel
  - [x] Preserve prior selfchecks green: `person-identity`, `employment-lifecycle`, `data-dictionary`, `audit-envelope`, `inference-bulk` (as applicable)
  - [x] `pnpm` typecheck: `@divan/compensation-facts`, `@divan/db`, `@divan/temporal-engine`, `@divan/person-employment` (if dictionary touched), `@divan/web` (if tRPC touched)
  - [x] **When marking done:** sync story-file `Status: done` with `sprint-status.yaml` key `3-4-compensation-contractual-facts-module`

### Review Findings

- [x] [Review][Decision] Update semantics for `apply*Projection` — **resolved: snapshot-replace** (document in README; Epic 4 sends full fact state)
- [x] [Review][Decision] Amount `"0"` / numeric `0` — **resolved: allow monetary zero**; N/A-style sentinels still rejected; documented in README + `parseAmount`
- [x] [Review][Decision] Wire `assertDerivedSensitivityAllowed` for `components` — **resolved: keep deferred to AR-DATA**; Task 3 wording aligned; deferred-work updated
- [x] [Review][Decision] Contractual `notes` via `compensation.notes` — **resolved: shared OK until AR-DATA**; documented in README
- [x] [Review][Patch] Enforce `skipDictionaryGate` rejected when `NODE_ENV=production` [`compensation.ts`]
- [x] [Review][Patch] `parseAmount(number)` rejects scientific / non-decimal stringifications [`compensation.ts`]
- [x] [Review][Patch] Whitespace-only `contractStartDate` with end → validation error [`compensation.ts`]
- [x] [Review][Patch] Seed idempotency requires both compensation + contractual adjacent pairs [`seed.ts`]
- [x] [Review][Patch] Seed recreate wrapped in `$transaction` [`seed.ts`]
- [x] [Review][Patch] Employment FK `P2003` mapped via code + message [`compensation.ts`]
- [x] [Review][Patch] Runtime `Prisma` imported from `@divan/db` (value re-export) [`compensation.ts` + `packages/db`]
- [x] [Review][Defer] Check-then-act overlap race under concurrency [`compensation.ts` applyFactProjection] — deferred, pre-existing (same EXCLUDE pattern as Employment 3.2)
- [x] [Review][Defer] Selfcheck creates Person + facts on real DATABASE_URL without cleanup [`compensation-facts.selfcheck.ts`] — deferred, pre-existing (same thin-selfcheck pattern as 3.1/3.2)

## Dev Notes

### Epic 2 / 3.1–3.3 carry-in

| Item | How 3.4 absorbs it |
| --- | --- |
| Epic 3↔4 no temporary CRUD | Gate + Tasks: projection writers + reads only; mutations = Story 4.8 |
| AD-3 compensation seam (2.2) | Replace typed placeholder with real schema/repo; keep boundary README contract |
| Category omit (2.2) | `dataCategory: "compensation"`; omit unauthorized keys; export ≠ view |
| Employment intervals (3.2) | Mirror half-open + EXCLUDE + `apply*Projection` naming |
| Data Dictionary (3.3) | Gate which fields may be stored; seed `later` compensation/contractual elements |
| Status ↔ sprint alignment | Task 5 DoD on done transition (Epic 1/2 open action item) |
| AR numbers fail-closed | Do not invent enablement; category stays disabled |
| PopulationPort fixtures | Named only — no cutover; subject id target remains Person UUID |
| Error UX (3.1/3.3 review) | Stable error **codes** for clients; config miss ≠ FORBIDDEN |
| Layout ≠ RSC | No new page that trusts layout alone for data access |

### Epic context

- **Epic 3:** Workforce Master Data & Organization — FR5–FR13.
- **This story:** FR-8 — effective-dated compensation/contractual facts; no payroll calc; isolated module.
- **Upstream (done):** 2.2 category hooks + compensation-facts seam; 3.1 Person; 3.2 Employment; 3.3 Data Dictionary.
- **Downstream:** 4.8 contract/compensation change events; 4.9–4.10 current/historical state; 5.2 profile sensitive sections; 5.5 reports; 6.x migration seeding + governed export.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| User-facing compensation/contract change UI + Finalize | Story 4.8 |
| Append-only business events | Story 4.1+ |
| Payroll, tax, insurance, payslip, payment calculation | Out of scope (FR-8 / PRD §5.3) |
| Full personnel profile compensation section + DOM omit polish | Story 5.2 |
| Export artifact panel + custody acknowledgement | Story 6.5 |
| Enable production `compensation` category | AR-DATA |
| Exact compensation field enablement list / masking rules | AR-DATA walk (still open) |
| Promotion request/committee workflow | Deferred architecture |
| PopulationPort real cutover | 3.5–3.9 / 4.x |
| Vitest/CI full suite | Thin selfcheck pattern continues |
| Nest / CASL / client Prisma | Architecture |

### Architecture compliance

| Decision | Implication for 3.4 |
| --- | --- |
| AD-2 | Projection store only; no event append; no throwaway CRUD truth |
| AD-3 | Separate schema + repository; no cross-module table imports |
| AD-5 | Envelope category checks + access events; view ≠ export |
| AD-6 | Prisma/SQL for projections; no `@prisma/client` in `apps/web`; tRPC wraps module APIs |
| FR-8 | Current vs historical + provenance; zero payroll calc |
| FR-3 | Sensitive category segregation; System Admin no routine HR content |
| FR-24 | Field retention catalogue informs schema; **writes** wait for 4.8 |
| NFR-4 | Domain + preferred EXCLUDE for concurrent interval integrity |
| NFR-8 | At-rest sensitive schema isolation (logical schema minimum) |

### Temporal rules (must follow — same as Employment)

```
Active at as-of D ⇔ startDate ≤ D < endDateExclusive
Overlap(A,B)      ⇔ intervalsOverlap(...)
Back-to-back OK   ⇔ A.endDateExclusive === B.startDate
```

Reuse `@divan/temporal-engine`. Asia/Tehran date-only Effective Dates. Do not store wall-clock timestamps as Effective Date.

### UPDATE files — current state (read before editing)

| File | Today | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/modules/compensation-facts/src/index.ts` | Typed seam: `COMPENSATION_DATA_CATEGORY`, brand `CompensationFactsRepository`, `describeCompensationFactsBoundary()` | Real public API: projection writers, reads, types | Category constant string `"compensation"`; no Prisma export to callers |
| `packages/modules/compensation-facts/README.md` | Boundary contract; “no schema yet” | Schema ownership, API names, temporal rules, Epic 4 handoff | AD-3 / no payroll / category disabled until AR-DATA |
| `packages/modules/compensation-facts/package.json` | `typecheck` only; deps already include audit-envelope, db, temporal-engine, event-store | Add `selfcheck:compensation-facts` + `tsx` (and dotenv if needed) | Workspace deps; no React |
| `packages/db/prisma/schema.prisma` | Single public schema; Person/Employment/DataElement | Multi-schema compensation models **or** document SQL-only ownership | Person/Employment lean shape; no compensation columns on Person |
| `packages/kernel/audit-envelope/src/categories.ts` | `compensation` hook `enabled: false`; DEV_DEMO does not enable it | **Docs-only / no production enable** | Fail-closed category gate |
| `packages/modules/person-employment/src/data-dictionary-types.ts` | Identity/contact seed; no compensation elements | Add `later` compensation/contractual ELEMENT_IDs | Existing approve/later/reject rows and enablement rules |
| `packages/modules/identity-access/src/seed.ts` | Seeds person/employment/dictionary | Call compensation seed fixture after employment | Seed order; AD-3 ownership of compensation seed |
| `_bmad-output/implementation-artifacts/deferred-work.md` | “Real compensation schema → 3.4” open | Close 3.4 deferrals; keep AR-DATA walks open | Other epic deferrals |

### File structure (expected touch set)

| Path | Action |
| --- | --- |
| `packages/db/prisma/migrations/<ts>_compensation_schema/migration.sql` | **NEW** — `CREATE SCHEMA` + tables + indexes/EXCLUDE |
| `packages/modules/compensation-facts/src/db.ts` | **NEW** — module DB accessor |
| `packages/modules/compensation-facts/src/errors.ts` | **NEW** — typed errors + Persian msgs |
| `packages/modules/compensation-facts/src/compensation-invariants.ts` | **NEW** — interval/overlap/as-of |
| `packages/modules/compensation-facts/src/compensation.ts` | **NEW** — apply/close/list/as-of writers+reads |
| `packages/modules/compensation-facts/src/contractual.ts` | **NEW** (or fold into compensation.ts) |
| `packages/modules/compensation-facts/src/projection.ts` | **NEW** — omit/category projection for DTOs |
| `packages/modules/compensation-facts/src/seed.ts` | **NEW** — demo fixtures |
| `packages/modules/compensation-facts/src/compensation-facts.selfcheck.ts` | **NEW** |
| `packages/modules/compensation-facts/src/index.ts` | **UPDATE** — public exports |
| `packages/modules/compensation-facts/README.md` | **UPDATE** |
| `packages/modules/compensation-facts/package.json` | **UPDATE** |
| `packages/db/prisma/schema.prisma` | **UPDATE** (if Prisma multi-schema) |
| `packages/modules/person-employment/src/data-dictionary-types.ts` | **UPDATE** — later ELEMENT_IDs |
| `packages/modules/identity-access/src/seed.ts` | **UPDATE** — wire seed |
| `package.json` (root) | **UPDATE** — selfcheck script |
| `apps/web/src/server/compensation.ts` + `root.ts` | **OPTIONAL** thin read router |
| `apps/web/package.json` | **OPTIONAL** workspace dep |

### Library / stack

| Package | Pin / note |
| --- | --- |
| Node | **22.x** |
| TypeScript | **5.8.x** |
| Prisma | **7.8.x** — multi-schema is GA (use `schemas` + `@@schema`; no `multiSchema` preview flag) |
| PostgreSQL | **17.x** |
| Next.js | **16.2.x** |
| tRPC | **11.x** |
| `@divan/temporal-engine` | Half-open date-only — reuse |
| `@divan/audit-envelope` | Category omit + authorize — reuse |
| Vitest | Not required — selfcheck/tsx pattern |

### Latest tech notes (Prisma multi-schema)

- Configure `datasource db { provider = "postgresql"; schemas = ["public", "compensation"] }` (exact schema name as chosen).
- Assign models with `@@schema("compensation")`.
- Cross-schema FKs to `Person` / `Employment` are supported on PostgreSQL.
- Use `prisma migrate deploy` in shared environments; avoid production `migrate dev` / `db push`.
- Isolation rule remains **module ownership**, not Prisma feature alone — never import compensation models from `apps/web` or `person-employment`.

### Testing requirements

| Case | Expect |
| --- | --- |
| Seed closed historical + open current intervals for demo Person | Both stored; `asOf` distinguishes current vs historical |
| Adjacent half-open intervals (endExclusive === next start) | Accepted |
| Overlapping intervals same person/component (or factKind) | Rejected (domain + optional EXCLUDE) |
| `getCompensationAsOf` outside all intervals | Empty / null — not fabricated zeros |
| Disabled production `compensation` category | Read/write fail-closed or keys omitted per envelope rules |
| Dictionary field not enabled | Write rejected with stable code (config miss → BAD_REQUEST at tRPC if exposed) |
| Operator mutation product API (`changeSalary`, etc.) | Must not exist on public surface |
| Payroll/tax/payment helper | Must not exist |
| Cross-module import of compensation Prisma/SQL from web or person-employment | Forbidden (architecture / lint if feasible) |
| Person delete while compensation rows exist | FK RESTRICT fails |
| Prior selfchecks | Still green |

### UX notes (read path only)

- No dedicated compensation form in UX for 3.4. Epic 4 uses `personnel-event-form` + `sensitive-confirmation-dialog` for changes.
- When amounts appear in later UI: Persian digits + thousand separator `٬` (UX-DR20); negative display pending AR-DATA.
- Unauthorized fields: excluded from DOM when Epic 5 profile lands — this story establishes API omit contract.

### Git intelligence

Recent commits: `f271a15` story 3.3 → `51eb947` story 3.2 → `ce31f55` story 3.1 → Epic 2 retro/stories. Pattern: Prisma/SQL migration → domain module projection writers → seed → selfcheck → deferred-work → sprint sync. Mirror Employment for intervals; mirror Dictionary for field enablement; keep compensation package as sole schema owner.

### Project context reference

- No `project-context.md` found in repo; authoritative rules are ARCHITECTURE-SPINE, epics, PRD/SPEC dispositions, and Stories 2.2 / 3.1–3.3.
- Open sprint action items relevant here: keep story-file Status ↔ sprint-status aligned on done; do not invent AR-* numbers; sticky authz UX debt stays out of scope.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3 sequencing; Story 3.4; Story 4.8]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-3, FR-7, FR-8, FR-24; §5.3 Non-Goals]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-5, AD-6; Structural Seed]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md` — sensitive compensation schema]
- [Source: `_bmad-output/specs/spec-divan/data-element-dispositions.md` — compensation later/open walks]
- [Source: `_bmad-output/implementation-artifacts/2-2-sensitive-categories-separate-export-permission.md`]
- [Source: `_bmad-output/implementation-artifacts/3-2-employment-lifecycle-invariants.md`]
- [Source: `_bmad-output/implementation-artifacts/3-3-data-dictionary-governed-profile-fields.md`]
- [Source: `packages/modules/compensation-facts/src/index.ts` + `README.md`]
- [Source: Prisma docs — multi-schema PostgreSQL (GA)]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Prisma multi-schema: all existing models annotated `@@schema("public")`; `CompensationFact` in `compensation`.
- Seed/selfcheck uses `skipDictionaryGate: true` because catalogue elements remain `later` until AR-DATA; enforce path proven via FIELD_NOT_ENABLED selfcheck case.
- No tRPC router added (Task 4 default path — envelope proven in module selfcheck).

### Completion Notes List

- Isolated PostgreSQL schema `compensation` + `CompensationFact` with half-open intervals, EXCLUDE on `(personId, factKind)`, Person/Employment Restrict FKs.
- Public API: `applyCompensationProjection`, `applyContractualProjection`, `closeCompensationProjection`, as-of/list reads, `projectCompensationRecord` omit.
- Dictionary seed: compensation/contractual ELEMENT_IDs disposition `later`, categoryId `compensation`.
- Seed fixtures for Person 10001 wired from identity-access; selfcheck green; prior selfchecks green.
- Production `compensation` category left disabled; no payroll helpers; no operator mutation verbs.

### File List

- `packages/db/prisma/migrations/20260717183000_compensation_facts/migration.sql` (new)
- `packages/db/prisma/schema.prisma` (modified)
- `packages/modules/compensation-facts/package.json` (modified)
- `packages/modules/compensation-facts/README.md` (modified)
- `packages/modules/compensation-facts/src/index.ts` (modified)
- `packages/modules/compensation-facts/src/category.ts` (new)
- `packages/modules/compensation-facts/src/db.ts` (new)
- `packages/modules/compensation-facts/src/errors.ts` (new)
- `packages/modules/compensation-facts/src/normalize.ts` (new)
- `packages/modules/compensation-facts/src/compensation-invariants.ts` (new)
- `packages/modules/compensation-facts/src/compensation.ts` (new)
- `packages/modules/compensation-facts/src/projection.ts` (new)
- `packages/modules/compensation-facts/src/compensation-minimum-facts.ts` (new)
- `packages/modules/compensation-facts/src/seed.ts` (new)
- `packages/modules/compensation-facts/src/compensation-facts.selfcheck.ts` (new)
- `packages/modules/person-employment/src/data-dictionary-types.ts` (modified)
- `packages/modules/identity-access/src/seed.ts` (modified)
- `packages/modules/identity-access/package.json` (modified)
- `package.json` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/3-4-compensation-contractual-facts-module.md` (modified)

### Change Log

- 2026-07-17: Implemented Story 3.4 — compensation schema, projection API, dictionary candidates, seed/selfcheck; status → review.
- 2026-07-17: Code review — decisions applied (snapshot update, monetary zero, derived/notes deferred); patches applied; status → done.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
