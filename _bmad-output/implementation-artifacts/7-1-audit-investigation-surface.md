---
baseline_commit: d9e9eba
---

# Story 7.1: Audit Investigation Surface

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an Audit / Security Reviewer,
I want a permissioned audit surface over business and access events,
so that I can investigate activity independently of ordinary HR administration (FR42, FR51).

**Story key:** `7-1-audit-investigation-surface`  
**Epic:** 7 — Audit, Operations & Evidence Controls (FR42, FR45, FR50, FR51, FR53–FR56)  
**Prerequisite:** Epics 1–6 done. Evidence writers already append to `kernel_events` via `@divan/event-store` + `@divan/audit-envelope`. Story **6.5** shipped governed export artifact create/download with `reauthorizeForQueuedOrArtifactWork` + custody. Coarse role `audit_reviewer` lands on `/audit` (placeholder only). **No** `listAccessEvents` / audit tRPC / investigation UI exists yet.

## Acceptance Criteria

1. **Given** an Audit reviewer landing on ممیزی  
   **When** they search audit evidence  
   **Then** they can retrieve AR-AUDIT-governed events covering authentication, sensitive/denied reads, mutations, finalization, Cancel/Reverse/Correction, organization/headcount changes, Override, import, export, permission/configuration, and privileged access — sourced from the append-only kernel event store (`event_class ∈ {business, access}`), not a parallel Prisma “audit” table

2. **And** each retrieved evidence row identifies **actor**, **time**, **operation**, **entity/type**, **scope**, **result** (where applicable for access events), **reason** (where applicable), and **correlation** reference

3. **And** ordinary operational users cannot alter audit records (no UPDATE/DELETE API; append-only store preserved); audit access is **separately permissioned** (provisional fine permission + seeded entitlement — coarse nav alone is insufficient) and **itself audited** (every investigation search/retrieve writes an access event)

4. **And** empty results show exactly «رویدادی با این فیلتر نیست.» (operational-copy key; UX-DR22)

5. **And** no actor can **approve review** of their own sensitive activity (reuse toxic / independence pattern from `completeBreakGlassPostUseReview` — block subject/requester/approver-style self-review when any disposition/ack of sensitive evidence is offered; search of public metadata about self is not a loophole for “approve review”)

6. **And** investigation retrieval of **managed export artifacts** (bytes/download) **consumes** Story 6.5 hooks only — `reauthorizeForQueuedOrArtifactWork`, custody acknowledgement, revoke/expiry/dispose — **no parallel download SoT**

7. **And** migration/import/export evidence is interpreted **honestly**:
   - AD-6 Person orphans may exist while Baseline events rolled back
   - events-only `assertZeroProductionTrace` ≠ full integrity proof
   - Baseline may lack Employment/Assignment projection → related observations may be `unavailable` (never invent zeros / never claim clean cutover from events-only)
   - PopulationPort may still be fixture-default → disclose fixture≠production on any population-scoped audit retrieval; fail-closed

8. **And** AR-AUDIT / AR-ACCESS / AR-DATA / AR-NFR / AR-MIGRATION remain **fail-closed**:
   - Do **not** invent AR numeric thresholds, retention freezes, hash-chain mandates, or “signed” audit policy
   - Provisional permission keys OK if code-marked + seeded + fail-closed (mirror `migration.*` / `export.*`)
   - Legacy `AuthAttempt` / `AccessDenial` Prisma tables are **not** a second investigation SoT; optional honesty note that full migration/backfill remains under AR-AUDIT (deferred-work Story 2.1 plan) — do not dual-write sprawl

9. **And** this story does **not** own: ops health UI (7.2), retention/legal-hold product (7.3 beyond consuming 6.5 revoke/dispose for artifact links), audit trust fail-safe suspend of writers (7.4 — envelope already has `AUDIT_APPEND_FAILED`), correction cases (7.5), decision-report reproducibility (7.6), Launch Artifact change-control (7.7), evaluation-snapshot integrity productization (7.8), PopulationPort cutover, AD-6 single-connection hardening, Vitest mandate

## Tasks / Subtasks

- [x] Task 1: Read-model query on kernel event store (AC: #1–#2, #8)
  - [x] NEW under `packages/kernel/event-store/src/`:
    - `access-event-query.ts` (name flexible) — **read-only** `queryAuditEvidence` / `listAccessEvents` (+ optional business-event rows needed for FR42 coverage) with filters: actorAccountId, occurredAt range, operation (exact/prefix), entityType, entityId, result (`allow`|`deny`), correlationId, eventClass
    - Typed **record** DTO distinct from `AppendAccessEventInput` (e.g. `AuditEvidenceRecord`: id, eventClass, correlationId, actorAccountId, occurredAt, operation, scope, result, reason, entityType, entityId, payload — **never** include sensitive HR field values; payload already constrained non-sensitive)
  - [x] SQL: filter on existing columns + indexes (`occurred_at`, `correlation_id`, `event_class`). For `scope` JSONB filters: prefer containment `@>` or expression B-tree on stable keys — do **not** rely on `scope->>'x' =` without a matching expression index. Optional NEW `016_audit_investigation_indexes.sql` only if EXPLAIN proves need (GIN on scope or B-tree on operation/actor) — follow `packages/db/sql/README.md` (`IF NOT EXISTS`, idempotent). Next number after `015_export_artifacts.sql`.
  - [x] **Hard rule:** no UPDATE/DELETE helpers; access events never feed projections (AD-3)
  - [x] Export query APIs from `packages/kernel/event-store/src/index.ts`; extend package selfcheck
  - [x] Do **not** query Prisma `AuthAttempt` / `AccessDenial` as primary SoT; if surfacing a honesty banner, point to deferred migration — no invent dual timeline

- [x] Task 2: Investigation domain + permissions + audit-of-audit (AC: #3, #5–#8)
  - [x] Prefer thin orchestration colocated with envelope consumers:
    - Option A (preferred): NEW `packages/kernel/audit-envelope/src/investigation.ts` (or identity-access if package boundary fights — document choice) that: authorize → `runGovernedRetrieval` channel `"audit"` → query event-store → append access event for the investigation itself
    - Option B: domain helpers in event-store + authorize only in web — acceptable if AD-3 held and logic stays testable via selfcheck
  - [x] Provisional permissions (code-marked; AR-ACCESS pending), recommended:
    | Key | Action | Use |
    | --- | --- | --- |
    | `audit.investigate` | `read` | Search/list evidence |
    | `audit.evidence.review` (optional if disposition UI) | `write` | Mark/ack review — **must** enforce no self-review |
  - [x] Seed policy tuples in `DEV_DEMO_POLICY` + PermissionSet for `audit_reviewer` (mirror `seed-export.ts` / migration SoD seed pattern under `@divan/identity-access`). Coarse role alone must **not** bypass envelope.
  - [x] Meta on tRPC: use `action: "read"` for search (6.4 lesson: wrong action denies). Channel `"audit"` already in `retrievalChannelSchema` / InferenceBulk / PopulationPort — **wire it**; do not invent a bypass channel
  - [x] **Audit-of-audit:** every successful/denied investigation query records access evidence (actor, purpose/filters, volume, outcome, correlation) via existing `appendAccessEvent` / envelope patterns — no parallel audit table
  - [x] **No self-review:** if UI/API offers “approve review” / disposition on sensitive activity, block when reviewer ∈ {subject, requester, prior approver} of that activity (reuse `assertToxicCombinationAllowed` + Persian toxic copy pattern from break-glass). If this story ships **search-only** with no disposition mutation, still document Gate + leave a stub guard for 7.3/7.4/break-glass review deep-links so AC #5 is not vacuously claimed — at minimum expose toxic check on any “open review” action that can complete independence requirements already in product (e.g. link out to break-glass post-use review which already enforces it)
  - [x] Error codes with `messageFa` (e.g. `AUDIT_INVESTIGATE_DENIED`, `AUDIT_SELF_REVIEW_BLOCKED`, `AUDIT_QUERY_FAILED`)

- [x] Task 3: Governed tRPC + replace `/audit` placeholder (AC: #1–#4, #6)
  - [x] NEW `apps/web/src/server/audit.ts` — thin router: `audit.search` / `audit.getByCorrelation` (names flexible); `governedProcedure`; Layout≠RSC: page still `assertPageAccess` before load
  - [x] Register in `apps/web/src/server/root.ts`
  - [x] UPDATE `apps/web/app/(app)/audit/page.tsx` — replace `PlaceholderPage` with investigation client panel
  - [x] NEW `apps/web/components/audit/audit-investigation-panel.tsx` (and small children if needed):
    - **GovernedDataTable** for results (UX-DR7) — columns: time (Jalali + precise timestamp distinct), actor, operation, entity/type, result, reason, correlation
    - Filter row: actor, time range (Jalali date-only where business; precise time where registration), operation, entity, result, correlation
    - Empty state: exact «رویدادی با این فیلتر نیست.» via `operationalCopy`
    - Persian RTL, Persian digits; UX-DR24 voice (fact + next step; no ceremonial success)
  - [x] Section tabs: **not required** for single-surface `/audit` unless IA adds sub-surfaces — do not invent tabs
  - [x] Leave-guard: only if local filter draft is dirty beyond applied query (dirty ≠ dialog `open`)
  - [x] Single dialog depth if detail Sheet/Dialog used
  - [x] **Artifact retrieval:** if row links to export artifact download, mount existing `ExportArtifactPanel` / call `export.download` — **never** new byte path. Reauth + custody mandatory
  - [x] All copy in `apps/web/lib/operational-copy.ts` — add `auditEmptyFilter`, self-review toxic, honesty banners as needed
  - [x] Interactive a11y: filter controls labeled; empty not color-only; focus order; 200% zoom readable
  - [x] Never leak `error.message` / infra; map to operational copy

- [x] Task 4: Migration-evidence honesty + 6.5 consume contract (AC: #6–#7)
  - [x] Investigation UI/API **must not** label events-only zero-trace or presence of Baseline events as proof of clean cutover integrity
  - [x] When evidence pertains to migration/recon domains that are `unavailable` (no projector), show honesty / unavailable — never invent employment/assignment facts
  - [x] Document PopulationPort fixture disclosure on channel `"audit"` responses (same honesty fields as search/export)
  - [x] Encode consume-6.5 algorithm for any managed artifact open-from-investigation (see Dev Notes)
  - [x] Close sprint action_items Epic 6 #2 (migration-evidence honesty into 7.1) and #3 (consume-6.5 into 7.1 retrieval notes) when this story file + implementation Gate hold

- [x] Task 5: Verify + DoD (AC: #1–#9)
  - [x] NEW selfcheck e.g. `@divan/event-store` `selfcheck:audit-query` and/or `@divan/audit-envelope` / `@divan/web` smoke:
    - unauthorized role → deny; no rows leaked
    - `audit_reviewer` with seed → can search; investigation itself appends access event
    - filters return expected fixture rows (seed minimal access events in selfcheck TX)
    - empty filter → empty list (UI copy asserted in web selfcheck or copy-key presence)
    - mutate/update attempt absent (API surface has no update)
    - self-review disposition blocked when applicable
    - artifact download path still goes through export reauth (if wired)
  - [x] `pnpm` typecheck + eslint on touched packages
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits

### Manual DoD checklist

- [x] `/audit` shows investigation table (not PlaceholderPage) for `audit.reviewer`
- [x] Unauthorized coarse roles cannot call `audit.search` (envelope deny + audited)
- [x] Result rows show actor, time, operation, entity/type, scope summary, result, reason, correlation
- [x] Empty filter copy exact: «رویدادی با این فیلتر نیست.»
- [x] Searching audit writes an access event (audit-of-audit)
- [x] No UI/API can UPDATE/DELETE `kernel_events`
- [x] Self-review approval path blocked (or search-only + explicit Gate note linking break-glass toxic review)
- [x] Export artifact open-from-audit uses 6.5 download + reauth + custody — no parallel bytes (CTA hidden without export entitlement / SoD)
- [x] Migration honesty: no “clean cutover” claim from events-only / Baseline-without-projection
- [x] PopulationPort fixture≠production disclosure preserved on audit channel
- [x] InferenceBulk channel `"audit"` wired via `runGovernedRetrieval` for retrieval evidence (row SoT not population-filtered — Gate exception)
- [x] Persian RTL / digits / Jalali; single dialog depth; leave-guard data-state
- [x] Sprint may claim FR-42 investigation **substrate + UI** — **not** full AR-AUDIT freeze, hash-chain, or AuthAttempt backfill complete

### Review Findings

- [x] [Review][Decision] InferenceBulk outcome ignored after `runGovernedRetrieval` — **Resolved B (2026-07-27):** evidence-only wire + Gate exception; honesty banner when retrieval outcome ≠ allow/empty; rows still from kernel_events without subjectId filter.
- [x] [Review][Decision] AC #5 self-review stub strength — **Resolved A (2026-07-27):** gate binds `evidenceEventId` → server-loaded actor as subject; vacuous parties rejected; `reviewHref` allowlisted relative paths.
- [x] [Review][Decision] Artifact open for seeded `audit.reviewer` — **Resolved C (2026-07-27):** hide open-artifact CTA unless `canOpenExportArtifact` (report|person export soft); SoD preserved — no export.retrieve seed on investigator.
- [x] [Review][Patch] Allowlist `reviewHref` to same-origin relative paths only (reject absolute / `javascript:`) [`apps/web/src/server/audit.ts`]
- [x] [Review][Patch] Leave-guard: dirty must not include dialog open (`detail !== null`) [`apps/web/components/audit/audit-investigation-panel.tsx`]
- [x] [Review][Patch] Map search/download/review errors to operational-copy — do not render raw `error.message` [`apps/web/components/audit/audit-investigation-panel.tsx`]
- [x] [Review][Patch] Escape LIKE wildcards in `operationPrefix` [`packages/kernel/event-store/src/access-event-query.ts`]
- [x] [Review][Patch] Jalali day bounds: use local/offset-aware day start/end, not bare `Z` [`apps/web/components/audit/audit-investigation-panel.tsx`]
- [x] [Review][Patch] Reject inverted date range (`from > to`) at schema or query layer [`apps/web/src/server/audit.ts`]
- [x] [Review][Patch] Surface truncation (`hasMore` / fetch `limit+1`) so investigators know results are capped [`apps/web/src/server/audit.ts`]
- [x] [Review][Patch] Distinguish loading/error from empty-filter copy in table empty state [`apps/web/components/audit/audit-investigation-panel.tsx`]
- [x] [Review][Patch] `getByCorrelation`: wrap query failures as `AUDIT_QUERY_FAILED`; log distinct operation (not always `audit.investigate.search`) [`apps/web/src/server/audit.ts`]
- [x] [Review][Patch] Audit self-review deny path (append deny evidence before FORBIDDEN) [`apps/web/src/server/audit.ts`]
- [x] [Review][Patch] Soft-deny append failure must not mask `AUDIT_INVESTIGATE_DENIED` [`apps/web/src/server/audit.ts`]
- [x] [Review][Patch] Remove UTF-8 BOM from `sprint-status.yaml` [`_bmad-output/implementation-artifacts/sprint-status.yaml`]
- [x] [Review][Patch] Import permission literals from `@divan/audit-envelope` in `seed-audit.ts` (dep already exists) [`packages/modules/identity-access/src/seed-audit.ts`]
- [x] [Review][Patch] Validate export artifact `entityId` as UUID in `isExportArtifactEvidence` [`packages/kernel/audit-envelope/src/investigation.ts`]
- [x] [Review][Patch] Disable artifact download when `getArtifact` is in error; surface operational error [`apps/web/components/audit/audit-investigation-panel.tsx`]
- [x] [Review][Patch] Warn (or fail seed loudly) when `audit.reviewer` account missing [`packages/modules/identity-access/src/seed-audit.ts`]
- [x] [Review][Patch] Strengthen domain selfchecks (empty-party self-review refusal after Decision #2; LIKE escape; date order) beyond source `includes` [`apps/web/src/server/audit.selfcheck.ts`]
- [x] [Review][Defer] Full tRPC/web smoke unauthorized→deny + no row leak / artifact reauth path [`apps/web/src/server/audit.selfcheck.ts`] — deferred, pre-existing harness gap
- [x] [Review][Defer] Unknown `event_class` coerced to `access` in `mapRow` [`packages/kernel/event-store/src/access-event-query.ts:97`] — deferred, pre-existing store invariant assumed
- [x] [Review][Defer] `capabilities` gated by same `audit.investigate` permission (soft probe unusable) [`apps/web/src/server/audit.ts:435`] — deferred, pre-existing governedProcedure pattern; UI unused

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Read evidence from `kernel_events` via `@divan/event-store` query APIs | Invent Prisma audit tables or treat `AuthAttempt`/`AccessDenial` as primary SoT |
| Separate fine permission + seed for audit investigate; envelope-authorize every search | Treat coarse `audit_reviewer` nav alone as authz |
| Audit the investigation itself (access event) | Silent unattributable audit browsing |
| Enforce no self-review — gate binds toxic parties from **server-loaded evidence id**; vacuous client party lists rejected | Allow independence via omitted/client-supplied party ids |
| Wire InferenceBulk `"audit"` via `runGovernedRetrieval` for **retrieval evidence only**; row SoT is not population-filtered by `subjectIds` (FR-48 Gate exception / Decision B); honesty when outcome ≠ allow/empty | Silently claim population-scoped filtering of kernel_events, or invent distributed InferenceBulk window |
| Consume 6.5 for managed artifact bytes only when actor holds export entitlement; hide CTA otherwise (SoD) | Parallel download / Base64 path, or seed export.retrieve onto audit investigator by default |
| Honesty on migration orphans, events-only zero-trace, Baseline projector gaps, PopulationPort fixture | Claim clean cutover / invent zeros / greenwash fixture as production authz |
| AR-AUDIT/ACCESS/DATA/NFR/MIGRATION fail-closed | Invent AR freeze numbers, hash-chain mandate, retention product |
| Thin web; query/domain in kernel packages; GovernedDataTable + operational-copy | English placeholders; PlaceholderPage left as “done” |

### Absolute non-goals

- Story 7.2 ops health dashboards; 7.3 retention/legal-hold product UI; 7.4 writer fail-safe expansion beyond existing envelope `AUDIT_APPEND_FAILED`
- Full AuthAttempt/AccessDenial historical backfill (plan remains deferred-work; stop sprawl already done)
- Hash-chain tamper evidence (NFR-10 / Architecture “schema-ready”) — only if AR-AUDIT freezes it (it has not)
- PopulationPort default-registry cutover; AD-6 Prisma↔PoolClient orphan fix; `ensure*Schema` migrations-only
- Person-org IDOR on Cancel/Reverse/Correct; Add/QuickCreate dedupe; logout→`requestNavigation`
- Vitest mandate (selfcheck `tsx` remains house pattern)
- Inventing InferenceBulk distributed window or sticky break-glass UX debt fixes

### UPDATE files — current state → this story → preserve

| File | Current (post-6.5) | Change | Preserve |
| --- | --- | --- | --- |
| `packages/kernel/event-store/src/index.ts` | `appendAccessEvent` only — **no list/query** | Add read-only query DTOs + functions | Append-only semantics; `withTransaction`; business-event APIs |
| `packages/kernel/audit-envelope` | Authorize + append; InferenceBulk channel `"audit"` reserved | Investigation authorize orchestration + policy seeds | Default-deny; category registry; no HR value duplication |
| `apps/web/app/(app)/audit/page.tsx` | `PlaceholderPage` | Investigation panel | Route + title ممیزی |
| `apps/web/src/server/root.ts` | No audit router; channel enum includes `"audit"` | Register audit router; use channel | Existing routers; Layout≠RSC |
| `apps/web/lib/operational-copy.ts` | No audit empty copy | Add exact empty + toxic/honesty strings | UX-DR24; export/import strings |
| `packages/modules/identity-access` navigation/seed | Coarse `/audit` only; `audit.reviewer` user | Seed fine `audit.investigate` (+ review if needed) | Nav matrix; break-glass toxic review |
| `apps/web/components/export/export-artifact-panel.tsx` | Working 6.5 panel | **Reuse** from audit detail if artifact linked | Reauth/custody pipeline — no fork |
| NEW `016_…sql` (optional) | Absent | Indexes only if needed | Do not break `015_export_artifacts` |
| NEW audit panel + server module | Absent | Full investigation UI/API | Do not invent section tabs without IA |

### Architecture compliance

- **AD-3:** Kernel owns event-store + audit-envelope; modules do not own the event log; no cross-module internal table reads
- **AD-5:** identity-access coarse authz + envelope fine category checks; single store `event_class ∈ {business, access}`; access events query/report only
- **AD-6:** Raw SQL via `pg` for kernel_events — **not** Prisma models for audit rows
- **Capability map:** Audit (FR-42, FR-51) → audit-envelope; Export (FR-41) stays reporting — investigation **consumes** export retrieval, does not re-home it
- **FR-47:** audit retrieval evaluates subject, object, category, action, Organizational Scope, time semantics via envelope + PopulationPort ∩ InferenceBulk
- **FR-48:** channel `"audit"` participates in inference/bulk controls — wire `runGovernedRetrieval` for retrieval evidence; investigation row SoT is not population-filtered (Gate exception / Decision B)

### Consumer / artifact retrieve contract (encode — do not rediscover)

When investigation opens a **managed export artifact**:

```text
on audit.openArtifact(artifactId):
  # UI may deep-link to existing export.get / export.download only
  authorize export.retrieve (existing 6.5 keys) — NOT a new audit-byte permission that skips reauth
  load artifact; expired|revoked|disposed → deny (existing codes)
  sensitive|bulk → custody ack required (existing panel)
  reauth = reauthorizeForQueuedOrArtifactWork({ populationChannel: "export" | "audit" as already supported, ... })
  if !reauth.allowed → REAUTH_FAILED
  stream via existing export.download — never new Base64 endpoint under audit.*
```

Investigation **search** uses `populationChannel: "audit"` / InferenceBulk `"audit"`. Artifact **bytes** remain on the export control plane.

### Migration-evidence honesty (Epic 6 retro — mandatory)

| Fact | Investigation must |
| --- | --- |
| AD-6 `createPerson` Prisma outside cutover TX can orphan Person while events roll back | Not present “zero production trace” as full integrity |
| `assertZeroProductionTrace` is events-only | Label accordingly; do not upgrade claim |
| No Baseline→Employment/Assignment projector | Related recon domains may be `unavailable`; never invent assignment facts from Baseline payload alone |
| PopulationPort fixture-default | Disclose on audit channel; fail-closed |
| `source=migration` | Audit/read-model metadata only — not a second cutover control plane |
| Export Base64-in-tRPC unbounded (6.5 defer) | Do not expand unbounded download via audit UI; reuse panel; no volume claims beyond existing |

### No self-review (FR-51)

- Product rule: no actor may approve review of their own sensitive activity
- Shipped reference: `completeBreakGlassPostUseReview` blocks subject/requester/approver (+ incident-scope related actors) + `assertToxicCombinationAllowed({ operation: "grant.break_glass.review" })` + `MSG_BREAK_GLASS_REVIEW_TOXIC_FA`
- 7.1 must either:
  1. Ship disposition/ack with the same independence gate, **or**
  2. Ship search-only and route independence completions through existing toxic APIs — **without** claiming AC #5 via a vacuous “we have no button” (document Gate + wire any review CTA through toxic check)

### AuthAttempt / AccessDenial (deferred — honesty)

From `deferred-work.md` (Story 2.1 plan): keep writing AuthAttempt on login; new governed denials go through envelope; investigation UI reads **event-store**. Historical backfill not required to ship 7.1. Do not build a dual-table investigator.

### Permission seeding (provisional)

| Key | Use | Notes |
| --- | --- | --- |
| `audit.investigate` | Search/list evidence | Code-marked; seed for `audit_reviewer` PermissionSet |
| `audit.evidence.review` | Optional disposition | Only if UI mutates review state; toxic self-review enforced |
| Existing export retrieve keys | Artifact bytes from investigation | Unchanged 6.5 contract |

Seed via `DEV_DEMO_POLICY` + identity-access seed helper (mirror `seed-export.ts`). Fail-closed for unseeded roles (hr_operator must not investigate).

### AR honesty

- AR-AUDIT still has open decisions (envelope richness, redaction, retention/hold, independent reviewer cadence) — implement **investigation substrate + fail-closed defaults**
- Forbidden: claiming full FR-51 trust program complete; inventing clock-anomaly product (7.4); inventing legal hold (7.3)

### Known gaps to document (do not silently “fix” as done)

| Gap | Handling in 7.1 |
| --- | --- |
| PopulationPort fixture-default | Honesty disclosure on audit channel |
| InferenceBulkPort process-local race (Epic 2 open) | Retain fail-closed; do not invent distributed window |
| Sticky break-glass + fingerprint UX debt | Out of scope; preserve toxic review |
| AD-6 orphans / Baseline projector | Honesty in UI/copy; non-goal to fix projectors here |
| AuthAttempt/AccessDenial backfill | Honesty note; event-store primary |
| Export Base64 size cap | Non-goal; reuse 6.5 panel |
| Hash-chain | Non-goal until AR-AUDIT freezes |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Existing monorepo | Node 22 / TS 5.x / pnpm — no new framework |
| PostgreSQL | Optional `016_…` indexes; query existing `kernel_events` |
| `pg` Pool/PoolClient | Event-store queries (AD-6) |
| tRPC `governedProcedure` | All audit search procedures |
| `@divan/event-store` | **Must** add read query APIs |
| `@divan/audit-envelope` | Authorize + audit-of-audit; InferenceBulk `"audit"` |
| `@divan/identity-access` | Seeds; toxic helpers; `reauthorizeForQueuedOrArtifactWork` for artifact opens |
| `@divan/reporting` export APIs | Artifact bytes only via existing export router |
| Selfcheck (`tsx`) | House pattern |
| UI | GovernedDataTable, operational-copy, existing Sheet/Dialog, ExportArtifactPanel |

### File structure requirements

```text
packages/db/sql/
  016_audit_investigation_indexes.sql     # OPTIONAL NEW

packages/kernel/event-store/src/
  access-event-query.ts                     # NEW read-only query
  access-event-query.selfcheck.ts           # NEW (or extend event-store.selfcheck)
  index.ts                                  # UPDATE exports
  package.json                              # UPDATE scripts if needed

packages/kernel/audit-envelope/src/
  investigation.ts                          # NEW preferred orchestration (or document Option B)
  index.ts                                  # UPDATE DEV_DEMO_POLICY seeds + exports

packages/modules/identity-access/src/
  seed-audit.ts                             # NEW optional (mirror seed-export)
  seed.ts / index.ts                        # UPDATE wire seed

apps/web/src/server/
  audit.ts                                  # NEW thin router
  root.ts                                   # UPDATE register
  audit.selfcheck.ts                        # NEW optional web smoke

apps/web/app/(app)/audit/
  page.tsx                                  # UPDATE replace placeholder

apps/web/components/audit/
  audit-investigation-panel.tsx             # NEW

apps/web/lib/
  operational-copy.ts                       # UPDATE Persian strings
```

### Testing requirements

- Domain selfcheck: deny without permission; allow with seed; query filters; append audit-of-audit; no update path; toxic self-review when disposition exists
- Web smoke: placeholder gone; empty copy key exact; Layout≠RSC access still holds
- Regression: export download reauth still green; break-glass toxic review unchanged; migration recon honesty unchanged; InferenceBulk other channels unaffected
- Interactive a11y DoD: filters named; empty state accessible; detail dialog focus restore

### Previous story intelligence (6.5 / 6.4 / Epic 6 retro)

- **6.5:** Domain-in-package + thin web; mandatory reauth ≠ UI checkbox; custody boundary copy; action/meta match; BOM-safe yaml; Absolute non-goal explicitly deferred investigation → **this story closes that deferral for the surface**
- **6.4:** `unavailable` ≠ invent zeros; free-string client tokens never unlock gates; evidence hash / server ids — same spirit for correlation filters (accept UUID format; do not trust client-invented “verified” flags)
- **Epic 6 retro:** encode migration-evidence honesty + consume-6.5 into 7.1 Dev Notes (this file); team agreement: investigation **consumes** Epic 6 evidence — no parallel SoT
- **2.5:** toxic post-use review is the independence reference implementation
- **2.1:** AuthAttempt/AccessDenial migration plan — stop sprawl; investigation reads event-store
- **4b/5:** GovernedDataTable + leave-guard data-state + operational-copy + role landing `/audit`

### Git intelligence summary

Recent commits: `d9e9eba` epic 6 retro; `b611ea4` story 6.5; `9949664` story 6.4; `ffbb9b3` 6.3; `783dca6` 6.2. Patterns to copy: reporting/migration domain packages, provisional permission seeds, dual-layer selfchecks, explicit deferrals, adversarial review Patch/Decision/Defer triage expected after implementation.

### Latest tech information

- PostgreSQL JSONB: for `scope` filters use `@>` containment (GIN-friendly) or expression B-tree on stable keys; `scope->>'k' =` bypasses default GIN — verify with `EXPLAIN` before adding indexes ([PostgreSQL JSONB / GIN guidance](https://www.sitepoint.com/postgresql-jsonb-query-performance-indexing/))
- Prefer existing `occurred_at DESC` + `correlation_id` + `event_class` indexes before adding GIN
- No new npm dependencies expected for investigation search

### Project context reference

- No `project-context.md` found in repo at create time — rely on Architecture Spine AD-3/5/6, epics.md Epic 7, UX 2026-07-19 EXPERIENCE/DESIGN, and this story file
- Communication with user: Persian; story document language: English (BMad config)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7 / Story 7.1]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-42, FR-51, FR-47, NFR-9]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-3, AD-5, capability map]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — ممیزی landing; UX-DR18/19]
- [Source: `_bmad-output/implementation-artifacts/epic-6-retro-2026-07-26.md` — honesty + consume-6.5 prep]
- [Source: `_bmad-output/implementation-artifacts/6-5-governed-export-artifact-panel.md` — reauth/custody]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — AuthAttempt/AccessDenial plan]
- [Source: `packages/kernel/event-store/src/index.ts` — append-only access API]
- [Source: `apps/web/app/(app)/audit/page.tsx` — placeholder to replace]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- `pnpm --filter @divan/event-store selfcheck:audit-query` — ok
- `pnpm --filter @divan/audit-envelope selfcheck:investigation` — ok
- `pnpm --filter @divan/web selfcheck:audit` — ok
- `pnpm --filter @divan/event-store|audit-envelope|web|identity-access typecheck` — ok
- Regression: `event-store selfcheck`, `audit-envelope selfcheck`, `web selfcheck:governed` — ok

### Completion Notes List

- Option A: domain helpers in `@divan/audit-envelope` `investigation.ts`; authorize via `governedProcedure`; InferenceBulk `"audit"` via `runGovernedRetrieval`; query SoT `@divan/event-store` `queryAuditEvidence` / `listAccessEvents`.
- Provisional `audit.investigate` + `audit.evidence.review` seeded in `DEV_DEMO_POLICY` / `DEV_DEMO_CATEGORIES` (`audit.evidence`) + `seed-audit.ts` PermissionSet bound to `audit.reviewer` (+ `org:selfcheck` membership). Soft PermissionSet gate after envelope (mirror export) so coarse nav alone cannot investigate.
- Search-only surface for AC #5: `assertAuditEvidenceSelfReviewAllowed` + `audit.assertReviewIndependence` CTA before deep-link to access/break-glass review — not a vacuous “no button”.
- Artifact open-from-detail uses existing `export.getArtifact` / `export.download` (recipient + custodyAck + reauth) — no `audit.*` byte path. Optional `016_*.sql` skipped (existing occurred_at/correlation/event_class indexes sufficient; scope uses `@>`).
- Honesty banners: migration events-only / Baseline projector / AD-6 orphans; AuthAttempt not primary SoT; PopulationPort fixture disclosure on audit responses.
- Epic 6 retro action items #2/#3 already marked done at create-story; implementation Gate holds.

### File List

- packages/kernel/event-store/src/access-event-query.ts
- packages/kernel/event-store/src/access-event-query.selfcheck.ts
- packages/kernel/event-store/src/index.ts
- packages/kernel/event-store/package.json
- packages/kernel/audit-envelope/src/investigation.ts
- packages/kernel/audit-envelope/src/investigation.selfcheck.ts
- packages/kernel/audit-envelope/src/index.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/package.json
- packages/modules/identity-access/src/seed-audit.ts
- packages/modules/identity-access/src/seed.ts
- apps/web/src/server/audit.ts
- apps/web/src/server/audit.selfcheck.ts
- apps/web/src/server/root.ts
- apps/web/app/(app)/audit/page.tsx
- apps/web/components/audit/audit-investigation-panel.tsx
- apps/web/components/governed-data-table/types.ts
- apps/web/components/governed-data-table/governed-data-table.tsx
- apps/web/lib/operational-copy.ts
- apps/web/package.json
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-1-audit-investigation-surface.md

### Change Log

- 2026-07-27: Implemented Story 7.1 audit investigation surface (kernel query + envelope domain + seeded fine permission + `/audit` UI + selfchecks).
- 2026-07-27: Code review — Decision B/A/C + patches (InferenceBulk evidence-only Gate, evidence-bound self-review, SoD artifact CTA, query/UI hardening).

## Story completion status

- **Status:** done
- **Note:** Code review complete — decisions B/A/C applied; patches landed; 3 items deferred to deferred-work.md
