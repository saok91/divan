---
baseline_commit: 587f534
---

# Story 11.7: Employment / Primary Assignment Empty-State Honesty

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator creating a Start Collaboration event,
I want «همکاری» and «انتصاب اولیه» empty states to read as expected for a new start, not as a broken search,
so that I understand what to fill (FR11, FR20, FR57, UX-DR29, UX-DR32).

**Story key:** `11-7-employment-primary-assignment-empty-state-honesty`  
**Epic:** 11 — UAT Unblock & Operational UX Hardening  
**UX contract:** `ux-divan-2026-07-31` (UX-DR29 entity-picker dependents, UX-DR32 empty self-explain, UX-DR37 glossary) + **sprint-change-proposal-2026-08-07** §1 Evidence #5, §4.2 FR-20 note, §4.4 Glossary.  
**Architecture:** Presentation-only in `apps/web` over **existing** `listSelectableEmployments` / `listSelectablePrimaryAssignments` + EntityPicker. No domain Employment/PA creation invent. No AR-\* invention. FR-20 Start **creates** Employment + Primary — prior pickers may be empty.  
**Authorized by:** `sprint-change-proposal-2026-08-07` (approved AtA)  
**Prerequisite:** Stories **8.3/8.4** EntityPicker + PE form wiring; **8.9** empty taxonomy + GlossaryTerm; **11.4** FieldHelp; **11.5** FormSurfaceHost on PE register — reuse; do not retouch form chrome. **11.2** finalize path done (UAT end-to-end benefit, not this AC surface).  
**Downstream:** None in Epic 11 (last story). Do not reopen Epics 1–10.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| EntityPicker | `apps/web/components/entity-picker/entity-picker.tsx` | Combobox + popover list; live region; cascade props; optional `emptyCreateAction` | Hard-coded `EMPTY_COPY_FA = "نتیجه‌ای یافت نشد."` for **every** empty — failure/search tone; **no** `emptyCopyFa` (or equivalent) override |
| Employment / PA resolvers | `apps/web/components/entity-picker/resolvers.ts` | `createEmploymentSearch` / `createPrimaryAssignmentSearch` → person-scoped tRPC lists; `[]` when no person / catch | Option labels use «اشتغال» (vocab drift vs form «همکاری»); empty indistinguishable from error (pre-existing — do not invent error surfacing unless cheap) |
| PE form | `apps/web/components/personnel/personnel-event-form.tsx` | Start/Return: Employment label «همکاری (اختیاری)»; PA label «انتصاب اولیه» + FieldHelp tip; separate required «نوع همکاری»; cascade from person | Empty popover still shows failure tone; no GlossaryTerm; operators cannot tell optional prior Employment ≠ required collaboration type ≠ Primary |
| Empty taxonomy | `apps/web/lib/empty-state.ts` + `FeedbackMessage kind="empty"` | `noDataYet` \| `filtered` \| `notPermitted`; `operationalCopy.emptySearch` reserved for filtered | EntityPicker does **not** use this taxonomy — still hard-coded filtered-like tone |
| Operational copy | `apps/web/lib/operational-copy.ts` | Comment: never reuse `emptySearch` for no-data-yet | Need Start expected-empty strings (catalog optional; may live as form constants passed into picker) |
| Glossary | `apps/web/lib/ui-glossary.ts` + `GlossaryTerm` | 19–20 keys; ceiling `<= 22` in `operational-copy.selfcheck` after 11.6 | **No** employment / collaborationType / primaryAssignment entries |
| Field help (11.4) | `form-layout/field-help.tsx` | Label-adjacent tip | Keep PA short tip or tighten; domain definitions → GlossaryTerm — **do not conflate** |
| Form surface (11.5) | PE register + `FormSurfaceHost` | Content plane; no nested Panel | Preserve — touch empty copy / labels only |
| Profile empties (peripheral) | `person-profile-view.tsx` | «اشتغال فعالی… ثبت نشده» / «انتصاب اصلی فعالی…» | **Out of AC** unless PO expands — Start pickers are the UAT surface |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **همکاری (Employment record) ≠ نوع همکاری (collaboration type)** | Prior Employment picker selects an existing Employment for the person. «نوع همکاری» is a **required** Start/Return field that **creates** facts on finalize — never the same control. |
| **انتصاب اولیه (Primary Assignment) ≠ prior PA picker as mandatory on Start** | FR-11/FR-20: Start **creates** one Employment + one Primary. Empty prior PA list on a new person is **expected**. Copy must explain what Primary is and that Start will establish it — not demand picking a non-existent prior. |
| **Expected-empty (Start) ≠ emptySearch / «نتیجه‌ای یافت نشد»** | UX State Patterns: **Empty — no data yet** (fact + why + next step). Filtered tone («نتیجه‌ای پیدا/یافت نشد…») is wrong for Start with no history. |
| **Start optional prior ≠ Terminate/Transfer required Employment** | On Terminate/Job/Comp/Transfer, empty Employment may remain a real problem (need open Employment). Do **not** apply Start expected-empty tone there — keep honest required/missing semantics (failure or «سابقه‌ای برای این رویداد لازم است» is OK; do not claim «طبیعی برای شروع»). |
| **GlossaryTerm ≠ FieldHelpIcon ≠ TechnicalDetailDisclosure** | Domain definition → `GlossaryTerm` / `uiGlossary`. Short how-to on a control → FieldHelp. UUID → TechnicalDetailDisclosure (already on person). |
| **emptyCreateAction ≠ Start Employment create** | Do **not** wire create-in-picker for Employment/PA on Start — creation is via the Start event itself (FR-20). |
| **UX-DR29 enumeration-safe empty vs expected-empty honesty** | Enumeration-safe means empty vs out-of-scope must not leak via timing/count for scoped search. That does **not** forbid an honest **expected-empty** message when the product state is «no prior records for Start». Do not invent «0 records because denied» messaging. |
| **Resolver «اشتغال» vs form «همکاری»** | Proposal glossary locks **همکاری**. Prefer aligning option label prefix to «همکاری» when touching resolvers; if deferred, document in Review Findings — do not leave Start labels saying همکاری while options say اشتغال without a note. |
| **Profile «انتصاب اصلی» vs form «انتصاب اولیه»** | Proposal/UAT use **انتصاب اولیه** on PE form. Profile vocabulary may stay deferred. |
| **LG-complete honesty** | Epic 11 UAT polish ≠ claiming LG-complete while Epic 7–10 carry-ins remain open. |

## Acceptance Criteria

1. **Given** a person with no prior Employment / Primary Assignment for a **Start-type** (or Return-type, same prior-optional pickers) event  
   **When** the «همکاری» and «انتصاب اولیه» EntityPickers are shown and return empty results  
   **Then** empty copy uses an **expected-empty** tone (fact + cause + next step), **not** the generic failure/search tone «نتیجه‌ای یافت نشد.»  
   **And** copy (labels, glossary, and/or field help) distinguishes **optional prior Employment (همکاری)** from required **«نوع همکاری»** and explains **Primary Assignment (انتصاب اولیه)** in operator Persian without architecture docs

2. **Given** Start/Return event type with person selected  
   **When** the operator reads the Employment / Primary / collaboration-type controls  
   **Then** GlossaryTerm (or equivalent `uiGlossary` disclosure) is available for همکاری / نوع همکاری / انتصاب اولیه  
   **And** required «نوع همکاری» remains the Start/Return fact field (unchanged domain validation) — empty prior pickers never imply «نوع همکاری» is optional

3. **Given** event types that **require** an existing open Employment (Terminate / Transfer / Job / Compensation)  
   **When** Employment picker is empty  
   **Then** copy does **not** claim «expected for a new start»  
   **And** required semantics remain honest (operator still blocked from finalize without Employment where validation already requires it)

4. **And** EntityPicker default empty for unrelated surfaces may keep search-empty tone **or** accept a shared default that remains appropriate for true search-miss — Start/Return Employment+PA **must** pass expected-empty via prop/override (do not globally force Start copy onto every picker)

5. **And** Epic Gate encodes held:
   - Reuse existing resolvers + tRPC lists — no parallel SoT; no Prisma in web; no invent Employment/PA rows from UI
   - First-touch: `GlossaryTerm` / `uiGlossary`, existing `FieldHelp` / `FormField`, `EntityPicker`, `FeedbackMessage` only if surfacing outside popover
   - AR-\* / FR-11 / FR-20 / FR-57 fail-closed — do not invent concurrent employment policy or free-text UUID entry
   - UTF-8 **without BOM** on `sprint-status.yaml` edits
   - Must **not** reopen Epics 1–10 status churn
   - Must **not** claim LG-complete
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - Extend `entity-picker.selfcheck` (and glossary ceiling/keys in `operational-copy.selfcheck`) for Start expected-empty + glossary keys

6. **And** scope boundaries:
   - Does **not** change FormSurfaceHost / FormFooter token chrome (**11.5** done)
   - Does **not** change FieldHelp primitive chrome (**11.4** done) except consuming it
   - Does **not** own capacity drawer / create-activate (**11.6** done)
   - Does **not** change PE finalize / capacity matching / override gates (**11.2** done)
   - Does **not** rewrite person profile empty sections (optional defer)
   - Does **not** add `emptyCreateAction` for Employment/PA on Start
   - Does **not** add new npm packages or Vitest runners

## Tasks / Subtasks

- [x] Task 1: EntityPicker empty-copy override (AC: #1, #4, #5)
  - [x] UPDATE `entity-picker.tsx`: add optional prop e.g. `emptyCopyFa?: string` (name flexible) used for list empty + live-region empty; default remains current `EMPTY_COPY_FA` for backward compatibility
  - [x] Ensure loading copy unchanged; do not break `emptyCreateAction` when present
  - [x] Preserve: combobox APG, cascade disabledReason, digit-normalize search, aria wiring

- [x] Task 2: PE form Start expected-empty + glossary (AC: #1, #2, #3)
  - [x] UPDATE `personnel-event-form.tsx`:
    - When `isStartReturnType(eventType)` and person selected, pass expected-empty Persian copy into Employment and Primary EntityPickers (fact: no prior record; cause: new start/return creates them; next step: fill «نوع همکاری» + org facts below — do not pick a non-existent prior)
    - When **not** Start/Return, do **not** pass Start expected-empty (default or a required-context message is fine)
    - Wire `GlossaryTerm` near/for labels همکاری، انتصاب اولیه، نوع همکاری (consume new `uiGlossary` keys)
    - Keep «همکاری (اختیاری)» on Start/Return; keep required Employment on Terminate/Transfer/Job/Comp
    - Optionally tighten PA FieldHelp so it does not contradict Start expected-empty (tip may say prior selection syncs Employment when a prior exists; Start creates Primary via event facts)
  - [x] Preserve: leave-guard dirty, cascade clear, PA→Employment sync, TechnicalDetailDisclosure, FormSurfaceHost parent, finalize validation messages from 11.2

- [x] Task 3: Glossary + optional resolver label align (AC: #1, #2)
  - [x] Extend `ui-glossary.ts` with operator definitions (suggested keys — keep `as const satisfies`):
    - `employment` → termFa «همکاری» — historical/open Employment period for a person; on Start, prior selection is optional because the event creates a new Employment
    - `collaborationType` → termFa «نوع همکاری» — required Start/Return fact (distinct from selecting a prior Employment)
    - `primaryAssignment` → termFa «انتصاب اولیه» — active Primary that defines team membership / headcount consumption; Start creates one with the event
  - [x] Raise `operational-copy.selfcheck` `uiGlossary` key-count **ceiling** (currently `<= 22`) enough for +3 keys; assert the three new keys exist (mirror 11.6 pattern)
  - [x] Prefer aligning `createEmploymentSearch` option prefix «اشتغال» → «همکاری» when touching resolvers (same story). Gallery demo labels: align if cheap

- [x] Task 4: Selfchecks + design-qa (AC: #5)
  - [x] Extend `entity-picker.selfcheck.ts` source asserts, e.g.:
    - EntityPicker source accepts empty-copy override prop (not only hard-coded constant for all empties)
    - PE form Start/Return path references expected-empty string (or shared constant) and does **not** rely on bare «نتیجه‌ای یافت نشد» for Employment/PA on that path
    - PE form references GlossaryTerm / new glossary keys (or `uiGlossary` keys) for employment / collaboration / primary
    - Still asserts EntityPicker wiring, cascade, no free-text UUID employment Input
  - [x] Update `operational-copy.selfcheck.ts` ceiling + key asserts for new glossary entries
  - [x] Run `pnpm --filter @divan/web selfcheck:design-qa`
  - [x] Run `pnpm --filter @divan/web selfcheck:entity-picker` (and operational-copy if separate)
  - [x] If mockup matrix mentions PE form empty, keep Result note honest in `design-qa-mockup-matrix.md`
  - [x] Typecheck `@divan/web` for touched files

- [x] Task 5: DoD alignment (AC: #1–#6)
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; YAML UTF-8 without BOM
  - [x] Manual DoD below

### Manual DoD checklist

- [x] Start Collaboration + person with no Employment history → open همکاری picker → empty message is expected-empty (not «نتیجه‌ای یافت نشد.»)
- [x] Same for انتصاب اولیه picker on Start
- [x] Operator can open glossary/definition for همکاری / نوع همکاری / انتصاب اولیه without leaving the form
- [x] «نوع همکاری» still required on Start; prior همکاری remains optional
- [x] Terminate (or Transfer) with person who has no open Employment → empty does **not** say «طبیعی برای شروع»
- [x] Unrelated EntityPicker (e.g. person/team search miss) still intelligible (default search-empty OK)
- [x] No create-in-picker for Employment on Start; no invented domain rows
- [x] Form surface (11.5) and FieldHelp chrome (11.4) behavior unchanged
- [x] Dark theme: tokens only; no new hex
- [x] `selfcheck:design-qa` green; Epics 1–10 remain `done`; no LG-complete claim

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Start/Return Employment+PA empty = expected-empty | Leave hard-coded «نتیجه‌ای یافت نشد.» on Start prior pickers |
| Glossary distinguishes همکاری / نوع همکاری / انتصاب اولیه | Conflate the three; force architecture-doc reading |
| Optional prior on Start; required «نوع همکاری» | Make prior Employment required on Start; invent Employment via picker create |
| Override prop on EntityPicker; default safe for other surfaces | Globally replace all picker empties with Start copy |
| Extend entity-picker + glossary selfchecks; design-qa green | Reopen Epics 1–10 or claim LG-complete |
| Preserve leave-guard / cascade / FormSurfaceHost | Retouch 11.4/11.5 chrome; drop dirty guard |

### Epic 11 / prior carry-ins in force

- Authorized by `sprint-change-proposal-2026-08-07` — do not reopen Epics 1–10
- **11.1–11.6 done:** stale honesty, finalize path, Jalali chrome, compact field help, form surface, capacity drawer/activate
- UAT evidence **#5** (این داستان): «همکاری» / «انتصاب اولیه» unclear; empty «نتیجه‌ای یافت نشد» during Start Collaboration
- Proposal §4.2: On Start, prior Employment / Primary pickers may be empty; copy must say so
- Proposal §4.4 Glossary table is the vocabulary authority for this story
- Epic 10 open items (FeedbackMessage long-tail, typography, batched identity, PE/HC bulk honesty, settings cache, binder parity, AR fail-closed, production-honesty carry-forward) — **encode, do not resolve**

### Suggested expected-empty copy (Persian — refine in implement; keep fact→cause→next-step)

Use short popover-safe lines (EntityPicker empty slot is compact). Examples — not mandatory verbatim:

- **همکاری (Start/Return):** «سابقه‌ای برای انتخاب نیست. برای شروع/بازگشت جدید لازم نیست همکاری قبلی انتخاب شود؛ «نوع همکاری» و واقعیت‌های حداقل را پایین پر کنید.»
- **انتصاب اولیه (Start/Return):** «انتصاب اولیه‌ای برای انتخاب نیست. با نهایی‌سازی شروع/بازگشت، انتصاب اولیه همراه همکاری جدید ثبت می‌شود.»

Avoid: «نتیجه‌ای یافت نشد.» / bare «خطا» / instructing UUID paste / inventing «صف» destinations.

### UPDATE files — current → change → preserve

#### `apps/web/components/entity-picker/entity-picker.tsx` (primary — override)

- **Current:** `const EMPTY_COPY_FA = "نتیجه‌ای یافت نشد."` used in live region + empty list row; no override prop.
- **Change:** Optional `emptyCopyFa` (or equivalent) falling back to `EMPTY_COPY_FA`.
- **Preserve:** Loading copy, debounce, APG combobox, `emptyCreateAction`, disabledReason, scopeNote.

#### `apps/web/components/personnel/personnel-event-form.tsx` (primary — Start honesty)

- **Current:** Employment «همکاری (اختیاری)» on Start/Return; PA FieldHelp sync tip; empty uses global failure tone; no GlossaryTerm; «نوع همکاری» required in minimum Start section.
- **Change:** Pass Start/Return expected-empty into Employment+PA pickers; add GlossaryTerm for the three terms; keep validation rules.
- **Preserve:** Cascade, PA→Employment hydrate, leave-guard, recalc chrome, finalize/override honesty from 11.2, FormLayout sections, no nested Panel.

#### `apps/web/lib/ui-glossary.ts` (+ `GlossaryTerm` consumers)

- **Current:** No employment / collaborationType / primaryAssignment; ~19–20 keys; selfcheck ceiling 22.
- **Change:** Add three operator definitions; raise ceiling; assert keys.
- **Preserve:** Existing headcount/governance entries; never mix with TechnicalDetailDisclosure.

#### `apps/web/components/entity-picker/resolvers.ts` (optional align)

- **Current:** Employment option label prefix «اشتغال».
- **Change:** Prefer «همکاری» to match form/proposal glossary.
- **Preserve:** Query shape, date range secondary, personId gate, empty `[]` on error (enumeration-safe).

#### Selfchecks

- `apps/web/lib/entity-picker.selfcheck.ts` — Start empty honesty + glossary consumption
- `apps/web/lib/operational-copy.selfcheck.ts` — ceiling + new keys
- Optional: `design-qa-mockup-matrix.md` honesty note for PE form

### Must not touch (unless unblock — prefer not)

- `apps/web/src/server/person.ts` listSelectable\* (domain/authz already correct)
- `packages/modules/person-employment` event create/finalize algorithms
- Headcount drawer / create activate (**11.6**)
- Jalali / FieldHelp / FormSurfaceHost primitives
- Vitest / new npm deps

### Previous story intelligence (11.6)

- Presentation-first; GlossaryTerm for domain terms; FieldHelp for short tips; selfcheck source asserts > brittle DOM snapshots
- Raising `uiGlossary` ceiling without asserting **new keys** failed review — assert keys explicitly
- Sibling stories reserved **11.7** as sole owner of Employment/Primary empty-state — do not bleed back into drawer/form chrome
- Review culture: patch honesty gaps; defer documented vocab drift with rationale
- UTF-8 without BOM on sprint-status

### Git intelligence

- Recent: `587f534` 11.6 · `cc92bcb` 11.5 · `75dbe10` 11.4 · `8785f3e` 11.3 · `bcfda5d` 11.2
- PE form last major chrome touch: 11.5 (`cc92bcb`); EntityPicker empty constant predates Epic 11 — this story is the intentional fix
- Pattern: source selfchecks under `apps/web/lib/*.selfcheck.ts` + `selfcheck:design-qa` orchestrator

### Latest tech / library notes

- Stack stays: Next.js `16.2.x`, React `19.1`, tRPC `11.x` — **no upgrades** for this story
- EntityPicker remains custom combobox (APG) — do not replace with a new component library
- Prefer existing `GlossaryTerm` (`details`/`summary`) over inventing a tooltip glossary

### Project structure notes

- All work under `apps/web` presentation layer
- `@divan/person-employment` remains SoT for Employment/PA mutations — UI only selects existing rows or leaves empty for Start create path
- No `project-context.md` in repo — spines + this story file are authoritative

### Testing requirements

1. `pnpm --filter @divan/web selfcheck:design-qa` (mandatory)
2. Extended `selfcheck:entity-picker` + glossary asserts in `operational-copy.selfcheck`
3. Manual DoD (Persian UAT Start path)
4. No new Vitest / Playwright / axe packages
5. `tsc --noEmit` on `@divan/web` for touched files

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 11 / Story 11.7]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md` — §1 Evidence #5, §4.1–§4.4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-6, FR-11, FR-20, FR-57–59]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — State Patterns / entity-picker]
- [Source: `_bmad-output/implementation-artifacts/11-6-capacity-drawer-intelligibility-create-activate.md` — glossary/selfcheck patterns; downstream 11.7]
- [Source: `apps/web/components/entity-picker/entity-picker.tsx` — `EMPTY_COPY_FA`]
- [Source: `apps/web/components/personnel/personnel-event-form.tsx` — Employment/PA/نوع همکاری]
- [Source: `apps/web/lib/empty-state.ts` — noDataYet vs filtered]
- [Source: `apps/web/lib/ui-glossary.ts` + `operational-copy.selfcheck.ts` — ceiling]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- `pnpm --filter @divan/web selfcheck:entity-picker` → ok
- `pnpm --filter @divan/web selfcheck:operational-copy` (via design-qa) → ok
- `pnpm --filter @divan/web selfcheck:design-qa` → ok
- `pnpm --filter @divan/web exec tsc --noEmit` → ok

### Completion Notes List

- Added optional `emptyCopyFa` on EntityPicker; default remains «نتیجه‌ای یافت نشد.» for unrelated search-miss surfaces.
- Start/Return + person: Employment/PA pickers receive expected-empty Persian copy (fact → cause → next step); other event types keep default empty tone.
- Wired GlossaryTerm for `employment` / `collaborationType` / `primaryAssignment`; raised uiGlossary ceiling to 25 with explicit key asserts.
- Aligned employment option label prefix «اشتغال» → «همکاری» in resolvers + hydrate helper + gallery demo.
- Tightened PA FieldHelp so Start expected-empty and prior-sync tip do not contradict.
- No emptyCreateAction for Employment/PA; no domain invent; FormSurfaceHost / FieldHelp chrome untouched.

### File List

- `apps/web/components/entity-picker/entity-picker.tsx`
- `apps/web/components/entity-picker/resolvers.ts`
- `apps/web/components/personnel/personnel-event-form.tsx`
- `apps/web/components/personnel/personnel-event-entity-helpers.ts`
- `apps/web/app/(app)/dev/gallery/entity-picker-demos.tsx`
- `apps/web/lib/ui-glossary.ts`
- `apps/web/lib/entity-picker.selfcheck.ts`
- `apps/web/lib/operational-copy.selfcheck.ts`
- `apps/web/lib/design-qa-mockup-matrix.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/11-7-employment-primary-assignment-empty-state-honesty.md`

### Change Log

- 2026-08-07: Implemented Story 11.7 — Start/Return Employment+PA expected-empty honesty, glossary keys, resolver label align; status → review.
- 2026-08-07: Code review patches — EntityPicker emptyCopyFa scoped to empty-query; PA FieldHelp gated; glossary type-neutral + vocab align; status → done.

### Implementation Plan

1. EntityPicker `emptyCopyFa` override with default fallback.
2. PE form gated Start/Return empty copy + GlossaryTerm + PA FieldHelp tighten.
3. uiGlossary +3 keys; selfcheck ceiling/asserts; resolver/hydrate/gallery «همکاری» align.
4. design-qa + entity-picker selfchecks + tsc.

### Review Findings

- [x] [Review][Decision] Glossary Start-biased on non-Start/Return — resolved: rewrite defs type-neutral (option 1); chips stay visible on all types with honest cross-type wording.
- [x] [Review][Patch] emptyCopyFa masks filtered-empty and catch as expected-empty [`apps/web/components/entity-picker/entity-picker.tsx`] — fixed: override only for empty-query success; catch + filtered miss use `EMPTY_COPY_FA`; empty row shows `liveMessage`.
- [x] [Review][Patch] PA FieldHelp always mentions Start/Return creation [`apps/web/components/personnel/personnel-event-form.tsx`] — fixed: help gated by `isStartReturnType`.
- [x] [Review][Patch] Glossary vocab drift + Start-only framing [`apps/web/lib/ui-glossary.ts`] — fixed: type-neutral defs; «همکاری» / «انتصاب اولیه» aligned.
- [x] [Review][Defer] Resolver catch returns `[]` so API failure looks like empty domain [`apps/web/components/entity-picker/resolvers.ts:320-358`] — deferred, pre-existing
- [x] [Review][Defer] Person profile still uses «اشتغال» / «انتصاب اصلی» vocabulary — deferred, pre-existing
- [x] [Review][Defer] Gallery demos rename labels but do not exercise `emptyCopyFa` Start expected-empty — deferred, pre-existing
