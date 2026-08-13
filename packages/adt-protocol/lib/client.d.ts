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
import type { AdtActivationResult, AdtAtcResult, AdtCheckResult, AdtCreateObjectRequest, AdtCreateObjectResult, AdtDestination, AdtDiscovery, AdtMessage, AdtObjectRef, AdtObjectSearchHit, AdtSearchResult, AdtSource, AdtSourceSearchHit, AdtSystemInfo, AdtTransport, AdtUnitRunResult } from './types.js';
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
    discover(): Promise<AdtDiscovery>;
    /**
     * System id / release / ABAP Cloud info.
     *
     * Prefers the structured `core/http/systeminformation` JSON endpoint (SID,
     * client, language, user); falls back to discovery feature flags when the
     * endpoint is unavailable.
     */
    systemInfo(): Promise<AdtSystemInfo>;
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
    }): Promise<AdtSearchResult>;
    /** Search only for objects (name/description), no source search. */
    searchObjects(query: string, options?: {
        maxResults?: number;
        objectType?: string;
    }): Promise<AdtObjectSearchHit[]>;
    /** Full-text search inside ABAP sources (empty when unsupported). */
    searchSource(query: string, options?: {
        maxResults?: number;
    }): Promise<AdtSourceSearchHit[]>;
    /** Read the main source of an object by its ADT URI. */
    readSource(objectUri: string): Promise<AdtSource>;
    /**
     * Write the main source of an object. The caller is expected to lock first
     * and pass the lock handle (from {@link lock}) as `lockHandle`.
     */
    writeSource(objectUri: string, source: string, options?: {
        lockHandle?: string;
        transport?: string;
    }): Promise<void>;
    /**
     * Lock an object for editing. Returns the lock handle (required by write /
     * unlock) and the transport request the backend assigned (CORRNR).
     */
    lock(objectUri: string): Promise<{
        handle: string;
        transport?: string;
    }>;
    /** Unlock an object previously locked with the given handle. */
    unlock(objectUri: string, handle: string): Promise<void>;
    /** Lock → write → unlock in one step (safe even if write fails). */
    updateSource(objectUri: string, source: string, options?: {
        transport?: string;
        unlock?: boolean;
    }): Promise<void>;
    /**
     * Activate a list of objects. `checkOnly` performs a pre-audit (syntax
     * check) instead of activating. Note: activation failures are reported in
     * an HTTP 200 body as `chkl:messages` entries with type="E".
     */
    activate(objects: AdtObjectRef[], options?: {
        transport?: string;
        checkOnly?: boolean;
    }): Promise<AdtActivationResult>;
    /** Syntax/consistency check via the check-run service (no activation). */
    check(objects: AdtObjectRef[]): Promise<AdtCheckResult>;
    /** Run ABAP Unit tests; polls the async run until completion. */
    runUnitTests(objects: AdtObjectRef[], options?: {
        timeoutMs?: number;
    }): Promise<AdtUnitRunResult>;
    /** Run ABAP Test Cockpit checks; polls the async run until completion. */
    runAtc(objects: AdtObjectRef[], options?: {
        variant?: string;
        timeoutMs?: number;
    }): Promise<AdtAtcResult>;
    /** List transport requests of the current user (or all users). */
    listTransports(options?: {
        allUsers?: boolean;
        category?: 'K' | 'C' | 'T';
    }): Promise<AdtTransport[]>;
    /** Get one transport request incl. its items. */
    getTransport(number: string): Promise<AdtTransport>;
    /** Release a transport request. */
    releaseTransport(number: string): Promise<AdtTransport>;
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
    }): Promise<AdtObjectRef[]>;
    /**
     * Create a new ABAP development object using the type-specific collection
     * endpoints (e.g. `/sap/bc/adt/oo/classes` for classes) with namespaced
     * metadata XML and the `package` query parameter.
     */
    createObject(request: AdtCreateObjectRequest): Promise<AdtCreateObjectResult>;
    /** Delete an object. */
    deleteObject(objectUri: string): Promise<void>;
    /** Lightweight reachability + auth probe. */
    ping(): Promise<{
        ok: boolean;
        status?: number;
        detail?: string;
    }>;
}
export {};
//# sourceMappingURL=client.d.ts.map