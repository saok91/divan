---
id: SPEC-divan
companions:
  - glossary.md
  - launch-artifacts.md
  - data-element-dispositions.md
  - nfr-provisional.md
  - identity-access-epic1-freeze.md
  - ../../planning-artifacts/prds/prd-divan-2026-07-11/prd.md
  - ../../planning-artifacts/prds/prd-divan-2026-07-11/addendum.md
  - ../../planning-artifacts/ux-designs/ux-divan-2026-07-13/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md
  - ../../planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Divan HRIS

## Why

The organization runs workforce records on fragmented spreadsheets that permit conflicting values, weak access boundaries, incomplete history, and headcount changes without consistent controls — a **pain to solve** for HR operators, managers, and audit reviewers who need trustworthy answers about who works here, where, what changed, and whether capacity rules hold. Divan replaces that shadow state with one governed, auditable source of truth for a **single-organization on-prem deployment** (~500 people), delivered as a Persian RTL desktop web HRIS. The mandate is explicit: migrate to effective-dated immutable personnel events, deterministic historical reconstruction, permission-scoped reporting, and headcount control so operational decisions no longer depend on uncontrolled copies.

## Capabilities

- **CAP-1**
  - **intent:** Authenticate launch users via organization LDAP/AD and authorize every protected read and mutation by explicit permission, data category, action, and Organizational Scope with default-deny semantics independent of UI visibility.
  - **success:** Disabled, locked, unmapped, or duplicate identities cannot silently bypass authentication; search, profiles, APIs, counts, reports, and exports reveal no record or field outside the caller's scope; System Admin has no routine HR-content access.

- **CAP-2**
  - **intent:** Maintain stable Person identity, non-overlapping Employment periods, and Data-Dictionary-governed profile fields including effective-dated compensation and contractual facts without performing payroll calculations.
  - **success:** Duplicate Personnel Codes are rejected; ending Employment preserves Person and permitted history; only AR-DATA-approved fields are enabled; compensation changes never calculate payroll, tax, insurance, or payment.

- **CAP-3**
  - **intent:** Govern effective-dated organization hierarchy, independent job reference concepts, Primary Assignment integrity, finite Secondary Assignment fidelity per AR-SECONDARY, and derived management relationships.
  - **success:** Every active Employment has exactly one active Primary Assignment; overlapping primaries blocked; Secondary Assignments carry required fields and do not consume headcount by default; org/reference deactivation with active dependencies blocked pending AR-TEMPORAL disposition.

- **CAP-4**
  - **intent:** Record attributable Personnel Events through Draft, Finalized, Scheduled, Effective, Cancel, Reverse, and Correction lifecycles with deterministic ordering, conflict classification, and recalculation of derived state.
  - **success:** The same authoritative event set always resolves to identical current and as-of state; Finalized events cannot be directly edited or hard-deleted; future Finalized events remain Scheduled without altering current state before Effective Date; correction chains preserve originals.

- **CAP-5**
  - **intent:** Record effective-dated starts, terminations, returns, team transfers, and independent job, contract, and compensation changes through authoritative Personnel Events subject to headcount and permission rules.
  - **success:** Future transfer finalization reserves destination capacity while current team totals unchanged; at effect, source release and destination consumption are one atomic outcome; return reuses Person and Personnel Code with new Employment; no-op transfers rejected.

- **CAP-6**
  - **intent:** Reconstruct current and historical Person, organization, and headcount state for permitted as-of dates from resolved authoritative inputs.
  - **success:** Profile, lists, dashboard, and reports reconcile for the same date, scope, filters, and metric definition; future as-of requests visibly distinguish Scheduled projections from historical facts; limitations before Baseline are disclosed.

- **CAP-7**
  - **intent:** Govern Headcount Approval lifecycle, universal Primary Assignment coverage, immediate future Reservation, atomic consumption and release, exemptions, and audited Overrides.
  - **success:** Used, reserved, free, and exception quantities remain distinct; concurrent transactions cannot consume or reserve the same last unit; failed operations leave Assignment and capacity unchanged; Overrides remain visible and never hide negative or exception capacity.

- **CAP-8**
  - **intent:** Provide permission-safe personnel search, profile with event timeline, launch dashboard, approved report catalogue, and governed export with inference-resistant retrieval controls.
  - **success:** Launch dashboard and report catalogue behaviors per FR-35–FR-36 operate with synchronized org/time filters; suppressed small cohorts show «داده قابل نمایش نیست» not zero; export requires separate sensitive permission and is audited with formula-safe artifacts.

- **CAP-9**
  - **intent:** Import approved CSV/XLSX templates through validation and preview, execute atomic Import Batches, represent Baseline separately from native events, and support signed migration reconciliation with segregated production cutover.
  - **success:** Failed import leaves no partial business or derived state; repeat input cannot silently duplicate data; production cutover blocked until owner-signed reconciliation and zero unresolved critical integrity defects.

- **CAP-10**
  - **intent:** Enforce entitlement lifecycle, unified audit envelope for business and access events, retention and legal hold, secure artifact custody, external correction-case tracking, and published decision-report reproducibility rules.
  - **success:** Sensitive reads and writes produce atomic access events; break-glass is time-bound, independently approved, and post-reviewed; required-audit failure prevents or safely suspends governed operations; overdue correction cases enter explicit breached state.

- **CAP-11**
  - **intent:** Deliver Persian-only RTL desktop web experience with Jalali business dates, shadcn/ui brand layer, unified app shell with role-filtered navigation, and explicit confirmation for sensitive actions.
  - **success:** Essential tasks remain usable from 1280×720 through 2K; unsaved-change warnings on navigate away; stale or pending recalculation disables finalize, export, and report on affected entities; non-permitted fields excluded from DOM.

- **CAP-12**
  - **intent:** Expose service, identity, import, recalculation, backup, and dependency health to authorized operators without routine access to sensitive HR content.
  - **success:** Technical logs redact LDAP secrets and unnecessary personnel data; LDAP outage presents clear Persian authentication failure; operators can confirm health and restore evidence without browsing personnel rows.

## Constraints

- Single-organization, on-premise deployment for ~500 people; no multi-tenant business capability in MVP.
- Exactly one application process and one PostgreSQL database; domain boundaries enforced by package modules, not separate services (AD-1).
- Authoritative workforce mutations persist as append-only typed business events; current and historical state are derived projections rebuilt by the temporal engine — never updated in place as source of truth (AD-2).
- `packages/kernel` owns event-store, temporal-engine, and audit-envelope; modules communicate via published APIs only; compensation facts live in a separate DB schema with a dedicated repository boundary (AD-3, AD-5).
- Migration module writes to a separate staging schema; production event-store receives Baseline only via atomic cutover after independent approval; pre-cutover rollback drops staging with zero production trace (AD-4).
- Critical headcount-affecting finalizations refresh projections synchronously in the same database transaction; heavy historical recalculation may run async via pg-boss with visible pending state (AD-6).
- T3 stack adopted and confirmed: Next.js + tRPC + Prisma (projections only) + raw SQL for kernel event-store; ESLint blocks direct `@prisma/client` in `apps/web`; no .NET/Java mandate.
- Single-server MVP deployment is accepted for initial ~500-person scale until AR-NFR defines HA or scale-out.
- Effective-date and audit clock authority default to **Asia/Tehran**; Effective Date is date-only; interval ends are **exclusive** (new state applies from the start of the Effective Date calendar day).
- Same-Effective-Date events order by registration/finalization time ascending; UUID only if times collide.
- Future as-of views use explicit planned-state semantics; Scheduled projections are never labeled Effective before their Effective Date.
- Sensitive fields outside the caller's permission are omitted from the DOM entirely (not masked).
- UI numbers use Persian digits; export of Personnel Code and national ID uses Latin digits for interchange.
- Negative financial amounts display with a minus sign, Persian digits, thousand separator, and red styling.
- Out-of-scope vs not-found search responses use identical Persian copy and uniform timing (provisional AR-ACCESS freeze).
- All twelve Launch Artifacts (AR-ACCESS through AR-CUTOVER) remain `pending` except where this SPEC or companions record a partial freeze; each still blocks its affected baseline until the owning artifact is versioned per PRD §7.2 — teams MUST NOT substitute local assumptions for unfrozen items.
- **AR-IDENTITY / AR-ACCESS Epic-1 partial freeze (2026-07-16):** Early development and tests MAY use **seeded internal accounts** with the five MVP coarse roles (HR Operator, HR Admin, Manager, Audit reviewer, System Admin) per `identity-access-epic1-freeze.md`. Live LDAP/AD integration is deferred until Infrastructure approval. **Production/launch** still requires LDAP/AD as the sole routine identity source — seeded credentials MUST NOT ship to production and MUST NOT silently bypass LDAP when LDAP mode is active.
- Immediate Reservation on future start or inbound transfer finalization is **approved**: destination capacity is reserved at finalization. When multiple Headcount Approvals match, the system defaults to the **oldest valid compatible** approval (by validity start, then creation time); an authorized user may **manually select** another compatible approval before finalize, with the choice audited. Warn at a default **14-day** horizon before linked approval expiry (AR-HEADCOUNT may retune N); if the approval is expired or incompatible at the effect point, the event stays **Scheduled in a visible exception** and applies no partial Employment, Assignment, or capacity change until authorized audited resolution. Override shortages **may show negative free capacity** and remain distinct filterable Override rows — never floor free to zero to hide the exception.
- A native Personnel Event with Effective Date earlier than Baseline is **not silently accepted**: it requires an explicit Override, mandatory Persian warning acknowledgement, and audit trail (governed Baseline revision under AR-MIGRATION remains an alternate path).
- No named privacy or records jurisdiction is presumed for MVP; AR-DATA/AR-NFR keep hooks if Legal later adds obligations.
- MVP launch profile fields are the `approve` rows in `data-element-dispositions.md` (identity set + mandatory mobile phone); remaining candidates default to `later` until explicitly promoted; religion/sect `reject` unless Legal revises.
- Operational acceptance uses provisional values in `nfr-provisional.md` (2s/3s/5s, WCAG 2.2 AA, Chromium + Firefox ESR, RPO 24h / RTO 8h, ~500 people) until formal AR-NFR versioning; Ops/Security may retune before production.
- MVP excludes employee self-service; organization must define external data-subject transparency process before launch.

## Non-goals

- Payroll, payslips, tax, insurance calculation, or salary payment.
- Attendance, leave, mission, recruitment/ATS, and promotion request/committee workflow engines.
- Employee self-service, mobile or tablet dedicated experience, and bilingual UI.
- Interactive organization chart, advanced or predictive analytics, and saved personal report filters.
- Workstation registry, floor-map visualization, coded seating assignment, and who-sits-where views.
- General personnel document management beyond bounded FR-53 correction-case attachments approved in AR-DATA.
- Multi-tenant architecture, automated downstream integration with payroll/finance/directory (governed exports are the launch interchange surface).
- Generic unrestricted Viewer access and **production** local identity that bypasses LDAP/AD (seeded accounts are allowed only in non-production per `identity-access-epic1-freeze.md`).

## Success signal

Production go-live is demonstrably safe when all six hard launch gates (LG-1 reconciliation through LG-6 acceptance readiness) pass with evidence against version-frozen Launch Artifacts, and authorized HR users can answer — from Divan alone, within their scope — who currently works for the organization, in what team and role, what personnel events are Scheduled versus Effective, and whether Primary Assignments fit approved headcount without reconciling spreadsheets. Post-launch, SM-1 through SM-6 metrics (reconciliation defects, governed digital completion, spreadsheet retirement, task quality, headcount Override rate, meaningful adoption) are measured at 30/60/90 days with counter-metrics SM-C1 through SM-C5 guarding against quality or security regressions.

## Assumptions

- UX design floor (WCAG 2.2 AA intent, component behaviors) is committed; formal measurement evidence still due at AR-NFR production gate.
- Exact LDAP topology, bind account, MFA, and session timeouts await Infrastructure approval and formal AR-IDENTITY; until then development uses seeded accounts per `identity-access-epic1-freeze.md`. Product still requires LDAP/AD as sole routine identity source at launch.

## Open Questions

<!-- Deferred — non-blocking for epic slicing; still block formal baselines/production per PRD §7.2 until owners version artifacts -->

- Formal Launch Artifact versioning/sign-off for AR-TEMPORAL, AR-HEADCOUNT, AR-DATA, AR-NFR (product partial freezes exist; artifacts still `pending`).
- AR-ACCESS exact field matrix (coarse roles frozen for Epic 1); AR-AUDIT schema; AR-IDENTITY LDAP details post-infra approval; AR-MIGRATION templates; AR-REPORTING formulas; AR-SECONDARY inventory; AR-CUTOVER plan.
- Pre-Baseline Override approver role and exact warning copy; Employment/contract/compensation field enablement beyond identity+mobile; FR-53 attachment allowlist.
