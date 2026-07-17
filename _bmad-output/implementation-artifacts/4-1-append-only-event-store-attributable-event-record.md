---
baseline_commit: 3c17d56
---

# Story 4.1: Append-Only Event Store & Attributable Event Record

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Operator,
I want every Personnel Event to carry a complete attributable record in an append-only store,
so that history cannot be silently rewritten (FR14, AD-2).

## Gate (read first)

**Epic 4 begins here. This story unlocks authoritative workforce mutations — it does not ship product Start/Transfer/Terminate flows or Draft UI.**

| Allowed in 4.1 | Forbidden in 4.1 |
| --- | --- |
| Expand `kernel_events` via **new** `packages/db/sql/003_*.sql` (idempotent ALTER) for FR-14 business fields | Prisma model / migration for the event log; dual “audit” tables |
| Real `appendBusinessEvent` + typed envelope in `@divan/event-store` | UPDATE/DELETE helpers; silent rewrite of existing rows |
| Selfcheck proving attributable columns + Effective Date ≠ registration/finalization timestamps | Draft/finalize UI, فرم رویداد, conflict classification (→ 4.2) |
| Append-only enforcement at **API** (mandatory) + optional DB trigger / REVOKE hardening | Claiming Cancel/Reverse/Correction product semantics done (→ 4.3) |
| Document Transfer coverage order + AR-TEMPORAL apply disposition for **4.5–4.8** handoff | Implementing Start/Return/Terminate/Transfer/job/comp flows |
| PopulationPort **cutover criteria** written (fixture → projection-backed) | Claiming PopulationPort default registry cutover complete |
| Keep access-event path green (`appendAccessEvent`, envelope atomicity) | Feeding projections from `event_class=access`; treating Employment/Primary Prisma rows as SoT |

- **AD-2:** Authoritative workforce mutations = typed append-only **business** events. Projections (Employment, Primary/Secondary, compensation `sourceEventId`, …) are **never** source of truth.
- **AD-3:** Kernel owns the log — `packages/kernel/event-store`. Domain modules MUST NOT own a parallel event table. Person-employment may **consume** the published API later (4.2+); not required to own the schema in 4.1.
- **AD-5:** One store, `event_class ∈ {business, access}`. Access never mutates derived state. Business append must not break access CHECK (`result` required only for access).
- **AD-6:** Prisma = projections only. Event store = raw SQL + `withTransaction`. Critical projection refresh in same txn lands with finalize flows (4.2 / 4.5+) — **schema/API readiness only in 4.1**.
- **Epic 3↔4 sequencing:** No temporary product CRUD for Employment / Primary / Secondary / compensation **state**. Epic 3 projection writers (`apply*Projection`) remain internal seed/Epic-4-ready helpers until event finalization calls them. Do **not** add Operator-facing bypass APIs in 4.1.
- **AR numbers fail-closed:** Do not invent AR-TEMPORAL ordering/calendar matrices, AR-ACCESS finalize tiers, AR-AUDIT hash-chain, or AR-IDENTITY Person↔Account FK. Encode dispositions as fail-closed stubs / Dev Notes for later stories.
- **actor_account_id is TEXT** (cuid InternalAccount ids) — see `002_actor_account_id_text.sql`. Do not re-UUID the column.

[Source: `epics.md` Story 4.1 + Epic 3↔4 sequencing; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6 + Consistency Conventions; `prd.md` FR-14; `addendum.md` §3.5; `epic-3-retro-2026-07-18.md`; Stories 2.1 / 3.1–3.9]

## Acceptance Criteria

1. **Given** kernel event-store (raw SQL / `withTransaction`)  
   **When** a Personnel Event is persisted via `appendBusinessEvent`  
   **Then** the row has unique id, type, Person, applicable Employment (nullable only when not yet assigned — document when), Effective Date, registration actor/time, status, reason/reference, provenance, and authorized before/after evidence fields

2. **And** Effective Date is stored as a **date-only business field** visibly distinct from registration and finalization **timestamptz** columns (selfcheck asserts inequality of column roles; UI distinction is Epic 4.2 / 5.3)

3. **And** events are append-only `event_class=business`; projections are never treated as source of truth; no application UPDATE/DELETE API exists for `kernel_events`

4. **And** sensitive values are not unnecessarily duplicated into evidence (`before_evidence` / `after_evidence` / payload hold refs, codes, non-sensitive structural facts — never compensation amounts, national ID, or other AR-DATA-sensitive field values)

5. **And** PascalCase past-tense type names are validated/enforced per Architecture conventions (e.g. `TransferRecorded` taxonomy style); reject clearly invalid type strings

6. **And** existing `appendAccessEvent` + audit-envelope atomic path remain green; business columns are NULL/ignored for `event_class=access` rows; access CHECK (`result` required) unchanged

7. **And** this story does **not** deliver Draft UI, finalization product flow, Cancel/Reverse/Correction writers, temporal ordering engine, Start/Return/Terminate/Transfer/job-change Operators flows, projection rebuild, or headcount lifecycle

## Tasks / Subtasks

- [x] Task 1: SQL migration — attributable business columns (AC: #1–#3, #6)
  - [x] Add `packages/db/sql/003_business_event_attributable_fields.sql` (next lexical number after `002_`; do **not** edit applied history of `001`/`002` except comments if needed)
  - [x] Columns (names may match closely; keep idempotent `ADD COLUMN IF NOT EXISTS`):
    - `event_type TEXT` — Personnel Event type (PascalCase past-tense)
    - `person_id UUID` — target Person
    - `employment_id UUID` — applicable Employment (nullable when Draft/Start has not bound Employment yet; document)
    - `effective_date DATE` — business Effective Date (AR-TEMPORAL date-only)
    - `registered_at TIMESTAMPTZ` — registration time (system)
    - `registered_by TEXT` — registration actor account id (align with `actor_account_id` TEXT)
    - `finalized_at TIMESTAMPTZ` — nullable until 4.2 finalization
    - `finalized_by TEXT` — nullable until 4.2
    - `status TEXT` — lifecycle token storage (`Draft` | `Scheduled` | `Effective` | `Cancelled` | `Reversed` provisional set; 4.2/4.3 own transitions)
    - `reference_code TEXT` — optional external/reference id (reason column already exists)
    - `provenance JSONB NOT NULL DEFAULT '{}'` — source/import metadata (no sensitive payloads)
    - `before_evidence JSONB` / `after_evidence JSONB` — authorized reconstruction refs only
    - Chain foreshadow (nullable UUIDs for 4.3; no product writers yet): `corrects_event_id`, `cancels_event_id`, `reverses_event_id`, `supersedes_event_id` as needed — prefer minimal set documented in Dev Notes
  - [x] CHECK constraints:
    - `event_class = 'business'` ⇒ `event_type`, `person_id`, `effective_date`, `status`, `registered_at`, `registered_by` NOT NULL
    - `event_class = 'access'` ⇒ business-required columns remain NULL (or unconstrained); `result` still required
    - `event_class = 'business'` ⇒ `result IS NULL` (access-only field)
  - [x] Indexes: `(event_class, effective_date)`, `(person_id, effective_date)`, `(employment_id)` where useful — keep MVP-light
  - [x] Optional harden: `BEFORE UPDATE OR DELETE` trigger raising exception on `kernel_events` (recommended; works even for superuser labs). Keep `REVOKE` commented if role model unclear — document in deferred-work
  - [x] Update `packages/db/sql/README.md` conventions: business vs access column rules

- [x] Task 2: Implement `appendBusinessEvent` + types (AC: #1–#5)
  - [x] Replace stub in `packages/kernel/event-store/src/index.ts` (or split `business-event.ts` + re-export — prefer clear types without reinventing access path)
  - [x] Input shape (illustrative — align names to SQL):
    - `correlationId`, `eventType`, `personId`, `employmentId?`, `effectiveDate` (YYYY-MM-DD validated via existing `@divan/temporal-engine` `parseDateOnly` if dependency allowed; else local date-only guard — **do not** pull Prisma)
    - `registeredBy`, `registeredAt?` (default now), `status` (default `Draft` for scaffolding inserts)
    - `reason?`, `referenceCode?`, `provenance?`, `beforeEvidence?`, `afterEvidence?`
    - `finalizedBy?` / `finalizedAt?` (allowed for selfcheck of column distinctness; product finalize = 4.2)
    - Optional chain ids as nullable foreshadow
  - [x] Map: `event_class='business'`; set `actor_account_id` = `registeredBy` (or document dual-write); `operation` = `eventType` or stable `personnel_event.append` + type in column — **prefer dedicated `event_type` column as SoT for type**; keep `operation` non-empty for table NOT NULL (mirror type or fixed verb)
  - [x] `occurred_at`: use `registeredAt` for business registration clock (do not overload as Effective Date)
  - [x] Validate `eventType` with PascalCase pattern; document past-tense convention; reject empty / snake_case / lowercase
  - [x] Evidence sanitizer helper: reject or strip known sensitive keys if present in evidence/provenance (fail closed on obvious secrets — better throw than store)
  - [x] Return `{ id }` like access append
  - [x] **No** updateBusinessEvent / deleteBusinessEvent

- [x] Task 3: Selfcheck + package scripts (AC: #1–#7)
  - [x] Rewrite `event-store.selfcheck.ts`:
    - Access path still works (append + SELECT)
    - Business append succeeds with full attributable fields
    - Assert `effective_date` column ≠ `registered_at`/`finalized_at` roles (date vs timestamptz; values can differ)
    - Assert `event_class=business`, PascalCase type, person_id set, status set
    - Assert reject invalid event type
    - Assert no UPDATE path from API (optional: raw SQL UPDATE should fail if trigger added)
    - Evidence without sensitive duplication (store structural refs only)
  - [x] Keep `pnpm --filter @divan/event-store selfcheck`; ensure root wiring if present
  - [x] `pnpm --filter @divan/event-store typecheck`
  - [x] Preserve prior selfchecks green: audit-envelope, governed web, person-employment suite as applicable (no need to run full monorepo unless touched)

- [x] Task 4: Docs / deferred-work / cutover criteria / Epic 3 retro prep (AC: #7)
  - [x] Update `deferred-work.md`: business attributable record landed; Draft/finalize/Cancel/Reverse/Correction/product events remain 4.2+; hash-chain still deferred; AuthAttempt migration unchanged
  - [x] Encode **PopulationPort cutover criteria** (early 4.x) in Dev Notes section below + `population-cutover.ts` comment bump — criteria only, no silent full cutover
  - [x] Encode **Transfer coverage-after-atomic-close+open** + **AR-TEMPORAL apply active-as-of** fail-closed disposition in Dev Notes (for 4.5–4.8) — do not implement Transfer here
  - [x] README note under event-store or db/sql: how to apply `003_*.sql` via `sql/apply.mjs`
  - [x] When marking done: sync story `Status: done` ↔ `sprint-status.yaml` key `4-1-append-only-event-store-attributable-event-record`; **no UTF-8 BOM** on sprint-status

### Review Findings

- [x] [Review][Patch] Sanitize `scope` like evidence/payload — decided: run `assertNoSensitiveEvidence("scope", scope)` before insert [`packages/kernel/event-store/src/business-event.ts`:194]
- [x] [Review][Patch] Case-normalize sensitive-key denylist match [`packages/kernel/event-store/src/business-event.ts`:137]
- [x] [Review][Patch] Guard `walkRejectSensitive` against cyclic / deep object graphs [`packages/kernel/event-store/src/business-event.ts`:123]
- [x] [Review][Patch] Require `finalizedAt` and `finalizedBy` together or neither [`packages/kernel/event-store/src/business-event.ts`:232]
- [x] [Review][Patch] Trim `personId` / `correlationId` before UUID bind (emptiness check uses trim; SQL still gets raw) [`packages/kernel/event-store/src/business-event.ts`:166]
- [x] [Review][Patch] Coerce empty-string optional UUIDs (`employmentId`, chain ids) to null [`packages/kernel/event-store/src/business-event.ts`:228]
- [x] [Review][Patch] Reject Invalid `Date` for `registeredAt` / `finalizedAt` with `BusinessEventValidationError` [`packages/kernel/event-store/src/business-event.ts`:219]
- [x] [Review][Patch] Validate UUID format for `personId`, `correlationId`, `employmentId`, chain ids before insert [`packages/kernel/event-store/src/business-event.ts`:166]
- [x] [Review][Defer] Selfcheck permanently inserts fixture rows into `kernel_events` with no cleanup [`packages/kernel/event-store/src/event-store.selfcheck.ts`:49] — deferred, pre-existing

### Seed / DoD snippet (Epic 3 retro #5)

If any seed/fixture touches business events in this story (optional — selfcheck insert is enough):
- Prefer `$transaction` / `withTransaction` for multi-row setup
- Exact cardinality asserts (not “at least one”)
- FK-shaped ids: Person UUID must exist only if selfcheck creates/uses a real Person — otherwise use random UUIDs **without** FK (kernel_events should **not** FK to Prisma Person in 4.1 — avoid write coupling; referential integrity is application-level until AR says otherwise)

## Dev Notes

### Current state (UPDATE files — read before coding)

| File | Today | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/kernel/event-store/src/index.ts` | Real `appendAccessEvent` + `withTransaction`; **stub** `appendBusinessEvent` throws | Real business append + types | Access API signature & semantics |
| `packages/kernel/event-store/src/event-store.selfcheck.ts` | Asserts stub + access append | Business oracle + keep access | DATABASE_URL + dotenv root `.env` pattern |
| `packages/db/sql/001_kernel_events.sql` | Base table; REVOKE commented | Leave applied; extend via **003** | Access indexes/CHECKs |
| `packages/db/sql/002_actor_account_id_text.sql` | actor TEXT | Do not revert to UUID | cuid actor ids |
| `packages/kernel/audit-envelope/src/index.ts` | Atomic access append | Untouched unless import breakage | Default-deny + access evidence |
| `packages/kernel/temporal-engine` | Date-only helpers only | Optional reuse for `effectiveDate` parse | No projection rebuild invent |
| `person-employment` `apply*Projection` | Seed/Epic-4-ready writers | **Do not** wire product mutation through them yet | EXCLUDE / coverage invariants |

### Epic context

- **Epic 4:** Personnel Events, Temporal State & Headcount (FR14–FR32).
- **This story:** FR-14 attributable record + AD-2 store reality for `event_class=business`.
- **Upstream (done):** Epic 1–3; access event-store (2.1); Employment/Primary/Secondary projections + management derive (3.2–3.9).
- **Downstream:** 4.2 Draft/finalize; 4.3 Scheduled/Cancel/Reverse/Correction; 4.4 ordering/recalc; 4.5–4.8 event flows; 4.9–4.11 projections/reconstruction; 4.12–4.14 headcount.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Draft edit/delete UI + conflict classification | 4.2 |
| Scheduled vs Effective UI badges / Cancel / Reverse / Correction writers | 4.3 (UX-DR10) |
| Deterministic same-day ordering + pg-boss recalc | 4.4 |
| Start / Return / Terminate / Transfer / job-comp Operators flows | 4.5–4.8 |
| Current/historical person & org projection rebuild products | 4.9–4.11 |
| Headcount approval / reservation / Override | 4.12–4.14 |
| Hash-chain tamper evidence (NFR-10) | Deferred until AR-AUDIT |
| Prisma KernelEvent model | Never (AD-6) |
| PopulationPort default registry full cutover | Criteria in 4.1; execution when AR-IDENTITY + event-backed population ready |

### Architecture compliance

- **Naming:** PascalCase past-tense event types (`TransferRecorded`, …). Modules kebab-case. Server-generated UUIDs for event ids (`randomUUID`).
- **Dates:** Effective Date = business DATE; registration/finalization = timestamptz. Jalali is UX-only later — store Gregorian date-only consistently with temporal-engine.
- **Envelope:** All events: `event_class`, actor, timestamp, correlation id. Business adds effective-date + aggregate refs (Person/Employment).
- **Errors:** Typed errors; Persian `messageFa` at API boundary when web-facing — kernel may throw English/typed codes; map at tRPC later (4.2).
- **Sensitive data:** Evidence minimization (FR-14 consequence + FR-45 redaction spirit). Compensation stays in compensation-facts schema — never copy amounts into event evidence.

### Library / framework requirements

| Tech | Version / note |
| --- | --- |
| PostgreSQL | 17.10+ (project assumption) |
| `pg` | Already `@divan/event-store` dependency (`^8.16.3`) |
| Node | 22.x LTS |
| TypeScript | 5.x |
| Prisma | **Not** for event log |
| Vitest | Still deferred (Epic 3 retro #7) — continue `tsx` selfcheck unless you deliberately introduce Vitest with ephemeral DB |

### File structure requirements

```text
packages/db/sql/003_business_event_attributable_fields.sql   # NEW
packages/db/sql/README.md                                    # UPDATE
packages/kernel/event-store/src/index.ts                     # UPDATE (or + business-event.ts)
packages/kernel/event-store/src/event-store.selfcheck.ts     # UPDATE
packages/kernel/event-store/package.json                     # only if new scripts/deps
_bmad-output/implementation-artifacts/deferred-work.md       # UPDATE
packages/modules/person-employment/src/population-cutover.ts # comment criteria bump
```

Do **not** create `packages/modules/*/event-log` tables.

### Testing requirements

| Case | Expect |
| --- | --- |
| Access append still works | `event_class=access`, `result` set |
| Business append minimal Draft | All required FR-14 fields present; `result` NULL |
| Effective Date vs timestamps | `effective_date` is DATE; `registered_at`/`finalized_at` timestamptz; selfcheck documents distinct roles |
| Invalid type `transfer_recorded` / `foo` | Reject |
| Sensitive key in evidence | Reject or strip with fail-closed policy (prefer reject) |
| Stub removal | `appendBusinessEvent` no longer matches `/not implemented/` |
| Optional trigger | Raw `UPDATE kernel_events` fails |

### Previous story intelligence (Epic 3 → 4)

From Stories 3.1–3.9 + `epic-3-retro-2026-07-18.md`:

- Gate-first stories prevented temporary CRUD — **keep that discipline**; 4.1 is store substrate, not a mutation UI.
- Selfcheck + seed cardinality + no BOM on `sprint-status.yaml` are recurring review failures — follow Seed/DoD snippet.
- `sourceEventId` already exists on Assignment/org/job/compensation projections — **do not populate from 4.1 scaffolding** except optional selfcheck isolation; product fill = finalize/projector stories.
- PopulationPort: derivation + adapter live; **default registry still fixture** — honesty required.
- Transfer: Primary coverage assert-only today; **Epic 4.7 must assert coverage after atomic close+open**, not on mid-Transfer close alone.
- AR-TEMPORAL: `assertRefsExist` active-as-of deferred on Primary/Secondary apply — **4.5–4.8 must fail closed** until AR freezes (no silent inactive Team/Job attach).

### Epic 3 retro carry-in (must appear in Dev Notes)

| Item | How 4.1 absorbs it |
| --- | --- |
| Transfer coverage-after-atomic-close+open | Documented below for 4.5–4.8; not implemented in 4.1 |
| AR-TEMPORAL apply active-as-of | Fail-closed disposition documented below |
| PopulationPort cutover criteria | Written criteria below + `population-cutover.ts` comment |
| Seed DoD + BOM-safe sprint-status | Task 4 + Seed snippet |
| AR fail-closed | Gate |
| Vitest/ephemeral DB | Prefer existing selfcheck; optional improvement only |
| Epic 2 open: InferenceBulkPort ops doc; sticky break-glass; artifact reauth | Unchanged; not 4.1 scope |

#### Transfer coverage sequencing (handoff → 4.7 / 4.5–4.8)

When Transfer finalization lands:

1. Append business event(s) + projection updates in **one** DB transaction (AD-6).
2. Close source Primary and open destination Primary **atomically**.
3. Run Employment/Primary **coverage** asserts on the **post**-close+open shape — not on the intermediate “closed without open” moment (that would false-fail Transfer).
4. Headcount movement stays one deterministic business operation with the same txn (FR-31 foreshadow).

#### AR-TEMPORAL apply active-as-of disposition (handoff → 4.5–4.8)

Until AR-TEMPORAL freezes:

- Projectors/validators that attach Team / Job Title / Ladder / Grade / Seniority / Role refs MUST treat “ref inactive as-of Effective Date” as **blocking** (typed error) — never silent attach.
- Deactivate-with-deps for org/job refs with active or Scheduled dependencies remains blocked pending AR disposition (FR-10 consequence).
- Do not invent calendar exception matrices in code comments as if approved.

#### PopulationPort default-registry cutover criteria (early 4.x)

Cutover from fixture registry → projection-backed default is **allowed** only when all are true:

1. Subject ids are Person UUIDs (`Person.id`) end-to-end for the populations being authorized.
2. Team membership edges come from Primary Assignment as-of helpers (3.7+), not `person:a1` fixtures.
3. Management edges (if used) come from 3.9 derive/adapter with explicit Person→Account resolver — not invented Account FK.
4. Account↔Person linking policy is either AR-IDENTITY-approved **or** an explicitly documented provisional seed map scoped to demo — not a silent production FK.
5. `population-cutover.ts` + `deferred-work.md` updated in the same change; selfcheck proves at least one non-fixture population path.
6. Until then: keep fixtures; **do not** claim authz population is “real workforce.”

### Git intelligence summary

Recent commits: Epic 3 close-out (`3c17d56` retro; `5cb0107` 3.9 management derive; `abb8f16` 3.8 Secondary). Patterns to reuse:

- Module selfcheck via `tsx` + `node:assert` + real `DATABASE_URL`
- Gate + absolute non-goals tables in story files
- Raw SQL for kernel; Prisma only for projections
- Honest deferred-work updates

### Latest technical information

PostgreSQL append-only practice (2025–2026): enforce immutability with **application INSERT-only APIs** plus **DB triggers** blocking UPDATE/DELETE (and optional `REVOKE`). Corrections = new compensating rows, never in-place edits. Prefer CHECK constraints on class-specific required columns. Avoid hard FKs from the event stream to mutable aggregates if that couples writes — application-level refs are acceptable for MVP kernel_events (aligns with not FK-ing Person from events in 4.1). Hash-chain remains out of scope until AR-AUDIT (spine Deferred).

### Project context reference

No `project-context.md` found in repo at story creation. Follow Architecture Spine + this story Gate. Communication with user: Persian; code/docs in this file: English.

### UX notes (minimal)

4.1 is infrastructure. When UI appears (4.2 / timeline 5.3): Effective Date must remain visually distinct from registration/finalization (FR-14 / FR-44). Status tokens Scheduled/Effective/Cancelled/Reversed/Draft = UX-DR10 in 4.3 — store-compatible string tokens now.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- DATE column TZ shift in selfcheck: prefer `effective_date::text` (+ local Y-M-D fallback) instead of `toISOString().slice(0,10)`

### Implementation Plan

- Extend `kernel_events` via idempotent `003_*.sql` (FR-14 columns, class CHECKs, indexes, append-only trigger)
- Split `appendBusinessEvent` into `business-event.ts` with PascalCase + sensitive-key fail-closed + `parseDateOnly`
- Keep access path untouched; re-export business API from `index.ts`
- Selfcheck covers access green, business attributable insert, type/evidence rejects, trigger UPDATE block

### Completion Notes List

- Real `appendBusinessEvent` replaces Story 2.1 stub; no update/delete helpers
- `event_type` is SoT for Personnel Event type; `operation` mirrors type for NOT NULL
- `actor_account_id` dual-written from `registeredBy` (TEXT cuid)
- `employment_id` nullable until Employment bound (Draft/Start)
- Append-only DB trigger ships; `REVOKE` remains commented (deferred-work)
- PopulationPort cutover criteria documented only — fixtures unchanged
- Selfchecks green: `@divan/event-store`, `@divan/audit-envelope`, `@divan/web` governed

### File List

- packages/db/sql/003_business_event_attributable_fields.sql
- packages/db/sql/README.md
- packages/kernel/event-store/src/business-event.ts
- packages/kernel/event-store/src/index.ts
- packages/kernel/event-store/src/event-store.selfcheck.ts
- packages/kernel/event-store/package.json
- packages/modules/person-employment/src/population-cutover.ts
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-1-append-only-event-store-attributable-event-record.md
- pnpm-lock.yaml

## Change Log

- 2026-07-18: Story 4.1 — attributable business event columns + `appendBusinessEvent` + selfcheck; status → review
- 2026-07-18: Code review patches applied (scope/evidence sanitizer hardening, UUID/date input guards); status → done

## Story completion status

- Status: **done**
- Completion note: All tasks/ACs + review patches complete; deferred selfcheck fixture cleanup only
