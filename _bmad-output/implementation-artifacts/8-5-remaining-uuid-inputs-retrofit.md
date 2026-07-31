---
baseline_commit: d0b45e4
---

# Story 8.5: Remaining UUID Inputs Retrofit

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As any user of the remaining admin and analysis surfaces,
I want the same code-first selection everywhere,
so that no corner of the product still demands an internal identifier (FR57).

**Story key:** `8-5-remaining-uuid-inputs-retrofit`  
**Epic:** 8 — Experience Foundation & Identifier Ergonomics (FR57, FR58; FR33, FR48)  
**UX contract (forward):** `ux-divan-2026-07-31` (EXPERIENCE.md Identifier Model + DESIGN.md entity-picker / technical-detail-disclosure)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (PO-approved)  
**Prerequisite:** Story 8.3 done (EntityPicker + resolvers + gallery). Story 8.4 done (personnel-event-form wire-up pattern, `TechnicalDetailDisclosure`, form selfcheck invert). Do **not** reinvent the picker or reopen the event form unless fixing a shared primitive bug.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| `EntityPicker` + `EntityToken` + cascade | `apps/web/components/entity-picker/*` | Combobox, token clear, `useEntityPickerCascade`, all variant resolvers | **Wire into remaining surfaces** — do not fork a second picker |
| `TechnicalDetailDisclosure` | `entity-picker/technical-detail-disclosure.tsx` | Collapsed «شناسهٔ فنی» + LTR copy | Reuse on detail rows / audit raw path; do not rebuild |
| Resolvers | `entity-picker/resolvers.ts` | person, org, job refs, ladder/grade, seniority, approval, account, employment, PA | Consume as-is; extend only if a surface needs a missing variant (prefer reuse) |
| 8.4 form pattern | `personnel-event-form.tsx` | EntityPickerValue → `.id` for mutations; cascade; business labels | Copy the pattern; **do not** re-edit the event form for new fields |
| Selfcheck | `lib/entity-picker.selfcheck.ts` | Asserts 8.3 kit + 8.4 form boundary | **Extend** for remaining surfaces + UUID-without-picker fail |
| Operational copy keys | `lib/operational-copy.ts` | Labels still say «شناسه …» for several panels | Update copy to business language when swapping inputs |

### Critical naming distinction (do not conflate)

| Concept | Owner |
| --- | --- |
| EntityPicker primitive / resolvers / gallery | **8.3** (done) — consume only |
| Personnel event form identifier-first retrofit | **8.4** (done) — do not reopen |
| **This story** — every remaining UUID / free-text identifier input on admin & analysis surfaces + displayed identity demotion on those same surfaces + UUID-without-picker selfcheck | **8.5** |
| Table readability / row actions / feedback / copy overhaul / QA gate | **8.6–8.10** |
| Approval panel native `<select>` with code+name (no UUID typing) | **Out of AC** — optional consistency later; do not expand scope |

## Acceptance Criteria

1. **Given** the surfaces outside the personnel event form  
   **When** the retrofit is complete  
   **Then** pickers replace identifier inputs in:
   - dashboard, report, and historical team filters
   - headcount exemption and override panels
   - correction-case person and link target
   - lifecycle scope and disposal person lists
   - audit investigation actor and entity
   - reconciliation owner and approver
   - launch-artifact owner and approver

2. **And** every displayed record identity on those surfaces is code plus human name, in that order (no `slice(0,8)…` / raw UUID as primary cell or heading identity)

3. **And** internal identifiers appear only inside a labelled «شناسهٔ فنی» disclosure or in exported evidence where correlation requires them

4. **And** audit investigation retains the ability to look up by raw identifier (legitimate support path), but that path is **not** the default input

5. **And** a selfcheck fails when a form input is bound to a UUID-typed field without a picker (heuristic OK — document approximation; cover the AC #1 inventory at minimum)

6. **And** scope stays **presentation only**:
   - No domain/permission/governance/event-store/temporal/headcount **semantic** changes
   - Mutation/query payloads still send UUID `.id` strings (server Zod unchanged)
   - FR-33 / FR-48: reuse 8.3 resolvers as-is (empty / out-of-scope indistinguishable)
   - AR-\* remain fail-closed; do not invent freeze numbers
   - `selfcheck:layout-system`, `selfcheck:control-contract`, `selfcheck:entity-picker` remain green after extension
   - Do **not** reopen `personnel-event-form` except shared-primitive bugfixes

7. **And** this story does **not** own: table min-width (**8.6**); row-action dead-click (**8.7**); skeleton/toast (**8.8**); full copy/glossary overhaul (**8.9**); design QA gate (**8.10**); Epic 9–10 surfaces; person-create dedupe; PopulationPort cutover; approval-panel select→picker consistency (optional)

## Tasks / Subtasks

- [x] Task 1: Surface inventory lock + shared wire-up conventions (AC: #1, #6)
  - [x] Treat the table in **Dev Notes → Remaining UUID inventory** as the mandatory checklist; mark each row done in the PR/story File List
  - [x] Convention (same as 8.4): import only from `@/components/entity-picker`; hold `EntityPickerValue | null` (or token list) in UI state; pass `.id` into existing apply/mutate helpers; empty optional filters stay “all”
  - [x] Labels: replace «شناسه …» / `placeholder="UUID…"` with business Persian («تیم»، «فرد»، «حساب»، …); update matching `operational-copy.ts` keys when the UI reads from there
  - [x] Also retrofit foreshadow analysis inputs that still demand UUID typing (`current-person-state-foreshadow` person; `historical-org-headcount-foreshadow` team) — they sit on the same FR57 surfaces as “historical team filters” / analysis tools; omit only if a surface is removed before this story lands
  - [x] Do **not** invent multi-select EntityPicker API: for multi-person disposal, accumulate `EntityPickerValue[]` as tokens (add via single picker + clear-per-token); submit `ids`

- [x] Task 2: Filters — dashboard / report / historical (AC: #1, #2)
  - [x] `dashboard-filters.tsx`: `teamId` Input → `createOrgUnitSearch()`; empty = all teams; preserve Jalali/as-of/trend apply contract
  - [x] `report-filters.tsx`: same org picker; keep report “team required for members report” semantics via existing hint — still resolve to UUID id when set. **Remove** the client `UUID_RE` gate on free-text team input (picker already yields a valid id; invalid typed UUID is no longer a path)
  - [x] `historical-org-headcount-foreshadow.tsx`: optional team → org picker
  - [x] `current-person-state-foreshadow.tsx`: person → `createPersonSearch()`; demote truncated `employment.id` / `teamMembership.teamId` `slice(0,8)` display to code+name or «شناسهٔ فنی»
  - [x] Note: `createOrgUnitSearch` today returns all unit types (no TEAM-only filter). Prefer selecting teams by code/name as operators do; do **not** invent a TEAM-only resolver unless product blocks on non-team units — if needed, thin filter in the search fn wrapper, not a new primitive

- [x] Task 3: Headcount exemption + override (AC: #1, #2)
  - [x] `exemption-panel.tsx`: person → `createPersonSearch()`; primary assignment → `createPrimaryAssignmentSearch(personId)` + `useEntityPickerCascade` (person parent); clear PA when person changes; payloads still `personId` + `primaryAssignmentId` UUIDs
  - [x] List/detail rows that show raw/truncated Primary or person ids → code+name (hydrate from list DTO if present; otherwise resolve once or show disclosure)
  - [x] `override-panel.tsx`: `teamFilter` → org picker; empty = unscoped list (preserve today’s `trim() || undefined`)

- [x] Task 4: Correction cases (AC: #1, #2, #3)
  - [x] Open-case `personId` → person picker; update `correctionCasePersonId` copy away from «شناسه فرد»
  - [x] Table primary identity: stop `personId.slice(0,8)…` — show personnel code + name (join from list payload or cheap authorized lookup); put UUID behind `TechnicalDetailDisclosure` in detail if needed
  - [x] Detail `ownerAccountId` raw dump → account code/label or disclosure
  - [x] Link target («شناسه هدف»): when `linkType` maps to a selectable business entity (person / hold / disposal run / etc.), use the matching picker; when the target is correlation-only (recalc id, opaque URI refs), use an explicitly labelled technical field + disclosure — never an unlabeled UUID box as the default “business” control

- [x] Task 5: Lifecycle scope + disposal persons (AC: #1, #2)
  - [x] `personnel-lifecycle-panel.tsx`: `scopeRef` depends on `scopeKind`:
    - `person` → person picker
    - `org_scope` → org picker
    - `artifact` / `element_category` → labelled technical input OK (no business resolver); still demote raw dumps in hold/run lists via disclosure where identity is UUID-shaped
  - [x] `disposePersonIdsRaw` comma-UUID string → multi-token person picker list; keep server `personIds: string[]` shape; update `lifecyclePersonId` / dispose hint copy
  - [x] Display `scopeKind:scopeRef` rows: when ref is a known entity, show code+name; else disclosure

- [x] Task 6: Audit investigation — picker default + raw support path (AC: #1, #4, #3)
  - [x] Actor filter: default `createAccountSearch()`; applied query still sends `actorAccountId` UUID
  - [x] Entity filter: default picker when `entityType` implies a resolvable entity (person/account/org); otherwise technical path. Leave `operation` / `entityType` / `correlationId` as non-entity text filters
  - [x] **Mandatory exception:** provide an explicit secondary control (e.g. collapsed «جستجو با شناسهٔ فنی» / toggle) that accepts raw actor/entity id for support — not the default focused field; Persian caption stating why
  - [x] Result table / detail: demote full UUID primary display to code+name when resolvable; otherwise keep behind disclosure / `{identifier}` typography — do not invent fake names
  - [x] **Preserve** existing leave-guard: `useLeaveGuardRegistration({ id: "audit-investigation-filters", isDirty: draft≠applied })` — picker state must participate in the same draft≠applied dirty snapshot
  - [x] Update `auditFilterActor` / `auditFilterEntityId` copy to business language for the default path

- [x] Task 7: Reconciliation + launch-artifact accounts (AC: #1, #2)
  - [x] `migration-reconciliation-workspace.tsx` disposition: `owner` + `independentApprover` → `createAccountSearch()` ×2; keep rationale/waiver text fields as free text; payloads still `ownerAccountId` / `waiver.independentApprover` UUID strings
  - [x] Update `reconOwnerPlaceholder` / `reconIndependentApproverPlaceholder` away from «شناسه حساب…»
  - [x] Preserve parent import-wizard dirty wiring (`onDirtyChange` / `reconDirty`) so leave-guard still fires while disposition drafts are open
  - [x] `launch-artifact-panel.tsx` account free-text → `createAccountSearch()` for **all** account-id fields on this panel in one pass:
    - `WaiverForm`: `owner` → `ownerAccountId`; `approver` → `independentApproverAccountId`
    - Rebaseline confirm: `independentApprover` → `independentApproverAccountId`
    - `ResolveConflictForm`: `joint` → `jointApproverAccountId`
  - [x] Leave non-account fields alone: artifact id, scope/risk text, `versions` comma-split resolution version ids (not account pickers)
  - [x] Prefer FormField / existing panel styling; do not regress control-contract ghost allowlist

- [x] Task 8: Selfcheck + regression DoD (AC: #5, #6, #7)
  - [x] Extend `entity-picker.selfcheck.ts`:
    - Assert each AC #1 surface file imports/uses `EntityPicker` (or documented allowlisted technical path for audit raw + lifecycle artifact scope)
    - Fail on remaining `placeholder="UUID` / legacy «شناسه تیم|فرد|…»+`Input` heuristics in those files
    - Keep 8.3 kit + 8.4 form asserts green
  - [x] Run: `pnpm --filter @divan/web selfcheck:entity-picker`, `selfcheck:layout-system`, `selfcheck:control-contract`, `typecheck`
  - [x] Smoke domain selfchecks for touched modules only if a payload shape accidentally changes (must not) — prefer web typecheck + entity-picker selfcheck
  - [x] Manual: dashboard empty team = all; report team-by-code; exemption person→PA cascade; audit default picker + raw technical path; recon/waiver account pick; keyboard on each picker; light/dark tokens
  - [x] Align story Status ↔ sprint-status when marking done

## Dev Notes

### Gate (non-negotiable)

- **Presentation only** — Epic 8 intro: no domain/permission/governance rule changes except unblocking unreachable governed selection UX.
- **Forward UX** is `ux-divan-2026-07-31`; spines win on conflict with mocks.
- **FR-57:** operators never type internal IDs for selectable entities on these surfaces.
- **FR-33 / FR-48:** pickers never reveal subjects the caller could not list — reuse 8.3 resolvers.
- **Payloads unchanged** — every apply/mutate still sends UUID strings the server already validates.
- **UI in `apps/web`** — no `@divan/ui` package; AD-6 Prisma gate unchanged.
- **8.4 boundary:** do not re-plumb `personnel-event-form` for new story scope.
- **8.6–8.10 boundary:** do not “fix” table min-width, row-action chrome, skeletons, or wholesale glossary while touching these panels.
- **PopulationPort honesty:** person/account pickers may return empty the same way lists do; do not fake production population.

### Remaining UUID inventory (UPDATE these)

| Surface | File | Field(s) today | Resolver / pattern |
| --- | --- | --- | --- |
| Dashboard team filter | `components/dashboard/dashboard-filters.tsx` | `teamId` Input; label «شناسه تیم (اختیاری)»; `placeholder="UUID — خالی = همه تیم‌ها"` | `createOrgUnitSearch()`; empty = all |
| Report team filter | `components/reports/report-filters.tsx` | same pattern; placeholder «برای اعضای تیم الزامی» | `createOrgUnitSearch()` |
| Historical org/HC | `components/organization/historical-org-headcount-foreshadow.tsx` | optional `teamId` UUID | org picker |
| Current person foreshadow | `components/personnel/current-person-state-foreshadow.tsx` | `personId` + `placeholder="UUID"`; truncated team id in result | person picker + demote display |
| Exemption | `components/headcount/exemption-panel.tsx` | `personId`, `primaryAssignmentId` free-text | person + PA cascade |
| Override | `components/headcount/override-panel.tsx` | `teamFilter` «شناسه تیم» | org picker |
| Correction cases | `components/correction-cases/correction-cases-panel.tsx` | open `personId`; link `linkTarget`; table `personId.slice(0,8)`; detail owner UUID | person; type-aware link; demote displays |
| Lifecycle | `components/personnel/personnel-lifecycle-panel.tsx` | `scopeRef`; `disposePersonIdsRaw` multi-UUID | kind-aware scope; multi-token persons |
| Audit | `components/audit/audit-investigation-panel.tsx` | `actorAccountId`, `entityId` Inputs; full UUID in table/detail; **leave-guard** draft≠applied | account/entity pickers **default**; raw ID secondary; keep leave-guard |
| Reconciliation | `components/import/migration-reconciliation-workspace.tsx` | disposition `owner`→`ownerAccountId`, `independentApprover`→waiver; parent `reconDirty` leave-guard | `createAccountSearch()` ×2 |
| Launch artifact | `components/operations/launch-artifact-panel.tsx` | WaiverForm owner/approver; rebaseline `independentApprover`; ResolveConflict `joint` | `createAccountSearch()` on each account field |

**Explicitly out of AC (do not expand):**

- `headcount/approval-panel.tsx` — already `<select>` with `nameFa (code)`; numeric/code Inputs are not UUID entity entry
- Server `z.string().uuid()` on tRPC — keep
- Event timeline / personnel list truncated **event** ids — full demotion may land with 8.9 if not blocking AC #1 inputs; if a touched panel still shows entity UUID as primary identity, demote it under AC #2
- `export-artifact-panel` recipient / custody flows — only touch if an account UUID free-text remains in the same PR surface; not listed in epic AC

### EntityPicker consumption contract (from 8.3/8.4 — obey)

- Import from `@/components/entity-picker` barrel only.
- Value: `{ id, code, labelFa, secondaryFa? } | null` — **`id` only for API**.
- Cascade: without parent → `disabled` + «ابتدا {parent} را انتخاب کنید.»; parent change clears child.
- Wire a11y: `aria-labelledby` / `aria-required` / `aria-invalid` / `aria-describedby` through EntityPicker props.
- Token clear = dismiss chrome, not gold primary.
- Do **not** invent a parallel combobox; do not use CommandDialog as the form picker.
- Optional create-on-empty on EntityPicker — **do not** wire QuickCreate / person-create dedupe (open Epic debt).

### Audit raw-ID exception (implement carefully)

```
Default UI: EntityPicker (account / resolvable entity)
Secondary:  collapsed control «جستجو با شناسهٔ فنی» → LTR Input + caption
Apply:      picker.id OR trimmed raw technical value → same query keys
Never:      raw Input as the only/default visible identifier field
```

### What must be preserved (end-to-end)

| Behavior | Where | Notes |
| --- | --- | --- |
| Empty team filter = all | dashboard / historical / override | Do not require a team |
| Report team semantics | report-filters + `reportTeamFilterHint` | Keep product “required for members” hints; drop free-text `UUID_RE` after picker |
| Exemption/override mutations | headcount routers | Same UUID fields |
| Audit search query shape | `api.audit.search` | Same optional filters |
| Audit filter leave-guard | `audit-investigation-panel` | draft≠applied registration must stay truthful with picker state |
| Recon disposition / leave-guard | migration workspace + import-wizard `reconDirty` | Same account id strings; dirty while drafts open |
| Launch account attestations | waiver + rebaseline + joint conflict | Same `*AccountId` mutation fields |
| Control-contract ghost allowlist | Story 8.1 | No new ghost toolbar buttons |
| 8.4 event form | personnel-event-form | Regression only if shared primitive breaks |

### Architecture compliance

- Stack pinned: Next.js 16.2.x, React 19, Tailwind v4, tRPC 11, Zod 3, cmdk, lucide-react — **do not upgrade casually**.
- Testing: `*.selfcheck.ts` + `pnpm --filter @divan/web selfcheck:*`.
- Personnel code is the domain address; UUID remains persistence/correlation id (ARCHITECTURE-SPINE) — UI demotes UUID, does not remove it from APIs.
- Errors stay domain-typed with Persian at API boundary — panels only map picker ids into existing calls.

### Project structure notes

| Action | Path |
| --- | --- |
| UPDATE | Each inventory file above |
| UPDATE | `apps/web/lib/operational-copy.ts` (identifier labels/placeholders for touched keys) |
| UPDATE | `apps/web/lib/entity-picker.selfcheck.ts` (8.5 surface + UUID-without-picker asserts) |
| REUSE | `apps/web/components/entity-picker/*` (no fork) |
| UPDATE | `_bmad-output/implementation-artifacts/sprint-status.yaml` when story moves |
| DO NOT TOUCH | Epic 4 module validation selfchecks (must stay green unmodified); authz matrices; event-store; 8.6 table CSS |

### Previous story intelligence (8.4)

- Ship was **wire-up**, not invention — same here across many files; prefer small consistent patches per surface.
- Review patches that still matter: cascade clear reason visibility; restore/hydrate races when holding EntityPickerValue; clipboard copy a11y on `TechnicalDetailDisclosure`; selfcheck heuristics beyond path allowlists.
- Unused hydrate helpers in `personnel-event-entity-helpers.ts` — may reuse for foreshadow/detail hydrate; do not delete in this story unless blocking.
- Mutation payloads must remain UUID — SCP regression risk is lower than 8.4 (event form) but still real for headcount/lifecycle/audit filters.
- Inverted 8.4 selfcheck must stay green while adding 8.5 asserts.

### Git intelligence

| Commit | Relevance |
| --- | --- |
| `d0b45e4` story 8.4 | Form wire-up + TechnicalDetailDisclosure + selfcheck invert — **baseline** |
| `07f2b28` story 8.3 | EntityPicker kit + resolvers — consume |
| `0b19c2a` / `81ace11` | Layout + control contract — do not regress |

### Latest tech notes

- WAI-ARIA APG Combobox remains the contract inside EntityPicker — surfaces must not replace it with Select/Dialog forks for entity identity.
- Multi-value person lists: token chip row + one add picker is enough; do not add a new dependency for multi-select.
- Audit dual-path UI: prefer `<details>` / existing disclosure patterns over a new modal.

### Epic 8 / carry-in open items (do not silently expand)

- PopulationPort cutover, AD-6 Prisma↔PoolClient, SoD splits, InferenceBulkPort ops, person-create dedupe, logout leave-guard, Cancel/Reverse/Correct person-org scope — **out of scope**.
- OQ-2 enumeration timing oracle — do not invent.
- Enforcement-matrix DoD (Epic 7 open) — N/A unless adding new authz consumers (this story must not).

### Testing requirements

- `pnpm --filter @divan/web selfcheck:entity-picker`
- `pnpm --filter @divan/web selfcheck:layout-system`
- `pnpm --filter @divan/web selfcheck:control-contract`
- `pnpm --filter @divan/web typecheck`
- Manual matrix: each inventory row once with code/Persian digits; audit raw path; empty optional filters; exemption cascade; waiver issue with two accounts

### Interactive a11y DoD (touched pickers)

- [x] Every replaced entity field uses EntityPicker combobox semantics (not native text UUID), except documented technical/raw paths
- [x] Keyboard-only path through filter apply / exemption create / audit search / waiver submit
- [x] Disabled dependents expose Persian reason to AT
- [x] Audit raw technical path is reachable by keyboard and labelled
- [x] Technical disclosure keyboard-operable; copy announced / focusable where used
- [x] Required/invalid wiring preserved

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8.5, Epic 8, UX-DR29]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-57, FR-33, FR-48]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — Identifier Model]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — entity-picker / technical-detail-disclosure]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — Story 8.5 row]
- [Source: `_bmad-output/implementation-artifacts/8-4-personnel-event-form-identifier-first-retrofit.md`]
- [Source: `_bmad-output/implementation-artifacts/8-3-entity-picker-primitive-code-resolvers.md`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md`]
- [Source: inventory files under `apps/web/components/{dashboard,reports,organization,personnel,headcount,correction-cases,audit,import,operations}/` + `lib/entity-picker.selfcheck.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- entity-picker / layout-system / control-contract selfchecks + web typecheck green after wire-up

### Completion Notes List

- Wired EntityPicker across all AC #1 inventory surfaces; payloads still send UUID `.id` strings.
- Audit: default account/entity pickers + collapsed «جستجو با شناسهٔ فنی» secondary path; leave-guard draft≠applied includes picker state.
- Lifecycle: kind-aware scope pickers; multi-person disposal via EntityToken list; artifact/element_category remain labelled technical inputs.
- Exemption: person → PA cascade; list Primary id demoted to TechnicalDetailDisclosure.
- Foreshadow/display: truncated UUID primary cells replaced with code+name or disclosure.
- Extended `entity-picker.selfcheck.ts` with 8.5 surface inventory + UUID-without-picker heuristics; 8.3/8.4 asserts remain green.
- Updated operational-copy labels away from «شناسه …» for touched keys.

### File List

- apps/web/components/entity-picker/resolvers.ts
- apps/web/components/entity-picker/index.ts
- apps/web/components/dashboard/dashboard-filters.tsx
- apps/web/components/reports/report-filters.tsx
- apps/web/components/organization/historical-org-headcount-foreshadow.tsx
- apps/web/components/personnel/current-person-state-foreshadow.tsx
- apps/web/components/headcount/exemption-panel.tsx
- apps/web/components/headcount/override-panel.tsx
- apps/web/components/correction-cases/correction-cases-panel.tsx
- apps/web/components/personnel/personnel-lifecycle-panel.tsx
- apps/web/components/audit/audit-investigation-panel.tsx
- apps/web/components/import/migration-reconciliation-workspace.tsx
- apps/web/components/operations/launch-artifact-panel.tsx
- apps/web/lib/operational-copy.ts
- apps/web/lib/entity-picker.selfcheck.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/8-5-remaining-uuid-inputs-retrofit.md
- _bmad-output/implementation-artifacts/deferred-work.md

### Change Log

- 2026-07-31: Story context created (ready-for-dev) — remaining UUID inputs retrofit guide across admin/analysis surfaces.
- 2026-07-31: Inventory follow-up — report `UUID_RE` removal, audit/recon leave-guards, launch rebaseline+joint account pickers, orgUnit TEAM-filter note.
- 2026-07-31: Implementation complete — EntityPicker wire-up on all inventory surfaces; selfcheck extended; status → review.
- 2026-07-31: Code review — Blind Hunter + Edge Case Hunter + Acceptance Auditor; findings triaged below.
- 2026-07-31: Review patches applied — hold/disposal pickers, identity demotion, state clears, loading/error UX; status → done.

### Review Findings

- [x] [Review][Patch] Hold/disposal_run link targets still free-text Input — Task 4 requires matching picker when linkType is hold/disposal_run [apps/web/components/correction-cases/correction-cases-panel.tsx:1066]
- [x] [Review][Patch] ScopeIdentity still shows artifact/element_category scopeRef as primary text — demote UUID-shaped refs behind TechnicalDetailDisclosure [apps/web/components/personnel/personnel-lifecycle-panel.tsx:79]
- [x] [Review][Patch] outcomeLinks render raw targetId as primary identity — use code+name when resolvable else disclosure [apps/web/components/correction-cases/correction-cases-panel.tsx:797]
- [x] [Review][Patch] entityTypeImpliesPicker uses substring includes — e.g. "impersonation" matches person; use exact/token match [apps/web/components/audit/audit-investigation-panel.tsx:116]
- [x] [Review][Patch] Changing linkType does not clear linkPerson/linkTarget — stale other-mode target can submit [apps/web/components/correction-cases/correction-cases-panel.tsx:1033]
- [x] [Review][Patch] Changing scopeKind does not clear disposePersons tokens — prior subjects apply under new kind [apps/web/components/personnel/personnel-lifecycle-panel.tsx:249]
- [x] [Review][Patch] Changing entityType clears entity picker but leaves entityTechnicalId — wrong-type technical id can apply [apps/web/components/audit/audit-investigation-panel.tsx:616]
- [x] [Review][Patch] AuditActorCell/AuditEntityCell fall through to TechnicalDetailDisclosure while hydrate queries are still loading [apps/web/components/audit/audit-investigation-panel.tsx:125]
- [x] [Review][Patch] Team label stuck on «در حال بارگذاری…» when organization.get errors or returns empty [apps/web/components/personnel/current-person-state-foreshadow.tsx:197]
- [x] [Review][Patch] Waiver/ResolveConflict submit silently returns when owner/approver/joint picker empty — show validation feedback [apps/web/components/operations/launch-artifact-panel.tsx:705]
- [x] [Review][Patch] dispose onSuccess does not clear disposePersons/reason/scope (place hold does) — repeat confirm can resubmit same subjects [apps/web/components/personnel/personnel-lifecycle-panel.tsx:149]
- [x] [Review][Patch] Dashboard/report team EntityPicker state not synced when parent value.teamId resets; synthetic «تیم فیلتر» lacks code+name [apps/web/components/dashboard/dashboard-filters.tsx:46]
- [x] [Review][Defer] Per-row person.getById / listEntitlements fan-out on correction + audit tables [apps/web/components/correction-cases/correction-cases-panel.tsx:35] — deferred, pre-existing
- [x] [Review][Defer] Account identity hydrate via accessAdmin.listEntitlements (admin-bound) — same constraint as 8.3 createAccountSearch [apps/web/components/audit/audit-investigation-panel.tsx:126] — deferred, pre-existing
