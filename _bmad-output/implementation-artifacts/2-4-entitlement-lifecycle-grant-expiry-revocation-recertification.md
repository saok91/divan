---
baseline_commit: 9ecdfe9
---

# Story 2.4: Entitlement Lifecycle — Grant, Expiry, Revocation & Recertification

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Security / HR Data Owner,
I want entitlements to follow request → approval → activation → expiry → revocation → recertification,
so that sensitive/global/bulk grants cannot linger without governance (FR46).

## Gate (read first)

**AR-ACCESS is still `pending`.** This story ships a **real entitlement lifecycle state machine + enforcement hooks + access evidence** — not the production field×action×scope matrix, break-glass elevation, temporal/as-of authz, or bulk/inference thresholds.

- Do **not** invent the full AR-ACCESS launch matrix, exact production revocation SLA milliseconds, break-glass incident workflows, or LDAP group→role/scope sync.
- Do **not** invent new MVP coarse nav roles — five Epic-1 codes stay frozen (`identity-access-epic1-freeze.md`).
- Do **not** implement break-glass UI/banner grant path (Story 2.5), temporal/as-of retrieval (2.6), or inference/bulk controls (2.7).
- Ship **configurable, fail-closed** lifecycle hooks: grant classes that require independent approval; recertification overdue → suspend or revoke (cannot stay active indefinitely); revocation/directory disablement enforced **before the next protected action**.
- Reuse Story 2.1–2.3 substrate (`governedProcedure`, `authorizeOrThrow`, access events, toxic hooks, access-admin CRUD/UI) — **extend**; do not invent CASL/Nest/Ability/Passport or parallel Prisma audit tables.
- Permission administration + grant lifecycle mutations MUST go through the envelope with explicit `access.administration` — **never** “hr_admin coarse role ⇒ allow.”

[Source: `epics.md` Story 2.4; `prd.md` FR-46; `ARCHITECTURE-SPINE.md` AD-5; Stories 2.1–2.3; `identity-access-epic1-freeze.md`; `launch-artifacts.md`]

## Acceptance Criteria

1. **Given** AR-ACCESS lifecycle hooks (configurable; matrix may still be pending)  
   **When** a sensitive, global, bulk, or mass-assignment grant is requested  
   **Then** attributable independent approval is required; requester cannot approve or waive their own grant

2. **When** revocation or directory-driven disablement occurs  
   **Then** enforcement applies before the next protected action within the finite AR-ACCESS/AR-IDENTITY objective; queued work and artifact retrieval reauthorize (or fail closed)

3. **When** recertification is overdue  
   **Then** the entitlement is suspended or revoked under a mandatory fail-safe rule (cannot remain active indefinitely because a reviewer did not act)

4. **And** all lifecycle transitions emit access events (`event_class=access`) with attributable before/after evidence

5. **And** toxic self-approval / admin+approve-same-grant remain fail-closed (extend Story 2.3 hooks onto real grant APIs — not only `previewApproveGrant`)

## Tasks / Subtasks

- [x] Task 1: EntitlementGrant projection + lifecycle enums (AC: #1, #3, #4)
  - [x] Add Prisma model(s) under `packages/db/prisma` owned by identity-access semantics, e.g. `EntitlementGrant` (name flexible) with at least:
    - stable `id`
    - `subjectAccountId` (target InternalAccount)
    - `requesterAccountId`, optional `approverAccountId`
    - grant class / kind: at least `sensitive` | `global` | `bulk` | `mass_assignment` | `standard` (or equivalent configurable enum/string set)
    - binding target: `accessRoleId` and/or `organizationalScopeId` and/or permission-set reference as needed for the grant payload
    - status: `requested` → `approved` → `active` → (`expired` | `revoked` | `suspended`) — exact names flexible; document transitions
    - `startsAt`, `expiresAt` (nullable for standing grants that still require recert)
    - `recertifyBy` / `recertificationDueAt` (nullable until activated)
    - `revokedAt`, `revokeReason` (optional), correlation-friendly fields as needed
    - timestamps `createdAt` / `updatedAt`
  - [x] Indexes for subject+status, `expiresAt`, `recertifyBy`, and approver lookups
  - [x] Migration via Prisma only — **no new Prisma audit tables** (evidence stays event-store)
  - [x] Keep `AccountAccessRole` / `AccountOrganizationalScope` as the **effective binding** projections; grants **govern** when/how those bindings are applied or withdrawn — do not silently replace Story 2.3 CRUD semantics for role/permission-set/scope definitions
  - [x] Seed: optional non-sensitive demo grant fixtures for selfcheck only; do **not** seed sensitive/export category grants by default

- [x] Task 2: Lifecycle module APIs + toxic guards (AC: #1, #3, #4, #5)
  - [x] Prefer a dedicated module file (e.g. `entitlement-lifecycle.ts`) **or** a clearly separated section in `access-admin.ts` — keep state-machine pure and testable
  - [x] Publish server APIs from `@divan/identity-access` (no React):
    - `requestGrant` — creates `requested`; toxic: cannot request for self when grant class requires independent approval (FR-46: no actor may request/approve/recertify/waive own sensitive/global/bulk grant)
    - `approveGrant` — independent approver only; replace/retire stub `previewApproveGrant` (keep toxic-compatible wrapper or delete stub after callers updated)
    - `activateGrant` — applies effective bindings (role/scope) when approved + start time reached; emits evidence
    - `revokeGrant` — immediate status → revoked; removes/disables effective bindings for that grant
    - `waiveGrant` / reject path if needed — still toxic-guarded; cannot waive own grant
    - `recertifyGrant` — independent actor; advances `recertifyBy`; cannot recertify own grant
    - `listGrants` / `getGrant` for Admin UI
    - `applyOverdueRecertificationFailSafe` (name flexible) — suspend or revoke when `recertifyBy < now` and still active
    - `applyExpiryFailSafe` — expire when `expiresAt < now` and still active
  - [x] Extend `ToxicOperation` / `SELF_TOXIC_OPERATIONS` with real ops: `grant.request`, `grant.approve`, `grant.waive`, `grant.recertify`, `grant.activate` (as needed); call `assertToxicCombinationAllowed` with `combinesPermissionAdminWithSameGrantApproval` when actor holds access-admin and is approving the same grant
  - [x] Configurable hook registry (empty/missing → fail-closed for classes that require approval):
    - which grant kinds require independent approval
    - overdue recertification action: `suspend` | `revoke` (default must not leave active)
    - demo/dev finite “revocation objective”: enforce on **next protected action** (see Task 3) — do not invent production SLA numbers
  - [x] Every mutating API accepts actor + correlation id; returns before/after snapshots suitable for access-event payload (no HR field values)
  - [x] Gate Story 2.3 **direct** paths that FR-46 elevates to independent approval:
    - `assignAccountAccessRoles` / mass scope assign when classified as sensitive/global/bulk/mass-assignment
    - **role creation** and **Organizational Scope creation** (FR-46: “role/scope creation or mass-assignment grants”) — either wrap create in a grant/request→approve→activate flow, or reject immediate create for non-demo paths with Persian copy directing to approval workflow
    - Document the chosen rule in Dev Notes; do **not** leave a silent bypass for these classes

- [x] Task 3: Enforcement before next protected action (AC: #2, #3)
  - [x] On every `governedProcedure` entry (and/or `getSessionContext` freshness path used by governed calls): evaluate subject grants — `expired` / `revoked` / `suspended` / overdue-recert (after fail-safe apply) must **not** contribute effective bindings
  - [x] Run expiry + overdue-recert fail-safe **lazily on protected entry** (acceptable MVP — no required pg-boss job in this story). Optional lightweight worker later; do not block on inventing cron infra
  - [x] Directory-driven disablement: when account status → `inactive` (admin or LDAP-linked path already fail-closed at login), **revoke or suspend active grants** for that account and ensure next protected action denies — align with FR-49 “directory disablement … entitlement revocation … before next protected action”
  - [x] Queued work / artifact retrieval: if no queue/artifact surfaces exist yet, add an explicit **reauthorize hook** (function + selfcheck stub) that future Stories 6.x / 7.x / export paths MUST call — document in deferred-work; do not fake full artifact lifecycle
  - [x] UX for mid-session revocation when Admin surface is open: reuse EXPERIENCE pattern «دسترسی شما تغییر کرد.» where a protected action fails due to revoked/suspended entitlement (modal or inline operational copy — keep minimal; full draft-save flow is Epic 4+)

- [x] Task 4: Access evidence for every transition (AC: #4)
  - [x] All lifecycle mutations via `governedProcedure` + `mutateWithEvidence` (or equivalent) with `sensitive: true`
  - [x] Stable operation names, e.g. `grant.request`, `grant.approve`, `grant.activate`, `grant.revoke`, `grant.expire`, `grant.suspend`, `grant.recertify`
  - [x] Meta: `permission: "access.administration"`, `dataCategory: "identity.access_admin"`, `action: "write"|"read"`, `organizationalScope: "org:any"` (same pattern as Story 2.3)
  - [x] Evidence failure → compensate + fail closed (FR-51) — keep Story 2.3 compensate pattern; do not invent dual audit writers
  - [x] Denied calls: Persian «دسترسی ندارید.» / existing toxic message; no grant payload leakage on deny

- [x] Task 5: سطح دسترسی‌ها UI — lifecycle section (AC: #1–#4)
  - [x] Extend `AccessAdminPanel` (or sibling components under `apps/web/components/access/`) — one job per section:
    - Grant list (filter by status)
    - Request grant (kind + subject + role/scope + optional expiry/recert due)
    - Pending approvals (approve / reject) — **not** shown as self-approve for current user
    - Active grants: revoke; show expiry / recert due
    - Overdue / suspended indicators with operational Persian copy
  - [x] Preserve existing empty entitlements copy when no assignments: «تخصیص دسترسی‌ای ثبت نشده.»
  - [x] Add lifecycle empty/error copy via `operational-copy.ts` (Persian); no emoji
  - [x] **Interactive a11y DoD** (open sprint action item — encode here):
    - Keyboard operable controls; visible focus rings
    - Dialogs: Esc closes + focus returns to trigger
    - Loading / empty / error states announced appropriately (`aria-live` polite for status; assertive only for blocking alerts)
    - No emoji; RTL Persian labels
  - [x] `assertPageAccess` before data load on `/access` — Layout ≠ RSC
  - [x] Client: tRPC React only — **never** import `@divan/identity-access` from client (pulls `pg`)
  - [x] Do **not** build break-glass banner grant UI (2.5) or audit investigation UI (7.1)

- [x] Task 6: Policy fixtures, docs, deferred-work (AC: #1–#5)
  - [x] Extend demo policy / PermissionSet only as needed for grant lifecycle ops (still `access.administration`)
  - [x] Document configurable hooks + defaults in module README or short comment block — AR-ACCESS owns production values
  - [x] Update `deferred-work.md`: break-glass 2.5; temporal 2.6; bulk 2.7; artifact reauth consumers; optional background expiry worker; AR-ACCESS matrix still pending
  - [x] Update `.env.example` / README only if new keys are required (e.g. demo recert interval) — prefer code defaults over new env unless necessary

- [x] Task 7: Selfcheck + DoD (AC: #1–#5)
  - [x] Add `entitlement-lifecycle.selfcheck.ts` (or extend `access-admin.selfcheck.ts`) covering the Testing table
  - [x] Wire `selfcheck:entitlement-lifecycle` (and/or extend `selfcheck:access-admin`) at package + root `package.json`
  - [x] `pnpm` typecheck for `@divan/identity-access`, `@divan/db`, `@divan/audit-envelope`, `@divan/web` (+ lint web)
  - [x] Manual smoke: request sensitive/global grant as Admin A → Admin B approves → activate → access event; self-approve blocked; expire/overdue-recert → suspended/revoked → next governed call denies; deactivate account → grants fail closed; `hr.operator` / `sys.admin` cannot run grant admin APIs
  - [x] When marking story done: keep story-file `Status` in sync with `sprint-status.yaml`

### Review Findings

- [x] [Review][Decision→Patch] `role_create` / `scope_create` catalog-only on activate — skip subject bind; assign remains a separate grant. Resolved 2026-07-17.
- [x] [Review][Decision→Patch] Privileged PermissionSets (`access.administration`) require lifecycle even on `standard` / single assign. Resolved 2026-07-17.
- [x] [Review][Defer] `mass_assignment` multi-target fulfillment — deferred; gate stays, payload/activate later (AR-ACCESS / follow-up). Reason: avoid scope creep; mass path already blocked at direct assign.
- [x] [Review][Decision→Patch] Recertify also blocks original `requesterAccountId` for elevated kinds. Resolved 2026-07-17.

- [x] [Review][Patch] Fail-safe transitions emit no access events [`packages/modules/identity-access/src/entitlement-lifecycle.ts:852`] — fixed: emit `grant.expire` / `grant.suspend` / `grant.revoke` via event-store
- [x] [Review][Patch] `activateGrant` evidence compensate leaves bindings/catalog live [`apps/web/src/server/access-admin.ts:883`] — fixed: `compensateActivateGrant`
- [x] [Review][Patch] Activation uses raw Prisma create instead of gated helpers [`packages/modules/identity-access/src/entitlement-lifecycle.ts:636`] — fixed: `createAccessRole` / `createOrganizationalScope` with `viaLifecycleActivation`
- [x] [Review][Patch] Partial hooks list fails open for omitted elevated kinds [`packages/modules/identity-access/src/entitlement-lifecycle.ts:117`] — fixed: elevated kinds always require approval
- [x] [Review][Patch] Assign evidence compensate cannot restore multi-binding history [`apps/web/src/server/access-admin.ts:514`] — fixed: `viaLifecycleActivation: true` on compensate
- [x] [Review][Patch] `withdrawGrantBindings` removes pre-lifecycle bindings [`packages/modules/identity-access/src/entitlement-lifecycle.ts:522`] — fixed: `appliedRoleBinding` / `appliedScopeBinding` flags
- [x] [Review][Patch] `activateGrant` ignores `expiresAt` already in the past [`packages/modules/identity-access/src/entitlement-lifecycle.ts:616`] — fixed
- [x] [Review][Patch] Activate/fail-safe status transitions are non-transactional / TOCTOU [`packages/modules/identity-access/src/entitlement-lifecycle.ts:629`] — fixed: `$transaction` + conditional `updateMany`
- [x] [Review][Patch] `requestGrant` allows inactive subject accounts [`packages/modules/identity-access/src/entitlement-lifecycle.ts:263`] — fixed
- [x] [Review][Patch] Activate does not re-validate existing role/scope targets [`packages/modules/identity-access/src/entitlement-lifecycle.ts:660`] — fixed
- [x] [Review][Patch] `recertifyGrant` can restore a grant past `expiresAt` [`packages/modules/identity-access/src/entitlement-lifecycle.ts:761`] — fixed
- [x] [Review][Patch] `role_create` request does not verify `permissionSetId` exists [`packages/modules/identity-access/src/entitlement-lifecycle.ts:266`] — fixed

- [x] [Review][Defer] Empty `assignAccountAccessRoles`/`assignAccountScopes` wipe bypasses mass gate [`packages/modules/identity-access/src/access-admin.ts:679`] — deferred, pre-existing
- [x] [Review][Defer] Legacy/non-grant bindings invisible to expiry and recert fail-safes [`packages/modules/identity-access/src/entitlement-lifecycle.ts:878`] — deferred, pre-existing

## Dev Notes

### Epic context

- **Epic 2:** Entitlements & Access Governance — FR2, FR3, FR4, FR46, FR47, FR48.
- **This story** delivers the **FR-46 entitlement lifecycle** (request → independent approval → activation → expiry → revocation → recertification + evidence). Break-glass specialization is Story 2.5 (same FR-46 paragraph, different path).
- **Upstream (done):** 2.1 envelope + governedProcedure + freshness; 2.2 categories/export omit; 2.3 access-admin projections, toxic hooks, `/access` UI, `previewApproveGrant` stub.
- **Downstream:** 2.5 break-glass uses grant/expiry/revoke patterns; 2.6 bounded grants + mid-session revoke UX; 2.7 additional approval for sensitive/bulk retrieval (shares approval evidence plane, not inference thresholds).

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Full AR-ACCESS production matrix / toxic catalog / exact revocation SLA | Launch artifacts |
| Break-glass incident-bound grants + banner + post-use review | Story 2.5 |
| Temporal / as-of / cross-boundary retrieval | Story 2.6 |
| Inference / small-cohort / volume thresholds | Story 2.7 |
| LDAP/AD group → role or scope sync | AR-IDENTITY (still open) |
| Changing five MVP coarse nav roles | Frozen Epic-1 |
| Full artifact custody / export reauth UI | Stories 6.5 / FR-52 (provide hook only) |
| Audit investigation UI | Story 7.1 |
| NestJS, CASL, Ability, Passport | Not in architecture |
| New Prisma audit tables / dual audit writers | AD-5 / 2.1 FR42 plan |
| Client import of `@divan/identity-access` | Lessons 1.5–1.6 / 2.3 |
| pg-boss required for expiry | Optional later; lazy-on-entry is enough for MVP |

### Architecture compliance (MUST)

| Rule | Implication |
| --- | --- |
| **AD-5** | identity-access owns grant lifecycle + coarse bindings; audit-envelope owns fine-grained allow + access events |
| **AD-6** | tRPC + Prisma projections; event-store raw SQL for evidence |
| **FR-46** | Full lifecycle + independent approval + fail-safe overdue recert + revoke before next protected action |
| **FR-51** | Required audit failure → fail-safe; no self-approve of own sensitive activity |
| **FR-49** | Directory disablement + entitlement revocation before next protected action |
| **FR-2 / 2.1** | Default-deny; UI ≠ data access; Layout ≠ RSC; session freshness not JWT-alone |
| **FR-4 / 2.3** | Admin surface remains attributable; lifecycle extends it |
| **UX** | دسترسی‌ها; empty «تخصیص دسترسی‌ای ثبت نشده.»; mid-session «دسترسی شما تغییر کرد.» |

[Source: `ARCHITECTURE-SPINE.md` AD-5/AD-6; `prd.md` FR-46/FR-49/FR-51; `EXPERIENCE.md`; `infra-security-brief.md`]

### Authz / lifecycle model for this story

```
Admin UI (/access)  →  assertPageAccess (coarse nav)
                    →  tRPC governedProcedure (access.administration)
                           ↓
identity-access entitlement lifecycle
  request → (toxic) → approve → activate → bindings (AccountAccessRole / Scope)
                           ↓ expire / revoke / suspend / recert fail-safe
audit-envelope authorizeOrThrow + access event (before/after)
                           ↓
NEXT protected action: getSessionContext / governed entry
  apply expiry+overdue fail-safe → effective grants only if active+non-expired
```

Coarse role `hr_admin` unlocks **nav** only. Envelope policy + PermissionSet + **active governed grants** unlock mutations.

### Design decisions (encode — do not reinvent mid-impl)

1. **Grants layer on bindings:** Keep Story 2.3 `AccountAccessRole` / `AccountOrganizationalScope` as effective membership. Activation writes bindings; revoke/expire/suspend removes or marks them ineffective for that grant. Avoid dual sources of truth without an explicit “effective = f(bindings, grants)” rule documented in code.
2. **Direct assign / create bypass:** Mass/sensitive/global/bulk changes MUST NOT silently use `assignAccountAccessRoles` without lifecycle. **Role creation and Organizational Scope creation** also require attributable independent approval per FR-46 — prefer modeling them as grant kinds (`role_create` / `scope_create`) or blocking immediate `createAccessRole` / `createOrganizationalScope` until approved. Standard/non-sensitive single assigns may remain for Admin convenience **only if** clearly classified as `standard` and documented; when in doubt, require lifecycle.
3. **Approval independence:** Approver ≠ requester; approver ≠ subject; if actor has `access.administration` and is approving a grant they also administered as the same change set, set `combinesPermissionAdminWithSameGrantApproval: true` → fail-closed unless matrix allow rule exists.
4. **Recert fail-safe:** Prefer `suspend` (bindings ineffective, recoverable by recertify) as default demo policy; `revoke` also acceptable — must be configurable; **never** leave `active` past `recertifyBy`.
5. **Revocation objective:** Implement as “before next protected action” via governed entry / session freshness — matches FR-46/FR-47 language without inventing AR-ACCESS millisecond SLAs.
6. **Atomicity:** Preserve mutate-then-evidence + compensate from 2.3; shared DB+event TX is out of scope unless already available.

### Current code to UPDATE (read before coding)

| File | Current state | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/db/prisma/schema.prisma` | Scope / PermissionSet / AccessRole / joins; no Grant | Add EntitlementGrant (+ enums) | No HR Person tables; no Prisma audit models; coarseRole nav-only |
| `packages/modules/identity-access/src/access-admin.ts` | CRUD + toxic + `previewApproveGrant` stub; immediate `assignAccountAccessRoles` | Gate mass/sensitive assign; wire toxic ops; may call lifecycle helpers | Toxic fail-closed defaults; PermissionSet explicitness |
| `packages/modules/identity-access/src/index.ts` | Exports admin APIs + stub | Export lifecycle APIs | Public surface cleanliness |
| `packages/modules/identity-access/src/access-admin.selfcheck.ts` | Toxic + CRUD checks | Extend or split lifecycle selfcheck | Restore fixtures in `finally` |
| `packages/modules/identity-access/src/authenticate.ts` / session context | Freshness + scope hydration | Ensure inactive / revoked grants do not hydrate as effective | LDAP password null; fail-closed inactive |
| `packages/kernel/audit-envelope/src/index.ts` | 4-tuple authorize | Only if grant status must participate in allow decision beyond binding hydration — prefer binding withdrawal so envelope stays unchanged when possible | Default-deny; category registry |
| `apps/web/src/server/access-admin.ts` | governed router + `mutateWithEvidence` + stub procedure | Real grant procedures + evidence ops | `assertActorHasAccessAdministration`; compensate pattern |
| `apps/web/components/access/access-admin-panel.tsx` | Lists + first-item assign | Lifecycle panels | Empty copy; a11y focus rings |
| `apps/web/lib/operational-copy.ts` | Operational Persian strings | Lifecycle / revoked-mid-session strings | Existing keys |
| `apps/web/app/(app)/access/page.tsx` | Panel host + assertPageAccess | Only if new RSC data needed | Layout ≠ RSC |
| `_bmad-output/implementation-artifacts/deferred-work.md` | 2.3 deferrals | Note lifecycle done; remaining 2.5–2.7 / workers | Keep prior deferrals |
| `package.json` | `selfcheck:access-admin` | Add lifecycle selfcheck script | Existing scripts |

### Likely NEW files

| Path | Role |
| --- | --- |
| `packages/db/prisma/migrations/<ts>_entitlement_grants/` | Grant projection migration |
| `packages/modules/identity-access/src/entitlement-lifecycle.ts` | State machine + fail-safe |
| `packages/modules/identity-access/src/entitlement-lifecycle.selfcheck.ts` | Acceptance probes |
| `apps/web/components/access/*-grants*.tsx` (optional split) | UI sections |

### Previous story intelligence (2.1–2.3)

- **Gate discipline:** AR-ACCESS pending → configurable hooks + fail-closed; never invent production matrix.
- **Two-layer allow:** envelope 4-tuple **and** explicit PermissionSet / admin binding check (`assertActorHasAccessAdministration`).
- **Evidence:** event-store only; compensate if append fails after mutate.
- **Toxic names must be exact** (`access.scope.assign` vs role) — extend carefully for grant ops.
- **Self-target** status/link/role/approve already fail-closed — extend to request/recertify/waive.
- **Client must not import identity-access.**
- **Review pitfalls to not regress:** empty permission sets; inactive scope assign; P2002 → CONFLICT; trim validation; `actor_account_id` TEXT alignment.
- **Break-glass `expiresAt` in `platform-status-provider.tsx` is UI mock for Story 2.5** — do not conflate with EntitlementGrant expiry.

[Source: `2-3-access-administration-ui-apis.md` Review Findings; `2-1` / `2-2` Dev Notes]

### Git intelligence

Recent commits: `9ecdfe9` story 2.3 → `722e7fc` story 2.2 → `642c5da` story 2.1. Follow one-commit-per-story style (`story 2.4`) when user requests commit.

### Latest technical notes

- Prefer explicit grant status columns + query filters over soft-delete middleware for revocation/expiry (clearer audit before/after).
- Lazy fail-safe on protected entry is sufficient; optional later: pg-boss job in `workers/` (structural seed exists — not required here).
- Do **not** add Permit.io / Casbin / polizy — architecture is AD-5 hybrid identity-access + audit-envelope only.

### Testing requirements

| Probe | Expected |
| --- | --- |
| Request sensitive/global/bulk/mass grant | Status `requested`; access event |
| Self-approve / self-waive / self-recertify | TOXIC / deny |
| Admin+approve-same-grant when matrix empty | Deny |
| Independent approve → activate | Bindings effective; events for approve+activate |
| Past `expiresAt` then governed call | Fail-safe expire; deny / bindings gone |
| Past `recertifyBy` then governed call | Suspend or revoke; cannot stay active |
| Revoke then next governed call | Deny before action |
| Deactivate subject account | Grants revoked/suspended; next action fail-closed |
| `hr.operator` / `sys.admin` grant APIs | Deny (no access.administration binding) |
| Evidence append failure | Compensate + error; no silent unaudited grant |

### Project Structure Notes

- Module ownership: `packages/modules/identity-access`
- Kernel unchanged unless hydration forces a tiny hook — prefer module-side effective-grant resolution
- Web: `apps/web/src/server/access-admin.ts` + `components/access/`
- Align with monorepo seed: no new top-level packages

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2 / Story 2.4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-46, FR-49, FR-51]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md` — §12.3 acceptance / §12.4 security tests]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md` — session/revocation]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — دسترسی‌ها, empty copy, «دسترسی شما تغییر کرد.»]
- [Source: `_bmad-output/specs/spec-divan/identity-access-epic1-freeze.md` — pending entitlement/recertification bounds]
- [Source: `_bmad-output/specs/spec-divan/launch-artifacts.md` — AR-ACCESS still open]
- [Source: `_bmad-output/implementation-artifacts/2-3-access-administration-ui-apis.md` — patterns + deferrals]
- [Source: `_bmad-output/implementation-artifacts/2-1-audit-envelope-default-deny-authorization-substrate.md` — envelope substrate]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- access-admin.selfcheck: ok
- entitlement-lifecycle.selfcheck: ok
- audit-envelope.selfcheck: ok
- governed.selfcheck: ok
- typecheck: @divan/identity-access, @divan/db, @divan/web
- lint: @divan/web

### Implementation Plan

- Prisma `EntitlementGrant` + enums; bindings remain AccountAccessRole/Scope.
- Dedicated `entitlement-lifecycle.ts` state machine with configurable hooks (default overdue → suspend).
- FR-46 gate: direct role/scope create and mass assign blocked; privileged (`access.administration`) single assign also requires lifecycle; UI create paths submit `role_create`/`scope_create` grants (catalog-only activate); non-privileged single standard assign remains.
- Lazy fail-safe on `getSessionContext`; directory disablement revokes grants; `reauthorizeForQueuedOrArtifactWork` hook for future artifact paths.
- Governed tRPC procedures with mutateWithEvidence for all grant transitions; UI `EntitlementGrantsPanel` with toxic-aware approve/waive.

### Completion Notes List

- ✅ Entitlement lifecycle request→approve→activate→expire/revoke/suspend/recert with access evidence
- ✅ Independent approval toxic guards (self-request/approve/waive/recertify; admin+same-grant)
- ✅ Fail-safe overdue recert (suspend default) and expiry before next protected action
- ✅ Account inactive → revokeActiveGrantsForAccount (FR-49)
- ✅ Selfcheck covers Testing table probes; demo non-admin role used so operator never gains access.administration
- Chosen create rule: immediate `createAccessRole`/`createOrganizationalScope` reject with Persian lifecycle copy; web createScope/createRole enqueue grant requests instead
- Code review 2026-07-17: catalog-only `role_create`/`scope_create` activate; privileged `access.administration` roles require lifecycle even on single assign; fail-safe access events; activate compensate + transactional claim; requester blocked on elevated recertify; `mass_assignment` multi-target deferred

### File List

- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/20260716230000_entitlement_grants/migration.sql
- packages/db/src/index.ts
- packages/modules/identity-access/src/entitlement-lifecycle.ts
- packages/modules/identity-access/src/entitlement-lifecycle.selfcheck.ts
- packages/modules/identity-access/src/access-admin.ts
- packages/modules/identity-access/src/access-admin.selfcheck.ts
- packages/modules/identity-access/src/authenticate.ts
- packages/modules/identity-access/src/index.ts
- packages/modules/identity-access/package.json
- apps/web/src/server/access-admin.ts
- apps/web/components/access/access-admin-panel.tsx
- apps/web/components/access/entitlement-grants-panel.tsx
- apps/web/app/(app)/access/page.tsx
- apps/web/lib/operational-copy.ts
- package.json
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/2-4-entitlement-lifecycle-grant-expiry-revocation-recertification.md

## Change Log

- 2026-07-16: Implemented FR-46 entitlement lifecycle (grant projection, APIs, fail-safes, governed evidence, Admin UI, selfcheck) — status → review
- 2026-07-17: Code review patches applied (evidence, compensate, privileged gate, catalog-only create, TOCTOU, toxic recert) — status → done
