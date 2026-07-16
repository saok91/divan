# Source Extraction — Divan HRIS Pre-PRD

- **Source:** `C:\Users\AtA\projects\divan\docs\pre-prd.md`
- **Extraction date:** 2026-07-11
- **Purpose:** Decision-ready input for a launch-grade enterprise PRD
- **Method:** Extract and classify; do not reproduce or rewrite the source wholesale
- **Source maturity claim:** “Final for MVP design and planning”
- **Assessment of that claim:** Not yet justified. The source is unusually rich in domain detail and acceptance examples, but launch-critical decisions remain unresolved or are expressed as assumptions, preferences, or technical options.

## 1. Overall Assessment

The draft describes a Persian, RTL, on-premise, event-oriented HRIS intended to replace fragmented Excel records for an initial population of roughly 500 people. Its strongest material is the domain model, temporal/event behavior, headcount controls, migration workflow, and broad acceptance examples. It provides a credible base for a launch-grade PRD.

It is not yet launch-ready because:

1. Access to highly sensitive HR data is over-broad and conflicts with least privilege, purpose limitation, and the draft’s own security posture.
2. Event correction semantics are incomplete: Cancel, Reverse, correction, supersession, retroactive recomputation, same-day ordering, and downstream effects are not specified precisely enough to guarantee deterministic outcomes.
3. Headcount rules contain optional language (“in case needed”) and do not fully define matching, reservation, expiry, retroactive moves, secondary assignments, or correction behavior.
4. The document treats multi-tenancy as a Must Have even though the first deployment is single-tenant on-premise, adding scope and assurance burden without a confirmed business need.
5. Success metrics are names and definitions only. They lack baselines, targets, measurement windows, owners, counter-metrics, and launch/exit gates.
6. The “only main open topic is LDAP” statement is false. Multiple product, policy, legal, data-governance, operational, and temporal decisions remain open.
7. Product outcomes and business requirements are mixed with solution design, database constraints, projection mechanisms, deployment sequencing, and test strategy. Those technical details should move to an addendum or architecture document.

## 2. Product Thesis

### Extracted thesis

Divan should become the single, auditable source of truth for current and historical workforce state by replacing spreadsheet-based HR records with effective-dated personnel events, controlled organizational assignments, approved headcount consumption, and permission-aware reporting.

### Intended customer/business value

- Reduce conflicting copies, accidental overwrites, and manual reconciliation.
- Make the current state of each person and the organization trustworthy.
- Preserve an attributable history of personnel changes.
- Reconstruct workforce state at a past date.
- Prevent or explicitly govern hiring and transfers beyond approved capacity.
- Make core HR reporting available without manual Excel preparation.
- Create a foundation for later HR workflows without including those workflows in MVP.

### Strategic wedge

The differentiated core is not a generic employee directory. It is the combination of:

- effective-dated HR events;
- immutable/auditable correction;
- historical reconstruction;
- organizational assignment history; and
- headcount entitlement and consumption control.

### Outcome chain

Clean migration + governed event entry → reliable temporal workforce state → trusted operational and management reporting → reduced spreadsheet dependence and stronger capacity control.

## 3. Confirmed Decisions

The following are stated as decisions rather than proposals, subject to the conflicts and gaps noted later:

### Product and deployment

- MVP is a browser-based enterprise HRIS.
- UI is Persian and RTL.
- User-facing date entry/display is Jalali; internal date storage is calendar-neutral/standard.
- Initial deployment is on-premise for one organization.
- Initial scale is approximately 500 personnel.
- Desktop is the target channel; mobile and tablet optimization are excluded.
- Reference resolution is 1920×1080; usable desktop range is 1280×720 through 2K.

### Domain and temporal model

- Person is a stable identity independent of employment periods.
- A returning person reuses the prior personnel code and receives a new Employment.
- A person may have multiple historical Employments but at most one active Employment at a time in MVP.
- Each active Employment has exactly one active primary Assignment.
- A person may have multiple concurrent secondary Assignments.
- Primary Assignment determines team membership and, by default, headcount consumption.
- Current state is derived from finalized events whose effective date is not later than the evaluation date.
- Past-dated and future-dated events are allowed.
- Future events do not alter current state before their effective date.
- Finalized events are not directly edited or hard-deleted.
- Corrections/cancellations require reason and auditability.
- HR Admin and authorized HR Operator can finalize permitted events without secondary approval.
- Organizational role, job title, ladder, grade, and seniority are separate concepts.
- Grade must belong to the selected ladder.
- No universal fixed mapping between grade and seniority is imposed.
- A middle manager with a primary Assignment in a team is inferred to manage that team.

### Headcount

- Hiring/start and inbound team transfer are checked against valid headcount.
- Headcount is defined by Team + job title and optionally seniority.
- `allowed_count` may exceed one.
- Transfer releases source capacity and consumes destination capacity atomically.
- Grade or compensation change alone does not change headcount consumption.
- Secondary Assignment does not consume headcount by default.
- HR Admin may override incompatible or unavailable capacity with a mandatory reason.

### Data and migration

- Existing current-state and partial-history data will be imported from CSV/XLSX.
- A migration Baseline represents state at the start of reliable history.
- Migrated records/events are distinguishable from native records and traceable to an Import Batch.
- Import includes validation, preview, confirmation, execution, and result reporting.

### Access and audit

- Authorization is permission-based rather than role-name-only.
- Backend enforces authorization independently of UI controls.
- System Admin should not receive operational access to sensitive HR data by default.
- Compensation has a separate permission.
- Export is permission-controlled and audited.
- Mutating operations are attributable to a user and time.
- Audit logs are not editable by normal operational users.
- LDAP/AD is the intended authentication source, pending infrastructure details.
- LDAP passwords are not stored by the application.

### Explicit exclusions

- Payroll calculations, payslips, taxes, insurance calculations, and salary payment.
- Attendance, leave, and mission management.
- Recruitment/ATS before employment start.
- Promotion request/committee/approval workflow; only the final promotion outcome is recorded.
- General workflow engine.
- Interactive organization chart.
- Advanced predictive analytics.
- Employee self-service.
- Mobile app and dedicated tablet experience.
- Bilingual UI.
- Personnel document/file management unless separately approved.

## 4. Actors and Jobs to Be Done

### HR Admin

**Primary JTBD:** Maintain authoritative HR records and rules while resolving exceptional cases without destroying history.

- Create and manage personnel records.
- Finalize, correct, cancel, or reverse events.
- Manage organizational structure and reference data.
- Define and administer headcount approvals.
- Override capacity constraints with an auditable reason.
- Import legacy data and export permitted data.
- Investigate audit trails and data discrepancies.
- Establish a correct baseline and reconcile migrated state.

### HR Operator

**Primary JTBD:** Perform routine personnel operations accurately and quickly within approved policy.

- Create and complete employee records.
- Record starts, terminations, returns, transfers, and allowed changes.
- Schedule future changes and record past-dated changes.
- Search and review current/historical records.
- Run routine reports and permitted exports.
- See headcount availability before finalizing an operation.
- Understand actionable validation failures.

### Viewer / manager / management consumer

**Primary JTBD:** Understand workforce status and trends without changing source data.

- Find people and view permitted profile fields.
- Review event timeline and historical state.
- Review organizational and headcount status.
- Use dashboards and reports for decisions.
- Export only when explicitly authorized.

**Important ambiguity:** “Viewer,” “manager,” “team manager,” “senior management,” and “management consumer” are not mapped to distinct data scopes. The source currently gives Viewer broad access rather than manager-scoped access.

### System Admin

**Primary JTBD:** Operate and troubleshoot the service without routine access to HR content.

- Configure technical settings and LDAP integration.
- Manage accounts/roles where authorized.
- Monitor service health and system errors.
- Maintain deployment settings.
- Access sensitive content only through explicit, audited elevation.

### Product owner / HR management

**Primary JTBD:** Define policy, approve data semantics, and decide whether the system is fit for go-live.

- Approve Data Dictionary, role model, conflict rules, baseline, and KPI targets.
- Reconcile system state against HR-approved truth.
- Approve launch and post-launch success criteria.

### Information security / legal / privacy stakeholders

**Primary JTBD:** Ensure collection, access, export, retention, and audit of sensitive employee data meet organizational and legal obligations.

- Approve sensitive-field collection and purpose.
- Approve access scopes and privileged access.
- Define retention, deletion, anonymization, and legal hold.
- Define audit visibility and retention.
- Approve emergency access and authentication controls.

### Infrastructure / operations

**Primary JTBD:** Provide a supportable on-premise environment and recoverable service.

- Supply LDAP/AD, network, TLS, compute, database, monitoring, backup, and environment details.
- Agree availability, RPO, RTO, and incident support responsibilities.

### Employee as data subject

The source names personnel as data owners/data subjects but provides no employee-facing job, transparency mechanism, correction request path, consent/legal-basis treatment, or self-service capability.

## 5. Capability Groups

1. **Identity and access**
   - LDAP/AD authentication
   - internal user account linkage
   - roles and granular permissions
   - session controls
   - privileged/elevated access

2. **Personnel master data**
   - stable Person
   - identity, contact, family, education, employment, contractual, insurance, compensation, and other sensitive fields
   - profile and historical employment periods

3. **Organizational model**
   - Legal Entity → Business Unit → Department → Team
   - effective-dated organizational units
   - roles, job titles, ladders, grades, seniority
   - primary and secondary Assignments

4. **Personnel event lifecycle**
   - Draft, Scheduled, Effective, Cancelled, Reversed
   - past/future effective dates
   - finalization
   - correction/reversal/cancellation
   - timeline and conflict detection

5. **Temporal state**
   - current-state calculation
   - historical reconstruction
   - retroactive recalculation
   - deterministic same-day ordering

6. **Headcount governance**
   - approval creation and validity
   - capacity calculation and consumption
   - transfer atomics
   - override
   - capacity reporting

7. **Search and profile experience**
   - personnel search
   - multi-dimensional filters
   - sorting, pagination, column selection
   - profile and timeline views

8. **Dashboards and reports**
   - current workforce counts
   - workforce trend
   - team membership/capacity
   - starts and terminations
   - open headcount
   - operational reports

9. **Migration and interchange**
   - CSV/XLSX import
   - baseline and event migration
   - row/column validation
   - import batches and reconciliation
   - filtered CSV/XLSX export

10. **Audit and operations**
    - security and business audit trail
    - technical logging, health checks, correlation IDs
    - backup/restore and recoverability

11. **Localization and desktop UX**
    - Persian/RTL
    - Jalali date entry/display
    - desktop resolution support
    - clear validation and sensitive-operation confirmation

## 6. Testable Business Requirements

The requirements below consolidate testable business behavior from the source. They preserve source intent while removing duplicates. “Must” means the source presents the item as MVP behavior or acceptance criteria; it does not resolve contradictions identified later.

### 6.1 Authorization and identity

- **BR-AUTH-001:** An authenticated organizational user can be linked to one internal account.
- **BR-AUTH-002:** A user disabled or removed in LDAP cannot create a new session.
- **BR-AUTH-003:** The application does not store the user’s LDAP password.
- **BR-AUTH-004:** Roles and permissions can be administered inside the application unless LDAP-group mapping is later approved.
- **BR-AUTH-005:** Every protected backend operation validates the caller’s permission independently of UI state.
- **BR-AUTH-006:** Viewer cannot create, edit, delete, finalize, cancel, reverse, import, or change settings through UI or API.
- **BR-AUTH-007:** Compensation viewing is governed by a permission separate from ordinary personnel viewing.
- **BR-AUTH-008:** Sensitive-data export is governed by a permission separate from ordinary viewing.
- **BR-AUTH-009:** System Admin has no default operational access to sensitive personnel data.
- **BR-AUTH-010:** Any additional System Admin access is explicit and auditable.
- **BR-AUTH-011:** HR Admin can perform all approved HR administration operations.
- **BR-AUTH-012:** HR Operator can perform only explicitly permitted HR operations.
- **BR-AUTH-013:** Only HR Admin can override a headcount mismatch or capacity shortage.
- **BR-AUTH-014:** Role and permission changes are auditable.
- **BR-AUTH-015:** Cross-tenant access is denied in every API, search, report, and export if multiple tenants exist.
- **BR-AUTH-016:** Authentication dependency failures produce a clear Persian error and do not silently bypass authentication.

### 6.2 Person and employment

- **BR-PER-001:** An authorized HR user can create a Person with personnel code, first name, and last name.
- **BR-PER-002:** The system rejects duplicate personnel codes within the applicable data boundary.
- **BR-PER-003:** The system rejects duplicate national IDs within the applicable data boundary when national ID is present.
- **BR-PER-004:** Optional profile fields may remain empty.
- **BR-PER-005:** Terminating employment does not delete or deactivate the stable Person identity or its history.
- **BR-PER-006:** A Person can have multiple non-overlapping historical Employments.
- **BR-PER-007:** A Person has at most one active Employment at a given instant in MVP.
- **BR-PER-008:** Activating Employment requires Person, start date, approved collaboration/status value, organizational placement, and primary Assignment.
- **BR-PER-009:** A returning worker uses the existing Person and prior personnel code.
- **BR-PER-010:** A return creates a new Employment and primary Assignment while preserving all prior Employments/events.
- **BR-PER-011:** A return consumes new applicable headcount.
- **BR-PER-012:** Identity information remains available after termination subject to retention policy.
- **BR-PER-013:** Current and historical Employments are visible to authorized users.
- **BR-PER-014:** The system distinguishes current employment status from whether the Person record itself is active/retained.

### 6.3 Personnel profile and sensitive data

- **BR-PRO-001:** The profile displays current identity summary, employment status, organization, role, job title, ladder, grade, seniority, start date, contact information, primary/secondary Assignments, event timeline, and prior Employments according to permission.
- **BR-PRO-002:** Contract, insurance, compensation, family, bank, health, religion, and other sensitive data are displayed only under approved field/category permissions.
- **BR-PRO-003:** Compensation changes retain amount/components, currency, effective date, change type, and notes as configured in the approved Data Dictionary.
- **BR-PRO-004:** The product stores compensation facts but does not calculate payroll.
- **BR-PRO-005:** Empty values are displayed clearly without implying zero, “not applicable,” or verified absence.
- **BR-PRO-006:** The record can identify migration/native provenance where required for administration and reconciliation.

### 6.4 Organization and reference data

- **BR-ORG-001:** HR Admin can manage Legal Entities, Business Units, Departments, and Teams.
- **BR-ORG-002:** Every Business Unit belongs to one Legal Entity.
- **BR-ORG-003:** Every Department belongs to one Business Unit.
- **BR-ORG-004:** Every Team belongs to one Department.
- **BR-ORG-005:** Organizational units can be activated and deactivated.
- **BR-ORG-006:** Deactivation does not erase historical memberships or reporting.
- **BR-ORG-007:** Deactivating a unit with active members produces a warning and requires an approved disposition.
- **BR-ORG-008:** Organization changes retain effective validity dates sufficient for historical reconstruction.
- **BR-ORG-009:** Contracting Entity and Insuring Entity can differ from the organizational Legal Entity.
- **BR-ORG-010:** Role, job title, ladder, grade, and seniority are maintained independently.
- **BR-ORG-011:** A grade can be selected only when it belongs to the selected ladder.
- **BR-ORG-012:** Half-grades can be configured as normal valid grades in the relevant ladder.
- **BR-ORG-013:** Seniority values are manageable reference data.
- **BR-ORG-014:** The product does not impose one global grade-to-seniority mapping.
- **BR-ORG-015:** A middle manager with a primary Assignment to Team X is identified as Team X’s manager.
- **BR-ORG-016:** The system detects a second active middle manager in a team when the approved policy permits only one.
- **BR-ORG-017:** A senior manager Assignment can target Team, Department, Business Unit, or Legal Entity.
- **BR-ORG-018:** The captured model remains usable by a future organization-chart capability without requiring that chart in MVP.

### 6.5 Assignment

- **BR-ASG-001:** Every active Employment has exactly one active primary Assignment at any instant.
- **BR-ASG-002:** A Person may have multiple concurrent secondary Assignments.
- **BR-ASG-003:** Primary Assignment determines current team membership.
- **BR-ASG-004:** Primary Assignment is the default basis for headcount consumption.
- **BR-ASG-005:** Secondary Assignment does not consume headcount by default.
- **BR-ASG-006:** Every secondary Assignment has a reason or type.
- **BR-ASG-007:** Changes to primary Assignment occur through finalized personnel events.
- **BR-ASG-008:** An Assignment retains organization target, role, job title, ladder, grade, seniority, primary/secondary status, start, and end as applicable.
- **BR-ASG-009:** The system prevents overlapping primary Assignments.

### 6.6 Event common model and lifecycle

- **BR-EVT-001:** Every event has a unique ID, type, Person, applicable Employment, effective date, registration time, registering user, status, before/after values, and applicable reason/reference/provenance/headcount/override details.
- **BR-EVT-002:** An authorized user can create, edit, and delete a Draft.
- **BR-EVT-003:** An authorized HR Admin or permitted HR Operator can finalize a Draft without secondary approval.
- **BR-EVT-004:** Registration and finalization actor/time are separately traceable when they differ.
- **BR-EVT-005:** A finalized event cannot be directly edited.
- **BR-EVT-006:** A finalized event cannot be hard-deleted.
- **BR-EVT-007:** A future finalized event is Scheduled and does not affect current state before its effective time/date.
- **BR-EVT-008:** A finalized event at or before the evaluation date affects state when valid and not neutralized.
- **BR-EVT-009:** An authorized user can Cancel a future event before effect.
- **BR-EVT-010:** HR Admin can Reverse or correct an effective event with mandatory reason.
- **BR-EVT-011:** A correction or reversal references the original event.
- **BR-EVT-012:** Timeline distinguishes original, correction, cancellation/reversal, and resulting status.
- **BR-EVT-013:** Before and after values remain visible to an authorized investigator.
- **BR-EVT-014:** Every event status transition is attributable and audited.
- **BR-EVT-015:** Events sharing the same effective date have a deterministic, documented order.
- **BR-EVT-016:** Before finalization, the system checks known temporal and domain conflicts.
- **BR-EVT-017:** A blocked conflict prevents finalization; a warning conflict explicitly states the consequence and permitted action.
- **BR-EVT-018:** The system detects overlapping Employments and primary Assignments.
- **BR-EVT-019:** The system detects start before unresolved prior employment end, transfer after termination, change against inactive Employment, invalid ladder-grade, invalid date ranges, headcount over-consumption, and correction without reference.
- **BR-EVT-020:** Past-dated events trigger recalculation of current and historical results from the effective point forward.
- **BR-EVT-021:** Recalculation produces deterministic results for the same authoritative event set.
- **BR-EVT-022:** Users can see both effective date and registration time.

### 6.7 Start, termination, and return

- **BR-EMP-001:** A start event creates one active Employment and one primary Assignment effective at the specified date.
- **BR-EMP-002:** Start requires destination organization/team, role/job facts required by the Data Dictionary, and compatible valid headcount.
- **BR-EMP-003:** HR Operator cannot finalize a start with no compatible capacity.
- **BR-EMP-004:** HR Admin can finalize such a start only via an audited override with mandatory reason.
- **BR-EMP-005:** A termination event ends the active Employment and all active Assignments at its effective date.
- **BR-EMP-006:** Termination releases associated consumed headcount at its effective date.
- **BR-EMP-007:** Termination records date and reason.
- **BR-EMP-008:** Before termination finalization, the system identifies future events incompatible with that termination.
- **BR-EMP-009:** Return creates a new Employment and primary Assignment on the existing Person.
- **BR-EMP-010:** Return preserves the stable personnel code and all prior history.

### 6.8 Team transfer

- **BR-TRN-001:** A transfer identifies source and destination organizational placement.
- **BR-TRN-002:** Destination has compatible, valid, available headcount unless HR Admin overrides.
- **BR-TRN-003:** Transfer ends the source primary Assignment and creates the destination primary Assignment at the effective point.
- **BR-TRN-004:** Source release and destination consumption occur atomically.
- **BR-TRN-005:** Failure of any transfer step rolls back the whole operation.
- **BR-TRN-006:** Transfer never leaves zero or two active primary Assignments where exactly one is required.
- **BR-TRN-007:** A future transfer does not change current team counts before effect.
- **BR-TRN-008:** Historical reporting places the person in the correct team before and after transfer.
- **BR-TRN-009:** Override is limited to HR Admin and records reason and capacity context.

### 6.9 Other personnel changes

- **BR-CHG-001:** Organizational role can change independently of job title unless both are explicitly included in one authorized change.
- **BR-CHG-002:** Job-title change checks continued compatibility with linked headcount.
- **BR-CHG-003:** Seniority can change independently of grade.
- **BR-CHG-004:** Seniority mismatch against headcount is blocked or warned according to approved policy, with override only where approved.
- **BR-CHG-005:** Grade/promotion change preserves prior grade and validates ladder membership.
- **BR-CHG-006:** MVP records only the final promotion result, not request/committee/approval workflow.
- **BR-CHG-007:** Compensation change is effective-dated and historically retained.
- **BR-CHG-008:** Compensation change does not invoke payroll calculations.
- **BR-CHG-009:** Contractual changes can update collaboration type, contract type/entity, insurer, and applicable dates without erasing history.
- **BR-CHG-010:** Secondary Assignment can be created, changed, and ended without default headcount consumption.

### 6.10 Current and historical state

- **BR-HIS-001:** Current person state is calculated from valid finalized events effective at the evaluation instant.
- **BR-HIS-002:** Current state includes active Employment, primary/secondary Assignments, role, title, ladder/grade, seniority, compensation, and contractual state as permitted.
- **BR-HIS-003:** An authorized user can select a past date and view person state at that date.
- **BR-HIS-004:** Historical person state includes active/inactive employment, organization, role, title, ladder, grade, seniority, and active Employment.
- **BR-HIS-005:** An authorized user can view organization state at a historical date for supported reports.
- **BR-HIS-006:** Historical organization state includes workforce/team counts and headcount used/free.
- **BR-HIS-007:** Historical limitations before the migration Baseline are clearly disclosed.
- **BR-HIS-008:** If a cached/projection result is shown, its last update/recalculation time is visible.
- **BR-HIS-009:** Dashboard and detailed report values for the same metric/date/filter reconcile.

### 6.11 Headcount

- **BR-HC-001:** HR Admin can create a headcount approval with unique requirement code.
- **BR-HC-002:** Approval includes Team, job title, optional seniority, allowed count, validity, status, approval reference, creator, and timestamps.
- **BR-HC-003:** Allowed count can be greater than one.
- **BR-HC-004:** Draft, Cancelled, and Expired approvals cannot be consumed.
- **BR-HC-005:** Approved capacity can move to partially filled or filled based on consumption.
- **BR-HC-006:** Used and available capacity are derived correctly from allowed count and valid consuming Assignments/events.
- **BR-HC-007:** Start and inbound transfer consume one compatible unit.
- **BR-HC-008:** Termination and outbound transfer release the corresponding unit.
- **BR-HC-009:** Grade or compensation change alone does not consume or release capacity.
- **BR-HC-010:** When approval specifies seniority, the assignee must match or an approved override must be recorded.
- **BR-HC-011:** Headcount matches job title and optional seniority, not grade.
- **BR-HC-012:** Concurrent transactions cannot consume beyond available capacity.
- **BR-HC-013:** Capacity release remains linked to the Assignment/event that consumed it.
- **BR-HC-014:** Override records actor, time, reason, violated rule, related event, team, title, and capacity state.
- **BR-HC-015:** Overrides are reportable, filterable, and audited.
- **BR-HC-016:** Dashboard open-headcount total equals the sum of free units on valid consumable approvals.

### 6.12 Search, lists, and profile navigation

- **BR-SRCH-001:** Authorized users can search personnel by name, surname, personnel code, national ID, email, phone, title, Team, Department, and Business Unit subject to field permissions.
- **BR-SRCH-002:** Personnel/event/headcount lists support applicable filters defined in the approved reporting catalogue.
- **BR-SRCH-003:** Lists support sorting, pagination, result count, and filtered export.
- **BR-SRCH-004:** Lists provide a clear empty-result state.
- **BR-SRCH-005:** Invalid filters produce a clear Persian error.
- **BR-SRCH-006:** Search results and filter values do not reveal records or sensitive field values outside the user’s scope.
- **BR-SRCH-007:** Column visibility respects field-level permission.

### 6.13 Dashboards and reports

- **BR-RPT-001:** Dashboard shows current active-person count.
- **BR-RPT-002:** Dashboard shows current counts of organizational units.
- **BR-RPT-003:** Dashboard shows approved, used, free, and open headcount.
- **BR-RPT-004:** Workforce trend is calculated by effective date over selectable periods.
- **BR-RPT-005:** Team status shows current primary-Assignment member count and applicable capacity.
- **BR-RPT-006:** Start and termination reports count events in the selected period.
- **BR-RPT-007:** Open-headcount report can break down by team, title, and seniority where specified.
- **BR-RPT-008:** Reports support approved organizational and temporal filters.
- **BR-RPT-009:** Reports use Jalali display dates while preserving unambiguous underlying instants/dates.
- **BR-RPT-010:** Reports can display current or supported historical state.
- **BR-RPT-011:** All report data is constrained by permission and data boundary.
- **BR-RPT-012:** Authorized users can export filtered report data.
- **BR-RPT-013:** Reports cover active/all personnel, team membership/manager, role/title/ladder/grade/seniority distributions, collaboration/contract, starts, terminations, transfers, changes, headcount, overrides, future/corrected events, and import outcomes.

### 6.14 Import and migration

- **BR-IMP-001:** Authorized users can upload a supported CSV or XLSX template.
- **BR-IMP-002:** The system identifies the import type before execution.
- **BR-IMP-003:** The system validates file structure and required columns.
- **BR-IMP-004:** The system validates personnel identifiers, uniqueness, dates, enums, organizational hierarchy, reference data, ladder-grade membership, overlaps, event order, and duplicate rows.
- **BR-IMP-005:** Preview shows valid rows, warnings, and errors before execution.
- **BR-IMP-006:** Every error identifies row, column, and a clear actionable Persian reason.
- **BR-IMP-007:** User can cancel before final execution.
- **BR-IMP-008:** Import is atomic or has reliable rollback.
- **BR-IMP-009:** Failed import does not leave partial business data, inconsistent projection, or incorrect headcount.
- **BR-IMP-010:** Every import has a batch with source metadata, actor/times, status, counts, errors, and created records/events.
- **BR-IMP-011:** Every migrated record/event is traceable to its batch.
- **BR-IMP-012:** Baseline state is visibly distinguishable from actual business events.
- **BR-IMP-013:** Re-importing the same file or records warns or prevents unintended duplication.
- **BR-IMP-014:** Final result reports successful, warning, and failed counts.
- **BR-IMP-015:** Migration reconciliation compares people, Employments, events, current state, team counts, reference mappings, duplicates, and Baseline correctness.
- **BR-IMP-016:** The product communicates that history before Baseline may not be reconstructable.

### 6.15 Export

- **BR-EXP-001:** Authorized users can export permitted personnel, event, headcount, and report result sets.
- **BR-EXP-002:** Export supports at least one approved tabular format from CSV/XLSX; launch format(s) must be fixed.
- **BR-EXP-003:** Export contains only the filtered and authorized data set.
- **BR-EXP-004:** Export cannot include data outside the user’s tenant/data boundary.
- **BR-EXP-005:** Sensitive fields are excluded unless separately permitted.
- **BR-EXP-006:** Every export records actor, time, type, filters/scope, and result in audit.
- **BR-EXP-007:** Exported date representation is documented and unambiguous.

### 6.16 Audit

- **BR-AUD-001:** Successful and failed login, logout, Person/Employment/Assignment changes, Draft changes, finalization, Cancel/Reverse/correction, organization/headcount changes, override, import, export, permission changes, settings, and LDAP administration are audited.
- **BR-AUD-002:** Sensitive record/report access is audited where policy requires it; the launch requirement must replace “if technically possible.”
- **BR-AUD-003:** Audit records include actor, time, operation, entity type/ID, data boundary, result, applicable reason, and correlation ID.
- **BR-AUD-004:** Mutations include before/after values without unnecessarily copying sensitive values.
- **BR-AUD-005:** Audit records are immutable to ordinary and HR operational users.
- **BR-AUD-006:** Access to audit data is separately restricted.
- **BR-AUD-007:** Audit retention follows an approved policy.
- **BR-AUD-008:** Technical logs never contain LDAP secrets or unnecessary confidential HR data.

### 6.17 Persian/RTL desktop experience

- **BR-UX-001:** Every MVP page, validation, warning, error, and confirmation is Persian.
- **BR-UX-002:** Page, form, navigation, table, and chart layout is RTL-compatible.
- **BR-UX-003:** User-facing dates display in Jalali.
- **BR-UX-004:** Date entry uses a Jalali date picker.
- **BR-UX-005:** Date conversion does not shift the intended day because of timezone.
- **BR-UX-006:** Registration date/time remains precisely visible.
- **BR-UX-007:** All essential desktop tasks remain usable at 1280×720.
- **BR-UX-008:** Layout remains appropriate through 2K resolution.
- **BR-UX-009:** Wide tables may use controlled horizontal scrolling without losing essential controls/context.
- **BR-UX-010:** Sensitive operations require explicit confirmation and explain consequences.
- **BR-UX-011:** Long forms are sectioned and required fields are identifiable.
- **BR-UX-012:** Field validation appears next to the relevant field.
- **BR-UX-013:** Users receive a warning before losing unsaved changes.
- **BR-UX-014:** Timeline shows event type, effective date, registered actor, and status.

## 7. NFR Thresholds and Gaps

### Explicit or near-explicit thresholds

- Initial nominal scale: approximately 500 personnel.
- Performance test scale also mentions 500 to “several thousand” people, but no upper bound is committed.
- Ordinary page load: “preferably” under 2 seconds on internal network under normal conditions.
- Common search/filter: “preferably” under 3 seconds.
- Common dashboard: “preferably” under 5 seconds.
- Supported desktop viewport: minimum 1280×720, reference 1920×1080, up to 2K.
- Zero unresolved critical or high security defects at release.
- At most one active Employment per Person at any instant.
- Exactly one active primary Assignment per active Employment.
- Zero over-consumption under concurrent access.
- Zero partial/unknown imports after a failed execution.
- Zero direct edits or hard deletes of finalized events.
- Zero unauthorized cross-boundary data exposure.

### Thresholds that are not launch-grade yet

The performance statements are preferences, not acceptance SLOs. They lack percentile, concurrency, dataset size, report period, network assumptions, browser/client profile, warm/cold cache condition, and measurement method.

Required NFR decisions:

- **Performance:** p50/p95/p99 thresholds per critical journey; concurrent users; expected event/report volume; max import size; max export size; max timeline length; recalculation completion target after retroactive events.
- **Availability:** service window, uptime target, planned maintenance treatment, dependency behavior.
- **Recoverability:** RPO, RTO, backup frequency, retention, restore test frequency, and restore acceptance evidence.
- **Security:** TLS is currently conditional (“if infrastructure supports”), which is unacceptable for sensitive HR data; approved cipher/protocol baseline and certificate ownership are absent.
- **Session security:** idle timeout, absolute timeout, reauthentication for sensitive actions, lockout/rate limit, concurrent-session policy.
- **Audit:** retention, immutability control, integrity verification, access review, clock synchronization.
- **Privacy:** retention/deletion/anonymization SLAs, data subject correction process, lawful basis/purpose, residency, and access-review cadence.
- **Reliability:** job retry limits, dead-letter/failed-job handling, idempotency guarantees, projection freshness target, reconciliation frequency.
- **Accessibility:** no standard or keyboard/screen-reader/color-contrast target is stated.
- **Browser support:** “latest enterprise Chromium versions” is not a testable compatibility matrix.
- **Observability:** alert thresholds, owner, incident routing, log retention, redaction verification.
- **Supportability:** incident severity model, response/restoration targets, support hours, runbooks.
- **Scalability:** upper bounds for people, events, tenants, organizational units, headcount approvals, and years of history.

## 8. Security, Privacy, and Data-Governance Concerns

### Critical: broad Viewer access

The source repeatedly grants Viewer read access to all information, including sensitive data, while also asserting least privilege and permission-based authorization. This creates direct exposure of:

- compensation;
- national ID and birth details;
- home address and personal contact;
- spouse/children and emergency contacts;
- religion and sect;
- military status;
- bank and insurance information;
- health/physical-condition information;
- employment and termination history.

Read-only is not low-risk. Viewing, search, screenshots, report aggregation, and optional export can cause severe privacy harm. A launch-grade PRD should define default-deny field/category scopes and purpose-based roles. “Viewer can see everything according to current business decision” should be treated as an unapproved policy exception, not a confirmed MVP requirement, until HR, security, legal/privacy, and data owners sign off.

### Data minimization and purpose limitation

The draft says all listed sensitive fields must exist in the model if present in current files. Existing spreadsheet presence is not a valid collection criterion. Each field/category needs:

- business purpose;
- lawful/organizational basis;
- data owner;
- allowed roles and organizational scope;
- source of truth;
- accuracy obligation;
- retention and deletion rule;
- export rule;
- audit requirement.

Religion, sect, health, family, bank, and insurance data require especially strong justification and segmentation.

### Data ownership and correction

Personnel are named as data owners/data subjects, but there is no mechanism for:

- notifying them what is stored;
- correcting inaccurate personal data;
- resolving disputes between source event and current projection;
- recording who approved a correction;
- legal hold or investigation exceptions.

### Privileged access

System Admin separation is a good principle, but emergency/elevated access is unspecified. Define:

- break-glass eligibility and approval;
- time-bound elevation;
- reason and ticket/reference;
- mandatory audit and review;
- notification;
- removal/expiry.

### Authentication and transport

- LDAP details and failover are unresolved.
- No MFA decision exists for privileged or remote access.
- Local emergency account is unresolved.
- TLS is conditional despite highly sensitive data.
- No rate limiting, brute-force protection, or reauthentication requirement is stated.
- No account lifecycle synchronization/recertification is defined.

### Export and exfiltration

Export permissions are acknowledged, but the PRD lacks:

- row/field limits;
- mass-export approval;
- watermarking or classification;
- asynchronous secure delivery;
- expiry of generated files;
- storage and deletion of export artifacts;
- alerting on unusual volume;
- separation between dashboard viewing and raw-data extraction.

### Audit data itself

Before/after values can replicate sensitive data into audit storage. Define redaction/tokenization by field, integrity controls, retention, restricted access, and whether sensitive reads are always logged.

### Retention and deletion

The source explicitly leaves retention, deletion/anonymization, and import-file retention open. These are go-live blockers for an HRIS, not post-launch details.

### Tenant isolation

If only one tenant exists in the initial on-premise deployment, tenant isolation is not an immediate user outcome. If retained as a technical invariant, it creates additional security test burden. The business must confirm whether future shared hosting/multiple organizations is real enough to justify it now.

### Backups and non-production data

The source lacks requirements for:

- encryption at rest and backup encryption;
- production-data use in development/test;
- masking/anonymization in non-production;
- backup access and retention;
- secure disposal;
- restoration access auditing.

## 9. Scope Boundaries

### In scope for MVP

- On-premise Persian RTL desktop web application.
- LDAP/AD-backed login, granular authorization, and session control.
- Person, Employment, organization, Assignment, and reference data.
- Effective-dated events for start, termination, return, transfer, role/title/seniority/grade/compensation/contract changes, and secondary Assignment.
- Draft, finalization, future/past dating, cancellation/reversal/correction, timeline.
- Current state and supported historical reconstruction.
- Headcount approvals, consumption/release, concurrency control, and override.
- Search, filter, profile, basic dashboards/reports.
- Initial current-state and partial-history migration via Baseline and batches.
- Filtered CSV/XLSX data export.
- Audit and on-premise operational readiness.

### Explicitly out of MVP

- Payroll and financial salary calculations.
- Attendance, leave, mission.
- ATS/pre-start recruitment.
- Full promotion workflow and committee.
- General process engine.
- Interactive organization chart.
- Predictive/advanced analytics.
- Employee self-service.
- Mobile/tablet-specific experience.
- Bilingual UI.
- Notifications/email/SMS except possible technical login needs.
- Personnel document management unless separately approved.

### Boundary clarifications needed

- Is full organization historical reconstruction Must or Should? Both appear.
- Is secondary Assignment Must or Should? It is in event scope but listed Should Have.
- Is sensitive-read audit Must or Should/“if possible”?
- Is async import Must or Should?
- Is saving common filters in MVP? It appears only in prioritization.
- Is all listed sensitive profile data in MVP, or only model-ready for later?
- Does “simple reporting” include every report enumerated in the long catalogue?
- Is LDAP a hard launch dependency or can a local account be used in initial acceptance?
- Does “on-premise” permit outbound services, centralized monitoring, or remote vendor support?

## 10. Success Metrics

### Metrics named by the source

- Personnel profile coverage.
- Migrated history coverage.
- Import quality.
- Calculated-state consistency with HR-approved data.
- Reduction in Excel usage.
- Event-entry error/correction rate.
- Time to find a record/event/report.
- Target-user adoption.
- Audit coverage.
- Percentage of starts/transfers checked against valid headcount.

### Assessment

None currently has a numeric target, baseline, measurement window, population definition, data source, owner, or decision threshold. Therefore, the source has candidate metrics but no success criteria.

### Required metric specification

For each metric, the PRD should state:

- exact numerator/denominator or timing definition;
- baseline date and collection method;
- launch target and post-launch target;
- measurement window;
- owner;
- source system/query;
- excluded cases;
- action if target is missed.

### Missing outcome metrics and counter-metrics

Potentially necessary, pending owner confirmation:

- time to complete routine HR events;
- reconciliation defects per 100 migrated people/events;
- percentage of active workers with unresolved data-quality flags;
- projection freshness/recalculation lag;
- unauthorized-access or sensitive-export incidents;
- headcount override rate and aging;
- support tickets and manual workarounds;
- user task success/error rate;
- report reconciliation failure rate;
- system availability and restore-test success.

Counter-metrics are absent. Examples: faster event entry must not increase corrections; reduced Excel use must not push shadow copies to email/local drives; strict headcount control must not cause excessive overrides; broad reporting adoption must not increase sensitive-data exposure.

## 11. Open Questions

The source incorrectly says LDAP is the only main open issue. The following require explicit decisions.

### Policy and access

1. Which roles may see each sensitive data category?
2. Is access organization-scoped (self/team/department/legal entity/all) or only field-scoped?
3. Is the Viewer role one role or several personas with different scopes?
4. Who can see compensation, national ID, family, religion, health, bank, insurance, and termination reason?
5. Is sensitive-record viewing always audited?
6. Who may export which fields, rows, and volumes?
7. Is manager access limited to direct/indirect reports, and how is that hierarchy derived before the chart/reporting-line model exists?
8. What is the break-glass process?
9. Who administers roles: System Admin, HR Admin, security, or dual control?
10. Is secondary approval intentionally absent for compensation, termination, retroactive changes, and mass import?

### Event semantics

11. What is the exact difference between Cancel, Reverse, and correction?
12. Does correction supersede the original with replacement facts, or apply a compensating delta?
13. Can a corrected event itself be corrected or reversed, and how is the chain resolved?
14. What is the canonical event ordering when effective dates are equal?
15. Are effective values dates or timestamps? Which timezone and end-of-day semantics apply?
16. Does “finalized immediately valid” mean valid record status or effective in current state? This conflicts with future events.
17. Which conflicts are blockers versus warnings?
18. What happens to dependent later events when an earlier event is corrected?
19. What happens when retroactive recalculation changes headcount consumption or creates historical over-capacity?
20. Can a retroactive event alter a closed payroll/reporting period even though payroll is out of scope?
21. What user-visible status exists while projections are recalculating?
22. What is the acceptable recalculation lag and failure recovery behavior?

### Headcount

23. Is every primary Assignment required to consume headcount, or only “when needed”?
24. How is a compatible approval selected when multiple approvals match?
25. Can one Assignment consume a specific seat/unit, or only a pooled count?
26. Is capacity reserved for future-dated starts/transfers? If so, from booking or effective date?
27. Can two future events reserve the same final capacity?
28. What happens when an approval expires after a future event is scheduled but before it takes effect?
29. What happens when title/seniority changes make an existing Assignment incompatible?
30. Does correcting/reversing start, termination, or transfer replay capacity history?
31. Can secondary Assignments ever consume headcount, and who configures that exception?
32. Can a Team have approvals across multiple Legal Entities or contracting entities?
33. Does override create negative availability, an exception consumption, or no consumption?
34. Is override limited to shortage only, or also title/seniority/validity mismatch?
35. What override-rate threshold triggers governance action?

### Person and organization

36. Is personnel code globally stable forever, and can it ever be corrected?
37. How are duplicate Persons merged without corrupting history?
38. What identifies a returning person when national ID is absent or changed?
39. Can a person work concurrently for multiple Legal Entities? The one-active-Employment rule may prevent legitimate cases.
40. What is the approved rule for overlapping contracts under one Employment?
41. Must every active worker belong to a Team, or can primary Assignment target higher levels?
42. Exactly one middle manager per Team: hard block, warning, or override?
43. How are acting/interim/co-managers represented?
44. What happens to history when organizational units are moved within the hierarchy?
45. What disposition is required before deactivating a unit with active members?

### Data governance

46. Which listed profile fields are truly MVP-required?
47. What purpose justifies each sensitive category?
48. What retention periods apply by record/event/audit/import/export category?
49. What is the deletion/anonymization policy after termination?
50. What legal holds or investigations prevent deletion?
51. How can a data subject request correction?
52. Can real production HR data be used in test/UAT?
53. How are non-production datasets masked?
54. Who owns Data Dictionary approval and ongoing changes?
55. Which system is authoritative for each field after go-live?

### Migration

56. What exact date defines Baseline?
57. Who signs off the baseline and reconciliation tolerance?
58. Are warnings importable, or must every warning be resolved?
59. Is import all-or-nothing by file, sheet, entity, or row?
60. What maximum file/row size must be supported?
61. How are import templates versioned?
62. Is idempotency based on file hash, source IDs, business keys, or batch replay?
63. How are corrected source files re-imported?
64. Are imported files retained, encrypted, and deleted on a schedule?
65. What discrepancy threshold blocks go-live?

### Metrics and launch

66. What are baseline and target values for every success metric?
67. What period after go-live determines MVP success?
68. Who owns adoption and retirement of parallel Excel processes?
69. What exceptions allow continued Excel use?
70. Which Must Have requirements are true launch gates versus post-launch backlog?
71. What is the UAT pass criterion and who signs each domain?
72. What reconciliation variance is acceptable?

### Operational/NFR

73. What are availability, RPO, and RTO targets?
74. What are p95 performance targets and load profiles?
75. What are max supported data volumes?
76. What browser versions are supported?
77. What accessibility target applies?
78. Who responds to failed projections/imports/LDAP outages?
79. What is the maintenance and support window?
80. Must TLS be mandatory everywhere?
81. Is encryption at rest required, including backups and generated exports?

### LDAP/AD

82. LDAP vs Active Directory and version.
83. Server addresses, ports, Base DN, bind method, and service account.
84. LDAPS/StartTLS and certificate trust.
85. Username, email, and personnel-code attributes.
86. Group-to-role mapping.
87. Disabled/deleted user behavior for existing sessions.
88. Server redundancy/failover.
89. Network restrictions and test environment.
90. Session/timeout policy.
91. Emergency local account policy.
92. MFA or conditional access expectation.

## 12. Contradictions and Internal Inconsistencies

### C-01 — Viewer access vs least privilege

- Viewer can see all information, including sensitive data.
- The product principle says access should be minimized and permission-based.
- Compensation is also said to require an independent permission.

**Impact:** Undefined authorization acceptance, likely privacy breach.

### C-02 — Single-tenant deployment vs multi-tenant Must Have

- Initial deployment is one on-premise organization and one active tenant.
- Every business table must carry tenant ID; isolation is treated as MVP acceptance and Must Have.

**Impact:** Added complexity and test/security burden without a confirmed launch user need. Keep only if a near-term multi-organization roadmap or hard product-platform strategy is approved.

### C-03 — “Final immediately valid” vs future scheduling

- A finalized event is said to become valid immediately.
- A future event is finalized/Scheduled but must not affect current state until effective date.

**Resolution needed:** Separate “finalized/authoritative” from “effective in evaluated state.”

### C-04 — Correction semantics are not singular

- Mistakes may use Cancel, Reverse, or a correction event.
- Cancel is also defined specifically as pre-effect; Reverse is post-effect.
- “Correction” is not assigned a precise state transition or calculation rule.

**Impact:** Different implementations can produce different histories and current state.

### C-05 — Conflict handling: block vs warn

- Known conflicts should be checked.
- Acceptance says conflicting events should be “blocked or explicitly warned.”

**Impact:** No deterministic acceptance rule or policy enforcement.

### C-06 — Historical reconstruction priority

- Historical reconstruction is central to the thesis and appears in MVP scope/acceptance.
- “Complete historical organization state” is only Should Have.

**Impact:** The core promise may be delivered only partially without a declared minimum.

### C-07 — Secondary Assignment priority

- The domain and event catalogue include secondary Assignment behavior.
- Prioritization lists it as Should Have, not Must Have.

**Impact:** Primary data model and headcount logic may be designed around a non-launch feature without clear scope.

### C-08 — Sensitive-read audit priority

- Audit section says sensitive views should be logged “if technically possible.”
- Security posture and risk mitigation imply it is needed.
- Prioritization lists it as Should Have.

**Impact:** Launch may expose highly sensitive records with no read trace.

### C-09 — Headcount required vs conditional

- Starts and transfers require valid headcount.
- Every primary Assignment is linked to capacity “if needed.”

**Impact:** It is unclear which workers/assignments are exempt and how dashboard totals reconcile.

### C-10 — Role model vs named users

- The system has System Admin, HR Admin, HR Operator, Viewer.
- User stories mention “manager or Viewer”; stakeholders include team managers and senior management.

**Impact:** No scoped manager role exists, encouraging the over-broad Viewer shortcut.

### C-11 — Person active flag vs employment status

- Person includes active/inactive state.
- Termination makes the person inactive “from employment perspective” but Person identity must remain.

**Impact:** Two concepts can be conflated in data, filtering, retention, and return handling.

### C-12 — On-premise TLS is conditional

- Product handles highly sensitive HR data.
- TLS is required only “if supported by infrastructure.”

**Impact:** Security control is treated as optional when it should be a deployment prerequisite.

### C-13 — Only LDAP remains open

- The source claims only LDAP details remain open.
- Retention, deletion, Viewer access approval, export policy, RPO/RTO, Data Dictionary, Baseline, role matrix, metrics, and event/headcount rules remain explicitly unresolved.

**Impact:** False confidence and unsafe handoff to delivery.

### C-14 — “All Must Have” release gate vs flexible wording

- Release requires all Must Haves.
- Many Must-Have areas use “preferably,” “if possible,” “if needed,” “according to final design,” or unresolved policy.

**Impact:** Release gate cannot be objectively evaluated.

### C-15 — 2–3 week estimate vs enterprise launch scope

- A 2–3 week initial estimate is cited.
- Scope includes temporal event engine, migration, headcount concurrency, sensitive permissions, audit, reports, backup/restore, UAT, and production hardening.

**Impact:** Schedule is not credible until scope slices, team capacity, existing platform, and migration quality are known.

## 13. Hidden Assumptions

- Excel data can be cleaned enough to establish authoritative state.
- HR can identify a trustworthy Baseline date.
- Personnel codes are stable and known for returning workers.
- One active Employment is valid for all business cases.
- Team is the normal primary unit for every active worker.
- Event history can represent all material changes without storing ambiguous snapshots.
- Effective date alone is sufficient for most business ordering.
- Past corrections are permitted organizationally and legally.
- Recalculation can safely rewrite derived current/historical outputs.
- There are no downstream consumers that require immutable previously published reports.
- Headcount is a pool tied to team/title/optional seniority rather than named positions.
- HR Admin override is acceptable without secondary approval.
- Middle-manager role plus team membership reliably means team manager.
- Managers do not require scoped access distinct from enterprise Viewer access.
- Storing every field found in Excel is permissible.
- On-premise infrastructure can provide TLS, backup, monitoring, database transactions, job execution, and reliable time.
- LDAP identity can be reliably matched to a Person/internal account.
- Approximately 500 personnel implies low enough event/report volume, though years of history may dominate.
- Persian-only UI meets all user needs, including technical administrators.
- Desktop-only access is operationally acceptable.
- “Simple dashboards” can be delivered without a separately governed metric catalogue.
- Migration provenance can coexist with event immutability without confusing users.
- Projection/cache architecture is necessary, though no measured need is established.
- Future multi-tenancy is valuable enough to influence every data and access path now.

## 14. Material to Move to an Addendum or Architecture Document

The PRD should retain required behavior and constraints, but move implementation “how” and detailed technical design.

### Move to architecture/solution addendum

- Mandatory `tenant_id` column on all business tables.
- Database foreign keys and uniqueness implementation.
- Projection storage and rebuild mechanism.
- Event sourcing/projection terminology and implementation options.
- Atomic transaction and rollback mechanism details.
- Concurrency control implementation for last headcount unit.
- Retry/idempotency implementation and job mechanics.
- LDAP adapter design and low-level connection parameters.
- Service accounts, Base DN, bind details, server failover configuration.
- Structured logging, health-check endpoint design, correlation-ID mechanics.
- Database/storage monitoring details.
- Internal date storage representation and timezone implementation.
- Import file hash mechanism.
- Cache/projection timestamp mechanism.
- Exact physical entity/attribute lists that belong in Data Dictionary.
- API design and validation-layer placement beyond the behavioral backend-enforcement requirement.
- Environment topology, machines, database choice, deployment sequence.
- Backup tooling and restore procedure mechanics.

### Move to delivery/test addendum

- Proposed phase-by-phase implementation plan.
- Unit/integration/performance/security test inventory.
- Detailed UAT scenario list after requirements receive stable IDs.
- 2–3 week estimate discussion and re-estimation mechanics.
- Full technical readiness checklist.

### Move to UX specification

- Detailed profile section layout.
- Form sectioning and table interactions beyond outcome-level usability.
- Chart presentation details.
- Responsive layout behavior and horizontal-scroll design.
- Date-picker component behavior.

### Keep in the core PRD

- Event immutability as a business/audit requirement.
- Past/future effective dates and deterministic results.
- No over-capacity under concurrency.
- Historical reconstruction outcomes.
- Permission and sensitive-data boundaries.
- Import atomicity and traceability as user/business outcomes.
- On-premise deployment constraint.
- Performance, availability, recovery, security, and privacy thresholds once quantified.
- Launch gates and success targets.

## 15. Recommended PRD Decision Gates

Before the source can be distilled into a launch-grade PRD, owners should close these gates:

1. **Data access gate:** approve a field/category × action × organizational-scope matrix; remove default all-sensitive Viewer access.
2. **Event semantics gate:** define authoritative event ordering, correction/reversal/cancel chains, dependency handling, and retroactive recomputation.
3. **Headcount policy gate:** define mandatory applicability, matching/reservation/expiry/override behavior, and correction replay.
4. **Data-governance gate:** approve purpose, retention, deletion/anonymization, export, audit, non-production, and data-subject correction policies.
5. **MVP boundary gate:** resolve Must/Should conflicts for historical organization state, secondary Assignments, sensitive-read audit, async import, and multi-tenancy.
6. **Operational gate:** set TLS, availability, RPO/RTO, performance, browser, support, monitoring, and restore thresholds.
7. **Migration gate:** approve Baseline, source templates, idempotency, reconciliation tolerances, and sign-off ownership.
8. **Success gate:** assign measurable targets, owners, windows, and counter-metrics before go-live.

## 16. Launch-Grade Readiness Verdict

**Verdict: strong domain draft, not decision-ready for launch.**

The source can support PRD creation without re-discovery of the whole domain. However, it should not be treated as final or handed directly to architecture/epics as an authoritative contract. The highest-risk ambiguity is not LDAP; it is policy and semantic ambiguity around sensitive access, event correction, temporal/headcount behavior, data governance, and measurable launch success.
