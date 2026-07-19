"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  collapseId,
  expandId,
  findFlatItem,
  firstVisibleId,
  flattenVisibleNodes,
  lastVisibleId,
  nextVisibleId,
  prevVisibleId,
  toggleExpandedId,
} from "./tree-model";
import type { FlatTreeItem, TreeNavigatorProps } from "./types";

function toSet(value: ReadonlySet<string> | undefined): Set<string> {
  return value ? new Set(value) : new Set();
}

type RowProps<T> = {
  item: FlatTreeItem<T>;
  selectedId: string | null;
  focusedId: string | null;
  getLabel: (node: T) => React.ReactNode;
  getRowClassName?: (node: T) => string | undefined;
  renderRowEnd?: (node: T) => React.ReactNode;
  onSelectRow: (id: string) => void;
  onActivateRow: (id: string) => void;
  onToggleExpand: (id: string) => void;
  children?: React.ReactNode;
};

/** Force row-end actions out of the tab order so the tree keeps one tab stop. */
function rovingRowEnd(node: React.ReactNode): React.ReactNode {
  return React.Children.map(node, (child) => {
    if (!React.isValidElement(child)) return child;
    if (child.type === React.Fragment) {
      const fragmentProps = child.props as { children?: React.ReactNode };
      return (
        <React.Fragment key={child.key}>
          {rovingRowEnd(fragmentProps.children)}
        </React.Fragment>
      );
    }
    return React.cloneElement(
      child as React.ReactElement<{ tabIndex?: number }>,
      { tabIndex: -1 },
    );
  });
}

function TreeRow<T>({
  item,
  selectedId,
  focusedId,
  getLabel,
  getRowClassName,
  renderRowEnd,
  onSelectRow,
  onActivateRow,
  onToggleExpand,
  children,
}: RowProps<T>) {
  const isSelected = selectedId === item.id;
  const isFocused = focusedId === item.id;

  return (
    <li
      role="treeitem"
      data-tree-id={item.id}
      aria-expanded={item.hasChildren ? item.isExpanded : undefined}
      aria-selected={isSelected}
      tabIndex={isFocused ? 0 : -1}
      className={cn(
        "list-none rounded-sm outline-none",
        isFocused && "ring-2 ring-ring ring-offset-1",
      )}
    >
      <div
        className={cn(
          "flex h-table-row-compact min-h-[var(--table-row-compact)] w-full items-center gap-2 border-b border-border/50 px-1 text-body",
          isSelected && "bg-muted/60",
          getRowClassName?.(item.node),
        )}
        style={{
          paddingInlineStart: `calc(${item.depth} * var(--spacing-tree-indent))`,
        }}
        onClick={() => onSelectRow(item.id)}
        onDoubleClick={() => onActivateRow(item.id)}
      >
        {item.hasChildren ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={item.isExpanded ? "جمع کردن" : "باز کردن"}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
          >
            {item.isExpanded ? (
              <ChevronDown className="size-5" aria-hidden="true" />
            ) : (
              <ChevronRight
                className="size-5 rtl:rotate-180"
                aria-hidden="true"
              />
            )}
          </button>
        ) : (
          <span className="inline-block size-9 shrink-0" aria-hidden="true" />
        )}
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {getLabel(item.node)}
        </span>
        {renderRowEnd ? (
          <div
            className="flex shrink-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {rovingRowEnd(renderRowEnd(item.node))}
          </div>
        ) : null}
      </div>
      {children}
    </li>
  );
}

/**
 * Shared APG Tree View primitive (Story 4b.6).
 * Presentational only — caller owns data fetch / CTAs / cold-load UI.
 */
export function TreeNavigator<T>({
  nodes,
  getChildren,
  getNodeId,
  getLabel,
  isBranch,
  expandedIds: expandedIdsProp,
  defaultExpandedIds,
  onExpandedChange,
  selectedId: selectedIdProp,
  defaultSelectedId = null,
  onSelect,
  onActivate,
  renderRowEnd,
  getRowClassName,
  toolbar,
  "aria-label": ariaLabel,
}: TreeNavigatorProps<T>) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = React.useState(() =>
    toSet(defaultExpandedIds),
  );
  const [uncontrolledSelected, setUncontrolledSelected] = React.useState<
    string | null
  >(defaultSelectedId);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const treeRef = React.useRef<HTMLUListElement>(null);

  const expandedControlled = expandedIdsProp !== undefined;
  const selectedControlled = selectedIdProp !== undefined;

  const expandedIds = expandedControlled
    ? toSet(expandedIdsProp)
    : uncontrolledExpanded;
  const selectedId = selectedControlled
    ? (selectedIdProp ?? null)
    : uncontrolledSelected;

  const setExpanded = React.useCallback(
    (next: Set<string>) => {
      if (!expandedControlled) setUncontrolledExpanded(next);
      onExpandedChange?.(next);
    },
    [expandedControlled, onExpandedChange],
  );

  const setSelected = React.useCallback(
    (id: string | null, node: T | null) => {
      if (!selectedControlled) setUncontrolledSelected(id);
      onSelect?.(id, node);
    },
    [selectedControlled, onSelect],
  );

  const flat = React.useMemo(
    () =>
      flattenVisibleNodes(
        nodes,
        getChildren,
        getNodeId,
        expandedIds,
        null,
        0,
        isBranch,
      ),
    [nodes, getChildren, getNodeId, expandedIds, isBranch],
  );

  const effectiveFocusId = React.useMemo(() => {
    if (flat.length === 0) return null;
    if (focusedId && flat.some((item) => item.id === focusedId)) {
      return focusedId;
    }
    if (selectedId && flat.some((item) => item.id === selectedId)) {
      return selectedId;
    }
    return firstVisibleId(flat);
  }, [flat, focusedId, selectedId]);

  const focusItem = React.useCallback((id: string | null) => {
    setFocusedId(id);
    if (!id) return;
    requestAnimationFrame(() => {
      const el = treeRef.current?.querySelector<HTMLElement>(
        `[data-tree-id="${CSS.escape(id)}"]`,
      );
      el?.focus();
    });
  }, []);

  const selectById = React.useCallback(
    (id: string) => {
      const item = findFlatItem(flat, id);
      if (!item) return;
      setSelected(id, item.node);
      focusItem(id);
    },
    [flat, setSelected, focusItem],
  );

  const activateById = React.useCallback(
    (id: string) => {
      const item = findFlatItem(flat, id);
      if (!item) return;
      setSelected(id, item.node);
      onActivate?.(id, item.node);
    },
    [flat, setSelected, onActivate],
  );

  const toggleExpand = React.useCallback(
    (id: string) => {
      setExpanded(toggleExpandedId(expandedIds, id));
      focusItem(id);
    },
    [expandedIds, setExpanded, focusItem],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      if (flat.length === 0) return;
      const current = effectiveFocusId ?? selectedId ?? firstVisibleId(flat);
      if (!current) return;
      const item = findFlatItem(flat, current);
      if (!item) return;

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          const next = nextVisibleId(flat, current);
          if (next) {
            focusItem(next);
            setSelected(next, findFlatItem(flat, next)?.node ?? null);
          }
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          const prev = prevVisibleId(flat, current);
          if (prev) {
            focusItem(prev);
            setSelected(prev, findFlatItem(flat, prev)?.node ?? null);
          }
          break;
        }
        case "ArrowRight": {
          // APG physical Right — expand or move to first child (do not mirror for RTL)
          event.preventDefault();
          if (item.hasChildren && !item.isExpanded) {
            setExpanded(expandId(expandedIds, item.id));
          } else if (item.hasChildren && item.isExpanded) {
            const next = nextVisibleId(flat, current);
            if (next && findFlatItem(flat, next)?.parentId === item.id) {
              focusItem(next);
              setSelected(next, findFlatItem(flat, next)?.node ?? null);
            }
          }
          break;
        }
        case "ArrowLeft": {
          // APG physical Left — collapse or move to parent
          event.preventDefault();
          if (item.hasChildren && item.isExpanded) {
            setExpanded(collapseId(expandedIds, item.id));
          } else if (item.parentId) {
            focusItem(item.parentId);
            setSelected(
              item.parentId,
              findFlatItem(flat, item.parentId)?.node ?? null,
            );
          }
          break;
        }
        case "Home": {
          event.preventDefault();
          const first = firstVisibleId(flat);
          if (first) {
            focusItem(first);
            setSelected(first, findFlatItem(flat, first)?.node ?? null);
          }
          break;
        }
        case "End": {
          event.preventDefault();
          const last = lastVisibleId(flat);
          if (last) {
            focusItem(last);
            setSelected(last, findFlatItem(flat, last)?.node ?? null);
          }
          break;
        }
        case "Enter": {
          event.preventDefault();
          activateById(current);
          break;
        }
        default:
          break;
      }
    },
    [
      flat,
      effectiveFocusId,
      selectedId,
      expandedIds,
      focusItem,
      setSelected,
      setExpanded,
      activateById,
    ],
  );

  /** Build nested treeitem/group DOM from flat visible list. */
  function renderBranch(parentId: string | null): React.ReactNode {
    const items = flat.filter((item) => item.parentId === parentId);
    if (items.length === 0) return null;
    return items.map((item) => (
      <TreeRow
        key={item.id}
        item={item}
        selectedId={selectedId}
        focusedId={effectiveFocusId}
        getLabel={getLabel}
        getRowClassName={getRowClassName}
        renderRowEnd={renderRowEnd}
        onSelectRow={selectById}
        onActivateRow={activateById}
        onToggleExpand={toggleExpand}
      >
        {item.hasChildren && item.isExpanded ? (
          <ul role="group" className="m-0 list-none p-0">
            {renderBranch(item.id)}
          </ul>
        ) : null}
      </TreeRow>
    ));
  }

  return (
    <div className="space-y-3">
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
      ) : null}
      <ul
        ref={treeRef}
        role="tree"
        aria-label={ariaLabel}
        className="m-0 w-full list-none p-0"
        onKeyDown={onKeyDown}
      >
        {renderBranch(null)}
      </ul>
    </div>
  );
}
