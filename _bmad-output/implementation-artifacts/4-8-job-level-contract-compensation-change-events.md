---
baseline_commit: 1e29400
---

# Story 4.8: Job, Level, Contract & Compensation Change Events

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Operator or Admin,
I want independent effective-dated job/level and contract/compensation change events,
So that prior values remain reconstructable under separate permissions (FR23, FR24).

## Gate (read first)

**This story ships the Job/Level and Contract/Compensation Personnel Event Operators — Primary job-fact close+open for Role/Title/Seniority/Ladder/Grade, and compensation-facts projection close+open for Compensation/Contract — via the existing Draft→Finalize→AD-6 hook. It does not ship current/historical reconstruction products, full Headcount Approval/Matching/Override catalogue, or promotion request/committee workflow.**

| Allowed in 4.8 | Forbidden in 4.8 |
| --- | --- |
| Product event types below (PascalCase past-tense) | Claiming reconstruction (→ 4.9–4.11) or Headcount Approval/Matching/Override catalogue (→ 4.12–4.14) done |
| Wire hook for Effective job-fact Operators → close source Primary + open successor Primary (same Employment + **same Team**) | Any product CRUD `changeGrade` / `changeSalary` / `updateContract` / public mutation outside Draft→Finalize |
| Wire hook for Effective `CompensationChanged` / `ContractChanged` → close prior open fact + `apply*Projection` with `sourceEventId` | Importing Prisma `compensation` client outside `@divan/compensation-facts`; payroll/tax/payslip calc |
| Job Title / Seniority changes re-evaluate headcount compatibility (narrow port); Grade/Role/Ladder-alone do **not** consume/release capacity | Putting Grade or compensation into headcount matching dimensions |
| Ladder–Grade validity on every Grade/Ladder change; no universal Grade↔Seniority mapping | Inventing Grade–Seniority coupling |
| `PromotionRecorded` as **final outcome only** (Grade ± Ladder payload) — no request/committee UI | Building promotion workflow / committee / approval chain |
| Separate fine permissions for compensation/contract finalize (`compensation.write`) + risk tier `compensation_change` | Coarse role alone authorizing compensation writes; inventing full AR-ACCESS toxic matrix |
| Dictionary retention: only enabled FR-24 fields retained; production writers never set `skipDictionaryGate` | Silently enabling religion/health/national-ID categories; inventing open AR-DATA catalogues |
| `personnel-event-form` sectioned fieldsets, Save draft ≠ Finalize, `sensitive-confirmation-dialog` (UX-DR11/14) | Full profile compensation section (→ 5.2) or export panel (→ 6.5) |
| Selfchecks proving FR-23/24 oracles + 4.1–4.7 regressions green | UTF-8 BOM on `sprint-status.yaml`; inventing open AR numbers |

### Mandated design — event path only (non-negotiable)

```text
PersonnelEventDraft (Prisma, mutable)
        │ finalizeDraft (withTransaction) — EXISTING 4.2
        ▼
classifyConflicts → appendBusinessEvent
        │
        ▼
runProjectionRefreshHook({ applyToCurrentProjection: evaluationEffective })
        │
        ├─ Job/level Operator + Effective (ED ≤ asOf at finalize OR evaluation-by-date on recalc)
        │     → close source Primary (endExclusive = ED)
        │     → open successor Primary (startDate = ED; same teamId/employmentId; sourceEventId = event id)
        │     → assertPrimaryCoverageForActiveEmployment  // AFTER close+open only
        │     → if Title or Seniority changed: capacity re-eval / release+consume (narrow port)
        │     → if Grade/Role/Ladder-alone: NO capacity mutate
        │
        ├─ CompensationChanged / ContractChanged + Effective
        │     → close prior open compensation/contractual fact (endExclusive = ED)
        │     → applyCompensationProjection / applyContractualProjection (full snapshot; sourceEventId)
        │     → NEVER skipDictionaryGate in production writers
        │
        ├─ Scheduled (applyToCurrentProjection=false)
        │     → NO Primary / compensation mutation (FR-16)
        │     → Title/Seniority capacity-affecting: durable destination-style reserve ONLY if
        │       matching bucket changes and free unit required (mirror Transfer reserve);
        │       Grade/Role/Ladder/comp/contract Scheduled → record invoked only
        │
        └─ Cancel of Scheduled Title/Seniority with reservation → releaseReservation
```

- **Do not** call projectors from Draft save.
- **Do not** add public job/comp CRUD verbs.
- **Do not** run coverage asserts mid-close.
- **Do not** change `teamId` on these Operators — Team move remains `TransferRecorded` (blocking conflict if payload team ≠ source Primary team).
- Employment stays open; these Operators do not terminate Employment.
- Secondary Assignments: leave untouched unless an explicit conflict requires dispose (prefer leave).

### Mandated design — event type names

| Family | `eventType` string | Notes |
| --- | --- | --- |
| Organizational Role | `OrganizationalRoleChanged` | Updates Role; copy other Primary facts from source |
| Job Title | `JobTitleChanged` | Capacity re-eval required |
| Seniority | `SeniorityChanged` | Capacity re-eval required (optional→set / set→optional / change) |
| Ladder | `LadderChanged` | Must supply Grade valid for new Ladder (or keep Grade only if still valid — else block) |
| Grade | `GradeChanged` | Grade must belong to current (or payload) Ladder; **no** capacity mutate |
| Promotion outcome | `PromotionRecorded` | Taxonomy product type: final Grade (± Ladder) outcome only — same Primary close+open as Grade/Ladder; **no** workflow UI |
| Compensation | `CompensationChanged` | Already foreshadowed in `inferRiskTiers` |
| Contract | `ContractChanged` | Already foreshadowed in `inferRiskTiers` |
| Non-product | `TeamTransferRecorded`, salary CRUD aliases | Keep fail-closed |
| Scaffold / Start / Return / Termination / Transfer | unchanged | Must remain green |

### Mandated design — Effective Date ↔ Primary / fact intervals (half-open)

Active Primary ⇔ `start ≤ D < endExclusive`. Same for compensation facts.

| Effect | Effective Date maps to |
| --- | --- |
| Close source Primary / prior fact | `endDateExclusive = ED` |
| Open successor Primary / new fact | `startDate = ED` |

Example: Grade change ED `2026-04-01` → prior Primary ends exclusive `2026-04-01`; successor starts `2026-04-01`. As-of ED exactly one open Primary.

Use `@divan/temporal-engine` date-only helpers; noon-UTC `dateOnlyToDb` + hybrid `dateOnlyFromDb` (4.6/4.7 lesson). Never `toISOString().slice(0,10)` for PG DATE.

### Mandated design — job/level Primary successor (FR-23)

Resolved successor Primary facts:

1. Start from open source Primary as-of ED (must exist; else blocking).
2. Overlay only the fields this Operator is allowed to change.
3. `teamId` **must equal** source `teamId`.
4. `assertGradeMatchesLadder` on resolved Ladder+Grade.
5. Inactive Role/Title/Ladder/Grade/Seniority as-of ED → blocking (AR-TEMPORAL).
6. No-op when resolved successor ≡ source on all Primary job fields (`teamId`, `organizationalRoleId`, `jobTitleId`, `ladderId`, `gradeId`, `seniorityId`) → blocking `JOB_FACTS_NOOP` (no append, no capacity).

| Operator | Required payload overlay | Capacity |
| --- | --- | --- |
| `OrganizationalRoleChanged` | `organizationalRoleId` | None |
| `JobTitleChanged` | `jobTitleId` | Re-eval Team+Title+optional Seniority |
| `SeniorityChanged` | `seniorityId` (nullable clear allowed) | Re-eval |
| `LadderChanged` | `ladderId` + `gradeId` valid for that Ladder | None (unless bundled Title/Seniority — do not bundle) |
| `GradeChanged` | `gradeId` (+ Ladder from source or payload if needed for validity) | None |
| `PromotionRecorded` | `gradeId` required; `ladderId` optional if changing family | None (Grade/Ladder outcome) |

### Mandated design — headcount on Title/Seniority only (FR-23 / FR-29 foreshadow)

Matching dimensions remain **Team + Job Title + optional Seniority**. Grade, Role, Ladder, compensation never determine matching.

| Outcome | Behavior |
| --- | --- |
| Title/Seniority unchanged vs source | No capacity API calls |
| Title/Seniority change; same matching bucket still compatible with existing consumption | May keep consumption; still validate compatibility (block if incompatible) |
| Title/Seniority change requires different slot / no free unit | Effective: release source consumption + consume new (idempotent on event id) in same txn as Primary close+open; Scheduled: reserve new bucket (mirror Transfer) |
| Port unavailable | Fail closed |
| Override | Only if existing 4.5 Override seam applies — do **not** invent Override catalogue |

Reuse `@divan/headcount` `FOR UPDATE` mutate paths (NFR4). Do not add Title/Seniority types to unconditional `HEADCOUNT_UNAPPROVED` stub — use capacity port set.

### Mandated design — compensation / contract (FR-24 / AD-3)

| Rule | Detail |
| --- | --- |
| Module boundary | `person-employment` may depend on `@divan/compensation-facts` **public** API only (same pattern as `@divan/headcount`). Never import compensation Prisma models in web or person-employment internals. |
| Writers | `closeCompensationProjection` then `applyCompensationProjection` / `applyContractualProjection` |
| Snapshot | `apply*` is **full snapshot replace** — send complete intended fact state ([compensation-facts README](packages/modules/compensation-facts/README.md)) |
| `sourceEventId` | Set to the appended Personnel Event id |
| Dictionary | Production path: `skipDictionaryGate` unset; only Data-Dictionary-enabled fields retained. Selfcheck may promote FR-24 candidate elements to approve+enabled via existing dictionary Admin APIs inside the test txn — do not invent AR-DATA production enablement of unrelated categories |
| Category read omit | Production `compensation` category may remain disabled for profile omit (→ 5.2 / AR-DATA); write path still gated by field enablement |
| Permissions | Finalize of `CompensationChanged` / `ContractChanged` requires `personnel_event.finalize` **and** `compensation.write` (add constant + seed into Admin PermissionSet). Reads stay `compensation.read` where already defined |
| Risk tier | `inferRiskTiers` already maps these types → `compensation_change`. Web finalize MUST pass authorize `riskTiers` config (mirror `TERMINATION_PRODUCT_RISK_TIERS`) or finalize stays `pending_review` |
| Evidence / payload | See **sensitive payload channel** below — never put `amount` / `compensation` / `salary` keys in draft or event payload |
| Promotion workflow | None — `PromotionRecorded` records final outcome only |

### Mandated design — sensitive payload channel (CRITICAL — do not skip)

`createDraft` / `updateDraft` and `appendBusinessEvent` both call `assertNoSensitiveEvidence` on **payload** (and evidence). Forbidden key names (case/underscore-insensitive, recursive walk) include: `amount`, `compensation`, `salary`, `baseSalary`, `nationalId`, …

**Consequence:** `CompensationChanged` cannot carry monetary values inside `PersonnelEventDraft.payload` or the appended business-event payload. Renaming keys to evade the denylist (`monetaryAmount`, `compAmount`, …) is an **anti-pattern — forbidden**.

| Channel | Holds | Lifetime |
| --- | --- | --- |
| Draft / event `payload` | Structural only: `employmentId`, currency **code**, `changeType` code, field presence flags, non-forbidden contractual codes (`contractType`, entities, date-only strings). **No** `amount` / nested objects that embed forbidden keys | Append-only / draft JSON |
| **Sensitive draft sidecar** (required for money) | `amount`, `components`, and any other denylist-blocked values keyed by `draftId` | Created/updated with draft; read + deleted inside finalize AD-6 txn after `apply*Projection` |

**Preferred implementation:** thin table or compensation-facts staging API (`putDraftCompensationValues` / `takeDraftCompensationValues`) owned so web never imports compensation Prisma. Flow:

```text
UI collects amount → sidecar write (same authz as draft)
Draft.payload = structural refs only
finalizeDraft → appendBusinessEvent(structural payload)
  → hook: take sidecar by draftId → close+applyCompensationProjection(full snapshot)
  → delete sidecar (same txn / compensate on failure)
```

`ContractChanged` may keep denylist-safe codes in payload; if any nested JSON would include forbidden keys, use the same sidecar. Never weaken `assertNoSensitiveEvidence` with a type allowlist unless Architecture Spine is explicitly amended.

### Mandated design — conflicts

Before append, `classifyConflicts` MUST:

| Gate | Behavior |
| --- | --- |
| No open Employment / no open Primary (job family) | Blocking |
| Team change attempted on job Operator | Blocking (`USE_TRANSFER`) — redirect to Transfer |
| Missing required overlay / invalid Ladder–Grade | Blocking |
| Inactive refs as-of ED | Blocking |
| Job facts no-op | Blocking `JOB_FACTS_NOOP` |
| Title/Seniority capacity incompatible | Blocking `HEADCOUNT_CAPACITY_MISSING` (Override seam only if already exists) |
| Compensation/contract without `compensation.write` | Blocking / authz deny |
| Dictionary field not enabled for supplied value keys | Blocking (`FIELD_NOT_ENABLED`) |
| Incompatible future Scheduled peers | Blocking `INCOMPATIBLE_FUTURE_EVENTS` — peer Scheduled job/comp on same Employment/Person that collide; **explicit Cancel dispose** only |
| `PromotionRecorded` without grade outcome | Blocking |

### Mandated design — UI (UX-DR11 / UX-DR14)

Extend `personnel-event-form`:

1. Add event-type options (Persian labels) for all product types above.
2. Sectioned fieldsets per family (job facts vs compensation vs contract) — max-w-4xl sectioned layout.
3. Show current Primary job summary before change (mirror Transfer source summary).
4. For Title/Seniority: embed `headcount-capacity-panel` when capacity re-eval applies (UX-DR13 reuse).
5. Compensation/contract fields: only render dictionary-enabled inputs; sensitive confirm dialog on Finalize.
6. Jalali date picker; Save draft ≠ Finalize; gold Finalize disabled on recalc pending (UX-DR5).
7. Permissions: draft/finalize + `compensation.write` for comp/contract types.
8. Interactive a11y: focus order, error association, confirm dialog.

Full timeline product remains Epic 5.3 — foreshadow list/badges only.

### Mandated design — evaluation-by-date apply

Reuse 4.7 recalc rule: `applyToCurrentProjection` from `evaluationStatusAsOf(event, asOfDate) === "Effective"`, not storage status alone. Storage may remain `Scheduled` after ED.

[Source: `epics.md` Story 4.8; `prd.md` FR-23, FR-24; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6 + PromotionRecorded taxonomy; Stories 4.5–4.7; UX-DR5/11/13/14; compensation-facts README]

## Acceptance Criteria

1. **Given** permitted job/level event types and an active Primary Assignment  
   **When** Organizational Role, Job Title, Seniority, Ladder, or Grade changes are finalized as Effective  
   **Then** Grade remains valid for Ladder; successor Primary is opened with prior Primary closed at ED; prior values remain reconstructable via append-only events + projections

2. **And** Job Title or Seniority changes re-evaluate headcount compatibility; Grade alone (and Role/Ladder-alone) does not consume or release capacity

3. **Given** permitted contract/compensation event types and the compensation-facts module  
   **When** contractual or compensation changes are finalized as Effective  
   **Then** only Data-Dictionary-approved (enabled) fields are retained; writes go through `@divan/compensation-facts` public projection APIs with `sourceEventId`; separate `compensation.write` permission applies; monetary values travel via **sensitive draft sidecar** (never as `amount`/`compensation`/`salary` keys in draft or event payload)

4. **And** promotion is recorded as final outcome only (`PromotionRecorded` / Grade outcome) — no request/committee workflow UI

5. **And** `personnel-event-form` uses sectioned layout, Save draft vs Finalize, and `sensitive-confirmation-dialog` when required (UX-DR11, UX-DR14)

6. **And** Scheduled finalize does not mutate current Primary or compensation projections (FR-16); Title/Seniority Scheduled may reserve capacity when matching bucket changes; Cancel releases that reservation

7. **And** Stories 4.1–4.7 invariants remain green; this story does **not** deliver reconstruction products (4.9–4.11) or full Headcount Approval/Matching/Override catalogue (4.12–4.14)

## Tasks / Subtasks

- [x] Task 1: Domain event types + Draft/finalize catalogue (AC: #1, #3, #4, #7)
  - [x] Register product types: `OrganizationalRoleChanged`, `JobTitleChanged`, `SeniorityChanged`, `LadderChanged`, `GradeChanged`, `PromotionRecorded`, `CompensationChanged`, `ContractChanged`
  - [x] Payload parsers: structural refs only; **sensitive draft sidecar** for amount/components (see mandated channel) — prove `assertNoSensitiveEvidence` still rejects `amount` in draft/event payload
  - [x] Reject team change on job Operators; keep Scaffold / Start / Return / Termination / Transfer green
  - [x] Add `@divan/compensation-facts` dependency to `person-employment` (public API only)

- [x] Task 2: Projection hook — job Primary successor + comp/contract apply (AC: #1, #2, #3, #6, #7)
  - [x] New `personnel-event-job-level.ts` (parse + apply + compensate) + `personnel-event-compensation.ts` (or single file with clear sections)
  - [x] Effective job path: close+open Primary in one Prisma txn; coverage after; compensate flags accurate
  - [x] Effective comp/contract: **take sidecar** → close prior open fact → apply full snapshot with `sourceEventId` → clear sidecar; compensate on failure (restore sidecar or leave compensate-safe)
  - [x] Scheduled: no Primary/comp mutation; Title/Seniority reserve when needed; Cancel releases; Cancel/delete Draft clears sidecar
  - [x] Wire branches in `personnel-event-projection-hook.ts`; Reverse undo where Transfer pattern applies
  - [x] Recalc: keep `evaluationStatusAsOf` apply flag; skip neutralized Cancel/Reverse children; **recalc must not require sidecar** (values already in compensation projections via `sourceEventId`)

- [x] Task 3: Conflicts + headcount port (AC: #1, #2, #6, #7)
  - [x] Ladder–Grade, inactive refs, no-op, USE_TRANSFER, incompatible future peers
  - [x] Title/Seniority → capacity port (not `HEADCOUNT_UNAPPROVED` stub); Grade/Role/Ladder excluded from consuming sets
  - [x] Dictionary / `compensation.write` gates for comp/contract

- [x] Task 4: Permissions + risk tier (AC: #3, #4)
  - [x] Add `compensation.write` constant + `assertActorHasCompensationWrite`; seed Admin PermissionSet
  - [x] Web finalize: `COMPENSATION_PRODUCT_RISK_TIERS` (mirror Termination) for Comp/Contract types
  - [x] Do not invent full AR-ACCESS matrix

- [x] Task 5: UI / tRPC (AC: #5, #6)
  - [x] Extend form options + sectioned fieldsets + current Primary summary
  - [x] Capacity panel for Title/Seniority; sensitive confirm; Save ≠ Finalize
  - [x] Surface conflicts in Persian; a11y DoD (focus, errors, dialog)

- [x] Task 6: Selfchecks + DoD (AC: #1–#7)
  - [x] `personnel-event-job-level.selfcheck.ts` + `personnel-event-compensation.selfcheck.ts` (or combined) with exact cardinality oracles
  - [x] Prove: Grade-only no capacity mutate; Title change re-eval; Ladder–Grade block; no-op; Scheduled FR-16; evaluation-by-date apply
  - [x] Prove: Compensation/Contract close+open with `sourceEventId`; dictionary gate; permission deny without `compensation.write`; risk tier pending without config
  - [x] Prove: draft/event payload with key `amount` is rejected; happy path uses sidecar → projection has amount; event payload has no forbidden keys
  - [x] Prove: `PromotionRecorded` final outcome only; retry/recalc idempotent
  - [x] Re-run event-store, draft, lifecycle, ordering, recalc, start-return, termination, transfer, workers — all green
  - [x] Update `deferred-work.md`; align story Status ↔ `sprint-status.yaml`; **no UTF-8 BOM**

### Review Findings

- [x] [Review][Decision] Seniority-only capacity churn vs headcount match dimensions — resolved **B**: Title-only capacity; Seniority Primary-only until AR-HEADCOUNT
- [x] [Review][Decision] SeniorityChanged empty field = clear — resolved **B**: explicit clear checkbox; omit key when untouched

- [x] [Review][Patch] Scheduled→Effective compensation loses sidecar amount — `resolveCompensationSource` sets `draftId: null` on event path and ignores `payload.draftId` written at finalize; Scheduled hook never takes sidecar [`personnel-event-compensation.ts`:152]
- [x] [Review][Patch] Reverse of Effective Compensation/Contract has no undo — hook reverse only undoes Transfer/Job-level [`personnel-event-projection-hook.ts`:227]
- [x] [Review][Patch] `compensateCompensationApply` touches Prisma `compensationFact` inside person-employment (AD-3) [`personnel-event-compensation.ts`:414]
- [x] [Review][Patch] Scheduled Title/Seniority reservation not released on post-hook finalize failure — compensate gated by `!reservedOnly` [`personnel-event-finalize.ts`:858]
- [x] [Review][Patch] Idempotent re-apply sets `didMoveDest=true` after no-op `consumeHeadcountCapacity` → false capacity undo on later failure [`personnel-event-job-level.ts`:649]
- [x] [Review][Patch] `FIELD_NOT_ENABLED` not classified before append — only fails inside `applyCompensationProjection` after event append [`personnel-event-conflicts.ts`:1047]
- [x] [Review][Patch] Comp/Contract form does not filter to dictionary-enabled inputs (AC#5 / UI#5) [`personnel-event-form.tsx`]
- [x] [Review][Patch] Capacity panel for SeniorityChanged omits source Primary `jobTitleId` [`personnel-event-form.tsx`:202]
- [x] [Review][Patch] `putCompensationSidecar` lacks editable-status guard (`assertEditable`) [`personnel-event.ts`:252]
- [x] [Review][Patch] Cancel of Scheduled Comp/Contract does not clear orphan sidecar (cancel hook has no draft) [`personnel-event-projection-hook.ts`:178]
- [x] [Review][Patch] `draftDelete` clears sidecar after draft delete (orphan if clear fails) [`personnel-event.ts`]
- [x] [Review][Patch] `parseCompensationPayload` requires `payload.employmentId` even when draft column has employment [`personnel-event-compensation.ts`:83]
- [x] [Review][Patch] Sidecar `amount` accepts non-numeric strings (`z.string().min(1)` only) [`personnel-event.ts`:257]

- [x] [Review][Defer] AD-6 Prisma projectors vs PoolClient finalize txn — deferred, pre-existing
- [x] [Review][Defer] IDOR on `putCompensationSidecar` (no draft ownership/person-scope) — deferred, pre-existing list/get pattern

## Dev Notes

### Current code state (READ BEFORE CODING)

| Area | Path | Today | 4.8 change |
| --- | --- | --- | --- |
| Projection hook | `packages/modules/person-employment/src/personnel-event-projection-hook.ts` | Start/Return/Termination/Transfer; comment “job-comp — later” | **Wire** job-level + compensation branches + compensate |
| Conflicts | `personnel-event-conflicts.ts` | Capacity port for Start/Return/Transfer; other consuming → stub | Title/Seniority port; job/comp gates; peers |
| Finalize | `personnel-event-finalize.ts` | `inferRiskTiers` already lists `CompensationChanged` / `ContractChanged` | VERIFY compensate wiring; web risk config |
| Recalc | `personnel-event-recalc.ts` | `evaluationStatusAsOf` apply (4.7) | Reuse; include new Operators in apply set / neutralization skip |
| Lifecycle Cancel | `personnel-event-lifecycle.ts` | Transfer reservation release | Release Title/Seniority reservation if added |
| Primary writers | `primary-assignment.ts` | `applyPrimaryAssignmentProjection` / `closePrimaryAssignmentProjection` | Call from job-level apply only |
| Compensation | `packages/modules/compensation-facts/src/compensation.ts` | Projection writers + reads; dictionary gate; `skipDictionaryGate` seed-only | **Call** from hook; never product CRUD |
| Form | `apps/web/components/personnel/personnel-event-form.tsx` | Scaffold/Start/Return/Termination/Transfer | Add job/comp fieldsets |
| tRPC | `apps/web/src/server/personnel-event.ts` | Draft/finalize/lifecycle; Termination risk tiers | Comp risk tiers + permission checks |
| Dictionary candidates | `data-dictionary-types.ts` | Compensation/contract elements `disposition: later` | Selfcheck promote enablement; production AR-DATA still owns catalogue |

### What must be preserved

- Append-only kernel event-store; Cancel/Reverse/Correction via lifecycle only
- FR-16: Scheduled must not mutate **current** Primary/compensation projections (reserve ≠ Primary mutation)
- Half-open intervals; Asia/Tehran date-only; noon-UTC DB binding
- Start/Return/Termination/Transfer Operators and capacity idempotency
- ALS projection hook (not module-global production hook)
- Evidence **and** draft/event payload without forbidden sensitive keys (`assertNoSensitiveEvidence` unchanged)
- AD-3 compensation schema isolation; monetary values only in compensation projections (+ transient sidecar)
- No UTF-8 BOM on `sprint-status.yaml`

### Architecture compliance

- **AD-2:** SoT = append-only business events; Primary/compensation rows = projections
- **AD-3:** Kernel owns event-store / temporal-engine / audit-envelope; compensation-facts owns `compensation` schema
- **AD-5:** Envelope + fine permissions; compensation writes separately permissioned
- **AD-6:** Critical current refresh in same txn as append; compensate on Prisma vs PoolClient mismatch; heavy historical via recalc + pending UI
- **Naming:** PascalCase past-tense; `PromotionRecorded` = final outcome taxonomy (no workflow)
- **Module boundary:** published APIs only; web never imports Prisma for compensation

### AR / fail-closed (do not invent)

| Artifact | Rule for 4.8 |
| --- | --- |
| AR-TEMPORAL | Inactive refs as-of ED block; exclusive ends; evaluation-by-date; pre-Baseline disposition unchanged |
| AR-HEADCOUNT | Narrow Title/Seniority re-eval / reserve/consume only; no Approval/Matching/Override catalogue |
| AR-DATA | Retain only dictionary-enabled FR-24 fields; do not invent enablement of religion/health/national-ID; production category masking still open |
| AR-ACCESS | Minimal `compensation_change` risk-tier config + `compensation.write`; no toxic matrix invention |
| AR-SECONDARY | Do not invent Secondary job-change product |
| AR-IDENTITY | Person untouched; PopulationPort cutover criteria only — do not execute cutover |

### Previous story intelligence (4.5–4.7)

- Pattern: `personnel-event-{domain}.ts` + hook branch + conflicts + selfcheck + form fieldset
- Capacity APIs idempotent on `event_id` / `release_event_id` — Title/Seniority move must be too
- AD-6 Prisma projector vs `PoolClient` finalize → **compensate** on post-hook failure (mandatory)
- Coverage asserts **after** combined close+open — mid-window zero Primaries forbidden (wrap in one Prisma `$transaction`)
- Transfer must not be reused for same-team job changes; Termination must not run on these paths
- Review lessons from 4.7: accurate `did*` flags only when mutation occurred; recalc skip neutralized children; no-op before reserve; capacity fail-closed if release without consume; noon-UTC dates; no BOM
- Compensation README: full snapshot replace — do not partial-patch open facts in place for history; close+open intervals
- **Payload denylist:** `assertNoSensitiveEvidence` walks draft + event payload — amounts cannot live there; sidecar is mandatory for money (code-analysis follow-up)
- Deferred stay deferred: single-connection projector SQL; Vitest isolation; PopulationPort cutover; full FR-30 Start reserve

### Git intelligence

Recent commits: `1e29400` story 4.7 → `669c8a8` story 4.6 → `fe658a6` story 4.5 → `752d64f` story 4.4.

Continue: tsx selfchecks, governed tRPC, raw SQL kernel + headcount port, Prisma projections, Persian `messageFa`, thin module dependency on `@divan/compensation-facts`.

### Latest tech notes

- **Concurrency:** Reuse existing headcount `SELECT … FOR UPDATE` on slot mutate (not `SKIP LOCKED` — that pattern is for queue workers claiming distinct rows; capacity last-unit needs blocking lock so the second txn waits or fails closed).
- **Half-open intervals:** Do not switch to inclusive-end BETWEEN.
- **pg-boss:** Reuse existing recalc queue — no second queue for job/comp.
- **Dictionary:** Prefer selfcheck-local promote of FR-24 elements over shipping a silent production enable-all.

### Project structure notes

```text
packages/modules/person-employment/src/
  personnel-event-job-level.ts                 # NEW — job/level Operators
  personnel-event-job-level.selfcheck.ts       # NEW
  personnel-event-compensation.ts              # NEW — Compensation/Contract Operators + sidecar take
  personnel-event-compensation.selfcheck.ts    # NEW
  personnel-event-projection-hook.ts           # UPDATE
  personnel-event-conflicts.ts                 # UPDATE
  personnel-event-finalize.ts                  # VERIFY compensate
  personnel-event-lifecycle.ts                 # UPDATE — reserve release if needed
  personnel-event-recalc.ts                    # VERIFY apply set
  errors.ts / permissions.ts / seed.ts         # UPDATE — compensation.write
  package.json                                 # UPDATE — depend on @divan/compensation-facts
packages/modules/compensation-facts/           # UPDATE — optional draft-sidecar API OR
packages/db/sql/ or prisma/                    # NEW — draft_sensitive / staging table if needed
apps/web/src/server/personnel-event.ts         # UPDATE — risk tiers + perms + sidecar write on draft
apps/web/components/personnel/
  personnel-event-form.tsx                     # UPDATE — fieldsets (amount → sidecar path)
```

### Testing requirements

- Pattern: `tsx` + `node:assert` + real `DATABASE_URL` (Vitest still deferred).
- Exact cardinality: N finalize retries → one event; one Primary successor per Effective job event; one compensation interval open as-of ED; capacity move once per event id.
- Matrix: Grade-only no capacity; Title re-eval; Ladder–Grade invalid block; no-op; Scheduled FR-16; evaluation-by-date; Compensation dictionary gate; permission deny; risk pending; PromotionRecorded outcome; Start/Return/Termination/Transfer regression.
- Regression: `@divan/event-store`, draft, lifecycle, ordering, recalc, start-return, termination, transfer, workers, compensation-facts selfcheck.
- Seed DoD: FK-shaped fixtures (open Employment+Primary; dictionary promote in selfcheck); `$transaction` / `withTransaction`; exact counts.

### Absolute non-goals

- Current/historical Person or org reconstruction products (4.9–4.11)
- Full Headcount Approval / Matching / Reservation-expiry / Override catalogue UI (4.12–4.14)
- Promotion request/committee workflow
- PopulationPort cutover execution; IDOR hardening on list/get (unless explicitly pulled)
- Profile compensation section (5.2); governed export panel (6.5)
- Auto-Cancel of future events inside finalize
- Public job/comp CRUD / mid-close coverage asserts
- Weakening append-only / Scheduled discipline / 4.5–4.7 behaviors
- Inventing open AR numbers; enabling reject-disposition dictionary elements
- Evading `assertNoSensitiveEvidence` via renamed payload keys; weakening the denylist without Architecture amendment

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.8]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-23, FR-24]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-5, AD-6, PromotionRecorded]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — personnel-event-form, sensitive-confirmation-dialog]
- [Source: `_bmad-output/implementation-artifacts/4-7-team-transfer-with-atomic-capacity-movement.md` — Transfer pattern + review patches]
- [Source: `_bmad-output/implementation-artifacts/4-6-termination-events.md` — close/release + risk tiers]
- [Source: `_bmad-output/implementation-artifacts/4-5-start-return-events.md` — open/consume]
- [Source: `_bmad-output/implementation-artifacts/3-4-compensation-contractual-facts-module.md` — projection writers handoff]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/modules/compensation-facts/README.md` — full snapshot + boundary]
- [Source: `packages/modules/person-employment/src/personnel-event-projection-hook.ts`]
- [Source: `packages/modules/person-employment/src/personnel-event-finalize.ts` — `inferRiskTiers`]
- [Source: `packages/modules/headcount/src/index.ts` — reserve/consume/release port]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- job-level selfcheck initially raced shared seedDemoHeadcountCapacity free units under parallel run; fixed with dedicated seedCapacitySlot.

### Completion Notes List

- Implemented job/level Operators (Role/Title/Seniority/Ladder/Grade/PromotionRecorded) with same-team Primary close+open, Title/Seniority capacity port, USE_TRANSFER / JOB_FACTS_NOOP / Ladder–Grade gates.
- Implemented CompensationChanged/ContractChanged via compensation-facts public APIs + draft sensitive sidecar (put/	ake/clear); compensation.write + product risk tiers; amounts never in draft/event payload.
- Wired projection hook (Scheduled reserve, Cancel release, Reverse undo, compensate), conflicts, lifecycle Cancel exception, web form fieldsets + tRPC sidecar/risk tiers.
- Selfchecks green: job-level, compensation, transfer, termination, start-return, draft, lifecycle, compensation-facts.
- Status aligned to review in story + sprint-status.yaml (no UTF-8 BOM).

### File List

- packages/db/sql/009_compensation_draft_sidecar.sql
- packages/modules/compensation-facts/src/draft-sidecar.ts
- packages/modules/compensation-facts/src/index.ts
- packages/modules/person-employment/package.json
- packages/modules/person-employment/src/personnel-event-job-level.ts
- packages/modules/person-employment/src/personnel-event-job-level.selfcheck.ts
- packages/modules/person-employment/src/personnel-event-compensation.ts
- packages/modules/person-employment/src/personnel-event-compensation.selfcheck.ts
- packages/modules/person-employment/src/personnel-event-projection-hook.ts
- packages/modules/person-employment/src/personnel-event-conflicts.ts
- packages/modules/person-employment/src/personnel-event-finalize.ts
- packages/modules/person-employment/src/personnel-event-lifecycle.ts
- packages/modules/person-employment/src/errors.ts
- packages/modules/person-employment/src/permissions.ts
- packages/modules/person-employment/src/seed.ts
- packages/modules/person-employment/src/index.ts
- apps/web/package.json
- apps/web/src/server/personnel-event.ts
- apps/web/components/personnel/personnel-event-form.tsx
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-8-job-level-contract-compensation-change-events.md

### Change Log

- 2026-07-18: Story 4.8 implementation — job/level + compensation/contract Operators, sidecar, permissions, UI, selfchecks; status → review.

## Story completion status

Status: **done**

Completion note: Code review patches applied (Decision B×2 + 13 patches); deferred AD-6/IDOR unchanged; selfchecks green.
