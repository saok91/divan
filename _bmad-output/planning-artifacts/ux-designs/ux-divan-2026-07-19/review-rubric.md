# Spine Pair Review — divan

## Overall verdict
The shell redesign delta (collapsible sidebar, section tabs, governed tables/trees, personnel/events split) is load-bearing and mostly committed, but this pair is **not yet a clean standalone contract** for architecture/story-dev. Downstream consumers must chase `ux-divan-2026-07-13` for three PRD journeys, most state patterns, contrast math, and several component behaviors — while three new key-screen mocks exist on disk but are orphaned from the spines, and UJ-2’s identity has drifted from the PRD.

## 1. Flow coverage — thin

**Pass 1 extract (sources → UJ names):** PRD/epics + prior EXPERIENCE → UJ-1…UJ-5. Memlog adds secondary Admin access journey.

| Journey | In this EXPERIENCE | Protagonist | Numbered steps | Climax | Failure |
|---|---|---|---|---|---|
| UJ-1 (Mina transfer / shell rewrite) | Full Key Flow | Yes | Yes | Yes | Yes |
| UJ-2 (PRD: Reza **correction**) | **Missing** as that journey | — | — | — | — |
| UJ-2 (this file: Reza **access grant**) | Full Key Flow (repurposed id) | Yes | Yes | Yes | **No** |
| UJ-3 (Sara) | “Unchanged intent… retained” stub | No | No | No | No |
| UJ-4 (Niloofar migration) | Dual-entry note only | No | No | No | No |
| UJ-5 (Arman ops) | “Unchanged.” stub | No | No | No | No |

### Findings
- **critical** PRD UJ-2 (correction / timeline / linked chain) is not source-extractable from this spine; the UJ-2 slot was reused for access-admin (EXPERIENCE.md Key Flows UJ-2; sources: `prd.md` §4). *Fix:* Restore PRD UJ-2 as a Key Flow (or alias `UJ-2-correction` + `UJ-Access`) with steps/climax/failure; keep access as a separately named journey.
- **critical** UJ-3 / UJ-4 / UJ-5 lack named protagonist, numbered steps, climax, and failure in this file — “retained” is not extractable without opening 2026-07-13 (EXPERIENCE.md Key Flows). *Fix:* Inline the prior flows (or deep-link to exact anchors) and note only shell entry-point deltas (اطلاعات پرسنلی, ورود گروهی vs ورود داده).
- **high** New UJ-2 (access) has no failure path (denied assign, toxic combination, scope inactive) (EXPERIENCE.md UJ-2). *Fix:* Add fail-closed Persian + blocked finalize/save beat.
- **medium** UJ-1 climax/failure are strong for the redesign path, but diverge from PRD wording (list→quick-edit→events tab vs profile→event); acceptable if intentional — commit the divergence explicitly in the flow header. *Fix:* One-line “supersedes 2026-07-13 UJ-1 path; PRD outcome unchanged.”

## 2. Token completeness — adequate

**Frontmatter colors:** All listed color tokens have hex (or rgba for sidebar-active). Light/dark pairs present for primary, accent, chrome, muted-brand, sidebar-active, badges, banners.

**Prose `{…}` refs:** Resolve under a *local shorthand convention* (`{caption}` → typography.caption; `{quick-edit-modal.maxWidth}` → components.quick-edit-modal) but **not** under strict `{path.to.token}` as in design-md-spec (`{typography.caption}`, `{components.quick-edit-modal.maxWidth}`).

**Contrast:** This DESIGN.md Colors section defers to “2026-07-13 Colors contract” without restating AA targets / CTA forbidden combinations (DESIGN.md Colors; contrast lives only in prior DESIGN.md ~CTA contract).

### Findings
- **high** Load-bearing contrast targets (CTA ≥4.5:1, chrome nav AA, badge/banner pairs) are not stated in this spine — only “inherit prior” (DESIGN.md Colors). *Fix:* Restate the CTA + chrome + badge contrast bullets (or quote the prior ratios inline).
- **medium** Shorthand token paths (`{caption}`, `{personnel-event-form.maxWidth}`, `{sidebar-active-item}`) will break naive frontmatter resolvers (DESIGN.md Layout & Components). *Fix:* Use full paths, or document the shorthand resolver once under Brand & Style.
- **low** `button-secondary` lacks dark background/foreground component mappings while `button-primary` has them (DESIGN.md YAML components). *Fix:* Add dark pairs or state “secondary uses `{colors.primary-dark}` on dark canvas.”
- **low** `imports/` empty; fonts pointed at prior run (DESIGN.md Brand & Style) — OK if inheritance path is mandatory for build, else copy/symlink at finalize.

## 3. Component coverage — thin

**DESIGN Components table / YAML (this run):** sidebar-nav, section-tabs, governed-data-table, tree-navigator, quick-edit-modal, plus YAML for status badges, banners, jalali-date-picker, sensitive-confirmation-dialog, personnel-event-form, export-artifact-panel, buttons, chrome, etc.

**EXPERIENCE Component Patterns:** app-shell, section-tabs, governed-data-table, tree-navigator, personnel-quick-edit-modal, personnel-event-form, command-palette, person-profile-section / personnel-event-timeline, headcount-capacity-panel, sensitive-confirmation-dialog, import-preview-table, stale-recalc-banner / break-glass-banner / status-badge / theme-toggle.

### Findings
- **critical** Naming split: DESIGN `quick-edit-modal` vs EXPERIENCE `personnel-quick-edit-modal` — consumer cannot join visual↔behavioral rows by name (DESIGN.md Components; EXPERIENCE.md Component Patterns). *Fix:* One canonical id + alias line.
- **high** `import-preview-table` used in EXPERIENCE with behavioral rules; no visual row/YAML in this DESIGN (and not listed under Inherited brand overrides) (EXPERIENCE.md Component Patterns). *Fix:* Add DESIGN row or explicit `inherits prior DESIGN.md import-preview-table`.
- **high** `sidebar-nav` has visual spec only; collapse/tooltip/`aria-label` live under `app-shell` with no DESIGN `app-shell` / EXPERIENCE `sidebar-nav` pairing (DESIGN.md Components; EXPERIENCE.md app-shell). *Fix:* Align names (`sidebar-nav` in both) or map “app-shell ⊃ sidebar-nav.”
- **medium** Inherited compositions cited as “Unchanged” (`command-palette`, `theme-toggle`, `person-profile-section`, `personnel-event-timeline` vs prior `event-timeline-row`) without dual rows in this pair — extract requires prior spine (EXPERIENCE.md Component Patterns; DESIGN.md Inherited list). *Fix:* Alias table: this-name → prior-file#anchor.
- **medium** `stale-recalc-banner` (EXPERIENCE) vs `stale-banner` (DESIGN YAML) — same class of join failure. *Fix:* Unify id.
- **low** `jalali-date-picker` / `export-artifact-panel` in DESIGN YAML but absent from this EXPERIENCE Component Patterns (behavior deferred to prior). *Fix:* One-line “behavior: prior EXPERIENCE” per component.

## 4. State coverage — thin

**IA surfaces walked:** داشبورد، اطلاعات پرسنلی (+tabs)، رویدادهای پرسنلی، ساختار سازمان (tree + tables)، ظرفیت و جذب، گزارش‌ها، ورود داده، دسترسی‌ها (+tabs)، ممیزی، عملیات، پرونده‌های اصلاح، پروفایل، خروجی/بازیابی.

**This file State Patterns:** empty governed table; default personnel filter; sidebar collapsed; empty entitlements; prefilled event form — plus “Prior spine states remain.”

Prior covers cold-load, permission-denied, unsaved form/import, validation, stale/recalc, LDAP, empty audit/dashboard, etc. **Not** covered for new chrome:

### Findings
- **high** Empty / cold-load for **tree-navigator** surfaces (سلسله‌مراتب، لدر و گرید) unspecified here and absent from prior State Patterns (EXPERIENCE.md IA ساختار سازمان; State Patterns). *Fix:* Empty tree copy + skeleton row treatment.
- **high** New tabs without dedicated states: فرهنگ داده (Admin empty), ورود گروهی (empty preview), دسترسی اضطراری (armed vs idle), رویدادها empty beyond generic table empty (EXPERIENCE.md Section tabs). *Fix:* Rows per tab or “inherits empty governed table + …”.
- **medium** Permission-denied for Admin-only **فرهنگ داده** tab (hidden vs deep-link denial) not restated (EXPERIENCE.md اطلاعات پرسنلی tabs). *Fix:* Explicit: hide tab without permission; deep link → «دسترسی ندارید.»
- **medium** Unsaved guard on dirty form tabs claimed in section-tabs behavior but not in State Patterns table (EXPERIENCE.md Component Patterns section-tabs vs State Patterns). *Fix:* Promote to State Patterns row.
- **low** Offline N/A (prior: no offline mode) — OK if restated once. Focus (filter debounce / tree keyboard) covered under Interaction/a11y more than State — adequate.

## 5. Visual reference coverage — broken

**Inventory:**
| Path | Files |
|---|---|
| `mockups/` | `key-personnel-list.html`, `key-org-ladder-grade.html`, `key-access-admin.html` |
| `wireframes/` | `ia-2026-07-19.excalidraw` |
| `imports/` | *(none)* |
| `.working/` (extra) | duplicate IA + mock HTML + `source-extract.md` |

**Spine links:** `.working/ia-2026-07-19.excalidraw` only; prior `../ux-divan-2026-07-13/mockups/*`; Mock coverage claims new key screens are “spine-only until Finalize mocks.”

**Spines win on conflict:** stated (DESIGN.md Brand; EXPERIENCE.md lead) — OK.

### Findings
- **critical** Three `mockups/*.html` files are **orphans** — not linked inline at IA/Components/Key Flows; Mock coverage table falsely says spine-only (EXPERIENCE.md Mock coverage; filesystem `mockups/`). *Fix:* Link each at the relevant section with one-line illustration claim; update Mock coverage to `mocked`.
- **critical** Canonical IA wireframe lives in `wireframes/ia-2026-07-19.excalidraw` but spines point at `.working/ia-2026-07-19.excalidraw` (DESIGN.md Brand; EXPERIENCE.md Foundation / Mock coverage). *Fix:* Point both spines at `wireframes/…`; treat `.working/` as draft only.
- **high** Unspecific prior reference `mockups/*` does not name what each file illustrates (EXPERIENCE.md Mock coverage). *Fix:* List concrete files + “outdated for shell; spine wins.”
- **medium** New mocks’ HTML comments claim governance of spines, but spines do not claim the mocks — contract direction inverted. *Fix:* Bidirectional: spine → mock path; mock header may cite spine sections.
- **low** `imports/` empty with fonts from prior — document as intentional inherit or add symlink note at Finalize.

## 6. Bloat & overspecification — strong

Delta posture is appropriate: DESIGN restates brand YAML for machine use and focuses prose on shell/table/tree deltas; EXPERIENCE IA tables are dense but decision-dense, not ornamental. Status-badge YAML restatement is verbose but useful for extract without opening prior. No significant overspecification of implementation (AG Grid banned once; Lucide deferred to OQ).

### Findings
- **low** Inherited component laundry lists (“etc.”) invite incomplete extract (DESIGN.md Components Inherited). *Fix:* Prefer explicit alias table over “etc.”

## 7. Inheritance discipline — thin

`inherits` / sources correctly declare 2026-07-13 + PRD + epics + memlog, and many sections say “Unchanged.” That is legitimate for a revision **only if** retained contracts remain joinable. Here, inheritance is used to skip extractable Key Flows and contrast, while simultaneously **overwriting UJ-2’s meaning** and shipping new mocks outside the spine index — consumers cannot tell what is delta vs what must be fetched.

### Findings
- **critical** Soft inherit (“prior states/flows remain”) without stable anchors + hard override of UJ-2 id = unsafe for AI story-dev (EXPERIENCE.md Key Flows / State Patterns). *Fix:* Inheritance map: `retained → path#heading`; overrides listed explicitly.
- **high** Memlog still has historical tab-order lines (لدر \| گرید separate) before override merge; spine correctly has **لدر و گرید** — good — but consumers reading memlog alone can diverge (.memlog.md vs EXPERIENCE.md ساختار سازمان). *Fix:* Memlog tip-of-file “current IA” blurb or strike superseded decisions.
- **medium** DESIGN Colors “unchanged” hollow section vs full token YAML — split brain for humans vs machines (DESIGN.md Colors). *Fix:* Either omit Colors body or restate posture + contrast in one short paragraph.

## 8. Shape fit — adequate

Against skill examples (Drift): required sections present (Foundation → IA → Voice → Components → States → Primitives → A11y → Responsive → Inspiration → Key Flows → OQ → Mock coverage). Delta DESIGN matches brand-layer shape. Weak vs example: Drift inlines complete journeys and links every mock at the relevant section; this pair’s Mock coverage and retained UJs do not meet that consumer bar yet. Status `draft` is accurate.

### Findings
- **medium** Mock coverage + Open Questions still describe pre-Finalize state while mocks already exist (EXPERIENCE.md Mock coverage; OQ-R5; .memlog Finalize events). *Fix:* Sync status language to artifacts on disk; bump toward `final` only after links + flow gaps close.
- **low** Dual IA paths (`.working` + `wireframes`) confuse “working vs published” shape. *Fix:* Single published path under `wireframes/`.

## Mechanical notes

- **Pass 1 strong categories:** none (tokens closest: adequate).
- **Extract blockers for architecture/story-dev:** (1) orphan mocks + wrong IA path, (2) UJ-3/4/5 non-extractable stubs, (3) UJ-2 identity collision with PRD, (4) quick-edit / stale-banner name splits, (5) tree empty states.
- **What is solid:** Shell IA order; section-tab matrices; governed-data-table + tree-navigator behavior; UJ-1 redesign path with climax/failure; spines-win rule; memlog-aligned org ladder+grade merge; desktop RTL density tokens in YAML.
- **Recommended gate before treating as contract:** fix visual index + restore/alias PRD journeys + unify component ids; then re-run Pass 1 only.

### Finding counts
| Severity | Count |
|---|---|
| critical | 6 |
| high | 8 |
| medium | 10 |
| low | 7 |
