---
baseline_commit: 51eb947
---

# Story 3.3: Data-Dictionary-Governed Profile Fields

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Data Owner,
I want only approved Data Dictionary fields enabled on profiles,
so that spreadsheet presence alone never activates a field (FR7).

## Gate (read first)

**Epic 3 ↔ Epic 4 sequencing remains inviolable.** This story ships a **configurable Data Element registry + enablement gates + contact format rules** — **not** Start/Return/Termination flows, **not** Employment/Assignment/compensation *state* product CRUD, and **not** the full Epic 5 personnel profile surface.

- **Allowed:** Data Dictionary registry (disposition + mandatory metadata before enable); gate Person profile **render/edit** so only enabled+approved+permitted fields appear; normalize `mobilePhone` per dictionary format; omit unauthorized fields from API payloads (and from any thin UI this story touches — keys absent, not masked); seed registry from AR-DATA partial freeze.
- **Forbidden:** Enabling a field because it appears in Excel/addendum alone; enabling `reject` (religion/sect) or promoting `later` without explicit disposition change; silent overwrite of **historical workforce-affecting** field changes (those go through AR-TEMPORAL events in Epic 4); temporary Employment/Assignment/compensation mutation APIs; inventing AR-ACCESS / AR-DATA numbers or enabling production sensitive **categories** that remain `enabled: false`.
- **Category ≠ Dictionary:** Story 2.2 category hooks (`identity.national_id`, `religion`, …) stay as-is. This story adds **field-level** registry/enablement and maps fields → category/sensitivity where needed. Do **not** conflate “National ID disposition=`approve`” with “category `identity.national_id` grantable in production.”
- **AD-2:** Person columns remain master-data / projection storage. Dictionary governs *which* attributes may be collected and shown. Do not treat dictionary enablement as event-store authority.
- **Reuse:** `normalize.ts` / `digits.ts`, `omitUnauthorizedCategories`, `governedProcedure`, `identity.person` / `identity.national_id` gates, Person APIs from 3.1 — extend, do not fork.
- Layout ≠ RSC / UI ≠ data access / default-deny / no client `@prisma/client` remain intact.

[Source: `epics.md` Epic 3 sequencing + Story 3.3; `prd.md` FR-3/FR-7/FR-55; `data-element-dispositions.md`; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6; Stories 2.2, 3.1, 3.2]

## Acceptance Criteria

1. **Given** AR-DATA Data Element dispositions (configurable registry)  
   **When** a profile is rendered or edited  
   **Then** only enabled approved fields appear; out-of-permission fields are omitted from the DOM (and from API payloads — key absence, not masking)

2. **And** every enabled element carries purpose, owner/source, format, sensitivity, access, retention, export, and audit classification **before** enablement

3. **And** free text is purpose-limited and access-controlled; derived elements retain lineage and cannot be classified below their most sensitive input without assessment

4. **And** historical workforce-affecting field changes must go through authoritative temporal events (no silent overwrite)

5. **And** spreadsheet/addendum presence alone never enables a field — only registry disposition `approve` + complete metadata + explicit enable

6. **And** this story does **not** deliver full Epic 5 profile sections/timeline, Employment product verbs, or compensation schema (3.4 / 4.x / 5.2)

## Tasks / Subtasks

- [x] Task 1: Data Element registry in `@divan/person-employment` (AC: #1, #2, #5)
  - [x] Define typed `DataElement` / registry model owned by person-employment (AD-3 / FR-5..FR-7):
    - Stable `elementId` (e.g. `person.mobile_phone`, `person.national_id`) — not Excel column titles as ids
    - `disposition`: `approve` | `later` | `reject` (from partial freeze)
    - `enabled`: boolean — may be `true` **only** when disposition=`approve` **and** all mandatory metadata present
    - Mandatory metadata before enable: `purpose`, `ownerSource`, `format`, `sensitivity`, `access`, `retention`, `export`, `audit` (match FR-7 / AC #2)
    - Optional: `categoryId` (maps to audit-envelope category when sensitive), `freeTextPurpose` / `lineage` for free-text / derived rules
    - Version stamp or `registryVersion` string for FR-55 foreshadowing (document; full governed versioning UI later)
  - [x] Persistence choice (pick one; document in README):
    - **Preferred for MVP:** Prisma `DataElement` table (typed columns + Json for extended metadata if needed) seeded from dispositions — queryable, migratable
    - **Acceptable alternative:** versioned seed JSON loaded into memory/DB on boot **if** enablement still goes through domain API that enforces metadata completeness (not scattered hardcodes)
    - Do **not** invent EAV value storage for approve identity fields already on `Person` columns — registry governs enablement; values stay on Person for MVP approve set
  - [x] Seed registry rows matching `_bmad-output/specs/spec-divan/data-element-dispositions.md`:
    | Disposition | Elements |
    | --- | --- |
    | approve | Personnel Code, First/Last/Father name, Birth date, Gender, Nationality, National ID, Mobile phone |
    | later | birth cert details, places, landline, emails, address, postal, work location, family/education/bank/health/insurance, … |
    | reject | Religion / sect |
  - [x] `later` rows exist in registry with `enabled=false`; `reject` rows cannot be enabled via API (fail-closed Persian + stable error code)
  - [x] Enable API: `enableDataElement(elementId)` rejects incomplete metadata, non-approve disposition, or reject; does not invent Legal/Privacy sign-off beyond recording required classification fields

- [x] Task 2: Profile field gate + contact format (AC: #1, #3, #4)
  - [x] `listEnabledProfileFields(actorCtx?)` / `assertFieldEnabled(elementId)` — single gate used by Person read/write paths
  - [x] Wire `createPerson` / `updatePersonIdentity` / Person tRPC projection:
    - Reject writes to fields that are not enabled+approved
    - Omit disabled / out-of-permission fields from read DTOs (key absence)
    - Keep existing national_id **category** gate: disposition approve ≠ production category enabled
  - [x] **Close deferred mobilePhone format:** canonicalize via `toLatinDigits` + documented format rule in dictionary `format` metadata (Iranian mobile pattern as product rule for MVP); store canonical form; accept Persian/Arabic-Indic digits on input; reject garbage with stable error code
  - [x] Free-text: if any free-text element is modeled, require `freeTextPurpose` + access; reject unbounded free text
  - [x] Derived: if any derived element is modeled, require `lineage`; reject sensitivity downgrade without assessment flag/record — if no derived elements in MVP seed, still encode the invariant helper + selfcheck stub so 3.4+ can hook
  - [x] **Historical workforce-affecting overwrite:** classify Person identity/contact master-data updates (names, mobile, etc.) as allowed master-data updates **only** when they do not rewrite historical employment/assignment/compensation state. Document in code: Employment/contract/compensation/org effective-dated facts → Epic 4 events only. Do not add a silent “edit history cell” path.
  - [x] Export public types from `src/index.ts` only

- [x] Task 3: Thin render/edit surface (AC: #1, #6)
  - [x] Minimum to satisfy “profile is rendered or edited”:
    - Extend existing `/personnel` create/edit (or a thin governed “profile fields” panel) so **only enabled approve fields** are rendered in the DOM
    - Unauthorized / disabled fields: **not in DOM** (not `hidden` / not CSS-only)
  - [x] Optional thin admin read of registry (list elements + disposition + enabled) behind existing admin/hr PermissionSet — **not** a full Data Dictionary governance product UI
  - [x] Persian operational copy at API boundary; clients match on **error codes**, not Persian substrings
  - [x] **Forbidden:** full `person-profile-section` (identity · Employment · Assignments · timeline) — Story 5.2; Employment Start/Terminate forms; compensation editors

- [x] Task 4: Authz alignment (AC: #1)
  - [x] Sensitive fields (National ID): continue envelope `identity.national_id` + `sensitive: true` pattern from 3.1 — omit when category disabled or unauthorized
  - [x] Ordinary identity fields: `identity.person` / `person.read` / `person.write` as today
  - [x] Do **not** enable production hooks for religion/health/family/bank/insurance/compensation in `categories.ts`
  - [x] Do **not** replace PopulationPort fixtures; cutover still 3.5–3.9 / 4.x — subject id target remains Person UUID (`population-cutover.ts`)

- [x] Task 5: Seed + selfcheck + deferred-work (AC: #1–#6)
  - [x] `data-dictionary.selfcheck.ts` + root/package script `selfcheck:data-dictionary`
  - [x] Cases in Testing table below
  - [x] Update `deferred-work.md`: close mobilePhone format defer; note dictionary registry landed; full profile DOM omit Epic 5; FR-55 formal versioning still open; employment/contract/compensation field enablement lists still open walks
  - [x] Preserve prior selfchecks green (`person-identity`, `employment-lifecycle`, audit-envelope, inference-bulk as applicable)
  - [x] `pnpm` typecheck: `@divan/person-employment`, `@divan/db`, `@divan/audit-envelope`, `@divan/web` (if UI/tRPC touched)
  - [x] **When marking done:** sync story-file `Status: done` with `sprint-status.yaml` key `3-3-data-dictionary-governed-profile-fields`

### Review Findings

- [x] [Review][Decision] `listEnabledProfileFields` ignores actor authorization — resolved: dictionary-only list + caller omit via `projectPersonRecord` documented in README/API; per-actor grant filter deferred until grant resolution is wired
- [x] [Review][Decision] `seedDataDictionary` force-re-enables approve rows and overwrites metadata on every seed — resolved: sync metadata on update; enable approve only on create; preserve operator `enabled`
- [x] [Review][Patch] Shared `SEPARATORS` gained `.-` and bleeds into Personnel Code / national ID uniqueness [`packages/modules/person-employment/src/digits.ts:22`]
- [x] [Review][Patch] Person list N+1 (and possible mixed shapes): `toPublicPerson` calls `getEnabledPersonFieldKeys()` per row [`apps/web/src/server/person.ts:153`]
- [x] [Review][Patch] Create path ignores partial dictionary disable — UI/`identityFieldsSchema` always require all four identity fields while DOM may hide some [`apps/web/components/personnel/personnel-panel.tsx:165`]
- [x] [Review][Patch] `FIELD_NOT_ENABLED` mapped as HTTP `FORBIDDEN` (treat as config miss → `BAD_REQUEST`) [`apps/web/src/server/person.ts:92`]
- [x] [Review][Patch] `assertFieldEnabled` does not re-check metadata completeness (bypass/`enabled=true` with empty meta still passes) [`packages/modules/person-employment/src/data-dictionary.ts:223`]
- [x] [Review][Patch] Empty-string optionals counted as present for enablement before null-normalization [`packages/modules/person-employment/src/person.ts:266`]
- [x] [Review][Defer] No DB CHECK that `enabled` ⇒ `disposition=approve` [`packages/db/prisma/migrations/20260717050000_data_element_registry/migration.sql`] — deferred, pre-existing pattern (domain enforces)
- [x] [Review][Defer] Selfcheck mutates shared DB dictionary rows with best-effort restore [`packages/modules/person-employment/src/data-dictionary.selfcheck.ts`] — deferred, pre-existing

## Dev Notes

### Epic 2 / 3.1 / 3.2 carry-in

| Item | How 3.3 absorbs it |
| --- | --- |
| Epic 3↔4 no temporary CRUD | Gate + Tasks: registry + Person field gates only; no Employment/Assignment/compensation product writes |
| Category omit (2.2) | Reuse `omitUnauthorizedCategories`; add field→category map for dictionary-enabled sensitive fields |
| Person columns (3.1) | Keep approve attributes on `Person`; registry decides enablement/visibility — do not duplicate into EAV for MVP |
| mobilePhone raw (deferred) | Task 2 — format + digit canonicalization |
| Employment projection (3.2) | Untouched product surface; do not mix Employment forms into dictionary UI |
| Status ↔ sprint alignment | Task 5 DoD on done transition |
| AR numbers fail-closed | later/reject + disabled categories stay non-grantable |
| PopulationPort fixtures | Named only — no cutover |
| Error UX (3.1 review) | Stable error **codes** for clients |

### Epic context

- **Epic 3:** Workforce Master Data & Organization — FR5–FR13.
- **This story:** FR-7 — Data-Dictionary-governed profile fields; spreadsheet ≠ enable.
- **Upstream (done):** 3.1 Person identity; 3.2 Employment invariants; Epic 2 envelope + sensitive categories.
- **Downstream:** 3.4 compensation enablement gated by dictionary; 4.8 retention of approved fields only; 5.1/5.2 search + profile sections; Epic 6 migration mapping; FR-50/FR-55 lifecycle/versioning.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Full personnel profile sections + timeline + DOM omit for all Epic 5 categories | Story 5.2 |
| Compensation facts module / schema | Story 3.4 |
| Org / Job / Assignment FKs | Stories 3.5–3.8 |
| Start / Return / Termination / event append | Stories 4.5–4.6+ |
| Formal AR-DATA owner sign-off + FR-55 governance UI | AR-DATA / later |
| Enable religion / health / family / bank / insurance production categories | AR-DATA |
| Personnel Code correction / merge / split / return-match | AR-DATA / AR-MIGRATION |
| PopulationPort real cutover | 3.5–3.9 / 4.x |
| Vitest/CI full suite | Still thin selfcheck pattern |
| Nest / CASL / client Prisma | Architecture |

### Architecture compliance

| Decision | Implication for 3.3 |
| --- | --- |
| AD-2 | Dictionary does not replace event history; no silent historical workforce overwrite |
| AD-3 | Registry + field gates live in `@divan/person-employment`; web uses published APIs only |
| AD-5 | Sensitive R/W still via envelope categories + access events; omit not mask |
| AD-6 | Prisma for registry/projection tables; no `@prisma/client` in `apps/web` |
| CAP-2 / FR-7 | Only AR-DATA-approved (partial freeze) fields enabled for MVP |
| FR-3 | Sensitive **categories** remain disabled by default until formal AR-DATA — independent of field disposition |

### Disposition → enablement rules (must follow)

```
enable(element) allowed ⇔
  disposition === "approve"
  AND metadataComplete(purpose, ownerSource, format, sensitivity, access, retention, export, audit)
  AND NOT disposition === "reject"

appearOnProfile(element, actor) ⇔
  element.enabled
  AND actor authorized for element.access / mapped category
  → otherwise OMIT key (API) / omit from DOM (UI)
```

Source of truth for MVP rows: `data-element-dispositions.md` — addendum §3 is **candidate catalogue only**.

### UX

- EXPERIENCE `person-profile-section` full layout = Epic 5. This story: thin field-gated render/edit on existing personnel surface.
- UX-DR8 / DESIGN: unauthorized fields excluded from DOM; sensitivity icon on governed categories belongs with Epic 5 profile polish — do not invent a card-heavy admin dashboard here.
- No full “Data Dictionary Admin” product in IA — optional thin registry list is enough.

### Library / stack

| Package | Pin / note |
| --- | --- |
| Prisma | **7.8.x** — prefer typed columns for registry keys; Json only for truly variable metadata blobs |
| PostgreSQL | **17.x** |
| Next.js | **16.2.x** |
| tRPC | **11.x** |
| `@divan/audit-envelope` | Category omit + governedProcedure — reuse |
| Vitest | Not required — selfcheck/tsx pattern |

### File structure (expected touch set)

| Path | Action |
| --- | --- |
| `packages/modules/person-employment/src/data-dictionary*.ts` | NEW — registry types, load/seed, enable/assert, field gate |
| `packages/modules/person-employment/src/*dictionary*.selfcheck.ts` | NEW |
| `packages/modules/person-employment/src/person.ts` | UPDATE — field gates + mobile format |
| `packages/modules/person-employment/src/normalize.ts` / `digits.ts` | UPDATE — mobile/contact format helpers |
| `packages/modules/person-employment/src/errors.ts` | UPDATE — dictionary/enablement/format codes + Persian msgs |
| `packages/modules/person-employment/src/index.ts` | UPDATE — exports |
| `packages/modules/person-employment/src/seed.ts` | UPDATE — seed dictionary rows |
| `packages/modules/person-employment/README.md` | UPDATE — FR-7 registry + enablement rules |
| `packages/db/prisma/schema.prisma` (+ migration) | UPDATE/NEW — `DataElement` (or equivalent) if persisted |
| `packages/kernel/audit-envelope/src/categories.ts` | UPDATE only if adding ordinary contact category docs — **do not** enable sensitive production hooks |
| `apps/web/src/server/person.ts` | UPDATE — omit/gate projection |
| `apps/web/components/personnel/personnel-panel.tsx` | UPDATE — only enabled fields in DOM |
| `apps/web/lib/operational-copy.ts` | UPDATE — Persian copy if needed |
| `package.json` (root + module) | UPDATE — `selfcheck:data-dictionary` |
| `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE |

### UPDATE files — current state (must preserve)

**`packages/db/prisma/schema.prisma` — `Person`:** Already has approve identity/contact columns; comment says full contact dictionary = 3.3. **Change:** add registry persistence if chosen; do **not** add `later` columns until disposition promotes them. Keep Employment Restrict FK intact.

**`packages/modules/person-employment/src/person.ts`:** Full identity CRUD with max lengths, nationalId category awareness, empty≠sentinel. **Change:** gate by dictionary enablement; canonicalize mobile; preserve Personnel Code uniqueness and blocked correct/merge/split/return-match.

**`packages/kernel/audit-envelope/src/categories.ts`:** Production sensitive hooks all `enabled: false`; `identity.person` ordinary in app registry. **Change:** preserve fail-closed; map dictionary fields to existing category ids — do not invent a parallel authz engine.

**`apps/web/src/server/person.ts` + `personnel-panel.tsx`:** Thin create/list. **Change:** field-gated forms; preserve Layout≠RSC and PermissionSet checks. **Do not** add Employment mutation UI.

**`packages/modules/person-employment/src/employment*.ts`:** Projection writers only. **Preserve:** untouched product verbs; dictionary must not call `applyEmploymentProjection` for “profile edits.”

### Testing requirements

| Case | Expect |
| --- | --- |
| Seed approve rows with complete metadata → enable | `enabled=true`; appear in `listEnabledProfileFields` |
| Attempt enable `later` or incomplete metadata | Rejected (stable code) |
| Attempt enable `reject` (religion) | Rejected; never appears on profile |
| Write Person field that is not enabled | Rejected |
| Read Person without national_id category grant | `nationalId` key omitted |
| mobilePhone Persian digits input | Stored canonical Latin; readable |
| mobilePhone invalid format | Rejected with code |
| Free-text without purpose (if modeled) | Rejected |
| Derived sensitivity downgrade without assessment (helper) | Rejected |
| Silent historical Employment/compensation overwrite API | Must not exist |
| Prior `selfcheck:person-identity` / `employment-lifecycle` | Still green |
| Thin UI: disabled field | Not present in DOM |

### Previous story intelligence

- **3.1 delivery:** Prisma migration → domain → governedProcedure → seed → selfcheck → deferred-work. Prefer hand-written SQL + `migrate deploy` if shadow DB fails.
- **3.1 review:** error **codes**; sentinel/`۰`; category gate order (registry before policy); do not leak nationalId without read grant.
- **3.2 delivery:** module + migration + selfcheck **without** large UI when AC allows — 3.3 needs **thin** UI because AC explicitly says render/edit, but stay far below Epic 5 profile.
- **3.2:** projection-only Employment writers — do not regress by adding product Employment CRUD “for dictionary demos.”
- **2.2:** explicitly deferred field-level dictionary to 3.3 — now implement it; do not re-implement category registry.

### Git intelligence

Recent: `51eb947` story 3.2 → `ce31f55` story 3.1 → `319be13` epic 2 retro. Pattern: one focused `story N.M` commit; selfcheck script; deferred-work + sprint-status sync on done. Expect 3.3 shape **between** 3.1 and 3.2: registry + Person gates + modest personnel UI delta.

### Latest tech notes

- Prefer **relational registry rows** over unbounded Json-as-schema for known metadata keys (purpose, format, …); use Prisma `Json` only for extensible bags that are not filtered in hot paths ([Prisma Json fields](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields)).
- Do not store Person MVP approve values as EAV — columns already exist; dictionary is governance, not a second source of truth for those attributes.
- FR-55 full versioning/approval workflow is foreshadowed (`registryVersion`) — do not build a change-control product in this story.

### Project context reference

No `project-context.md` in repo. Rely on Architecture Spine, epics sequencing, SPEC-divan dispositions, Stories 2.2 / 3.1 / 3.2, and this file.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3 sequencing; Story 3.3]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-3, FR-7, FR-55; AR-DATA; glossary Data Element/Dictionary]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §3 candidate catalogue only]
- [Source: `_bmad-output/specs/spec-divan/data-element-dispositions.md` — MVP approve/later/reject]
- [Source: `_bmad-output/specs/spec-divan/SPEC.md` — CAP-2; AR-DATA partial freeze]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-5, AD-6]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — person-profile-section; DOM omit]
- [Source: `_bmad-output/implementation-artifacts/3-1-stable-person-identity.md`]
- [Source: `_bmad-output/implementation-artifacts/3-2-employment-lifecycle-invariants.md`]
- [Source: `_bmad-output/implementation-artifacts/2-2-sensitive-categories-separate-export-permission.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — mobilePhone → 3.3]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Prisma migrate deploy: `20260717050000_data_element_registry`
- Selfchecks: `data-dictionary`, `person-identity`, `employment-lifecycle` all ok
- Typecheck: `@divan/person-employment`, `@divan/db`, `@divan/audit-envelope`, `@divan/web` ok

### Completion Notes List

- Prisma `DataElement` registry with typed FR-7 metadata; seed from AR-DATA partial freeze; `enableDataElement` fail-closed for later/reject/incomplete
- Person create/update gated by dictionary; `normalizeIranianMobilePhone` closes mobilePhone defer; `projectPersonRecord` omits disabled + unauthorized category keys
- Thin personnel UI renders only enabled approve fields (DOM omit); optional registry list via `listDictionary`
- Free-text / derived sensitivity helpers stubbed for 3.4+; no Employment history overwrite API
- Authz: national_id category gate unchanged; production sensitive categories not enabled

### File List

- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/20260717050000_data_element_registry/migration.sql
- packages/modules/person-employment/src/data-dictionary-types.ts
- packages/modules/person-employment/src/data-dictionary.ts
- packages/modules/person-employment/src/data-dictionary.selfcheck.ts
- packages/modules/person-employment/src/person-projection.ts
- packages/modules/person-employment/src/person.ts
- packages/modules/person-employment/src/digits.ts
- packages/modules/person-employment/src/errors.ts
- packages/modules/person-employment/src/seed.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/package.json
- packages/modules/person-employment/README.md
- apps/web/src/server/person.ts
- apps/web/src/server/trpc.ts
- apps/web/components/personnel/personnel-panel.tsx
- apps/web/lib/operational-copy.ts
- package.json
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/3-3-data-dictionary-governed-profile-fields.md

### Change Log

- 2026-07-17: Story 3.3 implementation — Data Dictionary registry, Person field gates, mobile format, thin UI, selfcheck → status review

---

**Ultimate context engine analysis completed — comprehensive developer guide created.**
