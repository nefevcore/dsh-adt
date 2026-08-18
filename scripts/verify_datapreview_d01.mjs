// 验证：重建后的数据预览（实体预览回退 + freestyle POST）在 D01 上可用
import { AdtClient } from '../packages/adt-protocol/lib/index.js';

const client = new AdtClient({
  url: 'https://impcerpdev01.impc.com.cn:44300',
  client: '110',
  language: 'ZH',
  auth: { type: 'basic', username: 'ABAP04', password: 'ngfcoiVY3vpzKkd+JeL@' },
  strictSSL: false,
});

async function show(title, p) {
  try {
    const r = await p;
    console.log(`✅ ${title}: totalRows=${r.totalRows} cols=${r.columns.length} rows=${r.rows.length}`);
    console.log('   columns:', r.columns.map((c) => c.name).join(','));
    for (const row of r.rows.slice(0, 3)) {
      console.log('   row:', JSON.stringify(row).slice(0, 200));
    }
    if (r.rawXml) console.log('   rawXml head:', r.rawXml.slice(0, 120));
  } catch (e) {
    console.error(`❌ ${title}:`, e instanceof Error ? e.message : String(e));
  }
}

await show('entity preview ZAIFIT0038A (ddic, 回退)', client.dataPreview('ZAIFIT0038A', 'ddic', { top: 3 }));
await show('entity preview T001 (ddic, 回退)', client.dataPreview('T001', 'ddic', { top: 3 }));
await show('freestyle SQL ZFIT_AI_RESULT', client.runSqlQuery('SELECT * FROM ZFIT_AI_RESULT UP TO 3 ROWS', { top: 3 }));
