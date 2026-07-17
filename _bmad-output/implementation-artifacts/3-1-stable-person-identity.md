---
baseline_commit: 319be13
---

# Story 3.1: Stable Person Identity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin or Operator,
I want to create and maintain a Person with a unique Personnel Code,
so that human identity survives Employment end and return (FR5).

## Gate (read first)

**Epic 3 ↔ Epic 4 sequencing is inviolable (Epic 2 retro action #3).** This story ships **Person master-data** (stable identity aggregate, uniqueness, create/maintain identity fields, read/display, fail-closed blocked ops) — **not** Employment/Assignment/compensation mutations via throwaway CRUD, and **not** Personnel Event flows.

- **Allowed write path:** create/update **Person identity facts** only (Personnel Code, approved name/identity keys) through `@divan/person-employment` + `governedProcedure` + audit-envelope.
- **Forbidden in this story / epic:** temporary CRUD that creates or mutates Employment, Primary/Secondary Assignment, or compensation/contractual *state* — those authoritative mutations land only in **Epic 4** after the append-only event store (4.1+). Do **not** invent a “start Employment” shortcut that Epic 4 must delete.
- **AR-DATA / AR-MIGRATION remain pending** for Personnel Code correction, merge, split, and return-matching policy. Those operations **MUST fail closed** with Persian explanation — do not invent policy.
- **AR-ACCESS / AR-DATA / AR-REPORTING / AR-IDENTITY numbers stay fail-closed** (Epic 2 retro #5). Do not invent production thresholds, LDAP group→role sync, or enable sensitive categories as “launch frozen.”
- `identity.national_id` category hook exists and stays **`enabled: false`** until formal AR-DATA category enablement — even though the Data Element disposition list marks National ID as `approve`. Schema uniqueness when present ≠ category grant.
- Reuse Epic 2 substrate: `governedProcedure`, `authorizeOrThrow`, access events, category omit, PopulationPort ∩ InferenceBulkPort pipeline for any multi-subject retrieval. **Extend** — do not fork a second authz stack.
- `HumanIdentity` / `InternalAccount` are **login projections**, not HR Person. Do **not** merge them or treat account id as Personnel Code.
- Layout ≠ RSC: any `/personnel` (or create) RSC page calls `assertPageAccess` **before** loaders; client UI ≠ data access.

[Source: `epics.md` Epic 3 sequencing + Story 3.1; `prd.md` FR-5; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6; `epic-2-retro-2026-07-17.md`; `data-element-dispositions.md`; Stories 2.1–2.7]

## Acceptance Criteria

1. **Given** an authorized HR user on سطح پرسنل / create Person  
   **When** they create a Person with an approved unique Personnel Code and identity keys  
   **Then** the Person is stored with server-generated UUID PK; Personnel Code is the domain identifier (not the PK)

2. **And** duplicate Personnel Codes are rejected; duplicate national IDs are rejected when that field is approved and present

3. **And** empty optional values are not stored as zero, verified absence, or N/A (omit / null — never sentinel strings)

4. **And** Personnel Code correction, merge, split, and return matching remain blocked until AR-DATA/AR-MIGRATION policy exists (operations fail closed with Persian explanation)

5. **When** Employment ends (invariant / seeded or future Epic 4 Termination — not a UI in this story)  
   **Then** the Person and permitted history remain (no cascade-delete of Person on Employment end)

6. **And** Layout ≠ RSC / UI ≠ data access / default-deny / no client import of `@divan/identity-access` or `@divan/person-employment` internals remain intact

## Tasks / Subtasks

- [x] Task 1: Person projection schema in `@divan/db` + module ownership (AC: #1, #2, #3, #5)
  - [x] Add Prisma `Person` model under `packages/db/prisma/schema.prisma` (projection owned by person-employment semantics):
    - `id` — `String @id @default(uuid())` (server-generated UUID; prefer Prisma `uuid()` / UUID v7 if already supported by pinned Prisma 7.8 — **do not** use Personnel Code as PK; **do not** reuse `cuid()` solely because identity tables do)
    - `personnelCode` — `String @unique` (domain identifier; normalize digit form for uniqueness — accept Latin/Persian digits on input, store one canonical form documented in module)
    - Required identity keys for create: `givenName` (نام), `familyName` (نام خانوادگی), and `mobilePhone` (موبایل — AR-DATA MVP mandatory) — align with AR-DATA approve set
    - Optional approved identity fields may be columns **or** deferred to Story 3.3 Data Dictionary profile — **minimum for 3.1 create:** Personnel Code + given + family + mobile. If adding further optional columns now (e.g. `fatherName`, `birthDate`, `gender`, `nationality`, `nationalId`), respect dispositions: only `approve` elements; `reject`/`later` stay out
    - `nationalId` — optional `String?` with **unique partial** semantics: uniqueness when present (PostgreSQL partial unique index `WHERE national_id IS NOT NULL` via Prisma `@@unique` + app guard, or raw SQL migration if Prisma cannot express partial unique — document choice)
    - Timestamps `createdAt` / `updatedAt`; no soft-delete that erases history
  - [x] Update schema header comment: identity projections + Person (Story 3.1); still no Employment event-store ownership
  - [x] **No FK** from Person → `HumanIdentity` in this story (link policy is AR-IDENTITY / later). Comment that they are distinct aggregates
  - [x] Migration via Prisma for Person only — **no** Employment/Assignment tables required for 3.1 AC (Employment table may appear in 3.2). If a stub Employment relation is tempting for AC #5, prefer a documented invariant test + comment over inventing Employment CRUD
  - [x] Empty optional handling: repository `create`/`update` strips empty strings → `null`; reject storage of `"0"`, `"N/A"`, `"n/a"`, `"verified absence"` as stand-ins for missing optionals

- [x] Task 2: `@divan/person-employment` domain APIs (AC: #1–#5)
  - [x] Replace stub `export {}` with real module surface (pure/server, no React):
    - `createPerson(input, ctx)` / `updatePersonIdentity(id, input, ctx)` / `getPersonById` / `getPersonByPersonnelCode`
    - Typed domain errors: `DuplicatePersonnelCode`, `DuplicateNationalId`, `PersonNotFound`, `BlockedIdentityOperation` (correction/merge/split/return-match)
  - [x] Blocked ops API (or explicit deny in any attempted path): `correctPersonnelCode`, `mergePersons`, `splitPerson`, `matchReturn` — each throws fail-closed with stable Persian message keys (e.g. «این عملیات تا تعیین سیاست داده/مهاجرت مجاز نیست.») — **no silent combine/detach** of Employment/compensation/access/headcount history
  - [x] AC #5 continuity: document + selfcheck that Person delete-on-Employment-end is **not** offered; if Employment model appears later, `onDelete` must not cascade-remove Person
  - [x] Export public types from `packages/modules/person-employment/src/index.ts` only — web must not import Prisma Person model directly (AD-6 / existing `no-restricted-imports`)
  - [x] Module may depend on `@divan/db`, `@divan/audit-envelope` types/helpers as needed; **do not** start writing business events to event-store for Person create (Person master-data ≠ Personnel Event)

- [x] Task 3: Governed tRPC + permissions (AC: #1, #2, #4, #6)
  - [x] Add `person` (or `personnel`) router under `apps/web/src/server/` using `governedProcedure` with explicit meta, e.g.:
    - `permission: "person.write"` / `"person.read"` (stable codes — seed into a PermissionSet bound for demo `hr_admin` / `hr_operator` paths; **never** “coarseRole ⇒ allow”)
    - `dataCategory`: ordinary identity profile category for name/code (e.g. `identity.person` — register as enabled ordinary/demo-safe) vs `identity.national_id` when reading/writing national ID
    - `action: "read" | "write"`; national ID export still separate `export` if ever exposed
    - `organizationalScope` + `operation` stable names (`person.create`, `person.identity.update`, `person.get`, …)
    - `sensitive: true` when national ID or other sensitive categories touched
  - [x] National ID write/read: envelope category gate first — with production hook `enabled: false`, attempts fail closed unless explicit DEV_DEMO category enablement for selfcheck (mirror compensation pattern). Duplicate check still enforced whenever a non-null national ID is accepted
  - [x] Denied → Persian access copy; no Person payload leakage
  - [x] Wire router into `root.ts` appRouter

- [x] Task 4: سطح پرسنل UI — create / maintain (AC: #1, #3, #6)
  - [x] Convert `apps/web/app/(app)/personnel/page.tsx` from client-only Jalali demo host to **RSC shell** pattern like `/access`: `auth()` → `assertPageAccess(coarseRole, "/personnel")` → client panel
  - [x] Preserve existing Jalali / banner demo controls in a clearly secondary section **or** move demos aside — primary job of the page becomes Person create + list/read of created Persons (thin; full search/table = Epic 5)
  - [x] Create Person form (Persian RTL): Personnel Code, نام, نام خانوادگی, موبایل; optional fields only if implemented in Task 1; inline validation; Persian digit display for codes where UX requires it; Latin normalization on submit for uniqueness
  - [x] Duplicate Personnel Code / national ID → field-level Persian error (not generic 500)
  - [x] Blocked ops: do **not** show merge/split/correct-code/return-match actions; if deep-linked API called, surface fail-closed Persian explanation
  - [x] Interactive a11y DoD: keyboard, visible focus, RTL, no emoji; loading/empty/error with operational copy
  - [x] Do **not** build full `personnel-data-table` Epic 5 search, profile sections, or event form

- [x] Task 5: PopulationPort cutover plan + authz continuity (Epic 2 retro #4) (AC: #6)
  - [x] Document in module README or `population-authz.ts` comment: fixture `person:a1` ids remain until Assignment/Org projections exist (Stories 3.5–3.9 / 4.x); **subject id target** for real port = Person UUID
  - [x] If this story returns any multi-subject id list via retrieval demos, ids MUST be real Person UUIDs **or** remain on fixture path — do not invent a parallel population checker
  - [x] Do **not** silently leave “fixture forever” without a named cutover note in `deferred-work.md`
  - [x] Preserve pipeline order: authorize → PopulationPort → InferenceBulkPort → access event → payload

- [x] Task 6: Seed, copy, deferred-work, DoD (AC: #1–#6)
  - [x] Seed ≥1 demo Person for local/dev (unique personnel codes); bind `person.read` / `person.write` into demo PermissionSets used by hr_admin / hr_operator selfcheck actors
  - [x] Add `operationalCopy` keys for blocked identity ops + duplicate errors if not reusable
  - [x] Update `deferred-work.md`: Person master-data landed; correction/merge/split/return-match still AR-DATA/AR-MIGRATION; PopulationPort fixture→Person UUID cutover still open until org/assignment projections; sticky break-glass / fingerprint debt unchanged
  - [x] `.env.example` only if new keys required
  - [x] Selfcheck: `person-employment.selfcheck.ts` (+ root script e.g. `selfcheck:person-identity`) covering Testing table
  - [x] `pnpm` typecheck: `@divan/person-employment`, `@divan/db`, `@divan/web` (+ lint web)
  - [x] **When marking done:** sync story-file `Status: done` with `sprint-status.yaml` key `3-1-stable-person-identity` (close Epic 1/#8 + Epic 2/#2 process gap on this transition)

## Dev Notes

### Epic 2 retrospective — mandatory carry-in

| Retro item | How this story absorbs it |
| --- | --- |
| #3 Encode Epic 3↔4 no temporary CRUD | Gate + Task 1–2: Person identity writes OK; Employment/Assignment/compensation state CRUD forbidden |
| #4 PopulationPort → projections | Task 5: named cutover; Person UUID as future subject id; fixtures until 3.5+ |
| #5 Do not invent AR numbers | Gate: fail-closed hooks; national_id category stays disabled |
| #2 Status ↔ sprint alignment | Task 6 DoD reminder on done transition |
| #7 Sticky BG / fingerprint debt | Non-goal; leave in deferred-work — do not “fix” casually on personnel page |
| #6 Inference process-local window | Ops note only; AD-1 single process — do not build shared Redis store here |
| #8 Artifact reauth | Reserved for 6.5 / 7.x — not this story |

### Epic context

- **Epic 3:** Workforce Master Data & Organization — FR5–FR13.
- **This story:** FR-5 only — stable Person + Personnel Code uniqueness + fail-closed identity policy gaps.
- **Upstream (done):** Epic 1 shell/auth; Epic 2 envelope, categories, access admin, grants, break-glass, PopulationPort, InferenceBulkPort.
- **Downstream:** 3.2 Employment invariants (schema/constraints, no event UI); 3.3 Data Dictionary profile fields; 3.4 compensation-facts store; 3.5–3.9 org/job/assignments/management; Epic 4 authoritative events; Epic 5 search/profile UI richness.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Employment create/end UI or event append | Epic 4 (4.5–4.6); invariants in 3.2 |
| Primary/Secondary Assignment writes | 3.7–3.8 read/constraints; mutations Epic 4 |
| Full profile Data Dictionary enablement UI | Story 3.3 |
| Compensation facts schema/repo | Story 3.4 |
| Org hierarchy / job refs | 3.5–3.6 |
| Full personnel search table / profile / timeline | Epic 5 |
| Personnel Code correction / merge / split / return match | AR-DATA + AR-MIGRATION |
| LDAP group→role; link Person↔InternalAccount | AR-IDENTITY |
| Enable `identity.national_id` in production registry | Formal AR-DATA category disposition |
| Nest/CASL/Ability/Passport; Prisma audit tables | Not in architecture |
| Client import of module internals / `@prisma/client` | AD-6 / prior stories |
| Shared multi-instance inference window store | deferred-work / ops |

### Architecture compliance

| Decision | Implication for 3.1 |
| --- | --- |
| AD-2 | Person identity master-data is **not** a substitute for append-only Personnel Events. Do not append business events for simple Person create. |
| AD-3 | All Person logic lives in `@divan/person-employment`; other modules call published APIs only. |
| AD-5 | Sensitive read/write (esp. national ID) through audit-envelope; access events on sensitive decisions. |
| AD-6 | Prisma projections for Person; tRPC via envelope-wrapped module APIs; no direct Prisma in `apps/web`. |
| IDs | UUID PK; Personnel Code = domain id `@unique`. |
| Errors | Typed domain errors; Persian at API boundary. |

### Data / field guidance

**Minimum create (pre-prd §10.2 + FR-5 + mobile disposition):** Personnel Code, نام, نام خانوادگی, موبایل.

**AR-DATA partial freeze (`data-element-dispositions.md`):** Personnel Code, names, father name, birth date, gender, nationality, National ID, mobile = `approve`. Religion/sect = `reject`. Others `later`.

**Story split:** 3.1 must ship uniqueness + create/maintain for the **minimum** set (code + given + family). Expanding optional approve columns is OK if it does not pull in 3.3 dictionary governance UI.

**Mobile phone (disposition = approve, MVP mandatory):** Include `mobilePhone` as **required on create** in this story (simple string column + validation). Full contact Data Dictionary governance remains Story 3.3 — do not build dictionary admin UI here. Do not silently drop the mandatory mobile disposition.

**National ID:** Element approved; envelope category disabled → store path must authorize category; production default deny until enabled; uniqueness when non-null.

### Empty optional rule (FR-5)

| Bad | Good |
| --- | --- |
| Store `"N/A"`, `"0"`, `""` as meaning “unknown” | Store `null` / omit key |
| Mask missing as verified absence | Absence = no value |

### UX

- Surface: **پرسنل** (`/personnel`) — EXPERIENCE landing for operators; create Person is in-scope thin form, not full `personnel-data-table`.
- RTL Persian; digits: display Persian where platform requires; normalize for match/uniqueness.
- Pattern reference: `/access` RSC + `assertPageAccess` + client panel.
- Copy for blocked policy ops must be explicit Persian — not English stack traces.

### Library / stack

| Package | Pin / note |
| --- | --- |
| Prisma | **7.8.x** (`packages/db`) — projections only |
| PostgreSQL | 17.x assumption — partial unique index OK |
| Next.js / tRPC | Existing app patterns (`governedProcedure`) |
| UUID | Architecture: server-generated UUID; Prisma 7 supports `uuid()` / prefer time-ordered UUID v7 if available without new deps — avoid random v4 page-split concerns on hot tables if choosing explicitly |

### File structure (expected touch set)

| Path | Action |
| --- | --- |
| `packages/db/prisma/schema.prisma` | UPDATE — add `Person` |
| `packages/db/prisma/migrations/*` | NEW — Person migration |
| `packages/modules/person-employment/src/*` | UPDATE/NEW — domain APIs, errors, selfcheck |
| `packages/modules/person-employment/package.json` | UPDATE scripts if selfcheck added |
| `packages/kernel/audit-envelope/src/categories.ts` | UPDATE only if registering `identity.person` ordinary category |
| `packages/modules/identity-access/src/seed.ts` (or policy fixtures) | UPDATE — person.read/write PermissionSet bindings |
| `apps/web/src/server/person*.ts` + `root.ts` | NEW/UPDATE — governed router |
| `apps/web/app/(app)/personnel/page.tsx` | UPDATE — RSC + assertPageAccess |
| `apps/web/components/personnel/*` | NEW — create/list panel |
| `apps/web/lib/operational-copy.ts` | UPDATE — blocked/duplicate copy |
| `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE |
| `package.json` (root) | UPDATE — `selfcheck:person-identity` optional |

### UPDATE file — current state (must preserve)

**`apps/web/app/(app)/personnel/page.tsx` (today):** `"use client"` demo for Jalali pickers + stale/gold CTA + break-glass admin link. **Change:** RSC gate + Person create/list primary; **preserve** demo utilities in a secondary region or relocate without deleting Epic 1.6–1.7 smoke value unless explicitly replaced with equivalent elsewhere.

**`packages/modules/person-employment/src/index.ts` (today):** `export {}` stub. **Change:** real exports; keep package name/boundaries.

**`HumanIdentity` in Prisma:** leave as login projection; do not repurpose.

### Testing requirements

| Case | Expect |
| --- | --- |
| Create Person with unique code + names | UUID PK; code stored; retrievable by id and code |
| Duplicate Personnel Code | Rejected (domain + unique constraint) |
| Second Person with same national ID (non-null) | Rejected when value present |
| Optional empty / `"N/A"` / `"0"` | Normalized to null or rejected — never stored as sentinel |
| correct/merge/split/return-match | Fail closed + Persian explanation |
| Employment-end continuity | No API deletes Person when employment ends; documented invariant |
| `assertPageAccess` on `/personnel` | Unpermitted coarse role denied before data |
| Coarse `hr_admin` without `person.write` policy | Envelope deny |
| National ID category disabled | Write/read of national ID fail closed (unless DEV_DEMO enable in selfcheck) |
| Layout ≠ RSC | No client-only bypass of page assert |
| Prior selfchecks | audit-envelope / inference-bulk / access-admin still green |

### Previous story intelligence (2.7 / Epic 2)

- Control planes before domain wiring worked — keep consuming PopulationPort/InferenceBulkPort; replace fixtures later, do not parallelize.
- Evidence failure → compensate + fail closed.
- Break-glass must still compose with population/inference if privileged Person reads are added — do not bypass ports.
- Thin selfchecks + root scripts are the established proof pattern until Vitest/CI lands.
- Review patches often caught: missing access events, empty-vs-suppress confusion, expiry checks — for Person, watch unique races and category gate order.

### Git intelligence

Recent commits: `319be13` epic 2 retro → `0979b61` story 2.7 → `eab2442` 2.6. Pattern: module port + web governedProcedure + selfcheck script + deferred-work update. Follow the same delivery shape for Person.

### Project context reference

No `project-context.md` present in repo. Rely on Architecture Spine, epics sequencing rule, Epic 2 retro, and prior story files.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3 sequencing; Story 3.1]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-5]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2..AD-6, IDs]
- [Source: `_bmad-output/implementation-artifacts/epic-2-retro-2026-07-17.md`]
- [Source: `_bmad-output/specs/spec-divan/data-element-dispositions.md`]
- [Source: `_bmad-output/specs/spec-divan/glossary.md` — Person / Personnel Code]
- [Source: `docs/pre-prd.md` §9.2, §10.2]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — پرسنل]
- [Source: Stories 2.1–2.7 implementation artifacts]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Prisma `migrate dev --create-only` failed on shadow DB (`kernel_events` missing); wrote migration SQL manually and applied via `prisma migrate deploy`.
- `nationalId String? @unique` — PostgreSQL UNIQUE already allows multiple NULLs (partial uniqueness when present); no raw partial index required.

### Implementation Plan

- Person projection with UUID v7 PK + Latin-canonical Personnel Code; domain APIs in `@divan/person-employment`.
- Governed tRPC `person` router with PermissionSet binding gate + `identity.person` / disabled `identity.national_id`.
- `/personnel` RSC + thin create/list panel; Jalali demos preserved secondary.
- PopulationPort cutover named; selfcheck + seed fixtures.

### Completion Notes List

- Person create/update/read with uniqueness, empty→null, sentinel reject, blocked identity ops fail-closed.
- Seed binds `person.read`/`person.write` to hr.admin + hr.operator; demo Person `10001`.
- Selfcheck `pnpm selfcheck:person-identity` green; typecheck person-employment/db/web/audit-envelope/identity-access; web lint; prior audit-envelope + inference-bulk selfchecks green.
- Status set to **review** (done sync with sprint-status deferred to post code-review per Task 6 reminder).

### File List

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260717033000_person_master_data/migration.sql`
- `packages/modules/person-employment/package.json`
- `packages/modules/person-employment/README.md`
- `packages/modules/person-employment/src/index.ts`
- `packages/modules/person-employment/src/db.ts`
- `packages/modules/person-employment/src/digits.ts`
- `packages/modules/person-employment/src/errors.ts`
- `packages/modules/person-employment/src/normalize.ts`
- `packages/modules/person-employment/src/person.ts`
- `packages/modules/person-employment/src/permissions.ts`
- `packages/modules/person-employment/src/seed.ts`
- `packages/modules/person-employment/src/population-cutover.ts`
- `packages/modules/person-employment/src/person-identity.selfcheck.ts`
- `packages/modules/identity-access/package.json`
- `packages/modules/identity-access/src/seed.ts`
- `packages/modules/identity-access/src/population-authz.ts`
- `packages/kernel/audit-envelope/src/categories.ts`
- `packages/kernel/audit-envelope/src/index.ts`
- `apps/web/package.json`
- `apps/web/src/server/person.ts`
- `apps/web/src/server/root.ts`
- `apps/web/app/(app)/personnel/page.tsx`
- `apps/web/components/personnel/personnel-panel.tsx`
- `apps/web/components/personnel/personnel-demo-section.tsx`
- `apps/web/lib/operational-copy.ts`
- `package.json`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-1-stable-person-identity.md`

### Review Findings

- [x] [Review][Defer] Person PermissionSet checks ignore entitlement grant lifecycle — PermissionSet-only is enough for 3.1 demo/selfcheck; wire grant as-of / expiry / break-glass composition when Person joins the full Epic 2 authz path (deferred: PermissionSet-only OK for 3.1)
- [x] [Review][Patch] Separator-only `nationalId` normalizes to empty string and can be persisted (unique on `""`) [`packages/modules/person-employment/src/person.ts:156-162`]
- [x] [Review][Patch] Invalid calendar `birthDate` (e.g. `2024-02-30`) passes regex and is coerced by `Date` [`packages/modules/person-employment/src/person.ts:105-124`]
- [x] [Review][Patch] Persian/Arabic digit zero (`۰`/`٠`) bypasses sentinel `"0"` check [`packages/modules/person-employment/src/normalize.ts:28-39`]
- [x] [Review][Patch] `setNationalId` returns `includeNationalId: true` without a national-id *read* category grant [`apps/web/src/server/person.ts:250-273`]
- [x] [Review][Patch] Domain `createPerson` accepts `nationalId` with no category gate (only tRPC create omits the field) [`packages/modules/person-employment/src/person.ts:168-241`]
- [x] [Review][Patch] UI duplicate field mapping matches Persian message substrings instead of stable error codes [`apps/web/components/personnel/personnel-panel.tsx:68-72`]
- [x] [Review][Patch] `updatePersonIdentity` with no fields silently bumps `updatedAt` [`packages/modules/person-employment/src/person.ts:246-326`]
- [x] [Review][Patch] Identity string fields lack max-length bounds in Zod/domain [`apps/web/src/server/person.ts:137-145`]
- [x] [Review][Defer] Envelope records allow before PermissionSet deny on Person procedures [`apps/web/src/server/person.ts`] — deferred, pre-existing governedProcedure layering
- [x] [Review][Defer] `identity-access` depends on `person-employment` for seed fixtures [`packages/modules/identity-access/package.json`] — deferred, pre-existing
- [x] [Review][Defer] No optimistic concurrency / `updatedAt` precondition on identity update [`packages/modules/person-employment/src/person.ts:315`] — deferred, pre-existing
- [x] [Review][Defer] `mobilePhone` stored raw without digit/format normalization [`packages/modules/person-employment/src/person.ts:179-182`] — deferred, pre-existing
- [x] [Review][Defer] Blocked deep-link ops still pass envelope allow then domain FORBIDDEN [`apps/web/src/server/person.ts:275-360`] — deferred, pre-existing
- [x] [Review][Defer] Domain `PersonRecord` always loads `nationalId`; omission only in `toPublicPerson` [`packages/modules/person-employment/src/person.ts:73-103`] — deferred, pre-existing

### Change Log

- 2026-07-17: Story 3.1 implemented — Person master-data, governed APIs, `/personnel` UI, seed/selfcheck; status → review.
- 2026-07-17: Code review findings recorded (1 decision, 8 patch, 6 defer).
- 2026-07-17: Review patches applied; grant-lifecycle deferred; status → done.

---

**Ultimate context engine analysis completed — comprehensive developer guide created.**
)
