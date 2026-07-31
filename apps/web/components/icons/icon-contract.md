# Icon contract (Story 8.2)

Living reference for chrome + gallery. Full table row-action icon-only retrofit is **Story 8.7**.

## Library

- **Only** [`lucide-react`](https://lucide.dev) (already in `@divan/web`).
- Do **not** add a second icon library.

## Size

| Context | Size | Notes |
| --- | --- | --- |
| Row action | **12px** | `size-3` / `h-3 w-3` inside `rowAction` Button (`--control-height-xs`) |
| Toolbar / filter chrome | **16px** | `size-4` (existing default on Button `[&_svg]:size-4`) |
| Nav / sidebar | **16–20px** | Keep existing call-site sizes |

## Stroke

- Use Lucide **default stroke** (outline).
- Do not mix filled and outline randomly for the same action family.

## Starter per-action map (chrome / gallery)

| Action | Lucide export | Typical size |
| --- | --- | --- |
| Edit | `Pencil` | 12px row / 16px toolbar |
| Delete / destructive | `Trash2` | 12px row |
| Add | `Plus` | 16px toolbar |
| Filter | `ListFilter` | 16px toolbar |
| More / overflow | `Ellipsis` | 12–16px |
| Copy | `Copy` | 12px (identifier disclosure) |
| External | `ExternalLink` | 12–16px |
| Search | `Search` | 16px (picker / command) |

## Non-goals (→ 8.7)

- Full per-row icon-only mapping across GovernedDataTable
- Overflow menu standardization
- Inert-action / dead-click selfcheck
