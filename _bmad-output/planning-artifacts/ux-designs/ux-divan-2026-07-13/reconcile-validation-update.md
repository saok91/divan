# Source Reconciliation — PRD trio (update pass)

**Workspace:** `ux-divan-2026-07-13`  
**Update:** 2026-07-15 — rolls validation-report critical/high/medium findings into spines.

## Rolled in from validation

| Finding | DESIGN.md | EXPERIENCE.md |
|---|---|---|
| Gold CTA dark-mode contract | Colors `button-primary` contract | sensitive-confirmation-dialog, theme-toggle |
| Status badge dark pairs | YAML + Components | status-badge |
| stale-banner dark + break-glass-banner | YAML + Components | stale-recalc-banner, break-glass-banner, app-shell stack |
| Jalali date picker | jalali-date-picker component | jalali-date-picker pattern + a11y |
| Export artifact panel | export-artifact-panel | export-artifact-panel pattern |
| personnel-event-form / sensitive-confirmation-dialog visual | YAML composition rows | personnel-event-form pattern |
| sidebar-active tokenized | sidebar-active-background | app-shell |
| Font imports linked | Typography path | — |
| kebab-case component names | — | all Component Patterns |
| Scope revocation mid-session | — | State Patterns |
| Recalc blocks gold CTAs | — | State Patterns, stale-recalc-banner |
| Table RTL keyboard | — | personnel-data-table |
| Suppression vs zero | — | dashboard-metric-card, State Patterns |
| Import navigate-away / concurrent batch | — | import-preview-table, State Patterns |
| Search digit normalization | — | command-palette, Number formatting |
| DOM exclusion for sensitive fields | — | person-profile-section, a11y |
| 200% zoom, skip link, reduced motion | — | Accessibility Floor |
| Timeline sort tie-breaker, dot aria-hidden | event-timeline-row | personnel-event-timeline |

## Still open (unchanged)

- OQ-1–OQ-5 in EXPERIENCE.md Open Questions
- AR-ACCESS exact enumeration copy
- Login Key Flow (low priority — LDAP delegated)
- research-hris-practices.md not extracted

## Dropped qualitative ideas

None from validation — all high-value fixes incorporated.
