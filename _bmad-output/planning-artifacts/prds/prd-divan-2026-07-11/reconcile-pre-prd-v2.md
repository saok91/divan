# Final Reconciliation — `pre-prd.md` against Current PRD and Addendum

## 1. Audit Scope and Standard

- **Source:** `C:\Users\AtA\projects\divan\docs\pre-prd.md`
- **Authoritative product contract reviewed:** `prd.md`
- **Non-authoritative companion reviewed:** `addendum.md`
- **Prior audit reviewed:** `reconcile-pre-prd.md`
- **Decision evidence used only to verify intent:** `.memlog.md`
- **Standard:** every material source item must be represented as an authoritative requirement/outcome, explicitly deferred or excluded, explicitly superseded with a reason, or preserved as candidate/downstream detail. Mere omission does not count as disposition.

## 2. Verdict

**PASS — complete material reconciliation.**

No material source item remains silently lost or without disposition in the current `prd.md` plus `addendum.md`. The four material gaps reported by the first reconciliation are closed. Subsequent structural and prose edits preserved the source's product identity, domain rules, MVP behavior, acceptance intent, operational constraints, candidate detail, exclusions, and post-MVP hypotheses.

This verdict does not mean every source statement remains authoritative. Several unsafe, contradictory, premature, or implementation-prescriptive source statements were deliberately superseded; each is explicit in the current artifacts and has a defensible reason recorded below.

## 3. Re-check of the Four Prior Gaps

### GAP-1 — Detailed candidate profile/Data Dictionary inventory

**Status: CLOSED.**

`addendum.md` §3 now preserves the detailed candidate catalogue rather than only broad categories:

- identity fields, including father name, birth-certificate number/series/serial, birth and issue places, nationality, religion/sect, and military-service status;
- contact, residence, postal code, and work location;
- marriage, spouse, children, dependants, and emergency-contact details;
- education degree, field, specialization, institution, and graduation date;
- Employment, contractual, entity, insurer, compensation, Assignment, event, headcount, and Import Batch attributes;
- sensitive bank, insurance, health/physical-condition, family, and related candidates.

The catalogue is explicitly candidate-only and requires an item-level Data Dictionary disposition. This correctly preserves source detail while superseding the unsafe source rule that every field found in Excel must automatically exist or be enabled.

### GAP-2 — Post-MVP roadmap order and backlog candidates

**Status: CLOSED.**

`addendum.md` §14 preserves, as a non-committed hypothesis:

1. promotion workflow;
2. interactive organization chart;
3. HR workflow engine;
4. the remaining future candidates in source order.

It also preserves the source's Could Have candidates: customizable dashboards, image/PDF chart export, internal future-event notifications, period comparison, Ladder-specific Grade/Seniority mapping, a simple non-interactive hierarchy view, and a conditionally approved local emergency account. The text explicitly distinguishes preservation from an approved commitment.

### GAP-3 — Dashboard, report, search, and filter contract

**Status: CLOSED.**

The current documents no longer reduce source-defined launch behavior to an optional future catalogue:

- `prd.md` FR-33 preserves the exact source search fields, launch filters, sorting, stable pagination, result count, approved columns, filtered export, and Persian empty/error states.
- FR-35 requires current organization/workforce indicators, effective-dated workforce trend, selectable range/granularity, Team membership/capacity, starts versus terminations, open/near-expiry/expired headcount, synchronized filters, and detail reconciliation.
- FR-36 preserves the complete source launch-report catalogue and its permission, Jalali, Effective Date, current/as-of, export, and freshness behavior.
- `addendum.md` §8 repeats the launch-core catalogue and clearly labels only additional items as non-launch candidates.

Metric-owner approval may refine formulas and presentation, but cannot silently remove these launch behaviors.

### GAP-4 — Performance preferences hardened into unsupported p95 commitments

**Status: CLOSED.**

`prd.md` NFR-2 now labels 2/3/5 seconds as **source-inherited provisional targets**, not frozen acceptance thresholds. AR-NFR must approve percentile, workload, environment, boundaries, and test method before the earliest affected baseline. Alternatives may be owner-approved before freeze; later changes require governed rebaseline. `addendum.md` §§10.3 and 12.5 preserve the same interpretation.

The source's “preferably” meaning and infrastructure-dependent finalization are therefore retained without allowing performance acceptance to remain permanently untestable.

## 4. Material Coverage Ledger

### Source §§1–7 — identity, problem, vision, goals, metrics, actors, principles

**Disposition: represented, with explicit security corrections.**

The spreadsheet problem, single source of truth, event/effective-date thesis, history, headcount, reporting, migration, audit, Persian RTL/Jalali, on-premise deployment, initial scale, actors, outcomes, success measures, and counter-metrics appear in PRD §§1–3 and §§10–12. Roles were converted into actors/jobs and permission outcomes without losing their operational intent.

### Source §8 — MVP scope and exclusions

**Disposition: represented, deferred, or explicit non-goal.**

Core personnel, Employment, Assignment, organization, event, historical state, headcount, migration, reporting, access, audit, localization, and operations are in PRD §§5 and 8. Payroll, attendance/leave/mission, ATS, promotion workflow, workflow engine, interactive chart, predictive analytics, mobile/tablet specialization, bilingual UI, self-service, and general document management remain explicit non-goals. Broader Secondary Assignment workflows, saved filters, and non-launch reports are explicitly deferred.

### Source §§9–10 — conceptual model and personnel profile

**Disposition: authoritative invariants represented; physical and field detail preserved as candidates.**

Person, Employment, hierarchy, Assignment, Role, Job Title, Ladder, Grade, Seniority, Contracting Entity, Insuring Entity, return behavior, one-active-Employment, one-Primary-Assignment, half-grades, management inference, and independent job concepts are retained in PRD FR-5–FR-13 and Addendum §§2–3. Profile and minimum-data outcomes are governed by FR-5–FR-8, FR-25, and FR-34. Detailed attributes are preserved in Addendum §3.

### Source §§11–12 — Personnel Events and temporal state

**Disposition: represented and made deterministic.**

The event envelope, separate registration/finalization/effect time, past/future events, Draft/Finalized/Scheduled/Effective states, immutability, Cancel/Reverse/Correction, conflict handling, recalculation, current state, as-of reconstruction, and historical limitations appear in FR-14–FR-27 and Addendum §5. The source ambiguity between “immediately valid” and future effect was explicitly superseded.

### Source §13 — headcount

**Disposition: represented and completed.**

Approval attributes/status, Team + Job Title + optional Seniority matching, pooled counts, validity, consumption/release, atomic transfer, concurrency, exemption, Override, reporting, and audit are in FR-28–FR-32 and Addendum §6. Future Reservation closes a source ambiguity; its trade-off and owner approval are explicit rather than hidden.

### Source §§14–15 — search, dashboard, and reports

**Disposition: represented as launch-core where source-required; extras preserved as candidates.**

FR-33–FR-36 and Addendum §8 preserve the complete material launch behaviors and catalogue. Only additional analytics and saved/personal behavior are candidate or deferred.

### Source §§16–17 — import, migration, and export

**Disposition: represented; design choices preserved downstream.**

CSV/XLSX, import identification, validation, preview, warning/error reporting, confirmation, atomic execution/rollback, Batch traceability, Baseline, provenance, duplicate protection, reconciliation, filtered export, access, and audit are in FR-37–FR-41 and FR-52. Template/version, idempotency, exact atomic boundary, warning treatment, limits, and retention choices are preserved in Addendum §7 for owner decisions.

### Source §§18–20 — authorization, audit, and LDAP

**Disposition: represented, with broad Viewer access superseded.**

Backend enforcement, granular permissions, compensation/export separation, System Admin separation, role administration, mutation/authentication/import/export/Override/configuration audit, audit integrity, LDAP/AD identity, disabled-account behavior, password non-storage, and Persian failures appear in FR-1–FR-4, FR-42, FR-46–FR-52, NFRs, and Addendum §§4 and 10.

### Source §21 — UI and localization

**Disposition: represented.**

Persian-only RTL desktop behavior, Jalali entry/display, 1280×720 through 2K with 1920×1080 reference, controlled wide tables, sectioned forms, required fields, inline errors, confirmations, unsaved-change warnings, and timeline semantics appear in FR-43–FR-44 and Addendum §9.

### Source §22 — non-functional requirements

**Disposition: represented; provisional values and unresolved thresholds made explicit.**

Performance, integrity, transactionality, concurrency, TLS, access, tenant decision, sensitive logging, session, availability/degradation, retry/idempotency, browser support, backup/restore, RPO/RTO, observability, scale, and security testing are covered by NFR-1–NFR-14 and Addendum §10. Exact unresolved thresholds are upstream artifact gates, not silently deferred to production.

### Source §§23–25 — business rules, acceptance, and stories

**Disposition: represented as stable FR consequences and journeys.**

The source rules and acceptance cases are traceable across FR-5–FR-45, FR-56, UJ-1–UJ-5, launch gates, and Addendum §12. The original stories for create/start/transfer/correct/timeline/headcount/dashboard/migrate/return retain their user intent even where consolidated into richer journeys.

### Source §26 — prioritization

**Disposition: MVP items represented; Should/Could/Won't items explicitly bounded.**

Must Have outcomes are in scope and FRs. Secondary Assignment is limited to launch data fidelity through AR-SECONDARY; broader workflow is deferred. Saved filters are non-gating. Could Have items are preserved in Addendum §14.5. Won't Have items remain Non-Goals or non-committed future hypotheses.

### Source §§27–30 — dependencies, risks, assumptions, and open decisions

**Disposition: represented and made owner/stage-bound.**

Infrastructure, HR data/reference, security/legal, migration, LDAP, recovery, and sign-off dependencies are in PRD §§6–7. Material risks appear in §11 and corresponding FR/NFR controls. Unsafe assumptions and the false “only LDAP remains open” statement were replaced with the Launch Artifact Register and staged decision gates.

### Source §§31–32 — delivery and testing

**Disposition: preserved as non-authoritative downstream detail.**

Delivery sequencing is retained in Addendum §11 as a planning hypothesis. Unit/property, integration, acceptance, security, performance/reliability, UAT, and evidence inventories are retained in Addendum §12. The source's 2–3 week estimate is explicitly rejected as non-credible until decisions, data profiling, architecture, capacity, and slicing exist.

### Source §§33–34 — release readiness and MVP success

**Disposition: represented and strengthened.**

Migration rehearsal/reconciliation, identity, access, restore, security, concurrency, dashboard-detail reconciliation, UAT, training, support, owner approval, spreadsheet retirement, trusted state, headcount governance, and operational stabilization appear in LG-1–LG-6, SM-1–SM-6, counter-metrics, and rollout.

### Source §35 — post-MVP roadmap

**Disposition: preserved as non-committed hypothesis.**

The source order and feature detail are retained in Addendum §14 without being misrepresented as approved delivery scope.

### Source §§36–37 — glossary and final summary

**Disposition: represented.**

Core terms are retained and clarified in PRD §2; non-MVP multi-tenant considerations remain in Addendum §13. The final product identity, deployment, scale, event/history/headcount/migration/reporting/access core, and exclusions are preserved throughout the PRD.

## 5. Explicit Supersessions and Reasons

1. **Broad Viewer access → default-deny category/action/scope access.** Read-only access does not mitigate exposure of sensitive HR data and contradicted the source's own least-privilege principle.
2. **Mandatory `tenant_id` and MVP multi-tenant readiness → single-organization MVP plus non-authoritative future readiness.** No near-term multi-tenant business need was established; the source prescription added unapproved product and assurance burden.
3. **“Finalized immediately valid/effective” → authoritative Finalized separated from Effective.** This resolves the source's contradiction with future-dated events.
4. **Ambiguous Cancel/Reverse/correction → distinct deterministic lifecycle operations.** Required to preserve history and produce one reproducible state.
5. **Unspecified future capacity timing → immediate destination Reservation at Finalization, pending explicit policy approval.** This prevents concurrent overbooking while exposing the availability trade-off.
6. **All spreadsheet fields automatically modelled → complete candidate inventory with Data Dictionary disposition.** Existing collection is not sufficient purpose or approval for continued sensitive-data processing.
7. **No universal second approval → ordinary work remains without universal second approval, while explicitly sensitive/high-impact tiers require independent pre-authorization.** This preserves routine source intent while correcting an unsafe blanket rule for termination, compensation, bulk production import, major retroactivity, and high-impact Override.
8. **TLS conditional on infrastructure → TLS as a deployment prerequisite.** Sensitive HR traffic cannot safely launch with plaintext as an accepted fallback.
9. **“LDAP is the only main open topic” → complete owner-bound artifact register.** The source itself leaves access, temporal, headcount, data, migration, reporting, retention, recovery, and legal decisions unresolved.
10. **2–3 week estimate → no commitment until re-estimation inputs exist.** The cited range is incompatible with the source's own enterprise scope and its stated need to re-estimate.
11. **Performance preferences → provisional planning targets pending a frozen acceptance profile.** This preserves the numbers without inventing percentile/load commitments.
12. **Role-name matrix as sufficient authorization → permission/category/action/scope policy.** The source already required permission-based implementation, and named roles alone cannot express sensitive or management scope.

## 6. Material Gaps

**None.**

No structural or prose edit after the first reconciliation removed a material requirement, disposition, supersession rationale, candidate inventory, or source-defined launch behavior. Remaining `pending` items in the PRD are explicit owner decisions with staged blocking effects; they are product-definition work still to be completed, not source-reconciliation omissions.
