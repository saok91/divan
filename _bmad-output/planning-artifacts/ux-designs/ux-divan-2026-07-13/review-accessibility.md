# Accessibility Review — Divan HRIS

## Overall verdict

The spines establish a credible **WCAG 2.2 AA intent** for a Persian RTL desktop HRIS with keyboard paths and non-color-only status labels. For a regulated internal product, gaps remain in **dark-mode contrast evidence**, **Jalali control specification**, **focus/announcement contracts**, and **200% zoom behavior** — all fixable before AR-NFR gate without restructuring IA.

## Findings

- **critical** **Gold accent CTA contrast in dark mode unverified.** `{colors.accent-dark}` `#FBC470` on `{colors.accent-foreground-dark}` `#1A1208` likely passes, but `{colors.accent}` `#FDB913` on dark **content** cards (if misapplied outside chrome) may fail AA for 14px button text. (DESIGN.md Colors, Components button-primary). *Fix:* Restrict gold CTA to tested pairs; document minimum contrast ratio target and forbidden placements in dark content.

- **high** **Jalali date picker accessibility unspecified beyond one line.** FR-44 load-bearing; no keyboard calendar navigation, grid semantics, or screen-reader pattern for Persian month/day names. (EXPERIENCE.md Interaction Primitives, Accessibility Floor). *Fix:* Add picker behavioral spec: roving tabindex in grid, `aria-selected`, announce «۱۴۰۴/۰۴/۰۱» formatted string, link errors via `aria-describedby`.

- **high** **Stale banner alert semantics incomplete.** `role="alert"` noted but not whether blocking banner traps focus or prevents interaction with stale metrics only vs whole app. (EXPERIENCE.md State Patterns, Accessibility Floor). *Fix:* Specify: banner `role="alert"` + `aria-live="assertive"` when blocking; affected surfaces `aria-disabled` or remove values from accessibility tree when stale.

- **high** **Data table keyboard model underspecified for wide sticky-column tables.** «Row focus + Enter» stated but not column header sort, horizontal scroll announcement, or sticky identifier column reading order in RTL. (EXPERIENCE.md Accessibility Floor, Component Patterns Personnel data table). *Fix:* Document RTL reading order: identifier column first; `aria-sort` on headers; scroll container `tabindex=0` with visible focus.

- **medium** **Timeline status dots plus badges — dual encoding risk.** DESIGN `event-timeline-row` uses color dot; EXPERIENCE requires text labels. Screen readers may read both redundantly or miss dot if decorative. (DESIGN.md Components, EXPERIENCE.md Accessibility Floor). *Fix:* Mark dot `aria-hidden="true"`; badge text is sole status announcement.

- **medium** **Command palette (`Ctrl+K`) — no aria-live for async search results.** Enumeration-safe delays may affect timing; no spec for loading/empty announcements. (EXPERIENCE.md Component Patterns Command palette). *Fix:* `aria-busy` during search; polite live region for result count «۳ نتیجه».

- **medium** **Theme toggle mid-session — no focus preservation or flash spec.** Instant switch required; missing `prefers-color-scheme` respect vs user override and focus ring visibility on `{colors.chrome}` nav in both modes. (EXPERIENCE.md Component Patterns Theme toggle, DESIGN.md Colors). *Fix:* On toggle, preserve focus; verify focus ring contrast on navy chrome (white ring may need 2px offset).

- **medium** **200% zoom / text scaling not addressed.** Desktop MVP 1280×720 minimum but no rule for 200% browser zoom or OS large text — wide tables may clip actions. (EXPERIENCE.md Responsive & Platform). *Fix:* Add Accessibility Floor row: at 200% zoom, primary actions remain reachable without horizontal page scroll; table scroll is container-local only.

- **medium** **Sensitive fields and accessibility tree.** Profile omits out-of-scope fields — good — but no guidance whether omitted vs masked fields differ in DOM (hidden vs `aria-hidden` vs not rendered). Prevents accidental exposure via inspect/a11y tree. (EXPERIENCE.md Person profile section). *Fix:* State «fields not permitted are not rendered» — exclude from DOM, not merely visually hidden.

- **low** **Motion reduction** marked `[ASSUMPTION]`. (EXPERIENCE.md Accessibility Floor). *Fix:* Promote to committed rule: disable skeleton shimmer and toast slide when `prefers-reduced-motion: reduce`.

- **low** **Skip link / landmark structure** not specified for repetitive chrome. (EXPERIENCE.md App shell). *Fix:* Add «پرش به محتوا» skip link as Accessibility Floor item — standard for enterprise apps.

## Summary

| Severity | Count |
|---|---|
| critical | 1 |
| high | 3 |
| medium | 5 |
| low | 2 |
