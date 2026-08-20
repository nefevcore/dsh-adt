/**
 * adt_create_object — create a new development object via the type-specific
 * collection endpoint. Includes post-create lock hygiene: some backends
 * auto-lock the fresh object (and auto-assign a transport) without returning
 * a handle, which would block later edits with 403 EU510 — those residual
 * locks are probed, best-effort released, and remembered in the lock ledger.
 *
 * adt_delete_object — delete an object (modern deletion service with legacy
 * `_action` fallback). Irreversible.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { AdtError, type AdtCreatableObjectType } from '@nefevcore/abap-adt-protocol';
import {
  DESTINATION_PARAM,
  OBJECT_REF_PARAMS,
  PACKAGE_HINT_PARAM,
  assertObjectEditable,
  destinationOf,
  optStr,
  resolveToolObject,
  text,
  type ToolDeps,
} from './common.js';
import { refFromName } from '../resolve.js';

/** True when the backend answers GET on the object URI (object exists). */
async function objectExists(client: { readSource(uri: string): Promise<unknown> }, uri: string): Promise<boolean> {
  try {
    await client.readSource(uri);
    return true;
  } catch {
    return false;
  }
}

export function objectTools(deps: ToolDeps) {
  const { registry, ledger } = deps;

  const createObject = defineTool({
    name: 'adt_create_object',
    description:
      'Create a new ABAP development object: class (CLAS), interface (INTF), program (PROG), CDS view (DDLS), ' +
      'table (TABL), structure (STRU), domain (DOMA), data element (DTEL), table type (TTYP), message class ' +
      '(MSAG), function group (FUNC) or package (DEVC). Use package "$TMP" for local objects without transports.',
    parameters: {
      type: {
        type: 'string',
        required: true,
        enum: ['CLAS', 'INTF', 'PROG', 'DDLS', 'TABL', 'STRU', 'DOMA', 'DTEL', 'TTYP', 'MSAG', 'FUNC', 'DEVC'],
        description: 'Object type to create.',
      },
      name: { type: 'string', required: true, description: 'Object name, e.g. ZCL_MY_CLASS.' },
      description: { type: 'string', required: true, description: 'Short description of the object.' },
      packageName: {
        type: 'string',
        required: true,
        description: 'Development package; use $TMP for local objects.',
      },
      transport: { type: 'string', description: 'Transport request number when the package requires one.' },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          success: { type: 'boolean', required: true },
          uri: { type: 'string', required: true },
          name: { type: 'string' },
          type: { type: 'string' },
          messages: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,

              properties: {
                severity: { type: 'string', required: true },
                text: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) =>
        text(
          [
            `${value.success ? 'Created' : 'FAILED to create'} ${value.type ?? ''} ${value.name ?? ''} — ${value.uri}`,
            ...value.messages.map((m) => `  ${m.severity}: ${m.text}`),
          ].join('\n'),
        ),
    },
    execute: async (args, exec) => {
      const entry = registry.require(destinationOf(args));
      const packageName = String(args.packageName ?? '$TMP').toUpperCase();
      // Permission check: package whitelist + transportable-edit rule.
      entry.policy.assertEditAllowed(packageName, 'adt_create_object');
      const transport = optStr(args.transport);
      if (transport) {
        entry.policy.assertTransportsEnabled('adt_create_object');
        entry.policy.assertTransportAllowed(transport, 'adt_create_object');
      }
      const result = await (async (): Promise<{
        success: boolean;
        uri?: string;
        object?: { uri: string; type: string; name: string; category?: string };
        messages: Array<{ severity: string; text: string }>;
      }> => {
        try {
          return await entry.client.createObject({
            destination: entry.config.name,
            type: String(args.type) as AdtCreatableObjectType,
            name: String(args.name),
            description: String(args.description ?? ''),
            packageName,
            transport,
          }, { signal: exec.signal });
        } catch (error) {
          // Minimal ADT profiles (e.g. impc-dev) may CREATE the object but
          // answer the create call with an error page (HTTP 500 after
          // auto-assigning a transport request / lock). Detect that and report
          // success-with-warning instead of a confusing failure.
          if (error instanceof AdtError && error.status === 500) {
            const probe = refFromName(String(args.name), String(args.type));
            if (probe.uri && (await objectExists(entry.client, probe.uri))) {
              return {
                success: true,
                uri: probe.uri,
                object: probe,
                messages: [
                  {
                    severity: 'W',
                    text: 'backend answered HTTP 500 but the object exists — created (check the auto-generated transport request if any)',
                  },
                ],
              };
            }
          }
          throw error;
        }
      })();
      // Post-create lock hygiene (see file header): 1. try to LOCK ourselves —
      // if it succeeds the object was free and we immediately release OUR
      // handle (clean state); 2. if the backend already holds the lock, try a
      // handle-less UNLOCK; 3. if that is also rejected, remember the object
      // in the lock ledger so `adt_unlock_all` can retry later.
      if (result.success && result.uri) {
        const destination = entry.config.name;
        let lockResult: { handle: string } | undefined;
        try {
          lockResult = await entry.client.lock(result.uri);
        } catch {
          // already locked (403) or lock unsupported → handle-less attempt below
        }
        if (lockResult) {
          try {
            await entry.client.unlock(result.uri, lockResult.handle);
          } catch {
            ledger.register({ destination, uri: result.uri, name: result.object?.name ?? String(args.name), handle: lockResult.handle, note: 'create post-check lock' });
          }
        } else {
          const released = await entry.client.unlockBestEffort(result.uri);
          if (!released.released) {
            ledger.register({
              destination,
              uri: result.uri,
              name: result.object?.name ?? String(args.name),
              note: 'create auto-lock (no handle returned by backend)',
            });
          }
        }
      }
      return {
        success: result.success,
        uri: result.uri ?? '',
        name: result.object?.name ?? String(args.name),
        type: result.object?.type ?? String(args.type),
        messages: result.messages.map((m) => ({ severity: m.severity, text: m.text })),
      };
    },
  });

  const deleteObject = defineTool({
    name: 'adt_delete_object',
    description:
      'Delete an ABAP development object (modern deletion service, legacy `_action` fallback). Irreversible — ' +
      'prefer deactivation or transport-based removal when unsure. Subject to the permission policy.',
    parameters: {
      ...OBJECT_REF_PARAMS,
      ...PACKAGE_HINT_PARAM,
      transport: {
        type: 'string',
        description:
          'Transport request number the deletion is recorded into. When omitted the backend decides on lock ' +
          '(existing open request of the object, otherwise a NEW auto-created one).',
      },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          uri: { type: 'string', required: true },
          deleted: { type: 'boolean', required: true },
          transport: { type: 'string', description: 'Transport the deletion was recorded into (when transportable).' },
        },
      },
      render: (_args, value) =>
        text(
          `${value.uri}: ${value.deleted ? 'deleted' : 'NOT deleted'}` +
            (value.transport ? ` (recorded in transport ${value.transport})` : ''),
        ),
    },
    execute: async (args, exec) => {
      const entry = registry.require(destinationOf(args));
      const ref = await resolveToolObject(entry.client, args, exec.signal);
      await assertObjectEditable(entry, ref, {
        toolName: 'adt_delete_object',
        packageHint: optStr(args.packageName),
        signal: exec.signal,
      });
      const transport = optStr(args.transport);
      if (transport) {
        entry.policy.assertTransportsEnabled('adt_delete_object');
        entry.policy.assertTransportAllowed(transport, `adt_delete_object (${ref.name})`);
      }
      await entry.client.deleteObject(ref.uri, { transport, signal: exec.signal });
      // The object (and any lock on it) is gone — drop the ledger entry.
      ledger.deregister(entry.config.name, ref.uri);
      return { uri: ref.uri, deleted: true, transport };
    },
  });

  return [createObject, deleteObject];
}
