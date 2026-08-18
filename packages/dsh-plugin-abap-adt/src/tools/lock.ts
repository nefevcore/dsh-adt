/**
 * adt_lock_info — read-only query of an object's lock state (whether another
 * user holds the edit lock). Best-effort: not every backend exposes lock state
 * in the object metadata; the tool reports `locked: null` with a note then.
 *
 * adt_unlock_all — release residual edit locks. Uses the plugin's persistent
 * lock ledger (every lock the plugin acquired, across sessions) plus any
 * explicitly named objects; unlocks with the recorded handle, falling back to
 * a handle-less unlock on backends that accept it.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text, type ToolDeps } from './common.js';
import { resolveObject, resolveObjects } from '../resolve.js';

export function lockTools(deps: ToolDeps) {
  const { registry, ledger } = deps;

  const lockInfo = defineTool({
    name: 'adt_lock_info',
    description:
      'Read an object\'s lock state: whether it is locked for editing and by whom. ' +
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
        return text(
          `Lock state of ${value.objectUri}: ${value.locked ? `LOCKED${value.lockedBy ? ` by ${value.lockedBy}` : ''}${value.transport ? ` (transport ${value.transport})` : ''}` : 'free'}`,
        );
      },
    },
    isConcurrencySafe: () => true,
    execute: async (args, exec) => {
      const entry = registry.require(destinationOf(args));
      const ref = await resolveObject(entry.client, {
        objectUri: typeof args.objectUri === 'string' ? args.objectUri : undefined,
        name: typeof args.name === 'string' ? args.name : undefined,
        type: typeof args.type === 'string' ? args.type : undefined,
      }, 10, exec.signal);
      const info = await entry.client.getObjectLock(ref.uri, ref.type, { signal: exec.signal });
      return {
        objectUri: ref.uri,
        locked: info.locked,
        lockedBy: info.lockedBy,
        transport: info.transport,
        note: info.note,
      };
    },
  });

  const unlockAll = defineTool({
    name: 'adt_unlock_all',
    description:
      'Release residual ABAP edit locks held by this user. ADT locks can survive a crashed or ' +
      'interrupted tool call (and object creation auto-locks without returning a handle), blocking later ' +
      'edits with HTTP 403 EU510 until removed in SM12. This tool replays the plugin\'s persistent lock ' +
      'ledger (every lock this plugin acquired, across sessions on this machine) plus any explicit `objects`, ' +
      'unlocking with the recorded handle and falling back to a handle-less unlock where the backend accepts it. ' +
      'Locks that still cannot be released (e.g. held by another user) are reported — those need SM12.',
    parameters: {
      objects: {
        type: 'array',
        description:
          'Optional explicit objects to unlock. Each entry: {objectUri} or {name, type}. ' +
          'When omitted, every object in the plugin\'s lock ledger for the destination is attempted.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            objectUri: { type: 'string', description: 'Exact ADT object URI.' },
            name: { type: 'string', description: 'Object name (with type).' },
            type: { type: 'string', description: 'Object type, e.g. CLAS, PROG.' },
          },
        },
      },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          destination: { type: 'string', required: true },
          attempted: { type: 'integer', required: true },
          released: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                objectUri: { type: 'string', required: true },
                note: { type: 'string' },
              },
            },
          },
          failed: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                objectUri: { type: 'string', required: true },
                reason: { type: 'string', required: true },
              },
            },
          },
          remainingLedger: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => {
        const lines = [
          `Unlock all on ${value.destination}: ${value.released.length} released, ${value.failed.length} failed (of ${value.attempted} attempted)`,
          ...value.released.map((r) => `- released ${r.objectUri}${r.note ? ` (${r.note})` : ''}`),
          ...value.failed.map((f) => `- FAILED ${f.objectUri}: ${f.reason}`),
        ];
        return text(lines.join('\n'));
      },
    },
    execute: async (args, exec) => {
      const entry = registry.require(destinationOf(args));
      const destination = entry.config.name;

      // Candidate URIs: explicit objects + every ledger entry for the destination.
      const explicitInputs = Array.isArray(args.objects) ? (args.objects as Array<{ objectUri?: string; name?: string; type?: string }>) : [];
      const explicitRefs = explicitInputs.length ? await resolveObjects(entry.client, explicitInputs, exec.signal) : [];
      const ledgerEntries = ledger.forDestination(destination);

      const candidates = new Map<string, { uri: string; handle?: string; name?: string }>();
      for (const ref of explicitRefs) candidates.set(ref.uri, { uri: ref.uri, name: ref.name });
      for (const e of ledgerEntries) {
        const existing = candidates.get(e.uri);
        candidates.set(e.uri, { uri: e.uri, handle: e.handle ?? existing?.handle, name: e.name ?? existing?.name });
      }

      const released: Array<{ objectUri: string; note?: string }> = [];
      const failed: Array<{ objectUri: string; reason: string }> = [];
      for (const cand of candidates.values()) {
        const result = await entry.client.unlockBestEffort(cand.uri, cand.handle, { signal: exec.signal });
        if (result.released) {
          ledger.deregister(destination, cand.uri);
          released.push({ objectUri: cand.uri, note: result.note });
        } else {
          failed.push({ objectUri: cand.uri, reason: result.note ?? 'unlock failed' });
        }
      }
      return {
        destination,
        attempted: candidates.size,
        released,
        failed,
        remainingLedger: ledger.forDestination(destination).length,
      };
    },
  });

  return [lockInfo, unlockAll];
}
