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
import { type VerbSupport } from './typeregistry.js';
/** The four fs verbs (fs_ops semantics, replacing the CRUD verb set). */
export type FsVerb = 'write' | 'read' | 'edit' | 'delete';
export declare const FS_VERBS: readonly FsVerb[];
/**
 * One matrix cell. A `yes` cell names the ENGINE that will execute it
 * once the per-phase implementation lands (`via`); `notYet` cells carry
 * their own honest refusal.
 */
export interface FsCell {
    verb: FsVerb;
    status: VerbSupport['status'];
    /** Implementation engine for yes-cells (source | structured | fields | binding | none-special). */
    via?: string;
    /** Guidance for no/planned/unverified cells (the refusal body). */
    note?: string;
    /** Phase a planned/unverified cell is expected to land in. */
    phase?: number;
}
/** All rows in canonical order, verbs resolved. */
export declare const FS_MATRIX: Record<string, Record<FsVerb, FsCell>>;
export declare function fsObjectTypes(): string[];
export declare function fsCell(verb: FsVerb, type: string): FsCell | undefined;
/** The verbs a type supports in canonical order. */
export declare function fsVerbsFor(type: string): FsVerb[];
/**
 * The refusal message for a non-yes cell: names the type's supported
 * verbs, the cell's own reason (SE11 guidance / phase promise / pending
 * probe), and — for write — the override caveat. Never a bare "no handler".
 */
export declare function fsUnsupportedMessage(verb: FsVerb, type: string): string;
/**
 * The canonical doc table (parity-pinned into tool-reference.md once the
 * four tools ship; the P1 test only checks structure, the doc pin lands
 * with the doc update commit).
 */
export declare function renderFsMatrixTable(): string;
/** The compact status-card text (no-name `adt_object_read` answer). */
export declare function renderFsMatrixCard(): string;
//# sourceMappingURL=fsmatrix.d.ts.map