---
baseline_commit: 4629abaf4ac0796a5edff8537354213d44041c20
---

# Story 1.6: Command Palette, Jalali Date Picker & Persian Digits

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Operator or Admin,
I want keyboard command palette, Jalali date entry, and Persian digit display,
so that I can find people and enter business dates in the desktop Persian workflow.

## Acceptance Criteria

1. **Given** an authenticated user in the app shell  
   **When** they press `Ctrl+K`, or `/` while focus is not in a text input  
   **Then** the command palette opens with permission-safe personnel search hooks (may return empty until Epic 5 data exists) and closes on `Esc`

2. **And** search input accepts Latin or Persian digits, normalizes for matching, and always displays Persian digits

3. **And** `aria-busy` while searching and polite `aria-live` announce result counts («۳ نتیجه» / «نتیجه‌ای نیست»)

4. **When** a form uses `jalali-date-picker`  
   **Then** users can type or pick a Jalali date via Popover calendar with keyboard day-grid navigation; invalid dates link errors via `aria-describedby`

5. **And** Effective Date controls are date-only and visibly distinct from registration/finalization date+time controls (FR44)

6. **And** all user-facing numbers render as Persian digits; financial amounts use thousand separator (٬) when amounts are shown

## Tasks / Subtasks

- [x] Task 1: Persian digit formatting layer (AC: #2, #6)
  - [x] Add pure helpers under `apps/web/lib/` (suggested: `persian-digits.ts`):
    - `toPersianDigits(input)` — Latin/Arabic-Indic → ۰–۹
    - `toLatinDigits(input)` — ۰–۹ / ٠–٩ → 0–9 (for match/normalize)
    - `normalizeDigitsForMatch(input)` — strip separators, map to Latin for comparison
    - `formatPersianInteger(n)` — display counts/codes with Persian digits
    - `formatPersianCurrency(n, { currencyLabel? })` — Persian digits + thousand separator `٬` (e.g. `۱۲٬۳۴۵٬۶۷۸`)
  - [x] **Do not** enable FaNum font variants (1.2 freeze); Fa-En fonts only
  - [x] Apply formatting to existing user-facing numerals that this story can touch without scope creep — at minimum: command-palette live counts, date-picker display, and the viewport-gate `1280×720` copy in `app-shell.tsx`
  - [x] Financial negative format: use `−` prefix for now (`−۱۲٬۳۴۵٬۶۷۸`); do **not** invent AR-DATA policy (OQ-5 pending)
  - [x] Export interchange (OQ-4) is **out of scope** — UI display only

- [x] Task 2: shadcn primitives for Command / Dialog / Popover / Input (AC: #1–#5)
  - [x] From `apps/web` with existing `components.json` (style `new-york`, Tailwind v4, RSC): add `command`, `dialog`, `popover`, `input` via shadcn CLI
  - [x] After install, **pin `cmdk` to `^1.0.4` or newer** (CLI may pull `1.0.0` which breaks React 19 types) — verify `pnpm --filter @divan/web typecheck`
  - [x] Keep primitives under `apps/web/components/ui/`; brand wrappers stay kebab-case outside `ui/`
  - [x] Do **not** add styled-components-based date kits (`react-trip-date`) or Gregorian-only `react-day-picker` without a Jalali conversion layer

- [x] Task 3: Command palette wired into AppShell (AC: #1, #2, #3)
  - [x] Replace inert header span («جستجو… Ctrl+K», `aria-hidden`) in `apps/web/components/app-shell.tsx` with a real trigger button that opens the palette
  - [x] Mount a single client `command-palette` once in the authenticated shell (not per page)
  - [x] Shortcuts:
    - `Ctrl+K` / `Cmd+K` → open (call `preventDefault()` — browsers steal this for find/bookmark)
    - `/` → open **only** when focus is **not** in `input`, `textarea`, `select`, or `contenteditable`
    - `Esc` → close
  - [x] Groups inside palette:
    1. **ناوبری** — navigate to items from the same server-resolved `navItems` already passed to `AppShell` (reuse 1.5 permission filter; do **not** re-implement role matrix in React)
    2. **پرسنل** — permission-safe search hook that may return **empty** until Epic 5 (stub OK). Shape the hook so Story 5.1 can plug real search without rewriting the palette
  - [x] Digit behavior in search input: accept Latin or Persian; normalize for match; **display** Persian digits in the field (AC #2)
  - [x] A11y: set `aria-busy` while a search is in flight; polite `aria-live` region announces «۳ نتیجه» / «نتیجه‌ای نیست» (use Persian digit counts via formatting helpers)
  - [x] Active result row uses brand `primary` token (`command-palette-result-active` in DESIGN.md)
  - [x] `Enter` on a nav item → `router.push(href)`; `Enter` on a personnel hit → navigate to profile route **when results exist**; with empty stub, Enter on empty list is a no-op (full profile open lands in Story 5.1)
  - [x] Uniform timing for out-of-scope vs not-found: with empty stub, both look like empty — do **not** invent AR-ACCESS copy/timing constants (OQ-2 pending). Document a TODO/hook for Epic 5 / Epic 2
  - [x] **Never** import `@divan/identity-access` barrel from a client component (1.5 lesson: pulls `pg`). Pass `navItems` (and any role-safe props) from server layout → shell → client palette

- [x] Task 4: `jalali-date-picker` component (AC: #4, #5)
  - [x] Implement brand component `jalali-date-picker` composing shadcn `Input` + `Popover` + custom Jalali month day-grid (DESIGN: input `rounded.sm`, calendar popover `rounded.lg`)
  - [x] Calendar conversion: prefer a small pure library (`jalaali-js` or equivalent) **or** pure functions in `apps/web/lib/` — keep round-trip **business-day preserving** (Jalali display ↔ Gregorian date-only storage). Do **not** invent server timezone rules beyond Asia/Tehran / date-only Effective Date (AR-TEMPORAL deferred; SPEC freeze)
  - [x] Typed entry + pick from calendar; invalid dates surface inline error linked with `aria-describedby`
  - [x] Keyboard day-grid: arrow keys move focus; `Enter` selects; `Esc` closes popover; announce selected date as Persian-digit Jalali string
  - [x] Field `aria-label` names purpose (e.g. «تاریخ مؤثر»)
  - [x] Ship **two control modes** (same component family or clear variants):
    - **Effective Date** — date-only (no time)
    - **Registration / finalization** — date **+** time, visually distinct (label, helper text, or separate time control) per FR44
  - [x] Mount a **minimal demo** on an existing placeholder (recommended: `/personnel`) showing both Effective Date and registration date+time side-by-side so AC #4/#5 are manually verifiable without Epic 4 forms
  - [x] Do **not** implement personnel-event-form, draft/finalize, or domain persistence

- [x] Task 5: Manual DoD + docs (AC: #1–#6)
  - [x] Smoke checklist below
  - [x] `pnpm --filter @divan/web lint` + `typecheck`; tRPC health still green
  - [x] Touch README only if testers need a one-line pointer (palette shortcuts / demo location)

### Review Findings

- [x] [Review][Patch] Replace native `type="time"` with Persian-digit time entry (AC #6) — resolved from Decision: no later story owns this; Epic 4 forms inherit 1.6 [`apps/web/components/jalali-date-picker.tsx:394`]
- [x] [Review][Patch] Duplicate `helperId` when DateTime nests DatePicker [`apps/web/components/jalali-date-picker.tsx:369`]
- [x] [Review][Patch] Day-grid keyboard focus lost on month change / no `element.focus()` [`apps/web/components/jalali-date-picker.tsx:87`]
- [x] [Review][Patch] Selected-date `aria-live` unmounts with Popover close [`apps/web/components/jalali-date-picker.tsx:333`]
- [x] [Review][Patch] `aria-describedby` error/helper ids only when `id` prop set — use `useId` fallback [`apps/web/components/jalali-date-picker.tsx:217`]
- [x] [Review][Patch] `/` shortcut ignores `role="textbox"` / non-native editors [`apps/web/components/command-palette.tsx:40`]
- [x] [Review][Patch] Calendar `role="grid"` lacks `role="row"` wrappers [`apps/web/components/jalali-date-picker.tsx:153`]
- [x] [Review][Patch] Clearing date invents `time: "00:00"` when time was missing [`apps/web/components/jalali-date-picker.tsx:386`]
- [x] [Review][Patch] Personnel search effect has no `catch` if promise rejects [`apps/web/components/command-palette.tsx:87`]
- [x] [Review][Patch] Empty CommandGroups still render headings when zero items [`apps/web/components/command-palette.tsx:160`]
- [x] [Review][Patch] Dialog primitive default Close chrome is English [`apps/web/components/ui/dialog.tsx`]
- [x] [Review][Defer] Jalali/persian selfcheck scripts not wired into package.json/CI [`apps/web/lib/*.selfcheck.ts`] — deferred, pre-existing pattern (same as 1.5 navigation selfcheck)

### Absolute non-goals (do not implement here)

| Deferred | Story / epic |
| --- | --- |
| Real permission-safe personnel search data + Enter→profile | Story 5.1 |
| Full WCAG floor suite, banners, `prefers-reduced-motion` policy, 200% zoom gates | Story 1.7 |
| Live LDAP | Story 1.8 |
| Fine-grained AR-ACCESS enumeration timing/copy | Epic 2 / OQ-2 |
| Server calendar laws / AR-TEMPORAL beyond date-only + Asia/Tehran display contract | Architecture deferral |
| Export digit interchange | OQ-4 |
| Financial negative parentheses policy | OQ-5 / AR-DATA |
| Reinvent nav role matrix in React | Never — reuse 1.5 `navItems` / `canAccessPath` |
| FaNum fonts | Never — 1.2 freeze |
| Prisma / HR Person domain from web | Epic 3 / 5 |

## Dev Notes

### Epic context

- **Epic 1:** Secure Access & Persian Desktop Shell — after role landings (1.5), deliver keyboard command palette, Jalali entry, and app-level Persian digits (FR43, FR44, UX-DR6/12/20).
- **Upstream:** Authenticated shell, filtered `navItems`, placeholder IA routes, brand tokens without FaNum.
- **Downstream:** 1.7 completes a11y floor referencing palette/date-picker keyboard operability; 5.1 fills personnel search; later forms consume `jalali-date-picker`.

### Architecture compliance (MUST follow)

| Decision | Rule for this story |
| --- | --- |
| **AD-1** | All UI in `apps/web` |
| **AD-3** | No cross-module table reads from UI; personnel search is a hook/API seam only |
| **AD-5** | Palette navigation must stay permission-safe — reuse 1.5 filtered nav; empty personnel results must not leak existence |
| **AD-6** | No `@prisma/client` in web; no domain Person model |
| **SPEC temporal** | Default timezone Asia/Tehran; Effective Date is **date-only**; registration/finalization timestamps distinct |
| **UX spines win** | EXPERIENCE.md + DESIGN.md override any wireframe/mock drift |

[Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-1..AD-6]  
[Source: `_bmad-output/specs/spec-divan/SPEC.md` — temporal / Effective Date]

### Authoritative UX contracts (MUST follow)

**command-palette** ([EXPERIENCE.md](../planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md)):

- Triggers: `Ctrl+K`; `/` when focus not in text input
- Permission-safe search fields (future): name, Personnel Code, national ID, email, phone, team
- Digits: accept Latin or Persian → normalize for match → display Persian
- `aria-busy` + polite `aria-live` («۳ نتیجه» / «نتیجه‌ای نیست»)
- `Enter` → profile (when results exist); `Esc` closes
- Visual: active row `{colors.primary}`; radius `{rounded.lg}` (DESIGN)

**jalali-date-picker** ([EXPERIENCE.md](../planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md) + DESIGN):

- Popover calendar + typed entry; keyboard day-grid; `aria-label` / `aria-describedby`
- Display Persian-digit Jalali string
- Registration timestamps = separate date+time control

**Number formatting** ([EXPERIENCE.md](../planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md) + DESIGN):

- All user-facing numbers: ۰–۹ via **app formatting**, not FaNum
- Financial: `٬` thousand separator
- Search: Latin or Persian in; Persian out

### Library / framework requirements

| Library | Guidance |
| --- | --- |
| **Next.js 16.2.10** / **React 19.1** | App Router; client islands for palette + picker only |
| **shadcn/ui `new-york`** | Add `command`, `dialog`, `popover`, `input` via CLI into `components/ui/` |
| **cmdk** | Require `>=1.0.4` (React 19 type fix); prefer current `^1.1.x` if CLI installs it |
| **Jalali conversion** | Small pure lib (`jalaali-js`) **or** local pure functions — compose with shadcn Popover; avoid full third-party picker chrome that fights DESIGN tokens |
| **Avoid** | FaNum fonts; `styled-components` date kits; Gregorian-only pickers without Jalali layer; importing identity-access barrel on the client |

**Shortcut pitfalls:**

- Always `preventDefault()` on Ctrl/Cmd+K
- Detect text-entry focus before treating `/` as a shortcut (`HTMLInputElement` / `textarea` / `select` / `isContentEditable`)
- Mount palette once at shell level so listeners survive soft navigations

### File structure requirements

**UPDATE (high confidence)**

| File | Change |
| --- | --- |
| `apps/web/components/app-shell.tsx` | Replace inert search span with trigger; mount palette; pass `navItems` |
| `apps/web/app/(app)/layout.tsx` | Only if extra server props needed for palette (prefer reuse existing `navItems`) |
| `apps/web/app/(app)/personnel/page.tsx` (or similar placeholder) | Minimal Jalali demo (Effective Date + registration date+time) |
| `apps/web/package.json` | New deps: cmdk, radix dialog/popover, optional jalaali-js |

**NEW (high confidence)**

| Area | Likely path |
| --- | --- |
| Digit helpers | `apps/web/lib/persian-digits.ts` |
| Command palette | `apps/web/components/command-palette.tsx` (+ optional hook `apps/web/hooks/use-command-palette.ts`) |
| Jalali picker | `apps/web/components/jalali-date-picker.tsx` (+ `apps/web/lib/jalali.ts` for conversion) |
| shadcn primitives | `apps/web/components/ui/{command,dialog,popover,input}.tsx` |
| Personnel search stub | `apps/web/lib/personnel-search.ts` (async empty / delayed empty — seam for 5.1) |

**Leave alone / touch lightly:** `navigation.ts` matrix (consume only), proxy cookie gate, Auth.js, banner stack slot (1.7), skip-link, theme sync, access-denied flow.

### Current codebase state (read before coding)

| Asset | Today |
| --- | --- |
| `app-shell.tsx` | Inert centered span «جستجو… Ctrl+K» with `aria-hidden` — **primary wire point** |
| `app-sidebar.tsx` | Client; renders server-filtered `navItems`; prefix active state |
| `(app)/layout.tsx` | `auth()` + `getNavItemsForRole` → `AppShell` |
| `components/ui/` | Only `button.tsx` |
| Date / cmdk deps | **None** installed |
| `@divan/temporal-engine` | Stub `export {}` — do **not** dump UI calendar into kernel for this story |
| Fonts | Yekan Bakh Fa-En; FaNum explicitly unused (1.2) |

### Previous story intelligence

**1.5 (done — baseline `4629aba`)**

- Coarse nav owned by `@divan/identity-access` `navigation.ts` — **reuse** `navItems` / `canAccessPath`; never duplicate matrix in React
- Client must not import identity-access barrel (pg bundling)
- Proxy stays cookie-only; role gates stay in Node
- Manual smoke + optional selfcheck pattern (no Vitest mandate yet)
- Deferred: layout-only gate still runs denied RSC; JWT role staleness — not this story

**1.4 / 1.3**

- Shell chrome heights, skip-link, empty `#banner-stack` for 1.7 — preserve
- Search trigger was intentionally inert placeholder for 1.6
- Theme per-account wired — do not regress

**1.2**

- Persian digits deferred to **this** story; FaNum forbidden

### Git intelligence

Recent commits: `4629aba story 1.5` → `abbe8ba story 1.4` → `5e3ecba story 1.3` → `09679c4 story 1.2` → `7457053 story 1.1`. Keep the change set focused on palette + Jalali picker + digit layer — no auth/nav-matrix rewrite.

### Latest tech information

- **cmdk + React 19:** shadcn `add command` historically pinned `cmdk@1.0.0` which fails React 19 typecheck; bump to `>=1.0.4` (prefer `^1.1.1` if available).
- **CommandDialog:** mount once in authenticated layout/shell; use `metaKey` **or** `ctrlKey` for K.
- **Jalali + design system:** prefer composing shadcn Popover + pure conversion over drop-in pickers with foreign CSS (`react-multi-date-picker` OK only if fully restyled to DESIGN tokens — default chrome usually fails brand test).
- **Business-day round-trip:** keep conversion pure and testable (even without Vitest CI yet — a tiny `*.selfcheck.ts` like navigation is acceptable).

### Testing requirements

No mandated Vitest/Playwright yet — **manual DoD** (same as 1.1–1.5).

Required smoke:

1. Authenticated session → header trigger opens palette; `Ctrl+K` / `Cmd+K` opens; `Esc` closes
2. Focus in a text input → typing `/` inserts literal slash; palette does **not** open
3. Focus outside inputs → `/` opens palette
4. Palette **ناوبری** lists only the same items as sidebar for that role (Operator vs Audit vs SysAdmin)
5. Selecting a nav item navigates to the placeholder route
6. Personnel group may be empty; live region announces «نتیجه‌ای نیست»; `aria-busy` observable during stub delay if you add one
7. Typing `123` / `۱۲۳` in palette search normalizes for match and displays Persian digits
8. On `/personnel` (or demo host): Effective Date picker — type + calendar pick; keyboard arrows; invalid date shows `aria-describedby` error; display is Persian-digit Jalali
9. Registration/finalization control shows date+time and is visually distinct from Effective Date
10. Viewport gate and palette counts use Persian digits; a sample currency format helper renders `٬`
11. Forbidden: FaNum font files; identity-access import from client; Prisma Person model
12. `pnpm --filter @divan/web lint` + `typecheck`; tRPC health green
13. Regression: role landings, filtered sidebar, deep-link denial, login/logout still work

### Project Structure Notes

- Alignment: UI in `apps/web`; formatting + Jalali display helpers are web concerns for Epic 1; kernel `temporal-engine` stays stub until real temporal domain work
- Variance: AC allows empty personnel search until Epic 5 — treat stub as intentional, not incomplete
- Variance: Architecture does not name a Jalali npm package — choose the smallest conversion approach that preserves business day and matches DESIGN anatomy

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.6; UX-DR6/12/20]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — command-palette, jalali-date-picker, Number formatting]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — command-palette-result-active, jalali-date-picker, FaNum ban]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-43, FR-44]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md`]
- [Source: `_bmad-output/specs/spec-divan/SPEC.md` — Asia/Tehran, Effective Date date-only]
- [Source: `_bmad-output/implementation-artifacts/1-5-role-landings-permission-filtered-navigation.md`]
- [Source: `apps/web/components/app-shell.tsx`, `apps/web/components.json`, `packages/modules/identity-access/src/navigation.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- shadcn CLI installed `cmdk@^1.1.1` (satisfies ≥1.0.4); brand `button.tsx` preserved
- Avoided nested `Command` inside `CommandDialog` — custom Dialog + Command for `shouldFilter={false}`
- React Compiler lint: reset palette state in `onOpenChange` instead of sync effect; draft display for date input instead of value-sync effect

### Completion Notes List

- Persian digit helpers + selfcheck; applied to viewport gate, palette live counts, Jalali display, currency demo
- Command palette: Ctrl/Cmd+K, `/` (non-input), Esc; nav from server `navItems`; empty personnel stub with TODO for Epic 5 / OQ-2
- `JalaliDatePicker` (date-only) + `JalaliDateTimePicker` (date+time, visually distinct); demo on `/personnel`
- `jalaali-js` for business-day round-trip; `jalali.selfcheck.ts` green
- lint + typecheck green; tRPC `health` returns `{ status: "ok", app: "دیوان" }`

### File List

- `README.md`
- `_bmad-output/implementation-artifacts/1-6-command-palette-jalali-date-picker-persian-digits.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/app/(app)/personnel/page.tsx`
- `apps/web/components/app-shell.tsx`
- `apps/web/components/command-palette.tsx`
- `apps/web/components/jalali-date-picker.tsx`
- `apps/web/components/ui/command.tsx`
- `apps/web/components/ui/dialog.tsx`
- `apps/web/components/ui/input.tsx`
- `apps/web/components/ui/popover.tsx`
- `apps/web/lib/jalali.ts`
- `apps/web/lib/jalali.selfcheck.ts`
- `apps/web/lib/persian-digits.ts`
- `apps/web/lib/persian-digits.selfcheck.ts`
- `apps/web/lib/personnel-search.ts`
- `apps/web/package.json`
- `pnpm-lock.yaml`

### Change Log

- 2026-07-16: Implemented Story 1.6 — command palette, Jalali date/time pickers, Persian digit formatting layer; status → review
- 2026-07-16: Code review patches applied — Persian time entry, day-grid focus/a11y, palette guards; status → done

---

**Ultimate context engine analysis completed — comprehensive developer guide created.**
