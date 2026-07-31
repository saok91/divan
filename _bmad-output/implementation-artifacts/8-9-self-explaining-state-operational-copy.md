---
baseline_commit: 0d23b6c
---

# Story 8.9: Self-Explaining State & Operational Copy Overhaul

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator facing a blocked or unusual state,
I want the system to tell me what happened and what to do,
so that I do not have to guess what a message means (UX-DR32, UX-DR37, FR58, FR59).

**Story key:** `8-9-self-explaining-state-operational-copy`  
**Epic:** 8 — Experience Foundation & Identifier Ergonomics (FR58 foundation for FR59; UX-DR24 / UX-DR32 / UX-DR37)  
**UX contract (forward):** `ux-divan-2026-07-31` (EXPERIENCE.md State Patterns + Voice; DESIGN.md page-header purpose + disclosures)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (finding **E3** — timestamp-as-deadline banner + unexplained states)  
**Prerequisite:** Story 8.1 gap list (deferred copy); Story 8.2 `PageHeader` purpose slot; Story 8.7 `disabledReason` contract; Story 8.8 feedback **channels** (`BannerStack` / `FeedbackMessage` / toast precedence) — **consume, do not reopen**. Do **not** own mockup QA gate (**8.10**), Epic 9 IA / bulk entry / «اصلاح اطلاعات» rename+contextual entry (**9.8**), or settings (**Epic 10**).

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| `operationalCopy` + `staleRecalcMessage` | `apps/web/lib/operational-copy.ts` | Central Persian catalog; banner still `داده به‌روز نیست — تا {time} محاسبه نشده.` | Rewrite recalc + empty taxonomy + pending figure copy; keep UX-DR24 voice |
| `StaleRecalcBanner` | `components/stale-recalc-banner.tsx` | `role="alert"` / `aria-live="assertive"`; uses `stalePendingUntil` | New fact+scope+consequence+expectation copy + «توضیح بیشتر» disclosure; **stop** rendering timestamp as deadline |
| `BannerStack` | `components/banner-stack.tsx` | Order: stale → break-glass; height CSS var | Keep channel/order; allow taller banner when disclosure open |
| `PlatformStatus` / `getPlatformRecalcSignal` | `platform-status-provider.tsx`, `src/server/platform-status.ts`, `personnel-event-recalc.ts` | `recalculationPending`, `blockingStale`, `stalePendingUntil` from `MAX(updated_at)` | Add **affected person count N** for banner; stop requiring `stalePendingUntil` for user-facing deadline copy (field may remain for ops/debug only) |
| `PageHeader` `purpose` | `components/page-header.tsx`, `surface-section-tabs-layout.tsx` | Slot exists; most surfaces already pass a purpose string | Audit/rewrite all purposes to one-line who+what; ensure **every** navigable surface has one |
| `Button` / `RowActionButton` `disabledReason` | `ui/button.tsx`, `ui/row-action-button.tsx` | Visual + AT exposure when provided; row actions **require** reason | Finish remaining busy/submit disables from 8.1 gap list |
| `FeedbackMessage` + `FEEDBACK.md` | `ui/feedback-message.tsx`, `feedback/FEEDBACK.md` | Inline empty/error/info kinds; channel precedence | Route empty taxonomy through FeedbackMessage / GDT; **do not** toast staleness |
| `GovernedDataTable` empty | `governed-data-table.tsx` | Defaults to `emptySearch` + clear-filters CTA | Distinguish no-data-yet / filtered / not-permitted (additive API) |
| `AccessDenied` | `components/access-denied.tsx` | Route-level not-permitted | Pattern source for surface-level not-permitted empty — do not invent a second deny voice |
| `TechnicalDetailDisclosure` | `entity-picker/technical-detail-disclosure.tsx` | Native `<details>` «شناسهٔ فنی» | **Pattern only** — domain glossary is separate (never mix UUID disclosure with term definitions) |
| Spec glossary | `_bmad-output/specs/spec-divan/glossary.md` | Agent/domain terms (EN) | Source for **which** terms need Persian UI glossary entries — not a UI component |
| Gallery | `app/(app)/dev/gallery/page.tsx` | Feedback / skeleton / row-action demos | Add banner disclosure + empty taxonomy + glossary term demos |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Deadline timestamp (banned)** | Presenting `MAX(updated_at)` / `stalePendingUntil` as «تا HH:MM» as if the user must wait until that clock time. **Forbidden anywhere in UI.** |
| **As-of / last-run metadata (allowed)** | Report/dashboard «آخرین محاسبه» / run as-of when it means **when the figure was produced**, not a blocking deadline. Keep factual; do not reuse recalc-banner deadline phrasing. |
| **Empty — no data yet** | Surface has zero records under current scope with **no active filter that emptied it**. Copy: what the surface holds + why empty + primary action that fills it. |
| **Empty — filtered to nothing** | Filters/search active → zero rows. Exact EXPERIENCE: «نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.» + «پاک کردن فیلترها»; keep filter chrome visible. |
| **Empty — not permitted** | Caller lacks permission. State required access + who grants it — **never** a blank table or tease of forbidden actions. Reuse `accessDenied*` voice family. |
| **Purpose line** | One sentence under the title: what the surface is for and who uses it. Not a second H1; not marketing. |
| **Glossary / help disclosure** | Short Persian definition of a **domain term** reachable from where the term appears. Prefer native `<details>` / compact disclosure. Distinct from technical UUID disclosure. |
| **«توضیح بیشتر»** | Optional disclosure on blocking system messages (recalc banner model). Summary label is the Persian exact string from AC/mockup. |
| **Affected row / muted figure** | In-place mark when subject is pending/stale; figures use muted styling + «در حال محاسبه — عدد ممکن است تغییر کند.» |
| **Presentation-only** | No authz/domain/governance/event-store semantic changes. Read-only aggregate enrichment for N is OK. |

## Acceptance Criteria

1. **Given** the recalculation banner that currently renders an internal timestamp  
   **When** the copy overhaul is complete  
   **Then** it states scope, consequence, and expectation in the form «محاسبهٔ وضعیت جاری برای N فرد هنوز کامل نشده — نهایی‌سازی رویداد و خروجی گرفتن برای این افراد موقتاً غیرفعال است. معمولاً چند دقیقه طول می‌کشد.» with a «توضیح بیشتر» disclosure

2. **And** no internal timestamp is presented as a deadline anywhere in the UI

3. **And** affected rows are marked in place and affected figures render muted with «در حال محاسبه — عدد ممکن است تغییر کند.»

4. **And** every surface carries a one-line purpose statement under its title

5. **And** empty states distinguish no-data-yet, filtered-to-nothing, and not-permitted, each with its own copy and next step

6. **And** every disabled control states its Persian reason, exposed both visually and to assistive technology

7. **And** domain terms encountered in the UI have glossary entries reachable from where they appear

8. **And** the direct-operational voice from UX-DR24 is preserved — fact, then consequence, then next step, with no ceremonial success copy

9. **And** scope stays **presentation / interaction only**:
   - No domain / permission / governance / event-store rule changes
   - Additive APIs preferred (`GovernedDataTable` empty kind; platform signal fields)
   - AR-\* fail-closed; do not invent freeze numbers
   - Prior Epic 8 selfchecks stay green; add `selfcheck:operational-copy` (or equivalent)
   - Do **not** own: EntityPicker identity rules (**8.3–8.5**); table density/min-width (**8.6**); row-action icons/leave-guard algorithm (**8.7**); feedback channel invent (**8.8**); mockup QA (**8.10**); Epic 9–10 IA
   - Do **not** break EntityPicker empty/out-of-scope indistinguishability (8.3 security contract)

## Tasks / Subtasks

- [x] Task 1: Recalc banner copy + signal (AC: #1, #2, #8)
  - [x] Extend `PlatformRecalcSignal` / `getPlatformRecalcSignal` with **affected person count** `N` = distinct persons in `recalculation_status` with status in (`pending`, `failed`, `stale`). Prefer counting persons already tracked by recalc table — no new HR field leakage. Reuse count logic from `getOpsRecalcAggregate` where possible (ops-safe: no personId in UI payload except aggregate N).
  - [x] Thread `affectedPersonCount` through `platformStatus.recalc` tRPC → `PlatformStatusProvider` → `StaleRecalcBanner`.
  - [x] Replace `staleRecalcMessage(pendingUntilLabel)` with a builder that takes `N` (Persian digits via `toPersianDigits`) matching the AC sentence form. Handle N=0/1 plural carefully in Persian (prefer always «N فرد» with digits).
  - [x] Add «توضیح بیشتر» as native `<details>`/`<summary>` inside the banner (mockup copy from Direction A): explain that after personnel events current state recomputes; marked rows stay read-only / excluded from Excel until done; if >15 minutes, check Ops recalc queue. Do **not** put a clock deadline in the disclosure.
  - [x] Stop using `stalePendingUntil` in any user-visible string. Keep gold-CTA blocking behavior (`isGoldCtaBlocked`) unchanged.
  - [x] Grep UI for deadline-pattern copy (`تا ${`, `محاسبه نشده`, `stalePendingUntil` rendered) and eliminate.

- [x] Task 2: Affected rows + muted figures (AC: #3, #8)
  - [x] Add `operationalCopy.figureRecalculating` = exact «در حال محاسبه — عدد ممکن است تغییر کند.»
  - [x] Dashboard / report pending figures: mute text (`text-text-tertiary` or DESIGN muted) + that string (replace `dashboardPending` / `reportPending` user-facing pending figure copy **or** alias them to the exact string).
  - [x] Affected **rows**: when a list/profile row’s person is pending/stale, show an in-place mark (badge/row tint + accessible text). Permission-safe approach: only for person IDs **already** returned by an authorized query — join/flag against `recalculation_status` for that set (no unscoped pending-person listing). Minimum proof set: personnel list **or** personnel-events list **plus** person profile header when that person is pending.
  - [x] If full list join is too heavy for this story, prove profile + event-form subject chrome + document deferred list marking for 8.10 — but prefer shipping list mark on at least one governed table.

- [x] Task 3: Purpose lines on every surface (AC: #4, #8)
  - [x] Inventory every navigable `(app)` surface using `PageHeader` / `SurfaceSectionTabsLayout` and ensure a non-empty purpose.
  - [x] Rewrite purposes to UX-DR32/37 voice: one line, who + what, no ceremonial filler. Improve weak ones (e.g. correction-cases can say it handles external data-subject correction requests — full «اصلاح اطلاعات» **nav rename** stays **9.8**).
  - [x] Surfaces that only inherit parent layout purpose are OK if the parent purpose covers the section; tab pages must not render blank purpose under a distinct title without inheritance.

- [x] Task 4: Empty-state taxonomy (AC: #5, #8)
  - [x] Add a small primitive **or** typed helper, e.g. `EmptyState` / `emptyStateCopy(kind)` with kinds: `noDataYet` | `filtered` | `notPermitted`, each returning title/body/next-step CTA props. Prefer `FeedbackMessage kind="empty"` for rendering.
  - [x] Wire `GovernedDataTable` additive API: e.g. `emptyKind` + optional `emptyMessage` / `emptyAction` — default behavior stays filtered-style when filters active; when no filters and zero rows → no-data-yet; when authz denies the surface → not-permitted (**do not** show table chrome teasing data).
  - [x] Migrate high-traffic empties: personnel list, correction-cases, audit filter empty (keep `auditEmptyFilter` distinct where already specialized), org/job-ref empties, dashboard/report scope empties.
  - [x] **Do not** change EntityPicker `EMPTY_COPY_FA` indistinguishability.

- [x] Task 5: Disabled reasons completion (AC: #6)
  - [x] Close 8.1 gap-list remainder: busy submits, import wizard / recon / correction / headcount pending disables, GDT pagination prev/next, access assign/link/grant pending, org create/edit submits.
  - [x] Prefer shared pending reason from `operationalCopy.actionPending` (or equivalent) rather than inventing many near-duplicates.
  - [x] Selfcheck: AST/filesystem scan that `disabled={true}` / `disabled` without nearby `disabledReason` / `disabledReasonFa` is flagged for Button/RowActionButton call sites under `apps/web/components` (allowlist documented exceptions only if unavoidable — prefer zero).

- [x] Task 6: Glossary / help disclosures (AC: #7, #8)
  - [x] Add `apps/web/lib/ui-glossary.ts` (or under `components/glossary/`) mapping term keys → `{ termFa, definitionFa }` for terms operators actually see (start from SPEC glossary + UI labels): e.g. رویداد پرسنلی، پیش‌نویس، نهایی‌سازی، هدکانت، رزرو، شکست شیشه، محدودهٔ سازمانی، وضعیت جاری — keep list lean (≈8–15), not a dictionary dump.
  - [x] Add `GlossaryTerm` disclosure component (native `<details>` preferred): shows the term inline; expands definition in place. Reuse styling kinship with `TechnicalDetailDisclosure` but **different** summary label (term name / «تعریف»، never «شناسهٔ فنی»).
  - [x] Place disclosures where terms first appear in chrome: purpose lines, column headers, or form section labels for the proof set (personnel events, headcount, access break-glass). Full-repo every-occurrence wrapping is **not** required if gallery + 2–3 surfaces prove the pattern; list deferred placements in Completion Notes for 8.10/9.8.

- [x] Task 7: Gallery + selfcheck (AC: #1–#8, #9)
  - [x] Gallery: stale banner with disclosure (can use provider setters), three empty kinds, glossary term, muted figure string, disabled-with-reason sample.
  - [x] Add `selfcheck:operational-copy` asserting at least: `staleRecalcMessage` no longer embeds deadline-time pattern; banner file contains «توضیح بیشتر»; `figureRecalculating` exact string present; empty-kind helper/export exists; glossary module exists; prior selfchecks still wired.
  - [x] Keep green: `selfcheck:feedback`, `selfcheck:control-contract`, `selfcheck:row-actions`, `selfcheck:governed-table`, `selfcheck:layout-system`, `selfcheck:leave-guard`.

- [x] Task 8: Verify + document (AC: #2, #8, #9)
  - [x] Manual: force recalc pending → banner shows N + disclosure; no HH:MM deadline; gold finalize/export still blocked with Persian reason.
  - [x] Manual: empty filtered vs no-data vs deny on one list surface.
  - [x] Manual: keyboard focus on disabled control announces/exposes reason; glossary disclosure keyboard operable.
  - [x] Manual: light/dark banner + muted figure readable (AA awareness — full gate is 8.10).
  - [x] Typecheck + listed selfchecks green.
  - [x] Completion Notes: N-count source, list-row mark decision, glossary term set, deferred placements, any as-of metadata left intentionally.

## Dev Notes

### Gate (non-negotiable)

- **UX-DR32 / UX-DR24 / UX-DR37 / FR-58 / FR-59 (foundation):** Self-explaining state; direct-operational voice; purpose lines; glossary reachability. Full FR-59 nav completeness is Epic 9 — this story lays the **copy/state substrate**.
- **E3 fix:** Never present internal recalc timestamps as deadlines.
- **Epic 8 presentation-only:** no authz, domain, or governance rule changes. Aggregate N for banner is read-only status enrichment.
- **Consume 8.7 / 8.8:** keep `disabledReason` mechanics and feedback **channels**; only change **copy** and empty taxonomy.
- **Forward UX** is `ux-divan-2026-07-31`; spines win on conflict with mocks. Direction A mockups are visual reference for **8.10**.
- **AR-\* fail-closed:** do not invent freeze numbers; do not weaken suppressed-cohort / access-denied honesty.

### Recalc banner algorithm (implement literally)

```text
on platform recalc signal:
  N = count(distinct person_id in recalculation_status
            where status in ('pending','failed','stale'))
  if recalculationPending OR blockingStale:
    show BannerStack stale channel with:
      primary = «محاسبهٔ وضعیت جاری برای {N} فرد هنوز کامل نشده — نهایی‌سازی رویداد و خروجی گرفتن برای این افراد موقتاً غیرفعال است. معمولاً چند دقیقه طول می‌کشد.»
      disclosure summary = «توضیح بیشتر»
      disclosure body = mockup-aligned explanation (no clock deadline)
  never:
    render stalePendingUntil / MAX(updated_at) as «تا HH:MM» deadline
    toast the same staleness (banner owns it — FEEDBACK.md)
```

### Empty-state decision (implement literally)

```text
if surface/authz denied → notPermitted (AccessDenied voice; no data table tease)
else if active filters/search and rows.length === 0 → filtered (emptySearch + clearFilters)
else if rows.length === 0 → noDataYet (surface-specific what/why/next action)
else → render rows

loading skeleton (8.8) wins over empty — never show empty copy while loading=true
```

### UPDATE files — current state (read before edit)

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `lib/operational-copy.ts` | `staleRecalcMessage(time)`; mixed empties; `dashboardPending` / `reportPending` soft wording | Recalc builder(N); figureRecalculating; empty taxonomy keys; busy reason consolidation | Exact strings already locked by selfchecks (auditEmptyFilter, suppressedCohort, accessDeniedTitle, …) |
| `stale-recalc-banner.tsx` | Single `<p>` with timestamp message | Copy + `<details>` disclosure; consume N | `role="alert"` / `aria-live="assertive"` / `data-banner` / hide when inactive |
| `platform-status-provider.tsx` | Defaults `stalePendingUntil: "09:14"` | Expose `affectedPersonCount`; stop feeding deadline copy | Gold CTA / break-glass / authz-changed gates |
| `src/server/platform-status.ts` | Fail-closed pending+stale | Pass through count | Fail-closed on error |
| `personnel-event-recalc.ts` | Signal without count; `stalePendingUntil` from MAX(updated_at) | Add count to signal (and selfcheck) | Job enqueue/mark APIs; ops aggregate privacy (no personId to ops UI beyond existing rules) |
| `page-header.tsx` / layouts | Optional purpose | Require purposeful copy at call sites | Structure: breadcrumb → title → purpose; no primary actions in header |
| `governed-data-table.tsx` / `types.ts` | Single emptyMessage path | Additive empty kind | 8.6/8.7/8.8: density, sticky, row actions, loading skeleton |
| `dashboard-panel.tsx` / metric card / reports | Pending + lastCalculatedAt footer | Muted figure copy; audit footer so it is as-of not deadline | KeepPreviousData / cold-load rules from 8.8 review |
| `ui/button.tsx` call sites | Many busy disables without reason | Add `disabledReason` | Existing reason wrapper a11y |
| Gallery / package.json | 8.8 demos | 8.9 demos + selfcheck script | production `notFound` allowlists |

### Anti-patterns (LLM footguns)

- **Do not** reinvent a second banner stack or toast staleness.
- **Do not** use ceremonial success («عملیات با موفقیت انجام گردید! ✅»).
- **Do not** rename nav «پرونده‌های اصلاح» → «اصلاح اطلاعات» here (Story **9.8**); purpose-line clarity only.
- **Do not** merge glossary with `TechnicalDetailDisclosure` / UUID copy UX.
- **Do not** change EntityPicker empty vs out-of-scope indistinguishability.
- **Do not** expose pending `personId` lists on ops/sysadmin beyond existing ops-safe aggregates.
- **Do not** claim FR-58/FR-59/LG-6 production-complete — 8.10 gates consistency.
- **Do not** reopen leave-guard algorithm, row-action icon map, or skeleton pulse.
- **Do not** add `framer-motion` or new i18n frameworks — Persian strings stay in `operational-copy` / glossary module.

### Previous story intelligence

**From 8.8 (done, `0d23b6c`):** Feedback **channels** landed (`FeedbackMessage`, toast, `BannerStack` boundary, `FEEDBACK.md`). Explicitly deferred banner/empty/disabled **copy** + glossary to **this story**. Keep `selfcheck:feedback` green. Review patches: cold-load vs in-session pending; do not regress dashboard keepPreviousData.

**From 8.7 (`d41b1d2`):** `disabledReason` required on row actions; Button wrapper exposes AT. Finish non-row busy disables here. Leave-guard silent paths fixed — do not re-break.

**From 8.2:** `PageHeader` purpose slot comment already says «Story 8.9 owns copy».

**From 8.1 gap list:** Deferred exactly «Recalc-banner rewrite / glossary / full operational-copy / remaining disabled-without-reason» → this story. Sample remaining sites listed under gap list §Remaining.

**Open carry-ins (do not expand unless blocking):** logout leave-guard wiring; person-create form dedupe; PopulationPort honesty; AD-6 projector hardening; StatusMessage clones → FeedbackMessage (8.8 defer — migrate when touching those panels for empty taxonomy).

### Git intelligence

Recent commits: `0d23b6c` story 8.8 → `d41b1d2` story 8.7 → `56d7584` story 8.6 → `e090c55` story 8.5 → `d0b45e4` story 8.4. Baseline for this story file: **`0d23b6c`**. Expect touch set under `apps/web/lib/operational-copy.ts`, banner/platform-status, page purposes, GDT empty API, glossary primitive, gallery, `personnel-event-recalc` signal, selfcheck + `package.json`.

### Latest tech notes

- **Disclosure a11y:** Prefer native HTML `<details>`/`<summary>` for «توضیح بیشتر» and glossary — built-in keyboard and expanded state; avoid generic “Read more” without context (summary text is the Persian label itself).
- **Disabled reasons:** Continue `disabledReason` + `aria-describedby` / sr-only pattern already on `Button` (8.1/8.7); do not rely on `title` alone for AT.
- **Persian digits:** Use existing `toPersianDigits` for N and any remaining displayed numbers.
- **No new deps** for glossary/empty — match 8.8 preference (CSS + existing primitives).

### Project structure notes

- UI lives in `apps/web` only — no `@divan/ui` package.
- Copy catalog: `apps/web/lib/operational-copy.ts`; glossary map colocated or `apps/web/lib/ui-glossary.ts`.
- New primitives under `apps/web/components/ui/` or `apps/web/components/glossary/`.
- Selfcheck: `apps/web/lib/operational-copy.selfcheck.ts` + `selfcheck:operational-copy` script.
- Recalc signal enrichment: `packages/modules/person-employment/src/personnel-event-recalc.ts` (+ existing `.selfcheck.ts`).
- Story / sprint docs: `_bmad-output/implementation-artifacts/` only.
- **No `project-context.md`** in repo — Architecture Spine + UX 2026-07-31 + this story are SoT.

### Testing requirements

| Check | Command / method |
| --- | --- |
| Operational copy contract | `pnpm --filter @divan/web selfcheck:operational-copy` |
| Recalc signal | existing `personnel-event-recalc` selfcheck / package script if present — extend for count |
| Feedback / table / control / row / leave-guard / layout | prior Epic 8 selfchecks stay green |
| Types | `pnpm --filter @divan/web typecheck` |
| Manual | Banner N+disclosure; no deadline time; empty taxonomy; disabled reason AT; glossary keyboard; muted figures |

### Interactive a11y DoD (from Epic 1 carry-in)

- Banner remains assertive alert while active; disclosure summary is keyboard-reachable.
- Disabled controls expose Persian reason to AT (not hover-only).
- Glossary/help disclosures are operable with keyboard; focus not trapped incorrectly.
- Empty states are announced via existing live regions / FeedbackMessage roles — do not create conflicting dual live regions for one event.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8 / Story 8.9 L1498–1515; UX-DR24/32/37; Story 8.10 expectations]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-58 / FR-59]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — State Patterns; Voice; Feedback]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — page-header; disclosures]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/direction-a-dense-console.html` — banner + «توضیح بیشتر»]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — E3 timestamp-as-deadline]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-6 `recalculation_pending`]
- [Source: `_bmad-output/implementation-artifacts/8-1-interaction-audit-gap-list.md` — Deferred 8.9 + remaining disabled sites]
- [Source: `_bmad-output/implementation-artifacts/8-8-feedback-loading-motion-system.md` — channel boundary; deferred copy]
- [Source: `_bmad-output/implementation-artifacts/8-7-row-action-affordance-dead-click-elimination.md` — disabledReason]
- [Source: `_bmad-output/implementation-artifacts/8-2-visual-design-language-layout-system.md` — purpose slot]
- [Source: `apps/web/lib/operational-copy.ts`]
- [Source: `apps/web/components/stale-recalc-banner.tsx`]
- [Source: `packages/modules/person-employment/src/personnel-event-recalc.ts` — `getPlatformRecalcSignal`]
- [Source: `_bmad-output/specs/spec-divan/glossary.md` — domain term seed]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- control-contract ghost false-positive: DialogFooter→ghost distance >800 chars after adding `disabledReason` on download CTA; fixed by reordering close button before download in export panel footer.
- `stalePendingUntil` / «شناسهٔ فنی» selfcheck false-positives from comments — tightened assertions to runtime usage.

### Completion Notes List

- **N-count source:** `COUNT(DISTINCT person_id)` on `recalculation_status` where status ∈ (`pending`,`failed`,`stale`) via `getPlatformRecalcSignal.affectedPersonCount`; fail-closed platform status returns `null` (unknown) and banner uses `staleRecalcUnknownScope` — never invents «۰ فرد».
- **List-row mark decision:** Personnel list still excludes freshness-blocked persons (domain fail-closed). Shipped in-place mark on (1) personnel-events fixture GDT row, (2) profile freshness-block chrome, (3) event-form subject chrome via authorized `getCurrentState`. Live personnel-list join deferred to 8.10 if product wants pending persons visible-as-muted rather than excluded.
- **Glossary term set (10):** personnelEvent, draft, finalize, headcount, reservation, breakGlass, organizationalScope, currentState, baseline, effectiveDate. Proof placements: events list, headcount approval, break-glass, event-form subject, gallery.
- **Deferred placements (8.10 / 9.8):** remaining surfaces’ glossary wrapping; «اصلاح اطلاعات» nav rename; full mockup QA / AA gate; EntityPicker empties untouched.
- **As-of metadata left intentionally:** `stalePendingUntil` remains on signal/provider for ops/debug only — never rendered in UI. Report/dashboard «آخرین محاسبه» as-of footers unchanged (not deadline phrasing).
- **Empty taxonomy:** GDT additive `emptyKind` / `emptyAction`; defaults filtered vs noDataYet from filter delta; `EmptyState` + `emptyStateCopy` helper; auditEmptyFilter still overridable via `emptyMessage`.
- **Disabled reasons:** ~100 Button sites got `disabledReason` (mostly `actionPending`); selfcheck scans components with allowlist for filter chrome / entity-picker / jalali passthrough.
- Verified green: `selfcheck:operational-copy`, `feedback`, `control-contract`, `row-actions`, `governed-table`, `layout-system`, `leave-guard`, `a11y-floor`, `typecheck`.

### File List

- `_bmad-output/implementation-artifacts/8-9-self-explaining-state-operational-copy.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/package.json`
- `apps/web/lib/operational-copy.ts`
- `apps/web/lib/operational-copy.selfcheck.ts`
- `apps/web/lib/empty-state.ts`
- `apps/web/lib/ui-glossary.ts`
- `apps/web/lib/a11y-floor.selfcheck.ts`
- `apps/web/components/stale-recalc-banner.tsx`
- `apps/web/components/platform-status-provider.tsx`
- `apps/web/components/ui/empty-state.tsx`
- `apps/web/components/glossary/glossary-term.tsx`
- `apps/web/components/personnel/recalc-pending-mark.tsx`
- `apps/web/components/personnel/person-recalc-subject-chrome.tsx`
- `apps/web/components/personnel/person-profile-view.tsx`
- `apps/web/components/personnel/personnel-events-list-panel.tsx`
- `apps/web/components/personnel/personnel-event-form.tsx`
- `apps/web/components/personnel/personnel-event-timeline.tsx`
- `apps/web/components/personnel/personnel-event-lifecycle-controls.tsx`
- `apps/web/components/personnel/personnel-add-panel.tsx`
- `apps/web/components/personnel/personnel-lifecycle-panel.tsx`
- `apps/web/components/personnel/personnel-quick-create-dialog.tsx`
- `apps/web/components/personnel/personnel-quick-edit-modal.tsx`
- `apps/web/components/personnel/sensitive-confirmation-dialog.tsx`
- `apps/web/components/governed-data-table/governed-data-table.tsx`
- `apps/web/components/governed-data-table/types.ts`
- `apps/web/components/dashboard/dashboard-metric-card.tsx`
- `apps/web/components/reports/report-catalogue-panel.tsx`
- `apps/web/components/reports/decision-publication-panel.tsx`
- `apps/web/components/access/break-glass-panel.tsx`
- `apps/web/components/access/access-people-panel.tsx`
- `apps/web/components/access/access-roles-panel.tsx`
- `apps/web/components/access/access-scopes-panel.tsx`
- `apps/web/components/access/entitlement-grants-panel.tsx`
- `apps/web/components/headcount/approval-panel.tsx`
- `apps/web/components/headcount/exemption-panel.tsx`
- `apps/web/components/headcount/override-panel.tsx`
- `apps/web/components/import/import-wizard.tsx`
- `apps/web/components/import/migration-reconciliation-workspace.tsx`
- `apps/web/components/organization/org-flat-job-ref-panel.tsx`
- `apps/web/components/organization/org-hierarchy-panel.tsx`
- `apps/web/components/organization/org-ladder-grade-panel.tsx`
- `apps/web/components/correction-cases/correction-cases-panel.tsx`
- `apps/web/components/audit/audit-investigation-panel.tsx`
- `apps/web/components/export/export-artifact-panel.tsx`
- `apps/web/components/authz-changed-modal.tsx`
- `apps/web/components/leave-guard/leave-guard-dialog.tsx`
- `apps/web/components/login-form.tsx`
- `apps/web/app/(app)/dev/gallery/page.tsx`
- `apps/web/app/(app)/access/(tabs)/layout.tsx`
- `apps/web/app/(app)/audit/page.tsx`
- `apps/web/app/(app)/correction-cases/page.tsx`
- `apps/web/app/(app)/headcount/(tabs)/layout.tsx`
- `apps/web/app/(app)/operations/page.tsx`
- `apps/web/app/(app)/organization/(tabs)/layout.tsx`
- `apps/web/app/(app)/personnel/(tabs)/layout.tsx`
- `apps/web/app/(app)/personnel-events/(tabs)/layout.tsx`
- `apps/web/src/server/platform-status.ts`
- `packages/modules/person-employment/src/personnel-event-recalc.ts`
- `packages/modules/person-employment/src/personnel-event-recalc.selfcheck.ts`

## Change Log

- 2026-07-31: Story context created (ready-for-dev) — ultimate context engine analysis completed.
- 2026-07-31: Implemented Story 8.9 — recalc banner N+disclosure, empty taxonomy, glossary, muted figures, disabledReason sweep, gallery + selfcheck; status → review.
- 2026-07-31: Code review — findings triaged; decision (A) + all patches applied; status → done.

### Review Findings

- [x] [Review][Decision] Fail-closed banner with N=0 — Resolved: (A) unknown-scope copy; `affectedPersonCount: null` on fail-closed + `staleRecalcUnknownScope`.
- [x] [Review][Patch] GDT `emptyMessage` overrides filtered empty copy [`apps/web/components/governed-data-table/governed-data-table.tsx`]
- [x] [Review][Patch] Multi-cause `disabled` always announces `actionPending` (lifecycle authz, break-glass self-approve, publish gold-block, import prerequisites, etc.)
- [x] [Review][Patch] Sensitive confirm falls back to `staleGoldCtaHint` when reason is missing [`apps/web/components/personnel/sensitive-confirmation-dialog.tsx`]
- [x] [Review][Patch] High-traffic empties bypass taxonomy [`apps/web/components/correction-cases/correction-cases-panel.tsx`]
- [x] [Review][Patch] Same empty bypass on org flat job-ref [`apps/web/components/organization/org-flat-job-ref-panel.tsx`]
- [x] [Review][Patch] Export generate uses `exportDenied` when source is unset [`apps/web/components/export/export-artifact-panel.tsx`]
- [x] [Review][Patch] GDT chrome density/columns `Button` disabled while loading without `disabledReason` [`apps/web/components/governed-data-table/governed-data-table.tsx`]
- [x] [Review][Patch] Report catalogue pending still mounts GDT with unmuted numeric cells [`apps/web/components/reports/report-catalogue-panel.tsx`]
- [x] [Review][Patch] Report catalogue radio buttons `disabled={fetching}` without Persian reason [`apps/web/components/reports/report-catalogue-panel.tsx`]
- [x] [Review][Patch] `EmptyState` `notPermitted` never renders CTA without `onAction` [`apps/web/components/ui/empty-state.tsx`]
- [x] [Review][Patch] `EmptyState` drops `titleFa` (only body via FeedbackMessage) [`apps/web/components/ui/empty-state.tsx`]
- [x] [Review][Patch] `PersonRecalcSubjectChrome` ignores loading/error / non-recalc `ok:false` [`apps/web/components/personnel/person-recalc-subject-chrome.tsx`]
- [x] [Review][Patch] Gallery clear pending leaves local N; provider `Math.max` can inflate banner count
- [x] [Review][Patch] Compact `RecalcPendingMark` hardcodes «در حال محاسبه» instead of shared copy [`apps/web/components/personnel/recalc-pending-mark.tsx`]
- [x] [Review][Defer] `<details>` inside `role="alert"` assertive region [`apps/web/components/stale-recalc-banner.tsx`:26] — deferred, pre-existing
- [x] [Review][Defer] Profile stacks `RecalcPendingMark` live region with sibling `role="alert"` [`apps/web/components/personnel/person-profile-view.tsx`:197] — deferred, pre-existing
- [x] [Review][Defer] Duplicate `getCurrentState` query in subject chrome vs profile [`apps/web/components/personnel/person-recalc-subject-chrome.tsx`:12] — deferred, pre-existing
