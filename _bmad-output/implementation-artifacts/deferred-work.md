## Deferred from: code review of 1-2-brand-tokens-typography-theme-toggle.md (2026-07-16)

- Dark/light `button` secondary contrast vs DESIGN primary pairs (`#FFFFFF` on `#4D9FFF` / `#006FFF`) — keep DESIGN tokens as-is until Story 1.7 a11y floor

## Deferred from: code review of 1-3-app-shell-chrome-sidebar-skip-link.md (2026-07-16)

- Viewport gate vs browser zoom — CSS `&lt;1280×720` gate also locks the shell at 150–200% zoom on common laptop widths; MVP keeps the fixed desktop contract; evaluate 200% zoom + gate under Story 1.7 a11y floor
- Fixed `#banner-stack` has no reserved height/offset for main — when Story 1.7 fills banners, content will be obscured unless offset is added then
- UserMenu lacks full APG menu keyboard pattern (roving tabindex, focus move into menu, Tab trap) — carried from Story 1.2; address with Story 1.7 a11y floor or auth menu work in 1.4
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
