---
baseline_commit: d89a2d6
---

# Story 3.5: Organization Hierarchy Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want effective-dated Legal Entity → Business Unit → Department → Team hierarchy,
so that organization structure is governed without erasing history (FR9).

## Gate (read first)

**Epic 3 ↔ Epic 4 sequencing remains inviolable — with an explicit org-master-data nuance.**

Epic 3 delivers master-data entities, integrity constraints, reference schemas, and read/display fidelity. Authoritative mutations that create or change **Employment, Primary Assignment, Secondary Assignment, or compensation/contractual *state* through Personnel Events** land only in **Epic 4** after the append-only event store (Story 4.1). Epic 3 MUST NOT introduce a temporary CRUD write path for those workforce-state mutations that later must be thrown away.

**This story is org-unit master-data (FR-9), analogous to Person identity (FR-5) — not Assignment state.**

| Allowed in 3.5 | Forbidden in 3.5 |
| --- | --- |
| Create / activate / deactivate **Organizational Units** (LE / BU / Dept / Team) | Create/change/end Primary or Secondary Assignment |
| Maintain effective-dated parent/child hierarchy + validity intervals | Start / Return / Termination / Transfer Employment |
| Thin Admin UI on **ساختار سازمان** (`/organization`) | Temporary “assign person to team” / member-move CRUD |
| Seed + selfcheck writers for hierarchy fixtures | Append Personnel Events; invent reorg that mutates Assignments as truth |
| Block deactivation-with-deps fail-closed until AR disposition | Invent AR-TEMPORAL / AR-HEADCOUNT disposition policy |
| Document Team as Epic 4 minimum Primary-org fact | Interactive org chart; Workstation/Floor as org units |

- **AD-2:** OrgUnit rows are **reference / master-data projections**, not event-store authority for workforce mutations. Do not treat org upsert as a substitute for Transfer/Start events.
- **AD-3:** Organization / reference (FR-9..FR-13) lives in **`@divan/person-employment`** — not a new package, not identity-access, not compensation-facts. Public API from `src/index.ts` only; `apps/web` must not import Prisma models.
- **AD-5 / AD-6:** `governedProcedure` + envelope; no `@prisma/client` in `apps/web`; Layout ≠ RSC.
- **Naming collision (CRITICAL):** `OrganizationalScope` (access-admin / authz population boundary) ≠ **Organizational Unit** (LE→BU→Dept→Team hierarchy). Do **not** merge, rename, or FK-collapse these models. Do **not** reuse `org:selfcheck` scope codes as org-unit codes.
- **Contracting Entity / Insuring Entity** (compensation-facts free-text) may differ from organizational Legal Entity — do not collapse them into one table or require FK to OrgUnit Legal Entity in this story.
- **AR numbers fail-closed:** deactivation with active members / future Assignment / Personnel Event / Reservation / reporting dependencies → block with Persian explanation until AR-TEMPORAL + AR-HEADCOUNT define disposition. Impossible retroactive re-parenting → block (or defer to authoritative temporal process) — do not invent soft “force reparent.”
- Reuse `@divan/temporal-engine` half-open intervals. Prefer hand-written migration + `prisma migrate deploy` (Shadow DB pain from 3.1).

[Source: `epics.md` Epic 3 sequencing + Story 3.5; `prd.md` FR-9; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6; Stories 3.1–3.4; `deferred-work.md`]

## Acceptance Criteria

1. **Given** Admin access to ساختار سازمان  
   **When** units are created, activated, or deactivated  
   **Then** history is retained (no hard-delete / cascade-erase of historical validity)

2. **And** deactivation with active members or future Assignment / Personnel Event / Reservation / reporting dependencies is blocked until AR-TEMPORAL / AR-HEADCOUNT disposition exists (fail-closed Persian explanation)

3. **And** at every evaluated as-of date a child's validity interval falls within its required parent's validity interval

4. **And** impossible retroactive re-parenting is blocked (or corrected only via authoritative temporal process — not a throwaway bypass in this story)

5. **And** surface uses Persian RTL forms consistent with the app shell (tokens, Jalali where dates are shown, Persian digits for display where UX requires)

6. **And** hierarchy shape is exactly Legal Entity → Business Unit → Department → Team (each child under exactly one parent of the required type); activate/deactivate does not erase history

7. **And** Layout ≠ RSC / UI ≠ data access / default-deny / no client `@prisma/client` / OrganizationalScope authz model remain intact

8. **And** this story does **not** deliver interactive org chart, job reference CRUD (Story 3.6), Assignment integrity (3.7–3.8), management derivation (3.9), or Employment/Assignment product mutations (Epic 4)

## Tasks / Subtasks

- [x] Task 1: Organizational Unit schema in `@divan/db` owned by person-employment (AC: #1, #3, #4, #6)
  - [x] Add Prisma model(s) in `public` schema (preferred single `OrganizationalUnit` table with `unitType` enum/discriminant — document choice in module README):
    - `id` — server UUID PK (prefer UUID v7 pattern used by Person/Employment — **not** `cuid()` solely because OrganizationalScope uses it)
    - `code` — stable domain code `String @unique` (Latin-normalized; display may show Persian digits)
    - `nameFa` — Persian label (required; empty → reject; no `""` / `"N/A"` sentinels)
    - `unitType` — `LEGAL_ENTITY` | `BUSINESS_UNIT` | `DEPARTMENT` | `TEAM`
    - `parentId` — `String?` FK → same table `onDelete: Restrict` (LE has `parentId = null`; BU→LE; Dept→BU; Team→Dept)
    - Half-open validity: `startDate` `DateTime @db.Date`, `endDateExclusive` `DateTime? @db.Date` (`null` = open / active interval)
    - `active` boolean **or** derive active-as-of from interval + explicit deactivate that closes interval — pick one coherent model; **deactivate MUST NOT delete the row**
    - Timestamps `createdAt` / `updatedAt`; optional `sourceEventId` placeholder null until temporal reorg process exists
  - [x] Enforce type→parent rules in domain (and DB CHECK if practical): LE no parent; BU parent must be LE; Dept parent BU; Team parent Dept — reject skip-level / wrong-type parents
  - [x] Index `parentId` (adjacency list reads / future recursive CTE)
  - [x] Prefer adjacency list for MVP (~NFR-13 ~500 people; shallow fixed depth 4). Do **not** introduce `ltree` / nested sets / closure table unless measured need — recursive CTE acceptable later for tree reads
  - [x] Update `packages/db/prisma/schema.prisma` header: note Story 3.5 OrgUnit; clarify OrganizationalScope remains authz-only
  - [x] Hand-written migration SQL + `prisma migrate deploy` — no Shadow DB / `migrate dev` dependency
  - [x] **Do not** add `teamId` / `orgUnitId` FK onto `Employment` yet unless required for a selfcheck-only fixture comment — Primary Assignment Team membership is Story **3.7** + Epic 4. Update `EMPLOYMENT_MINIMUM_FACTS` notes when live OrgUnit rows exist (“schema ready; Assignment still Epic 4”)

- [x] Task 2: Domain invariants + public API in `@divan/person-employment` (AC: #1–#4, #6)
  - [x] New files (mirror employment/compensation patterns): e.g. `org-unit.ts`, `org-unit-invariants.ts`, `org-errors.ts` (or extend `errors.ts`), `org-unit.selfcheck.ts`, README section
  - [x] Pure validators using `@divan/temporal-engine`:
    - `assertValidOrgInterval(start, endExclusive)`
    - `assertChildWithinParent(child, parent, asOf?)` — child interval ⊆ parent interval at every evaluated date (for open intervals: child cannot outlive parent)
    - `assertValidParentType(childType, parentType | null)`
    - `isOrgUnitActiveAsOf` / `getOrgUnitAsOf` / `listOrgUnits` / `listChildren` / optional `getHierarchyAsOf`
  - [x] Public writers (org **master-data** verbs — allowed product surface):
    - `createOrgUnit(input)` — validate type/parent/interval nesting; reject sentinels
    - `activateOrgUnit(id, …)` / `deactivateOrgUnit(id, …)` — retain history; deactivate closes or flags inactive without delete
    - Optional `updateOrgUnitIdentity(id, { code?, nameFa? })` for non-structural edits — do **not** silently allow impossible re-parent via update
  - [x] `reparentOrgUnit` (if exposed): only when resulting hierarchy remains valid for all overlapping dates; otherwise throw `IMPOSSIBLE_REPARENT` / `BLOCKED_ORG_OPERATION` fail-closed — **no** force flag
  - [x] Dependency gate on deactivate: check for known dependency projections when they exist; today Assignment/Reservation/Event tables may be absent — still implement a **named** `assertOrgUnitDeactivationAllowed` that:
    - Returns OK when no dependency tables/rows exist yet
    - **Fail-closes** with stable code + Persian message when any future hook reports active members / scheduled deps
    - Documents that full member/Reservation checks land when 3.7+ / Epic 4 / headcount projections exist — do **not** invent disposition workflows
  - [x] Typed errors: stable codes + `messageFa` (e.g. `ORG_UNIT_NOT_FOUND`, `INVALID_PARENT_TYPE`, `CHILD_OUTSIDE_PARENT_VALIDITY`, `IMPOSSIBLE_REPARENT`, `DEACTIVATION_BLOCKED_DEPENDENCIES`, `DUPLICATE_ORG_CODE`) — clients match **codes**, not Persian substrings
  - [x] Export from `src/index.ts` only
  - [x] **Do not** export Assignment verbs (`assignPersonToTeam`, `transferPrimary`, …)

- [x] Task 3: Permissions + governed tRPC (AC: #5, #7)
  - [x] Add PermissionSet codes: `organization.read` / `organization.write` (dotted lowercase — mirror `person.*`)
  - [x] Seed into demo PermissionSet(s) used by `hr_admin` (nav already shows `/organization` for hr_admin only). Do **not** invent AR-ACCESS production matrices; demo/dev binding only
  - [x] Ordinary data category for org structure — e.g. `organization.unit` (enabled ordinary / demo-safe). Do **not** put hierarchy under `compensation` or `identity.national_id`
  - [x] Router `apps/web/src/server/organization.ts` + wire in `root.ts`:
    - `organization.list` / `organization.get` / `organization.hierarchyAsOf` (read)
    - `organization.create` / `organization.activate` / `organization.deactivate` (write)
    - Optional `organization.updateIdentity` — no silent reparent
  - [x] `governedProcedure` meta: `permission`, `dataCategory`, `action`, `organizationalScope`, `operation` (`organization.create`, …), `sensitive: false` unless AR later reclassifies
  - [x] Map domain errors → `TRPCError` + `divanCode`; config/validation misses → `BAD_REQUEST` (not `FORBIDDEN`) — lesson from 3.3
  - [x] Denied → Persian access copy; no payload leak

- [x] Task 4: ساختار سازمان UI (AC: #5, #7, #8)
  - [x] Convert `apps/web/app/(app)/organization/page.tsx` from `PlaceholderPage` to RSC shell like `/access` / `/personnel`: `auth()` → `assertPageAccess(coarseRole, "/organization")` → client panel
  - [x] Thin Admin panel (Persian RTL):
    - List / tree-or-nested view of LE→BU→Dept→Team (**simple hierarchy view** — **not** interactive org chart / drag-drop)
    - Create unit form: type, parent (constrained by type), code, nameFa, startDate (Jalali picker), optional end
    - Activate / deactivate actions with confirm + Persian operational copy when blocked
    - Show inactive/historical units without erasing them (filter toggle OK)
  - [x] Interactive a11y DoD: keyboard, visible focus, RTL, no emoji; loading/empty/error operational copy; one dialog stack level max (UX-DR19)
  - [x] Do **not** build job Role/Title/Ladder/Grade UI here (Story 3.6 may share the same nav surface later — leave a clear section boundary or “coming soon” only if needed; prefer ship hierarchy only)
  - [x] Do **not** show member lists that imply Assignment write capability

- [x] Task 5: Seed + selfcheck + PopulationPort note + DoD (AC: #1–#8)
  - [x] Seed a minimal demo hierarchy (e.g. 1 LE → 1 BU → 1 Dept → 1–2 Teams) with ≥1 closed historical interval and ≥1 open current where useful; wire from `identity-access` seed after person/employment fixtures (org has no Person FK required)
  - [x] `org-unit.selfcheck.ts` (or `organization-hierarchy.selfcheck.ts`) + package script + root `selfcheck:organization-hierarchy`
  - [x] Cases in Testing table below
  - [x] Update `population-cutover.ts` / README: OrgUnit projections now exist; **PopulationPort complete cutover still waits on Assignment (3.7+) / Epic 4** — subject id target remains `Person.id` UUID; do not claim cutover done; do not invent parallel population checker
  - [x] Update `deferred-work.md`: close “Org hierarchy tables / Legal Entity→Team = Story 3.5”; note AR-TEMPORAL/AR-HEADCOUNT disposition still open; Assignment FKs → 3.7/Epic 4; job refs → 3.6; interactive chart remains non-goal
  - [x] Update `EMPLOYMENT_MINIMUM_FACTS` notes for org row when schema live
  - [x] Preserve prior selfchecks green: `person-identity`, `employment-lifecycle`, `data-dictionary`, `compensation-facts`, `audit-envelope`, `inference-bulk` (as applicable)
  - [x] `pnpm` typecheck: `@divan/person-employment`, `@divan/db`, `@divan/temporal-engine`, `@divan/web`, `@divan/identity-access` (if seed/permissions touched)
  - [x] **When marking done:** sync story-file `Status: done` with `sprint-status.yaml` key `3-5-organization-hierarchy-management`

### Review Findings

- [x] [Review][Decision] مدل منسجم `active` در برابر بازهٔ نیمه‌باز — **Resolved: synced dual (C)** — deactivate closes interval + `active=false` (end required); activate reopens (`endDateExclusive=null`) + `active=true`; create with closed end ⇒ inactive; as-of reads from interval.
- [x] [Review][Patch] تاریخ as-of درخت UI هاردکد `2026-07-17` است [apps/web/components/organization/organization-panel.tsx:173]
- [x] [Review][Patch] بستن بازهٔ والد بدون تضمین ⊆ بودن فرزندان (AC3) [packages/modules/person-employment/src/org-unit.ts:354]
- [x] [Review][Patch] واحدهای as-of که والدشان خارج از بازه است بی‌صدا از درخت حذف می‌شوند [packages/modules/person-employment/src/org-unit.ts:590]
- [x] [Review][Patch] `DEACTIVATION_BLOCKED_DEPENDENCIES` / `BLOCKED_ORG_OPERATION` به‌اشتباه `FORBIDDEN` شده‌اند (باید `BAD_REQUEST`) [apps/web/src/server/organization.ts:63]
- [x] [Review][Patch] ایجاد/فعال‌سازی زیر والد با `active=false` مسدود نمی‌شود [packages/modules/person-employment/src/org-unit.ts:270]
- [x] [Review][Patch] شاخهٔ `treeNodes` نسبت به `includeInactive` مرده است؛ لیست همیشه `includeInactive: true` [apps/web/components/organization/organization-panel.tsx:257]
- [x] [Review][Patch] پیام خطای `unitType` نامعتبر / فاسد از پیام‌های گمراه‌کننده استفاده می‌کند [packages/modules/person-employment/src/org-unit.ts:233]
- [x] [Review][Patch] پرتاب استثنای خام از dependency hook به‌جای `OrgUnitError` fail-closed [packages/modules/person-employment/src/org-unit.ts:217]
- [x] [Review][Patch] `list`/`get` خطای `VALIDATION` از `mapOrgUnit` را map نمی‌کنند [apps/web/src/server/organization.ts:117]

## Dev Notes

### Epic 2 / 3.1–3.4 carry-in

| Item | How 3.5 absorbs it |
| --- | --- |
| Epic 3↔4 no temporary CRUD | Gate: org-unit master-data OK; Employment/Assignment/compensation state CRUD forbidden |
| Person identity pattern (3.1) | Same class of master-data product writes + thin Admin UI |
| Employment intervals (3.2) | Mirror half-open + temporal-engine; no Employment mutation here |
| Data Dictionary (3.3) | Org unit labels are not dictionary profile fields — do not force ELEMENT_ID for LE/BU/Dept/Team names unless AR-DATA later requires |
| Compensation isolation (3.4) | Keep contracting/insuring entity strings separate from OrgUnit Legal Entity |
| Status ↔ sprint alignment | Task 5 DoD on done transition |
| AR numbers fail-closed | Deactivate-with-deps + impossible reparent blocked |
| PopulationPort fixtures | Advance note only — cutover incomplete without Assignment |
| Error UX | Stable **codes**; BAD_REQUEST vs FORBIDDEN |
| Layout ≠ RSC | `/organization` assert before panel |
| Review anti-patterns | No production skip-gates; whitespace dates → validation error; seed shape + `$transaction`; map FK `P2003`; Prisma runtime from `@divan/db` |

### Epic context

- **Epic 3:** Workforce Master Data & Organization — FR5–FR13.
- **This story:** FR-9 — governed effective-dated org hierarchy; activate/deactivate without erase; parent/child validity.
- **Upstream (done):** 3.1 Person; 3.2 Employment; 3.3 Dictionary; 3.4 Compensation (isolated).
- **Downstream:** 3.6 job refs (same nav surface); 3.7 Primary Assignment (Team membership); 3.9 management derivation; 4.5 Start minimum facts; 4.11 historical org; Epic 6 hierarchy validation on import.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Interactive organization chart / drag-drop reorg UI | PRD non-goal / Could-Have only |
| Job Role / Title / Ladder / Grade / Seniority CRUD | Story 3.6 |
| Primary/Secondary Assignment create/change | 3.7–3.8 constraints; mutations Epic 4 |
| Member transfer / Start Employment | 4.5–4.7 |
| Deactivation disposition workflows | AR-TEMPORAL + AR-HEADCOUNT |
| Headcount Approval / Reservation | Epic 4 |
| PopulationPort full cutover | 3.7+ / 4.x |
| Merge OrganizationalScope with OrgUnit | Never — different domains |
| Workstation / Floor as Organizational Units | Non-goal |
| Vitest/CI full suite | Thin selfcheck continues |

### Architecture compliance

| Decision | Implication for 3.5 |
| --- | --- |
| AD-1 | Single process + one PostgreSQL; no org microservice |
| AD-2 | Org master-data ≠ Personnel Event authority |
| AD-3 | Own APIs in `person-employment`; no casual cross-module table access |
| AD-5 | Envelope on governed routes; access events on decisions |
| AD-6 | Prisma projections; no web Prisma; tRPC wraps module |
| FR-9 | LE→BU→Dept→Team; history retained; child ⊆ parent; deps blocked |
| NFR-4 | Domain invariants; optional DB CHECKs |
| NFR-12 / UX-DR | Persian RTL; a11y floor; tokens |

### Temporal rules (must follow)

```
Active at as-of D ⇔ startDate ≤ D < endDateExclusive
Child ⊆ Parent    ⇔ ∀ D where child active: parent active AND child interval within parent
Back-to-back OK   ⇔ A.endDateExclusive === B.startDate (same unit history versions if versioned)
```

Asia/Tehran date-only Effective Dates. Effective Date ≠ `createdAt` / registration time.

### Schema recommendation (developer default)

**Preferred:** single `OrganizationalUnit` adjacency table + `unitType` + `parentId` + half-open validity + `active`/interval deactivate semantics.

**Avoid for MVP:** closure table, nested sets, `ltree`, multi-parent matrix org, skip-level units, shared teams across departments.

Tree reads: Prisma `findMany` + in-memory nest for depth-4 is acceptable at launch scale; recursive CTE via Prisma typed SQL / `$queryRaw` OK if needed — index `parentId`.

### UPDATE files — current state (read before editing)

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `apps/web/app/(app)/organization/page.tsx` | `PlaceholderPage` only | RSC + assertPageAccess + org panel | Title/IA «ساختار سازمان»; hr_admin nav visibility |
| `packages/db/prisma/schema.prisma` | Person, Employment, OrganizationalScope, CompensationFact, … | Add OrganizationalUnit model(s) | **OrganizationalScope** unchanged meaning; compensation schema isolation |
| `packages/modules/person-employment/src/*` | Person / Employment / Dictionary | Org unit domain + exports + selfcheck | Existing public APIs; no Assignment writers |
| `packages/modules/person-employment/src/employment-minimum-facts.ts` | Org row “not live FKs in 3.2” | Update notes when OrgUnit live | Still no Assignment enforcement |
| `packages/modules/person-employment/src/population-cutover.ts` | Fixture until 3.5–3.9 | Note OrgUnit landed; cutover still open | Subject id = Person UUID |
| `packages/modules/identity-access/src/navigation.ts` | `/organization` for hr_admin | Usually unchanged | Role matrix |
| `packages/modules/identity-access/src/seed.ts` | Accounts + person/employment/compensation seeds | Bind `organization.*` permissions; call org seed | Existing seed idempotency |
| `apps/web/src/server/root.ts` | person, accessAdmin, … | Register `organization` router | Existing routers |
| `OrganizationalScope` APIs | Access-admin scopes | **No semantic merge** | `org:selfcheck` demos |

### Previous story intelligence (3.4 → 3.5)

- Delivery shape: hand-written migration → domain module → seed → selfcheck → optional tRPC → thin UI when AC requires → deferred-work + sprint sync.
- 3.4 had **no** operator UI (projection-only). **3.5 requires UI** — pattern closer to **3.1** `/personnel` than 3.4.
- Writer naming: for org master-data, product verbs `createOrgUnit` / `deactivateOrgUnit` are correct; do **not** rename them to `applyOrgProjection` unless you also keep product aliases — Assignment/Employment still use `apply*Projection`.
- Must not repeat 3.4 review misses: production skip-gates, weak seed idempotency, unmapped `P2003`, wrong Prisma import path, whitespace-as-null dates.
- `baseline_commit`: `d89a2d6` (story 3.4).

### Git intelligence summary

Recent commits: `d89a2d6` story 3.4 → `f271a15` 3.3 → `51eb947` 3.2 → `ce31f55` 3.1 → `319be13` epic 2 retro. Follow the same story-commit discipline and selfcheck scripting pattern.

### Latest tech information

- **Prisma 7.8.x** (repo): projections only; recursive hierarchy reads via adjacency + optional recursive CTE / typed SQL — preferred over inventing nested sets.
- **PostgreSQL 17.x:** adjacency list + `parent_id` index is the default for shallow, write-friendly trees; depth guard (max 4) matches fixed LE→Team shape.
- **tRPC 11.x / Next.js 16.2.x:** RSC page gate + client panel; reuse existing Jalali date picker + Persian digit display helpers from Epic 1 / 3.1.
- Do not add Drizzle — stack is Prisma.

### Library / framework requirements

| Lib | Use |
| --- | --- |
| `@divan/temporal-engine` | Interval math / as-of |
| `@divan/db` | Prisma client accessor inside module |
| `@divan/audit-envelope` | Governed procedure / authorize |
| `@divan/identity-access` | Permission seed + nav (coarse) |
| Existing web UI primitives | Forms, Jalali picker, operational copy — match `/access` / `/personnel` |

### File structure requirements

```
packages/db/prisma/schema.prisma                          # UPDATE — OrganizationalUnit
packages/db/prisma/migrations/<ts>_organization_units/    # NEW — SQL
packages/modules/person-employment/src/org-unit.ts        # NEW (name flexible)
packages/modules/person-employment/src/org-unit-invariants.ts
packages/modules/person-employment/src/org-unit.selfcheck.ts
packages/modules/person-employment/src/index.ts           # UPDATE exports
packages/modules/person-employment/README.md              # UPDATE ownership
packages/modules/identity-access/src/seed.ts              # UPDATE permissions + seed wire
apps/web/src/server/organization.ts                       # NEW
apps/web/src/server/root.ts                               # UPDATE
apps/web/app/(app)/organization/page.tsx                  # UPDATE
apps/web/components/organization/*                        # NEW thin panel (as needed)
package.json (root + person-employment)                   # selfcheck script
```

### Testing requirements

| Case | Expect |
| --- | --- |
| Create LE → BU → Dept → Team chain | Succeeds; parents typed correctly |
| Create BU under Dept (wrong parent type) | Reject `INVALID_PARENT_TYPE` |
| Child start before parent start / child end after parent end | Reject `CHILD_OUTSIDE_PARENT_VALIDITY` |
| Deactivate unit (no deps yet) | Succeeds; row retained; history readable as-of |
| Deactivate when dependency hook reports blockers | Reject `DEACTIVATION_BLOCKED_DEPENDENCIES` |
| Reparent creating impossible overlap | Reject `IMPOSSIBLE_REPARENT` |
| Duplicate `code` | Reject `DUPLICATE_ORG_CODE` |
| Sentinel name `""` / `"N/A"` | Reject |
| Delete parent with children (DB) | Restrict / domain reject — no cascade-erase |
| asOf outside all intervals | Empty / inactive — not fake active |
| OrganizationalScope CRUD still works | Unchanged demos (`org:selfcheck`) |
| Prior selfchecks | Remain green |
| No Assignment mutation API on public surface | Assert absence |

### Project context reference

- No `project-context.md` in repo; follow `ARCHITECTURE-SPINE.md`, `epics.md`, Stories 3.1–3.4, and this file.
- Communication with user: Persian; story artifact language: English (document_output_language).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 3.5 / Epic 3 sequencing]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md`#FR-9]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md`#§2.1]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md`#AD-2–AD-6 / capability map]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md`#Information Architecture]
- [Source: `_bmad-output/implementation-artifacts/3-1-stable-person-identity.md` Gate/UI pattern]
- [Source: `_bmad-output/implementation-artifacts/3-4-compensation-contractual-facts-module.md` delivery + review lessons]
- [Source: `packages/modules/person-employment/src/employment-minimum-facts.ts`]
- [Source: `packages/modules/person-employment/src/population-cutover.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Prisma migrate deploy: `20260717210000_organization_units` applied successfully
- Typecheck green: person-employment, db, temporal-engine, identity-access, web, audit-envelope
- Selfchecks green: organization-hierarchy, person-identity, employment-lifecycle, data-dictionary, compensation-facts, audit-envelope, inference-bulk

### Completion Notes List

- Single `OrganizationalUnit` adjacency table + `unitType`; as-of from half-open interval; **synced dual** activate/deactivate (close/reopen interval + `active` flag; no hard-delete)
- Domain: type→parent rules, child ⊆ parent (incl. on parent close), inactive-parent gate, `assertOrgUnitDeactivationAllowed` (active children + hook registry), `reparentOrgUnit` fail-closed
- Governed tRPC `organization.*` with `organization.read`/`organization.write` + `organization.unit` category; OrgUnitError → BAD_REQUEST (domain) / FORBIDDEN (permission only)
- Thin `/organization` RSC + Persian RTL panel (tree as-of today Tehran, create, activate/deactivate with required end) — no Assignment UI
- Demo seed LE→BU→Dept→Teams (historical + active); PopulationPort cutover note updated (still waits on Assignment)

### File List

- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/20260717210000_organization_units/migration.sql
- packages/modules/person-employment/src/errors.ts
- packages/modules/person-employment/src/org-unit-invariants.ts
- packages/modules/person-employment/src/org-unit.ts
- packages/modules/person-employment/src/org-unit.selfcheck.ts
- packages/modules/person-employment/src/permissions.ts
- packages/modules/person-employment/src/seed.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/src/employment-minimum-facts.ts
- packages/modules/person-employment/src/population-cutover.ts
- packages/modules/person-employment/package.json
- packages/modules/person-employment/README.md
- packages/modules/identity-access/src/seed.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/src/index.ts
- apps/web/src/server/organization.ts
- apps/web/src/server/root.ts
- apps/web/src/server/trpc.ts
- apps/web/app/(app)/organization/page.tsx
- apps/web/components/organization/organization-panel.tsx
- apps/web/lib/operational-copy.ts
- package.json
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/3-5-organization-hierarchy-management.md

### Change Log

- 2026-07-17: Implemented Story 3.5 organization hierarchy management (schema, domain, tRPC, UI, seed, selfcheck)
- 2026-07-17: Code review patches — synced dual active/interval, as-of today, BAD_REQUEST mapping, hierarchy orphan filter, UI/selfcheck fixes

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
