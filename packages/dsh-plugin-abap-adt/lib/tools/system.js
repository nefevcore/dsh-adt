import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text } from './common.js';
export function systemTools(deps) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_list_destinations',
            description: 'List the configured ABAP ADT destinations and their connectivity status. ' +
                'Use this first to discover which SAP systems are available and reachable.',
            parameters: {},
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        destinations: {
                            type: 'array',
                            required: true,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    name: { type: 'string', required: true },
                                    mock: { type: 'boolean', required: true },
                                    ok: { type: 'boolean', required: true },
                                    detail: { type: 'string', required: true },
                                },
                            },
                        },
                    },
                },
                render: (_args, value) => text(value.destinations
                    .map((d) => `- ${d.name}${d.mock ? ' (mock)' : ''}: ${d.ok ? 'reachable' : 'UNREACHABLE'} — ${d.detail}`)
                    .join('\n')),
            },
            execute: async () => {
                const results = await registry.pingAll();
                return { destinations: results };
            },
        }),
        defineTool({
            name: 'adt_system_info',
            description: 'Read system information of an ADT destination: SAP system id, release, ABAP Cloud status, feature flags and advertised services.',
            parameters: {
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        destination: { type: 'string', required: true },
                        systemId: { type: 'string', required: true },
                        release: { type: 'string', required: true },
                        abapCloud: { type: 'boolean', required: true },
                        serviceCount: { type: 'integer', required: true },
                        features: { type: 'object', additionalProperties: true },
                    },
                },
                render: (_args, value) => text([
                    `Destination: ${value.destination}`,
                    `System ID: ${value.systemId}`,
                    `Release: ${value.release}`,
                    `ABAP Cloud: ${value.abapCloud ? 'yes' : 'no'}`,
                    `Advertised services: ${value.serviceCount}`,
                    ...(value.features ? Object.entries(value.features).map(([k, v]) => `  ${k}: ${v}`) : []),
                ].join('\n')),
            },
            execute: async (args) => {
                const entry = registry.require(destinationOf(args));
                return entry.client.systemInfo();
            },
        }),
        defineTool({
            name: 'adt_ping',
            description: 'Probe an ADT destination: verifies reachability and authentication (uses the discovery service).',
            parameters: {
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        destination: { type: 'string', required: true },
                        ok: { type: 'boolean', required: true },
                        detail: { type: 'string', required: true },
                    },
                },
                render: (_args, value) => text(`${value.destination}: ${value.ok ? 'OK' : 'FAILED'} — ${value.detail}`),
            },
            execute: async (args) => {
                const name = destinationOf(args) ?? registry.defaultName;
                const entry = registry.require(name);
                const status = await entry.client.ping();
                return { destination: name, ok: status.ok, detail: status.detail ?? '' };
            },
        }),
    ];
}
//# sourceMappingURL=system.js.map