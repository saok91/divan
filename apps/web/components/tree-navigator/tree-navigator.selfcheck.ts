/**
 * Pure tree-navigator helpers (Story 4b.6).
 * Run: pnpm --filter @divan/web selfcheck:tree-navigator
 */
import assert from "node:assert/strict";

import {
  collapseId,
  collectAncestorIds,
  expandId,
  firstVisibleId,
  flattenVisibleNodes,
  lastVisibleId,
  nextVisibleId,
  prevVisibleId,
  toggleExpandedId,
} from "./tree-model";

type Node = {
  id: string;
  label: string;
  children: Node[];
};

const tree: Node[] = [
  {
    id: "le",
    label: "نهاد",
    children: [
      {
        id: "bu",
        label: "BU",
        children: [
          { id: "dept", label: "Dept", children: [{ id: "team", label: "Team", children: [] }] },
        ],
      },
    ],
  },
  { id: "le2", label: "نهاد۲", children: [] },
];

const getChildren = (n: Node) => n.children;
const getNodeId = (n: Node) => n.id;

function run() {
  // Collapsed roots only
  const collapsed = flattenVisibleNodes(tree, getChildren, getNodeId, new Set());
  assert.equal(collapsed.length, 2);
  assert.deepEqual(
    collapsed.map((i) => i.id),
    ["le", "le2"],
  );
  assert.equal(collapsed[0]!.hasChildren, true);
  assert.equal(collapsed[0]!.isExpanded, false);

  // Expand LE → see BU
  const expandedLe = flattenVisibleNodes(
    tree,
    getChildren,
    getNodeId,
    new Set(["le"]),
  );
  assert.deepEqual(
    expandedLe.map((i) => i.id),
    ["le", "bu", "le2"],
  );
  assert.equal(expandedLe[1]!.depth, 1);
  assert.equal(expandedLe[1]!.parentId, "le");

  // Fully expanded path
  const full = flattenVisibleNodes(
    tree,
    getChildren,
    getNodeId,
    new Set(["le", "bu", "dept"]),
  );
  assert.deepEqual(
    full.map((i) => i.id),
    ["le", "bu", "dept", "team", "le2"],
  );

  // Expand/collapse helpers
  assert.ok(expandId(new Set(), "le").has("le"));
  assert.ok(!collapseId(new Set(["le"]), "le").has("le"));
  assert.ok(toggleExpandedId(new Set(), "le").has("le"));
  assert.ok(!toggleExpandedId(new Set(["le"]), "le").has("le"));

  // Focus navigation among visible
  assert.equal(firstVisibleId(full), "le");
  assert.equal(lastVisibleId(full), "le2");
  assert.equal(nextVisibleId(full, "le"), "bu");
  assert.equal(nextVisibleId(full, "le2"), "le2");
  assert.equal(prevVisibleId(full, "bu"), "le");
  assert.equal(prevVisibleId(full, "le"), "le");
  assert.equal(nextVisibleId(full, null), "le");

  // Ancestors for ensuring visibility
  assert.deepEqual(
    collectAncestorIds(tree, getChildren, getNodeId, "team"),
    ["le", "bu", "dept"],
  );
  assert.deepEqual(
    collectAncestorIds(tree, getChildren, getNodeId, "le2"),
    [],
  );

  console.log("tree-navigator selfcheck: ok");
}

run();
