---
baseline_commit: 33cf0763d85f0885e9e9f6ac3c8bdc590b8309b9
---

# Story 2.1: Audit Envelope & Default-Deny Authorization Substrate

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a security-conscious product owner,
I want every protected read and mutation to enter through a kernel audit-envelope with default-deny,
so that UI visibility never implies data access (FR2, AD-5).

## Gate (read first)

**AR-ACCESS and AR-AUDIT are still `pending`.** This story builds the **enforcement substrate and hooks**, not the production matrix.

- Do **not** invent the full field×action×scope matrix, toxic combinations, bulk thresholds, or break-glass rules.
- Do **not** claim AR-ACCESS / AR-AUDIT compliance for production baselines.
- Ship a **configurable, fail-closed** policy surface: missing / unknown permission, category, action, or Organizational Scope → **deny**.
- Minimal access-event columns must be enough for Story 2.1 ACs and extensible when AR-AUDIT freezes schema — do not over-design hash-chains or a separate audit DB (spine defers those).
- **AR-IDENTITY is still open** (topology, MFA, group→coarse-role sync, directory account-state codes, STARTTLS). Epic 2 proceeds on **explicit coarse role + grants** — do **not** assume LDAP/AD group→role sync or invent directory entitlement mapping.

[Source: `epics.md` Launch Artifact gates; `launch-artifacts.md` AR-ACCESS / AR-AUDIT / AR-IDENTITY; `ARCHITECTURE-SPINE.md` AD-5; `epic-1-retro-2026-07-16.md`]

## Epic 1 retrospective constraints (MUST absorb)

From `_bmad-output/implementation-artifacts/epic-1-retro-2026-07-16.md` — action items 2–4 and critical path. Full Epic 2 rewrite not required; **this story file is the absorb point**.

| Constraint | Rule for 2.1 |
| --- | --- |
| **Layout ≠ RSC gate** | `(app)/layout.tsx` path swap alone does **not** stop forbidden `page.tsx` execution. Any future data-fetching route MUST assert access in the **page or shared page wrapper before loaders** — chrome/nav hide is not authz. Document the pattern even if 2.1 only ships a demo tRPC procedure (no domain RSC loaders yet). |
| **Fresh authz context** | Envelope / governed procedures MUST **revalidate** authorization-relevant account state from the source of truth (at least: account still `active`, current `coarseRole` from DB — not JWT/chrome alone). Stale JWT after demote/deactivate must **fail closed** on governed paths. Full module `signOut` / AD continuous revalidation remain deferred; **DB re-check on envelope entry is in scope**. |
| **FR42 substrate migration plan** | Do **not** grow parallel audit stores. Ship a short **migration note** (in Completion Notes + `deferred-work.md`): how `AuthAttempt` / `AccessDenial` map into `event_class=access`, what dual-write (if any) is allowed temporarily, and when thin Prisma tables stop receiving new writes. Full historical backfill may wait for AR-AUDIT / Epic 7 — **the plan must exist in 2.1** so sprawl does not continue. |
| **UI never implies access** | Default-deny is server-side via audit-envelope; nav visibility and layout denial UI are not entitlements. |

## Acceptance Criteria

1. **Given** the monorepo kernel packages from Epic 1  
   **When** a tRPC procedure performs a protected read or mutation  
   **Then** authorization evaluates permission × data category × action × Organizational Scope via audit-envelope independently of UI

2. **And** denied reads/mutations fail closed with Persian user-facing errors and no out-of-scope payload leakage

3. **And** each sensitive decision writes an append-only `event_class=access` record atomically with the allow/deny outcome (correlation id, actor, time, operation, scope, result)

4. **And** identity-access supplies coarse role/scope context; envelope enforces fine-grained category checks

5. **And** no generic Viewer/manager/HR/System Admin label grants sensitive data by default

6. **And** governed/envelope entry revalidates authorization context from DB (active account + current coarse role at minimum) so a stale JWT alone cannot authorize after demote/deactivate (Epic 1 retro)

7. **And** Dev Notes / Completion Notes document (a) page-or-wrapper assert-before-loader for any data RSC route, and (b) the AuthAttempt/AccessDenial → `event_class=access` migration plan (no unplanned dual-write sprawl)
## Tasks / Subtasks

- [x] Task 1: Kernel event-store — append-only access events (AC: #3)
  - [x] Implement `@divan/event-store` beyond the Story 1.1 stub (`packages/kernel/event-store/src/index.ts`)
  - [x] Add raw SQL migration under `packages/db/sql/` (not Prisma models) for a minimal append-only events table supporting `event_class ∈ {business, access}` — at minimum columns needed for access evidence: id (UUID), `event_class`, `correlation_id`, `actor_account_id` (nullable if needed), `occurred_at`, `operation`, `scope` (structured JSON or typed columns), `result` (`allow` | `deny`), optional `reason` / `entity_type` / `entity_id` hooks for later FR-42 richness
  - [x] Expose a narrow API: `appendAccessEvent(...)` (and a no-op or stub path for future `appendBusinessEvent` if useful for typing — **do not** implement temporal/projection consumers)
  - [x] Enforce append-only at API level (no update/delete helpers). Access events must never feed derived state / projections
  - [x] Wire DB access via `pg` pool / shared connection from `@divan/db` patterns — **not** Prisma models for the event log (AD-3 / AD-6)
  - [x] Document how to apply SQL migrations (README under `packages/db/sql/` — replace the “Future…” stub)

- [x] Task 2: Kernel audit-envelope — default-deny authorize API (AC: #1, #2, #4, #5)
  - [x] Implement `@divan/audit-envelope` beyond stub (`packages/kernel/audit-envelope/src/index.ts`)
  - [x] Public API shape (names may vary; semantics must not):
    - Input: coarse authz context from identity-access + decision request `{ permission, dataCategory, action, organizationalScope, operation, correlationId, … }`
    - Behavior: **default-deny**; evaluate permission × category × action × Organizational Scope
    - On allow or deny for a **sensitive** decision: append `event_class=access` **atomically** with the outcome (same transaction as the decision write path — if decision is check-only, the check + access append share one transaction)
    - On deny: throw a typed domain error (envelope-owned) with stable machine code + `messageFa` suitable for API boundary (reuse catalog wording where it fits — see Testing / UX)
  - [x] **Policy substrate (configurable, not invented matrix):**
    - Provide an in-code / env / JSON **registry hook** for known permissions, categories, actions, scopes
    - Empty registry or unknown tuple → deny (fail closed)
    - Explicit allow entries only — never “coarseRole === system_admin ⇒ allow sensitive”
    - Document that production matrix is owned by AR-ACCESS; local/dev may ship a **tiny** fixture that proves deny-by-default and one controlled allow for selfcheck (e.g. a non-HR demo category) without pretending to be the launch matrix
  - [x] Depend on `@divan/event-store` for append; do **not** write access events through Prisma `AuthAttempt` / `AccessDenial` tables
  - [x] If access-event append fails for a sensitive decision → **fail the operation** (FR-51 direction; do not silently allow). Distinct from Epic-1 best-effort `AuthAttempt` / `AccessDenial`

- [x] Task 3: identity-access — coarse context + freshness for the envelope (AC: #4, #6)
  - [x] Extend `SessionContext` (and JWT / `createContext` mapping) with **coarse Organizational Scope hooks** needed by AD-5 — e.g. `organizationalScopeIds: string[]` (may be empty array for MVP until Story 2.3 admin) and keep documenting that `coarseRole` is **navigation context only**, never HR entitlement
  - [x] Add a small published helper, e.g. `toEnvelopeAuthzContext(session): CoarseAuthzContext`, used by tRPC — keep LDAP/seeded auth paths untouched
  - [x] Add **revalidation helper** used on every governed/envelope entry (e.g. `getSessionContext(accountId)` or equivalent already used on JWT refresh): if account missing/inactive → deny/fail closed like session end; if DB `coarseRole` ≠ JWT claim → use **DB role** for authz (and prefer fail closed or force refresh — pick one policy and document; never authorize solely from stale JWT)
  - [x] Do **not** move fine-grained checks into identity-access; do **not** change `navigation.ts` landings/nav matrix
  - [x] Do **not** invent LDAP group→role sync (AR-IDENTITY open)

- [x] Task 4: tRPC integration — every protected read/mutation enters the envelope (AC: #1, #2, #6)
  - [x] UPDATE `apps/web/src/server/trpc.ts`: keep session gate on `protectedProcedure`; add an **envelope-backed** procedure builder (e.g. `governedProcedure` or meta-driven middleware) so protected data procedures declare `{ permission, dataCategory, action, organizationalScope }` (static meta and/or input-derived scope)
  - [x] Pattern: `protectedProcedure` (logged-in) → **revalidate DB authz context** → envelope authorize → handler. Prefer tRPC v11 `.use()` / `.meta()` chaining — **do not** introduce NestJS, CASL, or Passport
  - [x] UPDATE `apps/web/src/server/root.ts`:
    - Keep `health` public
    - Keep `me` as session-only identity (not sensitive HR content) **or** route it through envelope with an explicit non-sensitive allow — document the choice; `me` must not become a backdoor for category data
    - Add at least one **demo governed** query/mutation used by selfcheck that proves: default deny, Persian FORBIDDEN, access event written on deny and on allow, and that `system_admin` / `manager` / other coarse labels do **not** auto-allow a sensitive fixture category
    - Selfcheck or smoke must cover **stale JWT**: demote/deactivate account in DB while JWT still presents old role → governed call fails closed
  - [x] Map envelope deny → `TRPCError` with code `FORBIDDEN` (not `UNAUTHORIZED`) and Persian `message` aligned with UX denial copy («دسترسی ندارید.» or a short API-safe variant — no stack traces, no out-of-scope entity payloads in error `data`)
  - [x] Ensure deny responses never include the forbidden resource body

- [x] Task 5: Layout≠RSC pattern + FR42 migration plan (AC: #7)
  - [x] Document in Dev Notes / README snippet / short `packages/kernel/audit-envelope` or `apps/web` comment: **assert access in page or shared wrapper before any data loader**; layout `children` swap is UI-only (Epic 1 retro discovery). Prefer a named helper export (e.g. `assertPageAccess` stub wrapping `canAccessPath` + future envelope) even if unused by domain pages yet
  - [x] Write **migration plan** (Completion Notes + `deferred-work.md` section):
    - Target: single append-only store with `event_class=access`
    - Map fields: AuthAttempt outcomes vs AccessDenial path denials → access-event shape
    - Interim rule: **no new parallel audit tables**; prefer envelope writes for new governed decisions; thin Prisma tables may remain for login/deep-link until cutover
    - Explicit non-goal for 2.1 code: mandatory historical backfill (may wait AR-AUDIT / Epic 7) — plan + stop sprawl is mandatory
  - [x] Extend Persian deny copy via `operationalCopy` catalog only — do not invent divergent strings

- [x] Task 6: Package wiring + docs (AC: #1–#5)
  - [x] Ensure `@divan/audit-envelope` depends on `@divan/event-store`; `@divan/web` / server imports envelope (not Prisma event tables)
  - [x] Update `.env.example` / README only if new env keys are required (e.g. path to policy fixture) — no secrets
  - [x] Update `deferred-work.md` with migration plan pointer + remaining AR-ACCESS / AR-AUDIT / AR-IDENTITY opens

- [x] Task 7: Selfcheck + DoD (AC: #1–#7)
  - [x] Add `audit-envelope.selfcheck.ts` (and/or event-store selfcheck) run via `tsx`
  - [x] Wire **at least one** selfcheck into a `package.json` script (Epic 1 retro action item 6 pattern) — document which others stay manual
  - [x] Assert: default-deny on unknown tuple; controlled allow writes `event_class=access` + `result=allow`; deny writes `result=deny`; coarse role labels alone never allow sensitive fixture; Persian message present on deny error type; inactive/demoted account fails closed on governed path despite stale session claims
  - [x] `pnpm` typecheck for kernel packages + identity-access + web lint/typecheck
  - [x] Manual smoke: login as seeded `system_admin` and `hr_operator`; call demo governed procedure — admin label must not grant sensitive fixture by default
  - [x] When marking story done: keep story-file `Status` in sync with `sprint-status.yaml` (Epic 1 retro action item 8)

### Review Findings

- [x] [Review][Patch] Demo procedures gated off production — `devOnly: true` → NOT_FOUND before envelope when `NODE_ENV=production` [`apps/web/src/server/trpc.ts`, `root.ts`]
- [x] [Review][Patch] Policy load must fail-closed — wrap `readFileSync`/`JSON.parse`, require `Array.isArray(rules)`, and ensure `getPolicy`/load errors become deny (`AuthorizationError`) not raw crashes [`packages/kernel/audit-envelope/src/index.ts:117`]
- [x] [Review][Patch] Harden fixture env parsing — treat production case-insensitively; trim `AUDIT_ENVELOPE_USE_DEV_FIXTURE` so whitespace cannot keep `DEV_DEMO_POLICY` [`packages/kernel/audit-envelope/src/index.ts:127`]
- [x] [Review][Patch] Reject whitespace-only governed meta fields before envelope [`apps/web/src/server/trpc.ts:94`]
- [x] [Review][Patch] Log `AuthorizationError.code` + `correlationId` server-side when mapping to TRPC FORBIDDEN (keep user-facing Persian message) [`apps/web/src/server/trpc.ts:128`]
- [x] [Review][Patch] Filter `organizationalScopeIds` to strings in session callback [`apps/web/auth.ts:136`]
- [x] [Review][Patch] Document or wire root/`README` path for `selfcheck:governed` alongside `selfcheck:audit-envelope` [`README.md:67`]
- [x] [Review][Patch] Guard `ROLLBACK` in `apply.mjs` so rollback failure does not mask the original SQL error [`packages/db/sql/apply.mjs:53`]
- [x] [Review][Defer] DB-level append-only `REVOKE UPDATE, DELETE` still commented — deferred, pre-existing nice-to-have per story Dev Notes [`packages/db/sql/001_kernel_events.sql:36`]
- [x] [Review][Defer] `sql:apply` has no migration version table — deferred until non-idempotent SQL arrives [`packages/db/sql/apply.mjs`]
- [x] [Review][Defer] Process-wide envelope `pg.Pool` lifecycle / hot-reload sticky URL — deferred, Next.js process model [`apps/web/src/server/trpc.ts:63`]
- [x] [Review][Defer] `governed.selfcheck` mutates shared `sys.admin` (best-effort restore) — deferred, local/dev only; avoid parallel runs [`apps/web/src/server/governed.selfcheck.ts`]

## Dev Notes

### Epic context

- **Epic 2:** Entitlements & Access Governance — FR2, FR3, FR4, FR46, FR47, FR48.
- **This story** is the **foundation**: without the envelope, later stories (sensitive categories, access admin, break-glass, temporal authz, bulk controls) have nowhere to enforce or audit.
- **Upstream:** Epic 1 monorepo + identity-access (Auth.js, coarse roles, LDAP/seeded), stub `packages/kernel/{audit-envelope,event-store}`, tRPC `protectedProcedure` (session only).
- **Downstream:** 2.2 category/export segregation; 2.3 access admin UI; 2.4–2.7 lifecycle / break-glass / temporal / bulk all hang off this substrate.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Full AR-ACCESS permission matrix / toxic combinations | AR-ACCESS + Stories 2.2–2.7 |
| Access administration UI / role-permission CRUD | Story 2.3 |
| Break-glass grants & banner lifecycle | Story 2.5 (UI banner already stubbed in 1.7) |
| Temporal / as-of authorization semantics | Story 2.6 |
| Bulk / inference thresholds | Story 2.7 |
| Historical backfill of `AuthAttempt` / `AccessDenial` rows | After migration **plan** in 2.1; execution may wait AR-AUDIT / Epic 7 |
| Full Auth.js server-side revoke / LDAP continuous revalidation | Deferred (retro); **DB re-check on governed entry is in scope** |
| LDAP/AD group → coarse role automatic sync | AR-IDENTITY open — never invent |
| Hash-chain tamper evidence / separate audit DB | Spine deferred until AR-AUDIT/NFR demands |
| NestJS, CASL, Ability classes, Passport, Lucia | Not in architecture — T3 + tRPC + kernel envelope |
| Changing five MVP coarse roles or Epic-1 landings/nav | Frozen 1.4 / 1.5 |
| Client import of `@divan/identity-access` or kernel DB code | Pulls `pg` — lessons 1.5 / 1.6 |
| Replacing Auth.js / LDAP / seeded auth | AD-5: identity-access keeps authentication |

### Architecture compliance (MUST)

| Rule | Implication |
| --- | --- |
| **AD-5** | identity-access = auth + coarse (role / scope hooks); audit-envelope = fine-grained + atomic access events; default-deny at envelope |
| **AD-3** | Kernel owns event-store + audit-envelope; modules must not own the event log |
| **AD-6** | Prisma = projections only; raw SQL for event-store; no `@prisma/client` in `apps/web`; tRPC exposes envelope-governed paths |
| **Consistency** | No silent authorization fallthrough; Persian errors at API boundary; every sensitive R/W through envelope |
| **FR-2** | permission × category × action × Organizational Scope; independent of UI; no generic role label grants sensitive data |
| **FR-51 direction** | Required access-audit failure must not allow the sensitive operation (stricter than Epic-1 best-effort AuthAttempt) |
| **Epic 1 retro** | Layout gate ≠ data authz; envelope revalidates DB context; plan absorbs thin FR42 tables into access events |

[Source: `ARCHITECTURE-SPINE.md` AD-3/5/6; `prd.md` FR-2, FR-42, FR-51; `infra-security-brief.md`; `epic-1-retro-2026-07-16.md`]

### FR42 substrate → access events (migration plan sketch)

| Source (Epic 1) | Target | Interim (2.1) | Later |
| --- | --- | --- | --- |
| `AuthAttempt` (login) | `event_class=access` (operation≈`auth.authenticate`, result from outcome) | Keep writing AuthAttempt for login path; **do not** invent a second login-audit table | Backfill / dual-write cutover under AR-AUDIT; Epic 7 investigation UI reads event-store |
| `AccessDenial` (deep-link / path) | `event_class=access` (operation≈`nav.path_denied` or envelope deny) | New **governed** denials go through envelope only; path-gate may keep AccessDenial until a thin adapter writes access events instead | Stop AccessDenial inserts once adapter lands; retain table read-only or drop after backfill |
| New governed R/W decisions | Envelope + event-store only | **Mandatory** — never Prisma parallel audit | — |

**Hard rule:** no new Prisma “audit-ish” tables in Epic 2. Expand event-store schema via `packages/db/sql/` when AR-AUDIT adds columns.

Dev agent must refine this into Completion Notes + `deferred-work.md` when implementing (Task 5).

### Authz freshness (governed paths)

```
JWT / cookie present
  → protectedProcedure (logged in)
  → load InternalAccount by accountId (source of truth)
  → inactive / missing → fail closed (UNAUTHORIZED or equivalent session end)
  → authz uses DB coarseRole (+ scope hooks), not stale JWT claim alone
  → audit-envelope authorize (default-deny) + access event
  → handler
```

Chrome layout / `canAccessPath` remains a **UX gate only**. It does not authorize tRPC or future RSC loaders.

### Layout ≠ RSC (pattern for all Epic 2+ data routes)

```
// conceptual — layout swap is insufficient
export default async function SomeDataPage() {
  await assertPageAccess("/some-path"); // page or shared wrapper — BEFORE loaders
  const data = await loadSomething();   // only after assert
  ...
}
```

Story 2.1 may only document + export the helper; domain pages still placeholders. **Do not** treat Epic-1 empty shells as proof that layout-only gating is enough.

### Current code to UPDATE (read before coding)

| File | Current state | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/kernel/audit-envelope/src/index.ts` | Empty stub `export {}` | Full authorize + access-event orchestration | Package name `@divan/audit-envelope` |
| `packages/kernel/event-store/src/index.ts` | Empty stub | Append-only access (and typed hooks for business later) | No Prisma models; raw SQL |
| `packages/db/sql/README.md` | “Future kernel raw SQL migrations” | Real migration(s) + apply instructions | Not via Prisma schema |
| `packages/modules/identity-access/src/types.ts` | `SessionContext` without scope list | Add coarse scope hooks; keep role = nav only comment | Five `COARSE_ROLES`; auth error codes |
| `apps/web/src/server/trpc.ts` | `protectedProcedure` = logged-in only | Add governed / envelope middleware chain | Existing UNAUTHORIZED Persian for no session |
| `apps/web/src/server/context.ts` | Maps JWT → `SessionContext` | Pass through new coarse scope fields | Auth.js session mapping pattern |
| `apps/web/src/server/root.ts` | `health` + `me` | Demo governed procedure(s); clarify `me` sensitivity | Public health |
| `apps/web/types/next-auth.d.ts` | JWT/session fields for coarse role | Extend if scope hooks land in JWT | Existing accountId / coarseRole |
| `packages/modules/identity-access/src/authenticate.ts` | LDAP + seeded | **Leave auth flows alone** unless JWT claims need scope stubs | Fail-closed provider semantics |
| `packages/modules/identity-access/src/navigation.ts` | Coarse nav matrix | **Do not change** | Epic-1 landings |
| `packages/db/prisma/schema.prisma` | AuthAttempt, AccessDenial | No event-store in Prisma; **do not add** new audit tables; migration **plan** required (Task 5) | Identity projections; thin tables may stay until cutover |
| `apps/web/app/(app)/layout.tsx` | Path gate via `resolveAppPathAccess` | **Do not** treat as data authz; document layout≠RSC; optional shared assert helper for future pages | Existing deny UI + nav filtering |

### Recommended API sketch (guidance, not sacred names)

```ts
// audit-envelope (conceptual)
authorizeOrThrow(input: {
  context: CoarseAuthzContext; // from identity-access
  permission: string;
  dataCategory: string;
  action: "read" | "write" | "export" | string;
  organizationalScope: string; // requested object scope
  operation: string;           // stable operation id for audit
  correlationId: string;
  sensitive: boolean;          // when true, access event is mandatory
}): Promise<{ decisionId: string }>;
```

Default policy: deny unless an explicit allow rule matches **all** dimensions. Coarse role is **input context only**, never an implicit allow for sensitive categories.

### tRPC integration sketch

Follow [tRPC v11 middleware / authorization](https://trpc.io/docs/server/authorization): chain `.use()` after session check; throw `TRPCError({ code: "FORBIDDEN", message: "…" })` on deny. Prefer procedure `meta` for static permission/category/action so handlers cannot forget to declare them.

### UX notes (minimal for this story)

- No new admin screens (those are 2.3).
- Deep-link denial copy already exists: `operationalCopy.accessDeniedTitle` = «دسترسی ندارید.» — API FORBIDDEN messages should be consistent in tone.
- Nav hide / field omit remain UI fail-closed rules; **they are not authorization**. Envelope is the authority for data.

[Source: `EXPERIENCE.md`; `apps/web/lib/operational-copy.ts`]

### Project structure notes

```
packages/kernel/
  audit-envelope/src/     # NEW logic — authorize + policy hooks
  event-store/src/        # NEW logic — appendAccessEvent
packages/db/sql/          # NEW — event store migration(s)
packages/modules/identity-access/src/
  types.ts                # UPDATE — coarse scope on SessionContext
  (optional) authz-context.ts
apps/web/src/server/
  trpc.ts                 # UPDATE — governedProcedure
  context.ts              # UPDATE — map scope hooks
  root.ts                 # UPDATE — demo governed route
```

Dependency direction: `apps/web` → `@divan/audit-envelope` → `@divan/event-store` → DB (`pg`). identity-access supplies coarse context only; it already lists workspace deps on kernel packages but currently does not import them — wiring may stay at the tRPC boundary (preferred) so identity-access does not need to call the envelope for login.

### Previous story intelligence

- **1.4:** Auth.js JWT, `SessionContext`, `AuthAttempt` best-effort, `protectedProcedure` session-only — **extend**, do not replace. Production seed block and fail-closed codes stay.
- **1.5:** Nav/path denial + `AccessDenial` thin substrate; layout gate ≠ data authz; when data loaders appear, assert via envelope **before** fetch. Never import identity-access from client components.
- **1.8:** LDAP dark behind env; AD-5 reminder that fine authz is audit-envelope; deferred AuthAttempt retention → migration **plan** in this story; module `signOut` still deferred (DB re-check on governed entry closes the demote gap for data paths without full revoke).
- **Epic 1 retro (2026-07-16):** Strengthen 2.1 with layout≠RSC, session freshness on envelope, FR42→access-event migration note; no LDAP group→role assumption; wire one selfcheck script; keep story Status aligned with sprint-status when done.
- **Testing pattern:** lint + typecheck + `tsx` selfcheck; **wire ≥1 script** (retro); full Vitest/CI still not mandatory.
- **Commit style:** short `story 2.1`.

### Git intelligence

Recent commits: `33cf076` story 1.8 → `df7a304` 1.7 → `12af889` 1.6 → `4629aba` 1.5 → `abbe8ba` 1.4. Auth surface is stable; kernel stubs have never received domain logic — this is the first real kernel implementation.

### Latest tech information

- **tRPC 11.x** (already in repo): authorize via middleware on `t.procedure.use()`; session procedure already matches official patterns — add a second middleware layer for envelope, do not fork the stack.
- **Do not add NestJS or CASL** — absent from architecture; would fight AD-5 ownership of audit-envelope.
- **Prisma 7.8.x + `pg`:** use `pg` (or Prisma `$executeRaw` only if carefully isolated) for event-store inserts; prefer dedicated event-store module owning SQL so projections stay clean.
- **PostgreSQL 17.x:** append-only table; consider `REVOKE UPDATE, DELETE` on the events table for the app role when migrations allow (nice-to-have hardening, not a blocker if local role is superuser).

### Testing requirements

Epic DoD: **manual smoke + lint/typecheck + tsx selfcheck** (Vitest optional).

| Case | Expect |
| --- | --- |
| Unknown permission/category/action/scope | Deny + access event `result=deny` + Persian FORBIDDEN |
| Explicit allow fixture rule | Allow + access event `result=allow` |
| `coarseRole=system_admin` without allow rule for sensitive fixture | Deny (label never grants) |
| `coarseRole=manager` / `hr_admin` same | Deny without explicit rule |
| Access event append failure (simulated) on sensitive path | Operation fails closed (no silent allow) |
| DB demote/deactivate while JWT still old role | Governed call fails closed / uses DB role — not stale JWT allow |
| `me` / session identity | No HR category payload leakage |
| UI nav still works | Epic-1 landings unchanged |
| Logs | No sensitive field values duplicated into technical logs (FR-45 / FR-14 direction) |

### Project context reference

No `project-context.md` found in repo. Follow this story, `ARCHITECTURE-SPINE.md` AD-5, Epic 1 stories 1.4/1.5/1.8 Dev Notes, and `deferred-work.md`.

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 2.1, Epic 2, AD-5 excerpt
- `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-2, FR-42, FR-51, §8.1 default-deny
- `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-3, AD-5, AD-6
- `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md` — fine-grained / access audit rows
- `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — UI vs backend authz
- `_bmad-output/implementation-artifacts/1-8-ldap-authentication-internal-account-link-infra-gated.md`
- `_bmad-output/implementation-artifacts/1-4-seeded-accounts-coarse-role-auth-dev-bootstrap.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/epic-1-retro-2026-07-16.md` — constraints absorbed here
- `apps/web/src/server/{trpc,context,root}.ts`
- `apps/web/app/(app)/layout.tsx` — layout≠RSC lesson
- `packages/kernel/{audit-envelope,event-store}/src/index.ts`
- `packages/modules/identity-access/src/types.ts`

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- `pnpm db:sql:apply` → `001_kernel_events.sql` ok
- `pnpm --filter @divan/{event-store,audit-envelope,identity-access,db,web} typecheck` ok
- `pnpm --filter @divan/web lint` ok
- `pnpm --filter @divan/event-store selfcheck` ok
- `pnpm selfcheck:audit-envelope` ok
- `pnpm --filter @divan/web selfcheck:governed` ok (demote/deactivate freshness)

### Implementation Plan

1. Raw SQL `kernel_events` + `createPgPool` + append-only `@divan/event-store`
2. Default-deny `@divan/audit-envelope` with DEV_DEMO_POLICY fixture + atomic access append
3. `SessionContext.organizationalScopeIds` + `toEnvelopeAuthzContext`; freshness via `getSessionContext` (DB role wins over stale JWT)
4. tRPC `governedProcedure` meta chain; demo allow/deny procedures; `me` stays session-only
5. `assertPageAccess` helper + FR42 migration plan in `deferred-work.md`
6. Wired `selfcheck:audit-envelope` (+ package scripts); other Epic-1 selfchecks remain manual

### Completion Notes List

- **Layout ≠ RSC:** use `assertPageAccess(coarseRole, pathname)` in page/wrapper **before** any data loader; layout path swap is UI-only (`apps/web/lib/assert-page-access.ts`).
- **Authz freshness:** governed paths call `getSessionContext`; inactive → `UNAUTHORIZED`; authz uses DB `coarseRole` (never JWT alone). Full Auth.js revoke still deferred.
- **FR42 migration plan:** documented in Completion Notes + `deferred-work.md` (Story 2.1 section). Interim: keep `AuthAttempt` / path `AccessDenial`; all new governed decisions → envelope + event-store only; no new Prisma audit tables; backfill deferred to AR-AUDIT / Epic 7.
- **`me` choice:** session-only identity fields — not envelope-governed (avoids HR category backdoor).
- **Persian deny:** `MSG_ACCESS_DENIED_FA` / TRPC FORBIDDEN aligned with `operationalCopy.accessDeniedTitle` («دسترسی ندارید.»).
- **Selfcheck wiring:** root `pnpm selfcheck:audit-envelope` + `pnpm selfcheck:governed`; also `@divan/event-store`. Manual: navigation, ldap-auth, jalali, persian-digits, a11y-floor.
- **Manual browser smoke:** reviewer can login `sys.admin` / `hr.operator` and call `demoGovernedRead` (allow fixture) vs `demoSensitiveRead` (must FORBIDDEN); selfcheck already proves label≠entitlement + freshness.

### File List

- `.env.example`
- `README.md`
- `package.json`
- `pnpm-lock.yaml`
- `_bmad-output/implementation-artifacts/2-1-audit-envelope-default-deny-authorization-substrate.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/auth.ts`
- `apps/web/package.json`
- `apps/web/lib/assert-page-access.ts`
- `apps/web/src/server/context.ts`
- `apps/web/src/server/governed.selfcheck.ts`
- `apps/web/src/server/root.ts`
- `apps/web/src/server/trpc.ts`
- `apps/web/types/next-auth.d.ts`
- `packages/db/package.json`
- `packages/db/src/index.ts`
- `packages/db/sql/001_kernel_events.sql`
- `packages/db/sql/apply.mjs`
- `packages/db/sql/README.md`
- `packages/kernel/audit-envelope/package.json`
- `packages/kernel/audit-envelope/src/index.ts`
- `packages/kernel/audit-envelope/src/audit-envelope.selfcheck.ts`
- `packages/kernel/event-store/package.json`
- `packages/kernel/event-store/src/index.ts`
- `packages/kernel/event-store/src/event-store.selfcheck.ts`
- `packages/modules/identity-access/src/authenticate.ts`
- `packages/modules/identity-access/src/authz-context.ts`
- `packages/modules/identity-access/src/index.ts`
- `packages/modules/identity-access/src/types.ts`

### Change Log

- 2026-07-16: Implemented audit-envelope + event-store substrate, governedProcedure, freshness revalidation, FR42 migration plan, wired selfchecks; status → review
- 2026-07-16: Code review patches — fail-closed policy load, env harden, meta trim, authz error logging, `devOnly` demos, `selfcheck:governed` root wire; status → done

---

**Status:** done

Ultimate context engine analysis completed — comprehensive developer guide created.
