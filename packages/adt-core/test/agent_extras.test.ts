import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { builtinDefaults } from '../lib/config.js';
import { readTools } from '../lib/tools/read.js';
import { writeTools } from '../lib/tools/write.js';
import { selfcheckTools, UNPROBED_TOOLS } from '../lib/tools/selfcheck.js';
import { systemTools } from '../lib/tools/system.js';
import { destinationTools } from '../lib/tools/destinations.js';
import { searchTools } from '../lib/tools/search.js';
import { objectTools } from '../lib/tools/objects.js';
import { lifecycleTools } from '../lib/tools/lifecycle.js';
import { testingTools } from '../lib/tools/testing.js';
import { atcRunTools } from '../lib/tools/atc_runs.js';
import { transportTools } from '../lib/tools/transports.js';
import { packageTools } from '../lib/tools/packages.js';
import { batchTools } from '../lib/tools/batch.js';
import { localTools } from '../lib/tools/local.js';
import { whereUsedTools } from '../lib/tools/whereused.js';
import { dataPreviewTools } from '../lib/tools/datapreview.js';
import { lockTools } from '../lib/tools/lock.js';
import { versionTools } from '../lib/tools/versions.js';
import { gateTools } from '../lib/tools/gate.js';
import { policyTools } from '../lib/tools/policy.js';
import { dumpTools } from '../lib/tools/dumps.js';
import { executeTools } from '../lib/tools/execute.js';
import { structureTools } from '../lib/tools/structure.js';
import { debuggerTools } from '../lib/tools/debugger.js';
import { textElementTools } from '../lib/tools/textelements.js';
import { cochangeTools } from '../lib/tools/cochange.js';
import { crudTools } from '../lib/tools/crud.js';
import { DebuggerManager } from '../lib/debugger.js';
import { findMethodBlocks, extractDependencyCandidates, rankDependencies, extractContract } from '../lib/abap.js';
import type { Context } from '@deepseek-ai/cordis';

/**
 * Tests for the vsp-inspired agent-experience features: method-level
 * read/edit, the dependency-contract prologue, and the capability sweep
 * (adt_selfcheck) with its published-catalog pin — all against the
 * in-process mock destination.
 */

const exec = { signal: undefined } as never;
const fakeCtx = { get: (_name: string) => undefined } as unknown as Context;

let registry: AdtRegistry;

before(async () => {
  registry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0 });
});

after(async () => {
  await registry.dispose();
});

function tools(deps = { registry, ledger: new LockLedger(), debugger: new DebuggerManager(registry) }, ctx: Context = fakeCtx) {
  const flat = [
    ...readTools(deps, ctx),
    ...writeTools(deps, ctx),
    ...selfcheckTools(deps),
  ];
  return new Map(flat.map((t) => [t.name, t]));
}

// ---------------------------------------------------------------------------
// Pure syntax helpers (src/abap.ts)
// ---------------------------------------------------------------------------

const CLASS_SOURCE = `CLASS zcl_demo DEFINITION PUBLIC CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS add IMPORTING iv_a TYPE i.
  PRIVATE SECTION.
ENDCLASS.

CLASS zcl_demo IMPLEMENTATION.
  METHOD add.
    rv_sum = iv_a + iv_b.
  ENDMETHOD.
ENDCLASS.`;

test('findMethodBlocks: locates one block, ignores CALL METHOD noise', () => {
  const blocks = findMethodBlocks(CLASS_SOURCE, 'add');
  assert.equal(blocks.length, 1);
  const lines = CLASS_SOURCE.split('\n');
  assert.match(lines[blocks[0]!.startIdx]!, /^\s*METHOD add\./i);
  assert.match(lines[blocks[0]!.endIdx]!, /^\s*ENDMETHOD\./i);

  const noisy = `  CALL METHOD foo.\n  METHOD add.\n  ENDMETHOD.\n`;
  assert.equal(findMethodBlocks(noisy, 'add').length, 1);
  assert.equal(findMethodBlocks(noisy, 'foo').length, 0);

  // Ambiguity: same method name in two local classes.
  const ambiguous = `CLASS lcl_a IMPLEMENTATION.
  METHOD setup.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_b IMPLEMENTATION.
  METHOD setup.
  ENDMETHOD.
ENDCLASS.`;
  assert.equal(findMethodBlocks(ambiguous, 'setup').length, 2);
  assert.equal(findMethodBlocks(CLASS_SOURCE, 'nope').length, 0);
});

test('extractDependencyCandidates: obligations, collaborators, locals excluded', () => {
  const src = `CLASS zcl_sub DEFINITION INHERITING FROM zcl_super.
  PUBLIC SECTION.
    INTERFACES zif_partner.
    METHODS m RAISING zcx_boom.
    DATA mo_log TYPE REF TO zcl_logger.
ENDCLASS.
CLASS zcl_sub IMPLEMENTATION.
  METHOD m.
    DATA(lo) = NEW zcl_helper( ).
    cl_abap_unit_assert=>assert_equals( exp = 1 ).
    CALL FUNCTION 'Z_BAPI_X'.
  ENDMETHOD.
ENDCLASS.`;
  const cands = extractDependencyCandidates(src, 'ZCL_SUB');
  const names = cands.map((c) => c.name);
  assert.ok(names.includes('ZCL_SUPER')); // obligation
  assert.ok(names.includes('ZIF_PARTNER')); // obligation
  assert.ok(names.includes('ZCX_BOOM')); // exception — a global class, kept
  assert.ok(names.includes('ZCL_LOGGER')); // signature type
  assert.ok(names.includes('ZCL_HELPER')); // collaborator (NEW)
  assert.ok(names.includes('CL_ABAP_UNIT_ASSERT')); // static access
  assert.ok(names.includes('Z_BAPI_X')); // function module
  assert.ok(!names.includes('ZCL_SUB')); // self
  const byName = new Map(cands.map((c) => [c.name, c]));
  assert.equal(byName.get('Z_BAPI_X')!.kind, 'function');

  // Ranking: superclass and interface before collaborators/exceptions.
  const ranked = rankDependencies(cands);
  assert.equal(ranked[0]!.name, 'ZCL_SUPER');
  assert.equal(ranked[1]!.name, 'ZIF_PARTNER');
  assert.equal(ranked[ranked.length - 1]!.name, 'ZCX_BOOM');
});

test('extractContract: class keeps the public section only, interface whole', () => {
  const contract = extractContract(CLASS_SOURCE, 'ZCL_DEMO', 'CLAS');
  assert.match(contract, /CLASS zcl_demo DEFINITION/);
  assert.match(contract, /METHODS add/);
  assert.ok(!contract.includes('rv_sum = iv_a')); // implementation elided
  assert.ok(!contract.includes('PRIVATE SECTION'));

  const intf = `INTERFACE zif_demo PUBLIC.\n  METHODS add.\nENDINTERFACE.`;
  assert.equal(extractContract(intf, 'ZIF_DEMO', 'INTF'), intf);
});

// ---------------------------------------------------------------------------
// Method-level read + context prologue (adt_read_object)
// ---------------------------------------------------------------------------

test('adt_read_object: method-level window addresses full-source lines', async () => {
  const by = tools();
  const read = await by.get('adt_read_object')!.execute({ name: 'ZCL_DEMO', method: 'greet' }, exec);
  assert.equal(read.method, 'greet');
  assert.match(read.source, /METHOD greet\./i);
  assert.match(read.source, /ENDMETHOD\./i);
  assert.ok(!read.source.includes('METHOD add.'));
  // The window addresses the FULL source: greet lives at lines 14..16 of 17.
  assert.equal(read.startLine, 14);
  assert.equal(read.endLine, 16);
  assert.equal(read.totalLines, 17);

  await assert.rejects(
    () => by.get('adt_read_object')!.execute({ name: 'ZCL_DEMO', method: 'nope' }, exec),
    /method "nope" not found.*methods defined here: add, greet/s,
  );
  await assert.rejects(
    () => by.get('adt_read_object')!.execute({ name: 'ZCL_DEMO', method: 'add', startLine: 1 }, exec),
    /cannot be combined with `startLine`/,
  );
});

test('adt_read_object: context prologue carries contracts and visible gaps', async () => {
  const by = tools();
  // ZCL_DEMO~TEST uses zcl_demo (resolvable on the mock) and
  // cl_abap_unit_assert (NOT on the mock — must stay visible as unresolved).
  const read = await by
    .get('adt_read_object')!
    .execute({ name: 'ZCL_DEMO~TEST', type: 'CLAS', context: true }, exec);
  assert.ok(read.contextPrologue);
  assert.match(read.contextPrologue, /dependency context: 2 candidate\(s\) · 1 resolved · 1 unresolved/);
  assert.match(read.contextPrologue, /ZCL_DEMO · class \(public section only\)/);
  assert.match(read.contextPrologue, /CLASS zcl_demo DEFINITION PUBLIC/);
  assert.match(read.contextPrologue, /METHODS add/);
  assert.ok(!read.contextPrologue.includes('rv_sum = iv_a + iv_b')); // implementation elided
  assert.match(read.contextPrologue, /CL_ABAP_UNIT_ASSERT · UNRESOLVED/);

  // Without context: no prologue.
  const plain = await by.get('adt_read_object')!.execute({ name: 'ZCL_DEMO~TEST', type: 'CLAS' }, exec);
  assert.equal(plain.contextPrologue, undefined);
});

// ---------------------------------------------------------------------------
// Method-level edit (adt_edit_object mode 3)
// ---------------------------------------------------------------------------

test('adt_edit_object: method surgery replaces one block through the OCC pipeline', async () => {
  const by = tools({ registry, ledger: new LockLedger() });
  const result = await by.get('adt_edit_object')!.execute(
    {
      name: 'ZCL_DEMO',
      method: 'add',
      newText: '  METHOD add.\n    rv_sum = iv_a + iv_b + 1.\n  ENDMETHOD.',
    },
    exec,
  );
  assert.equal(result.replaced, true);
  assert.equal(result.start, 'METHOD add.');
  assert.equal(result.end, 'ENDMETHOD.');
  assert.equal(result.oldLines, 3);
  assert.equal(result.newLines, 3);
  assert.equal(result.persisted, true);

  // Read-back through the method window shows the new body only there.
  const add = await by.get('adt_read_object')!.execute({ name: 'ZCL_DEMO', method: 'add' }, exec);
  assert.match(add.source, /iv_a \+ iv_b \+ 1/);
  const greet = await by.get('adt_read_object')!.execute({ name: 'ZCL_DEMO', method: 'greet' }, exec);
  assert.ok(!greet.source.includes('+ 1'));

  await assert.rejects(
    () =>
      by.get('adt_edit_object')!.execute(
        { name: 'ZCL_DEMO', method: 'add', oldText: 'x', newText: 'y' },
        exec,
      ),
    /`method` cannot be combined with `oldText`/,
  );
  await assert.rejects(
    () => by.get('adt_edit_object')!.execute({ name: 'ZCL_DEMO', method: 'add' }, exec),
    /`method` requires `newText`/,
  );
});

test('adt_read_object: routing guard refuses structured types with the right destination', async () => {
  const by = tools();
  await assert.rejects(
    () => by.get('adt_read_object')!.execute({ name: 'ZMSG_DEMO', type: 'MSAG' }, exec),
    /is a MSAG.*Use adt_read_structure.*kind: MSAG/s,
  );
  await assert.rejects(
    () => by.get('adt_read_object')!.execute({ name: 'ZDOMA_DEMO', type: 'DOMA' }, exec),
    /is a DOMA.*adt_read_structure/s,
  );
  await assert.rejects(
    () => by.get('adt_read_object')!.execute({ name: 'ZPACK_DEMO', type: 'DEVC' }, exec),
    /is a package.*adt_package_content/s,
  );
});

// ---------------------------------------------------------------------------
// Capability sweep (adt_selfcheck)
// ---------------------------------------------------------------------------

test('adt_selfcheck: mock destination answers, nothing dead or broken', async () => {
  const by = tools();
  const result = await by.get('adt_selfcheck')!.execute({}, exec);
  assert.equal(result.summary.dead, 0);
  assert.equal(result.summary.broken, 0);
  assert.ok(result.summary.answered >= 8, `answered=${result.summary.answered}`);
  const byTool = new Map(result.checks.map((c) => [`${c.tool}:${c.capability}`, c]));
  assert.equal(byTool.get('adt_read_object:source read')!.verdict, 'answered');
  assert.equal(byTool.get('adt_search:object search')!.verdict, 'answered');
  assert.equal(byTool.get('adt_batch:protocol $batch GET')!.verdict, 'answered');
  assert.ok(result.probeObject.includes('ZCL'));
  // Coverage statement: mutating/executing tools listed, never omitted.
  assert.ok(result.unprobedTools.includes('adt_write_object'));
  assert.ok(result.unprobedTools.includes('adt_execute'));
  assert.ok(result.unprobedTools.includes('adt_run_unit_tests'));

  // Explicit probe object works too.
  const named = await by.get('adt_selfcheck')!.execute({ name: 'ZCL_FLAKY' }, exec);
  assert.ok(named.probeObject.includes('ZCL_FLAKY'));
  assert.equal(named.summary.dead, 0);
});

// ---------------------------------------------------------------------------
// Published catalog pin (the count the README badge claims)
// ---------------------------------------------------------------------------

test('tool catalog: every adt_* tool accounted for (published numbers)', async () => {
  const deps = { registry, ledger: new LockLedger(), debugger: new DebuggerManager(registry) };
  const all = [
    ...systemTools(deps),
    ...destinationTools(deps, fakeCtx),
    ...searchTools(deps),
    ...readTools(deps, fakeCtx),
    ...writeTools(deps, fakeCtx),
    ...objectTools(deps),
    ...lifecycleTools(deps),
    ...testingTools(deps),
    ...atcRunTools(deps),
    ...transportTools(deps),
    ...packageTools(deps),
    ...batchTools(deps, fakeCtx),
    ...localTools(deps, fakeCtx),
    ...whereUsedTools(deps),
    ...dataPreviewTools(deps),
    ...lockTools(deps),
    ...versionTools(deps),
    ...gateTools(deps),
    ...policyTools(deps),
    ...dumpTools(deps),
    ...executeTools(deps),
    ...structureTools(deps),
    ...selfcheckTools(deps),
    ...debuggerTools(deps),
    ...textElementTools(deps),
    ...cochangeTools(deps),
    // The compact CRUD facade is appended after the full catalog (index.ts).
    ...crudTools(deps, new Map<string, never>() as never),
  ];
  const names = all.map((t) => t.name).sort();
  assert.equal(new Set(names).size, names.length, 'duplicate tool name registered');
  assert.equal(names.length, 46, `catalog size drifted: ${names.length} — update README/docs badge and this pin together`);
  assert.ok(names.includes('adt_selfcheck'));
  // Sweep coverage statement stays honest: covered + unprobed = full catalog.
  const covered = new Set(SWEPT_TOOLS);
  for (const name of names) {
    assert.ok(
      covered.has(name) || UNPROBED_TOOLS.includes(name),
      `${name} is neither swept nor listed in UNPROBED_TOOLS — a gap that reads as full coverage`,
    );
  }
});

/** Tools adt_selfcheck claims to cover (mirrors COVERED_TOOLS in selfcheck.ts). */
const SWEPT_TOOLS = [
    'adt_search',
    'adt_read_object',
    'adt_package_content',
    'adt_where_used',
    'adt_object_versions',
    'adt_list_dumps',
    'adt_get_dump',
    'adt_list_transports',
    'adt_system_info',
    'adt_ping',
    'adt_batch',
  ];