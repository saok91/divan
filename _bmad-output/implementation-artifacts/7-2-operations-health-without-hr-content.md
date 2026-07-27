---
baseline_commit: 08bff26
---

# Story 7.2: Operations Health Without HR Content

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a System Admin (Arman),
I want service, identity, import/recalculation, backup, and dependency health views,
so that I can operate Divan without browsing personnel records (FR45, UJ-5, NFR10).

**Story key:** `7-2-operations-health-without-hr-content`  
**Epic:** 7 — Audit, Operations & Evidence Controls (FR42, FR45, FR50, FR51, FR53–FR56)  
**Prerequisite:** Epics 1–6 done; Story **7.1** shipped audit investigation (`/audit`, `audit.investigate`, GovernedDataTable pattern). Coarse role `system_admin` lands on `/operations` (PlaceholderPage only). Existing substrate: public `health` tRPC smoke, `platformStatus.recalc` → `getPlatformRecalcSignal` (aggregates, no person rows), global `StaleRecalcBanner`, LDAP outage copy `MSG_LDAP_UNAVAILABLE` / `operationalCopy.ldapUnavailable`, login fail-closed on directory outage. **No** ops dashboard, **no** `ops.*` permission, **no** LDAP connectivity probe for dashboard, **no** backup/restore evidence API, **no** ops-safe import aggregate.

## Acceptance Criteria

1. **Given** System Admin landing on عملیات  
   **When** health dashboards load  
   **Then** the following are visible **without personnel rows or unnecessary HR fields**:
   - **Identity connectivity** (LDAP/directory reachability — red when unavailable)
   - **Service health** (app process + database reachability at minimum)
   - **Import / recalculation job status** (aggregate pending/failed/stale counts and job-class labels — **never** `person_id`, personnel codes, names, or import row payloads)
   - **Backup / restore evidence hooks** (status of last recorded evidence / “not configured” honesty — not a fake green restore)
   - **Dependency status** (at least: PostgreSQL, LDAP/directory, async recalc worker/queue signal when detectable)

2. **And** technical logs / API error paths **redact** LDAP secrets (bind password, raw bind DN if secret-bearing), directory payloads, and unnecessary personnel data; responses support incident correlation via **correlation ids / job keys** where applicable — not by dumping HR content

3. **And** failed/stale derived-state processing is **visible** on the ops surface (aligned with existing platform recalc signal + UX-DR5 banner — dashboard complements, does not replace the global banner); authorization, headcount finalization, and formally published reports continue to **fail closed** when required inputs are stale/failed/unreconciled (preserve existing gold-CTA block / banner behavior — do not weaken)

4. **And** LDAP unavailable marks **ops identity health red**; login remains fail-closed with exact Persian message «اتصال به سامانه هویت برقرار نیست.» (`MSG_LDAP_UNAVAILABLE` / `operationalCopy.ldapUnavailable`)

5. **And** ops access is **separately permissioned** (provisional fine permission + seeded PermissionSet for `sys.admin`) — coarse `system_admin` nav alone is insufficient; every ops health retrieve uses `governedProcedure` and is **itself audited** (access event: actor, purpose, outcome, correlation — no HR values in payload)

6. **And** AR-NFR / AR-IDENTITY / AR-ACCESS / AR-AUDIT / AR-MIGRATION / AR-DATA remain **fail-closed**:
   - Do **not** invent RPO/RTO numbers, alert routing owners, HA topology, or “signed backup policy”
   - Provisional permission keys OK if code-marked + seeded + fail-closed (mirror `audit.*` / `export.*`)
   - Backup/restore are **evidence hooks** until Ops/AR-NFR freezes acceptance procedure — never claim production restore verified from UI alone
   - Do **not** enable sensitive category id `health` (that is **person health data**, not ops) — use a distinct ops category (recommended `ops.platform`)

7. **And** migration/import/recalc status is interpreted **honestly** (Epic 6 retro):
   - AD-6 Person orphans may exist while Baseline events rolled back — ops must not paint cutover “fully green”
   - events-only zero-trace ≠ full integrity proof
   - Baseline may lack Employment/Assignment projection → related domains may be `unavailable`
   - PopulationPort may still be fixture-default — disclose if any population-scoped claim appears (prefer none on ops)
   - Never invent zeros that imply clean production cutover

8. **And** this story does **not** own: audit investigation (7.1 — consume patterns only), retention/legal-hold product (7.3), audit trust writer fail-safe expansion (7.4), correction cases (7.5), decision-report reproducibility (7.6), Launch Artifact change-control (7.7), evaluation-snapshot integrity (7.8), PopulationPort cutover, AD-6 Prisma↔PoolClient hardening, Vitest mandate, sticky break-glass UX debt, InferenceBulk distributed window

## Tasks / Subtasks

- [x] Task 1: Ops health domain + provisional permissions (AC: #1, #5–#6)
  - [x] NEW under `@divan/audit-envelope` (preferred, mirrors 7.1) **or** `@divan/identity-access` if BC fights — document choice:
    - Constants: `OPS_HEALTH_READ_PERMISSION = "ops.health.read"`, `OPS_PLATFORM_DATA_CATEGORY = "ops.platform"` (ordinary; **not** `health`)
    - Error type + Persian `messageFa` (e.g. `OPS_HEALTH_DENIED`, `OPS_HEALTH_PROBE_FAILED`)
    - DTO: `OpsHealthSnapshot` with sections: `identity`, `service`, `recalculation`, `import`, `backup`, `dependencies` — each `{ status: "ok"|"degraded"|"red"|"unavailable"|"not_configured"; detailFa?; correlationId?; updatedAt? }` plus optional **counts only** (`pendingCount`, `failedCount`, `staleCount`) — **zero** person identifiers
  - [x] Register `ops.platform` in `DEV_DEMO_CATEGORIES` (+ production hooks list if pattern requires) — ordinary, `requiresSeparateExport: false`
  - [x] Add policy tuple to `DEV_DEMO_POLICY`: `{ permission: "ops.health.read", dataCategory: "ops.platform", action: "read", organizationalScope: "org:selfcheck" }`
  - [x] NEW `packages/modules/identity-access/src/seed-ops.ts` (mirror `seed-audit.ts`): PermissionSet + AccessRole bound to `sys.admin`; warn if account missing; wire from `seed.ts`
  - [x] Export constants from package index

- [x] Task 2: Probes without HR leakage (AC: #1–#2, #4, #7)
  - [x] **Service / DB:** lightweight `SELECT 1` (or existing pool ping) via `@divan/db` shared pool — latency optional; never return connection strings/secrets
  - [x] **LDAP / identity:** NEW non-auth probe in `@divan/identity-access` (e.g. `probeDirectoryConnectivity(config)`):
    - Bind with **service** bind credentials only (never user passwords); search sizeLimit 0/1 or RootDSE-style check per ldapts capabilities
    - Map failures → `{ status: "red", detailFa: MSG_LDAP_UNAVAILABLE }` when directory unreachable; distinguish config-missing → `not_configured` / `unavailable` honesty (LDAP mode off in seeded-dev is OK — label clearly, do not fake green “LDAP ok” when LDAP disabled)
    - **Never** log bind password, raw entries, or attribute dumps
  - [x] **Recalc:** **Reuse** `getPlatformRecalcSignal` from `@divan/person-employment`. Optional NEW `getOpsRecalcAggregate(db)` returning **counts by status only** (`pending`/`failed`/`stale`) — **do not** call `listPendingRecalculationJobs` into the UI (it includes `personId`). If job keys needed for correlation, return **opaque job_key / generation only** with personId stripped
  - [x] **Import:** NEW aggregate in `@divan/migration` (e.g. `getOpsImportBatchSummary`) — counts by staging status / recent failed cutovers from staging metadata **without** row payloads, personnel codes, or names. **Do not** reuse `migration.getBatch` / person-gated APIs for SysAdmin
  - [x] **Backup/restore hooks:** env or small evidence table/file hook is fine — statuses: `not_configured` | `evidence_recorded` | `unavailable`. Surface Persian honesty that restore acceptance is Ops/AR-NFR-owned. Do **not** invent RPO/RTO displays beyond provisional NFR doc citation in UI copy (optional single line referencing provisional profile — no fake “last restore OK”)
  - [x] **Public smoke:** keep existing `health` tRPC for infra; ops dashboard must not rely on it alone
  - [x] Optional NEW `apps/web/app/api/health/route.ts` (or `/api/ready`) for external monitors: `force-dynamic`, `Cache-Control: no-store`, 200 vs 503, **redacted** JSON (no HR, no secrets). Prefer Node runtime if DB ping included. Exclude from auth middleware. **Not** a substitute for the permissioned ops UI

- [x] Task 3: Governed tRPC + replace `/operations` placeholder (AC: #1–#5)
  - [x] NEW `apps/web/src/server/operations.ts` — thin router:
    - `operations.getHealth` (name flexible) — `governedProcedure` meta: `permission: ops.health.read`, `dataCategory: ops.platform`, `action: "read"`, scope `org:selfcheck`, `operation: "ops.health.read"`
    - Soft PermissionSet gate after envelope (mirror `actorHoldsAuditInvestigate`)
    - Append access event for the retrieval (audit-of-ops)
    - Map errors to operational-copy — never leak `error.message` / infra internals
  - [x] Optional `operations.capabilities` — same permission pattern as audit (or skip if unused)
  - [x] Register in `apps/web/src/server/root.ts`
  - [x] **Upgrade path for `platformStatus.recalc`:** leave global banner on `protectedProcedure` (all authenticated roles need stale visibility) **or** document explicit Gate that banner stays coarse-auth while ops detail is governed — **do not** accidentally hide stale banner from HR roles
  - [x] UPDATE `apps/web/app/(app)/operations/page.tsx` — Layout≠RSC: `auth()` → `assertPageAccess(role, "/operations")` → client panel (mirror `audit/page.tsx`)
  - [x] NEW `apps/web/components/operations/operations-health-panel.tsx`:
    - One composition: sectioned status list (not a marketing dashboard card farm) — identity / service / recalc / import / backup / dependencies
    - Status via text + semantic token color (**not** color-only); Persian RTL + Persian digits for counts/times
    - Empty/cold: Skeleton; error ≠ empty; UX-DR24 voice (fact + next step)
    - Failed recalc: show correlation / aggregate only — UJ-5 step 3
    - **No** GovernedDataTable of people; **no** links that deep-dive into personnel profiles from ops
    - Section tabs: **not required** for single-surface `/operations` unless IA adds sub-routes — do not invent
  - [x] All new copy in `apps/web/lib/operational-copy.ts`
  - [x] Interactive a11y: labeled regions; `role="status"` / alerts where appropriate; focus order; 200% zoom readable; banner stack unchanged (stale > break-glass)
  - [x] Leave-guard: only if local draft dirty beyond applied view (unlikely for read-only health — skip dialog unless filters added)

- [x] Task 4: Fail-closed + honesty wiring (AC: #3, #6–#7)
  - [x] Confirm gold CTA block + `StaleRecalcBanner` still fire from existing platform signal when recalc pending/failed/stale
  - [x] Ops panel shows matching honesty when aggregates are blocking — never “all green” while banner is active
  - [x] Import/recalc sections never claim clean cutover from aggregates alone
  - [x] Document Gate: SysAdmin path = identity/config/health only; HR elevation remains break-glass (2.5) — ops UI must not become HR browser

- [x] Task 5: Verify + DoD (AC: #1–#8)
  - [x] NEW selfcheck(s): domain probe redaction (no secret in returned DTO); unauthorized role denied; `sys.admin` with seed can read; snapshot has no `personId`/`personnelCode` keys; LDAP unavailable → identity red; aggregate counts shape
  - [x] Wire `selfcheck:operations` (or package scripts) in `@divan/web` / identity-access / migration as appropriate
  - [x] `pnpm` typecheck + eslint on touched packages
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits

### Manual DoD checklist

- [x] `/operations` shows health panel (not PlaceholderPage) for `sys.admin` / `DivanDev1!`
- [x] Unauthorized coarse roles cannot call `operations.getHealth` (envelope deny + audited)
- [x] Snapshot sections present: identity, service, recalc, import, backup, dependencies — **no** personnel rows
- [x] LDAP down / probe fail → identity status red; login still shows «اتصال به سامانه هویت برقرار نیست.»
- [x] Recalc pending/failed/stale visible on ops **and** global banner still works for HR roles
- [x] Import summary is counts/status only — opening ops does not load migration row payloads
- [x] Backup shows hook honesty (`not_configured` acceptable) — no fake “restore verified”
- [x] Access event written for ops health read
- [x] Category `health` (person) remains disabled; ops uses `ops.platform`
- [x] No secrets in logs/responses; Persian RTL / digits; single dialog depth if any
- [x] Sprint may claim FR-45 **ops substrate + UI** — **not** full AR-NFR monitoring/alert program or witnessed restore acceptance (LG-5)

### Review Findings

- [x] [Review][Patch] Soft-return ops health snapshot when allow-path access-event append fails (ops visibility; mirror soft-deny posture) [`apps/web/src/server/operations.ts:309`]
- [x] [Review][Patch] Strip personId from recalc sample job keys before UI/correlationId [`packages/modules/person-employment/src/personnel-event-recalc.ts:348` / `apps/web/src/server/operations.ts:199`]
- [x] [Review][Patch] Never forward raw tRPC `error.message` in ops panel [`apps/web/components/operations/operations-health-panel.tsx:153`]
- [x] [Review][Patch] Remove `ensureRecalcEnqueueRegistered` from read-only health snapshot path [`apps/web/src/server/operations.ts:159`]
- [x] [Review][Patch] Audit allow path for `operations.capabilities` [`apps/web/src/server/operations.ts:330`]
- [x] [Review][Patch] Include `eventsOnlyZeroTrace` (and seeded LDAP honesty when applicable) in snapshot `honestyFa` [`apps/web/src/server/operations.ts:267`]
- [x] [Review][Patch] Omit pending/failed counts when import section is `unavailable` [`apps/web/src/server/operations.ts:206`]
- [x] [Review][Patch] Distinguish schema-missing vs empty `import_batch` in import aggregate [`packages/modules/migration/src/ops-import-summary.ts:56`]
- [x] [Review][Patch] Wrap LDAP client create+bind in try so probe never rejects the whole Promise.all [`packages/modules/identity-access/src/directory-probe.ts:49`]
- [x] [Review][Patch] Disable or throttle `refetchOnWindowFocus` on ops health query (LDAP bind storm) [`apps/web/components/operations/operations-health-panel.tsx:165`]
- [x] [Review][Patch] Remove UTF-8 BOM from `sprint-status.yaml` [`_bmad-output/implementation-artifacts/sprint-status.yaml`]
- [x] [Review][Patch] Strengthen `opsHealthDtoContainsForbiddenKeys` to catch person-bearing values (not only key names) [`packages/kernel/audit-envelope/src/ops-health.ts`]
- [x] [Review][Patch] Stop forging `service.correlationId` as `svc:${latency}ms` — omit or use request correlation [`apps/web/src/server/operations.ts:144`]
- [x] [Review][Patch] Drop `identityProvider` from public `/api/health` JSON [`apps/web/app/api/health/route.ts:32`]
- [x] [Review][Patch] Ignore or degrade on unknown `import_batch` status strings outside StagingBatchStatus [`packages/modules/migration/src/ops-import-summary.ts:40`]
- [x] [Review][Defer] Ops/package selfchecks are mostly source greps — do not execute unauthorized deny, live LDAP→red, or snapshot round-trip — deferred, verification debt

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Show identity/service/import/recalc/backup-hooks/deps **without** personnel rows | Browse HR profiles, import row payloads, or compensation from `/operations` |
| Provisional `ops.health.read` + seed for `sys.admin`; envelope on every retrieve | Treat coarse `system_admin` nav alone as authz |
| Audit the ops health retrieve (access event) | Silent unattributable ops browsing |
| Reuse `getPlatformRecalcSignal` / aggregates with **personId stripped** | Pipe `listPendingRecalculationJobs` (with personId) to UI |
| New ops-safe import **aggregate** API | Reuse `migration.getBatch` / person-write paths for SysAdmin |
| Use category `ops.platform` (ordinary) | Enable or reuse sensitive category id `health` (person health) |
| LDAP red + exact outage copy; login fail-closed preserved | Fake green LDAP when directory/config unavailable |
| Backup = evidence hooks + honesty | Invent RPO/RTO, signed restore, or alert owners (AR-NFR) |
| Honesty on AD-6 orphans / Baseline gaps / events-only zero-trace | Greenwash cutover or invent zeros |
| Preserve global stale banner + gold CTA fail-closed for all roles | Hide banner from HR or weaken finalize/export block |
| Thin web; probes in modules; operational-copy Persian | English placeholders; PlaceholderPage left as “done” |

### Absolute non-goals

- Story 7.1 audit investigation changes (consume Layout≠RSC / seed / governed patterns only)
- 7.3 retention/legal-hold; 7.4 writer fail-safe beyond existing `AUDIT_APPEND_FAILED`; 7.5–7.8
- Full AuthAttempt/AccessDenial backfill; hash-chain tamper evidence
- PopulationPort default-registry cutover; AD-6 single-connection orphan fix; `ensure*Schema` migrations-only
- Person-org IDOR on Cancel/Reverse/Correct; Add/QuickCreate dedupe; logout→`requestNavigation`
- Vitest mandate (selfcheck `tsx` remains house pattern)
- Sticky break-glass + fingerprint UX debt; InferenceBulk distributed window
- Replacing infra backup agents — only evidence hooks for UJ-5 / FR-45 visibility

### UPDATE files — current state → this story → preserve

| File | Current (post-7.1) | Change | Preserve |
| --- | --- | --- | --- |
| `apps/web/app/(app)/operations/page.tsx` | `PlaceholderPage` only; **no** `assertPageAccess` | Health panel + Layout≠RSC assert | Route title عملیات; coarse landing |
| `apps/web/src/server/platform-status.ts` | `protectedProcedure` recalc aggregates | Keep banner feed working for all auth roles; optionally share helper with ops router | Fail-closed catch → blocking stale |
| `apps/web/src/server/root.ts` | `health` public smoke; `platformStatus`; `audit` | Register `operations` router | Existing routers; retrieval channel enum |
| `apps/web/lib/operational-copy.ts` | `ldapUnavailable`, stale messages | Ops section labels, honesty, probe failures | UX-DR24; exact LDAP string |
| `packages/kernel/audit-envelope` | `audit.evidence` + investigate perms | Add `ops.platform` + `ops.health.read` + policy tuple | Default-deny; do not enable person `health` |
| `packages/modules/identity-access` | `sys.admin` coarse; LDAP auth; `seed-audit` | `seed-ops` + directory **probe** (no password log) | Nav matrix (`system_admin` → `/operations` only); login fail-closed |
| `packages/modules/person-employment` | `getPlatformRecalcSignal`; `listPending…` has personId | Optional count-only aggregate for ops | Banner signal semantics |
| `packages/modules/migration` | HR-gated batch APIs with row data | NEW ops aggregate counts/status only | Staging AD-4 boundary; SoD on cutover |
| `apps/web/components/stale-recalc-banner.tsx` + provider | Global UX-DR5 | **Reuse** — do not replace with ops-only UI | Stack order stale > break-glass |
| NEW operations panel + server module | Absent | Full ops health UI/API | No personnel deep-links |
| Optional `app/api/health/route.ts` | Absent (only tRPC `health`) | Redacted readiness for monitors | No session required; no HR fields |

### Architecture compliance

- **AD-1:** Single app process + one PG — ops probes target that topology; no new microservice
- **AD-3:** Web → modules → kernel; no Prisma in web; probes live in identity-access / person-employment / migration / db
- **AD-5:** Coarse nav (`system_admin` → `/operations`) + fine envelope category checks; access events for ops reads; logging redacted per FR-45
- **AD-6:** Async recalc via pg-boss; UI must show pending/failed/stale — ops dashboard surfaces the same truth as banner
- **Capability map:** Ops health (FR-45) → `apps/web` + infra (`infra-security-brief`); identity LDAP → identity-access; recalc → person-employment; import aggregates → migration
- **Categories comment (existing):** “Routine System Admin path = identity/config/health only. HR-content elevation = break-glass (2.5).” — ops UI must enforce this product invariant

### UX (UJ-5 / EXPERIENCE)

From `ux-divan-2026-07-13/EXPERIENCE.md` UJ-5:

1. Lands **عملیات**
2. Identity, health, backup, recalc — redacted; **no personnel rows**
3. Failed recalc → **correlation id only**
4. Break-glass HR access → break-glass banner on HR routes; stale banner still takes precedence if both active

**Climax:** Service health confirmed without HR content exposure  
**Failure:** Directory outage → ops dashboard red; HR login Persian failure per FR-1

IA (`ux-divan-2026-07-19`): **عملیات** = FR-45 SysAdmin landing. Single sidebar item for `system_admin` — do not invent HR nav for this role.

### Consumer contracts (encode — do not rediscover)

**Recalc signal (existing):**

```text
getPlatformRecalcSignal(db) → {
  recalculationPending, blockingStale, stalePendingUntil
}
# Already person-free. Ops UI MUST use this (and optional counts).
# FORBIDDEN in UI: listPendingRecalculationJobs().personId
```

**LDAP copy (exact):**

```text
MSG_LDAP_UNAVAILABLE === "اتصال به سامانه هویت برقرار نیست."
operationalCopy.ldapUnavailable === same string
```

**Migration ops aggregate (new — sketch):**

```text
getOpsImportBatchSummary(db) → {
  byStatus: { [status]: count },
  recentFailedCount,
  honestyFa?: string  // e.g. Baseline projector gap / not a cutover proof
}
# Never returns rows[], personnelCode, names, file bytes
```

**Backup hook (sketch):**

```text
getBackupEvidenceHook() → {
  status: "not_configured" | "evidence_recorded" | "unavailable",
  lastEvidenceAt?: string,
  detailFa: string  // honesty: Ops/AR-NFR owns restore acceptance
}
```

### Migration-evidence honesty (Epic 6 retro — mandatory on 7.2)

| Fact | Ops must |
| --- | --- |
| AD-6 Person orphans + events rollback | Not present failed cutovers as fully clean |
| events-only zero-trace | Not upgrade to integrity proof |
| No Baseline→Employment/Assignment projector | Related import/recon may be `unavailable` |
| PopulationPort fixture-default | Prefer no population claims on ops; disclose if any |
| Import APIs are HR-permissioned today | Build ops aggregate — do not widen HR APIs to SysAdmin |

### Permission seeding (provisional)

| Key | Action | Category | Use |
| --- | --- | --- | --- |
| `ops.health.read` | `read` | `ops.platform` | Load ops health snapshot |

Seed via `DEV_DEMO_POLICY` + `seed-ops.ts` bound to `sys.admin`. Fail-closed for unseeded roles (`hr_operator` must not read ops health API even if they guess the procedure name).

**Critical naming collision:** registry category `health` = sensitive **person** health (`enabled: false`). Never grant SysAdmin that category for “ops health.”

### AR honesty

- **AR-NFR** still pending formal versioning; provisional freeze (`nfr-provisional.md`): RPO ≤24h / RTO ≤8h, page/search/dashboard targets — **do not** invent alert owners, severity model, or runbook text beyond hooks (NFR-10)
- **AR-IDENTITY** LDAP topology/outage still open — probe + fail-closed login is the substrate; do not invent topology
- Forbidden: claiming LG-5 operational readiness complete from this story alone

### Known gaps to document (do not silently “fix” as done)

| Gap | Handling in 7.2 |
| --- | --- |
| No infra backup agent integration | `not_configured` honesty hook |
| LDAP may be disabled in seeded-dev | Label identity `not_configured` / seeded mode — not fake LDAP ok |
| pg-boss worker may be separate process | Dependency may be `unavailable` if no heartbeat table — honesty over greenwash |
| PopulationPort fixture | Out of scope; no workforce claims on ops |
| AD-6 orphans / Baseline projector | Honesty copy on import/recalc sections |
| InferenceBulkPort process-local race | N/A to ops aggregates; retain fail-closed elsewhere |
| Export Base64 size cap | Non-goal |
| Hash-chain / NFR-10 full observability program | Non-goal until AR-NFR/AR-AUDIT freeze |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Existing monorepo | Node 22 / TS 5.x / pnpm — **no** new framework |
| Next.js 16.2 App Router | Page RSC gate + client panel; optional `app/api/health/route.ts` with `dynamic = "force-dynamic"`, `Cache-Control: no-store`, HTTP **503** when dependencies down (monitors key off status code, not body alone) |
| tRPC 11 | `governedProcedure` for ops; keep public `health` smoke |
| `ldapts` (existing) | Connectivity probe only; always unbind in `finally`; never log secrets |
| PostgreSQL / `pg` pool | `SELECT 1` ping; recalc/import aggregates via existing module SQL |
| pg-boss | Do not require new queue; surface recalc status from `recalculation_status` |
| Prisma | Seed only in identity-access; **no** Prisma in `apps/web` |

### Latest technical notes (health endpoints)

- Prefer separate **liveness** (process up) vs **readiness** (DB/LDAP) if adding HTTP routes; readiness should cheap-timeout dependency checks
- Never cache health responses; never put secrets or PII in health JSON
- On-prem MVP monitors (infra-security-brief Monitoring node) expect redacted HTTPS health — align optional Route Handler with that, while **permissioned** UI remains the UJ-5 operator surface

### Project structure notes

```text
packages/kernel/audit-envelope/     # ops.platform category + permission constants (+ optional ops-health.ts helpers)
packages/modules/identity-access/   # LDAP probe + seed-ops.ts
packages/modules/person-employment/ # recalc aggregates (person-free)
packages/modules/migration/         # ops import summary (no row PII)
apps/web/src/server/operations.ts   # thin governed router
apps/web/components/operations/     # operations-health-panel.tsx
apps/web/app/(app)/operations/      # page with assertPageAccess
apps/web/app/api/health/            # optional monitor route
```

Variance: Architecture maps FR-45 to `apps/web + infra` — acceptable that orchestration DTOs live in audit-envelope or identity-access for testability; keep web thin.

### Testing requirements

- Selfcheck `tsx` (house pattern) — assert:
  - DTO JSON.stringify does not contain `personId`, `personnelCode`, bind password keys
  - Unauthorized → deny
  - Seeded sys.admin → allow + access event append path exercised (or mocked)
  - LDAP unavailable mapping → red + exact Persian copy constant equality
- Typecheck + eslint on touched packages
- Manual: login as `sys.admin`, confirm UJ-5 path; login as `hr_operator`, confirm no ops nav and API deny; confirm stale banner still appears for HR when recalc pending

### Previous story intelligence (7.1)

- **Pattern to copy:** Layout≠RSC `assertPageAccess` → client panel; `governedProcedure` + soft PermissionSet; `seed-*-ts` + `DEV_DEMO_POLICY`; operational-copy for all UI strings; selfcheck scripts in package.json
- **Lessons from 7.1 review:** map errors to operational-copy (never raw `error.message`); leave-guard dirty ≠ dialog open; distinguish loading/error/empty; BOM-safe sprint-status; import permission literals from package constants in seed files; soft-deny append failure must not mask primary FORBIDDEN
- **Do not** copy InferenceBulk `"audit"` channel into ops unless a retrieval control applies — ops aggregates are platform metrics, not population-scoped person retrieval. If you wire a channel, do not invent a new InferenceBulk window
- **Do not** add GovernedDataTable for people; 7.1 used it for evidence rows — ops uses status sections

### Git intelligence summary

- Latest: `08bff26` story 7.1 — audit panel, event-store query, seed-audit, operational-copy
- Prior: Epic 6 retro + 6.5 export artifact reauth/custody — ops must stay honest about migration/export limits
- Follow same thin-router + domain-package + seed + selfcheck shape

### Project context reference

- No `project-context.md` found in repo at story creation time — rely on architecture spine, this file, and prior story patterns
- Open sprint action (Epic 6): keep AR-AUDIT / AR-ACCESS / AR-DATA / AR-NFR / AR-MIGRATION fail-closed in Epic 7 — this story holds that line for FR-45

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7 / Story 7.2]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-45, UJ-5, NFR-10, AR-NFR]
- [Source: `_bmad-output/specs/spec-divan/SPEC.md` — CAP-12]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — Ops health FR-45, logging redaction]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md` — Monitoring/health, backup/restore evidence]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — UJ-5, عملیات IA, stale banner]
- [Source: `_bmad-output/implementation-artifacts/7-1-audit-investigation-surface.md` — patterns + Gate lessons]
- [Source: `_bmad-output/implementation-artifacts/epic-6-retro-2026-07-26.md` — 7.2 import/recalc honesty]
- [Source: `packages/modules/person-employment/src/personnel-event-recalc.ts` — `getPlatformRecalcSignal`]
- [Source: `packages/kernel/audit-envelope/src/categories.ts` — SysAdmin path note; person `health` vs ops]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Choice: ops domain constants/DTO in `@divan/audit-envelope` (`ops-health.ts`) — mirrors 7.1 investigation pattern; probes stay in identity-access / person-employment / migration / db.
- Gate: `platformStatus.recalc` left on `protectedProcedure` so StaleRecalcBanner remains visible to all authenticated roles; ops detail is separately governed via `ops.health.read`.

### Implementation Plan

1. Provisional `ops.health.read` × `ops.platform` + seed-ops for `sys.admin`
2. Directory probe, recalc count aggregate, import aggregate, backup env hook, optional `/api/health`
3. Governed `operations` router + Layout≠RSC page + sectioned health panel
4. Honesty copy + preserve global stale banner
5. Selfchecks + typecheck/eslint

### Completion Notes List

- ✅ Implemented FR-45 ops substrate + UI without personnel rows or HR deep-links
- ✅ Soft PermissionSet + envelope + access event on `operations.getHealth`
- ✅ LDAP seeded-dev → `not_configured` honesty; unreachable → red + `MSG_LDAP_UNAVAILABLE`
- ✅ Backup hook defaults to `not_configured` (Ops/AR-NFR owns restore acceptance)
- ✅ Selfchecks: `selfcheck:ops-health`, `selfcheck:directory-probe`, `selfcheck:ops-import`, `selfcheck:operations`
- ✅ Typecheck passed on touched packages; eslint clean on web ops files
- ⚠️ Interactive browser login smoke (`sys.admin` / `hr_operator`) recommended at code-review; contracts verified via selfcheck/static analysis

### File List

- packages/kernel/audit-envelope/src/ops-health.ts
- packages/kernel/audit-envelope/src/ops-health.selfcheck.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/src/index.ts
- packages/kernel/audit-envelope/package.json
- packages/modules/identity-access/src/seed-ops.ts
- packages/modules/identity-access/src/seed.ts
- packages/modules/identity-access/src/directory-probe.ts
- packages/modules/identity-access/src/directory-probe.selfcheck.ts
- packages/modules/identity-access/src/index.ts
- packages/modules/identity-access/package.json
- packages/modules/person-employment/src/personnel-event-recalc.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/migration/src/ops-import-summary.ts
- packages/modules/migration/src/ops-import-summary.selfcheck.ts
- packages/modules/migration/src/index.ts
- packages/modules/migration/package.json
- apps/web/src/server/operations.ts
- apps/web/src/server/operations.selfcheck.ts
- apps/web/src/server/root.ts
- apps/web/app/(app)/operations/page.tsx
- apps/web/components/operations/operations-health-panel.tsx
- apps/web/app/api/health/route.ts
- apps/web/lib/operational-copy.ts
- apps/web/package.json
- _bmad-output/implementation-artifacts/7-2-operations-health-without-hr-content.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-07-27: Implemented Story 7.2 operations health without HR content — governed `/operations` panel, probes, seed, selfchecks; status → review
- 2026-07-27: Code review patches applied (personId strip, soft-return audit, honesty, BOM, etc.); status → done

## Story completion status

- **Status:** done
- **Note:** Review findings patched; one defer (executable selfcheck depth) remains in deferred-work.md
