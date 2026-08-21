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
import { writeTools } from '../lib/tools/write.js';
import { objectTools } from '../lib/tools/objects.js';
import { lifecycleTools } from '../lib/tools/lifecycle.js';
import { versionTools } from '../lib/tools/versions.js';
import { replaceSourceBlock, replaceSourceText } from '../lib/tools/write.js';
import type { Context } from '@deepseek-ai/cordis';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
const fakeCtx = { fs: undefined } as unknown as Context;

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

function tools(deps = { registry, ledger: new LockLedger() }) {
  const flat = [
    ...dumpTools(deps),
    ...executeTools(deps),
    ...structureTools(deps),
    ...batchTools(deps, fakeCtx),
    ...dataPreviewTools(deps),
    ...writeTools(deps, fakeCtx),
    ...objectTools(deps),
    ...lifecycleTools(deps),
    ...versionTools(deps),
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
    const check = await permissive.require().client.readSource('/sap/bc/adt/programs/programs/zprog_demo');
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
  const versions = await registry.require().client.getVersions('/sap/bc/adt/oo/classes/zcl_runner');
  assert.equal(versions[0]?.transportRequest, 'S4HK900001');

  // 4. adt_edit_object honors the same semantics.
  await registry.require().client.updateSource(
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
  const client = registry.require().client;
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
  const client = registry.require().client;
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
  const client = registry.require().client;
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
  const client = registry.require().client;
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
  const client = registry.require().client;
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
  const client = registry.require().client;
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
