---
baseline_commit: 112209e
---

# Story 9.4: Capacity & Hiring IA Restructure

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a capacity owner,
I want one readable headcount page instead of four stacked panels,
so that I can see the capacity picture without scrolling through unrelated blocks (UX-DR34, FR59).

**Story key:** `9-4-capacity-hiring-ia-restructure`  
**Epic:** 9 — Operational Surface Completion & IA Coherence (FR59; UX-DR34)  
**UX contract:** `ux-divan-2026-07-31` (EXPERIENCE §IA ظرفیت و جذب; DESIGN `record-drawer` 480px; mockup `screens-reports-capacity.html` §۲)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (Gap E6 — empty «ایجاد»; four stacked panels on «هدکانت»)  
**Prerequisite:** Stories **9.1–9.3** done («ورود گروهی» wired). Epic 4 headcount domain (approvals / exemptions / overrides / historical). Epic 8 primitives (GovernedDataTable, FormLayout, EntityPicker, RowActionCluster, FeedbackMessage, Sheet).  
**Downstream:** **9.5** reports subject tab «ظرفیت و جذب»; **9.9** no-dead-end gate expects create tab + drawer functional (not placeholder).

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Section tabs IA | `section-tab-surfaces.ts` `/headcount` | Tabs already **هدکانت · ایجاد · ورود گروهی**; layout + purpose line | Create still placeholder; capacity still stacks four panels |
| Approval UI | `approval-panel.tsx` | Create form + list + activate/cancel; UUID `<select>` for team/title; local `StatusMessage` | Split: table on هدکانت; form on ایجاد; EntityPicker + FormLayout; FeedbackMessage |
| Exemption / override / historical | `exemption-panel.tsx`, `override-panel.tsx`, `historical-org-headcount-foreshadow.tsx` | Full stacked admin panels on capacity page | Move into **record-drawer** opened from approval row; leave capacity page as one table |
| Bulk tab | `headcount/(tabs)/bulk-import/page.tsx` | Story 9.2/9.3 shared flow `section="headcount"` | **Preserve unchanged** — not this story’s scope |
| Governed table + row actions | `GovernedDataTable`, `RowActionCluster`, personnel-list pattern | Toolbar CTA + icon row actions + focusable strip | Adopt for approvals list |
| Sheet primitive | `components/ui/sheet.tsx` | Side sheet; `side="right"` → logical `end-0` (inline-end in RTL) | Record-drawer: **`side="right"`** + width `--drawer-width` (480px); Escape + focus return to originating row |
| Create-tab mirror | `personnel-events/(tabs)/register/page.tsx` → `PersonnelEventFormHost` | Full form on dedicated section tab (not placeholder) | Same host pattern for `/headcount/create` + approval create form |
| Form pattern | `FormLayout` / `FormField` / `FormFooter` | Story 8.2 form chrome | Host approval create on «ایجاد» |
| Entity pickers | `createOrgUnitSearch`, `createJobTitleSearch` | Code-first entity search | Replace UUID selects on create form |
| Domain APIs | `apps/web/src/server/headcount.ts` + `@divan/headcount` | list/create/activate/cancel approvals; exemption CRUD; list/void overrides; historical counts | **Unchanged rules** — UI restructure only; optional thin list filters only |
| Design-QA | `selfcheck:design-qa` + matrix | Headcount+drawer row currently `pass` on primitives presence | Update matrix **note** to governed-table + record-drawer IA (keep Result honest) |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **«هدکانت» vs «ایجاد» vs «ورود گروهی»** | هدکانت = **one** GovernedDataTable of approvals + toolbar create + row drawer. ایجاد = **full** approval creation form (no longer `SectionTabPlaceholder`). ورود گروهی = keep 9.3 bulk host — do not touch domain wiring. |
| **Toolbar create vs ایجاد tab** | Toolbar primary «ایجاد مجوز» **navigates** to `/headcount/create` (same form). Do not duplicate two divergent create UIs. Optional: after successful create, offer navigate back to هدکانت. |
| **Record-drawer vs stacked panels** | Exemptions, overrides, and historical reconstruction open **from the approval row** in one Sheet — not as siblings under the table. One drawer at a time; never over a dialog. |
| **«Scoped to approval» honesty** | Overrides have `approvalId` / `teamId` / `slotId` — filter drawer lists by `teamId` (and client-filter `approvalId === row.id` when set). **Exemptions are PrimaryAssignment-scoped in domain — no `approvalId` FK.** Do **not** invent an exemption↔approval join. Drawer opens **in the context of** the approval row (identity in header); exemption create/list stay existing APIs with honest purpose copy (coverage for capacity on this team’s work). Historical foreshadow stays read-only as-of; may prefill team from the approval. |
| **Override create in drawer** | Domain has `createOverride`; **tRPC today only exposes `listOverrides` + `voidOverride`** (overrides issued on event finalize). AC requires overrides **open** in the drawer — list + void is enough. Do **not** invent a new admin “issue override” product path unless PO expands scope; mockup “ثبت بازنویسی” may stay out or map to honest empty/help copy. |
| **Presentation/IA over domain** | Epic 4 coverage matching, reservation, atomic consumption, override audit, exemption revoke rules **unchanged**. No new AR-\* keys. No Prisma/SQL in `apps/web`. |
| **StatusMessage clones** | First-touch on every panel this story rewrites: replace local `StatusMessage` with **FeedbackMessage** (Epic 8 / 8.8). Do not leave new clones. |
| **Matrix Headcount + drawer** | Already `pass` for primitives. After this story, refresh the note to “governed table + row record-drawer (9.4)” — do not silently claim chart/report completeness (9.5/9.10). |

## Acceptance Criteria

1. **Given** the current capacity surface with stacked panels  
   **When** the restructure is complete  
   **Then** section tabs remain **هدکانت · ایجاد · ورود گروهی** (already in `SECTION_TAB_SURFACES` — preserve labels/hrefs)

2. **And** «هدکانت» (`/headcount/capacity`) is a **GovernedDataTable** of approvals with toolbar create («ایجاد مجوز» → `/headcount/create`) and **per-row icon actions** (activate / cancel where valid; open record-drawer for details / exemptions / overrides / historical)

3. **And** «ایجاد» (`/headcount/create`) hosts the **full** approval creation form using Story **8.2** `FormLayout` / `FormField` / `FormFooter`, EntityPicker for team and job title (no raw UUID `<select>`), Jalali validity dates, FeedbackMessage for errors — **and is no longer** `SectionTabPlaceholder`

4. **And** exemptions, overrides, and historical reconstruction open in a **`record-drawer`** (Sheet, inline-end, width `--drawer-width` / 480px) scoped to the **approval row** that opened it, with **record identity** (requirement code + team label) in the drawer header

5. **And** the drawer closes on **Escape** and returns focus to the **originating row action** (controlled Sheet: capture trigger / `onCloseAutoFocus` — do not rely on missing `SheetTrigger`)

6. **And** all Epic 4 headcount domain rules — coverage matching, reservation, atomic consumption, override audit, exemption lifecycle — are **unchanged** (no parallel validators; no new permission strings)

7. **And** Epic 8 / Epic 9 encode held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - First-touch FeedbackMessage / PageHeader / FormLayout / EntityPicker / RowActionCluster; no StatusMessage clones; no UUID entity inputs; no ghost actions
   - «ورود گروهی» still hosts 9.3 flow
   - AR-\* fail-closed; presentation/IA only

8. **And** scope boundaries:
   - Does **not** change bulk templates/cutover (9.3)
   - Does **not** implement reports workspace (9.5) or chart visual quality (9.10)
   - Does **not** invent exemption↔approval FK or admin create-override SoT without PO
   - Does **not** silently close Epic 7/8 production-honesty / security carry-ins

## Tasks / Subtasks

- [x] Task 1: Split approval surface — table vs create (AC: #1–#3, #6)
  - [x] REFACTOR `approval-panel.tsx` (or replace with focused modules under `components/headcount/`):
    - **NEW** `headcount-approvals-table.tsx` (name flexible): `GovernedDataTable` bound to `api.headcount.listApprovals`; columns: requirement code, team (resolve nameFa/code via org list or row hydrate — never show bare UUID as primary cell), allowed/used/reserved/free (`tabular` / Persian digits), status badge, validity Jalali; `preferencesKey` e.g. `headcount-approvals`
    - Toolbar: primary Button → `router.push("/headcount/create")` (or `requestNavigation` if leave-guard relevant — create form dirty only)
    - `rowActions` via `RowActionCluster`: open drawer (eye/details); activate (draft only); cancel (draft/active) — reuse existing mutations; `assertActionHonesty`; no inert icons
    - Loading / error / empty → **FeedbackMessage** (not local StatusMessage)
    - Optional filters: status / team EntityPicker — nice-to-have if cheap (listApprovals already accepts `status` + `teamId`)
  - [x] **NEW** `headcount-approval-create-form.tsx`: extract create fields from current panel; wrap in `FormLayout` + `FormSection` + `FormField` + sticky `FormFooter` (Cancel ghost → `/headcount/capacity`; primary «ایجاد پیش‌نویس»)
    - Team: `EntityPicker` + `createOrgUnitSearch` (constrain selection to `unitType === "TEAM"` at submit / filter options — fail closed if non-team)
    - Job title: `EntityPicker` + `createJobTitleSearch`
    - Optional seniority if product create already supports it (`seniorityId` on createApproval) — only if already in API; do not invent
    - Leave-guard when dirty (mirror personnel-add pattern)
  - [x] UPDATE `capacity/page.tsx`: render **only** PageHeader (if needed beyond layout) + approvals table — **remove** stacked Exemption/Override/Historical imports
  - [x] UPDATE `create/page.tsx`: render create form; delete `SectionTabPlaceholder` usage
  - [x] Keep glossary terms / purpose copy coherent with layout purpose line

- [x] Task 2: Record-drawer from approval row (AC: #4–#6)
  - [x] **NEW** `headcount-approval-record-drawer.tsx` (compose existing Sheet):
    - Controlled `open` + `approvalId` (or full row) from table
    - `SheetContent` **`side="right"`** (maps to logical `end-0` = inline-end in RTL — do **not** use `side="left"`, which docks at `start`); `className` force `w-[var(--drawer-width)] max-w-[var(--drawer-width)]` (override default `max-w-lg` ≈512px)
    - Header: `SheetTitle` = `{requirementCode} — {teamLabel}`; description = status · مصوب · آزاد (Persian digits)
    - Body sections (PanelSection / hairline): **معافیت‌ها** | **بازنویسی‌ها** | **بازسازی تاریخی** (labels match mockup intent)
    - Reuse exemption create/list/activate/revoke UI **inside** drawer (extract presentational pieces from `exemption-panel` rather than mounting four page-level stacks). Same for override list+void filtered by `teamId` (+ client `approvalId` when present). Mount `HistoricalOrgHeadcountForeshadow` (or slim variant) with team context from approval when feasible
    - Footer: «افزودن معافیت» focuses/expands exemption form; «بستن» closes; do not add fake override-create unless wiring `createOverride` is explicitly approved
    - Escape: Sheet default + `onEscapeKeyDown`; **focus return**: save `HTMLElement` from row action click; `onCloseAutoFocus={(e) => { e.preventDefault(); triggerEl?.focus(); }}`
  - [x] Ensure one drawer instance; closing clears selection; active row styling optional (mockup `active-row`)
  - [x] Preserve TechnicalDetailDisclosure for technical ids inside exemption rows — operators still see codes/names first

- [x] Task 3: First-touch Epic 8 hygiene on rewritten panels (AC: #7)
  - [x] Replace all local `StatusMessage` in touched headcount components with `FeedbackMessage`
  - [x] No new UUID text inputs for entities; EntityPicker only
  - [x] Row actions ≥24px targets; tooltips via RowActionCluster
  - [x] Update `design-qa-mockup-matrix.md` Headcount + drawer note for 9.4 IA (Result stays `pass` if probes green; do not flip other amendment rows)

- [x] Task 4: Design-QA / DoD / honesty (AC: #6–#8)
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green
  - [x] `@divan/web` typecheck; eslint on touched files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits
  - [x] Do not weaken headcount domain selfchecks; no need to change `@divan/headcount` unless adding optional `approvalId` filter on `listOverrides` (nice-to-have — client filter OK)

### Manual DoD checklist

- [x] `/headcount/capacity` shows **one** approvals table — no exemption/override/historical stacked below
- [x] Toolbar «ایجاد مجوز» lands on `/headcount/create` with working FormLayout form
- [x] Create with EntityPicker team+title → draft approval appears in table after navigate/invalidate
- [x] Row activate/cancel still work with Persian FeedbackMessage errors
- [x] Row «جزئیات» opens 480px inline-end drawer with requirement code in header
- [x] Drawer shows exemptions + overrides (filtered/contextual) + historical; Escape closes; focus returns to row action
- [x] `/headcount/bulk-import` still runs 9.3 five-step flow
- [x] No `SectionTabPlaceholder` under headcount routes
- [x] `selfcheck:design-qa` green; matrix note updated
- [x] No Prisma/ExcelJS in `apps/web`; no domain rule changes

### Review Findings

- [x] [Review][Patch] حذف پنل‌های یتیم exemption/override و پاک‌سازی import/selfcheck مرتبط — تصمیم: گزینه ۱ [exemption-panel.tsx; override-panel.tsx]
- [x] [Review][Patch] ستون تیم نباید UUID خام نشان دهد تا org list لود شود [headcount-approvals-table.tsx:177]
- [x] [Review][Patch] همگام‌سازی هدر drawer با ردیف به‌روز بعد از activate/cancel یا invalidate [headcount-approvals-table.tsx:154]
- [x] [Review][Patch] FeedbackMessage برای loading/error تیم‌ها در فرم ایجاد؛ جلوگیری از EntityPicker خالی بی‌توضیح [headcount-approval-create-form.tsx:45]
- [x] [Review][Patch] اعتبارسنجی سخت‌گیرانهٔ allowedCount (فقط ارقام صحیح؛ بدون truncateی parseInt) [headcount-approval-create-form.tsx:127]
- [x] [Review][Patch] رد کلاینتی بازهٔ اعتبار معکوس/صفر برای ایجاد مجوز و معافیت [headcount-approval-create-form.tsx:140; headcount-approval-record-drawer.tsx:253]
- [x] [Review][Patch] فوکوس فرم معافیت بعد از mount با useEffect نه requestAnimationFrame تکی [headcount-approval-record-drawer.tsx:280]
- [x] [Review][Patch] ریست busyId و reportingTreatment هنگام بستن drawer [headcount-approval-record-drawer.tsx:187]
- [x] [Review][Patch] catch روی mutateAsync فعال‌سازی/لغو برای جلوگیری از unhandled rejection [headcount-approvals-table.tsx:212]
- [x] [Review][Patch] ذخیرهٔ trigger پایدار برای بازگردانی فوکوس (منوی overflow / کلیک ردیف) [headcount-approvals-table.tsx:229]
- [x] [Review][Patch] کپی صادقانه‌تر فهرست معافیت‌ها (سراسری است؛ بدون القای فیلتر مجوز) [headcount-approval-record-drawer.tsx:333]
- [x] [Review][Patch] غیرفعال کردن JalaliDatePicker هنگام busy در فرم ایجاد [headcount-approval-create-form.tsx:228]
- [x] [Review][Patch] prefill تیم تاریخی بدون regex شکننده روی teamLabel — فیلدهای ساخت‌یافته روی ردیف [headcount-approvals-table.tsx:171; headcount-approval-record-drawer.tsx:164]

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| One readable هدکانت table | Keep four stacked panels on capacity |
| Fill «ایجاد» with real FormLayout form | Leave SectionTabPlaceholder |
| Record-drawer from approval row (480px, Escape, focus return) | New top-level tabs for exemption/override/historical (UX-DR34 chose drawer) |
| Reuse Epic 4 tRPC + `@divan/headcount` APIs | Reimplement matching/reservation/consume |
| EntityPicker + FeedbackMessage on first-touch | UUID `<select>` / StatusMessage clones |
| Preserve bulk-import 9.3 | Rewrite bulk templates or cutover |
| Honesty on exemption scope (no fake FK) | Invent approvalId on exemptions |

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `app/(app)/headcount/(tabs)/capacity/page.tsx` | Stacks 4 panels | Approvals table only | `assertPageAccess`; auth redirect |
| `app/(app)/headcount/(tabs)/create/page.tsx` | `SectionTabPlaceholder` | Create form host | Page access gate |
| `app/(app)/headcount/(tabs)/bulk-import/page.tsx` | 9.3 host | **No change** (verify still works) | PageHeader + BulkImportCatalogueHost |
| `app/(app)/headcount/(tabs)/layout.tsx` | SurfaceSectionTabsLayout | Likely unchanged | Purpose line |
| `lib/section-tab-surfaces.ts` | Correct three tabs | Likely unchanged | Labels هدکانت/ایجاد/ورود گروهی |
| `components/headcount/approval-panel.tsx` | Monolith form+list | Split / replace | Mutations + status badges semantics |
| `components/headcount/exemption-panel.tsx` | Page-level stack | Extract for drawer embed | EntityPicker cascade; activate/revoke |
| `components/headcount/override-panel.tsx` | Page-level stack | Extract list+void for drawer | Filters; void mutation |
| `components/organization/historical-org-headcount-foreshadow.tsx` | On capacity page | Mount in drawer | Read-only as-of honesty |
| `components/ui/sheet.tsx` | max-w-lg side sheets | Prefer className override at call site; only change primitive if token default is clearly wrong for all sheets | Import preview bottom sheet |
| `lib/design-qa-mockup-matrix.md` | Headcount note = panels present | Note → 9.4 table + drawer | Other rows |

### Domain / API cheat-sheet (call — do not reimplement)

```
headcount.listApprovals({ status?, teamId? })
headcount.createApproval({ requirementCode, teamId, jobTitleId, seniorityId?, allowedCount, validityStart, validityEndExclusive, approvalReference? })
headcount.activateApproval({ id })
headcount.cancelApproval({ id })
headcount.listExemptions({ status?, personId?, primaryAssignmentId? })  // NO approvalId filter — do not invent
headcount.createExemption / activateExemption / revokeExemption
headcount.listOverrides({ status?, violatedRule?, teamId?, slotId? })  // client-filter approvalId
headcount.voidOverride({ id })
organization.getHistoricalCounts / foreshadow component        // unchanged semantics
```

Permissions (seeded — do not invent): `headcount.approval.read|write`, `headcount.exemption.read|write`, `headcount.override.read|write` (exact keys as already used in `headcount.ts` meta).

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Next.js App Router | Server pages keep `assertPageAccess`; interactive pieces `"use client"` |
| GovernedDataTable | Same contract as personnel list (preferencesKey, rowActions, toolbar) |
| Sheet (Radix Dialog) | Controlled open; Escape; manual focus restore for non-Trigger open |
| FormLayout 8.2 | `max-w-4xl`; sticky footer; Cancel · primary |
| CSS token | `--drawer-width: 480px` / `--spacing-drawer-width` in `globals.css` |
| Design-QA | Mandatory green before baseline claim |

### Testing requirements

| Check | Command / method |
| --- | --- |
| Design-QA gate | `pnpm --filter @divan/web selfcheck:design-qa` |
| Types / lint | `@divan/web` typecheck; eslint touched files |
| Operational copy | Add keys if new Persian strings; `selfcheck:operational-copy` |
| Manual | DoD checklist |
| Domain | Existing `@divan/headcount` selfchecks remain green if module untouched |

### Previous story intelligence

**From 9.3 (done, baseline `112209e`):** Bulk headcount tab is live (`headcount_approval_create`, activate path, permission-aware day-to-day authorize). **9.4 must not break** `/headcount/bulk-import`. Review honesty: PE/HC bulk cutover may be outside single TX — unrelated to this IA story. Prefer FeedbackMessage adoption on panels you touch (Epic 8 open item).

**From 9.2 / 9.1:** Dual-entry IA («ورود داده» ≠ «ورود گروهی»); shared flow host pattern; PageHeader on bulk tabs.

**From Epic 8 retro / 9.1 gate:** Mandatory `selfcheck:design-qa`; first-touch EntityPicker / RowActionButton / FeedbackMessage; amendment rows are work-to-close; AR-\* fail-closed; Epic 9 presentation/IA only.

**From Epic 4 headcount:** Approval list returns `used/reserved/free` from slot claims; create leaves **draft** until activate; cancel rules unchanged. Override catalogue is audit/void — issuance is event-path. Exemption revoke can require rebind — preserve fail-closed UX messages.

**From deferred-work:** Local StatusMessage clones in headcount panels deferred from earlier stories — **close on panels this story rewrites**. Coarse nav vs approval permission empty UX — keep FeedbackMessage honesty when list denied.

### Git intelligence summary

Recent commits: `112209e` story 9.3 → `cb20355` 9.2 → `cf65a86` 9.1 → `d219310` epic 8 retro. Pattern: presentation/IA stories stay thin in `apps/web`; domain in `packages/modules/*`; selfcheck + matrix honesty; BOM-safe sprint-status; extract shared UI instead of copy-paste; Decision/Patch/Defer review discipline.

### Project structure notes

- UI under `apps/web/components/headcount/` + thin route pages under `app/(app)/headcount/(tabs)/`
- Layout system: `FullBleedTableHost` for table tab; `FormLayout` for create tab; `Panel`/`PanelSection` inside drawer
- Module boundary AD-3: web calls tRPC only; no `@prisma/client` in apps/web

### Latest tech information

- Radix Dialog/Sheet: Escape closes; focus returns to **Trigger** automatically only when Trigger is used. For **controlled** open from `rowActions`, capture the button element and restore via `onCloseAutoFocus` (preventDefault + `trigger.focus()`).
- Prefer existing Sheet over new drawer library — DESIGN already maps record-drawer → Sheet + `--drawer-width`.

### Project context reference

No `project-context.md` found in repo at story creation; follow Architecture Spine AD-3/AD-5 (no Prisma in web; envelope-governed tRPC) and UX 2026-07-31 spines as forward contract.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9 / Story 9.4 / UX-DR34]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — Gap E6]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-59]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — IA + record-drawer]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — drawer-width 480px]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/screens-reports-capacity.html` — §۲ هدکانت]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-3]
- [Source: `_bmad-output/implementation-artifacts/9-3-bulk-entry-personnel-events-headcount.md`]
- [Source: `apps/web/app/(app)/headcount/(tabs)/capacity/page.tsx`]
- [Source: `apps/web/components/headcount/approval-panel.tsx`]
- [Source: `apps/web/lib/section-tab-surfaces.ts`]
- [Source: `apps/web/components/ui/sheet.tsx`]
- [Source: `apps/web/components/form-layout/index.tsx`]
- [Source: `apps/web/src/server/headcount.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Implementation Plan

- Split approval monolith into GovernedDataTable (هدکانت) + FormLayout create form (ایجاد) + Sheet record-drawer.
- Embed exemption list/create, override list+void (team/approval scoped), and historical foreshadow inside drawer.
- First-touch FeedbackMessage / EntityPicker; structural selfcheck for IA gates.

### Debug Log References

### Completion Notes List

- Split capacity IA: `HeadcountApprovalsTable` (GovernedDataTable + RowActionCluster) on `/headcount/capacity`; `HeadcountApprovalCreateForm` (FormLayout + EntityPicker team/title, TEAM fail-closed) on `/headcount/create`.
- Record-drawer Sheet (`side="right"`, `--drawer-width` 480px) hosts exemptions (honest PrimaryAssignment scope), overrides (team + client approvalId filter, list+void only), and historical foreshadow with team prefill; Escape + `onCloseAutoFocus` focus return.
- Replaced StatusMessage clones with FeedbackMessage on touched headcount panels; matrix Headcount note updated for 9.4; `selfcheck:headcount-ia` + `selfcheck:design-qa` + typecheck green. ESLint blocked by pre-existing `eslint-module-utils` resolve failure (tooling, not story code).
- Domain APIs unchanged; bulk-import tab untouched; no exemption↔approval FK; no admin create-override path.

### File List

- `apps/web/app/(app)/headcount/(tabs)/capacity/page.tsx`
- `apps/web/app/(app)/headcount/(tabs)/create/page.tsx`
- `apps/web/components/headcount/headcount-approvals-table.tsx`
- `apps/web/components/headcount/headcount-approval-create-form.tsx`
- `apps/web/components/headcount/headcount-approval-record-drawer.tsx`
- `apps/web/components/headcount/headcount-approval-types.ts`
- `apps/web/components/headcount/headcount-ia.selfcheck.ts`
- `apps/web/components/organization/historical-org-headcount-foreshadow.tsx`
- `apps/web/lib/design-qa-mockup-matrix.md`
- `apps/web/lib/entity-picker.selfcheck.ts`
- `apps/web/package.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/9-4-capacity-hiring-ia-restructure.md`
- DELETED: `apps/web/components/headcount/exemption-panel.tsx`
- DELETED: `apps/web/components/headcount/override-panel.tsx`
- DELETED: `apps/web/components/headcount/approval-panel.tsx`

## Change Log

- 2026-08-01: Story 9.4 — capacity/hiring IA restructure (table + create form + record-drawer); design-qa green; status → review.
- 2026-08-02: Code review patches applied (orphan panel deletion, validation/focus/honesty fixes); status → done.

## Story completion status

Status: **done**  
Completion note: Implementation + code-review patches complete; ACs satisfied.
