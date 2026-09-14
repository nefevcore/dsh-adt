import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AdtClient, AdtError } from '@nefevcore/abap-adt-protocol';
import { createMockAdtServer } from '@nefevcore/abap-adt-mock';

/**
 * STRICT profile integration — the mock's strict gates replay the REAL wire
 * shapes captured against the deloitte-kic S4C gateway (2026-09-14,
 * scripts/verify-p1-real.mjs evidence). These tests prove the CLIENT would
 * have FAILED against that system wherever it still speaks the legacy
 * shape — and that the real shapes DO pass. That is the mock's new job:
 * not "green at any cost" but "green only for what a real backend accepts".
 */

let server: Awaited<ReturnType<typeof createMockAdtServer>>;
let port: number;

before(async () => {
  server = createMockAdtServer({ port: 0, username: 'demo', password: 'demo', profile: 'strict' });
  port = await server.listen();
});

after(async () => {
  await server.close();
});

function client() {
  return new AdtClient({
    name: 'strict-test',
    url: `http://127.0.0.1:${port}`,
    client: '000',
    language: 'EN',
    auth: { type: 'basic', username: 'demo', password: 'demo' },
  });
}

/** Raw fetch with the session discipline the real gateway demands. */
let cookies = '';
let csrf = '';
async function raw(method: string, path: string, { accept = '*/*', ct, body }: { accept?: string; ct?: string; body?: string } = {}) {
  const headers: Record<string, string> = {
    Authorization: 'Basic ' + Buffer.from('demo:demo').toString('base64'),
    Accept: accept,
    'x-sap-adt-sessiontype': 'stateful',
    ...(csrf ? { 'x-csrf-token': csrf } : { 'x-csrf-token': 'fetch' }),
    ...(ct ? { 'Content-Type': ct } : {}),
    ...(cookies ? { Cookie: cookies } : {}),
  };
  const res = await fetch(`http://127.0.0.1:${port}${path}${path.includes('?') ? '&' : '?'}sap-client=000&sap-language=EN`, { method, headers, body });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) {
    const jar = new Map(cookies.split('; ').filter(Boolean).map((c) => {
      const eq = c.indexOf('=');
      return [c.slice(0, eq).trim(), c.slice(eq + 1)];
    }));
    for (const c of setCookie) {
      const [pair] = c.split(';');
      const eq = pair.indexOf('=');
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
    }
    cookies = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  const token = res.headers.get('x-csrf-token');
  if (token && token !== 'fetch') csrf = token;
  return { status: res.status, text: await res.text().catch(() => '') };
}

test('strict: bare application/xml on type endpoints is 406 (real gateway behavior)', async () => {
  await raw('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });
  const r = await raw('GET', '/sap/bc/adt/ddic/domains/zdoma_demo', { accept: 'application/xml' });
  assert.equal(r.status, 406);
  const ok = await raw('GET', '/sap/bc/adt/ddic/domains/zdoma_demo', { accept: 'application/vnd.sap.adt.domains.v2+xml' });
  assert.equal(ok.status, 200);
  const wildcard = await raw('GET', '/sap/bc/adt/ddic/domains/zdoma_demo', { accept: '*/*' });
  assert.equal(wildcard.status, 200);
});

test('strict: /repository/activation 404s; the compat path /activation works', async () => {
  await raw('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });
  const modern = await raw('POST', '/sap/bc/adt/repository/activation', { accept: 'application/vnd.sap.adt.activation+xml' });
  assert.equal(modern.status, 404);
  const compat = await raw('POST', '/sap/bc/adt/activation?method=activate', {
    accept: 'application/vnd.sap.adt.activation+xml',
    ct: 'application/vnd.sap.adt.activation+xml',
    body: '<?xml version="1.0"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/domains/zdoma_demo" adtcore:name="zdoma_demo" adtcore:type="DOMA/DD"/></adtcore:objectReferences>',
  });
  assert.equal(compat.status, 200);
});

test('strict: LOCK without accessMode=MODIFY is the parameter error; with it, the handle comes in asx:values', async () => {
  await raw('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });
  const missing = await raw('POST', '/sap/bc/adt/ddic/domains/zdoma_demo?_action=LOCK', { accept: 'application/vnd.sap.as+xml' });
  assert.equal(missing.status, 400);
  assert.match(missing.text, /accessMode/);
  const full = await raw('POST', '/sap/bc/adt/ddic/domains/zdoma_demo?_action=LOCK&accessMode=MODIFY', {
    accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
  });
  assert.equal(full.status, 200);
  const handle = full.text.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/)?.[1];
  assert.ok(handle, 'LOCK_HANDLE present in asx:values body');
  // cleanup: unlock (capital UNLOCK) with the handle
  const unl = await raw('POST', `/sap/bc/adt/ddic/domains/zdoma_demo?_action=UNLOCK&lockHandle=${encodeURIComponent(handle)}`, { accept: 'application/vnd.sap.as+xml' });
  assert.equal(unl.status, 200);
});

test('strict: deletion service requires the FULL /sap/bc/adt URI in the body', async () => {
  await raw('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });
  // create a disposable object first
  const created = await raw('POST', '/sap/bc/adt/ddic/domains?package=%24TMP', {
    accept: 'application/vnd.sap.adt.domains.v2+xml',
    ct: 'application/vnd.sap.adt.domains.v2+xml',
    body: `<?xml version="1.0" encoding="UTF-8"?><doma:domain xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="strict del" adtcore:language="EN" adtcore:name="ZSTRICT_DEL" adtcore:type="DOMA/DD" adtcore:masterLanguage="EN"><adtcore:packageRef adtcore:name="$TMP"/></doma:domain>`,
  });
  assert.equal(created.status, 201);
  // stripped prefix → 500 (the real gateway's application error)
  const stripped = await raw('POST', '/sap/bc/adt/deletion/delete', {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
    body: `<?xml version="1.0"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion"><del:object adtcore:uri="/ddic/domains/zstrict_del"><del:transportNumber/></del:object></del:deletionRequest>`,
  });
  assert.equal(stripped.status, 500);
  // full path → deleted
  const full = await raw('POST', '/sap/bc/adt/deletion/delete', {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
    body: `<?xml version="1.0"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion"><del:object adtcore:uri="/sap/bc/adt/ddic/domains/zstrict_del"><del:transportNumber/></del:object></del:deletionRequest>`,
  });
  assert.equal(full.status, 200);
  assert.match(full.text, /isDeleted="true"/);
});

test('strict: _action=DELETE (legacy fallback) 404s', async () => {
  await raw('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });
  const r = await raw('POST', '/sap/bc/adt/ddic/domains/zdoma_demo?_action=DELETE', { accept: 'application/xml' });
  assert.equal(r.status, 404);
});

test('strict: client.ts lock() speaks the full param form and succeeds', async () => {
  const c = client();
  // client.ts's lock() posts {uri}?_action=LOCK&accessMode=MODIFY (L813 of
  // client.ts) — exactly the deloitte form. The strict mock must accept it.
  const { handle } = await c.lock('/sap/bc/adt/ddic/domains/zdoma_demo');
  assert.ok(handle, 'handle granted on the strict shape');
  await c.unlock('/sap/bc/adt/ddic/domains/zdoma_demo', handle);
});

test('strict: full real-shape chain (create → LOCK → GET → PUT → UNLOCK → activation → deletion) passes', async () => {
  await raw('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });
  const name = 'ZSTRICT_CHAIN';
  const uri = `/sap/bc/adt/ddic/domains/${name.toLowerCase()}`;
  // create
  const created = await raw('POST', '/sap/bc/adt/ddic/domains?package=%24TMP', {
    accept: 'application/vnd.sap.adt.domains.v2+xml',
    ct: 'application/vnd.sap.adt.domains.v2+xml',
    body: `<?xml version="1.0" encoding="UTF-8"?><doma:domain xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="chain" adtcore:language="EN" adtcore:name="${name}" adtcore:type="DOMA/DD" adtcore:masterLanguage="EN"><adtcore:packageRef adtcore:name="$TMP"/></doma:domain>`,
  });
  assert.equal(created.status, 201);
  // LOCK (full param form)
  const lock = await raw('POST', `${uri}?_action=LOCK&accessMode=MODIFY`, {
    accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
  });
  assert.equal(lock.status, 200);
  const handle = lock.text.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/)![1]!;
  // GET (type-specific Accept)
  const cur = await raw('GET', uri, { accept: 'application/vnd.sap.adt.domains.v2+xml' });
  assert.equal(cur.status, 200);
  // PUT with the handle
  const put = await raw('PUT', `${uri}?lockHandle=${encodeURIComponent(handle)}`, {
    accept: 'application/vnd.sap.adt.domains.v2+xml',
    ct: 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8',
    body: cur.text.replace(/adtcore:description="[^"]*"/, 'adtcore:description="chain v2"'),
  });
  assert.equal(put.status, 200);
  // UNLOCK (capital)
  const unl = await raw('POST', `${uri}?_action=UNLOCK&lockHandle=${encodeURIComponent(handle)}`, { accept: 'application/vnd.sap.as+xml' });
  assert.equal(unl.status, 200);
  // activation (compat path)
  const act = await raw('POST', '/sap/bc/adt/activation?method=activate', {
    accept: 'application/vnd.sap.adt.activation+xml',
    ct: 'application/vnd.sap.adt.activation+xml',
    body: `<?xml version="1.0"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}" adtcore:type="DOMA/DD"/></adtcore:objectReferences>`,
  });
  assert.equal(act.status, 200);
  // deletion (full URI)
  const del = await raw('POST', '/sap/bc/adt/deletion/delete', {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
    body: `<?xml version="1.0"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion"><del:object adtcore:uri="${uri}"><del:transportNumber/></del:object></del:deletionRequest>`,
  });
  assert.equal(del.status, 200);
  assert.match(del.text, /isDeleted="true"/);
});

test('strict: stateful discipline — dropping the sessiontype header mid-chain kills the session', async () => {
  await raw('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });
  // Open the session stateful (raw() always does)…
  const ok = await raw('GET', '/sap/bc/adt/ddic/domains/zdoma_demo', { accept: 'application/vnd.sap.adt.domains.v2+xml' });
  assert.equal(ok.status, 200);
  // …then send a state-changing request WITHOUT the header (cookie kept).
  const res = await fetch(`http://127.0.0.1:${port}/sap/bc/adt/ddic/domains/zdoma_demo?_action=LOCK&accessMode=MODIFY&sap-client=000`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from('demo:demo').toString('base64'),
      Accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
      'x-csrf-token': csrf,
      Cookie: cookies,
      // NOTE: x-sap-adt-sessiontype deliberately absent.
    },
  });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /Service cannot be reached/);
});

test('strict: generic adtcore:object create body is 400 on typed collections (real gateway behavior)', async () => {
  await raw('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });
  const r = await raw('POST', '/sap/bc/adt/ddic/domains?package=%24TMP', {
    accept: 'application/vnd.sap.adt.domains.v2+xml, */*',
    ct: 'application/vnd.sap.adt.domains.v2+xml',
    body: `<?xml version="1.0" encoding="UTF-8"?><adtcore:object xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="generic" adtcore:language="EN" adtcore:name="ZSTRICT_GENERIC" adtcore:type="DOMA/DD" adtcore:masterLanguage="EN"><adtcore:packageRef adtcore:name="$TMP"/></adtcore:object>`,
  });
  assert.equal(r.status, 400);
  assert.match(r.text, /namespaced root element/);
});

test('strict: client.createObject passes the P1/P3 type chain (namespaced roots + typed Accept)', async () => {
  const c = client();
  await raw('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });
  // DCLS: acm/dcl/sources with dcl:dclSource
  const dcls = await c.createObject({
    destination: 'strict-test', type: 'DCLS', name: 'ZSTRICT_DCLS',
    description: 'strict dcls', packageName: '$TMP',
  });
  assert.equal(dcls.success, true, `DCLS create: ${JSON.stringify(dcls.messages)}`);
  assert.match(dcls.uri!, /\/acm\/dcl\/sources\/zstrict_dcls$/);
  // DDLS: /ddic/ddl/sources with ddl:ddlSource (ddlSource+xml, no v2)
  const ddls = await c.createObject({
    destination: 'strict-test', type: 'DDLS', name: 'ZSTRICT_DDLS',
    description: 'strict ddls', packageName: '$TMP',
  });
  assert.equal(ddls.success, true, `DDLS create: ${JSON.stringify(ddls.messages)}`);
  assert.match(ddls.uri!, /\/ddic\/ddl\/sources\/zstrict_ddls$/);
  // BDEF: /bo/behaviordefinitions with blue:blueSource
  const bdef = await c.createObject({
    destination: 'strict-test', type: 'BDEF', name: 'ZSTRICT_BDEF',
    description: 'strict bdef', packageName: '$TMP',
  });
  assert.equal(bdef.success, true, `BDEF create: ${JSON.stringify(bdef.messages)}`);
  assert.match(bdef.uri!, /\/bo\/behaviordefinitions\/zstrict_bdef$/);
  // SRVD: /ddic/srvd/sources with srvd:srvdSource + body sourceType attr
  const srvd = await c.createObject({
    destination: 'strict-test', type: 'SRVD', name: 'ZSTRICT_SRVD',
    description: 'strict srvd', packageName: '$TMP',
  });
  assert.equal(srvd.success, true, `SRVD create: ${JSON.stringify(srvd.messages)}`);
  assert.match(srvd.uri!, /\/ddic\/srvd\/sources\/zstrict_srvd$/);
  // Cleanup through the deletion service (the fs delete engine path).
  for (const type of ['DCLS', 'DDLS', 'BDEF', 'SRVD']) {
    const r = await raw('POST', '/sap/bc/adt/deletion/delete', {
      accept: 'application/vnd.sap.adt.deletion.response.v1+xml, */*',
      ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
      body: `<?xml version="1.0"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core"><del:object adtcore:uri="${delUri(type)}"><del:transportNumber></del:transportNumber></del:object></del:deletionRequest>`,
    });
    assert.equal(r.status, 200, `${type} delete: ${r.text.slice(0, 120)}`);
  }
});

/** Object URI by type on the strict mock (mirrors uriFor in server.ts). */
function delUri(type: string): string {
  switch (type) {
    case 'DCLS': return '/sap/bc/adt/acm/dcl/sources/zstrict_dcls';
    case 'DDLS': return '/sap/bc/adt/ddic/ddl/sources/zstrict_ddls';
    case 'BDEF': return '/sap/bc/adt/bo/behaviordefinitions/zstrict_bdef';
    case 'SRVD': return '/sap/bc/adt/ddic/srvd/sources/zstrict_srvd';
    default: return `/sap/bc/adt/repository/objects/${type.toLowerCase()}`;
  }
}
