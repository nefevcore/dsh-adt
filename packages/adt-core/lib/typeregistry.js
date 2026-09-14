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
/** Registry row order = matrix row order (the plan doc §4). */
const ROWS = [
    // --- P1: foundation DDIC (the modeling chain) ---------------------------
    {
        type: 'DOMA', adtType: 'DOMA/DT', uriPrefix: '/sap/bc/adt/ddic/domains/',
        label: 'Domain', phase: 1,
        editMode: 'structured', structureKind: 'DOMA',
        createEndpoint: '/ddic/domains', createMediaType: 'application/vnd.sap.adt.domains.v2+xml',
        editForms: ['structured', 'source'], // DDL source form: modern backends only (probe)
        mediaTypeVersions: ['v2', 'v1'],
        activates: 'ddic',
        subObjects: ['fixedValues'],
    },
    {
        // Virtual row: fixed values ride on the DOMA structured face.
        type: 'DOMA_VALUE', adtType: 'DOMA/DT', uriPrefix: '/sap/bc/adt/ddic/domains/',
        label: 'Domain fixed values', phase: 1,
        editMode: 'structured', structureKind: 'DOMA', aliases: ['DOMA.FIXVALUES'],
        activates: 'ddic',
        // P1 remaining: the virtual fixedValues face lands with the DOMA_VALUE
        // routing commit (planned until then; flips to yes).
        // REAL-SYSTEM EVIDENCE (deloitte-kic 2026-09-14, both rounds): the full
        // chain incl. fixValues write/read-back/clear is PROVEN — fixValues MUST
        // nest inside doma:content > doma:valueInformation (a block outside
        // <content> is silently dropped). Only the virtual-face routing remains.
        verbs: {
            write: { status: 'planned', phase: 1 }, read: { status: 'planned', phase: 1 },
            edit: { status: 'planned', phase: 1 }, delete: { status: 'planned', phase: 1 },
        },
    },
    {
        type: 'DTEL', adtType: 'DTEL/DT', uriPrefix: '/sap/bc/adt/ddic/dataelements/',
        label: 'Data element', phase: 1,
        editMode: 'structured', structureKind: 'DTEL',
        createEndpoint: '/ddic/dataelements', createMediaType: 'application/vnd.sap.adt.dataelements.v2+xml',
        editForms: ['structured', 'source'],
        mediaTypeVersions: ['v2', 'v1'],
        activates: 'ddic',
        subObjects: ['labels'],
    },
    {
        type: 'STRU', adtType: 'STRU/DT', uriPrefix: '/sap/bc/adt/ddic/structures/',
        label: 'Structure', phase: 1,
        editMode: 'source',
        createEndpoint: '/ddic/structures', createMediaType: 'application/vnd.sap.adt.structures.v2+xml',
        editForms: ['source', 'fields'], // fields flow = DDL sugar
        activates: 'ddic',
    },
    {
        type: 'TABL', adtType: 'TABL/DT', uriPrefix: '/sap/bc/adt/ddic/tables/',
        label: 'Table', phase: 1,
        editMode: 'source',
        createEndpoint: '/ddic/tables', createMediaType: 'application/vnd.sap.adt.tables.v2+xml',
        editForms: ['source', 'fields'], // the one-step fields flow is the write default
        activates: 'ddic',
        subObjects: ['indexes'],
    },
    {
        type: 'TTYP', adtType: 'TTYP/DT', uriPrefix: '/sap/bc/adt/ddic/tabletypes/',
        label: 'Table type', phase: 1,
        editMode: 'structured', structureKind: 'TTYP',
        createEndpoint: '/ddic/tabletypes', createMediaType: 'application/vnd.sap.adt.tabletypes.v2+xml',
        editForms: ['structured', 'source'],
        mediaTypeVersions: ['v2', 'v1'],
        activates: 'ddic',
    },
    {
        type: 'DDLS', adtType: 'DDLS/DF', uriPrefix: '/sap/bc/adt/ddls/sources/',
        label: 'CDS data definition', phase: 1,
        editMode: 'source',
        createEndpoint: '/ddls/sources', createMediaType: 'application/vnd.sap.adt.ddlSource.v2+xml',
        // sourceType: viewEntity | view | customEntity | extendView … (create param)
        activates: 'ddic',
    },
    {
        type: 'DCLS', adtType: 'DCLS/DL', uriPrefix: '/sap/bc/adt/dcls/sources/',
        label: 'CDS access control', phase: 1,
        editMode: 'source',
        createEndpoint: '/acm/dcl/sources', createMediaType: 'application/vnd.sap.adt.dclSource.v1+xml',
        activates: 'ddic',
    },
    {
        type: 'DDLX', adtType: 'DDLX/EX', uriPrefix: '/sap/bc/adt/ddlx/sources/',
        label: 'CDS metadata extension', phase: 1,
        editMode: 'source',
        createEndpoint: '/ddic/ddlx/sources', createMediaType: 'application/vnd.sap.adt.ddic.ddlx.v1+xml',
        activates: 'ddic',
    },
    // --- P2: programs & classes ---------------------------------------------
    {
        type: 'PROG', adtType: 'PROG/P', uriPrefix: '/sap/bc/adt/programs/programs/',
        label: 'Program', phase: 2,
        editMode: 'source',
        createEndpoint: '/programs/programs', createMediaType: 'application/vnd.sap.adt.programs.programs.v2+xml',
        activates: 'none', aliases: ['PROG/P'],
    },
    {
        type: 'INCL', adtType: 'PROG/I', uriPrefix: '/sap/bc/adt/programs/includes/',
        label: 'Include', phase: 2,
        editMode: 'source',
        activates: 'none',
        // No create cell of its own (shares the PROG namespace) — planned verbs.
        verbs: {
            read: { status: 'yes' },
            edit: { status: 'yes' }, // full-source replace via the owner chain works today
            delete: { status: 'yes' },
            write: { status: 'planned', phase: 2 }, // create shares the PROG namespace — P2 shape
        },
        note: 'Includes share the PROG namespace; write resolves via exact-name search (P2).',
    },
    {
        type: 'CLAS', adtType: 'CLAS/OC', uriPrefix: '/sap/bc/adt/oo/classes/',
        label: 'Class', phase: 2,
        editMode: 'source',
        createEndpoint: '/oo/classes', createMediaType: 'application/vnd.sap.adt.oo.classes.v5+xml',
        activates: 'none',
    },
    {
        type: 'INTF', adtType: 'INTF/OI', uriPrefix: '/sap/bc/adt/oo/interfaces/',
        label: 'Interface', phase: 2,
        editMode: 'source',
        createEndpoint: '/oo/interfaces', createMediaType: 'application/vnd.sap.adt.oo.interfaces.v5+xml',
        activates: 'none',
    },
    {
        type: 'FUNC', adtType: 'FUGR/F', uriPrefix: '/sap/bc/adt/fugr/',
        label: 'Function group', phase: 2,
        editMode: 'source',
        // REAL-SYSTEM EVIDENCE (deloitte-kic 2026-09-14): create collection is
        // /functions/groups (NOT /fugr) and the OBJECT+source URI prefix is
        // /functions/groups/{name} too; CT functions.groups.v3; body
        // <group:abapFunctionGroup>. Full chain create→write→read→delete PROVEN.
        createEndpoint: '/functions/groups', createMediaType: 'application/vnd.sap.adt.functions.groups.v3+xml',
        activates: 'none', aliases: ['FUGR'],
        note: 'Container semantics: the group source; function modules are sub-objects (P2 final form).',
    },
    // --- P3: RAP --------------------------------------------------------------
    {
        type: 'BDEF', adtType: 'BDEF/BDO', uriPrefix: '/sap/bc/adt/bdef/sources/',
        label: 'Behavior definition', phase: 3,
        editMode: 'source',
        // REAL-SYSTEM EVIDENCE (deloitte-kic 2026-09-14): the create collection
        // lives at /bo/behaviordefinitions (CT blues.v1, body blue:blueSource);
        // the object URI returned/searched is /bo/behaviordefinitions/{name}.
        // Full chain create→read→delete PROVEN.
        createEndpoint: '/bo/behaviordefinitions', createMediaType: 'application/vnd.sap.adt.blues.v1+xml',
        activates: 'ddic',
    },
    {
        type: 'SRVD', adtType: 'SRVD/SRV', uriPrefix: '/sap/bc/adt/srvdef/sources/',
        label: 'Service definition', phase: 3,
        editMode: 'source',
        // REAL-SYSTEM EVIDENCE (deloitte-kic 2026-09-14): create at
        // /ddic/srvd/sources, CT srvd.v1, body <srvd:srvdSource> with the BODY
        // attribute srvd:srvdSourceType="S" (NOT a query param — the query form
        // 400s). Full chain create→read→delete PROVEN.
        createEndpoint: '/ddic/srvd/sources', createMediaType: 'application/vnd.sap.adt.ddic.srvd.v1+xml',
        activates: 'ddic',
    },
    {
        type: 'SRVB', adtType: 'SRVB/VB', uriPrefix: '/sap/bc/adt/businessservices/bindings/',
        label: 'Service binding', phase: 3,
        editMode: 'binding',
        createEndpoint: '/businessservices/bindings',
        activates: 'publish',
        note: 'Create needs bindingType (ODATA V2 / ina_v1 / sql1) + serviceDefinition; activate = publish.',
        verbs: {
            write: { status: 'planned', phase: 3 }, read: { status: 'planned', phase: 3 },
            edit: { status: 'planned', phase: 3 }, // 🟡 in the plan: structured patch of binding/service-definition refs
            delete: { status: 'planned', phase: 3 },
        },
    },
    // --- P4: remaining objects -----------------------------------------------
    {
        type: 'MSAG', adtType: 'MSAG/N', uriPrefix: '/sap/bc/adt/messageclass/',
        label: 'Message class', phase: 4,
        editMode: 'structured', structureKind: 'MSAG',
        createEndpoint: '/messageclass', createMediaType: 'application/vnd.sap.adt.mc.messageclass+xml',
        activates: 'ddic',
        subObjects: ['messages'],
        // Today's tools already do MSAG fully — filled from day one (§5.4 "平移").
        verbs: {
            write: { status: 'yes' }, read: { status: 'yes' },
            edit: { status: 'yes' }, delete: { status: 'yes' },
        },
    },
    {
        type: 'DEVC', adtType: 'DEVC/K', uriPrefix: '/sap/bc/adt/packages/',
        label: 'Package', phase: 4,
        editMode: 'none',
        createEndpoint: '/packages', createMediaType: 'application/vnd.sap.adt.packages.v2+xml',
        activates: 'none',
        // Special reads: package CONTENT, not source. Update genuinely absent.
        verbs: {
            write: { status: 'yes' }, read: { status: 'yes' },
            edit: { status: 'no', note: 'Packages have no update tool — recreate or maintain in SE80.' },
            delete: { status: 'yes' },
        },
        note: 'read returns the package CONTENT (adt_package_content semantics).',
    },
    {
        type: 'ENQU', adtType: 'ENQU/DO', uriPrefix: '/sap/bc/adt/ddic/lockobjects/',
        label: 'Lock object', phase: 4,
        editMode: 'source',
        createEndpoint: '/ddic/lockobjects/sources', createMediaType: 'application/vnd.sap.adt.lockobjects.v1+xml',
        activates: 'ddic',
        verbs: {
            write: { status: 'unverified', note: 'create body + enqudl DDL syntax pending real-system capture' },
            read: { status: 'planned', phase: 4 },
            edit: { status: 'unverified', note: 'same pending capture as write' },
            delete: { status: 'planned', phase: 4 },
        },
    },
    {
        type: 'VIEW', adtType: 'VIEW/DT', uriPrefix: '/sap/bc/adt/ddic/views/',
        label: 'Classic view (SE11)', phase: 4,
        editMode: 'none',
        activates: 'none',
        verbs: {
            write: { status: 'no', note: 'SE11 classic views have no ADT write face — maintain in SE11/SAP GUI.' },
            read: { status: 'planned', phase: 4 }, // metadata-XML read face
            edit: { status: 'no', note: 'SE11 only.' },
            delete: { status: 'unverified', note: 'generic deletion service probe pending' },
        },
    },
    {
        type: 'SHLP', adtType: 'SHLP/DT', uriPrefix: '/sap/bc/adt/ddic/searchhelps/',
        label: 'Search help', phase: 4,
        editMode: 'none',
        activates: 'none',
        verbs: {
            write: { status: 'no', note: 'No ADT service exists for search helps — SE11/SAP GUI.' },
            read: { status: 'unverified', note: 'metadata read Accept details pending' },
            edit: { status: 'no', note: 'SE11 only.' },
            delete: { status: 'unverified', note: 'generic deletion service probe pending' },
        },
    },
    {
        type: 'TYPE', adtType: 'TYPE/TT', uriPrefix: '/sap/bc/adt/ddic/typegroups/',
        label: 'Type group', phase: 4,
        editMode: 'source',
        createEndpoint: '/ddic/typegroups',
        activates: 'none',
        // REAL-SYSTEM EVIDENCE (deloitte-kic 2026-09-14): create REFUSED (400)
        // with the generic objectReference body — the gateway wants a dedicated
        // form this backend does not document. write stays unverified.
        verbs: {
            write: { status: 'unverified', note: 'create refused (400) with the generic body on deloitte-kic; dedicated form unknown' },
            read: { status: 'planned', phase: 4 },
            edit: { status: 'unverified', note: 'pending the same verification as write' },
            delete: { status: 'planned', phase: 4 },
        },
    },
    {
        type: 'INDX', adtType: 'TABL/DT', uriPrefix: '/sap/bc/adt/ddic/db/indexes/',
        label: 'Table index (TABL sub-object)', phase: 4,
        editMode: 'source', sourcePath: '/source/main',
        createEndpoint: '/ddic/db/indexes',
        activates: 'ddic',
        verbs: {
            write: { status: 'planned', phase: 4 },
            read: { status: 'planned', phase: 4 },
            edit: { status: 'planned', phase: 4 },
            delete: { status: 'planned', phase: 4 },
        },
        note: 'blueSource face; addressed as a TABL sub-object (name form ZTAB~001) — P4 decides the final shape.',
    },
    // --- S/4 2023 long tail (long-tail rule: rows + endpoints only) ----------
    {
        type: 'DRAS', adtType: 'DRAS/DF', uriPrefix: '/sap/bc/adt/ddic/dras/sources/',
        label: 'Aspect', phase: 4,
        editMode: 'source', createEndpoint: '/ddic/dras/sources', activates: 'ddic',
        verbs: { write: { status: 'planned', phase: 4 }, read: { status: 'planned', phase: 4 },
            edit: { status: 'planned', phase: 4 }, delete: { status: 'planned', phase: 4 } },
    },
    {
        type: 'DRTY', adtType: 'DRTY/DF', uriPrefix: '/sap/bc/adt/ddic/drty/sources/',
        label: 'Custom type', phase: 4,
        editMode: 'source', createEndpoint: '/ddic/drty/sources', activates: 'ddic',
        verbs: { write: { status: 'planned', phase: 4 }, read: { status: 'planned', phase: 4 },
            edit: { status: 'planned', phase: 4 }, delete: { status: 'planned', phase: 4 } },
    },
    {
        type: 'DRUL', adtType: 'DRUL/DF', uriPrefix: '/sap/bc/adt/ddic/drul/sources/',
        label: 'Dependency rule', phase: 4,
        editMode: 'source', createEndpoint: '/ddic/drul/sources', activates: 'ddic',
        verbs: { write: { status: 'planned', phase: 4 }, read: { status: 'planned', phase: 4 },
            edit: { status: 'planned', phase: 4 }, delete: { status: 'planned', phase: 4 } },
    },
    {
        type: 'DSFD', adtType: 'DSFD/DF', uriPrefix: '/sap/bc/adt/ddic/dsfd/sources/',
        label: 'Scalar function (definition)', phase: 4,
        editMode: 'source', createEndpoint: '/ddic/dsfd/sources', activates: 'ddic',
        verbs: { write: { status: 'planned', phase: 4 }, read: { status: 'planned', phase: 4 },
            edit: { status: 'planned', phase: 4 }, delete: { status: 'planned', phase: 4 } },
    },
    {
        type: 'DSFI', adtType: 'DSFI/DF', uriPrefix: '/sap/bc/adt/ddic/dsfi/sources/',
        label: 'Scalar function (implementation)', phase: 4,
        editMode: 'source', createEndpoint: '/ddic/dsfi/sources', activates: 'ddic',
        verbs: { write: { status: 'planned', phase: 4 }, read: { status: 'planned', phase: 4 },
            edit: { status: 'planned', phase: 4 }, delete: { status: 'planned', phase: 4 } },
    },
    {
        type: 'DTDC', adtType: 'DTDC/DF', uriPrefix: '/sap/bc/adt/ddic/dtdc/sources/',
        label: 'Dynamic cache', phase: 4,
        editMode: 'source', createEndpoint: '/ddic/dtdc/sources', activates: 'ddic',
        verbs: { write: { status: 'planned', phase: 4 }, read: { status: 'planned', phase: 4 },
            edit: { status: 'planned', phase: 4 }, delete: { status: 'planned', phase: 4 } },
    },
    {
        type: 'DTEB', adtType: 'DTEB/DF', uriPrefix: '/sap/bc/adt/ddic/dteb/sources/',
        label: 'Entity buffer', phase: 4,
        editMode: 'source', createEndpoint: '/ddic/dteb/sources', activates: 'ddic',
        verbs: { write: { status: 'planned', phase: 4 }, read: { status: 'planned', phase: 4 },
            edit: { status: 'planned', phase: 4 }, delete: { status: 'planned', phase: 4 } },
    },
];
// ---------------------------------------------------------------------------
// Derived views — the ONLY ways the rest of the codebase may look at types
// ---------------------------------------------------------------------------
const BY_TYPE = new Map();
const BY_ADT_TYPE = new Map();
for (const row of ROWS) {
    BY_TYPE.set(row.type, row);
    BY_TYPE.set(row.adtType, row);
    BY_ADT_TYPE.set(row.adtType, row);
    for (const alias of row.aliases ?? [])
        BY_TYPE.set(alias.toUpperCase(), row);
}
/** All rows in canonical (matrix) order. */
export function typeRegistryRows() {
    return ROWS;
}
/** Canonical type short codes (matrix row order). */
export function typeRegistryTypes() {
    return ROWS.map((r) => r.type);
}
/** Look up a row by short code / adtType / alias (case-insensitive). */
export function typeRegistryRow(type) {
    return BY_TYPE.get((type ?? '').toUpperCase());
}
/** Rows of a given phase (P1..P4). */
export function typeRegistryRowsForPhase(phase) {
    return ROWS.filter((r) => r.phase === phase);
}
/** Types whose row declares a create endpoint (the creatable catalog). */
export function typeRegistryCreatableTypes() {
    return ROWS.filter((r) => r.createEndpoint !== undefined).map((r) => r.type);
}
/**
 * All accepted `type` spellings (codes + adtTypes + aliases). Internal —
 * used by the parity tests' superset check; not part of the public surface.
 */
export function typeRegistryAcceptedSpellings() {
    const spellings = [];
    for (const row of ROWS) {
        spellings.push(row.type, row.adtType);
        for (const alias of row.aliases ?? [])
            spellings.push(alias.toUpperCase());
    }
    return spellings;
}
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
export function verbSupport(verb, row) {
    const pinned = row.verbs?.[verb];
    if (pinned)
        return pinned;
    switch (verb) {
        case 'write':
            return row.createEndpoint !== undefined ? { status: 'yes' } : { status: 'no', note: 'no create endpoint' };
        case 'read':
            return { status: 'yes' };
        case 'edit':
            return row.editMode === 'none'
                ? { status: 'no', note: 'this type has no ADT edit face' }
                : { status: 'yes' };
        case 'delete':
            return { status: 'yes' };
    }
}
// ---------------------------------------------------------------------------
// Registry invariants — checked by the parity tests, must hold by construction
// ---------------------------------------------------------------------------
/** Duplicate detection across TYPE CODES and ALIASES (the agent-facing
 * spellings). Sharing an adtType is BY DESIGN for virtual rows (DOMA_VALUE
 * → DOMA/DT) and sub-objects (INDX → TABL/DT) — only agent-facing
 * spellings must be unambiguous. */
export function typeRegistryDuplicateSpellings() {
    const seen = new Map();
    for (const row of ROWS) {
        seen.set(row.type, (seen.get(row.type) ?? 0) + 1);
        for (const alias of row.aliases ?? [])
            seen.set(alias.toUpperCase(), (seen.get(alias.toUpperCase()) ?? 0) + 1);
    }
    return [...seen.entries()].filter(([, n]) => n > 1).map(([s]) => s);
}
//# sourceMappingURL=typeregistry.js.map