# Spine Pair Review — divan

## Overall verdict

The spine pair is **architecture-ready for MVP** with strong flow coverage, correct canonical shape, and resolved IA from PRD journeys. Gaps cluster around **dark-mode semantic tokens**, **a few component/visual pairs** (Jalali picker, login, export retrieval), **thin state coverage** on admin/audit surfaces, and **naming inconsistency** between Title Case (EXPERIENCE) and kebab-case (DESIGN). No broken blockers; address high findings before story baselines for reporting/import/login.

## 1. Flow coverage — strong

Checked PRD §4 UJ-1–UJ-5 against EXPERIENCE.md Key Flows.

All five journeys present with named protagonists (Mina, Reza, Sara, Niloofar, Arman), numbered steps, climax beat, and failure path.

### Findings

- **low** Login/authentication journey absent as named flow (FR-1 LDAP failure only in State Patterns). *Fix:* Add short Key Flow or explicit login surface in IA — optional for MVP if auth is delegated to architecture.

## 2. Token completeness — adequate

Extracted YAML tokens and `{path.to.token}` prose references.

Light/dark pairs present for `primary`, `accent`, `chrome`, `muted-brand`, and foreground companions.

### Findings

- **high** Status badge tokens (`status-badge-scheduled/effective/cancelled`) lack **dark-mode pairs** despite mandatory light/dark product requirement (DESIGN.md Colors, EXPERIENCE.md Foundation). *Fix:* Add `-dark` variants or document shadcn semantic mapping for dark content + verify contrast.
- **high** `stale-banner` tokens are light-only (`#FFF3BF` / `#862E00`) — unreadable or low-contrast on dark content canvas. *Fix:* Add `stale-banner-dark` pair in YAML and Colors table.
- **medium** Semantic statuses **Reversed**, **Draft**, **Override/warning** referenced in prose but not in YAML `components` or token table. *Fix:* Add tokens or explicit inherit rule from shadcn `destructive` / `accent`.
- **medium** `sidebar-active-item` uses hardcoded `rgba(255,255,255,0.12)` instead of token reference — breaks theme consistency in dark chrome. *Fix:* Name token `sidebar-active-background` with dark value.
- **low** Contrast verification stated as MUST but no recorded ratios for `{colors.accent}` on dark content at 14px. *Fix:* Add note that implementation gate includes measured ratios per mode.

## 3. Component coverage — adequate

Cross-walked EXPERIENCE.md Component Patterns vs DESIGN.md Components.

### Findings

- **high** **Jalali date picker** required by FR-44 and EXPERIENCE Interaction Primitives — no row in either Component Patterns (behavior) or DESIGN Components (visual). *Fix:* Add `jalali-date-picker` to both spines with control anatomy, error state, and calendar overlay behavior.
- **medium** **Personnel event form** — behavioral rules exist; no visual composition spec (section headers, draft vs finalize button placement). *Fix:* Add DESIGN composition row or reference shadcn `Form` + `button-primary`/`button-secondary` layout rule.
- **medium** **Sensitive confirmation dialog** — behavioral spec strong; DESIGN relies implicitly on shadcn `Dialog` + `button-primary`. *Fix:* One DESIGN row: dialog width, consequence block typography (`body` + `caption`), reason field placement.
- **medium** **Export retrieval / artifact download** — IA surface «خروجی / بازیابی» with FR-52 behavior in states but no component pattern row. *Fix:* Add `export-artifact-panel` to both spines (classification notice, expiry, reauth, custody acknowledgement).
- **low** **Theme toggle** — behavioral only; acceptable if shadcn `DropdownMenu` inherit documented in DESIGN Do's.

## 4. State coverage — adequate

Walked IA surfaces against State Patterns.

### Findings

- **medium** **گزارش‌ها** — inference/small-cohort suppression appears only in UJ-3 failure, not State Patterns table. *Fix:* Add row: «Suppressed metric cell» with Persian copy pattern per AR-REPORTING placeholder.
- **medium** **ممیزی**, **دسترسی‌ها**, **پرونده‌های اصلاح** — no surface-specific empty/error/loading states. *Fix:* Add minimal rows (empty audit log, empty entitlements list, breached correction case deadline).
- **low** **پروفایل** — empty timeline (new employee post-migration) not specified. *Fix:* One empty-state row with operational copy.

## 5. Visual reference coverage — adequate

Files: `mockups/` (3), `wireframes/` (2), `imports/fonts/` (24).

### Findings

- **medium** `imports/fonts/yekan-bakh/` **not linked** in DESIGN.md Typography despite being authoritative font source. *Fix:* Inline link at Typography section.
- **low** `.working/color-themes-*.html` linked from DESIGN; `.working/prd-ux-extract.md` and `reconcile-prd.md` correctly not linked (working artifacts). No orphan mocks.

Spines-win-on-conflict stated in both files.

## 6. Bloat & overspecification — strong

EXPERIENCE.md is table-driven; FR references in IA Purpose column are useful traceability, not bloat. DESIGN.md editorial Brand section earns its place. No pixel-duplication beyond token system.

### Findings

- **low** Duplicate mock coverage table at end of EXPERIENCE.md overlaps IA — acceptable for handoff clarity.

## 7. Inheritance discipline — adequate

UJ IDs verbatim from PRD. Sources frontmatter resolves. Token refs `{colors.*}`, `{spacing.*}`, `{stale-banner}` resolve.

### Findings

- **medium** Component naming drift: EXPERIENCE uses **Title Case** («Personnel data table») vs DESIGN **kebab-case** (`personnel-data-table`). Downstream story-dev may split names. *Fix:* Align EXPERIENCE Component Patterns first column to kebab-case matching DESIGN.
- **low** EXPERIENCE Open Questions OQ-4 slightly contradicts «all Persian digits» general rule vs export interchange — correctly flagged as open.

## 8. Shape fit — strong

DESIGN.md canonical order correct. EXPERIENCE.md has all required sections plus defensible Open Questions, Mock coverage, Inspiration (triggered), Responsive (breakpoints declared).

### Findings

- none

## Mechanical notes

- Both spines `status: final` — consistent.
- EXPERIENCE `sources` uses `{planning_artifacts}` placeholder — matches project convention.
- `research-hris-practices.md` listed as source but not extracted in reconcile — documented in reconcile-prd.md.
- No Mermaid in spines.
