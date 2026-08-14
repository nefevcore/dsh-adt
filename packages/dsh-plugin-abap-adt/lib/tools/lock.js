/**
 * adt_lock_info — read-only query of an object's lock state (whether another
 * user holds the edit lock). Best-effort: not every backend exposes lock state
 * in the object metadata; the tool reports `locked: null` with a note then.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text } from './common.js';
import { resolveObject } from '../resolve.js';
export function lockTools(deps) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_lock_info',
            description: 'Read an object\'s lock state: whether it is locked for editing and by whom. ' +
                'Check before adt_write_object to avoid edit conflicts. Read-only (never acquires a lock). ' +
                'Some backends do not expose lock state in metadata — the tool reports locked=null with a note then.',
            parameters: {
                objectUri: { type: 'string', description: 'Exact ADT object URI, e.g. /sap/bc/adt/oo/classes/zcl_demo.' },
                name: { type: 'string', description: 'Object name, e.g. ZCL_DEMO.' },
                type: { type: 'string', description: 'Object type (short or ADT form), e.g. CLAS, INTF, PROG.' },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        objectUri: { type: 'string', required: true },
                        locked: { type: 'boolean' },
                        lockedBy: { type: 'string' },
                        transport: { type: 'string' },
                        note: { type: 'string' },
                    },
                },
                render: (_args, value) => {
                    if (value.locked === undefined || value.locked === null) {
                        return text(`Lock state of ${value.objectUri}: unknown${value.note ? ` (${value.note})` : ''}`);
                    }
                    return text(`Lock state of ${value.objectUri}: ${value.locked ? `LOCKED${value.lockedBy ? ` by ${value.lockedBy}` : ''}${value.transport ? ` (transport ${value.transport})` : ''}` : 'free'}`);
                },
            },
            execute: async (args) => {
                const entry = registry.require(destinationOf(args));
                const ref = await resolveObject(entry.client, {
                    objectUri: typeof args.objectUri === 'string' ? args.objectUri : undefined,
                    name: typeof args.name === 'string' ? args.name : undefined,
                    type: typeof args.type === 'string' ? args.type : undefined,
                });
                const info = await entry.client.getObjectLock(ref.uri);
                return {
                    objectUri: ref.uri,
                    locked: info.locked,
                    lockedBy: info.lockedBy,
                    transport: info.transport,
                    note: info.note,
                };
            },
        }),
    ];
}
//# sourceMappingURL=lock.js.map