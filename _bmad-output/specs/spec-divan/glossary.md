# Glossary — Divan HRIS

Lean domain terms for the MVP contract. Full definitions and Persian labels are in PRD §2.

| Term | Meaning |
| --- | --- |
| **Person** | Stable human identity surviving termination and return; distinct from Employment. |
| **Personnel Code** | Stable organization-issued identifier; reused on return subject to approved correction policy. |
| **Employment** | Effective-dated period a Person works for the organization; at most one active at an instant in MVP. |
| **Assignment** | Effective-dated placement with org, role, title, ladder, grade, seniority, primary/secondary status. |
| **Primary Assignment** | Single active Assignment defining team membership; normally consumes headcount. |
| **Secondary Assignment** | Concurrent additional Assignment with reason/type; does not consume headcount in MVP AR-SECONDARY inventory. |
| **Organizational Unit** | Legal Entity, Business Unit, Department, or Team in governed hierarchy. |
| **Personnel Event** | Attributable, effective-dated business change that may alter derived workforce state. |
| **Draft** | Editable, non-authoritative Personnel Event. |
| **Finalized** | Accepted Personnel Event; cannot be directly edited or hard-deleted. |
| **Scheduled** | Finalized future event; authoritative but not yet in current Effective state. |
| **Effective** | Finalized event whose effective point is reached and contributes to evaluated state. |
| **Cancel / Reverse / Correction** | Pre-effect neutralization; post-effect compensating neutralization; linked factual replacement preserving original. |
| **Effective Date** | Business date a state change applies; distinct from registration and finalization time. |
| **Baseline** | Approved migrated state at start of reconstructable history. |
| **Headcount Approval** | Effective authorization for pooled Primary Assignments by Team, Job Title, optional Seniority. |
| **Reservation** | Future capacity claim from Finalized start or inbound transfer before Effective Date. |
| **Override** | Permitted exception to headcount rule with reason, context, actor, and audit. |
| **Data Element** | Governed field, attribute, or artifact schema with classification and lifecycle in Data Dictionary. |
| **Import Batch** | Attributable unit of migrated data with validation and reconciliation evidence. |
| **Organizational Scope** | Population boundary a user may access (Team, Department, Legal Entity, management hierarchy). |
| **Launch Artifact (AR-*)** | Versioned acceptance dependency (access, temporal, headcount, data, etc.) gating baselines and production. |

**Deferred (non-MVP, forward-compatible):** Workstation, Workstation Code, Floor Map, Workplace Placement — physical seating concepts separate from Organizational Assignment and free-text work location.
