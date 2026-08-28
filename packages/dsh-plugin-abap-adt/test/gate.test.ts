import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateGate } from '../lib/tools/gate.js';

test('aggregateGate: all stages pass → go', () => {
  const { verdict } = aggregateGate([
    { stage: 'syntax', pass: true, summary: '' },
    { stage: 'unit', pass: true, summary: '' },
    { stage: 'atc', pass: true, summary: '' },
  ]);
  assert.equal(verdict, 'go');
});

test('aggregateGate: any failure → no-go', () => {
  assert.equal(
    aggregateGate([
      { stage: 'syntax', pass: true, summary: '' },
      { stage: 'atc', pass: false, summary: '2 findings' },
    ]).verdict,
    'no-go',
  );
});

test('aggregateGate: empty stage list is not a go', () => {
  assert.equal(aggregateGate([]).verdict, 'no-go');
});

test('aggregateGate: a SKIPPED stage (service not deployed) does not veto (audit P3)', () => {
  assert.equal(
    aggregateGate([
      { stage: 'syntax', pass: true, summary: '' },
      { stage: 'atc', pass: false, skipped: true, summary: 'service not deployed (HTTP 404)' },
    ]).verdict,
    'go',
  );
  // But pass=false without skipped still vetoes.
  assert.equal(
    aggregateGate([
      { stage: 'syntax', pass: true, summary: '' },
      { stage: 'atc', pass: false, summary: 'findings' },
    ]).verdict,
    'no-go',
  );
  // Only-skipped is not an automatic pass either.
  assert.equal(
    aggregateGate([{ stage: 'atc', pass: false, skipped: true, summary: '' }]).verdict,
    'no-go',
  );
});
