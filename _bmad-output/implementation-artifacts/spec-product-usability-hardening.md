---
title: 'Divan product usability and operational hardening'
type: bugfix
created: '2026-10-18'
status: done
baseline_commit: 9775a39fb09a15e1b09ce6d3079888bb8356b73a
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The existing Persian HRIS has source-confirmed usability defects in personnel discovery, navigation, and overlays, alongside session-expiry and background-recovery gaps. Existing design selfchecks pass but do not establish end-to-end usability or deployment readiness.

**Approach:** Complete a cross-layer hardening pass prioritizing accurate personnel discovery and usable daily workflows, then validate authenticated flows, authorization boundaries, failure recovery, and production builds. Preserve the existing visual identity while improving shared interaction primitives. Track additional verified blockers discovered during implementation; do not equate this initial investigation with exhaustive certification.

## Boundaries & Constraints

**Always:** Preserve Persian RTL, Jalali dates, accessible keyboard operation, light/dark tokens, permission-filtered rows and fields, separate export authorization, immutable business events, and evaluation-snapshot integrity. Keep authorization fresh at protected operations. Respect existing user changes. Use isolated fixtures for mutation tests.

**Ask First:** Production deployment, destructive data operations, changes to approved access policy, and expanding the original desktop-only product to fully supported mobile workflows.

**Never:** Bypass scope restrictions to make lists appear populated, clear recalculation markers without successful processing, expose HR data in logs, or describe untested behavior as production-ready. Do not replace the brand or introduce unrelated product features.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Personnel discovery | Matching authorized person outside first 25 rows | Global search finds person; filtering precedes pagination | Distinguish failed request from no matches |
| Filter/history/export | Change query/team, navigate back, request export | Reset incompatible snapshots; export uses effective supported query | Explain unsupported filter semantics |
| Overlay | Short viewport, 200% zoom, long validation content | All controls remain reachable by scrolling and keyboard | Preserve focus restoration |
| Session refresh | Expired or malformed token requests update | Reject before refreshing identity or activity | Require sign-in |
| Recovery | Commit succeeded, enqueue failed while worker remains alive | Periodic bounded reclaim eventually processes durable pending row | Retry without falsely clearing status |
| Readiness | Database cannot connect or answer | Bounded unhealthy response | No infrastructure details in public response |

</frozen-after-approval>

## Code Map

- `apps/web/components/personnel/personnel-list-panel.tsx` — server pages currently combined with misleading local filters and sorting; absent URL team leaves stale state.
- `apps/web/src/server/personnel-scoped-search.ts` and `person.ts` — authorized population, query, and snapshot contracts.
- `apps/web/components/app-sidebar.tsx` — prefix-active navigation prevents returning from a profile.
- `apps/web/components/ui/dialog.tsx` and `popover.tsx` — missing viewport height constraints and incomplete reduced-motion support.
- `apps/web/auth.ts` — update branch precedes timeout validation.
- `workers/src/index.ts` and `apps/web/src/server/recalc-enqueue.ts` — startup-only recovery and incomplete initialization cleanup.
- `packages/db/src/index.ts` — readiness creates a disposable client without explicit deadlines.
- `apps/web/src/server/context.ts` and `trpc.ts` — overlapping authorization hydration; preserve middleware revalidation during optimization.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/package.json`, `apps/web/tsconfig.json`, `README.md` — establish repeatable checks under supported Node 22; regenerate corrupted generated route types through Next tooling and distinguish cache failures from source failures.
- [x] `apps/web/components/` — resolve the baseline React hook errors (effect-driven state and render-time refs), preserving URL hydration, dirty-form protection, and mutation feedback; do not disable lint rules globally.
- [x] `apps/web/auth.ts` — validate token shape and expiry before update, with behavioral expiry-boundary regression tests.
- [x] `workers/src/index.ts`, `apps/web/src/server/recalc-enqueue.ts` — implement non-overlapping periodic recovery with bounded batches, initialization cleanup, and safe shutdown; retain generation-specific queue deduplication.
- [x] `packages/db/src/index.ts`, `apps/web/app/api/health/route.ts` — bound health connection/query duration and release resources, without shortening legitimate domain transaction budgets.
- [x] `apps/web/components/personnel/personnel-list-panel.tsx`, `apps/web/src/server/person.ts`, `apps/web/src/server/personnel-scoped-search.ts` — connect global search and supported sorting/filtering to authorized server results; remove misleading local-only controls, reset pagination/snapshots on query changes, and align export inputs.
- [x] `apps/web/components/app-sidebar.tsx` — separate active-section styling from destination equivalence; preserve unsaved-change guards.
- [x] `apps/web/components/ui/dialog.tsx`, `popover.tsx` — constrain overlays, support scrolling and reduced motion; verify long forms and date/filter popovers.
- [x] `apps/web/app/(app)/loading.tsx`, `error.tsx`, `apps/web/app/not-found.tsx` — add consistent Persian loading, recoverable errors, and navigation recovery using existing design primitives.
- [x] `apps/web/src/server/context.ts`, `trpc.ts` — measure redundant session lookups and remove only provably redundant hydration; verify revocation and scope changes still take effect.
- [x] Relevant module selfchecks — cover matrix behaviors, including more-than-one-page discovery, URL clearing, expired updates, reclaim failure/retry/shutdown, and health deadlines.
- [x] `README.md` — record verified run/build steps and remaining deployment prerequisites after live workflow verification.

**Acceptance Criteria:**
- Given authorized seeded test roles, when exercising login, list/profile, event entry, reporting/export, and settings, then permitted paths complete with meaningful loading/error feedback and forbidden paths remain denied.
- Given light/dark themes and 100%/200% zoom on supported desktop screens, when using shared navigation/forms, then focus, contrast, scrolling, and action visibility remain usable.
- Given representative isolated data, when measuring list and protected-request latency before and after changes, then report actual measurements and query counts without claiming unmeasured gains.
- Given the supported runtime and configured test database, when running build, typecheck, lint, and relevant behavioral checks, then required checks pass or outstanding environmental blockers are explicitly documented.

## Spec Change Log

## Design Notes

The existing desktop viewport gate is deliberate. Keep it until mobile scope is decided; improve zoom and constrained-height desktop behavior now. Global search must operate inside the authorized population, not fetch unrestricted records into the browser. Final release readiness also depends on real identity/population configuration and deployment services, which have not yet been verified.

## Verification

- `pnpm --filter @divan/web typecheck`
- `pnpm lint`
- `pnpm --filter @divan/web selfcheck:design-qa`
- `pnpm build`
- Relevant targeted selfchecks and isolated database integration checks; inspect their mutation behavior before execution.
- Browser checks: multi-page personnel search, browser history, profile-to-list navigation, tall dialogs, expired sessions, recoverable network errors, keyboard focus, and light/dark rendering.

Initial baseline: clean main branch; Node 24.12.0 installed versus required 22.x. Design QA passed. Typecheck failed parsing visibly corrupted generated `.next/dev/types/routes.d.ts`; no source-level conclusion yet. Web lint failed with 39 errors and 10 warnings; root lint was consequently not reached. No application code changed during planning.

## Implementation Verification Record

- Node 22.23.3; all workspace typechecks and optimized Next build passed.
- Fresh installation: 18 Prisma migrations, 23 kernel SQL files, five seeded roles succeeded against an isolated PostgreSQL 17.10 database.
- Full lint passed without errors or warnings; design QA passed.
- Session malformed/expired update tests, health black-hole deadline test, recovery-loop failure/shutdown tests passed.
- Integration: 61-person global search and snapshot continuation, 61-row export, scope-change snapshot denial, inactive-account protected/governed denial passed. First page 831ms; global matching query 597ms in one local sample. These are post-change measurements, not a before/after latency claim. The request path removes one redundant session hydration per tRPC batch, retaining per-operation DB validation.
- Running worker recovered an unsent durable marker in 16436ms without restart.
- Browser: operator and HR admin logins, person creation, profile return, search, team selection/clear/back/forward, Jalali date entry, unsaved-form discard navigation, report execution, settings rejection of invalid values, and custom 404 recovery verified. Light/dark screenshots and constrained dialog evidence saved under docs/qa/2026-10-18.
- Browser zoom shortcut did not change the embedded browser zoom; 640x360 CSS viewport was tested instead. Production identity/population/policy and baseline configuration remain external cutover prerequisites.
- Further fixes exposed by browser/integration checks: preserved personnel-root query parameters; corrected organization permission failures to FORBIDDEN; localized profile/report/dashboard dates and collaboration labels; hid scaffold event creation; fixed leave-guard history cleanup cancelling approved navigation; aligned export reauthorization with the source population adapter and current DB scope bindings.

## Review Resolution

Two independent reviews were deduplicated and resolved as follows:

- High / patch: arbitrary collaboration text could resolve inherited object properties; Map-backed labels now preserve legacy text safely.
- High / patch: constrained entity pickers could clip options; outer scrolling remains enabled. Command-palette scrolling follows the same constraint.
- Medium / patch: failed preference writes could suppress local changes; an explicit persistence result retains in-memory preferences on failure.
- Medium / patch: transient query errors could replay URL presets/dialog intent; successful hydration is now keyed only by URL.
- Medium / patch: historical ScaffoldChangeRecorded filters disappeared with creation cleanup; search options retain this historical type separately.
- High / exposed defect fixed: clean settings drafts compared against an incoming value; synchronization now compares the previous server value, preserving actual edits. Mutation success resets the draft, including reset-to-default.
- Medium / patch: search/export wording implied complete discovery despite an authorization/retrieval cap. UI now states the bounded search scope and directs administrators to review configuration; query refinement is no longer suggested as a cure for pre-query truncation.
- Pre-existing deployment prerequisite: the development registry/bulk ceiling and projection budget intentionally limit the population. The 61-person integration check uses explicit test-only bulk hooks and does not prove unrestricted discovery under default demo policy. Production population/policy remains a cutover requirement.

New product-UI behavioral checks cover clean/dirty settings synchronization, inherited collaboration names, failed storage writes; timeline checks retain historical search types without enabling their creation.

## Final Verification — 2026-10-19

- Final optimized build and full project lint passed after review fixes; Next's build TypeScript pass includes the new UI boundary checks.
- All workspace typechecks, design QA, session, timeline/event-list, and product-UI checks passed.
- Final authenticated development-browser login and query results verified. Production-build preview booted and correctly rejected seeded identity; real-provider login remains unverified. The preview requires the documented trusted-host setup.
- At 640x360, keyboard End reached the last command-palette destination visibly; screenshot saved. Viewport reset after testing. Team options resolved and final query returned the expected single person.
- Final preview remains at http://127.0.0.1:3000 with isolated QA data. No production deployment or policy widening performed.

## Suggested Review Order

**Discovery and authorization**

- Review server-scoped discovery and snapshot membership.
  [personnel-scoped-search.ts:606](../../apps/web/src/server/personnel-scoped-search.ts#L606)

- Keep export completeness and current authorization aligned.
  [export-artifact.ts:444](../../apps/web/src/server/export-artifact.ts#L444)

- Apply query filters before pagination and preserve browser history.
  [personnel-list-panel.tsx:148](../../apps/web/components/personnel/personnel-list-panel.tsx#L148)

**Session and background reliability**

- Validate expiry before explicit session refresh.
  [session-token.ts:5](../../apps/web/lib/session-token.ts#L5)

- Retain per-operation live authorization while avoiding duplicate hydration.
  [trpc.ts:128](../../apps/web/src/server/trpc.ts#L128)

- Recover committed recalculation work without restarting.
  [index.ts:110](../../workers/src/index.ts#L110)

- Bound database readiness independently from domain transactions.
  [index.ts:107](../../packages/db/src/index.ts#L107)

**Interaction and install safety**

- Preserve form edits while synchronizing clean settings drafts.
  [settings-draft.ts:46](../../apps/web/lib/settings-draft.ts#L46)

- Keep short-viewport dialogs scrollable.
  [dialog.tsx:50](../../apps/web/components/ui/dialog.tsx#L50)

- Preserve approved navigation through dirty-form history traps.
  [leave-guard-provider.tsx:112](../../apps/web/components/leave-guard/leave-guard-provider.tsx#L112)

- Bootstrap the event table before dependent Prisma migrations.
  [migration.sql:5](../../packages/db/prisma/migrations/20260716210000_kernel_events_bootstrap/migration.sql#L5)

**Verification and operation**

- Exercise multi-page retrieval, export and live revocation in isolated fixtures.
  [product-hardening.selfcheck.ts:11](../../apps/web/src/server/product-hardening.selfcheck.ts#L11)

- Check settings hydration and arbitrary collaboration values.
  [product-ui.selfcheck.ts:5](../../apps/web/lib/product-ui.selfcheck.ts#L5)

- Follow verified setup and deployment prerequisites.
  [README.md:117](../../README.md#L117)

