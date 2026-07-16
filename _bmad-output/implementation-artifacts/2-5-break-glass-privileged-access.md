---
baseline_commit: cd102fe
---

# Story 2.5: Break-Glass Privileged Access

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an incident responder with approved break-glass authority,
I want time-bound minimal privileged access with mandatory review,
so that emergencies are possible without routine privilege creep (FR46).

## Gate (read first)

**AR-ACCESS, AR-IDENTITY, and AR-AUDIT are still `pending` for exact break-glass policy, emergency-account mechanics, and review SLA.** This story ships a **real incident-bound break-glass grant path + banner hydration + post-use review + envelope-audited privileged I/O** — not the production field×action×scope matrix, LDAP emergency accounts, or audit investigation UI.

- Do **not** invent the full AR-ACCESS launch matrix, exact production max-duration SLA milliseconds, emergency LDAP/local account vaulting, or notification/paging integrations.
- Do **not** invent new MVP coarse nav roles — five Epic-1 codes stay frozen (`identity-access-epic1-freeze.md`).
- Do **not** implement temporal/as-of retrieval (2.6), inference/bulk thresholds (2.7), full export panel (6.5), or audit investigation surface (7.1).
- Do **not** invent a parallel privilege system beside `EntitlementGrant` — **specialize** Story 2.4 lifecycle for `break_glass`.
- Ship **configurable, fail-closed** hooks: required `expiresAt`; incident id + purpose; independent approval; default **deny export** and **deny permission administration** under elevation; independent post-use review (toxic vs subject/requester/approver of the same incident).
- Reuse Stories 2.1–2.4 substrate (`governedProcedure`, `authorizeOrThrow`, access events, toxic hooks, entitlement lifecycle, banner stack UI) — **extend**; do not invent CASL/Nest/Ability/Passport or parallel Prisma audit tables.
- Banner UI already exists as a **mock** — wire it to real grants; remove/replace the personnel page demo toggle that fakes elevation without authz.

[Source: `epics.md` Story 2.5; `prd.md` FR-46 break-glass consequence, FR-3, FR-51; `ARCHITECTURE-SPINE.md` AD-5; Stories 2.1–2.4; UX-DR5; `launch-artifacts.md`]

## Acceptance Criteria

1. **Given** an independently approved break-glass grant  
   **When** the grant activates  
   **Then** action/scope/time are minimal and incident-bound; the grant auto-expires; `break-glass-banner` appears on affected HR routes

2. **And** export and permission administration remain denied by default unless separately exceptionally approved

3. **And** every privileged read/write is envelope-audited; post-use independent review is required and attributable

4. **When** the grant expires or is revoked  
   **Then** the banner dismisses and subsequent protected actions fail closed without the grant

5. **And** banner stack semantics from Story 1.7 / UX-DR5 are preserved: non-dismissible blocking `stale-banner` above `break-glass-banner`; break-glass becomes dismissible on expiry without obscuring blocking stale

6. **And** toxic combinations remain fail-closed: no self-request/approve/waive of break-glass; no actor reviews their own break-glass use for the same incident; permission-admin + approve-same-grant still blocked

## Tasks / Subtasks

- [x] Task 1: Schema — break-glass specialization of EntitlementGrant (AC: #1, #3, #4)
  - [x] Extend `EntitlementGrantKind` with `break_glass` (Prisma enum + migration)
  - [x] Add break-glass-specific fields on `EntitlementGrant` (names flexible; document chosen shape):
    - `incidentId` (required for `break_glass`) — stable incident / ticket reference string
    - `purpose` / reason (required) — short attributable text; **no HR field values**
    - `expiresAt` **required** for `break_glass` (reject null / missing / past-at-activate)
    - Optional: allowed action/category/scope hints in `createPayload` JSON (minimal demo set only — AR-ACCESS owns production matrix)
    - Post-use review: e.g. `postUseReviewStatus` (`pending` | `completed` | `not_required` for non-break-glass) + `postUseReviewedAt` + `postUseReviewerAccountId` — or equivalent documented fields
  - [x] Indexes: `(kind, status)`, `incidentId`, post-use review pending lookups as needed
  - [x] Migration via Prisma only — **no new Prisma audit tables**
  - [x] Keep `AccountAccessRole` / `AccountOrganizationalScope` as effective bindings; break-glass activation applies **minimal** elevation bindings (demo HR-read role/PermissionSet — **never** `access.administration` or export by default)
  - [x] Seed: optional demo break-glass fixtures for selfcheck only; do not seed standing SysAdmin HR access

- [x] Task 2: Break-glass lifecycle APIs + toxic guards (AC: #1–#4, #6)
  - [x] Prefer dedicated `break-glass.ts` **or** clearly separated section in `entitlement-lifecycle.ts` — reuse `requestGrant` / `approveGrant` / `activateGrant` / `revokeGrant` / fail-safes where possible; specialize validation for `kind === break_glass`
  - [x] Publish server APIs from `@divan/identity-access` (no React), at minimum:
    - `requestBreakGlassGrant` (or `requestGrant` with kind `break_glass`) — requires incidentId, purpose, expiresAt, minimal target role/scope; toxic: cannot request for self when policy requires independence (default: elevated — self-request blocked for break-glass)
    - Independent `approveGrant` path — approver ≠ requester ≠ subject
    - `activateGrant` — applies minimal elevation bindings only; rejects if `expiresAt` missing/past; rejects payloads that include export or `access.administration` unless **separate exceptional approval flag/path** exists (default deny)
    - Existing `revokeGrant` + `applyExpiryFailSafe` — withdraw elevation before next protected action
    - `completeBreakGlassPostUseReview` — independent reviewer only; toxic vs subject, requester, and prior approver of the **same incident/grant**; emits access event
    - `listBreakGlassGrants` / get helpers for Admin UI + banner hydration (`getActiveBreakGlassForAccount`)
  - [x] Extend `ToxicOperation` / self-toxic set with ops as needed: `grant.break_glass.request`, `grant.break_glass.approve`, `grant.break_glass.review` (or reuse `grant.*` with kind-aware checks — document choice; names must be stable for evidence)
  - [x] Configurable hooks (empty/missing → fail-closed):
    - max demo duration ceiling (e.g. reject `expiresAt` beyond configurable max — **do not invent production SLA**; use a clearly labeled demo default)
    - which elevations are allowed under break-glass (demo allow-list)
    - whether exceptional export / permission-admin can ever be co-approved (default: **false**)
  - [x] Every mutating API accepts actor + correlation id; before/after snapshots for access events (no HR values)
  - [x] Do **not** leave a silent bypass: ordinary `standard` assign must not become “break-glass without review”

- [x] Task 3: Enforcement — elevation + default denials + fail-closed expiry (AC: #2, #4)
  - [x] On `getSessionContext` / `applyProtectedEntryFailSafes`: expired/revoked break-glass withdraws elevation (reuse 2.4 lazy fail-safe)
  - [x] Hydrate session (or dedicated query) with **active break-glass summary** for banner: `{ active, expiresAt, incidentId?, grantId }` — `expiresAt` always present when active
  - [x] **Hard invariant under active break-glass:**
    - `action: "export"` → deny unless separate exceptional approval recorded on that grant
    - `access.administration` / permission-admin mutations → deny unless separate exceptional approval (default: never)
  - [x] Prefer enforcing denials in identity-access gates + envelope policy fixtures — document where each check lives
  - [x] Prove elevation with at least one **demo governed privileged HR read** procedure that:
    - denies without active break-glass (or without required binding)
    - allows under active minimal break-glass
    - still denies export / access-admin under the same grant
  - [x] Mid-session expire/revoke: next governed call fails closed; reuse «دسترسی شما تغییر کرد.» where appropriate
  - [x] NFR-6 note only: restored emergency grants remain invalid until catch-up — if no restore path exists, document as deferred hook comment; do not fake backup restore

- [x] Task 4: Access evidence for every transition (AC: #3)
  - [x] All break-glass mutations via `governedProcedure` + `mutateWithEvidence` with `sensitive: true`
  - [x] Stable operation names, e.g. `grant.break_glass.request` | `approve` | `activate` | `expire` | `revoke` | `post_use_review` (align with chosen ToxicOperation names)
  - [x] Meta pattern: privileged elevation admin ops use `access.administration` + `identity.access_admin` (same as 2.3/2.4); **privileged HR reads under elevation** use the demo category/action allowed by the minimal grant and emit access events with purpose/incident correlation — **no HR field values in payloads** (FR-51: actor/purpose/scope/volume/outcome)
  - [x] Evidence failure → compensate + fail closed
  - [x] Denied calls: Persian «دسترسی ندارید.» / existing toxic messages; no grant payload leakage

- [x] Task 5: Wire banner + Admin UI; remove mock toggle (AC: #1, #4, #5)
  - [x] Hydrate `PlatformStatusProvider` from server (layout RSC or tRPC query) with real active break-glass for the session account — **require `expiresAt`**; remove forever-live `active: true` + `expiresAt: null` as a valid live state for real grants
  - [x] Update `isGrantLive` / provider contract: live break-glass **requires** a finite `expiresAt` in the future (fix deferred-work forever-live mock)
  - [x] Preserve `BreakGlassBanner` + `BannerStack` (stale above break-glass); enhance copy to include incident hint if useful without clutter
  - [x] **Remove or gate** the personnel page demo toggle (`apps/web/app/(app)/personnel/page.tsx`) — must not fake authz; optional: leave a link to Access admin for operators with admin binding
  - [x] Extend Access admin UI (`EntitlementGrantsPanel` or sibling `break-glass-*.tsx`):
    - Request break-glass (incident, purpose, subject, minimal role/scope, required expiry)
    - Pending approve / activate / revoke
    - Post-use review queue (independent reviewer; hide self-review)
  - [x] Persian operational copy via `operational-copy.ts` (incident / review / deny-export / deny-admin under elevation); no emoji
  - [x] **Interactive a11y DoD:** keyboard operable; visible focus; dialogs Esc + focus return; `aria-live` polite for status; assertive only for blocking stale; RTL labels
  - [x] Client: tRPC React only — **never** import `@divan/identity-access` from client
  - [x] `assertPageAccess` before data load on `/access` — Layout ≠ RSC

- [x] Task 6: Policy fixtures, docs, deferred-work (AC: #1–#6)
  - [x] Demo PermissionSet / envelope rules for **minimal privileged HR read** under break-glass only; keep System Admin routine HR deny (2.2)
  - [x] Document hooks + defaults in module comment/README — AR-ACCESS owns production values
  - [x] Update `deferred-work.md`: mark 2.5 items done; leave temporal 2.6, bulk 2.7, artifact reauth consumers, emergency LDAP account (AR-IDENTITY), restore-invalidates-emergency-grants (NFR-6), optional paging/notification
  - [x] Update `.env.example` / README only if new keys required — prefer code defaults

- [x] Task 7: Selfcheck + DoD (AC: #1–#6)
  - [x] Add `break-glass.selfcheck.ts` (or extend entitlement-lifecycle selfcheck) covering the Testing table
  - [x] Wire `selfcheck:break-glass` at package + root `package.json`
  - [x] `pnpm` typecheck for `@divan/identity-access`, `@divan/db`, `@divan/audit-envelope`, `@divan/web` (+ lint web)
  - [x] Manual smoke: request as Admin A → Admin B approves → activate → banner on HR routes; export/admin denied; privileged demo read allowed + audited; expire/revoke → banner dismissible / cleared → next call denies; self-review blocked; dual-admin seed as needed
  - [x] When marking story done: keep story-file `Status` in sync with `sprint-status.yaml`

## Dev Notes

### Epic context

- **Epic 2:** Entitlements & Access Governance — FR2, FR3, FR4, FR46, FR47, FR48.
- **This story** delivers the **FR-46 break-glass / privileged access specialization**: incident-bound, minimal action/scope/time, independently approved, auto-expiring, independently post-reviewed; export + permission-admin denied by default.
- **Upstream (done):** 2.1 envelope + governedProcedure + freshness; 2.2 sensitive categories + SysAdmin no routine HR; 2.3 access-admin + toxic; 2.4 entitlement lifecycle + fail-safes + grants UI.
- **Downstream:** 2.6 temporal/cross-boundary must still bound break-glass retrievals (no bypass); 2.7 bulk/inference must not be bypassed by break-glass channels; 7.1/FR-51 consume privileged/break-glass evidence.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Full AR-ACCESS production matrix / toxic catalog / exact duration SLA | Launch artifacts |
| Emergency LDAP/local break-glass **account** vaulting, FIDO, dual-custody | AR-IDENTITY (open) |
| Temporal / as-of / cross-boundary retrieval semantics | Story 2.6 |
| Inference / small-cohort / volume thresholds | Story 2.7 |
| Full export artifact panel / exceptional export UX | Story 6.5 |
| Audit investigation UI / “no self-review of sensitive activity” surface | Story 7.1 (provide evidence + toxic review API here) |
| Paging / SIEM / credential rotation runbooks | Ops / infra-security |
| Changing five MVP coarse nav roles | Frozen Epic-1 |
| NestJS, CASL, Ability, Passport | Not in architecture |
| New Prisma audit tables / dual audit writers | AD-5 / 2.1 |
| Client import of `@divan/identity-access` | Lessons 1.5–1.6 / 2.3–2.4 |
| pg-boss required for expiry | Lazy-on-entry from 2.4 is enough |

### Architecture compliance (MUST)

| Rule | Implication |
| --- | --- |
| **AD-5** | identity-access owns break-glass grant + coarse bindings; audit-envelope owns fine-grained allow + access events for privileged I/O |
| **AD-6** | tRPC + Prisma projections; event-store raw SQL for evidence |
| **FR-46** | Break-glass: incident-bound, minimal, independently approved, auto-expires, independent post-use review; export + permission-admin denied by default |
| **FR-3** | System Admin has no routine HR access; elevation is time-bound, reasoned, audited, reviewed |
| **FR-51** | Required audit failure → fail-safe; no actor reviews own sensitive/break-glass activity for same incident |
| **FR-2 / 2.1** | Default-deny; UI ≠ data access; Layout ≠ RSC; session freshness not JWT-alone |
| **FR-49 / NFR-6** | Directory disablement + grant revoke before next action; restored emergency grants invalid by default (document if no restore path yet) |
| **UX-DR5 / 1.7** | Stale above break-glass; dismissible only on expiry; never obscure blocking stale |

[Source: `ARCHITECTURE-SPINE.md` AD-5/AD-6; `prd.md` FR-46/FR-3/FR-51; `EXPERIENCE.md` / `DESIGN.md` banner tokens; `infra-security-brief.md`]

### Authz / break-glass model for this story

```
Incident → request break_glass grant (incidentId, purpose, required expiresAt, minimal role/scope)
        → independent approve (toxic guards)
        → activate → apply MINIMAL elevation bindings (NOT export, NOT access.administration)
        → getSessionContext fail-safes + hydrate PlatformStatus → break-glass-banner on HR routes
        → privileged demo HR read via governedProcedure + access event (purpose/incident correlation)
        → export / permission-admin → DENY by default
        → expire (lazy fail-safe) OR revoke → withdraw bindings → banner dismisses → next action fail-closed
        → post-use independent review (attributable access event; toxic vs same-incident actors)
```

Coarse role unlocks **nav** only. Envelope + active break-glass elevation unlock **minimal privileged reads**. Export and access-admin stay separately governed.

### Design decisions (encode — do not reinvent mid-impl)

1. **Specialize 2.4, do not fork:** `kind: break_glass` on `EntitlementGrant`; reuse activate/withdraw/fail-safe/`mutateWithEvidence`. Parallel “BreakGlassSession” tables are forbidden unless a hard schema conflict is documented and approved in Dev Notes mid-impl (prefer extend).
2. **Required expiry:** Break-glass cannot activate or stay live without finite future `expiresAt`. Fix provider `isGrantLive` so `active + expiresAt: null` is **not** live for real grants.
3. **Minimal elevation:** Activation binds a demo HR-read role/PermissionSet only. Hard-reject grant payloads that would apply `access.administration` or export permission unless an explicit exceptional co-approval path is implemented (default off).
4. **Exceptional export/admin:** If implemented at all in this story, require a **separate** boolean/approval step on the same grant (or a second grant) — never implied by break-glass activation alone. Prefer shipping default-deny only if exceptional path threatens scope.
5. **Post-use review:** Distinct from recertification. Required after activate (or after first privileged use — pick one; document). Incomplete review must not keep the grant active past expiry (expiry still wins). Reviewer ≠ subject ≠ requester; also block prior approver of the same grant/incident (security C-1 / FR-51 spirit).
6. **Banner source of truth:** Server grant state → provider initial/hydration. Client dismiss only clears **local display** after expiry (or refetches); dismiss must not resurrect elevation.
7. **Remove mock toggle:** Personnel demo toggle invents privilege; replace with real grant-backed state or remove.
8. **Approval independence:** Same toxic rules as 2.4 elevated kinds; break-glass always requires independent approval (never fail-open if hooks omit it).
9. **Atomicity:** Preserve mutate-then-evidence + compensate; shared DB+event TX still out of scope.

### Current code to UPDATE (read before coding)

| File | Current state | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/db/prisma/schema.prisma` | EntitlementGrant + kinds without `break_glass`; no incident/review fields | Add kind + break-glass fields | No HR Person tables; no Prisma audit models |
| `packages/modules/identity-access/src/entitlement-lifecycle.ts` | Full lifecycle + fail-safes | Specialize `break_glass` validation/activate denylist; or call into `break-glass.ts` | TOCTOU `$transaction`+`updateMany`; applied*Binding flags; elevated-always-approve |
| `packages/modules/identity-access/src/access-admin.ts` | Toxic ops for grants | Add break-glass / post-use review toxic ops | Fail-closed empty registry; exact operation names |
| `packages/modules/identity-access/src/authenticate.ts` | `getSessionContext` + fail-safes | Hydrate active break-glass summary for session | LDAP password null; inactive fail-closed |
| `packages/modules/identity-access/src/index.ts` | Exports lifecycle | Export break-glass APIs | Clean public surface |
| `packages/kernel/audit-envelope/src/categories.ts` / policy | Notes 2.5 out of scope; SysAdmin no HR | Demo allow rule for privileged read **only under** elevation binding — prefer binding+role over blanket SysAdmin allow | Default-deny; read ≠ export |
| `apps/web/src/server/access-admin.ts` | Grant procedures + evidence | Break-glass + post-use review procedures | `assertActorHasAccessAdministration`; compensate |
| `apps/web/components/platform-status-provider.tsx` | Client mock; forever-live if `expiresAt` null | Server hydrate; require finite expiry for live | Stale/recalc fields; gold CTA gate |
| `apps/web/components/break-glass-banner.tsx` | Mock-driven UI contract | Real grant copy/incident; dismiss only when expired | Tokens; role=status; polite live |
| `apps/web/components/banner-stack.tsx` | Stale above break-glass | Only if hydration wiring needed | Precedence |
| `apps/web/app/(app)/layout.tsx` | Provider without break-glass initial | Pass server-derived initial break-glass | Shell structure |
| `apps/web/app/(app)/personnel/page.tsx` | **Demo toggle** fakes grant | Remove/replace — no fake authz | Page otherwise |
| `apps/web/components/access/entitlement-grants-panel.tsx` | Lifecycle UI | Break-glass request/review sections (or sibling) | Empty copy; a11y |
| `apps/web/lib/operational-copy.ts` | `breakGlassActive/Expired/Dismiss` | Review / incident / deny strings | Existing keys |
| `_bmad-output/implementation-artifacts/deferred-work.md` | Forever-live mock; 2.5 deferrals | Resolve 2.5 items; note remaining | Prior deferrals |
| `package.json` | `selfcheck:entitlement-lifecycle` | Add `selfcheck:break-glass` | Existing scripts |

### Likely NEW files

| Path | Role |
| --- | --- |
| `packages/db/prisma/migrations/<ts>_break_glass_grants/` | Schema migration |
| `packages/modules/identity-access/src/break-glass.ts` (optional) | Incident validation, denylist, post-use review |
| `packages/modules/identity-access/src/break-glass.selfcheck.ts` | Acceptance probes |
| `apps/web/components/access/break-glass-*.tsx` (optional split) | Admin request/review UI |
| `apps/web/src/server/` demo privileged-read procedure (or under existing router) | Prove elevation allow + export/admin deny |

### Previous story intelligence (2.4 — actionable)

- Break-glass is **same FR-46 paragraph, different path** — reuse grant/expiry/revoke; do not invent parallel privilege system.
- UI mock `expiresAt` in `platform-status-provider.tsx` is **not** ordinary grant expiry — wire deliberately.
- Elevated kinds always require approval even if hooks omit them — apply same to `break_glass`.
- Fail-safe transitions must emit events (`grant.expire` / `grant.revoke`).
- Activation: gated helpers + `$transaction` + conditional `updateMany` (TOCTOU).
- Privileged PermissionSets (`access.administration`) already require lifecycle — break-glass must **not** quietly grant this.
- `withdrawGrantBindings` only removes bindings this grant applied (`appliedRoleBinding` / `appliedScopeBinding`).
- Client never imports `@divan/identity-access`.
- Dual-admin needed for independent approve in seed env.
- Review pitfalls from 2.4: evidence compensate on activate; past `expiresAt` reject on activate; inactive subject reject on request.

[Source: `2-4-entitlement-lifecycle-grant-expiry-revocation-recertification.md` Review Findings + Completion Notes]

### Git intelligence

Recent commits: `cd102fe` story 2.4 → `9ecdfe9` story 2.3 → `722e7fc` story 2.2 → `642c5da` story 2.1 → `33cf076` story 1.8. Follow one-commit-per-story style (`story 2.5`) when user requests commit. Baseline tip: `cd102fe` (confirm clean tree before implement if 2.4 polish is still uncommitted).

### Latest technical notes (industry + stack)

- Industry pattern matches FR-46: time-boxed, auto-expiring, loud/audited, mandatory post-use review; least privilege for the incident only — not standing admin. Divan implements **broker-mediated JIT elevation** via grants (not a standing vaulted emergency directory account — that is AR-IDENTITY).
- Prefer explicit status columns + query filters over soft-delete middleware.
- Lazy fail-safe on protected entry remains the MVP revocation objective — do not invent AR-ACCESS millisecond SLAs.
- Do **not** add Permit.io / Casbin / external PAM brokers — architecture is AD-5 hybrid identity-access + audit-envelope only.

### Testing requirements

| Probe | Expected |
| --- | --- |
| Request `break_glass` without incidentId / purpose / expiresAt | Validation deny |
| Self-request / self-approve / self-review same incident | TOXIC / deny |
| Independent approve → activate | Minimal bindings; banner live with finite `expiresAt`; access events |
| Privileged demo HR read without grant | Deny |
| Privileged demo HR read with active break-glass | Allow + access event (purpose/incident correlation; no HR values) |
| Export under active break-glass (no exceptional approval) | Deny |
| Permission-admin / `access.administration` under break-glass | Deny |
| Past `expiresAt` then governed call | Fail-safe expire; elevation gone; banner dismissible / not live |
| Revoke then next governed call | Fail closed before action |
| Post-use review by independent actor | Status completed; access event |
| Evidence append failure | Compensate + error; no silent unaudited elevation |
| Personnel mock toggle | Gone or cannot fake elevation |

### Project Structure Notes

- Module ownership: `packages/modules/identity-access`
- Kernel: only demo policy/category hooks if needed — prefer elevation via bindings
- Web: `apps/web/src/server/access-admin.ts` (+ optional demo router), `components/access/`, `platform-status-provider.tsx`, `break-glass-banner.tsx`
- Align with monorepo seed: no new top-level packages

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2 / Story 2.5, Story 1.7 banner AC, UX-DR5]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-46 break-glass consequence, FR-3, FR-42, FR-49, FR-51, UJ-5, NFR-6/7]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — break-glass acceptance oracles / restore invalidation]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md` — Break-glass / Emergency HR access]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — `break-glass-banner` tokens]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — UJ-5, banner stack]
- [Source: `_bmad-output/specs/spec-divan/launch-artifacts.md` — AR-ACCESS open on break-glass]
- [Source: `_bmad-output/implementation-artifacts/2-4-entitlement-lifecycle-grant-expiry-revocation-recertification.md`]
- [Source: `_bmad-output/implementation-artifacts/2-3-access-administration-ui-apis.md`]
- [Source: `_bmad-output/implementation-artifacts/2-1-audit-envelope-default-deny-authorization-substrate.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- `pnpm db:migrate` applied `20260717010000_break_glass_grants`
- `pnpm selfcheck:break-glass` OK
- `pnpm selfcheck:entitlement-lifecycle` OK (regression)
- `pnpm selfcheck:access-admin` / `selfcheck:audit-envelope` OK
- Typecheck: `@divan/db`, `@divan/identity-access`, `@divan/audit-envelope`, `@divan/web`
- Lint: `@divan/web`

### Completion Notes List

- Specialized `EntitlementGrant` with `kind=break_glass` + incident/purpose/required expiry + post-use review fields; no parallel privilege tables.
- `break-glass.ts` hooks: demo max duration 8h, elevation allow-list (`demo.sensitive_hr.read`), exceptional export/admin co-approval default **false**.
- Activation binds seeded `break_glass_hr_read` only; denylist blocks `access.administration` / export perms unless exceptional flags (hooks off by default).
- Hard invariant under active BG: export + access.administration denied via `assertBreakGlassElevationLimits`.
- Session hydrates `breakGlass` summary; layout passes to `PlatformStatusProvider`; `isGrantLive` requires finite future `expiresAt`.
- Personnel mock toggle removed; Access admin has `BreakGlassPanel` (request / approve / activate / revoke / post-use review).
- Demo procedure `demoBreakGlassPrivilegedHrRead` requires elevation binding; evidence via governedProcedure.
- NFR-6 restore-invalidates documented as deferred hook in module comment (no restore path yet).
- Access admin expiry/recert fields use `JalaliDateTimePicker` (not browser `datetime-local`); list rows show Jalali via `formatJalaliDateTimeFromIso`.

### File List

- `_bmad-output/implementation-artifacts/2-5-break-glass-privileged-access.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/app/(app)/personnel/page.tsx`
- `apps/web/components/access/access-admin-panel.tsx`
- `apps/web/components/access/break-glass-panel.tsx`
- `apps/web/components/access/entitlement-grants-panel.tsx`
- `apps/web/components/break-glass-banner.tsx`
- `apps/web/components/platform-status-provider.tsx`
- `apps/web/lib/jalali.ts`
- `apps/web/lib/operational-copy.ts`
- `apps/web/src/server/access-admin.ts`
- `apps/web/src/server/context.ts`
- `apps/web/src/server/root.ts`
- `package.json`
- `packages/db/prisma/migrations/20260717010000_break_glass_grants/migration.sql`
- `packages/db/prisma/schema.prisma`
- `packages/db/src/index.ts`
- `packages/kernel/audit-envelope/src/categories.ts`
- `packages/modules/identity-access/package.json`
- `packages/modules/identity-access/src/access-admin.ts`
- `packages/modules/identity-access/src/authenticate.ts`
- `packages/modules/identity-access/src/break-glass.selfcheck.ts`
- `packages/modules/identity-access/src/break-glass.ts`
- `packages/modules/identity-access/src/entitlement-lifecycle.selfcheck.ts`
- `packages/modules/identity-access/src/entitlement-lifecycle.ts`
- `packages/modules/identity-access/src/index.ts`
- `packages/modules/identity-access/src/seed.ts`
- `packages/modules/identity-access/src/types.ts`

### Review Findings

- [x] [Review][Decision] Preexisting role binding on break-glass activate — resolved as **(B) force withdraw**: break_glass claims `appliedRoleBinding` even if preexisting and always withdraws elevation role on expire/revoke
- [x] [Review][Patch] Privileged HR read must require a live break_glass grant, not only PermissionSet binding [`packages/modules/identity-access/src/break-glass.ts`]
- [x] [Review][Patch] Block ordinary standard assign / `requestGrant(kind:standard)` from binding the seeded break-glass elevation role without incident lifecycle
- [x] [Review][Patch] Sync break-glass banner after activate/revoke (`me` poll + `initial` sync + layout `TRPCReactProvider`) [`apps/web/components/platform-status-provider.tsx`]
- [x] [Review][Patch] Post-use review toxic must block subject/requester/approver across the same `incidentId`, not only the same grant row
- [x] [Review][Patch] Reject overlapping second active break_glass for the same subject
- [x] [Review][Patch] `recertifyGrant` disallowed for `break_glass`
- [x] [Review][Patch] BreakGlassPanel uses `waiveGrant` for requested and `revokeGrant` for approved
- [x] [Review][Patch] Remove `break_glass` from EntitlementGrantsPanel kind dropdown
- [x] [Review][Patch] Kind-aware evidence/toxic ops `grant.break_glass.approve` / `grant.break_glass.activate`
- [x] [Review][Patch] Centralize export deny under active BG in `governedProcedure` when `meta.action === "export"`
- [x] [Review][Patch] Re-validate duration ceiling at activate and reject Invalid Date `expiresAt`
- [x] [Review][Patch] Require `accessRoleId` for break_glass request
- [x] [Review][Patch] Concurrent post-use review: conditional `updateMany` where `postUseReviewStatus=pending`
- [x] [Review][Patch] Interpret break-glass expiry picker wall-clock as `Asia/Tehran`
- [x] [Review][Patch] Cap `incidentId` / `purpose` length

- [x] [Review][Defer] PermissionSet of elevated role mutated after activate gains unchecked perms — deferred, pre-existing admin mutability; AR-ACCESS continuous revalidation

## Change Log

- 2026-07-17: Story context created (ready-for-dev) — ultimate context engine analysis completed
- 2026-07-17: Implemented break-glass specialization (schema, lifecycle, banner hydrate, admin UI, selfcheck) — status → review
- 2026-07-17: Replaced Access admin `datetime-local` expiry fields with `JalaliDateTimePicker` (break-glass + entitlement panels); list display uses Jalali
- 2026-07-17: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — findings recorded
- 2026-07-17: Code review patches applied (force-withdraw decision + 15 patches); status → done
