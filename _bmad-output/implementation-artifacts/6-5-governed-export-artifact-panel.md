---
baseline_commit: 9949664
---

# Story 6.5: Governed Export & Artifact Panel

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a permitted exporter,
I want filtered exports with classification, reauth, and custody acknowledgement,
so that sensitive fields never leave without category-specific export permission (FR41, FR52, UX-DR17).

**Story key:** `6-5-governed-export-artifact-panel`  
**Epic:** 6 — Migration, Baseline & Governed Export (FR37–41, FR52)  
**Prerequisite:** Stories 6.1–6.4 done (import formula-safe substrate, batch evidence, provenance honesty, reconciliation gate). Story **5.5** shipped report catalogue **run/view** with disabled `exportSlot` + `exportAvailable: false`. Story **5.1** personnel list has `hasExportPermission: false` stub. Epic 2 shipped `action: "export"` segregation + `reauthorizeForQueuedOrArtifactWork` (no production consumer until this story).

## Acceptance Criteria

1. **Given** an actor with export permission for the filtered scope  
   **When** export is generated from an approved launch surface (report catalogue filtered run and/or personnel list filtered query)  
   **Then** only permitted records, fields, dates, and Organizational Scope are included in an AR-DATA-approved launch format (CSV and/or XLSX — provisional formats OK if code-marked; do not invent unapproved transports)

2. **And** sensitive category fields are **excluded** (omit from file/metadata — not masked as fake zeros) without **category-specific export permission**; view/read permission alone never unlocks those columns (`requiresSeparateExport` / FR-3 / Story 2.2)

3. **And** generation binds to a **reviewed stable snapshot** of the authorized filtered result (same filter identity as the on-screen run/list) and **reauthorizes** via `reauthorizeForQueuedOrArtifactWork` at:
   - generation/execution time, **and**
   - **every** managed retrieval/download  
   Fail-closed on role/scope/account change, population miss, or inactive account (stale links deny)

4. **And** UI component `export-artifact-panel` shows **classification**, **expiry/handling**, and **field scope**; sensitive and/or bulk retrieval requires an explicit **custody acknowledgement** checkbox before download is enabled (UX-DR17 / DESIGN tokens)

5. **And** at download, Divan displays classification / handling / expiry notices and records **recipient**, **destination class**, and **custody transfer** evidence; actor, time, purpose/type, filters/scope, selected fields, volume, outcome, and artifact handling are audited (access/export event class per house pattern)

6. **And** spreadsheet exports are **formula-safe**: no unauthorized data in cells or metadata; values beginning with formula-control characters (`=`, `+`, `-`, `@`, tab/CR) are neutralized for spreadsheet consumers (symmetric with import `literalizeCellValue` / FR-52); macros/active content are never emitted

7. **And** Divan **MUST NOT** claim it can revoke or delete local/email/share copies after they leave the system; copy states the custody boundary (managed artifact/link revoke ≠ local copy control)

8. **And** export channel uses the same control plane as other retrieval: `governedProcedure` + `action: "export"` + `runGovernedRetrieval` channel `"export"` + InferenceBulkPort — not a bypass path (FR-47/48). Break-glass elevation **denies** export by default without exceptional approval (existing `assertBreakGlassElevationLimits(..., "export")`)

9. **And** AR-ACCESS / AR-DATA / AR-REPORTING / AR-AUDIT / AR-MIGRATION remain **fail-closed**:
   - Do **not** invent AR numeric thresholds, category enablement, or “signed” export policy freezes
   - Provisional permission keys OK if code-marked + seeded + fail-closed (mirror `migration.*` / `demo.sensitive_hr.export` patterns)
   - PopulationPort fixture≠production honesty preserved on any person-linked surfaces
   - `import_batch_outcomes` report remains evidence-backed or unavailable — never fabricate from export drafts

10. **And** this story **closes** the 5.5 / 5.1 export stubs for wired surfaces: replace disabled “خروجی (به‌زودی)” with real panel when permitted; `hasExportPermission` / `exportAvailable` become real capability signals (false when unauthorized — omit theater)

11. **And** this story does **not** own: Epic 7 audit investigation / retention-disposal productization beyond export artifact revoke/dispose hooks needed here; PopulationPort full registry cutover; AD-6 Prisma↔PoolClient orphan fix; person-org IDOR on Cancel/Reverse/Correct; logout→`requestNavigation`; Add/QuickCreate form dedupe; Vitest mandate

## Tasks / Subtasks

- [x] Task 1: Export artifact domain + persistence (AC: #1–#3, #5–#7, #9)
  - [x] NEW `packages/db/sql/015_export_artifacts.sql` (next after `014_migration_reconciliation.sql`) — prefer schema `reporting` or `export_artifacts` (document choice). Tables at minimum:
    - **export_artifact** — id, owner/requester account id, purpose, classification, scope/fields JSON, source surface (`report`|`personnel_list`), source key/filters snapshot hash, format (`csv`|`xlsx`), state (`pending`|`ready`|`expired`|`revoked`|`disposed`), created_at, expires_at, volume/row_count, correlation_id, content storage ref (path/blob id — prefer DB bytea or filesystem under controlled path; **no** client-held secrets)
    - **export_artifact_retrieval** — artifact_id, retriever account id, retrieved_at, recipient, destination_class, custody_ack_at, reauth_reason/outcome, correlation_id
    - **export_artifact_lifecycle_event** (or append-only rows) — revoke/dispose/expiry evidence (actor, time, reason)
  - [x] Follow `packages/db/sql/README.md` (`IF NOT EXISTS`, idempotent). Raw SQL via `pg` Pool/PoolClient — **not** Prisma for artifact bytes (AD-6). Identity/entitlement checks may still use Prisma where existing modules do.
  - [x] NEW under `packages/modules/reporting/src/`:
    - `export-artifact.ts` — create from stable snapshot, reauth gate, mark ready, revoke, dispose, expiry check
    - `export-artifact-repo.ts` — persistence
    - `formula-safe-export.ts` — CSV/XLSX writers that neutralize formula-control prefixes (reuse regex intent from `packages/modules/migration/src/parse-workbook.ts` `FORMULA_CONTROL_PREFIX` / `hasFormulaControlPrefix`; **do not** fork a second spreadsheet stack — ExcelJS already in migration; either depend via shared small util in reporting **or** extract shared `formula-safe` helper into a kernel/shared module only if duplication would otherwise be harmful — prefer minimal: put export writers in reporting and import the prefix helper pattern, not the whole parse pipeline)
  - [x] **Stable snapshot:** generation input = authorized row/field set already produced by `assembleReportRun` / personnel search DTO after PopulationPort ∩ InferenceBulk — hash filters + field list + as-of; reject generate if client tampers filters vs reviewed snapshot id
  - [x] **Reauth:** call `reauthorizeForQueuedOrArtifactWork` with `populationChannel: "export"` (and objectIds/scope as applicable) **before** persisting ready artifact **and** **before** every byte delivery. Deny → Persian operational error; revoke or fail-closed managed link
  - [x] Export from `packages/modules/reporting/src/index.ts`; extend reporting package scripts
  - [x] Error codes with `messageFa` (e.g. `EXPORT_DENIED`, `REAUTH_FAILED`, `ARTIFACT_EXPIRED`, `ARTIFACT_REVOKED`, `CUSTODY_ACK_REQUIRED`, `SENSITIVE_EXPORT_DENIED`, `SNAPSHOT_MISMATCH`)

- [x] Task 2: Governed tRPC + permissions (AC: #1–#3, #8–#10)
  - [x] UPDATE `apps/web/src/server/report.ts`:
    - Stop hardcoding `exportAvailable: false` — compute from real export entitlement for that run
    - Add procedures (names flexible): `export.create` / `export.getArtifact` / `export.download` / `export.revoke` (or nested `report.export*` — keep thin web)
    - Meta: `action: "export"`; permission provisional e.g. `report.export` / `person.export` (code-marked); sensitive categories that `requiresSeparateExport` need matching category export entitlement or omit columns
    - Wire `runGovernedRetrieval({ channel: "export", ... })` on create path; InferenceBulk must apply
  - [x] UPDATE `apps/web/src/server/personnel-scoped-search.ts` — `hasExportPermission` real (not always `false`)
  - [x] Seed provisional export permissions via audit-envelope / DEMO policy pattern used for migration SoD; fail-closed for unseeded roles
  - [x] Preserve break-glass export deny path; do not weaken `assertBreakGlassElevationLimits`
  - [x] Layout≠RSC: any RSC fetch still `assertPageAccess` before load
  - [x] AD-3: no cross-module internal table reads; assemble via published reporting/person APIs only
  - [x] Never leak `error.message` / infra; map to `operationalCopy` / domain `messageFa`

- [x] Task 3: `export-artifact-panel` UI (AC: #4–#7, #10)
  - [x] NEW `apps/web/components/export/export-artifact-panel.tsx` (and small children if needed)
  - [x] Mount from:
    - `apps/web/components/reports/report-catalogue-panel.tsx` `exportSlot` (replace disabled stub)
    - `apps/web/components/personnel/personnel-list-panel.tsx` when `hasExportPermission`
  - [x] Panel contents per UX-DR17 / DESIGN:
    - Classification `{body-medium}`; expiry/handling `{caption}`; field scope list
    - Download `{button-secondary}`
    - Custody acknowledgement checkbox **required** before download for sensitive/bulk
    - Visible custody-boundary notice (no claim to revoke local copies)
  - [x] Reauth UX: if product requires interactive step-up beyond server reauth hook, use existing session/sensitive patterns — **server reauth is mandatory regardless of UI**; do not treat UI checkbox as reauth
  - [x] Single dialog depth (Sheet/Dialog max one); leave-guard only if local unsaved panel state (dirty ≠ dialog `open`)
  - [x] All copy in `apps/web/lib/operational-copy.ts` — remove/retire `reportExportStubHint` as the primary affordance (keep or replace with real strings); UX-DR24 voice
  - [x] Persian RTL, Persian digits for counts/dates (Jalali where dates shown)
  - [x] Interactive a11y: checkbox label associated; download disabled reason not color-only; focus order; 200% zoom readable

- [x] Task 4: Formula-safe writers + audit evidence (AC: #5–#6)
  - [x] CSV: quote fields; neutralize leading formula-control chars (OWASP/CWE-1236 — prefer tab-prefix-inside-quotes **or** leading `'` text marker consistently; document choice; selfcheck both `=` and `@` prefixes)
  - [x] XLSX via ExcelJS: set cell values as **strings/numbers only** — never formulas; no defined names / macros / external links
  - [x] Filenames/metadata: no sensitive or out-of-scope Data Elements
  - [x] Append access/export audit evidence (actor, purpose, filters, fields, volume, outcome, custody fields) using existing audit-envelope / access-event patterns — do not invent a parallel audit SoT

- [x] Task 5: Verify + DoD (AC: #1–#11)
  - [x] NEW `@divan/reporting` script e.g. `selfcheck:export-artifact` — cover:
    - generate without export permission → deny
    - sensitive column omitted without category export permission
    - reauth failure at download → deny (simulate role/scope withdraw)
    - custody ack missing on sensitive/bulk → deny
    - formula-control cell neutralized in CSV/XLSX bytes
    - expired/revoked artifact → deny
    - break-glass without exceptional export → deny (if hook reachable in selfcheck)
    - happy path: permitted generate → panel fields → ack → download → retrieval row recorded
  - [x] UPDATE `apps/web/src/server/report.selfcheck.ts` — stop asserting stub-only hint to ۶٫۵ as forever; assert real export surface / copy keys
  - [x] UPDATE personnel search selfcheck if present for `hasExportPermission`
  - [x] `pnpm --filter @divan/reporting` + `@divan/web` (+ identity-access if touched) typecheck; eslint on touched files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits
  - [x] Close sprint action_items that this story encodes: Epic 5 “Encode governed export / artifact reauth / custody / classification into Story 6.5 create-story” → **done** (resolved_in this file); Epic 2 “artifact/export reauth consumer contract for 6.5” → **done** when implementation calls the hook (mark on story completion)

### Manual DoD checklist

- [x] Report catalogue: permitted exporter sees live export affordance (not “به‌زودی”); unauthorized does not get a fake enabled button
- [x] Personnel list: `hasExportPermission` true only when entitled; exportSlot hidden/unavailable otherwise
- [x] Generated file matches on-screen filtered permitted columns only; sensitive omitted without category export
- [x] `reauthorizeForQueuedOrArtifactWork` invoked on create **and** download (prove via selfcheck or logged reason codes)
- [x] Panel shows classification, expiry, field scope; custody checkbox gates sensitive/bulk download
- [x] Download notice + recipient/destination/custody recorded; audit row present
- [x] Formula-safe: cell starting with `=` downloads as non-executing text
- [x] Copy states local-copy custody boundary; product never claims post-leave revoke
- [x] Break-glass cannot export without exceptional path
- [x] InferenceBulk / PopulationPort honesty preserved on export channel
- [x] Import Batch report honesty unchanged; migration 6.1–6.4 paths untouched except shared formula helper if extracted
- [x] No Prisma for artifact blob SQL; AD-3/AD-5 held; single dialog depth
- [x] Sprint/story may claim FR-41 + FR-52 launch substrate for wired surfaces — **not** full AR-DATA freeze or Epic 7 retention product

### Review Findings

- [x] [Review][Decision] Seed category-export entitlements for demo? — **Resolved: keep fail-closed.** Category `*.export` keys stay unseeded; sensitive columns omit without category entitlement (AC #2).
- [x] [Review][Decision] Where should export permission seed live? — **Resolved: moved to identity-access.** `seed-export.ts` under `@divan/identity-access`; removed `@divan/reporting` dependency from identity-access.

- [x] [Review][Patch] Download IDOR: assert retriever is artifact owner before bytes
- [x] [Review][Patch] get/download/revoke use provisional `export.retrieve` (+ surface soft-check)
- [x] [Review][Patch] createFromReport top-level evaluationMode/asOfDate for governedProcedure
- [x] [Review][Patch] Personnel export gated when truncated; normalizedQuery prop wired
- [x] [Review][Patch] Persist subjectIds in scope_json; download reauth uses objectIds+asOf
- [x] [Review][Patch] Formula-safe: whitespace trim + neutralize headerFa
- [x] [Review][Patch] Null content_bytes on expire/revoke/dispose
- [x] [Review][Patch] Wrap create/download/revoke/dispose writes in DB transaction
- [x] [Review][Patch] Report field categories via ReportColumnDef.dataCategory (no id heuristic)
- [x] [Review][Patch] Download access-event records filters/scope and field ids (AC #5)
- [x] [Review][Patch] Reject whitespace-only recipient + exportRecipientRequired copy
- [x] [Review][Patch] Remove unused exceljs from apps/web
- [x] [Review][Patch] CHECK constraint for destination_class
- [x] [Review][Patch] Generate in-flight guard (double-submit)

- [x] [Review][Defer] Base64-in-tRPC download with no size cap/streaming — deferred, scale concern

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Call `reauthorizeForQueuedOrArtifactWork` at generate **and** every managed retrieval | Treat UI checkbox or JWT alone as reauth |
| `action: "export"` + channel `"export"` + InferenceBulk | Bypass PopulationPort / InferenceBulk via “file download” |
| Omit sensitive fields without category export permission | Mask sensitive as zeros / include in metadata/filename |
| Formula-safe spreadsheet bytes | Emit Excel formulas / macros / external links |
| Custody ack before sensitive/bulk download; record custody transfer | Claim ability to revoke local/email copies after leave |
| Stable snapshot bound to reviewed filters | Trust client-supplied row dumps as SoT |
| Thin web; domain in `@divan/reporting`; raw SQL artifacts | Prisma for artifact storage; parallel report SoT |
| Replace 5.5/5.1 stubs with real capability signals | Leave `exportAvailable: false` forever or greenwash stub as FR-41 done without panel |

### Absolute non-goals

- Full AR-DATA / AR-REPORTING / AR-ACCESS artifact authoring (owner process) — implement **hooks + fail-closed substrate** only
- Epic 7 audit investigation surface, retention/disposal product UI, legal hold (beyond artifact revoke/dispose/expiry needed for FR-52 here)
- PopulationPort default-registry production cutover; AD-6 createPerson orphan hardening; `ensure*Schema` migrations-only move
- Person-org IDOR on Cancel/Reverse/Correct writers
- Deduplicate Add vs QuickCreate; logout → `requestNavigation`
- Rewriting migration import parser (only reuse formula-control intent)
- Inventing downstream payroll/finance API integrations — governed file export is the launch interchange surface
- Vitest mandate (selfcheck `tsx` remains house pattern)

### UPDATE files — current state → this story → preserve

| File | Current (post-6.4 / 5.5) | Change | Preserve |
| --- | --- | --- | --- |
| `apps/web/src/server/report.ts` | `exportAvailable: false` hardcoded; catalogue/run only | Real export procedures + capability flag | `assembleReportRun` pipeline; PopulationPort honesty; mapReportError |
| `apps/web/components/reports/report-catalogue-panel.tsx` | Disabled stub button + `reportExportStubHint` | Mount `export-artifact-panel` when permitted | GovernedDataTable contract; Jalali filters; soft-omit catalogue |
| `apps/web/src/server/personnel-scoped-search.ts` | `hasExportPermission: false` always | Real entitlement | Search authorize → PopulationPort → DTO pipeline |
| `apps/web/components/personnel/personnel-list-panel.tsx` | Stub exportSlot if permission (never true) | Live panel when true | List columns / leave-guard / soft-omit |
| `apps/web/lib/operational-copy.ts` | Stub hint pointing at 6.5 | Real export/custody/boundary strings | UX-DR24; import/report strings |
| `packages/modules/reporting/src/index.ts` | Dashboard + report catalogue only | Export artifact APIs | Existing dashboard/report exports; InferenceBulk reminder |
| `apps/web/src/server/report.selfcheck.ts` | Asserts stub hint mentions 6.5 | Assert live export contract | Catalogue/run smoke |
| `packages/modules/identity-access/.../entitlement-lifecycle.ts` | Hook unused by export consumers | **Call** from export paths (no semantic rewrite unless bug fix) | Fail-closed account/role/scope/population checks |
| `packages/kernel/audit-envelope` | Demo export tuples; `requiresSeparateExport` | Seed production-provisional export perms if house pattern | Read≠export; break-glass limits |
| NEW `015_export_artifacts.sql` + domain modules + panel | Absent | Full FR-41/52 substrate | Do not break `014` / reporting run |

### Consumer / export contract (encode — do not rediscover)

1. **Pipeline:** authorize (`action: "export"`) → PopulationPort ∩ InferenceBulk (`channel: "export"`) → assemble permitted snapshot → `reauthorizeForQueuedOrArtifactWork` → persist artifact → panel → custody ack (if required) → reauth again → stream bytes → retrieval evidence.
2. **Architecture home:** Export (FR-41) lives in **reporting** via audit-envelope (ARCHITECTURE-SPINE capability map) — not a new BC; migration owns import formula rejection; export owns formula-safe **emission**.
3. **View ≠ export:** Story 2.2 / FR-3 — `demo.sensitive_hr.read` does not imply export; category registry `requiresSeparateExport: true` fields need explicit export entitlement or omission.
4. **Reauth hook (Epic 2 carry — mandatory consumer):** `reauthorizeForQueuedOrArtifactWork` in `@divan/identity-access` — already supports `populationChannel: "export"`, optional `asOfDate` / `objectIds`. **This story is the first production consumer.**
5. **Break-glass:** export denied by default (`assertBreakGlassElevationLimits`); exceptional approval only — do not invent UX that bypasses.
6. **FR-52 custody boundary (normative copy):** Divan revokes managed artifacts/links; local/email/share copies follow org disposal/incident process — product MUST say so at download.
7. **FR-56:** generation completes against validated snapshot/version or fails without mixing versions.
8. **UJ-3:** Sara’s sensitive export unavailable without separate export permission; permitted export audited.
9. **5.5 handoff:** sprint MUST treat full export UX as done only when this story lands — this story closes that gate for wired surfaces.
10. **Addendum §10.1** is the acceptance oracle for formula safety, reauth, artifact metadata, revocation after role/scope change, custody acknowledgement, and local-copy limits.

### Reauth algorithm (normative for implementer)

```text
on export.create(snapshotId | filters+fields):
  authorize action=export (fail-closed)
  runGovernedRetrieval channel=export
  assemble permitted rows/fields from published APIs only
  reauth = reauthorizeForQueuedOrArtifactWork({ accountId, populationChannel: "export", ... })
  if !reauth.allowed → deny (REAUTH_FAILED)
  persist artifact state=ready with expiry, classification, field scope, snapshot hash
  audit generation

on export.download(artifactId, custodyAck?, recipient, destinationClass):
  load artifact; if expired|revoked|disposed → deny
  if sensitive|bulk and !custodyAck → CUSTODY_ACK_REQUIRED
  reauth = reauthorizeForQueuedOrArtifactWork(...)  # EVERY retrieval
  if !reauth.allowed → deny (optionally revoke managed link)
  stream formula-safe bytes
  record retrieval + custody transfer
  audit delivery
```

### Formula-safe emission (normative)

- Mirror import risk set: leading `= + - @` and tab/CR (`FORMULA_CONTROL_PREFIX` in `parse-workbook.ts`).
- On **export**, neutralize so spreadsheet apps do not execute (OWASP CSV Injection / CWE-1236). Preferred house approach for Divan launch:
  1. For CSV: wrap fields in double quotes; for cells matching formula-control prefix, prefix with tab (`\t`) inside quotes **or** apostrophe text marker — pick one, selfcheck it, document in Dev Agent Record.
  2. For XLSX: write plain values only via ExcelJS; never set `cell.formula`.
- Do not strip user data silently without audit note if neutralization changes leading character presentation — prefer reversible text treatment over deletion.
- No sensitive values in filename, sheet name, or document properties.

### Permission seeding (provisional)

| Key (recommended) | Use | Notes |
| --- | --- | --- |
| `report.export` | Catalogue/report filtered export | Code-marked; AR-ACCESS pending |
| `person.export` | Personnel list filtered export | Code-marked; may share policy with report for demo roles |
| Category-specific `*.export` | Fields with `requiresSeparateExport` | Reuse registry; omit column if missing — do not invent AR enablement |
| Existing `demo.sensitive_hr.export` | Keep for 2.2 demos | Not a substitute for production keys |

Seed via DEV_DEMO_POLICY / catalog pattern; ensure **read** meta procedures are not accidentally required for export-only keys (6.4 review lesson: action mismatch denies).

### AR honesty

- AR-DATA / AR-REPORTING / AR-ACCESS export matrices may still be pending in launch-artifacts — implement substrate + fail-closed defaults.
- Epic 5 open action: keep AR-MIGRATION / AR-ACCESS / AR-DATA / AR-REPORTING / AR-TEMPORAL **fail-closed** in Epic 6 — still applies.
- Forbidden: claiming full governed-export compliance program complete; inventing volume thresholds beyond InferenceBulk already configured; labeling fixture PopulationPort as production workforce authz.

### Known gaps to document (do not silently “fix” as done)

| Gap | Handling in 6.5 |
| --- | --- |
| PopulationPort may still be fixture-default | Preserve `populationAuthzMode` / disclosure honesty on export responses |
| InferenceBulkPort process-local window / race (Epic 2 open) | Retain fail-closed defaults; do not invent distributed window |
| Sticky break-glass + permission-set fingerprint UX debt | Out of scope; preserve deny-export default |
| AD-6 / ensure*Schema / person-create dedupe / leave-guard logout | Non-goals |
| Full retention/legal-hold product (Epic 7) | Only artifact expiry/revoke/dispose hooks here |
| Exceptional break-glass export approval UX | Deny by default; exceptional path only if already exist — do not invent policy |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Existing monorepo | Node 22 / TS 5.x / pnpm — no new framework |
| PostgreSQL | New SQL migration `015_…` |
| `pg` Pool/PoolClient | Artifact persistence |
| ExcelJS | Already used in `@divan/migration` — reuse for XLSX **write**; avoid second spreadsheet dependency |
| tRPC `governedProcedure` | All export mutations/queries |
| `@divan/identity-access` | **Must** call `reauthorizeForQueuedOrArtifactWork` |
| `@divan/audit-envelope` | AuthorizeAction `"export"`; InferenceBulk; category registry |
| Selfcheck (`tsx`) | House pattern — `selfcheck:export-artifact` |
| UI | Existing shadcn / GovernedDataTable `exportSlot` / SensitiveConfirmationDialog if confirm needed |

### File structure requirements

```text
packages/db/sql/
  015_export_artifacts.sql                    # NEW

packages/modules/reporting/src/
  export-artifact.ts                        # NEW domain
  export-artifact-repo.ts                   # NEW persistence
  formula-safe-export.ts                    # NEW CSV/XLSX writers
  export-artifact.selfcheck.ts              # NEW
  index.ts                                  # UPDATE exports
  package.json                              # UPDATE scripts

packages/modules/identity-access/src/
  entitlement-lifecycle.ts                  # CALL site only (prefer no API break)

packages/kernel/audit-envelope/src/         # UPDATE seeds/catalog if needed

apps/web/src/server/
  report.ts                                 # UPDATE + export procedures
  report.selfcheck.ts                       # UPDATE
  personnel-scoped-search.ts                # UPDATE hasExportPermission
  root.ts                                   # Register only if new router split

apps/web/components/export/
  export-artifact-panel.tsx                 # NEW

apps/web/components/reports/
  report-catalogue-panel.tsx                # UPDATE exportSlot

apps/web/components/personnel/
  personnel-list-panel.tsx                  # UPDATE exportSlot

apps/web/lib/
  operational-copy.ts                       # UPDATE Persian strings
```

### Testing requirements

- Domain selfcheck: deny matrix (no export perm, sensitive omit, reauth fail, expired, revoked, missing custody ack) + happy path + formula neutralization byte inspect.
- Web smoke: `exportAvailable` / `hasExportPermission` reflect entitlement; stub hint no longer the only export UX.
- Regression: `report.run` / catalogue still soft-omit; migration import formula reject still green; break-glass export deny demos unchanged.
- Interactive a11y DoD: checkbox name/role; download disabled state announced; focus not trapped; banner/notice not color-only.

### Previous story intelligence (6.4)

- Domain-first package + thin web router + `operational-copy` + dual-layer selfchecks + explicit deferrals — **repeat for export in `@divan/reporting`**.
- Review pitfalls to avoid repeating: action/read meta mismatch on new permissions; rubber-stamp client tokens; inventing zeros for unavailable data; UTF-8 BOM on `sprint-status.yaml`; leave-guard dirty=dialog open; English placeholders in Persian copy.
- Production gates must verify server-side state — same spirit for artifact download (never “any non-empty artifact id string” without DB state + reauth).
- Absolute non-goal from 6.4: governed export → **this story closes that deferral**.

### Previous story intelligence (5.5 / 5.1 / 2.x)

- 5.5: `exportSlot` disabled; `exportAvailable: false`; selfcheck asserted stub mentions 6.5 — **update** those asserts.
- 5.1: personnel `hasExportPermission: false` — **replace** with real check.
- 2.2: read≠export demos; `requiresSeparateExport` on categories — consume registry, do not duplicate.
- 2.4/2.6: reauth hook + optional asOf/population — **first real consumer**.
- 2.5: break-glass export deny — preserve.
- 6.1: import formula rejection + `literalizeCellValue` — **symmetric export neutralization**.

### Git intelligence summary

- Recent: `9949664` story 6.4 → `ffbb9b3` 6.3 → `783dca6` 6.2 → `7472f44` 6.1 → `7d1f33f` 5.5.
- Pattern: domain module + SQL file + thin tRPC + Persian operational copy + selfcheck scripts; stubs explicitly deferred to later stories.
- 6.5 expected touch: `015_*.sql`, reporting export domain, report/personnel routers + panels, reauth call sites, copy, seeds — **not** migration reconciliation rewrites.

### Latest tech information

- **CSV/Formula injection (OWASP / CWE-1236, still current 2025–2026):** neutralize leading `= + - @` (and control chars). Excel may strip naive quote-only mitigations on save/reopen — tab-prefix-inside-quotes is a known Excel-resistant approach; apostrophe text prefix is common but CSV round-trips vary. Pick one documented strategy and selfcheck it.
- Prefer server-side generation only — never trust browser-built CSV as authoritative artifact.
- ExcelJS: write literal values; avoid formula APIs; do not enable VBA/macros.
- No new ORM; continue `pg` + SQL files per architecture spine.
- Content-addressed snapshot hash (SHA-256 over canonical JSON of filters+fields+as-of) recommended for tamper evidence — same lesson as 6.4 reconciliation evidence hash.

### Project context reference

- No `project-context.md` in repo at story creation; follow ARCHITECTURE-SPINE **AD-2/AD-3/AD-5/AD-6**, epics Story 6.5 AC, PRD FR-3/41/52 + FR-46–48/56 + NFR-7/8, addendum §10.1, UX-DR17, Stories 5.5/6.1–6.4 handoffs, Epic 2 reauth consumer mandate, Epic 5 “encode into 6.5” action.
- Operator UI Persian; story/code/docs English per BMM config (`document_output_language: English`, `communication_language: Persian`).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6 / Story 6.5; UX-DR17; FR41/FR52]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-3, FR-33/36, FR-41, FR-42, FR-46–48, FR-50, FR-52, FR-56, NFR-7/8, UJ-3]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §10.1 Secure export, retrieval, and formula safety]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — Export via reporting + audit-envelope]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — export-artifact-panel behavior]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — export-artifact-panel tokens]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — contextual خروجی/بازیابی]
- [Source: `_bmad-output/implementation-artifacts/5-5-launch-report-catalogue.md` — stub handoff]
- [Source: `_bmad-output/implementation-artifacts/6-4-migration-reconciliation-workspace.md` — prior epic story patterns]
- [Source: `_bmad-output/implementation-artifacts/6-1-controlled-import-wizard-with-preview.md` — formula-safe import]
- [Source: `_bmad-output/implementation-artifacts/2-2-sensitive-categories-separate-export-permission.md` — read≠export]
- [Source: `_bmad-output/implementation-artifacts/2-4-entitlement-lifecycle-grant-expiry-revocation-recertification.md` — reauth hook]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — export panel / reauth consumers]
- [Source: `packages/modules/identity-access/src/entitlement-lifecycle.ts` — `reauthorizeForQueuedOrArtifactWork`]
- [Source: `packages/modules/migration/src/parse-workbook.ts` — `FORMULA_CONTROL_PREFIX` / `literalizeCellValue`]
- [Source: `apps/web/src/server/report.ts` — export stub]
- [Source: OWASP CSV Injection / CWE-1236 — formula-safe emission]

### Epic carry-ins (encode in implementation)

| Item | Handling in 6.5 |
| --- | --- |
| Epic 2: artifact/export reauth consumer mandatory | AC #3 + reauth algorithm + Task 1/2 |
| Epic 5: encode export reauth/custody/classification into 6.5 create-story | **This file** — close action when story marked done after implement |
| 5.5/5.1 export stubs | AC #10 + Task 3 |
| FR-52 import formula-safe (done 6.1) | Symmetric export writers Task 4 |
| AR fail-closed / no invented thresholds | AC #9 + Gate |
| Import Batch report never fabricate | AC #9 preserve |
| PopulationPort honesty | AC #9 + known gaps |
| BOM-safe sprint-status | Task 5 DoD |
| InferenceBulkPort ops doc / sticky BG / AD-6 | Remain open non-goals |

### Open questions (do not block story file; resolve in Dev Agent Record if product silent)

1. Exact provisional permission strings (`report.export` vs shared `person.export`) and which seeded demo roles receive them.
2. Default artifact TTL / expiry when AR-DATA silent — recommend short fail-closed TTL (e.g. hours) code-marked.
3. Whether personnel-list and report-catalogue share one artifact panel instance API or thin wrappers — prefer one `export-artifact-panel` with `source` prop.
4. CSV-only MVP vs CSV+XLSX in one PR — both acceptable if formula-safe; document if XLSX slips to immediate follow-up **only** with product OK (prefer both in-story given FR-52 spreadsheet language).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Schema choice: `reporting` (Export BC home per ARCHITECTURE-SPINE).
- Formula neutralization: tab-prefix (`\t`) inside CSV quotes; XLSX literal values via ExcelJS (never `cell.formula`).
- Provisional TTL: 4 hours (`EXPORT_ARTIFACT_TTL_MS`); custody bulk threshold: 25 rows.
- Permissions: `report.export` + `person.export` (action: export) on `identity.person`; seeded on `hr.admin`.
- Reauth injected as callback from web → `reauthorizeForQueuedOrArtifactWork`; revoke managed artifact on download reauth failure.

### Completion Notes List

- Implemented governed export substrate in `@divan/reporting` with SQL `015_export_artifacts.sql`, formula-safe CSV/XLSX writers, snapshot hash binding, reauth at create+download, custody ack gate, retrieval/lifecycle evidence, and access-event audit.
- Wired thin tRPC `export.*` router; real `exportAvailable` / `hasExportPermission` / snapshot hashes; mounted `ExportArtifactPanel` on report catalogue and personnel list.
- Selfcheck: `pnpm --filter @divan/reporting selfcheck:export-artifact` (pure + DB); web `selfcheck:report` updated for live export copy.
- Closed Epic 2 reauth consumer mandate and Epic 5 “encode into 6.5” create-story action via implementation + sprint status.

### File List

- `packages/db/sql/015_export_artifacts.sql`
- `packages/modules/reporting/src/export-errors.ts`
- `packages/modules/reporting/src/export-permissions.ts`
- `packages/modules/reporting/src/seed-export.ts`
- `packages/modules/reporting/src/formula-safe-export.ts`
- `packages/modules/reporting/src/export-artifact-repo.ts`
- `packages/modules/reporting/src/export-artifact.ts`
- `packages/modules/reporting/src/export-artifact.selfcheck.ts`
- `packages/modules/reporting/src/index.ts`
- `packages/modules/reporting/package.json`
- `packages/kernel/audit-envelope/src/index.ts`
- `packages/modules/identity-access/src/seed.ts`
- `packages/modules/identity-access/package.json`
- `apps/web/src/server/export-capability.ts`
- `apps/web/src/server/export-artifact.ts`
- `apps/web/src/server/report.ts`
- `apps/web/src/server/personnel-scoped-search.ts`
- `apps/web/src/server/root.ts`
- `apps/web/src/server/report.selfcheck.ts`
- `apps/web/lib/operational-copy.ts`
- `apps/web/components/export/export-artifact-panel.tsx`
- `apps/web/components/reports/report-catalogue-panel.tsx`
- `apps/web/components/personnel/personnel-list-panel.tsx`
- `_bmad-output/implementation-artifacts/6-5-governed-export-artifact-panel.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-26: Implemented Story 6.5 governed export artifact panel (FR-41/FR-52 substrate) — domain, SQL, tRPC, UI, selfchecks; status → review.

- 2026-07-26: Code review patches applied; status → done.
