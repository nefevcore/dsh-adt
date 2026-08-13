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
    MSAG: { type: 'MSAG/N', uriPrefix: '/sap/bc/adt/msgclass/', label: 'Message Class' },
    'MSAG/N': { type: 'MSAG/N', uriPrefix: '/sap/bc/adt/msgclass/', label: 'Message Class' },
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
 *   - otherwise `name` (+ optional `type`) is resolved by search, preferring
 *     an exact name match; falls back to the by-convention URI.
 */
export async function resolveObject(client, input, maxResults = 10) {
    if (input.objectUri) {
        const uri = input.objectUri.startsWith('/sap/bc/adt')
            ? input.objectUri
            : `/sap/bc/adt${input.objectUri.startsWith('/') ? '' : '/'}${input.objectUri}`;
        const t = normalizeType(input.type);
        return { uri, type: t.type, name: input.name?.toUpperCase() ?? uri.split('/').pop() ?? '', category: t.type.split('/')[0] };
    }
    if (!input.name)
        throw new Error('adt: provide either `objectUri` or `name` (+ optional `type`)');
    const t = normalizeType(input.type);
    const name = input.name.toUpperCase();
    if (t.uriPrefix) {
        return { uri: `${t.uriPrefix}${name.toLowerCase()}`, type: t.type, name, category: t.type.split('/')[0] };
    }
    const hits = await client.searchObjects(name, { maxResults });
    const exact = hits.find((h) => h.objectName.toUpperCase() === name);
    const hit = exact ?? hits[0];
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
export async function resolveObjects(client, inputs) {
    const refs = [];
    for (const input of inputs) {
        refs.push(await resolveObject(client, input));
    }
    return refs;
}
/** Human-readable label for an object type code (best effort). */
export function typeLabel(type) {
    const key = type.toUpperCase();
    if (TYPE_MAP[key])
        return TYPE_MAP[key].label;
    return key;
}
//# sourceMappingURL=resolve.js.map