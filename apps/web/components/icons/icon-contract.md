# Icon contract (Story 8.2 + 8.7)

Living reference for chrome, gallery, and **canonical row-action** icons.

## Library

- **Only** [`lucide-react`](https://lucide.dev) (already in `@divan/web`).
- Do **not** add a second icon library.

## Size

| Context | Size | Notes |
| --- | --- | --- |
| Row action | **12px** | `size-3` / `h-3 w-3` inside `RowActionButton` (`--control-height-xs`) |
| Toolbar / filter chrome | **16px** | `size-4` (existing default on Button `[&_svg]:size-4`) |
| Field help / label info | **14–16px** | `size-3.5`–`size-4` inside `FieldHelpIcon` (Story 11.4) |
| Nav / sidebar | **16–20px** | Keep existing call-site sizes |

## Stroke

- Use Lucide **default stroke** (outline).
- Do not mix filled and outline randomly for the same action family.

## Canonical per-action map (Story 8.7)

Same Persian action ⇒ same Lucide export on every surface.

| Action (Persian label) | Lucide export | Notes |
| --- | --- | --- |
| اطلاعات کامل/ویرایش | `Pencil` | Personnel primary open/edit |
| ویرایش | `Pencil` | Org refs / generic edit |
| ثبت رویداد | `CalendarPlus` | Personnel register event |
| تخصیص نقش | `Shield` | Access |
| محدوده | `MapPinned` | Access scopes |
| فعال‌سازی | `CircleCheck` | Access / org activate |
| غیرفعال‌سازی | `Ban` | Org deactivate |
| جزئیات | `Eye` | Audit / correction |
| مشاهده | `FileSearch` | Report open |
| اقدامات بیشتر (overflow) | `Ellipsis` | Mandatory overflow trigger |
| حذف / مخرب | `Trash2` | Destructive still confirms via existing dialogs |
| لغو (lifecycle / revoke) | `Ban` | Event cancel / exemption revoke |
| بازگشت (lifecycle) | `Undo2` | Event reverse |
| اصلاح (lifecycle) | `Pencil` | Event correct |
| دریافت | `Download` | Correction attachment |
| پیش‌نمایش | `Eye` | Correction attachment preview |
| بازتأیید | `RefreshCw` | Entitlement recert |
| افزودن | `Plus` | Toolbar |
| فیلتر | `ListFilter` | Toolbar |
| کپی | `Copy` | Identifier disclosure |
| پیوند خارجی | `ExternalLink` | External open |
| جستجو | `Search` | Picker / command |
| راهنمای فیلد (label info) | `Info` | Compact field help beside labels (`FieldHelpIcon`) — toolbar/filter size |

## Primitives

- `RowActionButton` — icon-only `rowAction` + required `aria-label` + tooltip (hover **and** focus)
- `RowActionCluster` / `RowActionOverflow` — at most **two** visible icons; #3+ in labelled overflow
- `FieldHelpIcon` — quiet ghost `Info` at ~14–16px beside field labels; tooltip = help body; distinct from GlossaryTerm

## Non-goals (other stories)

- Skeletons / toast / motion → **8.8**
- Glossary / banner rewrite → **8.9**
- Design QA gate → **8.10**
