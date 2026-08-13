import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AdtClient, AdtError } from '@abap-adt/protocol';
import { createMockAdtServer } from '@abap-adt/mock';

let server: Awaited<ReturnType<typeof createMockAdtServer>>;
let port: number;

before(async () => {
  server = createMockAdtServer({ port: 0, username: 'demo', password: 'demo' });
  port = await server.listen();
});

after(async () => {
  await server.close();
});

function client(overrides: { username?: string; password?: string; language?: string } = {}) {
  return new AdtClient({
    name: 'test',
    url: `http://127.0.0.1:${port}`,
    client: '000',
    language: overrides.language ?? 'EN',
    auth: {
      type: 'basic',
      username: overrides.username ?? 'demo',
      password: overrides.password ?? 'demo',
    },
  });
}

test('rejects bad credentials', async () => {
  const c = client({ password: 'wrong' });
  const status = await c.ping();
  assert.equal(status.ok, false);
  assert.equal(status.status, 401);
});

test('discovers services and system info', async () => {
  const c = client();
  const info = await c.systemInfo();
  assert.equal(info.systemId, 'MOCK');
  assert.equal(info.release, '757');
  assert.ok(info.serviceCount > 0);
});

test('searches objects and source', async () => {
  const c = client();
  const objects = await c.searchObjects('ZCL_DEMO');
  assert.ok(objects.some((o) => o.objectName === 'ZCL_DEMO'));

  const sources = await c.searchSource('divide');
  assert.ok(sources.some((s) => s.objectName === 'ZCL_FLAKY'));
});

test('reads object source', async () => {
  const c = client();
  const src = await c.readSource('/sap/bc/adt/oo/classes/zcl_demo');
  assert.ok(src.source.includes('CLASS zcl_demo'));
  assert.ok(src.source.includes('METHOD add'));
});

test('lock → write → unlock roundtrip', async () => {
  const c = client();
  const uri = '/sap/bc/adt/oo/classes/zcl_demo';
  const before = await c.readSource(uri);
  const { handle } = await c.lock(uri);
  assert.ok(handle);
  const newSource = before.source.replace('Hello, ', 'Hi, ');
  await c.writeSource(uri, newSource);
  await c.unlock(uri);
  const after = await c.readSource(uri);
  assert.ok(after.source.includes('Hi, '));
});

test('activation succeeds for valid objects and fails for broken source', async () => {
  const c = client();
  const ok = await c.activate([{ uri: '/sap/bc/adt/oo/classes/zcl_demo', type: 'CLAS/OC', name: 'ZCL_DEMO' }]);
  assert.equal(ok.success, true);
  assert.equal(ok.items[0]?.status, 'ACTIVATED');

  // Introduce a syntax error and activate → must fail.
  const uri = '/sap/bc/adt/programs/programs/zprog_demo';
  await c.updateSource(uri, 'REPORT zprog_demo.\nZBROKEN is not defined.');
  const bad = await c.activate([{ uri, type: 'PROG/P', name: 'ZPROG_DEMO' }]);
  assert.equal(bad.success, false);
  assert.equal(bad.items[0]?.status, 'ERROR');
});

test('syntax check reports errors without activating', async () => {
  const c = client();
  const uri = '/sap/bc/adt/programs/programs/zprog_demo';
  await c.updateSource(uri, 'REPORT zprog_demo.\nZBROKEN.');
  const result = await c.check([{ uri, type: 'PROG/P', name: 'ZPROG_DEMO' }]);
  assert.equal(result.success, false);
  assert.ok(result.messages.some((m) => m.severity === 'E'));
});

test('runs ABAP unit tests', async () => {
  const c = client();
  const result = await c.runUnitTests([
    { uri: '/sap/bc/adt/oo/classes/zcl_demo~test', type: 'CLAS/OC', name: 'ZCL_DEMO~TEST' },
  ]);
  assert.equal(result.success, true);
  assert.ok(result.total >= 1);
  assert.ok(result.passed >= 1);

  const failing = await c.runUnitTests([
    { uri: '/sap/bc/adt/oo/classes/zcl_flaky', type: 'CLAS/OC', name: 'ZCL_FLAKY' },
  ]);
  assert.equal(failing.success, false);
  assert.ok(failing.failed >= 1);
});

test('runs ATC checks', async () => {
  const c = client();
  const result = await c.runAtc([
    { uri: '/sap/bc/adt/oo/classes/zcl_demo', type: 'CLAS/OC', name: 'ZCL_DEMO' },
    { uri: '/sap/bc/adt/programs/programs/zprog_demo', type: 'PROG/P', name: 'ZPROG_DEMO' },
  ]);
  assert.equal(result.clean, false);
  assert.ok(result.findings.length >= 2);
  assert.ok(result.counts.ERROR >= 1);
});

test('lists transports and reads one with items', async () => {
  const c = client();
  const transports = await c.listTransports();
  assert.ok(transports.length >= 2);
  const t = await c.getTransport(transports[0]!.number);
  assert.ok(t.items && t.items.length > 0);
});

test('lists package content', async () => {
  const c = client();
  const members = await c.packageContent('ZPACK_DEMO');
  assert.ok(members.some((m) => m.name === 'ZCL_DEMO'));
});

test('creates and deletes an object', async () => {
  const c = client();
  const created = await c.createObject({
    destination: 'test',
    type: 'CLAS',
    name: 'ZCL_NEW_ONE',
    description: 'Created by test',
    packageName: 'ZPACK_DEMO',
  });
  assert.equal(created.success, true);
  assert.ok(created.uri);
  const src = await c.readSource(created.uri!);
  assert.ok(src.source.includes('ZCL_NEW_ONE'));

  await c.deleteObject(created.uri!);
  await assert.rejects(() => c.readSource(created.uri!), AdtError);
});

test('updateSource helper locks and unlocks', async () => {
  const c = client();
  const uri = '/sap/bc/adt/oo/interfaces/zif_demo';
  const before = await c.readSource(uri);
  await c.updateSource(uri, before.source + '\nENDINTERFACE.');
  const after = await c.readSource(uri);
  assert.ok(after.source.trimEnd().endsWith('ENDINTERFACE.'));
});

test('lists existing ATC runs and fetches one result', async () => {
  const c = client();
  const runs = await c.listAtcRuns({ createdBy: 'DEMO' });
  assert.ok(runs.length >= 2);
  const first = runs[0]!;
  assert.ok(first.displayId.length > 0);

  // Run 1 covers ZCL_FLAKY (CRITICAL) + ZPROG_DEMO (ERROR) → not clean.
  const result = await c.getAtcResult(first.displayId);
  assert.equal(result.clean, false);
  assert.ok(result.findings.length >= 2);
  assert.ok(result.counts.ERROR >= 1 || result.counts.CRITICAL >= 1);

  // Unknown display id → 404.
  await assert.rejects(() => c.getAtcResult('99999999999999999999999999999999'), AdtError);

  // Default filter (no createdBy) still returns the user's runs.
  const mine = await c.listAtcRuns();
  assert.ok(mine.length >= 1);
});
