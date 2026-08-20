import { defineTool } from '@deepseek-ai/dsh-tools';
import { text } from './common.js';
/**
 * Read-only introspection tool for the ADT permission policy. Lets the agent
 * learn its own guard rails before attempting mutating work, instead of
 * discovering them one denial at a time. Reports the global defaults AND the
 * effective policy per destination (a destination-level `policy:` block
 * overrides the global keys for that system only).
 */
export function policyTools(deps) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_permissions',
            description: 'Show the effective ADT permission policy: whether transports are enabled, which transport request ' +
                'numbers are allowed, whether edits of transportable (non-$TMP) packages are permitted, which ' +
                'development packages may be edited, whether program/class execution is allowed, and whether write ' +
                'parts inside adt_batch are allowed — as GLOBAL defaults plus the effective values per destination ' +
                '(a destination `policy:` block overrides the globals for that system). ' +
                'Read this before any mutating adt_* call to know what will be denied.',
            parameters: {},
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        enableTransports: { type: 'boolean', required: true },
                        allowedTransports: {
                            type: 'array',
                            required: true,
                            items: { type: 'string' },
                        },
                        allowTransportableEdits: { type: 'boolean', required: true },
                        allowedPackages: {
                            type: 'array',
                            required: true,
                            items: { type: 'string' },
                        },
                        allowExecution: { type: 'boolean', required: true },
                        allowBatchWrites: { type: 'boolean', required: true },
                        sources: {
                            type: 'object',
                            required: true,
                            additionalProperties: true,
                        },
                        defaults: {
                            type: 'object',
                            required: true,
                            additionalProperties: true,
                        },
                        perDestination: {
                            type: 'object',
                            required: true,
                            description: 'Effective policy per destination name (empty when no overrides exist).',
                            additionalProperties: true,
                        },
                    },
                },
                render: (_args, value) => {
                    const src = (key) => value.sources[key] ?? 'default';
                    const lines = [
                        'ADT permission policy — global defaults',
                        '',
                        `- enableTransports:        ${value.enableTransports} (source: ${src('enableTransports')})`,
                        `- allowedTransports:       ${value.allowedTransports.join(', ') || '(none)'} (source: ${src('allowedTransports')})`,
                        `- allowTransportableEdits: ${value.allowTransportableEdits} (source: ${src('allowTransportableEdits')})`,
                        `- allowedPackages:         ${value.allowedPackages.join(', ') || '(none)'} (source: ${src('allowedPackages')})`,
                        `- allowExecution:          ${value.allowExecution} (source: ${src('allowExecution')})`,
                        `- allowBatchWrites:        ${value.allowBatchWrites} (source: ${src('allowBatchWrites')})`,
                    ];
                    const entries = Object.entries(value.perDestination ?? {});
                    if (entries.length > 0) {
                        lines.push('', 'Per destination (effective values):');
                        for (const [name, raw] of entries) {
                            const p = raw;
                            lines.push(`- ${name}: transports=${p.enableTransports}, allowed=${p.allowedTransports.join(',') || '*'}, ` +
                                `transportableEdits=${p.allowTransportableEdits}, packages=${p.allowedPackages.join(',') || '*'}` +
                                (p.allowExecution !== undefined ? `, execution=${p.allowExecution}` : '') +
                                (p.allowBatchWrites !== undefined ? `, batchWrites=${p.allowBatchWrites}` : ''));
                        }
                    }
                    lines.push('', 'Denials are raised as [POLICY] errors naming the rule. Sources: config (per destination > global) > SAP_* env > default.');
                    return text(lines.join('\n'));
                },
            },
            isConcurrencySafe: () => true,
            // Read via the registry so a settings hot reload is reflected immediately.
            execute: async () => {
                const { global, perDestination } = registry.describePolicies();
                return {
                    enableTransports: global.enableTransports,
                    allowedTransports: global.allowedTransports,
                    allowTransportableEdits: global.allowTransportableEdits,
                    allowedPackages: global.allowedPackages,
                    allowExecution: global.allowExecution,
                    allowBatchWrites: global.allowBatchWrites,
                    sources: global.sources,
                    defaults: global.defaults,
                    perDestination,
                };
            },
        }),
    ];
}
//# sourceMappingURL=policy.js.map