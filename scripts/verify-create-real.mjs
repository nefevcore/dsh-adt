/**
 * 4.1e REAL regression — exercises the NEW client.createObject wire forms
 * (CREATE_ROOT_ELEMENTS + typed CT/Accept + destination.language) against
 * the live systems. This is the acceptance test for commit 6ae52e8: the
 * verify-p1/p234 scripts prove the BARE wire; this one proves OUR CLIENT
 * now speaks it.
 *
 * Coverage per environment:
 *   - createObject for the P1/P3 additions: DCLS, DDLX, BDEF, SRVD
 *   - readSource back (the /source/main face)
 *   - deleteObject (modern deletion service, full-URI body)
 *   - impc (ZH): language fields must follow the logon language or the
 *     real system answers 400 — this run proves the parameterization.
 *
 * Usage: node scripts/verify-create-real.mjs <url> <client> <user> <pwd> [language]
 *   e.g. node scripts/verify-create-real.mjs https://180.167.68.213:44304 100 168013 <pwd> EN
 */
import { AdtClient, AdtError } from '../packages/adt-protocol/lib/index.js';

const [url, client, user, password, language = 'EN'] = process.argv.slice(2);
if (!url || !client || !user || !password) {
  console.error('usage: node scripts/verify-create-real.mjs <url> <client> <user> <pwd> [language]');
  process.exit(2);
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const run = String(Date.now() % 1_000_000).padStart(6, '0');
const N = (p) => `Z${p}_${run}`;

const adtClient = new AdtClient({
  name: 'verify-create',
  url,
  client,
  language,
  auth: { type: 'basic', username: user, password },
});

let pass = 0;
let fail = 0;
const failures = [];
async function step(label, fn) {
  try {
    const detail = (await fn()) ?? 'ok';
    pass++;
    console.log(`✅ ${label}: ${detail}`);
  } catch (e) {
    fail++;
    failures.push(`${label}: ${e.message}`);
    console.log(`❌ ${label}: ${e.message}`);
  }
}

// Bootstrap (also warms CSRF + session cookies through the real chain).
await step('bootstrap discover', async () => {
  const d = await adtClient.discover();
  return `${d.services?.length ?? 0} services`;
});

/** The object URI by type (must mirror the wire prefixes). */
function uriFor(type, name) {
  const map = {
    DCLS: `/sap/bc/adt/acm/dcl/sources/`,
    DDLX: `/sap/bc/adt/ddic/ddlx/sources/`,
    BDEF: `/sap/bc/adt/bo/behaviordefinitions/`,
    SRVD: `/sap/bc/adt/ddic/srvd/sources/`,
    DDLS: `/sap/bc/adt/ddic/ddl/sources/`,
  };
  return `${map[type]}${name.toLowerCase()}`;
}

const SOURCES = {
  DCLS: (n) => `@EndUserText.label: 'verify'\n@MappingRole: true\ndefine role ${n.toLowerCase()} {\n  grant select on t100\n    to (select * from t000 where mandt = $session.client);\n}\n`,
  DDLX: (n) => `@EndUserText.label: 'verify'\n@Metadata.layer: #CORE\nannotate view entity t100 with {\n  @UI.lineItem: [{ position: 10 }]\n  msgno;\n}\n`,
  BDEF: (n) => `managed implementation in class ${n.toLowerCase()}_handler unique;\nstrict ( 2 );\n`,
  SRVD: (n) => `@EndUserText.label: 'verify'\ndefine service ${n.toLowerCase()} {\n  expose t100 as items;\n}\n`,
};

// The four P1/P3 types through OUR client: create → write source → read → delete.
for (const type of ['DCLS', 'DDLX', 'BDEF', 'SRVD']) {
  const name = N(type);
  await step(`${type} createObject (new wire form)`, async () => {
    const r = await adtClient.createObject({
      destination: 'verify-create', type, name,
      description: 'client wire verify', packageName: '$TMP',
    });
    if (!r.success) throw new Error(`success=false: ${r.messages.map((m) => `${m.severity}:${m.text}`).join(' | ')}`);
    if (!new RegExp(`${uriFor(type, '')}[a-z0-9_]+$`).test(r.uri ?? '')) throw new Error(`unexpected uri ${r.uri}`);
    return r.uri;
  });
  await step(`${type} writeSource (locked PUT)`, async () => {
    const uri = uriFor(type, name);
    const lock = await adtClient.lock(uri);
    try {
      await adtClient.writeSource(uri, SOURCES[type](name), { lockHandle: lock.handle });
    } finally {
      await adtClient.unlock(uri, lock.handle);
    }
    return 'written';
  });
  await step(`${type} readSource back`, async () => {
    const s = await adtClient.readSource(uriFor(type, name));
    const text = typeof s === 'string' ? s : (s.source ?? '');
    if (!/verify|define|annotate|managed/i.test(text)) throw new Error(`unexpected source: ${String(text).slice(0, 80)}`);
    return `${String(text).split('\n').length} lines`;
  });
  await step(`${type} deleteObject`, async () => {
    await adtClient.deleteObject(uriFor(type, name));
    return 'deleted';
  });
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (failures.length) {
  console.log('failures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
