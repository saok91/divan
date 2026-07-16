---
title: Divan HRIS
status: final
created: 2026-07-11
updated: 2026-07-16
---

# PRD: Divan HRIS

## 0. Document Contract and Status

This PRD is the authoritative product-scope contract for the first organizational deployment of Divan HRIS. It is written for product, HR, security, legal, infrastructure, data, UX, architecture, delivery, and acceptance owners. It defines business outcomes and testable capabilities; implementation options, detailed data attributes, delivery sequencing, and test inventories are intentionally separated into `addendum.md`.

**Document status and interpretation:** `final`. This status finalizes the product-scope contract; it does not mark pending Launch Artifacts as approved. Every Launch Artifact is explicitly `pending`; an unresolved artifact blocks the affected baseline at the staged gate in §§7.1–7.2, not only production launch. No inline assumptions are used. Initial scale (~500 people), single-organization on-premise deployment, Persian RTL desktop UI, and source-defined business boundaries are declared inputs rather than inferred assumptions.

## 1. Product Strategy

### 1.1 Purpose

Replace fragmented spreadsheet-based personnel records with one controlled, auditable source of truth for the organization's current and historical workforce state.

### 1.2 Vision

Authorized people can confidently answer who works for the organization, where and in what capacity they work, what changed and when, and whether primary assignments fit approved headcount. Divan preserves attributable history while making current operational state fast to find and reconcile.

In a later phase after MVP, Divan should also support coded physical **Workstations**, floor-map visualization, and **Workplace Placement** so authorized users can see who sits where and which workstation each person uses. That capability is out of MVP scope but informs forward-compatible domain and data design; see `addendum.md` §§14.4 and 15.

### 1.3 Problem

Spreadsheet copies permit conflicting values, accidental overwrites, weak access boundaries, manual reconciliation, incomplete history, and capacity changes without consistent controls. These weaknesses make routine HR operations slower and management reporting less trustworthy while exposing sensitive personnel data.

### 1.4 Product Thesis

Governed migration plus effective-dated, immutable personnel events, deterministic historical reconstruction, permission-scoped reporting, and headcount control will create trusted workforce state and reduce reliance on uncontrolled spreadsheets.

### 1.5 Outcome Chain

Approved data definitions and clean migration → reliable event entry and temporal state → reconciled person, organization, and headcount views → trusted operational decisions and reduced shadow records.

## 2. Glossary

- **Person (فرد):** stable human identity that survives termination and return; distinct from Employment.
- **Personnel Code (کد پرسنلی):** stable organization-issued identifier reused when a Person returns, subject to an approved correction policy.
- **Employment (دوره همکاری):** effective-dated period in which a Person works for the organization. MVP permits at most one active Employment per Person at an instant.
- **Assignment (تخصیص/سمت سازمانی):** effective-dated placement carrying organization, role, title, ladder, grade, seniority, and primary/secondary status as applicable.
- **Primary Assignment (تخصیص اصلی):** the single active Assignment that defines current team membership for an active Employment and normally consumes headcount.
- **Secondary Assignment (تخصیص ثانویه):** an additional concurrent Assignment with a reason/type; it does not consume headcount in the MVP AR-SECONDARY inventory.
- **Organizational Unit (واحد سازمانی):** Legal Entity, Business Unit, Department, or Team in the governed hierarchy.
- **Organizational Role (نقش سازمانی):** responsibility/function, distinct from Job Title.
- **Job Title (عنوان شغلی):** job classification used in Assignment and headcount matching.
- **Ladder (لدر/مسیر شغلی):** ordered grade family; a Grade belongs to one Ladder.
- **Grade (گرید):** level within a Ladder, including configured half-grades.
- **Seniority (ارشدیت):** independently managed experience/seniority classification.
- **Personnel Event (رویداد پرسنلی):** attributable, effective-dated business change that may alter derived workforce state.
- **Draft:** editable, non-authoritative Personnel Event.
- **Finalized / Authoritative:** accepted Personnel Event that cannot be directly edited or hard-deleted.
- **Scheduled:** Finalized future Personnel Event; authoritative but not yet reflected in current state.
- **Effective:** Finalized Personnel Event whose effective point has been reached and whose valid outcome contributes to evaluated state.
- **Cancel:** pre-effect neutralization of a Scheduled Personnel Event.
- **Reverse:** post-effect compensating neutralization of an Effective Personnel Event.
- **Correction:** linked replacement/correction chain that preserves the original Personnel Event and produces one deterministic resolved outcome.
- **Effective Date:** business date on which a state change applies; distinct from registration and finalization time.
- **Baseline (خط مبنا):** approved migrated state at the start of reliable reconstructable history.
- **Headcount Approval (مجوز جذب/ظرفیت):** effective authorization for a pooled number of Primary Assignments by Team, Job Title, and optional Seniority.
- **Reservation:** future capacity claim created by a Finalized start or inbound transfer before its Effective Date.
- **Override:** explicitly permitted exception to a headcount rule, with reason, context, actor, and audit.
- **Data Element:** a governed field, attribute, derived measure, metadata type, free-text class, filter parameter, error-data class, or artifact schema processed by Divan. Concrete values inherit the governing Data Element's classification and lifecycle; a value is tracked individually only where an FR requires instance evidence.
- **Data Dictionary:** versioned catalogue governing every Data Element's purpose, owner, authoritative source, format, sensitivity, lineage, access, retention, export, and audit treatment.
- **Import Batch:** attributable, traceable unit of migrated data and its validation/reconciliation evidence.
- **Organizational Scope:** population boundary a user may access, such as specified Team, Department, Legal Entity, or approved management hierarchy.
- **Workstation (ایستگاه کاری):** a uniquely coded physical desk or seat within a defined floor or site; distinct from Organizational Assignment and from free-text work location on a profile.
- **Workstation Code (کد ایستگاه کاری):** stable identifier for one Workstation within the organization boundary; used for placement, search, and map display.
- **Floor Map (نقشه طبقه/محل):** a governed visual representation of a floor or site showing Workstation positions and their codes.
- **Workplace Placement (جانمایی/تخصیص ایستگاه):** effective-dated association of a Person to one primary Workstation at an instant; historical placement may be retained for as-of views.

## 3. Actors and Jobs to Be Done

- **HR Admin:** maintain authoritative records, organization/reference data, headcount policy, migration, permissions, and exceptional corrections without destroying history.
- **HR Operator:** complete routine starts, terminations, returns, transfers, and permitted changes accurately, including past- and future-dated work.
- **Manager / Management Consumer:** find and analyze only the people, fields, reports, and organizational populations explicitly permitted for the manager's approved management purpose and scope.
- **Audit / Security Reviewer:** investigate access, change, import, export, override, and privileged activity independently of ordinary HR administration.
- **System Admin:** operate identity, configuration, health, backup, and recovery without routine access to HR content.
- **HR/Product Owner:** approve definitions, policies, reconciliation, acceptance evidence, metrics, and go-live.
- **Legal / Privacy / Information Security:** approve collection purpose, classification, access, retention, export, audit, privileged access, and jurisdiction-specific obligations.
- **Infrastructure / Operations:** provide and operate the on-premise identity, network, TLS, compute, storage, monitoring, backup, and recovery environment.
- **Employee as data subject:** has no self-service surface in MVP; the organization must nevertheless define an external transparency and correction-request process before launch.

## 4. Key User Journeys

- **UJ-1. Mina records a future transfer without corrupting today's team totals.** Mina, an HR Operator, finds the employee, reviews current assignment and destination capacity, enters a future transfer, and resolves any blocking conflict. Finalization makes the event authoritative and reserves destination capacity, while today's profile and team counts remain unchanged. On the effective date, source release and destination consumption occur atomically and the timeline explains both states.
- **UJ-2. Reza corrects an effective personnel change without rewriting history.** Reza, an HR Admin, opens the event timeline, reviews before/after values and dependent events, supplies a reason, and creates a linked correction. The original remains visible, recalculation is deterministic, and the resulting current and historical states reconcile.
- **UJ-3. Sara investigates staffing within her approved scope.** Sara, a manager, searches her permitted organizational population, views only approved profile categories, checks team membership and headcount, and runs a filtered report. A sensitive export is unavailable unless she separately holds export permission; any permitted export is audited.
- **UJ-4. Niloofar and independent migration actors prove cutover safety.** Niloofar prepares and uploads the approved template, then reviews row-level validation errors, warnings, mappings, and control totals. For a sensitive production batch whose contents are frozen, an independent approver verifies the batch, version, and evidence and authorizes execution; a separately authorized executor performs production execution without changing the approved contents. The actors reconcile people, Employments, Assignments, event history, Team totals, and headcount to signed controls. Trial and UAT batches follow the segregation tier approved in AR-MIGRATION; production remains blocked until every exception and required approval is resolved.
- **UJ-5. Arman operates the service without browsing HR records.** Arman, a System Admin, monitors identity connectivity and service health, verifies backup and restore evidence, and troubleshoots using redacted technical logs. Any emergency access to HR content is time-bound, explicitly approved, and reviewed.

## 5. Scope Boundaries

### 5.1 In Scope

- Single-organization, on-premise, Persian RTL desktop web deployment for the initial workforce (approximately 500 people).
- LDAP/AD authentication; granular default-deny authorization; privileged access controls.
- Person, Employment, governed profile fields, organization/reference data, Primary Assignments, and only the Secondary Assignment capability required for current-data fidelity.
- Effective-dated starts, terminations, returns, transfers, role/title/seniority/grade/compensation/contract changes, and required Secondary Assignment changes.
- Draft, Finalized, Scheduled, Effective, Cancel, Reverse, Correction, conflict handling, deterministic recalculation, current and historical Person state.
- Core historical Team/organization/headcount counts.
- Headcount Approval, mandatory Primary Assignment coverage, Reservation, atomic movement, exemption, and Override.
- Permission-safe search, profile/timeline, core dashboard, approved reports, governed export.
- CSV/XLSX Baseline/partial-history migration, provenance, reconciliation, audit, and operational readiness.
- Cross-cutting launch controls in FR-46–FR-56: entitlement and identity lifecycle; temporal/cross-boundary authorization; inference/bulk controls; retention/legal hold; audit trust; secure artifact/custody lifecycle; external correction-case evidence; formal-report reproducibility; artifact change control; and snapshot/reference integrity.
- FR-53 stores correction evidence as references/metadata by default; only AR-DATA-approved bounded attachments are in scope, never general personnel document management.

### 5.2 Deferred

- Broader Secondary Assignment workflows not required by current data.
- Saved/personal report filters and reports outside the approved launch catalogue.
- Multi-tenant architecture features; readiness considerations are non-MVP and non-authoritative in `addendum.md`.
- Notifications beyond identity/technical needs approved for launch.
- Workstation registry, coded seating assignment, floor-map visualization, and who-sits-where views.

### 5.3 Non-Goals

- Payroll, payslips, tax, insurance calculation, or salary payment.
- Attendance, leave, and mission management.
- Recruitment/ATS before Employment start.
- Promotion request, committee, approval, or general workflow engine; only final outcomes are recorded.
- Employee self-service or employee-facing correction workflow.
- Interactive organization chart and advanced/predictive analytics.
- Mobile application or dedicated tablet experience; bilingual UI.
- General personnel document/file management. Only bounded FR-53 correction-case attachments explicitly approved under AR-DATA are allowed in MVP.
- Generic unrestricted Viewer access.
- Multi-tenant business capability for MVP.
- Technical stack, database, event-storage, projection, or deployment-topology selection.
- Automated downstream integration with payroll, finance, insurance, directory provisioning, data warehouse, or other consumers; governed exports are the launch interchange surface unless Product explicitly changes scope. AR-CUTOVER must still govern any temporary manual handoff and prevent a second uncontrolled source of truth.
- Workstation Code assignment, floor-map management, interactive seating maps, and who-sits-where operational views. MVP may retain free-text or reference **work location/site** on a profile where AR-DATA approves it; that field does not substitute for coded Workstations or map-based placement.

## 6. Dependencies

- Organization-approved LDAP/AD, secure bind/trust, identity attributes, lifecycle behavior, connectivity, and acceptance environment under AR-IDENTITY.
- On-premise network, TLS certificates, compute, storage, time synchronization, monitoring, backup, and recovery capabilities.
- HR-approved organization/reference data, Data Dictionary, access matrix, temporal/headcount/reporting semantics, and Baseline; canonical decision state is recorded in §7.
- Cleaned source files, mapping/transformation rules, trial migrations, control totals, exception owners, and cutover/rollback authority.
- Security, Legal/Privacy, HR, Product, Infrastructure, Business Continuity, and domain-owner availability for staged approvals.

## 7. Launch Artifacts and Decision Stages

### 7.1 Canonical Launch Artifact Register

Every artifact below is a versioned acceptance dependency governed by FR-55. This draft honestly records all artifacts as pending. “Before architecture baseline” means absence blocks that architecture baseline. “Before feature baseline” means exact values, matrices, formulas, test oracle, and scenario inventory must exist before affected stories are baselined or built. Production verifies evidence against the already frozen versions.

- **AR-ACCESS — Access, Entitlement, Break-glass, Bulk and Inference Policy**
  - **State:** `status=pending; version=pending; location=pending; effective=pending; expiry=pending`
  - **Owner / approvers:** Security / HR Data Owner, Legal/Privacy, independent Security approver
  - **Due:** invariants and temporal scope before authorization/reporting architecture baseline; exact matrix, toxic combinations, thresholds, finite revocation objective, and tests before affected feature baseline; evidence before production
  - **Affects:** FR-1–FR-4, FR-33–FR-36, FR-41, FR-46–FR-48, FR-50–FR-53; NFR-7
  - **Open decisions:** exact field/category × action × Organizational Scope/time matrix; delegation; toxic combinations; entitlement/revocation bounds; sensitive/bulk thresholds; inference protection; break-glass; independent review; duplicate/acting/interim/co-manager, senior-manager scope, reorganization, and Organizational Unit disposition jointly with AR-TEMPORAL
- **AR-TEMPORAL — Effective-Time and Event Resolution Contract**
  - **State:** `status=pending; version=pending; location=pending; effective=pending; expiry=pending`
  - **Owner / approvers:** Product / HR Domain Owner, Architecture
  - **Due:** date/time boundaries, ordering, chain, dependency, future as-of, Baseline boundary, and fail-safe semantics before temporal architecture baseline; exact scenarios/oracles before event/report story baseline; replay/reconciliation evidence before production
  - **Affects:** FR-6, FR-9–FR-11, FR-14–FR-27, FR-30–FR-31, FR-45, FR-54, FR-56
  - **Open decisions:** reorganization/reference validity; published-report supersession trigger; management and Organizational Unit cases jointly with AR-ACCESS; remaining scenario/oracle inventory. **Product partial freeze (2026-07-16, recorded in SPEC-divan):** Asia/Tehran; Effective Date date-only; exclusive interval ends; same-date order by registration/finalization time; future as-of = planned not Effective; pre-Baseline native events allowed only via Override with mandatory Persian warning acknowledgement and audit (governed Baseline revision remains an alternate path under AR-MIGRATION).
- **AR-HEADCOUNT — Headcount Policy and Acceptance Oracle**
  - **State:** `status=pending; version=pending; location=pending; effective=pending; expiry=pending`; immediate Reservation trade-off **product-approved 2026-07-16** (formal AR version still pending)
  - **Owner / approvers:** Workforce Planning / HR/Product, Finance or designated authority
  - **Due:** matching, Reservation trade-off, validity/dependency, exemption/Override, and numeric semantics before headcount architecture baseline; exact scenarios before feature baseline; concurrency/reconciliation evidence before production
  - **Affects:** FR-20–FR-23, FR-27–FR-32, FR-35–FR-36, FR-45
  - **Open decisions:** formal AR versioning/sign-off; exact escalation owners; historical over-capacity oracle. **Product partial freeze (2026-07-16, SPEC-divan):** immediate Reservation at finalize; default match oldest valid compatible approval (validity start then creation) with audited manual reselection; 14-day expiry warning then Scheduled exception with no partial apply; Override may show negative free and distinct Override rows.
- **AR-DATA — Data Dictionary and Lifecycle Register**
  - **State:** `status=pending; version=pending; location=pending; effective=pending; expiry=pending`
  - **Owner / approvers:** HR Data Owner / Legal/Privacy, Security
  - **Due:** categories, processing purpose, ownership/source, retention classes, disposal/hold, bounded-attachment safety, formal-report post-disposal outcome, non-production and backup boundaries before data architecture baseline; exact Data Elements and tests before feature/migration baseline; approved inventory and lifecycle evidence before production
  - **Affects:** FR-3, FR-5, FR-7–FR-8, FR-14, FR-20, FR-24–FR-26, FR-33–FR-42, FR-50, FR-52–FR-54; NFR-6, NFR-8–NFR-9
  - **Open decisions:** Data Element dispositions; purpose/authority; lifecycle classes; legal holds; correction cases and bounded-attachment safety; formal-report post-disposal evidence/status; non-production/backup/copy treatment; free text; derived-data classification; Personnel Code correction, duplicate merge/split, return matching, concurrent-Employment exceptions, and Baseline revision jointly with AR-MIGRATION; jurisdiction-specific legal/records obligations jointly with AR-NFR — **Product confirmed 2026-07-16: no named regime presumed for MVP** (hooks remain if Legal later adds obligations)
- **AR-IDENTITY — Identity and Account Lifecycle Contract**
  - **State:** `status=pending; version=pending; location=pending; effective=pending; expiry=pending`
  - **Owner / approvers:** Infrastructure/Identity / Security, HR
  - **Due:** identity/link/cardinality/lifecycle/outage/break-glass invariants before identity architecture baseline; mappings, evidence, precedence, finite revocation/session objectives, and tests before feature baseline; directory acceptance evidence before production
  - **Affects:** FR-1, FR-4, FR-46, FR-49; NFR-1, NFR-7
  - **Open decisions:** LDAP/AD topology; secure bind/trust; attributes; mapping precedence; outage/failover; session lifecycle; MFA/conditional access; emergency account
- **AR-AUDIT — Audit Envelope and Review Contract**
  - **State:** `status=pending; version=pending; location=pending; effective=pending; expiry=pending`
  - **Owner / approvers:** Security/Audit / independent Audit authority, Legal/Privacy, HR Data Owner
  - **Due:** mandatory event/read envelope, trust boundary, minimization, failure, retention/hold, and independence before audit architecture baseline; exact schema/redaction/alerts/tests before feature baseline; integrity/review evidence before production
  - **Affects:** FR-14–FR-15, FR-32, FR-38, FR-41–FR-42, FR-46, FR-48, FR-50–FR-53, FR-55; NFR-9–NFR-10
  - **Open decisions:** exact mandatory event/read envelope; minimization/redaction; fail-safe behavior; integrity/clock anomaly; review cadence; retention/hold; independent reviewer
- **AR-MIGRATION — Migration, Baseline, Import and Reconciliation Contract**
  - **State:** `status=pending; version=pending; location=pending; effective=pending; expiry=pending`
  - **Owner / approvers:** Data Migration Lead / HR Data Owner, Security, Product
  - **Due:** Baseline semantics, risk tiers, atomicity boundary, confidentiality/duties, cutover dependencies, and tolerance governance before migration architecture baseline; templates, mappings, conflict/replay tests, and reconciliation oracle before migration build; signed batch evidence before production
  - **Affects:** FR-5–FR-7, FR-15, FR-18, FR-25–FR-27, FR-37–FR-40, FR-50, FR-52, FR-56
  - **Open decisions:** Personnel Code correction, duplicate merge/split, return matching, concurrent-Employment exceptions, Baseline revision, template/version/idempotency, batch atomicity, warnings, tolerances, evidence, and rollback jointly with AR-DATA
- **AR-REPORTING — Search, Metric, Report, Publication and Decision Catalogue**
  - **State:** `status=pending; version=pending; location=pending; effective=pending; expiry=pending`
  - **Owner / approvers:** Product Analytics / HR/Product, Security, Legal/Privacy
  - **Due:** metric semantics, permission-time policy, bulk/inference invariants, lawful reproducibility package or `non-reproducible-after-disposal` outcome before reporting architecture baseline; formulas, granularities, thresholds, report/search scenarios, and 30/60/90 targets before feature baseline; reconciliation/security evidence before production
  - **Affects:** FR-25–FR-27, FR-33–FR-36, FR-41, FR-47–FR-48, FR-54; SM-1–SM-6 and counter-metrics
  - **Open decisions:** formulas; populations; granularity; decision-publication lifecycle and post-disposal reproducibility/status; baseline method; numeric launch/30/60/90 targets; remediation/stop conditions; telemetry privacy
- **AR-NFR — Operational and Security Acceptance Profile**
  - **State:** `status=pending; version=pending; location=pending; effective=pending; expiry=pending`
  - **Owner / approvers:** Operations / Product, Security, Business Continuity, Infrastructure
  - **Due:** every acceptance threshold plus workload/environment/measurement bounds before the earliest affected architecture, delivery, or feature baseline; production only verifies evidence against that version; later change requires FR-55 impact assessment and rebaseline
  - **Affects:** NFR-1–NFR-14; FR-45, FR-49–FR-52
  - **Open decisions:** formal Ops/Security/BC versioning and sign-off; HA; exact session timeouts (with AR-IDENTITY); hardware sizing; cipher/pen-test detail. **Product provisional freeze (2026-07-16, SPEC `nfr-provisional.md`):** page ≤2s / search ≤3s / dashboard ≤5s; WCAG 2.2 AA light+dark; Chromium-family + Firefox ESR; RPO ≤24h / RTO ≤8h; scale ~500; no named jurisdiction for MVP.
- **AR-SECONDARY — Secondary Assignment Launch Inventory**
  - **State:** `status=pending; version=pending; location=pending; effective=pending; expiry=pending`
  - **Owner / approvers:** HR Domain Owner / Product, HR Data Owner, Workforce Planning
  - **Due:** finite scenarios, fields, conflicts, import/report treatment, and non-goals before Assignment feature baseline; acceptance evidence before production
  - **Affects:** FR-12, FR-25–FR-27, FR-34, FR-37–FR-40
  - **Open decisions:** finite launch scenarios and data/report/import/conflict inventory
- **AR-CUTOVER — Cutover, Parallel Operation, Rollback and Acceptance Plan**
  - **State:** `status=pending; version=pending; location=pending; effective=pending; expiry=pending`
  - **Owner / approvers:** Product/HR Cutover Lead / HR, Migration, Operations, Security, Business Continuity
  - **Due:** freeze/delta/authority/rollback/parallel-source/recovery-catch-up invariants before cutover rehearsal baseline; exact triggers, point of no return, reconciliation and evidence before rehearsal; signed readiness before production
  - **Affects:** FR-37–FR-40, FR-45, FR-50–FR-52, FR-55–FR-56; NFR-6; LG-1–LG-6
  - **Open decisions:** freeze; delta migration; parallel-source conflict; rollback trigger/authority; point of no return; operational recovery; signers

### 7.2 Authoritative Decision Stages

1. **Before an affected architecture baseline:** approve the minimum product invariants for access/temporal scope, entitlement and break-glass, data categories/retention classes, audit envelope, non-production/backup boundaries, identity lifecycle, bulk/inference, and core temporal/headcount semantics. AR-NFR values that can change architecture or delivery are also due here. Missing approval blocks that baseline; teams MUST NOT substitute local assumptions.
2. **Before an affected feature/story baseline or build:** approve the exact matrix, values, formula/metric, conflict classification, test oracle, scenario inventory, and acceptance evidence format for that feature. Missing detail blocks baselining and build of the affected stories.
3. **Before production:** demonstrate implementation evidence against the version-frozen artifacts, close or validly waive findings, complete restore/security/migration/cutover acceptance, and obtain required independent sign-off. Production does not set or change acceptance thresholds; a signature cannot cure a missed upstream gate.

## 8. Product Capabilities and Functional Requirements

### 8.1 Identity, Authorization, and Access Boundaries

Divan is default-deny. Permission, data category, action, and Organizational Scope jointly determine access. A generic Viewer permission never grants sensitive access.

#### FR-1: Enterprise authentication
The system MUST authenticate launch users against the organization-approved LDAP/AD identity source and link each accepted identity to one internal account.

**Consequences (testable):**
- Disabled, locked, expired, removed, duplicate, or unmapped identities follow AR-IDENTITY and cannot silently bypass authentication.
- The application never stores a user's LDAP password and presents a clear Persian failure when authentication is unavailable.

#### FR-2: Backend-enforced least privilege
The system MUST authorize every protected read and mutation by explicit permission, data category, action, and Organizational Scope independently of UI visibility.

**Consequences (testable):**
- Search results, filter values, counts, profiles, APIs, reports, and exports reveal no record or field outside scope.
- No generic Viewer, manager, management, HR, or System Admin label grants sensitive data by default.

#### FR-3: Segregated sensitive and export permissions
The system MUST separately govern compensation, identity, contact, family, health, religion, bank, insurance, contractual, termination, and other approved sensitive categories, and MUST separately authorize sensitive export.

**Consequences (testable):**
- View permission does not imply export permission.
- System Admin has no routine HR-content access; approved elevation is time-bound, reasoned, audited, and reviewed.
- Religion/sect, health/physical condition, family/dependant, bank, insurance, national identifier, compensation, and similarly sensitive categories remain disabled by default until AR-DATA records category-specific purpose, necessity, owner/source, access/export, retention, audit, and Legal/Privacy/Security disposition.

#### FR-4: Governed access administration
Authorized administrators MUST manage roles, permissions, scopes, account links, and active status, with all changes attributable and reviewable.

**Consequences (testable):**
- No role grants capabilities beyond its explicit permission set.
- AR-ACCESS governs the exact matrix, grant authority, entitlement review, toxic combinations, and break-glass; its missed upstream timing blocks the affected baseline under §7.2.

### 8.2 Person, Employment, and Approved Profile Data

#### FR-5: Stable Person identity
Authorized HR users MUST create and maintain a stable Person with unique Personnel Code and approved identity keys.

**Consequences (testable):**
- Duplicate Personnel Codes are rejected; duplicate national IDs are rejected when that field is approved and present.
- Ending Employment preserves the Person and permitted history; empty optional values are not represented as zero, verified absence, or not applicable.
- Personnel Code correction, duplicate merge, erroneous-merge split, and return matching are blocked until AR-DATA/AR-MIGRATION provide a testable identity-preserving policy; no operation may silently combine or detach Employment, compensation, access, or headcount history.

#### FR-6: Employment lifecycle
The system MUST maintain non-overlapping historical Employments and enforce at most one active Employment per Person at any instant in MVP.

**Consequences (testable):**
- Start requires the approved minimum Person, Employment, organization, and Primary Assignment facts.
- Return reuses the Person and Personnel Code, creates a new Employment and Primary Assignment, and preserves all prior history.

#### FR-7: Data-Dictionary-governed profile
The system MUST enable only fields approved in the Data Dictionary and display current and historical profile categories according to access permission.

**Consequences (testable):**
- Presence in a source spreadsheet alone does not enable a field.
- Every enabled or migrated Data Element has approved purpose, owner/source, format, sensitivity, access, retention, export, and audit classification in AR-DATA before enablement or production migration.
- Subsequent changes to Data Element ownership, authoritative source, classification, purpose, or lifecycle require governed versioning and approval under FR-55 before effect.
- Free text is purpose-limited and access-controlled; derived/inferred Data Elements retain lineage and cannot be classified below their most sensitive material input without an approved assessment.
- A change to a Data Element that affects historical workforce state occurs through the AR-TEMPORAL-governed authoritative history rather than an untracked overwrite.

#### FR-8: Compensation and contractual facts
The system MUST retain approved effective-dated compensation and contractual facts without performing payroll calculations.

**Consequences (testable):**
- Authorized users can distinguish current and historical values and their provenance.
- Compensation changes do not calculate payroll, tax, insurance, payslips, or payment.

### 8.3 Organization, Reference Data, and Assignments

#### FR-9: Governed organization hierarchy
HR Admin MUST manage effective-dated Legal Entities, Business Units, Departments, and Teams in the hierarchy Legal Entity → Business Unit → Department → Team.

**Consequences (testable):**
- Units can be activated/deactivated without erasing history.
- Deactivation with active members or future Assignment, Personnel Event, Reservation, or reporting dependencies is blocked until AR-TEMPORAL and AR-HEADCOUNT define and record a valid disposition; historical reports retain the former hierarchy.
- At every evaluated date, a child Organizational Unit's validity interval MUST fall within its required parent's validity interval; retroactive re-parenting that would create an impossible hierarchy is blocked or corrected through the authoritative temporal process.

#### FR-10: Independent job concepts
HR Admin MUST manage Organizational Role, Job Title, Ladder, Grade, and Seniority as distinct reference concepts.

**Consequences (testable):**
- Grade selection is limited to the chosen Ladder, including configured half-grades.
- The product imposes no universal Grade-to-Seniority mapping.
- Deactivating or changing a Role, Job Title, Ladder, Grade, or Seniority used by an Assignment or Personnel Event that is active or Scheduled is blocked until all dependencies have an AR-TEMPORAL-approved disposition.

#### FR-11: Primary Assignment integrity
Every active Employment MUST have exactly one active Primary Assignment at an instant, and changes MUST occur through authoritative Personnel Events.

**Consequences (testable):**
- Overlapping Primary Assignments are blocked.
- Primary Assignment determines Team membership and carries the approved organization/job facts needed for current and historical state.

#### FR-12: Secondary Assignment fidelity
The MVP MUST represent, migrate, view, create, change, and end the finite Secondary Assignment scenarios approved in AR-SECONDARY to preserve and maintain current organizational data already used by the organization.

**Consequences (testable):**
- Each Secondary Assignment has the AR-SECONDARY-required fields, reason/type, active Employment coverage for its full effective interval, and historical visibility.
- An equivalent Secondary Assignment for the same Person, organizational target, reason/type, and overlapping interval is rejected.
- Secondary Assignments do not consume headcount by default; expanded secondary-work workflows are outside MVP.

#### FR-13: Management relationships
The system MUST derive and report approved management relationships from governed Assignment and organization facts.

**Consequences (testable):**
- A configured middle-manager Primary Assignment can identify the Team manager; senior-manager Assignment may target approved organization levels.
- AR-ACCESS and AR-TEMPORAL MUST define duplicate, acting, interim, co-manager, reorganization, and manager-scope behavior before management/reporting authorization baselines; ambiguity fails closed for access.

### 8.4 Personnel Event Lifecycle and Temporal Resolution

#### FR-14: Common attributable event record
Every Personnel Event MUST retain unique identity, type, Person, applicable Employment, Effective Date, registration actor and time, finalization actor and time, status, reason/reference, provenance, and authorized before/after evidence.

**Consequences (testable):**
- Effective Date and registration/finalization time are visibly distinct.
- Sensitive values are not unnecessarily duplicated into audit evidence.

#### FR-15: Draft and finalization
The system MUST let authorized users create, edit, and delete Drafts and MUST permit HR Admin or explicitly permitted HR Operator to finalize routine valid Drafts without a universal secondary approval. Sensitive/high-impact actions MUST follow the controls for their AR-ACCESS/AR-AUDIT/AR-MIGRATION-defined risk tier before becoming authoritative or Effective.

**Consequences (testable):**
- Finalization checks permission, required data, temporal/domain conflicts, and headcount.
- Finalization revalidates all referenced Person, Employment, organization, job, permission, and headcount facts against one authoritative evaluation point; stale or newly invalid references block finalization.
- Repeating the same finalization request produces at most one authoritative Personnel Event; concurrent edit, deletion, and finalization resolve atomically so a deleted Draft cannot become authoritative and a successful finalization cannot be hidden by deletion.
- At minimum, termination, compensation change, retroactive change beyond the approved window, high-impact headcount Override, and production bulk import require independent pre-authorization or remain non-authoritative and non-effective pending independent review. Exact thresholds, scenarios, reviewers, and oracles MUST be version-frozen in AR-ACCESS/AR-AUDIT/AR-MIGRATION before the affected feature baseline.
- Ordinary HR work that is outside the approved sensitive/high-impact tiers retains the source intent of no universal second approval; it remains attributable and subject to risk-based audit/review.
- A Finalized event cannot be directly edited or hard-deleted.

#### FR-16: Authoritative versus effective state
A future Finalized Personnel Event MUST enter Scheduled state and remain authoritative without altering current state before its Effective Date.

**Consequences (testable):**
- As-of evaluation includes only valid Finalized events effective at or before the evaluation point.
- Current views distinguish Scheduled changes from Effective state.

#### FR-17: Cancel, Reverse, and Correction
Authorized users MUST neutralize Scheduled events with Cancel, Effective events with Reverse, and factual errors with a linked Correction chain while preserving originals.

**Consequences (testable):**
- Every action requires permission and reason and references the affected event.
- A Correction cannot reference itself or create a cycle; invalid chains are blocked.
- A Cancel racing the event's effective transition has one atomic outcome: either pre-effect Cancel succeeds with no effect applied, or effect wins and post-effect Reverse/Correction rules apply—never both.
- Timeline displays original, neutralization/correction links, statuses, and resolved result; repeated corrections resolve deterministically under AR-TEMPORAL.

#### FR-18: Deterministic ordering and recalculation
The system MUST produce the same current and historical state from the same authoritative event set, including same-Effective-Date and retroactive events.

**Consequences (testable):**
- A documented deterministic ordering rule resolves same-date collisions: registration/finalization time ascending; UUID only if times collide (Asia/Tehran; Effective Date date-only; exclusive interval ends — SPEC-divan / AR-TEMPORAL partial freeze 2026-07-16).
- Past-dated change, Cancel, Reverse, or Correction recalculates all affected derived state from the earliest affected point and exposes failure/staleness rather than silently serving inconsistent data.
- A native Personnel Event earlier than the Baseline is not silently accepted: it requires an explicit Override, mandatory Persian warning acknowledgement, and audit. A governed Baseline revision under AR-MIGRATION remains an alternate path. The system never invents a reconstructable state before the approved boundary without one of those governed paths.

#### FR-19: Conflict handling
Before finalization, the system MUST classify known conflicts as blocking or warning under AR-TEMPORAL and explain the consequence in Persian.

**Consequences (testable):**
- Blocking cases include overlapping Employments/Primary Assignments, invalid dates or Ladder–Grade, inactive Employment changes, unapproved headcount consumption, broken correction references, and irreconcilable dependent-event ordering.
- A warning can proceed only where policy explicitly allows it and the system records the user's acknowledgement or Override.

### 8.5 Core Personnel Changes

#### FR-20: Start and return
Authorized HR users MUST record effective-dated starts and returns that create one Employment and one Primary Assignment against applicable headcount.

**Consequences (testable):**
- HR Operator cannot finalize without compatible capacity; only HR Admin can use an approved Override.
- Return preserves prior Person, Personnel Code, Employments, Assignments, and Personnel Events.
- If the former Person was anonymized, return matching uses an AR-DATA-approved non-identifying rehire token or verified manual rematch with independent evidence/audit; it never silently restores disposed identity values.

#### FR-21: Termination
Authorized HR users MUST record an effective-dated termination that ends active Employment and Assignments and releases associated headcount at effect.

**Consequences (testable):**
- Date and reason are retained.
- Incompatible future events are identified and must be explicitly disposed of before finalization.

#### FR-22: Team transfer
Authorized HR users MUST record an effective-dated transfer that replaces the source Primary Assignment with a destination Primary Assignment.

**Consequences (testable):**
- At the effective point, source release and destination consumption are one atomic business outcome; failure leaves the prior valid state unchanged.
- The Person never has zero or two active Primary Assignments where one is required, and as-of reporting places the Person in the correct Team.
- A transfer whose resolved destination is equivalent to its source Primary Assignment is rejected as a no-op and creates no Reservation or capacity movement.

#### FR-23: Job and level changes
Authorized HR users MUST independently record effective-dated changes to Organizational Role, Job Title, Seniority, Ladder, and Grade subject to compatibility rules.

**Consequences (testable):**
- Prior values remain reconstructable; Grade remains valid for Ladder.
- Job Title or Seniority changes re-evaluate headcount compatibility; Grade alone does not consume or release capacity.

#### FR-24: Contract and compensation changes
Authorized HR users MUST record effective-dated contractual and compensation changes under separately approved permissions.

**Consequences (testable):**
- Collaboration type, contract type/entity, insurer, dates, compensation amount/components, currency, change type, and notes are retained only where they are approved in the Data Dictionary.
- The product records the final promotion outcome but not its request, committee, or approval workflow.

### 8.6 Current and Historical State

#### FR-25: Current person state
Authorized users MUST view a Person's current Employment, Primary and in-scope Secondary Assignments, organization, Role, Job Title, Ladder, Grade, Seniority, contractual state, and compensation according to permissions.

**Consequences (testable):**
- Current state derives from the resolved authoritative event set, not from registration time.
- Profile, lists, dashboard, and reports reconcile for the same date, filters, scope, and metric definition.

#### FR-26: Historical person reconstruction
Authorized users MUST select an as-of date and reconstruct the supported Person state at that date.

**Consequences (testable):**
- Reconstruction includes Employment status, organization, Assignment, Role, Job Title, Ladder, Grade, and Seniority, with other categories where approved.
- Limitations before the Baseline are disclosed.
- Future as-of requests use explicit planned-state semantics from AR-TEMPORAL, visibly distinguish Scheduled projections from historical facts, and never label future state as Effective before its Effective Date.

#### FR-27: Historical organization and headcount
Authorized users MUST reconstruct core Team membership counts, organization counts, and approved/used/reserved/free headcount for a supported historical date.

**Consequences (testable):**
- Transfers and corrections change historical totals only at their resolved effective points.
- Detailed and aggregate results reconcile under the same metric catalogue.

### 8.7 Headcount Governance

#### FR-28: Headcount Approval lifecycle
HR Admin MUST manage Headcount Approvals with unique requirement code, Team, Job Title, optional Seniority, allowed count, validity, status, approval reference, and provenance.

**Consequences (testable):**
- Draft, Cancelled, and Expired approvals cannot accept new consumption or Reservation.
- Allowed count is a non-negative integer; validity start/end form a valid, non-empty range; status and used/reserved/free quantities are derived consistently.
- Changing, cancelling, expiring, or reducing an approval with active consumption or Reservation cannot orphan or rewrite those claims; AR-HEADCOUNT determines the recorded disposition and acceptance oracle.

#### FR-29: Universal Primary Assignment coverage
Every Primary Assignment MUST consume compatible headcount unless an explicitly configured, approved, and audited exemption policy applies.

**Consequences (testable):**
- Compatibility is Team + Job Title + optional Seniority; Grade and compensation do not determine matching.
- When multiple approvals match, the system defaults to the oldest valid compatible approval (by validity start, then creation time); an authorized user may manually select another compatible approval before finalize, with the choice audited.
- Exemptions identify policy, Assignment, actor/approver, reason, validity, and reporting treatment.

#### FR-30: Deterministic future capacity reservation
Finalizing a future start or inbound transfer MUST immediately reserve one compatible destination unit; the source unit remains consumed until the transfer becomes Effective.

**Consequences (testable):**
- Used, reserved, and free capacity are distinct; concurrent transactions cannot consume or reserve the same last unit.
- Cancel or superseding Correction releases/replaces the Reservation; approval expiry or later incompatibility before effect leaves the event Scheduled in a visible exception state and applies no partial Employment, Assignment, or capacity effect until an authorized, audited resolution under AR-HEADCOUNT.
- Immediate Reservation trade-off is product-approved (2026-07-16): destination capacity is reserved at finalization. Default intervention: warn at a 14-day horizon before linked approval expiry (AR-HEADCOUNT may retune N); formal AR-HEADCOUNT versioning and escalation owners remain due before the headcount architecture baseline.

#### FR-31: Atomic consumption and release
Start, termination, return, transfer, Reverse, and Correction MUST update linked headcount outcomes as one deterministic business operation at each affected effective point.

**Consequences (testable):**
- A failed operation leaves Assignment and capacity state unchanged.
- Retroactive resolution replays linked capacity history and explicitly surfaces historical over-capacity rather than silently discarding it.

#### FR-32: Headcount Override
Only HR Admin with explicit permission MUST override approved headcount shortage, validity, Job Title, or Seniority rules with mandatory context.

**Consequences (testable):**
- Audit retains actor, time, reason, violated rule, related event/Assignment, Team, Job Title, and capacity state.
- Overrides remain visible, filterable, and included in governance metrics; free capacity may go negative and Overrides appear as distinct rows — they never hide negative or exception capacity by flooring free at zero.

### 8.8 Search, Profiles, Dashboards, and Reports

#### FR-33: Permission-safe search and lists
Authorized users MUST search and filter approved personnel, event, organization, and headcount data using permitted identifiers and categories.

**Consequences (testable):**
- Personnel search supports name, surname, Personnel Code, national ID, email, phone, Job Title, Team, Department, and Business Unit wherever each field is Data-Dictionary approved and visible to the caller.
- Launch filters cover Employment status; start/termination date; Legal Entity, Business Unit, Department, and Team; Organizational Role; Job Title; Ladder; Grade; Seniority; collaboration and contract type; Contracting Entity; Insuring Entity; work location; Personnel Event type and Effective Date; registering user; Headcount Approval; and headcount status, subject to permission and applicability.
- Lists support sorting, pagination over a stable query snapshot with deterministic ordering, result count, approved column selection, filtered export, and clear Persian empty/error states. Concurrent data changes do not create duplicate/missing rows within that snapshot; session-only filter persistence remains non-gating.
- Query suggestions, facets, counts, and columns cannot reveal out-of-scope values.
- Before the search feature baseline, AR-ACCESS defines exact/prefix matching, masking, minimum query constraints, enumeration-safe messages/timing, retrieval windows, and acceptance probes for sensitive identifiers.

#### FR-34: Personnel profile and timeline
Authorized users MUST view a permission-filtered profile and chronological Personnel Event timeline.

**Consequences (testable):**
- Timeline identifies type, Effective Date, registration/finalization actor and time, status, provenance, and correction/neutralization chain.
- Current facts, prior Employments, Primary Assignment, and in-scope Secondary Assignments are distinguishable.

#### FR-35: Core dashboard
The system MUST provide a permission-safe launch dashboard covering current workforce/organization totals, workforce trend, Team membership/capacity, starts versus terminations, and open headcount.

**Consequences (testable):**
- Current indicators include active Persons; Legal Entity, Business Unit, Department, and Team counts; and approved, used, reserved, and free headcount.
- Workforce trend is calculated by Personnel Event Effective Date for a selectable range and supports daily, monthly, or another owner-approved granularity suitable to the selected range.
- Team status shows current Primary Assignment member count, capacity, used capacity, and free capacity and supports organization filtering and sorting by count/capacity.
- Starts and terminations are shown and compared over the selected range, including a trend and Legal Entity, Business Unit, Department, and Team filters.
- Open headcount shows approvals with free units, total free units, Team and Job Title breakdown, Seniority breakdown where Seniority is specified, and near-expiry/expired approvals. Open headcount equals free units on valid consumable approvals under the approved metric definition; expired approvals are shown as non-consumable.
- Shared organization and time filters update every applicable dashboard indicator synchronously and preserve permission-safe current/as-of semantics.
- Every dashboard metric links to or can be reconciled with its permission-filtered detail.

#### FR-36: Operational and historical reports
Authorized users MUST run the source-defined launch report catalogue with permission-safe current/as-of semantics.

**Consequences (testable):**
- Launch reports include active Persons; all Persons including ended Employments; current organization state; Team membership and inferred middle manager; distributions by Organizational Role, Job Title, Ladder/Grade, Seniority, and collaboration/contract type; starts; terminations; Team transfers; Organizational Role, Grade, and compensation changes; Headcount Approvals and used/free capacity; headcount Overrides; Scheduled events; Corrected/Cancelled/Reversed events; and Import Batch outcomes/errors.
- Reports support synchronized organizational and time/as-of filters, calculate temporal measures from Effective Date, display Jalali dates unambiguously, and expose last calculation/update time when derived state is used.
- Authorized users can export the filtered report result under FR-41.
- Product/HR MUST approve the precise metric definitions and suitable granularity for these required launch behaviors; approval refines their calculation but cannot remove them from launch scope without an explicit scope change.

### 8.9 Migration, Import, and Export

#### FR-37: Controlled CSV/XLSX import
Authorized users MUST import approved CSV/XLSX templates through identification, validation, preview, confirmation, execution, and result stages.

**Consequences (testable):**
- Validation covers structure, required data, identifiers, uniqueness, dates, enums, hierarchy, references, Ladder–Grade, overlaps, order, and duplicate rows.
- Each error identifies row, column, and actionable Persian reason; the user can cancel before execution.
- Execution revalidates previewed data against current authoritative state; overlapping concurrent Import Batches that would change the same target cannot silently overwrite one another.

#### FR-38: Atomic and traceable Import Batch
Every executed import MUST be atomic or reliably rolled back and traceable through an Import Batch.

**Consequences (testable):**
- Failure leaves no partial business state, inconsistent derived state, or incorrect headcount.
- Batch evidence identifies source metadata, actor/times, status, counts, errors, and every created record/event; repeat input cannot silently duplicate data.

#### FR-39: Baseline and migration provenance
The system MUST represent an approved Baseline separately from native Personnel Events and identify migrated provenance.

**Consequences (testable):**
- Users can distinguish Baseline state, imported events, and native events.
- The product clearly states the reconstructable-history boundary.

#### FR-40: Migration reconciliation
The system MUST support signed reconciliation of Person, Employment, Assignment, Personnel Event, current state, Team totals, reference mappings, headcount, duplicates, orphans, and approved control totals.

**Consequences (testable):**
- Every discrepancy has an owner and accepted disposition.
- Production cutover is blocked without owner-signed reconciliation and zero unresolved critical integrity defects.

#### FR-41: Governed export
Authorized users MUST export only the filtered records, fields, dates, and Organizational Scope permitted by AR-ACCESS/AR-REPORTING in an AR-DATA-approved launch format.

**Consequences (testable):**
- Sensitive fields are excluded without category-specific export permission.
- Actor, time, purpose/type, filters/scope, selected fields, volume, outcome, and generated-artifact handling are audited.

### 8.10 Audit, Localization, and Operational Visibility

#### FR-42: Business and security audit
The system MUST create AR-AUDIT-governed evidence for authentication, required sensitive reads, denied reads, mutations, finalization, Cancel/Reverse/Correction, organization/headcount changes, Override, import, export, permission/configuration, and privileged access.

**Consequences (testable):**
- Evidence identifies actor, time, operation, entity/type, scope, result, reason where applicable, and correlation reference.
- Ordinary operational users cannot alter audit records; audit access is separately permissioned.

#### FR-43: Persian RTL desktop experience
All MVP user-facing pages, navigation, forms, tables, charts, validations, warnings, errors, and confirmations MUST be Persian and RTL for desktop use.

**Consequences (testable):**
- Essential tasks remain usable from 1280×720 through 2K, with 1920×1080 as reference.
- Long forms are sectioned, required fields and inline errors are clear, destructive/sensitive consequences are confirmed, and unsaved changes are warned.

#### FR-44: Jalali date experience
The system MUST accept and display user-facing business dates in Jalali while preserving unambiguous Effective Dates and timestamps.

**Consequences (testable):**
- Date entry uses an approved Jalali control and round-trip conversion never changes the intended business day.
- Registration/finalization time remains precise and distinguishable from Effective Date.

#### FR-45: Operational health without content exposure
Authorized operators MUST observe service, identity, import/recalculation, backup, and dependency health without routine access to sensitive HR content.

**Consequences (testable):**
- Technical logs redact LDAP secrets and unnecessary personnel data and support incident correlation.
- Failed or stale derived-state processing is visible to users/operators and cannot masquerade as current truth; authorization, headcount finalization, and formally published reports fail closed when their required inputs are stale, failed, or unreconciled.

### 8.11 Cross-Cutting Governance, Security, and Evidence

#### FR-46: Entitlement lifecycle and privileged access
The system MUST govern each entitlement through request, independent approval where required, activation, start/expiry, immediate revocation, periodic recertification, and retained evidence under AR-ACCESS.

**Consequences (testable):**
- No actor can request, approve, recertify, or waive their own sensitive/global/bulk grant, exceed their delegable scope, or combine permission administration with approval of the same grant; AR-ACCESS defines and blocks toxic combinations across UI, API, import, and configuration paths.
- Sensitive, global, bulk, role/scope creation or mass-assignment grants require attributable independent approval. Revocation is enforced before the next protected action and MUST meet a finite maximum objective version-frozen in AR-ACCESS; queued work and artifact retrieval always reauthorize before execution/delivery.
- An entitlement whose recertification is overdue is suspended or revoked under a mandatory fail-safe AR-ACCESS rule; it cannot remain active indefinitely because a reviewer did not act.
- Break-glass is incident-bound, minimal in action/scope/time, independently approved, auto-expires, and receives independent post-use review; export and permission administration are denied by default and require separate exceptional approval.

#### FR-47: Temporal and cross-boundary authorization
Every profile, timeline, search, count, dashboard, report, export, and audit retrieval MUST evaluate the AR-ACCESS-approved subject, object, data category, action, Organizational Scope, and relevant current/as-of time semantics.

**Consequences (testable):**
- A cross-boundary aggregate or detail result contains only the permitted intersection of all underlying Person, Employment, Assignment, Personnel Event, Headcount Approval, and Import Batch populations; drill-down preserves the identical authorized population.
- Management-derived scope permits by default only facts and time intervals covered by the authorized management/organizational relationship. Current-manager access to pre-scope history and former-manager access to post-scope history require a separate purpose-, category-, and time-bounded grant with audit; AR-ACCESS may narrow but MUST NOT implicitly broaden this invariant.
- Stale, failed, ambiguous, or unreconciled authorization inputs fail closed.
- Role, scope, account, or organizational-membership change is enforced before the next protected action and within the finite AR-ACCESS objective; affected sessions, queued operations, cached results, links, and active managed artifacts reauthorize or fail closed.

#### FR-48: Inference-resistant and bulk retrieval
All UI, API, search, list, count, dashboard, report, and export retrieval channels MUST be jointly governed as data access rather than treated as independent exfiltration paths.

**Consequences (testable):**
- AR-REPORTING defines and enforces small-cohort, zero/small-cell, differencing, repeated-query, comparison, and drill-down protection or an approved equivalent consistently across screen and export.
- AR-ACCESS and AR-REPORTING define volume/window, range, field, and cumulative retrieval controls, additional approval for sensitive/bulk access, and attributable audit/alert/response ownership.
- Required thresholds and acceptance sequences MUST be approved before the reporting/search/export architecture baseline; absence blocks that baseline.

#### FR-49: Identity and account lifecycle
Each internal human account MUST represent exactly one human and either one active stable external identity or a set of proven aliases belonging to that same human, and MUST follow the AR-IDENTITY joiner/mover/leaver and rehire lifecycle.

**Consequences (testable):**
- Shared human accounts and aliases belonging to different humans are prohibited; ambiguous, duplicate, unmapped, or conflicting identity links fail closed.
- Each stable external identity or proven same-human alias set links to at most one internal account.
- Rename cannot silently relink an account to another Person. Identity/account merge, split, or relink requires independent governed evidence, approval, and audit under AR-IDENTITY.
- Directory disablement, deletion, or lockout and entitlement revocation are enforced before the next protected action and within the finite AR-IDENTITY objective; orphan/dormant accounts are disabled/reported, queued work and retrieval reauthorize, and rehire requires link and entitlement revalidation.
- Directory outage never creates routine local access; any emergency account remains subject to FR-46.

#### FR-50: Data retention, disposal, and legal hold
The system MUST enforce AR-DATA lifecycle and AR-ACCESS authorization rules for every Data Element and artifact category, including trigger, retention, end action, legal hold/release, exception, owner, and evidence.

**Consequences (testable):**
- Required deletion/anonymization/restriction propagates to operational state, derived/search/report data, import/staging/error artifacts, active exports, caches/copies, and backups under the approved recovery-aware policy.
- Historical and audit proof is preserved with minimized evidence while values are deleted/anonymized where required; reconstruction explicitly identifies any resulting limits and never fabricates disposed facts.
- Hold, release, disposal, and failed propagation are attributable, reviewable, and reconcilable.

#### FR-51: Audit trust boundary and fail-safe evidence
Required audit evidence MUST be independently trustworthy under AR-AUDIT and no actor may alter, hide, dispose of, or approve review of their own sensitive activity.

**Consequences (testable):**
- Audit access, search, report, and export are purpose/scope controlled and audited; no ordinary, HR, permission, infrastructure, break-glass, or audit actor can unilaterally conceal their activity.
- Required-audit failure prevents or safely suspends the governed sensitive operation; gaps, clock anomalies, integrity failures, and interrupted capture are detected, alerted, and assigned for review.
- The minimum audit baseline covers successful/denied probes of highly sensitive categories, reveal/unmask, bulk retrieval, historical access, audit access, privileged reads, entitlement changes, and break-glass with actor, purpose/context, scope, volume, outcome, and no unnecessary value duplication.

#### FR-52: Secure import/export artifacts
Import, preview, error, staging, export, and download artifacts MUST follow AR-DATA, AR-ACCESS, AR-MIGRATION, and AR-AUDIT throughout creation, execution, retrieval, expiry, revocation, and disposal.

**Consequences (testable):**
- Import accepts only approved fields and values. Workbook formulas, macros, external links, and other active structures are rejected; plain-text values beginning with spreadsheet formula-control characters are stored/displayed as literal text and safely escaped on spreadsheet export. Previews/errors expose no field or row beyond the viewer's permission.
- Spreadsheet exports are formula-safe and contain no unauthorized data in cells or metadata; generation is bound to the reviewed stable snapshot and reauthorized at execution and every managed retrieval.
- Each artifact records owner/requester, purpose, classification, scope/fields, source/template/version, creation/expiry, state, retrievals, revocation, and disposal evidence; role/scope change or incident can revoke active artifacts.
- At download, Divan displays classification, handling, and expiry notices and records the recipient, destination class, and custody transfer. Bulk/sensitive retrieval requires explicit handling/disposal/incident acknowledgement. Managed controls end when a copy leaves Divan: the product MUST NOT claim it can revoke or delete a local/email/share copy, which remains subject to the organization's disposal and incident process.
- Upload, approval, and production execution duties for sensitive batches are separated as AR-MIGRATION requires; source, staging, preview, failed, cached, and corrected/replayed artifacts receive the same lifecycle controls.

#### FR-53: External data-subject correction case
Without providing employee self-service, Divan MUST track restricted correction-case evidence under AR-ACCESS, AR-AUDIT, and AR-DATA.

**Consequences (testable):**
- A case records verified request reference/authority, linked Person, owner, status, deadline, decision/reason, restricted evidence references/metadata, and closure evidence. Bounded attachments are stored only when explicitly approved/classified/lifecycle-governed in AR-DATA; this does not create general personnel document management.
- Every bounded attachment follows an AR-DATA owner-approved type/size allowlist. Active, executable, script, external-link, and unauthorized archive content is rejected; content may be offered only as an inert download where AR-DATA explicitly approves that case. Filename/metadata are minimized, preview/download remain permission-safe, suspicious content is quarantined, a failed inspection fails closed, and no content executes automatically. Architecture chooses the mechanism; acceptance MUST cover allowed, rejected, quarantined, preview, and download cases.
- A case passing its deadline enters an explicit breached/escalated state with attributable notification and review; it cannot remain indistinguishable from an in-time active case.
- An approved outcome links to the relevant Correction, retention/disposal action, propagation/recalculation, affected published artifacts, and response evidence; rejected or constrained outcomes remain attributable.

#### FR-54: Published decision-report reproducibility
A report used as a formal organizational decision record MUST be reproducible under AR-DATA/AR-REPORTING only while lawful, approved source or evidence exists.

**Consequences (testable):**
- Publication records report/metric version, authorized population/snapshot reference, filters, as-of semantics, publication timestamp, publisher, and permitted audience without embedding unauthorized values.
- A later retroactive Correction or policy/metric change does not silently rewrite the published decision record; it creates a linked correction/supersession notice and preserves the applicable retention/access rules.
- After required source disposal, Divan preserves an AR-DATA/AR-REPORTING-approved privacy-preserving reproducibility package where allowed. Otherwise, the attributable publication is marked `non-reproducible-after-disposal` and superseded, cannot be presented or claimed as currently reproducible, and retains only permitted decision/provenance evidence. Reproducibility never overrides mandatory disposal.

#### FR-55: Policy and launch-artifact change control
Every Launch Artifact Register item MUST be versioned, attributable, approved for a stated scope and period, and governed through change, waiver, expiry, and reapproval.

**Consequences (testable):**
- Each applicable operation/report/evidence identifies the controlling artifact version; superseded versions remain traceable.
- A waiver states owner, independent approver, scope, risk, compensating controls, expiry, and closure evidence and cannot waive default-deny, audit independence, integrity, or mandatory upstream gates.
- Material PRD, policy, data-category, metric, architecture, build, threshold, workload, or environment changes trigger impact-assessed rebaseline, artifact reapproval, and affected regression/acceptance before continued build or release.
- If applicable Launch Artifacts prescribe conflicting outcomes, the affected baseline and operation remain blocked until their owners/approvers jointly resolve and version the conflict; no team may assume local precedence.

#### FR-56: Authoritative reference and snapshot integrity
Business operations spanning mutable reference data or result sets MUST resolve against one attributable, valid evaluation snapshot.

**Consequences (testable):**
- Finalization, import execution, pagination, export generation, and formal report publication either complete against their validated snapshot/version or fail without mixing versions.
- Organization/reference changes, concurrent imports, or permission changes cannot produce a partially valid authoritative operation; conflicts are surfaced with no silent overwrite or out-of-scope delivery.

## 9. Cross-Cutting Non-Functional Requirements

- **NFR-1 — Transport security:** TLS MUST protect all application traffic, including identity and administrative paths; AR-NFR/AR-IDENTITY MUST fix certificate ownership and protocol/cipher acceptance before the affected infrastructure/security baseline.
- **NFR-2 — Performance:** AR-NFR MUST approve and version-freeze the measurable percentile, thresholds, workload, environment, and measurement profile before the earliest affected architecture/delivery/feature baseline; absence blocks that baseline. The source-inherited provisional targets are 2 seconds for ordinary pages, 3 seconds for common search/filter actions, and 5 seconds for common dashboards. Before freeze, evidence may support owner-approved alternatives; after freeze, any change requires FR-55 impact assessment and rebaseline. The profile includes concurrency, browser/client, cache state, dataset/event/history size, network conditions, server-to-render boundary, and test method. Production only verifies evidence against the frozen version.
- **NFR-3 — Processing freshness:** Retroactive recalculation, import, and report jobs MUST expose progress/failure and MUST NOT present stale results as current. AR-NFR MUST fix measurable completion/freshness thresholds and maximum supported job sizes before affected feature/delivery baselines.
- **NFR-4 — Integrity:** Concurrent operations MUST produce zero instances of duplicate active Employments, overlapping Primary Assignments, over-consumed or over-reserved headcount units, partial transfers, or partial failed imports.
- **NFR-5 — Availability:** AR-NFR MUST set service window, availability target, planned-maintenance treatment, and dependency-degradation behavior at the §7.2 stage where they affect architecture/delivery; absent values block that baseline.
- **NFR-6 — Recoverability:** AR-NFR MUST set and version-freeze RPO, RTO, backup frequency/retention/isolation, recovery roles, and restore acceptance before the earliest affected baseline and demonstrate evidence against that version before production. Restored state is unavailable to users until owners apply and sign off on all post-backup catch-up for disposal/hold changes, identity/entitlement revocations, artifact expiry/revocation, policy versions, event/Correction deltas, and derived-state reconciliation. Restored sessions, queued work, and emergency grants are invalid by default. Backups/restores/copies retain equivalent or stronger controls; restore to non-production follows NFR-8.
- **NFR-7 — Session security:** AR-ACCESS, AR-IDENTITY, and AR-NFR MUST set idle/absolute timeout, reauthentication for sensitive operations, rate limiting/lockout, concurrent-session controls, revocation bound, and emergency-account acceptance before affected identity/authorization baselines.
- **NFR-8 — At-rest and artifact protection:** AR-DATA and AR-NFR MUST govern encryption, inventory, minimal access, audited access, retention/expiry, revocation, and disposal for databases, backups/copies, import/staging/error files, generated exports/previews, logs, caches, and configuration. Real production HR data in non-production is prohibited by default; an exception requires documented necessity, the minimum dataset, masking proportionate to re-identification risk, a re-identification assessment, scoped/time-bound access, copy inventory, and verified purge evidence.
- **NFR-9 — Audit integrity:** AR-AUDIT/AR-NFR MUST set audit retention, clock synchronization, integrity verification, review cadence, redaction, access, and failure acceptance before the audit baseline and acceptance-test them before production.
- **NFR-10 — Observability/support:** AR-NFR MUST set owners, severity model, support window, incident routing, alert thresholds, log retention/redaction, and runbooks before the affected operational baseline.
- **NFR-11 — Compatibility:** Essential tasks MUST pass at 1280×720, 1920×1080, and 2K on the AR-NFR-approved enterprise browser/version matrix; the matrix is due before UX/build baseline.
- **NFR-12 — Accessibility:** AR-NFR MUST set a launch accessibility target and test method for keyboard use, focus, contrast, and assistive needs before UX/build baseline.
- **NFR-13 — Scale envelope:** AR-NFR MUST set maximum people, Personnel Events, organization units, history years, concurrent users, import/export rows/files, and report ranges before affected architecture/delivery baselines; initial nominal population is approximately 500.
- **NFR-14 — Security assurance:** AR-NFR MUST define the threat model scope, vulnerability/patch severity and remediation rules, secret/key lifecycle, environment hardening, security test coverage, penetration/independent assessment expectations, incident response, and finding classification before affected security architecture/delivery baselines; production evidence MUST show the approved controls and zero unresolved critical/high findings.

## 10. Launch Gates and Success Metrics

Unknown baselines MUST be collected through pre-build process/data profiling, trial migration, or UAT as applicable. AR-REPORTING MUST fix formulas, target values, windows, remediation/stop conditions, and numeric 30/60/90-day thresholds before the reporting/acceptance feature baseline; absence blocks that baseline rather than being deferred to launch. HR/Product owns business metrics; Data Migration owns reconciliation; Security owns access/security evidence; Operations owns service/recovery evidence. This PRD does not invent unsupported numbers.

### 10.1 Hard Launch Gates

- **LG-1 — Reconciliation:** AR-MIGRATION and AR-CUTOVER evidence is signed by Migration and HR, every exception/waiver follows FR-55, cumulative residual risk is accepted, and no unresolved critical duplicate, orphan, temporal, Assignment, headcount, or control-total integrity issue remains. Validates FR-25–FR-40, FR-50, FR-52, FR-56.
- **LG-2 — Access and security:** AR-ACCESS, AR-IDENTITY, and AR-AUDIT tests pass; zero unresolved critical or high security findings and zero unauthorized data exposure. Validates FR-1–FR-4, FR-33–FR-43, FR-46–FR-52.
- **LG-3 — Governance:** AR-DATA is approved and lifecycle/data-subject evidence passes. Validates FR-3, FR-7, FR-41–FR-42, FR-50, FR-52–FR-53.
- **LG-4 — Temporal/headcount integrity:** AR-TEMPORAL, AR-HEADCOUNT, and AR-SECONDARY acceptance shows zero over-consumption under approved concurrency and identical reconstruction from the same authoritative event set. Validates FR-9–FR-32, FR-45, FR-54, FR-56.
- **LG-5 — Operational readiness:** Evidence against the version-frozen AR-NFR thresholds/profile demonstrates TLS, browser/environment, monitoring, security assurance, support, availability, RPO, RTO, protected backups, and witnessed restore/catch-up. Validates NFR-1–NFR-14.
- **LG-6 — Acceptance and change readiness:** AR-REPORTING targets/oracles, AR-CUTOVER, and FR-55 artifact/version/waiver/change-control acceptance are approved and tested; domain owners sign UAT, launch users complete training, support/runbooks are ready, and parallel-source/rollback rules are rehearsed.

### 10.2 Measured Outcomes

- **SM-1 — Trusted state:** baseline and monitor reconciliation defects per 100 people/events, unresolved critical-field flags, and report/dashboard reconciliation failures. Owner: HR Data Owner. Windows: launch, 30/60/90 days.
- **SM-2 — Governed digital completion:** baseline and monitor the share of selected starts, terminations, transfers, and changes completed authoritatively in Divan. Owner: HR Operations. Windows: 30/60/90 days.
- **SM-3 — Reduced spreadsheet dependence:** inventory pre-launch operational spreadsheets and monitor retired, approved-exception, and newly discovered shadow files/processes. Owner: HR/Product. Windows: launch, 30/60/90 days.
- **SM-4 — Task quality and efficiency:** baseline and monitor completion time, validation failure, correction/rework, and support demand for selected journeys. Owner: HR Operations/Product. Windows: UAT, 30/60/90 days.
- **SM-5 — Headcount governance:** monitor the share of starts/transfers checked against valid capacity, Override rate, reasons, and unresolved Override aging. Owner: Workforce Planning/HR. Windows: weekly for 90 days.
- **SM-6 — Meaningful adoption:** define eligible cohorts and meaningful actions, obtain Legal/Privacy approval for telemetry, and monitor cohort use rather than login count alone. Owner: Product/HR Change. Windows: 30/60/90 days.

### 10.3 Counter-Metrics

- **SM-C1:** Faster event completion MUST NOT increase Correction, Reverse, validation bypass, or data-quality defect rates.
- **SM-C2:** Reduced spreadsheet use MUST NOT shift sensitive data into email, local files, or unauthorized exports.
- **SM-C3:** Headcount enforcement MUST NOT produce an unreviewed rise in Overrides or operational workarounds.
- **SM-C4:** Report adoption MUST NOT increase sensitive-read, bulk-export, or out-of-scope access incidents.
- **SM-C5:** Performance optimization MUST NOT serve stale, unreconciled, or permission-leaking derived state.

## 11. Risks and Mitigations

- **Sensitive-data exposure:** mitigate through default-deny category/scope authorization, separate export permission, privileged separation, and launch security evidence.
- **Incorrect historical state:** mitigate through explicit event semantics, deterministic ordering, immutable originals, recalculation visibility, and reconciliation.
- **Headcount inconsistency:** mitigate through universal Primary Assignment coverage, immediate future Reservation, atomic movement, concurrency acceptance, and visible Overrides.
- **Poor migration data:** mitigate through Data Dictionary approval, trial imports, row-level errors, provenance, signed reconciliation, and rollback authority.
- **Operational dependency failure:** mitigate through tested identity degradation, monitoring, support, backup, and witnessed restore.
- **Shadow process persistence:** mitigate through training, process ownership, spreadsheet inventory/retirement, and measured exceptions.
- **Scope/schedule optimism:** re-estimate only after owner decisions, data profiling, architecture, and delivery slicing; no 2–3 week commitment is accepted by this PRD.

## 12. Rollout and Readiness

Decision closure and feature/story baselining follow §7.2 and are not repeated here.

1. **Build and verification:** implement against FR/NFR and artifact versions; complete security, integrity, temporal, concurrency, migration, UX, and operational acceptance.
2. **Trial migration/UAT:** run repeatable trial batches, collect metric baselines, reconcile domains, train users, and close defects/waivers under FR-55.
3. **Cutover readiness:** rehearse AR-CUTOVER, including input freeze, delta handling, parallel-source conflict rules, rollback triggers/authority, point of no return, operational restoration, and evidence; then sign LG-1 through LG-6.
4. **Controlled go-live:** deploy to the single organization, monitor integrity/security/operations closely, and permit only time-bound, inventoried parallel-process exceptions.
5. **30/60/90-day review:** publish AR-REPORTING outcomes/counter-metrics, review entitlements and Overrides, retire exceptions, and decide post-MVP scope.

## 13. Sources / Evidence

- Primary source: `C:\Users\AtA\projects\divan\docs\pre-prd.md`
- Source extraction: `C:\Users\AtA\projects\divan\_bmad-output\planning-artifacts\prds\prd-divan-2026-07-11\source-extract-pre-prd.md`
- Research digest: `C:\Users\AtA\projects\divan\_bmad-output\planning-artifacts\prds\prd-divan-2026-07-11\research-hris-practices.md`
- Detailed external research citations are preserved in `addendum.md`.
