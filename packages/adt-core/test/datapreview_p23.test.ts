import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { builtinDefaults } from '../lib/config.js';
import { dataPreviewTools } from '../lib/tools/datapreview.js';

/**
 * P3 (CDS association navigation) + pipeline integration, over the real mock
 * server: associationlist / followassociation actions, plus the upgraded SQL
 * pipeline (lint + compiler) end to end.
 */

const exec = { signal: undefined } as never;

let registry: AdtRegistry;
let dispose: () => Promise<void>;

before(async () => {
  registry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0 });
  dispose = () => registry.dispose();
});

after(async () => {
  await dispose();
});

test('associations: lists the CDS associations of ZCDS_DEMO', async () => {
  const tools = dataPreviewTools({ registry, ledger: new LockLedger() });
  const result = await tools[0]!.execute({ name: 'ZCDS_DEMO', kind: 'DDLS', associations: true }, exec);
  assert.equal(result.source, 'associations');
  assert.deepEqual(
    result.rows.map((r: Record<string, string>) => r.NAME),
    ['_Carrier', '_Bookings'],
  );
  assert.match(result.rows[0]!.TARGET, /ZCDS_CARRIER/);
});

test('association: follows _Bookings and returns target rows', async () => {
  const tools = dataPreviewTools({ registry, ledger: new LockLedger() });
  const result = await tools[0]!.execute({ name: 'ZCDS_DEMO', kind: 'DDLS', association: '_Bookings', length: 5 }, exec);
  assert.equal(result.source, 'association _Bookings');
  assert.equal(result.name, 'ZCDS_BOOKING');
  assert.ok(result.rows.length > 0);
});

test('association: unknown name fails loudly (404 → clear error)', async () => {
  const tools = dataPreviewTools({ registry, ledger: new LockLedger() });
  await assert.rejects(
    () => tools[0]!.execute({ name: 'ZCDS_DEMO', kind: 'DDLS', association: '_Missing' }, exec),
    (error: unknown) => {
      assert.match((error as Error).message, /Data Preview is not available|_Missing|404/);
      return true;
    },
  );
});

test('associations on a TABL rejects with the CDS-only hint', async () => {
  const tools = dataPreviewTools({ registry, ledger: new LockLedger() });
  await assert.rejects(
    () => tools[0]!.execute({ name: 'T001', kind: 'TABL', associations: true }, exec),
    /apply to CDS views \(kind=DDLS\) only/,
  );
});

test('SQL pipeline (mock): JOIN compiles to per-table fetches', async () => {
  const tools = dataPreviewTools({ registry, ledger: new LockLedger() });
  const result = await tools[0]!.execute(
    { sql: 'SELECT a.id, b.id FROM ZAFW_FLIGHT a JOIN ZCDS_DEMO b ON a.id = b.id', length: 5 },
    exec,
  );
  assert.equal(result.source, 'sql (compiled)');
  assert.match(result.note ?? '', /compiled client-side/);
});

test('SQL pipeline (mock): dialect rewrites surface in the note', async () => {
  const tools = dataPreviewTools({ registry, ledger: new LockLedger() });
  const result = await tools[0]!.execute(
    { sql: 'SELECT ID FROM ZAFW_FLIGHT ORDER BY ID DESC LIMIT 10', length: 5 },
    exec,
  );
  assert.equal(result.source, 'sql');
  assert.match(result.note ?? '', /DESCENDING/);
  assert.match(result.note ?? '', /LIMIT 10/);
});
