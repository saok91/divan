---
baseline_commit: c0d5291
---

# Story 11.1: Stale/Recalc Unblock & Role-Honest Next Steps

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator blocked by the stale/recalc banner,
I want the pending recalculation to complete (or a reachable next step for my role),
so that finalize and export are not stuck behind a dead-end message (FR45, NFR-3, UX-DR5).

**Story key:** `11-1-stale-recalc-unblock-role-honest-next-steps`  
**Epic:** 11 — UAT Unblock & Operational UX Hardening  
**UX contract:** `ux-divan-2026-07-31` (UX-DR5 banner stack; EXPERIENCE `stale-recalc-banner` ↔ DESIGN `{stale-banner}`)  
**Architecture:** **AD-6** async `temporal.recalculate` via pg-boss + visible pending/fail-closed gold CTAs. **FR-45** ops health without HR content. No AD-1…AD-5 / AD-7 semantics change.  
**Authorized by:** `sprint-change-proposal-2026-08-07` (approved AtA)  
**Prerequisite:** Epics 1–10 done (especially 4.4 worker, 7.2 ops health, 8.9 operational copy / banner).  
**Downstream:** Story **11.2** (finalize path) assumes recalc is not blocking the subject — clear banner / honest next step first.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Platform recalc signal | `packages/modules/person-employment/src/personnel-event-recalc.ts` (`getPlatformRecalcSignal`) | `recalculationPending` / `blockingStale` / `affectedPersonCount` from `recalculation_status` | Signal OK — UAT stuck when worker not running |
| Worker + reclaim | `workers/src/index.ts` `startWorkers` / `reclaimPendingRecalculations` | On boot: re-enqueue pending/failed → `runHistoricalRecalculation` → clear | **Document + verify** local UAT path; no product clear button |
| Banner + stack | `apps/web/components/stale-recalc-banner.tsx`, `banner-stack.tsx`, `platform-status-provider.tsx` | Poll `platformStatus.recalc` 5s; `role="alert"`; gold CTA block | Disclosure is **static** and names a non-existent IA |
| Ops health section | `operations-health-panel.tsx` `#ops-recalc`, title «بازمحاسبه» | Aggregate pending/failed/stale counts; no person rows | Real destination exists — banner does not link to it |
| Nav matrix | `packages/modules/identity-access/src/navigation.ts` `ROLE_NAV_HREFS` | Only `system_admin` → `/operations` | HR never sees «عملیات» — current copy is a dead-end for them |
| Operational copy (8.9) | `apps/web/lib/operational-copy.ts` | Banner message + disclosure; no HH:MM deadline | `staleRecalcDisclosureBody` still says «عملیات ← صف محاسبه» |
| Selfchecks | `operational-copy.selfcheck.ts`, `a11y-floor.selfcheck.ts`, `workers/src/recalc.selfcheck.ts`, `operations.selfcheck.ts` | Lock message shape / ops section id | Do **not** yet ban «صف محاسبه» or assert role-aware next step |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **«صف محاسبه» ≠ product IA** | That label **does not exist** in nav or ops chrome. Invented destination = dead-end. Prefer real section title **«بازمحاسبه»** (`opsSectionRecalc` / `#ops-recalc`). |
| **Ops health ≠ job queue UI** | `#ops-recalc` shows **counts**, not per-job list. Do **not** ship a full queue screen unless PO explicitly asks (proposal Appendix A: prefer (a)+(c)). |
| **SysAdmin next step ≠ HR next step** | SysAdmin: reachable link `/operations#ops-recalc`. HR coarse roles: wait/retry and/or contact SysAdmin — **never** point exclusively at `/operations`. |
| **Unblock worker ≠ weaken fail-closed** | Clearing pending/failed/stale via worker is correct. Do **not** stop blocking gold CTAs while blocking rows remain; do **not** SQL-clear in product code as the happy path. |
| **Banner disclosure ≠ toast** | Staleness stays on BannerStack (`FEEDBACK.md` / 8.9). No second toast/banner channel. |
| **Finalize gate honesty ≠ this story** | Capacity / override / which-gate-failed copy is **11.2**. This story only ensures recalc can finish and next-step copy is reachable. |
| **FR-45 ops without HR rows** | Any in-product status for non-admin must **not** expose person IDs / HR content. Aggregate or “still calculating” only. |
| **LG-complete honesty** | Epic 11 UAT unblock ≠ claiming LG-complete while Epic 7–10 production-honesty carry-ins remain open. |

## Acceptance Criteria

1. **Given** persons in `recalculation_status` with pending/failed/stale  
   **When** the `@divan/workers` process is running against the **same** `DATABASE_URL` as the web app  
   **Then** jobs on `temporal.recalculate` are processed and the platform banner clears when no blocking rows remain  
   **And** worker startup reclaim of orphan pending/failed rows remains the documented local UAT recovery (`pnpm --filter @divan/workers start`)

2. **And** stale disclosure copy **never invents** a destination named «صف محاسبه» (and never «عملیات ← صف محاسبه»)

3. **And** for `system_admin`, the next step points at the real ops health section **«بازمحاسبه»** via live deep-link `/operations#ops-recalc` (or an explicitly shipped queue UI — **out of default scope**; only if PO requires)

4. **And** for HR coarse roles (`hr_operator`, `hr_admin`, `manager`) — and any authenticated role **without** `/operations` nav — the next step is reachable **without** requiring `/operations`: wait/retry guidance and/or contact SysAdmin / in-product status that exposes **no** HR person rows

5. **And** Epic Gate encodes held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - `pnpm --filter @divan/web selfcheck:operational-copy` green (extended for this story)
   - First-touch: if ops panel / banner chrome is edited for CTA, use existing patterns (`Button`/`Link`, FeedbackMessage only if new error surfaces — banner itself stays alert region)
   - AR-\* fail-closed; no freeze-number invention; no LG-complete claim
   - UTF-8 **without BOM** on `sprint-status.yaml` edits
   - Must **not** widen `ROLE_NAV_HREFS` so HR can open `/operations`
   - Must **not** reopen Epics 1–10 status churn

6. **And** scope boundaries:
   - Does **not** change finalize capacity/override gate logic (Story 11.2)
   - Does **not** invent a parallel SoT for recalc status outside `recalculation_status` / `getPlatformRecalcSignal`
   - Does **not** expose person-level rows on ops health to satisfy “queue” curiosity
   - Does **not** replace AD-6 / pg-boss with a new queue product
   - Does **not** dismiss blocking banner while pending/failed/stale rows exist
   - Does **not** reintroduce `stalePendingUntil` as a UI deadline

## Tasks / Subtasks

- [x] Task 1: Diagnose UAT stuck-recalc path (AC: #1)
  - [x] Confirm local/dev: web enqueue port vs worker process — if only web runs, `markRecalculationPending` leaves rows and banner stays (expected)
  - [x] Document in story File List / ops note (and short in-repo pointer if missing): same `DATABASE_URL`, `pnpm --filter @divan/workers start`, reclaim log line `[workers] reclaimed N pending/failed/stale recalc job(s)`
  - [x] Manual: force ≥1 pending row → start worker → banner clears after poll (do **not** add emergency SQL clear as product UI)
  - [x] If reclaim/listPending misses `stale` status rows that should re-run, fix domain list/reclaim consistently with `getPlatformRecalcSignal` blocking set — **prefer** worker path over silent SQL

- [x] Task 2: Role-honest disclosure copy (AC: #2, #3, #4)
  - [x] UPDATE `apps/web/lib/operational-copy.ts`:
    - Remove «صف محاسبه» / «عملیات ← صف محاسبه» from all stale disclosure strings
    - Prefer split keys, e.g. `staleRecalcDisclosureBodySysAdmin` + `staleRecalcDisclosureBodyNonOps` (or one helper `staleRecalcDisclosureBody(role)`) — keep 8.9 tone: fact + wait expectation + reachable next step
    - SysAdmin body: name **«بازمحاسبه»** and that ops health shows queue depth (counts)
    - Non-ops body: wait/retry; if prolonged → تماس با SysAdmin (or equivalent plain Persian) — **no** invented menu path
  - [x] Optionally align `operationsSurfacePurpose` if it still implies a literal «صف بازمحاسبه» product name beyond the real section — keep FR-45 honesty; do not invent queue UI

- [x] Task 3: Banner next-step UI (AC: #3, #4)
  - [x] UPDATE `apps/web/components/stale-recalc-banner.tsx`:
    - Read `coarseRole` via `useSession()` (same pattern as `operations-health-panel.tsx`)
    - Render role-specific disclosure body
    - For `system_admin`: include a real `Link` (or Button-as-link) to `/operations#ops-recalc` — **live**, not decorative
    - For non-ops roles: text-only reachable next step (no link to `/operations`)
    - Preserve: `role="alert"`, `aria-live="assertive"`, `data-banner="stale-recalc"`, `<details>` disclosure, hide when inactive, **never** render `stalePendingUntil`
  - [x] Preserve gold CTA blocking via existing `isGoldCtaBlocked` / `useStaleBlocking` — no behavioral weaken

- [x] Task 4: Ops deep-link / hash honesty (AC: #3)
  - [x] Verify `#ops-recalc` scrolls/focuses the section on `/operations` (already `id="ops-recalc"` on `HealthSection`). If hash navigation is unreliable in App Router, add minimal client scroll-into-view on mount when hash matches — **no** new route
  - [x] Do **not** rename section away from `opsSectionRecalc` («بازمحاسبه») without PO

- [x] Task 5: Selfchecks + design-qa (AC: #2, #5)
  - [x] UPDATE `apps/web/lib/operational-copy.selfcheck.ts`:
    - Assert disclosure strings **do not** contain `صف محاسبه`
    - Assert SysAdmin path mentions `بازمحاسبه` and `/operations#ops-recalc` (string or banner source)
    - Assert non-ops path does **not** require `/operations` as the only next step
    - Keep existing no-HH:MM / unknown-scope / details assertions
  - [x] UPDATE `a11y-floor.selfcheck.ts` if it hard-codes old disclosure body
  - [x] UPDATE `no-dead-end-ia.selfcheck.ts` if linking ops from banner — ensure catalog/nav consistency for SysAdmin only
  - [x] `pnpm --filter @divan/web selfcheck:operational-copy` + `selfcheck:design-qa` green
  - [x] Workers: existing `pnpm --filter @divan/workers` recalc selfcheck still green if touched

- [x] Task 6: DoD alignment (AC: #1–#6)
  - [x] Typecheck touched packages
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; YAML UTF-8 without BOM
  - [x] Manual DoD below

### Manual DoD checklist

- [x] With worker **stopped**, finalize/lifecycle that marks pending leaves banner active (fail-closed gold CTAs still blocked)
- [x] `pnpm --filter @divan/workers start` on same DB → pending/failed reclaim → banner clears when no blocking rows
- [x] As **sys.admin**: open disclosure → see «بازمحاسبه» + working link to `/operations#ops-recalc` (section visible; counts, not person list)
- [x] As **hr_operator** (or hr_admin): disclosure has **no** «صف محاسبه» and **no** sole instruction to open «عملیات»; wait/contact SysAdmin (or equivalent) is clear
- [x] Grep/selfcheck: zero `صف محاسبه` in stale disclosure paths
- [x] Banner still `role="alert"`; no toast duplicate; no deadline clock
- [x] HR still cannot open `/operations` via nav (`navigation.selfcheck` / page gate)
- [x] `selfcheck:design-qa` + `selfcheck:operational-copy` green
- [x] No LG-complete / AD-1…AD-7 semantic claims; Epics 1–10 remain `done`

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Worker path clears blocking rows on same DB | Product SQL-clear as happy path / fake “success” |
| Ban invented «صف محاسبه» destination | Point HR at SysAdmin-only `/operations` as only next step |
| SysAdmin live link `/operations#ops-recalc` («بازمحاسبه») | Decorative link / wrong hash / job-queue rename without PO |
| Role-aware disclosure via `coarseRole` | One static dead-end string for all roles |
| Keep `isGoldCtaBlocked` while pending/failed/stale | Dismissible blocking banner / toast substitute |
| FR-45: ops counts only, no HR person rows | Person list on ops “to unblock UAT” |
| `selfcheck:operational-copy` + `design-qa` green | Widen `ROLE_NAV_HREFS` for HR→ops |
| Prefer proposal (a)+(c) | Full queue UI (b) unless PO asks |

### Epic 11 / prior carry-ins in force

- Authorized by `sprint-change-proposal-2026-08-07` — do not reopen Epics 1–10
- Epic 10 open items (FeedbackMessage long-tail, typography, batched identity, PE/HC bulk honesty, settings cache, binder parity, AR fail-closed, production-honesty carry-forward) — **encode, do not resolve** unless blocking this story
- Epic 8.9 banner contract remains SoT for message shape (N افراد, توضیح بیشتر, no deadline)
- Epic 7.2 ops health remains SoT for `#ops-recalc`
- Downstream 11.2 owns finalize capacity/override honesty

### UPDATE files — current → change → preserve

#### `apps/web/lib/operational-copy.ts`

- **Current:** `staleRecalcDisclosureBody` = wait + «اگر بیش از ۱۵ دقیقه طول کشید، از «عملیات ← صف محاسبه» وضعیت را ببینید.»
- **Change:** Role-split (or helper) bodies; ban «صف محاسبه»; SysAdmin names «بازمحاسبه»; HR wait/contact.
- **Preserve:** `staleRecalcMessage`, unknown-scope, gold CTA hint, ops section title `opsSectionRecalc`, 8.9 no-deadline rule.

#### `apps/web/components/stale-recalc-banner.tsx`

- **Current:** Static disclosure paragraph; no session; no Link.
- **Change:** `useSession` → role-aware body + SysAdmin deep-link.
- **Preserve:** alert live region, details/summary, `data-banner`, hide when inactive, message from `staleRecalcMessage(N)`.

#### `apps/web/components/platform-status-provider.tsx` / `platform-status.ts`

- **Current:** Poll + fail-closed null count → unknown scope; `isGoldCtaBlocked`.
- **Change:** None expected unless bug found in signal wiring.
- **Preserve:** fail-closed on DB error; 5s poll; gold block semantics.

#### `apps/web/components/operations/operations-health-panel.tsx`

- **Current:** `id="ops-recalc"`, title from `opsSectionRecalc`.
- **Change:** Only if hash scroll-into-view needed.
- **Preserve:** Aggregate-only recalc section; no person rows; FeedbackMessage patterns already on panel errors.

#### `workers/src/index.ts`

- **Current:** `reclaimPendingRecalculations` on start; `temporal.recalculate` work handler.
- **Change:** Only if reclaim set incomplete vs blocking statuses; else document-only.
- **Preserve:** singletonKey per person+generation; `WORKERS_STUB = false`; graceful stop.

#### Selfchecks (`operational-copy.selfcheck.ts`, possibly `a11y-floor`, `no-dead-end-ia`)

- **Current:** Asserts ۱۵ دقیقه + details; does **not** ban «صف محاسبه».
- **Change:** Ban invented destination; assert role-aware / deep-link presence in source.
- **Preserve:** HH:MM ban; unknown scope; banner does not render `stalePendingUntil`.

### Algorithm (implement literally)

```
1. UAT unblock (ops):
   - Ensure @divan/workers runs with same DATABASE_URL as web
   - On startWorkers: reclaimPendingRecalculations → send temporal.recalculate
   - Handler: runHistoricalRecalculation → clearRecalculationStatus on success
   - Web provider poll: when no pending|failed|stale → banner inactive + gold CTAs unblocked

2. Disclosure (product):
   - If coarseRole === system_admin:
       body mentions «بازمحاسبه» + Link href="/operations#ops-recalc"
   - Else (no /operations in ROLE_NAV_HREFS):
       body = wait/retry + contact SysAdmin (or status without ops nav)
       MUST NOT say «صف محاسبه» or imply opening «عملیات»
   - Never present stalePendingUntil as deadline

3. PO default:
   - Ship (a) relabel/deep-link + (c) role-aware copy
   - Do NOT ship (b) full job-level queue UI unless explicitly requested
```

### Architecture compliance

- **AD-6:** Critical mutations stay sync in TX; heavy historical recalc stays async pg-boss `temporal.recalculate` with visible pending. [Source: `ARCHITECTURE-SPINE.md` AD-6]
- **FR-45 / NFR-3:** Stale/failed derived state visible; cannot masquerade as truth; ops without routine HR content. [Source: `prd.md` FR-45, NFR-3]
- **Sprint change:** Role-reachable next steps; ops health ≠ HR-facing queue. [Source: `sprint-change-proposal-2026-08-07.md` §§4.2–4.5, Appendix A]
- **UX-DR5:** Non-dismissible blocking stale banner above break-glass; disable gold CTAs when stale/recalc pending. [Source: `epics.md` UX-DR5]

### Library / framework requirements

| Tech | Version / note | Use |
| --- | --- | --- |
| Next.js App Router | existing monorepo | Banner client component; `Link` for deep-link |
| next-auth `useSession` | existing | `session.user.coarseRole` |
| pg-boss | 12.x (architecture pin) | Already in `@divan/workers` — do not swap libraries |
| tRPC `platformStatus.recalc` | existing `protectedProcedure` | Keep banner signal for all authenticated users |
| Persian copy | `operational-copy.ts` only | No new i18n framework |

**pg-boss note (latest practice):** Queue must be `createQueue` before work/send (already done). Domain reclaim of `recalculation_status` pending/failed is the product recovery path — complementary to pg-boss `retry()` on failed **queue** jobs; prefer existing reclaim, do not invent a second recovery UI.

### File structure requirements

| Path | Action |
| --- | --- |
| `apps/web/lib/operational-copy.ts` | UPDATE |
| `apps/web/lib/operational-copy.selfcheck.ts` | UPDATE |
| `apps/web/components/stale-recalc-banner.tsx` | UPDATE |
| `apps/web/components/operations/operations-health-panel.tsx` | UPDATE only if hash scroll needed |
| `apps/web/lib/a11y-floor.selfcheck.ts` | UPDATE if hard-coded old body |
| `workers/src/index.ts` | UPDATE only if reclaim gap |
| `packages/modules/person-employment/src/personnel-event-recalc.ts` | UPDATE only if listPending/status set incomplete |
| Root / workers package README or `apps/web` ops comment | NEW/UPDATE short UAT start note if nowhere documented |

Do **not** create a new settings/ops package or parallel banner component.

### Testing requirements

| Check | Command / method |
| --- | --- |
| Operational copy | `pnpm --filter @divan/web selfcheck:operational-copy` |
| Design QA | `pnpm --filter @divan/web selfcheck:design-qa` |
| A11y floor (if touched) | package script / existing selfcheck |
| Workers recalc | `pnpm --filter @divan/workers` recalc selfcheck (existing) |
| Nav gate | existing `navigation.selfcheck` — HR denied `/operations` |
| Manual | Manual DoD checklist above |

Prefer source-level selfchecks when ephemeral DB unavailable (Epic 10 pattern).

### Previous story intelligence

- **10.5 / Epic 10:** Gate pattern (design-qa, FeedbackMessage on touched panels, AR fail-closed, no LG-complete, BOM-safe yaml). Settings closed — unrelated domain; reuse structure only.
- **8.9:** Established banner message + disclosure + no deadline; **left** dead-end ops copy that this story fixes.
- **7.2:** Ops health `#ops-recalc` / «بازمحاسبه» is the real SysAdmin destination.
- **4.4:** Worker + reclaim already implemented — UAT failure mode is usually “worker not running”, not missing code.
- **Proposal Appendix A:** Exact diagnosis of invisible «صف محاسبه»; fix prefer (a)+(c).

### Git intelligence summary

Recent commits: `c0d5291` chore post epic 10; `01acaa9` epic 10 retro; `73736de` story 10.5; … epic 10 settings track. Baseline for this story: **`c0d5291`**. No Epic 11 code yet — first story on new track.

### Latest tech information

- pg-boss 12: explicit `createQueue`; failed job `retry()` exists but Divan’s durable truth for “who still needs recalc” is `recalculation_status` + `reclaimPendingRecalculations` — keep that as UAT recovery.
- Do not upgrade pg-boss mid-story unless blocked; stay on architecture-pinned 12.x.

### Project context reference

- No `project-context.md` found in repo at create time — follow this story + `ARCHITECTURE-SPINE.md` + existing web/workers patterns.
- Communication with stakeholders: Persian UI strings; story file English.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 11 / Story 11.1]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md` — §§1, 4.5, Appendix A]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-45, NFR-3]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-6]
- [Source: `apps/web/lib/operational-copy.ts` — stale disclosure]
- [Source: `apps/web/components/stale-recalc-banner.tsx`]
- [Source: `workers/src/index.ts` — reclaim + work]
- [Source: `packages/modules/identity-access/src/navigation.ts` — ROLE_NAV_HREFS]
- [Source: `_bmad-output/implementation-artifacts/8-9-self-explaining-state-operational-copy.md` — banner contract]
- [Source: `_bmad-output/implementation-artifacts/10-5-configuration-change-control-evidence.md` — story structure / Gate]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Diagnosed UAT stuck path: web marks `recalculation_status` pending; banner clears only when `@divan/workers` processes same `DATABASE_URL`.
- Gap: `listPendingRecalculationJobs` omitted `stale` while `getPlatformRecalcSignal` blocks on pending|failed|stale — fixed to align reclaim set.
- Selfchecks: `selfcheck:operational-copy`, `selfcheck:operations`, `selfcheck:a11y-floor`, `selfcheck:design-qa`, `selfcheck:no-dead-end-ia`, `navigation.selfcheck`, `workers selfcheck:recalc`, `person-employment selfcheck:personnel-event-recalc` — all green.
- Typecheck: `@divan/web`, `@divan/workers` green.

### Completion Notes List

- Extended worker reclaim to include `stale` rows (matches platform blocking signal).
- Documented local UAT worker start in root `README.md` (same `DATABASE_URL`, reclaim log).
- Split stale disclosure copy: SysAdmin → «بازمحاسبه» + live `/operations#ops-recalc` link; non-ops → wait/retry + contact SysAdmin (no «صف محاسبه», no `/operations`).
- Ops health: `id="ops-recalc"` on section + hash `scrollIntoView`/`focus` for App Router deep-links.
- Preserved fail-closed gold CTA blocking; did not widen `ROLE_NAV_HREFS`; no queue UI; no LG-complete claim.

### File List

- `README.md`
- `apps/web/lib/operational-copy.ts`
- `apps/web/lib/operational-copy.selfcheck.ts`
- `apps/web/components/stale-recalc-banner.tsx`
- `apps/web/components/operations/operations-health-panel.tsx`
- `apps/web/src/server/operations.selfcheck.ts`
- `packages/modules/person-employment/src/personnel-event-recalc.ts`
- `packages/modules/person-employment/src/personnel-event-recalc.selfcheck.ts`
- `workers/src/index.ts`
- `_bmad-output/implementation-artifacts/11-1-stale-recalc-unblock-role-honest-next-steps.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] Hash scroll ignores same-page / hashchange — `useOpsHashScroll` only depends on `ready`; clicking `/operations#ops-recalc` while already on ops does not re-scroll/focus [`apps/web/components/operations/operations-health-panel.tsx:165`]
- [x] [Review][Patch] Session-loading role flash — while `useSession` is loading, SysAdmin briefly gets non-ops disclosure and no deep-link [`apps/web/components/stale-recalc-banner.tsx:26`]
- [x] [Review][Patch] SysAdmin deep-link bypasses leave-guard — bare `Link` instead of `requestNavigation` pattern used elsewhere [`apps/web/components/stale-recalc-banner.tsx:53`]
- [x] [Review][Patch] Hash focus has no visible indicator — `outline-none` on focused section hides keyboard/AT focus ring [`apps/web/components/operations/operations-health-panel.tsx:96`]
- [x] [Review][Patch] Docs overstate reclaim → banner clear — reclaim only re-enqueues; clear happens after successful job [`README.md` / `workers/src/index.ts`]
- [x] [Review][Patch] Dual SysAdmin predicate can drift — helper vs separate `isSysAdmin` check; tighten to one source [`apps/web/components/stale-recalc-banner.tsx:31`]
- [x] [Review][Patch] Helper takes bare `string` — type `coarseRole` as `CoarseRole` [`apps/web/lib/operational-copy.ts:888`]
- [x] [Review][Defer] Reclaim log only when N>0 — deferred, pre-existing [`workers/src/index.ts:83`]
- [x] [Review][Defer] No behavioral selfcheck for stale→reclaim→clear — deferred, source gate + manual DoD covered [`personnel-event-recalc.selfcheck.ts`]
- [x] [Review][Defer] `reenqueuePendingRecalculationIfNeeded` stale branch not source-locked — deferred, list SQL gate only [`personnel-event-recalc.selfcheck.ts`]

### Change Log

- 2026-08-07: Story 11.1 — stale reclaim includes `stale`; role-honest banner disclosure + SysAdmin deep-link; ops hash scroll; selfchecks/design-qa green.
- 2026-08-07: Code review patches — hashchange scroll, session-loading disclosure, leave-guard deep-link, focus ring, reclaim docs honesty, `isStaleRecalcOpsRole`.