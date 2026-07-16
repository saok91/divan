---
baseline_commit: eab2442
---

# Story 2.7: Inference-Resistant & Bulk Retrieval Controls

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Privacy / Security owner,
I want small-cohort, differencing, and bulk retrieval controls across UI and export,
so that screens and files cannot be used as independent exfiltration paths (FR48).

## Gate (read first)

**AR-ACCESS and AR-REPORTING remain `pending` for production threshold numbers, sequential-query acceptance fixtures, and full toxic/bulk policy catalogs.** Exact cohort/volume/window values **MUST NOT** be invented as launch baselines. This story ships a **real shared inference + bulk control plane** — configurable hooks, enforcement after population intersection, uniform safe treatment, bulk/sensitive approval gates, attributable access events with volume/outcome, and selfcheck oracles — not Epic 5 dashboards/reports or Story 6.5 export artifact panels.

- Do **not** invent production AR-ACCESS/AR-REPORTING threshold matrices or claim Launch Artifact freeze.
- Do **not** implement full personnel search/profile/dashboard/report catalogue UI (Epic 5), full export/custody panel (6.5), audit investigation UI (7.1), or real Person/Org projections (Epic 3/4).
- Do **not** invent Nest/CASL/Ability/Passport, parallel Prisma audit tables, differential-privacy libraries, or a second authz stack.
- Do **not** treat suppressed cohorts as `0`, empty success that implies “none”, or client-only CSS hide — UX contract is «داده قابل نمایش نیست» (or equivalent structured deny) on **every** channel.
- Do **not** leave break-glass as an inference/bulk bypass — elevation still runs through the same control plane (2.5/2.6 deferred item closes here).
- Ship **configurable, fail-closed** hooks: `minimum_cohort_size`, volume/window, field/cumulative counters, differencing / repeated-query / comparison / drill-down protection (or approved equivalent), additional approval for sensitive/bulk retrieval.
- Reuse Stories 2.1–2.6 substrate (`governedProcedure`, `authorizeOrThrow`, PopulationPort, entitlement `kind: bulk`, break-glass limits, access events) — **extend**; do not fork.
- Until Epic 5/6 real surfaces exist, prove FR-48 with **fixture/demo governed procedures** on the same channels already stubbed in 2.6 (`search|list|count|dashboard|report|export|…`). Epic 5+ consumes the same API without rewriting policy.

[Source: `epics.md` Story 2.7; `prd.md` FR-48; `addendum.md` §8.5 / §12.3–12.4; `ARCHITECTURE-SPINE.md` AD-5; `EXPERIENCE.md` suppressed metric; Stories 2.1–2.6; `deferred-work.md`]

## Acceptance Criteria

1. **Given** AR-REPORTING/AR-ACCESS threshold hooks (exact numbers may be pending; enforcement points must exist)  
   **When** a query or export would expose a suppressed small cohort or violate volume/window/field cumulative controls  
   **Then** the channel returns the same safe treatment («داده قابل نمایش نیست» or equivalent deny) without revealing the suppressed count as 0

2. **And** sensitive/bulk access can require additional approval and always emits attributable access events with volume and outcome (no unnecessary HR value duplication)

3. **And** UI, API, search, list, count, dashboard, report, and export share the same control plane (no bypass channel)

4. **And** controls apply **after** authorized population intersection (2.6): drill-down / differencing / comparison cannot widen beyond the authorized set or reconstruct a suppressed cell via sequential queries in the demo/oracle suite

5. **And** break-glass elevation cannot bypass inference/bulk thresholds (export/admin denials from 2.5 still hold)

6. **And** Layout ≠ RSC / UI ≠ data access / default-deny / no client import of `@divan/identity-access` remain intact

## Tasks / Subtasks

- [x] Task 1: Inference + bulk policy hooks (configurable, fail-closed) (AC: #1, #3)
  - [x] Add an **InferenceBulkPort** (name flexible) owned primarily by **audit-envelope** per AD-5 (“bulk thresholds”), callable from identity-access / web after PopulationPort — prefer `packages/kernel/audit-envelope/src/inference-bulk.ts` (or sibling) with thin re-exports if needed:
    - Inputs: `channel` (reuse `RetrievalChannel` + `list` if missing), authorized subject id set (post-intersection), optional aggregate/cell key, field set, prior query fingerprints / window counters, actor id, purpose, sensitivity flags
    - Outcomes: `allow` | `suppress` (safe treatment code/copy key) | `deny` | `require_bulk_approval`
  - [x] Configurable hooks (demo defaults OK; production values = AR-* pending):
    - `minimumCohortSize` (small-cell / zero-cell)
    - `maxVolumePerRequest` / `maxVolumePerWindow` / window duration
    - `maxFieldCumulative` (sensitive field pull across window)
    - Differencing / repeated-query / comparison: fingerprint overlapping authorized sets; block when difference would isolate below cohort threshold (or documented approved equivalent)
  - [x] Missing/disabled production hooks → **fail closed** on paths that claim inference protection (demos may enable explicit DEMO hooks); do not silently allow
  - [x] Document: AR-ACCESS owns bulk/volume; AR-REPORTING owns small-cohort / sequential fixtures — code only holds hooks + demo values

- [x] Task 2: Wire shared control plane on all retrieval channels (AC: #1, #3, #4, #6)
  - [x] Pipeline (encode — do not invent alternate order):
    ```
    authorizeOrThrow (2.1–2.6)
      → PopulationPort.intersect (2.6)
      → InferenceBulkPort.evaluate (…)
      → access event { volume, outcome, … } on sensitive/bulk/suppress/deny
      → return allow payload | suppress payload | deny
    ```
  - [x] Extend demo governed procedures in `apps/web/src/server/root.ts` (and/or `trpc.ts` helpers) so **search, list, count, dashboard, report, export** (and existing profile/timeline/audit demos if present) all call the same evaluate path — no channel that returns raw `volume: subjectIds.length` without threshold check
  - [x] Suppress response shape: structured outcome (e.g. `outcome: "suppressed"` + `messageKey` / Persian «داده قابل نمایش نیست») — **never** `count: 0`, `total: 0`, or empty array that is indistinguishable from “no people matched” when the true reason is suppression (document how empty-vs-suppress is distinguished for demos)
  - [x] Drill-down from a suppressed parent: fail closed (preserve 2.6 widen deny); do not reveal underlying ids
  - [x] Keep omitUnauthorizedCategories semantics: absent keys ≠ masked 0

- [x] Task 3: Sensitive/bulk approval + break-glass non-bypass (AC: #2, #5)
  - [x] Reuse entitlement lifecycle `kind: "bulk"` (and sensitive where appropriate): retrieval/export demos that exceed bulk hooks or touch sensitive aggregates **require** an active approved/activated grant (or explicit demo co-approval flag) — independent approve already in DEFAULT_APPROVAL_KINDS
  - [x] Without required approval → deny + access event (outcome denied)
  - [x] Break-glass: privileged paths still run InferenceBulkPort; cannot return small-cohort aggregates or overrun volume windows; keep `assertBreakGlassElevationLimits` export/admin denials
  - [x] Do **not** invent a forever-live mock toggle that skips thresholds

- [x] Task 4: Access evidence with volume + outcome (AC: #2)
  - [x] Ensure sensitive/bulk/suppressed/denied retrieval demos append access events with actor, purpose, scope, **volume** (requested and/or authorized set size — document), **outcome** (`allowed` | `suppressed` | `denied` | …), channel — **no HR field values**
  - [x] Evidence failure → compensate + fail closed (existing 2.1 pattern)
  - [x] Align with FR-51 minimum baseline coverage for bulk retrieval probes (actor/purpose/scope/volume/outcome)

- [x] Task 5: UX copy + optional demo surface (AC: #1)
  - [x] Add `operationalCopy.suppressedCohort` (or equivalent) = exact «داده قابل نمایش نیست» in `apps/web/lib/operational-copy.ts`
  - [x] Optional thin demo UI on an existing route (dashboard placeholder or personnel) that renders suppress vs real count from tRPC — enough to prove cards/cells never show 0 when suppressed; full dashboard remains Epic 5
  - [x] Interactive a11y DoD if any new control: keyboard, focus ring, RTL, no emoji; suppress text is readable (not color-only)

- [x] Task 6: Fixtures, docs, deferred-work (AC: #1–#6)
  - [x] Fixture datasets: cohorts below/above threshold; sequential queries that differ by one subject; volume window overrun; field cumulative overrun; export channel parity with count/dashboard
  - [x] Update module/kernel comments or README: InferenceBulkPort contract; AR-* owns numbers
  - [x] Update `deferred-work.md`: mark 2.7 inference/bulk control-plane done; leave AR-ACCESS/AR-REPORTING production numbers, Epic 5/6 consumers, complementary secondary-suppression sophistication beyond demo equivalent if not fully automated
  - [x] `.env.example` only if new keys required — prefer code defaults + `set*ForTests` hooks

- [x] Task 7: Selfcheck + DoD (AC: #1–#6)
  - [x] Add `inference-bulk.selfcheck.ts` (prefer under audit-envelope and/or identity-access) + root script e.g. `selfcheck:inference-bulk`
  - [x] Cover Testing table below
  - [x] `pnpm` typecheck: `@divan/audit-envelope`, `@divan/identity-access`, `@divan/web` (+ lint web)
  - [x] Manual smoke: suppress ≠ 0 on demo count/dashboard/export; differencing deny/suppress; volume overrun deny; bulk without approve deny; BG cannot bypass; 2.1–2.6 selfchecks still green
  - [x] When marking done: sync story-file `Status` with `sprint-status.yaml`

### Review Findings

- [x] [Review][Decision] Cohort threshold on profile/single-subject channels — resolved: exempt `profile`/`timeline` from cohort; volume/differencing/bulk still apply. BG non-bypass proven on aggregate `count` + profile volume window.
- [x] [Review][Patch] Charge volume/field window on non-allow decisions [`packages/kernel/audit-envelope/src/inference-bulk.ts`]
- [x] [Review][Patch] Remove unreachable `secondary_suppression_sibling` branch [`packages/kernel/audit-envelope/src/inference-bulk.ts`]
- [x] [Review][Patch] `demoInferenceBulkProbe` emits access events via `runGovernedRetrieval` [`apps/web/src/server/root.ts`]
- [x] [Review][Patch] Clear `RunGovernedRetrievalResult.subjectIds` on non-allow [`apps/web/src/server/retrieval-control.ts`]
- [x] [Review][Patch] Unknown channel in `toInferenceChannel` fail-closed [`apps/web/src/server/retrieval-control.ts`]
- [x] [Review][Patch] `actorHasActiveBulkGrant` respects `expiresAt` [`apps/web/src/server/retrieval-control.ts`]
- [x] [Review][Patch] `runGovernedDrillDown` honors as-of date [`apps/web/src/server/retrieval-control.ts`]
- [x] [Review][Patch] Selfcheck oracle for drill-down / parent_suppressed + identity exempt + window charge [`packages/kernel/audit-envelope/src/inference-bulk.selfcheck.ts`]
- [x] [Review][Patch] Deduplicate authorized subject ids before cohort/volume math [`packages/kernel/audit-envelope/src/inference-bulk.ts`]
- [x] [Review][Patch] Window reset boundary off-by-one (`>=`) [`packages/kernel/audit-envelope/src/inference-bulk.ts`]
- [x] [Review][Patch] Missing `DATABASE_URL` does not reuse access-denied copy [`apps/web/src/server/retrieval-control.ts`]
- [x] [Review][Patch] Remove unused `toAccessOutcome` [`packages/kernel/audit-envelope/src/inference-bulk.ts`]
- [x] [Review][Defer] In-memory `actorWindows` not shared across processes/instances [`packages/kernel/audit-envelope/src/inference-bulk.ts`:169] — deferred, pre-existing
- [x] [Review][Defer] Concurrent same-actor evaluate races without lock [`packages/kernel/audit-envelope/src/inference-bulk.ts`:168] — deferred, pre-existing
- [x] [Review][Defer] `AUDIT_INFERENCE_BULK_ENABLED=true` loads DEMO numbers in production [`packages/kernel/audit-envelope/src/inference-bulk.ts`:181] — deferred, pre-existing
- [x] [Review][Defer] Export channel facet demos skip separate export permission (FR-3 residual) [`apps/web/src/server/root.ts`:274] — deferred, pre-existing

## Dev Notes

### Epic context

- **Epic 2:** Entitlements & Access Governance — FR2, FR3, FR4, FR46, FR47, **FR48**.
- **This story** delivers **FR-48**: jointly govern UI/API/search/list/count/dashboard/report/export as data access with inference-resistant and bulk retrieval controls (small-cohort, differencing, volume/window thresholds).
- **Upstream (done):** 2.1 envelope + governedProcedure; 2.2 sensitive categories + separate export; 2.3 access-admin; 2.4 entitlement lifecycle including `bulk` approval kind + `reauthorizeForQueuedOrArtifactWork`; 2.5 break-glass; 2.6 PopulationPort + membership + as-of + mid-session AUTHZ_CHANGED.
- **Downstream:** Epic 5 search/dashboard/report consume InferenceBulkPort; 6.5 export panel + custody ack (FR52) on top of same thresholds; AR-ACCESS/AR-REPORTING freeze production numbers before reporting architecture/feature baselines.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Production AR-ACCESS bulk thresholds / toxic catalog numbers | Launch artifacts |
| Production AR-REPORTING small-cohort numbers + sequential acceptance fixtures | Launch artifacts / before reporting feature baseline |
| Full dashboard / report catalogue / personnel search UI | Epic 5 |
| Export artifact panel, reauth-at-download, custody UX | Story 6.5 / FR41–FR52 |
| Real Person/Org PopulationPort implementation | Epic 3/4 |
| Full secondary cell-suppression table algebra for every report layout | AR-REPORTING sophistication — demo equivalent + hooks sufficient here |
| Differential privacy / noise libraries as MVP requirement | Not in architecture |
| Audit investigation UI | Story 7.1 |
| NestJS, CASL, Ability, Passport | Not in architecture |
| New Prisma audit tables / dual audit writers | AD-5 / 2.1 |
| Client import of `@divan/identity-access` | Lessons 1.5–2.6 |
| Inventing FR-45 stale-recalc as suppress UX | Separate concern |

### Architecture compliance (MUST)

| Rule | Implication |
| --- | --- |
| **AD-5** | **audit-envelope owns fine-grained bulk thresholds** + access events; identity-access owns coarse + PopulationPort; reporting later calls same APIs |
| **AD-3** | No fake HR Person tables for cohort math — fixture authorized id sets from PopulationPort |
| **FR-48** | One control plane across all channels; suppress ≠ 0; volume/window/field cumulative; sensitive/bulk may need extra approval |
| **FR-47 / 2.6** | Intersection first; drill-down no widen; inference cannot reconstruct out-of-scope |
| **FR-3 / 2.2** | Export still separate permission; suppress/export share control plane but export still needs export allow |
| **FR-46 / 2.4–2.5** | `bulk` grant kind + independent approve; BG minimal and non-bypass for inference |
| **FR-51** | Bulk retrieval audited with volume/outcome; evidence fail-safe |
| **UX-DR15 / EXPERIENCE** | «داده قابل نمایش نیست» — never 0 when suppressed; same copy on cards and cells |

[Source: `ARCHITECTURE-SPINE.md` AD-5; `prd.md` FR-48; `EXPERIENCE.md`; Stories 2.1–2.6]

### Authz model for this story

```
Retrieval (search|list|count|dashboard|report|export|…)
  → session / AUTHZ_CHANGED (2.6)
  → authorizeOrThrow (permission × category × action × scope + membership + as-of)
  → PopulationPort.intersect → authorized subjectIds
  → InferenceBulkPort.evaluate({
       channel, authorizedSet, filters/fields,
       priorQueryFingerprint?, windowCounters?,
       sensitivity, bulkApprovalPresent?
     })
       → allow | suppress(«داده قابل نمایش نیست») | deny | require_bulk_approval
  → access event { volume, outcome, channel, purpose, scope } — no HR values
```

**Critical:** Client-side filtering or “hide small numbers in React” is **not** compliance. Suppression is a **server** decision on the shared plane.

### Design decisions (encode — do not reinvent mid-impl)

1. **Hooks first, numbers later:** Demo defaults (e.g. cohort ≥ 3 or 5 for fixtures) are fine if documented as DEMO-only; production AR-* freeze is out of scope.
2. **After intersection, not instead of it:** Cohort size is computed on the **authorized** set. Out-of-scope people never enter the count used for thresholds.
3. **Suppress ≠ empty ≠ zero:** Three distinct outcomes. UX and API must not collapse suppress into `0`. Prefer explicit `outcome: "suppressed"` (+ Persian message) vs `outcome: "empty"` for true empty authorized sets.
4. **Differencing is in scope for demos:** At least one oracle where Q1 and Q2 each pass cohort size but |Q1ΔQ2| < threshold → suppress/deny. Industry note: min-group-size alone is insufficient against subtraction attacks — do not ship cohort-only and claim FR-48 complete.
5. **Secondary suppression:** Full table algebra is AR-REPORTING; for MVP demos, either (a) suppress sibling aggregates that would allow back-calculation in the fixture, or (b) fail closed the entire comparison surface — document choice.
6. **One control plane:** Count facet APIs, command-palette stubs, and export demos must call InferenceBulkPort — no “internal admin count” bypass.
7. **Bulk approval reuses lifecycle:** Prefer activated `EntitlementGrant` with `kind: "bulk"` (or documented sensitive aggregate grant) over a new parallel approval table.
8. **Break-glass non-bypass:** Close the explicit deferred item from 2.5/2.6.
9. **Volume in access events:** Record sizes/outcomes, never field values (preserve 2.1–2.6).
10. **Ownership:** Threshold evaluate in **audit-envelope**; PopulationPort stays in identity-access; web only orchestrates via governedProcedure.

### Current code to UPDATE (read before coding)

| File | Current state | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/kernel/audit-envelope/src/index.ts` | authorizeOrThrow; membership; as-of; access events | Integrate or call InferenceBulkPort; ensure volume/outcome on relevant decisions | Default-deny; MSG_ACCESS_DENIED_FA; coarseRole never allow key; read ≠ export |
| `packages/kernel/audit-envelope/src/categories.ts` | Sensitive category hooks | Optional sensitivity flags for bulk/cohort paths | Production hooks disabled by default |
| `packages/modules/identity-access/src/population-authz.ts` | Intersection + drill-down; `RetrievalChannel` | Optional `list` channel; call-site docs that inference runs after intersect | Fixture identity space; fail-closed unreconciled; no widen |
| `packages/modules/identity-access/src/entitlement-lifecycle.ts` | `bulk` in DEFAULT_APPROVAL_KINDS | Wire retrieval demos to require activated bulk/sensitive grant when hooks demand | Independent approve; TOCTOU activate |
| `packages/modules/identity-access/src/break-glass.ts` | Export/admin deny | Explicit non-bypass of inference/bulk evaluate | Elevation limits; no forever-live |
| `apps/web/src/server/trpc.ts` | governedProcedure + BG export check + AUTHZ_CHANGED | Shared helper to run intersect → inference; do not trust client threshold overrides | Meta-driven authorize; no raw client asOf trust on all routes |
| `apps/web/src/server/root.ts` | `demoScopedRetrieval` returns raw `volume: subjectIds.length` | Threshold evaluate; multi-channel demos; suppress shape; export parity | Existing 2.6 demos still pass when above thresholds |
| `apps/web/lib/operational-copy.ts` | No suppress string yet | Add «داده قابل نمایش نیست» | Exact mid-session / deny strings unchanged |
| `apps/web/lib/personnel-search.ts` | Always `[]` | Optional: when demo data exists, route through same plane later — do not invent client-side cohort math | Epic 5 owns real search |
| `packages/modules/reporting/src/index.ts` | stub `export {}` | Optional thin re-export/seam comment only — **do not** build report engine | Stub OK |
| `package.json` | selfcheck scripts through temporal-authz | Add inference-bulk selfcheck | Existing scripts |
| `_bmad-output/implementation-artifacts/deferred-work.md` | 2.7 open from 2.4–2.6 | Resolve inference/bulk control-plane items | AR-* / Epic 5/6 remain open |

### Likely NEW files

| Path | Role |
| --- | --- |
| `packages/kernel/audit-envelope/src/inference-bulk.ts` | InferenceBulkPort + configurable hooks + demo defaults |
| `packages/kernel/audit-envelope/src/inference-bulk.selfcheck.ts` **or** `packages/modules/identity-access/src/inference-bulk.selfcheck.ts` | Acceptance probes (pick one home; avoid duplicate oracles) |
| `apps/web/src/server/` demo helpers for multi-channel retrieval | Shared evaluate wrapper used by count/dashboard/report/export demos |
| Optional tiny UI snippet on dashboard/personnel placeholder | Prove suppress copy rendering |

### Previous story intelligence (2.6 — actionable)

- **Do not fork authz:** Extend envelope + PopulationPort + governedProcedure.
- **Fixture ports, not fake Person schema** — same rule for cohort fixtures (operate on authorized id sets).
- **Drill-down widen → deny** (review patch) — differencing must not reintroduce widen.
- **Clamp client scope overrides** to session membership — do not accept client-supplied `minimumCohortSize` overrides that weaken policy (server hooks only; tests may use `set*ForTests`).
- **Break-glass sticky override** still a known defer — do not make it worse; inference must still evaluate server-side even if UI banner is sticky.
- **Access events without HR values** — volume/outcome only.
- **Selfcheck pattern:** tsx + assert + `DATABASE_URL` + seed; root `pnpm selfcheck:*`; no Vitest required for this story.
- **Review class to avoid:** split-brain between envelope and population; for 2.7 also avoid split-brain between count channel and export channel treatments.
- Mid-session modal / stale-banner remain separate from suppress copy.

[Source: `2-6-temporal-cross-boundary-authorization.md` Review Findings + Dev Notes; `deferred-work.md`]

### Git intelligence

Recent commits: `eab2442` story 2.6 → `e711591` story 2.5 → `cd102fe` story 2.4 → … Follow one-commit-per-story style (`story 2.7`) when user requests commit. Baseline tip: `eab2442`.

Key 2.6 surfaces to extend: `population-authz.ts`, `audit-envelope/src/index.ts`, `apps/web/src/server/root.ts` (`demoScopedRetrieval` / `demoRetrievalDrillDown`), `trpc.ts`, entitlement `bulk` / `cross_time_scope`.

### Latest technical notes (industry + stack)

- **Small-cell / min cohort size** (commonly n≈5–11 in statistical disclosure control) stops trivial single-query isolation but **does not** stop differencing/subtraction when two large queries differ by one subject — FR-48 explicitly lists differencing / repeated-query / comparison alongside small-cohort.
- **Primary + secondary suppression:** suppressing one cell without protecting margins allows reconstruction; for flexible dashboards, prefer fail-closed sibling cells or refuse the comparison surface in demos.
- **Query history / overlap restrictions:** track prior fingerprints per actor/window in fixture memory for demos; production ownership = AR-ACCESS/AR-REPORTING.
- **Divan approach:** broker-mediated checks inside audit-envelope (AD-5) — not an external SDC product, not full differential privacy for MVP.
- Stack unchanged: Next.js App Router, tRPC 11, Prisma 7 projections, raw SQL event-store, pnpm, Node 22. Persian copy at API/UI boundary; authz evaluation stays server-side.

### Testing requirements

| Probe | Expected |
| --- | --- |
| Aggregate/count with authorized \|set\| < `minimumCohortSize` | `outcome: suppressed` + «داده قابل نمایش نیست»; **not** 0 |
| Same suppress on export demo channel | Identical safe treatment (no bypass) |
| True empty authorized intersection (no people in scope) | Distinct empty outcome — not suppress copy unless policy says otherwise; **document** |
| Differencing: Q1, Q2 each ≥ threshold but \|Δ\| < threshold | suppress or deny |
| Drill-down from suppressed parent | fail closed; no id leak |
| Volume/window cumulative overrun | deny + access event with volume/outcome |
| Field cumulative sensitive overrun | deny or require_bulk_approval |
| Bulk/sensitive path without independent approve | block |
| With activated `bulk` grant meeting hooks | allow (demo) + access event |
| Break-glass + small cohort | still suppress/deny — no bypass |
| Count channel vs list/search facet | same control plane |
| Evidence append failure on sensitive/bulk | compensate + error |
| Regression: 2.1–2.6 selfchecks | still pass |

### Project Structure Notes

- Threshold ownership: `packages/kernel/audit-envelope` (AD-5)
- Population + grants: `packages/modules/identity-access`
- Web orchestration only: `apps/web/src/server/{trpc,root}.ts`, `operational-copy.ts`
- Do not create a new top-level `access-control` package
- Reporting module stays stub unless a one-line seam comment is useful

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2 / Story 2.7]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-48]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §8.5 metric definition; §12.3–12.4]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5 bulk thresholds]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — suppressed metric]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — UX-DR15]
- [Source: `_bmad-output/specs/spec-divan/launch-artifacts.md` — AR-ACCESS / AR-REPORTING open]
- [Source: `_bmad-output/implementation-artifacts/2-6-temporal-cross-boundary-authorization.md`]
- [Source: `_bmad-output/implementation-artifacts/2-5-break-glass-privileged-access.md`]
- [Source: `_bmad-output/implementation-artifacts/2-4-entitlement-lifecycle-grant-expiry-revocation-recertification.md`]
- [Source: `_bmad-output/implementation-artifacts/2-2-sensitive-categories-separate-export-permission.md`]
- [Source: `_bmad-output/implementation-artifacts/2-1-audit-envelope-default-deny-authorization-substrate.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- `pnpm selfcheck:inference-bulk` — ok
- `pnpm selfcheck:audit-envelope` / `selfcheck:temporal-authz` / `selfcheck:break-glass` / `selfcheck:entitlement-lifecycle` / `selfcheck:governed` — ok
- `pnpm --filter @divan/audit-envelope|identity-access|web typecheck` — ok
- `pnpm --filter @divan/web lint` — ok

### Completion Notes List

- Shipped `evaluateInferenceBulk` + DEMO/disabled hooks in `@divan/audit-envelope` (AD-5). Production defaults fail-closed; DEMO enables cohort≥3, volume/window/field, differencing via actor fingerprints.
- Suppress ≠ empty ≠ zero: `toGovernedRetrievalPayload` returns `outcome: "suppressed"` with `volume: null` / `subjectIds: null` + «داده قابل نمایش نیست»; true empty uses `outcome: "empty"` + `volume: 0`.
- Web orchestration: `runGovernedRetrieval` / `runGovernedDrillDown` after governedProcedure authorize; all retrieval channels share the plane; drill-down fail-closes when parent suppressed.
- Bulk approval reuses activated `EntitlementGrant kind: bulk` (+ optional `demoBulkApproval`); sensitive aggregates / volume threshold → `require_bulk_approval` without grant.
- Break-glass privileged demo still runs InferenceBulkPort; `profile`/`timeline` are cohort-exempt (identity reads) but volume/differencing/bulk still bind; aggregate channels keep cohort suppress.
- Access events record volume + outcome (no HR values); append failure → `AUDIT_APPEND_FAILED`.
- Thin dashboard demo card proves suppress copy; full dashboard remains Epic 5.
- Code review (2026-07-17): identity cohort exempt; window charge on non-allow; probe via `runGovernedRetrieval`; grant expiry; drill-down as-of; fail-closed unknown channel; selfcheck extended.

### File List

- packages/kernel/audit-envelope/src/inference-bulk.ts
- packages/kernel/audit-envelope/src/inference-bulk.selfcheck.ts
- packages/kernel/audit-envelope/src/authorization-error.ts
- packages/kernel/audit-envelope/src/index.ts
- packages/kernel/audit-envelope/package.json
- packages/modules/identity-access/src/population-authz.ts
- packages/modules/identity-access/src/entitlement-lifecycle.ts
- packages/modules/identity-access/src/break-glass.ts
- packages/modules/reporting/src/index.ts
- apps/web/src/server/retrieval-control.ts
- apps/web/src/server/root.ts
- apps/web/lib/operational-copy.ts
- apps/web/components/dashboard/inference-bulk-demo-card.tsx
- apps/web/app/(app)/dashboard/page.tsx
- package.json
- .env.example
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/2-7-inference-resistant-bulk-retrieval-controls.md

## Change Log

- 2026-07-17: Story context created (ready-for-dev) — ultimate context engine analysis completed
- 2026-07-17: Implemented InferenceBulkPort + shared retrieval control plane (FR-48); status → review
- 2026-07-17: Code review patches applied (identity cohort exempt, window charge, probe evidence, etc.); status → done
