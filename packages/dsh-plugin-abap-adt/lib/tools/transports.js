import { defineTool } from '@deepseek-ai/dsh-tools';
import { AdtError } from '@nefevcore/abap-adt-protocol';
import { sessionCwd, DESTINATION_PARAM, OBJECT_REF_PARAMS, destinationOf, resolveToolObject, text } from './common.js';
/** Transport item (contained object) schema shared by adt_list_transports and adt_get_transport. */
const TRANSPORT_ITEM_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        name: { type: 'string', required: true },
        type: { type: 'string', required: true },
        action: { type: 'string', required: true },
        description: { type: 'string' },
    },
};
export function transportTools(deps) {
    const { registry } = deps;
    const objectVersions = defineTool({
        name: 'adt_object_versions',
        description: 'Read the version history (Atom feed) of a source object. Each version carries the transport request ' +
            '(or open task) it was saved into — a read-only way to map objects to transports without locking. ' +
            'Gated by the enableTransports policy knob (the feed exposes transport request numbers — audit P3).',
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
            const entry = await registry.require(destinationOf(args), sessionCwd(exec));
            // The feed reveals transport request numbers (audit P3 information
            // leak): same gate as the rest of the transport tool family.
            entry.policy.assertTransportsEnabled('adt_object_versions');
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
                                items: TRANSPORT_ITEM_SCHEMA,
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
            'Useful before activation or release operations. Semantic status words are translated to the backend letter codes, and ' +
            'the result is additionally filtered client-side; when a backend rejects the server-side status parameter the list is ' +
            're-fetched unfiltered and filtered locally — but ALWAYS cross-check with adt_get_transport / adt_object_versions ' +
            'before concluding a request does not exist.',
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
            const entry = await registry.require(destinationOf(args), sessionCwd(exec));
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
        description: 'Get one transport request including its contained objects (items). NOTE: version histories (adt_object_versions) ' +
            'record TASK-level numbers; querying a task number here returns its PARENT request — compare `number` in the ' +
            'output with what you asked for and use the returned parent number for follow-ups.',
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
                    requestedNumber: {
                        type: 'string',
                        description: 'The number as asked for — differs from `number` when a task was resolved to its parent request.',
                    },
                    description: { type: 'string', required: true },
                    status: { type: 'string', required: true },
                    category: { type: 'string', required: true },
                    owner: { type: 'string', required: true },
                    system: { type: 'string', required: true },
                    client: { type: 'string', required: true },
                    modifiable: { type: 'boolean', required: true },
                    note: { type: 'string', description: 'Present when the requested number resolved to a different request (task → parent).' },
                    items: {
                        type: 'array',
                        required: true,
                        items: TRANSPORT_ITEM_SCHEMA,
                    },
                },
            },
            render: (_args, value) => text([
                `${value.number} [${value.status}] ${value.category} ${value.owner}: ${value.description} (${value.system}/${value.client})` +
                    (value.note ? `\n  ⚠ ${value.note}` : ''),
                ...value.items.map((i) => `  ${i.action} ${i.name} (${i.type}) — ${i.description ?? ''}`),
            ].join('\n')),
        },
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const entry = await registry.require(destinationOf(args), sessionCwd(exec));
            // Read-only: the transport FAMILY gate still applies, but the request
            // number itself is not policed — only edits (write/activate/release of
            // content) are constrained by allowedTransports.
            entry.policy.assertTransportsEnabled('adt_get_transport');
            const number = String(args.number);
            const t = await entry.client.getTransport(number, { signal: exec.signal });
            // Real CTO backends resolve a TASK number to its parent REQUEST (version
            // feeds record task-level numbers) — surface that mapping explicitly so
            // agents do not wonder why the header shows another number.
            const requestedNumber = number.toUpperCase();
            const taskNote = t.number && requestedNumber !== t.number.toUpperCase()
                ? `requested ${requestedNumber} is a task (or unknown) number — the backend resolved it to request ${t.number}; ` +
                    `use ${t.number} for follow-ups`
                : undefined;
            return {
                number: t.number,
                requestedNumber: taskNote ? requestedNumber : undefined,
                description: t.description,
                status: t.status,
                category: t.category,
                owner: t.owner,
                system: t.system,
                client: t.client,
                modifiable: t.modifiable,
                note: taskNote,
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