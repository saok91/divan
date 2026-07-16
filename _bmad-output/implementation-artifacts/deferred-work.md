## Deferred from: code review of 1-2-brand-tokens-typography-theme-toggle.md (2026-07-16)

- Dark/light `button` secondary contrast vs DESIGN primary pairs (`#FFFFFF` on `#4D9FFF` / `#006FFF`) — **resolved in Story 1.7**: measured AA fail; nudged `--primary` to `#006DFF` (light) / `#1E6FE0` (dark) so secondary ≥ 4.5:1 at 14px (`a11y-floor.selfcheck.ts`)

## Deferred from: code review of 1-3-app-shell-chrome-sidebar-skip-link.md (2026-07-16)

- Viewport gate vs browser zoom — **resolved in Story 1.7**: JS gate (`shouldActivateViewportGate`) uses outer/screen metrics so 200% zoom on ≥1280×720 displays keeps the shell; genuine small windows still gate
- Fixed `#banner-stack` has no reserved height/offset for main — **resolved in Story 1.7**: ResizeObserver publishes `--banner-stack-height`; main padding offsets chrome + stack
- UserMenu lacks full APG menu keyboard pattern (roving tabindex, focus move into menu, Tab trap) — **resolved in Story 1.7**: Arrow/Home/End roving, open focuses first item, Escape returns to trigger, Tab closes (minimal APG)
- Sidebar active state uses exact `pathname === "/"` for dashboard — nested role landings (1.5) will need a prefix/segment strategy → **done in Story 1.5** (prefix/segment active matching)

## Deferred from: code review of 1-4-seeded-accounts-coarse-role-auth-dev-bootstrap.md (2026-07-16)

- `PROVIDER_UNAVAILABLE` login UI mapping — LDAP outage copy deferred to Story 1.8; current generic credentials message is intentional for 1.4
- Timing side-channel on unknown username (no dummy bcrypt) — acceptable for epic-1 bootstrap; harden later if threat model requires
- `AuthAttempt` without retention policy / FK — thin FR42 substrate; full audit envelope lands in Epic 2

## Deferred from: code review of 1-5-role-landings-permission-filtered-navigation.md (2026-07-16)

- Layout-only path gate still executes forbidden `page.tsx` RSC children — acceptable for Epic-1 empty shells; when pages add data loaders, assert access in the page (or shared page wrapper) before fetching — layout `{children}` swap alone does not stop page execution
- AccessDenial write amplification / no `accountId` index or retention — thin FR42 substrate; rate limits and audit envelope belong in Epic 2
- JWT `coarseRole` remains until session refresh after DB demote/deactivate — same Auth.js JWT pattern as 1.4; revisit with session revoke / LDAP logout (1.8+)
- `isRedirectError` import from `next/dist/client/components/redirect-error` — pre-existing 1.4; replace when Next exposes a stable public helper
- `navigation.selfcheck.ts` not wired into package scripts/CI — acceptable until Vitest/CI story lands; run manually via `tsx`
- Dual role source at login (JWT from `authenticate` vs `getActiveCoarseRoleByUsername` for landing) — required because same-request `auth()` cannot read the new cookie; rare mid-login role change only

## Deferred from: code review of 1-6-command-palette-jalali-date-picker-persian-digits.md (2026-07-16)

- Jalali/persian selfcheck scripts not wired into package.json/CI — same pattern as Story 1.5 navigation selfcheck; run manually via `tsx` until Vitest/CI story lands

## Deferred from: code review of 1-7-accessibility-floor-banner-behavior-operational-copy.md (2026-07-16)

- Break-glass grant with `active: true` and `expiresAt: null` is treated as forever-live (`isGrantLive`) — UI contract allows it; real grant lifecycle / required expiry belongs in Story 2.5
- Viewport gate using `window.screen` can mis-classify windows on a small secondary display when the primary screen reports large metrics — browser display-API limitation; revisit if multi-monitor support becomes an MVP requirement
