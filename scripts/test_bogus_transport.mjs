import { readFileSync } from 'node:fs';
import { AdtClient } from '../packages/adt-protocol/lib/index.js';
const source = readFileSync('C:/Users/xiaofeng/Documents/Dev/WorkDev/abap/app/ImpcAgent/tmp/rule/ZCL_FI_AI_APPROVAL_NEW.abap', 'utf-8');
const client = new AdtClient({ url: 'https://impcerpdev01.impc.com.cn:44300', client: '110', language: 'ZH',
  auth: { type: 'basic', username: 'ABAP04', password: 'ngfcoiVY3vpzKkd+JeL@' }, strictSSL: false });
const uri = '/sap/bc/adt/oo/classes/zcl_fi_ai_approval';
try {
  await client.updateSource(uri, source, { transport: 'D01K999999' });
  console.log('OK write with bogus transport succeeded?!');
} catch (e) {
  console.error('FAIL with bogus transport:', e instanceof Error ? e.message : String(e), 'status:', e?.status);
}
