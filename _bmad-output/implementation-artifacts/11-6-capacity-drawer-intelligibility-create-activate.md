---
baseline_commit: cc92bcb
---

# Story 11.6: Capacity Drawer Intelligibility & Create Activate CTA

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator working headcount/capacity,
I want drawer fields explained in plain Persian and the option to activate on create,
so that I am not forced to decode opaque detail or hunt the table to activate a draft (FR28, FR59, UX-DR13, UX-DR34).

**Story key:** `11-6-capacity-drawer-intelligibility-create-activate`  
**Epic:** 11 — UAT Unblock & Operational UX Hardening  
**UX contract:** `ux-divan-2026-07-31` (UX-DR13, UX-DR34, UX-DR32/37 glossary) + **sprint-change-proposal-2026-08-07** §4.4–§4.5 (capacity drawer intelligibility + create «ثبت و فعال‌سازی»).  
**Architecture:** Presentation + thin orchestration in `apps/web` over **existing** `createApproval` + `activateApproval`. No domain matching/override algorithm changes. No AR-\* invention. FR-28 Draft non-consumable until Active held.  
**Authorized by:** `sprint-change-proposal-2026-08-07` (approved AtA)  
**Prerequisite:** Story **9.4** shipped capacity IA (table + create form + record-drawer). Stories **11.4** (`FieldHelpIcon` / `LabelWithHelp`) and **11.5** (`FormSurfaceHost` on create) done — reuse; do not retouch form chrome or FieldHelp placement.  
**Downstream:** **11.7** Employment / Primary empty-state honesty. Do not bleed into that.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Record drawer | `apps/web/components/headcount/headcount-approval-record-drawer.tsx` | Sheet `side=right`, `--drawer-width`, Escape + focus return; header shows `status · مصوب N · آزاد N`; sections: معافیت‌ها / بازنویسی‌ها / تاریخی | Header omits used/reserved; no glossary tips for lifecycle/quantity terms; stakeholder cannot decode opaque capacity detail |
| Create form | `apps/web/components/headcount/headcount-approval-create-form.tsx` | FormLayout + EntityPicker + Jalali + leave-guard; **only** `createApproval` → always draft; copy: «فعال‌سازی از فهرست هدکانت انجام می‌شود.»; CTA «ایجاد پیش‌نویس» | No «ثبت و فعال‌سازی»; forces table scavenger hunt (UAT evidence #9) |
| Table activate | `apps/web/components/headcount/headcount-approvals-table.tsx` | Row action «فعال‌سازی» → `api.headcount.activateApproval` for `status === "draft"` | Keep as secondary path; create must also activate without leaving flow |
| Domain APIs | `packages/modules/headcount` + `apps/web/src/server/headcount.ts` | `createApproval` always inserts `status='draft'`; `activateApproval` draft→active (+ slot) in TX; both gated by `assertActorHasHeadcountApprovalWrite` | **No new API required** — orchestrate create then activate on client (or thin wrapper that still calls both domain ops). Never INSERT as active |
| UX-DR13 panel | `apps/web/components/personnel/headcount-capacity-panel.tsx` | Plain labels: مصرف‌شده / رزرو / آزاد / معاف / لغو محدودیت | Vocabulary authority for drawer quantity labels — align drawer language with this panel |
| Glossary | `apps/web/lib/ui-glossary.ts` + `GlossaryTerm` | Has `headcount`, `reservation`; operator disclosure pattern (≠ TechnicalDetailDisclosure) | Missing used / free / exempt / override / approved-count / approval-lifecycle tips |
| Field help (11.4) | `form-layout/field-help.tsx` | Label-adjacent `FieldHelpIcon` / `LabelWithHelp` | Use for short operational tip on a control; domain definitions → `GlossaryTerm` / `uiGlossary` — **do not conflate** |
| Form surface (11.5) | create page + `FormSurfaceHost` | Create tab already on content `surface` plane; FormFooter `bg-surface` | Preserve — add CTAs inside existing FormFooter; do not reopen chrome |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Drawer intelligibility ≠ form surface (11.5)** | Do not retouch FormSurfaceHost / Panel chrome. Own labels/glossary in drawer (+ optional compact tips). |
| **GlossaryTerm ≠ FieldHelpIcon ≠ TechnicalDetailDisclosure** | Domain term definition → `GlossaryTerm` / `uiGlossary`. Short how-to tip on a control → FieldHelp. UUID/technical id → TechnicalDetailDisclosure already in drawer. |
| **Exemption ≠ Override (11.2)** | معافیت ≠ بازنویسی / لغو محدودیت. Drawer already separates sections — keep copy honest; glossary must not blur them. |
| **مصوب / مصرف / رزرو / آزاد** | Align with table columns + UX-DR13 panel wording. Prefer **مصرف‌شده** (panel) over bare «مصرف» in drawer tips when space allows. |
| **ثبت پیش‌نویس ≠ ثبت و فعال‌سازی** | Draft path = `createApproval` only. Activate-on-create = `createApproval` **then** `activateApproval(id)` — never create with `status=active`. |
| **Permission** | Create and activate both require `headcount.approval.write` today (`assertActorHasHeadcountApprovalWrite`). AC «create permission includes activate» = same write gate — when actor can create, show both CTAs. Do **not** invent a separate activate permission set. Fail-closed: if write assert fails server-side, surface error honestly. |
| **FR-28** | Draft / Cancelled / Expired cannot accept new consumption or Reservation until Active. Activate-on-create must leave Draft non-consumable if activate fails mid-flow (draft may remain — honest success/error copy). |
| **Table activate stays** | Do not remove row-action activate; remove the **forced** scavenger-hunt copy from create. |
| **Override create in drawer** | Still out of scope (9.4): list + void only — do not invent «ثبت بازنویسی» CTA. |
| **LG-complete honesty** | Epic 11 UAT polish ≠ claiming LG-complete while Epic 7–10 carry-ins remain open. |

## Acceptance Criteria

1. **Given** the capacity/headcount record drawer  
   **When** I open a row  
   **Then** lifecycle and quantity fields (used / reserved / free / exempt / override as applicable) have plain-language labels **or** glossary tips  
   **And** quantities visible in the drawer chrome include at least مصوب (allowed), مصرف‌شده (used), رزرو (reserved), آزاد (free) — not only مصوب+آزاد  
   **And** معافیت / بازنویسی sections remain labeled in plain Persian with a one-line consequence tip or glossary entry so stakeholder need not decode architecture docs

2. **Given** the actor has headcount approval write (create path available)  
   **When** I submit a new approval from «ایجاد»  
   **Then** I can choose «ثبت پیش‌نویس» **or** «ثبت و فعال‌سازی» without leaving the create flow  
   **And** «ثبت و فعال‌سازی» calls existing `createApproval` then `activateApproval` with the returned id (Draft never inserted as Active)  
   **And** success/error copy is honest (draft-only success vs activated success; activate failure after create does not claim Active)

3. **And** Draft remains non-consumable until Active (FR28) — domain selfcheck / matching behavior unchanged; no client-side fake Active

4. **And** create header/helper copy no longer tells the operator that activation is **only** from the headcount list (remove scavenger-hunt mandate). Table row activate may remain as an alternate path.

5. **And** Epic Gate encodes held:
   - Reuse existing tRPC mutations — no parallel SoT; no Prisma in web; no matching/override algorithm edits
   - First-touch: `GlossaryTerm` / `uiGlossary`, `FieldHelpIcon` only if needed, `FormLayout`/`FormFooter`/`FormSurfaceHost`, `FeedbackMessage`, existing Sheet drawer
   - AR-\* / FR-28 / FR-59 fail-closed — do not invent permissions or consumable Draft
   - UTF-8 **without BOM** on `sprint-status.yaml` edits
   - Must **not** reopen Epics 1–10 status churn
   - Must **not** claim LG-complete
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - Extend `selfcheck:headcount-ia` for glossary/quantity chrome + create activate CTA

6. **And** scope boundaries:
   - Does **not** change FormSurfaceHost / FormFooter token chrome (**11.5** done)
   - Does **not** change FieldHelp primitive chrome (**11.4** done) except consuming it
   - Does **not** own Employment / Primary empty-state copy (**11.7**)
   - Does **not** change PE finalize / capacity-panel matching (**11.2** done)
   - Does **not** restack exemption/override/historical panels onto `/headcount/capacity`
   - Does **not** add override-create UI in the drawer
   - Does **not** add new npm packages or Vitest runners

## Tasks / Subtasks

- [x] Task 1: Drawer quantity + lifecycle intelligibility (AC: #1, #5)
  - [x] UPDATE `headcount-approval-record-drawer.tsx` header/description (and/or a compact summary strip under header) to show **مصوب / مصرف‌شده / رزرو / آزاد** with `toPersianDigits` + `text-tabular` (row already has `allowedCount`, `used`, `reserved`, `free`)
  - [x] Add plain-language tips via `GlossaryTerm` (preferred for domain terms) and/or short caption — wire new keys in `ui-glossary.ts`
  - [x] Ensure معافیت‌ها / بازنویسی‌ها section titles + existing captions stay intelligible; add glossary keys for exempt / override if missing; align override label with UX-DR13 «لغو محدودیت» vs section «بازنویسی‌ها» honesty (do not rename domain APIs — clarify in tip)
  - [x] Preserve: Sheet a11y (Escape, focus return), Panel sections, exemption form EntityPicker, no fake approval↔exemption FK copy, TechnicalDetailDisclosure for UUIDs
  - [x] Do **not** remove table column headers; optional tiny GlossaryTerm near table headers is nice-to-have only if cheap — drawer is mandatory AC surface

- [x] Task 2: Create dual CTA — draft vs activate (AC: #2, #3, #4)
  - [x] UPDATE `headcount-approval-create-form.tsx`:
    - Replace scavenger-hunt helper copy with purpose/state/next-step honest copy (draft optional; activate available here when write works)
    - FormFooter actions: Cancel (ghost) · **ثبت پیش‌نویس** (secondary or default draft) · **ثبت و فعال‌سازی** (primary) — follow existing FormFooter order conventions (destructive/ghost left; primary once)
    - Shared validation path; branch on which submit intent was chosen
    - Draft path: `createApproval` only → success «پیش‌نویس…»
    - Activate path: `createApproval` → on success `activateApproval({ id })` → success «مجوز فعال شد…»; if activate fails, show error that draft was created but not activated (offer navigate to list / retry honesty — do not claim Active)
  - [x] Busy/disable both CTAs while either mutation pending; `disabledReason` via `operationalCopy.actionPending`
  - [x] Preserve leave-guard dirty registration + `requestNavigation` for انصراف
  - [x] Preserve `FormSurfaceHost` page wrap — do not nest Panel

- [x] Task 3: Glossary + copy assets (AC: #1, #4)
  - [x] Extend `apps/web/lib/ui-glossary.ts` with capacity quantity / lifecycle entries (Persian definitions operator-facing). Suggested keys (names flexible — keep `as const satisfies`):
    - approved/مصوب (allowed count)
    - used / reserved / free (align definitions with FR-28 + reservation glossary)
    - exemption / override (Exemption ≠ Override)
    - approval status draft vs active consequence (non-consumable until Active)
  - [x] Prefer reusing existing `reservation` + `headcount` entries; extend rather than duplicate conflicting definitions
  - [x] If new operational strings land in `operational-copy.ts`, extend `operational-copy.selfcheck` only if that package’s pattern requires it

- [x] Task 4: Selfchecks + design-qa (AC: #5)
  - [x] Extend `headcount-ia.selfcheck.ts` source asserts, e.g.:
    - drawer source mentions مصرف‌شده|used and رزرو|reserved (not only مصوب+آزاد)
    - create form mentions `activateApproval` and CTA string `ثبت و فعال‌سازی` (or documented equivalent)
    - create form does **not** mandate activation-only-from-list copy (`فعال‌سازی از فهرست`)
    - still asserts FormSurfaceHost / FormLayout / EntityPicker / FeedbackMessage / drawer a11y contracts from 9.4/11.5
  - [x] Run `pnpm --filter @divan/web selfcheck:design-qa`
  - [x] Run `pnpm --filter @divan/web selfcheck:headcount-ia` (or via design-qa matrix if already included)
  - [x] If touching glossary only lightly, confirm design-qa mockup matrix «Headcount + drawer» note still honest (update note if copy/glossary changed — do not flip Result without evidence)
  - [x] Typecheck `@divan/web` for touched files
  - [x] Optional: `@divan/headcount` approval lifecycle selfcheck still green if domain untouched (should be no domain edit)

- [x] Task 5: DoD alignment (AC: #1–#6)
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; YAML UTF-8 without BOM
  - [x] Manual DoD below

### Manual DoD checklist

- [x] Open headcount capacity row → drawer shows مصوب / مصرف‌شده / رزرو / آزاد with Persian digits; tips/glossary make terms intelligible without asking a developer
- [x] معافیت vs بازنویسی remain distinct; no invented override-create button
- [x] Create tab: «ثبت پیش‌نویس» creates Draft only; list still shows draft; cannot consume until Active
- [x] Create tab: «ثبت و فعال‌سازی» ends Active (or honest partial failure if activate fails after create)
- [x] Helper copy no longer says activation is only from the list
- [x] Table row «فعال‌سازی» still works for leftover drafts
- [x] Form surface (11.5) and FieldHelp (11.4) unchanged in behavior
- [x] Escape closes drawer; focus returns to trigger
- [x] Dark theme: tokens only; no new hex
- [x] `selfcheck:design-qa` green; Epics 1–10 remain `done`; no LG-complete claim

### Review Findings

- [x] [Review][Patch] Partial-activate: keep fields + in-form retry [`apps/web/components/headcount/headcount-approval-create-form.tsx:192`] — decided: on activate failure after create, do not `clearFields()`; retain `created.id` and offer «تلاش مجدد فعال‌سازی»; keep list nav as alternate (spec «retry honesty»)
- [x] [Review][Patch] Guard dual-CTA against inter-mutation re-submit [`apps/web/components/headcount/headcount-approval-create-form.tsx:226`] — `submitDisabled` uses mutation `isPending` only; gap between create resolve and activate start can re-enable buttons while `pendingIntent` is still set
- [x] [Review][Patch] Isolate list invalidate from success/error UI [`apps/web/components/headcount/headcount-approval-create-form.tsx:182`] — `listApprovals.invalidate()` throw after create/activate success falls into outer catch and mislabels as create failure / clears `offerListNav`
- [x] [Review][Patch] Honest pending label for activate intent [`apps/web/components/headcount/headcount-approval-create-form.tsx:369`] — shows «در حال فعال‌سازی…» while `createApproval` is still running; drive label from `createMutation.isPending` vs `activateMutation.isPending`
- [x] [Review][Patch] Avoid duplicating quantity chrome in SheetDescription [`apps/web/components/headcount/headcount-approval-record-drawer.tsx:315`] — visible description repeats the same مصوب/مصرف‌شده/رزرو/آزاد as the `<dl>`; keep status (or sr-only) and leave quantities on the summary strip
- [x] [Review][Patch] Clear `offerListNav` when re-validating [`apps/web/components/headcount/headcount-approval-create-form.tsx:129`] — `validate()` clears success/error but leaves prior list-nav CTA if a later invalid submit fails
- [x] [Review][Patch] Tighten drawer quantity selfcheck [`apps/web/components/headcount/headcount-ia.selfcheck.ts:123`] — require `مصرف‌شده` (not bare `/used/i` which matches pre-existing `exclude_from_used`)
- [x] [Review][Patch] Assert new 11.6 glossary keys exist [`apps/web/lib/operational-copy.selfcheck.ts`] — raising the key-count ceiling alone does not lock `headcountApproved` / `headcountUsed` / `headcountFree` / `headcountExemption` / `headcountOverride` / `headcountApprovalLifecycle`
- [x] [Review][Defer] Table column still «مصرف» while drawer uses «مصرف‌شده» [`apps/web/components/headcount/headcount-approvals-table.tsx:90`] — deferred, pre-existing table header; story scoped drawer to UX-DR13 panel wording
- [x] [Review][Defer] Create form label «سقف مجاز» vs glossary «مصوب» [`apps/web/components/headcount/headcount-approval-create-form.tsx:287`] — deferred, pre-existing create-field vocabulary from 9.4

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Plain Persian labels/glossary on drawer quantities + lifecycle | Leave header as opaque «مصوب · آزاد» only |
| Dual CTA on create without leaving flow | Force table scavenger hunt for activate |
| `createApproval` then `activateApproval` | INSERT Active; new domain status path; weaken FR-28 |
| Reuse write authz + existing mutations | Invent activate-only permission; client-trust Active |
| Extend `headcount-ia` + `design-qa` green | Reopen Epics 1–10 or claim LG-complete |
| Preserve FormSurfaceHost / FieldHelp / leave-guard | Retouch 11.4/11.5 chrome; drop dirty guard |

### Epic 11 / prior carry-ins in force

- Authorized by `sprint-change-proposal-2026-08-07` — do not reopen Epics 1–10
- **11.1–11.5 done:** stale honesty, finalize path, Jalali chrome, compact field help, form surface
- Epic 10 open items (FeedbackMessage long-tail, typography, batched identity, PE/HC bulk honesty, settings cache, binder parity, AR fail-closed, production-honesty carry-forward) — **encode, do not resolve**
- Downstream **11.7** — out of scope
- UAT evidence #8 (drawer unintelligible) + #9 (draft-only create) — this story closes them

### UPDATE files — current → change → preserve

#### `apps/web/components/headcount/headcount-approval-record-drawer.tsx` (primary — intelligibility)

- **Current:** `SheetDescription` = `{status} · مصوب {allowedCount} · آزاد {free}` only. No used/reserved. Section captions exist for exemptions FK honesty; no quantity glossary.
- **Change:** Surface used/reserved/free/allowed (+ status) with plain labels; attach `GlossaryTerm` / short tips for lifecycle + quantities + exempt/override concepts.
- **Preserve:** Sheet side/width/focus; PanelSection structure; exemption create/activate/revoke; override list+void only; historical foreshadow; FeedbackMessage; EntityPicker cascades; status pills.

#### `apps/web/components/headcount/headcount-approval-create-form.tsx` (primary — activate CTA)

- **Current:** Single submit → `createApproval`; helper «فعال‌سازی از فهرست…»; footer Cancel + «ایجاد پیش‌نویس» (+ optional بازگشت).
- **Change:** Dual submit intents; helper rewrite; wire `activateApproval` after create when chosen; honest FeedbackMessage for both outcomes / partial failure.
- **Preserve:** Validation rules; TEAM-only EntityPicker filter; Jalali validity; leave-guard; FormLayout/FormFooter; FormSurfaceHost parent; no nested Panel.

#### `apps/web/lib/ui-glossary.ts` (+ `GlossaryTerm` consumers)

- **Current:** `headcount`, `reservation` present; no used/free/exempt/override/مصوب.
- **Change:** Add operator definitions; consume from drawer (and optionally create helper).
- **Preserve:** Existing entry wording unless correcting a real conflict; never mix with TechnicalDetailDisclosure.

#### `apps/web/components/headcount/headcount-approvals-table.tsx` (verify only)

- **Current:** Row activate / cancel; opens drawer; columns مصوب/مصرف/رزرو/آزاد.
- **Change:** None required for AC. Optional glossary on headers is non-blocking.
- **Preserve:** Row activate path; GovernedDataTable; toolbar create → `/headcount/create`.

#### `apps/web/src/server/headcount.ts` / `@divan/headcount`

- **Change:** Prefer **none**. Only touch if a documented thin server helper for create+activate-in-one-procedure is clearly better — still must call existing domain `createApproval` + `activateApproval` and preserve FR-28. Default recommendation: **client orchestration** of two existing mutations (simpler, matches table activate).
- **Preserve:** Authz asserts, error mapping, matching, override, exemption schemas.

#### `apps/web/components/headcount/headcount-ia.selfcheck.ts`

- **Change:** Assert drawer quantity chrome + create activate CTA + absence of scavenger-only copy.
- **Preserve:** Capacity no-stack panels; FormSurfaceHost; EntityPicker; drawer a11y asserts.

### Recommended create+activate flow

```text
validate fields (shared)
  ├─ intent = draft  → createApproval → success draft copy → invalidate list
  └─ intent = activate
        → createApproval
        → if fail: error (no draft claim)
        → if ok: activateApproval({ id })
              → if fail: error «پیش‌نویس ثبت شد اما فعال‌سازی نشد…» + invalidate
              → if ok: success Active copy + invalidate
```

Primary button once for activate intent; draft as secondary/outline sibling — match PE FormFooter discipline (one gold primary).

### Vocabulary alignment (must)

| Concept | Operator Persian (align) | Source |
| --- | --- | --- |
| allowed / approved | مصوب | table + mockup + drawer today |
| used | مصرف‌شده | UX-DR13 panel |
| reserved | رزرو | table + `uiGlossary.reservation` |
| free | آزاد | table + panel |
| exempt | معاف / معافیت | panel «معاف» + drawer section |
| override | لغو محدودیت (panel) / بازنویسی‌ها (section) | tip must explain equivalence — do not silently rename APIs |
| draft | پیش‌نویس | status map |
| active | فعال | status map |

### Library / framework requirements

| Lib | Rule |
| --- | --- |
| Existing tRPC `api.headcount.*` | Reuse create + activate; no parallel fetch SoT |
| `GlossaryTerm` / `ui-glossary` | Domain definitions |
| `FieldHelpIcon` / `LabelWithHelp` | Optional short tips — icon sibling outside `<label>` (11.4 review) |
| `FormSurfaceHost` / FormLayout / FormFooter | Preserve 11.5 plane |
| `FeedbackMessage` | Errors/success/empty — no StatusMessage clones |
| `toPersianDigits` + `text-tabular` | Quantity display |
| No new npm packages | — |

### File structure requirements

- Touch primarily: `headcount-approval-record-drawer.tsx`, `headcount-approval-create-form.tsx`, `ui-glossary.ts`, `headcount-ia.selfcheck.ts`; light verify table + create page
- Do **not** add parallel capacity drawer under `packages/`
- Do **not** add CSS modules solely for glossary chrome
- Story + sprint-status only under `_bmad-output/implementation-artifacts/`

### Testing requirements

- Mandatory: `pnpm --filter @divan/web selfcheck:design-qa`
- Extend `selfcheck:headcount-ia` for this story’s contracts
- Manual DoD (drawer intelligibility + both create CTAs + table activate still works)
- No Vitest mandate; do not invent a new test runner
- Domain package selfcheck only if domain files touched (prefer not)

### Previous story intelligence

#### From 11.5 (immediate precursor)

- Create already wrapped in `FormSurfaceHost` — put CTAs in existing FormFooter; do not invent a second shell
- Presentation pattern: Gate table, BOM-safe YAML, `design-qa` mandatory, explicit sibling non-goals
- Review culture: source selfchecks > brittle DOM snapshots; small patches after review
- 11.5 explicitly deferred drawer glossary + activate CTA to **this** story

#### From 11.4

- `FieldHelpIcon` outside `<label>`; Glossary ≠ FieldHelp ≠ UUID disclosure
- Empty content guard on help; ghost allowlist if touching Button variants

#### From 11.2

- Exemption ≠ Override; FR-32 / override write unchanged; capacity panel labels are vocabulary authority
- Drawer glossary / create-activate were **explicitly deferred** here — do not reopen finalize envelope

#### From 9.4

- IA: one table on capacity; drawer hosts exemptions/overrides/historical; create is draft-first historically — this story adds activate-on-create without undoing IA

### Git intelligence

- Recent: `cc92bcb` story 11.5 · `75dbe10` story 11.4 · `8785f3e` story 11.3 · `bcfda5d` story 11.2 · `238e365` story 11.1
- Pattern: extend shared primitives + selfcheck asserts; presentation-first Epic 11; reuse mutations
- Headcount create page + FormSurfaceHost already in 11.5 file list — build on that baseline (`cc92bcb`)

### Latest tech notes

- No new date/UI libraries — Jalali picker already on create/drawer from 11.3
- Client-side sequential mutations are fine; if both succeed, invalidate `listApprovals` once at end (or after each — avoid flicker if easy)
- Partial failure (create ok, activate fail) is an expected edge — copy must not lie; draft row will appear on list for table activate retry
- `createApproval` returns `HeadcountApprovalRecord` including `id` — use it; do not re-list to find the row

### Project context reference

- No `project-context.md` found in repo at story creation time — follow Epic 11 gates + UX 2026-07-31 / FR-28 / FR-59 / proposal §4.4–4.5 + this file.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 11, Story 11.6, UX-DR13, UX-DR34, FR28, FR59]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md` — Evidence #8–#9, §4.1/§4.4/§4.5, success #5]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — record-drawer 480px]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — self-explaining state; never make operator infer]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/screens-reports-capacity.html`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2/3/5/6; apps/web boundary]
- [Source: `_bmad-output/implementation-artifacts/11-5-form-surface-alignment-ux-2026-07-31.md`]
- [Source: `_bmad-output/implementation-artifacts/11-4-compact-field-help-label-info-icon.md`]
- [Source: `_bmad-output/implementation-artifacts/11-2-personnel-event-finalize-capacity-override-honesty.md`]
- [Source: `_bmad-output/implementation-artifacts/9-4-capacity-hiring-ia-restructure.md`]
- [Source: `apps/web/components/headcount/headcount-approval-record-drawer.tsx`]
- [Source: `apps/web/components/headcount/headcount-approval-create-form.tsx`]
- [Source: `apps/web/components/personnel/headcount-capacity-panel.tsx`]
- [Source: `apps/web/src/server/headcount.ts` — createApproval / activateApproval]
- [Source: `packages/modules/headcount/src/headcount-approval.ts` — draft insert; activate from draft only]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Raised `uiGlossary` key cap in `operational-copy.selfcheck` (15 → 22) after Story 11.6 capacity vocabulary entries; design-qa then green.

### Completion Notes List

- Drawer header/description now surfaces مصوب / مصرف‌شده / رزرو / آزاد (Persian digits + tabular) plus GlossaryTerm tips for lifecycle and quantities.
- معافیت / بازنویسی sections keep distinct captions; glossary entries clarify Exemption ≠ Override and «لغو محدودیت» equivalence; no override-create CTA.
- Create form dual CTA: «ثبت پیش‌نویس» (`createApproval` only) and «ثبت و فعال‌سازی» (`createApproval` then `activateApproval`); honest partial-failure copy + list nav offer; scavenger-hunt mandate removed.
- Client orchestration only — no domain/API status-path changes; FR-28 held.
- Extended `headcount-ia.selfcheck` + mockup matrix note; `selfcheck:design-qa` and `tsc --noEmit` green.

### File List

- `apps/web/components/headcount/headcount-approval-record-drawer.tsx`
- `apps/web/components/headcount/headcount-approval-create-form.tsx`
- `apps/web/lib/ui-glossary.ts`
- `apps/web/components/headcount/headcount-ia.selfcheck.ts`
- `apps/web/lib/operational-copy.selfcheck.ts`
- `apps/web/lib/design-qa-mockup-matrix.md`
- `_bmad-output/implementation-artifacts/11-6-capacity-drawer-intelligibility-create-activate.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-08-07: Story context created (ready-for-dev) — ultimate context engine analysis completed; comprehensive developer guide created.
- 2026-08-07: Implemented drawer intelligibility + create activate dual CTA; selfchecks green; status → review.
- 2026-08-07: Code review — 8 patches applied (partial-activate retry, submit guard, invalidate isolation, pending labels, SheetDescription, offerListNav, selfchecks); 2 deferred; status → done.
