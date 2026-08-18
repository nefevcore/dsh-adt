// 端到端验证：重建后的 @abap-adt/protocol 在 D01 上 写入(LOCK→PUT→UNLOCK) + 激活
import { AdtClient } from '../packages/adt-protocol/lib/index.js';

const client = new AdtClient({
  url: 'https://impcerpdev01.impc.com.cn:44300',
  client: '110',
  language: 'ZH',
  auth: { type: 'basic', username: 'ABAP04', password: 'ngfcoiVY3vpzKkd+JeL@' },
  strictSSL: false,
});

const uri = '/sap/bc/adt/programs/programs/zai_tmp_act_fix';
const source = `*&---------------------------------------------------------------------*
*& Report zai_tmp_act_fix
*&---------------------------------------------------------------------*
REPORT zai_tmp_act_fix.
WRITE: / 'ADT fix verified 2026-08-17'.
`;

try {
  console.log('1) updateSource (LOCK → PUT → UNLOCK) ...');
  await client.updateSource(uri, source);
  console.log('   ✅ write ok');

  console.log('2) activate ...');
  const result = await client.activate([{ uri, name: 'ZAI_TMP_ACT_FIX', type: 'PROG/P' }]);
  console.log('   ✅ activate ok:', JSON.stringify(result));
} catch (e) {
  console.error('   ❌ FAILED:', e instanceof Error ? e.message : String(e));
  if (e && typeof e === 'object' && 'status' in e) console.error('   status:', e.status);
  process.exitCode = 1;
}
