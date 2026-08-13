/**
 * Smoke test: exercise the ADT protocol client against a running ADT server.
 * Defaults to the in-process mock started by the dsh web profile (port 8123);
 * point ADT_URL/ADT_USER/ADT_PASSWORD at a real system to smoke-test that.
 */
import { AdtClient } from '@abap-adt/protocol';

const url = process.env.ADT_URL ?? 'http://127.0.0.1:8123';
const username = process.env.ADT_USER ?? 'demo';
const password = process.env.ADT_PASSWORD ?? 'demo';

const client = new AdtClient({
  name: 'smoke',
  url,
  client: '000',
  language: 'EN',
  auth: { type: 'basic', username, password },
  timeoutMs: 30_000,
});

const step = (name, fn) => fn()
  .then((r) => { console.log(`✔ ${name}`); return r; })
  .catch((e) => { console.error(`✘ ${name}: ${e.message}`); process.exitCode = 1; });

await step('ping', async () => {
  const r = await client.ping();
  if (!r.ok) throw new Error(r.detail);
});

await step('discover', async () => {
  const d = await client.discover();
  if (d.services.length === 0) throw new Error('no services advertised');
});

await step('search objects ZCL_*', async () => {
  const hits = await client.searchObjects('ZCL_*');
  if (!hits.some((h) => h.objectName === 'ZCL_DEMO')) throw new Error('ZCL_DEMO not found');
});

await step('read source ZCL_DEMO', async () => {
  const src = await client.readSource('/sap/bc/adt/oo/classes/zcl_demo');
  if (!src.source.includes('CLASS zcl_demo')) throw new Error('source mismatch');
});

await step('lock→write→unlock', async () => {
  const uri = '/sap/bc/adt/oo/classes/zcl_demo';
  const before = await client.readSource(uri);
  const { handle } = await client.lock(uri);
  await client.writeSource(uri, before.source, { lockHandle: handle });
  await client.unlock(uri, handle);
});

await step('activate ZCL_DEMO', async () => {
  const r = await client.activate([{ uri: '/sap/bc/adt/oo/classes/zcl_demo', type: 'CLAS/OC', name: 'ZCL_DEMO' }]);
  if (!r.success) throw new Error(JSON.stringify(r.items));
});

await step('check reports syntax error (non-destructive)', async () => {
  const created = await client.createObject({
    destination: 'smoke',
    type: 'CLAS',
    name: 'ZCL_SMOKEBROKEN',
    description: 'smoke broken',
    packageName: 'ZPACK_DEMO',
  });
  if (!created.success || !created.uri) throw new Error('create failed');
  try {
    await client.updateSource(created.uri, 'CLASS zcl_smokebroken DEFINITION PUBLIC CREATE PUBLIC.\n  ZBROKEN.\nENDCLASS.\n');
    const r = await client.check([{ uri: created.uri, type: 'CLAS/OC', name: 'ZCL_SMOKEBROKEN' }]);
    if (r.success) throw new Error('expected check failure');
  } finally {
    await client.deleteObject(created.uri).catch(() => undefined);
  }
});

await step('unit tests ZCL_DEMO', async () => {
  const r = await client.runUnitTests([{ uri: '/sap/bc/adt/oo/classes/zcl_demo', type: 'CLAS/OC', name: 'ZCL_DEMO' }]);
  if (!r.success) throw new Error(`overall=${r.overall}`);
});

await step('ATC on package members', async () => {
  const r = await client.runAtc([
    { uri: '/sap/bc/adt/oo/classes/zcl_demo', type: 'CLAS/OC', name: 'ZCL_DEMO' },
    { uri: '/sap/bc/adt/programs/programs/zprog_demo', type: 'PROG/P', name: 'ZPROG_DEMO' },
  ]);
  if (r.clean) throw new Error('expected findings');
});

await step('transports', async () => {
  const list = await client.listTransports();
  if (!list.length) throw new Error('no transports');
  await client.getTransport(list[0].number);
});

await step('package content ZPACK_DEMO', async () => {
  const members = await client.packageContent('ZPACK_DEMO');
  if (!members.some((m) => m.name === 'ZCL_DEMO')) throw new Error('ZCL_DEMO missing');
});

await step('create + delete object', async () => {
  const created = await client.createObject({
    destination: 'smoke',
    type: 'CLAS',
    name: 'ZCL_SMOKE',
    description: 'smoke',
    packageName: 'ZPACK_DEMO',
  });
  if (!created.success || !created.uri) throw new Error('create failed');
  await client.deleteObject(created.uri);
});

console.log(process.exitCode ? '\nSMOKE FAILED' : '\nSMOKE PASSED (all steps)');
