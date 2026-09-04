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
/**
 * The matrix. Rows are the object types our tools genuinely operate on:
 * the 12 creatable types (mirroring the protocol's createByType catalog)
 * plus INCL (program includes — readable/writable, not creatable).
 */
export const CRUD_MATRIX = {
    CLAS: {
        create: { tool: 'adt_create_object' },
        read: { tool: 'adt_read_object', mode: 'source' },
        update: { tool: 'adt_write_object', mode: 'source' },
        delete: { tool: 'adt_delete_object' },
    },
    INTF: {
        create: { tool: 'adt_create_object' },
        read: { tool: 'adt_read_object', mode: 'source' },
        update: { tool: 'adt_write_object', mode: 'source' },
        delete: { tool: 'adt_delete_object' },
    },
    PROG: {
        create: { tool: 'adt_create_object' },
        read: { tool: 'adt_read_object', mode: 'source' },
        update: { tool: 'adt_write_object', mode: 'source' },
        delete: { tool: 'adt_delete_object' },
    },
    INCL: {
        // Includes share the PROG namespace; read/update resolve via search.
        read: { tool: 'adt_read_object', mode: 'source' },
        update: { tool: 'adt_write_object', mode: 'source' },
        delete: { tool: 'adt_delete_object' },
    },
    FUNC: {
        create: { tool: 'adt_create_object' },
        read: { tool: 'adt_read_object', mode: 'source' },
        update: { tool: 'adt_write_object', mode: 'source' },
        delete: { tool: 'adt_delete_object' },
    },
    DDLS: {
        create: { tool: 'adt_create_object' },
        read: { tool: 'adt_read_object', mode: 'source' },
        update: { tool: 'adt_write_object', mode: 'source' },
        delete: { tool: 'adt_delete_object' },
    },
    TABL: {
        // Create: one-step DDL flow with `fields`, placeholder without.
        create: { tool: 'adt_create_object', mode: 'fields' },
        read: { tool: 'adt_read_object', mode: 'source' },
        update: { tool: 'adt_write_object', mode: 'source' },
        delete: { tool: 'adt_delete_object' },
    },
    STRU: {
        create: { tool: 'adt_create_object' },
        read: { tool: 'adt_read_object', mode: 'source' },
        update: { tool: 'adt_write_object', mode: 'source' },
        delete: { tool: 'adt_delete_object' },
    },
    DOMA: {
        create: { tool: 'adt_create_object' },
        read: { tool: 'adt_read_structure', mode: 'structured' },
        update: { tool: 'adt_write_structure', mode: 'structured' },
        delete: { tool: 'adt_delete_object' },
    },
    DTEL: {
        create: { tool: 'adt_create_object' },
        read: { tool: 'adt_read_structure', mode: 'structured' },
        update: { tool: 'adt_write_structure', mode: 'structured' },
        delete: { tool: 'adt_delete_object' },
    },
    TTYP: {
        create: { tool: 'adt_create_object' },
        read: { tool: 'adt_read_structure', mode: 'structured' },
        update: { tool: 'adt_write_structure', mode: 'structured' },
        delete: { tool: 'adt_delete_object' },
    },
    MSAG: {
        create: { tool: 'adt_create_object' },
        read: { tool: 'adt_read_structure', mode: 'structured' },
        update: { tool: 'adt_write_structure', mode: 'structured' },
        delete: { tool: 'adt_delete_object' },
    },
    DEVC: {
        create: { tool: 'adt_create_object' },
        read: { tool: 'adt_package_content', mode: 'packageContent' },
        // No package-update tool exists — the cell's absence IS the answer.
        delete: { tool: 'adt_delete_object' },
    },
};
export const CRUD_VERBS = ['create', 'read', 'update', 'delete'];
/** The matrix row order for rendering (creatables first, INCL beside PROG). */
const ROW_ORDER = [
    'CLAS', 'INTF', 'PROG', 'INCL', 'FUNC', 'DDLS',
    'TABL', 'STRU', 'DOMA', 'DTEL', 'TTYP', 'MSAG', 'DEVC',
];
/** All object types the matrix knows (canonical row order). */
export function crudObjectTypes() {
    return [...ROW_ORDER];
}
/** Types with a create cell — the canonical creatable-type list. */
export function crudCreatableTypes() {
    return ROW_ORDER.filter((type) => CRUD_MATRIX[type].create !== undefined);
}
/** The owning cell for a verb×type, or undefined (genuinely unsupported). */
export function crudCell(verb, type) {
    const row = CRUD_MATRIX[type.toUpperCase()];
    return row?.[verb];
}
/** The verbs supported for a type, in canonical order. */
export function crudVerbsFor(type) {
    const row = CRUD_MATRIX[type.toUpperCase()];
    if (!row)
        return [];
    return CRUD_VERBS.filter((verb) => row[verb] !== undefined);
}
/**
 * The vsp-style refusal for an unsupported verb×type: name what IS supported
 * for the type (or list the types if the type itself is unknown) — never a
 * bare "no handler".
 */
export function crudUnsupportedMessage(verb, type) {
    const upper = type.toUpperCase();
    const row = CRUD_MATRIX[upper];
    if (!row) {
        return (`adt_crud: unknown object type '${type}' (known: ${crudObjectTypes().join(', ')}). ` +
            'Types are the usual short codes (CLAS, PROG, TABL, …).');
    }
    const supported = crudVerbsFor(upper);
    return supported.includes(verb)
        ? `adt_crud: internal routing error — ${verb} on ${upper} is mapped to ${row[verb].tool}`
        : `adt_crud: ${verb} is not supported for ${upper} (supported: ${supported.join(', ') || 'none'}). ` +
            (upper === 'DEVC'
                ? 'Packages have no update tool — recreate or maintain them in SE80.'
                : `Use the dedicated ${verb === 'create' ? 'creation' : verb} flow for this type instead.`);
}
/** Render the matrix as the canonical markdown table (docs are pinned to it). */
export function renderCrudMatrixTable() {
    const head = `| type | ${CRUD_VERBS.join(' | ')} |`;
    const sep = `|---|${CRUD_VERBS.map(() => '---').join('|')}|`;
    const rows = ROW_ORDER.map((type) => {
        const row = CRUD_MATRIX[type];
        const cells = CRUD_VERBS.map((verb) => {
            const cell = row[verb];
            if (!cell)
                return '—';
            return cell.mode && cell.mode !== 'source' ? `${cell.tool} (${cell.mode})` : cell.tool;
        });
        return `| ${type} | ${cells.join(' | ')} |`;
    });
    return [head, sep, ...rows].join('\n');
}
//# sourceMappingURL=crudmatrix.js.map