/**
 * The fs_ops capability matrix — the fs-verb view of the type registry
 * (docs/ddic-fsops-matrix-plan.md §4).
 *
 * WHERE crudmatrix.ts said "which REGISTERED TOOL owns verb×type", this
 * matrix says "what the four `adt_object_*` tools can do with verb×type
 * TODAY, and if not, why". Rows come from the registry (typeregistry.ts,
 * the single source of truth); every cell is derived via verbSupport().
 * Nothing is declared here — drift between matrix and registry is
 * impossible by construction, and the parity tests pin the projection.
 *
 * The four fs verbs:
 *   - write: create-or-override (fs `>`). No-content call = placeholder.
 *   - read:  fetch content/metadata; no name = the matrix card.
 *   - edit:  read-then-patch on an EXISTING object (fs `sed`).
 *   - delete: as today.
 *
 * Verb statuses per cell: yes / no (never, GUI-only, points at SE11) /
 * planned (arrives in Pn) / unverified (wire evidence pending). The
 * honest-matrix rule: a non-yes cell NEVER silently no-ops — the tool
 * refuses with the cell's own message naming what IS supported.
 */
import { typeRegistryRow, typeRegistryRows, typeRegistryTypes, verbSupport, } from './typeregistry.js';
export const FS_VERBS = ['write', 'read', 'edit', 'delete'];
/** All rows in canonical order, verbs resolved. */
export const FS_MATRIX = (() => {
    const matrix = {};
    for (const row of typeRegistryRows()) {
        const cells = {};
        for (const verb of FS_VERBS) {
            const support = verbSupport(verb, row);
            cells[verb] = support.status === 'yes'
                ? { verb, status: 'yes', via: viaOf(verb, row) }
                : { verb, status: support.status, note: 'note' in support ? support.note : undefined,
                    phase: 'phase' in support ? support.phase : undefined };
        }
        matrix[row.type] = cells;
    }
    return matrix;
})();
/** Engine naming for yes-cells (docs §6: `via` replaces `routedTool`). */
function viaOf(verb, row) {
    if (verb === 'delete')
        return 'delete';
    if (verb === 'read') {
        if (row.structureKind)
            return 'structured';
        if (row.type === 'DEVC')
            return 'packageContent';
        if (row.editMode === 'none')
            return 'metadata';
        return 'source';
    }
    // write / edit
    if (row.type === 'DOMA_VALUE')
        return 'structured';
    switch (row.editMode) {
        case 'source': return 'source';
        case 'structured': return 'structured';
        case 'fields': return 'fields';
        case 'binding': return 'binding';
        case 'none': return 'none';
    }
}
export function fsObjectTypes() {
    return typeRegistryTypes();
}
export function fsCell(verb, type) {
    const row = typeRegistryRow(type);
    return row ? FS_MATRIX[row.type][verb] : undefined;
}
/** The verbs a type supports in canonical order. */
export function fsVerbsFor(type) {
    const row = typeRegistryRow(type);
    if (!row)
        return [];
    return FS_VERBS.filter((verb) => FS_MATRIX[row.type][verb].status === 'yes');
}
// ---------------------------------------------------------------------------
// The honest refusal (non-yes cells never no-op)
// ---------------------------------------------------------------------------
/**
 * The refusal message for a non-yes cell: names the type's supported
 * verbs, the cell's own reason (SE11 guidance / phase promise / pending
 * probe), and — for write — the override caveat. Never a bare "no handler".
 */
export function fsUnsupportedMessage(verb, type) {
    const upper = (type ?? '').toUpperCase();
    const row = typeRegistryRow(upper);
    const tool = `adt_object_${verb}`;
    if (!row) {
        return (`${tool}: unknown object type '${type}' (known: ${fsObjectTypes().join(', ')}). ` +
            'Types are the usual short codes (DOMA, DTEL, TABL, DDLS, PROG, …).');
    }
    const cell = FS_MATRIX[row.type][verb];
    const supported = fsVerbsFor(row.type);
    const head = `${tool}: ${verb} on ${row.type} is ${cellStatusWord(cell)}`;
    const tail = `Supported for ${row.type}: ${supported.join(', ') || 'none yet'}.`;
    switch (cell.status) {
        case 'no':
            return `${head} — ${cell.note ?? 'not supported'}. ${tail}`;
        case 'planned':
            return `${head} (planned for phase P${cell.phase ?? row.phase}; the matrix row already exists). ${tail}`;
        case 'unverified':
            return `${head} — pending real-system verification (${cell.note ?? 'probe outstanding'}). ${tail}`;
        case 'yes':
            return `${tool}: internal routing error — ${verb} on ${row.type} is a yes-cell (via ${cell.via})`;
    }
}
function cellStatusWord(cell) {
    switch (cell.status) {
        case 'no': return 'not supported';
        case 'planned': return 'not available yet';
        case 'unverified': return 'not verified yet';
        case 'yes': return 'supported';
    }
}
// ---------------------------------------------------------------------------
// Rendering — the matrix card and the pinned doc table
// ---------------------------------------------------------------------------
/** Cell mark for the doc table: ✅ / ❌+reason / Pn / ?. */
function cellMark(cell) {
    switch (cell.status) {
        case 'yes': return `✅ ${cell.via}`;
        case 'no': return `❌ (${cell.note ? firstClause(cell.note) : 'unsupported'})`;
        case 'planned': return `P${cell.phase ?? ''}`;
        case 'unverified': return '?';
    }
}
function firstClause(note) {
    const cut = note.replace(/\s*\(|—.*$/, '');
    return cut.length > 24 ? `${cut.slice(0, 24)}…` : cut;
}
/**
 * The canonical doc table (parity-pinned into tool-reference.md once the
 * four tools ship; the P1 test only checks structure, the doc pin lands
 * with the doc update commit).
 */
export function renderFsMatrixTable() {
    const head = `| type | ${FS_VERBS.join(' | ')} | editMode | activates | phase |`;
    const sep = `|---|${FS_VERBS.map(() => '---').join('|')}|---|---|---|`;
    const rows = typeRegistryRows().map((row) => {
        const cells = FS_VERBS.map((verb) => cellMark(FS_MATRIX[row.type][verb]));
        return `| ${row.type} | ${cells.join(' | ')} | ${row.editMode} | ${row.activates} | P${row.phase} |`;
    });
    return [head, sep, ...rows].join('\n');
}
/** The compact status-card text (no-name `adt_object_read` answer). */
export function renderFsMatrixCard() {
    const lines = ['fs_ops capability matrix (write | read | edit | delete per type):'];
    for (const row of typeRegistryRows()) {
        const marks = FS_VERBS.map((verb) => {
            const cell = FS_MATRIX[row.type][verb];
            return `${verb}:${mark(cell)}`;
        });
        lines.push(`- ${row.type} (${row.label}, P${row.phase}): ${marks.join(' ')}`);
        if (row.note)
            lines.push(`    · ${row.note}`);
    }
    lines.push('');
    lines.push('✅ = usable now · P# = planned for that phase · ✗ = refused (GUI-only, use SE11) · ? = pending verification.');
    lines.push('write = create-or-override (empty content = placeholder) · edit = read-then-patch · omit name to see this card.');
    return lines.join('\n');
}
function mark(cell) {
    switch (cell.status) {
        case 'yes': return '✅';
        case 'no': return '✗';
        case 'planned': return `P${cell.phase ?? ''}`;
        case 'unverified': return '?';
    }
}
//# sourceMappingURL=fsmatrix.js.map