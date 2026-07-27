---
baseline_commit: f29e3c7
---

# Story 7.3: Retention, Disposal & Legal Hold

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As Legal/Privacy / HR Data Owner,
I want lifecycle enforcement for Data Elements and artifacts including legal hold,
so that disposal propagates without fabricating disposed facts (FR50).

**Story key:** `7-3-retention-disposal-legal-hold`  
**Epic:** 7 — Audit, Operations & Evidence Controls (FR42, FR45, FR50, FR51, FR53–FR56)  
**Prerequisite:** Epics 1–6 done; Stories **7.1** (audit investigation) and **7.2** (ops health) done. Existing substrate: Data Dictionary `DataElement.retention` string (metadata only — no enforcement); Story **6.5** export artifact revoke/dispose/expiry + custody (`disposeExportArtifact` domain exists; **tRPC dispose not wired**); import preview in-memory `purgeExpiredDrafts` (1h TTL — **not** AR-DATA disposal); append-only `kernel_events` with UPDATE/DELETE blocked; anonymized Return rematch hooks (4.5). **No** legal-hold product, **no** retention scheduler, **no** disposal propagation pipeline, **no** hold↔dispose coupling, **no** `data.lifecycle` permission/category, **no** retention UI route.

## Acceptance Criteria

1. **Given** provisional AR-DATA lifecycle classes (code-marked; fail-closed when incomplete)  
   **When** retention end or disposal is due for an in-scope subject/element/artifact set  
   **Then** required deletion / anonymization / restriction **propagates** to:
   - operational Person profile fields governed by the dictionary (values cleared or restricted per class — not silent history rewrite)
   - derived/search/report surfaces (projections omit disposed values; honesty when reconstruction is limited)
   - import/staging/error artifacts in scope (clear or mark disposed — do not leave executable PII blobs)
   - **active managed export artifacts** via existing `disposeExportArtifact` / revoke+clearContent (consume 6.5 — **no parallel SoT**)
   - caches/copies under Divan control (managed artifact bytes cleared)
   - backup/recovery hooks: record that restore catch-up must apply hold/disposal deltas (NFR-6 honesty) — **do not invent RPO/RTO or claim restore verified**

2. **And** historical / audit proof is **preserved**:
   - `kernel_events` rows remain append-only — **never** UPDATE/DELETE audit/business event rows to “comply”
   - access/business evidence for hold/release/disposal/failed propagation is attributable (actor, time, operation, scope, outcome, correlation)
   - reconstruction / profile / timeline / historical APIs that encounter disposed values **explicitly identify limits** and **never fabricate** disposed identity/facts (reuse Return anonymized rematch honesty spirit)

3. **Given** an active legal hold covering a subject / element category / artifact scope  
   **When** disposal (or artifact dispose that would erase held content) is attempted  
   **Then** disposal is **blocked** with Persian operational copy; hold does **not** break append-only audit; place / release / disposal / failed propagation are attributable and reconcilable (queryable evidence + correlation)

4. **And** lifecycle actions are **separately permissioned** (provisional fine permissions + seeded PermissionSet for intended owner — `hr.admin` until AR-ACCESS freezes a Legal/Privacy coarse role):
   - coarse `hr_admin` nav alone is insufficient
   - every policy read, hold place/release, and disposal run uses `governedProcedure` and is itself audited
   - SoD: do **not** auto-grant hold/disposal to `audit.investigate` or `ops.health.read`

5. **And** AR-DATA / AR-ACCESS / AR-AUDIT / AR-NFR / AR-MIGRATION / AR-REPORTING remain **fail-closed**:
   - Do **not** invent signed retention periods, jurisdiction-named regimes, or “GDPR Article X” claims (Product 2026-07-16: **no named regime for MVP** — hooks only)
   - Provisional lifecycle class codes OK if code-marked + seeded + fail-closed when metadata incomplete
   - Export artifact TTL (`EXPORT_ARTIFACT_TTL_MS` ~4h) is **not** AR-DATA retention — never relabel it as such in UI/copy
   - Do **not** enable person category id `health`; use a distinct lifecycle category (recommended `data.lifecycle`)

6. **And** migration / reconstruction honesty (Epic 6 retro → 7.1/7.2) still holds under disposal:
   - AD-6 orphans / events-only zero-trace / Baseline projector gaps / PopulationPort fixture — disclose; never invent clean cutover or disposed-then-restored facts
   - Managed custody boundary copy preserved: Divan disposes managed links/bytes; local/email/share copies remain org process (`CUSTODY_BOUNDARY_FA`)

7. **And** this story does **not** own: audit investigation UX changes (7.1 — consume patterns), ops health (7.2), audit trust writer fail-safe expansion (7.4), correction-case product (7.5 — may **link** disposal evidence ids for later), decision-report `non-reproducible-after-disposal` productization (7.6 — leave hook/status enum if cheap, do not ship publications), Launch Artifact change-control (7.7), evaluation-snapshot integrity (7.8), PopulationPort cutover, AD-6 Prisma↔PoolClient hardening, Vitest mandate, sticky break-glass UX debt, InferenceBulk distributed window, hash-chain tamper evidence

## Tasks / Subtasks

- [x] Task 1: Lifecycle domain + provisional permissions (AC: #3–#5)
  - [x] NEW under `@divan/audit-envelope` (preferred, mirrors 7.1/7.2) `data-lifecycle.ts`:
    - Constants: `DATA_LIFECYCLE_READ_PERMISSION = "data.lifecycle.read"`, `DATA_LIFECYCLE_HOLD_PERMISSION = "data.lifecycle.hold"`, `DATA_LIFECYCLE_DISPOSE_PERMISSION = "data.lifecycle.dispose"`, `DATA_LIFECYCLE_DATA_CATEGORY = "data.lifecycle"` (ordinary; **not** `health`)
    - Error types + Persian `messageFa` (e.g. `LIFECYCLE_DENIED`, `LEGAL_HOLD_ACTIVE`, `DISPOSAL_BLOCKED_BY_HOLD`, `DISPOSAL_PROPAGATION_FAILED`, `LIFECYCLE_METADATA_INCOMPLETE`)
    - Provisional lifecycle class codes (string enum, `@provisional-pending-AR-DATA-freeze`): e.g. `retain`, `anonymize_on_end`, `delete_on_end`, `restrict_on_end` — **no invented durations**; end action fails closed if class/metadata incomplete
    - DTOs: `LegalHoldRecord`, `DisposalRunRecord`, `PropagationTargetResult` (`target`, `outcome: applied|skipped|failed|blocked_by_hold`, `detailFa?`, `correlationId`)
  - [x] Register `data.lifecycle` in `DEV_DEMO_CATEGORIES` (+ production hooks list if pattern requires) — ordinary, `requiresSeparateExport: false`
  - [x] Add policy tuples to `DEV_DEMO_POLICY` for read / hold (write) / dispose (write) × `data.lifecycle` × `org:selfcheck`
  - [x] NEW `packages/modules/identity-access/src/seed-retention.ts` (mirror `seed-ops.ts` / `seed-audit.ts`): PermissionSet + AccessRole bound to **`hr.admin`**; warn if account missing; wire from `seed.ts`
  - [x] Export constants from package index

- [x] Task 2: Persistence — legal hold + disposal evidence (AC: #1–#3)
  - [x] NEW `packages/db/sql/016_data_lifecycle.sql` (or next free id after existing max — **do not fork** `015_export_artifacts`):
    - `data_lifecycle.legal_hold` (id, scope_kind, scope_ref, reason, placed_by, placed_at, released_by?, released_at?, status active|released, correlation_id, …)
    - `data_lifecycle.disposal_run` (id, trigger, scope, actor, started_at, completed_at?, status, correlation_id, …)
    - `data_lifecycle.propagation_result` (run_id, target_kind, target_id, outcome, detail, …)
    - Indexes for active-hold lookup by scope; **no** DELETE of hold history rows (release = status flip + attributable event — retain row for reconcilability)
  - [x] Prefer `pg` Pool/PoolClient repo helpers in a module home:
    - **Recommended:** NEW `packages/modules/person-employment/src/data-lifecycle-repo.ts` + `data-lifecycle.ts` orchestration (dictionary + Person values live here) **or** document Option B under a small dedicated package if BC fights — web stays thin either way
  - [x] Ensure schema via migration SQL file + existing ensure-* pattern **or** migrations-only if touching this path already (do not expand `ensure*Schema` sprawl without noting Gate)

- [x] Task 3: Hold gate + dispose coupling on artifacts & runners (AC: #1, #3, #6)
  - [x] UPDATE `disposeExportArtifact` / `revokeExportArtifact` (and any disposal runner entry):
    - Before clearing bytes / marking disposed, query active legal hold intersecting artifact scope (person ids / category / artifact id as recorded)
    - If held → throw `DISPOSAL_BLOCKED_BY_HOLD` with Persian copy; append access event `result: deny`
    - Lazy expiry path that clears bytes must respect the same hold gate
  - [x] UPDATE `apps/web/src/server/export-artifact.ts`: expose `export.dispose` (or equivalent) via `governedProcedure` using existing export permissions **plus** hold check inside domain — do not invent `audit.*` byte path
  - [x] Disposal orchestrator `runDisposal(scope)` (name flexible):
    1. Refuse if active hold intersects scope
    2. For each target class: exports → `disposeExportArtifact`; staging/error blobs → clear/mark; Person dictionary fields → anonymize/restrict/delete per provisional class; derived projections → refresh or mark limited
    3. Persist per-target `propagation_result`; any failure → run status `failed` / partial with reconcilable evidence — **never** claim full success with silent skips
    4. Append attributable access (and business where appropriate) events for place/release/dispose/fail
  - [x] Backup hook: write honesty flag / evidence row that restore catch-up must re-apply holds/disposals — surface in ops backup section is **optional** one-liner reuse of 7.2 honesty; do not fake restore OK

- [x] Task 4: Dictionary retention metadata enforcement hook (AC: #1, #5)
  - [x] UPDATE data-dictionary enablement path: retention metadata must parse to a known provisional class code (or structured token) before enable — free-text `"workforce-master-data retention (AR-DATA)"` alone is **insufficient for disposal enforcement**; migrate seed `approveMeta.retention` to provisional codes **or** map known seed strings → codes in one place
  - [x] Fail closed: disposal for an element with incomplete/unknown class → `LIFECYCLE_METADATA_INCOMPLETE` (do not invent end action)
  - [x] Do **not** rewrite historical Employment/Assignment/compensation facts in place — disposal of master-data fields ≠ temporal event rewrite (AD-2)

- [x] Task 5: Reconstruction honesty — never fabricate disposed facts (AC: #2)
  - [x] Where profile / search / historical reconstruction reads disposed/anonymized fields: return explicit limit (Persian disclosure) — mirror Baseline / anonymized Return honesty
  - [x] Touch points (extend, do not fork): `getCurrentPersonState` assembler disclosures; profile section omit/limit flags; search list field omission — reuse `MSG_BASELINE_DISCLOSURE_*` voice pattern with NEW disposal-limit copy keys if needed
  - [x] Audit investigation (7.1) continues to read append-only events; if payloads were minimized at write time, show what remains — do not invent missing values
  - [x] Document Gate: FR-54 `non-reproducible-after-disposal` for formal publications is **7.6** — optional stub status string only if zero-cost; do not ship publisher UI

- [x] Task 6: Governed tRPC + UI surface (AC: #1–#4)
  - [x] NEW `apps/web/src/server/retention.ts` — thin router:
    - `retention.listHolds` / `retention.placeHold` / `retention.releaseHold` / `retention.runDisposal` / `retention.getRun` (names flexible)
    - Meta: matching provisional permissions × `data.lifecycle` × action read|write; `operation` strings stable for audit
    - Soft PermissionSet gate after envelope (mirror audit/ops)
    - Soft-return / soft-deny posture on allow-path access-event append failure (mirror 7.1/7.2 review patches) — never mask primary `FORBIDDEN`
    - Map errors to `operational-copy` — never forward raw `error.message`
  - [x] Register in `apps/web/src/server/root.ts`
  - [x] UI (pick **one**; document choice in Completion Notes):
    - **Preferred:** extend `apps/web/app/(app)/personnel/(tabs)/dictionary/page.tsx` (+ NEW panel component) with Legal Hold + Disposal Runs section — already Admin-gated; no new top-level IA
    - **Alt:** NEW `/data-lifecycle` only if product insists — then UPDATE `NAV_CATALOG` + `ROLE_NAV_HREFS` + sidebar + route-announcer + Layout≠RSC `assertPageAccess` (do not invent IA lightly)
  - [x] Layout≠RSC: `auth()` → `assertPageAccess` → client panel
  - [x] Persian RTL + Persian digits; UX-DR24 voice; Skeleton cold load; error ≠ empty; destructive confirm for place-hold / run-disposal; single dialog depth; leave-guard only if dirty draft
  - [x] Interactive a11y: labeled controls; focus restore; 200% zoom; status not color-only
  - [x] All new copy in `apps/web/lib/operational-copy.ts`

- [x] Task 7: Verify + DoD (AC: #1–#7)
  - [x] NEW selfcheck(s): deny without permission; `hr.admin` seed can place/release/dispose; active hold blocks `disposeExportArtifact`; disposal without hold clears managed export bytes; incomplete lifecycle metadata fails closed; `kernel_events` still reject UPDATE/DELETE; no person `health` category enablement; DTO/audit payloads omit unnecessary HR value duplication
  - [x] Wire `selfcheck:retention` (or package scripts) in envelope / person-employment / reporting / web as appropriate
  - [x] `pnpm` typecheck + eslint on touched packages
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits

### Manual DoD checklist

- [x] Unauthorized roles cannot call retention mutations/reads (envelope deny + audited)
- [x] `hr.admin` with seed can place hold, release hold, run disposal (dev bootstrap)
- [x] Active hold blocks export dispose/revoke-clear and orchestrated disposal — Persian reason
- [x] Successful disposal clears managed export content bytes + marks disposed; download denies with existing codes
- [x] Hold/release/disposal/failed propagation visible as attributable evidence (access events and/or lifecycle tables + correlation)
- [x] Profile/reconstruction after anonymize/delete shows explicit limits — no fabricated former values
- [x] `kernel_events` append-only preserved (no row delete for “erasure”)
- [x] Category `health` (person) remains disabled; lifecycle uses `data.lifecycle`
- [x] Export 4h TTL not presented as AR-DATA retention policy
- [x] Custody boundary honesty preserved at download
- [x] No secrets / raw infra errors in UI; Persian RTL / digits
- [x] Sprint may claim FR-50 **substrate + enforcement hooks** — **not** full AR-DATA freeze, jurisdiction program, or witnessed backup purge evidence (LG-3 partial)

### Review Findings

- [x] [Review][Decision] org_scope hold intersection semantics — resolved: option (3) exact `scopeKind=org_scope` only (no invented org membership)
- [x] [Review][Decision] element_category / org_scope dispose → Person field propagation — resolved: option (2) require `personIds` and/or `artifactIds`; UI collects subjects; refuse with `DISPOSAL_SCOPE_INCOMPLETE`
- [x] [Review][Decision] Transactional dispose vs intentional partial — resolved: option (3) re-check active holds immediately before each destructive write

- [x] [Review][Patch] Empty personIds staging wipe-all — never pass null/empty as match-all; skip or refuse [`packages/modules/person-employment/src/data-lifecycle.ts`]
- [x] [Review][Patch] Refuse disposal with no concrete targets (empty mixed / no personIds+artifactIds+category) [`packages/modules/person-employment/src/data-lifecycle.ts`]
- [x] [Review][Patch] Person-field erase must consult active `element_category` holds for that element's category before apply [`packages/modules/person-employment/src/data-lifecycle.ts`]
- [x] [Review][Patch] `scopeSubjectIds` must also read `scope_json.personId` (list path already does) [`packages/modules/reporting/src/export-artifact.ts`]
- [x] [Review][Patch] Search/list surfaces need disposal-limit honesty (Task 5 / AC1–AC2) [`packages/modules/person-employment/src/personnel-list-projector.ts`]
- [x] [Review][Patch] `getDisposalLimitDisclosure` errors must not soft-map to `limited:false` except missing-relation [`packages/modules/person-employment/src/current-person-state.ts`]
- [x] [Review][Patch] Staging person match via `values::text LIKE` is substring-unsafe — use jsonb containment / structured keys [`packages/modules/person-employment/src/data-lifecycle.ts`]
- [x] [Review][Patch] Add unique partial index on active `(scope_kind, scope_ref)` [`packages/db/sql/016_data_lifecycle.sql`]
- [x] [Review][Patch] Anonymize/restrict must not embed `personId` prefix in opaque token [`packages/modules/person-employment/src/data-lifecycle.ts`]
- [x] [Review][Patch] Partial disposal run must not append access-event `result: deny` while returning success [`packages/modules/person-employment/src/data-lifecycle.ts`]
- [x] [Review][Patch] Missing `data_lifecycle` schema on expiry/dispose hold check should soft as no-hold (or clear path), not hard-fail download [`packages/modules/reporting/src/export-artifact.ts`]
- [x] [Review][Patch] Absent `migration_staging` should record staging outcome `skipped`, not `failed` [`packages/modules/person-employment/src/data-lifecycle.ts`]
- [x] [Review][Patch] Export selfcheck must not silently skip legal-hold assert when schema missing [`packages/modules/reporting/src/export-artifact.selfcheck.ts`]
- [x] [Review][Patch] `placeHold` reject whitespace-only reason/scopeRef after trim [`packages/modules/person-employment/src/data-lifecycle.ts`]
- [x] [Review][Patch] `releaseHold` not-found/already-released must not use `LIFECYCLE_DENIED` (authz conflation) [`packages/modules/person-employment/src/data-lifecycle.ts`]
- [x] [Review][Patch] `backup_restore_hook` propagation outcome should not claim `applied` for an honesty note [`packages/modules/person-employment/src/data-lifecycle.ts`]
- [x] [Review][Patch] Require disposal reason on UI/API for attributable dispose (mirror place-hold) [`apps/web/components/personnel/personnel-lifecycle-panel.tsx`]

- [x] [Review][Defer] `listHolds` / `listRuns` return unscoped global sets — deferred, pre-existing MVP org:selfcheck listing pattern [`apps/web/src/server/retention.ts`]

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Enforce provisional lifecycle classes + legal hold blocking disposal | Invent signed retention years / named legal regimes |
| Propagate disposal to ops fields, derived views, staging/export artifacts under Divan control | Claim purge of local/email/share copies |
| Consume 6.5 `disposeExportArtifact` / revoke+clearContent | Parallel artifact byte SoT or `audit.*` download |
| Preserve append-only `kernel_events`; minimize/anonymize values elsewhere | DELETE/UPDATE audit rows to satisfy erasure |
| Reconstruction discloses limits; never fabricate disposed facts | Silent restore of disposed identity values |
| Provisional `data.lifecycle.*` perms + seed for `hr.admin`; envelope on every call | Coarse `hr_admin` nav alone as authz; auto-grant to audit/ops |
| Use category `data.lifecycle` | Enable/reuse person `health` |
| Attribute hold/release/disposal/failed propagation | Silent unattributable disposal |
| Fail closed on incomplete AR-DATA metadata | Guess end actions from free-text retention blurbs |
| Thin web; domain in packages; operational-copy Persian | English placeholders; PlaceholderPage left as “done” |

### Absolute non-goals

- Story 7.1 audit investigation feature changes (consume Layout≠RSC / seed / governed / soft-deny patterns only)
- 7.2 ops health feature changes (optional one-line backup honesty only)
- 7.4 clock-anomaly / integrity-verification product; 7.5 correction-case UI (linkable evidence ids OK); 7.6 formal publication reproducibility UI; 7.7–7.8
- Hash-chain tamper evidence; AuthAttempt/AccessDenial historical backfill
- PopulationPort default-registry cutover; AD-6 Prisma↔PoolClient orphan fix; `ensure*Schema` migrations-only program
- Person-org IDOR on Cancel/Reverse/Correct; Add/QuickCreate dedupe; logout→`requestNavigation`
- Vitest mandate (selfcheck `tsx` remains house pattern)
- Sticky break-glass + fingerprint UX debt; InferenceBulk distributed window
- Replacing infra backup agents or inventing RPO/RTO displays

### UPDATE files — current state → this story → preserve

| File | Current (post-7.2) | Change | Preserve |
| --- | --- | --- | --- |
| `packages/modules/reporting/src/export-artifact.ts` | `disposeExportArtifact` / revoke / lazy expiry — **no hold check** | Gate dispose/expiry-clear on active hold; keep clearContent | Reauth/custody/TTL semantics; `CUSTODY_BOUNDARY_FA` |
| `apps/web/src/server/export-artifact.ts` | create/get/download/**revoke** — **no dispose** | Wire dispose; hold enforced in domain | `export.retrieve` + reauth contract |
| `packages/modules/person-employment/src/data-dictionary*.ts` | `retention` free string; seed blurb | Provisional class codes + fail-closed disposal hook | Enablement completeness; AD-2 no history rewrite |
| `getCurrentPersonState` / profile assemblers | Baseline disclosure flags | Disposal/anonymize limit disclosures when values gone | Existing projection semantics; no fabricated fills |
| `packages/kernel/audit-envelope` | `audit.evidence` + `ops.platform` | Add `data.lifecycle` + perms + policy | Default-deny; do not enable person `health` |
| `packages/modules/identity-access` | `seed-audit` / `seed-ops` / `seed-export` | NEW `seed-retention` → `hr.admin` | Nav matrix; SoD for audit/ops |
| `apps/web/src/server/root.ts` | audit + operations + export | Register `retention` router | Existing routers |
| `apps/web/lib/operational-copy.ts` | audit/ops/export strings | Hold/disposal/incomplete/blocked copy | UX-DR24; exact LDAP/custody strings |
| `apps/web/app/(app)/personnel/(tabs)/dictionary/page.tsx` | Dictionary Admin UI | Preferred: add hold/disposal panel | Admin gate; Layout≠RSC |
| `packages/db/sql/015_export_artifacts.sql` | Export lifecycle states include `disposed` | **Reuse** — do not fork | State machine |
| NEW `016_data_lifecycle.sql` + domain/repo | Absent | Hold + disposal run + propagation evidence | Append-only audit untouched |
| NEW retention router + selfchecks | Absent | Full governed API | Soft-deny posture from 7.1/7.2 |

### Architecture compliance

- **AD-1:** Single app process + one PG — lifecycle tables in same DB; optional pg-boss job later for due disposals (MVP may be on-demand `runDisposal` only — document if scheduler deferred)
- **AD-2:** Dictionary/master-data disposal ≠ rewriting Employment/Assignment history cells
- **AD-3:** Web → modules → kernel; no Prisma for `kernel_events`; export disposal stays in `@divan/reporting`; orchestration calls module APIs
- **AD-5:** Coarse nav + fine envelope; access events for lifecycle reads/mutations
- **AD-6:** Raw SQL/`pg` for new lifecycle schema OK; keep event-store append-only triggers intact
- **Capability map:** FR-50 → AR-DATA lifecycle + modules; FR-52 artifact branch → reporting (consume); FR-45 backup honesty → ops hooks only
- **Infra brief:** “Legal hold must block disposal without breaking append-only audit”; retention events/access logs may outlive projections

### Consumer / artifact dispose contract (encode — do not rediscover)

```text
on retention.runDisposal(scope) | export.dispose(artifactId):
  load active legal holds intersecting scope/artifact
  if any active hold → DISPOSAL_BLOCKED_BY_HOLD (deny + access event)
  # managed export path only:
  disposeExportArtifact / revoke+clearContent  # existing 6.5
  # never:
  audit.* byte endpoint, parallel Base64 store, DELETE kernel_events
  # after value disposal:
  reconstruction/profile must disclose limits; never fabricate
```

Investigation open-artifact (7.1) unchanged: expired|revoked|disposed → existing deny codes.

### Legal hold vs append-only audit (normative)

Industry / architecture alignment (2026): erasure/anonymization targets **operational PII and managed artifacts**; audit rows stay immutable (trigger-enforced). Prefer pseudonymization / minimized payloads over deleting evidence. Hold checks run **before** partition drops or disposal jobs — Divan MVP: hold check before any dispose/clearContent path. Hash-chain remains out of scope until AR-AUDIT freezes it.

### Permission seeding (provisional)

| Key | Use | Seed bind |
| --- | --- | --- |
| `data.lifecycle.read` | List holds / runs / policy view | `hr.admin` |
| `data.lifecycle.hold` | Place / release legal hold | `hr.admin` |
| `data.lifecycle.dispose` | Run disposal / export.dispose orchestration | `hr.admin` |
| Existing `export.retrieve` / revoke | Artifact bytes & revoke UI | Unchanged 6.5 (`hr.admin` via seed-export) |

Mark `@provisional-pending-AR-ACCESS-freeze` / `@provisional-pending-AR-DATA-freeze`. Fail-closed for unseeded roles.

### Migration-evidence honesty (still mandatory)

| Fact | Lifecycle must |
| --- | --- |
| AD-6 Person orphans possible | Not present disposal as proof of clean cutover |
| events-only zero-trace | Label; do not upgrade claim after disposal |
| Baseline projector gap | Do not invent Employment/Assignment from Baseline to “fill” after anonymize |
| PopulationPort fixture-default | Disclose if population-scoped claims appear |
| Export Base64 size cap defer (6.5) | Do not expand unbounded download via retention UI |
| Import draft TTL ≠ retention | Do not call `purgeExpiredDrafts` a FR-50 control |

### UX notes

- No dedicated retention journey in ux-divan-2026-07-19 — prefer dictionary Admin extension over inventing top-level IA
- Correction-cases remain PlaceholderPage (7.5) — do not overload that route with FR-50 product
- Empty holds: Persian empty copy; blocked dispose: fact + next step (release hold / contact Legal)
- Destructive: confirm place-hold and run-disposal; release-hold confirms too

### AR honesty

- AR-DATA open: lifecycle classes, legal holds, jurisdiction, backup/copy treatment — implement **substrate + fail-closed defaults**
- Forbidden: claiming LG-3 / full FR-50 production evidence complete; inventing jurisdiction; inventing FR-54 publication package (7.6)

### Known gaps to document (do not silently “fix” as done)

| Gap | Handling in 7.3 |
| --- | --- |
| AR-DATA lifecycle classes not frozen | Provisional codes + fail-closed |
| No Legal/Privacy coarse role | Seed fine perms on `hr.admin`; document |
| Backup physical purge / restore acceptance | Honesty hook only (7.2 substrate) |
| Scheduler for “retention end due” | On-demand run OK for MVP; optional pg-boss deferred with note |
| FR-53 linkage | Return disposal_run id for 7.5 to consume later |
| FR-54 non-reproducible package | Non-goal (7.6) |
| Hash-chain | Non-goal until AR-AUDIT freezes |
| PopulationPort / AD-6 orphans | Honesty; non-goal to fix |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Existing monorepo | Node 22 / TS 5.x / pnpm — no new framework |
| PostgreSQL | NEW `016_…` lifecycle schema; keep export `015` |
| `pg` Pool/PoolClient | Lifecycle repo + event append |
| tRPC `governedProcedure` | All retention procedures |
| `@divan/audit-envelope` | Permissions, category, policy, errors |
| `@divan/reporting` | **Must** consume dispose/revoke — extend hold gate |
| `@divan/person-employment` | Dictionary + Person anonymize/restrict orchestration |
| `@divan/event-store` | Append access/business evidence; **no** row deletes |
| `@divan/identity-access` | `seed-retention.ts` |
| `@divan/migration` | Staging/error artifact clear hooks if in scope |
| Selfcheck (`tsx`) | House pattern |
| UI | Existing dictionary chrome / GovernedDataTable if listing runs; operational-copy; Dialog confirm |

### File structure requirements

```text
packages/db/sql/
  016_data_lifecycle.sql                    # NEW (id = next free)

packages/kernel/audit-envelope/src/
  data-lifecycle.ts                         # NEW constants/DTO/errors
  data-lifecycle.selfcheck.ts               # NEW
  categories.ts / index.ts                  # UPDATE registry + policy + exports

packages/modules/person-employment/src/
  data-lifecycle.ts                         # NEW orchestration (or document alt home)
  data-lifecycle-repo.ts                    # NEW
  data-dictionary-types.ts / data-dictionary.ts  # UPDATE retention class codes
  index.ts / package.json                   # UPDATE exports/scripts

packages/modules/reporting/src/
  export-artifact.ts                        # UPDATE hold gate
  export-artifact.selfcheck.ts              # UPDATE hold cases

packages/modules/identity-access/src/
  seed-retention.ts                         # NEW
  seed.ts / index.ts                        # UPDATE wire

apps/web/src/server/
  retention.ts                              # NEW thin router
  retention.selfcheck.ts                    # NEW
  export-artifact.ts                        # UPDATE dispose procedure
  root.ts                                   # UPDATE register

apps/web/components/…/                      # NEW hold/disposal panel (under dictionary or retention/)
apps/web/app/(app)/personnel/(tabs)/dictionary/page.tsx  # UPDATE preferred
apps/web/lib/operational-copy.ts            # UPDATE
```

### Testing requirements

- Domain: hold blocks dispose; release allows dispose; incomplete metadata fails; propagation_result records failures; unauthorized deny
- Reporting selfcheck: hold intersects artifact → dispose throws; without hold → disposed + bytes cleared
- Event-store regression: append-only trigger still rejects UPDATE/DELETE
- Web smoke: router registered; dictionary panel or chosen surface not Placeholder for lifecycle section; Layout≠RSC holds
- Regression: 6.5 download reauth/custody; 7.1 investigation; 7.2 ops health; login LDAP outage copy

### Previous story intelligence (7.2 / 7.1 / 6.5)

- **7.2:** Domain constants in audit-envelope; probes in modules; soft-deny on allow-path append fail; never forward raw `error.message`; strip personIds from aggregates; BOM-safe yaml; category collision lesson (`ops.platform` ≠ `health`); throttle destructive probes
- **7.1:** Consume-6.5 artifact contract; soft PermissionSet gate; toxic self-review pattern; migration-evidence honesty banners; Layout≠RSC
- **6.5:** `disposeExportArtifact` + lifecycle_event table already exist — **wire + hold-gate**, do not reimplement; custody boundary normative; action/meta must match; export TTL ≠ retention policy (already documented)
- **Epic 6 retro:** consume artifact reauth/custody/revoke into 7.3 retention productization — this story closes that for dispose/hold
- **3.3:** Dictionary mandatory metadata includes `retention` — upgrade from blurb to enforceable class without breaking enablement seeds
- **4.5:** anonymized Return rematch — reuse honesty for post-disposal identity limits

### Git intelligence summary

Recent commits: `f29e3c7` story 7.2; `08bff26` story 7.1; `d9e9eba` epic 6 retro; `b611ea4` story 6.5. Patterns to copy: provisional permission seeds (`seed-ops` / `seed-audit` / `seed-export`), dual-layer selfchecks, Gate tables, Absolute non-goals, adversarial review Patch/Decision/Defer triage expected after implementation.

### Latest tech information

- Append-only audit + legal hold: block disposal/purge while hold active; do not DELETE audit rows for erasure — minimize/pseudonymize operational PII and keep evidence attributable ([immutable audit / hold-before-purge guidance](https://viprasol.com/blog/saas-audit-trail/), [B2B audit log architecture](https://wolf-tech.io/blog/audit-log-architecture-for-b2b-saas-tamper-evident-logs-enterprise-buyers-actually-trust))
- Divan already enforces append-only via triggers on `kernel_events` — retain; hash-chain still AR-AUDIT-optional
- Prefer on-demand disposal + explicit hold table for MVP; partition-drop retention schedulers are premature without AR-DATA freeze

### Project context reference

- No `project-context.md` found in repo at create time — rely on Architecture Spine AD-1..6, infra-security-brief §4, epics.md Epic 7 Story 7.3, PRD FR-50/52/NFR-6/8, UX 2026-07-19 (dictionary/admin patterns), and this story file
- Communication with user: Persian; story document language: English (BMad config)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7 / Story 7.3]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-50, FR-52, NFR-6, NFR-8, AR-DATA open decisions]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md` — §4 Retention / Legal hold]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-5, AD-6]
- [Source: `_bmad-output/implementation-artifacts/7-2-operations-health-without-hr-content.md` — seed/ops patterns; non-goal 7.3]
- [Source: `_bmad-output/implementation-artifacts/7-1-audit-investigation-surface.md` — consume-6.5; honesty]
- [Source: `_bmad-output/implementation-artifacts/6-5-governed-export-artifact-panel.md` — dispose/revoke/custody]
- [Source: `packages/modules/reporting/src/export-artifact.ts` — `disposeExportArtifact`]
- [Source: `packages/modules/person-employment/src/data-dictionary-types.ts` — retention metadata]
- [Source: `packages/db/sql/015_export_artifacts.sql` — artifact states including `disposed`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- `pnpm --filter @divan/audit-envelope selfcheck:data-lifecycle` — ok
- `pnpm --filter @divan/person-employment selfcheck:data-lifecycle` — ok (pure + db hold gate)
- `pnpm --filter @divan/web selfcheck:retention` — ok
- `pnpm --filter @divan/reporting selfcheck:export-artifact` — ok (incl. hold blocks dispose)
- `pnpm --filter @divan/event-store selfcheck` — ok (append-only)
- `pnpm --filter @divan/person-employment selfcheck:data-dictionary` / `selfcheck:current-person-state` — ok
- Typecheck: audit-envelope, person-employment, reporting, web — ok
- eslint on retention/export/lifecycle panel/operational-copy — ok
- `pnpm db:sql:apply` — 016_data_lifecycle.sql applied

### Completion Notes List

- Implemented FR-50 substrate: provisional `data.lifecycle.*` permissions + category (not person `health`), seeded on `hr.admin` via `seed-retention.ts`.
- SQL `016_data_lifecycle.sql`: legal_hold (no DELETE; release = status flip), disposal_run, propagation_result, disposed_field markers; migrations-only (no ensure*Schema sprawl).
- Hold gate on `disposeExportArtifact` / `revokeExportArtifact` / lazy expiry clear; `export.dispose` wired via governedProcedure.
- `runDisposal` in person-employment with injected reporting dispose (avoids BC cycle); restore catch-up honesty flag; staging value clear; person field anonymize/delete/restrict per provisional class; AD-2 no history rewrite.
- Dictionary: seed retention → `retain`; enablement requires parseable provisional class; legacy blurb mapped once.
- Reconstruction: `disposalDisclosure` on `getCurrentPersonState` + profile alert; never fabricates prior values.
- UI choice: **Preferred** — Legal Hold + Disposal panel under dictionary Admin tab (`PersonnelLifecyclePanel`); no new top-level IA.
- Scheduler for retention-end deferred (on-demand `runDisposal` only) — documented.
- FR-54 publication non-reproducible package remains 7.6 non-goal.

### File List

- packages/kernel/audit-envelope/src/data-lifecycle.ts
- packages/kernel/audit-envelope/src/data-lifecycle.selfcheck.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/src/index.ts
- packages/kernel/audit-envelope/package.json
- packages/db/sql/016_data_lifecycle.sql
- packages/modules/identity-access/src/seed-retention.ts
- packages/modules/identity-access/src/seed.ts
- packages/modules/person-employment/src/data-lifecycle-repo.ts
- packages/modules/person-employment/src/data-lifecycle.ts
- packages/modules/person-employment/src/data-lifecycle.selfcheck.ts
- packages/modules/person-employment/src/data-dictionary.ts
- packages/modules/person-employment/src/data-dictionary-types.ts
- packages/modules/person-employment/src/current-person-state.ts
- packages/modules/person-employment/src/personnel-list-projector.selfcheck.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/package.json
- packages/modules/reporting/src/export-artifact.ts
- packages/modules/reporting/src/export-artifact.selfcheck.ts
- packages/modules/reporting/src/index.ts
- apps/web/src/server/retention.ts
- apps/web/src/server/retention.selfcheck.ts
- apps/web/src/server/export-artifact.ts
- apps/web/src/server/root.ts
- apps/web/src/server/operations.ts
- apps/web/lib/operational-copy.ts
- apps/web/lib/person-profile.selfcheck.ts
- apps/web/components/personnel/personnel-lifecycle-panel.tsx
- apps/web/components/personnel/person-profile-view.tsx
- apps/web/app/(app)/personnel/(tabs)/dictionary/page.tsx
- apps/web/package.json
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-3-retention-disposal-legal-hold.md

### Change Log

- 2026-07-27: Story 7.3 — retention / legal hold / disposal substrate + enforcement hooks (FR-50); status → review
- 2026-07-28: Code review — decisions applied (org exact-match; require dispose subjects; hold re-check); 16 patches fixed; status → done
