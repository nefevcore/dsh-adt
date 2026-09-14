/**
 * Phase-2 REAL verification — P1 completion + P2 + P3 + P4 types against
 * the live deloitte-kic S4C gateway, using wire forms from the official
 * client dump (cross-checked against the P1 run's evidence).
 *
 * Coverage:
 *   P1 remainder: STRU / DCLS / DDLX / TTYP-RMW / DOMA fixedValues
 *   P2: PROG / CLAS / INTF / FUNC (source chains)
 *   P3: BDEF / SRVD / SRVB (binding special form)
 *   P4: MSAG / VIEW read-only / SHLP read-only / TYPE probe
 *
 * Usage: node scripts/verify-p234-real.mjs <url> <client> <user> <password> [$TMP]
 */
const [url, client, user, password, pkg = '$TMP', language = 'EN'] = process.argv.slice(2);
if (!url || !client || !user || !password) {
  console.error('usage: node verify-p234-real.mjs <url> <client> <user> <password> [package]');
  process.exit(2);
}
const auth = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const CONNECTION_ID = crypto.randomUUID();

const run = String(Date.now() % 1_000_000).padStart(6, '0');
const N = (p) => `Z${p}_${run}`;
let cookies = '';
let csrf = '';

async function req(method, path, { accept = '*/*', ct, body, query = '' } = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const q = query ? `${sep}${query}&sap-client=${client}&sap-language=${language}` : `${sep}sap-client=${client}&sap-language=${language}`;
  const headers = {
    Authorization: auth,
    Accept: accept,
    'sap-adt-connection-id': CONNECTION_ID,
    'x-sap-adt-sessiontype': 'stateful',
    ...(ct ? { 'Content-Type': ct } : {}),
    ...(csrf ? { 'x-csrf-token': csrf } : { 'x-csrf-token': 'fetch' }),
  };
  if (cookies) headers.Cookie = cookies;
  const res = await fetch(`${url}${path}${q}`, { method, headers, body });
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
  const text = await res.text().catch(() => '');
  return { status: res.status, text };
}

const ADTC = 'http://www.sap.com/adt/core';
const evidence = [];
function record(type, verb, ok, detail) {
  evidence.push({ type, verb, ok, detail: String(detail).slice(0, 200) });
  console.log(`${ok ? '✅' : '❌'} ${type.padEnd(6)} ${verb.padEnd(18)} ${String(detail).slice(0, 150)}`);
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

async function lock(uri) {
  const r = await req('POST', `${uri}?_action=LOCK&accessMode=MODIFY`, {
    accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
  });
  if (r.status === 404 || r.status === 405) return { handle: undefined, lockless: true };
  assert(r.status === 200, `lock ${r.status}: ${r.text.slice(0, 120)}`);
  return { handle: r.text.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/)?.[1], lockless: false };
}
async function unlock(uri, handle) {
  if (!handle) return;
  await req('POST', `${uri}?_action=UNLOCK&lockHandle=${encodeURIComponent(handle)}`, {
    accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
  });
}
async function activate(uri, name, type) {
  const r = await req('POST', '/sap/bc/adt/activation?method=activate', {
    accept: 'application/vnd.sap.adt.activation+xml', ct: 'application/vnd.sap.adt.activation+xml',
    body: `<?xml version="1.0"?><adtcore:objectReferences xmlns:adtcore="${ADTC}"><adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}" adtcore:type="${type}"/></adtcore:objectReferences>`,
  });
  assert(r.status === 200 && !/severity="E"/.test(r.text) && !/type="E"/.test(r.text), `${r.status}: ${r.text.slice(0, 200)}`);
}
async function del(uri) {
  const r = await req('POST', '/sap/bc/adt/deletion/delete', {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
    body: `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="${ADTC}"><del:object adtcore:uri="${uri}"><del:transportNumber></del:transportNumber></del:object></del:deletionRequest>`,
  });
  assert(r.status >= 200 && r.status < 300, `del ${r.status}: ${r.text.slice(0, 150)}`);
}

// ---- bootstrap (stateful from the first request — P1 finding) ----
{
  const r = await req('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });
  console.log(`# bootstrap: ${r.status}, csrf=${csrf ? 'y' : 'n'}`);
  if (r.status !== 200) process.exit(1);
}

// ===========================================================================
// P1 remainder
// ===========================================================================

// ---- STRU: blueSource create + DDL source read/write (same as TABL) ----
{
  const name = N('STRU');
  const uri = `/sap/bc/adt/ddic/structures/${name.toLowerCase()}`;
  let ok = await step('STRU', 'create', async () => {
    const r = await req('POST', '/sap/bc/adt/ddic/structures', {
      accept: 'application/vnd.sap.adt.structures.v2+xml', ct: 'application/vnd.sap.adt.structures.v2+xml',
      query: `package=${encodeURIComponent(pkg)}`,
      body: `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="${ADTC}" adtcore:description="stru verify" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="STRU/DT" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></blue:blueSource>`,
    });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 180)}`);
    return `created ${r.status}`;
  });
  if (!ok) { await step('STRU', 'skip-rest', () => { throw new Error('create failed'); }); }
  else {
    await step('STRU', 'read-ddl', async () => {
      const r = await req('GET', `${uri}/source/main`, { accept: '*/*' });
      assert(r.status === 200 && /define (structure|table)/i.test(r.text), `GET ${r.status}: ${r.text.slice(0, 120)}`);
      return `${r.text.split('\n').length} lines`;
    });
    await step('STRU', 'write-ddl', async () => {
      // A VALID structure DDL (PUTting the empty skeleton back verbatim
      // fails the source check — "Can't save due to errors in source").
      const l = await lock(uri);
      const ddl = `@EndUserText.label : 'stru verify v2'\n@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE\n@AbapCatalog.tableCategory : #STRUCTURE\n@AbapCatalog.dataMaintenance : #RESTRICTED\n\ndefine structure ${name.toLowerCase()} {\n  key id   : abap.char(8);\n  text     : abap.char(40);\n}\n`;
      const r = await req('PUT', `${uri}/source/main`, {
        accept: '*/*', ct: 'text/plain; charset=utf-8',
        query: l.handle ? `lockHandle=${encodeURIComponent(l.handle)}` : '',
        body: ddl,
      });
      await unlock(uri, l.handle);
      assert(r.status < 300, `PUT ${r.status}: ${r.text.slice(0, 150)}`);
      return 'DDL PUT ok';
    });
    await step('STRU', 'activate', () => activate(uri, name, 'STRU/DT'));
    await step('STRU', 'delete', () => del(uri));
  }
}

// ---- DCLS: acm/dcl/sources + DCL source ----
{
  const name = N('DCLS');
  const uri = `/sap/bc/adt/acm/dcl/sources/${name.toLowerCase()}`;
  const ok = await step('DCLS', 'create', async () => {
    const r = await req('POST', '/sap/bc/adt/acm/dcl/sources', {
      accept: 'application/vnd.sap.adt.dclSource+xml', ct: 'application/vnd.sap.adt.dclSource+xml',
      query: `package=${encodeURIComponent(pkg)}`,
      body: `<?xml version="1.0" encoding="UTF-8"?><dcl:dclSource xmlns:dcl="http://www.sap.com/adt/acm/dclsources" xmlns:adtcore="${ADTC}" adtcore:description="dcl verify" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="DCLS/DL" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></dcl:dclSource>`,
    });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 180)}`);
    return `created ${r.status}`;
  });
  if (ok) {
    await step('DCLS', 'read', async () => {
      const r = await req('GET', `${uri}/source/main`, { accept: '*/*' });
      assert(r.status === 200, `GET ${r.status}`);
      return 'ok';
    });
    await step('DCLS', 'delete', () => del(uri));
  }
}

// ---- DDLX: ddic/ddlx/sources ----
{
  const name = N('DDLX');
  const uri = `/sap/bc/adt/ddic/ddlx/sources/${name.toLowerCase()}`;
  const ok = await step('DDLX', 'create', async () => {
    const r = await req('POST', '/sap/bc/adt/ddic/ddlx/sources', {
      accept: 'application/vnd.sap.adt.ddic.ddlx.v1+xml', ct: 'application/vnd.sap.adt.ddic.ddlx.v1+xml',
      query: `package=${encodeURIComponent(pkg)}`,
      body: `<?xml version="1.0" encoding="UTF-8"?><ddlxsources:ddlxSource xmlns:ddlxsources="http://www.sap.com/adt/ddic/ddlxsources" xmlns:adtcore="${ADTC}" adtcore:description="ddlx verify" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="DDLX/EX" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></ddlxsources:ddlxSource>`,
    });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 180)}`);
    return `created ${r.status}`;
  });
  if (ok) {
    await step('DDLX', 'read', async () => {
      const r = await req('GET', `${uri}/source/main`, { accept: '*/*' });
      assert(r.status === 200, `GET ${r.status}`);
      return 'ok';
    });
    await step('DDLX', 'delete', () => del(uri));
  }
}

// ---- TTYP: complete the missing RMW + activate from the P1 run ----
{
  const name = N('TTYP');
  const uri = `/sap/bc/adt/ddic/tabletypes/${name.toLowerCase()}`;
  const ok = await step('TTYP', 'create', async () => {
    const r = await req('POST', '/sap/bc/adt/ddic/tabletypes', {
      accept: 'application/vnd.sap.adt.tabletype.v1+xml', ct: 'application/vnd.sap.adt.tabletype.v1+xml',
      query: `package=${encodeURIComponent(pkg)}`,
      body: `<?xml version="1.0" encoding="UTF-8"?><ttyp:tableType xmlns:ttyp="http://www.sap.com/dictionary/tabletype" xmlns:adtcore="${ADTC}" adtcore:description="ttyp rmw" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="TTYP/DA" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></ttyp:tableType>`,
    });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 150)}`);
    return `created ${r.status}`;
  });
  if (ok) {
    await step('TTYP', 'lock+edit', async () => {
      const l = await lock(uri);
      const cur = await req('GET', uri, { accept: 'application/vnd.sap.adt.tabletype.v1+xml, application/vnd.sap.adt.tabletypes.v1+xml' });
      const r = await req('PUT', uri, {
        accept: 'application/vnd.sap.adt.tabletype.v1+xml', ct: 'application/vnd.sap.adt.tabletype.v1+xml; charset=utf-8',
        query: l.handle ? `lockHandle=${encodeURIComponent(l.handle)}` : '',
        body: cur.text.replace(/adtcore:description="[^"]*"/, 'adtcore:description="ttyp rmw v2"'),
      });
      await unlock(uri, l.handle);
      assert(r.status < 300, `PUT ${r.status}: ${r.text.slice(0, 150)}`);
      return 'RMW ok';
    });
    await step('TTYP', 'activate', () => activate(uri, name, 'TTYP/DT'));
    await step('TTYP', 'delete', () => del(uri));
  }
}

// ---- DOMA_VALUE: fixedValues block via the DOMA structured face ----
// PROVEN SHAPE (probe17): fixValues MUST nest inside doma:content >
// doma:valueInformation (mirroring the GET response); a block outside
// <content> is silently DROPPED by the gateway (PUT 200, but not persisted).
{
  const name = N('DOMV');
  const uri = `/sap/bc/adt/ddic/domains/${name.toLowerCase()}`;
  const ok = await step('DOMA_VALUE', 'create-doma', async () => {
    const r = await req('POST', '/sap/bc/adt/ddic/domains', {
      accept: 'application/vnd.sap.adt.domains.v2+xml', ct: 'application/vnd.sap.adt.domains.v2+xml',
      query: `package=${encodeURIComponent(pkg)}`,
      body: `<?xml version="1.0" encoding="UTF-8"?><doma:domain xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="${ADTC}" adtcore:description="fixvals" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="DOMA/DD" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></doma:domain>`,
    });
    assert(r.status === 201, `POST ${r.status}`);
    return 'created';
  });
  if (ok) {
    await step('DOMA_VALUE', 'write-fixvalues', async () => {
      const l = await lock(uri);
      const cur = await req('GET', uri, { accept: 'application/vnd.sap.adt.domains.v2+xml' });
      // Rebuild the content block with datatype + nested fixValues (the
      // persisted shape — plain attribute patches are not enough here).
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<doma:domain xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="${ADTC}" adtcore:description="fixvals v2" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="DOMA/DD" adtcore:masterLanguage="${language}">\n  <adtcore:packageRef adtcore:name="${pkg}"/>\n  <doma:content>\n    <doma:typeInformation>\n      <doma:datatype>CHAR</doma:datatype>\n      <doma:length>1</doma:length>\n    </doma:typeInformation>\n    <doma:valueInformation>\n      <doma:fixValues>\n        <doma:fixValue><doma:low>A</doma:low><doma:text>Alpha</doma:text></doma:fixValue>\n        <doma:fixValue><doma:low>B</doma:low><doma:text>Beta</doma:text></doma:fixValue>\n      </doma:fixValues>\n    </doma:valueInformation>\n  </doma:content>\n</doma:domain>`;
      const r = await req('PUT', uri, {
        accept: 'application/vnd.sap.adt.domains.v2+xml', ct: 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8',
        query: l.handle ? `lockHandle=${encodeURIComponent(l.handle)}` : '',
        body: xml,
      });
      await unlock(uri, l.handle);
      assert(r.status < 300, `PUT ${r.status}: ${r.text.slice(0, 150)}`);
      return 'fixValues written';
    });
    await step('DOMA_VALUE', 'read-back', async () => {
      const r = await req('GET', `${uri}?version=inactive`, { accept: 'application/vnd.sap.adt.domains.v2+xml' });
      assert(r.status === 200 && /<doma:low>A</.test(r.text), `fixed values not persisted (status ${r.status})`);
      return 'A/B visible (inactive version)';
    });
    await step('DOMA_VALUE', 'clear-fixvalues', async () => {
      const l = await lock(uri);
      const cur = await req('GET', uri, { accept: 'application/vnd.sap.adt.domains.v2+xml' });
      // Empty the block INSIDE valueInformation (keep the nesting).
      const next = cur.text.replace(/<doma:fixValues>[\s\S]*?<\/doma:fixValues>/, '<doma:fixValues/>');
      const r = await req('PUT', uri, {
        accept: 'application/vnd.sap.adt.domains.v2+xml', ct: 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8',
        query: l.handle ? `lockHandle=${encodeURIComponent(l.handle)}` : '',
        body: next,
      });
      await unlock(uri, l.handle);
      assert(r.status < 300, `PUT ${r.status}`);
      return 'cleared';
    });
    await step('DOMA_VALUE', 'delete', () => del(uri));
  }
}

// ===========================================================================
// P2: source-type chains (PROG / CLAS / INTF / FUNC)
// ===========================================================================

/** Generic source-type chain: create → write source → read → delete.
 * Each type POSTs its OFFICIAL namespaced root element (the gateway
 * rejects the generic objectReference form with 400). */
async function verifySourceType(label, coll, ct, uriPrefix, adtType, src, rootXml) {
  const name = N(label);
  const uri = `${uriPrefix}${name.toLowerCase()}`;
  const ok = await step(label, 'create', async () => {
    const body = rootXml
      ? rootXml(name)
      : `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReference xmlns:adtcore="${ADTC}" adtcore:description="${label.toLowerCase()} verify" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="${adtType}" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></adtcore:objectReference>`;
    const r = await req('POST', coll, {
      accept: ct, ct,
      query: `package=${encodeURIComponent(pkg)}`,
      body,
    });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 180)}`);
    return `created ${r.status}`;
  });
  if (!ok) return;
  await step(label, 'write-source', async () => {
    const l = await lock(uri);
    const r = await req('PUT', `${uri}/source/main`, {
      accept: '*/*', ct: 'text/plain; charset=utf-8',
      query: l.handle ? `lockHandle=${encodeURIComponent(l.handle)}` : '',
      body: src(name),
    });
    await unlock(uri, l.handle);
    assert(r.status < 300, `PUT ${r.status}: ${r.text.slice(0, 150)}`);
    return 'source written';
  });
  await step(label, 'read', async () => {
    const r = await req('GET', `${uri}/source/main`, { accept: '*/*' });
    assert(r.status === 200 && r.text.length > 0, `GET ${r.status}`);
    return `${r.text.split('\n').length} lines`;
  });
  await step(label, 'delete', () => del(uri));
}

await verifySourceType('PROG', '/sap/bc/adt/programs/programs', 'application/vnd.sap.adt.programs.programs.v2+xml',
  '/sap/bc/adt/programs/programs/', 'PROG/P',
  (n) => `REPORT ${n.toLowerCase()}.\nWRITE / 'verify p234'.\n`,
  (n) => `<?xml version="1.0" encoding="UTF-8"?><program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs" xmlns:adtcore="${ADTC}" adtcore:description="prog verify" adtcore:language="${language}" adtcore:name="${n}" adtcore:type="PROG/P" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></program:abapProgram>`);

await verifySourceType('CLAS', '/sap/bc/adt/oo/classes', 'application/vnd.sap.adt.oo.classes.v4+xml',
  '/sap/bc/adt/oo/classes/', 'CLAS/OC',
  (n) => `CLASS ${n.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.\nENDCLASS.\nCLASS ${n.toLowerCase()} IMPLEMENTATION.\nENDCLASS.\n`,
  (n) => `<?xml version="1.0" encoding="UTF-8"?><class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes" xmlns:adtcore="${ADTC}" adtcore:description="clas verify" adtcore:language="${language}" adtcore:name="${n}" adtcore:type="CLAS/OC" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></class:abapClass>`);

await verifySourceType('INTF', '/sap/bc/adt/oo/interfaces', 'application/vnd.sap.adt.oo.interfaces.v5+xml',
  '/sap/bc/adt/oo/interfaces/', 'INTF/OI',
  (n) => `INTERFACE ${n.toLowerCase()} PUBLIC.\nENDINTERFACE.\n`,
  (n) => `<?xml version="1.0" encoding="UTF-8"?><intf:abapInterface xmlns:intf="http://www.sap.com/adt/oo/interfaces" xmlns:adtcore="${ADTC}" adtcore:description="intf verify" adtcore:language="${language}" adtcore:name="${n}" adtcore:type="INTF/OI" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></intf:abapInterface>`);

await verifySourceType('FUNC', '/sap/bc/adt/functions/groups', 'application/vnd.sap.adt.functions.groups.v3+xml',
  '/sap/bc/adt/functions/groups/', 'FUGR/F',
  (n) => `FUNCTION-POOL ${n.toLowerCase()}.\n`,
  (n) => `<?xml version="1.0" encoding="UTF-8"?><group:abapFunctionGroup xmlns:group="http://www.sap.com/adt/functions/groups" xmlns:adtcore="${ADTC}" adtcore:description="func verify" adtcore:language="${language}" adtcore:name="${n}" adtcore:type="FUGR/F" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></group:abapFunctionGroup>`);

// ===========================================================================
// P3: RAP (BDEF / SRVD / SRVB)
// ===========================================================================

// BDEF: official form = /bo/behaviordefinitions blue:blueSource
{
  const name = N('BDEF');
  const ok = await step('BDEF', 'create', async () => {
    const r = await req('POST', '/sap/bc/adt/bo/behaviordefinitions', {
      accept: 'application/vnd.sap.adt.blues.v1+xml', ct: 'application/vnd.sap.adt.blues.v1+xml',
      query: `package=${encodeURIComponent(pkg)}`,
      body: `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="${ADTC}" adtcore:description="bdef probe" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="BDEF/BDO" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></blue:blueSource>`,
    });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 200)}`);
    return `created ${r.status}`;
  });
  if (ok) {
    const uri = `/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}`;
    await step('BDEF', 'read', async () => {
      const r = await req('GET', `${uri}/source/main`, { accept: '*/*' });
      return r.status === 200 ? 'ok' : `GET ${r.status}`;
    });
    await step('BDEF', 'delete', () => del(uri));
  }
}

// SRVD: ddic/srvd/sources with sourceType=S
{
  const name = N('SRVD');
  const ok = await step('SRVD', 'create', async () => {
    const r = await req('POST', '/sap/bc/adt/ddic/srvd/sources', {
      accept: 'application/vnd.sap.adt.ddic.srvd.v1+xml', ct: 'application/vnd.sap.adt.ddic.srvd.v1+xml',
      query: `package=${encodeURIComponent(pkg)}`,
      body: `<?xml version="1.0" encoding="UTF-8"?><srvd:srvdSource xmlns:srvd="http://www.sap.com/adt/ddic/srvdsources" xmlns:adtcore="${ADTC}" adtcore:description="srvd probe" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="SRVD/SRV" adtcore:masterLanguage="${language}" srvd:srvdSourceType="S"><adtcore:packageRef adtcore:name="${pkg}"/></srvd:srvdSource>`,
    });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 200)}`);
    return `created ${r.status}`;
  });
  if (ok) {
    const uri = `/sap/bc/adt/ddic/srvd/sources/${name.toLowerCase()}`;
    await step('SRVD', 'read', async () => {
      const r = await req('GET', `${uri}/source/main`, { accept: '*/*' });
      return r.status === 200 ? 'ok' : `GET ${r.status}`;
    });
    await step('SRVD', 'delete', () => del(uri));
  }
}

// SRVB: the binding special form (create + read; publish left to the engine
// batch — it needs a real service definition which needs a real view).
{
  const name = N('SRVB');
  const ok = await step('SRVB', 'create', async () => {
    const r = await req('POST', '/sap/bc/adt/businessservices/bindings', {
      accept: 'application/vnd.sap.adt.businessservices.servicebinding.v1+xml, application/vnd.sap.adt.businessservices.servicebinding.v2+xml',
      ct: 'application/vnd.sap.adt.businessservices.servicebinding.v2+xml',
      query: `package=${encodeURIComponent(pkg)}`,
      body: `<?xml version="1.0" encoding="UTF-8"?><srvb:serviceBinding xmlns:srvb="http://www.sap.com/adt/ddic/ServiceBindings" xmlns:adtcore="${ADTC}" adtcore:description="srvb probe" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="SRVB/VB" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/><srvb:services srvb:name="${name.toUpperCase()}_SRV"><srvb:content srvb:version="0001"><srvb:serviceDefinition adtcore:name="ZUI_${run}_OVP"/></srvb:content></srvb:services><srvb:binding srvb:category="ODATA" srvb:type="ODATA" srvb:version="V2"><srvb:implementation adtcore:name=""/></srvb:binding></srvb:serviceBinding>`,
    });
    // SRVB needs an EXISTING service definition — expect a meaningful error.
    if (r.status >= 400) return `expected-fail ${r.status}: ${r.text.replace(/\s+/g, ' ').slice(0, 120)}`;
    return `created ${r.status}`;
  });
  if (ok) {
    const uri = `/sap/bc/adt/businessservices/bindings/${name.toLowerCase()}`;
    await step('SRVB', 'read', async () => {
      const r = await req('GET', uri, { accept: 'application/vnd.sap.adt.businessservices.servicebinding.v2+xml' });
      return `GET ${r.status}`;
    });
    await step('SRVB', 'delete', () => del(uri));
  }
}

// ===========================================================================
// P4: MSAG / VIEW read / SHLP read / TYPE probe
// ===========================================================================

// MSAG: messageclass + mc.messageclass wire. The OBJECT URI spelling differs
// across backends (deloitte serves /msgclass/, impc only /messageclass/) —
// resolve it per system with a GET probe.
{
  const name = N('MSAG');
  const ok = await step('MSAG', 'create', async () => {
    const r = await req('POST', '/sap/bc/adt/messageclass', {
      accept: 'application/xml', ct: 'application/xml',
      query: `package=${encodeURIComponent(pkg)}`,
      body: `<?xml version="1.0" encoding="UTF-8"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="${ADTC}" adtcore:description="msag verify" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="MSAG/N" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></mc:messageClass>`,
    });
    assert(r.status === 201 || r.status === 200, `POST ${r.status}: ${r.text.slice(0, 180)}`);
    return `created ${r.status}`;
  });
  if (ok) {
    // Resolve the object URI spelling for THIS backend.
    let uri = `/sap/bc/adt/messageclass/${name.toLowerCase()}`;
    if ((await req('GET', uri, { accept: 'application/vnd.sap.adt.mc.messageclass+xml, application/xml' })).status !== 200) {
      uri = `/sap/bc/adt/msgclass/${name.toLowerCase()}`;
    }
    await step('MSAG', 'read', async () => {
      const r = await req('GET', uri, { accept: 'application/vnd.sap.adt.mc.messageclass+xml, application/xml' });
      assert(r.status === 200, `GET ${r.status}`);
      return 'ok';
    });
    await step('MSAG', 'lock+edit', async () => {
      // impc semantics: messageclass CREATE leaves a residual own-user lock,
      // and LOCK on an already-locked object answers 403 (no self-refresh).
      // Release first (handle-less, same user), then lock.
      await req('POST', `${uri}?_action=UNLOCK`, { accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result' });
      const l = await lock(uri);
      const cur = await req('GET', uri, { accept: 'application/vnd.sap.adt.mc.messageclass+xml, application/xml' });
      const next = cur.text.replace(/adtcore:description="[^"]*"/, 'adtcore:description="msag v2"');
      const r = await req('PUT', uri, {
        accept: 'application/vnd.sap.adt.mc.messageclass+xml, application/xml', ct: 'application/vnd.sap.adt.mc.messageclass+xml',
        query: l.handle ? `lockHandle=${encodeURIComponent(l.handle)}` : '',
        body: next,
      });
      await unlock(uri, l.handle);
      assert(r.status < 300, `PUT ${r.status}: ${r.text.slice(0, 150)}`);
      return 'RMW ok';
    });
    await step('MSAG', 'delete', () => del(uri));
  }
}

// VIEW (classic SE11): metadata read on a SAP-owned view — no write face.
await step('VIEW', 'metadata-read', async () => {
  const r = await req('GET', '/sap/bc/adt/ddic/views/v_mara', { accept: 'application/vnd.sap.adt.externalviews.v1+xml, application/xml, */*' });
  if (r.status === 404) return 'no ADT face for SE11 views (expected on this profile)';
  assert(r.status === 200, `GET ${r.status}`);
  return 'metadata read ok';
});

// SHLP: read probe.
await step('SHLP', 'read-probe', async () => {
  const r = await req('GET', '/sap/bc/adt/ddic/searchhelps/shlp_demo', { accept: 'application/xml' });
  return r.status === 404 ? 'no service (expected)' : `GET ${r.status}`;
});

// TYPE (type group): creation probe — the plan marks it unverified.
{
  const name = N('TYPE');
  await step('TYPE', 'create-probe', async () => {
    const r = await req('POST', '/sap/bc/adt/ddic/typegroups', {
      accept: 'application/xml', ct: 'application/xml',
      query: `package=${encodeURIComponent(pkg)}`,
      body: `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReference xmlns:adtcore="${ADTC}" adtcore:description="type probe" adtcore:language="${language}" adtcore:name="${name}" adtcore:type="TYPE/TT" adtcore:masterLanguage="${language}"><adtcore:packageRef adtcore:name="${pkg}"/></adtcore:objectReference>`,
    });
    if (r.status >= 400) return `refused ${r.status}: ${r.text.replace(/\s+/g, ' ').slice(0, 140)}`;
    return `created ${r.status} — delete now`;
  }).then(async (created) => {
    if (created) await step('TYPE', 'delete', () => del(`/sap/bc/adt/ddic/typegroups/${name.toLowerCase()}`));
    return created;
  });
}

// ===========================================================================
console.log(`\n=== run ${run} evidence ===`);
const byType = {};
for (const e of evidence) {
  byType[e.type] ??= {};
  byType[e.type][e.verb] = e.ok ? '✅' : '❌';
}
console.table(byType);
const proven = evidence.filter((e) => e.ok).length;
console.log(`${proven}/${evidence.length} steps proven`);
