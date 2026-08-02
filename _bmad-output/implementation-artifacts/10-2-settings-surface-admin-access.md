---
baseline_commit: 311fbc2
---

# Story 10.2: Settings Surface & Admin-Only Access

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an administrator,
I want one place that shows the parameters I am allowed to see,
so that configuration is not scattered across code and environments (UX-DR36, FR60).

**Story key:** `10-2-settings-surface-admin-access`  
**Epic:** 10 — Administrative Settings & Governed Parameters (FR60; FR42, FR45, FR55 evidence/change-control)  
**UX contract:** `ux-divan-2026-07-31` (UX-DR36 تنظیمات IA; EXPERIENCE §Configuration Administration; DESIGN `settings-row`; mockup `screens-settings.html`)  
**Architecture:** **AD-7** (consume registry/resolver from 10.1; no AD-1…AD-6 change). Web stays thin.  
**Authorized by:** `sprint-change-proposal-2026-07-31` (Gap E10 — no settings route/nav)  
**Prerequisite:** Story **10.1** done (`@divan/app-settings` registry + store + cached resolver). Epics 8–9 primitives + IA gates.  
**Downstream:** **10.3** editable wave-1 apply/reset/blast-radius; **10.4** RO infra/security inventory honesty; **10.5** change-control evidence productization.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| AD-7 substrate | `packages/kernel/app-settings/` (`@divan/app-settings`) | Typed registry, override store, cached resolver, FR45 configuration health | **No** list-by-domain HTTP API; **no** UI; no nav |
| Registry domains | `types.ts` `SettingsOwningDomain` + `GOVERNED_SETTINGS_REGISTRY` | 18 params across domains; **zero** `audit_integrity` keys today | Surface must **not** render empty tabs |
| NAV_CATALOG | `packages/modules/identity-access/src/navigation.ts` | 11 items; role-filtered via `ROLE_NAV_HREFS` / `getNavItemsForRole`; omit-from-DOM | Append «تنظیمات» `/settings` at **end**; add to `hr_admin` + `system_admin` only |
| Path deny + audit | `resolve-app-path-access.tsx`, `assert-page-access.ts`, `access-denied.tsx`, `recordAccessDenial` | UX-DR18 «دسترسی ندارید.» + audited deny when path not in role matrix | Flip once `/settings` is catalogued; still gate **forbidden tabs** |
| Section-tabs chrome | `section-tab-surfaces.ts`, `SurfaceSectionTabsLayout`, `SectionTabs` | URL nested segments; PageHeader + tablist + tabpanel | Register `/settings` + domain tabs |
| Role-split tabs | `personnel/(tabs)/layout.tsx` | Filters `dictionary` unless `hr_admin` | Mirror for settings domain visibility |
| Surface root redirect | `reports/page.tsx`, `access/page.tsx` | `assertPageAccess` + `redirect(defaultTabHref)` | Mirror for `/settings` |
| Ops permission pattern | `OPS_HEALTH_READ_PERMISSION`, `seed-ops.ts`, `operationsRouter` | Own permission + category + DEV_DEMO_POLICY + soft gate | **New** settings permission — do **not** reuse ops/access |
| Feedback / header | `PageHeader`, `FeedbackMessage`, ops/access panels | Epic 8–9 first-touch primitives | Consume on settings panels; no StatusMessage clones |
| Jalali | `apps/web/lib/jalali.ts` `formatJalaliDateTimeFromIso` | Last-change time display | Use for override `updatedAt` |
| No-dead-end Settings forbid | `no-dead-end-ia.selfcheck.ts` | Asserts Settings **absent**; length 11 | **Flip** to require Settings + functional pages |
| Governance discoverability | `governance-discoverability.selfcheck.ts` | Asserts nav does **not** contain تنظیمات | Flip with nav |
| Design-QA matrix | `design-qa-mockup-matrix.md` | Settings = `amendment` (10.1 substrate note) | Move toward **`pass`** when nav + functional tabs + registry rows real |
| Ops Lucide icon | `app-sidebar.tsx` `NAV_ICONS["/operations"] = Settings` | Gear icon for operations | Do **not** steal — pick a distinct icon for `/settings` |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Nav permission vs tab role-split** | Coarse `ROLE_NAV_HREFS` + own fine permission gate the **surface**. Tab visibility is a **second** filter (`hr_admin` business domains vs `system_admin` technical). Both required. |
| **Display editability vs edit UX** | Rows **show** `admin_editable` vs `read_only_with_evidence` (and optional lock + `changePathFa`). Inline edit, reason, «اعمال تغییر», blast-radius, «بازگشت به پیش‌فرض» = **10.3** — do not ship mutation UI here. |
| **Seven IA tabs vs empty-never-rendered** | UX lists seven domains. EXPERIENCE: **empty settings section never rendered**. Register all seven in `SECTION_TAB_SURFACES`; **omit domains with zero registry keys** from visible tabs (today: `audit_integrity`). Do not invent fake inventory rows to fill the tab. |
| **Deep-link deny vs silent coerce** | Unauthorized `/settings` → AccessDenied + audit. Forbidden **domain tab** for a role that *can* open `/settings` → deny or redirect to **that role’s default allowed tab** with clear UX — **never** silently show another role’s domain content. Prefer deny for out-of-role deep links (stricter = safer). |
| **Registry-driven vs hand-written rows** | One row component fed by registry + resolve + override metadata. No per-parameter TSX files. |
| **Source labels** | `code_default` \| `store` \| `environment` from resolver — Persian operator copy, not English enums in UI. |
| **Own permission** | New `settings.*` permission(s); not `ops.health.read` / `access.administration`. |
| **LG-complete honesty** | Epic 7/8/9 carry-ins remain open. Do not claim LG-complete or 10.3–10.5 done. |

## Acceptance Criteria

1. **Given** the registry from Story 10.1  
   **When** the settings surface is delivered  
   **Then** a «تنظیمات» nav entry exists at the end of the sidebar with its own permission, omitted from the DOM for callers without it

2. **And** section tabs are عمومی و نمایش · داده و نگه‌داشت · ورود و خروجی · ظرفیت و جذب · دسترسی و نشست · ممیزی و یکپارچگی · زیرساخت  
   (register all seven; **omit empty domains** from the rendered tablist per EXPERIENCE)

3. **And** tabs are role-split: `hr_admin` sees the business domains, `system_admin` sees the technical domains, عمومی و نمایش is visible to both, and each role sees only its own tabs

4. **And** rows render from the registry rather than being hand-written per parameter

5. **And** each row shows label, description, current value, default, source, allowed range, editability, and last change actor and Jalali time

6. **And** a caller with no settings permission never sees the nav entry, and a direct deep link shows «دسترسی ندارید.» and is audited (UX-DR18)

7. **And** Epic 9 / Epic 10 Gate encodes held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - First-touch: PageHeader (via SurfaceSectionTabsLayout), FeedbackMessage on load/empty/error; FormLayout/EntityPicker only if a form control is introduced (prefer none in read-only 10.2)
   - Registry/resolver fail-closed + FR45 unchanged (consume 10.1; do not bypass)
   - Wave-1 / security_posture parameters must not be presented as editable controls that widen permission / retention / export / audit boundaries
   - no-dead-end Settings exemption **flipped** — Settings present and every visible tab hosts real content (no placeholder chrome)
   - Design-QA Settings matrix Result moves to **`pass`** (or honest `fixed`) only when surface is functional — never silent pass on stubs
   - Deep-link / one-shot URL hydrate + cascade-clear kit notes applied to settings tab routing (Epic 9 action #6)
   - AR-\* fail-closed; no LG-complete claim

8. **And** scope boundaries:
   - Does **not** deliver editable apply / reset / blast-radius confirm (**10.3**)
   - Does **not** deliver full RO infra inventory export or secret redaction productization (**10.4**) — RO rows may show `changePathFa` text when present
   - Does **not** deliver full FR42 change-evidence productization (**10.5**)
   - Does **not** call `upsertOverride` / `deleteOverride` from UI or public settings mutations
   - Does **not** change AD-1…AD-6; no event-store / temporal / authz model / headcount invariant changes

## Tasks / Subtasks

- [x] Task 1: Settings permission + nav catalog (AC: #1, #6, #7)
  - [x] NEW permission constant (prefer kernel next to settings or thin export from app-settings / audit-envelope pattern): e.g. `SETTINGS_READ_PERMISSION = "settings.read"` + data category e.g. `settings.configuration` (ordinary — not HR person content)
  - [x] Wire `DEV_DEMO_POLICY` allow tuple + category grantable list (`categories.ts` / `DEV_DEMO_CATEGORIES` as needed)
  - [x] NEW seed bind: grant `settings.read` to `hr.admin` and `sys.admin` PermissionSets (mirror `seed-ops.ts` / access-admin seed — do not invent SoD splits)
  - [x] UPDATE `NAV_CATALOG`: append `{ href: "/settings", label: "تنظیمات" }` as **last** item
  - [x] UPDATE `ROLE_NAV_HREFS`: add `/settings` for `hr_admin` and `system_admin` only (not operator/manager/audit_reviewer)
  - [x] UPDATE `NAV_ICONS` in `app-sidebar.tsx` for `/settings` with a **distinct** Lucide icon (ops keeps `Settings`)
  - [x] UPDATE `navigation.selfcheck.ts` (length 12 + role matrices include/exclude `/settings`)
  - [x] Soft PermissionSet check on settings tRPC after envelope (ops/access pattern)

- [x] Task 2: Section-tabs surface + role-split routing (AC: #2, #3, #6, #7)
  - [x] UPDATE `section-tab-surfaces.ts` — register `/settings` surface with seven tabs:

    | id | labelFa | href | owningDomain |
    | --- | --- | --- | --- |
    | `general-display` | عمومی و نمایش | `/settings/general-display` | `general_display` |
    | `data-retention` | داده و نگه‌داشت | `/settings/data-retention` | `data_retention` |
    | `import-export` | ورود و خروجی | `/settings/import-export` | `import_export` |
    | `capacity-hiring` | ظرفیت و جذب | `/settings/capacity-hiring` | `capacity_hiring` |
    | `access-session` | دسترسی و نشست | `/settings/access-session` | `access_session` |
    | `audit-integrity` | ممیزی و یکپارچگی | `/settings/audit-integrity` | `audit_integrity` |
    | `infrastructure` | زیرساخت | `/settings/infrastructure` | `infrastructure` |

  - [x] Role visibility map (encode as single SoT helper, e.g. `settings-domain-map.ts`):
    - **Both:** `general_display`
    - **`hr_admin` only:** `data_retention`, `import_export`, `capacity_hiring`
    - **`system_admin` only:** `access_session`, `audit_integrity`, `infrastructure`
  - [x] NEW `apps/web/app/(app)/settings/page.tsx` — session + `assertPageAccess(..., "/settings")` + `redirect(defaultTabHref)` to role’s first **visible non-empty** tab
  - [x] NEW `settings/(tabs)/layout.tsx` — `SurfaceSectionTabsLayout` with `tabs` filtered by role **and** domains that have ≥1 registry key; purpose line from `operational-copy.ts`
  - [x] NEW per-tab `page.tsx` files — each: `assertPageAccess("/settings")` + **domain membership assert** (out-of-role or empty domain → AccessDenied / redirect to role default — **no silent coerce into foreign domain content**)
  - [x] Deep-link hydrate: nested path segments only (no `?tab=`); one-shot URL identity; if cascading filters appear later, clear dependents on parent change (kit note from 9.5/9.7 — settings list is domain-scoped so cascade is mostly N/A; document in helper comments)
  - [x] `defaultTabId`: `general-display` for both roles (shared); if somehow empty, fail closed to AccessDenied rather than inventing content

- [x] Task 3: Read-only list API + registry-driven rows (AC: #4, #5, #7, #8)
  - [x] NEW `apps/web/src/server/settings.ts` — `settingsRouter` with read-only procedures only, e.g.:
    - `listByDomain` — input domain enum; authorize `settings.read`; filter registry by domain; reject domains the coarse role may not see; return DTO rows
    - optional `capabilities` — which domains the caller may see
  - [x] Mount on `appRouter` as `settings`
  - [x] Row DTO fields (minimum): `key`, `labelFa`, `descriptionFa`, `unitFa`, `value` (effective), `defaultValue`, `source`, `range`/`allowlist`, `editability`, `changePathFa` (nullable), `lastChangedBy`, `lastChangedAtIso` (from `loadAllOverrides` / store row; null → show «هنوز تغییری ثبت نشده» or equivalent direct copy)
  - [x] Compose server-side: `GOVERNED_SETTINGS_REGISTRY.filter(domain)` + `resolveSetting(key)` + override map — **no** `upsertOverride`/`deleteOverride`
  - [x] Optional thin kernel helper `listSettingsRowsForDomain(domain)` — nice-to-have; web may compose if kept thin
  - [x] NEW `components/settings/settings-parameter-row.tsx` — registry-driven display row (DESIGN `settings-row` tokens: two-column, hairline, readonly = plain text + lock + path when RO — **never** disabled fake input)
  - [x] NEW `components/settings/settings-domain-panel.tsx` — client panel: tRPC list + FeedbackMessage (loading/empty/error) + map rows
  - [x] Format numbers/durations for display honestly (Persian digits where product already does); Jalali for last change via `formatJalaliDateTimeFromIso`
  - [x] Source Persian labels (e.g. پیش‌فرض کد · ذخیرهٔ حاکمیتی · محیط استقرار)

- [x] Task 4: Selfchecks + design-qa + no-dead-end flip (AC: #6, #7)
  - [x] UPDATE `no-dead-end-ia.selfcheck.ts`: length **12**; **require** `/settings` + label «تنظیمات»; every settings tab href with visible content has host component (ban `SectionTabPlaceholder` / «محتوای این بخش…»)
  - [x] UPDATE `governance-discoverability.selfcheck.ts` — allow/require تنظیمات appropriately (stop asserting absence)
  - [x] Optional `settings-ia.selfcheck.ts` — role→tab matrix + empty-domain omit; compose into design-qa or no-dead-end
  - [x] UPDATE `design-qa-mockup-matrix.md` Settings row: route = `/settings/...`; Result **`pass`** when functional; note read-only 10.2 (edit wave = 10.3)
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green; typecheck touched packages
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits
  - [x] Manual DoD below

### Manual DoD checklist

- [x] «تنظیمات» is last sidebar item for `hr_admin` and `system_admin`; absent from DOM for other roles
- [x] `hr_admin` sees only: عمومی و نمایش + business domains that have registry keys
- [x] `system_admin` sees only: عمومی و نمایش + technical domains that have registry keys
- [x] Empty `audit_integrity` (zero keys) is **not** rendered as an empty tab
- [x] Rows on «ورود و خروجی» match registry keys for `import_export` (not hand-written)
- [x] Each visible row shows label, description, value, default, source, range/allowlist, editability, last actor + Jalali time (or explicit never-changed copy)
- [x] RO rows show lock + `changePathFa` when present — not a disabled input
- [x] No apply/reset/mutation controls in UI
- [x] Unauthenticated / wrong-role deep link to `/settings` → «دسترسی ندارید.» + denial recorded
- [x] `hr_admin` deep link to `/settings/infrastructure` denied (or safe redirect to own default) — never shows infra rows
- [x] `selfcheck:design-qa` + no-dead-end green; Settings matrix not silent `amendment` with a live route
- [x] No Prisma in `apps/web`; no AD-1…AD-6 changes; no LG-complete / 10.3–10.5 claims

### Review Findings

- [x] [Review][Patch] Panel-level store-unavailable honesty banner (decision → B) — return `storeUnavailable` (+ short `detailFa` if present) from `listByDomain`; show `FeedbackMessage` warning on panel; do not add per-row degraded chrome in 10.2 (FR45 stays in ops) [`apps/web/src/server/settings.ts`, `settings-domain-panel.tsx`]
- [x] [Review][Patch] `getSettingsPool` throws when `DATABASE_URL` is missing, blocking fail-closed code-default path that warm/load already catch [`apps/web/src/server/settings.ts:49`]
- [x] [Review][Patch] Soft-deny missing `permission_set_missing` access-event append — mirror `denyOpsHealthOrThrow` so effective deny is audited after envelope allow [`apps/web/src/server/settings.ts:77`]
- [x] [Review][Patch] Soft PermissionSet DB failure should fail-closed to FORBIDDEN, not uncaught 500 [`apps/web/src/server/settings.ts:62`]
- [x] [Review][Patch] Align API empty-domain gate with page: reject empty domains in `listByDomain` and omit them from `capabilities` [`apps/web/src/server/settings.ts:172`]
- [x] [Review][Patch] Move `domainsForRole` / `roleMaySeeDomain` (authz matrix) out of `components/` into a lib/server-safe module — router must not import UI tree [`apps/web/src/server/settings.ts:28`]
- [x] [Review][Patch] Add parity selfcheck between `SETTINGS_DOMAIN_TABS` and `SECTION_TAB_SURFACES` `/settings` tabs (href/label/id) [`apps/web/components/settings/settings-domain-map.ts:26`]
- [x] [Review][Patch] Empty-tabs layout fallback feeds full `SURFACE.tabs` into surface metadata while tablist stays empty — use empty surface or fail-closed [`apps/web/app/(app)/settings/(tabs)/layout.tsx:32`]
- [x] [Review][Patch] Share `SettingsParameterRowDto` with client instead of hand-cast `as SettingsParameterRowView[]` [`apps/web/components/settings/settings-domain-panel.tsx:42`]
- [x] [Review][Defer] `source: "environment"` UI case with no resolver producer [`apps/web/components/settings/settings-parameter-row.tsx:37`] — deferred, pre-existing (explicitly → 10.4)
- [x] [Review][Defer] `lastChangedBy` raw store identity (no batched display DTO) [`apps/web/src/server/settings.ts:148`] — deferred, pre-existing (Epic 9 identity-DTO preference / carry-in)

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Consume `@divan/app-settings` registry + resolve for all row data | Hand-write parameter rows; bypass resolver for “display defaults” |
| Own `settings.*` permission + DOM omit without it | Reuse ops/access permissions; render disabled stub nav |
| Role-split tabs + empty-domain omit | Show all seven tabs to everyone; empty tab panels |
| UX-DR18 deny + audit on unauthorized deep link | Silent redirect without AccessDenied for no-permission callers |
| Flip no-dead-end + governance asserts with **functional** pages | Ship nav with placeholders |
| Read-only surface only | Mutations, reset UI, blast-radius confirm (10.3) |
| `selfcheck:design-qa` green; Settings matrix honest | Claim mockup edit-flow parity or LG-complete |
| Keep security_posture / RO params non-editable in UI | Fake editable controls that widen boundaries |
| Distinct sidebar icon for Settings | Steal ops’ Lucide `Settings` without replacement |

### Role → tab matrix (implement literally)

```
hr_admin:     general_display, data_retention, import_export, capacity_hiring
system_admin: general_display, access_session, audit_integrity, infrastructure
both:         general_display
others:       no /settings nav, deep-link deny
```

Filter each set further: drop domain if `GOVERNED_SETTINGS_REGISTRY` has zero keys for that `owningDomain`.

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `navigation.ts` | 11 items; no `/settings`; `system_admin` = ops only | Append Settings; add to hr_admin + system_admin | Fail-closed `canAccessPath`; omit-from-DOM filter |
| `navigation.selfcheck.ts` | length 11 matrices | length 12 + Settings rules | Other role matrices |
| `no-dead-end-ia.selfcheck.ts` | forbids Settings | require Settings + functional hosts | Layout/sidebar NAV_CATALOG bans |
| `governance-discoverability.selfcheck.ts` | asserts no تنظیمات | flip | Other discoverability rules |
| `section-tab-surfaces.ts` | no `/settings` | register surface + 7 tabs | Nested-path preference |
| `app-sidebar.tsx` | ops uses Settings icon | add `/settings` icon | ops icon assignment |
| `design-qa-mockup-matrix.md` | Settings amendment | pass when real | Other rows |
| `root.ts` / trpc | no settings router | mount read-only settings | Existing routers |
| `operational-copy.ts` | no settings purpose | add surface purpose (+ source labels if needed) | Existing deny copy |
| `@divan/app-settings` | substrate | optional list helper only | Resolver/store semantics; no mutation API expansion required |

### Algorithm (implement literally)

1. **Nav:** Catalog ends with `/settings`. `getNavItemsForRole` includes it iff role ∈ {hr_admin, system_admin}.
2. **Layout gate:** `resolveAppPathAccess` / `assertPageAccess` for `/settings` and nested paths via existing prefix rules.
3. **Tabs:** Load surface tabs → filter by role map → filter domains with `count(registry, domain) > 0` → pass to `SurfaceSectionTabsLayout`.
4. **Page:** Assert path + domain membership → render `SettingsDomainPanel` for that domain.
5. **List:** Authorize `settings.read` → if domain not in caller’s visible set → soft deny → else map registry∩domain to DTOs via resolve + overrides.
6. **Row:** Render metadata only; RO → lock + changePathFa; editable → show editability badge/text but **no** editors.
7. **Empty domain:** If someone hits a registered empty tab URL → AccessDenied or redirect to default allowed non-empty tab (document choice; prefer deny for honesty).

### Architecture compliance

- **AD-7:** UI/API read through registry + resolver; no raw env/literal for registered params; fail-closed defaults already in 10.1.
- **AD-3:** Web thin — composition + tRPC; domain logic stays in kernel package.
- **AD-6:** No Prisma in `apps/web`; store remains `pg` in kernel.
- **FR-60 / FR-42 / UX-DR18:** View surface + audited deny; change evidence productization stays 10.5.
- **No AD-1…AD-6 change.**

### Library / framework requirements

- Next.js App Router patterns already in repo (await `params`/`searchParams` if used; nested segment tabs)
- Existing `governedProcedure` + Zod input enums for domains
- Lucide icons already used in sidebar
- **Do not** add nuqs / new URL-state libraries — mirror reports one-shot hydrate with `Link` tab paths
- **Do not** add a parallel config UI framework

### File structure requirements

```
apps/web/app/(app)/settings/
  page.tsx
  (tabs)/
    layout.tsx
    general-display/page.tsx
    data-retention/page.tsx
    import-export/page.tsx
    capacity-hiring/page.tsx
    access-session/page.tsx
    audit-integrity/page.tsx      # may 404/deny if omitted from tabs when empty
    infrastructure/page.tsx

apps/web/components/settings/
  settings-domain-map.ts          # domain ↔ href/label + role visibility + empty omit
  settings-domain-panel.tsx
  settings-parameter-row.tsx
  settings-ia.selfcheck.ts        # optional

apps/web/src/server/settings.ts   # read-only router
apps/web/lib/section-tab-surfaces.ts          # UPDATE
apps/web/lib/operational-copy.ts              # UPDATE
apps/web/lib/no-dead-end-ia.selfcheck.ts      # UPDATE
apps/web/lib/governance-discoverability.selfcheck.ts  # UPDATE
apps/web/lib/design-qa-mockup-matrix.md       # UPDATE
apps/web/components/app-sidebar.tsx           # UPDATE NAV_ICONS

packages/modules/identity-access/src/navigation.ts     # UPDATE
packages/modules/identity-access/src/navigation.selfcheck.ts
packages/modules/identity-access/src/seed-settings.ts  # NEW (or extend seed)
packages/kernel/audit-envelope/...                     # SETTINGS_* permission + policy
# optional: packages/kernel/app-settings/src/list-domain.ts
```

### Testing requirements

- navigation.selfcheck: Settings last; role matrices
- no-dead-end-ia: Settings present; tab hosts real
- settings list selfcheck or web selfcheck: role cannot list foreign domain; empty domain omitted
- design-qa green
- Manual: hr_admin vs system_admin tab sets; deep-link deny for manager; row fields populated from registry

### Previous story intelligence (10.1)

- Substrate landed: `@divan/app-settings`, SQL `022_governed_settings.sql`, boot warm in `instrumentation.ts`, FR45 `configuration` ops section.
- **18** registry entries: wave-1 admin_editable + RO posture placeholders (`access_session`, `infrastructure`); **`audit_integrity` has zero keys** — empty-tab rule matters.
- `export.custody_bulk_row_threshold` is **`read_only_with_evidence`** (review patch) — display as RO, not editable.
- Review deferred: `source: "environment"` discrimination / RO inventory → **10.4**; `effect_at` → **10.5**.
- Guard selfcheck bans naked literals/env for registered keys — do not reintroduce dual SoT in UI by hardcoding values.
- 10.1 explicitly deferred nav/UI to this story; matrix stayed `amendment` until now.
- Completion honesty: do not claim 10.3–10.5 in this story’s done notes.

### Git intelligence summary

Recent commits: `311fbc2` story 10.1 → `dc9be67` epic 9 retro → `f7559b9` 9.10 → `b9760ae` 9.9 → `fe4ea92` 9.8.  
Baseline for this story: **`311fbc2`**. Pattern: section-tabs surfaces (9.5 reports) + permission-gated admin pages (ops/access) + registry SoT (10.1).

### Latest tech information

- Next.js App Router RBAC: **UI hide ≠ security** — enforce on Server Components (`assertPageAccess`) **and** tRPC `governedProcedure` + soft PermissionSet check.
- Prefer **path-segment tabs** (already Divan convention) over query `?tab=` for shareable deep links.
- Unauthorized deep links: rewrite/deny in place with AccessDenied (existing Divan pattern) rather than open-redirect to login with leaked path semantics for authenticated-but-forbidden users.
- Do not adopt new URL-state libraries; reuse existing Link tablist + optional `router.replace` one-shot hydrate.

### Project context reference

- No `project-context.md` in repo — follow `ARCHITECTURE-SPINE.md` (AD-7), `epics.md` Epic 10 / Story 10.2, `prd.md` FR-60/FR-42/FR-45, `ux-divan-2026-07-31`, story **10.1**, and this file.
- Open Epic 7/8/9 production-honesty items remain **out of scope** but must stay visible in Gates (no silent “done”).
- Close Epic 9 action #6 (deep-link hydrate notes) **in this story’s implementation**.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 10 / Story 10.2]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-60, FR-42, FR-45]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-7]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — Configuration Administration]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — settings-row]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/screens-settings.html`]
- [Source: `_bmad-output/implementation-artifacts/10-1-governed-settings-registry-store.md`]
- [Source: `packages/kernel/app-settings/`]
- [Source: `packages/modules/identity-access/src/navigation.ts`]
- [Source: `apps/web/lib/section-tab-surfaces.ts`]
- [Source: `apps/web/lib/no-dead-end-ia.selfcheck.ts`]
- [Source: `apps/web/lib/design-qa-mockup-matrix.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- `pnpm --filter @divan/audit-envelope selfcheck:settings-access` ok
- `pnpm --filter @divan/identity-access exec tsx src/navigation.selfcheck.ts` ok
- `pnpm --filter @divan/web selfcheck:settings-ia` ok
- `pnpm --filter @divan/web selfcheck:governance-discoverability` ok
- `pnpm --filter @divan/web selfcheck:no-dead-end-ia` ok (12 catalog + 31 tabs)
- `pnpm --filter @divan/web selfcheck:design-qa` ok
- typecheck: `@divan/web`, `@divan/audit-envelope`, `@divan/identity-access`, `@divan/app-settings` ok

### Completion Notes List

- Delivered read-only Settings surface (`/settings`) with own `settings.read` permission + `settings.configuration` category; seeded for `hr.admin` and `sys.admin`.
- Nav «تنظیمات» last in catalog; `hr_admin` + `system_admin` only; distinct `SlidersHorizontal` icon (ops keeps `Settings`).
- Seven domains registered; empty `audit_integrity` omitted from visible tabs; out-of-role / empty deep links → AccessDenied + audit (no silent coerce).
- Registry-driven rows via `settings.listByDomain` (resolve + overrides); no mutation UI / no `upsertOverride`/`deleteOverride`.
- Flipped no-dead-end + governance asserts; design-qa Settings matrix → `pass` (read-only 10.2; edit = 10.3).
- Does **not** claim 10.3–10.5 or LG-complete.
- Code review: panel store-unavailable banner; soft-deny `permission_set_missing` audit; fail-closed without DATABASE_URL; empty-domain API align; domain matrix moved to `lib/settings-domain-map.ts`.

### File List

- packages/kernel/audit-envelope/src/settings-access.ts
- packages/kernel/audit-envelope/src/settings-access.selfcheck.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/src/index.ts
- packages/kernel/audit-envelope/package.json
- packages/modules/identity-access/src/navigation.ts
- packages/modules/identity-access/src/navigation.selfcheck.ts
- packages/modules/identity-access/src/seed-settings.ts
- packages/modules/identity-access/src/seed.ts
- packages/modules/identity-access/src/index.ts
- apps/web/components/app-sidebar.tsx
- apps/web/lib/settings-domain-map.ts
- apps/web/lib/settings-types.ts
- apps/web/components/settings/settings-domain-map.ts
- apps/web/components/settings/settings-domain-page.tsx
- apps/web/components/settings/settings-domain-panel.tsx
- apps/web/components/settings/settings-parameter-row.tsx
- apps/web/components/settings/settings-ia.selfcheck.ts
- apps/web/app/(app)/settings/page.tsx
- apps/web/app/(app)/settings/(tabs)/layout.tsx
- apps/web/app/(app)/settings/(tabs)/general-display/page.tsx
- apps/web/app/(app)/settings/(tabs)/data-retention/page.tsx
- apps/web/app/(app)/settings/(tabs)/import-export/page.tsx
- apps/web/app/(app)/settings/(tabs)/capacity-hiring/page.tsx
- apps/web/app/(app)/settings/(tabs)/access-session/page.tsx
- apps/web/app/(app)/settings/(tabs)/audit-integrity/page.tsx
- apps/web/app/(app)/settings/(tabs)/infrastructure/page.tsx
- apps/web/src/server/settings.ts
- apps/web/src/server/root.ts
- apps/web/lib/section-tab-surfaces.ts
- apps/web/lib/operational-copy.ts
- apps/web/lib/no-dead-end-ia.selfcheck.ts
- apps/web/lib/governance-discoverability.selfcheck.ts
- apps/web/lib/design-qa-mockup-matrix.md
- apps/web/package.json
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/10-2-settings-surface-admin-access.md
- _bmad-output/implementation-artifacts/deferred-work.md

### Change Log

- 2026-08-03: Story context created (ready-for-dev) — Settings surface & admin-only access.
- 2026-08-03: Implemented Settings surface (nav, role-split tabs, read-only registry rows, selfchecks); status → review.
- 2026-08-03: Code review patches applied (store-unavailable banner, soft-deny audit, fail-closed pool, domain-map→lib, empty-domain API align); status → done.
