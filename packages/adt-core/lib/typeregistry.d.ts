/**
 * The object-type registry — the SINGLE SOURCE OF TRUTH for "what is this
 * type, where does it live on the wire, and how is it edited".
 *
 * This is the fs_ops foundation (docs/ddic-fsops-matrix-plan.md §3): it
 * merges the three facts that used to live in three places —
 *
 *   - adt-core `resolve.ts` TYPE_MAP        (adtType / uriPrefix / label)
 *   - adt-protocol `endpoints.ts` createByType (create collection + media type)
 *   - adt-protocol `structure.ts` KINDS     (structureKind + v2 media types)
 *
 * into one registry row per object type. Everything else is DERIVED:
 * the fs matrix (fsmatrix.ts), the four `adt_object_*` tools' type enums
 * and args validation (tools/fsops.ts), the endpoint catalog pins and the
 * parity tests. Adding a type = adding ONE row here (+ its protocol
 * endpoint); no other place may grow a second copy.
 *
 * Phases (P1..P4, the user's four-stage plan): rows exist for ALL types up
 * front; per-verb capabilities are filled in per phase. A row whose verbs
 * are not yet filled shows up in the matrix card as "planned (Pn)" — the
 * registry describes the destination's world, the matrix describes what
 * our tools can do TODAY (honest-matrix principle).
 *
 * Version dimensions (§3.5 capability profiles — the runtime calibration
 * layer, implemented in later P1 commits): `mediaTypeVersions`,
 * `editForms`, `minProfile` exist so the PROFILE can override the static
 * defaults (e.g. DOMA DDL-source form only on modern backends). The
 * static fields are the superset; probes narrow them per destination.
 */
/**
 * How the CONTENT of an object of this type is edited on the wire.
 *  - source:      plain source text under `<uri>/source/main`
 *                 (ABAP source or DDIC DDL; write = PUT full text).
 *  - structured:  a metadata XML document negotiated by media type
 *                 (RMW: GET → patch → PUT, lock handle).
 *  - fields:      the one-step DDL flow (TABL/STRU field list → generated
 *                 DDL source); a `source` specialization with sugar.
 *  - binding:     SRVB-style: create picks a binding type + references a
 *                 service definition; "activate" means PUBLISH.
 *  - none:        no ADT write face (GUI-only or read-only rows).
 */
export type EditMode = 'source' | 'structured' | 'fields' | 'binding' | 'none';
/**
 * What "activate" means for this type.
 *  - ddic:    DDIC-style mass activation after write (default for DDIC/CDS).
 *  - none:    plain ABAP source — write leaves it inactive, syntax-check
 *             is suggested instead (adt_activate for explicit activation).
 *  - publish: activation is a PUBLISH state transition (SRVB).
 */
export type Activates = 'ddic' | 'none' | 'publish';
/**
 * Whether a verb×type is usable and, if not, what to say about it.
 *  - yes:            implemented (or a pure passthrough of an existing one).
 *  - no:             impossible on the wire (GUI-only) — the message points
 *                    at SE11/SAP GUI; honest-matrix hard refusal.
 *  - planned:        designed, arrives in phase Pn (message says so).
 *  - unverified:     wire evidence incomplete — flips to yes/no after the
 *                    real-system probe named in `note`.
 */
export type VerbSupport = {
    status: 'yes';
} | {
    status: 'no';
    note: string;
} | {
    status: 'planned';
    phase: number;
} | {
    status: 'unverified';
    note: string;
};
/** One registry row. Field order below mirrors the plan doc §3. */
export interface TypeRegistryRow {
    /** Short code used by the tools (`type: 'DOMA'`). */
    readonly type: string;
    /** Full ADT object type (`DOMA/DT`) — what search/resolve speaks. */
    readonly adtType: string;
    /** Canonical object URI prefix (lowercase names live under it). */
    readonly uriPrefix: string;
    /** Human label for cards and messages. */
    readonly label: string;
    /** Plan phase P1..P4 the type is filled in (rows exist up front). */
    readonly phase: number;
    /** How content is edited (see {@link EditMode}). */
    readonly editMode: EditMode;
    /** Source sub-path for source-ish types (default `/source/main`). */
    readonly sourcePath?: string;
    /** Structured-editor kind for structured types (structure.ts face). */
    readonly structureKind?: 'DOMA' | 'DTEL' | 'TTYP' | 'MSAG';
    /** Create collection, relative to `/sap/bc/adt` (no query). */
    readonly createEndpoint?: string;
    /** Create-request media type (the POST body format). */
    readonly createMediaType?: string;
    /** Create-time extra query parameters (e.g. SRVD sourceType). */
    readonly createParams?: Record<string, string>;
    /** Pre-create validation service (relative path), if the type has one. */
    readonly validationPath?: string;
    /** Activation semantics (see {@link Activates}). */
    readonly activates: Activates;
    /** Sub-objects exposed as virtual rows (e.g. DOMA_VALUE → fixedValues). */
    readonly subObjects?: readonly string[];
    /** The same content editable in more than one wire form (profile picks). */
    readonly editForms?: readonly EditMode[];
    /** Known media-type versions, highest first (profile narrows). */
    readonly mediaTypeVersions?: readonly string[];
    /** Minimum backend profile for this row's DEFAULT form. */
    readonly minProfile?: 'legacy' | 'modern';
    /** Short aliases accepted wherever `type` is read. */
    readonly aliases?: readonly string[];
    /**
     * Row-level verb supports. Unspecified → derive: write/edit follow
     * editMode, read = yes, delete = yes (see verbSupport()).
     */
    readonly verbs?: Partial<Record<'write' | 'read' | 'edit' | 'delete', VerbSupport>>;
    /** One-line note rendered on the matrix card (rare). */
    readonly note?: string;
}
/** All rows in canonical (matrix) order. */
export declare function typeRegistryRows(): readonly TypeRegistryRow[];
/** Canonical type short codes (matrix row order). */
export declare function typeRegistryTypes(): string[];
/** Look up a row by short code / adtType / alias (case-insensitive). */
export declare function typeRegistryRow(type: string): TypeRegistryRow | undefined;
/** Rows of a given phase (P1..P4). */
export declare function typeRegistryRowsForPhase(phase: number): readonly TypeRegistryRow[];
/** Types whose row declares a create endpoint (the creatable catalog). */
export declare function typeRegistryCreatableTypes(): string[];
/**
 * All accepted `type` spellings (codes + adtTypes + aliases). Internal —
 * used by the parity tests' superset check; not part of the public surface.
 */
export declare function typeRegistryAcceptedSpellings(): string[];
/**
 * The effective verb support for a row, DERIVED when the row does not pin
 * it explicitly:
 *   - write: yes iff the type has a create endpoint (override exists = the
 *     write verb's override flavor; nothing to declare per-verb).
 *   - read:  yes (every row is at least addressable; special faces like
 *     DEVC/VIEW declare their own).
 *   - edit:  yes iff editMode is not 'none'.
 *   - delete: yes (generic deletion service; GUI-only rows pin otherwise).
 * Phased rows pin their verbs explicitly — the derivation only fires for
 * rows whose capabilities are already filled in.
 */
export declare function verbSupport(verb: 'write' | 'read' | 'edit' | 'delete', row: TypeRegistryRow): VerbSupport;
/** Duplicate detection across TYPE CODES and ALIASES (the agent-facing
 * spellings). Sharing an adtType is BY DESIGN for virtual rows (DOMA_VALUE
 * → DOMA/DT) and sub-objects (INDX → TABL/DT) — only agent-facing
 * spellings must be unambiguous. */
export declare function typeRegistryDuplicateSpellings(): string[];
//# sourceMappingURL=typeregistry.d.ts.map