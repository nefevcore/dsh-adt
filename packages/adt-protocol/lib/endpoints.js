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
    /** Transport request tree (list). */
    transportOrganizerTree: 'application/vnd.sap.adt.transportorganizertree.v1+xml',
    /** Single transport request. */
    transportOrganizer: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    /** Repository node structure. */
    nodeStructure: 'application/vnd.sap.adt.repository.nodestructure.v1+xml',
    /** Lock result envelope. */
    lockResult: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
    /** Generic source (XML-wrapped). */
    source: 'application/vnd.sap.adt.source.v1+xml',
    /** Debugger variables request/response (ABAP XML). */
    debuggerVariables: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.Variables',
    /** Debugger debuggee/step/listener documents (ABAP XML / dbg namespace). */
    debugger: 'application/vnd.sap.as+xml',
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
    /** Quick object / source search. */
    search: (query) => `${ADT_BASE}/repository/informationsystem/search${toQuery(query)}`,
    /** Where-used references for an object (`?uri=` template). */
    whereUsed: (query) => `${ADT_BASE}/repository/informationsystem/usageReferences${toQuery(query)}`,
    /** Data preview of a DDIC entity (table / structure / view). */
    dataPreviewDdic: (name, query) => `${ADT_BASE}/datapreview/ddic/${encodeURIComponent(name)}${toQuery(query)}`,
    /** Data preview of a CDS view. */
    dataPreviewCds: (name, query) => `${ADT_BASE}/datapreview/cds/${encodeURIComponent(name)}${toQuery(query)}`,
    /** Freestyle SQL data preview. */
    dataPreviewFreestyle: (query) => `${ADT_BASE}/datapreview/freestyle${toQuery(query)}`,
    /** Repository node structure (package contents, tree browsing). */
    nodeStructure: (query) => `${ADT_BASE}/repository/nodestructure${toQuery(query)}`,
    /** Activate a list of objects (POST + `method=activate`). */
    activation: (query) => `${ADT_BASE}/repository/activation${toQuery(query)}`,
    /**
     * Activation — compatibility path used by older / restricted backends
     * (e.g. abapGit-era "Compatibility" ADT profiles, NW 7.4x). The service is
     * registered under `/sap/bc/adt/activation` instead of
     * `/sap/bc/adt/repository/activation` there; the official Eclipse/VS Code
     * ADT client falls back to it automatically.
     */
    activationCompatibility: (query) => `${ADT_BASE}/activation${toQuery(query)}`,
    /** Check run (syntax / ATC reporters). */
    checkRuns: (query) => `${ADT_BASE}/checkruns${toQuery(query)}`,
    /** ABAP Unit run collection (start + poll). */
    unitRuns: (query) => `${ADT_BASE}/abapunit/runs${toQuery(query)}`,
    /** ABAP Unit results. */
    unitResults: (query) => `${ADT_BASE}/abapunit/results${toQuery(query)}`,
    /**
     * ABAP Unit run collection — legacy synchronous path (BASIS < 7.5x).
     *
     * Old / restricted backends never shipped the async run API: `POST
     * /abapunit/runs` is 404 there. They expose only `/abapunit/testruns`,
     * which executes the run synchronously and returns `aunit:runResult`
     * (namespace `http://www.sap.com/adt/aunit`) directly in the POST response
     * — no run id, no polling. Verified on a real NW 7.4x system (D01) and
     * matching the official Eclipse/VS Code ADT client, whose `com.sap.adt.abapunit`
     * bundle posts `aunit:runConfiguration` here with plain `application/xml`
     * (see `AbapUnitRequestContentHandlerV1`).
     */
    unitTestRunsLegacy: (query) => `${ADT_BASE}/abapunit/testruns${toQuery(query)}`,
    /** ATC run collection (start + poll). */
    atcRuns: (query) => `${ADT_BASE}/atc/runs${toQuery(query)}`,
    /** ATC results. */
    atcResults: (query) => `${ADT_BASE}/atc/results${toQuery(query)}`,
    /** CTO transport requests of the current user / system. */
    transportRequests: (query) => `${ADT_BASE}/cts/transportrequests${toQuery(query)}`,
    /** Type-specific object creation endpoints (POST + `package` query param). */
    createByType: {
        CLAS: (query) => `${ADT_BASE}/oo/classes${toQuery(query)}`,
        INTF: (query) => `${ADT_BASE}/oo/interfaces${toQuery(query)}`,
        PROG: (query) => `${ADT_BASE}/programs/programs${toQuery(query)}`,
        FUNC: (query) => `${ADT_BASE}/fugr${toQuery(query)}`,
        DDLS: (query) => `${ADT_BASE}/ddls/sources${toQuery(query)}`,
        TABL: (query) => `${ADT_BASE}/ddic/tables${toQuery(query)}`,
        STRU: (query) => `${ADT_BASE}/ddic/structures${toQuery(query)}`,
        DOMA: (query) => `${ADT_BASE}/ddic/domains${toQuery(query)}`,
        DTEL: (query) => `${ADT_BASE}/ddic/dataelements${toQuery(query)}`,
        TTYP: (query) => `${ADT_BASE}/ddic/tabletypes${toQuery(query)}`,
        MSAG: (query) => `${ADT_BASE}/messageclass${toQuery(query)}`,
        DEVC: (query) => `${ADT_BASE}/packages${toQuery(query)}`,
    },
    /** Modern deletion service (POST + `del:deletionRequest` body). */
    deletion: (query) => `${ADT_BASE}/deletion/delete${toQuery(query)}`,
    /** Runtime dumps feed (ST22 short-dump list; Atom feed, $-style paging). */
    runtimeDumps: (query) => `${ADT_BASE}/runtime/dumps${toQuery(query)}`,
    /** One runtime dump by id; `view` selects default/summary/formatted. */
    runtimeDump: (dumpId, view) => `${ADT_BASE}/runtime/dump/${encodeURIComponent(dumpId)}${view === 'summary' ? '/summary' : view === 'formatted' ? '/formatted' : ''}`,
    /** Execute an ABAP executable program (console output as text/plain). */
    programRun: (programName) => `${ADT_BASE}/programs/programrun/${encodeURIComponent(programName)}`,
    /** Execute an `if_oo_adt_classrun` class (console output as text/plain). */
    classRun: (className) => `${ADT_BASE}/oo/classrun/${encodeURIComponent(className)}`,
    /** Protocol-level `$batch` (multipart/mixed embedded HTTP requests). */
    batch: () => `${ADT_BASE}/$batch`,
    /** Debugger core resource (steps / variable access via `?method=`). */
    debugger: (query) => `${ADT_BASE}/debugger${toQuery(query)}`,
    /** Debugger listener registration (POST listen / GET status / DELETE detach). */
    debuggerListeners: (query) => `${ADT_BASE}/debugger/listeners${toQuery(query)}`,
    /** Debugger breakpoint collection (external scope). */
    debuggerBreakpoints: (query) => `${ADT_BASE}/debugger/breakpoints${toQuery(query)}`,
    /** One debugger breakpoint by id. */
    debuggerBreakpoint: (id, query) => `${ADT_BASE}/debugger/breakpoints/${encodeURIComponent(id)}${toQuery(query)}`,
    /** Debugger call stack (absent on older backends, e.g. 7.50 → 404). */
    debuggerStack: (query) => `${ADT_BASE}/debugger/stack${toQuery(query)}`,
    /**
     * Textelements subsources of a program (plain-text custom format):
     * `symbols` (text symbols I), `selections` (selection texts S),
     * `headings` (list headings H).
     */
    textElements: (programName, subsource) => `${ADT_BASE}/textelements/programs/${encodeURIComponent(programName)}/source/${subsource}`,
};
//# sourceMappingURL=endpoints.js.map