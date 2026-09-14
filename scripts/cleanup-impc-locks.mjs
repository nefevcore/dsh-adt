/** Release residual locks left by failed verification rounds (impc). */
const [url, client, user, password] = process.argv.slice(2);
const auth = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const CID = crypto.randomUUID();
const jar = new Map();
let csrf = '';
async function req(method, path, { accept = '*/*', ct, body, query = '' } = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const q = query ? `${sep}${query}&sap-client=${client}&sap-language=ZH` : `${sep}sap-client=${client}&sap-language=ZH`;
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const headers = {
    Authorization: auth, Accept: accept, 'sap-adt-connection-id': CID, 'x-sap-adt-sessiontype': 'stateful',
    ...(ct ? { 'Content-Type': ct } : {}), ...(csrf ? { 'x-csrf-token': csrf } : { 'x-csrf-token': 'fetch' }),
    ...(cookie ? { Cookie: cookie } : {}),
  };
  const res = await fetch(`${url}${path}${q}`, { method, headers, body });
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

// Find ZMSAG_* objects and release their locks (handle-less unlock), then delete.
for (const q of ['ZMSAG_*']) {
  const s = await req('GET', `/sap/bc/adt/repository/informationsystem/search?query=${encodeURIComponent(q)}&operation=quickSearch&maxCount=100`, { accept: 'application/xml' });
  for (const [, uri] of s.text.matchAll(/<adtcore:objectReference[^>]*adtcore:uri="([^"]+)"/g)) {
    console.log(`found: ${uri}`);
    // unlock (both spellings, handle-less)
    for (const u of [uri, uri.replace('/msgclass/', '/messageclass/')]) {
      const unl = await req('POST', `${u}?_action=UNLOCK`, { accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result' });
      console.log(`  unlock ${u.split('/').pop()} (${u.includes('msgclass') ? 'msgclass' : 'messageclass'}): ${unl.status}`);
    }
    // delete (impc form: no self-closing transportNumber — full element)
    const d = await req('POST', '/sap/bc/adt/deletion/delete', {
      ct: 'application/vnd.sap.adt.deletion.request.v1+xml', accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core"><del:object adtcore:uri="${uri}" adtcore:type="MSAG/N"></del:object></del:deletionRequest>`,
    });
    console.log(`  delete: ${d.status} ${d.status >= 400 ? d.text.replace(/\s+/g, ' ').slice(0, 150) : ''}`);
  }
}
