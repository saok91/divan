---
baseline_commit: 18b84f3
---

# Story 10.4: Read-Only Inventory of Infrastructure & Security Parameters

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a system administrator or auditor,
I want to see the deployment-managed settings without being able to change them here,
so that the real configuration is visible without weakening its change control (FR60, FR42, FR45).

**Story key:** `10-4-readonly-infrastructure-security-inventory`  
**Epic:** 10 — Administrative Settings & Governed Parameters (FR60; FR42, FR45, FR52, FR55)  
**UX contract:** `ux-divan-2026-07-31` (UX-DR36; EXPERIENCE §Configuration Administration; DESIGN `settings-row` readonly-pattern; mockup `screens-settings.html`)  
**Architecture:** **AD-7** (typed registry + cached resolver; security/identity/audit-integrity posture remain deployment-managed and read-only in UI; no AD-1…AD-6 change). Web stays thin.  
**Authorized by:** `sprint-change-proposal-2026-07-31` (Gap E10 — RO inventory)  
**Prerequisite:** Stories **10.1** (registry/store/resolver), **10.2** (Settings surface + `settings.read`), **10.3** (wave-1 editable apply/reset) done.  
**Downstream:** **10.5** full FR42 change-control evidence productization + FR51 audit fail-safe + boundary selfcheck suite.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| RO registry placeholders | `packages/kernel/app-settings/src/registry.ts` | `session.*`, `identity.provider_mode`, custody RO with `changePathFa` + `security_posture` | Missing epic inventory families (LDAP posture non-secret, audit-envelope, inference/bulk, audit-trust, pool, baseline); no env binding metadata |
| Resolver sources | `resolver.ts` | Emits only `code_default` \| `store`; never `environment` | Must emit `environment` when env-backed RO value is present and valid |
| UI source label | `settings-parameter-row.tsx` + `operational-copy.ts` | Already labels `environment` | Dead label until resolver produces it |
| Identity env readers | `identity-access/src/config.ts` | `getIdentityProvider` / `getSessionTimeoutConfig` / `getLdapConfig` read `process.env` | Session + provider_mode must cut over to resolver for registered keys; LDAP **secrets** stay out of inventory |
| Inference/bulk hooks | `audit-envelope/src/inference-bulk.ts` | `loadInferenceBulkHooks` from `AUDIT_INFERENCE_BULK_ENABLED` + DEMO/DISABLED presets | Surface effective non-secret thresholds as RO inventory; do not invent AR-ACCESS freeze numbers |
| Audit-trust knobs | `audit-envelope/src/audit-trust.ts` `loadAuditTrustProvisionalConfig` | `DIVAN_AUDIT_TRUST_*` env + provisional defaults | Register RO keys for enforce/skew/window/ttl effective values |
| PG pool max | `packages/db/src/index.ts` `defaultPoolMax` | `DIVAN_PG_POOL_MAX` or prod/dev defaults | Register RO infra key; cut over read path if practical without breaking pool bootstrap |
| Baseline boundary | `person-employment/src/baseline-boundary.ts` | `DIVAN_BASELINE_BOUNDARY_DATE` | Register RO key; show unset honestly (null ≠ fake epoch) |
| Settings surface | `apps/web` settings tabs + `settings.ts` | Role-split list/apply/reset; RO lock + path | Full inventory rows; export + view-audit; `audit_integrity` tab appears when keys exist |
| FR52 export lifecycle | `reporting/src/export-artifact.ts` + `apps/web/src/server/export-artifact.ts` | create/download/expiry/revoke/custody/reauth | **Reuse** for settings inventory evidence — no parallel artifact SoT |
| Soft deny / access events | `settings.ts` `appendSettingsAccessEvent` | Read/write deny+allow | Extend for security-relevant **view** + inventory export |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Inventory vs editable wave** | 10.4 is **read-only**. Never call `upsertOverride` / `deleteOverride` for inventory keys. Wave-1 editors stay for `admin_editable` only. |
| **`source: environment` honesty** | UI already has the label. Resolver **must** emit `environment` when the effective value came from a bound env var. If env absent → `code_default` (or honest «پیکربندی نشده» for nullable baseline). Do not fake `environment` for pure code constants. |
| **LDAP posture vs LDAP secrets** | Inventory may show non-secret posture (provider mode, ldap configured yes/no, scheme ldap/ldaps, `tlsRejectUnauthorized`, connect timeout, whether create-mapping is empty). **Never** render `LDAP_BIND_PASSWORD`, bind DN if treated as credential-bearing, TLS CA PEM (full/partial), `DATABASE_URL`, or any connection string. Prefer booleans / enums over raw sensitive strings. |
| **Cutover vs dual SoT** | For every **registered** RO key, modules must not keep an independent naked `process.env` read that can diverge from the resolver. Identity session/provider_mode → `resolveSetting*`. Unregistered secrets (bind password, etc.) may remain in `getLdapConfig` and **must not** be registered. |
| **Pool bootstrap chicken-egg** | `getSharedPgPool` needs `DATABASE_URL` before settings warm. Inventory shows **pool max** (`DIVAN_PG_POOL_MAX`), never the connection string. Pool creation may still read env for bootstrap; document that `DATABASE_URL` is deliberately **not** an inventory row. |
| **Category paths** | Audit-envelope categories live in code (`categories.ts`). Inventory shows **code-sourced** posture (e.g. category id list count / sensitive-path flags / policy fixture mode) with `source: code_default` and change path «فقط با استقرار/انتشار کد…». Do not invent a parallel category editor. |
| **FR52 export vs FR42 investigation** | Export inventory as an artifact under existing lifecycle (owner, purpose, classification, expiry, reauth, custody). Do **not** claim 10.5 investigation-surface parity or FR51 fail-safe productization. |
| **View audit** | Viewing security-relevant inventory (list of `security_posture` / technical domains, or export) appends an access event. Ordinary wave-1 business domain list behavior from 10.2/10.3 stays; do not spam audit on every harmless general_display poll if unchanged — gate on security-relevant scopes. |
| **Empty-tab omit** | Registering `audit_integrity` keys makes the tab appear for `system_admin` automatically via `domainHasRegistryKeys`. Do not add placeholder chrome without keys. |
| **LG-complete honesty** | Epic 7/8/9 carry-ins remain open. Do not claim LG-complete or 10.5 done. |

## Acceptance Criteria

1. **Given** parameters sourced from environment or code that must stay deployment-managed  
   **When** the read-only inventory is delivered  
   **Then** the following families are listed with current **effective** value and **source** (`environment` \| `code_default`; never pretend `store` for RO posture):  
   - identity and LDAP **posture** (non-secret)  
   - session timeouts (`session.idle_timeout_seconds`, `session.absolute_timeout_seconds`)  
   - audit-envelope policy / category-path posture (code-sourced inventory rows)  
   - inference and bulk thresholds (effective hooks: enabled + numeric DEMO/DISABLED posture)  
   - audit-trust thresholds (`DIVAN_AUDIT_TRUST_*` effective knobs)  
   - pool size (`DIVAN_PG_POOL_MAX` / effective max)  
   - baseline boundary (`DIVAN_BASELINE_BOUNDARY_DATE` or honest unset)

2. **And** each RO row states its real change path in plain Persian (registry `changePathFa`), e.g. «فقط با استقرار قابل تغییر است.» / infra env update + restart — **never** a disabled input that implies a missing permission (UX-DR36 / DESIGN readonly-pattern: lock glyph + plain value on `surface-subtle`)

3. **And** no secret, credential, or connection string is rendered, in full or in part (UI, API DTO, export artifact payload, access-event payload). Selfcheck proves banned keys/patterns are absent from inventory serialization

4. **And** the inventory is exportable as evidence under the **FR52** artifact lifecycle (reuse `createExportArtifact` / existing export router patterns — custody, expiry, reauth, classification — no parallel download SoT)

5. **And** viewing the inventory is itself audited where values are security-relevant (access event on security-relevant list and/or export; soft-deny still audited)

6. **And** Epic 9 / Epic 10 Gate encodes held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - First-touch: **FeedbackMessage** for export/load errors; FormLayout only if a form appears (export confirm/custody ack if needed); EntityPicker only if entity-valued control appears (expect none)
   - Registry/resolver fail-closed + FR45 configuration degraded unchanged
   - Must not widen permission / retention / export / audit boundaries; RO keys remain non-mutable via settings mutations
   - Settings no-dead-end: inventory + export are functional, not placeholders
   - AR-\* fail-closed; no LG-complete claim

7. **And** scope boundaries:
   - Does **not** deliver 10.5 FR42 investigation deep-link productization, FR51 audit-required fail-safe, or final boundary selfcheck suite (may add **minimal** inventory/export/secret-redaction selfchecks)
   - Does **not** make custody / session / identity / LDAP / audit-trust / inference / pool / baseline admin-editable
   - Does **not** change AD-1…AD-6; no event-store / temporal / authz model / headcount invariant changes
   - Does **not** invent SoD approve≠manage splits (AR-ACCESS open)
   - Does **not** render or export `DATABASE_URL`, LDAP bind password, TLS CA material, or partial secrets

## Tasks / Subtasks

- [x] Task 1: Registry inventory expansion + env bindings (AC: #1, #2, #3, #6)
  - [x] UPDATE `registry.ts`: add `read_only_with_evidence` + `security_posture` (or justified `operational` only when not security) keys for epic families — each with non-empty `changePathFa`, Persian label/description, type/unit/range/default matching **existing** code defaults (do not invent new operational envelopes)
  - [x] Add explicit env-binding metadata (preferred: optional `envKey` / `envBinder` on definition **or** a colocated `ENV_BINDINGS` map in app-settings). Bindings for existing keys:
    - `session.idle_timeout_seconds` ← `AUTH_SESSION_IDLE_TIMEOUT_SECONDS`
    - `session.absolute_timeout_seconds` ← `AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS`
    - `identity.provider_mode` ← `IDENTITY_PROVIDER`
  - [x] Suggested new keys (names may be adjusted if a clearer convention already exists — keep dotted lowercase):

    | Key | Domain | Env / source | Notes |
    | --- | --- | --- | --- |
    | `identity.ldap_configured` | infrastructure | derived from required LDAP env presence | boolean; **no** URL/DN/password |
    | `identity.ldap_url_scheme` | infrastructure | parse scheme only from `LDAP_URL` when configured | allowlist `ldap` \| `ldaps` \| `unset` |
    | `identity.ldap_tls_reject_unauthorized` | infrastructure | `LDAP_TLS_REJECT_UNAUTHORIZED` | boolean effective |
    | `identity.ldap_connect_timeout_ms` | infrastructure | `LDAP_CONNECT_TIMEOUT_MS` | number |
    | `identity.ldap_create_mapping_mode` | infrastructure | empty vs non-empty `LDAP_CREATE_MAPPING_JSON` | e.g. `forbidden` \| `mapped` — never dump map contents if it embeds directory ids that are sensitive; prefer mode enum |
    | `audit.inference_bulk_enabled` | audit_integrity | `AUDIT_INFERENCE_BULK_ENABLED` + NODE_ENV rule | boolean effective |
    | `audit.inference_bulk_min_cohort` | audit_integrity | effective hooks | number (DEMO/DISABLED posture) |
    | `audit.inference_bulk_max_volume_per_request` | audit_integrity | effective hooks | number |
    | `audit.inference_bulk_max_volume_per_window` | audit_integrity | effective hooks | number |
    | `audit.trust_enforce` | audit_integrity | `DIVAN_AUDIT_TRUST_ENFORCE` | boolean |
    | `audit.trust_max_clock_skew_ms` | audit_integrity | effective | number |
    | `audit.trust_verification_window_hours` | audit_integrity | effective | number |
    | `audit.trust_suspend_ttl_ms` | audit_integrity | effective; allow honest `none` representation | number or string per type system — prefer number + sentinel descriptionFa for null TTL |
    | `audit.envelope_category_count` | audit_integrity | code | count of registered categories — code_default |
    | `infra.pg_pool_max` | infrastructure | `DIVAN_PG_POOL_MAX` | number; default matches `defaultPoolMax()` honesty |
    | `infra.baseline_boundary_date` | infrastructure | `DIVAN_BASELINE_BOUNDARY_DATE` | string date-only or empty/`unset` — never invent epoch |

  - [x] Keep `export.custody_bulk_row_threshold` RO (unchanged editability)
  - [x] Extend `requireGovernedSettingsRegistry` / selfcheck: every new RO has `changePathFa`; every `security_posture` is RO; banned secret env names never appear as `defaultValue` or allowlist entries

- [x] Task 2: Resolver `environment` producer + warm cutover (AC: #1, #6)
  - [x] UPDATE `warmSettingsCache` / apply path: after seeding code defaults (and applying store overrides for `admin_editable` only), overlay env-bound RO keys when env present and parses valid → `source: "environment"`; invalid env → fail closed to code default + degraded key (FR45)
  - [x] Hot `resolveSetting*` remains sync/cache-only (no DB; env overlay happens at warm, not per-request `process.env` thrash — capture at warm time)
  - [x] Extend app-settings selfcheck: with stub env, `resolveSetting("session.idle_timeout_seconds").source === "environment"` and value matches; without env → `code_default`; store row for RO key still ignored (existing store reject path)
  - [x] Keep `selfcheck:guard` green (no naked literals for registered admin keys in consumers)

- [x] Task 3: Module cutover for registered RO keys (AC: #1, #6, #7)
  - [x] UPDATE `identity-access/src/config.ts`: `getSessionTimeoutConfig` and `getIdentityProvider` read effective values via `@divan/app-settings` `resolveSetting*` (after warm). Preserve fail-closed semantics (unknown provider → null; no silent seeded fallback when misconfigured)
  - [x] Leave `getLdapConfig` secret fields on env — **do not** register secrets. Optional: derive posture booleans for registry binders from the same parse helpers without returning secrets to web
  - [x] Inference/bulk + audit-trust: inventory reads effective values through binders that call existing `getInferenceBulkHooks` / `loadAuditTrustProvisionalConfig` at warm (or pure functions of env snapshot). Prefer **not** breaking runtime hook loading; dual-read only if binder and runtime share one function
  - [x] Baseline: binder uses `getBaselineBoundaryDate` semantics (unset → honest empty; invalid → degraded/fail-closed per existing throw policy — surface as degraded inventory, do not leak parse internals)
  - [x] Pool max: binder mirrors `defaultPoolMax()` rules; do not require pool to exist to show the number

- [x] Task 4: Secret redaction contract (AC: #3, #6)
  - [x] NEW (kernel) serialization helper e.g. `serializeSettingsInventoryValue(def, value) → safe scalar` used by list DTO + export builder
  - [x] Hard deny list (assert in selfcheck): substrings/keys matching password, secret, token, connection string, `DATABASE_URL`, `LDAP_BIND_PASSWORD`, `LDAP_TLS_CA`, private key PEM headers, etc.
  - [x] Access-event payloads for view/export must store parameter **keys** + safe values only (or omit values and store key set hash) — never raw secrets
  - [x] If a future registry mistake adds a secret-shaped key, resolver/UI must refuse to emit it (fail closed)

- [x] Task 5: tRPC inventory view audit + FR52 export (AC: #4, #5, #6, #7)
  - [x] UPDATE `apps/web/src/server/settings.ts`:
    - On `listByDomain` for domains that include any `security_posture` / technical inventory keys (`access_session` session RO, `audit_integrity`, `infrastructure`), append allow access event `settings.inventory.view` (dedupe: once per request is enough; do not require per-row events)
    - NEW `exportInventory` mutation (name flexible): builds redacted inventory snapshot for caller-visible domains only; calls reporting `createExportArtifact` (or thin wrapper) with purpose like `settings.inventory`, classification **internal** (not HR-sensitive content — still custody/reauth per FR52), TTL from existing export settings resolver key
  - [x] Authz: `settings.read` + soft PS + role domain matrix; export also needs existing export permission pattern used by 6.5 (`reauthorizeForQueuedOrArtifactWork` on create+download). Prefer compose export router helpers rather than cloning lifecycle
  - [x] `hr_admin` must not receive `system_admin`-only technical rows (existing domain matrix). Export contents = intersection of registry inventory × visible domains
  - [x] Apply/reset must still FORBIDDEN for all new RO keys (extend mutation selfcheck)

- [x] Task 6: UI — inventory completeness + export affordance (AC: #1, #2, #4, #6)
  - [x] Confirm RO rendering path unchanged: lock + `changePathFa` + plain value; source chip shows محیط / پیش‌فرض کد correctly when resolver emits `environment`
  - [x] When `audit_integrity` keys exist, tab visible for `system_admin`; section copy may use mockup tone «کنترل‌شده در زیرساخت» via `operational-copy.ts` if missing
  - [x] Add export CTA (RowActionButton or panel action) on technical settings — FeedbackMessage for success (download/custody notice) and errors; leave-guard N/A unless a confirm form is dirty
  - [x] No disabled fake inputs; no dead «مشاهده در ممیزی» deep-link (10.5)
  - [x] UPDATE `design-qa-mockup-matrix.md` Settings note: RO inventory + export delivered (not mockup-pixel-perfect / not 10.5)

- [x] Task 7: Selfchecks + design-qa + DoD (AC: #3, #6, #7)
  - [x] Kernel: environment source cases; secret denial; RO still non-upsertable
  - [x] Web: inventory view audit fired for technical domain; export path wired; mutation RO reject still green; settings-ia / no-dead-end still green
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green; typecheck touched packages
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits
  - [x] Manual DoD below

### Manual DoD checklist

- [x] `system_admin` sees session timeouts, identity/LDAP posture (non-secret), audit_integrity rows, pool max, baseline boundary with effective values
- [x] With `AUTH_SESSION_IDLE_TIMEOUT_SECONDS` set, row shows that value and `source` label محیط (`environment`)
- [x] Without that env, row shows code default and پیش‌فرض کد
- [x] LDAP bind password / DATABASE_URL never appear in UI, network payload, or export file
- [x] RO rows: lock + Persian change path; no greyed input
- [x] `hr_admin` cannot open `audit_integrity` / `infrastructure` inventory (role matrix)
- [x] Export inventory succeeds under FR52 (artifact created; download requires custody/reauth as existing export rules dictate)
- [x] Viewing technical inventory produces an access event; deny paths still soft-deny
- [x] `settings.applyParameter` / `reset` still reject all inventory RO keys
- [x] Identity session timeouts in runtime match resolver after warm (no dual SoT drift)
- [x] `selfcheck:design-qa` green; no LG-complete / 10.5 claims

### Review Findings

- [x] [Review][Decision] Security inventory view-audit soft-fail — resolved: **fail-closed** for technical domains (AC #5).
- [x] [Review][Decision] Export CTA scope vs payload — resolved: **full inventory** export kept; copy clarifies whole-inventory evidence pack.
- [x] [Review][Patch] Wire FR52 download/custody client for inventory export — `downloadInventoryExport` + Dialog custody/download in `settings-domain-panel.tsx`
- [x] [Review][Patch] Move `inventory_export` allow access-event to after successful `createExportArtifact` (`settings.ts:exportInventory`)
- [x] [Review][Patch] DISABLED inference `min_cohort` uses `0` (JSON-safe) but runtime `DISABLED_INFERENCE_BULK_HOOKS.minimumCohortSize` is `Infinity` — inventory inverts posture; align binder with shared SoT / safe sentinel (`env-bindings.ts:bindInferenceBulkEffective`)
- [x] [Review][Patch] Invalid audit-trust enforce config falls back to `code_default` `false` + degraded while runtime fail-closes — inventory must not show enforce=false as if disabled (`env-bindings.ts` / overlay)
- [x] [Review][Patch] `audit.envelope_category_count` hardcodes 7/25 from NODE_ENV and ignores `loadCategoryRegistry` / fixture / empty paths (`env-bindings.ts:bindEnvelopeCategoryCount`)
- [x] [Review][Patch] `warmSettingsCacheFromEnvOnly` sets `storeUnavailable=false` even when no DB store exists (`resolver.ts`)
- [x] [Review][Patch] `exportInventory` `defs.map(serialize…)` sits outside create try — `GovernedSettingsError` becomes unmapped INTERNAL (`settings.ts:exportInventory`)
- [x] [Review][Patch] `warmSettingsCacheFromEnvOnly` bypasses `warmQueue` — concurrent with `warmSettingsCache` can race (`resolver.ts`)
- [x] [Review][Patch] `infra.pg_pool_max` registry `defaultValue: 5` disagrees with production effective default `10` from `defaultPoolMax` (`registry.ts` / `env-bindings.ts`)
- [x] [Review][Patch] Clear export/mutation feedback when `domain` changes so success/error does not stick across tabs (`settings-domain-panel.tsx`)
- [x] [Review][Patch] Baseline binder accepts regex YYYY-MM-DD without calendar round-trip (e.g. 2024-02-31) (`env-bindings.ts:bindBaselineBoundaryDate`)
- [x] [Review][Defer] Inventory/export selfchecks are mostly source-regex + warm — no real create/download/reauth/secret-byte exercise — deferred, pre-existing selfcheck depth pattern
- [x] [Review][Defer] Dual secret deny lists (`registry.ts` BANNED_REGISTRY_SECRET_FRAGMENTS vs `inventory-redaction.ts`) — deferred, consolidate later

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Emit real `source: "environment"` for env-backed RO keys | Leave UI label dead / fake environment |
| Cut over registered session + provider_mode to resolver | Leave identity reading divergent naked env for those keys |
| Lock + `changePathFa` RO UX | Disabled input implying missing permission |
| Redact all secrets in list + export + audit payload | Render password/CA/connection string partials |
| FR52 reuse for inventory export | Parallel download/blob SoT |
| Audit security-relevant views | Silent inventory of security posture |
| Keep apply/reset RO-forbidden | Make inventory editable “just for testing” |
| `selfcheck:design-qa` green | Claim LG-complete or 10.5 evidence parity |
| Empty-domain omit until keys exist | Fake audit_integrity chrome without registry keys |

### Epic 9 / 10 carry-ins in force

- Mandatory `selfcheck:design-qa`; FeedbackMessage on touched panels; first-touch FormLayout only if forms appear
- Registry/resolver fail-closed + FR45
- Wave/inventory must not widen permission/retention/export/audit boundaries
- Settings nav remains no-dead-end
- AR-\* fail-closed; no freeze-number invention (DEMO inference thresholds stay labeled provisional)
- Deep-link hydrate for settings tabs already landed in 10.2 — do not regress

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `registry.ts` | 18 keys; 3 session/identity RO placeholders + custody RO | Expand RO inventory families + env binding metadata | Wave-1 admin_editable defaults/ranges; custody RO |
| `resolver.ts` | warm: code_default + store only | Env overlay → `environment`; invalid → degraded default | Sync hot path; store never overrides RO |
| `types.ts` | `SettingsValueSource` already includes `environment` | Only if binder metadata needs typing | Existing DTO shapes |
| `store.ts` | RO upsert reject | Unchanged behavior (prove via selfcheck) | Attribution columns |
| `app-settings.selfcheck.ts` / guard | Shape proofs | Environment + secret denial + inventory completeness | Guard map for admin keys |
| `identity-access/config.ts` | Naked env for session/provider | Resolver cutover for registered keys | LDAP secret parse; null provider fail-closed |
| `inference-bulk.ts` / `audit-trust.ts` | Env loaders exist | Shared effective-value readers for binders | DEMO/DISABLED / provisional enforce semantics |
| `packages/db/src/index.ts` | `defaultPoolMax` | Optional export of pure helper for binder; no URL inventory | Shared pool singleton |
| `baseline-boundary.ts` | Env reader | Binder consumes same function | No default epoch |
| `settings.ts` (router) | list + apply/reset | View audit + exportInventory | Soft-deny; domain gates; storeUnavailable |
| `settings-mutation.selfcheck.ts` | RO reject wave-1 keys | Cover new RO keys | Existing cases |
| `settings-domain-panel.tsx` / row | Export CTA absent | Export affordance + copy | RO lock path; editable editor |
| `operational-copy.ts` | source labels exist | Inventory/export/section copy | Existing strings |
| `export-artifact` (reporting/web) | FR52 lifecycle | Consume for settings inventory purpose | reauth/custody/expiry |
| `design-qa-mockup-matrix.md` | edit wave note | inventory note | other rows |

### Algorithm — warm with environment (implement literally)

```
requireGovernedSettingsRegistry()
entries = seedCodeDefaults(false)
load store overrides → apply only admin_editable validated → may mark degradedKeys
for each env-bound RO key:
  raw = envSnapshot[envKey]
  if raw missing/blank → leave code_default (baseline may be explicit unset display)
  parsed = bindParse(def, raw)  // shared with module readers where possible
  if parsed invalid → code_default + degradedKeys += key
  else → entries[key] = { value: parsed, source: "environment", degraded: false }
atomic swap state.entries
```

### Algorithm — inventory export (implement literally)

```
authorize settings.read (envelope) → soft PS read → role domains
collect defs where editability===read_only_with_evidence (or epic inventory flag) ∩ visible domains
serialize safe values only (redaction helper)
append access event settings.inventory.export
createExportArtifact({ purpose: "settings.inventory", rows: safeSnapshot, classification: internal, … })
return artifact id + custody/reauth client contract (same as 6.5 consumers)
```

### Architecture compliance

- **AD-7:** Single resolver; registered parameters not read as divergent naked env in modules after cutover; security posture RO with real change path; fail closed to code default + FR45.
- **AD-3:** Web composes; inventory/export ownership split: app-settings (values), reporting (artifact lifecycle), audit-envelope (access events).
- **AD-6:** No Prisma in settings hot path; keep `pg` pool via `@divan/db`.
- **FR-60 / FR-42 / FR-45 / FR-52 / FR-55:** View+export attributable; deployment path for RO; no silent boundary widen; artifacts governed.
- **No AD-1…AD-6 change.**

### Library / framework requirements

- Existing `governedProcedure` + Zod — extend settings router; do not replace auth middleware
- Reuse `@divan/reporting` `createExportArtifact` + web `export-artifact` reauth helpers
- Lucide `Lock` already used on RO rows
- **Do not** add secret-manager SDKs, i18n frameworks, or Redis for settings cache
- **Do not** add form libraries unless export confirm already needs FormLayout (allowed)

### File structure requirements

```
# UPDATE (primary)
packages/kernel/app-settings/src/{registry,resolver,types,index}.ts
packages/kernel/app-settings/src/app-settings.selfcheck.ts
packages/kernel/app-settings/src/governed-settings-guard.selfcheck.ts  # if new keys need guard map
packages/modules/identity-access/src/config.ts
packages/kernel/audit-envelope/src/{inference-bulk,audit-trust}.ts     # only if exporting shared readers
packages/db/src/index.ts                                              # optional pure defaultPoolMax export
packages/modules/person-employment/src/baseline-boundary.ts           # only if export helper needed
apps/web/src/server/settings.ts
apps/web/src/server/settings-mutation.selfcheck.ts
apps/web/lib/{settings-types,operational-copy,settings-domain-map}.ts
apps/web/components/settings/{settings-domain-panel,settings-parameter-row}.tsx
apps/web/lib/design-qa-mockup-matrix.md
packages/modules/reporting/src/export-artifact.ts                     # if new purpose/report key needed
apps/web/src/server/export-artifact.ts                                # compose only if cleaner than settings.ts calling domain

# NEW (as needed)
packages/kernel/app-settings/src/env-bindings.ts       # binders + redaction
packages/kernel/app-settings/src/inventory-redaction.ts
apps/web/src/server/settings-inventory.selfcheck.ts

# Do NOT create
# - parallel settings store / second resolver
# - UI editors for RO keys
# - DATABASE_URL / password registry rows
# - /settings/secrets routes
```

### Testing requirements

| Layer | Command / pattern |
| --- | --- |
| Kernel | `pnpm --filter @divan/app-settings selfcheck` (+ guard) |
| Access | `pnpm --filter @divan/audit-envelope selfcheck:settings-access` (if permissions touched) |
| Web IA | `pnpm --filter @divan/web selfcheck:settings-ia` (+ no-dead-end if scripted) |
| Design QA | `pnpm --filter @divan/web selfcheck:design-qa` |
| Inventory | NEW: environment source, secret denial, view audit, export wiring, RO mutate still forbidden |
| Manual | DoD checklist above |

### Previous story intelligence (10.1 → 10.3)

- **10.1** landed AD-7 substrate; FR45 `configuration`; RO placeholders without env cutover; custody forced RO in review.
- **10.2** landed `/settings`, role-split tabs, soft-deny, empty-domain omit, RO lock+path UX; explicitly deferred environment producer + inventory export to **10.4**.
- **10.3** landed validate-before-write, `settings.write`, apply/reset, FormLayout editors; explicitly deferred full RO infra inventory / secret redaction / inventory export to **10.4**; client imports `@divan/app-settings/validate` + `/registry` to avoid `pg` in browser — keep that split.
- **10.3 review patches to preserve:** storeUnavailable gates mutations; warm before previousValue; leave-guard busy during mutate; string_list dedupe; degraded reset allowed.
- **Deferred-work.md:** `source: "environment"` discrimination + RO session/identity cutover → **this story**.
- **Not this story:** `effect_at` scheduling, FR42 investigation deep-link, FR51 productization, batched `lastChangedBy` identity DTO (Epic 9 carry-in — raw account id still OK for editable rows).
- Baseline commit for this story: **`18b84f3`** (story 10.3).

### Git intelligence summary

Recent: `18b84f3` story 10.3 → `beb7415` story 10.2 → `311fbc2` story 10.1. Pattern: kernel SoT first, thin web router, soft PS after envelope, FeedbackMessage panels, design-qa gate, UTF-8 no-BOM sprint-status. Follow the same for inventory/export; do not invent a second settings package.

### Latest tech information

- **Secret display:** Never echo env secrets into logs, DTOs, or exports — allowlist safe fields; deny-by-default for unknown env-backed strings (12-factor / modern Node secret hygiene). Prefer booleans/enums for posture.
- **Env overlay at warm:** Capture env once during `warmSettingsCache` so hot `resolveSetting` stays sync and cache-only (AD-7). Re-warm on process restart remains the deployment change path — do not build a live env-watch reload product.
- **FR52:** Continue `reauthorizeForQueuedOrArtifactWork` on create+download; honor artifact TTL via `export.artifact_ttl_ms` resolver key; custody notice for bulk/sensitive paths — settings inventory is configuration evidence (internal), not HR content export, but still governed.
- **tRPC:** Extend existing settings router; do not introduce parallel auth middleware.
- Inference DEMO thresholds remain provisional (`@provisional-pending-AR-*`); inventory must not relabel them as AR-approved launch baselines.

### Project context reference

- No `project-context.md` in repo — follow `ARCHITECTURE-SPINE.md` (AD-7), `epics.md` Epic 10 / Story 10.4, `prd.md` FR-60/FR-42/FR-45/FR-52/FR-55, `ux-divan-2026-07-31`, stories **10.1–10.3**, `deferred-work.md` (environment deferral), and this file.
- Open Epic 7/8/9 production-honesty items remain **out of scope** but stay visible in Gates (no silent “done”).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 10 / Story 10.4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-60, FR-42, FR-45, FR-52, FR-55]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-7]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — Settings curated + RO inventory]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — Configuration Administration]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — settings-row readonly-pattern]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/screens-settings.html`]
- [Source: `_bmad-output/implementation-artifacts/10-1-governed-settings-registry-store.md`]
- [Source: `_bmad-output/implementation-artifacts/10-2-settings-surface-admin-access.md`]
- [Source: `_bmad-output/implementation-artifacts/10-3-editable-parameter-wave-1.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/kernel/app-settings/`]
- [Source: `packages/modules/identity-access/src/config.ts`]
- [Source: `packages/kernel/audit-envelope/src/inference-bulk.ts`]
- [Source: `packages/kernel/audit-envelope/src/audit-trust.ts`]
- [Source: `packages/db/src/index.ts`]
- [Source: `packages/modules/person-employment/src/baseline-boundary.ts`]
- [Source: `packages/modules/reporting/src/export-artifact.ts`]
- [Source: `apps/web/src/server/settings.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Fixed circular registry↔redaction import by inlining secret-key hygiene in equireGovernedSettingsRegistry\.
- RowActionButton call-site must keep literal \onClick=\ for row-actions selfcheck (no spread-only props).
- Export cell values coerce boolean → string (ExportCellValue has no boolean).
- Selfcheck secret-scan scoped to registry keys (router legitimately mentions DATABASE_URL for pool bootstrap).

### Completion Notes List

- Task 1: Expanded RO inventory registry (LDAP posture, inference/bulk, audit-trust, category count, pool max, baseline) + \ENV_BINDINGS\ map; custody RO preserved; secret-shaped keys banned in require.
- Task 2: Warm path overlays env at capture time → \source: environment\; invalid → code_default + degraded; \warmSettingsCacheFromEnvOnly\ for tests/no-DB; guard still green.
- Task 3: Identity session + provider_mode cut over to resolver after warm (unknown provider still null); LDAP secrets stay on env; binders mirror inference/trust/pool/baseline without circular imports.
- Task 4: \serializeSettingsInventoryValue\ + deny patterns; list/export/access-event use redaction; secret-shaped keys fail closed.
- Task 5: \settings.inventory.view\ on technical domains; \exportInventory\ via FR52 \createExportArtifact\ (\settings_inventory\ surface + SQL 023); role-matrix export intersection; RO mutate still forbidden.
- Task 6: Export CTA on technical panels + «کنترل‌شده در زیرساخت»; design-qa matrix updated; no dead audit deep-link.
- Task 7: Kernel/web inventory selfchecks + design-qa green; typecheck web/app-settings/identity-access/reporting green; sprint-status → review (UTF-8 no BOM).
- Apply migration \packages/db/sql/023_export_source_settings_inventory.sql\ before live inventory export against existing DBs.

### File List

- packages/kernel/app-settings/src/registry.ts
- packages/kernel/app-settings/src/resolver.ts
- packages/kernel/app-settings/src/index.ts
- packages/kernel/app-settings/src/env-bindings.ts
- packages/kernel/app-settings/src/inventory-redaction.ts
- packages/kernel/app-settings/src/app-settings.selfcheck.ts
- packages/modules/identity-access/src/config.ts
- packages/db/src/index.ts
- packages/db/sql/015_export_artifacts.sql
- packages/db/sql/023_export_source_settings_inventory.sql
- packages/modules/reporting/src/export-artifact-repo.ts
- apps/web/src/server/settings.ts
- apps/web/src/server/settings-mutation.selfcheck.ts
- apps/web/src/server/settings-inventory.selfcheck.ts
- apps/web/components/settings/settings-domain-panel.tsx
- apps/web/components/settings/settings-ia.selfcheck.ts
- apps/web/lib/operational-copy.ts
- apps/web/lib/design-qa-mockup-matrix.md
- apps/web/package.json
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/10-4-readonly-infrastructure-security-inventory.md

### Change Log

- 2026-08-03: Story context created (ready-for-dev) — RO infra/security inventory; ultimate context engine analysis completed.
- 2026-08-03: Implemented Story 10.4 — RO inventory registry/env overlay, secret redaction, identity cutover, FR52 inventory export, view audit, UI export CTA, selfchecks + design-qa; status → review.
- 2026-08-03: Code review patches applied — FR52 download/custody dialog, view-audit fail-closed, binder honesty (cohort/trust/category/baseline/pool), env-only warm queue + storeUnavailable, export audit order; status → done.
