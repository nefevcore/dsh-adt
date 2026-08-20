/**
 * ADT protocol client.
 *
 * Implements the wire protocol of the SAP ABAP Development Tools HTTP
 * service (`/sap/bc/adt`): session cookies, CSRF tokens, Basic auth, the
 * `application/vnd.sap.adt.*` media types, and the operations needed for
 * agent-driven development — search, read/write source, activate, check,
 * ABAP Unit (async runs), ATC (async runs), transports, packages and object
 * creation.
 *
 * Protocol facts are cross-checked against production open-source clients
 * (`@mcp-abap-adt/adt-clients`, `abap-adt-api`, `vscode_abap_remote_fs`) and
 * SAP's published BTP REST documentation; see docs/adt-protocol-notes.md.
 * The client is deliberately free of any SAP proprietary library: it speaks
 * the documented HTTP protocol directly and can talk to any ABAP front-end
 * server that exposes the ADT service (classic NetWeaver and ABAP Cloud).
 */
import { type XmlNode } from './xml.js';
import type { AdtActivationResult, AdtAtcResult, AdtAtcRunSummary, AdtBatchRequestPart, AdtBatchResponsePart, AdtCheckResult, AdtCreateObjectRequest, AdtCreateObjectResult, AdtDestination, AdtDiscovery, AdtDumpDetail, AdtDumpSummary, AdtMessage, AdtObjectRef, AdtObjectSearchHit, AdtObjectVersion, AdtObjectLockInfo, AdtRunResult, AdtSearchResult, AdtSource, AdtSourceSearchHit, AdtStructureChanges, AdtStructureData, AdtStructureKind, AdtStructureWriteResult, AdtSystemInfo, AdtTransport, AdtUnitRunResult, AdtWhereUsedResult, AdtDataPreview } from './types.js';
/** Error raised for HTTP-level or protocol-level failures. */
export declare class AdtError extends Error {
    readonly status?: number | undefined;
    readonly adtMessages: AdtMessage[];
    readonly responseBody?: string | undefined;
    constructor(message: string, status?: number | undefined, adtMessages?: AdtMessage[], responseBody?: string | undefined);
}
interface AdtRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    /** Full path with query, e.g. `/sap/bc/adt/core/discovery`. */
    path: string;
    body?: string;
    accept?: string;
    contentType?: string;
    /** Extra headers. */
    headers?: Record<string, string>;
    /** Skip CSRF token handling (for the CSRF probe itself). */
    noCsrf?: boolean;
    /** Do not throw on error status; return the raw response. */
    raw?: boolean;
    timeoutMs?: number;
    /** Send `x-sap-adt-sessiontype: stateful` (write chains). */
    stateful?: boolean;
    /**
     * Cooperative cancellation, aborting the underlying fetch. The caller-owned
     * signal is linked with the per-request timeout controller: whichever fires
     * first aborts the request. An abort surfaces as an `AdtError` whose message
     * says `aborted`; a timeout as one that says `timed out`.
     */
    signal?: AbortSignal;
}
interface AdtResponse {
    status: number;
    headers: Headers;
    text: string;
}
/** Parse an ADT message list from `<...:message>` / `<exc:exception>` elements. */
export declare function parseAdtMessages(root: XmlNode): AdtMessage[];
export declare class AdtClient {
    readonly destination: AdtDestination;
    private readonly cookies;
    private csrfToken;
    private readonly base;
    private readonly fetchImpl;
    /** Connection identifier sent as `sap-adt-connection-id` on every request. */
    private readonly connectionId;
    constructor(destination: AdtDestination, fetchImpl?: typeof fetch);
    private buildUrl;
    private cookieHeader;
    private storeCookies;
    /** Base query parameters (client + language) merged with extras. */
    private baseQuery;
    /**
     * Perform one ADT request. State-changing requests transparently obtain and
     * attach the CSRF token; the request is retried once when the server
     * invalidates the session token (403 + CSRF hint or 401 on a write).
     */
    request(options: AdtRequestOptions): Promise<AdtResponse>;
    /** Fetch (and cache) the CSRF token via the standard discovery probe. */
    private ensureCsrfToken;
    /** Reset cached session state (cookies + CSRF). */
    resetSession(): void;
    /** Fetch the discovery document (AtomPub service doc; tolerant of simple XML). */
    discover(options?: {
        signal?: AbortSignal;
    }): Promise<AdtDiscovery>;
    /**
     * System id / release / ABAP Cloud info.
     *
     * Prefers the structured `core/http/systeminformation` JSON endpoint (SID,
     * client, language, user); falls back to discovery feature flags when the
     * endpoint is unavailable.
     */
    systemInfo(options?: {
        signal?: AbortSignal;
    }): Promise<AdtSystemInfo>;
    /**
     * Quick search: objects by name/description and (where supported) full-text
     * source search. `operation` is `quickSearch` (default), `quickSearchSource`
     * or `objectSearch`.
     *
     * Real-world resilience: some backends (e.g. S/4HANA with limited search
     * providers) return HTTP 500 for `quickSearchSource`/`objectSearch`; this
     * method then retries with plain `quickSearch` and marks what it could not
     * deliver via the `note` field.
     */
    search(query: string, options?: {
        maxResults?: number;
        operation?: string;
        objectType?: string;
        packageName?: string;
        signal?: AbortSignal;
    }): Promise<AdtSearchResult>;
    /** Search only for objects (name/description), no source search. */
    searchObjects(query: string, options?: {
        maxResults?: number;
        objectType?: string;
        signal?: AbortSignal;
    }): Promise<AdtObjectSearchHit[]>;
    /** Full-text search inside ABAP sources (empty when unsupported). */
    searchSource(query: string, options?: {
        maxResults?: number;
        signal?: AbortSignal;
    }): Promise<AdtSourceSearchHit[]>;
    /**
     * Read the main source of an object by its ADT URI. `version` selects the
     * active or inactive representation (`?version=active|inactive`); without
     * it the backend returns the CURRENT source — the inactive version when
     * one exists, else the active one.
     */
    readSource(objectUri: string, options?: {
        version?: 'active' | 'inactive';
        signal?: AbortSignal;
    }): Promise<AdtSource>;
    /**
     * Write the main source of an object. The caller is expected to lock first
     * and pass the lock handle (from {@link lock}) as `lockHandle`.
     */
    writeSource(objectUri: string, source: string, options?: {
        lockHandle?: string;
        transport?: string;
        signal?: AbortSignal;
    }): Promise<void>;
    /**
     * Lock an object for editing. Returns the lock handle (required by write /
     * unlock) and the transport request the backend assigned (CORRNR).
     */
    lock(objectUri: string, options?: {
        signal?: AbortSignal;
    }): Promise<{
        handle: string;
        transport?: string;
    }>;
    /** Unlock an object previously locked with the given handle. */
    unlock(objectUri: string, handle: string, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    /**
     * Unlock with the given handle; when that fails (or no handle is known),
     * retry WITHOUT a handle. Some backends release the lock on a bare
     * `_action=UNLOCK` (same user), which lets `unlock_all` clean residual
     * locks whose handle was never returned (e.g. create-time auto locks).
     */
    unlockBestEffort(objectUri: string, handle?: string, options?: {
        signal?: AbortSignal;
    }): Promise<{
        released: boolean;
        note?: string;
    }>;
    /** Lock → write → unlock in one step (safe even if write fails). */
    updateSource(objectUri: string, source: string, options?: {
        transport?: string;
        unlock?: boolean;
        signal?: AbortSignal;
    }): Promise<void>;
    /**
     * Activate a list of objects. `checkOnly` performs a pre-audit (syntax
     * check) instead of activating. Note: activation failures are reported in
     * an HTTP 200 body as `chkl:messages` entries with type="E".
     */
    activate(objects: AdtObjectRef[], options?: {
        transport?: string;
        checkOnly?: boolean;
        signal?: AbortSignal;
    }): Promise<AdtActivationResult>;
    /** Syntax/consistency check via the check-run service (no activation). */
    check(objects: AdtObjectRef[], options?: {
        signal?: AbortSignal;
    }): Promise<AdtCheckResult>;
    /** Run ABAP Unit tests; polls the async run until completion. */
    runUnitTests(objects: AdtObjectRef[], options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<AdtUnitRunResult>;
    /**
     * Legacy synchronous ABAP Unit run (old backends, `POST
     * /abapunit/testruns`). The backend executes the run inside the POST and
     * answers with `aunit:runResult` — there is no run id and nothing to poll.
     */
    private runUnitTestsLegacy;
    /** Run ABAP Test Cockpit checks; polls the async run until completion. */
    runAtc(objects: AdtObjectRef[], options?: {
        variant?: string;
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<AdtAtcResult>;
    /**
     * List existing ATC runs (the results collection). The backend requires at
     * least one filter; when none is given the logged-on user is used.
     */
    listAtcRuns(options?: {
        createdBy?: string;
        ageMin?: number;
        ageMax?: number;
        central?: boolean;
        active?: boolean;
        sysId?: string;
        contactPerson?: string;
        signal?: AbortSignal;
    }): Promise<AdtAtcRunSummary[]>;
    /**
     * Fetch one ATC run result by display id (checkstyle XML on on-prem
     * backends; the raw body is preserved when the format is unknown).
     */
    getAtcResult(displayId: string, options?: {
        includeExemptedFindings?: boolean;
        signal?: AbortSignal;
    }): Promise<AdtAtcResult>;
    /** List transport requests of the current user (or all users). */
    listTransports(options?: {
        allUsers?: boolean;
        category?: 'K' | 'C' | 'T';
        /** Restrict by release state. Semantic values: 'modifiable' (open requests,
         *  alias 'D'), 'released' (already published, aliases 'R'/'L'), 'all' (no
         *  filter). Any other value is forwarded to the backend as the `status`
         *  query parameter and not filtered client-side. */
        status?: string;
        signal?: AbortSignal;
    }): Promise<AdtTransport[]>;
    /** Get one transport request incl. its items. */
    getTransport(number: string, options?: {
        signal?: AbortSignal;
    }): Promise<AdtTransport>;
    /**
     * Version history (Atom feed) of a source object. Each version carries the
     * transport request (or open task) it was saved into — a read-only way to
     * map objects to transports without locking. Numbers that resolve via
     * `getTransport` are requests; a version whose transport number does not
     * resolve is an open task of an unreleased request.
     */
    getVersions(objectUri: string, options?: {
        signal?: AbortSignal;
    }): Promise<AdtObjectVersion[]>;
    /**
     * Find objects that reference or depend on the given object (where-used).
     * Hits the `/repository/informationsystem/usageReferences` collection with
     * the object URI. Parsing is tolerant of the `usagereferences:` prefix.
     */
    getWhereUsed(objectUri: string, options?: {
        enableAllTypes?: boolean;
        signal?: AbortSignal;
    }): Promise<AdtWhereUsedResult>;
    /** Preview rows of a DDIC entity (table/structure/view) or a CDS view. */
    dataPreview(name: string, kind: 'ddic' | 'cds', options?: {
        top?: number;
        signal?: AbortSignal;
    }): Promise<AdtDataPreview>;
    /** Execute a freestyle SQL SELECT via the data-preview API. */
    runSqlQuery(sql: string, options?: {
        top?: number;
        signal?: AbortSignal;
    }): Promise<AdtDataPreview>;
    /** Fetch the source of one object version by its content URI (from getVersions). */
    getVersionSource(contentUri: string, options?: {
        signal?: AbortSignal;
    }): Promise<string>;
    /** Best-effort read of an object's lock state via its metadata. */
    getObjectLock(objectUri: string, type?: string, options?: {
        signal?: AbortSignal;
    }): Promise<AdtObjectLockInfo>;
    /**
     * Try the transports relationship endpoints for lock state. Some backends
     * answer `GET {objectUri}/transports` (or the repository
     * `objectproperties/transports?uri=` collection) with LOCK_HANDLE / CORRNR
     * data; both are probed read-only and failures degrade silently.
     */
    private lockStateViaTransports;
    /** Release a transport request. */
    releaseTransport(number: string, options?: {
        signal?: AbortSignal;
    }): Promise<AdtTransport>;
    /**
     * List direct members of a package.
     *
     * Strategy: repository search filtered by `packageName` (works on all
     * backends that expose the search service); falls back to the node-structure
     * endpoint when the search route is unavailable. The node-structure route is
     * frequently disabled on hardened S/4HANA systems, hence the preference.
     */
    packageContent(packageName: string, options?: {
        maxResults?: number;
        signal?: AbortSignal;
    }): Promise<AdtObjectRef[]>;
    /**
     * Create a new ABAP development object using the type-specific collection
     * endpoints (e.g. `/sap/bc/adt/oo/classes` for classes) with namespaced
     * metadata XML and the `package` query parameter.
     */
    createObject(request: AdtCreateObjectRequest, options?: {
        signal?: AbortSignal;
    }): Promise<AdtCreateObjectResult>;
    /**
     * Delete an object. Prefers the modern deletion service
     * (`POST /sap/bc/adt/deletion/delete`, response media type
     * `deletion.response.v1+xml`) and falls back to the legacy
     * `_action=DELETE` action on the object URI when the service is absent.
     */
    deleteObject(objectUri: string, options?: {
        transport?: string;
        signal?: AbortSignal;
    }): Promise<void>;
    /**
     * List runtime dumps (the ST22 feed). `from`/`to` are `YYYYMMDDHHMMSS`
     * timestamps; `user` filters by the session user; `top`/`skip` page the
     * feed (server-side `$top`/`$skip`).
     */
    listDumps(options?: {
        user?: string;
        from?: string;
        to?: string;
        top?: number;
        skip?: number;
        signal?: AbortSignal;
    }): Promise<AdtDumpSummary[]>;
    /**
     * Read one runtime dump. `view` selects the representation:
     *  - `default`   — structured XML (`runtime.dump.v1+xml`), parsed to sections
     *  - `summary`   — HTML summary (raw passthrough)
     *  - `formatted` — plain-text analysis view (raw passthrough)
     */
    getDump(dumpId: string, options?: {
        view?: 'default' | 'summary' | 'formatted';
        signal?: AbortSignal;
    }): Promise<AdtDumpDetail>;
    /**
     * Run an ABAP executable program (console output comes back as text).
     * Equivalent to F8 in ADT: the program runs synchronously in the session.
     */
    runProgram(programName: string, options?: {
        signal?: AbortSignal;
    }): Promise<AdtRunResult>;
    /**
     * Run a class that implements `if_oo_adt_classrun` — its `main( )` executes
     * and the `out->write( )` output comes back as text. The standard agent
     * pattern for "run logic and capture output without building a program".
     */
    runClass(className: string, options?: {
        signal?: AbortSignal;
    }): Promise<AdtRunResult>;
    /**
     * Execute several ADT requests in ONE HTTP round-trip via the `$batch`
     * multipart protocol (`POST /sap/bc/adt/$batch`). Every part carries an
     * embedded HTTP request (`GET/POST/PUT <path> HTTP/1.1`); the response is
     * a multipart with one embedded HTTP response per part, in order.
     *
     * The outer POST is state-changing (CSRF applies once, for all parts);
     * `sap-client`/`sap-language` are appended to every inner request path.
     */
    batch(parts: AdtBatchRequestPart[], options?: {
        signal?: AbortSignal;
    }): Promise<AdtBatchResponsePart[]>;
    /** Read the structured metadata of a DDIC object as typed JSON. */
    readStructure(objectUri: string, kind: AdtStructureKind, options?: {
        signal?: AbortSignal;
    }): Promise<AdtStructureData>;
    /**
     * Read-modify-write the structured metadata of a DDIC object: lock → GET
     * current XML → patch only the provided fields → PUT → unlock. The
     * optional `onLocked` hook runs right after the lock (with the backend
     * transport the lock assigned) so callers can enforce policy and abort
     * BEFORE anything is written — a throw rolls the lock back and propagates.
     */
    writeStructure(objectUri: string, kind: AdtStructureKind, changes: AdtStructureChanges, options?: {
        transport?: string;
        onLocked?: (assignedTransport: string | undefined) => void;
        signal?: AbortSignal;
    }): Promise<AdtStructureWriteResult>;
    /**
     * Inner `$batch` request path: the client/language query parameters of the
     * destination are appended (once) so every embedded request executes in the
     * right session context, exactly like the outer request would carry them.
     */
    private innerBatchPath;
    /** Lightweight reachability + auth probe. */
    ping(options?: {
        signal?: AbortSignal;
    }): Promise<{
        ok: boolean;
        status?: number;
        detail?: string;
    }>;
}
export {};
//# sourceMappingURL=client.d.ts.map