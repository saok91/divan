---
baseline_commit: c1a0c36
---

# Story 4b.2: Section Tabs Chrome, Routing & Leave-Guards

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user working in a major nav surface,
I want horizontal section tabs whose URL reflects the active tab, with leave-guards on dirty forms/previews,
so that I do not lose draft work when navigating (UX-DR25).

## Acceptance Criteria

1. **Given** a major nav surface that hosts section tabs (thin shells acceptable on surfaces that get full IA in 4b.5–4b.7)  
   **When** section tabs render  
   **Then** they use `tablist` / `tab` / `tabpanel` semantics and the **URL reflects** the selected tab

2. **And** route announcements include **surface name + selected tab** (polite live region)

3. **When** the user attempts to leave a dirty form or loaded import preview via **section tab, sidebar, command palette, or history**  
   **Then** a leave-guard offers **ماندن · دور انداختن · ذخیره** (Stay · Discard · Save) — or Stay · Discard when no save handler — and **blocks navigation until resolved**

4. **And** theme toggle and sidebar collapse remain **exempt** from leave-guards (no navigation, no guard dialog)

5. **And** section tabs may **scroll horizontally** at 1280×720 without causing **page-level** horizontal scroll

## Tasks / Subtasks

- [x] Task 1: Shared `section-tabs` chrome primitive (AC: #1, #5)
  - [x] Add `apps/web/components/section-tabs.tsx` (client) — **not** under a new `packages/ui`
  - [x] Props: `ariaLabel`, `tabs: { id, label, href }[]`, optional `className`; active tab from `usePathname()` (+ optional `useSearchParams` if query strategy chosen — prefer **path segments**, see Dev Notes)
  - [x] Semantics: outer `role="tablist"`; each control `role="tab"` with `aria-selected`, `aria-controls`, roving `tabIndex` (selected = 0; others = −1); ArrowRight/ArrowLeft (+ Home/End) move selection in **RTL visual order**; Enter/Space activates navigation
  - [x] Visual: height `h-section-tabs-height` (44px); full-width strip; active underline `border-b-2 border-primary` (DESIGN `{section-tabs.active-border}`); inactive muted; `overflow-x-auto` on the strip only; `whitespace-nowrap` labels; no page-level overflow
  - [x] Prefer Next `<Link href={tab.href}>` for each tab (URL is source of truth) — do **not** use local-only state without URL sync
  - [x] Optional: `npx shadcn@latest add tabs` only if it helps a11y wiring; otherwise hand-roll like `job-reference-panel` tablist (do **not** copy that panel’s local-state-only pattern for product section tabs)
  - [x] Do **not** build governed-data-table / tree-navigator / quick-edit modal here

- [x] Task 2: Thin URL-backed tab shells on major surfaces (AC: #1)
  - [x] Prove the primitive on **at least** these existing routes (keep Epic-1 hrefs until 4b.3): `/personnel`, `/organization`, `/headcount`, `/access`
  - [x] Recommended shape: App Router nested segments under each surface, e.g. `app/(app)/access/(tabs)/layout.tsx` + `page.tsx` redirect to default tab + `.../people/page.tsx` etc. — **or** equivalent `?tab=` if nested routing is too invasive; pick **one** strategy and use it consistently
  - [x] Tab labels for shells (placeholders until 4b.5–4b.7 fill content):
    | Surface | Tabs (Persian) | Default |
    | --- | --- | --- |
    | `/personnel` | فهرست پرسنل · افزودن · ورود گروهی · فرهنگ داده | فهرست پرسنل |
    | `/organization` | سلسله‌مراتب · نقش سازمانی · عنوان شغلی · لدر و گرید · ارشدیت | سلسله‌مراتب |
    | `/headcount` | هدکانت · ایجاد · ورود گروهی | هدکانت |
    | `/access` | افراد و دسترسی · نقش‌ها · محدوده‌ها · دسترسی اضطراری | افراد و دسترسی |
  - [x] **Default tab hosts existing page content** (PersonnelPanel + forms, AccessAdminPanel, OrganizationPanel, headcount UI) so nothing regresses; other tabs render a short Persian placeholder («محتوای این بخش در استوری بعدی تکمیل می‌شود.») — **do not** relocate `PersonnelEventForm` to a new رویدادهای پرسنلی route (that is **4b.7**); **do not** rename sidebar «پرسنل» (that is **4b.3**)
  - [x] Preserve `assertPageAccess` / Layout≠RSC on every new page segment before any client data load
  - [x] Surfaces without tabs in this story (dashboard, reports, import, audit, operations, correction-cases) stay as-is

- [x] Task 3: Leave-guard substrate + Persian dialog (AC: #3, #4)
  - [x] Add a shell-level provider (e.g. `LeaveGuardProvider` in `apps/web/components/leave-guard/`) mounted from `AppShell` (or `(app)/layout` client host) so sidebar + palette share one registry
  - [x] API sketch (names flexible; behavior not):
    - `useLeaveGuardRegistration({ id, isDirty, onSave?: () => Promise<boolean>, onDiscard?: () => void })`
    - `requestNavigation(href: string): Promise<boolean>` — returns true if navigation may proceed
    - Save button shown only when `onSave` is registered; otherwise Stay · Discard
  - [x] Dialog copy (exact / near-exact):
    - Title/body lead: «تغییرات ذخیره نشده‌اند.» (extend `operationalCopy.unsavedForm` — shorten body to match EXPERIENCE; keep fact + next step)
    - Import preview variant when registered as preview: «پیش‌نمایش دسته {id} ذخیره نشده.» (`operationalCopy` helper with batch id)
    - Actions: «ماندن» (Stay / dismiss) · «دور انداختن» (Discard — reuse tone of `authzChangedDiscard`) · «ذخیره» or «ذخیره پیش‌نویس» when save exists
  - [x] Use existing shadcn `Dialog` (one dialog stack — never dialog-on-dialog). Pattern after `authz-changed-modal` / `sensitive-confirmation-dialog`
  - [x] **Exempt:** sidebar collapse toggle + theme toggle — already no `router.push`; add regression comment if touching those files; guard must not subscribe to collapse/theme storage events as navigation
  - [x] Keep native `beforeunload` when dirty (browser dialog OK for refresh/close) — already on `personnel-event-form`; centralize or dual-register without double-prompt spam

- [x] Task 4: Wire all navigation channels (AC: #3)
  - [x] **Sidebar:** on each `Link`, use Next.js 16 `onNavigate` to `preventDefault()` when dirty, then open leave-guard; on confirm, `router.push` / allow navigation. Do **not** add a third-party leave-guard package (`next-stay`, etc.) unless first-party proves insufficient — prefer Context + `onNavigate` per Next docs
  - [x] **Section tabs:** same `onNavigate` / `requestNavigation` path when switching tabs away from a dirty panel
  - [x] **Command palette:** replace bare `router.push(href)` in `navigate()` with `requestNavigation(href)` (close palette only after allow, or close then navigate — either OK if guard still runs)
  - [x] **History:** intercept `popstate` (and/or Navigation API if used) so Back/Forward while dirty opens the same dialog; Stay restores history position
  - [x] **Programmatic:** any other in-shell `router.push` that leaves a dirty surface should go through the same helper (at minimum document the convention for later stories)
  - [x] Wire **existing** `PersonnelEventForm` `dirty` into the registry (reuse `saveDraft` via existing `registerPersonnelDraftSaveHandler` / local save for the Save action). Do **not** invent import-preview dirty until a preview surface exists — stub registration API is enough; real ورود گروهی preview wiring is 4b.7 / Epic 6

- [x] Task 5: Route announcer = surface + tab (AC: #2)
  - [x] Update `apps/web/components/route-announcer.tsx` + `routeAnnounce()` so messages are like `اطلاعات پرسنلی — فهرست پرسنل` (surface — tab). Until 4b.3 renames, `/personnel` surface label may remain «پرسنل» **or** announce the page `<h1>`/shell title used in the thin layout — pick one map and keep consistent with visible surface heading
  - [x] Derive tab label from active section-tab config / path segment; if no tabs, announce surface only (current behavior)
  - [x] Keep `aria-live="polite"`; skip duplicate announce on first mount

- [x] Task 6: Verify + regression (AC: #1–#5)
  - [x] `pnpm --filter @divan/web` typecheck; lint clean on **touched** files (pre-existing Epic 4 panel hook lint noise is out of scope)
  - [x] Manual DoD below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done later
  - [x] BOM-safe edit if touching `sprint-status.yaml` on Windows

### Review Findings

- [x] [Review][Defer] Logout / authz-changed `router.replace` bypass leave-guard — deferred, pre-existing; story already documents `requestNavigation` convention for later in-shell leaves
- [x] [Review][Defer] Dual surface labels (`SURFACE_LABELS` vs `section-tab-surfaces.surfaceLabel`) — deferred, pre-existing drift risk; consolidate when 4b.3 renames surfaces

- [x] [Review][Patch] History leave-guard does not complete Back/Forward after Discard/Save (sentinel-only `history.back`, orphan trap on clean, stacked traps while pending, Forward treated as Back) [`apps/web/components/leave-guard/leave-guard-provider.tsx:92-216`]
- [x] [Review][Patch] Save path can hang Promise / leave dialog stuck (`onSave` false or throw without `resolve`) and race on double-activate [`leave-guard-provider.tsx:126-170`]
- [x] [Review][Patch] Save marks all dirty clean including entries without `onSave` [`leave-guard-provider.tsx:156-167` + `leave-guard-dialog.tsx:34`]
- [x] [Review][Patch] `registrationsLive` syncs in `useEffect` — one frame stale for `requestNavigation` [`leave-guard-provider.tsx:35-37`]
- [x] [Review][Patch] Sidebar same-surface skip uses `item.href === pathname` (fails for `/personnel` vs `/personnel/list`) — spurious leave dialog / remount [`app-sidebar.tsx:140-144`]
- [x] [Review][Patch] PersonnelEventForm Discard only clears dirty flags — does not reload last saved / reset fields [`personnel-event-form.tsx:524-527`]
- [x] [Review][Patch] `resolveActiveIndex` falls back to tab 0 on unmatched path — false `aria-selected` [`section-tabs.tsx:24-30`]
- [x] [Review][Patch] Index redirects use `SECTION_TAB_SURFACES.find(...)!` — crash if root missing [`personnel|organization|headcount|access/page.tsx`]
- [x] [Review][Patch] `sprint-status.yaml` written with UTF-8 BOM (Task 6 BOM-safe) [`_bmad-output/implementation-artifacts/sprint-status.yaml`]

## Dev Notes

### Epic context

- **Epic 4b:** Shell & IA Alignment to `ux-divan-2026-07-19` — presentation only; domain APIs unchanged. Authorized by `sprint-change-proposal-2026-07-19`. After Epic 4 (done), before Epic 5.
- **This story:** UX-DR25 (`section-tabs` + URL + leave-guards) + UX-DR4/UX-DR3 exemptions (theme/collapse) + UX-DR21 route announce surface+tab + UX-DR23 horizontal tab scroll.
- **Order:** `4b.1` (done) → **`4b.2`** → `4b.3` → `4b.4` → (`4b.5` ∥ `4b.6`) → `4b.7` → Epic 5.
- **Consumers:** 4b.5 Access retrofit, 4b.6 Org trees, 4b.7 Personnel/Events scaffolds **must reuse** this primitive — do not leave a one-off tab implementation.

### Absolute non-goals (do not implement here)

| Out of scope | Belongs to |
| --- | --- |
| Sidebar IA reorder, «اطلاعات پرسنلی» / «رویدادهای پرسنلی» labels, role landings | **4b.3** |
| `governed-data-table` | **4b.4** |
| Person-first Access domain UI reshape beyond thin tab chrome | **4b.5** |
| `tree-navigator` + org tab content depth | **4b.6** |
| Relocate event form to رویدادهای پرسنلی; quick-edit modal; full personnel list | **4b.7** / Epic 5 |
| Import wizard / preview Sheet product | Epic 6 |
| Brand hex, FaNum, AG Grid, mobile layouts, `packages/ui` | Never |
| AD-1…AD-6 / Prisma / domain modules | No architecture change |

### Architecture compliance (MUST follow)

| Rule | Implication |
| --- | --- |
| **AD-6** T3 + Persian RTL | Stay in `apps/web`; Next **16.2.x** App Router; `lang="fa"` `dir="rtl"` |
| UX authority | Forward contract = `ux-divan-2026-07-19`. `ux-divan-2026-07-13` historical only |
| No AD change | Shell IA is UX-only |
| Layout ≠ RSC | Path gate in layout does **not** stop `page.tsx` loaders — keep `assertPageAccess` on every new segment page |
| Prisma ESLint | Do not import `@prisma/client` from `apps/web` |

[Source: `ARCHITECTURE-SPINE.md` AD-6; `sprint-change-proposal-2026-07-19.md`; `epics.md` Story 4b.2]

### Recommended implementation pattern (avoid reinvention)

```text
AppShell
  └─ LeaveGuardProvider          ← dirty registry + Dialog (ماندن/دور انداختن/ذخیره)
  └─ AppSidebar Links            ← onNavigate → requestNavigation
  └─ CommandPalette.navigate     ← requestNavigation
  └─ main
       └─ SurfaceTabsLayout      ← SectionTabs (Link per tab) + {children} as tabpanel
            └─ default tab page  ← existing panels (PersonnelPanel, AccessAdminPanel, …)
            └─ other tab pages   ← Persian placeholder only

PersonnelEventForm (on default personnel tab)
  └─ useLeaveGuardRegistration({ isDirty: dirty, onSave: saveDraft, onDiscard: reset })
```

**URL strategy (pick one, document in PR):**

1. **Preferred:** nested routes — `/access` → redirect `/access/people`; tabs Link to `/access/people|roles|scopes|break-glass`. Active match = pathname prefix/segment.
2. **Acceptable:** `?tab=` search param with `router.replace` — simpler but weaker deep-link/share for later stories.

Do **not** use hash-only tabs (`#tab`) — poor SSR and announce sync.

**Leave-guard channels (all required for AC #3):**

| Channel | Mechanism |
| --- | --- |
| Sidebar / section-tab Links | Next 16 `Link` `onNavigate` + `e.preventDefault()` then custom dialog |
| Command palette | Wrap `router.push` |
| History Back/Forward | `popstate` reverse + dialog (Stay keeps user on page) |
| Refresh / close tab | `beforeunload` (native browser UI) |

**Do not** ship `window.confirm` for in-app nav — Persian Dialog is mandatory for SPA paths.

**Save semantics:** For Draft forms, Save = existing draft save (not finalize). Discard clears local dirty / reloads last saved. Stay closes dialog and cancels navigation. If `onSave` fails, stay on page and keep dialog or show inline error — never navigate after failed save.

**Inbound prefill vs dirty** (ثبت رویداد) is specified in EXPERIENCE but product path is **4b.7** — only ensure the **guard API** can block a future programmatic navigation; do not build prefill UX here.

### Files being modified — current state → change → preserve

#### NEW (expected)

| Path | Role |
| --- | --- |
| `apps/web/components/section-tabs.tsx` | Shared tablist chrome |
| `apps/web/components/leave-guard/*` | Provider, dialog, hooks |
| Nested `(tabs)` layouts/pages under `/personnel`, `/organization`, `/headcount`, `/access` | URL-backed shells |

#### `apps/web/components/app-sidebar.tsx` (UPDATE)

- **Today:** `Link` per nav item; collapse exempt comment already present.
- **Change:** `onNavigate` → leave-guard; keep collapse toggle free of guards.
- **Preserve:** icons, tooltips, persistence, `data-sidebar`, active accent leading border, server-filtered `navItems`.

#### `apps/web/components/command-palette.tsx` (UPDATE)

- **Today:** `router.push(href)` on select.
- **Change:** go through leave-guard.
- **Preserve:** shortcuts, digit normalization, empty copy, permission-filtered nav.

#### `apps/web/components/route-announcer.tsx` (UPDATE)

- **Today:** surface-only labels via `SURFACE_LABELS`.
- **Change:** append selected tab when present.
- **Preserve:** polite live region; skip-first-mount.

#### `apps/web/components/app-shell.tsx` (UPDATE)

- **Today:** mounts sidebar, palette, announcer.
- **Change:** wrap with `LeaveGuardProvider` (or mount dialog host).
- **Preserve:** viewport gate, skip link, banner stack, `--sidebar-current-width` reclaim.

#### `apps/web/lib/operational-copy.ts` (UPDATE)

- Extend unsaved / leave-guard / import-preview strings; do not invent ceremonial success copy.

#### `apps/web/components/personnel/personnel-event-form.tsx` (UPDATE — register only)

- **Today:** local `dirty` + `beforeunload`.
- **Change:** register with leave-guard; keep draft≠finalize; do not move form to another route.
- **Preserve:** finalize confirm, capacity panel, tRPC flows.

#### `apps/web/app/globals.css`

- Token `--section-tabs-height` already from 4b.1 — consume; add utility only if missing for tab strip overflow.

#### Do not touch

- `packages/modules/identity-access/src/navigation.ts` (4b.3)
- Domain packages, Prisma schemas, tRPC procedure authz
- Theme hex / `theme-toggle.tsx` behavior (already leave-guard-free)

### Previous story intelligence (4b.1)

- Collapsible shell + DESIGN spacing tokens shipped; `--section-tabs-height: 44px` ready.
- Collapse toggle comment: `// 4b.2 leave-guards must exempt sidebar collapse + theme toggle` — honor it.
- Patterns to reuse: `useSyncExternalStore` storage, shadcn Dialog/Tooltip, `focus-ring-chrome`, BOM-safe sprint-status edits.
- Review patches applied: RTL toggle icons, toggle race via `readSidebarCollapsed`, `data-sidebar` cleanup, `aria-controls` on collapse.
- Deferred (ignore unless blocking): `NAV_ICONS` fallback; collapsed 64px focus-ring polish — tracked in `deferred-work.md`.
- Lint: full-package lint still noisy on Epic 4 panels; typecheck + touched-file lint is the bar.

### Git intelligence

- HEAD baseline: `c1a0c36` — story 4b.1 (`globals.css`, `app-shell`, `app-sidebar`, `tooltip`, `sidebar-storage`).
- Prior: `f1fde05` epic 4b correct course (planning only).
- Expect **apps/web chrome + routing only** — no domain package churn.

### Library / framework requirements

| Lib | Note |
| --- | --- |
| Next.js | **16.2.10** — use official `Link` `onNavigate` (since 15.3); do not monkey-patch `history.pushState` as first choice |
| React | 19.x already — fine with Context provider |
| shadcn Dialog | Reuse `components/ui/dialog.tsx`; add `tabs` only if useful |
| lucide-react | No new icon pack |
| Testing | Manual DoD; Vitest optional (Epic open item) — do not block |

**Latest tech note (2026):** App Router has no `router.events`. Next documents Context + `onNavigate` for unsaved blocking. History back/forward still needs `popstate` handling. Prefer first-party over `next-stay` / `use-form-guard` unless review finds gaps.

### Interactive a11y DoD (Epic 1 carry-forward + UX-DR21/25)

- [ ] Tablist keyboard: arrows move focus; Enter/Space selects; selected tab `aria-selected="true"`
- [ ] Active tabpanel is labelled by the selected tab (`aria-labelledby` / `aria-controls` pairing)
- [ ] Route change announces **surface + tab** via polite live region
- [ ] Leave-guard dialog: focus trapped; Esc = Stay (cancel leave); initial focus on Stay or title per existing dialog pattern
- [ ] Collapse + theme still exempt; focus rings visible on chrome tabs
- [ ] Skip link still first focusable → `#main-content`
- [ ] Horizontal tab scroll does not force `body` / page horizontal scrollbar at 1280×720

### Testing requirements (manual DoD)

1. Open `/access` (or chosen surface): section tabs visible at 44px; URL changes on tab click; default tab shows existing admin UI.
2. Other tabs show placeholder only; deep-link to a non-default tab URL works after refresh.
3. On `/personnel` default tab: edit فرم رویداد until dirty → click sidebar item → dialog «تغییرات ذخیره نشده‌اند.» with ماندن / دور انداختن / ذخیره (or پیش‌نویس); Stay keeps form + URL; Discard navigates and clears dirty; Save persists draft then navigates on success.
4. Same dirty: command palette navigate → guard; browser Back → guard.
5. Theme toggle + sidebar collapse while dirty → **no** dialog; width/theme still change in place.
6. Narrow the window to ~1280: many tabs → strip scrolls horizontally; page does not.
7. Screen reader / live region: switching tabs announces surface + tab.
8. `typecheck` clean; no new Prisma imports in web.

### Project structure notes

- All UI under `apps/web` — AD-6 / no `packages/ui`.
- Leave-guard is shell infrastructure (like `PlatformStatusProvider`), not a domain module.
- Nested route folders must remain inside `(app)` so shell layout + auth gate still wrap them.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4b, Story 4b.2, UX-DR4/21/23/25]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — Section tabs, State Patterns dirty leave, a11y floor]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/DESIGN.md` — `section-tabs` height + active-border]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/mockups/key-personnel-list.html` — visual tab strip]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/review-edge-cases.md` — leave-guard on tabs/sidebar/palette/history]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-19.md` — Story 4b.2 AC summary]
- [Source: `_bmad-output/implementation-artifacts/4b-1-design-delta-tokens-collapsible-app-shell.md`]
- [Source: `apps/web/components/app-shell.tsx`, `app-sidebar.tsx`, `route-announcer.tsx`, `command-palette.tsx`, `personnel/personnel-event-form.tsx`, `lib/operational-copy.ts`]
- [Source: Next.js Link `onNavigate` docs — blocking navigation with Context]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Typecheck: `pnpm --filter @divan/web exec tsc --noEmit` — pass
- Lint: eslint on touched files (excl. pre-existing personnel-event-form hook noise) — pass

### Completion Notes List

- URL strategy: nested path segments (not `?tab=` / hash). Roots redirect to default tabs (`/personnel` → `/personnel/list`, etc.).
- Shared `SectionTabs` + `SECTION_TAB_SURFACES` config; `SurfaceSectionTabsLayout` hosts tablist + tabpanel.
- `LeaveGuardProvider` in AppShell: Stay · Discard · Save پیش‌نویس; `beforeunload` centralized (removed from form to avoid double prompt).
- Nav channels: sidebar + section-tab `Link.onNavigate`, command palette `requestNavigation`, `popstate` history trap.
- `PersonnelEventForm` registers via `useLeaveGuardRegistration` with `saveDraft` / discard clears dirty.
- Route announcer: `پرسنل — فهرست پرسنل` style via surface config (label «پرسنل» until 4b.3).
- Theme toggle + sidebar collapse remain leave-guard-exempt (comments present).
- Convention for later stories: in-shell programmatic leaves should call `requestNavigation(href)` from `useLeaveGuard()`.

### File List

- apps/web/components/section-tabs.tsx
- apps/web/components/surface-section-tabs-layout.tsx
- apps/web/components/section-tab-placeholder.tsx
- apps/web/lib/section-tab-surfaces.ts
- apps/web/components/leave-guard/index.ts
- apps/web/components/leave-guard/leave-guard-context.tsx
- apps/web/components/leave-guard/leave-guard-provider.tsx
- apps/web/components/leave-guard/leave-guard-dialog.tsx
- apps/web/components/leave-guard/use-leave-guard-registration.ts
- apps/web/components/app-shell.tsx
- apps/web/components/app-sidebar.tsx
- apps/web/components/command-palette.tsx
- apps/web/components/route-announcer.tsx
- apps/web/components/theme-toggle.tsx
- apps/web/components/personnel/personnel-event-form.tsx
- apps/web/lib/operational-copy.ts
- apps/web/app/(app)/personnel/page.tsx
- apps/web/app/(app)/personnel/(tabs)/layout.tsx
- apps/web/app/(app)/personnel/(tabs)/list/page.tsx
- apps/web/app/(app)/personnel/(tabs)/add/page.tsx
- apps/web/app/(app)/personnel/(tabs)/bulk-import/page.tsx
- apps/web/app/(app)/personnel/(tabs)/dictionary/page.tsx
- apps/web/app/(app)/organization/page.tsx
- apps/web/app/(app)/organization/(tabs)/layout.tsx
- apps/web/app/(app)/organization/(tabs)/hierarchy/page.tsx
- apps/web/app/(app)/organization/(tabs)/roles/page.tsx
- apps/web/app/(app)/organization/(tabs)/job-titles/page.tsx
- apps/web/app/(app)/organization/(tabs)/ladder-grade/page.tsx
- apps/web/app/(app)/organization/(tabs)/seniority/page.tsx
- apps/web/app/(app)/headcount/page.tsx
- apps/web/app/(app)/headcount/(tabs)/layout.tsx
- apps/web/app/(app)/headcount/(tabs)/capacity/page.tsx
- apps/web/app/(app)/headcount/(tabs)/create/page.tsx
- apps/web/app/(app)/headcount/(tabs)/bulk-import/page.tsx
- apps/web/app/(app)/access/page.tsx
- apps/web/app/(app)/access/(tabs)/layout.tsx
- apps/web/app/(app)/access/(tabs)/people/page.tsx
- apps/web/app/(app)/access/(tabs)/roles/page.tsx
- apps/web/app/(app)/access/(tabs)/scopes/page.tsx
- apps/web/app/(app)/access/(tabs)/break-glass/page.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4b-2-section-tabs-chrome-routing-leave-guards.md

## Change Log

- 2026-07-19: Story context created (ready-for-dev).
- 2026-07-19: Implemented section tabs, nested URL shells, leave-guard, route announce (status → review).
- 2026-07-20: Code review patches applied (history leave-guard, save path, discard snapshot, sidebar same-surface, BOM); status → done.
