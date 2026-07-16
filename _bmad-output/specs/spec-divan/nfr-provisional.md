# Operational Acceptance — Provisional (AR-NFR)

**Status:** Product provisional freeze 2026-07-16. Unblocks architecture/delivery planning. **Does not replace** formal AR-NFR versioning or Ops/Security/Business Continuity sign-off before production (PRD §7.2).

| Topic | Provisional value | Notes |
| --- | --- | --- |
| Performance (NFR-2) | Ordinary page ≤ 2s; common search/filter ≤ 3s; common dashboard ≤ 5s | Matches PRD provisional targets; freeze measurement profile later |
| Accessibility (NFR-12 / UX OQ-1) | WCAG 2.2 AA for light and dark content themes at 1920×1080 reference; 200% zoom primary actions reachable | Matches EXPERIENCE.md floor |
| Compatibility (NFR-11) | Essential tasks at 1280×720, 1920×1080, 2K on Chromium-family (Chrome/Edge current) and Firefox ESR | Exact versions pinned at formal AR-NFR |
| Recoverability (NFR-6) | RPO ≤ 24h; RTO ≤ 8h; daily backup of PostgreSQL (+ WAL archive if Ops provides) | Single-server MVP; Ops may tighten |
| Scale (NFR-13) | ~500 people; single-server accepted | Concurrent-user/load profile deferred to formal AR-NFR |
| Availability (NFR-5) | Business-hours primary; planned maintenance allowed with notice | Exact % target deferred to Ops |
| Session (NFR-7) | Idle and absolute timeouts deferred to AR-IDENTITY; product expects finite revocation | No invented timeout numbers here |
| Security assurance (NFR-14) | Threat model + vuln remediation + zero unresolved critical/high before production | Process owned by Security/AR-NFR |

Deferred to formal AR-NFR (non-blocking for epic slicing if stories gate on artifact): exact hardware sizing, HA choice, cipher policy, alert routing, pen-test scope, non-production masking procedure.
