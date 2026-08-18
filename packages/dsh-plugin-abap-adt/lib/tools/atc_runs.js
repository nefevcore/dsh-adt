import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text } from './common.js';
/**
 * ATC run-introspection tools: list existing ATC runs on the system and fetch
 * a single run's result — complements `adt_run_atc` (which starts new runs).
 */
export function atcRunTools(deps) {
    const { registry } = deps;
    const listAtcRuns = defineTool({
        name: 'adt_list_atc_runs',
        description: 'List existing ATC (ABAP Test Cockpit) runs stored on the system. ' +
            'The backend requires at least one filter; when none is given, runs created by the ' +
            'logged-on user are listed. Each run shows its display id, creator, timestamp and state.',
        parameters: {
            createdBy: {
                type: 'string',
                description: 'Filter by the user who created the run (default: logged-on user).',
            },
            ageMin: {
                type: 'integer',
                description: 'Minimum age in days (only runs older than this).',
            },
            ageMax: {
                type: 'integer',
                description: 'Maximum age in days (only runs younger than this).',
            },
            central: {
                type: 'boolean',
                description: 'List central (system-wide) check results instead of local ones.',
            },
            active: {
                type: 'boolean',
                description: 'List active (local) check results.',
            },
            sysId: {
                type: 'string',
                description: 'Filter by system id (with central results).',
            },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    count: { type: 'integer', required: true },
                    runs: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                displayId: { type: 'string', required: true },
                                title: { type: 'string' },
                                checkVariant: { type: 'string' },
                                createdAt: { type: 'string' },
                                createdBy: { type: 'string' },
                                status: { type: 'string' },
                                kind: { type: 'string' },
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
                                attributes: { type: 'object', additionalProperties: true },
                            },
                        },
                    },
                },
            },
            render: (_args, value) => text([
                `ATC runs: ${value.count}`,
                ...value.runs.map((r) => {
                    const agg = r.aggregates
                        ? ` — P1 ${r.aggregates.priority1}, P2 ${r.aggregates.priority2}, P3 ${r.aggregates.priority3}, P4 ${r.aggregates.priority4}`
                        : '';
                    return (`- ${r.displayId}${r.title ? ` "${r.title}"` : ''}${r.checkVariant ? ` [${r.checkVariant}]` : ''}` +
                        `${r.status ? ` ${r.status}` : ''}${r.createdBy ? ` by ${r.createdBy}` : ''}` +
                        `${r.createdAt ? ` at ${r.createdAt}` : ''}${agg}`);
                }),
            ].join('\n')),
        },
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const runs = await entry.client.listAtcRuns({
                createdBy: typeof args.createdBy === 'string' && args.createdBy ? args.createdBy : undefined,
                ageMin: typeof args.ageMin === 'number' ? args.ageMin : undefined,
                ageMax: typeof args.ageMax === 'number' ? args.ageMax : undefined,
                central: args.central === true,
                active: args.active === true,
                sysId: typeof args.sysId === 'string' ? args.sysId : undefined,
                signal: exec.signal,
            });
            return {
                count: runs.length,
                runs: runs.map((r) => ({
                    displayId: r.displayId,
                    title: r.title,
                    checkVariant: r.checkVariant,
                    createdAt: r.createdAt,
                    createdBy: r.createdBy,
                    status: r.status,
                    kind: r.kind,
                    aggregates: r.aggregates,
                    attributes: r.attributes,
                })),
            };
        },
    });
    const getAtcResult = defineTool({
        name: 'adt_get_atc_result',
        description: 'Fetch one stored ATC (ABAP Test Cockpit) run result by its display id. ' +
            'Returns findings with severity, check and source position. Use adt_list_atc_runs to discover ids.',
        parameters: {
            displayId: {
                type: 'string',
                required: true,
                description: 'ATC result display id (from adt_list_atc_runs).',
            },
            includeExemptedFindings: {
                type: 'boolean',
                description: 'Include exempted findings (default false).',
            },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    displayId: { type: 'string', required: true },
                    title: { type: 'string' },
                    checkVariant: { type: 'string' },
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
                    durationMs: { type: 'integer', required: true },
                    rawXml: { type: 'string' },
                },
            },
            render: (_args, value) => {
                const agg = value.aggregates
                    ? ` (P1 ${value.aggregates.priority1}, P2 ${value.aggregates.priority2}, P3 ${value.aggregates.priority3}, P4 ${value.aggregates.priority4})`
                    : '';
                const lines = [
                    `ATC result ${value.displayId}${value.title ? ` "${value.title}"` : ''}${value.checkVariant ? ` [${value.checkVariant}]` : ''}: ` +
                        `${value.clean ? 'CLEAN' : 'findings'} — ` +
                        `INFO ${value.counts.INFO}, WARNING ${value.counts.WARNING}, ERROR ${value.counts.ERROR}, ` +
                        `CRITICAL ${value.counts.CRITICAL}, CATASTROPHIC ${value.counts.CATASTROPHIC}${agg}`,
                ];
                for (const f of value.findings) {
                    lines.push(`- [${f.severity}] ${f.objectName}${f.line ? `:${f.line}` : ''} — ${f.checkTitle}: ${f.message}`);
                }
                if (value.rawXml && value.findings.length === 0) {
                    lines.push('');
                    lines.push('(raw response — not checkstyle XML, showing excerpt)');
                    lines.push(value.rawXml.slice(0, 2000));
                }
                return text(lines.join('\n'));
            },
        },
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const result = await entry.client.getAtcResult(String(args.displayId), {
                includeExemptedFindings: args.includeExemptedFindings === true,
                signal: exec.signal,
            });
            return {
                displayId: String(args.displayId),
                title: result.title,
                checkVariant: result.checkVariant,
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
                aggregates: result.aggregates,
                durationMs: result.durationMs,
                rawXml: result.rawXml,
            };
        },
    });
    return [listAtcRuns, getAtcResult];
}
//# sourceMappingURL=atc_runs.js.map