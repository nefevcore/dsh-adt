/** impc-test cleanup: ZMSAG / ZSRVB leftovers (my rounds only). */
const [url, client, user, password] = process.argv.slice(2);
const auth = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const CID = crypto.randomUUID();
const jar = new Map();
let csrf = '';
async function req(method, path, { accept = '*/*', ct, body } = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const res = await fetch(`${url}${path}${sep}sap-client=${client}&sap-language=ZH`, {
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

for (const q of ['ZMSAG_*', 'ZSRVB_*']) {
  const s = await req('GET', `/sap/bc/adt/repository/informationsystem/search?query=${encodeURIComponent(q)}&operation=quickSearch&maxCount=100`, { accept: 'application/xml' });
  const hits = [...s.text.matchAll(/<adtcore:objectReference[^>]*adtcore:uri="([^"]+)"[^>]*adtcore:type="([^"]+)"/g)];
  for (const [, uri, type] of hits) {
    // unlock first (residual), then delete with the impc-compatible body.
    await req('POST', `${uri.replace('/sap/bc/adt', '')}?_action=UNLOCK`, { accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result' });
    const d = await req('POST', '/sap/bc/adt/deletion/delete', {
      ct: 'application/vnd.sap.adt.deletion.request.v1+xml', accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core"><del:object adtcore:uri="${uri}" adtcore:type="${type}"></del:object></del:deletionRequest>`,
    });
    console.log(`${d.status < 300 ? '✅' : '❌'} ${uri.split('/').pop()}: ${d.status}`);
  }
}
console.log('done');
