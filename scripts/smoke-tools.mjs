/** Runtime smoke test: exercise the tool layer against the in-process mock ADT
 *  server. Run: node scripts/smoke-tools.mjs (after pnpm build). */
import { AdtRegistry } from '../packages/dsh-plugin-abap-adt/lib/registry.js';
import { LockLedger } from '../packages/dsh-plugin-abap-adt/lib/locks.js';
import { DebuggerManager } from '../packages/dsh-plugin-abap-adt/lib/debugger.js';
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
import { selfcheckTools } from '../packages/dsh-plugin-abap-adt/lib/tools/selfcheck.js';
import { textElementTools } from '../packages/dsh-plugin-abap-adt/lib/tools/textelements.js';
import { cochangeTools } from '../packages/dsh-plugin-abap-adt/lib/tools/cochange.js';
import { debuggerTools } from '../packages/dsh-plugin-abap-adt/lib/tools/debugger.js';
import { crudTools } from '../packages/dsh-plugin-abap-adt/lib/tools/crud.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const config = { ...builtinDefaults(), demo: true, demoPort: 0 };
const registry = await AdtRegistry.create(config);
const debuggerManager = new DebuggerManager(registry);
const deps = { registry, ledger: new LockLedger(), debugger: debuggerManager };
// ctx fake WITHOUT dsh-fs (audit D1: fs is optional, resolved via ctx.get).
const fakeCtx = { get: (_name) => undefined };
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
  ...selfcheckTools(deps),
  ...textElementTools(deps),
  ...cochangeTools(deps),
  ...debuggerTools(deps),
];
// The compact CRUD facade routes by name — appended after the full catalog.
all.push(...crudTools(deps, new Map(all.map((t) => [t.name, t]))));
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

// 7. create a domain (DOMA) + read it back via the STRUCTURED editor
//    (the routing guard refuses DOMA in adt_read_object by design)
const c = await by.get('adt_create_object').execute(
  { type: 'DOMA', name: 'ZSMOKE_DOMA', description: 'smoke domain', packageName: '$TMP' },
  exec,
);
console.log(`create DOMA: success=${c.success} uri=${c.uri}`);
const rd = await by.get('adt_read_structure').execute({ name: 'ZSMOKE_DOMA', type: 'DOMA' }, exec);
console.log(`read DOMA (structure): ${rd.name} kind=${rd.kind}`);
try {
  await by.get('adt_read_object').execute({ name: 'ZSMOKE_DOMA', type: 'DOMA' }, exec);
  console.log('read DOMA via source: NOT GUARDED (unexpected)');
} catch (err) {
  console.log(`read DOMA via source correctly refused: ${String(err.message).slice(0, 60)}…`);
}

// 8. check with objectName attribution
const c2 = await by.get('adt_check').execute({ objects: [{ name: 'ZCL_DEMO', type: 'CLAS' }, { name: 'ZSMOKE_DOMA', type: 'DOMA' }] }, exec);
console.log(`check: success=${c2.success} messages=${c2.messages.length} allTagged=${c2.messages.every((m) => m.objectName)}`);

// 9. export explicit object list (packageName no longer accepted)
const tmp = mkdtempSync(join(tmpdir(), 'adt-smoke-'));
const fakeFs = {
  resolve: async (p, o) => {
    const displayPath = o?.cwd ? `${String(o.cwd).replace(/[\\/]+$/, '')}/${p}` : p;
    return { targetKey: `key:${displayPath}`, displayPath };
  },
  readText: async () => '',
  writeText: async () => undefined,
  listDir: async () => [],
};
const fsCtx = { get: (name) => (name === 'fs' ? fakeFs : undefined) };
const batchWithFs = batchTools(deps, fsCtx);
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
const batchWithFs2 = batchTools(deps, fakeCtx);
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

// 15. method-level read + dependency-context read (vsp-inspired features)
const rm = await by.get('adt_read_object').execute({ name: 'ZCL_DEMO', type: 'CLAS', method: 'greet' }, exec);
console.log(`read method greet: lines ${rm.startLine}..${rm.endLine} of ${rm.totalLines}`);
const rc = await by.get('adt_read_object').execute({ name: 'ZCL_DEMO~TEST', type: 'CLAS', context: true }, exec);
console.log(`read with context: prologue chars=${rc.contextPrologue?.length ?? 0} (unresolved deps visible: ${rc.contextPrologue?.includes('UNRESOLVED')})`);

// 16. capability sweep
const sc = await by.get('adt_selfcheck').execute({}, exec);
console.log(
  `selfcheck: probe=${sc.probeObject} answered=${sc.summary.answered} dead=${sc.summary.dead} broken=${sc.summary.broken} unprobed=${sc.unprobedTools.length}`,
);

// 17. text elements + co-change (P1-3 / P1-4)
const te = await by.get('adt_read_textelements').execute({ name: 'ZPROG_DEMO' }, exec);
console.log(`textelements: ${te.counts.symbols}I/${te.counts.selections}S/${te.counts.headings}H first=[${te.elements[0]?.id}:${te.elements[0]?.key}]`);
const cc = await by.get('adt_cochange').execute({ objects: [{ name: 'ZCL_DEMO', type: 'CLAS' }], top: 5 }, exec);
console.log(`cochange: transports=${cc.analyzedTransports.length} candidates=${cc.totalCandidates} top=${cc.coChanges[0]?.name ?? '(none)'}`);

// 18. TABL one-step creation with fields (P1-2)
const tbl = await by.get('adt_create_object').execute(
  {
    type: 'TABL',
    name: 'ZSMOKE_TABLE',
    description: 'smoke table',
    packageName: '$TMP',
    fields: [
      { name: 'ID', type: 'CHAR', length: 10, isKey: true },
      { name: 'AMOUNT', type: 'DEC', length: 13, decimals: 2 },
    ],
  },
  exec,
);
console.log(`create TABL with fields: success=${tbl.success} activated=${tbl.activated} ddl has MANDT=${tbl.ddlSource?.includes('key client : abap.clnt not null')}`);

// 19. read-side governance (P0-1): blocked-table deny before any request
const guardedRegistry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0, blockedTablesProfile: 'standard' });
try {
  const guardedDeps = { registry: guardedRegistry, ledger: new LockLedger(), debugger: new DebuggerManager(guardedRegistry) };
  const guardedPreview = (await import('../packages/dsh-plugin-abap-adt/lib/tools/datapreview.js')).dataPreviewTools(guardedDeps)[0];
  try {
    await guardedPreview.execute({ name: 'KNA1' }, exec);
    console.log('blockedTables: NOT BLOCKED (unexpected)');
  } catch (err) {
    console.log(`blockedTables deny: ${String(err.message).slice(0, 80)}…`);
  }
  const freeRead = await guardedPreview.execute({ name: 'MARA' }, exec);
  console.log(`blockedTables pass-through: MARA rows=${freeRead.rows.length}`);
} finally {
  await guardedRegistry.dispose();
}

// 20. debugger (P1-1) — policy OFF by default, then the full loop ON
try {
  await by.get('adt_debug_session').execute({ action: 'listen' }, exec);
  console.log('debugger policy: NOT BLOCKED (unexpected)');
} catch (err) {
  console.log(`debugger policy deny: ${String(err.message).slice(0, 60)}…`);
}
const debugRegistry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0, allowDebugger: true, allowDebugVariables: true });
try {
  const dbgDeps = { registry: debugRegistry, ledger: new LockLedger(), debugger: new DebuggerManager(debugRegistry) };
  const dbg = (await import('../packages/dsh-plugin-abap-adt/lib/tools/debugger.js')).debuggerTools(dbgDeps);
  const dby = new Map(dbg.map((t) => [t.name, t]));
  await dby.get('adt_debug_breakpoint').execute({ action: 'set', name: 'ZPROG_DEMO', type: 'PROG', line: 7 }, exec);
  const listen = await dby.get('adt_debug_session').execute({ action: 'listen', timeoutSeconds: 3 }, exec);
  console.log(`debug listen: hit=${listen.hit} program=${listen.debuggee?.program} line=${listen.debuggee?.line}`);
  const stack = await dby.get('adt_debug_inspect').execute({ action: 'stack' }, exec);
  console.log(`debug stack: frames=${stack.stack.entries.length} top=${stack.stack.entries[0]?.programName}`);
  const vars = await dby.get('adt_debug_inspect').execute({ action: 'variables', variables: ['LV_COUNT'] }, exec);
  console.log(`debug variables: LV_COUNT=${vars.variables[0]?.value}`);
  const sv = await dby.get('adt_debug_set_variable').execute({ name: 'LV_COUNT', value: '99' }, exec);
  console.log(`debug set variable: ${sv.name}=${sv.value}`);
  const detach = await dby.get('adt_debug_session').execute({ action: 'detach' }, exec);
  console.log(`debug detach: ${detach.detached}`);
} finally {
  await debugRegistry.dispose();
}

// 21. compact CRUD facade (matrix single source + routing)
const crud = by.get('adt_crud');
const card = await crud.execute({}, exec);
console.log(`crud status card: ${card.matrix.split('\n').length} type rows, head="${card.matrix.split('\n')[0]}"`);
const crudRead = await crud.execute({ verb: 'read', type: 'MSAG', name: 'ZMSG_DEMO' }, exec);
console.log(`crud read MSAG → ${crudRead.routedTool} (kind=${crudRead.kind})`);
const crudTabl = await crud.execute(
  { verb: 'create', type: 'TABL', name: 'ZSMOKE_CRUD_TBL', description: 'smoke crud', packageName: '$TMP', fields: [{ name: 'ID', type: 'CHAR', length: 6, isKey: true }] },
  exec,
);
console.log(`crud create TABL → ${crudTabl.routedTool} activated=${crudTabl.activated}`);
const crudDel = await crud.execute({ verb: 'delete', type: 'TABL', name: 'ZSMOKE_CRUD_TBL' }, exec);
console.log(`crud delete TABL → ${crudDel.routedTool} deleted=${crudDel.deleted}`);
try {
  await crud.execute({ verb: 'update', type: 'DEVC', name: 'ZPACK_DEMO' }, exec);
  console.log('crud unsupported verb: NOT DETECTED (unexpected)');
} catch (err) {
  console.log(`crud unsupported verb rejected: ${String(err.message).slice(0, 70)}…`);
}

await registry.dispose();
await debuggerManager.dispose();
console.log('SMOKE OK');
