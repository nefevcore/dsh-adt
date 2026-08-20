import { defineTool } from '@deepseek-ai/dsh-tools';
import { AdtError } from '@nefevcore/abap-adt-protocol';
import { DESTINATION_PARAM, OBJECT_REF_PARAMS, destinationOf, resolveToolObject, text } from './common.js';
export function transportTools(deps) {
    const { registry } = deps;
    const objectVersions = defineTool({
        name: 'adt_object_versions',
        description: 'Read the version history (Atom feed) of a source object. Each version carries the transport request ' +
            '(or open task) it was saved into — a read-only way to map objects to transports without locking.',
        parameters: {
            ...OBJECT_REF_PARAMS,
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    objectUri: { type: 'string', required: true },
                    versions: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                versionId: { type: 'string', required: true },
                                author: { type: 'string' },
                                updatedAt: { type: 'string' },
                                title: { type: 'string' },
                                transportRequest: { type: 'string' },
                                transportDescription: { type: 'string' },
                            },
                        },
                    },
                },
            },
            render: (_args, value) => {
                const lines = [`Versions of ${value.objectUri}: ${value.versions.length}`];
                for (const v of value.versions) {
                    lines.push(`- ${v.versionId}${v.updatedAt ? ` ${v.updatedAt}` : ''}${v.author ? ` by ${v.author}` : ''}` +
                        (v.transportRequest ? ` -> ${v.transportRequest}${v.transportDescription ? ` (${v.transportDescription})` : ''}` : ''));
                }
                return text(lines.join('\n'));
            },
        },
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const ref = await resolveToolObject(entry.client, args, exec.signal);
            let versions;
            try {
                versions = await entry.client.getVersions(ref.uri, { signal: exec.signal });
            }
            catch (error) {
                if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
                    throw new Error(`Version history (versions feed) is not available for ${ref.name} on this backend (HTTP ${error.status}); ` +
                        'use adt_get_transport / adt_list_transports to map objects to transports instead');
                }
                throw error;
            }
            return {
                objectUri: ref.uri,
                versions: versions.map((v) => ({
                    versionId: v.versionId,
                    author: v.author,
                    updatedAt: v.updatedAt,
                    title: v.title,
                    transportRequest: v.transportRequest,
                    transportDescription: v.transportDescription,
                })),
            };
        },
    });
    const transportOutput = {
        schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                transports: {
                    type: 'array',
                    required: true,
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            number: { type: 'string', required: true },
                            description: { type: 'string', required: true },
                            status: { type: 'string', required: true },
                            category: { type: 'string', required: true },
                            owner: { type: 'string', required: true },
                            system: { type: 'string', required: true },
                            client: { type: 'string', required: true },
                            modifiable: { type: 'boolean', required: true },
                            target: { type: 'string' },
                            items: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        name: { type: 'string', required: true },
                                        type: { type: 'string', required: true },
                                        action: { type: 'string', required: true },
                                        description: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        render: (_args, value) => text([
            `Transport requests: ${value.transports.length}`,
            ...value.transports.map((t) => {
                const lines = [
                    `- ${t.number} [${t.status}${t.modifiable ? '' : ' (released)'}] ${t.category} ${t.owner}: ${t.description}`,
                ];
                for (const item of t.items ?? []) {
                    lines.push(`    ${item.action} ${item.name} (${item.type})`);
                }
                return lines.join('\n');
            }),
        ].join('\n')),
    };
    const listTransports = defineTool({
        name: 'adt_list_transports',
        description: 'List transport requests (CTO) of the current user: number, status, category, owner and (optionally) contained objects. ' +
            'Use `status: "modifiable"` (or the backend code "D") to show only open (unreleased) requests — the ones still being worked on. ' +
            'Useful before activation or release operations.',
        parameters: {
            allUsers: { type: 'boolean', description: 'List transports of all users (default false).' },
            status: {
                type: 'string',
                description: 'Filter by release state (default "all"): "modifiable" = open/unreleased requests (alias "D"), ' +
                    '"released" = published (aliases "R"/"L"), "all" = no filter. Other values are forwarded to the ' +
                    'backend as the `status` query parameter.',
            },
            ...DESTINATION_PARAM,
        },
        output: transportOutput,
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            entry.policy.assertTransportsEnabled('adt_list_transports');
            const transports = await entry.client.listTransports({
                allUsers: args.allUsers === true,
                status: typeof args.status === 'string' ? args.status : 'all',
                signal: exec.signal,
            });
            return {
                transports: transports.map((t) => ({
                    number: t.number,
                    description: t.description,
                    status: t.status,
                    category: t.category,
                    owner: t.owner,
                    system: t.system,
                    client: t.client,
                    modifiable: t.modifiable,
                    target: t.target,
                    items: t.items?.map((i) => ({
                        name: i.name,
                        type: i.type,
                        action: i.action,
                        description: i.description,
                    })),
                })),
            };
        },
    });
    const getTransport = defineTool({
        name: 'adt_get_transport',
        description: 'Get one transport request including its contained objects (items).',
        parameters: {
            number: { type: 'string', required: true, description: 'Transport request number, e.g. S4HK900001.' },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    number: { type: 'string', required: true },
                    description: { type: 'string', required: true },
                    status: { type: 'string', required: true },
                    category: { type: 'string', required: true },
                    owner: { type: 'string', required: true },
                    system: { type: 'string', required: true },
                    client: { type: 'string', required: true },
                    modifiable: { type: 'boolean', required: true },
                    items: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                name: { type: 'string', required: true },
                                type: { type: 'string', required: true },
                                action: { type: 'string', required: true },
                                description: { type: 'string' },
                            },
                        },
                    },
                },
            },
            render: (_args, value) => text([
                `${value.number} [${value.status}] ${value.category} ${value.owner}: ${value.description} (${value.system}/${value.client})`,
                ...value.items.map((i) => `  ${i.action} ${i.name} (${i.type}) — ${i.description ?? ''}`),
            ].join('\n')),
        },
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            // Read-only: the transport FAMILY gate still applies, but the request
            // number itself is not policed — only edits (write/activate/release of
            // content) are constrained by allowedTransports.
            entry.policy.assertTransportsEnabled('adt_get_transport');
            const number = String(args.number);
            const t = await entry.client.getTransport(number, { signal: exec.signal });
            return {
                number: t.number,
                description: t.description,
                status: t.status,
                category: t.category,
                owner: t.owner,
                system: t.system,
                client: t.client,
                modifiable: t.modifiable,
                items: (t.items ?? []).map((i) => ({
                    name: i.name,
                    type: i.type,
                    action: i.action,
                    description: i.description,
                })),
            };
        },
    });
    // NOTE: adt_release_transport is deliberately NOT exposed as a tool.
    // Releasing a transport is irreversible (objects leave the system) and the
    // decision needs human judgement (import order, release windows, buffer
    // state) — an agent should stage everything up to a releasable request and
    // leave the final release to a person. The protocol client still implements
    // releaseTransport() for future, explicitly-gated use.
    return [objectVersions, listTransports, getTransport];
}
//# sourceMappingURL=transports.js.map