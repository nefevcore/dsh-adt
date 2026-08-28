import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  PLUGIN_ROW,
  renderPresetYml,
  defaultSourcePresetId,
  stripPresetRows,
  STRIPPED_PRESET_ROWS,
  findDshPresetRoot,
  parseArgs,
  main,
} from '../lib/cli.js';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

test('PLUGIN_ROW: is a valid yaml list row for the plugin', () => {
  const row = parse(PLUGIN_ROW) as Array<{ id: string; name: string; config: { demo: boolean } }>;
  assert.equal(row.length, 1);
  assert.equal(row[0]?.id, 'abap-adt');
  assert.equal(row[0]?.name, '@nefevcore/abap-adt-dsh-plugin');
  assert.equal(row[0]?.config.demo, true);
});

test('PLUGIN_ROW: appended to a composition parses as one list', () => {
  const base = '- id: persona\n  name: p\n';
  const doc = parse(base.trimEnd() + '\n' + PLUGIN_ROW) as Array<{ id: string }>;
  assert.deepEqual(doc.map((r) => r.id), ['persona', 'abap-adt']);
});

test('renderPresetYml: quotes name and description', () => {
  const yml = renderPresetYml('ABAP Development', 'tools for SAP');
  assert.deepEqual(parse(yml), { name: 'ABAP Development', description: 'tools for SAP' });
});

test('parseArgs: defaults, flags, and id validation', () => {
  assert.deepEqual(parseArgs([]), { id: 'abap-adt', from: undefined, name: 'ABAP Development', force: false, dryRun: false, help: false });
  assert.equal(parseArgs(['--from', 'standard']).from, 'standard');
  assert.equal(parseArgs(['--name', 'X']).name, 'X');
  assert.equal(parseArgs(['--force', '--dry-run']).force, true);
  assert.throws(() => parseArgs(['--nope']), /unknown option/);
  assert.throws(() => parseArgs(['--id', 'Bad_Id']), /must match/);
  // Audit P3: a missing --from value errors instead of silently falling
  // back, and path-like values cannot escape the shipped preset directory.
  assert.throws(() => parseArgs(['--from']), /--from needs a shipped preset id/);
  assert.throws(() => parseArgs(['--from', '../..']), /--from needs a shipped preset id/);
  assert.throws(() => parseArgs(['--from', 'C:/evil']), /--from needs a shipped preset id/);
});

// ---------------------------------------------------------------------------
// Environment-dependent helpers (isolated DSH_HOME)
// ---------------------------------------------------------------------------

test('defaultSourcePresetId: always standard — the deployment default is never copied (D2)', () => {
  // Neither settings.yaml nor the user preset dir can change the source: a
  // `cordis` copy would carry the tool-cordis row, which breaks standing
  // mounts next to an active cordis session and hands every ABAP session the
  // plugin-authoring toolset. `--from` remains the explicit override.
  assert.equal(defaultSourcePresetId(), 'standard');
  assert.deepEqual(STRIPPED_PRESET_ROWS, ['tool-cordis', 'skill-filesystem']);
});

test('stripPresetRows: removes top-level rows with their continuation lines only', () => {
  const composition = [
    '# header comment',
    '- id: persona',
    '  name: p',
    '- id: tool-cordis',
    '  name: c',
    '  config:',
    '    deep: 1',
    '# next section',
    '- id: skill-filesystem',
    '  name: s',
    '- id: tool-skill',
    '  name: t',
    '  config:',
    '    - id: nested',
    '      name: n',
  ].join('\n');
  const { composition: stripped, removed } = stripPresetRows(composition, STRIPPED_PRESET_ROWS);
  assert.deepEqual(removed, ['tool-cordis', 'skill-filesystem']);
  const doc = parse(stripped) as Array<{ id: string; config?: Array<{ id: string }> }>;
  assert.deepEqual(doc.map((r) => r.id), ['persona', 'tool-skill']);
  // Nested (indented) rows are never touched.
  assert.equal(doc[1]?.config?.[0]?.id, 'nested');
  // Idempotent on an already-clean composition.
  const again = stripPresetRows(stripped, STRIPPED_PRESET_ROWS);
  assert.deepEqual(again.removed, []);
  assert.equal(again.composition, stripped);
  // A row that merely CONTAINS the id as a substring is kept.
  const tricky = '- id: tool-cordis-extra\n  name: x\n';
  assert.deepEqual(stripPresetRows(tricky, STRIPPED_PRESET_ROWS).removed, []);
});

test('findDshPresetRoot: DSH_PRESET_SOURCE override wins', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-root-'));
  const previous = process.env.DSH_PRESET_SOURCE;
  process.env.DSH_PRESET_SOURCE = dir;
  try {
    // An override without config/agent-presets is skipped (later candidates
    // may still hit a real install on this machine, so only assert the win).
    mkdirSync(join(dir, 'config', 'agent-presets'), { recursive: true });
    assert.equal(findDshPresetRoot(process.cwd()), dir);
  } finally {
    if (previous === undefined) delete process.env.DSH_PRESET_SOURCE;
    else process.env.DSH_PRESET_SOURCE = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// main(): full generation against a fake dsh install
// ---------------------------------------------------------------------------

function fakeDshInstall(): string {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-fake-dsh-'));
  // The default source: standard carries skill-filesystem (stripped) but no
  // tool-cordis; cordis (the explicit --from case) carries both.
  const standard = join(dir, 'config', 'agent-presets', 'standard');
  mkdirSync(standard, { recursive: true });
  writeFileSync(
    join(standard, 'agent.cordis.yml'),
    '- id: persona\n  name: p\n- id: skill-filesystem\n  name: s\n- id: tool-skill\n  name: t\n',
    'utf8',
  );
  writeFileSync(join(standard, 'preset.yml'), 'name: standard\n', 'utf8');
  mkdirSync(join(standard, 'skills', 'demo'), { recursive: true });
  writeFileSync(join(standard, 'skills', 'demo', 'SKILL.md'), '# demo\n', 'utf8');
  const cordis = join(dir, 'config', 'agent-presets', 'cordis');
  mkdirSync(cordis, { recursive: true });
  writeFileSync(
    join(cordis, 'agent.cordis.yml'),
    '- id: persona\n  name: p\n- id: tool-cordis\n  name: c\n- id: skill-filesystem\n  name: s\n',
    'utf8',
  );
  writeFileSync(join(cordis, 'preset.yml'), 'name: cordis\n', 'utf8');
  return dir;
}

test('main: generates from standard by default, strips authoring rows, refuses to clobber, --force replaces', () => {
  const install = fakeDshInstall();
  const home = mkdtempSync(join(tmpdir(), 'abap-adt-home-'));
  const prevHome = process.env.DSH_HOME;
  const prevSrc = process.env.DSH_PRESET_SOURCE;
  process.env.DSH_HOME = home;
  process.env.DSH_PRESET_SOURCE = install;
  let captured = '';
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    captured += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    assert.equal(main([]), 0);
    const presetDir = join(home, '.agent-presets', 'abap-adt');
    assert.equal(existsSync(join(presetDir, 'skills', 'demo', 'SKILL.md')), true, 'whole dir copied');
    const doc = parse(readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8')) as Array<{ id: string }>;
    assert.deepEqual(doc.map((r) => r.id), ['persona', 'tool-skill', 'abap-adt'], 'skill-filesystem stripped');
    assert.equal(parse(readFileSync(join(presetDir, 'preset.yml'), 'utf8')).name, 'ABAP Development');
    assert.match(captured, /from preset 'standard'/);
    assert.match(captured, /stripped row\(s\).*skill-filesystem/);

    assert.equal(main([]), 1); // exists → refuse
    assert.equal(main(['--force']), 0); // replace
    assert.equal(main(['--dry-run']), 0); // dry-run after force is fine

    // Explicit --from cordis: the tool-cordis row is stripped there too, so
    // even a cordis-sourced preset passes the standing-mount gate.
    captured = '';
    assert.equal(main(['--from', 'cordis', '--id', 'abap-adt-cordis']), 0);
    const cordisDoc = parse(
      readFileSync(join(home, '.agent-presets', 'abap-adt-cordis', 'agent.cordis.yml'), 'utf8'),
    ) as Array<{ id: string }>;
    assert.deepEqual(cordisDoc.map((r) => r.id), ['persona', 'abap-adt'], 'tool-cordis + skill-filesystem stripped');
    assert.match(captured, /stripped row\(s\).*tool-cordis, skill-filesystem/);
  } finally {
    process.stdout.write = origWrite;
    process.env.DSH_HOME = prevHome;
    if (prevSrc === undefined) delete process.env.DSH_PRESET_SOURCE;
    else process.env.DSH_PRESET_SOURCE = prevSrc;
    rmSync(install, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('main: --force warns when the previous abap-adt row was customized', () => {
  const install = fakeDshInstall();
  const home = mkdtempSync(join(tmpdir(), 'abap-adt-home-'));
  const prevHome = process.env.DSH_HOME;
  const prevSrc = process.env.DSH_PRESET_SOURCE;
  process.env.DSH_HOME = home;
  process.env.DSH_PRESET_SOURCE = install;
  let captured = '';
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    captured += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    assert.equal(main([]), 0);
    // Customize the row the way a local-bundle user would (non-npm name).
    const presetDir = join(home, '.agent-presets', 'abap-adt');
    const composition = readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8');
    writeFileSync(
      join(presetDir, 'agent.cordis.yml'),
      composition.replace("name: '@nefevcore/abap-adt-dsh-plugin'", "name: 'C:/bundle/dsh-plugin-abap-adt.bundle.mjs'"),
      'utf8',
    );
    captured = '';
    assert.equal(main(['--force']), 0);
    assert.match(captured, /CUSTOMIZED abap-adt row.*bundle\.mjs/);
    // Regenerating over the stock row again stays silent.
    captured = '';
    assert.equal(main(['--force']), 0);
    assert.doesNotMatch(captured, /CUSTOMIZED/);
  } finally {
    process.stdout.write = origWrite;
    process.env.DSH_HOME = prevHome;
    if (prevSrc === undefined) delete process.env.DSH_PRESET_SOURCE;
    else process.env.DSH_PRESET_SOURCE = prevSrc;
    rmSync(install, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
