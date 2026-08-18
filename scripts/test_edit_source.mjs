import { readFileSync } from 'node:fs';
const new2 = readFileSync('C:/Users/xiaofeng/Documents/Dev/WorkDev/abap/app/ImpcAgent/tmp/rule/ZCL_FI_AI_APPROVAL_NEW2.abap', 'utf-8');
const oldBlock = readFileSync('C:/Users/xiaofeng/Documents/Dev/WorkDev/abap/app/ImpcAgent/tmp/rule/chat_audit.old.abap', 'utf-8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

function defaultEndFor(s) {
  s = s.trim().toUpperCase();
  if (/^(?:METHOD|CLASS-METHOD)\b/.test(s)) return 'ENDMETHOD.';
  if (/^FORM\b/.test(s)) return 'ENDFORM.';
  if (/^FUNCTION\b/.test(s)) return 'ENDFUNCTION.';
  if (/^MODULE\b/.test(s)) return 'ENDMODULE.';
  return undefined;
}
function replaceSourceBlock(source, startText, endText, replacement) {
  const nl = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r\n|\n/);
  const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  const startKey = norm(startText), endKey = norm(endText);
  let si = -1;
  for (let i = 0; i < lines.length; i++) { if (norm(lines[i] ?? '').includes(startKey)) { si = i; break; } }
  if (si < 0) throw new Error('未找到起始行 ' + startText);
  let ei = -1;
  for (let i = si + 1; i < lines.length; i++) { if (norm(lines[i] ?? '').includes(endKey)) { ei = i; break; } }
  if (ei < 0) throw new Error('未找到结束行 ' + endText);
  const block = replacement.replace(/\r\n/g, '\n').replace(/\n/g, nl);
  const before = lines.slice(0, si), after = lines.slice(ei + 1);
  const prefix = before.length ? before.join(nl) + nl : '';
  const suffix = after.length ? nl + after.join(nl) : '';
  return { full: prefix + block + suffix, oldLines: ei - si + 1, newLines: block.split(/\r\n|\n/).length };
}

// 测试1：chat_audit 方法回环（start + 自动推导 end）
const end1 = defaultEndFor('METHOD chat_audit.');
const r1 = replaceSourceBlock(new2, 'METHOD chat_audit.', end1, oldBlock);
console.log('测试1 方法回环:', Buffer.byteLength(r1.full) === 122627 ? 'OK(122627字节还原)' : 'FAIL ' + Buffer.byteLength(r1.full), '| 自动end=', end1, '| 行数', r1.oldLines, '→', r1.newLines);

// 测试2：程序 FORM 场景
const prog = 'REPORT ztest.\n\nFORM frm_a.\n  WRITE: / \'a\'.\nENDFORM.\n\nFORM frm_b.\n  WRITE: / \'b\'.\nENDFORM.\n';
const r2 = replaceSourceBlock(prog, 'FORM frm_a.', defaultEndFor('FORM frm_a.'), 'FORM frm_a.\n  WRITE: / \'A2\'.\nENDFORM.');
console.log('测试2 FORM 替换:', r2.full.includes('A2') && r2.full.includes('frm_b') ? 'OK' : 'FAIL');
console.log(r2.full.replace(/\r/g, ''));

// 测试3：end 找不到时报错
try { replaceSourceBlock(prog, 'FORM frm_x.', 'ENDFORM.', 'X'); console.log('测试3 FAIL(应报错)'); } catch (e) { console.log('测试3 未找到块报错 OK:', e.message.slice(0, 40)); }

