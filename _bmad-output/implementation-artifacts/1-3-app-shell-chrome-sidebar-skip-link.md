---
baseline_commit: 09679c4b9fc06ec799029c3dc5f22ea200f489de
---

# Story 1.3: App Shell — Chrome, Sidebar & Skip Link

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized Divan user,
I want a fixed navy header and RTL sidebar with skip link and banner slot,
so that I can navigate desktop surfaces consistently from 1280×720 upward.

## Acceptance Criteria

1. **Given** brand tokens and theme from Story 1.2  
   **When** the `app-shell` is rendered  
   **Then** header height is 56px and RTL sidebar width is 240px with logo on the right and user menu on the left

2. **And** skip link «پرش به محتوا» is the first focusable element and targets the main landmark

3. **And** a banner stack slot exists below the header (stale above break-glass when both present in later stories)

4. **And** viewports ≥1280×720 render the full shell; <1280 shows a minimum-viewport message without a broken layout

5. **And** sidebar active item uses sidebar-active-background plus accent RTL leading border

6. **And** placeholder nav items exist for IA surfaces (داشبورد، پرسنل، …) without requiring domain data yet

## Tasks / Subtasks

- [x] Task 1: Introduce `app-shell` layout structure (AC: #1, #3)
  - [x] Create `apps/web/components/app-shell.tsx` (client or composed server+client as needed) that renders fixed navy chrome: header + RTL sidebar + content column
  - [x] Use existing tokens only: `h-chrome-height` (56px), `w-sidebar-width` (240px), `bg-chrome`, `text-chrome-foreground` — do **not** invent new chrome colors
  - [x] Header layout (RTL): brand/logo on the **inline-start / right**; user menu on the **inline-end / left**; optional search-trigger placeholder between them (visual only — no Ctrl+K logic)
  - [x] Banner stack slot: empty region directly below the header (full content width or full viewport width under chrome — match DESIGN: “directly below header”); accept `children`/`bannerSlot` prop or a stable DOM id/region for Story 1.7
  - [x] Content area scrolls independently of fixed header/sidebar; chrome stays flat (no custom shadow)
  - [x] Wire shell so home (and future routes) render inside `<main id="main-content" tabIndex={-1}>` (or equivalent stable id)

- [x] Task 2: Skip link «پرش به محتوا» (AC: #2)
  - [x] Place skip link as the **first focusable** element in the document (before header/sidebar controls) — typically first child inside shell or body content tree after ThemeProvider
  - [x] Exact visible copy: `پرش به محتوا`
  - [x] `href="#main-content"` targeting the main landmark; `<main>` must have matching `id` and `tabIndex={-1}` so focus can move there
  - [x] Visually hidden until focused (use `sr-only` / absolute off-screen — **never** `display:none` / `visibility:hidden`); on focus show with `focus-ring-chrome` and high z-index
  - [x] On activate: move focus to `#main-content` (native hash + click handler if needed for App Router); do not require a full a11y suite (Story 1.7)

- [x] Task 3: Sidebar placeholder navigation + active state (AC: #5, #6)
  - [x] Render placeholder nav for all top-level IA surfaces (Persian labels, all visible — **no** role filtering yet):
    - داشبورد
    - پرسنل
    - ساختار سازمان
    - ظرفیت و جذب
    - گزارش‌ها
    - ورود داده
    - دسترسی‌ها
    - ممیزی
    - عملیات
    - پرونده‌های اصلاح
  - [x] Active item style = `sidebar-active-item`: `bg-sidebar-active-background` + **2px solid accent** on RTL **leading** edge (`border-s-2` / logical `border-inline-start`, or `border-r-2` in RTL — leading = right)
  - [x] Default active for home: **داشبورد** (or mark current path when using `next/link` placeholders); links may point to `#` or stub routes — domain pages not required
  - [x] Do **not** hide items by role; do **not** show disabled stubs for “unauthorized” — that is Story 1.5
  - [x] Keep sidebar labels visible at 1280×720 (no icon-only collapse)

- [x] Task 4: User menu — promote stub into shell chrome (AC: #1)
  - [x] Replace temporary home-page chrome strip + `UserMenuStub` placement with shell-owned user menu
  - [x] Preserve Story 1.2 behaviors: theme toggle in menu; in-place swap; focus preserved; `focus-ring-chrome`; RTL menu alignment (`end-0` / inline-end) so dropdown does not clip
  - [x] Keep review patches from 1.2: `pointerdown` outside-dismiss, Escape restores focus to trigger, valid `role="menu"` / `menuitem` on toggle
  - [x] **No** real logout / session — stub label OK (e.g. «حساب کاربری»); auth is Story 1.4
  - [x] Rename/refactor `user-menu-stub.tsx` → `user-menu.tsx` (or keep stub name but remove “temporary chrome strip” comments) — delete dead temporary header markup from `page.tsx`

- [x] Task 5: Minimum-viewport gate (AC: #4)
  - [x] At viewport width **&lt; 1280** (and/or height &lt; 720 — match EXPERIENCE: &lt;1280 shows message): do **not** render a broken squeezed shell
  - [x] Show a clear Persian minimum-viewport message (e.g. that Divan requires at least 1280×720)
  - [x] Prefer CSS (`min-width` media) and/or a small client check; avoid layout thrash; full shell only when gate passes
  - [x] Reference viewport remains 1920×1080; no mobile-first redesign

- [x] Task 6: Integrate routes + preserve prior work (AC: #1–#6)
  - [x] Prefer nesting shell in `app/layout.tsx` **or** `app/(app)/layout.tsx` so future routes inherit chrome — pick one and document in File List
  - [x] Update `page.tsx`: remove temp chrome strip; keep a minimal Persian content demo inside `main` (brand buttons optional — do not regress theme demo entirely unless moved under shell main)
  - [x] Preserve: `lang="fa"` `dir="rtl"`; Yekan Bakh; ThemeProvider; `lib/theme-storage.ts` extension point; Prisma ESLint boundary; tRPC health
  - [x] `pnpm --filter @divan/web lint`, `typecheck`, and `dev` smoke must pass

### Review Findings

- [x] [Review][Defer] Viewport gate vs browser zoom — CSS gate at &lt;1280×720 also fires at 150–200% zoom on laptop widths [`apps/web/app/globals.css:204-212`] — deferred: MVP desktop contract stays fixed; evaluate 200% zoom interaction with the gate under Story 1.7 a11y floor
- [x] [Review][Patch] Revert accidental `next-env.d.ts` path to `.next/dev/types` [`apps/web/next-env.d.ts:3`]
- [x] [Review][Patch] Placeholder nav `href="#"` causes scroll/hash side effects — preventDefault or non-link stubs [`apps/web/components/app-sidebar.tsx:11-19`]
- [x] [Review][Patch] Skip link focuses main without `scrollIntoView` — viewport may stay under fixed header on long pages [`apps/web/components/skip-link.tsx:8-14`]
- [x] [Review][Patch] When viewport shrinks below gate, focus can remain inside `display:none` shell — move focus to gate/body on matchMedia [`apps/web/app/globals.css:204-212`]
- [x] [Review][Patch] UserMenu outside-dismiss / blur closes menu without restoring focus to trigger (Escape already does) [`apps/web/components/user-menu.tsx:19-42`]
- [x] [Review][Patch] Remove redundant Tailwind `flex` on gate node; CSS media already sets `display` [`apps/web/components/app-shell.tsx:19`]
- [x] [Review][Defer] Fixed `#banner-stack` has no content offset — banners will overlay main [`apps/web/components/app-shell.tsx:48-54`] — deferred, pre-existing
- [x] [Review][Defer] UserMenu lacks full APG keyboard/focus trap — carried from 1.2 stub [`apps/web/components/user-menu.tsx`] — deferred, pre-existing
- [x] [Review][Defer] Dashboard active state is exact `/` only — nested landings need prefix strategy later [`apps/web/components/app-sidebar.tsx:32-35`] — deferred, pre-existing

## Dev Notes

### Epic context

- **Epic 1:** Secure Access & Persian Desktop Shell — this story delivers the structural chrome (UX-DR3) after brand/theme (1.2) and before auth (1.4), role-filtered nav (1.5), command palette (1.6), and a11y/banner behavior (1.7).
- **FRs / UX-DRs:** FR43 (Persian RTL desktop shell substrate); **UX-DR3** (app-shell). UX-DR3 mentions role-filtered nav — **implement structure only here**; filtering is Story 1.5.
- **Downstream consumers:** 1.4 (session in user menu), 1.5 (hide nav + landings), 1.6 (search trigger → palette), 1.7 (fill banner slot + a11y floor).

### Absolute non-goals (do not implement here)

| Deferred | Story |
| --- | --- |
| Seeded auth, logout, session timeouts | 1.4 |
| Permission-filtered nav, role landings, «دسترسی ندارید.» | 1.5 |
| Command palette Ctrl+K / `/`, Jalali, Persian digits | 1.6 |
| Real stale/break-glass banners, WCAG floor suite, operational copy pass | 1.7 |
| LDAP | 1.8 |
| Domain data for IA surfaces | Epic 2–7 |
| Mobile/tablet layout; bilingual UI; white sidebar in light mode | Never (MVP) |

### Architecture compliance (MUST follow)

| Rule | Implication for 1.3 |
| --- | --- |
| **AD-1** | Single process; shell lives only in `apps/web` |
| **AD-3** | No event-store / module tables / Prisma from web |
| **AD-5** | Default-deny is server-side later — UI does not fake authz in 1.3 |
| **AD-6** | Next App Router, Persian RTL; UX values from DESIGN.md / EXPERIENCE.md |
| Stack | Next **16.2.x**, React 19, Tailwind **v4**, shadcn new-york, `next-themes` — already from 1.1/1.2 |

[Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md`]

### Current codebase state (UPDATE files — read before editing)

**`apps/web/app/layout.tsx` today:**
- `lang="fa"` `dir="rtl"`; Yekan variable; `ThemeProvider` (`attribute="class"`, `enableSystem={false}`, `storageKey` from theme-storage)
- **Change:** optionally wrap children with `AppShell`, or keep root thin and add nested `(app)/layout.tsx`
- **Preserve:** ThemeProvider, RTL, font, Persian metadata, `suppressHydrationWarning`

**`apps/web/app/page.tsx` today:**
- Temporary navy header strip + `UserMenuStub` + brand button demo in `<main>`
- **Change:** remove temp strip; content becomes shell `children` inside real `<main id="main-content">`
- **Preserve:** Persian copy; optional keep button demo for visual regression smoke

**`apps/web/components/user-menu-stub.tsx` today:**
- Explicitly marked temporary until 1.3; hosts `ThemeToggle`; review-hardened a11y/RTL
- **Change:** promote into shell user menu; keep toggle + dismiss/focus behavior
- **Preserve:** do not regress 1.2 review patches

**`apps/web/app/globals.css` today:**
- `--chrome-height`, `--sidebar-width`, `--sidebar-active-background`, `.focus-ring-chrome` already defined
- **Change:** only if skip-link utility or shell helpers needed; **do not** redefine brand hex values
- **Preserve:** content-vs-chrome split; `@theme inline` mappings

**Tokens already available (reuse — do not redeclare):**
`bg-chrome`, `text-chrome-foreground`, `h-chrome-height`, `w-sidebar-width`, `bg-sidebar-active-background`, `focus-ring-chrome`, accent for active border

### Visual / layout contract (load-bearing)

| Element | Spec |
| --- | --- |
| Header | Fixed; height **56px**; `bg-chrome`; flat (no shadow) |
| Sidebar | RTL; width **240px**; same navy chrome; labels always shown ≥1280 |
| Logo | Right (RTL start) — product name «دیوان» is enough (no asset required unless already present) |
| User menu | Left (RTL end) |
| Active nav | `sidebar-active-background` + **2px** accent leading border (`#FDB913` light / theme accent token) |
| Banner slot | Empty structural region below header; later order: stale → break-glass |
| Search trigger | Optional inert placeholder (e.g. «جستجو… Ctrl+K») — **no** palette wiring |
| Content | Independent scroll; shadcn `background` canvas |

**Visual reference:** `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/mockups/key-personnel.html` (and key-dashboard.html). On conflict, DESIGN.md + EXPERIENCE.md + this story win over mock CSS quirks.

### Skip-link tech notes (Next.js App Router)

- First focusable in DOM order; Persian label exact: «پرش به محتوا»
- Hide until `:focus` / `:focus-visible` without removing from a11y tree
- `<main id="main-content" tabIndex={-1}>` so programmatic focus works
- App Router client navigations may need a click handler to `focus()` main — keep minimal; full route-announce a11y is Story 1.7
- Prefer logical properties for RTL (`inset-inline-start` when showing the focused skip control)

### Project structure notes

**Recommended layout:**

```text
apps/web/
  app/
    layout.tsx              # UPDATE — keep ThemeProvider; optionally mount AppShell
    page.tsx                # UPDATE — content only inside shell main
    (app)/layout.tsx        # OPTIONAL NEW — if shell should not wrap future login route
  components/
    app-shell.tsx           # NEW — header + sidebar + banner slot + main
    skip-link.tsx           # NEW (or inline in app-shell)
    app-sidebar.tsx         # NEW (or section inside app-shell)
    user-menu.tsx           # NEW/RENAME from user-menu-stub.tsx
    user-menu-stub.tsx      # REMOVE or re-export after rename
    theme-toggle.tsx        # KEEP
    theme-provider.tsx      # KEEP
  app/globals.css           # UPDATE only if skip-link utility needed
```

**Variance:** UX-DR3 says “role-filtered nav”; Story 1.3 AC explicitly requires **placeholders for all IA items**. Filtering = 1.5. Do not implement half-authz.

**Login route foresight:** If you wrap shell in root layout, Story 1.4 login may need an escape hatch (`(app)` vs `(auth)` route groups). Prefer `(app)/layout.tsx` with shell if that future split is cheap now; otherwise document that 1.4 must unwrap login from shell.

### Library / framework requirements

| Package | Guidance |
| --- | --- |
| Existing stack only | Next 16.2.x, Tailwind 4, next-themes, lucide-react — **no new UI framework** |
| shadcn | Optional: add `DropdownMenu` / `Separator` if replacing custom menu — not required if stub menu remains solid |
| `next/link` | OK for placeholder nav hrefs |
| Testing runners | Still not mandated — do not block on Playwright/Vitest |

**Do not:** Material/Chakra; new `packages/ui`; Prisma/theme tables; invent purple chrome.

### Testing requirements

Architecture does not mandate automated UI tests. **Definition of done (manual):**

1. ≥1280×720: fixed header 56px + sidebar 240px; both navy in **light and dark**; content canvas flips with theme
2. Tab from load: first focusable is «پرش به محتوا»; Enter moves focus into `main`
3. Banner slot exists in DOM below header (empty OK)
4. Active nav shows fill + gold/accent leading border (inspect computed border on inline-start)
5. All 10 IA placeholder labels visible in sidebar
6. &lt;1280 width: Persian minimum-viewport message; no crushed sidebar/header layout
7. Theme toggle still works from user menu; focus retained; localStorage key unchanged (`divan-theme`)
8. `lint` + `typecheck` + `dev` OK; `/api/trpc/health` still 200

### Previous story intelligence

From Story 1.2 (`1-2-brand-tokens-typography-theme-toggle.md`):

- Chrome tokens, spacing, `.focus-ring-chrome`, ThemeProvider, and `UserMenuStub` were built **explicitly** as substrate for this story — extend, do not reinvent
- Path aliases: `@/*` → `./*` and `~/*` → `./src/*` — keep both
- Fonts live under `apps/web/src/fonts/yekan-bakh/` via `next/font/local` — do not re-copy from `_bmad-output`
- Review patches to keep: menu `end-0` RTL, `pointerdown` dismiss, Escape focus restore, `role="menuitem"` on toggle, Button `type="button"` default, `@theme` spacing → CSS vars
- Deferred to 1.7: secondary button contrast audit — do not reopen in 1.3
- `lib/theme-storage.ts` is the 1.4 extension point — leave intact

From Story 1.1:

- Persian RTL must not regress to English boilerplate
- Prisma ESLint `no-restricted-imports` in web must stay
- Manual monorepo scaffold — no create-t3-app assumptions

### Git intelligence summary

- `09679c4` story 1.2 — brand tokens, theme, stub chrome strip
- `7457053` story 1.1 — monorepo, Next 16.2.10, tRPC, RTL placeholder
- Patterns: minimal stubs over speculative frameworks; Persian product copy; keep changes inside `apps/web` for UI

### Latest tech information (as of 2026-07-16)

- **Skip links + App Router:** Put skip link first in the shell DOM; use `tabIndex={-1}` on `<main>`; hide with sr-only/off-screen until focus; optional click handler to focus main because client navigation can skip native hash focus
- **RTL borders:** Prefer logical `border-inline-start` (leading) for active accent so LTR mistakes do not invert the gold bar
- **Viewport gate:** `window.matchMedia('(min-width: 1280px)')` and/or CSS; guard SSR by defaulting to full shell or a neutral state without hydration flicker if using client detection
- **Tailwind v4:** Continue CSS-first tokens; no need for `tailwind.config.ts`

### Project context reference

- No `project-context.md` in repo. Contract = Architecture Spine + DESIGN.md + EXPERIENCE.md + this story.
- SPEC CAP-11 / FR-43: Persian RTL desktop shell in `apps/web`.

### Dev Agent guardrails (anti-patterns)

| Do | Don't |
| --- | --- |
| Reuse `--chrome-height` / `--sidebar-width` tokens | Hardcode 56/240 in random px without tokens |
| Keep chrome navy in both themes | Light-mode white sidebar/header |
| Show all IA placeholders | Implement role filtering early (1.5) |
| Empty banner **slot** only | Build stale/break-glass banner UI (1.7) |
| Skip link first + main landmark | Put skip link after nav or use `display:none` |
| Promote user-menu with theme toggle | Add fake logout/auth |
| Minimum-viewport Persian message | Build mobile responsive shell |
| Preserve 1.2 review a11y fixes | Rewrite menu from scratch and drop Escape/focus behavior |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.3, UX-DR3]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — app-chrome, sidebar-active-item, spacing]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — app-shell, IA surfaces, responsive table, skip link]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/mockups/key-personnel.html` — visual chrome reference]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-1/3/5/6, apps/web]
- [Source: `_bmad-output/implementation-artifacts/1-2-brand-tokens-typography-theme-toggle.md` — prior learnings, tokens, review patches]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — secondary contrast deferred to 1.7]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Implementation Plan

- Mount shell in `app/(app)/layout.tsx` (not root) so Story 1.4 can add auth routes without chrome.
- Compose server `AppShell` with client `SkipLink`, `AppSidebar`, and `UserMenu`; reuse Story 1.2 chrome tokens and menu a11y behavior.
- Viewport gate via CSS media (`max-width: 1279px` or `max-height: 719px`) with shell as default to avoid SSR flicker.

### Debug Log References

- Cleared stale `apps/web/.next` after moving `app/page.tsx` → `app/(app)/page.tsx` (typecheck referenced deleted `app/page.js`).
- Port 3000 was occupied by a hung prior `node` process; restarted `pnpm --filter @divan/web dev` for smoke.

### Completion Notes List

- Delivered fixed navy app-shell: header 56px + RTL sidebar 240px using existing chrome tokens only.
- Skip link «پرش به محتوا» is first focusable in shell; focuses `#main-content` via click handler for App Router.
- Banner stack slot `#banner-stack` / `data-banner-stack` below header for Story 1.7.
- All 10 IA placeholder nav labels visible; داشبورد active on `/` with `border-s-2 border-accent` + `bg-sidebar-active-background`.
- Promoted `user-menu-stub` → `user-menu` with theme toggle, pointerdown dismiss, Escape focus restore, RTL `end-0` menu.
- CSS viewport gate at &lt;1280 or &lt;720 height shows Persian message; defaults to full shell to avoid flicker.
- Shell mounted via `app/(app)/layout.tsx` so future auth routes can live outside `(app)`.
- `lint`, `typecheck`, home 200, `/api/trpc/health` 200 verified.

### File List

- `apps/web/components/app-shell.tsx` (new)
- `apps/web/components/app-sidebar.tsx` (new)
- `apps/web/components/skip-link.tsx` (new)
- `apps/web/components/user-menu.tsx` (new; replaces stub)
- `apps/web/components/viewport-gate-focus-guard.tsx` (new; review patch)
- `apps/web/components/user-menu-stub.tsx` (deleted)
- `apps/web/app/(app)/layout.tsx` (new — shell integration choice)
- `apps/web/app/(app)/page.tsx` (new; content-only home)
- `apps/web/app/page.tsx` (deleted; moved under `(app)`)
- `apps/web/app/globals.css` (skip-link + viewport-gate utilities)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status sync)

### Change Log

- 2026-07-16: Implemented Story 1.3 app-shell chrome, skip link, sidebar IA placeholders, viewport gate; status → review.
- 2026-07-16: Code review patches applied (skip scroll, # nav preventDefault, menu focus restore, viewport focus guard, next-env revert); status → done.

---

**Status:** done
