# Validation Report — Divan HRIS

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md`
- **Run at:** 2026-07-15T04:55+03:30

## Overall verdict

The Divan UX spine pair is **ready for downstream architecture and epic breakdown** with strong journey coverage (UJ-1–UJ-5), correct document shape, and actionable IA. Validation found **1 critical**, **8 high**, **19 medium**, and **10 low** findings — clustered in dark-mode semantic tokens, Jalali picker / export component gaps, accessibility contracts, and session-edge UI branches. None require IA rework; a focused **Update pass** on spines before feature baselines for login, reporting, and import is recommended.

Accessibility and edge-case reviews reinforce the same themes: verify gold-CTA contrast in dark mode, specify Jalali picker and table keyboard models, and add states for scope revocation, banner stacking, and recalc blocking.

## Category verdicts

- Flow coverage — **strong**
- Token completeness — **adequate**
- Component coverage — **adequate**
- State coverage — **adequate**
- Visual reference coverage — **adequate**
- Bloat & overspecification — **strong**
- Inheritance discipline — **adequate**
- Shape fit — **strong**

## Findings by severity

### Critical (1)

**[Accessibility]** — Gold accent CTA contrast in dark mode unverified (DESIGN.md Colors, button-primary). Unverified contrast on dark content if gold CTA misapplied.  
**Fix:** Restrict gold CTA to tested light/dark pairs; document forbidden placements.

### High (8)

**[Rubric — Token]** — Status badge tokens lack dark-mode pairs (DESIGN.md YAML).  
**Fix:** Add `-dark` variants for scheduled/effective/cancelled/reversed/draft.

**[Rubric — Token]** — `stale-banner` light-only tokens (DESIGN.md YAML).  
**Fix:** Add dark pair for stale banner on dark content canvas.

**[Rubric — Component]** — Jalali date picker missing from both spines (FR-44).  
**Fix:** Add `jalali-date-picker` visual + behavioral rows.

**[Accessibility]** — Jalali date picker a11y unspecified (EXPERIENCE.md).  
**Fix:** Keyboard grid, aria-selected, describedby errors.

**[Accessibility]** — Stale banner alert semantics incomplete (EXPERIENCE.md).  
**Fix:** assertive live region; disable stale values in a11y tree when blocking.

**[Accessibility]** — Data table keyboard model underspecified for RTL sticky columns (EXPERIENCE.md).  
**Fix:** aria-sort, scroll container focus, identifier-first reading order.

**[Edge case]** — Role/scope change mid-session with open Draft form (EXPERIENCE.md).  
**Fix:** Modal + draft save/discard rules on scope revocation.

**[Edge case]** — Stale banner + break-glass banner stacking undefined (EXPERIENCE.md).  
**Fix:** Priority/stack order below header.

**[Edge case]** — Finalize/export during recalc not explicitly blocked (EXPERIENCE.md).  
**Fix:** Disable gold CTAs while recalc in progress.

### Medium (19)

**[Rubric]** Reversed/Draft/Override status tokens missing (DESIGN.md).  
**[Rubric]** sidebar-active-item hardcoded rgba (DESIGN.md).  
**[Rubric]** Personnel event form visual composition missing (DESIGN.md).  
**[Rubric]** Sensitive confirmation dialog visual row missing (DESIGN.md).  
**[Rubric]** Export retrieval component missing (both spines).  
**[Rubric]** Report suppression state missing from State Patterns (EXPERIENCE.md).  
**[Rubric]** Audit/entitlements/correction-case surface states thin (EXPERIENCE.md).  
**[Rubric]** Font imports folder not linked (DESIGN.md Typography).  
**[Rubric]** Component naming Title Case vs kebab-case drift (EXPERIENCE.md).  
**[Accessibility]** Timeline dot + badge redundancy (both spines).  
**[Accessibility]** Command palette aria-live for async results (EXPERIENCE.md).  
**[Accessibility]** Theme toggle focus preservation on chrome (EXPERIENCE.md).  
**[Accessibility]** 200% zoom behavior unspecified (EXPERIENCE.md).  
**[Accessibility]** Sensitive fields DOM exclusion rule (EXPERIENCE.md).  
**[Edge case]** Enumeration-safe search timing/copy (EXPERIENCE.md).  
**[Edge case]** Same-day timeline sort tie-breaker (EXPERIENCE.md).  
**[Edge case]** Suppression vs zero on dashboard (EXPERIENCE.md).  
**[Edge case]** Import preview navigate-away warning (EXPERIENCE.md).  
**[Edge case]** Concurrent import batch blocking UI (EXPERIENCE.md).  
**[Edge case]** Latin→Persian digit normalization in search (EXPERIENCE.md).  
**[Edge case]** Negative financial formatting (EXPERIENCE.md).

### Low (10)

**[Rubric]** Login flow not named in Key Flows.  
**[Rubric]** Empty profile timeline state.  
**[Rubric]** Contrast ratios not recorded.  
**[Rubric]** Mock coverage table overlap.  
**[Rubric]** OQ-4 export digit note.  
**[Accessibility]** prefers-reduced-motion assumption.  
**[Accessibility]** Skip link missing.  
**[Edge case]** `/` shortcut when focus in input.  
**[Edge case]** Dark status badge glare.  
**[Edge case]** RTL scroll focus cross-ref.

## Reviewer files

- `review-rubric.md`
- `review-accessibility.md`
- `review-edge-cases.md`

## Recommended next step

Run **bmad-ux Update** to roll high/critical findings into spines, then proceed to **bmad-architecture**.
