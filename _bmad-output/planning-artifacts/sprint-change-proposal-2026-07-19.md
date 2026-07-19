# Sprint Change Proposal — Divan Shell & IA Alignment (UX 2026-07-19)

**Date:** 2026-07-19  
**Project:** divan  
**Workflow:** bmad-correct-course  
**Mode:** Batch  
**Status:** Approved for implementation  
**Approved by:** AtA  
**Approved date:** 2026-07-19  
**Authoritative UX:** `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/`  
**Supersedes (UX contract):** `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/` (prior mocks remain illustrative where not replaced; **spines win on conflict**)

---

## 1. Issue Summary

### Problem statement

The UX contract for Divan has been revised from `ux-divan-2026-07-13` to `ux-divan-2026-07-19`. The revision is a **shell and information-architecture redesign** (collapsible sidebar, section tabs, table-first governed lists, top-level Personnel Events, person-first Access admin, tree navigators for hierarchy / ladder-grade). Domain FRs are unchanged.

Epics **1–4 are done** against the prior shell/IA. Epic **5 is still backlog**. Building Epic 5 on the old IA would force a second frontend rework; aligning the shell **before Epic 5** avoids that waste.

### Discovery context

- Stakeholder / product direction: apply the new UX structure before Epic 5 development.
- Evidence: finalized `EXPERIENCE.md` + `DESIGN.md` (2026-07-19), IA wireframe, key mocks (`key-personnel-list`, `key-access-admin`, `key-org-ladder-grade`), inheritance map vs 2026-07-13.
- Sprint state (`sprint-status.yaml`): `epic-1`…`epic-4` = done; `epic-5`…`epic-7` = backlog.

### Issue type

**Strategic UX contract update** (presentation / IA pivot), not a failed technical approach or MVP scope cut.

---

## 2. Impact Analysis

### Epic impact

| Epic | Status | Impact |
|---|---|---|
| 1 Secure Access & Persian Desktop Shell | done | Retrofit collapsible sidebar, DESIGN delta tokens, nav labels/landings |
| 2 Entitlements & Access Governance | done | UI reshape of Story 2.3 surface to person-first section tabs (FR2–4 unchanged) |
| 3 Workforce Master Data & Organization | done | UI reshape of 3.5/3.6 to section tabs + `tree-navigator` |
| 4 Personnel Events, Temporal State & Headcount | done | Relocate event-form entry to top-level **رویدادهای پرسنلی**; leave-guard / prefill edges |
| **4b Shell & IA Alignment (NEW)** | proposed | Delivers 2026-07-19 spine primitives + retrofits before Epic 5 |
| 5 Search, Profiles, Dashboard & Reports | backlog | Depends on new table/tabs/IA; AC text updates; sequence after 4b |
| 6 Migration, Baseline & Governed Export | backlog | Dual-entry import (section **ورود گروهی** vs sidebar **ورود داده**); consistency rule |
| 7 Audit, Operations & Evidence Controls | backlog | Light — collapsible sidebar only; landings unchanged |

**Epic order:** 1 → 2 → 3 → 4 → **4b** → 5 → 6 → 7  
**Renumbering:** Not applied. Existing Epic 5–7 IDs stay stable (`epic-4b` inserted).

### Story impact (future / backlog)

| Story | Change needed |
|---|---|
| 5.1 | Surface label پرسنل → **اطلاعات پرسنلی / فهرست پرسنل**; `personnel-data-table` → `governed-data-table` semantics; Excel-like filters; default «همکار فعلی»; row actions + quick-edit |
| 5.2–5.3 | Entry via quick-edit «باز کردن پروفایل کامل» / palette; shell delta only |
| 5.4–5.5 | Nav/filter reconciliation labels; list drill uses new IA path |
| 6.x | Section bulk tabs vs migration wizard dual-entry |
| 1.3 / 1.5 / 2.3 / 3.5 / 3.6 (done) | Historical AC superseded by Epic 4b retrofit stories — annotate in epics.md; do not reopen as failed |

### Artifact conflicts

| Artifact | Conflict | Action |
|---|---|---|
| `epics.md` | UX-DR1/3/7/18/19 and inputDocuments point at 2026-07-13 | Update UX-DRs + add Epic 4b + patch Epic 5 AC; retarget inputDocuments |
| `sprint-status.yaml` | No epic-4b | Insert epic-4b + stories as `backlog` before epic-5 |
| UX 2026-07-13 | Superseded as contract | Keep for reference; declare 2026-07-19 authoritative |
| PRD | No IA-specific conflict (FR43 general) | **No MVP scope change**; optional cross-ref note only if desired |
| Architecture spine | apps/web only; no AD change | Optional one-line note: shell IA per UX 2026-07-19 |
| Implementation story files (1.x–4.x) | Historical | Leave as-is; Epic 4b is the forward contract |

### Technical impact

- Primarily `apps/web` shell, routing, and existing admin UIs (access, organization).
- Shared primitives: `section-tabs`, `governed-data-table`, `tree-navigator`, `personnel-quick-edit-modal`.
- No kernel / event-store / authz model changes required for the redesign itself.
- Risk: regressing done Access/Org UIs during retrofit — mitigate with story-level AC tied to mocks + a11y floor.

---

## 3. Recommended Approach

### Selected path: **Option 1 — Direct Adjustment (new Epic 4b)**

Insert **Epic 4b: Shell & IA Alignment** between completed Epic 4 and backlog Epic 5. Do **not** renumber Epics 5–7.

| Criterion | Assessment |
|---|---|
| Effort | **Medium–High** (frontend shell + two admin surface retrofits + scaffolds) |
| Risk | **Medium** (shared shell; Access/Org already shipped) |
| Timeline | Epic 5 start slips by duration of 4b; avoids larger double-build cost |
| Rollback (Option 2) | **Not viable** — domain work is correct; UI contract changed |
| MVP Review (Option 3) | **Not needed** — FR/NFR MVP unchanged |

### Rationale

1. Epics 1–4 are done; Epic 5 has not started — cheapest time to realign shell.
2. Epic 5’s primary list/profile work depends on `governed-data-table` and new IA entry points.
3. Inserting `4b` avoids churn renumbering five+ backlog stories and sprint keys.
4. PRD MVP remains achievable; change is presentation/IA alignment to an already-final UX spine.

---

## 4. Detailed Change Proposals

### 4.1 Epics.md — Frontmatter / inputs

**Section:** YAML `inputDocuments`

**OLD:**
```yaml
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md
```

**NEW:**
```yaml
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md
  # Prior UX retained for historical reference only:
  # - .../ux-divan-2026-07-13/DESIGN.md
  # - .../ux-divan-2026-07-13/EXPERIENCE.md
```

**Rationale:** Canonical UX contract is 2026-07-19.

---

### 4.2 Epics.md — UX Design Requirements (delta edits)

| ID | Action |
|---|---|
| UX-DR1 | Add `sidebar-width-collapsed: 64px`, `section-tabs-height: 44px`, governed-table filter-row tokens |
| UX-DR3 | Collapsible RTL sidebar (expanded default; footer toggle; persist; collapsed = icon + tooltip/`aria-label`); content reclaims width delta |
| UX-DR7 | Rename/align to **`governed-data-table`**: full-width; per-column enum multi-select + text typeahead filters; filter/sort → new snapshot, page=1; sticky id + sticky row actions; clear-filters → section defaults; **not AG Grid** |
| UX-DR18 | Operator landing → **اطلاعات پرسنلی** (فهرست پرسنل), not «پرسنل» |
| UX-DR19 | Replace IA list with 2026-07-19 sidebar order; add top-level **رویدادهای پرسنلی**; rename پرسنل → اطلاعات پرسنلی; section tabs on major surfaces |
| **UX-DR25 (new)** | `section-tabs` on each major nav surface; URL reflects tab; leave-guard on dirty form/preview tabs (theme/collapse exempt) |
| **UX-DR26 (new)** | `tree-navigator` for سلسله‌مراتب and لدر و گرید (expand/collapse, keyboard, grade-create requires ladder parent) |
| **UX-DR27 (new)** | Access admin person-first tabs: افراد و دسترسی · نقش‌ها · محدوده‌ها · دسترسی اضطراری |
| **UX-DR28 (new)** | `personnel-quick-edit-modal` for non-event field edits from فهرست; dirty Stay·Discard·Save; link to full profile |

---

### 4.3 Epics.md — Epic List (insert)

**Insert after Epic 4, before Epic 5:**

```markdown
### Epic 4b: Shell & IA Alignment (UX 2026-07-19)
Operators and admins use the redesigned Persian RTL shell — collapsible sidebar, section tabs, governed tables/trees — with Access and Organization admin surfaces retrofit to the new IA, before Search/Profiles/Dashboard work begins.
**FRs covered:** FR43 (presentation/IA), FR4/FR9/FR10 (UI reshape only; domain already delivered in Epics 2–3). UX contract: ux-divan-2026-07-19.
**Sequencing:** After Epic 4 (done); before Epic 5.
```

---

### 4.4 Epics.md — New Epic 4b stories (proposed)

#### Story 4b.1: DESIGN Delta Tokens & Collapsible App Shell

As an authenticated Divan user,  
I want a collapsible navy RTL sidebar with updated brand tokens,  
So that wide governed tables reclaim horizontal space at 1280×720+ (UX-DR1, UX-DR3).

**AC (summary):** Apply 2026-07-19 DESIGN delta (`sidebar-width-collapsed`, `section-tabs-height`, sidebar-active, governed-table/tree tokens). Sidebar expands by default; footer toggle; per-account persist; collapsed icons have tooltip + `aria-label`; chrome stays navy; theme/collapse do not trigger unsaved-form guards.

#### Story 4b.2: Section Tabs Chrome, Routing & Leave-Guards

As a user working in a major nav surface,  
I want horizontal section tabs whose URL reflects the active tab, with leave-guards on dirty forms/previews,  
So that I do not lose draft work when navigating (UX-DR25).

**AC (summary):** `tablist`/`tab`/`tabpanel`; route announces surface+tab; dirty guard on sidebar, tabs, palette, history; Stay · Discard · Save where applicable; theme toggle and sidebar collapse exempt.

#### Story 4b.3: Sidebar IA, Labels & Role Landings

As a role-filtered user,  
I want the 2026-07-19 sidebar order and landings,  
So that Personnel Events are top-level and Operator lands on اطلاعات پرسنلی (UX-DR18, UX-DR19).

**AC (summary):** Nav order per EXPERIENCE; unauthorized hidden; Operator → اطلاعات پرسنلی/فهرست; Admin/Manager → داشبورد; Audit → ممیزی; SysAdmin → عملیات; deep-link denial copy unchanged.

#### Story 4b.4: Governed Data Table Primitive

As a developer of list surfaces,  
I want a shared `governed-data-table` primitive,  
So that Epic 5+ lists share filter/sort/snapshot/a11y behavior (UX-DR7).

**AC (summary):** Compact full-width; enum multi-select + text typeahead filters; `aria-sort`; stable-snapshot pagination; filter/sort resets page=1; sticky RTL id + sticky row-actions; sensitive columns omitted from DOM; empty + «پاک کردن فیلترها» → section defaults; not AG Grid; announce count via polite live region. May ship with fixture/demo data until Epic 5 wires FR33.

#### Story 4b.5: Access Administration Person-First Retrofit

As an HR Admin,  
I want دسترسی‌ها organized as افراد و دسترسی · نقش‌ها · محدوده‌ها · دسترسی اضطراری,  
So that I answer “who can do what?” from people first (UX-DR27, UJ-Access, FR4 UI).

**AC (summary):** Retrofit Story 2.3 UI to section tabs matching `key-access-admin.html`; preserve attributable APIs/toxic fail-closed/empty copy; break-glass tab uses warning posture; no dialog-on-dialog.

#### Story 4b.6: Organization Section Tabs & Tree Navigators

As an HR Admin,  
I want ساختار سازمان as سلسله‌مراتب · نقش سازمانی · عنوان شغلی · لدر و گرید · ارشدیت,  
So that hierarchy and ladder/grade use trees and flat refs use governed tables (UX-DR26, FR9–FR10 UI).

**AC (summary):** Match `key-org-ladder-grade.html` + EXPERIENCE tabs; tree keyboard/`aria-expanded`; «افزودن گرید» disabled without ladder parent; deactivate-with-children fail-closed; no separate افزودن tab; domain rules from 3.5/3.6 unchanged.

#### Story 4b.7: Personnel & Events Shell Scaffolds + Event Entry Relocation

As an HR Operator,  
I want اطلاعات پرسنلی and رویدادهای پرسنلی section shells with Epic 4 event form hosted on ثبت رویداد,  
So that UJ-1 entry points exist before full Epic 5 list/profile depth (UJ-1 shell delta).

**AC (summary):**  
- اطلاعات پرسنلی tabs: فهرست · افزودن · ورود گروهی · فرهنگ داده (Admin) — فهرست may be scaffold/placeholder columns until 5.1.  
- رویدادهای پرسنلی tabs: رویدادها · ثبت رویداد · ورود گروهی — **ثبت رویداد** hosts existing Epic 4 `personnel-event-form`; row/nav «ثبت رویداد» pre-fills person; inbound prefill respects leave-guard (no silent swap).  
- Toolbar «افزودن سریع» / `personnel-quick-edit-modal` chrome per UX-DR28 (full FR33 list behavior remains Epic 5.1).  
- Capacity section tabs scaffold (هدکانت · ایجاد · ورود گروهی) acceptable as thin shells if needed for IA consistency.

---

### 4.5 Epics.md — Story 5.1 patches (example)

**Story:** 5.1 Permission-Safe Personnel Search & Lists  
**Section:** Acceptance Criteria

**OLD (excerpts):**
- `on پرسنل`
- `compact personnel-data-table pins sticky RTL identifier column; horizontal scroll stays inside the card`

**NEW:**
- `on اطلاعات پرسنلی / فهرست پرسنل`
- `governed-data-table` with EXPERIENCE columns + default filter همکار فعلی = yes (dismissible); Excel-like column filters; sticky id + sticky row actions («اطلاعات کامل/ویرایش», «ثبت رویداد»); horizontal scroll in table container; clear-filters restores section defaults
- Quick-edit modal for non-event fields; «باز کردن پروفایل کامل» link; «ثبت رویداد» navigates to رویدادهای پرسنلی / ثبت رویداد with person pre-filled

**Rationale:** Align Epic 5 with 2026-07-19 spine; depends on Epic 4b primitives.

*(Stories 5.2–5.5, 6.x: lighter label/path patches in same edit pass.)*

---

### 4.6 PRD

**Proposal:** **No functional/MVP edit required.**  
Optional: add a planning note in addendum or epics only that UX IA is defined by `ux-divan-2026-07-19`. PRD FR43 remains the Persian RTL contract.

**Status:** [Skip] unless product owner wants an explicit cross-reference sentence.

---

### 4.7 Architecture

**Proposal:** Optional companion note under apps/web mapping:

> Shell IA (collapsible sidebar, section tabs, governed tables/trees) follows `ux-divan-2026-07-19`; no AD-1…AD-6 change.

**Status:** Low priority; can ship with Epic 4b story notes instead of spine edit.

---

### 4.8 sprint-status.yaml

**Insert before `epic-5`:**

```yaml
  epic-4b: backlog
  4b-1-design-delta-tokens-collapsible-app-shell: backlog
  4b-2-section-tabs-chrome-routing-leave-guards: backlog
  4b-3-sidebar-ia-labels-role-landings: backlog
  4b-4-governed-data-table-primitive: backlog
  4b-5-access-administration-person-first-retrofit: backlog
  4b-6-organization-section-tabs-tree-navigators: backlog
  4b-7-personnel-events-shell-scaffolds-event-entry: backlog
  epic-4b-retrospective: optional
```

**Rationale:** Tracking for create-story / sprint-status workflows.

---

### 4.9 UX artifacts

| Item | Action |
|---|---|
| `ux-divan-2026-07-19` | Mark as **authoritative** for implementation (already `status: final`) |
| `ux-divan-2026-07-13` | Retain; annotate superseded-as-contract in epics frontmatter |
| Mocks / IA wireframe | Implementation reference for 4b.5–4b.7 and 5.1 |

---

## 5. Implementation Handoff

### Scope classification: **Moderate**

Requires backlog reorganization (new epic + story AC patches) plus coordinated PO/DEV execution. Not a PM/Architect strategic replan of product scope.

### Handoff recipients

| Role | Responsibility |
|---|---|
| **Product Owner / PM (John)** | Approve proposal; confirm Epic 4b story set and sequencing before Epic 5 |
| **UX (Sally)** | Clarify open questions OQ-R1…R3 during create-story if blocking; spines win on mock conflicts |
| **Developer (Amelia)** | After approval: apply `epics.md` + `sprint-status.yaml` edits; `create-story` for 4b.1 → implement in order |
| **Architect (Winston)** | Optional architecture note only; no AD change expected |

### Success criteria

1. `epics.md` lists Epic 4b with seven stories; UX-DRs reflect 2026-07-19; Epic 5.1 AC updated.  
2. `sprint-status.yaml` contains `epic-4b` backlog entries before `epic-5`.  
3. No Epic 5 story file created until 4b.1–4b.4 (minimum) ready — preferably full 4b done before 5.1.  
4. Access and Organization UIs match person-first / tabbed-tree mocks without changing FR domain behavior.  
5. Operator landing and nav labels match EXPERIENCE IA.

### Suggested implementation order

`4b.1` → `4b.2` → `4b.3` → `4b.4` → (`4b.5` ∥ `4b.6`) → `4b.7` → then Epic 5.

### Checklist completion snapshot

| Section | Status |
|---|---|
| 1 Trigger & context | Done |
| 2 Epic impact | Done — new 4b; 5–7 sequence after |
| 3 Artifact conflicts | Done — epics + sprint-status primary; PRD N/A; arch optional |
| 4 Path forward | Done — Option 1 Direct Adjustment |
| 5 Proposal components | Done (this document) |
| 6 Final approval / status yaml update | **Done** — approved by AtA 2026-07-19; epics.md + sprint-status.yaml updated |

---

## Approval

- [x] Approved for implementation  
- [ ] Revise (notes below)  
- [ ] Rejected  

**Approver:** AtA **Date:** 2026-07-19  

### Post-approval actions completed

- [x] Sprint Change Proposal finalized  
- [x] `epics.md` updated (UX-DRs, Epic 4b, Epic 5.1 patches)  
- [x] `sprint-status.yaml` updated with `epic-4b` backlog entries  
- [x] Handoff: Moderate → PO/DEV (create-story 4b.1 next)
