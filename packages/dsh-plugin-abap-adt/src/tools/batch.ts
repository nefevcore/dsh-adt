import { defineTool } from '@deepseek-ai/dsh-tools';
import type { Context } from '@deepseek-ai/cordis';
import { DESTINATION_PARAM, destinationOf, text, type ToolDeps } from './common.js';
import type { AdtObjectRef } from '@abap-adt/protocol';
import { resolveObject } from '../resolve.js';

/**
 * Batch & pipeline tools — capabilities that go beyond the interactive VS Code
 * ADT workflow:
 *
 *  - `adt_batch_checks`   — run ATC + ABAP Unit across every object of a
 *    package in one shot and produce an aggregated report.
 *  - `adt_export_objects` — pull an object set's sources into a local folder
 *    (git-style versioning, offline review, backups).
 */

export function batchTools(deps: ToolDeps, ctx: Context) {
  const { registry } = deps;

  const batchChecks = defineTool({
    name: 'adt_batch_checks',
    description:
      'Run ATC (ABAP Test Cockpit) and ABAP Unit tests across ALL objects of a development package in one operation ' +
      'and return an aggregated quality report. This is a batch capability not available in the interactive VS Code ADT UI.',
    parameters: {
      packageName: {
        type: 'string',
        required: true,
        description: 'Package to analyze, e.g. ZPACK_DEMO.',
      },
      runUnitTests: {
        type: 'boolean',
        description: 'Also run ABAP Unit tests on test classes in the package (default true).',
      },
      atcVariant: { type: 'string', description: 'ATC check variant (backend-defined).' },
      maxObjects: {
        type: 'integer',
        description: 'Cap on analyzed objects (default 50) — guards against huge packages.',
      },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          packageName: { type: 'string', required: true },
          analyzed: { type: 'integer', required: true },
          atc: {
            type: 'object',
            required: true,
            additionalProperties: false,

            properties: {
              clean: { type: 'boolean', required: true },
              findings: {
                type: 'array',
                required: true,
                items: {
                  type: 'object',
                  additionalProperties: false,

                  properties: {
                    severity: { type: 'string', required: true },
                    objectName: { type: 'string', required: true },
                    message: { type: 'string', required: true },
                    checkTitle: { type: 'string' },
                    line: { type: 'integer' },
                  },
                },
              },
              counts: {
                type: 'object',
                required: true,
                additionalProperties: false,

                properties: {
                  INFO: { type: 'integer', required: true },
                  WARNING: { type: 'integer', required: true },
                  ERROR: { type: 'integer', required: true },
                  CRITICAL: { type: 'integer', required: true },
                  CATASTROPHIC: { type: 'integer', required: true },
                },
              },
            },
          },
          unit: {
            type: 'object',
            required: true,
            additionalProperties: false,

            properties: {
              success: { type: 'boolean', required: true },
              total: { type: 'integer', required: true },
              passed: { type: 'integer', required: true },
              failed: { type: 'integer', required: true },
              errors: { type: 'integer', required: true },
              classes: {
                type: 'array',
                required: true,
                items: {
                  type: 'object',
                  additionalProperties: false,

                  properties: {
                    className: { type: 'string', required: true },
                    status: { type: 'string', required: true },
                  },
                },
              },
            },
          },
        },
      },
      render: (_args, value) => {
        const lines: string[] = [];
        lines.push(`Batch quality report for package ${value.packageName} (${value.analyzed} objects analyzed)`);
        lines.push('');
        lines.push(`ATC: ${value.atc.clean ? 'CLEAN' : 'findings'} — ` +
          `INFO ${value.atc.counts.INFO}, WARNING ${value.atc.counts.WARNING}, ERROR ${value.atc.counts.ERROR}, ` +
          `CRITICAL ${value.atc.counts.CRITICAL}, CATASTROPHIC ${value.atc.counts.CATASTROPHIC}`);
        for (const f of value.atc.findings) {
          lines.push(`  [${f.severity}] ${f.objectName}${f.line ? `:${f.line}` : ''} — ${f.message}`);
        }
        lines.push('');
        lines.push(`ABAP Unit: ${value.unit.total} tests, ${value.unit.passed} passed, ${value.unit.failed} failed, ${value.unit.errors} errors`);
        for (const c of value.unit.classes) {
          lines.push(`  ${c.className}: ${c.status}`);
        }
        return text(lines.join('\n'));
      },
    },
    execute: async (args) => {
      const entry = registry.require(destinationOf(args));
      const packageName = String(args.packageName);
      const maxObjects = Math.min(Number(args.maxObjects ?? 50), 200);
      const members = await entry.client.packageContent(packageName);
      const refs = members.slice(0, maxObjects);

      // ATC over all members.
      const atc = await entry.client.runAtc(refs, {
        variant: typeof args.atcVariant === 'string' ? args.atcVariant : undefined,
      });

      // ABAP Unit: focus on test classes (name contains '~test' or starts with 'ltcl_'), fall back to all.
      const runUnit = args.runUnitTests !== false;
      let unit = {
        success: true,
        total: 0,
        passed: 0,
        failed: 0,
        errors: 0,
        classes: [] as Array<{ className: string; status: string }>,
      };
      if (runUnit) {
        const testRefs = refs.filter(
          (r) => r.name.includes('~TEST') || r.name.toLowerCase().startsWith('ltcl_') || r.name.toUpperCase().startsWith('LTCL_'),
        );
        if (testRefs.length > 0) {
          const result = await entry.client.runUnitTests(testRefs);
          unit = {
            success: result.success,
            total: result.total,
            passed: result.passed,
            failed: result.failed,
            errors: result.errors,
            classes: result.classes.map((c) => ({ className: c.className, status: c.status })),
          };
        }
      }

      return {
        packageName,
        analyzed: refs.length,
        atc: {
          clean: atc.clean,
          findings: atc.findings.map((f) => ({
            severity: f.severity,
            objectName: f.objectName,
            message: f.message,
            checkTitle: f.checkTitle,
            line: f.line,
          })),
          counts: atc.counts,
        },
        unit,
      };
    },
  });

  const exportObjects = defineTool({
    name: 'adt_export_objects',
    description:
      'Export the sources of ABAP objects (by package or explicit list) into a local folder as .abap files — ' +
      'enabling git-style versioning, offline review and backups. Writes through the DSH filesystem (sandbox-aware).',
    parameters: {
      packageName: { type: 'string', description: 'Export all members of this package.' },
      objects: {
        type: 'array',
        description: 'Alternative: explicit objects to export. Each: {name, type}.',
        items: {
          type: 'object',
          additionalProperties: false,

          properties: {
            name: { type: 'string', required: true },
            type: { type: 'string' },
          },
        },
      },
      targetDir: {
        type: 'string',
        required: true,
        description: 'Local directory to write the exported sources into (absolute path).',
      },
      maxObjects: { type: 'integer', description: 'Cap on exported objects (default 100).' },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          targetDir: { type: 'string', required: true },
          exported: { type: 'integer', required: true },
          failed: { type: 'integer', required: true },
          files: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,

              properties: {
                name: { type: 'string', required: true },
                path: { type: 'string', required: true },
                chars: { type: 'integer' },
              },
            },
          },
        },
      },
      render: (_args, value) =>
        text(
          [
            `Exported ${value.exported} object(s) to ${value.targetDir}${value.failed ? ` (${value.failed} failed)` : ''}`,
            ...value.files.map((f) => `- ${f.name} → ${f.path}${f.chars ? ` (${f.chars} chars)` : ''}`),
          ].join('\n'),
        ),
    },
    execute: async (args, exec) => {
      const entry = registry.require(destinationOf(args));
      const fs = ctx.fs;
      if (!fs) throw new Error('adt_export_objects requires the dsh filesystem service');

      const targetDir = String(args.targetDir);
      await fs.resolve(targetDir);

      let refs: AdtObjectRef[];
      if (typeof args.packageName === 'string' && args.packageName) {
        const members = await entry.client.packageContent(args.packageName);
        refs = members.slice(0, Math.min(Number(args.maxObjects ?? 100), 500));
      } else if (Array.isArray(args.objects) && args.objects.length > 0) {
        refs = [];
        for (const o of args.objects as Array<{ name: string; type?: string }>) {
          refs.push(await resolveObject(entry.client, { name: o.name, type: o.type }));
        }
      } else {
        throw new Error('adt_export_objects: provide either `packageName` or `objects`');
      }

      const files: Array<{ name: string; path: string; chars?: number }> = [];
      let failed = 0;
      for (const ref of refs) {
        try {
          const parsed = await entry.client.readSource(ref.uri);
          const ext = ref.type.startsWith('DDLS') ? '.acds' : '.abap';
          const fileName = `${ref.name}${ext}`;
          const fileTarget = await fs.resolve(fileName, { cwd: targetDir });
          await fs.writeText(fileTarget, parsed.source, undefined, exec.signal);
          files.push({ name: fileName, path: fileName, chars: parsed.source.length });
        } catch (error) {
          failed++;
          files.push({ name: ref.name, path: `FAILED: ${(error as Error).message}` });
        }
      }
      return { targetDir, exported: files.length - failed, failed, files };
    },
  });

  return [batchChecks, exportObjects];
}
