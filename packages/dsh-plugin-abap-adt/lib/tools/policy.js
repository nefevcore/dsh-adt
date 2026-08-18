import { defineTool } from '@deepseek-ai/dsh-tools';
import { text } from './common.js';
/**
 * Read-only introspection tool for the ADT permission policy ("权限管控").
 * Lets the agent learn its own guard rails before attempting mutating work,
 * instead of discovering them one denial at a time.
 */
export function policyTools(deps) {
    const { policy } = deps;
    return [
        defineTool({
            name: 'adt_permissions',
            description: 'Show the effective ADT permission policy (权限管控): whether transports are enabled, which transport ' +
                'request numbers are allowed, whether edits of transportable (non-$TMP) packages are permitted, and which ' +
                'development packages may be edited. Values resolve from plugin config, then SAP_* environment variables, ' +
                'then built-in defaults (see `sources`). Read this before any mutating adt_* call to know what will be denied.',
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
                    },
                },
                render: (_args, value) => {
                    const src = (key) => value.sources[key] ?? 'default';
                    const lines = [
                        'ADT permission policy (权限管控)',
                        '',
                        `- enableTransports:        ${value.enableTransports} (source: ${src('enableTransports')})`,
                        `- allowedTransports:       ${value.allowedTransports.join(', ') || '(none)'} (source: ${src('allowedTransports')})`,
                        `- allowTransportableEdits: ${value.allowTransportableEdits} (source: ${src('allowTransportableEdits')})`,
                        `- allowedPackages:         ${value.allowedPackages.join(', ') || '(none)'} (source: ${src('allowedPackages')})`,
                        '',
                        'Denials are raised as [POLICY] errors naming the rule. Sources: config (cordis.patch.yml) > SAP_* env > default.',
                    ];
                    return text(lines.join('\n'));
                },
            },
            isConcurrencySafe: () => true,
            execute: async () => policy.describe(),
        }),
    ];
}
//# sourceMappingURL=policy.js.map