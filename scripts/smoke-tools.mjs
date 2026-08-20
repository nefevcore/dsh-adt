/** Runtime smoke test: exercise the tool layer against the in-process mock ADT
 *  server. Run: node scripts/smoke-tools.mjs (after pnpm build). */
import { AdtRegistry } from '../packages/dsh-plugin-abap-adt/lib/registry.js';
import { LockLedger } from '../packages/dsh-plugin-abap-adt/lib/locks.js';
import { builtinDefaults } from '../packages/dsh-plugin-abap-adt/lib/config.js';
import { readTools } from '../packages/dsh-plugin-abap-adt/lib/tools/read.js';
import { writeTools } from '../packages/dsh-plugin-abap-adt/lib/tools/write.js';
import { objectTools } from '../packages/dsh-plugin-abap-adt/lib/tools/objects.js';
import { lifecycleTools } from '../packages/dsh-plugin-abap-adt/lib/tools/lifecycle.js';
import { searchTools } from '../packages/dsh-plugin-abap-adt/lib/tools/search.js';
import { systemTools } from '../packages/dsh-plugin-abap-adt/lib/tools/system.js';
import { policyTools } from '../packages/dsh-plugin-abap-adt/lib/tools/policy.js';
import { lockTools } from '../packages/dsh-plugin-abap-adt/lib/tools/lock.js';
import { gateTools } from '../packages/dsh-plugin-abap-adt/lib/tools/gate.js';
import { batchTools } from '../packages/dsh-plugin-abap-adt/lib/tools/batch.js';
import { dumpTools } from '../packages/dsh-plugin-abap-adt/lib/tools/dumps.js';
import { executeTools } from '../packages/dsh-plugin-abap-adt/lib/tools/execute.js';
import { structureTools } from '../packages/dsh-plugin-abap-adt/lib/tools/structure.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const config = { ...builtinDefaults(), demo: true, demoPort: 0 };
const registry = await AdtRegistry.create(config);
const deps = { registry, ledger: new LockLedger() };
const fakeCtx = { fs: undefined };
const exec = { signal: undefined };

const all = [
  ...systemTools(deps),
  ...searchTools(deps),
  ...readTools(deps),
  ...writeTools(deps, fakeCtx),
  ...objectTools(deps),
  ...lifecycleTools(deps),
  ...gateTools(deps),
  ...batchTools(deps, fakeCtx),
  ...policyTools(deps),
  ...lockTools(deps),
  ...dumpTools(deps),
  ...executeTools(deps),
  ...structureTools(deps),
];
console.log(`tools registered: ${all.length}`);
const by = new Map(all.map((t) => [t.name, t]));

// 1. destinations
const dests = await by.get('adt_list_destinations').execute({}, exec);
console.log(`destinations: ${dests.destinations.map((d) => `${d.name}(ok=${d.ok})`).join(', ')}`);

// 2. permissions — per-destination report present
const perms = await by.get('adt_permissions').execute({}, exec);
console.log(`permissions: global transports=${perms.enableTransports}, perDestination keys=[${Object.keys(perms.perDestination).join(',')}]`);

// 3. search with packageName filter + offset
const s = await by.get('adt_search').execute({ query: 'ZCL_DEMO', packageName: 'ZPACK_DEMO', maxResults: 5 }, exec);
console.log(`search pkg-filtered: count=${s.count} kept=${s.objects.length}${s.note ? ` note="${s.note}"` : ''}`);
const s2 = await by.get('adt_search').execute({ query: 'Z*', offset: 2, maxResults: 3 }, exec);
console.log(`search offset=2: kept=${s2.objects.length + s2.sources.length} offset=${s2.offset}${s2.note ? ` note="${s2.note.slice(0, 80)}"` : ''}`);

// 4. read full + windowed
const r = await by.get('adt_read_object').execute({ name: 'ZCL_DEMO', type: 'CLAS' }, exec);
console.log(`read full: ${r.name}, ${r.totalLines} lines`);
const rw = await by.get('adt_read_object').execute({ name: 'ZCL_DEMO', type: 'CLAS', startLine: 5, endLine: 8 }, exec);
console.log(`read window: lines ${rw.startLine}..${rw.endLine} of ${rw.totalLines} → ${rw.source.split('\n').length} lines returned`);

// 5. write with activate=true
const w = await by.get('adt_write_object').execute(
  { name: 'ZCL_DEMO', type: 'CLAS', source: r.source, activate: true },
  exec,
);
console.log(`write+activate: updated=${w.updated} unlocked=${w.unlocked} activated=${w.activated} activation.success=${w.activation?.success}`);

// 6. edit block (hardened matching) + ambiguity rejection
const e = await by.get('adt_edit_object').execute(
  { name: 'ZCL_DEMO', type: 'CLAS', start: 'METHOD greet', source: 'METHOD greet.\n    rv_greeting = |smoke, { iv_name }|.\n  ENDMETHOD.' },
  exec,
);
console.log(`edit: lines ${e.startLineNumber}..${e.endLineNumber} (${e.oldLines}->${e.newLines})`);
try {
  await by.get('adt_edit_object').execute(
    { name: 'ZCL_DEMO', type: 'CLAS', start: 'METHOD', source: 'METHOD x.\nENDMETHOD.' },
    exec,
  );
  console.log('edit ambiguity: NOT DETECTED (unexpected)');
} catch (err) {
  console.log(`edit ambiguity rejected: ${String(err.message).slice(0, 90)}…`);
}

// 7. create a domain (DOMA) + read it back
const c = await by.get('adt_create_object').execute(
  { type: 'DOMA', name: 'ZSMOKE_DOMA', description: 'smoke domain', packageName: '$TMP' },
  exec,
);
console.log(`create DOMA: success=${c.success} uri=${c.uri}`);
const rd = await by.get('adt_read_object').execute({ name: 'ZSMOKE_DOMA', type: 'DOMA' }, exec);
console.log(`read DOMA: ${rd.name} (${rd.type}) source head="${rd.source.split('\n')[0]}"`);

// 8. check with objectName attribution
const c2 = await by.get('adt_check').execute({ objects: [{ name: 'ZCL_DEMO', type: 'CLAS' }, { name: 'ZSMOKE_DOMA', type: 'DOMA' }] }, exec);
console.log(`check: success=${c2.success} messages=${c2.messages.length} allTagged=${c2.messages.every((m) => m.objectName)}`);

// 9. export explicit object list (packageName no longer accepted)
const tmp = mkdtempSync(join(tmpdir(), 'adt-smoke-'));
const fakeFs = {
  resolve: async (p) => p,
  readText: async () => '',
  writeText: async () => undefined,
  listDir: async () => [],
};
const batchWithFs = batchTools(deps, { ...fakeCtx, fs: fakeFs });
const exportTool = batchWithFs.find((t) => t.name === 'adt_export_objects');
const x = await exportTool.execute(
  { objects: [{ name: 'ZCL_DEMO', type: 'CLAS' }, { name: 'ZSMOKE_DOMA', type: 'DOMA' }], targetDir: tmp },
  exec,
);
console.log(`export objects-only: exported=${x.exported} failed=${x.failed} files=${x.files.map((f) => f.name).join(', ')}`);
try {
  await exportTool.execute({ packageName: 'ZPACK_DEMO', targetDir: tmp }, exec);
  console.log('export packageName: STILL ACCEPTED (unexpected)');
} catch {
  console.log('export packageName: correctly rejected (objects list is mandatory)');
}
rmSync(tmp, { recursive: true, force: true });

// 10. unlock_all dry run (nothing released, candidates listed)
const d = await by.get('adt_unlock_all').execute({ dryRun: true }, exec);
console.log(`unlock dryRun: attempted=${d.attempted} released=${d.released.length} candidates=${d.failed.length}`);

// 11. gate + protocol-level batch
const g = await by.get('adt_release_gate').execute({ objects: [{ name: 'ZCL_DEMO', type: 'CLAS' }], stages: ['syntax'] }, exec);
console.log(`gate: verdict=${g.verdict} truncated=${g.truncated ?? false}`);
const batchWithFs2 = batchTools(deps, { ...fakeCtx, fs: undefined });
const batchTool = batchWithFs2.find((t) => t.name === 'adt_batch');
const b = await batchTool.execute(
  {
    requests: [
      { method: 'GET', path: '/sap/bc/adt/oo/classes/zcl_demo/source/main', accept: 'text/plain' },
      { method: 'GET', path: '/sap/bc/adt/programs/programs/zprog_demo/source/main', accept: 'text/plain' },
    ],
  },
  exec,
);
console.log(`batch: ok=${b.ok}/${b.requested} statuses=[${b.parts.map((p) => p.status).join(',')}]`);
try {
  await batchTool.execute({ requests: [{ method: 'POST', path: '/sap/bc/adt/oo/classes/zcl_x/source/main', body: 'x' }] }, exec);
  console.log('batch write without knob: NOT BLOCKED (unexpected)');
} catch (err) {
  console.log(`batch write blocked by policy: ${String(err.message).slice(0, 60)}…`);
}

// 12. dumps (error analysis)
const dl = await by.get('adt_list_dumps').execute({ user: 'DEMO' }, exec);
console.log(`dumps: count=${dl.count} first=${dl.dumps[0]?.title}`);
if (dl.dumps[0]) {
  const dg = await by.get('adt_get_dump').execute({ dumpId: dl.dumps[0].id }, exec);
  console.log(`dump detail: sections=${dg.sections.length} program=${dg.sections.find((s) => s.name === 'program')?.value}`);
}

// 13. execute program + class
const ex1 = await by.get('adt_execute').execute({ kind: 'PROG', name: 'ZPROG_DEMO' }, exec);
console.log(`execute PROG: status=${ex1.status} lines=${ex1.outputLines}`);
const ex2 = await by.get('adt_execute').execute({ kind: 'CLAS', name: 'ZCL_RUNNER' }, exec);
console.log(`execute CLAS: status=${ex2.status} head="${ex2.output.split('\n')[0]}"`);

// 14. structured editors (read + write)
const ms = await by.get('adt_read_structure').execute({ name: 'ZMSG_DEMO', type: 'MSAG' }, exec);
console.log(`read MSAG: ${ms.name} messages=${ms.messages.length}`);
const msWrite = await by.get('adt_write_structure').execute(
  { name: 'ZMSG_DEMO', type: 'MSAG', messages: [{ number: '001', text: 'Patched &1' }, { number: '009', text: 'Added' }] },
  exec,
);
console.log(`write MSAG: changed=${msWrite.changed.join(',')} messages after=${msWrite.data.messages.length}`);

await registry.dispose();
console.log('SMOKE OK');
