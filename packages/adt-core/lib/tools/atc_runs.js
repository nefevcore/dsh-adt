import { defineTool } from '../tooldef.js';
import { sessionCwd, ATC_AGGREGATES_SCHEMA, ATC_COUNTS_SCHEMA, ATC_FINDINGS_SCHEMA, atcAggregatesSuffix, atcFindingOutput, DESTINATION_PARAM, destinationOf, optStr, renderAtcFindings, text, } from './common.js';
/**
 * adt_atc_runs — ATC run introspection, D-group consolidation
 * (docs/tool-consolidation-plan.md §5): the former adt_list_atc_runs /
 * adt_get_atc_result pair became ONE tool — no `displayId` = the stored-run
 * feed, `displayId` = one run's findings. Complements `adt_run_atc` (which
 * starts new runs).
 */
export function atcRunTools(deps) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_atc_runs',
            description: 'Inspect ATC (ABAP Test Cockpit) runs STORED on the system. WITHOUT `displayId`: list existing runs — each shows ' +
                'its display id, creator, timestamp, state and P1–P4 finding aggregates. Backend support varies: many systems ' +
                'require a filter (the logged-on user is sent by default), but subset implementations accept a PARAMETERLESS ' +
                'query only and reject every filter with HTTP 400 — rejected filters are automatically retried without ' +
                'parameters. When accurate P1–P4 counts matter, prefer the list over re-parsing a single result. WITH `displayId`: ' +
                'fetch that run result — findings with severity, check and source position. POSITION MAPPING: backends often nest ' +
                'ALL findings of a program under the MAIN program name while `line` counts in the INCLUDE the finding really ' +
                'points at — check each finding\'s `uri` (the object the line belongs to) before jumping to a line in the main ' +
                'program. P1–P4 aggregates come from the result body when it carries them, otherwise they are derived from the ' +
                'finding priorities; the LIST form remains the authoritative source for aggregates.',
            parameters: {
                displayId: {
                    type: 'string',
                    description: 'One result in full (display id from the list form). Omit to list runs.',
                },
                includeExemptedFindings: {
                    type: 'boolean',
                    description: 'One result: include exempted findings (default false).',
                },
                createdBy: {
                    type: 'string',
                    description: 'List: filter by the user who created the run (default: logged-on user). Ignored by subset backends.',
                },
                ageMin: {
                    type: 'integer',
                    description: 'List: minimum age in days (only runs older than this). Ignored by subset backends.',
                },
                ageMax: {
                    type: 'integer',
                    description: 'List: maximum age in days (only runs younger than this). Ignored by subset backends.',
                },
                central: {
                    type: 'boolean',
                    description: 'List: central (system-wide) check results instead of local ones. Ignored by subset backends.',
                },
                active: {
                    type: 'boolean',
                    description: 'List: active (local) check results. Ignored by subset backends.',
                },
                sysId: {
                    type: 'string',
                    description: 'List: filter by system id (with central results). Ignored by subset backends.',
                },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        // list shape
                        count: { type: 'integer' },
                        runs: {
                            type: 'array',
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
                                    aggregates: ATC_AGGREGATES_SCHEMA,
                                    attributes: { type: 'object', additionalProperties: true },
                                },
                            },
                        },
                        // one-result shape (fields optional — the list branch omits them);
                        // findings items are the precise AtcFindingOutput shape (mirrors
                        // ATC_FINDINGS_SCHEMA minus the list-inapplicable `required`)
                        displayIdResult: { type: 'string' },
                        title: { type: 'string' },
                        checkVariant: { type: 'string' },
                        clean: { type: 'boolean' },
                        findings: {
                            type: 'array',
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    checkTitle: { type: 'string', required: true },
                                    severity: { type: 'string', required: true },
                                    message: { type: 'string', required: true },
                                    objectName: { type: 'string', required: true },
                                    uri: {
                                        type: 'string',
                                        description: 'URI of the object the `line` refers to (often an include while objectName is the main program).',
                                    },
                                    line: { type: 'integer' },
                                    check: { type: 'string' },
                                },
                            },
                        },
                        counts: { type: 'object', additionalProperties: true },
                        aggregates: ATC_AGGREGATES_SCHEMA,
                        durationMs: { type: 'integer' },
                        rawXml: { type: 'string' },
                    },
                },
                render: (_args, value) => {
                    if (value.runs !== undefined) {
                        return text([
                            `ATC runs: ${value.count}`,
                            ...value.runs.map((r) => {
                                const agg = r.aggregates
                                    ? ` — P1 ${r.aggregates.priority1}, P2 ${r.aggregates.priority2}, P3 ${r.aggregates.priority3}, P4 ${r.aggregates.priority4}`
                                    : '';
                                return (`- ${r.displayId}${r.title ? ` "${r.title}"` : ''}${r.checkVariant ? ` [${r.checkVariant}]` : ''}` +
                                    `${r.status ? ` ${r.status}` : ''}${r.createdBy ? ` by ${r.createdBy}` : ''}` +
                                    `${r.createdAt ? ` at ${r.createdAt}` : ''}${agg}`);
                            }),
                        ].join('\n'));
                    }
                    const counts = (value.counts ?? {});
                    const findings = (value.findings ?? []);
                    const lines = [
                        `ATC result ${value.displayIdResult}${value.title ? ` "${value.title}"` : ''}${value.checkVariant ? ` [${value.checkVariant}]` : ''}: ` +
                            `${value.clean ? 'CLEAN' : 'findings'} — ` +
                            `INFO ${counts.INFO ?? 0}, WARNING ${counts.WARNING ?? 0}, ERROR ${counts.ERROR ?? 0}, ` +
                            `CRITICAL ${counts.CRITICAL ?? 0}, CATASTROPHIC ${counts.CATASTROPHIC ?? 0}` +
                            atcAggregatesSuffix(value.aggregates),
                        ...renderAtcFindings(findings),
                    ];
                    if (value.rawXml && findings.length === 0) {
                        lines.push('');
                        lines.push('(raw response — not checkstyle XML, showing excerpt)');
                        lines.push(value.rawXml.slice(0, 2000));
                    }
                    return text(lines.join('\n'));
                },
            },
            isConcurrencySafe: () => true,
            execute: async (args, exec) => {
                const entry = await registry.require(destinationOf(args), sessionCwd(exec));
                // ---- one result ------------------------------------------------------
                const displayId = optStr(args.displayId);
                if (displayId) {
                    const result = await entry.client.getAtcResult(displayId, {
                        includeExemptedFindings: args.includeExemptedFindings === true,
                        signal: exec.signal,
                    });
                    return {
                        displayIdResult: displayId,
                        title: result.title,
                        checkVariant: result.checkVariant,
                        clean: result.clean,
                        findings: result.findings.map(atcFindingOutput),
                        counts: result.counts,
                        aggregates: result.aggregates,
                        durationMs: result.durationMs,
                        rawXml: result.rawXml,
                    };
                }
                // ---- the list --------------------------------------------------------
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
        }),
    ];
}
//# sourceMappingURL=atc_runs.js.map