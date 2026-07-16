---
baseline_commit: 642c5da0f0e347fe65711b9690054750e7d50d5e
---

# Story 2.2: Sensitive Categories & Separate Export Permission

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an HR Data Owner / Security approver,
I want sensitive categories and sensitive export governed separately from ordinary view,
so that compensation and other sensitive fields cannot leak through view-only or System Admin paths (FR3).

## Gate (read first)

**AR-DATA and AR-ACCESS are still `pending`.** This story ships **category registry hooks + view≠export segregation + omit semantics** on the Story 2.1 envelope — not the production field matrix.

- Do **not** invent the full AR-ACCESS / AR-DATA launch matrix, toxic combinations, bulk thresholds, or break-glass elevation.
- Do **not** enable religion/health/family/bank/insurance/national-ID/compensation-like categories by default — they stay **disabled** until an AR-DATA disposition enables them.
- Do **not** build Access Admin UI (2.3), break-glass (2.5), full export artifact panel (6.5 / FR41–FR52), or real compensation domain schema (3.4).
- Ship a **configurable, fail-closed** category registry: unknown / disabled category → treat as non-grantable (omit / deny export).
- Reuse Story 2.1 substrate (`authorizeOrThrow`, `governedProcedure`, `action: "export"` already typed) — **extend**, do not replace or invent CASL/Nest/Ability.

[Source: `epics.md` Story 2.2; `prd.md` FR-3; `ARCHITECTURE-SPINE.md` AD-3/AD-5; `data-element-dispositions.md`; Story 2.1]

## Acceptance Criteria

1. **Given** AR-DATA category registry hooks exist (exact matrix may remain pending; categories are configurable)  
   **When** a caller holds view permission without category-specific or export permission  
   **Then** sensitive category values are **omitted** from responses (not masked as fake zeros) and export actions for those fields are unavailable

2. **And** System Admin has no routine HR-content repository access; any elevation path is time-bound, reasoned, and envelope-audited (break-glass details deferred to Story 2.5 — this story only proves the **deny-by-default** stance)

3. **And** religion/health/family/bank/insurance/national ID/compensation-like categories remain **disabled** until an AR-DATA disposition enables them

4. **And** compensation-facts module boundary is respected (separate schema/repo seam; no casual Prisma import of compensation tables from other modules)

## Tasks / Subtasks

- [x] Task 1: Sensitive category registry hooks (AC: #1, #3)
  - [x] Add a **configurable** category registry in `@divan/audit-envelope` (e.g. `categories.ts` + optional JSON/env load parallel to policy registry — names may vary; semantics must not)
  - [x] Registry entries at minimum: `id` (stable string), `enabled` (boolean), optional `sensitivity` / `requiresSeparateExport` flags
  - [x] Seed **known category ids** as hooks (configurable list), including at least: `compensation`, `identity.national_id` (or equivalent), `religion`, `health`, `family`, `bank`, `insurance`, plus any demo categories needed for selfcheck — **all production-sensitive ones default `enabled: false`**
  - [x] Fail-closed: unknown category id → not grantable; disabled category → not grantable even if a policy rule somehow mentions it (document which layer wins: prefer registry gate before/with policy eval)
  - [x] Document that production enablement is owned by AR-DATA disposition — local fixture may enable **only** a demo category (e.g. `demo.sensitive_hr`) for selfcheck, never religion/health/family/bank/insurance/national-ID/compensation-like by default
  - [x] Do **not** invent field-level Data Dictionary rows (FR7 / Story 3.3)

- [x] Task 2: View ≠ category-view ≠ export segregation (AC: #1, #2)
  - [x] Prove via policy + envelope that `action: "read"` allow does **not** imply `action: "export"` allow for the same `(permission, dataCategory, organizationalScope)`
  - [x] Extend `DEV_DEMO_POLICY` (or adjacent fixture) with explicit rules that demonstrate:
    - ordinary / non-sensitive read allow (keep existing `demo.selfcheck.read` behavior)
    - category-specific read allow for a **demo** sensitive category (optional — only if needed to prove omit vs full deny)
    - **no** export rule for that category (export must deny)
    - optional separate export allow rule on a distinct fixture permission for positive export path
  - [x] Coarse roles (`system_admin`, `manager`, `hr_admin`, …) remain **never** implicit allow keys — preserve 2.1 invariant
  - [x] Add demo governed procedure(s) in `apps/web/src/server/root.ts` (still `devOnly: true`):
    - e.g. `demoSensitiveExport` with `action: "export"` on a sensitive/demo category — must deny without explicit export rule even if a read rule exists for a related tuple
    - Keep `demoSensitiveRead` deny-without-rule behavior for System Admin proof
  - [x] Do **not** implement real file/CSV export artifacts, custody, reauth UX, or reporting module export panel

- [x] Task 3: Omit helper (not mask) (AC: #1)
  - [x] Ship a pure helper in audit-envelope (or thin web util that calls envelope APIs) e.g. `omitUnauthorizedCategories(payload, decisions)` / `projectAuthorizedFields(...)` that **deletes keys** for unauthorized/disabled categories
  - [x] Hard rule: unauthorized sensitive values must be **absent** from JSON (`undefined` / key missing) — **never** `"0"`, `null` as fake salary, `"—"`, or redacted placeholder strings that imply presence
  - [x] Demo query proving omit: return a fixture object that includes a sensitive key when authorized and **omits** it when not — assert key absence in selfcheck
  - [x] Align with UX OQ-3 / SPEC: DOM omit later (Stories 5.2+) — this story’s authority is **API/response omit**; document that UI must follow the same rule when profiles land
  - [x] Do **not** add NestJS `ClassSerializerInterceptor` / `class-transformer` — stack is tRPC + explicit project helpers

- [x] Task 4: System Admin / HR-content stance (AC: #2)
  - [x] Selfcheck + demo: `coarseRole=system_admin` cannot read sensitive fixture / cannot export without explicit allow rule
  - [x] Document (Dev Notes / package comment): routine System Admin path = identity/config/health only; HR-content elevation = Story 2.5 break-glass — **out of scope to implement** here
  - [x] Do **not** change `navigation.ts` or give System Admin new HR nav items

- [x] Task 5: Compensation-facts boundary seam (AC: #4)
  - [x] UPDATE `packages/modules/compensation-facts/src/index.ts` from empty stub to a **boundary seam only**: export typed placeholders / comments documenting that compensation facts live in a dedicated schema+repo and are reached only via this module + envelope-governed callers
  - [x] Add a short module README or top-of-file contract: other modules and `apps/web` must **not** import Prisma models / SQL for compensation tables directly (when they exist in 3.4)
  - [x] Optional guardrail: lightweight lint comment / dependency note — do **not** invent eslint-plugin architecture unless already present; a documented + type-level seam is enough for 2.2
  - [x] Do **not** create compensation Prisma schema, migrations, or payroll/tax logic (FR8 / Story 3.4)

- [x] Task 6: Wire docs + env (AC: #1–#4)
  - [x] Update `.env.example` / README only if new keys are required (e.g. category registry path) — mirror fail-closed load semantics from policy registry
  - [x] Update `deferred-work.md` with: AR-DATA enablement remaining; break-glass elevation (2.5); full export panel (6.5); real compensation schema (3.4)
  - [x] Keep FR42 migration plan from 2.1 intact — no new Prisma audit tables

- [x] Task 7: Selfcheck + DoD (AC: #1–#4)
  - [x] Extend `audit-envelope.selfcheck.ts` (and/or add focused selfcheck) covering table in Testing requirements below
  - [x] Wire or document root script(s) — prefer extending `selfcheck:audit-envelope`; add a second root script only if needed
  - [x] `pnpm` typecheck for `@divan/audit-envelope`, `@divan/compensation-facts`, `@divan/web` (+ lint web)
  - [x] Manual smoke: login as seeded `system_admin` and `hr_operator`; sensitive export demo denies; omit demo shows absent keys
  - [x] When marking story done: keep story-file `Status` in sync with `sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] Document map-completeness contract for `omitUnauthorizedCategories` (unmapped keys stay pass-through by design) [`packages/kernel/audit-envelope/src/index.ts:274`]
- [x] [Review][Patch] `demoOmitProjection` never proves omit-without-category-view [`apps/web/src/server/root.ts:86`]
- [x] [Review][Patch] `omitUnauthorizedCategories` trusts `allowedCategories` without registry gate [`packages/kernel/audit-envelope/src/index.ts:274`]
- [x] [Review][Patch] `loadCategoryRegistry` accepts invalid/non-object JSON entries [`packages/kernel/audit-envelope/src/categories.ts:135`]
- [x] [Review][Patch] Duplicate category ids: first entry wins silently [`packages/kernel/audit-envelope/src/categories.ts:118`]
- [x] [Review][Patch] `evaluatePolicy` remains public and bypasses category registry gate [`packages/kernel/audit-envelope/src/index.ts:226`]
- [x] [Review][Patch] Production category selfcheck passes on empty registry [`packages/kernel/audit-envelope/src/audit-envelope.selfcheck.ts:160`]
- [x] [Review][Patch] `AUDIT_ENVELOPE_USE_DEV_FIXTURE` only matches exact `"false"` (not `False`/`FALSE`) [`packages/kernel/audit-envelope/src/categories.ts:152`]
- [x] [Review][Patch] Shared category registry objects are mutable at runtime [`packages/kernel/audit-envelope/src/categories.ts:40`]

- [x] [Review][Defer] `governed.selfcheck` omits omit-projection / export-allow / tRPC category wiring coverage [`apps/web/src/server/governed.selfcheck.ts`] — deferred, pre-existing coverage gap pattern

## Dev Notes

### Epic context

- **Epic 2:** Entitlements & Access Governance — FR2, FR3, FR4, FR46, FR47, FR48.
- **This story** is the **FR3 layer** on top of the 2.1 substrate: category registry + separate export action + omit semantics + compensation boundary seam.
- **Upstream:** Story 2.1 (`done`) — `authorizeOrThrow`, `loadPolicyRegistry`, `governedProcedure`, access events, freshness, `action` already includes `"export"`.
- **Downstream:** 2.3 access admin UI; 2.4 entitlement lifecycle (sensitive grants need approval); 2.5 break-glass (export/admin denied by default); 2.6–2.7 temporal/bulk; 3.4 compensation domain; 5.2 profile omit-in-DOM; 6.5 export artifact panel.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Full AR-ACCESS / AR-DATA production matrix | Launch artifacts + later stories |
| Enabling religion/health/family/bank/insurance/national-ID/compensation by default | AR-DATA disposition |
| Access administration UI / role CRUD | Story 2.3 |
| Break-glass elevation UI + grant lifecycle | Story 2.5 |
| Temporal / as-of authorization | Story 2.6 |
| Bulk / inference thresholds | Story 2.7 |
| Real CSV/XLSX export artifacts, custody, reauth, formula-safe files | Story 6.5 / FR41–FR52 |
| Compensation DB schema + repository implementation | Story 3.4 / FR8 |
| Data Dictionary field enablement UI | Story 3.3 / FR7 |
| NestJS, CASL, Ability, Passport, class-transformer serializers | Not in architecture |
| Changing five MVP coarse roles or Epic-1 landings/nav | Frozen 1.4 / 1.5 |
| Client import of `@divan/identity-access` or kernel DB | Pulls `pg` — lessons 1.5 / 1.6 |
| New Prisma audit tables | AD-6 / 2.1 migration plan |

### Architecture compliance (MUST)

| Rule | Implication |
| --- | --- |
| **AD-5** | Fine-grained category + export checks live in **audit-envelope**; identity-access stays coarse context only |
| **AD-3** | Compensation facts = separate schema + dedicated repository behind `@divan/compensation-facts`; no casual ORM import from other modules |
| **AD-6** | Event log stays raw SQL via event-store; projections via Prisma only — no new audit-ish Prisma models |
| **FR-3** | Separate sensitive categories; separate sensitive export; System Admin ≠ routine HR content |
| **FR-2 / 2.1** | Default-deny; permission × category × action × Organizational Scope; coarse labels never grant |
| **FR-41 direction** | Export permission separate; this story proves segregation; full export governance later |
| **FR-51 direction** | Sensitive decisions still require atomic access events; append failure fails closed |
| **UX / SPEC** | Unauthorized sensitive fields omitted (not masked); API first in 2.2, DOM in later profile stories |

[Source: `ARCHITECTURE-SPINE.md` AD-3/AD-5; `infra-security-brief.md`; `prd.md` FR-3; `EXPERIENCE.md` OQ-3; `SPEC.md` constraints]

### Authz model for this story

```
identity-access (coarse role + scope hooks)
        ↓ context only
audit-envelope
  1) category registry: enabled? (disabled/unknown → non-grantable)
  2) policy exact-match: permission × dataCategory × action × organizationalScope
  3) action "read" ≠ "export" (separate allow rules)
  4) on sensitive decision → atomic event_class=access
        ↓
response projection: omit unauthorized category keys (never fake zeros)
```

### Current code to UPDATE (read before coding)

| File | Current state | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/kernel/audit-envelope/src/index.ts` | Policy registry + `authorizeOrThrow`; `AuthorizeAction` includes `"export"`; `DEV_DEMO_POLICY` + `DEMO_SENSITIVE_TUPLE` | Category registry hooks; export segregation fixtures; omit helper export; optional registry gate in evaluate path | Default-deny; fail-closed policy load; coarse role never allow key; `MSG_ACCESS_DENIED_FA` |
| `packages/kernel/audit-envelope/src/audit-envelope.selfcheck.ts` | Deny empty, allow fixture, sysadmin deny sensitive, audit-fail | Cases for disabled categories, read≠export, omit key absence | Existing 2.1 assertions |
| `apps/web/src/server/root.ts` | `demoGovernedRead`, `demoSensitiveRead` (`devOnly`) | Add export / omit demos (`devOnly`) | `me` session-only; production `devOnly` → NOT_FOUND |
| `apps/web/src/server/trpc.ts` | `governedProcedure` + freshness | Only if meta needs category-registry awareness — prefer keep meta shape; extend carefully | Layout≠data; DB revalidation; FORBIDDEN mapping |
| `packages/modules/compensation-facts/src/index.ts` | `export {}` stub | Boundary seam exports/docs only | Package name + workspace deps; no domain schema |
| `.env.example` / `README.md` | Policy env keys | Category registry env if added | No secrets |
| `deferred-work.md` | 2.1 leftovers | Point remaining FR3 enablement / 2.5 / 3.4 / 6.5 | Do not reopen deferred DB REVOKE items unless touching them |

### Recommended API sketch (guidance, not sacred names)

```ts
// category registry (conceptual)
type SensitiveCategory = {
  id: string;           // e.g. "compensation", "demo.sensitive_hr"
  enabled: boolean;     // false until AR-DATA disposition
  separateExport: true; // documentation flag — export always needs action:"export"
};

function loadCategoryRegistry(env): CategoryRegistry; // fail-closed
function assertCategoryEnabled(id: string): void;     // throws / returns deny signal

// omit (conceptual)
function omitUnauthorizedFields<T extends Record<string, unknown>>(
  row: T,
  fieldCategory: Record<keyof T & string, string>,
  allowedCategories: ReadonlySet<string>,
): Partial<T>; // keys for disallowed categories absent
```

Policy rules remain exact 4-tuple match from 2.1. Export is a **different `action` value**, not a permission-name convention alone.

### tRPC demo sketch

```ts
// conceptual — still meta-driven governedProcedure
demoSensitiveExport: governedProcedure
  .meta({
    permission: "demo.sensitive.export",
    dataCategory: "demo.sensitive_hr",
    action: "export",
    organizationalScope: "org:any",
    operation: "demo.sensitive.export",
    sensitive: true,
    devOnly: true,
  })
  .mutation(() => ({ exported: true })); // must not run on deny
```

Pair with a read allow (if any) that does **not** include this export rule — selfcheck proves segregation.

### UX notes

- No new admin or export UI screens in this story.
- Denial copy stays `MSG_ACCESS_DENIED_FA` / `operationalCopy.accessDeniedTitle` = «دسترسی ندارید.»
- Profile `person-profile-section` omit-from-DOM is **Story 5.2**; 2.2 establishes the server-side contract those UIs must obey.
- Open sprint action item (a11y/focus DoD for interactive surfaces) does **not** apply until interactive admin/export UIs land (2.3 / 6.5).

[Source: `EXPERIENCE.md`; `DESIGN.md`; sprint-status `action_items`]

### Project structure notes

```
packages/kernel/audit-envelope/src/
  index.ts              # UPDATE — registry + omit + fixtures
  categories.ts         # NEW (or equivalent) — category hooks
  audit-envelope.selfcheck.ts  # UPDATE
packages/modules/compensation-facts/src/
  index.ts              # UPDATE — boundary seam only
apps/web/src/server/
  root.ts               # UPDATE — export/omit demos
  trpc.ts               # UPDATE only if required
```

Dependency direction unchanged: `apps/web` → `@divan/audit-envelope` → `@divan/event-store` → DB. `@divan/compensation-facts` may depend on envelope but must not be imported casually from unrelated modules for “just the salary column.”

### Previous story intelligence (2.1)

| Learning | Apply in 2.2 |
| --- | --- |
| Layout ≠ RSC | Still true — chrome hide ≠ data authz |
| Fresh authz via `getSessionContext` | Keep on every governed path |
| Fail-closed policy load | Mirror for category registry load |
| `devOnly` demos | Required on new demo procedures |
| No CASL / Nest / Prisma event log | Still forbidden |
| Selfcheck via `tsx` + ≥1 root script | Extend `selfcheck:audit-envelope` preferred |
| Review patches | Keep fail-closed parse, trim meta, log `AuthorizationError.code`+`correlationId` |
| Deferred items | Do not “fix” REVOKE/version-table/pool lifecycle unless in scope |
| Commit style | Short `story 2.2` |

**Files established by 2.1 (do not regress):** `authorizeOrThrow`, `evaluateAuthorization` (category gate; policy exact-match is internal), `loadPolicyRegistry`, `createAuditEnvelope`, `governedProcedure`, `appendAccessEvent`, `001_kernel_events.sql`, `assertPageAccess`, `toEnvelopeAuthzContext`.

### Git intelligence

- HEAD implementation of 2.1: commit `642c5da` (`story 2.1`) — first real kernel logic.
- Prior pattern: one short commit per story (`story 1.8` … `story 2.1`).
- Baseline for this story file: `642c5da`.

### Latest tech information

- **Omit, don’t mask:** Industry guidance for sensitive API fields is whitelist/DTO projection or key deletion — never return fake zeros or placeholder values that leak existence semantics incorrectly. Prefer explicit project helpers over framework serializers.
- **Do not add NestJS ClassSerializer / class-transformer** — would fight the T3 + tRPC + kernel envelope stack already chosen in AD-5/AD-6.
- **tRPC 11:** continue meta + middleware authorization; throw `TRPCError` `FORBIDDEN` with Persian message on deny.
- **Reuse existing packages** — no new authz libraries.

### Testing requirements

Epic DoD: **manual smoke + lint/typecheck + tsx selfcheck** (Vitest optional).

| Case | Expect |
| --- | --- |
| Disabled category (e.g. `compensation`) | Non-grantable — deny / omit even if someone adds a rogue allow attempt in fixture docs |
| Unknown category id | Fail closed |
| `action: "read"` allow without `action: "export"` rule | Export demo denies + access event `result=deny` |
| Explicit export allow fixture (demo only) | Export allow + access event `result=allow` |
| Unauthorized sensitive field in fixture payload | Key **absent** after omit helper (not `0` / `"—"`) |
| `coarseRole=system_admin` without allow | Sensitive read/export still deny |
| Existing 2.1 cases | Still pass (non-HR demo allow; empty registry deny; audit append fail closed) |
| Production `NODE_ENV=production` | `devOnly` demos → NOT_FOUND before envelope |
| Logs | No sensitive field values duplicated into technical logs |

### Project context reference

No `project-context.md` found in repo. Follow this story + Story 2.1 + Architecture Spine + Epic 2 constraints.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2 / Story 2.2]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-3, FR-41, FR-46]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-3, AD-5]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md`]
- [Source: `_bmad-output/specs/spec-divan/data-element-dispositions.md` — disabled until AR-DATA]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md` — omit / export panel]
- [Source: `_bmad-output/implementation-artifacts/2-1-audit-envelope-default-deny-authorization-substrate.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- `pnpm --filter @divan/audit-envelope typecheck` — pass
- `pnpm --filter @divan/compensation-facts typecheck` — pass
- `pnpm --filter @divan/web typecheck` — pass
- `pnpm --filter @divan/web lint` — pass
- `pnpm selfcheck:audit-envelope` — pass (categories, read≠export, omit, disabled/unknown, sysadmin deny)
- `pnpm selfcheck:governed` — pass (export deny + freshness)

### Completion Notes List

- Added fail-closed category registry (`categories.ts`) with production-sensitive hooks default-disabled; demo enables only `demo.non_hr` / `demo.sensitive_hr`.
- Authorize path: category gate **before** policy (`evaluateAuthorization`); unknown/disabled → deny even with rogue rules.
- Extended `DEV_DEMO_POLICY` for category-view read, export deny (read≠export), and explicit export allow fixtures.
- Shipped `omitUnauthorizedCategories` — unauthorized keys absent (not masked); `demoOmitProjection` demo query.
- Demo procedures: `demoSensitiveExport` (deny), `demoSensitiveExportAllowed` (allow), kept `demoSensitiveRead` deny-without-rule.
- `@divan/compensation-facts` boundary seam + README (no schema/migrations).
- Docs: `.env.example` `AUDIT_ENVELOPE_CATEGORY_PATH`, README selfcheck note, `deferred-work.md` Story 2.2 deferrals; FR42 plan untouched.

### File List

- `packages/kernel/audit-envelope/src/categories.ts` (new)
- `packages/kernel/audit-envelope/src/index.ts`
- `packages/kernel/audit-envelope/src/audit-envelope.selfcheck.ts`
- `packages/modules/compensation-facts/src/index.ts`
- `packages/modules/compensation-facts/README.md` (new)
- `apps/web/src/server/root.ts`
- `apps/web/src/server/trpc.ts`
- `apps/web/src/server/governed.selfcheck.ts`
- `.env.example`
- `README.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-2-sensitive-categories-separate-export-permission.md`

### Change Log

- 2026-07-16: Implemented sensitive category registry, read≠export segregation, omit helper, compensation boundary seam, demos + selfchecks; status → review
- 2026-07-16: Code review patches — omit map contract + registry filter, demoOmitProjection AC#1 proof, category JSON harden/freeze, evaluatePolicy privatized, selfcheck tighten; status → done

## Story completion status

- Status: **done**
- Note: Code review patches applied (omit contract, demoOmitProjection AC#1 proof, registry harden, evaluatePolicy privatized); one defer remains in deferred-work.md
