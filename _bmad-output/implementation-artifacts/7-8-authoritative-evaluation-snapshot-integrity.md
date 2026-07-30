---
baseline_commit: fde870b
---

# Story 7.8: Authoritative Evaluation Snapshot Integrity

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a Product / Architecture owner of finalize, import, and export paths,
I want mutable reference data and result sets resolved against one attributable snapshot,
so that concurrent changes cannot produce partially valid authoritative operations (FR56).

**Story key:** `7-8-authoritative-evaluation-snapshot-integrity`  
**Epic:** 7 — Audit, Operations & Evidence Controls (FR42, FR45, FR50, FR51, FR53–FR56)  
**Prerequisite:** Epics 1–6 done; Stories **7.1–7.7** done. Existing precursors (do **not** reinvent):

| Precursor | Location | What it already does | Gap vs FR-56 product |
| --- | --- | --- | --- |
| Finalize `EvaluationSnapshot` | `person-employment` `personnel-event-conflicts.ts` / finalize | TX-local person/employment stamps + permission fingerprint; `assertSnapshotFresh` → `FINALIZE_STALE_SNAPSHOT` | Domain-local only; no shared handle across import/export/publish/pagination; no content hash registry |
| Export `StableSnapshotInput` + `computeExportSnapshotHash` | `reporting` `export-artifact.ts` | SHA-256 over filters/fields/asOf/source; `SNAPSHOT_MISMATCH` | Filters/fields hash — not full reference-data freeze; not shared with finalize |
| Decision publication provisional bind | `reporting` `decision-publication.ts` | Reuses export hash; `PUBLICATION_SNAPSHOT_MISMATCH`; honesty-deferred FR-56 | Still provisional; must consume 7.8 substrate |
| Import revalidate + concurrent mutex | `migration` `execute-batch.ts` / `concurrent-mutex` | Revalidate org/role refs; block overlapping batches | No attributable evaluation-snapshot id/version bound for whole cutover |
| Governed table “snapshot” | `apps/web/.../governed-data-table/snapshot.ts` | Client filter/sort scrub + page reset | **Not** FR-56 evaluation snapshot — do not conflate |
| Dashboard snapshot | `reporting` `dashboard-snapshot.ts` | Dashboard metric assembly (5.4) | **Not** FR-56 |
| Launch Artifact “integrity” non-waiverable | 7.7 | NFR-4 / append-only gate code | Different product — do not merge registers |

**No** unified evaluation-snapshot substrate, shared version/handle API, cross-path mixing prevention, or claim that FR-56 / LG-1 / LG-4 snapshot acceptance is production-complete.

### Critical naming distinction (do not conflate)

| Concept | Owner | Meaning |
| --- | --- | --- |
| **Finalize `EvaluationSnapshot` object** (4.2) | person-employment | TX-scoped conflict evaluation stamps — **adapter/consumer** of this story’s shared contract |
| **Export / publication hash** (6.5 / 7.6) | reporting | Canonical SHA-256 of reviewed filters/fields/asOf — **reuse**, do not invent a parallel hash stack |
| **GovernedDataTable snapshot** (4b/5.x UX) | web table primitive | Stable **query** pagination scrub (FR-33 UX) — not evaluation-snapshot SoT |
| **Launch Artifact Register** (FR-55) | Story 7.7 | Policy/acceptance AR-\* versions — **orthogonal**; honor `assertArtifactsUsable` where consumers already call it |
| **Audit trust integrity failure** (FR-51 / 7.4) | audit-envelope | Writer suspend / integrity verify fail — may **block** snapshot-bound mutations; not the snapshot product |
| **Authoritative evaluation snapshot** (FR-56) | **This story** | One attributable validated snapshot/version for finalize, import execution, pagination, export, formal publication — complete against it or fail without mixing versions |

Use type/API names like `AuthoritativeEvaluationSnapshot` / `evaluationSnapshot.*` / «اسنپ‌شات ارزیابی معتبر» — never rename export downloads, Launch Artifacts, dashboard metrics, or table filter scrub as “evaluation snapshot integrity product.”

## Acceptance Criteria

1. **Given** finalization, import execution, pagination, export generation, or formal report publication  
   **When** the operation runs  
   **Then** it completes against **one** validated snapshot/version **or fails** without mixing versions  
   **And** every successful authoritative completion records an attributable snapshot reference (stable id and/or content fingerprint + correlation) usable in evidence/audit metadata

2. **Given** organization/reference data changes, concurrent imports, or permission-set changes while an authoritative operation is in flight (or between client-reviewed snapshot and server apply)  
   **When** the operation would otherwise mix versions or partially apply  
   **Then** the system **blocks** / fails closed with a surfaced conflict — **no** silent overwrite, **no** out-of-scope delivery, **no** partial authoritative success that spans two evaluation versions

3. **And** conflicts are surfaced with Persian operational copy (distinct codes; not English enum dumps):
   - snapshot mismatch / stale snapshot / version mix / concurrent reference change / permission fingerprint change
   - Preserve existing domain codes where they already map (`FINALIZE_STALE_SNAPSHOT`, `SNAPSHOT_MISMATCH`, `PUBLICATION_SNAPSHOT_MISMATCH`, `CONCURRENT_BATCH`, `REVALIDATION_FAILED`) — unify under shared helpers; do not create divergent parallel messages for the same failure

4. **And** consumer wiring is **minimal viable but real** on all five FR-56 paths (document exact hook points in Completion Notes):
   - **Finalization (4.2)** — continue TX-local rebuild + `assertSnapshotFresh`; bind/emit shared evaluation-snapshot handle on successful finalize; optional registry persist only if needed for evidence (TX-local may remain primary for finalize)
   - **Import execution (6.2)** — bind snapshot at execute start (post-revalidate, under mutex/claim); re-check refs before append/cutover commit; concurrent org/ref change or overlapping batch → fail without partial authoritative mix
   - **Pagination (FR-33)** — list/search APIs that paginate authoritative result sets accept/return a **server** snapshot token (or equivalent version stamp); page N of same token sees consistent membership; filter/sort change → **new** snapshot + page 1 (align UX EXPERIENCE governed-data-table rules); do **not** pretend client-only scrub is enough for server-backed lists
   - **Export generation (6.5)** — create/generate continues to require reviewed hash; stamp shared evaluation-snapshot ref alongside `snapshot_hash`; mismatch → existing `SNAPSHOT_MISMATCH` (or mapped shared code)
   - **Formal publication (7.6)** — publish consumes shared substrate (upgrade provisional bind); keep publication immutability + disposal fork; still call 7.7 `assertArtifactsUsable` where already required — **do not** fail-open bare catch

5. **And** AR-TEMPORAL / AR-MIGRATION / AR-REPORTING / AR-ACCESS / AR-DATA / AR-AUDIT remain **fail-closed**:
   - Do **not** invent signed freeze matrices, jurisdiction claims, or “full MVCC product” beyond what consumers need
   - Provisional permission/category codes OK with `@provisional-pending-AR-ACCESS-freeze` (and related)
   - Do **not** claim LG-1 / LG-4 / FR-56 **production acceptance** complete without frozen ARs + signed evidence
   - Do **not** claim FR-55 Launch Artifact freeze / LG-6 complete (7.7 owns substrate claim only)
   - Do **not** claim hash-chain WORM / NFR-10 tamper-evidence product (architecture deferred)

6. **And** required vs secondary audit posture is **normative** (same as 7.1–7.7):
   | Path | On append failure | On trust suspend |
   | --- | --- | --- |
   | Required capture (snapshot bind on finalize/import execute/export create/publish; integrity deny evidence) | Fail-closed | Block sensitive allow |
   | Secondary (list snapshot registry / integrity stats after primary allow) | Soft-deny / soft-return — never mask primary FORBIDDEN | Prefer fail-closed for **new** binds; reads of existing snapshot metadata MAY continue if separately permitted |
   | API mapping | Trust/append failure ≠ ordinary «دسترسی ندارید.» — preserve 7.4 `INTERNAL_SERVER_ERROR` mapping |

7. **And** this story does **not** own: rewriting 5.5 report maths; forking 6.5 export SoT or TTL/custody/reauth; rewriting 6.2/6.4 recon oracles; rewriting 7.6 publication immutability/disposal core beyond snapshot bind upgrade; rewriting 7.7 register/waiver product; PopulationPort production cutover; AD-6 Prisma↔PoolClient orphan hardening; Vitest mandate; inventing new Launch Report catalogue keys; claiming Divan revokes local copies; forcing Serializable isolation on the whole database; building a second governance UI platform

## Tasks / Subtasks

- [x] Task 1: Shared domain contract + errors + permissions (AC: #1–#3, #5–#6)
  - [x] NEW under `@divan/audit-envelope` (preferred BC home — cross-cutting FR-46..56 / AD-5; mirror `launch-artifact.ts`):
    - Files e.g. `evaluation-snapshot.ts`, `evaluation-snapshot-errors.ts`, `evaluation-snapshot-permissions.ts`, `evaluation-snapshot-repo.ts` (repo only if registry persisted)
    - Core types (normative names — document final exports):
      - `AuthoritativeEvaluationSnapshot` — `{ id, kind, contentFingerprint, attribution, boundRefs?, createdAt, correlationId, status }`
      - `EvaluationSnapshotKind` — at minimum: `finalize` \| `import_execution` \| `pagination` \| `export` \| `publication` (extensible string union OK)
      - `EvaluationSnapshotBindResult` / `EvaluationSnapshotConflict`
    - Normative APIs:
      ```text
      beginEvaluationSnapshot(input) -> AuthoritativeEvaluationSnapshot
        // attributable id + fingerprint over canonical payload for that kind
      assertSameEvaluationSnapshot(expected, liveOrRecomputed) -> void | throw SNAPSHOT_* 
      revalidateEvaluationSnapshot(id|handle, ctx) -> ok | conflict
      bindOperationToSnapshot(operationRef, snapshot) // evidence helper
      ```
    - **Hash rule:** extract or call **one** canonical sorted-key stringify + SHA-256 path. Prefer lifting `stableStringify` spirit from `computeExportSnapshotHash` into a shared pure helper consumed by reporting **or** re-export/wrap reporting hash for export/publication kinds — **never** a second divergent algorithm. Finalize kind may fingerprint stamps (person/employment updatedAt, asOf, permission fingerprint, refs) without requiring full result-set hash.
    - Permissions (provisional): `evaluation.snapshot.read` (inspect/list metadata), optional `evaluation.snapshot.manage` (admin repair / expire tokens) — do **not** auto-grant to `audit.investigate` / `ops.health.read` / publication / launch.artifact perms. Most bind calls are **system-side** after the caller’s own authorize — document that bind is not a substitute for domain permission.
    - Category: `evaluation.snapshot` (ordinary; **not** `health`; do not collide with `export` / `report.publication` / `launch.artifact` / `data.lifecycle`)
    - Error codes + Persian `messageFa`: e.g. `EVAL_SNAPSHOT_DENIED`, `EVAL_SNAPSHOT_NOT_FOUND`, `EVAL_SNAPSHOT_MISMATCH`, `EVAL_SNAPSHOT_STALE`, `EVAL_SNAPSHOT_VERSION_MIX`, `EVAL_SNAPSHOT_REF_CHANGED`, `EVAL_SNAPSHOT_PERMISSION_CHANGED`, `EVAL_SNAPSHOT_EXPIRED`
    - Map/bridge existing domain errors where the consumer already has UX: finalize keeps `FINALIZE_STALE_SNAPSHOT`; export keeps `SNAPSHOT_MISMATCH`; publication keeps `PUBLICATION_SNAPSHOT_MISMATCH` — shared helper may throw typed shared error that adapters translate
  - [x] Register category + policy tuples in `DEV_DEMO_CATEGORIES` / `DEV_DEMO_POLICY` for read(/manage) × `org:selfcheck`
  - [x] NEW `packages/modules/identity-access/src/seed-evaluation-snapshot.ts` (mirror `seed-launch-artifact.ts`): PermissionSet on **`hr.admin`** (architecture/product stand-in) — SoD honesty; never auto-grant audit/ops/trust
  - [x] Export from `@divan/audit-envelope` index; dedicated `EvaluationSnapshotError` (map at API)

- [x] Task 2: Persistence — optional registry for durable tokens (AC: #1, #4 pagination/export/publish)
  - [x] NEW `packages/db/sql/021_evaluation_snapshots.sql` (next free after `020_launch_artifact_change_control.sql`):
    - Prefer schema `governance` (alongside launch-artifact) **or** document `kernel` — **not** `reporting.export_artifact` tables as SoT
    - `evaluation_snapshot` table (minimum): id UUID PK, kind text, content_fingerprint text, attribution jsonb (actor, permission fingerprint, as_of, build_ref optional), bound_refs jsonb minimized (ids/stamps — **no** unauthorized PII row dumps), status `active`\|`consumed`\|`expired`\|`superseded`, correlation_id, created_at, expires_at nullable, operation_ref jsonb nullable
    - Indexes: fingerprint; kind+created_at; status; correlation_id
    - DELETE forbid trigger (append-only spirit); allow status transitions only via controlled UPDATE (document allowed columns)
  - [x] Repo via `pg` Pool/PoolClient in `@divan/audit-envelope` — **web stays thin**
  - [x] Migrations-only (do **not** expand `ensure*Schema` sprawl)
  - [x] **Finalize** may omit durable insert (TX-local object + audit metadata) if Completeness Notes document honesty — pagination/export/publication **should** persist or reuse durable fingerprint for cross-request pages/downloads

- [x] Task 3: Wire finalize + import consumers (AC: #1–#4)
  - [x] UPDATE `packages/modules/person-employment/src/personnel-event-conflicts.ts` + `personnel-event-finalize.ts`:
    - Keep `buildEvaluationSnapshot` / `assertSnapshotFresh` behavior (preserve FOR UPDATE + same-connection reads)
    - On successful finalize path: call `beginEvaluationSnapshot` / `bindOperationToSnapshot` with kind `finalize` (fingerprint from stamps + asOf + permission fingerprint + refs)
    - Stale path: continue blocking; map through shared conflict helper if cheap
    - **Do not** break AD-6 same-TX projection refresh
  - [x] UPDATE `packages/modules/migration/src/execute-batch.ts` (+ mutex helpers if needed):
    - After `revalidateStagingBatch` / `revalidateAuthoritativeReferences` and under claim/mutex: `beginEvaluationSnapshot({ kind: "import_execution", ... })`
    - Before commit / after mid-flight ref risk: `revalidateEvaluationSnapshot` — org/role/ref change → fail with surfaced conflict; **no** partial mix across versions
    - Preserve concurrent batch block + AD-6 orphan honesty (do not claim Prisma↔PoolClient fixed)
    - Stamp snapshot id/fingerprint on batch evidence metadata if a field exists or additive jsonb — **do not** rewrite historical evidence rows

- [x] Task 4: Wire pagination + export + publication consumers (AC: #1–#4)
  - [x] Pagination (pick **one** primary server list and document; extend pattern to a second if cheap):
    - Preferred: personnel search/list tRPC (`5.1` permission-safe lists) — request carries optional `evaluationSnapshotId` / fingerprint; first page creates snapshot; subsequent pages require same token; membership stable for that token’s lifetime; filter/sort change rejects old token → client must start new snapshot at page 1
    - Align copy with UX: new snapshot on filter/sort change
    - GovernedDataTable client scrub remains; **server** token is the FR-56 authority for server-backed pages
  - [x] UPDATE export create path (`export-artifact.ts` + thin web):
    - Keep `computeExportSnapshotHash` as reviewed content hash
    - Bind/stamp shared evaluation-snapshot ref on create; mismatch still `SNAPSHOT_MISMATCH`
    - Do **not** fork custody/reauth/TTL
  - [x] UPDATE `decision-publication.ts` publish pipeline:
    - Replace “provisional-only FR-56” honesty with shared `assertSameEvaluationSnapshot` / bind after reviewed hash check
    - Keep immutability triggers, notices, disposal fork, PopulationPort ∩ InferenceBulk, stale-recalc block, 7.7 `assertArtifactsUsable` (fail-closed — **no** bare catch continue unbound)
    - New publishes only; never rewrite historical publication decision columns

- [x] Task 5: Thin tRPC + UI honesty (AC: #3, #5–#7)
  - [x] NEW `apps/web/src/server/evaluation-snapshot.ts` (thin):
    - Procedures minimum: `capabilities`, `get` (by id), optional `listRecent` (ops/debug — soft-deny secondary), optional `beginPaginationSnapshot` if lists need explicit begin
    - Domain mutations stay on existing routers (finalize/import/export/publish/list) — do **not** invent a second finalize API
    - `governedProcedure` + soft PermissionSet after envelope; map via `operational-copy`
  - [x] Register in `apps/web/src/server/root.ts`
  - [x] UI (prefer **no new IA route**):
    - **Preferred:** enforcement-only — Persian errors on existing finalize / import / export / publish / list surfaces; optional small ops honesty line under **عملیات** (integrity deny counts / last mismatch) without HR rows
    - **Alt:** tiny drawer on ops page only if product needs inspect-by-id — do **not** invent `/governance/snapshots` lightly
  - [x] UPDATE `apps/web/lib/operational-copy.ts` — never forward raw `error.message`
  - [x] Interactive a11y on any new controls: labeled; focus restore; Escape/focus trap on confirms; 200% zoom; status not color-only

- [x] Task 6: Verify + DoD (AC: #1–#7)
  - [x] Selfchecks: begin+assert same OK; tamper fingerprint → mismatch; finalize stale still blocks; import ref change mid-flight blocks without version mix; pagination token mismatch fails; export/publication hash mismatch fails; concurrent permission fingerprint change blocks finalize; trust suspend blocks required bind paths; soft-deny secondary; `kernel_events` append-only untouched; 7.7 gates still called on publish
  - [x] Scripts: `pnpm --filter @divan/audit-envelope selfcheck:evaluation-snapshot` + `pnpm --filter @divan/web selfcheck:evaluation-snapshot` (names may vary — register in package.json)
  - [x] Also run/adapt existing selfchecks touched: `selfcheck:personnel-event-draft` / import-batch / export-artifact / decision-publication / launch-artifact as needed
  - [x] `pnpm` typecheck + eslint on touched packages
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits

### Manual DoD checklist

- [x] Finalize completes against one rebuilt TX snapshot or fails stale — no silent apply across person/employment/permission versions
- [x] Import execute binds one snapshot under mutex; concurrent org/ref change or overlapping batch fails without partial authoritative mix
- [x] Paginated authoritative list: same snapshot token → stable page membership; filter/sort change → new snapshot + page 1
- [x] Export create: reviewed hash + shared snapshot bind; tamper → `SNAPSHOT_MISMATCH` (or mapped)
- [x] Publish: shared substrate bind; immutable decision columns; 7.7 artifact gate fail-closed; no bare catch unbound publish
- [x] Conflicts surface Persian copy; no silent overwrite / out-of-scope delivery
- [x] Coarse nav alone cannot manage snapshot registry (if manage exists) — soft PermissionSet after envelope
- [x] 7.4 trust suspend still blocks required snapshot-bound mutations
- [x] Export custody/reauth/TTL unchanged; Launch Artifact register unchanged as product
- [x] No jurisdiction / LG-1 / LG-4 / FR-56 production-acceptance complete claims; provisional markers present
- [x] Persian RTL / digits; UX-DR24 copy; no secrets / unauthorized PII in snapshot bound_refs
- [x] Sprint may claim FR-56 **evaluation-snapshot substrate + consumer hooks** — **not** full AR freeze / LG acceptance; **not** WORM hash-chain

### Review Findings

- [x] [Review][Patch] Fail-closed mint صفحهٔ ۱ — تصمیم review: شکست `beginEvaluationSnapshot` / نبود `021_*` نباید `allowed` بدون توکن برگرداند؛ map به deny/خطای فارسی اسنپ‌شات [`apps/web/src/server/personnel-scoped-search.ts:772`]

- [x] [Review][Patch] UI فهرست پرسنل توکن/صفحهٔ سرور را مصرف نمی‌کند و برش خاموش می‌شود [`apps/web/components/personnel/personnel-list-panel.tsx`] — فقط `{ channel: "list" }` می‌فرستد؛ سرور `rows.slice(0, pageSize)` می‌کند و اعضای باقی‌مانده از UI حذف می‌شوند (Gate: نه client-scrub-only).
- [x] [Review][Patch] `pageSize` داخل fingerprint pagination نیست [`apps/web/src/server/personnel-scoped-search.ts:137`] — با همان توکن می‌توان هندسهٔ صفحه را عوض کرد بدون `VERSION_MIX`.
- [x] [Review][Patch] `getEvaluationSnapshot` وضعیت `consumed`/`superseded` را رد نمی‌کند [`packages/kernel/audit-envelope/src/evaluation-snapshot.ts:330`] — فقط TTL؛ توکن مصرف‌شده تا انقضا قابل ادامهٔ صفحه است.
- [x] [Review][Patch] `bindOperationToSnapshot` در نبود ردیف یا `UPDATE … AND status='active'` صفر ردیف باز هم موفق برمی‌گردد [`packages/kernel/audit-envelope/src/evaluation-snapshot.ts:296`] — consume/stamp fail-open.
- [x] [Review][Patch] بازبینی mid-flight واردات no-op است [`packages/modules/migration/src/execute-batch.ts:537`] — `boundRefs` فقط `{batchId,overlapKeys,rowCount}` in-memory است؛ `revalidateAuthoritativeReferences` / `liveFingerprint` محتوا دوباره صدا نمی‌شود؛ `EVAL_SNAPSHOT_REF_CHANGED` عملاً شلیک نمی‌شود.
- [x] [Review][Patch] `beginEvaluationSnapshot` واردات قبل از claim/mutex است [`packages/modules/migration/src/execute-batch.ts:489`] — AC4/Task 3 الزام under mutex/claim.
- [x] [Review][Patch] اسنپ‌شات‌های یتیم پس از شکست دامنه [`execute-batch.ts` catch / `export-artifact.ts` / `decision-publication.ts`] — begin بیرون از TX دامنه؛ deny/rollback بدون expire/supersede ردیف `active` می‌گذارد.
- [x] [Review][Patch] `beginEvaluationSnapshot` insert و `appendAccessEvent` اتمیک نیستند [`packages/kernel/audit-envelope/src/evaluation-snapshot.ts:113`] — شکست audit پس از INSERT، ردیف بدون evidence الزامی باقی می‌گذارد.
- [x] [Review][Patch] تریگر وضعیت، بازگشت `consumed|expired|superseded → active` را منع نمی‌کند [`packages/db/sql/021_evaluation_snapshots.sql:58`].
- [x] [Review][Patch] UUID نامعتبر توکن pagination → خطای cast Postgres / 500 [`apps/web/src/server/personnel-scoped-search.ts` continuation] — باید به `EvaluationSnapshotError` نگاشت شود.
- [x] [Review][Patch] `stableStringify` موازی هنوز در publication است [`packages/modules/reporting/src/decision-publication.ts:134`] — نقض قانون یک الگوریتم canonical.
- [x] [Review][Patch] کمبود ردیف projection در ادامهٔ صفحه silently حذف می‌شود [`apps/web/src/server/personnel-scoped-search.ts:611`] — عضو حذف‌شده/غیرمجاز بدون conflict محو می‌شود.
- [x] [Review][Patch] attribution مجوز در mint pagination ست/بازبینی نمی‌شود [`apps/web/src/server/personnel-scoped-search.ts:774`] — تغییر permission mid-TTL تشخیص داده نمی‌شود.

- [x] [Review][Defer] UI مدیریت expire/supersede برای `evaluation.snapshot.manage` سیم‌کشی نشده [`apps/web/components/operations/evaluation-snapshot-honesty.tsx`] — deferred, pre-existing MVP honesty-only scope
- [x] [Review][Defer] ستون‌های `evaluation_snapshot_id` بدون FK [`packages/db/sql/021_evaluation_snapshots.sql:91`] — deferred, pre-existing additive nullable stamp pattern
- [x] [Review][Defer] `emptyDeniedResult` خطای اسنپ‌شات را شبیه انکار دسترسی برمی‌گرداند [`apps/web/src/server/personnel-scoped-search.ts:497`] — deferred, pre-existing soft search mapping pattern

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| One validated snapshot/version per authoritative op or fail | Mix versions mid-flight; partial authoritative success across two snapshots |
| Surfaced conflicts (Persian); attributable snapshot ref on success | Silent overwrite; out-of-scope delivery; English enum UX |
| Reuse one canonical hash/stringify stack for export/publication kinds | Invent parallel SHA algorithms or “snapshot v2” forks |
| Wire all five FR-56 paths (finalize/import/pagination/export/publish) | Claim done after only one path; leave pagination as client-scrub-only for server lists |
| Honor 7.4 trust suspend + AD-5 required access events on binds | Parallel audit SoT; Prisma for snapshot registry |
| Soft PermissionSet after envelope; SoD honesty vs audit/ops | Coarse nav as authz; auto-grant investigate/health |
| Keep 7.6 immutability + 7.7 `assertArtifactsUsable` fail-closed | Bare catch continue unbound publish; rewrite historical publication columns |
| Thin web; domain in `@divan/audit-envelope`; operational-copy | PlaceholderPage as “done”; new IA without justification |
| Migrations-only `021_*.sql` via `pg` | `ensure*Schema` sprawl; Prisma models for registry |

### Absolute non-goals

- Rewriting 5.5 report assemblers / inventing new launch report keys
- Forking 6.5 export artifact SoT / relabeling exports as evaluation snapshots
- Rewriting 6.4 reconciliation oracles / unlocking production `unavailable` via snapshot
- Rewriting 7.6 disposal/reproducibility core beyond bind upgrade
- Rewriting 7.7 Launch Artifact register/waiver/rebaseline product
- Relabeling GovernedDataTable client scrub or dashboard-snapshot as FR-56 complete
- PopulationPort production cutover; AD-6 Prisma↔PoolClient hardening; Vitest mandate
- Database-wide `default_transaction_isolation = serializable` mandate (optional per-TX RR/SSI only where a consumer needs it — document; prefer explicit revalidate + optimistic stamps)
- Hash-chain WORM / NFR-10 tamper-evidence product
- Claiming Divan revokes local/email copies
- Inventing signed AR matrices, jurisdiction, or LG complete

### UPDATE files — current state → this story → preserve

| File | Current (post-7.7) | Change | Preserve |
| --- | --- | --- | --- |
| `packages/kernel/audit-envelope/src/categories.ts` | has `launch.artifact` | Register `evaluation.snapshot` + policy | Never reuse `health` |
| `packages/kernel/audit-envelope/src/index.ts` | launch-artifact exports | Export evaluation-snapshot API | Existing authorize/trust/launch contracts |
| `packages/modules/person-employment/src/personnel-event-conflicts.ts` | local `EvaluationSnapshot` | Adapter → shared fingerprint/bind helpers | `assertSnapshotFresh` semantics; FOR UPDATE client reads |
| `packages/modules/person-employment/src/personnel-event-finalize.ts` | stale → `FINALIZE_STALE_SNAPSHOT` | Bind shared snapshot on success path | Same-TX projection; conflict classification |
| `packages/modules/migration/src/execute-batch.ts` | revalidate + mutex | Bind + revalidate evaluation snapshot | Concurrent block; AD-6 orphan honesty; recon gate |
| `packages/modules/reporting/src/export-artifact.ts` | `computeExportSnapshotHash` | Shared stringify/hash reuse + stamp shared ref | Custody/reauth/TTL; `SNAPSHOT_MISMATCH` |
| `packages/modules/reporting/src/decision-publication.ts` | provisional hash bind + 7.7 gate | Consume shared assert/bind; keep fail-closed artifact gate | Immutability; notices; disposal fork; PopulationPort |
| Personnel list tRPC / search (5.1) | permission-safe pages | Snapshot token across pages | IDOR/person-org scope; InferenceBulk fail-closed |
| `packages/modules/identity-access/src/seed.ts` | launch-artifact seed wired | Wire `seed-evaluation-snapshot` | Idempotent seed order |
| `apps/web/src/server/root.ts` | launch-artifact router | Register thin evaluation-snapshot router | Existing routers |
| `apps/web/lib/operational-copy.ts` | 7.7 copy | Snapshot mismatch/stale/version-mix copy | UX-DR24; exact LDAP/custody strings |
| NEW `021_evaluation_snapshots.sql` + domain | Absent | Registry + shared API | `kernel_events` append-only untouched |
| `apps/web/.../governed-data-table/snapshot.ts` | client scrub | Optional callout only — **do not** make it SoT | FR-33 UX page-reset rules |

### Architecture compliance

- **AD-1:** Single process + one PG — evaluation snapshot registry in same DB
- **AD-2:** Snapshots are **evaluation evidence**, not license to rewrite event history or publication decision columns
- **AD-3:** Web → `@divan/audit-envelope` + thin consumer updates in person-employment / migration / reporting; no Prisma for registry tables; repo uses `pg`
- **AD-5:** Identity-access coarse + envelope fine; required access events on durable binds / integrity denials as applicable; FR-56 under cross-cutting FR-46..56 → kernel + modules
- **AD-6:** Raw SQL migrations; keep event-store triggers intact; do not expand request-path `ensure*Schema`; do not pretend import orphan gap is closed
- **Capability map:** Cross-cutting FR-46..56 → kernel + modules + Launch Artifacts — implement **substrate + hooks + fail-closed provisional**, do not invent frozen AR content
- **Spine:** No dedicated AD for FR-56 — mechanism options in addendum §5.2 (hybrid snapshots/checkpoints + replay) remain open; this story chooses **attributable snapshot bind + revalidate/fail-closed**, not a full checkpoint warehouse

### Four-way (now five-way) product distinction (normative)

| | Export artifact (6.5) | Decision publication (7.6) | Launch Artifact (7.7) | Evaluation snapshot (7.8) |
| --- | --- | --- | --- | --- |
| What | File download bytes | Formal report decision evidence | Policy/acceptance AR-\* | One validated eval version for authoritative ops |
| Lifetime | ~hours TTL | Organizational | Until superseded/expired | Op-scoped or short-lived token (pagination/export) |
| FR | 41/52 | 54 | 55 | **56** |
| Mutability | revoke/dispose | notices; decision cols immutable | version supersession | consume/expire; never silent rewrite fingerprints |

### Snapshot algorithms (normative)

```text
on authoritativeOperation(kind, reviewedInput):
  authorize(domain permission for kind)
  honor audit-trust suspend
  snap = beginEvaluationSnapshot({ kind, reviewedInput, actor, permissionFingerprint, correlationId })
  // kind-specific:
  //   finalize: rebuild live stamps on TX connection; assertSnapshotFresh(client, live)
  //   import: revalidate refs; mutex/claim; bind; revalidate before commit
  //   pagination: create or require token; serve page from token membership
  //   export/publish: computeExportSnapshotHash(reviewed); assert equals reviewed hash; bind shared ref
  if concurrent ref/org/permission/version change detected:
    fail EVAL_SNAPSHOT_* / domain bridge code — no partial apply
  perform operation against snap only
  bindOperationToSnapshot(operationRef, snap) // evidence
  appendAccessEvent(...) // required paths fail-closed
  return result including snap.id / contentFingerprint where useful to client
```

```text
on paginationTurn(page, token?):
  if page == 1 and no token → beginEvaluationSnapshot(kind=pagination, filters/sort/asOf)
  if page > 1 and token missing/mismatch/expired → deny (client must restart at page 1)
  if filters/sort changed vs token → deny VERSION_MIX / require new snapshot
  return rows for that token only
```

### Isolation guidance (do not over-build)

- Prefer **explicit stamps + revalidate + fail-closed** (already used in finalize) over mandating DB-wide Serializable.
- Where a single multi-statement TX must see one view (finalize, import cutover), keep work on **one** `PoolClient` / transaction; optional `SET LOCAL TRANSACTION ISOLATION LEVEL REPEATABLE READ` (or SERIALIZABLE with retry) only if a concrete race remains after revalidate — document choice in Completion Notes.
- Applications using Serializable/SSI must retry serialization failures — do not leave bare 400s without Persian operational guidance if you opt in.
- Source: PostgreSQL transaction isolation / SSI docs — correctness with retry, not silent partial commits.

### Permission seeding (provisional)

| Key | Use | Seed bind |
| --- | --- | --- |
| `evaluation.snapshot.read` | Inspect snapshot metadata / ops honesty | `hr.admin` |
| `evaluation.snapshot.manage` (optional) | Expire/repair tokens | `hr.admin` (document SoD gap if same set) |
| Domain perms (`personnel.event.*`, migration execute, `export.*`, `report.publication.*`) | Own operations that bind snapshots | Unchanged |

Mark `@provisional-pending-AR-ACCESS-freeze`.

### UX notes

- No dedicated FR-56 surface in UX DESIGN/EXPERIENCE — integrity is mostly invisible enforcement
- Governed-data-table: filter/sort change → new snapshot + page 1; announce new count (EXPERIENCE.md)
- Status pattern UX-DR22: stale/mismatch/version-mix are **distinct** from empty/error/forbidden
- Publish CTA remains disabled when stale-recalc blocking (UX-DR5) — snapshot bind does not bypass
- Single dialog depth; Skeleton; error ≠ empty; status not color-only
- Interactive a11y DoD from Epic 1 carry-in

### AR honesty

- AR-TEMPORAL / AR-MIGRATION / AR-REPORTING / AR-CUTOVER affect FR-56 paths — remain pending/partial_freeze via 7.7 register; do not invent freezes
- Forbidden: claiming LG-1/LG-4/FR-56 production acceptance complete; inventing jurisdiction; claiming WORM hash-chain done; claiming PopulationPort production-cut over

### Migration-evidence / carry-in honesty (still mandatory)

| Fact | Snapshot product must |
| --- | --- |
| PopulationPort fixture-default | Not present snapshot bind as production population proof |
| AD-6 / Baseline projector gaps | Not claim import orphans cured by snapshot registry |
| Soft-deny secondary gaps | Do not upgrade soft-failed list into “fully audited snapshot store” |
| InferenceBulk process-local race | Retain fail-closed where list/export/publish call bulk channels |
| Sticky break-glass / fingerprint | Out of scope UX debt — but permission fingerprint change **must** still invalidate finalize snapshots |
| 7.7 Launch Artifact substrate | Keep calling gates; do not replace AR register with snapshot registry |
| Recon unavailable hard-block | Never unlock via snapshot |
| Export Base64 size-cap defer | Do not uncapped dump result sets into `bound_refs` |
| Open Epic 6 AR fail-closed action | Keep fail-closed; do not invent |

### Known gaps to document (do not silently “fix” as done)

| Gap | Handling in 7.8 |
| --- | --- |
| Full reference-data warehouse / checkpoint replay | Bind + revalidate + fail-closed; not a second event store |
| Every list in the app snapshotted | MVP: ≥1 authoritative paginated API + documented pattern; extend second if cheap |
| Finalize durable registry row | Optional — TX-local + audit metadata OK if Completion Notes honest |
| SoD manage vs read on same `hr.admin` | Document provisional SoD gap |
| Vitest/ephemeral DB | Still deferred open carry-in — dual-layer selfcheck required |
| AD-6 Prisma↔PoolClient | Still open — honesty only |
| Automatic org-change CDC into all in-flight snapshots | Explicit revalidate at critical points; not a global CDC product |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Existing monorepo | Node 22 / TS 5.x / pnpm — no new framework |
| Next.js 16 / React 19 / tRPC 11 | Thin router + existing panels/lists |
| Zod | Input schemas for begin/get/pagination token |
| `pg` + SQL migrations | `021_*.sql`; Pool/PoolClient repos |
| `node:crypto` createHash | **One** canonical SHA-256 path shared with export/publication |
| Test | `*.selfcheck.ts` + `tsx` — Vitest still deferred open carry-in |

### Latest technical specifics

- **PostgreSQL isolation:** Repeatable Read ≈ snapshot isolation for a TX; Serializable adds SSI anomaly detection and requires retry on serialization failure. Prefer application-level snapshot bind + revalidate for Divan’s multi-module paths; use per-TX isolation only when a proven race remains.
- **Canonical hashing:** Keep sorted-key `stableStringify` + SHA-256; field order must not change hashes across export vs publication.
- **Do not** add OPA / temporal-cluster / separate snapshot microservice dependencies — stay in-repo PG + TypeScript.
- **bound_refs** store ids/stamps/fingerprints only — never unauthorized person field values.

### Previous story intelligence (7.7 / 7.6)

- **7.7:** FR-55 substrate in `@divan/audit-envelope`; SQL `020_`; thin web under `/operations`; dual-layer selfcheck; fail-closed gates; soft PermissionSet; BOM-safe yaml; review patches on TOCTOU status guards, DELETE forbid, Persian labels, no bare catch fail-open on publication consumer.
- **7.6:** Reuse `computeExportSnapshotHash`; publication immutability; provisional snapshot honesty explicitly deferred to **this** story; TX + required `appendAccessEvent`; PopulationPort ∩ InferenceBulk on publish.
- **Handoff fulfilled by this story:** replace provisional-only FR-56 claim with substrate + hooks; still do **not** claim LG production acceptance.
- Anticipate review patches: status-guarded UPDATEs; DELETE forbid; capabilities failure must not hide all actions; map PG trigger exceptions to domain codes; Escape/focus trap on any new confirms.

### Git intelligence

Recent commits: `fde870b` story 7.7; `014d3ce` story 7.6; `992bce2` story 7.5; `e9f1107` story 7.4; `4754116` story 7.3.  
Patterns to copy: provisional permission seeds, dual-layer selfchecks, Gate tables, dedicated `0xx_*.sql`, soft-deny secondary vs fail-closed primary, extend existing shells rather than PlaceholderPage, thin `apps/web/src/server/*` routers, shared helpers instead of forked validators, explicit non-goals for AD-6/PopulationPort/Vitest.

### Project context reference

- No `project-context.md` found in repo — rely on this story + architecture spine + PRD FR-56 + prior Epic 7 stories.
- Open Epic 6 action items still apply: AR fail-closed in Epic 7; artifact reauth already consumed by 6.5/7.1 — snapshot retrieve/list must not invent a weaker authz path.
- Carry-ins still open (do not silently close): InferenceBulkPort ops doc; sticky break-glass; PopulationPort cutover; AD-6 hardening; ensure*Schema migrations-only; person-org scope on Cancel/Reverse/Correct; person-create form dedup; leave-guard on logout; Vitest/ephemeral isolation; Baseline projector gap.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7 / Story 7.8 AC; FR56 mapping; Story 4.2 FR56 finalize mention]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-56, FR-15 evaluation point, FR-33 pagination, FR-52 export snapshot, LG-1/LG-4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §5.2 hybrid snapshots/checkpoints; §12.3 pagination/export stable snapshots]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5; FR-46..56 → kernel + modules]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — governed-data-table stable-snapshot pagination]
- [Source: `_bmad-output/implementation-artifacts/7-7-launch-artifact-change-control-hooks.md` — FR-56 out of scope handoff]
- [Source: `_bmad-output/implementation-artifacts/7-6-published-decision-report-reproducibility.md` — provisional snapshot bind handoff]
- [Source: `packages/modules/person-employment/src/personnel-event-conflicts.ts` — `EvaluationSnapshot` / `assertSnapshotFresh`]
- [Source: `packages/modules/reporting/src/export-artifact.ts` — `computeExportSnapshotHash`]
- [Source: `packages/modules/migration/src/execute-batch.ts` — revalidate + concurrent mutex]
- [Source: PostgreSQL docs — transaction isolation / application-level consistency (SSI retry)]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Fixed web honesty component import: `@/lib/trpc/client` (not `@/trpc/react`)
- Selfcheck `evaluateAuthorization` returns `"allow"|"deny"` (not `{allowed}`)
- `revalidateEvaluationSnapshot` handle must be `{id}` or full snapshot object, not bare string id
- Publication `assertArtifactsUsable` bare catch fail-open removed → DecisionPublicationError fail-closed
- Migration `021_evaluation_snapshots.sql` applied to local Postgres (divan-pg :5433)

### Completion Notes List

- **Substrate:** `@divan/audit-envelope` `AuthoritativeEvaluationSnapshot` + `beginEvaluationSnapshot` / `assertSameEvaluationSnapshot` / `revalidateEvaluationSnapshot` / `bindOperationToSnapshot`; single `stableStringify` + SHA-256 in `evaluation-snapshot-hash.ts` consumed by export `computeExportSnapshotHash`.
- **Persistence:** `governance.evaluation_snapshot` via `021_evaluation_snapshots.sql` (DELETE forbid + immutable fingerprint/kind/attribution guard); additive `evaluation_snapshot_id` on export_artifact + decision_publication.
- **Permissions:** `evaluation.snapshot` category; `evaluation.snapshot.read` / `.manage` seeded on `hr.admin` only — no auto-grant audit/ops/trust/launch/publication. Bind is system-side after domain authorize.
- **Consumer hooks (FR-56 five paths):**
  1. **Finalize** — TX-local `persist:false` bind on success; stale path keeps `FINALIZE_STALE_SNAPSHOT`; AD-6 same-TX untouched.
  2. **Import execute** — durable `import_execution` snapshot after revalidate; revalidate before cutover + before evidence; stamp id/fingerprint on evidence `actors` jsonb; concurrent/ref failures fail-closed.
  3. **Pagination** — `person.search` server token: page 1 begins snapshot with `memberIds`; later pages require same token; filter/sort change → `EVAL_SNAPSHOT_VERSION_MIX`.
  4. **Export** — reviewed hash + shared snapshot bind; mismatch still `SNAPSHOT_MISMATCH`; custody/reauth/TTL unchanged.
  5. **Publication** — shared bind after hash check; `assertArtifactsUsable` fail-closed (no bare catch unbound); provisional only for unresolved AR controlling version codes; immutability/disposal/7.7 gate preserved.
- **Isolation:** Prefer stamps + revalidate + fail-closed; no DB-wide Serializable mandate.
- **Honesty:** Finalize durable registry optional (TX-local documented); SoD read+manage on same `hr.admin` provisional; FR-56 substrate+hooks only — not LG-1/LG-4/AR production acceptance; not WORM hash-chain.
- **Selfchecks:** `pnpm --filter @divan/audit-envelope selfcheck:evaluation-snapshot` (pure+DB ok); `pnpm --filter @divan/web selfcheck:evaluation-snapshot` (static ok). Typecheck green on audit-envelope, web, reporting, person-employment, migration, identity-access.

### File List

- `_bmad-output/implementation-artifacts/7-8-authoritative-evaluation-snapshot-integrity.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/db/sql/021_evaluation_snapshots.sql`
- `packages/kernel/audit-envelope/src/evaluation-snapshot.ts`
- `packages/kernel/audit-envelope/src/evaluation-snapshot-errors.ts`
- `packages/kernel/audit-envelope/src/evaluation-snapshot-permissions.ts`
- `packages/kernel/audit-envelope/src/evaluation-snapshot-hash.ts`
- `packages/kernel/audit-envelope/src/evaluation-snapshot-repo.ts`
- `packages/kernel/audit-envelope/src/evaluation-snapshot.selfcheck.ts`
- `packages/kernel/audit-envelope/src/categories.ts`
- `packages/kernel/audit-envelope/src/index.ts`
- `packages/kernel/audit-envelope/package.json`
- `packages/modules/identity-access/src/seed-evaluation-snapshot.ts`
- `packages/modules/identity-access/src/seed.ts`
- `packages/modules/person-employment/src/personnel-event-finalize.ts`
- `packages/modules/migration/src/execute-batch.ts`
- `packages/modules/migration/src/batch-evidence.ts`
- `packages/modules/reporting/src/export-artifact.ts`
- `packages/modules/reporting/src/export-artifact-repo.ts`
- `packages/modules/reporting/src/decision-publication.ts`
- `packages/modules/reporting/src/decision-publication-repo.ts`
- `apps/web/src/server/evaluation-snapshot.ts`
- `apps/web/src/server/evaluation-snapshot.selfcheck.ts`
- `apps/web/src/server/root.ts`
- `apps/web/src/server/person.ts`
- `apps/web/src/server/personnel-scoped-search.ts`
- `apps/web/components/operations/evaluation-snapshot-honesty.tsx`
- `apps/web/app/(app)/operations/page.tsx`
- `apps/web/lib/operational-copy.ts`
- `apps/web/package.json`

### Change Log

- 2026-07-30: Implemented FR-56 authoritative evaluation-snapshot substrate + five consumer hooks; dual-layer selfchecks; status → review.
- 2026-07-30: Code review patches applied (fail-closed pagination mint, under-mutex import bind, live revalidate, orphan expire, UI server pagination, atomic bind audit, status regression guard); status → done.

## Status

done
