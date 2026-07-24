---
baseline_commit: 4fc1ea9
---

# Story 5.3: Personnel Event Timeline

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an HR Admin or Operator,
I want a chronological Personnel Event timeline with status badges and correction links,
so that I can investigate what changed and how it was corrected (FR34, UX-DR9, UJ-2).

**Story key:** `5-3-personnel-event-timeline`  
**Epic:** 5 — Search, Profiles, Dashboard & Reports (FR33–36)  
**Prerequisite:** Story 5.2 done (profile sections + `#personnel-timeline-entry` stub). Epic 4 lifecycle APIs live (`listForPerson`, Cancel/Reverse/Correct, `lifecycleCaps`, `StatusBadge`). Epic 4b chrome live.

> **Epics note:** In `epics.md`, Story 5.3 ACs follow 5.2 without an explicit `### Story 5.3` heading — treat the block starting “As an HR Admin or Operator / chronological Personnel Event timeline…” as this story. Sprint key is authoritative.

## Acceptance Criteria

1. **Given** a Person profile the actor can open (same scope gate as 5.2)  
   **When** the timeline renders at `#personnel-timeline-entry`  
   **Then** rows show: event type, Jalali Effective Date, registration/finalization actor + time, status badge, provenance, and correction/neutralization chain links

2. **And** sort is Effective Date desc → registration time desc → event type; same-day rows show a secondary caption sort hint (registration time)

3. **And** decorative status dots are `aria-hidden`; badge text is the sole status announcement (reuse `StatusBadge` — UX-DR10)

4. **And** empty timeline shows exactly «رویداد پرسنلی ثبت نشده.»

5. **And** actions to open Correction / Cancel / Reverse respect `lifecycleCaps` (+ mutation entitlements) and drive Epic 4 append-only flows (no history rewrite UI)

6. **And** timeline reads are person-org scoped (`assertPersonInScopedPopulation` or timeline-channel equivalent) — out-of-scope / unknown person → uniform not-found; **no** unscoped event dumps

7. **And** timeline consumes event-store / `personnelEvent` lifecycle APIs — **no** parallel timeline SoT / projection tables (Epic 4 / 5.2 consumer contract)

8. **And** profile sections from 5.2 remain intact; timeline **replaces** the 5.2 stub copy inside `#personnel-timeline-entry` (do not invent a second profile route)

## Tasks / Subtasks

- [x] Task 1: Scoped timeline read path (AC: #1, #6, #7)
  - [x] Harden `personnelEvent.listForPerson` (or add a thin `listTimelineForPerson` alias used only by profile) so every person-scoped list:
    - requires authz already enforced by `governedProcedure`
    - calls **`assertPersonInScopedPopulation`** (prefer InferenceBulk channel **`timeline`** — already reserved in `retrieval-control.ts`; extend helper with optional `channel` defaulting to `"profile"` so 5.2 callers stay stable)
    - returns rows from `listBusinessEventsForPerson` + `listChainLinksForEvents` + `resolveLifecycleStatus` (already wired) — **do not** invent a second event query stack
  - [x] **Gap to close:** today `listForPerson` only checks `assertActorHasPersonnelEventDraft` — **IDOR risk** for any UUID. Profile timeline must not ship without person-org scope.
  - [x] Enrich DTO for FR-34 display fields missing from thin `BusinessEventRecord` today:
    - **Provenance:** `BUSINESS_SELECT` / `mapBusinessRow` currently omit `provenance` (+ useful `reference_code`). Extend the thin read **once** for timeline/list consumers (keep structural refs only — never sensitive evidence keys; AD-2 / event-store sensitive-key walk still applies).
    - **Actors:** `registeredBy` / `finalizedBy` are InternalAccount ids — render as safe labels (truncate id OK for MVP; optional thin lookup via identity-access if an existing helper exists — **do not** invent a new account directory module).
  - [x] Sort contract: SQL today is `effective_date DESC, registered_at DESC, id DESC`. Align with AC #2 (**type** tertiary). Prefer server ORDER BY `event_type` (stable) over client-only sort; if client re-sorts, document why and keep deterministic.
  - [x] Persian fail-closed errors; do not leak enumeration timing for out-of-scope persons (same uniform `PERSON_NOT_FOUND` posture as 5.1/5.2)

- [x] Task 2: `personnel-event-timeline` / `event-timeline-row` UI (AC: #1–#4, #8)
  - [x] UPDATE `apps/web/components/personnel/person-profile-view.tsx`: replace stub paragraph under `#personnel-timeline-entry` with timeline host; keep section title «گاه‌شمار رویدادهای پرسنلی»
  - [x] NEW under `apps/web/components/personnel/`:
    - `personnel-event-timeline.tsx` — list host, empty state, Skeleton cold load, query wiring
    - `event-timeline-row.tsx` — one row composition (type, Jalali effective date, actor+time captions, `StatusBadge`, provenance, chain links, lifecycle actions)
  - [x] Reuse **`StatusBadge`** (`apps/web/components/personnel/status-badge.tsx`) — already implements aria-hidden decorative dot + Persian labels. Do **not** fork badges.
  - [x] Jalali Effective Date via existing date display helpers + `toPersianDigits`; registration/finalization show **date+time** distinct from Effective Date (FR-44 / UX)
  - [x] Same-day secondary caption: when consecutive rows share Effective Date, show registration-time hint as secondary caption (UX-DR9)
  - [x] Chain links: reuse / extract `formatChainLinksFa` pattern from `personnel-event-form.tsx` (cancellations / reversals / corrections) — prefer shared tiny helper under `apps/web/lib/` or `components/personnel/` to avoid drift
  - [x] Empty: exact copy «رویداد پرسنلی ثبت نشده.»
  - [x] Cold load: `Skeleton` matching row density while query pending; freshness/query errors → Persian fail-closed (mirror profile section error posture — no raw `error.message` theater)

- [x] Task 3: Lifecycle actions → Epic 4 flows (AC: #5, UJ-2)
  - [x] Gate buttons with `api.personnelEvent.lifecycleCaps` (+ existing status rules from form):
    - Cancel → Scheduled only
    - Reverse → Effective only
    - Correct → Scheduled or Effective
  - [x] On action: open Epic 4 Cancel/Reverse/Correct path with mandatory reason via **`SensitiveConfirmationDialog`** (already supports lifecycle reason) and existing mutations `cancel` / `reverse` / `correct`
  - [x] Prefer **in-profile** thin lifecycle (UJ-2: correction from timeline on profile) — extract minimal shared lifecycle opener from `personnel-event-form.tsx` rather than mounting the full register form on the profile
  - [x] Allowed alternative if extraction is too risky in one pass: deep-link to `/personnel-events/register?person={id}` **plus** explicit product note that full correction UX still completes on register — but still must not invent a third mutation API. Prefer in-profile.
  - [x] After success: invalidate timeline query; original event remains visible with chain link (append-only — AD-2)
  - [x] Without caps: actions absent from DOM (not disabled theater that implies existence of forbidden ops)

- [x] Task 4: Verify + DoD (AC: #1–#8)
  - [x] NEW thin selfcheck(s): sort contract (EffDate → registeredAt → type); chain-link formatter; empty-copy constant; optional provenance key presence on mapper — helper-level only
  - [x] Regression: `selfcheck:personnel-profile`, event-store / lifecycle selfchecks as touched; web typecheck + eslint on touched files
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows

### Manual DoD checklist

- [x] Profile `#personnel-timeline-entry` shows rows for in-scope Person with events
- [x] Empty person → «رویداد پرسنلی ثبت نشده.»
- [x] Sort: newer Effective Date first; same-day shows registration-time secondary hint; type breaks remaining ties
- [x] StatusBadge text announces status; decorative dot not in accessibility tree
- [x] Chain links visible for Cancelled / Reversed / Corrected targets
- [x] Cancel / Reverse / Correct respect caps + status; unauthorized → no action controls
- [x] Out-of-scope personId on list procedure → uniform not-found (no event leakage)
- [x] Provenance / actor+time / Jalali Effective Date visible per FR-34
- [x] 5.2 sections still render; no parallel profile SoT; no Prisma in `apps/web`
- [x] UJ-2 path workable: profile → timeline → Effective → اصلاح → linked chain after submit
- [x] Labels remain اطلاعات پرسنلی / پروفایل فرد / گاه‌شمار — no Epic 1 «پرسنل» regression

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Mount timeline in 5.2 `#personnel-timeline-entry` | New parallel profile/timeline route without scope |
| Consume event-store + existing `personnelEvent.*` lifecycle APIs | Invent timeline projection tables / dual-write SoT |
| Person-org scope on timeline list (`timeline` InferenceBulk channel preferred) | Unscoped `listForPerson` by UUID |
| Reuse `StatusBadge` (UX-DR10) | Fork status pills / CSS-only status |
| DOM-omit unauthorized lifecycle actions | Disabled buttons that reveal forbidden ops |
| Append-only Cancel/Reverse/Correct | In-place edit / hard-delete of Finalized events |
| AR-ACCESS / AR-DATA / AR-TEMPORAL / AR-REPORTING fail-closed | Invent enablement, OQ-2/OQ-3 masking, national_id religion |
| PopulationPort honesty (fixture ≠ production workforce) | Claim cutover without `population-cutover.ts` criteria |
| Persian operational copy + `toPersianDigits` | Raw English tokens in actor-facing status/a11y |

### Absolute non-goals

- Dashboard / reports → **5.4 / 5.5**
- Org-wide personnel-events list depth (still scaffold under `/personnel-events/events`) — do not expand into FR-33 event catalogue here
- Governed export → **6.5**; artifact reauth (Epic 2 carry)
- PopulationPort **full** cutover; AD-6 Prisma vs PoolClient; `ensure*Schema` migrations-only; Vitest mandate
- Logout → `requestNavigation` leave-guard (Epic 4b open item)
- Dedupe Add vs QuickCreate forms (Epic 4b open) unless already in touch radius
- Full before/after evidence inspector beyond what lifecycle APIs already expose (UJ-2 “review before/after” can reuse existing resolve/get payloads — do not build a forensic audit UI)
- Historical as-of reconstruction UI (FR-26 / Story 4.10 consumers) — timeline is chronological event list, not as-of projector

### Profile / timeline consumer contract (inherit 5.2 — enforce here)

1. **Current facts** → still `getCurrentPersonState` only (unchanged by this story).
2. **Prior employments** → still `listPriorEmployments` / employment reads (unchanged).
3. **Timeline (this story)** → `listBusinessEventsForPerson` + chain links + `resolveLifecycleStatus` via governed `personnelEvent` procedures; sort/badge/chain/actions implemented here.
4. **Scheduled vs Effective on profile sections** → remain via `scheduledChanges` + `StatusBadge`; timeline rows use **resolved** lifecycle status independently.
5. **No parallel SoT:** no `timeline_projection` table; no Prisma in web; no client-only authz filtering of full dumps.
6. **UI list ≠ apply-order:** use DESC display list (`listBusinessEventsForPerson`). **Never** wire timeline UI to `listBusinessEventsForPersonForApply` (ASC reconstruct / FR-18) — that path is for temporal apply only ([Source: deferred-work / 4.4]).

### Read entitlement vs profile visibility (product decision — encode in impl)

Today `listForPerson` gates on `assertActorHasPersonnelEventDraft`. Profile open gates on person scope + page access. Possible mismatch: actor can open profile but lacks draft entitlement → timeline query fails.

**Default for 5.3 (fail-closed, no invention):** keep list behind existing draft-read entitlement **and** person-org scope. If query is forbidden: show Persian fail-closed message inside the timeline section (not raw tRPC), **do not** invent a new “timeline.read” permission matrix. Document in Completion Notes if product later wants person.read-only viewers to see timeline without draft.

### Thin-read / Draft / evidence pitfalls

- **Provenance yes; payload dump no:** enrich `provenance` (+ optional `reference_code`) for FR-34. Do **not** render raw `payload` / before/after evidence blobs in timeline rows (sensitive-key walk exists at append; UI must still not dump).
- **SQL comment trap:** `listBusinessEventsForPerson` comment says it excludes Draft; WHERE does **not** filter `status`. Product Drafts live in Prisma draft table; scaffold Drafts in `kernel_events` may appear — decide explicitly (hide `status === "Draft"` in timeline UI **or** show with `StatusBadge` Draft). Prefer **show with badge** if present; do not silently rewrite SQL without noting form callers.
- **Actor labels:** `registeredBy` / `finalizedBy` are account ids — truncate OK; optional existing identity lookup only — no new directory module.
- **Type labels:** reuse / extract `EVENT_TYPE_OPTIONS` (or equivalent) from `personnel-event-form.tsx` for Persian type display — do not hardcode a second map that drifts.
- **Jalali helpers:** `apps/web/lib/jalali.ts` — `formatJalaliDisplayFromGregorian` (Effective Date date-only) + `formatJalaliDateTimeFromIso` (registration/finalization clocks) + `toPersianDigits`.
- **Cold-load:** timeline query Skeleton **independent** of profile’s multi-query ready gate (5.2 deferred: four queries hold Skeleton — do not make timeline wait on labels/prior).
- **`recalculation_pending`:** if assembler/profile already surfaces stale recalc, do not paint timeline as contradicting pending truth; timeline remains event list (AD-6). Do not invent a new pending SoT.

### UPDATE files — current state → change → preserve

| Path | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `person-profile-view.tsx` | Stub copy under `#personnel-timeline-entry` | Replace stub with timeline host | All 5.2 sections, Skeleton/freshness/omit rules, back-link |
| `personnel-event.ts` `listForPerson` | Draft-entitlement only; no person scope; no provenance on record | Add scope (+ optional provenance enrichment path) | Existing form callers; envelope meta; error mapping |
| `business-event.ts` thin read | `BUSINESS_SELECT` omits provenance/reference | Extend select/map for FR-34 provenance | Sensitive-key fail-closed; apply-order list unchanged |
| `personnel-event-form.tsx` | Inline foreshadow list + lifecycle actions; notes “Epic ۵.۳” | Optional extract shared chain/lifecycle helpers; form keeps working | Draft≠Finalize; leave-guard; mutations |
| `status-badge.tsx` | UX-DR10 complete | **Reuse only** | Token classes + aria-hidden dot |
| `personnel-scoped-search.ts` `assertPersonInScopedPopulation` | Hardcodes InferenceBulk `profile` | Optional `channel` param (`timeline` for this story) | Default `profile` for 5.1/5.2 |

### Previous story intelligence (5.2 → 5.3)

From `5-2-personnel-profile-sections.md` completion + review:

- Timeline entry deliberately **stub-only** (`#personnel-timeline-entry`) — outbound register link was **rejected** in review (mutation surface). 5.3 owns depth; do not reintroduce a blind register href as the “timeline.”
- Profile gate + `getCurrentState` / prior employments stay; timeline is additive.
- Persian fail-closed for query errors (no raw `error.message`) — apply same to timeline query.
- BOM-safe `sprint-status.yaml` edits (UTF-8 without BOM).
- Helper selfchecks ≠ DOM/keyboard coverage — honest DoD ceiling.
- Deferred 5.2 items (cold-load waits on all queries; duplicate assembler in `getProfileLabels`) — **do not** expand scope to “fix” unless blocking; avoid making timeline cold-load wait on unrelated profile queries.

### Git intelligence (recent)

- `4fc1ea9` story 5.2 — profile view + mapper + scoped person procedures
- `f4e9b5f` story 5.1 — scoped search / IDOR / PopulationPort honesty
- `5b7cde0` story 4b.7 — events shell + `personnel-event-form` relocate + foreshadow list (“جدول زمانی کامل در Epic ۵.۳”)

Pattern: replace stubs in place; harden existing tRPC reads with scope; reuse chrome primitives; thin selfchecks + manual a11y DoD.

### Architecture compliance

- **AD-2:** Timeline is a read of append-only business events + derived resolved status — corrections append linked events; never rewrite.
- **AD-5:** UI visibility ≠ authorization; `governedProcedure` + envelope; DOM omit for forbidden actions.
- **AD-6:** No `@prisma/client` in `apps/web`; event reads via pool/kernel APIs already used by `personnel-event.ts`.
- Capability map: search/profile/timeline (FR-33..34) → reporting + projections orchestration; timeline specifically event-store + person scope — not a new module.
- Stack (repo): Next.js **16.2.10** (async `params` already on profile page), tRPC **11.18.x**, React **19**, Node 22 — **no stack upgrade** in this story.

### File structure (expected touch)

**UPDATE (primary):**

- `apps/web/components/personnel/person-profile-view.tsx`
- `apps/web/src/server/personnel-event.ts` (`listForPerson` scope + DTO)
- `apps/web/src/server/personnel-scoped-search.ts` (optional `channel` on assert)
- `packages/kernel/event-store/src/business-event.ts` (provenance on thin read — if Task 1 chooses extend-in-place)

**NEW (as needed):**

- `apps/web/components/personnel/personnel-event-timeline.tsx`
- `apps/web/components/personnel/event-timeline-row.tsx`
- Shared `format-chain-links.ts` / lifecycle action helper
- Thin `personnel-event-timeline.selfcheck.ts` (or under `lib/`)

**DO NOT modify (unless proven blocker + note):**

- `governed-data-table/**` public contract
- Event finalize semantics / Operator capacity rules
- Access admin domain APIs
- `section-tab-surfaces.ts` (profile remains contextual)
- Org-wide events list panel scaffold (out of scope)

### Library / framework requirements

- Reuse: `StatusBadge`, `Skeleton`, `toPersianDigits`, Jalali helpers in `apps/web/lib/jalali.ts`, `SensitiveConfirmationDialog`, `api.personnelEvent.listForPerson` / `lifecycleCaps` / `cancel` / `reverse` / `correct`, `assertPersonInScopedPopulation`
- Client data: `@/lib/trpc/client` hooks — same pattern as profile view; **separate** `useQuery` for timeline (do not fold into profile cold-load barrier)
- If navigating to register for lifecycle fallback: use leave-guard `requestNavigation` when any dirty form exists (data-state rules from 5.1/4b)
- No AG Grid; no new timeline chart libraries; no full calendar widget
- Next.js 16: keep awaiting `params` only at page boundary (already done); client children receive plain `personId`

### Testing requirements

- Thin helper selfchecks for sort + chain formatter + empty copy
- Package regressions for event-store / lifecycle if `BusinessEventRecord` shape changes
- Manual DoD for a11y badge, UJ-2 correction path, scope denial — do not claim covered by selfcheck alone

### Latest technical notes (2026)

- Next.js 16: `params` / `searchParams` are Promises — profile page already awaits; do not regress
- tRPC 11 + React Query: invalidate timeline query key after lifecycle mutations (mirror form invalidation patterns)
- No dependency upgrades for this story

### Project context reference

- No root `project-context.md` at activation; follow architecture spine + Gates + package boundaries above
- UX: `ux-divan-2026-07-19` retains `personnel-event-timeline`; detailed row/sort/empty rules from `ux-divan-2026-07-13` EXPERIENCE (UX-DR9 / empty timeline). UJ-2 correction journey restored in 2026-07-19 EXPERIENCE (not access-admin).

### Epic 4 / 4b / 5 carry-ins

1. Profile/timeline consumer contract — **Gate above**
2. Person-org IDOR + PopulationPort honesty — extend to timeline list
3. AR matrices fail-closed in Epic 5
4. Leave-guard data-state rules — timeline is read-primary; lifecycle dialogs should not invent dirty profile form state without leave-guard (prefer dialog-local state)
5. Still-open (do not silently “fix”): InferenceBulkPort ops doc; sticky break-glass; artifact reauth 6.5/7.x; PopulationPort cutover; AD-6 hardening; ensure*Schema migrations-only

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5 / Story 5.3 ACs; UX-DR9]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-34, FR-17 (Cancel/Reverse/Correction), UJ-2]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — personnel-event-timeline row contract; empty copy]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md` — UJ-2 correction; retained timeline]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-2/5/6; FR-33..34 capability map]
- [Source: `_bmad-output/implementation-artifacts/5-2-personnel-profile-sections.md` — consumer contract + stub decision]
- [Source: `_bmad-output/implementation-artifacts/5-1-permission-safe-personnel-search-lists.md` — IDOR / PopulationPort]
- [Source: `apps/web/components/personnel/person-profile-view.tsx` — `#personnel-timeline-entry`]
- [Source: `apps/web/src/server/personnel-event.ts` — `listForPerson`, lifecycle]
- [Source: `apps/web/components/personnel/status-badge.tsx`]
- [Source: `apps/web/components/personnel/personnel-event-form.tsx` — foreshadow list + chain/lifecycle patterns]
- [Source: `packages/kernel/event-store/src/business-event.ts` — `listBusinessEventsForPerson`, thin record]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- `pnpm --filter @divan/web selfcheck:personnel-timeline` — ok
- `pnpm --filter @divan/web selfcheck:personnel-profile` — ok
- `pnpm --filter @divan/web selfcheck:personnel-search` — ok
- `pnpm --filter @divan/event-store selfcheck` — ok
- `pnpm --filter @divan/person-employment selfcheck:personnel-event-lifecycle` — ok
- `pnpm --filter @divan/web typecheck` — ok
- eslint on touched files — 0 errors (pre-existing hooks warning in form only)

### Completion Notes List

- Hardened `listForPerson` with `assertPersonInScopedPopulation({ channel: "timeline" })` after draft entitlement — closes person-org IDOR; out-of-scope → uniform `PERSON_NOT_FOUND` via `PersonIdentityError` mapping.
- Extended thin `BusinessEventRecord` with `provenance` + `referenceCode`; server ORDER BY now `effective_date DESC, registered_at DESC, event_type ASC, id DESC`.
- Replaced `#personnel-timeline-entry` stub with `PersonnelEventTimeline` (independent cold-load Skeleton; exact empty copy; StatusBadge reuse; Jalali Effective Date vs registration/finalization clocks; same-day registration hint; chain links).
- In-profile lifecycle via `PersonnelEventLifecycleControls` + existing cancel/reverse/correct mutations + `SensitiveConfirmationDialog`; unauthorized actions absent from DOM; invalidate `listForPerson` after success.
- Product note: timeline list still requires draft-read entitlement (fail-closed; no new timeline.read matrix). Actor labels truncated ids (no directory module). Draft kernel rows shown with StatusBadge if present.
- Honest DoD ceiling: helper selfchecks cover sort/chain/empty/provenance caption; full browser a11y + UJ-2 path should be spot-checked in review.

### File List

- `apps/web/lib/personnel-event-timeline.ts` (new)
- `apps/web/lib/personnel-event-timeline.selfcheck.ts` (new)
- `apps/web/components/personnel/personnel-event-timeline.tsx` (new)
- `apps/web/components/personnel/event-timeline-row.tsx` (new)
- `apps/web/components/personnel/personnel-event-lifecycle-controls.tsx` (new)
- `apps/web/components/personnel/person-profile-view.tsx`
- `apps/web/components/personnel/personnel-event-form.tsx`
- `apps/web/src/server/personnel-event.ts`
- `apps/web/src/server/personnel-scoped-search.ts`
- `apps/web/package.json`
- `packages/kernel/event-store/src/business-event.ts`
- `_bmad-output/implementation-artifacts/5-3-personnel-event-timeline.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-24: Story context created (ready-for-dev) — ultimate context engine analysis completed.
- 2026-07-24: Code review — patches applied (lifecycle labels, confirm copy, caps error UI, load-more pagination); status → done.

### Review Findings

- [x] [Review][Decision] Silent 50-event timeline ceiling — resolved: load-more pagination (`TIMELINE_PAGE_SIZE` 50 → up to `TIMELINE_MAX_LIMIT` 200) + truncation caption at max; tRPC `listForPerson` max aligned to 200.
- [x] [Review][Patch] Lifecycle event types render as raw English tokens [`apps/web/lib/personnel-event-timeline.ts`] — fixed with display-only `EventCancelled` / `EventReversed` / `EventCorrected` Persian labels.
- [x] [Review][Patch] Cancel/Reverse confirm copy claims correction [`apps/web/components/personnel/personnel-event-lifecycle-controls.tsx`] — consequence text now op-specific.
- [x] [Review][Patch] `lifecycleCaps` query errors hide all actions silently [`apps/web/components/personnel/personnel-event-timeline.tsx`] — fail-closed Persian alert; caps treated false only when error.
- [x] [Review][Defer] Cancel/Reverse/Correct mutations lack person-org scope gate [`apps/web/src/server/personnel-event.ts:516`] — deferred, pre-existing
- [x] [Review][Defer] `assertPersonInScopedPopulation` maps infra failures to PERSON_NOT_FOUND [`apps/web/src/server/personnel-scoped-search.ts:464`] — deferred, pre-existing
