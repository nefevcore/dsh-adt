/**
 * adt_local_check — offline static analysis of exported ABAP sources with
 * abaplint (@abaplint/core). Pairs with adt_export_objects to give a local,
 * fast pre-push gate: export a package, check it here, fix the findings, then
 * write + activate + transport to SAP in one pass.
 *
 * Real ATC runs inside the SAP backend and cannot run offline; abaplint is the
 * community-standard local substitute (syntax parsing + lint rules). Note the
 * rule set differs from ATC, and type-dependent rules (e.g. check_syntax) may
 * false-positive on standalone sources that lack DDIC context — drop an
 * `.abaplint.json` in the export directory to tune the rules.
 */
import { Config, MemoryFile, Registry } from '@abaplint/core';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { join } from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import type { FileSystem } from '@deepseek-ai/dsh-fs';
import { text, type ToolDeps } from './common.js';

/** Minimal filesystem surface the checker needs (injected, so tests can fake it). */
export interface FsReader {
  /** List direct children of an absolute directory path. */
  readDir(absPath: string): Promise<Array<{ name: string; type: 'file' | 'directory' | 'other' }>>;
  /** Read a whole UTF-8 text file by absolute path. */
  readFile(absPath: string): Promise<string>;
}

/** Adapter over the DSH filesystem service — reads stay sandbox-aware like adt_export_objects. */
export function fsReaderFromCtx(fs: FileSystem, signal?: AbortSignal): FsReader {
  return {
    async readDir(absPath) {
      const target = await fs.resolve(absPath, { signal });
      const entries = await fs.listDir(target, signal);
      return entries.map((e) => ({ name: e.name, type: e.type }));
    },
    async readFile(absPath) {
      const target = await fs.resolve(absPath, { signal });
      return fs.readText(target, signal);
    },
  };
}

export type CheckSeverity = 'Error' | 'Warning' | 'Info';

/** abaplint object-type suffixes the local checker knows how to feed. */
const TYPED_SUFFIXES = new Set([
  'prog', 'clas', 'intf', 'funcs', 'fugr', 'ddls',
  'tabl', 'stru', 'msag', 'doma', 'dtel', 'ttyp',
]);

/**
 * Map an on-disk file name to the filename abaplint expects (type-suffixed,
 * e.g. `zcl_demo.clas.abap`). Legacy adt_export_objects output (plain
 * `<NAME>.abap`) is sniffed from the source head. Returns undefined for files
 * abaplint cannot handle — they are counted as skipped, not checked.
 */
export function toAbaplintName(fileName: string, source: string): string | undefined {
  const lower = fileName.toLowerCase();
  const base = lower.replace(/\.abap$/, '');
  if (lower.endsWith('.acds')) {
    // legacy CDS export naming
    return `${base.replace(/\.acds$/, '')}.ddls.abap`;
  }
  if (lower.endsWith('.abap')) {
    const typed = /\.([a-z0-9_]+)$/.exec(base)?.[1];
    if (typed && TYPED_SUFFIXES.has(typed)) return lower;
    // plain export: infer the type from the source head
    const head = source.replace(/^\s*(?:\*[^\n]*\n|\n)*/, '').trimStart().toUpperCase();
    if (/^CLASS\b/.test(head)) return `${base}.clas.abap`;
    if (/^INTERFACE\b/.test(head)) return `${base}.intf.abap`;
    if (/^FUNCTION-POOL\b/.test(head)) return `${base}.funcs.abap`;
    if (/^(REPORT|PROGRAM)\b/.test(head)) return `${base}.prog.abap`;
  }
  return undefined;
}

interface CollectedFile {
  path: string;
  abapName: string;
  source: string;
}

async function collectSources(
  dir: string,
  fs: FsReader,
  maxFiles: number,
): Promise<{ files: CollectedFile[]; skipped: number; truncated: boolean }> {
  const files: CollectedFile[] = [];
  let skipped = 0;
  let truncated = false;

  const visit = async (absPath: string): Promise<void> => {
    if (truncated || files.length >= maxFiles) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = await fs.readDir(absPath);
    } catch {
      skipped++; // unreadable directory
      return;
    }
    for (const entry of entries) {
      if (truncated || files.length >= maxFiles) {
        truncated = true;
        return;
      }
      const child = join(absPath, entry.name);
      if (entry.type === 'directory') {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await visit(child);
        continue;
      }
      if (entry.type !== 'file' || !/\.(abap|acds)$/i.test(entry.name)) {
        skipped++;
        continue;
      }
      let source: string;
      try {
        source = await fs.readFile(child);
      } catch {
        skipped++;
        continue;
      }
      if (files.length >= maxFiles) {
        truncated = true;
        return;
      }
      const abapName = toAbaplintName(entry.name, source);
      if (!abapName) {
        skipped++;
        continue;
      }
      files.push({ path: child, abapName, source });
    }
  };

  await visit(dir);
  return { files, skipped, truncated };
}

async function resolveConfig(
  fs: FsReader,
  dir: string,
  configPath?: string,
): Promise<{ config: Config; source: 'explicit' | 'found' | 'default' }> {
  if (configPath) return { config: new Config(await fs.readFile(configPath)), source: 'explicit' };
  try {
    return { config: new Config(await fs.readFile(join(dir, '.abaplint.json'))), source: 'found' };
  } catch {
    // no local config — fall back to abaplint defaults
  }
  return { config: Config.getDefault(), source: 'default' };
}

export interface LocalCheckOptions {
  severity?: CheckSeverity;
  maxFiles?: number;
  maxIssues?: number;
  configPath?: string;
}

export interface LocalCheckResult {
  dir: string;
  filesScanned: number;
  filesSkipped: number;
  truncated: boolean;
  /** Total issues found across all severities (uncapped, unfiltered). */
  issuesTotal: number;
  /** Issues at/above the requested severity (what `issues` holds, before capping). */
  reported: number;
  clean: boolean;
  counts: { Error: number; Warning: number; Info: number };
  config: { source: 'explicit' | 'found' | 'default'; ruleCount: number };
  issues: Array<{ file: string; line: number; col: number; rule: string; severity: string; message: string }>;
}

/** Run abaplint over a directory of ABAP sources. Pure core, no tool plumbing. */
export async function runLocalCheck(
  dir: string,
  options: LocalCheckOptions,
  fs: FsReader,
): Promise<LocalCheckResult> {
  const severity = options.severity ?? 'Warning';
  const maxFiles = Math.min(Math.max(Number(options.maxFiles ?? 500), 1), 5000);
  const maxIssues = Math.min(Math.max(Number(options.maxIssues ?? 300), 1), 5000);

  const { config, source } = await resolveConfig(fs, dir, options.configPath);
  const { files, skipped, truncated } = await collectSources(dir, fs, maxFiles);

  const registry = new Registry(config);
  const pathByName = new Map<string, string>();
  for (const file of files) {
    registry.addFile(new MemoryFile(file.abapName, file.source));
    pathByName.set(file.abapName, file.path);
  }
  registry.parse();
  const all = registry.findIssues();

  const counts: Record<CheckSeverity, number> = { Error: 0, Warning: 0, Info: 0 };
  for (const issue of all) {
    const severity = issue.getSeverity() as CheckSeverity;
    counts[severity] = (counts[severity] ?? 0) + 1;
  }

  const allowed =
    severity === 'Error'
      ? new Set<CheckSeverity>(['Error'])
      : severity === 'Info'
        ? new Set<CheckSeverity>(['Error', 'Warning', 'Info'])
        : new Set<CheckSeverity>(['Error', 'Warning']);
  const filtered = all.filter((issue) => allowed.has(issue.getSeverity() as CheckSeverity));

  return {
    dir,
    filesScanned: files.length,
    filesSkipped: skipped,
    truncated,
    issuesTotal: all.length,
    reported: filtered.length,
    clean: filtered.length === 0,
    counts,
    config: { source, ruleCount: config.getEnabledRules().length },
    issues: filtered.slice(0, maxIssues).map((issue) => {
      const start = issue.getStart();
      return {
        file: pathByName.get(issue.getFilename()) ?? issue.getFilename(),
        line: start.getRow(),
        col: start.getCol(),
        rule: issue.getKey(),
        severity: String(issue.getSeverity()),
        message: issue.getMessage(),
      };
    }),
  };
}

function renderLocalCheck(args: Record<string, unknown>, value: LocalCheckResult): string {
  const threshold = typeof args.severity === 'string' ? args.severity : 'Warning';
  const lines = [
    `Local check of ${value.dir}: ${value.filesScanned} file(s) scanned, ${value.filesSkipped} skipped` +
      `${value.truncated ? ' (truncated — maxFiles reached)' : ''} — ` +
      `${value.clean ? 'CLEAN' : `${value.reported} issue(s) at severity >= ${threshold}`}`,
    `  total issues: ${value.issuesTotal}  (Error ${value.counts.Error} | Warning ${value.counts.Warning} | Info ${value.counts.Info})` +
      `  config: ${value.config.source} (${value.config.ruleCount} rules)`,
  ];
  for (const issue of value.issues) {
    lines.push(`- ${issue.file}:${issue.line}:${issue.col} [${issue.severity}] ${issue.rule} — ${issue.message}`);
  }
  if (value.reported > value.issues.length) {
    lines.push(`… and ${value.reported - value.issues.length} more (set maxIssues to raise the cap)`);
  }
  return lines.join('\n');
}

export function localTools(_deps: ToolDeps, ctx: Context) {
  return [
    defineTool({
      name: 'adt_local_check',
      description:
        'Run abaplint (offline static analysis) over a directory of ABAP sources (.abap). ' +
        'Pairs with adt_export_objects: export a package, check it locally before anything touches SAP, ' +
        'fix the findings, then write + activate + transport in one pass. ' +
        'Real ATC cannot run offline (it lives in the SAP backend); abaplint is the local stand-in — ' +
        'syntax parsing plus lint rules. Reads go through the DSH filesystem (sandbox-aware). ' +
        'Note: syntax errors are reported by the `parser_error` rule — a custom .abaplint.json that omits it ' +
        '(e.g. an empty `rules` section) also silences syntax errors.',
      parameters: {
        dir: {
          type: 'string',
          required: true,
          description: 'Local directory containing ABAP sources (absolute path, scanned recursively).',
        },
        configPath: {
          type: 'string',
          description:
            'Absolute path to an .abaplint.json. Default: <dir>/.abaplint.json if present, else abaplint built-in defaults.',
        },
        severity: {
          type: 'string',
          enum: ['Error', 'Warning', 'Info'],
          description: 'Minimum severity to report (default "Warning"). Counts always cover all severities.',
        },
        maxFiles: { type: 'integer', description: 'Cap on scanned source files (default 500).' },
        maxIssues: { type: 'integer', description: 'Cap on reported issues (default 300).' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,

          properties: {
            dir: { type: 'string', required: true },
            filesScanned: { type: 'integer', required: true },
            filesSkipped: { type: 'integer', required: true },
            truncated: { type: 'boolean' },
            issuesTotal: { type: 'integer', required: true },
            reported: { type: 'integer', required: true },
            clean: { type: 'boolean', required: true },
            counts: {
              type: 'object',
              required: true,
              additionalProperties: false,

              properties: {
                Error: { type: 'integer', required: true },
                Warning: { type: 'integer', required: true },
                Info: { type: 'integer', required: true },
              },
            },
            config: {
              type: 'object',
              additionalProperties: false,

              properties: {
                source: { type: 'string', required: true },
                ruleCount: { type: 'integer', required: true },
              },
            },
            issues: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,

                properties: {
                  file: { type: 'string', required: true },
                  line: { type: 'integer', required: true },
                  col: { type: 'integer', required: true },
                  rule: { type: 'string', required: true },
                  severity: { type: 'string', required: true },
                  message: { type: 'string', required: true },
                },
              },
            },
          },
        },
        render: (args, value: LocalCheckResult) => text(renderLocalCheck(args ?? {}, value)),
      },
      timeoutMs: 300_000,
      execute: async (args, exec) => {
        const fs = ctx.fs;
        if (!fs) throw new Error('adt_local_check requires the dsh filesystem service');
        return runLocalCheck(String(args.dir), {
          severity: typeof args.severity === 'string' ? (args.severity as CheckSeverity) : undefined,
          maxFiles: typeof args.maxFiles === 'number' ? args.maxFiles : undefined,
          maxIssues: typeof args.maxIssues === 'number' ? args.maxIssues : undefined,
          configPath: typeof args.configPath === 'string' && args.configPath ? args.configPath : undefined,
        }, fsReaderFromCtx(fs, exec.signal));
      },
    }),
  ];
}
