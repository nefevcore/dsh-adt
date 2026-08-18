import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text, renderObjectRefs } from './common.js';
export function packageTools(deps) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_package_content',
            description: 'List the direct members (objects) of a development package, e.g. all classes, programs, interfaces and CDS views of ZPACK_DEMO. ' +
                'Use "$TMP" for local objects.',
            parameters: {
                packageName: {
                    type: 'string',
                    required: true,
                    description: 'Package name, e.g. ZPACK_DEMO or $TMP.',
                },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        packageName: { type: 'string', required: true },
                        count: { type: 'integer', required: true },
                        objects: {
                            type: 'array',
                            required: true,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    name: { type: 'string', required: true },
                                    type: { type: 'string', required: true },
                                    uri: { type: 'string', required: true },
                                    category: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                render: (_args, value) => text([
                    `Package ${value.packageName}: ${value.count} member(s)`,
                    ...value.objects.map((o) => `- ${o.name} (${o.type}) — ${o.uri}`),
                ].join('\n')),
            },
            isConcurrencySafe: () => true,
            execute: async (args, exec) => {
                const entry = registry.require(destinationOf(args));
                const refs = await entry.client.packageContent(String(args.packageName), { signal: exec.signal });
                return {
                    packageName: String(args.packageName),
                    count: refs.length,
                    objects: refs.map((r) => ({ name: r.name, type: r.type, uri: r.uri, category: r.category })),
                };
            },
        }),
    ];
}
//# sourceMappingURL=packages.js.map