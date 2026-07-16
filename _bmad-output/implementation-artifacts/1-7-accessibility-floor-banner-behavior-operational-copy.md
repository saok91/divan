---
baseline_commit: 12af889
---

# Story 1.7: Accessibility Floor, Banner Behavior & Operational Copy

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized desktop user,
I want keyboard-reachable, accessible surfaces with clear operational Persian copy and global stale/break-glass banners,
so that essential tasks remain usable and trustworthy under WCAG 2.2 AA intent.

## Acceptance Criteria

1. **Given** the authenticated app shell  
   **When** a blocking stale/recalculation condition is signaled by the platform  
   **Then** `stale-banner` appears with `role="alert"` and `aria-live="assertive"`, is non-dismissible while blocking, and sits above any `break-glass-banner`

2. **And** gold CTAs (`button` variant `primary` / DESIGN `button-primary`) on affected finalize/export/report actions are disabled while blocking — **hooks ready for Epic 4–6** (domain actions may be demo-only in this story)

3. **When** break-glass access is active  
   **Then** `break-glass-banner` shows below stale (if present) and becomes dismissible on expiry without obscuring a blocking stale message

4. **And** focus rings are visible on chrome (2px offset via existing `.focus-ring-chrome`) and content; dialogs / command palette / nav / jalali date picker remain keyboard operable

5. **And** `prefers-reduced-motion: reduce` disables toast slide and skeleton shimmer (add primitives if missing; wire CSS/JS guards)

6. **And** empty/error copy follows operational Persian patterns (fact + next step; no emoji / ceremonial success); identity and permission messages match EXPERIENCE.md State Patterns table for surfaces that already exist in Epic 1

7. **And** at **200% browser zoom**, primary actions remain reachable without **page-level** horizontal scroll (table/container scroll still allowed) — resolve the known CSS viewport-gate conflict from Story 1.3 deferred work

## Tasks / Subtasks

- [x] Task 1: Banner design tokens + stack layout (AC: #1, #3, #7)
  - [x] Add DESIGN.md `{stale-banner}` and `{break-glass-banner}` CSS variables to `apps/web/app/globals.css` for **light and dark** (background, foreground, border)
  - [x] Wire `#banner-stack` so stacked banners do **not** obscure `main` — reserve/offset height (CSS var + ResizeObserver or measured stack height). This closes deferred-work item from 1.3
  - [x] Stack order **top→bottom**: stale (blocking) → break-glass; never hide/collapse stale behind break-glass
  - [x] Keep skip link as first focusable; banner stack remains below fixed chrome header (`top-chrome-height`)

- [x] Task 2: `stale-recalc-banner` + platform signal hook (AC: #1, #2)
  - [x] Create brand component (kebab-case outside `ui/`), e.g. `apps/web/components/stale-recalc-banner.tsx`
  - [x] Blocking variant: `role="alert"` + `aria-live="assertive"`; **no dismiss control** while blocking
  - [x] Operational Persian copy pattern (Voice): fact + time/date + next step — e.g. «داده به‌روز نیست — تا ۰۹:۱۴ محاسبه نشده.» (Persian digits via existing `toPersianDigits`)
  - [x] Platform signal: client context/provider (or thin hook) exposing `recalculation_pending` / blocking stale — **mockable for smoke**; real recalc jobs land in Epic 4 (AD-6). Do **not** invent workers/DB tables here
  - [x] Export a reusable gate: e.g. `useStaleBlocking()` / `isGoldCtaBlocked` so Epic 4–6 can disable finalize/export/report gold CTAs without rewriting banners
  - [x] Demo: controllable smoke toggle on an existing placeholder (recommended `/personnel` or `/operations`) to force blocking stale on/off

- [x] Task 3: `break-glass-banner` (AC: #3)
  - [x] Create `apps/web/components/break-glass-banner.tsx` using `{break-glass-banner}` tokens
  - [x] Renders **below** stale when both active; dismissible **only on expiry** (or when grant inactive) — not while a user casually clicks away during an active grant unless product copy says otherwise; AC: dismissible on expiry
  - [x] Never covers/obscures blocking stale message (z-order + stack order)
  - [x] Mock grant state in same provider/demo as Task 2; real break-glass grant lifecycle is Story 2.5 — only UI contract here
  - [x] Wire into `(app)/layout.tsx` via `AppShell` `bannerSlot` (or a single `BannerStackHost` passed as `bannerSlot`)

- [x] Task 4: Gold CTA disable contract (AC: #2)
  - [x] Implement hook/context consumption on at least one **demo** primary (`variant="primary"`) button labeled as finalize/export/report stand-in so AC is manually verifiable
  - [x] Disabled state must be real (`disabled` + existing opacity/pointer-events), not only visual
  - [x] Do **not** implement personnel-event-form, export panel, or domain finalize (Epic 4–6)

- [x] Task 5: Accessibility floor polish (AC: #4, #5, #7)
  - [x] Verify chrome focus rings (`.focus-ring-chrome`) and content `focus-visible:ring-*` still meet 2px offset intent after banner work
  - [x] Smoke keyboard paths already shipped: command palette, jalali date picker, sidebar nav, dialogs — fix regressions only; do not rebuild 1.6
  - [x] **UserMenu APG:** add roving focus into menu / Arrow keys / Tab trap or documented minimal APG-compliant pattern (closes deferred from 1.2/1.3). Keep Escape → close + return focus to trigger
  - [x] **Route announce:** on authenticated route change, polite live region announces surface in Persian (EXPERIENCE landmarks example: «پرسنل، جستجو» — map existing IA titles; keep short)
  - [x] Add `skeleton` and/or `toast` shadcn primitives **only if needed** to satisfy reduced-motion AC; if toast unused in Epic 1, still add CSS guard so future toast slide is covered
  - [x] Global CSS: `@media (prefers-reduced-motion: reduce)` → disable skeleton shimmer + toast slide animations (`animation: none` / no transition slide)
  - [x] **Viewport gate vs 200% zoom:** replace or supplement CSS-only `@media (max-width: 1279px), (max-height: 719px)` gate so that on a **≥1280×720 reference display**, 200% browser zoom does **not** falsely hide the shell. Keep genuine small-window gate message. Update `viewport-gate-focus-guard.tsx` accordingly
  - [x] Confirm at 200% zoom (shell visible): primary chrome actions (search trigger, user menu, skip link → main) reachable without **page-level** horizontal scroll

- [x] Task 6: Secondary button contrast + operational copy catalog (AC: #6)
  - [x] **Verify** `button` `secondary` (`#FFFFFF` on `#006FFF` light / `#4D9FFF` dark) ≥ 4.5:1 at 14px; keep DESIGN pairs — adjust only if measurement fails (closes 1.2 deferred item)
  - [x] Centralize Epic-1 operational strings in e.g. `apps/web/lib/operational-copy.ts` (or equivalent) matching EXPERIENCE State Patterns for **surfaces that exist today**:
    - Deep-link deny: «دسترسی ندارید.» (already in `access-denied.tsx` — keep exact; reuse from catalog)
    - LDAP unavailable (prep for 1.8, may not wire UI yet): «اتصال به سامانه هویت برقرار نیست.»
    - Empty search (palette/personnel stub): «نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.»
    - Stale banner sample per Voice table
    - Scope revoked / unsaved form strings may be catalog-only until Epic 2/4 surfaces exist — do not invent new pages
  - [x] Audit existing Epic-1 copy (`login-form`, `placeholder-page` descriptions, viewport gate, palette empty states) — remove emoji/ceremonial success if any; align fact + next step
  - [x] No bilingual toggle; Persian-only UI (unchanged)

- [x] Task 7: Manual DoD + docs (AC: #1–#7)
  - [x] Smoke checklist below
  - [x] `pnpm --filter @divan/web lint` + `typecheck`
  - [x] Update `_bmad-output/implementation-artifacts/deferred-work.md`: mark 1.7-owned items resolved or re-defer with rationale
  - [x] Touch README only if testers need a one-line pointer (banner demo location / zoom note)

### Absolute non-goals (do not implement here)

| Deferred | Story / epic |
| --- | --- |
| Real recalculation jobs / event-store pending | Epic 4 (esp. 4.4) |
| Real break-glass grant lifecycle + audit | Story 2.5 |
| Live LDAP + `PROVIDER_UNAVAILABLE` login wiring | Story 1.8 |
| Full WCAG formal AR-NFR gate evidence / axe CI harness | OQ-1 / AR-NFR (manual floor only unless trivial selfcheck added) |
| `personnel-data-table`, status badges, event forms | UX-DR7–11 / later epics |
| Sensitive confirmation dialog blocked-by-stale | UX-DR14 / Epic 4 |
| Prisma / HR domain from web | Epic 3+ |
| FaNum fonts | Never — 1.2 freeze |
| Import `@divan/identity-access` from client components | Never — pulls `pg` (1.5/1.6 lesson) |

## Dev Notes

### Epic context

Epic 1 delivers the Persian RTL desktop shell substrate. Stories 1.1–1.6 shipped monorepo, tokens, app shell + empty banner slot, auth, role landings, palette/Jalali. **1.7 locks the a11y floor, global banner contract, and operational copy voice** so Epics 2 and 4–7 can mount real stale/break-glass signals and gold-CTA gates without redesign.

### Previous story intelligence (1.6 → 1.7)

- Pattern: brand components kebab-case under `apps/web/components/`; shadcn under `components/ui/`
- Pass server-resolved data into client islands; never import `@divan/identity-access` from client
- DoD = lint + typecheck + **manual smoke**; optional `*.selfcheck.ts` via `tsx` — not required in CI yet
- 1.6 explicitly deferred to 1.7: WCAG floor suite, banners, `prefers-reduced-motion`, 200% zoom gates
- 1.6 review fixed many a11y bugs on palette/date-picker — treat those as regression baselines

### Deferred work this story MUST address

From `deferred-work.md`:

1. Secondary button contrast verification (from 1.2)
2. Viewport gate vs 200% zoom (from 1.3)
3. `#banner-stack` content offset when banners fill (from 1.3)
4. UserMenu full APG keyboard pattern (from 1.2/1.3)

### Current code state (UPDATE targets)

| File | Current behavior | This story |
| --- | --- | --- |
| `apps/web/components/app-shell.tsx` | `bannerSlot` optional; `#banner-stack` fixed with **no height offset** for main (`pt-chrome-height` only) | Wire host + offset |
| `apps/web/app/(app)/layout.tsx` | Renders `AppShell` **without** `bannerSlot` | Pass banner stack host |
| `apps/web/app/globals.css` | Brand + `.focus-ring-chrome` + CSS viewport gate; **no** banner tokens / reduced-motion | Add tokens + motion + possibly gate change |
| `apps/web/components/viewport-gate-focus-guard.tsx` | Focus trap on `.min-viewport-gate` | Align with new gate strategy |
| `apps/web/components/user-menu.tsx` | Escape/blur/`aria-expanded`; **no** Arrow/roving/Tab trap | APG upgrade |
| `apps/web/components/ui/button.tsx` | `primary` gold / `secondary` blue DESIGN pairs | Contrast verify; optional `data-`/`aria` helpers for stale gate |
| `apps/web/components/access-denied.tsx` | Exact «دسترسی ندارید.» | Keep; prefer shared catalog |
| `apps/web/components/command-palette.tsx` / `jalali-date-picker.tsx` | Keyboard operable baselines | Regression-only |

### Architecture compliance

- **UI only in `apps/web`** (AD-1 / capability map). No Prisma in web.
- AD-6: UI must be able to show `recalculation_pending` — this story defines the **visible contract**; backend jobs later.
- Persian user-facing errors at boundaries — copy voice matches EXPERIENCE; API error mapping for LDAP stays 1.8.
- Stack: Next.js App Router, Tailwind 4, shadcn/ui, existing Auth.js session shell.

### UX / DESIGN invariants (do not violate)

- Banner order: `{stale-banner}` blocking precedence → `{break-glass-banner}`  
  [Source: EXPERIENCE.md Component Patterns `app-shell`]
- Stale blocking: `role="alert"`, `aria-live="assertive"`; non-dismissible; gold CTAs disabled on affected finalize/export/report  
  [Source: EXPERIENCE.md `stale-recalc-banner`; UX-DR5]
- Break-glass: below stale; dismissible on expiry; never obscures blocking stale  
  [Source: EXPERIENCE.md `break-glass-banner`]
- Voice: fact + date + next step; no emoji; no ceremonial success  
  [Source: EXPERIENCE.md Voice and Tone; UX-DR24]
- A11y floor: WCAG 2.2 AA intent; 200% zoom; chrome+content focus; reduced-motion  
  [Source: EXPERIENCE.md Accessibility Floor; UX-DR21]
- Token pairs for banners in DESIGN.yaml — implement both themes  
  [Source: DESIGN.md Colors / Components]
- Spines win over mockups on conflict

### Library / framework requirements

- Prefer existing Radix/shadcn stack already in repo (Dialog, etc.)
- Add shadcn `skeleton` / `toast` only if required for AC #5
- Do **not** add axe/playwright CI unless you also add a tiny optional selfcheck — architecture does not require an a11y harness for 1.7; **manual smoke is the DoD** (same as 1.5/1.6)
- Persian digits: reuse `apps/web/lib/persian-digits.ts` — do not reimplement
- Pin versions via existing workspace `pnpm` — no random UI kit swaps

### File structure requirements

**Likely CREATE:**

- `apps/web/components/stale-recalc-banner.tsx`
- `apps/web/components/break-glass-banner.tsx`
- `apps/web/components/banner-stack.tsx` (or `banner-stack-host.tsx`)
- `apps/web/components/platform-status-provider.tsx` (or `hooks/use-platform-status.ts` + provider)
- `apps/web/lib/operational-copy.ts`
- `apps/web/components/route-announcer.tsx` (name flexible)
- Optional: `apps/web/components/ui/skeleton.tsx`, `toast.tsx`

**Likely UPDATE:**

- `apps/web/components/app-shell.tsx` — banner offset / CSS var integration
- `apps/web/app/(app)/layout.tsx` — provide `bannerSlot`
- `apps/web/app/globals.css` — tokens, reduced-motion, viewport strategy
- `apps/web/components/user-menu.tsx` — APG keyboard
- `apps/web/components/viewport-gate-focus-guard.tsx`
- `apps/web/components/ui/button.tsx` — only if gate helper belongs here
- `apps/web/app/(app)/personnel/page.tsx` (or ops) — demo toggles
- `_bmad-output/implementation-artifacts/deferred-work.md`

### Testing requirements

Manual smoke (authenticated seeded user):

1. Toggle blocking stale → banner appears with alert semantics; no dismiss; above break-glass
2. Toggle break-glass with and without stale → order + expiry dismiss behavior
3. Gold demo CTA disabled while blocking; enabled when clear
4. Tab: skip link → chrome controls → main; focus rings visible light+dark
5. Palette / date picker / nav still keyboard operable (regression)
6. UserMenu: open with keyboard; Arrow/Tab per implemented APG; Escape returns focus
7. OS/browser `prefers-reduced-motion`: no skeleton shimmer / toast slide
8. 200% zoom on a wide display: shell usable; no page-level horizontal scroll for primary actions; gate does not falsely replace shell
9. Copy audit: no emoji/ceremonial success on touched surfaces; deny string unchanged

Automated: `pnpm --filter @divan/web lint` && `pnpm --filter @divan/web typecheck`

### Git intelligence summary

Recent commits: `12af889` story 1.6 → `4629aba` 1.5 → `abbe8ba` 1.4 → `5e3ecba` 1.3 → `09679c4` 1.2. Follow the same artifact+code co-commit style; extend shell rather than replacing it.

### Latest tech notes

- Use `role="alert"` / assertive live **only** for blocking stale — reserve assertive for critical interruptions (WCAG live-region guidance)
- Prefer keeping live-region containers mounted; update text when signaling (avoid missed announcements from late `role="alert"` mount when practical)
- `prefers-reduced-motion`: CSS `animation: none` / short transitions; guard any JS-driven toast slide
- WCAG 2.2 AA remains **provisional** (NFR12 / OQ-1) — implement the EXPERIENCE floor; do not claim formal certification

### Project context reference

No `project-context.md` found in repo. Follow ARCHITECTURE-SPINE + EXPERIENCE + DESIGN + this story. Epic 1 communication: Persian UI strings; this story file is English.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.7, UX-DR5/21/22/24]
- [Source: `.../ux-divan-2026-07-13/EXPERIENCE.md` — Voice, State Patterns, Component Patterns, Accessibility Floor]
- [Source: `.../ux-divan-2026-07-13/DESIGN.md` — `stale-banner` / `break-glass-banner` tokens]
- [Source: `.../architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-6 `recalculation_pending`, `apps/web`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `_bmad-output/implementation-artifacts/1-6-command-palette-jalali-date-picker-persian-digits.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Secondary contrast measurement: DESIGN `#006FFF` ≈ 4.45:1 and `#4D9FFF` ≈ 2.72:1 vs white — nudged to `#006DFF` / `#1E6FE0`.
- Viewport gate: CSS `max-width/height` false-triggered at 200% zoom; replaced with `shouldActivateViewportGate` (outer + screen metrics).

### Completion Notes List

- Banner tokens (light/dark), `BannerStack` + ResizeObserver `--banner-stack-height`, stale above break-glass.
- `PlatformStatusProvider` + `useStaleBlocking` / `isGoldCtaBlocked`; smoke toggles and gold CTA demos on `/personnel`.
- Stale banner: `role="alert"` + `aria-live="assertive"`, non-dismissible; break-glass dismissible only after expiry.
- UserMenu APG (Arrow/Home/End, focus first item, Escape→trigger, Tab closes); `RouteAnnouncer` polite live region.
- `prefers-reduced-motion` disables skeleton shimmer + toast slide CSS; skeleton primitive added.
- Operational copy catalog; access-denied / login / palette empty aligned; LDAP string catalog-only for 1.8.
- Deferred-work 1.2/1.3 a11y items marked resolved; README notes banner demo + zoom.
- Validated: `pnpm --filter @divan/web lint` + `typecheck`; `a11y-floor.selfcheck.ts` ok.

### File List

- README.md
- _bmad-output/implementation-artifacts/1-7-accessibility-floor-banner-behavior-operational-copy.md
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- apps/web/app/(app)/layout.tsx
- apps/web/app/(app)/personnel/page.tsx
- apps/web/app/globals.css
- apps/web/components/access-denied.tsx
- apps/web/components/app-shell.tsx
- apps/web/components/banner-stack.tsx
- apps/web/components/break-glass-banner.tsx
- apps/web/components/command-palette.tsx
- apps/web/components/login-form.tsx
- apps/web/components/platform-status-provider.tsx
- apps/web/components/route-announcer.tsx
- apps/web/components/stale-recalc-banner.tsx
- apps/web/components/theme-toggle.tsx
- apps/web/components/ui/skeleton.tsx
- apps/web/components/user-menu.tsx
- apps/web/components/viewport-gate-focus-guard.tsx
- apps/web/lib/a11y-floor.selfcheck.ts
- apps/web/lib/operational-copy.ts
- apps/web/lib/viewport-gate.ts

### Change Log

- 2026-07-16: Implemented Story 1.7 accessibility floor, banner stack contract, operational copy, and viewport-gate zoom fix.
- 2026-07-16: Code review patches — avail-based viewport gate, sidebar banner offset, UserMenu APG, keep-mounted stale alert, break-glass expiry guards.

### Review Findings

- [x] [Review][Patch] Viewport gate uses `screen.avail*` (+ slack) so maximized 1280×720 is not false-gated [`apps/web/lib/viewport-gate.ts`] — decided: compare outer to `min(MIN, avail)` with 16px slack; selfcheck covers taskbar case
- [x] [Review][Patch] Banner stack overlays fixed sidebar top links [`apps/web/components/app-sidebar.tsx`]
- [x] [Review][Patch] No CSS/no-JS viewport-gate fallback; shell flashes before hydration [`apps/web/app/globals.css`]
- [x] [Review][Patch] Stale `role="alert"` unmounts when inactive — prefer keep-mounted live region [`apps/web/components/stale-recalc-banner.tsx`]
- [x] [Review][Patch] Invalid `expiresAt` (NaN parse) still enables break-glass dismiss UI [`apps/web/components/break-glass-banner.tsx`]
- [x] [Review][Patch] UserMenu ArrowUp on closed trigger should focus last item [`apps/web/components/user-menu.tsx`]
- [x] [Review][Patch] UserMenu Tab closes without moving focus — focus can be lost [`apps/web/components/user-menu.tsx`]
- [x] [Review][Patch] Outside pointerdown uses `closeMenu(true)` and can steal focus from the click target [`apps/web/components/user-menu.tsx`]
- [x] [Review][Patch] Escape on open menu while focus still on trigger is unhandled [`apps/web/components/user-menu.tsx`]
- [x] [Review][Patch] When gate deactivates, focus can remain inside `display:none` gate node [`apps/web/components/viewport-gate-focus-guard.tsx`]
- [x] [Review][Patch] Break-glass expiry timeout not refreshed on `visibilitychange` [`apps/web/components/platform-status-provider.tsx`]
- [x] [Review][Patch] Selfcheck asserts realistic maximized outer metrics below 720 [`apps/web/lib/a11y-floor.selfcheck.ts`]
- [x] [Review][Patch] Measure banner stack height in `useLayoutEffect` to avoid first-frame main overlap [`apps/web/components/banner-stack.tsx`]
- [x] [Review][Defer] Break-glass `active` + `expiresAt: null` stays forever-live [`apps/web/components/platform-status-provider.tsx:42`] — deferred, pre-existing contract for Story 2.5 grant lifecycle
- [x] [Review][Defer] `window.screen` metrics on multi-monitor / secondary small display [`apps/web/lib/viewport-gate.ts:24`] — deferred, pre-existing browser display API limitation

---

**Story completion status:** done
