// 以系统原始字节为基准重新拼接：只替换 chat_audit 方法块，其余字节不动（保留 CRLF/空行）
// 输出：① 新类源码文件（UTF-8，与系统格式一致）② chat_audit 旧→新 的 unified diff
import { writeFileSync } from 'node:fs';
import { AdtClient } from '../packages/adt-protocol/lib/index.js';

const client = new AdtClient({ url: 'https://impcerpdev01.impc.com.cn:44300', client: '110', language: 'ZH',
  auth: { type: 'basic', username: 'ABAP04', password: 'ngfcoiVY3vpzKkd+JeL@' }, strictSSL: false });
const uri = '/sap/bc/adt/oo/classes/zcl_fi_ai_approval';
const res = await client.request({ path: `${uri}/source/main`, accept: 'text/plain' });
const sys = res.text;
console.log('系统源码 bytes:', Buffer.byteLength(sys), '| BOM:', sys.charCodeAt(0) === 0xfeff);

// 提取系统当前 chat_audit 块（CRLF 下定位）
const startMarker = '  METHOD chat_audit.';
const endMarker = '  ENDMETHOD.';
const start = sys.indexOf(startMarker);
if (start < 0) throw new Error('未找到 METHOD chat_audit.');
const end = sys.indexOf(endMarker, start);
if (end < 0) throw new Error('未找到 chat_audit 的 ENDMETHOD.');
const oldBlock = sys.slice(start, end + endMarker.length);
console.log('旧 chat_audit 块 bytes:', Buffer.byteLength(oldBlock));

// 新方法块（从本地补丁文件提取），并转成 CRLF 与系统格式一致
import { readFileSync } from 'node:fs';
const patch = readFileSync('C:/Users/xiaofeng/Documents/Dev/WorkDev/abap/app/ImpcAgent/tmp/rule/ZCL_FI_AI_APPROVAL_CHAT_AUDIT_完整方法.abap', 'utf-8');
const ms = patch.indexOf('  METHOD chat_audit.');
const me = patch.indexOf('  ENDMETHOD.', ms) + '  ENDMETHOD.'.length;
let newBlock = patch.slice(ms, me);
newBlock = newBlock.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'); // 统一为 CRLF
console.log('新 chat_audit 块 bytes:', Buffer.byteLength(newBlock));

// 拼接：保留系统其余字节
const newSys = sys.slice(0, start) + newBlock + sys.slice(end + endMarker.length);
console.log('新类 bytes:', Buffer.byteLength(newSys), '| 与原差:', Buffer.byteLength(newSys) - Buffer.byteLength(sys));

writeFileSync('C:/Users/xiaofeng/Documents/Dev/WorkDev/abap/app/ImpcAgent/tmp/rule/ZCL_FI_AI_APPROVAL_NEW2.abap', newSys, 'utf-8');

// 生成 unified diff（旧 chat_audit vs 新 chat_audit）
const a = oldBlock.split('\n').map((l) => l.replace(/\r$/, ''));
const b = newBlock.split('\n').map((l) => l.replace(/\r$/, ''));
const difflib = await import('node:module').then(() => {});
const { execFileSync } = await import('node:child_process');
writeFileSync('C:/Users/xiaofeng/Documents/Dev/WorkDev/abap/app/ImpcAgent/tmp/rule/chat_audit.old.abap', a.join('\n'), 'utf-8');
writeFileSync('C:/Users/xiaofeng/Documents/Dev/WorkDev/abap/app/ImpcAgent/tmp/rule/chat_audit.new.abap', b.join('\n'), 'utf-8');
console.log('已输出: ZCL_FI_AI_APPROVAL_NEW2.abap / chat_audit.old.abap / chat_audit.new.abap');
console.log('旧块行数:', a.length, '| 新块行数:', b.length);
