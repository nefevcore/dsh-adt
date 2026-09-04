/**
 * adt_read_textelements — read the text elements of a program via the
 * STANDARD ADT textelements subsources (no Z components): text symbols (I),
 * selection texts (S) and list headings (H), returned as classic textpool
 * rows (ID/KEY/ENTRY/LENGTH). Write side deliberately deferred until the PUT
 * format is verified on a real system (plan P1-3).
 */
import { defineTool } from '../tooldef.js';
import {
  sessionCwd,
  DESTINATION_PARAM,
  destinationOf,
  optStr,
  resolveToolObject,
  text,
  type ToolDeps,
} from './common.js';

export function textElementTools(deps: ToolDeps) {
  const { registry } = deps;

  return [
    defineTool({
      name: 'adt_read_textelements',
      description:
        'Read the text elements of an ABAP program (PROG/REPT, SE38 selection-screen texts): text symbols (I, ' +
        'key 001/002… with max length), selection texts (S, parameter/select-option names) and list headings ' +
        '(H, listHeader/columnHeader_N). Standard ADT endpoint, read-only, no server-side components. Rows use ' +
        'the classic textpool shape ID/KEY/ENTRY/LENGTH — the same table READ TEXTPOOL returns. Changing text ' +
        'elements is not supported yet; edit via SE32/SE38 or a transport in the meantime.',
      parameters: {
        name: { type: 'string', required: true, description: 'Program name, e.g. ZPROG_DEMO (main program — includes live on their main program).' },
        type: { type: 'string', description: 'Object type (PROG or REPT; default PROG).' },
        ...DESTINATION_PARAM,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            program: { type: 'string', required: true },
            elements: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string', required: true, description: 'I = text symbol, S = selection text, H = list heading.' },
                  key: { type: 'string', required: true },
                  entry: { type: 'string', required: true },
                  length: { type: 'integer', description: 'Max length (text symbols).' },
                },
              },
            },
            counts: {
              type: 'object',
              required: true,
              additionalProperties: false,
              properties: {
                symbols: { type: 'integer', required: true },
                selections: { type: 'integer', required: true },
                headings: { type: 'integer', required: true },
              },
            },
            note: { type: 'string' },
          },
        },
        render: (_args, value) => {
          const lines = [`text elements of ${value.program}: ${value.counts.symbols} symbol(s), ${value.counts.selections} selection(s), ${value.counts.headings} heading(s)`];
          for (const e of value.elements) {
            lines.push(`- [${e.id}] ${e.key} = ${e.entry}${e.length ? ` (max ${e.length})` : ''}`);
          }
          if (value.note) lines.push(`Note: ${value.note}`);
          return text(lines.join('\n'));
        },
      },
      isConcurrencySafe: () => true,
      execute: async (args, exec) => {
        const entry = await registry.require(destinationOf(args), sessionCwd(exec));
        const type = (optStr(args.type) ?? 'PROG').toUpperCase();
        if (type !== 'PROG' && type !== 'REPT') {
          throw new Error(`adt_read_textelements: type must be PROG or REPT (got '${type}')`);
        }
        // Resolve the object (catches typos; includes point at their program).
        const ref = await resolveToolObject(entry.client, args, exec.signal);
        const result = await entry.client.readTextElements(ref.name, { signal: exec.signal });
        const note =
          result.counts.symbols + result.counts.selections + result.counts.headings === 0
            ? 'no text elements found (truthful for a program that defines none) — or the backend does not expose the textelements service for it'
            : undefined;
        return { program: result.program, elements: result.elements, counts: result.counts, note };
      },
    }),
  ];
}
