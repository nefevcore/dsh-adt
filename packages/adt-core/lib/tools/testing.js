import { defineTool } from '../tooldef.js';
import { sessionCwd, ATC_AGGREGATES_SCHEMA, ATC_COUNTS_SCHEMA, ATC_FINDINGS_SCHEMA, atcAggregatesSuffix, atcFindingOutput, renderAtcFindings, DESTINATION_PARAM, OBJECTS_PARAM, destinationOf, requireObjectList, text, } from './common.js';
import { resolveObjects } from '../resolve.js';
export function testingTools(deps) {
    const { registry } = deps;
    const runUnitTests = defineTool({
        name: 'adt_run_unit_tests',
        description: 'Run ABAP Unit tests (aUnit; ADT "Run as Unit Test", transaction SAUNIT/SE80) for the given objects ' +
            '(test classes in CLAS/PROG). Reports per-class and per-method results (passed/failed/skipped) with durations.',
        parameters: {
            ...OBJECTS_PARAM,
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
        // 330s: unit run = POST + async poll loop; each round trip carries its own
        // client deadline (default 60s), this is the total budget + margin.
        timeoutMs: 330_000,
        execute: async (args, exec) => {
            const entry = await registry.require(destinationOf(args), sessionCwd(exec));
            const refs = await resolveObjects(entry.client, requireObjectList(args, 'adt_run_unit_tests'), exec.signal);
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
        description: 'Run ABAP Test Cockpit checks (ATC / SLIN-based, transaction ATC) on the given objects. Returns findings ' +
            'with severity, check and source ' +
            'position, plus the result displayId (the run is STORED on the backend — it shows up in adt_list_atc_runs, ' +
            'usually titled "External Request + timestamp" for tool-triggered runs). `durationMs` is the wall-clock time ' +
            'of the whole run. POSITION MAPPING: findings can be reported under the MAIN program name while `line` counts ' +
            'in an INCLUDE — check each finding\'s `uri` before jumping to a line number. For authoritative P1–P4 ' +
            'aggregates cross-check with adt_list_atc_runs. Pass `variant` to use a named ATC check variant.',
        parameters: {
            ...OBJECTS_PARAM,
            variant: { type: 'string', description: 'ATC check variant name (backend-defined).' },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    clean: { type: 'boolean', required: true },
                    findings: ATC_FINDINGS_SCHEMA,
                    counts: ATC_COUNTS_SCHEMA,
                    durationMs: { type: 'integer', required: true },
                    variant: { type: 'string' },
                    displayId: { type: 'string', description: 'Result display id — pass to adt_get_atc_result to re-fetch.' },
                    title: { type: 'string' },
                    checkVariant: { type: 'string' },
                    aggregates: ATC_AGGREGATES_SCHEMA,
                },
            },
            render: (_args, value) => {
                const lines = [
                    `ATC: ${value.clean ? 'CLEAN' : 'findings found'} — ` +
                        `INFO ${value.counts.INFO}, WARNING ${value.counts.WARNING}, ERROR ${value.counts.ERROR}, ` +
                        `CRITICAL ${value.counts.CRITICAL}, CATASTROPHIC ${value.counts.CATASTROPHIC} (${value.durationMs} ms)` +
                        atcAggregatesSuffix(value.aggregates) +
                        `${value.displayId ? `\nResult displayId: ${value.displayId} (use adt_get_atc_result to re-fetch)` : ''}`,
                    ...renderAtcFindings(value.findings),
                ];
                return text(lines.join('\n'));
            },
        },
        // 660s = 2× the unit budget: ATC check runs are measurably slower on real
        // backends (full variant execution) and poll with the same loop shape.
        timeoutMs: 660_000,
        execute: async (args, exec) => {
            const entry = await registry.require(destinationOf(args), sessionCwd(exec));
            const refs = await resolveObjects(entry.client, requireObjectList(args, 'adt_run_atc'), exec.signal);
            const result = await entry.client.runAtc(refs, {
                variant: typeof args.variant === 'string' ? args.variant : undefined,
                signal: exec.signal,
            });
            return {
                clean: result.clean,
                findings: result.findings.map(atcFindingOutput),
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
//# sourceMappingURL=testing.js.map