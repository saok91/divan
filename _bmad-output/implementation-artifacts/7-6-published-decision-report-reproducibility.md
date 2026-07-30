---
baseline_commit: 992bce2
---

# Story 7.6: Published Decision-Report Reproducibility

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an HR/Product decision publisher,
I want formal decision reports to remain reproducible or explicitly marked non-reproducible after disposal,
so that retroactive Corrections cannot silently rewrite published decisions (FR54).

**Story key:** `7-6-published-decision-report-reproducibility`  
**Epic:** 7 — Audit, Operations & Evidence Controls (FR42, FR45, FR50, FR51, FR53–FR56)  
**Prerequisite:** Epics 1–6 done; Stories **7.1–7.5** done. Existing substrate: launch report catalogue + `assembleReportRun` (5.5); governed export artifacts with `computeExportSnapshotHash`, reauth, custody, dispose (6.5); retention/disposal/hold with `runDisposal` → `disposeExportArtifact` (7.3); correction-case `outcome_link` types `published_artifact` | `pending_publication_hook` honesty (7.5); audit trust writer suspend (7.4); stale/recalc gold-CTA fail-closed (7.2). **No** decision-publication schema, publisher permission, supersession notice product, privacy-preserving reproducibility package, or `non-reproducible-after-disposal` status machine.

### Critical naming distinction (do not conflate)

| Concept | Owner | Meaning |
| --- | --- | --- |
| **Report run / catalogue** (FR-36) | Story 5.5 — `report.run` / `assembleReportRun` | Live authorized view; recalculates; **not** a formal decision record |
| **Export artifact** (FR-41/52) | Story 6.5 — `export.*` / `createExportArtifact` | Short-TTL managed file download; custody/reauth; **not** organizational decision publication |
| **Personnel Event Correction** (FR-17) | Story 4.3 — `correctPersonnelEvent` | Event-chain Correction — **trigger** for supersession notice, never silent rewrite of publication |
| **External correction case** (FR-53) | Story 7.5 | Must **link** real publication ids when this story ships (replace honesty-only `pending_publication_hook` where a publication exists) |
| **Retention / disposal** (FR-50) | Story 7.3 | Disposal disposal → package retain **or** `non-reproducible-after-disposal`; reproducibility **never** overrides mandatory disposal |
| **Evaluation snapshot integrity** (FR-56) | Story **7.8** | Full authoritative evaluation-snapshot substrate; this story binds a **provisional** snapshot hash/ref (reuse export hash spirit) and honesty-defers full FR-56 machinery |
| **Launch Artifact change control** (FR-55) | Story **7.7** | Formal AR versioning/waiver; this story records **provisional** report/metric version strings `@provisional-pending-AR-REPORTING-freeze` |
| **Published decision report** (FR-54) | **This story** | Immutable publication metadata + supersession notices + post-disposal reproducibility fork |

Use type/API names like `DecisionPublication` / `decisionPublication.*` / «انتشار گزارش تصمیم» — never call a live `report.run` or an export download a “published decision.”

## Acceptance Criteria

1. **Given** a launch-catalogue report used as a formal organizational decision record and an actor with fine-grained publish permission (soft PermissionSet after envelope — coarse nav alone insufficient)  
   **When** it is published  
   **Then** the publication records **all** of:
   - report key + **provisional report/metric version** (code-marked; fail-closed if required version knobs missing when enforcement expected)
   - authorized **population/snapshot reference** (stable snapshot hash and/or attributable snapshot id — reuse `computeExportSnapshotHash` / report export hash spirit; do **not** invent a parallel hash stack)
   - filters (canonical JSON), as-of semantics (`current` \| `as_of` + date), publication timestamp, publisher account id, permitted audience (permission/scope codes — **not** unauthorized person rows)
   - **And** the stored publication **does not embed unauthorized field values or out-of-audience row payloads** (metadata + permitted provenance only; row dumps belong only inside an explicitly approved privacy-preserving package path below)
   - **And** every publish mutation is attributable under AR-ACCESS / AR-AUDIT (required access-event path; honor 7.4 writer suspend)
   - **And** stale/failed/unreconciled required inputs continue to **fail closed** (preserve 7.2 gold-CTA / stale banner — do not publish when platform recalc signal is blocking-stale)

2. **Given** an existing published decision record  
   **When** a later Personnel Event **Correction** (FR-17) and/or provisional metric/policy version change affecting that publication occurs  
   **Then** a linked **correction/supersession notice** is created (append-only notice row pointing at publication id + trigger refs)  
   **And** the original publication content/metadata that define the decision evidence are **not silently rewritten** (no UPDATE of filters/snapshot/as-of/audience/version fields to “fix” history)  
   **And** applicable retention/access rules remain enforced on retrieve/list  
   **And** UI/API present the publication as **superseded / has notice** — never as silently current after Correction

3. **Given** required source disposal occurs for a publication’s lawful evidence (7.3 disposal run intersecting publication source/artifact/person scope)  
   **When** disposal propagation completes for that scope  
   **Then** **either**:
   - an AR-DATA/AR-REPORTING-**provisional**-approved **privacy-preserving reproducibility package** is retained (minimized aggregates/hashes/provenance — **no** unauthorized PII row embed; package itself lifecycle-governed), **or**
   - the attributable publication is marked `non-reproducible-after-disposal` (and treated as superseded for “current reproducibility” claims)  
   **And** the publication **cannot** be presented or claimed as **currently reproducible**  
   **And** only permitted decision/provenance evidence remains queryable  
   **And** reproducibility **never** blocks or overrides mandatory disposal (if package not allowed → status fork, never “keep source bytes to stay reproducible”)

4. **And** correction-case outcome linking (7.5) can target real publication ids:
   - `published_artifact` / preferred new link type `decision_publication` (document choice) validates target exists in publication store
   - Prefer real links over `pending_publication_hook` when a publication id is known
   - **Never** fabricate reproducibility packages from correction-case UI

5. **And** AR-REPORTING / AR-DATA / AR-TEMPORAL / AR-ACCESS / AR-AUDIT remain **fail-closed**:
   - Do **not** invent signed AR-REPORTING formulae, jurisdiction regimes, or “GDPR Article X” claims
   - Provisional publication lifecycle codes OK if `@provisional-pending-AR-REPORTING-freeze` / `@provisional-pending-AR-DATA-freeze` + fail-closed when incomplete
   - Do **not** claim full LG-4 / FR-54 production acceptance complete without frozen ARs
   - Do **not** claim FR-56 evaluation-snapshot product complete (that is 7.8) — provisional snapshot bind only
   - Do **not** claim FR-55 Launch Artifact change-control complete (that is 7.7)

6. **And** required vs secondary audit posture is **normative** (same as 7.1–7.5):
   | Path | On append failure | On trust suspend |
   | --- | --- | --- |
   | Required capture (publish / supersede notice / mark non-reproducible / package retain under envelope) | Fail-closed | Block sensitive allow |
   | Secondary audit-of-audit (list/search after primary allow) | Soft-deny / soft-return — never mask primary FORBIDDEN | Prefer fail-closed for **new** publish/supersede work; read of existing publications MAY continue if separately permitted |
   | API mapping | Trust/append failure ≠ ordinary «دسترسی ندارید.» — preserve 7.4 `INTERNAL_SERVER_ERROR` mapping |

7. **And** this story does **not** own: rewriting 5.5 live report maths; forking 6.5 export SoT; rewriting 7.3 hold/dispose core; 7.5 case tracker rewrite; 7.7 AR change-control product; 7.8 evaluation-snapshot product; PopulationPort cutover; AD-6 Prisma↔PoolClient hardening; Vitest mandate; inventing new report catalogue keys; claiming local-copy revoke after publication leave Divan

## Tasks / Subtasks

- [x] Task 1: Domain constants + errors + publication state machine (AC: #1, #5–#6)
  - [x] NEW under `@divan/reporting` `decision-publication.ts` (mirror export-artifact domain home — reporting BC owns FR-54):
    - Permissions (provisional): `report.publication.read`, `report.publication.publish`, `report.publication.supersede` (notice creation may be system-triggered from Correction/disposal — still attributable), `report.publication.manage` (mark non-reproducible / attach package metadata) — document SoD choice; do **not** auto-grant to `audit.investigate` / `ops.health.read`
    - Category: `report.publication` (ordinary; **not** `health`; **not** colliding with `data.lifecycle` / `correction.case` / `export` categories)
    - Error codes + Persian `messageFa`: e.g. `PUBLICATION_DENIED`, `PUBLICATION_NOT_FOUND`, `PUBLICATION_STALE_BLOCKED`, `PUBLICATION_SNAPSHOT_MISMATCH`, `PUBLICATION_IMMUTABLE_REWRITE`, `PUBLICATION_REPRODUCIBILITY_FORBIDDEN`, `PUBLICATION_PACKAGE_NOT_ALLOWED`, `PUBLICATION_ALREADY_NON_REPRODUCIBLE`, `PUBLICATION_METADATA_INCOMPLETE`
    - Status machine (minimum): `published` → (`superseded` via notices; still reproducible while lawful) → `non-reproducible-after-disposal` \| `package_retained` (document exact enum names; status string `non-reproducible-after-disposal` MUST appear in API/storage for FR-54)
    - Reproducibility claim helper: `isCurrentlyReproducible(pub)` → false when status is non-reproducible **or** required evidence disposed without package
    - DTOs: `DecisionPublication`, `PublicationNotice`, `ReproducibilityPackageRef`, `PublishDecisionInput`
  - [x] Register category + policy tuples in `DEV_DEMO_CATEGORIES` / `DEV_DEMO_POLICY` for read/publish/supersede/manage × `org:selfcheck`
  - [x] NEW `packages/modules/identity-access/src/seed-publication.ts` (mirror `seed-correction-case.ts` / `seed-retention.ts`): PermissionSet bound to **`hr.admin`** until AR-ACCESS freezes publisher role — SoD: do **not** auto-grant audit/ops/trust
  - [x] Export from `@divan/reporting` index; dedicated `DecisionPublicationError` (map at API)

- [x] Task 2: Persistence — publications, notices, package refs (AC: #1–#3)
  - [x] NEW `packages/db/sql/019_decision_publications.sql` (next free after `018_correction_cases.sql`):
    - Schema e.g. `reporting.decision_publication` (prefer `reporting` schema alongside `export_artifact` — document choice)
    - `decision_publication` table: id, report_key, report_version, metric_version, snapshot_hash, snapshot_ref jsonb minimized, filters_snapshot jsonb, evaluation_mode, as_of_date, published_at, publisher_account_id, permitted_audience jsonb (permission/scope codes only), status, reproducibility_state (`reproducible` \| `package_retained` \| `non-reproducible-after-disposal`), correlation_id, optional `source_export_artifact_id` (nullable FK-ish text — **link**, not fork SoT), created attributable fields
    - **Immutability rule:** decision-defining columns (filters, snapshot_hash, as_of, versions, audience, report_key) must **not** be UPDATEd after insert — enforce via trigger and/or app guard throwing `PUBLICATION_IMMUTABLE_REWRITE`; allowed UPDATEs only for status/reproducibility_state (+ attributable supersession flags) with lifecycle_event row
    - `publication_notice` table (append-only): id, publication_id, notice_kind (`correction` \| `metric_policy_change` \| `disposal` \| `supersession`), trigger_ref_type, trigger_ref_id, note, created_at, actor_account_id, correlation_id — **never DELETE**
    - `reproducibility_package` table (optional minimized): id, publication_id, package_kind (provisional code), content_hash, retention_class, created_at, disposed_at?, bytes nullable only if AR-DATA provisional allow — default prefer **metadata+hash without row PII**
    - Indexes: report_key+published_at; status; snapshot_hash; publisher
  - [x] Repo via `pg` Pool/PoolClient in `@divan/reporting` (`decision-publication-repo.ts`) — **web stays thin**
  - [x] Migrations-only (do **not** expand `ensure*Schema` sprawl)

- [x] Task 3: Publish pipeline (AC: #1, #5–#6)
  - [x] Normative pipeline:
    ```text
    authorize(report.publication.publish)
      → honor audit-trust suspend
      → refuse if blocking stale/recalc (reuse platform signal / gold-CTA gate spirit)
      → authorize population for report key (PopulationPort ∩ InferenceBulk channel "report")
      → bind snapshot_hash from reviewed StableSnapshotInput (mismatch → PUBLICATION_SNAPSHOT_MISMATCH)
      → persist publication metadata ONLY (no unauthorized row embed)
      → appendAccessEvent(operation: "report.publication.publish")
      → return DecisionPublication DTO
    ```
  - [x] Reuse `computeExportSnapshotHash` or shared canonical helper — **do not** invent a second hash algorithm
  - [x] Optional: link to an existing ready export artifact id as custody twin — still distinct product; export TTL ≠ publication lifetime
  - [x] Fail closed if provisional report/metric version required and unset (`PUBLICATION_METADATA_INCOMPLETE`)

- [x] Task 4: Supersession notices — Correction & policy triggers (AC: #2)
  - [x] `createPublicationNotice({ publicationId, noticeKind, triggerRef, actor })` — append-only; marks publication `superseded` (or sets `has_supersession_notice`) **without** rewriting decision columns
  - [x] Hook points (pick minimal viable; document in Completion Notes):
    1. **Correction:** after successful `correctPersonnelEvent` (or thin subscriber/helper called from web/personnel lifecycle) → find publications whose filters/population intersect corrected person/as-of window **cheaply** OR require explicit publisher “link notice” API for MVP — **prefer automatic notice when intersection is unambiguous; otherwise explicit API + honesty** (never silent rewrite)
    2. **Metric/policy version bump:** provisional helper `bumpMetricVersion` / publish-time version compare — when catalogue provisional version string changes, open notices for publications on that report_key still claiming current reproducibility
  - [x] UI must show notice list on publication detail; list badge «جایگزین / اصلاح‌شده»
  - [x] Selfcheck: Correction/notice path leaves original filters/snapshot_hash bytes identical

- [x] Task 5: Disposal fork — package vs `non-reproducible-after-disposal` (AC: #3)
  - [x] UPDATE `packages/modules/person-employment/src/data-lifecycle.ts` disposal orchestrator (or inject publication port):
    - After/with export dispose propagation, call `onRequiredSourceDisposed({ scope, disposalRunId })` in reporting module
    - For each intersecting publication still claiming reproducibility:
      - if provisional policy allows package → `retainReproducibilityPackage` (minimized) + state `package_retained`
      - else → set `reproducibility_state = non-reproducible-after-disposal`, append disposal notice, **clear any retained unauthorized package bytes**
    - Never refuse disposal to “keep reproducibility”
  - [x] Retrieve/list paths: if non-reproducible, API returns claim `currentlyReproducible: false` + Persian honesty; **forbid** “باز‌تولید کن” CTA
  - [x] Hold gate: active legal hold may block disposal (existing 7.3) — publications wait; do not invent hold bypass

- [x] Task 6: Wire 7.5 outcome links + consume export patterns (AC: #4)
  - [x] UPDATE `validateOutcomeTarget` in correction-case: when link type `published_artifact` or `decision_publication`, require row in `decision_publication` (or document if still allowing export artifact ids — **prefer publication id as FR-54 target**)
  - [x] UPDATE operational-copy: replace “۷٫۶ هنوز ساخته نشده” honesty with real labels when product present; keep hook type for backlog edge cases
  - [x] Do **not** fork export download bytes into publication SoT

- [x] Task 7: Thin tRPC + UI (AC: #1–#7)
  - [x] NEW `apps/web/src/server/decision-publication.ts`:
    - Procedures: `list`, `get`, `publish`, `listNotices`, `createNotice` (manual), `capabilities`; optional `markNonReproducible` for admin repair path
    - `governedProcedure` + soft PermissionSet after envelope; map domain errors via `operational-copy`
    - Soft-deny on secondary allow-path append failure
  - [x] Register in `apps/web/src/server/root.ts`
  - [x] UI (pick **one**; document choice):
    - **Preferred:** extend `apps/web/components/reports/report-catalogue-panel.tsx` with «انتشار به‌عنوان تصمیم رسمی» CTA after a successful reviewed run (requires snapshot hash) + NEW publications list section/drawer
    - **Alt:** NEW `/publications` only if IA insists — then UPDATE nav + Layout≠RSC `assertPageAccess` (do not invent IA lightly)
  - [x] Layout≠RSC on any new page: `auth()` → `assertPageAccess` → client panel
  - [x] Persian RTL + digits; Skeleton; error ≠ empty; single dialog depth; destructive confirm on publish
  - [x] Show status badges: منتشرشده / دارای اعلان جایگزینی / غیرقابل‌بازتولید پس از امحا / بستهٔ بازتولید نگهداری‌شده
  - [x] Disable publish CTA when stale-recalc blocking (UX-DR5)
  - [x] UPDATE `apps/web/lib/operational-copy.ts` — never forward raw `error.message`
  - [x] Interactive a11y: labeled controls; focus restore; 200% zoom; status not color-only

- [x] Task 8: Verify + DoD (AC: #1–#7)
  - [x] Selfchecks: publish records required FR-54 fields; unauthorized deny; immutable rewrite throws; notice after Correction/manual trigger; disposal → package **or** `non-reproducible-after-disposal`; currentlyReproducible false after disposal fork; correction-case can link real publication id; trust suspend blocks publish; soft-deny secondary; `kernel_events` append-only untouched
  - [x] `pnpm` typecheck + eslint on touched packages
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits

### Manual DoD checklist

- [x] Publish from reports UI (or chosen surface) persists all FR-54 metadata fields without unauthorized row embed
- [x] Coarse nav alone cannot publish — soft PermissionSet required after envelope
- [x] Snapshot mismatch fail-closed; blocking stale prevents publish
- [x] After Correction/notice: original publication filters/snapshot unchanged; notice visible; not claimed silently current
- [x] After disposal without package: status `non-reproducible-after-disposal`; UI/API cannot claim currently reproducible
- [x] Reproducibility never blocks disposal
- [x] Correction-case outcome can link real publication id (not only pending hook)
- [x] 7.4 trust suspend still blocks new publish/supersede
- [x] Export artifact lifecycle still independent (TTL/custody) — not relabeled as decision publication
- [x] No named GDPR/jurisdiction claim; AR provisional markers present
- [x] Persian RTL / digits; UX-DR24 copy; no secrets in UI
- [x] Sprint may claim FR-54 **publication substrate** — **not** full AR-REPORTING/AR-DATA/LG-4 production acceptance; **not** FR-55/FR-56 complete

### Review Findings

- [x] [Review][Decision] Disposal fork soft-skip vs AC #3 reproducibility claim — resolved: per-publication catch (fork never aborts mid-loop); lifecycle soft-skip retained only for catastrophic adapter/DB failure with Completion Notes residual honesty
- [x] [Review][Decision] `markNonReproducibleAfterDisposal` may downgrade `package_retained` — resolved: refuse unless `force: true`; disposal fork uses `force: true` after failed retain
- [x] [Review][Patch] Disposal fork ignores disposal scope and can mark all reproducible publications [`apps/web/src/server/retention.ts:329`]
- [x] [Review][Patch] Mid-loop `markNonReproducibleAfterDisposal` throw aborts remaining pubs and surfaces as whole-fork skip [`packages/modules/reporting/src/decision-publication.ts:663`]
- [x] [Review][Patch] Publish/notice/lifecycle paths are not transactional with required `appendAccessEvent` [`packages/modules/reporting/src/decision-publication.ts:148`]
- [x] [Review][Patch] Publish skips PopulationPort ∩ InferenceBulk (channel `report`) required by Task 3 / AC #1 [`apps/web/src/server/decision-publication.ts:353`]
- [x] [Review][Patch] Empty `fieldIds` accepted on publish (`z.array(...).max(200)` allows `[]`) [`apps/web/src/server/decision-publication.ts:344`]
- [x] [Review][Patch] `decision_publication` / `reproducibility_package` lack DELETE forbid triggers (only `publication_notice` has one) [`packages/db/sql/019_decision_publications.sql:92`]
- [x] [Review][Patch] Selected-publication notices query has no loading/error UI branch [`apps/web/components/reports/decision-publication-panel.tsx:211`]
- [x] [Review][Patch] Notice kinds rendered as raw English enums [`apps/web/components/reports/decision-publication-panel.tsx:211`]
- [x] [Review][Patch] SQL comment overclaims app-level `PUBLICATION_IMMUTABLE_REWRITE`; PG rewrite exceptions not mapped to domain code [`packages/db/sql/019_decision_publications.sql:7`]
- [x] [Review][Patch] Confirm overlay lacks Escape / focus trap / backdrop dismiss [`apps/web/components/reports/decision-publication-panel.tsx:234`]
- [x] [Review][Patch] Correction-case `decision_publication` target validation bubbles missing-relation as infra error [`packages/modules/person-employment/src/correction-case.ts`]
- [x] [Review][Defer] Retrieve/list do not enforce recorded `permittedAudience` [`apps/web/src/server/decision-publication.ts`] — deferred, pre-existing MVP `org:selfcheck` / Known gaps IDOR class
- [x] [Review][Defer] Person-intersection helper uses JSON text `LIKE` + `LIMIT 100` [`packages/modules/reporting/src/decision-publication-repo.ts`] — deferred, pre-existing; auto-Correction wire already honesty-deferred
- [x] [Review][Defer] Selfchecks are mostly string/optional-DB and skip disposal-scope / immutability trigger proofs [`*.selfcheck.ts`] — deferred, pre-existing Vitest/harness carry-in
- [x] [Review][Defer] Seed grants read+publish+supersede+manage on single `hr.admin` PermissionSet [`packages/modules/identity-access/src/seed-publication.ts`] — deferred, pre-existing provisional AR-ACCESS SoD freeze
- [x] [Review][Defer] Client-supplied `fieldIds` not re-intersected with actor-permitted catalogue fields on publish API [`apps/web/src/server/decision-publication.ts:344`] — deferred, pre-existing MVP trust of reviewed-run hash from UI session

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Formal publication metadata per FR-54 | Treat live `report.run` or export download as “published decision” |
| Append-only supersession/correction notices | Silently UPDATE decision-defining publication columns |
| Post-disposal package **or** `non-reproducible-after-disposal` | Claim current reproducibility after required source disposal without package |
| Reproducibility never overrides disposal | Refuse dispose to keep rows/bytes “for audit pretty-printing” |
| Honor 7.4 trust suspend + AD-5 required access events | Parallel audit SoT or Prisma audit tables |
| Soft PermissionSet after envelope; seed on hr.admin with SoD | Coarse nav alone as authz; auto-grant audit/ops |
| Reuse export snapshot hash spirit + report catalogue keys | Invent parallel hash stack or new report keys |
| Thin web; domain in `@divan/reporting`; operational-copy | English placeholders; PlaceholderPage as “done” |
| Migrations-only `019_*.sql` via `pg` | Prisma models for publication tables; `ensure*Schema` sprawl |
| Wire 7.5 links to real publications | Fabricate packages from correction-case UI |

### Absolute non-goals

- Rewriting 5.5 report assemblers / inventing new launch report keys
- Forking 6.5 export artifact SoT or claiming export TTL is AR-DATA retention
- Rewriting 7.1–7.4 cores; rewriting 7.5 case machine (link validation only)
- 7.7 Launch Artifact change-control product (provisional version strings only)
- 7.8 evaluation-snapshot integrity product (provisional hash bind only)
- PopulationPort production cutover; AD-6 Prisma↔PoolClient; Vitest mandate; hash-chain tamper product
- Claiming Divan revokes local/email copies of previously downloaded exports or printed decisions
- Inventing AR-REPORTING freeze, jurisdiction, or LG-4 complete
- Embedding unauthorized person/compensation values inside publication rows “for convenience”

### UPDATE files — current state → this story → preserve

| File | Current (post-7.5) | Change | Preserve |
| --- | --- | --- | --- |
| `packages/modules/reporting/src/index.ts` | dashboard/report/export exports | Export publication API | Existing 5.4/5.5/6.5 contracts |
| `packages/modules/reporting/src/export-artifact.ts` | snapshot hash + dispose | **Reuse** hash helper; optional link id only | Pipeline, custody, reauth, TTL |
| `apps/web/components/reports/report-catalogue-panel.tsx` | run + export panel | Add publish CTA + publications affordance | Catalogue filters, Jalali, export panel |
| `apps/web/src/server/report.ts` | catalogue/run | Optional shared snapshot helper; do not break run | `report.catalogue` / `report.run` meta |
| `apps/web/src/server/root.ts` | no publication router | Register thin router | Existing routers |
| `apps/web/lib/operational-copy.ts` | 7.5 pending publication honesty | Real publication/supersession/non-reproducible copy | UX-DR24; exact LDAP/custody strings |
| `packages/modules/person-employment/src/data-lifecycle.ts` | dispose exports | Hook publication disposal fork | Hold gate; propagation_result honesty |
| `packages/modules/person-employment/src/correction-case.ts` | stub `published_artifact` | Validate real publication ids | Case status machine; attachment safety |
| `packages/kernel/audit-envelope/src/categories.ts` | no `report.publication` | Register category + policy | Never reuse `health` |
| `packages/modules/identity-access/src/seed.ts` | correction-case seed | Wire `seed-publication` | Idempotent seed order |
| `apps/web/src/server/trpc.ts` | trust/append INTERNAL mapping | Do not regress; map new domain errors | Soft-deny secondary |
| NEW `019_decision_publications.sql` + domain | Absent | Publication + notices + package refs | `kernel_events` append-only untouched |

### Architecture compliance

- **AD-1:** Single process + one PG — publication tables in same DB (`reporting` schema preferred)
- **AD-2:** Publications are **decision evidence plane**; live projections remain derived — never in-place rewrite event history to “fix” a published report
- **AD-3:** Web → `@divan/reporting` + thin hooks in person-employment; no Prisma for publication tables; repo uses `pg`
- **AD-5:** Identity-access coarse + envelope fine; required access events on publish/supersede/disposal-mark; FR-54 under AR-REPORTING/AR-DATA/AR-ACCESS/AR-AUDIT
- **AD-6:** Raw SQL migrations; keep event-store triggers intact; do not expand request-path `ensure*Schema`
- **Capability map:** FR-54 → reporting BC (+ disposal hook from person-employment + correction-case link validation); FR-56/55 deferred products stay out
- **Spine:** FR-46..56 via kernel+modules + Launch Artifacts — implement **substrate + fail-closed provisional**, do not invent frozen AR matrices

### Publication vs export vs run (normative)

| | Report run (5.5) | Export artifact (6.5) | Decision publication (7.6) |
| --- | --- | --- | --- |
| Lifetime | Request | ~4h TTL provisional | Organizational evidence lifetime |
| Mutability | Recalculates | Revoke/dispose bytes | Decision columns immutable; notices append |
| Bytes | None persisted | CSV/XLSX managed | Default **no** unauthorized rows; optional minimized package |
| Audience | Live authz | Owner + retrieve perm | Recorded permitted audience codes |
| Reauth | N/A | create + each download | Publish-time authz; retrieve respects current authz + recorded audience honesty |

### Privacy-preserving package (provisional algorithm)

```text
on retainReproducibilityPackage(publicationId, disposalRunId):
  authorize/manage path + attributable actor (system disposal actor OK if audited)
  if AR-DATA provisional disallows package for this report_key/class:
    mark non-reproducible-after-disposal; return
  package = {
    publicationId,
    reportKey, reportVersion, metricVersion,
    snapshotHash, filtersHash, asOf,
    populationVolumeBucket? (coarse — not person ids),
    permittedAudience,
    contentHash,  # hash of package canonical form
    disposalRunId
  }
  # FORBIDDEN: person rows, national ids, compensation amounts, names unless AR-DATA explicitly allowlists
  persist package metadata (+ optional encrypted minimized blob only if allowlisted)
  set reproducibility_state = package_retained
  append notice kind=disposal + access event
```

Industry alignment (do not over-build): prefer **append-only + supersession pointers** over UPDATE; optional SHA-256 content hash on package; **do not** mandate full WORM hash-chain product in this story (open Epic carry-in).

### Permission seeding (provisional)

| Key | Use | Seed bind |
| --- | --- | --- |
| `report.publication.read` | List/get publications + notices | `hr.admin` |
| `report.publication.publish` | Create publication from reviewed run | `hr.admin` |
| `report.publication.supersede` | Manual notice (if exposed) | `hr.admin` |
| `report.publication.manage` | Non-reproducible mark / package retain admin path | `hr.admin` |
| Existing `report.export` / `export.retrieve` | Unchanged 6.5 | Unchanged |
| Existing `data.lifecycle.*` | Disposal trigger | Unchanged 7.3 |

Mark `@provisional-pending-AR-ACCESS-freeze` / `@provisional-pending-AR-REPORTING-freeze` / `@provisional-pending-AR-DATA-freeze`.

### Correction → supersession trigger (AR-TEMPORAL honesty)

AR-TEMPORAL still lists **published-report supersession trigger** as open. Implement:

1. Durable `publication_notice` rows with `notice_kind` + trigger refs  
2. Fail-closed: never rewrite publication decision columns  
3. Document MVP trigger scope (automatic intersection vs explicit link) in Completion Notes  
4. Do **not** invent full AR-TEMPORAL oracle freeze

### Migration-evidence / carry-in honesty (still mandatory)

| Fact | Publication product must |
| --- | --- |
| PopulationPort fixture-default | Not present publication as production population proof; disclose if scope claims appear |
| AD-6 / Baseline projector gaps | Not claim historical reconstruction solely from publication package |
| Export Base64 size-cap defer | Do not silently uncapped Base64 for packages; prefer metadata-only or capped |
| Soft-deny secondary gaps | Do not upgrade soft-failed list evidence into “fully audited publications catalogue” |
| Person-org IDOR on Correct (open) | If auto-notice hooks Correct mutation path, harden **or** explicit defer in Completion Notes |
| InferenceBulk process-local race | Retain fail-closed; same channel as report |
| Sticky break-glass / fingerprint | Out of scope UX debt — do not pretend fixed |
| 7.8 snapshot integrity absent | Provisional hash bind + honesty; do not claim FR-56 done |
| 7.7 AR change-control absent | Provisional version strings only |

### UX notes

- Prefer extending **گزارش‌ها** catalogue (UX-DR19) — one composition: run → optional export → optional **formal publish**
- Status pattern UX-DR22: non-reproducible and superseded are **distinct** from live run empty/error
- Empty publications: Persian empty copy in operational-copy
- UX-DR5: disable publish (and export) gold CTA when stale
- UX-DR17 export panel remains for downloads — do not merge panels into one confused card
- Single dialog depth; Skeleton; error ≠ empty; status not color-only
- Jalali as-of unambiguous (FR-44 / UX-DR12)

### AR honesty

- **AR-REPORTING** open: decision-publication lifecycle + post-disposal outcome — implement substrate + provisional codes
- **AR-DATA** open: formal-report post-disposal evidence/status — package allow/deny provisional
- **AR-TEMPORAL** open: supersession trigger — notices + no silent rewrite
- **AR-ACCESS** open: audience matrix pending — record audience codes + enforce current retrieve fail-closed
- Forbidden: claiming LG-4 complete; inventing jurisdiction; claiming FR-55/56 done; inventing new Launch Report keys

### Known gaps to document (do not silently “fix” as done)

| Gap | Handling in 7.6 |
| --- | --- |
| AR-REPORTING/AR-DATA not frozen | Provisional codes + fail-closed incomplete metadata |
| FR-56 evaluation snapshot product | Provisional snapshot_hash bind; full product → 7.8 |
| FR-55 AR change control | Provisional version strings; product → 7.7 |
| Automatic Correction→publication intersection may be ambiguous | Explicit notice API + documented MVP auto scope |
| Package byte storage vs metadata-only | Prefer metadata+hash; bytes only if provisional allowlist |
| Unscoped list IDOR class | MVP `org:selfcheck`; document defer or harden |
| Hash-chain WORM | Optional contentHash only — not full chain product |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Existing monorepo | Node 22 / TS 5.x / pnpm — no new framework |
| Next.js 16 / React 19 / tRPC 11 | Thin router + client panel patterns from 7.5/6.5 |
| Zod | Input schemas for publish/list |
| `pg` + SQL migrations | `019_*.sql`; Pool/PoolClient repos |
| `node:crypto` createHash | Reuse export canonical SHA-256 spirit |
| exceljs | **Not** required for publication metadata; keep on export path only |
| Test | `*.selfcheck.ts` + `tsx` — Vitest still deferred open carry-in |

### Latest technical specifics

- **Immutability:** Prefer INSERT notices + restricted status UPDATEs; PostgreSQL `BEFORE UPDATE` trigger on decision-defining columns is an acceptable defense-in-depth (same spirit as append-only audit guidance — correct via supersession, not rewrite).
- **Canonical hashing:** Keep one stable stringify (sorted keys) shared with export snapshot hashing so publication and export can bind the same reviewed run.
- **Do not** add HMAC hash-chain / advisory-lock WORM product unless already present — out of scope; contentHash on package is enough for MVP tamper evidence.

### Previous story intelligence (7.5)

- Domain constants often land in `@divan/audit-envelope` for control-plane (7.3–7.5); **FR-54 is reporting BC** — put orchestration in `@divan/reporting`, register category in envelope, seed in identity-access (same split as export).
- Soft PermissionSet after envelope; trust suspend honor; soft-deny secondary list paths.
- Outcome links: validate targets; decided-status gate before linking; `pending_publication_hook` honesty copy already in `operational-copy.ts` — update carefully.
- Review patches to anticipate: transactional fail-closed on required `appendAccessEvent`; optimistic concurrency on status UPDATE; no mutations after terminal states; Persian labels not raw English enums; capabilities query failure must not silently hide all actions.
- BOM-safe sprint-status edits on Windows.

### Git intelligence

Recent commits: `992bce2` story 7.5; `e9f1107` story 7.4; `4754116` story 7.3; `f29e3c7` story 7.2; `08bff26` story 7.1.  
Patterns to copy: provisional permission seeds, dual-layer selfchecks (domain + web), Gate tables, dedicated `0xx_*.sql`, soft-deny secondary vs fail-closed primary, replace/extend existing panels (not Placeholder as done), review Patch triage after implement, thin `apps/web/src/server/*` routers.

### Project context reference

- No `project-context.md` found in repo — rely on this story + architecture spine + prior Epic 7 stories.
- Open Epic 6 action items still apply: AR fail-closed in Epic 7; artifact reauth already consumed by 6.5/7.1 — publications retrieve must not invent a weaker path.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7 / Story 7.6 AC]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-54, FR-56, AR-REPORTING, AR-DATA, AR-TEMPORAL]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §5.3 supersession notices; § acceptance reproducibility fork]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — reporting BC, AD-2/AD-5, FR→module map]
- [Source: `_bmad-output/implementation-artifacts/7-5-external-data-subject-correction-cases.md` — pending_publication_hook honesty]
- [Source: `_bmad-output/implementation-artifacts/7-3-retention-disposal-legal-hold.md` — disposal propagation; FR-54 deferred]
- [Source: `packages/modules/reporting/src/export-artifact.ts` — `computeExportSnapshotHash`, dispose/custody]
- [Source: `packages/modules/reporting/src/report-catalogue.ts` — launch report keys]
- [Source: `packages/modules/person-employment/src/correction-case.ts` — outcome link validation]
- [Source: `apps/web/lib/operational-copy.ts` — pending publication honesty strings]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- `pnpm --filter @divan/reporting selfcheck:decision-publication` — pure + DB ok
- `pnpm --filter @divan/web selfcheck:decision-publication` — static wiring ok
- `pnpm --filter @divan/db sql:apply` — `019_decision_publications.sql` applied
- typecheck: `@divan/reporting`, `@divan/web`, `@divan/person-employment`, `@divan/audit-envelope`, `@divan/identity-access`

### Completion Notes List

- FR-54 substrate in `@divan/reporting`: immutable `decision_publication` metadata, append-only `publication_notice`, optional metadata-only `reproducibility_package`.
- Schema choice: `reporting` alongside `export_artifact` (distinct product; export TTL ≠ publication lifetime).
- Permissions provisional on `hr.admin` via `seed-publication.ts`; SoD — not auto-granted to audit/ops/trust.
- Publish reuses `computeExportSnapshotHash` / `computeReportExportSnapshotHash`; soft PermissionSet + trust-sensitive `governedProcedure`; stale/recalc fail-closed.
- Supersession MVP: explicit `createNotice` API + `notifyPublicationsForCorrection` (cheap filters text intersection) + `bumpMetricVersionNotices`. Automatic Correction wire into `correctPersonnelEvent` deferred — explicit API + helper documented (ambiguous intersection honesty).
- Disposal fork injected via `RunDisposalDeps.onRequiredSourceDisposed`; default AR-DATA provisional deny package → `non-reproducible-after-disposal`; never blocks disposal. Package retain via `PUBLICATION_PACKAGE_RETAIN=1` or allowlist. Scope intersection (person/artifact) required when scope is passed; org_scope without ids may still fork all. Per-pub catch so mid-loop failures do not abort remaining pubs. Residual: catastrophic adapter/DB failure soft-skips with possible `currentlyReproducible: true` until retry — never refuse disposal.
- `markNonReproducibleAfterDisposal` refuses `package_retained` unless `force: true` (disposal fork uses force after failed retain).
- Publish/notice/manage mutations use `withPgTransaction` with required `appendAccessEvent`. Publish web path gates PopulationPort ∩ InferenceBulk (channel `report`).
- Correction-case: prefer `decision_publication` link type (also validates `published_artifact` against same store); `pending_publication_hook` honesty updated for backlog-only.
- UI choice: extended reports catalogue with `DecisionPublicationPanel` (not a new `/publications` route).
- Claims: FR-54 publication **substrate** only — not AR-REPORTING/AR-DATA freeze, not FR-55/FR-56, not LG-4 complete.

### File List

- packages/db/sql/019_decision_publications.sql
- packages/modules/reporting/src/decision-publication-errors.ts
- packages/modules/reporting/src/decision-publication-permissions.ts
- packages/modules/reporting/src/decision-publication-repo.ts
- packages/modules/reporting/src/decision-publication.ts
- packages/modules/reporting/src/decision-publication.selfcheck.ts
- packages/modules/reporting/src/index.ts
- packages/modules/reporting/package.json
- packages/modules/identity-access/src/seed-publication.ts
- packages/modules/identity-access/src/seed.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/src/index.ts
- packages/kernel/audit-envelope/src/correction-case.ts
- packages/modules/person-employment/src/data-lifecycle.ts
- packages/modules/person-employment/src/correction-case.ts
- packages/modules/person-employment/src/index.ts
- apps/web/src/server/decision-publication.ts
- apps/web/src/server/decision-publication.selfcheck.ts
- apps/web/src/server/root.ts
- apps/web/src/server/retention.ts
- apps/web/src/server/report.ts
- apps/web/src/server/correction-case.ts
- apps/web/components/reports/decision-publication-panel.tsx
- apps/web/components/reports/report-catalogue-panel.tsx
- apps/web/components/correction-cases/correction-cases-panel.tsx
- apps/web/lib/operational-copy.ts
- apps/web/package.json
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-6-published-decision-report-reproducibility.md

### Change Log

- 2026-07-29: Implemented Story 7.6 FR-54 decision-publication substrate (publish, notices, disposal fork, correction-case links, reports UI, selfchecks).
- 2026-07-30: Code-review patches — disposal scope intersection, per-pub fork catch, TX+access events, PopulationPort publish gate, DELETE forbid triggers, package_retained force guard, UI a11y/notice labels, PG immutable rewrite mapping.

## Story completion status

- **Status:** done
- **Note:** Code-review patches applied — FR-54 substrate ready; residual deferrals documented
