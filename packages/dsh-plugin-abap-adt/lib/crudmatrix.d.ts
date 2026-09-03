/**
 * CRUD capability matrix — the SINGLE SOURCE OF TRUTH for "which verb works
 * on which object type, through which tool".
 *
 * This is the P2 "Compact CRUD 矩阵" decision (docs/agent-experience-upgrade-
 * plan.md), pulled ahead of its long-tail trigger at the user's request:
 * adopted from abap-mcp's compactMatrix (one `Record<ObjectType, CrudOp[]>`
 * driving routing validation, tests AND docs) and vsp's universal-tool
 * lessons (a route that claims a verb never answers bare "No handler found" —
 * it names what IS supported; a no-verb call returns a status card, not an
 * error).
 *
 * THE LONG-TAIL RULE (the original decision, now enforced by structure):
 * when new object types arrive (RAP BDEF/SRVD/SRVB, screens DYNP, GUI
 * statuses, DDLX, classic views …) and the count passes ~5, they are added
 * HERE plus their protocol endpoint — and exposed ONLY through the compact
 * `adt_crud` facade. No new fine-grained tool per type: the 46-tool catalog
 * stays flat on purpose (vsp's 147-tool face bred dead tools; our catalog
 * pin + selfcheck are the guard rails).
 *
 * Every cell names the OWNING tool — the compact facade routes to it and the
 * owner keeps its full policy/OCC/persistence chain. A verb without a cell
 * is genuinely unsupported and must fail with guidance, never silently.
 *
 * The module is intentionally dependency-free (pure data + derived views) so
 * parity tests can run it against the protocol catalog and the docs.
 */
/** The four compact verbs (abap-mcp's Handler verb set). */
export type CrudVerb = 'create' | 'read' | 'update' | 'delete';
/** One matrix cell: the owning tool (+ how it treats the type). */
export interface CrudCell {
    /** The registered tool that owns this verb for this type. */
    tool: string;
    /** Routing flavor, for docs and error messages. */
    mode?: 'source' | 'structured' | 'fields' | 'packageContent';
}
/**
 * The matrix. Rows are the object types our tools genuinely operate on:
 * the 12 creatable types (mirroring the protocol's createByType catalog)
 * plus INCL (program includes — readable/writable, not creatable).
 */
export declare const CRUD_MATRIX: Record<string, Partial<Record<CrudVerb, CrudCell>>>;
export declare const CRUD_VERBS: readonly CrudVerb[];
/** All object types the matrix knows (canonical row order). */
export declare function crudObjectTypes(): string[];
/** Types with a create cell — the canonical creatable-type list. */
export declare function crudCreatableTypes(): string[];
/** The owning cell for a verb×type, or undefined (genuinely unsupported). */
export declare function crudCell(verb: CrudVerb, type: string): CrudCell | undefined;
/** The verbs supported for a type, in canonical order. */
export declare function crudVerbsFor(type: string): CrudVerb[];
/**
 * The vsp-style refusal for an unsupported verb×type: name what IS supported
 * for the type (or list the types if the type itself is unknown) — never a
 * bare "no handler".
 */
export declare function crudUnsupportedMessage(verb: CrudVerb, type: string): string;
/** Render the matrix as the canonical markdown table (docs are pinned to it). */
export declare function renderCrudMatrixTable(): string;
//# sourceMappingURL=crudmatrix.d.ts.map