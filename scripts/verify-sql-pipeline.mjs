/**
 * LIVE smoke of the upgraded adt_data_preview SQL pipeline (P1 lint + P2
 * compiler + P3 associations) against a REAL ADT system.
 *
 * Usage:  node scripts/verify-sql-pipeline.mjs <url> <client> <user> <password> [name]
 *   e.g.  node scripts/verify-sql-pipeline.mjs https://180.167.68.213:44304 100 168013 'secret' deloitte-kic
 *
 * Read-only: every call is a data preview (SELECT). Creates one in-process
 * registry with a manual destination (strictSSL off — enterprise CA).
 */
import { AdtRegistry } from '../packages/adt-core/lib/registry.js';
import { LockLedger } from '../packages/adt-core/lib/locks.js';
import { dataPreviewTools } from '../packages/adt-core/lib/tools/datapreview.js';

const [url, client, user, password, name = 'kic-live'] = process.argv.slice(2);
if (!url || !client || !user || !password) {
  console.error('usage: node verify-sql-pipeline.mjs <url> <client> <user> <password> [name]');
  process.exit(1);
}

const registry = await AdtRegistry.create({
  demo: false,
  defaultDestination: name,
  destinations: [
    {
      name,
      url,
      client,
      language: 'EN',
      username: user,
      password,
      strictSSL: false,
    },
  ],
});
const tools = dataPreviewTools({ registry, ledger: new LockLedger() });
const preview = tools[0];
const exec = { signal: undefined };

let pass = 0;
let fail = 0;
const check = async (label, fn) => {
  try {
    const out = await fn();
    pass++;
    console.log(`\nPASS ${label}`);
    if (out !== undefined) console.log(String(out).slice(0, 400));
  } catch (e) {
    fail++;
    console.log(`\nFAIL ${label}: ${(e instanceof Error ? e.message : String(e)).slice(0, 400)}`);
  }
};

// --- 0. connectivity / single-table baseline --------------------------------
await check('single-table SELECT via freestyle (baseline)', async () => {
  const r = await preview.execute({ sql: 'SELECT * FROM T000', length: 3, destination: name }, exec);
  return `${r.source}: ${r.rows.length} rows, columns ${r.columns.slice(0, 5).map((c) => c.name).join(',')}`;
});

// --- 1. P1 lint rewrites ------------------------------------------------------
await check('lint: DESC/LIMIT auto-rewrite', async () => {
  const r = await preview.execute({ sql: 'SELECT MANDT, MTEXT FROM T000 ORDER BY MTEXT DESC LIMIT 5', length: 5, destination: name }, exec);
  const note = r.note ?? '';
  if (!/DESCENDING/.test(note) || !/LIMIT 5/.test(note)) throw new Error(`rewrites not noted: ${note}`);
  return `note: ${note.slice(0, 200)}`;
});

await check('lint: alias.col sent as written (no ~ swap)', async () => {
  const r = await preview.execute({ sql: "SELECT t.MTEXT FROM T000 t WHERE t.MANDT = '100'", length: 2, destination: name }, exec);
  if (/alias~col/.test(r.note ?? '')) throw new Error(`unexpected alias rewrite: ${r.note}`);
  return `rows: ${r.rows.length}`;
});

// --- 2. P2 compiler: JOIN ------------------------------------------------------
await check('compiler: INNER JOIN over two tables', async () => {
  const r = await preview.execute(
    { sql: "SELECT a.OBJ_NAME, b.MTEXT FROM TADIR a JOIN T000 b ON a.SRCDEP = b.MANDT WHERE a.OBJ_NAME = 'SAP_BASIS'", length: 3, destination: name },
    exec,
  );
  if (r.source !== 'sql (compiled)') throw new Error(`expected compiled source, got ${r.source}`);
  return `rows: ${JSON.stringify(r.rows).slice(0, 200)}`;
});

await check('compiler: aggregate + GROUP BY + ORDER BY DESC LIMIT', async () => {
  const r = await preview.execute(
    { sql: "SELECT t.MTEXT, COUNT(*) AS CNT FROM T000 t GROUP BY t.MTEXT ORDER BY CNT DESC LIMIT 3", length: 3, destination: name },
    exec,
  );
  if (r.source !== 'sql (compiled)') throw new Error(`expected compiled source, got ${r.source}`);
  return `rows: ${JSON.stringify(r.rows).slice(0, 200)}`;
});

await check('compiler: IN ( SELECT … ) subquery', async () => {
  const r = await preview.execute(
    { sql: "SELECT t.MTEXT FROM T000 t WHERE t.MANDT IN ( SELECT c.MANDT FROM T000 c WHERE c.MANDT = '100' )", length: 3, destination: name },
    exec,
  );
  if (r.source !== 'sql (compiled)') throw new Error(`expected compiled source, got ${r.source}`);
  return `rows: ${JSON.stringify(r.rows).slice(0, 200)}`;
});

// --- 3. hard refusals (zero traffic) -------------------------------------------
await check('lint: OR+LIKE refused', async () => {
  try {
    await preview.execute({ sql: "SELECT * FROM T000 WHERE MTEXT LIKE 'A%' OR MTEXT LIKE 'B%'", destination: name }, exec);
    throw new Error('should have been refused');
  } catch (e) {
    if (!/or-like/.test(e.message)) throw e;
    return 'refused as expected';
  }
});

// --- 4. P3 associations --------------------------------------------------------
// The /datapreview/cds actions are profile-gated: on backends that do not
// expose them (kic: 400 "DDL source could not be read"), the tool must
// degrade with a pointed message. Either outcome is a pass here.
await check('associations: list works or degrades with guidance', async () => {
  try {
    const r = await preview.execute({ name: 'I_RRBMASSRELEASEJOB', kind: 'DDLS', associations: true, destination: name }, exec);
    if (r.source !== 'associations') throw new Error(`source: ${r.source}`);
    return `rows: ${JSON.stringify(r.rows).slice(0, 200)}`;
  } catch (e) {
    if (!/Association navigation is not reachable|not available/i.test(e.message)) throw e;
    return 'degraded with guidance (read the DDLS source instead)';
  }
});

// CDS view data itself must be readable (protocol SQL fallback for the
// entity preview path).
await check('CDS view readable via entity path (SQL fallback)', async () => {
  const r = await preview.execute({ name: 'I_RRBMASSRELEASEJOB', kind: 'DDLS', length: 2, destination: name }, exec);
  return `columns: ${r.columns.slice(0, 4).map((c) => c.name).join(',')} … rows: ${r.rows.length}`;
});

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
process.exit(fail > 0 ? 1 : 0);
