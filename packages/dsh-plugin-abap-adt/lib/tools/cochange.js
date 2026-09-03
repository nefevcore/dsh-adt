/**
 * adt_cochange — transport co-variation analysis ("what usually changes
 * together", the cheap slice of vsp's graph suite): for the given objects,
 * collect the transport requests their version history records, expand each
 * request's item list, and rank the objects that shared those requests.
 *
 * Data face: object version feeds (adt_object_versions — transport number
 * per saved version) + transport items (adt_get_transport) — both already in
 * the protocol client, no E070/E071 SQL needed. Limitation (stated in the
 * tool description): co-occurrence derives from SAVE history in this
 * system; objects whose versions never recorded a transport stay invisible.
 *
 * Read-only; gated by enableTransports like adt_object_versions (transport
 * numbers leak through the feed — audit P3 family).
 */
import { defineTool } from '../tooldef.js';
import { sessionCwd, showingOfTotal, DESTINATION_PARAM, destinationOf, optStr, resolveToolObject, text } from './common.js';
export function cochangeTools(deps) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_cochange',
            description: 'Find what usually changes together with the given ABAP objects (transport co-occurrence, a slice of ' +
                'change-impact analysis): reads each object\'s version history for the transport requests it was saved ' +
                'into, fetches those requests\' item lists, and ranks the objects that shared them by co-occurrence count. ' +
                'Use it to scope regression tests or reviews before a change (CLAS/PROG/DDLS/… that ride the same ' +
                'transports as your object). Read-only. Data face: version feeds + transport items — objects whose save ' +
                'history recorded no transport stay invisible (young objects, pure transports from other systems).',
            parameters: {
                objects: {
                    type: 'array',
                    required: true,
                    description: 'Objects to analyze. Each: {name, type?} — resolve like everywhere else (1..10 per call).',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            name: { type: 'string', required: true },
                            type: { type: 'string' },
                        },
                    },
                },
                top: { type: 'integer', description: 'Maximum co-occurring objects to return (default 20, max 50).' },
                maxTransports: {
                    type: 'integer',
                    description: 'Maximum transport requests to expand (default 30, max 50) — the oldest are dropped first; the note says when this bound hit.',
                },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        inputs: {
                            type: 'array',
                            required: true,
                            items: { type: 'string' },
                        },
                        coChanges: {
                            type: 'array',
                            required: true,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    name: { type: 'string', required: true },
                                    type: { type: 'string' },
                                    sharedTransports: { type: 'integer', required: true },
                                    transports: { type: 'array', required: true, items: { type: 'string' } },
                                    description: { type: 'string' },
                                },
                            },
                        },
                        analyzedTransports: { type: 'array', required: true, items: { type: 'string' } },
                        totalCandidates: { type: 'integer', required: true },
                        note: { type: 'string' },
                    },
                },
                render: (_args, value) => {
                    const lines = [
                        `co-change analysis of ${value.inputs.join(', ')} over ${value.analyzedTransports.length} transport(s):`,
                        ...value.coChanges.map((row) => `- ${row.name}${row.type ? ` (${row.type})` : ''}: ${row.sharedTransports} shared transport(s) [${row.transports.join(', ')}]`),
                        ...(value.note ? [`Note: ${value.note}`] : []),
                    ];
                    return text(lines.join('\n'));
                },
            },
            isConcurrencySafe: () => true,
            execute: async (args, exec) => {
                const entry = await registry.require(destinationOf(args), sessionCwd(exec));
                // Same gate as adt_object_versions: the version feed leaks transport numbers.
                entry.policy.assertTransportsEnabled('adt_cochange');
                const rawObjects = Array.isArray(args.objects) ? args.objects : [];
                if (rawObjects.length === 0 || rawObjects.length > 10) {
                    throw new Error('adt_cochange: `objects` must contain 1..10 entries');
                }
                const topWanted = Math.min(Math.max(typeof args.top === 'number' ? Math.floor(args.top) : 20, 1), 50);
                const maxTransports = Math.min(Math.max(typeof args.maxTransports === 'number' ? Math.floor(args.maxTransports) : 30, 1), 50);
                const notes = [];
                // 1. Resolve the inputs and collect their transports from the version feeds.
                const inputNames = new Set();
                const transportSet = new Set();
                for (const raw of rawObjects) {
                    const ref = await resolveToolObject(entry.client, raw, exec.signal);
                    inputNames.add(ref.name.toUpperCase());
                    try {
                        const versions = await entry.client.getVersions(ref.uri, { signal: exec.signal });
                        for (const version of versions) {
                            if (version.transportRequest)
                                transportSet.add(version.transportRequest.toUpperCase());
                        }
                    }
                    catch (error) {
                        if (exec.signal?.aborted)
                            throw error;
                        // Visible gaps (vsp discipline): an input without a readable
                        // version feed stays in the answer as a note, never silently gone.
                        notes.push(`no version feed for ${ref.name} (${error.message})`);
                    }
                }
                // 2. Expand each transport into its item list (parent requests).
                const analyzed = [];
                const counts = new Map();
                for (const number of transportSet) {
                    if (analyzed.length >= maxTransports) {
                        notes.push(`transport budget reached — analyzed ${analyzed.length} of ${transportSet.size} request(s); raise maxTransports for deeper history`);
                        break;
                    }
                    try {
                        const transport = await entry.client.getTransport(number, { signal: exec.signal });
                        analyzed.push(transport.number);
                        for (const item of transport.items ?? []) {
                            const name = item.name.toUpperCase();
                            if (inputNames.has(name))
                                continue;
                            const key = `${name}|${item.type}`;
                            const existing = counts.get(key) ?? { type: item.type, transports: new Set(), description: item.description };
                            existing.transports.add(transport.number);
                            if (item.description)
                                existing.description = item.description;
                            counts.set(key, existing);
                        }
                    }
                    catch (error) {
                        if (exec.signal?.aborted)
                            throw error;
                        notes.push(`transport ${number} not readable (${error.message})`);
                    }
                }
                // 3. Rank by shared-transport count (then name for determinism).
                const rows = [...counts.entries()]
                    .map(([key, value]) => ({
                    name: key.split('|')[0],
                    type: value.type,
                    sharedTransports: value.transports.size,
                    transports: [...value.transports].sort(),
                    description: value.description,
                }))
                    .sort((a, b) => b.sharedTransports - a.sharedTransports || a.name.localeCompare(b.name));
                const coChanges = rows.slice(0, topWanted);
                if (rows.length > coChanges.length) {
                    notes.push(showingOfTotal(coChanges.length, rows.length, 'top'));
                }
                if (analyzed.length === 0) {
                    notes.push('no transport history found for the inputs — truthful for fresh objects (nothing saved into transportable requests yet)');
                }
                return {
                    inputs: [...inputNames],
                    coChanges,
                    analyzedTransports: analyzed.sort(),
                    totalCandidates: rows.length,
                    note: notes.length > 0 ? notes.join('; ') : undefined,
                };
            },
        }),
    ];
}
//# sourceMappingURL=cochange.js.map