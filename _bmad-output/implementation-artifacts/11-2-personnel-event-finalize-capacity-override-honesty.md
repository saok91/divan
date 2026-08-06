---
baseline_commit: 238e365
---

# Story 11.2: Personnel-Event Finalize Path (Capacity + Override Honesty)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an HR operator,
I want Start Collaboration (and related events) to finalize when business preconditions and Override/exemption are correctly supplied,
so that UAT can record real personnel events (FR15, FR19, FR20, FR32).

**Story key:** `11-2-personnel-event-finalize-capacity-override-honesty`  
**Epic:** 11 — UAT Unblock & Operational UX Hardening  
**UX contract:** `ux-divan-2026-07-31` (SensitiveConfirmationDialog / ConflictList; FeedbackMessage; gold CTA + leave-guard; capacity panel foreshadow)  
**Architecture:** AD-6 sync finalize + capacity consume/reserve in same TX; AD-2/3 headcount ownership; AR-HEADCOUNT / FR-32 Override. No AD-1…AD-5 / AD-7 semantics change.  
**Authorized by:** `sprint-change-proposal-2026-08-07` (approved AtA)  
**Prerequisite:** Story **11.1** done — recalc not blocking the subject (`isGoldCtaBlocked` clear; worker reclaim path documented).  
**Downstream:** 11.3–11.7 are UX polish; this story unblocks **Start Collaboration → finalize** for UAT.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Domain finalize | `packages/modules/person-employment/src/personnel-event-finalize.ts` (`finalizeDraft`) | Full gate order: snapshot → classify → blocking → ack → override → resolve headcount override → risk → append + AD-6 hook | Rejected outcomes include rich `conflicts[]`; **tRPC drops them** |
| Conflict classify | `personnel-event-conflicts.ts` + `capacityResultToConflict` | Capacity port → `evaluateHeadcountCapacity`; shortage → `HEADCOUNT_UNAPPROVED` warning + `requiresOverride` | Envelope copy is generic; UI often never sees conflict list after reject |
| Matchers | `packages/modules/headcount/src/headcount-matching.ts` | `matchCompatibleApprovals` (`requireFree: true`) vs `matchApprovalsForOverride` (`requireFree: false`) | Correct Epic 4 rules — **preserve**; do not merge matchers |
| tRPC finalize | `apps/web/src/server/personnel-event.ts` | Session-bound override reason; `actorMayOverride = coarseRole === "hr_admin"`; then domain `headcount.override.write` | On reject: `throw new PersonnelEventError(code, messageFa)` — **no conflicts** |
| errorFormatter | `apps/web/src/server/trpc.ts` | Already surfaces `data.divanCode` from `PersonnelEventError.cause` | No `conflicts` / gate label in `data` |
| Form | `apps/web/components/personnel/personnel-event-form.tsx` | Evaluate on confirm; ConflictList from evaluate; override reason ≥3 chars; finalize mutation | Catch only sets `errorMsg` from `message`; does not refresh ConflictList from reject |
| Capacity panel | `headcount-capacity-panel.tsx` + `personnelEvent.headcountCapacity` | Foreshadow preferred approval | Preferred only reaches finalize if **saved on draft payload** |
| 11.1 stale | Banner + worker reclaim | Gold CTAs unblock when recalc clear | Assume cleared before testing capacity path; do not re-fix stale copy here |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Gate honesty ≠ weaken gates** | Name which gate failed (capacity / override / stale-snapshot / ack / blocking). Do **not** skip Override, free-capacity rules, or FR-32 permission. |
| **`HEADCOUNT_UNAPPROVED` ≠ «سامانه آماده نیست»** | Capacity shortage/mismatch emits `HEADCOUNT_UNAPPROVED` with matching Persian from headcount. Stub non-port consuming types still use `MSG_HEADCOUNT_CHECK_BLOCKED_FA` («هنوز آماده نیست») — do not present that as a real Start/Return capacity miss. |
| **`HEADCOUNT_CAPACITY_MISSING` is dormant** | Listed in ack allow-list / audit mentions but **never emitted** by `capacityResultToConflict`. Do not invent a new emit unless product explicitly renames; prefer honest copy on existing `HEADCOUNT_UNAPPROVED`. |
| **Exemption ≠ Override** | `evaluateHeadcountCapacity` outcome `exempt` → no consume, no Override path. UX must not demand Override reason when exempt. |
| **Compatible free>0 ≠ Override** | When an Active approval matches assignment facts **and** has free capacity, finalize must succeed **without** Override. Choosing that approval on the form must be enough (persisted). |
| **free≤0 + match dimensions = Override path** | Same dimensions, no free → `requiresOverride`; Admin + reason + `headcount.override.write` → `matchApprovalsForOverride` / resolve. |
| **preferredApprovalId must be on draft** | tRPC finalize input has **no** preferred field. UI selection that is not saved (or otherwise persisted before finalize) is invisible to domain — primary UAT false-conflict cause. |
| **Stale recalc (11.1) ≠ `FINALIZE_STALE_SNAPSHOT`** | Banner/`isGoldCtaBlocked` is platform recalc. `FINALIZE_STALE_SNAPSHOT` is client evaluation snapshot freshness inside finalize. Name them distinctly in Persian. |
| **Envelope message ≠ ConflictList** | Top-level `messageFa` may summarize the gate; detailed rows stay in `conflicts[]`. Both must reach the UI on reject. |
| **LG-complete honesty** | Epic 11 UAT unblock ≠ claiming LG-complete while Epic 7–10 production-honesty carry-ins remain open. |

## Acceptance Criteria

1. **Given** a Draft Start (or peer capacity-port event: Return / Transfer / JobTitle / Seniority) with required facts  
   **And** recalc is not blocking the subject (Story 11.1 precondition)  
   **When** a compatible **Active** headcount approval exists that matches assignment facts and has free capacity (or exemption applies)  
   **Then** Finalize succeeds **without** requiring Override  
   **And** choosing that approval on the form is sufficient when it is persisted for evaluate/finalize (auto-save before finalize **or** equivalent so preferred is not lost)

2. **And** when capacity is short / unmatched and Override is the correct path: an actor with `hr_admin` **and** `headcount.override.write` who supplies a valid Override reason can finalize; free may go negative and Override row/audit remains (FR-32) — existing start-return selfcheck semantics stay green

3. **And** when Finalize is rejected, the UI surfaces conflicts in Persian that **name the failing gate**, distinguishing at least:
   - **capacity** (no compatible approval / preferred incompatible / shortage needing Override)
   - **override** (Override required but missing reason, actor cannot override, or missing `headcount.override.write`)
   - **stale** (`FINALIZE_STALE_SNAPSHOT` and/or platform gold-CTA block — do not collapse into a generic «تعارض»)
   - other blocking/ack codes keep their existing Persian conflict messages

4. **And** no silent false conflict: if Override reason was accepted for the headcount gate but **another** gate still blocks (ack, blocking conflict, resolve failure, permission), the UI shows **that** gate’s conflicts/message — not a stale ConflictList from a prior evaluate that implies Override alone failed

5. **And** Epic Gate encodes held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - First-touch: FeedbackMessage (or existing form error region) for reject; ConflictList updated from server reject payload; EntityPicker / RowActionButton unchanged unless touched
   - AR-\* / FR-32 fail-closed; no freeze-number invention; no LG-complete claim
   - UTF-8 **without BOM** on `sprint-status.yaml` edits
   - Must **not** reopen Epics 1–10 status churn
   - Must **not** weaken `matchCompatibleApprovals` free gate or client-trust Override flags

6. **And** scope boundaries:
   - Does **not** rewrite Epic 4 capacity matching / consume / reserve algorithms
   - Does **not** change AD-6 TX finalize + projection hook semantics
   - Does **not** invent a parallel SoT for headcount outside `@divan/headcount`
   - Does **not** widen Override to `hr_operator` without permission (FR-32)
   - Does **not** own capacity drawer glossary / create-activate CTA (Story **11.6**)
   - Does **not** own Employment/Primary empty-state glossary (Story **11.7**)
   - Does **not** re-litigate 11.1 stale disclosure / «صف محاسبه» ban

## Tasks / Subtasks

- [x] Task 1: Propagate rejected finalize conflicts to the client (AC: #3, #4)
  - [x] UPDATE finalize path so reject does **not** discard `conflicts` (prefer extending existing patterns):
    - Option A (preferred minimal): extend `PersonnelEventError` (or a thin `FinalizeRejectedError`) with optional `conflicts` (+ maybe `finalizeCode`); throw that from `personnel-event.ts` when `result.outcome === "rejected"`; extend `errorFormatter` in `trpc.ts` to put `conflicts` (and keep `divanCode`) on `data`
    - Option B: return discriminated `{ outcome: "rejected", code, messageFa, conflicts, … }` from the mutation instead of throw — only if UI already handles it cleanly; do **not** invent a second parallel API
  - [x] Preserve: session-bound `approvedByAccountId`; `actorMayOverride` from session only; `mapPersonnelEventError` for true throws
  - [x] Prove with a source or router selfcheck that reject payload includes at least one conflict when domain returned conflicts

- [x] Task 2: Gate-honest Persian envelope + ConflictList refresh (AC: #3, #4)
  - [x] When building reject `messageFa`, prefer naming the gate from conflicts / code:
    - capacity-ish (`HEADCOUNT_UNAPPROVED`, port unavailable, matching messages) → capacity language
    - `FINALIZE_OVERRIDE_REQUIRED` / missing override write → Override language
    - `FINALIZE_STALE_SNAPSHOT` → کهنه بودن مرجع ارزیابی (distinct from platform recalc banner)
    - Keep conflict row `messageFa` as SoT for detail; envelope is summary, not a second invent
  - [x] UPDATE `personnel-event-form.tsx` `onFinalizeConfirm` catch (and/or success-reject branch):
    - `setConflicts` from server reject conflicts
    - `setErrorMsg` from gate-honest message
    - Keep confirm dialog open or reopen list so operator sees updated rows (no silent stale list)
  - [x] Optional small UX: `blockedReason` when `needsOverride && !overrideComplete`; ConflictList `key` stable (`code`+index) if duplicate codes break React
  - [x] Role honesty: if operator cannot Override, do not imply “enter reason and it will work” — show Override-required + Admin/permission next step (coarse `hr_admin` + `headcount.override.write` reality)

- [x] Task 3: Preferred capacity selection sufficient when match is real (AC: #1, #2)
  - [x] Diagnose UAT path: selecting approval in UI without draft save → evaluate/finalize ignore preferred → false `HEADCOUNT_UNAPPROVED` or wrong default match
  - [x] Fix minimally: before finalize (and before evaluate used for confirm), persist `preferredApprovalId` onto draft payload (auto `draftUpdate` when dirty preferred) **or** document+enforce “Save draft” with blocking copy — **prefer auto-persist** so AC “choosing capacity… is sufficient” holds
  - [x] When compatible free approval is preferred+persisted: finalize **without** Override (selfcheck)
  - [x] Do **not** change `requireFree: true` on the non-override matcher

- [x] Task 4: Override / exemption path honesty (AC: #2, #4)
  - [x] Verify exempt path: no Override reason demanded; finalize succeeds
  - [x] Verify Admin Override path still creates override evidence / negative free per FR-32 (existing selfcheck)
  - [x] When reason present but `resolveHeadcountOverrideOntoDraft` fails: rejected conflicts must include the resolve conflict (already domain) **and** reach UI (Task 1) — no “reason accepted” illusion
  - [x] Do not collapse override-permission failure into generic `FINALIZE_BLOCKED` without Override naming

- [x] Task 5: Selfchecks + design-qa (AC: #5)
  - [x] UPDATE/extend `personnel-event-start-return.selfcheck.ts` (or draft finalize selfcheck): preferred saved + free compatible → finalize without Override; reject path retains conflicts in returned domain shape (and router/formatter if testable without full Next)
  - [x] Keep `@divan/headcount` override/matching selfchecks green
  - [x] If new operational-copy keys: extend `operational-copy.selfcheck.ts`
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green
  - [x] Typecheck touched packages (`@divan/person-employment`, `@divan/web`, `@divan/headcount` if touched)

- [x] Task 6: DoD alignment (AC: #1–#6)
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; YAML UTF-8 without BOM
  - [x] Manual DoD below

### Manual DoD checklist

- [x] Worker running / no blocking stale (11.1) so gold Finalize is enabled
- [x] Start Collaboration draft with matching Active approval (free>0): select approval → finalize **without** Override → success
- [x] Same flow with free=0 / shortage: Operator sees capacity/Override-named Persian conflicts; cannot finalize without Admin Override
- [x] `hr.admin` with override write + reason ≥3: finalize succeeds; Override evidence / capacity honesty preserved
- [x] Reject after Override reason but other gate: ConflictList shows **current** server conflicts (not prior evaluate-only list)
- [x] `FINALIZE_STALE_SNAPSHOT` (if reproducible) named as evaluation-snapshot freshness — not «صف محاسبه» / not capacity
- [x] `selfcheck:design-qa` + person-employment start-return (and any new) selfchecks green
- [x] No LG-complete / AD semantic claims; Epics 1–10 remain `done`

### Review Findings

- [x] [Review][Decision] UI Override gate vs `headcount.override.write` — resolved: accept server reject + existing copy (option 3); session keeps coarseRole-only; `assertActorHasHeadcountOverrideWrite` remains SoT for FR-32 fine perm; no session permission expansion in 11.2.
- [x] [Review][Patch] Reject بدون `conflicts` ConflictList کهنه را نگه می‌دارد [apps/web/components/personnel/personnel-event-form.tsx:1164]
- [x] [Review][Patch] Envelopeی `FINALIZE_BLOCKED` با وجود blocking غیرظرفیت، پیام capacity را ترجیح می‌دهد [packages/modules/person-employment/src/errors.ts:597]
- [x] [Review][Patch] CTA نهایی‌سازی هنگام `ensurePreferredPersisted` قفل/busy نمی‌شود [apps/web/components/personnel/personnel-event-form.tsx:2201]
- [x] [Review][Patch] Session loading موقتاً Actor را غیرقابل-Override نشان می‌دهد [apps/web/components/personnel/personnel-event-form.tsx:253]
- [x] [Review][Patch] `ackCodes` هنگام reject جدید پاک نمی‌شود [apps/web/components/personnel/personnel-event-form.tsx:1164]
- [x] [Review][Patch] `errorMsg` زیر فرم و داخل دیالوگ تکرار می‌شود [apps/web/components/personnel/personnel-event-form.tsx:2153]
- [x] [Review][Patch] `matchedBy=manual` با `approvalId` خالی از چک reselect رد می‌شود [packages/modules/person-employment/src/personnel-event-finalize.ts:635]
- [x] [Review][Defer] ذخیرهٔ فقط-preferred وقتی بقیهٔ فرم dirty است — deferred, pre-existing [apps/web/components/personnel/personnel-event-form.tsx:1103]
- [x] [Review][Defer] سازندهٔ positional چهارمی `PersonnelEventError` شکننده است — deferred, pre-existing [packages/modules/person-employment/src/errors.ts:492]

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Rejected finalize exposes `conflicts[]` to UI | Drop conflicts at tRPC throw boundary |
| Persian names failing gate (capacity / override / stale) | Single generic «نهایی‌سازی به‌خاطر تعارض مسدود شد» as only signal |
| Preferred approval persisted before evaluate/finalize | Silent ignore of UI capacity selection |
| Compatible free match → finalize without Override | Force Override when free>0 match exists |
| FR-32: Override only Admin + `headcount.override.write` + reason | Client-trusted Override boolean or Operator-only Override |
| Keep matchCompatible vs matchForOverride free-gate split | Merge matchers / floor free at 0 |
| FeedbackMessage / ConflictList honesty on reject | Toast-only / stale ConflictList |
| `selfcheck:design-qa` green | Reopen Epic 4 ACs or Epic 1–10 status |

### Epic 11 / prior carry-ins in force

- Authorized by `sprint-change-proposal-2026-08-07` — do not reopen Epics 1–10
- **11.1 done:** role-honest stale disclosure; reclaim includes `stale`; SysAdmin `/operations#ops-recalc` — assume available for UAT
- Epic 10 open items (FeedbackMessage long-tail, typography, batched identity, PE/HC bulk honesty, settings cache, binder parity, AR fail-closed, production-honesty carry-forward) — **encode, do not resolve** unless blocking this story
- Epic 5/6/7 open: person-org scope on Cancel/Reverse/Correct — **out of scope** unless this story touches those mutations (it should not)
- Downstream **11.6** owns drawer intelligibility; **11.7** owns Employment/Primary empty-state copy

### UPDATE files — current → change → preserve

#### `apps/web/src/server/personnel-event.ts` (`finalize` mutation)

- **Current:** `if (result.outcome === "rejected") throw new PersonnelEventError(result.code, result.messageFa);` — conflicts discarded.
- **Change:** Throw/return shape that carries `conflicts` (+ gate-honest `messageFa` if refined); keep session binding for override.
- **Preserve:** `actorMayOverride` from `coarseRole === "hr_admin"`; server-bound `approvedByAccountId`; risk tiers product set; `mapPersonnelEventError`.

#### `apps/web/src/server/trpc.ts` (`errorFormatter`)

- **Current:** `data.divanCode` from PersonnelEventError cause.
- **Change:** Also expose `conflicts` (and optionally a small `finalizeGate` / keep relying on conflict codes) when present on cause — **do not** strip required tRPC `code`/`message` fields.
- **Preserve:** AUTHZ_CHANGED handling; superjson transformer; existing divanCode mapping.

#### `packages/modules/person-employment/src/errors.ts` (and/or finalize result mapping)

- **Current:** `PersonnelEventError` = `code` + `messageFa` only.
- **Change:** Optional `conflicts` (and maybe `details`) if using throw path; or leave domain result intact and only enrich at tRPC boundary.
- **Preserve:** Existing error codes and Persian constants; do not rename FR-32 codes casually.

#### `apps/web/components/personnel/personnel-event-form.tsx`

- **Current:** Evaluate→ConflictList; finalize catch → `setErrorMsg(message)` only; preferred in local state / draft payload on save.
- **Change:** Persist preferred before finalize/evaluate; on reject set conflicts from server; gate-honest error region; optional override `blockedReason`.
- **Preserve:** leave-guard dirty rules; SensitiveConfirmationDialog patterns; EntityPicker; gold CTA / `isGoldCtaBlocked`; strip client headcount override fields on draft write.

#### `packages/modules/person-employment/src/personnel-event-finalize.ts` / conflicts / matching

- **Current:** Domain already returns full conflicts on reject; override resolve adds conflict then `FINALIZE_BLOCKED`.
- **Change:** Only if envelope `messageFa` should be refined **in domain** for consistency (optional). Prefer presentation-layer honesty if domain messages already accurate on conflict rows.
- **Preserve:** Gate order; `resolveHeadcountOverrideOntoDraft`; audit `personnel_event.headcount_capacity_override`; AD-6 hook; strip client-trusted override fields.

#### Selfchecks

- **Current:** start-return covers Operator blocked / Admin Override; matching/override package checks.
- **Change:** Preferred+free success without Override; reject conflicts propagation assertion where feasible.
- **Preserve:** Existing FR-32 negative-free Override proof.

### Algorithm (implement literally)

```
1. Pre-finalize (UI):
   - If preferredApprovalId dirty vs draft → draftUpdate (or equivalent) so payload.preferredApprovalId is set
   - Respect leave-guard / version
   - If isGoldCtaBlocked → do not pretend capacity failed; platform stale owns the block (11.1)

2. finalizeDraft (domain — preserve order):
   - snapshot freshness → FINALIZE_STALE_SNAPSHOT
   - classifyConflicts → blocking → FINALIZE_BLOCKED
   - warning ack → FINALIZE_WARNING_ACK_REQUIRED
   - codesRequiringOverride:
       !actorMayOverride | bad reason/account → FINALIZE_OVERRIDE_REQUIRED
       HEADCOUNT_UNAPPROVED → assert headcount.override.write → resolveHeadcountOverrideOntoDraft
         resolve fail → FINALIZE_BLOCKED + conflict (must surface)
   - risk / append / audit / recalc schedule

3. tRPC reject:
   - MUST deliver { code, messageFa, conflicts[] } to client (formatter data or discriminated return)
   - messageFa names gate family; conflict.messageFa names detail

4. UI reject:
   - setConflicts(serverConflicts)
   - setErrorMsg(gateSummary)
   - Operator sees capacity vs override vs stale distinctly
```

### Architecture compliance

- **AD-6:** Critical finalize + capacity mutate stay sync in same TX; heavy recalc stays async. [Source: `ARCHITECTURE-SPINE.md` AD-6]
- **AD-2/3:** Headcount owned by `@divan/headcount`; PE calls ports — no parallel capacity SoT. [Source: spine module matrix]
- **FR-15 / FR-19 / FR-20 / FR-32:** Finalize checks conflicts + headcount; Persian consequences; Operator cannot consume without capacity; Override Admin+permission+reason+audit. [Source: `prd.md`]
- **Sprint change:** Ordered gates capacity → exemption/override → stale; UI names which failed. [Source: `sprint-change-proposal-2026-08-07.md` §4.3]

### Library / framework requirements

| Tech | Version / note | Use |
| --- | --- | --- |
| tRPC + superjson | existing monorepo | Prefer extend `errorFormatter` `data` (keep `code`/`message`); do not remove required shape fields |
| `PersonnelEventError` | `@divan/person-employment` | Extend carefully; cause must remain instanceof for divanCode |
| Next.js client form | existing | ConflictList + FeedbackMessage / form error region — no new toast channel for gate list |
| Headcount matchers | existing | Do not swap libraries; do not change free-gate defaults |
| Persian copy | conflict `messageFa` + optional operational-copy keys | No new i18n framework |

**tRPC note (current practice):** Custom fields belong under `errorFormatter` → `data` (project already uses `divanCode`). Declared-errors (newer tRPC) are optional and **not** required for this story — extend the existing formatter.

### File structure requirements

| Path | Action |
| --- | --- |
| `apps/web/src/server/personnel-event.ts` | UPDATE |
| `apps/web/src/server/trpc.ts` | UPDATE (formatter data) |
| `apps/web/components/personnel/personnel-event-form.tsx` | UPDATE |
| `packages/modules/person-employment/src/errors.ts` | UPDATE if throw carries conflicts |
| `packages/modules/person-employment/src/personnel-event-finalize.ts` | UPDATE only if envelope messageFa refined in domain |
| `packages/modules/person-employment/src/personnel-event-start-return.selfcheck.ts` | UPDATE |
| `apps/web/lib/operational-copy.ts` (+ selfcheck) | UPDATE only if new gate summary strings live there |
| `apps/web/components/personnel/sensitive-confirmation-dialog.tsx` | UPDATE only if ConflictList key / override blockedReason needs it |

Do **not** create a new finalize package or duplicate ConflictList.

### Testing requirements

| Check | Command / method |
| --- | --- |
| Start/Return capacity + Override | `pnpm --filter @divan/person-employment selfcheck:personnel-event-start-return` |
| Matching / Override catalogue | `@divan/headcount` matching + override selfchecks |
| Design QA | `pnpm --filter @divan/web selfcheck:design-qa` |
| Operational copy (if touched) | `pnpm --filter @divan/web selfcheck:operational-copy` |
| Manual | Manual DoD checklist above |

Prefer source-level selfchecks when ephemeral DB unavailable (Epic 10/11.1 pattern).

### Previous story intelligence

- **11.1:** Established Epic 11 Gate pattern (design-qa, BOM-safe yaml, no LG-complete, role-honest copy). Fixed stale reclaim set to include `stale`. Review patches: leave-guard for deep-links, session-loading role flash, hashchange scroll — apply similar care if adding Links/role checks on finalize UX.
- **11.1 explicitly deferred** capacity/override gate honesty to **this** story.
- **8.4 / 8.9:** Form identifier-first + operational copy; ConflictList already exists — wire reject into it, do not rebuild.
- **4.5 / 4.14:** Domain Override + exemption already proven in selfchecks — preserve; this story is honesty + preferred persistence + reject transport.

### Git intelligence summary

Recent: `238e365` story 11.1; `c0d5291` post epic 10; epic 10 settings track before that. Baseline for this story: **`238e365`**. PE finalize core last heavily touched in Epic 8 presentation stories — domain rules unchanged; focus on web transport + form persistence.

### Latest tech information

- tRPC: attach structured reject data via `errorFormatter` → `data` (already used for `divanCode`). Do not null out required `code`. Newer “declared errors” optional — not mandated.
- Do not upgrade tRPC/Next mid-story unless blocked.

### Project context reference

- No `project-context.md` found in repo at create time — follow this story + `ARCHITECTURE-SPINE.md` + 11.1 patterns.
- Communication with stakeholders: Persian UI strings; story file English.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 11 / Story 11.2]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md` — §§1, 4.3, success criteria]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-15, FR-19, FR-20, FR-32]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-6, headcount ownership]
- [Source: `_bmad-output/implementation-artifacts/11-1-stale-recalc-unblock-role-honest-next-steps.md` — prerequisite + Gate pattern]
- [Source: `packages/modules/person-employment/src/personnel-event-finalize.ts`]
- [Source: `apps/web/src/server/personnel-event.ts` — finalize reject throw]
- [Source: `apps/web/src/server/trpc.ts` — errorFormatter divanCode]
- [Source: `apps/web/components/personnel/personnel-event-form.tsx`]
- [Source: `packages/modules/headcount/src/headcount-matching.ts`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- start-return / matching / override / operational-copy / design-qa / tsc green

### Completion Notes List

- Extended `PersonnelEventError` with optional `conflicts` + `finalizeRejectEnvelopeMessageFa` for gate-honest Persian envelopes (capacity / override / stale).
- tRPC finalize reject now throws with conflicts; `errorFormatter` exposes `data.conflicts` alongside `divanCode`.
- Form auto-persists dirty `preferredApprovalId` before evaluate/finalize; reject path refreshes ConflictList from server payload (`rejectConflicts`) and keeps confirm open.
- Operator Override honesty: no reason field implying success; blockedReason names HR Admin + `headcount.override.write`.
- Choosing preferred that equals automatic default no longer requires `headcount.match.reselect` (real reselection still gated).
- Selfchecks: source transport gates + preferred free finalize without Override; FR-32 Admin Override retained.
- Code review patches: clear ConflictList on reject-without-conflicts; capacity envelope only when no non-capacity blocking; session-loading + preferred-persist busy gates; ack reset; single error FeedbackMessage; fail-closed reselect when manual approval id empty.

### File List

- `packages/modules/person-employment/src/errors.ts`
- `packages/modules/person-employment/src/index.ts`
- `packages/modules/person-employment/src/personnel-event-finalize.ts`
- `packages/modules/person-employment/src/personnel-event-start-return.selfcheck.ts`
- `apps/web/src/server/personnel-event.ts`
- `apps/web/src/server/trpc.ts`
- `apps/web/components/personnel/personnel-event-form.tsx`
- `apps/web/components/personnel/sensitive-confirmation-dialog.tsx`
- `apps/web/lib/operational-copy.ts`
- `apps/web/lib/operational-copy.selfcheck.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/11-2-personnel-event-finalize-capacity-override-honesty.md`

## Change Log

- 2026-08-07: Story 11.2 context created — finalize capacity/override honesty; reject conflicts transport; preferred persistence; gate-named Persian UX.
- 2026-08-07: Implemented Story 11.2 — reject conflicts transport + gate-honest UX; preferred auto-persist; Override role honesty; selfchecks/design-qa green; status → review.
- 2026-08-07: Code review patches applied; status → done.
