import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseSymbolsSource, parseSelectionsSource, parseHeadingsSource } from '@nefevcore/abap-adt-protocol';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { DebuggerManager } from '../lib/debugger.js';
import { builtinDefaults } from '../lib/config.js';
import { textElementTools } from '../lib/tools/textelements.js';
import { fsOpsTools } from '../lib/tools/fsops.js';

/**
 * Textpool-shaped reading of a program's text elements over the standard ADT
 * plain-text subsources. C-group consolidation (docs/tool-consolidation-plan.md
 * §4): the face lives on adt_object_read {part:'textelements'} — the engine
 * (adt_read_textelements) is assembled but NOT registered, exactly as the
 * plugin does it, and the facade tests go through the four fs_ops tools.
 */

const exec = { signal: undefined } as never;

let registry: AdtRegistry;

before(async () => {
  registry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0 });
});

after(async () => {
  await registry.dispose();
});

/** Assemble the REAL routing: textelements engine + the fs_ops facade over it. */
function facade() {
  const deps = { registry, ledger: new LockLedger(), debugger: new DebuggerManager(registry) };
  const engines = [...textElementTools(deps)];
  const engineMap = new Map(engines.map((t) => [t.name, t]));
  return new Map(fsOpsTools(deps, engineMap as never).map((t) => [t.name, t]));
}

test('parsers: the three subsources, CRLF/LF tolerant', () => {
  const symbols = parseSymbolsSource('@MaxLength:20\r\n001=Demo text symbol\r\n\r\n@MaxLength:30\r\n042=Text Symbol 042');
  assert.equal(symbols.length, 2);
  assert.deepEqual(symbols[0], { id: 'I', key: '001', entry: 'Demo text symbol', length: 20 });
  assert.equal(symbols[1]!.length, 30);
  // LF-only input survives (callers that normalize newlines).
  assert.equal(parseSymbolsSource('@MaxLength:5\nA=x').length, 1);

  const selections = parseSelectionsSource('P_DATE =Processing date\r\n\r\nSO_CARR=Carrier ID');
  assert.equal(selections.length, 2);
  assert.deepEqual(selections[0], { id: 'S', key: 'P_DATE', entry: 'Processing date' });
  assert.equal(selections[1]!.key, 'SO_CARR');

  const headings = parseHeadingsSource('listHeader=Demo list header\r\n\r\ncolumnHeader_1=Column one\r\ncolumnHeader_2=Column two');
  assert.equal(headings.length, 3);
  assert.equal(headings[0]!.id, 'H');
  assert.equal(headings[0]!.key, 'listHeader');
  assert.deepEqual(headings[2], { id: 'H', key: 'columnHeader_2', entry: 'Column two' });
});

test('adt_object_read {part:"textelements"}: reads symbols, selections and headings of the mock program', async () => {
  const by = facade();
  const result = await by.get('adt_object_read')!.execute({ type: 'PROG', name: 'ZPROG_DEMO', part: 'textelements' }, exec);
  assert.equal(result.program, 'ZPROG_DEMO');
  assert.equal(result.counts.symbols, 2);
  assert.equal(result.counts.selections, 2);
  assert.equal(result.counts.headings, 3);
  assert.equal(result.elements.length, 7);

  const byIdKey = new Map(result.elements.map((e) => [`${e.id}:${e.key}`, e]));
  assert.deepEqual(byIdKey.get('I:001'), { id: 'I', key: '001', entry: 'Demo text symbol', length: 20 });
  assert.deepEqual(byIdKey.get('S:P_DATE'), { id: 'S', key: 'P_DATE', entry: 'Processing date' });
  assert.equal(byIdKey.get('H:listHeader')!.entry, 'Demo list header');

  // The REPT alias spelling routes the same way.
  const again = await by.get('adt_object_read')!.execute({ type: 'REPT', name: 'zprog_demo', part: 'textelements' }, exec);
  assert.equal(again.elements.length, 7);

  // Non-program types are refused up front.
  await assert.rejects(
    () => by.get('adt_object_read')!.execute({ type: 'CLAS', name: 'ZCL_DEMO', part: 'textelements' }, exec),
    /PROG or REPT/,
  );
  // Unknown program: no text elements found, flagged as possibly-unknown
  // (never fabricated rows).
  const empty = await by.get('adt_object_read')!.execute({ type: 'PROG', name: 'ZPROG_MISSING_XX', part: 'textelements' }, exec);
  assert.equal(empty.elements.length, 0);
  assert.match(empty.note!, /no text elements found/);

  // part:'textelements' is a READ-only face — the other verbs refuse it.
  await assert.rejects(
    () => by.get('adt_object_edit')!.execute({ type: 'PROG', name: 'ZPROG_DEMO', part: 'textelements' }, exec),
    /read-only face/,
  );
});
