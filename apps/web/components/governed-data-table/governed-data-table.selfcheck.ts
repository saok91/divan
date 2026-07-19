/**
 * Pure snapshot helpers for governed-data-table (Story 4b.4).
 * Run: pnpm --filter @divan/web selfcheck:governed-table
 */
import assert from "node:assert/strict";

import {
  applyFilters,
  applySort,
  computeSnapshot,
  cycleSort,
  normalizeDefaultFilters,
  paginate,
  sanitizePageSize,
  scrubFilters,
  scrubSort,
  snapshotIdentity,
  visibleColumns,
} from "./snapshot";
import type { GovernedColumn, TableFilters } from "./types";

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

console.log("governed-data-table.selfcheck: ok");
