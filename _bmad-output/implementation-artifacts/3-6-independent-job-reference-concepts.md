---
baseline_commit: d2e67c4
---

# Story 3.6: Independent Job Reference Concepts

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want Organizational Role, Job Title, Ladder, Grade, and Seniority as distinct references,
so that job concepts stay independent and Ladder–Grade compatible (FR10).

## Gate (read first)

**Epic 3 ↔ Epic 4 sequencing remains inviolable — job refs are master-data, not Assignment state.**

Epic 3 delivers master-data entities, integrity constraints, reference schemas, and read/display fidelity. Authoritative mutations that create or change **Employment, Primary Assignment, Secondary Assignment, or compensation/contractual *state* through Personnel Events** land only in **Epic 4** after the append-only event store (Story 4.1). Epic 3 MUST NOT introduce a temporary CRUD write path for those workforce-state mutations that later must be thrown away.

**This story is job-reference master-data (FR-10), analogous to OrgUnit (FR-9) and Person identity (FR-5) — not Assignment / job-change events.**

| Allowed in 3.6 | Forbidden in 3.6 |
| --- | --- |
| Create / activate / deactivate **Organizational Role, Job Title, Ladder, Grade, Seniority** | Create/change/end Primary or Secondary Assignment |
| Maintain Ladder→Grade membership (incl. half-grades); keep Seniority independent | Job Title / Seniority / Grade / Role change **Personnel Events** (Story 4.8) |
| Thin Admin UI section on **ساختار سازمان** (`/organization`) for job refs | Universal Grade↔Seniority mapping product rule |
| Seed + selfcheck fixtures for the five concepts | Append Personnel Events; invent Assignment FK writers |
| Block deactivation-with-deps fail-closed until AR disposition | Invent AR-TEMPORAL disposition policy |
| `listGradesForLadder(ladderId)` / compatibility helpers for later Assignment UI | Headcount Approval / consumption / Override |
| Document job facts as Epic 4 / 3.7 Primary Assignment carriers | Merge job refs into OrgUnit table or OrganizationalScope |

- **AD-2:** Job-reference rows are **reference / master-data projections**, not event-store authority for workforce mutations. Do not treat job upsert as a substitute for Role/Title/Ladder/Grade/Seniority change events.
- **AD-3:** Organization / reference (FR-9..FR-13) lives in **`@divan/person-employment`** — not a new package, not identity-access, not compensation-facts, not headcount. Public API from `src/index.ts` only; `apps/web` must not import Prisma models.
- **AD-5 / AD-6:** `governedProcedure` + envelope; no `@prisma/client` in `apps/web`; Layout ≠ RSC.
- **Independence (CRITICAL — FR-10 / addendum §2.2):**
  - Five **distinct** concepts — never collapse Role↔Title, Title↔Ladder, Grade↔Seniority, or job refs↔OrgUnit.
  - **Grade belongs to exactly one Ladder**; Grade options for any Assignment/event picker are limited to the chosen Ladder, including configured **half-grades**.
  - **No universal Grade-to-Seniority mapping** in product code. Optional Ladder-specific Grade/Seniority mapping (addendum hypothesis) is **out of scope** — do not invent it.
- **Naming collisions:**
  - `Organizational Role` (job reference) ≠ Auth.js / `CoarseRole` ≠ AccessRole.
  - `OrganizationalScope` (authz population) ≠ Organizational Unit ≠ job references.
  - Do **not** reuse `org:selfcheck` scope codes as Job Title codes.
- **AR numbers fail-closed:** deactivating or changing a reference used by an Assignment or Personnel Event that is **active or Scheduled** → block with Persian explanation until AR-TEMPORAL defines disposition. Today Assignment/Event tables may be absent — still implement named dependency hooks (mirror OrgUnit).
- Reuse `@divan/temporal-engine` half-open intervals where validity applies. Prefer hand-written migration + `prisma migrate deploy` (Shadow DB pain from 3.1).
- Prefer **synced dual** activate/deactivate semantics from Story 3.5 (close/reopen interval + `active` flag; never hard-delete).

[Source: `epics.md` Epic 3 sequencing + Story 3.6; `prd.md` FR-10 + Glossary; `addendum.md` §2.1–2.2 / §2.5 Ladder–Grade; `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-5/AD-6; Story 3.5; `deferred-work.md`]

## Acceptance Criteria

1. **Given** Admin reference-data management  
   **When** Grades are selected for an Assignment or event (API helper / Admin picker used by later stories)  
   **Then** Grade options are limited to the chosen Ladder, including configured half-grades

2. **And** the product imposes no universal Grade-to-Seniority mapping (no shared mandatory FK, join table, or validation that forces Grade↔Seniority pairs)

3. **When** deactivating or changing a Role, Job Title, Ladder, Grade, or Seniority used by an active or Scheduled Assignment/event  
   **Then** the change is blocked until AR-TEMPORAL-approved disposition of dependencies (fail-closed Persian explanation + stable error code)

4. **And** Organizational Role, Job Title, Ladder, Grade, and Seniority are stored and administered as **five distinct** reference concepts (separate identities; Grade FK→Ladder only)

5. **And** surface uses Persian RTL forms consistent with the app shell (tokens, Jalali where dates are shown, Persian digits for display where UX requires) on **ساختار سازمان**

6. **And** Layout ≠ RSC / UI ≠ data access / default-deny / no client `@prisma/client` / OrganizationalScope authz model / OrgUnit hierarchy remain intact

7. **And** this story does **not** deliver Assignment integrity (3.7–3.8), management derivation (3.9), job-change Personnel Events (4.8), Headcount Approval matching (Epic 4), interactive org chart, or Employment/Assignment product mutations

## Tasks / Subtasks

- [x] Task 1: Job reference schema in `@divan/db` owned by person-employment (AC: #1, #2, #4)
  - [x] Add Prisma models in `public` schema (five concepts — **do not** fold into `OrganizationalUnit`):
    - Shared field pattern (mirror OrgUnit where sensible):
      - `id` — UUID v7 PK (`@default(uuid(7))`) — **not** `cuid()` solely because OrganizationalScope uses it
      - `code` — stable domain code; unique **per concept table** (Latin-normalized; display may show Persian digits)
      - `nameFa` — Persian label (required; empty → reject; no `""` / `"N/A"` sentinels)
      - Half-open validity: `startDate` `DateTime @db.Date`, `endDateExclusive` `DateTime? @db.Date` (`null` = open)
      - `active` boolean synced with activate/deactivate (Story 3.5 dual model)
      - `createdAt` / `updatedAt`; optional `sourceEventId` null until temporal process exists
    - **OrganizationalRole** — responsibility/function reference
    - **JobTitle** — classification used later for Assignment + headcount matching (schema only; no headcount FK yet)
    - **Ladder** — ordered grade family
    - **Grade** — level within one Ladder:
      - `ladderId` FK → Ladder `onDelete: Restrict`
      - Half-grade support: prefer **`rank` as `Decimal @db.Decimal(4, 1)`** (or integer half-steps: store `rankHalfSteps Int` where 1 = 0.5) — **never `Float`**
      - `@@unique([ladderId, code])` and/or `@@unique([ladderId, rank])` — document choice in README
      - Index `ladderId`
    - **Seniority** — independent classification (**no** required FK to Grade or Ladder)
  - [x] Update `packages/db/prisma/schema.prisma` header: note Story 3.6 job refs; clarify independence from OrgUnit / OrganizationalScope
  - [x] Hand-written migration SQL + `prisma migrate deploy` — no Shadow DB / `migrate dev` dependency
  - [x] **Do not** add job FKs onto `Employment` / invent Assignment tables yet — Primary Assignment job facts = Story **3.7** + Epic 4 writers. Update `EMPLOYMENT_MINIMUM_FACTS` notes when refs exist (“schema ready; Assignment still Epic 4”)

- [x] Task 2: Domain invariants + public API in `@divan/person-employment` (AC: #1–#4)
  - [x] New files (mirror org-unit pattern): e.g. `job-reference.ts`, `job-reference-invariants.ts`, extend `errors.ts`, `job-reference.selfcheck.ts`, README section
  - [x] Pure validators:
    - `assertValidJobRefInterval` / reuse org interval helpers if identical
    - `assertGradeBelongsToLadder(grade, ladderId)`
    - `listGradesForLadder(ladderId, asOf?)` — **only** grades of that ladder (incl. half-grades); empty if ladder inactive/missing
    - `isJobRefActiveAsOf` / get/list per concept
    - **Explicit non-API:** no `assertGradeSeniorityCompatible` / no mapping table writers
  - [x] Public writers (master-data verbs — allowed product surface):
    - `createOrganizationalRole` / `createJobTitle` / `createLadder` / `createGrade` / `createSeniority`
    - `activate*` / `deactivate*` per concept — retain history; never hard-delete
    - Optional `update*Identity` for code/nameFa (and Grade rank within ladder) — changing `grade.ladderId` only when no deps and resulting uniqueness holds; otherwise fail-closed
  - [x] Dependency gate on deactivate/structural change: named `assertJobRefDeactivationAllowed` (and change-allowed) with hook registry:
    - Returns OK when no Assignment/Event dependency tables/rows exist yet
    - Fail-closes with stable code + Persian message when hooks report active/Scheduled deps
    - Documents full checks land when 3.7+ / Epic 4 event projections exist — **do not** invent disposition workflows
  - [x] Ladder deactivate: fail-closed if active Grades exist **or** hooks report Assignment deps (choose coherent policy: block ladder deactivate while child grades active — recommended)
  - [x] Typed errors: stable codes + `messageFa` (e.g. `JOB_REF_NOT_FOUND`, `GRADE_NOT_IN_LADDER`, `DUPLICATE_JOB_REF_CODE`, `DEACTIVATION_BLOCKED_DEPENDENCIES`, `INVALID_HALF_GRADE_RANK`, `LADDER_HAS_ACTIVE_GRADES`, `BLOCKED_JOB_REF_OPERATION`) — clients match **codes**, not Persian substrings
  - [x] Export from `src/index.ts` only
  - [x] **Do not** export Assignment / Personnel Event verbs (`assignJobTitle`, `changeGrade`, …)

- [x] Task 3: Permissions + governed tRPC (AC: #5, #6)
  - [x] Add PermissionSet codes: `job_reference.read` / `job_reference.write` (dotted lowercase)
  - [x] Seed into demo PermissionSet(s) used by `hr_admin` (nav already shows `/organization`). Do **not** invent AR-ACCESS production matrices
  - [x] Ordinary data category: e.g. `organization.job_reference` (enabled ordinary / demo-safe). Do **not** put under `compensation` or `identity.national_id`
  - [x] Router `apps/web/src/server/job-reference.ts` (or section under `organization.ts` **only if** meta/permissions stay distinct — prefer **separate router** `jobReference.*`):
    - Read: `listRoles` / `listJobTitles` / `listLadders` / `listGradesForLadder` / `listSeniorities` / get-by-id
    - Write: create / activate / deactivate / optional updateIdentity per concept
  - [x] Wire in `root.ts`
  - [x] `governedProcedure` meta: `permission`, `dataCategory`, `action`, `organizationalScope`, `operation` (`job_reference.create_grade`, …), `sensitive: false` unless AR later reclassifies
  - [x] Map domain errors → `TRPCError` + `divanCode`; validation/domain blocks → `BAD_REQUEST` (not `FORBIDDEN`) — lesson from 3.3 / 3.5 review
  - [x] Denied → Persian access copy; no payload leak

- [x] Task 4: ساختار سازمان UI — job reference section (AC: #1, #5, #6, #7)
  - [x] Keep RSC shell on `apps/web/app/(app)/organization/page.tsx`: `auth()` → `assertPageAccess` → panels (Layout ≠ RSC)
  - [x] Add thin Admin panel section (Persian RTL) **below / beside** hierarchy — clear section boundary («مراجع شغلی» or equivalent — no emoji):
    - Tabs or sub-nav for Role / Job Title / Ladder / Grade / Seniority
    - Ladder detail: list grades for selected ladder only (proves AC #1 in UI)
    - Create forms: code, nameFa, startDate (Jalali), Grade requires Ladder select + rank (half-grade capable)
    - Activate / deactivate with confirm + Persian operational copy when blocked
    - Show inactive/historical without erase (filter toggle OK)
  - [x] Interactive a11y DoD: keyboard, visible focus, RTL, no emoji; loading/empty/error operational copy; one dialog stack level max (UX-DR19)
  - [x] Do **not** imply Assignment write capability; do **not** show Grade↔Seniority mapping UI
  - [x] Page gate may remain coarse `/organization`; procedure permissions still enforce `job_reference.*`

- [x] Task 5: Seed + selfcheck + facts notes + DoD (AC: #1–#7)
  - [x] Seed minimal demo: ≥1 Ladder with ≥2 Grades including **one half-grade**; ≥1 Role, Job Title, Seniority; ≥1 inactive/historical row where useful
  - [x] Wire from identity-access / person-employment seed after org hierarchy fixtures
  - [x] `job-reference.selfcheck.ts` + package script + root `selfcheck:job-reference`
  - [x] Cases in Testing table below
  - [x] Update `EMPLOYMENT_MINIMUM_FACTS`: add rows for Role / Job Title / Ladder / Grade / Seniority as “schema ready; Assignment carriers still 3.7 / Epic 4”
  - [x] Update `deferred-work.md`: close “Job Role / Title / Ladder / Grade = Story 3.6”; note Seniority included; AR-TEMPORAL disposition still open; Assignment FKs → 3.7/Epic 4; no Grade↔Seniority mapping
  - [x] Preserve prior selfchecks green: `organization-hierarchy`, `person-identity`, `employment-lifecycle`, `data-dictionary`, `compensation-facts`, `audit-envelope`, `inference-bulk` (as applicable)
  - [x] `pnpm` typecheck: `@divan/person-employment`, `@divan/db`, `@divan/temporal-engine`, `@divan/web`, `@divan/identity-access` (if seed/permissions touched)
  - [x] **When marking done:** sync story-file `Status: done` with `sprint-status.yaml` key `3-6-independent-job-reference-concepts`

### Review Findings

- [x] [Review][Decision] Scope of AC#3 change gate on identity updates — resolved: gate all `update*Identity` mutations (code/name/rank/ladderId), not only structural ladder moves
- [x] [Review][Defer] Grade interval vs parent Ladder validity — deferred: leave unconstrained until AR-TEMPORAL / Assignment (do not invent containment policy in 3.6)

- [x] [Review][Patch] Expose JobRefError `divanCode` via tRPC errorFormatter [`apps/web/src/server/trpc.ts:75`]
- [x] [Review][Patch] Reject empty-string `endDateExclusive` on deactivate (treat as missing, not null) [`packages/modules/person-employment/src/job-reference.ts:460`]
- [x] [Review][Patch] Map `(ladderId, rank)` unique violations to a rank-specific code/message, not `DUPLICATE_JOB_REF_CODE` [`packages/modules/person-employment/src/job-reference.ts:802`]
- [x] [Review][Patch] Bound half-grade rank (reject ≤0 and values outside Decimal(4,1)) [`packages/modules/person-employment/src/job-reference-invariants.ts:126`]
- [x] [Review][Patch] Grade ladder filter must include inactive ladders when viewing historical grades (create can stay active-only) [`apps/web/components/organization/job-reference-panel.tsx:459`]
- [x] [Review][Patch] Complete tab a11y: `tabpanel` / `aria-controls` / arrow-key nav (UX-DR19) [`apps/web/components/organization/job-reference-panel.tsx:381`]
- [x] [Review][Patch] Use job-reference operational error copy instead of `orgListError` [`apps/web/components/organization/job-reference-panel.tsx:517`]
- [x] [Review][Patch] Idempotent deactivate: skip dependency hooks when already inactive [`packages/modules/person-employment/src/job-reference.ts:456`]
- [x] [Review][Patch] Gate all identity updates via `assertJobRefChangeAllowed` [`packages/modules/person-employment/src/job-reference.ts`]

- [x] [Review][Defer] Read-then-create code uniqueness race [`packages/modules/person-employment/src/job-reference.ts:387`] — deferred, pre-existing
- [x] [Review][Defer] Selfcheck gaps (updateIdentity / rank-change gate) [`packages/modules/person-employment/src/job-reference.selfcheck.ts`] — deferred, pre-existing
- [x] [Review][Defer] Seed `ensureByCode` does not heal mutated seed rows [`packages/modules/person-employment/src/seed.ts`] — deferred, pre-existing
- [x] [Review][Defer] Optional `update*Identity` not surfaced in Admin UI — deferred, pre-existing
- [x] [Review][Defer] No as-of picker on job-ref panel (API `asOf` exists for helpers) — deferred, pre-existing

## Dev Notes

### Epic 2 / 3.1–3.5 carry-in

| Item | How 3.6 absorbs it |
| --- | --- |
| Epic 3↔4 no temporary CRUD | Gate: job-ref master-data OK; Assignment/job-change CRUD forbidden |
| Person / OrgUnit master-data pattern | Same class of product writes + thin Admin UI on `/organization` |
| OrgUnit synced dual active/interval (3.5) | Reuse semantics; same deactivate-without-delete |
| OrgUnit dependency hook registry | Copy pattern for job-ref deactivation/change gates |
| Compensation isolation (3.4) | Job refs are not compensation facts |
| OrganizationalScope ≠ OrgUnit | Also ≠ job references |
| Status ↔ sprint alignment | Task 5 DoD on done transition |
| AR numbers fail-closed | Deps blocked; no invented disposition |
| Error UX | Stable **codes**; BAD_REQUEST vs FORBIDDEN |
| Layout ≠ RSC | `/organization` assert before panels |
| Review anti-patterns (3.4/3.5) | No production skip-gates; whitespace dates → validation; seed `$transaction`; map FK `P2003`; Prisma from `@divan/db`; domain blocks ≠ FORBIDDEN |

### Epic context

- **Epic 3:** Workforce Master Data & Organization — FR5–FR13.
- **This story:** FR-10 — five independent job reference concepts; Ladder–Grade membership; half-grades; no Grade↔Seniority universal map; deactivate-with-deps fail-closed.
- **Upstream (done):** 3.1 Person; 3.2 Employment; 3.3 Dictionary; 3.4 Compensation; 3.5 Org hierarchy (same IA surface).
- **Downstream:** 3.7 Primary Assignment carries org+job facts; 4.8 job/level change events; FR-23/FR-28/FR-29 headcount uses Job Title + optional Seniority (not Grade); Epic 5/6 filters & import validation.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Primary/Secondary Assignment create/change | 3.7–3.8 constraints; mutations Epic 4 |
| Role / Title / Ladder / Grade / Seniority **change events** | Story 4.8 / FR-23 |
| Universal or Ladder-specific Grade↔Seniority mapping UI/rules | Addendum non-MVP / optional hypothesis |
| Headcount Approval / matching / Override | Epic 4 (Title + optional Seniority) |
| Interactive org chart | Non-goal |
| Merge job refs into OrgUnit / OrganizationalScope | Never |
| Vitest/CI full suite | Thin selfcheck continues |
| Promotion workflow module | Spine deferred — outcome event only later |

### Architecture compliance

| Decision | Implication for 3.6 |
| --- | --- |
| AD-1 | Single process + one PostgreSQL; no job microservice |
| AD-2 | Job master-data ≠ Personnel Event authority |
| AD-3 | Own APIs in `person-employment`; no casual cross-module table access |
| AD-5 | Envelope on governed routes; access events on decisions |
| AD-6 | Prisma projections; no web Prisma; tRPC wraps module |
| FR-10 | Five distinct refs; Grade∈Ladder (+ half-grades); no Grade↔Seniority map; deps blocked |
| NFR-4 | Domain invariants; FK Restrict on Ladder←Grade |
| NFR-12 / UX-DR | Persian RTL; a11y floor; tokens; IA «ساختار سازمان» hosts hierarchy + reference data |

### Conceptual model (must follow)

```
OrganizationalRole  ── independent reference
JobTitle            ── independent reference (later: headcount match key)
Ladder              ── grade family
Grade               ── belongs_to exactly one Ladder; may be half-grade (rank step 0.5)
Seniority           ── independent reference (NO required link to Grade)

Assignment (NOT this story) will later *reference* these — never own their definitions.
```

Glossary (Persian labels for UI): Role = نقش سازمانی; Job Title = عنوان شغلی; Ladder = لدر/مسیر شغلی; Grade = گرید; Seniority = ارشدیت.

### Schema recommendation (developer default)

**Preferred:** five tables + Grade.`ladderId` Restrict + Decimal/half-step rank + OrgUnit-like activate/deactivate.

**Avoid:** single EAV “ReferenceConcept” blob; storing Grade as free text on future Assignment without FK; `Float` ranks; cascading delete of Grades when Ladder drops; encoding Seniority as Grade subtype; putting job refs in `compensation` schema.

### UPDATE files — current state (read before editing)

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `packages/db/prisma/schema.prisma` | Person, Employment, OrgUnit, DataElement, authz models | Add Role/Title/Ladder/Grade/Seniority | OrgUnit + OrganizationalScope semantics unchanged |
| `packages/modules/person-employment/src/*` | Person / Employment / Dictionary / OrgUnit | Job-ref domain + exports + selfcheck | Existing public APIs; no Assignment writers |
| `packages/modules/person-employment/src/employment-minimum-facts.ts` | Org row notes live; Assignment open | Note job refs schema-ready | Still no Assignment enforcement |
| `packages/modules/person-employment/src/index.ts` | OrgUnit exports | Export job-ref API | Prior exports |
| `packages/modules/identity-access/src/seed.ts` | org + person permissions | Bind `job_reference.*`; call job-ref seed | Idempotent seed |
| `apps/web/app/(app)/organization/page.tsx` | RSC + OrganizationPanel | Compose job-ref panel section | assertPageAccess; hierarchy still works |
| `apps/web/components/organization/organization-panel.tsx` | Hierarchy CRUD UI | Leave hierarchy intact; add sibling section component preferred | 3.5 review fixes (as-of today, includeInactive, …) |
| `apps/web/src/server/root.ts` | organization router | Register `jobReference` | Existing routers |
| `packages/kernel/audit-envelope` categories | `organization.unit` etc. | Register `organization.job_reference` if required by envelope allowlist | Fail-closed unknown categories |

### Previous story intelligence (3.5 → 3.6)

- Delivery shape: hand-written migration → domain module → seed → selfcheck → tRPC → thin UI → deferred-work + sprint sync.
- 3.5 established `/organization` as the Admin surface for FR-9; UX IA already says hierarchy **+ reference data** — 3.6 fills the reference half without a new nav item.
- Synced dual activate/deactivate + dependency hook registry are the patterns to copy, not reinvent.
- Writer naming: product verbs `createJobTitle` / `deactivateGrade` are correct for master-data; keep `apply*Projection` reserved for event-projected state.
- Must not repeat 3.5 review misses: hardcoded as-of dates; domain blocks mapped to FORBIDDEN; silent orphan filtering without explanation; dead `includeInactive` branches; raw exceptions from hooks.
- `baseline_commit`: `d2e67c4` (story 3.5).

### Git intelligence summary

Recent commits: `d2e67c4` story 3.5 → `d89a2d6` 3.4 → `f271a15` 3.3 → `51eb947` 3.2 → `ce31f55` 3.1. Follow the same story-commit discipline and selfcheck scripting pattern (`selfcheck:job-reference` alongside `selfcheck:organization-hierarchy`).

### Latest tech information

- **Prisma 7.x (repo):** use `Decimal @db.Decimal(p, s)` or integer half-steps for grade ranks — never `Float` (IEEE rounding). Prefer `Prisma.Decimal` in writers when using Decimal columns.
- **PostgreSQL:** `ON DELETE RESTRICT` on Grade→Ladder; unique `(ladder_id, code)`.
- **tRPC 11.x / Next.js 16.x:** RSC page gate + client panels; reuse Jalali picker + Persian digit helpers from Epic 1 / 3.5.
- Do not add Drizzle — stack is Prisma.

### Library / framework requirements

| Lib | Use |
| --- | --- |
| `@divan/temporal-engine` | Interval math / as-of |
| `@divan/db` | Prisma client accessor inside module |
| `@divan/audit-envelope` | Governed procedure / authorize / category allowlist |
| `@divan/identity-access` | Permission seed + nav (coarse `/organization`) |
| Existing web UI primitives | Forms, Jalali picker, operational copy — match organization panel |

### File structure requirements

```
packages/db/prisma/schema.prisma                               # UPDATE — five job-ref models
packages/db/prisma/migrations/<ts>_job_reference_concepts/     # NEW — SQL
packages/modules/person-employment/src/job-reference.ts        # NEW (name flexible)
packages/modules/person-employment/src/job-reference-invariants.ts
packages/modules/person-employment/src/job-reference.selfcheck.ts
packages/modules/person-employment/src/errors.ts               # UPDATE
packages/modules/person-employment/src/permissions.ts          # UPDATE
packages/modules/person-employment/src/index.ts                # UPDATE exports
packages/modules/person-employment/src/seed.ts                 # UPDATE
packages/modules/person-employment/src/employment-minimum-facts.ts
packages/modules/person-employment/README.md                   # UPDATE ownership
packages/modules/identity-access/src/seed.ts                   # UPDATE permissions + seed wire
packages/kernel/audit-envelope/src/categories.ts               # UPDATE if allowlist
apps/web/src/server/job-reference.ts                           # NEW
apps/web/src/server/root.ts                                    # UPDATE
apps/web/app/(app)/organization/page.tsx                       # UPDATE compose panels
apps/web/components/organization/job-reference-panel.tsx       # NEW (preferred split)
package.json (root + person-employment)                        # selfcheck script
```

### Testing requirements

| Case | Expect |
| --- | --- |
| Create Ladder + Grades incl. half-grade (e.g. rank 12.5) | Succeeds |
| `listGradesForLadder(L1)` | Only L1 grades; never other ladder’s grades |
| Create Grade with wrong/missing ladder | Reject `GRADE_NOT_IN_LADDER` / not-found |
| Create Seniority without Grade link | Succeeds (proves no universal mapping) |
| Any API/UI forcing Grade↔Seniority pair | Must not exist |
| Duplicate code within concept | Reject `DUPLICATE_JOB_REF_CODE` |
| Sentinel name `""` / `"N/A"` | Reject |
| Deactivate ref (no deps yet) | Succeeds; row retained; history readable as-of |
| Deactivate when dependency hook reports blockers | Reject `DEACTIVATION_BLOCKED_DEPENDENCIES` |
| Deactivate Ladder with active Grades | Reject (stable code) |
| Delete Ladder with Grades (DB) | Restrict — no cascade-erase |
| Float rank storage | Forbidden — Decimal or half-step Int only |
| OrgUnit hierarchy + OrganizationalScope demos | Unchanged |
| Prior selfchecks | Remain green |
| No Assignment mutation API on public surface | Assert absence |

### Project context reference

- No `project-context.md` in repo; follow `ARCHITECTURE-SPINE.md`, `epics.md`, Stories 3.1–3.5, and this file.
- Communication with user: Persian; story artifact language: English (document_output_language).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 3.6 / Epic 3 sequencing]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md`#FR-10 / Glossary]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md`#§2.1–2.2 / Ladder–Grade / §2.5]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md`#AD-2–AD-6 / capability map FR-9..FR-13]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md`#Information Architecture — ساختار سازمان]
- [Source: `_bmad-output/implementation-artifacts/3-5-organization-hierarchy-management.md` Gate/patterns/review]
- [Source: `packages/modules/person-employment/src/org-unit.ts` dependency hooks + dual active]
- [Source: `packages/modules/person-employment/src/employment-minimum-facts.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Prisma migrate deploy applied `20260717223000_job_reference_concepts` successfully.
- Web typecheck initially failed on JalaliDatePicker `aria-label` and missing `operationalCopy.loading` / `errorGeneric` — fixed to match organization-panel patterns.

### Completion Notes List

- Five distinct job-ref tables (OrganizationalRole, JobTitle, Ladder, Grade, Seniority) with Decimal(4,1) half-grades; Grade→Ladder Restrict; no Grade↔Seniority FK/mapping.
- Domain API mirrors OrgUnit: synced dual activate/deactivate, dependency hook registry, Ladder blocked while active Grades exist.
- Governed `jobReference.*` tRPC router + `organization.job_reference` category; domain blocks → BAD_REQUEST.
- Thin «مراجع شغلی» panel on `/organization` with concept tabs; grades filtered by selected ladder.
- Seed + `selfcheck:job-reference` green; prior selfchecks (person-identity, employment-lifecycle, data-dictionary, organization-hierarchy, audit-envelope) remain green.
- Typecheck green: person-employment, db, audit-envelope, temporal-engine, identity-access, web.

### File List

- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/20260717223000_job_reference_concepts/migration.sql
- packages/modules/person-employment/src/errors.ts
- packages/modules/person-employment/src/job-reference-invariants.ts
- packages/modules/person-employment/src/job-reference.ts
- packages/modules/person-employment/src/job-reference.selfcheck.ts
- packages/modules/person-employment/src/permissions.ts
- packages/modules/person-employment/src/seed.ts
- packages/modules/person-employment/src/index.ts
- packages/modules/person-employment/src/employment-minimum-facts.ts
- packages/modules/person-employment/package.json
- packages/modules/person-employment/README.md
- packages/modules/identity-access/src/seed.ts
- packages/kernel/audit-envelope/src/categories.ts
- packages/kernel/audit-envelope/src/index.ts
- apps/web/src/server/job-reference.ts
- apps/web/src/server/root.ts
- apps/web/app/(app)/organization/page.tsx
- apps/web/components/organization/job-reference-panel.tsx
- package.json
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/3-6-independent-job-reference-concepts.md

### Change Log

- 2026-07-17: Implemented Story 3.6 independent job reference concepts (FR-10) — schema, domain, tRPC, Admin UI, seed/selfcheck; status → review.
- 2026-07-17: Code review patches applied (divanCode, deactivate empty-end, rank bounds/duplicate code, identity change gate, UI a11y/ladder filter); status → done.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
