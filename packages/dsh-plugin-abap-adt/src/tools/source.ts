import { defineTool } from '@deepseek-ai/dsh-tools';
import type { AdtCreatableObjectType } from '@abap-adt/protocol';
import { DESTINATION_PARAM, destinationOf, text, type ToolDeps } from './common.js';
import { resolveObject, resolvePackageName, typeLabel } from '../resolve.js';
import { AdtPolicyError } from '../policy.js';

export function sourceTools(deps: ToolDeps) {
  const { registry, policy } = deps;

  const readObject = defineTool({
    name: 'adt_read_object',
    description:
      'Read the source code and metadata of an ABAP development object (class, interface, program, CDS view, ...). ' +
      'Pass `objectUri` (from search results) or `name` + optional `type` ("CLAS", "INTF", "PROG", "DDLS", "TABL", ...).',
    parameters: {
      objectUri: { type: 'string', description: 'Exact ADT object URI, e.g. /sap/bc/adt/oo/classes/zcl_demo.' },
      name: { type: 'string', description: 'Object name, e.g. ZCL_DEMO.' },
      type: { type: 'string', description: 'Object type (short or ADT form), e.g. CLAS, INTF, PROG, DDLS.' },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          uri: { type: 'string', required: true },
          name: { type: 'string', required: true },
          type: { type: 'string', required: true },
          source: { type: 'string', required: true },
          description: { type: 'string' },
          properties: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      render: (_args, value) =>
        text(
          [
            `${value.name} (${typeLabel(value.type)}) — ${value.uri}`,
            value.description ? `Description: ${value.description}` : '',
            '',
            '```abap',
            value.source,
            '```',
          ]
            .filter((l) => l !== '')
            .join('\n'),
        ),
    },
    execute: async (args) => {
      const entry = registry.require(destinationOf(args));
      const ref = await resolveObject(entry.client, {
        objectUri: typeof args.objectUri === 'string' ? args.objectUri : undefined,
        name: typeof args.name === 'string' ? args.name : undefined,
        type: typeof args.type === 'string' ? args.type : undefined,
      });
      const parsed = await entry.client.readSource(ref.uri);
      const properties: Record<string, string> = {};
      for (const p of parsed.properties) properties[p.key] = p.value;
      const description = properties['description'] ?? '';
      return {
        uri: ref.uri,
        name: ref.name,
        type: ref.type,
        source: parsed.source,
        description: description || undefined,
        properties,
      };
    },
  });

  const writeObject = defineTool({
    name: 'adt_write_object',
    description:
      'Replace the source code of an existing ABAP development object. ' +
      'The object is locked, updated and unlocked automatically. ' +
      'Use after adt_read_object to edit; call adt_activate afterwards to activate the change. ' +
      'Subject to the plugin permission policy (allowedPackages / allowTransportableEdits / allowedTransports).',
    parameters: {
      objectUri: { type: 'string', description: 'Exact ADT object URI (recommended, from search/read).' },
      name: { type: 'string', description: 'Object name (used with type when no objectUri).' },
      type: { type: 'string', description: 'Object type, e.g. CLAS, INTF, PROG, DDLS.' },
      packageName: {
        type: 'string',
        description: 'Optional package of the object (e.g. ZPACK_DEMO, $TMP); used for the permission check when the backend does not expose it.',
      },
      source: { type: 'string', required: true, description: 'Complete new source text of the object.' },
      unlock: { type: 'boolean', description: 'Unlock after writing (default true).' },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          uri: { type: 'string', required: true },
          name: { type: 'string', required: true },
          updated: { type: 'boolean', required: true },
          unlocked: { type: 'boolean' },
        },
      },
      render: (_args, value) =>
        text(`${value.name} (${value.uri}): source ${value.updated ? 'updated' : 'NOT updated'}${value.unlocked === false ? ' (still locked)' : ''}`),
    },
    execute: async (args) => {
      const entry = registry.require(destinationOf(args));
      const ref = await resolveObject(entry.client, {
        objectUri: typeof args.objectUri === 'string' ? args.objectUri : undefined,
        name: typeof args.name === 'string' ? args.name : undefined,
        type: typeof args.type === 'string' ? args.type : undefined,
      });
      // Permission check: package whitelist + transportable-edit rule.
      const packageName = await resolvePackageName(
        entry.client,
        ref,
        typeof args.packageName === 'string' ? args.packageName : undefined,
      );
      if (!packageName) {
        throw new AdtPolicyError(
          'allowedPackages',
          `adt_write_object: cannot determine the package of ${ref.name} for the permission check; ` +
            'pass `packageName` explicitly or read the object first',
        );
      }
      policy.assertEditAllowed(packageName, 'adt_write_object');

      const unlock = args.unlock !== false;
      let unlocked = false;
      const { handle, transport: assignedTransport } = await entry.client.lock(ref.uri);
      try {
        // The backend may auto-assign a transport request on lock (CORRNR);
        // it must be within allowedTransports or the edit is rolled back.
        policy.assertTransportUsage(assignedTransport, `adt_write_object (${ref.name})`);
        await entry.client.writeSource(ref.uri, String(args.source ?? ''), { lockHandle: handle });
        if (unlock) {
          await entry.client.unlock(ref.uri, handle).catch(() => undefined);
          unlocked = true;
        }
      } catch (error) {
        // Policy denial or write failure → always roll back the lock.
        await entry.client.unlock(ref.uri, handle).catch(() => undefined);
        unlocked = true;
        throw error;
      }
      return { uri: ref.uri, name: ref.name, updated: true, unlocked };
    },
  });

  const createObject = defineTool({
    name: 'adt_create_object',
    description:
      'Create a new ABAP development object on the SAP system: class (CLAS), interface (INTF), program (PROG), ' +
      'CDS view (DDLS), table (TABL), structure (STRU), message class (MSAG), function group (FUNC) or package (DEVC). ' +
      'Use package "$TMP" for local objects without transports.',
    parameters: {
      type: {
        type: 'string',
        required: true,
        enum: ['CLAS', 'INTF', 'PROG', 'DDLS', 'TABL', 'STRU', 'MSAG', 'FUNC', 'DEVC'],
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
    execute: async (args) => {
      const entry = registry.require(destinationOf(args));
      const packageName = String(args.packageName ?? '$TMP').toUpperCase();
      // Permission check: package whitelist + transportable-edit rule.
      policy.assertEditAllowed(packageName, 'adt_create_object');
      if (typeof args.transport === 'string' && args.transport.trim().length > 0) {
        policy.assertTransportsEnabled('adt_create_object');
        policy.assertTransportAllowed(args.transport.trim(), 'adt_create_object');
      }
      const result = await entry.client.createObject({
        destination: entry.config.name,
        type: String(args.type) as AdtCreatableObjectType,
        name: String(args.name),
        description: String(args.description ?? ''),
        packageName,
        transport: typeof args.transport === 'string' ? args.transport : undefined,
      });
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
      'Delete an ABAP development object from the system. Irreversible — prefer deactivation or transport-based removal when unsure. ' +
      'Subject to the plugin permission policy (allowedPackages / allowTransportableEdits).',
    parameters: {
      objectUri: { type: 'string', description: 'Exact ADT object URI.' },
      name: { type: 'string', description: 'Object name (with type).' },
      type: { type: 'string', description: 'Object type.' },
      packageName: {
        type: 'string',
        description: 'Optional package of the object; used for the permission check when the backend does not expose it.',
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
        },
      },
      render: (_args, value) => text(`${value.uri}: ${value.deleted ? 'deleted' : 'NOT deleted'}`),
    },
    execute: async (args) => {
      const entry = registry.require(destinationOf(args));
      const ref = await resolveObject(entry.client, {
        objectUri: typeof args.objectUri === 'string' ? args.objectUri : undefined,
        name: typeof args.name === 'string' ? args.name : undefined,
        type: typeof args.type === 'string' ? args.type : undefined,
      });
      const packageName = await resolvePackageName(
        entry.client,
        ref,
        typeof args.packageName === 'string' ? args.packageName : undefined,
      );
      if (!packageName) {
        throw new AdtPolicyError(
          'allowedPackages',
          `adt_delete_object: cannot determine the package of ${ref.name} for the permission check; ` +
            'pass `packageName` explicitly',
        );
      }
      policy.assertEditAllowed(packageName, 'adt_delete_object');
      await entry.client.deleteObject(ref.uri);
      return { uri: ref.uri, deleted: true };
    },
  });

  return [readObject, writeObject, createObject, deleteObject];
}
