/** Delete ONLY this verification round's leftovers (shared system: keep
 * other users' Z objects!). */
const [url, client, user, password] = process.argv.slice(2);
const auth = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const CID = crypto.randomUUID();
const jar = new Map();
let csrf = '';
async function req(method, path, { accept = '*/*', ct, body } = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const res = await fetch(`${url}${path}${sep}sap-client=${client}&sap-language=EN`, {
    method,
    headers: { Authorization: auth, Accept: accept, 'sap-adt-connection-id': CID, 'x-sap-adt-sessiontype': 'stateful', ...(csrf ? { 'x-csrf-token': csrf } : { 'x-csrf-token': 'fetch' }), ...(ct ? { 'Content-Type': ct } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body,
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
  const token = res.headers.get('x-csrf-token');
  if (token && token !== 'fetch') csrf = token;
  return { status: res.status, text: await res.text().catch(() => '') };
}
await req('GET', '/sap/bc/adt/core/discovery', { accept: 'application/atomsvc+xml' });

// EXACT names from THIS round only (probe15-17 + verify-p234 runs).
const targets = [
  '/sap/bc/adt/ddic/structures/zsp_159746',        // probe15 STRU
  '/sap/bc/adt/functions/groups/zfg_555178',       // probe15 FUNC
  '/sap/bc/adt/functions/groups/zfunc_412408',     // run2 FUNC leftover
];
for (const q of ['ZFV2_*', 'ZFV_*', 'ZDOMV_*']) {
  const s = await req('GET', `/sap/bc/adt/repository/informationsystem/search?query=${encodeURIComponent(q)}&operation=quickSearch&maxCount=100`, { accept: 'application/xml' });
  for (const [, uri] of s.text.matchAll(/<adtcore:objectReference[^>]*adtcore:uri="([^"]+)"/g)) {
    if (!targets.includes(uri)) targets.push(uri);
  }
}
console.log(`targets: ${targets.length}`);
for (const uri of targets) {
  const r = await req('POST', '/sap/bc/adt/deletion/delete', {
    ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    body: `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core"><del:object adtcore:uri="${uri}"><del:transportNumber></del:transportNumber></del:object></del:deletionRequest>`,
  });
  console.log(`${r.status < 300 ? '✅' : '❌'} ${uri.split('/').pop()}: ${r.status}`);
}
