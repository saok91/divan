# Identity & Access — Epic 1 Partial Freeze

**Status:** Product partial freeze 2026-07-16  
**Authority:** Product owner decision for development start; does **not** replace formal AR-IDENTITY / AR-ACCESS versioning or Infrastructure sign-off for production LDAP.  
**Unblocks:** Epic 1 story baselining and early development/test.

## AR-IDENTITY (Epic-1 baseline)

| Decision | Value |
| --- | --- |
| Production / launch identity | Organization LDAP/AD remains the sole **routine** identity source at go-live (FR-1, FR-49). |
| Early development / local / CI | **Seeded internal accounts** are allowed so development and tests can proceed **without** live LDAP. |
| LDAP integration timing | Implement and enable LDAP only after **Infrastructure approval** of directory connectivity (topology, bind, trust). Until then, LDAP stories stay deferred/blocked. |
| Password policy (seeded) | Seeded passwords exist only for non-production; never ship seeded credentials to production; app must not store LDAP passwords when LDAP is enabled. |
| Account model | Each human still maps to exactly one internal account; seeded users are first-class internal accounts with coarse role assignment. |
| Fail-closed (LDAP mode) | When LDAP is the active provider and directory is unavailable: Persian message «اتصال به سامانه هویت برقرار نیست.» — no silent fallback to seeded accounts in production. |
| Fail-closed (seeded mode) | Unknown user / wrong password / inactive account denied; no generic Viewer elevation. |

### Required seed accounts (local/dev)

Exactly one seeded account per MVP coarse role (usernames illustrative; implementers may adjust literals in seed scripts):

| Seed username (example) | Coarse role | Role landing |
| --- | --- | --- |
| `hr.operator` | HR Operator | پرسنل |
| `hr.admin` | HR Admin | داشبورد |
| `manager` | Manager | داشبورد (scoped) |
| `audit.reviewer` | Audit reviewer | ممیزی |
| `sys.admin` | System Admin | عملیات |

## AR-ACCESS (Epic-1 baseline — coarse roles only)

MVP coarse roles frozen for navigation and landings (EXPERIENCE.md / UX-DR18):

1. **HR Operator**
2. **HR Admin**
3. **Manager**
4. **Audit reviewer**
5. **System Admin**

| Still pending (blocks Epic 2+ feature baselines, not Epic 1 shell) |
| --- |
| Exact field/category × action × Organizational Scope matrix |
| Toxic combinations, entitlement/recertification bounds |
| Break-glass detail, bulk/inference thresholds |
| Delegation / acting / interim / co-manager rules |

Nav items outside the caller's coarse role permission are **omitted from the DOM** (not shown disabled). Deep-link denial: «دسترسی ندارید.» + link to role landing + audited.

## Explicit non-claims

- Seeded auth is **not** an alternate production identity path.
- This freeze does **not** approve inventing the full AR-ACCESS matrix.
- Formal AR-IDENTITY LDAP topology, MFA, session timeouts, and emergency-account rules remain due before production identity baseline.
