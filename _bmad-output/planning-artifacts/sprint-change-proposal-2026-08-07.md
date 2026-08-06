# Sprint Change Proposal — Post–Epic 10 UAT Unblock

**Date:** 2026-08-07  
**Project:** divan  
**Trigger:** Stakeholder UAT after Epic 10 completion — no further product epic in backlog; core HR workflows (personnel-event finalize) and UX discoverability block usable testing  
**Mode:** Batch  
**Authoring workflow:** bmad-correct-course  
**Status:** Approved 2026-08-07 (AtA) — Epic 11 added to epics.md + sprint-status.yaml

---

## 1. Issue Summary

After Epics 1–10 and retrospectives are **done**, there is **no Epic 11** in planning. Stakeholder testing uncovered a cluster of **delivery gaps and blockers** against already-specified FR / UX-DR contracts — not a new product domain.

### Core problem statement

UAT cannot proceed because (a) **personnel events cannot be finalized** in practice (capacity/override gates + stuck/blocking stale-recalc), and (b) several surfaces are **hard to understand or hard to use** (filters, Jalali picker, form chrome vs latest mockups, capacity drawer copy, draft-only create for headcount, and ops guidance that points to a path most roles cannot see).

### Issue types (checklist 1.2)

| Theme | Type |
|-------|------|
| Finalize blocked (capacity + override + stale) | Technical limitation / failed operational path discovered in UAT |
| Stale banner → «عملیات ← صف محاسبه» unreachable | Misunderstanding between copy and coarse nav matrix (discoverability) |
| Filter help misalignment; form chrome ≠ mockups; capacity drawer opaque; draft-only create UX | New/clarified UX requirements from stakeholder UAT (within FR-57–59 / UX-DR7/12/13/32/34/38) |
| Jalali month/year + RTL prev/next | Gap vs FR-44 / UX-DR12 (Story 1.6 incomplete for real date entry) |

### Evidence (checklist 1.3)

1. **DashboardFilters:** help text under some fields breaks vertical alignment of control rows.  
2. **StaleRecalcBanner:** «محاسبهٔ وضعیت جاری برای ۴۶ فرد هنوز کامل نشده…» with finalize blocked; second error line «وضعیت کهنه یا بازمحاسبه مانع نهایی‌سازی است».  
3. **Ops path dead-end:** disclosure copy references «عملیات ← صف محاسبه», but `/operations` is **system_admin-only** in `ROLE_NAV_HREFS`; HR roles never see «عملیات». Even for SysAdmin, UAT confirms **no UI labeled «صف محاسبه»** — only health section title «بازمحاسبه» (`opsSectionRecalc` / `#ops-recalc`) with pending/failed/stale counts, not a dedicated job queue screen.  
4. **Jalali picker:** month/year not directly selectable; prev/next feel swapped for RTL; reference [majidh1/jalaliDatePicker](https://github.com/majidh1/jalaliDatePicker).  
5. **Personnel event form:** «همکاری» / «انتصاب اولیه» unclear; empty «نتیجه‌ای یافت نشد» during Start Collaboration.  
6. **Form panel background** differs from surrounding page / latest UX mockups (2026-07-31).  
7. **Finalize failure** even with override reason and/or pre-created capacity: capacity-compat + stale/recalc messages.  
8. **Capacity record drawer** fields not intelligible to stakeholder.  
9. **Headcount/capacity create** only registers draft; activation only from table row actions (explicit form copy already says so).

---

## 2. Impact Analysis

### Epic impact

| Epic | Status | Impact |
|------|--------|--------|
| Epic 10 | done | **No reopen.** Issues are not AD-7 settings scope. |
| Epics 1, 4, 7, 8, 9 | done | **Do not reopen** for status churn; gaps map to shipped stories (1.6, 4.x finalize/headcount, 7.2 ops health, 8.x copy/layout, 9.4 capacity IA). |
| Future epics | none planned | **Add Epic 11** — UAT unblock & operational UX hardening. |
| Epic 10 retro action | open | «Decide next roadmap slice» → **resolved by this proposal** (Epic 11). |

**Order/priority:** Epic 11 becomes the **only** active delivery track until UAT can exercise Start Collaboration → finalize end-to-end.

### Story impact (proposed Epic 11 themes)

P0 — unblock finalize & recalc honesty for testers  
P1 — Jalali picker usability  
P2 — filter help / form chrome / glossary / capacity drawer / draft→activate UX  
P3 — ops copy & discoverability (role-aware next step; optional HR-safe status)

### Artifact conflicts

| Artifact | Conflict? | Needed update |
|----------|-----------|---------------|
| **PRD** | Soft | Clarify discoverability: stale next-step must be **role-reachable**; Jalali month/year as FR-44 elaboration; optional note that Start Collaboration may omit prior Employment/Primary pickers. MVP still valid — delivery incomplete. |
| **Epics** | Yes | Add **Epic 11** + stories; leave Epics 1–10 closed. |
| **Architecture** | Light | Confirm AD-6 stuck-recalc diagnosis/recovery path; document that ops health ≠ HR-facing queue; optional architecture note if HR gets a limited recalc-status signal. |
| **UX (2026-07-31)** | Yes | Filter help → label-adjacent info icon + tooltip; date picker month/year + RTL chrome; form surface tokens vs mock; capacity drawer field glossary; create flow activate CTA. |
| **sprint-status.yaml** | Yes | Add `epic-11` + stories `backlog`; mark Epic 10 roadmap action addressed when approved. |
| **Ops copy** | Yes | Fix `staleRecalcDisclosureBody` dead-end for non–system_admin. |

### Technical impact

- Investigate stuck `temporal.recalculate` / platform recalc signal (46 persons pending).  
- Trace finalize gate: capacity approval match + override/exemption + `blockingStale` / `recalculationPending`.  
- Shared form-field help pattern (info icon) used by DashboardFilters and forms.  
- JalaliDatePicker component upgrade (API + a11y + RTL).  
- Headcount create form: optional «ثبت و فعال‌سازی» (still respecting FR-28: non-Active not consumable).  
- Capacity drawer: human labels / glossary for used/reserved/free/exempt/override.

---

## 3. Recommended Approach

### Options evaluated

| Option | Viable? | Notes |
|--------|---------|-------|
| **1. Direct Adjustment** (stories only inside closed epics) | Not viable | Would reopen done epics/retros; status tracking becomes dishonest. |
| **2. Rollback** | Not viable | No bad epic to roll back; Epic 10 settings work is unrelated. |
| **3. MVP Review / reduce scope** | Not primary | MVP still correct; problem is **unusable delivery**, not wrong MVP goals. |
| **Hybrid → Option 1 shape inside NEW Epic 11** | **Selected** | New epic + stories; PRD/UX/Architecture light amendments; no MVP cut. |

### Recommendation

**Add Epic 11: UAT Unblock & Operational UX Hardening** — Direct Adjustment of backlog via a **new** epic (not reopening 1–10).

| Dimension | Assessment |
|-----------|------------|
| Effort | **Medium–High** (P0 finalize/recalc diagnosis is unknown until investigation; UX items Medium) |
| Risk | **Medium** (touching finalize/recalc gates; must stay fail-closed on FR-15/19/28/32/45) |
| Timeline | Unblocks all further UAT; should precede any new product epic |
| Scope class | **Moderate** — backlog reorganization (PO + Dev); Architect for recalc/override gates if root cause is AD-6/infra |

### MVP impact

MVP remains achievable. No FR removal. Epic 11 is **launch-critical honesty**: without finalize + intelligible capacity/date UX, FR-15/20/28/44/45 cannot be demonstrated.

---

## 4. Detailed Change Proposals

### 4.1 Epics (`epics.md`) — ADD Epic 11

**NEW:**

```markdown
### Epic 11: UAT Unblock & Operational UX Hardening

Stakeholders cannot complete core HR flows after Epics 1–10. This epic restores
end-to-end personnel-event finalization, role-honest stale/recalc guidance,
Jalali date usability, and high-friction UX gaps against UX 2026-07-31 — without
reopening closed epics.

Stories (indicative):
- 11.1 Diagnose & clear blocking stale/recalc for UAT; role-honest banner next steps (no invented «صف محاسبه» label — align copy to real «بازمحاسبه» section or ship a real queue UI if PO requires)
- 11.2 Personnel-event finalize path: capacity match, exemption/override UX, error honesty
- 11.3 Jalali date picker: month/year select + RTL-correct chrome (ref: majidh1/jalaliDatePicker patterns)
- 11.4 Compact field help: label-adjacent info icon + tooltip (filters + forms)
- 11.5 Form surface / chrome alignment to UX 2026-07-31 mockups
- 11.6 Capacity record drawer intelligibility + headcount create «save & activate»
- 11.7 Collaboration / Primary Assignment labeling & empty-state honesty for Start events
```

**Rationale:** Roadmap gap after Epic 10; maps to open retro action «Decide next roadmap slice».

### 4.2 PRD — light amendments

**Section:** FR-44 / Jalali (or UX cross-ref)

**OLD:** Jalali required for date entry (high level).  

**NEW:** Add: day grid remains; **direct month and year selection** required for practical historical entry; RTL navigation chrome must match reading direction.

**Section:** FR-45 / NFR-3 / operational honesty

**OLD:** Stale must not present as truth; ops surface for SysAdmin.  

**NEW:** Add: **user-facing next steps on blocking stale must be reachable for the actor’s coarse role** (do not point HR exclusively at SysAdmin-only `/operations`). SysAdmin ops health remains source of truth for queue depth.

**Section:** FR-20 Start Collaboration (clarification)

**NEW note:** On Start, prior Employment / Primary Assignment pickers may be empty; copy must say so (not look like a search failure).

### 4.3 Architecture spine — light note

**AD-6 / recalc:** Document UAT recovery expectation (worker health, stuck jobs, how SysAdmin reads `ops-recalc` section). If a non-admin «status only» signal is added, it must not expose HR person rows (FR-45).

**Finalize gates:** Explicit ordered checklist in spine or companion: capacity compatibility → exemption/override → stale/recalc block — with UI surfacing **which** gate failed.

### 4.4 UX (2026-07-31)

| Area | Proposal |
|------|----------|
| Filter/form help | Move helper text to **label + info icon**; tooltip on hover/focus; controls share one baseline (UX-DR7 + UX-DR38). |
| Date picker | Month + year selectors; swap/fix prev/next for RTL; may adopt patterns from majidh1/jalaliDatePicker (license/dependency review). |
| Form chrome | Align panel background with page `surface` / mockups — avoid abrupt band behind form. |
| Capacity drawer | Plain-language labels for approval lifecycle + used/reserved/free/exempt/override (UX-DR13/34). |
| Headcount create | Primary path: draft **or** «ثبت و فعال‌سازی» when actor has activate permission. |
| Glossary | Employment (همکاری) vs collaboration type (نوع همکاری) vs Primary Assignment (انتصاب اولیه). |

### 4.5 Implementation / copy (concrete)

**Story-shaped OLD → NEW examples:**

#### Stale disclosure (operational-copy)

**OLD:**  
`اگر بیش از ۱۵ دقیقه طول کشید، از «عملیات ← صف محاسبه» وضعیت را ببینید.`

**NEW (role-aware sketch):**  
- HR: wait / retry; if prolonged, contact SysAdmin (or show in-product «وضعیت محاسبه» without ops nav).  
- SysAdmin: link to `/operations#ops-recalc` (health section already exists).

**Rationale:** Current copy is a dead-end for `hr_operator` / `hr_admin` / `manager`.

#### Headcount create

**OLD:** Form only creates draft; copy tells user to activate from list.  

**NEW:** Keep FR-28 (Draft not consumable). Add optional activate-on-submit CTA so UAT need not hunt the table.

#### Filter help

**OLD:** Help paragraph under control → misaligned row.  

**NEW:** Label row + `i` tooltip; no extra vertical help block in compact filter bars.

### 4.6 sprint-status.yaml (on approval)

- Add `epic-11: backlog` (then `in-progress` when first story created).  
- Add story keys for 11.1–11.7 as `backlog`.  
- Resolve Epic 10 action «Decide next roadmap slice» → `done` / `resolved_in` this proposal.

---

## 5. Implementation Handoff

### Scope classification: **Moderate**

| Role | Responsibility |
|------|----------------|
| **PM / PO (John)** | Approve Epic 11 scope & story priority; PRD light edits |
| **Architect (Winston)** | Recalc stuck-job + finalize gate sequencing; ops vs HR signal boundary |
| **UX (Sally)** | Filter help pattern, date picker chrome, form surface, capacity drawer copy, glossary |
| **Developer (Amelia)** | Implement stories in P0→P3 order; selfchecks; no reopen of epic-1…10 status |
| **Tech writer (Paige)** | Glossary + ops/stale copy honesty |

### Success criteria

1. Stakeholder can **finalize at least one Start Collaboration** (or document exact remaining business precondition in UI).  
2. Blocking stale either clears in reasonable time **or** shows a **reachable** next step for the logged-in role.  
3. Jalali: jump to arbitrary month/year without dozens of prev clicks; RTL chrome correct.  
4. Filter rows vertically aligned with info-icon help.  
5. Capacity drawer intelligible; create flow can activate without table scavenger hunt.  
6. Form chrome matches UX 2026-07-31 intent on touched surfaces.  
7. `sprint-status.yaml` + `epics.md` list Epic 11; Epics 1–10 remain `done`.

### Suggested story order

1. **11.1** Recalc/stale unblock + honest next step  
2. **11.2** Finalize + capacity/override path  
3. **11.3** Jalali picker  
4. **11.4–11.7** UX polish cluster (can parallelize after P0)

---

## 6. Checklist Record (Correct Course)

### Section 1 — Trigger & context

- [x] 1.1 Trigger: post–Epic 10 UAT (not a single story ID); clusters map to 1.6 / 4.x / 7.2 / 8.x / 9.4  
- [x] 1.2 Core problem: UAT blocked + UX gaps vs shipped contracts  
- [x] 1.3 Evidence: banner, finalize errors, DOM/form notes, nav matrix proof for ops dead-end  

### Section 2 — Epic impact

- [x] 2.1 Epic 10 complete as planned; issue is **post-plan gap**  
- [x] 2.2 **Add Epic 11** (do not modify closed epic ACs)  
- [x] 2.3 No future epics to revise  
- [x] 2.4 New epic required; none obsolete  
- [x] 2.5 Priority: Epic 11 next  

### Section 3 — Artifacts

- [x] 3.1 PRD: light clarifications; MVP intact  
- [x] 3.2 Architecture: AD-6 / gate honesty notes  
- [x] 3.3 UX: help, picker, form, drawer, activate  
- [x] 3.4 Secondary: sprint-status, operational-copy, possibly selfchecks  

### Section 4 — Path forward

- [x] 4.1 Direct adjust inside closed epics — **Not viable**  
- [x] 4.2 Rollback — **Not viable**  
- [x] 4.3 MVP reduce — **Not primary**  
- [x] 4.4 **Selected: Hybrid = new Epic 11 (Direct Adjustment of backlog)**  

### Section 5 — Proposal components

- [x] 5.1–5.5 Covered in §§1–5 above  

### Section 6 — Approval / status file

- [x] 6.3 Explicit user approval — **approved 2026-08-07 (AtA)**  
- [x] 6.4 Update sprint-status — **epic-11 + stories backlog; roadmap action done**  
- [x] 6.5 Handoff confirm — **Moderate → PO/Dev; start with create-story 11.1**

---

## Appendix A — Why «عملیات / صف محاسبه» was invisible / nonexistent

- Coarse nav: only `system_admin` has `/operations` (`packages/modules/identity-access/src/navigation.ts`).  
- HR roles (`hr_operator`, `hr_admin`, `manager`) never see sidebar item «عملیات».  
- SysAdmin ops page shows **سلامت عملیات** with a section titled **«بازمحاسبه»** (`id="ops-recalc"`) — aggregate pending/failed/stale counts only.  
- Stakeholder (sys.admin): **nothing labeled «صف محاسبه»** appears in nav or page chrome. The disclosure string invents a destination name that does not exist in the product IA.  
- Fix options for Epic 11.1: (a) rename/relabel to match real section «بازمحاسبه» + deep-link `/operations#ops-recalc` for SysAdmin; (b) ship a real queue UI if product wants job-level visibility; (c) role-aware copy that never names a missing screen. Prefer (a)+(c) unless PO asks for (b).
