import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { DebuggerManager } from '../lib/debugger.js';
import { builtinDefaults } from '../lib/config.js';
import { AdtPolicyError } from '../lib/policy.js';
import { cochangeTools } from '../lib/tools/cochange.js';

/**
 * adt_cochange (P1-4): transport co-occurrence over the version-feed +
 * transport-item data faces, ranked by shared transports, with the
 * truncation/gap discipline (notes name every bound and every unreadable
 * input) and the enableTransports gate.
 */

const exec = { signal: undefined } as never;

let registry: AdtRegistry;
let lockedRegistry: AdtRegistry; // transports disabled

before(async () => {
  registry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0 });
  lockedRegistry = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    enableTransports: false,
  });
});

after(async () => {
  await registry.dispose();
  await lockedRegistry.dispose();
});

test('adt_cochange: ranks co-occurring objects by shared transports', async () => {
  const by = new Map(
    cochangeTools({ registry, ledger: new LockLedger(), debugger: new DebuggerManager(registry) }).map((t) => [
      t.name,
      t,
    ]),
  );
  // ZCL_DEMO's version feed points at S4HK900001; the mock's transport items
  // are the first three objects — the two non-input ones co-occur.
  const result = await by.get('adt_cochange')!.execute({ objects: [{ name: 'ZCL_DEMO', type: 'CLAS' }] }, exec);
  assert.deepEqual(result.inputs, ['ZCL_DEMO']);
  assert.deepEqual(result.analyzedTransports, ['S4HK900001']);
  const names = result.coChanges.map((row) => row.name);
  assert.ok(!names.includes('ZCL_DEMO'), 'inputs never co-occur with themselves');
  assert.ok(names.length >= 1, `expected co-changes, got ${JSON.stringify(result.coChanges)}`);
  for (const row of result.coChanges) {
    assert.equal(row.sharedTransports, 1);
    assert.deepEqual(row.transports, ['S4HK900001']);
  }
  // Ranked descending by shared count.
  const counts = result.coChanges.map((row) => row.sharedTransports);
  assert.deepEqual([...counts].sort((a, b) => b - a), counts);

  // Bound + truncation note: top=1 keeps one row and says what was cut.
  const capped = await by.get('adt_cochange')!.execute(
    { objects: [{ name: 'ZCL_DEMO', type: 'CLAS' }], top: 1 },
    exec,
  );
  assert.equal(capped.coChanges.length, 1);
  assert.match(capped.note!, /showing 1 of \d+; raise top/);
  assert.equal(capped.totalCandidates, result.coChanges.length);
});

test('adt_cochange: enableTransports=false refuses (transport numbers leak)', async () => {
  const by = new Map(
    cochangeTools({ registry: lockedRegistry, ledger: new LockLedger(), debugger: new DebuggerManager(lockedRegistry) }).map(
      (t) => [t.name, t],
    ),
  );
  await assert.rejects(
    () => by.get('adt_cochange')!.execute({ objects: [{ name: 'ZCL_DEMO' }] }, exec),
    (error: unknown) => {
      assert.ok(error instanceof AdtPolicyError);
      assert.equal(error.rule, 'enableTransports');
      return true;
    },
  );
});

test('adt_cochange: empty input list and >10 entries are refused', async () => {
  const by = new Map(
    cochangeTools({ registry, ledger: new LockLedger(), debugger: new DebuggerManager(registry) }).map((t) => [
      t.name,
      t,
    ]),
  );
  await assert.rejects(() => by.get('adt_cochange')!.execute({ objects: [] }, exec), /1\.\.10/);
  const eleven = Array.from({ length: 11 }, (_, i) => ({ name: `ZOBJ_${i}` }));
  await assert.rejects(() => by.get('adt_cochange')!.execute({ objects: eleven }, exec), /1\.\.10/);
});
