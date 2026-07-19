# Edge Case Review — divan shell redesign

## Scope

Walked `EXPERIENCE.md` (primary), `DESIGN.md` (interaction/layout constraints), `.memlog.md`, and key mocks (`key-personnel-list.html`, `key-access-admin.html`, `.working/key-org-ladder-grade.html`) against focus areas: collapsible sidebar, section tabs + unsaved guards, governed-data-table filters/pagination/sensitive omit, personnel row actions + dialog stack, dual import entry, org trees (سلسله‌مراتب / لدر و گرید), access person-first vs toxic/break-glass, modal depth, full-width vs form max-width, role-filtered nav with new رویدادهای پرسنلی. Accessibility/WCAG deferred per request. Prior spine states cited only where this revision inherits or silently drops them.

## Findings

### critical — Dirty quick-edit leave paths unguarded
- **Path:** فهرست پرسنل → quick-edit dirty → Esc / overlay dismiss / Cancel / «باز کردن پروفایل کامل» / sidebar or tab change / row «ثبت رویداد» (same or other row) / «افزودن سریع» while modal open.
- **Gap:** Spine mandates one dialog stack and unsaved warning for form *tabs* and event form, but `personnel-quick-edit-modal` has no dirty-leave rules. Profile link and ثبت رویداد navigation can discard edits or stack navigation under an open dialog.
- **Fix suggestion:** Define dirty detection; block dismiss/navigate with «تغییرات ذخیره نشده‌اند.» (Stay · Discard · Save); profile link and ثبت رویداد only after resolve; refuse second modal until closed.

### critical — Toxic self-approval / same-grant paths absent on person-first UI
- **Path:** دسترسی‌ها / افراد و دسترسی → assign role/scope to *self* · Admin approves own grant · grant that recreates toxic combo (FR-46 / prior access extract).
- **Gap:** Redesign specifies person-first table + break-glass tab warning posture, but no fail-closed UI, copy, or disabled action for toxic combinations. UJ-2 “confirms” assignment without a blocked branch. Source extract’s toxic fail-closed is not projected into this spine.
- **Fix suggestion:** On toxic attempt: block save, Persian reason, no tease of success; keep evidence of attempt; same rule whether action starts from people row or نقش‌ها.

### high — Prefill ثبت رویداد overwrites dirty event form
- **Path:** رویدادهای پرسنلی / ثبت رویداد dirty (person A or blank draft) → navigate via فهرست row «ثبت رویداد» (person B) or toolbar «ثبت رویداد» or palette deep link with `?person=`.
- **Gap:** Prefill + “person locked/shown” specified; conflict with an already-dirty tab is not. Guard text is tab-leave oriented, not inbound-prefill overwrite.
- **Fix suggestion:** Inbound prefill runs unsaved guard first; on continue, replace person/fields per explicit rule (replace all vs keep draft fields); never silently swap person.

### high — Unsaved guard scoped to “dirty form tabs” only
- **Path:** Dirty افزودن / ثبت رویداد / ایجاد / ورود گروهی (preview loaded) → sidebar item · command palette · browser back/forward · theme is exempt (stated) · collapse toggle (unclear).
- **Gap:** `section-tabs` says guard when leaving dirty form tabs; sidebar/global navigation and palette not named. Prior import preview unsaved (batch id) not restated for section ورود گروهی.
- **Fix suggestion:** One leave-guard policy for any route change away from dirty form/preview surfaces (tabs, sidebar, palette, history); list which tabs are “form-like”; inherit import preview warning for both import entries.

### high — Clear-filters vs default «همکار فعلی»
- **Path:** Default filter on → user adds other filters → empty result → «پاک کردن فیلترها» · OR dismiss chip then clear · OR clear while chip still on.
- **Gap:** Empty state CTA clears filters; default is همکار فعلی = yes (dismissible). Spine does not say whether clear restores default yes, clears to «همه», or only non-default columns. Chip + column enum control can desync (mock shows both).
- **Fix suggestion:** Single source of truth for همکار فعلی (chip ↔ column filter); define clear = “reset to section defaults” (yes on) vs “all open”; document chip dismiss as writing that truth.

### high — Create grade with no ladder parent
- **Path:** لدر و گرید → no selection / only collapsed ladders / selection on a grade → toolbar «افزودن گرید» (mock always shows gold CTA) · keyboard add with no applicable parent.
- **Gap:** Mock helper «گرید فقط زیر نردبان والد»; spine “under selected parent when applicable” — no branch for inapplicable selection (disabled CTA, forced parent picker, or error).
- **Fix suggestion:** Disable «افزودن گرید» until a ladder is selected (or open modal with required parent field); empty-ladder tree: only «افزودن نردبان»; Persian error if API rejects orphan grade.

### high — Deactivate-with-children not carried into redesign tree UX
- **Path:** سلسله‌مراتب or لدر و گرید → deactivate/edit modal on node that has active children · impossible reparent.
- **Gap:** Prior org extract: fail-closed Persian until AR disposition. New tree pattern covers expand/edit/create only — no deactivate, dependency block, or inactive visibility/filter.
- **Fix suggestion:** Restate fail-closed deactivate/reparent in tree-navigator + edit modal; show inactive nodes with filter; confirm copy lists blocking children.

### medium — Filter change vs pagination page index
- **Path:** Page N of stable snapshot → change text/enum filter or dismiss همکار فعلی → results shrink.
- **Gap:** Stable-snapshot pagination named; reset-to-page-1 (or clamp) on filter/sort change not stated. Risk: empty page or stale snapshot identity.
- **Fix suggestion:** Any filter/sort change → new snapshot, page = 1; announce new count; keep prior page only when result set identity unchanged.

### medium — Enum multi-select empty selection semantics
- **Path:** Column enum multi-select → deselect all options (Excel-like ambiguity) · vs «همه».
- **Gap:** Multi-select specified; empty selection = no rows vs no filter vs invalid not defined. Mock uses single `<select>` (spine wins) but does not clarify multi empty state.
- **Fix suggestion:** Empty multi = no filter (same as همه) *or* explicit “must pick ≥1”; never silently zero results without empty-state CTA.

### medium — Sensitive column omit mid-session / filter residue
- **Path:** User with جبران خدمت → filters/sorts that column → entitlement revoked or other user without permission loads same URL/state · column omitted from DOM.
- **Gap:** Omit-without-permission stated; drop of active filter/sort on omitted column and URL/share state not handled.
- **Fix suggestion:** On omit, strip that column’s filter/sort from query state; never round-trip sensitive values in URL; refresh columns on entitlement change.

### medium — Dual import concurrent / leave across entry points
- **Path:** Section ورود گروهی preview loaded → open sidebar ورود داده (or reverse) · execute while other entry has in-flight batch.
- **Gap:** Concurrent batch block inherited for import-preview; dual-entry does not say one global mutex vs per-domain. Leave-guard for section preview thin (see unsaved guard).
- **Fix suggestion:** One in-flight import mutex app-wide (reuse «دسته دیگری در حال اجراست»); same unsaved preview warning on either entry; short in-UI hint when to use گروهی vs داده.

### medium — Tree expand/selection state boundaries
- **Path:** Expand nodes → switch section tab → return · refresh · collapse ancestor of selected node · deep link with no expand path.
- **Gap:** Expand/collapse interaction specified; persistence, selection survival when ancestor collapses, and deep-link expand-to-node not specified.
- **Fix suggestion:** Persist expand set per account+tree (or session); on collapse ancestor, move selection to ancestor or clear; deep link expands ancestors then opens edit if entitled.

### medium — Collapsed sidebar × banner stack × content width
- **Path:** Collapse sidebar while `stale-recalc-banner` and/or `break-glass-banner` visible · resize 1920→1280 with preference expanded · preference load fail.
- **Gap:** Collapse reclaim width and banner stack order stated separately; no rule for banner width vs sidebar, footer toggle when nav scrolls, or failed persist fallback.
- **Fix suggestion:** Banners span content column only (or full chrome width—pick one); footer toggle sticky; persist fail → default expanded; optional encourage-collapse at 1280 without overriding saved preference silently.

### medium — Break-glass tab vs banner lifecycle
- **Path:** دسترسی اضطراری grant/activate → HR routes show banner · expiry · grant while stale banner blocking · who may open tab.
- **Gap:** Tab is “visually distinct / warning”; prior banner semantics “unchanged,” but grant→banner→expiry→dismiss coupling and role gate for the tab are not written. (Story extract once marked break-glass grant UI out of scope — spine now includes the tab without edges.)
- **Fix suggestion:** Spell grant/expiry/banner sync; tab role-filtered; stale still disables affected gold CTAs including any break-glass execute control.

### medium — Role matrix for new nav + Admin-only tab deep links
- **Path:** Operator/Manager/Audit deep link `/…/رویدادهای پرسنلی` · `/…/فرهنگ داده` · bookmark to pre-redesign nested event URL · role loses entitlement mid-session (item vanishes from collapsed icon rail).
- **Gap:** Unauthorized = hidden; role landings listed; **which roles see رویدادهای پرسنلی** and Manager-scoped event rows not specified. فرهنگ داده Admin-only — deep link denial vs hide-only unclear. Old nested routes unmentioned.
- **Fix suggestion:** Publish role×surface matrix including new item; deep link deny → «دسترسی ندارید.» + role landing; redirect map for old event URLs; scoped events table follows same omit rules as list.

### medium — Sheet + confirmation vs “one dialog stack”
- **Path:** ورود گروهی / ورود داده → Sheet preview → sensitive-confirmation execute · Quick-edit Save if ever needs confirm.
- **Gap:** Modal depth: dialogs + Sheet for import; confirm is a dialog. Dialog-over-Sheet allowed or banned not explicit (prior used Sheet to *avoid* dialog-on-dialog, not dialog-on-sheet).
- **Fix suggestion:** Allow exactly one dialog above Sheet for execute confirm; forbid second dialog; quick-edit stays save-without-nested-confirm unless field class requires sensitive-confirmation (then close or convert to Sheet flow).

### medium — Form max-width surfaces unnamed
- **Path:** اطلاعات پرسنلی / افزودن · ظرفیت / ایجاد · فرهنگ داده · section ورود گروهی upload step — vs lists/trees full-width; event form `max-w-4xl`.
- **Gap:** DESIGN: forms *may* keep event-form max width; only `personnel-event-form` and quick-edit have tokens. Other form tabs can drift full-bleed or inconsistently centered; sidebar collapse re-centering undefined.
- **Fix suggestion:** Classify each tab: `workspace-full` | `form-max-w-4xl` | `sheet-full`; center form in remaining content width after collapse.

### low — Table row Enter still unbound after action redesign
- **Path:** Keyboard focus on governed row → Enter (prior: open profile).
- **Gap:** Row actions always visible; tree Enter → edit modal; table Enter not remapped (profile vs quick-edit vs none).
- **Fix suggestion:** Enter opens quick-edit; Shift+Enter or action menu for ثبت رویداد; document in keyboard map.

### low — Filter/query state not in URL
- **Path:** Share/deep link to filtered فهرست or رویدادها (person filter after UJ-1 climax).
- **Gap:** URL reflects tab only; filter/sort/page ephemeral — climax “filter to person” not bookmarkable.
- **Fix suggestion:** Optional query params for non-sensitive filters/page; exclude sensitive column state.

### low — Collapse control keyboard beyond tooltip focus
- **Path:** Keyboard-only user toggles collapse; multi-window preference race.
- **Gap:** Hover/focus tooltips and aria-label on icons; no shortcut or conflict with `/` and Ctrl+K; last-write-wins across tabs unstated.
- **Fix suggestion:** Focusable footer toggle in tab order; last-write-wins on persist; no new shortcut required if toggle is reachable.

## Coverage notes

- Shell IA order, collapse default/persist, icon+tooltip, and content width reclaim are coherently stated.
- Dual import *intent* (گروهی vs داده) and one-dialog / event-on-tab / Sheet-for-import posture are clear at happy path.
- Governed table: debounce vs enum-apply, sticky columns, omit sensitive from DOM, empty copy, and default همکار فعلی chip are directionally solid once clear/default semantics are fixed.
- UJ-1 happy path (filter → quick-edit save → prefill transfer → events table) is specified end-to-end without capacity/partial-assign ambiguity on the success branch.
- Access empty entitlements copy and break-glass as separate tab (mental model) are present; toxic/break-glass *edges* are the gap, not the IA shape.
- DESIGN full-width lists/trees vs capped event form is explicit; unnamed form tabs are the residual.
