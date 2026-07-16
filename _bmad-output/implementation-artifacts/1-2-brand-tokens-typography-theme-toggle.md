---
baseline_commit: 74570539e821abeb44e2908b8c5e05a83f7f5de0
---

# Story 1.2: Brand Tokens, Typography & Theme Toggle

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized Divan user,
I want the org brand palette, Yekan Bakh typography, and a light/dark content theme,
So that the product reads as a governed enterprise HRIS in both modes.

## Acceptance Criteria

1. **Given** the runnable `apps/web` shell from Story 1.1  
   **When** DESIGN.md brand tokens are applied (primary, accent, chrome, muted-brand, sidebar-active; light/dark pairs) with Yekan Bakh Fa-En from `imports/fonts/yekan-bakh/` (no FaNum)  
   **Then** content canvas follows shadcn light/dark backgrounds while chrome stays navy in both modes

2. **And** gold `button-primary` uses theme-aware accent pairs meeting ≥4.5:1 contrast at 14px; `#FDB913` is never used as fill on dark content cards

3. **And** blue `button-secondary` uses primary token pairs

4. **And** a theme toggle in the user menu swaps tokens in place without navigation or unsaved-form guards and preserves focus

5. **And** theme preference persists per account when an authenticated session exists (anonymous session may use local fallback until Story 1.4)

## Tasks / Subtasks

- [x] Task 1: Add Tailwind CSS v4 + shadcn/ui substrate to `apps/web` (AC: #1)
  - [x] Install `tailwindcss` **v4.x** + `@tailwindcss/postcss`; wire PostCSS; create `app/globals.css` with `@import "tailwindcss"`
  - [x] Init shadcn/ui (`npx shadcn@latest init`) with CSS variables, style **new-york** (or current CLI default), base color neutral — inherit unlisted tokens from shadcn
  - [x] Add `clsx`, `tailwind-merge`, `class-variance-authority`; create `cn()` helper
  - [x] Align path aliases for shadcn (`@/*` → `./*` is typical). Today `apps/web/tsconfig.json` only has `~/*` → `./src/*` — **add `@/*`** (or migrate consistently); do not break existing `~/*` tRPC imports
  - [x] Import `globals.css` from `app/layout.tsx`; keep `lang="fa"` `dir="rtl"`

- [x] Task 2: Wire Yekan Bakh Fa-En typography (AC: #1)
  - [x] Copy required Fa-En font files from `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/imports/fonts/yekan-bakh/` into the app (e.g. `apps/web/public/fonts/yekan-bakh/` or `apps/web/src/fonts/`) — **do not** runtime-import from `_bmad-output`
  - [x] Load at least Regular (400), Medium (500), Bold (700); map SemiBold/600 heading-sm to Bold file if no separate SemiBold asset (DESIGN lists 600; disk has `06 Bold`)
  - [x] Prefer `next/font/local` for self-hosted faces; fall back to `@font-face` in CSS if needed
  - [x] Apply family **Yekan Bakh Fa-En** as the sole UI font on `body`
  - [x] Expose typography utility tokens: `heading` 20/700/1.3, `heading-sm` 16/600/1.35, `body` 14/400/1.6, `body-medium` 14/500/1.6, `caption` 12/400/1.5, `tabular` 14/500/1.4 + `font-variant-numeric: tabular-nums`
  - [x] **Never** ship or enable FaNum font files/features; Persian digit formatting is Story 1.6

- [x] Task 3: Map DESIGN.md brand CSS variables (light + dark) (AC: #1, #2, #3)
  - [x] Define brand overrides on `:root` and `.dark` (or next-themes class strategy):

    | Token | Light | Dark |
    | --- | --- | --- |
    | `--primary` | `#006FFF` | `#4D9FFF` |
    | `--primary-foreground` | `#FFFFFF` | `#FFFFFF` |
    | `--accent` (CTA fill) | `#FDB913` | `#FBC470` |
    | `--accent-foreground` | `#1A1208` | `#1A1208` |
    | `--chrome` | `#051061` | `#030825` |
    | `--chrome-foreground` | `#FFFFFF` | `#F1F3F5` |
    | `--muted-brand` | `#808184` | `#9E9EA0` |
    | `--sidebar-active-background` | `rgba(255,255,255,0.12)` | `rgba(255,255,255,0.08)` |

  - [x] Keep shadcn `background` / `card` / `foreground` / `muted` / `border` / `ring` / `destructive` as content-canvas tokens (light white / dark shadcn defaults)
  - [x] Expose spacing + radius: chrome-height 56px, sidebar-width 240px, table-row-compact 40px, table-row-comfortable 48px, form-section-gap 24px; rounded sm/md/lg = 4/6/8px
  - [x] Map tokens into Tailwind v4 `@theme inline` so utilities like `bg-primary`, `bg-chrome`, `rounded-md` resolve correctly
  - [x] **Invariant:** chrome navy tokens change only between chrome / chrome-dark — never to white/light sidebar when content theme flips

- [x] Task 4: Brand button primitives + contrast gate (AC: #2, #3)
  - [x] Add shadcn `Button` (or equivalent) and brand variants:
    - `button-primary`: light → accent `#FDB913` + `#1A1208`; dark → accent-dark `#FBC470` + `#1A1208`; radius md
    - `button-secondary`: primary / primary-foreground pairs; radius md
  - [x] Hard rule: primary CTA on dark content MUST use `#FBC470`, never `#FDB913` fill
  - [x] Verify (manual or small contrast check) ≥4.5:1 for CTA label at 14px in both themes before marking done
  - [x] Demo both buttons on a content card in light and dark on the home (or brand playground) page

- [x] Task 5: Theme provider + toggle with local persistence (AC: #4, #5)
  - [x] Install `next-themes`; wrap app in client `ThemeProvider` with `attribute="class"`, `defaultTheme` light (or system if desired — product requires explicit light/dark toggle; system OK as default if toggle still offers both)
  - [x] Put `suppressHydrationWarning` on `<html>` to avoid theme flash mismatch
  - [x] Build a minimal **user-menu stub** (dropdown or simple menu) hosting the theme toggle — full app-shell chrome is Story 1.3; stub may sit in a temporary navy chrome strip using `--chrome` tokens
  - [x] Toggle must: swap tokens in place (class on `html`); **no** `router.push` / navigation; **no** unsaved-form guard; preserve focus on the toggle control
  - [x] Persist preference via `localStorage` (next-themes default storage) for anonymous sessions
  - [x] Document / stub a clear extension point for per-account persistence in Story 1.4 (e.g. comment or thin `theme-storage` helper that later reads session user id) — do **not** invent auth/DB theme columns now
  - [x] Focus ring on chrome surfaces: visible 2px offset ring (UX-DR4)

- [x] Task 6: Verify RTL Persian themed shell still boots (AC: #1–#5)
  - [x] `pnpm --filter @divan/web dev` (or root `dev`) serves themed page
  - [x] Toggle light ↔ dark: content canvas flips; chrome strip stays navy; buttons follow contrast contract
  - [x] Yekan Bakh visibly applied to Persian copy
  - [x] Existing tRPC health route still works; Prisma ESLint guardrail untouched
  - [x] `pnpm --filter @divan/web lint` and `typecheck` pass

## Dev Notes

### Epic context

- **Epic 1:** Secure Access & Persian Desktop Shell — brand/theme is the visual foundation before app-shell (1.3), seeded auth (1.4), and a11y floor (1.7).
- **FRs / UX-DRs this story implements:** FR43 (Persian RTL substrate continues); **UX-DR1** (tokens + type + spacing + radius); **UX-DR2** (button-primary/secondary contrast contract); **UX-DR4** (theme toggle behavior + persistence model). Full a11y floor / banners / status badges → later stories.
- **Downstream:** Story 1.3 **Given brand tokens and theme from Story 1.2** — chrome-height, sidebar-width, chrome colors, and toggle placement in real user menu all consume this work.

### Architecture compliance (MUST follow)

| Rule | Implication for 1.2 |
| --- | --- |
| **AD-6** T3 + Persian RTL web | Stay in `apps/web`; Next App Router; no separate design microservice |
| Stack | Next **16.2.x**, React 19, TypeScript 5, pnpm — already from 1.1 |
| UX authority | Capability map: Persian RTL UX → **UX DESIGN.md** — brand values come from DESIGN.md, not invented |
| Structural seed | Do **not** relocate kernel/modules; optional `packages/ui` is **not** required — keep brand layer in `apps/web` unless a clear reuse need appears |
| Prisma guardrail | Do not weaken ESLint `no-restricted-imports` on `@prisma/client` in `apps/web` |

[Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-6, Stack, Capability map]

### Absolute non-goals (do not implement here)

- Full `app-shell` (fixed header/sidebar layout, skip link «پرش به محتوا», banner stack) → **Story 1.3**
- Seeded auth / per-account DB preference write path → **Story 1.4** (localStorage fallback is enough)
- Command palette, Jalali picker, Persian digit formatter → **Story 1.6**
- Status badge components, banners, AA floor audit suite → **Story 1.7** (still define tokens if cheap; do not build badge UI)
- LDAP → **Story 1.8**
- FaNum fonts; bilingual UI; mobile layout
- Domain modules / Prisma models for theme preference

### Current codebase state (UPDATE files — read before editing)

**`apps/web/app/layout.tsx` today:**
- Metadata «دیوان»; `<html lang="fa" dir="rtl">`; bare `<body>{children}</body>`
- **Change:** import globals.css; apply font variable class; ThemeProvider; suppressHydrationWarning; optional chrome class hooks
- **Preserve:** `lang="fa"` `dir="rtl"`; Persian metadata; no English LTR regression

**`apps/web/app/page.tsx` today:**
- Minimal Persian H1/paragraph
- **Change:** demonstrate content canvas + primary/secondary buttons + user-menu stub with theme toggle (may use a thin chrome bar for toggle placement)
- **Preserve:** Persian visible copy; do not replace with English Next.js boilerplate

**`apps/web/package.json` today:**
- Next 16.2.10, tRPC 11, React 19 — **no** Tailwind/shadcn/next-themes
- **Change:** add styling deps only; keep workspace `@divan/*` deps

**`apps/web/tsconfig.json` today:**
- Paths: `~/*` → `./src/*` only
- **Change:** add `@/*` for shadcn convention **or** configure shadcn aliases to `~/*` — pick one coherent scheme and document it in File List

**Missing today (NEW):** `globals.css`, PostCSS/Tailwind config, `components.json`, `components/ui/*`, theme provider, font assets under `apps/web`

### Project structure notes

**Recommended layout (keep brand in app — no new package required):**

```text
apps/web/
  app/
    globals.css          # NEW — Tailwind + CSS variables
    layout.tsx           # UPDATE
    page.tsx             # UPDATE — brand demo / toggle host
  components/
    theme-provider.tsx   # NEW
    theme-toggle.tsx     # NEW (or under user-menu stub)
    user-menu-stub.tsx   # NEW — temporary until 1.3
    ui/button.tsx        # NEW — shadcn + brand variants
  lib/utils.ts           # NEW — cn()
  public/fonts/yekan-bakh/  # NEW — copied Fa-En files
  components.json        # NEW
  postcss.config.mjs     # NEW
```

**Font source (copy from, never serve from):**  
`_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/imports/fonts/yekan-bakh/`  
Files: `Yekan Bakh Fa-En 01–08` × `.woff` / `.ttf` / `.eot` — prefer **woff** (and ttf fallback) for web.

**Conflict / variance:** EXPERIENCE.md expects shadcn + Tailwind; Story 1.1 intentionally deferred them. Architecture Structural Seed has no `packages/ui` — implementing inside `apps/web` is correct.

### Library / framework requirements

| Package | Pin guidance | Notes |
| --- | --- | --- |
| `tailwindcss` | **4.x** (latest 4.x OK) | CSS-first `@theme`; no mandatory `tailwind.config.ts` |
| `@tailwindcss/postcss` | match Tailwind 4 | Required PostCSS plugin for Next |
| `next-themes` | latest 0.4.x | `attribute="class"`; localStorage until 1.4 |
| shadcn/ui CLI | `npx shadcn@latest` | Init + `button` (dropdown optional for user-menu stub) |
| `class-variance-authority` / `clsx` / `tailwind-merge` | current stable | Standard shadcn helpers |
| `lucide-react` | if CLI adds icons | Optional for menu/sun/moon icons — keep sparse |

**Do not:** add Material UI, Chakra, styled-components, or a second CSS framework.

### Technical requirements (load-bearing)

1. **Content vs chrome split:** Theme class flips content canvas (`background`/`card`); chrome uses `--chrome` / `--chrome-dark` and remains navy in both modes.
2. **CTA contrast contract:** Light CTA = `#FDB913` on `#1A1208` text; Dark CTA = `#FBC470` on `#1A1208` text; never light accent fill on dark cards.
3. **Toggle semantics:** In-place class swap only; preserve focus; no navigation; no form dirty-check.
4. **Persistence:** Anonymous → localStorage; authenticated per-account → Story 1.4 extension point only.
5. **Typography:** Yekan Bakh Fa-En only; no FaNum; minimum body 14px.

### Testing requirements

- Architecture still does not mandate a unit/e2e runner — do not block on Playwright/Vitest unless already present.
- **Definition of done (manual):**
  1. Light mode: white/near-white content, navy chrome stub, gold primary + blue secondary buttons
  2. Dark mode: dark shadcn content, navy chrome stub, **lighter gold** (`#FBC470`) primary — inspect computed styles; confirm `#FDB913` is not the dark CTA fill
  3. Toggle twice; focus remains on control; URL unchanged
  4. Reload: theme preference restored from localStorage
  5. Persian text renders in Yekan Bakh (DevTools → computed `font-family`)
  6. `lint` + `typecheck` + `dev` smoke OK; tRPC `/api/trpc/health` still responds

### Previous story intelligence

From Story 1.1 (`1-1-initialize-modular-monolith-monorepo.md`):

- Manual Structural Seed scaffold (not create-t3-app); package names `@divan/*`
- Explicit non-goal: “Brand tokens, Yekan Bakh fonts, light/dark theme → Story 1.2”
- Home page must stay Persian RTL — do not regress to English welcome
- ESLint FlatCompat pitfalls fixed by importing Next 16 flat configs directly — leave working
- Prisma stays only in `@divan/db`; web must not import `@prisma/client`
- Path alias today is `~/*` for `src/` — coordinate with shadcn `@/*`
- Review patches already applied on 1.1 (pool lifecycle, env gitignore, docker compose) — do not reopen

### Git intelligence summary

- Latest commit: `7457053 story 1.1` — established monorepo, Next 16.2.10, tRPC, Prisma 7.8, RTL placeholder
- Patterns to continue: pnpm workspaces, kebab-case packages, Persian product copy, minimal stubs over speculative frameworks
- No existing CSS/Tailwind patterns — this story establishes the UI styling convention for all later Epic 1 UI work

### Latest tech information (as of 2026-07-16)

- **Tailwind CSS v4:** Configure via CSS (`@import "tailwindcss"`, `@theme inline`); use `@tailwindcss/postcss` with Next — not the old `tailwind.config.js`-first workflow
- **Dark mode with Tailwind v4 + shadcn:** Prefer `@custom-variant dark (&:where(.dark, .dark *));` (or CLI-generated equivalent) so `next-themes` class strategy works
- **shadcn + Next 16:** `npx shadcn@latest init` then `add button`; ensure `globals.css` imported in root layout
- **next-themes:** Wrap with client provider; `suppressHydrationWarning` on `<html>`; avoid rendering theme-dependent UI before mount if it causes hydration mismatch (mounted guard or `useSyncExternalStore` pattern)
- **Fonts:** Self-host Yekan via `next/font/local` — do not use Google Fonts CDN for this family

### Project context reference

- No `project-context.md` in repo. Treat Architecture Spine + DESIGN.md + this story as the implementation contract.
- SPEC CAP-11: shadcn/ui brand layer for Persian RTL desktop — aligns with this story.
- NFR provisional: WCAG 2.2 AA light+dark — contrast gate on CTA is in-scope here; full a11y floor is Story 1.7.

### Dev Agent guardrails (anti-patterns)

| Do | Don't |
| --- | --- |
| Copy Fa-En fonts into `apps/web` | Import fonts from `_bmad-output` at runtime |
| Use DESIGN.md hex values as source of truth | Invent a purple/indigo or cream AI-default palette |
| Keep chrome navy in both themes | White sidebar / light header in “light mode” |
| Theme-aware gold CTA (`#FBC470` in dark) | Use `#FDB913` fill on dark content cards |
| Minimal user-menu stub for toggle | Build full app-shell, skip link, banner stack (1.3) |
| localStorage until auth exists | Create Person/User theme tables or fake auth |
| Preserve `lang="fa"` `dir="rtl"` | Drop RTL while “fixing” shadcn LTR examples |
| Keep Prisma ESLint boundary | Touch `packages/db` schema for theming |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.2, UX-DR1/DR2/DR4]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — colors, typography, spacing, rounded, button-primary/secondary, do/don't]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — theme modes, theme-toggle, shadcn+Tailwind foundation]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-6, apps/web RTL]
- [Source: `_bmad-output/specs/spec-divan/SPEC.md` — CAP-11]
- [Source: `_bmad-output/specs/spec-divan/nfr-provisional.md` — WCAG AA light+dark]
- [Source: `_bmad-output/implementation-artifacts/1-1-initialize-modular-monolith-monorepo.md` — prior learnings & explicit deferral]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/imports/fonts/yekan-bakh/` — font assets]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/.working/color-themes-1.html` — theme exploration reference]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- CTA contrast check (WCAG relative luminance): light `#FDB913`/`#1A1208` ≈ 10.69:1; dark `#FBC470`/`#1A1208` ≈ 11.67:1 (both ≥4.5:1)
- Browser CDP smoke: light accent `#fdb913`; dark accent `#fbc470` (never `#FDB913` on dark); chrome `#051061` → `#030825`; focus retained on toggle; `localStorage` key `divan-theme`
- `pnpm --filter @divan/web lint`, `typecheck`, `build` pass; `/api/trpc/health` 200

### Completion Notes List

- Tailwind v4 + PostCSS + shadcn new-york substrate in `apps/web` (manual `components.json` + Button; kept brand layer in-app)
- Path aliases: `@/*` → `./*` added alongside existing `~/*` → `./src/*` (tRPC imports unchanged)
- Yekan Bakh Fa-En self-hosted via `next/font/local` (400/500/700; 600 maps to Bold); no FaNum
- Brand CSS variables on `:root` / `.dark` with content-vs-chrome split; `@theme inline` utilities
- `Button` variants `primary` (gold CTA) / `secondary` (blue); demo on home content card
- `next-themes` ThemeProvider + user-menu stub + theme toggle; `lib/theme-storage.ts` extension point for Story 1.4

### File List

- `_bmad-output/implementation-artifacts/1-2-brand-tokens-typography-theme-toggle.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/components.json`
- `apps/web/components/theme-provider.tsx`
- `apps/web/components/theme-toggle.tsx`
- `apps/web/components/user-menu-stub.tsx`
- `apps/web/components/ui/button.tsx`
- `apps/web/lib/theme-storage.ts`
- `apps/web/lib/utils.ts`
- `apps/web/postcss.config.mjs`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next-env.d.ts`
- `apps/web/src/fonts/yekan-bakh.ts`
- `apps/web/src/fonts/yekan-bakh/yekan-bakh-fa-en-regular.woff`
- `apps/web/src/fonts/yekan-bakh/yekan-bakh-fa-en-regular.ttf`
- `apps/web/src/fonts/yekan-bakh/yekan-bakh-fa-en-medium.woff`
- `apps/web/src/fonts/yekan-bakh/yekan-bakh-fa-en-medium.ttf`
- `apps/web/src/fonts/yekan-bakh/yekan-bakh-fa-en-bold.woff`
- `apps/web/src/fonts/yekan-bakh/yekan-bakh-fa-en-bold.ttf`
- `pnpm-lock.yaml`

### Change Log

- 2026-07-16: Implemented Story 1.2 — brand tokens, Yekan Bakh Fa-En, light/dark theme toggle with localStorage; status → review
- 2026-07-16: Code review — applied 7 patches (menu a11y/RTL, Button type, theme spacing vars, font paths); deferred secondary contrast to 1.7; status → done

### Review Findings

- [x] [Review][Defer] Dark/light `button` secondary contrast vs DESIGN primary pairs [`apps/web/app/globals.css:24`] — deferred, keep DESIGN primary pairs until Story 1.7 a11y floor
- [x] [Review][Patch] Align user-menu dropdown to inline-end to avoid RTL viewport clipping [`apps/web/components/user-menu-stub.tsx:51`]
- [x] [Review][Patch] Use `pointerdown` (not only `mousedown`) for outside-dismiss [`apps/web/components/user-menu-stub.tsx:29`]
- [x] [Review][Patch] Close stub menu on focus leaving; restore focus to trigger on Escape [`apps/web/components/user-menu-stub.tsx:16`]
- [x] [Review][Patch] Mark theme toggle as `role="menuitem"` (or drop `role="menu"`) for valid menu pattern [`apps/web/components/user-menu-stub.tsx:49`]
- [x] [Review][Patch] Default `Button` `type` to `"button"` to prevent accidental form submit [`apps/web/components/ui/button.tsx:51`]
- [x] [Review][Patch] Point `@theme` spacing utilities at `:root` CSS vars to avoid token drift [`apps/web/app/globals.css:101`]
- [x] [Review][Patch] Clarify `next/font` paths to `./yekan-bakh/...` [`apps/web/src/fonts/yekan-bakh.ts:10`]

---

**Status:** done

Ultimate context engine analysis completed - comprehensive developer guide created
