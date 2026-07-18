---
baseline_commit: 15d1bb97bf3ca4d368d9e8a3b8bf705b459031a0
---

# Story 4.3: Scheduled State, Cancel, Reverse & Correction

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want future Finalized events to stay Scheduled until Effective, and to Cancel/Reverse/Correct without destroying originals,
so that today's state stays clean while history remains attributable (FR16, FR17).

## Gate (read first)

**This story ships Scheduled semantics (FR-16), Cancel / Reverse / Correction append-only chains (FR-17), atomic Cancel↔effect race, chain integrity (no self-ref/cycle), and UX-DR10 status badges. It does not ship ordering/recalc, domain Start–Transfer flows, or Reservation release product.**

| Allowed in 4.3 | Forbidden in 4.3 |
| --- | --- |
| Prove future Finalized events are **Scheduled** and do **not** alter **current** projections before Effective Date | Claiming full current/as-of Person reconstruction products done (→ 4.9–4.11) |
| Cancel / Reverse / Correction as **new** `appendBusinessEvent` rows with `cancels_event_id` / `reverses_event_id` / `corrects_event_id` (+ optional `supersedes_event_id`) | `UPDATE` / `DELETE` on `kernel_events` (trigger + API forbid it; AD-2) — never rewrite original `status` in place |
| Derived **resolved lifecycle** for readers/timeline: original row stays attributable; display status from chain resolution | Inventing a second event log / Prisma `KernelEvent` / weakening `kernel_events_append_only_trg` |
| Atomic Cancel↔effective-transition race: **one** outcome (Cancel wins with no effect, **or** effect wins and Reverse/Correction rules apply — **never both**) | Soft-hiding Cancel after effect applied, or applying both Cancel and effect |
| Correction acyclic graph: block self-reference and cycles; broken/missing target refs block | Inventing full AR-TEMPORAL “may a Correction itself be Corrected/Reversed” oracle matrix — fail-closed stubs + Dev Notes only |
| UX-DR10 `status-badge-*` for Scheduled / Effective / Cancelled / Reversed / Draft (+ Override token if cheap) with light+dark pairs and Persian labels | Full `personnel-event-timeline` product (UX-DR9 / Epic 5.3) — foreshadow links on existing `/personnel` surface only |
| Permission + **mandatory reason** on Cancel/Reverse/Correction; `sensitive-confirmation-dialog` (UX-DR14) | Coarse JWT-only authz; English-only user errors; trusting client Override/role booleans |
| Governed tRPC mutations + PermissionSet seed; AD-6 projection hook in same txn as compensating append (scaffold no-op OK) | Silent PopulationPort cutover; hash-chain; headcount Reservation release product (→ 4.14); Start/Return/Terminate/Transfer domain projectors (→ 4.5–4.8) |
| Upgrade `BROKEN_CORRECTION_REF` from UUID-shape to existence + cycle checks | Deterministic same-day ordering engine + `recalculation_pending` / pg-boss (→ 4.4) |

### Mandated design — append-only neutralization (non-negotiable)

Because `kernel_events_append_only_trg` blocks UPDATE/DELETE:

```text
Cancel / Reverse / Correction = NEW business event rows
  + cancels_event_id | reverses_event_id | corrects_event_id | supersedes_event_id
  + mandatory reason + attributable actors/clocks
Original target row is NEVER mutated
Resolved display status = derive from chain (read helper), not in-place status rewrite
```

| Op | Target (resolved) | New row | Chain column |
| --- | --- | --- | --- |
| **Cancel** | Scheduled (and not already neutralized) | e.g. `EventCancelled` | `cancels_event_id` → target |
| **Reverse** | Effective (and not already neutralized) | e.g. `EventReversed` | `reverses_event_id` → target |
| **Correction** | Factual error on an authoritative event | e.g. `EventCorrected` (or domain type carrying correction payload) | `corrects_event_id` → target; optional `supersedes_event_id` |

- Storage tokens on **original** remain `Scheduled` | `Effective` (attributable history).
- Compensating / correction rows use appropriate status (`Cancelled` / `Reversed` on the neutralization row itself, or `Scheduled`/`Effective` on a Correction replacement — pick one consistent convention and document in Dev Notes; do not UPDATE the original).
- Timeline / UI shows original + link + **resolved** result (FR-17).

### Scheduled vs Effective (FR-16)

- **Already set at finalize (4.2):** `resolveAuthoritativeStatus` → `Scheduled` when `effective_date > asOf` (Asia/Tehran date-only), else `Effective`.
- **4.3 owns:** (1) UI distinction via UX-DR10 badges; (2) current projections must ignore Scheduled effects until Effective Date; (3) Cancel race against the moment an event would become effective.
- **Scheduled→Effective transition:** Prefer **evaluation-by-date** (read-time / as-of) until Story 4.4 recalc. Do **not** ship an UPDATE that flips original `status` to `Effective`. Optional read helper may label “would be Effective as of today” without mutating storage.

### Cancel ↔ effect race (FR-17)

Inside one `withTransaction`:

1. Lock target event decision (row `FOR UPDATE` on a durable lock key — prefer `SELECT … FROM kernel_events WHERE id = $1 FOR UPDATE`, or `pg_advisory_xact_lock` hashed from event id if raw SELECT is awkward).
2. Re-evaluate as-of (Tehran date-only): is target still pre-effect (Scheduled / not yet effective)?
3. **If still pre-effect:** append Cancel; mark resolved Cancelled; **no** current-projection side effect for that event.
4. **If effect already won:** reject Cancel with Persian `messageFa` directing actor to Reverse/Correction — do **not** append Cancel after effect.
5. Concurrent Cancel vs Cancel: idempotent or single winner; never two Cancels that double-apply side effects.

Use **transaction-scoped** advisory locks only (`pg_advisory_xact_lock`) — not session-level (PgBouncer-safe). Prefer waiting `FOR UPDATE` over `SKIP LOCKED` for this race (we need exclusive decision on **this** event, not queue claim).

### Architecture invariants (carry-forward)

- **AD-2 / AD-3:** Authoritative mutations = append-only business events in `@divan/event-store`. Domain `@divan/person-employment` orchestrates; does not own the log.
- **AD-6:** Critical compensating appends invoke projection refresh hook in the **same** DB txn. Scaffold/no-op OK when domain projectors still absent; seam must be selfcheck-proven.
- **Status vocabulary:** `Draft | Scheduled | Effective | Cancelled | Reversed` — do **not** add `Finalized` to CHECK. Product “Finalized” = authoritative Scheduled|Effective.
- **AR fail-closed:** Do not invent AR-TEMPORAL full correction matrices, AR-ACCESS review thresholds, AR-AUDIT hash-chain, AR-IDENTITY Person↔Account FK, or Reservation release arithmetic.
- **Epic 3↔4:** No Operator CRUD mutating Employment/Primary/Secondary/comp outside event→projection path.
- **Actors:** TEXT cuid InternalAccount ids — do not re-UUID.
- **Dates:** Asia/Tehran date-only Effective Date via `@divan/temporal-engine`; never `toISOString().slice(0,10)` for PG DATE asserts.

[Source: `epics.md` Story 4.3; `prd.md` FR-16, FR-17 + glossary; `addendum.md` Cancel race / Correction cycle tests; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6; Stories 4.1–4.2; UX `DESIGN.md` UX-DR10 / `EXPERIENCE.md` UX-DR14]

## Acceptance Criteria

1. **Given** a Finalized future Personnel Event  
   **When** current state is evaluated before Effective Date  
   **Then** the event is Scheduled/authoritative and does **not** alter current projections; UI distinguishes Scheduled from Effective

2. **When** Cancel is applied to a Scheduled event  
   **Then** permission and reason are required; Cancel racing effective transition has **one** atomic outcome (Cancel wins with no effect, or effect wins and Reverse/Correction rules apply — **never both**)

3. **When** Reverse is applied to an Effective event or Correction to a factual error  
   **Then** originals remain; Correction cannot self-reference or cycle; timeline/surface shows links and deterministic resolved result

4. **And** status badges use Scheduled / Effective / Cancelled / Reversed / Draft tokens (UX-DR10) with light+dark pairs and Persian labels

5. **And** Story 4.1–4.2 invariants remain green: append-only trigger, Draft→Finalize, conflict classifier, AD-6 finalize seam, access path; this story does **not** deliver ordering/recalc engine, Start/Transfer/Terminate domain flows, or headcount Reservation release product

## Tasks / Subtasks

- [x] Task 1: Read model + chain integrity (AC: #1, #3, #5)
  - [x] Add kernel or domain **read** helpers: load business event by id; list chain links for a person/event; `resolveLifecycleStatus(event)` → display `Scheduled | Effective | Cancelled | Reversed | Draft` derived from storage + neutralizing/correcting children
  - [x] Upgrade `personnel-event-conflicts.ts` `BROKEN_CORRECTION_REF`: existence of target id in `kernel_events`, correct event_class/business, and **cycle/self-ref** detection for Correction graphs (DFS/Union on `corrects_event_id` walk) — fail-closed blocking with Persian `messageFa`
  - [x] Wrong-state guards: Cancel only when resolved target is Scheduled (pre-effect); Reverse only when Effective (post-effect, not already neutralized); Correction target must be authoritative and not create cycles
  - [x] Optional `packages/db/sql/004_*.sql` indexes on chain columns if query plans need them — **do not** edit applied `003_*.sql` history; **do not** weaken append-only trigger

- [x] Task 2: Cancel / Reverse / Correction writers (AC: #2, #3, #5)
  - [x] Domain services (names flexible): `cancelPersonnelEvent`, `reversePersonnelEvent`, `correctPersonnelEvent` in `@divan/person-employment`
  - [x] Each: `withTransaction` → lock target → permission → mandatory non-empty reason → validate state/chain → `appendBusinessEvent` with chain FK + PascalCase type → AD-6 projection hook (same txn)
  - [x] Implement Cancel↔effect race per Gate (single atomic outcome)
  - [x] Idempotency: durable key or “already cancelled/reversed” returns stored neutralizing event id — exact cardinality 1
  - [x] Map `BusinessEventValidationError` → `PersonnelEventError` + `messageFa` at boundary
  - [x] Evidence: `assertNoSensitiveEvidence` on payload/provenance/evidence; reason stored in `reason` column (not sensitive blob)

- [x] Task 3: Permissions + governed tRPC (AC: #2–#5)
  - [x] Introduce PermissionSet keys e.g. `personnel_event.cancel` / `personnel_event.reverse` / `personnel_event.correct` (names flexible) — **seed into HR Admin** demo set via `seed.ts` (epic voice = HR Admin for lifecycle; do not silently grant Operator Reverse/Correction unless product copy requires — prefer Admin-only for Reverse/Correction; Cancel may share Admin)
  - [x] Extend `apps/web/src/server/personnel-event.ts`: `cancel` / `reverse` / `correct` (+ `get` / `resolve` / minimal list for badges) via `governedProcedure`
  - [x] Mid-session authz: block Cancel/Reverse/Correction when scope revoked (same spirit as finalize)
  - [x] Never trust client role/Override booleans — derive from session PermissionSet / coarseRole server-side only

- [x] Task 4: UX-DR10 badges + confirmation UI (AC: #1, #4) + a11y DoD
  - [x] Implement `status-badge` component + CSS variables from `DESIGN.md` (`status-badge-scheduled|effective|cancelled|reversed|draft` + dark pairs; Override optional)
  - [x] Persian labels; pill shape; badge **text** is sole status announcement (decorative dot `aria-hidden` if used)
  - [x] On `/personnel` (or adjacent): show authoritative events with badges distinguishing Scheduled vs Effective; actions Cancel / Reverse / Correct where permitted
  - [x] Wire `sensitive-confirmation-dialog`: consequence summary + required reason; blocked when validation fails; copy spirit: «این رویداد تاریخچه را پاک نمی‌کند؛ اصلاح مرتبط ثبت می‌شود.»
  - [x] Interactive a11y DoD: focus into dialog; Escape returns; keyboard CTAs; RTL Persian; contrast per brand tokens

- [x] Task 5: Scheduled ≠ current projection discipline (AC: #1, #5)
  - [x] Document + selfcheck: finalize future → `Scheduled`; current projection hook / current-state read does **not** apply Scheduled scaffold effects
  - [x] When projection hook is invoked for Cancel/Reverse/Correction: record invocation; domain side effects (Employment close, Reservation release) remain **stubs/fail-closed** until 4.5–4.8 / 4.14 — do not invent headcount math
  - [x] Leave clear Dev Notes / deferred-work for 4.4 recalc when past-dated Reverse/Correction requires historical rebuild

- [x] Task 6: Selfcheck + docs (AC: #1–#5)
  - [x] `personnel-event-lifecycle.selfcheck.ts` (or extend draft selfcheck): Scheduled finalize; Cancel Scheduled; Reverse Effective; Correction link; self-ref/cycle reject; Cancel↔effect exclusive outcome; originals unchanged (UPDATE on target still fails); badges/tokens renderable; AD-6 hook in txn; exact cardinality
  - [x] Keep `@divan/event-store` + `@divan/web` governed selfchecks green when touched
  - [x] Update `deferred-work.md`: Cancel/Reverse/Correction + UX-DR10 landed; ordering/recalc → 4.4; domain flows → 4.5–4.8; Reservation release on Cancel → 4.14; full timeline UX-DR9 → 5.3
  - [x] Sync story Status ↔ `sprint-status.yaml` key `4-3-scheduled-state-cancel-reverse-correction`; **no UTF-8 BOM**

### Review Findings

- [x] [Review][Patch] برچسب `Override` → «لغو محدودیت» (تصمیم review) [apps/web/components/personnel/status-badge.tsx:19]
- [x] [Review][Patch] Correction روی هدفِ قبلاً خنثی‌شده (Cancelled/Reversed via links) را رد کند [packages/modules/person-employment/src/personnel-event-lifecycle.ts:400]
- [x] [Review][Patch] Idempotency اصلاح بدون کلید — در صورت وجود correction قبلی، بدون کلید هم replay شود (cardinality 1) [packages/modules/person-employment/src/personnel-event-lifecycle.ts:405]
- [x] [Review][Patch] نمایش foreshadow لینک‌های زنجیره Cancel/Reverse/Correction روی سطح `/personnel` (AC #3) [apps/web/components/personnel/personnel-event-form.tsx + listForPerson]
- [x] [Review][Patch] Finalize نباید با `cancelsEventId`/`reversesEventId` در payload دروازهٔ lifecycle را دور بزند [packages/modules/person-employment/src/personnel-event-finalize.ts:525]
- [x] [Review][Patch] دکمه‌های Cancel/Reverse/Correct فقط وقتی مجوز lifecycle هست نشان داده شوند [apps/web/components/personnel/personnel-event-form.tsx:504]
- [x] [Review][Patch] قفل UI lifecycle را از `isFinalizeBlockedByAuthzChange` جدا کنید (مجوز/معنای عملیات جداست) [apps/web/components/personnel/personnel-event-form.tsx:166]
- [x] [Review][Patch] `listForPerson` الگوی N+1 دارد؛ لینک‌ها را هم برگردانید یا resolve را batch کنید [apps/web/src/server/personnel-event.ts:365]
- [x] [Review][Patch] خطای `listForPerson` را به‌جای لیست خالی نشان دهید [apps/web/components/personnel/personnel-event-form.tsx:473]
- [x] [Review][Patch] `BusinessEventValidationError` / eventId نامعتبر را به BAD_REQUEST نگاشت کنید [apps/web/src/server/personnel-event.ts:103]
- [x] [Review][Patch] `correctionPayload` نباید `targetEventId`/`targetEventType` متادیتا را بازنویسی کند (ترتیب spread) [packages/modules/person-employment/src/personnel-event-lifecycle.ts:488]
- [x] [Review][Patch] بدون `client`/`DATABASE_URL` بررسی وجود chain ref را fail-open نکنید — blocking `BROKEN_CORRECTION_REF` [packages/modules/person-employment/src/personnel-event-conflicts.ts:350]
- [x] [Review][Patch] `resolvedStatus` را قبل از `StatusBadge` اعتبارسنجی کنید [apps/web/components/personnel/personnel-event-form.tsx:480]
- [x] [Review][Patch] رنگ‌های dark برای Draft و Override یکسان‌اند — تمایز بصری بدهید [apps/web/app/globals.css:110]
- [x] [Review][Patch] سقف طول برای `reasonSchema` [apps/web/src/server/personnel-event.ts:144]
- [x] [Review][Defer] کنترل دسترسی سطح شخص/سازمان روی get/resolve/listForPerson (IDOR بالقوه) — deferred, pre-existing [apps/web/src/server/personnel-event.ts:300]
- [x] [Review][Defer] ایندکس‌های اختیاری `004_*.sql` هنوز در مسیر migrate/CI اجباری نیستند — deferred, pre-existing/optional per spec [packages/db/sql/004_business_event_chain_indexes.sql]
- [x] [Review][Defer] `getConflictReadPool` بدون `end` — الگوی pool سراسری مشابه finalize — deferred, pre-existing [packages/modules/person-employment/src/personnel-event-conflicts.ts:30]

### Interactive a11y DoD (Epic 1 retro carry-in)

For Cancel/Reverse/Correction confirm + status badges:
- Keyboard: Tab order logical; confirm/cancel reachable; dialog focus trap; Escape closes to trigger
- Screen reader: badge text announces status; reason field labeled; consequence text associated
- Contrast: badge light/dark pairs on content canvas (never light tints on dark cards)
- Authz modal: lifecycle mutations blocked when scope revoked mid-session

### Seed / DoD snippet

- Prefer `$transaction` / `withTransaction` for multi-step lifecycle fixtures
- Exact cardinality asserts (one Cancel/Reverse/Correction link after N retries)
- Kernel `person_id` remains application-level (no FK) unless deliberately added — prefer consistency with 4.1
- Person UUID must exist when Draft/UI fixtures FK via Prisma

## Dev Notes

### Current state (UPDATE files — read before coding)

| File | Today | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/kernel/event-store/src/business-event.ts` | `appendBusinessEvent`; chain UUID inputs accepted; status enum includes Cancelled/Reversed; **no readers** | Thin read helpers and/or typed cancel/reverse/correct append wrappers — **INSERT-only** | Sanitizer; PascalCase; TEXT actors; finalized pair rules; no UPDATE API |
| `packages/kernel/event-store/src/index.ts` | Re-exports | Re-export new helpers | Access path + `withTransaction` |
| `packages/kernel/event-store/src/event-store.selfcheck.ts` | Access + business attributable | Chain append green; append-only still fails UPDATE | DATE `::text` discipline |
| `packages/db/sql/003_business_event_attributable_fields.sql` | Chain columns + append-only trigger + status CHECK | Prefer **new** `004_*.sql` for indexes only | Trigger + CHECK vocabulary |
| `personnel-event-conflicts.ts` | UUID-shape only for draft payload chain refs; comment “existence → 4.3” | Existence + cycle/self-ref + wrong-state | Fail-closed stubs; Baseline disposition C; Persian `messageFa` |
| `personnel-event-finalize.ts` | Sets Scheduled\|Effective; does not pass chain ids from draft into append | May wire Correction drafts that carry `correctsEventId`; Scheduled still skips current apply | Idempotency; FOR UPDATE; risk tiers; AD-6 ALS hook; no client Override trust |
| `personnel-event-projection-hook.ts` | Scaffold ALS `invoked` | Lifecycle appends call hook; Scheduled must not mutate current state | Same-txn; ALS not module globals |
| `personnel-event-draft.ts` / Prisma Draft | Working store | Optional correction draft payloads | Never mutate `kernel_events` on draft save |
| `permissions.ts` + `seed.ts` + `errors.ts` | draft/finalize only | New permissions + error codes | Existing bindings |
| `apps/web/src/server/personnel-event.ts` | Draft/evaluate/finalize | cancel/reverse/correct (+ get/resolve) | `governedProcedure`; Persian errors |
| `personnel-event-form.tsx` + `/personnel` | Draft ≠ Finalize; sensitive confirm | Lifecycle actions + badges; Scheduled vs Effective | Footer CTA pattern; a11y |
| Theme/CSS | No `status-badge-*` implementation | UX-DR10 tokens | Brand tokens; light/dark |
| `population-cutover.ts` | Criteria only; fixtures remain | Comment bump only if needed | **No silent cutover** |
| `deferred-work.md` + `sprint-status.yaml` | Points Cancel/Reverse/Correction → 4.3 | Mark landed vs still deferred | Honesty on open AR items |

### Glossary (authoritative)

| Term | Meaning |
| --- | --- |
| **Scheduled** | Finalized future Personnel Event; authoritative but not yet in current state |
| **Effective** | Finalized event whose effective point has been reached and whose valid outcome contributes to evaluated state |
| **Cancel** | Pre-effect neutralization of Scheduled |
| **Reverse** | Post-effect compensating neutralization of Effective |
| **Correction** | Linked replacement/correction chain; originals preserved; one deterministic resolved outcome |
| **Finalized / Authoritative** | Accepted event that cannot be directly edited or hard-deleted |

### Architecture compliance

- **Kernel ownership:** `@divan/event-store` for SoT append (+ thin reads); person-employment orchestrates lifecycle.
- **Naming:** PascalCase past-tense event types (`EventCancelled`, `EventReversed`, `EventCorrected` — confirm catalogue in implementation; application enforces PascalCase shape).
- **Dates:** Effective Date = DATE / `YYYY-MM-DD`; registration/finalization = timestamptz.
- **Errors:** `PersonnelEventError` with `code` + `messageFa`; map at tRPC.
- **Evidence:** No compensation amounts / national id in evidence or lifecycle payload.
- **Authz:** `governedProcedure` + PermissionSet; FR-42 spirit: Cancel/Reverse/Correction leave attributable business (+ access) evidence via existing envelope patterns.

### Library / framework requirements

| Tech | Note |
| --- | --- |
| PostgreSQL 17.x | `FOR UPDATE` on target event for Cancel race; `pg_advisory_xact_lock` if needed — transaction-scoped only |
| `pg` + `withTransaction` | Compensating append + hook |
| Prisma | Draft + projections only — never map `kernel_events` |
| tRPC + zod | Router input validation (reason required string) |
| Vitest | Still deferred — continue `tsx` selfcheck |
| Node 22 / TypeScript 5.x / Next.js 16 / Prisma 7.8 | Stay on workspace versions |

### File structure requirements

```text
packages/kernel/event-store/src/business-event.ts                     # UPDATE — optional read/wrappers
packages/kernel/event-store/src/index.ts                              # UPDATE — exports
packages/db/sql/004_business_event_chain_indexes.sql                  # NEW optional
packages/modules/person-employment/src/personnel-event-lifecycle.ts   # NEW (or cancel/reverse/correct split)
packages/modules/person-employment/src/personnel-event-resolve.ts     # NEW — resolved status + links
packages/modules/person-employment/src/personnel-event-conflicts.ts   # UPDATE — existence/cycle
packages/modules/person-employment/src/personnel-event-finalize.ts    # UPDATE if correction drafts
packages/modules/person-employment/src/personnel-event-projection-hook.ts  # UPDATE if needed
packages/modules/person-employment/src/permissions.ts                 # UPDATE
packages/modules/person-employment/src/seed.ts                        # UPDATE
packages/modules/person-employment/src/errors.ts                      # UPDATE
packages/modules/person-employment/src/index.ts                       # UPDATE
packages/modules/person-employment/src/personnel-event-lifecycle.selfcheck.ts  # NEW
packages/modules/person-employment/package.json                       # UPDATE — selfcheck script
apps/web/src/server/personnel-event.ts                                # UPDATE
apps/web/components/personnel/status-badge.tsx                        # NEW
apps/web/components/personnel/personnel-event-form.tsx                 # UPDATE — actions + badges
apps/web/app/(app)/personnel/page.tsx                                 # UPDATE if needed
apps/web styles / theme CSS                                           # UPDATE — UX-DR10 tokens
_bmad-output/implementation-artifacts/deferred-work.md                # UPDATE
_bmad-output/implementation-artifacts/sprint-status.yaml              # UPDATE status
```

Do **not** create module-local event tables or drop the append-only trigger.

### Testing requirements

| Case | Expect |
| --- | --- |
| Finalize future Draft | `status=Scheduled`; current projection unchanged (scaffold) |
| Finalize past/as-of | `status=Effective` |
| Cancel Scheduled + reason | New row with `cancels_event_id`; resolved Cancelled; original row untouched |
| Cancel without permission/reason | Rejected; Persian `messageFa` |
| Cancel after effect won | Rejected; guide to Reverse/Correction; no Cancel row |
| Concurrent Cancel vs effect | Exactly one winner |
| Reverse Effective | New row with `reverses_event_id`; original preserved |
| Correction | `corrects_event_id` set; timeline/links show chain; resolved deterministic for stub depth |
| Correction self-ref / cycle | Blocking reject |
| Broken target id | Blocking `BROKEN_CORRECTION_REF` (or successor code) |
| UPDATE original | Still throws append-only trigger |
| UX-DR10 | Badges render Scheduled/Effective/Cancelled/Reversed/Draft |
| Access path | Still green |

### Previous story intelligence (4.2 → 4.3)

| Build on | Do not reinvent |
| --- | --- |
| Finalize already writes `Scheduled` \| `Effective` | Re-deriving finalize status vocabulary |
| `appendBusinessEvent` chain UUID columns | New columns that duplicate foreshadow |
| Draft store + `sensitive-confirmation-dialog` | New confirm primitive |
| `classifyConflicts` + `BROKEN_CORRECTION_REF` shape stub | Replacing taxonomy carelessly — **extend** |
| ALS projection hook + `withTransaction` | Module-global hooks |
| `personnel_event.draft` / `.finalize` seed pattern | JWT-only authz |
| Review patches: txn snapshot, Override from session, Tehran DATE, idempotent stored status | Regressing any 4.2 review fix |

**4.2 review lessons still binding:** do not trust client Override; snapshot/classify on finalize txn connection; employment checks on `draft.effectiveDate`; ALS hooks; no `toISOString().slice(0,10)` for PG DATE.

**Handoffs still later:** ordering/pg-boss (4.4); Transfer atomic coverage (4.7); PopulationPort cutover only when criteria met; Reservation release on Cancel (4.14); full timeline (5.3); external correction-**cases** FR-53 (7.5) ≠ FR-17 Correction chains.

### Git intelligence summary

Recent commits: `15d1bb9 story 4.2`, `43b8ffa story 4.1`, `3c17d56 epic 3 retro`, … Pattern: short `story N.M`; Gate + absolute non-goals; `tsx` selfcheck; raw SQL kernel; Prisma working/projections; honest `deferred-work.md`; Status ↔ sprint-status sync; no UTF-8 BOM.

### Latest technical information

- **Cancel race locking:** Prefer exclusive `SELECT … FOR UPDATE` on the target `kernel_events` row (or txn advisory lock on event id). `FOR UPDATE SKIP LOCKED` is for **queue claim** parallelism — wrong tool when both parties must serialize on the **same** event.
- **AD-6:** Keep critical compensating appends synchronous in one txn; heavy historical recalc remains Story 4.4 pg-boss — do not invent workers here.
- **Workspace versions:** Stay on repo-pinned Next/Prisma/pg/tRPC — no new event-sourcing framework.

### Project context reference

No `project-context.md` found at story creation. Follow Architecture Spine + this Gate. User communication: Persian; this story file: English.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Deterministic same-day ordering + pg-boss recalc / `recalculation_pending` | 4.4 |
| Start / Return / Terminate / Transfer / job-comp domain Operators + projectors | 4.5–4.8 |
| Current/historical person & org reconstruction products | 4.9–4.11 |
| Headcount Approval / Reservation expiry / Override product; Cancel releasing Reservation | 4.12–4.14 |
| Full `personnel-event-timeline` (UX-DR9) profile surface | 5.3 |
| Catalogue reports for Scheduled/Corrected/Cancelled/Reversed | 5.5 |
| External data-subject correction-**cases** (FR-53) | 7.5 |
| Formal report supersession after Correction (FR-54) | 7.6 |
| Hash-chain (NFR-10) | AR-AUDIT deferred |
| PopulationPort default registry cutover | Criteria only until met |
| Vitest/ephemeral DB isolation | Open retro item |
| Full AR-TEMPORAL Correction-of-Correction oracle | Fail-closed stubs only |

### UX notes

- Badges: Scheduled blue, Effective green, Cancelled/Reversed muted gray, Draft amber (`DESIGN.md`); dark pairs mandatory on dark canvas.
- Confirm: consequence + reason; never claim history is erased.
- UJ-1: future transfer stays Scheduled — today’s totals unchanged (scaffold proof).
- UJ-2: linked Correction without rewriting history — primary Correction UX journey (minimal surface OK).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.3, Epic 4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-16, FR-17, §2 glossary]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — Cancel race, Correction cycle]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-5, AD-6]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — UX-DR10 status-badge tokens]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — UX-DR9/14, UJ-1/UJ-2]
- [Source: `_bmad-output/implementation-artifacts/4-1-append-only-event-store-attributable-event-record.md`]
- [Source: `_bmad-output/implementation-artifacts/4-2-draft-finalization-conflict-classification.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Fixed `listChainLinksForEvent` to run sequential queries on a single `pg` client (avoid concurrent `client.query` deprecation under txn).
- Lifecycle PermissionSet `personnel-event-lifecycle` bound Admin-only; Operator retains draft/finalize only.

### Completion Notes List

- Append-only Cancel (`EventCancelled` + `cancels_event_id`), Reverse (`EventReversed`), Correction (`EventCorrected`) — originals never UPDATEd.
- Cancel↔effect race: `FOR UPDATE` + evaluation-by-date; reject Cancel when effect won with Persian guide to Reverse/Correction.
- `resolveLifecycleStatus` + UX-DR10 badges; Scheduled finalize sets `applyToCurrentProjection: false` on AD-6 hook.
- Selfchecks green: lifecycle, draft, event-store, web governed.

### File List

- packages/kernel/event-store/src/business-event.ts
- packages/kernel/event-store/src/index.ts
- packages/db/sql/004_business_event_chain_indexes.sql
- packages/modules/person-employment/src/personnel-event-resolve.ts
- packages/modules/person-employment/src/personnel-event-lifecycle.ts
- packages/modules/person-employment/src/personnel-event-lifecycle.selfcheck.ts
- packages/modules/person-employment/src/personnel-event-conflicts.ts
- packages/modules/person-employment/src/personnel-event-finalize.ts
- packages/modules/person-employment/src/personnel-event-projection-hook.ts
- packages/modules/person-employment/src/errors.ts
- packages/modules/person-employment/src/permissions.ts
- packages/modules/person-employment/src/seed.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/package.json
- apps/web/src/server/personnel-event.ts
- apps/web/components/personnel/status-badge.tsx
- apps/web/components/personnel/personnel-event-form.tsx
- apps/web/components/personnel/sensitive-confirmation-dialog.tsx
- apps/web/app/globals.css
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-3-scheduled-state-cancel-reverse-correction.md

### Change Log

- 2026-07-18: Implemented Story 4.3 — Scheduled semantics, Cancel/Reverse/Correction chains, UX-DR10 badges, lifecycle selfcheck.
- 2026-07-18: Code review patches applied — neutralized-target guard, correction idempotency, chain foreshadow links, finalize cancel/reverse forbid, lifecycle caps UI, batch list links.

## Story completion status

- Status: **done**
- Completion note: Code review patches applied; deferred items recorded in deferred-work.md
