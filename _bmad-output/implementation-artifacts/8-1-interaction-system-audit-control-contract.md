---
baseline_commit: 58f85d6
---

# Story 8.1: Interaction System Audit & Control Contract

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a developer working across Divan surfaces,
I want a published mapping from action semantics to control appearance, enforced in code,
so that the same kind of action looks and behaves the same on every surface (UX-DR30, FR58).

**Story key:** `8-1-interaction-system-audit-control-contract`  
**Epic:** 8 — Experience Foundation & Identifier Ergonomics (FR57, FR58; FR33, FR43 extended)  
**UX contract (forward):** `ux-divan-2026-07-31` (EXPERIENCE.md + DESIGN.md) — Direction A mockups are visual acceptance; Epic 1–7 / 4b ACs remain historically true against `ux-divan-2026-07-19`  
**Authorized by:** `sprint-change-proposal-2026-07-31` (PO-approved)  
**Prerequisite:** Epics 1–7 done (incl. epic-7 retrospective). Epic 8 is the first post-MVP committed epic.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| `Button` + CVA | `apps/web/components/ui/button.tsx` | Variants: `primary` (gold), `secondary` (blue), `outline`, `ghost`, `link`; sizes default/sm/lg/icon | No tertiary / row-action / destructive / disabled-with-reason; JSDoc still cites UX-DR2; `ghost` used as row/toolbar |
| Brand tokens / theme | `apps/web/app/globals.css`, `theme-provider.tsx` | Light/dark CSS vars; Epic 4b spacing (`--section-tabs-height: 44px`, content pad 24px) | Full 2026-07-31 spacing/neutral scale = **Story 8.2**; only add tokens **required** for new button variants |
| GovernedDataTable | `apps/web/components/governed-data-table/` | Sticky id/actions, filters, sort, `rowActions` slot | Do **not** change public table contract; readability = **8.6**; row-action **affordance polish** = **8.7** |
| Leave-guard / dialogs | `leave-guard/*`, `sensitive-confirmation-dialog`, quick-create/edit, org/access dialogs | Quick-create/edit + sensitive-confirm Cancel = `ghost` (correct). Leave-guard = Stay `primary` · Discard `outline` · Save `secondary` — **no** Cancel/`ghost`. Most panel-modal `انصراف` buttons are still `outline` | Migrate dialog cancel/dismiss → `ghost`; do **not** put `ghost` on leave-guard Discard (default: `tertiary` / `outline` alias). Stay remains sole gold CTA in that dialog |
| Personnel event footer | `personnel-event-form.tsx` | Cancel · Save draft · Finalize ≈ semantic hierarchy | Closest existing contract exemplar — align, don't fork a second button API |
| Operational copy | `lib/operational-copy.ts` | Central Persian strings | Do **not** invent parallel copy; disabled-reason may use short inline Persian — full copy overhaul = **8.9** |
| A11y floor selfcheck | `lib/a11y-floor.selfcheck.ts` | Contrast / copy / zoom heuristics (`pnpm exec tsx lib/a11y-floor.selfcheck.ts` — no dedicated npm script yet) | Extend or add **sibling** control-contract selfcheck; do not weaken a11y floor |
| ESLint web gate | `apps/web/eslint.config.mjs` | `no-restricted-imports` for Prisma only | May add retired-variant restriction **or** prefer selfcheck (AC allows either) |

**No** published control-contract module, inventory artifact, or retired-variant guard exists yet.

### Critical naming distinction (do not conflate)

| Concept | Meaning | Owner |
| --- | --- | --- |
| **Interaction audit** (this story) | Inventory of UI controls (variant/size/placement/semantics) + gap list | **8.1** |
| **ممیزی / audit investigation** (Epic 7) | Product surface for access/event investigation | 7.1; UUID retrofit later in **8.5** — out of scope |
| **Configuration audit trail** (FR-60 / AD-7) | Attributable settings changes | **Epic 10** — out of scope |
| **UX-DR30 action-affordance system** | Semantics → appearance mapping; ghost retirement; discoverable controls | **8.1** establishes contract + migration; **8.7** deepens row-action icon pattern + dead-click elimination |
| **`outline` vs `tertiary`** | Current code uses `outline`; DESIGN names `button-tertiary` | Map: implement `tertiary` as DESIGN tertiary; keep `outline` as **deprecated alias** of `tertiary` (same classes) for one story, or migrate call sites — document choice in Completion Notes |

## Acceptance Criteria

1. **Given** the delivered Epic 1–7 surfaces  
   **When** the interaction audit runs  
   **Then** every button, row action, table, panel, and form in `apps/web` is inventoried with its current variant, size, placement, and semantics  
   **And** the gap list is published as the input to Stories 8.2–8.9 (artifact under `_bmad-output/implementation-artifacts/`, e.g. `8-1-interaction-audit-gap-list.md`)

2. **When** the control contract is implemented  
   **Then** action semantics map to typed variants — **primary CTA**, **secondary**, **tertiary / row action**, **destructive**, **disabled-with-reason** — and the mapping is documented **next to the component** (JSDoc / adjacent markdown comment block in `button.tsx` or `button.contract.md` colocated)

3. **And** `ghost` is removed from **row and toolbar** actions and remains available **only** for dialog cancel and inline dismiss

4. **And** one gold `button-primary` / `variant="primary"` per surface region is preserved (no competing dual gold CTAs in the same toolbar/region)

5. **And** existing drift is fixed, including the `org-flat` surface (`org-flat-job-ref-panel.tsx`: mix of `ghost` edit + `outline` activate/deactivate + inconsistent padding) and padding inconsistencies found by the audit (`h-8` / `px-2` present vs absent on equivalent actions)

6. **And** a **lint rule or selfcheck** fails when a row or toolbar action uses a retired variant (`ghost` in those contexts)

7. **And** scope stays **presentation / interaction only**:
   - No domain, permission, governance, event-store, temporal, headcount, or audit-envelope **semantic** changes
   - Exception only if a defect makes a governed action unreachable (document any such fix)
   - AR-\* remain fail-closed; do not invent freeze numbers
   - Do **not** claim FR-58 / LG-6 production-complete (Epic 8.10 is the consistency/a11y gate)

8. **And** this story does **not** own: page-header / spacing grid / section-tabs 30px / form-layout system / component gallery (**8.2**); `entity-picker` + code resolvers (**8.3–8.5**); GovernedDataTable readability / min-width removal (**8.6**); leave-guard silent early-return / full icon-only row-action icon map (**8.7** core); skeleton/toast/feedback precedence system (**8.8**); recalc-banner rewrite / glossary (**8.9**); mockup QA gate (**8.10**); Epic 9–10 IA/settings

## Tasks / Subtasks

- [ ] Task 1: Interaction audit + gap list (AC: #1, #8)
  - [ ] Walk `apps/web` panels/forms/dialogs/tables (personnel, org, access, reports, export, audit, correction, migration, ops/governance, shell chrome)
  - [ ] For each control record: file path, role (primary CTA / secondary / tertiary / row / destructive / cancel-ghost / chrome), current `variant`+`size`, placement (toolbar / row / footer / dialog), notes
  - [ ] Publish `8-1-interaction-audit-gap-list.md` with sections mapped to Stories **8.2–8.9** (what 8.1 fixed vs deferred)
  - [ ] Explicitly list **allowed** `ghost` survivors (dialog cancel / inline dismiss) vs **retired** usages

- [ ] Task 2: Encode UX-DR30 control contract in `Button` (AC: #2, #4, #7)
  - [ ] UPDATE `apps/web/components/ui/button.tsx`:
    - Add variants (normative names — document final exports in Completion Notes):
      - `primary` — gold CTA; height target `control-height` 32px when tokens exist; **one per surface region**
      - `secondary` — blue; draft / parallel commit
      - `tertiary` — surface + control border (DESIGN `button-tertiary`); default toolbar / non-primary
      - `rowAction` — outlined-at-rest row control (DESIGN `row-action-button`); prefer square / compact size
      - `destructive` — typed destructive appearance (confirm posture unchanged — still use existing confirmation dialogs)
      - `ghost` — **restricted**: dialog cancel / inline dismiss only (document; enforce via Task 4)
      - Keep `link` if still needed for text links; do not use as row/toolbar substitute
    - Sizes: align toward DESIGN `control-height-xs` 24 / `sm` 28 / default 32 where practical; do **not** require full globals.css spacing pass (8.2)
    - Add optional `disabledReason?: string`; when `disabled` **and** `disabledReason` provided → set `title` + prefer `aria-describedby` + helper element (fallback `aria-description` OK)
    - TypeScript: do **not** make `disabledReason` required on every disabled Button in 8.1
    - Migrate reasons only on controls touched by this story’s ghost/row/toolbar/org-flat pass; list remaining `disabled`-without-reason sites in the gap list under **8.9** / follow-ups
    - Visually: prefer DESIGN `button-disabled` colors over bare `disabled:opacity-50` on contract variants — add `--disabled-surface` / `--disabled-foreground` (and `--control-border` for tertiary/rowAction) to `globals.css` **minimally**; no full 8.2 spacing migration
  - [ ] Document semantic → variant table in JSDoc **immediately above** `buttonVariants` (replace UX-DR2-only comment with UX-DR30 / FR-58)
  - [ ] Optional thin wrappers `RowActionButton` / `ToolbarButton` **only if** they reduce misuse; not mandatory if variants + lint suffice
  - [ ] Minimal CSS vars in `globals.css` as above — only tokens required for tertiary/rowAction/disabled; no full 8.2 token migration

- [ ] Task 3: Migrate call sites + fix drift (AC: #3, #4, #5)
  - [ ] Replace **row** `ghost` → `rowAction` (prefer `rowAction`; text labels OK in 8.1)
  - [ ] Replace **toolbar** `ghost` → `tertiary` (or secondary when draft/parallel)
  - [ ] Pagination / filter-chrome / non-dismiss nav using `ghost` → `tertiary` (never keep as ghost). Explicitly includes personnel-list server pagination «صفحه قبل/بعد»
  - [ ] **Keep/migrate to `ghost`:** sensitive-confirmation Cancel; personnel-quick-create/edit Cancel; personnel-event-form Cancel; `DialogFooter` / `dialog.tsx` «بستن»; every dialog `انصراف` / dismiss currently on `outline` in panels → `variant="ghost"`. Do **not** leave dialog cancel on `tertiary`/`outline`
  - [ ] **Do NOT** add `ghost` to leave-guard; Discard stays non-ghost (`tertiary` / `outline` alias). Stay remains the sole gold CTA in that dialog
  - [ ] Classify `jalali-date-picker` chrome `ghost` (month nav): treat as **inline dismiss/chrome** (keep) **or** migrate to `tertiary` — document choice; do not leave unlabeled
  - [ ] Fix `org-flat-job-ref-panel.tsx`: unify edit/activate/deactivate row actions to `rowAction`, normalize padding/size
  - [ ] Sweep known ghost row/toolbar/pagination sites (non-exhaustive — audit may add more):
    - `personnel-list-panel.tsx` (row + pagination chrome)
    - `org-ladder-grade-panel.tsx`, `org-hierarchy-panel.tsx`, `org-flat-job-ref-panel.tsx`
    - `access-people-panel.tsx`, `entitlement-grants-panel.tsx`
    - `audit-investigation-panel.tsx`, `correction-cases-panel.tsx`
    - `report-catalogue-panel.tsx`, `decision-publication-panel.tsx`, `export-artifact-panel.tsx`
  - [ ] Dual-gold audit: ensure **≤1** `variant="primary"` gold per toolbar/surface region; also spot-check `import-wizard`, `migration-reconciliation-workspace`, headcount, break-glass flows; demote extras to secondary/tertiary
  - [ ] Do **not** change GovernedDataTable public props; only the **buttons rendered inside** `rowActions` / `toolbar` slots

- [ ] Task 4: Lint or selfcheck guard (AC: #6)
  - [ ] Prefer **selfcheck** (matches Epic 1–7 pattern): e.g. `apps/web/lib/control-contract.selfcheck.ts` or `components/ui/button.selfcheck.ts`
    - Classify **usage**, not file path alone (ghost cancels live **inside** the same panel files as retired row/toolbar ghosts):
      - Fail `variant="ghost"` / `buttonVariants({ variant: "ghost" })` when JSX is inside `rowActions` / table action cells / surface toolbars / pagination chrome
      - Allow `ghost` for: Dialog/Sheet footer cancel·dismiss, sensitive-confirmation cancel, documented inline-dismiss chrome (allowlist of **selectors/patterns**, not `leave-guard/*`)
    - Assert variant union exports `primary|secondary|tertiary|rowAction|destructive|ghost|link` (+ `outline` only if deprecated alias)
    - Fixture strings from inventoried files OK if whole-repo AST is brittle — must **not** ban in-panel dialog cancels
    - Do **not** require `disabledReason` on every disabled Button in this selfcheck
  - [ ] Wire `package.json` script: `selfcheck:control-contract`
  - [ ] **OR** ESLint with the same usage/allowlist semantics — if chosen, document patterns next to eslint config (path-only allowlists are insufficient)
  - [ ] Do **not** remove Prisma `no-restricted-imports` gate

- [ ] Task 5: Verification DoD (AC: #1–#8)
  - [ ] `pnpm --filter @divan/web selfcheck:control-contract` (or lint) passes
  - [ ] Spot-check RTL: personnel list row actions outlined/visible at rest; org-flat consistent; dialog Cancel still `ghost`
  - [ ] No dual gold CTA on a sampled toolbar (personnel list, org flat, one Epic 7 panel)
  - [ ] Gap list committed and referenced from this story's Completion Notes
  - [ ] Interactive a11y: new/changed controls keep accessible names; focus rings intact; icon-only row actions (if any converted) have `aria-label`
  - [ ] Story Status ↔ sprint-status alignment when marking done

## Dev Notes

### Gate (non-negotiable)

- **Presentation only** — Epic 8 intro: no domain/permission/governance rule changes except unblock unreachable governed actions.
- **Forward UX** is `ux-divan-2026-07-31`; do not reopen Epic 1–7 domain stories; presentation supersession is forward-only (same pattern as Epic 4b).
- **PO authorization** already landed via `sprint-change-proposal-2026-07-31` + PRD §8.12 FR-57–FR-60 — Epic 7 retro “do not invent Epic 8” is **closed**.
- **Consume, don't fork** GovernedDataTable, leave-guard, banner stack, operational-copy, Radix dialogs.
- **UI lives in `apps/web` (`@divan/web`)** — there is no `packages/web` / `@divan/ui`.

### Semantic → appearance mapping (implement + document)

| Semantics | Variant | DESIGN token | Notes |
| --- | --- | --- | --- |
| Primary CTA | `primary` | `button-primary` gold | One per surface region; height → 32px |
| Secondary / draft / parallel | `secondary` | `button-secondary` blue | e.g. Save draft |
| Default toolbar / non-primary | `tertiary` | `button-tertiary` | Replaces most former `outline` / toolbar `ghost` |
| Row action | `rowAction` | `row-action-button` | Outlined at rest; 24px target; never borderless |
| Destructive | `destructive` | (typed) | Still confirm via existing dialogs |
| Disabled | native `disabled` + reason | `button-disabled` | Persian reason required |
| Pagination / filter chrome | `tertiary` | `button-tertiary` | **Not** an allowed ghost context |
| Dialog cancel / inline dismiss | `ghost` | (survives) | **Only** allowed `ghost` contexts; migrate `outline` cancels → `ghost` |
| Leave-guard Discard | `tertiary` (or `outline` alias) | — | **Not** ghost; Stay is the sole gold CTA |

Gold rule (DESIGN): gold appears once per surface region on the single primary action; **never** as a data color.

### Current Button state (UPDATE carefully)

```7:38:apps/web/components/ui/button.tsx
/**
 * Brand button variants (UX-DR2):
 * - primary: theme-aware gold CTA (`--accent` / `--accent-foreground`)
 *   Light fill #FDB913; dark fill MUST be #FBC470 (never #FDB913 on dark cards)
 * - secondary: blue structure (`--primary` / `--primary-foreground`)
 */
const buttonVariants = cva(
  // ...
  {
    variants: {
      variant: {
        primary: "...",
        secondary: "...",
        outline: "...",
        ghost: "...",
        link: "...",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);
```

**Preserve:** gold/blue brand fills and dark accent `#FBC470` rule; `asChild` + Slot; `type` default `"button"`; `buttonVariants` export.

**Change:** variant set + docs + sizes toward contract; default variant may stay `primary` but call sites must not spam primary.

### org-flat drift (must fix)

`org-flat-job-ref-panel.tsx` row actions today: Edit = `ghost`+`sm`; activate/deactivate = `outline`+`sm` — inconsistent with personnel list (all `ghost`) and with DESIGN (all row actions outlined). Normalize to `rowAction` (same size/padding).

### 8.1 vs 8.7 boundary (avoid scope creep)

| In **8.1** | Defer to **8.7** |
| --- | --- |
| Typed variants + docs | Full fixed per-action **icon** mapping |
| Retire row/toolbar `ghost` | Leave-guard silent early-return / dead-click elimination |
| Outlined-at-rest row actions (text label OK) | Mandatory icon-only + tooltip-on-focus everywhere |
| Lint/selfcheck on retired variants | Inert-action selfcheck across all surfaces |
| Padding consistency on migrated controls | Overflow menu beyond two row actions (UX-DR30 overflow) |

### Library / stack requirements

| Lib | Version in repo | Guidance |
| --- | --- | --- |
| `class-variance-authority` | `^0.7.1` | Keep; extend `cva` variants; use `VariantProps`; optional `compoundVariants` for destructive+size — do **not** replace with a new styling system |
| React | `^19.1.0` | Keep `Slot`/`asChild` pattern |
| Next.js | `16.2.10` | App Router; client components already `"use client"` where needed |
| ESLint | `^9.31.0` flat config | Extend carefully; selfcheck often clearer than brittle AST lint for allowlists |
| Tailwind | v4 via `@theme inline` in `globals.css` | Prefer token classes; avoid one-off magic numbers when a token exists |

CVA typing: derive props with `VariantProps<typeof buttonVariants>`; keep extending `React.ComponentProps<"button">`.

### File structure requirements

| Action | Path |
| --- | --- |
| UPDATE | `apps/web/components/ui/button.tsx` |
| UPDATE (minimal) | `apps/web/app/globals.css` — only if new control tokens needed |
| UPDATE | Ghost/row/toolbar call sites listed in Task 3 (+ audit finds) |
| UPDATE | `apps/web/package.json` — add selfcheck script |
| UPDATE optional | `apps/web/eslint.config.mjs` — if lint path chosen |
| CREATE | `_bmad-output/implementation-artifacts/8-1-interaction-audit-gap-list.md` |
| CREATE | `apps/web/lib/control-contract.selfcheck.ts` (or `components/ui/button.selfcheck.ts`) |
| DO NOT CREATE | Parallel `@divan/ui` package; duplicate Button; forked GovernedDataTable |

### Testing requirements

- Selfcheck must be **runnable** via `pnpm --filter @divan/web selfcheck:control-contract`
- Prefer deterministic file/AST or fixture assertions (mirror `governed-data-table.selfcheck.ts` / `a11y-floor.selfcheck.ts` style)
- Manual: light + dark spot-check on one list + one dialog (Cancel remains borderless/ghost; row action shows boundary at rest)
- Do **not** mandate Vitest/ephemeral DB for this UI-only story (open quality debt elsewhere)

### Previous epic intelligence (Epic 7 → 8)

- Epic 7 retro closed “do not invent Epic 8” via PO-approved proposal — proceed.
- Open carry-ins **not** owned by 8.1: InferenceBulkPort ops doc; sticky break-glass; PopulationPort cutover; AD-6 hardening; Baseline projector; person-org mutation IDOR; person-create dedupe; logout leave-guard; enforcement-matrix DoD for **consumer/integration** domain stories (less critical here — this is UI contract, but still: selfcheck + migrated call sites = enforcement, not “Button variants exist” alone).
- Honesty: substrate-done ≠ production/LG-complete — do not claim FR-58 done for the whole product until 8.10.

### Git intelligence summary

Recent commits: `58f85d6` epic 7 retro → `19fed19` story 7.8 → `fde870b` 7.7 → … Evidence register for this story's drift lives in `sprint-change-proposal-2026-07-31` (E2/E11): row actions `ghost` almost everywhere; `org-flat` uses `outline`; padding `h-8 px-2` inconsistent; gold CTA hierarchy uneven.

### Latest tech information

- CVA 0.7.x: define variants in `cva()`, export `VariantProps`, prefer `compoundVariants` over nested conditionals; keep `buttonVariants` export for non-`<button>` consumers.
- Do not upgrade Next/React/CVA as part of this story unless blocked.

### Project context reference

- No `project-context.md` found in repo at story creation; follow this file + `ux-divan-2026-07-31` + existing `apps/web` patterns.
- Communication with user: Persian; story document: English (BMM config).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8, Story 8.1, UX-DR30]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — button family, row-action-button, Do's/Don'ts]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — interaction primitives, a11y floor]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — §8.12 FR-58, FR-43]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — authorization + E2/E11]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-6 UI boundary]
- [Source: `apps/web/components/ui/button.tsx` — current variants]
- [Source: `apps/web/components/organization/org-flat-job-ref-panel.tsx` — drift exemplar]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Story Completion Status

- Status: **ready-for-dev**
- Note: Ultimate context engine analysis completed — comprehensive developer guide created
