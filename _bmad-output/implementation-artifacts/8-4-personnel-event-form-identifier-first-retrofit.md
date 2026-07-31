---
baseline_commit: 07f2b28
---

# Story 8.4: Personnel Event Form — Identifier-First Retrofit

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an HR operator registering an event,
I want to choose the person, teams, and job concepts by code and name,
so that I can register an event without looking up a UUID (UX-DR29, FR57).

**Story key:** `8-4-personnel-event-form-identifier-first-retrofit`  
**Epic:** 8 — Experience Foundation & Identifier Ergonomics (FR57, FR58; FR33, FR48)  
**UX contract (forward):** `ux-divan-2026-07-31` (DESIGN.md + EXPERIENCE.md) — visual acceptance: `mockups/direction-a-dense-console.html` (event form + picker + «شناسهٔ فنی»)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (PO-approved)  
**Prerequisite:** Story 8.3 done (`8-3-entity-picker-primitive-code-resolvers`) — EntityPicker, EntityToken, cascade, resolvers, gallery. Story 8.2 FormLayout / FormFooter already on the form. Do **not** reopen layout or button contracts.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| `EntityPicker` + `EntityToken` + cascade | `apps/web/components/entity-picker/*` | Combobox, token clear, `useEntityPickerCascade`, all variant resolvers | **Wire into form** — do not fork a second picker |
| Resolvers | `entity-picker/resolvers.ts` | `createPersonSearch`, org/job/ladder/grade/seniority, employment, PA, headcountApproval | Consume as-is; grade needs `ladderId` parent |
| FormLayout chrome | `components/form-layout/*` | FormField / FormSection / FormFooter already used | Keep; only swap Input → EntityPicker inside fields |
| Form footer contract | Story 8.1 | Cancel=`ghost` · Save draft=`secondary` · Finalize=`primary` | Do not change order/variants |
| Leave-guard prefill | `personnel-event-form.tsx` + `personnel-event-form-host.tsx` | `?person=` inbound; dirty → leave-guard before swap (UX-DR11) | Hydrate inbound UUID → EntityPickerValue via person search / getByPersonnelCode path; never silent swap |
| Capacity panel | `headcount-capacity-panel.tsx` | Numeric used/reserved/free | Numbers stay; surrounding team/title/approval UI must show code+name |
| Mutation / draft-finalize | `personnel-event.ts` + Epic 4 module | Same payload shape (UUID ids) | **Unchanged** — pickers resolve to `.id` |
| Selfcheck boundary | `lib/entity-picker.selfcheck.ts` L135–146 | Asserts form has **no** EntityPicker yet | **Invert** for 8.4 DoD |

### Critical naming distinction (do not conflate)

| Concept | Owner |
| --- | --- |
| **This story** — replace UUID inputs on `personnel-event-form` only; ladder→grade cascade; employment/PA pickers; technical disclosure; capacity/approval human labels | **8.4** |
| EntityPicker primitive / resolvers / gallery | **8.3** (done) — consume only |
| Remaining UUID surfaces (dashboard filters, headcount panels, audit, recon, …) + UUID-without-picker selfcheck | **8.5** |
| Table readability / row actions / feedback / copy / QA gate | **8.6–8.10** |
| Layout / FormLayout / PageHeader | **8.2** (done) |
| Button / control contract | **8.1** (done) |

## Acceptance Criteria

1. **Given** `personnel-event-form` with its current UUID text inputs  
   **When** the retrofit is complete  
   **Then** all fifteen identifier inputs are replaced by the matching `entity-picker` variants and no free-text UUID input remains on the form for selectable entities

2. **And** ladder→grade cascades: grade is disabled until a ladder is chosen and cleared when the ladder changes, with Persian disabled/clear reason via `useEntityPickerCascade`

3. **And** employment and primary assignment are chosen from the selected person's own permission-safe records, shown with their dates (never free-text UUID); both stay disabled with reason until a person is selected

4. **And** the capacity panel context and approval selection display human labels and codes rather than truncated UUIDs (`approvalId.slice(0,8)…` and source-summary `text-identifier` UUID dumps go away)

5. **And** the form keeps the Story 8.2 layout pattern and footer action order (`Cancel · Save draft · Finalize` via existing `FormFooter`)

6. **And** the technical identifier of selected records is available in a collapsed «شناسهٔ فنی» disclosure with a copy control (`technical-detail-disclosure` per DESIGN.md) — never expanded by default; value uses `{identifier}` typography (LTR monospace)

7. **And** mutation payloads, draft/finalize semantics, and all Epic 4 validation and capacity rules are unchanged — proven by existing Epic 4 / personnel-event module selfchecks and web typecheck passing **unmodified** (except form/UI/selfcheck files this story owns)

8. **And** inbound prefill (`?person=` via `PersonnelEventFormHost`) while the form is dirty still runs the leave-guard before any person swap (UX-DR11); when clean, hydrate the person picker token from the inbound id

9. **And** scope stays **presentation only** on this form:
   - No domain/permission/governance/event-store/temporal/headcount **semantic** changes
   - Do **not** retrofit other product surfaces (**8.5**)
   - AR-\* remain fail-closed; do not invent freeze numbers
   - `selfcheck:layout-system`, `selfcheck:control-contract` remain green; invert `selfcheck:entity-picker` form boundary

10. **And** this story does **not** own: remaining UUID retrofit (**8.5**); table min-width (**8.6**); row-action dead-click (**8.7**); skeleton/toast (**8.8**); copy/glossary overhaul (**8.9**); design QA gate (**8.10**); Epic 9–10 surfaces; person-create dedupe; PopulationPort cutover

## Tasks / Subtasks

- [x] Task 1: Field inventory → EntityPicker map (AC: #1, #2, #3)
  - [x] Inventory every UUID `Input` / identifier `<select>` in `personnel-event-form.tsx` across event-type sections (Start/Return, Termination, Transfer, JobLevel, Compensation). Epic “fifteen” counts **appearances** across sections that share state — unique state keys today:
    | State | Label(s) today | Variant / resolver |
    | --- | --- | --- |
    | `personId` | شناسه فرد | `createPersonSearch()` |
    | `employmentId` | شناسه همکاری | `createEmploymentSearch(personId)` + cascade from person |
    | `teamId` | شناسه تیم / تیم مقصد | `createOrgUnitSearch()` |
    | `organizationalRoleId` | نقش سازمانی | `createOrganizationalRoleSearch()` |
    | `jobTitleId` | عنوان شغلی | `createJobTitleSearch()` |
    | `ladderId` | لدر | `createLadderSearch()` |
    | `gradeId` | گرید | `createGradeSearch(ladderId)` + cascade from ladder |
    | `seniorityId` | ارشدیت | `createSenioritySearch()` |
    | `preferredApprovalId` | approval `<select>` | `createHeadcountApprovalSearch()` **or** keep select but options show code+name (never `slice(0,8)`) |
  - [x] Prefer keeping string `*Id` state for mutation builders **or** hold `EntityPickerValue | null` and read `.id` into existing payload helpers — either way, **payload keys/types unchanged**
  - [x] Replace every free-text UUID `Input` for the rows above with `EntityPicker` inside existing `FormField`s; update Persian labels to business language (e.g. «فرد»، «همکاری»، «تیم مقصد») — keep required marking
  - [x] Wire `useEntityPickerCascade` for **ladder→grade** and **person→employment** (and person→primary-assignment). Mirror gallery demos in `entity-picker-demos.tsx`
  - [x] Primary assignment: add dependent `EntityPicker` with `createPrimaryAssignmentSearch(personId)`. Epic 4 payloads have **no** `primaryAssignmentId` key — selection must map to existing capacity/source behavior (typically via the employment already implied by the PA row, or drive the same `employmentId` / `sourcePrimarySummary` path). **Do not invent new mutation fields.** If a PA is selected, ensure `employmentId` stays consistent with that PA’s employment
  - [x] Helper copy that says «شناسه همکاری را بالا وارد کنید» → business language («همکاری را بالا انتخاب کنید»)

- [x] Task 2: Human labels for capacity context + approval (AC: #4)
  - [x] Transfer / JobLevel **source summary** blocks: replace `teamId` / `jobTitleId` / `ladderId.slice` / `gradeId.slice` UUID dumps with code — name (hydrate via existing summary DTO if it already returns labels, or resolve once from selected tokens / cheap list lookups). Prefer extending `sourcePrimarySummary` response with display fields **only if** labels are not already available without widening authz
  - [x] `preferredApprovalId` UI: show approval business code/label from `listCompatibleApprovals` / picker options — ban truncated UUID as primary identity
  - [x] `HeadcountCapacityPanel` itself is numeric-only — do not break UX-DR13 numbers; ensure any adjacent destination identity is code+name

- [x] Task 3: `technical-detail-disclosure` (AC: #6)
  - [x] NEW thin presentational component (suggested: `apps/web/components/entity-picker/technical-detail-disclosure.tsx` or `components/ui/`) matching DESIGN `technical-detail-disclosure`: collapsed summary «شناسهٔ فنی» (+ optional support caption); expanded LTR monospace value + copy button; default closed
  - [x] Place on the form for selected entity technical ids operators may need for support (at minimum person; optionally employment / destination entities). Mock reference: `direction-a-dense-console.html` ~684–686
  - [x] Copy control: accessible name «کپی شناسهٔ فنی»; do not use gold primary for copy
  - [x] Export from entity-picker barrel if colocated

- [x] Task 4: Prefill + leave-guard + dirty snapshot (AC: #8, #7)
  - [x] Preserve existing dirty-check / leave-guard / Stay URL restore behavior in `personnel-event-form.tsx` (inbound `initialPersonId` effect) — **do not regress UX-DR11**
  - [x] When applying inbound person id (clean form or after Discard), hydrate `EntityPickerValue` for person (search/list row or get-by-id/code path already authorized) so the token shows code — name, not a raw UUID chip
  - [x] Snapshot / restore (`emptySnapshot` / `applySnapshot`) must round-trip picker-compatible state; Discard must restore last-saved entity tokens correctly
  - [x] Host (`personnel-event-form-host.tsx`) stays thin — change only if prefill contract needs a prop; prefer hydrate inside the form

- [x] Task 5: Selfcheck + regression DoD (AC: #7, #9, #10)
  - [x] UPDATE `entity-picker.selfcheck.ts`: remove “must not consume EntityPicker” / optional UUID-remain asserts; instead assert form **imports/uses** `EntityPicker`, has **no** free-text UUID `Input` bound to person/team/ladder/grade/employment/role/title/seniority/approval identifier entry (heuristic OK — document approximation), and references technical disclosure if added as named export
  - [x] Keep `selfcheck:layout-system` and `selfcheck:control-contract` green (footer ghost cancel allowlist unchanged)
  - [x] Run Epic 4 / person-employment personnel-event selfchecks **unmodified** (same commands the repo already uses for those packages)
  - [x] Run: `pnpm --filter @divan/web selfcheck:entity-picker`, `selfcheck:layout-system`, `selfcheck:control-contract`, `typecheck`
  - [x] Manual: register Start with personnel code + Persian digits; ladder→grade clear; dirty `?person=` leave-guard; Finalize payload still UUID ids; light/dark token + disclosure; keyboard on form pickers
  - [x] Story Status ↔ sprint-status alignment when marking done

### Review Findings

- [x] [Review][Decision] Scope of «شناسهٔ فنی» — resolved: person + destination team is the accepted 8.4 subset (AC #6 interpreted as that subset; not expanding to every picker).
- [x] [Review][Patch] Discard/applySnapshot loses cascade children (employment, PA, grade) because `useEntityPickerCascade` clears on parent id change after restore [`apps/web/components/personnel/personnel-event-form.tsx:319`]
- [x] [Review][Patch] Inbound `?person=` hydrate can overwrite a newer user selection or re-apply after Discard; mount + reconcile dual paths disagree on failure fallback [`apps/web/components/personnel/personnel-event-form.tsx:345`]
- [x] [Review][Patch] PA→employment sync has no request generation/cancel; late response can set stale employment; null resolve leaves PA without matching employment [`apps/web/components/personnel/personnel-event-form.tsx:229`]
- [x] [Review][Patch] `lastSavedRef` no longer seeds inbound `?person=` (baseline did); Discard before hydrate completes drops prefill [`apps/web/components/personnel/personnel-event-form.tsx:317`]
- [x] [Review][Patch] Selfcheck heuristics only ban legacy «شناسه …»+Input labels; Task 5 also lists role/title/seniority/approval [`apps/web/lib/entity-picker.selfcheck.ts:167`]
- [x] [Review][Patch] Source team/title/ladder/grade labels stay «…» on query error / disabled id — no error or raw-id fallback [`apps/web/components/personnel/personnel-event-form.tsx:533`]
- [x] [Review][Patch] Technical disclosure copy: silent clipboard failure; success not announced via `aria-live` (DoD) [`apps/web/components/entity-picker/technical-detail-disclosure.tsx:38`]
- [x] [Review][Patch] Truncated technical id in disclosure lacks `title` for full value hover [`apps/web/components/entity-picker/technical-detail-disclosure.tsx:75`]
- [x] [Review][Defer] Unused hydrate helpers (`hydrateOrgUnitValue`, job/ladder/grade/role/seniority/PA) — deferred, pre-existing-style dead scaffolding in new helpers file [`apps/web/components/personnel/personnel-event-entity-helpers.ts:121`]
- [x] [Review][Defer] PA→employment does two list round-trips — deferred, perf only once race/generation is fixed [`apps/web/components/personnel/personnel-event-form.tsx:234`]

## Dev Notes

### Gate (non-negotiable)

- **Presentation only** — Epic 8 intro: no domain/permission/governance rule changes except unblocking unreachable governed selection UX.
- **Forward UX** is `ux-divan-2026-07-31`; spines win on conflict with mocks.
- **FR-57:** operators never type internal IDs for selectable entities; employment/PA are record-pickers after person identity.
- **FR-33 / FR-48:** pickers never reveal subjects the caller could not list; empty/out-of-scope indistinguishable — reuse 8.3 resolvers as-is.
- **Mutation payloads unchanged** — SCP risk: touching this form can regress Epic 4. Mitigation: same UUID ids in draft/finalize bodies; run Epic 4 tests unmodified.
- **UI in `apps/web`** — no `@divan/ui` package; AD-6 Prisma gate unchanged.
- **8.5 boundary:** do not touch dashboard/report filters, exemption/override panels, correction cases, audit, recon, lifecycle person lists, etc.
- **PopulationPort honesty:** person picker surfaces the same empty outcomes as فهرست پرسنل; do not fake production population.

### Current state (UPDATE carefully)

```852:970:apps/web/components/personnel/personnel-event-form.tsx
          <FormField label="شناسه فرد" htmlFor={`${formId}-person`} required>
            <Input value={personId} ... dir="ltr" />
          ...
                ["teamId", "شناسه تیم", teamId, setTeamId],
                ["ladderId", "شناسه لدر", ladderId, setLadderId],
                ["gradeId", "شناسه گرید", gradeId, setGradeId],
```

Shared state is string UUIDs; Start/Transfer/JobLevel sections re-bind the same setters with different labels. Approval options use `approvalId.slice(0, 8)…`. Source primary `<dl>` dumps raw / truncated UUIDs with `text-identifier`.

`PersonnelEventFormHost` only passes `initialPersonId` from `?person=` — leave-guard logic lives in the form.

`entity-picker.selfcheck.ts` currently **forbids** EntityPicker on this form — first merge conflict for any 8.4 PR if not inverted.

### EntityPicker consumption contract (from 8.3 — obey review patches)

- Import from `@/components/entity-picker` barrel only.
- Value shape: `{ id, code, labelFa, secondaryFa? } | null` — **`id` only for mutation**.
- Cascade: without parent → `disabled` + «ابتدا {parent} را انتخاب کنید.»; parent change → clear child + reason (ensure clear reason is visible — 8.3 review: clearedReason must render when appropriate; dependents with empty query must list rows).
- Wire FormField a11y: `aria-labelledby` / `aria-required` / `aria-invalid` / `aria-describedby` through EntityPicker props.
- Token clear = dismiss chrome, not gold primary.
- Do **not** invent a parallel combobox; do not use CommandDialog as the form picker.
- APG: focus stays on combobox input; Escape closes list (token clear via clear control). Do not regress IME Enter handling already in EntityPicker.

### What must be preserved (end-to-end)

| Behavior | Where | Notes |
| --- | --- | --- |
| Draft ≠ Finalize | form footer + mutations | Unchanged semantics |
| Leave-guard on dirty person prefill | form inbound effect | UX-DR11 |
| Capacity query inputs | `personnelEvent.headcountCapacity` | Still UUID team/title/ladder/grade/approval ids |
| Sensitive confirm / authz-changed blocks | existing dialogs | Do not remove |
| Lifecycle Cancel/Reverse/Correct list | bottom of form | Out of identifier-input scope; do not “fix” event-id display in this story beyond AC (event list ids are operational correlation — full demotion is 8.5/8.9 if needed) |
| FormFooter ghost cancel | control-contract | Keep |

### Architecture compliance

- Stack pinned: Next.js 16.2.x, React 19, Tailwind v4, tRPC 11, Zod 3, cmdk, lucide-react — **do not upgrade casually**.
- Testing: `*.selfcheck.ts` + `pnpm --filter @divan/web selfcheck:*`.
- Personnel events: `person-employment → kernel`; AD-2/AD-3/AR-TEMPORAL unchanged.
- Errors stay domain-typed with Persian at API boundary — form only maps picker ids into existing calls.

### Project structure notes

| Action | Path |
| --- | --- |
| UPDATE | `apps/web/components/personnel/personnel-event-form.tsx` |
| UPDATE | `apps/web/lib/entity-picker.selfcheck.ts` (invert 8.4 boundary) |
| NEW | `technical-detail-disclosure` component (+ barrel export if under entity-picker) |
| UPDATE (if needed) | `personnel-event-form-host.tsx`, `headcount-capacity-panel.tsx` (labels only), gallery demo optional |
| UPDATE | `sprint-status.yaml` when story moves |
| DO NOT TOUCH | Epic 4 module validation selfchecks (must pass unmodified); 8.5 surfaces; event-store; authz matrices |

### Previous story intelligence (8.3)

- Ship was **gallery-proven primitive + real resolvers** — this story is **wire-up**, not invention.
- Review patches that bite form integration: cascade clear reason visibility; empty-query dependents; focus after select/clear; token-branch FormField a11y; `normalizeDigitsForMatch` on queries; IME Enter ignore; getByCode hydrate for exact code.
- Selfcheck heuristics > path-only allowlists; when inverting boundary, assert positive EntityPicker use and absence of UUID Inputs for entity fields.
- Control-contract ghost allowlist is tight — do not add new ghost buttons outside FormFooter/dialog cancel.
- Double-gutter lesson: do not wrap FormLayout in extra padding on register page.
- Optional create-on-empty callback exists on EntityPicker — **do not** wire QuickCreate / person-create dedupe here (open Epic debt).

### Git intelligence

| Commit | Relevance |
| --- | --- |
| `07f2b28` story 8.3 | EntityPicker kit + resolvers + selfcheck boundary — **baseline** |
| `0b19c2a` story 8.2 | FormLayout already on this form — consume |
| `81ace11` story 8.1 | Footer button variants — consume |

### Latest tech notes

- WAI-ARIA APG Combobox remains the contract already implemented in EntityPicker (focus on input + `aria-activedescendant`). Form work must not replace it with a Select/Dialog fork.
- `technical-detail-disclosure` is a simple `<details>`/`summary` or Radix Collapsible + copy — keep presentational; no new dependency.

### Epic 8 / carry-in open items (do not silently expand)

- PopulationPort cutover, AD-6 Prisma↔PoolClient, SoD splits, InferenceBulkPort ops, person-create dedupe, logout leave-guard — **out of scope**.
- OQ-2 enumeration timing oracle — do not invent.
- Event timeline / list still showing truncated event UUIDs — acceptable deferral unless it blocks AC #1 (form **inputs**); full identity demotion elsewhere is 8.5/8.9.

### Testing requirements

- `pnpm --filter @divan/web selfcheck:entity-picker`
- `pnpm --filter @divan/web selfcheck:layout-system`
- `pnpm --filter @divan/web selfcheck:control-contract`
- `pnpm --filter @divan/web typecheck`
- Existing `@divan/person-employment` / personnel-event selfchecks — **unmodified** and green
- Manual: Sara flow — personnel code ۱۰۰۱۲, team by name, ladder→grade, capacity numbers, zero UUID typing; dirty prefill leave-guard; disclosure copy

### Interactive a11y DoD (form pickers)

- [x] Every replaced field uses EntityPicker combobox semantics (not native text UUID)
- [x] Keyboard-only path through person → employment → ladder → grade → finalize
- [x] Disabled dependents expose Persian reason to AT
- [x] Technical disclosure keyboard-operable; copy announced / focusable
- [x] Required/invalid wiring preserved on FormField + picker

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8.4, UX-DR29, Epic 8]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-57, FR-33, FR-48]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — Identifier Model]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — entity-picker / technical-detail-disclosure]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/direction-a-dense-console.html`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — Story 8.4 row / Epic 4 regression risk]
- [Source: `_bmad-output/implementation-artifacts/8-3-entity-picker-primitive-code-resolvers.md`]
- [Source: `_bmad-output/implementation-artifacts/8-2-visual-design-language-layout-system.md`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md`]
- [Source: `apps/web/components/personnel/personnel-event-form.tsx`, `personnel-event-form-host.tsx`, `entity-picker/*`, `lib/entity-picker.selfcheck.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Inverted `entity-picker.selfcheck` 8.4 boundary; green after form wiring.
- Epic 4 personnel-event selfchecks (draft/start-return/transfer/job-level/termination/lifecycle) unmodified and OK.
- Web: `selfcheck:entity-picker`, `selfcheck:layout-system`, `selfcheck:control-contract`, `typecheck` OK.
- Regenerated corrupted `.next/dev/types/routes.d.ts` so local typecheck could parse (dev cache artifact).

### Completion Notes List

- Replaced all selectable-entity UUID `Input`s on `personnel-event-form` with `EntityPicker` + 8.3 resolvers; mutation payloads still use `.id` UUIDs only.
- Wired `useEntityPickerCascade` for person→employment / person→primary-assignment and ladder→grade; PA selection syncs `employmentId` without new payload keys.
- Source primary summaries and approval `<select>` options show code/name (joined via existing `organization.get` / `jobReference.*` / `listApprovals`) — no truncated UUID primary identity.
- Added `TechnicalDetailDisclosure` (collapsed «شناسهٔ فنی» + tertiary copy) for person and destination team.
- Prefill/`?person=` leave-guard preserved; inbound id hydrates to code—name token; snapshots round-trip `EntityPickerValue` tokens.

### File List

- `apps/web/components/personnel/personnel-event-form.tsx`
- `apps/web/components/personnel/personnel-event-entity-helpers.ts`
- `apps/web/components/entity-picker/technical-detail-disclosure.tsx`
- `apps/web/components/entity-picker/index.ts`
- `apps/web/lib/entity-picker.selfcheck.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/8-4-personnel-event-form-identifier-first-retrofit.md`

### Change Log

- 2026-07-31: Story context created (ready-for-dev) — identifier-first retrofit guide for personnel-event-form.
- 2026-07-31: Implemented identifier-first retrofit — EntityPicker wiring, cascade, technical disclosure, human labels, selfcheck invert; status → review.
- 2026-07-31: Code review patches applied — cascade restore, inbound hydrate race, PA sync generation, source labels, disclosure a11y, selfcheck; status → done.
