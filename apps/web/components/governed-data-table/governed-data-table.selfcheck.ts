/**
 * Pure snapshot helpers for governed-data-table (Story 4b.4 + 8.6).
 * Run: pnpm --filter @divan/web selfcheck:governed-table
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyFilters,
  applyOperatorVisibility,
  applySort,
  computeSnapshot,
  cycleSort,
  isColumnHideable,
  normalizeDefaultFilters,
  paginate,
  sanitizeHiddenColumnIds,
  sanitizePageSize,
  scrubFilters,
  scrubSort,
  snapshotIdentity,
  visibleColumns,
} from "./snapshot";
import type { GovernedColumn, TableFilters } from "./types";
import { GOVERNED_TABLE_DEFAULT_DENSITY } from "./types";

type Row = {
  id: string;
  name: string;
  team: string;
  status: string;
  salary: number;
};

const rows: Row[] = [
  { id: "p03", name: "سارا", team: "ops", status: "active", salary: 30 },
  { id: "p01", name: "علی", team: "eng", status: "active", salary: 10 },
  { id: "p02", name: "مینا", team: "eng", status: "inactive", salary: 20 },
  { id: "p04", name: "رضا", team: "ops", status: "active", salary: 40 },
  { id: "p05", name: "کد۱۲۳", team: "hr", status: "active", salary: 50 },
];

const columns: GovernedColumn<Row>[] = [
  {
    id: "id",
    header: "شناسه",
    accessor: (r) => r.id,
    sticky: "identifier",
    sortable: true,
  },
  {
    id: "name",
    header: "نام",
    accessor: (r) => r.name,
    filter: "text",
    sortable: true,
  },
  {
    id: "team",
    header: "تیم",
    accessor: (r) => r.team,
    filter: "enum",
    enumOptions: [
      { value: "eng", label: "فنی" },
      { value: "ops", label: "عملیات" },
      { value: "hr", label: "منابع انسانی" },
    ],
  },
  {
    id: "status",
    header: "وضعیت",
    accessor: (r) => r.status,
    filter: "enum",
    enumOptions: [
      { value: "active", label: "فعال" },
      { value: "inactive", label: "غیرفعال" },
    ],
  },
  {
    id: "salary",
    header: "جبران خدمت",
    accessor: (r) => r.salary,
    permitted: false,
  },
];

const getRowId = (r: Row) => r.id;

// --- visible / omit ---
assert.equal(visibleColumns(columns).length, 4);
assert.ok(!visibleColumns(columns).some((c) => c.id === "salary"));

// --- scrub omitted column filters ---
const scrubbed = scrubFilters(
  { name: "علی", salary: "secret", status: ["active"] },
  columns,
);
assert.deepEqual(scrubbed, { name: "علی", status: ["active"] });
assert.ok(!("salary" in scrubbed));

// --- text substring + digit normalize ---
const byDigit = applyFilters(rows, columns, { name: "123" });
assert.equal(byDigit.length, 1);
assert.equal(byDigit[0]!.id, "p05");

const byName = applyFilters(rows, columns, { name: "می" });
assert.equal(byName.length, 1);
assert.equal(byName[0]!.id, "p02");

// --- enum empty = no filter ---
const enumEmpty = applyFilters(rows, columns, { team: [] });
assert.equal(enumEmpty.length, rows.length);

const enumOps = applyFilters(rows, columns, { team: ["ops"] });
assert.equal(enumOps.length, 2);

// --- sort + deterministic tie-break ---
const sameStatus: Row[] = [
  { id: "b", name: "ب", team: "eng", status: "active", salary: 1 },
  { id: "a", name: "الف", team: "eng", status: "active", salary: 1 },
];
const sortedTie = applySort(
  sameStatus,
  columns,
  { columnId: "status", direction: "asc" },
  getRowId,
);
assert.deepEqual(
  sortedTie.map((r) => r.id),
  ["a", "b"],
);

const sortedNameAsc = applySort(
  rows,
  columns,
  { columnId: "name", direction: "asc" },
  getRowId,
);
assert.ok(sortedNameAsc[0]!.name <= sortedNameAsc[1]!.name);

// --- paginate ---
assert.deepEqual(
  paginate([1, 2, 3, 4, 5], 0, 2),
  [1, 2],
);
assert.deepEqual(
  paginate([1, 2, 3, 4, 5], 1, 2),
  [3, 4],
);

// --- snapshot identity + page reset semantics ---
const filtersA: TableFilters = { status: ["active"] };
const filtersB: TableFilters = { status: ["active", "inactive"] };
const idA = snapshotIdentity(filtersA, null);
const idB = snapshotIdentity(filtersB, null);
assert.notEqual(idA, idB);

const snap = computeSnapshot({
  rows,
  columns,
  filters: { status: ["active"] },
  sort: { columnId: "id", direction: "asc" },
  pageIndex: 2,
  pageSize: 2,
  getRowId,
});
assert.equal(snap.total, 4);
assert.ok(!snap.visible.some((c) => c.id === "salary"));
assert.equal(snap.pageCount, 2);
// pageIndex 2 is clamped to last page (index 1)
assert.equal(snap.pageRows.length, 2);

const snapAfterFilter = computeSnapshot({
  rows,
  columns,
  filters: { status: ["inactive"] },
  sort: null,
  pageIndex: 0,
  pageSize: 2,
  getRowId,
});
assert.equal(snapAfterFilter.total, 1);
assert.notEqual(
  snapAfterFilter.identity,
  snapshotIdentity({ status: ["active"] }, null),
);

// --- sort cycle ---
assert.deepEqual(cycleSort(null, "name"), {
  columnId: "name",
  direction: "asc",
});
assert.deepEqual(cycleSort({ columnId: "name", direction: "asc" }, "name"), {
  columnId: "name",
  direction: "desc",
});
assert.equal(cycleSort({ columnId: "name", direction: "desc" }, "name"), null);
assert.deepEqual(cycleSort({ columnId: "name", direction: "asc" }, "team"), {
  columnId: "team",
  direction: "asc",
});

// --- scrubSort when column omitted ---
assert.equal(
  scrubSort({ columnId: "salary", direction: "asc" }, columns),
  null,
);
assert.deepEqual(scrubSort({ columnId: "name", direction: "desc" }, columns), {
  columnId: "name",
  direction: "desc",
});

const snapDeadSort = computeSnapshot({
  rows,
  columns,
  filters: {},
  sort: { columnId: "salary", direction: "asc" },
  pageIndex: 0,
  pageSize: 10,
  getRowId,
});
assert.equal(snapDeadSort.sort, null);
assert.equal(snapDeadSort.identity, snapshotIdentity({}, null));
assert.ok(!snapDeadSort.identity.includes("salary"));

// --- page reset contract: identity changes when filters change ---
const idBefore = snapshotIdentity({ status: ["active"] }, null);
const idAfter = snapshotIdentity({ status: ["inactive"] }, null);
assert.notEqual(idBefore, idAfter);

// --- sanitizePageSize / non-finite ---
assert.equal(sanitizePageSize(NaN), 1);
assert.equal(sanitizePageSize(Infinity), 1);
assert.equal(sanitizePageSize(0), 1);
assert.equal(sanitizePageSize(25.9), 25);
assert.deepEqual(paginate([1, 2, 3], 0, NaN), [1]);

// --- normalizeDefaultFilters string↔array coercion ---
assert.deepEqual(
  normalizeDefaultFilters({ status: "active" }, columns),
  { status: ["active"] },
);
assert.deepEqual(
  normalizeDefaultFilters({ name: ["علی", "extra"] }, columns),
  { name: "علی" },
);

// --- enum string filter value accepted ---
const enumString = applyFilters(rows, columns, { team: "ops" });
assert.equal(enumString.length, 2);

// --- Story 8.6: operator visibility scrub ---
assert.equal(isColumnHideable(columns[0]!), false); // sticky identifier
assert.equal(isColumnHideable(columns[1]!), true); // name
assert.deepEqual(
  sanitizeHiddenColumnIds(["id", "name", "__actions", "salary"], columns),
  ["name"],
);

const operatorVisible = applyOperatorVisibility(visibleColumns(columns), [
  "name",
]);
assert.ok(!operatorVisible.some((c) => c.id === "name"));
assert.ok(operatorVisible.some((c) => c.id === "id"));

const scrubHidden = scrubFilters(
  { name: "علی", status: ["active"] },
  columns,
  ["name"],
);
assert.deepEqual(scrubHidden, { status: ["active"] });
assert.ok(!("name" in scrubHidden));

assert.equal(
  scrubSort({ columnId: "name", direction: "asc" }, columns, ["name"]),
  null,
);

const snapHidden = computeSnapshot({
  rows,
  columns,
  filters: { name: "علی", status: ["active"] },
  sort: { columnId: "name", direction: "asc" },
  pageIndex: 0,
  pageSize: 10,
  getRowId,
  hiddenColumnIds: ["name"],
});
assert.ok(!snapHidden.visible.some((c) => c.id === "name"));
assert.ok(!snapHidden.visible.some((c) => c.id === "salary"));
assert.equal(snapHidden.sort, null);
assert.ok(!("name" in snapHidden.activeFilters));
// Hiding must not resurrect permitted:false
assert.ok(!snapHidden.visible.some((c) => c.permitted === false));

// Sticky / actions never enter sanitized hide set
const withActions: GovernedColumn<Row>[] = [
  ...columns,
  {
    id: "__actions",
    header: "اقدامات",
    accessor: () => "",
    sticky: "actions",
  },
];
assert.deepEqual(
  sanitizeHiddenColumnIds(["id", "__actions", "team"], withActions),
  ["team"],
);
assert.deepEqual(
  sanitizeHiddenColumnIds(["team", "team", "name"], columns),
  ["team", "name"],
);

// Density default constant === dense
assert.equal(GOVERNED_TABLE_DEFAULT_DENSITY, "dense");

// --- AST: no forced rem min-widths on table wrappers under apps/web ---
const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../..");

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === "dist"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsx(full, out);
    else if (/\.(tsx|ts|jsx|js|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const forcedMinW =
  /min-w-\[(?:48|64|72)rem\]|\[&_\[data-slot=table\]\]:min-w-/;
const offenders: string[] = [];
for (const file of walkTsx(webRoot)) {
  const src = fs.readFileSync(file, "utf8");
  if (forcedMinW.test(src)) {
    offenders.push(path.relative(webRoot, file));
  }
}
assert.deepEqual(
  offenders,
  [],
  `forced table min-width wrappers must be removed:\n${offenders.join("\n")}`,
);

console.log("governed-data-table.selfcheck: ok");
