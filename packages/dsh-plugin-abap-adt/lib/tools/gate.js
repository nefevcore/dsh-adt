/**
 * adt_release_gate — pre-release quality gate. Runs the full backend check
 * battery over a package or object set (syntax check + ABAP Unit + ATC) in one
 * call and returns a single go/no-go verdict. Read-only (runs checks only).
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text } from './common.js';
import { resolveObject } from '../resolve.js';
/** Pure aggregation: all enabled stages must pass for a "go". */
export function aggregateGate(stages) {
    return { verdict: stages.length > 0 && stages.every((s) => s.pass) ? 'go' : 'no-go' };
}
export function gateTools(deps) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_release_gate',
            description: 'Pre-release quality gate: runs syntax check + ABAP Unit + ATC over a package or object set in one call ' +
                'and returns a go/no-go verdict. Use before releasing a transport request — "verify everything, then push". ' +
                'Read-only (only runs checks; nothing is activated or transported).',
            parameters: {
                packageName: { type: 'string', description: 'Check every member of this development package.' },
                objects: {
                    type: 'array',
                    description: 'Alternative: explicit objects to check. Each: {name, type}.',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            name: { type: 'string', required: true },
                            type: { type: 'string' },
                        },
                    },
                },
                stages: {
                    type: 'array',
                    description: 'Which checks to run (default: all three).',
                    items: { type: 'string', enum: ['syntax', 'unit', 'atc'] },
                },
                variant: { type: 'string', description: 'ATC check variant name (backend-defined).' },
                maxObjects: { type: 'integer', description: 'Cap on objects checked (default 100).' },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        objectCount: { type: 'integer', required: true },
                        verdict: { type: 'string', required: true },
                        stages: {
                            type: 'array',
                            required: true,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    stage: { type: 'string', required: true },
                                    pass: { type: 'boolean', required: true },
                                    summary: { type: 'string', required: true },
                                },
                            },
                        },
                    },
                },
                render: (_args, value) => {
                    const lines = [
                        `Release gate for ${value.objectCount} object(s): ${value.verdict.toUpperCase()}`,
                        ...value.stages.map((s) => `- ${s.stage}: ${s.pass ? 'PASS' : 'FAIL'} — ${s.summary}`),
                    ];
                    return text(lines.join('\n'));
                },
            },
            execute: async (args) => {
                const entry = registry.require(destinationOf(args));
                const cap = Math.min(Math.max(Number(args.maxObjects ?? 100), 1), 500);
                let refs;
                if (typeof args.packageName === 'string' && args.packageName) {
                    refs = (await entry.client.packageContent(args.packageName.toUpperCase(), { maxResults: cap })).slice(0, cap);
                }
                else if (Array.isArray(args.objects) && args.objects.length > 0) {
                    refs = [];
                    for (const o of args.objects) {
                        refs.push(await resolveObject(entry.client, { name: o.name, type: o.type }));
                    }
                }
                else {
                    throw new Error('adt_release_gate: provide either `packageName` or `objects`');
                }
                const wanted = new Set((Array.isArray(args.stages) && args.stages.length > 0
                    ? args.stages
                    : ['syntax', 'unit', 'atc']));
                const variant = typeof args.variant === 'string' && args.variant ? args.variant : undefined;
                const stages = [];
                if (wanted.has('syntax')) {
                    const check = await entry.client.check(refs);
                    const errors = check.messages.filter((m) => m.severity === 'E' || m.severity === 'A');
                    stages.push({
                        stage: 'syntax',
                        pass: errors.length === 0,
                        summary: `${refs.length} object(s), ${errors.length} syntax error(s)`,
                    });
                }
                if (wanted.has('unit')) {
                    const unit = await entry.client.runUnitTests(refs);
                    stages.push({
                        stage: 'unit',
                        pass: unit.success,
                        summary: `overall ${unit.overall}, ${unit.total} test(s), ${unit.failed} failed, ${unit.errors} errors`,
                    });
                }
                if (wanted.has('atc')) {
                    const atc = await entry.client.runAtc(refs, { variant });
                    stages.push({
                        stage: 'atc',
                        pass: atc.clean,
                        summary: `clean=${atc.clean}, ${atc.findings.length} finding(s)` +
                            ` (E ${atc.counts.ERROR}, C ${atc.counts.CRITICAL}, W ${atc.counts.WARNING})`,
                    });
                }
                return { objectCount: refs.length, verdict: aggregateGate(stages).verdict, stages };
            },
        }),
    ];
}
//# sourceMappingURL=gate.js.map