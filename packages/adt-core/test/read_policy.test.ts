import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AdtClient } from '@nefevcore/abap-adt-protocol';
import { createMockAdtServer } from '@nefevcore/abap-adt-mock';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { builtinDefaults } from '../lib/config.js';
import { AdtPolicy, AdtPolicyError } from '../lib/policy.js';
import { dataPreviewTools } from '../lib/tools/datapreview.js';
import { extractTablesFromSql } from '../lib/tableblocklist.js';

/**
 * Read-side governance (P0-1, blockedTables): the entity and freestyle-SQL
 * paths of adt_data_preview resolve their target tables and enforce the
 * blocked-table catalog BEFORE any request leaves the client — a denied read
 * produces zero traffic — while the `off` default leaves existing users
 * untouched and `allowedTables` exemptions pass with an audit note.
 */

const exec = { signal: undefined } as never;

let registry: AdtRegistry; // read governance ON (standard)
let plainRegistry: AdtRegistry; // profile off (the default)

before(async () => {
  registry = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    blockedTablesProfile: 'standard',
  });
  plainRegistry = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0 });
});

after(async () => {
  await registry.dispose();
  await plainRegistry.dispose();
});

test('extractTablesFromSql: FROM and JOIN targets, deduped, case-insensitive', () => {
  assert.deepEqual(
    extractTablesFromSql('select mandt, matnr from MARA join but000 on 1 = 1'),
    ['MARA', 'BUT000'],
  );
  assert.deepEqual(extractTablesFromSql('SELECT * FROM kna1'), ['KNA1']);
  assert.deepEqual(extractTablesFromSql('SELECT * FROM kna1 a JOIN kna1 b ON a.kunnr = b.kunnr'), ['KNA1']);
  assert.deepEqual(extractTablesFromSql('select 1 from dummy where x in (select y from ztab)'), [
    'DUMMY',
    'ZTAB',
  ]);
  assert.deepEqual(extractTablesFromSql('update KNA1 set name = 1'), []);
});

test('standard profile: entity preview of KNA1 is refused with ZERO requests to SAP', async () => {
  // A counting fetch around the real mock proves the denial happens BEFORE
  // any HTTP traffic (the acceptance bar of P0-1).
  const mock = createMockAdtServer({ port: 0, host: '127.0.0.1' });
  const port = await mock.listen(0);
  try {
    let fetches = 0;
    const countingFetch: typeof fetch = (input, init) => {
      fetches += 1;
      return fetch(input, init);
    };
    const client = new AdtClient(
      {
        name: 'guarded',
        url: `http://127.0.0.1:${port}`,
        client: '000',
        language: 'EN',
        auth: { type: 'none' },
      },
      countingFetch,
    );
    const entry = {
      config: client.destination,
      mock: true,
      client,
      policy: AdtPolicy.resolve({ blockedTablesProfile: 'standard' }, {}),
    };
    const tools = dataPreviewTools({
      registry: { require: async () => entry } as never,
      ledger: new LockLedger(),
    });
    const preview = tools[0]!;

    await assert.rejects(
      () => preview.execute({ name: 'kna1' }, exec),
      (error: unknown) => {
        assert.ok(error instanceof AdtPolicyError);
        assert.equal(error.rule, 'blockedTables');
        assert.match(error.message, /blockedTables: KNA1 — /);
        assert.match(error.message, /Customer \/ vendor \/ BP master PII/);
        return true;
      },
    );
    assert.equal(fetches, 0, 'the denial must not produce any SAP request');

    await assert.rejects(
      () => preview.execute({ sql: 'select * from usr02' }, exec),
      (error: unknown) => {
        assert.ok(error instanceof AdtPolicyError);
        assert.equal(error.rule, 'blockedTables');
        return true;
      },
    );
    assert.equal(fetches, 0, 'the SQL path denies before any request too');
  } finally {
    await mock.close();
  }
});

test('standard profile: freestyle SQL joining a blocked table is refused (mock destination)', async () => {
  const tools = dataPreviewTools({ registry, ledger: new LockLedger() });
  const preview = tools[0]!;
  await assert.rejects(
    () => preview.execute({ sql: 'select id from ZAFW_FLIGHT f join LFA1 v on 1 = 1' }, exec),
    (error: unknown) => {
      assert.ok(error instanceof AdtPolicyError);
      assert.equal(error.rule, 'blockedTables');
      assert.match(error.message, /LFA1/);
      return true;
    },
  );
});

test('off (default): nothing is blocked — existing behavior unchanged', async () => {
  const tools = dataPreviewTools({ registry: plainRegistry, ledger: new LockLedger() });
  const preview = tools[0]!;
  // The mock answers any entity; without a profile the read goes through.
  const result = await preview.execute({ name: 'KNA1' }, exec);
  assert.equal(result.name, 'KNA1');
  assert.ok(result.rows.length > 0);
  assert.equal(result.note, undefined);
});

test('allowedTables exemption passes with an audited note', async () => {
  const exemptRegistry = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    blockedTablesProfile: 'standard',
    allowedTables: ['KNA1'],
  });
  try {
    const tools = dataPreviewTools({ registry: exemptRegistry, ledger: new LockLedger() });
    const result = await tools[0]!.execute({ name: 'kna1' }, exec);
    assert.equal(result.name, 'KNA1');
    assert.match(result.note!, /allowedTables exemption \(audited\): KNA1/);
  } finally {
    await exemptRegistry.dispose();
  }
});

test('blockedTables custom pattern extends the catalog per destination', async () => {
  const customRegistry = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    blockedTablesProfile: 'minimal',
    blockedTables: ['ZAFW_*'],
  });
  try {
    const tools = dataPreviewTools({ registry: customRegistry, ledger: new LockLedger() });
    await assert.rejects(
      () => tools[0]!.execute({ name: 'ZAFW_FLIGHT' }, exec),
      (error: unknown) => {
        assert.ok(error instanceof AdtPolicyError);
        assert.match(error.message, /User-extended blocklist/);
        return true;
      },
    );
  } finally {
    await customRegistry.dispose();
  }
});

// ---------------------------------------------------------------------------
// Usage-report optimizations (adt-tool-usage-notes, NWBC 403 session)
// ---------------------------------------------------------------------------

test('freestyle SQL pre-check: JOIN / subquery / aggregates fail LOCALLY with the actual reason (usage 1.1/1.2)', async () => {
  const tools = dataPreviewTools({ registry: plainRegistry, ledger: new LockLedger() });
  const preview = tools[0]!;
  // JOIN（含 LEFT JOIN 变体）：报错说 JOIN 不支持 + 本地关联变通，而不是误导性的"仅允许一个 SELECT"
  await assert.rejects(
    () => preview.execute({ sql: 'SELECT h.* FROM AGR_HIER h LEFT JOIN AGR_TEXTS t ON h.OBJECT_ID = t.OBJECT_ID' }, exec),
    (error: unknown) => {
      assert.match((error as Error).message, /does not support JOIN/i);
      assert.match((error as Error).message, /separately.*locally|correlate/i);
      return true;
    },
  );
  // 子查询
  await assert.rejects(
    () => preview.execute({ sql: 'SELECT * FROM T001 WHERE BUKRS IN (SELECT BUKRS FROM T001)' }, exec),
    /does not support subqueries/i,
  );
  // 聚合（别名也在 SELECT 里——不进入后端就被拦）
  await assert.rejects(
    () => preview.execute({ sql: 'SELECT COUNT(*) AS CNT, MIN(OBJECT_ID) AS MIN_ID FROM AGR_HIER' }, exec),
    (error: unknown) => {
      assert.match((error as Error).message, /does not support aggregate functions/i);
      assert.match((error as Error).message, /compute.*locally/i);
      return true;
    },
  );
  // COUNT(*) 的 * 形态（无别名陷阱：此前后端报"非法名字字符"）
  await assert.rejects(
    () => preview.execute({ sql: 'SELECT COUNT(*) FROM AGR_HIER' }, exec),
    /does not support aggregate functions/i,
  );
  // 普通单表 SELECT 不受影响（governance off registry 放行到 mock）
  const ok = await preview.execute({ sql: 'SELECT * FROM ZAFW_FLIGHT' }, exec);
  assert.equal(ok.source, 'sql');
});

test('governance denial outranks the SQL syntax pre-check (usage 1.1 + P0-1 合序)', async () => {
  const tools = dataPreviewTools({ registry, ledger: new LockLedger() });
  await assert.rejects(
    () => tools[0]!.execute({ sql: 'select id from ZAFW_FLIGHT f join LFA1 v on 1 = 1' }, exec),
    (error: unknown) => {
      assert.ok(error instanceof AdtPolicyError);
      assert.equal(error.rule, 'blockedTables');
      return true;
    },
  );
});

test('success payload carries the logged-on client (usage 3)', async () => {
  const tools = dataPreviewTools({ registry: plainRegistry, ledger: new LockLedger() });
  const result = await tools[0]!.execute({ name: 'ZAFW_FLIGHT' }, exec);
  assert.equal(result.client, '000', 'demo destination logs on client 000');
  const rendered = (tools[0]!.output.render({}, result as never) as unknown as Array<{ text: string }>)[0]!.text;
  assert.match(rendered, /\[client 000\]/);
});

test('totalRows=0 with rows present falls back to the fetched count with a note (usage 1.4)', async () => {
  // 直接构造 result 形状走 toOutput：mock 的 totalRows 是 1234，为验证 0 回退
  // 用一个假 registry 注入固定 totalRows=0 的 client。
  const zeroRowsClient = {
    dataPreview: async () => ({
      name: 'X',
      totalRows: 0,
      queryExecutionTime: 12,
      columns: [{ name: 'ID', type: 'INT4' }],
      rows: [{ ID: '1' }, { ID: '2' }, { ID: '3' }],
    }),
  };
  const entry = {
    config: { name: 'zero', client: '100' },
    mock: true,
    client: zeroRowsClient,
    policy: AdtPolicy.resolve({}),
  };
  const tools = dataPreviewTools({ registry: { require: async () => entry } as never, ledger: new LockLedger() });
  const result = await tools[0]!.execute({ name: 'ANYTAB' }, exec);
  assert.equal(result.totalRows, 3, '0 despite rows → fetched count');
  assert.match(result.note!, /totalRows reported by the backend as 0 despite 3/);
  assert.equal(result.client, '100');
});
