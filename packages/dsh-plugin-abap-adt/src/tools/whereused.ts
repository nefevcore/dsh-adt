/**
 * adt_where_used — impact analysis: find objects that reference or depend on
 * a given ABAP object, before changing it. Read-only. Minimal ADT profiles
 * without the usageReferences collection degrade to an explicit note instead
 * of a raw 404/405.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { AdtError } from '@nefevcore/abap-adt-protocol';
import { DESTINATION_PARAM, destinationOf, text, type ToolDeps } from './common.js';
import { resolveObject } from '../resolve.js';

export function whereUsedTools(deps: ToolDeps) {
  const { registry } = deps;
  return [
    defineTool({
      name: 'adt_where_used',
      description:
        'Where-used / impact analysis: find objects that reference or depend on the given ABAP object ' +
        '(who calls it, instantiates it, implements it, uses it). Run this before changing an object to ' +
        'understand the blast radius. Read-only; uses the ADT usageReferences collection.',
    parameters: {
      objectUri: { type: 'string', description: 'Exact ADT object URI, e.g. /sap/bc/adt/oo/classes/zcl_demo.' },
      name: { type: 'string', description: 'Object name, e.g. ZCL_DEMO.' },
      type: { type: 'string', description: 'Object type (short or ADT form), e.g. CLAS, INTF, PROG.' },
      enableAllTypes: {
        type: 'boolean',
        description: 'Expand the search to all object types (Eclipse "select all"). Default false (SAP default scope); can be much slower.',
      },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          objectUri: { type: 'string', required: true },
          totalReferences: { type: 'integer', required: true },
          note: { type: 'string' },
          references: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,

              properties: {
                name: { type: 'string', required: true },
                type: { type: 'string', required: true },
                uri: { type: 'string', required: true },
                packageName: { type: 'string' },
                responsible: { type: 'string' },
                usageInformation: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) => {
        const lines = [
          `Where-used of ${value.objectUri}: ${value.totalReferences} reference(s)`,
          ...(value.note ? [`Note: ${value.note}`] : []),
          ...value.references.map(
            (r) => `- ${r.name} (${r.type}) ${r.packageName ? `in ${r.packageName}` : ''}${r.usageInformation ? ` — ${r.usageInformation}` : ''}`,
          ),
        ];
        return text(lines.join('\n'));
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
      try {
        const result = await entry.client.getWhereUsed(ref.uri, { enableAllTypes: args.enableAllTypes === true, signal: exec.signal });
        return {
          objectUri: ref.uri,
          totalReferences: result.totalReferences,
          references: result.references,
        };
      } catch (error) {
        if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
          return {
            objectUri: ref.uri,
            totalReferences: 0,
            references: [],
            note: `where-used (usageReferences) is not available on this backend (HTTP ${error.status}); ` +
              'analyse dependencies via adt_search / adt_package_content instead',
          };
        }
        throw error;
      }
    },
    }),
  ];
}
