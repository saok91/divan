---
baseline_commit: e9f1107
---

# Story 7.5: External Data-Subject Correction Cases

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an HR Admin,
I want restricted correction-case tracking without employee self-service,
so that external transparency/correction requests remain attributable (FR53).

**Story key:** `7-5-external-data-subject-correction-cases`  
**Epic:** 7 — Audit, Operations & Evidence Controls (FR42, FR45, FR50, FR51, FR53–FR56)  
**Prerequisite:** Epics 1–6 done; Stories **7.1** (investigation), **7.2** (ops health), **7.3** (retention/hold), **7.4** (audit trust fail-safe) done. Existing substrate: `/correction-cases` IA + Placeholder only; `hr_admin` nav item; envelope + soft PermissionSet pattern; `016_data_lifecycle` + retention router (disposal_run ids); `017_audit_trust` writer suspend; `personnelEvent.correct` (FR-17 chain); formula-safe / import active-content reject spirit; 6.5 export custody/reauth. **No** correction-case schema, permissions, tRPC, attachment pipeline, breached-deadline product, or outcome-link model.

### Critical naming distinction (do not conflate)

| Concept | Owner | Meaning |
| --- | --- | --- |
| **Personnel Event Correction** (FR-17) | Story 4.3 — `correctPersonnelEvent` | Cancel/Reverse/Correction chain on a business event |
| **External data-subject correction case** (FR-53) | **This story** | Restricted case tracking for external transparency/correction requests |
| **Retention / disposal / hold** (FR-50) | 7.3 | Link `disposal_run` / hold evidence to approved outcomes |
| **Audit trust suspend** (FR-51) | 7.4 | **Honor** — do not reimplement the gate |
| **Published report supersession** (FR-54) | 7.6 | Link/hook only if cheap; do **not** build reproducibility product |

Use type/API names like `CorrectionCase` / `correctionCase.*` — never overload `Correction` alone in UI copy without context («پرونده اصلاح» vs «اصلاح رویداد»).

## Acceptance Criteria

1. **Given** an actor with fine-grained دسترسی to پرونده‌های اصلاح (soft PermissionSet after envelope — coarse `hr_admin` nav alone is insufficient)  
   **When** a case is opened  
   **Then** it records: verified request reference/authority, linked Person, owner, status, deadline, decision/reason (nullable until decided), restricted evidence references/metadata, and closure evidence (nullable until closed)  
   **And** every open/decide/close/attach mutation is attributable under AR-ACCESS / AR-AUDIT (required access-event path; honor 7.4 writer suspend)

2. **Given** bounded attachments are permitted only under provisional AR-DATA allowlist policy (code-marked `@provisional-pending-AR-DATA-freeze`; fail-closed when unset/misconfigured)  
   **When** an attachment is submitted  
   **Then** it follows owner-approved type/size allowlist; active/executable/script/external-link/unauthorized archive content is **rejected**; suspicious/unsupported/failed-inspection content is **quarantined** or rejected fail-closed; no content auto-executes; filename/metadata are minimized  
   **And** where policy explicitly allows, content may be offered only as **inert download** (`Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`); preview/download remain permission-safe and audited  
   **And** acceptance fixtures cover **allowed / rejected / quarantined / preview / download** (addendum §10.2)

3. **Given** a case with a deadline  
   **When** the deadline passes without timely closure/decision per provisional policy  
   **Then** the case enters a distinct **«مهلت گذشته» / breached-escalated** state — visually and in API **not** indistinguishable from in-time active  
   **And** breach produces attributable notification/review evidence (in-product surface and/or durable case event — **not** inventing PagerDuty/SIEM)

4. **Given** an approved case outcome  
   **When** the outcome is recorded  
   **Then** it links to relevant: Personnel Event **Correction** id(s) (FR-17), retention/disposal action (`disposal_run` / hold evidence from 7.3), propagation/recalculation correlation(s) where applicable, affected published artifact id(s) or explicit `pending_publication_hook` honesty when 7.6 product absent, and response evidence  
   **And** rejected or constrained outcomes remain attributable (decision/reason + closure evidence; no silent delete)

5. **And** AR-ACCESS / AR-AUDIT / AR-DATA remain **fail-closed**:
   - Do **not** invent named jurisdiction / GDPR article claims (Product 2026-07-16: no named regime for MVP)
   - Do **not** invent general personnel document management
   - Provisional allowlist / size caps / quarantine rules OK if `@provisional-pending-AR-DATA-freeze` + fail-closed when required knobs missing
   - Evidence defaults to **references/metadata**; bytes only when allowlist explicitly permits

6. **And** required vs secondary audit posture is **normative** (same as 7.1–7.4):
   | Path | On append failure | On trust suspend |
   | --- | --- | --- |
   | Required capture (open/decide/close/attach under envelope) | Fail-closed | Block sensitive allow |
   | Secondary audit-of-audit (list/search after primary allow) | Soft-deny / soft-return — never mask primary FORBIDDEN | Prefer fail-closed for **new** sensitive work; read of existing cases MAY continue if separately permitted |
   | API mapping | Trust/append failure ≠ ordinary «دسترسی ندارید.» — preserve 7.4 `INTERNAL_SERVER_ERROR` mapping |

7. **And** this story does **not** own: employee self-service portal; general DMS; rewriting 7.1–7.4 cores; 7.6 publication reproducibility product; 7.7 Launch Artifact change-control; 7.8 evaluation snapshots; PopulationPort cutover; AD-6 Prisma↔PoolClient hardening; Vitest mandate; Personnel Code merge/split; inventing full malware-AV SaaS; claiming LG-3 / full FR-53 production acceptance complete

## Tasks / Subtasks

- [x] Task 1: Domain constants + errors + status machine (AC: #1, #3–#6)
  - [x] NEW under `@divan/audit-envelope` `correction-case.ts` (mirror `data-lifecycle.ts` / `audit-trust.ts`):
    - Permissions (provisional): `correction.case.read`, `correction.case.write` (open/update/attach), `correction.case.decide` (approve/reject/constrain), `correction.case.close` — split decide/close if SoD clearer; document choice
    - Category: `correction.case` (ordinary; **not** person `health`; **not** colliding with `data.lifecycle` / `audit.evidence` / `audit.trust` / `ops.platform`)
    - Error codes + Persian `messageFa`: e.g. `CORRECTION_CASE_DENIED`, `CORRECTION_CASE_NOT_FOUND`, `CORRECTION_CASE_INVALID_TRANSITION`, `CORRECTION_CASE_DEADLINE_REQUIRED`, `CORRECTION_CASE_ATTACHMENT_REJECTED`, `CORRECTION_CASE_ATTACHMENT_QUARANTINED`, `CORRECTION_CASE_ALLOWLIST_UNSET`, `CORRECTION_CASE_SELF_REVIEW_BLOCKED`
    - Status machine (minimum): `open` → `in_progress` → `pending_decision` → `approved` \| `rejected` \| `constrained` → `closed`; plus distinct `breached` (or `breached` flag + status) for «مهلت گذشته» — **breached must not equal active `open`/`in_progress` in UI or filters**
    - DTOs: `CorrectionCase`, `CorrectionCaseEvidenceRef`, `CorrectionCaseAttachment`, `CorrectionCaseOutcomeLinks`, `AttachmentInspectionResult`
    - Provisional attachment policy config: allowlist ext→MIME→magic, max bytes, max per case — `@provisional-pending-AR-DATA-freeze`; fail closed if enforcement expected and knobs missing
  - [x] Register category + policy tuples in `DEV_DEMO_CATEGORIES` / `DEV_DEMO_POLICY` for read/write/decide/close × `org:selfcheck`
  - [x] NEW `packages/modules/identity-access/src/seed-correction-case.ts` (mirror `seed-retention.ts`): PermissionSet bound to **`hr.admin`** until AR-ACCESS freezes Legal/Privacy role — SoD: do **not** auto-grant to `audit.investigate` / `ops.health.read` / `audit.trust.review`
  - [x] Export from package index; dedicated `CorrectionCaseError` (map at API)

- [x] Task 2: Persistence — cases, evidence refs, attachments, outcome links (AC: #1–#4)
  - [x] NEW `packages/db/sql/018_correction_cases.sql` (next free after `017_audit_trust.sql`):
    - Schema e.g. `correction_case` (or `privacy.correction_case` — document choice)
    - `case` table: id, request_reference, authority_verified_at/by, person_id, owner_account_id, status, breached_at?, deadline_at, decision, decision_reason, closure_evidence jsonb minimized, correlation_id, created/updated attributable fields
    - `evidence_ref` table: case_id, kind (request|response|internal|other), uri_or_ref, metadata jsonb minimized, created_at, actor
    - `attachment` table: case_id, storage_key (server-generated UUID name — **never** trust client filename as path), original_filename_minimized, content_type_detected, size_bytes, inspection_status (`allowed`|`rejected`|`quarantined`), sha256, uploaded_by, uploaded_at — **no DELETE** of history (reject/quarantine = status)
    - `outcome_link` table: case_id, link_type (`personnel_correction`|`disposal_run`|`hold`|`recalc`|`published_artifact`|`response_evidence`|`pending_publication_hook`), target_id, note, created_at, actor
    - Indexes: open/breached by deadline; person_id; status; unique constraints to limit duplicate spam where sensible
    - **Never DELETE** case history rows (close = status + attributable fields)
  - [x] Repo via `pg` Pool/PoolClient — preferred orchestration home: `packages/modules/person-employment` (person-linked + retention/correct links) **or** thin helpers under audit-envelope (document in Completion Notes like 7.3/7.4). **Web stays thin.**
  - [x] Migrations-only (do not expand `ensure*Schema` sprawl)

- [x] Task 3: Attachment inspection pipeline (AC: #2, #5)
  - [x] Pure inspect function (domain): extension allowlist + size cap + magic-byte/MIME mismatch reject; reject executables/scripts/HTML/SVG-as-code/external-link wrappers/unauthorized archives per provisional policy
  - [x] Reuse spirit of `hasFormulaControlPrefix` / formula-safe export — do **not** invent general DMS or parallel byte SoT for exports
  - [x] Storage: private non-executable path or DB bytea for MVP bounded sizes — outside web root; random storage key; minimized retained filename
  - [x] Quarantine status blocks preview/download until explicit policy path (default: quarantine = no download)
  - [x] Inert download headers on allowed path; preview only for explicitly allowlisted types (e.g. image/pdf if policy says) — otherwise download-only
  - [x] Failed inspection → fail-closed (no soft-allow of bytes)
  - [x] Selfcheck fixtures: allowed / rejected / quarantined / preview / download

- [x] Task 4: Deadline breach escalation (AC: #3)
  - [x] Pure helper: `isDeadlineBreached(case, now)` → transition to breached/escalated
  - [x] Durable: either lazy transition on read/list **and** explicit `escalateOverdueCases` procedure/job hook (document); both must leave attributable evidence
  - [x] In-product review cue: badge/filter «مهلت گذشته» on correction-cases panel; optional honesty banner
  - [x] Do not invent external notification bus — attributable case event + UI is enough for MVP

- [x] Task 5: Outcome linking (AC: #4)
  - [x] APIs to attach outcome links by type; validate target exists where cheap (correction event id, disposal_run id from 7.3)
  - [x] **Consume** `personnelEvent.correct` — do not rewrite lifecycle writers
  - [x] **Consume** retention `disposal_run` / hold ids — do not fork 7.3
  - [x] Published artifacts: if 7.6 absent, allow `pending_publication_hook` link type with honesty label — **never** fabricate reproducibility
  - [x] Propagation/recalc: store correlation ids when known; do not invent fake recalc completion

- [x] Task 6: Thin tRPC + replace Placeholder UI (AC: #1–#7)
  - [x] NEW `apps/web/src/server/correction-case.ts` (or `correction-cases.ts`):
    - Procedures: `list`, `get`, `open`, `update`, `decide`, `close`, `escalateOverdue` (or auto on list), `addEvidenceRef`, `uploadAttachment`, `getAttachmentMeta`, `previewAttachment` / `downloadAttachment`, `linkOutcome`, `capabilities`
    - `governedProcedure` + soft PermissionSet gate after envelope; map domain errors via `operational-copy`
    - Soft-deny on secondary allow-path append failure
  - [x] Register in `root.ts`
  - [x] UPDATE `apps/web/app/(app)/correction-cases/page.tsx`: replace `PlaceholderPage`; `assertPageAccess` (Layout≠RSC); load client panel
  - [x] NEW `apps/web/components/correction-cases/correction-cases-panel.tsx` (GovernedDataTable + detail/drawer; open/decide/close dialogs; attachment list; outcome links; breached badge)
  - [x] Persian RTL + digits; Skeleton; error ≠ empty; single dialog depth; empty copy for no cases
  - [x] UPDATE `operational-copy.ts` — never forward raw `error.message`

- [x] Task 7: Verify + DoD (AC: #1–#7)
  - [x] Selfchecks: open records required fields; unauthorized deny; deadline→breached distinct; attachment allow/reject/quarantine/preview/download; outcome links; soft-deny secondary; trust suspend blocks new writes; append-only `kernel_events` untouched
  - [x] `pnpm` typecheck + eslint on touched packages
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits

### Manual DoD checklist

- [x] Placeholder at `/correction-cases` gone; real panel loads for permitted `hr.admin`
- [x] Coarse nav alone cannot mutate — soft PermissionSet required after envelope
- [x] Open case persists all required FR-53 fields; closure/decision attributable
- [x] Attachment allowlist rejects executable/script/unauthorized archive; quarantine path works; failed inspection fail-closed
- [x] Preview/download permission-safe + audited; inert download headers; no auto-execute
- [x] «مهلت گذشته» visually and in API distinct from active
- [x] Approved outcome can link Correction + disposal_run (+ honesty hook for publications)
- [x] Rejected/constrained outcomes remain queryable (no silent delete)
- [x] 7.4 trust suspend still blocks sensitive correction-case writes
- [x] No employee self-service surface; no general DMS claims
- [x] No named GDPR/jurisdiction claim; AR-DATA provisional markers present
- [x] Persian RTL / digits; UX-DR24 copy; no secrets in UI
- [x] Sprint may claim FR-53 **case-tracking substrate** — **not** full AR-DATA/LG-3 production acceptance complete

### Review Findings

- [x] [Review][Patch] Required `appendAccessEvent` soft-swallowed after persist — decided: harden open/decide/close/attach/progress/evidence/outcome to transactional fail-closed (AC6); escalate/download remain soft-secondary [`packages/modules/person-employment/src/correction-case.ts`]
- [x] [Review][Defer] Attachment policy defaults without `DIVAN_CORRECTION_CASE_ENFORCE=1` — deferred: keep provisional defaults + ENFORCE honesty for local/selfcheck; AR-DATA freeze owns production fail-closed defaults
- [x] [Review][Patch] Close path skips owner≠actor SoD — decided: extend `assertCorrectionCaseSelfReviewAllowed` to `close` [`packages/modules/person-employment/src/correction-case.ts`]
- [x] [Review][Patch] Outcome links allowed before decided status — decided: restrict to `approved`|`rejected`|`constrained` [`packages/modules/person-employment/src/correction-case.ts`]
- [x] [Review][Patch] Status UPDATE lacks optimistic concurrency (`WHERE status = expected`) [`packages/modules/person-employment/src/correction-case-repo.ts:222`]
- [x] [Review][Patch] Closed cases still accept evidence refs, attachments, and outcome links [`packages/modules/person-employment/src/correction-case.ts:400`]
- [x] [Review][Patch] Attachment quota counts rejected/quarantined rows toward `maxPerCase` [`packages/modules/person-employment/src/correction-case-repo.ts:325`]
- [x] [Review][Patch] CSV/txt active-content scan only inspects first line [`packages/kernel/audit-envelope/src/correction-case.ts:604`]
- [x] [Review][Patch] `updateCorrectionCaseProgress` has no `appendAccessEvent` [`packages/modules/person-employment/src/correction-case.ts:190`]
- [x] [Review][Patch] tRPC `contentBase64` max 2_000_000 chars exceeds 1 MiB policy and decodes before inspect [`apps/web/src/server/correction-case.ts:604`]
- [x] [Review][Patch] Unique `(person_id, request_reference)` violation not mapped to Persian CorrectionCaseError [`packages/modules/person-employment/src/correction-case-repo.ts:125`]
- [x] [Review][Patch] `open` does not validate `personId` exists in personnel registry [`packages/modules/person-employment/src/correction-case.ts:135`]
- [x] [Review][Patch] Concurrent uploads can race past `maxPerCase` (count-then-insert) [`packages/modules/person-employment/src/correction-case.ts:450`]
- [x] [Review][Patch] UI has no preview path despite API `mode: "preview"` [`apps/web/components/correction-cases/correction-cases-panel.tsx:315`]
- [x] [Review][Patch] UI does not wire `addEvidenceRef` despite API + copy [`apps/web/components/correction-cases/correction-cases-panel.tsx`]
- [x] [Review][Patch] Module selfcheck lacks quarantine + preview download fixtures (AC2 §10.2) [`packages/modules/person-employment/src/correction-case.selfcheck.ts`]
- [x] [Review][Patch] No runtime trust-suspend regression for correction-case writes (DoD claims) [`apps/web/src/server/correction-case.selfcheck.ts`]
- [x] [Review][Patch] Breached presentation / `breachedOnly` filter inconsistent for decided-but-unclosed past deadline [`packages/modules/person-employment/src/correction-case-repo.ts:176`]
- [x] [Review][Patch] Raw English `inspectionStatus` / outcome `linkType` shown in UI [`apps/web/components/correction-cases/correction-cases-panel.tsx:579`]
- [x] [Review][Patch] No client-side rejection when selected file exceeds policy max bytes [`apps/web/components/correction-cases/correction-cases-panel.tsx:309`]
- [x] [Review][Patch] Capabilities query failure leaves write actions silently hidden [`apps/web/components/correction-cases/correction-cases-panel.tsx:163`]
- [x] [Review][Patch] Malformed non-UUID `targetId` for disposal_run/hold can surface as generic 500 [`packages/modules/person-employment/src/correction-case.ts:620`]
- [x] [Review][Defer] Unscoped list / attachment access within `correction.case.read` trust boundary [`packages/modules/person-employment/src/correction-case.ts:527`] — deferred, pre-existing
- [x] [Review][Defer] Base64 download streaming / size-cap upgrade [`apps/web/src/server/correction-case.ts:718`] — deferred, pre-existing
- [x] [Review][Defer] `personnel_correction` validates kernel_events existence only (not Correction/FR-17 type) [`packages/modules/person-employment/src/correction-case-repo.ts:487`] — deferred, pre-existing
- [x] [Review][Defer] MVP org:selfcheck listing without actor/org narrowing [`packages/modules/person-employment/src/correction-case.ts:360`] — deferred, pre-existing

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Restricted case tracking with required FR-53 fields | Employee self-service / employee-facing correction portal |
| Bounded attachments under provisional allowlist + fail-closed inspection | General personnel document management |
| Distinct breached / «مهلت گذشته» state | Leave overdue cases indistinguishable from active |
| Link approved outcomes to Correction / retention / response evidence | Fabricate 7.6 reproducibility or fake recalc |
| Honor 7.4 trust suspend + AD-5 required access events | Parallel audit SoT or Prisma audit tables |
| Soft PermissionSet after envelope; seed on hr.admin with SoD | Coarse nav alone as authz; auto-grant audit/ops/trust |
| Thin web; domain in kernel/modules; operational-copy | English placeholders; PlaceholderPage as “done” |
| Migrations-only `018_*.sql` via `pg` | Prisma models for case tables; `ensure*Schema` sprawl |

### Absolute non-goals

- Employee self-service or employee-facing correction workflow (PRD §5.3)
- General personnel document/file management
- Inventing AR-DATA attachment catalogue / jurisdiction / GDPR article numbers
- Rewriting 7.1 investigation / 7.2 probe set / 7.3 hold-dispose core / 7.4 trust gate
- 7.6 publication reproducibility product (link/hook only)
- 7.7–7.8; PopulationPort cutover; AD-6 Prisma↔PoolClient; Vitest mandate; hash-chain
- Personnel Code correction/merge/split (still AR-DATA/MIGRATION blocked)
- Full commercial AV/malware SaaS; external SIEM/PagerDuty
- Claiming LG-3 / full FR-53 production acceptance complete
- Conflating FR-17 event Correction UI with FR-53 case tracker

### UPDATE files — current state → this story → preserve

| File | Current (post-7.4) | Change | Preserve |
| --- | --- | --- | --- |
| `apps/web/app/(app)/correction-cases/page.tsx` | `PlaceholderPage` only | Replace with assertPageAccess + panel | Route `/correction-cases`; Layout≠RSC |
| `packages/modules/identity-access/src/navigation.ts` | `hr_admin` includes `/correction-cases` | Keep href/label; fine gate on page/API | Coarse role landings |
| `packages/kernel/audit-envelope/src/categories.ts` | No `correction.case` | Register category + policy tuples | Existing categories; never reuse `health` |
| `packages/modules/identity-access/src/seed.ts` | retention/trust/export seeds | Wire `seed-correction-case` | Existing seed order/idempotency |
| `apps/web/src/server/root.ts` | No correctionCase router | Register thin router | Existing routers |
| `apps/web/lib/operational-copy.ts` | audit/ops/retention/trust | Case/attachment/breached copy | UX-DR24; exact LDAP/custody strings |
| `apps/web/src/server/trpc.ts` | Trust/append INTERNAL mapping | Do not regress; map new domain errors | Soft-deny secondary contract |
| `personnel-event.ts` / lifecycle | FR-17 `correct` | **Link** outcome ids only | Writer semantics / append-only |
| `retention.ts` / data-lifecycle | disposal_run / holds | **Link** run/hold ids only | Hold never-delete; soft-deny secondary |
| `audit-trust` gate | Writer suspend | **Honor** on case mutations | Control-plane bypass list discipline |
| NEW `018_correction_cases.sql` + domain | Absent | Case + attachment + links | `kernel_events` append-only untouched |

### Architecture compliance

- **AD-1:** Single process + one PG — case tables in same DB
- **AD-2:** Case records are control/evidence plane; personnel Corrections remain event-chain SoT — never in-place rewrite projections as correction
- **AD-3:** Web → modules/kernel; no Prisma for case/attachment tables; repo uses `pg`
- **AD-5:** Identity-access coarse + envelope fine; required access events on sensitive case ops; FR-53 under AR-ACCESS/AR-AUDIT/AR-DATA
- **AD-6:** Raw SQL migrations for case schema; keep event-store triggers intact
- **Capability map:** FR-53 → kernel + person-employment (or documented module) + web thin UI; attachments mechanism chosen by architecture without changing addendum §10.2 outcomes
- **Non-goal spine:** No general workflow engine — finite case status machine only

### Attachment safety algorithm (normative)

```text
on uploadAttachment(caseId, bytes, clientFilename, clientMime):
  authorizeOrThrow(correction.case.write)  # honor trust suspend
  if allowlist config unset → throw CORRECTION_CASE_ALLOWLIST_UNSET (fail-closed)
  minimizedName = sanitize/clamp(clientFilename)  # never use as storage path
  storageKey = randomUUID()
  detected = magicBytes + server MIME sniff
  if !allowlisted(ext, detected, size) OR isActiveExecutableScriptOrUnauthorizedArchive(detected):
    persist attachment row status=rejected (or drop bytes) + access event
    throw CORRECTION_CASE_ATTACHMENT_REJECTED
  if suspiciousOrInspectionFailed:
    persist status=quarantined; no preview/download
    throw or return quarantine outcome (fail-closed for “allowed” path)
  store bytes under storageKey (non-executable)
  persist status=allowed + sha256 + minimized metadata
  appendAccessEvent(outcome=allow)

on preview/download:
  authorizeOrThrow + attachment must be allowed (not quarantined/rejected)
  stream with Content-Disposition: attachment (or tightly scoped preview types)
  X-Content-Type-Options: nosniff
  appendAccessEvent
  NEVER execute / evaluate content server-side or via inline scriptable types
```

Align with OWASP File Upload Cheat Sheet: allowlist, magic bytes, size caps, random storage names, quarantine, inert delivery — **not** client MIME trust alone.

### Permission seeding (provisional)

| Key | Use | Seed bind |
| --- | --- | --- |
| `correction.case.read` | List/get cases, evidence meta | `hr.admin` |
| `correction.case.write` | Open/update/add evidence/upload | `hr.admin` |
| `correction.case.decide` | Approve/reject/constrain | `hr.admin` (document if later SoD splits) |
| `correction.case.close` | Close with closure evidence | `hr.admin` |
| Existing `personnel_event.correct` | Create FR-17 Correction to link | Unchanged 4.3 |
| Existing `data.lifecycle.*` | Create disposal/hold to link | Unchanged 7.3 |

Mark `@provisional-pending-AR-ACCESS-freeze` / `@provisional-pending-AR-DATA-freeze`.

### Migration-evidence honesty (still mandatory)

| Fact | Case tracker must |
| --- | --- |
| PopulationPort fixture-default | Not present person-link as production population proof; disclose if scope claims appear |
| AD-6 / Baseline projector gaps | Not claim historical reconstruction from case evidence alone |
| 7.6 not built | Use `pending_publication_hook` honesty — never fake supersession package |
| Soft-deny secondary gaps | Do not upgrade soft-failed list evidence into false “fully audited” claims |
| Person-org IDOR on Correct (open carry-in) | If linking triggers Correct mutation, harden person-org scope **or** explicit defer in Completion Notes / deferred-work |

### UX notes

- IA: sidebar **پرونده‌های اصلاح** already ordered (UX-DR19); replace Placeholder — do not add a second route
- State pattern UX-DR22: breached deadline = distinct «مهلت گذشته» (not same styling as active)
- Empty list: Persian empty copy (define in operational-copy; spine had no dedicated empty string)
- Mimic investigation panel list+detail and lifecycle panel confirm dialogs; GovernedDataTable
- Deep-link optional: from timeline Correction → case outcome link; from retention run → case — nice-to-have, not blocking
- Single dialog depth; Skeleton loading; error ≠ empty

### AR honesty

- AR-DATA open: correction cases + bounded-attachment safety — implement **substrate + fail-closed provisional allowlist**
- AR-ACCESS open: matrix pending — provisional permissions + soft PermissionSet
- AR-AUDIT: case mutations on required envelope path; honor trust suspend
- Forbidden: claiming LG-3 complete; inventing jurisdiction; claiming general DMS; inventing 7.6–7.8 products

### Known gaps to document (do not silently “fix” as done)

| Gap | Handling in 7.5 |
| --- | --- |
| AR-DATA attachment catalogue not frozen | Provisional allowlist + fail-closed |
| No commercial AV mandated | Magic/MIME/size/archive policy + quarantine; document AV as future |
| 7.6 publications absent | `pending_publication_hook` honesty |
| Unscoped list IDOR class (7.3 hold lists) | MVP `org:selfcheck`; document IDOR narrowing defer or harden if touching same pattern |
| Person-org IDOR on Correct mutation | Defer explicitly or harden when linking creates Correction |
| Nested JSONB redaction depth (7.4 defer) | Keep evidence metadata flat/minimized; avoid deep unredacted dumps |
| Base64 download size cap (6.5 defer) | Prefer streaming/proxy; enforce max size; do not silently repeat uncapped Base64 |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Existing monorepo | Node 22 / TS 5.x / pnpm — no new framework |
| PostgreSQL | NEW `018_correction_cases.sql`; keep `001`–`017` |
| `pg` Pool/PoolClient | Case/attachment repo |
| tRPC `governedProcedure` | All case procedures |
| `@divan/audit-envelope` | Domain constants/errors/category |
| `@divan/identity-access` | `seed-correction-case.ts` |
| `@divan/person-employment` (or chosen) | Orchestration + links to correct/retention |
| Import formula helpers | Reuse reject spirit — not a DMS |
| Selfcheck (`tsx`) | House pattern |
| UI | Replace Placeholder; GovernedDataTable; operational-copy; Dialog confirm |

### File structure requirements

```text
packages/db/sql/
  018_correction_cases.sql                    # NEW

packages/kernel/audit-envelope/src/
  correction-case.ts                          # NEW constants/DTO/errors/status/inspect policy
  correction-case.selfcheck.ts                # NEW
  categories.ts / index.ts                    # UPDATE

packages/modules/identity-access/src/
  seed-correction-case.ts                     # NEW
  seed.ts / index.ts                          # UPDATE wire

packages/modules/person-employment/src/       # OR documented alternate home
  correction-case.ts                          # NEW orchestration
  correction-case-repo.ts                     # NEW
  correction-case.selfcheck.ts                # NEW
  index.ts / package.json                     # UPDATE

apps/web/src/server/
  correction-case.ts                          # NEW thin router
  correction-case.selfcheck.ts                # NEW
  root.ts                                     # UPDATE register

apps/web/app/(app)/correction-cases/page.tsx  # UPDATE replace Placeholder
apps/web/components/correction-cases/…        # NEW panel
apps/web/lib/operational-copy.ts              # UPDATE
```

### Testing requirements

- Domain: status transitions; breached ≠ active; attachment fixtures (5 outcomes); allowlist unset fail-closed; outcome link types
- Module/DB: open/get/list; deadline escalate; upload reject/quarantine; link disposal_run + correction id
- Web: router registered; Placeholder gone; Layout≠RSC; copy keys; soft-deny secondary; unauthorized deny
- Regression: `selfcheck:retention`, `selfcheck:audit-trust`, `selfcheck:audit`, `selfcheck:export-artifact`, event-store append-only, personnel correct path
- Typecheck: envelope, identity-access, person-employment (or chosen), web

### Previous story intelligence (7.4 / 7.3 / 7.2 / 7.1)

- **7.4:** Domain in `@divan/audit-envelope`; SQL `017_*`; seed SoD; thin web; soft-deny secondary; distinct Persian + INTERNAL mapping for trust/append; Gate + Absolute non-goals; adversarial Patch/Decision/Defer expected; BOM-safe yaml; control-plane perms may bypass writer suspend — decide carefully which `correction.case.*` are control-plane (prefer **not** bypassing for case writes)
- **7.3:** Explicitly left `/correction-cases` Placeholder for 7.5; returns `disposal_run` ids for outcome links; category ≠ `health`; migrations-only
- **7.2:** Ops DTO forbidden keys — case panel **may** show Person-linked data under envelope; never leak into ops/trust surfaces
- **7.1:** Toxic self-review / independence; soft PermissionSet; GovernedDataTable; Layout≠RSC; consume-6.5 for artifact bytes — do not invent parallel audit byte path
- **4.3:** FR-17 Correction ≠ FR-53; person-org IDOR on Correct still open carry-in
- **Epic 6 retro open (non-goals here):** AD-6 Prisma↔PoolClient; Baseline projector; PopulationPort cutover; InferenceBulk ops doc; sticky break-glass

### Git intelligence summary

Recent commits: `e9f1107` story 7.4; `4754116` story 7.3; `f29e3c7` story 7.2; `08bff26` story 7.1; `d9e9eba` epic 6 retro. Patterns to copy: provisional permission seeds, dual-layer selfchecks (envelope + web), Gate tables, dedicated `0xx_*.sql`, soft-deny secondary vs fail-closed primary, replace IA Placeholder with assertPageAccess + panel, review Patch triage after implement.

### Latest tech information

- OWASP File Upload Cheat Sheet: extension allowlist, never trust client Content-Type alone, magic-byte verification, size limits, random storage names, store outside web root, serve with `Content-Disposition: attachment` + `nosniff` ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html))
- Quarantine-then-promote pattern for suspicious/unsupported content; fail closed on inspection failure (industry SaaS upload checklists 2025–2026)
- Divan already rejects formula/active spreadsheet content in import and formula-safe export — **reuse spirit** for FR-53 inspection; do not stand up a general document platform
- Architecture explicitly: mechanism is free; addendum §10.2 outcomes are not

### Project context reference

- No `project-context.md` found in repo at create time — rely on Architecture Spine AD-1..6 (esp. AD-5), infra-security-brief, epics.md Epic 7 Story 7.5, PRD FR-53 + §5.1/§5.3, addendum §10.2, UX EXPERIENCE (پرونده‌های اصلاح / مهلت گذشته), and this story file
- Communication with user: Persian; story document language: English (BMad config)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7 / Story 7.5 / UX-DR19 / UX-DR22 / FR53]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-53 consequences; §5.1/§5.3; AR-DATA/ACCESS/AUDIT]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §10.2 bounded attachment safety]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — پرونده‌های اصلاح; مهلت گذشته]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2/AD-5; FR-46..56]
- [Source: `_bmad-output/implementation-artifacts/7-4-audit-trust-fail-safe.md` — trust honor; patterns]
- [Source: `_bmad-output/implementation-artifacts/7-3-retention-disposal-legal-hold.md` — disposal_run link; Placeholder handoff]
- [Source: `_bmad-output/implementation-artifacts/7-1-audit-investigation-surface.md` — investigation UI / soft-deny]
- [Source: `apps/web/app/(app)/correction-cases/page.tsx` — Placeholder to replace]
- [Source: `packages/modules/identity-access/src/seed-retention.ts` — seed pattern]
- [Source: `packages/db/sql/017_audit_trust.sql` — SQL/status pattern predecessor]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Domain selfcheck: `pnpm --filter @divan/audit-envelope selfcheck:correction-case` — ok
- Module selfcheck (with DB after `018`): `pnpm --filter @divan/person-employment selfcheck:correction-case` — ok
- Web selfcheck: `pnpm --filter @divan/web selfcheck:correction-case` — ok
- Regression: retention / audit-trust / data-lifecycle selfchecks — ok
- Typecheck: `@divan/web`, `@divan/person-employment`, `@divan/audit-envelope` — ok

### Completion Notes List

- **SoD:** `correction.case.decide` and `correction.case.close` are separate permissions (seeded together on `hr.admin` for MVP; can split Legal/Privacy later). Owner≠actor enforced on decide (`CORRECTION_CASE_SELF_REVIEW_BLOCKED`).
- **Schema home:** `correction_case` PG schema (not `privacy.*`) — ordinary category `correction.case`; migrations-only `018_correction_cases.sql`.
- **Orchestration home:** `person-employment` (`correction-case.ts` + `correction-case-repo.ts`) — person-linked + cheap validate of `disposal_run` / hold / kernel_events Correction ids. Domain constants/errors/inspect in `@divan/audit-envelope`.
- **Attachments:** MVP stores allowlisted/quarantined bytes as `BYTEA` under random `storage_key`; rejected may omit bytes. Quarantine blocks download. Inert headers: `Content-Disposition` + `nosniff`. Formula/active-content prefix reject for txt/csv. `@provisional-pending-AR-DATA-freeze`; `DIVAN_CORRECTION_CASE_ENFORCE=1` fail-closed when knobs missing.
- **Breach:** Lazy escalate on list/get via `escalateOverdueCases` + explicit `escalateOverdue` procedure; durable `status=breached` + `case_event` + access event. UI badge/filter «مهلت گذشته».
- **Outcomes:** `pending_publication_hook` honesty when 7.6 absent; no fabricated reproducibility. Person-org IDOR on Correct mutation deferred (link validates event id existence only).
- **Trust:** Case mutations use `governedProcedure` + `sensitive: true` — honor 7.4 writer suspend without control-plane bypass.
- **Gaps deferred:** commercial AV; AR-DATA catalogue freeze; list IDOR narrowing beyond `org:selfcheck`; Base64 download size streaming upgrade; LG-3 / full FR-53 production acceptance.

### File List

- `packages/kernel/audit-envelope/src/correction-case.ts` (NEW)
- `packages/kernel/audit-envelope/src/correction-case.selfcheck.ts` (NEW)
- `packages/kernel/audit-envelope/src/categories.ts` (UPDATE)
- `packages/kernel/audit-envelope/src/index.ts` (UPDATE)
- `packages/kernel/audit-envelope/package.json` (UPDATE)
- `packages/db/sql/018_correction_cases.sql` (NEW)
- `packages/modules/identity-access/src/seed-correction-case.ts` (NEW)
- `packages/modules/identity-access/src/seed.ts` (UPDATE)
- `packages/modules/person-employment/src/correction-case-repo.ts` (NEW)
- `packages/modules/person-employment/src/correction-case.ts` (NEW)
- `packages/modules/person-employment/src/correction-case.selfcheck.ts` (NEW)
- `packages/modules/person-employment/src/index.ts` (UPDATE)
- `packages/modules/person-employment/package.json` (UPDATE)
- `apps/web/src/server/correction-case.ts` (NEW)
- `apps/web/src/server/correction-case.selfcheck.ts` (NEW)
- `apps/web/src/server/root.ts` (UPDATE)
- `apps/web/app/(app)/correction-cases/page.tsx` (UPDATE)
- `apps/web/components/correction-cases/correction-cases-panel.tsx` (NEW)
- `apps/web/lib/operational-copy.ts` (UPDATE)
- `apps/web/package.json` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)
- `_bmad-output/implementation-artifacts/7-5-external-data-subject-correction-cases.md` (UPDATE)

### Change Log

- 2026-07-29: Story context created via bmad-create-story — status ready-for-dev
- 2026-07-29: Implemented FR-53 correction-case substrate (domain, SQL 018, seed, orchestration, tRPC, UI); status → review
- 2026-07-29: Code review patches applied (audit fail-closed TX, close SoD, outcome decide-gate, attachment/UI/selfcheck hardenings); status → done
