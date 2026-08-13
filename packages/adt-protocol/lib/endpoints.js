/**
 * ADT REST endpoint catalog.
 *
 * Every path is relative to the destination base URL and lives under the
 * standard ADT base path `/sap/bc/adt`. Media types follow SAP's
 * `application/vnd.sap.adt.*` / `application/vnd.sap.*` conventions. The
 * catalog is cross-checked against production open-source clients
 * (`@mcp-abap-adt/adt-clients`, `abap-adt-api`, `vscode_abap_remote_fs`) and
 * SAP's published BTP REST documentation.
 */
export const ADT_BASE = '/sap/bc/adt';
export const MEDIA = {
    /** Discovery service response (AtomPub). */
    discovery: 'application/atomsvc+xml',
    /** Object reference list (adtcore). */
    objectList: 'application/vnd.sap.adt.objectlist.v1+xml',
    /** A single object reference. */
    object: 'application/vnd.sap.adt.object.v1+xml',
    /** Activation request/response. */
    activation: 'application/vnd.sap.adt.activation+xml',
    /** Check run request. */
    checkObjects: 'application/vnd.sap.adt.checkobjects+xml',
    /** Check run result. */
    checkMessages: 'application/vnd.sap.adt.checkmessages+xml',
    /** ABAP Unit run request (official SAP_COM_0735 format). */
    abapUnitRun: 'application/vnd.sap.adt.api.abapunit.run.v1+xml',
    /** ABAP Unit run status. */
    abapUnitRunStatus: 'application/vnd.sap.adt.api.abapunit.run-status.v1+xml',
    /** ABAP Unit results (JUnit XML). */
    abapUnitResult: 'application/vnd.sap.adt.api.junit.run-result.v1+xml',
    /** ATC run parameters (start request). */
    atcRunParameters: 'application/vnd.sap.atc.run.parameters.v1+xml',
    /** ATC run / status. */
    atcRun: 'application/vnd.sap.atc.run.v1+xml',
    /** ATC results (checkstyle XML). */
    atcResult: 'application/vnd.sap.atc.checkstyle.v1+xml',
    /** Transport request tree (list). */
    transportOrganizerTree: 'application/vnd.sap.adt.transportorganizertree.v1+xml',
    /** Single transport request. */
    transportOrganizer: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    /** Repository node structure. */
    nodeStructure: 'application/vnd.sap.adt.repository.nodestructure.v1+xml',
    /** Package collection. */
    packages: 'application/vnd.sap.adt.packages.v2+xml',
    /** Lock result envelope. */
    lockResult: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
    /** Generic source (XML-wrapped). */
    source: 'application/vnd.sap.adt.source.v1+xml',
    /** Plain ABAP source. */
    abapSource: 'application/vnd.sap.adt.abapsource.v1+xml',
    /** Error body. */
    error: 'application/xml',
};
/** Build a query string from parameters (ADT style: repeated keys allowed). */
export function toQuery(params) {
    if (!params)
        return '';
    const parts = [];
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined)
            continue;
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
    return parts.length ? `?${parts.join('&')}` : '';
}
export const ENDPOINTS = {
    /** Service discovery — CSRF probe endpoint; lists every ADT service. */
    discovery: () => `${ADT_BASE}/core/discovery`,
    /** Legacy discovery (BASIS ≤ 7.40). */
    discoveryLegacy: () => `${ADT_BASE}/discovery`,
    /** ATO settings (ABAP Cloud / release info). */
    atoSettings: () => `${ADT_BASE}/ato/settings`,
    /** Repository information system (search + metadata). */
    informationsystem: (query) => `${ADT_BASE}/repository/informationsystem${toQuery(query)}`,
    /** Quick object / source search. */
    search: (query) => `${ADT_BASE}/repository/informationsystem/search${toQuery(query)}`,
    /** Repository node structure (package contents, tree browsing). */
    nodeStructure: (query) => `${ADT_BASE}/repository/nodestructure${toQuery(query)}`,
    /** Activate a list of objects (POST + `method=activate`). */
    activation: (query) => `${ADT_BASE}/repository/activation${toQuery(query)}`,
    /** Check run (syntax / ATC reporters). */
    checkRuns: (query) => `${ADT_BASE}/checkruns${toQuery(query)}`,
    /** ABAP Unit run collection (start + poll). */
    unitRuns: (query) => `${ADT_BASE}/abapunit/runs${toQuery(query)}`,
    /** ABAP Unit results. */
    unitResults: (query) => `${ADT_BASE}/abapunit/results${toQuery(query)}`,
    /** ATC run collection (start + poll). */
    atcRuns: (query) => `${ADT_BASE}/atc/runs${toQuery(query)}`,
    /** ATC results. */
    atcResults: (query) => `${ADT_BASE}/atc/results${toQuery(query)}`,
    /** CTO transport requests of the current user / system. */
    transportRequests: (query) => `${ADT_BASE}/cts/transportrequests${toQuery(query)}`,
    /** Packages endpoint. */
    packages: (query) => `${ADT_BASE}/packages${toQuery(query)}`,
    /** Type-specific object creation endpoints (POST + `package` query param). */
    createByType: {
        CLAS: (query) => `${ADT_BASE}/oo/classes${toQuery(query)}`,
        INTF: (query) => `${ADT_BASE}/oo/interfaces${toQuery(query)}`,
        PROG: (query) => `${ADT_BASE}/programs/programs${toQuery(query)}`,
        FUNC: (query) => `${ADT_BASE}/fugr${toQuery(query)}`,
        DDLS: (query) => `${ADT_BASE}/ddls/sources${toQuery(query)}`,
        TABL: (query) => `${ADT_BASE}/ddic/tables${toQuery(query)}`,
        STRU: (query) => `${ADT_BASE}/ddic/structures${toQuery(query)}`,
        MSAG: (query) => `${ADT_BASE}/msgclass${toQuery(query)}`,
        DEVC: (query) => `${ADT_BASE}/packages${toQuery(query)}`,
    },
    /** Source access for an object: `<uri>/source/main`. */
    objectSource: (objectUri, query) => `${objectUri}/source/main${toQuery(query)}`,
    /** System time / ping (lightweight reachability probe). */
    systemTime: () => `${ADT_BASE}/core/system/time`,
};
/** Human-readable object type labels (used when search does not provide them). */
export const OBJECT_TYPE_LABELS = {
    'CLAS/OC': 'Class (Class Pool)',
    'CLAS/OM': 'Class Method',
    'CLAS/I': 'Class Include',
    'INTF/OI': 'Interface',
    'PROG/P': 'Program',
    'PROG/I': 'Include',
    'FUGR/F': 'Function Group',
    'FUGR/FF': 'Function Module',
    'FUGR/I': 'Function Group Include',
    'DDLS/DF': 'CDS Data Definition',
    'DCLS/DL': 'CDS Access Control',
    'DDLX/EX': 'CDS Metadata Extension',
    'BDEF/BDO': 'Behavior Definition',
    'SRVD/SRV': 'Service Definition',
    'STOB/DO': 'CDS Entity',
    'TABL/DT': 'Table',
    'STRU/DT': 'Structure',
    'MSAG/N': 'Message Class',
    'TYPE/TY': 'Type Group',
    'DEVC/K': 'Package',
    'R3TR/CLAS': 'Class',
    'R3TR/INTF': 'Interface',
    'R3TR/PROG': 'Program',
    'R3TR/FUNC': 'Function Group',
    'R3TR/TABL': 'Table',
    'R3TR/VIEW': 'View',
    'R3TR/DDLS': 'CDS View',
    'R3TR/DEVC': 'Package',
};
//# sourceMappingURL=endpoints.js.map