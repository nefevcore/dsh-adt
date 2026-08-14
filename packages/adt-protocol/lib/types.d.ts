/**
 * Core types for the ADT protocol client.
 *
 * These mirror the XML/JSON shapes exchanged with the ABAP backend's
 * `/sap/bc/adt` HTTP service. Only the shapes this client actually produces
 * or consumes are modeled.
 */
/** How the client authenticates against the ABAP front-end server. */
export type AdtAuth = {
    type: 'basic';
    username: string;
    password: string;
} | {
    type: 'none';
};
/** A configured ABAP system the client can talk to. */
export interface AdtDestination {
    /** Stable identifier, used by tools and logs. */
    name: string;
    /** Scheme + host + port, e.g. `https://sap.example.com:443` or `http://host:8000`. */
    url: string;
    /** SAP client (mandant), e.g. `100`. */
    client?: string;
    /** Logon language, e.g. `EN`, `ZH`. */
    language?: string;
    auth: AdtAuth;
    /** Verify TLS certificates (default true). */
    strictSSL?: boolean;
    /** Per-request timeout in ms (default 60_000). */
    timeoutMs?: number;
    /** When true, the client is served by the local mock server (testing/demo). */
    mock?: boolean;
}
/** A reference to one ABAP development object on the server. */
export interface AdtObjectRef {
    /** ADT object URI, e.g. `/sap/bc/adt/oo/classes/zcl_demo`. */
    uri: string;
    /** Object type name as known to ADT, e.g. `CLAS/OC`. */
    type: string;
    /** Object name, e.g. `ZCL_DEMO`. */
    name: string;
    /** Technical category used by activation, e.g. `DDLS`, `CLAS`. */
    category?: string;
    /** Parent (for includes/main variants). */
    parentUri?: string;
}
/** Result of the `/core/discovery` service. */
export interface AdtDiscovery {
    /** Service collection links advertised by the backend. */
    services: AdtServiceLink[];
    /** Backend feature flags (ABAP Cloud vs classic). */
    features: Record<string, string>;
}
export interface AdtServiceLink {
    /** Relative path of the service, e.g. `/sap/bc/adt/repository/informationsystem`. */
    href: string;
    /** Media type the service speaks. */
    mediaType: string;
    /** Short description, when present. */
    description?: string;
}
/** One hit of an object search. */
export interface AdtObjectSearchHit {
    objectName: string;
    description: string;
    type: string;
    /** Human readable type label, e.g. `Class (Class Pool)`. */
    typeLabel: string;
    /** Parent package name, when reported. */
    packageName?: string;
    /** URI usable with `readObjectSource`. */
    uri: string;
    /** Optional technical category. */
    category?: string;
    /** When true, the object is a "main" variant (e.g. class main include). */
    mainProgram?: boolean;
    /** Master language when reported. */
    masterLanguage?: string;
    /** Responsible / owner when reported. */
    responsible?: string;
    /** Timestamp of last change when reported. */
    changedAt?: string;
    /** The user that last changed the object, when reported. */
    changedBy?: string;
}
/** A full-text source search hit. */
export interface AdtSourceSearchHit {
    objectName: string;
    type: string;
    uri: string;
    /** One-line excerpt around the match. */
    line: string;
    /** Line number of the match (1-based). */
    lineNumber?: number;
}
export interface AdtSearchResult {
    /** Number of hits actually returned. */
    count: number;
    /** Quick-search raw text used. */
    query: string;
    /** Object name hits. */
    objects: AdtObjectSearchHit[];
    /** Full-text source hits. */
    sources: AdtSourceSearchHit[];
    /** Set when the backend degraded the requested operation (e.g. source
     * search unsupported) — callers should surface this to the user. */
    note?: string;
}
/** Metadata block of a read object (property list). */
export interface AdtObjectProperty {
    key: string;
    value: string;
}
/** One entry of an ADT object version-history feed (Atom). */
export interface AdtObjectVersion {
    /** Version id from the feed entry (e.g. `00000`). */
    versionId: string;
    /** User who saved this version, when reported. */
    author?: string;
    /** ISO timestamp of the version, when reported. */
    updatedAt?: string;
    /** Version title (usually the transport request/task description). */
    title?: string;
    /** Content URI of the version source. */
    contentUri?: string;
    /** Transport request (or open task) the version was saved into. */
    transportRequest?: string;
    /** Description of that transport request/task. */
    transportDescription?: string;
}
/** One where-used reference: an object that references/depends on the queried object. */
export interface AdtWhereUsedReference {
    name: string;
    type: string;
    /** Object URI of the referencing object. */
    uri: string;
    /** Package of the referencing object, when reported. */
    packageName?: string;
    /** Responsible user, when reported. */
    responsible?: string;
    /** Free-text usage info, when reported. */
    usageInformation?: string;
}
export interface AdtWhereUsedResult {
    /** The queried object URI. */
    objectUri: string;
    totalReferences: number;
    references: AdtWhereUsedReference[];
}
/** Column metadata of a data-preview result. */
export interface AdtDataPreviewColumn {
    name: string;
    type: string;
    description?: string;
    length?: number;
}
export interface AdtDataPreview {
    /** Entity (table / CDS view) or the SQL query that was previewed. */
    name: string;
    totalRows: number;
    queryExecutionTime?: number;
    columns: AdtDataPreviewColumn[];
    /** Row-major values (column name → string/null). */
    rows: Array<Record<string, string | null>>;
    /** Raw XML excerpt when parsing was only partial. */
    rawXml?: string;
}
/** Lock state of an object, when the backend exposes it. */
export interface AdtObjectLockInfo {
    /** True/False when the backend reports a lock; undefined when not exposed. */
    locked: boolean | undefined;
    /** Lock owner user, when reported. */
    lockedBy?: string;
    /** Transport request the lock is assigned to, when reported. */
    transport?: string;
    /** Human note (e.g. why the state is unknown). */
    note?: string;
}
/** Raw source read from the backend. */
export interface AdtSource {
    /** The source text (UTF-8, CRLF-normalized to LF). */
    source: string;
    /** ADT media type of the source, e.g. `application/vnd.sap.adt.abapsource.v1+xml`. */
    mediaType: string;
    /** Object URI the source belongs to. */
    uri: string;
    /** Extra properties reported by the backend (e.g. changedAt, responsible). */
    properties: AdtObjectProperty[];
    /** Indented full XML of the wrapper when the response is the XML-wrapped form. */
    rawXml?: string;
}
/** Result of an activation request. */
export interface AdtActivationResult {
    /** `true` when every object activated without errors. */
    success: boolean;
    /** Per-object outcome. */
    items: AdtActivationItem[];
}
export interface AdtActivationItem {
    uri: string;
    type: string;
    name: string;
    /** `ACTIVATED`, `SKIPPED`, `ERROR`, ... */
    status: string;
    /** Human-readable message. */
    message?: string;
    /** Message type: `E` error, `W` warning, `S` success, `I` info. */
    severity?: string;
    /** Syntax-check messages attached to this object (type E blocks activation). */
    syntaxErrors: AdtMessage[];
}
export interface AdtMessage {
    severity: 'E' | 'W' | 'I' | 'S' | 'A';
    /** Short message text. */
    text: string;
    /** Message id, e.g. `CL_MESSAGE_HELPER=>...`. */
    id?: string;
    /** Line number in the source, 1-based. */
    line?: number;
    /** Offset within the line. */
    offset?: number;
    /** Error code, e.g. `CM001`. */
    code?: string;
    /** Long text, when present. */
    longText?: string;
}
export type AdtTestStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR' | 'ABORTED' | 'IN_PROGRESS' | 'DISABLED';
/** One ABAP Unit test method result. */
export interface AdtUnitTestMethod {
    className: string;
    methodName: string;
    status: AdtTestStatus;
    /** Runtime in milliseconds. */
    durationMs: number;
    /** Failure message, when failed. */
    message?: string;
    /** Stack / long text, when failed. */
    longText?: string;
    /** Position info, when reported. */
    line?: number;
    offset?: number;
}
/** Result of one executed unit test class. */
export interface AdtUnitTestClass {
    className: string;
    status: AdtTestStatus;
    /** Executed tests in this class. */
    tests: AdtUnitTestMethod[];
}
/** Full ABAP Unit run result. */
export interface AdtUnitRunResult {
    success: boolean;
    overall: 'SUCCESS' | 'FAILED' | 'ABORTED';
    /** Number of executed test methods. */
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    durationMs: number;
    classes: AdtUnitTestClass[];
}
export type AdtAtcSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'CATASTROPHIC';
/** One entry of the ATC results collection (`GET /atc/results`). */
export interface AdtAtcRunSummary {
    /** Result display id (usable with {@link getAtcResult}). */
    displayId: string;
    /** Run title, e.g. `External Request 14.08.2026 07:28:28`. */
    title?: string;
    /** ATC check variant used for the run. */
    checkVariant?: string;
    /** Creation timestamp, when reported. */
    createdAt?: string;
    /** User who created/triggered the run, when reported. */
    createdBy?: string;
    /** Run state, when reported. */
    status?: string;
    /** Kind: `central` (central check) vs local, when reported. */
    kind?: string;
    /** Finding aggregates (priorities 1-4 + failures), when reported. */
    aggregates?: AdtAtcAggregates;
    /** Any additional attributes the backend reports. */
    attributes: Record<string, string>;
}
/** ATC finding severity counts for one run. */
export interface AdtAtcAggregates {
    /** Priority 1 (very critical) findings. */
    priority1: number;
    /** Priority 2 (critical) findings. */
    priority2: number;
    /** Priority 3 (warning) findings. */
    priority3: number;
    /** Priority 4 (info) findings. */
    priority4: number;
    /** Failed checks. */
    failures: number;
}
/** One ATC finding. */
export interface AdtAtcFinding {
    check: string;
    /** ATC check title, e.g. `Performence` → human readable. */
    checkTitle: string;
    severity: AdtAtcSeverity;
    message: string;
    /** Object the finding belongs to. */
    objectName: string;
    uri: string;
    line?: number;
    offset?: number;
    /** ATC check variant message id. */
    messageId?: string;
    /** Long text of the finding. */
    longText?: string;
}
/** ATC run result. */
export interface AdtAtcResult {
    success: boolean;
    /** `true` when no findings above INFO. */
    clean: boolean;
    findings: AdtAtcFinding[];
    /** Counts by severity. */
    counts: Record<AdtAtcSeverity, number>;
    /** Run duration in ms. */
    durationMs: number;
    /** The ATC variant used. */
    variant?: string;
    /** `true` when the run was executed asynchronously and results are partial. */
    async?: boolean;
    /** Result display id this result belongs to (when fetched by id). */
    displayId?: string;
    /** Run title, when the result body reports it. */
    title?: string;
    /** Check variant the run used. */
    checkVariant?: string;
    /** Aggregated finding counts for the run. */
    aggregates?: AdtAtcAggregates;
    /** Raw response body, kept when the format is not checkstyle XML. */
    rawXml?: string;
}
/** One transport request (CTO request). */
export interface AdtTransport {
    /** Request number, e.g. `S4HK900001`. */
    number: string;
    description: string;
    /** `N` new, `M` modifiable, `R` released, `L` locked... */
    status: string;
    /** `K` workbench (development/repair), `C` customizing, `T` transport of copies... */
    category: string;
    owner: string;
    /** System id. */
    system: string;
    client: string;
    /** Creation timestamp. */
    createdAt?: string;
    /** RFC destination of the target system when released. */
    target?: string;
    /** `false` when the request is released. */
    modifiable: boolean;
    /** Request task items, when requested. */
    items?: AdtTransportItem[];
}
export interface AdtTransportItem {
    uri: string;
    type: string;
    name: string;
    description: string;
    /** `I` insert / add, `D` delete... */
    action: string;
}
/** Syntax check result (reuses activation messages). */
export interface AdtCheckResult {
    success: boolean;
    messages: AdtMessage[];
}
/** System information summary. */
export interface AdtSystemInfo {
    destination: string;
    /** ABAP system id, e.g. `S4H`. */
    systemId: string;
    /** SAP release, e.g. `757`. */
    release: string;
    /** Detailed SAP_BASIS release. */
    basisRelease?: string;
    /** Whether the system advertises ABAP Cloud features. */
    abapCloud: boolean;
    /** Feature flags from discovery. */
    features: Record<string, string>;
    /** Number of advertised services. */
    serviceCount: number;
    /** Logged-on user (from the systeminformation endpoint, when available). */
    userName?: string;
    /** SAP client in use. */
    client?: string;
    /** Logon language. */
    language?: string;
}
/** Object types understood by the create service. */
export type AdtCreatableObjectType = 'CLAS' | 'INTF' | 'PROG' | 'FUNC' | 'DDLS' | 'TABL' | 'STRU' | 'MSAG' | 'PACK' | 'DEVC';
export interface AdtCreateObjectRequest {
    destination: string;
    type: AdtCreatableObjectType;
    name: string;
    description: string;
    /** Package (development package / $TMP for local objects). */
    packageName: string;
    /** For CLAS: `separable` (global class) or `include`. */
    subclass?: string;
    /** For CLAS: use the default (global class) when true. */
    defaultValues?: boolean;
    /** Transport request when a package requires one. */
    transport?: string;
    /** Additional properties passed to the create dialog service. */
    properties?: Record<string, string>;
}
export interface AdtCreateObjectResult {
    /** `true` when the object was created. */
    success: boolean;
    /** The created object reference. */
    object?: AdtObjectRef;
    /** URI of the newly created object. */
    uri?: string;
    /** Messages (e.g. warnings). */
    messages: AdtMessage[];
}
//# sourceMappingURL=types.d.ts.map