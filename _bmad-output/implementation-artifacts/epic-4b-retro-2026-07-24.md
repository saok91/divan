# Epic 4b Retrospective — Shell & IA Alignment (UX 2026-07-19)

**Date:** 2026-07-24  
**Project:** divan  
**Facilitator:** Amelia (Developer)  
**Project Lead:** AtA (async / non-participating facilitation requested)  
**Status:** completed  
**Scope:** Full epic (7/7 stories done). Fifth retrospective for the project.

## Participants

- Amelia (Senior Software Engineer) — facilitation
- John (Product Manager)
- Winston (System Architect)
- Sally (UX Designer)
- Mary (Business Analyst)
- Paige (Technical Writer)

*Note: AtA requested the retrospective be completed without interactive participation. Decisions below are team consensus from story records, deferred-work, Epic 4 retro follow-through, and Epic 5 preview.*

## Epic summary

| Metric | Value |
| --- | --- |
| Stories completed | 7 / 7 (100%) |
| Story keys | 4b-1 … 4b-7 |
| FR / UX scope | FR43 shell/IA; FR4 / FR9 / FR10 **UI reshape only**; contract `ux-divan-2026-07-19` |
| Authorization | `sprint-change-proposal-2026-07-19` (insert before Epic 5) |
| Previous retro | Epic 4 (`epic-4-retro-2026-07-19.md`) |
| Next epic | Epic 5 — Search, Profiles, Dashboard & Reports |
| Sprint epic key | Was `in-progress` at retro start; set to `done` with this retro |

### Delivery narrative

DESIGN delta + collapsible shell (4b.1) → Section tabs + leave-guard substrate across four nav channels (4b.2) → Sidebar IA / labels / role landings (4b.3) → Locked `GovernedDataTable` primitive (4b.4) → Access person-first retrofit as first table consumer (4b.5) → Organization section tabs + `tree-navigator` + thin `organization.reparent` wrapper (4b.6) → Personnel & Events shells, event-form relocation, prefill + quick-edit (4b.7). Adversarial review + Patch/Decision/Defer triage continued on every story. Domain packages stayed untouched except one deliberately scoped reparent wrapper — “UI reshape only” held.

## What went well

- **UX spine inserted cleanly:** Sprint-change put shell/IA before Search/Profiles; Epic 5 no longer starts on Epic 1 chrome + stacked admin pages.
- **Durable primitives landed and held:** `GovernedDataTable` (4b.4) survived three real consumers (4b.5–4b.7) with “prefer zero primitive edits.” `tree-navigator` (4b.6) delivered WAI-ARIA tree semantics with lazy grade children.
- **Leave-guard substrate unified navigation:** Sidebar, section tabs, command palette, and history share one Persian Stay · Discard · Save dialog and `useLeaveGuardRegistration` — reused through 4b.7 instead of reinvented.
- **IA rename shipped with zero review patches (4b.3):** Locked decisions + catalog/selfcheck updates validated “decide before code” for config-heavy stories; closed dual surface-label debt from 4b.2.
- **Monolith panel decomposition:** Access, Organization, and Personnel stacked pages became tab-scoped panels without inventing FR33 / profile / timeline depth early.
- **Domain boundary discipline:** Zero domain rule invent; only thin `organization.reparent` server surface; Epic 4 IDOR/PopulationPort gaps preserved honestly for 5.1 rather than silently “fixed” in shell work.
- **Carry-forward hygiene:** Gate / Absolute non-goals / Previous story intelligence / BOM-safe reminders traveled story-to-story; deferred-work stayed explicit per review.

## Challenges

- **Dialog ↔ leave-guard interaction class:** Recurred in 4b.5 (assign dialog + leave-guard stacking; dirty not cleared after successful mutation) and 4b.7 (dirty gated on dialog-open flags → Save/Discard no-ops; `key` remount on `?person=` bypassed dirty prefill guard). Root pattern: coupling “is dirty” to UI visibility instead of data state.
- **Primitive birth tax:** 4b.4 took 19 review patches (filter/sort/snapshot/paginate edge cases, a11y, sticky stacking). 4b.6 tree + reparent ordering added another high patch load. Net-new interactive state machines, not epic size, predicted friction.
- **Selfcheck ceiling at pure helpers:** Governed-table, access-people, and tree-navigator selfchecks assert helpers only — DOM/keyboard/dialog/leave-guard paths remain unasserted pending Vitest/CI (carry from Epic 3/4).
- **UTF-8 BOM on sprint-status (Windows):** First hit in 4b.1; every later story re-warned “BOM-safe edit.” DoD exists; tooling still does not enforce.
- **Logout / authz `router.replace` still bypasses leave-guard:** Deferred in 4b.2; never closed inside 4b — session-exit channels remain ungarded.
- **Duplicated person-create forms (4b.7):** `PersonnelAddPanel` vs `PersonnelQuickCreateDialog` split inherited validation/field/error drift risk into Epic 5 create/quick paths.
- **RTL correctness is not free:** Icon direction (4b.1), logical vs physical CSS (4b.4), and deliberate non-mirroring of tree arrow keys (4b.6 APG) needed explicit review attention every time.

## Key insights

1. **Shell epic ROI is primitives + IA, not feature depth** — Epic 5 depends on table/tabs/landings/leave-guard; Access/Org/Personnel retrofits proved the contract under real mutation UIs.
2. **Dirty state must be data-state, never dialog-kind / open flags** — visibility-coupled dirty is the epic’s signature defect class; Encode into every Epic 5 form story Dev Notes.
3. **“Lock the contract early” worked for GovernedDataTable** — rocky birth (19 patches) paid off when consumers shipped without primitive churn.
4. **Patch volume tracks new state machines** — 4b.3 (config/IA) = 0 patches; 4b.4 (new table) = 19; leave-guard and tree stories clustered high. Plan review budget accordingly for Epic 5 search/filter surfaces.
5. **Presentation-only epics still surface product decisions** — Inactive scopes/units, orphan role IDs, leaf Add disable — Decision buckets in 4b.5/4b.6 were product calls, not pure bugfixes.
6. **Epic 5 risk remains Epic 4 domain debt + 4b leave-guard habits** — IDOR / PopulationPort / AD-6 / Vitest are not solved by shell work; shell work *does* unblock honest UX composition once those notes land in 5.1–5.3.

## Previous retrospective follow-through (Epic 4)

| # | Action | Status at Epic 4b retro |
| --- | --- | --- |
| 1 | Mark `epic-4: done` | ✅ Completed |
| 2 | Encode person-org IDOR + PopulationPort honesty into Story 5.1 Dev Notes | ⏳ Open — 5.1 not created yet; **4b.7 explicitly preserved the gap** for 5.1 (positive discipline) |
| 3 | Encode profile/timeline consumer contract into 5.2 / 5.3 Dev Notes | ⏳ Open — awaiting create-story |
| 4 | Plan AD-6 Prisma vs PoolClient single-connection hardening | ❌ Not addressed in 4b (correctly out of UI scope) |
| 5 | Prefer Vitest/ephemeral DB isolation | ❌ Not addressed — selfchecks still pure-helper; same ceiling as predicted |
| 6 | Move headcount ensure\*Schema off request path | ❌ Not addressed (out of 4b scope) |
| 7 | Keep AR matrices fail-closed; do not invent in Epic 5 | ⏳ Ongoing — 4b did not invent; keep through Epic 5 |
| 8 | Carry forward Epic 2/3 open items | ⏳ Still open |

**Lessons applied:** Domain boundary / no temporary SoT invent; deferred-work honesty; Gate/non-goals; BOM reminders in Dev Notes; preserve cross-epic architectural debt for the right story.

**Missed opportunity:** Vitest isolation deferred again while UI selfchecks proliferated (still helper-only). Leave-guard logout bypass deferred in 4b.2 and never scheduled inside the epic. BOM DoD still habit-only.

## Next epic preview — Epic 5

**Title:** Search, Profiles, Dashboard & Reports  

**Stories:** 5.1–5.5 (permission-safe search/lists → profile sections → event timeline → launch dashboard → launch report catalogue)

**Critical dependency:** Epic 4b primitives (`governed-data-table`, section tabs, updated IA/landings, leave-guard) plus Epic 4 assemblers / lifecycle APIs. Epic 5 must **consume** both — not reinvent chrome or projections.

### Dependencies on Epic 4b

- `GovernedDataTable` contract for permission-safe lists (5.1) without primitive rewrite
- Section tabs + surface routing for Personnel / Events / Reports shells
- IA landings (اطلاعات پرسنلی first for Operator; رویدادهای پرسنلی top-level)
- Leave-guard on dirty search filters / profile edits / report preview loads
- Quick-edit «باز کردن پروفایل کامل» deep-link seam into 5.2
- Event form already hosted on ثبت رویداد (5.3 timeline deep-links into existing Draft/lifecycle)

### Preparation plan

**Critical (before treating Epic 5 search/profile as unblocked):**
- Mark `epic-4b: done` and close this retrospective in sprint-status.
- Create Story 5.1 with Epic 4 action items encoded: person-org **IDOR scope**; PopulationPort cutover honesty; consume Epic 4 assemblers for current-fact columns; bind list UI to `GovernedDataTable` without contract churn.
- Encode into 5.1+ form/filter stories: leave-guard dirty = **field/data state**, not dialog open flags; Discard restores last-saved snapshot; Save resolves leave-guard Promise; single dialog depth (no dialog-on-dialog).
- Encode into 5.2 / 5.3: profile/timeline consume `getCurrentPersonState` + event-store list APIs; Scheduled vs Effective distinguishable; no parallel projection tables.

**Parallel (early Epic 5):**
- Deduplicate person-create form (`PersonnelAddPanel` / `PersonnelQuickCreateDialog`) when touching create paths.
- Wire logout / authz-changed navigation through `requestNavigation` (or document explicit exemption with product sign-off).
- AD-6 single-connection projector hardening; migrations-only ensure\*Schema (Epic 4 carry).
- Keep AR-TEMPORAL / AR-HEADCOUNT / AR-ACCESS / AR-DATA / AR-REPORTING fail-closed.
- BOM-safe sprint-status enforcement (tooling or checklist).

**Nice-to-have:**
- Vitest + ephemeral isolation when a quality story lands (close Epic 3/4 intent).
- Expand selfchecks beyond pure helpers for table/tree/leave-guard once test harness exists.
- Orphan role/scope assign-draft product policy (4b.5 deferred).
- `operationalCopy` for org validation strings; a11y polish on personnel add/quick-create fields.
- Collapsed-sidebar focus-ring polish; `PageAccessDeniedError` `error.tsx` boundary.

## Significant discoveries (plan impact)

| Discovery | Impact on Epic 5 |
| --- | --- |
| Dirty-state / leave-guard / dialog stacking is a recurring class | 5.1–5.3 forms and filter dirty paths must follow data-state + single-dialog rules or will re-regress |
| `GovernedDataTable` contract held across consumers | 5.1 should swap fixture → permission-safe queries **without** primitive rewrite |
| Section tabs + IA landings complete | Epic 5 stories implement against اطلاعات پرسنلی / رویدادهای پرسنلی labels — not Epic 1 «پرسنل» |
| Domain IDOR / PopulationPort / AD-6 unchanged by 4b | Still required prep from Epic 4 retro — shell completion ≠ permission-safe search |
| API gap: no org-wide personnel-event list yet | 4b.7 fixture rows intentional; 5.3 must not invent FR33 list semantics early without story scope |

**Epic update required:** Partial — strengthen Story 5.1 create-story / Dev Notes with leave-guard data-state rules + Epic 4 IDOR/PopulationPort/assembler notes. **Full Epic 5 rewrite not required** (FR33–36 spine + 4b prerequisite match plan).

## Readiness assessment

| Dimension | Status |
| --- | --- |
| Testing & Quality | Per-story selfchecks / typecheck / lint green in records; integration-level UI paths largely manual — acceptable to start 5.1 with honest helper-only coverage + Epic 4 pollution awareness |
| Deployment | Dev/local delivery; production release not claimed by this epic |
| Stakeholder acceptance | UX 2026-07-19 shell/IA + admin retrofits delivered per story AC; formal stakeholder sign-off not recorded in artifacts |
| Technical health | Shell/IA coherent; Medium debt = leave-guard logout bypass, duplicated person-create, helper-only selfchecks; Epic 4 High domain debt (AD-6, IDOR) unchanged |
| Unresolved blockers | None blocking 5.1 scaffolding; IDOR + PopulationPort + leave-guard data-state notes **must** land before claiming permission-safe search / dirty-safe profiles done |

**Verdict:** Epic 4b is complete as the shell/IA alignment spine. Clear to begin Epic 5 **after** critical prep notes land in 5.1 (and 5.2/5.3 when created) — not after a full rewrite.

## Action items

| # | Action | Owner | Category | Success criteria |
| --- | --- | --- | --- | --- |
| 1 | Mark `epic-4b: done` in sprint-status (stories + retro complete) | Amelia | Process | `epic-4b` and `epic-4b-retrospective` are `done` |
| 2 | Encode leave-guard data-state rules (dirty ≠ dialog visibility; Discard snapshot; Save resolves Promise; single dialog depth) into Story 5.1+ form/filter Dev Notes | Amelia + Sally | Process / Docs | 5.1 Gate / Dev Notes forbid open-flag dirty and dialog-on-dialog |
| 3 | Encode Epic 4 carry-ins into Story 5.1 create-story: person-org IDOR scope + PopulationPort honesty + consume assemblers / `GovernedDataTable` without contract churn | Amelia + Winston | Process / Docs | 5.1 Gate forbids permission-only unscoped search; fixtures not claimed as production population authz |
| 4 | Encode profile/timeline consumer contract (Epic 4 assemblers + lifecycle APIs; no parallel SoT) into Story 5.2 / 5.3 Dev Notes | Amelia + Sally | Process / Docs | 5.2/5.3 bind to `getCurrentPersonState` / event list; Scheduled vs Effective explicit |
| 5 | Deduplicate person-create form shared by Add panel and QuickCreate when next touching those paths | Amelia | Technical | Single shared form module; no divergent validation/error codes |
| 6 | Wire logout / authz-changed navigation through leave-guard `requestNavigation`, or document explicit product exemption | Amelia + Sally | Technical | Session-exit either guards dirty work or is an explicit, reviewed exemption |
| 7 | Prefer Vitest/ephemeral isolation + deeper UI selfchecks when next quality opportunity lands (close Epic 3/4 intent) | Amelia | Technical | Tracked; helper-only selfcheck ceiling not accepted as permanent |
| 8 | Keep AR-TEMPORAL / AR-HEADCOUNT / AR-ACCESS / AR-DATA / AR-REPORTING fail-closed; do not invent in Epic 5 | Mary + John | Process | Epic 5 Gates reaffirm open ARs |
| 9 | Carry forward still-open Epic 2/3/4 items: InferenceBulkPort ops; sticky break-glass; artifact reauth 6.5/7.x; PopulationPort **actual** cutover; AD-6 hardening; ensure\*Schema migrations-only | Winston / Amelia+Sally / Paige+Winston | Carry | Remain `open` until addressed in named stories |

## Team agreements

- Epic 4b chrome (tabs, table, tree, leave-guard, IA) is the **forward UX contract**; Epic 1 shell AC remain historical for delivery dates only.
- Epic 5 list/search UIs bind to `GovernedDataTable` without rewriting the locked public contract unless a dedicated primitive story exists.
- Leave-guard dirty tracking is **data-state**; dialog open flags never gate Save/Discard correctness.
- Presentation epics do not silently close domain debt (IDOR, PopulationPort, AD-6); they keep it visible for the owning story.
- Sprint-status edits must be UTF-8 without BOM; story Status and sprint-status flip together on done.
- Product Decisions during UI retrofit (inactive entities, orphan IDs, disabled Add) need explicit Decision triage — not silent defaults.

## Commitments and next steps

1. Execute critical prep into Story 5.1 create-story / Dev Notes (leave-guard rules + Epic 4 IDOR/PopulationPort/assembler notes).
2. Review open action items in next planning/standup.
3. Begin Epic 5 with `create-story` for 5.1 when critical Dev Notes are in place.
4. Do **not** treat leave-guard logout bypass, duplicated person-create, Vitest isolation, IDOR, or PopulationPort cutover as “done” merely because Epic 4b stories are done.

---

## Facilitation record (non-interactive)

Amelia (Developer): "Epic 4b delivered the UX 2026-07-19 shell — collapsible sidebar, section tabs, leave-guards, governed table and tree, and Access/Org/Personnel retrofits. Seven stories, review-hardened."

John (Product Manager): "This was the sprint-change bet: ship IA before Search. Operators land on اطلاعات پرسنلی; Events are top-level. Epic 5 can finally build on the right chrome."

Winston (System Architect): "Domain stayed closed — one thin reparent wrapper only. The unpaid bills from Epic 4 (IDOR, PopulationPort, AD-6) are still unpaid, and that's correct. Don't let a green shell epic pretend they closed."

Sally (UX Designer): "GovernedDataTable holding its contract across three consumers is the win I wanted. The leave-guard/dialog regressions are the pattern we must kill in Epic 5 Dev Notes — dirty equals data, not open flags."

Mary (Business Analyst): "We didn't invent FR33 list semantics or orphan-role policy early. Fixture event rows and deferred product Decisions stay honest. Keep AR fail-closed into reporting."

Paige (Technical Writer): "Persian Stay·Discard·Save and surface labels consolidated after 4b.3. Encode leave-guard data-state and IDOR notes into 5.1 so review doesn't rediscover them."

Amelia (Developer): "Epic 4 follow-through: epic marked done; Vitest and AD-6 still open; 4b.7 preserved IDOR for 5.1. Partial Epic 5 plan update only — strengthen 5.1 leave-guard + IDOR/PopulationPort notes. Meeting adjourned."
