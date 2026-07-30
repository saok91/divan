# Sprint Change Proposal — Product-Fit & Experience Remediation (Post-MVP Wave)

**Date:** 2026-07-31
**Project:** divan
**Workflow:** bmad-correct-course
**Mode:** Batch
**Status:** Approved for implementation — AtA, 2026-07-31
**Amendment (2026-07-31, post-approval):** visual-design scope made explicit at the product owner's request — UX-DR38 (visual hierarchy and layout system), UX-DR39 (feedback, loading and motion), UX-DR40 (theme parity and data-visualization quality); Stories 8.2, 8.8 and 9.10 added; Story 8.10 reframed as a design-QA gate against the new mockups; FR-58 consequences extended accordingly.
**Raised by:** AtA (product owner, hands-on review of the running application)
**Prior related proposal:** `sprint-change-proposal-2026-07-19.md` (authorized Epic 4b)
**Current UX contract:** `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/`
**Proposed new UX contract:** `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/` (to be produced before Epic 8 stories are finalized)
**Applied 2026-07-31:** PRD §8.12 (FR-57–FR-60) and the appended FR-33/FR-37/FR-43 consequences are in `prd.md`; the UX contract `ux-divan-2026-07-31` is `final` (DESIGN + EXPERIENCE + mockups); `epics.md` carries FR57–FR60, UX-DR29–UX-DR40, and Epics 8–10 with full story acceptance criteria; `sprint-status.yaml` carries the 25 backlog stories and closes the Epic 7 «do not invent Epic 8» action item. Outstanding: the §4.5 architecture configuration note.

---

## 1. Issue Summary

### Problem statement

All committed MVP epics (1, 2, 3, 4, 4b, 5, 6, 7) are `done` in `sprint-status.yaml`. The delivered product satisfies the PRD's functional and governance contract, but on first sustained product-owner use the **experience does not match the product owner's intent**. The gap is not domain correctness; it is:

1. **Identifier ergonomics.** Many operational forms require the user to type a database UUID (person, employment, team, organizational role, job title, ladder, grade, seniority, primary assignment, approval, artifact version). Business users know **personnel code** and **org/job codes**, not UUIDs.
2. **Interaction consistency and affordance.** Row-level actions render as borderless ghost buttons that do not read as controls; button/variant/padding conventions differ per section; tables force horizontal scrolling even when sparsely populated.
3. **Incomplete information architecture.** Several navigable tabs are empty scaffolds shipped for IA symmetry in Epic 4b and never filled. Nav entries therefore lead to dead ends.
4. **Unexplained system language.** Operational banners and section names (e.g. the stale-recalculation banner, «پرونده‌های اصلاح») communicate internal mechanics rather than user-meaningful facts and next steps.
5. **Missing administrative configuration surface.** Roughly 60+ tunable parameters live as code constants or environment variables with no admin-visible or admin-editable surface.

### Discovery context

Product-owner walkthrough of the running dev application on 2026-07-31, with DOM/React component evidence supplied per defect. Each report was then verified against source by targeted code exploration (results in §1.1).

### Issue type

**New requirement emerged from stakeholder** (post-MVP product-fit and usability baseline), plus a small number of genuine defects and one under-specified PRD area (the PRD never stated a usability/identifier/configuration contract beyond FR-43's "Persian RTL desktop" floor). It is **not** a failed technical approach and **not** an MVP scope cut.

### 1.1 Evidence register (verified against source)

| # | Reported | Verified finding | Evidence |
|---|---|---|---|
| E1 | "I must enter UUIDs" | **Confirmed, systemic.** 30+ UUID inputs across the app. `PersonnelEventForm` alone requires up to 15 UUID fields (person, employment, team, role, job title, ladder, grade, seniority, destination variants). No `PersonPicker`/`TeamPicker`/entity-combobox primitive exists. | `apps/web/components/personnel/personnel-event-form.tsx` L851–1367; `current-person-state-foreshadow.tsx` L81–89; `headcount/exemption-panel.tsx` L182–198; `headcount/override-panel.tsx` L148–155; `dashboard/dashboard-filters.tsx` L196–205; `reports/report-filters.tsx` L185–194; `organization/historical-org-headcount-foreshadow.tsx` L86–94; `correction-cases/correction-cases-panel.tsx` L819–824, L1022–1027; `personnel/personnel-lifecycle-panel.tsx` L195–228; `audit/audit-investigation-panel.tsx` L425–520; `import/migration-reconciliation-workspace.tsx` L485–506; `operations/launch-artifact-panel.tsx` L708–732 |
| E1b | — | **Business identifiers already exist and are unique in the schema**, so this is a UI/resolver gap, not a data-model gap: `Person.personnelCode @unique`, `OrganizationalUnit.code @unique`, `OrganizationalRole.code`, `JobTitle.code`, `Ladder.code`, `Grade @@unique([ladderId, code])`, `Seniority.code`. `Employment` and `PrimaryAssignment` have **no** business code — those must be resolved from person + effective date, not typed. | `packages/db/prisma/schema.prisma` |
| E1c | — | Working pattern already exists but is used in only a few places: `approval-panel.tsx` renders `nameFa (code)` dropdowns from `organization.list` + `jobReference.listJobTitles`; `person.search` and `person.getByPersonnelCode` already resolve codes. Missing: `organization.getByCode`, `jobReference.getByCode`, open-employment lookup for a person. | `apps/web/components/headcount/approval-panel.tsx`; `apps/web/src/server/person.ts`, `organization.ts`, `job-reference.ts` |
| E2 | "«اطلاعات کامل/ویرایش» and «ثبت رویداد» are not buttons and do nothing" | **Partly different from the report.** Both handlers *are* wired: `openEdit(row)` opens `PersonnelQuickEditModal`; `navigateRegister(row.id)` routes to `/personnel-events/register?person=…`. The real defects are (a) `variant="ghost"` gives no button affordance, and (b) a **suspected leave-guard swallow**: when `pendingRef.current` is already set, `requestNavigation` returns `false` without opening a dialog, so the click silently does nothing. | `apps/web/components/personnel/personnel-list-panel.tsx` L238–250, L340–360; `apps/web/components/ui/button.tsx` L24; `apps/web/components/leave-guard-provider.tsx` L124–125 |
| E3 | Stale banner is meaningless | **Confirmed as a copy/semantics defect.** Message is «داده به‌روز نیست — تا {HH:MM} محاسبه نشده.» where the time is `MAX(updated_at)` of pending/failed rows — i.e. **the last change time, not a deadline**. No cause, no scope, no next step. Fail-closed path emits `00:00`. | `apps/web/lib/operational-copy.ts` L699–701; `apps/web/components/stale-recalc-banner.tsx` L16–31; `apps/web/src/server/platform-status.ts` L31–37; `packages/modules/person-employment/src/personnel-event-recalc.ts` L289–305 |
| E4 | Table scrolls horizontally with little content; last-column buttons unclear | **Confirmed.** Wrapper classes force table min-width regardless of content, and every cell is `whitespace-nowrap` with no truncation or wrapping. | `personnel-list-panel.tsx` and `audit-investigation-panel.tsx` (`min-w-[72rem]`), `access-people-panel.tsx` (`min-w-[64rem]`), `personnel-events-list-panel.tsx` and `report-catalogue-panel.tsx` (`min-w-[48rem]`); `apps/web/components/ui/table.tsx`; `apps/web/components/governed-data-table/governed-data-table.tsx` |
| E5 | «ورود گروهی» pages are empty | **Confirmed — three empty scaffolds.** `/personnel/bulk-import`, `/personnel-events/bulk-import`, `/headcount/bulk-import` all render `<SectionTabPlaceholder />` («محتوای این بخش در استوری بعدی تکمیل می‌شود.»). Real bulk work only exists in sidebar «ورود داده» (`/import`, `hr_admin` only), so Operators have no bulk path at all. | `apps/web/app/(app)/*/(tabs)/bulk-import/page.tsx`; `apps/web/lib/section-tab-surfaces.ts`; `apps/web/app/(app)/import/page.tsx` |
| E6 | «ایجاد» in ظرفیت و جذب is empty; «هدکانت» has many sub-sections | **Confirmed.** `/headcount/create` is a placeholder; `/headcount/capacity` stacks four panels vertically (`HeadcountApprovalPanel`, `HeadcountExemptionPanel`, `HeadcountOverridePanel`, `HistoricalOrgHeadcountForeshadow`) instead of the EXPERIENCE-specified "governed table + toolbar create". | `apps/web/app/(app)/headcount/(tabs)/create/page.tsx`, `.../capacity/page.tsx`; EXPERIENCE.md §ظرفیت و جذب |
| E7 | Reports UX is poor; wants tabs | **Confirmed.** `/reports` is a flat page with a single in-page report selector and no section tabs, unlike the five tabbed surfaces. Export is a stub in places. | `apps/web/app/(app)/reports/page.tsx`; `apps/web/components/reports/report-catalogue-panel.tsx`; `apps/web/lib/section-tab-surfaces.ts` |
| E8 | Need a sample Excel for data entry | **Confirmed gap.** A template registry exists server-side (`LAUNCH_IMPORT_TEMPLATES`, `templateHeaderMap`, header validation) but there is **no downloadable sample workbook** anywhere in the UI. Users must guess headers. | `packages/modules/migration/src/templates.ts`, `parse-workbook.ts`; no download path in `apps/web/components/import/*` |
| E9 | "I don't know what پرونده‌های اصلاح is" | **Confirmed as a discoverability/copy gap, not a build gap.** The surface is fully implemented (~1100 lines, full tRPC workflow, `hr_admin` only) but has no explanation, no entry point from a person's profile, and a name that does not convey "external data-subject correction requests (FR-53)". | `apps/web/components/correction-cases/correction-cases-panel.tsx`; `apps/web/app/(app)/correction-cases/page.tsx` |
| E10 | Want an admin-only «تنظیمات» section | **Confirmed as absent.** No `Setting`/`Config` model, no settings route, no settings nav entry. ~60 tunable parameters live in constants/env across identity, audit envelope, inference/bulk, audit trust, retention, import, export, pagination, recalculation, headcount, correction attachments, and infrastructure. Only fragments are admin-editable today (access admin, legal hold, launch artifacts); the data dictionary is **read-only** in UI. | `packages/modules/*/src/*.ts` constants; `packages/db/prisma/schema.prisma`; `apps/web/app/(app)/access/*`, `/personnel/dictionary`, `/operations` |
| E11 | UI is not uniform across sections | **Confirmed.** Row actions are `ghost` almost everywhere but `outline` in `org-flat-job-ref-panel.tsx`; padding differs (`h-8 px-2` present/absent); toolbar CTA variants are inconsistent; five distinct table min-width conventions; `link` variant unused. | `apps/web/components/ui/button.tsx`; panels listed in E4/E11 |

**Additional confirmed IA defects found during verification (not reported by the user):**
- `/personnel-events/events` renders `FIXTURE_EVENTS`, not real data ("fixture only; no org-wide list API").
- `/personnel/profile/[personId]` accepts only a UUID path segment (`isPersonUuid`), so a personnel code deep-link fails; the personnel list has no direct row link to the profile.
- Operators and Managers see **no** bulk path whatsoever (section tabs empty + `/import` is admin-only).

---

## 2. Impact Analysis

### 2.1 Epic impact

| Epic | Status | Impact of this change |
|---|---|---|
| 1 Secure Access & Persian Desktop Shell | done | Token/affordance delta only; button variant contract tightened. No re-open. |
| 2 Entitlements & Access Governance | done | Access tables inherit the table-readability and affordance retrofit. Domain untouched. |
| 3 Workforce Master Data & Organization | done | Provides the business codes the new pickers resolve. `org-flat` variant inconsistency fixed. Domain untouched. |
| 4 Personnel Events, Temporal State & Headcount | done | `personnel-event-form` gets the largest retrofit (UUID → pickers). Event contracts and validation unchanged. |
| 4b Shell & IA Alignment | done | Its intentionally thin scaffolds (`ورود گروهی` ×3, `ایجاد`) are now completed; `governed-data-table` primitive is extended (sizing, truncation, column visibility). |
| 5 Search, Profiles, Dashboard & Reports | done | Reports surface gains section tabs; events list replaces fixture data; profile deep-link and list→profile navigation added. |
| 6 Migration, Baseline & Governed Export | done | Template registry gains sample-workbook generation/download; import engine is reused by per-section bulk entry. |
| 7 Audit, Operations & Evidence Controls | done | Correction cases gain explanation + entry points; settings changes must emit audit evidence through the existing envelope. |
| **8 Experience Foundation & Identifier Ergonomics (NEW)** | proposed | Design-system hardening, entity pickers, affordance/table readability, self-explaining copy. |
| **9 Operational Surface Completion & IA Coherence (NEW)** | proposed | Bulk entry, sample templates, capacity IA, reports tabs, real events list, correction-case discoverability, no-dead-end IA gate. |
| **10 Administrative Settings & Governed Parameters (NEW)** | proposed | Governed settings store + admin-only settings surface with audited change control. |

**Epic order:** 1 → 2 → 3 → 4 → 4b → 5 → 6 → 7 → **8 → 9 → 10**
**Renumbering:** none. Epics 8–10 are appended; existing IDs are stable.

This also closes the open Epic 7 retro action *"Do not invent Epic 8; require PO-approved PRD/epic update before next committed epic"* — this proposal **is** that PO-approved update.

### 2.2 Story impact

No completed story is reopened or marked failed. Epic 8–10 stories carry forward-contract AC that supersede presentation-level AC in 1.3, 1.5, 2.3, 4b.4, 4b.7, 5.1, 5.5 and 6.1 (the same supersession pattern Epic 4b used). Two items move from `deferred-work.md` into committed scope: the personnel-events fixture list, and the list→profile navigation.

### 2.3 Artifact conflicts

| Artifact | Conflict | Action |
|---|---|---|
| **PRD** (`prds/prd-divan-2026-07-11/prd.md`) | The PRD has **no** usability contract beyond FR-43 (Persian/RTL, sectioned forms, confirmations). Nothing forbids UUID entry, nothing requires design-system consistency, nothing requires a configuration-administration surface, nothing requires a downloadable import template. The delivered product is PRD-compliant yet product-owner-rejected — this is a **PRD gap**, and the PRD must describe the target. | **Amend:** add §8.12 with FR-57…FR-60; extend consequences of FR-33, FR-37, FR-43. See §4.1. |
| **epics.md** | No Epic 8–10; UX-DR set stops at UX-DR28 and targets ux-divan-2026-07-19; FR Coverage Map lacks FR-57…FR-60. | **Amend:** new UX-DR29…UX-DR37, three epic entries + story sets, coverage map rows, `inputDocuments` retarget to the new UX revision. See §4.2. |
| **UX contract** (`ux-divan-2026-07-19`) | Sufficient for shell/IA, **insufficient** for: entity-picker pattern, action-affordance system, table sizing/truncation/column-visibility, reports IA, capacity IA, bulk-entry pattern, settings IA, explanation/help pattern. Also, the current implementation deviates from it (capacity tabs, reports tabs). | **Supersede:** produce `ux-divan-2026-07-31` (DESIGN delta + EXPERIENCE delta) via `bmad-ux` **before** Epic 8 stories are finalized. 2026-07-19 stays as historical reference; spines win on conflict. |
| **Architecture spine** | No AD-1…AD-6 change for pickers/UI. **One genuine architecture delta:** a governed settings store (new table + typed registry + resolver replacing constants) and its read path for domain modules. | **Amend lightly:** add a settings-configuration note to `ARCHITECTURE-SPINE.md` (or an Epic 10 companion note) covering storage, caching, fail-closed defaults, and the "security-critical parameters are not UI-mutable" boundary. |
| **sprint-status.yaml** | No epic-8/9/10 keys. | **Amend:** append epics + stories as `backlog`, retrospectives `optional`. See §4.4. |
| **deferred-work.md** | Contains items now promoted to committed scope. | Annotate promoted items with their new story IDs at implementation time. |
| Completed story files (1.x–7.x) | Historical | Leave as-is; Epics 8–10 are the forward contract. |

### 2.4 Technical impact

- **`apps/web` dominates.** New shared primitives: `entity-picker` (async, code-first search), a table sizing/column-visibility layer on `governed-data-table`, a help/definition pattern, and a settings form kit.
- **Thin server additions:** `getByCode` resolvers for org units and job references; open-employment/primary-assignment lookup for a person; sample-workbook generation from the existing template registry; settings CRUD.
- **One new persistence area:** governed application settings (typed rows, defaults, validation, versioning, audited change events). Must be read through a resolver so modules stop importing constants directly, and must fail closed to code defaults when unavailable.
- **Zero changes** to the event store, temporal engine, authorization model, headcount invariants, or audit envelope semantics.
- **Risks:** (a) touching the shipped `personnel-event-form` risks regressing Epic 4 validation — mitigate by keeping mutation payloads identical (pickers resolve to the same IDs) and adding a selfcheck; (b) settings that shadow security constants could weaken fail-closed posture — mitigate by the curated allowlist decided in §3; (c) broad visual refactors risk a11y regressions — mitigate with the Epic 8 consistency/a11y gate story.

---

## 3. Recommended Approach

### Selected path: **Option 1 — Direct Adjustment** (three appended epics + PRD amendment + new UX revision)

| Option | Assessment |
|---|---|
| **1 — Direct Adjustment** | **Selected.** Domain substrate is correct and delivered; the gap is presentation, identifier ergonomics, surface completeness, and configuration. Appending Epics 8–10 with a refreshed UX contract addresses all reported issues without disturbing shipped domain behavior. Effort: **High** (broad but shallow, mostly `apps/web`). Risk: **Medium**. |
| **2 — Rollback** | **Not viable.** Nothing to roll back: the events, projections, authorization, headcount and audit work is correct and would have to be rebuilt identically. |
| **3 — MVP scope review** | **Not needed as a cut, but required as an addition.** MVP functional scope is delivered; what changes is that the PRD acquires an explicit usability/configuration contract it previously lacked. No FR is removed or deferred. |

### Confirmed product decisions (AtA, 2026-07-31)

| Decision | Choice |
|---|---|
| Working mode | **Batch** |
| UX sequencing | **Produce `ux-divan-2026-07-31` first** (via `bmad-ux`), then finalize Epic 8–10 stories against it |
| Epic shape | **Three epics** — 8 experience foundation + identifiers, 9 surface completion + IA, 10 admin settings |
| «ورود گروهی» tabs | **Fill them** — same governed import engine, per-domain template, plus sample-workbook download |
| Settings scope | **Curated** — a safe editable set persisted in the database, plus a read-only inventory of infrastructure/security parameters; every change attributable and audited |

### Rationale

1. Every reported defect maps to a missing *contract*, not a broken mechanism — so the durable fix is PRD + UX contract first, then implementation.
2. Splitting into three epics keeps each shippable and independently valuable: 8 makes existing surfaces usable, 9 removes dead ends, 10 hands operational control to the admin.
3. Sequencing 8 → 9 → 10 means Epic 9's new surfaces are built **on** the corrected primitives instead of inheriting the current inconsistencies (the same lesson Epic 4b learned before Epic 5).
4. Settings last: it is the only epic with a schema/architecture delta, and it benefits from the settled form/table conventions of Epic 8.

---

## 4. Detailed Change Proposals

### 4.1 PRD — new §8.12 and amended consequences

**Insert new section after §8.11 (after FR-56), before §9:**

```markdown
### 8.12 Product Usability, Identifier Ergonomics, and Configuration Administration

#### FR-57: Business-identifier-first interaction
Users MUST identify people, organizational units, job reference concepts, and governed records by approved business identifiers; the system MUST NOT require internal technical identifiers as user input.

**Consequences (testable):**
- Every user-facing selection of a Person, Organizational Unit/Team, Organizational Role, Job Title, Ladder, Grade, Seniority, or Headcount Approval is made through a permission-safe search/selection control keyed on Personnel Code, organizational/job code, or approved name — never by typing an internal identifier.
- Records without a business identifier (Employment, Primary Assignment) are selected from the permission-safe records of an already-identified Person with their distinguishing facts shown; they are never typed.
- Internal identifiers remain available for audit, correlation, and support as explicitly labelled, copyable technical detail; they are never the primary displayed identity of a person, team, or job concept.
- Selection controls remain permission-safe and enumeration-safe under FR-33 and FR-48: out-of-scope subjects are not revealed by suggestions, counts, or response timing.

#### FR-58: Consistent, discoverable interaction system
All MVP surfaces MUST present one consistent interaction system in which available actions are visually and programmatically discoverable.

**Consequences (testable):**
- One shared component system defines control appearance, hierarchy, density, spacing, and focus treatment; equivalent actions look and behave identically across every surface.
- Every surface follows one page-layout pattern — surface title, purpose line, context indicator, and a single primary action region — with one shared form-layout pattern for label placement, grouping, required marking, help text, inline error, and footer action order.
- Actionable controls are unambiguously distinguishable from static text at rest — not only on hover — and expose accessible names and keyboard operation.
- Data tables size to their content: no surface forces horizontal scrolling that its content does not require; long values truncate or wrap with the full value reachable; users can control which approved columns are shown.
- An action that cannot currently be performed is either absent or visibly disabled with a Persian reason; no control may accept a click and do nothing.
- Loading, pending, saved, and failed states use one defined feedback vocabulary with a stated precedence between inline, transient, and system-level messages, and honour reduced-motion preferences.
- Every surface, state, badge, chart, and banner is specified and verified in both light and dark themes at the accessibility contrast floor; visual encodings in charts remain distinguishable in both themes.

#### FR-59: Complete and self-explaining operational surfaces
Every surface reachable from navigation MUST be functional and MUST explain its purpose, state, and next step in user terms.

**Consequences (testable):**
- No navigable surface renders a placeholder or empty scaffold at launch; a capability that is not delivered is absent from navigation rather than present and inert.
- Each surface states its purpose in operational Persian, including who uses it and what it governs; governance-specific surfaces name their real-world trigger.
- Every system-state message states the fact, its cause, its scope, and the next step available to the user; internal mechanism names and internal timestamps are not presented as user-facing meaning.
- Bulk data entry for a supported domain is reachable by every role permitted to create that data individually, uses the same validated preview/execute path as FR-37, and offers a downloadable template that matches the accepted structure exactly.

#### FR-60: Governed application configuration administration
Authorized administrators MUST view and, where explicitly permitted, change governed application parameters through an attributable, audited administration surface.

**Consequences (testable):**
- Every governed parameter is registered with a Persian label and description, type, unit, allowed range or allowlist, default, current effective value, and source (governed store, environment, or code default).
- The registry declares each parameter as administrator-editable or read-only-with-evidence; parameters that constitute the fail-closed security, authorization, audit-integrity, or identity posture are read-only in the UI and change only through the approved deployment/artifact path under FR-55.
- Every change records actor, time, previous value, new value, stated reason, and effect time and produces audit evidence under FR-42; changes are reversible to the registered default.
- An invalid, missing, or unreadable configuration value fails closed to the registered default and surfaces the degraded state under FR-45; configuration never silently widens permission, retention, or export boundaries.
```

**Amend the consequences of three existing FRs (append the listed bullets):**

| FR | Appended consequence |
|---|---|
| **FR-33** | "Search and selection controls used inside forms follow the same permission-safe, enumeration-safe rules as list search; a form-level selector may not reveal subjects the caller cannot list." |
| **FR-37** | "For every supported template the system offers a downloadable sample workbook whose structure, headers, and value formats are generated from the same authoritative template definition used for validation, so a downloaded sample always validates." |
| **FR-43** | "Interaction consistency, action discoverability, content-driven table sizing, and self-explaining state messages are part of this contract as specified in FR-58 and FR-59." |

**MVP impact:** no requirement removed, no scope deferred. FR-57…FR-60 formalize a quality bar the MVP was measured against implicitly.

---

### 4.2 epics.md — edits

**4.2.1 Frontmatter `inputDocuments`**

**OLD:**
```yaml
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-19.md
```

**NEW:**
```yaml
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-19.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md
  # Prior UX revisions retained as historical reference only (spines win on conflict):
  # - .../ux-divan-2026-07-19/{DESIGN,EXPERIENCE}.md
  # - .../ux-divan-2026-07-13/{DESIGN,EXPERIENCE}.md
```

**4.2.2 Requirements Inventory — append FR57…FR60** (one-line summaries mirroring §4.1) and add coverage-map rows:

```
FR57: Epic 8 — Business-identifier-first pickers and resolvers
FR58: Epic 8 — Consistent interaction system, affordance, and table readability
FR59: Epic 9 — Complete, self-explaining operational surfaces and bulk entry
FR60: Epic 10 — Governed application configuration administration
```

Also extend existing rows: `FR33: … ; Epic 8 — in-form permission-safe selectors`, `FR37: … ; Epic 9 — sample templates and per-section bulk entry`, `FR43: … ; Epic 8 — interaction consistency baseline`.

**4.2.3 New UX Design Requirements (append after UX-DR28)**

| ID | Requirement |
|---|---|
| **UX-DR29** | `entity-picker` primitive — async, permission-safe, code-first. Displays «کد — نام» plus disambiguating facts; accepts Latin/Persian digits; keyboard-operable combobox semantics (`role="combobox"`, `aria-expanded`, `aria-activedescendant`); shows recent/scoped defaults; empty and out-of-scope states are indistinguishable in wording and timing. Variants: person, org unit/team, organizational role, job title, ladder→grade (cascading), seniority, headcount approval, account. Dependent-record variants (employment, primary assignment) list a chosen person's permission-safe records with dates, never free text. |
| **UX-DR30** | Action-affordance system — a documented mapping from action semantics to control appearance (primary CTA, secondary, tertiary/row action, destructive, disabled-with-reason). Row actions have a visible boundary at rest, consistent icon+label, consistent size/padding, and identical placement across surfaces. Overflow beyond two row actions uses a labelled menu. No control may be clickable and inert. |
| **UX-DR31** | Table readability — content-driven column widths with per-column max width, truncation plus accessible full value, and wrapping for designated long-text columns; no fixed `min-width` that forces horizontal scroll; user-controlled column visibility with persistence; sticky identifier/actions columns retain a visible separator when scrolled; density toggle (compact/comfortable). |
| **UX-DR32** | Self-explaining state — every banner, empty state, and blocking message states fact + cause + scope + next step, with an optional «توضیح بیشتر» disclosure. The recalculation banner names what is stale, which actions are blocked, and what the user should do; it never presents an internal timestamp as a deadline. Each surface has a one-line purpose statement and a definition entry for domain terms. |
| **UX-DR33** | گزارش‌ها IA — section tabs grouping the launch catalogue by family, with a report workspace of filter rail + result table + run metadata (as-of, last calculation, row count) + export. Report selection is reflected in the URL. |
| **UX-DR34** | ظرفیت و جذب IA — «هدکانت» is a governed table with toolbar create; «ایجاد» is the full approval creation form; exemptions, overrides, and historical reconstruction move to their own tabs or a record-scoped drawer instead of stacking on one page. |
| **UX-DR35** | Bulk-entry pattern — per-section «ورود گروهی» uses one shared flow: template download → upload → validated preview → confirm → result, reusing `import-preview-table` and the FR-37 engine, scoped to that domain and to the caller's permissions; distinct from the sidebar migration wizard, with a stated difference in copy. |
| **UX-DR36** | تنظیمات IA — admin-only surface with section tabs by domain; each parameter row shows Persian label, description, unit, current value, default, source, allowed range, editability, last change actor/time; edit uses inline validation, a reason field where required, «بازگشت به پیش‌فرض», and a confirmation for high-impact parameters; read-only parameters state why and where they change. |
| **UX-DR37** | Wayfinding and terminology — navigation labels state user outcomes; governance surfaces (e.g. «پرونده‌های اصلاح») carry a purpose line and contextual entry points from related records; a glossary/help disclosure defines internal terms encountered in the UI. |
| **UX-DR38** | Visual hierarchy and layout system — one page-header pattern (surface title, purpose line, context/as-of indicator, single primary action region); an explicit spacing rhythm and layout grid applied to every surface; a defined panel/card/section system with rules for when a surface uses cards versus a full-bleed table; content max-widths per surface type; one form-layout pattern (label placement, field grouping, required marking, help text, inline error, footer action order) used by every form; a single icon set with size/stroke/pairing rules. Typography roles from DESIGN are used semantically — no ad-hoc sizes or weights. |
| **UX-DR39** | Feedback, loading, and motion — skeleton placeholders shaped like their eventual content for initial loads; in-place pending states for filters, saves, and finalize actions; one result-feedback pattern (inline for form scope, toast for background scope, banner for system scope) with defined precedence; destructive/sensitive confirmation posture unchanged; all transitions short and purposeful, and fully disabled under `prefers-reduced-motion`. |
| **UX-DR40** | Theme parity and data-visualization quality — every surface, state, badge, chart, and banner is specified for light and dark with AA contrast at 14px in both; a defined chart palette with categorical, sequential, and status roles that stays distinguishable in both themes and for common color-vision deficiency; chart typography, axis/label, legend, tooltip, tabular numeral, empty, suppressed-cohort, and stale-data treatments defined once and reused by dashboard and reports. |

**4.2.4 Epic List — append three entries**

```markdown
### Epic 8: Experience Foundation & Identifier Ergonomics
Operators and admins work with people, teams, and job concepts by their real business codes inside one coherent visual and interaction system — a single page-layout, form, table, feedback, and theming language — removing UUID entry, inconsistent controls, unreadable tables, and unexplained system messages from every existing surface.
**FRs covered:** FR57, FR58; FR33, FR43 (extended consequences). **UX contract:** ux-divan-2026-07-31. **Sequencing:** after Epic 7 (done); before Epic 9.

### Epic 9: Operational Surface Completion & IA Coherence
Every navigable surface does real work: per-section bulk entry with downloadable templates, a coherent capacity-and-hiring structure, a tabbed report workspace, a real personnel-events list, and discoverable governance surfaces — with no placeholder tabs remaining in navigation.
**FRs covered:** FR59; FR33, FR36, FR37, FR53 (surface completion). **Sequencing:** after Epic 8.

### Epic 10: Administrative Settings & Governed Parameters
A system administrator sees every governed application parameter in one place and changes the explicitly permitted ones with validation, reason, audit evidence, and reset-to-default, while security-critical parameters stay read-only with their change path stated.
**FRs covered:** FR60; FR42, FR45, FR55 (evidence and change control). **Sequencing:** after Epic 9.
```

**4.2.5 Proposed story sets** *(final AC to be written against `ux-divan-2026-07-31`)*

#### Epic 8 — Experience Foundation & Identifier Ergonomics

| Story | Title | Core intent |
|---|---|---|
| 8.1 | Interaction system audit & control contract | Inventory every control/table/panel/form in the app; publish the variant↔semantics mapping (UX-DR30) in code (typed variants, lint or selfcheck guard); fix `org-flat` and padding drift; one gold CTA per toolbar region preserved. Output includes the gap list that 8.2–8.9 work from. |
| 8.2 | Visual design language & layout system | Implement UX-DR38: one page-header pattern (title, purpose line, context/as-of, primary action region) on every surface; spacing rhythm and layout grid; panel/card/section system with cards-vs-full-bleed rules; one form-layout pattern applied to every form; single icon set with usage rules; semantic use of the DESIGN typography roles with no ad-hoc sizes. Ships a dev-only component gallery as the living reference. |
| 8.3 | `entity-picker` primitive & code resolvers | Build the shared picker (UX-DR29) plus missing server resolvers (`organization.getByCode`, `jobReference.getByCode`, person open-employment/primary-assignment lookup); enumeration-safe timing and messages; keyboard/a11y complete. |
| 8.4 | Personnel event form — identifier-first retrofit | Replace all 15 UUID fields in `personnel-event-form` with pickers and cascading ladder→grade; employment/assignment chosen from the selected person's records; mutation payloads and Epic 4 validation unchanged; form adopts the 8.2 layout pattern; capacity panel and approval selection show human labels. |
| 8.5 | Remaining UUID inputs retrofit | Dashboard/report/historical team filters; headcount exemption and override panels; correction-case person and link target; lifecycle scope and disposal person lists; audit investigation actor/entity; reconciliation owner/approver; launch-artifact owner/approver. Internal IDs demoted to labelled technical detail. |
| 8.6 | Governed table readability upgrade | Implement UX-DR31 in `governed-data-table` + `ui/table`; remove the five `min-w-[…]` wrappers; truncation with accessible full value; column visibility with persistence; density toggle; sticky-column separators. |
| 8.7 | Row-action affordance & dead-click elimination | Apply the UX-DR30 row-action pattern app-wide; **fix the leave-guard early-return** (`leave-guard-provider.tsx` L124–125) so a blocked navigation always surfaces a dialog or a reason; add a selfcheck asserting no rendered action is inert. |
| 8.8 | Feedback, loading & motion system | Implement UX-DR39: content-shaped skeletons, in-place pending states for filter/save/finalize, one result-feedback pattern with defined precedence between inline, toast, and banner, short purposeful transitions, full `prefers-reduced-motion` compliance. |
| 8.9 | Self-explaining state & operational copy overhaul | Rewrite the recalculation banner (cause, blocked actions, next step; no internal timestamp as deadline); surface purpose lines; empty/blocked-state copy pass; «توضیح بیشتر» disclosure and glossary entries (UX-DR32, UX-DR37). |
| 8.10 | Design QA, consistency & accessibility gate | Screen-by-screen comparison against the `ux-divan-2026-07-31` mockups and spines; cross-surface consistency checklist; light/dark parity and AA contrast verification at 1280×720 and 1920×1080; picker, table, and dialog a11y probes; consolidated into a runnable selfcheck that later epics must pass. |

#### Epic 9 — Operational Surface Completion & IA Coherence

| Story | Title | Core intent |
|---|---|---|
| 9.1 | Sample-workbook generation & template catalogue | Generate a downloadable sample per registered template from the authoritative definition (formula-safe per FR-52), with a template catalogue visible in «ورود داده» and each bulk-entry tab; guarantee a downloaded sample validates. |
| 9.2 | Shared bulk-entry flow (per-section «ورود گروهی») | One reusable flow (UX-DR35) over the FR-37 engine; permission-scoped so Operators get a bulk path; concurrent-batch and preview leave-guard rules inherited; copy distinguishes it from the migration wizard. |
| 9.3 | Bulk entry for personnel, events, and headcount | Wire the three empty tabs to their domain templates and validators; no placeholder remains. |
| 9.4 | ظرفیت و جذب IA restructure | «هدکانت» becomes a governed table with toolbar create; «ایجاد» hosts the approval creation form; exemptions/overrides/historical reconstruction relocate per UX-DR34; headcount domain rules unchanged. |
| 9.5 | گزارش‌ها section tabs & report workspace | Implement UX-DR33; URL-addressable report selection; run metadata and export consistent with FR-41/FR-52. |
| 9.6 | Personnel events list — real data | Replace `FIXTURE_EVENTS` with a permission-safe org-wide event list API, filters, and row actions (deferred-work promotion). |
| 9.7 | Profile access & cross-surface drill-through | Row link from the personnel list to the full profile; accept personnel code in the profile deep-link (with canonical redirect); dashboard/report reconciliation links land on filtered detail. |
| 9.8 | Governance surface discoverability | «پرونده‌های اصلاح» purpose line, terminology, and contextual entry from a person's profile/timeline; same treatment for other governance-only surfaces. |
| 9.9 | No-dead-end IA gate | Automated route audit: every nav entry and section tab resolves to functional content for at least one role; placeholders are absent from navigation; add to CI/selfcheck. |
| 9.10 | Dashboard & report visual quality | Apply UX-DR40 to the dashboard and report workspace: chart palette with categorical/sequential/status roles legible in light and dark and under common color-vision deficiency; chart typography, axis, legend, tooltip, and tabular-numeral treatment; consistent empty, suppressed-cohort, and stale-data visuals; metric cards adopt the 8.2 panel system. |

#### Epic 10 — Administrative Settings & Governed Parameters

| Story | Title | Core intent |
|---|---|---|
| 10.1 | Governed settings registry & store | Typed parameter registry (label, description, type, unit, range/allowlist, default, editability, domain) + persisted store + resolver with cached read and fail-closed default; module constants read through the resolver. |
| 10.2 | تنظیمات surface & admin-only access | New nav entry with its own permission; section tabs by domain (UX-DR36); registry-driven rendering; deny path audited. |
| 10.3 | Editable parameter wave 1 | Import limits (file size, rows, drafts/TTL), export artifact TTL and custody threshold, list/search page sizes and caps, headcount reservation-expiry warning window, correction-case attachment limits/allowlist, entitlement recertification window. Inline validation and confirmation for high-impact values. |
| 10.4 | Read-only inventory of infrastructure & security parameters | Environment/code-sourced values (identity/LDAP, session timeouts, audit-envelope policy/category paths, inference-bulk thresholds, audit-trust thresholds, pool size, baseline boundary) shown with source and change path; no secrets rendered; exportable as evidence. |
| 10.5 | Configuration change control & evidence | Reason capture, effect time, previous/new value, reset-to-default, actor attribution; audit evidence via the existing envelope; fail-closed on invalid/unavailable configuration with a visible degraded state under FR-45; selfcheck proving no parameter can widen permission/retention/export boundaries. |

---

### 4.3 UX artifacts

| Item | Action |
|---|---|
| `ux-divan-2026-07-31` (new) | Produce via `bmad-ux` as a **delta revision** inheriting 2026-07-19. **DESIGN delta:** control-affordance tokens, page-header and panel/card system, spacing rhythm and layout grid, form-layout pattern, icon set rules, table sizing/truncation tokens, picker, settings row, help disclosure, skeleton/feedback/motion tokens, chart palette and chart typography for light and dark. **EXPERIENCE delta:** UX-DR29…UX-DR40 behaviours, reports/capacity/settings IA, bulk-entry flow, feedback precedence, terminology. **Key mockups (light and dark):** personnel list, personnel event form with pickers, person profile, reports workspace, dashboard, capacity/هدکانت, bulk-entry flow, settings surface — these mockups are the acceptance reference for Story 8.10 design QA. |
| `ux-divan-2026-07-19` | Retain; annotate superseded-as-contract in epics frontmatter. Its IA (capacity tabs, bulk tabs) is finally *honoured* rather than replaced. |
| `ux-divan-2026-07-13` | Unchanged historical reference. |

### 4.4 sprint-status.yaml

**Append after `epic-7-retrospective`:**

```yaml
  epic-8: backlog
  8-1-interaction-system-audit-control-contract: backlog
  8-2-visual-design-language-layout-system: backlog
  8-3-entity-picker-primitive-code-resolvers: backlog
  8-4-personnel-event-form-identifier-first-retrofit: backlog
  8-5-remaining-uuid-inputs-retrofit: backlog
  8-6-governed-table-readability-upgrade: backlog
  8-7-row-action-affordance-dead-click-elimination: backlog
  8-8-feedback-loading-motion-system: backlog
  8-9-self-explaining-state-operational-copy: backlog
  8-10-design-qa-consistency-accessibility-gate: backlog
  epic-8-retrospective: optional

  epic-9: backlog
  9-1-sample-workbook-generation-template-catalogue: backlog
  9-2-shared-bulk-entry-flow: backlog
  9-3-bulk-entry-personnel-events-headcount: backlog
  9-4-capacity-hiring-ia-restructure: backlog
  9-5-reports-section-tabs-workspace: backlog
  9-6-personnel-events-list-real-data: backlog
  9-7-profile-access-cross-surface-drill-through: backlog
  9-8-governance-surface-discoverability: backlog
  9-9-no-dead-end-ia-gate: backlog
  9-10-dashboard-report-visual-quality: backlog
  epic-9-retrospective: optional

  epic-10: backlog
  10-1-governed-settings-registry-store: backlog
  10-2-settings-surface-admin-access: backlog
  10-3-editable-parameter-wave-1: backlog
  10-4-readonly-infrastructure-security-inventory: backlog
  10-5-configuration-change-control-evidence: backlog
  epic-10-retrospective: optional
```

**Also close the Epic 7 action item** *"Do not invent Epic 8; require PO-approved PRD/epic update before next committed epic"* with `resolved_in: sprint-change-proposal-2026-07-31.md`.

### 4.5 Architecture

Add to `ARCHITECTURE-SPINE.md` (or an Epic 10 companion note):

> **Configuration:** Governed application parameters live in a typed registry with a database-backed store read through a single resolver with cached reads; modules never read raw environment variables or literals for registered parameters. Unavailable or invalid values fail closed to the registered code default and raise the FR-45 degraded state. Security, authorization, audit-integrity, and identity posture parameters remain deployment-managed and are read-only in the UI. No AD-1…AD-6 change.

---

## 5. Implementation Handoff

### Scope classification: **Major**

This adds four functional requirements to the PRD, a new UX contract revision, three epics, and one architecture delta. It requires PM/Architect involvement before development, not just backlog reshuffling.

### Handoff plan

| Order | Role | Responsibility |
|---|---|---|
| 1 | **Product Owner (AtA)** | Approve this proposal |
| 2 | **UX (Sally)** — `bmad-ux` | Produce `ux-divan-2026-07-31` delta (DESIGN + EXPERIENCE + key mocks) covering UX-DR29…UX-DR37 |
| 3 | **PM (John)** — `bmad-prd` update | Apply §4.1 PRD amendments (§8.12 FR-57…FR-60; FR-33/37/43 consequences) |
| 4 | **Architect (Winston)** | Apply the §4.5 configuration note; review the Epic 10 settings-store boundary |
| 5 | **PO/Dev (Amelia)** — `bmad-create-epics-and-stories` | Apply §4.2 epics.md edits and §4.4 sprint-status edits with final AC written against the new UX revision |
| 6 | **Dev (Amelia)** — `bmad-create-story` → `bmad-dev-story` | Implement 8.1 → 8.8, then 9.1 → 9.9, then 10.1 → 10.5 |

### Success criteria

1. No user-facing form requires an internal identifier; every person/team/job selection is by code or name.
2. No navigable surface renders a placeholder; every role permitted to create data individually has a bulk path with a downloadable, guaranteed-valid template.
3. Row actions are visibly actionable and never inert; the leave-guard always explains a blocked navigation.
4. No table forces horizontal scrolling its content does not require; column visibility and truncation work in every list.
5. Every banner and blocking message states fact, cause, scope, and next step; no internal timestamp is presented as a deadline.
6. Every surface uses the same page-header, panel, form, feedback, and loading patterns, and each key screen matches its `ux-divan-2026-07-31` mockup in light and dark at the contrast floor.
7. An admin can see every governed parameter with its source and change the permitted set with reason, audit evidence, and reset-to-default; security-critical parameters remain read-only with a stated change path.
8. Epics 1–7 domain behaviour, audit evidence, and authorization outcomes are unchanged — verified by existing selfchecks.

### Checklist completion snapshot

| Section | Status |
|---|---|
| 1 Trigger & context | Done — stakeholder product-fit review; 11 reports verified against source |
| 2 Epic impact | Done — three appended epics; no renumbering; no reopened epic |
| 3 Artifact conflicts | Done — PRD amended (primary), UX superseded, epics + sprint-status amended, architecture note added |
| 4 Path forward | Done — Option 1 Direct Adjustment; rollback not viable; MVP not cut |
| 5 Proposal components | Done (this document) |
| 6 Final approval | **Pending user approval** |

---

## Approval

- [ ] Approved for implementation
- [ ] Revise (notes below)
- [ ] Rejected

**Approver:** AtA **Date:** ____
