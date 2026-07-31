---
baseline_commit: d41b1d2
---

# Story 8.8: Feedback, Loading & Motion System

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As any user waiting on the system,
I want consistent, in-place feedback about what is happening,
so that I can tell the difference between loading, blocked, and done (UX-DR39, FR58).

**Story key:** `8-8-feedback-loading-motion-system`  
**Epic:** 8 — Experience Foundation & Identifier Ergonomics (FR58; UX-DR39; NFR-3 / NFR-12 reduced-motion honesty)  
**UX contract (forward):** `ux-divan-2026-07-31` (EXPERIENCE.md State Patterns + Feedback and Motion; DESIGN.md `skeleton` + Do's/Don'ts)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (visual-design / feedback / motion amendment + Story 8.8 intent)  
**Prerequisite:** Story 8.1 gap list (deferred feedback); Story 8.2 tokens (`--skeleton`) + gallery stub; Story 8.6 table density/chrome (consume for skeleton rhythm); Story 8.7 row-action / leave-guard honesty (**done** — do not reopen). Do **not** own banner/empty/disabled **copy** rewrite (**8.9**), mockup QA gate (**8.10**), or Epic 9–10 IA.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| `Skeleton` primitive | `apps/web/components/ui/skeleton.tsx` | `animate-skeleton-shimmer`; reduced-motion via CSS | Uses `bg-muted` not `bg-skeleton`; DESIGN wants **opacity pulse** (not translate shimmer); no table-shaped helper |
| Skeleton / toast CSS | `apps/web/app/globals.css` | `--skeleton` tokens; `.animate-skeleton-shimmer`; `.animate-toast-slide` + reduced-motion gate | Toast CSS has **no consumer**; duration tokens missing; shimmer ≠ DESIGN pulse |
| `BannerStack` + banners | `banner-stack.tsx`, `stale-recalc-banner.tsx`, `break-glass-banner.tsx` | System-wide channel (staleness, break-glass) | Keep as **banner** channel only — do not toast staleness; **copy** rewrite is **8.9** |
| `AccessStatusMessage` | `components/access/access-status-message.tsx` | `loading\|error\|empty\|info` + `role`/`aria-live` | Duplicated StatusMessage copies across org/headcount panels — unify under shared feedback message |
| `FormField` errors | `components/form-layout` | Inline field `role="alert"` | Remains the **inline field** path; do not replace with toast |
| `operationalCopy` | `lib/operational-copy.ts` | Persian loading/error/empty strings | Reuse strings; do not invent ceremonial success copy (UX-DR24 / 8.9 voice) |
| `GovernedDataTable` | `governed-data-table/*` | Empty state, session readiness, density 32/48, sticky chrome | **No** cold-load / query-loading skeleton; personnel list clears rows while `isLoading` (empty flash) |
| `SensitiveConfirmationDialog` | `personnel/sensitive-confirmation-dialog.tsx` | Epic 2/4 sensitive finalize posture; `busy` disables confirm | **Unchanged** — AC forbids posture churn; may show busy label only if already compatible |
| Gallery stub | `app/(app)/dev/gallery/page.tsx` | `"skeleton — Story 8.8"` placeholder | Replace with live skeleton + toast + pending demos |
| Motion utilities | shell/sidebar `motion-safe:… duration-200`; sheet `duration-200/300`; radix animate-in/out | Ad-hoc ms | Align to **150–250ms** token set; sheet open 300ms → clamp to ≤250ms enter |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Cold load / initial load** | First paint of a known-shaped surface → **content-shaped skeleton**. Header/page chrome renders **immediately**. Never a page-level spinner for tables/panels with known shape. |
| **In-place pending** | Filter refresh, save, finalize while the surface stays mounted — disable/busy on the control + optional inline status; **do not** unmount the form/table into a skeleton. |
| **Inline result** | Direct outcome of the action at its origin (form footer, row, field) after **server confirms**. |
| **Toast** | **Background work only** (import batch execution, export/artifact jobs, long recompute). Must carry a **link back** to the work. Never for ordinary form save. |
| **Banner** | **System-wide** only (staleness, break-glass, degraded integrity). Already hosted by `BannerStack`. |
| **One channel per event** | A single user-visible outcome uses exactly one of: inline **or** toast **or** banner — never stack two success/error surfaces for the same event. |
| **Optimistic nothing** | No client-side “saved” before server confirmation. Pending ≠ success. |
| **Pulse vs shimmer** | DESIGN.md: opacity pulse. Current CSS: translate shimmer. **This story** must land on DESIGN pulse (or document a spine amendment if product keeps shimmer — default = **pulse**). |
| **Presentation-only epic** | No domain / permission / governance / event-store semantic changes. |

## Acceptance Criteria

1. **Given** the feedback contract in EXPERIENCE  
   **When** the system is implemented  
   **Then** initial loads use content-shaped skeletons — tables keep row height and column rhythm, the header renders immediately, and no layout shift occurs on arrival

2. **And** filters, saves, and finalize actions show in-place pending states rather than replacing the surface

3. **And** result feedback follows one precedence: inline at the form or row for direct results, toast for background work such as import batches, banner for system-wide state — with exactly one channel per event

4. **And** no success is reported optimistically; a commit reports only after the server confirms

5. **And** transitions run 150–250ms and are purposeful, and `prefers-reduced-motion` disables all of them including the skeleton pulse

6. **And** the destructive and sensitive confirmation posture from Epic 2 and Epic 4 is unchanged

7. **And** scope stays **presentation / interaction only**:
   - No domain / permission / governance / event-store semantic changes
   - Additive APIs preferred (`GovernedDataTable` loading props optional; existing consumers keep working)
   - AR-\* fail-closed; do not invent freeze numbers
   - Prior Epic 8 selfchecks stay green; add `selfcheck:feedback` (or equivalent)
   - Do **not** own: EntityPicker/UUID (**8.3–8.5**); table min-width / density / truncation (**8.6**); row-action icons / leave-guard algorithm (**8.7**); banner/empty/disabled **copy** + glossary (**8.9**); mockup QA gate (**8.10**); Epic 9–10 IA

## Tasks / Subtasks

- [x] Task 1: Motion + skeleton token alignment (AC: #1, #5)
  - [x] Add CSS duration tokens in `globals.css` (light/dark-agnostic): e.g. `--duration-fast: 150ms`, `--duration-state: 200ms`, `--duration-enter: 250ms` (+ optional `--ease-out` matching current `ease-out`). Map Tailwind/theme if the project already maps CSS vars to utilities; otherwise document class usage (`duration-[var(--duration-state)]` or thin utility classes).
  - [x] Replace skeleton **shimmer** with DESIGN **opacity pulse** (`@keyframes` opacity only). Gate under `@media (prefers-reduced-motion: reduce)` — pulse **off**, skeleton **static**. Keep class name stable **or** rename and migrate all `animate-skeleton-shimmer` call sites in one pass (prefer rename to `animate-skeleton-pulse` for honesty).
  - [x] Fix `Skeleton` default background: `bg-skeleton` (token `--color-skeleton`), not `bg-muted`.
  - [x] Clamp purposeful transitions into 150–250ms: Sheet open `duration-300` → enter ≤250ms; keep shell/sidebar `motion-safe` transitions on tokens; ensure toast enter uses `--duration-state` (existing `.animate-toast-slide` is 200ms — good).
  - [x] Verify reduced-motion disables: skeleton pulse, toast slide, and any new feedback motion. Do not weaken existing Epic 1.7 reduced-motion honesty.

- [x] Task 2: Shared feedback primitives (AC: #2, #3, #4)
  - [x] Add shared **inline** message primitive (preferred path): e.g. `apps/web/components/ui/feedback-message.tsx` (or `components/feedback/`) absorbing `AccessStatusMessage` kinds + a11y (`role`/`aria-live`). Re-export or thin-wrap so `AccessStatusMessage` can become a deprecated alias **or** migrate call sites in the proof set; do not leave three divergent StatusMessage implementations for new code.
  - [x] Add **in-place pending** helpers for buttons/forms:
    - Pattern: while `mutation.isPending` / explicit `pending`, keep surface mounted; set `aria-busy` on the form/section; disable submitting control; optional Persian pending label via `operationalCopy` (no spinner replacing the form).
    - Document: filter refetch = keep prior rows **or** show subtle pending on the filter chrome — **never** swap the whole table for a cold-load skeleton mid-session.
  - [x] Enforce **optimistic nothing**: success copy / success toast / “ذخیره شد” only after resolved server success. Pending labels must not read as committed success.

- [x] Task 3: Toast channel (background work only) (AC: #3, #4, #5)
  - [x] Implement toast system under `apps/web/components/ui/` (or `components/feedback/`):
    - **Preferred:** lightweight custom toast consuming existing `.animate-toast-slide` + theme tokens (RTL-aware placement, e.g. bottom-start in RTL) — avoids new dependency sprawl.
    - **Acceptable alternative:** `sonner` (shadcn default) **only if** custom would reinvent stacking/a11y poorly — then theme it to Divan tokens and still honor reduced-motion + precedence rules.
  - [x] Mount a single `<Toaster />` (or host) in authenticated app chrome (`app/(app)/layout.tsx` client child / `AppShell`) — **one** host.
  - [x] Public API sketch (names flexible; document in gallery):
    ```ts
    toastBackground({
      message: string;           // Persian, factual
      href?: string;             // link back to the work (batch, export, job)
      hrefLabel?: string;
      // NO success until caller has server confirmation
    })
    ```
  - [x] **Hard rule in code comments + selfcheck notes:** toast is illegal for ordinary form/row save; those stay inline.
  - [x] Proof consumer: `import-wizard.tsx` — after `executeMutation` **succeeds**, fire **one** toast with link/context to the batch (and keep or trim duplicate inline success so **one channel per event** — prefer toast for background execute + keep result step UI as the workspace, not a second celebratory banner). On failure, prefer **inline** error on the wizard (already present) — do **not** also toast the same failure unless product explicitly chooses toast-only (default: inline for on-wizard errors).

- [x] Task 4: Content-shaped table / panel skeletons (AC: #1)
  - [x] Add `TableSkeleton` (or `GovernedDataTable` built-in loading UI) that mirrors **density** row height (32 compact / 48 comfortable) and approximate **column rhythm** (cells as skeleton blocks in a grid/table row). Header row / column headers render for real (or header-shaped placeholders that match final geometry — prefer real header when columns known).
  - [x] Additive API on `GovernedDataTable`, e.g. `loading?: boolean` and/or `loadingRowCount?: number`. When `loading`:
    - Do **not** show empty-state copy.
    - Do **not** clear layout into a spinner.
    - Preserve sticky / density contracts from 8.6.
  - [x] Fix **personnel list** cold-load: today `tableRows = []` while `searchQuery.isLoading` → empty flash. Wire `loading={searchQuery.isLoading}` (and keep error/suppressed handling distinct from loading).
  - [x] Migrate **at least 2–3** high-traffic cold-load panels from ad-hoc `<Skeleton className="h-24" />` blobs to content-shaped patterns (profile, timeline, or dashboard — pick surfaces that already import `Skeleton`). Full-repo purge of every blob skeleton is **not** required if gallery + table + 2 panels prove the contract; list deferred surfaces in Completion Notes for 8.10.

- [x] Task 5: Precedence contract + banner boundary (AC: #3, #6)
  - [x] Document colocated contract (short markdown next to feedback primitives **or** gallery section):
    | Event type | Channel |
    | --- | --- |
    | Field validation / form save / row commit | Inline |
    | Import execute / export job / long recompute | Toast (+ link) |
    | Staleness / break-glass / integrity degraded | Banner (`BannerStack`) |
  - [x] Do **not** change SensitiveConfirmationDialog / destructive dialog flows (Epic 2/4). Pending on confirm may remain `busy` disable only.
  - [x] Do **not** rewrite stale-recalc banner copy (owned by **8.9**). Do not toast what banners already announce.
  - [x] Leave-guard dialog remains the leave-guard channel — not a toast substitute (8.7 already fixed silent paths).

- [x] Task 6: Gallery + selfcheck (AC: #1–#5, #7)
  - [x] Replace gallery stub with demos: skeleton pulse (and reduced-motion note), `TableSkeleton`, inline `FeedbackMessage`, pending button, toast trigger (background example only).
  - [x] Add `selfcheck:feedback` (AST/filesystem Epic 8 pattern — no Playwright required) that asserts at least:
    - `Skeleton` default uses skeleton token / pulse class (not unguarded shimmer without reduced-motion mate)
    - Toast host exists once under app shell/layout
    - `GovernedDataTable` supports loading skeleton path (export/prop present)
    - Optional: ban `framer-motion` import if project policy is CSS-only
  - [x] Wire script in `apps/web/package.json`.
  - [x] Keep green: `selfcheck:control-contract`, `selfcheck:governed-table`, `selfcheck:layout-system`, `selfcheck:row-actions`, `selfcheck:leave-guard`.

- [x] Task 7: Verify + document (AC: #6, #7)
  - [x] Manual: personnel list cold load — header stable, skeleton rows, then data with no layout jump.
  - [x] Manual: save/finalize on one personnel event or access form — in-place pending; success only after server; no toast.
  - [x] Manual: import execute success — single toast with batch linkage; wizard result still coherent; no double success toast+inline celebration.
  - [x] Manual: OS/browser `prefers-reduced-motion: reduce` — skeleton static; toast/sheet motion off or instant.
  - [x] Manual: sensitive finalize dialog unchanged (focus, blocked reason, confirm label).
  - [x] Typecheck + listed selfchecks green.
  - [x] Completion Notes: pulse-vs-shimmer decision, toast impl choice (custom vs sonner), proof surfaces, deferred panel skeleton list.

## Dev Notes

### Gate (non-negotiable)

- **UX-DR39 / FR-58:** One feedback vocabulary; stated precedence; content-shaped loading; in-place pending; reduced-motion including skeleton pulse.
- **Optimistic nothing** (EXPERIENCE State Patterns): no success before server confirm.
- **Epic 8 presentation-only:** no authz, domain, or governance rule changes.
- **Consume 8.1 / 8.2 / 8.6 / 8.7:** do not restyle row actions, reopen EntityPicker, or rewrite banner copy.
- **Forward UX** is `ux-divan-2026-07-31`; spines win on conflict with mocks. Historical Epic 1.7 toast/skeleton floor is **superseded** by UX-DR39 — upgrade in place, do not reopen Story 1.7.
- **Direction A mockups** remain visual reference for **8.10**; this story hardens the **feedback/motion contract** now.

### Feedback precedence algorithm (implement literally)

```text
on user-visible outcome(event):
  if event is system-wide state (stale | break-glass | integrity) → BannerStack only
  else if event is background job result (import execute | export | long recompute) → Toast (+ href) only
  else → Inline at origin (field | form footer | row) only

forbidden:
  toast + inline success for same save
  toast for staleness already in banner
  skeleton replacing an in-session filter/save surface
  success UI before server confirmation
```

### Motion budget (EXPERIENCE)

| Kind | Duration |
| --- | --- |
| State / hover | 150–200ms |
| Drawer / popover / toast enter | 200–250ms |
| All of the above | disabled under `prefers-reduced-motion` |

### UPDATE files — current state (read before edit)

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `components/ui/skeleton.tsx` | `bg-muted` + shimmer class | `bg-skeleton` + pulse | `data-slot`, `cn`, optional shimmer/pulse flag |
| `app/globals.css` | shimmer keyframes; toast slide unused; `--skeleton` exists | pulse; duration tokens; keep reduced-motion gates | Brand/neutral tokens from 8.2; light/dark |
| `governed-data-table.tsx` / `types.ts` | empty state; no loading skeleton | additive `loading` UI | 4b.4/8.6/8.7 contracts (filters, sort, pagination, live region, sticky, density, row actions, `onRowClick`) |
| `personnel-list-panel.tsx` | clears rows on `isLoading` | wire table loading skeleton | search authz, suppressed cohort, row actions |
| `import-wizard.tsx` | inline `localMessage` / errors after execute | toast for background success per precedence | SensitiveConfirmationDialog execute path; SoD; steps |
| `access-status-message.tsx` | shared-ish status | become alias or migrate to shared FeedbackMessage | a11y roles |
| `app/(app)/dev/gallery/page.tsx` | stub line for 8.8 | real demos | production `notFound` / allowlists |
| `app/(app)/layout.tsx` / `AppShell` | BannerStack only | mount Toaster host | auth gate, banner slot, leave-guard |
| `ui/sheet.tsx` | open duration-300 | ≤250ms enter | radix sheet behavior, focus trap |

### Anti-patterns (LLM footguns)

- **Do not** add `framer-motion` for this story — CSS tokens + existing animate utilities are enough.
- **Do not** invent a page-level Spinner as the primary loading affordance for tables.
- **Do not** toast every mutation “for consistency.”
- **Do not** put import execute success on banner.
- **Do not** change break-glass / stale banner stacking order (stale above break-glass — Epic 1.7 / UX-DR5).
- **Do not** treat leave-guard dialog as broken if it is not a toast — different channel.
- **Do not** expand into 8.9 copy (purpose lines, glossary, recalc banner prose).
- **Do not** claim FR-58 production-complete for all surfaces — prove contract + key migrations; 8.10 gates consistency.

### Previous story intelligence

**From 8.7 (done, `d41b1d2`):** Left skeletons/toast explicitly to **8.8**. Leave-guard silent paths fixed — do not re-break. Row actions icon-only — feedback story must not regress `RowActionButton` / overflow. Selfcheck pattern = AST/filesystem + `package.json` script.

**From 8.6 (`56d7584`):** Density 32/48 and sticky chrome are the skeleton rhythm source of truth. Session `loading` in table is **prefs/session readiness**, not query cold-load — do not conflate. Additive props only.

**From 8.2:** `--skeleton` / `--color-skeleton` already tokenized; gallery stub reserved this story. Layout selfcheck must stay green when touching `globals.css`.

**From 8.1 gap list:** Deferred exactly “Skeleton / toast / feedback precedence system” → this story.

**Open carry-ins (do not expand scope unless blocking):** logout leave-guard wiring; person-create form dedupe; PopulationPort honesty; AD-6 projector hardening; enforcement-matrix DoD for later integration stories.

### Git intelligence

Recent commits: `d41b1d2` story 8.7 → `56d7584` story 8.6 → `e090c55` story 8.5 → `d0b45e4` story 8.4 → `07f2b28` story 8.3. Baseline for this story file: **`d41b1d2`**. Expect touch set under `apps/web/components/**`, `apps/web/app/globals.css`, gallery, layout/shell, `package.json`, optional thin `lib/feedback*.ts` + selfcheck.

### Latest tech notes

- **Toast:** Ecosystem default for shadcn/Next App Router is **Sonner**; this repo already prepared **custom CSS** (`.animate-toast-slide`) and prefers low dependency churn (8.7: dropdown from unified `radix-ui`). Prefer **custom** toast aligned to tokens/RTL; Sonner only if a11y/stacking cost is unjustified.
- **React Query:** `isPending` / `isLoading` remain the pending signals — wrap presentation, do not replace data layer.
- **No optimistic UI libraries** required; server confirmation is the gate.
- **Reduced motion:** honor both CSS media query and any existing `motion-safe:` / `motion-reduce:` Tailwind variants consistently.

### Project structure notes

- UI lives in `apps/web` only — no `@divan/ui` package.
- Prefer new primitives under `apps/web/components/ui/` or `apps/web/components/feedback/`.
- Selfcheck: `apps/web/lib/feedback.selfcheck.ts` (or colocated) + `selfcheck:feedback` script.
- Story / sprint docs: `_bmad-output/implementation-artifacts/` only. ARCHITECTURE-SPINE has no feedback AD — PRD FR-58 + UX-DR39 are SoT for this chrome.

### Testing requirements

| Check | Command / method |
| --- | --- |
| Feedback contract | `pnpm --filter @divan/web selfcheck:feedback` (as implemented) |
| Governed table | `pnpm --filter @divan/web selfcheck:governed-table` |
| Layout tokens | `pnpm --filter @divan/web selfcheck:layout-system` |
| Control / row / leave-guard | existing Epic 8 selfchecks stay green |
| Types | `pnpm --filter @divan/web typecheck` |
| Manual | Cold-load personnel list; in-place save pending; import execute toast; reduced-motion; sensitive dialog unchanged |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8 / Story 8.8 L1481–1496; UX-DR39; Epic 9 depends on feedback system L1538]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-58 feedback vocabulary + reduced-motion]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — State Patterns L77–90; Feedback and Motion L92–98]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — colors.skeleton; component skeleton L324; Do's/Don'ts L341]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — Story 8.8 / UX-DR39 amendment]
- [Source: `_bmad-output/implementation-artifacts/8-1-interaction-audit-gap-list.md` — Deferred 8.8]
- [Source: `_bmad-output/implementation-artifacts/8-2-visual-design-language-layout-system.md` — skeleton token + gallery stub]
- [Source: `_bmad-output/implementation-artifacts/8-6-governed-table-readability-upgrade.md` — density/chrome boundary]
- [Source: `_bmad-output/implementation-artifacts/8-7-row-action-affordance-dead-click-elimination.md` — deferred skeletons/toast; leave-guard honesty]
- [Source: `apps/web/components/ui/skeleton.tsx`]
- [Source: `apps/web/app/globals.css` — skeleton/toast keyframes]
- [Source: `apps/web/components/personnel/personnel-list-panel.tsx` — loading clears rows]
- [Source: `apps/web/components/import/import-wizard.tsx` — execute background success]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- selfcheck:feedback / layout-system / governed-table / control-contract / row-actions / leave-guard — all green
- `pnpm --filter @divan/web typecheck` — green

### Implementation Plan

- Pulse over shimmer (DESIGN.md); duration tokens `--duration-fast|state|enter`; custom toast (no sonner/framer-motion).
- Additive `GovernedDataTable` `loading` + `TableSkeleton`; personnel cold-load wired without clearing rows mid-fetch incorrectly.
- `FeedbackMessage` + `PendingSurface`; `AccessStatusMessage` thin alias; precedence in `FEEDBACK.md`.

### Completion Notes List

- **Pulse vs shimmer:** Landed DESIGN opacity pulse (`animate-skeleton-pulse`); removed translate shimmer.
- **Toast impl:** Custom lightweight toast (`toastBackground` + `Toaster` in `AppShell`); no Sonner / framer-motion.
- **Proof surfaces:** personnel list cold-load skeleton; import execute → toast only (inline success cleared); gallery demos; profile / timeline / dashboard content-shaped skeletons.
- **Deferred blob skeletons (8.10):** report catalogue, correction-cases, ops health, launch-artifact, headcount panels (approval/exemption/override), org hierarchy / ladder / flat-job-ref, lifecycle panel, foreshadow panels, decision-publication — still ad-hoc `h-*` blobs.
- SensitiveConfirmationDialog / BannerStack copy / leave-guard algorithm untouched (presentation-only).

### File List

- `_bmad-output/implementation-artifacts/8-8-feedback-loading-motion-system.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/app/(app)/dev/gallery/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/components/access/access-status-message.tsx`
- `apps/web/components/app-shell.tsx`
- `apps/web/components/app-sidebar.tsx`
- `apps/web/components/dashboard/dashboard-panel.tsx`
- `apps/web/components/feedback/FEEDBACK.md`
- `apps/web/components/governed-data-table/governed-data-table.tsx`
- `apps/web/components/governed-data-table/index.tsx`
- `apps/web/components/governed-data-table/table-skeleton.tsx`
- `apps/web/components/governed-data-table/types.ts`
- `apps/web/components/import/import-wizard.tsx`
- `apps/web/components/personnel/person-profile-view.tsx`
- `apps/web/components/personnel/personnel-event-timeline.tsx`
- `apps/web/components/personnel/personnel-list-panel.tsx`
- `apps/web/components/ui/feedback-message.tsx`
- `apps/web/components/ui/pending-surface.tsx`
- `apps/web/components/ui/sheet.tsx`
- `apps/web/components/ui/skeleton.tsx`
- `apps/web/components/ui/toast.tsx`
- `apps/web/lib/feedback.selfcheck.ts`
- `apps/web/lib/operational-copy.ts`
- `apps/web/package.json`

### Review Findings

- [x] [Review][Patch] Dashboard filter apply replaces metric grid with cold-load skeleton — use prior data / skeleton only when `!data` (AC2) [`apps/web/components/dashboard/dashboard-panel.tsx`:184]
- [x] [Review][Patch] Sheet enter/exit animate-in/out not gated under `prefers-reduced-motion` (AC5) [`apps/web/components/ui/sheet.tsx`:73]
- [x] [Review][Patch] Hide pagination chrome while `loading` (page “1 of 0”) [`apps/web/components/governed-data-table/governed-data-table.tsx`:835]
- [x] [Review][Patch] Loading caption is `aria-hidden`; live region still announces totals — sync loading text into live region / visible status [`apps/web/components/governed-data-table/governed-data-table.tsx`:495]
- [x] [Review][Patch] Sort/filter/pager remain interactive under `aria-busy` loading skeleton [`apps/web/components/governed-data-table/governed-data-table.tsx`:741]
- [x] [Review][Patch] Personnel `loading={isLoading}` can skeletonize mid-session query-key changes — cold-load only when no data [`apps/web/components/personnel/personnel-list-panel.tsx`:284]
- [x] [Review][Patch] `TableSkeleton` missing sticky identifier/actions geometry from 8.6 [`apps/web/components/governed-data-table/table-skeleton.tsx`:49]
- [x] [Review][Patch] Toast: always mount `aria-live` host; avoid nested live+status; clear dismiss timers; guard `window` [`apps/web/components/ui/toast.tsx`:54]
- [x] [Review][Patch] Import success toast should include batch id context (href `/import` OK without batch route) [`apps/web/components/import/import-wizard.tsx`:254]
- [x] [Review][Patch] Governed table loading copy hardcoded — reuse `operationalCopy` [`apps/web/components/governed-data-table/governed-data-table.tsx`:624]
- [x] [Review][Patch] `TableSkeleton` `rowCount` ≤0 / NaN yields empty busy body — clamp to ≥1 [`apps/web/components/governed-data-table/table-skeleton.tsx`:41]
- [x] [Review][Patch] Gallery pending demo `setTimeout` without unmount cleanup [`apps/web/app/(app)/dev/gallery/page.tsx`:GalleryPendingDemo]
- [x] [Review][Defer] Local `StatusMessage` clones in org/headcount/access panels not migrated to `FeedbackMessage` — deferred, pre-existing / 8.10 proof-set scope [`org-hierarchy-panel.tsx` et al.]
- [x] [Review][Defer] `PendingSurface` / `pendingLabel` unused outside gallery — deferred, production busy patterns already exist [`pending-surface.tsx`]
- [x] [Review][Defer] Toast dismiss control / pause-on-hover polish — deferred, pre-existing gap vs MVP channel [`toast.tsx`]

## Change Log

- 2026-07-31: Story context created (ready-for-dev) — ultimate context engine analysis completed.
- 2026-07-31: Implemented feedback/loading/motion system (UX-DR39) — pulse skeletons, toast channel, GovernedDataTable loading, gallery + selfcheck:feedback; status → review.
- 2026-07-31: Code review triage — 12 patch, 3 defer, 5 dismissed (duration-fast unused, FeedbackMessage kind cosmetics, shimmer alias, AST selfcheck depth, batch deep-link N/A).
- 2026-07-31: Code review patches applied — dashboard keepPreviousData, sheet motion-safe, GDT loading chrome/a11y, toast host hardening, personnel cold-load, status → done.
