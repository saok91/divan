---
baseline_commit: 5b839a5
---

# Story 4.12: Headcount Approval Lifecycle

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want Headcount Approvals with a governed lifecycle,
So that only valid approvals can accept new consumption or Reservation (FR28).

## Gate (read first)

**This story ships FR-28: the Headcount Approval entity, admin lifecycle (create / activate / change / cancel / expire / reduce), status gates that block new consume/reserve on Draft|Cancelled|Expired, and replacement of the 4.11 `approved` MVP stand-in with Approval `allowed_count`. It does not ship Matching matrix, exemptions, Override catalogue, 14-day expiry warnings, or Scheduled-exception product (→ 4.13 / 4.14).**

| Allowed in 4.12 | Forbidden in 4.12 |
| --- | --- |
| `headcount_approval` table + CRUD lifecycle in `@divan/headcount` | Inventing full AR-HEADCOUNT disposition matrix / escalation owners |
| Statuses: at least Draft, Active (consumable), Cancelled, Expired | Matching “oldest valid compatible” product (→ 4.13) |
| Fields: unique requirement code, Team, Job Title, optional Seniority, allowed count, validity, status, approval reference, provenance | Exemption records; Override catalogue; negative free flooring policy (→ 4.14) |
| Gate: Draft/Cancelled/Expired cannot accept **new** consume or Reservation | Rewriting or orphaning existing consumption/reservation rows on cancel/reduce |
| Fail-closed when change/cancel/expire/reduce would orphan active claims (until AR-HEADCOUNT disposition exists) | Silent truncate of claims; rewriting historical ledger rows |
| Bridge Approval → existing `headcount_capacity_slot` so Operators keep working | Replacing consume/reserve APIs; inventing new Personnel Event Operators |
| `approved` in historical reconstruct = Approval allowed ceiling (validity ∩ asOf) | Leaving forever the live-counter stand-in as product truth |
| Admin UI on `/headcount` (سطح ظرفیت و جذب) + thin tRPC | Full dashboard / open-headcount product (→ 5.4); Matching picker UI (→ 4.13) |
| Permissions `headcount.approval.read` / `headcount.approval.write` | Inventing FR-47 toxic matrix; group→role assumptions |
| Selfchecks + seed DoD | UTF-8 BOM on `sprint-status.yaml`; Vitest mandate without ephemeral DB |

### Mandated design — Approval entity (FR-28)

```text
headcount_approval (NEW, raw SQL — same pattern as capacity tables)
  id UUID PK
  requirement_code TEXT UNIQUE NOT NULL     -- unique requirement code
  team_id UUID NOT NULL                     -- Team (OrganizationalUnit TEAM)
  job_title_id UUID NOT NULL
  seniority_id UUID NULL                    -- optional Seniority (FR-29 dims; Grade ≠ match)
  allowed_count INTEGER NOT NULL CHECK (>= 0)
  validity_start DATE NOT NULL
  validity_end_exclusive DATE NOT NULL      -- non-empty half-open: end > start
  status TEXT NOT NULL                      -- draft | active | cancelled | expired
  approval_reference TEXT NULL              -- external/gov reference
  owner_account_id UUID NULL
  created_by / updated_by / created_at / updated_at  -- provenance
  -- derived used/reserved/free: NOT stored as SoT; compute from linked slot ledger
```

**Consumable status:** only `active` **and** validity contains the evaluation date **and** not past natural expiry. `draft`, `cancelled`, `expired` → reject **new** consume/reserve.

**Natural expiry:** when `validity_end_exclusive ≤ today` (Tehran date-only), treat as Expired for gates (either derived on read or a maintain transition — prefer explicit `expireApproval` + derived guard so gates never rely on stale `active`).

**Validity:** half-open `[validity_start, validity_end_exclusive)` via `@divan/temporal-engine` `parseDateOnly`; reject empty/inverted ranges fail-closed.

### Mandated design — Approval ↔ capacity slot bridge (non-negotiable)

Existing Operators (4.5–4.8) mutate `headcount_capacity_slot` + consumption/reservation ledgers. Do **not** fork a second capacity math path.

```text
On activate / allowed_count ↑ (no orphan risk):
  ensure linked headcount_capacity_slot
    dimensions: team_id + job_title_id (+ store seniority on approval; slot may keep null ladder/grade)
    ceiling sync: free_units + used + reserved == allowed_count
    FOR UPDATE on slot when adjusting free_units

On Draft / Cancelled / Expired:
  evaluateHeadcountCapacity / reserve / consume MUST fail-closed for that slot
  (check linked approval status + validity — not only free_units > 0)

On reduce / cancel / expire with active used|reserved > 0:
  REJECT fail-closed (typed error + Persian message)
  — do NOT invent AR-HEADCOUNT disposition (reassign / force-release / override) here
  — document in deferred-work; 4.14 may add Override path
```

**Schema bridge:** add nullable `approval_id UUID` on `headcount_capacity_slot` (migration `009_headcount_approval.sql` + `ensureHeadcountApprovalSchema`). Legacy seed slots without Approval remain fixture-only; product path creates Approval-backed slots.

**Do not** add required `PrimaryAssignment.headcountApprovalId` in this story (nullable stub only if needed for compile — Matching link → 4.13).

### Mandated design — lifecycle operations

| Operation | From → To | Rules |
| --- | --- | --- |
| `createApproval` | — → `draft` | Unique `requirement_code`; validate refs Team/JobTitle/(Seniority); allowed ≥ 0; validity non-empty |
| `activateApproval` | `draft` → `active` | Creates/links slot; sets ceiling; provenance actor/time |
| `updateApproval` (identity / allowed / validity) while `draft` | stays draft | Full edit OK |
| `updateApproval` while `active` | stays active | Identity/code changes restricted if claims exist; allowed↓ / validity shrink with claims → fail-closed |
| `cancelApproval` | `draft`\|`active` → `cancelled` | Active claims → fail-closed |
| `expireApproval` | `active` → `expired` | Active claims → fail-closed; or auto-gate when validity elapsed |
| Reads | list/get | Include derived used/reserved/free from linked slot ledger; status-badge Persian labels |

### Mandated design — `approved` metric cutover (4.11 follow-through)

Update `reconstructHeadcountQuantitiesAsOf`:

| Metric | Until 4.12 (stand-in) | After 4.12 |
| --- | --- | --- |
| `approved` | `used_live + reserved_live + free_live` | Sum of `allowed_count` for Approvals whose validity contains `asOf` and that were consumable as-of (active not cancelled before asOf; expired only after end) **or** linked-slot ceiling from Approval — same catalogue identity |
| `free` | `approved − used − reserved` | Unchanged identity; never silent floor |

Conservation selfcheck must still hold. Document stand-in removal in `deferred-work.md`.

### Mandated design — API / UI / authz

| Layer | Delivery |
| --- | --- |
| `@divan/headcount` | Approval domain module APIs + schema ensure; gate helpers used by evaluate/reserve/consume; export from `index.ts` |
| tRPC | New `apps/web/src/server/headcount.ts` (or extend thin router) — mirror `job-reference.ts`: `governedProcedure` + Zod + map domain errors → `TRPCError` + Persian `messageFa` |
| UI | `/headcount` page: keep 4.11 foreshadow; **add** Admin Approval list + create/activate/cancel forms (سطح ظرفیت و جذب). Use `status-badge`, tabular numerals for counts, Jalali for validity. `headcount-capacity-panel` stays on event forms (live). |
| Permissions | `headcount.approval.read` / `headcount.approval.write` — prefer constants + `assertActorHas*` in `@divan/headcount` (mirror job-ref). Seed PermissionSet for `hr.admin` via existing seed helpers in person-employment/`packages` seed path (same pattern as `job_reference.*` bind for hr.admin). Coarse nav already unlocks `/headcount` for Admin. |
| Root router | Mount as `headcount:` on `apps/web/src/server/root.ts` next to `jobReference` / `organization` |
| Web imports | Never `@prisma/client` in apps/web; only module public APIs |

### Mandated design — AR-HEADCOUNT fail-closed

Product partial freeze (SPEC / PRD 2026-07-16) covers Reservation-at-finalize, oldest-match, 14-day warning, Override negative free — **formal AR still pending**.

For 4.12 orphan/disposition cases: **reject with typed error** — do not invent reassignment, silent claim rewrite, or auto-Override. Matching default and expiry exception UI stay out of scope.

[Source: `epics.md` Story 4.12; `prd.md` FR-28; `SPEC.md` CAP-7 + constraint line 95; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-6; Stories 4.11, 4.7]

## Acceptance Criteria

1. **Given** an HR Admin on سطح ظرفیت و جذب  
   **When** a Headcount Approval is managed (create → activate → list/get)  
   **Then** it has unique requirement code, Team, Job Title, optional Seniority, allowed count, validity, status, approval reference, and provenance

2. **And** Draft, Cancelled, and Expired approvals cannot accept **new** consumption or Reservation; allowed count is a non-negative integer; validity start/end form a valid non-empty range; used/reserved/free derive consistently from the linked capacity ledger

3. **And** changing, cancelling, expiring, or reducing an approval that has active consumption or Reservation cannot orphan or rewrite those claims — operation fails closed with Persian message until AR-HEADCOUNT disposition exists

4. **And** historical `approved` quantities use Approval ceilings (validity ∩ asOf) instead of the live-counter stand-in; conservation `approved === used + reserved + free` remains enforced

5. **And** Stories 4.1–4.11 invariants remain green; this story does **not** deliver Matching/exemptions (4.13), Reservation-expiry warnings / Override catalogue (4.14), Epic 5 dashboard, or new Personnel Event Operators

## Tasks / Subtasks

- [x] Task 1: Approval schema + domain lifecycle (AC: #1, #2, #3)
  - [x] Add `packages/db/sql/010_headcount_approval.sql` + `ensureHeadcountApprovalSchema` (idempotent) — note: `009` already used by compensation sidecar
  - [x] Implement create / activate / update / cancel / expire + list/get with derived quantities
  - [x] Unique `requirement_code`; validate Team + JobTitle + optional Seniority existence via public refs (no headcount→person-employment import cycle — pass IDs validated at API boundary or shared db reads of known tables)
  - [x] Fail-closed reduce/cancel/expire when used+reserved > 0
  - [x] Domain errors: typed codes + `MSG_*_FA` Persian messages

- [x] Task 2: Slot bridge + consume/reserve gates (AC: #2, #3)
  - [x] `approval_id` on `headcount_capacity_slot`; activate syncs ceiling
  - [x] Update `evaluateHeadcountCapacity` / `reserveHeadcountCapacity` / `consumeHeadcountCapacity` to reject Draft|Cancelled|Expired (and out-of-validity) linked approvals
  - [x] Preserve `SELECT … FOR UPDATE` / last-unit concurrency (NFR4)
  - [x] Do not break fixture seed slots used by existing selfchecks — gate only when `approval_id` present **or** migrate demo seed to Approval-backed slots and update selfchecks accordingly (prefer Approval-backed demo path)

- [x] Task 3: Historical `approved` cutover (AC: #4)
  - [x] Replace stand-in in `reconstructHeadcountQuantitiesAsOf` with Approval-backed ceiling
  - [x] Keep conservation fail-closed; update historical-org-headcount selfcheck oracles if needed
  - [x] Note stand-in removal in `deferred-work.md`

- [x] Task 4: tRPC + Admin UI on `/headcount` (AC: #1, #5)
  - [x] Governed router procedures; Zod date-only via `parseDateOnly`; UUID validation
  - [x] Permission constants + seed grants for hr_admin; assertActorHas* pattern
  - [x] UI: list Approvals (status-badge, tabular counts, Jalali validity); create/activate/cancel flows; Persian empty/error; keep 4.11 foreshadow
  - [x] Interactive a11y DoD: labelled fields, keyboard operable actions, `role="alert"` / live errors, focus management on dialogs if used

- [x] Task 5: Selfchecks + DoD (AC: #1–#5)
  - [x] New `headcount-approval.selfcheck.ts` (tsx + node:assert + DATABASE_URL) with oracles:
    - Create draft → cannot consume/reserve
    - Activate → evaluate compatible; consume/reserve OK within allowed_count
    - Cancel/expire/reduce with active claim → rejected; claims unchanged
    - Cancel draft / cancel active with zero claims → OK; subsequent consume rejected
    - Unique requirement_code conflict
    - Invalid / empty validity rejected
    - Historical asOf approved uses Approval ceiling; conservation holds
  - [x] Re-run transfer / start-return / historical-org-headcount / event-store selfchecks — green
  - [x] Typecheck `@divan/headcount`, `@divan/person-employment`, `web`
  - [x] Update `deferred-work.md`; align story Status ↔ `sprint-status.yaml`; **no UTF-8 BOM**

### Review Findings

- [x] [Review][Patch] Out-of-validity / missing Approval ceiling: when linked Approval exists but validity misses `asOf` (or status not active), set `approved = used + reserved` (free=0); when `approval_id` set but row missing, throw fail-closed — decided 2026-07-19 (option A + dangling throw) [`packages/modules/headcount/src/historical-headcount.ts:406`]
- [x] [Review][Patch] Pass event `effectiveDate` as `evaluationDate` into consume/reserve (PE callers omit it; gate defaults to Tehran today) [`packages/modules/person-employment/src/personnel-event-transfer.ts`, `personnel-event-start-return.ts`, `personnel-event-job-level.ts` + headcount defaults]
- [x] [Review][Patch] Historical `approved` must require consumable-as-of `active` (exclude cancelled/expired status even inside validity window) [`packages/modules/headcount/src/historical-headcount.ts:415`]
- [x] [Review][Patch] `listApprovals` status filter uses raw DB status; naturally elapsed `active` rows mislisted vs soft-expire gate [`packages/modules/headcount/src/headcount-approval.ts:912`]
- [x] [Review][Patch] Lifecycle races: cancel/expire/update/activate lack `FOR UPDATE` + status-conditioned UPDATE / rowCount checks; concurrent activate unique on `approval_id` unhandled [`packages/modules/headcount/src/headcount-approval.ts:544-885`]
- [x] [Review][Patch] Map unique_violation on `requirement_code` to `DUPLICATE_CODE` [`packages/modules/headcount/src/headcount-approval.ts:475`]
- [x] [Review][Patch] Identity-lock throws `ORPHAN_CLAIMS` with `IDENTITY_LOCKED` message — add/use distinct `IDENTITY_LOCKED` code [`packages/modules/headcount/src/headcount-approval.ts:716`]
- [x] [Review][Patch] consume/reserve wrap `HeadcountApprovalError` into bare `Error(messageFa)` — domain code lost for PE callers [`packages/modules/headcount/src/index.ts:412`]
- [x] [Review][Patch] Strengthen selfcheck oracles (weak `compatible || incompatible`; missing evaluationDate / natural-expiry paths) [`packages/modules/headcount/src/headcount-approval.selfcheck.ts`]
- [x] [Review][Defer] `ensureHeadcountApprovalSchema` DDL on every tRPC request — deferred, pre-existing ensure-* pattern
- [x] [Review][Defer] N+1 `slotApprovalAllowsConsume` inside evaluate — deferred, performance only
- [x] [Review][Defer] IDOR / unscoped `listApprovals`/`getApproval` — deferred, pre-existing IDOR-on-list/get pattern (see deferred-work)
- [x] [Review][Defer] Coarse `/headcount` nav vs `headcount.approval.*` seed only on hr.admin — deferred, pre-existing coarse nav

## Dev Notes

### Current code state (READ BEFORE CODING)

| Area | Path | Today | 4.12 change |
| --- | --- | --- | --- |
| Capacity port | `packages/modules/headcount/src/index.ts` | Slot mutate + live panel; header says NOT Approval | **ADD** Approval APIs; **UPDATE** evaluate/reserve/consume gates |
| Historical | `packages/modules/headcount/src/historical-headcount.ts` | `approved` = live stand-in | **UPDATE** Approval ceiling |
| Schema | `packages/db/sql/006–008_headcount_*.sql` | slot / consumption / reservation | **ADD** `009_headcount_approval.sql` + `approval_id` on slot |
| Coordinator | `packages/modules/person-employment/src/historical-org-headcount.ts` | Composes headcount public API | Likely **unchanged** if public DTO stable; re-run selfcheck |
| Headcount page | `apps/web/app/(app)/headcount/page.tsx` | Foreshadow only | **UPDATE** — Admin Approval surface + foreshadow |
| tRPC | `apps/web/src/server/organization.ts` | Historical counts | Keep; **ADD** headcount approval router |
| Job-ref pattern | `apps/web/src/server/job-reference.ts` | Admin CRUD + permissions | **Mirror** for Approval router shape |
| Primary | Prisma `PrimaryAssignment` | `headcountApprovalId` deferred comment | **Do not** require product FK (→ 4.13) |
| Conflicts | `personnel-event-conflicts.ts` | Capacity missing / Override seam | Do not invent Override catalogue |

### What this story changes vs preserves

**Changes:** Approval entity + lifecycle; slot bridge; consume/reserve status gates; historical `approved` source; `/headcount` admin UI; permissions; selfchecks.

**Preserves:** AD-2 projections-never-SoT; AD-3 module boundary (headcount ↛ person-employment); AD-6 sync capacity in same txn as Operators; FR-16 Scheduled≠current membership; FR-30 reserve-on-finalize for Transfer; append-only event-store; live `readHeadcountCapacityPanel` for finalize UX; no UTF-8 BOM; Status ↔ sprint-status alignment.

### Architecture compliance

- **AD-2:** Approval is a governed projection/entity for capacity ceiling — mutations audited via provenance; consumption still event-linked ledger
- **AD-3:** All Approval + capacity math in `@divan/headcount`; person-employment only calls public APIs; no reverse dependency
- **AD-6:** Critical consume/reserve still sync in Operator `$transaction`; Approval admin writes may be own transactions but must keep slot ceiling consistent under `FOR UPDATE`
- **Stack:** raw SQL for approval/capacity tables; Prisma stays for OrgUnit/JobTitle/Seniority identity reads at boundary; tRPC web only; `tsx` selfchecks

### AR / fail-closed (do not invent)

| Artifact | Rule for 4.12 |
| --- | --- |
| AR-HEADCOUNT | Ship entity + gates + fail-closed orphan rejection; **do not invent** disposition/escalation/matching default product beyond freeze already used by Operators; Matching UI → 4.13; expiry warning/Override → 4.14 |
| AR-TEMPORAL | Date-only Tehran; half-open validity; exclusive end |
| AR-ACCESS / FR-47 | Coarse `headcount.approval.*` only |
| AR-DATA | No new sensitive categories |
| AR-SECONDARY | Secondary still non-consuming |
| AR-IDENTITY | No PopulationPort cutover |
| AR-REPORTING | No dashboard/report catalogue |

### Previous story intelligence (4.11)

- `/headcount` already hosts foreshadow — extend, do not replace without keeping FR-27 as-of UI.
- `approved` stand-in explicitly deferred to 4.12 — remove it here.
- Review patches to respect: conservation fail-closed (no silent `free < 0` floor); UUID validation on tRPC; `DATABASE_URL` → typed TRPCError; no broken package selfcheck scripts; scoped fixture Teams for exact oracles.
- Deferred from 4.11 review still open: planned capacity deltas DTO; N+1 event reads; unscoped O(teams×members) — do not expand unless blocked.
- Never UTF-8 BOM on `sprint-status.yaml`.
- Pattern: domain module + `tsx` selfcheck + thin governed tRPC + Persian `messageFa`.

### Git intelligence

```text
5b839a5 story 4.11  ← historical approved stand-in + /headcount foreshadow — cut over here
ea232af story 4.10  ← as-of / Baseline helpers
7bb4f50 story 4.9   ← assembler pattern
8de3f2e story 4.8   ← Title capacity move
1e29400 story 4.7   ← Transfer reserve + capacity panel
```

Pattern: capacity mutations stay on slot ledger; product ceiling becomes Approval-backed; admin surface mirrors job-reference router discipline.

### Latest tech notes

- Industry requisition lifecycles (Workable/Lever/Oracle): Draft → Pending/Approved → Open → Cancelled/Expired/Filled. Divan MVP collapses to **Draft / Active / Cancelled / Expired** per FR-28 (no multi-step Pending workflow unless product later adds it).
- Capacity ceilings should be first-class entities; live counters alone are not historical SoT (already learned in 4.11).
- Keep Matching (oldest valid by validity start then creation) out of 4.12 — only ensure Active Approvals are queryable for 4.13 to consume.
- Concurrency: continue row-level locks on slot for last-unit; Approval activate/reduce must lock the same slot row.

### Project structure notes

```text
packages/db/sql/
  009_headcount_approval.sql              # NEW
packages/modules/headcount/src/
  index.ts                                # UPDATE — exports + gates
  headcount-approval.ts                   # NEW — lifecycle
  headcount-approval.selfcheck.ts         # NEW
  historical-headcount.ts                 # UPDATE — approved source
  package.json                            # UPDATE — selfcheck script
apps/web/src/server/
  headcount.ts                            # NEW — approval router
  root.ts                                 # UPDATE — mount `headcount: headcountRouter`
apps/web/app/(app)/headcount/page.tsx     # UPDATE — admin + foreshadow
apps/web/components/headcount/…           # NEW — approval list/forms
packages/modules/person-employment/src/
  historical-org-headcount.selfcheck.ts   # UPDATE oracles if approved source changes
_bmad-output/implementation-artifacts/
  deferred-work.md                        # UPDATE
  sprint-status.yaml                      # UPDATE — ready-for-dev
```

### Testing requirements

- Pattern: `tsx` + `node:assert` + real `DATABASE_URL` (Vitest still deferred / open action item).
- Seed DoD: FK-shaped Team + JobTitle + optional Seniority; Approval draft→active; `$transaction` for fixture writes; exact allowed/used/reserved/free cardinalities.
- Regression: 4.7 transfer, 4.5 start-return, 4.11 historical-org-headcount, workers — green.

### Absolute non-goals

- Matching matrix / oldest-valid default / manual reselection audit UI (4.13)
- Exemptions (4.13)
- 14-day expiry warning / Scheduled exception state / Override catalogue (4.14)
- Durable reserve for Scheduled Start (still deferred FR-30 remainder)
- Required `PrimaryAssignment.headcountApprovalId` product field
- Full dashboard / open-headcount product (5.4) / report catalogue (5.5)
- PopulationPort cutover; inventing open AR disposition workflows
- Import cycle headcount → person-employment
- Weakening FR-16 / FR-30 / append-only / Secondary non-consumption
- UTF-8 BOM on `sprint-status.yaml`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.12–4.14]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-28..FR-32, §8.7]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — candidate Approval attributes §3.6]
- [Source: `_bmad-output/specs/spec-divan/SPEC.md` — CAP-7; AR-HEADCOUNT partial freeze]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-6, headcount module]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — ظرفیت و جذب; status-badge; headcount-capacity-panel]
- [Source: `_bmad-output/implementation-artifacts/4-11-historical-organization-headcount-reconstruction.md`]
- [Source: `_bmad-output/implementation-artifacts/4-7-team-transfer-with-atomic-capacity-movement.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/modules/headcount/src/index.ts`]
- [Source: `packages/modules/headcount/src/historical-headcount.ts`]
- [Source: `apps/web/app/(app)/headcount/page.tsx`]
- [Source: `apps/web/src/server/job-reference.ts` — admin CRUD pattern]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Prisma OrgUnit/JobTitle/Seniority ids are TEXT — validateRefs must not cast `$1::uuid` against those tables
- SQL migration numbered `010_headcount_approval.sql` because `009_compensation_draft_sidecar.sql` already occupied 009
- Stripped accidental UTF-8 BOM from `sprint-status.yaml` after status edit

### Completion Notes List

- FR-28 Approval entity + lifecycle (draft/active/cancelled/expired) in `@divan/headcount`
- Slot bridge via `approval_id`; activate syncs free+used+reserved == allowed_count under FOR UPDATE
- evaluate/reserve/consume gate Approval-backed slots only; legacy fixture slots (null approval_id) unchanged
- Historical `approved` uses Approval `allowed_count` when validity contains asOf; legacy stand-in retained for unlinked slots
- Fail-closed orphan rejection (ORPHAN_CLAIMS) for cancel/expire/reduce with active claims — no AR-HEADCOUNT disposition invented
- Admin UI on `/headcount` + governed tRPC `headcount.*` + `headcount.approval.read/write` seed for hr.admin
- Selfcheck green; transfer / start-return / historical-org-headcount regressions green; typechecks green

### File List

- packages/db/sql/010_headcount_approval.sql
- packages/modules/headcount/src/headcount-approval.ts
- packages/modules/headcount/src/headcount-approval.selfcheck.ts
- packages/modules/headcount/src/index.ts
- packages/modules/headcount/src/historical-headcount.ts
- packages/modules/headcount/package.json
- packages/modules/person-employment/src/seed.ts
- packages/modules/person-employment/src/index.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/src/index.ts
- apps/web/src/server/headcount.ts
- apps/web/src/server/root.ts
- apps/web/app/(app)/headcount/page.tsx
- apps/web/components/headcount/approval-panel.tsx
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-12-headcount-approval-lifecycle.md

### Change Log

- 2026-07-19: Code review patches applied — historical approved cutover, evaluationDate wiring, lifecycle race guards, soft-expire list filter, IDENTITY_LOCKED / DUPLICATE_CODE, selfcheck oracles; status → done
- 2026-07-19: Implemented Story 4.12 Headcount Approval lifecycle (FR-28) — schema, gates, historical cutover, Admin UI, selfchecks; status → review

## Story completion status

Status: **done**

Completion note: Code review patches applied (historical ceiling, evaluationDate, lifecycle races, list soft-expire, error codes); deferred items remain in deferred-work.
