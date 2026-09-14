import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ENDPOINTS } from '@nefevcore/abap-adt-protocol';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { DebuggerManager } from '../lib/debugger.js';
import { builtinDefaults } from '../lib/config.js';
import {
  FS_MATRIX,
  FS_VERBS,
  fsCell,
  fsObjectTypes,
  fsUnsupportedMessage,
  fsVerbsFor,
  renderFsMatrixCard,
  renderFsMatrixTable,
} from '../lib/fsmatrix.js';
import {
  typeRegistryAcceptedSpellings,
  typeRegistryCreatableTypes,
  typeRegistryDuplicateSpellings,
  typeRegistryRow,
  typeRegistryRows,
  typeRegistryRowsForPhase,
  typeRegistryTypes,
} from '../lib/typeregistry.js';
import { fsOpsTools } from '../lib/tools/fsops.js';
import { readTools } from '../lib/tools/read.js';
import { writeTools } from '../lib/tools/write.js';
import { objectTools } from '../lib/tools/objects.js';
import { structureTools } from '../lib/tools/structure.js';
import { packageTools } from '../lib/tools/packages.js';
import { crudTools } from '../lib/tools/crud.js';
import type { Context } from '@deepseek-ai/cordis';

/**
 * The fs_ops matrix (docs/ddic-fsops-matrix-plan.md): the type registry is
 * the single source of truth; the fs matrix is a pure projection of it; the
 * four adt_object_* tools derive their type enums and refusals from both.
 * These tests are the anti-drift skeleton of the parity lock:
 *
 *   registry ↔ fs matrix ↔ (createByType superset) ↔ tool schemas ↔ card
 *
 * The mock-routing pin and the tool-reference doc pin join in their own
 * engine commits (six-lock target, §3.5).
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

/** Build the catalog like index.ts does (facades appended last). */
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
  const fs = fsOpsTools(deps, by as never);
  const fsByName = new Map(fs.map((t) => [t.name, t]));
  return {
    by,
    write: fsByName.get('adt_object_write')!,
    read: fsByName.get('adt_object_read')!,
    edit: fsByName.get('adt_object_edit')!,
    delete: fsByName.get('adt_object_delete')!,
    crud: crud[0]!,
  };
}

// ---------------------------------------------------------------------------
// Registry invariants
// ---------------------------------------------------------------------------

test('registry spellings are unique (type / adtType / alias)', () => {
  assert.deepEqual(typeRegistryDuplicateSpellings(), []);
});

test('registry rows cover the four phases with the planned counts', () => {
  // §4 row plan: P1 = 9 rows (incl. DOMA_VALUE), P4 >= 4 (MSAG/DEVC/ENQU/VIEW/SHLP/TYPE/INDX + 7 long-tail).
  assert.equal(typeRegistryRowsForPhase(1).length, 9);
  assert.ok(typeRegistryRowsForPhase(2).length >= 5);
  assert.ok(typeRegistryRowsForPhase(3).length >= 3);
  assert.ok(typeRegistryRowsForPhase(4).length >= 10);
  // Canonical order starts with the P1 modeling chain.
  assert.deepEqual(typeRegistryTypes().slice(0, 9), [
    'DOMA', 'DOMA_VALUE', 'DTEL', 'STRU', 'TABL', 'TTYP', 'DDLS', 'DCLS', 'DDLX',
  ]);
});

test('every create endpoint in the protocol createByType catalog exists in the registry', () => {
  const registryEndpoints = new Set(
    typeRegistryRows()
      .filter((r) => r.createEndpoint)
      .map((r) => r.createEndpoint!.replace(/^\//, '')),
  );
  for (const type of Object.keys(ENDPOINTS.createByType)) {
    const fn = ENDPOINTS.createByType[type as keyof typeof ENDPOINTS.createByType];
    const path = fn(undefined).replace('/sap/bc/adt/', '').replace(/\/$/, '');
    assert.ok(
      registryEndpoints.has(path),
      `protocol createByType '${type}' (${path}) has no registry row with that createEndpoint`,
    );
  }
});

test('registry creatable types are a SUPERSET of the protocol createByType catalog', () => {
  const protocolTypes = Object.keys(ENDPOINTS.createByType).sort();
  const registryTypes = typeRegistryCreatableTypes().slice().sort();
  for (const t of protocolTypes) {
    assert.ok(registryTypes.includes(t), `registry is missing the protocol creatable '${t}'`);
  }
});

// ---------------------------------------------------------------------------
// Matrix = pure projection of the registry
// ---------------------------------------------------------------------------

test('fs matrix rows and order equal the registry rows; every cell has a status', () => {
  assert.deepEqual(Object.keys(FS_MATRIX), typeRegistryTypes());
  for (const row of typeRegistryRows()) {
    const cells = FS_MATRIX[row.type]!;
    assert.deepEqual(Object.keys(cells).sort(), [...FS_VERBS].slice().sort());
    for (const verb of FS_VERBS) {
      const cell = cells[verb];
      assert.ok(['yes', 'no', 'planned', 'unverified'].includes(cell.status), `${verb}×${row.type} bad status`);
      if (cell.status === 'yes') assert.ok(cell.via, `yes-cell ${verb}×${row.type} must name its engine (via)`);
      if (cell.status === 'planned') assert.ok(cell.phase, `planned cell ${verb}×${row.type} must name its phase`);
    }
  }
});

test('GUI-only rows refuse honestly (VIEW/SHLP write/edit → SE11 guidance)', () => {
  assert.match(fsUnsupportedMessage('write', 'VIEW'), /not supported/);
  assert.match(fsUnsupportedMessage('write', 'VIEW'), /SE11/);
  assert.match(fsUnsupportedMessage('edit', 'SHLP'), /SE11/);
  assert.match(fsUnsupportedMessage('write', 'SHLP'), /Supported for SHLP/);
});

test('phased rows promise their phase, never a bare refusal', () => {
  assert.match(fsUnsupportedMessage('write', 'INCL'), /planned for phase P2/);
  assert.match(fsUnsupportedMessage('edit', 'SRVB'), /planned for phase P3/);
  assert.match(fsUnsupportedMessage('write', 'ENQU'), /not verified yet/);
  assert.match(fsUnsupportedMessage('write', 'NOPE'), /unknown object type 'NOPE'/);
});

test('read routing: structured types → structured, DEVC → packageContent, source → source', () => {
  assert.equal(fsCell('read', 'DOMA')!.via, 'structured');
  assert.equal(fsCell('read', 'MSAG')!.via, 'structured');
  assert.equal(fsCell('read', 'DEVC')!.via, 'packageContent');
  assert.equal(fsCell('read', 'CLAS')!.via, 'source');
  assert.equal(fsCell('read', 'TABL')!.via, 'source');
});

test('today-cells: structured types derive full verb sets; DEVC pinned', () => {
  for (const type of ['DOMA', 'DTEL', 'TTYP', 'MSAG']) {
    // write derives yes (create endpoint); the write ENGINE is a later
    // commit — the cell status describes the matrix, the tool refuses
    // with frameworkPending until the engine lands.
    assert.deepEqual(fsVerbsFor(type), ['write', 'read', 'edit', 'delete'], `${type} today set`);
  }
  assert.deepEqual(fsVerbsFor('DEVC'), ['write', 'read', 'delete']);
  assert.equal(fsCell('write', 'PROG')!.status, 'yes');
});

// ---------------------------------------------------------------------------
// Rendering (the card is a committed surface of the skeleton)
// ---------------------------------------------------------------------------

test('the matrix card renders every row with phase and legend', () => {
  const card = renderFsMatrixCard();
  assert.match(card, /- DOMA \(Domain, P1\): write:✅ read:✅ edit:✅ delete:✅/);
  assert.match(card, /- VIEW \(Classic view \(SE11\), P4\): write:✗/);
  assert.match(card, /write = create-or-override/);
});

test('the doc table renderer produces the pinned column shape', () => {
  const table = renderFsMatrixTable();
  assert.match(table, /\| type \| write \| read \| edit \| delete \| editMode \| activates \| phase \|/);
  // Spot rows: P1 chain and a GUI-only refusal.
  assert.match(table, /\| DOMA \| ✅ structured \|/);
  assert.match(table, /\| VIEW \| ❌/);
});

// ---------------------------------------------------------------------------
// The four tools — skeleton behavior
// ---------------------------------------------------------------------------

test('adt_object_read without name returns the matrix card (committed surface)', async () => {
  const { read } = buildCatalog(registry);
  const card = (await read.execute({}, exec)) as { matrixCard: string };
  assert.match(card.matrixCard, /fs_ops capability matrix/);
});

test('adt_object_read routes structured types and DEVC through the owners', async () => {
  const { read } = buildCatalog(registry);
  const msag = (await read.execute({ type: 'MSAG', name: 'zmsg_demo' }, exec)) as {
    verb: string; type: string; kind: string;
  };
  assert.equal(msag.verb, 'read');
  assert.equal(msag.type, 'MSAG');
  assert.equal(msag.kind, 'MSAG');

  const pkg = (await read.execute({ type: 'DEVC', name: 'zpack_demo' }, exec)) as {
    objects: unknown[];
  };
  assert.ok(pkg.objects.length > 0);
});

test('planned/unverified cells refuse with the matrix message, never a no-op', async () => {
  const { write, edit } = buildCatalog(registry);
  await assert.rejects(
    () => write.execute({ type: 'INCL', name: 'ZINCL_X', source: 'WRITE x.' }, exec),
    /planned for phase P2/,
  );
  await assert.rejects(
    () => edit.execute({ type: 'VIEW', name: 'ZVIEW_X', properties: {} }, exec),
    /not supported/,
  );
  await assert.rejects(
    () => write.execute({ type: 'ENQU', name: 'ZENQU_X', description: 'd', packageName: '$TMP' }, exec),
    /not verified yet/,
  );
});

test('unknown types and missing names fail with guidance', async () => {
  const { write, delete: del } = buildCatalog(registry);
  await assert.rejects(
    () => write.execute({ type: 'NOPE', name: 'X' }, exec),
    /unknown object type 'NOPE'/,
  );
  await assert.rejects(() => del.execute({ type: 'DOMA' }, exec), /`name` is required/);
  await assert.rejects(() => del.execute({ name: 'ZDOMA' }, exec), /`type` is required/);
});

test('write engines route through the owner chain (A-group removal landed them)', async () => {
  const { write } = buildCatalog(registry);
  // DOMA/PROG write cells route to the internal create engine — the full
  // owner chain (policy/lock-hygiene/transport policing) runs; on the mock
  // this CREATES the object. The remaining pending engines (SRVB binding,
  // VIEW metadata reads) refuse loudly instead of degrading.
  const doma = (await write.execute({ type: 'DOMA', name: 'ZDOMA_ENG_OK', description: 'engine routed', packageName: '$TMP' }, exec)) as {
    verb: string; type: string; success?: boolean;
  };
  assert.equal(doma.verb, 'write');
  assert.equal(doma.type, 'DOMA');
  const prog = (await write.execute({ type: 'PROG', name: 'ZPROG_ENG_OK', description: 'engine routed', packageName: '$TMP' }, exec)) as {
    verb: string; type: string; success?: boolean;
  };
  assert.equal(prog.verb, 'write');
  assert.equal(prog.type, 'PROG');
  // Cleanup both via the fs delete.
  const { delete: del } = buildCatalog(registry);
  await del.execute({ type: 'DOMA', name: 'ZDOMA_ENG_OK' }, exec);
  await del.execute({ type: 'PROG', name: 'ZPROG_ENG_OK' }, exec);
});

test('write: P1/P3 source types carry the real-system wire forms (DCLS chain on the mock)', async () => {
  const { write, read, delete: del } = buildCatalog(registry);
  // DCLS write → create engine → client.createObject with the dcl:dclSource
  // root + /acm/dcl/sources collection (real-system evidence, 4.1 fix).
  const created = (await write.execute({
    type: 'DCLS', name: 'ZDCLS_ENG_OK', description: 'engine routed',
    packageName: '$TMP', source: "@MappingRole: true\ndefine role zdcls_eng_ok {\n  grant select on t100;\n}\n",
  }, exec)) as { verb: string; type: string; success?: boolean; uri?: string };
  assert.equal(created.verb, 'write');
  assert.equal(created.type, 'DCLS');
  assert.equal(created.success, true, `DCLS write failed: ${JSON.stringify(created)}`);
  // Read it back through the fs read engine (source form).
  const back = (await read.execute({ type: 'DCLS', name: 'ZDCLS_ENG_OK' }, exec)) as { source?: string };
  assert.match(back.source ?? '', /define role zdcls_eng_ok/);
  await del.execute({ type: 'DCLS', name: 'ZDCLS_ENG_OK' }, exec);
});

test('engines whose commit has not landed refuse loudly (no silent degrade)', async () => {
  const { edit } = buildCatalog(registry);
  // SRVB edit is planned; VIEW edit is a hard no — both refuse by message.
  await assert.rejects(
    () => edit.execute({ type: 'VIEW', name: 'ZVIEW_X', properties: {} }, exec),
    /not supported/,
  );
});

test('adt_object_edit refuses patch-less calls before touching the wire', async () => {
  const { edit } = buildCatalog(registry);
  await assert.rejects(
    () => edit.execute({ type: 'MSAG', name: 'ZMSG_DEMO' }, exec),
    /nothing to patch/,
  );
});

test('edit routes structured patches through the owner chain', async () => {
  const { edit } = buildCatalog(registry);
  const result = (await edit.execute(
    { type: 'MSAG', name: 'ZMSG_DEMO', messages: [{ number: '001', text: 'fs edit &1' }] },
    exec,
  )) as { verb: string; type: string; changed: string[] };
  assert.equal(result.verb, 'edit');
  assert.equal(result.type, 'MSAG');
  assert.ok(result.changed.some((e) => e.startsWith('messages')));
});

test('delete routes through the owner chain', async () => {
  const { crud, delete: del } = buildCatalog(registry);
  // Create via the (still-registered) CRUD-era owner, delete via the fs verb
  // (TABL: the mock supports the full create→delete round trip).
  await crud.execute(
    {
      verb: 'create', type: 'TABL', name: 'ZTBL_FSOPS_TMP',
      description: 'fsops skeleton', packageName: '$TMP',
      fields: [{ name: 'ID', type: 'CHAR', length: 8, isKey: true }],
    },
    exec,
  );
  const result = (await del.execute({ type: 'TABL', name: 'ZTBL_FSOPS_TMP' }, exec)) as {
    verb: string; type: string; deleted: boolean;
  };
  assert.equal(result.verb, 'delete');
  assert.equal(result.type, 'TABL');
  assert.equal(result.deleted, true);
});

test('the fs type vocabulary is a superset of the CRUD matrix rows (migration is additive)', () => {
  const fsTypes = new Set(typeRegistryAcceptedSpellings());
  for (const crudType of ['CLAS', 'INTF', 'PROG', 'INCL', 'FUNC', 'DDLS', 'TABL', 'STRU', 'DOMA', 'DTEL', 'TTYP', 'MSAG', 'DEVC']) {
    assert.ok(fsTypes.has(crudType), `fs vocabulary lost the CRUD type '${crudType}'`);
  }
  // The fs additions the CRUD matrix never had.
  for (const t of ['DOMA_VALUE', 'DCLS', 'DDLX', 'BDEF', 'SRVD', 'SRVB', 'ENQU', 'VIEW', 'SHLP', 'TYPE', 'INDX']) {
    assert.ok(typeRegistryRow(t), `registry row '${t}' missing`);
  }
});

test('dead-reference sweep: removed A-group tools are gone from user-facing docs', () => {
  const docDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const REMOVED = [
    'adt_crud', 'adt_create_object', 'adt_read_object', 'adt_read_structure',
    'adt_write_object', 'adt_edit_object', 'adt_write_structure',
    'adt_delete_object', 'adt_package_content',
  ];
  for (const rel of ['docs/agent-guide.md', 'docs/tool-reference.md', 'README.md']) {
    const path = join(docDir, rel);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    for (const name of REMOVED) {
      // Word-boundary match; adt_object_read's prefix contains adt_object_
      // but none of the removed names are prefixes of it (they end in
      // different words), except adt_read_object vs adt_object_read —
      // distinct words, safe with boundaries.
      const re = new RegExp(`\\b${name}\\b`);
      assert.ok(
        !re.test(content),
        `${rel} still references removed tool '${name}' — rewrite for the four fs_ops tools (docs/ddic-fsops-matrix-plan.md §6.4)`,
      );
    }
  }
});
