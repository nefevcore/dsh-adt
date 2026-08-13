import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text } from './common.js';
export function searchTools(deps) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_search',
            description: 'Search ABAP development objects and source code on the SAP system. ' +
                'Returns objects whose name/description match and (for full-text search) source excerpts. ' +
                'Use `operation` to narrow: "quickSearch" (both, default), "objectSearch" (names only), ' +
                '"quickSearchSource" (source text only).',
            parameters: {
                query: {
                    type: 'string',
                    required: true,
                    description: 'Search term (case-insensitive). Supports * wildcards on the backend.',
                },
                operation: {
                    type: 'string',
                    enum: ['quickSearch', 'objectSearch', 'quickSearchSource'],
                    description: 'Search scope. Default: quickSearch.',
                },
                maxResults: {
                    type: 'integer',
                    description: 'Maximum number of hits (default 25, max 100).',
                },
                objectType: {
                    type: 'string',
                    description: 'Optional object type filter, e.g. "CLAS", "INTF", "PROG", "DDLS".',
                },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        query: { type: 'string', required: true },
                        count: { type: 'integer', required: true },
                        objects: {
                            type: 'array',
                            required: true,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    objectName: { type: 'string', required: true },
                                    description: { type: 'string', required: true },
                                    type: { type: 'string', required: true },
                                    uri: { type: 'string', required: true },
                                    packageName: { type: 'string' },
                                    typeLabel: { type: 'string' },
                                    changedAt: { type: 'string' },
                                    changedBy: { type: 'string' },
                                },
                            },
                        },
                        sources: {
                            type: 'array',
                            required: true,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    objectName: { type: 'string', required: true },
                                    type: { type: 'string', required: true },
                                    uri: { type: 'string', required: true },
                                    line: { type: 'string', required: true },
                                    lineNumber: { type: 'integer' },
                                },
                            },
                        },
                    },
                },
                render: (_args, value) => {
                    const lines = [];
                    lines.push(`Search "${value.query}": ${value.count} hit(s)`);
                    if (value.objects.length) {
                        lines.push('');
                        lines.push('Objects:');
                        for (const o of value.objects) {
                            lines.push(`- ${o.objectName} [${o.type}] ${o.description}${o.packageName ? ` (${o.packageName})` : ''}`);
                            lines.push(`  ${o.uri}`);
                        }
                    }
                    if (value.sources.length) {
                        lines.push('');
                        lines.push('Source hits:');
                        for (const s of value.sources) {
                            lines.push(`- ${s.objectName} [${s.type}]${s.lineNumber ? ` line ${s.lineNumber}` : ''}: ${s.line}`);
                        }
                    }
                    return text(lines.join('\n'));
                },
            },
            execute: async (args) => {
                const entry = registry.require(destinationOf(args));
                const result = await entry.client.search(String(args.query ?? ''), {
                    operation: args.operation ?? 'quickSearch',
                    maxResults: Math.min(Number(args.maxResults ?? 25), 100),
                    objectType: typeof args.objectType === 'string' ? args.objectType : undefined,
                });
                return result;
            },
        }),
    ];
}
//# sourceMappingURL=search.js.map