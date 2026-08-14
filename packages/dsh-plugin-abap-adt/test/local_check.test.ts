import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLocalCheck, toAbaplintName, type FsReader } from '../lib/tools/local.js';

/** Node-fs-backed FsReader: what the tool uses in production is the DSH sandbox-aware adapter. */
function nodeReader(): FsReader {
  return {
    async readDir(absPath) {
      const entries = await readdir(absPath, { withFileTypes: true });
      return entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : e.isFile() ? 'file' : 'other',
      }));
    },
    async readFile(absPath) {
      return readFile(absPath, 'utf8');
    },
  };
}

const GOOD_PROG = `REPORT zgood.\nWRITE: 'hello'.\n`;
const BAD_PROG = `REPORT zbad.\nWRITE hello\n`;
const GOOD_CLAS =
  `CLASS zcl_good DEFINITION PUBLIC.\n` +
  `  PUBLIC SECTION.\n` +
  `    METHODS run.\n` +
  `ENDCLASS.\n` +
  `CLASS zcl_good IMPLEMENTATION.\n` +
  `  METHOD run.\n` +
  `    WRITE: 'x'.\n` +
  `  ENDMETHOD.\n` +
  `ENDCLASS.`;

async function tempDir(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'adt-local-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

// ---------------------------------------------------------------------------
// filename → abaplint naming
// ---------------------------------------------------------------------------

test('toAbaplintName: typed names pass through unchanged', () => {
  assert.equal(toAbaplintName('z.prog.abap', ''), 'z.prog.abap');
  assert.equal(toAbaplintName('zcl_demo.clas.abap', ''), 'zcl_demo.clas.abap');
  assert.equal(toAbaplintName('z.ddls.abap', ''), 'z.ddls.abap');
  assert.equal(toAbaplintName('z.tabl.abap', ''), 'z.tabl.abap');
});

test('toAbaplintName: legacy plain .abap is sniffed from the source head', () => {
  assert.equal(toAbaplintName('zgood.abap', GOOD_PROG), 'zgood.prog.abap');
  assert.equal(toAbaplintName('zcl_good.abap', GOOD_CLAS), 'zcl_good.clas.abap');
  assert.equal(
    toAbaplintName('z.acds', `@EndUserText.label: 'x'\ndefine view z as select from t001 { a.mandt }`),
    'z.ddls.abap',
  );
  assert.equal(toAbaplintName('readme.txt', 'hello'), undefined);
  assert.equal(toAbaplintName('zdata.abap', 'DATA: x TYPE i.'), undefined);
});

// ---------------------------------------------------------------------------
// runLocalCheck end-to-end (real files, abaplint)
// ---------------------------------------------------------------------------

test('runLocalCheck: reports parser errors and rule findings with positions', async (t) => {
  const dir = await tempDir(t);
  await writeFile(join(dir, 'zgood.prog.abap'), GOOD_PROG);
  await writeFile(join(dir, 'zbad.prog.abap'), BAD_PROG);

  const result = await runLocalCheck(dir, {}, nodeReader());
  assert.equal(result.filesScanned, 2);
  assert.equal(result.filesSkipped, 0);
  assert.ok(result.issuesTotal > 0, 'default config should flag something');

  const parseErrors = result.issues.filter((i) => i.rule === 'parser_error');
  assert.equal(parseErrors.length, 1);
  assert.equal(parseErrors[0].severity, 'Error');
  assert.ok(parseErrors[0].file.endsWith('zbad.prog.abap'), parseErrors[0].file);
  assert.ok(parseErrors[0].line >= 1);
  assert.ok(result.counts.Error >= 1);
  assert.equal(result.clean, false);
});

test('runLocalCheck: legacy plain naming is sniffed, non-source files are skipped', async (t) => {
  const dir = await tempDir(t);
  await writeFile(join(dir, 'zlegacy.abap'), GOOD_PROG);
  await writeFile(join(dir, 'notes.txt'), 'not abap');
  await writeFile(join(dir, 'zcl_legacy.abap'), GOOD_CLAS);

  const result = await runLocalCheck(dir, {}, nodeReader());
  assert.equal(result.filesScanned, 2);
  assert.equal(result.filesSkipped, 1);
  assert.ok(result.issues.some((i) => i.file.endsWith('zlegacy.abap')), 'legacy program was checked');
  assert.ok(result.issues.some((i) => i.file.endsWith('zcl_legacy.abap')), 'legacy class was checked');
});

test('runLocalCheck: severity filter keeps only allowed severities', async (t) => {
  const dir = await tempDir(t);
  await writeFile(join(dir, 'zbad.prog.abap'), BAD_PROG);

  const result = await runLocalCheck(dir, { severity: 'Error' }, nodeReader());
  assert.ok(result.issues.length > 0);
  for (const issue of result.issues) assert.equal(issue.severity, 'Error');
  assert.equal(result.reported, result.issues.length);
});

test('runLocalCheck: explicit config overrides defaults (empty rules → nothing reported)', async (t) => {
  const dir = await tempDir(t);
  await writeFile(join(dir, 'zgood.prog.abap'), GOOD_PROG);
  await writeFile(join(dir, 'zbad.prog.abap'), BAD_PROG);
  const cfgPath = join(dir, 'custom.abaplint.json');
  await writeFile(cfgPath, JSON.stringify({ rules: {} }));

  const result = await runLocalCheck(dir, { configPath: cfgPath }, nodeReader());
  assert.equal(result.config.source, 'explicit');
  assert.equal(result.issuesTotal, 0, 'empty rules → no findings at all (abaplint behavior)');
});

test('runLocalCheck: custom config keeps syntax checking via the parser_error rule', async (t) => {
  const dir = await tempDir(t);
  await writeFile(join(dir, 'zgood.prog.abap'), GOOD_PROG);
  await writeFile(join(dir, 'zbad.prog.abap'), BAD_PROG);
  const cfgPath = join(dir, 'custom.abaplint.json');
  await writeFile(cfgPath, JSON.stringify({ rules: { parser_error: true } }));

  const result = await runLocalCheck(dir, { configPath: cfgPath }, nodeReader());
  assert.equal(result.config.source, 'explicit');
  assert.equal(result.issuesTotal, 1);
  assert.equal(result.issues[0]?.rule, 'parser_error');
  assert.ok(result.issues[0]?.file.endsWith('zbad.prog.abap'));
});

test('runLocalCheck: found .abaplint.json in the dir is picked up', async (t) => {
  const dir = await tempDir(t);
  await writeFile(join(dir, 'zgood.prog.abap'), GOOD_PROG);
  await writeFile(join(dir, '.abaplint.json'), JSON.stringify({ rules: {} }));

  const result = await runLocalCheck(dir, {}, nodeReader());
  assert.equal(result.config.source, 'found');
  assert.equal(result.issuesTotal, 0, 'rules disabled → no findings on valid source');
});
