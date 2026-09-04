import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateTableDdl, mapTableFieldType } from '@nefevcore/abap-adt-protocol';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { DebuggerManager } from '../lib/debugger.js';
import { builtinDefaults } from '../lib/config.js';
import { objectTools } from '../lib/tools/objects.js';
import { readTools } from '../lib/tools/read.js';

/**
 * TABL one-step creation (P1-2): `adt_create_object {type: TABL, fields}` →
 * generated DDIC 2.0 DDL (auto MANDT, annotations, typed fields) → written →
 * activated, all in one call. Without `fields` the placeholder behavior is
 * unchanged.
 */

const exec = { signal: undefined } as never;

let registry: AdtRegistry;

before(async () => {
  registry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0 });
});

after(async () => {
  await registry.dispose();
});

const deps = () => ({ registry, ledger: new LockLedger(), debugger: new DebuggerManager(registry) });

// ---------------------------------------------------------------------------
// Pure generator (packages/adt-protocol/src/tableddl.ts)
// ---------------------------------------------------------------------------

test('mapTableFieldType: builtin codes, shorthand, data elements, junk rejection', () => {
  assert.equal(mapTableFieldType({ name: 'A', type: 'char', length: 20 }), 'abap.char(20)');
  assert.equal(mapTableFieldType({ name: 'A', type: 'CHAR' }), 'abap.char(1)');
  assert.equal(mapTableFieldType({ name: 'A', type: 'NUMC', length: 10 }), 'abap.numc(10)');
  assert.equal(mapTableFieldType({ name: 'A', type: 'RAW' }), 'abap.raw(16)');
  assert.equal(mapTableFieldType({ name: 'A', type: 'DEC', length: 13, decimals: 3 }), 'abap.dec(13,3)');
  assert.equal(mapTableFieldType({ name: 'A', type: 'CURR', length: 11, decimals: 2 }), 'abap.dec(11,2)');
  assert.equal(mapTableFieldType({ name: 'A', type: 'INT4' }), 'abap.int4');
  assert.equal(mapTableFieldType({ name: 'A', type: 'STRING' }), 'abap.string(0)');
  assert.equal(mapTableFieldType({ name: 'A', type: 'DATS' }), 'abap.dats');
  assert.equal(mapTableFieldType({ name: 'A', type: 'UTCLONG' }), 'abap.utclong');
  assert.equal(mapTableFieldType({ name: 'A', type: 'UUID' }), 'sysuuid_x16');
  assert.equal(mapTableFieldType({ name: 'A', type: 'CHAR32' }), 'abap.char(32)');
  assert.equal(mapTableFieldType({ name: 'A', type: 'MATNR' }), 'matnr', 'unknown names pass as data elements');
  assert.throws(() => mapTableFieldType({ name: 'A', type: 'BAD TYPE!' }), /data element/);
});

test('generateTableDdl: annotations, auto MANDT, keys, labels, validation', () => {
  const ddl = generateTableDdl({
    name: 'ztools_demo',
    description: "Demo 'table'",
    packageName: '$TMP',
    fields: [
      { name: 'ID', type: 'CHAR', length: 10, isKey: true, description: 'Business key' },
      { name: 'AMOUNT', type: 'CURR', length: 13, decimals: 2, notNull: true },
      { name: 'TITLE', type: 'LANDTEXT' },
      { name: 'CREATED_AT', type: 'UTCLONG' },
    ],
  });
  assert.match(ddl, /@EndUserText\.label : 'Demo ''table'''/, 'description with escaped quote');
  assert.match(ddl, /@AbapCatalog\.tableCategory : #TRANSPARENT/);
  assert.match(ddl, /@AbapCatalog\.deliveryClass : #A/);
  assert.match(ddl, /@AbapCatalog\.dataMaintenance : #ALLOWED/);
  assert.match(ddl, /define table ztools_demo \{/);
  assert.match(ddl, /key client : abap\.clnt not null;/, 'MANDT auto key');
  assert.match(ddl, /@EndUserText\.label : 'Business key'\n  key id : abap\.char\(10\) not null;/);
  assert.match(ddl, /amount : abap\.dec\(13,2\) not null;/);
  assert.match(ddl, /title : landtext;/, 'data-element reference lowercased');
  assert.match(ddl, /created_at : abap\.utclong;/);

  // Custom delivery class / category land in the annotations.
  const custom = generateTableDdl({
    name: 'ZCUSTOM',
    description: 'x',
    packageName: '$TMP',
    deliveryClass: 'C',
    tableCategory: 'STRUCTURE',
    fields: [{ name: 'A', type: 'INT4' }],
  });
  assert.match(custom, /#C\b/);
  assert.match(custom, /#STRUCTURE/);

  // Validation: no fields, duplicate fields, client field, bad name.
  assert.throws(
    () => generateTableDdl({ name: 'ZT', description: 'x', packageName: '$TMP', fields: [] }),
    /at least one field/,
  );
  assert.throws(
    () =>
      generateTableDdl({
        name: 'ZT',
        description: 'x',
        packageName: '$TMP',
        fields: [
          { name: 'A', type: 'INT4' },
          { name: 'A', type: 'INT4' },
        ],
      }),
    /twice/,
  );
  assert.throws(
    () => generateTableDdl({ name: 'ZT', description: 'x', packageName: '$TMP', fields: [{ name: 'MANDT', type: 'MANDT' }] }),
    /client key field is added automatically/,
  );
  assert.throws(
    () => generateTableDdl({ name: 'A TABLE NAME', description: 'x', packageName: '$TMP', fields: [{ name: 'A', type: 'INT4' }] }),
    /valid ABAP object name/,
  );
});

// ---------------------------------------------------------------------------
// The tool flow against the mock
// ---------------------------------------------------------------------------

test('adt_create_object TABL with fields: create → DDL write → activate in one call', async () => {
  const by = new Map(objectTools(deps()).map((t) => [t.name, t]));
  const create = by.get('adt_create_object')!;

  const result = await create.execute(
    {
      type: 'TABL',
      name: 'ZTBL_AGENT_DEMO',
      description: 'Agent-created demo table',
      packageName: '$TMP',
      fields: [
        { name: 'ID', type: 'CHAR', length: 10, isKey: true },
        { name: 'AMOUNT', type: 'DEC', length: 13, decimals: 2 },
        { name: 'NOTE', type: 'STRING' },
      ],
    },
    exec,
  );
  assert.equal(result.success, true, `activation outcome: ${JSON.stringify(result.messages)}`);
  assert.equal(result.activated, true);
  assert.match(result.ddlSource!, /key client : abap\.clnt not null;/);
  assert.match(result.ddlSource!, /key id : abap\.char\(10\) not null;/);

  // The written source on the backend IS the generated DDL, and the active
  // version exists (activation promoted it).
  const read = new Map(readTools(deps()).map((t) => [t.name, t]));
  const source = await read.get('adt_read_object')!.execute(
    { name: 'ztbl_agent_demo', type: 'TABL' },
    exec,
  );
  assert.match(source.source, /define table ztbl_agent_demo \{/);
  assert.match(source.source, /amount : abap\.dec\(13,2\);/);
  const active = await read.get('adt_read_object')!.execute(
    { name: 'ztbl_agent_demo', type: 'TABL', version: 'active' },
    exec,
  );
  assert.match(active.source, /define table ztbl_agent_demo \{/);
});

test('adt_create_object TABL without fields: placeholder path unchanged', async () => {
  const by = new Map(objectTools(deps()).map((t) => [t.name, t]));
  const result = await by.get('adt_create_object')!.execute(
    { type: 'TABL', name: 'ZTBL_PLACEHOLDER', description: 'placeholder', packageName: '$TMP' },
    exec,
  );
  assert.equal(result.success, true);
  assert.equal(result.activated, undefined);
  assert.equal(result.ddlSource, undefined);
  const read = new Map(readTools(deps()).map((t) => [t.name, t]));
  const source = await read.get('adt_read_object')!.execute({ name: 'ztbl_placeholder', type: 'TABL' }, exec);
  assert.equal(source.source, '* ZTBL_PLACEHOLDER', 'mock placeholder source, untouched by the DDL flow');
});

test('adt_create_object TABL: empty fields array is an error, not a silent placeholder', async () => {
  const by = new Map(objectTools(deps()).map((t) => [t.name, t]));
  await assert.rejects(
    () =>
      by.get('adt_create_object')!.execute(
        { type: 'TABL', name: 'ZTBL_EMPTY', description: 'x', packageName: '$TMP', fields: [] },
        exec,
      ),
    /at least one field/,
  );
});
