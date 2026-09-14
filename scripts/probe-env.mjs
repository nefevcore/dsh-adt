/** Connectivity probe for the two impc environments (ZH language). */
const [url, client, user, password, language = 'ZH'] = process.argv.slice(2);
const auth = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 1. discovery Accept probe (the gateway names what it wants)
const r = await fetch(`${url}/sap/bc/adt/core/discovery?sap-client=${client}&sap-language=${language}`, {
  headers: { Authorization: auth, Accept: 'application/atomsvc+xml', 'x-csrf-token': 'fetch' },
});
console.log(`discovery: HTTP ${r.status}`);
const cookies = (r.headers.getSetCookie() ?? []).map((c) => c.split(';')[0]).join('; ');
console.log(`cookies: ${cookies ? 'yes' : 'NO'}`);
const token = r.headers.get('x-csrf-token');
console.log(`csrf: ${token ? 'yes' : 'NO'}`);
const text = await r.text().catch(() => '');
console.log(`body length: ${text.length}`);
// Count the collections relevant to the fs matrix.
const hrefs = [...text.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
console.log(`collections: ${hrefs.length}`);
const interesting = hrefs.filter((h) => /ddic|ddls|dcl|ddlx|bdef|srvdef|businessservices|functions|programs|oo\/|messageclass|lockobject|typegroup/.test(h));
console.log('relevant collections:');
for (const h of interesting) console.log(`  ${h}`);

// 2. system info shape
const s = await fetch(`${url}/sap/bc/adt/repository/systeminfo?sap-client=${client}&sap-language=${language}`, {
  headers: { Authorization: auth, Accept: 'application/xml' },
});
console.log(`\nsysteminfo: HTTP ${s.status}`);
const st = await s.text().catch(() => '');
const rel = st.match(/<release[^>]*>([^<]*)</)?.[1] ?? st.match(/release="([^"]*)"/)?.[1];
console.log(`release: ${rel ?? '?'}`);
