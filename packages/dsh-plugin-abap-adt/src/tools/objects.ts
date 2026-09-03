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
import { defineTool } from '../tooldef.js';
import { AdtError, type AdtCreatableObjectType } from '@nefevcore/abap-adt-protocol';
import { sessionCwd,
  DESTINATION_PARAM,
  OBJECT_REF_PARAMS,
  PACKAGE_HINT_PARAM,
  assertExplicitTransport,
  assertObjectEditable,
  destinationOf,
  optStr,
  resolveToolObject,
  text,
  type ToolDeps,
} from './common.js';
import { refFromName } from '../resolve.js';
import { crudCreatableTypes } from '../crudmatrix.js';

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
      '(MSAG), function group (FUNC) or package (DEVC). Use package "$TMP" for local objects without transports. ' +
      'TABL one-step mode: pass `fields` (name/type/length/decimals/isKey/notNull/description; builtin codes ' +
      'CHAR/NUMC/RAW/DEC/CURR/QUAN/INT… or a data-element name) and the table is created from generated DDIC 2.0 ' +
      'DDL (auto MANDT key, @AbapCatalog annotations) and ACTIVATED in one call — the output echoes the DDL. ' +
      'Without `fields` a TABL is created as an empty placeholder as before.',
    parameters: {
      type: {
        type: 'string',
        required: true,
        enum: crudCreatableTypes(),
        description: 'Object type to create (derived from the CRUD matrix — src/crudmatrix.ts).',
      },
      name: { type: 'string', required: true, description: 'Object name, e.g. ZCL_MY_CLASS.' },
      description: { type: 'string', required: true, description: 'Short description of the object.' },
      packageName: {
        type: 'string',
        required: true,
        description: 'Development package; use $TMP for local objects.',
      },
      transport: { type: 'string', description: 'Transport request number when the package requires one.' },
      fields: {
        type: 'array',
        description:
          'TABL only: field list for the one-step DDL flow. Each: {name, type (builtin code or data element name), ' +
          'length?, decimals?, isKey?, notNull?, description?}. The MANDT client key is added automatically.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true, description: 'Field name (ABAP name).' },
            type: { type: 'string', required: true, description: 'Builtin type code (CHAR, NUMC, RAW, DEC, CURR, QUAN, INT1..8, FLTP, STRING, RAWSTRING, DATS, TIMS, UTCLONG, UUID, CHARnn/NUMCnn) or a data element name.' },
            length: { type: 'integer', description: 'Field length (builtin types).' },
            decimals: { type: 'integer', description: 'Decimals (DEC/CURR/QUAN; default 2).' },
            isKey: { type: 'boolean', description: 'Key field (implies not null).' },
            notNull: { type: 'boolean', description: 'NOT NULL (non-key).' },
            description: { type: 'string', description: 'Field label (@EndUserText.label annotation).' },
          },
        },
      },
      deliveryClass: {
        type: 'string',
        description: 'TABL with fields: delivery class (A application table [default], C customizing, L temporary, G/S customer table).',
      },
      tableCategory: {
        type: 'string',
        description: 'TABL with fields: TRANSPARENT (default), STRUCTURE, CLUSTER or POOL.',
      },
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
          activated: { type: 'boolean', description: 'TABL one-step flow: the activation outcome.' },
          ddlSource: { type: 'string', description: 'TABL one-step flow: the generated DDIC 2.0 DDL that was written.' },
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
            ...(value.activated === false ? ['  activation FAILED — the table exists but is inactive; fix the DDL and activate via adt_activate'] : []),
            ...(value.ddlSource ? ['', 'generated DDL:', value.ddlSource] : []),
            ...value.messages.map((m) => `  ${m.severity}: ${m.text}`),
          ].join('\n'),
        ),
    },
    execute: async (args, exec) => {
      const entry = await registry.require(destinationOf(args), sessionCwd(exec));
      const packageName = String(args.packageName ?? '$TMP').toUpperCase();
      // Permission check: package whitelist + transportable-edit rule.
      entry.policy.assertEditAllowed(packageName, 'adt_create_object');
      const transport = optStr(args.transport);
      assertExplicitTransport(entry.policy, transport, 'adt_create_object');

      // TABL one-step flow: fields given → create from generated DDIC 2.0 DDL
      // and activate in one call (see client.createTable).
      if (String(args.type).toUpperCase() === 'TABL' && Array.isArray(args.fields)) {
        const rawFields = args.fields as Array<Record<string, unknown>>;
        if (rawFields.length === 0) {
          throw new Error(
            'adt_create_object: `fields` must contain at least one field ' +
              '(or omit it entirely for a placeholder table)',
          );
        }
        const table = await entry.client.createTable(
          {
            name: String(args.name),
            description: String(args.description ?? ''),
            packageName,
            transport,
            deliveryClass: optStr(args.deliveryClass),
            tableCategory: optStr(args.tableCategory),
            fields: rawFields.map((f) => ({
              name: String(f.name ?? ''),
              type: String(f.type ?? ''),
              length: typeof f.length === 'number' ? f.length : undefined,
              decimals: typeof f.decimals === 'number' ? f.decimals : undefined,
              isKey: f.isKey === true,
              notNull: f.notNull === true,
              description: optStr(f.description),
            })),
          },
          { signal: exec.signal },
        );
        // The transport the create was recorded into (explicit or assigned)
        // must pass the policy, like the generic path below.
        if (table.transport) {
          entry.policy.assertTransportUsage(table.transport, `adt_create_object (${table.name})`);
        }
        return {
          success: table.activated,
          uri: table.uri,
          name: table.name,
          type: 'TABL/DT',
          activated: table.activated,
          ddlSource: table.ddlSource,
          messages: table.messages.map((m) => ({ severity: m.severity, text: m.text })),
        };
      }

      const result = await (async (): Promise<{
        success: boolean;
        uri?: string;
        object?: { uri: string; type: string; name: string; category?: string };
        transport?: string;
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
      // Post-create hygiene (see file header) + transport policing (audit
      // M7): 1. the transport the create was RECORDED into (explicit,
      // create-response CORRNR, or the lock's assignment) must pass the
      // policy — on violation the fresh object is deleted again so no
      // out-of-policy request keeps content; 2. try to LOCK ourselves — if it
      // succeeds the object was free and we immediately release OUR handle
      // (clean state); 3. if the backend already holds the lock, try a
      // handle-less UNLOCK; 4. if that is also rejected, remember the object
      // in the lock ledger so `adt_unlock_all` can retry later.
      if (result.success && result.uri) {
        const destination = entry.config.name;
        let lockResult: { handle: string; transport?: string } | undefined;
        try {
          lockResult = await entry.client.lock(result.uri);
        } catch {
          // already locked (403) or lock unsupported → handle-less attempt below
        }
        const recordedTransport = lockResult?.transport ?? result.transport ?? transport;
        if (recordedTransport) {
          try {
            entry.policy.assertTransportUsage(recordedTransport, `adt_create_object (${result.object?.name ?? String(args.name)})`);
          } catch (error) {
            // Roll the create back; keep the ledger entry so a surviving
            // backend lock can still be released by adt_unlock_all.
            if (lockResult) {
              ledger.register({
                destination,
                uri: result.uri,
                name: result.object?.name ?? String(args.name),
                handle: lockResult.handle,
                transport: recordedTransport,
                note: 'create policy rollback',
              });
            }
            let cleanup: string;
            try {
              await entry.client.deleteObject(result.uri, { signal: exec.signal });
              cleanup = 'the created object was deleted again';
            } catch {
              cleanup = 'automatic deletion FAILED — remove the object manually if appropriate';
            }
            (error as Error).message += `; ${cleanup}`;
            throw error;
          }
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
      const entry = await registry.require(destinationOf(args), sessionCwd(exec));
      const ref = await resolveToolObject(entry.client, args, exec.signal, { strict: true, toolName: 'adt_delete_object' });
      await assertObjectEditable(entry, ref, {
        toolName: 'adt_delete_object',
        packageHint: optStr(args.packageName),
        signal: exec.signal,
      });
      const transport = optStr(args.transport);
      assertExplicitTransport(entry.policy, transport, 'adt_delete_object', ref.name);
      await entry.client.deleteObject(ref.uri, { transport, signal: exec.signal });
      // The object (and any lock on it) is gone — drop the ledger entry.
      ledger.deregister(entry.config.name, ref.uri);
      return { uri: ref.uri, deleted: true, transport };
    },
  });

  return [createObject, deleteObject];
}
