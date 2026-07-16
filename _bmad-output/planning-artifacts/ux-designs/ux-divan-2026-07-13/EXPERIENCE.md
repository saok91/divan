---
name: Divan HRIS
status: final
sources:
  - {planning_artifacts}/prds/prd-divan-2026-07-11/prd.md
  - {planning_artifacts}/prds/prd-divan-2026-07-11/addendum.md
  - {planning_artifacts}/prds/prd-divan-2026-07-11/research-hris-practices.md
updated: 2026-07-15
---

# Divan HRIS — Experience Spine

> MVP Persian RTL desktop HRIS. shadcn/ui + brand-layer `DESIGN.md`. Single unified app shell with role-filtered navigation. **Spines win on conflict** with wireframes and mocks.

## Foundation

**Form-factor:** Desktop web only for MVP — 1280×720 through 2K, reference 1920×1080. Persian-only UI, RTL throughout. No mobile/tablet dedicated experience; no bilingual UI.

**UI system:** shadcn/ui on Next.js + Tailwind CSS. Brand discipline: inherit shadcn defaults except `DESIGN.md` token overrides (org palette, Yekan Bakh, navy chrome, gold primary CTA, light/dark).

**Deployment context:** Single-organization, on-premise, ~500 people. LDAP/AD authentication. Default-deny authorization on every read and mutation independent of UI visibility.

**Theme modes:** Light and dark content themes required at launch; user toggle in avatar menu; preference persisted per account. Chrome (header/sidebar) stays navy in both modes per `{colors.chrome}`. Theme switch does not navigate or trigger unsaved-form guards — in-place token swap only; focus preserved on active control.

→ Composition: `mockups/key-personnel.html`, `mockups/key-profile.html`, `mockups/key-dashboard.html`, `wireframes/ia-2026-07-15.excalidraw`.

## Information Architecture

| Surface | Reached from | Purpose | Typical roles |
|---|---|---|---|
| **داشبورد** | Sidebar / role landing (Admin, Manager) | Launch dashboard — workforce totals, trend, team capacity, starts/terminations, open headcount (FR-35) | All scoped |
| **پرسنل** | Sidebar / `Ctrl+K` / `/` / Operator landing | Permission-safe search, filters, lists (FR-33) | Operator, Admin, Manager |
| **پروفایل فرد** | Personnel row / global search result | Profile sections + timeline (FR-34) | Scoped |
| **فرم رویداد** | Profile action menu | Draft → finalize personnel events (FR-14–FR-24) | Operator, Admin |
| **ساختار سازمان** | Sidebar | Org hierarchy + reference data (FR-9–FR-13) | Admin |
| **ظرفیت و جذب** | Sidebar / event form preview | Headcount approvals, reservations, overrides (FR-28–FR-32) | Admin, Operator, Manager (view) |
| **گزارش‌ها** | Sidebar | Launch report catalogue (FR-36) | Scoped |
| **خروجی / بازیابی** | Report/list export action | Governed export + artifact retrieval (FR-41, FR-52) | Scoped + export permission |
| **ورود داده** | Sidebar | Import wizard + reconciliation (FR-37–FR-40) | Admin, migration actors |
| **دسترسی‌ها** | Sidebar | Entitlements, scopes, sensitive categories (FR-2–FR-4, FR-46) | Admin |
| **ممیزی** | Sidebar / Audit landing | Audit investigation (FR-42) | Audit reviewer |
| **عملیات** | Sidebar / SysAdmin landing | Service health without HR content (FR-45) | System Admin |
| **پرونده‌های اصلاح** | Sidebar | External data-subject correction cases (FR-53) | Admin |

**Global overlays:** Command palette (personnel search + navigate), sensitive-action confirmation dialogs, unsaved-change warning, banner stack (stale/recalc, break-glass).

**Modal depth:** One dialog stack level — no dialog-on-dialog. Import preview uses full-width `Sheet` instead of nested dialog.

**Role landing pages:**

| Role | First surface after login |
|---|---|
| HR Operator | **پرسنل** |
| HR Admin | **داشبورد** |
| Manager | **داشبورد** (scoped) |
| Audit reviewer | **ممیزی** |
| System Admin | **عملیات** |

Nav items outside role permission are **hidden**, not shown disabled (fail-closed visibility).

## Voice and Tone

Direct-operational Persian. State the fact, the date, and the next step — no ceremonial success copy, no emoji, no marketing enthusiasm. Brand aesthetic lives in `DESIGN.md`; microcopy lives here.

| Do | Don't |
|---|---|
| «انتقال ثبت شد. از ۱۴۰۴/۰۴/۰۱ اعمال می‌شود.» | «عملیات با موفقیت انجام گردید! ✅» |
| «ظرفیت تیم مقصد: ۲ آزاد، ۱ رزرو» | «Good news — capacity available» |
| «این رویداد تاریخچه را پاک نمی‌کند؛ اصلاح مرتبط ثبت می‌شود.» | «Are you sure?» (without consequence) |
| «داده قابل نمایش نیست» (suppressed metric) | Show 0 when cohort suppressed |
| «داده به‌روز نیست — تا ۰۹:۱۴ محاسبه نشده.» | Silent stale numbers |

## Component Patterns

Behavioral. Visual specs in `DESIGN.md.Components` or shadcn defaults. Component names match DESIGN.md kebab-case.

| Component | Use | Behavioral rules |
|---|---|---|
| **app-shell** | Global | Fixed `{colors.chrome}` header + RTL sidebar. Header: logo, global search trigger, banner stack slot, user menu (theme toggle, logout). **Banner stack order (top→bottom):** `{stale-banner}` (blocking takes precedence) → `{break-glass-banner}`. Skip link «پرش به محتوا» as first focusable element. Sidebar: role-filtered nav; active item uses `sidebar-active-item`. |
| **command-palette** | `Ctrl+K`, `/` | Opens from `Ctrl+K` or `/` when focus is **not** in a text input; in inputs `/` is literal. Permission-safe personnel search by name, Personnel Code, national ID, email, phone, team. **Input normalization:** accept Latin or Persian digits; normalize for matching; display Persian. Uniform response timing for out-of-scope vs not-found per AR-ACCESS `[pending exact copy]`. `aria-busy` while searching; polite `aria-live` announces result count («۳ نتیجه» / «نتیجه‌ای نیست»). `Enter` opens profile; `Esc` closes. |
| **personnel-data-table** | پرسنل, reports | Compact density. Sort (`aria-sort` on headers), paginate stable snapshot, selectable columns, result count. Row focus + `Enter` opens profile. Filtered export when permitted. **RTL keyboard:** identifier column (sticky right) announced first; scroll container `tabindex=0` when horizontally scrollable; focus ring visible. |
| **person-profile-section** | پروفایل | Sections: identity · current Employment · current Assignments · approved sensitive categories · prior Employments · timeline. **Fields outside permission are not rendered** — excluded from DOM, not visually hidden. Masking pattern only if AR-ACCESS explicitly requires `[pending OQ-3]`. |
| **personnel-event-timeline** | پروفایل | Sort: Effective Date desc → registration time desc → type tie-breaker; same-day events show secondary `{caption}` sort hint. Decorative status dot `aria-hidden="true"`; **badge text** is sole status announcement. Rows: type, Effective Date (Jalali), registration/finalization actor+time, status badge, provenance, correction/neutralization links. |
| **personnel-event-form** | فرم رویداد | Sectioned long form per `personnel-event-form` layout; required markers; inline validation; `jalali-date-picker`; unsaved-change warning on navigate away. Footer: Cancel · Save draft (`button-secondary`) · Finalize (`button-primary`). Draft save ≠ finalize. |
| **jalali-date-picker** | Forms | Jalali calendar in `Popover`; typed entry with validation. Keyboard: arrow keys move day grid; `Enter` selects; `Esc` closes popover. Field `aria-label` names purpose («تاریخ مؤثر»); invalid date errors linked via `aria-describedby`. Display selected date as Persian-digit Jalali string. Registration timestamps separate control — date+time, not mixed with Effective Date. |
| **headcount-capacity-panel** | Event form, ظرفیت | used / reserved / free / exempt / overridden for Team+title(+seniority). Blocking conflicts in Persian before finalize. |
| **sensitive-confirmation-dialog** | Finalize, Cancel, Reverse, Correction, Override, import execute, export | `Dialog` per DESIGN spec: consequence summary, reason when FR requires, `{button-primary}` confirm vs ghost cancel. Blocked when validation fails or recalc/stale gates active. |
| **dashboard-metric-card** | داشبورد | Shared org/time filters update all cards synchronously. Each metric links to detail. Last calculation time when derived. Suppressed cohort shows «داده قابل نمایش نیست» — never 0. |
| **import-preview-table** | ورود داده | Row/column errors in Persian; cancel before execute; approver/executor segregation UI. Navigate away with loaded preview → unsaved warning citing batch id. **Concurrent batch:** block execute with «دسته دیگری در حال اجراست» + owner + correlation id. |
| **export-artifact-panel** | خروجی / بازیابی | Shows classification, expiry, field scope. Reauth at generation and each retrieval. Sensitive/bulk: custody acknowledgement checkbox required before download. Download notice records recipient per FR-52. |
| **stale-recalc-banner** | Global | Derived state failed/stale (FR-45): `{stale-banner}`; `role="alert"` + `aria-live="assertive"` when blocking. Stale metric values removed from accessibility tree or marked `aria-disabled`; gold CTAs disabled on affected finalize/export/report. Non-dismissible when blocking. |
| **break-glass-banner** | Global (conditional) | Time-bound privileged access (UJ-5): `{break-glass-banner}` below stale banner; dismissible on expiry; never obscures blocking stale message. |
| **status-badge** | Timeline, lists | Scheduled / Effective / Cancelled / Reversed / Draft / Override — Persian labels; `{status-badge-*}` tokens including dark canvas pairs. |
| **theme-toggle** | User menu | Light ↔ dark instant swap; preserves focus; focus ring visible on `{colors.chrome}` nav (2px offset ring). |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold load | Any | shadcn `Skeleton` matching layout density; resolves on data |
| Empty search | پرسنل | «نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.» + clear filters |
| Empty timeline | پروفایل | «رویداد پرسنلی ثبت نشده.» (post-migration baseline-only edge) |
| Empty dashboard scope | داشبورد | «در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.» |
| Suppressed metric | داشبورد, گزارش‌ها | «داده قابل نمایش نیست» — same copy on cards and table cells; not 0 |
| Permission denied (nav) | Global | Item hidden from sidebar |
| Permission denied (deep link) | Any | «دسترسی ندارید.» + link to role landing; audited |
| Scope revoked mid-session | Global / forms | Modal «دسترسی شما تغییر کرد.» — if Draft permitted: offer save draft or discard; block finalize; redirect to safe landing after ack |
| Unsaved form | فرم رویداد | Browser + in-app: «تغییرات ذخیره نشده‌اند.» |
| Unsaved import preview | ورود داده | «پیش‌نمایش دسته {id} ذخیره نشده.» on sidebar nav away |
| Validation error | Forms, import | Inline + summary Persian; blocking prevents finalize |
| Scheduled vs current | پروفایل, dashboard | Current unchanged; Scheduled shown with effective date |
| Stale derived state | stale-recalc-banner | Disable finalize/export/report on affected entities |
| Recalc in progress | Timeline, counts, forms | Skeleton on affected metrics; **disable gold CTAs** on affected finalize/export until complete |
| LDAP unavailable | Login | «اتصال به سامانه هویت برقرار نیست.» |
| Import row error | ورود داده | Highlight row/column; remain in preview |
| Export reauth required | export-artifact-panel | Reauth + classification/expiry at download |
| Empty audit results | ممیزی | «رویدادی با این فیلتر نیست.» |
| Empty entitlements | دسترسی‌ها | «تخصیص دسترسی‌ای ثبت نشده.» |
| Breached correction deadline | پرونده‌های اصلاح | Distinct «مهلت گذشته» state — not identical to active case (FR-53) |

## Interaction Primitives

**Pointer + keyboard.** Desktop HR power users; keyboard shortcuts augment visible controls.

- `Ctrl+K` — Command palette (from non-input context)
- `/` — Command palette when focus not in text input; literal slash in inputs
- `Esc` — Close dialog, palette, cancel inline edit
- `Tab` / `Shift+Tab` — Logical RTL tab order; skip link first on load
- `Enter` — Palette selection; submit when focus on primary action

**Mouse:** primary for tables/timeline; hover row actions on compact tables at ≥1280px.

**Jalali dates:** via `jalali-date-picker`; business dates Jalali; registration/finalization timestamps show date+time distinct from Effective Date (FR-44).

**Number formatting:**

- **All user-facing numbers:** Persian digits (۰–۹) via app formatting — not FaNum font features.
- **Financial amounts:** Persian digits + thousand separator (٬) — e.g. «۱۲٬۳۴۵٬۶۷۸ ریال»; negatives: «−۱۲٬۳۴۵٬۶۷۸» or parentheses per finance owner `[pending AR-DATA]`.
- **Search input:** accept Latin or Persian digits; normalize internally; always display Persian.
- **Export interchange:** OQ-4 — verify Personnel Code / national ID Latin export vs Persian display.

**Banned in MVP UI:** mobile-primary layout, employee self-service, bilingual toggle, infinite scroll on personnel lists, silent concurrent import overwrite.

## Accessibility Floor

Behavioral. Visual contrast in `DESIGN.md` including **button-primary theme contract**. Formal thresholds pending AR-NFR — floor below is committed design intent.

- WCAG 2.2 AA target for light and dark content themes at reference viewport; **200% browser zoom:** primary actions reachable without page-level horizontal scroll (table container scroll allowed).
- Keyboard: dialogs, palette, nav, `personnel-data-table` model, forms, `jalali-date-picker` grid.
- Focus ring: shadcn `ring`; visible on chrome (2px offset) and content.
- Landmarks: route change announces surface («پرسنل، جستجو»); main landmark receives skip-link target.
- Timeline: dot decorative; badge text labels status.
- Stale blocking banner: `role="alert"`, `aria-live="assertive"`; stale values not announced as current.
- Permission: non-permitted fields **not in DOM**.
- Motion: respect `prefers-reduced-motion` — disable toast slide and skeleton shimmer.

## Responsive & Platform

MVP is **desktop web**, not responsive-mobile.

| Viewport | Behavior |
|---|---|
| ≥1920×1080 (reference) | Full sidebar; dashboard 4-column; centered form max-width |
| 1280×720 (minimum) | Sidebar labels remain; dashboard 2-column; table horizontal scroll + sticky column |
| <1280 | Minimum viewport message — do not render broken layout |
| 200% zoom | See Accessibility Floor |

Platform: modern Chromium and Firefox ESR per AR-NFR `[pending]`. On-premise; no offline mode.

## Inspiration & Anti-patterns

- **Lifted from enterprise HRIS convention:** master-detail search → profile → timeline; capacity adjacent to transfer; import preview before execute.
- **Lifted from shadcn:** component vocabulary — brand is what we add.
- **Rejected — consumer HR patterns:** gamification, social feeds, employee wellness UI.
- **Rejected — spreadsheet cell-edit:** event-governed mutations only.
- **Rejected — tease forbidden rows:** omit out-of-scope data entirely.

## Key Flows

### UJ-1 — Mina records a future transfer without corrupting today's team totals

**Protagonist:** Mina, HR Operator.

1. Mina logs in → lands on **پرسنل**.
2. `Ctrl+K` → searches Personnel Code → opens **پروفایل**.
3. Reviews current Primary Assignment; opens **انتقال**.
4. **headcount-capacity-panel** shows destination free/reserved; blocking conflict explained in Persian.
5. Enters future Effective Date via **jalali-date-picker**; optional Save draft.
6. **sensitive-confirmation-dialog** → **نهایی‌سازی** (`button-primary`).
7. **personnel-event-timeline** shows **Scheduled** event; today's team totals unchanged.

**Climax:** Scheduled transfer with reserved capacity; current Effective state unchanged on profile and source team counts.

**Failure:** No free capacity and no Override path → finalize blocked with escalation guidance — no partial state.

→ `wireframes/flow-mina-transfer-2026-07-13.excalidraw`, `mockups/key-profile.html`.

### UJ-2 — Reza corrects an effective personnel change without rewriting history

**Protagonist:** Reza, HR Admin.

1. **پروفایل** → **personnel-event-timeline** → past **Effective** event.
2. Read-only before/after + dependents review.
3. **اصلاح** → Correction form + reason.
4. **sensitive-confirmation-dialog** → linked chain explained.
5. Submit → deterministic recalc.
6. Timeline shows original + correction link.

**Climax:** Original visible; deterministic corrected outcome; chain tells the story.

**Failure:** AR-TEMPORAL blocking conflict → finalize blocked with Persian consequence.

### UJ-3 — Sara investigates staffing within her approved scope

**Protagonist:** Sara, manager.

1. **داشبورد** scoped → org filter syncs cards.
2. Drill to capacity → **پرسنل** with preset filters.
3. **گزارش** «اعضای هر تیم» same scope.
4. Export without permission → unavailable per AR-ACCESS.
5. Permitted export → **export-artifact-panel** + reauth + audit.

**Climax:** Dashboard, list, report reconcile for same date/scope/filter.

**Failure:** Inference suppression → «داده قابل نمایش نیست» on affected cells/cards.

### UJ-4 — Niloofar and migration actors prove cutover safety

**Protagonists:** Niloofar, approver, executor.

1. **ورود داده** → upload template.
2. **import-preview-table** → fix errors; re-upload.
3. Trial batch + reconciliation.
4. Production frozen → approver verifies evidence.
5. Executor runs unchanged batch.
6. Reconciliation workspace → signed controls.

**Climax:** Signed reconciliation; zero critical defects.

**Failure:** Concurrent batch or validation regression → atomic rollback; «ناموفق» + correlation id.

### UJ-5 — Arman operates the service without browsing HR records

**Protagonist:** Arman, System Admin.

1. Lands **عملیات**.
2. Identity, health, backup, recalc — redacted; no personnel rows.
3. Failed recalc → correlation id only.
4. Break-glass HR access → **break-glass-banner** on HR routes; **stale-recalc-banner** still takes precedence if both active.

**Climax:** Service health confirmed without HR content exposure.

**Failure:** Directory outage → ops dashboard red; HR login Persian failure per FR-1.

## Open Questions

| ID | Item | Blocker? |
|---|---|---|
| OQ-1 | AR-NFR accessibility acceptance thresholds | Phase — floor committed, verify at gate |
| OQ-2 | AR-ACCESS enumeration-safe search copy/timing | Phase |
| OQ-3 | Masking vs omit for sensitive fields | Phase — default omit/not-in-DOM |
| OQ-4 | Export digit interchange for codes | Phase |
| OQ-5 | Negative financial display format | Phase — finance owner |

## Mock coverage

| Surface | Reference | Coverage |
|---|---|---|
| پرسنل | `mockups/key-personnel.html` | mocked |
| پروفایل + timeline | `mockups/key-profile.html` | mocked |
| داشبورد | `mockups/key-dashboard.html` | mocked |
| IA overview | `wireframes/ia-2026-07-15.excalidraw` | wireframed |
| UJ-1 flow | `wireframes/flow-mina-transfer-2026-07-13.excalidraw` | wireframed |
| فرم رویداد, import, audit, ops | spine-only | tables above |

Spine-only surfaces: sufficient for architecture/epics unless visual reference requested.

## Validation rollup

Reviewer gate 2026-07-15: critical/high findings from `validation-report.md` rolled into this update (dark tokens, Jalali picker, banner stack, table keyboard, scope revocation, recalc blocking, export panel, suppression states). Residual items tracked in Open Questions.
