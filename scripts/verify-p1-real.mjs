/**
 * P1 REAL verification, round 2 — using the official client wire forms
 * (from @mcp-abap-adt/adt-clients, cross-checked against the first round's
 * server error messages):
 *
 *   DOMA: POST /ddic/domains, CT domains.v2,  body <doma:domain>
 *   DTEL: POST /ddic/dataelements, CT dataelements.v2, body <blue:wbobj dtel>
 *   TTYP: POST /ddic/tabletypes,  CT tabletype.v1 (SINGULAR), body <ttyp:tableType>
 *   TABL: POST /ddic/tables,      CT tables.v2, body <blue:blueSource>
 *   DDLS: POST /ddic/ddl/sources (NOT ddls/sources!), CT ddlSource, body <ddl:ddlSource>
 *
 * Flow per type: create → lock → GET → PUT (edit) → unlock → activate →
 * read back → delete. Every step logged as evidence.
 */
const [url, client, user, password, pkg = '$TMP', language = 'EN'] = process.argv.slice(2);
const auth = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// Stable connection id — SAP's ICM associates the STATEFUL session with this
// header (client.ts sends one per connection; without it every request opens
// its own session and LOCK handles die between calls).
const CONNECTION_ID = crypto.randomUUID();

const run = String(Date.now() % 1_000_000).padStart(6, '0');
const N = (p) => `Z${p}_${run}`;
let cookies = '';
let csrf = '';

async function req(method, path, { accept = 'application/xml', ct, body, query = '', stateful = true } = {}) {
  // Path may already carry its own query (?_action=LOCK…) — append with the
  // correct separator, never a second '?'.
  // EVERY request is stateful (probe12 finding): the session must be
  // authenticated from the first discovery on; a stateless phase followed by
  // a stateful LOCK opens an ANON sap-contextid that kills the session.
  const sep = path.includes('?') ? '&' : '?';
  const q = query ? `${sep}${query}&sap-client=${client}&sap-language=${language}` : `${sep}sap-client=${client}&sap-language=${language}`;
  const headers = {
    Authorization: auth,
    Accept: accept,
    'sap-adt-connection-id': CONNECTION_ID,
    ...(ct ? { 'Content-Type': ct } : {}),
    ...(stateful ? { 'x-sap-adt-sessiontype': 'stateful' } : {}),
    ...(csrf ? { 'x-csrf-token': csrf } : { 'x-csrf-token': 'fetch' }),
  };
  if (cookies) headers.Cookie = cookies;
  const res = await fetch(`${url}${path}${q}`, { method, headers, body });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) {
    // MERGE into a jar of SEPARATED key/value pairs (storing whole pairs
    // doubles the key on rebuild — `k=k=v` — which kills the session cookie).
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
  const text = await res.text().catch(() => '');
  return { status: res.status, text, headers: res.headers };
}

const ADTC = 'http://www.sap.com/adt/core';
const evidence = [];
function record(type, verb, ok, detail) {
  evidence.push({ type, verb, ok, detail: String(detail).slice(0, 220) });
  console.log(`${ok ? '✅' : '❌'} ${type.padEnd(5)} ${verb.padEnd(16)} ${String(detail).slice(0, 170)}`);
}
async function step(type, verb, fn) {
  try {
    const d = await fn();
    record(type, verb, true, d ?? 'ok');
    return true;
  } catch (e) {
    record(type, verb, false, e.message);
    return false;
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// CSRF bootstrap: stateful from the FIRST request (probe12: the whole chain
// shares one authenticated stateful session; mixing stateless+stateful opens
// an ANON sap-contextid that the next request kills).
{
  const r = await req('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });
  console.log(`# bootstrap: discovery GET ${r.status}, csrf=${csrf ? 'yes' : 'no'}, cookies=${cookies ? 'yes' : 'no'}`);
  if (!csrf || !cookies) {
    throw new Error(`bootstrap failed — no csrf token (${csrf ? 'got' : 'missing'}) or session cookie`);
  }
}

/** Lock/unlock — PROVEN wire form (official client): POST {uri}?_action=LOCK
 * &accessMode=MODIFY in a STATEFUL session, handle in asx:values/LOCK_HANDLE.
 * PUT carries ?lockHandle= (same stateful session). Unlock via
 * _action=UNLOCK&lockHandle= (capital UNLOCK). */
async function lock(uri) {
  const r = await req('POST', `${uri}?_action=LOCK&accessMode=MODIFY`, {
    accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
    stateful: true,
  });
  if (r.status === 404 || r.status === 405) return { handle: undefined, corrnr: undefined, lockless: true };
  assert(r.status === 200, `lock ${r.status}: ${r.text.slice(0, 150)}`);
  const handle = r.text.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/)?.[1] ?? r.text.match(/lockHandle="([^"]+)"/)?.[1];
  const corrnr = r.text.match(/<CORRNR>([^<]+)<\/CORRNR>/)?.[1] ?? r.text.match(/CORRNR="([^"]+)"/)?.[1];
  return { handle, corrnr, lockless: false };
}
async function unlock(uri, handle) {
  if (!handle) return;
  // Accept the lock media type (probe10: UNLOCK + this Accept = 200).
  const r = await req('POST', `${uri}?_action=UNLOCK&lockHandle=${encodeURIComponent(handle)}`, {
    accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
    stateful: true,
  });
  if (r.status >= 400) console.log(`  (unlock ${r.status})`);
}

// ---------------------------------------------------------------- DOMA
{
  const name = N('DOMA');
  const uri = `/sap/bc/adt/ddic/domains/${name.toLowerCase()}`;
  let handle;
  await step('DOMA', 'create', async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?><doma:domain xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="${ADTC}" adtcore:description="fsops verify" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="DOMA/DD" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></doma:domain>`;
    const r = await req('POST', '/sap/bc/adt/ddic/domains', { ct: 'application/vnd.sap.adt.domains.v2+xml', accept: 'application/vnd.sap.adt.domains.v2+xml', body, query: `package=${encodeURIComponent(pkg)}` });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 200)}`);
    return `created ${r.status}`;
  });
  await step('DOMA', 'read', async () => {
    const r = await req('GET', uri, { accept: 'application/vnd.sap.adt.domains.v2+xml' });
    assert(r.status === 200, `GET ${r.status}: ${r.text.slice(0, 200)}`);
    return r.text.includes('doma:domain') ? 'structured XML ok' : r.text.slice(0, 100);
  });
  await step('DOMA', 'lock+edit', async () => {
    const l = await lock(uri);
    handle = l.handle;
    const cur = await req('GET', uri, { accept: 'application/vnd.sap.adt.domains.v2+xml', stateful: true });
    const next = cur.text.replace(/adtcore:description="[^"]*"/, 'adtcore:description="fsops verify v2"');
    const r = await req('PUT', uri, { ct: 'application/vnd.sap.adt.domains.v2+xml', accept: 'application/vnd.sap.adt.domains.v2+xml', stateful: true, body: next, query: handle ? `lockHandle=${handle}` : '' });
    await unlock(uri, handle);
    assert(r.status === 200 || r.status === 204, `PUT ${r.status}: ${r.text.slice(0, 200)}`);
    return 'RMW ok';
  });
  await step('DOMA', 'ddl-probe', async () => {
    const r = await req('GET', `${uri}/source/main`, { accept: '*/*' });
    if (r.status === 404) return 'no DDL source form (expected on this release)';
    assert(r.status === 200, `GET ${r.status}`);
    return `DDL form exists! ${r.text.split('\n').length} lines`;
  });
  await step('DOMA', 'activate', async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="${ADTC}"><adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}" adtcore:type="DOMA/DT"/></adtcore:objectReferences>`;
    const r = await req('POST', '/sap/bc/adt/activation', { ct: 'application/vnd.sap.adt.activation+xml', accept: 'application/vnd.sap.adt.activation+xml', body, query: 'method=activate&preauditRequested=true' });
    assert(r.status === 200 && !/severity="E"/.test(r.text), `${r.status}: ${r.text.slice(0, 250)}`);
    return 'activated';
  });
  await step('DOMA', 'delete', async () => {
    const r = await req('POST', '/sap/bc/adt/deletion/delete', {
      ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
      accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="${ADTC}"><del:object adtcore:uri="${uri}"><del:transportNumber></del:transportNumber></del:object></del:deletionRequest>`,
    });
    assert(r.status >= 200 && r.status < 300, `delete ${r.status}: ${r.text.slice(0, 200)}`);
    return 'deleted';
  });
}

// ---------------------------------------------------------------- DTEL
{
  const name = N('DTEL');
  const uri = `/sap/bc/adt/ddic/dataelements/${name.toLowerCase()}`;
  let handle;
  await step('DTEL', 'create', async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?><blue:wbobj xmlns:blue="http://www.sap.com/wbobj/dictionary/dtel" xmlns:adtcore="${ADTC}" adtcore:description="fsops verify" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="DTEL/DE" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></blue:wbobj>`;
    const r = await req('POST', '/sap/bc/adt/ddic/dataelements', { ct: 'application/vnd.sap.adt.dataelements.v2+xml', accept: 'application/vnd.sap.adt.dataelements.v2+xml', body, query: `package=${encodeURIComponent(pkg)}` });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 200)}`);
    return `created ${r.status}`;
  });
  await step('DTEL', 'read', async () => {
    const r = await req('GET', uri, { accept: 'application/vnd.sap.adt.dataelements.v2+xml, application/vnd.sap.adt.dataelements.v1+xml' });
    assert(r.status === 200, `GET ${r.status}: ${r.text.slice(0, 150)}`);
    return 'ok';
  });
  await step('DTEL', 'lock+edit', async () => {
    const l = await lock(uri);
    handle = l.handle;
    const cur = await req('GET', uri, { accept: 'application/vnd.sap.adt.dataelements.v2+xml, application/vnd.sap.adt.dataelements.v1+xml', stateful: true });
    const next = cur.text.replace(/adtcore:description="[^"]*"/, 'adtcore:description="fsops v2"');
    const r = await req('PUT', uri, { ct: 'application/vnd.sap.adt.dataelements.v2+xml', accept: 'application/vnd.sap.adt.dataelements.v2+xml', stateful: true, body: next, query: handle ? `lockHandle=${handle}` : '' });
    await unlock(uri, handle);
    assert(r.status === 200 || r.status === 204, `PUT ${r.status}: ${r.text.slice(0, 200)}`);
    return 'RMW ok';
  });
  await step('DTEL', 'activate', async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="${ADTC}"><adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}" adtcore:type="DTEL/DT"/></adtcore:objectReferences>`;
    const r = await req('POST', '/sap/bc/adt/activation', { ct: 'application/vnd.sap.adt.activation+xml', accept: 'application/vnd.sap.adt.activation+xml', body, query: 'method=activate&preauditRequested=true' });
    assert(r.status === 200 && !/severity="E"/.test(r.text), `${r.status}: ${r.text.slice(0, 250)}`);
    return 'activated';
  });
  await step('DTEL', 'delete', async () => {
    const r = await req('POST', '/sap/bc/adt/deletion/delete', {
      ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
      accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="${ADTC}"><del:object adtcore:uri="${uri}"><del:transportNumber></del:transportNumber></del:object></del:deletionRequest>`,
    });
    assert(r.status >= 200 && r.status < 300, `delete ${r.status}`);
    return 'deleted';
  });
}

// ---------------------------------------------------------------- TTYP
{
  const name = N('TTYP');
  const uri = `/sap/bc/adt/ddic/tabletypes/${name.toLowerCase()}`;
  await step('TTYP', 'create', async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?><ttyp:tableType xmlns:ttyp="http://www.sap.com/dictionary/tabletype" xmlns:adtcore="${ADTC}" adtcore:description="fsops verify" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="TTYP/DA" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></ttyp:tableType>`;
    const r = await req('POST', '/sap/bc/adt/ddic/tabletypes', { ct: 'application/vnd.sap.adt.tabletype.v1+xml', accept: 'application/vnd.sap.adt.tabletype.v1+xml', body, query: `package=${encodeURIComponent(pkg)}` });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 200)}`);
    return `created ${r.status}`;
  });
  await step('TTYP', 'read', async () => {
    const r = await req('GET', uri, { accept: 'application/vnd.sap.adt.tabletype.v1+xml, application/vnd.sap.adt.tabletypes.v1+xml, application/vnd.sap.adt.tabletypes.v2+xml' });
    assert(r.status === 200, `GET ${r.status}: ${r.text.slice(0, 150)}`);
    return 'ok';
  });
  await step('TTYP', 'delete', async () => {
    const r = await req('POST', '/sap/bc/adt/deletion/delete', {
      ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
      accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="${ADTC}"><del:object adtcore:uri="${uri}"><del:transportNumber></del:transportNumber></del:object></del:deletionRequest>`,
    });
    assert(r.status >= 200 && r.status < 300, `delete ${r.status}`);
    return 'deleted';
  });
}

// ---------------------------------------------------------------- TABL
{
  const name = N('TBL');
  const uri = `/sap/bc/adt/ddic/tables/${name.toLowerCase()}`;
  await step('TABL', 'create', async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="${ADTC}" adtcore:description="fsops verify" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="TABL/DT" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></blue:blueSource>`;
    const r = await req('POST', '/sap/bc/adt/ddic/tables', { ct: 'application/vnd.sap.adt.tables.v2+xml', accept: 'application/vnd.sap.adt.tables.v2+xml', body, query: `package=${encodeURIComponent(pkg)}` });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 200)}`);
    return `created ${r.status}`;
  });
  await step('TABL', 'read-ddl', async () => {
    const r = await req('GET', `${uri}/source/main`, { accept: '*/*' });
    assert(r.status === 200 && /define table/i.test(r.text), `GET ${r.status}: ${r.text.slice(0, 150)}`);
    return `${r.text.split('\n').length} lines DDL`;
  });
  await step('TABL', 'write-ddl', async () => {
    const cur = await req('GET', `${uri}/source/main`, { accept: '*/*' });
    const l = await lock(uri);
    const next = cur.text.replace(/fsops verify/, 'fsops verify v2');
    const r = await req('PUT', `${uri}/source/main`, { ct: 'text/plain; charset=utf-8', accept: '*/*', stateful: true, body: next, query: l.handle ? `lockHandle=${l.handle}` : '' });
    await unlock(uri, l.handle);
    assert(r.status === 200 || r.status === 204, `PUT ${r.status}: ${r.text.slice(0, 200)}`);
    return 'DDL PUT ok';
  });
  await step('TABL', 'activate', async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="${ADTC}"><adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}" adtcore:type="TABL/DT"/></adtcore:objectReferences>`;
    const r = await req('POST', '/sap/bc/adt/activation', { ct: 'application/vnd.sap.adt.activation+xml', accept: 'application/vnd.sap.adt.activation+xml', body, query: 'method=activate&preauditRequested=true' });
    assert(r.status === 200 && !/severity="E"/.test(r.text), `${r.status}: ${r.text.slice(0, 250)}`);
    return 'activated';
  });
  await step('TABL', 'delete', async () => {
    const r = await req('POST', '/sap/bc/adt/deletion/delete', {
      ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
      accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="${ADTC}"><del:object adtcore:uri="${uri}"><del:transportNumber></del:transportNumber></del:object></del:deletionRequest>`,
    });
    assert(r.status >= 200 && r.status < 300, `delete ${r.status}`);
    return 'deleted';
  });
}

// ---------------------------------------------------------------- DDLS
{
  const name = N('DDLS');
  const uri = `/sap/bc/adt/ddic/ddl/sources/${name.toLowerCase()}`;
  const tabName = N('DTAB');
  // source table first (one-step blueSource)
  await step('DDLS', 'prep-table', async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="${ADTC}" adtcore:description="fsops src" adtcore:language="${language}" adtcore:name="${tabName}" adtcore:type="TABL/DT" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></blue:blueSource>`;
    const r = await req('POST', '/sap/bc/adt/ddic/tables', { ct: 'application/vnd.sap.adt.tables.v2+xml', accept: 'application/vnd.sap.adt.tables.v2+xml', body, query: `package=${encodeURIComponent(pkg)}` });
    assert(r.status < 300, `table POST ${r.status}`);
    const l = await lock(`/sap/bc/adt/ddic/tables/${tabName.toLowerCase()}`);
    const ddl = `define table ${tabName.toLowerCase()} {\n  key client            : abap.clnt not null;\n  key id                : abap.char(8);\n  text                  : abap.char(40);\n}\n`;
    const w = await req('PUT', `/sap/bc/adt/ddic/tables/${tabName.toLowerCase()}/source/main`, { ct: 'text/plain; charset=utf-8', accept: '*/*', stateful: true, body: ddl, query: l.handle ? `lockHandle=${l.handle}` : '' });
    await unlock(`/sap/bc/adt/ddic/tables/${tabName.toLowerCase()}`, l.handle);
    const act = await req('POST', '/sap/bc/adt/activation', {
      ct: 'application/vnd.sap.adt.activation+xml', accept: 'application/vnd.sap.adt.activation+xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="${ADTC}"><adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/tables/${tabName.toLowerCase()}" adtcore:name="${tabName}" adtcore:type="TABL/DT"/></adtcore:objectReferences>`,
      query: 'method=activate&preauditRequested=true',
    });
    assert(act.status === 200 && !/severity="E"/.test(act.text), `table activate ${act.status}: ${act.text.slice(0, 200)}`);
    return `table ${tabName} active`;
  });
  await step('DDLS', 'create', async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?><ddl:ddlSource xmlns:ddl="http://www.sap.com/adt/ddic/ddlsources" xmlns:adtcore="${ADTC}" adtcore:description="fsops verify" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="DDLS/DF" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></ddl:ddlSource>`;
    const r = await req('POST', '/sap/bc/adt/ddic/ddl/sources', { ct: 'application/vnd.sap.adt.ddlSource+xml', accept: 'application/vnd.sap.adt.ddlSource+xml', body, query: `package=${encodeURIComponent(pkg)}` });
    assert(r.status < 300, `POST ${r.status}: ${r.text.slice(0, 250)}`);
    return `created ${r.status}`;
  });
  await step('DDLS', 'write-source', async () => {
    const l = await lock(uri);
    const src = `@EndUserText.label: 'fsops verify'\ndefine view entity ${name} as select from ${tabName.toLowerCase()} {\n  key id,\n  text\n}\n`;
    const r = await req('PUT', `${uri}/source/main`, { ct: 'text/plain; charset=utf-8', accept: '*/*', stateful: true, body: src, query: l.handle ? `lockHandle=${l.handle}` : '' });
    await unlock(uri, l.handle);
    assert(r.status < 300, `PUT ${r.status}: ${r.text.slice(0, 200)}`);
    return 'source written';
  });
  await step('DDLS', 'read', async () => {
    const r = await req('GET', `${uri}/source/main`, { accept: '*/*' });
    assert(r.status === 200 && r.text.includes('define view'), `GET ${r.status}: ${r.text.slice(0, 150)}`);
    return 'ok';
  });
  await step('DDLS', 'activate', async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="${ADTC}"><adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}" adtcore:type="DDLS/DF"/></adtcore:objectReferences>`;
    const r = await req('POST', '/sap/bc/adt/activation', { ct: 'application/vnd.sap.adt.activation+xml', accept: 'application/vnd.sap.adt.activation+xml', body, query: 'method=activate&preauditRequested=true' });
    assert(r.status === 200 && !/severity="E"/.test(r.text), `${r.status}: ${r.text.slice(0, 300)}`);
    return 'activated';
  });
  await step('DDLS', 'cleanup', async () => {
    // view first, then table
    for (const [u, n] of [[uri, name], [`/sap/bc/adt/ddic/tables/${tabName.toLowerCase()}`, tabName]]) {
      const r = await req('POST', '/sap/bc/adt/deletion/delete', {
        ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
        accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
        body: `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="${ADTC}"><del:object adtcore:uri="${u}"><del:transportNumber></del:transportNumber></del:object></del:deletionRequest>`,
      });
      assert(r.status < 300, `delete ${n} ${r.status}: ${r.text.slice(0, 150)}`);
    }
    return 'view + table deleted';
  });
}

// ---------------------------------------------------------------- summary
console.log(`\n=== run ${run} evidence ===`);
for (const e of evidence) console.log(`${e.ok ? 'PROVEN' : 'REFUTED'} ${e.type}.${e.verb}: ${e.detail}`);
const proven = evidence.filter((e) => e.ok).length;
console.log(`\n${proven}/${evidence.length} steps proven on deloitte-kic (${url} client ${client})`);
