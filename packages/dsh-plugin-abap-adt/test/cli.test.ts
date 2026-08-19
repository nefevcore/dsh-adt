import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { PLUGIN_ROW, renderPresetYml, defaultSourcePresetId, findDshPresetRoot, parseArgs, main } from '../lib/cli.js';

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
});

// ---------------------------------------------------------------------------
// Environment-dependent helpers (isolated DSH_HOME)
// ---------------------------------------------------------------------------

test('defaultSourcePresetId: a locally generated preset never becomes the source (self-copy guard)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-cli-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  try {
    writeFileSync(join(dir, 'settings.yaml'), 'agent-presets:\n  default: abap-adt\n', 'utf8');
    mkdirSync(join(dir, '.agent-presets', 'abap-adt'), { recursive: true });
    assert.equal(defaultSourcePresetId(), 'cordis', 'a preset present in the user dir falls back to cordis');
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('defaultSourcePresetId: settings.yaml default wins, falls back to cordis', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-cli-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  try {
    assert.equal(defaultSourcePresetId(), 'cordis'); // no settings.yaml
    writeFileSync(join(dir, 'settings.yaml'), 'agent-presets:\n  default: standard\n', 'utf8');
    assert.equal(defaultSourcePresetId(), 'standard');
    writeFileSync(join(dir, 'settings.yaml'), '{{not yaml', 'utf8');
    assert.equal(defaultSourcePresetId(), 'cordis'); // parse failure degrades
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    rmSync(dir, { recursive: true, force: true });
  }
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
  const preset = join(dir, 'config', 'agent-presets', 'cordis');
  mkdirSync(preset, { recursive: true });
  writeFileSync(join(preset, 'agent.cordis.yml'), '- id: persona\n  name: p\n', 'utf8');
  writeFileSync(join(preset, 'preset.yml'), 'name: cordis\n', 'utf8');
  mkdirSync(join(preset, 'skills', 'demo'), { recursive: true });
  writeFileSync(join(preset, 'skills', 'demo', 'SKILL.md'), '# demo\n', 'utf8');
  return dir;
}

test('main: generates the preset, refuses to clobber, --force replaces', () => {
  const install = fakeDshInstall();
  const home = mkdtempSync(join(tmpdir(), 'abap-adt-home-'));
  const prevHome = process.env.DSH_HOME;
  const prevSrc = process.env.DSH_PRESET_SOURCE;
  process.env.DSH_HOME = home;
  process.env.DSH_PRESET_SOURCE = install;
  try {
    assert.equal(main([]), 0);
    const presetDir = join(home, '.agent-presets', 'abap-adt');
    assert.equal(existsSync(join(presetDir, 'skills', 'demo', 'SKILL.md')), true, 'whole dir copied');
    const doc = parse(readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8')) as Array<{ id: string }>;
    assert.deepEqual(doc.map((r) => r.id), ['persona', 'abap-adt']);
    assert.equal(parse(readFileSync(join(presetDir, 'preset.yml'), 'utf8')).name, 'ABAP Development');

    assert.equal(main([]), 1); // exists → refuse
    assert.equal(main(['--force']), 0); // replace
    assert.equal(main(['--dry-run']), 0); // dry-run after force is fine
  } finally {
    process.env.DSH_HOME = prevHome;
    if (prevSrc === undefined) delete process.env.DSH_PRESET_SOURCE;
    else process.env.DSH_PRESET_SOURCE = prevSrc;
    rmSync(install, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
