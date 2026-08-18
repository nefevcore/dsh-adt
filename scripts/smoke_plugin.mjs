// Plugin-level smoke: boot apply() with a stub ctx, verify tool registration,
// P5 (unknown destination), and the three P3 presentation cards.
process.env.DSH_HOME = (await import('node:os')).tmpdir() + '/dsh-smoke-' + Date.now();
const { mkdirSync } = await import('node:fs');
mkdirSync(process.env.DSH_HOME, { recursive: true });

const plugin = await import('../packages/dsh-plugin-abap-adt/lib/index.js');
const registered = [];
const disposeFns = [];
const ctx = {
  logger: undefined,
  fs: undefined,
  tools: { register: (def) => { registered.push(def); return () => {}; } },
};

const disposer = await plugin.apply(ctx, { demo: true, demoPort: 0 });
console.log('registered tools:', registered.length);

// --- P5: unknown destination must throw
const byName = (n) => registered.find((t) => t.name === n);
let p5 = 'NO THROW';
try { await byName('adt_ping').execute({ destination: 'prod-typo' }, { signal: new AbortController().signal }); }
catch (e) { p5 = e.message.slice(0, 80); }
console.log('P5 unknown dest ->', p5);

// default destination still works
const ping = await byName('adt_ping').execute({}, { signal: new AbortController().signal });
console.log('default dest ping ok:', ping.ok);

// --- P3 cards: search / read / diff presentationMeta + presentResult
const sig = new AbortController().signal;
const search = await byName('adt_search').execute({ query: 'zcl_demo' }, { signal: sig });
const searchTool = byName('adt_search');
const sm = searchTool.output.presentationMeta({ query: 'zcl_demo' }, { query: 'zcl_demo', count: 2, note: undefined, objects: [{ objectName: 'ZCL_DEMO', type: 'CLAS/OC', uri: '/x', description: 'd' }], sources: [] });
console.log('search meta card:', sm?.card, sm?.shape, 'paths:', sm?.paths?.length);
const sv = searchTool.presentResult({ query: 'zcl_demo' }, { content: [], isError: false, meta: sm });
console.log('search presentResult:', sv?.card, sv?.shape);

const read = await byName('adt_read_object').execute({ name: 'zcl_demo', type: 'CLAS' }, { signal: sig });
const rm = searchTool && byName('adt_read_object').output.presentationMeta({ name: 'zcl_demo' }, read);
console.log('read meta:', rm?.card === undefined ? '(meta object)' : '', rm?.path, 'lines:', rm?.lines?.length, 'lang:', rm?.lang);
const rv = byName('adt_read_object').presentResult({ name: 'zcl_demo' }, { content: [], isError: false, meta: rm });
console.log('read presentResult:', rv?.card, rv?.path, rv?.totalLines);

const diff = await byName('adt_version_diff').execute({ name: 'zcl_demo', type: 'CLAS' }, { signal: sig });
const dm = byName('adt_version_diff').output.presentationMeta({ name: 'zcl_demo' }, diff);
console.log('diff identical (no meta expected):', diff.identical, '-> meta:', dm);
// force a differing pair via versionTo
const diff2 = await byName('adt_version_diff').execute({ name: 'zcl_demo', type: 'CLAS', versionTo: 'active' }, { signal: sig });
console.log('diff2 identical:', diff2.identical);
const dm2 = byName('adt_version_diff').output.presentationMeta({ name: 'zcl_demo' }, diff2);
console.log('diff2 meta kind:', dm2?.kind, 'path:', dm2?.path?.slice(0, 40));
const dv2 = byName('adt_version_diff').presentResult({ name: 'zcl_demo' }, { content: [], isError: false, meta: dm2 });
console.log('diff presentResult:', dv2?.card, 'diffs:', dv2?.diffs?.length);

// --- P1 declarations sanity
const long = registered.filter((t) => typeof t.timeoutMs === 'number').map((t) => `${t.name}:${t.timeoutMs}`);
console.log('timeoutMs declared:', long.join(', '));
const safe = registered.filter((t) => t.isConcurrencySafe?.({}) === true).map((t) => t.name);
console.log('isConcurrencySafe count:', safe.length);


// --- diff card with an actual change: edit the source, then diff active vs version
const wr = await byName('adt_write_object').execute(
  { name: 'zcl_demo', type: 'CLAS', source: 'class zcl_demo definition final.\nendclass.\n', unlock: true },
  { signal: new AbortController().signal },
);
console.log('write for diff:', wr.updated);
const diff3 = await byName('adt_version_diff').execute({ name: 'zcl_demo', type: 'CLAS', versionTo: '00000' }, { signal: sig });
const dm3 = byName('adt_version_diff').output.presentationMeta({ name: 'zcl_demo' }, diff3);
console.log('diff3 identical:', diff3.identical, '| meta kind:', dm3?.kind);
const dv3 = byName('adt_version_diff').presentResult({ name: 'zcl_demo' }, { content: [], isError: false, meta: dm3 });
console.log('diff presentResult card:', dv3?.card, '| diffs:', dv3?.diffs?.length, '| path:', dv3?.diffs?.[0]?.path?.slice(0, 50));
console.log('SMOKE COMPLETE');

await disposer();
console.log('disposed OK');
