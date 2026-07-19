# Validation Report — Divan HRIS (shell redesign)

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md`
- **Run at:** 2026-07-19T22:56+03:30
- **Lenses:** Rubric walker · Edge-case hunter (**Accessibility skipped** per user)

## Overall verdict

The shell redesign delta (collapsible sidebar, section tabs, governed tables/trees, personnel/events split, access person-first) is **directionally strong and mostly committed in memlog**, but this draft pair is **not yet a clean standalone contract** for architecture/story-dev. Consumers must still chase `ux-divan-2026-07-13` for retained journeys and several states, while three key mocks on disk were initially orphaned from the spines and UJ-2’s id collided with the PRD correction journey.

Edge-case review adds **implementation-blocking branches**: dirty quick-edit leave paths, toxic self-approval on the new access UI, and inbound event prefill over a dirty form. Rubric + edge combined: treat as **Update required before `status: final` / correct-course epic freeze**.

## Category verdicts

- Flow coverage — **thin**
- Token completeness — **adequate**
- Component coverage — **thin**
- State coverage — **thin**
- Visual reference coverage — **broken** (pre-fix inventory; mocks exist)
- Bloat & overspecification — **strong**
- Inheritance discipline — **thin**
- Shape fit — **adequate**

## Findings by severity

### Critical

**[Rubric — Flow]** PRD UJ-2 (correction) not extractable; slot reused for access admin (`EXPERIENCE.md` Key Flows).  
**Fix:** Restore correction as `UJ-2`; name access `UJ-Access` (or similar) with failure path.

**[Rubric — Flow]** UJ-3 / UJ-4 / UJ-5 are non-extractable “retained” stubs.  
**Fix:** Inline prior flows or deep-link exact anchors + shell deltas only.

**[Rubric — Component]** `quick-edit-modal` (DESIGN) vs `personnel-quick-edit-modal` (EXPERIENCE) name split.  
**Fix:** One canonical id + alias.

**[Rubric — Visual]** Three `mockups/*.html` orphans; Mock coverage table outdated; IA path points at `.working/` not `wireframes/`.  
**Fix:** Link mocks inline; point IA to `wireframes/ia-2026-07-19.excalidraw`.

**[Rubric — Inheritance]** Soft inherit of states/flows without anchors + hard UJ-2 override = unsafe for AI story-dev.  
**Fix:** Inheritance map `retained → path#heading`; list overrides explicitly.

**[Edge]** Dirty quick-edit leave paths unguarded (Esc, profile link, ثبت رویداد, nav).  
**Fix:** Unsaved guard on modal; block navigate until Stay · Discard · Save.

**[Edge]** Toxic self-approval / same-grant fail-closed absent on person-first access UI.  
**Fix:** Block save with Persian reason; audit attempt; same rule from people or نقش‌ها.

### High

**[Rubric]** Access UJ missing failure path · Contrast targets only “inherit prior” · `import-preview-table` / `sidebar-nav` join gaps · Tree empty/cold-load missing · Tab-specific empties thin · فرهنگ داده deep-link deny · Prior mock refs unspecific.

**[Edge]** Prefill ثبت رویداد overwrites dirty event form · Unsaved guard not covering sidebar/palette · Clear-filters vs default همکار فعلی semantics · Create grade with no ladder parent · Deactivate-with-children not restated for trees.

### Medium / Low

See `review-rubric.md` and `review-edge-cases.md` for full lists (pagination reset, enum empty multi-select, dual-import mutex, tree expand persistence, banner×collapse, break-glass lifecycle, role matrix for new nav, Sheet+dialog, form max-width classification, Enter on row, URL filters, collapse keyboard).

## Counts

| Source | Critical | High | Medium | Low |
|---|---|---|---|---|
| Rubric | 6 | 8 | 10 | 7 |
| Edge-case | 2 | 5 | 10 | 3 |
| **Combined unique themes** | ~8 | ~12 | ~18 | ~10 |

Accessibility lens: **not run**.

## Reviewer files

- `review-rubric.md`
- `review-edge-cases.md`

## Post-review patch

Critical/high themes rolled into `DESIGN.md` + `EXPERIENCE.md` in the same session (mock links, UJ ids, component names, edge guards, contrast, inheritance map). Status remains `draft`.

## Recommended next

1. Optional: re-run rubric Pass 1 only to confirm extractability.  
2. Set `status: final` when satisfied.  
3. `bmad-correct-course` for remediation / next epic from this UX.
