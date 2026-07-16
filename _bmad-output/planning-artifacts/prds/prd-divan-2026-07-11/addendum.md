# Divan HRIS — Product/Architecture/Data Addendum

**Status:** Final companion to `prd.md`  
**Date:** 2026-07-12  
**Authority:** This addendum is **non-authoritative for product scope**. The PRD's FRs, NFRs, scope boundaries, staged decision gates, and owner decisions take precedence. This document preserves implementation-relevant detail, options, and candidate inventories for architecture, UX, data governance, migration, delivery, and test planning. An item here is not a launch requirement unless the PRD explicitly makes its outcome a requirement.

## 1. Required Downstream Decisions

The authoritative owner, approver, timing, blocking effect, and affected requirement mapping are in the PRD's §7.1 Launch Artifact Register and §7.2 decision stages. This addendum cannot defer or weaken those gates. Before an affected architecture, delivery, or feature baseline is accepted, the relevant versioned artifacts must include:

- AR-TEMPORAL product semantics and an architecture decision record for persistence, derived state, rebuild/recalculation, idempotency, and failure recovery;
- AR-DATA Data Dictionary/lifecycle register and migration mapping workbook;
- AR-ACCESS authorization/entitlement/break-glass/bulk/inference matrix;
- AR-HEADCOUNT deterministic matching/Reservation/expiry/Override acceptance oracle;
- AR-IDENTITY and AR-AUDIT lifecycle/trust-boundary contracts;
- AR-SECONDARY finite Secondary Assignment launch inventory;
- a UX specification for Persian RTL navigation, forms, tables, timelines, import/reconciliation, errors, and sensitive actions;
- AR-NFR operational/security acceptance profile for LDAP/AD, TLS, sessions, monitoring, protected backups/restore, support, and incident response;
- AR-REPORTING formula/report/publication catalogue;
- AR-MIGRATION and AR-CUTOVER delivery, reconciliation, rollback, and traceable acceptance plans.

No technical stack is selected or recommended by this addendum.

### 1.1 Artifact and policy change control

FR-55 and the PRD Launch Artifact Register are authoritative. Downstream governance should retain:

- stable artifact ID, version, status, effective/expiry dates, owner, approvers, and affected FR/NFR/build/evidence;
- immutable approval history and supersession links;
- waiver scope, independent approver, stated risk, compensating controls, expiry, review, and closure evidence;
- automatic review of expired approval/waiver before continued use;
- impact assessment and reapproval after material PRD, policy, data-category, formula, architecture, dependency, or build change;
- proof that production evidence was generated against the deployed build and controlling artifact versions.

## 2. Conceptual Domain Model

### 2.1 Core relationships

- **Person** is stable across time and has one stable Personnel Code unless an approved correction procedure changes it.
- A Person has zero or more historical **Employments** and at most one active Employment at an instant in MVP.
- An active Employment has exactly one active **Primary Assignment** and may have multiple **Secondary Assignments**.
- An Assignment references effective versions of relevant **Organizational Units** and job concepts: Organizational Role, Job Title, Ladder, Grade, and Seniority.
- Legal Entity contains Business Unit; Business Unit contains Department; Department contains Team.
- Contracting Entity and Insuring Entity may differ from the organizational Legal Entity.
- **Personnel Events** target Person and, where applicable, Employment/Assignment and produce effective-dated changes.
- **Headcount Approval** provides pooled units by Team + Job Title + optional Seniority.
- A consuming Primary Assignment or future **Reservation** links back to the applicable Headcount Approval or approved exemption/Override.
- **Import Batch** is provenance for imported records, Baseline facts, and imported Personnel Events.
- Audit evidence references users, operations, entities, outcomes, reasons, and correlation context without needlessly copying sensitive values.

**Future domain concepts (non-MVP, forward-compatible only):**

- **Workstation** is a physical seat/desk with a unique **Workstation Code** within the organization boundary.
- **Floor Map** represents a floor or site layout and the positions of Workstations on it.
- **Workplace Placement** links a Person to a Workstation for a time interval; it is separate from Organizational **Assignment**, **Headcount Approval**, and free-text profile **work location/site**.
- A Person typically has at most one active primary Workplace Placement at an instant; moves should be historically reconstructable.

These concepts are not MVP requirements. They exist so architecture and data design can avoid irreversible coupling that would block a later seating module.

### 2.2 Conceptual invariants

- Person identity and Employment status are separate concepts.
- Employment periods do not overlap in MVP.
- Primary Assignment periods do not overlap and cover active Employment.
- Secondary Assignment requires a reason/type and does not consume capacity by default.
- Grade belongs to Ladder; Seniority remains independent.
- Finalized events and audit evidence are never directly edited or hard-deleted by routine operations; AR-DATA retention/disposal actions may minimize, anonymize, restrict, or dispose of governed values while preserving required proof and reconstruction-limit evidence.
- Current and historical state are reproducible from the same authoritative inputs.
- Headcount consumption, Reservation, exemption, release, and Override remain attributable to their triggering Assignment/event.
- Migration provenance never makes Baseline state look like a native business event.

### 2.3 Candidate bounded areas

Architecture may choose different boundaries, but responsibilities should remain explicit:

1. Identity and access
2. Person and Employment
3. Organization and reference data
4. Assignments
5. Personnel Event lifecycle and temporal resolution
6. Headcount governance
7. Search/reporting and derived state
8. Migration/import/export
9. Audit and operations
10. Workplace and seating (future, non-MVP)

### 2.4 AR-SECONDARY launch inventory

AR-SECONDARY is authoritative only when approved under the PRD register. Its MVP inventory MUST enumerate and acceptance-test these finite scenarios:

- migrate current and available historical Secondary Assignments with provenance;
- create a current or Scheduled Secondary Assignment only while an Employment covers its full effective interval;
- change an in-scope Secondary Assignment through an attributable effective-dated Personnel Event;
- end a Secondary Assignment explicitly or as a consequence of Employment termination;
- Cancel, Reverse, or Correct its governing Personnel Event and deterministically recalculate profile/timeline/as-of state;
- reject an equivalent overlapping Secondary Assignment for the same Person, target, reason/type, and interval;
- display current and historical Secondary Assignments in permitted profile/timeline/as-of views;
- include only the minimum launch search/report/import behavior needed to reconcile current organizational data;
- prove no headcount consumption unless a separately approved post-MVP policy changes that default.

The required Data Elements are: Person; Employment; organizational target; primary/secondary indicator; reason/type; Effective Date/start and end; applicable Organizational Role, Job Title, Ladder, Grade, and Seniority when the source record uses them; provenance/Import Batch; governing Personnel Event and Correction/Cancel/Reverse links; actor/time and audit references. Each element remains subject to AR-DATA.

Explicit non-goals are assignment-specific workflow/approval, task allocation, effort percentage, billing, scheduling, broad matrix-organization features, and default headcount consumption.

### 2.5 Physical constraints for architecture

Architecture must select enforceable mechanisms for unique identifiers, effective-date non-overlap, hierarchy validity, Ladder–Grade membership, referential history, immutability, concurrency, transactionality, and audit integrity. The source document proposed database foreign keys and uniqueness constraints; those are options, not product-level prescriptions. A universal `tenant_id` on business tables is not an MVP requirement.

For later **Workplace Placement**, architecture should additionally preserve room to:

- keep Workstation, Floor Map, and Placement as separate bounded concepts from Assignment and Headcount;
- enforce unique Workstation Code within the organization boundary;
- support effective-dated placement history and as-of reconstruction consistent with AR-TEMPORAL semantics;
- store map geometry or image assets separately from core HR transactional tables if that reduces coupling;
- apply default-deny, permission-scoped map and placement visibility consistent with AR-ACCESS;
- avoid encoding a desk/seat as an Organizational Unit, Headcount unit, or Primary Assignment surrogate in MVP.

MVP implementation must not require workstation tables, map assets, or placement APIs. Where AR-DATA enables profile **work location/site**, treat it as descriptive context only unless a future approved phase promotes coded Workstations.

## 3. Data Dictionary and Detailed Attribute Catalogue

The following is the complete inventory of candidate Data Element types, classes, and schemas from the source—not an inventory of concrete values. Values inherit their governing classification/lifecycle and require instance tracking only where an FR requires evidence. Every item is **candidate-only**, not automatically approved or enabled. The Data Dictionary MUST record an explicit disposition for every item—approved for launch, approved for later, rejected, not present/applicable, or pending owner decision—so migration and governance can prove that no source column was silently lost. Each enabled field must have business purpose, source of truth, owner, required/optional status, format, validation, uniqueness, sensitivity, permitted roles/scopes/actions, history behavior, retention/deletion/legal hold, export policy, audit/redaction rule, migration mapping, and data-quality control before enablement.

### 3.1 Candidate Person/profile categories

- **Identity:** Personnel Code; first name; last name; father name; national ID; birth certificate number; birth certificate series and serial; birth date; birth place; birth-certificate issue place; gender; nationality; religion; sect; military-service status.
- **Contact, residence, and location:** mobile phone; landline; personal email; organizational email; residential address; postal code; work location/site.
- **Family:** marital status; marriage date; spouse details; number of children; children details; dependant details; emergency-contact details; emergency-contact relationship.
- **Education:** highest education degree; field of study; specialization; university or institution; graduation date.
- **Other sensitive candidates:** bank information; insurance information; insurance number; dependant/coverage information; physical-condition/health information; and other sensitive fields specifically proposed and approved through governance.
- **Governance metadata:** source/provenance, verification state, and data-quality flags.

Religion, health, family, bank, insurance, and similar categories require heightened purpose and access review. Their presence in Excel is not sufficient justification.

### 3.2 Candidate Employment/contract categories

- first collaboration/start date;
- historical Employments;
- collaboration type;
- contract type;
- Employment/collaboration status;
- end/termination date and termination reason;
- Legal Entity;
- Contracting Entity;
- Insuring Entity;
- work location/site;
- contract dates/reference and other approved effective dates;
- return relationship to prior Employment;
- authoritative source and migration provenance.

### 3.3 Candidate Assignment/job categories

- Business Unit, Department, Team, and any approved higher-level Organizational Unit target;
- primary/secondary status and secondary reason/type;
- Organizational Role, Job Title, Ladder, Grade, Seniority;
- start/end dates;
- manager designation where policy uses Assignment facts;
- linked Headcount Approval, exemption, Reservation, consumption, and Override context.

### 3.4 Candidate compensation categories

- compensation amount and required/approved components;
- currency;
- Effective Date;
- change type;
- description/notes, reason, and reference;
- separate view/export permissions;
- masking/redaction and audit treatment.

Compensation is stored as a governed fact only; payroll calculation remains out of scope.

### 3.5 Candidate Personnel Event envelope

- unique event ID and type;
- target Person and applicable Employment/Assignment;
- Effective Date and any approved intra-date ordering key;
- registration and finalization actor/time;
- lifecycle status;
- reason/reference;
- before/after or replacement facts as required for authorized reconstruction;
- original/correction/reversal/cancellation chain links;
- conflict and acknowledgement outcome;
- provenance and Import Batch;
- linked capacity Reservation/consumption/release/exemption/Override;
- recalculation status and correlation reference.

### 3.6 Candidate Headcount Approval attributes

- unique requirement code;
- Team, Job Title, optional Seniority;
- allowed count;
- effective validity interval and lifecycle status;
- approval reference and owner;
- created/changed actor and times;
- derived used, reserved, exception, and free quantities;
- linked Assignment/event claims and Overrides.

### 3.7 Candidate Import Batch attributes

- batch identity, import type, template/version;
- original source metadata and approved retention reference;
- initiating/finalizing actor and times;
- validation/execution status;
- valid/warning/error/success counts;
- row/column errors and dispositions;
- records/events/Baseline facts created;
- idempotency/replay evidence;
- reconciliation evidence and approvals.

### 3.8 Candidate future workplace/seating categories (non-MVP)

Disposition for every item below MUST be **approved for later**, **rejected**, or **pending owner decision** in the Data Dictionary. None are enabled for MVP launch unless a future PRD change explicitly promotes them.

- site, building, and floor identifiers;
- Workstation Code and Workstation status;
- Floor Map asset/version and placement coordinates or equivalent geometry metadata;
- Workplace Placement start/end, move reason, and linked Person;
- optional reference from Workstation or Floor Map to approved profile **work location/site** without conflating the concepts;
- permission, audit, export, and retention treatment for map assets and placement history.

## 4. LDAP/AD and Session Questions

The identity design must resolve and test:

- directory type and supported versions/topology;
- endpoints, ports, Base DN, bind approach, service-account ownership/rotation;
- LDAPS/StartTLS, certificate trust, signing/channel-binding compatibility;
- username, immutable identifier, email, and Personnel Code attributes;
- duplicate, renamed, missing, disabled, locked, expired, and deleted identities;
- internal account-linking and recertification;
- LDAP group-to-role mapping versus in-application authorization;
- directory outage, timeout, retry, redundancy, and failover behavior;
- effect of directory disablement on existing sessions;
- idle and absolute session timeouts, concurrent sessions, lockout/rate limiting;
- privileged/MFA or conditional-access expectations;
- break-glass/local emergency account eligibility, storage, approval, test, expiry, and review;
- network restrictions and a representative integration-test environment;
- security and operational audit events without LDAP secrets.

The product requires LDAP/AD-backed launch authentication; any emergency local account is an operational control, not an alternative routine identity source.

## 5. Personnel Event Lifecycle Design Constraints

### 5.1 Product semantics to preserve

- Draft is editable and non-authoritative.
- Finalized means authoritative; it does not necessarily mean currently Effective.
- A future Finalized event is Scheduled and reserves relevant destination capacity where applicable.
- Effective state is evaluated by Effective Date/point, not registration time.
- Cancel neutralizes before effect.
- Reverse is a post-effect compensating neutralization.
- Correction preserves the original and creates a linked replacement/correction chain.
- Direct edit and hard deletion of Finalized events are prohibited.
- Past-dated changes recompute affected current and historical results.
- The same authoritative event set must always resolve to the same result.

### 5.2 Mechanism options still unresolved

Architecture may evaluate, without changing product semantics:

- canonical event log plus fully computed reads;
- canonical event log plus materialized projections;
- effective-dated records with immutable change ledger;
- hybrid snapshots/checkpoints plus replay;
- synchronous versus queued recalculation;
- event replacement/supersession pointers versus compensating records;
- persisted before/after values versus reproducible diffs;
- projection versioning and rebuild strategies.

No option is selected here. Selection should be based on demonstrable consistency, traceability, recoverability, scale envelope, operational simplicity, and report/query needs—not terminology preference.

### 5.3 Deterministic resolution decisions required

Architecture and HR/Product must jointly specify:

- whether effective semantics are date-only or timestamped; the organization's timezone and day boundary; and whether end rules are inclusive or exclusive;
- canonical order for different event types sharing an Effective Date;
- stable tie-breaker for same-type/same-date events;
- dependency graph and treatment of later events after an earlier Cancel/Reverse/Correction;
- whether and how a Correction itself may be corrected or reversed;
- resolved status of the original and every chain member;
- conflict classifications: hard block, warning/acknowledgement, or HR Admin Override;
- recalculation start point and affected Person, organization, headcount, and report domains;
- stale-state visibility, retry/idempotency, recovery, and reconciliation;
- treatment of previously published reports or closed business periods.

These rules must be versioned in AR-TEMPORAL, documented, and included in acceptance fixtures. They must also define correction/supersession notices for formally published decision reports under FR-54. An exact algorithm belongs in architecture, not the PRD.

### 5.4 Candidate event catalogue

- Employment start
- Employment termination
- Return / new Employment
- Primary Team/organization transfer
- Organizational Role change
- Job Title change
- Ladder/Grade/promotion-result change
- Seniority change
- Compensation change
- Contract/collaboration/entity/insurer change
- Secondary Assignment create/change/end where MVP data fidelity requires it
- Cancel, Reverse, and Correction actions linked to the affected event

## 6. Headcount Mechanics Considerations

### 6.1 Required product model

- Every Primary Assignment consumes capacity unless an explicitly approved, audited exemption applies.
- Default compatibility is Team + Job Title + optional Seniority.
- Grade and compensation do not determine capacity.
- Secondary Assignment does not consume by default.
- Used, reserved, exception/override, and free quantities must be distinguishable.
- A future start or inbound transfer reserves destination capacity at finalization.
- A future transfer leaves source capacity consumed until effect.
- At effect, source Assignment/capacity release and destination Assignment/capacity consumption are atomic.
- Cancel/Correction updates Reservation deterministically.
- Retroactive changes replay capacity effects and expose historical over-capacity.

### 6.2 Matching questions

The headcount policy must define:

- deterministic selection when multiple approvals match;
- whether pooled count is sufficient or named seat units are needed;
- whether approval priority follows specificity, validity, creation order, owner selection, or another rule;
- how a Seniority-unspecified approval competes with a Seniority-specific approval;
- treatment of Team/Job Title/Seniority changes after consumption;
- treatment of approval edits, cancellation, or expiry while occupied or reserved;
- whether correction can rebind an Assignment to a different approval;
- whether any Secondary Assignment policy may consume capacity;
- how contracting/insuring/legal-entity distinctions affect approvals.

### 6.3 Safe Reservation default to validate

The PRD adopts the conservative product default: destination capacity is reserved at future-event finalization, concurrent events cannot share the last unit, and the source remains consumed until transfer effect. If the linked approval expires or becomes incompatible before effect, no partial Employment/Assignment/capacity effect occurs until governed resolution. This prevents overbooking but can reduce near-term apparent availability. **Approval status is pending:** AR-HEADCOUNT has no approved version/location yet, and the headcount architecture baseline remains blocked until Workforce Planning approves the trade-off, Reservation horizon, intervention deadline, and cancellation/escalation rules.

### 6.4 Override representation

Architecture must retain the violated rule and actual capacity context. An Override should not make an exception disappear by reporting free capacity as non-negative. Candidate representations include explicit exception consumption, negative availability, or a separate exception ledger; reporting semantics must remain consistent with PRD outcomes.

### 6.5 Concurrency and replay

Mechanism is an architecture choice, but acceptance must prove:

- two simultaneous claims cannot acquire one remaining unit;
- transfer failure preserves prior Assignment and capacity;
- retry does not duplicate consumption/release;
- Cancel/Reverse/Correction cannot orphan a claim;
- recalculation from authoritative inputs reproduces the same used/reserved/free history.

## 7. Migration and Data-Governance Detail

### 7.1 Discovery and preparation

- Inventory all source workbooks, sheets, owners, consumers, refresh processes, and shadow copies.
- Identify the authoritative source for each candidate field and relationship.
- Profile completeness, uniqueness, formats, invalid enumerations, duplicates, orphan relationships, date overlaps, and conflicting histories.
- Approve field inclusion through the Data Dictionary before mapping.
- Define Baseline date and reconstructable-history boundary.
- Document transformations, defaults, normalizations, rejected values, and owner decisions.

### 7.2 Template and validation design

Decide:

- supported CSV/XLSX formats and exact launch format(s);
- template/version compatibility;
- import type identification;
- required sheets/columns and order flexibility;
- date/number/text conventions and Jalali/Gregorian source handling;
- stable source identifiers and business keys;
- enum/reference resolution;
- duplicate detection within file, across files, and against target;
- maximum file, row, and history sizes;
- whether rows with warnings are importable and, if so, what approval they require;
- all-or-nothing boundary: file, sheet, entity group, or another unit;
- idempotency/re-import rule: file hash, source ID, business key, batch replay, or combination;
- corrected-source re-import and rollback procedure.

Mandatory product safeguards from FR-37, FR-38, and FR-52 apply regardless of mechanism:

- accept only AR-DATA-approved Data Elements and templates;
- bind each production batch to attributable source identity, template/version, approval, and execution actor;
- apply the canonical formula/active-content safeguard in §10.1;
- permission-filter preview, row/column errors, valid rows, filenames, and source metadata;
- revalidate against current authoritative data and references at execution;
- detect conflicting concurrent batches and prevent silent overwrite;
- for a frozen sensitive production batch, separate preparation/upload and validation review, independent approval, and separately authorized production execution; trial/UAT batches follow the segregation tier explicitly approved in AR-MIGRATION;
- apply retention/expiry and purge evidence to source, staging, preview, error, failed, replay, and corrected-import artifacts.

### 7.3 Reconciliation package

Trial and final reconciliation should include:

- source/target Person and Employment counts;
- unique Personnel Code and approved identifier coverage;
- active Employment and Primary Assignment counts;
- duplicate and orphan counts;
- required/critical-field completeness;
- organization hierarchy and reference mappings;
- Ladder–Grade validity;
- Baseline and migrated-event coverage;
- current state and selected as-of state samples;
- Team membership and manager counts;
- headcount approved/used/reserved/free and Override totals;
- selected high-risk numeric control totals, where approved;
- every warning/error/exception and disposition;
- signer, timestamp, source extract/version, and rollback decision.

### 7.4 Data handling

AR-DATA and AR-NFR must govern encryption, access, retention, deletion, and evidence treatment for source files, staging data, validation outputs, Import Batches, generated exports, backups/copies, logs, caches, and non-production data.

Real production HR data is prohibited in non-production by default. An exception requires documented necessity, the minimum dataset, masking proportionate to re-identification risk, a recorded re-identification assessment, named owner, scoped/time-bound recipients, copy inventory, and verified purge evidence. Restoring a production backup to non-production follows the same exception process. Backups, replicas, restores, and other copies require equivalent or stronger confidentiality, minimal separately controlled access, audit/review, approved destination, retention/expiry, disposal evidence, and unauthorized-access testing.

## 8. Reporting and Metric Catalogue

### 8.1 Required launch search and filters

The following behaviors are launch-core under FR-33, subject at every step to Data Dictionary approval and default-deny permission/Organizational Scope:

- **Personnel search fields:** first name, last name, Personnel Code, national ID, email, phone, Job Title, Team, Department, and Business Unit.
- **Launch filters:** Employment status; start and termination dates; Legal Entity; Business Unit; Department; Team; Organizational Role; Job Title; Ladder; Grade; Seniority; collaboration type; contract type; Contracting Entity; Insuring Entity; work location; Personnel Event type; Effective Date; registering user; Headcount Approval; headcount status.
- **List behavior:** sorting, pagination, selectable approved columns, result count, filtered export, a clear empty-result state, and a clear Persian-language invalid-filter error. Retaining filters only for the active session is desirable but non-gating.

### 8.2 Required launch dashboard

The launch dashboard is not an optional future catalogue. It must provide:

- **Current indicators:** active Person count; Legal Entity, Business Unit, Department, and Team counts; open Headcount Approval count; total approved, used, reserved, and free capacity.
- **Workforce trend:** active workforce trend calculated from Effective Date; selectable time range; daily, monthly, or another Product/HR-approved granularity suitable to the range; organizational filtering.
- **Team membership/capacity:** current Primary Assignment member count by Team; Team capacity, used capacity, and free capacity; sorting by count/capacity; organization filtering.
- **Starts versus terminations:** counts and comparison over the selected range; trend display; Legal Entity, Business Unit, Department, and Team filters.
- **Open headcount:** approvals with free capacity; total free units; Team, Job Title, and optional Seniority breakdown; near-expiry and expired approvals, with expired capacity visibly non-consumable.
- **Synchronization and reconciliation:** shared organization/time filters update all applicable indicators consistently; current/as-of semantics remain permission-safe; every indicator reconciles to its underlying detail data.

### 8.3 Required launch report catalogue

FR-36 requires all of the following at launch:

- active Persons;
- all Persons, including ended Employments;
- current organization state;
- members of each Team;
- inferred middle manager for each Team;
- Person distribution by Organizational Role;
- Person distribution by Job Title;
- Person distribution by Ladder and Grade;
- Person distribution by Seniority;
- Person distribution by collaboration and contract type;
- starts in a selected period;
- terminations in a selected period;
- Team transfers;
- Organizational Role, Grade, and compensation changes;
- Headcount Approvals;
- used and free headcount;
- headcount Overrides;
- future Scheduled events;
- Corrected, Cancelled, and Reversed events;
- Import Batch outcomes and errors.

These reports apply user access filters, use Jalali display dates, calculate temporal values from Effective Date, support approved current/as-of or period semantics, permit filtered export under FR-41, and show last calculation/update time when derived state is used.

### 8.4 Additional non-launch catalogue candidates

- Contracting Entity and Insuring Entity distributions beyond launch-required collaboration/contract reporting;
- Secondary Assignment reports beyond current-data fidelity needs;
- broader historical organization analytics beyond core as-of counts;
- change-event volume analytics;
- profile completeness and data-quality exception analytics;
- access/entitlement review and sensitive-read analytics;
- export activity and unusual-volume analytics;
- correction/rework and support analytics.

### 8.5 Metric definition requirements

Every approved metric must define:

- business question and owner;
- numerator/denominator or timing formula;
- population, Organizational Scope, filters, and excluded cases;
- current versus as-of versus period semantics;
- Effective Date versus registration-date treatment;
- treatment of Scheduled, Cancelled, Reversed, Corrected, Baseline, exempt, and overridden records;
- source/query and refresh/freshness;
- display and export permissions;
- baseline; targets for launch and 30, 60, and 90 days after launch; measurement window; and remediation trigger.

Metric-definition approval is mandatory and may refine formulas, granularity, and presentation; it does not make the launch behaviors in §§8.1–8.3 optional. AR-REPORTING must implement the PRD-required small-cohort, zero/small-cell, differencing, repeated-query, comparison, and drill-down protection or an approved equivalent consistently across screen/export. Telemetry privacy, cohort suppression, thresholds, and sequential-query acceptance fixtures are due before the reporting feature baseline.

## 9. UX Design Inputs

The UX specification should preserve:

- Persian-only MVP content and RTL layout;
- Jalali date entry/display with unambiguous timestamps;
- desktop task support at 1280×720 to 2K, reference 1920×1080;
- permission-safe search, facets, result counts, columns, and empty/error states;
- sectioned long forms, visible required fields, inline validation, and unsaved-change warning;
- explicit consequence confirmation for finalization, termination, Cancel, Reverse, Correction, Override, import, and export;
- profile separation of identity, current Employment, current Assignments, approved sensitive categories, prior Employments, and timeline;
- timeline distinction among Effective Date, registration/finalization time, Draft/Scheduled/Effective/Cancelled/Reversed state, provenance, and correction chain;
- capacity presentation distinguishing used, reserved, free, exempt, and overridden;
- import preview with row/column errors, warnings, and reconciliation;
- stale/recalculation/failure state that cannot be mistaken for current truth;
- controlled wide-table scrolling without losing essential context/actions;
- keyboard, focus, contrast, and assistive behavior once the accessibility target is approved.

## 10. Cross-Cutting Security and Operations

### 10.1 Secure export, retrieval, and formula safety

AR-ACCESS, AR-DATA, AR-REPORTING, and AR-AUDIT must specify the acceptance oracle for:

- export fields/population bound to the permission-filtered reviewed snapshot;
- the canonical formula/active-content safeguard: reject workbook formulas, macros, external links, and other active structures on import; preserve and display plain-text values beginning with formula-control characters as literal text; escape them safely on spreadsheet export so opening the file cannot execute them;
- no sensitive or out-of-scope Data Elements in filenames, metadata, preview, cache, or error artifacts;
- reauthorization at generation and every retrieval/download;
- artifact owner/requester, purpose, classification, scope/fields, creation, expiry, status, retrieval evidence, revocation, and disposal evidence;
- revocation after role/scope/incident change and denial through stale links;
- approved volume/window/column/range controls and independent approval where retrieval is sensitive or bulk;
- visible classification, handling, and expiry notice; recipient/destination class and custody-transfer evidence; explicit handling/disposal/incident acknowledgement for sensitive/bulk export;
- controlled retention, storage, delivery, and disposal without prescribing a technical transport;
- an explicit custody boundary: Divan can revoke managed artifacts and links but cannot revoke or delete copies saved locally, sent by email, or shared after download; those copies follow the organization's disposal and incident process.

### 10.2 FR-53 bounded attachment safety

General document management remains out of scope. If AR-DATA explicitly permits bounded correction-case attachments, its owner-approved policy and acceptance oracle must require:

- an allowlist of permitted file types and maximum sizes;
- rejection of active/executable/script/external-link content and unauthorized archive content, or inert-download-only handling where the policy explicitly approves that case;
- minimized filename and metadata;
- permission-safe preview and download under AR-ACCESS, with audit under AR-AUDIT;
- quarantine and fail-safe errors for suspicious, unsupported, failed-inspection, or policy-conflicting content;
- no automatic execution of attachment content;
- acceptance fixtures for allowed, rejected, quarantined, previewed, and downloaded cases.

The architecture selects inspection, isolation, preview, and storage mechanisms without changing these outcomes.

### 10.3 Operational and security acceptance

Architecture and operations stakeholders must turn PRD NFR gates into an acceptance profile covering:

- TLS termination and encryption for every application/identity/admin path;
- certificate issuance, renewal, ownership, and trust;
- encryption/access/retention for data, backups, logs, imports, exports, and configuration;
- clock synchronization and timezone;
- redacted structured technical logs, correlation, metrics, health, alerting, and incident routing;
- derived-state/import job visibility, retries, idempotency, failure quarantine, and reconciliation;
- backup coverage for data, configuration, keys/certificates, and dependencies;
- backup isolation and access;
- recovery runbook, roles, authority, communication, and witnessed restore evidence;
- before restoring user access, catch up all changes since the backup in disposal and holds, identity and entitlement revocations, artifact expiry and revocation, policy versions, and Personnel Events and Corrections, and reconcile derived state; restored sessions, queued work, and emergency grants remain invalid;
- support hours, severity model, response/restoration targets, and maintenance;
- production-data masking/prohibition in non-production;
- audit integrity, review access, retention, and sensitive-value minimization;
- unusual export and privileged-access monitoring.

Exact acceptance thresholds and workload/environment bounds are owner decisions that block at the earliest applicable PRD §7.2 architecture/delivery/feature stage. They must be version-frozen in AR-NFR before that baseline; at the production stage, only evidence against the frozen version is verified. Later changes require FR-55 impact-assessed rebaseline. This addendum does not invent values.

### 10.4 Security assurance inputs

AR-NFR must define product acceptance outcomes for threat modeling, vulnerability and patch handling, secret/key lifecycle, environment hardening, security test coverage, independent assessment/penetration testing where required, incident response, and finding severity. Tool and implementation choices remain open.

## 11. Proposed Delivery Sequencing

This is a planning hypothesis, not a commitment or product priority override.

1. **Decision foundation:** close Data Dictionary, access, event, headcount, Baseline, report, and NFR gates.
2. **Identity/control foundation:** LDAP integration, internal accounts, authorization model, audit foundation, TLS/operational skeleton.
3. **Domain foundation:** Person, Employment, organization/reference data, Primary Assignment, required Secondary Assignment fidelity.
4. **Temporal core:** event envelope, Draft/finalization, Scheduled/Effective evaluation, timeline, deterministic conflict/order/correction behavior.
5. **Core operations:** start, termination, return, transfer, job/level/contract/compensation changes.
6. **Headcount:** approvals, matching, Reservation, atomic movement, exemptions, Overrides, concurrency/replay.
7. **Experience/reporting:** search, profile, historical views, dashboards, approved reports, export.
8. **Migration:** templates, validation/preview, Baseline/event loading, provenance, trial batches, reconciliation.
9. **Hardening/readiness:** security, performance, concurrency, accessibility, browser, backup/restore, UAT, training, cutover rehearsal.
10. **Go-live and stabilization:** controlled cutover, integrity/security/operations monitoring, 30/60/90 reviews.

Dependencies may require vertical slices and repeated migration rehearsals rather than completing each stage in isolation. The source document's 2–3 week estimate is not credible without architecture, team capacity, existing-platform assessment, data profiling, and delivery slicing.

## 12. Testing Strategy and Candidate Inventory

This section is non-authoritative test-planning input. Final tests should trace to FR/NFR IDs and approved policies.

### 12.1 Unit/property testing

- date conversion and business-day preservation;
- period overlap and one-active-Employment/Primary-Assignment invariants;
- event-chain resolution and stable same-date ordering;
- headcount matching, Reservation, release, exemption, and Override arithmetic;
- permission/scope/category decisions;
- import parsing, validation, and idempotency keys;
- metric formulas.

### 12.2 Integration testing

- LDAP identity/link/lifecycle/outage/certificate cases;
- authorization at every protected backend path;
- organization/reference historical validity;
- event finalization through derived state;
- retroactive recalculation and dependent events;
- headcount concurrency and atomic transfers;
- import rollback and reconciliation;
- audit generation, redaction, immutability, and correlation;
- backup and restore across required dependencies.

### 12.3 Acceptance scenarios

- future transfer reserves destination capacity but does not change current Team;
- two concurrent starts cannot reserve one last unit;
- transfer effect atomically releases source and consumes destination;
- future event Cancel releases Reservation, including an atomic Cancel/effect race;
- a race between Draft deletion and finalization has one atomic result and cannot authorize a deleted Draft or hide a successful finalization;
- a no-op transfer is rejected without capacity movement;
- Reverse of an Effective event and a Correction linked to that event preserve the original event and produce deterministic history;
- Correction cannot self-reference or create a cycle;
- retried finalization creates one authoritative Personnel Event and concurrent Draft edits do not silently overwrite;
- same authoritative event set rebuilds identical current/as-of Person, Team, and headcount state;
- a pre-Baseline native event is blocked or follows an approved Baseline revision; future as-of state is visibly planned rather than historical;
- deactivation of organization or reference data with active or Scheduled dependencies is blocked pending valid disposition; historical validity of child/parent relationships remains representable;
- Secondary Assignment requires covering Employment and rejects equivalent overlapping intervals;
- return reuses Person/Personnel Code and creates a new Employment;
- return after anonymization uses a non-identifying rehire token or independently verified manual rematch and never restores disposed identity values;
- termination disposes incompatible future events and releases capacity at effect;
- Headcount Approval rejects negative/fractional counts and invalid validity ranges and cannot orphan active consumption/Reservation;
- manager sees only approved fields and population;
- management-derived history is limited to the authorized relationship interval; cases involving former or current managers, separately granted cross-time access, cross-boundary access, retroactive membership, stale authorization, small cohorts, differencing, or drill-down preserve the authorized intersection or fail closed;
- System Admin cannot routinely access HR content;
- entitlement self-approval/toxic combinations are blocked; overdue recertification suspends/revokes; revocation applies before the next protected action; break-glass auto-expires and receives independent review;
- sensitive/bulk/historical/denied/audit/privileged view activity is audited without unnecessary value copies, and required-audit failure is fail-safe;
- failed import leaves no partial business or derived state;
- import execution revalidates after preview, rejects workbook formulas/macros/external links/active structures, preserves formula-looking plain text as literal, and detects conflicting concurrent batches;
- migrated Baseline is distinguishable and signed reconciliation balances;
- pagination/export use stable authorized snapshots; export is formula-safe, reauthorized at generation/managed retrieval, and records custody transfer while acknowledging local-copy limits;
- dashboard and detailed-report values reconcile. A formally published report records its version, as-of point, and snapshot, and it receives a correction or supersession notice after a retroactive change. The report is reproducible only while lawful, approved evidence exists. After required source disposal, it retains an approved, privacy-preserving reproducibility package where allowed. Otherwise, it is marked with the attributable status `non-reproducible-after-disposal`, is superseded, cannot claim current reproducibility, and retains permitted decision and provenance evidence;
- retention/disposal/legal-hold propagation and external correction-case closure are reconcilable; overdue cases enter breached/escalated state;
- bounded FR-53 attachments enforce type/size allowlists, active-content/archive policy, metadata minimization, permission-safe preview/download, quarantine/fail-safe errors, and no automatic execution;
- non-production exception, backup access/restore, copy inventory, and purge evidence satisfy the minimum invariants; restored state remains unavailable until signed lifecycle/security/event/policy catch-up;
- conflicting Launch Artifacts block the affected operation/baseline until jointly resolved without assumed precedence;
- Persian RTL and Jalali critical journeys pass supported viewports/browsers;
- stale recalculation is visible and cannot be mistaken for current data.

### 12.4 Security testing

- default-deny and horizontal/vertical authorization;
- search/filter/count/report/export inference leakage;
- sensitive category and Organizational Scope boundaries;
- privilege escalation, self-approval, toxic combinations, revocation, recertification, and role/scope change across sessions/queued work/artifacts;
- session, lockout/rate-limit, reauthentication, and directory disablement;
- TLS and certificate/trust baseline;
- import active-content/formula/link/file abuse and permission-filtered preview/error behavior;
- formula-safe export, cumulative bulk exfiltration controls, reauthorization, stale-link revocation, and artifact lifecycle;
- secret/PII leakage in logs, audit, errors, backups, and non-production;
- concurrency and idempotency abuse;
- break-glass expiry and review.

### 12.5 Performance/reliability testing

- evidence against the AR-NFR version that freezes the thresholds, workload, and environment before the earliest affected baseline, using the provisional 2-, 3-, and 5-second planning targets only until that freeze;
- long Person timeline and historical as-of reconstruction;
- retroactive recalculation and rebuild;
- maximum approved import/export/report range;
- concurrent headcount claims and event finalization;
- identity, storage, or job dependency degradation;
- restart/retry without duplication;
- backup completion plus witnessed restore, catch-up, and data/security/lifecycle reconciliation before user access.

### 12.6 UAT and evidence

UAT should be signed by domain owners for identity/access, Person/Employment, organization/Assignment, event semantics, headcount, reporting, migration, security, and operations. Evidence should retain the requirement ID, test data and profile, expected and actual results, signer, date, defects and exceptions, and disposition.

## 13. Multi-Tenant Readiness (Non-MVP)

The launch product is single-organization and single-tenant. Future multi-tenant readiness is an architecture consideration only and must not expand MVP business scope or acceptance burden.

Architecture may avoid irreversible coupling by documenting:

- organization/data-boundary concepts;
- globally safe identifiers;
- configuration ownership and namespace assumptions;
- authorization context boundaries;
- migration path for partitioning, keys, logs, reports, backups, and operational tooling.

Do not require a `tenant_id` on every business table, cross-tenant UI, tenant administration, tenant-specific billing/configuration, or multi-tenant deployment tests unless a separately approved roadmap makes them product requirements.

## 14. Post-MVP Roadmap Hypothesis (Non-Committed)

This section preserves the source's ordering and intent but is **not a delivery commitment, approved scope, schedule, or architecture requirement**. Every phase requires fresh discovery, business case, security/legal/data review, capacity planning, and Product Owner approval. Reordering, adding, removing, or promoting any item into committed scope requires explicit Product Owner approval.

### 14.1 First hypothesis: promotion workflow

- promotion request;
- current and target Grade;
- Ladder guidance;
- promotion history;
- assigned reviewer and Ladder facilitator;
- promotion committee and committee membership;
- committee outcome and executive-committee approval;
- handling deadline/SLA;
- notifications and reminders;
- conversion of the final approved outcome into a promotion Personnel Event.

### 14.2 Second hypothesis: interactive organization chart

- interactive hierarchy visualization;
- middle managers derived from Role and Team membership;
- senior-manager scope;
- reporting relationships;
- historical as-of chart;
- Legal Entity and Business Unit filters;
- Team membership and capacity display.

### 14.3 Third hypothesis: HR workflow engine

- configurable request types and forms;
- workflow stages;
- approver roles;
- SLA;
- notifications;
- conversion of a completed workflow outcome into a Personnel Event.

### 14.4 Fourth hypothesis: workplace seating and floor maps

- register Workstations with unique Workstation Codes within the organization;
- maintain Floor Maps for floors or sites that show Workstation positions and codes;
- assign a Person to a Workstation through governed **Workplace Placement**;
- answer who sits where and which Workstation each person uses from current and permitted historical views;
- support effective-dated moves between Workstations with attributable history;
- optional linkage between Workstation/site and approved profile **work location/site** where useful, without conflating the concepts;
- permission-scoped map browsing, search, and reporting; default-deny for sensitive location context where policy requires it.

This phase is independent of Headcount Approval and Organizational Assignment. It does not imply hot-desking, room booking, attendance sensing, or facilities maintenance unless separately approved.

### 14.5 Other future candidates, preserving source order

1. employee self-service;
2. personnel document management;
3. internal and email notifications;
4. advanced reporting;
5. trend and predictive analytics;
6. ATS and recruitment process;
7. leave and mission management;
8. attendance;
9. payroll, only as a separate future project;
10. mobile support;
11. multilingual UI.

### 14.6 Preserved Could Have candidates

- customizable dashboards;
- chart export as image or PDF;
- internal notifications for future Personnel Events;
- comparison of two time periods;
- optional Ladder-specific Grade/Seniority mapping;
- simple organization hierarchy view without an interactive chart;
- local emergency account only if Infrastructure and Security approve it.

These candidates do not weaken the PRD's MVP Non-Goals or default-deny security model.

## 15. Workplace Seating Readiness (Non-MVP)

This section is **non-authoritative for MVP scope** and does not create launch requirements. It guides architecture and data design so a later seating module can be added without breaking MVP contracts.

### 15.1 Candidate future entities

- **Site / Building / Floor:** optional hierarchy locating a Floor Map; may relate to, but must not be confused with, Organizational Units or profile **work location/site**.
- **Workstation:** physical seat/desk with unique **Workstation Code**, status, and map coordinates or equivalent placement metadata.
- **Floor Map:** governed map asset or geometry for one floor/site, versioned and permission-scoped.
- **Workplace Placement:** effective-dated link from Person to Workstation; one active primary placement per Person at an instant is the default product assumption unless a future policy says otherwise.

### 15.2 Architecture and data-design guardrails

- do not model Workstations as Organizational Assignments, Teams, or Headcount seats;
- do not overload Personnel Event types meant for employment/organization changes with desk moves unless AR-TEMPORAL explicitly extends the event catalogue in a future phase;
- preserve globally safe identifiers and effective-dated history for placement changes;
- keep map assets and placement records separable from core Person/Employment tables where practical;
- plan permission categories for map view, placement view, and placement change independently of ordinary profile read access;
- if MVP stores **work location/site**, document in AR-DATA that it is descriptive text/reference only and not a substitute for Workstation Code or map placement.

### 15.3 UX and reporting direction (non-committed)

- searchable Workstation Code and Person linkage;
- floor-map view with occupied/vacant or assigned/unassigned states according to approved policy;
- profile summary of current Workplace Placement with historical as-of support;
- export/report only under the same permission and bulk/inference controls as other HR data.

Promotion of any item in this section into committed product scope requires Product Owner approval and a PRD update; until then it remains roadmap/architecture guidance only.

## 16. Research Evidence and Citations

The research digest distinguishes broadly applicable practice from jurisdiction-specific examples. Legal applicability remains for legal counsel and security stakeholders to determine.

### Privacy, least privilege, audit, and exports

- NIST Privacy Framework: https://www.nist.gov/privacy-framework
- NIST Privacy Framework 1.1 IPD: https://doi.org/10.6028/nist.cswp.40.ipd
- Citizens Information Ireland, workplace data protection (jurisdiction example): https://www.citizensinformation.ie/en/employment/employment-rights-and-conditions/data-protection-at-work/data-protection-in-the-workplace/

### Effective dating and historical reconstruction

- Oracle PeopleSoft HCM, Effective Dates: https://docs.oracle.com/cd/G48964_01/hcm92pbr54/eng/hcm/hhaf/EffectiveDates-e329a3.html
- Oracle PeopleSoft, Effective Dates and Position Data: https://docs.oracle.com/en/applications/peoplesoft/human-capital-management/9.2.055/peoplesoft-human-resources-manage-positions/understanding-effective-dates-updating-position-data.html
- Oracle PeopleSoft, As-of Reporting: https://docs.oracle.com/cd/F13810_02/hcm92pbr29/eng/hcm/hhaw/task_RefreshingTablestoFacilitateReporting-647aba.html

### Migration and workforce data quality

- Quinnox, Data Migration Validation Best Practices: https://www.quinnox.com/blogs/data-migration-validation-best-practices/
- HiBob, HRIS Migration Checklist: https://www.hibob.com/blog/hris-migration/
- ISO 30435:2023, Workforce Data Quality: https://www.iso.org/standard/68712.html

### LDAP/AD and recovery

- Microsoft, LDAP Signing for AD DS: https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/ldap-signing
- Microsoft, Active Directory Forest Recovery Guide: https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/forest-recovery-guide/ad-forest-recovery-guide
- NIST SP 800-34 Rev. 1, Contingency Planning Guide: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-34r1.pdf

### Adoption and data trust

- Workforce data-quality foundation: see the ISO 30435:2023 citation and URL under “Migration and workforce data quality” above.
- HR.com, State of Today's HR Technology and Integrations 2025: https://212972.fs1.hubspotusercontent-na1.net/hubfs/212972/_RESOURCES/2025/03-20-25-HRdotcom-State-of-Todays-HR-Technology-and-Integrations-2025-Research-Report-ClearCompany.pdf
- Umbrex HR Playbook, HR System Adoption Rate: https://umbrex.com/resources/company-analysis/human-resources/hr-system-adoption-rate/

All citations were accessed 2026-07-11 as recorded in `research-hris-practices.md`.

## 17. Source References

- `C:\Users\AtA\projects\divan\docs\pre-prd.md`
- `C:\Users\AtA\projects\divan\_bmad-output\planning-artifacts\prds\prd-divan-2026-07-11\source-extract-pre-prd.md`
- `C:\Users\AtA\projects\divan\_bmad-output\planning-artifacts\prds\prd-divan-2026-07-11\research-hris-practices.md`
- `C:\Users\AtA\projects\divan\_bmad-output\planning-artifacts\prds\prd-divan-2026-07-11\prd.md`
