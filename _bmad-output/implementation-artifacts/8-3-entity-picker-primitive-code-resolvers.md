---
baseline_commit: 0b19c2a
---

# Story 8.3: entity-picker Primitive & Code Resolvers

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator filling any form,
I want to find people, teams, and job concepts by typing their business code or name,
so that I never need an internal identifier to do my job (UX-DR29, FR57, FR33).

**Story key:** `8-3-entity-picker-primitive-code-resolvers`  
**Epic:** 8 — Experience Foundation & Identifier Ergonomics (FR57, FR58; FR33, FR48)  
**UX contract (forward):** `ux-divan-2026-07-31` (DESIGN.md + EXPERIENCE.md) — Direction A mockup picker chrome is visual acceptance  
**Authorized by:** `sprint-change-proposal-2026-07-31` (PO-approved)  
**Prerequisite:** Story 8.2 done (`8-2-visual-design-language-layout-system`) — tokens, FormLayout, gallery stub slot. Do **not** reopen layout/button contracts.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| `person.search` + scoped population | `apps/web/src/server/person.ts`, `personnel-scoped-search.ts` | FR-33 permission-safe search/list; evaluation snapshot paging | Wire as person-variant resolver; picker must use `channel: "search"` |
| `person.getByPersonnelCode` | `person.ts` | Code → person + `assertPersonInScopedPopulation` (uniform `PERSON_NOT_FOUND`) | Keep; picker search uses `search`, not get-by-code enumeration loops |
| Command palette person search | `lib/personnel-search.ts`, `command-palette.tsx` | Debounced digit-normalized person hits via vanilla tRPC | **Do not** fork a second search stack — share normalize + server path; picker is form control, not nav |
| Digit helpers | `lib/persian-digits.ts` (`toLatinDigits`, `normalizeDigitsForMatch`) | Latin/Persian/Arabic-Indic normalize | **Must** normalize every picker query before server call |
| Org list/get-by-id | `organization.ts` + `org-unit.ts` | `list` / `get` by id; codes unique in model | **Missing** `organization.getByCode` (+ domain `getOrgUnitByCode`) |
| Job ref list/get-by-id | `job-reference.ts` router + module | list*/get* by id; grades via `listGradesForLadder` | **Missing** `jobReference.getByCode` (role/title/ladder/seniority; grade needs ladder parent) |
| Headcount approvals | `headcount.listApprovals` / `listCompatibleApprovals` | Permission-gated approval lists | Filter/search for approval variant; no free-text UUID |
| Accounts | `accessAdmin.listEntitlements` | Admin-bound account inventory | Account variant filters this (or thin search) — **never** invent unscoped account dump |
| Employments | `listEmploymentsForPerson` (module); `person.listPriorEmployments` | Prior employments for profile | Dependent **employment** picker needs permission-safe selectable rows with dates (open + relevant history as product needs — never free text) |
| Primary assignments | `listPrimaryAssignmentsForEmployment`, `getActivePrimaryAssignmentAsOf` | Domain helpers exist | Dependent **primary-assignment** variant: list person's permission-safe primaries with dates after person chosen |
| Form chrome | `components/form-layout/*` | FormField / FormSection | Picker must compose inside FormField (label column, error, required) |
| Popover + cmdk | `components/ui/popover.tsx`, `command.tsx`, `cmdk` ^1.1.1 | Building blocks | Prefer **custom combobox** (focus stays on input + `aria-activedescendant`). Do **not** misuse Command Dialog or roving-focus Select as the picker |
| Gallery stub | `app/(app)/dev/gallery/page.tsx` | Label “entity-picker — Story 8.3” | Replace stub with live primitive demos (light/dark) |
| Icon contract | `components/icons/icon-contract.md` | Search / clear icons | Use Lucide `Search` / `X` per starter map — no second icon library |

**No** shared `EntityPicker` / `entity-token` exists yet. Forms still use raw UUID `Input`s (personnel-event-form and others) — **retrofit is 8.4 / 8.5**, not this story.

### Critical naming distinction (do not conflate)

| Concept | Meaning | Owner |
| --- | --- | --- |
| **entity-picker + resolvers** (this story) | Shared async combobox, entity-token, cascade API, server getByCode / dependent lookups, gallery demos, enumeration-safe empty states | **8.3** |
| **Personnel event form UUID retrofit** | Replace ~15 identifier inputs; ladder→grade cascade on the form; mutation payloads unchanged | **8.4** |
| **Remaining surfaces UUID retrofit** | Dashboard/report filters, headcount panels, audit, recon, etc. + UUID-without-picker selfcheck | **8.5** |
| **technical-detail-disclosure** | Collapsed «شناسهٔ فنی» with copy | **8.4** (form) / later surfaces — 8.3 may export a thin presentational helper if needed for gallery; do not block on full disclosure productization |
| **Layout / FormLayout / PageHeader** | Spacing, footer order, tokens | **8.2** (done) — consume only |
| **Control button variants** | primary/secondary/ghost allowlist | **8.1** (done) — clear control on token is icon tertiary/ghost-dismiss pattern, not a second CTA |
| **Table readability / row actions / feedback / copy / QA gate** | | **8.6–8.10** |

## Acceptance Criteria

1. **Given** the shared UI in `apps/web` and module APIs  
   **When** `entity-picker` is implemented  
   **Then** it searches asynchronously from the first character (debounced), accepts Latin or Persian (and Arabic-Indic) digits via `normalizeDigitsForMatch` / `toLatinDigits`, and renders each option as `«{code} — {name}»` with a disambiguating second line (person: current team · job title when known; org unit/team: parent unit; job refs: type/context as needed)

2. **And** it exposes combobox semantics (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, options `role="option"`) and is fully keyboard operable (ArrowUp/Down, Enter select, Escape close/clear-active, Tab leaves control); DOM focus stays on the input while navigating options

3. **And** the selected value renders as an `entity-token` (DESIGN tokens: selection-tint chip, blue code, clear control); cascading pickers disable and clear dependents when the parent changes, stating the Persian reason (disabled-with-reason per FR58 / UX-DR30)

4. **And** typed variants exist for: **person**, **org unit/team**, **organizational role**, **job title**, **ladder → grade** (cascading), **seniority**, **headcount approval**, and **account**

5. **And** dependent-record variants **employment** and **primary assignment** list the chosen person's permission-safe records with distinguishing dates (and related facts), **never** free-text identifier entry; they stay disabled with reason until a person is selected

6. **When** the caller lacks permission for a subject  
   **Then** it is absent from suggestions; empty / not-found / out-of-scope results are indistinguishable in **wording**, **count presentation**, and **response timing posture** (FR33, FR48) — reuse `person.search` / `assertPersonInScopedPopulation` uniform-NOT_FOUND patterns; do not invent AR-ACCESS timing oracles, but do not leak distinct errors or counts either

7. **And** missing server resolvers **`organization.getByCode`** and **`jobReference.getByCode`** are added alongside existing `person.search` and `person.getByPersonnelCode`, with the **same authorization posture** as sibling read procedures (`organization.read` / `job_reference.read`); picker search **never widens** what the caller could already list

8. **And** the living gallery at `/dev/gallery` demonstrates person + at least one org/job cascade + one dependent-record variant in light and dark; production gate (`notFound`) unchanged

9. **And** scope stays **interaction + thin read resolvers only**:
   - No domain/permission/governance/event-store/temporal/headcount **semantic** changes
   - Mutation payloads and Epic 4 validation unchanged
   - Do **not** retrofit `personnel-event-form` UUID fields (**8.4**) or other product surfaces (**8.5**)
   - AR-\* remain fail-closed; do not invent freeze numbers
   - `selfcheck:control-contract` and `selfcheck:layout-system` remain green

10. **And** this story does **not** own: form UUID retrofit (**8.4–8.5**); table min-width (**8.6**); row-action dead-click (**8.7**); skeleton/toast (**8.8**); copy/glossary (**8.9**); design QA gate (**8.10**); Epic 9–10 surfaces

## Tasks / Subtasks

- [x] Task 1: Domain + tRPC code resolvers (AC: #6, #7, #9)
  - [x] NEW in `@divan/person-employment`: `getOrgUnitByCode(code)` (normalize via existing org code digit helpers); export from package index
  - [x] NEW `organization.getByCode` governedProcedure — `organization.read` meta; uniform not-found vs unauthorized wording aligned with sibling `get`; return same public shape as `get`
  - [x] NEW job-ref domain helpers as needed: get role/title/ladder/seniority **by code**; grade **by (ladderId, code)** or require ladder in input — mirror uniqueness constraints (`code` unique per type; grade unique per ladder)
  - [x] NEW `jobReference.getByCode` governedProcedure — input discriminates kind (`organizationalRole` | `jobTitle` | `ladder` | `grade` | `seniority`) + optional `ladderId` for grade; `job_reference.read` meta
  - [x] Optional thin helpers if cleaner than client-only filter: `organization.searchByCodeOrName`, `jobReference.searchByCodeOrName` — **must** only return rows the caller could already `list*`; prefer server-side filter of existing list predicates over new unscoped queries
  - [x] NEW dependent lookups (suggested names — keep governed + scoped):
    - `person.listSelectableEmployments` — assert person in scoped population, return employments with start/end (or open) dates for picker rows
    - `person.listSelectablePrimaryAssignments` — same scope gate; rows show dates + team/job labels when cheap to resolve (reuse label resolvers; no parallel SoT)
  - [x] Account variant: filter `accessAdmin.listEntitlements` (or add `accessAdmin.searchAccounts` that only searches that same set) — require access-administration binding; do not invent a global account directory
  - [x] Approval variant: consume `headcount.listApprovals` / compatible list; display business label/code fields already on approval records — never require typing approval UUID
  - [x] Selfcheck or module-level assert for getByCode happy path + missing code → not found (no stack traces to client)

- [x] Task 2: `EntityToken` presentational primitive (AC: #3)
  - [x] NEW `apps/web/components/entity-picker/entity-token.tsx` (or under `components/ui/` if thin enough)
  - [x] Visual: height `--control-height-xs` / DESIGN entity-token; blue code; name; inline-end clear button with `aria-label` (e.g. «پاک کردن انتخاب»)
  - [x] Clear is dismiss chrome (ghost/icon), **not** gold primary; stop propagation so parent form rows do not navigate

- [x] Task 3: Core `EntityPicker` combobox (AC: #1, #2, #3, #6)
  - [x] NEW `apps/web/components/entity-picker/entity-picker.tsx` (+ types module)
  - [x] Props (normative intent): `variant` or resolver injection; `value` / `onValueChange` (selected `{ id, code, labelFa, secondaryFa? } | null`); `disabled` + `disabledReasonFa`; `scopeNoteFa` (popover header); `emptyCreateAction?` optional callback (wire API only — do not build create flows); `debounceMs` (~150–250); `id` / label wiring for FormField
  - [x] Behavior: first character opens search; debounce; normalize digits; show popover with header (result count phrasing must not distinguish scope denial), two-line options, keycap footer (↑↓ · Enter · Esc) per mockup
  - [x] A11y: combobox on **input**; listbox id; `aria-activedescendant` to active option id; polite live region for «N نتیجه» / empty copy shared with operational empty-search voice where appropriate
  - [x] Styling: `--control-height` input; popover shadow/border/radius from DESIGN `entity-picker.*`; active option `selection-tint` + 2px inline-start primary marker; code color primary
  - [x] **Anti-pattern:** do not put `role="combobox"` on a wrapping div; do not move DOM focus into options; do not use cmdk Dialog; do not use UUID as primary display

- [x] Task 4: Variant adapters + cascade helper (AC: #3, #4, #5, #7)
  - [x] NEW thin wrappers or a `resolvers.ts` map: person → `person.search`; org → list/search + getByCode; job refs → list*/getByCode; ladder→grade cascade; seniority; approval; account
  - [x] NEW `useEntityPickerCascade` (or equivalent): when parent value changes, clear child value and set child `disabled` + reason «ابتدا {parentLabel} را انتخاب کنید.» / «با تغییر {parent}، انتخاب وابسته پاک شد.»
  - [x] Dependent employment / primary-assignment adapters call Task 1 procedures; option primary line uses dates + human facts, **not** raw UUID as identity (UUID may sit behind future technical disclosure in 8.4)
  - [x] Person option secondary line: prefer team · title from search row fields already returned by `person.search` / scoped rows — extend search row DTO **only** if disambiguator is missing and cheap; do not add sensitive categories

- [x] Task 5: Gallery + FormField integration sample (AC: #8, #9)
  - [x] UPDATE `dev/gallery/page.tsx`: replace 8.3 stub with interactive EntityPicker demos (person; ladder→grade cascade; employment-after-person)
  - [x] Show disabled-with-reason state and selected `entity-token` clear
  - [x] Optional: one FormField-wrapped example proving label column / error slot composition — **do not** change production personnel-event-form inputs yet

- [x] Task 6: Selfcheck + DoD (AC: #1–#10)
  - [x] NEW `apps/web/lib/entity-picker.selfcheck.ts` (and/or colocated):
    - Module exports EntityPicker / EntityToken
    - Source heuristics: `role="combobox"`, `aria-activedescendant` present in picker module
    - Gallery page references EntityPicker (not only stub text)
    - organization + jobReference routers contain `getByCode`
    - Assert personnel-event-form still has UUID inputs **unchanged** for 8.4 boundary (optional negative check documenting deferral)
  - [x] Wire `package.json`: `selfcheck:entity-picker`
  - [x] Run: `selfcheck:entity-picker`, `selfcheck:layout-system`, `selfcheck:control-contract`, `typecheck`
  - [x] Manual: keyboard path on gallery; Persian digit query (`۱۲` → latin normalize); cascade clear; empty query timing/copy does not reveal scope
  - [x] Story Status ↔ sprint-status alignment when marking done

### Review Findings

- [x] [Review][Patch] Exact-code hydrate via getByCode alongside list filter [`apps/web/components/entity-picker/resolvers.ts`] — decided: when normalized query equals a code, resolve via `organization.getByCode` / `jobReference.getByCode` (kind-discriminated) in addition to list filter; do not widen authz.
- [x] [Review][Patch] Cascade clear reason never shown when parent changes [`apps/web/components/entity-picker/use-entity-picker-cascade.ts:56`] — `clearedReason` is set while `disabled===false`; `EntityPicker` only renders reason when `disabled`. Also avoid setting clear copy on first parent select (null→id).
- [x] [Review][Patch] Dependent variants require typing before any rows appear [`apps/web/components/entity-picker/entity-picker.tsx:102`] — empty query short-circuits; employment/PA/grade resolvers already support `!q → all` but never get called.
- [x] [Review][Patch] Focus lost after select/clear [`apps/web/components/entity-picker/entity-picker.tsx:147`] — `inputRef.focus()` runs while input is unmounted (token branch); remount after clear does not restore focus.
- [x] [Review][Patch] Selected state drops combobox / FormField a11y wiring [`apps/web/components/entity-picker/entity-picker.tsx:204`] — token branch is a `div` with `tabIndex={0}`; no `role="combobox"`, labelledby/required/invalid not applied.
- [x] [Review][Patch] Align getByCode digit normalize with picker [`packages/modules/person-employment/src/org-unit.ts:609`] — uses `toLatinDigits().trim()` only; picker uses `normalizeDigitsForMatch` (strips separators).
- [x] [Review][Patch] getByCode returns inactive rows while list defaults to active [`packages/modules/person-employment/src/org-unit.ts:605`] — same for job-ref get*ByCode.
- [x] [Review][Patch] Bump search generation on select to drop in-flight results [`apps/web/components/entity-picker/entity-picker.tsx:147`]
- [x] [Review][Patch] Clear query/options when picker becomes disabled [`apps/web/components/entity-picker/entity-picker.tsx:132`]
- [x] [Review][Patch] Pass `pageSize: 100` on person.search [`apps/web/components/entity-picker/resolvers.ts:39`]
- [x] [Review][Patch] Show loading state in popover [`apps/web/components/entity-picker/entity-picker.tsx:91`]
- [x] [Review][Patch] Narrow `role="listbox"` to the options list [`apps/web/components/entity-picker/entity-picker.tsx:306`]
- [x] [Review][Patch] Primary line guillemets `«{code} — {name}»` [`apps/web/components/entity-picker/entity-picker.tsx:46`]
- [x] [Review][Patch] Ignore Enter during IME composition [`apps/web/components/entity-picker/entity-picker.tsx:181`]
- [x] [Review][Patch] Assert `getJobTitleByCode` in job-reference selfcheck [`packages/modules/person-employment/src/job-reference.selfcheck.ts`]
- [x] [Review][Patch] Reduce N+1 lookups in `listSelectablePrimaryAssignments` [`apps/web/src/server/person.ts:484`]

## Dev Notes

### Gate (non-negotiable)

- **Presentation + thin read resolvers only** — Epic 8 intro: no domain/permission/governance rule changes except unblocking unreachable governed selection UX.
- **Forward UX** is `ux-divan-2026-07-31`; spines win on conflict with mocks. Visual reference: `mockups/direction-a-dense-console.html` picker popover (lines ~640–650).
- **FR-57:** operators never type internal IDs for selectable entities; employment/PA are record-pickers after person identity.
- **FR-33 / FR-48:** picker never reveals subjects the caller could not list; empty states indistinguishable; do not invent timing oracles beyond existing uniform NOT_FOUND posture (`assertPersonInScopedPopulation` already maps missing/out-of-scope to the same Persian message).
- **UI lives in `apps/web` (`@divan/web`)** — no `@divan/ui` package.
- **ESLint Prisma gate** remains: web imports modules/tRPC only.
- **Consume 8.1 / 8.2** — do not fork Button variants, FormLayout, or tokens.
- **8.4 boundary:** leave `personnel-event-form` UUID `Input`s in place; this story ships the primitive those fields will consume next.
- **PopulationPort honesty:** person search may still be fixture-fail-closed / dev UUID registry — picker must surface the same empty outcomes as فهرست پرسنل; do not fake production population.

### Current state (UPDATE carefully)

```853:970:apps/web/components/personnel/personnel-event-form.tsx
            <Input
              value={personId}
              ...
                ["teamId", "شناسه تیم", teamId, setTeamId],
                ["ladderId", "شناسه لدر", ladderId, setLadderId],
```

Organization router has `list` + `get` (by id) only — **no** `getByCode`. Job-reference router has list*/get* by id and `listGradesForLadder` — **no** `getByCode`. Domain `org-unit.ts` has `getOrgUnitById` but not by code (create path already `findUnique({ where: { code } })` — extract reusable getter).

```43:45:apps/web/lib/personnel-search.ts
 * TODO(OQ-2): Uniform timing/copy for out-of-scope vs not-found
 * must land with AR-ACCESS — do not invent enumeration-safe delays here.
```

Picker must not make this worse: same copy, same empty list, no client-side “permission denied” branch for missing hits.

### Combobox implementation notes (latest a11y)

- Keep focus on the text input; drive highlight via `aria-activedescendant` (WAI-ARIA APG combobox; Radix still has no shipped Combobox primitive — build on Popover + input, optionally cmdk **list filtering only** if it does not steal focus).
- Prevent option `mousedown` from blurring the input before click registers.
- `aria-autocomplete="list"`; announce result counts via polite live region.
- Escape: close list; if token selected and list closed, clear is via token clear control (document exact Esc behavior in gallery).

### Variant → API map (authoritative for this story)

| Variant | Search / list source | Resolve by code | Authz |
| --- | --- | --- | --- |
| person | `person.search` `{ channel: "search", normalizedQuery }` | `person.getByPersonnelCode` (optional hydrate) | `person.read` + PopulationPort scope |
| org unit/team | filter `organization.list` or thin search | `organization.getByCode` **NEW** | `organization.read` |
| organizational role | `jobReference.listRoles` | `jobReference.getByCode` kind=role **NEW** | `job_reference.read` |
| job title | `listJobTitles` | getByCode kind=jobTitle | same |
| ladder | `listLadders` | getByCode kind=ladder | same |
| grade | `listGradesForLadder(ladderId)` after parent | getByCode kind=grade + ladderId | same |
| seniority | `listSeniorities` | getByCode kind=seniority | same |
| headcount approval | `headcount.listApprovals` / compatible | get by id from selection only | approval read |
| account | entitlements list/search | N/A (account id from row) | access administration |
| employment | `person.listSelectableEmployments` **NEW** | N/A (no business code) | person scope |
| primary assignment | `person.listSelectablePrimaryAssignments` **NEW** | N/A | person scope |

### Architecture compliance

- Stack: Next.js 16.2.x, React 19, Tailwind v4.3.x, tRPC 11, Zod 3, Radix via `radix-ui` package, cmdk 1.1.x, lucide-react — **already pinned**; do not upgrade casually.
- Testing: file-based `*.selfcheck.ts` + `pnpm --filter @divan/web selfcheck:*`.
- AD-6: Prisma only inside modules; web uses tRPC.

### Project structure notes

| Action | Path |
| --- | --- |
| NEW | `apps/web/components/entity-picker/*` (`entity-picker.tsx`, `entity-token.tsx`, resolvers/cascade helpers) |
| NEW | `apps/web/lib/entity-picker.selfcheck.ts` |
| UPDATE | `apps/web/app/(app)/dev/gallery/page.tsx` |
| UPDATE | `apps/web/package.json` (selfcheck script) |
| UPDATE | `apps/web/src/server/organization.ts` (`getByCode`) |
| UPDATE | `apps/web/src/server/job-reference.ts` (`getByCode`) |
| UPDATE | `apps/web/src/server/person.ts` (selectable employment/PA procedures) |
| UPDATE | `packages/modules/person-employment/src/org-unit.ts` (+ exports) |
| UPDATE | `packages/modules/person-employment/src/job-reference.ts` (+ exports) |
| DO NOT TOUCH (product retrofit) | `personnel-event-form.tsx` UUID fields — **8.4** |

### Previous story intelligence (8.2)

- Minimal tokens + migrate call sites beat “tokens only” — for 8.3, **gallery-proven primitive + real resolvers** beat a half-styled input.
- Selfcheck usage heuristics > path-only allowlists; document approximations.
- Review patches on FormField a11y (`htmlFor`, `aria-required`) — picker must wire labelled-by / describedby when composed in FormField.
- Double-gutter lesson: gallery demos should not add extra padding that misleads consumers.
- Gallery is production-`notFound`; keep it out of operator nav.
- Control-contract ghost allowlist is tight (`FormFooter` / dialog cancel) — token clear must not trip row/toolbar ghost bans (use documented dismiss pattern).

### Git intelligence

| Commit | Relevance |
| --- | --- |
| `0b19c2a` story 8.2 | Layout tokens, FormLayout, gallery stub — **baseline** |
| `81ace11` story 8.1 | Button / control contract — consume |
| Epic 5 person search | FR-33 search substrate — **reuse** |

### Epic 8 carry-ins / open items (do not silently expand scope)

- Still open from Epic 7 retro: PopulationPort cutover, AD-6 hardening, SoD splits, InferenceBulkPort ops, etc. — **out of scope**.
- OQ-2 enumeration timing oracle — **do not invent**; keep uniform copy/empty lists.
- Epic 9 depends on this picker — API should be boring and reusable (`value` = `{ id, code, labelFa }`).
- Create-on-empty path is an optional callback slot only; QuickCreate / person-create dedupe remains open Epic debt — do not solve here.

### Testing requirements

- `pnpm --filter @divan/web selfcheck:entity-picker`
- `pnpm --filter @divan/web selfcheck:layout-system`
- `pnpm --filter @divan/web selfcheck:control-contract`
- `pnpm --filter @divan/web typecheck`
- Module selfchecks if new org/job getByCode paths warrant them (tsx pattern used elsewhere)
- Manual: RTL popover alignment; keyboard; Persian digits; cascade disable reason; person empty vs denied indistinguishable; gallery light/dark

### Interactive a11y DoD (picker)

- [x] Combobox semantics complete (expanded/collapsed, activedescendant, option roles)
- [x] Keyboard-only select + clear + cascade re-enable
- [x] Focus returns to input after close; focus ring visible
- [x] Disabled dependent states expose reason to AT (not only title tooltip)
- [x] Empty state copy does not mention “access denied” / “out of scope”

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8.3, UX-DR29, Epic 8]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-57, FR-33, FR-48]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — Identifier Model, entity-picker pattern]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — entity-picker / entity-token tokens]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/direction-a-dense-console.html`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — Story 8.3 row]
- [Source: `_bmad-output/implementation-artifacts/8-2-visual-design-language-layout-system.md`]
- [Source: `_bmad-output/implementation-artifacts/8-1-interaction-audit-gap-list.md` — Deferred 8.3–8.5]
- [Source: `apps/web/src/server/person.ts`, `organization.ts`, `job-reference.ts`, `lib/persian-digits.ts`, `lib/personnel-search.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- `pnpm --filter @divan/web selfcheck:entity-picker` → ok
- `pnpm --filter @divan/web selfcheck:layout-system` → ok
- `pnpm --filter @divan/web selfcheck:control-contract` → ok (0 retired ghost)
- `pnpm --filter @divan/web typecheck` → ok

### Completion Notes List

- Domain `getOrgUnitByCode` + job-ref `get*ByCode` / `getGradeByCode(ladderId, code)` with Latin digit normalize; uniform NOT_FOUND on routers matching sibling `get` wording.
- `organization.getByCode`, `jobReference.getByCode` (discriminated kind), `person.listSelectableEmployments` / `listSelectablePrimaryAssignments` (scope-gated).
- Client variant resolvers filter existing `list*` / entitlements / approvals — no unscoped directories; person uses `channel: "search"`.
- `EntityPicker` APG combobox (focus on input + `aria-activedescendant`); `EntityToken` dismiss clear; `useEntityPickerCascade` for ladder→grade and person→employment.
- Gallery demos replace 8.3 stub; `personnel-event-form` UUID inputs left for 8.4.
- Optional server `searchByCodeOrName` skipped in favor of client filter of authorized lists.

### File List

- `packages/modules/person-employment/src/org-unit.ts`
- `packages/modules/person-employment/src/job-reference.ts`
- `packages/modules/person-employment/src/index.ts`
- `packages/modules/person-employment/src/org-unit.selfcheck.ts`
- `packages/modules/person-employment/src/job-reference.selfcheck.ts`
- `apps/web/src/server/organization.ts`
- `apps/web/src/server/job-reference.ts`
- `apps/web/src/server/person.ts`
- `apps/web/components/entity-picker/types.ts`
- `apps/web/components/entity-picker/entity-token.tsx`
- `apps/web/components/entity-picker/entity-picker.tsx`
- `apps/web/components/entity-picker/resolvers.ts`
- `apps/web/components/entity-picker/use-entity-picker-cascade.ts`
- `apps/web/components/entity-picker/index.ts`
- `apps/web/app/(app)/dev/gallery/entity-picker-demos.tsx`
- `apps/web/app/(app)/dev/gallery/page.tsx`
- `apps/web/lib/entity-picker.selfcheck.ts`
- `apps/web/package.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/8-3-entity-picker-primitive-code-resolvers.md`

### Change Log

- 2026-07-31: Implemented Story 8.3 entity-picker primitive, code resolvers, cascade helper, gallery demos, and selfcheck.
- 2026-07-31: Code review patches — getByCode hydrate, cascade clear reason, empty-query dependents, focus/a11y, active+normalize getByCode, loading/listbox/IME, PA batch labels.
