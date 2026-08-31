/**
 * Type → ADT object-type + URI-prefix mapping for the object types the tools
 * support directly. Short forms ("CLAS") and full forms ("CLAS/OC") both work.
 */
export const TYPE_MAP = {
    CLAS: { type: 'CLAS/OC', uriPrefix: '/sap/bc/adt/oo/classes/', label: 'Class' },
    'CLAS/OC': { type: 'CLAS/OC', uriPrefix: '/sap/bc/adt/oo/classes/', label: 'Class' },
    INTF: { type: 'INTF/OI', uriPrefix: '/sap/bc/adt/oo/interfaces/', label: 'Interface' },
    'INTF/OI': { type: 'INTF/OI', uriPrefix: '/sap/bc/adt/oo/interfaces/', label: 'Interface' },
    PROG: { type: 'PROG/P', uriPrefix: '/sap/bc/adt/programs/programs/', label: 'Program' },
    'PROG/P': { type: 'PROG/P', uriPrefix: '/sap/bc/adt/programs/programs/', label: 'Program' },
    INCL: { type: 'PROG/I', uriPrefix: '/sap/bc/adt/programs/includes/', label: 'Include' },
    'PROG/I': { type: 'PROG/I', uriPrefix: '/sap/bc/adt/programs/includes/', label: 'Include' },
    DDLS: { type: 'DDLS/DF', uriPrefix: '/sap/bc/adt/ddls/sources/', label: 'CDS Data Definition' },
    'DDLS/DF': { type: 'DDLS/DF', uriPrefix: '/sap/bc/adt/ddls/sources/', label: 'CDS Data Definition' },
    DDLX: { type: 'DDLX/EX', uriPrefix: '/sap/bc/adt/ddlx/sources/', label: 'CDS Metadata Extension' },
    'DDLX/EX': { type: 'DDLX/EX', uriPrefix: '/sap/bc/adt/ddlx/sources/', label: 'CDS Metadata Extension' },
    DCLS: { type: 'DCLS/DL', uriPrefix: '/sap/bc/adt/dcls/sources/', label: 'CDS Access Control' },
    'DCLS/DL': { type: 'DCLS/DL', uriPrefix: '/sap/bc/adt/dcls/sources/', label: 'CDS Access Control' },
    BDEF: { type: 'BDEF/BDO', uriPrefix: '/sap/bc/adt/bdef/sources/', label: 'Behavior Definition' },
    'BDEF/BDO': { type: 'BDEF/BDO', uriPrefix: '/sap/bc/adt/bdef/sources/', label: 'Behavior Definition' },
    SRVD: { type: 'SRVD/SRV', uriPrefix: '/sap/bc/adt/srvdef/sources/', label: 'Service Definition' },
    'SRVD/SRV': { type: 'SRVD/SRV', uriPrefix: '/sap/bc/adt/srvdef/sources/', label: 'Service Definition' },
    FUNC: { type: 'FUGR/F', uriPrefix: '/sap/bc/adt/fugr/', label: 'Function Group' },
    'FUGR/F': { type: 'FUGR/F', uriPrefix: '/sap/bc/adt/fugr/', label: 'Function Group' },
    TABL: { type: 'TABL/DT', uriPrefix: '/sap/bc/adt/ddic/tables/', label: 'Table' },
    'TABL/DT': { type: 'TABL/DT', uriPrefix: '/sap/bc/adt/ddic/tables/', label: 'Table' },
    STRU: { type: 'STRU/DT', uriPrefix: '/sap/bc/adt/ddic/structures/', label: 'Structure' },
    'STRU/DT': { type: 'STRU/DT', uriPrefix: '/sap/bc/adt/ddic/structures/', label: 'Structure' },
    DOMA: { type: 'DOMA/DT', uriPrefix: '/sap/bc/adt/ddic/domains/', label: 'Domain' },
    'DOMA/DT': { type: 'DOMA/DT', uriPrefix: '/sap/bc/adt/ddic/domains/', label: 'Domain' },
    DTEL: { type: 'DTEL/DT', uriPrefix: '/sap/bc/adt/ddic/dataelements/', label: 'Data Element' },
    'DTEL/DT': { type: 'DTEL/DT', uriPrefix: '/sap/bc/adt/ddic/dataelements/', label: 'Data Element' },
    TTYP: { type: 'TTYP/DT', uriPrefix: '/sap/bc/adt/ddic/tabletypes/', label: 'Table Type' },
    'TTYP/DT': { type: 'TTYP/DT', uriPrefix: '/sap/bc/adt/ddic/tabletypes/', label: 'Table Type' },
    MSAG: { type: 'MSAG/N', uriPrefix: '/sap/bc/adt/messageclass/', label: 'Message Class' },
    'MSAG/N': { type: 'MSAG/N', uriPrefix: '/sap/bc/adt/messageclass/', label: 'Message Class' },
    DEVC: { type: 'DEVC/K', uriPrefix: '/sap/bc/adt/packages/', label: 'Package' },
    'DEVC/K': { type: 'DEVC/K', uriPrefix: '/sap/bc/adt/packages/', label: 'Package' },
    VIEW: { type: 'VIEW/DT', uriPrefix: '/sap/bc/adt/ddic/views/', label: 'View' },
    'VIEW/DT': { type: 'VIEW/DT', uriPrefix: '/sap/bc/adt/ddic/views/', label: 'View' },
};
export function normalizeType(type) {
    const key = (type ?? '').toUpperCase();
    return TYPE_MAP[key] ?? { type: key || 'CLAS/OC', uriPrefix: '', label: key || 'Object' };
}
/** Build an object reference from name + type (URI constructed by convention). */
export function refFromName(name, type) {
    const t = normalizeType(type);
    const uri = t.uriPrefix
        ? `${t.uriPrefix}${name.toLowerCase()}`
        : `/sap/bc/adt/repository/objects/${name.toLowerCase()}`;
    return { uri, type: t.type, name: name.toUpperCase(), category: t.type.split('/')[0] };
}
/**
 * Resolve a model-supplied object reference to a concrete ADT object:
 *   - `objectUri` wins when given (must start with `/sap/bc/adt`).
 *   - otherwise `name` (+ optional `type`) is resolved: PROG-family types
 *     (PROG vs INCL) share one namespace but live under DIFFERENT URI
 *     prefixes (/programs/programs vs /programs/includes) — a bare name is
 *     resolved via an exact-name search so an include passed as type=PROG
 *     lands on its real URI instead of a 404. All other known types use the
 *     by-convention URI; unknown types fall back to search.
 */
export async function resolveObject(client, input, options = {}) {
    const { maxResults = 10, signal, strict = false, toolName } = options;
    if (input.objectUri) {
        let uri = input.objectUri.startsWith('/sap/bc/adt')
            ? input.objectUri
            : `/sap/bc/adt${input.objectUri.startsWith('/') ? '' : '/'}${input.objectUri}`;
        // Agents frequently copy SOURCE-form URIs (…/source/main) from read/search
        // outputs; the OBJECT form is what every tool wants downstream.
        if (uri.endsWith('/source/main'))
            uri = uri.slice(0, -'/source/main'.length);
        const t = normalizeType(input.type);
        return { uri, type: t.type, name: input.name?.toUpperCase() ?? uri.split('/').pop() ?? '', category: t.type.split('/')[0] };
    }
    if (!input.name)
        throw new Error('adt: provide either `objectUri` or `name` (+ optional `type`)');
    const t = normalizeType(input.type);
    const name = input.name.toUpperCase();
    if (t.uriPrefix) {
        // Ambiguous program family: the caller cannot know from the name alone
        // whether the object is the main program (PROG/P) or an include (PROG/I)
        // — and agents routinely pass type=PROG for includes. Ask the search
        // index for the exact object and use ITS uri/type; fall back to the
        // by-convention URI when search is unavailable or finds nothing.
        if (t.type === 'PROG/P' || t.type === 'PROG/I') {
            try {
                const hits = await client.searchObjects(name, { maxResults, signal });
                const exact = hits.find((h) => h.objectName.toUpperCase() === name);
                if (exact && (exact.type === 'PROG/P' || exact.type === 'PROG/I')) {
                    return {
                        uri: exact.uri,
                        type: exact.type,
                        name,
                        category: 'PROG',
                    };
                }
            }
            catch {
                // search unavailable → conventional URI below
            }
        }
        return { uri: `${t.uriPrefix}${name.toLowerCase()}`, type: t.type, name, category: t.type.split('/')[0] };
    }
    const hits = await client.searchObjects(name, { maxResults, signal });
    const exact = hits.find((h) => h.objectName.toUpperCase() === name);
    if (exact) {
        return {
            uri: exact.uri,
            type: exact.type || t.type,
            name: exact.objectName,
            category: exact.category,
        };
    }
    if (strict) {
        const candidates = hits
            .slice(0, 5)
            .map((h) => `  - ${h.objectName} (${h.type}${h.packageName ? `, package ${h.packageName}` : ''})`);
        throw new Error(`${toolName ? `${toolName}: ` : ''}object '${name}' has no exact match on the backend — mutating tools ` +
            'refuse fuzzy resolution (a near-miss name must not silently act on a different object).' +
            (candidates.length > 0
                ? ` Closest candidates:\n${candidates.join('\n')}\n`
                : ' No search hits at all. ') +
            'Pass `objectUri` (from adt_search / adt_read_object output) or the exact name (+ type).');
    }
    const hit = hits[0];
    if (hit) {
        return {
            uri: hit.uri,
            type: hit.type || t.type,
            name: hit.objectName,
            category: hit.category,
        };
    }
    return refFromName(name, t.type);
}
/** Resolve a list of refs; one bad entry fails the whole call loudly. */
export async function resolveObjects(client, inputs, signal, options = {}) {
    const refs = [];
    for (const input of inputs) {
        refs.push(await resolveObject(client, input, { signal, ...options }));
    }
    return refs;
}
/**
 * Best-effort package lookup for an existing object, used by the permission
 * policy before write/delete/activate. Order matters for security:
 *   1. an exact-name search hit carrying `packageName` (backend FACT) wins;
 *   2. the caller's `hint` is only a fallback for when the backend exposes
 *      nothing — never an override, or a policy-constrained agent could
 *      whitelist any object by claiming a friendly package (audit H1);
 *   3. `undefined` when neither is available — callers must fail closed
 *      (deny) in that case.
 * A FUZZY hit's package is deliberately not used: it describes a different
 * object and would misattribute the policy check.
 */
export async function resolvePackageName(client, ref, hint, signal) {
    try {
        const hits = await client.searchObjects(ref.name, { maxResults: 10, signal });
        const exact = hits.find((h) => h.objectName.toUpperCase() === ref.name.toUpperCase());
        if (exact?.packageName && exact.packageName.trim().length > 0) {
            return exact.packageName.toUpperCase();
        }
    }
    catch {
        // search unavailable → fall through to the hint below
    }
    if (hint && hint.trim().length > 0)
        return hint.trim().toUpperCase();
    return undefined;
}
/** Human-readable label for an object type code (best effort). */
export function typeLabel(type) {
    const key = type.toUpperCase();
    if (TYPE_MAP[key])
        return TYPE_MAP[key].label;
    return key;
}
//# sourceMappingURL=resolve.js.map