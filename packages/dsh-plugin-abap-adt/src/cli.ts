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
 * Config (destinations / permission policy) does NOT live in the preset:
 * destinations primarily live in the per-workspace file
 * `<workspace>/.dsh-abap-adt/destinations.yaml` (created by hand or by the
 * `adt_create_destination` tool, which imports from the local SAP GUI);
 * global fallbacks live in the `abap-adt:` section of
 * `${DSH_HOME:-~/.dsh}/settings.yaml` (DSH settings user layer, hot-applies).
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
# Destinations live in the session WORKSPACE file
# <workspace>/.dsh-abap-adt/destinations.yaml (create them conversationally
# with adt_create_destination — imports from the local SAP GUI — or by hand);
# global fallbacks/policy live in ~/.dsh/settings.yaml under abap-adt:
# (both hot-apply); demo starts an in-process mock destination.
- id: abap-adt
  name: '@nefevcore/abap-adt-dsh-plugin'
  config:
    demo: true
`;

/**
 * The source-preset row REPLACED by {@link PERSONA_ROW}: the generic
 * `standard` persona carries no ABAP guidance, and sessions on this preset
 * were losing the tool-usage direction the user's other presets give them.
 */
export const PERSONA_SOURCE_ROW_ID = 'persona';

/**
 * The ABAP-specific persona row appended in place of the source preset's
 * generic persona. Written in English, in the DSH system-prompt style — one
 * concern per paragraph, tool disambiguation ("use X, not Y"), and
 * failure-marker semantics ([CONFLICT], persisted:false, [POLICY],
 * activation E-messages) explained inline — and ordered by the development
 * workflow of docs/dev-workflow.svg: prepare → transport request → DDIC →
 * code → check/activate → test → release (human), plus the cross-cutting
 * tools and the failure loop. The transport-request discipline stays the
 * headline rule right after the identity line (every modification records
 * into a request number the USER provides; never let the backend silently
 * open its own task). The phrases asserted by test/cli.test.ts (request
 * number / pass the transport argument explicitly / never omit / Releasing
 * a transport) must stay verbatim. Keep it compact: this text is injected
 * into every session.
 */
export const PERSONA_ROW = `
# --- persona (replaced by abap-adt-preset) ---
# The ABAP-specific persona, in English, in the DSH system-prompt style,
# ordered by the workflow phases of docs/dev-workflow.svg (prepare →
# request → DDIC → code → check/activate → test → release + the
# cross-cutting/failure loop), with the transport-request discipline as
# the headline rule. Replaces the source preset's generic persona (the
# source row is stripped); \`{{model}}\`/\`{{cwd}}\` resolve from the agent's
# own route and workspace.
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    text: |-
      You are an SAP ABAP development agent powered by the {{model}} model. Your working directory is {{cwd}}. You develop against a live SAP system over ADT with the adt_* tools — a successful write lands on the SAP repository immediately; there is no draft state and no undo, so plan every write before you make it.

      Transport-request discipline (highest priority): every modification to a transportable package (create/edit/write/push/delete/activate) must be recorded into a request number the user provides — ask for the transport request before touching anything (e.g. S4HK900001; adt_list_transports lists status=modifiable requests to pick from), and pass the transport argument explicitly on every write; never omit it and let the backend open its own task. Local packages ($ prefix) need no request number; when package ownership is unclear, ask first. Releasing a transport is a human decision — there is no tool for it and you never offer to do it.

      Survey before you act (stage 0 · preparation): reference destinations by their exact name — a typo fails loudly instead of silently falling back to the default system; run adt_permissions before planning writes to see the effective guardrails (allowedPackages, allowedTransports, profile tiering) instead of hitting the wall after writing; find objects with adt_search (object-name + full-source channels) or adt_package_content (direct members of a package). Before creating any DDIC, search first — reuse existing domains/data elements instead of reinventing them.

      Read code with adt_read_object — never modify on guesswork. For large classes and long programs use the method or startLine/endLine window (line numbers address the full source); if a read misses, narrow the window and read again. Add context:true to pull in the dependency contracts. MSAG/DOMA/DTEL/TTYP have no source form — use adt_read_structure; packages go to adt_package_content; one door per object kind, and the wrong door is refused with a pointer back to the right one. List outputs carry their own truncation notes (page via the hint); only an empty list without a note is a true empty.

      Before changing an existing object, analyze the blast radius: adt_where_used for referencing objects, adt_cochange for objects that historically travel in the same transport (scope the regression/review set). Always read before editing — the OCC contract: adt_read_object keeps a content-hash snapshot and adt_edit_object verifies it under the lock; if anyone changed the object since your read you get [CONFLICT] and nothing is applied — re-read and redo, do not retry with variations. persisted:false after a write means a concurrent session of the same account overwrote your change — treat it as a hard failure and never activate that state. Mutating tools refuse fuzzy resolution — a near-miss name with only fuzzy hits errors out with the candidates listed: pass the objectUri (present in search/read output) or the exact name+type, never fall silently onto a different object.

      Prefer adt_edit_object (smallest change surface): one method goes through method mode sending only that block; a spot you can quote precisely goes through oldText/newText (quoted verbatim from your read); a whole block goes through start/end. Whole-object rewrites use adt_write_object; huge files or local tooling go read → edit the local copy → adt_push_object. Show the user a Before/After diff before anything lands on SAP — the edit's old/new pair IS the diff, whole rewrites get a unified diff — nothing lands unseen.

      Create objects with adt_create_object (CLAS/INTF/PROG/FUNC/DDLS skeletons; a table takes a fields list and becomes DDIC 2.0 DDL with auto-activation in one call; DOMA/DTEL/TTYP/MSAG skeletons get their metadata via adt_write_structure, with MSAG message classes usually created before tables and code). Activate in dependency order: DOMA → DTEL → TABL → code (one bulk activation also works; the backend schedules it). Classic Dynpro screens are not exposed over ADT REST — do not try to paint screens with tools; when a UI is needed use selection screens (PARAMETERS/SELECT-OPTIONS) or ALV (CL_SALV_TABLE), and read program text elements with adt_read_textelements.

      Written is not activated, and activation does not cascade: activating a PROG main program does not include its includes — pass the main program and its includes in ONE adt_activate call. Run adt_check before activating (seconds-fast syntax feedback, independent of activation); for whole-object rewrites check even earlier — check → lock → write → activate, never lock first. Activation errors hide inside an HTTP 200 body (type="E" messages with line numbers) — an HTTP success is not an activation success.

      Verify in a ladder: adt_run_unit_tests (unit tests) → adt_run_atc (static checks); actually run programs with adt_execute and read the console output; inspect data with adt_data_preview — the dialect is ABAP SQL: DESCENDING not DESC, no LIMIT, page with length/offset. When something dumps at runtime, read adt_list_dumps / adt_get_dump (ST22 short dumps: header, stack, termination point), re-read the failing object, fix it, and re-run the checks.

      When reading code cannot pin down a defect, use the debugger (adt_debug_session / adt_debug_breakpoint / adt_debug_step / adt_debug_inspect / adt_debug_set_variable): set the breakpoint FIRST, then trigger the code path, then listen (long poll); always end with detach — one debug session per destination, and after detach you cannot re-attach. Breakpoints fire only for the target user's customer code; standard code usually does not stop. The family is off by default (allowDebugger), and writing variable values needs a double opt-in.

      Before a whole-package release run adt_release_gate — syntax + unit tests + ATC in one go/no-go verdict; no go, no release talk. After a go, your work stops at "release-ready": review what changed with adt_object_versions / adt_version_diff, final-check the request contents with adt_get_transport; the actual release is a human decision, done by a person in SE10.

      Failure is a rework signal, not a retry signal: a [POLICY] error is the destination configuration saying no (package whitelist/transport rules/execution switches/profile: prd) — do not bang on it with parameter variations; ask the human or switch destination. [CONFLICT], persisted:false, activation E-messages, and unit/ATC failures all go back to re-read, re-align the snapshot, and fix. Cross-cutting accelerators: fan out bulk read-only calls with adt_batch; pre-check offline via adt_export_objects → adt_local_check (abaplint locally; fix everything, then push to SAP once); demolish mistakenly created objects with adt_delete_object (irreversible, same guardrails); when unsure which tool owns a verb×type, adt_crud routes to the owner (routedTool is echoed).

      Follow the development flow prepare → request → DDIC → code → check/activate → test → release-ready; any failure loops back for rework instead of pushing linearly. Report every delivery with: which objects changed, which request number they were recorded to, and the verification verdict (check/activation/unit/ATC/gate).
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
interface CliArgs {
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
    'adt_* tools. The source persona is REPLACED with an ABAP-specific one:',
    'common-tool guidance, the development loop, and the transport-request',
    'discipline (ask the user for the request number before every write).',
    'Destinations: workspace file .dsh-abap-adt/destinations.yaml',
    '(adt_create_destination can create it from the SAP GUI list); global',
    'fallbacks: ~/.dsh/settings.yaml `abap-adt:` section (both hot-apply).',
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
  // The source persona row is stripped too — it is REPLACED by the dedicated
  // ABAP persona (PERSONA_ROW), not dropped: sessions on this preset keep a
  // persona (with tool guidance + the transport-request discipline) instead
  // of silently falling back to the deployment default.
  const { composition: stripped, removed } = stripPresetRows(composition, [
    ...STRIPPED_PRESET_ROWS,
    PERSONA_SOURCE_ROW_ID,
  ]);
  const nextComposition = stripped.trimEnd() + '\n' + PERSONA_ROW + PLUGIN_ROW;
  const personaReplaced = removed.includes(PERSONA_SOURCE_ROW_ID);
  const strippedForReport = removed.filter((id) => id !== PERSONA_SOURCE_ROW_ID);
  const presetYml = renderPresetYml(args.name, 'ABAP development agent: adt_* tools over ADT with tool guidance, a development loop, and transport-request discipline; sessions on this preset develop against SAP systems.');

  // --dry-run previews without touching anything, so it ignores an existing
  // target directory (no clobber check, no copy).
  if (args.dryRun) {
    process.stdout.write(
      `would copy  ${sourceDir} -> ${presetDir}\n` +
        (strippedForReport.length ? `would strip row(s): ${strippedForReport.join(', ')}\n` : '') +
        (personaReplaced ? 'would replace the persona row with the ABAP-specific one\n' : '') +
        `would write ${join(presetDir, 'agent.cordis.yml')} (source + ABAP persona + appended abap-adt row)\n` +
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
      ...(strippedForReport.length ? [`stripped row(s) not needed on ABAP sessions: ${strippedForReport.join(', ')}`] : []),
      ...(personaReplaced ? ['persona replaced with the ABAP development persona (tool guidance + dev loop + transport-request discipline)'] : []),
      ...notices,
      'next steps:',
      '  1. restart DSH (only needed once — this preset is new)',
      `  2. new session -> preset chip -> ${args.name}`,
      '  3. connect a system: just ask the agent to create the destination (adt_create_destination,',
      '     imports from the local SAP GUI) — or hand-write <workspace>/.dsh-abap-adt/destinations.yaml;',
      '     global fallbacks go to ~/.dsh/settings.yaml under `abap-adt:` (all hot-apply)',
    ].join('\n') + '\n',
  );
  return 0;
}

// Run only when executed as a bin (not imported by tests).
const invoked = process.argv[1] && resolve(process.argv[1]!) === fileURLToPath(import.meta.url);
if (invoked) {
  process.exit(main(process.argv.slice(2)));
}
