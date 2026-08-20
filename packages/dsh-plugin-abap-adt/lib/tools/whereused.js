/**
 * adt_where_used — impact analysis: find objects that reference or depend on
 * a given ABAP object, before changing it. Read-only. Minimal ADT profiles
 * without the usageReferences collection degrade to an explicit note instead
 * of a raw 404/405.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { AdtError } from '@nefevcore/abap-adt-protocol';
import { DESTINATION_PARAM, OBJECT_REF_PARAMS, destinationOf, resolveToolObject, text } from './common.js';
export function whereUsedTools(deps) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_where_used',
            description: 'Where-used / impact analysis: find objects that reference or depend on the given ABAP object. ' +
                'Run before changing an object to understand the blast radius. Read-only.',
            parameters: {
                ...OBJECT_REF_PARAMS,
                enableAllTypes: {
                    type: 'boolean',
                    description: 'Expand the search to all object types (Eclipse "select all"). Default false (SAP default scope); can be much slower.',
                },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        objectUri: { type: 'string', required: true },
                        totalReferences: { type: 'integer', required: true },
                        note: { type: 'string' },
                        references: {
                            type: 'array',
                            required: true,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    name: { type: 'string', required: true },
                                    type: { type: 'string', required: true },
                                    uri: { type: 'string', required: true },
                                    packageName: { type: 'string' },
                                    responsible: { type: 'string' },
                                    usageInformation: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                render: (_args, value) => {
                    const lines = [
                        `Where-used of ${value.objectUri}: ${value.totalReferences} reference(s)`,
                        ...(value.note ? [`Note: ${value.note}`] : []),
                        ...value.references.map((r) => `- ${r.name} (${r.type}) ${r.packageName ? `in ${r.packageName}` : ''}${r.usageInformation ? ` — ${r.usageInformation}` : ''}`),
                    ];
                    return text(lines.join('\n'));
                },
            },
            isConcurrencySafe: () => true,
            execute: async (args, exec) => {
                const entry = registry.require(destinationOf(args));
                const ref = await resolveToolObject(entry.client, args, exec.signal);
                try {
                    const result = await entry.client.getWhereUsed(ref.uri, { enableAllTypes: args.enableAllTypes === true, signal: exec.signal });
                    return {
                        objectUri: ref.uri,
                        totalReferences: result.totalReferences,
                        references: result.references,
                    };
                }
                catch (error) {
                    if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
                        return {
                            objectUri: ref.uri,
                            totalReferences: 0,
                            references: [],
                            note: `where-used (usageReferences) is not available on this backend (HTTP ${error.status}); ` +
                                'analyse dependencies via adt_search / adt_package_content instead',
                        };
                    }
                    throw error;
                }
            },
        }),
    ];
}
//# sourceMappingURL=whereused.js.map