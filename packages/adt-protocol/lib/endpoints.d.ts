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
export declare const ADT_BASE = "/sap/bc/adt";
/** Query parameters shared by all ADT requests. */
export interface AdtQueryParams {
    client?: string;
    language?: string;
    [key: string]: string | number | boolean | undefined;
}
export declare const MEDIA: {
    /** Discovery service response (AtomPub). */
    readonly discovery: "application/atomsvc+xml";
    /** Object reference list (adtcore). */
    readonly objectList: "application/vnd.sap.adt.objectlist.v1+xml";
    /** A single object reference. */
    readonly object: "application/vnd.sap.adt.object.v1+xml";
    /** Activation request/response. */
    readonly activation: "application/vnd.sap.adt.activation+xml";
    /** Check run request. */
    readonly checkObjects: "application/vnd.sap.adt.checkobjects+xml";
    /** Check run result. */
    readonly checkMessages: "application/vnd.sap.adt.checkmessages+xml";
    /** ABAP Unit run request (official SAP_COM_0735 format). */
    readonly abapUnitRun: "application/vnd.sap.adt.api.abapunit.run.v1+xml";
    /** ABAP Unit run status. */
    readonly abapUnitRunStatus: "application/vnd.sap.adt.api.abapunit.run-status.v1+xml";
    /** ABAP Unit results (JUnit XML). */
    readonly abapUnitResult: "application/vnd.sap.adt.api.junit.run-result.v1+xml";
    /** ATC run parameters (start request). */
    readonly atcRunParameters: "application/vnd.sap.atc.run.parameters.v1+xml";
    /** ATC run / status. */
    readonly atcRun: "application/vnd.sap.atc.run.v1+xml";
    /** ATC results (checkstyle XML). */
    readonly atcResult: "application/vnd.sap.atc.checkstyle.v1+xml";
    /** Transport request tree (list). */
    readonly transportOrganizerTree: "application/vnd.sap.adt.transportorganizertree.v1+xml";
    /** Single transport request. */
    readonly transportOrganizer: "application/vnd.sap.adt.transportorganizer.v1+xml";
    /** Repository node structure. */
    readonly nodeStructure: "application/vnd.sap.adt.repository.nodestructure.v1+xml";
    /** Package collection. */
    readonly packages: "application/vnd.sap.adt.packages.v2+xml";
    /** Lock result envelope. */
    readonly lockResult: "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result";
    /** Generic source (XML-wrapped). */
    readonly source: "application/vnd.sap.adt.source.v1+xml";
    /** Plain ABAP source. */
    readonly abapSource: "application/vnd.sap.adt.abapsource.v1+xml";
    /** Error body. */
    readonly error: "application/xml";
};
/** Build a query string from parameters (ADT style: repeated keys allowed). */
export declare function toQuery(params: AdtQueryParams | undefined): string;
export declare const ENDPOINTS: {
    /** Service discovery — CSRF probe endpoint; lists every ADT service. */
    readonly discovery: () => string;
    /** Legacy discovery (BASIS ≤ 7.40). */
    readonly discoveryLegacy: () => string;
    /** ATO settings (ABAP Cloud / release info). */
    readonly atoSettings: () => string;
    /** Repository information system (search + metadata). */
    readonly informationsystem: (query?: AdtQueryParams) => string;
    /** Quick object / source search. */
    readonly search: (query: AdtQueryParams) => string;
    /** Where-used references for an object (`?uri=` template). */
    readonly whereUsed: (query?: AdtQueryParams) => string;
    /** Where-used scope (searchable object types) for an object. */
    readonly whereUsedScope: (query?: AdtQueryParams) => string;
    /** Data preview of a DDIC entity (table / structure / view). */
    readonly dataPreviewDdic: (name: string, query?: AdtQueryParams) => string;
    /** Data preview of a CDS view. */
    readonly dataPreviewCds: (name: string, query?: AdtQueryParams) => string;
    /** Freestyle SQL data preview. */
    readonly dataPreviewFreestyle: (query?: AdtQueryParams) => string;
    /** Repository node structure (package contents, tree browsing). */
    readonly nodeStructure: (query?: AdtQueryParams) => string;
    /** Activate a list of objects (POST + `method=activate`). */
    readonly activation: (query?: AdtQueryParams) => string;
    /**
     * Activation — compatibility path used by older / restricted backends
     * (e.g. abapGit-era "Compatibility" ADT profiles, NW 7.4x). The service is
     * registered under `/sap/bc/adt/activation` instead of
     * `/sap/bc/adt/repository/activation` there; the official Eclipse/VS Code
     * ADT client falls back to it automatically.
     */
    readonly activationCompatibility: (query?: AdtQueryParams) => string;
    /** Check run (syntax / ATC reporters). */
    readonly checkRuns: (query?: AdtQueryParams) => string;
    /** ABAP Unit run collection (start + poll). */
    readonly unitRuns: (query?: AdtQueryParams) => string;
    /** ABAP Unit results. */
    readonly unitResults: (query?: AdtQueryParams) => string;
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
    readonly unitTestRunsLegacy: (query?: AdtQueryParams) => string;
    /** ATC run collection (start + poll). */
    readonly atcRuns: (query?: AdtQueryParams) => string;
    /** ATC results. */
    readonly atcResults: (query?: AdtQueryParams) => string;
    /** CTO transport requests of the current user / system. */
    readonly transportRequests: (query?: AdtQueryParams) => string;
    /** Packages endpoint. */
    readonly packages: (query?: AdtQueryParams) => string;
    /** Type-specific object creation endpoints (POST + `package` query param). */
    readonly createByType: {
        readonly CLAS: (query?: AdtQueryParams) => string;
        readonly INTF: (query?: AdtQueryParams) => string;
        readonly PROG: (query?: AdtQueryParams) => string;
        readonly FUNC: (query?: AdtQueryParams) => string;
        readonly DDLS: (query?: AdtQueryParams) => string;
        readonly TABL: (query?: AdtQueryParams) => string;
        readonly STRU: (query?: AdtQueryParams) => string;
        readonly DOMA: (query?: AdtQueryParams) => string;
        readonly DTEL: (query?: AdtQueryParams) => string;
        readonly TTYP: (query?: AdtQueryParams) => string;
        readonly MSAG: (query?: AdtQueryParams) => string;
        readonly DEVC: (query?: AdtQueryParams) => string;
    };
    /** Source access for an object: `<uri>/source/main`. */
    readonly objectSource: (objectUri: string, query?: AdtQueryParams) => string;
    /** Modern deletion service (POST + `del:deletionRequest` body). */
    readonly deletion: (query?: AdtQueryParams) => string;
    /** Deletion pre-check service. */
    readonly deletionCheck: (query?: AdtQueryParams) => string;
    /** System time / ping (lightweight reachability probe). */
    readonly systemTime: () => string;
    /** Runtime dumps feed (ST22 short-dump list; Atom feed, $-style paging). */
    readonly runtimeDumps: (query?: AdtQueryParams) => string;
    /** One runtime dump by id; `view` selects default/summary/formatted. */
    readonly runtimeDump: (dumpId: string, view?: "default" | "summary" | "formatted") => string;
    /** Execute an ABAP executable program (console output as text/plain). */
    readonly programRun: (programName: string) => string;
    /** Execute an `if_oo_adt_classrun` class (console output as text/plain). */
    readonly classRun: (className: string) => string;
    /** Protocol-level `$batch` (multipart/mixed embedded HTTP requests). */
    readonly batch: () => string;
};
/** Human-readable object type labels (used when search does not provide them). */
export declare const OBJECT_TYPE_LABELS: Record<string, string>;
//# sourceMappingURL=endpoints.d.ts.map