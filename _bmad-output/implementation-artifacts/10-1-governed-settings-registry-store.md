---
baseline_commit: dc9be67
---

# Story 10.1: Governed Settings Registry & Store

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a developer of any module,
I want one typed registry and resolver for governed parameters,
so that a parameter has exactly one definition and one source of truth (FR60).

**Story key:** `10-1-governed-settings-registry-store`  
**Epic:** 10 — Administrative Settings & Governed Parameters (FR60; FR42, FR45, FR55 evidence/change-control)  
**UX contract (forward):** `ux-divan-2026-07-31` (UX-DR36 تنظیمات IA; mockup `screens-settings.html`) — **substrate only in 10.1; no nav/UI**  
**Architecture:** **AD-7** (typed registry + DB-backed store + single cached resolver; fail-closed to code default + FR45 degraded). **No AD-1…AD-6 change.**  
**Authorized by:** `sprint-change-proposal-2026-07-31` (Gap — ~60+ tunable params as constants/env with no admin surface)  
**Prerequisite:** Epics 8–9 done (primitives + IA gates + `selfcheck:design-qa`). Epic 9 retro encodes below.  
**Downstream:** **10.2** تنظیمات surface + admin-only nav; **10.3** editable wave 1; **10.4** read-only infra/security inventory; **10.5** change-control evidence.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| AD-7 rule | `ARCHITECTURE-SPINE.md` §AD-7 + Consistency «Configuration» | Binds FR-60 / FR-42 / FR-55 / FR-45; forbids raw env/literal for registered params | No code package, SQL, or resolver yet |
| Data Dictionary registry | `packages/modules/person-employment/src/data-dictionary-types.ts` + `data-dictionary.ts` | Typed registry + DB store + fail-closed enablement | Domain-specific to profile fields — **pattern**, not home for app settings |
| Catalogue `require*` | `templates.ts`, `report-catalogue.ts`, `NAV_CATALOG` | Single SoT + fail-closed unknown keys | Settings need **override store + cache + source discrimination** |
| FR45 ops health | `packages/kernel/audit-envelope/src/ops-health.ts` | `OpsHealthSectionStatus` includes `"degraded"`; ops snapshot without HR | No configuration-degraded section/hook yet — **extend**, do not invent parallel health DTO |
| Lifecycle / governance SQL | `packages/db/sql/016_data_lifecycle.sql`, `021_evaluation_snapshots.sql` | Raw SQL schemas via `pg`; migrations-only; AD-6 no Prisma in web | Next free id ≈ **`022_*.sql`**; settings schema similarly |
| Wave-1 literals (today) | migration / reporting / headcount / person-employment / identity / correction-case | Operational limits as exported constants or env | Must become **registered defaults** + resolver reads (cutover starts here; UI edit in 10.3) |
| Design-QA gate | `pnpm --filter @divan/web selfcheck:design-qa` | Orchestrates Epic 8–9 selfchecks; Settings matrix = `amendment` | **Mandatory green**; Settings row stays `amendment` until **10.2** |
| No-dead-end Settings exemption | `apps/web/lib/no-dead-end-ia.selfcheck.ts` | Asserts «تنظیمات» / `/settings` **absent** from `NAV_CATALOG` | **Preserve in 10.1** — flip only in **10.2** |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Registry vs store vs resolver** | **Registry** = typed code definitions (metadata + code default). **Store** = persisted overrides. **Resolver** = single API that returns effective value + source with cache. Never three competing SoTs. |
| **Code default vs stored override vs env** | Effective value sources: `code_default` \| `store` \| `environment` (read-only inventory path). Invalid/missing store → **code default**, never invent a fourth silent source. |
| **Admin-editable vs read-only-with-evidence** | Editability is **registry metadata**. 10.1 declares it; UI mutation is **10.3**; deployment-managed security params are **10.4** inventory — still registerable now as read-only. |
| **FR45 degraded vs ops red** | Invalid/unavailable config → fail closed to default **and** raise FR45 **degraded** (not silent OK; not fake red that blocks unrelated probes). |
| **Cached read vs request-path DB** | Resolve on request path **must not** hit DB beyond the cache. Warm/invalidate on change (and boot/warm path). |
| **«تنظیمات» nav vs registry** | Nav + tabs + rows = **10.2**. Shipping nav in 10.1 breaks no-dead-end exemption and greening rules. |
| **Wave-1 edit vs register** | 10.1 **registers** wave-1 + seeds RO metadata shape; **does not** ship edit UI, blast-radius confirm, or audit change events (10.3/10.5). |
| **Boundary widen** | No registered parameter may silently widen permission, retention, export, or audit boundaries (FR-60; Epic 9 retro; proven in 10.5 selfcheck — design registry so that is enforceable). |
| **LG-complete honesty** | Epic 7 carry-ins remain open. Settings substrate must **not** claim LG-complete / production-complete. |

## Acceptance Criteria

1. **Given** the parameters currently expressed as constants and environment variables  
   **When** the registry is implemented  
   **Then** each registered parameter declares Persian label, description, type, unit, allowed range or allowlist, default, editability, and owning domain

2. **And** a persisted store holds overrides, and a single resolver serves values with cached reads and explicit invalidation on change

3. **And** module constants for registered parameters are read through the resolver, and a lint rule or selfcheck blocks direct environment or literal reads for them

4. **When** a stored value is missing, unparsable, or out of range  
   **Then** the resolver fails closed to the registered code default and raises the FR45 degraded state rather than applying an invalid value

5. **And** resolution never blocks a request path on a database round trip beyond the cached read

6. **And** Epic 9 retro / Epic 10 Gate encodes held:
   - `pnpm --filter @divan/web selfcheck:design-qa` stays green
   - Registry/resolver fail-closed + FR45 degraded are non-negotiable
   - First-touch FeedbackMessage / FormLayout / EntityPicker apply when UI is touched (none required if 10.1 is kernel-only; encode for 10.2+)
   - Wave-1 parameter set must not be designable to widen permission / retention / export / audit boundaries
   - Settings nav remains **absent**; no-dead-end exemption preserved until 10.2
   - Matrix Settings row stays `amendment` (ownership note below — not silent pass)
   - AR-\* fail-closed; do not invent freeze numbers; do not claim LG-complete

7. **And** scope boundaries:
   - Does **not** implement «تنظیمات» nav, section tabs, or settings-row UI (**10.2**)
   - Does **not** deliver editable wave-1 apply / reset / blast-radius confirm (**10.3**)
   - Does **not** deliver read-only infra inventory export or secret redaction UI (**10.4**)
   - Does **not** deliver full change-control audit evidence productization (**10.5**) — but store schema must not block actor / before / after / reason / effect-time later
   - Does **not** change AD-1…AD-6; no event-store / temporal / authz model / headcount invariant changes

## Tasks / Subtasks

- [x] Task 1: Typed registry package + parameter definitions (AC: #1, #6, #7)
  - [x] NEW kernel package preferred: `packages/kernel/app-settings/` (name flexible: `app-settings` / `governed-settings`) as `@divan/app-settings` — **cross-cutting like audit-envelope**, not buried in one domain module
    - Rationale: modules already depend on kernel; settings must be readable from migration/reporting/headcount/identity without cross-module imports
  - [x] NEW types: `SettingsParameterDefinition` with at least:
    - `key` (stable string id, e.g. `import.max_file_bytes`)
    - `labelFa`, `descriptionFa`
    - `valueType` (`number` \| `string` \| `boolean` \| `duration_ms` \| `string_list` / allowlist — keep small closed set)
    - `unitFa` (nullable)
    - `range` and/or `allowlist`
    - `defaultValue` (code default — **the** fail-closed value)
    - `editability`: `admin_editable` \| `read_only_with_evidence`
    - `owningDomain` aligned to UX-DR36 tabs: `general_display` \| `data_retention` \| `import_export` \| `capacity_hiring` \| `access_session` \| `audit_integrity` \| `infrastructure`
    - `changePathFa` required when read-only (plain Persian path for 10.4; can be stubbed now)
    - Optional: `highImpact` / `blastRadiusFa` foreshadow for 10.3 (nullable OK)
    - Optional: `boundaryClass`: `operational` \| `security_posture` — security_posture must be `read_only_with_evidence`
  - [x] NEW `GOVERNED_SETTINGS_REGISTRY` (or `as const` + `satisfies`) listing **wave-1 editable** parameters at minimum, with honest current code defaults:

    | Key (suggested) | Current home | Default today | Domain | Editability |
    | --- | --- | --- | --- | --- |
    | `import.max_file_bytes` | `parse-workbook.ts` `IMPORT_MAX_FILE_BYTES` | 5 MiB | import_export | admin_editable |
    | `import.max_data_rows` | `IMPORT_MAX_DATA_ROWS` | 5000 | import_export | admin_editable |
    | `import.max_drafts_global` | `IMPORT_MAX_DRAFTS_GLOBAL` | 50 | import_export | admin_editable |
    | `import.max_drafts_per_actor` | `IMPORT_MAX_DRAFTS_PER_ACTOR` | 5 | import_export | admin_editable |
    | `import.draft_ttl_ms` | `IMPORT_DRAFT_TTL_MS` | 1h | import_export | admin_editable |
    | `export.artifact_ttl_ms` | `EXPORT_ARTIFACT_TTL_MS` | 4h | import_export | admin_editable |
    | `export.custody_bulk_row_threshold` | `EXPORT_CUSTODY_BULK_ROW_THRESHOLD` | 25 | import_export | admin_editable |
    | `list.personnel_max_rows` | `PERSONNEL_LIST_MAX_ROWS` | 500 | general_display | admin_editable |
    | `list.search_page_size_default` | `PERSONNEL_SEARCH_PAGE_SIZE_DEFAULT` | 50 | general_display | admin_editable |
    | `list.search_page_size_max` | `PERSONNEL_SEARCH_PAGE_SIZE_MAX` | 100 | general_display | admin_editable |
    | `headcount.reservation_expiry_warning_days` | `HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS` | 14 | capacity_hiring | admin_editable |
    | `correction.attachment_max_bytes` | correction-case provisional | 1 MiB | data_retention | admin_editable |
    | `correction.attachment_max_per_case` | provisional | 10 | data_retention | admin_editable |
    | `correction.attachment_allowlist` | provisional allowlist | see correction-case | data_retention | admin_editable |
    | `entitlement.recert_window_ms` | `DEFAULT_RECERT_WINDOW_MS` | 30d | access_session | admin_editable |

  - [x] Register **at least one** read-only-with-evidence placeholder (or small set) for 10.4 shape proof — e.g. session/LDAP posture knobs from `identity-access/src/config.ts` — **without** rendering secrets. Prefer registering non-secret effective flags only.
  - [x] `requireGovernedSettingsRegistry()` / `getSettingsParameter(key)` fail-closed on unknown keys.
  - [x] Export from package `index.ts`; wire workspace dependency in consuming packages.

- [x] Task 2: Persisted override store (AC: #2, #5, #7)
  - [x] NEW `packages/db/sql/022_governed_settings.sql` (next free number after 021):
    - Schema e.g. `app_settings` (ordinary category — **not** person health / sensitive compensation)
    - Table for overrides: `parameter_key`, `value_json` (or typed text + parse), `updated_at`, columns reserved for 10.5 attribution (`updated_by`, `reason`, `previous_value_json`, `effect_at`) — nullable OK in 10.1 if write path is internal/test-only
    - Unique on `parameter_key`; no silent multi-row winners
    - Raw SQL via `pg` Pool/PoolClient — **not Prisma** (AD-6); migrations-only — **do not** add `ensure*Schema` on request path
  - [x] NEW store repo in kernel package: load-all overrides, upsert override, delete/reset-to-default (reset can be store-delete; full audited reset product = 10.5)
  - [x] Selfcheck with ephemeral/local DB pattern used by other kernel packages (dotenv + `@divan/db`).

- [x] Task 3: Single cached resolver + FR45 degraded (AC: #2, #4, #5)
  - [x] NEW `resolver.ts`:
    - `resolveSetting<T>(key)` / `resolveSettingNumber(key)` etc. returning `{ value, source: "code_default" \| "store" \| "environment", degraded: boolean }`
    - Validate type + range/allowlist; on missing/unparsable/OOR/store-unavailable → **code default** + mark degraded
    - In-memory cache (process-local Map) of effective snapshot; **warm** from store on boot / first resolve after invalidate
    - `invalidateSettingsCache()` called after any store mutation (and exported for 10.3/10.5)
    - **Invariant:** hot resolve path uses cache only — no `await pool.query` inside `resolveSetting*` after warm
  - [x] Hook FR45: extend ops-health path so configuration degraded is visible (e.g. optional `configuration?: OpsHealthSection` on snapshot **or** fold into `service`/`dependencies` with explicit `detailFa` — prefer a dedicated optional section if cheap and keeps HR-free). Do **not** invent a second ops DTO family.
  - [x] Persian operator-facing degraded copy (direct voice; no ceremonial fluff).

- [x] Task 4: Cutover registered consumers + guard selfcheck (AC: #3, #6)
  - [x] UPDATE wave-1 constant call sites to read through resolver (keep exported names as thin wrappers that call resolver, **or** replace reads and deprecate direct constant use):
    - `packages/modules/migration/src/parse-workbook.ts`, `preview-batch.ts`
    - `packages/modules/reporting/src/export-permissions.ts` (+ consumers of TTL/threshold)
    - `packages/modules/person-employment/src/personnel-list-projector.ts`
    - `apps/web/src/server/personnel-scoped-search.ts` page-size constants
    - `packages/modules/headcount/src/headcount-reservation-expiry.ts`
    - `packages/kernel/audit-envelope/src/correction-case.ts` attachment policy defaults (careful: keep fail-closed enforce env semantics; registered path must not weaken `DIVAN_CORRECTION_CASE_ENFORCE`)
    - `packages/modules/identity-access/src/entitlement-lifecycle.ts` recert window
  - [x] NEW selfcheck (kernel and/or root): for every `admin_editable` registered key, assert no `process.env[…]` direct read and no hard-coded literal duplicate of the default in consumer modules **except** the registry definition file. Practical approach: maintain an allowlist of files that may mention defaults (registry only) + ripgrep/assert in selfcheck.
  - [x] Do **not** cut over security/authz/audit-integrity posture env vars into admin-editable — only register as read-only if included.

- [x] Task 5: Design-QA / DoD / honesty (AC: #6–#7)
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green
  - [x] Kernel settings selfcheck(s) green; typecheck touched packages
  - [x] Annotate `design-qa-mockup-matrix.md` Settings notes: **registry/store substrate landed in 10.1** — Result stays **`amendment`** until 10.2 surface
  - [x] Preserve `no-dead-end-ia.selfcheck.ts` assertion that Settings nav is absent
  - [x] Publish short **Settings amendment → product ownership** note in Dev Notes (Epic 9 retro #3) — see section below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits
  - [x] Manual DoD below

### Manual DoD checklist

- [x] Registry lists wave-1 params with FA label, description, type, unit, range/allowlist, default, editability, domain
- [x] Store round-trip: write override → invalidate → resolve returns store value; delete override → code default
- [x] Invalid override (wrong type / OOR) → code default + FR45 degraded signal (not applied)
- [x] Unavailable store (simulated) → code default + degraded; no throw that bricks unrelated request handlers
- [x] Hot `resolveSetting*` does not query DB (cache-only) after warm
- [x] At least one former literal consumer reads via resolver (import max file bytes proven)
- [x] Guard selfcheck fails if a registered key is re-introduced as a naked literal/env read outside registry
- [x] No `/settings` nav; no-dead-end still asserts Settings absent; matrix Settings = `amendment`
- [x] `selfcheck:design-qa` green
- [x] No Prisma in `apps/web`; no AD-1…AD-6 changes; no permission/retention/export/audit boundary widen in registered defaults
- [x] Sprint/story do **not** claim 10.2–10.5 done or LG-complete

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| One typed registry + one DB store + one cached resolver (AD-7) | Parallel env readers / module-local “settings helpers” that bypass resolver |
| Fail closed to **code default** on missing/invalid/unavailable | Apply invalid store values; throw away default; crash the process on bad override |
| Raise FR45 **degraded** when failing closed from bad/unavailable config | Silent OK; fake green ops health |
| Cached resolve on request path | Per-request DB round trip for settings |
| Cut over wave-1 registered consumers to resolver | Leave dual SoT (constant still authoritative while “also” in registry) |
| Lint **or** selfcheck blocking naked env/literal for registered keys | Honor-system only |
| `selfcheck:design-qa` green; Settings matrix stays `amendment` | Flip Settings to `pass` before 10.2 |
| Keep Settings **out** of `NAV_CATALOG` / no-dead-end | Ship «تنظیمات» nav “early” |
| Keep security/authz/audit-integrity/identity posture **read-only-with-evidence** | Admin-editable permission, retention policy, export custody rules, or audit-trust thresholds |
| Keep AR-\* fail-closed; no LG-complete claim | Invent AR freeze numbers; claim Epic 7 carry-ins closed |

### Settings amendment → product ownership (Epic 9 retro #3)

| Layer | Status | Implication for 10.1 |
| --- | --- | --- |
| Experience foundation (tokens, PageHeader, FormLayout, EntityPicker, GDT, FeedbackMessage, operational copy) | Delivered on Epic 8–9 surfaces | Consume on first UI touch (**10.2+**) |
| **8.10-A3 Settings amendment** | Explicitly deferred through Epic 9; matrix row `amendment` → Epic **10.1–10.2** | **10.1** closes **registry/store/resolver substrate** only |
| Settings mockup `screens-settings.html` | Target UX; not production | Do not claim mockup parity |
| no-dead-end Settings exemption | Asserts nav absent | **Preserve**; **10.2** flips exemption and must satisfy no-dead-end for real settings content |
| Residual UX debt | FeedbackMessage long-tail, typography hotspots | Adopt primitives when touching panels; do not expand unrelated hotspots |
| Production / LG honesty | Epic 7 SoD, list IDOR, AD-6, Baseline projector, PopulationPort, etc. still open | Settings must not imply LG-complete |

**Verdict:** Settings is now **product-owned by Epic 10**. 10.1 delivers the AD-7 substrate; 10.2 is the first user-visible ownership flip. Until 10.2 ships, the design-qa matrix Result for Settings remains `amendment` — never silent `pass`.

### Absolute non-goals

- «تنظیمات» sidebar entry, role-split tabs, settings-row UI, deep-link tab routing → **10.2** (encode 9.5/9.7 hydrate lessons there)
- Inline edit, reason field UX, blast-radius confirm, «بازگشت به پیش‌فرض» UI → **10.3**
- Full read-only infra inventory + FR52 evidence export of inventory → **10.4**
- Full FR42 change evidence productization + audit-surface parity + boundary selfcheck product → **10.5** (schema foreshadow only)
- Widening or editing permission sets, retention holds, export custody policy, audit-trust thresholds, LDAP secrets
- PopulationPort cutover; AD-6 Prisma↔PoolClient; Baseline projector; InferenceBulkPort ops doc; SoD PermissionSet split; list/mutation IDOR; Vitest mandate; person-create dedupe; logout leave-guard
- Playwright / axe harnesses unless PO expands scope
- New GitHub Actions CI — design-qa remains local/selfcheck surrogate (do not claim “CI gate”)

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| *(none — package NEW)* | No settings kernel | Add `@divan/app-settings` (or chosen name) | Kernel boundary: no web Prisma; modules→kernel only |
| `packages/db/sql/022_*.sql` | Missing | Override store schema | Migrations-only; no ensure* on request path |
| `ops-health.ts` (+ web operations if needed) | No configuration degraded section | Surface config degraded | Zero HR content; existing section semantics |
| Wave-1 constant modules (table in Task 1) | Literals / env | Resolver-backed effective values | Fail-closed behavior; Persian error copy; provisional AR honesty |
| `correction-case.ts` attachment policy | env + provisional defaults | Registry defaults via resolver | `DIVAN_CORRECTION_CASE_ENFORCE` fail-closed; no secret leak |
| `design-qa-mockup-matrix.md` | Settings `amendment` → 10.1–10.2 | Note substrate landed | Result remains `amendment` |
| `no-dead-end-ia.selfcheck.ts` | Forbids Settings nav | **No change** (keep forbid) | Length/NAV asserts |
| `ARCHITECTURE-SPINE.md` | AD-7 adopted | Optional implementation pointer only | No AD-1…AD-6 edits |

### Algorithm (implement literally)

1. **Boot / warm:** load all store overrides once → validate each against registry → build `Map<key, EffectiveValue>`; invalid entries skipped (default used) + set `configurationDegraded=true` with reason keys.
2. **Resolve(key):** lookup registry (unknown → throw fail-closed). Return cached effective value. **No DB.**
3. **Invalidate:** after store upsert/delete → re-warm (or patch cache entry) under a single mutex/async queue so concurrent resolves never see half-applied maps.
4. **Consumer read:** `resolveSettingNumber("import.max_file_bytes").value` (or thin wrapper `importMaxFileBytes()` that only calls resolver).
5. **Guard selfcheck:** enumerate registry keys → ripgrep consumers for naked duplicates / `process.env` aliases on allowlisted env names tied to those keys → fail if found outside registry + store + resolver files.
6. **Ops degraded:** if any fail-closed-from-invalid occurred since last warm **or** store warm failed → ops snapshot shows degraded for configuration (HR-free detailFa).

### Architecture compliance

- **AD-7:** registry + store + resolver; no raw env/literal for registered params; fail-closed default + FR45; security posture read-only; no AD-1…AD-6 change.
- **AD-3:** new capability in `packages/kernel/*`; modules consume published API; web stays thin (no settings UI in 10.1; if a debug read procedure is added, use `governedProcedure` — prefer deferring HTTP API to 10.2).
- **AD-6:** raw SQL + `pg` for settings store; **no Prisma** for this substrate; no Prisma in `apps/web`.
- **Consistency — Configuration:** only resolver reads.

### Library / framework requirements

- TypeScript + existing monorepo tooling (`tsx` selfchecks, `tsc`, `pnpm` workspaces)
- `pg` for store (same as audit-envelope / event-store)
- Prefer `as const` + `satisfies` for registry type-safety (literal keys)
- **Do not** add Zod/convict/node-config as a parallel configuration framework unless already in repo — keep Divan-owned registry
- Cache = process-local memory (single MVP process per AD-1); no Redis

### File structure requirements

```
packages/kernel/app-settings/          # NEW (preferred name)
  package.json                         # @divan/app-settings
  src/registry.ts                      # definitions + require*
  src/types.ts
  src/store.ts                         # pg override repo
  src/resolver.ts                      # cache + resolve + invalidate
  src/ops-configuration-health.ts      # optional FR45 helper
  src/*.selfcheck.ts
  src/index.ts
packages/db/sql/022_governed_settings.sql
# UPDATE consumers listed in Task 4
# NO apps/web/app/(app)/settings/** in this story
```

### Testing requirements

- Kernel selfcheck: registry completeness (wave-1 keys present); resolve default; override; invalid→default+degraded; cache no-DB after warm; unknown key fails
- Guard selfcheck: naked literal/env ban for registered keys
- Existing consumer selfchecks remain green after cutover (import-preview, export, headcount-override, etc.)
- `pnpm --filter @divan/web selfcheck:design-qa` green
- Prefer Vitest/ephemeral when convenient — **not** a gate to invent a new harness mid-story (Epic carry-in remains open)

### Previous story / epic intelligence

- **Epic 9 closed** operational IA; Settings deliberately stayed amendment — do not regress that honesty.
- **Epic 9 retro #2** is this story’s Gate checklist (design-qa, fail-closed+FR45, primitives baton, no boundary widen, no-dead-end flip only with nav).
- **Winston:** “Registry fail-closed is non-negotiable for 10.1.”
- **John:** Wave 1 must not widen security boundaries — encode in registry `editability` + `boundaryClass`.
- Dual-layer selfcheck pattern from Epic 7 (kernel pure + DB + optional web) fits this substrate.
- Data Dictionary is the closest governed registry+store pattern — copy **discipline**, not the Person/EAV model.

### Git intelligence summary

Recent commits: `dc9be67` epic 9 retro → `f7559b9` 9.10 → `b9760ae` 9.9 → … Epic 9 presentation/IA. Baseline for this story: **`dc9be67`**. No settings code landed yet — greenfield substrate on a mature kernel pattern.

### Latest tech information

- Prefer typed `as const`/`satisfies` registries for literal key unions (compile-time SoT).
- Process-local cache matches AD-1 single-process MVP; invalidate explicitly on write.
- Fail-closed + degraded observability > crash-on-bad-config for operator-tunable overrides.
- Do not bolt on generic “config server” libraries; AD-7 is the product contract.

### Project context reference

- No `project-context.md` in repo — follow `ARCHITECTURE-SPINE.md` (AD-7), `epics.md` Epic 10, `prd.md` FR-60/FR-45, `ux-divan-2026-07-31`, and this story file.
- Open Epic 7/8/9 production-honesty items remain **out of scope** but must stay visible in Gates (no silent “done”).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 10 / Story 10.1]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-60, FR-45, FR-42]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-7]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — Settings gap]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/` — UX-DR36, settings-row]
- [Source: `_bmad-output/implementation-artifacts/epic-9-retro-2026-08-03.md` — encodes #2/#3/#9]
- [Source: `packages/kernel/audit-envelope/src/ops-health.ts` — FR45 degraded]
- [Source: `packages/modules/person-employment/src/data-dictionary*.ts` — registry+store pattern]
- [Source: `apps/web/lib/design-qa-mockup-matrix.md` — Settings amendment]
- [Source: `apps/web/lib/no-dead-end-ia.selfcheck.ts` — Settings nav forbid]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- `pnpm --filter @divan/app-settings selfcheck` — pure + DB gates (override / invalid→default+degraded / cache-only / store unavailable)
- `pnpm --filter @divan/app-settings selfcheck:guard` — banned pre-cutover assignment fingerprints
- `pnpm db:sql:apply` — `022_governed_settings.sql` applied
- Consumer selfchecks: import-preview, headcount-override, correction-case, export-artifact
- `pnpm --filter @divan/web selfcheck:design-qa` + `selfcheck:no-dead-end-ia` green
- Typecheck: app-settings, migration, reporting, headcount, person-employment, identity-access, audit-envelope, web

### Completion Notes List

- Delivered `@divan/app-settings` AD-7 substrate: typed registry (15 admin_editable wave-1 + 3 read_only_with_evidence posture placeholders), `app_settings.parameter_override` store, process-local cached resolver with fail-closed code defaults + FR45 `configuration` ops section.
- Cut over wave-1 consumers to resolver-backed thin wrappers (same exported names as functions). Correction-case keeps `DIVAN_CORRECTION_CASE_ENFORCE` fail-closed; defaults come from registry when not enforcing.
- Settings matrix row remains `amendment` (substrate landed note); Settings nav still absent; no 10.2–10.5 / LG-complete claims.
- Guard selfcheck blocks reintroduction of pre-10.1 naked `export const X = …` assignments outside the settings package.

### File List

- apps/web/instrumentation.ts
- packages/kernel/app-settings/package.json
- packages/kernel/app-settings/tsconfig.json
- packages/kernel/app-settings/src/types.ts
- packages/kernel/app-settings/src/registry.ts
- packages/kernel/app-settings/src/store.ts
- packages/kernel/app-settings/src/resolver.ts
- packages/kernel/app-settings/src/ops-configuration-health.ts
- packages/kernel/app-settings/src/index.ts
- packages/kernel/app-settings/src/app-settings.selfcheck.ts
- packages/kernel/app-settings/src/governed-settings-guard.selfcheck.ts
- packages/db/sql/022_governed_settings.sql
- packages/kernel/audit-envelope/package.json
- packages/kernel/audit-envelope/src/correction-case.ts
- packages/kernel/audit-envelope/src/ops-health.ts
- packages/modules/migration/package.json
- packages/modules/migration/src/parse-workbook.ts
- packages/modules/migration/src/preview-batch.ts
- packages/modules/reporting/package.json
- packages/modules/reporting/src/export-permissions.ts
- packages/modules/reporting/src/export-artifact.ts
- packages/modules/reporting/src/dashboard-snapshot.ts
- packages/modules/headcount/package.json
- packages/modules/headcount/src/headcount-reservation-expiry.ts
- packages/modules/headcount/src/headcount-override.selfcheck.ts
- packages/modules/person-employment/package.json
- packages/modules/person-employment/src/personnel-list-projector.ts
- packages/modules/identity-access/package.json
- packages/modules/identity-access/src/entitlement-lifecycle.ts
- apps/web/package.json
- apps/web/src/server/migration.ts
- apps/web/src/server/personnel-scoped-search.ts
- apps/web/src/server/operations.ts
- apps/web/components/correction-cases/correction-cases-panel.tsx
- apps/web/lib/design-qa-mockup-matrix.md
- pnpm-lock.yaml
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/10-1-governed-settings-registry-store.md

### Change Log

- 2026-08-03: Implemented Story 10.1 governed settings registry/store/resolver substrate; cut over wave-1 consumers; FR45 configuration section; design-qa amendment note preserved.
- 2026-08-03: Code review patches — boot warm instrumentation; not-warmed degraded; ops configuration panel; RO custody lock; store RO reject + auto-invalidate; correction env/client SoT; guard coverage; empty allowlist deny-all.

### Review Findings

- [x] [Review][Defer] `source: "environment"` / cutover پارامترهای RO نشست و هویت — deferred: شکل ۱۰.۴ کافی است؛ تبعیض env و inventory در ۱۰.۴ (پیشنهاد تخصصی Applied)
- [x] [Review][Patch] `export.custody_bulk_row_threshold` را `read_only_with_evidence` کن (max بازِ ۱۰۰۰۰ مرز حضانت را شل می‌کند) [packages/kernel/app-settings/src/registry.ts:121-136]

- [x] [Review][Patch] کش تنظیمات فقط در ops health گرم می‌شود؛ resolve قبل از warm بدون degraded به code_default برمی‌گردد و ops «گرم‌نشده» را `ok` می‌نویسد [packages/kernel/app-settings/src/resolver.ts:235-243] [packages/kernel/app-settings/src/ops-configuration-health.ts:29-34] [apps/web/src/server/operations.ts:329-337]
- [x] [Review][Patch] پنل ops بخش `configuration` را رندر نمی‌کند؛ سیگنال FR45 به اپراتور نمی‌رسد [apps/web/components/operations/operations-health-panel.tsx:268-293]
- [x] [Review][Patch] `string_list` خالی معتبر شمرده می‌شود و `defaultAllowlistFromRegistry` به full provisional MIME سقوط می‌کند (deny→allow) [packages/kernel/app-settings/src/resolver.ts:96-114] [packages/kernel/audit-envelope/src/correction-case.ts:317-327]
- [x] [Review][Patch] `upsertOverride`/`applyValidatedOverrides` کلیدهای `read_only_with_evidence` / `security_posture` را رد نمی‌کنند [packages/kernel/app-settings/src/store.ts:44-77] [packages/kernel/app-settings/src/resolver.ts:132-157]
- [x] [Review][Patch] کلاینت correction سقف را با `getCodeDefault` می‌گیرد؛ با effective سرور منحرف می‌شود [apps/web/components/correction-cases/correction-cases-panel.tsx:108-110]
- [x] [Review][Patch] غیر از مسیر ENFORCE، envهای `DIVAN_CORRECTION_CASE_*` هنوز بر registry مقدم‌اند (SoT دوگانه برای پارامترهای ثبت‌شده) [packages/kernel/audit-envelope/src/correction-case.ts:422-453]
- [x] [Review][Patch] `upsertOverride`/`deleteOverride` بعد از mutation کش را invalidate/re-warm نمی‌کنند [packages/kernel/app-settings/src/store.ts:44-93]
- [x] [Review][Patch] Guard AC#3 ناقص: بدون assert env، بدون `correction.attachment_allowlist`، بدون enumerate همهٔ admin keys [packages/kernel/app-settings/src/governed-settings-guard.selfcheck.ts:24-81]
- [x] [Review][Patch] override عددی finite ولی غیرصحیح پذیرفته می‌شود [packages/kernel/app-settings/src/resolver.ts:68-78]
- [x] [Review][Patch] `JSON.stringify(NaN|Infinity)` در upsert به null تبدیل می‌شود [packages/kernel/app-settings/src/store.ts:68-74]
- [x] [Review][Patch] پیام خطای ورود وقتی حد < 1MiB باشد «۰ مگابایت» نشان می‌دهد [packages/modules/migration/src/parse-workbook.ts:140-145]

- [x] [Review][Defer] `effect_at` در warm/resolve اعمال نمی‌شود [packages/kernel/app-settings/src/resolver.ts:132-157] — deferred, pre-existing: AC#7 foreshadow برای ۱۰.۵
- [x] [Review][Defer] سقف Zod ورود روی max رجیستری (۵۰MiB) نه مقدار مؤثر [apps/web/src/server/migration.ts:81-84] — deferred, pre-existing: tradeoff آگاهانه؛ runtime هنوز `IMPORT_MAX_FILE_BYTES()` را enforce می‌کند
- [x] [Review][Defer] selfcheck در نبود DATABASE_URL/جدول با exit 0 رد می‌شود [packages/kernel/app-settings/src/app-settings.selfcheck.ts:116-133] — deferred, pre-existing: الگوی مشترک selfcheckهای kernel بدون DB
