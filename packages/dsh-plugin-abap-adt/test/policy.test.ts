import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTablesFromSql } from '../lib/tableblocklist.js';
import {
  AdtPolicy,
  AdtPolicyError,
  LOCAL_PACKAGE,
  POLICY_ENV,
  parsePatterns,
  matchesAny,
  isLocalPackage,
  parseEnvBoolean,
} from '../lib/policy.js';

// ---------------------------------------------------------------------------
// Pattern parsing / glob matching
// ---------------------------------------------------------------------------

test('parsePatterns: empty or omitted means allow all', () => {
  assert.deepEqual(parsePatterns(undefined), ['*']);
  assert.deepEqual(parsePatterns(''), ['*']);
  assert.deepEqual(parsePatterns('   '), ['*']);
});

test('parsePatterns: splits and trims comma-separated globs', () => {
  assert.deepEqual(parsePatterns('D01K96*'), ['D01K96*']);
  assert.deepEqual(parsePatterns('Z*,$TMP'), ['Z*', '$TMP']);
  assert.deepEqual(parsePatterns('  A ,  B  ,C'), ['A', 'B', 'C']);
  // Explicit empty list (e.g. ",") denies everything — no patterns to match.
  assert.deepEqual(parsePatterns(','), []);
});

test('matchesAny: wildcard matching is case-insensitive', () => {
  assert.equal(matchesAny(['D01K96*'], 'D01K960001'), true);
  assert.equal(matchesAny(['D01K96*'], 'D01K96123'), true);
  assert.equal(matchesAny(['D01K96*'], 'S4HK900001'), false);
  assert.equal(matchesAny(['Z*'], 'ZPACK_DEMO'), true);
  assert.equal(matchesAny(['Z*'], 'zcl_demo'), true);
  assert.equal(matchesAny(['Z*'], 'YTEST'), false);
  assert.equal(matchesAny(['*'], 'anything-at-all'), true);
  assert.equal(matchesAny(['$TMP'], '$TMP'), true);
  assert.equal(matchesAny(['$TMP'], 'ZPACK'), false);
  assert.equal(matchesAny(['Z*', '$TMP'], 'ZPACK'), true);
  assert.equal(matchesAny(['Z*', '$TMP'], '$TMP'), true);
  assert.equal(matchesAny(['Z*', '$TMP'], 'YTEST'), false);
  assert.equal(matchesAny(['D01K9?'], 'D01K96'), true);
  assert.equal(matchesAny(['D01K9?'], 'D01K961'), false);
  assert.equal(matchesAny([], 'anything'), false);
});

test('isLocalPackage: only $TMP counts', () => {
  assert.equal(isLocalPackage('$TMP'), true);
  assert.equal(isLocalPackage('$tmp'), true);
  assert.equal(isLocalPackage('ZPACK_DEMO'), false);
  assert.equal(LOCAL_PACKAGE, '$TMP');
});

test('parseEnvBoolean: recognizes truthy/falsy values, ignores junk', () => {
  assert.equal(parseEnvBoolean('true'), true);
  assert.equal(parseEnvBoolean('1'), true);
  assert.equal(parseEnvBoolean('YES'), true);
  assert.equal(parseEnvBoolean('on'), true);
  assert.equal(parseEnvBoolean('false'), false);
  assert.equal(parseEnvBoolean('0'), false);
  assert.equal(parseEnvBoolean('No'), false);
  assert.equal(parseEnvBoolean('off'), false);
  assert.equal(parseEnvBoolean(undefined), undefined);
  assert.equal(parseEnvBoolean(''), undefined);
  assert.equal(parseEnvBoolean('banana'), undefined);
});

// ---------------------------------------------------------------------------
// Resolution precedence: config > SAP_* env > default
// ---------------------------------------------------------------------------

test('resolve: built-in defaults when nothing is configured', () => {
  const p = AdtPolicy.resolve({}, {});
  assert.equal(p.enableTransports, true);
  assert.deepEqual(p.allowedTransports, ['*']);
  assert.equal(p.allowTransportableEdits, true);
  assert.deepEqual(p.allowedPackages, ['*']);
  assert.equal(p.allowExecution, true);
  assert.equal(p.allowBatchWrites, false);
  // Read-side governance is opt-in: off with no lists.
  assert.equal(p.blockedTablesProfile, 'off');
  assert.deepEqual(p.blockedTables, []);
  assert.deepEqual(p.allowedTables, []);
  assert.equal(p.profile, 'dev');
  assert.deepEqual(p.sources, {
    enableTransports: 'default',
    allowedTransports: 'default',
    allowTransportableEdits: 'default',
    allowedPackages: 'default',
    allowExecution: 'default',
    allowBatchWrites: 'default',
    blockedTablesProfile: 'default',
    blockedTables: 'default',
    allowedTables: 'default',
    allowDebugger: 'default',
    allowDebugVariables: 'default',
    profile: 'default',
  });
});

test('resolve: SAP_* environment variables override defaults', () => {
  const env = {
    [POLICY_ENV.enableTransports]: 'true',
    [POLICY_ENV.allowedTransports]: 'D01K96*',
    [POLICY_ENV.allowTransportableEdits]: 'true',
    [POLICY_ENV.allowedPackages]: 'Z*,$TMP',
    [POLICY_ENV.allowExecution]: 'false',
    [POLICY_ENV.allowBatchWrites]: 'true',
  };
  const p = AdtPolicy.resolve({}, env);
  assert.equal(p.enableTransports, true);
  assert.deepEqual(p.allowedTransports, ['D01K96*']);
  assert.equal(p.allowTransportableEdits, true);
  assert.deepEqual(p.allowedPackages, ['Z*', '$TMP']);
  assert.equal(p.allowExecution, false);
  assert.equal(p.allowBatchWrites, true);
  assert.deepEqual(p.sources, {
    enableTransports: 'env',
    allowedTransports: 'env',
    allowTransportableEdits: 'env',
    allowedPackages: 'env',
    allowExecution: 'env',
    allowBatchWrites: 'env',
    blockedTablesProfile: 'default',
    blockedTables: 'default',
    allowedTables: 'default',
    allowDebugger: 'default',
    allowDebugVariables: 'default',
    profile: 'default',
  });
});

test('resolve: explicit config beats environment', () => {
  const env = {
    [POLICY_ENV.enableTransports]: 'false',
    [POLICY_ENV.allowedTransports]: 'S4HK*',
    [POLICY_ENV.allowedPackages]: 'Y*',
  };
  const p = AdtPolicy.resolve(
    {
      enableTransports: true,
      allowedTransports: 'D01K96*',
      allowedPackages: 'Z*,$TMP',
    },
    env,
  );
  assert.equal(p.enableTransports, true);
  assert.deepEqual(p.allowedTransports, ['D01K96*']);
  assert.deepEqual(p.allowedPackages, ['Z*', '$TMP']);
  assert.equal(p.sources.enableTransports, 'config');
  assert.equal(p.sources.allowedTransports, 'config');
  assert.equal(p.sources.allowedPackages, 'config');
});

test('resolve: mixed sources are tracked independently', () => {
  const env = { [POLICY_ENV.enableTransports]: 'false' };
  const p = AdtPolicy.resolve({ allowedTransports: 'D01K96*' }, env);
  assert.equal(p.enableTransports, false);
  assert.equal(p.sources.enableTransports, 'env');
  assert.deepEqual(p.allowedTransports, ['D01K96*']);
  assert.equal(p.sources.allowedTransports, 'config');
  assert.equal(p.sources.allowTransportableEdits, 'default');
});

// ---------------------------------------------------------------------------
// Rule assertions
// ---------------------------------------------------------------------------

test('assertTransportsEnabled: denies when transports are disabled', () => {
  const p = AdtPolicy.resolve({ enableTransports: false }, {});
  assert.throws(() => p.assertTransportsEnabled('adt_list_transports'), (e) => {
    assert.ok(e instanceof AdtPolicyError);
    assert.equal(e.rule, 'enableTransports');
    assert.match(e.message, /^\[POLICY\]/);
    assert.match(e.message, /SAP_ENABLE_TRANSPORTS/);
    return true;
  });
  AdtPolicy.resolve({}, {}).assertTransportsEnabled('adt_list_transports'); // default: ok
});

test('assertTransportAllowed: only whitelisted numbers pass', () => {
  const p = AdtPolicy.resolve({ allowedTransports: 'D01K96*' }, {});
  assert.doesNotThrow(() => p.assertTransportAllowed('D01K960001', 'adt_release_transport'));
  assert.throws(() => p.assertTransportAllowed('S4HK900001', 'adt_release_transport'), (e) => {
    assert.equal(e.rule, 'allowedTransports');
    assert.match(e.message, /S4HK900001/);
    return true;
  });
  AdtPolicy.resolve({}, {}).assertTransportAllowed('anything', 'x'); // '*' default
});

test('assertPackageAllowed: whitelist is authoritative', () => {
  const p = AdtPolicy.resolve({ allowedPackages: 'Z*,$TMP' }, {});
  assert.doesNotThrow(() => p.assertPackageAllowed('ZPACK_DEMO', 'adt_create_object'));
  assert.doesNotThrow(() => p.assertPackageAllowed('$TMP', 'adt_create_object'));
  assert.throws(() => p.assertPackageAllowed('YTEST', 'adt_create_object'), (e) => {
    assert.equal(e.rule, 'allowedPackages');
    assert.match(e.message, /YTEST/);
    return true;
  });
});

test('assertEditAllowed: transportable edits need the allow flag', () => {
  const strict = AdtPolicy.resolve({ allowTransportableEdits: false }, {});
  assert.doesNotThrow(() => strict.assertEditAllowed('$TMP', 'adt_write_object'));
  assert.throws(() => strict.assertEditAllowed('ZPACK_DEMO', 'adt_write_object'), (e) => {
    assert.equal(e.rule, 'allowTransportableEdits');
    assert.match(e.message, /SAP_ALLOW_TRANSPORTABLE_EDITS/);
    return true;
  });

  const permissive = AdtPolicy.resolve({ allowTransportableEdits: true, enableTransports: true }, {});
  assert.doesNotThrow(() => permissive.assertEditAllowed('ZPACK_DEMO', 'adt_write_object'));
});

test('assertEditAllowed: transportable edits require transports enabled', () => {
  const p = AdtPolicy.resolve({ allowTransportableEdits: true, enableTransports: false }, {});
  assert.doesNotThrow(() => p.assertEditAllowed('$TMP', 'adt_write_object'));
  assert.throws(() => p.assertEditAllowed('ZPACK_DEMO', 'adt_write_object'), (e) => {
    assert.equal(e.rule, 'enableTransports');
    assert.match(e.message, /transportable package ZPACK_DEMO/);
    return true;
  });
});

test('assertEditAllowed: package whitelist checked before transportability', () => {
  // Z* only, transportable edits allowed: ZCL_FOO passes, but $TMP is NOT on
  // the whitelist → denied by allowedPackages (whitelist runs first).
  const p = AdtPolicy.resolve({ allowedPackages: 'Z*', allowTransportableEdits: true }, {});
  assert.doesNotThrow(() => p.assertEditAllowed('ZCL_FOO', 'adt_create_object'));
  assert.throws(() => p.assertEditAllowed('$TMP', 'adt_create_object'), (e) => {
    assert.equal(e.rule, 'allowedPackages');
    return true;
  });
});

test('assertTransportUsage: auto-assigned backend transports are policed', () => {
  const p = AdtPolicy.resolve({ allowedTransports: 'D01K96*' }, {});
  assert.doesNotThrow(() => p.assertTransportUsage(undefined, 'adt_write_object (ZCL_X)'));
  assert.doesNotThrow(() => p.assertTransportUsage('D01K960001', 'adt_write_object (ZCL_X)'));
  assert.throws(() => p.assertTransportUsage('S4HK900001', 'adt_write_object (ZCL_X)'), (e) => {
    assert.equal(e.rule, 'allowedTransports');
    return true;
  });
  const off = AdtPolicy.resolve({ enableTransports: false }, {});
  assert.throws(() => off.assertTransportUsage('D01K960001', 'adt_write_object (ZCL_X)'), (e) => {
    assert.equal(e.rule, 'enableTransports');
    return true;
  });
});

test('describe: exposes the effective policy snapshot', () => {
  const p = AdtPolicy.resolve(
    { enableTransports: true, allowedTransports: 'D01K96*', allowTransportableEdits: true, allowedPackages: 'Z*,$TMP' },
    {},
  );
  const snap = p.describe();
  assert.equal(snap.enableTransports, true);
  assert.deepEqual(snap.allowedTransports, ['D01K96*']);
  assert.equal(snap.allowTransportableEdits, true);
  assert.deepEqual(snap.allowedPackages, ['Z*', '$TMP']);
  assert.equal(snap.sources.allowedTransports, 'config');
  assert.equal(snap.defaults.allowedTransports, '*');
  assert.equal(snap.blockedTablesProfile, 'off');
  assert.equal(snap.profile, 'dev');
});

// ---------------------------------------------------------------------------
// Destination environment profile (P0-2: dev | qa | prd tiering)
// ---------------------------------------------------------------------------

test('profile: dev keeps the plain knob semantics', () => {
  const p = AdtPolicy.resolve({ profile: 'dev' }, {});
  assert.equal(p.profile, 'dev');
  assert.equal(p.allowExecution, true); // default true, qa would close it
  assert.equal(p.allowBatchWrites, false);
  assert.equal(p.sources.profile, 'config');
});

test('profile: qa defaults execution and batch writes to closed; explicit config still opens them', () => {
  const qa = AdtPolicy.resolve({ profile: 'qa' }, {});
  assert.equal(qa.profile, 'qa');
  assert.equal(qa.allowExecution, false, 'unset allowExecution defaults to false on qa');
  assert.equal(qa.allowBatchWrites, false);
  assert.equal(qa.sources.allowExecution, 'default');

  const opened = AdtPolicy.resolve({ profile: 'qa', allowExecution: true, allowBatchWrites: true }, {});
  assert.equal(opened.allowExecution, true, 'an explicit config value stands on qa');
  assert.equal(opened.allowBatchWrites, true);

  const viaEnv = AdtPolicy.resolve({ profile: 'qa' }, { [POLICY_ENV.allowExecution]: 'true' });
  assert.equal(viaEnv.allowExecution, true, 'an explicit env value stands on qa');
});

test('profile: prd hard-denies execution and batch writes even when explicitly enabled', () => {
  const prd = AdtPolicy.resolve(
    { profile: 'prd', allowExecution: true, allowBatchWrites: true },
    { [POLICY_ENV.allowExecution]: 'true' },
  );
  assert.equal(prd.profile, 'prd');
  assert.equal(prd.allowExecution, false, 'prd forces the effective flag closed');
  assert.equal(prd.allowBatchWrites, false);
  assert.throws(() => prd.assertExecutionAllowed('adt_execute'), (e) => {
    assert.ok(e instanceof AdtPolicyError);
    assert.equal(e.rule, 'allowExecution');
    assert.match(e.message, /profile: prd/);
    return true;
  });
  assert.throws(() => prd.assertBatchWritesAllowed('adt_batch'), (e) => {
    assert.ok(e instanceof AdtPolicyError);
    assert.equal(e.rule, 'allowBatchWrites');
    assert.match(e.message, /profile: prd/);
    return true;
  });
  // Reads stay allowed on prd (fail-closed on writes/execution, not on reads).
  assert.doesNotThrow(() => prd.assertTableReadsAllowed(['MARA'], 'adt_data_preview'));
  assert.doesNotThrow(() => prd.assertTransportsEnabled('adt_list_transports'));
});

test('profile: invalid values are rejected loudly, not silently defaulted', () => {
  assert.throws(() => AdtPolicy.resolve({ profile: 'production' }, {}), /profile/);
  assert.throws(() => AdtPolicy.resolve({ profile: 'QA!' }, {}), /profile/);
});

// ---------------------------------------------------------------------------
// Read-side blocked-table governance (P0-1)
// ---------------------------------------------------------------------------

test('blockedTables: off (default) never blocks; invalid profiles are rejected', () => {
  const off = AdtPolicy.resolve({}, {});
  assert.doesNotThrow(() => off.assertTableReadsAllowed(['KNA1', 'USR02'], 'adt_data_preview'));
  assert.throws(() => AdtPolicy.resolve({ blockedTablesProfile: 'loud' }, {}), /invalid blockedTablesProfile/);
  assert.throws(
    () => AdtPolicy.resolve({}, { [POLICY_ENV.blockedTablesProfile]: 'loud' }),
    /invalid SAP_BLOCKED_TABLES_PROFILE/,
  );
});

test('blockedTables: deny names the category and reason, and can never be exempted into by config-less callers', () => {
  const p = AdtPolicy.resolve({ blockedTablesProfile: 'standard' }, {});
  assert.throws(() => p.assertTableReadsAllowed(['KNA1'], 'adt_data_preview'), (e) => {
    assert.ok(e instanceof AdtPolicyError);
    assert.equal(e.rule, 'blockedTables');
    assert.match(e.message, /^\[POLICY\] adt_data_preview: blockedTables: KNA1 — /);
    assert.match(e.message, /Customer \/ vendor \/ BP master PII/);
    return true;
  });
  // Tier semantics: minimal covers direct PII only; standard adds the
  // transactional documents; strict adds logs, communication, and Z*.
  const minimal = AdtPolicy.resolve({ blockedTablesProfile: 'minimal' }, {});
  assert.doesNotThrow(() => minimal.assertTableReadsAllowed(['BSEG'], 'x'), 'BSEG is tier standard');
  assert.doesNotThrow(() => minimal.assertTableReadsAllowed(['MARA'], 'x'), 'MARA is not cataloged');
  const standard = AdtPolicy.resolve({ blockedTablesProfile: 'standard' }, {});
  assert.throws(() => standard.assertTableReadsAllowed(['BSEG'], 'x'), /blockedTables/);
  // strict adds audit logs, communication, and the Z* pattern.
  const strict = AdtPolicy.resolve({ blockedTablesProfile: 'strict' }, {});
  assert.throws(() => strict.assertTableReadsAllowed(['ZMY_TABLE'], 'x'), /Z\*|Customer namespace/);
  assert.doesNotThrow(() => standard.assertTableReadsAllowed(['ZMY_TABLE'], 'x'), 'Z* only blocked on strict');
});

test('blockedTables: custom patterns and allowedTables exemptions', () => {
  const p = AdtPolicy.resolve({ blockedTablesProfile: 'minimal', blockedTables: ['ZSECRET*'] }, {});
  assert.throws(() => p.assertTableReadsAllowed(['ZSECRET_DATA'], 'x'), /User-extended blocklist/);
  // Custom lists only take effect when a profile is active (master switch).
  const off = AdtPolicy.resolve({ blockedTables: ['ZSECRET*'] }, {});
  assert.doesNotThrow(() => off.assertTableReadsAllowed(['ZSECRET_DATA'], 'x'));

  const exempt = AdtPolicy.resolve(
    { blockedTablesProfile: 'standard', allowedTables: ['KNA1', 'ZREPORT*'] },
    {},
  );
  const check = exempt.assertTableReadsAllowed(['KNA1', 'kna1'], 'x');
  assert.deepEqual(check.exempted, ['KNA1', 'KNA1'], 'exemptions are case-insensitive and audited back');
  // A deny in the same list still throws even when other tables are exempt.
  assert.throws(() => exempt.assertTableReadsAllowed(['KNA1', 'USR02'], 'x'), /USR02/);
  // The exemption is the sanctioned bypass for custom entries too (audited).
  const customExempt = AdtPolicy.resolve(
    { blockedTablesProfile: 'minimal', blockedTables: ['ZSECRET*'], allowedTables: ['ZSECRET_DATA'] },
    {},
  );
  const customCheck = customExempt.assertTableReadsAllowed(['ZSECRET_DATA'], 'x');
  assert.deepEqual(customCheck.exempted, ['ZSECRET_DATA']);
});

test('blockedTables: the SQL path checks every FROM/JOIN target (extract + assert)', () => {
  const p = AdtPolicy.resolve({ blockedTablesProfile: 'standard' }, {});
  assert.deepEqual(
    extractTablesFromSql('select mandt, matnr from MARA join BUT000 on 1=1'),
    ['MARA', 'BUT000'],
    'the extractor feeds the checker — this is the adt_data_preview (sql) path',
  );
  assert.throws(
    () => p.assertTableReadsAllowed(extractTablesFromSql('select mandt, matnr from MARA join BUT000 on 1=1'), 'adt_data_preview (sql)'),
    /BUT000/,
  );
  assert.throws(
    () => p.assertTableReadsAllowed(extractTablesFromSql('select * from VBRK'), 'x'),
    /VBRK/,
  );
  assert.doesNotThrow(() =>
    p.assertTableReadsAllowed(extractTablesFromSql('select * from MARA where matnr = 1'), 'x'),
  );
});
