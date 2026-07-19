import type * as React from "react";

export type TreeNavigatorProps<T> = {
  nodes: T[];
  getChildren: (node: T) => T[];
  getNodeId: (node: T) => string;
  getLabel: (node: T) => React.ReactNode;
  /**
   * When set, marks a node as a branch even if children are not loaded yet
   * (e.g. expand-driven fetch). Defaults to `getChildren(node).length > 0`.
   */
  isBranch?: (node: T) => boolean;
  /** Controlled expanded set. */
  expandedIds?: ReadonlySet<string>;
  /** Uncontrolled initial expanded set. */
  defaultExpandedIds?: ReadonlySet<string>;
  onExpandedChange?: (expandedIds: Set<string>) => void;
  /** Controlled selection. */
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelect?: (id: string | null, node: T | null) => void;
  /** Enter / double-click → edit. */
  onActivate?: (id: string, node: T) => void;
  renderRowEnd?: (node: T) => React.ReactNode;
  /** Optional per-row class (e.g. stronger ladder rows). */
  getRowClassName?: (node: T) => string | undefined;
  toolbar?: React.ReactNode;
  "aria-label": string;
};

export type FlatTreeItem<T> = {
  node: T;
  id: string;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
};
