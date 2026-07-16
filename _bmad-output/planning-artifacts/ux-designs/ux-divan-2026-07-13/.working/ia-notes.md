# IA Notes — Divan HRIS (Discovery)

## Shell
- Single unified app, role-filtered nav
- shadcn/ui + brand-layer DESIGN.md delta
- Mixed density (compact lists, comfortable forms/timeline)

## Layout
- Fixed header: logo, global personnel search (Ctrl+K, `/`), user menu, optional stale-state banner
- RTL sidebar (right): primary nav items
- Main content area

## Primary navigation

| Item (FA) | Surface | Typical roles |
|---|---|---|
| داشبورد | Launch dashboard | All (permission-scoped) |
| پرسنل | Search + lists | Operator, Admin, Manager |
| ساختار سازمان | Org + reference data | Admin |
| ظرفیت و جذب | Headcount | Admin, Operator (view), Manager (scoped) |
| گزارش‌ها | Report catalogue | Scoped |
| ورود داده | Import + reconciliation | Admin, migration actors |
| دسترسی‌ها | Entitlements | Admin |
| ممیزی | Audit investigation | Audit reviewer |
| عملیات | Ops health | System Admin |
| پرونده‌های اصلاح | Correction cases | Admin |

## Contextual surfaces (not top-level nav)
- Person profile ← search result
- Timeline + events ← within profile
- Event forms ← profile action menu
- Export retrieval ← report/list action

## Role landing pages

| Role | Landing |
|---|---|
| HR Operator | پرسنل |
| HR Admin | داشبورد |
| Manager | داشبورد (scoped) |
| Audit | ممیزی |
| System Admin | عملیات |

## Global search
- Command palette pattern (shadcn Command)
- Scope: personnel identifiers + quick navigate to permitted profile
- Permission-safe: no out-of-scope results

## Wireframes
- `.working/flow-mina-transfer-2026-07-13.excalidraw` — UJ-1 future transfer
