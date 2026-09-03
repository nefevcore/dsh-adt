import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  PLUGIN_ROW,
  PERSONA_ROW,
  PERSONA_SOURCE_ROW_ID,
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

test('PERSONA_ROW: the ABAP persona — identity, tool guidance, transport discipline', () => {
  const row = parse(PERSONA_ROW) as Array<{ id: string; name: string; config: { text: string } }>;
  assert.equal(row.length, 1);
  assert.equal(row[0]?.id, 'persona');
  assert.equal(row[0]?.name, '@deepseek-ai/dsh-persona');
  const text = row[0]!.config.text;
  assert.match(text, /\{\{model\}\}/);
  assert.match(text, /\{\{cwd\}\}/);
  // Identity first, live-system warning included.
  assert.ok(text.startsWith('You are an SAP ABAP development agent'), 'persona opens with the identity line');
  assert.match(text, /no draft state and no undo/);
  // Tool guidance across the workflow phases of docs/dev-workflow.svg.
  for (const marker of [
    'adt_permissions', 'adt_search', 'adt_package_content',
    'adt_read_object', 'adt_read_structure', 'adt_read_textelements',
    'adt_where_used', 'adt_cochange', 'adt_edit_object', 'adt_write_object', 'adt_push_object',
    'adt_create_object', 'adt_write_structure',
    'adt_check', 'adt_activate',
    'adt_run_unit_tests', 'adt_run_atc', 'adt_execute', 'adt_data_preview',
    'adt_list_dumps', 'adt_debug_session',
    'adt_release_gate', 'adt_object_versions', 'adt_version_diff', 'adt_get_transport',
    'adt_batch', 'adt_export_objects', 'adt_local_check', 'adt_delete_object', 'adt_crud',
  ]) {
    assert.ok(text.includes(marker), `persona mentions ${marker}`);
  }
  // Failure-marker semantics spelled out inline (DSH system-prompt style).
  for (const marker of ['[CONFLICT]', 'persisted:false', '[POLICY]', 'DESCENDING', 'length/offset']) {
    assert.ok(text.includes(marker), `persona explains ${marker}`);
  }
  // Transport discipline (the headline rule): user-provided request number,
  // explicit transport argument, never let the backend auto-create a task.
  assert.ok(text.includes('request number'));
  assert.ok(text.includes('adt_list_transports'));
  assert.match(text, /pass the transport argument explicitly/);
  assert.match(text, /never omit/);
  // Release stays a human decision.
  assert.ok(text.includes('Releasing a transport'));
  // The workflow spine (prepare → … → release-ready) closes the persona.
  assert.ok(text.includes('prepare → request → DDIC → code → check/activate → test → release-ready'));
  assert.equal(PERSONA_SOURCE_ROW_ID, 'persona');
});

test('PERSONA_ROW: composes with PLUGIN_ROW as one list (generation shape)', () => {
  const doc = parse('- id: tool-skill\n  name: t\n' + PERSONA_ROW + PLUGIN_ROW) as Array<{ id: string }>;
  assert.deepEqual(doc.map((r) => r.id), ['tool-skill', 'persona', 'abap-adt']);
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
    const doc = parse(readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8')) as Array<{ id: string; name?: string; config?: { text?: string } }>;
    // The source persona is stripped and the ABAP persona re-appended in
    // front of the plugin row — the generated session keeps a persona.
    assert.deepEqual(doc.map((r) => r.id), ['tool-skill', 'persona', 'abap-adt'], 'skill-filesystem stripped, persona replaced');
    const personaRow = doc.find((r) => r.id === 'persona');
    assert.equal(personaRow?.name, '@deepseek-ai/dsh-persona');
    assert.ok(personaRow?.config?.text?.includes('request number'), 'transport-request discipline present');
    assert.equal(parse(readFileSync(join(presetDir, 'preset.yml'), 'utf8')).name, 'ABAP Development');
    assert.match(captured, /from preset 'standard'/);
    assert.match(captured, /stripped row\(s\).*skill-filesystem/);
    assert.match(captured, /persona replaced with the ABAP development persona/);

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
    assert.deepEqual(cordisDoc.map((r) => r.id), ['persona', 'abap-adt'], 'tool-cordis + skill-filesystem stripped, persona re-appended');
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
