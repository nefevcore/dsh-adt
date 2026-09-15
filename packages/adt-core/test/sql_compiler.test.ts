import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSelect, needsCompilation, collectTables, compileAndRun } from '../lib/tools/sql-compiler.js';

/**
 * sql-compiler tests — an in-memory fake runQuery stands in for the SAP
 * fetch: two small tables (orders o, customers c) exercise join pushdown,
 * local hash-join, aggregation, IN-subquery, order/limit windows.
 */

const ORDERS = {
  columns: [
    { name: 'ID', type: 'INT4' },
    { name: 'CUST', type: 'CHAR' },
    { name: 'AMOUNT', type: 'DEC' },
    { name: 'STATUS', type: 'CHAR' },
  ],
  rows: [
    { ID: '1', CUST: 'C1', AMOUNT: '100', STATUS: 'OPEN' },
    { ID: '2', CUST: 'C1', AMOUNT: '50', STATUS: 'CLOSED' },
    { ID: '3', CUST: 'C2', AMOUNT: '70', STATUS: 'OPEN' },
    { ID: '4', CUST: 'C3', AMOUNT: '200', STATUS: 'OPEN' },
    { ID: '5', CUST: 'C4', AMOUNT: '30', STATUS: 'CLOSED' },
  ],
};

const CUSTOMERS = {
  columns: [
    { name: 'ID', type: 'CHAR' },
    { name: 'NAME', type: 'CHAR' },
  ],
  rows: [
    { ID: 'C1', NAME: 'ALPHA' },
    { ID: 'C2', NAME: 'BETA' },
    { ID: 'C3', NAME: 'GAMMA' },
    // C4 intentionally missing — LEFT JOIN keeps its orders.
  ],
};

/** Fake freestyle endpoint: parses nothing, just slices the named table.
 *  Generated fetches are UNPREFIXED (bare column names, no alias). */
function fakeRunQuery(sql: string, opts: { top: number }) {
  const upper = sql.toUpperCase();
  const table = /FROM\s+ORDERS/.test(upper) ? ORDERS : /FROM\s+CUSTOMERS/.test(upper) ? CUSTOMERS : ORDERS;
  let rows = table.rows;
  const whereEq = /WHERE\s+(?:\w+~)?(\w+)\s*=\s*'([^']+)'/i.exec(sql);
  if (whereEq) {
    const [, col, val] = whereEq;
    rows = rows.filter((r) => r[col!.toUpperCase()] === val);
  }
  const whereIn = /IN\s*\(([^)]+)\)/i.exec(sql);
  if (whereIn) {
    const values = whereIn[1]!.split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
    const colMatch = /(\w+)~(\w+)\s+NOT\s+IN/i.exec(sql) ?? /(\w+)~(\w+)\s+IN/i.exec(sql) ?? /(\w+)\s+NOT\s+IN/i.exec(sql) ?? /(\w+)\s+IN/i.exec(sql);
    if (colMatch) {
      const col = (colMatch[2] ?? colMatch[1])!.toUpperCase();
      const not = /NOT\s+IN/i.test(sql);
      rows = rows.filter((r) => (not ? !values.includes(r[col] ?? '') : values.includes(r[col] ?? '')));
    }
  }
  const whereLike = /(?:\w+~)?(\w+)\s+LIKE\s+'([^']+)'/i.exec(sql);
  if (whereLike) {
    const [, col, pattern] = whereLike;
    const re = new RegExp(`^${pattern!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`);
    rows = rows.filter((r) => re.test(r[col!.toUpperCase()] ?? ''));
  }
  // Projection: SELECT x, y FROM … (bare or aliased names)
  const proj = /SELECT\s+(.+?)\s+FROM/i.exec(sql);
  let columns = table.columns;
  if (proj && !proj[1]!.includes('*')) {
    const names = proj[1]!.split(',').map((p) => p.trim().replace(/^\w+~/, '').toUpperCase());
    columns = table.columns.filter((c) => names.includes(c.name));
    rows = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => names.includes(k))));
  }
  return Promise.resolve({ columns, rows: rows.slice(0, opts.top), totalRows: rows.length });
}

// ---------------------------------------------------------------------------
// parser
// ---------------------------------------------------------------------------

test('parser: join + aggregate + order + limit shape', () => {
  const ast = parseSelect(
    'SELECT c.name, COUNT(*) AS cnt FROM orders AS o JOIN customers AS c ON o.cust = c.id ' +
      "WHERE o.status = 'OPEN' GROUP BY c.name ORDER BY cnt DESC",
  );
  assert.equal(needsCompilation(ast), true);
  assert.deepEqual(collectTables(ast), ['ORDERS', 'CUSTOMERS']);
});

test('parser: single-table plain select does not need compilation', () => {
  const ast = parseSelect("SELECT bukrs, belnr FROM bkpf WHERE gjahr = 2024");
  assert.equal(needsCompilation(ast), false);
});

test('parser: RIGHT/FULL JOIN reject with a remedy', () => {
  assert.throws(() => parseSelect('SELECT * FROM a RIGHT JOIN b ON a.x = b.x'), /RIGHT JOIN is not supported/);
  assert.throws(() => parseSelect('SELECT * FROM a FULL OUTER JOIN b ON a.x = b.x'), /FULL JOIN is not supported/);
});

test('parser: subquery in SELECT list rejects with a remedy', () => {
  assert.throws(
    () => parseSelect('SELECT (SELECT MAX(x) FROM t2) FROM t1'),
    /column-reference|expected a column/,
  );
});

// ---------------------------------------------------------------------------
// compiler end-to-end (fake endpoint)
// ---------------------------------------------------------------------------

test('compile: INNER JOIN with pushed WHERE, projected columns, ORDER BY', async () => {
  const result = await compileAndRun(
    "SELECT c.name, o.amount FROM orders AS o JOIN customers AS c ON o.cust = c.id WHERE o.status = 'OPEN' ORDER BY o.amount DESC",
    fakeRunQuery,
    { length: 10, offset: 0 },
  );
  assert.deepEqual(result.rows, [
    { NAME: 'GAMMA', AMOUNT: '200' },
    { NAME: 'ALPHA', AMOUNT: '100' },
    { NAME: 'BETA', AMOUNT: '70' },
  ]);
  // Pushdown went into the generated SQL.
  assert.ok(result.executedSqls.some((s) => /STATUS = 'OPEN'/.test(s)));
  assert.ok(result.executedSqls.some((s) => /FROM ORDERS/.test(s)));
});

test('compile: LEFT JOIN keeps unmatched rows with empty right side', async () => {
  const result = await compileAndRun(
    'SELECT o.id, c.name FROM orders AS o LEFT JOIN customers AS c ON o.cust = c.id ORDER BY o.id ASC',
    fakeRunQuery,
    { length: 10, offset: 0 },
  );
  const c4 = result.rows.find((r) => r.ID === '5');
  assert.deepEqual(c4, { ID: '5', NAME: '' });
  assert.equal(result.rows.length, 5);
});

test('compile: GROUP BY + COUNT + HAVING', async () => {
  const result = await compileAndRun(
    'SELECT c.name, COUNT(*) AS cnt FROM orders AS o JOIN customers AS c ON o.cust = c.id ' +
      'GROUP BY c.name HAVING COUNT(*) >= 1 ORDER BY cnt DESC',
    fakeRunQuery,
    { length: 10, offset: 0 },
  );
  assert.deepEqual(result.rows, [
    { NAME: 'ALPHA', CNT: '2' },
    { NAME: 'BETA', CNT: '1' },
    { NAME: 'GAMMA', CNT: '1' },
  ]);
  assert.ok(result.notes.some((n) => /aggregation computed client-side/.test(n)));
});

test('compile: SUM/AVG/MIN/MAX aggregates, numeric semantics', async () => {
  const result = await compileAndRun(
    "SELECT SUM(o.amount) AS total, MIN(o.amount) AS lo, MAX(o.amount) AS hi, AVG(o.amount) AS avg FROM orders o WHERE o.status = 'OPEN'",
    fakeRunQuery,
    { length: 10, offset: 0 },
  );
  assert.deepEqual(result.rows[0], { TOTAL: '370', LO: '70', HI: '200', AVG: '123.33333333333333' });
});

test('compile: IN ( SELECT … ) subquery resolves then filters', async () => {
  const result = await compileAndRun(
    "SELECT o.id, o.cust FROM orders o WHERE o.cust IN ( SELECT c.id FROM customers c WHERE c.name = 'BETA' ) ORDER BY o.id",
    fakeRunQuery,
    { length: 10, offset: 0 },
  );
  assert.deepEqual(result.rows, [{ ID: '3', CUST: 'C2' }]);
  // The subquery ran as its own statement.
  assert.ok(result.executedSqls.some((s) => /FROM CUSTOMERS/.test(s) && /NAME = 'BETA'/.test(s)));
});

test('compile: offset/length window + more-rows note', async () => {
  const result = await compileAndRun(
    'SELECT o.id FROM orders o ORDER BY o.id ASC',
    fakeRunQuery,
    { length: 2, offset: 1 },
  );
  assert.deepEqual(result.rows.map((r) => r.ID), ['2', '3']);
  assert.ok(result.notes.some((n) => /raise offset to 3/.test(n)));
});

test('compile: LIKE and IN-list predicates survive the pipeline', async () => {
  const result = await compileAndRun(
    "SELECT o.id FROM orders o WHERE o.status IN ('OPEN', 'CLOSED') AND o.cust LIKE 'C1%' ORDER BY o.id",
    fakeRunQuery,
    { length: 10, offset: 0 },
  );
  assert.deepEqual(result.rows.map((r) => r.ID), ['1', '2']);
});

test('compile: DISTINCT dedupes output rows', async () => {
  const result = await compileAndRun(
    'SELECT DISTINCT o.status FROM orders o ORDER BY o.status',
    fakeRunQuery,
    { length: 10, offset: 0 },
  );
  assert.deepEqual(result.rows.map((r) => r.STATUS), ['CLOSED', 'OPEN']);
});
