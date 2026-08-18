import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, text, type ToolDeps } from './common.js';
import { resolveObjects, resolvePackageName, typeLabel } from '../resolve.js';
import { AdtPolicyError } from '../policy.js';
import type { AdtObjectRef } from '@nefevcore/abap-adt-protocol';

export function lifecycleTools(deps: ToolDeps) {
  const { registry, policy } = deps;

  const objectListParam = {
    objects: {
      type: 'array',
      required: true,
      description: 'Objects to process. Each entry: {objectUri} or {name, type}.',
      items: {
        type: 'object',
        additionalProperties: false,

        properties: {
          objectUri: { type: 'string', description: 'Exact ADT object URI.' },
          name: { type: 'string', required: true, description: 'Object name.' },
          type: { type: 'string', description: 'Object type, e.g. CLAS, PROG, DDLS.' },
          packageName: {
            type: 'string',
            description: 'Optional package of the object; used for the permission check when the backend does not expose it.',
          },
        },
      },
    },
  } as const;

  const activationOutput = {
    schema: {
      type: 'object',
      additionalProperties: false,

      properties: {
        success: { type: 'boolean', required: true },
        items: {
          type: 'array',
          required: true,
          items: {
            type: 'object',
            additionalProperties: false,

            properties: {
              name: { type: 'string', required: true },
              type: { type: 'string', required: true },
              status: { type: 'string', required: true },
              message: { type: 'string' },
              errors: {
                type: 'array',
                required: true,
                items: {
                  type: 'object',
                  additionalProperties: false,

                  properties: {
                    text: { type: 'string', required: true },
                    line: { type: 'integer' },
                    code: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    render: (_args: unknown, value: { success: boolean; items: Array<{ name: string; type: string; status: string; message?: string; errors: Array<{ text: string; line?: number; code?: string }> }> }) =>
      text(
        [
          value.success ? 'ACTIVATION SUCCESSFUL' : 'ACTIVATION FAILED',
          ...value.items.map((item) => {
            const lines = [`- ${item.name} [${typeLabel(item.type)}]: ${item.status}`];
            if (item.message) lines.push(`  ${item.message}`);
            for (const e of item.errors) {
              lines.push(`  ERROR${e.line ? ` at line ${e.line}` : ''}${e.code ? ` (${e.code})` : ''}: ${e.text}`);
            }
            return lines.join('\n');
          }),
        ].join('\n'),
      ),
  } as const;

  const activate = defineTool({
    name: 'adt_activate',
    description:
      'Activate ABAP development objects on the system. Returns per-object status; syntax errors block activation. ' +
      'Pass `transport` when the objects\' package requires a transport request (see adt_list_transports).',
    parameters: {
      ...objectListParam,
      transport: { type: 'string', description: 'Transport request number, e.g. S4HK900001.' },
      checkOnly: { type: 'boolean', description: 'Syntax-check without activating (default false).' },
      ...DESTINATION_PARAM,
    },
    output: activationOutput,
    execute: async (args) => {
      const entry = registry.require(destinationOf(args));
      const checkOnly = args.checkOnly === true;
      const refs: AdtObjectRef[] = await resolveObjects(
        entry.client,
        args.objects as Array<{ objectUri?: string; name: string; type?: string; packageName?: string }>,
      );

      // Permission checks. checkOnly (syntax pre-audit) changes nothing and is
      // always allowed; a real activation is an edit and must satisfy the
      // policy for every object.
      if (!checkOnly) {
        if (typeof args.transport === 'string' && args.transport.trim().length > 0) {
          policy.assertTransportsEnabled('adt_activate');
          policy.assertTransportAllowed(args.transport.trim(), 'adt_activate');
        }
        const inputs = args.objects as Array<{ objectUri?: string; name: string; type?: string; packageName?: string }>;
        for (let i = 0; i < refs.length; i++) {
          const ref = refs[i]!;
          const hint = inputs[i]?.packageName;
          const packageName = await resolvePackageName(entry.client, ref, hint);
          if (!packageName) {
            throw new AdtPolicyError(
              'allowedPackages',
              `adt_activate: cannot determine the package of ${ref.name} for the permission check; ` +
                'pass `packageName` on the object entry or read the object first',
            );
          }
          policy.assertEditAllowed(packageName, `adt_activate (${ref.name})`);
        }
      } else if (typeof args.transport === 'string' && args.transport.trim().length > 0) {
        policy.assertTransportsEnabled('adt_activate');
        policy.assertTransportAllowed(args.transport.trim(), 'adt_activate');
      }

      const result = await entry.client.activate(refs, {
        transport: typeof args.transport === 'string' ? args.transport : undefined,
        checkOnly,
      });
      return {
        success: result.success,
        items: result.items.map((i) => ({
          name: i.name,
          type: i.type,
          status: i.status,
          message: i.message,
          errors: i.syntaxErrors.map((e) => ({
            text: e.text,
            line: e.line,
            code: e.code,
          })),
        })),
      };
    },
  });

  const check = defineTool({
    name: 'adt_check',
    description:
      'Run a syntax check (without activating) on ABAP objects. Reports per-object errors/warnings.',
    parameters: {
      ...objectListParam,
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          success: { type: 'boolean', required: true },
          messages: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,

              properties: {
                severity: { type: 'string', required: true },
                text: { type: 'string', required: true },
                line: { type: 'integer' },
                code: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) =>
        text(
          [
            value.success ? 'CHECK PASSED' : 'CHECK FAILED',
            ...value.messages.map((m) => `  ${m.severity}${m.line ? `:${m.line}` : ''}: ${m.text}`),
          ].join('\n'),
        ),
    },
    execute: async (args) => {
      const entry = registry.require(destinationOf(args));
      const refs = await resolveObjects(entry.client, args.objects as Array<{ objectUri?: string; name: string; type?: string }>);
      const result = await entry.client.check(refs);
      return {
        success: result.success,
        messages: result.messages.map((m) => ({
          severity: m.severity,
          text: m.text,
          line: m.line,
          code: m.code,
        })),
      };
    },
  });

  return [activate, check];
}
