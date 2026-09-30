import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import type { Volatile } from '@deepseek-ai/cosmokit';
import { AdtRegistry, LockLedger, builtinDefaults, type PluginConfig } from '@nefevcore/abap-adt-core';
import { apply } from '../lib/index.js';

const dest = (name: string, overrides: Record<string, unknown> = {}) =>
  ({ name, url: `https://${name}.example.com`, strictSSL: true, timeoutMs: 60_000, ...overrides }) as never;

// ---------------------------------------------------------------------------
// AdtRegistry.reload (config hot reload)
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

test('LockLedger: persist is atomic (tmp + rename, audit D5) — no torn or leftover files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-ledger-atomic-'));
  try {
    const file = join(dir, 'storages', 'abap-adt-locks.json');
    const ledger = new LockLedger(file);
    ledger.register({ destination: 'demo', uri: '/u1', handle: 'h1' });
    ledger.register({ destination: 'demo', uri: '/u2' });
    ledger.deregister('demo', '/u1');
    // The ledger file is complete valid JSON with exactly the live entry…
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { entries: Array<{ uri: string }> };
    assert.deepEqual(parsed.entries.map((e) => e.uri), ['/u2']);
    // …and no temp files from the rename path remain behind.
    const siblings = readdirSync(dirname(file)).filter((f) => f.includes('.tmp'));
    assert.deepEqual(siblings, [], 'no .tmp leftovers from atomic persist');
    // A reload sees the same state (the rename really replaced the target).
    assert.deepEqual(new LockLedger(file).forDestination('demo').map((e) => e.uri), ['/u2']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Audit P1 regression (docs/audit-fix-plan.md): M5 demo credentials follow
// the environment, D4 a queued volatile rebuild cannot revive a disposed
// registry.
// ---------------------------------------------------------------------------

test('M5: the demo destination uses the same credentials as the mock server', async () => {
  const prevUser = process.env.ADT_MOCK_USER;
  const prevPassword = process.env.ADT_MOCK_PASSWORD;
  process.env.ADT_MOCK_USER = 'alice';
  process.env.ADT_MOCK_PASSWORD = 'wonderland';
  let registry: AdtRegistry | undefined;
  try {
    registry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0 });
    const entry = await registry.require();
    assert.equal(entry.mock, true);
    const auth = entry.config.auth as { type: string; username?: string; password?: string };
    assert.equal(auth.type, 'basic');
    assert.equal(auth.username, 'alice');
    // The pair matches on BOTH sides — a request through the demo client
    // authenticates instead of 401-ing.
    const source = await entry.client.readSource('/sap/bc/adt/oo/classes/zcl_demo');
    assert.ok(source.source.startsWith('CLASS'));
  } finally {
    if (prevUser === undefined) delete process.env.ADT_MOCK_USER;
    else process.env.ADT_MOCK_USER = prevUser;
    if (prevPassword === undefined) delete process.env.ADT_MOCK_PASSWORD;
    else process.env.ADT_MOCK_PASSWORD = prevPassword;
    await registry?.dispose();
  }
});

/**
 * Minimal plugin-level harness for the DSH ≥ 0.2.0 wiring: a fake Context
 * capturing the `loader/volatile-update` listener, plus a fake
 * `Volatile<PluginConfig>` reference whose committed snapshot the test
 * swaps — exactly what the Loader does on a volatile settings edit.
 */
interface Harness {
  dispose: () => Promise<void>;
  commit(next: PluginConfig): void;
  fireVolatileUpdate(): void;
  registered: string[];
}

async function mountHarness(initial: PluginConfig): Promise<Harness> {
  const registered: string[] = [];
  let listener: (() => void) | undefined;
  let committed = initial;
  const fakeCtx = {
    fiber: { state: 0 }, // active fiber (never "unloading")
    tools: { register: (t: { name: string }) => registered.push(t.name) },
    on: (event: string, cb: () => void) => {
      if (event === 'loader/volatile-update') listener = cb;
    },
  } as never;
  const ref: Volatile<PluginConfig> = { get: () => committed };
  const dispose = await apply(fakeCtx, ref);
  return {
    dispose,
    registered,
    commit: (next) => {
      committed = next;
    },
    fireVolatileUpdate: () => listener?.(),
  };
}

test('volatile wiring: a committed config rebuilds the registry in place', async () => {
  const infos: string[] = [];
  const originalInfo = console.info;
  console.info = ((msg: unknown, ...rest: unknown[]) => infos.push([msg, ...rest].join(' '))) as typeof console.info;
  try {
    const harness = await mountHarness({ ...builtinDefaults(), demo: false } as PluginConfig);
    try {
      assert.ok(harness.registered.length > 0, 'tools were registered');
      // A settings edit lands: the Loader commits the new snapshot behind
      // the same reference, then dispatches the event…
      harness.commit({ ...builtinDefaults(), demo: true, demoPort: 0 } as PluginConfig);
      harness.fireVolatileUpdate();
      // …and the queued rebuild runs on the microtask chain.
      await new Promise((r) => setImmediate(r));
      const applied = infos.filter((i) => i.includes('config applied'));
      assert.equal(applied.length, 1, `exactly one rebuild (got: ${applied.join(' | ')})`);
      assert.match(applied[0]!, /demo/, 'the new snapshot reached the registry');
    } finally {
      await harness.dispose();
    }
  } finally {
    console.info = originalInfo;
  }
});

test('D4: a volatile update queued behind disposal cannot revive the registry', async () => {
  const infos: string[] = [];
  const originalInfo = console.info;
  console.info = ((msg: unknown, ...rest: unknown[]) => infos.push([msg, ...rest].join(' '))) as typeof console.info;
  try {
    // Start with demo OFF; the volatile edit then flips it ON — the change
    // that would (pre-fix) restart the mock on a disposed registry.
    const harness = await mountHarness({ ...builtinDefaults(), demo: false } as PluginConfig);
    // A volatile change arrives (rebuild queued) …
    harness.commit({ ...builtinDefaults(), demo: true } as PluginConfig);
    harness.fireVolatileUpdate();
    // … and the plugin is unloaded immediately after, before the queued
    // rebuild gets to run its IO.
    await harness.dispose();
    await new Promise((r) => setImmediate(r));
    // Even a LATE change (arriving after unload) must be a no-op.
    harness.fireVolatileUpdate();
    await new Promise((r) => setImmediate(r));
    const applied = infos.filter((i) => i.includes('config applied'));
    assert.equal(applied.length, 0, `no reload may run at/after disposal (got: ${applied.join(' | ')})`);
  } finally {
    console.info = originalInfo;
  }
});
