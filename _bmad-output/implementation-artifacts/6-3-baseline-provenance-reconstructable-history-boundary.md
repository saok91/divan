---
baseline_commit: 783dca6
---

# Story 6.3: Baseline Provenance & Reconstructable History Boundary

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an HR Admin,
I want Baseline state distinct from native Personnel Events with clear provenance,
so that users understand the start of reliable reconstructable history (FR39).

**Story key:** `6-3-baseline-provenance-reconstructable-history-boundary`  
**Epic:** 6 — Migration, Baseline & Governed Export (FR37–41, FR52)  
**Prerequisite:** Story 6.2 done — staging + SoD + atomic cutover appends `BaselineRecorded` with `provenance.source = "migration"` (+ `batchId`, `previewBatchId`, `templateKey`, `sourceRow`); Import Batch evidence exists; FR-39 **UX / product boundary copy** explicitly deferred here. Story 6.1 wizard + permission-omit patterns remain the UI substrate.

## Acceptance Criteria

1. **Given** an approved cutover that produced production `BaselineRecorded` event(s)  
   **When** an authorized user views Person history (personnel event timeline)  
   **Then** **Baseline** state, **imported** (migration-sourced non-Baseline) events, and **native** events are visually and verbally distinguishable in Persian (not raw English `منبع: migration` alone)

2. **And** the product **states the reconstructable-history boundary** in operator-facing Persian (timeline and/or profile as-of / migration metadata surfaces): users can tell where reliable reconstructable history starts; **where applicable**, the first production event per migrated Person is the approved Baseline event (`BaselineRecorded`)

3. **And** `source=migration` (and related provenance fields) remain **audit metadata only** — UI copy and code comments must make clear they are **not** a substitute for cutover controls (approve / execute / staging / SoD / evidence). Do **not** gate security or cutover on reading `provenance.source`

4. **And** migration metadata after cutover (wizard result and/or batch evidence view) surfaces Baseline / boundary honesty without exposing sensitive payload dumps — refs/codes only (`batchId`, counts, created event ids already on evidence)

5. **And** existing FR-26 Baseline disclosure (`baselineDisclosure` via `DIVAN_BASELINE_BOUNDARY_DATE`) is preserved and **aligned in voice** with FR-39 boundary copy — do **not** invent a signed Baseline-revision policy or silently invent a default epoch when env is unset (fail-closed / honesty messages stay)

6. **And** this story does **not** own signed reconciliation workspace / FR-40 production gate UI (→ **6.4**), governed export / artifact reauth / custody (→ **6.5**), or re-architecture of cutover TX / staging DDL

7. **And** AR-MIGRATION / AR-TEMPORAL / AR-ACCESS / AR-DATA remain fail-closed: provisional UX labels + disclosure OK; forbidden to claim production migration readiness, invent merge/split/Baseline-revision matrices, or label fixture PopulationPort as production workforce authz

8. **And** PopulationPort honesty + timeline authz omit patterns from 5.3 / 6.1–6.2 are preserved — provenance captions never become a channel to leak omitted fields or sensitive values

## Tasks / Subtasks

- [x] Task 1: Provenance origin helpers (domain + shared captions) (AC: #1–#3, #7)
  - [x] NEW small helper module (prefer `@divan/migration` **or** `@divan/person-employment` — pick one published home; do **not** duplicate): e.g. `event-origin.ts` / `migration-provenance.ts` with:
    - `isMigrationProvenance(provenance)` — true when `provenance.source === "migration"` (string-safe)
    - `classifyEventOrigin({ eventType, provenance })` → `"baseline" | "imported" | "native"`
      - `"baseline"` = `eventType === "BaselineRecorded"` (constant already exported as `BASELINE_RECORDED_EVENT_TYPE` from migration)
      - `"imported"` = migration provenance **and** not BaselineRecorded (forward-compatible if later templates append other migration events)
      - `"native"` = everything else (including cancel/reverse/correct lifecycle with non-migration sources)
    - Pure functions; no DB I/O; export from package barrel
  - [x] Document in module header: `source=migration` is **audit metadata**, never cutover/authz control (AD-4 / FR-39)
  - [x] Optional: narrow a typed `MigrationProvenance` shape for docs/selfcheck — do **not** require rewriting `AppendBusinessEventInput.provenance` away from `Record<string, unknown>` unless a tiny compatible type alias helps; avoid breaking append callers

- [x] Task 2: Timeline distinguishability (AC: #1–#2, #8)
  - [x] UPDATE `apps/web/lib/personnel-event-timeline.ts`:
    - Add display-only label for `BaselineRecorded` (e.g. «خط مبنا (Baseline)») in lifecycle/display map — **not** in `EVENT_TYPE_OPTIONS` form create list
    - Replace/extend `formatProvenanceCaption` so migration Baseline / imported / native produce **distinct Persian** captions (e.g. خط مبنا / رویداد وارداتی / رویداد بومی) while still allowing compact refs (`batchId` truncated, `sourceRow`, `referenceCode`) — **never** dump full provenance JSON or payload
    - Keep FR-34 safety: refs/codes only
  - [x] UPDATE `apps/web/components/personnel/event-timeline-row.tsx` to consume improved captions; optional subtle visual distinction (e.g. muted caption prefix / `data-origin` attribute) — **no new card chrome**, no floating badges on hero surfaces; stay within existing timeline row composition (UX-DR9)
  - [x] Persian digits for any numeric row refs shown; Jalali already used for Effective Date — preserve
  - [x] Copy strings: prefer `operational-copy.ts` and/or domain `MSG_*_FA` — **no hardcoded ceremonial Persian** scattered without a single source

- [x] Task 3: Reconstructable-history boundary product statement (AC: #2, #4–#5)
  - [x] Profile / as-of: ensure `baselineDisclosure.messageFa` voice matches FR-39 glossary («شروع تاریخچهٔ قابل‌بازسازی قابل‌اتکا» / equivalent operational Persian). UPDATE `MSG_BASELINE_DISCLOSURE_*_FA` in `person-employment` **only if** current strings are too weak or contradict FR-39 — keep env unset = honesty, not invented epoch
  - [x] When a Person has at least one `BaselineRecorded`, surface an explicit boundary statement on timeline empty-adjacent header **or** profile header (one clear place, not spam on every row): e.g. that reliable reconstructable history for this Person starts at the Baseline event Effective Date — **where applicable**. If Person was matched pre-existing with earlier native events, do **not** lie that Baseline was first; copy must allow the “where applicable” case (honest qualifier)
  - [x] Import wizard **post-cutover success** panel: add short FR-39 honesty lines — Baseline established; reconstructable-history boundary; `source=migration` is audit metadata not cutover control. Reuse evidence DTO already returned by 6.2 — do not re-execute cutover
  - [x] Do **not** auto-write `DIVAN_BASELINE_BOUNDARY_DATE` from cutover (ops/env remains explicit; inventing org-wide Baseline revision = out of scope / AR-MIGRATION pending)

- [x] Task 4: Preserve cutover / authz / reporting contracts (AC: #3, #6–#8)
  - [x] Do **not** change `executeImportBatch` control plane to key off provenance fields for authorize/SoD/mutex
  - [x] Do **not** activate FR-40 reconciliation UI or invent tolerances; keep 6.2 production-tier fail-closed hook as-is
  - [x] Do **not** touch export / artifact panel (6.5); Import Batch report remains evidence-backed or unavailable — never fabricate
  - [x] Layout≠RSC: any new RSC data load still calls `assertPageAccess` before fetch
  - [x] AD-3: no cross-module internal table reads; web stays thin

- [x] Task 5: Verify + DoD (AC: #1–#8)
  - [x] UPDATE `apps/web/lib/personnel-event-timeline.selfcheck.ts` — Baseline vs imported vs native caption/label assertions; no raw-only `منبع: migration` as the sole distinguisher for Baseline
  - [x] Domain selfcheck for `classifyEventOrigin` / migration provenance helpers
  - [x] Optional thin web/migration selfcheck asserting wizard success copy constants exist / boundary strings non-empty
  - [x] Regression: `@divan/migration` `selfcheck:import-batch` still green (cutover unchanged in behavior); reporting Import Batch never fabricate
  - [x] `pnpm` typecheck + eslint on touched packages (`@divan/web`, and whichever domain package owns helpers)
  - [x] Manual DoD checklist below
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; BOM-safe UTF-8 **without** BOM on Windows yaml edits

### Manual DoD checklist

- [x] After cutover, Person timeline shows `BaselineRecorded` with Persian Baseline label (not raw type string alone)
- [x] Migration-sourced Baseline caption ≠ native caption; imported (if present) ≠ Baseline ≠ native
- [x] Reconstructable-history boundary stated in Persian on at least one of: profile as-of disclosure, timeline context, post-cutover wizard result
- [x] Evidence/wizard metadata shows batch refs without payload dump
- [x] Unset `DIVAN_BASELINE_BOUNDARY_DATE` still honest (unconfigured message) — no invented default date
- [x] Pre-existing Person with native history + later Baseline does not claim “Baseline was first event” falsely
- [x] `source=migration` not used as approve/execute/authz gate
- [x] Under-permissioned viewer: omitted fields stay omitted; provenance caption does not leak them
- [x] No Prisma in web; AD-3/AD-4 held; staging/cutover machinery not regressively rewritten
- [x] Sprint/story must **not** claim FR-40 reconciliation or FR-41/FR-52 export done

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Distinguish Baseline / imported / native in Persian on history UX | Leave only raw `منبع: migration` as the FR-39 solution |
| State reconstructable-history boundary in product copy | Invent AR-MIGRATION Baseline-revision / merge-split policy |
| Keep `source=migration` as audit metadata only | Use provenance.source as cutover or authz control |
| Reuse 6.2 `BaselineRecorded` + existing provenance fields | Re-append Baseline events or rewrite staging DDL for “display” |
| Preserve FR-26 disclosure honesty (env unset / limited) | Invent default Baseline epoch; greenwash unconfigured |
| Preserve PopulationPort omit + timeline authz | Dump provenance JSON / sensitive payload into captions |
| Thin web; domain helpers published from one module | Fork timeline primitives; cards/badge spam; duplicate classify logic in 3 places |

### Absolute non-goals

- Signed reconciliation workspace / LG-1 / FR-40 UI → **6.4**
- Governed export / reauth / custody / formula-safe download → **6.5**
- Changing cutover TX shape, SoD keys, staging schema, advisory locks, or evidence DDL (unless a trivial read-only DTO field for display is required — prefer existing evidence fields)
- Implementing PE projector application of `BaselineRecorded` → Employment/Assignment (if still missing, **document** as known gap / defer — do **not** silently invent full employment bootstrap in this UX story unless already required for timeline honesty; cutover append already landed in 6.2)
- PopulationPort **full** default-registry cutover; AD-6 Prisma↔PoolClient orphan hardening; `ensure*Schema` migrations-only
- Person-org IDOR on Cancel/Reverse/Correct (unless touching those writers — should not)
- Deduplicate Add vs QuickCreate; logout → `requestNavigation`
- Editing `navigation.ts` ROLE matrices “for cleanliness”
- Vitest mandate as new standard (selfcheck scripts remain the house pattern)

### UPDATE files — current state → this story → preserve

| File | Current (post-6.2) | Change | Preserve |
| --- | --- | --- | --- |
| `apps/web/lib/personnel-event-timeline.ts` | `formatProvenanceCaption` → `منبع: {source}`; no `BaselineRecorded` label | Distinct origin captions + Baseline display label | Sort contract; empty/truncation copy; form `EVENT_TYPE_OPTIONS` unchanged |
| `apps/web/components/personnel/event-timeline-row.tsx` | Renders generic provenance caption | Consume new captions / optional origin affordance | StatusBadge; Jalali; lifecycle controls; UX-DR9 row shape |
| `apps/web/lib/operational-copy.ts` | Import/execute strings; no FR-39 boundary block | Add wizard-result / boundary honesty strings | No ceremonial success; UX-DR24 voice |
| `apps/web/components/import/import-wizard.tsx` | Success shows evidence counts | Add FR-39 boundary + metadata-not-control lines | SoD/execute/leave-guard; SensitiveConfirmationDialog; Sheet depth |
| `packages/modules/person-employment/src/errors.ts` (+ `buildBaselineDisclosure`) | FR-26 disclosure messages | Align wording with FR-39 if needed | Fail-closed unset/invalid env; no default epoch |
| `apps/web/components/personnel/person-profile-view.tsx` | Shows disclosure when limited/unconfigured | May also state boundary when Baseline present / within | Permission-filtered sections; viewSemantics badges |
| `packages/modules/migration/src/execute-batch.ts` | Writes provenance already | **Prefer no behavioral change**; comment-only OK | Atomic TX; Effective status; evidence |
| NEW helper under migration or PE | Absent | classify/caption pure helpers | Single published home |

### Consumer / provenance contract (encode — do not rediscover)

1. **Pipeline remains:** 6.1 preview → 6.2 approve/staging/cutover → **6.3** presentation of Baseline vs native vs imported + boundary copy → 6.4 reconcile → 6.5 export.
2. **AD-4:** First production event per **migrated-new** Person = approved `BaselineRecorded`. `provenance.source = "migration"` is metadata for audit only, **not** the cutover mechanism.
3. **Origin taxonomy (product):**
   - **Baseline** = event type `BaselineRecorded` (approved migrated starting state).
   - **Imported** = other events carrying migration provenance (may be rare/absent at launch — still classify correctly).
   - **Native** = Personnel Events without migration provenance (including ordinary lifecycle).
4. **“Where applicable”:** New Person created at cutover → Baseline is first production event. Matched existing Person may already have native history — UI must not claim Baseline was chronologically first.
5. **FR-26 vs FR-39:** Env `DIVAN_BASELINE_BOUNDARY_DATE` = org-level as-of limitation disclosure. FR-39 adds Person-history distinguishability + explicit reconstructable-history boundary statement. Do not collapse one into the other without honesty.
6. **Authz reveal:** authorize → PopulationPort → access event → filtered DTO. Captions operate on already-authorized event list fields only.
7. **Glossary:** Baseline = approved migrated state at the start of reliable reconstructable history (خط مبنا).

### AR-MIGRATION / AR-TEMPORAL honesty

- `launch-artifacts.md`: **AR-MIGRATION** and **AR-CUTOVER** pending; AR-TEMPORAL partial freeze (pre-Baseline native requires Override + warning + audit).
- Epic 5 open action: keep AR-MIGRATION / AR-ACCESS / AR-DATA / AR-REPORTING / AR-TEMPORAL **fail-closed** in Epic 6.
- Allowed: Persian labels, disclosure copy, classification helpers, timeline/profile/wizard presentation.
- Forbidden: claiming signed freeze; inventing Baseline revision alternate path UI as “approved policy”; inventing reconciliation tolerances.

### Known gaps to document (do not silently “fix” as done)

| Gap | Handling in 6.3 |
| --- | --- |
| AD-6: `createPerson` outside event-store TX → possible Person orphan on abort | Absolute non-goal; honesty in Dev Agent Record if observed |
| No PE projector `case` applying `BaselineRecorded` to Employment/Assignment | Out of scope unless blocking timeline **display** of the event itself (list already returns store rows). If projectors missing, do not invent full employment bootstrap here — note for follow-up |
| Org Baseline env vs per-Person Baseline Effective Date | Present both honestly; do not auto-sync env from cutover |
| PopulationPort still fixture-default possible | Preserve honesty fields; no false production claim |

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Existing monorepo | Node 22 / TS 5.x / pnpm — no new framework |
| `@divan/event-store` | Read-only consume of `provenance` / `eventType` already on list DTOs — no schema migration required for FR-39 UX |
| PostgreSQL JSONB provenance | Already on `kernel_events`; treat as immutable audit metadata (append-only — never UPDATE historical provenance for “prettier UI”) |
| tRPC / governedProcedure | Only if new read DTO fields needed; prefer client-side classify from existing list payload |
| Selfcheck (`tsx` scripts) | House pattern — extend timeline + domain helpers |
| No new Excel/parser deps | Cutover/parser unchanged |

### File structure requirements

```text
packages/modules/migration/src/   # OR person-employment — one home only
  event-origin.ts / migration-provenance.ts   # NEW pure helpers
  index.ts                                    # UPDATE exports
  *.selfcheck.ts                              # UPDATE or NEW

apps/web/lib/
  personnel-event-timeline.ts                 # UPDATE labels + captions
  personnel-event-timeline.selfcheck.ts       # UPDATE
  operational-copy.ts                         # UPDATE FR-39 strings

apps/web/components/personnel/
  event-timeline-row.tsx                      # UPDATE
  person-profile-view.tsx                     # UPDATE if boundary statement lives here

apps/web/components/import/
  import-wizard.tsx                           # UPDATE success honesty

packages/modules/person-employment/src/
  errors.ts / current-person-state.ts         # UPDATE disclosure copy only if needed
```

### Testing requirements

- Unit/selfcheck: `classifyEventOrigin` matrix (BaselineRecorded+migration → baseline; other+migration → imported; no source → native; lifecycle cancel sources → native).
- Caption selfcheck: Baseline Persian ≠ native; must not equal sole `منبع: migration` for Baseline case.
- Regression: import-batch selfcheck still proves cutover append + zero-trace failure path.
- Interactive a11y if timeline/profile copy changes: text remains readable at 200% zoom; no information only in color; `role="alert"` retained for limited disclosure.

### Previous story intelligence (6.2)

- Domain-in-`@divan/migration` + thin web paid off — keep helpers out of fat React files when reusable.
- Cutover already writes:
  ```ts
  eventType: "BaselineRecorded"
  status: "Effective"  // event-store has no Finalized token
  provenance: { source: "migration", batchId, previewBatchId, templateKey, sourceRow }
  ```
- Absolute non-goal from 6.2: “Baseline provenance UI / reconstructable-history boundary copy → **6.3**” — this story closes that deferral only.
- Review decisions to preserve: upload≠approve segregation; failed batch drops staging; AD-6 orphan honesty; BOM-safe yaml.
- Do not reopen SoD/mutex/evidence design unless a display bug requires a read field already on evidence.

### Previous story intelligence (6.1 / 5.3)

- Timeline UX-DR9: type, Jalali Effective Date, actor/time, StatusBadge, provenance, chain links.
- `formatProvenanceCaption` was FR-34 MVP — 6.3 upgrades distinguishability without becoming a debug inspector.
- Leave-guard / Sheet / operational-copy patterns: reuse, do not fork.

### Git intelligence summary

- Recent: `783dca6` story 6.2 → `7472f44` story 6.1 → Epic 5 retro/stories.
- 6.2 touch surface: `packages/modules/migration/**`, `013_migration_staging.sql`, `apps/web` import wizard + migration router, reporting evidence path.
- 6.3 expected touch surface: timeline helpers/row, operational-copy, import success panel, small provenance helper module, disclosure copy — **not** another staging migration.

### Latest tech information

- Event-store provenance belongs in **metadata** (JSONB), separate from domain payload semantics — Divan already stores `provenance` on business events; keep UI as a **read model over immutable metadata**, never rewrite history for labels.
- Prefer pure classification on read; upcasting/rewriting stored events is forbidden (append-only).
- No new DB extension or ORM required for this story.

### Project context reference

- No `project-context.md` in repo at story creation; follow ARCHITECTURE-SPINE **AD-4**, epics Story 6.3 AC, PRD FR-39 (+ FR-18/FR-26 adjacency), Story 6.2 handoff Absolute non-goals, Epic 5 AR fail-closed action.
- Operator UI Persian; code/docs English per BMM config.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6 / Story 6.3]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-39, FR-18, FR-26, Glossary Baseline, UJ-4]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-4]
- [Source: `_bmad-output/specs/spec-divan/launch-artifacts.md` — AR-MIGRATION / AR-TEMPORAL pending]
- [Source: `_bmad-output/implementation-artifacts/6-2-atomic-import-batch-execution-staging-cutover.md` — BaselineRecorded handoff, Absolute non-goals]
- [Source: `_bmad-output/implementation-artifacts/6-1-controlled-import-wizard-with-preview.md` — wizard substrate]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — FR-39 provenance UI open]
- [Source: `packages/modules/migration/src/execute-batch.ts` — provenance shape]
- [Source: `apps/web/lib/personnel-event-timeline.ts` — `formatProvenanceCaption`]
- [Source: `packages/modules/person-employment/src/baseline-boundary.ts` / `current-person-state.ts` — FR-26 disclosure]
- [Source: UX EXPERIENCE — personnel-event-timeline provenance; UX-DR9 / UX-DR24]

### Epic 5 / 6.2 carry-ins (encode in implementation)

| Item | Handling in 6.3 |
| --- | --- |
| FR-39 provenance UX deferred from 6.1/6.2 | This story — Tasks 1–3 |
| `source=migration` metadata ≠ control | AC #3 + Gate + wizard honesty |
| AR fail-closed | AC #7 + Gate |
| Import Batch report never fabricate | Non-goal preserve (Task 4) |
| Artifact reauth / export | Non-goal → 6.5 |
| FR-40 reconciliation UI | Non-goal → 6.4 |
| AD-6 / PopulationPort full cutover | Non-goal; honesty only |
| BOM-safe sprint-status | Task 5 DoD |

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- `selfcheck:import-batch` could not connect to Postgres (`ECONNREFUSED :5433`) in this environment; cutover control plane was not behaviorally changed (comment-only near provenance write). Pure selfchecks + typecheck/eslint green.

### Completion Notes List

- Published `@divan/migration` `event-origin.ts`: `isMigrationProvenance`, `classifyEventOrigin`, `MigrationProvenance` alias; moved `BASELINE_RECORDED_EVENT_TYPE` here to keep helpers free of execute-batch I/O graph.
- Timeline: Baseline display label (not in form options); distinct Persian origin captions (خط مبنا / وارداتی / بومی) with truncated refs + Persian digits; `data-origin` on row.
- FR-39 boundary: timeline header via `resolveTimelineBoundaryStatement` (honest earlier-native qualifier); wizard post-cutover honesty lines; FR-26 disclosure strings aligned to reconstructable-history voice without inventing epoch.
- No PE projector for BaselineRecorded → Employment/Assignment (known gap; display uses store rows). AD-6 orphan path untouched.
- Preserved: SoD/cutover gating not keyed on provenance; no FR-40/6.5 work; thin web.

### File List

- packages/modules/migration/src/event-origin.ts (new)
- packages/modules/migration/src/event-origin.selfcheck.ts (new)
- packages/modules/migration/src/index.ts
- packages/modules/migration/src/execute-batch.ts
- packages/modules/migration/package.json
- packages/modules/person-employment/src/errors.ts
- apps/web/lib/personnel-event-timeline.ts
- apps/web/lib/personnel-event-timeline.selfcheck.ts
- apps/web/lib/operational-copy.ts
- apps/web/components/personnel/event-timeline-row.tsx
- apps/web/components/personnel/personnel-event-timeline.tsx
- apps/web/components/import/import-wizard.tsx
- _bmad-output/implementation-artifacts/6-3-baseline-provenance-reconstructable-history-boundary.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Review Findings

- [x] [Review][Decision] Same-day Effective Date vs registration order for boundary honesty — resolved: Effective Date–only (`<`); same-day `registeredAt` order does not change boundary claim
- [x] [Review][Patch] Paginated timeline can falsely claim reconstructable history starts at Baseline [`apps/web/components/personnel/personnel-event-timeline.tsx`] — fixed via `historyMayBeIncomplete`
- [x] [Review][Patch] Earlier imported (non-Baseline) events trigger “بومی” honesty copy [`apps/web/lib/personnel-event-timeline.ts`] — copy generalized to «رویدادهای پیشین»
- [x] [Review][Patch] Native events with empty provenance lack verbal Persian origin caption [`apps/web/lib/personnel-event-timeline.ts`] — always emit native origin when `eventType` known
- [x] [Review][Patch] Selfchecks miss pagination/incomplete-window honesty, empty-provenance native caption, and earlier-imported boundary paths [`apps/web/lib/personnel-event-timeline.selfcheck.ts`] — covered
- [x] [Review][Defer] FR-26 `WITHIN` disclosure string updated but profile/as-of UI still only surfaces limited/unconfigured [`apps/web/components/personnel/person-profile-view.tsx:251`] — deferred, pre-existing
- [x] [Review][Defer] Boundary date compare assumes well-formed Effective Date strings; empty/non-ISO not validated in new helper [`apps/web/lib/personnel-event-timeline.ts:213`] — deferred, pre-existing

## Change Log

- 2026-07-26: Story context created (ready-for-dev) via bmad-create-story.
- 2026-07-26: Implemented FR-39 Baseline/imported/native distinguishability + reconstructable-history boundary copy; status → review.
- 2026-07-26: Code review findings recorded (1 decision, 4 patch, 2 defer).
- 2026-07-26: Code review patches applied; decision resolved (Effective Date–only); status → done.
