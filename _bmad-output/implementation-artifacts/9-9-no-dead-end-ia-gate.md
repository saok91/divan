---
baseline_commit: fe4ea92
---

# Story 9.9: No-Dead-End IA Gate

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the product owner,
I want an automated guarantee that navigation never leads nowhere,
so that a placeholder can never ship into navigation again (FR59).

**Story key:** `9-9-no-dead-end-ia-gate`  
**Epic:** 9 — Operational Surface Completion & IA Coherence (FR59 surface completion)  
**UX contract:** `ux-divan-2026-07-31` (EXPERIENCE «No dead ends.»; UX-DR3 role-filtered nav)  
**Authorized by:** `sprint-change-proposal-2026-07-31` (§4.2.5 Story 9.9 — automated route audit)  
**Prerequisite:** Stories **9.1–9.8** (bulk/IA/events/drill-through/governance surfaces filled); Story **8.10** design-qa orchestrator.  
**Downstream:** **9.10** chart visual quality (separate — do not claim); **Epic 10** «تنظیمات» nav + settings store (out of scope — gate must **not** fail for missing settings).

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Nav catalog + role matrix | `packages/modules/identity-access/src/navigation.ts` (`NAV_CATALOG`, `ROLE_NAV_HREFS`, `getNavItemsForRole`) | 11 sidebar roots; role omit-from-DOM; landings | Gate must prove every catalog href is functional for ≥1 role; do **not** fork a parallel catalog |
| Nav selfcheck | `packages/modules/identity-access/src/navigation.selfcheck.ts` | Catalog order, role matrix, correction label | Keep green; optionally invoke from IA gate or leave as package check — do not duplicate the matrix tables |
| Section tabs SoT | `apps/web/lib/section-tab-surfaces.ts` (`SECTION_TAB_SURFACES`) | All section-tab hrefs + still exports `SECTION_TAB_PLACEHOLDER` | Gate must cover every tab href; ban placeholder copy / component from navigable pages |
| Dead placeholder component | `apps/web/components/section-tab-placeholder.tsx` | Exists; **no** `app/` page imports it today | Quarantine/delete **or** gate fails if any navigable page imports it / embeds placeholder string |
| App layout / sidebar | `app/(app)/layout.tsx` → `getNavItemsForRole`; `app-sidebar.tsx` maps `navItems` only | UX-DR3 already implemented | Gate must **lock** this contract (layout filters; sidebar never renders unfiltered catalog / disabled stubs) |
| Design-QA orchestrator | `apps/web/lib/design-qa.selfcheck.ts` + `selfcheck:design-qa` | Runs Epic 8 + drill-through + governance-discoverability | Add **`selfcheck:no-dead-end-ia`** (name exact) to `REQUIRED_SCRIPTS` |
| Surface IA selfchecks | `selfcheck:headcount-ia`, `selfcheck:reports-ia` | Focused heuristics; **not** in design-qa today | Prefer **calling** them from the new gate (or design-qa) over rewriting their asserts |
| Governance / drill-through gates | `governance-discoverability.selfcheck.ts`, `drill-through.selfcheck.ts` | 9.7–9.8 structural locks | Already in design-qa; IA gate complements (nav+tabs completeness), does not replace |

### Critical distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Functional vs honest empty** | Functional = page hosts real domain/UI work (panel, table, form, workspace, redirect-to-default-tab). Honest `FeedbackMessage` empty / not-permitted / filtered **is allowed**. Forbidden = `SectionTabPlaceholder`, `SECTION_TAB_PLACEHOLDER` string («محتوای این بخش در استوری بعدی تکمیل می‌شود.»), scaffold-only shells with no host. |
| **Sidebar + section tabs vs all routes** | Gate scope = `NAV_CATALOG` entries + every `SECTION_TAB_SURFACES[].tabs[].href`. **Out of gate:** `/dev/gallery`, deep profile `[personId]`, query-only deep links — unless they are catalog/tab hrefs. |
| **≥1 role** | Every catalog href appears in ≥1 `ROLE_NAV_HREFS` entry **and** resolves to a functional page. Every section tab under a root that ≥1 role can open must resolve. Do not invent new roles or widen matrix. |
| **Omit-from-DOM (UX-DR3)** | Unauthorized items must be **absent**, never shown disabled/inert. Already true via server `getNavItemsForRole` + sidebar `navItems.map`. Gate asserts the wiring, not a runtime browser DOM dump. |
| **«تنظیمات» / Settings** | EXPERIENCE + 8.10 matrix mention Settings; **Epic 10** owns nav entry. **Do not** add settings to `NAV_CATALOG`; **do not** fail the gate because settings is missing. |
| **CI** | Repo has **no** GitHub Actions workflow for selfchecks. «CI» = `pnpm --filter @divan/web selfcheck:design-qa` (and package navigation selfcheck). Document this honesty in Completion Notes; do **not** invent a `.github/workflows` pipeline unless product asks. |
| **Presentation / IA only** | No domain rule changes; no Prisma in web; no AR-\* freeze invent; no ROLE_NAV_HREFS widen for convenience. |

### Functional-content heuristic (non-negotiable AST definition)

For each gated href, resolve the App Router page file under `apps/web/app/(app)/` (including `(tabs)`, `[[...slug]]`, and root index redirects). Assert:

1. **File exists** for the href (or documented redirect page that lands on a default tab that itself exists).
2. **Source does not match** `/SectionTabPlaceholder/`, does not import `@/components/section-tab-placeholder`, and does not contain the literal `SECTION_TAB_PLACEHOLDER` / «محتوای این بخش در استوری بعدی تکمیل می‌شود.»
3. **Has a real host signal** — at least one of: redirect via `defaultTabHref` / `assertPageAccess` (surface roots), or import/render of a known panel/workspace/form/table component (pattern like existing `headcount-ia` / `reports-ia` / governance checks). Prefer scanning for **absence of placeholder + presence of a non-trivial module import** over brittle full-sentence copy asserts.
4. Surface **root** pages (`/personnel`, `/headcount`, …) that only redirect to `defaultTabHref` count as functional **iff** the default tab page passes (1)–(3).

## Acceptance Criteria

1. **Given** the full route table (`NAV_CATALOG`) and navigation configuration (`ROLE_NAV_HREFS` / `getNavItemsForRole`)  
   **When** the IA gate runs  
   **Then** every sidebar catalog href resolves to functional content (heuristic above) for at least one coarse role that is permitted to see it

2. **And** every section tab in `SECTION_TAB_SURFACES` resolves to functional content (same heuristic); a route whose page renders only placeholder content **fails** the gate

3. **And** navigation entries the caller cannot use are omitted from the DOM rather than shown inert (UX-DR3): structural asserts that `(app)/layout.tsx` builds `navItems` via `getNavItemsForRole` and `AppSidebar` only maps the `navItems` prop (no unfiltered `NAV_CATALOG` render; no disabled stub entries)

4. **And** the gate runs in the selfcheck suite **alongside** the Story 8.10 gate: new `selfcheck:no-dead-end-ia` script + entry in `design-qa.selfcheck.ts` `REQUIRED_SCRIPTS` (design-qa green = CI surrogate)

5. **And** Epic 8 / Epic 9 encode held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - `pnpm --filter @divan/identity-access` navigation selfcheck green (matrix unchanged except any assert the gate needs that belongs in identity-access)
   - AR-\* fail-closed; presentation/IA / tooling only

6. **And** scope boundaries:
   - Does **not** add «تنظیمات» to nav (Epic **10**)
   - Does **not** claim Story **9.10** chart work
   - Does **not** widen `ROLE_NAV_HREFS` or invent permissions
   - Does **not** silently close unpaid carry-ins (PopulationPort, mutation IDOR, AD-6, FeedbackMessage adoption debt, etc.)
   - Does **not** introduce Playwright / Vitest / axe as the gate vehicle (repo pattern: `tsx` + `node:assert` + filesystem)

## Tasks / Subtasks

- [x] Task 1: Inventory + resolve path map (AC: #1, #2)
  - [x] Enumerate all `NAV_CATALOG` hrefs and all `SECTION_TAB_SURFACES` tab hrefs in the selfcheck (import SoT modules where possible — prefer `NAV_CATALOG` / `SECTION_TAB_SURFACES` values over hard-coded duplicate lists; if hard-coding for assert clarity, keep a single expected list that must equal SoT length/order)
  - [x] Map each href → `page.tsx` path under `apps/web/app/(app)/` (handle `(tabs)`, catch-all report slugs, root redirects)
  - [x] Confirm each catalog href is in ≥1 role’s `ROLE_NAV_HREFS` (reuse identity-access exports / existing navigation.selfcheck expectations)

- [x] Task 2: Implement `no-dead-end-ia.selfcheck.ts` (AC: #1–#3)
  - [x] NEW `apps/web/lib/no-dead-end-ia.selfcheck.ts` (name aligned with script)
  - [x] Assert every gated page exists + passes functional heuristic
  - [x] Assert no navigable page under catalog roots / section-tab hrefs imports `SectionTabPlaceholder` or embeds placeholder string (repo-wide scan of `app/(app)` **or** per-page read — prefer scan of pages that are in the gated set)
  - [x] Assert UX-DR3 wiring: layout uses `getNavItemsForRole`; sidebar maps `navItems` only (string/AST asserts on those files)
  - [x] Optionally `spawnSync` / document-run `selfcheck:headcount-ia` + `selfcheck:reports-ia` from this gate or from design-qa to avoid assert drift — if inlined, do not duplicate their entire bodies

- [x] Task 3: Quarantine dead placeholder (AC: #2)
  - [x] Either **delete** `section-tab-placeholder.tsx` + remove/retire `SECTION_TAB_PLACEHOLDER` export if unused, **or** keep files but gate fails on any import/usage under navigable pages
  - [x] Prefer delete/retire if grep shows zero production imports — reduces future footgun
  - [x] Update any remaining comments that still say “until 4b.x fills content”

- [x] Task 4: Wire suite + DoD (AC: #4–#6)
  - [x] Add `"selfcheck:no-dead-end-ia": "tsx lib/no-dead-end-ia.selfcheck.ts"` to `apps/web/package.json`
  - [x] Append script to `REQUIRED_SCRIPTS` in `design-qa.selfcheck.ts`
  - [x] Run: identity-access navigation selfcheck; `pnpm --filter @divan/web selfcheck:no-dead-end-ia`; `selfcheck:design-qa`; typecheck `@divan/web` if types touched
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; YAML UTF-8 **without BOM** on Windows
  - [x] Completion Notes: state that design-qa is the CI surrogate (no Actions workflow)

### Manual DoD checklist

- [x] Sidebar for `hr_admin` / `audit_reviewer` / `system_admin`: only permitted items; no greyed unauthorized stubs
- [x] Spot-check each section-tab surface: every tab shows real host or honest empty — never «استوری بعدی»
- [x] `/dev/gallery` still reachable for authenticated users if previously allowed via path rules — **not** required in sidebar
- [x] `selfcheck:design-qa` green; navigation matrix unchanged; no «تنظیمات» nav; 9.10 not claimed

### Review Findings

- [x] [Review][Patch] HOST_SIGNAL tightened — chrome/ui/`page-header`/`section-tabs`/layout shells excluded; requires non-chrome `@/components` host or `defaultTabHref` (decision: option 1)
- [x] [Review][Patch] Redirect-root branch asserts `redirect(defaultTabHref(…))` [`apps/web/lib/no-dead-end-ia.selfcheck.ts`]
- [x] [Review][Patch] Import via `@divan/identity-access` package boundary [`apps/web/lib/no-dead-end-ia.selfcheck.ts`]
- [x] [Review][Patch] Placeholder/host scans use `stripComments` [`apps/web/lib/no-dead-end-ia.selfcheck.ts`]
- [x] [Review][Patch] Disabled-stub assert covers `disabled=` and `aria-disabled=` [`apps/web/lib/no-dead-end-ia.selfcheck.ts`]

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Automated AST/filesystem gate covering catalog + section tabs | Playwright / Vitest as the delivery vehicle |
| Fail on placeholder component/string in navigable pages | Treat honest FeedbackMessage empty as failure |
| Lock UX-DR3 omit-from-DOM wiring | Show disabled nav stubs; client-side full catalog |
| Wire into `selfcheck:design-qa` | Claim GitHub Actions CI if none exists |
| Keep Settings out of scope | Fail gate for missing «تنظیمات»; add settings nav |
| Presentation/tooling only | Widen ROLE_NAV_HREFS; domain/authz churn; Prisma in web |

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `apps/web/lib/no-dead-end-ia.selfcheck.ts` | missing | **NEW** gate | — |
| `apps/web/package.json` | no `selfcheck:no-dead-end-ia` | add script | other selfchecks |
| `apps/web/lib/design-qa.selfcheck.ts` | REQUIRED_SCRIPTS through governance-discoverability | append `selfcheck:no-dead-end-ia` | matrix/checklist/probes; spawn pattern |
| `apps/web/lib/section-tab-surfaces.ts` | still exports `SECTION_TAB_PLACEHOLDER` | remove export if component deleted; else leave until unused | `SECTION_TAB_SURFACES` SoT |
| `apps/web/components/section-tab-placeholder.tsx` | orphan | delete or quarantine | — |
| `packages/modules/identity-access/src/navigation.ts` | complete 11-item catalog | **read-only** unless a true bug | ROLE_NAV_HREFS, labels, landings |
| `navigation.selfcheck.ts` | matrix + correction label | keep green; extend only if IA gate needs shared assert | expected matrices |
| `app/(app)/layout.tsx` / `app-sidebar.tsx` | already correct | assert-only unless bug found | leave-guard links, icons map |
| `sprint-status.yaml` | `9-9-…: backlog` | → ready-for-dev now; → done on implement | structure, comments, no BOM |

### Architecture compliance

- **AD-3:** Web consumes identity-access nav helpers; no duplicate nav SoT in web.
- **AD-5:** No Prisma in `apps/web`; this story adds tooling only.
- **Epic 9 intro:** Domain rules from Epics 3–7 unchanged; this story **locks** surface completion already delivered in 9.1–9.8.
- **Epic 8 retro:** mandatory design-qa; filesystem/AST heuristics; no Playwright ceiling.
- Fail-closed path access (`canAccessPath`, `assertPageAccess`) remains authoritative for deep links — gate does not replace it.

### Library / framework requirements

| Tech | Guidance |
| --- | --- |
| Node `tsx` + `node:assert/strict` + `fs` | Same as governance-discoverability / design-qa / headcount-ia |
| `spawnSync` + `pnpm --filter @divan/web run …` | Prefer package scripts (Windows path safety; Node 24 DEP0190 — single-string + `shell: true` as in design-qa) |
| Next.js 16 App Router | Path map must understand route groups `(tabs)`, optional catch-alls `[[...slug]]`, server `redirect` roots |
| No new UI libs | Gate-only story; UI changes only if a real dead-end is found while inventorying |

### File structure requirements

- Selfcheck lives under `apps/web/lib/` and is wired through `package.json` → `design-qa`
- Nav SoT stays in `@divan/identity-access`; section-tab SoT stays in `section-tab-surfaces.ts`
- Do not create a parallel `NAV_CATALOG` in web
- Do not move governance under new sidebar items

### Testing requirements

| Check | Command / method |
| --- | --- |
| New IA gate | `pnpm --filter @divan/web selfcheck:no-dead-end-ia` |
| Design-QA (8.10 + 9.x) | `pnpm --filter @divan/web selfcheck:design-qa` |
| Identity-access nav | `pnpm --filter @divan/identity-access exec tsx src/navigation.selfcheck.ts` (or package script if present) |
| Optional focused IA | `selfcheck:headcount-ia`, `selfcheck:reports-ia` (compose into gate or design-qa) |
| Types | `@divan/web` typecheck if TS modules touched |
| Manual | DoD checklist above |

### Previous story intelligence

**From 9.8 (done, baseline `fe4ea92`):** Governance labels/purposes/CTAs shipped; downstream note: «9.9 expects these labels/routes functional». Settings explicitly out of scope. Selfcheck pattern: thin `*.selfcheck.ts` + design-qa `REQUIRED_SCRIPTS`. Windows BOM warning for YAML. Presentation/IA only.

**From 9.7:** Drill-through paths must stay functional; `drill-through.selfcheck.ts` already in design-qa — do not regress. Anti-enumeration profile ≠ FeedbackMessage not-permitted.

**From 9.4 / 9.5:** `headcount-ia` / `reports-ia` already ban `SectionTabPlaceholder` on create/workspace — reuse; opportunity to pull those scripts into the orchestrator.

**From 9.3:** «no placeholder page remains» was story-local; 9.9 makes **regression** impossible.

**From 8.10 / Epic 8 retro:** design-qa is the quality ceiling; Vitest/ephemeral still unpaid — do not introduce Vitest here just for the gate.

**From EXPERIENCE:** «No dead ends. A tab that renders is a tab that works.» Honest empty with action ≠ dead end.

### Git intelligence summary

Recent commits: `fe4ea92` story 9.8 → `967ca65` 9.7 → `d6e6814` 9.6 → `168d7d9` 9.5 → `b33345b` 9.4`. Pattern: one commit per story; thin web IA + selfcheck wiring; design-qa `REQUIRED_SCRIPTS` append; sprint-status + deferred-work; no domain churn. 9.9 should be **tooling-heavy**, UI-light (delete orphan placeholder if safe).

### Project structure notes

- Flat surfaces (dashboard, import, audit, operations, correction-cases) are catalog roots without section tabs — still gated via `NAV_CATALOG`.
- Section-tab surfaces: personnel, organization, headcount, access, personnel-events, reports.
- `/personnel/profile/[personId]` is drill-through, not sidebar — out of primary gate set.
- Detected variance: `SECTION_TAB_PLACEHOLDER` + `SectionTabPlaceholder` remain as dead code — remove or ban.
- Detected variance: `selfcheck:headcount-ia` / `reports-ia` not in design-qa — compose in 9.9 if cheap.

### Latest tech information

- Keep filesystem/AST selfchecks; do not adopt Playwright for this gate (repo ceiling confirmed Epic 8 retro).
- When resolving page paths from hrefs, stay inside `apps/web/app/(app)` — use `path.resolve` + containment check (`resolved === root || resolved.startsWith(root + path.sep)`) if building paths from strings; do not trust raw user path joins for security (gate is developer-local, but follow safe resolve habits).
- Node 24+: prefer design-qa’s single-string `spawnSync(..., { shell: true })` to avoid DEP0190.
- Next.js 16: route groups do not appear in URL; catch-all report tabs live under `[[...slug]]/page.tsx`.

### Project context reference

No `project-context.md` found in repo at story creation; follow Architecture Spine AD-3/AD-5, UX 2026-07-31 EXPERIENCE «No dead ends», Epic 9 presentation/IA gate, FR-59, UX-DR3, and Stories 9.1–9.8 completion contracts.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9 / Story 9.9; FR59; UX-DR3]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — §4.2.5 Story 9.9]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — No dead ends]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-59]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-3/AD-5]
- [Source: `_bmad-output/implementation-artifacts/9-8-governance-surface-discoverability.md`]
- [Source: `_bmad-output/implementation-artifacts/9-7-profile-access-cross-surface-drill-through.md`]
- [Source: `packages/modules/identity-access/src/navigation.ts`]
- [Source: `apps/web/lib/section-tab-surfaces.ts`]
- [Source: `apps/web/lib/design-qa.selfcheck.ts`]
- [Source: `apps/web/components/app-sidebar.tsx`]
- [Source: `apps/web/app/(app)/layout.tsx`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- `pnpm --filter @divan/web selfcheck:no-dead-end-ia` → ok (11 catalog + 24 tabs)
- `pnpm --filter @divan/identity-access exec tsx src/navigation.selfcheck.ts` → ok
- `pnpm --filter @divan/web selfcheck:design-qa` → ok (includes no-dead-end-ia)
- `pnpm --filter @divan/web typecheck` → ok

### Completion Notes List

- Implemented filesystem/AST IA gate covering `NAV_CATALOG` (11) + `SECTION_TAB_SURFACES` tabs (24): page exists, no placeholder, host signal (`defaultTabHref` redirect or `@/components` import), catalog href in ≥1 role via `getNavItemsForRole`.
- UX-DR3 structural lock: `(app)/layout.tsx` uses `getNavItemsForRole`; `AppSidebar` maps `navItems` only (no `NAV_CATALOG`, no disabled stubs).
- Deleted orphan `section-tab-placeholder.tsx` and retired `SECTION_TAB_PLACEHOLDER` export.
- Composed `selfcheck:headcount-ia` + `selfcheck:reports-ia` from the new gate to avoid assert drift.
- Wired `selfcheck:no-dead-end-ia` into `package.json` and `design-qa.selfcheck.ts` `REQUIRED_SCRIPTS`.
- **CI honesty:** repo has no GitHub Actions selfcheck workflow; `pnpm --filter @divan/web selfcheck:design-qa` is the CI surrogate.
- Scope held: no «تنظیمات» nav; no ROLE_NAV_HREFS widen; no 9.10 chart claim; presentation/tooling only.
- Review follow-up: tightened host signal (exclude chrome/ui shells), assert `redirect(defaultTabHref(…))`, package import, comment-stripped scans, broader disabled stub ban.

### File List

- `apps/web/lib/no-dead-end-ia.selfcheck.ts` (new)
- `apps/web/lib/design-qa.selfcheck.ts` (modified)
- `apps/web/lib/section-tab-surfaces.ts` (modified — removed `SECTION_TAB_PLACEHOLDER`)
- `apps/web/package.json` (modified)
- `apps/web/components/section-tab-placeholder.tsx` (deleted)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/9-9-no-dead-end-ia-gate.md` (modified)

### Change Log

- 2026-08-02: Story context created via bmad-create-story (ready-for-dev).
- 2026-08-02: Implemented no-dead-end IA gate + placeholder quarantine; status → review.
- 2026-08-02: Code review patches applied (HOST_SIGNAL chrome exclusion, redirect(defaultTabHref) assert, `@divan/identity-access` import, stripComments, disabled/aria-disabled); status → done.
