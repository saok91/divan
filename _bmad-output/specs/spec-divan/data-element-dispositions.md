# Data Element Dispositions (AR-DATA partial freeze)

**Status:** Product partial freeze 2026-07-16 — not a substitute for full AR-DATA versioning.  
**Authority:** SPEC-divan + PRD AR-DATA. Formal owner sign-off still required before data architecture baseline.

Disposition codes: `approve` (MVP launch) · `later` (not MVP; retain in dictionary) · `reject` (do not collect/enable unless Legal revises).

## Identity

| Data Element | Disposition | Notes |
| --- | --- | --- |
| Personnel Code | approve | Stable identifier |
| First name | approve | |
| Last name | approve | |
| Father name | approve | |
| Birth date | approve | Jalali UX |
| Gender | approve | |
| Nationality | approve | |
| National ID | approve | Sensitive; separate category permission |
| Birth certificate number / series / serial | later | |
| Birth place | later | |
| Birth-certificate issue place | later | |
| Religion / sect | reject | Unless Legal later mandates purpose |
| Military-service status | later | |

## Contact, residence, location

| Data Element | Disposition | Notes |
| --- | --- | --- |
| Mobile phone | approve | **MVP mandatory** per product 2026-07-16 |
| Landline | later | |
| Personal email | later | |
| Organizational email | later | May promote if LDAP mapping needs it |
| Residential address | later | |
| Postal code | later | |
| Work location / site | later | Descriptive only; not Workstation |

## Other candidate categories (default)

Until an explicit walk promotes them, treat addendum §3 remaining candidates as **`later`** (not silent reject):

- Family / dependants / emergency contact
- Education
- Bank, insurance, health/physical condition
- Employment/contract attributes beyond those required by FRs for start/assignment/headcount
- Compensation components (enablement still gated by FR-8 + category permission when approved)
- Governance metadata as required by import/audit FRs when those paths are built

Sensitive categories remain **disabled by default** until purpose, access, retention, and Legal/Privacy/Security disposition are recorded in the formal AR-DATA register (PRD FR-3).

## Open for next walks

- Exact Employment/Assignment/contract launch field set for migration templates
- Compensation enablement list and masking rules
- Bounded FR-53 attachment allowlist (if any)
- Organizational email vs LDAP attribute mapping (AR-IDENTITY)
