import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ENDPOINTS } from '@nefevcore/abap-adt-protocol';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { DebuggerManager } from '../lib/debugger.js';
import { builtinDefaults } from '../lib/config.js';
import { AdtPolicyError } from '../lib/policy.js';
import {
  CRUD_MATRIX,
  crudCell,
  crudCreatableTypes,
  crudObjectTypes,
  crudUnsupportedMessage,
  crudVerbsFor,
  renderCrudMatrixTable,
} from '../lib/crudmatrix.js';
import { crudTools } from '../lib/tools/crud.js';
import { objectTools } from '../lib/tools/objects.js';
import { readTools } from '../lib/tools/read.js';
import { writeTools } from '../lib/tools/write.js';
import { structureTools } from '../lib/tools/structure.js';
import { packageTools } from '../lib/tools/packages.js';
import type { Context } from '@deepseek-ai/cordis';

/**
 * The Compact CRUD matrix (P2, pulled ahead by user decision): one source of
 * truth (src/crudmatrix.ts) driving the adt_crud facade, the create-type
 * enum, parity against the protocol catalog, and the documented matrix
 * table. These tests ARE the anti-drift lock (the fifth "publish number"):
 * matrix ↔ protocol ↔ catalog ↔ docs must agree or the build fails.
 */

const exec = { signal: undefined } as never;
const fakeCtx = { get: (_name: string) => undefined } as unknown as Context;

let registry: AdtRegistry;
let strictRegistry: AdtRegistry; // allowedPackages: $TMP only

before(async () => {
  registry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0 });
  strictRegistry = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    allowedPackages: '$TMP',
  });
});

after(async () => {
  await registry.dispose();
  await strictRegistry.dispose();
});

/** Build the tool catalog like index.ts does (facade appended last). */
function buildCatalog(reg: AdtRegistry) {
  const deps = { registry: reg, ledger: new LockLedger(), debugger: new DebuggerManager(reg) };
  const all = [
    ...readTools(deps, fakeCtx),
    ...writeTools(deps, fakeCtx),
    ...objectTools(deps),
    ...structureTools(deps),
    ...packageTools(deps),
  ];
  const by = new Map(all.map((t) => [t.name, t]));
  const crud = crudTools(deps, by as never);
  return { by, crud: crud[0]! };
}

// ---------------------------------------------------------------------------
// Parity: matrix ↔ protocol ↔ catalog ↔ docs
// ---------------------------------------------------------------------------

test('matrix create keys equal the protocol createByType catalog', () => {
  const protocolTypes = Object.keys(ENDPOINTS.createByType).sort();
  assert.deepEqual(crudCreatableTypes().slice().sort(), protocolTypes);
});

test('every matrix cell routes to a real tool of the full plugin catalog', async () => {
  const { by } = buildCatalog(registry);
  // Import the remaining groups through the harness of agent_extras' pin
  // test indirectly: here it suffices that every owner name we route to is
  // among the tools this file builds plus the known-registered set.
  const known = new Set([
    ...by.keys(),
    'adt_create_object', 'adt_read_object', 'adt_write_object', 'adt_delete_object',
    'adt_read_structure', 'adt_write_structure', 'adt_package_content',
  ]);
  for (const type of crudObjectTypes()) {
    for (const verb of crudVerbsFor(type)) {
      const cell = crudCell(verb, type)!;
      assert.ok(
        known.has(cell.tool),
        `${verb} on ${type} routes to '${cell.tool}' which is not a registered tool`,
      );
    }
  }
});

test('the documented matrix table matches the rendered single source', () => {
  const docPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'tool-reference.md');
  // Normalize line endings: git may hand the doc back as CRLF on Windows.
  const doc = readFileSync(docPath, 'utf8').replace(/\r\n/g, '\n');
  const rendered = renderCrudMatrixTable();
  assert.ok(
    doc.includes(rendered),
    'docs/tool-reference.md no longer contains the rendered CRUD matrix table — ' +
      'regenerate it from src/crudmatrix.ts (renderCrudMatrixTable()) after changing the matrix',
  );
});

test('unsupported verb×type names what IS supported (never a bare no-handler)', () => {
  assert.match(crudUnsupportedMessage('update', 'DEVC'), /supported: create, read, delete/);
  assert.match(crudUnsupportedMessage('create', 'INCL'), /supported: read, update, delete/);
  assert.match(crudUnsupportedMessage('create', 'NOPE'), /unknown object type 'NOPE'/);
  // The matrix rows are exactly what the views claim.
  assert.deepEqual(crudVerbsFor('tabl'), ['create', 'read', 'update', 'delete']);
  assert.deepEqual(crudVerbsFor('devc'), ['create', 'read', 'delete']);
  assert.equal(CRUD_MATRIX.INCL!.create, undefined);
});

// ---------------------------------------------------------------------------
// The facade: status card, routing, policy passthrough
// ---------------------------------------------------------------------------

test('adt_crud without verb returns the capability matrix card', async () => {
  const { crud } = buildCatalog(registry);
  const card = (await crud.execute({}, exec)) as { matrix?: string };
  assert.match(card.matrix!, /- CLAS: create, read, update, delete/);
  assert.match(card.matrix!, /- DEVC: create, read, delete/);
});

test('adt_crud read routes: source types → adt_read_object, structured → adt_read_structure, DEVC → adt_package_content', async () => {
  const { crud } = buildCatalog(registry);
  const src = (await crud.execute({ verb: 'read', type: 'CLAS', name: 'ZCL_DEMO' }, exec)) as {
    routedTool: string; name: string; totalLines: number;
  };
  assert.equal(src.routedTool, 'adt_read_object');
  assert.equal(src.name, 'ZCL_DEMO');
  assert.ok(src.totalLines > 0);

  const structured = (await crud.execute({ verb: 'read', type: 'MSAG', name: 'ZMSG_DEMO' }, exec)) as {
    routedTool: string; kind: string;
  };
  assert.equal(structured.routedTool, 'adt_read_structure');
  assert.equal(structured.kind, 'MSAG');

  const pkg = (await crud.execute({ verb: 'read', type: 'DEVC', name: 'ZPACK_DEMO' }, exec)) as {
    routedTool: string; objects: unknown[];
  };
  assert.equal(pkg.routedTool, 'adt_package_content');
  assert.ok(pkg.objects.length > 0);
});

test('adt_crud create TABL with fields routes to the one-step DDL flow', async () => {
  const { crud } = buildCatalog(registry);
  const result = (await crud.execute(
    {
      verb: 'create',
      type: 'TABL',
      name: 'ZTBL_CRUD_DEMO',
      description: 'created via the compact facade',
      packageName: '$TMP',
      fields: [{ name: 'ID', type: 'CHAR', length: 8, isKey: true }],
    },
    exec,
  )) as { routedTool: string; success: boolean; activated: boolean; ddlSource: string };
  assert.equal(result.routedTool, 'adt_create_object');
  assert.equal(result.success, true);
  assert.equal(result.activated, true);
  assert.match(result.ddlSource, /key client : abap\.clnt not null;/);

  // Round trip: read it back through the facade, then delete it.
  const read = (await crud.execute({ verb: 'read', type: 'TABL', name: 'ztbl_crud_demo' }, exec)) as {
    routedTool: string; source: string;
  };
  assert.equal(read.routedTool, 'adt_read_object');
  assert.match(read.source, /define table ztbl_crud_demo \{/);
  const del = (await crud.execute({ verb: 'delete', type: 'TABL', name: 'ZTBL_CRUD_DEMO' }, exec)) as {
    routedTool: string; deleted: boolean;
  };
  assert.equal(del.routedTool, 'adt_delete_object');
  assert.equal(del.deleted, true);
});

test('adt_crud update routes: source → adt_write_object, structured → adt_write_structure', async () => {
  const { crud } = buildCatalog(registry);
  const srcUpdate = (await crud.execute(
    {
      verb: 'update',
      type: 'PROG',
      name: 'ZPROG_DEMO',
      source: "REPORT zprog_demo.\nWRITE / 'patched via adt_crud'.\n",
      activate: true,
    },
    exec,
  )) as { routedTool: string; updated: boolean; activated?: boolean; persisted?: boolean };
  assert.equal(srcUpdate.routedTool, 'adt_write_object');
  assert.equal(srcUpdate.updated, true);
  assert.equal(srcUpdate.activated, true);
  assert.notEqual(srcUpdate.persisted, false, 'the owner persistence check runs through the facade');

  const structuredUpdate = (await crud.execute(
    { verb: 'update', type: 'MSAG', name: 'ZMSG_DEMO', messages: [{ number: '001', text: 'Facade &1' }] },
    exec,
  )) as { routedTool: string; changed: string[] };
  assert.equal(structuredUpdate.routedTool, 'adt_write_structure');
  assert.ok(
    structuredUpdate.changed.some((entry) => entry.startsWith('messages')),
    `expected a messages change entry, got ${JSON.stringify(structuredUpdate.changed)}`,
  );
});

test('adt_crud policy passthrough: the OWNER policy chain applies unchanged', async () => {
  const { crud } = buildCatalog(strictRegistry);
  // ZCL_DEMO lives in ZPACK_DEMO — not on the $TMP-only whitelist of this registry.
  await assert.rejects(
    () => crud.execute({ verb: 'update', type: 'CLAS', name: 'ZCL_DEMO', source: 'x' }, exec),
    (error: unknown) => {
      assert.ok(error instanceof AdtPolicyError);
      assert.equal(error.rule, 'allowedPackages');
      return true;
    },
  );
});

test('adt_crud argument validation: verb-specific requirements and routing errors', async () => {
  const { crud } = buildCatalog(registry);
  await assert.rejects(
    () => crud.execute({ verb: 'create', type: 'CLAS', name: 'ZNEVER_CREATED' }, exec),
    /requires `description`/,
  );
  await assert.rejects(
    () => crud.execute({ verb: 'create', type: 'CLAS', name: 'ZNEVER_CREATED', description: 'x' }, exec),
    /requires `packageName`/,
  );
  await assert.rejects(
    () => crud.execute({ verb: 'update', type: 'PROG', name: 'ZPROG_DEMO' }, exec),
    /requires either `source`/,
  );
  await assert.rejects(
    () => crud.execute({ verb: 'frobnicate', type: 'CLAS' }, exec),
    /must be one of \["create","read","update","delete"\]/,
    'the schema-level enum rejects unknown verbs before execute',
  );
  await assert.rejects(() => crud.execute({ verb: 'read', name: 'X' }, exec), /requires `type`/);
  await assert.rejects(
    () => crud.execute({ verb: 'update', type: 'DEVC', name: 'ZPACK_DEMO' }, exec),
    /update is not supported for DEVC \(supported: create, read, delete\)/,
  );
});
