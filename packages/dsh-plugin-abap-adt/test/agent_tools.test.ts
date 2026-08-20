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
import type { Context } from '@deepseek-ai/cordis';

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
