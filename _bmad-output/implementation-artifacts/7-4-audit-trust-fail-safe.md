---
baseline_commit: 4754116
---

# Story 7.4: Audit Trust Fail-Safe

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a Security owner,
I want required-audit failure to prevent or safely suspend sensitive operations,
so that unaudited sensitive activity cannot proceed (FR51, NFR9).

**Story key:** `7-4-audit-trust-fail-safe`  
**Epic:** 7 — Audit, Operations & Evidence Controls (FR42, FR45, FR50, FR51, FR53–FR56)  
**Prerequisite:** Epics 1–6 done; Stories **7.1** (investigation), **7.2** (ops health), **7.3** (retention/hold) done. Existing substrate: envelope `authorizeOrThrow` atomic access-event append → `AuthorizationError("AUDIT_APPEND_FAILED")` on insert failure; append-only trigger `kernel_events_forbid_mutation`; inference-bulk `recordInferenceBulkAccessEvent` same fail-closed; secondary soft-deny on 7.1–7.3 allow-path append (intentional — must not mask primary FORBIDDEN). **No** writer-suspend / circuit-breaker, **no** clock-anomaly product, **no** integrity-verification run product, **no** gap→alert→assign queue, **no** unified FR-51 baseline inventory selfcheck, **no** distinct operator copy for audit-append failure (often collapses to «دسترسی ندارید.»).

## Acceptance Criteria

1. **Given** a governed sensitive operation that requires audit capture (envelope `sensitive !== false` / required-access-event path)  
   **When** the required audit write fails  
   **Then** the operation is **prevented** (existing `AUDIT_APPEND_FAILED` fail-closed preserved) **and** the system may enter a **safe suspend** state for subsequent required-audit writers until an authorized trust review clears or expires the suspend under provisional policy — unaudited sensitive activity MUST NOT proceed while suspended

2. **Given** clock anomaly detection (provisional thresholds; fail-closed when AR-AUDIT/AR-NFR unset)  
   **When** anomaly is detected (e.g. registration clock skew vs wall/NTP bound, non-monotonic `occurred_at` beyond tolerance, or server/DB clock delta exceeding provisional max)  
   **Then** required sensitive operations are **prevented or safely suspended**; the anomaly is recorded as attributable trust evidence (actor/system, time, scope, outcome, correlation) — **do not invent** signed NTP SLA numbers

3. **Given** integrity verification (MVP substrate — **not** full hash-chain unless AR-AUDIT freezes it)  
   **When** verification fails (append-only trigger missing/disabled, forbidden mutation attempted/detected, sequence/gap anomaly in verification window, or provisional content-seal mismatch if implemented)  
   **Then** required sensitive operations are prevented or safely suspended; failure is attributable and reconcilable

4. **And** gaps / interrupted capture / integrity failures / clock anomalies are **detected, alerted, and assigned for review**:
   - durable trust-incident / gap records (status open|assigned|acknowledged|closed)
   - alert surface visible to ops and/or audit without HR content (reuse 7.2 redaction rules)
   - assign-for-review requires separately permissioned actor; **no self-review** of own sensitive activity (reuse 7.1 toxic / independence pattern)
   - closure is attributable; cannot silently auto-clear suspend without review when policy requires review

5. **And** minimum audit baseline **inventory + selfcheck coverage** exists for (successful **and** denied where applicable):
   - probes of highly sensitive categories
   - reveal / unmask
   - bulk retrieval
   - historical access
   - audit access (investigation)
   - privileged reads
   - entitlement changes
   - break-glass  
   Each baseline path asserts evidence carries **actor**, **purpose/context**, **scope**, **volume**, **outcome**, and **no unnecessary value duplication** (FR-51). Prefer extending existing envelope / inference-bulk / break-glass / access-admin / audit selfchecks into one inventory harness — **do not** invent a parallel audit store.

6. **And** AR-AUDIT / AR-ACCESS / AR-DATA / AR-NFR remain **fail-closed**:
   - Do **not** invent frozen hash-chain mandate, signed retention for trust incidents, or production NTP acceptance claims
   - Provisional thresholds / suspend TTL / skew bounds OK if code-marked `@provisional-pending-AR-AUDIT-freeze` + fail-closed when unset/misconfigured
   - Architecture Spine still lists hash-chain as **Deferred** until AR-AUDIT/AR-NFR mandates — MVP integrity = trigger + gap/seal checks + verification runs; optional lightweight seal OK; **do not** claim cryptographic tamper-evidence complete

7. **And** required vs secondary audit posture is **normative** (do not blur):
   | Path | On append failure | On trust suspend |
   | --- | --- | --- |
   | Required capture (envelope `authorizeOrThrow`, inference-bulk required evidence, other AD-5 sensitive decisions) | Fail-closed (`AUDIT_APPEND_FAILED` / trust codes) | Block sensitive allow |
   | Secondary audit-of-audit (7.1/7.2/7.3 allow-path evidence after primary allow) | Soft-deny / soft-return — never mask primary FORBIDDEN | Prefer fail-closed or explicit trust-degraded deny for **new** sensitive work; read-only investigation of gaps MAY continue if separately permitted |
   | API mapping | `AUDIT_APPEND_FAILED` / trust suspend ≠ ordinary «دسترسی ندارید.» — distinct Persian copy + non-FORBIDDEN tRPC mapping where already correct (`retrieval-control` uses `INTERNAL_SERVER_ERROR`); align `governedProcedure` so append/trust failure is not silent FORBIDDEN |

8. **And** this story does **not** own: investigation UX redesign (7.1 — extend only for gap review/assign if needed), ops probe expansion beyond trust section (7.2), retention/hold product changes (7.3), correction-case product (7.5), decision-report reproducibility (7.6), Launch Artifact change-control (7.7), evaluation-snapshot integrity (7.8), PopulationPort cutover, AD-6 Prisma↔PoolClient hardening, Vitest mandate, sticky break-glass UX debt, InferenceBulk distributed window, inventing full hash-chain production program

## Tasks / Subtasks

- [x] Task 1: Trust domain constants + errors + provisional policy (AC: #1–#4, #6–#7)
  - [x] NEW under `@divan/audit-envelope` `audit-trust.ts` (mirror `investigation.ts` / `ops-health.ts` / `data-lifecycle.ts`):
    - Permissions (provisional): `audit.trust.read`, `audit.trust.review` (assign/ack/close), optional `audit.trust.suspend.clear` if split from review
    - Category: `audit.trust` (ordinary; **not** person `health`; **not** colliding with `ops.platform` / `data.lifecycle` / `audit.evidence`)
    - Error codes + Persian `messageFa`: e.g. `AUDIT_TRUST_SUSPENDED`, `AUDIT_CLOCK_ANOMALY`, `AUDIT_INTEGRITY_FAILED`, `AUDIT_TRUST_DENIED`, `AUDIT_TRUST_SELF_REVIEW_BLOCKED`, `AUDIT_TRUST_METADATA_INCOMPLETE`
    - Distinct operator-facing copy for required-audit failure / suspend (not `MSG_ACCESS_DENIED_FA` alone) — keep user-safe; no infra leak
    - DTOs: `AuditTrustState` (`ok` | `degraded` | `suspended`), `AuditTrustIncident`, `IntegrityVerificationRun`, `ClockAnomalyObservation`, `BaselineCoverageRow`
    - Provisional config: max clock skew ms, suspend TTL, verification window — `@provisional-pending-AR-AUDIT-freeze`; fail closed if required knobs missing when feature flag/env expects enforcement
  - [x] Register `audit.trust` in `DEV_DEMO_CATEGORIES` + policy tuples in `DEV_DEMO_POLICY` for read/review × `org:selfcheck`
  - [x] NEW `packages/modules/identity-access/src/seed-audit-trust.ts` (mirror `seed-audit` / `seed-ops` / `seed-retention`): PermissionSet bound to **`audit_reviewer`** (and optionally `system_admin` for ops visibility read-only) — SoD: do **not** auto-grant trust.review to ordinary `hr.admin` / `hr.operator`
  - [x] Export from package index; extend `AuthorizationErrorCode` **or** dedicated `AuditTrustError` (prefer dedicated domain error + map at API; keep `AUDIT_APPEND_FAILED` on AuthorizationError)

- [x] Task 2: Persistence — trust state, incidents, verification runs (AC: #1–#4)
  - [x] NEW `packages/db/sql/017_audit_trust.sql` (next free after `016_data_lifecycle.sql`):
    - `audit_trust.writer_state` (singleton or env-scoped): status, reason, suspended_at, suspended_by, clear_requires_review, correlation_id, …
    - `audit_trust.incident` (id, kind: append_fail|clock_anomaly|integrity_fail|capture_gap|interrupted, status open|assigned|acknowledged|closed, assigned_to?, detected_at, detail jsonb minimized, correlation_id, …)
    - `audit_trust.integrity_verification_run` (id, started_at, completed_at, outcome pass|fail, window, findings jsonb, actor, correlation_id)
    - Indexes for open incidents; **no** DELETE of incident history (close = status + attributable event)
  - [x] Repo helpers via `pg` Pool/PoolClient — preferred home: NEW under `packages/kernel/audit-envelope` or thin module next to event-store; **web stays thin**. Document choice in Completion Notes.
  - [x] Migrations-only (do not expand `ensure*Schema` sprawl)

- [x] Task 3: Envelope / required-writer fail-safe gate (AC: #1, #3, #7)
  - [x] UPDATE `packages/kernel/audit-envelope/src/index.ts` `authorizeOrThrow`:
    - **Before** allow path: if writer_state suspended → throw trust suspend (prevent sensitive operation)
    - On required `appendAccessEvent` failure: keep `AUDIT_APPEND_FAILED`; **also** record incident + transition toward suspend per provisional policy (at minimum: consecutive/any required append fail opens incident; document whether first failure auto-suspends or requires N failures — fail-closed default: **suspend on required append failure**)
    - Do **not** break non-sensitive / already-allowed secondary soft-deny contracts in web routers
  - [x] UPDATE `inference-bulk.ts` required evidence path to honor suspend gate + incident recording (same fail-closed)
  - [x] Align API mapping:
    - UPDATE `apps/web/src/server/trpc.ts` `governedProcedure` so `AUDIT_APPEND_FAILED` / trust suspend codes are **not** indistinguishable from ordinary FORBIDDEN (mirror `retrieval-control` INTERNAL mapping + distinct `messageFa`)
  - [x] Preserve append-only: never UPDATE/DELETE `kernel_events` to “fix” integrity

- [x] Task 4: Clock anomaly + integrity verification substrate (AC: #2–#3, #6)
  - [x] Clock anomaly detector (pure + DB):
    - Compare app `Date` vs `SELECT now()` delta; compare new append `occurred_at` vs previous recent access events for non-monotonic jumps beyond provisional tolerance
    - On anomaly: open incident, set suspend (or prevent current op), attributable evidence
  - [x] Integrity verification runner:
    - Assert `kernel_events_forbid_mutation` trigger still present/enabled
    - Optional: attempt controlled UPDATE in a rolled-back subtransaction / selfcheck-only path to prove trigger fires (production runner must not leave mutations)
    - Gap detection: missing expected correlation continuity for known required operations in a window is **heuristic** — label honesty; do not claim perfect capture proof
    - **Hash-chain:** out of scope unless already frozen — if adding optional `content_seal` column, mark provisional and do not claim NFR-10 complete
  - [x] Persist `integrity_verification_run`; fail → suspend + incident

- [x] Task 5: Alert + assign-for-review surfaces (AC: #4, #7)
  - [x] NEW thin tRPC `apps/web/src/server/audit-trust.ts` (or extend `audit.ts` / `operations.ts` — prefer dedicated router to keep SoD clear):
    - `auditTrust.getState` / `listIncidents` / `assignIncident` / `acknowledgeIncident` / `closeIncident` / `runIntegrityCheck` (names flexible)
    - `governedProcedure` + soft PermissionSet gate; map errors via operational-copy
    - Assign/close: toxic self-review guard when incident subject/actor == reviewer for sensitive kinds
  - [x] Register in `root.ts`
  - [x] UI (pick **one** primary + optional secondary; document):
    - **Preferred:** extend `operations-health-panel` with **Audit trust** section (status, open incident count, last verification) — zero HR rows; link “assign/review” deep-link to audit surface
    - **And/or** extend `audit-investigation-panel` with Incidents tab/section for assign/ack/close
    - Do **not** invent a third top-level IA route unless unavoidable
  - [x] Layout≠RSC preserved on host pages; Persian RTL + digits; Skeleton; error ≠ empty; single dialog depth
  - [x] Alert: surface red/degraded on ops trust section; optional honesty banner on audit page when suspended

- [x] Task 6: FR-51 minimum baseline inventory harness (AC: #5)
  - [x] NEW `audit-trust-baseline.selfcheck.ts` (envelope and/or web) that **inventories** and asserts coverage hooks exist for the eight baseline families listed in AC #5 — call/extend existing selfchecks where possible; add missing deny+allow evidence assertions only where gaps are real
  - [x] Assert payloads omit unnecessary HR values (reuse investigation / inference-bulk minimization patterns)
  - [x] Wire `selfcheck:audit-trust` scripts on touched packages

- [x] Task 7: Verify + DoD (AC: #1–#8)
  - [x] Selfchecks: append fail → prevent + incident; suspend blocks subsequent sensitive authorize; clock anomaly path; integrity fail path; assign/ack with permission; self-review blocked; unauthorized deny; ops DTO redaction; append-only trigger still rejects UPDATE/DELETE; baseline inventory lists all eight families
  - [x] `pnpm` typecheck + eslint on touched packages
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits

### Manual DoD checklist

- [x] Required audit append failure prevents the sensitive operation (not soft-allow)
- [x] After suspend, further sensitive `authorizeOrThrow` calls fail closed with distinct Persian trust/suspend copy (not ordinary access-denied conflation)
- [x] Clock anomaly (forced in selfcheck) opens incident and prevents/suspends
- [x] Integrity verification failure opens incident and prevents/suspends
- [x] Open incidents visible to permitted ops/audit actors without HR content
- [x] Assign / acknowledge / close attributable; self-review blocked where applicable
- [x] Secondary 7.1–7.3 soft-deny posture preserved for true secondary appends; primary required path never soft-allows
- [x] `governedProcedure` mapping no longer hides `AUDIT_APPEND_FAILED` as plain FORBIDDEN
- [x] Baseline inventory selfcheck covers eight FR-51 families
- [x] Hash-chain / AR-AUDIT freeze **not** falsely claimed complete
- [x] No secrets / raw infra in UI; Persian RTL / digits
- [x] Sprint may claim FR-51 **fail-safe substrate** — **not** full AR-AUDIT production evidence / LG-2 complete

### Review Findings

- [x] [Review][Decision] Writer `degraded` semantics — Resolved: MVP keeps `writer_state` as ok|suspended only; ops `degraded` derived from `openIncidentCount`. Schema `degraded` reserved for AR freeze. — deferred wiring of DB degraded writes
- [x] [Review][Decision] Assign/review UI surface — Resolved: ops deep-link to `/audit?trust=review` for assign/review surface (API remains source of mutations).
- [x] [Review][Decision] `suspendTtlMs` policy — Resolved: alert-only (`suspendExpiresAt` / `suspendTtlElapsed`); no auto-clear; clear still requires closed incidents + review permission.
- [x] [Review][Patch] Non-monotonic clock check uses DESC order as previous/next [`packages/kernel/audit-envelope/src/audit-trust-gate.ts`]
- [x] [Review][Patch] `recordRequiredAppendFailure` swallows open/suspend errors → subsequent writers fail-open [`packages/kernel/audit-envelope/src/audit-trust-gate.ts`]
- [x] [Review][Patch] `clearSuspend` ignores `clearRequiresReview` and open incidents [`packages/kernel/audit-envelope/src/audit-trust-repo.ts`]
- [x] [Review][Patch] `clock_anomaly` excluded from SoD self-review block [`packages/kernel/audit-envelope/src/audit-trust.ts`]
- [x] [Review][Patch] Integrity verification passes without failing on gap/sequence anomalies [`packages/kernel/audit-envelope/src/audit-trust-gate.ts`]
- [x] [Review][Patch] openTrustIncident + setWriterSuspended not transactional on clock/integrity/append paths [`packages/kernel/audit-envelope/src/audit-trust-gate.ts`]
- [x] [Review][Patch] Trust gate unexpected DB errors map to `AUDIT_APPEND_FAILED` without incident/suspend [`packages/kernel/audit-envelope/src/index.ts`]
- [x] [Review][Patch] FR-51 baseline inventory marks families covered without invoking path asserts; volume/deny gaps [`packages/kernel/audit-envelope/src/audit-trust-baseline.selfcheck.ts`]
- [x] [Review][Patch] Selfcheck lacks E2E assert: suspended → `authorizeOrThrow` blocks sensitive allow [`packages/kernel/audit-envelope/src/audit-trust.selfcheck.ts`]
- [x] [Review][Patch] `isNonMonotonicOccurredAt` ignores Invalid Date inputs [`packages/kernel/audit-envelope/src/audit-trust.ts`]
- [x] [Review][Patch] BOM left on `sprint-status.yaml` (EF BB BF) [`_bmad-output/implementation-artifacts/sprint-status.yaml`]
- [x] [Review][Defer] Nested/exotic keys in `incident.detail` JSONB bypass top-level forbidden-key regex [`apps/web/src/server/audit-trust.ts`] — deferred, pre-existing pattern / follow-up redaction depth
- [x] [Review][Defer] Concurrent append-fail/clock paths can open duplicate incidents per correlation [`packages/kernel/audit-envelope/src/audit-trust-repo.ts`] — deferred, pre-existing aggregation not in MVP
- [x] [Review][Defer] `capabilities` returns entitlement shape without access-event [`apps/web/src/server/audit-trust.ts:522`] — deferred, pre-existing capability-probe pattern
- [x] [Review][Defer] Writer `degraded` DB writes — deferred until AR-AUDIT freeze; ops derives degraded from openIncidentCount

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Prevent or safely suspend on required-audit failure / clock anomaly / integrity fail | Soft-allow sensitive ops when capture broken |
| Detect + alert + assign gaps/incidents for review | Silent drop of trust failures |
| Distinct operator copy + API mapping for append/trust failure | Collapse everything to «دسترسی ندارید.» |
| Preserve AD-5 atomic required access events; extend suspend gate | Parallel audit SoT or Prisma AuthAttempt as trust oracle |
| Provisional thresholds code-marked; fail-closed | Invent AR-AUDIT signed NTP/hash-chain production claims |
| SoD: trust.review not auto-granted to HR ops | Coarse nav alone as authz |
| Thin web; domain in kernel/modules; operational-copy | English placeholders; PlaceholderPage as “done” |
| Keep 7.1–7.3 secondary soft-deny for secondary appends | Break investigation/ops/retention by forcing secondary append hard-fail that masks primary deny |

### Absolute non-goals

- Full cryptographic hash-chain production program (Architecture Deferred until AR-AUDIT/AR-NFR)
- Rewriting 7.1 investigation search UX / 7.2 probe set / 7.3 hold-dispose logic except trust surfaces + mapping fixes
- 7.5 correction cases; 7.6 publications; 7.7 Launch Artifact register UI; 7.8 evaluation snapshots
- PopulationPort cutover; AD-6 Prisma↔PoolClient orphan fix; `ensure*Schema` migrations-only program
- Person-org IDOR on Cancel/Reverse/Correct; Add/QuickCreate dedupe; logout→`requestNavigation`
- Vitest mandate (selfcheck `tsx` remains house pattern)
- Sticky break-glass + fingerprint UX debt; InferenceBulk distributed window
- Claiming LG-2 / full FR-51 production acceptance complete

### UPDATE files — current state → this story → preserve

| File | Current (post-7.3) | Change | Preserve |
| --- | --- | --- | --- |
| `packages/kernel/audit-envelope/src/index.ts` | Atomic append; `AUDIT_APPEND_FAILED` on catch; **no** suspend gate | Pre-check writer_state; on fail open incident + suspend | Default-deny; evaluation time; non-sensitive short-circuit |
| `inference-bulk.ts` | Required append fail-closed | Honor suspend + incident | Volume/outcome minimization |
| `authorization-error.ts` | `FORBIDDEN` \| `AUDIT_APPEND_FAILED` | Keep; add trust error type alongside | `MSG_ACCESS_DENIED_FA` for true authz deny |
| `apps/web/src/server/trpc.ts` | All `AuthorizationError` → FORBIDDEN | Map append/trust failure distinctly | Coarse session checks |
| `retrieval-control.ts` | Already INTERNAL for append fail | Keep aligned with new trust codes | Population intersect |
| `apps/web/src/server/operations.ts` + ops panel | Health sections without audit trust | Surface trust status / incident counts | Zero HR keys; LDAP/copy honesty |
| `apps/web/src/server/audit.ts` + investigation panel | Search/retrieve; soft-deny secondary | Optional incidents UI / deep-link target | Soft-deny secondary; toxic self-review |
| `packages/db/sql/003_…` trigger | Append-only forbid mutation | **Consume** in integrity runner — do not weaken | Trigger semantics |
| NEW `017_audit_trust.sql` + domain | Absent | State + incidents + verification runs | Append-only `kernel_events` untouched |
| `seed-audit.ts` / identity-access | Investigation perms | NEW `seed-audit-trust` | Existing audit.investigate SoD |
| `operational-copy.ts` | audit/ops/retention strings | Trust suspend / anomaly / integrity / assign copy | UX-DR24; exact LDAP/custody strings |

### Architecture compliance

- **AD-1:** Single process + one PG — trust tables in same DB
- **AD-2:** Trust state is control-plane, not a substitute for business event SoT
- **AD-3:** Web → modules/kernel; no Prisma for `kernel_events`; trust repo uses `pg`
- **AD-5:** Identity-access coarse + envelope fine; required access events atomic; FR-51 trust boundary lives in audit-envelope
- **AD-6:** Raw SQL migrations for trust schema; keep event-store triggers intact
- **Capability map:** FR-51 / NFR-9 → audit-envelope + event-store; ops alert hooks → 7.2 surface; investigation assign → 7.1 patterns
- **Deferred hash-chain:** Spine + infra brief — implement only if AR-AUDIT mandates; otherwise verification substrate without claiming tamper-evidence complete

### Required vs secondary audit (normative algorithm)

```text
on sensitive authorizeOrThrow(input):
  if writer_state == suspended → throw AUDIT_TRUST_SUSPENDED (prevent)
  optionally run cheap clock skew probe → anomaly → incident + suspend/prevent
  begin txn:
    appendAccessEvent(...)  # required
  on append failure:
    open incident(kind=append_fail)
    set writer_state=suspended
    throw AUDIT_APPEND_FAILED
  return allow

on secondary allow-path append (audit/ops/retention evidence after primary allow):
  try appendAccessEvent
  catch → soft-deny / soft-return  # NEVER rewrite primary outcome to FORBIDDEN
  # if writer_state suspended: new sensitive primary work already blocked above

on integrity_verification_run fail | clock_anomaly:
  open incident; set suspended; alert ops/audit surfaces
```

### Entitlement fail-safe analogy (reuse spirit, not code fork)

Identity-access `applyExpiryFailSafe` / `applyProtectedEntryFailSafes` suspend grants that cannot remain active indefinitely. Audit trust suspend is the **capture-path** analogue: sensitive operations cannot remain allowable indefinitely when evidence capture is broken. Do **not** overload entitlement tables for audit writer state — separate `audit_trust.writer_state`.

### Permission seeding (provisional)

| Key | Use | Seed bind |
| --- | --- | --- |
| `audit.trust.read` | View trust state / incidents / verification runs | `audit_reviewer` (+ optional `system_admin` read) |
| `audit.trust.review` | Assign / acknowledge / close / clear suspend when policy allows | `audit_reviewer` |
| Existing `audit.investigate` | Evidence search | Unchanged 7.1 |
| Existing `ops.health.read` | Ops panel including trust status summary | Unchanged 7.2 — may show summary without trust.review |

Mark `@provisional-pending-AR-ACCESS-freeze` / `@provisional-pending-AR-AUDIT-freeze`.

### Migration-evidence honesty (still mandatory)

| Fact | Trust must |
| --- | --- |
| AD-6 Person orphans / events-only zero-trace / Baseline projector gap | Not present integrity_verification `pass` as cutover proof |
| PopulationPort fixture-default | Disclose if population-scoped baseline claims appear |
| Soft-deny secondary gaps | Do not upgrade “secondary append soft-failed” into false integrity pass |
| Hash-chain deferred | Verification pass ≠ cryptographic seal complete |

### UX notes

- No dedicated “audit trust” journey in ux-divan-2026-07-19 — prefer ops health section + audit incidents extension
- Suspend banner: fact + next step (contact Security / open incidents) — UX-DR24
- Empty incidents: Persian empty copy; do not show personnel rows
- Destructive clear-suspend: confirm dialog; single depth

### AR honesty

- AR-AUDIT open: mandatory envelope, fail-safe behavior, integrity/clock anomaly, review cadence, alerts — implement **substrate + fail-closed defaults**
- Forbidden: claiming LG-2 complete; inventing signed NTP; claiming hash-chain production; inventing 7.5–7.8 products

### Known gaps to document (do not silently “fix” as done)

| Gap | Handling in 7.4 |
| --- | --- |
| AR-AUDIT not frozen | Provisional thresholds + fail-closed |
| Hash-chain deferred in spine | Trigger + verification runs + optional seal only |
| Perfect capture-gap oracle impossible | Heuristic gaps + honesty labels |
| External SIEM / paging | In-product alert surfaces only; no invent PagerDuty |
| Distributed clock across multi-node | MVP single process (AD-1); document multi-node as future |
| Secondary soft-deny residual risk | Document; primary path hardened |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Existing monorepo | Node 22 / TS 5.x / pnpm — no new framework |
| PostgreSQL | NEW `017_audit_trust.sql`; keep `001`–`016` |
| `pg` Pool/PoolClient | Trust repo + event append |
| tRPC `governedProcedure` | All trust procedures; fix append-fail mapping |
| `@divan/audit-envelope` | Domain home for trust constants/gate |
| `@divan/event-store` | Append/query; trigger verification; **no** row deletes |
| `@divan/identity-access` | `seed-audit-trust.ts` |
| Selfcheck (`tsx`) | House pattern + baseline inventory |
| UI | Ops panel section and/or audit incidents; operational-copy; Dialog confirm |

### File structure requirements

```text
packages/db/sql/
  017_audit_trust.sql                         # NEW

packages/kernel/audit-envelope/src/
  audit-trust.ts                              # NEW constants/DTO/errors/gate helpers
  audit-trust.selfcheck.ts                    # NEW
  audit-trust-baseline.selfcheck.ts           # NEW inventory harness (or colocated)
  index.ts / inference-bulk.ts                # UPDATE suspend gate
  authorization-error.ts                      # UPDATE if extending codes
  categories.ts                               # UPDATE registry + policy

packages/modules/identity-access/src/
  seed-audit-trust.ts                         # NEW
  seed.ts / index.ts                          # UPDATE wire

apps/web/src/server/
  audit-trust.ts                              # NEW thin router (or documented extension)
  audit-trust.selfcheck.ts                    # NEW
  trpc.ts                                     # UPDATE error mapping
  operations.ts / audit.ts                    # UPDATE surfaces as chosen
  root.ts                                     # UPDATE register

apps/web/components/operations/…              # UPDATE trust section (preferred)
apps/web/components/audit/…                   # UPDATE incidents if chosen
apps/web/lib/operational-copy.ts              # UPDATE
```

### Testing requirements

- Domain: append fail → prevent + suspend + incident; suspend blocks authorize; clear requires review permission; clock/integrity paths; self-review blocked
- Event-store regression: append-only trigger still rejects UPDATE/DELETE
- Web: mapping distinguishes trust/append failure from FORBIDDEN; ops trust section redacts HR; router registered
- Baseline inventory: eight families listed/asserted
- Regression: 7.1 search; 7.2 health; 7.3 hold/dispose; 6.5 export reauth/custody; login LDAP outage copy

### Previous story intelligence (7.3 / 7.2 / 7.1)

- **7.3:** Domain constants in audit-envelope; SQL migrations-only `016_*`; soft-deny on allow-path append; category collision lesson (`data.lifecycle` ≠ `health`); Gate tables; Absolute non-goals; adversarial Patch/Decision/Defer expected; BOM-safe yaml; never forward raw `error.message`
- **7.2:** Ops DTO forbidden keys; honesty banners; probes throttled; trust section should reuse redaction helpers
- **7.1:** Toxic self-review; soft PermissionSet gate; migration-evidence honesty; Layout≠RSC; consume-6.5 artifact contract unchanged
- **Epic 6 retro carry-ins still open (non-goals here):** AD-6 Prisma↔PoolClient; Baseline projector; person-org IDOR on lifecycle writes; PopulationPort cutover; InferenceBulk ops doc; sticky break-glass
- **Epic 6 action:** Keep AR-AUDIT fail-closed — this story implements substrate without inventing freeze

### Git intelligence summary

Recent commits: `4754116` story 7.3; `f29e3c7` story 7.2; `08bff26` story 7.1; `d9e9eba` epic 6 retro; `b611ea4` story 6.5. Patterns to copy: provisional permission seeds, dual-layer selfchecks, Gate + Absolute non-goals, dedicated `017_*.sql`, soft-deny secondary vs fail-closed primary, review Patch triage after implement.

### Latest tech information

- Industry pattern for trusted audit: append-only triggers + periodic verification runs storing pass/fail; hash-chain/HMAC optional next layer; fail closed or halt writers on verification failure ([PostgreSQL immutable audit / hash-chain guidance](https://pgcomply.com/blog/postgresql-audit-trail-implementation), [HMAC hash-chain concurrency notes](https://tracehold.ai/blog/immutable-audit-log-hmac-hash-chain/), [verification-run storage pattern](https://appmaster.io/blog/tamper-evident-audit-trails-postgresql))
- Divan already has trigger-enforced append-only on `kernel_events` — **extend with verification runs + suspend**, do not replace
- Clock skew: compare app vs DB `now()`; treat large deltas as anomaly; do not invent org NTP SLA
- Avoid global advisory locks for MVP integrity unless implementing real hash-chain (deferred)

### Project context reference

- No `project-context.md` found in repo at create time — rely on Architecture Spine AD-1..6 (esp. AD-5, Deferred hash-chain), infra-security-brief §3–4, epics.md Epic 7 Story 7.4, PRD FR-51 / NFR-9 / AR-AUDIT open decisions, UX 2026-07-19 (ops/audit patterns), and this story file
- Communication with user: Persian; story document language: English (BMad config)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7 / Story 7.4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-51, NFR-9, AR-AUDIT open decisions]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5, Deferred hash-chain]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md` — §3 Audit / tamper evidence]
- [Source: `_bmad-output/implementation-artifacts/7-3-retention-disposal-legal-hold.md` — patterns; non-goal 7.4]
- [Source: `_bmad-output/implementation-artifacts/7-2-operations-health-without-hr-content.md` — ops redaction / non-goal 7.4]
- [Source: `_bmad-output/implementation-artifacts/7-1-audit-investigation-surface.md` — toxic self-review; soft-deny]
- [Source: `packages/kernel/audit-envelope/src/index.ts` — `AUDIT_APPEND_FAILED`]
- [Source: `packages/kernel/audit-envelope/src/authorization-error.ts`]
- [Source: `packages/db/sql/003_business_event_attributable_fields.sql` — `kernel_events_forbid_mutation`]
- [Source: `apps/web/src/server/trpc.ts` / `retrieval-control.ts` — error mapping asymmetry]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Trigger name for integrity check is `kernel_events_append_only_trg` (function `kernel_events_forbid_mutation`) — corrected after SQL inspect.
- Control-plane permissions (`audit.trust.*`, `ops.health.read`, `audit.investigate`, `audit.evidence.review`) bypass writer suspend so ops/trust review is not locked out.

### Completion Notes List

- Implemented FR-51 / NFR-9 audit trust fail-safe substrate: writer suspend gate, incidents, integrity verification runs, clock skew probe, baseline inventory.
- Domain home: `@divan/audit-envelope` (`audit-trust.ts`, `audit-trust-repo.ts`, `audit-trust-gate.ts`) — web stays thin.
- Fail-closed policy: **suspend on first required append failure**; distinct `MSG_AUDIT_APPEND_FAILED_FA` / trust Persian copy; `governedProcedure` maps append/trust codes to `INTERNAL_SERVER_ERROR` (not FORBIDDEN).
- UI primary: ops health **Audit trust** section (red/degraded/ok) + suspended banner; dedicated `auditTrust` tRPC router for state/incidents/assign/ack/close/integrity/clearSuspend.
- Hash-chain explicitly deferred in findings (`hashChain: deferred_not_claimed`); no LG-2 / NFR-10 complete claim.
- Selfchecks: `selfcheck:audit-trust`, `selfcheck:audit-trust-baseline` (envelope); `selfcheck:audit-trust` (web). Typecheck passed on envelope, web, identity-access.

### File List

- packages/db/sql/017_audit_trust.sql
- packages/kernel/audit-envelope/src/audit-trust.ts
- packages/kernel/audit-envelope/src/audit-trust-repo.ts
- packages/kernel/audit-envelope/src/audit-trust-gate.ts
- packages/kernel/audit-envelope/src/audit-trust.selfcheck.ts
- packages/kernel/audit-envelope/src/audit-trust-baseline.selfcheck.ts
- packages/kernel/audit-envelope/src/authorization-error.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/src/index.ts
- packages/kernel/audit-envelope/src/inference-bulk.ts
- packages/kernel/audit-envelope/src/ops-health.ts
- packages/kernel/audit-envelope/package.json
- packages/modules/identity-access/src/seed-audit-trust.ts
- packages/modules/identity-access/src/seed.ts
- apps/web/src/server/audit-trust.ts
- apps/web/src/server/audit-trust.selfcheck.ts
- apps/web/src/server/trpc.ts
- apps/web/src/server/retrieval-control.ts
- apps/web/src/server/operations.ts
- apps/web/src/server/root.ts
- apps/web/components/operations/operations-health-panel.tsx
- apps/web/lib/operational-copy.ts
- apps/web/package.json
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-4-audit-trust-fail-safe.md

### Change Log

- 2026-07-29: Story context created via bmad-create-story — status ready-for-dev
- 2026-07-29: Implemented audit trust fail-safe substrate (Tasks 1–7); status → review
- 2026-07-29: Code review patches applied (clock/SoD/clear/integrity/TTL alert/deep-link); status → done
