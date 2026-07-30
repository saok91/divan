---
baseline_commit: 014d3ce
---

# Story 7.7: Launch Artifact Change Control Hooks

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a Product / domain owner,
I want Launch Artifacts versioned with waiver and rebaseline controls,
so that conflicting or expired policies block affected baselines instead of inviting local assumptions (FR55).

**Story key:** `7-7-launch-artifact-change-control-hooks`  
**Epic:** 7 — Audit, Operations & Evidence Controls (FR42, FR45, FR50, FR51, FR53–FR56)  
**Prerequisite:** Epics 1–6 done; Stories **7.1–7.6** done. Existing precursors: FR-55-shaped **migration reconciliation waivers** (6.4 — `setDiscrepancyDisposition` / `isWaiverExpired` / production unavailable hard-block); provisional report/metric version strings on decision publications (7.6 — `PROVISIONAL_REPORT_VERSION` / `PROVISIONAL_METRIC_VERSION`); data-dictionary `DATA_DICTIONARY_REGISTRY_VERSION` foreshadow (3.3); Launch Artifact Register doc (`_bmad-output/specs/spec-divan/launch-artifacts.md`) mostly `pending` + partial freezes; LG-1 requires FR-55-shaped waivers; LG-6 requires FR-55 acceptance. **No** global Launch Artifact Register product, version supersession graph, conflict-block substrate, rebaseline workflow, or controlling-version resolver consumed by operations/reports/evidence.

### Critical naming distinction (do not conflate)

| Concept | Owner | Meaning |
| --- | --- | --- |
| **Export / import file artifact** (FR-41/52) | Story 6.5 — `export.*` / `createExportArtifact` | Short-TTL managed download; custody/reauth/dispose — **not** a Launch Artifact Register item |
| **Migration reconciliation waiver** (LG-1 / FR-55 shape) | Story 6.4 — discrepancy disposition | Domain-scoped FR-55 field shape on recon discrepancies; **reuse shape**, do not treat as the global AR register |
| **Decision publication versions** (FR-54) | Story 7.6 | Immutable publication metadata; currently **provisional** `@provisional-pending-AR-REPORTING-freeze` strings — **consumer** of 7.7 controlling versions |
| **Data Dictionary `registryVersion`** (FR-7 / AR-DATA) | Story 3.3 | Partial-freeze foreshadow string — **consumer** of 7.7 when AR-DATA version is registered |
| **Evaluation snapshot integrity** (FR-56) | Story **7.8** | One attributable evaluation snapshot for finalize/import/export/publish — **out of scope** |
| **Launch Artifact Register item (AR-\*)** (FR-55) | **This story** | Versioned, attributable, approved policy/acceptance dependency (AR-ACCESS … AR-CUTOVER) with change, waiver, expiry, reapproval, conflict-block, rebaseline |
| **Waiver (FR-55)** | **This story** (+ keep 6.4 recon consumer) | Bounded exception with independent approver; **cannot** waive default-deny, audit independence, integrity, or mandatory upstream gates |
| **Rebaseline** | **This story** | Impact-assessed reapproval after material PRD/policy/metric/architecture/threshold/build/env change before continued build/release |

Use type/API names like `LaunchArtifact` / `launchArtifact.*` / «ثبت آرتیفکت پرتاب» / «معافیت FR-۵۵» — never call an export download, import batch, or decision publication row a “Launch Artifact.”

## Acceptance Criteria

1. **Given** Launch Artifact Register items (AR-\* ids from PRD §7.1 / `launch-artifacts.md`)  
   **When** an applicable operation, report, or evidence path runs under change-control enforcement  
   **Then** the **controlling artifact version** is identifiable (stable artifact id + version string + status + effective/expiry window)  
   **And** superseded versions remain **traceable** (immutable prior versions + supersession links; no silent rewrite of approved history)  
   **And** every register mutation (create version / approve / supersede / expire / close) is attributable under AR-ACCESS / AR-AUDIT (required access-event path; honor 7.4 writer suspend)

2. **Given** a waiver is issued against a Launch Artifact gate or affected baseline/operation  
   **When** the waiver is recorded  
   **Then** it states **all** of: owner, **independent** approver (≠ owner/requester), scope, risk, compensating controls, expiry, and closure evidence (or open→closed lifecycle with closure evidence required to close)  
   **And** the system **rejects** waivers that attempt to waive **non-waiverable** controls: default-deny authorization, audit independence (incl. self-review of own sensitive activity), integrity (NFR-4 class / append-only audit), or mandatory upstream gates (document exact code set; mirror 6.4 “unavailable never unlocked by waiver”)  
   **And** expired approval/waiver is reviewed automatically before continued use — expired → **deny** / block affected baseline (fail-closed; no silent grace unless explicitly provisional-coded and documented)

3. **Given** material PRD, policy, data-category, metric, architecture, build, threshold, workload, or environment changes  
   **When** a rebaseline is required  
   **Then** an **impact-assessed rebaseline** record is required (affected AR ids, impact summary, required regression/acceptance refs, requester, independent approver)  
   **And** continued build/release / affected governed operations remain **blocked** against the prior baseline until rebaseline is approved and new artifact versions are effective  
   **And** production evidence claims must be able to prove generation against **deployed build + controlling artifact versions** (store build/ref + controlling version set on rebaseline / gate check DTOs — provisional honesty OK)

4. **And** if applicable Launch Artifacts prescribe **conflicting** outcomes for the same affected baseline/operation  
   **Then** the affected baseline and operation remain **blocked** until owners/approvers **jointly** resolve and **version** the conflict  
   **And** no team may assume local precedence (no “last writer wins”; no silent pick of one AR)

5. **And** at least these **consumers** resolve controlling versions / honor blocks (minimal viable wiring — document exact hook points in Completion Notes):
   - **7.6 decision publication** — publish/list/retrieve metadata uses register-backed AR-REPORTING (and related) controlling versions when present; keep provisional marker honesty if register entry is still provisional/partial-freeze; **never** invent signed formulae
   - **6.4 reconciliation** — keep existing FR-55 field shape; align non-waiverable + expiry semantics with global helper where cheap (shared `assertWaiverShape` / `isWaiverExpired`); do **not** unlock production `unavailable` via waiver
   - **3.3 data-dictionary** — expose/bind `registryVersion` to AR-DATA register controlling version when registered (or document provisional continue + fail-closed incomplete)
   - **Optional cheap hooks:** export create metadata may record controlling AR-DATA/AR-REPORTING versions without forking export SoT; ops health may surface “expired AR / open conflict” counts without HR rows

6. **And** AR-ACCESS / AR-AUDIT / AR-DATA / AR-REPORTING / AR-NFR / AR-MIGRATION / AR-CUTOVER remain **fail-closed**:
   - Do **not** invent signed AR matrices, jurisdiction claims, or freeze what owners have not frozen
   - Seed the eleven AR ids from `launch-artifacts.md` as register rows with **honest** status (`pending` \| `partial_freeze` \| `approved` \| `superseded` \| `expired`) matching known partial freezes — do not mark production-complete
   - Provisional permission/category codes OK with `@provisional-pending-AR-ACCESS-freeze`
   - Do **not** claim LG-1 / LG-6 / FR-55 production acceptance complete without frozen ARs + signed evidence
   - Do **not** claim FR-56 evaluation-snapshot product complete (that is 7.8)

7. **And** required vs secondary audit posture is **normative** (same as 7.1–7.6):
   | Path | On append failure | On trust suspend |
   | --- | --- | --- |
   | Required capture (register version create/approve/supersede, waiver issue/close, conflict open/resolve, rebaseline approve, gate deny evidence) | Fail-closed | Block sensitive allow |
   | Secondary (list/search register after primary allow) | Soft-deny / soft-return — never mask primary FORBIDDEN | Prefer fail-closed for **new** mutations; reads of existing register MAY continue if separately permitted |
   | API mapping | Trust/append failure ≠ ordinary «دسترسی ندارید.» — preserve 7.4 `INTERNAL_SERVER_ERROR` mapping |

8. **And** this story does **not** own: rewriting 5.5 report maths; forking 6.5 export SoT; rewriting 6.4 recon domain oracles; rewriting 7.1–7.6 cores beyond consumer hooks; 7.8 evaluation-snapshot product; PopulationPort cutover; AD-6 Prisma↔PoolClient hardening; Vitest mandate; inventing new Launch Report catalogue keys; claiming Divan revokes local copies; full CI/CD policy-as-code pipeline product (hooks + substrate + block APIs are enough — wire one selfcheck/gate helper, not a second DevOps platform)

## Tasks / Subtasks

- [x] Task 1: Domain constants + errors + non-waiverable catalogue (AC: #1–#4, #6–#7)
  - [x] NEW under `@divan/audit-envelope` (preferred BC home — cross-cutting FR-46..56 / AD-5; mirror `audit-trust.ts` / `investigation.ts`):
    - Files e.g. `launch-artifact.ts`, `launch-artifact-errors.ts`, `launch-artifact-permissions.ts`, `launch-artifact-repo.ts`
    - Permissions (provisional): `launch.artifact.read`, `launch.artifact.manage` (create/supersede versions), `launch.artifact.approve` (independent approval — SoD from manage where practical), `launch.artifact.waiver`, `launch.artifact.rebaseline` — document SoD; do **not** auto-grant to `audit.investigate` / `ops.health.read` / publication perms
    - Category: `launch.artifact` (ordinary; **not** `health`; do not collide with `export` / `report.publication` / `data.lifecycle` / `correction.case`)
    - Canonical AR id enum/const list matching register: `AR-ACCESS`, `AR-TEMPORAL`, `AR-HEADCOUNT`, `AR-DATA`, `AR-IDENTITY`, `AR-AUDIT`, `AR-MIGRATION`, `AR-REPORTING`, `AR-NFR`, `AR-SECONDARY`, `AR-CUTOVER`
    - Non-waiverable gate codes (minimum): `default_deny`, `audit_independence`, `integrity`, `mandatory_upstream_gate` (+ reuse recon `unavailable` spirit as `observation_unavailable` if shared)
    - Error codes + Persian `messageFa`: e.g. `LAUNCH_ARTIFACT_DENIED`, `LAUNCH_ARTIFACT_NOT_FOUND`, `LAUNCH_ARTIFACT_VERSION_CONFLICT`, `LAUNCH_ARTIFACT_EXPIRED`, `LAUNCH_ARTIFACT_SUPERSEDED`, `WAIVER_INVALID`, `WAIVER_NON_WAIVERABLE`, `WAIVER_EXPIRED`, `WAIVER_APPROVER_NOT_INDEPENDENT`, `CONFLICT_UNRESOLVED`, `REBASELINE_REQUIRED`, `REBASELINE_INCOMPLETE`, `CONTROLLING_VERSION_UNRESOLVED`
    - DTOs: `LaunchArtifactVersion`, `LaunchArtifactWaiver`, `LaunchArtifactConflict`, `RebaselineRecord`, `ControllingVersionRef`, `ChangeControlGateResult`
  - [x] Register category + policy tuples in `DEV_DEMO_CATEGORIES` / `DEV_DEMO_POLICY` for read/manage/approve/waiver/rebaseline × `org:selfcheck`
  - [x] NEW `packages/modules/identity-access/src/seed-launch-artifact.ts` (mirror `seed-publication.ts`): PermissionSet bound to **`hr.admin`** (product/domain owner stand-in) until AR-ACCESS freezes — SoD: prefer separate approve set if cheap; never auto-grant audit/ops/trust
  - [x] Export from `@divan/audit-envelope` index; dedicated `LaunchArtifactError` (map at API)

- [x] Task 2: Persistence — register, versions, waivers, conflicts, rebaselines (AC: #1–#4)
  - [x] NEW `packages/db/sql/020_launch_artifact_change_control.sql` (next free after `019_decision_publications.sql`):
    - Prefer schema `governance` (or document `kernel` / dedicated — **not** `reporting.export_artifact` tables)
    - `launch_artifact` (stable id PK text AR-\*, title, purpose summary, owner_account_id nullable, current_version_id nullable, status)
    - `launch_artifact_version` (id, artifact_id, version label, status `draft`\|`approved`\|`superseded`\|`expired`, effective_from, effective_to/expiry, scope_summary, affected_fr_nfr jsonb, approval_history jsonb append-only or separate table, supersedes_version_id, content_ref/hash optional, created_at, created_by, correlation_id)
    - **Immutability:** approved version decision-defining columns must not be silently rewritten — supersede via new version + link; enforce with trigger and/or app guard
    - `launch_artifact_waiver` (id, artifact_id, artifact_version_id nullable, owner_account_id, independent_approver_account_id, scope, risk, compensating_controls, expiry, status `open`\|`closed`\|`expired`, closure_evidence, non_waiverable_attempt_code nullable for audit of rejects, created_at, closed_at, correlation_id)
    - `launch_artifact_conflict` (id, status `open`\|`resolved`, artifact_ids text[], summary, resolution_version_ids text[] nullable, opened_at, resolved_at, opened_by, resolved_by, correlation_id)
    - `launch_artifact_rebaseline` (id, status `required`\|`in_review`\|`approved`\|`rejected`, change_summary, impact_assessment, affected_artifact_ids, required_regression_refs jsonb, build_ref, requester, independent_approver, approved_at, correlation_id)
    - Indexes: artifact_id+status; version effective window; waiver expiry; conflict open; rebaseline status
    - DELETE forbid triggers on version/waiver/conflict/rebaseline history tables (append-only spirit)
  - [x] Repo via `pg` Pool/PoolClient in `@divan/audit-envelope` — **web stays thin**
  - [x] Migrations-only (do **not** expand `ensure*Schema` sprawl)
  - [x] Seed migration or idempotent seed function: upsert eleven AR rows + known partial-freeze version strings where already documented (e.g. AR-DATA `ar-data-partial-freeze-2026-07-16`, AR-NFR provisional, identity epic1 freezes) — mark `partial_freeze` / provisional, **not** production-approved

- [x] Task 3: Controlling version resolver + conflict/expiry gates (AC: #1, #4, #5)
  - [x] Normative APIs:
    ```text
    resolveControllingVersion(artifactId, asOf?) -> ControllingVersionRef | fail CONTROLLING_VERSION_UNRESOLVED
    assertArtifactsUsable(artifactIds[], ctx) ->
      deny if expired/missing/superseded-without-successor
      deny if open conflict intersects artifactIds
      deny if open required rebaseline intersects artifactIds
    assertWaiverAllowed(targetGateCode, waiverInput) ->
      reject if gate in NON_WAIVERABLE
      reject if approver == owner/requester
      reject if required FR-55 fields incomplete
      reject if expiry not in future
    recordOperationEvidence(ctx, controllingVersions[]) // DTO helper for consumers
    ```
  - [x] Expired waiver/approval: `refreshExpiryStates` (called on read paths and/or explicit check) — expire → block; do not auto-renew
  - [x] Conflict open: `openConflict` / `resolveConflict` (resolution requires new version ids + joint approver evidence fields)
  - [x] Selfcheck pure tests for non-waiverable rejects + expiry + conflict block

- [x] Task 4: Waiver + rebaseline workflows (AC: #2–#3)
  - [x] `issueWaiver` / `closeWaiver` with full FR-55 field validation (align field names with 6.4 where practical: independentApprover, scope, risk, compensatingControl, expiry)
  - [x] Extract shared pure helpers if cheap:
    - Prefer NEW small shared module **or** export pure functions from audit-envelope consumed by migration — **do not** duplicate divergent expiry/completeness rules
    - UPDATE `packages/modules/migration/src/reconciliation.ts` only to import shared `isWaiverExpired` / shape assert if that reduces drift; preserve unavailable hard-block + critical-requires-full-waiver
  - [x] `requireRebaseline` / `submitRebaseline` / `approveRebaseline` — approved rebaseline activates successor versions and clears block for listed artifacts
  - [x] Required access events on issue/close/approve/require/resolve

- [x] Task 5: Wire consumers (AC: #5–#6)
  - [x] UPDATE `packages/modules/reporting/src/decision-publication-permissions.ts` + `decision-publication.ts`:
    - Resolve AR-REPORTING controlling version via change-control API when available
    - Keep `@provisional-pending-AR-REPORTING-freeze` if register still provisional
    - Persist resolved controlling version on publish metadata (additive columns **or** store inside existing version fields once register-backed — prefer additive `controlling_artifact_versions jsonb` on publication if needed; **do not** rewrite historical publication decision columns; new publishes only)
    - `bumpMetricVersionNotices` may consult register version bumps — still append-only notices; no silent rewrite
  - [x] UPDATE data-dictionary types/constants to read controlling AR-DATA version when registered (fail-closed incomplete if enforcement flag on)
  - [x] Do **not** fork export artifact lifecycle; optional metadata-only controlling version stamp on create is OK
  - [x] Do **not** claim FR-56 snapshot product

- [x] Task 6: Thin tRPC + UI (AC: #1–#8)
  - [x] NEW `apps/web/src/server/launch-artifact.ts`:
    - Procedures: `listArtifacts`, `listVersions`, `getControlling`, `createVersion`, `approveVersion`, `issueWaiver`, `closeWaiver`, `listConflicts`, `openConflict`, `resolveConflict`, `listRebaselines`, `requireRebaseline`, `approveRebaseline`, `capabilities`
    - `governedProcedure` + soft PermissionSet after envelope; map domain errors via `operational-copy`
    - Soft-deny on secondary list append failure
  - [x] Register in `apps/web/src/server/root.ts`
  - [x] UI (pick **one**; document choice):
    - **Preferred:** NEW panel under **عملیات** (or existing ops shell) — «ثبت آرتیفکت‌های پرتاب» — list AR ids, current version, expiry, open waivers/conflicts/rebaselines; drawers for waiver issue/close, conflict resolve, rebaseline approve
    - **Alt:** NEW `/governance/launch-artifacts` only if ops IA is wrong persona fit — then UPDATE nav + Layout≠RSC `assertPageAccess` (do not invent IA lightly)
  - [x] Layout≠RSC on any new page: `auth()` → `assertPageAccess` → client panel
  - [x] Persian RTL + digits; Skeleton; error ≠ empty; single dialog depth; destructive confirm on approve/resolve
  - [x] Show badges: پیش‌نویس / تأییدشده / جایگزین‌شده / منقضی / معافیت باز / تعارض باز / نیاز به بازپایه
  - [x] Non-waiverable attempts: clear Persian error (not English enum dump)
  - [x] UPDATE `apps/web/lib/operational-copy.ts` — never forward raw `error.message`
  - [x] Interactive a11y: labeled controls; focus restore; Escape/focus trap on confirms; 200% zoom; status not color-only

- [x] Task 7: Verify + DoD (AC: #1–#8)
  - [x] Selfchecks: seed eleven ARs; resolve controlling version; superseded traceable; waiver requires full FR-55 fields; non-waiverable reject; expired waiver blocks; conflict blocks; rebaseline blocks until approved; publication consumer records controlling version or provisional honesty; recon unavailable still hard-blocked; trust suspend blocks mutations; soft-deny secondary; `kernel_events` append-only untouched
  - [x] Scripts: `pnpm --filter @divan/audit-envelope selfcheck:launch-artifact` + `pnpm --filter @divan/web selfcheck:launch-artifact` (names may vary — register in package.json)
  - [x] `pnpm` typecheck + eslint on touched packages
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits

### Manual DoD checklist

- [x] Register lists all eleven AR-* ids with honest pending/partial_freeze statuses
- [x] Creating/approving a version leaves prior approved version superseded + traceable
- [x] Gate/resolve APIs identify controlling version for at least AR-REPORTING and AR-DATA
- [x] Waiver missing independent approver / scope / risk / compensating / expiry → reject
- [x] Waiver with approver === owner → reject
- [x] Waiver targeting `default_deny` / `audit_independence` / `integrity` / `mandatory_upstream_gate` → reject with `WAIVER_NON_WAIVERABLE`
- [x] Expired waiver cannot authorize continued use
- [x] Open conflict blocks affected operation/gate helper
- [x] Required rebaseline blocks until approved; approval records build_ref + controlling versions
- [x] Decision publication new publish records register-backed or provisional controlling versions — no silent rewrite of old pubs
- [x] Migration recon: unavailable still not unlockable by waiver; shared expiry/shape if wired
- [x] 7.4 trust suspend still blocks new register mutations
- [x] Export artifact lifecycle unchanged (TTL/custody/reauth)
- [x] No jurisdiction / LG-1 / LG-6 complete claims; AR provisional markers present
- [x] Persian RTL / digits; UX-DR24 copy; no secrets in UI
- [x] Sprint may claim FR-55 **change-control substrate + hooks** — **not** full Launch Artifact freeze / LG-6 production acceptance; **not** FR-56 complete

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Versioned AR register with traceable supersession | Treat export/import files or decision pubs as Launch Artifacts |
| FR-55-complete waiver fields + independent approver | Allow owner self-approval; waive default-deny / audit independence / integrity / upstream gates |
| Expiry fail-closed | Silent grace or auto-renew without new attributable decision |
| Conflict + rebaseline blocks | Local precedence / last-writer-wins / continue build against expired baseline |
| Honor 7.4 trust suspend + AD-5 required access events | Parallel audit SoT or Prisma audit tables |
| Soft PermissionSet after envelope; seed with SoD honesty | Coarse nav alone as authz; auto-grant audit/ops |
| Reuse 6.4 waiver shape; wire 7.6/3.3 consumers | Fork divergent waiver validators; invent AR freeze content |
| Thin web; domain in `@divan/audit-envelope`; operational-copy | English placeholders; PlaceholderPage as “done” |
| Migrations-only `020_*.sql` via `pg` | Prisma models for register tables; `ensure*Schema` sprawl |

### Absolute non-goals

- Rewriting 5.5 report assemblers / inventing new launch report keys
- Forking 6.5 export artifact SoT or relabeling exports as AR register items
- Rewriting 6.4 reconciliation domain oracles / production unavailable unlock
- Rewriting 7.1–7.5 cores; rewriting 7.6 publication immutability (consumer hook only)
- 7.8 evaluation-snapshot integrity product
- PopulationPort production cutover; AD-6 Prisma↔PoolClient; Vitest mandate; hash-chain WORM product
- Full enterprise Policy-as-Code CI platform / Azure Policy clone
- Claiming Divan revokes local/email copies
- Inventing signed AR matrices, jurisdiction, or LG-6 complete
- Embedding HR person rows inside register/waiver evidence “for convenience”

### UPDATE files — current state → this story → preserve

| File | Current (post-7.6) | Change | Preserve |
| --- | --- | --- | --- |
| `packages/kernel/audit-envelope/src/categories.ts` | no `launch.artifact` | Register category + policy | Never reuse `health` |
| `packages/kernel/audit-envelope/src/index.ts` | trust/investigation/lifecycle exports | Export change-control API | Existing authorize/trust contracts |
| `packages/modules/reporting/src/decision-publication-permissions.ts` | fixed provisional version consts | Resolve via register when present | Provisional honesty; fail-closed empty |
| `packages/modules/reporting/src/decision-publication.ts` | publish with provisional strings | Stamp controlling versions on **new** pubs | Immutability; disposal fork; notices |
| `packages/modules/migration/src/reconciliation.ts` | local waiver shape + unavailable hard-block | Optional shared expiry/shape helpers | Unavailable never unlocked; critical full waiver |
| `packages/modules/person-employment/src/data-dictionary-types.ts` | fixed `DATA_DICTIONARY_REGISTRY_VERSION` | Bind to AR-DATA controlling version when registered | Enablement fail-closed; not EAV SoT |
| `packages/modules/identity-access/src/seed.ts` | publication seed wired | Wire `seed-launch-artifact` | Idempotent seed order |
| `apps/web/src/server/root.ts` | no launch-artifact router | Register thin router | Existing routers |
| `apps/web/lib/operational-copy.ts` | 7.6 publication copy | Waiver/conflict/rebaseline/register copy | UX-DR24; exact LDAP/custody strings |
| `apps/web` ops / nav shell | no AR register UI | Add panel or section | Layout≠RSC; leave-guard rules |
| NEW `020_launch_artifact_change_control.sql` + domain | Absent | Register + waiver + conflict + rebaseline | `kernel_events` append-only untouched |
| `_bmad-output/specs/spec-divan/launch-artifacts.md` | Doc register | Optional cross-link only — **do not** make markdown the runtime SoT | PRD remains authoritative for semantics |

### Architecture compliance

- **AD-1:** Single process + one PG — governance/register tables in same DB
- **AD-2:** Register versions are **governance evidence**; do not rewrite event history or publication decision columns to “fix” policy past
- **AD-3:** Web → `@divan/audit-envelope` (+ thin consumer updates in reporting/migration/person-employment); no Prisma for register tables; repo uses `pg`
- **AD-5:** Identity-access coarse + envelope fine; required access events on register/waiver/conflict/rebaseline mutations; FR-55 under Launch Artifacts + audit-envelope
- **AD-6:** Raw SQL migrations; keep event-store triggers intact; do not expand request-path `ensure*Schema`
- **Capability map:** Cross-cutting FR-46..56 → kernel + modules + Launch Artifacts — implement **substrate + hooks + fail-closed provisional**, do not invent frozen AR content
- **Spine:** No dedicated AD for FR-55 — hooks bind to AD-5 + Launch Artifact Register contracts

### Four-way product distinction (normative)

| | Export artifact (6.5) | Recon waiver (6.4) | Decision publication (7.6) | Launch Artifact register (7.7) |
| --- | --- | --- | --- | --- |
| What | File download bytes | Discrepancy exception | Formal report decision evidence | Policy/acceptance dependency (AR-\*) |
| Lifetime | ~hours TTL | Per recon run/domain | Organizational | Until superseded/expired |
| FR | 41/52 | LG-1 + FR-55 shape | 54 | **55** |
| Mutability | revoke/dispose | disposition rows | notices; decision cols immutable | version supersession; waiver close |

### Waiver algorithm (normative)

```text
on issueWaiver(input):
  authorize(launch.artifact.waiver)
  honor audit-trust suspend
  require fields: owner, independentApprover, scope, risk, compensatingControls, expiry
  if independentApprover == owner or == requester → WAIVER_APPROVER_NOT_INDEPENDENT
  if targetGate in NON_WAIVERABLE → WAIVER_NON_WAIVERABLE
  if !expiry in future → WAIVER_INVALID
  persist open waiver (append-only history)
  appendAccessEvent(operation: "launch.artifact.waiver.issue")
  return waiver DTO

on assertWaiverAllows(gate, waiver):
  if waiver.status != open → deny
  if isWaiverExpired(waiver.expiry) → deny (mark expired)
  if gate in NON_WAIVERABLE → deny
  allow within waiver.scope only
```

Industry alignment (do not over-build): waivers are **expiring governance artifacts** (not PASS); renewal = new attributable decision linked to prior; bind applicability to artifact version ids; dashboards must preserve WAIVED ≠ PASS. Optional contentHash on version payload is enough — **not** a full WORM chain product.

### Rebaseline algorithm (normative)

```text
on materialChangeDetectedOrDeclared(change):
  requireRebaseline({ affectedArtifactIds, changeSummary, impactAssessment, buildRef? })
  block assertArtifactsUsable(affected) until approved

on approveRebaseline(id):
  authorize(launch.artifact.rebaseline) + independent approver ≠ requester
  require impactAssessment + regression/acceptance refs non-empty (provisional codes OK)
  activate successor versions / record approved controlling set + build_ref
  appendAccessEvent(...)
  clear rebaseline block for listed artifacts
```

### Permission seeding (provisional)

| Key | Use | Seed bind |
| --- | --- | --- |
| `launch.artifact.read` | List register / versions / conflicts | `hr.admin` |
| `launch.artifact.manage` | Draft/create versions | `hr.admin` |
| `launch.artifact.approve` | Approve version / joint conflict resolve | `hr.admin` (document SoD gap if same set) |
| `launch.artifact.waiver` | Issue/close waivers | `hr.admin` |
| `launch.artifact.rebaseline` | Require/approve rebaseline | `hr.admin` |
| Existing recon disposition perms | Unchanged 6.4 | Unchanged |
| Existing `report.publication.*` | Consumer only | Unchanged 7.6 |

Mark `@provisional-pending-AR-ACCESS-freeze`.

### UX notes

- No dedicated FR-55 surface in UX DESIGN/EXPERIENCE — prefer **عملیات** section or carefully justified `/governance/launch-artifacts`
- One job per view: register list → detail with versions/waivers/conflicts/rebaselines
- Status pattern UX-DR22: expired / conflict-blocked / rebaseline-required are **distinct** from empty/error
- Empty register should be impossible after seed — if list empty, treat as infra error not “no artifacts”
- Single dialog depth; Skeleton; error ≠ empty; status not color-only
- Do **not** card-spam; keep admin density consistent with audit/ops panels from 7.1–7.2
- Interactive a11y DoD from Epic 1 carry-in

### AR honesty

- All eleven ARs remain formally pending unless companion partial freeze exists — seed honesty, do not invent freezes
- **AR-REPORTING** open: publication still provisional until owners freeze — register may hold provisional version row
- **AR-DATA** open: dictionary version foreshadow may map to partial freeze row
- **AR-NFR** provisional targets exist — register may reference `nfr-provisional.md` version string without claiming Ops sign-off
- Forbidden: claiming LG-1/LG-6 complete; inventing jurisdiction; claiming FR-56 done; inventing new Launch Report keys

### Migration-evidence / carry-in honesty (still mandatory)

| Fact | Change-control product must |
| --- | --- |
| PopulationPort fixture-default | Not present register as production population proof |
| AD-6 / Baseline projector gaps | Not claim recon domains cured by AR versioning alone |
| Soft-deny secondary gaps | Do not upgrade soft-failed list into “fully audited register” |
| InferenceBulk process-local race | Retain fail-closed where gates call bulk channels |
| Sticky break-glass / fingerprint | Out of scope UX debt |
| 7.8 snapshot integrity absent | Do not claim FR-56 done |
| Recon unavailable hard-block | Never unlock via FR-55 waiver |
| Export Base64 size-cap defer | Irrelevant to register — do not uncapped dump AR docs into DB |
| Open Epic 6 AR fail-closed action | Keep fail-closed; do not invent |

### Known gaps to document (do not silently “fix” as done)

| Gap | Handling in 7.7 |
| --- | --- |
| ARs not owner-frozen | Seed pending/partial_freeze + fail-closed unresolved controlling version when enforcement on |
| SoD approve vs manage on same `hr.admin` seed | Document provisional SoD gap (same class as 7.6 publication seed defer) |
| Full CI policy-as-code | Substrate + gate APIs + selfcheck; not a second pipeline product |
| Automatic detection of “material PRD change” | Explicit `requireRebaseline` API + UI; optional future webhook — honesty in Completion Notes |
| Cross-AR semantic conflict oracle | MVP: explicit `openConflict` by authorized actor (+ optional simple duplicate-prescription helper if cheap); do not invent full automated policy theorem prover |
| 7.8 snapshot product | Out of scope |
| Vitest/ephemeral DB | Still deferred open carry-in — dual-layer selfcheck required |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Existing monorepo | Node 22 / TS 5.x / pnpm — no new framework |
| Next.js 16 / React 19 / tRPC 11 | Thin router + client panel patterns from 7.2/7.6 |
| Zod | Input schemas for version/waiver/conflict/rebaseline |
| `pg` + SQL migrations | `020_*.sql`; Pool/PoolClient repos |
| `node:crypto` createHash | Optional version contentHash — reuse sorted-key canonical spirit if hashing |
| Test | `*.selfcheck.ts` + `tsx` — Vitest still deferred open carry-in |

### Latest technical specifics

- **Governance waivers:** Treat as expiring, version-bound exceptions; WAIVED ≠ PASS; renewal leaves history and requires fresh evidence (industry Policy-as-Code / waiver-register practice).
- **Immutability:** Prefer INSERT new versions + supersession pointers; PostgreSQL `BEFORE UPDATE` guards on approved version columns as defense-in-depth.
- **Do not** add Azure Policy / OPA / full PaC pipeline dependencies — stay in-repo PG + TypeScript gates.
- **Shared pure helpers** over copy-paste between migration waiver and global waiver to prevent rule drift.

### Previous story intelligence (7.6)

- FR-54 lives in `@divan/reporting`; **FR-55 is cross-cutting** — put substrate in `@divan/audit-envelope`, consumers elsewhere.
- Provisional strings were explicitly deferred to this story — replace/bind carefully on **new** publishes only.
- Review patches to anticipate: TX + required `appendAccessEvent`; DELETE forbid triggers; Persian labels not raw enums; capabilities failure must not hide all actions; soft PermissionSet after envelope; trust suspend; BOM-safe sprint-status.
- Dual-layer selfchecks (domain + web static wiring).
- Do not claim FR-55/56 done from 7.6 completion notes — this story owns FR-55 substrate claim only.

### Git intelligence

Recent commits: `014d3ce` story 7.6; `992bce2` story 7.5; `e9f1107` story 7.4; `4754116` story 7.3; `f29e3c7` story 7.2.  
Patterns to copy: provisional permission seeds, dual-layer selfchecks, Gate tables, dedicated `0xx_*.sql`, soft-deny secondary vs fail-closed primary, extend existing shells (ops/audit) rather than PlaceholderPage, review Patch triage after implement, thin `apps/web/src/server/*` routers, shared helpers instead of forked validators.

### Project context reference

- No `project-context.md` found in repo — rely on this story + architecture spine + `launch-artifacts.md` + addendum §1.1 + prior Epic 7 stories.
- Open Epic 6 action items still apply: AR fail-closed in Epic 7; artifact reauth already consumed by 6.5/7.1 — change-control retrieve/list must not invent a weaker authz path.
- Carry-ins still open (do not silently close): InferenceBulkPort ops doc; sticky break-glass; PopulationPort cutover; AD-6 hardening; ensure*Schema migrations-only; person-org scope on Cancel/Reverse/Correct; person-create form dedup; leave-guard on logout; Vitest/ephemeral isolation; Baseline projector gap.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7 / Story 7.7 AC]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-55, LG-1, LG-6, NFR-2 rebaseline, §7.1 Launch Artifact Register]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §1.1 Artifact and policy change control]
- [Source: `_bmad-output/specs/spec-divan/launch-artifacts.md` — AR id inventory + conflict rule]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5; FR-46..56 → kernel + modules + Launch Artifacts]
- [Source: `_bmad-output/implementation-artifacts/7-6-published-decision-report-reproducibility.md` — provisional version handoff]
- [Source: `_bmad-output/implementation-artifacts/6-4-migration-reconciliation-workspace.md` — FR-55 waiver shape precursor]
- [Source: `packages/modules/migration/src/reconciliation.ts` — `isWaiverExpired`, `setDiscrepancyDisposition`, unavailable hard-block]
- [Source: `packages/modules/reporting/src/decision-publication-permissions.ts` — provisional version consts]
- [Source: `packages/modules/person-employment/src/data-dictionary-types.ts` — `DATA_DICTIONARY_REGISTRY_VERSION`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Domain selfcheck: `pnpm --filter @divan/audit-envelope selfcheck:launch-artifact` (pure gates; DB skipped when unreachable)
- Web selfcheck: `pnpm --filter @divan/web selfcheck:launch-artifact`
- Typecheck: `@divan/audit-envelope`, `@divan/reporting`, `@divan/migration`, `@divan/person-employment`, `@divan/web`

### Completion Notes List

- FR-55 change-control substrate in `@divan/audit-envelope`: register, versions, waivers, conflicts, rebaselines; controlling-version resolver; `assertArtifactsUsable` conflict/expiry/rebaseline gates; shared `isWaiverExpired` / `assertWaiverAllowed` (migration recon imports shared expiry).
- Seeded eleven AR-* ids with honest `pending` / `partial_freeze` statuses; AR-DATA / AR-REPORTING / AR-NFR partial version labels; SoD gap documented (approve+manage on same `hr.admin` provisional set).
- Consumer hooks: decision publication stamps `controlling_artifact_versions` on **new** publishes and prefers register AR-REPORTING label with provisional honesty; data-dictionary `bindDataDictionaryRegistryVersion`; recon unavailable hard-block unchanged.
- UI choice: panel «ثبت آرتیفکت‌های پرتاب» under `/operations` (not a new `/governance` route).
- Hook points: `resolveControllingVersion` / `assertArtifactsUsable` in audit-envelope; `publishDecisionReport` + `020` additive jsonb; `bindDataDictionaryRegistryVersion`; migration `isWaiverExpired` import.
- Honesty: no LG-1/LG-6/FR-56 complete claims; automatic material-change detection not built (explicit `requireRebaseline`); cross-AR semantic oracle is explicit `openConflict` only.
- Apply `020_launch_artifact_change_control.sql` when Postgres is available (`pnpm --filter @divan/db sql:apply`).

### File List

- packages/kernel/audit-envelope/src/launch-artifact-permissions.ts
- packages/kernel/audit-envelope/src/launch-artifact-errors.ts
- packages/kernel/audit-envelope/src/launch-artifact.ts
- packages/kernel/audit-envelope/src/launch-artifact-repo.ts
- packages/kernel/audit-envelope/src/launch-artifact.selfcheck.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/src/index.ts
- packages/kernel/audit-envelope/package.json
- packages/db/sql/020_launch_artifact_change_control.sql
- packages/modules/identity-access/src/seed-launch-artifact.ts
- packages/modules/identity-access/src/seed.ts
- packages/modules/reporting/src/decision-publication-permissions.ts
- packages/modules/reporting/src/decision-publication.ts
- packages/modules/reporting/src/decision-publication-repo.ts
- packages/modules/reporting/src/index.ts
- packages/modules/migration/src/reconciliation.ts
- packages/modules/person-employment/src/data-dictionary-types.ts
- packages/modules/person-employment/src/data-dictionary.ts
- packages/modules/person-employment/src/index.ts
- apps/web/src/server/launch-artifact.ts
- apps/web/src/server/launch-artifact.selfcheck.ts
- apps/web/src/server/root.ts
- apps/web/app/(app)/operations/page.tsx
- apps/web/components/operations/launch-artifact-panel.tsx
- apps/web/lib/operational-copy.ts
- apps/web/package.json
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-7-launch-artifact-change-control-hooks.md

### Review Findings

- [x] [Review][Defer] SoD on version approve vs provisional same PermissionSet — deferred: keep provisional same `hr.admin` set until AR-ACCESS freeze (matches 7.6 SoD defer pattern); no creator≠approver enforce in 7.7
- [x] [Review][Patch] `approveRebaseline` must require resolvable controlling version for every affected AR before clearing block (no empty catch / no auto-approve drafts) [`packages/kernel/audit-envelope/src/launch-artifact.ts:749`]
- [x] [Review][Defer] Independent-approver attestation depth — deferred: free-text id ≠ requester/actor remains MVP until AR-ACCESS; UI hardcode still patched separately

- [x] [Review][Patch] Seed `setCurrentVersion` resets controlling pointer on every register read [`packages/kernel/audit-envelope/src/launch-artifact.ts:313`]
- [x] [Review][Patch] Seed `upsertArtifact` ON CONFLICT rewrites register `status` to seed meta [`packages/kernel/audit-envelope/src/launch-artifact-repo.ts:211`]
- [x] [Review][Patch] Publication consumer fail-opens: no `assertArtifactsUsable`; bare catch continues publish unbound [`packages/modules/reporting/src/decision-publication.ts:193`]
- [x] [Review][Patch] Immutable trigger omits `effective_from` / `effective_to` / `approval_history` [`packages/db/sql/020_launch_artifact_change_control.sql:179`]
- [x] [Review][Patch] `repo.approveVersion` UPDATE lacks `AND status = 'draft'` (TOCTOU race) [`packages/kernel/audit-envelope/src/launch-artifact-repo.ts:412`]
- [x] [Review][Patch] Ops UI hardcodes `independentApproverAccountId: "approver-independent"` on rebaseline approve [`apps/web/components/operations/launch-artifact-panel.tsx:469`]
- [x] [Review][Patch] Ops UI missing waiver close + open-waiver list (router has `closeWaiver`) [`apps/web/components/operations/launch-artifact-panel.tsx`]
- [x] [Review][Patch] Ops UI missing conflict resolve (router has `resolveConflict`) [`apps/web/components/operations/launch-artifact-panel.tsx`]
- [x] [Review][Patch] `resolveConflict` does not validate resolution version ids belong to conflict artifacts [`packages/kernel/audit-envelope/src/launch-artifact.ts:655`]
- [x] [Review][Patch] Wire `bindDataDictionaryRegistryVersion` into dictionary runtime path [`packages/modules/person-employment/src/data-dictionary.ts`]
- [x] [Review][Patch] Gate deny path records no required access evidence [`packages/kernel/audit-envelope/src/launch-artifact.ts:183`]
- [x] [Review][Patch] Concurrent status guards: `closeWaiver` / `resolveConflict` / `approveRebaseline` UPDATE without status predicate [`packages/kernel/audit-envelope/src/launch-artifact-repo.ts`]
- [x] [Review][Patch] `listArtifacts` query enabled while caps still undefined (`!== false`) [`apps/web/components/operations/launch-artifact-panel.tsx:71`]
- [x] [Review][Patch] Confirm approve dialog: no mutation error surface / pending disable [`apps/web/components/operations/launch-artifact-panel.tsx:459`]
- [x] [Review][Patch] `assertArtifactsUsable([])` / all-unknown ids returns ok [`packages/kernel/audit-envelope/src/launch-artifact.ts:183`]
- [x] [Review][Patch] `openConflict` allows duplicate identical AR ids to satisfy “≥2” [`packages/kernel/audit-envelope/src/launch-artifact.ts:619`]
- [x] [Review][Patch] Invalid `asOf` Date not rejected before controlling lookup [`packages/kernel/audit-envelope/src/launch-artifact.ts:129`]
- [x] [Review][Patch] `isNonWaiverableGate` is case/whitespace-sensitive [`packages/kernel/audit-envelope/src/launch-artifact-permissions.ts:72`]
- [x] [Review][Patch] `listOpenWaivers` skips `refreshExpiryStates` [`packages/kernel/audit-envelope/src/launch-artifact.ts:832`]
- [x] [Review][Patch] `actorHoldsLaunchPermission` lacks null-safe permissions array (vs publication helper) [`apps/web/src/server/launch-artifact.ts:96`]
- [x] [Review][Patch] Conflicts/rebaselines query errors rendered as empty lists [`apps/web/components/operations/launch-artifact-panel.tsx:379`]
- [x] [Review][Patch] Waiver `datetime-local` onChange can throw on Invalid Date [`apps/web/components/operations/launch-artifact-panel.tsx:588`]
- [x] [Review][Patch] `createVersion` / mutations should seed-or-404 before FK insert [`packages/kernel/audit-envelope/src/launch-artifact.ts:399`]
- [x] [Review][Patch] Add `enforceClockAnomalyOrThrow` to launch-artifact required write path [`packages/kernel/audit-envelope/src/launch-artifact.ts:260`]

- [x] [Review][Defer] Permission helper ignores inactive-role / org-scope filters [`apps/web/src/server/launch-artifact.ts:86`] — deferred, pre-existing
- [x] [Review][Defer] No `assertWaiverAllows` continued-use helper — deferred, pre-existing

## Change Log

- 2026-07-30: Story context created via bmad-create-story (ready-for-dev).
- 2026-07-30: Implemented FR-55 Launch Artifact change-control substrate + consumer hooks + ops UI; status → review.
- 2026-07-30: Code review findings appended (3 decision / 24 patch / 2 defer).
- 2026-07-30: Decision findings resolved by expert recommendation — SoD+attestation deferred; rebaseline fail-closed → patch; now 25 patch / 4 defer.
- 2026-07-30: Applied all 25 review patches; status → done.
