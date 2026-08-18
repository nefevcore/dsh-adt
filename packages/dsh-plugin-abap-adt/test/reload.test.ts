import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { builtinDefaults, type PluginConfig } from '../lib/config.js';

const dest = (name: string, overrides: Record<string, unknown> = {}) =>
  ({ name, url: `https://${name}.example.com`, strictSSL: true, timeoutMs: 60_000, ...overrides }) as never;

// ---------------------------------------------------------------------------
// AdtRegistry.reload (settings hot reload)
// ---------------------------------------------------------------------------

test('reload: swaps destinations and policy in place', async () => {
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false, destinations: [dest('a')] });
  try {
    assert.deepEqual([...registry.destinations.keys()], ['a']);
    const before = registry.policy;
    await registry.reload({
      ...builtinDefaults(),
      demo: false,
      defaultDestination: 'b',
      destinations: [dest('b')],
      allowedPackages: 'Z*',
    });
    assert.deepEqual([...registry.destinations.keys()], ['b']);
    assert.equal(registry.defaultName, 'b');
    assert.notEqual(registry.policy, before, 'policy instance is swapped');
  } finally {
    await registry.dispose();
  }
});

test('reload: demo on starts the mock, demo off closes it', async () => {
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0 });
  try {
    assert.equal(registry.destinations.has('demo'), true);
    await registry.reload({ ...builtinDefaults(), demo: false });
    assert.equal(registry.destinations.has('demo'), false);
    await registry.reload({ ...builtinDefaults(), demo: true, demoPort: 0 });
    assert.equal(registry.destinations.has('demo'), true);
  } finally {
    await registry.dispose();
  }
});

test('reload: keeps object identity so tool references stay live', async () => {
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const captured = registry;
    await registry.reload({ ...builtinDefaults(), demo: false, destinations: [dest('x')] });
    assert.equal(captured, registry);
  } finally {
    await registry.dispose();
  }
});

// ---------------------------------------------------------------------------
// LockLedger storages location + legacy migration
// ---------------------------------------------------------------------------

test('LockLedger: lives under storages/ and migrates a legacy ledger once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-ledger-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  try {
    const legacy = join(dir, 'abap-adt-locks.json');
    const modern = join(dir, 'storages', 'abap-adt-locks.json');
    writeFileSync(legacy, JSON.stringify({ version: 1, entries: [{ id: 'e1', destination: 'demo', uri: '/u', acquiredAt: 'now' }] }), 'utf8');

    const ledger = new LockLedger();
    assert.equal(existsSync(modern), true, 'legacy ledger moved into storages/');
    assert.equal(ledger.forDestination('demo').length, 1);
    // Second construction does not resurrect or duplicate anything.
    const again = new LockLedger(modern);
    assert.equal(again.forDestination('demo').length, 1);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
