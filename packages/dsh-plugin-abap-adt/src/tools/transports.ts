import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text, type ToolDeps } from './common.js';

export function transportTools(deps: ToolDeps) {
  const { registry } = deps;

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
    render: (_args: unknown, value: { transports: Array<{ number: string; description: string; status: string; category: string; owner: string; modifiable: boolean; items?: Array<{ name: string; type: string; action: string }> }> }) =>
      text(
        [
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
        ].join('\n'),
      ),
  } as const;

  const listTransports = defineTool({
    name: 'adt_list_transports',
    description:
      'List transport requests (CTO) of the current user: number, status, category, owner and (optionally) contained objects. ' +
      'Useful before activation or release operations.',
    parameters: {
      allUsers: { type: 'boolean', description: 'List transports of all users (default false).' },
      ...DESTINATION_PARAM,
    },
    output: transportOutput,
    execute: async (args) => {
      const entry = registry.require(destinationOf(args));
      const transports = await entry.client.listTransports({ allUsers: args.allUsers === true });
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
      render: (_args, value) =>
        text(
          [
            `${value.number} [${value.status}] ${value.category} ${value.owner}: ${value.description} (${value.system}/${value.client})`,
            ...value.items.map((i) => `  ${i.action} ${i.name} (${i.type}) — ${i.description ?? ''}`),
          ].join('\n'),
        ),
    },
    execute: async (args) => {
      const entry = registry.require(destinationOf(args));
      const t = await entry.client.getTransport(String(args.number));
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

  const releaseTransport = defineTool({
    name: 'adt_release_transport',
    description:
      'Release a transport request, moving its objects to the next system in the transport route. ' +
      'Irreversible within a system — double-check the request contents first.',
    parameters: {
      number: { type: 'string', required: true, description: 'Transport request number to release.' },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          number: { type: 'string', required: true },
          released: { type: 'boolean', required: true },
          status: { type: 'string' },
        },
      },
      render: (_args, value) => text(`${value.number}: ${value.released ? 'released' : 'release failed'}${value.status ? ` (status ${value.status})` : ''}`),
    },
    execute: async (args) => {
      const entry = registry.require(destinationOf(args));
      const t = await entry.client.releaseTransport(String(args.number));
      return { number: t.number, released: !t.modifiable, status: t.status };
    },
  });

  return [listTransports, getTransport, releaseTransport];
}
