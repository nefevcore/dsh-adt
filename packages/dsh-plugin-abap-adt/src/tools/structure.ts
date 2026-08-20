/**
 * Structured object editor tools — read/write the DDIC metadata objects whose
 * content is NOT plain source text but a structured XML document:
 *
 *   MSAG  message classes (message number → text list)
 *   DOMA  domains (technical properties + fixed values)
 *   DTEL  data elements (type reference + labels)
 *   TTYP  table types (row type, access type, key)
 *
 * `adt_read_structure` parses the metadata XML into typed JSON; `adt_write_structure`
 * applies typed CHANGES via read-modify-write (lock → GET → patch only the
 * provided fields → PUT → unlock), so unknown SAP-managed attributes survive
 * round-trips. Editing these objects through adt_write_object is impossible —
 * they have no `/source/main` — these two tools close that gap.
 *
 * Writes go through the same permission gates as every edit (package
 * whitelist, transport policy incl. backend-assigned CORRNR rollback).
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import {
  AdtError,
  type AdtStructureChanges,
  type AdtStructureKind,
} from '@nefevcore/abap-adt-protocol';
import {
  DESTINATION_PARAM,
  OBJECT_REF_PARAMS,
  PACKAGE_HINT_PARAM,
  assertObjectEditable,
  destinationOf,
  objectRefArgs,
  optStr,
  resolveToolObject,
  text,
  type ToolDeps,
} from './common.js';

const KINDS: AdtStructureKind[] = ['MSAG', 'DOMA', 'DTEL', 'TTYP'];

const KIND_DESCRIPTIONS: Record<AdtStructureKind, string> = {
  MSAG: 'messages: [{number, text, selfExplanatory}] — full replacement list (absent numbers are deleted)',
  DOMA: 'properties {datatype,length,decimals,conversionExit,signExists,lowercase,valueTable} + fixedValues: [{low,high,description}] (full replacement)',
  DTEL: 'properties {typeKind,typeName,dataType,dataTypeLength,dataTypeDecimals} + labels {shortText,mediumText,longText,heading}',
  TTYP: 'properties {typeKind,typeName,accessType,keyDefinition,keyKind}',
};

/** Render a parsed structure generically (kind-aware). */
function renderStructure(data: {
  kind: string;
  name: string;
  description?: string;
  packageName?: string;
} & Record<string, unknown>): string[] {
  const lines = [`${data.kind} ${data.name}${data.description ? ` — ${data.description}` : ''}`];
  if (data.packageName) lines.push(`package: ${String(data.packageName)}`);
  if (data.kind === 'MSAG') {
    const messages = (data.messages as Array<{ number: string; text: string }>) ?? [];
    lines.push(`messages (${messages.length}):`);
    for (const m of messages) lines.push(`  ${m.number}: ${m.text}`);
  } else {
    const props = (data.properties as Record<string, string>) ?? {};
    lines.push(`properties: ${Object.entries(props).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}`);
    if (data.kind === 'DOMA') {
      const fixed = (data.fixedValues as Array<{ low: string; description?: string }>) ?? [];
      lines.push(`fixedValues (${fixed.length}): ${fixed.map((f) => `${f.low}${f.description ? ` (${f.description})` : ''}`).join(', ')}`);
    }
    if (data.kind === 'DTEL') {
      const labels = (data.labels as Record<string, string>) ?? {};
      lines.push(`labels: ${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(', ') || '(none)'}`);
    }
  }
  return lines;
}

/** Output shape shared by both structure tools (matches the JSON schemas). */
interface StructureOutput {
  kind: string;
  name: string;
  description?: string;
  packageName?: string;
  messages?: Array<Record<string, string | boolean>>;
  properties?: Record<string, string>;
  fixedValues?: Array<Record<string, string>>;
  labels?: Record<string, string>;
}

/** Map a parsed structure to a plain JSON object matching the tool's output schema. */
function structureToOutput(data: import('@nefevcore/abap-adt-protocol').AdtStructureData): StructureOutput {
  const out: StructureOutput = {
    kind: data.kind,
    name: data.name,
    description: data.description,
    packageName: data.packageName,
  };
  if (data.kind === 'MSAG') {
    out.messages = data.messages.map((m) => {
      const message: Record<string, string | boolean> = { number: m.number, text: m.text };
      if (m.selfExplanatory !== undefined) message.selfExplanatory = m.selfExplanatory;
      return message;
    });
  } else if (data.kind === 'DOMA') {
    out.properties = { ...data.properties };
    out.fixedValues = data.fixedValues.map((f) => {
      const fixed: Record<string, string> = { low: f.low };
      if (f.high !== undefined) fixed.high = f.high;
      if (f.description !== undefined) fixed.description = f.description;
      return fixed;
    });
  } else if (data.kind === 'DTEL') {
    out.properties = { ...data.properties };
    out.labels = { ...data.labels };
  } else {
    out.properties = { ...data.properties };
  }
  return out;
}

export function structureTools(deps: ToolDeps) {
  const { registry } = deps;

  const readStructure = defineTool({
    name: 'adt_read_structure',
    description:
      'Read the STRUCTURED metadata of a DDIC object as typed JSON — use this (not adt_read_object) for ' +
      'message classes (MSAG), domains (DOMA), data elements (DTEL) and table types (TTYP): their content ' +
      'is metadata, not source code. Returns messages / properties / fixedValues / labels depending on kind. ' +
      'Read-only.',
    parameters: {
      ...OBJECT_REF_PARAMS,
      kind: {
        type: 'string',
        enum: KINDS,
        description: 'Structured editor kind (default: derived from the object type code).',
      },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          kind: { type: 'string', required: true },
          name: { type: 'string', required: true },
          description: { type: 'string' },
          packageName: { type: 'string' },
          messages: { type: 'array', items: { type: 'object', additionalProperties: true } },
          properties: { type: 'object', additionalProperties: true },
          fixedValues: { type: 'array', items: { type: 'object', additionalProperties: true } },
          labels: { type: 'object', additionalProperties: true },
        },
      },
      render: (_args, value) => text(renderStructure(value as never).join('\n')),
    },
    isConcurrencySafe: () => true,
    execute: async (args, exec) => {
      const entry = registry.require(destinationOf(args));
      const ref = await resolveToolObject(entry.client, args, exec.signal);
      const explicit = optStr(args.kind) as AdtStructureKind | undefined;
      const kind = explicit && KINDS.includes(explicit) ? explicit : (ref.type.split('/')[0] as AdtStructureKind);
      if (!KINDS.includes(kind)) {
        throw new Error(
          `adt_read_structure: ${ref.name} is a ${ref.type} — structured editors exist for ${KINDS.join(', ')} only ` +
            '(use adt_read_object for source objects)',
        );
      }
      let data;
      try {
        data = await entry.client.readStructure(ref.uri, kind, { signal: exec.signal });
      } catch (error) {
        if (error instanceof AdtError && (error.status === 404 || error.status === 405 || error.status === 406)) {
          throw new Error(
            `adt_read_structure: ${kind} editor not available for ${ref.name} on destination ` +
              `'${entry.config.name}' (HTTP ${error.status}). Check the type code — or the object may not exist.`,
          );
        }
        throw error;
      }
      return structureToOutput(data);
    },
  });

  const writeStructure = defineTool({
    name: 'adt_write_structure',
    description:
      'Change the STRUCTURED metadata of a DDIC object (message classes/domains/data elements/table ' +
      'types) — the counterpart of adt_write_object for objects that have no source code. Provide ONLY ' +
      'the fields to change; everything else round-trips untouched (read-modify-write under a lock). ' +
      'Subject to the same permission policy as every edit. Structure per kind — ' +
      `MSAG: ${KIND_DESCRIPTIONS.MSAG}; DOMA: ${KIND_DESCRIPTIONS.DOMA}; ` +
      `DTEL: ${KIND_DESCRIPTIONS.DTEL}; TTYP: ${KIND_DESCRIPTIONS.TTYP}.`,
    parameters: {
      ...OBJECT_REF_PARAMS,
      kind: {
        type: 'string',
        enum: KINDS,
        description: 'Structured editor kind (default: derived from the object type code).',
      },
      description: { type: 'string', description: 'New short description (all kinds).' },
      messages: {
        type: 'array',
        description: `MSAG only: ${KIND_DESCRIPTIONS.MSAG}.`,
        items: {
          type: 'object',
          additionalProperties: false,

          properties: {
            number: { type: 'string', required: true, description: "Message number '001'…'999'." },
            text: { type: 'string', required: true, description: 'Message text (may contain &1 placeholders).' },
            selfExplanatory: { type: 'boolean' },
          },
        },
      },
      properties: {
        type: 'object',
        description: 'DOMA/DTEL/TTYP: scalar technical properties to patch (only provided keys change).',
        additionalProperties: true,
      },
      fixedValues: {
        type: 'array',
        description: `DOMA only: ${KIND_DESCRIPTIONS.DOMA}.`,
        items: {
          type: 'object',
          additionalProperties: false,

          properties: {
            low: { type: 'string', required: true },
            high: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
      labels: {
        type: 'object',
        description: `DTEL only: ${KIND_DESCRIPTIONS.DTEL}.`,
        additionalProperties: true,
      },
      transport: { type: 'string', description: 'Transport request number (when the backend requires one).' },
      ...PACKAGE_HINT_PARAM,
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          name: { type: 'string', required: true },
          kind: { type: 'string', required: true },
          changed: { type: 'array', required: true, items: { type: 'string' }, description: 'Fields that were applied.' },
          transport: { type: 'string' },
          data: {
            type: 'object',
            required: true,
            additionalProperties: false,

            description: 'Effective structure after the write.',
            properties: {
              kind: { type: 'string', required: true },
              name: { type: 'string', required: true },
              description: { type: 'string' },
              packageName: { type: 'string' },
              messages: { type: 'array', items: { type: 'object', additionalProperties: true } },
              properties: { type: 'object', additionalProperties: true },
              fixedValues: { type: 'array', items: { type: 'object', additionalProperties: true } },
              labels: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
      render: (_args, value) =>
        text([`${value.name} (${value.kind}) updated${value.transport ? ` [transport ${value.transport}]` : ''}:`, `  changed: ${value.changed.join(', ') || '(nothing)'}`, '', ...renderStructure(value.data as never)].join('\n')),
    },
    timeoutMs: 180_000,
    execute: async (args, exec) => {
      const entry = registry.require(destinationOf(args));
      const ref = await resolveToolObject(entry.client, args, exec.signal);
      const explicit = optStr(args.kind) as AdtStructureKind | undefined;
      const kind = explicit && KINDS.includes(explicit) ? explicit : (ref.type.split('/')[0] as AdtStructureKind);
      if (!KINDS.includes(kind)) {
        throw new Error(
          `adt_write_structure: ${ref.name} is a ${ref.type} — structured editors exist for ${KINDS.join(', ')} only`,
        );
      }

      // Same permission gates as adt_write_object: package whitelist first,
      // then transport policy inside the lock (with rollback on mismatch).
      await assertObjectEditable(entry, ref, {
        toolName: 'adt_write_structure',
        packageHint: optStr(args.packageName),
        signal: exec.signal,
      });
      const transport = optStr(args.transport);
      if (transport) {
        entry.policy.assertTransportsEnabled('adt_write_structure');
        entry.policy.assertTransportAllowed(transport, 'adt_write_structure');
      }

      const changes: AdtStructureChanges = {};
      const changed: string[] = [];
      if (optStr(args.description) !== undefined) {
        changes.description = String(args.description);
        changed.push('description');
      }
      if (kind === 'MSAG' && Array.isArray(args.messages)) {
        changes.messages = (args.messages as Array<{ number: string; text: string; selfExplanatory?: boolean }>).map(
          (m) => ({ number: String(m.number), text: String(m.text), selfExplanatory: m.selfExplanatory }),
        );
        changed.push(`messages(${changes.messages.length})`);
      }
      if (args.properties && typeof args.properties === 'object') {
        changes.properties = args.properties as Record<string, string | number | boolean>;
        changed.push(`properties(${Object.keys(changes.properties).join('+')})`);
      }
      if (kind === 'DOMA' && Array.isArray(args.fixedValues)) {
        changes.fixedValues = args.fixedValues as Array<{ low: string; high?: string; description?: string }>;
        changed.push(`fixedValues(${changes.fixedValues.length})`);
      }
      if (kind === 'DTEL' && args.labels && typeof args.labels === 'object') {
        changes.labels = args.labels as Record<string, string>;
        changed.push(`labels(${Object.keys(changes.labels).join('+')})`);
      }
      if (changed.length === 0) {
        throw new Error(`adt_write_structure: nothing to change — provide description/messages/properties/fixedValues/labels for this ${kind}`);
      }

      const result = await entry.client.writeStructure(ref.uri, kind, changes, {
        transport,
        onLocked: (assigned) => {
          // Backend-assigned CORRNR must pass the transport policy too; a
          // throw here rolls the lock back before anything is written.
          entry.policy.assertTransportUsage(assigned ?? transport, 'adt_write_structure');
        },
        signal: exec.signal,
      });
      return {
        name: ref.name,
        kind,
        changed,
        transport: result.transport,
        data: structureToOutput(result.data),
      };
    },
  });

  return [readStructure, writeStructure];
}
