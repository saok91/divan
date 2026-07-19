---
name: Divan HRIS
status: final
sources:
  - {planning_artifacts}/ux-designs/ux-divan-2026-07-13/DESIGN.md
  - {planning_artifacts}/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md
  - {planning_artifacts}/prds/prd-divan-2026-07-11/prd.md
  - {planning_artifacts}/epics.md
  - {implementation_artifacts}/2-3-access-administration-ui-apis.md
  - memlog: .memlog.md
updated: 2026-07-19
---

# Divan HRIS — Experience Spine (Shell Redesign)

> Revision of `ux-divan-2026-07-13`. MVP Persian RTL desktop HRIS. shadcn/ui + brand-layer `DESIGN.md` (this run). **Table-first sections, collapsible sidebar, section tabs.** Spines win on conflict with wireframes and prior mocks.

## Foundation

**Form-factor:** Desktop web only — 1280×720 through 2K, reference 1920×1080. Persian-only UI, RTL throughout.

**UI system:** shadcn/ui on Next.js + Tailwind. Visual identity: `DESIGN.md` in this workspace (inherits 2026-07-13 brand; adds collapsed sidebar + governed-table tokens).

**Deployment context:** Single-organization, on-premise, ~500 people. LDAP/AD auth. Default-deny authorization independent of UI visibility.

**Theme modes:** Light/dark content; chrome stays navy (`{colors.chrome}`). Preference per account. Theme swap in-place; no unsaved-form trigger.

**Shell posture:** Collapsible RTL sidebar (icons + labels ↔ icon-only); each major nav surface hosts **horizontal section tabs**; primary workspaces are **full-width** governed tables or trees.

→ IA: `wireframes/ia-2026-07-19.excalidraw`. Key mocks: `mockups/key-personnel-list.html`, `mockups/key-access-admin.html`, `mockups/key-org-ladder-grade.html`. Prior 2026-07-13 mocks remain illustrative where not replaced. **Spines win on conflict.**

### Inheritance map (vs `ux-divan-2026-07-13`)

| Kind | Item | Disposition |
|---|---|---|
| **Delta** | Collapsible sidebar, section tabs, governed-data-table filters, personnel/events split, person-first دسترسی‌ها, tree-navigator for سلسله‌مراتب / لدر و گرید | This spine |
| **Delta** | UJ-1 entry via فهرست + quick-edit; **UJ-Access** (new); leave-guards / toxic / grade-parent edges below | This spine |
| **Retained** | Voice/tone, keyboard map, a11y floor base, theme/chrome rules | Prior EXPERIENCE |
| **Retained** | UJ-2 correction, UJ-3 Sara, UJ-4 migration, UJ-5 Arman | Condensed inline below (source: prior `#key-flows`) |
| **Retained** | person-profile-section, personnel-event-timeline, headcount-capacity-panel, command-palette, import-preview-table semantics, banner stack order | Prior; shell entry points updated |
| **Alias** | `stale-recalc-banner` (behavior) ↔ `stale-banner` (DESIGN token) | Same component |
| **Compose** | `sidebar-nav` is part of `app-shell` (not a separate surface) | — |

## Information Architecture

### Sidebar (role-filtered; unauthorized = hidden)

| Order | Surface | Notes |
|---|---|---|
| 1 | **داشبورد** | Unchanged purpose (FR-35) |
| 2 | **اطلاعات پرسنلی** | Renamed from «پرسنل»; Operator landing |
| 3 | **رویدادهای پرسنلی** | **New top-level** — not nested under پرسنل |
| 4 | **ساختار سازمان** | Hierarchy + job references (FR-9–FR-10) |
| 5 | **ظرفیت و جذب** | Headcount (FR-28–FR-32) |
| 6 | **گزارش‌ها** | FR-36 |
| 7 | **ورود داده** | Advanced/migration import (FR-37–FR-40) |
| 8 | **دسترسی‌ها** | Redesigned admin mental model (FR-2–FR-4, FR-46) |
| 9 | **ممیزی** | FR-42 |
| 10 | **عملیات** | FR-45; SysAdmin landing |
| 11 | **پرونده‌های اصلاح** | FR-53 |

**Contextual (not sidebar):** پروفایل فرد (full page); خروجی/بازیابی (export action).

**Sidebar collapse:** Default expanded. Footer toggle. Persist per account. Collapsed = icons + tooltip (hover/focus). Content width reclaims `{spacing.sidebar-width}` − `{spacing.sidebar-width-collapsed}`.

→ `wireframes/ia-2026-07-19.excalidraw`

### Section tabs

#### اطلاعات پرسنلی

| Tab | Purpose |
|---|---|
| **فهرست پرسنل** | Primary governed table (see columns below) |
| **افزودن** | Full create form (optional fields allowed empty) |
| **ورود گروهی** | Day-to-day Excel/CSV bulk create |
| **فرهنگ داده** | Admin-only field/reference dictionary |

**فهرست پرسنل columns:** کد پرسنلی · نام · نام خانوادگی · تیم · نقش · نردبان · گرید · نوع همکاری · جبران خدمت (permission-gated) · تاریخ پایان قرارداد · طرف قرارداد · همکار فعلی (yes/no).  
**Default filter:** همکار فعلی = yes (dismissible).  
**Toolbar:** «افزودن سریع» → minimal-create modal.  
**Row actions:** «اطلاعات کامل/ویرایش» → `personnel-quick-edit-modal` (+ link «باز کردن پروفایل کامل»); «ثبت رویداد» → navigate to **رویدادهای پرسنلی / ثبت رویداد** with person pre-filled.

→ `mockups/key-personnel-list.html`

#### رویدادهای پرسنلی

| Tab | Purpose |
|---|---|
| **رویدادها** | Recent/all events governed table; toolbar «ثبت رویداد» |
| **ثبت رویداد** | Full single-event form (draft → finalize) |
| **ورود گروهی** | Bulk event create |

#### ساختار سازمان

| Tab | Purpose |
|---|---|
| **سلسله‌مراتب** | Expand/collapse tree (`+/-`) LE → BU → Dept → Team; toolbar «افزودن»; node click → edit modal |
| **نقش سازمانی** | Flat governed table + «افزودن» modal |
| **عنوان شغلی** | Flat governed table + «افزودن» modal |
| **لدر و گرید** | Tree: ladder parents, grade children; create ladder or grade from same toolbar/modals |
| **ارشدیت** | Flat governed table + «افزودن» modal |

No separate «افزودن» tab for org; bulk org import deferred.

→ `mockups/key-org-ladder-grade.html`

#### ظرفیت و جذب

| Tab | Purpose |
|---|---|
| **هدکانت** | Governed table; toolbar create |
| **ایجاد** | Full single create form |
| **ورود گروهی** | Bulk headcount create |

#### دسترسی‌ها (redesign)

| Tab | Purpose |
|---|---|
| **افراد و دسترسی** | Person-first: accounts table → assign roles/scopes, link, active status |
| **نقش‌ها** | Define roles ↔ permission sets |
| **محدوده‌ها** | OrganizationalScope CRUD (label, active) — not org units |
| **دسترسی اضطراری** | Break-glass; visually distinct / warning posture |

→ `mockups/key-access-admin.html`

#### Import dual-entry

- Per-section **ورود گروهی** = day-to-day bulk for that domain.
- Sidebar **ورود داده** = advanced/migration wizard; not replaced by section tabs.

### Role landings

| Role | First surface |
|---|---|
| HR Operator | **اطلاعات پرسنلی** → فهرست پرسنل |
| HR Admin | **داشبورد** |
| Manager | **داشبورد** (scoped) |
| Audit reviewer | **ممیزی** |
| System Admin | **عملیات** |

**Modal depth:** One dialog stack. Quick-edit and confirmations are dialogs; full event form lives on tab; import preview = `Sheet`.

## Voice and Tone

Unchanged from prior spine — direct-operational Persian.

| Do | Don't |
|---|---|
| «انتقال ثبت شد. از ۱۴۰۴/۰۴/۰۱ اعمال می‌شود.» | «عملیات با موفقیت انجام گردید! ✅» |
| «نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.» | Empty table with no recovery action |
| «دسترسی ندارید.» | Tease forbidden nav items as disabled |

## Component Patterns

Behavioral. Visual specs in `DESIGN.md`.

| Component | Use | Behavioral rules |
|---|---|---|
| **app-shell** | Global | Header + collapsible RTL sidebar (`sidebar-nav` is part of app-shell) + banner stack (`stale-recalc-banner` / DESIGN `{stale-banner}` → `break-glass-banner`). Skip «پرش به محتوا». Collapse toggle in sidebar footer; preference persisted. |
| **section-tabs** | Each major nav surface | Horizontal tabs; URL reflects tab; leave-guard when leaving dirty form/preview tabs (see State Patterns). |
| **governed-data-table** | Primary lists | Full width; compact; per-column filters — **enum** = multi-select options (Excel-like), **text** = typeahead substring; header sort + `aria-sort`; stable-snapshot pagination; **any filter/sort change → new snapshot, page = 1**; result count; sticky id (RTL start) + sticky row actions (inline-end); sensitive columns **omitted from DOM** without permission; empty → «پاک کردن فیلترها» = **reset to section defaults** (فهرست پرسنل: همکار فعلی = yes). **Not AG Grid in MVP.** |
| **tree-navigator** | سلسله‌مراتب, لدر و گرید | Expand/collapse per node; keyboard: arrows expand/collapse/move; Enter opens edit modal; toolbar add creates at allowed level / under selected parent. **«افزودن گرید»** disabled until a ladder node is selected (or modal requires parent). **Deactivate-with-active-children / impossible reparent:** fail-closed Persian; confirm lists blocking children; no silent success. |
| **personnel-quick-edit-modal** | فهرست پرسنل | Non-event fields only; Save; link to full profile; does not register personnel events. **Dirty:** «تغییرات ذخیره نشده‌اند.» Stay · Discard · Save; block profile link, ثبت رویداد, Esc/overlay dismiss, and any nav until resolved. |
| **personnel-event-form** | ثبت رویداد tab | Pre-fill person when arrived from list row action; capacity panel; draft ≠ finalize; unsaved warning. **Inbound prefill** while tab dirty: run leave-guard first; never silent person swap. |
| **command-palette** | Global | Unchanged search/navigate behavior from prior spine; subject to leave-guard when target leaves a dirty form/preview. |
| **person-profile-section** / **personnel-event-timeline** | پروفایل کامل | Unchanged governance rules; reached from quick-edit link, palette, or deep link. |
| **headcount-capacity-panel** | Event form + ظرفیت | Unchanged. |
| **sensitive-confirmation-dialog** | Finalize / override / import execute / export | One-level dialog. |
| **import-preview-table** | ورود داده + بخش ورود گروهی | Preview before execute; concurrent batch block; leave with loaded preview → unsaved warning (batch id). Visual inherits prior DESIGN.md. |
| **stale-recalc-banner** / **break-glass-banner** / **status-badge** / **theme-toggle** | Global | Unchanged stack and semantics. Alias: `stale-recalc-banner` ↔ DESIGN `{stale-banner}`. |

## State Patterns

Prior spine states remain. Additions/changes:

| State | Surface | Treatment |
|---|---|---|
| Empty governed table | Any list tab | «نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.» + «پاک کردن فیلترها» → section defaults |
| Default personnel filter on | فهرست پرسنل | Chip/toggle «همکار فعلی» active; user can dismiss; clear-filters restores yes |
| Sidebar collapsed | Global | Tooltips name each nav item; `aria-label` on icon buttons; active state visible |
| Empty entitlements | دسترسی‌ها / افراد و دسترسی | «تخصیص دسترسی‌ای ثبت نشده.» |
| Prefilled event form | ثبت رویداد | Person locked/shown; changing person is explicit control if permitted |
| Dirty quick-edit | `personnel-quick-edit-modal` | Stay · Discard · Save; block Esc, profile link, ثبت رویداد, sidebar/tabs/palette until resolved |
| Dirty form/preview leave | افزودن، ثبت رویداد، ایجاد، ورود گروهی (+ ورود داده preview) | Leave-guard on any route change (section tabs, sidebar, command palette, history); theme/collapse exempt |
| Inbound prefill vs dirty | ثبت رویداد | Guard first; on continue, replace person/fields per explicit choice — never silent swap |
| Toxic / self-approval grant | دسترسی‌ها | Block save; Persian reason; audit the attempt; same from افراد و دسترسی or نقش‌ها |
| Grade create without parent | لدر و گرید | «افزودن گرید» disabled until ladder selected (or required parent in modal) |
| Deactivate with children | tree-navigator | Fail-closed Persian; list blockers; no deactivate until AR disposition allows |
| Filter/sort change | governed-data-table | New snapshot; page = 1; announce new count |

## Interaction Primitives

Prior keyboard map unchanged (`Ctrl+K`, `/`, `Esc`, RTL tab order).

**Table filters:** typing in text filter updates results after short debounce; enum filter applies on selection change.  
**Row actions:** always visible at ≥1280 (not hover-only) for «اطلاعات کامل/ویرایش» and «ثبت رویداد».  
**Banned in MVP:** AG Grid, infinite scroll on primary lists, dialog-on-dialog, nesting رویداد under پرسنل in nav.

## Accessibility Floor

Prior floor remains. Additions:

- Collapsed sidebar icons expose accessible names (tooltip + `aria-label`).
- `governed-data-table` filter inputs labeled by column; announce result count via polite live region on filter change.
- `tree-navigator` uses `aria-expanded` on nodes; tree keyboard pattern.
- Section tabs: `tablist` / `tab` / `tabpanel` semantics; selected tab announced on route change with surface name.

## Responsive & Platform

| Viewport | Behavior |
|---|---|
| ≥1920×1080 | Sidebar expanded by default; full table width |
| 1280×720 | Collapse allowed/encouraged for wide tables; labels hidden when collapsed; section tabs may scroll horizontally |
| <1280 | Minimum viewport message |
| 200% zoom | Primary actions reachable; table container scroll OK |

## Inspiration & Anti-patterns

- **Adopted:** Excel-like column filters; expandable org/ladder trees; person-first access admin.
- **Rejected:** Stacked unrelated panels on one scroll page; AG Grid for MVP; event registration only from profile.

## Key Flows

### UJ-1 — Mina finds a colleague, fixes a field, registers a transfer

**Protagonist:** Mina, HR Operator.

1. Logs in → **اطلاعات پرسنلی / فهرست پرسنل** (همکار فعلی on).
2. Types «قا» in نام خانوادگی filter → قاسمی row.
3. **اطلاعات کامل/ویرایش** → `personnel-quick-edit-modal` → saves non-event correction.
4. Same row **ثبت رویداد** → **رویدادهای پرسنلی / ثبت رویداد** with قاسمی pre-filled.
5. Completes **انتقال**; **headcount-capacity-panel** shows destination capacity; confirms via **sensitive-confirmation-dialog**.
6. Opens **رویدادها**; filters to that person — Scheduled/Effective event visible.

**Climax:** Event is findable in the events table without returning through the profile-only path.

**Failure:** Capacity blocked → finalize disabled with Persian guidance; no partial assignment change.

→ `mockups/key-personnel-list.html`

### UJ-2 — Reza corrects an effective personnel change without rewriting history

**Protagonist:** Reza, HR Admin. Condensed from `{planning_artifacts}/ux-designs/ux-divan-2026-07-13/EXPERIENCE.md#key-flows`.

1. Opens **پروفایل** (palette, deep link, or quick-edit «باز کردن پروفایل کامل») → **personnel-event-timeline** → past **Effective** event.
2. Reviews read-only before/after + dependents.
3. **اصلاح** → Correction form + reason (no history rewrite).
4. **sensitive-confirmation-dialog** → linked chain explained.
5. Submit → deterministic recalc.
6. Timeline shows original + correction link.

**Climax:** Original visible; deterministic corrected outcome; chain tells the story.

**Failure:** AR-TEMPORAL blocking conflict → finalize blocked with Persian consequence.

**Shell delta:** Entry via quick-edit profile link or palette; correction still on profile timeline — not via list row «ثبت رویداد».

### UJ-Access — Reza grants access without hunting stacked panels

**Protagonist:** Reza, HR Admin. `[ASSUMPTION — secondary journey; not separately coached]`

1. **دسترسی‌ها / افراد و دسترسی** → finds account in governed table.
2. Assigns role + scope; confirms.
3. Optionally defines a new role under **نقش‌ها** or scope under **محدوده‌ها**.
4. Break-glass only via **دسترسی اضطراری** with warning copy.

**Climax:** Reza answers “who can do what?” from the people tab first.

**Failure:** Toxic combo / self-approval / inactive scope → save blocked with Persian reason; attempt audited; no success tease.

→ `mockups/key-access-admin.html`

### UJ-3 — Sara investigates staffing within her approved scope

**Protagonist:** Sara, manager. Condensed from prior `#key-flows` UJ-3.

1. **داشبورد** scoped → org filter syncs cards.
2. Drill to capacity → **اطلاعات پرسنلی / فهرست پرسنل** with preset filters.
3. **گزارش‌ها** «اعضای هر تیم» same scope.
4. Export without permission → unavailable per AR-ACCESS.
5. Permitted export → **export-artifact-panel** + reauth + audit.

**Climax:** Dashboard, list, report reconcile for same date/scope/filter.

**Failure:** Inference suppression → «داده قابل نمایش نیست» on affected cells/cards.

**Shell delta:** List entry label is **اطلاعات پرسنلی** (not «پرسنل»).

### UJ-4 — Niloofar and migration actors prove cutover safety

**Protagonists:** Niloofar, approver, executor. Condensed from prior `#key-flows` UJ-4.

1. Sidebar **ورود داده** → upload template.
2. **import-preview-table** → fix errors; re-upload.
3. Trial batch + reconciliation.
4. Production frozen → approver verifies evidence.
5. Executor runs unchanged batch.
6. Reconciliation workspace → signed controls.

**Climax:** Signed reconciliation; zero critical defects.

**Failure:** Concurrent batch or validation regression → atomic rollback; «ناموفق» + correlation id.

**Shell delta:** Day-to-day bulk uses section **ورود گروهی**; cutover remains sidebar **ورود داده**.

### UJ-5 — Arman operates the service without browsing HR records

**Protagonist:** Arman, System Admin. Condensed from prior `#key-flows` UJ-5.

1. Lands **عملیات**.
2. Identity, health, backup, recalc — redacted; no personnel rows.
3. Failed recalc → correlation id only.
4. Break-glass HR access → **break-glass-banner** on HR routes; **stale-recalc-banner** still takes precedence if both active.

**Climax:** Service health confirmed without HR content exposure.

**Failure:** Directory outage → ops dashboard red; HR login Persian failure per FR-1.

**Shell delta:** Unchanged landing; nav uses collapsible sidebar.

## Open Questions

| ID | Item | Blocker? |
|---|---|---|
| OQ-R1 | Exact icon set for sidebar items | No — pick Lucide set at implement |
| OQ-R2 | Whether «افزودن سریع» fields set is AR-DATA minimal identity only | Phase |
| OQ-R3 | فرهنگ داده content model (field defs vs seed enums) | Phase — tab reserved |
| OQ-R4 | Prior OQ-1…OQ-5 from 2026-07-13 still open | Phase |
| OQ-R5 | Expand HTML mocks beyond key personnel/access/ladder | No for epic write-up; yes before full visual QA |

## Mock coverage

| Surface | Reference | Coverage |
|---|---|---|
| Shell + section IA | `wireframes/ia-2026-07-19.excalidraw` | wireframed |
| فهرست پرسنل + tabs + quick-edit chrome | `mockups/key-personnel-list.html` | mocked |
| دسترسی‌ها person-first | `mockups/key-access-admin.html` | mocked |
| لدر و گرید tree | `mockups/key-org-ladder-grade.html` | mocked |
| Prior personnel/profile/dashboard HTML | `../ux-divan-2026-07-13/mockups/*` | outdated vs tabs/collapse — spine wins |

## Consistency rule for future epics

Built and upcoming surfaces should reuse: **collapsible sidebar · section tabs · governed-data-table or tree-navigator · toolbar primary CTA · one-level dialog · full-width content**. Deviations require an explicit UX override in memlog.
