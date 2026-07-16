## Deferred from: code review of 1-2-brand-tokens-typography-theme-toggle.md (2026-07-16)

- Dark/light `button` secondary contrast vs DESIGN primary pairs (`#FFFFFF` on `#4D9FFF` / `#006FFF`) — keep DESIGN tokens as-is until Story 1.7 a11y floor

## Deferred from: code review of 1-3-app-shell-chrome-sidebar-skip-link.md (2026-07-16)

- Viewport gate vs browser zoom — CSS `&lt;1280×720` gate also locks the shell at 150–200% zoom on common laptop widths; MVP keeps the fixed desktop contract; evaluate 200% zoom + gate under Story 1.7 a11y floor
- Fixed `#banner-stack` has no reserved height/offset for main — when Story 1.7 fills banners, content will be obscured unless offset is added then
- UserMenu lacks full APG menu keyboard pattern (roving tabindex, focus move into menu, Tab trap) — carried from Story 1.2; address with Story 1.7 a11y floor or auth menu work in 1.4
- Sidebar active state uses exact `pathname === "/"` for dashboard — nested role landings (1.5) will need a prefix/segment strategy
