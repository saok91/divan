---
name: Divan HRIS
description: Persian RTL desktop HRIS. Usability revision — identifier-first interaction, completed operational surfaces, coherent IA, and governed configuration administration.
status: final
updated: 2026-07-31
inherits: "{planning_artifacts}/ux-designs/ux-divan-2026-07-19/EXPERIENCE.md"
---

# Divan HRIS — Experience Spine (Usability Revision)

> Visual counterpart: `DESIGN.md`. Rendered reference: `mockups/direction-a-dense-console.html` and `mockups/chart-palettes.html`.

> Revision of `ux-divan-2026-07-19`, authorized by `sprint-change-proposal-2026-07-31.md` and PRD FR-57–FR-60. The governed-record model, permission model, and Persian/RTL foundation are unchanged. What changes: **the operator addresses records by business code, every navigable surface does its job, every rendered action is real, and every configurable parameter has one governed home.** Spines win on conflict with any mock.

## Foundation

**Who.** HR operators, HR admins, capacity owners, auditors, and system admins — professionals who work in Divan for hours, know their own domain vocabulary, and do not know database internals.

**Where.** Desktop browser, 1280×720 minimum. Persian, RTL, Jalali dates, Persian digits.

**The failure this revision corrects.** The MVP was specified for governance correctness and left interaction to each implementer. The result: forms that demand identifiers no human knows, surfaces that differ section to section, actions that do not look or behave like actions, and navigable tabs that lead nowhere. Correct data, unusable product.

**The standard.** A competent HR operator, with no training beyond the domain they already know, can complete any supported task without asking what a field means, without leaving the app to look up an identifier, and without discovering by clicking that a surface is empty.

## Identifier Model

The operator never types, reads, or copies an internal identifier to do their job.

- **Every selectable entity is addressed by its business code**: person → `personnelCode`; organizational unit and team → `code`; job title, ladder, grade, contract type → `code`. These already exist and are unique in the data model; the gap is at the interface, not the schema.
- **Every entity field is an `entity-picker`**, never a free-text identifier input. Typing matches code, name, and — for people — family name; results render as `«{code} — {name}»` with a disambiguating second line (current team for a person, parent unit for a team).
- **Search inside a picker obeys the same permission and enumeration rules as list search.** A picker never reveals a subject the caller could not list (PRD FR-33).
- **Ambiguity is resolved before commit, never guessed.** Two people with the same name are separated by code and team in the option row; an import row that matches more than one subject is a row error, not a silent pick.
- **Technical identifiers stay available but demoted**, behind a labelled «شناسهٔ فنی» disclosure with a copy control, on detail surfaces and in error contexts where support needs them.
- **Displayed identity is always code + human name**, in that order. A UUID never stands as a record's identity in a table, a heading, a breadcrumb, or a confirmation.

## Information Architecture

**Sidebar (RTL, in order):** داشبورد · اطلاعات پرسنلی · رویدادهای پرسنلی · ساختار سازمان · ظرفیت و جذب · گزارش‌ها · ورود داده · دسترسی‌ها · ممیزی · عملیات · اصلاح اطلاعات · تنظیمات

Two changes: «پرونده‌های اصلاح» becomes **«اصلاح اطلاعات»**, and **«تنظیمات»** is added at the end, visible only to roles that hold at least one settings tab.

**Section tabs.**

| Section | Tabs |
|---|---|
| اطلاعات پرسنلی | فهرست پرسنل · افزودن · ورود گروهی · فرهنگ داده |
| رویدادهای پرسنلی | فهرست رویدادها · ثبت رویداد · ورود گروهی |
| ظرفیت و جذب | هدکانت · ایجاد · ورود گروهی |
| گزارش‌ها | نیروی انسانی · سازمان · رویدادها · ظرفیت و جذب · ورود داده |
| تنظیمات | عمومی و نمایش · داده و نگه‌داشت · ورود و خروجی · ظرفیت و جذب · دسترسی و نشست · ممیزی و یکپارچگی · زیرساخت |

**Rules that hold everywhere.**

- **No dead ends.** A tab that renders is a tab that works. A surface with nothing to show explains why and offers the action that changes that; it is never blank.
- **One purpose line per surface.** Every section states, in one sentence under its title, what it is for and who it is for — this is how «اصلاح اطلاعات» stops being a mystery.
- **Record-scoped detail opens in a `record-drawer`**, not as another stacked panel. Capacity exemptions and overrides open from the approval row they belong to, which is what collapses هدکانت back to one readable page.
- **Cross-surface drill-through is bidirectional**: a person reachable from an event, an event from a person, a capacity decision from the approval it constrains.
- **Reports are catalogued by subject**, and a report the caller may not run is either absent or shown with its access requirement — never a surface that fails after the click.

## Configuration Administration

One governed home for parameters that today live in hardcoded constants, environment variables, and scattered admin corners.

- **Access is split by domain.** `hr_admin` sees the business tabs (داده و نگه‌داشت، ورود و خروجی، ظرفیت و جذب); `system_admin` sees the technical tabs (دسترسی و نشست، ممیزی و یکپارچگی، زیرساخت); عمومی و نمایش is visible to both. A role sees only its own tabs — an empty settings section is never rendered.
- **Every parameter states four things**: what it controls in operational terms, its current value, where that value comes from (default, environment, stored override), and who last changed it and when.
- **Editable and read-only are visually distinct and honest.** A parameter that cannot be changed in the UI is shown read-only with its actual change path stated, not hidden and not faked with a disabled input that implies a missing permission.
- **A change is a governed act**: it takes effect only after explicit confirmation, is written to the audit trail with actor, before value, after value, and Jalali timestamp, and can be reset to its default from the same row.
- **A change that affects computation states its blast radius before commit** — which surfaces recompute, and whether existing records are re-evaluated.

## Voice and Tone

Inherited direct-operational voice, sharpened by two rules the MVP violated:

- **State the fact, then the consequence, then the next step.** The rewritten stale message is the model: «محاسبهٔ وضعیت جاری برای ۳ فرد هنوز کامل نشده — نهایی‌سازی رویداد و خروجی گرفتن برای این افراد موقتاً غیرفعال است. معمولاً چند دقیقه طول می‌کشد.» A bare timestamp is not a message.
- **Never make the operator infer.** No unexplained clock times, no naked entity names as page titles, no disabled control without its reason, no error that reports a rule number instead of what to do.

## State Patterns

| State | Pattern |
|---|---|
| **Loading** | Content-shaped `skeleton`. Tables keep row height and column rhythm; the header renders immediately. No spinner for content that has a known shape; no layout shift on arrival. |
| **Empty — no data yet** | What this surface holds, why it is empty, and the primary action that fills it. |
| **Empty — filtered to nothing** | «نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.» plus «پاک کردن فیلترها»; the filter state stays visible. |
| **Empty — not permitted** | The surface states the access it requires and who grants it, rather than showing an empty table. |
| **Disabled action** | Always paired with its Persian reason, on hover and on focus, and reachable by keyboard. A control is never disabled silently. |
| **Stale / recomputing** | Banner states scope (how many subjects), consequence (what is blocked), and expectation (how long), with a «توضیح بیشتر» disclosure. Affected rows are marked in place; affected figures render muted with «در حال محاسبه — عدد ممکن است تغییر کند.» |
| **Error** | Inline at the field or row that caused it, in domain language, with the correcting action. Correlation id lives behind «شناسهٔ فنی». |
| **Blocked by governance** | The rule in plain Persian, the record it protects, and the legitimate path (request, override, escalate). |
| **Dirty / unsaved** | Explicit indicator plus a leave guard on forms with unsaved input; the guard never fires on a row action inside a list. |
| **Optimistic nothing** | No optimistic success. A commit reports after the server confirms. |

## Feedback and Motion

- **Inline, at the origin, for direct results** — a saved form, a committed row, a rejected field.
- **Toast for background work only** — import batches, exports, recomputation jobs — carrying a link back to the work it describes.
- **Banner for system-wide state only** — staleness, break-glass, degraded integrity.
- Motion is functional and short: 150–200ms for state and hover, 200–250ms for drawer and popover entry. Everything obeys `prefers-reduced-motion`, including the skeleton pulse.
- **One feedback channel per event.** A single action never fires a toast and an inline message and a banner.

## Component Patterns

| Pattern | Behavior |
|---|---|
| **entity-picker** | Debounced search from the first character; keyboard-first (arrows, Enter, Escape); shows scope in the popover header; empty result offers the create path when the operator holds it; selection becomes an `entity-token` with a clear control; cascading pickers disable and clear their dependents when the parent changes, stating why. |
| **row actions** | Icon-only outlined buttons, visible at rest, `aria-label` mandatory, tooltip on hover and focus, ≥24px target within a ≥32px row band. The per-action icon mapping is fixed once — the same action never uses two icons across surfaces. Overflow beyond two actions goes to a labelled menu, never to a third bare icon. |
| **bulk entry wizard** | Same five inline steps in every section: قالب → آپلود → پیش‌نمایش و خطاها → تأیید → نتیجه. Step one always offers a sample workbook generated from the same template definition that validates the upload, so a downloaded sample always passes. Preview reports errors by row and column with the business code shown, never a UUID. Commit is atomic and reports counts of created, updated, and rejected rows. |
| **record-drawer** | Opens from the row it belongs to, states the record identity in its header, keeps its own footer actions, closes on Escape, and returns focus to the originating row. |
| **settings-row** | Value control, source, default, last change, confirm-to-apply, reset-to-default. |
| **report surface** | Subject tab → report picker → parameters → run → result with export. Parameters persist per operator within the session. |

## Interaction Primitives

- **Keyboard-first, and keyboard-complete**: every action reachable without a mouse; visible focus rings everywhere; the command palette stays the fast path across sections.
- **Focus is returned deliberately** after any dialog, drawer, or popover closes.
- **Row click opens the record; row actions do not.** Action buttons stop propagation, so no action ever triggers navigation as a side effect.
- **Sticky identifier column and sticky actions column** so the operator never loses either end of a wide row.
- **Column visibility and density are per-operator preferences** that survive navigation within the session.

## Accessibility Floor

WCAG 2.2 AA, inherited, with the additions this revision's density and icon-only actions require:

- Icon-only controls carry an accessible name; the tooltip is a supplement, never the only label.
- Disabled controls expose their reason to assistive technology, not only visually.
- Contrast holds at 13px body and 10.5px column headers in both themes.
- Truncation never hides information that exists nowhere else — a truncated cell always has a full-value tooltip and a full value on the record surface.
- Nothing is communicated by color alone: status carries a label, chart series carry direct labels or a legend with distinct shapes.

## Key Flows

> Drafted from the app's real flows and code evidence; PO correction expected at review.

### ۱ — سارا ثبت می‌کند: انتقال یک همکار به تیم فروش

سارا کارشناس منابع انسانی است و رویداد انتقال «محمدی» را باید ثبت کند. تنها چیزی که در دست دارد کد پرسنلی ۱۰۰۱۲ و نام تیم مقصد است. در «رویدادهای پرسنلی / ثبت رویداد» نوع رویداد را انتخاب می‌کند، در فیلد «فرد» عدد ۱۰۰۱۲ را می‌زند و گزینهٔ «۱۰۰۱۲ — محمدی، سارا · تیم جذب و استخدام» را می‌بیند و انتخاب می‌کند؛ همان‌جا مطمئن می‌شود شخص درست را گرفته، چون تیم فعلی کنار نام آمده. برای «تیم مقصد» عبارت «فروش» را می‌نویسد و توکن «TEAM-SALES — تیم فروش» می‌نشیند. «نردبان» را که انتخاب می‌کند، «گرید» تازه فعال می‌شود. تاریخ اثر را با تقویم جلالی می‌گذارد و بلوک ظرفیت تیم مقصد را می‌بیند: مصرف‌شده ۷، رزرو ۲، آزاد ۳.

**نقطهٔ اوج:** روی «نهایی‌سازی» فشار می‌دهد. اگر ظرفیت آزاد نبود، سیستم قانون را به زبان کاری می‌گوید و مسیر مجاز (رزرو، معافیت، ارجاع) را نشان می‌دهد — نه یک خطای عمومی. اگر مجاز بود، تأیید بعد از پاسخ سرور و در محل خود فرم می‌آید، و رویداد با کد و نام در فهرست دیده می‌شود. سارا در کل این مسیر یک بار هم UUID ندیده است.

### ۲ — مهدی وارد می‌کند: ۴۰ رویداد ارتقا با اکسل

مهدی مدیر منابع انسانی است و باید نتیجهٔ دور ارزیابی را وارد کند. به تب «ورود گروهی» در رویدادهای پرسنلی می‌رود — تبی که پیش‌تر خالی بود. اول «دانلود قالب نمونه» را می‌زند و فایلی می‌گیرد که ستون‌ها، هدرها و قالب مقادیرش دقیقاً همان چیزی است که اعتبارسنجی انتظار دارد؛ ستون افراد با کد پرسنلی پر می‌شود، نه با شناسهٔ داخلی. فایل پرشده را آپلود می‌کند و پیش‌نمایش، سه ردیف خطادار را با شمارهٔ ردیف، نام ستون و کد پرسنلی نشان می‌دهد: یکی تاریخ اثر گذشته دارد، یکی گرید ناسازگار با نردبان، یکی کد پرسنلی بی‌تطابق.

**نقطهٔ اوج:** مهدی سه ردیف را در فایل اصلاح می‌کند و دوباره آپلود می‌کند. تأیید نهایی، یکجا و اتمیک اجرا می‌شود و نتیجه را با شمارش ساخته‌شده/به‌روزشده/ردشده گزارش می‌دهد؛ چون کار پس‌زمینه‌ای است، یک toast با پیوند به همان دستهٔ ورود می‌آید. هیچ‌جا نصفه‌کاره ثبت نمی‌شود.

### ۳ — رضا تنظیم می‌کند: سقف حجم فایل ورود داده

رضا مدیر سیستم است و شکایت رسیده که فایل‌های بزرگ رد می‌شوند. به «تنظیمات / ورود و خروجی» می‌رود و ردیف «حداکثر حجم فایل ورودی» را می‌بیند: مقدار فعلی، منبعِ مقدار (متغیر محیطی یا مقدار ذخیره‌شده)، مقدار پیش‌فرض، و اینکه آخرین بار چه کسی و کِی عوضش کرده.

**نقطهٔ اوج:** مقدار را بالا می‌برد. پیش از اعمال، سیستم دامنهٔ اثر را می‌گوید — کدام سطوح تحت تأثیرند و آیا رکوردهای موجود دوباره ارزیابی می‌شوند. رضا تأیید می‌کند؛ تغییر با بازیگر، مقدار قبل، مقدار بعد و زمان جلالی در ممیزی ثبت می‌شود و دکمهٔ «بازگشت به پیش‌فرض» در همان ردیف می‌ماند. اگر پارامتری فقط با استقرار عوض می‌شود، رضا آن را قفل‌شده و با مسیر واقعی تغییرش می‌بیند، نه به شکل یک ورودی غیرفعال مبهم.

### ۴ — نگار پیدا می‌کند: «اصلاح اطلاعات» یعنی چه

نگار مدیر منابع انسانی است و درخواستی از یک همکار سابق دارد که اطلاعاتش غلط ثبت شده. بخش «اصلاح اطلاعات» را در نویگیشن می‌بیند و خط توضیح زیر عنوان، در یک جمله، می‌گوید این‌جا جای رسیدگی به درخواست اصلاح داده از سوی فرد صاحب داده است و چه کسی می‌تواند آن را ببندد.

**نقطهٔ اوج:** نگار همان کار را از مسیر طبیعی‌اش هم می‌تواند شروع کند — از پروفایل خود فرد، اقدام «ثبت درخواست اصلاح» در دسترس است و پرونده با کد و نام فرد ساخته می‌شود. بخش دیگر یک نام مبهم در نویگیشن نیست.

### ۵ — لیلا گزارش می‌گیرد: ترکیب نیروی انسانی

لیلا شریک کسب‌وکار منابع انسانی است و گزارش ترکیب نیرو برای جلسهٔ هفته را می‌خواهد. وارد «گزارش‌ها» می‌شود و به‌جای یک صفحهٔ درهم، تب موضوعی «نیروی انسانی» را می‌بیند، گزارش را انتخاب می‌کند، تاریخ مؤثر و دامنهٔ سازمانی را می‌گذارد و اجرا می‌کند.

**نقطهٔ اوج:** خروجی با همان اعداد و همان قالب جلالی که در بقیهٔ اپ دیده، رندر می‌شود؛ کوهورت‌های خیلی کوچک به‌جای صفر، «داده قابل نمایش نیست» می‌گیرند تا لیلا عدد غلط را به جلسه نبرد. اگر محاسبهٔ جاری هنوز تمام نشده، همان‌جا می‌گوید که عدد ممکن است تغییر کند.
