---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-19.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md
excludedDocuments:
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md
  - docs/pre-prd.md
  - _bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/addendum.md
  - _bmad-output/specs/spec-divan/SPEC.md
  - review/reconcile artifacts under prd and ux folders
exclusionRationale: PRD is authoritative product-scope contract; Architecture Spine + infra companion cover build substrate; UX spine pair (2026-07-31) is the forward UX contract — 2026-07-19 and 2026-07-13 retained as historical reference only (spines win on conflict). Epic 1–7 and 4b acceptance criteria remain historically true against 2026-07-19; Epic 8 onward are written against 2026-07-31. Addendum/SPEC/pre-prd remain reference only to avoid duplicate or non-MVP scope bleed into stories. Sprint Change Proposal 2026-07-19 authorized Epic 4b insertion before Epic 5; Sprint Change Proposal 2026-07-31 authorized PRD FR-57–FR-60 and Epics 8–10.
---

# divan - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for divan, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Authenticate launch users against organization-approved LDAP/AD and link each accepted identity to one internal account; never store LDAP passwords; fail closed with clear Persian message on identity outage.
FR2: Authorize every protected read and mutation by explicit permission, data category, action, and Organizational Scope independently of UI visibility (default-deny).
FR3: Separately govern sensitive data categories (compensation, identity, contact, family, health, religion, bank, insurance, contractual, termination, etc.) and separately authorize sensitive export; System Admin has no routine HR-content access.
FR4: Authorized administrators manage roles, permissions, scopes, account links, and active status with attributable, reviewable changes.
FR5: Create and maintain a stable Person with unique Personnel Code and approved identity keys; ending Employment preserves Person and permitted history.
FR6: Maintain non-overlapping historical Employments and enforce at most one active Employment per Person at any instant in MVP; start and return create Employment + Primary Assignment.
FR7: Enable only Data-Dictionary-approved profile fields; display current/historical categories by permission; free text purpose-limited; derived elements retain lineage.
FR8: Retain approved effective-dated compensation and contractual facts without performing payroll, tax, insurance, or payment calculations.
FR9: Manage effective-dated Legal Entity → Business Unit → Department → Team hierarchy; activate/deactivate without erasing history; enforce parent/child validity intervals.
FR10: Manage Organizational Role, Job Title, Ladder, Grade, and Seniority as distinct reference concepts; Grade limited to chosen Ladder including half-grades.
FR11: Every active Employment has exactly one active Primary Assignment at an instant; changes occur only through authoritative Personnel Events.
FR12: Represent, migrate, view, create, change, and end the finite Secondary Assignment scenarios approved in AR-SECONDARY without consuming headcount by default.
FR13: Derive and report approved management relationships from governed Assignment and organization facts; ambiguity fails closed for access.
FR14: Every Personnel Event retains unique identity, type, Person, Employment, Effective Date, registration/finalization actors and times, status, reason/reference, provenance, and authorized before/after evidence.
FR15: Support Draft create/edit/delete and finalization by HR Admin or explicitly permitted Operator without universal secondary approval; sensitive/high-impact tiers require independent pre-authorization; Finalized events cannot be directly edited or hard-deleted.
FR16: Future Finalized events enter Scheduled state and remain authoritative without altering current state before Effective Date; as-of evaluation includes only valid Finalized events effective at evaluation point.
FR17: Neutralize Scheduled events with Cancel, Effective events with Reverse, and factual errors with linked Correction chains while preserving originals; Cancel racing effective transition has one atomic outcome.
FR18: Produce identical current and historical state from the same authoritative event set using documented deterministic ordering (Asia/Tehran; date-only Effective Date; exclusive interval ends; same-date by registration/finalization time); pre-Baseline native events require Override + Persian warning acknowledgement + audit.
FR19: Before finalization, classify known conflicts as blocking or warning under AR-TEMPORAL and explain consequences in Persian; warnings require acknowledgement or Override where allowed.
FR20: Record effective-dated starts and returns that create one Employment and one Primary Assignment against applicable headcount; Operator cannot finalize without capacity; only Admin Override path.
FR21: Record effective-dated termination that ends active Employment and Assignments and releases headcount at effect; dispose incompatible future events before finalization.
FR22: Record effective-dated Team transfer replacing source Primary Assignment with destination; source release and destination consumption are one atomic outcome; no-op equivalent destination rejected.
FR23: Independently record effective-dated changes to Organizational Role, Job Title, Seniority, Ladder, and Grade subject to compatibility; Job Title/Seniority re-evaluate headcount; Grade alone does not consume capacity.
FR24: Record effective-dated contractual and compensation changes under separately approved permissions; record final promotion outcome only (no request/committee workflow).
FR25: View current Person state (Employment, Primary/in-scope Secondary Assignments, organization, Role, Job Title, Ladder, Grade, Seniority, contractual, compensation) according to permissions; reconcile across profile, lists, dashboard, reports.
FR26: Reconstruct supported Person state at a selected as-of date; disclose Baseline limitations; future as-of uses planned-state semantics distinct from Effective.
FR27: Reconstruct core Team/organization membership counts and approved/used/reserved/free headcount for a supported historical date.
FR28: Manage Headcount Approvals with unique requirement code, Team, Job Title, optional Seniority, allowed count, validity, status, approval reference, and provenance; Draft/Cancelled/Expired cannot accept new consumption or Reservation.
FR29: Every Primary Assignment consumes compatible headcount (Team + Job Title + optional Seniority) unless audited exemption applies; default match oldest valid compatible approval; manual reselection audited.
FR30: Finalizing a future start or inbound transfer immediately reserves one compatible destination unit; source remains consumed until transfer Effective; 14-day expiry warning then Scheduled exception with no partial apply.
FR31: Start, termination, return, transfer, Reverse, and Correction update linked headcount as one deterministic business operation at each affected effective point; failure leaves prior state unchanged.
FR32: Only HR Admin with explicit permission may Override headcount shortage/validity/Job Title/Seniority rules with mandatory context; free capacity may go negative; Overrides visible as distinct rows.
FR33: Permission-safe search and filter of approved personnel, event, organization, and headcount data; sorting, pagination over stable snapshot, result count, column selection, filtered export, Persian empty/error states.
FR34: Permission-filtered Person profile and chronological Personnel Event timeline with type, dates, actors, status, provenance, and correction/neutralization chain.
FR35: Permission-safe launch dashboard covering workforce/organization totals, workforce trend, Team membership/capacity, starts vs terminations, and open headcount with synchronized org/time filters and reconciliation links.
FR36: Run the source-defined launch report catalogue with permission-safe current/as-of semantics, Jalali dates, synchronized filters, and export under FR41.
FR37: Import approved CSV/XLSX templates through identification, validation, preview, confirmation, execution, and result stages with row/column Persian errors; cancel before execution; concurrent overlapping batches cannot silently overwrite.
FR38: Every executed import is atomic or reliably rolled back and traceable through an Import Batch with full evidence; repeat input cannot silently duplicate.
FR39: Represent approved Baseline separately from native Personnel Events; identify migrated provenance and reconstructable-history boundary.
FR40: Support signed reconciliation of Person, Employment, Assignment, Personnel Event, current state, Team totals, mappings, headcount, duplicates, orphans, and control totals; production cutover blocked without signed reconciliation and zero unresolved critical defects.
FR41: Export only filtered records/fields/dates/scope permitted by AR-ACCESS/AR-REPORTING in AR-DATA-approved format; audit actor, purpose, filters, volume, outcome, and artifact handling.
FR42: Create AR-AUDIT-governed evidence for authentication, sensitive/denied reads, mutations, finalization, Cancel/Reverse/Correction, organization/headcount changes, Override, import, export, permission/configuration, and privileged access; ordinary users cannot alter audit records.
FR43: All MVP user-facing pages, navigation, forms, tables, charts, validations, warnings, errors, and confirmations are Persian and RTL for desktop (1280×720–2K; 1920×1080 reference); long forms sectioned; unsaved changes warned; destructive/sensitive confirmed.
FR44: Accept and display user-facing business dates in Jalali with unambiguous Effective Dates; registration/finalization timestamps precise and distinct from Effective Date.
FR45: Authorized operators observe service, identity, import/recalculation, backup, and dependency health without routine access to sensitive HR content; stale/failed derived state visible and cannot masquerade as current truth; fail closed when required inputs stale.
FR46: Govern entitlement lifecycle (request, independent approval, activation, expiry, revocation, recertification, evidence); block toxic combinations; break-glass incident-bound, minimal, auto-expiring, independently reviewed.
FR47: Every profile, timeline, search, count, dashboard, report, export, and audit retrieval evaluates subject, object, category, action, Organizational Scope, and current/as-of time semantics; cross-boundary results contain only permitted intersection; stale authz inputs fail closed.
FR48: Jointly govern UI/API/search/list/count/dashboard/report/export as data access with inference-resistant and bulk retrieval controls (small-cohort, differencing, volume/window thresholds).
FR49: Each internal human account represents exactly one human linked to one active stable external identity or proven same-human aliases; joiner/mover/leaver/rehire lifecycle; directory outage never creates routine local access.
FR50: Enforce AR-DATA lifecycle and AR-ACCESS rules for every Data Element and artifact category including retention, disposal, legal hold/release, and propagation to derived state, exports, caches, and backups.
FR51: Required audit evidence is independently trustworthy; no actor may alter, hide, dispose of, or approve review of their own sensitive activity; required-audit failure prevents or safely suspends the governed operation.
FR52: Import/preview/error/staging/export/download artifacts follow lifecycle controls through creation, retrieval, expiry, revocation, and disposal; formula-safe spreadsheets; reauth at generation and each retrieval; custody notices at download; no claim to revoke local copies after leave.
FR53: Track restricted external data-subject correction-case evidence without employee self-service; bounded AR-DATA-approved attachments only; breached deadline distinct state; approved outcomes link to Correction/retention/response evidence.
FR54: Formal decision-report publications are reproducible only while lawful source/evidence exists; retroactive Correction creates supersession notice rather than silent rewrite; post-disposal may mark `non-reproducible-after-disposal`.
FR55: Every Launch Artifact Register item is versioned, attributable, approved for stated scope/period, and governed through change, waiver, expiry, and reapproval; conflicting artifacts block affected baseline until resolved.
FR56: Business operations spanning mutable reference data or result sets resolve against one attributable valid evaluation snapshot; finalization, import, pagination, export, and formal publication complete against validated snapshot or fail without mixing versions.
FR57: Users identify people, organizational units, job reference concepts, and governed records by approved business identifiers; internal technical identifiers are never required as user input and never stand as primary displayed identity; selection controls stay permission-safe and enumeration-safe.
FR58: All MVP surfaces present one consistent interaction system in which available actions are visually and programmatically discoverable; one feedback vocabulary with stated precedence; every surface, state, badge, chart, and banner verified in light and dark at the NFR12 contrast floor.
FR59: Every surface reachable from navigation is functional and explains its purpose, state, and next step in user terms; bulk entry is reachable by every role permitted to create that data individually, uses the FR37 validated preview/execute path, and offers a template matching the accepted structure exactly.
FR60: Authorized administrators view and, where explicitly permitted, change governed application parameters through an attributable, audited administration surface, with defaults, sources, editability, and change paths stated.

### NonFunctional Requirements

NFR1: TLS MUST protect all application traffic including identity and administrative paths; AR-NFR/AR-IDENTITY fix certificate ownership and protocol/cipher acceptance.
NFR2: Performance — provisional targets page ≤2s, search/filter ≤3s, dashboard ≤5s; AR-NFR must version-freeze percentile, workload, environment, and measurement profile before affected baselines.
NFR3: Retroactive recalculation, import, and report jobs MUST expose progress/failure and MUST NOT present stale results as current; AR-NFR fixes freshness thresholds and max job sizes.
NFR4: Concurrent operations MUST produce zero duplicate active Employments, overlapping Primary Assignments, over-consumed/over-reserved headcount, partial transfers, or partial failed imports.
NFR5: AR-NFR MUST set service window, availability target, planned-maintenance treatment, and dependency-degradation behavior.
NFR6: Recoverability — provisional RPO ≤24h / RTO ≤8h; AR-NFR freezes backup frequency/retention/isolation, recovery roles, and restore acceptance; restored state unavailable until post-backup catch-up signed; restored sessions/queued work/emergency grants invalid by default.
NFR7: Session security — idle/absolute timeout, reauthentication for sensitive ops, rate limiting/lockout, concurrent-session controls, revocation bound, emergency-account acceptance per AR-ACCESS/AR-IDENTITY/AR-NFR.
NFR8: At-rest and artifact protection — encryption, inventory, minimal/audited access, retention/expiry/revocation/disposal for DB, backups, import/staging/exports, logs, caches, config; production HR data prohibited in non-production by default.
NFR9: Audit integrity — retention, clock synchronization, integrity verification, review cadence, redaction, access, and failure acceptance per AR-AUDIT/AR-NFR.
NFR10: Observability/support — owners, severity model, support window, incident routing, alert thresholds, log retention/redaction, and runbooks per AR-NFR.
NFR11: Compatibility — essential tasks pass at 1280×720, 1920×1080, and 2K on AR-NFR-approved Chromium-family + Firefox ESR matrix.
NFR12: Accessibility — WCAG 2.2 AA light+dark (provisional); AR-NFR sets launch accessibility target and test method for keyboard, focus, contrast, assistive needs.
NFR13: Scale envelope — initial nominal ~500 people; AR-NFR sets max people, events, org units, history years, concurrent users, import/export rows, report ranges.
NFR14: Security assurance — threat model, vulnerability/patch SLA, secret/key lifecycle, hardening, security test coverage, pen-test expectations, incident response; zero unresolved critical/high findings before production.

### Additional Requirements

- **Starter / greenfield stack (Epic 1 Story 1 impact):** Adopt T3 monorepo — Next.js 16.2.x (App Router) + tRPC 11.x + Prisma 7.8.x + pg-boss 12.26.x; Node.js 22.x LTS; TypeScript 5.x; PostgreSQL 17.10+; pnpm workspaces (or equivalent).
- **AD-1 Modular monolith:** Exactly one application process and one PostgreSQL database in MVP; domain boundaries via package/module rules, not separate services.
- **AD-2 Event-sourcing-lite:** Authoritative mutations as typed append-only business events; current/historical state are derived projections rebuilt by temporal-engine; corrections via Cancel/Reverse/Correction only.
- **AD-3 Shared kernel + module boundaries:** `packages/kernel` owns event-store, temporal-engine, audit-envelope; modules communicate via published APIs only; compensation-facts in separate DB schema with dedicated repository (no casual ORM access).
- **AD-4 Migration staging:** Migration writes to separate staging schema; production event-store receives Baseline only via atomic cutover after independent approval; pre-cutover rollback = drop staging with zero production trace.
- **AD-5 Hybrid authorization + unified audit:** identity-access owns coarse authz (role/scope/delegation); audit-envelope owns fine-grained category checks and writes access events atomically with sensitive decisions; single append-only store with `event_class ∈ {business, access}`.
- **AD-6 Projection refresh + T3 guardrails:** Critical mutations (finalize affecting headcount/reservations/atomic transfers) refresh projections synchronously in same DB transaction as event append; heavy historical recalc may run async via pg-boss with visible `recalculation_pending`; Prisma for projections only; raw SQL/`$transaction` for kernel event-store; ESLint `no-restricted-imports` blocks `@prisma/client` in `apps/web`.
- **Structural seed:** `apps/web`, `packages/kernel/{event-store,temporal-engine,audit-envelope}`, `packages/modules/{identity-access,person-employment,headcount,compensation-facts,reporting,migration}`, `packages/db/{prisma,sql}`, `workers/` for pg-boss.
- **Consistency conventions:** PascalCase past-tense event types; kebab-case modules; server-generated UUIDs; Effective Date vs registration/finalization timestamps; Persian-user-facing domain errors at API boundary; pg-boss queue names domain-prefixed and idempotent.
- **Deployment topology (infra brief):** Single-server on-prem MVP; web + pg-boss co-located; customer reverse proxy terminates TLS; LDAPS to org directory; NTP time sync; health endpoint redacted (no HR content); outbound LDAP + NTP only (no SaaS unless AR-NFR approved).
- **Ops runbook hooks:** LDAP down → auth fails closed; DB down → health red; stuck recalc → pg-boss retry + UI pending; pre-cutover migration failure → drop staging; restore → replay events and rebuild projections.
- **Launch Artifact gates:** Stories that depend on pending AR-* matrices/oracles must not invent local assumptions; missing upstream artifacts block affected feature baselines per PRD §7.2. **Exception (Epic-1):** seeded auth + five coarse roles per SPEC `identity-access-epic1-freeze.md`; LDAP Story 1.8 remains infra-gated.
- **Deferred / non-goals for epics:** Workstation/floor-map, multi-tenant, promotion workflow engine, employee self-service, bilingual/mobile UI, general document management, saved personal report filters, alternate .NET/Java stack.

### UX Design Requirements

UX-DR1: Implement design tokens from DESIGN.md (ux-divan-2026-07-19) — brand color pairs (primary, accent, chrome, muted-brand, sidebar-active) for light and dark; typography scale (heading, heading-sm, body, body-medium, caption, tabular) using Yekan Bakh Fa-En from `imports/fonts/yekan-bakh/` (no FaNum variants); spacing (chrome-height 56px, sidebar-width 240px, sidebar-width-collapsed 64px, section-tabs-height 44px, compact/comfortable row heights, form-section-gap, governed-table filter-row); rounded.sm/md/lg.
UX-DR2: Implement brand-layer button contract — one gold `button-primary` (accent) CTA per surface region with theme-aware dark pairs meeting ≥4.5:1 contrast at 14px; blue `button-secondary` for draft/secondary actions; never place `#FDB913` fill on dark content canvas.
UX-DR3: Build `app-shell` — fixed navy chrome header + collapsible RTL sidebar (chrome stays navy in both themes); logo right / user menu left; role-filtered nav (hide unauthorized items, never show disabled); skip link «پرش به محتوا»; banner stack slot below header; sidebar default expanded with footer collapse toggle persisted per account; collapsed = icons + tooltip/`aria-label`; content width reclaims sidebar-width − sidebar-width-collapsed.
UX-DR4: Implement light/dark theme toggle in avatar menu with per-account persistence; in-place token swap without navigation or unsaved-form guards; preserve focus; visible focus ring on chrome (2px offset). Theme swap and sidebar collapse are exempt from leave-guards.
UX-DR5: Implement banner stack — non-dismissible blocking `stale-banner` (`role="alert"`, `aria-live="assertive"`) above dismissible-on-expiry `break-glass-banner`; stale takes visual and interaction precedence; disable gold CTAs on affected finalize/export/report when stale/recalc pending. Alias: `stale-recalc-banner` ↔ DESIGN `{stale-banner}`.
UX-DR6: Implement `command-palette` (`Ctrl+K` / `/` when not in text input) with permission-safe personnel search, Latin/Persian digit normalization, uniform timing for out-of-scope vs not-found, `aria-busy`/`aria-live` result counts, Enter opens profile, Esc closes; subject to leave-guard when target leaves a dirty form/preview.
UX-DR7: Implement `governed-data-table` (supersedes prior `personnel-data-table` name) — full-width compact density; per-column filters (enum = multi-select Excel-like; text = typeahead substring); header sort + `aria-sort`; stable-snapshot pagination; any filter/sort change → new snapshot and page = 1; result count via polite live region; sticky RTL identifier + sticky row actions (inline-end); sensitive columns omitted from DOM without permission; horizontal scroll in table container (not page); keyboard row focus; filtered export when permitted; empty → «پاک کردن فیلترها» resets to section defaults; **not AG Grid in MVP**.
UX-DR8: Implement `person-profile-section` cards — identity, current Employment, Assignments, approved sensitive categories, prior Employments; fields outside permission excluded from DOM (not visually hidden); sensitivity icon on governed categories.
UX-DR9: Implement `personnel-event-timeline` / `event-timeline-row` — Effective Date desc sort with registration-time secondary hint; decorative status dot `aria-hidden`; text `status-badge` sole status source; correction/neutralization chain links.
UX-DR10: Implement `status-badge-*` for Scheduled / Effective / Cancelled / Reversed / Draft / Override with light and dark token pairs and Persian labels.
UX-DR11: Implement sectioned `personnel-event-form` (max-w-4xl) on رویدادهای پرسنلی / ثبت رویداد with required markers, inline validation, unsaved-change warning, footer Cancel · Save draft (secondary) · Finalize (primary); draft ≠ finalize; person pre-fill from list row action; inbound prefill while dirty runs leave-guard first (never silent person swap).
UX-DR12: Implement `jalali-date-picker` — Popover calendar + typed entry; keyboard day-grid navigation; `aria-label`/`aria-describedby` for purpose and errors; Persian-digit Jalali display; registration timestamps as separate date+time control.
UX-DR13: Implement `headcount-capacity-panel` showing used / reserved / free / exempt / overridden with tabular numerals; free > 0 uses primary color; blocking conflicts in Persian before finalize.
UX-DR14: Implement `sensitive-confirmation-dialog` (max-w-2xl) with consequence summary, reason when required, primary confirm vs ghost cancel; blocked when validation fails or stale/recalc gates active.
UX-DR15: Implement `dashboard-metric-card` grid (2–4 cols ≥1280; 2-col at 1280×720) with shared org/time filters, last calculation time, reconciliation links; suppressed cohort shows «داده قابل نمایش نیست» never 0.
UX-DR16: Implement `import-preview-table` with destructive/amber error/warning row tints, Persian row/column cites, cancel-before-execute, approver/executor segregation UI, concurrent-batch block message with owner + correlation id, unsaved preview warning citing batch id. Day-to-day bulk uses per-section ورود گروهی; advanced/migration remains sidebar ورود داده.
UX-DR17: Implement `export-artifact-panel` with classification, expiry, field scope, reauth at generation and retrieval, custody acknowledgement checkbox for sensitive/bulk before download, download notice per FR-52.
UX-DR18: Role landing routes after login — Operator→اطلاعات پرسنلی (فهرست پرسنل); Admin/Manager→داشبورد; Audit→ممیزی; System Admin→عملیات; deep-link denial shows «دسترسی ندارید.» + link to role landing and is audited.
UX-DR19: Deliver IA surfaces in app shell (ux-divan-2026-07-19 order) — داشبورد, اطلاعات پرسنلی, رویدادهای پرسنلی, ساختار سازمان, ظرفیت و جذب, گزارش‌ها, ورود داده, دسترسی‌ها, ممیزی, عملیات, پرونده‌های اصلاح; contextual پروفایل فرد and خروجی/بازیابی; major surfaces host horizontal section tabs; one dialog stack level max; import preview uses full-width Sheet.
UX-DR20: Persian number formatting layer — all user-facing numbers as Persian digits (۰–۹); financial amounts with thousand separator (٬); search accepts Latin or Persian digits; display always Persian.
UX-DR21: Accessibility floor — WCAG 2.2 AA light+dark; keyboard for dialogs/palette/nav/tables/forms/date picker/trees/section tabs; landmarks and route announcements (surface + tab); collapsed sidebar icons expose accessible names; 200% zoom keeps primary actions reachable without page-level horizontal scroll; respect `prefers-reduced-motion`.
UX-DR22: Empty/error/state copy patterns in operational Persian — empty search, empty timeline, empty dashboard scope, suppressed metric, LDAP unavailable, scope revoked mid-session (save draft or discard; block finalize), recalc-in-progress skeleton + disabled CTAs, breached correction deadline distinct state.
UX-DR23: Viewport policy — full experience at ≥1280×720; reference 1920×1080; collapse encouraged at 1280×720 for wide tables; section tabs may scroll horizontally; <1280 shows minimum-viewport message and does not render broken layout; desktop web only (no mobile-primary layout, infinite scroll on personnel lists, bilingual toggle, or employee self-service).
UX-DR24: Direct-operational Persian voice — fact + date + next step; no ceremonial success copy, emoji, or marketing enthusiasm; consequence text required on sensitive confirms.
UX-DR25: Implement `section-tabs` on each major nav surface — horizontal tabs; URL reflects tab; `tablist`/`tab`/`tabpanel` semantics; leave-guard when leaving dirty form/preview tabs (sidebar, section tabs, command palette, history); theme toggle and sidebar collapse exempt.
UX-DR26: Implement `tree-navigator` for سلسله‌مراتب and لدر و گرید — expand/collapse per node; keyboard arrows + Enter opens edit modal; `aria-expanded`; toolbar add at allowed level / under selected parent; «افزودن گرید» disabled until ladder selected (or modal requires parent); deactivate-with-active-children / impossible reparent fail-closed in Persian.
UX-DR27: Access administration person-first IA — tabs افراد و دسترسی · نقش‌ها · محدوده‌ها · دسترسی اضطراری; OrganizationalScope ≠ org units; toxic/self-approval blocked with Persian reason + audit; break-glass tab uses warning posture.
UX-DR28: Implement `personnel-quick-edit-modal` from فهرست پرسنل — non-event fields only; Save; link «باز کردن پروفایل کامل»; dirty Stay · Discard · Save; block profile link, ثبت رویداد, Esc/overlay dismiss, and nav until resolved.

**UX-DR29…UX-DR40 are governed by `ux-divan-2026-07-31` (DESIGN.md + EXPERIENCE.md) and apply to Epic 8 onward.**

UX-DR29: Implement the `entity-picker` primitive — async, permission-safe, code-first; displays «کد — نام» plus a disambiguating second line; accepts Latin or Persian digits; combobox semantics (`role="combobox"`, `aria-expanded`, `aria-activedescendant`) with full keyboard operation; scoped defaults; empty and out-of-scope states indistinguishable in wording and timing. Variants: person, org unit/team, organizational role, job title, ladder→grade (cascading), seniority, headcount approval, account; dependent-record variants (employment, primary assignment) list the chosen person's permission-safe records with dates, never free text. Selected values render as an `entity-token` with a clear control.
UX-DR30: Implement the action-affordance system — a documented mapping from action semantics to control appearance (primary CTA, secondary, tertiary/row action, destructive, disabled-with-reason). Row actions are icon-only buttons with a visible boundary at rest, mandatory `aria-label`, tooltip on hover and keyboard focus, a fixed per-action icon mapping, consistent size/padding, and identical placement across surfaces; overflow beyond two row actions uses a labelled menu. `ghost` is retired for row and toolbar actions. No control may be clickable and inert; row click opens the record while row actions never navigate as a side effect.
UX-DR31: Implement table readability — content-driven column widths with per-column max width, truncation with an accessible full value, and wrapping for designated long-text columns; no fixed `min-width` that forces horizontal scroll; user-controlled column visibility with persistence; sticky identifier and actions columns keep an inset separator when scrolled; density toggle (compact default 32px / comfortable 48px).
UX-DR32: Implement self-explaining state — every banner, empty state, and blocking message states fact + cause + scope + next step, with an optional «توضیح بیشتر» disclosure. The recalculation banner names what is stale, which actions are blocked, and what the user should do; it never presents an internal timestamp as a deadline. Each surface carries a one-line purpose statement and definition entries for domain terms.
UX-DR33: Implement گزارش‌ها IA — section tabs grouping the launch catalogue by subject (نیروی انسانی · سازمان · رویدادها · ظرفیت و جذب · ورود داده), with a report workspace of catalogue rail + parameters + result table + run metadata (as-of, last calculation, row count) + export; report selection is reflected in the URL.
UX-DR34: Implement ظرفیت و جذب IA — tabs هدکانت · ایجاد · ورود گروهی; «هدکانت» is a governed table with toolbar create; «ایجاد» hosts the approval creation form; exemptions, overrides, and historical reconstruction move into a record-scoped `record-drawer` (480px, inline-end) opened from the approval row instead of stacking panels on one page.
UX-DR35: Implement the shared bulk-entry pattern — per-section «ورود گروهی» uses one inline five-step flow (قالب → آپلود → پیش‌نمایش و خطاها → تأیید → نتیجه) over the FR37 engine, reusing `import-preview-table`, scoped to that domain and the caller's permissions, with errors cited by row number, column name, and business code; distinct from the sidebar migration wizard with a stated difference in copy.
UX-DR36: Implement تنظیمات IA — admin-only surface with section tabs by domain (عمومی و نمایش · داده و نگه‌داشت · ورود و خروجی · ظرفیت و جذب · دسترسی و نشست · ممیزی و یکپارچگی · زیرساخت); tabs are role-split so `hr_admin` sees business domains and `system_admin` sees technical domains, each seeing only its own; each parameter row shows Persian label, description, unit, current value, default, source, allowed range, editability, and last change actor/time; edit uses inline validation, a reason field where required, «بازگشت به پیش‌فرض», and confirmation with a stated blast radius for high-impact parameters; read-only parameters state why and where they actually change.
UX-DR37: Implement wayfinding and terminology — navigation labels state user outcomes; «پرونده‌های اصلاح» becomes «اصلاح اطلاعات» with a purpose line and contextual entry from a person's profile/timeline; other governance-only surfaces get the same treatment; a glossary/help disclosure defines internal terms encountered in the UI.
UX-DR38: Implement the visual hierarchy and layout system — one `page-header` pattern (breadcrumb, surface title, result count, purpose line, then section tabs, with the primary action in the toolbar row); the DESIGN spacing rhythm and layout grid on every surface; a hairline-based panel/section system with rules for when a surface uses a panel versus a full-bleed table; content max-widths per surface type; one form-layout pattern (label column, field grouping, required marking, help text, inline error, sticky footer action order) used by every form; a single icon set with size/stroke/pairing rules; semantic use of the DESIGN typography roles with no ad-hoc sizes or weights.
UX-DR39: Implement feedback, loading, and motion — content-shaped skeletons for initial loads; in-place pending states for filters, saves, and finalize actions; one result-feedback pattern with fixed precedence (inline at the form or row for direct results, toast for background work, banner for system-wide state) and one channel per event; destructive/sensitive confirmation posture unchanged; transitions 150–250ms and purposeful, fully disabled under `prefers-reduced-motion` including skeleton pulse.
UX-DR40: Implement theme parity and data-visualization quality — every surface, state, badge, chart, and banner specified and verified in light and dark at the NFR12 contrast floor; the fixed chart palette with categorical, sequential, and status roles (`chart.categorical` / `chart.categorical-dark` / `chart.sequential`), where gold is never a data color, status colors encode status only, and the green and orange bands stay excluded from data color; chart typography, axis/label, legend, tooltip, tabular numeral, empty, suppressed-cohort, and stale-data treatments defined once and reused by dashboard and reports.

### FR Coverage Map

FR1: Epic 1 — LDAP/AD authentication (Story 1.8, infra-gated); seeded auth bootstrap in Story 1.4
FR2: Epic 2 — Backend-enforced least privilege (default-deny)
FR3: Epic 2 — Segregated sensitive categories and export permissions
FR4: Epic 2 — Governed access administration (roles, scopes, links); Epic 4b — person-first Access UI retrofit (presentation only)
FR5: Epic 3 — Stable Person identity and Personnel Code
FR6: Epic 3 — Employment lifecycle (non-overlapping; one active)
FR7: Epic 3 — Data-Dictionary-governed profile fields
FR8: Epic 3 — Compensation and contractual facts (no payroll calc)
FR9: Epic 3 — Governed organization hierarchy; Epic 4b — section tabs + tree-navigator UI retrofit (presentation only)
FR10: Epic 3 — Independent job concepts (Role, Title, Ladder, Grade, Seniority); Epic 4b — لدر و گرید tree + flat ref tabs UI retrofit (presentation only)
FR11: Epic 3 — Primary Assignment integrity
FR12: Epic 3 — Secondary Assignment fidelity (AR-SECONDARY inventory)
FR13: Epic 3 — Management relationships from Assignment/org facts
FR14: Epic 4 — Common attributable Personnel Event record
FR15: Epic 4 — Draft and finalization lifecycle
FR16: Epic 4 — Authoritative vs effective (Scheduled) state
FR17: Epic 4 — Cancel, Reverse, and Correction chains
FR18: Epic 4 — Deterministic ordering and recalculation
FR19: Epic 4 — Conflict handling (blocking vs warning)
FR20: Epic 4 — Start and return events
FR21: Epic 4 — Termination events
FR22: Epic 4 — Team transfer (atomic source/destination)
FR23: Epic 4 — Job and level change events
FR24: Epic 4 — Contract and compensation change events
FR25: Epic 4 — Current person state projection
FR26: Epic 4 — Historical person reconstruction (as-of)
FR27: Epic 4 — Historical organization and headcount reconstruction
FR28: Epic 4 — Headcount Approval lifecycle
FR29: Epic 4 — Universal Primary Assignment headcount coverage
FR30: Epic 4 — Deterministic future capacity reservation
FR31: Epic 4 — Atomic headcount consumption and release
FR32: Epic 4 — Headcount Override with audit visibility
FR33: Epic 5 — Permission-safe search and lists; Epic 8 — in-form permission-safe, enumeration-safe selectors
FR34: Epic 5 — Personnel profile and event timeline
FR35: Epic 5 — Core launch dashboard
FR36: Epic 5 — Operational and historical launch reports; Epic 9 — subject-tabbed report workspace
FR37: Epic 6 — Controlled CSV/XLSX import wizard; Epic 9 — sample templates and per-section bulk entry
FR38: Epic 6 — Atomic and traceable Import Batch
FR39: Epic 6 — Baseline and migration provenance
FR40: Epic 6 — Migration reconciliation and cutover gate
FR41: Epic 6 — Governed export
FR42: Epic 7 — Business and security audit evidence
FR43: Epic 1 — Persian RTL desktop experience (initial shell); Epic 4b — shell/IA alignment to ux-divan-2026-07-19; Epic 8 — interaction consistency baseline
FR44: Epic 1 — Jalali date experience
FR45: Epic 7 — Operational health without HR content exposure
FR46: Epic 2 — Entitlement lifecycle and privileged/break-glass access
FR47: Epic 2 — Temporal and cross-boundary authorization
FR48: Epic 2 — Inference-resistant and bulk retrieval controls
FR49: Epic 1 — Identity and account lifecycle (seeded bootstrap Story 1.4; LDAP link Story 1.8)
FR50: Epic 7 — Data retention, disposal, and legal hold
FR51: Epic 7 — Audit trust boundary and fail-safe evidence
FR52: Epic 6 — Secure import/export artifact lifecycle
FR53: Epic 7 — External data-subject correction cases; Epic 9 — «اصلاح اطلاعات» discoverability and contextual entry
FR54: Epic 7 — Published decision-report reproducibility
FR55: Epic 7 — Policy and Launch Artifact change control
FR56: Epic 7 — Authoritative reference and snapshot integrity
FR57: Epic 8 — Business-identifier-first pickers and resolvers
FR58: Epic 8 — Consistent interaction system, affordance, and table readability
FR59: Epic 9 — Complete, self-explaining operational surfaces and bulk entry
FR60: Epic 10 — Governed application configuration administration

## Epic List

### Epic 1: Secure Access & Persian Desktop Shell
Users authenticate (seeded accounts for early development; LDAP after Infrastructure approval), land on a role-appropriate Persian RTL desktop shell with brand tokens, light/dark theme, and keyboard command palette — establishing the modular-monolith substrate for all later work.
**FRs covered:** FR1, FR43, FR44, FR49

### Epic 2: Entitlements & Access Governance
Administrators manage roles, permissions, scopes, and account links; every read/mutation is default-deny by permission × category × action × Organizational Scope; sensitive categories and export are separately governed; entitlement lifecycle, temporal/cross-boundary authz, and inference/bulk controls apply.
**FRs covered:** FR2, FR3, FR4, FR46, FR47, FR48

### Epic 3: Workforce Master Data & Organization
HR maintains stable Persons and Employments, Data-Dictionary profile and compensation facts, the Legal Entity→Team hierarchy, independent job reference concepts, Primary/Secondary Assignments, and derived management relationships.
**FRs covered:** FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13

### Epic 4: Personnel Events, Temporal State & Headcount
Operators and admins record attributable effective-dated Personnel Events (start, terminate, return, transfer, job/level, contract/compensation) through Draft→Finalize with Cancel/Reverse/Correction; deterministic current and as-of state; Headcount Approvals, reservations, atomic consumption, exemptions, and Overrides.
**FRs covered:** FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32

### Epic 4b: Shell & IA Alignment (UX 2026-07-19)
Operators and admins use the redesigned Persian RTL shell — collapsible sidebar, section tabs, governed tables/trees — with Access and Organization admin surfaces retrofit to the new IA, before Search/Profiles/Dashboard work begins.
**FRs covered:** FR43 (presentation/IA); FR4, FR9, FR10 (UI reshape only — domain already delivered in Epics 2–3). **UX contract:** ux-divan-2026-07-19. **Sequencing:** After Epic 4 (done); before Epic 5. Authorized by sprint-change-proposal-2026-07-19.

### Epic 5: Search, Profiles, Dashboard & Reports
Authorized users search and list permission-safe populations, open profiles with timelines, use the launch dashboard, and run the approved launch report catalogue with synchronized filters and current/as-of semantics.
**FRs covered:** FR33, FR34, FR35, FR36
**Depends on:** Epic 4b primitives (`governed-data-table`, section tabs, updated IA).

### Epic 6: Migration, Baseline & Governed Export
Migration actors import approved CSV/XLSX through validated preview and atomic Import Batches, establish Baseline provenance, reconcile to signed controls, and produce governed exports with secure artifact lifecycle.
**FRs covered:** FR37, FR38, FR39, FR40, FR41, FR52

### Epic 7: Audit, Operations & Evidence Controls
Audit reviewers and operators investigate attributable business/access evidence and service health without routine HR content exposure; the system enforces retention/hold, audit trust, correction-case evidence, formal-report reproducibility, Launch Artifact change control, and evaluation-snapshot integrity.
**FRs covered:** FR42, FR45, FR50, FR51, FR53, FR54, FR55, FR56

### Epic 8: Experience Foundation & Identifier Ergonomics
Operators and admins work with people, teams, and job concepts by their real business codes inside one coherent visual and interaction system — a single page-layout, form, table, feedback, and theming language — removing UUID entry, inconsistent controls, unreadable tables, and unexplained system messages from every existing surface.
**FRs covered:** FR57, FR58; FR33, FR43 (extended consequences). **UX contract:** ux-divan-2026-07-31. **Sequencing:** after Epic 7 (done); before Epic 9. Authorized by sprint-change-proposal-2026-07-31.

### Epic 9: Operational Surface Completion & IA Coherence
Every navigable surface does real work: per-section bulk entry with downloadable templates, a coherent capacity-and-hiring structure, a tabbed report workspace, a real personnel-events list, and discoverable governance surfaces — with no placeholder tabs remaining in navigation.
**FRs covered:** FR59; FR33, FR36, FR37, FR53 (surface completion). **UX contract:** ux-divan-2026-07-31. **Sequencing:** after Epic 8.

### Epic 10: Administrative Settings & Governed Parameters
An authorized administrator sees every governed application parameter in one place and changes the explicitly permitted ones with validation, reason, audit evidence, and reset-to-default, while security-critical parameters stay read-only with their change path stated.
**FRs covered:** FR60; FR42, FR45, FR55 (evidence and change control). **UX contract:** ux-divan-2026-07-31. **Sequencing:** after Epic 9.

## Epic 1: Secure Access & Persian Desktop Shell

Users authenticate (seeded accounts for early development; LDAP after Infrastructure approval), land on a role-appropriate Persian RTL desktop shell with brand tokens, light/dark theme, and keyboard command palette — establishing the modular-monolith substrate for all later work.

### Story 1.1: Initialize Modular-Monolith Monorepo

As a developer delivering Divan,
I want a runnable T3 monorepo with the Architecture structural seed,
So that subsequent stories can add auth and UX on a consistent substrate.

**Acceptance Criteria:**

**Given** a greenfield Divan workspace
**When** the monorepo is initialized per Architecture Stack (Next.js App Router, tRPC 11, Prisma 7, TypeScript 5, pnpm workspaces, Node 22)
**Then** `apps/web` starts locally and renders a minimal Persian RTL page
**And** package folders exist for `packages/kernel/{event-store,temporal-engine,audit-envelope}`, `packages/modules/{identity-access,person-employment,headcount,compensation-facts,reporting,migration}`, `packages/db/{prisma,sql}`, and `workers/`
**And** ESLint restricts direct `@prisma/client` imports from `apps/web`
**And** PostgreSQL connectivity is configured for local/dev without inventing production AR-NFR host sizing
**And** no domain business tables beyond the minimum needed to boot the app are created in this story

### Story 1.2: Brand Tokens, Typography & Theme Toggle

As an authorized Divan user,
I want the org brand palette, Yekan Bakh typography, and a light/dark content theme,
So that the product reads as a governed enterprise HRIS in both modes.

**Acceptance Criteria:**

**Given** the runnable `apps/web` shell from Story 1.1
**When** DESIGN.md brand tokens are applied (primary, accent, chrome, muted-brand, sidebar-active; light/dark pairs) with Yekan Bakh Fa-En from `imports/fonts/yekan-bakh/` (no FaNum)
**Then** content canvas follows shadcn light/dark backgrounds while chrome stays navy in both modes
**And** gold `button-primary` uses theme-aware accent pairs meeting ≥4.5:1 contrast at 14px; `#FDB913` is never used as fill on dark content cards
**And** blue `button-secondary` uses primary token pairs
**And** a theme toggle in the user menu swaps tokens in place without navigation or unsaved-form guards and preserves focus
**And** theme preference persists per account when an authenticated session exists (anonymous session may use local fallback until Story 1.4)

### Story 1.3: App Shell — Chrome, Sidebar & Skip Link

As an authorized Divan user,
I want a fixed navy header and RTL sidebar with skip link and banner slot,
So that I can navigate desktop surfaces consistently from 1280×720 upward.

**Acceptance Criteria:**

**Given** brand tokens and theme from Story 1.2
**When** the `app-shell` is rendered
**Then** header height is 56px and RTL sidebar width is 240px with logo on the right and user menu on the left
**And** skip link «پرش به محتوا» is the first focusable element and targets the main landmark
**And** a banner stack slot exists below the header (stale above break-glass when both present in later stories)
**And** viewports ≥1280×720 render the full shell; <1280 shows a minimum-viewport message without a broken layout
**And** sidebar active item uses sidebar-active-background plus accent RTL leading border
**And** placeholder nav items exist for IA surfaces (داشبورد، پرسنل، …) without requiring domain data yet

### Story 1.4: Seeded Accounts & Coarse Role Auth (Dev Bootstrap)

As a developer or tester,
I want pre-seeded internal accounts with the five MVP coarse roles,
So that I can sign in and exercise the shell without live LDAP (FR49 substrate; FR1 deferred to Story 1.8).

**Acceptance Criteria:**

**Given** a non-production environment per `identity-access-epic1-freeze.md`
**When** the identity-access seed runs
**Then** exactly one internal account exists for each MVP coarse role: HR Operator, HR Admin, Manager, Audit reviewer, System Admin
**And** each account maps to exactly one human identity record (no shared accounts)
**When** a user signs in with a valid seeded credential
**Then** a session is established with that account's coarse role context
**When** credentials are unknown, wrong, or the account is inactive
**Then** authentication fails closed with clear Persian copy and no privilege elevation
**And** seeded credentials are documented only for local/dev/CI; seed path is disabled or absent in production builds
**And** successful and failed authentication attempts are attributable for later audit wiring (FR42 substrate: correlation id + actor/time fields ready)
**And** session establishes idle/absolute timeout hooks configurable for AR-NFR/AR-IDENTITY freeze (NFR7)

### Story 1.5: Role Landings & Permission-Filtered Navigation

As an authenticated user in a known launch role,
I want to land on my role's first surface with only permitted nav items visible,
So that I start work in the right place without seeing forbidden areas.

**Acceptance Criteria:**

**Given** an authenticated session with coarse role context from identity-access (seeded or later LDAP-linked)
**When** login completes
**Then** HR Operator lands on پرسنل; HR Admin and Manager on داشبورد; Audit reviewer on ممیزی; System Admin on عملیات (UX-DR18)
**And** nav items outside the caller's permission are omitted from the DOM (not shown disabled)
**When** the user opens a deep link they are not permitted to access
**Then** the UI shows «دسترسی ندارید.» with a link to their role landing and the denial is audited
**And** placeholder destination routes render empty Persian shells without requiring Epic 5 domain features
**Note (forward contract):** Operator landing label and IA order are superseded by Epic 4b Story 4b.3 (اطلاعات پرسنلی); do not implement Epic 5+ against the «پرسنل» label.

### Story 1.6: Command Palette, Jalali Date Picker & Persian Digits

As an HR Operator or Admin,
I want keyboard command palette, Jalali date entry, and Persian digit display,
So that I can find people and enter business dates in the desktop Persian workflow.

**Acceptance Criteria:**

**Given** an authenticated user in the app shell
**When** they press `Ctrl+K`, or `/` while focus is not in a text input
**Then** the command palette opens with permission-safe personnel search hooks (may return empty until Epic 5 data exists) and closes on `Esc`
**And** search input accepts Latin or Persian digits, normalizes for matching, and always displays Persian digits
**And** `aria-busy` while searching and polite `aria-live` announce result counts («۳ نتیجه» / «نتیجه‌ای نیست»)
**When** a form uses `jalali-date-picker`
**Then** users can type or pick a Jalali date via Popover calendar with keyboard day-grid navigation; invalid dates link errors via `aria-describedby`
**And** Effective Date controls are date-only and visibly distinct from registration/finalization date+time controls (FR44)
**And** all user-facing numbers render as Persian digits; financial amounts use thousand separator (٬) when amounts are shown

### Story 1.7: Accessibility Floor, Banner Behavior & Operational Copy

As an authorized desktop user,
I want keyboard-reachable, accessible surfaces with clear operational Persian copy and global stale/break-glass banners,
So that essential tasks remain usable and trustworthy under WCAG 2.2 AA intent.

**Acceptance Criteria:**

**Given** the authenticated app shell
**When** a blocking stale/recalculation condition is signaled by the platform
**Then** `stale-banner` appears with `role="alert"` and `aria-live="assertive"`, is non-dismissible while blocking, and sits above any `break-glass-banner`
**And** gold CTAs on affected finalize/export/report actions are disabled while blocking (hooks ready for Epic 4–6)
**When** break-glass access is active
**Then** `break-glass-banner` shows below stale (if present) and becomes dismissible on expiry without obscuring a blocking stale message
**And** focus rings are visible on chrome (2px offset) and content; dialogs/palette/nav/date picker are keyboard operable
**And** `prefers-reduced-motion` disables toast slide and skeleton shimmer
**And** empty/error copy follows operational Persian patterns (fact + next step; no emoji/ceremonial success); identity and permission messages match EXPERIENCE.md state table
**And** at 200% browser zoom, primary actions remain reachable without page-level horizontal scroll

### Story 1.8: LDAP Authentication & Internal Account Link (Infra-Gated)

As a launch user,
I want to authenticate against organization LDAP/AD linked to one internal account,
So that production identity uses the directory and passwords are never stored in the app (FR1, FR49).

**Gate:** This story is **blocked** until Infrastructure approves LDAP/AD connectivity. Do not invent topology, bind account, or MFA locally.

**Acceptance Criteria:**

**Given** AR-IDENTITY-compatible LDAP/AD connectivity is configured and Infrastructure-approved for the environment
**When** a user signs in with a valid mapped directory identity
**Then** the system creates or links exactly one internal account for that identity (FR1, FR49)
**And** the application never stores the user's LDAP password
**When** the identity is disabled, locked, expired, removed, duplicate, or unmapped
**Then** authentication fails closed per AR-IDENTITY rules without silent bypass
**When** the directory is unavailable
**Then** the login surface shows «اتصال به سامانه هویت برقرار نیست.» and no routine local/seeded access is created in LDAP mode
**And** production builds do not fall back to seeded credentials when LDAP is the active provider
**And** existing MVP coarse roles remain assignable to LDAP-linked accounts without changing Epic-1 landings

## Epic 2: Entitlements & Access Governance

Administrators manage roles, permissions, scopes, and account links; every read/mutation is default-deny by permission × category × action × Organizational Scope; sensitive categories and export are separately governed; entitlement lifecycle, temporal/cross-boundary authz, and inference/bulk controls apply.

### Story 2.1: Audit Envelope & Default-Deny Authorization Substrate

As a security-conscious product owner,
I want every protected read and mutation to enter through a kernel audit-envelope with default-deny,
So that UI visibility never implies data access (FR2, AD-5).

**Acceptance Criteria:**

**Given** the monorepo kernel packages from Epic 1
**When** a tRPC procedure performs a protected read or mutation
**Then** authorization evaluates permission × data category × action × Organizational Scope via audit-envelope independently of UI
**And** denied reads/mutations fail closed with Persian user-facing errors and no out-of-scope payload leakage
**And** each sensitive decision writes an append-only `event_class=access` record atomically with the allow/deny outcome (correlation id, actor, time, operation, scope, result)
**And** identity-access supplies coarse role/scope context; envelope enforces fine-grained category checks
**And** no generic Viewer/manager/HR/System Admin label grants sensitive data by default

### Story 2.2: Sensitive Categories & Separate Export Permission

As an HR Data Owner / Security approver,
I want sensitive categories and sensitive export governed separately from ordinary view,
So that compensation and other sensitive fields cannot leak through view-only or System Admin paths (FR3).

**Acceptance Criteria:**

**Given** AR-DATA category registry hooks exist (exact matrix may remain pending; categories are configurable)
**When** a caller holds view permission without category-specific or export permission
**Then** sensitive category values are omitted from responses (not masked as fake zeros) and export actions for those fields are unavailable
**And** System Admin has no routine HR-content repository access; any elevation path is time-bound, reasoned, and envelope-audited (break-glass details in Story 2.5)
**And** religion/health/family/bank/insurance/national ID/compensation-like categories remain disabled until an AR-DATA disposition enables them
**And** compensation-facts module boundary is respected (separate schema/repo; no casual Prisma import from other modules)

### Story 2.3: Access Administration UI & APIs

As an HR Admin,
I want to manage roles, permissions, Organizational Scopes, account links, and active status,
So that entitlements stay explicit, attributable, and reviewable (FR4).

**Acceptance Criteria:**

**Given** an Admin with access-administration permission on سطح دسترسی‌ها
**When** they create or change a role, permission set, scope, or account link
**Then** the change is attributable (actor, time, before/after) and reviewable in access evidence
**And** no role grants capabilities beyond its explicit permission set
**When** toxic self-approval or admin+approve-same-grant combinations are attempted
**Then** the operation is blocked pending AR-ACCESS toxic-combination rules (fail closed if matrix missing for that path)
**And** empty entitlements state shows «تخصیص دسترسی‌ای ثبت نشده.»

### Story 2.4: Entitlement Lifecycle — Grant, Expiry, Revocation & Recertification

As a Security / HR Data Owner,
I want entitlements to follow request → approval → activation → expiry → revocation → recertification,
So that sensitive/global/bulk grants cannot linger without governance (FR46).

**Acceptance Criteria:**

**Given** AR-ACCESS lifecycle hooks
**When** a sensitive, global, bulk, or mass-assignment grant is requested
**Then** attributable independent approval is required; requester cannot approve or waive their own grant
**When** revocation or directory-driven disablement occurs
**Then** enforcement applies before the next protected action within the finite AR-ACCESS/AR-IDENTITY objective; queued work and artifact retrieval reauthorize
**When** recertification is overdue
**Then** the entitlement is suspended or revoked under a mandatory fail-safe rule (cannot remain active indefinitely)
**And** all lifecycle transitions emit access events

### Story 2.5: Break-Glass Privileged Access

As an incident responder with approved break-glass authority,
I want time-bound minimal privileged access with mandatory review,
So that emergencies are possible without routine privilege creep (FR46).

**Acceptance Criteria:**

**Given** an independently approved break-glass grant
**When** the grant activates
**Then** action/scope/time are minimal and incident-bound; the grant auto-expires; `break-glass-banner` appears on affected HR routes
**And** export and permission administration remain denied by default unless separately exceptionally approved
**And** every privileged read/write is envelope-audited; post-use independent review is required and attributable
**When** the grant expires or is revoked
**Then** the banner dismisses and subsequent protected actions fail closed without the grant

### Story 2.6: Temporal & Cross-Boundary Authorization

As a manager or scoped HR user,
I want every retrieval to honor Organizational Scope and current/as-of time semantics,
So that cross-boundary aggregates never leak out-of-scope people or history (FR47).

**Acceptance Criteria:**

**Given** a caller with Organizational Scope S and permitted categories
**When** they run profile, timeline, search, count, dashboard, report, export, or audit retrieval
**Then** results contain only the permitted intersection of underlying populations; drill-down preserves the same authorized population
**And** management-derived scope defaults to facts/intervals covered by the authorized relationship; pre-scope history for current managers and post-scope history for former managers require separate bounded grants
**When** authorization inputs are stale, failed, ambiguous, or unreconciled
**Then** the operation fails closed
**When** role/scope/account/org-membership changes mid-session
**Then** enforcement applies before the next protected action; UI offers «دسترسی شما تغییر کرد.» with save-draft or discard when a Draft is permitted, blocks finalize, and redirects to safe landing after acknowledgement

### Story 2.7: Inference-Resistant & Bulk Retrieval Controls

As a Privacy / Security owner,
I want small-cohort, differencing, and bulk retrieval controls across UI and export,
So that screens and files cannot be used as independent exfiltration paths (FR48).

**Acceptance Criteria:**

**Given** AR-REPORTING/AR-ACCESS threshold hooks (exact numbers may be pending; enforcement points must exist)
**When** a query or export would expose a suppressed small cohort or violate volume/window/field cumulative controls
**Then** the channel returns the same safe treatment («داده قابل نمایش نیست» or equivalent deny) without revealing the suppressed count as 0
**And** sensitive/bulk access can require additional approval and always emits attributable access events with volume and outcome
**And** UI, API, search, list, count, dashboard, report, and export share the same control plane (no bypass channel)

## Epic 3: Workforce Master Data & Organization

HR maintains stable Persons and Employments, Data-Dictionary profile and compensation facts, the Legal Entity→Team hierarchy, independent job reference concepts, Primary/Secondary Assignments, and derived management relationships.

**Sequencing rule (Epic 3 ↔ Epic 4):** Epic 3 delivers **master-data entities, integrity constraints, reference schemas, and read/display fidelity** only. Authoritative mutations that create or change Employment, Primary Assignment, Secondary Assignment, or compensation/contractual *state through Personnel Events* (Start, Return, Termination, Transfer, job/level/contract/compensation changes) are implemented exclusively in **Epic 4** after the append-only event store (Story 4.1). Epic 3 MUST NOT introduce a temporary CRUD write path that later must be thrown away.

### Story 3.1: Stable Person Identity

As an HR Admin or Operator,
I want to create and maintain a Person with a unique Personnel Code,
So that human identity survives Employment end and return (FR5).

**Acceptance Criteria:**

**Given** an authorized HR user on سطح پرسنل / create Person
**When** they create a Person with an approved unique Personnel Code and identity keys
**Then** the Person is stored with server-generated UUID PK; Personnel Code is the domain identifier
**And** duplicate Personnel Codes are rejected; duplicate national IDs are rejected when that field is approved and present
**And** empty optional values are not stored as zero, verified absence, or N/A
**And** Personnel Code correction, merge, split, and return matching remain blocked until AR-DATA/AR-MIGRATION policy exists (operations fail closed with Persian explanation)
**When** Employment ends
**Then** the Person and permitted history remain

### Story 3.2: Employment Lifecycle Invariants

As an HR user,
I want Employment periods modeled with non-overlap and at most one active Employment per Person,
So that workforce periods stay temporally coherent once events create them (FR6).

**Acceptance Criteria:**

**Given** the person-employment module schema and invariants
**When** Employment records exist (seeded for tests, projected after Epic 4 events, or migrated later)
**Then** overlapping active Employments for the same Person are rejected by domain constraints
**And** MVP enforces at most one active Employment per Person at any evaluated instant
**And** ending an Employment (when performed via Epic 4 Termination) preserves the Person and permitted history (FR5 continuity)
**And** this story does **not** implement Start/Return/Termination user flows or append authoritative Employment-creating events — those are Stories 4.5–4.6
**And** approved minimum facts required for a valid Employment+Primary Assignment pair are documented as invariants for Epic 4 finalization checks

### Story 3.3: Data-Dictionary-Governed Profile Fields

As an HR Data Owner,
I want only approved Data Dictionary fields enabled on profiles,
So that spreadsheet presence alone never activates a field (FR7).

**Acceptance Criteria:**

**Given** AR-DATA Data Element dispositions (configurable registry)
**When** a profile is rendered or edited
**Then** only enabled approved fields appear; out-of-permission fields are omitted from the DOM
**And** every enabled element carries purpose, owner/source, format, sensitivity, access, retention, export, and audit classification before enablement
**And** free text is purpose-limited and access-controlled; derived elements retain lineage and cannot be classified below their most sensitive input without assessment
**And** historical workforce-affecting field changes must go through authoritative temporal events (no silent overwrite)

### Story 3.4: Compensation & Contractual Facts Module

As an authorized HR user with compensation permission,
I want effective-dated compensation and contractual facts without payroll calculation,
So that current and historical values remain attributable (FR8).

**Acceptance Criteria:**

**Given** the compensation-facts module with separate DB schema and repository
**When** approved compensation/contractual facts are stored or projected
**Then** authorized users can distinguish current vs historical values and provenance
**And** the system performs no payroll, tax, insurance, payslip, or payment calculation
**And** modules outside compensation-facts cannot import its repository/schema
**And** reads/writes pass audit-envelope category checks
**And** user-facing *changes* to compensation/contractual state are authored only via Epic 4 Personnel Events (Story 4.8); this story delivers the isolated store, read APIs, and invariants

### Story 3.5: Organization Hierarchy Management

As an HR Admin,
I want effective-dated Legal Entity → Business Unit → Department → Team hierarchy,
So that organization structure is governed without erasing history (FR9).

**Acceptance Criteria:**

**Given** Admin access to ساختار سازمان
**When** units are created, activated, or deactivated
**Then** history is retained; deactivation with active members or future Assignment/event/Reservation/reporting dependencies is blocked until AR-TEMPORAL/AR-HEADCOUNT disposition exists
**And** at every evaluated date a child's validity interval falls within its parent's; impossible retroactive re-parenting is blocked or corrected via authoritative temporal process
**And** surface uses Persian RTL forms consistent with app shell

### Story 3.6: Independent Job Reference Concepts

As an HR Admin,
I want Organizational Role, Job Title, Ladder, Grade, and Seniority as distinct references,
So that job concepts stay independent and Ladder–Grade compatible (FR10).

**Acceptance Criteria:**

**Given** Admin reference-data management
**When** Grades are selected for an Assignment or event
**Then** Grade options are limited to the chosen Ladder, including configured half-grades
**And** the product imposes no universal Grade-to-Seniority mapping
**When** deactivating or changing a reference used by an active or Scheduled Assignment/event
**Then** the change is blocked until AR-TEMPORAL-approved disposition of dependencies

### Story 3.7: Primary Assignment Integrity

As an HR Admin,
I want every active Employment to have exactly one active Primary Assignment,
So that Team membership and headcount anchoring stay unambiguous (FR11).

**Acceptance Criteria:**

**Given** Primary Assignment schema and integrity rules in person-employment
**When** Primary Assignment state is evaluated at an instant for an active Employment
**Then** domain constraints require exactly one active Primary Assignment; overlapping Primaries are blocked
**And** Primary Assignment determines Team membership and carries approved organization/job facts
**And** create/change/end of Primary Assignment occurs only through authoritative Personnel Events in Epic 4 — direct mutable overwrite APIs are rejected in this epic
**And** this story ships constraint enforcement and read models; it does not ship Start/Transfer/job-change UI flows

### Story 3.8: Secondary Assignment Fidelity

As an HR Admin,
I want the finite AR-SECONDARY Secondary Assignment scenarios representable and maintainable,
So that current organizational dual roles remain faithful without consuming headcount (FR12).

**Acceptance Criteria:**

**Given** AR-SECONDARY launch inventory configuration
**When** Secondary Assignment records are validated, viewed, or prepared for migration
**Then** required fields, reason/type, and active Employment coverage for the full effective interval are enforceable as domain rules
**And** equivalent Secondary for same Person, organizational target, reason/type, and overlapping interval is rejected
**And** Secondary Assignments do not consume headcount by default
**And** scenarios outside the approved inventory are out of scope and blocked
**And** authoritative create/change/end of Secondary Assignments is delivered via Epic 4 Personnel Event flows (and migration in Epic 6); Epic 3 does not add a bypass CRUD write API

### Story 3.9: Derived Management Relationships

As a Manager or reporting consumer,
I want management relationships derived from governed Assignment and organization facts,
So that Team/senior manager inference is consistent and access ambiguity fails closed (FR13).

**Acceptance Criteria:**

**Given** configured middle-manager Primary Assignments and approved senior-manager targets
**When** management relationships are derived for reporting or scope
**Then** Team manager can be identified from middle-manager Primary Assignment where configured
**And** duplicate/acting/interim/co-manager/reorganization behavior follows AR-ACCESS/AR-TEMPORAL; if undefined, access fails closed
**And** derived relationships are not independently editable as shadow truth

## Epic 4: Personnel Events, Temporal State & Headcount

Operators and admins record attributable effective-dated Personnel Events through Draft→Finalize with Cancel/Reverse/Correction; deterministic current and as-of state; Headcount Approvals, reservations, atomic consumption, exemptions, and Overrides.

### Story 4.1: Append-Only Event Store & Attributable Event Record

As an HR Operator,
I want every Personnel Event to carry a complete attributable record in an append-only store,
So that history cannot be silently rewritten (FR14, AD-2).

**Acceptance Criteria:**

**Given** kernel event-store (raw SQL / `$transaction`)
**When** a Personnel Event is persisted
**Then** it has unique id, type, Person, Employment, Effective Date, registration actor/time, status, reason/reference, provenance, and authorized before/after evidence fields
**And** Effective Date is visibly distinct from registration/finalization timestamps
**And** events are append-only `event_class=business`; projections are never the source of truth
**And** sensitive values are not unnecessarily duplicated into evidence
**And** PascalCase past-tense type names are used per Architecture conventions

### Story 4.2: Draft, Finalization & Conflict Classification

As an HR Operator or Admin,
I want to create, edit, and delete Drafts and finalize routine valid Drafts,
So that day-to-day changes become authoritative without a universal second approval (FR15, FR19).

**Acceptance Criteria:**

**Given** a permitted user on فرم رویداد
**When** they save a Draft
**Then** the Draft is editable/deletable and non-authoritative
**When** they finalize a routine valid Draft
**Then** permission, required data, temporal/domain conflicts, and headcount checks run against one authoritative evaluation snapshot (FR56)
**And** known conflicts are classified blocking or warning with Persian consequence text; warnings require acknowledgement/Override where allowed
**And** repeating the same finalize request yields at most one authoritative event; concurrent edit/delete/finalize resolve atomically
**And** Finalized events cannot be directly edited or hard-deleted
**And** termination, compensation change, retroactive beyond window, high-impact Override, and production bulk import require independent pre-authorization tiers when configured (otherwise remain non-authoritative pending review)
**And** critical mutations refresh affected projections synchronously in the same DB transaction (AD-6)

### Story 4.3: Scheduled State, Cancel, Reverse & Correction

As an HR Admin,
I want future Finalized events to stay Scheduled until Effective, and to Cancel/Reverse/Correct without destroying originals,
So that today's state stays clean while history remains attributable (FR16, FR17).

**Acceptance Criteria:**

**Given** a Finalized future Personnel Event
**When** current state is evaluated before Effective Date
**Then** the event is Scheduled/authoritative and does not alter current projections; UI distinguishes Scheduled from Effective
**When** Cancel is applied to a Scheduled event
**Then** permission and reason are required; Cancel racing effective transition has one atomic outcome (Cancel wins with no effect, or effect wins and Reverse/Correction rules apply — never both)
**When** Reverse is applied to an Effective event or Correction to a factual error
**Then** originals remain; Correction cannot self-reference or cycle; timeline shows links and deterministic resolved result
**And** status badges use Scheduled/Effective/Cancelled/Reversed/Draft tokens (UX-DR10)

### Story 4.4: Deterministic Ordering & Recalculation

As an HR Admin,
I want identical reconstruction from the same authoritative event set, including retroactive changes,
So that current and historical views never diverge silently (FR18, NFR3, NFR4).

**Acceptance Criteria:**

**Given** Asia/Tehran; Effective Date date-only; exclusive interval ends (AR-TEMPORAL partial freeze)
**When** same-Effective-Date events collide
**Then** ordering is registration/finalization time ascending; UUID only if times collide
**When** past-dated change, Cancel, Reverse, or Correction occurs
**Then** affected derived state recalculates from the earliest affected point; failure/staleness is exposed (not silently served)
**And** heavy historical recalc may run async via pg-boss with visible `recalculation_pending` and disabled gold CTAs on affected actions
**When** a native event earlier than Baseline is submitted
**Then** it requires explicit Override, mandatory Persian warning acknowledgement, and audit (or governed Baseline revision path) — never silent pre-Baseline invention

### Story 4.5: Start & Return Events

As an HR Operator,
I want effective-dated start and return events,
So that Employment begin correctly creates Employment + Primary Assignment against headcount (FR20).

**Acceptance Criteria:**

**Given** compatible headcount (or Admin Override path) and Epic 3 Employment/Primary invariants
**When** Start or Return is finalized through the Personnel Event flow
**Then** one Employment and one Primary Assignment are created against applicable headcount; Operator cannot finalize without capacity
**And** Return reuses the same Person and Personnel Code; a new Employment and Primary Assignment are created; prior history is preserved
**And** approved minimum Person, Employment, organization, and Primary Assignment facts are required at finalization
**And** anonymized-Person return matching uses AR-DATA rehire token or verified manual rematch — never silent restore of disposed identity
**And** no CRUD bypass exists outside this event path for creating active Employment

### Story 4.6: Termination Events

As an HR Operator,
I want effective-dated termination events,
So that Employment end releases Assignments and headcount at effect (FR21).

**Acceptance Criteria:**

**Given** an active Employment with Assignments
**When** Termination is finalized
**Then** active Employment and Assignments end and associated headcount releases at effect; date and reason retained
**And** incompatible future events must be explicitly disposed before finalization
**And** the Person and permitted history remain after Employment ends

### Story 4.7: Team Transfer with Atomic Capacity Movement

As an HR Operator (Mina journey),
I want an effective-dated Team transfer that atomically moves Primary Assignment and capacity,
So that the Person never has zero or two Primaries and today's totals stay correct until Effective (FR22, FR30, FR31, UJ-1).

**Acceptance Criteria:**

**Given** a Person with active Primary Assignment and a destination Team/title
**When** a future transfer is finalized
**Then** destination capacity is immediately reserved; source remains consumed until Effective; today's profile and source team counts unchanged
**When** the Effective point is reached
**Then** source release and destination consumption occur as one atomic business outcome; failure leaves prior valid state unchanged
**And** a transfer whose resolved destination equals source Primary is rejected as no-op (no Reservation)
**And** `headcount-capacity-panel` shows used/reserved/free for destination before finalize (UX-DR13)
**And** concurrent transactions cannot consume or reserve the same last unit (NFR4)

### Story 4.8: Job, Level, Contract & Compensation Change Events

As an HR Operator or Admin,
I want independent effective-dated job/level and contract/compensation change events,
So that prior values remain reconstructable under separate permissions (FR23, FR24).

**Acceptance Criteria:**

**Given** permitted event types and the compensation-facts module from Epic 3
**When** Organizational Role, Job Title, Seniority, Ladder, or Grade changes are finalized
**Then** Grade remains valid for Ladder; Job Title/Seniority re-evaluate headcount compatibility; Grade alone does not consume/release capacity
**When** contractual/compensation changes are finalized
**Then** only Data-Dictionary-approved fields are retained; separate sensitive permissions apply
**And** promotion is recorded as final outcome only (no request/committee workflow)
**And** `personnel-event-form` uses sectioned layout, Save draft vs Finalize, and `sensitive-confirmation-dialog` when required (UX-DR11, UX-DR14)

### Story 4.9: Current Person State Projection

As an authorized user,
I want current Person state derived from the resolved authoritative event set,
So that profile, lists, and reports reconcile for the same date and scope (FR25).

**Acceptance Criteria:**

**Given** a resolved authoritative event set
**When** current state is requested
**Then** Employment, Primary/in-scope Secondary Assignments, organization, Role, Title, Ladder, Grade, Seniority, contractual, and compensation (if permitted) derive from events — not registration time
**And** current facts are distinguishable from Scheduled future changes
**And** profile, list, and report consumers of current state share the same projection semantics for identical filters/scope

### Story 4.10: Historical Person Reconstruction

As an authorized user,
I want as-of reconstruction of supported Person state,
So that historical investigation is deterministic and Baseline limits are disclosed (FR26).

**Acceptance Criteria:**

**Given** a selected as-of date
**When** historical Person state is requested
**Then** supported Person state reconstructs (Employment status, organization, Assignment, Role, Title, Ladder, Grade, Seniority, and other approved categories)
**And** Baseline limitations are disclosed
**And** future as-of uses planned-state semantics and never labels future as Effective early

### Story 4.11: Historical Organization & Headcount Reconstruction

As an authorized user,
I want historical Team/organization counts and headcount quantities for a supported date,
So that transfers and corrections affect totals only at resolved effective points (FR27).

**Acceptance Criteria:**

**Given** a supported historical date and permitted scope
**When** historical Team/org/headcount counts are requested
**Then** approved/used/reserved/free and membership counts reconcile under the same metric definitions
**And** transfers/corrections affect totals only at resolved effective points
**And** detailed and aggregate results reconcile under the same metric catalogue

### Story 4.12: Headcount Approval Lifecycle

As an HR Admin,
I want Headcount Approvals with governed lifecycle,
So that only valid approvals can accept consumption or Reservation (FR28).

**Acceptance Criteria:**

**Given** Admin on سطح ظرفیت و جذب
**When** a Headcount Approval is managed
**Then** it has unique requirement code, Team, Job Title, optional Seniority, allowed count, validity, status, approval reference, and provenance
**And** Draft/Cancelled/Expired approvals cannot accept new consumption or Reservation; allowed count is non-negative; validity range non-empty
**And** changing/cancelling/expiring/reducing an approval with active consumption or Reservation cannot orphan claims; disposition follows AR-HEADCOUNT

### Story 4.13: Universal Coverage Matching & Exemptions

As an HR Admin,
I want every Primary Assignment to consume compatible headcount unless exempted,
So that capacity matching stays deterministic and attributable (FR29).

**Acceptance Criteria:**

**Given** a Primary Assignment needing capacity
**When** matching runs at finalization
**Then** compatibility is Team + Job Title + optional Seniority; Grade and compensation do not determine matching
**And** default match is oldest valid compatible approval (validity start then creation); manual reselection before finalize is audited
**And** exemptions identify policy, Assignment, actor/approver, reason, validity, and reporting treatment

### Story 4.14: Reservation Expiry Exceptions & Headcount Override

As an HR Admin,
I want reservation expiry handling and explicit Overrides,
So that shortages are visible and governed rather than hidden (FR30, FR32).

**Acceptance Criteria:**

**Given** a Scheduled start/transfer with Reservation
**When** linked approval approaches expiry
**Then** a warning appears at the 14-day horizon (AR-HEADCOUNT may retune N)
**When** approval expiry or incompatibility occurs before effect
**Then** the event remains Scheduled in a visible exception state with no partial Employment/Assignment/capacity apply until audited resolution
**When** Admin Override is used for shortage/validity/title/seniority rules
**Then** mandatory context is captured; free capacity may go negative; Overrides appear as distinct filterable rows and never floor free at zero
**And** audit retains actor, time, reason, violated rule, related event/Assignment, Team, title, and capacity state
**And** Cancel or superseding Correction releases/replaces Reservation

## Epic 4b: Shell & IA Alignment (UX 2026-07-19)

Operators and admins use the redesigned Persian RTL shell — collapsible sidebar, section tabs, governed tables/trees — with Access and Organization admin surfaces retrofit to the new IA, before Search/Profiles/Dashboard work begins.

**UX contract:** `ux-divan-2026-07-19` (EXPERIENCE.md + DESIGN.md). Prior Epic 1–3 shell/admin UI AC remain historically true for delivery dates; forward contract is this epic. Authorized by `sprint-change-proposal-2026-07-19`.

### Story 4b.1: DESIGN Delta Tokens & Collapsible App Shell

As an authenticated Divan user,
I want a collapsible navy RTL sidebar with updated brand tokens,
So that wide governed tables reclaim horizontal space at desktop viewports (UX-DR1, UX-DR3).

**Acceptance Criteria:**

**Given** the existing `app-shell` from Epic 1
**When** ux-divan-2026-07-19 DESIGN delta tokens are applied
**Then** spacing includes `sidebar-width-collapsed` 64px and `section-tabs-height` 44px plus governed-table/tree tokens from DESIGN.md
**And** the sidebar defaults to expanded; a footer toggle collapses to icon-only with tooltip and `aria-label` on each item
**And** collapse preference persists per account
**And** content width reclaims `sidebar-width` − `sidebar-width-collapsed`
**And** chrome remains navy in light and dark themes; active item keeps sidebar-active + accent RTL leading border
**And** theme toggle and sidebar collapse do not trigger unsaved-form leave-guards

### Story 4b.2: Section Tabs Chrome, Routing & Leave-Guards

As a user working in a major nav surface,
I want horizontal section tabs whose URL reflects the active tab, with leave-guards on dirty forms/previews,
So that I do not lose draft work when navigating (UX-DR25).

**Acceptance Criteria:**

**Given** a major nav surface (اطلاعات پرسنلی, رویدادهای پرسنلی, ساختار سازمان, ظرفیت و جذب, دسترسی‌ها, and other tabbed surfaces as they exist)
**When** section tabs render
**Then** they use `tablist` / `tab` / `tabpanel` semantics and the URL reflects the selected tab
**And** route announcements include surface name + selected tab
**When** the user attempts to leave a dirty form or loaded import preview via section tab, sidebar, command palette, or history
**Then** a leave-guard offers Stay · Discard · Save (or equivalent) and blocks navigation until resolved
**And** theme toggle and sidebar collapse remain exempt from leave-guards
**And** section tabs may scroll horizontally at 1280×720 without page-level horizontal scroll

### Story 4b.3: Sidebar IA, Labels & Role Landings

As a role-filtered user,
I want the 2026-07-19 sidebar order and landings,
So that Personnel Events are top-level and Operator lands on اطلاعات پرسنلی (UX-DR18, UX-DR19).

**Acceptance Criteria:**

**Given** an authenticated session with coarse role context
**When** the sidebar renders
**Then** nav order is: داشبورد · اطلاعات پرسنلی · رویدادهای پرسنلی · ساختار سازمان · ظرفیت و جذب · گزارش‌ها · ورود داده · دسترسی‌ها · ممیزی · عملیات · پرونده‌های اصلاح
**And** unauthorized items are omitted from the DOM (not shown disabled)
**When** login completes
**Then** HR Operator lands on اطلاعات پرسنلی / فهرست پرسنل; HR Admin and Manager on داشبورد; Audit reviewer on ممیزی; System Admin on عملیات
**When** the user opens a deep link they are not permitted to access
**Then** the UI shows «دسترسی ندارید.» with a link to their role landing and the denial is audited
**And** this story supersedes Story 1.5 landing label «پرسنل» and Story 1.3 fixed 240px-only sidebar assumption for forward work

### Story 4b.4: Governed Data Table Primitive

As a developer of list surfaces,
I want a shared `governed-data-table` primitive,
So that Epic 5+ lists share filter/sort/snapshot/a11y behavior (UX-DR7).

**Acceptance Criteria:**

**Given** the shared UI component library in `apps/web`
**When** `governed-data-table` is rendered with demo or fixture rows
**Then** it is full-width and compact; supports per-column enum multi-select and text typeahead filters
**And** header sort exposes `aria-sort`; pagination uses a stable query snapshot with deterministic ordering
**And** any filter or sort change creates a new snapshot and resets page to 1; result count is announced via a polite live region
**And** sticky RTL identifier column and sticky row-actions column (inline-end) remain visible during horizontal scroll inside the table container
**And** columns the caller lacks permission for are omitted from the DOM
**And** empty state shows «نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.» with «پاک کردن فیلترها» resetting to section defaults
**And** AG Grid is not used; infinite scroll is not used
**And** Epic 5.1 may replace fixture data with permission-safe personnel queries without changing the primitive contract

### Story 4b.5: Access Administration Person-First Retrofit

As an HR Admin,
I want دسترسی‌ها organized as افراد و دسترسی · نقش‌ها · محدوده‌ها · دسترسی اضطراری,
So that I answer “who can do what?” from people first (UX-DR27, UJ-Access, FR4 UI).

**Acceptance Criteria:**

**Given** an Admin with access-administration permission on سطح دسترسی‌ها
**When** the Access surface opens
**Then** section tabs match EXPERIENCE / `mockups/key-access-admin.html`: افراد و دسترسی · نقش‌ها · محدوده‌ها · دسترسی اضطراری
**And** افراد و دسترسی is a person-first governed table for accounts → roles/scopes, directory link, active status
**And** نقش‌ها and محدوده‌ها preserve Story 2.3 attributable create/change behavior and toxic fail-closed rules
**And** OrganizationalScope CRUD remains label + active (not org units)
**And** دسترسی اضطراری uses distinct warning posture for break-glass administration entry points already delivered in Epic 2
**And** empty entitlements still show «تخصیص دسترسی‌ای ثبت نشده.»
**And** domain APIs and audit evidence from Epic 2 are unchanged — this story is UI reshape only

### Story 4b.6: Organization Section Tabs & Tree Navigators

As an HR Admin,
I want ساختار سازمان as سلسله‌مراتب · نقش سازمانی · عنوان شغلی · لدر و گرید · ارشدیت,
So that hierarchy and ladder/grade use trees and flat refs use tables (UX-DR26, FR9–FR10 UI).

**Acceptance Criteria:**

**Given** Admin access to ساختار سازمان
**When** the surface opens
**Then** section tabs are: سلسله‌مراتب · نقش سازمانی · عنوان شغلی · لدر و گرید · ارشدیت
**And** سلسله‌مراتب uses `tree-navigator` for LE → BU → Dept → Team with expand/collapse, keyboard support, and toolbar «افزودن»
**And** لدر و گرید uses `tree-navigator` with ladder parents and grade children; «افزودن گرید» is disabled until a ladder node is selected (or modal requires parent)
**And** نقش سازمانی، عنوان شغلی، and ارشدیت use flat `governed-data-table` + «افزودن» modal
**And** deactivate-with-active-children / impossible reparent fail closed with Persian blockers (Story 3.5/3.6 domain rules unchanged)
**And** no separate «افزودن» tab; bulk org import remains deferred
**And** visuals align with `mockups/key-org-ladder-grade.html`; domain APIs from Epic 3 unchanged

### Story 4b.7: Personnel & Events Shell Scaffolds + Event Entry Relocation

As an HR Operator,
I want اطلاعات پرسنلی and رویدادهای پرسنلی section shells with the Epic 4 event form hosted on ثبت رویداد,
So that UJ-1 shell entry points exist before full Epic 5 list/profile depth (UJ-1, UX-DR11, UX-DR28).

**Acceptance Criteria:**

**Given** the updated IA from Story 4b.3
**When** اطلاعات پرسنلی opens
**Then** tabs exist: فهرست پرسنل · افزودن · ورود گروهی · فرهنگ داده (Admin-only for فرهنگ داده)
**And** فهرست پرسنل may use `governed-data-table` with EXPERIENCE column headers and default filter همکار فعلی = yes even if full FR33 wiring waits for Story 5.1
**And** toolbar «افزودن سریع» opens a minimal-create path; row action «اطلاعات کامل/ویرایش» opens `personnel-quick-edit-modal` (non-event fields; dirty Stay · Discard · Save; link «باز کردن پروفایل کامل»)
**When** رویدادهای پرسنلی opens
**Then** tabs exist: رویدادها · ثبت رویداد · ورود گروهی
**And** ثبت رویداد hosts the existing Epic 4 `personnel-event-form` (draft ≠ finalize)
**And** row/nav «ثبت رویداد» navigates to ثبت رویداد with person pre-filled; inbound prefill while the tab is dirty runs leave-guard first (never silent person swap)
**And** ظرفیت و جذب may receive thin section-tab shells (هدکانت · ایجاد · ورود گروهی) for IA consistency without expanding headcount domain scope
**And** full permission-safe search semantics, profile sections, and timeline depth remain Epic 5

## Epic 5: Search, Profiles, Dashboard & Reports

Authorized users search and list permission-safe populations, open profiles with timelines, use the launch dashboard, and run the approved launch report catalogue with synchronized filters and current/as-of semantics.

**Prerequisite:** Epic 4b shell/IA primitives (`governed-data-table`, section tabs, updated landings) should be complete before Story 5.1 implementation.

### Story 5.1: Permission-Safe Personnel Search & Lists

As an HR Operator, Admin, or Manager,
I want to search and filter personnel with stable pagination and Persian empty states,
So that I only see populations and fields I am allowed to see (FR33, UX-DR7).

**Acceptance Criteria:**

**Given** an authenticated scoped user on اطلاعات پرسنلی / فهرست پرسنل
**When** they search/filter by approved identifiers/categories (name, surname, Personnel Code, national ID, email, phone, Job Title, Team, Department, Business Unit, ladder, grade, employment type, and other EXPERIENCE columns where permitted)
**Then** results, facets, counts, and columns reveal no out-of-scope values
**And** the list uses `governed-data-table` with Excel-like column filters, sorting (`aria-sort`), pagination over a stable query snapshot with deterministic ordering, result count, and filtered export when permitted
**And** default filter همکار فعلی = yes is active and dismissible; «پاک کردن فیلترها» restores section defaults including that default
**And** sticky RTL identifier and sticky row actions remain visible; horizontal scroll stays inside the table container
**And** row actions include «اطلاعات کامل/ویرایش» (`personnel-quick-edit-modal` + link to full profile) and «ثبت رویداد» (navigate to رویدادهای پرسنلی / ثبت رویداد with person pre-filled)
**And** empty search shows «نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.» with clear-filters action
**And** command palette Enter opens the selected profile using the same permission-safe search

### Story 5.2: Personnel Profile Sections

As a scoped user,
I want a permission-filtered Person profile with current and prior Employment sections,
So that I can review governed facts without seeing forbidden fields (FR34, UX-DR8).

**Acceptance Criteria:**

**Given** access to a Person within scope
**When** the profile opens
**Then** sections include identity, current Employment, current Assignments, approved sensitive categories, prior Employments, and timeline entry points
**And** fields outside permission are not rendered in the DOM
**And** sensitivity icons mark governed categories
**And** current facts are distinguishable from Scheduled future changes
**And** cold load uses Skeleton matching density
**And** profile is reachable from quick-edit «باز کردن پروفایل کامل», command palette, or deep link (Epic 4b shell delta)

As an HR Admin or Operator,
I want a chronological Personnel Event timeline with status badges and correction links,
So that I can investigate what changed and how it was corrected (FR34, UX-DR9, UJ-2).

**Acceptance Criteria:**

**Given** a Person profile
**When** the timeline renders
**Then** rows show type, Jalali Effective Date, registration/finalization actor+time, status badge, provenance, and correction/neutralization links
**And** sort is Effective Date desc → registration time desc → type; same-day rows show secondary caption sort hint
**And** status dots are `aria-hidden`; badge text is the sole status announcement
**And** empty timeline shows «رویداد پرسنلی ثبت نشده.»
**And** actions to open Correction/Cancel/Reverse respect permissions and open Epic 4 flows

### Story 5.4: Core Launch Dashboard

As an HR Admin or Manager,
I want a permission-safe launch dashboard with synchronized filters,
So that workforce totals, trends, team capacity, starts/terminations, and open headcount reconcile to detail (FR35, UX-DR15).

**Acceptance Criteria:**

**Given** داشبورد access
**When** shared organization and time filters change
**Then** all applicable `dashboard-metric-card`s update synchronously with permission-safe current/as-of semantics
**And** indicators cover active Persons; LE/BU/Dept/Team counts; approved/used/reserved/free headcount; workforce trend by Effective Date; Team membership/capacity; starts vs terminations; open headcount including near-expiry/expired non-consumable approvals
**And** each metric links to or reconciles with permission-filtered detail
**And** suppressed cohorts show «داده قابل نمایش نیست» — never 0
**And** empty scoped dashboard shows «در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.»
**And** grid is 2–4 columns at ≥1280 and 2-column at 1280×720; last calculation time shown when derived

### Story 5.5: Launch Report Catalogue

As a scoped reporting user,
I want to run the approved launch report catalogue with Jalali dates and export,
So that operational and historical questions use consistent metrics (FR36).

**Acceptance Criteria:**

**Given** گزارش‌ها access
**When** a launch catalogue report runs (active Persons; all Persons; org state; Team membership/manager; distributions; starts; terminations; transfers; role/grade/compensation changes; headcount approvals/capacity; Overrides; Scheduled; Corrected/Cancelled/Reversed; Import Batch outcomes)
**Then** synchronized org and time/as-of filters apply; temporal measures use Effective Date; Jalali dates display unambiguously
**And** last calculation/update time is exposed when derived state is used
**And** metric definitions are configurable from AR-REPORTING without removing required launch reports from scope absent explicit PRD change
**And** this story delivers **run/view** of the catalogue; **governed file download / artifact panel** for filtered export (FR41, FR52) is completed in Story 6.5 — Story 5.5 may expose an export affordance that remains disabled or routes to a stub until 6.5 lands
**And** sprint planning MUST NOT treat full export UX as done when only 5.5 is complete

## Epic 6: Migration, Baseline & Governed Export

Migration actors import approved CSV/XLSX through validated preview and atomic Import Batches, establish Baseline provenance, reconcile to signed controls, and produce governed exports with secure artifact lifecycle.

### Story 6.1: Controlled Import Wizard with Preview

As a migration actor,
I want CSV/XLSX import through identify → validate → preview → confirm stages,
So that row-level Persian errors are fixed before execution (FR37, UX-DR16, UJ-4).

**Acceptance Criteria:**

**Given** Admin/migration access to ورود داده (advanced/migration wizard — distinct from per-section ورود گروهی day-to-day bulk tabs)
**When** an approved template is uploaded
**Then** validation covers structure, required data, identifiers, uniqueness, dates, enums, hierarchy, references, Ladder–Grade, overlaps, order, and duplicate rows
**And** each error cites row, column, and actionable Persian reason in `import-preview-table` (destructive/amber tints)
**And** user can cancel before execution; navigating away with loaded preview warns with batch id
**And** workbook formulas, macros, external links, and active structures are rejected; formula-control leading characters stored/displayed as literal text (FR52)
**And** preview exposes no field/row beyond the viewer's permission

### Story 6.2: Atomic Import Batch Execution & Staging Cutover

As a migration executor,
I want atomic Import Batch execution via staging with approval segregation,
So that failures leave zero partial production state (FR38, AD-4).

**Acceptance Criteria:**

**Given** a validated preview batch
**When** production execution is requested for a sensitive frozen batch
**Then** upload/approval/execution duties are separated per AR-MIGRATION; executor cannot alter approved contents
**And** migration writes to staging schema first; production event-store receives Baseline/events only via atomic cutover after independent approval
**And** execution revalidates against current authoritative state; overlapping concurrent batches targeting the same records are blocked («دسته دیگری در حال اجراست» + owner + correlation id)
**When** execution fails
**Then** no partial business/derived/headcount state remains; pre-cutover rollback drops staging with zero production trace
**And** batch evidence records source metadata, actors/times, status, counts, errors, and every created record/event; repeats cannot silently duplicate

### Story 6.3: Baseline Provenance & Reconstructable History Boundary

As an HR Admin,
I want Baseline state distinct from native Personnel Events with clear provenance,
So that users understand the start of reliable reconstructable history (FR39).

**Acceptance Criteria:**

**Given** an approved cutover
**When** users view Person history and migration metadata
**Then** Baseline state, imported events, and native events are distinguishable
**And** the product states the reconstructable-history boundary; first production event per Person is the approved Baseline event where applicable
**And** `source=migration` is audit metadata, not a substitute for cutover controls

### Story 6.4: Migration Reconciliation Workspace

As Migration Lead and HR Data Owner,
I want signed reconciliation of people, Employments, Assignments, events, totals, and headcount,
So that production cutover cannot proceed with unresolved critical defects (FR40, LG-1).

**Acceptance Criteria:**

**Given** trial or production Import Batches
**When** reconciliation runs
**Then** Person, Employment, Assignment, Personnel Event, current state, Team totals, reference mappings, headcount, duplicates, orphans, and control totals are compared to signed controls
**And** every discrepancy has an owner and accepted disposition
**And** production cutover is blocked without owner-signed reconciliation and zero unresolved critical integrity defects

### Story 6.5: Governed Export & Artifact Panel

As a permitted exporter,
I want filtered exports with classification, reauth, and custody acknowledgement,
So that sensitive fields never leave without category-specific export permission (FR41, FR52, UX-DR17).

**Acceptance Criteria:**

**Given** export permission for the filtered scope
**When** export is generated
**Then** only permitted records/fields/dates/Organizational Scope in an AR-DATA-approved format are included
**And** sensitive fields are excluded without category-specific export permission
**And** generation binds to a reviewed stable snapshot and reauthorizes at execution and each managed retrieval
**And** `export-artifact-panel` shows classification, expiry, field scope; sensitive/bulk requires custody acknowledgement before download
**And** download displays classification/handling/expiry notices and records recipient/destination class/custody transfer
**And** spreadsheet exports are formula-safe; actor, time, purpose, filters, volume, outcome, and artifact handling are audited
**And** Divan does not claim it can revoke local copies after they leave the system

## Epic 7: Audit, Operations & Evidence Controls

Audit reviewers and operators investigate attributable business/access evidence and service health without routine HR content exposure; the system enforces retention/hold, audit trust, correction-case evidence, formal-report reproducibility, Launch Artifact change control, and evaluation-snapshot integrity.

### Story 7.1: Audit Investigation Surface

As an Audit / Security Reviewer,
I want a permissioned audit surface over business and access events,
So that I can investigate activity independently of ordinary HR administration (FR42, FR51).

**Acceptance Criteria:**

**Given** Audit reviewer landing on ممیزی
**When** they search audit evidence
**Then** they can retrieve AR-AUDIT-governed events for authentication, sensitive/denied reads, mutations, finalization, Cancel/Reverse/Correction, org/headcount changes, Override, import, export, permission/configuration, and privileged access
**And** evidence identifies actor, time, operation, entity/type, scope, result, reason where applicable, and correlation reference
**And** ordinary operational users cannot alter audit records; audit access is separately permissioned and itself audited
**And** empty results show «رویدادی با این فیلتر نیست.»
**And** no actor can approve review of their own sensitive activity

### Story 7.2: Operations Health Without HR Content

As a System Admin (Arman),
I want service, identity, import/recalculation, backup, and dependency health views,
So that I can operate Divan without browsing personnel records (FR45, UJ-5, NFR10).

**Acceptance Criteria:**

**Given** System Admin on عملیات
**When** health dashboards load
**Then** identity connectivity, service health, import/recalc job status, backup/restore evidence hooks, and dependency status are visible without personnel rows or unnecessary HR fields
**And** technical logs redact LDAP secrets and unnecessary personnel data and support incident correlation
**And** failed/stale derived-state processing is visible; authorization, headcount finalization, and formally published reports fail closed when required inputs are stale/failed/unreconciled
**And** LDAP unavailable marks ops identity health red; login remains fail-closed with Persian message

### Story 7.3: Retention, Disposal & Legal Hold

As Legal/Privacy / HR Data Owner,
I want lifecycle enforcement for Data Elements and artifacts including legal hold,
So that disposal propagates without fabricating disposed facts (FR50).

**Acceptance Criteria:**

**Given** AR-DATA lifecycle classes
**When** retention end or disposal is due
**Then** required deletion/anonymization/restriction propagates to operational state, derived/search/report data, import/staging/error artifacts, active exports, caches/copies, and backups under recovery-aware policy
**And** historical/audit proof is preserved with minimized evidence; reconstruction explicitly identifies limits and never fabricates disposed facts
**When** legal hold is active
**Then** disposal is blocked without breaking append-only audit; hold/release/disposal/failed propagation are attributable and reconcilable

### Story 7.4: Audit Trust Fail-Safe

As a Security owner,
I want required-audit failure to prevent or safely suspend sensitive operations,
So that unaudited sensitive activity cannot proceed (FR51, NFR9).

**Acceptance Criteria:**

**Given** a governed sensitive operation requiring audit capture
**When** required audit write fails, clock anomaly is detected, or integrity verification fails
**Then** the operation is prevented or safely suspended; gaps are detected, alerted, and assigned for review
**And** minimum baseline covers probes of highly sensitive categories, reveal/unmask, bulk retrieval, historical access, audit access, privileged reads, entitlement changes, and break-glass with actor/purpose/scope/volume/outcome and no unnecessary value duplication

### Story 7.5: External Data-Subject Correction Cases

As an HR Admin,
I want restricted correction-case tracking without employee self-service,
So that external transparency/correction requests remain attributable (FR53).

**Acceptance Criteria:**

**Given** دسترسی to پرونده‌های اصلاح
**When** a case is opened
**Then** it records verified request reference/authority, linked Person, owner, status, deadline, decision/reason, restricted evidence references/metadata, and closure evidence
**And** bounded attachments follow AR-DATA allowlist; active/executable/script/external-link/unauthorized archive content is rejected; failed inspection fails closed; no content auto-executes
**When** deadline passes
**Then** case enters distinct «مهلت گذشته» / breached-escalated state — not indistinguishable from in-time active
**And** approved outcomes link to Correction, retention/disposal, propagation/recalc, affected published artifacts, and response evidence

### Story 7.6: Published Decision-Report Reproducibility

As an HR/Product decision publisher,
I want formal decision reports to remain reproducible or explicitly marked non-reproducible after disposal,
So that retroactive Corrections cannot silently rewrite published decisions (FR54).

**Acceptance Criteria:**

**Given** a report used as a formal organizational decision record
**When** it is published
**Then** publication records report/metric version, authorized population/snapshot reference, filters, as-of semantics, timestamp, publisher, and permitted audience without embedding unauthorized values
**When** a later Correction or metric/policy change occurs
**Then** a linked correction/supersession notice is created; the published record is not silently rewritten
**When** required source disposal occurs
**Then** either an approved privacy-preserving reproducibility package is retained, or the publication is marked `non-reproducible-after-disposal` and cannot be claimed as currently reproducible

### Story 7.7: Launch Artifact Change Control Hooks

As a Product / domain owner,
I want Launch Artifacts versioned with waiver and rebaseline controls,
So that conflicting or expired policies block affected baselines instead of inviting local assumptions (FR55).

**Acceptance Criteria:**

**Given** Launch Artifact Register items (AR-*)
**When** an operation/report/evidence runs
**Then** the controlling artifact version is identifiable; superseded versions remain traceable
**When** a waiver is issued
**Then** it states owner, independent approver, scope, risk, compensating controls, expiry, and closure evidence and cannot waive default-deny, audit independence, integrity, or mandatory upstream gates
**When** material PRD/policy/metric/architecture/threshold changes occur
**Then** impact-assessed rebaseline and affected regression/acceptance are required before continued build/release
**And** conflicting artifact prescriptions block the affected baseline/operation until jointly resolved and versioned

### Story 7.8: Authoritative Evaluation Snapshot Integrity

As a Product / Architecture owner of finalize, import, and export paths,
I want mutable reference data and result sets resolved against one attributable snapshot,
So that concurrent changes cannot produce partially valid authoritative operations (FR56).

**Acceptance Criteria:**

**Given** finalization, import execution, pagination, export generation, or formal report publication
**When** the operation runs
**Then** it completes against one validated snapshot/version or fails without mixing versions
**And** organization/reference changes, concurrent imports, or permission changes cannot produce partially valid authoritative outcomes
**And** conflicts are surfaced with no silent overwrite or out-of-scope delivery

## Epic 8: Experience Foundation & Identifier Ergonomics

Operators and admins work with people, teams, and job concepts by their real business codes inside one coherent visual and interaction system — a single page-layout, form, table, feedback, and theming language — removing UUID entry, inconsistent controls, unreadable tables, and unexplained system messages from every existing surface.

**UX contract:** `ux-divan-2026-07-31` (EXPERIENCE.md + DESIGN.md), with the `mockups/` set as the visual acceptance reference: `direction-a-dense-console.html` (personnel list, event form, states), `screens-settings.html`, `screens-reports-capacity.html`, `screens-bulk-entry-profile.html`, and `chart-palettes.html`. Epic 1–7 and 4b acceptance criteria remain historically true against `ux-divan-2026-07-19`; forward contract is this epic. Authorized by `sprint-change-proposal-2026-07-31`. No domain, permission, or governance rule changes in this epic — presentation and interaction only, except where a defect makes a governed action unreachable.

### Story 8.1: Interaction System Audit & Control Contract

As a developer working across Divan surfaces,
I want a published mapping from action semantics to control appearance, enforced in code,
So that the same kind of action looks and behaves the same on every surface (UX-DR30, FR58).

**Acceptance Criteria:**

**Given** the delivered Epic 1–7 surfaces
**When** the interaction audit runs
**Then** every button, row action, table, panel, and form in `apps/web` is inventoried with its current variant, size, placement, and semantics, and the gap list is published as the input to Stories 8.2–8.9
**When** the control contract is implemented
**Then** action semantics map to typed variants — primary CTA, secondary, tertiary/row action, destructive, disabled-with-reason — and the mapping is documented next to the component
**And** `ghost` is removed from row and toolbar actions and remains available only for dialog cancel and inline dismiss
**And** one gold `button-primary` per surface region is preserved
**And** existing drift is fixed, including the `org-flat` surface and padding inconsistencies found by the audit
**And** a lint rule or selfcheck fails when a row or toolbar action uses a retired variant

### Story 8.2: Visual Design Language & Layout System

As any Divan user,
I want every surface to use the same header, spacing, panel, form, and typography system,
So that the product reads as one professional application rather than several (UX-DR38, FR58).

**Acceptance Criteria:**

**Given** the `ux-divan-2026-07-31` DESIGN tokens
**When** the layout system is implemented
**Then** every surface uses one `page-header` pattern — breadcrumb, surface title, result count, purpose line, then section tabs — with the primary action in the toolbar row beneath, never in the header
**And** the DESIGN spacing rhythm is applied, including `content-padding-inline` 16px, `section-tabs-height` 30px with a 2px navy active border, and the three control heights (24px row action, 28px toolbar, 32px form and CTA)
**And** the hairline-based panel/section system is used with documented rules for when a surface uses a panel versus a full-bleed table
**And** every form uses one layout pattern — label column, field grouping, required marking, help text, inline error, sticky footer with Cancel · Save draft · Finalize order
**And** one icon set is used with fixed size and stroke rules and a fixed per-action icon mapping
**And** typography roles are used semantically with no ad-hoc sizes or weights, verified by the 8.10 gate
**And** a dev-only component gallery renders every primitive in light and dark as the living reference
**And** these values supersede the Story 4b.1 `section-tabs-height` 44px assumption for forward work

### Story 8.3: `entity-picker` Primitive & Code Resolvers

As an operator filling any form,
I want to find people, teams, and job concepts by typing their business code or name,
So that I never need an internal identifier to do my job (UX-DR29, FR57, FR33).

**Acceptance Criteria:**

**Given** the shared UI library and the module APIs
**When** `entity-picker` is implemented
**Then** it searches asynchronously from the first character, accepts Latin or Persian digits, and renders each option as «کد — نام» with a disambiguating second line
**And** it exposes combobox semantics (`role="combobox"`, `aria-expanded`, `aria-activedescendant`) and is fully keyboard operable including Escape and Enter
**And** the selected value renders as an `entity-token` with a clear control, and cascading pickers disable and clear dependents when the parent changes, stating why
**And** variants exist for person, org unit/team, organizational role, job title, ladder→grade, seniority, headcount approval, and account
**And** dependent-record variants list the chosen person's permission-safe employments and primary assignments with their dates, never free text
**When** the caller lacks permission for a subject
**Then** it is absent from suggestions, and out-of-scope and not-found results are indistinguishable in wording, count, and response timing (FR33, FR48)
**And** the missing server resolvers `organization.getByCode` and `jobReference.getByCode` are added alongside the existing `person.search` and `person.getByPersonnelCode`, with the same authorization posture
**And** picker search never widens what the caller could already list

### Story 8.4: Personnel Event Form — Identifier-First Retrofit

As an HR operator registering an event,
I want to choose the person, teams, and job concepts by code and name,
So that I can register an event without looking up a UUID (UX-DR29, FR57).

**Acceptance Criteria:**

**Given** `personnel-event-form` with its current UUID text inputs
**When** the retrofit is complete
**Then** all fifteen identifier inputs are replaced by the matching `entity-picker` variants and no free-text UUID input remains on the form
**And** ladder→grade cascades, with grade disabled until a ladder is chosen and cleared when the ladder changes
**And** employment and primary assignment are chosen from the selected person's own records, shown with their dates
**And** the capacity panel and approval selection display human labels and codes rather than identifiers
**And** the form adopts the Story 8.2 layout pattern and footer action order
**And** the technical identifier of the selected records is available in a collapsed «شناسهٔ فنی» disclosure with a copy control
**And** mutation payloads, draft/finalize semantics, and all Epic 4 validation and capacity rules are unchanged, proven by the existing Epic 4 tests passing unmodified
**And** inbound prefill while the form is dirty still runs the leave-guard before any person swap (UX-DR11)

### Story 8.5: Remaining UUID Inputs Retrofit

As any user of the remaining admin and analysis surfaces,
I want the same code-first selection everywhere,
So that no corner of the product still demands an internal identifier (FR57).

**Acceptance Criteria:**

**Given** the surfaces outside the personnel event form
**When** the retrofit is complete
**Then** pickers replace identifier inputs in dashboard, report, and historical team filters; headcount exemption and override panels; correction-case person and link target; lifecycle scope and disposal person lists; audit investigation actor and entity; reconciliation owner and approver; and launch-artifact owner and approver
**And** every displayed record identity is code plus human name, in that order
**And** internal identifiers appear only inside a labelled «شناسهٔ فنی» disclosure or in exported evidence where correlation requires them
**And** audit investigation retains the ability to look up by raw identifier, because that is a legitimate support path, but it is not the default input
**And** a selfcheck fails when a form input is bound to a UUID-typed field without a picker

### Story 8.6: Governed Table Readability Upgrade

As an operator reading any list,
I want tables to fit the content instead of forcing horizontal scroll,
So that I can read a row without dragging a scrollbar (UX-DR31, FR58).

**Acceptance Criteria:**

**Given** `governed-data-table` and `ui/table`
**When** the readability upgrade is complete
**Then** the five `min-w-[…]` wrappers are removed and no fixed table minimum width remains anywhere in the app
**And** column widths follow content with a per-column max width; long values truncate with an ellipsis and expose the full value accessibly and via tooltip
**And** designated long-text columns wrap instead of truncating
**And** column visibility is user-controlled and persists per operator
**And** the density toggle offers compact 32px (default) and comfortable 48px without changing any other token
**And** sticky identifier and actions columns keep an inset hairline separator while scrolling, not a drop shadow
**And** at 1280×720 with a realistic row set the personnel list and the access administration table are readable without page-level horizontal scroll
**And** the Story 4b.4 primitive contract — filters, sort, snapshot pagination, live-region counts, permission-omitted columns — is preserved

### Story 8.7: Row-Action Affordance & Dead-Click Elimination

As an operator scanning a list,
I want row actions that look like buttons and always do something,
So that I stop clicking controls that appear inert (UX-DR30, FR58).

**Acceptance Criteria:**

**Given** every list surface with row actions
**When** the affordance pattern is applied
**Then** row actions are 24px icon-only buttons, outlined at rest with a visible border and surface fill, never hover-revealed and never borderless
**And** each carries a mandatory `aria-label` and a tooltip shown on hover and on keyboard focus, with a fixed per-action icon mapping shared across surfaces
**And** more than two actions on a row collapse into a labelled overflow menu
**And** row click opens the record while row actions stop propagation, so no action triggers navigation as a side effect
**Given** the leave-guard early return in `leave-guard-provider.tsx`
**When** a navigation or action is blocked by unsaved work
**Then** the user always sees a dialog or an explicit reason, and the blocked path never fails silently
**And** «اطلاعات کامل/ویرایش» and «ثبت رویداد» in the personnel list are verifiably actionable, including from the keyboard
**And** a selfcheck asserts that no rendered action is inert — every enabled action has a handler and every disabled action has a reason

### Story 8.8: Feedback, Loading & Motion System

As any user waiting on the system,
I want consistent, in-place feedback about what is happening,
So that I can tell the difference between loading, blocked, and done (UX-DR39, FR58).

**Acceptance Criteria:**

**Given** the feedback contract in EXPERIENCE
**When** the system is implemented
**Then** initial loads use content-shaped skeletons — tables keep row height and column rhythm, the header renders immediately, and no layout shift occurs on arrival
**And** filters, saves, and finalize actions show in-place pending states rather than replacing the surface
**And** result feedback follows one precedence: inline at the form or row for direct results, toast for background work such as import batches, banner for system-wide state — with exactly one channel per event
**And** no success is reported optimistically; a commit reports only after the server confirms
**And** transitions run 150–250ms and are purposeful, and `prefers-reduced-motion` disables all of them including the skeleton pulse
**And** the destructive and sensitive confirmation posture from Epic 2 and Epic 4 is unchanged

### Story 8.9: Self-Explaining State & Operational Copy Overhaul

As an operator facing a blocked or unusual state,
I want the system to tell me what happened and what to do,
So that I do not have to guess what a message means (UX-DR32, UX-DR37, FR58, FR59).

**Acceptance Criteria:**

**Given** the recalculation banner that currently renders an internal timestamp
**When** the copy overhaul is complete
**Then** it states scope, consequence, and expectation in the form «محاسبهٔ وضعیت جاری برای N فرد هنوز کامل نشده — نهایی‌سازی رویداد و خروجی گرفتن برای این افراد موقتاً غیرفعال است. معمولاً چند دقیقه طول می‌کشد.» with a «توضیح بیشتر» disclosure
**And** no internal timestamp is presented as a deadline anywhere in the UI
**And** affected rows are marked in place and affected figures render muted with «در حال محاسبه — عدد ممکن است تغییر کند.»
**And** every surface carries a one-line purpose statement under its title
**And** empty states distinguish no-data-yet, filtered-to-nothing, and not-permitted, each with its own copy and next step
**And** every disabled control states its Persian reason, exposed both visually and to assistive technology
**And** domain terms encountered in the UI have glossary entries reachable from where they appear
**And** the direct-operational voice from UX-DR24 is preserved — fact, then consequence, then next step, with no ceremonial success copy

### Story 8.10: Design QA, Consistency & Accessibility Gate

As the product owner accepting this wave,
I want a repeatable check that surfaces match the contract,
So that consistency does not decay in Epics 9 and 10 (FR58, NFR12).

**Acceptance Criteria:**

**Given** the `ux-divan-2026-07-31` spines and mockups
**When** the design QA gate runs
**Then** each key screen is compared screen-by-screen against its mockup — personnel list, personnel event form, person profile, reports workspace, dashboard, هدکانت with drawer, bulk-entry wizard, and settings — and deviations are either fixed or recorded as spine amendments
**And** the cross-surface consistency checklist passes for page header, panel system, form layout, table chrome, button variants, icon mapping, and feedback channel
**And** light and dark parity is verified for every surface, state, badge, chart, and banner, with AA contrast at 13px body and 10.5px column headers
**And** essential tasks pass at 1280×720 and 1920×1080 without page-level horizontal scroll
**And** accessibility probes pass for the picker (combobox semantics, keyboard, announcement), tables (sort, live-region counts, sticky columns), dialogs and drawers (focus trap and focus return), and icon-only actions (accessible name, tooltip on focus)
**And** the whole gate is runnable as a selfcheck that Epics 9 and 10 must pass before their own baselines

## Epic 9: Operational Surface Completion & IA Coherence

Every navigable surface does real work: per-section bulk entry with downloadable templates, a coherent capacity-and-hiring structure, a tabbed report workspace, a real personnel-events list, and discoverable governance surfaces — with no placeholder tabs remaining in navigation.

**UX contract:** `ux-divan-2026-07-31`. **Depends on:** Epic 8 primitives (`entity-picker`, page-header and layout system, table readability, feedback system) and the Story 8.10 gate. Domain rules from Epics 3–7 are unchanged; this epic completes and restructures surfaces over them.

### Story 9.1: Sample-Workbook Generation & Template Catalogue

As anyone about to enter data in bulk,
I want a downloadable sample workbook for the template I need,
So that I can prepare a file that is accepted the first time (FR37, FR59).

**Acceptance Criteria:**

**Given** the registered import template definitions
**When** an operator requests a sample for a template
**Then** the workbook is generated from the same authoritative definition used for validation — same columns, same headers, same value formats, same order
**And** a downloaded sample, filled with valid values and re-uploaded unchanged in structure, passes validation
**And** generated workbooks are formula-safe per FR52 and follow the FR52 artifact lifecycle
**And** sample columns that reference entities use business codes with a documented example value, never internal identifiers
**And** a template catalogue is visible in «ورود داده» and in each bulk-entry tab, showing the template name, its purpose, and the permission required
**And** a template a caller may not use states its access requirement rather than being silently absent

### Story 9.2: Shared Bulk-Entry Flow

As an operator permitted to create records one at a time,
I want the same bulk path in every section,
So that entering forty records does not mean forty forms (UX-DR35, FR37, FR59).

**Acceptance Criteria:**

**Given** the FR37 import engine and `import-preview-table`
**When** the shared bulk-entry flow is implemented
**Then** every «ورود گروهی» tab uses one inline five-step flow: قالب → آپلود → پیش‌نمایش و خطاها → تأیید → نتیجه
**And** the flow is permission-scoped so every role that may create a record individually may also create it in bulk, and no wider
**And** preview errors cite row number, column name, and the business code of the subject, never an internal identifier
**And** commit is atomic per FR38 and the result reports created, updated, and rejected counts
**And** the concurrent-batch block message, owner, and correlation id rules from Epic 6 are inherited unchanged
**And** an unsaved preview triggers the leave-guard citing the batch
**And** copy distinguishes this day-to-day path from the sidebar migration wizard, and neither is presented as the other

### Story 9.3: Bulk Entry for Personnel, Events & Headcount

As an HR admin,
I want the three empty «ورود گروهی» tabs to actually work,
So that navigation stops leading to blank pages (FR59).

**Acceptance Criteria:**

**Given** the three placeholder bulk-import pages in personnel, personnel events, and capacity
**When** this story is complete
**Then** each tab hosts the Story 9.2 flow wired to its domain template and validators
**And** personnel bulk entry validates against the data-dictionary-governed fields from Epic 3
**And** event bulk entry runs the same Epic 4 validation as single-event finalization, including effective-date, conflict, and capacity rules, with no bypass
**And** headcount bulk entry runs Epic 4 approval and capacity rules unchanged
**And** no placeholder page remains in the repository or in navigation

### Story 9.4: ظرفیت و جذب IA Restructure

As a capacity owner,
I want one readable headcount page instead of four stacked panels,
So that I can see the capacity picture without scrolling through unrelated blocks (UX-DR34, FR59).

**Acceptance Criteria:**

**Given** the current capacity surface with stacked panels
**When** the restructure is complete
**Then** section tabs are هدکانت · ایجاد · ورود گروهی
**And** «هدکانت» is a governed table of approvals with toolbar create and per-row icon actions
**And** «ایجاد» hosts the full approval creation form using the Story 8.2 form pattern, and is no longer empty
**And** exemptions, overrides, and historical reconstruction open in a `record-drawer` scoped to the approval row they belong to, with the record identity in the drawer header
**And** the drawer closes on Escape and returns focus to the originating row
**And** all Epic 4 headcount domain rules — coverage matching, reservation, atomic consumption, override audit — are unchanged

### Story 9.5: گزارش‌ها Section Tabs & Report Workspace

As an HR business partner,
I want reports grouped by subject with a clear run-and-export flow,
So that finding and running a report is not a hunt (UX-DR33, FR36, FR59).

**Acceptance Criteria:**

**Given** the approved launch report catalogue
**When** the report workspace is implemented
**Then** section tabs group reports by subject: نیروی انسانی · سازمان · رویدادها · ظرفیت و جذب · ورود داده
**And** each tab shows a catalogue rail with report names and one-line purposes, a parameters strip, a run action, and a result area
**And** report selection and parameters are reflected in the URL so a run is shareable and re-openable
**And** the result shows run metadata: as-of date, last calculation time, and row count
**And** export follows FR41 and FR52 unchanged, including reauth and custody rules
**And** a report the caller may not run states its access requirement rather than failing after the click
**And** current versus as-of semantics from Epic 5 are unchanged

### Story 9.6: Personnel Events List — Real Data

As an operator,
I want the events list to show real organization-wide events,
So that the surface is usable rather than a fixture (FR33, FR59).

**Acceptance Criteria:**

**Given** the events list currently backed by `FIXTURE_EVENTS`
**When** the real list is delivered
**Then** it reads from a permission-safe organization-wide event query with the Epic 5 search and scope posture
**And** it supports filters for event type, status, effective-date range, team, and person, using pickers where the filter is an entity
**And** rows show status badges and offer row actions to open the event and open the person
**And** pagination uses the Story 4b.4 stable-snapshot contract
**And** the fixture is removed from the codebase

### Story 9.7: Profile Access & Cross-Surface Drill-Through

As any authorized user,
I want to move between a person, their events, and the numbers that reference them,
So that I can follow a question to its answer without retyping anything (FR34, FR59).

**Acceptance Criteria:**

**Given** the personnel list, event surfaces, dashboard, and reports
**When** drill-through is implemented
**Then** a personnel list row opens the full profile, and the profile is reachable by personnel code deep-link with a canonical redirect
**And** an event links to its person and a person's timeline links to each event
**And** dashboard and report reconciliation links land on the filtered detail that produced the figure
**And** every drill-through target respects the caller's permissions and shows the standard not-permitted state rather than an empty surface
**And** «ثبت درخواست اصلاح» is available from the profile as the contextual entry into «اصلاح اطلاعات»

### Story 9.8: Governance Surface Discoverability

As an HR admin,
I want governance surfaces to say what they are for,
So that a nav item is not a mystery I avoid (UX-DR37, FR53, FR59).

**Acceptance Criteria:**

**Given** the surface currently labelled «پرونده‌های اصلاح»
**When** this story is complete
**Then** it is labelled «اصلاح اطلاعات» and carries a one-line purpose statement naming what it holds, who raises it, and who can close it
**And** it is reachable contextually from a person's profile and timeline, not only from the sidebar
**And** the same treatment — purpose line plus contextual entry — is applied to the other governance-only surfaces identified in the Epic 8 audit
**And** FR53 domain behaviour, including bounded attachments, deadline states, and evidence links, is unchanged

### Story 9.9: No-Dead-End IA Gate

As the product owner,
I want an automated guarantee that navigation never leads nowhere,
So that a placeholder can never ship into navigation again (FR59).

**Acceptance Criteria:**

**Given** the full route table and navigation configuration
**When** the IA gate runs
**Then** every sidebar entry and every section tab resolves to functional content for at least one role
**And** a route rendering only placeholder content fails the gate
**And** navigation entries the caller cannot use are omitted from the DOM rather than shown inert, consistent with UX-DR3
**And** the gate runs in CI and in the selfcheck suite alongside the Story 8.10 gate

### Story 9.10: Dashboard & Report Visual Quality

As a manager reading numbers,
I want charts and metrics that are legible, honest, and consistent,
So that I can trust what I take into a meeting (UX-DR40, FR35, FR36).

**Acceptance Criteria:**

**Given** the DESIGN chart tokens
**When** the visual quality pass is complete
**Then** categorical series use `chart.categorical` on light and `chart.categorical-dark` on dark, and single-measure ramps use `chart.sequential`
**And** gold is never used as a data color and status colors are never used as a data series
**And** chart typography, axis and label treatment, legend, tooltip, and tabular numerals follow DESIGN once and are reused by dashboard and reports
**And** series remain distinguishable in both themes and under common color-vision deficiency, verified at the stroke widths actually rendered
**And** empty, suppressed-cohort, and stale-data chart treatments are consistent — a suppressed cohort renders «داده قابل نمایش نیست.» and never zero (FR48, UX-DR15)
**And** metric cards adopt the Story 8.2 panel system and show their last calculation time
**And** nothing is communicated by color alone

## Epic 10: Administrative Settings & Governed Parameters

An authorized administrator sees every governed application parameter in one place and changes the explicitly permitted ones with validation, reason, audit evidence, and reset-to-default, while security-critical parameters stay read-only with their change path stated.

**UX contract:** `ux-divan-2026-07-31`. **Depends on:** Epics 8 and 9. **Architecture:** governed parameters live in a typed registry with a database-backed store read through a single resolver with cached reads; modules never read raw environment variables or literals for registered parameters; unavailable or invalid values fail closed to the registered code default and raise the FR45 degraded state; no AD-1…AD-6 change.

### Story 10.1: Governed Settings Registry & Store

As a developer of any module,
I want one typed registry and resolver for governed parameters,
So that a parameter has exactly one definition and one source of truth (FR60).

**Acceptance Criteria:**

**Given** the parameters currently expressed as constants and environment variables
**When** the registry is implemented
**Then** each registered parameter declares Persian label, description, type, unit, allowed range or allowlist, default, editability, and owning domain
**And** a persisted store holds overrides, and a single resolver serves values with cached reads and explicit invalidation on change
**And** module constants for registered parameters are read through the resolver, and a lint rule or selfcheck blocks direct environment or literal reads for them
**When** a stored value is missing, unparsable, or out of range
**Then** the resolver fails closed to the registered code default and raises the FR45 degraded state rather than applying an invalid value
**And** resolution never blocks a request path on a database round trip beyond the cached read

### Story 10.2: تنظیمات Surface & Admin-Only Access

As an administrator,
I want one place that shows the parameters I am allowed to see,
So that configuration is not scattered across code and environments (UX-DR36, FR60).

**Acceptance Criteria:**

**Given** the registry from Story 10.1
**When** the settings surface is delivered
**Then** a «تنظیمات» nav entry exists at the end of the sidebar with its own permission, omitted from the DOM for callers without it
**And** section tabs are عمومی و نمایش · داده و نگه‌داشت · ورود و خروجی · ظرفیت و جذب · دسترسی و نشست · ممیزی و یکپارچگی · زیرساخت
**And** tabs are role-split: `hr_admin` sees the business domains, `system_admin` sees the technical domains, عمومی و نمایش is visible to both, and each role sees only its own tabs
**And** rows render from the registry rather than being hand-written per parameter
**And** each row shows label, description, current value, default, source, allowed range, editability, and last change actor and Jalali time
**And** a caller with no settings permission never sees the nav entry, and a direct deep link shows «دسترسی ندارید.» and is audited (UX-DR18)

### Story 10.3: Editable Parameter Wave 1

As an administrator,
I want to change the operational limits that actually get asked about,
So that a tuning request does not require a deployment (FR60).

**Acceptance Criteria:**

**Given** the settings surface
**When** wave 1 is delivered
**Then** the editable set is import limits (file size, row count, draft count and TTL), export artifact TTL and custody threshold, list and search page sizes and caps, headcount reservation-expiry warning window, correction-case attachment limits and allowlist, and entitlement recertification window
**And** each edit validates inline against the registry range or allowlist before it can be applied
**And** a high-impact parameter requires confirmation stating the blast radius — which surfaces recompute and whether existing records are re-evaluated
**And** «بازگشت به پیش‌فرض» is available on every editable row
**And** a change takes effect through the resolver without a restart
**And** no parameter in this wave can widen a permission, retention, export, or audit boundary

### Story 10.4: Read-Only Inventory of Infrastructure & Security Parameters

As a system administrator or auditor,
I want to see the deployment-managed settings without being able to change them here,
So that the real configuration is visible without weakening its change control (FR60, FR42, FR45).

**Acceptance Criteria:**

**Given** parameters sourced from environment or code that must stay deployment-managed
**When** the read-only inventory is delivered
**Then** identity and LDAP posture, session timeouts, audit-envelope policy and category paths, inference and bulk thresholds, audit-trust thresholds, pool size, and baseline boundary are listed with their current effective value and source
**And** each states its real change path in plain Persian, for example «فقط با استقرار قابل تغییر است.», rather than appearing as a disabled input that implies a missing permission
**And** no secret, credential, or connection string is rendered, in full or in part
**And** the inventory is exportable as evidence under the FR52 artifact lifecycle
**And** viewing the inventory is itself audited where the values are security-relevant

### Story 10.5: Configuration Change Control & Evidence

As an auditor,
I want every configuration change to be attributable and reversible,
So that configuration is governed like any other privileged act (FR60, FR42, FR55).

**Acceptance Criteria:**

**Given** a permitted parameter change
**When** it is applied
**Then** the audit envelope records actor, parameter, previous value, new value, reason where required, effect time, and Jalali timestamp
**And** the change is visible in the audit surface with the same evidence posture as other privileged actions
**And** reset-to-default is recorded as a change with the same evidence
**When** configuration is invalid or the store is unavailable
**Then** the system fails closed to defaults and shows the FR45 degraded state rather than operating on an unknown configuration
**And** a selfcheck proves that no registered parameter can widen a permission, retention, export, or audit boundary
**And** audit-required failure prevents or safely suspends the configuration change, consistent with FR51
