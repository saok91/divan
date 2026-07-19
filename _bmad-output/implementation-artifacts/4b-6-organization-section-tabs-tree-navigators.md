---
baseline_commit: fedf948
---

# Story 4b.6: Organization Section Tabs & Tree Navigators

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want ساختار سازمان as سلسله‌مراتب · نقش سازمانی · عنوان شغلی · لدر و گرید · ارشدیت,
so that hierarchy and ladder/grade use trees and flat refs use tables (UX-DR26, FR9–FR10 UI).

## Acceptance Criteria

1. **Given** Admin access to ساختار سازمان  
   **When** the surface opens  
   **Then** section tabs are: سلسله‌مراتب · نقش سازمانی · عنوان شغلی · لدر و گرید · ارشدیت  
   **And** default tab remains سلسله‌مراتب (`/organization` → `/organization/hierarchy`)

2. **And** سلسله‌مراتب uses shared `tree-navigator` for LE → BU → Dept → Team with expand/collapse, APG keyboard support, selection, and toolbar «افزودن»

3. **And** لدر و گرید uses the same `tree-navigator` with ladder parents and grade children; toolbar has «افزودن نردبان» (primary/secondary per DESIGN) and «افزودن گرید» **disabled** until a ladder node is selected (or create-grade modal requires parent)

4. **And** نقش سازمانی، عنوان شغلی، and ارشدیت each use flat `GovernedDataTable` + toolbar «افزودن» opening a **single** create/edit modal (no separate «افزودن» tab)

5. **And** deactivate-with-active-children / impossible reparent / ladder-with-active-grades fail closed with Persian blockers (Story 3.5/3.6 domain rules **unchanged**); confirm dialogs **list** blocking children when known from tree data; server `messageFa` shown with `role="alert"` on reject — no silent success

6. **And** no separate «افزودن» tab; bulk org import remains deferred

7. **And** visuals align with `mockups/key-org-ladder-grade.html` (spine wins on conflicts); domain tRPC contracts from Epic 3 stay behaviorally equivalent — this story is **UI reshape** (+ optional thin `reparent` procedure that only wraps existing `reparentOrgUnit`)

8. **And** dirty create/edit modals register with shell leave-guard (4b.2); no dialog-on-dialog; theme toggle / sidebar collapse remain exempt

## Tasks / Subtasks

- [x] Task 1: Build shared `tree-navigator` primitive (AC: #2, #3, #7)
  - [x] Add `apps/web/components/tree-navigator/` (mirror 4b.4 package shape: `types.ts`, component, `index.tsx`, `*.selfcheck.ts`)
  - [x] Public contract (keep lean — adjust names if clearer, do not invent a second tree):
    - `nodes` / `getChildren` tree data + `getNodeId` + `getLabel`
    - Controlled or uncontrolled `expandedIds` + `selectedId`
    - `onSelect`, `onActivate` (Enter / double-click → edit), optional `renderRowEnd` for row actions
    - `toolbar` slot (caller owns CTA buttons)
    - `aria-label` required
  - [x] A11y: `role="tree"` / `treeitem` / `group`; `aria-expanded` on parents; `aria-selected` on selection; **roving tabindex** (one tab stop)
  - [x] Keyboard per [WAI-ARIA APG Tree View](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/): ↑/↓ move among visible nodes; **Right** expand (or move to first child if open); **Left** collapse (or move to parent); Home/End; **Enter** activates edit (`onActivate`). Use APG **physical** Left/Right (do not mirror for RTL — AT expectation). Visual indent uses `padding-inline-start` + `--spacing-tree-indent` (16px)
  - [x] Row height `h-table-row-compact` / `--spacing-table-row-compact` (40px); expand control **before** label; full-width content (no card wrapper)
  - [x] Cold-load: caller passes Skeleton / StatusMessage — primitive itself stays presentational
  - [x] Selfcheck: pure helpers (flatten visible nodes, expand/collapse id sets, next/prev focus) via `pnpm --filter @divan/web selfcheck:tree-navigator` (add script like governed-table)
  - [x] **Do not** put domain/org fetch logic inside the primitive

- [x] Task 2: Split hierarchy vs job-reference off the stacked hierarchy page (AC: #1, #6, #7)
  - [x] Keep `organization/(tabs)/layout.tsx` + `SECTION_TAB_SURFACES` `/organization` tabs **as-is** (labels/hrefs already match EXPERIENCE — no churn)
  - [x] Refactor under `apps/web/components/organization/`:
    - `org-hierarchy-panel.tsx` — tree + add/edit/deactivate for org units only
    - `org-ladder-grade-panel.tsx` — ladder→grade tree + toolbar CTAs
    - `org-roles-panel.tsx` / `org-job-titles-panel.tsx` / `org-seniority-panel.tsx` — GovernedDataTable + modal
  - [x] Wire pages (replace `SectionTabPlaceholder`):
    - `hierarchy/page.tsx` → hierarchy panel **only** (remove `JobReferencePanel` from this page)
    - `roles` / `job-titles` / `ladder-grade` / `seniority` → respective panels
  - [x] Retire or thin `organization-panel.tsx` / `job-reference-panel.tsx` local concept-tabs — **delete local tab UI** that duplicates URL section tabs (local `ConceptTab` in JobReferencePanel must not survive)
  - [x] Drop redundant page-level `h1` «ساختار سازمان» inside panels (surface label already in chrome); use tab-appropriate headings/captions if needed
  - [x] Preserve `assertPageAccess(session.user.coarseRole, "/organization")` on every tab page
  - [x] Full-width content (`p-6`); no `max-w-*` that fights tree/table

- [x] Task 3: Hierarchy tree + org mutations (AC: #2, #5, #7, #8)
  - [x] Data: existing `api.organization.hierarchyAsOf` (keep as-of date UX if already present — do not invent new temporal policy)
  - [x] Map LE → BU → Dept → Team labels via existing `UNIT_TYPE_LABEL_FA`
  - [x] Toolbar «افزودن»: opens **one** create Dialog; parent constrained by `PARENT_TYPE_FOR` (same rules as today)
  - [x] Node activate / row action → edit Dialog (identity update via `organization.updateIdentity` if already used; activate/deactivate as today)
  - [x] **Reparent (required for AC #5 path):** expose thin tRPC `organization.reparent` wrapping `reparentOrgUnit` only — **zero** domain rule changes; map `OrgUnitError.messageFa` like other org procs. Edit modal may change parent; impossible reparent shows `MSG_IMPOSSIBLE_REPARENT_FA` / related Persian errors — fail closed
  - [x] Deactivate confirm: list **active child** names/codes from client tree before mutate; on `DEACTIVATION_BLOCKED_DEPENDENCIES` show `err.message` (`messageFa`); never toast success when blocked
  - [x] Leave-guard on dirty create/edit forms via `useLeaveGuardRegistration`
  - [x] Prefer **zero** edits to `packages/modules/person-employment/**` except if a bug blocks UI (then fix + selfcheck domain)

- [x] Task 4: Ladder + grade tree (AC: #3, #5, #7, #8)
  - [x] Build tree: `listLadders` as parents; children = `listGradesForLadder({ ladderId })` (batch per expanded/visible ladder — avoid N+1 UX freeze; expand-driven fetch is OK)
  - [x] Toolbar: «افزودن نردبان» always (when write permitted); «افزودن گرید» **disabled** unless `selectedId` is a **ladder** node (spine > mock if mock shows grade CTA always enabled)
  - [x] Create grade requires `ladderId` — reuse `MSG_JOB_REF_LADDER_REQUIRED_FA` path; half-grades allowed by domain
  - [x] Deactivate ladder with active grades → `MSG_LADDER_HAS_ACTIVE_GRADES_FA`; confirm should list active grade labels from tree when possible
  - [x] Visual: ladder rows slightly stronger (font-medium / subtle bg); grade rows indented — match mock intent without pixel-perfect CSS fork
  - [x] Leave-guard on dirty modals; single dialog depth

- [x] Task 5: Flat tables for نقش / عنوان شغلی / ارشدیت (AC: #4, #7, #8)
  - [x] Consume `GovernedDataTable` from `@/components/governed-data-table` — **do not** fork snapshot engine; prefer zero primitive edits
  - [x] Columns (Persian; adjust ids as needed): کد · نام · وضعیت (enum فعال/غیرفعال) · اقدامات via `rowActions`
  - [x] `sectionDefaultFilters`: e.g. `status: ["active"]` so clear-filters ≠ wipe-all (same lesson as 4b.5)
  - [x] Data: `jobReference.listRoles` / `listJobTitles` / `listSeniorities` + existing create/activate/deactivate/updateIdentity mutations
  - [x] Toolbar «افزودن» → single create modal; row actions for activate/deactivate/edit
  - [x] Filter-empty uses `operationalCopy.emptySearch` + clear-filters; list-empty may reuse/adapt org/jobRef empty strings in `operational-copy.ts` (exact voice; no marketing fluff)
  - [x] Leave-guard on dirty create/edit

- [x] Task 6: Verify + DoD (AC: #1–#8)
  - [x] Domain regression: `pnpm` scripts / selfchecks for org-unit + job-reference if present (`org-unit.selfcheck`, job-reference selfcheck — run what package.json already exposes)
  - [x] `pnpm --filter @divan/web selfcheck:tree-navigator` + `selfcheck:governed-table` (latter only if table touched)
  - [x] `pnpm --filter @divan/web` typecheck + eslint on **touched** files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done later
  - [x] BOM-safe edit of `sprint-status.yaml` on Windows (UTF-8 **without** BOM)

### Manual DoD checklist

- [x] All five Organization tabs navigate; `/organization` → `/organization/hierarchy`
- [x] Hierarchy: tree expand/collapse; ↑↓/←→/Enter; toolbar add; create under valid parent type only
- [x] Ladder-grade: grade CTA disabled without ladder selection; grade create under selected ladder works; half-grade still accepted by API
- [x] Flat tabs: GovernedDataTable filter/sort/page; clear filters restores section defaults
- [x] Deactivate parent with active children: confirm lists children; mutate fails closed with Persian alert — no success flash
- [x] Impossible reparent (if exercised): Persian fail-closed, no partial UI success
- [x] Dirty modal + section tab / sidebar → leave-guard (one dialog only)
- [x] Light + dark: tree rows readable; table sticky columns opaque if used
- [x] No `@prisma/client` in client; no AG Grid; no local concept-tabs duplicating URL tabs; no bulk org import UI

## Dev Notes

### Epic context

- **Epic 4b:** Shell & IA Alignment to `ux-divan-2026-07-19` — **presentation first**; domain APIs unchanged unless thin tRPC wrap. Authorized by `sprint-change-proposal-2026-07-19`.
- **This story:** UX-DR26 — retrofit Story **3.5** hierarchy UI + Story **3.6** job-reference UI into section tabs + `tree-navigator` / `governed-data-table`.
- **Order:** `4b.1`–`4b.5` done → **`4b.6`** → `4b.7` → Epic 5.
- **FRs:** FR9 (org hierarchy) + FR10 (job refs) **UI reshape**; FR43 presentation. OrganizationalScope in Access ≠ org units.

### Locked decisions (do not reopen)

| Decision | Value | Rationale |
| --- | --- | --- |
| Scope | UI reshape (+ optional thin `organization.reparent` wrap) | Story AC + sprint-change |
| Tabs chrome | Reuse 4b.2 `SECTION_TAB_SURFACES` `/organization` | Already correct labels/hrefs |
| Tree primitive | **New** shared `tree-navigator` (like 4b.4 table) | UX-DR26; replace local `TreeRows` |
| Flat lists | **`GovernedDataTable`** | DESIGN: tree for hierarchy & ladder→grade only |
| Ladder + grade | **One** tab, one tree | Spine merged; old separate لدر\|گرید obsolete |
| «افزودن گرید» | Disabled until ladder selected | EXPERIENCE > mock |
| Keyboard | APG Tree View physical ←/→ | AT consistency; indent is RTL via inline-start |
| Filter state | Local (not URL query) | Same as 4b.4/4b.5 |
| Dialog depth | Single dialog | SCP / EXPERIENCE |
| Domain | No rule / Prisma / messageFa invention | 3.5/3.6 preserve |
| Bulk import | Deferred | AC #6 |

### Absolute non-goals

| Out of scope | Belongs to |
| --- | --- |
| Changing org-unit / job-reference domain invariants, hooks, disposition policy | Epic 3 (done) |
| Inventing AR-TEMPORAL / AR-SECONDARY matrices | Fail-closed existing only |
| Drag-drop org chart, member lists, interactive headcount on tree | Never in 4b.6 |
| Personnel scaffolds / event entry relocate | **4b.7** |
| Permission-safe Person search, IDOR, PopulationPort | **5.1** |
| Access admin / OrganizationalScope label CRUD | **4b.5** done |
| AG Grid, infinite scroll, `packages/ui`, Prisma in web | Never |
| Nav IA / landings renames | **4b.3** done |
| Separate «افزودن» org tab or bulk org import | Deferred / out |

### Current code state (UPDATE targets)

| File / area | Today | This story changes | Must preserve |
| --- | --- | --- | --- |
| `organization/(tabs)/hierarchy/page.tsx` | `OrganizationPanel` + `JobReferencePanel` stacked | Hierarchy panel only | `assertPageAccess` |
| `roles` / `job-titles` / `ladder-grade` / `seniority` pages | `SectionTabPlaceholder` | Real panels | Auth gates |
| `(tabs)/layout.tsx` | `SurfaceSectionTabsLayout` | Prefer **no** change | Tabs a11y |
| `organization-panel.tsx` | Indent-only `TreeRows`; always-open create form | Replace with `tree-navigator` + modal toolbar pattern | Mutation semantics |
| `job-reference-panel.tsx` | **Local** concept tabs for all five refs | Split across URL tabs; ladder+grade → tree | Mutation semantics |
| `tree-navigator/*` | **Missing** | Create primitive | — |
| `governed-data-table/*` | Ready (4b.4) | Consume for 3 flat tabs | Public contract |
| `src/server/organization.ts` | No `reparent` | Add thin `reparent` wrap of `reparentOrgUnit` | Existing procs + `mapOrgError` |
| `src/server/job-reference.ts` | Full CRUD | Prefer **no** contract change | Permissions meta |
| `lib/section-tab-surfaces.ts` | Org tabs defined | No label/href churn | `/organization/*` |
| `globals.css` tokens | `--tree-indent`, `--table-row-compact` | Use them | 4b.1 tokens |
| `person-employment` org/job-ref | Domain SoT | **No** rule changes | errors.ts messageFa |

### Architecture compliance (MUST follow)

| Rule | Implication |
| --- | --- |
| **AD-5** | Coarse nav ≠ authorization. Keep `governedProcedure` + `organization.read/write` / `job_reference.read/write`. UI omit ≠ authz. |
| **AD-6** | Next App Router; Persian RTL; **no** `@prisma/client` in `apps/web`; modules only via tRPC |
| **FR-9 / FR-10** | Hierarchy types and five independent job concepts remain distinct — no Grade↔Seniority mapping UI |
| UX authority | Forward contract = `ux-divan-2026-07-19`. **Spine wins over mocks** (grade CTA disabled state) |
| Consistency | Trees = `tree-navigator`; flat refs = `governed-data-table`; chrome = `section-tabs` |

[Source: `ARCHITECTURE-SPINE.md` AD-5/AD-6; `epics.md` Epic 4b / Story 4b.6; `EXPERIENCE.md` UX-DR26; `DESIGN.md` tree-navigator tokens; `prd.md` FR-9/10/43]

### Previous story intelligence (4b.5)

- Split monolith into tab-scoped panels; do **not** leave stacked unrelated panels on one tab.
- First real `GovernedDataTable` consumer patterns: `sectionDefaultFilters`, banner vs filter-empty distinction, single dialog depth, leave-guard on dirty forms, clear leave-guard after successful create (review patches on roles panel).
- Review lessons to avoid repeating: dialog + leave-guard double-dialog; mutate errors hidden behind dialog; invalidate related queries after update; don't leave dirty flags after success.
- Prefer zero domain/server contract churn; Access stayed presentation-only except typing.
- BOM: never rewrite `sprint-status.yaml` with UTF-8 BOM on Windows.
- OrganizationalScope ≠ org units — that boundary is why 4b.6 owns hierarchy trees.

### Git intelligence summary

Recent commits: `fedf948` story 4b.5 (Access person-first); `51d7ad7` 4b.4 GovernedDataTable; `348b246` 4b.3 IA; `c11e77d` 4b.2 section tabs (org tab shells already exist); `c1a0c36` 4b.1 tokens including `--tree-indent`. Pattern: 4b.x commits touch web presentation + story md + sprint-status; domain packages untouched.

### Latest tech notes

- Tree a11y: follow current WAI-ARIA APG Tree View (roving tabindex, `aria-expanded`, physical arrow expand/collapse). Reference: https://www.w3.org/WAI/ARIA/apg/patterns/treeview/
- Leave-guard: reuse `useLeaveGuardRegistration` — no third-party nav libraries.
- Next: Server Component pages assert access → client panels at leaves.
- shadcn Dialog/Button/Input already used by org panels — keep.

### Project structure notes

- New: `apps/web/components/tree-navigator/`
- Panels: `apps/web/components/organization/*`
- Pages: `apps/web/app/(app)/organization/(tabs)/*/page.tsx`
- No new package; no `packages/ui`
- Mock: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/mockups/key-org-ladder-grade.html`

### Testing requirements

| Layer | Command / action |
| --- | --- |
| Tree primitive | `pnpm --filter @divan/web selfcheck:tree-navigator` |
| Table primitive | `selfcheck:governed-table` if touched (prefer not) |
| Domain | Existing person-employment org-unit / job-reference selfchecks |
| Web | typecheck + eslint touched files |
| Manual | DoD checklist; smoke `hr.admin` vs operator denial on `/organization` |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4b / Story 4b.6 / UX-DR26]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-19.md`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — ساختار سازمان, tree-navigator]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/DESIGN.md` — tree-navigator tokens]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/mockups/key-org-ladder-grade.html`]
- [Source: `_bmad-output/implementation-artifacts/4b-5-access-administration-person-first-retrofit.md`]
- [Source: `_bmad-output/implementation-artifacts/4b-4-governed-data-table-primitive.md`]
- [Source: `_bmad-output/implementation-artifacts/3-5-organization-hierarchy-management.md`]
- [Source: `_bmad-output/implementation-artifacts/3-6-independent-job-reference-concepts.md`]
- [Source: `apps/web/components/organization/organization-panel.tsx`]
- [Source: `apps/web/components/organization/job-reference-panel.tsx`]
- [Source: `apps/web/src/server/organization.ts`]
- [Source: `apps/web/src/server/job-reference.ts`]
- [Source: `packages/modules/person-employment/src/org-unit.ts` — `reparentOrgUnit`, `assertOrgUnitDeactivationAllowed`]
- [Source: `packages/modules/person-employment/src/errors.ts` — org/job-ref `messageFa`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- `pnpm --filter @divan/web selfcheck:tree-navigator` — ok
- `pnpm --filter @divan/web selfcheck:governed-table` — ok
- `pnpm --filter @divan/web typecheck` — ok
- eslint on touched tree-navigator / organization files — ok
- `pnpm --filter @divan/person-employment selfcheck:organization-hierarchy` — ok
- `pnpm --filter @divan/person-employment selfcheck:job-reference` — ok

### Completion Notes List

- Shared `tree-navigator` primitive with APG keyboard (physical ←/→), roving tabindex, nested `treeitem`/`group`, expand-driven `isBranch` for lazy ladder grades.
- Organization tabs split: hierarchy tree only; ladder→grade tree; flat GovernedDataTable for roles / job-titles / seniority; deleted stacked `OrganizationPanel` + local ConceptTab `JobReferencePanel`.
- Thin tRPC `organization.reparent` wraps `reparentOrgUnit` with existing `mapOrgError`; edit modal supports parent change fail-closed.
- Deactivate confirms list active children/grades from client tree; mutate errors shown with `role="alert"`.
- Leave-guard on dirty create/edit; dialog suppressed while leave-guard pending (single dialog depth).
- «افزودن گرید» disabled until a ladder node is selected.

### File List

- apps/web/components/tree-navigator/types.ts
- apps/web/components/tree-navigator/tree-model.ts
- apps/web/components/tree-navigator/tree-navigator.tsx
- apps/web/components/tree-navigator/tree-navigator.selfcheck.ts
- apps/web/components/tree-navigator/index.tsx
- apps/web/components/organization/org-unit-shared.ts
- apps/web/components/organization/org-hierarchy-panel.tsx
- apps/web/components/organization/org-ladder-grade-panel.tsx
- apps/web/components/organization/org-flat-job-ref-panel.tsx
- apps/web/components/organization/org-roles-panel.tsx
- apps/web/components/organization/org-job-titles-panel.tsx
- apps/web/components/organization/org-seniority-panel.tsx
- apps/web/components/organization/organization-panel.tsx (deleted)
- apps/web/components/organization/job-reference-panel.tsx (deleted)
- apps/web/app/(app)/organization/(tabs)/hierarchy/page.tsx
- apps/web/app/(app)/organization/(tabs)/roles/page.tsx
- apps/web/app/(app)/organization/(tabs)/job-titles/page.tsx
- apps/web/app/(app)/organization/(tabs)/ladder-grade/page.tsx
- apps/web/app/(app)/organization/(tabs)/seniority/page.tsx
- apps/web/src/server/organization.ts
- apps/web/lib/operational-copy.ts
- apps/web/package.json
- apps/web/components/section-tabs.tsx
- _bmad-output/implementation-artifacts/4b-6-organization-section-tabs-tree-navigators.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Review Findings

- [x] [Review][Decision] مسیر فعال‌سازی واحدهای خارج از درخت as-of — resolved: restored inactive units list with activate CTA
- [x] [Review][Decision] «افزودن» با انتخاب تیم — resolved: disable Add when selected unit has no child type
- [x] [Review][Patch] ذخیرهٔ جزئی هویت قبل از شکست reparent — reparent-first then identity [`org-hierarchy-panel.tsx`]
- [x] [Review][Patch] فهرست گریدهای مسدودکننده هنگام غیرفعال‌سازی لدر — fetch grades before confirm [`org-ladder-grade-panel.tsx`]
- [x] [Review][Patch] حالت loading/error گریدهای لدر expand‌شده [`org-ladder-grade-panel.tsx`]
- [x] [Review][Patch] `createDirty` شامل `rank` برای افزودن گرید [`org-ladder-grade-panel.tsx`]
- [x] [Review][Patch] ویرایش flat با اعتبارسنجی کد/نام خالی [`org-flat-job-ref-panel.tsx`]
- [x] [Review][Patch] ویرایش ladder/grade با اعتبارسنجی فیلدهای خالی [`org-ladder-grade-panel.tsx`]
- [x] [Review][Patch] گارد `isPending` روی activate/deactivate/edit [`org-flat-job-ref-panel.tsx`] [`org-ladder-grade-panel.tsx`]
- [x] [Review][Patch] اکشن‌های ردیف خارج از tab order (roving tabindex) [`tree-navigator.tsx`]
- [x] [Review][Patch] نشانگر فوکوس روی `li` با tabindex [`tree-navigator.tsx`]
- [x] [Review][Defer] selfcheck فقط helperهای خالص را پوشش می‌دهد، نه DOM/صفحه‌کلید/lazy children [`tree-navigator.selfcheck.ts`] — deferred, pre-existing scope of story Task 1
- [x] [Review][Defer] پیام‌های اعتبارسنجی کلاینت هاردکد فارسی به‌جای `operationalCopy` [`org-flat-job-ref-panel.tsx`] [`org-ladder-grade-panel.tsx`] — deferred, pre-existing copy pattern from prior job-ref UI

### Change Log

- 2026-07-20: Ultimate context engine analysis completed - comprehensive developer guide created
- 2026-07-20: Implemented 4b.6 — tree-navigator, org section tab panels, thin reparent wrap; status → review
- 2026-07-20: Code review findings added (decision/patch/defer)
- 2026-07-20: Code review patches applied (inactive list, add-disabled-on-team, reparent-first, ladder grades fetch/loading, leave-guard rank, validation, pending guards, tree a11y)
