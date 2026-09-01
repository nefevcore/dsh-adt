/**
 * adt_release_gate — pre-release quality gate. Runs the full backend check
 * battery over a package or object set (syntax check + ABAP Unit + ATC) in one
 * call and returns a single go/no-go verdict. Read-only (runs checks only).
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { sessionCwd, DESTINATION_PARAM, NAME_TYPE_OBJECTS_PARAM, clampWithNote, destinationOf, isAdtServiceUnavailable, text } from './common.js';
import { resolveObject } from '../resolve.js';
/** Pure aggregation: all enabled stages must pass for a "go"; a stage the
 * backend does not deploy (skipped, e.g. no ATC service) does not veto. */
export function aggregateGate(stages) {
    const judged = stages.filter((s) => !s.skipped);
    return { verdict: judged.length > 0 && judged.every((s) => s.pass) ? 'go' : 'no-go' };
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
                ...NAME_TYPE_OBJECTS_PARAM,
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
                        truncated: { type: 'boolean' },
                        note: { type: 'string' },
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
                                    skipped: { type: 'boolean', description: 'true when the backend does not deploy this stage service.' },
                                },
                            },
                        },
                    },
                },
                render: (_args, value) => {
                    const lines = [
                        `Release gate for ${value.objectCount} object(s): ${value.verdict.toUpperCase()}`,
                        ...value.stages.map((s) => `- ${s.stage}: ${s.skipped ? 'SKIPPED' : s.pass ? 'PASS' : 'FAIL'} — ${s.summary}`),
                    ];
                    return text(lines.join('\n'));
                },
            },
            // 1200s = syntax + unit + ATC sequential budget (their individual
            // caps are 330s/660s; the gate re-uses the client per-call deadlines
            // and adds headroom for summary rendering).
            timeoutMs: 1_200_000,
            execute: async (args, exec) => {
                const entry = await registry.require(destinationOf(args), sessionCwd(exec));
                const clamp = clampWithNote(Number(args.maxObjects ?? 100), 1, 500, 'maxObjects');
                const cap = clamp.value;
                let truncated = false;
                let refs;
                if (typeof args.packageName === 'string' && args.packageName) {
                    const members = await entry.client.packageContent(args.packageName.toUpperCase(), { maxResults: cap, signal: exec.signal });
                    refs = members.slice(0, cap);
                    if (members.length > refs.length)
                        truncated = true;
                }
                else if (Array.isArray(args.objects) && args.objects.length > 0) {
                    const all = [];
                    for (const o of args.objects) {
                        all.push(await resolveObject(entry.client, { name: o.name, type: o.type }, { maxResults: 10, signal: exec.signal }));
                    }
                    refs = all.slice(0, cap);
                    if (all.length > refs.length)
                        truncated = true;
                }
                else {
                    throw new Error('adt_release_gate: provide either `packageName` or `objects`');
                }
                const notes = [
                    clamp.note,
                    truncated ? `object set truncated to maxObjects=${cap} — the verdict covers the first ${refs.length} only` : undefined,
                ].filter(Boolean);
                const wanted = new Set((Array.isArray(args.stages) && args.stages.length > 0
                    ? args.stages
                    : ['syntax', 'unit', 'atc']));
                const variant = typeof args.variant === 'string' && args.variant ? args.variant : undefined;
                const stages = [];
                // A backend that does not deploy one of the stage services (404/405)
                // must not fail the WHOLE gate with a raw error (audit P3): the
                // stage is reported as skipped and does not veto the verdict —
                // every other tool degrades this way too.
                const runStage = async (stage, fn) => {
                    try {
                        stages.push(await fn());
                    }
                    catch (error) {
                        if (isAdtServiceUnavailable(error)) {
                            stages.push({
                                stage,
                                pass: false,
                                skipped: true,
                                summary: `service not deployed on this backend (HTTP ${error.status}) — stage skipped, verdict based on the remaining stages`,
                            });
                            return;
                        }
                        throw error;
                    }
                };
                if (wanted.has('syntax')) {
                    await runStage('syntax', async () => {
                        const check = await entry.client.check(refs, { signal: exec.signal });
                        const errors = check.messages.filter((m) => m.severity === 'E' || m.severity === 'A');
                        return {
                            stage: 'syntax',
                            pass: errors.length === 0,
                            summary: `${refs.length} object(s), ${errors.length} syntax error(s)`,
                        };
                    });
                }
                if (wanted.has('unit')) {
                    await runStage('unit', async () => {
                        const unit = await entry.client.runUnitTests(refs, { signal: exec.signal });
                        return {
                            stage: 'unit',
                            pass: unit.success,
                            summary: `overall ${unit.overall}, ${unit.total} test(s), ${unit.failed} failed, ${unit.errors} errors`,
                        };
                    });
                }
                if (wanted.has('atc')) {
                    await runStage('atc', async () => {
                        const atc = await entry.client.runAtc(refs, { variant, signal: exec.signal });
                        return {
                            stage: 'atc',
                            pass: atc.clean,
                            summary: `clean=${atc.clean}, ${atc.findings.length} finding(s)` +
                                ` (E ${atc.counts.ERROR}, C ${atc.counts.CRITICAL}, W ${atc.counts.WARNING})`,
                        };
                    });
                }
                return {
                    objectCount: refs.length,
                    truncated: truncated || undefined,
                    note: notes.join('; ') || undefined,
                    verdict: aggregateGate(stages).verdict,
                    stages,
                };
            },
        }),
    ];
}
//# sourceMappingURL=gate.js.map