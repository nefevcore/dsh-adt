/**
 * adt_data_preview — read rows from tables / CDS views (or freestyle SQL)
 * via the ADT Data Preview API. Read-only; verifies data after changes.
 *
 * Note: on ABAP Cloud (BTP) direct preview of database tables is blocked by
 * SAP backend policy — only CDS views / freestyle SQL work there; on-prem
 * systems support all three.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text } from './common.js';
export function dataPreviewTools(deps) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_data_preview',
            description: 'Read rows from a table / CDS view (or run a freestyle SELECT) via the ADT Data Preview API. ' +
                'Use to verify data after a change. Provide either `name`+`kind` (entity preview) or `sql` (freestyle). ' +
                'Read-only. Note: ABAP Cloud (BTP) blocks direct database-table preview; CDS views and freestyle SQL work there.',
            parameters: {
                name: { type: 'string', description: 'Table or CDS view name (uppercase), e.g. ZCDS_DEMO, T001.' },
                kind: {
                    type: 'string',
                    enum: ['ddic', 'cds'],
                    description: 'Entity kind: `ddic` = table/structure/view, `cds` = CDS view (default ddic).',
                },
                sql: { type: 'string', description: 'Freestyle SQL SELECT to run (alternative to name+kind).' },
                top: { type: 'integer', description: 'Maximum rows to return (default 100, max 5000).' },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        source: { type: 'string', required: true },
                        name: { type: 'string', required: true },
                        totalRows: { type: 'integer', required: true },
                        queryExecutionTime: { type: 'number' },
                        columns: {
                            type: 'array',
                            required: true,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    name: { type: 'string', required: true },
                                    type: { type: 'string', required: true },
                                    description: { type: 'string' },
                                    length: { type: 'integer' },
                                },
                            },
                        },
                        rows: {
                            type: 'array',
                            required: true,
                            items: { type: 'object', additionalProperties: true },
                        },
                        rawXml: { type: 'string' },
                    },
                },
                render: (_args, value) => {
                    const lines = [
                        `Data preview of ${value.name} (${value.source}): ${value.rows.length}/${value.totalRows} row(s)` +
                            `${value.queryExecutionTime !== undefined ? `, ${value.queryExecutionTime}ms` : ''}`,
                        `columns: ${value.columns.map((c) => `${c.name}:${c.type}`).join(', ')}`,
                        ...value.rows.map((row, i) => `  ${i + 1}. ${value.columns.map((c) => `${c.name}=${row[c.name] ?? ''}`).join(' | ')}`),
                    ];
                    if (value.rawXml)
                        lines.push(`(partial parse — raw XML: ${value.rawXml.slice(0, 200)}…)`);
                    return text(lines.join('\n'));
                },
            },
            execute: async (args) => {
                const entry = registry.require(destinationOf(args));
                const top = typeof args.top === 'number' ? args.top : undefined;
                if (typeof args.sql === 'string' && args.sql.trim()) {
                    const result = await entry.client.runSqlQuery(args.sql.trim(), { top });
                    return {
                        source: 'sql',
                        name: result.name,
                        totalRows: result.totalRows,
                        queryExecutionTime: result.queryExecutionTime,
                        columns: result.columns,
                        rows: result.rows,
                        rawXml: result.rawXml,
                    };
                }
                const name = String(args.name ?? '').toUpperCase().trim();
                if (!name)
                    throw new Error('adt_data_preview: provide either `name`+`kind` or `sql`');
                const kind = args.kind === 'cds' ? 'cds' : 'ddic';
                const result = await entry.client.dataPreview(name, kind, { top });
                return {
                    source: kind,
                    name,
                    totalRows: result.totalRows,
                    queryExecutionTime: result.queryExecutionTime,
                    columns: result.columns,
                    rows: result.rows,
                    rawXml: result.rawXml,
                };
            },
        }),
    ];
}
//# sourceMappingURL=datapreview.js.map