import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffLines, unifiedDiff } from '../lib/tools/versions.js';

test('diffLines: identical inputs produce only context ops', () => {
  const ops = diffLines('a\nb\nc\n', 'a\nb\nc\n');
  assert.equal(ops.some((o) => o.kind !== '='), false);
  assert.equal(ops.length, 4); // trailing newline → empty last line
});

test('diffLines: single line change', () => {
  const ops = diffLines('a\nb\nc\n', 'a\nX\nc\n');
  const removed = ops.filter((o) => o.kind === '-');
  const added = ops.filter((o) => o.kind === '+');
  assert.equal(removed.length, 1);
  assert.equal(added.length, 1);
  assert.equal(removed[0]?.line, 'b');
  assert.equal(added[0]?.line, 'X');
});

test('diffLines: insert at the end (prefix trim)', () => {
  const ops = diffLines('a\n', 'a\nb\nc\n');
  assert.equal(ops.filter((o) => o.kind === '+').length, 2);
  const del = diffLines('a\nb\nc\n', 'a\n');
  assert.equal(del.filter((o) => o.kind === '-').length, 2);
});

test('unifiedDiff: identical sources produce empty diff', () => {
  assert.equal(unifiedDiff('x\ny\n', 'x\ny\n'), '');
});

test('unifiedDiff: produces a parsable hunk with headers and +/- lines', () => {
  const from = ['line1', 'line2', 'line3', 'line4', 'line5'].join('\n');
  const to = ['line1', 'CHANGED', 'line3', 'line4', 'line5', 'NEW'].join('\n');
  const diff = unifiedDiff(from, to);
  assert.match(diff, /^@@ -\d+,\d+ \+\d+,\d+ @@/m);
  assert.match(diff, /^-line2/m);
  assert.match(diff, /^\+CHANGED/m);
  assert.match(diff, /^\+NEW/m);
  // context lines are prefixed with a space
  assert.match(diff, /^ line1$/m);
});

test('unifiedDiff: large fallback path still produces a diff', () => {
  const bigA = Array.from({ length: 4000 }, (_, i) => `line${i}`).join('\n');
  const bigB = `${bigA}\nextra`;
  const diff = unifiedDiff(bigA, bigB);
  assert.match(diff, /^\+extra/m);
});
