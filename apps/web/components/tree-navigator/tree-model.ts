import type { FlatTreeItem } from "./types";

/**
 * Flatten tree to visible rows given expanded id set.
 * Pure — used by TreeNavigator and selfcheck.
 */
export function flattenVisibleNodes<T>(
  nodes: T[],
  getChildren: (node: T) => T[],
  getNodeId: (node: T) => string,
  expandedIds: ReadonlySet<string>,
  parentId: string | null = null,
  depth = 0,
  isBranch?: (node: T) => boolean,
): FlatTreeItem<T>[] {
  const out: FlatTreeItem<T>[] = [];
  for (const node of nodes) {
    const id = getNodeId(node);
    const children = getChildren(node);
    const hasChildren = isBranch ? isBranch(node) : children.length > 0;
    const isExpanded = hasChildren && expandedIds.has(id);
    out.push({ node, id, parentId, depth, hasChildren, isExpanded });
    if (isExpanded) {
      out.push(
        ...flattenVisibleNodes(
          children,
          getChildren,
          getNodeId,
          expandedIds,
          id,
          depth + 1,
          isBranch,
        ),
      );
    }
  }
  return out;
}

export function toggleExpandedId(
  expandedIds: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(expandedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function expandId(
  expandedIds: ReadonlySet<string>,
  id: string,
): Set<string> {
  if (expandedIds.has(id)) return new Set(expandedIds);
  const next = new Set(expandedIds);
  next.add(id);
  return next;
}

export function collapseId(
  expandedIds: ReadonlySet<string>,
  id: string,
): Set<string> {
  if (!expandedIds.has(id)) return new Set(expandedIds);
  const next = new Set(expandedIds);
  next.delete(id);
  return next;
}

export function indexOfId<T>(
  flat: FlatTreeItem<T>[],
  id: string | null | undefined,
): number {
  if (!id) return -1;
  return flat.findIndex((item) => item.id === id);
}

export function nextVisibleId<T>(
  flat: FlatTreeItem<T>[],
  currentId: string | null,
): string | null {
  if (flat.length === 0) return null;
  const idx = indexOfId(flat, currentId);
  if (idx < 0) return flat[0]!.id;
  if (idx >= flat.length - 1) return flat[idx]!.id;
  return flat[idx + 1]!.id;
}

export function prevVisibleId<T>(
  flat: FlatTreeItem<T>[],
  currentId: string | null,
): string | null {
  if (flat.length === 0) return null;
  const idx = indexOfId(flat, currentId);
  if (idx < 0) return flat[0]!.id;
  if (idx <= 0) return flat[0]!.id;
  return flat[idx - 1]!.id;
}

export function firstVisibleId<T>(flat: FlatTreeItem<T>[]): string | null {
  return flat[0]?.id ?? null;
}

export function lastVisibleId<T>(flat: FlatTreeItem<T>[]): string | null {
  return flat.length === 0 ? null : flat[flat.length - 1]!.id;
}

export function findFlatItem<T>(
  flat: FlatTreeItem<T>[],
  id: string,
): FlatTreeItem<T> | undefined {
  return flat.find((item) => item.id === id);
}

/**
 * Collect ancestor ids from root to parent of `id` (not including `id`).
 * Useful for ensuring a newly selected node is visible.
 */
export function collectAncestorIds<T>(
  nodes: T[],
  getChildren: (node: T) => T[],
  getNodeId: (node: T) => string,
  targetId: string,
): string[] {
  const path: string[] = [];

  function walk(list: T[], ancestors: string[]): boolean {
    for (const node of list) {
      const id = getNodeId(node);
      if (id === targetId) {
        path.push(...ancestors);
        return true;
      }
      if (walk(getChildren(node), [...ancestors, id])) return true;
    }
    return false;
  }

  walk(nodes, []);
  return path;
}
