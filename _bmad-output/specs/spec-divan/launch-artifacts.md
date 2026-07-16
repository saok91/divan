# Launch Artifacts Register

Authoritative detail, owner mapping, affected FR/NFR lists, and open decisions are in PRD §7.1–§7.2. Artifacts below remain formally `pending` unless a companion records a **partial freeze** that unblocks a named baseline stage.

| ID | Purpose | Blocks (summary) | Key open decisions |
| --- | --- | --- | --- |
| **AR-ACCESS** | Access, entitlement, break-glass, bulk and inference policy | Exact matrix before Epic 2+ feature baseline | **Partial freeze (Epic-1):** five MVP coarse roles + landings — see `identity-access-epic1-freeze.md`. Still open: field×action×scope matrix; toxic combinations; revocation bounds; break-glass detail |
| **AR-TEMPORAL** | Effective-time and event resolution contract | Temporal architecture baseline; scenario oracles before event stories | **Partial freeze:** Asia/Tehran; date-only; exclusive ends; same-day by registration time; future as-of = planned not Effective; pre-Baseline native events via Override+warning+audit (not silent). Still open: Override approver; Baseline-revision alternate path; full scenario inventory |
| **AR-HEADCOUNT** | Headcount policy and acceptance oracle | Headcount architecture baseline; scenarios before feature baseline | **Partial freeze:** immediate Reservation; oldest-compatible default + audited manual select; 14-day expiry warning then Scheduled exception with no partial apply; Override may show negative free + distinct rows. Still open: formal AR-HEADCOUNT versioning/sign-off; exact escalation owners |
| **AR-DATA** | Data Dictionary and lifecycle register | Data architecture baseline; exact elements before migration/feature baseline | **Partial freeze:** identity approve set + mobile phone; religion/sect reject; other candidates default later — see `data-element-dispositions.md`. Still open: employment/contract/compensation enablement; FR-53 attachments; formal versioning; no named jurisdiction for MVP |
| **AR-IDENTITY** | Identity and account lifecycle contract | Full LDAP feature baseline / production identity | **Partial freeze (Epic-1):** seeded internal accounts for non-production development/test; LDAP deferred until Infrastructure approval — see `identity-access-epic1-freeze.md`. Still open: LDAP topology; bind/trust; outage behavior in LDAP mode; session/MFA; emergency account; production cutover off seeded auth |
| **AR-AUDIT** | Audit envelope and review contract | Audit architecture baseline; schema before feature baseline | Mandatory event/read envelope; minimization; integrity; review cadence |
| **AR-MIGRATION** | Migration, Baseline, import and reconciliation contract | Migration architecture baseline; templates before build | Baseline semantics; batch atomicity; segregation of duties; rollback |
| **AR-REPORTING** | Search, metric, report, publication catalogue | Reporting architecture baseline; formulas before feature baseline | Metric definitions; small-cohort protection; 30/60/90 targets |
| **AR-NFR** | Operational and security acceptance profile | Earliest affected architecture/delivery/feature baseline | **Provisional freeze:** see `nfr-provisional.md` (2s/3s/5s; WCAG 2.2 AA; Chromium+Firefox ESR; RPO 24h/RTO 8h; ~500). Still open: formal Ops sign-off; HA; session timeouts via AR-IDENTITY |
| **AR-SECONDARY** | Secondary Assignment launch inventory | Assignment feature baseline | Finite scenarios, fields, conflicts, import/report treatment |
| **AR-CUTOVER** | Cutover, parallel operation, rollback plan | Cutover rehearsal baseline; signed readiness before production | Freeze; delta migration; rollback trigger; point of no return |

## Decision stages (PRD §7.2)

1. **Before affected architecture baseline:** minimum product invariants for access, temporal scope, data categories, audit envelope, identity lifecycle, bulk/inference, core temporal/headcount semantics, and AR-NFR values that change architecture.
2. **Before affected feature/story baseline or build:** exact matrix, values, formulas, conflict classification, test oracle, scenario inventory, acceptance evidence format.
3. **Before production:** demonstrate evidence against version-frozen artifacts; close or waive findings; independent sign-off — production does not set thresholds.

Conflicting Launch Artifacts block the affected operation until owners jointly resolve and version the conflict (FR-55).
