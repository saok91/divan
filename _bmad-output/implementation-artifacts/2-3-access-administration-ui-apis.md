---
baseline_commit: 722e7fc
---

# Story 2.3: Access Administration UI & APIs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Admin,
I want to manage roles, permissions, Organizational Scopes, account links, and active status,
so that entitlements stay explicit, attributable, and reviewable (FR4).

## Gate (read first)

**AR-ACCESS is still `pending`.** This story ships **governed access-administration CRUD + attribution + toxic fail-closed hooks + سطح دسترسی‌ها UI** — not the production field×action×scope matrix, full entitlement lifecycle, or break-glass.

- Do **not** invent the full AR-ACCESS launch matrix, bulk thresholds, break-glass elevation, or LDAP group→role/scope sync.
- Do **not** invent new MVP coarse nav roles — the five Epic-1 codes stay frozen for navigation/landings (`identity-access-epic1-freeze.md`).
- Do **not** implement request→approval→expiry→recertification lifecycle (Story 2.4), break-glass (2.5), temporal/as-of authz (2.6), or bulk/inference (2.7).
- Ship **configurable, fail-closed** toxic-combination hooks: when the matrix is missing for a path (self-approval; admin+approve-same-grant), **block**.
- Reuse Story 2.1/2.2 substrate (`governedProcedure`, `authorizeOrThrow`, access events, category registry, omit semantics) — **extend** identity-access + web; do not invent CASL/Nest/Ability/Passport.
- Permission administration mutations MUST go through the envelope with an explicit `access.administration` (or equivalent) permission — **never** “hr_admin coarse role ⇒ allow.”

[Source: `epics.md` Story 2.3; `prd.md` FR-4 / FR-46; `ARCHITECTURE-SPINE.md` AD-5; Stories 2.1–2.2; `identity-access-epic1-freeze.md`]

## Acceptance Criteria

1. **Given** an Admin with access-administration permission on سطح دسترسی‌ها  
   **When** they create or change a role, permission set, scope, or account link  
   **Then** the change is attributable (actor, time, before/after) and reviewable in access evidence

2. **And** no role grants capabilities beyond its explicit permission set

3. **When** toxic self-approval or admin+approve-same-grant combinations are attempted  
   **Then** the operation is blocked pending AR-ACCESS toxic-combination rules (fail closed if matrix missing for that path)

4. **And** empty entitlements state shows «تخصیص دسترسی‌ای ثبت نشده.»

## Tasks / Subtasks

- [x] Task 1: Access-administration data model in identity-access / Prisma (AC: #1, #2)
  - [x] Add projection tables (Prisma under `packages/db/prisma`) owned by identity-access semantics, e.g.:
    - `OrganizationalScope` — stable id, label (FA), `active`
    - `PermissionSet` — stable id, name, **explicit** list of envelope permission codes (string[] / join table)
    - `AccessRole` (or `EntitlementRole`) — stable code/label, **required** FK/relation to exactly one `PermissionSet` (no implicit capabilities)
    - Account bindings: scope membership + role/permission-set assignment on `InternalAccount` (join tables OK)
  - [x] Keep existing `InternalAccount.coarseRole` + `AccountStatus` — coarse role remains **nav context only**; do not derive envelope allows from coarse labels
  - [x] Account link: reuse `externalDirectoryId` (Story 1.8); admin UI may view/clear/relink **only** via module APIs — never store LDAP passwords; do not invent group→role mapping
  - [x] Active status: continue using `AccountStatus` (`active`/`inactive`); admin can activate/deactivate with attribution
  - [x] Seed minimal fixtures for local/dev: at least one Organizational Scope, one PermissionSet including `access.administration` (name may vary but must be stable), AccessRole wired to that set, and bind `hr.admin` so Admin can use the surface — **do not** grant sensitive/export categories by default
  - [x] Migration via Prisma only for these projections — **no new Prisma audit-ish tables** (access evidence stays event-store)

- [x] Task 2: Module APIs + session scope hydration (AC: #1, #2)
  - [x] Publish pure/server APIs from `@divan/identity-access` (no React): list/create/update for scopes, permission sets, roles, account bindings, account link view/update, set active status
  - [x] Every mutating API accepts actor context + correlation id; returns before/after snapshots suitable for access-event payload (no sensitive HR field values)
  - [x] UPDATE `getSessionContext` / authenticate success paths: populate `organizationalScopeIds` from DB bindings (replace hard-coded `[]`)
  - [x] Enforce AC #2 in module layer: creating/updating a role without a permission set, or granting codes outside the set, is rejected
  - [x] Export new types from `packages/modules/identity-access/src/index.ts`

- [x] Task 3: Toxic-combination fail-closed hooks (AC: #3)
  - [x] Add `assertToxicCombinationAllowed` (name flexible) in identity-access: inputs cover actor account id, operation kind, target account/grant ids, whether path combines permission-admin + approval of same grant, whether actor is subject
  - [x] Default registry empty / missing path → **deny** (fail closed) with typed error + Persian message at API boundary
  - [x] Call the hook on every access-admin mutation that could self-target entitlements **and** on any stub/preview “approve grant” path if exposed; document that full lifecycle approvals land in 2.4 but toxic guard must already block the named combinations
  - [x] Selfcheck: self-approval attempt blocked; admin+approve-same-grant blocked when matrix missing; optional fixture rule can allow a **non-toxic** demo path only

- [x] Task 4: Attributable access evidence via envelope (AC: #1)
  - [x] Add governed tRPC procedures (new `accessAdmin` router or equivalent under `apps/web/src/server/`) for list + mutations — all mutations use `governedProcedure` with meta like:
    - `permission: "access.administration"` (must match seeded PermissionSet code)
    - `dataCategory: "identity.access_admin"` (or similar non-HR-content category; register in category hooks as enabled demo/admin category if needed)
    - `action: "write"` / `"read"` as appropriate
    - `organizationalScope: "org:any"` or caller’s bound scope string — document choice; fail closed if unknown
    - `operation`: stable names e.g. `access.role.update`, `access.scope.create`, `access.account.link`, `access.account.status`
    - `sensitive: true` so access events are mandatory
  - [x] On allow, include before/after in the access-event path (extend envelope append payload / operation detail fields already supported by event-store — **do not** invent parallel Prisma audit tables)
  - [x] Denied admin calls: Persian `MSG_ACCESS_DENIED_FA` / «دسترسی ندارید.»; no entitlement payload leakage
  - [x] Coarse `hr_admin` without explicit `access.administration` policy rule → deny (prove in selfcheck); System Admin still has no `/access` nav and no routine admin APIs

- [x] Task 5: سطح دسترسی‌ها UI (AC: #1, #4)
  - [x] REPLACE `apps/web/app/(app)/access/page.tsx` placeholder with a real Admin surface (Persian RTL)
  - [x] Call `assertPageAccess(coarseRole, "/access")` (or pathname) **before** any data load — Layout ≠ RSC lesson
  - [x] Wire tRPC React client if not present yet (`@trpc/react-query` is already a dependency but **no provider exists**): add `TRPCReactProvider` + client helpers under `apps/web` (follow T3/App Router patterns); keep Prisma out of client
  - [x] UI sections (minimal, one job each — follow EXPERIENCE/DESIGN; no dashboard clutter):
    - Entitlement / role assignments list
    - Permission sets
    - Organizational Scopes
    - Account link + active status controls for selected account
  - [x] Empty entitlements list copy **exact**: «تخصیص دسترسی‌ای ثبت نشده.»
  - [x] Permission denied / deep-link: existing shell denial; hide nav for non-Admin roles (already)
  - [x] Interactive a11y DoD (open sprint action item): keyboard operable controls, visible focus rings, dialogs Esc/focus return, no emoji; loading/empty/error states with operational Persian copy
  - [x] Do **not** build break-glass banner grant UI, audit investigation UI, or sensitive category enablement UI

- [x] Task 6: Policy fixture + docs (AC: #1–#4)
  - [x] Extend `DEV_DEMO_POLICY` / policy registry fixture with explicit `access.administration` allow rules for the demo Admin actor path used in selfcheck (exact 4-tuple; coarse role never an allow key)
  - [x] Update `.env.example` / README only if new keys are required
  - [x] Update `deferred-work.md`: AR-ACCESS matrix still pending; lifecycle 2.4; break-glass 2.5; LDAP group sync still forbidden
  - [x] Keep FR42 migration plan from 2.1 intact

- [x] Task 7: Selfcheck + DoD (AC: #1–#4)
  - [x] Extend identity-access and/or web selfchecks covering the Testing table below
  - [x] Prefer new `selfcheck:access-admin` script and/or extend `selfcheck:governed` / package scripts
  - [x] `pnpm` typecheck for `@divan/identity-access`, `@divan/db`, `@divan/audit-envelope`, `@divan/web` (+ lint web)
  - [x] Manual smoke: login `hr.admin` → دسترسی‌ها works; `hr.operator` / `sys.admin` cannot use admin APIs; empty state copy; mutate role/scope → access event reviewable via event-store query or demo list; toxic self-target blocked
  - [x] When marking story done: keep story-file `Status` in sync with `sprint-status.yaml`

### Review Findings

- [x] [Review][Decision] Toxic self-target for account status/link — resolved: fail-closed now (self status/link blocked like role assign)
- [x] [Review][Decision] Minimal UI “first list item” role/scope assign — deferred: MVP acceptable; APIs already support full id lists (richer UX later)
- [x] [Review][Decision] Permission-code catalog validation — deferred: free strings until AR-ACCESS freezes the catalog; empty-set still rejected

- [x] [Review][Patch] Demo policy allows any session `access.administration`; add actor PermissionSet binding check so `hr.operator` / `sys.admin` API calls deny [`apps/web/src/server/access-admin.ts` + `packages/modules/identity-access/src/access-admin.ts`]
- [x] [Review][Patch] Mutation evidence not atomic with DB mutate — if `recordMutationEvidence` fails after commit, change sticks without before/after [`apps/web/src/server/access-admin.ts:87`]
- [x] [Review][Patch] Fold `actor_account_id` TEXT alter into Prisma migration (or boot gate) — `002_*.sql` alone is easy to skip [`packages/db/sql/002_actor_account_id_text.sql` + migration]
- [x] [Review][Patch] `assignAccountScopes` passes toxic operation `access.role.assign` instead of a scope operation [`packages/modules/identity-access/src/access-admin.ts:579`]
- [x] [Review][Patch] Map Prisma unique violations (P2002) to CONFLICT / Persian client error [`apps/web/src/server/access-admin.ts:50`]
- [x] [Review][Patch] Reject whitespace-only `labelFa` / `name` / `code` on update paths (create already trims+rejects) [`packages/modules/identity-access/src/access-admin.ts:249`]
- [x] [Review][Patch] Reject empty permission-set codes on create/update (align with assign empty-set reject) [`packages/modules/identity-access/src/access-admin.ts:280`]
- [x] [Review][Patch] Reject assigning inactive OrganizationalScope ids [`packages/modules/identity-access/src/access-admin.ts:593`]
- [x] [Review][Patch] Reject deactivating a scope that still has account bindings (or require unbind first) [`packages/modules/identity-access/src/access-admin.ts:249`]
- [x] [Review][Patch] Selfcheck `updateAccountLink(..., null)` on `hr.admin` must restore prior `externalDirectoryId` in `finally` [`packages/modules/identity-access/src/access-admin.selfcheck.ts:138`]
- [x] [Review][Patch] Remove always-on `sr-only` empty entitlements copy from `/access` page — empty state already in panel [`apps/web/app/(app)/access/page.tsx:25`]
- [x] [Review][Patch] `createPermissionSet` toxic operation should be `access.permission_set.create` not `.update` [`packages/modules/identity-access/src/access-admin.ts:274`]
- [x] [Review][Patch] Stop using `MSG_PERMISSION_OUTSIDE_SET_FA` for empty permission sets; use a dedicated empty-set message [`packages/modules/identity-access/src/access-admin.ts:534`]
- [x] [Review][Patch] Toxic self-target for account status/link — fail-closed [`packages/modules/identity-access/src/access-admin.ts`]

- [x] [Review][Defer] `/access` RSC skips fresh `getSessionContext` (inactive JWT may see shell; tRPC still UNAUTHORIZED) [`apps/web/app/(app)/access/page.tsx:14`] — deferred, pre-existing JWT pattern
- [x] [Review][Defer] Concurrent `assignAccountAccessRoles` / link updates are last-writer-wins without optimistic lock [`packages/modules/identity-access/src/access-admin.ts:547`] — deferred, pre-existing
- [x] [Review][Defer] `decisionId ?? correlationId` fallback in `governedProcedure` [`apps/web/src/server/trpc.ts:161`] — deferred, pre-existing
- [x] [Review][Defer] Minimal UI first-item role/scope assign — deferred, MVP; full multi-select later
- [x] [Review][Defer] Permission-code catalog allowlist — deferred until AR-ACCESS freezes codes

## Dev Notes

### Epic context

- **Epic 2:** Entitlements & Access Governance — FR2, FR3, FR4, FR46, FR47, FR48.
- **This story** is the **FR4 administration surface**: manage roles / permission sets / Organizational Scopes / account links / active status with attributable access evidence and toxic fail-closed hooks.
- **Upstream:** 2.1 envelope + governedProcedure + scope hooks on session; 2.2 category registry + read≠export + omit (do not regress).
- **Downstream:** 2.4 lifecycle sits on these objects; 2.5 must be able to deny permission administration under break-glass by default; 2.6 consumes `organizationalScopeIds`; 2.7 shares control plane.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Full AR-ACCESS production matrix / toxic catalog | Launch artifacts + later stories |
| Entitlement request→approval→expiry→recertification | Story 2.4 / FR46 |
| Break-glass grant UI + elevation | Story 2.5 |
| Temporal / as-of / cross-boundary retrieval | Story 2.6 |
| Bulk / inference thresholds | Story 2.7 |
| LDAP/AD group → coarse role or scope sync | AR-IDENTITY (still open) |
| Changing five MVP coarse nav roles or landings | Frozen Epic-1 |
| Enabling religion/health/family/bank/insurance/national-ID/compensation categories | AR-DATA / Story 2.2 stance |
| Audit investigation UI | Story 7.1 |
| NestJS, CASL, Ability, Passport, class-transformer | Not in architecture |
| New Prisma audit tables / dual audit writers | AD-5 / 2.1 FR42 plan |
| Client import of `@divan/identity-access` that pulls `pg` | Lessons 1.5 / 1.6 — keep DB calls server-only |

### Architecture compliance (MUST)

| Rule | Implication |
| --- | --- |
| **AD-5** | identity-access owns coarse role/scope/admin APIs; audit-envelope owns fine-grained allow + access events |
| **AD-6** | tRPC + Prisma projections; event-store raw SQL for access evidence; no `@prisma/client` in client bundles |
| **FR-4** | Admin manages roles, permissions, scopes, account links, active status; changes attributable + reviewable |
| **FR-2 / 2.1** | Default-deny; UI visibility ≠ data access; Layout ≠ RSC |
| **FR-3 / 2.2** | Admin permission sets must not imply sensitive view/export; System Admin ≠ routine HR content |
| **FR-46 direction** | Toxic self-approval and admin+approve-same-grant blocked; full lifecycle later |
| **FR-51 direction** | Entitlement/admin changes in minimum audit baseline via `event_class=access` |
| **UX** | Nav item **دسترسی‌ها**; empty «تخصیص دسترسی‌ای ثبت نشده.» |

[Source: `ARCHITECTURE-SPINE.md` AD-5/AD-6; `prd.md` FR-4/FR-46/FR-51; `EXPERIENCE.md`]

### Authz model for this story

```
Admin UI (/access)  →  assertPageAccess (coarse nav)
                    →  tRPC governedProcedure
                           meta.permission = access.administration
                           ↓
identity-access mutations (scopes, roles, permission sets, links, status)
                           ↓ toxic hook (fail closed if matrix missing)
audit-envelope authorizeOrThrow + atomic access event (before/after)
                           ↓
getSessionContext reads organizationalScopeIds from DB bindings
```

Coarse role `hr_admin` only unlocks **nav** to `/access`. Envelope policy + PermissionSet codes unlock **mutations**.

### Current code to UPDATE (read before coding)

| File | Current state | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/db/prisma/schema.prisma` | Identity projections: HumanIdentity, InternalAccount (coarseRole, status, externalDirectoryId), AuthAttempt, AccessDenial | Add scope / permission-set / role / join projections | No Person/HR tables; no audit Prisma models |
| `packages/modules/identity-access/src/authenticate.ts` | `organizationalScopeIds: []` hard-coded | Hydrate scopes from DB | Freshness via DB; LDAP password null; fail-closed inactive |
| `packages/modules/identity-access/src/types.ts` | Scope hooks documented empty until 2.3 | Types for admin entities if exported | CoarseRole frozen set |
| `packages/modules/identity-access/src/seed.ts` | Five seeded accounts | Seed admin permission set + bind hr.admin; optional demo scope | Seed guard / LDAP refuse |
| `packages/modules/identity-access/src/index.ts` | Auth + nav exports | Export admin APIs + toxic helper | No client-unsafe DB leaks |
| `packages/kernel/audit-envelope` | Policy + category registries | Fixture rules for `access.administration`; optional admin dataCategory enable | Default-deny; coarse never allow key; evaluateAuthorization category gate |
| `apps/web/src/server/root.ts` | Demo governed procedures | Mount `accessAdmin` router | Keep `devOnly` demos |
| `apps/web/src/server/trpc.ts` | `governedProcedure` | Reuse; only extend meta if required | Fresh `getSessionContext` |
| `apps/web/app/(app)/access/page.tsx` | PlaceholderPage | Real Admin UI | Persian RTL; no emoji |
| `apps/web` providers | **No** tRPC React provider yet | NEW client provider wiring | Do not put secrets in client |
| `apps/web/lib/assert-page-access.ts` | Helper exists | Call from `/access` page before loaders | Layout≠RSC |
| `deferred-work.md` / `.env.example` / README | 2.2 notes | Admin deferrals / any new env | FR42 plan intact |

### Recommended model sketch (guidance, not sacred names)

```ts
// projections (conceptual)
OrganizationalScope { id, labelFa, active }
PermissionSet { id, name, permissions: string[] } // envelope permission codes only
AccessRole { id, code, labelFa, permissionSetId } // MUST have explicit set
AccountScope { accountId, organizationalScopeId }
AccountAccessRole { accountId, accessRoleId }
// InternalAccount.coarseRole + status + externalDirectoryId unchanged semantically
```

```ts
// toxic hook (conceptual)
assertToxicCombinationAllowed({
  actorAccountId,
  subjectAccountId,
  operation: "grant.approve" | "access.role.assign" | ...,
  combinesPermissionAdminWithSameGrantApproval: boolean,
}): void; // throws if matrix missing or combination blocked
```

### tRPC sketch

```ts
accessAdmin: createTRPCRouter({
  listEntitlements: governedProcedure.meta({
    permission: "access.administration",
    dataCategory: "identity.access_admin",
    action: "read",
    organizationalScope: "org:any",
    operation: "access.entitlements.list",
    sensitive: true,
  }).query(...),

  updateAccountRole: governedProcedure.meta({
    permission: "access.administration",
    dataCategory: "identity.access_admin",
    action: "write",
    organizationalScope: "org:any",
    operation: "access.role.assign",
    sensitive: true,
  }).input(z.object({ ... })).mutation(async ({ ctx, input }) => {
    assertToxicCombinationAllowed({ ... });
    // module mutate + before/after for access event detail
  }),
});
```

### UX notes

- IA label: **دسترسی‌ها** (`/access`); EXPERIENCE empty row is mandatory AC copy.
- Density: admin lists may use compact table row tokens from DESIGN.md; sticky identifier column RTL if wide.
- Nav outside role already omitted — do not show disabled Admin link to Operator.
- Open sprint action item: a11y/focus DoD for interactive surfaces — **applies here** (first real admin interactive surface).
- Denial copy stays «دسترسی ندارید.»

[Source: `EXPERIENCE.md`; `DESIGN.md`; sprint-status `action_items`]

### Project structure notes

```
packages/db/prisma/schema.prisma          # UPDATE — admin projections
packages/modules/identity-access/src/
  access-admin.ts                         # NEW — CRUD + toxic hooks
  access-admin.selfcheck.ts               # NEW (or equivalent)
  authenticate.ts                         # UPDATE — hydrate scopes
  seed.ts                                 # UPDATE — admin fixtures
  index.ts                                # UPDATE — exports
packages/kernel/audit-envelope/src/
  index.ts / categories.ts                # UPDATE — fixture allow + category if needed
apps/web/
  app/(app)/access/page.tsx               # UPDATE — real UI
  components/access/…                     # NEW — section components as needed
  lib/trpc/… or src/trpc/…                # NEW — React client + provider
  src/server/root.ts                      # UPDATE — mount router
  src/server/trpc.ts                      # UPDATE only if required
```

Dependency direction unchanged: `apps/web` → `@divan/identity-access` / `@divan/audit-envelope` → DB/event-store. Admin UI must not import Prisma client.

### Previous story intelligence (2.1 + 2.2)

| Learning | Apply in 2.3 |
| --- | --- |
| Layout ≠ RSC | `assertPageAccess` on `/access` before data |
| Fresh authz via `getSessionContext` | Keep on every governed path; now also load scopes |
| Fail-closed policy / category load | Mirror for toxic registry load |
| `devOnly` demos | Keep existing demos; production admin APIs are real (not `devOnly`) but still envelope-governed |
| No CASL / Nest / Prisma event log | Still forbidden |
| Coarse role ≠ entitlement | Binding AccessRole/PermissionSet is explicit; nav matrix unchanged |
| Omit not mask | Admin APIs return identity/config only — no compensation fields |
| Selfcheck via `tsx` + root scripts | Add/extend scripts |
| Review patches from 2.2 | Keep registry freeze, category gate before policy, omit map contract |
| Deferred REVOKE/version-table/pool | Do not “fix” unless in scope |
| Commit style | Short `story 2.3` |

**Do not regress:** `authorizeOrThrow`, `governedProcedure`, category registry, `omitUnauthorizedCategories`, compensation-facts boundary, LDAP password null, five seed accounts, nav hide≠data authz.

### Git intelligence

- HEAD: `722e7fc` (`story 2.2`) — category registry, read≠export, omit, compensation seam.
- Prior: `642c5da` (`story 2.1`) — envelope substrate, event-store, governedProcedure, scope hooks (empty).
- Pattern: one short commit per story (`story 2.N`).
- Baseline for this story file: `722e7fc`.

### Latest tech information

- **tRPC 11:** use `governedProcedure` + Zod inputs; mount nested routers; throw `TRPCError` `FORBIDDEN` with Persian message on deny. First App Router need: wire `@trpc/react-query` provider (deps already present; no provider in tree yet).
- **Do not add** NestJS guards, CASL, or parallel REST admin controllers.
- **Prisma 7.x:** projections only for admin entities; access evidence remains `@divan/event-store` append.
- **Attribution:** prefer structured before/after JSON in access-event detail fields already supported — avoid inventing a second audit store.

### Testing requirements

Epic DoD: **manual smoke + lint/typecheck + tsx selfcheck** (Vitest optional).

| Case | Expect |
| --- | --- |
| `hr.admin` with seeded `access.administration` allow | List/mutate scopes/roles/permission sets/links/status succeeds; access event `result=allow` with actor + before/after |
| Caller without `access.administration` policy rule (even if `coarseRole=hr_admin` in a demoted fixture) | Deny + access event `result=deny` |
| `sys.admin` / `hr.operator` | No `/access` nav (existing); API deny if called |
| Role without permission set / codes outside set | Rejected (AC #2) |
| Toxic: actor assigns/approves own sensitive-style grant path | Blocked when matrix missing |
| Toxic: permission-admin combined with approve-same-grant | Blocked when matrix missing |
| Empty entitlements list | UI shows «تخصیص دسترسی‌ای ثبت نشده.» |
| `getSessionContext` after scope assign | `organizationalScopeIds` non-empty and matches DB |
| Account deactivate | Subsequent governed paths fail closed (existing freshness) |
| Account link update | Never persists LDAP password; `externalDirectoryId` only via module API |
| Existing 2.1/2.2 selfchecks | Still pass |
| Production `devOnly` demos | Still NOT_FOUND |
| Logs | No passwords / unnecessary HR values |

### Project context reference

No `project-context.md` found in repo. Follow this story + Stories 2.1/2.2 + Architecture Spine + Epic 2 constraints + `identity-access-epic1-freeze.md`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2 / Story 2.3]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-4, FR-46, FR-51]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5, AD-6]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — دسترسی‌ها / empty entitlements]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md` — density / tables]
- [Source: `_bmad-output/specs/spec-divan/identity-access-epic1-freeze.md`]
- [Source: `_bmad-output/implementation-artifacts/2-1-audit-envelope-default-deny-authorization-substrate.md`]
- [Source: `_bmad-output/implementation-artifacts/2-2-sensitive-categories-separate-export-permission.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Prisma migrate drift with `kernel_events` (raw SQL) → created migration SQL manually + `migrate resolve --applied`
- `actor_account_id UUID` incompatible with Prisma cuid account ids → `002_actor_account_id_text.sql` + event-store insert without uuid cast
- Client must not import `@divan/identity-access` (pulls pg) → empty copy in `operationalCopy`
- TS2742 on `createTRPCReact` export with base `declaration: true` → web tsconfig `declaration: false`

### Completion Notes List

- Shipped FR4 access-admin projections (OrganizationalScope, PermissionSet, AccessRole, account joins) + Prisma migration; no Prisma audit tables
- Module CRUD + toxic fail-closed hooks; session `organizationalScopeIds` hydrated from DB on authenticate / getSessionContext
- Seed binds `hr.admin` to access-admin PermissionSet/role + demo scope; coarse role remains nav-only
- Governed `accessAdmin` tRPC router with `access.administration` × `identity.access_admin` × org:any; before/after via event-store payload (authorize + mutation detail append)
- `/access` Admin UI (RTL) with TRPCReactProvider; `assertPageAccess` before data; empty copy exact
- `pnpm selfcheck:access-admin` + existing audit-envelope/governed selfchecks green; typecheck/lint green

### File List

- `_bmad-output/implementation-artifacts/2-3-access-administration-ui-apis.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/app/(app)/access/page.tsx`
- `apps/web/components/access/access-admin-panel.tsx`
- `apps/web/lib/operational-copy.ts`
- `apps/web/lib/trpc/client.tsx`
- `apps/web/src/server/access-admin.ts`
- `apps/web/src/server/root.ts`
- `apps/web/src/server/trpc.ts`
- `apps/web/tsconfig.json`
- `package.json`
- `packages/db/prisma/migrations/20260716220000_access_admin_projections/migration.sql`
- `packages/db/prisma/schema.prisma`
- `packages/db/sql/002_actor_account_id_text.sql`
- `packages/kernel/audit-envelope/src/categories.ts`
- `packages/kernel/audit-envelope/src/index.ts`
- `packages/kernel/event-store/src/index.ts`
- `packages/modules/identity-access/package.json`
- `packages/modules/identity-access/src/access-admin.selfcheck.ts`
- `packages/modules/identity-access/src/access-admin.ts`
- `packages/modules/identity-access/src/authenticate.ts`
- `packages/modules/identity-access/src/index.ts`
- `packages/modules/identity-access/src/seed.ts`
- `packages/modules/identity-access/src/types.ts`

### Change Log

- 2026-07-16: Story 2.3 — access administration data model, governed APIs, toxic fail-closed hooks, سطح دسترسی‌ها UI, selfcheck
- 2026-07-16: Code review — actor PermissionSet binding gate, evidence compensate-on-fail, toxic self status/link, validation/P2002/migration patches; deferred first-item UI + permission catalog allowlist

## Story completion status

- Status: **done**
- Note: Code review complete; decision/patches applied; remaining UX/catalog items deferred
