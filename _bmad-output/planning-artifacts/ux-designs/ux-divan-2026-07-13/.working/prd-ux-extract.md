# PRD UX Extract — Divan HRIS MVP

> Subagent-style extraction from confirmed sources. Non-authoritative summary for Discovery; PRD wins on conflict.

## Product frame

| Dimension | PRD value |
|---|---|
| Product | Divan HRIS — governed workforce source of truth |
| Deployment | Single-org, on-premise |
| Scale | ~500 people |
| UI | Persian-only, RTL, **desktop web** (1280×720–2K; ref 1920×1080) |
| Auth | LDAP/AD; no stored passwords |
| Out of MVP | Mobile/tablet, bilingual UI, workstations/floor maps, employee self-service |

**Stakes:** Internal enterprise HRIS — regulated, permission-heavy, audit-sensitive. Not consumer.

## Named protagonists (PRD §4)

| ID | Persona | Climax beat |
|---|---|---|
| UJ-1 | **Mina** (HR Operator) | Future transfer finalized → today's team totals unchanged; destination reserved; timeline explains both states on effective date |
| UJ-2 | **Reza** (HR Admin) | Linked correction without rewriting history; deterministic recalc |
| UJ-3 | **Sara** (Manager) | Scope-safe search/report; export gated + audited |
| UJ-4 | **Niloofar** (+ approver/executor) | Migration batch validated, segregated approval, reconciliation to signed controls |
| UJ-5 | **Arman** (System Admin) | Health/identity ops without browsing HR records |

## Addendum §9 — UX design inputs (explicit)

- Persian-only + RTL
- Jalali dates + unambiguous timestamps
- Desktop viewports above
- Permission-safe search, facets, counts, columns, empty/error states
- Sectioned long forms, required fields, inline validation, unsaved-change warning
- Explicit confirmation: finalization, termination, Cancel, Reverse, Correction, Override, import, export
- Profile sections: identity | current Employment | Assignments | sensitive categories | prior Employments | timeline
- Timeline: Effective Date vs registration/finalization; Draft/Scheduled/Effective/Cancelled/Reversed; provenance; correction chain
- Capacity: used / reserved / free / exempt / overridden
- Import preview: row/column errors, warnings, reconciliation
- Stale/recalc/failure ≠ current truth
- Wide-table scroll without losing context/actions
- Keyboard, focus, contrast, a11y — **pending AR-NFR approval**

## Surfaces implied by FR clusters

### Core operational (HR Operator + Manager)
1. **Dashboard** — workforce totals, trend, team capacity, starts/terminations, open headcount; shared org/time filters (FR-35)
2. **Personnel search & lists** — rich filters, sort, pagination, column pick, export (FR-33)
3. **Person profile + timeline** — permission-filtered sections (FR-34)
4. **Personnel event flows** — draft → finalize; scheduled/effective; cancel/reverse/correction (FR-14–FR-20)
5. **Headcount views** — approvals, reservations, overrides, capacity breakdown (FR-28–FR-32)

### Reference & admin (HR Admin)
6. **Organization & reference data** — hierarchy, roles, titles, ladders, grades (FR-8–FR-13)
7. **Headcount approval management** (FR-28)
8. **Permissions / entitlements** — default-deny, scope, sensitive categories (FR-2–FR-4, FR-46)
9. **Data dictionary visibility?** — governed fields; may be admin-only config surface (FR-7)

### Reporting & export
10. **Report catalogue** — 20+ launch reports (FR-36, addendum §8.3)
11. **Report run + as-of/period filters + export** (FR-36, FR-41)
12. **Export artifact retrieval** — classification, expiry, reauth (FR-52)

### Migration
13. **Import wizard** — upload → validate → preview → confirm → execute → results (FR-37–FR-40, UJ-4)
14. **Reconciliation workspace** — discrepancies, sign-off evidence

### Governance & ops
15. **Audit investigation** — access, mutations, import/export, privileged activity (FR-42, Audit actor)
16. **Correction case tracking** — external data-subject requests, no self-service (FR-53)
17. **Operational health** — identity, service, backup, recalc status; redacted logs (FR-45, UJ-5)

### System
18. **Login / session** — LDAP failure messaging in Persian (FR-1, FR-43)
19. **Global stale/failure banner** — derived state unavailable (FR-45)

## Open for UX Discovery (not in PRD)

- Visual identity, brand, color system
- Component library / UI kit (shadcn, MUI, internal, etc.)
- Primary navigation model (sidebar vs top nav vs hybrid)
- Information scent: how HR Admin vs Operator vs Manager land differently
- Density preference for data-heavy tables
- Chart/visualization style for dashboard
- Whether System Admin and Audit are separate apps, modules, or role-filtered same shell

## Surface closure check (draft)

| Stated need | Surface candidate | Journey anchor |
|---|---|---|
| Future transfer w/ capacity | Event form + headcount preview + profile timeline | UJ-1 |
| Correction w/ history | Timeline + correction flow | UJ-2 |
| Manager staffing view | Search + dashboard + reports | UJ-3 |
| Migration cutover | Import wizard + reconciliation | UJ-4 |
| Ops without HR content | Health/admin module | UJ-5 |

**Possible gap:** Permission/entitlement administration — required by FR but no named journey; needs IA decision.
