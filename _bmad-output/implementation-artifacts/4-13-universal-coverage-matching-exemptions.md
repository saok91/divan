---
baseline_commit: 37518e2
---

# Story 4.13: Universal Coverage Matching & Exemptions

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want every Primary Assignment to consume compatible headcount unless exempted,
So that capacity matching stays deterministic and attributable (FR29).

## Gate (read first)

**This story ships FR-29: Approval-centric matching (Team + Job Title + optional Seniority), oldest-valid default, audited manual reselection, Primary↔Approval product link, and audited exemptions with reporting treatment. It does not ship Override catalogue, 14-day expiry warnings, Scheduled-exception product, or durable reserve for Scheduled Start (→ 4.14 / FR-30 remainder).**

| Allowed in 4.13 | Forbidden in 4.13 |
| --- | --- |
| Replace slot-first match with Approval-first match in `@divan/headcount` | Inventing AR-HEADCOUNT disposition / escalation owners |
| Dimensions: Team + Job Title + optional Seniority only | Matching on Grade, Ladder, or compensation |
| Default: oldest valid compatible Approval (`validity_start` ASC, then `created_at` ASC) | Leaving ladder/grade filters as product match truth |
| Manual reselection of another **compatible** Approval before finalize + audit | Silent rebind without audit; inventing Override for shortage |
| `PrimaryAssignment.headcountApprovalId` product FK (nullable only when exempt) | Requiring Approval on Secondary (still non-consuming) |
| Exemption entity: policy, Assignment, actor/approver, reason, validity, reporting treatment | Override catalogue / negative free flooring (→ 4.14) |
| Wire Start/Return/Transfer/JobTitle/Seniority capacity paths through Approval match | Durable reserve for Scheduled Start (still deferred) |
| Extend `headcount-capacity-panel` with exempt (+ foreshadow overridden) | Full dashboard / open-headcount product (→ 5.4) |
| Permissions for exemption write + match reselection audit | Inventing FR-47 toxic matrix; group→role assumptions |
| Selfchecks + seed DoD | UTF-8 BOM on `sprint-status.yaml`; Vitest mandate without ephemeral DB |

### Mandated design — Approval matching (FR-29)

**Product truth is Approval identity, not raw slot rows.** Consume/reserve still mutate the linked `headcount_capacity_slot` ledger (4.12 bridge). Matching selects an Approval; the linked slot is the capacity unit.

```text
Compatible Approval (evaluationDate = event effectiveDate, Tehran date-only):
  status consumable at evaluationDate (active + validity contains date; soft-expire gate)
  team_id === Primary/successor team
  job_title_id === Primary/successor job title
  seniority rule (see below)
  linked slot exists with free_units > 0 (for new consume/reserve) OR exemption path

Seniority compatibility (product default — freeze into selfcheck oracles):
  Approval.seniority_id IS NULL  → matches any Assignment seniority (including null)
  Approval.seniority_id IS NOT NULL → matches only when Assignment.seniority_id equals it
  When both a seniority-specific and a seniority-unspecified Approval match → oldest wins
    (validity_start ASC, created_at ASC, id ASC as tie-break)
  Grade / Ladder / compensation MUST NOT filter candidates

Default selection:
  ORDER BY validity_start ASC, created_at ASC, id ASC
  among compatible + consumable Approvals with free capacity on linked slot

Manual reselection:
  preferredApprovalId on draft payload (NOT preferredSlotId as product API)
  Must still be compatible + consumable; otherwise block with Persian message
  Audit: actor, time, draft/event id, previous default Approval id, selected Approval id, reason optional
```

**Remove product reliance on `slotMatchesRefs` ladder/grade filters** for Approval-backed paths. Legacy fixture slots with `approval_id IS NULL` may keep the old slot evaluator only for existing selfchecks — product Operators MUST prefer Approval match. Do not invent a second ledger.

### Mandated design — CapacityCheckInput cutover

```text
CapacityCheckInput (UPDATE):
  teamId, jobTitleId, seniorityId?          -- match dims
  effectiveDate                             -- evaluation date
  preferredApprovalId?                      -- manual reselection
  // KEEP preferredSlotId temporarily for fixture/selfcheck bridge ONLY
  // Do NOT pass ladderId/gradeId into match for Approval-backed evaluate

CapacityCheckResult (UPDATE when compatible):
  outcome: "compatible"
  approvalId: string                        -- NEW product id
  slotId: string                            -- linked slot for ledger mutate
  matchedBy: "default" | "manual"
  messageFa: string
```

Conflict classifier + Operators stash **`headcountApprovalId`** (and keep `capacitySlotId` as derived from linked slot for ledger calls). Prefer writing both on draft payload for one release so AD-6 consume paths need no second lookup race — but Approval id is the attributable link.

### Mandated design — PrimaryAssignment.link

```text
PrimaryAssignment (Prisma UPDATE):
  headcountApprovalId String?   -- product field (was deferred comment)
  // When consuming Primary is applied/opened:
  //   set headcountApprovalId from matched Approval
  // When exempt:
  //   headcountApprovalId NULL + exemption record covers the Assignment interval
  // Secondary: NEVER set (no column; still non-consuming)
```

Migration: add nullable column + index; update Start/Return/Transfer/JobTitle/Seniority Primary open paths to persist the matched Approval id. Historical as-of / current-state assemblers surface the link when present (no Epic 5 profile redesign).

### Mandated design — Exemptions

```text
headcount_exemption (NEW, raw SQL — same pattern as approval/capacity):
  id UUID PK
  policy_code TEXT NOT NULL              -- named policy identity (e.g. intern-pool)
  primary_assignment_id TEXT NOT NULL   -- Prisma PrimaryAssignment.id (TEXT uuid7)
  person_id UUID NOT NULL               -- denormalized for audit/query
  actor_account_id UUID NOT NULL        -- who recorded
  approver_account_id UUID NOT NULL     -- who approved (may equal actor for MVP admin)
  reason TEXT NOT NULL                  -- mandatory Persian/ops reason
  validity_start DATE NOT NULL
  validity_end_exclusive DATE NOT NULL  -- half-open; must cover Assignment interval claimed
  reporting_treatment TEXT NOT NULL     -- enum: exclude_from_used | count_as_used_exempt | other (document)
  status TEXT NOT NULL                  -- draft | active | revoked | expired
  created_at / updated_at / provenance
```

**Rules:**

| Rule | Behavior |
| --- | --- |
| Universal coverage | Finalize that would open/keep a consuming Primary without compatible Approval **and** without active covering exemption → block (`HEADCOUNT_UNAPPROVED` / typed Persian) |
| Exemption active | Skip consume/reserve for that Assignment while exemption validity covers evaluation date; panel shows **exempt** |
| Reporting treatment | Persist on exemption; do not invent dashboard math beyond panel `exempt` count foreshadow |
| Secondary | Still never consumes; no exemption required |
| Override vs exemption | Shortage Override stays 4.14 — do **not** overload exemption to mean “allow over capacity” |
| Revoke/expire | Fail-closed if Assignment would become uncovered Mid-interval without Approval rebind — typed error until disposition exists (same spirit as 4.12 orphan reject) |

Permissions: `headcount.exemption.read` / `headcount.exemption.write` (seed `hr.admin`). Reselection audit can reuse Approval write or a dedicated `headcount.match.reselect` — prefer explicit constant + assert.

### Mandated design — Operator / conflict wiring

| Path | 4.13 change |
| --- | --- |
| `personnel-event-conflicts.ts` | Call Approval match; pass `seniorityId`; stash `headcountApprovalId` + derived `capacitySlotId`; stop using ladder/grade for match |
| Start / Return | Effective consume via matched Approval’s slot; persist `headcountApprovalId` on Primary |
| Transfer / JobTitleChanged | Reserve/consume via Approval match on destination successor dims (include seniority) |
| **SeniorityChanged** | **ADD** to capacity re-eval set: title unchanged but seniority may change compatibility — re-match / fail-closed if no compatible Approval or exemption (was deferred in 4.8) |
| Termination / release | Unchanged ledger release; clear or retain Approval link per projection close (historical row keeps id) |
| Exemption path | Conflicts: if active exemption covers Assignment → no HEADCOUNT_UNAPPROVED; no consume |

### Mandated design — UI / API

| Layer | Delivery |
| --- | --- |
| `@divan/headcount` | `matchCompatibleApprovals` / update `evaluateHeadcountCapacity`; exemption CRUD + `assertExemptionCovers`; export from `index.ts` |
| tRPC | Extend `apps/web/src/server/headcount.ts`: list compatible Approvals for draft dims; exemption list/create/activate/revoke; map domain errors → `TRPCError` + `messageFa` |
| Event forms | Approval picker (default highlighted; manual change audited on finalize); keep `headcount-capacity-panel` |
| Panel UX-DR13 | Show **exempt** count/flag; optional muted “overridden” placeholder (no Override product yet) |
| `/headcount` | Admin exemption list/create (سطح ظرفیت و جذب) — do not remove Approval panel |
| Audit | Reselection + exemption mutations under AR-AUDIT envelope categories (add `organization.headcount_exemption` if needed) |

### Mandated design — AR-HEADCOUNT fail-closed

Product partial freeze (SPEC CAP-7 / PRD 2026-07-16): oldest-compatible default + audited manual select — **implement that**. Formal AR still pending for escalation/disposition.

Do **not** invent: Override negative free, 14-day warning UI, Scheduled-exception state machine, orphan claim reassignment, Secondary consumption policy, contracting-entity match dims.

[Source: `epics.md` Story 4.13; `prd.md` FR-29; `SPEC.md` CAP-7 + constraint line 95; `addendum.md` §6.1–6.2; Stories 4.12, 4.7, 4.8]

## Acceptance Criteria

1. **Given** a Primary Assignment needing capacity  
   **When** matching runs at finalization  
   **Then** compatibility is Team + Job Title + optional Seniority; Grade and compensation do not determine matching

2. **And** default match is the oldest valid compatible Approval (by validity start, then creation time); an authorized user may manually select another compatible Approval before finalize, and that choice is audited

3. **And** exemptions identify policy, Assignment, actor/approver, reason, validity, and reporting treatment; an active covering exemption allows a Primary without consuming Approval capacity; Secondary remains non-consuming by default

4. **And** `PrimaryAssignment.headcountApprovalId` is set for consuming Primaries (null only when exempt); consume/reserve still use the Approval-linked slot ledger under `FOR UPDATE` (NFR4)

5. **And** Stories 4.1–4.12 invariants remain green; this story does **not** deliver Override catalogue / 14-day expiry warnings / Scheduled-exception product (4.14), durable Scheduled Start reserve, or Epic 5 dashboard

## Tasks / Subtasks

- [x] Task 1: Approval-first matching engine (AC: #1, #2)
  - [x] Implement `matchCompatibleApprovals` / rewrite `evaluateHeadcountCapacity` for Approval-backed path (seniority rules + oldest sort)
  - [x] Stop using Grade/Ladder as product match filters on Approval-backed evaluate
  - [x] Support `preferredApprovalId` with compatibility enforcement + `matchedBy`
  - [x] Preserve `SELECT … FOR UPDATE` on linked slot for consume/reserve
  - [x] Domain errors: typed codes + `MSG_*_FA` (incompatible manual select, no match, port unavailable)

- [x] Task 2: Operator + conflict + SeniorityChanged wiring (AC: #1, #2, #4)
  - [x] Update conflict classifier to pass seniority; stash `headcountApprovalId` + derived `capacitySlotId`
  - [x] Update Start/Return/Transfer/JobTitle Operators to persist Approval id on Primary open
  - [x] Add SeniorityChanged to capacity re-eval (match or exemption required)
  - [x] Keep AD-6 sync in same txn; do not invent Override for shortage

- [x] Task 3: PrimaryAssignment FK + Prisma migration (AC: #4)
  - [x] Add `headcountApprovalId` column + index; remove “deferred” comment as product field
  - [x] Projection/open paths write the link; Secondary unchanged
  - [x] Current/historical assemblers expose id when present (minimal — no profile redesign)

- [x] Task 4: Exemptions schema + domain + gates (AC: #3)
  - [x] SQL `011_headcount_exemption.sql` (or next free number) + `ensureHeadcountExemptionSchema`
  - [x] CRUD lifecycle + coverage check used by evaluate/finalize
  - [x] Reporting treatment enum persisted; panel can show exempt
  - [x] Fail-closed revoke that would uncover Assignment mid-interval

- [x] Task 5: tRPC + UI (AC: #2, #3)
  - [x] Compatible-Approval list + manual select on consuming event forms; audit on finalize
  - [x] Exemption admin on `/headcount`; permissions seeded for hr.admin
  - [x] Extend `HeadcountCapacityPanel` with exempt (UX-DR13); Persian empty/error
  - [x] Interactive a11y DoD: labelled controls, keyboard operable, `role="alert"` / live errors, focus on dialogs

- [x] Task 6: Selfchecks + DoD (AC: #1–#5)
  - [x] New `headcount-matching.selfcheck.ts` and/or extend approval selfcheck with oracles:
    - Two Approvals same Team+Title → oldest `validity_start` then `created_at` wins
    - Grade differs, same Title → still match (Grade ignored)
    - Seniority-specific vs unspecified competition → oldest among both that match
    - Manual preferredApprovalId respected when compatible; rejected when not
    - Primary gets `headcountApprovalId`; Secondary never
    - Active exemption → finalize without consume; panel/exemption reporting fields present
    - SeniorityChanged without compatible Approval/exemption → block
  - [x] Re-run transfer / start-return / job-level / headcount-approval / historical-org-headcount selfchecks — green
  - [x] Typecheck `@divan/headcount`, `@divan/person-employment`, `web`
  - [x] Update `deferred-work.md`; align story Status ↔ `sprint-status.yaml`; **no UTF-8 BOM**

### Review Findings

- [x] [Review][Decision] Exemption continuity after Primary close+open — resolved: rebind covering exemption to successor on open
- [x] [Review][Decision] Transfer exemption path — resolved: destination Approval always required; panel omits source primaryAssignmentId for Transfer
- [x] [Review][Patch] Manual Approval reselection not permission-gated or audit-logged on finalize [`packages/modules/person-employment/src/personnel-event-conflicts.ts:1253`] — `assertActorHasHeadcountMatchReselect` / `assertPreferredApprovalCompatible` never called; only `headcountMatchedBy` stashed on payload
- [x] [Review][Patch] Product evaluate falls through to legacy Grade/Ladder slot match after Approval miss [`packages/modules/headcount/src/index.ts:429`] — returns `matchedBy: "legacy_slot"` with `approvalId: null`, violating Approval-first fail-closed for Operators
- [x] [Review][Patch] Remove UTF-8 BOM from `sprint-status.yaml` [`_bmad-output/implementation-artifacts/sprint-status.yaml:1`] — Gate Forbidden / Task 6 DoD
- [x] [Review][Patch] Transfer capacity panel passes source `primaryAssignmentId` while classify uses null [`apps/web/components/personnel/personnel-event-form.tsx:215`] — panel can show exempt while finalize still requires destination Approval
- [x] [Review][Patch] Capacity panel fallback scans slots without `approval_id IS NULL` and uses `slotMatchesRefs` ladder/grade [`packages/modules/headcount/src/index.ts:1231`]
- [x] [Review][Patch] Start/Return form has no Approval picker despite enabled compatible query and payload support [`apps/web/components/personnel/personnel-event-form.tsx:781`]
- [x] [Review][Patch] Do not treat stashed `headcountApprovalId` as `preferredApprovalId` on re-classify [`packages/modules/person-employment/src/personnel-event-conflicts.ts:1253`] — stale preferred forces `manual_incompatible` instead of default rematch
- [x] [Review][Patch] `revokeExemption` trusts client `hasApprovalRebind` / `allowUncover` without verifying Primary Approval rebind [`packages/modules/headcount/src/headcount-exemption.ts:634`] — UI also cannot revoke active rows (`allowUncover` only for draft)
- [x] [Review][Patch] `createExemption` does not verify Primary exists / belongs to `personId` / is active in validity [`packages/modules/headcount/src/headcount-exemption.ts:405`]
- [x] [Review][Patch] Reject overlapping active exemptions on same Primary interval [`packages/modules/headcount/src/headcount-exemption.ts:465`]
- [x] [Review][Patch] Match candidates ignore linked slot `start_date` / `end_date_exclusive` [`packages/modules/headcount/src/headcount-matching.ts:106`]
- [x] [Review][Patch] Clear `preferredApprovalId` form state when `eventType` changes [`apps/web/components/personnel/personnel-event-form.tsx:142`]
- [x] [Review][Patch] Task 6 selfcheck gaps: SeniorityChanged block oracle + Primary `headcountApprovalId` persistence / Secondary never [`packages/modules/headcount/src/headcount-matching.selfcheck.ts`]
- [x] [Review][Patch] Move `strPayload` helper below imports to satisfy `import/first` [`packages/modules/person-employment/src/personnel-event-conflicts.ts:43`]
- [x] [Review][Defer] Unscoped `listExemptions` / `getExemption` (permission-only IDOR class) [`apps/web/src/server/headcount.ts:384`] — deferred, pre-existing
- [x] [Review][Defer] `ensureHeadcountExemptionSchema` runtime DDL on every request [`packages/modules/headcount/src/headcount-exemption.ts`] — deferred, pre-existing ensure-* pattern

## Dev Notes

### Current code state (READ BEFORE CODING)

| Area | Path | Today | 4.13 change |
| --- | --- | --- | --- |
| Evaluate | `packages/modules/headcount/src/index.ts` | Slot-first; `slotMatchesRefs` uses job/ladder/grade; `ORDER BY start_date, id`; `preferredSlotId` | **UPDATE** Approval-first + seniority; oldest Approval; `preferredApprovalId` |
| Approval | `packages/modules/headcount/src/headcount-approval.ts` | Lifecycle + slot bridge + gates | **Reuse** consumable helpers; list candidates for match |
| Historical | `packages/modules/headcount/src/historical-headcount.ts` | Approval ceiling for `approved` | Likely unchanged; re-run selfcheck |
| Conflicts | `packages/modules/person-employment/src/personnel-event-conflicts.ts` | Passes ladder/grade + `preferredSlotId` | **UPDATE** seniority + Approval match stash |
| Start/Return | `personnel-event-start-return.ts` | `capacitySlotId` consume | Persist `headcountApprovalId` |
| Transfer | `personnel-event-transfer.ts` | Slot reserve/convert | Approval match on dest |
| Job-level | `personnel-event-job-level.ts` | Title in capacity set; SeniorityChanged facts-only | **ADD** SeniorityChanged capacity re-eval |
| Primary model | `packages/db/prisma/schema.prisma` | Comment: headcountApprovalId deferred | **ADD** product column |
| Panel | `apps/web/components/personnel/headcount-capacity-panel.tsx` | used/reserved/free only | **ADD** exempt |
| Headcount UI | `apps/web/components/headcount/approval-panel.tsx` | Approval admin | Keep; **ADD** exemption admin |
| Override seam | conflicts / finalize | Skeleton override reason | Do not expand into Override catalogue |

### What this story changes vs preserves

**Changes:** Matching algorithm and dimensions; draft payload Approval id; Primary FK; SeniorityChanged capacity path; exemption entity + gates; panel exempt; audit of manual reselection.

**Preserves:** AD-2 projections-never-SoT; AD-3 module boundary (headcount ↛ person-employment for tables); AD-6 sync capacity in Operator `$transaction`; FR-16 Scheduled≠current membership; FR-30 reserve-on-finalize for Transfer (already); Approval lifecycle (4.12); append-only event-store; Secondary non-consumption; no UTF-8 BOM; Status ↔ sprint-status alignment.

### Architecture compliance

- **AD-2:** Matching links projections to Approval identity; ledger remains event-attributable consumption/reservation rows
- **AD-3:** All match + exemption math in `@divan/headcount`; person-employment only calls public APIs
- **AD-6:** Critical match→consume/reserve still sync in same txn as event append; heavy historical recalc stays async/out of scope
- **Stack:** raw SQL for exemption (+ any match helper tables if needed); Prisma for Primary FK; tRPC web only; `tsx` selfchecks

### AR / fail-closed (do not invent)

| Artifact | Rule for 4.13 |
| --- | --- |
| AR-HEADCOUNT | Ship oldest-match + audited manual select + exemptions per freeze; **do not invent** Override/expiry-exception/orphan disposition |
| AR-TEMPORAL | Date-only Tehran; half-open validity on Approvals and exemptions |
| AR-ACCESS / FR-47 | Coarse `headcount.exemption.*` (+ reselect audit permission); no toxic matrix |
| AR-DATA | No new sensitive categories beyond headcount org category if envelope needs exemption id |
| AR-SECONDARY | Secondary still non-consuming; no exemption required |
| AR-IDENTITY | No PopulationPort cutover |
| AR-REPORTING | Panel exempt only; no dashboard catalogue |

### Open matching edge (document in deferred-work if not fully productized)

Addendum §6.2 lists further questions (named seats, correction rebind, contracting entity). **MVP freeze for 4.13:** pooled Approval units; oldest among seniority-compatible; Correction rebind only via existing Correction/Reverse capacity replay — do not invent free-form rebind UI. Anything beyond freeze → note in `deferred-work.md`, do not block story.

### Previous story intelligence (4.12)

- Approval entity + slot `approval_id` bridge is the substrate — match through Approvals, mutate slots.
- Review patches to respect: pass `evaluationDate` = event `effectiveDate` into consume/reserve; soft-expire list/gate; `FOR UPDATE` on lifecycle; do not wrap `HeadcountApprovalError` into bare `Error` (preserve domain codes).
- Historical `approved` already Approval-backed — do not reintroduce live stand-in.
- Orphan cancel/expire still fail-closed — exemptions are not a backdoor to cancel Approvals with claims.
- Never UTF-8 BOM on `sprint-status.yaml`.
- Pattern: domain module + `tsx` selfcheck + thin governed tRPC + Persian `messageFa`.
- Fixture slots with null `approval_id` still used by older selfchecks — keep bridge or migrate fixtures to Approval-backed; prefer Approval-backed demo path for new oracles.

### Git intelligence

```text
37518e2 story 4.12  ← Approval lifecycle + slot bridge + gates — build matching on this
5b839a5 story 4.11  ← historical approved quantities
ea232af story 4.10  ← as-of person reconstruction
7bb4f50 story 4.9   ← current person assembler
8de3f2e story 4.8   ← JobTitle capacity; SeniorityChanged deferred — close that deferral here
```

Pattern: capacity mutations stay on slot ledger; product selection becomes Approval-centric; admin surfaces stay on `/headcount`; event forms get picker + panel.

### Latest tech notes

- Industry HRIS position/requisition governance (Workday-style): guardrails before hire, every filled seat ties to an approved pool, exceptions are explicit and audited — aligns with Divan Approval + exemption (not silent overbook).
- Divan MVP uses **pooled Approval units** (not named Position seats). Do not introduce a Position entity.
- Default “oldest valid” is the product-approved tie-break (SPEC 2026-07-16); do not switch to “most specific seniority first” unless Product revises AR-HEADCOUNT.
- Keep Override (negative free) and 14-day expiry warnings out of this story — industry often conflates exemption vs override; Divan separates them (FR-29 vs FR-32).

### Project structure notes

```text
packages/db/sql/
  011_headcount_exemption.sql                 # NEW (confirm next free number)
packages/db/prisma/
  schema.prisma                               # UPDATE — PrimaryAssignment.headcountApprovalId
  migrations/…_primary_headcount_approval/    # NEW
packages/modules/headcount/src/
  index.ts                                    # UPDATE — match API + CapacityCheckResult
  headcount-approval.ts                       # REUSE consumable helpers / candidate query
  headcount-matching.ts                       # NEW (optional split) — match oracles
  headcount-exemption.ts                      # NEW
  headcount-matching.selfcheck.ts             # NEW
  package.json                                # UPDATE — selfcheck script
packages/modules/person-employment/src/
  personnel-event-conflicts.ts                # UPDATE
  personnel-event-start-return.ts             # UPDATE
  personnel-event-transfer.ts                 # UPDATE
  personnel-event-job-level.ts                # UPDATE — SeniorityChanged capacity
  primary-assignment.ts / projectors          # UPDATE — persist headcountApprovalId
apps/web/src/server/
  headcount.ts                                # UPDATE — match list + exemption procedures
apps/web/components/personnel/
  headcount-capacity-panel.tsx                # UPDATE — exempt
  … event forms …                             # UPDATE — Approval picker
apps/web/components/headcount/
  exemption-panel.tsx                         # NEW
_bmad-output/implementation-artifacts/
  deferred-work.md                            # UPDATE
  sprint-status.yaml                          # UPDATE — ready-for-dev
```

### Testing requirements

- Pattern: `tsx` + `node:assert` + real `DATABASE_URL` (Vitest still deferred / open action item).
- Seed DoD: FK-shaped Team + JobTitle + Seniority; ≥2 Approvals for oldest-oracle; one exemption fixture; `$transaction` for fixture writes; exact cardinalities.
- Regression: 4.5 start-return, 4.7 transfer, 4.8 job-level, 4.12 approval, 4.11 historical-org-headcount — green.

### Absolute non-goals

- Override catalogue / negative free / distinct Override rows (4.14)
- 14-day expiry warning / Scheduled-exception state (4.14)
- Durable reserve for Scheduled Start (FR-30 remainder)
- Matching on Grade / Ladder / compensation / contracting entity
- Secondary consumption or Secondary exemptions-as-capacity
- Inventing AR-HEADCOUNT orphan disposition / named seat Position model
- Full dashboard / open-headcount product (5.4) / report catalogue (5.5)
- PopulationPort cutover; import cycle headcount → person-employment
- Weakening FR-16 / append-only / Secondary non-consumption
- UTF-8 BOM on `sprint-status.yaml`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.13–4.14]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-29..FR-32, §8.7]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §6.1–6.2 matching questions]
- [Source: `_bmad-output/specs/spec-divan/SPEC.md` — CAP-7; oldest-compatible freeze]
- [Source: `_bmad-output/specs/spec-divan/launch-artifacts.md` — AR-HEADCOUNT partial freeze]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-6, headcount module]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — headcount-capacity-panel; ظرفیت و جذب]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — UX-DR13 exempt/overridden]
- [Source: `_bmad-output/implementation-artifacts/4-12-headcount-approval-lifecycle.md`]
- [Source: `_bmad-output/implementation-artifacts/4-8-job-level-contract-compensation-change-events.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/modules/headcount/src/index.ts` — `evaluateHeadcountCapacity` / `slotMatchesRefs`]
- [Source: `packages/modules/headcount/src/headcount-approval.ts`]
- [Source: `packages/db/prisma/schema.prisma` — PrimaryAssignment deferred comment]
- [Source: `packages/modules/person-employment/src/personnel-event-conflicts.ts`]
- [Source: `packages/modules/person-employment/src/personnel-event-job-level.ts` — SeniorityChanged deferral]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- start-return selfcheck updated: shortage is blocking `HEADCOUNT_UNAPPROVED` (no Override in 4.13)
- exemption `actor_account_id` / `approver_account_id` as TEXT (InternalAccount cuid)

### Completion Notes List

- Approval-first matching: Team + Job Title + optional Seniority; oldest `validity_start`/`created_at`/`id`; Grade/Ladder ignored on product path
- `preferredApprovalId` + `matchedBy`; legacy `preferredSlotId` bridge for null-approval fixture slots
- `PrimaryAssignment.headcountApprovalId` Prisma column + Operator persistence; Secondary unchanged
- Exemption entity + fail-closed revoke; evaluate `exempt` outcome skips consume/reserve
- SeniorityChanged added to capacity re-eval set; panel exempt + muted overridden foreshadow
- Selfchecks green: matching, approval, start-return, transfer, job-level, historical-org-headcount
- Typecheck green: `@divan/headcount`, `@divan/person-employment`, `web`

### File List

- packages/db/sql/011_headcount_exemption.sql
- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/20260719050000_primary_headcount_approval/migration.sql
- packages/modules/headcount/src/headcount-matching.ts
- packages/modules/headcount/src/headcount-exemption.ts
- packages/modules/headcount/src/headcount-matching.selfcheck.ts
- packages/modules/headcount/src/index.ts
- packages/modules/headcount/package.json
- packages/modules/person-employment/src/primary-assignment.ts
- packages/modules/person-employment/src/personnel-event-conflicts.ts
- packages/modules/person-employment/src/personnel-event-start-return.ts
- packages/modules/person-employment/src/personnel-event-start-return.selfcheck.ts
- packages/modules/person-employment/src/personnel-event-transfer.ts
- packages/modules/person-employment/src/personnel-event-job-level.ts
- packages/modules/person-employment/src/seed.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/src/index.ts
- apps/web/src/server/headcount.ts
- apps/web/src/server/personnel-event.ts
- apps/web/components/personnel/headcount-capacity-panel.tsx
- apps/web/components/personnel/personnel-event-form.tsx
- apps/web/components/headcount/exemption-panel.tsx
- apps/web/app/(app)/headcount/page.tsx
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-13-universal-coverage-matching-exemptions.md

## Change Log

- 2026-07-19: Story 4.13 — Approval-first matching, exemptions, Primary Approval FK, SeniorityChanged capacity, UI/tRPC, selfchecks
- 2026-07-19: Code review patches — reselect audit, fail-closed evaluate, exemption rebind, Transfer/Start UI, revoke verify, BOM

## Story completion status

Status: **done**

Completion note: Code review findings patched — reselection audit/permission, Approval-first fail-closed, exemption rebind, Transfer panel align, UI/selfchecks
