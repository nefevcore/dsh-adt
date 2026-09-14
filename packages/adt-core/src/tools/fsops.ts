/**
 * The four fs_ops tools — `adt_object_write` / `adt_object_read` /
 * `adt_object_edit` / `adt_object_delete` (docs/ddic-fsops-matrix-plan.md §1).
 *
 * Signature for all four: `(type, name, args)` — the AGENT NEVER PASSES
 * ENDPOINTS (no `objectUri` parameter by design; §2 principle 1). The
 * tools resolve `(type, name)` to an object reference through the same
 * resolve chain the owner tools use.
 *
 * SKELETON STATE (framework commit): the matrix (fsmatrix.ts) and the
 * registry (typeregistry.ts) are the skeleton; per-type engines are
 * filled in by the following commits. What runs TODAY:
 *
 *   - `adt_object_read` without `name` → the matrix card (this is a
 *     committed surface, not a placeholder).
 *   - every yes-cell that maps 1:1 onto an existing registered tool is
 *     ROUTED to it (the same no-second-implementation rule as adt_crud:
 *     the owner's full policy/OCC/lock/persistence chain applies; the
 *     answer names `via` + the owner's own output).
 *   - non-yes cells refuse with the matrix's own honest message (never
 *     a silent no-op, never a bare "no handler").
 *
 * Cells still waiting for their engine commit refuse with a
 * framework-pending message derived from the matrix — they cannot
 * silently degrade.
 */
import { defineTool } from '../tooldef.js';
import {
  fsCell,
  fsObjectTypes,
  fsUnsupportedMessage,
  renderFsMatrixCard,
  type FsVerb,
} from '../fsmatrix.js';
import { typeRegistryRow } from '../typeregistry.js';
import { DESTINATION_PARAM, optStr, text, type ToolDeps } from './common.js';
import type { RoutableTool } from './crud.js';

/** Per-(verb, via) engine router — one per landed engine. */
type EngineRouter = (args: Record<string, unknown>, exec: unknown) => Promise<Record<string, unknown>>;

export function fsOpsTools(deps: ToolDeps, tools: Map<string, RoutableTool>) {
  void deps; // engines carry their own deps; the facade only routes

  const owner = (name: string): RoutableTool => {
    const tool = tools.get(name);
    if (!tool) {
      throw new Error(
        `adt_object_*: the matrix routes to '${name}' but that tool is not registered — ` +
          'the fs matrix and the tool catalog drifted (see src/fsmatrix.ts / src/typeregistry.ts)',
      );
    }
    return tool;
  };

  // -------------------------------------------------------------------------
  // Engine routing — yes-cells of the CURRENT phase, by `via`.
  // Engines not yet implemented throw frameworkPending (their cells stay
  // honest: the message says the framework landed but the engine did not).
  // -------------------------------------------------------------------------

  const frameworkPending = (verb: FsVerb, type: string, via: string): never => {
    throw new Error(
      `adt_object_${verb}: ${type} (engine '${via}') is a matrix yes-cell whose engine commit has ` +
        'not landed yet — this call refuses instead of degrading. See docs/ddic-fsops-matrix-plan.md §5.',
    );
  };

  /** Route a structured-read via the structure owner. */
  const readStructured: EngineRouter = async (args, exec) => {
    const row = typeRegistryRow(optStr(args.type) ?? '')!;
    return (await owner('adt_read_structure').execute({ ...args, kind: row.structureKind } as never, exec as never)) as Record<string, unknown>;
  };

  const engines: Record<string, EngineRouter | undefined> = {
    // read engines
    'read:structured': readStructured,
    'read:packageContent': async (args, exec) =>
      owner('adt_package_content').execute({ ...args, packageName: optStr(args.name) ?? optStr(args.packageName) } as never, exec as never) as never,
    'read:source': async (args, exec) =>
      owner('adt_read_object').execute(args as never, exec as never) as never,
    'read:metadata': frameworkPendingRouter('read:metadata'),
    // edit: structured RMW patches (properties/fixedValues/labels/messages/
    // description) — the owner chain (policy/lock/transport) runs unchanged.
    'edit:structured': async (args, exec) => {
      const row = typeRegistryRow(optStr(args.type) ?? '')!;
      return (await owner('adt_write_structure').execute({ ...args, kind: row.structureKind } as never, exec as never)) as Record<string, unknown>;
    },
    // edit: full-source replace via the OCC write chain.
    'edit:source': async (args, exec) =>
      owner('adt_write_object').execute(args as never, exec as never) as never,
    // write = create-or-override. Placeholder/source create routes to the
    // create engine (TABL fields included); DEVC keeps its create face.
    'write:source': async (args, exec) =>
      owner('adt_create_object').execute(args as never, exec as never) as never,
    'write:structured': async (args, exec) =>
      owner('adt_create_object').execute(args as never, exec as never) as never,
    'write:fields': async (args, exec) =>
      owner('adt_create_object').execute(args as never, exec as never) as never,
    'write:none': frameworkPendingRouter('write:none'),
    // write:binding (SRVB) and the remaining surgery modes land with the
    // P2/P3 engine commits — their cells refuse with frameworkPending.
    // delete: the generic deletion service (independent of write/edit cells).
    'delete:delete': async (args, exec) =>
      owner('adt_delete_object').execute(args as never, exec as never) as never,
  };

  /** Placeholder router for engines whose commit has not landed. */
  function frameworkPendingRouter(label: string): EngineRouter {
    return () => {
      throw new Error(
        `adt_object_*: engine '${label}' has not landed yet — this call refuses instead of degrading. ` +
          'See docs/ddic-fsops-matrix-plan.md §5.',
      );
    };
  }

  async function route(
    verb: FsVerb,
    args: Record<string, unknown>,
    exec: unknown,
  ): Promise<Record<string, unknown>> {
    const type = optStr(args.type);
    if (!type) {
      throw new Error(`adt_object_${verb}: \`type\` is required (${fsObjectTypes().join(', ')})`);
    }
    const name = optStr(args.name);
    if (!name) {
      throw new Error(`adt_object_${verb}: \`name\` is required (omit BOTH name and verb-specific args to get the matrix card via adt_object_read).`);
    }
    const row = typeRegistryRow(type);
    if (!row) throw new Error(fsUnsupportedMessage(verb, type));
    const cell = fsCell(verb, row.type)!;
    if (cell.status !== 'yes') throw new Error(fsUnsupportedMessage(verb, row.type));
    const engine = engines[`${verb}:${cell.via}`];
    if (!engine) frameworkPending(verb, row.type, cell.via!);
    const result = await engine!(args, exec);
    return { ...result, verb, type: row.type };
  }

  /** Shared parameter block: the agent-facing reference (never endpoints). */
  const typeParam = {
    type: {
      type: 'string',
      description: `Object type short code: ${fsObjectTypes().join(', ')} (aliases like DOMA.FIXVALUES accepted).`,
    },
  } as const;
  const nameParam = {
    name: { type: 'string', description: 'Object name, e.g. ZMY_DOMAIN / ZCL_DEMO / ZPACK_DEMO.' },
  } as const;
  const transportParam = {
    transport: { type: 'string', description: 'Transport request number (write/edit/delete).' },
  } as const;

  return [
    // ----------------------------------------------------------------- write
    defineTool({
      name: 'adt_object_write',
      description:
        'Create (or, with override:true, overwrite) an ABAP object in one call: type + name + ' +
        'description/packageName + content (source | fields | properties/fixedValues/labels, by type). ' +
        'Empty content = placeholder. DDIC/CDS types activate in the same call by default. ' +
        'Endpoint resolution is the tool\'s job — you never pass URIs.',
      parameters: {
        ...typeParam,
        ...nameParam,
        description: { type: 'string', description: 'Short object description (required for new objects).' },
        packageName: { type: 'string', description: 'Target package for new objects ($TMP = local).' },
        ...transportParam,
        override: { type: 'boolean', description: 'false (default): exists → error suggesting override; true: locked overwrite (server-hash checked).' },
        activate: { type: 'boolean', description: 'Activate in the same call (DDIC/CDS default true; source types default false).' },
        source: { type: 'string', description: 'Source types: full source / DDL text (create + write + activate in one step).' },
        fields: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'TABL/STRU: field list → one-step DDL flow.' },
        properties: { type: 'object', additionalProperties: true, description: 'Structured types (DOMA/DTEL/TTYP): technical properties.' },
        fixedValues: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'DOMA: fixed values (full block).' },
        labels: { type: 'object', additionalProperties: true, description: 'DTEL: label patch.' },
        ...DESTINATION_PARAM,
      },
      output: {
        schema: {
          type: 'object', additionalProperties: true,
          properties: {
            verb: { type: 'string', required: true },
            type: { type: 'string', required: true },
            created: { type: 'boolean' },
            overridden: { type: 'boolean' },
            activated: { type: 'boolean' },
            via: { type: 'string', description: 'The engine that executed (source | structured | fields | binding).' },
          },
        },
        render: (_args, value) =>
          text(`adt_object_write ${value.type} → ${value.created ? 'created' : value.overridden ? 'overridden' : 'written'}${value.activated ? ' + activated' : ''} (via ${value.via ?? 'owner'})`),
      },
      isConcurrencySafe: () => false,
      execute: async (args, exec) =>
        route('write', args as Record<string, unknown>, exec) as never,
    }),

    // ------------------------------------------------------------------ read
    defineTool({
      name: 'adt_object_read',
      description:
        'Read an ABAP object: source types → source (with OCC snapshot), structured types ' +
        '(DOMA/DTEL/TTYP/MSAG) → typed JSON, DEVC → package content. No `name` → the fs capability ' +
        'matrix card (what write/read/edit/delete work per type).',
      parameters: {
        ...typeParam,
        ...nameParam,
        version: { type: 'string', description: 'active | inactive | saved | latest.' },
        context: { type: 'boolean', description: 'CLAS/INTF (P2): dependency-contract prologue.' },
        method: { type: 'string', description: 'CLAS/INTF (P2): method-level read window.' },
        raw: { type: 'boolean', description: 'Structured types: include the raw wire XML.' },
        ...DESTINATION_PARAM,
      },
      output: {
        schema: {
          type: 'object', additionalProperties: true,
          properties: {
            matrixCard: { type: 'string', description: 'Present on the no-name status card.' },
            verb: { type: 'string' },
            type: { type: 'string' },
            via: { type: 'string' },
          },
        },
        render: (_args, value) => {
          if (value.matrixCard) return text(value.matrixCard as string);
          const summary = typeof value.source === 'string'
            ? `${(value.source as string).split('\n').length} source line(s)`
            : 'ok';
          return text(`adt_object_read ${value.type ?? ''} → ${summary} (via ${value.via ?? 'owner'})`);
        },
      },
      isConcurrencySafe: () => true,
      execute: async (args, exec) => {
        // The matrix card: no name (and no verb-specific content args).
        if (optStr(args.name) === undefined) {
          return { matrixCard: renderFsMatrixCard() } as never;
        }
        return route('read', args as Record<string, unknown>, exec) as never;
      },
    }),

    // ------------------------------------------------------------------ edit
    defineTool({
      name: 'adt_object_edit',
      description:
        'Modify an EXISTING object (read-then-patch): source types take full new source ' +
        '(or block/method surgery — P2) and require a prior adt_object_read snapshot (OCC); ' +
        'structured types take explicit field patches (properties/fixedValues/labels/messages/description).',
      parameters: {
        ...typeParam,
        ...nameParam,
        source: { type: 'string', description: 'Source types: the full new source (OCC-checked against your read snapshot).' },
        sourceFile: { type: 'string', description: 'Local file with the new source (same OCC chain).' },
        mode: { type: 'string', description: "'replace' (default) | 'block' | 'method' (P2 surgery modes)." },
        properties: { type: 'object', additionalProperties: true, description: 'Structured types: property patch.' },
        fixedValues: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'DOMA: fixed values (full block replacement; [] clears).' },
        labels: { type: 'object', additionalProperties: true, description: 'DTEL: label patch.' },
        messages: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'MSAG: full message list.' },
        description: { type: 'string', description: 'Description patch (any type).' },
        ...transportParam,
        activate: { type: 'boolean', description: 'DDIC types: activate after the patch (default true).' },
        ...DESTINATION_PARAM,
      },
      output: {
        schema: {
          type: 'object', additionalProperties: true,
          properties: {
            verb: { type: 'string', required: true },
            type: { type: 'string', required: true },
            via: { type: 'string' },
          },
        },
        render: (_args, value) =>
          text(`adt_object_edit ${value.type} → patched (via ${value.via ?? 'owner'})`),
      },
      isConcurrencySafe: () => false,
      execute: async (args, exec) => {
        const argsRecord = args as Record<string, unknown>;
        const hasPatch =
          optStr(argsRecord.source) !== undefined || optStr(argsRecord.sourceFile) !== undefined ||
          argsRecord.properties !== undefined || argsRecord.fixedValues !== undefined ||
          argsRecord.labels !== undefined || argsRecord.messages !== undefined ||
          optStr(argsRecord.description) !== undefined;
        if (!hasPatch) {
          throw new Error(
            'adt_object_edit: nothing to patch — pass `source`/`sourceFile` (source types) or the ' +
              'structured patch fields (properties/fixedValues/labels/messages/description).',
          );
        }
        return route('edit', argsRecord, exec) as never;
      },
    }),

    // ---------------------------------------------------------------- delete
    defineTool({
      name: 'adt_object_delete',
      description:
        'Delete an ABAP object (irreversible). The delete verb is independent of the write/edit ' +
        'cells: a GUI-only type may still be deletable — the matrix says per row.',
      parameters: {
        ...typeParam,
        ...nameParam,
        ...transportParam,
        ...DESTINATION_PARAM,
      },
      output: {
        schema: {
          type: 'object', additionalProperties: true,
          properties: {
            verb: { type: 'string', required: true },
            type: { type: 'string', required: true },
            deleted: { type: 'boolean' },
          },
        },
        render: (_args, value) =>
          text(`adt_object_delete ${value.type} → ${value.deleted === true ? 'deleted' : 'done'}`),
      },
      isConcurrencySafe: () => false,
      execute: async (args, exec) =>
        route('delete', args as Record<string, unknown>, exec) as never,
    }),
  ];
}
