// 原样读取系统上 ZCL_FI_AI_APPROVAL 的源码字节（直接 HTTP，不经解析）
import { AdtClient } from '../packages/adt-protocol/lib/index.js';
const client = new AdtClient({ url: 'https://impcerpdev01.impc.com.cn:44300', client: '110', language: 'ZH',
  auth: { type: 'basic', username: 'ABAP04', password: 'ngfcoiVY3vpzKkd+JeL@' }, strictSSL: false });
const uri = '/sap/bc/adt/oo/classes/zcl_fi_ai_approval';
try {
  const res = await client.request({ path: `${uri}/source/main`, accept: 'text/plain' });
  const src = res.text;
  console.log('bytes:', Buffer.byteLength(src), '| lines:', src.split('\n').length);
  console.log('--- 前 300 字节 (JSON 转义) ---');
  console.log(JSON.stringify(src.slice(0, 300)));
  const blanks = src.split('\n').filter((l) => l.trim() === '').length;
  console.log('空行总数:', blanks);
  // 连续空行最大 run
  let maxRun = 0, run = 0;
  for (const l of src.split('\n')) {
    if (l.trim() === '') { run++; maxRun = Math.max(maxRun, run); } else run = 0;
  }
  console.log('最大连续空行:', maxRun);
} catch (e) {
  console.error('FAIL:', e instanceof Error ? e.message : String(e), 'status:', e?.status);
}
