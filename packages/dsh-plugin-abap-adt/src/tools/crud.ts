/**
 * adt_crud — the compact verb×type facade over the CRUD matrix
 * (src/crudmatrix.ts, the single source of truth). One tool routes
 * create/read/update/delete per object type to the OWNING dedicated tool:
 * the owner runs unchanged, so its full chain (permission policy per
 * destination, OCC snapshot verification, post-write persistence checks,
 * transport policing) applies exactly as on a direct call — the facade adds
 * NO second implementation and therefore NO policy bypass.
 *
 * Adopted from abap-mcp's compact facade (Handler verb × object_type) with
 * vsp's routing lessons: a claimed route never answers bare "no handler" —
 * unsupported verb×type names what IS supported; a call without `verb`
 * returns the matrix status card instead of an error.
 *
 * The advanced flows stay with the dedicated tools (method surgery,
 * dependency-context reads, block edits, local snapshots/push) — `routedTool`
 * in every answer names the tool that ran, so the facade doubles as a
 * discovery path to them.
 */
import { defineTool } from '../tooldef.js';
import {
  crudCell,
  crudObjectTypes,
  crudUnsupportedMessage,
  crudVerbsFor,
  CRUD_VERBS,
  type CrudVerb,
} from '../crudmatrix.js';
import { DESTINATION_PARAM, optStr, text, type ToolDeps } from './common.js';

/** The minimal shape the facade needs from a registered tool. */
export interface RoutableTool {
  name: string;
  /** `never` parameters: accepts every concrete tool signature (contravariance). */
  execute: (args: never, exec: never) => Promise<unknown>;
}

export function crudTools(deps: ToolDeps, tools: Map<string, RoutableTool>) {
  void deps; // (owners carry their own deps; the facade only routes)

  const owner = (name: string): RoutableTool => {
    const tool = tools.get(name);
    if (!tool) {
      throw new Error(
        `adt_crud: the matrix routes to '${name}' but that tool is not registered — ` +
          'the CRUD matrix and the tool catalog drifted (see src/crudmatrix.ts)',
      );
    }
    return tool;
  };

  /** Verb-specific required-argument checks (the facade's schema is a union). */
  function assertVerbArgs(verb: CrudVerb, args: Record<string, unknown>): void {
    const name = optStr(args.name) ?? optStr(args.objectUri);
    if (!name) throw new Error(`adt_crud: ${verb} requires the object reference (name or objectUri)`);
    if (verb === 'create') {
      if (!optStr(args.description)) throw new Error('adt_crud: create requires `description`');
      if (!optStr(args.packageName)) throw new Error('adt_crud: create requires `packageName` (use $TMP for local objects)');
    }
    if (verb === 'update') {
      const hasSource = optStr(args.source) !== undefined || optStr(args.sourceFile) !== undefined;
      const hasChanges =
        args.changes !== undefined || args.properties !== undefined || args.messages !== undefined ||
        args.fixedValues !== undefined || args.labels !== undefined || optStr(args.description) !== undefined;
      if (!hasSource && !hasChanges) {
        throw new Error(
          'adt_crud: update requires either `source`/`sourceFile` (source objects) or the structured ' +
            'patch fields (description/properties/messages/fixedValues/labels — DOMA/DTEL/TTYP/MSAG)',
        );
      }
    }
  }

  return [
    defineTool({
      name: 'adt_crud',
      description:
        'Create / read / update / delete ABAP development objects through ONE verb-routed tool: pass `verb` + ' +
        '`type` + the object reference, and the call routes to the dedicated tool that owns that verb×type ' +
        '(same permission policy, conflict checks and persistence verification as a direct call — `routedTool` ' +
        'in the answer names it). Types: CLAS, INTF, PROG (+INCL includes), FUNC, DDLS, TABL (create takes ' +
        '`fields` for the one-step DDL flow), STRU, DOMA, DTEL, TTYP, MSAG (read/update = structured editors), ' +
        'DEVC (read = package content). Calling without `verb` returns the full capability matrix. Advanced ' +
        'flows (method surgery, block edits, context reads, local snapshots) stay with the dedicated tools.',
      parameters: {
        verb: {
          type: 'string',
          enum: [...CRUD_VERBS],
          description: 'create | read | update | delete. Omit to get the capability matrix card.',
        },
        type: {
          type: 'string',
          description: `Object type (short code): ${crudObjectTypes().join(', ')}.`,
        },
        name: { type: 'string', description: 'Object name, e.g. ZCL_DEMO (or objectUri for exact references).' },
        objectUri: { type: 'string', description: 'Exact ADT object URI (alternative to name).' },
        // create
        description: { type: 'string', description: 'create: short object description (required).' },
        packageName: { type: 'string', description: 'create: target package, $TMP for local objects (required).' },
        transport: { type: 'string', description: 'create/update/delete: transport request number.' },
        fields: {
          type: 'array',
          description: 'create TABL: field list for the one-step DDL flow (see adt_create_object).',
          items: { type: 'object', additionalProperties: true },
        },
        deliveryClass: { type: 'string', description: 'create TABL: delivery class (default A).' },
        tableCategory: { type: 'string', description: 'create TABL: TRANSPARENT (default) / STRUCTURE / CLUSTER / POOL.' },
        // update (source objects)
        source: { type: 'string', description: 'update (source objects): the full new source.' },
        sourceFile: { type: 'string', description: 'update (source objects): local file with the new source.' },
        activate: { type: 'boolean', description: 'create/update: activate in the same call (TABL create always activates).' },
        // update (structured editors)
        properties: { type: 'object', additionalProperties: true, description: 'update DOMA/DTEL/TTYP: property patch.' },
        messages: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'update MSAG: full message list (missing numbers are deleted).' },
        fixedValues: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'update DOMA: fixed-value list (full replacement).' },
        labels: { type: 'object', additionalProperties: true, description: 'update DTEL: label patch.' },
        ...DESTINATION_PARAM,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            routedTool: { type: 'string', required: true, description: 'The dedicated tool that executed the call.' },
            verb: { type: 'string', description: 'Present on routed calls.' },
            type: { type: 'string', description: 'Present on routed calls.' },
            matrix: { type: 'string', description: 'Present on the no-verb status card: the rendered capability matrix.' },
          },
        },
        render: (_args, value) => {
          if (value.matrix) {
            return text(
              [
                'adt_crud capability matrix (verb × type; every cell routes to the owning tool):',
                '',
                value.matrix,
                '',
                'Unsupported cells (—) fail with guidance when requested. Advanced flows: adt_edit_object ' +
                  '(block/method surgery), adt_read_object {context|method}, adt_push_object (local snapshots).',
              ].join('\n'),
            );
          }
          const summary =
            typeof value.source === 'string'
              ? `${(value.source as string).split('\n').length} source line(s)`
              : value.success === true
                ? 'ok'
                : value.deleted === true
                  ? 'deleted'
                  : 'done';
          return text(`adt_crud ${value.verb} ${value.type ?? ''} → ran via ${value.routedTool}: ${summary}`);
        },
      },
      // Mutating verbs exist → not concurrency-safe.
      isConcurrencySafe: () => false,
      execute: async (args, exec) => {
        // No-verb call: the status card (vsp lesson — never a bare error).
        const verb = optStr(args.verb) as CrudVerb | undefined;
        if (!verb) {
          return { matrix: renderMatrixForCard(), routedTool: 'adt_crud (status card)' } as never;
        }
        if (!CRUD_VERBS.includes(verb)) {
          throw new Error(`adt_crud: unknown verb '${verb}' (${CRUD_VERBS.join(', ')}, or omit verb for the matrix card)`);
        }
        const type = optStr(args.type);
        if (!type) throw new Error(`adt_crud: ${verb} requires \`type\` (${crudObjectTypes().join(', ')})`);
        const cell = crudCell(verb, type);
        if (!cell) throw new Error(crudUnsupportedMessage(verb, type));
        assertVerbArgs(verb, args);

        // Route: forward everything except the facade's own `verb` key; the
        // owner's execute performs the real work under its full policy chain.
        // (`as never`: the owner's schema-inferred output type is not nameable
        // here — the facade's loose schema permits the passthrough shape.)
        const forwarded: Record<string, unknown> = { ...args };
        delete forwarded.verb;
        if (cell.mode === 'packageContent') {
          // adt_package_content addresses the package by `packageName`, not by
          // an object reference — adapt the facade's `name`.
          forwarded.packageName = optStr(args.name) ?? optStr(args.packageName);
          delete forwarded.name;
          delete forwarded.objectUri;
        }
        const tool = owner(cell.tool);
        const result = (await tool.execute(forwarded as never, exec as never)) as Record<string, unknown>;
        return { ...result, routedTool: cell.tool, verb, type: type.toUpperCase() } as never;
      },
    }),
  ];
}

/** The status-card matrix (compact render of crudmatrix.ts). */
function renderMatrixForCard(): string {
  const rows = crudObjectTypes().map((type) => {
    const verbs = crudVerbsFor(type);
    return `- ${type}: ${verbs.join(', ')}`;
  });
  return rows.join('\n');
}
