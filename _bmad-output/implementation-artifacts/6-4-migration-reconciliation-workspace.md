---
baseline_commit: ffbb9b3
---

# Story 6.4: Migration Reconciliation Workspace

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As Migration Lead and HR Data Owner,
I want signed reconciliation of people, Employments, Assignments, events, totals, and headcount,
so that production cutover cannot proceed with unresolved critical defects (FR40, LG-1).

**Story key:** `6-4-migration-reconciliation-workspace`  
**Epic:** 6 — Migration, Baseline & Governed Export (FR37–41, FR52)  
**Prerequisite:** Stories 6.1–6.3 done — wizard + durable staging + SoD approve/execute + atomic trial cutover + Import Batch evidence + Baseline/imported/native provenance UX. Production cutover today is **fail-closed** via stub `reconciliationEvidenceToken` in `executeImportBatch` (web router never passes a token). This story replaces that stub with a real signed reconciliation workspace and gate.

## Acceptance Criteria

1. **Given** trial or production-candidate Import Batches with durable staging/evidence from 6.2  
   **When** an authorized actor runs reconciliation  
   **Then** the system compares (at minimum the FR-40 / addendum §7.3 package domains) against **owner-attested signed controls**: Person, Employment, Assignment, Personnel Event, current state, Team totals, reference mappings, headcount, duplicates, orphans, and approved control totals — each domain visible as a structured comparison row/group (observed vs control, status)

2. **And** every discrepancy has an **owner** and an **accepted disposition** before it can leave an open/critical state; dispositions are attributable (actor, time, rationale) and durable with the reconciliation run

3. **And** **production** cutover (`cutoverTier: "production"`) is **blocked** unless:
   - reconciliation evidence exists for that batch (or explicitly linked run),
   - required owner signatures are present (Migration Lead + HR Data Owner — provisional SoD, code-marked),
   - **zero unresolved critical** integrity defects remain (LG-1 categories: duplicate, orphan, temporal, Assignment, headcount, control-total at minimum)

4. **And** the 6.2 stub gate is upgraded: **no client-supplied free-string token** may unlock production. Domain must **verify** persisted signed reconciliation evidence (id / hash / status) server-side; arbitrary `reconciliationEvidenceToken` strings are rejected

5. **And** trial / staging tiers remain usable for rehearsal without claiming LG-1 production readiness; UI must not present an unsigned or incomplete reconciliation as “آمادهٔ تولید”

6. **And** workspace UX is Persian RTL on `/import` (advanced migration surface — not day-to-day ورود گروهی): GovernedDataTable or existing table primitives, toolbar CTAs, Persian digits for counts, Jalali timestamps where dates shown, UX-DR24 voice (fact + next step). Single dialog depth (Sheet + one Dialog max). Leave-guard: dirty = open reconciliation edits / unsigned in-progress run — Dialog `open` ≠ dirty

7. **And** AR-MIGRATION / AR-CUTOVER / AR-ACCESS / AR-DATA remain **fail-closed**:
   - **Do not invent** numeric tolerances, merge/split/Personnel Code correction matrices, or a fake “signed” AR freeze
   - Missing attested control for a required domain → that domain is **blocking / unresolved** for production (exact-match against attested control when a control is supplied; absence of required control = fail closed)
   - Provisional permission keys OK if code-marked + seeded + fail-closed (same pattern as `migration.approve` / `migration.execute`)

8. **And** this story does **not** own: governed export / artifact reauth / custody (→ **6.5**); rewriting staging DDL / cutover TX shape beyond the production gate hook; PE projector bootstrap for `BaselineRecorded` → Employment/Assignment (document honesty if counts expose the gap); PopulationPort full registry cutover; AD-6 Prisma↔PoolClient orphan fix

9. **And** Import Batch report honesty preserved: `import_batch_outcomes` remains evidence-backed or unavailable — never fabricate from preview or from unsigned reconciliation drafts

10. **And** `source=migration` remains audit metadata only — never an authz or cutover unlock (6.3 contract preserved)

## Tasks / Subtasks

- [x] Task 1: Reconciliation persistence + domain model (AC: #1–#4, #7)
  - [x] NEW `packages/db/sql/014_migration_reconciliation.sql` (next after `013_migration_staging.sql`) — prefer schema `migration_staging` (or dedicated `migration_reconciliation` if cleaner; document choice). Tables for:
    - **reconciliation_run** — id, batch_id FK, tier (`trial`|`final`/`production-candidate`), status (`draft`|`in-progress`|`signed`|`rejected`|`superseded`), correlation_id, source_extract_version / notes, created_by/at, frozen_at
    - **reconciliation_control** — run_id, domain_key (enum/text from package list), control_value (JSONB numeric/string/object), attested_by, attested_at, label_fa
    - **reconciliation_observation** — run_id, domain_key, observed_value (JSONB), computed_at, computation_notes (refs only — no sensitive dumps)
    - **reconciliation_discrepancy** — run_id, domain_key, severity (`critical`|`warning`), status (`open`|`accepted`|`waived`|`resolved`), owner_account_id, owner_display, disposition_code, disposition_rationale_fa, disposition_by/at; optional waiver fields aligned to FR-55 minimum (independent_approver, scope, risk, compensating_control, expiry) when disposition=`waived`
    - **reconciliation_signature** — run_id, role_code (`migration_lead`|`hr_data_owner`), signer_account_id, signed_at, evidence_hash (hash over frozen run controls+observations+discrepancy dispositions)
  - [x] Follow `packages/db/sql/README.md` (`IF NOT EXISTS`, idempotent). Raw SQL via `pg` Pool/PoolClient — **not** Prisma (AD-6)
  - [x] NEW domain modules under `packages/modules/migration/src/`:
    - `reconciliation.ts` — create/run/compare/disposition/sign/verifyProductionGate pure+orchestrated APIs
    - `reconciliation-repo.ts` — persistence
    - Optional `reconciliation-domains.ts` — canonical domain_key list matching FR-40 + addendum §7.3
  - [x] **Observed values:** compute what can be computed honestly from published module APIs + batch evidence (Person/event counts from evidence; staging row counts; duplicate Personnel Codes already detected in validators). For domains not yet projectable (e.g. Employment/Assignment if Baseline projector gap remains): mark observation as `unavailable` / honesty status — **do not invent zeros**; unavailable required domain blocks production until waived under FR-55-shaped waiver **or** AR provides oracle (prefer block + Persian honesty)
  - [x] **Controls:** owner-attested inputs (uploaded/entered), not locally invented formulas. Document that AR-MIGRATION oracle/tolerances are pending — default = exact equality when control present; no silent ±N
  - [x] **Critical taxonomy (provisional, code-marked):** map LG-1 integrity classes — duplicate, orphan, temporal, assignment, headcount, control_total — to `severity: critical` when mismatched/open. Warnings allowed for non-critical completeness gaps if clearly labeled; critical cannot be “accepted” away without waiver fields + independent approver (FR-55 shape) **or** fixing observed state and re-running
  - [x] Export from `packages/modules/migration/src/index.ts`
  - [x] Extend `MigrationErrorCode` with e.g. `RECONCILIATION_REQUIRED`, `RECONCILIATION_INCOMPLETE`, `RECONCILIATION_UNSIGNED`, `CRITICAL_DEFECT_OPEN`, `RECONCILIATION_STALE`, `DISPOSITION_REQUIRED`, `SIGNATURE_INVALID`, `CONTROL_MISSING` — always `messageFa`

- [x] Task 2: Wire production cutover gate (AC: #3–#5, #10)
  - [x] UPDATE `packages/modules/migration/src/execute-batch.ts`:
    - Replace blank-string stub with `assertProductionReconciliationGate(pool, { batchId, reconciliationRunId })` (or equivalent)
    - Production requires: run linked to batch, status=`signed`, both required signatures, evidence_hash matches frozen snapshot, zero `critical`+`open` discrepancies, no required domain `CONTROL_MISSING` / unresolved
    - **Reject** client-only opaque tokens that are not ids of verified runs
    - Prefer renaming option from `reconciliationEvidenceToken` → `reconciliationRunId` (breaking OK inside monorepo; update callers). If keeping token name temporarily, it MUST be the run UUID verified in DB — never “any non-empty string”
  - [x] UPDATE `apps/web/src/server/migration.ts` `executeBatch` input: accept optional `reconciliationRunId` + `cutoverTier`; pass through to domain; production without valid run → mapped Persian error (not infra leak)
  - [x] Trial/staging: may execute without signed final reconciliation (existing 6.2 behavior) **or** optionally attach a trial run — document. UI must still allow rehearsal reconciliation without unlocking production greenwash
  - [x] Preserve: SoD approve≠execute, mutex, revalidation, atomic TX, idempotency, evidence persistence, PopulationPort omit on reveal

- [x] Task 3: Governed tRPC + permissions (AC: #2–#3, #6–#7)
  - [x] UPDATE `apps/web/src/server/migration.ts` — procedures (names flexible):
    - `getReconciliation` / `listReconciliationRuns`
    - `createReconciliationRun` / `runReconciliationCompare` (compute observations vs controls)
    - `upsertReconciliationControls` (attest control values)
    - `setDiscrepancyDisposition`
    - `signReconciliation` (role-specific; second signer cannot be same account if segregation on — mirror execute SoD spirit)
    - Keep `mapMigrationError`; never leak `error.message`
  - [x] **Provisional permissions** (code-marked, AR-ACCESS/AR-MIGRATION pending):
    - Prefer new keys e.g. `migration.reconcile` (run/compare/disposition) and `migration.sign` (signatures) **or** reuse `migration.approve` for one signer role + distinct key for the other — document in Dev Agent Record
    - Seed via `seed-sod.ts` / audit-envelope catalog pattern used in 6.2; fail-closed for unseeded roles
    - Do **not** edit frozen `navigation.ts` ROLE matrices “for cleanliness”; `/import` already `hr_admin`
  - [x] Layout≠RSC: any RSC fetch still `assertPageAccess` before load
  - [x] AD-3: no cross-module internal table reads; headcount/PE counts via published APIs only
  - [x] Register new permission strings in audit-envelope catalog if that is the house pattern for 6.2 keys

- [x] Task 4: Reconciliation workspace UI (AC: #1–#2, #5–#6)
  - [x] NEW `apps/web/components/import/migration-reconciliation-workspace.tsx` (and small children if needed) — mount from `import-wizard.tsx` post-approve / post-trial-execute **or** as a sibling panel on `/import` keyed by `batchId`
  - [x] Surfaces:
    - Domain comparison table (control vs observed vs status)
    - Discrepancy list with owner + disposition controls
    - Signature panel (two roles) with Jalali/Persian digit timestamps
    - Clear production-block banner when gate fails (why: unsigned / critical open / missing control) — `role="alert"` where blocking
  - [x] Reuse `GovernedDataTable` if it fits; otherwise existing table/toolbar patterns — **no new card chrome spam**, no floating badges
  - [x] Production execute CTA: only enabled when domain `verifyProductionGate` would pass; still use `SensitiveConfirmationDialog` for execute; single dialog depth
  - [x] All copy in `apps/web/lib/operational-copy.ts` (+ domain `messageFa`) — no hardcoded ceremonial Persian
  - [x] Preserve 6.3 wizard success honesty (Baseline / boundary / metadata≠control); add reconciliation status lines without payload dumps

- [x] Task 5: Verify + DoD (AC: #1–#10)
  - [x] NEW `@divan/migration` script e.g. `selfcheck:reconciliation` — cover:
    - production execute without signed run → deny
    - signed run with open critical → deny
    - missing required control → deny
    - stale hash after control edit without re-sign → deny
    - happy path: attested controls + matching observations + dispositions + dual signatures → gate passes (may stub execute behind gate unit without full cutover if DB unavailable — prefer full path when PG up)
    - trial execute still allowed without production signatures
  - [x] UPDATE `import-batch.selfcheck.ts` production stub test to use real gate (or keep one assertion that empty token/run fails)
  - [x] UPDATE `apps/web/src/server/migration.selfcheck.ts` for new copy keys / procedure surface smoke
  - [x] `pnpm --filter @divan/migration` + `@divan/web` typecheck; eslint on touched files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits

### Manual DoD checklist

- [x] Reconciliation run can be created for an approved/executed trial batch
- [x] All FR-40 domain slots appear; controls can be attested; observations computed or honestly `unavailable`
- [x] Discrepancy requires owner + disposition; critical open blocks production
- [x] Dual signatures required; same-actor dual-sign blocked when segregation on (if implemented)
- [x] Web production execute without valid run id → Persian block (not unlock via random string)
- [x] Valid signed zero-critical run unlocks production gate only for that batch
- [x] Editing controls after sign invalidates signatures / requires re-sign (stale hash)
- [x] Trial path still works; UI does not claim production ready when unsigned
- [x] `source=migration` not used as gate; SoD approve≠execute preserved
- [x] Import Batch report never fabricated from reconciliation drafts
- [x] Under-permissioned viewer: omit/PopulationPort honesty preserved on any person-linked reveals
- [x] No Prisma in web; AD-3/AD-4 held; single dialog depth; leave-guard rules held
- [x] Sprint/story must **not** claim FR-41/FR-52 export done or AR-MIGRATION freeze complete

### Review Findings

- [x] [Review][Decision] Bind signature roles to accounts — resolved: keep provisional (any `migration.sign` holder may pick either role; same-account dual-sign blocked). Role↔account binding deferred to AR-ACCESS / real SoD.
- [x] [Review][Patch] Hard-block production when required domain observation is `unavailable` — even FR-55 waiver must not unlock production cutover until observation is computable or AR oracle exists (open Q default: no) [packages/modules/migration/src/reconciliation.ts:661]
- [x] [Review][Patch] Fabricated FR-55 independentApprover in UI (`${owner}-independent` + fixed scope/risk/control) [apps/web/components/import/migration-reconciliation-workspace.tsx:234]
- [x] [Review][Patch] Attest-controls rubber-stamps observedValue / `{ count: 0 }` when draft JSON empty [apps/web/components/import/migration-reconciliation-workspace.tsx:185]
- [x] [Review][Patch] Gate/sign treat any non-`open` disposition as closing unavailable domains; normative text requires closed **waiver** [packages/modules/migration/src/reconciliation.ts:661]
- [x] [Review][Patch] Critical `resolved` allowed without re-match after fix or FR-55 waiver [packages/modules/migration/src/reconciliation.ts:573]
- [x] [Review][Patch] Orphans observation invents `{ count: 0 }` instead of honest `unavailable` [packages/modules/migration/src/reconciliation.ts:199]
- [x] [Review][Patch] Production gate ignores `waiverExpiry` (expired waivers still unlock) [packages/modules/migration/src/reconciliation.ts:787]
- [x] [Review][Patch] Sign/gate can succeed without compare / without requiring match-or-waived per required domain [packages/modules/migration/src/reconciliation.ts:622]
- [x] [Review][Patch] DEV_DEMO_POLICY has `migration.reconcile`/`sign` as `write` only; list/get use `action: "read"` → deny [packages/kernel/audit-envelope/src/index.ts:278]
- [x] [Review][Patch] `verifyProductionGateOnRun` does not require `tier === "production-candidate"` (trial/final can unlock production) [packages/modules/migration/src/reconciliation.ts:737]
- [x] [Review][Patch] Selected run id retained across `batchId` prop change — cross-batch production-ready signal [apps/web/components/import/migration-reconciliation-workspace.tsx:75]
- [x] [Review][Patch] Waiver SoD checks only vs disposition actor, not discrepancy `ownerAccountId` [packages/modules/migration/src/reconciliation.ts:595]
- [x] [Review][Patch] Leave-guard marks any loaded unsigned/non-rejected run dirty with no local edits [apps/web/components/import/migration-reconciliation-workspace.tsx:124]
- [x] [Review][Patch] English placeholders / English “disposition” in Persian operational copy [apps/web/lib/operational-copy.ts:163]
- [x] [Review][Patch] No UNIQUE `(run_id, domain_key)` on `reconciliation_discrepancy` [packages/db/sql/014_migration_reconciliation.sql:66]
- [x] [Review][Patch] Re-apply preserved waived disposition invents `expiry` when prior null [packages/modules/migration/src/reconciliation.ts:499]
- [x] [Review][Patch] Compare / sign / disposition mutate `rejected`/`superseded` runs [packages/modules/migration/src/reconciliation.ts]
- [x] [Review][Patch] Run marked `signed` when both role rows exist without requiring every signature `evidenceHash` == current hash [packages/modules/migration/src/reconciliation.ts:701]
- [x] [Review][Patch] Concurrent same-account dual-sign race (no SELECT FOR UPDATE) [packages/modules/migration/src/reconciliation.ts:686]
- [x] [Review][Patch] `sprint-status.yaml` still UTF-8 BOM (EF BB BF) [\_bmad-output/implementation-artifacts/sprint-status.yaml:1]
- [x] [Review][Patch] Trial execute success appends primary-action label `reconTrialExecuteOnly` as status text [apps/web/components/import/import-wizard.tsx]
- [x] [Review][Defer] IDOR-shaped get/list by run UUID with void ctx beyond governedProcedure — deferred, pre-existing migration permission+UUID pattern
- [x] [Review][Defer] Selfcheck lacks full create→sign→executeImportBatch production cutover against live staging — deferred, PG-optional honesty already documented

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Persist reconciliation runs, controls, discrepancies, dispositions, signatures | Unlock production with any non-empty client string |
| Block production without signed reconciliation + zero open critical defects | Invent AR-MIGRATION tolerances / merge-split / Baseline-revision policy |
| Owner + disposition on every discrepancy | Leave critical defects “accepted” with empty rationale |
| Exact-match vs attested controls when present; missing required control = block | Fabricate observed Employment/Assignment totals when projector gap exists |
| Thin web; domain in `@divan/migration`; raw SQL staging/recon schema | Prisma for kernel/staging; cross-module table reads |
| Provisional permissions code-marked + seeded | Claim signed AR-ACCESS freeze; edit nav matrices casually |
| Preserve 6.2 cutover atomicity / SoD / evidence / 6.3 provenance honesty | Rewrite staging cutover for “display”; use provenance as authz |

### Absolute non-goals

- Governed export / artifact panel / reauth / custody / formula-safe download → **6.5**
- Full AR-MIGRATION / AR-CUTOVER artifact authoring (owner process) — implement **hooks + fail-closed substrate** only
- Implementing PE `BaselineRecorded` projector → Employment/Assignment bootstrap (if missing: honesty `unavailable` + document; do not silently invent employment rows in recon)
- PopulationPort default-registry production cutover; AD-6 createPerson orphan hardening; `ensure*Schema` migrations-only move
- Person-org IDOR on Cancel/Reverse/Correct (unless touching those writers — should not)
- Deduplicate Add vs QuickCreate; logout → `requestNavigation`
- Dashboard metric “reconciliation links” productization beyond migration workspace (FR-35 links are adjacent, not this story’s export surface)
- Vitest mandate (selfcheck `tsx` remains house pattern)

### UPDATE files — current state → this story → preserve

| File | Current (post-6.3) | Change | Preserve |
| --- | --- | --- | --- |
| `packages/modules/migration/src/execute-batch.ts` | Production blocked if `reconciliationEvidenceToken` blank | Verify real signed run; reject fake tokens | Atomic TX, SoD, mutex, revalidate, evidence, trial path |
| `apps/web/src/server/migration.ts` | `executeBatch` has no recon id; never passes token | Procedures for recon + pass `reconciliationRunId` | `mapMigrationError`; governedProcedure meta; PopulationPort filter |
| `apps/web/components/import/import-wizard.tsx` | trial execute only; 6.3 honesty copy | Mount workspace; optional production execute when gate green | Sheet, leave-guard, SensitiveConfirmationDialog, SoD UX |
| `apps/web/lib/operational-copy.ts` | Import/execute/provenance strings | Recon/sign/block/disposition strings | UX-DR24; no ceremonial success |
| `packages/modules/migration/src/errors.ts` | 6.1–6.2 codes | New recon/gate codes + `messageFa` | Existing codes unchanged in meaning |
| `packages/modules/migration/src/index.ts` | Barrel | Export recon APIs | Existing exports |
| `packages/modules/migration/src/seed-sod.ts` (+ audit-envelope perms) | approve/execute seeds | Seed reconcile/sign provisional keys | Fail-closed unmarked roles |
| `packages/modules/migration/src/import-batch.selfcheck.ts` | Proves cutover + stub gate | Assert real gate semantics | Staging/SoD/idempotency cases |
| `packages/modules/migration/package.json` | selfcheck scripts | Add `selfcheck:reconciliation` | Existing scripts |
| NEW `014_migration_reconciliation.sql` | Absent | Durable recon schema | Do not break `013` tables |
| NEW `reconciliation*.ts` | Absent | Domain + repo + selfcheck | — |
| NEW workspace component(s) | Absent | FR-40 UI | Reuse primitives; no nav matrix churn |

### Consumer / reconciliation contract (encode — do not rediscover)

1. **Pipeline:** 6.1 preview → 6.2 approve/staging/cutover (trial) → 6.3 provenance UX → **6.4 reconcile + production gate** → 6.5 export.
2. **AD-4:** Staging separate; production append only via atomic cutover; rollback pre-cutover = drop staging, zero production event trace. Reconciliation **gates** production cutover; it does not replace staging.
3. **FR-40 domains (minimum):** Person, Employment, Assignment, Personnel Event, current state, Team totals, reference mappings, headcount, duplicates, orphans, approved control totals.
4. **Addendum §7.3 package (trial + final):** source/target Person & Employment counts; Personnel Code / identifier coverage; active Employment & Primary Assignment counts; duplicate/orphan counts; required/critical-field completeness; org hierarchy & reference mappings; Ladder–Grade validity; Baseline & migrated-event coverage; current/as-of samples; Team membership & manager counts; headcount approved/used/reserved/free & Override totals; selected high-risk numeric control totals **where approved**; every warning/error/exception + disposition; signer, timestamp, source extract/version, rollback decision.
5. **LG-1:** Migration + HR signed evidence; exceptions/waivers follow FR-55; cumulative residual risk accepted; **no unresolved critical** duplicate/orphan/temporal/Assignment/headcount/control-total issues.
6. **FR-55 waiver shape (when disposition=waived):** owner, independent approver, scope, risk, compensating control, expiry, closure evidence — cannot waive default-deny / audit independence / integrity / mandatory upstream gates.
7. **UJ-4:** Niloofar uploads; independent approver; separate executor; actors reconcile to signed controls; production blocked until exceptions/approvals resolved. Trial/UAT segregation tier = AR-MIGRATION (pending) — provisional code OK.
8. **Authz reveal:** authorize → PopulationPort → access event → filtered DTO. Reconciliation tables show aggregates/refs — not a channel to dump omitted PII.
9. **Glossary:** Import Batch = attributable unit + validation/reconciliation evidence. Baseline = approved migrated start of reliable reconstructable history (already presented in 6.3).

### Production gate algorithm (normative for implementer)

```text
if cutoverTier != production:
  allow existing 6.2 path (trial/staging)
else:
  load reconciliation run by id + batchId
  if missing or status != signed → CUTOVER_FAILED / RECONCILIATION_UNSIGNED
  if evidence_hash != hash(frozen controls+observations+dispositions) → RECONCILIATION_STALE
  if missing migration_lead or hr_data_owner signature → RECONCILIATION_UNSIGNED
  if any discrepancy severity=critical AND status=open → CRITICAL_DEFECT_OPEN
  if any required domain lacks attested control → CONTROL_MISSING
  if any required domain observation=unavailable without closed waiver → RECONCILIATION_INCOMPLETE
  else allow cutover TX
```

### AR-MIGRATION / AR-CUTOVER honesty

- `launch-artifacts.md` / PRD §7: **AR-MIGRATION** and **AR-CUTOVER** still `pending`.
- Epic 5 open action: keep AR-MIGRATION / AR-ACCESS / AR-DATA / AR-REPORTING / AR-TEMPORAL **fail-closed** in Epic 6.
- Allowed: workspace substrate, attested controls, dispositions, signatures, production block, provisional permissions.
- Forbidden: claiming production migration readiness complete; inventing tolerance bands; inventing merge/split/Personnel Code correction as approved policy; labeling fixture PopulationPort as production workforce authz.

### Known gaps to document (do not silently “fix” as done)

| Gap | Handling in 6.4 |
| --- | --- |
| AD-6: `createPerson` outside event-store TX → possible Person orphan on abort | May **surface** as orphan discrepancy if detectable; do **not** claim TX fix |
| No PE projector applying `BaselineRecorded` → Employment/Assignment | Observations may be `unavailable`; blocks production honesty — do not invent counts |
| AR-MIGRATION oracle / tolerances pending | Exact match + attested controls; no local ±tolerance |
| PopulationPort still fixture-default possible | Preserve honesty fields on any person-linked UI |
| 32-bit FNV advisory lock collision (6.2 deferral) | Out of scope unless blocking recon |
| Epic 5 open: encode export reauth into **6.5** create-story | Non-goal here; leave action open |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Existing monorepo | Node 22 / TS 5.x / pnpm — no new framework |
| PostgreSQL | New SQL migration `014_…`; JSONB for control/observed values OK |
| `pg` Pool/PoolClient | Staging + recon persistence (same as 6.2) |
| tRPC `governedProcedure` | All new mutations/queries |
| `@divan/event-store` `withTransaction` | Cutover unchanged aside from gate |
| Selfcheck (`tsx`) | House pattern — add `selfcheck:reconciliation` |
| No new Excel/parser deps | Reuse existing parse/validate; recon is post-batch |
| UI | Existing shadcn / GovernedDataTable / SensitiveConfirmationDialog |

### File structure requirements

```text
packages/db/sql/
  014_migration_reconciliation.sql          # NEW

packages/modules/migration/src/
  reconciliation.ts                         # NEW domain orchestration
  reconciliation-repo.ts                    # NEW persistence
  reconciliation-domains.ts                 # NEW optional domain keys
  reconciliation.selfcheck.ts               # NEW
  execute-batch.ts                          # UPDATE gate
  errors.ts                                 # UPDATE codes
  seed-sod.ts                               # UPDATE seeds
  index.ts                                  # UPDATE exports
  import-batch.selfcheck.ts                 # UPDATE gate assertions
  package.json                              # UPDATE scripts

packages/kernel/audit-envelope/src/         # UPDATE if permission catalog lives here

apps/web/src/server/
  migration.ts                              # UPDATE procedures + execute input
  migration.selfcheck.ts                    # UPDATE

apps/web/components/import/
  migration-reconciliation-workspace.tsx    # NEW
  import-wizard.tsx                         # UPDATE mount + production execute wiring

apps/web/lib/
  operational-copy.ts                       # UPDATE Persian strings
```

### Testing requirements

- Domain selfcheck: gate matrix (unsigned / critical open / stale / missing control / happy path / trial bypass).
- Disposition: discrepancy without owner rejected; waiver without independent approver rejected for critical.
- Signature: dual role required; optional same-actor reject when segregation on.
- Regression: `selfcheck:import-batch` still green for trial cutover + zero-trace failure; `selfcheck:event-origin` unaffected.
- Web smoke: copy keys present; execute input schema accepts `reconciliationRunId`.
- Interactive a11y: blocking banner not color-only; focus order in workspace; 200% zoom readable; confirm dialog reuse.

### Previous story intelligence (6.3)

- Domain helpers in `@divan/migration` + thin web — **repeat for reconciliation**.
- `source=migration` is audit metadata only — keep that comment near any gate code so nobody “simplifies” authz to provenance.
- UI: Persian operational copy, Persian digits, omit-from-DOM preserved, no provenance/payload dumps.
- Selfcheck house pattern; PG may be down (`ECONNREFUSED :5433`) — pure gate unit tests still required; document DB skips honestly in Dev Agent Record.
- Absolute non-goal from 6.3: FR-40 workspace → **this story closes that deferral only**.

### Previous story intelligence (6.2 / 6.1)

- Staging schema `migration_staging`; evidence DTO actors/counts/created ids; SoD `migration.approve` / `migration.execute`; production stub comment literally points at 6.4.
- Web currently **always** fail-closed for production because router omits token — replacing stub incorrectly with “accept any string from client” would be a **security regression**. Verify-in-DB is mandatory.
- Wizard stages: identify → validate → preview → confirm → approve → execute → result. Reconciliation fits after trial execute / before production execute.
- Leave-guard: dirty ≠ dialog visibility; Discard snapshot; Save resolves Promise; single dialog depth.
- Concurrent batch copy: «دسته دیگری در حال اجراست» + owner + correlation id — recon errors should similarly carry correlation where useful.
- Import Batch report: never fabricate from preview — extend honesty to unsigned recon drafts.

### Git intelligence summary

- Recent: `ffbb9b3` story 6.3 → `783dca6` story 6.2 → `7472f44` story 6.1 → Epic 5 retro.
- Pattern: domain-first `@divan/migration`, thin `apps/web` router + wizard, central `operational-copy`, dual-layer selfchecks, explicit deferrals.
- 6.4 expected touch: new `014_*.sql`, recon domain/repo, execute gate, migration router, workspace UI, copy, seeds — **not** timeline provenance rewrites.

### Latest tech information

- Prefer **content-addressed evidence hash** (e.g. SHA-256 over canonical JSON of frozen run) stored with signatures — do not treat a random UUID alone as proof if controls can mutate after sign.
- Advisory: keep reconciliation rows append-friendly where practical (disposition updates attributable); avoid rewriting signed snapshots in place — supersede run instead if major recalc needed.
- No new ORM; continue `pg` + SQL files per architecture spine DB layout.
- ExcelJS already in migration for import — do not add a second spreadsheet stack for control upload unless necessary; CSV/JSON attest UI is enough for MVP substrate.

### Project context reference

- No `project-context.md` in repo at story creation; follow ARCHITECTURE-SPINE **AD-3/AD-4/AD-6**, epics Story 6.4 AC, PRD FR-40 + LG-1 + FR-55 + addendum §7.3, Stories 6.1–6.3 handoffs, Epic 5 AR fail-closed action.
- Operator UI Persian; story/code/docs English per BMM config (`document_output_language: English`, `communication_language: Persian`).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6 / Story 6.4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-40, FR-37–39, FR-55, LG-1, UJ-4, AR-MIGRATION, AR-CUTOVER]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §7.3 Reconciliation package]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-4]
- [Source: `_bmad-output/specs/spec-divan/launch-artifacts.md` — AR-MIGRATION / AR-CUTOVER pending]
- [Source: `_bmad-output/implementation-artifacts/6-3-baseline-provenance-reconstructable-history-boundary.md` — provenance honesty; FR-40 deferral]
- [Source: `_bmad-output/implementation-artifacts/6-2-atomic-import-batch-execution-staging-cutover.md` — staging, SoD, evidence, production stub]
- [Source: `_bmad-output/implementation-artifacts/6-1-controlled-import-wizard-with-preview.md` — wizard substrate]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — AD-6 / projector / PopulationPort gaps]
- [Source: `packages/modules/migration/src/execute-batch.ts` — production token stub]
- [Source: `apps/web/src/server/migration.ts` — executeBatch input without recon]
- [Source: UX-DR14 / UX-DR16 / UX-DR24 — confirm, import, operational voice]

### Epic 5 / 6.x carry-ins (encode in implementation)

| Item | Handling in 6.4 |
| --- | --- |
| FR-40 / LG-1 reconciliation workspace deferred from 6.1–6.3 | This story — Tasks 1–4 |
| Production stub token | Task 2 — replace with verified run |
| AR fail-closed / no invented tolerances | AC #7 + Gate |
| Import Batch report never fabricate | AC #9 + non-goal preserve |
| Artifact reauth / export custody | Non-goal → **6.5** (keep Epic 5 action open for 6.5 create-story) |
| AD-6 / PopulationPort full cutover | Non-goal; honesty / optional orphan surfacing only |
| `source=migration` ≠ control | AC #10 |
| BOM-safe sprint-status | Task 5 DoD |
| Encode export reauth into 6.5 create-story | Out of scope — remind at 6.5 creation |

### Open questions (do not block story file; resolve in Dev Agent Record if product silent)

1. Exact provisional permission string pair for reconcile vs sign — recommend `migration.reconcile` + `migration.sign` mirroring approve/execute.
2. Whether trial cutover should **require** a trial reconciliation run (product: optional for rehearsal; production always required).
3. Whether `unavailable` projector domains can be FR-55-waived for a limited rehearsal production candidate — default **no** for true production tier until AR says otherwise.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- PG unavailable at :5433 during selfcheck — pure gate matrix still green; DB smoke skipped honestly (`ECONNREFUSED` AggregateError handled by code check).
- Schema choice: reconciliation tables live under `migration_staging` (same AD-4 boundary as 013) — documented in SQL header.

### Completion Notes List

- Implemented FR-40 reconciliation substrate: SQL `014`, domain/repo, SHA-256 evidence hash, dual signatures (`migration_lead` + `hr_data_owner`), FR-55-shaped waivers for critical.
- Production gate: `reconciliationEvidenceToken` stub replaced with `reconciliationRunId` verified in DB; free-string tokens rejected.
- Provisional permissions: `migration.reconcile` + `migration.sign` (mirrors approve/execute); seeded on hr.admin; catalogued in audit-envelope DEV_DEMO_POLICY.
- Trial cutover remains allowed without signed recon; UI labels trial explicitly and blocks production CTA until `verifyProductionGate` passes.
- Employment/Assignment/current_state/headcount observations may be `unavailable` (projector/oracle gaps) — do not invent zeros; block production until waived.
- Selfchecks: `selfcheck:reconciliation` OK; `selfcheck:import-preview` OK; `selfcheck:event-origin` OK; web `selfcheck:migration` OK; typecheck migration+web OK; eslint touched files OK.
- Does **not** claim FR-41/FR-52 export, AR-MIGRATION freeze, or Baseline→Employment projector complete.

### File List

- packages/db/sql/014_migration_reconciliation.sql
- packages/modules/migration/src/reconciliation-domains.ts
- packages/modules/migration/src/reconciliation-repo.ts
- packages/modules/migration/src/reconciliation.ts
- packages/modules/migration/src/reconciliation.selfcheck.ts
- packages/modules/migration/src/errors.ts
- packages/modules/migration/src/sod.ts
- packages/modules/migration/src/seed-sod.ts
- packages/modules/migration/src/execute-batch.ts
- packages/modules/migration/src/index.ts
- packages/modules/migration/src/import-batch.selfcheck.ts
- packages/modules/migration/package.json
- packages/kernel/audit-envelope/src/index.ts
- apps/web/src/server/migration.ts
- apps/web/src/server/migration.selfcheck.ts
- apps/web/lib/operational-copy.ts
- apps/web/components/import/migration-reconciliation-workspace.tsx
- apps/web/components/import/import-wizard.tsx
- _bmad-output/implementation-artifacts/6-4-migration-reconciliation-workspace.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-07-26: Story 6.4 — migration reconciliation workspace + verified production cutover gate (FR-40 / LG-1 substrate).
- 2026-07-26: Code review patches applied (production unavailable hard-block, FR-55 UI, gate/sign hardening).
