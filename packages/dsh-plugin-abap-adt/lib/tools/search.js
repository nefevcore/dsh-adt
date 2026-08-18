import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text } from './common.js';
/** Upper bound for presentation metadata: past this the UI falls back to the
 * generic card rather than persisting a huge copy of the search result. */
const SEARCH_META_MAX_ENTRIES = 500;
/** Project an adt_search value into search-card metadata (see presentation.d.ts). */
export function searchPresentationMeta(value) {
    // (returned as JsonValue at the presentationMeta seam below)
    const total = Math.max(value.count, value.objects.length + value.sources.length);
    const retained = value.objects.length + value.sources.length;
    if (retained > SEARCH_META_MAX_ENTRIES)
        return undefined;
    // Source-text hits render as grouped line matches; object-name hits render as
    // a flat path list. Both keep the capped/total signal honest for the UI.
    if (value.sources.length > 0) {
        const byObject = new Map();
        for (const s of value.sources) {
            const key = `${s.objectName} (${s.type})`;
            const matches = byObject.get(key) ?? [];
            matches.push({ lineNumber: s.lineNumber ?? 0, line: s.line });
            byObject.set(key, matches);
        }
        return {
            card: 'search',
            shape: 'matches',
            title: `ABAP search "${value.query}"`,
            files: [...byObject.entries()].map(([path, matches]) => ({ path, matches })),
            truncated: value.count > retained,
            total,
        };
    }
    if (value.objects.length > 0) {
        return {
            card: 'search',
            shape: 'paths',
            title: `ABAP search "${value.query}"`,
            paths: value.objects.map((o) => `${o.objectName} (${o.type})`),
            truncated: value.count > retained,
            total,
        };
    }
    return undefined;
}
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
                        note: { type: 'string' },
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
                                    category: { type: 'string' },
                                    mainProgram: { type: 'boolean' },
                                    masterLanguage: { type: 'string' },
                                    responsible: { type: 'string' },
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
                    if (value.note)
                        lines.push(`Note: ${value.note}`);
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
                presentationMeta: (_args, value) => 
                // `null` (legal JsonValue) when the result needs no search card —
                // presentResult falls back to the generic presentation for it.
                (searchPresentationMeta(value) ?? null),
            },
            presentResult: (_args, result) => {
                // presentationMeta returned a ready search view; replay it verbatim.
                // (Soft-validated: an obsolete logged shape falls back to generic.)
                const meta = result.meta;
                return meta && typeof meta === 'object' && 'card' in meta && meta.card === 'search' ? meta : undefined;
            },
            isConcurrencySafe: () => true,
            execute: async (args, exec) => {
                const entry = registry.require(destinationOf(args));
                const result = await entry.client.search(String(args.query ?? ''), {
                    operation: args.operation ?? 'quickSearch',
                    maxResults: Math.min(Number(args.maxResults ?? 25), 100),
                    objectType: typeof args.objectType === 'string' ? args.objectType : undefined,
                    signal: exec.signal,
                });
                return result;
            },
        }),
    ];
}
//# sourceMappingURL=search.js.map