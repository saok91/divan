## Deferred from: code review of 4-2-draft-finalization-conflict-classification.md (2026-07-18)

- Primary-assignment overlap conflict stub beyond EmploymentStarted employment overlap — product Primary-mutating flows are 4.5–4.7; EXCLUDE stays on `applyPrimaryAssignmentProjection`
- Irreconcilable ordering conflict stub — Story 4.4 deterministic ordering / recalc
- Selfcheck delete↔finalize race is sequential (finalize then delete), not true concurrency — revisit with Vitest/ephemeral DB isolation

## Deferred from: Story 4.2 draft finalization & conflict classification (2026-07-18)

- **Draft / finalize / conflict landed** — `PersonnelEventDraft` Prisma working store; `createDraft` / `updateDraft` / `deleteDraft`; `finalizeDraft` inside `withTransaction` + `appendBusinessEvent` + AD-6 projection hook; `classifyConflicts` + evaluation snapshot (FR-56); risk-tier fail-closed stubs; governed tRPC `personnelEvent.*`; minimal فرم رویداد + sensitive confirm; authz modal real save-draft seam
- **Still 4.3+:** Cancel / Reverse / Correction writers + UX-DR10 full badge set (Scheduled vs Effective UI distinction beyond storage token)
- **Still 4.4+:** Deterministic same-day ordering + pg-boss recalc UI
- **Still 4.5–4.8:** Start / Return / Terminate / Transfer / job-comp domain Operators (same finalize substrate)
- **Still 4.9–4.11:** Current/historical person & org reconstruction products
- **Still 4.12+:** Headcount Approval / Reservation / Override product lifecycle (finalize port remains fail-closed stub for consuming types)
- **Hash-chain / PopulationPort cutover / Vitest isolation** unchanged from 4.1 notes

## Deferred from: code review of 4-1-append-only-event-store-attributable-event-record.md (2026-07-18)

- `event-store.selfcheck` permanently inserts access + business fixture rows into `kernel_events` with no cleanup / isolation — same thin-selfcheck pattern as prior stories; isolate DB when Vitest/CI lands

## Deferred from: Story 4.1 append-only event store / attributable event record (2026-07-18)

- **Business attributable record landed** — `003_business_event_attributable_fields.sql` + real `appendBusinessEvent` (FR-14 columns, PascalCase type, evidence sanitizer, append-only trigger)
- **4.2 landed:** Draft edit/delete UI, finalization product flow, conflict classification (see Story 4.2 deferred block above)
- **Still 4.3+:** Scheduled / Cancel / Reverse / Correction writers and UX-DR10 badges
- **Still 4.4+:** Deterministic same-day ordering + pg-boss recalc
- **Still 4.5–4.8:** Start / Return / Terminate / Transfer / job-comp Operators flows (Transfer coverage-after-atomic-close+open + AR-TEMPORAL apply active-as-of remain fail-closed dispositions in 4.1 Dev Notes)
- **Hash-chain tamper evidence (NFR-10 / AR-AUDIT)** still deferred
- **AuthAttempt → access event migration** unchanged from Story 2.1 plan (keep writing AuthAttempt on login)
- **PopulationPort default-registry cutover** — criteria encoded in `population-cutover.ts` + Story 4.1 Dev Notes; **not executed**; fixtures remain until all criteria met
- DB `REVOKE UPDATE/DELETE` on `kernel_events` still commented (role model unclear); trigger hardening ships in 4.1

## Deferred from: code review of 3-9-derived-management-relationships.md (2026-07-18)

- N+1 / O(teams×members) queries in `deriveManagementEdgesAsOf` / `listManagedPersonsAsOf` / `listTeamMembersAsOf` without batching or caching — acceptable for ~500 MVP; revisit under NFR-13 pressure
- `dateOnlyFromDb` via `toISOString().slice(0,10)` — same DATE mapping pattern as Employment/Primary/Secondary; harden if non-UTC driver behavior appears
- `management-relationship.selfcheck` mutates shared seed DB (temp second middle-manager / leave-team) with best-effort restore — same thin-selfcheck pattern; isolate DB when Vitest/CI lands

## Deferred from: code review of 3-3-data-dictionary-governed-profile-fields.md (2026-07-17)

- No DB CHECK that `enabled` ⇒ `disposition=approve` / disposition ∈ {approve,later,reject} — domain `enableDataElement` enforces; add constraint if raw-SQL hardening becomes a threat
- `data-dictionary.selfcheck` mutates shared DB rows (temp disable / force-approve) with best-effort restore — same thin-selfcheck pattern as prior stories; isolate DB when Vitest/CI lands
- Per-actor category/grant filtering inside `listEnabledProfileFields(actorCtx)` — MVP keeps dictionary-only list; `appearOnProfile` value omit stays on `projectPersonRecord` until grant resolution is wired end-to-end

## Deferred from: code review of 1-2-brand-tokens-typography-theme-toggle.md (2026-07-16)

- Dark/light `button` secondary contrast vs DESIGN primary pairs (`#FFFFFF` on `#4D9FFF` / `#006FFF`) ? **resolved in Story 1.7**: measured AA fail; nudged `--primary` to `#006DFF` (light) / `#1E6FE0` (dark) so secondary ? 4.5:1 at 14px (`a11y-floor.selfcheck.ts`)

## Deferred from: code review of 1-3-app-shell-chrome-sidebar-skip-link.md (2026-07-16)

- Viewport gate vs browser zoom ? **resolved in Story 1.7**: JS gate (`shouldActivateViewportGate`) uses outer/screen metrics so 200% zoom on ?1280?720 displays keeps the shell; genuine small windows still gate
- Fixed `#banner-stack` has no reserved height/offset for main ? **resolved in Story 1.7**: ResizeObserver publishes `--banner-stack-height`; main padding offsets chrome + stack
- UserMenu lacks full APG menu keyboard pattern (roving tabindex, focus move into menu, Tab trap) ? **resolved in Story 1.7**: Arrow/Home/End roving, open focuses first item, Escape returns to trigger, Tab closes (minimal APG)
- Sidebar active state uses exact `pathname === "/"` for dashboard ? nested role landings (1.5) will need a prefix/segment strategy ? **done in Story 1.5** (prefix/segment active matching)

## Deferred from: code review of 1-4-seeded-accounts-coarse-role-auth-dev-bootstrap.md (2026-07-16)

- `PROVIDER_UNAVAILABLE` login UI mapping ? **resolved in Story 1.8**: `login-form` maps to `operationalCopy.ldapUnavailable`
- Timing side-channel on unknown username (no dummy bcrypt) ? acceptable for epic-1 bootstrap; harden later if threat model requires
- `AuthAttempt` without retention policy / FK ? thin FR42 substrate; full audit envelope lands in Epic 2

## Deferred from: code review of 1-5-role-landings-permission-filtered-navigation.md (2026-07-16)

- Layout-only path gate still executes forbidden `page.tsx` RSC children ? acceptable for Epic-1 empty shells; when pages add data loaders, assert access in the page (or shared page wrapper) before fetching ? layout `{children}` swap alone does not stop page execution
- AccessDenial write amplification / no `accountId` index or retention ? thin FR42 substrate; rate limits and audit envelope belong in Epic 2
- JWT `coarseRole` remains until session refresh after DB demote/deactivate ? same Auth.js JWT pattern as 1.4; **server-side revoke / LDAP logout hook still deferred** (Story 1.8 left `signOut` module no-op; revisit in Epic 2 / ops)
- `isRedirectError` import from `next/dist/client/components/redirect-error` ? pre-existing 1.4; replace when Next exposes a stable public helper
- `navigation.selfcheck.ts` not wired into package scripts/CI ? acceptable until Vitest/CI story lands; run manually via `tsx`
- Dual role source at login (JWT from `authenticate` vs `getActiveCoarseRoleByUsername` for landing) ? required because same-request `auth()` cannot read the new cookie; rare mid-login role change only

## Deferred from: Story 1.8 LDAP authentication (2026-07-16)

- Formal AR-IDENTITY still open: topology, MFA/conditional access, concurrent-session/lockout numbers, emergency account, AD/LDAP group?coarse role sync ? do not claim frozen
- Module `signOut` server-side session revoke (JWT stale role after demote) ? deferred beyond 1.8; Auth.js JWT clear remains apps/web
- `ldap-auth.selfcheck.ts` not wired into package scripts/CI ? same pattern as navigation selfcheck; run manually via `tsx`

## Deferred from: code review of 1-8-ldap-authentication-internal-account-link-infra-gated.md (2026-07-16)

- STARTTLS not supported for plain `ldap://` ? wait for Infra/AR-IDENTITY approved topology (prefer LDAPS; do not invent StartTLS until required)
- Directory account disabled/locked/expired only evaluated at login ? JWT refresh uses DB `getSessionContext` only; AD revalidation / continuous auth out of Epic-1 scope
- Non-49 LDAP bind result codes (e.g. password expired / unwillingToPerform) currently fall through to `PROVIDER_UNAVAILABLE` ? map precisely once AR-IDENTITY freezes directory account-state codes
- Module `signOut` / JWT stale role after demote ? already deferred (reaffirmed in code review)
- `ldap-auth.selfcheck` deeper coverage + CI wiring ? already deferred until Vitest/CI story
- Invalid `LDAP_CREATE_MAPPING_JSON` keeps entire LDAP config unavailable (fail-closed) ? intentional; do not silently treat as empty map
- Default `LDAP_LOGIN_ATTRIBUTE=uid` / `LDAP_DISPLAY_NAME_ATTRIBUTE=cn` when unset ? keep common placeholders; Infra overrides via env
## Deferred from: code review of 1-6-command-palette-jalali-date-picker-persian-digits.md (2026-07-16)

- Jalali/persian selfcheck scripts not wired into package.json/CI ? same pattern as Story 1.5 navigation selfcheck; run manually via `tsx` until Vitest/CI story lands

## Deferred from: code review of 1-7-accessibility-floor-banner-behavior-operational-copy.md (2026-07-16)

- Break-glass grant with `active: true` and `expiresAt: null` is treated as forever-live (`isGrantLive`) ? **resolved in Story 2.5**: live grants require finite future `expiresAt`; server hydrate from real grants; personnel mock toggle removed
- Viewport gate using `window.screen` can mis-classify windows on a small secondary display when the primary screen reports large metrics ? browser display-API limitation; revisit if multi-monitor support becomes an MVP requirement

## Deferred from: Story 2.1 audit-envelope / event-store (2026-07-16)

### FR42 thin tables ? `event_class=access` migration plan

| Source (Epic 1) | Target | Interim (2.1+) | Later |
| --- | --- | --- | --- |
| `AuthAttempt` (login) | `kernel_events` / `event_class=access` (`operation?auth.authenticate`) | **Keep** writing `AuthAttempt` on login; do **not** add a second login-audit table | Backfill / dual-write cutover under AR-AUDIT; Epic 7 investigation UI reads event-store |
| `AccessDenial` (deep-link / path) | `event_class=access` (`operation?nav.path_denied` or envelope deny) | New **governed** denials go through envelope + event-store only; path-gate may keep `AccessDenial` until a thin adapter writes access events | Stop `AccessDenial` inserts once adapter lands; retain table read-only or drop after backfill |
| New governed R/W decisions | Envelope + `@divan/event-store` only | **Mandatory** ? never Prisma parallel audit | ? |

**Hard rules:** no new Prisma ?audit-ish? tables in Epic 2; expand event-store via `packages/db/sql/` when AR-AUDIT adds columns. Historical backfill of `AuthAttempt` / `AccessDenial` is **not** required in 2.1 code ? plan + stop sprawl is mandatory.

### Still open (do not invent)

- **AR-ACCESS** ? production permission ? category ? action ? scope matrix, toxic combinations, bulk thresholds
- **AR-AUDIT** ? final access-event schema richness, hash-chain / separate audit DB, investigation UX (Epic 7)
- **AR-IDENTITY** ? topology, MFA, group?coarse-role sync, directory account-state codes, STARTTLS
- Full Auth.js server-side session revoke / LDAP continuous revalidation (DB re-check on governed entry ships in 2.1)
- Vitest/CI for all selfchecks ? only `selfcheck:audit-envelope` (and package scripts) wired; navigation/ldap/jalali/persian/a11y remain manual `tsx`

## Deferred from: code review of 2-1-audit-envelope-default-deny-authorization-substrate.md (2026-07-16)

- DB-level append-only hardening (`REVOKE UPDATE, DELETE` on `kernel_events`) ? story marks nice-to-have when app role is not superuser; left commented in `001_kernel_events.sql`
- `packages/db/sql/apply.mjs` has no `kernel_schema_migrations` version table ? safe while files are `IF NOT EXISTS`; add before non-idempotent alters
- Process-wide governed envelope `pg.Pool` (no shutdown / sticky first `DATABASE_URL`) ? acceptable for long-lived Next server; revisit for serverless/multi-URL
- `governed.selfcheck` mutates seeded `sys.admin` with best-effort `finally` restore ? local/dev only; do not run concurrent against a shared DB

## Deferred from: Story 2.2 sensitive categories / separate export (2026-07-16)

- **AR-DATA** — production enablement of religion/health/family/bank/insurance/national-ID/compensation-like categories (registry hooks ship disabled)
- ~~**Break-glass elevation** for System Admin / privileged HR-content access — Story 2.5~~ **done in Story 2.5** (incident-bound grant + minimal HR-read binding + banner + post-use review)
- **Full export artifact panel** (CSV/XLSX, custody, reauth, formula-safe files) — Story 6.5 / FR41–FR52 (2.2 proves `action: "export"` segregation only)
- ~~**Real compensation schema + repository** — Story 3.4 / FR8 (`@divan/compensation-facts` is a typed boundary seam only)~~ **done in Story 3.4** (schema `compensation` + `CompensationFact` + projection writers; category still disabled; mutations = Story 4.8; profile section = 5.2; export panel = 6.5; AR-DATA owns enablement/masking)
- Profile **DOM omit** for unauthorized sensitive fields — Story 5.2+ (2.2 establishes API/response omit contract)
- FR42 migration plan from Story 2.1 remains intact ? no new Prisma audit tables

## Deferred from: code review of 2-2-sensitive-categories-separate-export-permission.md (2026-07-16)

- `governed.selfcheck` only asserts export deny on an injected envelope; omit projection, explicit export-allow path, and real `getCategories: loadCategoryRegistry` tRPC wiring remain uncovered ? same thin-demo selfcheck pattern as 2.1; deepen when Vitest/CI or a later access-governance story expands web selfchecks

## Deferred from: Story 2.3 access administration UI & APIs (2026-07-16)

- **AR-ACCESS** still pending ? production field?action?scope matrix, full toxic-combination catalog, bulk thresholds; Story 2.3 ships fail-closed toxic hooks + governed CRUD only
- ~~Entitlement request?approval?expiry?recertification lifecycle ? Story 2.4~~ **done in Story 2.4** (real grant state machine + lazy fail-safe on protected entry)
- ~~Break-glass grant UI / elevation ? Story 2.5~~ **done in Story 2.5** (permission administration remains deniable under break-glass by default)
- LDAP/AD group ? coarse role or Organizational Scope sync ? still forbidden until AR-IDENTITY; Admin may only view/clear/relink `externalDirectoryId`
- Full audit investigation UI for access evidence ? Story 7.1 (events append to event-store; reviewable via query)
- FR42 migration plan from Story 2.1 remains intact ? no new Prisma audit tables; `actor_account_id` widened to TEXT so cuid account ids attribute correctly

## Deferred from: code review of 2-3-access-administration-ui-apis.md (2026-07-16)

- `/access` RSC skips fresh `getSessionContext` ? inactive JWT may still render the Admin shell; governed tRPC paths already fail closed via freshness (same Auth.js JWT pattern deferred since Epic 1)
- Concurrent `assignAccountAccessRoles` / `updateAccountLink` are last-writer-wins without optimistic concurrency ? acceptable for single-admin MVP; revisit if multi-admin contention becomes real
- `governedProcedure` `decisionId ?? correlationId` fallback ? pre-existing 2.1 substrate; not reachable after successful `authorizeOrThrow`
- Minimal UI first-item role/scope assign ? MVP acceptable; APIs already support full id lists; richer multi-select/clear UX later
- PermissionSet.permissions free-string catalog ? defer allowlist until AR-ACCESS freezes production permission codes; empty sets still rejected

## Deferred from: Story 2.4 entitlement lifecycle (2026-07-16)

- ~~**Break-glass** incident-bound grants + banner + post-use review ? Story 2.5~~ **done in Story 2.5**
- ~~**Temporal / as-of / cross-boundary** retrieval authz ? Story 2.6~~ **done in Story 2.6** (control plane: PopulationPort fixtures, membership, as-of, cross_time_scope, mid-session modal; Epic 3/4 replace fixture port with real projections)
- ~~**Inference / bulk / small-cohort** thresholds ? Story 2.7~~ **done in Story 2.7** (InferenceBulkPort + shared channel plane + bulk approval gate + BG non-bypass; AR-ACCESS/AR-REPORTING production numbers still pending)
- **Artifact / export reauth consumers** must call `reauthorizeForQueuedOrArtifactWork` ? Stories 6.5 / 7.x (hook shipped + asOf/population optional; no full artifact lifecycle here)
- **Optional background expiry/recert worker** (pg-boss) ? MVP uses lazy fail-safe on `getSessionContext` / governed entry; cron not required
- **AR-ACCESS** production matrix values (approval kinds, recert SLA, revocation objective milliseconds) still pending ? demo hooks are configurable + fail-closed
- Dual-admin UX for independent approve in single-seed environments ? selfcheck temporarily binds `access_admin` to a second account; production needs ?2 access admins

## Deferred from: Story 2.5 break-glass privileged access (2026-07-17)

- **AR-ACCESS** exact break-glass policy / max-duration SLA / production elevation matrix ? launch artifacts; demo hooks only
- **Emergency LDAP/local break-glass account** vaulting, FIDO, dual-custody ? AR-IDENTITY (open)
- ~~**Temporal / as-of** must still bound break-glass retrievals ? Story 2.6~~ **done in Story 2.6** (privileged demo read runs PopulationPort intersection)
- ~~**Inference / bulk** must not be bypassed by break-glass channels ? Story 2.7~~ **done in Story 2.7** (privileged demo read runs InferenceBulkPort; export/admin denials unchanged)
- **Full export artifact panel** / exceptional export UX ? Story 6.5
- **Audit investigation UI** / ?no self-review of sensitive activity? surface ? Story 7.1 (evidence + toxic review API shipped here)
- **NFR-6 restore-invalidates-emergency-grants** ? no backup restore path yet; deferred hook documented in `break-glass.ts`
- **Paging / SIEM / credential rotation** runbooks ? ops / infra-security
- ~~Access admin grant expiry/`datetime-local` Gregorian inputs~~ **resolved 2026-07-17**: break-glass + entitlement grant forms use `JalaliDateTimePicker` (FR44 / Story 1.6); storage remains ISO Gregorian

## Deferred from: Story 2.6 temporal & cross-boundary authorization (2026-07-17)

- **Epic 3/4** replace fixture `PopulationPort` with Person / Assignment / OrgUnit projection-backed population ? **cutover named in Story 3.1** (`Person.id` UUID target; fixtures remain until 3.5?3.9 / 4.x)
- **Full personnel search / profile / dashboard / report catalogue** consume intersection API ? Epic 5
- ~~**Inference / bulk / small-cohort** thresholds ? Story 2.7~~ **done in Story 2.7** (control plane shipped; Epic 5/6 consumers + AR-* production numbers remain)
- **Artifact reauth consumers** with as-of/population ? Stories 6.5 / 7.x
- **AR-ACCESS** production field?action?scope?time matrix values
- **AR-TEMPORAL** full freeze beyond partial (Asia/Tehran date-only / exclusive ends / future?Effective labeling already hooked)

## Deferred from: Story 2.7 inference-resistant & bulk retrieval controls (2026-07-17)

- **AR-ACCESS** production bulk/volume/window/field-cumulative threshold numbers + toxic catalog freeze
- **AR-REPORTING** production small-cohort numbers + sequential acceptance fixtures + full secondary cell-suppression table algebra
- **Epic 5** search / profile / dashboard / report catalogue consumers of InferenceBulkPort (demo plane only here)
- **Story 6.5** export artifact panel / custody ack on top of same thresholds
- Complementary secondary-suppression sophistication beyond demo equivalent (fail-closed comparison surface)

## Deferred from: Story 3.1 stable Person identity (2026-07-17)

- **Person master-data landed** (create/update identity, Personnel Code uniqueness, `/personnel` RSC + thin form)
- **Personnel Code correction / merge / split / return-match** still AR-DATA / AR-MIGRATION ? fail-closed Persian ops remain
- **PopulationPort fixture ? Person UUID cutover** still open until Assignment / Org projections (Stories 3.5?3.9 / 4.x); subject id target = `Person.id` (see `person-employment` `population-cutover.ts` + `population-authz.ts` comment)
- Sticky break-glass / permission-set fingerprint debt unchanged (code-review of 2.6)
- **`identity.national_id` category** stays disabled until formal AR-DATA enablement
- Full personnel search table / profile / timeline ? Epic 5; Employment mutations ? Epic 4

## Deferred from: Story 3.2 employment lifecycle invariants (2026-07-17)

- **Employment projection + invariants landed** (`applyEmploymentProjection` / `closeEmploymentProjection`; domain non-overlap + PG EXCLUDE; ?1 active as-of)
- **Start / Return / Termination** user flows + authoritative event append = Stories 4.5?4.6 (not this story)
- **Concurrent multi-Employment policy exceptions** still AR-DATA ? fail-closed Persian reject remains
- **Primary Assignment integrity** (exactly one active) = **Story 3.7 (done)** — schema + invariants live; product mutations = Epic 4
- **Secondary Assignment fidelity** = **Story 3.8 (done)** — schema + inventory gate + equivalent-overlap; no headcount; product mutations = Epic 4
- **PopulationPort fixture → Person UUID cutover** still waits on management/events (3.9 / 4.x); Team membership helper live in 3.7; Secondary read helpers live in 3.8
- Org hierarchy tables / Legal Entity→Team master-data = **Story 3.5 (done)**; Primary Team membership = **Story 3.7 (done)** via `PrimaryAssignment.teamId` (no Employment.orgUnitId)

## Deferred from: Story 3.5 organization hierarchy management (2026-07-17)

- **OrgUnit adjacency hierarchy landed** (LE→BU→Dept→Team; half-open validity; activate/deactivate without erase)
- **AR-TEMPORAL / AR-HEADCOUNT disposition** for deactivation-with-members still open — fail-closed `DEACTIVATION_BLOCKED_DEPENDENCIES` remains
- **Primary Assignment Team membership** = **Story 3.7 (done)** via `PrimaryAssignment.teamId` (no Employment.orgUnitId); product mutations = Epic 4
- **Job Role / Title / Ladder / Grade / Seniority** = **Story 3.6 (done)** — five distinct refs; Grade∈Ladder + half-grades; no universal Grade↔Seniority mapping; Primary FKs = **Story 3.7 (done)**; AR-TEMPORAL disposition for deactivation-with-Assignment/Event deps still open
- **Interactive org chart / drag-drop reorg** remains non-goal / Could-Have
- **PopulationPort full cutover** still waits on Secondary / management / events (3.8+/4.x); Primary Team helper alone does not complete cutover

## Deferred from: Story 3.6 independent job reference concepts (2026-07-17)

- **Job refs landed** (OrganizationalRole, JobTitle, Ladder, Grade, Seniority; Decimal half-grades; synced dual activate/deactivate)
- **AR-TEMPORAL disposition** for deactivating refs used by active/Scheduled Assignment or Personnel Event still open — fail-closed hooks remain (Primary deps wired in 3.7)
- **Assignment FKs / Primary Assignment job facts** = **Story 3.7 (done)** for schema + projection writers; Epic 4 for event-backed product mutations
- **Job-change Personnel Events** (Role/Title/Ladder/Grade/Seniority change) = Story 4.8
- **Universal or Ladder-specific Grade↔Seniority mapping** remains out of scope / non-MVP
- **Headcount Approval matching** (Job Title + optional Seniority) = Epic 4

## Deferred from: code review of 3-6-independent-job-reference-concepts.md (2026-07-17)

- Read-then-create code uniqueness race before insert — unique constraint still catches; harden with transaction/upsert pattern later if needed
- Selfcheck does not cover `update*Identity` / rank-change dependency gate — extend when Assignment deps exist
- Seed `ensureByCode` only checks existence; mutated seed rows are not healed on re-seed
- Optional `update*Identity` APIs exist but Admin UI only exposes create/activate/deactivate
- Job-ref panel has no as-of picker; API `listGradesForLadder(asOf?)` already supports helpers for later stories
- Grade validity interval is not constrained within parent Ladder interval — leave unconstrained until AR-TEMPORAL / Assignment (do not invent containment policy in 3.6)

## Deferred from: Story 3.7 primary assignment integrity (2026-07-17)

- **Primary Assignment schema + integrity landed** (`PrimaryAssignment` projection, EXCLUDE per Employment, apply/close/read, Team + job-fact FKs, coverage asserts, dependency hooks)
- **Product create/change/end Primary** (Start / Transfer / job-change UI + event append) = Stories 4.5–4.8 — projection writers only in 3.7
- **Secondary Assignment** = **Story 3.8 (done)** — see deferred section below
- **Derived management relationships** = **Story 3.9 (done)** — see deferred section below
- **Headcount Approval / consumption / Reservation / Override** = Epic 4 (FR-28..FR-32); `headcountApprovalId` not required on Primary in 3.7
- **AR-TEMPORAL disposition** for deactivation-with-active-Primary still open — fail-closed hooks remain (`DEACTIVATION_BLOCKED_DEPENDENCIES`)
- **PopulationPort** — `resolveTeamMembershipAsOf` helper available; Secondary read helpers available (3.8); management derive + adapter available (3.9); **full fixture cutover still not claimed complete** (AR-IDENTITY / 4.x)
- Profile Assignments section UI = Epic 5 / UX-DR8

## Deferred from: Story 3.8 secondary assignment fidelity (2026-07-18)

- **Secondary Assignment schema + integrity landed** (`SecondaryAssignment` projection separate from Primary, equivalent-overlap EXCLUDE, inventory gate stub, apply/close/read, OrgUnit+job-ref hooks, no headcount columns)
- **Product create/change/end Secondary** = Epic 4 Personnel Event flows — projection writers only in 3.8
- **Migration / Baseline Secondary import** = Epic 6
- **AR-SECONDARY approved inventory / acceptance oracle** still pending — provisional codes (`acting_manager`, `cross_dept_support`) fail-closed stub only
- **Headcount non-consumption confirmed** for Secondary by default (FR-12 / FR-29); no `@divan/headcount` wiring
- **Derived management relationships** = **Story 3.9 (done)** — from Primary only; Secondary never a source
- **PopulationPort full cutover** still not claimed (AR-IDENTITY / 4.x); derive APIs + adapter live in 3.9; default registry still fixture-backed
- Profile Assignments section UI (Primary + Secondary display) = Epic 5 / UX-DR8
- Effort %, billing, scheduling, matrix-org, Secondary approval workflow = explicit AR-SECONDARY non-goals

## Deferred from: Story 3.9 derived management relationships (2026-07-18)

- **FR-13 derivation landed** — `resolveTeamManagerAsOf` / `listManagedPersonsAsOf` / `deriveManagementEdgesAsOf` + provisional `AR_MANAGEMENT_ROLE_REGISTRY`; no editable management shadow table; no product manager API/UI
- **Senior MVP rule documented:** `ROLE-SNR-MGR` scopes to Department parent of manager’s Team; full AR-ACCESS senior scope matrix still pending
- **AR-ACCESS / AR-TEMPORAL** acting / interim / co-manager / reorganization winner policies still undefined — ambiguity remains fail-closed (`AMBIGUOUS_TEAM_MANAGER` / `AMBIGUOUS_MANAGEMENT_SCOPE`)
- **Secondary `acting_manager` inventory** is explicitly **not** a management derivation source
- **PopulationPort:** adapter `buildManagementRelationshipsFromDerivation` + seed Account username map for demo middle-manager available; **default `intersectPopulation` registry still fixture-backed** (`person:a1`, …) until AR-IDENTITY Person↔Account link + 4.x wiring — do not claim full cutover
- Interactive org chart / hierarchy visualization = post-MVP addendum §14.2
- Profile Assignments UI / headcount / Personnel Event append = Epic 4–5

## Deferred from: code review of 3-8-secondary-assignment-fidelity.md (2026-07-18)

- `assertRefsExist` does not validate OrgUnit/job-ref active-as-of the Secondary interval — same disposition as 3.7 Primary; hooks block deactivate of refs still cited by active-as-of-today Secondaries, but apply can still attach inactive/ended refs until AR-TEMPORAL disposition lands
- OrgUnit/job-ref dependency hook registry passes no deactivate-as-of date — future-start vs currently-active Secondary filtering cannot be precise without extending the 3.5/3.6 hook signature; 3.8 intentionally uses active-as-of-today (per story Dev Notes); revisit when AR-TEMPORAL / Assignment event writers need as-of deactivation

## Deferred from: code review of 3-7-primary-assignment-integrity.md (2026-07-17)

- `assertRefsExist` does not validate Team/job-ref active-as-of the Primary interval — aligns with open AR-TEMPORAL disposition; hooks block deactivate of refs still cited by open Primaries, but apply can still attach inactive/ended refs until disposition lands
- OrgUnit/job-ref dependency hook registry passes no deactivate-as-of date — future-start vs currently-active Primary filtering cannot be precise without extending the 3.5/3.6 hook signature; revisit when AR-TEMPORAL / Assignment event writers need as-of deactivation
- **Coverage assert on apply/close** — keep assert-only for Epic 3 projection writers; Epic 4 event finalization (Transfer close+open atomic) must call `assertPrimaryCoverageForActiveEmployment` after the combined write. Reason: enforcing on `close` alone would break mid-Transfer; seed + selfcheck already prove the assert.

## Deferred from: code review of 2-4-entitlement-lifecycle-grant-expiry-revocation-recertification.md (2026-07-17)

- Empty `assignAccountAccessRoles` / `assignAccountScopes` (full wipe) bypasses the new mass-assign lifecycle gate ? pre-existing Story 2.3 full-replace semantics; only `length > 1` was gated in 2.4
- Legacy/non-grant `AccountAccessRole` / scope joins (direct standard assign) are invisible to expiry/recert fail-safes ? intentional while standard single assign remains; revisit when AR-ACCESS classifies privileged singles
- `mass_assignment` grant kind is gated at direct assign but has no multi-target activate payload ? defer fulfillment until AR-ACCESS / follow-up; avoid scope creep in 2.4 patch pass

## Deferred from: code review of 2-5-break-glass-privileged-access.md (2026-07-17)

- PermissionSet of an elevated break-glass role can be mutated after activate to add non-allowlisted permissions; allowlist is only checked at request/activate ? continuous revalidation belongs to AR-ACCESS / access-admin hardening

## Deferred from: code review of 2-6-temporal-cross-boundary-authorization.md (2026-07-17)

- Sticky `breakGlassOverride` in `PlatformStatusProvider` can keep a live banner after server-side revoke/expiry until remount ? revisit with stronger me-poll reconciliation
- Authz binding fingerprint hashes role/scope ids only; permission-set content edits on the same role ids do not trigger mid-session AUTHZ_CHANGED ? deepen when AR-ACCESS classifies privileged permission mutations
- PopulationPort `unreconciled` is only a caller flag; no server-side membership reconciliation signal yet ? Epic 3/4 projection sync owns real stale/unreconciled detection
- `intervalsOverlap` compares raw strings without `parseDateOnly` ? fine for trusted fixture bounds; harden if untrusted interval inputs appear

## Deferred from: code review of 2-7-inference-resistant-bulk-retrieval-controls.md (2026-07-17)

- In-memory `actorWindows` Map is process-local ? multi-instance / serverless / restart bypasses volume + differencing until a shared store lands with AR-ACCESS
- Concurrent `evaluateInferenceBulk` for the same `actorId` can race window counters ? needs actor-scoped lock or shared atomic store (same production hardening as above)
- `AUDIT_INFERENCE_BULK_ENABLED=true` in production loads DEMO hook numbers ? keep fail-closed default; wire real AR-ACCESS/AR-REPORTING values when freeze lands (do not invent)
- Export channel facet on `demoScopedRetrieval` / `demoInferenceBulkProbe` uses `action: "read"` for FR-48 parity ? full FR-3 export allow + 2.5 elevation denials on channel facet wait for Story 6.5 / real export surfaces

## Deferred from: code review of 3-1-stable-person-identity.md (2026-07-17)

- Envelope records allow before PermissionSet deny on Person procedures ? governedProcedure 4-tuple allow/audit then handler PermissionSet gate; same layering as other governed routes
- `identity-access` depends on `person-employment` for seed fixtures ? monorepo seed orchestration; revisit module boundary if AD-3 ownership hardens
- No optimistic concurrency / `updatedAt` precondition on `updatePersonIdentity` ? last-write-wins acceptable for 3.1 thin maintain; add version check when concurrent HR editors matter
- ~~`mobilePhone` stored raw without digit/format normalization~~ → **closed in Story 3.3** (`normalizeIranianMobilePhone` + dictionary `format` metadata)
- Blocked deep-link ops still pass envelope allow then domain FORBIDDEN ? intentional deep-link surface for fail-closed Persian copy; quieter audit meta can wait
- Domain `PersonRecord` always loads `nationalId`; omission only in `toPublicPerson` / `projectPersonRecord` ? tRPC public DTO is gated; tighten domain select when more in-process callers appear
- Person PermissionSet checks ignore entitlement grant lifecycle (as-of / expiry / break-glass) ? PermissionSet-only OK for 3.1 demo; deepen when Person joins full Epic 2 authz path

## Deferred from: story 3-3-data-dictionary-governed-profile-fields (2026-07-17)

- Data Dictionary registry landed (`DataElement` + enablement gates + thin personnel DOM omit for enabled approve fields)
- Full personnel profile section DOM omit for all Epic 5 categories → Story 5.2
- FR-55 formal dictionary versioning / owner sign-off UI → still open (registryVersion foreshadow only)
- Employment / contract / compensation field enablement walks → AR-DATA (Story 3.4 seeded `later` candidates; production enablement still open)
- Derived elements not in MVP seed — helpers stubbed; `assertDerivedSensitivityAllowed` reusable for compensation components when AR-DATA enables

## Deferred from: story 3-4-compensation-contractual-facts-module (2026-07-17)

- Isolated compensation schema + projection writers landed (`compensation.CompensationFact`, `apply*Projection`, selfcheck)
- Production `compensation` category enablement + exact field enablement/masking → AR-DATA
- User-facing contract/compensation mutations → Story 4.8 (same projection surface)
- Personnel profile compensation section → Story 5.2
- Export artifact panel → Story 6.5
- Payroll / tax / insurance / payment calculation → permanently out of scope (FR-8)

## Deferred from: code review of 3-4-compensation-contractual-facts-module.md (2026-07-17)

- Domain check-then-act race on compensation overlap / second-open — EXCLUDE remains NFR-4 backstop; concurrent path may map to `OVERLAPPING_COMPENSATION` via `23P01` rather than `CONCURRENT_COMPENSATION_FORBIDDEN` (same deferral pattern as Employment 3.2)
- Selfcheck creates mutation Person + facts on shared `DATABASE_URL` without cleanup — thin selfcheck pattern continues; use ephemeral DB in CI when suite hardens
- `assertDerivedSensitivityAllowed` not wired on compensation `components` Json writes — stub reusable from 3.3; wire when AR-DATA defines derived component lineage/sensitivity (storage of opaque components remains allowed)
- Contractual free-text notes share `compensation.notes` ELEMENT_ID — add separate `contract.notes` only after AR-DATA catalogue walk

## Deferred from: code review of 3-2-employment-lifecycle-invariants.md (2026-07-17)

- Domain check-then-act race maps concurrent second-open to `OVERLAPPING_EMPLOYMENT` via `23P01` rather than `CONCURRENT_EMPLOYMENT_FORBIDDEN` � EXCLUDE remains NFR-4 backstop; refine error mapping when Epic 4 writers need distinct codes under contention
- `dateOnlyFromDb` via `toISOString().slice(0,10)` � same Person 3.1 DATE mapping; harden if non-UTC driver behavior appears
- No DB `CHECK (endDateExclusive > startDate)` � domain `assertValidEmploymentInterval` remains mandatory; add CHECK if raw SQL writers become a threat
- temporal-engine open-end sentinel `9999-12-31` vs PG unbounded `daterange` � engine pre-existing; revisit only if far-horizon intervals matter
