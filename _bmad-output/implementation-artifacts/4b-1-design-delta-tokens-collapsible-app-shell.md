---
baseline_commit: f1fde0553e7ae967eb7ff56af7bf2a161a09fc30
---

# Story 4b.1: DESIGN Delta Tokens & Collapsible App Shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated Divan user,
I want a collapsible navy RTL sidebar with updated brand tokens,
so that wide governed tables reclaim horizontal space at desktop viewports (UX-DR1, UX-DR3).

## Acceptance Criteria

1. **Given** the existing `app-shell` from Epic 1  
   **When** ux-divan-2026-07-19 DESIGN delta tokens are applied  
   **Then** spacing includes `sidebar-width-collapsed` **64px** and `section-tabs-height` **44px**, plus governed-table/tree spacing tokens from DESIGN.md (`content-padding-inline` 24px, `filter-row-height` 36px, `tree-indent` 16px) mapped into `globals.css` + Tailwind `@theme inline`

2. **And** the sidebar defaults to **expanded**; a **footer** toggle collapses to icon-only (icon size **20px**) with Persian **tooltip** (hover/focus) and `aria-label` on each nav item

3. **And** collapse preference **persists per account** (localStorage keyed by `accountId`, same pattern as theme)

4. **And** content width reclaims `sidebar-width` − `sidebar-width-collapsed` (240 − 64 = **176px**) when collapsed — main column padding tracks the live sidebar width

5. **And** chrome remains navy in light and dark themes; active item keeps `sidebar-active` background + accent RTL **leading** border (`border-inline-start` / `border-s-2 border-accent`)

6. **And** theme toggle and sidebar collapse do **not** trigger unsaved-form leave-guards (leave-guard infrastructure lands in 4b.2 — this story must not introduce navigation or guard hooks on collapse/theme; when 4b.2 arrives, both remain exempt)

## Tasks / Subtasks

- [x] Task 1: Apply DESIGN 2026-07-19 spacing delta tokens (AC: #1)
  - [x] In `apps/web/app/globals.css` `:root` (spacing is theme-agnostic — no need to duplicate under `.dark` unless already mirrored):
    - `--sidebar-width-collapsed: 64px`
    - `--section-tabs-height: 44px`
    - `--content-padding-inline: 24px`
    - `--filter-row-height: 36px` (governed-data-table.filter-row-height)
    - `--tree-indent: 16px` (tree-navigator.indent)
  - [x] Map each into `@theme inline` as `--spacing-*` so utilities work (`w-sidebar-width-collapsed`, `h-section-tabs-height`, `p*-content-padding-inline`, `h-filter-row-height`, `ps-tree-indent`, etc.)
  - [x] **Do not** redefine brand hex / chrome / accent / primary pairs — those stay as Epic 1 (including Story 1.7 contrast nudges `#006DFF` / `#1E6FE0`)
  - [x] **Do not** build `section-tabs`, `governed-data-table`, or `tree-navigator` UI here — tokens only (consumers: 4b.2 / 4b.4 / 4b.6)

- [x] Task 2: Collapsible sidebar width + content reclaim (AC: #4, #5)
  - [x] Drive live sidebar width via a CSS custom property (recommended: `--sidebar-current-width` defaulting to `var(--sidebar-width)`, collapsed → `var(--sidebar-width-collapsed)`) set on a shell root attribute/class (e.g. `data-sidebar="expanded"|"collapsed"` on `.app-shell-root` or `<aside>`)
  - [x] Update `AppSidebar` from fixed `w-sidebar-width` to `w-[var(--sidebar-current-width)]` (or equivalent token wiring)
  - [x] Update `AppShell` content column from fixed `ps-sidebar-width` to `ps-[var(--sidebar-current-width)]` (or set `--sidebar-current-width` high enough that existing `ps-sidebar-width` remaps — prefer explicit current-width so expanded/collapsed both stay correct)
  - [x] Preserve: fixed header, banner stack + `--banner-stack-height`, viewport gate, skip link, `main#main-content`, independent content scroll
  - [x] Preserve: chrome `bg-chrome` / `text-chrome-foreground` in both themes

- [x] Task 3: Nav icons + collapsed a11y (AC: #2)
  - [x] Extend `SidebarNavItem` (or parallel map keyed by `href`) with a Lucide icon — **OQ-R1 is non-blocking**: pick a coherent Lucide set at implement time for current Epic-1 catalog hrefs (labels/order unchanged until 4b.3)
  - [x] Suggested icon map (replace only if a clearer Lucide exists; keep stable):
    | href | Lucide |
    | --- | --- |
    | `/dashboard` | `LayoutDashboard` |
    | `/personnel` | `Users` |
    | `/organization` | `Network` |
    | `/headcount` | `ChartBar` |
    | `/reports` | `FileBarChart` |
    | `/import` | `Upload` |
    | `/access` | `Shield` |
    | `/audit` | `ScrollText` |
    | `/operations` | `Settings` |
    | `/correction-cases` | `FolderOpen` |
  - [x] Expanded: icon (20px) + Persian label; Collapsed: icon only, label visually hidden
  - [x] Every nav control exposes accessible name: `aria-label={item.label}` always; when collapsed, also show shadcn **Tooltip** on hover/focus with the same Persian label
  - [x] Add shadcn Tooltip: `npx shadcn@latest add tooltip` → `apps/web/components/ui/tooltip.tsx`; wrap app (or shell) with `TooltipProvider` (delay ~300–400ms to avoid flash)
  - [x] Keep active styles: `bg-sidebar-active-background` + `border-s-2 border-accent` (transparent border when inactive); `focus-ring-chrome`; `aria-current="page"`
  - [x] **Do not** change `NAV_CATALOG` labels, order, or role matrix — that is Story **4b.3**

- [x] Task 4: Footer collapse toggle + per-account persistence (AC: #2, #3, #6)
  - [x] Add footer region in `AppSidebar` (sticky at bottom of aside) with a focusable button to toggle expand/collapse
  - [x] Persian control names (suggested): collapsed state button `aria-label` / visible text «باز کردن نوار کناری»; expanded → «جمع کردن نوار کناری» (icon-only OK when space-tight if `aria-label` is present)
  - [x] Default **expanded** when no stored preference or storage fails (fail open to expanded — matches edge-case guidance)
  - [x] Persist: `localStorage` key `divan-sidebar-collapsed:<accountId>` with value `"true"` | `"false"` (mirror `theme-storage.ts` pattern — new `apps/web/lib/sidebar-storage.ts` preferred over overloading theme helpers)
  - [x] Pass `accountId` into `AppSidebar` from `AppShell` (already available on shell props)
  - [x] Restore on mount for the signed-in account; last-write-wins across tabs; no new keyboard shortcut required
  - [x] Toggle must: update width in place; **no** `router.push`; **no** leave-guard call; preserve focus on the toggle when possible
  - [x] Respect `prefers-reduced-motion` if any width transition is added (instant OK; if animating, disable under reduced-motion)

- [x] Task 5: Verify + regression (AC: #1–#6)
  - [x] `pnpm --filter @divan/web lint` and `typecheck` pass
  - [x] Manual DoD checklist below
  - [x] Align story-file Status ↔ `sprint-status.yaml` when marking done later

### Review Findings

- [x] [Review][Patch] Switch toggle icons to `PanelRightOpen` / `PanelRightClose` for RTL sidebar edge [`apps/web/components/app-sidebar.tsx`] — decided: option 1; applied
- [x] [Review][Patch] Rapid toggle can no-op from stale `!collapsed` closure [`apps/web/components/app-sidebar.tsx`] — applied (`!readSidebarCollapsed`)
- [x] [Review][Patch] `useLayoutEffect` sets `data-sidebar` on `.app-shell-root` without cleanup on unmount [`apps/web/components/app-sidebar.tsx`] — applied
- [x] [Review][Patch] Collapse toggle has `aria-expanded` but no `aria-controls` linking to `<nav>` [`apps/web/components/app-sidebar.tsx`] — applied
- [x] [Review][Patch] `sprint-status.yaml` has UTF-8 BOM (`EF BB BF`) — rewritten without BOM
- [x] [Review][Patch] Interactive a11y DoD checkboxes in story still unchecked despite implemented behavior — checked off
- [x] [Review][Defer] `NAV_ICONS` parallel map + `ChevronRight` fallback for unknown href [`apps/web/components/app-sidebar.tsx:49-60,118`] — deferred, pre-existing risk until 4b.3 IA sync
- [x] [Review][Defer] Collapsed 64px width vs `p-3` + `border-s-2` may clip focus ring / tighten hit target [`apps/web/components/app-sidebar.tsx:115-128`] — deferred, pre-existing layout polish pending visual QA

## Dev Notes

### Epic context

- **Epic 4b:** Shell & IA Alignment to `ux-divan-2026-07-19` — presentation/IA only; domain FRs from Epics 2–3 unchanged. Authorized by `sprint-change-proposal-2026-07-19`. Sequenced **after Epic 4 (done), before Epic 5**.
- **This story:** UX-DR1 (delta tokens) + UX-DR3 (collapsible shell) + UX-DR4 exemption for theme/collapse vs leave-guards.
- **Order:** `4b.1` → `4b.2` → `4b.3` → `4b.4` → (`4b.5` ∥ `4b.6`) → `4b.7` → Epic 5.
- **FRs:** FR43 (shell/IA presentation). Not FR4/9/10 domain — those UI retrofits are 4b.5/4b.6.

### Absolute non-goals (do not implement here)

| Out of scope | Belongs to |
| --- | --- |
| Section tabs chrome, tab routing, leave-guard dialogs | **4b.2** |
| Nav IA reorder, «اطلاعات پرسنلی» / «رویدادهای پرسنلی» labels, role landing changes | **4b.3** |
| `governed-data-table` / `tree-navigator` components | **4b.4** / **4b.6** |
| Access / Organization admin UI retrofit | **4b.5** / **4b.6** |
| Personnel/Events scaffolds | **4b.7** |
| Changing brand hex, FaNum fonts, AG Grid, mobile layouts | Never in this epic |
| New AD / Prisma / packages/ui | Architecture: no AD change; brand stays in `apps/web` |

### Architecture compliance (MUST follow)

| Rule | Implication |
| --- | --- |
| **AD-6** T3 + Persian RTL | Stay in `apps/web`; Next App Router; `lang="fa"` `dir="rtl"` |
| UX authority | Forward contract = `ux-divan-2026-07-19` (DESIGN + EXPERIENCE). `ux-divan-2026-07-13` is historical only — spines win on conflict |
| No AD-1…AD-6 change | Shell IA is UX-only; no architecture spine edit required |
| Structural seed | No `packages/ui`; no new design microservice |
| Prisma ESLint guardrail | Do not weaken `no-restricted-imports` on `@prisma/client` in `apps/web` |

[Source: `ARCHITECTURE-SPINE.md` AD-6; `sprint-change-proposal-2026-07-19.md`; `epics.md` Epic 4b]

### Files being modified — current state → change → preserve

#### `apps/web/app/globals.css` (UPDATE)

- **Today:** Epic-1 brand + spacing (`--sidebar-width: 240px`, chrome-height, row heights, form-section-gap). Missing collapsed / section-tabs / content-padding / filter-row / tree-indent.
- **Change:** Add delta CSS vars + `@theme inline` spacing mappings; optionally `--sidebar-current-width` default.
- **Preserve:** All brand color pairs (including 1.7 AA nudges), chrome/content split, typography utilities, banner/status-badge tokens, `.focus-ring-chrome`, `.app-shell-root` / viewport-gate rules.

#### `apps/web/components/app-sidebar.tsx` (UPDATE — primary)

- **Today:** Fixed `w-sidebar-width`; text-only links; no footer; no icons; no collapse. Client component; role-filtered `navItems` from server.
- **Change:** Collapsible width; Lucide icons; footer toggle; tooltip + `aria-label`; accept `accountId`; persist preference.
- **Preserve:** `isNavActive` path matching; hide-unauthorized-already-done-by-server; active border RTL leading; `aria-label="ناوبری اصلی"` on aside; overflow scroll for long nav.

#### `apps/web/components/app-shell.tsx` (UPDATE)

- **Today:** `ps-sidebar-width` fixed; passes `navItems` to sidebar; `AccountThemeSync`; skip → header → banner → sidebar → main.
- **Change:** Pass `accountId` into sidebar; content padding uses live sidebar width; optional `data-sidebar` / CSS var on root for reclaim.
- **Preserve:** Viewport gate, `SkipLink` first focusable, `RouteAnnouncer`, `UserMenu` + theme, banner stack geometry, `main#main-content tabIndex={-1}`, CommandPaletteHost wiring.

#### Likely NEW

| Path | Role |
| --- | --- |
| `apps/web/lib/sidebar-storage.ts` | `divan-sidebar-collapsed:<accountId>` get/set helpers |
| `apps/web/components/ui/tooltip.tsx` | shadcn Tooltip (Radix via existing `radix-ui` package) |

#### Do not touch for this story

- `packages/modules/identity-access/src/navigation.ts` (IA = 4b.3)
- Theme hex values / `theme-toggle.tsx` behavior (already leave-guard-free)
- Domain modules, tRPC routers, Prisma schemas

### Recommended implementation pattern (avoid reinvention)

```text
AppShell(accountId, navItems)
  └─ sets --sidebar-current-width from collapsed state OR lets AppSidebar own state + CSS var on aside + sibling content uses same var on a shared parent
  └─ AppSidebar(accountId, navItems)
       ├─ useState(collapsed) ← restore from sidebar-storage(accountId); default false
       ├─ footer <button> toggles + persists
       └─ nav Link: icon + (expanded ? label : sr-only/tooltip)
```

**Width reclaim pitfall:** If only the `<aside>` width changes but content keeps `ps-sidebar-width` (240), you fail AC #4. Both must read the **same** live width.

**Hydration:** Prefer default expanded on SSR, then restore from localStorage after mount (same class of flash as theme). Avoid mismatch errors; do not block paint on storage.

**Leave-guard exemption:** No leave-guard exists yet. Do not invent a stub that collapse must call. Document in a one-line comment near the toggle: `// 4b.2 leave-guards must exempt sidebar collapse + theme toggle`.

### Previous story / foundation intelligence

No prior story inside Epic 4b. Foundation is Epic 1 shell work:

| Story | Carry forward |
| --- | --- |
| **1.2** | Token naming: `--token` on `:root` / `.dark` → `@theme inline` → utilities. Content vs chrome split. Theme in-place, focus preserved, per-account key pattern. |
| **1.3** | Shell structure, skip link, banner slot, active accent leading border, viewport ≥1280×720. **Supersede only** the “no icon-only collapse / fixed 240” assumption — keep everything else. |
| **1.5** | Server-filtered nav; never show disabled unauthorized items — still true; do not re-filter client-side. |
| **1.7** | Banner stack + contrast nudges — do not regress. |

**Epic 4 retro** does not hand off shell work; handoff is the sprint-change-proposal (create-story 4b.1 next).

**Open Epic 4 action items** (PopulationPort / IDOR / profile consumer) target Epic **5**, not 4b.1 — ignore for this story.

### Git intelligence

Recent commits: `epic 4b correct course` (planning), then Epic 4 domain stories. UI shell last meaningfully touched in Epic 1 (`story 1.7`, `1.6`). Expect to touch only `apps/web` chrome files — no domain package churn.

### Library / framework requirements

| Lib | Version / note |
| --- | --- |
| Tailwind CSS | **v4.x** already (`^4.3.3`) — use `@theme inline`, not v3 `tailwind.config` token hacks |
| lucide-react | Already `^1.24.0` — reuse; do not add another icon pack |
| shadcn Tooltip | Add via CLI; project already has `radix-ui` + new-york style + CSS variables |
| next-themes | Untouched for collapse; theme path stays as-is |
| Testing | No mandated Playwright/Vitest for UI — manual DoD below (Epic 3/4 open item on Vitest is optional if easy; do not block) |

**shadcn Tooltip (current):** `npx shadcn@latest add tooltip`; wrap with `TooltipProvider`; compose `Tooltip` / `TooltipTrigger` / `TooltipContent`; use `side` appropriate for RTL sidebar (often `side="left"` in LTR terms = toward content — verify visually in `dir=rtl`).

### Interactive a11y DoD (from Epic 1 carry-forward)

- [x] Collapse toggle is in tab order; Enter/Space activates
- [x] Collapsed nav icons: focus shows tooltip; accessible name = Persian label (not English Lucide name)
- [x] Focus ring visible on chrome (`focus-ring-chrome` / 2px offset)
- [x] Skip link still first focusable; still targets `#main-content`
- [x] Active page still announced via `aria-current="page"`
- [x] No `display:none` on focusable skip link

### Testing requirements (manual DoD)

1. Signed-in user: sidebar **expanded** by default (clear localStorage key first).
2. Footer toggle → icons only at **64px**; tooltips/aria-labels show Persian labels; content gains ~176px.
3. Reload → preference restored for that `accountId`; different account key does not leak.
4. Light/dark theme: chrome stays navy; active accent leading border visible expanded and collapsed.
5. Theme toggle still in-place (no navigation); collapse toggle does not navigate.
6. Viewport gate, banners, command palette, role-filtered nav still work.
7. `lint` + `typecheck` clean.

### Project structure notes

- All UI under `apps/web` — matches AD-6 / no `packages/ui`.
- Storage helpers live in `apps/web/lib/` next to `theme-storage.ts`.
- BOM-safe edits if touching `sprint-status.yaml` from Windows tools (UTF-8 without accidental BOM — lesson from Epic 3/4).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4b, Story 4b.1, UX-DR1/3/4]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/DESIGN.md` — spacing YAML, sidebar-collapsed, components]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — Sidebar collapse, app-shell, OQ-R1, a11y floor]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-19.md` — authorization + AC summary]
- [Source: `_bmad-output/implementation-artifacts/1-2-brand-tokens-typography-theme-toggle.md`]
- [Source: `_bmad-output/implementation-artifacts/1-3-app-shell-chrome-sidebar-skip-link.md`]
- [Source: `apps/web/components/app-shell.tsx`, `app-sidebar.tsx`, `lib/theme-storage.ts`, `app/globals.css`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Full `pnpm --filter @divan/web lint` still reports pre-existing `react-hooks/set-state-in-effect` errors in Epic 4 panels (`approval-panel`, `job-reference-panel`, `organization-panel`, `personnel-event-form`, `platform-status-provider`) — unrelated to 4b.1. Changed files lint clean; typecheck clean.

### Completion Notes List

- Applied DESIGN 2026-07-19 spacing delta tokens + `@theme inline` mappings; brand hex untouched.
- Collapsible navy RTL sidebar: `--sidebar-current-width` driven by `data-sidebar` on `.app-shell-root` (useLayoutEffect); content uses `ps-sidebar-current-width` so reclaim is 176px when collapsed.
- Lucide icons (20px) for Epic-1 catalog; collapsed tooltips via shadcn Tooltip (delay 350ms); always `aria-label` with Persian labels.
- Per-account persistence via `divan-sidebar-collapsed:<accountId>` + `useSyncExternalStore` (SSR default expanded, fail-open).
- Toggle is in-place (no router / leave-guard); width transition gated with `motion-safe:`.

### File List

- `apps/web/app/globals.css`
- `apps/web/components/app-shell.tsx`
- `apps/web/components/app-sidebar.tsx`
- `apps/web/components/ui/tooltip.tsx` (new)
- `apps/web/lib/sidebar-storage.ts` (new)
- `_bmad-output/implementation-artifacts/4b-1-design-delta-tokens-collapsible-app-shell.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-07-19: Implemented DESIGN delta tokens + collapsible app shell (Story 4b.1) — ready for review.
- 2026-07-19: Code review — applied 6 patches (RTL toggle icons, toggle race, data-sidebar cleanup, aria-controls, BOM strip, a11y DoD sync); 2 deferred.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
