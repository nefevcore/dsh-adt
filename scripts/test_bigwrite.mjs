import { AdtClient } from '../packages/adt-protocol/lib/index.js';
const client = new AdtClient({ url: 'https://impcerpdev01.impc.com.cn:44300', client: '110', language: 'ZH',
  auth: { type: 'basic', username: 'ABAP04', password: 'ngfcoiVY3vpzKkd+JeL@' }, strictSSL: false });
const uri = '/sap/bc/adt/programs/programs/zai_tmp_bigwrite';
const lines = ['REPORT zai_tmp_bigwrite.'];
for (let i = 0; i < 3000; i++) lines.push(`* line ${i}`);
lines.push(`WRITE: / 'ok'.`);
const big = lines.join('\n') + '\n';
console.log('big bytes:', Buffer.byteLength(big));
try {
  await client.updateSource(uri, big);
  console.log('OK big $TMP write ok');
} catch (e) {
  console.error('FAIL big $TMP write:', e instanceof Error ? e.message : String(e), 'status:', e?.status);
}
