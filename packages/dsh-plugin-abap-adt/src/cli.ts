#!/usr/bin/env node
/**
 * `abap-adt-preset` — one-shot agent-preset generator.
 *
 * The npm package deliberately declares NO `dsh.bundle`, so `dsh plugin add`
 * installs it as a plain profile dependency and the plugin stays dormant:
 * `dsh plugin`'s reconcile only promotes packages that declare a bundle into
 * the global layer stack, and per-session tools are exactly what this plugin
 * wants. Activation happens through an agent preset row — this command
 * creates that preset from an existing one (default: `standard`, the full
 * coding agent WITHOUT the plugin-authoring toolset) by copying its whole
 * directory, appending the plugin row, and stripping the plugin-authoring
 * rows (`tool-cordis`, `skill-filesystem`) when the source carries them, so
 * ONLY sessions created on the preset get the `adt_*` tools.
 *
 * Why `standard` and not the deployment default (audit D2): on deployments
 * whose default is `cordis`, the copy would drag in `tool-cordis` — whose
 * Host Cordis inspect provider collides with an active cordis session at
 * standing mount — besides handing every ABAP session the plugin-creation
 * tools and skills. Pass `--from cordis` to override; the stripping keeps
 * even that source mountable.
 *
 * Usage (after `dsh plugin --profile web add @nefevcore/abap-adt-dsh-plugin`):
 *
 *   dsh plugin --profile web exec abap-adt-preset
 *
 * Options:
 *   --id <name>     preset id / directory name          (default: abap-adt)
 *   --from <id>     source preset to copy               (default: standard)
 *   --name <text>   display name written to preset.yml  (default: ABAP
 *                   Development)
 *   --force         overwrite an existing preset directory
 *   --dry-run       show what would be written, change nothing
 *
 * Config (destinations / permission policy) does NOT live in the preset: it
 * lives in the `abap-adt:` section of `${DSH_HOME:-~/.dsh}/settings.yaml`
 * (DSH settings user layer, hot-applies).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dshHome } from './config.js';

/** The plugin row appended to the copied composition. */
export const PLUGIN_ROW = `
# --- abap-adt (appended by abap-adt-preset) ---
# This row is what scopes the adt_* tools to sessions on this preset; the
# source preset (and global sessions) never loads them.
# Destinations / permission policy live in ~/.dsh/settings.yaml under
# abap-adt: (hot-applies); demo starts an in-process mock destination.
- id: abap-adt
  name: '@nefevcore/abap-adt-dsh-plugin'
  config:
    demo: true
`;

/** preset.yml body for the generated preset. */
export function renderPresetYml(name: string, description: string): string {
  return 'name: ' + JSON.stringify(name) + '\ndescription: ' + JSON.stringify(description) + '\n';
}

/**
 * The default source preset: always `standard` (audit D2). Deliberately NOT
 * the deployment default from settings.yaml — on deployments where that is
 * `cordis`, the copy would drag in the `tool-cordis` row, whose Host Cordis
 * inspect provider collides with an active cordis session at standing mount,
 * and hand every ABAP session the plugin-authoring toolset. `standard` is
 * the same full coding agent without that toolset; `--from` overrides.
 */
export function defaultSourcePresetId(): string {
  return 'standard';
}

/**
 * Rows stripped from every generated composition (audit D2): plugin-authoring
 * machinery an ABAP session has no use for, which additionally breaks the
 * standing-mount acceptance gate when copied from `cordis`.
 */
export const STRIPPED_PRESET_ROWS = ['tool-cordis', 'skill-filesystem'];

/**
 * Remove top-level `- id: <id>` rows (and their indented continuation lines)
 * from a composition. Comment lines above a stripped row are kept (they are
 * documentation of the source preset); nested (indented) rows are never
 * touched. Returns the cleaned composition plus the ids actually removed.
 */
export function stripPresetRows(composition: string, ids: string[]): { composition: string; removed: string[] } {
  const targets = new Set(ids);
  const kept: string[] = [];
  const removed: string[] = [];
  let skipping = false;
  for (const line of composition.split('\n')) {
    const topRow = /^- id:\s*(\S+)\s*$/.exec(line);
    if (topRow) {
      skipping = targets.has(topRow[1]!);
      if (skipping) {
        removed.push(topRow[1]!);
        continue;
      }
    }
    if (skipping) {
      // Indented lines and blanks belong to the stripped row; anything else
      // (a comment, a new top-level element) ends the skip and is kept.
      if (line.trim() === '' || /^[ \t]/.test(line)) continue;
      skipping = false;
    }
    kept.push(line);
  }
  return { composition: kept.join('\n'), removed };
}

/**
 * Locate the installed dsh package root (the directory holding
 * config/agent-presets). Search order, first hit wins:
 *   1. `$DSH_PRESET_SOURCE` (explicit override for exotic layouts)
 *   2. resolvable from the working directory (preset/dep install)
 *   3. `~/node_modules/@deepseek-ai/dsh` (per-user npm prefix layout)
 *   4. `npm root -g` output (global npm layout)
 *   5. `dirname(process.execPath)/node_modules/@deepseek-ai/dsh` (nvm layouts)
 */
export function findDshPresetRoot(cwd: string): string | undefined {
  const override = process.env.DSH_PRESET_SOURCE;
  const candidates: string[] = [];
  if (override) candidates.push(resolve(override));

  try {
    const req = createRequire(join(cwd, 'package.json'));
    candidates.push(dirname(dirname(req.resolve('@deepseek-ai/dsh/package.json'))));
  } catch {
    /* not resolvable from cwd — keep looking */
  }

  candidates.push(join(homedir(), 'node_modules', '@deepseek-ai', 'dsh'));

  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (globalRoot) candidates.push(join(globalRoot, '@deepseek-ai', 'dsh'));
  } catch {
    /* npm unavailable — keep looking */
  }

  candidates.push(join(dirname(process.execPath), 'node_modules', '@deepseek-ai', 'dsh'));

  for (const root of candidates) {
    if (existsSync(join(root, 'config', 'agent-presets'))) return root;
  }
  return undefined;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Parse the minimal flag set this CLI supports. */
export interface CliArgs {
  id: string;
  from?: string;
  name: string;
  force: boolean;
  dryRun: boolean;
  help: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { id: 'abap-adt', from: undefined, name: 'ABAP Development', force: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case '--id':
        out.id = argv[++i] ?? '';
        break;
      case '--from':
        out.from = argv[++i];
        if (out.from === undefined || !/^[a-z0-9][a-z0-9-]*$/.test(out.from)) {
          // Fail loudly instead of silently falling back to the default
          // source (audit P3): a missing or malformed value must not be
          // papered over, and a path-like value (`../..`) could otherwise
          // escape the shipped preset directory.
          throw new Error(
            `--from needs a shipped preset id matching [a-z0-9][a-z0-9-]* (got '${out.from ?? 'nothing'}')`,
          );
        }
        break;
      case '--name':
        out.name = argv[++i] ?? '';
        break;
      case '--force':
        out.force = true;
        break;
      case '--dry-run':
        out.dryRun = true;
        break;
      case '--help':
      case '-h':
        out.help = true;
        break;
      default:
        throw new Error(`unknown option: ${arg} (see --help)`);
    }
  }
  if (out.id && !/^[a-z0-9][a-z0-9-]*$/.test(out.id)) {
    throw new Error(`preset id must match [a-z0-9][a-z0-9-]* (got '${out.id}') — the id is a directory name`);
  }
  return out;
}

function help(): string {
  return [
    'abap-adt-preset — generate the per-session ABAP agent preset',
    '',
    '  dsh plugin --profile web exec abap-adt-preset [--id abap-adt] [--from standard] [--name "ABAP Development"] [--force] [--dry-run]',
    '',
    'Copies the source preset (default: standard — the full coding agent)',
    'into ~/.dsh/.agent-presets/<id>/, appends the abap-adt plugin row, and',
    'strips the plugin-authoring rows (tool-cordis, skill-filesystem) the',
    'source may carry, so only sessions created on this preset load the',
    'adt_* tools. Config: ~/.dsh/settings.yaml `abap-adt:` section (hot-applies).',
  ].join('\n');
}

export function main(argv: string[]): number {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`abap-adt-preset: ${(error as Error).message}\n`);
    return 1;
  }
  if (args.help) {
    process.stdout.write(help() + '\n');
    return 0;
  }

  const from = args.from ?? defaultSourcePresetId();
  const root = findDshPresetRoot(process.cwd());
  if (!root) {
    process.stderr.write(
      [
        'abap-adt-preset: cannot locate the installed dsh preset directory.',
        'Searched: $DSH_PRESET_SOURCE, the working directory, ~/node_modules, npm root -g, and the Node install dir.',
        'Fix: set DSH_PRESET_SOURCE to the @deepseek-ai/dsh package root (the directory containing config/agent-presets).',
      ].join('\n') + '\n',
    );
    return 1;
  }

  const sourceDir = join(root, 'config', 'agent-presets', from);
  if (!isDirectory(sourceDir) || !existsSync(join(sourceDir, 'agent.cordis.yml'))) {
    process.stderr.write(
      `abap-adt-preset: source preset '${from}' not found under ${join(root, 'config', 'agent-presets')}\n`,
    );
    return 1;
  }

  const presetDir = join(dshHome(), '.agent-presets', args.id);
  const composition = readFileSync(join(sourceDir, 'agent.cordis.yml'), 'utf8');
  // Strip the plugin-authoring rows (audit D2): an ABAP session has no use
  // for them, and `tool-cordis` breaks the standing-mount acceptance gate.
  const { composition: stripped, removed } = stripPresetRows(composition, STRIPPED_PRESET_ROWS);
  const nextComposition = stripped.trimEnd() + '\n' + PLUGIN_ROW;
  const presetYml = renderPresetYml(args.name, 'Standard agent plus adt_* ABAP tools; sessions on this preset can develop against SAP via ADT.');

  // --dry-run previews without touching anything, so it ignores an existing
  // target directory (no clobber check, no copy).
  if (args.dryRun) {
    process.stdout.write(
      `would copy  ${sourceDir} -> ${presetDir}\n` +
        (removed.length ? `would strip row(s): ${removed.join(', ')}\n` : '') +
        `would write ${join(presetDir, 'agent.cordis.yml')} (source + appended abap-adt row)\n` +
        `would write ${join(presetDir, 'preset.yml')} (name: ${JSON.stringify(args.name)})\n`,
    );
    return 0;
  }

  if (existsSync(presetDir) && !args.force) {
    process.stderr.write(
      `abap-adt-preset: ${presetDir} already exists — pass --force to replace it (existing sessions keep their composition)\n`,
    );
    return 1;
  }

  // --force replaces the whole directory: surface manual customizations of
  // the previous abap-adt row (e.g. a local bundle path instead of the npm
  // package name) instead of silently discarding them.
  const notices: string[] = [];
  if (existsSync(presetDir)) {
    try {
      const previous = readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8');
      const stockRow = "name: '@nefevcore/abap-adt-dsh-plugin'";
      if (previous.includes('- id: abap-adt') && !previous.includes(stockRow)) {
        const customized = /^\s*name:\s*(.+)$/m.exec(previous.split('- id: abap-adt')[1] ?? '')?.[1]?.trim();
        notices.push(
          `note: the previous preset had a CUSTOMIZED abap-adt row${customized ? ` (name: ${customized})` : ''} — ` +
            'the regenerated preset uses the npm package name instead; re-apply your customization if that was intentional',
        );
      }
    } catch {
      /* unreadable previous composition — nothing to compare */
    }
  }

  mkdirSync(dirname(presetDir), { recursive: true });
  if (existsSync(presetDir)) rmSync(presetDir, { recursive: true, force: true });
  cpSync(sourceDir, presetDir, { recursive: true });
  writeFileSync(join(presetDir, 'agent.cordis.yml'), nextComposition, 'utf8');
  writeFileSync(join(presetDir, 'preset.yml'), presetYml, 'utf8');

  process.stdout.write(
    [
      `created ${presetDir} (from preset '${from}')`,
      ...(removed.length ? [`stripped row(s) not needed on ABAP sessions: ${removed.join(', ')}`] : []),
      ...notices,
      'next steps:',
      '  1. restart DSH (only needed once — this preset is new)',
      `  2. new session -> preset chip -> ${args.name}`,
      '  3. configure systems in ~/.dsh/settings.yaml under `abap-adt:` (hot-applies)',
    ].join('\n') + '\n',
  );
  return 0;
}

// Run only when executed as a bin (not imported by tests).
const invoked = process.argv[1] && resolve(process.argv[1]!) === fileURLToPath(import.meta.url);
if (invoked) {
  process.exit(main(process.argv.slice(2)));
}
