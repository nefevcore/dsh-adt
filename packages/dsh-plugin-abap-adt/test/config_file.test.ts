import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  builtinDefaults,
  dshHome,
  expandHomePath,
  resolveConfigFilePath,
  autoDiscoverConfigFile,
  mergeConfig,
  loadExternalConfigFile,
  resolveEffectiveConfig,
  type PluginConfig,
} from '../lib/config.js';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

test('dshHome: DSH_HOME env wins over the default ~/.dsh', () => {
  const previous = process.env.DSH_HOME;
  try {
    process.env.DSH_HOME = join(tmpdir(), 'dsh-home-x');
    assert.equal(dshHome(), join(tmpdir(), 'dsh-home-x'));
    delete process.env.DSH_HOME;
    assert.equal(dshHome(), join(expandHomePath('~'), '.dsh'));
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
  }
});

test('expandHomePath: expands ~ and ~/ prefixes', () => {
  const home = expandHomePath('~');
  assert.equal(expandHomePath('~'), home);
  assert.equal(expandHomePath('~/abap-adt.yml'), join(home, 'abap-adt.yml'));
  assert.equal(expandHomePath('~\\abap-adt.yml'), join(home, 'abap-adt.yml'));
  assert.equal(expandHomePath('/etc/conf.yml'), '/etc/conf.yml');
  assert.equal(expandHomePath('relative.yml'), 'relative.yml');
});

test('resolveConfigFilePath: absolute stays, relative anchors to dsh home', () => {
  const previous = process.env.DSH_HOME;
  try {
    process.env.DSH_HOME = join(tmpdir(), 'dsh-home-anchor');
    assert.equal(resolveConfigFilePath('abap-adt.yml'), join(process.env.DSH_HOME, 'abap-adt.yml'));
    const abs = join(expandHomePath('~'), 'my-adt.yml');
    assert.equal(resolveConfigFilePath('~/my-adt.yml'), abs);
    assert.equal(resolveConfigFilePath(abs), abs);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
  }
});

test('autoDiscoverConfigFile: ${DSH_HOME:-~/.dsh}/abap-adt.yml', () => {
  const previous = process.env.DSH_HOME;
  try {
    process.env.DSH_HOME = join(tmpdir(), 'dsh-home-auto');
    assert.equal(autoDiscoverConfigFile(), join(process.env.DSH_HOME, 'abap-adt.yml'));
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
  }
});

// ---------------------------------------------------------------------------
// Pure merge (inline > file > defaults)
// ---------------------------------------------------------------------------

const dest = (name: string, overrides: Record<string, unknown> = {}) =>
  ({ name, url: `https://${name}.example.com`, strictSSL: true, timeoutMs: 60_000, ...overrides }) as never;

test('mergeConfig: built-in defaults when both layers are empty', () => {
  assert.deepEqual(mergeConfig({} as Partial<PluginConfig>), builtinDefaults());
});

test('mergeConfig: file fills keys unset inline, inline wins on conflict', () => {
  const merged = mergeConfig(
    { demo: false, allowedPackages: 'Z*' } as Partial<PluginConfig>,
    { demo: true, defaultDestination: 'dev', allowedPackages: 'Z*,$TMP' } as Partial<PluginConfig>,
  );
  assert.equal(merged.demo, false); // inline wins
  assert.equal(merged.defaultDestination, 'dev'); // file fills unset key
  assert.equal(merged.allowedPackages, 'Z*'); // policy keys follow the same rule
  assert.equal(merged.demoPort, builtinDefaults().demoPort); // untouched → default
});

test('mergeConfig: policy keys stay undefined when absent in both layers (env fallback)', () => {
  const merged = mergeConfig({} as Partial<PluginConfig>);
  assert.equal(merged.enableTransports, undefined);
  assert.equal(merged.allowedTransports, undefined);
  assert.equal(merged.allowTransportableEdits, undefined);
  assert.equal(merged.allowedPackages, undefined);
});

test('mergeConfig: destinations merge by name, inline replaces same-name entries', () => {
  const merged = mergeConfig(
    { destinations: [dest('dev', { url: 'https://inline.example.com' }), dest('qa')] } as Partial<PluginConfig>,
    { destinations: [dest('dev'), dest('prod')] } as Partial<PluginConfig>,
  );
  assert.deepEqual(
    merged.destinations.map((d) => `${d.name}:${d.url}`),
    ['dev:https://inline.example.com', 'prod:https://prod.example.com', 'qa:https://qa.example.com'],
  );
});

test('mergeConfig: shipped empty destinations: [] never masks the file', () => {
  const merged = mergeConfig(
    { destinations: [] } as Partial<PluginConfig>,
    { destinations: [dest('dev')] } as Partial<PluginConfig>,
  );
  assert.equal(merged.destinations.length, 1);
  assert.equal(merged.destinations[0].name, 'dev');
});

// ---------------------------------------------------------------------------
// External file loading + validation
// ---------------------------------------------------------------------------

const VALID_FILE = `\
# abap-adt external config
defaultDestination: dev
enableTransports: true
allowedTransports: 'D01K96*'
allowedPackages: 'Z*,$TMP'
destinations:
  - name: dev
    url: https://sap.example.com:44300
    client: '100'
    language: ZH
    username: DEVELOPER
    passwordEnv: ADT_DEV_PASSWORD
    strictSSL: false
`;

test('loadExternalConfigFile: parses and validates a well-formed file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-cfg-'));
  try {
    const path = join(dir, 'abap-adt.yml');
    writeFileSync(path, VALID_FILE, 'utf8');
    const loaded = await loadExternalConfigFile(path);
    assert.equal(loaded.defaultDestination, 'dev');
    assert.equal(loaded.allowedTransports, 'D01K96*');
    assert.equal(loaded.destinations?.length, 1);
    assert.equal(loaded.destinations?.[0].strictSSL, false);
    assert.equal(loaded.destinations?.[0].timeoutMs, 60_000); // inner schema default
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadExternalConfigFile: empty file yields an empty object', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-cfg-'));
  try {
    const path = join(dir, 'empty.yml');
    writeFileSync(path, '', 'utf8');
    assert.deepEqual(await loadExternalConfigFile(path), {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadExternalConfigFile: unknown top-level key fails with the key named', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-cfg-'));
  try {
    const path = join(dir, 'typo.yml');
    writeFileSync(path, 'destination: []\n', 'utf8');
    await assert.rejects(loadExternalConfigFile(path), /unknown config keys .*destination/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadExternalConfigFile: unknown destination key fails with the key named', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-cfg-'));
  try {
    const path = join(dir, 'dest-typo.yml');
    writeFileSync(path, 'destinations:\n  - name: dev\n    url: https://x\n    usrname: bob\n', 'utf8');
    await assert.rejects(loadExternalConfigFile(path), /unknown destination keys .*usrname/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadExternalConfigFile: malformed YAML fails with the path in the message', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-cfg-'));
  try {
    const path = join(dir, 'broken.yml');
    writeFileSync(path, 'a: [unclosed\n', 'utf8');
    await assert.rejects(loadExternalConfigFile(path), new RegExp(path.replace(/\\/g, '\\\\')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadExternalConfigFile: a top-level list is rejected', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-cfg-'));
  try {
    const path = join(dir, 'list.yml');
    writeFileSync(path, '- a\n- b\n', 'utf8');
    await assert.rejects(loadExternalConfigFile(path), /must be a YAML mapping/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Full resolution (auto-discovery + explicit configFile)
// ---------------------------------------------------------------------------

test('resolveEffectiveConfig: auto-discovers ${DSH_HOME}/abap-adt.yml', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-home-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  try {
    writeFileSync(join(dir, 'abap-adt.yml'), VALID_FILE, 'utf8');
    const { config, warnings } = await resolveEffectiveConfig({ demo: true } as PluginConfig);
    assert.equal(warnings.length, 0);
    assert.equal(config.configFileUsed, join(dir, 'abap-adt.yml'));
    assert.equal(config.defaultDestination, 'dev');
    assert.equal(config.destinations.length, 1);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveEffectiveConfig: no file anywhere → inline + defaults, no warnings', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-empty-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  try {
    const { config, warnings } = await resolveEffectiveConfig({} as PluginConfig);
    assert.equal(warnings.length, 0);
    assert.equal(config.configFileUsed, undefined);
    assert.deepEqual(config.destinations, []);
    assert.equal(config.demo, builtinDefaults().demo);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveEffectiveConfig: explicit configFile wins over auto-discovery', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-explicit-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  try {
    writeFileSync(join(dir, 'abap-adt.yml'), 'defaultDestination: auto\n', 'utf8');
    const explicit = join(dir, 'explicit.yml');
    writeFileSync(explicit, 'defaultDestination: explicit\n', 'utf8');
    const { config } = await resolveEffectiveConfig({ configFile: explicit } as PluginConfig);
    assert.equal(config.configFileUsed, explicit);
    assert.equal(config.defaultDestination, 'explicit');
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveEffectiveConfig: missing explicit configFile warns and falls back', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-missing-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  try {
    const { config, warnings } = await resolveEffectiveConfig({
      configFile: join(dir, 'nope.yml'),
      defaultDestination: 'inline-dev',
    } as PluginConfig);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /configFile not found/);
    assert.equal(config.defaultDestination, 'inline-dev');
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveEffectiveConfig: relative configFile anchors to dsh home', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-relative-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  try {
    mkdirSync(join(dir, 'team'), { recursive: true });
    writeFileSync(join(dir, 'team', 'adt.yml'), 'defaultDestination: team\n', 'utf8');
    const { config } = await resolveEffectiveConfig({ configFile: 'team/adt.yml' } as PluginConfig);
    assert.equal(config.configFileUsed, join(dir, 'team', 'adt.yml'));
    assert.equal(config.defaultDestination, 'team');
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
