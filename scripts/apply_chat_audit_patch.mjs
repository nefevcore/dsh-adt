// 完整写入 ZCL_FI_AI_APPROVAL（本地拼接后的新类源码）+ 激活
import { readFileSync } from 'node:fs';
import { AdtClient } from '../packages/adt-protocol/lib/index.js';

const source = readFileSync(
  'C:/Users/xiaofeng/Documents/Dev/WorkDev/abap/app/ImpcAgent/tmp/rule/ZCL_FI_AI_APPROVAL_NEW.abap',
  'utf-8',
);
console.log('source bytes:', Buffer.byteLength(source), '| lines:', source.split('\n').length);

const client = new AdtClient({
  url: 'https://impcerpdev01.impc.com.cn:44300',
  client: '110',
  language: 'ZH',
  auth: { type: 'basic', username: 'ABAP04', password: 'ngfcoiVY3vpzKkd+JeL@' },
  strictSSL: false,
});

const uri = '/sap/bc/adt/oo/classes/zcl_fi_ai_approval';
const obj = { uri, name: 'ZCL_FI_AI_APPROVAL', type: 'CLAS/OC' };
const TRANSPORT = 'D01K961066';

try {
  console.log('1) updateSource (transport ' + TRANSPORT + ') ...');
  await client.updateSource(uri, source, { transport: TRANSPORT });
  console.log('   ✅ write ok');
  console.log('2) activate ...');
  const result = await client.activate([obj], { transport: TRANSPORT });
  console.log('   ✅ activate ok:', JSON.stringify(result));
} catch (e) {
  console.error('   ❌ FAILED:', e instanceof Error ? e.message : String(e));
  if (e && typeof e === 'object' && 'status' in e) console.error('   status:', e.status);
  process.exitCode = 1;
}
