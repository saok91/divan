# Edge Case Review — Divan HRIS

## Overall verdict

Core temporal and permission journeys (UJ-1–3) handle primary failure paths well. Unhandled branches concentrate on **session/auth drift**, **banner stacking**, **theme/form persistence**, **report suppression UX**, and **numeric formatting boundaries** — typical for a first UX spine pass on a governed HRIS.

## Findings

- **high** **Role or scope change mid-session.** FR-47 requires reauth before next protected action; EXPERIENCE mentions queued work fails closed but not UI when user holds an open event form Draft. (EXPERIENCE.md State Patterns — missing). *Fix:* Add state: scope revocation → modal «دسترسی شما تغییر کرد» → save draft if permitted or discard with audit; block finalize.

- **high** **Stale/recalc banner + break-glass banner collision.** UJ-5 break-glass time-bound banner and FR-45 stale banner both global — stacking order and priority undefined. (EXPERIENCE.md UJ-5, Stale/recalc banner). *Fix:* Stack below header; stale blocking takes precedence; break-glass secondary strip with distinct semantic color (not amber).

- **high** **Export or finalize during recalc.** State «Recalc in progress» skeletons metrics but Sensitive confirmation dialog path not explicitly blocked. (EXPERIENCE.md State Patterns Recalc vs Sensitive confirmation). *Fix:* Disable gold CTAs on finalize/export/report while recalc in progress on affected entities.

- **medium** **Theme toggle mid-form (unsaved changes).** Theme switch instant with no mention of preserving draft field values or triggering unsaved guard. (EXPERIENCE.md Theme toggle, Unsaved form). *Fix:* Theme change does not navigate — no guard needed; document explicitly.

- **medium** **Command palette partial national ID / enumeration timing.** AR-ACCESS pending; empty vs delayed empty indistinguishable in UX spec. (EXPERIENCE.md Command palette ASSUMPTION). *Fix:* Add edge state: uniform response timing + identical empty copy for out-of-scope vs not-found unless AR-ACCESS forbids.

- **medium** **Scheduled vs Effective on same calendar day for multiple events.** Timeline ordering tie-breaker UI not specified (AR-TEMPORAL domain). (EXPERIENCE.md Personnel event timeline). *Fix:* Timeline sort rule in Component Patterns: Effective Date desc, then registration time, then type — display secondary `{caption}` sort key when same day.

- **medium** **Inference suppression empty cell vs zero.** UJ-3 failure mentions suppression message but not dashboard cards vs table cells consistency. (EXPERIENCE.md UJ-3, State Patterns gap). *Fix:* Unified «داده قابل نمایش نیست» pattern; never show 0 when suppressed.

- **medium** **Import preview navigate away.** Unsaved import file selection / preview state when user switches sidebar nav. (EXPERIENCE.md Import preview — missing). *Fix:* Warn if preview loaded and execute not completed; batch id in warning copy.

- **medium** **Concurrent import batch UI.** FR-37 concurrent batches — no UX for «another batch in progress» when second user executes. (EXPERIENCE.md UJ-4 failure partial). *Fix:* Add blocking state with batch owner and correlation id.

- **medium** **Persian digits in Personnel Code search.** User types Latin digits in palette — normalization rule unstated. (EXPERIENCE.md Number formatting). *Fix:* Search input accepts both; normalizes for matching; display always Persian.

- **medium** **Financial thousand separator with negative/compensation change.** Only positive example given; deduction display unstated. (EXPERIENCE.md Number formatting). *Fix:* Negative amounts: «−۱۲٬۳۴۵٬۶۷۸» with Persian minus or parentheses per finance owner.

- **low** **RTL sticky column + horizontal scroll at 1280×720.** Minimum viewport enables scroll but keyboard focus order into scrolled-hidden columns unstated. (DESIGN.md Layout wide tables). *Fix:* Cross-ref accessibility table keyboard model.

- **low** **Empty global search with `/` in text field focus.** `/` opens palette but behavior when already in input not specified. (EXPERIENCE.md Interaction Primitives). *Fix:* `/` focuses palette only from non-input context; in inputs, literal slash.

- **low** **Dark mode status badges on dark card backgrounds.** Light-tint badges (`#E7F5FF`) may glare on dark content. (DESIGN.md status-badge tokens). *Fix:* Dark variants per rubric finding.

## Summary

| Severity | Count |
|---|---|
| high | 3 |
| medium | 8 |
| low | 3 |
