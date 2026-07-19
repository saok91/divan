# Source extract — Divan shell redesign (2026-07-19)

Sources: EXPERIENCE 2026-07-13, epics FR/UX-DR, stories 2.3 & 3.5, `apps/web` org UI. New DESIGN delta: collapsible sidebar + dense table chrome.

## Prior IA surfaces (list)

| Surface | Nav / reach | Notes |
|---|---|---|
| داشبورد | Sidebar | Admin/Manager landing; FR-35 metrics |
| پرسنل | Sidebar | Operator landing; list/search FR-33 |
| پروفایل فرد | Row / `Ctrl+K` | Sections + timeline FR-34 |
| فرم رویداد | Profile action menu only | Not top-level nav; FR-14–24 |
| ساختار سازمان | Sidebar | Admin; FR-9–13 (hierarchy + refs) |
| ظرفیت و جذب | Sidebar / event preview | Headcount FR-28–32 |
| گزارش‌ها | Sidebar | FR-36 |
| خروجی / بازیابی | Export action | FR-41, FR-52 |
| ورود داده | Sidebar | FR-37–40 |
| دسترسی‌ها | Sidebar | FR-2–4, FR-46; Admin |
| ممیزی | Sidebar | Audit landing |
| عملیات | Sidebar | SysAdmin landing; no HR content |
| پرونده‌های اصلاح | Sidebar | FR-53 |

Overlays: command palette, confirm dialogs, unsaved warning, banner stack. Nav unauthorized = **hidden** (not disabled). Sidebar width locked 240px (UX-DR1/3).

## Access admin capabilities (bullets)

- Surface **دسترسی‌ها** (`/access`); needs envelope `access.administration` (coarse `hr_admin` = nav only).
- CRUD / manage: **AccessRole** (explicit PermissionSet), **PermissionSet** (permission codes), **OrganizationalScope** (FA label, active), account role+scope bindings, directory link view/clear/relink, account active/inactive.
- UI sections: entitlement/role list · permission sets · scopes · account link + status.
- Empty copy: «تخصیص دسترسی‌ای ثبت نشده.» Denial: «دسترسی ندارید.»
- Attributable before/after access evidence; toxic fail-closed (self-approval, admin+approve-same-grant).
- Out of scope UI: break-glass grant, entitlement lifecycle 2.4, sensitive-category enablement, audit investigation.
- Naming: **OrganizationalScope** ≠ Organizational Unit (LE→Team).

## Org hierarchy capabilities (bullets)

- **ساختار سازمان** Admin: effective-dated LE → BU → Dept → Team; create / activate / deactivate; history retained (no hard-delete).
- Persian labels: نهاد حقوقی · واحد کسب‌وکار · دپارتمان · تیم; code + nameFa; Jalali validity; inactive visible (filter).
- Current UI shape: nested tree list + create form + activate/deactivate confirm — **not** interactive org chart / drag-drop; **no** member lists (Assignment = Epic 4).
- Same page stacks **JobReferencePanel** (FR-10): tabs نقش سازمانی · عنوان شغلی · لدر · گرید · ارشدیت.
- Deactivate-with-deps / impossible reparent: fail-closed Persian until AR disposition.
- FR-11–13: Primary Assignment / Secondary / management derivation — facts on profile/events later; not org-admin CRUD.

## Table / list UX decisions already locked in prior EXPERIENCE

- `personnel-data-table`: compact; `aria-sort`; stable-snapshot pagination; selectable columns; result count; sticky RTL identifier; horizontal scroll in container; row focus + Enter → profile; filtered export if permitted; **no infinite scroll**.
- Empty search: «نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.»
- Empty timeline: «رویداد پرسنلی ثبت نشده.»
- Empty entitlements: «تخصیص دسترسی‌ای ثبت نشده.»
- Suppressed metrics/cells: «داده قابل نمایش نیست» (never 0).
- Access/admin lists: compact density OK; sticky identifier if wide.
- One dialog stack level; import preview = Sheet not nested dialog.
- Shell: fixed navy chrome + RTL sidebar; skip «پرش به محتوا»; banners below header.

## Gaps / conflicts with new redesign (personnel events as separate nav, tabs, collapsible sidebar, table-first)

- **Events as sidebar item:** prior IA reaches فرم رویداد only from profile; separate **رویدادها** nav conflicts UX-DR19 / Operator “list→profile→event” flow; needs FR-33 event-list surface vs profile-only.
- **Collapsible sidebar:** UX-DR1/3 fix 240px labeled sidebar; collapse/icon mode not specified — conflict with ≥1280 “labels remain” and chrome tokens.
- **Tabs:** prior org = stacked sections; job refs already tabbed; page-level org tabs OK if hierarchy vs refs stay distinct; events-as-tabs under پرسنل vs own nav undecided.
- **Table-first:** lists already table-pattern; org hierarchy is **tree**, not table — forcing table-first may fight LE→Team adjacency UX.
- **ظرفیت و جذب** stays sibling surface; headcount panel also embeds in event form — redesign must keep both entry points.
- Current `/organization` = two H1-level panels, not tabbed shell — redesign must pick tabs vs sections without losing FR-9/10 boundary.

## Suggested org tabs for new IA (from FR9–13)

1. **سلسله‌مراتب** — LE→BU→Dept→Team tree, as-of, activate/deactivate (FR-9). Tree-primary; optional flat table secondary.
2. **مراجع شغلی** — Role / Job Title / Ladder / Grade / Seniority (FR-10); keep concept sub-tabs; Grade scoped to Ladder.
3. *(Defer / not org tabs)* Primary/Secondary Assignment & management relations (FR-11–13) → profile + personnel events, not master-data org chrome.
4. Optional later: **as-of / تاریخچه واحدها** if historical org (FR-27 adjacent) needs dedicated view — not MVP tree today.
