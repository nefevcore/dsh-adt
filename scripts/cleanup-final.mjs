/** Batch delete my leftovers — FULL URI in the deletion body (that was the bug). */
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

// MY objects only (probe + verify rounds).
const mine = /^Z(PROBE_[0-9]|PROBE_2|PROBE_3|LOCK_[0-9]|LK2_|LK3_|LK4_|LK5_|MIN_[0-9]|TAB_[0-9]|PUT_[0-9]|DOMA_[0-9]|DTEL_[0-9]|TTYP_[0-9]|TBL_[0-9]|DDLS_[0-9]|DTAB_[0-9])/;
const targets = [];
for (const p of ['ZPROBE*', 'ZLOCK*', 'ZLK*', 'ZMIN_*', 'ZTAB_*', 'ZPUT*', 'ZDOMA_*', 'ZDTEL_*', 'ZTTYP_*', 'ZTBL_*', 'ZDDLS_*', 'ZDTAB*']) {
  const s = await req('GET', `/sap/bc/adt/repository/informationsystem/search?query=${encodeURIComponent(p)}&operation=quickSearch&maxCount=100`, { accept: 'application/xml' });
  if (s.status !== 200) continue;
  for (const [, uri, , name] of s.text.matchAll(/<adtcore:objectReference[^>]*adtcore:uri="([^"]+)"[^>]*adtcore:type="([^"]+)"[^>]*adtcore:name="([^"]+)"/g)) {
    if (mine.test(name) && !targets.some((t) => t.uri === uri)) targets.push({ uri, name }); // FULL uri kept
  }
}
console.log(`my leftovers: ${targets.length}`);

for (const t of targets) {
  const r = await req('POST', '/sap/bc/adt/deletion/delete', {
    ct: 'application/vnd.sap.adt.deletion.request.v1+xml',
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    body: `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core"><del:object adtcore:uri="${t.uri}"><del:transportNumber></del:transportNumber></del:object></del:deletionRequest>`,
  });
  console.log(`${r.status < 300 ? '✅' : '❌'} ${t.name}: ${r.status}`);
}
