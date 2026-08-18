#!/usr/bin/env node
/**
 * `abap-adt-preset` — one-shot agent-preset generator.
 *
 * The npm package deliberately declares NO `dsh.bundle`, so `dsh plugin add`
 * installs it as a plain profile dependency and the plugin stays dormant:
 * `dsh plugin`'s reconcile only promotes packages that declare a bundle into
 * the global layer stack, and per-session tools are exactly what this plugin
 * wants. Activation happens through an agent preset row — this command
 * creates that preset from an existing one (default: the deployment default,
 * usually `cordis`) by copying its whole directory and appending the plugin
 * row, so ONLY sessions created on the preset get the `adt_*` tools.
 *
 * Usage (after `dsh plugin --profile web add @nefevcore/abap-adt-dsh-plugin`):
 *
 *   dsh plugin --profile web exec abap-adt-preset
 *
 * Options:
 *   --id <name>     preset id / directory name          (default: abap-adt)
 *   --from <id>     source preset to copy               (default: deployment
 *                   default preset, read from settings.yaml; falls back to
 *                   `cordis`)
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
import { parse } from 'yaml';

/** The plugin row appended to the copied composition. */
export const PLUGIN_ROW = `
# --- abap-adt (appended by abap-adt-preset) ---
# This row is what scopes the adt_* tools to sessions on this preset; the
# default cordis preset (and global sessions) never load them.
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

/** The DSH home directory: `${DSH_HOME}` or `~/.dsh`. */
export function dshHome(): string {
  return process.env.DSH_HOME || join(homedir(), '.dsh');
}

/**
 * The deployment default preset id: `agent-presets.default` from
 * settings.yaml, falling back to `cordis`. A settings.yaml that fails to
 * parse must not break generation.
 */
export function defaultSourcePresetId(): string {
  try {
    const path = join(dshHome(), 'settings.yaml');
    if (!existsSync(path)) return 'cordis';
    const parsed = parse(readFileSync(path, 'utf8')) as { 'agent-presets'?: { default?: string } } | null;
    return parsed?.['agent-presets']?.default || 'cordis';
  } catch {
    return 'cordis';
  }
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
    '  dsh plugin --profile web exec abap-adt-preset [--id abap-adt] [--from cordis] [--name "ABAP Development"] [--force] [--dry-run]',
    '',
    'Copies the source preset (default: the deployment default, usually cordis)',
    'into ~/.dsh/.agent-presets/<id>/ and appends the abap-adt plugin row, so',
    'only sessions created on this preset load the adt_* tools.',
    'Config: ~/.dsh/settings.yaml `abap-adt:` section (hot-applies).',
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
  const nextComposition = composition.trimEnd() + '\n' + PLUGIN_ROW;
  const presetYml = renderPresetYml(args.name, 'Standard agent plus adt_* ABAP tools; sessions on this preset can develop against SAP via ADT.');

  // --dry-run previews without touching anything, so it ignores an existing
  // target directory (no clobber check, no copy).
  if (args.dryRun) {
    process.stdout.write(
      `would copy  ${sourceDir} -> ${presetDir}\n` +
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

  mkdirSync(dirname(presetDir), { recursive: true });
  if (existsSync(presetDir)) rmSync(presetDir, { recursive: true, force: true });
  cpSync(sourceDir, presetDir, { recursive: true });
  writeFileSync(join(presetDir, 'agent.cordis.yml'), nextComposition, 'utf8');
  writeFileSync(join(presetDir, 'preset.yml'), presetYml, 'utf8');

  process.stdout.write(
    [
      `created ${presetDir} (from preset '${from}')`,
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
