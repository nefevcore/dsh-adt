import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { builtinDefaults } from '../lib/config.js';
import { AdtPolicyError } from '../lib/policy.js';
import { dumpTools } from '../lib/tools/dumps.js';
import { executeTools } from '../lib/tools/execute.js';
import { structureTools } from '../lib/tools/structure.js';
import { batchTools } from '../lib/tools/batch.js';
import { dataPreviewTools } from '../lib/tools/datapreview.js';
import { readTools } from '../lib/tools/read.js';
import { writeTools } from '../lib/tools/write.js';
import { objectTools } from '../lib/tools/objects.js';
import { lifecycleTools } from '../lib/tools/lifecycle.js';
import { versionTools } from '../lib/tools/versions.js';
import { transportTools } from '../lib/tools/transports.js';
import { testingTools } from '../lib/tools/testing.js';
import { sourcesEquivalent } from '../lib/snapshots.js';
import { replaceSourceBlock, replaceSourceText } from '../lib/tools/write.js';
import type { Context } from '@deepseek-ai/cordis';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Isolate DSH-home state (chiefly the persistent lock ledger) from the REAL
// user home: `node --test` runs test files as parallel processes and several
// of them construct LockLedger-backed tools — sharing ~/.dsh/storages across
// processes both pollutes the user's machine and races the M6 snapshot
// assertion ("no stale entry after a clean write"). locks.ts resolves the
// ledger path per operation, so setting the env here covers every ledger
// instance created in this process.
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'abap-adt-agent-tools-'));

/** The real production include (ZFIR_GXYH040_FRM, 2063 lines) as test data. */
const REAL_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'zfir_gxyh040_frm.abap'),
  'utf8',
);

/**
 * Tool-layer tests for the agent-scale additions: runtime dumps (error
 * analysis), program/class execution, protocol-level $batch, structured DDIC
 * editors, and data-preview offset/length — all against the in-process mock
 * destination, including the policy gates.
 */

const exec = { signal: undefined } as never;
// ctx fake WITHOUT dsh-fs (audit D1: fs is an optional service — every tool
// must tolerate its absence; filesystem-backed features degrade).
const fakeCtx = { get: (_name: string) => undefined } as unknown as Context;

let registry: AdtRegistry;
let strictRegistry: AdtRegistry;

before(async () => {
  registry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0 });
  strictRegistry = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    allowExecution: false,
    allowedPackages: '$TMP',
  });
});

after(async () => {
  await registry.dispose();
  await strictRegistry.dispose();
});

function tools(deps = { registry, ledger: new LockLedger() }, ctx: Context = fakeCtx) {
  const flat = [
    ...readTools(deps, ctx),
    ...writeTools(deps, ctx),
    ...dumpTools(deps),
    ...executeTools(deps),
    ...structureTools(deps),
    ...batchTools(deps, ctx),
    ...dataPreviewTools(deps),
    ...objectTools(deps),
    ...lifecycleTools(deps),
    ...versionTools(deps),
    ...transportTools(deps),
    ...testingTools(deps),
  ];
  return new Map(flat.map((t) => [t.name, t]));
}

test('adt_list_dumps / adt_get_dump: error analysis against the mock', async () => {
  const by = tools();
  const list = await by.get('adt_list_dumps')!.execute({ user: 'DEMO' }, exec);
  assert.equal(list.count, 1);
  assert.equal(list.dumps[0]!.title, 'UNCAUGHT_EXCEPTION');

  const detail = await by.get('adt_get_dump')!.execute({ dumpId: list.dumps[0]!.id, view: 'formatted' }, exec);
  assert.equal(detail.view, 'formatted');
  assert.match(detail.raw!, /Runtime Errors: UNCAUGHT_EXCEPTION/);

  await assert.rejects(
    () => by.get('adt_get_dump')!.execute({}, exec),
    /dumpId/,
  );
});

test('adt_execute: runs programs and classrun classes; policy kill switch works', async () => {
  const by = tools();
  const prog = await by.get('adt_execute')!.execute({ kind: 'PROG', name: 'ZPROG_DEMO' }, exec);
  assert.equal(prog.status, 200);
  assert.ok(prog.output.includes('Hello, World!'));

  const cls = await by.get('adt_execute')!.execute({ kind: 'CLAS', name: 'ZCL_RUNNER' }, exec);
  assert.ok(cls.output.includes('Hello from ZCL_RUNNER'));

  // Non-runnable class surfaces the backend error.
  await assert.rejects(() => by.get('adt_execute')!.execute({ kind: 'CLAS', name: 'ZCL_DEMO' }, exec));

  // allowExecution=false denies before anything reaches the backend.
  const strict = tools({ registry: strictRegistry, ledger: new LockLedger() });
  await assert.rejects(
    () => strict.get('adt_execute')!.execute({ kind: 'PROG', name: 'ZPROG_DEMO' }, exec),
    (error: unknown) => error instanceof AdtPolicyError && error.rule === 'allowExecution',
  );
});

test('adt_batch: GET fan-out works; write parts need the policy knob', async () => {
  const by = tools();
  const result = await by.get('adt_batch')!.execute(
    {
      requests: [
        { method: 'GET', path: '/sap/bc/adt/oo/classes/zcl_demo/source/main', accept: 'text/plain' },
        { method: 'GET', path: '/sap/bc/adt/msgclass/zmsg_demo', accept: 'application/vnd.sap.adt.mc.messageclass+xml, application/xml' },
        { method: 'GET', path: '/sap/bc/adt/runtime/dumps' },
      ],
    },
    exec,
  );
  assert.equal(result.ok, 3);
  assert.equal(result.failed, 0);
  assert.ok(result.parts[0]!.body.startsWith('CLASS'));
  assert.ok(result.parts[1]!.body.includes('ZMSG_DEMO'));
  assert.ok(result.parts[2]!.body.includes('<feed'));

  // Blocked paths, regardless of knobs.
  await assert.rejects(
    () =>
      by.get('adt_batch')!.execute(
        { requests: [{ method: 'GET', path: '/sap/bc/adt/cts/transportrequests/S4HK900001/release' }] },
        exec,
      ),
    /blocked in \$batch.*human decision/,
  );
  // Non-GET without the knob.
  await assert.rejects(
    () =>
      by.get('adt_batch')!.execute(
        { requests: [{ method: 'PUT', path: '/sap/bc/adt/oo/classes/zcl_demo/source/main', body: 'x' }] },
        exec,
      ),
    (error: unknown) => error instanceof AdtPolicyError && error.rule === 'allowBatchWrites',
  );
  // Non-ADT paths rejected.
  await assert.rejects(
    () => by.get('adt_batch')!.execute({ requests: [{ path: 'http://evil.example/x' }] }, exec),
    /must be an absolute ADT path/,
  );
});

test('adt_batch: write part executes when the knob allows it', async () => {
  const permissive = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    allowBatchWrites: true,
  });
  try {
    const by = tools({ registry: permissive, ledger: new LockLedger() });
    const result = await by.get('adt_batch')!.execute(
      {
        allowWrites: true,
        requests: [
          {
            method: 'PUT',
            path: '/sap/bc/adt/programs/programs/zprog_demo/source/main',
            body: 'REPORT zprog_demo.\nWRITE / \'rewritten via batch\'.',
            contentType: 'text/plain; charset=utf-8',
            accept: 'text/plain',
          },
        ],
      },
      exec,
    );
    assert.equal(result.ok, 1, JSON.stringify(result.parts));
    // The write really landed.
    const check = await (await permissive.require()).client.readSource('/sap/bc/adt/programs/programs/zprog_demo');
    assert.ok(check.source.includes('rewritten via batch'));
  } finally {
    await permissive.dispose();
  }
});

test('adt_read_structure / adt_write_structure: structured editors with policy', async () => {
  const by = tools();
  const read = await by.get('adt_read_structure')!.execute({ name: 'ZMSG_DEMO', type: 'MSAG' }, exec);
  assert.equal(read.kind, 'MSAG');
  assert.equal(read.messages.length, 3);

  const written = await by.get('adt_write_structure')!.execute(
    {
      name: 'ZMSG_DEMO',
      type: 'MSAG',
      description: 'Patched by test',
      messages: [{ number: '001', text: 'Kept &1' }, { number: '009', text: 'Added &1' }],
    },
    exec,
  );
  assert.deepEqual(written.changed, ['description', 'messages(2)']);
  assert.equal(written.data.description, 'Patched by test');
  assert.deepEqual(written.data.messages.map((m: { number: string }) => m.number), ['001', '009']);

  // DOMA properties/fixedValues round-trip.
  const domaWritten = await by.get('adt_write_structure')!.execute(
    {
      name: 'ZDOMA_DEMO',
      type: 'DOMA',
      properties: { length: '3' },
      fixedValues: [{ low: 'ZZ', description: 'New value' }],
    },
    exec,
  );
  assert.equal((domaWritten.data.properties as Record<string, string>).length, '3');
  assert.equal((domaWritten.data.fixedValues as Array<{ low: string }>).length, 1);

  // Source objects are rejected with a pointer to adt_read_object.
  await assert.rejects(
    () => by.get('adt_read_structure')!.execute({ name: 'ZCL_DEMO', type: 'CLAS' }, exec),
    /adt_read_object/,
  );

  // Policy: allowedPackages=$TMP denies edits of ZPACK_DEMO objects.
  const strict = tools({ registry: strictRegistry, ledger: new LockLedger() });
  await assert.rejects(
    () =>
      strict.get('adt_write_structure')!.execute(
        { name: 'ZMSG_DEMO', type: 'MSAG', messages: [{ number: '001', text: 'nope' }] },
        exec,
      ),
    (error: unknown) => error instanceof AdtPolicyError && error.rule === 'allowedPackages',
  );
});

test('adt_data_preview: offset/length row-range window', async () => {
  const by = tools();
  const first = await by.get('adt_data_preview')!.execute({ name: 'ZCDS_DEMO', kind: 'DDLS', length: 5 }, exec);
  assert.equal(first.rows.length, 5);
  assert.equal(first.offset, 0);
  assert.equal(first.rows[0]!.ID, '1');

  const window = await by.get('adt_data_preview')!.execute(
    { name: 'ZCDS_DEMO', kind: 'DDLS', offset: 3, length: 4 },
    exec,
  );
  assert.equal(window.rows.length, 4);
  assert.equal(window.offset, 3);
  assert.equal(window.rows[0]!.ID, '4');
  assert.equal(window.rows.at(-1)!.ID, '7');

  // Freestyle SQL honors the same window.
  const sql = await by.get('adt_data_preview')!.execute(
    { sql: 'SELECT * FROM t001', offset: 2, length: 3 },
    exec,
  );
  assert.equal(sql.offset, 2);
  assert.equal(sql.rows.length, 3);
  assert.equal(sql.rows[0]!.ID, '3');
  assert.match(sql.note ?? '', /offset 2 applied/);
});

test('transport selection: user-specified request wins over the lock-assigned one', async () => {
  const by = tools();

  // 1. Write WITHOUT transport → backend auto-assigns (a fresh MOCKK task for
  //    a fresh object), and the output says so.
  const auto = await by.get('adt_write_object')!.execute(
    { name: 'ZCL_RUNNER', type: 'CLAS', source: 'CLASS zcl_runner DEFINITION.\nENDCLASS.' },
    exec,
  );
  assert.equal(auto.transportSource, 'auto');
  assert.match(auto.transport ?? '', /^MOCKK\d+$/);

  // 2. Lock reuses the open request the object now belongs to (no new task).
  const again = await by.get('adt_write_object')!.execute(
    { name: 'ZCL_RUNNER', type: 'CLAS', source: 'CLASS zcl_runner DEFINITION.\nENDCLASS.' },
    exec,
  );
  assert.equal(again.transportSource, 'auto');
  assert.equal(again.transport, auto.transport);

  // 3. Write WITH transport → the change is recorded into EXACTLY that
  //    request (overriding the lock-assigned one); the version feed of the
  //    object now carries it too.
  const chosen = await by.get('adt_write_object')!.execute(
    { name: 'ZCL_RUNNER', type: 'CLAS', source: 'CLASS zcl_runner DEFINITION.\nENDCLASS.', transport: 'S4HK900001' },
    exec,
  );
  assert.equal(chosen.transportSource, 'user');
  assert.equal(chosen.transport, 'S4HK900001');
  const versions = await (await registry.require()).client.getVersions('/sap/bc/adt/oo/classes/zcl_runner');
  assert.equal(versions[0]?.transportRequest, 'S4HK900001');

  // 4. adt_edit_object honors the same semantics.
  (await registry.require()).client.updateSource(
    '/sap/bc/adt/oo/classes/zcl_demo',
    'CLASS zcl_demo DEFINITION PUBLIC CREATE PUBLIC.\n  PUBLIC SECTION.\n    METHODS greet.\nENDCLASS.\n\nCLASS zcl_demo IMPLEMENTATION.\n  METHOD greet.\n  ENDMETHOD.\nENDCLASS.',
    { transport: 'S4HK900001' },
  );
  const editAuto = await by.get('adt_edit_object')!.execute(
    { name: 'ZCL_DEMO', type: 'CLAS', start: 'METHOD greet', source: 'METHOD greet.\n  ENDMETHOD.' },
    exec,
  );
  assert.equal(editAuto.transportSource, 'auto');
  assert.equal(editAuto.transport, 'S4HK900001');
  const editUser = await by.get('adt_edit_object')!.execute(
    { name: 'ZCL_DEMO', type: 'CLAS', start: 'METHOD greet', source: 'METHOD greet.\n  ENDMETHOD.', transport: 'S4HK900002' },
    exec,
  );
  assert.equal(editUser.transportSource, 'user');
  assert.equal(editUser.transport, 'S4HK900002');

  // 5. A disallowed transport number is denied before anything is written.
  const picky = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    allowedTransports: 'S4HK900001',
  });
  try {
    const pickyTools = tools({ registry: picky, ledger: new LockLedger() });
    await assert.rejects(
      () =>
        pickyTools.get('adt_write_object')!.execute(
          { name: 'ZCL_RUNNER', type: 'CLAS', source: 'x', transport: 'NARROW900001' },
          exec,
        ),
      (error: unknown) => error instanceof AdtPolicyError && error.rule === 'allowedTransports',
    );
  } finally {
    await picky.dispose();
  }
});

test('adt_activate hints: PROG include cascading + check-vs-activate scope', async () => {
  const by = tools();

  // 1. Successful activation of a PROG main object → hint about include
  //    non-cascading (the agent feedback scenario).
  const ok = await by.get('adt_activate')!.execute(
    { objects: [{ name: 'ZPROG_DEMO', type: 'PROG' }] },
    exec,
  );
  assert.equal(ok.success, true);
  assert.equal(ok.hints.length, 1);
  assert.match(ok.hints[0]!, /does NOT cascade to its includes/);
  assert.match(ok.hints[0]!, /adt_version_diff/);

  // CLAS activation carries no include hint (class pools activate as a whole).
  const cls = await by.get('adt_activate')!.execute(
    { objects: [{ name: 'ZCL_DEMO', type: 'CLAS' }] },
    exec,
  );
  assert.equal(cls.success, true);
  assert.equal(cls.hints.length, 0);

  // checkOnly (pre-audit, changes nothing) must not produce the include hint.
  const audit = await by.get('adt_activate')!.execute(
    { objects: [{ name: 'ZPROG_DEMO', type: 'PROG' }], checkOnly: true },
    exec,
  );
  assert.equal(audit.hints.length, 0);

  // 2. Failed activation → hint that adt_check passing is no guarantee.
  const client = (await registry.require()).client;
  const uri = '/sap/bc/adt/programs/programs/zprog_demo';
  const good = (await client.readSource(uri)).source;
  await client.updateSource(uri, 'REPORT zprog_demo.\nZBROKEN is not defined.');
  const bad = await by.get('adt_activate')!.execute(
    { objects: [{ name: 'ZPROG_DEMO', type: 'PROG' }] },
    exec,
  );
  assert.equal(bad.success, false);
  assert.ok(bad.hints.some((h: string) => /adt_check PASSING does not guarantee activation/.test(h)));
  // Restore the source for the other tests.
  await client.updateSource(uri, good);

  // 3. adt_check passing carries the scope caveat.
  const checked = await by.get('adt_check')!.execute(
    { objects: [{ name: 'ZCL_DEMO', type: 'CLAS' }] },
    exec,
  );
  assert.equal(checked.success, true);
  assert.equal(checked.hints.length, 1);
  assert.match(checked.hints[0]!, /does NOT guarantee activation will succeed/);
});

test('adt_version_diff: default = saved vs active (pending-activation check)', async () => {
  const by = tools();
  const client = (await registry.require()).client;
  const name = 'ZCL_FLAKY';
  const uri = '/sap/bc/adt/oo/classes/zcl_flaky';
  const original = (await client.readSource(uri)).source;

  try {
    // 1. Activate → saved == active → identical, nothing pending.
    const act = await by.get('adt_activate')!.execute({ objects: [{ name, type: 'CLAS' }] }, exec);
    assert.equal(act.success, true);
    const clean = await by.get('adt_version_diff')!.execute({ name, type: 'CLAS' }, exec);
    assert.equal(clean.fromLabel, 'saved');
    assert.equal(clean.toLabel, 'active');
    assert.equal(clean.identical, true);
    assert.equal(clean.pendingChanges, false);

    // 2. Write WITHOUT activating → the diff shows exactly the pending edit
    //    (diff direction is saved -> active, so the pending line is a `-`).
    await client.updateSource(uri, `${original}\n* pending edit`);
    const pending = await by.get('adt_version_diff')!.execute({ name, type: 'CLAS' }, exec);
    assert.equal(pending.identical, false);
    assert.equal(pending.pendingChanges, true);
    assert.match(pending.diff, /-\* pending edit/);

    // The active side still returns the last activated source.
    const activeSource = await client.readSource(uri, { version: 'active' });
    assert.ok(!activeSource.source.includes('pending edit'));
    const savedSource = await client.readSource(uri);
    assert.ok(savedSource.source.includes('pending edit'));

    // 3. Activate again → identical.
    await by.get('adt_activate')!.execute({ objects: [{ name, type: 'CLAS' }] }, exec);
    const after = await by.get('adt_version_diff')!.execute({ name, type: 'CLAS' }, exec);
    assert.equal(after.identical, true);
    assert.equal(after.pendingChanges, false);

    // 4. Explicit historical version ids still work (feed order irrelevant).
    const hist = await by.get('adt_version_diff')!.execute({ name, type: 'CLAS', versionFrom: '00000' }, exec);
    assert.equal(hist.fromLabel, '00000');
    assert.equal(typeof hist.diff, 'string');
    // Unknown id → helpful error listing the known ids.
    await assert.rejects(
      () => by.get('adt_version_diff')!.execute({ name, type: 'CLAS', versionFrom: '99999' }, exec),
      /99999.*not found in history/s,
    );
  } finally {
    // Restore the original source and re-activate so later tests see a
    // consistent state (active snapshot == saved source).
    await client.updateSource(uri, original);
    await by.get('adt_activate')!.execute({ objects: [{ name, type: 'CLAS' }] }, exec);
  }
});

test('adt_edit_object: single-line replacement (start == end, and end omitted)', async () => {
  const by = tools();
  const client = (await registry.require()).client;
  const uri = '/sap/bc/adt/programs/programs/zprog_demo';
  const original = (await client.readSource(uri)).source;

  try {
    // Seed a deterministic line to edit, exactly like the agent scenario
    // (a DELETE ... WHERE line inside a form include).
    const seeded = original.replace(
      'DATA(lo_demo) = NEW zcl_demo( ).',
      "DATA(lo_demo) = NEW zcl_demo( ).\n      DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'.",
    );
    await client.updateSource(uri, seeded);

    // 1. The reported bug: start == end (same single line) must replace
    //    exactly that line, not fail with "end not found".
    const same = await by.get('adt_edit_object')!.execute(
      {
        objectUri: uri,
        type: 'PROG',
        start: "DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'.",
        end: "DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'.",
        source: "      DELETE ct_extab WHERE fcode = 'ZEXP_VOL'.",
      },
      exec,
    );
    assert.equal(same.replaced, true);
    assert.equal(same.oldLines, 1);
    assert.equal(same.newLines, 1);
    const afterSame = (await client.readSource(uri)).source;
    assert.ok(afterSame.includes("'ZEXP_VOL'"));
    assert.ok(!afterSame.includes('ZEXPORT_VOL'));

    // 2. Same edit with `end` OMITTED — defaults to the start line.
    await client.updateSource(uri, seeded);
    const omitted = await by.get('adt_edit_object')!.execute(
      {
        objectUri: uri,
        type: 'PROG',
        start: "DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'.",
        source: "      DELETE ct_extab WHERE fcode = 'ZEXP_VOL'.",
      },
      exec,
    );
    assert.equal(omitted.replaced, true);
    assert.equal(omitted.oldLines, 1);
    assert.ok((await client.readSource(uri)).source.includes("'ZEXP_VOL'"));

    // 3. Not-found errors now carry the actionable hint (read back first).
    await assert.rejects(
      () =>
        by.get('adt_edit_object')!.execute(
          { objectUri: uri, type: 'PROG', start: 'NO SUCH LINE ANYWHERE.', source: 'x' },
          exec,
        ),
      /not found.*adt_read_object with startLine\/endLine/s,
    );

    // 4. Compact one-liner block: start and closer on the SAME line.
    const compact = `${original}\nFORM frm_one. ENDFORM.`;
    await client.updateSource(uri, compact);
    const one = await by.get('adt_edit_object')!.execute(
      {
        objectUri: uri,
        type: 'PROG',
        start: 'FORM frm_one.',
        end: 'ENDFORM.',
        source: 'FORM frm_one. "done\nENDFORM.',
      },
      exec,
    );
    assert.equal(one.replaced, true);
    assert.equal(one.oldLines, 1);
    assert.ok((await client.readSource(uri)).source.includes('"done'));
  } finally {
    await client.updateSource(uri, original);
  }
});

test('adt_edit_object: real-world Mod-block with Chinese comments (regression, impc-dev report)', async () => {
  const by = tools();
  const client = (await registry.require()).client;
  const uri = '/sap/bc/adt/programs/programs/zprog_demo';
  const original = (await client.readSource(uri)).source;

  // Exact shape of the reported source: full-line `*&&---` mod markers and
  // a Chinese `"` tail comment around the single line to replace. Proves the
  // comment stripping handles these (they strip to empty and never match)
  // and the failure was purely the single-line start==end gap.
  const modBlock = [
    '*&&--------Begin of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL',
    '      " 母码页签放出导出按钮',
    "      DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'.",
    '*&&--------End of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL',
  ].join('\n');
  try {
    await client.updateSource(uri, `${original}\n${modBlock}\n`);

    const edited = await by.get('adt_edit_object')!.execute(
      {
        objectUri: uri,
        type: 'PROG',
        start: "DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'.",
        end: "DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'.",
        source: "      DELETE ct_extab WHERE fcode = 'ZEXP_VOL'.",
      },
      exec,
    );
    assert.equal(edited.replaced, true);
    assert.equal(edited.oldLines, 1);
    assert.equal(edited.startLineNumber, edited.endLineNumber);

    const after = (await client.readSource(uri)).source;
    assert.ok(after.includes("'ZEXP_VOL'"));
    assert.ok(!after.includes('ZEXPORT_VOL'));
    // The mod markers and the Chinese comment survive untouched.
    assert.ok(after.includes('*&&--------Begin of Mod:'));
    assert.ok(after.includes('母码页签放出导出按钮'));
  } finally {
    await client.updateSource(uri, original);
  }
});

// ---------------------------------------------------------------------------
// Real production include (ZFIR_GXYH040_FRM, 2063 lines, Chinese comments,
// Mod markers, macros, duplicate lines, 31× ENDFORM / 59× ENDIF) — matcher
// scenarios run directly against replaceSourceBlock (pure function, fast).
// ---------------------------------------------------------------------------

test('real-world include: FORM block via derived closer (31 ENDFORMs in file)', () => {
  // start = FORM frm_get_data. → derived end = ENDFORM. — depth-paired to
  // the block's own closer (line 38), not any of the other 30 ENDFORMs.
  const r = replaceSourceBlock(
    REAL_SOURCE,
    'FORM frm_get_data .',
    'ENDFORM.',
    'FORM frm_get_data .\n  " replaced\nENDFORM.',
  );
  assert.equal(r.startLineNumber, 24);
  assert.equal(r.endLineNumber, 38);
  assert.equal(r.matchMode, 'structured');
  assert.ok(r.full.includes('" replaced'));
});

test('real-world include: marker copied verbatim WITH tail comment still matches', () => {
  // Line 322: `( fcode = 'ZPRINT_SUB' ) " 打印子码` — copying the full line
  // (comment included) must match (both sides comment-stripped).
  const marker = "( fcode = 'ZPRINT_SUB' ) \" 打印子码";
  const r = replaceSourceBlock(REAL_SOURCE, marker, marker, "    ( fcode = 'ZPRINT_SUB' ) \" 打印子码2", {
    occurrence: 1,
  });
  assert.equal(r.matchMode, 'text');
  assert.equal(r.startLineNumber, 322);
  // Matches BOTH duplicate lines (322 and 323) → ambiguous without occurrence.
  assert.throws(
    () => replaceSourceBlock(REAL_SOURCE, marker, marker, 'x'),
    /matches 2 lines.*#1 line 322.*#2 line 323/s,
  );
});

test('real-world include: occurrence disambiguates exact-duplicate lines', () => {
  const marker = "( fcode = 'ZPRINT_SUB' )";
  const second = replaceSourceBlock(
    REAL_SOURCE,
    marker,
    marker,
    "    ( fcode = 'ZPRINT_SUB2' )",
    { occurrence: 2 },
  );
  assert.equal(second.startLineNumber, 323); // the second duplicate
  assert.equal(second.occurrence, 2);
  assert.ok(second.full.includes("'ZPRINT_SUB2'"));
  const first = replaceSourceBlock(REAL_SOURCE, marker, marker, "    ( fcode = 'ZPRINT_SUB1' )", { occurrence: 1 });
  assert.equal(first.startLineNumber, 322);
  assert.throws(
    () => replaceSourceBlock(REAL_SOURCE, marker, marker, 'x', { occurrence: 3 }),
    /occurrence 3 is out of range.*matches 2 lines/,
  );
});

test('real-world include: spacing inside quotes tolerated (loose tier)', () => {
  // Line 181: `_init_fieldcat 'BUKRS  ' '公司代码' …` — agent writes 'BUKRS'
  // (single space collapsed/no space) → loose tier matches.
  const marker = "_init_fieldcat 'BUKRS' '公司代码' 'ZFIT_YSFJ_0003' 'BUKRS'.";
  const r = replaceSourceBlock(REAL_SOURCE, marker, marker, "  _init_fieldcat 'BUKRS' '公司代码2' 'ZFIT_YSFJ_0003' 'BUKRS'.");
  assert.equal(r.matchMode, 'text-loose');
  assert.equal(r.startLineNumber, 181);
  assert.ok(r.full.includes('公司代码2'));
});

test('real-world include: commented-out code addressable (raw tier)', () => {
  // Lines 223-225 are `*  _init_fieldcat …` — unreachable for stripped
  // matching; the raw tier must reach them.
  const marker = "*  _init_fieldcat 'ZSEL' '选择项' '' ''.";
  const r = replaceSourceBlock(REAL_SOURCE, marker, marker, "  _init_fieldcat 'ZSEL' '选择项' '' ''. \" re-enabled");
  assert.equal(r.matchMode, 'text-raw');
  assert.equal(r.startLineNumber, 223);
  assert.ok(r.full.includes('re-enabled'));
  // Marker without the `*` prefix also resolves to the commented line (raw tier).
  const bare = replaceSourceBlock(
    REAL_SOURCE,
    "_init_fieldcat 'ZSEL' '选择项' '' ''.",
    "_init_fieldcat 'ZSEL' '选择项' '' ''.",
    "  _init_fieldcat 'ZSEL' '选择项' '' ''. \" on",
  );
  assert.equal(bare.matchMode, 'text-raw');
});

test('real-world include: not-found errors suggest the closest real lines', () => {
  // A near-miss marker (wrong fc code) must list the actual DELETE siblings.
  assert.throws(
    () => replaceSourceBlock(REAL_SOURCE, "DELETE ct_extab WHERE fcode = 'ZPRINT_PP'.", "DELETE ct_extab WHERE fcode = 'ZPRINT_PP'.", 'x'),
    /not found.*closest lines:.*line 333.*CR_VOLUME.*line 334.*DE_VOLUME/s,
  );
  // A completely alien marker degrades to the generic hint without suggestions.
  assert.throws(
    () => replaceSourceBlock(REAL_SOURCE, 'QWERTYUIOP_ASDFGH', 'QWERTYUIOP_ASDFGH', 'x'),
    /not found in the 2063-line source.*(read the CURRENT source|startLine)/s,
  );
});

test('real-world include: line-number mode with stale-marker verification', () => {
  // Exact position edit: line 338 is the ZEXPORT_VOL DELETE inside the mod block.
  const r = replaceSourceBlock(REAL_SOURCE, '', '', "      DELETE ct_extab WHERE fcode = 'ZEXP_VOL'.", { startLine: 338 });
  assert.equal(r.matchMode, 'line-number');
  assert.equal(r.startLineNumber, 338);
  assert.ok(r.full.includes("'ZEXP_VOL'"));
  // Multi-line range: 336..339 (the whole Begin/End-of-Mod block incl. markers).
  const block = replaceSourceBlock(REAL_SOURCE, '', '', '      " gone', { startLine: 336, endLine: 339 });
  assert.equal(block.oldLines, 4);
  // Stale verification: wrong marker for that line must fail with the actual line.
  assert.throws(
    () => replaceSourceBlock(REAL_SOURCE, 'FORM frm_main .', '', 'x', { startLine: 338 }),
    /startLine 338 does not contain.*DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'/s,
  );
  // Out of range.
  assert.throws(
    () => replaceSourceBlock(REAL_SOURCE, '', '', 'x', { startLine: 99999 }),
    /out of range.*2063 lines/,
  );
});

test('real-world include: single-line edit via the tool against the mock', async () => {
  const by = tools();
  const client = (await registry.require()).client;
  const uri = '/sap/bc/adt/programs/programs/zprog_demo';
  const original = (await client.readSource(uri)).source;
  try {
    await client.updateSource(uri, REAL_SOURCE);
    const edited = await by.get('adt_edit_object')!.execute(
      {
        objectUri: uri,
        type: 'PROG',
        start: "DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'.",
        source: "      DELETE ct_extab WHERE fcode = 'ZEXP_VOL'.",
        transport: 'S4HK900001',
      },
      exec,
    );
    assert.equal(edited.replaced, true);
    assert.equal(edited.oldLines, 1);
    assert.equal(edited.startLineNumber, 338);
    assert.equal(edited.matchMode, 'text');
    const after = (await client.readSource(uri)).source;
    assert.ok(after.includes("'ZEXP_VOL'"));
    assert.equal(after.split('\n').length, REAL_SOURCE.split('\n').length); // only that line changed
  } finally {
    await client.updateSource(uri, original);
  }
});

// ---------------------------------------------------------------------------
// Structured end resolution (ENDFORM & friends by nesting depth)
// ---------------------------------------------------------------------------

test('structured ends: FORM resolved by depth, not first text hit', () => {
  // Explicit naked ENDFORM. → structural (depth-balanced), still line 38 even
  // though 30 more ENDFORMs follow.
  const r = replaceSourceBlock(REAL_SOURCE, 'FORM frm_get_data .', 'ENDFORM.', 'FORM frm_get_data .\nENDFORM.');
  assert.equal(r.matchMode, 'structured');
  assert.equal(r.startLineNumber, 24);
  assert.equal(r.endLineNumber, 38);
  // The inner IF/ENDIF nesting of the FORM is irrelevant for FORM pairing.
});

test('structured ends: nested IF resolved to the OUTER closer', () => {
  // Construct: an outer IF containing a nested IF — the first ENDIF belongs
  // to the INNER block; depth pairing must return the outer one.
  const src = [
    'FORM f.',
    '  IF a = 1.',
    '    IF b = 2.',
    '      DO 3 TIMES.',
    '      ENDDO.',
    '    ENDIF.',
    '    x = 1.',
    '  ENDIF.',
    '  y = 2.',
    'ENDFORM.',
  ].join('\n');
  const outer = replaceSourceBlock(src, 'IF a = 1.', 'ENDIF.', 'IF a = 1.\nENDIF.');
  assert.equal(outer.matchMode, 'structured');
  assert.equal(outer.startLineNumber, 2);
  assert.equal(outer.endLineNumber, 8); // NOT line 6 (the inner ENDIF)
  const inner = replaceSourceBlock(src, 'IF b = 2.', 'ENDIF.', 'IF b = 2.\nENDIF.');
  assert.equal(inner.endLineNumber, 6);
  assert.equal(inner.matchMode, 'structured');
  // Mixed families nest freely: DO inside IF does not disturb IF pairing.
  // (`DO 3 TIMES.` rather than bare `DO.` — a bare DO. is a substring of
  // ENDDO. and correctly reports a 2-line start ambiguity.)
  const doBlock = replaceSourceBlock(src, 'DO 3 TIMES.', 'ENDDO.', 'DO 3 TIMES.\nENDDO.');
  assert.equal(doBlock.endLineNumber, 5);
  assert.equal(doBlock.matchMode, 'structured');
});

test('structured ends: keyword text in strings, comments and CALL forms never counts', () => {
  const src = [
    'FORM f.',
    "  lv = 'xxx ENDFORM. yyy'. \" ENDFORM. in a tail comment",
    '* ENDFORM. fully commented',
    "  CALL FUNCTION 'SSF_OPEN'.",
    '  CALL METHOD lo_grid->check_changed_data.',
    '  lv2 = |tpl ENDFORM end|.',
    '  CLASS-METHODS: none_here.',
    '  ENDFORM.',
    'ENDFORM.',
  ].join('\n');
  // Only the last line balances the opener; everything above must not count.
  const r = replaceSourceBlock(src, 'FORM f.', 'ENDFORM.', 'FORM f.\nENDFORM.');
  assert.equal(r.matchMode, 'structured');
  assert.equal(r.endLineNumber, 8);
});

test('structured ends: TO UPPER/LOWER CASE does not open a CASE block', () => {
  const src = ['CASE sy-ucomm.', '  TRANSLATE lv TO UPPER CASE.', '  WHEN OTHERS.', 'ENDCASE.', 'ENDFORM.'].join('\n');
  const r = replaceSourceBlock(src, 'CASE sy-ucomm.', 'ENDCASE.', 'CASE sy-ucomm.\nENDCASE.');
  assert.equal(r.matchMode, 'structured');
  assert.equal(r.endLineNumber, 4);
});

test('structured ends: DEFINE pairs with END-OF-DEFINITION (real macro block)', () => {
  // Real lines 49-54: DEFINE _def_fetch_text. … END-OF-DEFINITION.
  const r = replaceSourceBlock(
    REAL_SOURCE,
    'DEFINE _def_fetch_text.',
    'END-OF-DEFINITION.',
    'DEFINE _def_fetch_text.\nEND-OF-DEFINITION.',
  );
  assert.equal(r.matchMode, 'structured');
  assert.equal(r.startLineNumber, 49);
  assert.equal(r.endLineNumber, 54);
});

test('structured ends: non-opener start with a naked closer falls back to text tiers', () => {
  // start = a PERFORM line inside frm_main, end = ENDFORM. → the start line
  // opens no block, so structural resolution is impossible; text matching
  // applies (first ENDFORM. at/after the start).
  const r = replaceSourceBlock(REAL_SOURCE, 'PERFORM frm_auth_check.', 'ENDFORM.', 'PERFORM frm_auth_check.\nENDFORM.');
  assert.equal(r.matchMode, 'text');
  assert.equal(r.startLineNumber, 11);
  assert.equal(r.endLineNumber, 18); // frm_main's ENDFORM.
});

test('structured ends: unbalanced depth falls back instead of mis-editing', () => {
  // A FORM whose ENDFORM was lost (syntax-broken source): depth never closes
  // → undefined → text fallback finds the FIRST ENDFORM (of the NEXT form),
  // which at least matches what text matching always did — no silent wrong
  // structural answer.
  const broken = 'FORM broken.\n  x = 1.\nFORM next.\nENDFORM.';
  const r = replaceSourceBlock(broken, 'FORM broken.', 'ENDFORM.', 'FORM broken.\nENDFORM.');
  assert.equal(r.matchMode, 'text');
  assert.equal(r.endLineNumber, 4);
});

test('structured ends: same-line compact block still resolves', () => {
  const src = 'REPORT x.\nFORM one. ENDFORM.\nFORM two.\nENDFORM.';
  const r = replaceSourceBlock(src, 'FORM one.', 'ENDFORM.', 'FORM one. ENDFORM.');
  assert.equal(r.matchMode, 'structured');
  assert.equal(r.startLineNumber, 2);
  assert.equal(r.endLineNumber, 2);
});

// ---------------------------------------------------------------------------
// oldText/newText mode (DSH-edit semantics)
// ---------------------------------------------------------------------------

test('oldText mode: multi-line verbatim quote incl. comments and CJK (real Mod block)', () => {
  // Quote lines 336-339 verbatim (the *&& Begin/End-of-Mod block with the
  // ZEXPORT_VOL DELETE and the Chinese comment inside) — must replace exactly.
  const quote = [
    '*&&--------Begin of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL',
    '      " 母码页签放出导出按钮',
    "      DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'.",
    '*&&--------End of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL',
  ].join('\n');
  const r = replaceSourceText(REAL_SOURCE, quote, '      " mod removed');
  assert.equal(r.matchMode, 'text');
  assert.equal(r.startLineNumber, 336);
  assert.equal(r.endLineNumber, 339);
  assert.equal(r.oldLines, 4);
  // The DELETE inside the mod block is gone (the fcode-LIST entry at line
  // 327 mentions ZEXPORT_VOL too and must SURVIVE).
  assert.ok(!r.full.includes("DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'"));
  assert.ok(r.full.includes("( fcode = 'ZEXPORT_VOL' ) \" 导出母码信息EXCEL"));
  // Verbatim quote with CRLF line endings matches an LF source just as well.
  const crlf = replaceSourceText(REAL_SOURCE, quote.replace(/\n/g, '\r\n'), 'x');
  assert.equal(crlf.startLineNumber, 336);
});

test('oldText mode: single-line quote goes through the tiered path', () => {
  const r = replaceSourceText(REAL_SOURCE, "DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'.", "      DELETE ct_extab WHERE fcode = 'ZEXP_VOL'.");
  assert.equal(r.oldLines, 1);
  assert.equal(r.startLineNumber, 338);
  // Spacing variance inside quotes (loose tier).
  const loose = replaceSourceText(REAL_SOURCE, "_init_fieldcat 'BUKRS' '公司代码' 'ZFIT_YSFJ_0003' 'BUKRS'.", '  x.');
  assert.equal(loose.matchMode, 'text-loose');
  assert.equal(loose.startLineNumber, 181);
});

test('oldText mode: ambiguity demands more context; occurrence picks', () => {
  const dup = "( fcode = 'ZPRINT_SUB' ) \" 打印子码";
  assert.throws(
    () => replaceSourceText(REAL_SOURCE, dup, 'x'),
    /matches 2 locations.*#1 line 322.*#2 line 323.*include neighboring lines/s,
  );
  // DSH-style disambiguation: extend the quote with a neighboring line. In
  // the source the order is SUB(322) SUB(323) PAR(324) — quote "SUB then PAR"
  // which matches only the SECOND duplicate (323..324).
  const extended = `${dup}\n( fcode = 'ZPRINT_PAR' ) " 打印母码`;
  const r = replaceSourceText(REAL_SOURCE, extended, '    ( fcode = ' + "'X'" + ' )');
  assert.equal(r.startLineNumber, 323); // the ZPRINT_SUB right before ZPRINT_PAR
  assert.equal(r.oldLines, 2);
  // occurrence also works on single-line duplicates.
  const second = replaceSourceText(REAL_SOURCE, dup, 'x', { occurrence: 2 });
  assert.equal(second.startLineNumber, 323);
});

test('oldText mode: not-found lists closest lines; mixed params rejected', () => {
  assert.throws(
    () => replaceSourceText(REAL_SOURCE, "DELETE ct_extab WHERE fcode = 'NOPE_X'.", 'x'),
    /not found.*closest lines/s,
  );
});

test('oldText mode via the tool against the mock (mode exclusivity + happy path)', async () => {
  const by = tools();
  const client = (await registry.require()).client;
  const uri = '/sap/bc/adt/programs/programs/zprog_demo';
  const original = (await client.readSource(uri)).source;
  try {
    await client.updateSource(uri, REAL_SOURCE);
    // Mixed params rejected.
    await assert.rejects(
      () =>
        by.get('adt_edit_object')!.execute(
          { objectUri: uri, type: 'PROG', oldText: 'FORM frm_main .', newText: 'x', start: 'FORM' },
          exec,
        ),
      /oldText.*cannot be combined/s,
    );
    // Happy path: replace the lv_title assignment (single line, unique).
    const edited = await by.get('adt_edit_object')!.execute(
      {
        objectUri: uri,
        type: 'PROG',
        oldText: "lv_title = '子码母码实时打印'.",
        newText: "  lv_title = 'NEW TITLE'.",
      },
      exec,
    );
    assert.equal(edited.replaced, true);
    assert.equal(edited.oldLines, 1);
    assert.equal(edited.startLineNumber, 306);
    const after = (await client.readSource(uri)).source;
    assert.ok(after.includes("'NEW TITLE'"));
  } finally {
    await client.updateSource(uri, original);
  }
});

// ---------------------------------------------------------------------------
// Snapshot OCC flow: read → edit local / edit via tool → verify → push
// ---------------------------------------------------------------------------

/** In-memory fake of the DSH filesystem service (enough for snapshots). */
function memFs() {
  const files = new Map<string, string>();
  const fs = {
    resolve: async (p: string) => p,
    readText: async (t: string) => {
      const v = files.get(t);
      if (v === undefined) throw new Error(`ENOENT: ${t}`);
      return v;
    },
    writeText: async (t: string, c: string) => {
      files.set(t, c);
    },
    listDir: async () => [] as string[],
  };
  const ctx = { get: (name: string) => (name === 'fs' ? fs : undefined) } as unknown as Context;
  return { files, fs, ctx };
}

test('snapshot OCC: read creates snapshot; edit matches it; drift → [CONFLICT]', async () => {
  const mem = memFs();
  const by = tools({ registry, ledger: new LockLedger() }, mem.ctx);
  const client = (await registry.require()).client;
  const uri = '/sap/bc/adt/oo/classes/zcl_flaky';
  const original = (await client.readSource(uri)).source;

  try {
    // 1. adt_read_object creates the local snapshot + sidecar (base hash).
    const r = await by.get('adt_read_object')!.execute({ name: 'ZCL_FLAKY', type: 'CLAS' }, exec);
    const snapPath = r.localCopy as string;
    assert.ok(snapPath.includes('.adt-snapshots/demo/zcl_flaky.clas.abap'));
    assert.ok(r.snapshotHash);
    assert.equal(mem.files.get(snapPath), original);
    const sidecar = JSON.parse(mem.files.get(`${snapPath}.json`)!);
    assert.equal(sidecar.baseHash, r.snapshotHash);
    assert.equal(sidecar.uri, uri);

    // 2. Edit via oldText — matched against the SNAPSHOT; applies; the
    //    snapshot is refreshed from the read-back.
    const e1 = await by.get('adt_edit_object')!.execute(
      { name: 'ZCL_FLAKY', type: 'CLAS', oldText: 'rv_q = iv_a / iv_b.', newText: '    rv_q = iv_a DIV iv_b.' },
      exec,
    );
    assert.equal(e1.replaced, true);
    const afterEdit = (await client.readSource(uri)).source;
    assert.ok(afterEdit.includes('DIV iv_b'));
    assert.equal(mem.files.get(snapPath), afterEdit); // refreshed

    // 3. Someone else writes (out-of-band) → edit refuses with [CONFLICT],
    //    server untouched, snapshot NOT clobbered.
    await client.updateSource(uri, `${afterEdit}\n* drifted`);
    await assert.rejects(
      () =>
        by.get('adt_edit_object')!.execute(
          { name: 'ZCL_FLAKY', type: 'CLAS', oldText: 'rv_q = iv_a DIV iv_b.', newText: 'x' },
          exec,
        ),
      (error: unknown) => /\[CONFLICT\]/.test((error as Error).message) && /adt_read_object/.test((error as Error).message),
    );
    assert.ok((await client.readSource(uri)).source.includes('drifted'));

    // 4. Re-read refreshes the base → the same edit now applies.
    await by.get('adt_read_object')!.execute({ name: 'ZCL_FLAKY', type: 'CLAS' }, exec);
    const e2 = await by.get('adt_edit_object')!.execute(
      { name: 'ZCL_FLAKY', type: 'CLAS', oldText: 'rv_q = iv_a DIV iv_b.', newText: '    rv_q = iv_a / iv_b.' },
      exec,
    );
    assert.equal(e2.replaced, true);
  } finally {
    await client.updateSource(uri, original);
  }
});

test('snapshot OCC: write_object refuses stale view; push uploads a locally edited file', async () => {
  const mem = memFs();
  const by = tools({ registry, ledger: new LockLedger() }, mem.ctx);
  const client = (await registry.require()).client;
  const uri = '/sap/bc/adt/oo/classes/zcl_flaky';
  const original = (await client.readSource(uri)).source;

  try {
    const r = await by.get('adt_read_object')!.execute({ name: 'ZCL_FLAKY', type: 'CLAS' }, exec);
    const snapPath = r.localCopy as string;

    // Fresh snapshot → full write passes and refreshes the snapshot.
    const w = await by.get('adt_write_object')!.execute({ name: 'ZCL_FLAKY', type: 'CLAS', source: original }, exec);
    assert.equal(w.updated, true);

    // Out-of-band drift → write refuses ([CONFLICT]) and the server keeps
    // the drifted state.
    await client.updateSource(uri, `${original}\n* drifted`);
    await assert.rejects(
      () => by.get('adt_write_object')!.execute({ name: 'ZCL_FLAKY', type: 'CLAS', source: original }, exec),
      /\[CONFLICT\]/,
    );
    assert.ok((await client.readSource(uri)).source.includes('drifted'));

    // Pull → edit the LOCAL file in place (simulating local file tools) →
    // push: verified upload lands, snapshot refreshed from read-back.
    await by.get('adt_read_object')!.execute({ name: 'ZCL_FLAKY', type: 'CLAS' }, exec);
    const local = (mem.files.get(snapPath) ?? '').replace('rv_q = iv_a / iv_b.', 'rv_q = iv_a DIV iv_b.');
    mem.files.set(snapPath, local);
    const p = await by.get('adt_push_object')!.execute({ name: 'ZCL_FLAKY', type: 'CLAS' }, exec);
    assert.equal(p.pushed, true);
    assert.equal(p.verified, true);
    assert.equal(p.localCopy, snapPath);
    const pushed = (await client.readSource(uri)).source;
    assert.ok(pushed.includes('DIV iv_b'));
    assert.equal(mem.files.get(snapPath), pushed); // refreshed after push

    // Drift again → push refuses with [CONFLICT]; local edit preserved.
    await client.updateSource(uri, `${pushed}\n* drifted2`);
    mem.files.set(snapPath, (mem.files.get(snapPath) ?? '').replace('DIV iv_b', 'MOD iv_b'));
    await assert.rejects(
      () => by.get('adt_push_object')!.execute({ name: 'ZCL_FLAKY', type: 'CLAS' }, exec),
      /\[CONFLICT\]/,
    );
    assert.ok((mem.files.get(snapPath) ?? '').includes('MOD iv_b')); // local edit kept
    assert.ok((await client.readSource(uri)).source.includes('drifted2'));

    // No snapshot at all → push tells the agent to read first.
    const fresh = memFs();
    const byFresh = tools({ registry, ledger: new LockLedger() }, fresh.ctx);
    await assert.rejects(
      () => byFresh.get('adt_push_object')!.execute({ name: 'ZCL_FLAKY', type: 'CLAS' }, exec),
      /no local snapshot.*adt_read_object first/s,
    );
  } finally {
    await client.updateSource(uri, original);
  }
});

// --- Real-world backend-quirk regressions (impc-dev / D01 feedback) ---------

test('include resolution: name+type=PROG resolves an include via search (include-404 regression)', async () => {
  const by = tools();

  // The agent passes type=PROG for a TOP include — naive by-convention URIs
  // pointed at /programs/programs/… and 404'd; resolution must consult the
  // search index and land on the include's real URI.
  const incl = await by.get('adt_read_object')!.execute({ name: 'ZPROG_DEMO_TOP', type: 'PROG' }, exec);
  assert.ok(incl.uri.endsWith('/programs/includes/zprog_demo_top'), `got ${incl.uri}`);
  assert.equal(incl.type, 'PROG/I');
  assert.match(incl.source, /gv_title/);

  // Explicit INCL type lands on the same URI.
  const inclTyped = await by.get('adt_read_object')!.execute({ name: 'ZPROG_DEMO_TOP', type: 'INCL' }, exec);
  assert.ok(inclTyped.uri.endsWith('/programs/includes/zprog_demo_top'));

  // A real main program still resolves to /programs/programs/.
  const main = await by.get('adt_read_object')!.execute({ name: 'ZPROG_DEMO', type: 'PROG' }, exec);
  assert.ok(main.uri.endsWith('/programs/programs/zprog_demo'));
});

test('sourcesEquivalent: tolerant of backend normalization, strict on real divergence', () => {
  // CRLF ↔ LF and trailing whitespace/blank lines at EOF are normalizations
  // real backends apply to stored sources — they must NOT trip the verifier.
  assert.ok(sourcesEquivalent('REPORT zfoo.\r\nWRITE / 1.\r\n', 'REPORT zfoo.\nWRITE / 1.'));
  assert.ok(sourcesEquivalent('REPORT zfoo.\nWRITE / 1. \t\n\n\n', 'REPORT zfoo.\nWRITE / 1.\n'));
  // Different content (the concurrent-overwrite case) is detected.
  assert.ok(!sourcesEquivalent('REPORT zfoo.\nWRITE / 1.', 'REPORT zfoo.\nWRITE / 2.'));
  assert.ok(!sourcesEquivalent('REPORT zfoo.', 'REPORT zfoo.\nWRITE / 1.'));
});

test('edit/write verify persistence after the write (concurrent-overwrite regression)', async () => {
  const by = tools();
  const client = (await registry.require()).client;
  const uri = '/sap/bc/adt/programs/includes/zprog_demo_top';
  const original = (await client.readSource(uri)).source;

  try {
    // Happy path: read-back matches → persisted=true, no warning.
    const edit = await by
      .get('adt_edit_object')!
      .execute({ name: 'ZPROG_DEMO_TOP', type: 'PROG', oldText: "VALUE 'demo'", newText: "VALUE 'demo2'" }, exec);
    assert.equal(edit.replaced, true);
    assert.equal(edit.persisted, true);
    assert.equal(edit.warning, undefined);

    // Same for a whole-source write.
    const good = (await client.readSource(uri)).source;
    const write = await by
      .get('adt_write_object')!
      .execute({ name: 'ZPROG_DEMO_TOP', type: 'PROG', source: good }, exec);
    assert.equal(write.updated, true);
    assert.equal(write.persisted, true);
    // The mismatch branch of the checker is covered by the sourcesEquivalent
    // unit test above — a well-behaved mock cannot simulate a post-write
    // concurrent overwrite.
  } finally {
    await client.updateSource(uri, original);
  }
});

test('adt_get_transport: a task number resolves to the parent request with a note', async () => {
  const by = tools();

  // S4HK900003 is a task of S4HK900001 (mock mirrors real CTO resolution).
  const task = await by.get('adt_get_transport')!.execute({ number: 'S4HK900003' }, exec);
  assert.equal(task.number, 'S4HK900001');
  assert.equal(task.requestedNumber, 'S4HK900003');
  assert.match(task.note ?? '', /task/i);
  assert.match(task.note ?? '', /S4HK900001/);

  // A direct request number → no note, numbers agree.
  const direct = await by.get('adt_get_transport')!.execute({ number: 'S4HK900001' }, exec);
  assert.equal(direct.number, 'S4HK900001');
  assert.equal(direct.note, undefined);
});

test('adt_run_atc surfaces per-finding include URIs and measured duration', async () => {
  const by = tools();

  const res = await by.get('adt_run_atc')!.execute({ objects: [{ name: 'ZPROG_DEMO', type: 'PROG' }] }, exec);
  assert.equal(res.clean, false);
  assert.ok(typeof res.durationMs === 'number');

  // ZPROG_DEMO carries a finding reported under the main program name whose
  // location points INTO the include — the uri field makes that mapping
  // explicit instead of forcing manual line-number guessing.
  const includeFinding = res.findings.find((f: { uri?: string }) => (f.uri ?? '').includes('/programs/includes/'));
  assert.ok(includeFinding, `expected an include-mapped finding, got ${JSON.stringify(res.findings)}`);
  assert.equal(includeFinding.objectName, 'ZPROG_DEMO');
  assert.equal(includeFinding.line, 3);
});

// ---------------------------------------------------------------------------
// Audit P0 regressions (docs/audit-fix-plan.md): H1 hint spoofing, H2 fuzzy
// resolution onto the wrong object, M2 $batch header injection / blacklist
// bypass.
// ---------------------------------------------------------------------------

test('H1: a packageName hint cannot spoof the package policy — backend fact wins', async () => {
  // ZCL_DEMO actually lives in ZPACK_DEMO (transportable). Two policies where
  // CLAIMING `$TMP` (local, always editable) would make the write pass —
  // the backend-reported package must decide instead.
  const transportGate = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    allowedPackages: 'Z*,$TMP',
    allowTransportableEdits: false,
  });
  const whitelistGate = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    allowedPackages: '$TMP',
  });
  try {
    // 1. allowedPackages=Z*,$TMP + allowTransportableEdits=false: the true
    //    package ZPACK_DEMO is transportable → [POLICY] deny.
    const t = tools({ registry: transportGate, ledger: new LockLedger() });
    await assert.rejects(
      () =>
        t.get('adt_write_object')!.execute(
          { name: 'ZCL_DEMO', type: 'CLAS', packageName: '$TMP', source: 'CLASS zcl_demo DEFINITION.\nENDCLASS.' },
          exec,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AdtPolicyError, `expected AdtPolicyError, got ${error}`);
        assert.equal(error.rule, 'allowTransportableEdits');
        assert.match(error.message, /^\[POLICY\]/);
        return true;
      },
    );

    // 2. allowedPackages=$TMP only: the true package ZPACK_DEMO is not on the
    //    whitelist → [POLICY] deny (whitelist runs before transportability).
    const w = tools({ registry: whitelistGate, ledger: new LockLedger() });
    await assert.rejects(
      () =>
        w.get('adt_activate')!.execute(
          { objects: [{ name: 'ZCL_DEMO', type: 'CLAS', packageName: '$TMP' }] },
          exec,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AdtPolicyError, `expected AdtPolicyError, got ${error}`);
        assert.equal(error.rule, 'allowedPackages');
        assert.match(error.message, /ZPACK_DEMO/);
        return true;
      },
    );
  } finally {
    await transportGate.dispose();
    await whitelistGate.dispose();
  }
});

test('H2: mutating tools refuse fuzzy name resolution and list candidates instead', async () => {
  const by = tools();

  // 'ZCL_DEM' (typo) fuzzy-matches ZCL_DEMO — a mutating tool must error
  // listing the candidates instead of silently editing the wrong object
  // (which has no local snapshot, so OCC protection would not apply).
  await assert.rejects(
    () => by.get('adt_write_object')!.execute({ name: 'ZCL_DEM', source: 'CLASS zcl_dem DEFINITION.\nENDCLASS.' }, exec),
    (error: unknown) => {
      const message = (error as Error).message;
      assert.match(message, /ZCL_DEM/);
      assert.match(message, /ZCL_DEMO \(CLAS\/OC, package ZPACK_DEMO\)/, 'candidates must be listed with type+package');
      assert.match(message, /objectUri/);
      return true;
    },
  );

  // No search hits at all → still a hard error pointing at objectUri.
  await assert.rejects(
    () => by.get('adt_delete_object')!.execute({ name: 'ZCL_NO_SUCH_OBJECT' }, exec),
    (error: unknown) => {
      assert.match((error as Error).message, /no exact match/i);
      assert.match((error as Error).message, /objectUri/);
      return true;
    },
  );

  // An explicit objectUri keeps working (authoritative, no search needed).
  const byUri = await by
    .get('adt_write_object')!
    .execute(
      { objectUri: '/sap/bc/adt/oo/classes/zcl_demo', source: 'CLASS zcl_demo DEFINITION.\nENDCLASS.' },
      exec,
    );
  assert.equal(byUri.updated, true);

  // Read-only tools keep the lenient fuzzy fallback — a near-miss still
  // resolves (search itself is fuzzy on real backends).
  const read = await by.get('adt_read_object')!.execute({ name: 'ZCL_DEM' }, exec);
  assert.equal(read.name, 'ZCL_DEMO');

  // Activation (a mutation) resolves strictly; checkOnly (read-only
  // pre-audit) stays lenient — mirroring the policy gates.
  await assert.rejects(
    () => by.get('adt_activate')!.execute({ objects: [{ name: 'ZCL_DEM' }] }, exec),
    /no exact match/i,
  );
  const audit = await by.get('adt_activate')!.execute({ objects: [{ name: 'ZCL_DEM' }], checkOnly: true }, exec);
  assert.equal(audit.success, true);
});

test('M2: $batch rejects CRLF header injection and encoded forbidden paths', async () => {
  const by = tools();

  // Header injection via `accept` is rejected — note this needs NO write
  // knobs at all: a plain GET part with a poisoned header value.
  await assert.rejects(
    () =>
      by.get('adt_batch')!.execute(
        { requests: [{ path: '/sap/bc/adt/oo/classes/zcl_demo', accept: 'application/xml\r\nX-Evil: injected' }] },
        exec,
      ),
    /control characters/i,
  );
  await assert.rejects(
    () =>
      by.get('adt_batch')!.execute(
        { requests: [{ path: '/sap/bc/adt/oo/classes/zcl_demo\r\nX-Evil: injected' }] },
        exec,
      ),
    /control characters/i,
  );

  // contentType injection on a WRITE part (policy knob on, so the validation
  // itself is what must reject).
  const permissive = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    allowBatchWrites: true,
  });
  try {
    const p = tools({ registry: permissive, ledger: new LockLedger() });
    await assert.rejects(
      () =>
        p.get('adt_batch')!.execute(
          {
            requests: [
              {
                method: 'PUT',
                path: '/sap/bc/adt/oo/classes/zcl_demo/source/main',
                body: 'x',
                contentType: 'text/plain\r\nX-Evil: injected',
              },
            ],
            allowWrites: true,
          },
          exec,
        ),
      /control characters/i,
    );
  } finally {
    await permissive.dispose();
  }

  // Legacy deletion spelling via query is blocked, plain or percent-encoded.
  await assert.rejects(
    () =>
      by.get('adt_batch')!.execute(
        { requests: [{ path: '/sap/bc/adt/oo/classes/zcl_demo?_action=DELETE' }] },
        exec,
      ),
    /blocked in \$batch.*adt_delete_object/,
  );
  await assert.rejects(
    () =>
      by.get('adt_batch')!.execute(
        { requests: [{ path: '/sap/bc/adt/oo/classes/zcl_demo%3F_action%3DDELETE' }] },
        exec,
      ),
    /blocked in \$batch/,
  );

  // Encoded transport release paths cannot slip past the blacklist either.
  await assert.rejects(
    () =>
      by.get('adt_batch')!.execute(
        { requests: [{ path: '/sap/bc/adt/cts/transportrequests/S4HK900001%2Frelease' }] },
        exec,
      ),
    /blocked in \$batch.*human decision/,
  );
  await assert.rejects(
    () =>
      by.get('adt_batch')!.execute(
        { requests: [{ path: '/sap/bc/adt/cts/transportrequests/S4HK900001%252Frelease' }] },
        exec,
      ),
    /blocked in \$batch.*human decision/,
  );
});

// ---------------------------------------------------------------------------
// Audit P1 regressions (docs/audit-fix-plan.md): M3 SELECT-only lint,
// M6 write_structure lock ledger visibility, M7 create transport policing.
// ---------------------------------------------------------------------------

test('M3: adt_data_preview freestyle SQL accepts SELECT statements only', async () => {
  const by = tools();
  // Non-SELECT statements are rejected before anything reaches the backend.
  await assert.rejects(
    () => by.get('adt_data_preview')!.execute({ sql: 'DELETE FROM t001' }, exec),
    /SELECT statement only/,
  );
  await assert.rejects(
    () => by.get('adt_data_preview')!.execute({ sql: '  update t001 set X = 1' }, exec),
    /SELECT statement only/,
  );
  await assert.rejects(
    () => by.get('adt_data_preview')!.execute({ sql: 'GRANT SELECT ON t001 TO PUBLIC' }, exec),
    /SELECT statement only/,
  );
  // A real SELECT still runs (mock executes it).
  const ok = await by.get('adt_data_preview')!.execute({ sql: 'SELECT * FROM t001', length: 2 }, exec);
  assert.equal(ok.source, 'sql');
  assert.ok(ok.rows.length > 0);
});

test('M6: adt_write_structure registers its lock in the persistent ledger', async () => {
  // Spy ledger: records the exact register/deregister sequence with handles.
  const calls: string[] = [];
  const spyLedger = {
    register: (e: { uri: string; handle?: string; note?: string }) =>
      calls.push(`register:${e.uri}:${e.handle ? 'handle' : 'no-handle'}`),
    deregister: (_d: string, uri: string) => calls.push(`deregister:${uri}`),
    forDestination: () => [],
  } as unknown as LockLedger;
  const by = tools({ registry, ledger: spyLedger });

  const written = await by.get('adt_write_structure')!.execute(
    { name: 'ZMSG_DEMO', type: 'MSAG', description: 'ledger probe' },
    exec,
  );
  assert.deepEqual(written.changed, ['description']);
  // The lock was registered WITH its handle while held, and removed again
  // after the protocol confirmed the unlock. The canonical message-class
  // prefix is /messageclass/ (the mock still serves the legacy /msgclass/
  // path — the client's 404 fallback bridges the two, but the ledger tracks
  // the URI the tool resolved).
  assert.deepEqual(calls, [
    `register:/sap/bc/adt/messageclass/zmsg_demo:handle`,
    `deregister:/sap/bc/adt/messageclass/zmsg_demo`,
  ]);

  // A real ledger gains no entry from a clean write (snapshot comparison —
  // the shared backing file may legitimately carry older unrelated entries).
  const real = new LockLedger();
  const before = real.forDestination('demo').length;
  const byReal = tools({ registry, ledger: real });
  await byReal.get('adt_write_structure')!.execute(
    { name: 'ZMSG_DEMO', type: 'MSAG', description: 'ledger probe 2' },
    exec,
  );
  assert.equal(real.forDestination('demo').length, before, 'no stale entry after a clean write');

  // Policy violation inside the lock: the assert throws BEFORE any
  // registration (nothing to clean up), the protocol rolls the lock back.
  const strict = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    allowedTransports: 'S4HK*', // the mock's auto MOCKK task is NOT allowed
  });
  try {
    const calls2: string[] = [];
    const spy2 = {
      register: (e: { uri: string }) => calls2.push(`register:${e.uri}`),
      deregister: (_d: string, uri: string) => calls2.push(`deregister:${uri}`),
      forDestination: () => [],
    } as unknown as LockLedger;
    const byStrict = tools({ registry: strict, ledger: spy2 });
    await assert.rejects(
      () => byStrict.get('adt_write_structure')!.execute(
        { name: 'ZMSG_DEMO', type: 'MSAG', description: 'nope' },
        exec,
      ),
      (error: unknown) => error instanceof AdtPolicyError && error.rule === 'allowedTransports',
    );
    assert.deepEqual(calls2, [], 'no ledger entry for a rolled-back lock');
  } finally {
    await strict.dispose();
  }
});

test('M7: adt_create_object polices the backend auto-assigned transport', async () => {
  // The mock auto-creates a MOCKK task for transportable packages when no
  // transport is passed — a policy that does not allow MOCKK* must reject
  // AND roll the create back.
  const picky = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    allowedTransports: 'S4HK*',
  });
  try {
    // No-op ledger: the rollback register must never reach the shared
    // backing file (it would pollute unrelated later assertions).
    const ledger = {
      register: () => undefined,
      deregister: () => undefined,
      forDestination: () => [],
    } as unknown as LockLedger;
    const by = tools({ registry: picky, ledger });
    await assert.rejects(
      () =>
        by.get('adt_create_object')!.execute(
          { type: 'CLAS', name: 'ZCL_TRANSIT', description: 'x', packageName: 'ZPACK_DEMO' },
          exec,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AdtPolicyError, `expected AdtPolicyError, got ${error}`);
        assert.equal(error.rule, 'allowedTransports');
        assert.match(error.message, /^\[POLICY\]/);
        assert.match(error.message, /deleted again/);
        return true;
      },
    );
    // The rollback really removed the object again.
    await assert.rejects(
      async () => (await picky.require()).client.readSource('/sap/bc/adt/oo/classes/zcl_transit'),
      /404/,
    );

    // An explicitly-passed ALLOWED transport is used as-is and passes.
    const ok = await by.get('adt_create_object')!.execute(
      { type: 'CLAS', name: 'ZCL_TRANSIT2', description: 'x', packageName: 'ZPACK_DEMO', transport: 'S4HK900009' },
      exec,
    );
    assert.equal(ok.success, true);
    assert.equal(ok.name, 'ZCL_TRANSIT2');

    // $TMP creates get no transport at all — nothing to police, clean pass.
    const local = await by.get('adt_create_object')!.execute(
      { type: 'PROG', name: 'ZPROG_LOCAL', description: 'x', packageName: '$TMP' },
      exec,
    );
    assert.equal(local.success, true);
  } finally {
    await picky.dispose();
  }

  // Default policy: the auto-assigned MOCKK task is allowed ('*') and the
  // create reports it.
  const by = tools();
  const auto = await by.get('adt_create_object')!.execute(
    { type: 'CLAS', name: 'ZCL_AUTOTRANS', description: 'x', packageName: 'ZPACK_DEMO' },
    exec,
  );
  assert.equal(auto.success, true);
});

// ---------------------------------------------------------------------------
// Audit P2 regressions (docs/audit-fix-plan.md): M9 export path sanitization,
// D1 optional fs degradation.
// ---------------------------------------------------------------------------

/** Path-aware fake of the dsh-fs surface the export tool uses. */
function exportFsFake() {
  const written = new Map<string, string>();
  const fs = {
    resolve: async (p: string, o?: { cwd?: string }) => {
      const absolute = p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
      const displayPath = o?.cwd && !absolute ? `${o.cwd.replace(/[\\/]+$/, '')}/${p}` : p;
      return { targetKey: `key:${displayPath}`, displayPath };
    },
    writeText: async (t: { displayPath: string }, c: string) => {
      written.set(t.displayPath, c);
    },
  };
  const ctx = { get: (name: string) => (name === 'fs' ? fs : undefined) } as unknown as Context;
  return { written, ctx };
}

test('M9: export sanitizes namespaced object names and reports the resolved path', async () => {
  // A namespaced object (/NS/ZCL_DEMO) — its name contains slashes that
  // must never reach the file target (they would resolve as absolute
  // paths OUTSIDE targetDir).
  (await registry.require()).client.createObject({
    destination: 'demo',
    type: 'CLAS/OC',
    name: '/NS/ZCL_DEMO',
    description: 'namespaced demo',
    packageName: 'ZPACK_DEMO',
  });
  const { written, ctx } = exportFsFake();
  const by = tools({ registry, ledger: new LockLedger() }, ctx);
  const targetDir = 'C:/tmp/export-target';
  const result = await by.get('adt_export_objects')!.execute(
    { objects: [{ name: '/NS/ZCL_DEMO', type: 'CLAS' }], targetDir },
    exec,
  );
  assert.equal(result.exported, 1);
  assert.equal(result.failed, 0);
  const file = result.files[0]!;
  assert.equal(file.name, '_NS_ZCL_DEMO.clas.abap', 'path separators sanitized out of the name');
  assert.equal(file.path, `${targetDir}/_NS_ZCL_DEMO.clas.abap`, 'resolved path inside targetDir');
  assert.ok(written.has(file.path), 'written exactly at the resolved path');
  assert.match(written.get(file.path)!, /zcl_demo/i, 'the object source landed there');

  // Normal names keep their shape and also report the resolved path.
  const plain = await by.get('adt_export_objects')!.execute(
    { objects: [{ name: 'ZCL_DEMO', type: 'CLAS' }], targetDir },
    exec,
  );
  assert.equal(plain.files[0]!.name, 'ZCL_DEMO.clas.abap');
  assert.equal(plain.files[0]!.path, `${targetDir}/ZCL_DEMO.clas.abap`);
});

test('D1: without the optional dsh-fs service the plugin still works and fs tools degrade clearly', async () => {
  // fakeCtx exposes NO fs service (and none is injected anywhere): every
  // tool still registered and runs; only fs-backed features degrade.
  const by = tools();
  const read = await by.get('adt_read_object')!.execute({ name: 'ZCL_DEMO', type: 'CLAS' }, exec);
  assert.ok(read.source.length > 0);
  assert.equal(read.localCopy, undefined, 'no snapshot without fs — the read itself is unaffected');

  await assert.rejects(
    () => by.get('adt_export_objects')!.execute(
      { objects: [{ name: 'ZCL_DEMO', type: 'CLAS' }], targetDir: 'C:/tmp/x' },
      exec,
    ),
    /requires a host filesystem service/,
  );
  await assert.rejects(
    () => by.get('adt_push_object')!.execute({ name: 'ZCL_DEMO', type: 'CLAS' }, exec),
    /requires a host filesystem service/,
  );
});

// ---------------------------------------------------------------------------
// Audit P3 regressions: object-list bounds, transports gate on version feed,
// datapreview row cap, per-item export degradation.
// ---------------------------------------------------------------------------

test('P3: shared `objects` lists must be non-empty and bounded', async () => {
  const by = tools();
  await assert.rejects(
    () => by.get('adt_check')!.execute({ objects: [] }, exec),
    /at least one entry/,
  );
  await assert.rejects(
    () => by.get('adt_activate')!.execute({ objects: [] }, exec),
    /at least one entry/,
  );
  const many = Array.from({ length: 51 }, (_, i) => ({ name: `ZCL_FOO${i}`, type: 'CLAS' }));
  await assert.rejects(
    () => by.get('adt_check')!.execute({ objects: many }, exec),
    /split into multiple calls of at most 50/,
  );
  await assert.rejects(
    () => by.get('adt_run_unit_tests')!.execute({ objects: many }, exec),
    /split into multiple calls/,
  );
  await assert.rejects(
    () => by.get('adt_run_atc')!.execute({ objects: many }, exec),
    /split into multiple calls/,
  );
});

test('P3: adt_object_versions is gated by enableTransports (transport numbers leak via the feed)', async () => {
  const locked = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    enableTransports: false,
  });
  try {
    const by = tools({ registry: locked, ledger: new LockLedger() });
    await assert.rejects(
      () => by.get('adt_object_versions')!.execute({ name: 'ZCL_DEMO', type: 'CLAS' }, exec),
      (error: unknown) => error instanceof AdtPolicyError && error.rule === 'enableTransports',
    );
  } finally {
    await locked.dispose();
  }
});

test('P3: data preview rows are capped at 500 (context hygiene)', async () => {
  const by = tools();
  const result = await by.get('adt_data_preview')!.execute(
    { name: 'ZCDS_DEMO', kind: 'DDLS', length: 5000 },
    exec,
  );
  assert.equal(result.rows.length, 500);
  assert.match(result.note ?? '', /length clamped from 5000 to 500/);
});

test('P3: export degrades per item — one bad entry no longer fails the whole batch', async () => {
  const { written, ctx } = exportFsFake();
  const by = tools({ registry, ledger: new LockLedger() }, ctx);
  const result = await by.get('adt_export_objects')!.execute(
    {
      objects: [
        { name: 'ZCL_DEMO', type: 'CLAS' },
        { name: 'ZCL_NO_SUCH_OBJECT', type: 'CLAS' },
      ],
      targetDir: 'C:/tmp/export-p3',
    },
    exec,
  );
  assert.equal(result.exported, 1);
  assert.equal(result.failed, 1);
  assert.match(result.files[1]!.path, /^FAILED:/);
  assert.ok(written.has(result.files[0]!.path!), 'the good object was still written');
});
