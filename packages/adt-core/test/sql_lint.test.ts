import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintFreestyleSql, SqlLintError, MAX_SQL_LINE_LENGTH } from '../lib/tools/sql-lint.js';

/**
 * sql-lint unit tests — the dialect adapter must rewrite what the ADT
 * freestyle parser rejects in well-known forms, refuse what cannot be
 * auto-fixed, and never touch string-literal content.
 */

test('order-by-direction: DESC/ASC → DESCENDING/ASCENDING inside ORDER BY', () => {
  const r = lintFreestyleSql('SELECT * FROM t001 ORDER BY bukrs DESC, gjahr ASC');
  assert.match(r.sql, /ORDER BY bukrs DESCENDING, gjahr ASCENDING/i);
  assert.equal(r.rewrites.some((f) => f.rule === 'order-by-direction'), true);
});

test('order-by-direction: a column named "desc" elsewhere is untouched', () => {
  const r = lintFreestyleSql('SELECT descr, ascender FROM t001 WHERE descr DESC <> \'x\'');
  // "descr"/"ascender" are column names — no rewrite outside ORDER BY tail.
  assert.match(r.sql, /SELECT descr, ascender FROM t001/i);
});

test('limit-to-length: trailing LIMIT/OFFSET dropped with a note', () => {
  const r = lintFreestyleSql('SELECT * FROM t001 LIMIT 50 OFFSET 10');
  assert.doesNotMatch(r.sql, /\blimit\b/i);
  const note = r.rewrites.find((f) => f.rule === 'limit-to-length');
  assert.match(note?.detail ?? '', /LIMIT 50 OFFSET 10/);
  assert.match(note?.detail ?? '', /`length` \(50\)/);
  assert.match(note?.detail ?? '', /`offset` \(10\)/);
});

test('ne-operator: <> → != outside string literals only', () => {
  const r = lintFreestyleSql("SELECT * FROM t001 WHERE bukrs <> 'A<B>C' AND waers <> 'USD'");
  assert.doesNotMatch(r.sql, /<>/);
  assert.match(r.sql, /'A<B>C'/); // literal untouched
  assert.equal(r.rewrites.filter((f) => f.rule === 'ne-operator').length, 1);
});

test('alias-dot: NOT rewritten — selector dialects disagree per backend', () => {
  // kic-class backends expect `a.col`; IMPC-class expect `a~col`. The lint
  // sends as written; the compiler path uses bare names in generated fetches.
  const r = lintFreestyleSql('SELECT h.belnr, p.menge FROM bkpf AS h WHERE p.menge > 1.5');
  assert.match(r.sql, /h\.belnr/);
  assert.doesNotMatch(r.sql, /h~belnr/);
  assert.match(r.sql, /1\.5/); // decimals untouched
  assert.equal(r.rewrites.some((f) => f.rule === 'alias-dot'), false);
});

test('call-paren-spacing: aggregates get padded parens, IN-lists stay tight', () => {
  const r = lintFreestyleSql("SELECT COUNT(*) FROM t001 WHERE bukrs IN ('0001','0002')");
  assert.match(r.sql, /COUNT\( \* \)/i);
  // IN lists with literal members are field-proven fine tight-parened.
  assert.match(r.sql, /IN \('0001','0002'\)/);
  // Already-padded input is not double-padded.
  const r2 = lintFreestyleSql('SELECT COUNT( * ) FROM t001');
  assert.equal(r2.rewrites.some((f) => f.rule === 'call-paren-spacing'), false);
  assert.match(r2.sql, /COUNT\( \* \)/i);
});

test('long-line-wrap: overlong lines are soft-wrapped at whitespace', () => {
  const col = 'very_long_column_name_'.repeat(15); // 330 chars, one token
  const pad = 'x'.repeat(100);
  const sql = `SELECT ${col} FROM t001 WHERE bukrs = '${pad}'`;
  const r = lintFreestyleSql(sql);
  for (const line of r.sql.split('\n')) {
    assert.ok(line.length <= MAX_SQL_LINE_LENGTH, `line exceeds ${MAX_SQL_LINE_LENGTH}: ${line.length}`);
  }
  // The string literal must survive wrapping intact… except when the wrap
  // cuts INSIDE it (then the literal is broken across lines — acceptable:
  // SQL concatenates nothing, but the in-literal wrap case is exotic; the
  // test asserts the common case: break happened at a space before the literal).
  assert.match(r.sql, /'x{100}'/);
  assert.ok(r.rewrites.some((f) => f.rule === 'long-line-wrap'));
});

test('rejections: select-only / union / or-like / multi-like / double-quote / multi-statement', () => {
  assert.throws(() => lintFreestyleSql('DELETE FROM t001'), /select-only/);
  assert.throws(
    () => lintFreestyleSql("SELECT * FROM t001 WHERE a LIKE 'A%' UNION SELECT * FROM t002 WHERE b LIKE 'B%'"),
    /union/,
  );
  assert.throws(
    () => lintFreestyleSql("SELECT * FROM t001 WHERE (name LIKE 'A%' OR name LIKE 'B%')"),
    /or-like/,
  );
  assert.throws(
    () => lintFreestyleSql("SELECT * FROM t001 WHERE name LIKE 'A%' OR descr LIKE 'B%'"),
    /or-like/,
  );
  assert.throws(
    () => lintFreestyleSql("SELECT * FROM t001 WHERE name LIKE 'A%' AND city LIKE 'B%'"),
    /multi-like/,
  );
  assert.throws(() => lintFreestyleSql('SELECT * FROM t001 WHERE name = "ABC"'), /double-quote/);
  assert.throws(() => lintFreestyleSql('SELECT * FROM t001; DROP TABLE t001'), /multi-statement/);
  // Trailing ; is stripped, not fatal.
  const r = lintFreestyleSql('SELECT * FROM t001;');
  assert.match(r.sql, /FROM t001$/i);
  assert.equal(r.rewrites.some((f) => f.rule === 'trailing-semicolon'), true);
});

test('clean SQL passes through without rewrites', () => {
  const sql = "SELECT bukrs, belnr FROM bkpf WHERE bukrs = '0001' AND belnr LIKE '51%'";
  const r = lintFreestyleSql(sql);
  assert.equal(r.sql, sql);
  assert.equal(r.rewrites.length, 0);
});

test('literals are preserved verbatim by code-only rewrites', () => {
  const r = lintFreestyleSql("SELECT * FROM t001 WHERE txt <> 'a.b' AND col <> 'c~d'");
  assert.match(r.sql, /'a\.b'/);
  assert.match(r.sql, /'c~d'/);
});
