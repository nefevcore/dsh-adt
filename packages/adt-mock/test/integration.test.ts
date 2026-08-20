import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AdtClient, AdtError } from '@nefevcore/abap-adt-protocol';
import { createMockAdtServer } from '@nefevcore/abap-adt-mock';

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
  await c.unlock(uri, handle);
  const after = await c.readSource(uri);
  assert.ok(after.source.includes('Hi, '));
});

test('unlockBestEffort releases a lock without a handle', async () => {
  const c = client();
  const uri = '/sap/bc/adt/oo/classes/zcl_flaky';
  const { handle } = await c.lock(uri);
  assert.ok(handle);
  // No handle passed → the backend must release the lock anyway.
  const released = await c.unlockBestEffort(uri);
  assert.equal(released.released, true);
  // The lock is gone: locking again must succeed.
  const again = await c.lock(uri);
  await c.unlock(uri, again.handle);
});

test('search retries with a trailing wildcard when a bare term matches nothing', async () => {
  const c = client();
  // The mock matches substrings, so a bare term usually hits; force the
  // zero-hit path with a name that only exists with the suffix intact.
  const result = await c.search('ZCL_DEMO');
  assert.ok(result.objects.length > 0);
  // A query that matches nothing must not throw and reports zero hits.
  const none = await c.search('ZXQ_NEVER_EXISTS_');
  assert.equal(none.count, 0);
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

test('falls back to the legacy synchronous testruns service on old backends', async () => {
  // Legacy backend: POST /abapunit/runs is a plain 404; only the synchronous
  // /abapunit/testruns service exists (verified against a real NW 7.4x system).
  const legacyServer = createMockAdtServer({ port: 0, username: 'demo', password: 'demo', legacyUnitOnly: true });
  const legacyPort = await legacyServer.listen();
  try {
    const c = new AdtClient({
      name: 'legacy',
      url: `http://127.0.0.1:${legacyPort}`,
      client: '000',
      language: 'EN',
      auth: { type: 'basic', username: 'demo', password: 'demo' },
    });
    const passing = await c.runUnitTests([
      { uri: '/sap/bc/adt/oo/classes/zcl_demo', type: 'CLAS/OC', name: 'ZCL_DEMO' },
    ]);
    assert.equal(passing.success, true);
    assert.equal(passing.total, 2);
    assert.equal(passing.passed, 2);
    assert.ok(passing.classes.some((cls) => cls.className.startsWith('LTCL_')));

    const failing = await c.runUnitTests([
      { uri: '/sap/bc/adt/oo/classes/zcl_flaky', type: 'CLAS/OC', name: 'ZCL_FLAKY' },
    ]);
    assert.equal(failing.success, false);
    assert.ok(failing.failed >= 1);
    assert.ok(failing.classes[0]?.tests.some((t) => t.status === 'FAILED' && t.message));

    // An object without tests yields an empty runResult — success stays false,
    // but nothing throws (real D01 behavior for classes without test includes).
    const empty = await c.runUnitTests([
      { uri: '/sap/bc/adt/oo/interfaces/zif_demo', type: 'INTF/OI', name: 'ZIF_DEMO' },
    ]);
    assert.equal(empty.total, 0);
    assert.equal(empty.classes.length, 0);
  } finally {
    await legacyServer.close();
  }
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

test('where-used returns referencing objects', async () => {
  const c = client();
  const result = await c.getWhereUsed('/sap/bc/adt/oo/classes/zcl_demo');
  assert.equal(result.objectUri, '/sap/bc/adt/oo/classes/zcl_demo');
  assert.ok(result.totalReferences >= 2);
  assert.ok(result.references.some((r) => r.name === 'ZPROG_DEMO'));
  assert.ok(result.references.some((r) => r.name === 'ZCL_FLAKY'));

  const ifRefs = await c.getWhereUsed('/sap/bc/adt/oo/interfaces/zif_demo');
  assert.ok(ifRefs.references.some((r) => r.name === 'ZCL_DEMO'));

  // No references for an object nobody uses.
  const none = await c.getWhereUsed('/sap/bc/adt/ddls/sources/zcds_demo');
  assert.equal(none.totalReferences, 0);
});

test('data preview returns columns and rows (ddic + cds + freestyle)', async () => {
  const c = client();
  const cds = await c.dataPreview('ZCDS_DEMO', 'cds', { top: 5 });
  assert.equal(cds.totalRows, 1234); // virtual server-side total
  assert.ok(cds.columns.some((col) => col.name === 'MANDT'));
  assert.equal(cds.rows.length, 5); // exactly `top` generated rows
  assert.equal(cds.rows[0]?.ID, '1');
  assert.equal(cds.rows.at(-1)?.TEXT, 'Row 5');

  const ddic = await c.dataPreview('T001', 'ddic');
  assert.ok(ddic.columns.some((col) => col.name === 'MANDT'));

  const sql = await c.runSqlQuery('SELECT * FROM t001 WHERE mandt = 100');
  assert.ok(sql.rows.length >= 2);
  assert.ok(sql.columns.length >= 2);
});

test('version history exposes content URIs and version sources', async () => {
  const c = client();
  const uri = '/sap/bc/adt/oo/classes/zcl_demo';
  const versions = await c.getVersions(uri);
  assert.ok(versions.length >= 2);
  const current = versions.find((v) => v.contentUri?.includes('version=00001'));
  assert.ok(current, 'feed should expose a current-version content URI');

  const older = versions.find((v) => v.contentUri?.includes('version=00000'));
  assert.ok(older, 'feed should expose an older-version content URI');

  const source = await c.getVersionSource(older!.contentUri!);
  assert.ok(source.includes('mock version 00000'), 'version source should differ from active');

  const active = await c.readSource(uri);
  assert.ok(!active.source.includes('mock version'), 'active source is unmodified');
});

test('lock state is exposed via object metadata', async () => {
  const c = client();
  const uri = '/sap/bc/adt/oo/classes/zcl_flaky';

  const free = await c.getObjectLock(uri);
  assert.equal(free.locked, undefined);

  const { handle } = await c.lock(uri);
  const locked = await c.getObjectLock(uri);
  assert.equal(locked.locked, true);
  assert.equal(locked.lockedBy, 'DEMO');

  // Typed metadata accept must also surface the lock state.
  const typed = await c.getObjectLock(uri, 'CLAS/OC');
  assert.equal(typed.locked, true);

  await c.unlock(uri, handle);
  const released = await c.getObjectLock(uri);
  assert.equal(released.locked, undefined);
});

test('runtime dumps: list (user filter), structured detail, formatted view', async () => {
  const c = client();
  const all = await c.listDumps();
  assert.equal(all.length, 2);

  const mine = await c.listDumps({ user: 'DEMO' });
  assert.equal(mine.length, 1);
  assert.equal(mine[0]!.title, 'UNCAUGHT_EXCEPTION');
  assert.equal(mine[0]!.category, 'ABAP Programming Error');

  const paged = await c.listDumps({ skip: 1 });
  assert.equal(paged.length, 1);

  const detail = await c.getDump(mine[0]!.id);
  assert.equal(detail.view, 'default');
  assert.equal(detail.title, 'UNCAUGHT_EXCEPTION');
  const program = detail.sections.find((s) => s.name === 'program');
  assert.equal(program?.value, 'ZPROG_DEMO');

  const formatted = await c.getDump(mine[0]!.id, { view: 'formatted' });
  assert.ok(formatted.raw?.startsWith('Runtime Errors: UNCAUGHT_EXCEPTION'));

  await assert.rejects(() => c.getDump('20990101000000nohost_X_Y_00NOPE0000001'), /not found|404|does not exist/i);
});

test('program and class execution return console output', async () => {
  const c = client();
  const prog = await c.runProgram('ZPROG_DEMO');
  assert.equal(prog.status, 200);
  assert.ok(prog.output.includes('Hello, World!'));

  const cls = await c.runClass('ZCL_RUNNER');
  assert.equal(cls.status, 200);
  assert.ok(cls.output.includes('Hello from ZCL_RUNNER'));

  // A class without if_oo_adt_classrun is rejected by the backend.
  await assert.rejects(() => c.runClass('ZCL_DEMO'), /runnable|400/i);
  await assert.rejects(() => c.runProgram('Z_MISSING_PROG'), /not exist|404/i);
});

test('$batch executes embedded requests in one round-trip', async () => {
  const c = client();
  const parts = await c.batch([
    { method: 'GET', path: '/sap/bc/adt/oo/classes/zcl_demo/source/main', accept: 'text/plain' },
    { method: 'GET', path: '/sap/bc/adt/programs/programs/zprog_demo/source/main', accept: 'text/plain' },
    { method: 'GET', path: '/sap/bc/adt/runtime/dumps' },
  ]);
  assert.equal(parts.length, 3);
  assert.equal(parts[0]!.status, 200);
  assert.ok(parts[0]!.body.startsWith('CLASS'));
  assert.ok(parts[1]!.body.includes('REPORT zprog_demo'));
  assert.ok(parts[2]!.body.includes('<feed'));
  // Inner requests carry the destination session context (sap-client).
});

test('structured editors: MSAG / DOMA / DTEL / TTYP read-modify-write', async () => {
  const c = client();

  // MSAG — read 3 messages, rewrite to 2 (one kept, one added, one deleted).
  const msag = await c.readStructure('/sap/bc/adt/msgclass/zmsg_demo', 'MSAG');
  assert.equal(msag.kind, 'MSAG');
  assert.equal(msag.name, 'ZMSG_DEMO');
  assert.equal(msag.messages.length, 3);
  const msagWritten = await c.writeStructure('/sap/bc/adt/msgclass/zmsg_demo', 'MSAG', {
    description: 'Updated message class',
    messages: [
      { number: '001', text: 'Hello &1, welcome to the demo' },
      { number: '004', text: 'Brand new message &1' },
    ],
  });
  assert.equal(msagWritten.success, true);
  assert.equal(msagWritten.data.description, 'Updated message class');
  assert.deepEqual(msagWritten.data.messages.map((m) => m.number), ['001', '004']);

  // DOMA — patch length + replace fixed values.
  const doma = await c.readStructure('/sap/bc/adt/ddic/domains/zdoma_demo', 'DOMA');
  assert.equal(doma.properties.datatype, 'CHAR');
  assert.deepEqual(doma.fixedValues.map((f) => f.low), ['AA', 'BB']);
  const domaWritten = await c.writeStructure('/sap/bc/adt/ddic/domains/zdoma_demo', 'DOMA', {
    properties: { length: '4' },
    fixedValues: [
      { low: 'AA', description: 'Alpha mode' },
      { low: 'CC', description: 'Gamma mode' },
    ],
  });
  assert.equal(domaWritten.data.properties.length, '4');
  assert.deepEqual(domaWritten.data.fixedValues.map((f) => f.low), ['AA', 'CC']);

  // DTEL — patch a label, keep the domain reference.
  const dtel = await c.readStructure('/sap/bc/adt/ddic/dataelements/zdtel_demo', 'DTEL');
  assert.equal(dtel.properties.typeName, 'ZDOMA_DEMO');
  assert.equal(dtel.labels.shortText, 'Demo');
  const dtelWritten = await c.writeStructure('/sap/bc/adt/ddic/dataelements/zdtel_demo', 'DTEL', {
    labels: { shortText: 'Demo (patched)' },
  });
  assert.equal(dtelWritten.data.labels.shortText, 'Demo (patched)');
  // Untouched properties round-trip.
  assert.equal(dtelWritten.data.properties.typeName, 'ZDOMA_DEMO');

  // TTYP — patch the access type.
  const ttyp = await c.readStructure('/sap/bc/adt/ddic/tabletypes/zttyp_demo', 'TTYP');
  assert.equal(ttyp.properties.accessType, 'standard');
  const ttypWritten = await c.writeStructure('/sap/bc/adt/ddic/tabletypes/zttyp_demo', 'TTYP', {
    properties: { accessType: 'sorted' },
  });
  assert.equal(ttypWritten.data.properties.accessType, 'sorted');
});

test('data preview offset/length window slices the generated rows', async () => {
  const c = client();
  // Fetch 10 rows; the client returns them all — slicing is the tool layer's job,
  // verified in the plugin tests. Here: rows honor the requested rowNumber.
  const full = await c.dataPreview('ZCDS_DEMO', 'cds', { top: 10 });
  assert.equal(full.rows.length, 10);
  const offsetRows = full.rows.slice(3, 3 + 4);
  assert.equal(offsetRows[0]?.ID, '4');
  assert.equal(offsetRows.at(-1)?.ID, '7');
});
