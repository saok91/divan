---
baseline_commit: 56d7584
---

# Story 8.7: Row-Action Affordance & Dead-Click Elimination

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator scanning a list,
I want row actions that look like buttons and always do something,
so that I stop clicking controls that appear inert (UX-DR30, FR58).

**Story key:** `8-7-row-action-affordance-dead-click-elimination`  
**Epic:** 8 — Experience Foundation & Identifier Ergonomics (FR58; UX-DR30; LG-6 honesty)  
**UX contract (forward):** `ux-divan-2026-07-31` (EXPERIENCE.md row actions / Interaction primitives; DESIGN.md `row-action-button` + ghost ban)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (finding **E2** / **E11** + Story 8.7 intent L279)  
**Prerequisite:** Story 8.1 control contract (`rowAction` variant, ghost retired from row/toolbar, `disabledReason`); Story 8.2 tokens + starter `icon-contract.md`; Story 8.6 table readability (sticky `__actions`, density) — **consume, do not reopen**. Do **not** own skeletons/toast (**8.8**), glossary copy (**8.9**), or design QA gate (**8.10**).

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| `Button` `variant="rowAction"` + `size="xs"` | `apps/web/components/ui/button.tsx` | Outlined-at-rest ~24px (`--control-height-xs`); `disabledReason` wrapper | Still used with **visible text labels**; no mandatory icon / aria-label / tooltip contract |
| Tooltip kit | `apps/web/components/ui/tooltip.tsx` | Radix Tooltip (opens on **hover and keyboard focus**); Provider `delayDuration` default 0 in wrapper | Must wrap every icon-only row action; DESIGN chrome styling optional local override (same pattern as 8.6 TruncatedCell) |
| Icon starter map | `apps/web/components/icons/icon-contract.md` | lucide-react only; 12px row / 16px toolbar; starter Edit/Delete/Add/… | Explicitly defers **full row-action icon map + overflow + inert selfcheck** → **this story** |
| `GovernedDataTable` `rowActions` | `governed-data-table.tsx` / `types.ts` | Injects sticky `__actions` column; ArrowUp/Down row focus | **No `onRowClick`**; actions do not `stopPropagation`; render is free-form `ReactNode` |
| Leave-guard | `leave-guard/leave-guard-provider.tsx` | Dirty → dialog; clean → `router.push` | **Silent** `return Promise.resolve(false)` when `pendingRef.current` already set (~L124–126); Save path can `return` with no feedback when `!onSave` (~L163–165) |
| Control-contract selfcheck | `lib/control-contract.selfcheck.ts` | Bans `ghost` inside `rowActions` / toolbar heuristics | Does **not** assert inert-action / icon-only / aria-label / overflow |
| Popover | `components/ui/popover.tsx` | Radix Popover via unified `radix-ui` package | Usable for overflow **if** menu semantics are correct; prefer adding `dropdown-menu.tsx` from same `radix-ui` package (no new icon/lib deps) |
| Gallery | `app/(app)/dev/gallery/page.tsx` | Shows `rowAction` button sample | Update to icon-only + tooltip + overflow demo |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Row action** | Icon-only outlined control in the sticky actions column (or tree `renderRowEnd` / lifecycle strip using `rowAction`) |
| **Row click / row activate** | Click (and Enter/Space when row is focused) opens the **record** via optional `onRowClick` — never a side effect of pressing an action button |
| **Dead click / inert** | Control accepts activation (pointer or keyboard) and produces **no** dialog, navigation, mutation, or explicit reason — FR-58 / LG-6 forbid this |
| **Leave-guard list rule** | EXPERIENCE: guard must not fire **spuriously** on non-navigating row actions; navigations that *do* leave (`ثبت رویداد`, report `openHref`) still go through `requestNavigation` and must never fail silently |
| **Overflow** | More than **two** primary row actions → labelled menu (trigger = Ellipsis + accessible name); never a third bare icon |
| **Tooltip vs accessible name** | `aria-label` (or visible text inside overflow items) is mandatory; tooltip is a **supplement** on hover **and** focus — never the only label |
| **`ghost`** | Still banned for row/toolbar (8.1). Do not reintroduce for row actions |
| **Presentation-only epic** | No domain / permission / governance / event-store semantic changes |

## Acceptance Criteria

1. **Given** every list surface with row actions  
   **When** the affordance pattern is applied  
   **Then** row actions are 24px icon-only buttons, outlined at rest with a visible border and surface fill, never hover-revealed and never borderless

2. **And** each carries a mandatory `aria-label` and a tooltip shown on hover and on keyboard focus, with a fixed per-action icon mapping shared across surfaces

3. **And** more than two actions on a row collapse into a labelled overflow menu

4. **And** row click opens the record while row actions stop propagation, so no action triggers navigation as a side effect

5. **Given** the leave-guard early return in `leave-guard-provider.tsx`  
   **When** a navigation or action is blocked by unsaved work  
   **Then** the user always sees a dialog or an explicit reason, and the blocked path never fails silently

6. **And** «اطلاعات کامل/ویرایش» and «ثبت رویداد» in the personnel list are verifiably actionable, including from the keyboard

7. **And** a selfcheck asserts that no rendered action is inert — every enabled action has a handler and every disabled action has a reason

8. **And** scope stays **presentation / interaction only**:
   - No domain / permission / governance / event-store semantic changes
   - Additive optional `GovernedDataTable` props only — existing consumers keep working without required prop churn
   - AR-\* fail-closed; do not invent freeze numbers
   - `selfcheck:control-contract`, `selfcheck:governed-table`, `selfcheck:layout-system` stay green (extend / add as needed)
   - Do **not** own: EntityPicker/UUID (**8.3–8.5**); table min-width / density / truncation (**8.6** — already owned); skeletons/toast/motion (**8.8**); glossary / banner rewrite (**8.9**); mockup QA gate (**8.10**); Epic 9–10 IA

## Tasks / Subtasks

- [x] Task 1: Fix leave-guard silent paths (AC: #5) — **do this first**
  - [x] In `leave-guard-provider.tsx` `requestNavigation`: when `pendingRef.current` is already set, **never** resolve `false` with zero UI. Prefer one of: (a) keep/focus the existing dialog and attach/replace the waiter so the user still sees the dialog; (b) if product prefers rejecting the second request, surface an **explicit** Persian reason (status/`role="status"` or re-announce dialog) before resolving `false`. Document the chosen algorithm in Completion Notes.
  - [x] Fix Save branch when `dirty.some((e) => !e.onSave)` (~L163–165): do not silent-`return` — keep dialog open **and** expose a visible reason (button already gated in dialog; defend with copy if reached).
  - [x] Grep `requestNavigation` call sites that `void` the promise (`personnel-list-panel`, `report-catalogue-panel`, sidebar, command palette, etc.) — after the fix, a blocked second navigation must still yield dialog-or-reason without requiring each caller to toast.
  - [x] Add / extend a focused selfcheck or unit-style assert for the provider algorithm if feasible without Playwright (pure state machine test preferred).

- [x] Task 2: Lock row-action icon contract + `RowActionButton` primitive (AC: #1, #2)
  - [x] Expand `apps/web/components/icons/icon-contract.md` from starter → **canonical per-action map** used by every surface in this story (table below). Same action ⇒ same Lucide export everywhere.
  - [x] Add a small shared helper (preferred path): e.g. `apps/web/components/ui/row-action-button.tsx` (or under `governed-data-table/`) that composes:
    - `Button variant="rowAction" size="xs"` (or icon-square padding so 24×24 hit target)
    - Lucide icon at **12px** (`size-3`)
    - **Required** `aria-label` (TypeScript: no optional escape hatch for the public API)
    - `Tooltip` + `TooltipTrigger` + `TooltipContent` showing the same Persian label; ensure focus opens tooltip (Radix default — do not disable focus open)
    - `onClick` wrapper that calls `event.stopPropagation()` (and `preventDefault` only if needed) before the consumer handler
  - [x] Optional `disabled` + **required** `disabledReason` when disabled (reuse Button contract).
  - [x] Square chrome: prefer `size="xs"` + `className` that keeps width ≈ height (`px-0` / fixed `size` matching `--control-height-xs`) so icon-only is not a wide pill.
  - [x] Update gallery page sample to icon-only + tooltip.

- [x] Task 3: Overflow menu for >2 actions (AC: #3)
  - [x] Add `apps/web/components/ui/dropdown-menu.tsx` from the existing unified `radix-ui` package (same pattern as `popover.tsx` / `tooltip.tsx`) — **do not** add `@radix-ui/react-dropdown-menu` as a separate dependency unless the monorepo already requires it; prefer `import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"`.
  - [x] Shared helper e.g. `RowActionOverflow` / `rowActionMenu`: trigger = `RowActionButton` (or equivalent) with Ellipsis icon + aria-label like «اقدامات بیشتر»; menu items show **Persian labels** (text OK inside menu); each item has a real handler or disabled+reason.
  - [x] Rule: at most **two** icon buttons visible; action #3+ go into the menu. Access people panel (3 actions) is the mandatory proof surface.
  - [x] Overflow trigger also `stopPropagation`.

- [x] Task 4: `GovernedDataTable` row activate + stopPropagation (AC: #4, #6)
  - [x] Add optional `onRowClick?: (row: T) => void` (name may be `onRowActivate` if clearer — pick one and document) on `GovernedDataTableProps`.
  - [x] When provided: `TableRow` `onClick` invokes it; `onKeyDown` already handles arrows — add **Enter** / **Space** when `event.target === event.currentTarget` to activate the row (do not steal keys from focused controls inside cells).
  - [x] Visual affordance: only when `onRowClick` is set, apply a cursor/hover that signals activatable row (do not imply clickability on tables without a record-open behavior).
  - [x] Ensure `__actions` cell / action buttons always `stopPropagation` so action press ≠ row open.
  - [x] Preserve 4b.4 / 8.6 contracts: filters, sort, snapshot pagination, live region, permission omit, sticky hairlines, density, column visibility, ArrowUp/Down focus.

- [x] Task 5: Migrate GovernedDataTable row-action consumers (AC: #1–#4, #6)
  - [x] **Personnel list** (`personnel-list-panel.tsx`) — mandatory:
    - Map «اطلاعات کامل/ویرایش» → Edit icon + aria-label/tooltip same Persian string; handler `openEdit`
    - Map «ثبت رویداد» → Register-event icon; handler `navigateRegister`
    - Wire `onRowClick` → same as open-edit / open record (quick-edit), matching EXPERIENCE «row click opens the record»
    - Keyboard: Tab to each action + Activate; row Enter/Space when row focused
  - [x] **Access people** (`access-people-panel.tsx`) — 3 actions → 2 icons + overflow (roles / scopes / activate). Decide which two stay visible (recommend: نقش + محدوده visible; فعال‌سازی in overflow **or** primary two by frequency — document choice). Identifier-cell select behavior: if row click would conflict with account select, define clearly — prefer `onRowClick` = `selectAccount` **or** keep select on identifier only and omit row click; **do not** double-fire.
  - [x] **Org flat job refs** (`org-flat-job-ref-panel.tsx`) — edit + activate/deactivate → icon-only pair
  - [x] **Audit investigation** — جزئیات → icon-only
  - [x] **Correction cases** — list row جزئیات → icon-only; detail-strip rowActions likewise
  - [x] **Report catalogue** — مشاهده / openHref → icon-only + `stopPropagation`; keep `requestNavigation`
  - [x] Surfaces **without** `rowActions` today (e.g. personnel-events list fixture) — no invent; leave for Epic 9.6

- [x] Task 6: Migrate non-table `rowAction` strips in scope (AC: #1–#3)
  - [x] Apply same icon + tooltip + overflow rules to in-scope `variant="rowAction"` clusters that are **row-like action strips**:
    - `org-hierarchy-panel` / `org-ladder-grade-panel` `renderRowEnd` when acting as row actions
    - `personnel-event-form` lifecycle trio (cancel / reverse / correct) if still three bare `rowAction` buttons → overflow
    - `exemption-panel`, `approval-panel`, `entitlement-grants-panel` rowAction buttons — icon-only + labels in aria/tooltip (overflow if >2)
  - [x] Do **not** convert primary/secondary/tertiary CTAs or dialog footers.

- [x] Task 7: Inert-action selfcheck (AC: #7)
  - [x] Add `selfcheck:row-actions` (or extend `control-contract.selfcheck.ts`) that, via filesystem/AST (Epic 8 pattern — **no Playwright required**):
    - Every `variant="rowAction"` (or `RowActionButton` usage) in `apps/web` has an activation path: `onClick` / `onSelect` / `asChild` link — enabled controls must not be handler-less
    - Every disabled `rowAction` / `RowActionButton` carries `disabledReason` (or documented equivalent)
    - Prefer asserting consumers use the shared primitive (ban raw text-only `rowAction` Buttons in table `rowActions` callbacks)
    - Harden 8.1 heuristic gaps where cheap (brace-count / allowlist) without false positives that block legitimate gallery demos — allowlist `dev/gallery` if needed
  - [x] Wire script in `apps/web/package.json`
  - [x] Keep `selfcheck:control-contract` green (ghost-in-rowActions ban still holds for icon-only)

- [x] Task 8: Verify + document (AC: #6, #8)
  - [x] Manual smoke: personnel list — mouse + keyboard for both actions; with a dirty form elsewhere, second `requestNavigation` shows dialog-or-reason (no silent fail)
  - [x] Manual: access people overflow; audit/correction/report icon actions
  - [x] `pnpm` / package scripts: typecheck + listed selfchecks green
  - [x] Completion Notes: icon map final table, leave-guard algorithm choice, access-people overflow ranking, any deferred non-goals

### Review Findings

- [x] [Review][Decision] Tooltip chrome vs popover — resolved: keep theme-aware `bg-popover` / `text-popover-foreground` globally (light `#fff`/`#11142a`, dark `#0a1138`/`#e6e9f5`); readable in both themes; DESIGN chrome deferred where it conflicts with light-theme legibility.
- [x] [Review][Decision] Row activate accessible name — resolved: add optional `rowActivateLabel` with default «باز کردن رکورد» when `onRowClick` is set.
- [x] [Review][Patch] Leave-guard navigate-clean while pending ignores open dialog [`apps/web/components/leave-guard/leave-guard-algorithm.ts:19`]
- [x] [Review][Patch] Enter/Space row activate missing `event.target === event.currentTarget` (Task 4) — can double-fire with focused cell controls [`apps/web/components/governed-data-table/governed-data-table.tsx:563`]
- [x] [Review][Patch] `onRowClick` has no text-selection or nested interactive guards [`apps/web/components/governed-data-table/governed-data-table.tsx:753`]
- [x] [Review][Patch] Enabled `RowActionButton` allows optional `onClick` → inert activation (AC #7 / FR-58) [`apps/web/components/ui/row-action-button.tsx:19`]
- [x] [Review][Patch] `row-actions.selfcheck` does not assert handlers / disabledReason at call sites (AC #7 Task 7) [`apps/web/lib/row-actions.selfcheck.ts:1`]
- [x] [Review][Patch] Overflow disabled items omit required `disabledReason` (visible path has fallback; overflow does not) [`apps/web/components/ui/row-action-overflow.tsx:87`]
- [x] [Review][Patch] Cluster soft-defaults missing `disabledReason` instead of failing closed like `RowActionButton` [`apps/web/components/ui/row-action-overflow.tsx:145`]
- [x] [Review][Patch] Empty/whitespace `label` not rejected on `RowActionButton` [`apps/web/components/ui/row-action-button.tsx:33`]
- [x] [Review][Patch] `focusLeaveDialog` microtask may run before dialog Stay is mounted [`apps/web/components/leave-guard/leave-guard-provider.tsx:128`]
- [x] [Review][Patch] Per-action nested `TooltipProvider` under table Provider (delay 0 vs 300) [`apps/web/components/ui/row-action-button.tsx:55`]
- [x] [Review][Patch] `disabledReason` not encoded in TypeScript discriminated union [`apps/web/components/ui/row-action-button.tsx:15`]
- [x] [Review][Patch] `rowActivateLabel` optional prop + default «باز کردن رکورد» on `onRowClick` rows [`apps/web/components/governed-data-table/governed-data-table.tsx:740`]
- [x] [Review][Defer] `Button` lacks `forwardRef` under Radix `asChild` Tooltip/Dropdown triggers — deferred, pre-existing [`apps/web/components/ui/button.tsx:73`]

## Dev Notes

### Gate (non-negotiable)

- **UX-DR30 / FR-58 / LG-6:** No control may accept a click/key and do nothing. Disabled ⇒ visible + AT reason. Icon-only ⇒ accessible name; tooltip supplements.
- **Epic 8 presentation-only:** no authz, domain, or governance rule changes. If a governed action is unreachable because of a pure UI defect, fixing reachability is in scope; inventing new permissions is not.
- **Consume 8.1 / 8.2 / 8.6:** do not restyle table density, sticky hairlines, truncation, or re-open EntityPicker.
- **Direction A mockups** are visual reference for 8.10; this story hardens the **interaction contract** now (outlined 24px icon-only). Historical UX 2026-07-19 allowed text labels — **superseded**.

### Root-cause intelligence (E2) — why PO saw “dead” buttons

Verified in `sprint-change-proposal-2026-07-31` finding E2:

1. **Affordance gap:** pre-8.1 `ghost` made actions look like static text. 8.1 fixed outlined `rowAction`, but **text-only** controls still fail the icon-only + tooltip contract and still feel weak at dense 32px rows.
2. **True dead-click:** `leave-guard-provider.tsx` when `pendingRef.current` is set returns `false` **without** dialog or message. Callers `void requestNavigation(...)` → operator click appears inert. **This story must close that hole.**
3. Handlers on personnel list **are** wired (`openEdit`, `navigateRegister`) — do not “fix” by inventing new routes; fix affordance + leave-guard + keyboard proof.

### Canonical icon map (extend `icon-contract.md` — adjust only with product consistency)

| Action (Persian label) | Lucide export | Notes |
| --- | --- | --- |
| اطلاعات کامل/ویرایش | `Pencil` | Personnel primary open/edit |
| ثبت رویداد | `CalendarPlus` | Or `ClipboardPlus` — pick one and freeze |
| تخصیص نقش | `Shield` | Access |
| محدوده | `Waypoints` or `MapPinned` | Access — freeze one |
| فعال‌سازی | `CircleCheck` | Access / org activate |
| غیرفعال‌سازی | `CircleSlash` / `Ban` | Org deactivate |
| جزئیات | `Eye` | Audit / correction |
| مشاهده (گزارش) | `FileSearch` / `ExternalLink` | Report open |
| اقدامات بیشتر (overflow) | `Ellipsis` | Mandatory overflow trigger |
| حذف / مخرب | `Trash2` | Destructive still confirms via existing dialogs |
| ویرایش (org refs) | `Pencil` | Same as edit |

Do **not** add a second icon library. Stroke = Lucide default outline.

### Leave-guard algorithm (recommended)

```text
requestNavigation(href):
  if no dirty registrations → router.push; resolve true
  if pendingRef already set → DO NOT silent-false
       preferred: focus existing dialog; optionally replace pending.href/resolve
       chain so the operator always sees LeaveGuardDialog
  else → openPending({ href, mode: "push", resolve })

resolvePending("save") when some dirty lack onSave:
  → do not bare return; set an inline error / disable Save with reason already in dialog
```

EXPERIENCE L89: guard should not fire on **non-navigating** row actions (edit modal, details dialog). Only paths that call `requestNavigation` engage the guard.

### GovernedDataTable API sketch (additive)

```ts
// types.ts — additive only
onRowClick?: (row: T) => void;
// rowActions remains (row) => ReactNode
// Prefer implementing rowActions via <RowActionButton> / <RowActionOverflow>
```

Current state (must read before editing):

- `types.ts`: `rowActions?: (row: T) => React.ReactNode` — **no** row click prop today
- `governed-data-table.tsx`: injects `__actions` with `sticky: "actions"`; row keyboard = ArrowUp/Down only; **no row onClick**
- Sticky / density / truncation owned by **8.6** — preserve

### Consumer inventory (mandatory migration checklist)

| Surface | File | Actions today | 8.7 expectation |
| --- | --- | --- | --- |
| Personnel list | `personnel-list-panel.tsx` | 2 text `rowAction` | 2 icon+tooltip; `onRowClick`→edit; keyboard proof |
| Access people | `access-people-panel.tsx` | **3** text | ≤2 icons + labelled overflow |
| Org flat refs | `org-flat-job-ref-panel.tsx` | 2 text | icon-only pair |
| Audit | `audit-investigation-panel.tsx` | 1 text | icon-only |
| Correction cases | `correction-cases-panel.tsx` | 1+ detail strip | icon-only |
| Reports | `report-catalogue-panel.tsx` | open via `requestNavigation` | icon-only + leave-guard safe |
| Personnel events list | `personnel-events-list-panel.tsx` | no rowActions | out of scope (Epic 9.6) |

### What must be preserved

- 4b.4 / 8.6 table contracts (filters, sort, pagination snapshot, live region, permission omit, sticky separators, density, column visibility prefs)
- 8.1 variant semantics and ghost allowlist (dialog cancel / jalali month nav / inline dismiss only)
- Existing navigation targets and modal openers — change chrome, not routes/authz
- Destructive confirmation posture (Epic 2 / 4) — unchanged (8.8 also preserves this)

### Previous story intelligence

**From 8.6 (in-progress / committed `56d7584`):** Explicitly left `rowActions` render alone; sticky `__actions` + hairline ready for icon chrome. Do not regress TruncatedCell keyboard/`tabIndex` rules when adding row click. Selfchecks are AST/filesystem — follow that pattern for inert-action.

**From 8.1 (done):** Deferred exactly this story’s scope (icon map, leave-guard silent return, overflow, inert selfcheck) — see `8-1-interaction-audit-gap-list.md` §Deferred 8.7. `rowAction` + `disabledReason` already exist — **compose**, don’t fork a second button system.

**From 8.2:** `--control-height-xs` = 24px; icon-contract starter; gallery.

**From 8.4 / 8.5:** Silent early-return without feedback is a known anti-pattern (review lessons) — leave-guard fix aligns.

**Open carry-ins (do not expand scope unless blocking):** logout/authz-changed leave-guard wiring (Epic 4b+); person-create form dedupe; Enforcement-matrix DoD for later integration stories.

### Git intelligence

Recent commits: `56d7584` 8.6 → `e090c55` 8.5 → `d0b45e4` 8.4 → `07f2b28` 8.3 → `0b19c2a` 8.2. Baseline for this story file: **`56d7584`**. Expect clean touch set under `apps/web/components/**` + selfcheck + `icon-contract.md` + `package.json` script.

### Latest tech notes

- **Radix Tooltip** (via project `radix-ui` + local wrapper): opens on hover and keyboard focus; Tab opens without delay. Project `TooltipProvider` defaults `delayDuration={0}` — fine for dense tables. Tooltip is **not** a substitute for `aria-label`. If tooltip-inside-dropdown auto-opens on programmatic focus, use the known `:focus-visible` guard on the trigger only if needed — do not disable focus tooltips for normal Tab.
- **Dropdown menu:** implement from unified `radix-ui` package like existing Popover/Tooltip wrappers; avoid new dependency sprawl.
- **lucide-react** already in `@divan/web` (`^1.24.0`) — only allowed icon source.

### Project structure notes

- Prefer new primitives under `apps/web/components/ui/` (`row-action-button.tsx`, `dropdown-menu.tsx`) and optional thin re-exports from `governed-data-table/` if that improves DX.
- Selfcheck: `apps/web/lib/*selfcheck.ts` or next to governed-table — match existing script naming `selfcheck:row-actions`.
- Story / sprint docs: `_bmad-output/implementation-artifacts/` only; do not invent architecture AD for UI chrome (ARCHITECTURE-SPINE has no row-action AD — PRD+UX are SoT).

### Testing requirements

| Check | Command / method |
| --- | --- |
| Control contract | `pnpm --filter @divan/web selfcheck:control-contract` |
| Governed table | `pnpm --filter @divan/web selfcheck:governed-table` |
| Layout tokens | `pnpm --filter @divan/web selfcheck:layout-system` |
| New inert / row-action | `pnpm --filter @divan/web selfcheck:row-actions` (name as implemented) |
| Types | package / root typecheck as used in prior Epic 8 stories |
| Manual | Personnel list mouse+keyboard; leave-guard second navigation; access overflow; one audit/correction/report spot-check |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8 / Story 8.7 L1461–1479; UX-DR30 L161]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-58 L708–718; LG-6]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — L89, L105, L115, L123–124]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — `row-action-button` L143–150, L318–319, L325, L336]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — E2, E11, Story 8.7 intent L279]
- [Source: `_bmad-output/implementation-artifacts/8-1-interaction-audit-gap-list.md` — Deferred 8.7]
- [Source: `_bmad-output/implementation-artifacts/8-6-governed-table-readability-upgrade.md` — boundary: do not restyle row actions]
- [Source: `apps/web/components/leave-guard/leave-guard-provider.tsx` — L115–165]
- [Source: `apps/web/components/personnel/personnel-list-panel.tsx` — L247–254, L344–363]
- [Source: `apps/web/components/icons/icon-contract.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- `pnpm --filter @divan/web selfcheck:leave-guard` — ok
- `pnpm --filter @divan/web selfcheck:row-actions` — ok
- `pnpm --filter @divan/web selfcheck:control-contract` — ok
- `pnpm --filter @divan/web selfcheck:governed-table` — ok
- `pnpm --filter @divan/web selfcheck:layout-system` — ok
- `pnpm --filter @divan/web typecheck` — ok

### Completion Notes List

- **Leave-guard algorithm (choice a):** When `requestNavigation` fires while a dialog is already pending, resolve the previous waiter with `false`, replace `pending` href/resolve with the new waiter, keep `LeaveGuardDialog` open, and refocus Stay (`#leave-guard-stay`). Never silent-`false` with zero UI. Save without `onSave` uses `decideSaveGate` → keep dialog + `saveBlockedReason` (`role="status"`).
- **Icon map frozen** in `icon-contract.md`: Pencil / CalendarPlus / Shield / MapPinned / CircleCheck / Ban / Eye / FileSearch / Ellipsis (+ lifecycle Undo2, Download, RefreshCw).
- **Access people overflow ranking:** visible = تخصیص نقش + محدوده; overflow = فعال‌سازی. No `onRowClick` (identifier select remains separate — avoid double-fire).
- **Personnel:** `onRowClick` → `openEdit`; actions via `RowActionCluster` with stopPropagation.
- **Primitives:** `RowActionButton`, `RowActionCluster` / `RowActionOverflow`, `dropdown-menu.tsx` from unified `radix-ui`.
- **Deferred (non-goals):** skeletons/toast (8.8), glossary (8.9), QA gate (8.10), personnel-events list rowActions (Epic 9.6).

### File List

- `_bmad-output/implementation-artifacts/8-7-row-action-affordance-dead-click-elimination.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/package.json`
- `apps/web/app/(app)/dev/gallery/page.tsx`
- `apps/web/components/icons/icon-contract.md`
- `apps/web/components/ui/row-action-button.tsx`
- `apps/web/components/ui/row-action-overflow.tsx`
- `apps/web/components/ui/dropdown-menu.tsx`
- `apps/web/components/leave-guard/leave-guard-algorithm.ts`
- `apps/web/components/leave-guard/leave-guard-algorithm.selfcheck.ts`
- `apps/web/components/leave-guard/leave-guard-context.tsx`
- `apps/web/components/leave-guard/leave-guard-dialog.tsx`
- `apps/web/components/leave-guard/leave-guard-provider.tsx`
- `apps/web/components/governed-data-table/types.ts`
- `apps/web/components/governed-data-table/governed-data-table.tsx`
- `apps/web/components/personnel/personnel-list-panel.tsx`
- `apps/web/components/personnel/personnel-event-form.tsx`
- `apps/web/components/access/access-people-panel.tsx`
- `apps/web/components/access/entitlement-grants-panel.tsx`
- `apps/web/components/organization/org-flat-job-ref-panel.tsx`
- `apps/web/components/organization/org-hierarchy-panel.tsx`
- `apps/web/components/organization/org-ladder-grade-panel.tsx`
- `apps/web/components/audit/audit-investigation-panel.tsx`
- `apps/web/components/correction-cases/correction-cases-panel.tsx`
- `apps/web/components/reports/report-catalogue-panel.tsx`
- `apps/web/components/headcount/exemption-panel.tsx`
- `apps/web/components/headcount/approval-panel.tsx`
- `apps/web/lib/row-actions.selfcheck.ts`
- `apps/web/lib/control-contract.selfcheck.ts`

## Change Log

- 2026-07-31: Story context created (ready-for-dev) — ultimate context engine analysis completed.
- 2026-07-31: Implemented Story 8.7 — leave-guard honesty, RowActionButton/overflow, GovernedDataTable onRowClick, consumer migrations, selfchecks; status → review.
- 2026-07-31: Code review patches applied — leave-guard clear-pending path, row-activate guards + `rowActivateLabel`, RowActionButton honesty, selfcheck hardening; status → done.
