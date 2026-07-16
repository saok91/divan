---
baseline_commit: e711591
---

# Story 2.6: Temporal & Cross-Boundary Authorization

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a manager or scoped HR user,
I want every retrieval to honor Organizational Scope and current/as-of time semantics,
so that cross-boundary aggregates never leak out-of-scope people or history (FR47).

## Gate (read first)

**AR-ACCESS is still `pending` for the production field×action×scope×time matrix.** AR-TEMPORAL has a **partial freeze** (Asia/Tehran; date-only Effective Date; exclusive interval ends; future as-of = planned not Effective). Person / Employment / Assignment / OrgUnit tables **do not exist yet** (Epic 3/4). This story ships a **real temporal + cross-boundary authorization control plane** — contracts, enforcement hooks, fixture populations, mid-session UX, and selfcheck oracles — not production org hierarchy or Epic 5 search/report surfaces.

- Do **not** invent the full AR-ACCESS launch matrix, production org-tree membership sync, LDAP group→scope, or real Person CRUD.
- Do **not** implement inference/bulk/small-cohort thresholds (2.7), full export panel (6.5), audit investigation UI (7.1), or temporal-engine projection rebuild (Epic 4).
- Do **not** invent Nest/CASL/Ability/Passport or parallel Prisma audit tables.
- Do **not** treat `stale-banner` (FR-45 recalc) as the mid-session authz modal — they are different controls.
- Do **not** leave break-glass as a temporal/scope bypass — elevation still intersects authorized population × time (2.5 deferred item).
- Ship **configurable, fail-closed** hooks: evaluation time / as-of; actor scope membership; population intersection; management-derived interval default; separate bounded cross-time grants; stale/ambiguous/unreconciled → deny.
- Reuse Stories 2.1–2.5 substrate (`governedProcedure`, `authorizeOrThrow`, access events, entitlement lifecycle, `reauthorizeForQueuedOrArtifactWork`, break-glass limits, banner stack) — **extend**; do not fork a second authz stack.
- Until Epic 3/4 domain tables exist, prove FR-47 with an **in-module fixture PopulationPort** (demo persons / memberships / relationship intervals). Epic 3+ replaces the port implementation without changing the authorize contract.

[Source: `epics.md` Story 2.6; `prd.md` FR-47; `addendum.md` §12.3; `ARCHITECTURE-SPINE.md` AD-5; `launch-artifacts.md` AR-ACCESS/AR-TEMPORAL; Stories 2.1–2.5; `EXPERIENCE.md` State Patterns]

## Acceptance Criteria

1. **Given** a caller with Organizational Scope S and permitted categories  
   **When** they run profile, timeline, search, count, dashboard, report, export, or audit retrieval (demo governed procedures standing in for Epic 5/6/7 channels)  
   **Then** results contain only the permitted intersection of underlying populations; drill-down preserves the same authorized population

2. **And** management-derived scope defaults to facts/intervals covered by the authorized relationship; pre-scope history for current managers and post-scope history for former managers require separate purpose-, category-, and time-bounded grants with audit; AR-ACCESS hooks may narrow but MUST NOT implicitly broaden

3. **When** authorization inputs are stale, failed, ambiguous, or unreconciled  
   **Then** the operation fails closed (no partial leak; Persian deny; access event on sensitive path)

4. **When** role/scope/account/org-membership changes mid-session  
   **Then** enforcement applies before the next protected action; UI offers «دسترسی شما تغییر کرد.» with save-draft or discard when a Draft is permitted, blocks finalize, and redirects to safe landing after acknowledgement

5. **And** actor `organizationalScopeIds` membership is enforced for the request scope (not audit-only); policy/demo scope identifiers and account bindings share one resolved identity space for governed demos (document mapping)

6. **And** break-glass elevation remains intersected by the same population × time rules (export/admin denials from 2.5 still hold)

7. **And** Layout ≠ RSC / UI ≠ data access / default-deny / no client import of `@divan/identity-access` remain intact

## Tasks / Subtasks

- [x] Task 1: Authorize contract — time + scope membership + fail-closed inputs (AC: #3, #5)
  - [x] Extend `AuthorizeInput` (and governed meta/input path) with evaluation semantics:
    - `evaluationMode: "current" | "as_of"` (default `current`)
    - `asOfDate?: string` — **date-only** `YYYY-MM-DD` interpreted in `Asia/Tehran` per AR-TEMPORAL partial freeze; reject timestamps / ambiguous strings fail-closed
    - Future as-of: mark result semantics as **planned** (not Effective) in payload meta for demos; do not invent full projection engine
  - [x] Enforce **actor membership**: request `organizationalScope` must resolve to a scope id the actor holds (or an explicit demo grant that maps into actor scopes). Missing/empty membership → deny (fix “policy match without binding”).
  - [x] Align identity spaces for demos: either (a) seed OrganizationalScope rows whose ids/codes match policy fixture tokens, or (b) introduce a stable `code` / alias map `org:selfcheck` → cuid — **document chosen approach**; no silent dual-space allow.
  - [x] Fail-closed hooks for: missing population port, unreconciled membership, ambiguous as-of, failed authz dependency — prefer distinct internal reason codes in access-event payload; user-facing stays «دسترسی ندارید.» unless mid-session change path (AC #4).
  - [x] Keep coarseRole out of allow keys; keep read ≠ export; keep SysAdmin routine HR deny (2.2).

- [x] Task 2: Population intersection + management-derived intervals (AC: #1, #2, #6)
  - [x] Add a **PopulationPort** (name flexible) owned by identity-access or audit-envelope consumer path — prefer `packages/modules/identity-access/src/population-authz.ts` (or kernel helper if pure):
    - Input: actor scopes, evaluation time, optional object ids, channel (profile|timeline|search|count|dashboard|report|export|audit)
    - Output: authorized subject id set (intersection) OR deny
  - [x] Fixture registry for selfcheck/demo (no Prisma Person tables):
    - Cross-boundary: populations A∩B only; out-of-scope ids omitted (not masked as 0)
    - Drill-down: same authorized set as parent aggregate
    - Current manager: facts only inside relationship interval
    - Former manager: post-scope facts denied without separate grant
    - Current manager + pre-scope history: denied without separate grant
    - Retroactive / unreconciled membership flag → fail closed
  - [x] Cross-time grant: specialize lifecycle — prefer new `EntitlementGrantKind` e.g. `cross_time_scope` **or** documented `createPayload` on elevated kind with required `purpose`, `category`, `validFrom`/`validTo` (date-only), target population hint — independent approve; audit on activate/use. Do **not** silently widen management-derived default.
  - [x] Wire demo governed retrieval procedures that call intersection **after** envelope allow (or as part of authorize path — document): empty intersection → safe empty / omit, never invent out-of-scope rows.
  - [x] Break-glass: privileged demo read still runs through intersection; cannot return out-of-interval or out-of-scope fixture rows.

- [x] Task 3: Mid-session authz change UX + server signal (AC: #4)
  - [x] Server: detect entitlement/scope/role binding change vs prior session snapshot on governed entry (or dedicated `me`/authz-status query). Prefer a structured error/code or flag (e.g. `AUTHZ_CHANGED`) mapped to `operationalCopy.scopeRevoked` — do not rely on substring matching alone in production paths.
  - [x] Client: global modal «دسترسی شما تغییر کرد.» (EXPERIENCE exact):
    - If demo/open Draft permitted: offer **save draft** or **discard**
    - Always **block finalize** while modal open / after change
    - After ack → redirect to role safe landing (reuse Epic-1 landing map)
  - [x] Because Epic 4 Draft forms do not exist: ship a **demo draft stand-in** on an existing HR route (e.g. personnel) OR a tiny client-only draft flag in provider — enough to prove save/discard + block finalize; document as seam for Epic 4.
  - [x] Do **not** conflate with `stale-banner` / FR-45; do not put authz-change copy on break-glass banner.
  - [x] Interactive a11y DoD: keyboard; visible focus; Esc only if non-blocking design allows (prefer required ack); focus return; `aria-live` assertive for this blocking modal; RTL; no emoji.

- [x] Task 4: Reauth seam + evidence (AC: #1, #3, #4)
  - [x] Extend `reauthorizeForQueuedOrArtifactWork` (or sibling) to accept optional `asOfDate` / population check against fixture port — still fail-closed; full artifact consumers remain 6.5/7.x.
  - [x] Sensitive retrieval demos: `governedProcedure` + access events with purpose/scope/volume/outcome; **no HR field values**.
  - [x] Evidence failure → compensate + fail closed (existing pattern).

- [x] Task 5: Policy fixtures, docs, deferred-work (AC: #1–#7)
  - [x] Update DEV_DEMO_POLICY / seeds so membership-enforced demos pass; keep production registry empty → deny.
  - [x] Document PopulationPort + as-of + cross-time grant hooks in module README/comment — AR-ACCESS owns production values.
  - [x] Update `deferred-work.md`: mark 2.6 temporal/cross-boundary done for control-plane; leave Epic 3/4 domain population implementation, 2.7 inference, full reports, artifact reauth consumers.
  - [x] `.env.example` / README only if new keys required — prefer code defaults.

- [x] Task 6: Selfcheck + DoD (AC: #1–#7)
  - [x] Add `temporal-cross-boundary.selfcheck.ts` (package + root `selfcheck:temporal-authz` or similar)
  - [x] Cover Testing table below
  - [x] `pnpm` typecheck: `@divan/identity-access`, `@divan/audit-envelope`, `@divan/db`, `@divan/web` (+ lint web)
  - [x] Manual smoke: scoped demo retrieval intersect; former-manager deny; cross-time grant allow bounded slice; ambiguous as-of deny; revoke scope mid-session → modal → ack → landing; break-glass still scoped; finalize blocked under change
  - [x] When marking done: sync story-file `Status` with `sprint-status.yaml`

### Review Findings

- [x] [Review][Decision] Dual scope identity space — resolved 2026-07-17: clamp client override to session `organizationalScopeCodes`; also tag fixture subjects with `org:selfcheck` so session-backed demos are non-empty (keep `org:fixture-*` for selfcheck A∩B).
- [x] [Review][Decision] Activated `cross_time_scope` → PopulationPort — resolved 2026-07-17: on activate, register grant into fixture registry from payload; clear on revoke/expire (still catalogOnly for role/scope bindings).

- [x] [Review][Patch] Clamp `actorScopeCodesOverride` to session membership + tag fixtures with `org:selfcheck` [`apps/web/src/server/root.ts:174`]
- [x] [Review][Patch] Register/clear `cross_time_scope` in PopulationPort fixture registry on activate/revoke [`packages/modules/identity-access/src/entitlement-lifecycle.ts:899`]
- [x] [Review][Patch] Sync demo `asOfDate` with `evaluationMode` / `resultSemantics` (no population-vs-envelope split-brain) [`apps/web/src/server/root.ts:183`]
- [x] [Review][Patch] Do not trust raw client `evaluationMode`/`asOfDate` on all governed routes — prefer meta or explicit temporal demos only [`apps/web/src/server/trpc.ts:150`]
- [x] [Review][Patch] `await session.update()` before `clearAuthzChanged()` [`apps/web/components/authz-changed-modal.tsx:45`]
- [x] [Review][Patch] Reset `authzChangedAcked` when server signals a new authz change after prior ack [`apps/web/components/platform-status-provider.tsx:103`]
- [x] [Review][Patch] Stop OR-ing sticky SSR `initial.authzChanged` after live `me` data exists [`apps/web/components/platform-status-provider.tsx:124`]
- [x] [Review][Patch] Fold authz-change into gold CTA block used by personnel finalize/export [`apps/web/components/platform-status-provider.tsx:147`]
- [x] [Review][Patch] Fail closed on drill-down widen (deny, do not return `widened: true`) [`apps/web/src/server/root.ts:248`]
- [x] [Review][Patch] Apply management-interval / cross-time narrowing to manager aggregate channels [`packages/modules/identity-access/src/population-authz.ts:323`]
- [x] [Review][Patch] Enforce cross-time fixture `purpose`/`category` on use, not only date interval [`packages/modules/identity-access/src/population-authz.ts:193`]
- [x] [Review][Patch] Surface structured `AUTHZ_CHANGED` to clients (not only `cause` / Persian substring) [`apps/web/src/server/trpc.ts:143`]
- [x] [Review][Patch] Include `organizationalScopeCodes` in binding fingerprint [`packages/modules/identity-access/src/types.ts:141`]
- [x] [Review][Patch] Type-guard non-string `asOfDate` in `parseDateOnly` / governed raw input [`packages/kernel/temporal-engine/src/date-only.ts:15`]
- [x] [Review][Patch] Fail closed when Tehran date parts missing (no UTC day fallback) [`packages/kernel/temporal-engine/src/date-only.ts:62`]
- [x] [Review][Patch] Missing prior JWT fingerprint must not skip mid-session detection [`apps/web/app/(app)/layout.tsx:61`] — refined: empty prior hydrates silently in jwt callback; only non-empty mismatch → AUTHZ_CHANGED (avoids modal/redirect loop)
- [x] [Review][Patch] Compute post-ack landing from refreshed session role, not pre-change layout prop [`apps/web/components/authz-changed-modal.tsx:50`]
- [x] [Review][Patch] Differentiate demo Save Draft vs Discard (persist vs clear stand-in state) [`apps/web/components/authz-changed-modal.tsx:89`]

- [x] [Review][Defer] Sticky `breakGlassOverride` can outlive server revoke [`apps/web/components/platform-status-provider.tsx:101`] — deferred, pre-existing
- [x] [Review][Defer] Fingerprint ignores permission-set content mutations on same role ids [`packages/modules/identity-access/src/types.ts:141`] — deferred, pre-existing
- [x] [Review][Defer] Real membership reconcile signal (not client `unreconciled` flag) [`packages/modules/identity-access/src/population-authz.ts:233`] — deferred, pre-existing
- [x] [Review][Defer] `intervalsOverlap` lexical compare without date-only parse [`packages/kernel/temporal-engine/src/date-only.ts:104`] — deferred, pre-existing

## Dev Notes

### Epic context

- **Epic 2:** Entitlements & Access Governance — FR2, FR3, FR4, FR46, FR47, FR48.
- **This story** delivers **FR-47**: every retrieval channel evaluates subject × object × category × action × Organizational Scope × current/as-of time; intersection-only aggregates; management-derived interval default; stale/ambiguous fail-closed; mid-session reauth + UX.
- **Upstream (done):** 2.1 envelope + governedProcedure + freshness; 2.2 sensitive categories; 2.3 access-admin + toxic; 2.4 entitlement lifecycle + `reauthorizeForQueuedOrArtifactWork`; 2.5 break-glass (must remain temporally bounded here).
- **Downstream:** 2.7 inference/bulk on same control plane; Epic 3/4 replace fixture PopulationPort with real projections; Epic 5 search/profile/dashboard/report consume the same intersection API; 6.5/7.x call reauth with time/scope.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Full AR-ACCESS production matrix / toxic catalog | Launch artifacts |
| Real Person / Employment / Assignment / OrgUnit tables + hierarchy | Epic 3 |
| temporal-engine projection rebuild / event ordering engine | Epic 4 (`temporal-engine` stays mostly stub except optional pure date helpers) |
| Inference / small-cohort / volume thresholds | Story 2.7 |
| Full personnel search / profile / report catalogue UI | Epic 5 |
| Export artifact panel reauth consumers | Story 6.5 |
| Audit investigation UI | Story 7.1 |
| LDAP group → Organizational Scope sync | AR-IDENTITY (forbidden) |
| Changing five MVP coarse nav roles | Frozen Epic-1 |
| NestJS, CASL, Ability, Passport | Not in architecture |
| New Prisma audit tables / dual audit writers | AD-5 / 2.1 |
| Client import of `@divan/identity-access` | Lessons 1.5–2.5 |
| Inventing FR-45 stale-recalc behavior as authz modal | Separate concern |

### Architecture compliance (MUST)

| Rule | Implication |
| --- | --- |
| **AD-5** | identity-access owns coarse scope/bindings + population port fixtures; audit-envelope owns fine-grained allow + access events; retrieval still default-deny |
| **AD-3** | No casual cross-module Prisma into compensation-facts; no inventing HR tables in identity-access beyond authz fixtures (prefer in-memory/JSON fixtures over fake Person tables) |
| **AD-2 / AR-TEMPORAL partial** | as-of is date-only Asia/Tehran; exclusive ends when intervals appear; future as-of ≠ Effective labeling |
| **FR-47** | Intersection-only; management-derived interval default; separate bounded cross-time grants; stale/ambiguous fail-closed; mid-session before next protected action |
| **FR-2 / 2.1** | UI ≠ access; Layout ≠ RSC; session freshness not JWT-alone |
| **FR-46 / 2.5** | Break-glass still minimal; export/admin deny; now also population×time bound |
| **FR-51** | Sensitive retrieval audited; audit failure fail-safe |
| **UX EXPERIENCE** | Exact modal copy «دسترسی شما تغییر کرد.»; draft save/discard; block finalize; safe landing |

[Source: `ARCHITECTURE-SPINE.md` AD-5/AD-2/AD-3; `prd.md` FR-47; `launch-artifacts.md` AR-TEMPORAL freeze; `EXPERIENCE.md`]

### Authz model for this story

```
Retrieval request (profile|search|count|…|export|audit)
  → getSessionContext (fail-safes: expiry/recert/break-glass)
  → detect mid-session binding change → AUTHZ_CHANGED / modal path
  → authorizeOrThrow (permission × category × action × scope
        + actor membership in scope
        + evaluationMode/asOfDate validity)
  → PopulationPort.intersect(actor, asOf, channel, objectHints)
        ∩ management relationship interval (default)
        ∪ optional active cross_time_scope grant (bounded)
  → return only authorized ids/facts OR empty/omit OR deny
  → access event (sensitive) with scope/time/volume/outcome — no HR values
```

Drill-down MUST reuse the **same** authorized id set as the parent aggregate (pass token/set id or recompute identically — document choice; no widened child queries).

### Design decisions (encode — do not reinvent mid-impl)

1. **Fixture PopulationPort, not fake HR schema:** Prove FR-47 without Epic 3 tables. In-memory/JSON fixtures keyed by demo scope codes. Replace later with projection-backed port.
2. **Membership is mandatory:** Exact policy tuple match alone is insufficient; actor must hold the resolved scope. This closes the 2.1–2.5 gap where `organizationalScopeIds` were audit-only.
3. **One scope identity space for demos:** Pick alias-map or seed codes; document in Dev Agent Record. Mixing cuid meta with `org:selfcheck` rules without a map is a defect.
4. **Management-derived default is narrow:** Interval of authorized relationship only. Pre-scope (current manager) and post-scope (former manager) require explicit cross-time grant — never “manager role implies full history.”
5. **Cross-time grant ≠ break-glass:** Different purpose; may reuse lifecycle machinery (`EntitlementGrant`) with new kind or payload shape; still independent approve + audit; still fail-closed if hooks missing for elevated path.
6. **as-of parsing fail-closed:** Invalid / timestamp / timezone-ambiguous input → deny. Do not coerce quietly.
7. **Mid-session UX is product AC, not optional polish:** Modal + draft stand-in + block finalize + redirect are in scope.
8. **stale-banner ≠ scopeRevoked:** FR-45 banner stack unchanged; authz change is modal.
9. **Break-glass bounded:** Reuse `assertBreakGlassElevationLimits`; add intersection on privileged read demos.
10. **Atomicity:** Preserve mutate-then-evidence + compensate; shared DB+event TX still out of scope.
11. **temporal-engine:** Optional pure helpers (date-only validate, exclusive-end overlap) may live here or in identity-access; do **not** build projection rebuild in 2.6.

### Current code to UPDATE (read before coding)

| File | Current state | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/kernel/audit-envelope/src/index.ts` | Exact 4-tuple; actor scopes audit-only | Membership check; as-of/evaluation fields; fail-closed ambiguous | Default-deny; access events; MSG_ACCESS_DENIED_FA; coarseRole never allow key |
| `packages/kernel/audit-envelope/src/categories.ts` / policy loaders | Demo rules with `org:selfcheck` / `org:any` | Align with membership model; document `org:any` semantics (likely deny for scoped retrieval or require explicit membership wildcard hook — prefer **no unbounded `org:any` on HR retrieval demos**) | Read ≠ export; SysAdmin no routine HR |
| `apps/web/src/server/trpc.ts` | Static meta scope; freshness | Pass evaluation time; membership; optional AUTHZ_CHANGED mapping; wire population where appropriate | governedProcedure shape; break-glass export deny; devOnly gate |
| `packages/modules/identity-access/src/types.ts` | `organizationalScopeIds: string[]` | Snapshot version / binding hash for mid-session detect if needed | LDAP group→role forbidden comments |
| `packages/modules/identity-access/src/authenticate.ts` | Fail-safes + breakGlass hydrate | Optional authz generation / binding fingerprint | Inactive fail-closed; password null |
| `packages/modules/identity-access/src/entitlement-lifecycle.ts` | Grant kinds without cross-time | Cross-time grant kind/payload + activate bounds; extend `reauthorizeForQueuedOrArtifactWork` | TOCTOU activate; withdraw flags; elevated approve |
| `packages/modules/identity-access/src/break-glass.ts` | Elevation limits | Ensure privileged path calls intersection | Default deny export/admin |
| `packages/modules/identity-access/src/seed.ts` | Scopes as labels | Demo scopes + fixture alignment + optional cross-time seed | No standing SysAdmin HR |
| `packages/db/prisma/schema.prisma` | OrganizationalScope label-only | Optional `code` unique; optional grant kind `cross_time_scope`; optional interval fields on grant — **only if needed**; avoid Person tables | No Prisma audit models |
| `apps/web/src/server/root.ts` | Demo governed procs | Demo retrieval: intersect, as-of, drill-down, former-manager, cross-time | Existing demos keep passing |
| `apps/web/lib/operational-copy.ts` | `scopeRevoked` catalog string | Modal/draft/finalize/discard strings as needed | Exact «دسترسی شما تغییر کرد.» |
| `apps/web/components/platform-status-provider.tsx` | Break-glass + stale | Authz-changed signal / draft stand-in state | Banner precedence |
| `apps/web/lib/personnel-search.ts` | Always `[]` | Optional: filter via intersection API when demo data exists | Epic 5 ownership of real search |
| `_bmad-output/implementation-artifacts/deferred-work.md` | 2.6 open | Resolve control-plane items; note Epic 3+ port | Prior deferrals |
| `package.json` | selfcheck scripts | Add temporal-authz selfcheck | Existing scripts |

### Likely NEW files

| Path | Role |
| --- | --- |
| `packages/modules/identity-access/src/population-authz.ts` | PopulationPort + fixtures + intersect |
| `packages/modules/identity-access/src/temporal-cross-boundary.selfcheck.ts` | Acceptance probes |
| `packages/db/prisma/migrations/<ts>_cross_time_scope_authz/` | Only if schema kind/code/fields added |
| `apps/web/components/authz-changed-modal.tsx` (name flexible) | Mid-session modal |
| `apps/web/src/server/` demo retrieval procedures | Intersect / as-of / drill-down proofs |
| `packages/kernel/temporal-engine/src/date-only.ts` (optional) | Pure AR-TEMPORAL date helpers — keep package free of HR domain |

### Previous story intelligence (2.5 — actionable)

- Break-glass must **not** bypass temporal/scope — deferred explicitly to 2.6; close it here on demo privileged read.
- Force-withdraw / live grant requires finite `expiresAt` — do not regress banner hydration.
- Centralize export deny under active BG in `governedProcedure` when `meta.action === "export"` — keep.
- Client never imports `@divan/identity-access`; Access admin uses tRPC only.
- Evidence compensate on failure; conditional `updateMany` for TOCTOU.
- Dual-admin still needed for independent approve of cross-time grants in seed env.
- Review pitfall class: “binding exists but wrong semantics” — for 2.6, membership without interval still fails management-derived checks.
- Forever-live mocks and fake elevation toggles are forbidden (2.5 removed personnel mock toggle).

[Source: `2-5-break-glass-privileged-access.md` Review Findings + Completion Notes; `deferred-work.md`]

### Git intelligence

Recent commits: `e711591` story 2.5 → `cd102fe` story 2.4 → `9ecdfe9` story 2.3 → `722e7fc` story 2.2 → `642c5da` story 2.1. Follow one-commit-per-story style (`story 2.6`) when user requests commit. Baseline tip: `e711591`.

### Latest technical notes (industry + stack)

- HRIS practice (e.g. SAP HCM time logic / SuccessFactors period-restricted access): authorize when **responsibility interval ∩ data validity** is non-empty; empty intersection → not authorized. Managers see slices inside responsibility period; lingering pre/post access is a separate grant — matches FR-47 management-derived invariant.
- Authority checks in workflows: **fail-closed** on ambiguous/incomplete evaluation — never silent fail-open for irreversible or sensitive reads.
- Divan implements this as **broker-mediated** checks inside audit-envelope + PopulationPort — not an external PAM/ABAC product (no Casbin/Permit.io).
- Stack unchanged: Next.js App Router, tRPC 11, Prisma 7 projections, raw SQL event-store, pnpm, Node 22. Prefer explicit date-only validation over `Date` locale surprises; store/display Jalali at UI boundary (FR44) while authz evaluation uses Gregorian date-only + Asia/Tehran.

### Testing requirements

| Probe | Expected |
| --- | --- |
| Scoped retrieval over fixture A∪B with actor scope A only | Only A ids; B omitted (not fake 0) |
| Drill-down from aggregate | Identical authorized id set; no widening |
| Current manager + fact inside relationship interval | Allow (demo) + audit if sensitive |
| Current manager + pre-scope history without cross-time grant | Deny |
| Former manager + post-scope fact without grant | Deny |
| Active cross-time grant for bounded interval/category | Allow only that slice; audit |
| Ambiguous / invalid asOfDate | Fail closed |
| Unreconciled / missing population port | Fail closed |
| Policy allow but actor lacks scope membership | Deny |
| Mid-session scope revoke then next governed call | AUTHZ_CHANGED / «دسترسی شما تغییر کرد.»; finalize blocked |
| Modal save-draft / discard (demo stand-in) then ack | Redirect safe landing; no further finalize |
| Break-glass privileged read out-of-scope fixture | Deny / omit — no bypass |
| Export under BG without exceptional approval | Still deny (2.5) |
| Evidence append failure on sensitive retrieval | Compensate + error |
| Regression: 2.1–2.5 selfchecks | Still pass |

### Project Structure Notes

- Module ownership: `packages/modules/identity-access` (population + grants) + `packages/kernel/audit-envelope` (authorize contract)
- Optional pure date helpers: `packages/kernel/temporal-engine` — no projection rebuild
- Web: `apps/web/src/server/trpc.ts`, `root.ts`, authz modal component, `operational-copy.ts`, provider
- Align with monorepo seed: no new top-level packages

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2 / Story 2.6]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-47 consequences]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §12.3 acceptance scenarios]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/review-security-privacy-v3.md` — management-derived invariant]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5]
- [Source: `_bmad-output/specs/spec-divan/launch-artifacts.md` — AR-ACCESS / AR-TEMPORAL]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — Scope revoked mid-session]
- [Source: `_bmad-output/implementation-artifacts/2-5-break-glass-privileged-access.md`]
- [Source: `_bmad-output/implementation-artifacts/2-4-entitlement-lifecycle-grant-expiry-revocation-recertification.md`]
- [Source: `_bmad-output/implementation-artifacts/2-1-audit-envelope-default-deny-authorization-substrate.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Scope identity space: `OrganizationalScope.code` seeded as `org:selfcheck` (chosen over silent cuid↔token dual-space).
- Mid-session: JWT freezes `authzBindingFingerprint` at login; `session.update()` refreshes after modal ack.
- Drill-down: recompute identically via `drillDownPopulation` (same parent inputs + objectId).

### Completion Notes List

- FR-47 control plane shipped: membership-enforced authorize, date-only as-of (Asia/Tehran helpers in `@divan/temporal-engine`), fixture PopulationPort, `cross_time_scope` grant kind, mid-session modal «دسترسی شما تغییر کرد.» with demo draft stand-in.
- Break-glass privileged read now intersects PopulationPort; export/admin denials from 2.5 preserved.
- Selfchecks: `selfcheck:temporal-authz` + regression 2.1–2.5 scripts green; web typecheck + lint clean.
- Deferred: Epic 3/4 real population projections; 2.7 inference; 6.5/7.x artifact consumers; AR-ACCESS production matrix.

### File List

- `_bmad-output/implementation-artifacts/2-6-temporal-cross-boundary-authorization.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/auth.ts`
- `apps/web/components/authz-changed-modal.tsx`
- `apps/web/components/platform-status-provider.tsx`
- `apps/web/lib/operational-copy.ts`
- `apps/web/lib/trpc/client.tsx`
- `apps/web/src/server/context.ts`
- `apps/web/src/server/root.ts`
- `apps/web/src/server/trpc.ts`
- `apps/web/types/next-auth.d.ts`
- `package.json`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260717020000_cross_time_scope_authz/migration.sql`
- `packages/kernel/audit-envelope/package.json`
- `packages/kernel/audit-envelope/src/audit-envelope.selfcheck.ts`
- `packages/kernel/audit-envelope/src/index.ts`
- `packages/kernel/temporal-engine/src/date-only.ts`
- `packages/kernel/temporal-engine/src/index.ts`
- `packages/modules/identity-access/package.json`
- `packages/modules/identity-access/src/access-admin.ts`
- `packages/modules/identity-access/src/authenticate.ts`
- `packages/modules/identity-access/src/authz-context.ts`
- `packages/modules/identity-access/src/entitlement-lifecycle.ts`
- `packages/modules/identity-access/src/index.ts`
- `packages/modules/identity-access/src/population-authz.ts`
- `packages/modules/identity-access/src/temporal-cross-boundary.selfcheck.ts`
- `packages/modules/identity-access/src/types.ts`
- `pnpm-lock.yaml`

## Change Log

- 2026-07-17: Story context created (ready-for-dev) — ultimate context engine analysis completed
- 2026-07-17: Implemented temporal + cross-boundary authz control plane (membership, PopulationPort, as-of, cross_time_scope, mid-session modal); status → review
- 2026-07-17: Code review patches applied (scope clamp, cross_time registry wire, mid-session UX races, manager aggregates, AUTHZ_CHANGED data); status → done
