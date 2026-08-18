import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text, type ToolDeps } from './common.js';
import { resolveObjects, typeLabel } from '../resolve.js';
import type { AdtObjectRef } from '@nefevcore/abap-adt-protocol';

export function testingTools(deps: ToolDeps) {
  const { registry } = deps;

  const objectListParam = {
    objects: {
      type: 'array',
      required: true,
      description: 'Objects to test/check. Each entry: {objectUri} or {name, type}.',
      items: {
        type: 'object',
        additionalProperties: false,

        properties: {
          objectUri: { type: 'string' },
          name: { type: 'string', required: true },
          type: { type: 'string', description: 'Object type, e.g. CLAS, PROG.' },
        },
      },
    },
  } as const;

  const runUnitTests = defineTool({
    name: 'adt_run_unit_tests',
    description:
      'Run ABAP Unit tests for the given objects. Reports per-class and per-method results (passed/failed/skipped) with durations.',
    parameters: {
      ...objectListParam,
      withCoverage: { type: 'boolean', description: 'Request coverage information (default false).' },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          success: { type: 'boolean', required: true },
          overall: { type: 'string', required: true },
          total: { type: 'integer', required: true },
          passed: { type: 'integer', required: true },
          failed: { type: 'integer', required: true },
          skipped: { type: 'integer', required: true },
          errors: { type: 'integer', required: true },
          durationMs: { type: 'integer', required: true },
          classes: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,

              properties: {
                className: { type: 'string', required: true },
                status: { type: 'string', required: true },
                tests: {
                  type: 'array',
                  required: true,
                  items: {
                    type: 'object',
                    additionalProperties: false,

                    properties: {
                      methodName: { type: 'string', required: true },
                      status: { type: 'string', required: true },
                      durationMs: { type: 'integer', required: true },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      render: (_args, value) => {
        const lines = [
          `ABAP Unit: ${value.overall} — ${value.passed} passed, ${value.failed} failed, ${value.skipped} skipped, ${value.errors} errors (${value.total} tests, ${value.durationMs} ms)`,
        ];
        for (const cls of value.classes) {
          lines.push(`- ${cls.className}: ${cls.status}`);
          for (const t of cls.tests) {
            const msg = t.message ? ` — ${t.message}` : '';
            lines.push(`    ${t.methodName}: ${t.status} (${t.durationMs} ms)${msg}`);
          }
        }
        return text(lines.join('\n'));
      },
    },
    timeoutMs: 330_000,
    execute: async (args, exec) => {
      const entry = registry.require(destinationOf(args));
      const refs: AdtObjectRef[] = await resolveObjects(entry.client, args.objects as Array<{ objectUri?: string; name: string; type?: string }>, exec.signal);
      const result = await entry.client.runUnitTests(refs, { signal: exec.signal });
      return {
        success: result.success,
        overall: result.overall,
        total: result.total,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors,
        durationMs: result.durationMs,
        classes: result.classes.map((c) => ({
          className: c.className,
          status: c.status,
          tests: c.tests.map((t) => ({
            methodName: t.methodName,
            status: t.status,
            durationMs: t.durationMs,
            message: t.message,
          })),
        })),
      };
    },
  });

  const runAtc = defineTool({
    name: 'adt_run_atc',
    description:
      'Run ABAP Test Cockpit (ATC) checks on the given objects. Returns findings with severity, check and source position. ' +
      'Pass `variant` to use a named ATC check variant.',
    parameters: {
      ...objectListParam,
      variant: { type: 'string', description: 'ATC check variant name (backend-defined).' },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
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
                checkTitle: { type: 'string', required: true },
                severity: { type: 'string', required: true },
                message: { type: 'string', required: true },
                objectName: { type: 'string', required: true },
                line: { type: 'integer' },
                check: { type: 'string' },
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
          durationMs: { type: 'integer', required: true },
          variant: { type: 'string' },
          displayId: { type: 'string', description: 'Result display id — pass to adt_get_atc_result to re-fetch.' },
          title: { type: 'string' },
          checkVariant: { type: 'string' },
          aggregates: {
            type: 'object',
            additionalProperties: false,

            properties: {
              priority1: { type: 'integer', required: true },
              priority2: { type: 'integer', required: true },
              priority3: { type: 'integer', required: true },
              priority4: { type: 'integer', required: true },
              failures: { type: 'integer', required: true },
            },
          },
        },
      },
      render: (_args, value) => {
        const agg = value.aggregates
          ? ` (P1 ${value.aggregates.priority1}, P2 ${value.aggregates.priority2}, P3 ${value.aggregates.priority3}, P4 ${value.aggregates.priority4})`
          : '';
        const lines = [
          `ATC: ${value.clean ? 'CLEAN' : 'findings found'} — ` +
            `INFO ${value.counts.INFO}, WARNING ${value.counts.WARNING}, ERROR ${value.counts.ERROR}, ` +
            `CRITICAL ${value.counts.CRITICAL}, CATASTROPHIC ${value.counts.CATASTROPHIC} (${value.durationMs} ms)${agg}` +
            `${value.displayId ? `\nResult displayId: ${value.displayId} (use adt_get_atc_result to re-fetch)` : ''}`,
        ];
        for (const f of value.findings) {
          lines.push(`- [${f.severity}] ${f.objectName}${f.line ? `:${f.line}` : ''} — ${f.checkTitle}: ${f.message}`);
        }
        return text(lines.join('\n'));
      },
    },
    timeoutMs: 660_000,
    execute: async (args, exec) => {
      const entry = registry.require(destinationOf(args));
      const refs = await resolveObjects(entry.client, args.objects as Array<{ objectUri?: string; name: string; type?: string }>, exec.signal);
      const result = await entry.client.runAtc(refs, {
        variant: typeof args.variant === 'string' ? args.variant : undefined,
        signal: exec.signal,
      });
      return {
        clean: result.clean,
        findings: result.findings.map((f) => ({
          checkTitle: f.checkTitle,
          severity: f.severity,
          message: f.message,
          objectName: f.objectName,
          line: f.line,
          check: f.check,
        })),
        counts: result.counts,
        durationMs: result.durationMs,
        variant: result.variant,
        displayId: result.displayId,
        title: result.title,
        checkVariant: result.checkVariant,
        aggregates: result.aggregates,
      };
    },
  });

  return [runUnitTests, runAtc];
}
