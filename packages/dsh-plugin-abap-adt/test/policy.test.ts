import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  assert.deepEqual(p.sources, {
    enableTransports: 'default',
    allowedTransports: 'default',
    allowTransportableEdits: 'default',
    allowedPackages: 'default',
    allowExecution: 'default',
    allowBatchWrites: 'default',
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
});
