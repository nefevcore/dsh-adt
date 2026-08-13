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
import { randomUUID } from 'node:crypto';
import { ADT_BASE as ADT_BASE_PATH, ENDPOINTS, MEDIA, toQuery } from './endpoints.js';
import { attr, child, children, childText, parseXml } from './xml.js';
/** Error raised for HTTP-level or protocol-level failures. */
export class AdtError extends Error {
    status;
    adtMessages;
    responseBody;
    constructor(message, status, adtMessages = [], responseBody) {
        super(message);
        this.status = status;
        this.adtMessages = adtMessages;
        this.responseBody = responseBody;
        this.name = 'AdtError';
    }
}
function severityOf(text) {
    switch (text) {
        case 'E':
            return 'E';
        case 'W':
            return 'W';
        case 'I':
            return 'I';
        case 'S':
            return 'S';
        case 'A':
            return 'A';
        default:
            return 'I';
    }
}
/** Parse an ADT message list from `<...:message>` / `<exc:exception>` elements. */
export function parseAdtMessages(root) {
    const messages = [];
    for (const el of children(root, 'message')) {
        messages.push({
            severity: severityOf(attr(el, 'type') ?? attr(el, 'severity')),
            text: childText(el, 'text') ?? childText(el, 'shortText') ?? attr(el, 'shortText') ?? '',
            id: attr(el, 'id'),
            code: attr(el, 'code'),
            longText: childText(el, 'longText'),
            line: attr(el, 'line') ? Number(attr(el, 'line')) : undefined,
            offset: attr(el, 'offset') ? Number(attr(el, 'offset')) : undefined,
        });
    }
    // `exc:exception` error envelope (standard ADT error body).
    const exception = children(root, 'exception')[0];
    if (exception) {
        messages.push({
            severity: 'E',
            text: childText(exception, 'localizedMessage') ?? childText(exception, 'message') ?? '',
            id: attr(exception, 'type'),
            code: attr(exception, 'type'),
        });
    }
    return messages;
}
/** Extract ADT messages from an error response body (best effort). */
function parseErrorBody(body) {
    try {
        const root = parseXml(body);
        return parseAdtMessages(root);
    }
    catch {
        return [];
    }
}
/**
 * Lazy singleton undici Agent with TLS verification disabled, used for
 * destinations with `strictSSL: false` (self-signed / private-CA SAP
 * front-ends). Uses Node's built-in undici via `process.getBuiltinModule`
 * (Node >= 22.3); returns `undefined` when unavailable.
 */
let insecureTlsDispatcher;
let insecureTlsPromise;
function getInsecureTlsDispatcher() {
    // Lazily load undici only for destinations with `strictSSL: false`
    // (self-signed / private-CA SAP front-ends). The default path stays
    // dependency-free at runtime.
    if (insecureTlsDispatcher !== undefined)
        return insecureTlsDispatcher;
    if (!insecureTlsPromise) {
        insecureTlsPromise = import('undici')
            .then(({ Agent }) => new Agent({ connect: { rejectUnauthorized: false } }))
            .catch(() => null);
    }
    // The dispatcher is used asynchronously right after this call in
    // `request()`; synchronously returning the promise is impossible, so
    // request() awaits it below instead.
    return insecureTlsPromise;
}
function normalizeUri(uri) {
    return uri.startsWith('/sap/bc/adt') ? uri : `/sap/bc/adt${uri.startsWith('/') ? '' : '/'}${uri}`;
}
export class AdtClient {
    destination;
    cookies = new Map();
    csrfToken;
    base;
    fetchImpl;
    /** Connection identifier sent as `sap-adt-connection-id` on every request. */
    connectionId = randomUUID();
    constructor(destination, fetchImpl = globalThis.fetch.bind(globalThis)) {
        this.destination = destination;
        this.base = destination.url.replace(/\/+$/, '');
        this.fetchImpl = fetchImpl;
    }
    buildUrl(path) {
        if (/^https?:\/\//.test(path))
            return path;
        return `${this.base}${path}`;
    }
    cookieHeader() {
        return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    storeCookies(headers) {
        const setCookie = headers.getSetCookie?.() ?? [];
        for (const raw of setCookie) {
            const [pair] = raw.split(';');
            if (!pair)
                continue;
            const eq = pair.indexOf('=');
            if (eq <= 0)
                continue;
            const key = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();
            // Never let the server force a different client into the context cookie.
            if (key === 'sap-usercontext' && this.destination.client) {
                this.cookies.set(key, `sap-client=${this.destination.client}`);
            }
            else {
                this.cookies.set(key, value);
            }
        }
    }
    /** Base query parameters (client + language) merged with extras. */
    baseQuery(extra) {
        return {
            ...(this.destination.client ? { 'sap-client': this.destination.client } : {}),
            ...(this.destination.language ? { 'sap-language': this.destination.language } : {}),
            ...extra,
        };
    }
    /**
     * Perform one ADT request. State-changing requests transparently obtain and
     * attach the CSRF token; the request is retried once when the server
     * invalidates the session token (403 + CSRF hint or 401 on a write).
     */
    async request(options) {
        const { method = 'GET', path, body, accept, contentType, headers, noCsrf, raw, timeoutMs, stateful } = options;
        const needsCsrf = !noCsrf && method !== 'GET';
        let csrf = needsCsrf ? await this.ensureCsrfToken() : undefined;
        for (let attempt = 0; attempt < 2; attempt++) {
            const reqHeaders = {
                Accept: accept ?? 'application/xml',
                'sap-adt-connection-id': this.connectionId,
                ...(stateful ? { 'x-sap-adt-sessiontype': 'stateful' } : {}),
                ...headers,
            };
            if (this.destination.auth.type === 'basic') {
                reqHeaders.Authorization = `Basic ${Buffer.from(`${this.destination.auth.username}:${this.destination.auth.password}`).toString('base64')}`;
            }
            const cookie = this.cookieHeader();
            if (cookie)
                reqHeaders.Cookie = cookie;
            if (body !== undefined) {
                reqHeaders['Content-Type'] = contentType ?? MEDIA.source;
            }
            if (csrf)
                reqHeaders['X-CSRF-Token'] = csrf;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.destination.timeoutMs ?? 60_000);
            let response;
            try {
                const init = {
                    method,
                    headers: reqHeaders,
                    body,
                    signal: controller.signal,
                    redirect: 'follow',
                };
                // Self-signed / private-CA systems: disable TLS verification per
                // destination (undici dispatcher, lazily loaded).
                if (this.destination.strictSSL === false) {
                    const dispatcher = await getInsecureTlsDispatcher();
                    if (dispatcher)
                        init.dispatcher = dispatcher;
                }
                response = await this.fetchImpl(this.buildUrl(path), init);
            }
            catch (cause) {
                throw new AdtError(`ADT request failed: ${cause.message}`);
            }
            finally {
                clearTimeout(timer);
            }
            this.storeCookies(response.headers);
            if (!raw && !response.ok) {
                const text = await response.text().catch(() => '');
                const messages = parseErrorBody(text);
                const detail = messages.map((m) => `${m.severity}: ${m.text}`).join(' | ');
                const csrfHint = (response.headers.get('x-csrf-token') ?? '').toLowerCase() === 'required';
                const csrfError = /csrf/i.test(text);
                const sessionLost = response.status === 401 && method !== 'GET';
                if ((csrfRequired(response.status, csrfHint, csrfError) || sessionLost) && attempt === 0) {
                    // Session/token was rejected; refresh and retry once.
                    this.resetSession();
                    csrf = await this.ensureCsrfToken();
                    continue;
                }
                throw new AdtError(`ADT ${method} ${path} -> HTTP ${response.status}${detail ? `: ${detail}` : ''}`, response.status, messages, text);
            }
            return { status: response.status, headers: response.headers, text: await response.text().catch(() => '') };
        }
        throw new AdtError(`ADT ${method} ${path} -> CSRF retry exhausted`);
    }
    /** Fetch (and cache) the CSRF token via the standard discovery probe. */
    async ensureCsrfToken() {
        if (this.csrfToken)
            return this.csrfToken;
        const path = ENDPOINTS.discovery();
        const response = await this.request({
            method: 'GET',
            path,
            accept: 'application/atomsvc+xml, application/xml',
            noCsrf: true,
            headers: { 'X-CSRF-Token': 'fetch' },
        });
        const token = response.headers.get('x-csrf-token');
        if (!token || token.toLowerCase() === 'required') {
            throw new AdtError(`ADT: server did not issue a CSRF token (got '${token ?? 'none'}')`, response.status);
        }
        this.csrfToken = token;
        return token;
    }
    /** Reset cached session state (cookies + CSRF). */
    resetSession() {
        this.cookies.clear();
        this.csrfToken = undefined;
    }
    // ---------------------------------------------------------------------------
    // Discovery & system information
    // ---------------------------------------------------------------------------
    /** Fetch the discovery document (AtomPub service doc; tolerant of simple XML). */
    async discover() {
        const res = await this.request({
            path: ENDPOINTS.discovery(),
            accept: 'application/atomsvc+xml, application/xml',
        });
        return parseDiscovery(res.text);
    }
    /**
     * System id / release / ABAP Cloud info.
     *
     * Prefers the structured `core/http/systeminformation` JSON endpoint (SID,
     * client, language, user); falls back to discovery feature flags when the
     * endpoint is unavailable.
     */
    async systemInfo() {
        let systemId = '';
        let userName = '';
        let client = '';
        let language = '';
        try {
            const res = await this.request({
                path: `${ADT_BASE_PATH}/core/http/systeminformation?sap-client=${encodeURIComponent(this.destination.client ?? '')}`,
                accept: 'application/vnd.sap.adt.core.http.systeminformation.v1+json',
            });
            const data = JSON.parse(res.text);
            systemId = data.systemID ?? '';
            userName = data.userName ?? '';
            client = data.client ?? '';
            language = data.language ?? '';
        }
        catch {
            // Endpoint unavailable → rely on discovery below.
        }
        const discovery = await this.discover();
        const features = discovery.features;
        systemId = systemId || features['systemId'] || features['SAP_SYSTEM_ID'] || '';
        const release = features['release'] ?? features['SAP_SYSTEM_RELEASE'] ?? '';
        const abapCloud = Object.keys(features).some((k) => k.toLowerCase().includes('cloud')) || features['ABAP_CLOUD'] === 'true';
        return {
            destination: this.destination.name,
            systemId,
            release,
            abapCloud,
            features,
            serviceCount: discovery.services.length,
            userName: userName || undefined,
            client: client || undefined,
            language: language || undefined,
        };
    }
    // ---------------------------------------------------------------------------
    // Search
    // ---------------------------------------------------------------------------
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
    async search(query, options = {}) {
        const operation = options.operation ?? 'quickSearch';
        const params = this.baseQuery({
            operation,
            query,
            maxResults: options.maxResults ?? 25,
            ...(options.objectType ? { objectType: options.objectType } : {}),
            ...(options.packageName ? { packageName: options.packageName } : {}),
        });
        try {
            const res = await this.request({
                path: ENDPOINTS.search(params),
                accept: 'application/xml',
            });
            return parseSearchResult(res.text, query);
        }
        catch (error) {
            // Fall back to plain quickSearch when a narrowed operation is rejected.
            if (error instanceof AdtError && error.status === 500 && operation !== 'quickSearch') {
                const fallback = await this.search(query, {
                    maxResults: options.maxResults,
                    objectType: options.objectType,
                    packageName: options.packageName,
                    operation: 'quickSearch',
                });
                fallback.note = `search operation '${operation}' unsupported by this backend; results from quickSearch`;
                return fallback;
            }
            throw error;
        }
    }
    /** Search only for objects (name/description), no source search. */
    async searchObjects(query, options = {}) {
        const result = await this.search(query, { ...options, operation: 'objectSearch' });
        return result.objects;
    }
    /** Full-text search inside ABAP sources (empty when unsupported). */
    async searchSource(query, options = {}) {
        const result = await this.search(query, { ...options, operation: 'quickSearchSource' });
        return result.sources;
    }
    // ---------------------------------------------------------------------------
    // Object source access
    // ---------------------------------------------------------------------------
    /** Read the main source of an object by its ADT URI. */
    async readSource(objectUri) {
        const uri = normalizeUri(objectUri);
        const attempts = uri.endsWith('/source/main') ? [uri] : [`${uri}/source/main`, uri];
        let lastError;
        for (const path of attempts) {
            try {
                const res = await this.request({ path, accept: 'text/plain' });
                return parseSourceResponse(res.text, uri, res.headers.get('content-type') ?? '');
            }
            catch (error) {
                if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
                    lastError = error;
                    continue;
                }
                throw error;
            }
        }
        throw lastError ?? new AdtError(`ADT: could not read source of ${uri}`);
    }
    /**
     * Write the main source of an object. The caller is expected to lock first
     * and pass the lock handle (from {@link lock}) as `lockHandle`.
     */
    async writeSource(objectUri, source, options = {}) {
        const uri = normalizeUri(objectUri);
        const path = uri.endsWith('/source/main') ? uri : `${uri}/source/main`;
        const query = this.baseQuery({
            ...(options.lockHandle ? { lockHandle: options.lockHandle } : {}),
            ...(options.transport ? { corrNr: options.transport } : {}),
        });
        const url = `${path}${toQuery(query)}`;
        await this.request({
            method: 'PUT',
            path: url,
            body: source,
            contentType: 'text/plain; charset=utf-8',
            accept: 'application/xml',
            stateful: true,
        });
    }
    /**
     * Lock an object for editing. Returns the lock handle (required by write /
     * unlock) and the transport request the backend assigned (CORRNR).
     */
    async lock(objectUri) {
        const uri = normalizeUri(objectUri);
        const query = this.baseQuery({ _action: 'LOCK', accessMode: 'MODIFY' });
        const res = await this.request({
            method: 'POST',
            path: `${uri}${toQuery(query)}`,
            accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
            stateful: true,
        });
        const handle = parseLockHandle(res.text) ?? res.headers.get('x-adt-lock-handle') ?? '';
        const transport = parseLockTransport(res.text);
        if (!handle)
            throw new AdtError('ADT: lock succeeded but no lock handle was returned', res.status, [], res.text);
        return { handle, transport };
    }
    /** Unlock an object previously locked with the given handle. */
    async unlock(objectUri, handle) {
        const uri = normalizeUri(objectUri);
        const query = this.baseQuery({ _action: 'UNLOCK', lockHandle: handle });
        await this.request({
            method: 'POST',
            path: `${uri}${toQuery(query)}`,
            accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
            stateful: true,
        });
    }
    /** Lock → write → unlock in one step (safe even if write fails). */
    async updateSource(objectUri, source, options = {}) {
        const { handle } = await this.lock(objectUri);
        try {
            await this.writeSource(objectUri, source, { lockHandle: handle, transport: options.transport });
        }
        finally {
            if (options.unlock !== false) {
                await this.unlock(objectUri, handle).catch(() => undefined);
            }
        }
    }
    // ---------------------------------------------------------------------------
    // Activation / check
    // ---------------------------------------------------------------------------
    /**
     * Activate a list of objects. `checkOnly` performs a pre-audit (syntax
     * check) instead of activating. Note: activation failures are reported in
     * an HTTP 200 body as `chkl:messages` entries with type="E".
     */
    async activate(objects, options = {}) {
        const method = options.checkOnly ? 'check' : 'activate';
        const query = this.baseQuery({ method, preauditRequested: 'true' });
        const body = buildActivationRequest(objects, options.transport);
        const res = await this.request({
            method: 'POST',
            path: `${ENDPOINTS.activation()}${toQuery(query)}`,
            body,
            contentType: MEDIA.activation,
            accept: 'application/xml',
            stateful: true,
            timeoutMs: 300_000,
        });
        return parseActivationResult(res.text);
    }
    /** Syntax/consistency check via the check-run service (no activation). */
    async check(objects) {
        const query = this.baseQuery({ reporters: 'abapCheckRun' });
        const body = buildCheckRunRequest(objects);
        const res = await this.request({
            method: 'POST',
            path: `${ENDPOINTS.checkRuns()}${toQuery(query)}`,
            body,
            contentType: MEDIA.checkObjects,
            accept: MEDIA.checkMessages,
            stateful: true,
            timeoutMs: 120_000,
        });
        const messages = parseCheckMessages(res.text);
        const errors = messages.filter((m) => m.severity === 'E');
        return { success: errors.length === 0, messages };
    }
    // ---------------------------------------------------------------------------
    // ABAP Unit (async run flow)
    // ---------------------------------------------------------------------------
    /** Run ABAP Unit tests; polls the async run until completion. */
    async runUnitTests(objects, options = {}) {
        const body = buildUnitRunRequest(objects);
        const query = this.baseQuery({});
        const start = await this.request({
            method: 'POST',
            path: `${ENDPOINTS.unitRuns()}${toQuery(query)}`,
            body,
            contentType: MEDIA.abapUnitRun,
            accept: MEDIA.abapUnitRunStatus,
            stateful: true,
            timeoutMs: 60_000,
        });
        const runId = extractRunId(start);
        const deadline = Date.now() + (options.timeoutMs ?? 300_000);
        for (;;) {
            const status = await this.request({
                path: `${ENDPOINTS.unitRuns()}/${encodeURIComponent(runId)}${toQuery(this.baseQuery({ withLongPolling: 'true' }))}`,
                accept: MEDIA.abapUnitRunStatus,
                timeoutMs: 60_000,
            });
            const done = isUnitRunComplete(status.text);
            if (done)
                break;
            if (Date.now() > deadline)
                throw new AdtError('ADT: ABAP Unit run timed out');
            await sleep(1500);
        }
        const results = await this.request({
            path: `${ENDPOINTS.unitResults()}/${encodeURIComponent(runId)}${toQuery(this.baseQuery())}`,
            accept: MEDIA.abapUnitResult,
            timeoutMs: 60_000,
        });
        return parseUnitRunResult(results.text);
    }
    // ---------------------------------------------------------------------------
    // ATC (async run flow)
    // ---------------------------------------------------------------------------
    /** Run ABAP Test Cockpit checks; polls the async run until completion. */
    async runAtc(objects, options = {}) {
        const body = buildAtcRunRequest(objects, options.variant);
        const query = this.baseQuery({});
        const start = await this.request({
            method: 'POST',
            path: `${ENDPOINTS.atcRuns()}${toQuery(query)}`,
            body,
            contentType: MEDIA.atcRunParameters,
            accept: MEDIA.atcRun,
            stateful: true,
            timeoutMs: 60_000,
        });
        const runId = extractRunId(start);
        const deadline = Date.now() + (options.timeoutMs ?? 600_000);
        let displayId = runId;
        for (;;) {
            const status = await this.request({
                path: `${ENDPOINTS.atcRuns()}/${encodeURIComponent(runId)}${toQuery(this.baseQuery())}`,
                accept: MEDIA.atcRun,
                timeoutMs: 60_000,
            });
            displayId = extractDisplayId(status.text) ?? runId;
            if (isAtcRunComplete(status.text))
                break;
            if (Date.now() > deadline)
                throw new AdtError('ADT: ATC run timed out');
            await sleep(2000);
        }
        const results = await this.request({
            path: `${ENDPOINTS.atcResults()}/${encodeURIComponent(displayId)}${toQuery(this.baseQuery())}`,
            accept: MEDIA.atcResult,
            timeoutMs: 60_000,
        });
        return parseAtcResult(results.text, options.variant);
    }
    // ---------------------------------------------------------------------------
    // Transports
    // ---------------------------------------------------------------------------
    /** List transport requests of the current user (or all users). */
    async listTransports(options = {}) {
        const params = this.baseQuery({
            ...(options.allUsers ? { user: '*' } : {}),
            ...(options.category ? { type: options.category } : {}),
        });
        const res = await this.request({
            path: `${ENDPOINTS.transportRequests()}${toQuery(params)}`,
            accept: MEDIA.transportOrganizerTree,
        });
        const root = parseXml(res.text);
        const transports = [];
        for (const el of [...children(root, 'request'), ...children(root, 'transport')]) {
            transports.push(parseTransport(el));
        }
        return transports;
    }
    /** Get one transport request incl. its items. */
    async getTransport(number) {
        const res = await this.request({
            path: `${ENDPOINTS.transportRequests()}/${encodeURIComponent(number)}${toQuery(this.baseQuery())}`,
            accept: MEDIA.transportOrganizer,
        });
        const root = parseXml(res.text);
        return parseTransport(root);
    }
    /** Release a transport request. */
    async releaseTransport(number) {
        const res = await this.request({
            method: 'POST',
            path: `${ENDPOINTS.transportRequests()}/${encodeURIComponent(number)}/release${toQuery(this.baseQuery())}`,
            accept: MEDIA.transportOrganizer,
            stateful: true,
            timeoutMs: 120_000,
        });
        const root = parseXml(res.text);
        return parseTransport(root);
    }
    // ---------------------------------------------------------------------------
    // Packages
    // ---------------------------------------------------------------------------
    /**
     * List direct members of a package.
     *
     * Strategy: repository search filtered by `packageName` (works on all
     * backends that expose the search service); falls back to the node-structure
     * endpoint when the search route is unavailable. The node-structure route is
     * frequently disabled on hardened S/4HANA systems, hence the preference.
     */
    async packageContent(packageName, options = {}) {
        const upper = packageName.toUpperCase();
        // 1) Search with packageName filter (returns object references).
        try {
            const result = await this.search('*', {
                operation: 'quickSearch',
                packageName: upper,
                maxResults: options.maxResults ?? 500,
            });
            if (result.objects.length > 0) {
                return result.objects.map((o) => ({
                    uri: o.uri,
                    type: o.type,
                    name: o.objectName,
                    category: o.category,
                }));
            }
            // No hits can also mean "empty package"; only fall through to the
            // node-structure route when the search itself was degraded.
            if (!result.note)
                return [];
        }
        catch {
            // fall through to node structure
        }
        // 2) Node structure fallback.
        const params = this.baseQuery({
            parent_name: upper,
            parent_type: 'DEVC/K',
            withShortDescriptions: 'true',
        });
        const res = await this.request({
            path: `${ENDPOINTS.nodeStructure()}${toQuery(params)}`,
            accept: MEDIA.nodeStructure,
        });
        const root = parseXml(res.text);
        const items = [];
        for (const el of [...children(root, 'node'), ...children(root, 'object')]) {
            const name = attr(el, 'name');
            if (!name)
                continue;
            items.push({
                uri: attr(el, 'uri') ?? '',
                type: attr(el, 'type') ?? '',
                name,
                category: attr(el, 'type')?.split('/')[0],
            });
        }
        return items;
    }
    // ---------------------------------------------------------------------------
    // Object creation / deletion
    // ---------------------------------------------------------------------------
    /**
     * Create a new ABAP development object using the type-specific collection
     * endpoints (e.g. `/sap/bc/adt/oo/classes` for classes) with namespaced
     * metadata XML and the `package` query parameter.
     */
    async createObject(request) {
        const category = request.type.split('/')[0];
        const endpoint = ENDPOINTS.createByType[category];
        if (!endpoint) {
            return { success: false, messages: [{ severity: 'E', text: `Unsupported create type: ${request.type}` }] };
        }
        const query = this.baseQuery({
            ...(request.packageName ? { package: request.packageName } : {}),
            ...(request.transport ? { corrNr: request.transport } : {}),
        });
        const body = buildCreateObjectRequest(request);
        const res = await this.request({
            method: 'POST',
            path: `${endpoint()}${toQuery(query)}`,
            body,
            contentType: createContentType(request.type),
            accept: 'application/xml',
            stateful: true,
            timeoutMs: 120_000,
        });
        const uri = res.headers.get('location') ?? parseCreatedUri(res.text) ?? '';
        const name = uri.split('/').pop()?.toUpperCase() ?? request.name;
        return {
            success: res.status === 201 || res.status === 200,
            uri,
            object: uri ? { uri, type: request.type, name, category } : undefined,
            messages: [],
        };
    }
    /** Delete an object. */
    async deleteObject(objectUri) {
        const uri = normalizeUri(objectUri);
        const query = this.baseQuery({ _action: 'DELETE', deleteOption: 'deleteAndLocalVersions' });
        await this.request({
            method: 'POST',
            path: `${uri}${toQuery(query)}`,
            accept: 'application/xml',
            stateful: true,
        });
    }
    // ---------------------------------------------------------------------------
    // Diagnostics
    // ---------------------------------------------------------------------------
    /** Lightweight reachability + auth probe. */
    async ping() {
        try {
            const discovery = await this.discover();
            return { ok: true, detail: `discovery advertised ${discovery.services.length} services` };
        }
        catch (error) {
            if (error instanceof AdtError) {
                return { ok: false, status: error.status, detail: error.message };
            }
            return { ok: false, detail: error.message };
        }
    }
}
// ---------------------------------------------------------------------------
// Builders & parsers
// ---------------------------------------------------------------------------
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function csrfRequired(status, headerHint, bodyHint) {
    return (status === 403 && (headerHint || bodyHint)) || (status === 401 && bodyHint);
}
function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
function buildActivationRequest(objects, transport) {
    const refs = objects
        .map((o) => `  <adtcore:objectReference adtcore:uri="${escapeXml(o.uri)}" adtcore:name="${escapeXml(o.name)}"/>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"${transport ? ` corrNr="${escapeXml(transport)}"` : ''}>
${refs}
</adtcore:objectReferences>`;
}
function buildCheckRunRequest(objects) {
    const refs = objects
        .map((o) => `  <chkrun:checkObject adtcore:uri="${escapeXml(o.uri)}" chkrun:version="inactive"/>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
${refs}
</chkrun:checkObjectList>`;
}
function buildUnitRunRequest(objects) {
    const sets = objects
        .map((o) => `    <osl:set xsi:type="osl:flatObjectSet"><osl:object name="${escapeXml(o.name)}" type="${escapeXml(o.type.split('/')[0] ?? 'CLAS')}"/></osl:set>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<aunit:run title="DSH Agent Run" context="DSH"
           xmlns:aunit="http://www.sap.com/adt/api/aunit"
           xmlns:osl="http://www.sap.com/api/osl"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <aunit:options>
    <aunit:measurements type="none"/>
    <aunit:scope ownTests="true" foreignTests="true"/>
    <aunit:riskLevel harmless="true" dangerous="true" critical="true"/>
    <aunit:duration short="true" medium="true" long="true"/>
  </aunit:options>
  <osl:objectSet xsi:type="unionSet">
${sets}
  </osl:objectSet>
</aunit:run>`;
}
function buildAtcRunRequest(objects, variant) {
    const sets = objects
        .map((o) => `    <osl:set xsi:type="osl:flatObjectSet"><osl:object name="${escapeXml(o.name)}" type="${escapeXml(o.type.split('/')[0] ?? 'CLAS')}"/></osl:set>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<atc:runparameters xmlns:atc="http://www.sap.com/adt/atc"
                   xmlns:osl="http://www.sap.com/api/osl"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"${variant ? ` checkVariant="${escapeXml(variant)}"` : ''}>
  <osl:objectSet xsi:type="unionSet">
${sets}
  </osl:objectSet>
</atc:runparameters>`;
}
function createContentType(type) {
    const cat = type.split('/')[0];
    const map = {
        CLAS: 'application/vnd.sap.adt.oo.classes.v4+xml',
        INTF: 'application/vnd.sap.adt.oo.interfaces.v5+xml',
        PROG: 'application/vnd.sap.adt.programs.programs.v2+xml',
        FUNC: 'application/vnd.sap.adt.functions.groups.v3+xml',
        DDLS: 'application/vnd.sap.adt.ddlSource.v2+xml',
        TABL: 'application/vnd.sap.adt.tables.v2+xml',
        STRU: 'application/vnd.sap.adt.structures.v2+xml',
        MSAG: 'application/xml',
        DEVC: 'application/vnd.sap.adt.packages.v2+xml',
    };
    return map[cat] ?? 'application/xml';
}
function buildCreateObjectRequest(request) {
    const ns = createNamespace(request.type);
    const tag = createRootTag(request.type);
    const props = Object.entries(request.properties ?? {})
        .map(([k, v]) => `    <adtcore:property adtcore:name="${escapeXml(k)}" adtcore:value="${escapeXml(v)}"/>`)
        .join('\n');
    const nameAttr = request.type.startsWith('CLAS') || request.type.startsWith('INTF')
        ? `${ns === 'class' ? 'class' : 'intf'}:name="${escapeXml(request.name)}"`
        : `adtcore:name="${escapeXml(request.name)}"`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<${tag} xmlns:${ns}="http://www.sap.com/adt/${ns === 'class' ? 'oo/classes' : ns === 'intf' ? 'oo/interfaces' : ns === 'prog' ? 'programs/programs' : ns === 'fugr' ? 'functions/groups' : ns === 'ddls' ? 'ddl' : ns}" xmlns:adtcore="http://www.sap.com/adt/core"
       adtcore:description="${escapeXml(request.description)}" adtcore:language="EN" ${nameAttr}
       adtcore:type="${escapeXml(request.type)}" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="${escapeXml(request.packageName || '$TMP')}"/>
${props}
</${tag}>`;
}
function createNamespace(type) {
    const cat = type.split('/')[0];
    switch (cat) {
        case 'CLAS':
            return 'class';
        case 'INTF':
            return 'intf';
        case 'PROG':
            return 'prog';
        case 'FUNC':
            return 'fugr';
        case 'DDLS':
            return 'ddls';
        default:
            return 'adtcore';
    }
}
function createRootTag(type) {
    const cat = type.split('/')[0];
    switch (cat) {
        case 'CLAS':
            return 'class:abapClass';
        case 'INTF':
            return 'intf:abapInterface';
        case 'PROG':
            return 'prog:abapProgram';
        case 'FUNC':
            return 'fugr:functionGroup';
        case 'DDLS':
            return 'ddls:dataDefinition';
        default:
            return 'adtcore:object';
    }
}
// --- Discovery --------------------------------------------------------------
function parseDiscovery(xml) {
    const root = parseXml(xml);
    const services = [];
    const features = {};
    // AtomPub service doc shape.
    for (const workspace of children(root, 'workspace')) {
        for (const collection of children(workspace, 'collection')) {
            const href = attr(collection, 'href');
            const acceptEl = child(collection, 'accept');
            if (href && acceptEl) {
                services.push({ href, mediaType: acceptEl.text, description: childText(collection, 'title') });
            }
        }
    }
    // Simple XML shape (mock / minimal backends).
    for (const link of children(root, 'service')) {
        const href = attr(link, 'href');
        const mediaType = attr(link, 'type');
        if (href && mediaType)
            services.push({ href, mediaType, description: childText(link, 'description') });
    }
    for (const f of children(root, 'feature')) {
        const id = attr(f, 'id');
        if (id)
            features[id] = f.text;
    }
    // System identification from discovery title when available.
    const title = childText(root, 'title');
    if (title && !features['systemId'])
        features['systemId'] = title;
    return { services, features };
}
// --- Search -----------------------------------------------------------------
function parseSearchResult(xml, query) {
    const root = parseXml(xml);
    const objects = [];
    const sources = [];
    for (const el of [...children(root, 'objectReference'), ...children(root, 'object')]) {
        const uri = attr(el, 'uri');
        if (!uri)
            continue;
        objects.push({
            objectName: attr(el, 'name') ?? '',
            description: attr(el, 'description') ?? '',
            type: attr(el, 'type') ?? '',
            typeLabel: attr(el, 'typeLabel') ?? '',
            packageName: attr(el, 'packageName'),
            uri,
            category: attr(el, 'category'),
            mainProgram: attr(el, 'mainProgram') === 'true',
            masterLanguage: attr(el, 'masterLanguage'),
            responsible: attr(el, 'responsible'),
            changedAt: attr(el, 'changedAt'),
            changedBy: attr(el, 'changedBy'),
        });
    }
    for (const el of [...children(root, 'source'), ...children(root, 'sourceReference')]) {
        const uri = attr(el, 'uri');
        if (!uri)
            continue;
        sources.push({
            objectName: attr(el, 'name') ?? '',
            type: attr(el, 'type') ?? '',
            uri,
            line: childText(el, 'line') ?? childText(el, 'excerpt') ?? attr(el, 'excerpt') ?? '',
            lineNumber: attr(el, 'lineNumber') ? Number(attr(el, 'lineNumber')) : undefined,
        });
    }
    return { count: objects.length + sources.length, query, objects, sources };
}
function parseSourceResponse(xml, uri, contentType = '') {
    if (!xml.trimStart().startsWith('<')) {
        return { source: xml, mediaType: 'text/plain', uri, properties: [], rawXml: xml };
    }
    let root;
    try {
        root = parseXml(xml);
    }
    catch {
        // XML-looking but unparseable → treat as plain text.
        return { source: xml, mediaType: contentType || 'text/plain', uri, properties: [], rawXml: xml };
    }
    const codeNode = child(root, 'code');
    const source = codeNode ? codeNode.text : root.text;
    const properties = [];
    for (const p of children(root, 'property')) {
        const key = attr(p, 'key') ?? attr(p, 'name');
        if (key)
            properties.push({ key, value: attr(p, 'value') ?? '' });
    }
    return { source, mediaType: attr(root, 'type') ?? MEDIA.source, uri, properties, rawXml: xml };
}
// --- Lock -------------------------------------------------------------------
function parseLockHandle(xml) {
    try {
        const root = parseXml(xml);
        return childText(root, 'LOCK_HANDLE') ?? childText(root, 'lockHandle') ?? undefined;
    }
    catch {
        return undefined;
    }
}
function parseLockTransport(xml) {
    try {
        const root = parseXml(xml);
        return childText(root, 'CORRNR') ?? undefined;
    }
    catch {
        return undefined;
    }
}
// --- Activation -------------------------------------------------------------
function parseActivationResult(xml) {
    const root = parseXml(xml);
    const items = [];
    let success = true;
    // Activation envelope with messages (chkl namespace).
    const messages = collectMessages(root);
    const messageEls = messages.filter((m) => m.severity === 'E');
    // Per-object references in the response.
    for (const el of children(root, 'objectReference')) {
        const uri = attr(el, 'uri') ?? '';
        const status = attr(el, 'status') ?? (messageEls.length ? 'ERROR' : 'ACTIVATED');
        const objMessages = [];
        for (const msg of children(el, 'message')) {
            const severity = severityOf(attr(msg, 'type'));
            const parsed = {
                severity,
                text: childText(msg, 'shortText') ?? childText(msg, 'text') ?? '',
                id: attr(msg, 'id'),
                code: attr(msg, 'code'),
                longText: childText(msg, 'longText'),
                line: attr(msg, 'line') ? Number(attr(msg, 'line')) : undefined,
                offset: attr(msg, 'offset') ? Number(attr(msg, 'offset')) : undefined,
            };
            objMessages.push(parsed);
            if (severity === 'E')
                success = false;
        }
        if (status === 'ERROR')
            success = false;
        items.push({
            uri,
            type: attr(el, 'type') ?? '',
            name: attr(el, 'name') ?? '',
            status,
            message: objMessages.map((m) => m.text).join('; ') || undefined,
            severity: messageEls.length ? 'E' : 'S',
            syntaxErrors: objMessages,
        });
    }
    // No per-object list: surface global messages (e.g. object not found).
    if (items.length === 0) {
        for (const m of messages) {
            if (m.severity === 'E')
                success = false;
            items.push({
                uri: '',
                type: '',
                name: m.id ?? '',
                status: m.severity === 'E' ? 'ERROR' : 'MESSAGE',
                message: m.text,
                severity: m.severity,
                syntaxErrors: [m],
            });
        }
    }
    return { success, items };
}
/** Collect `<msg>`/`<message>` elements anywhere in the tree. */
function collectMessages(root) {
    const out = [];
    const walk = (node) => {
        for (const el of children(node, 'msg') ?? []) {
            const severity = severityOf(attr(el, 'type'));
            out.push({
                severity,
                text: childText(el, 'shortText') ?? childText(el, 'text') ?? '',
                id: attr(el, 'id'),
                code: attr(el, 'code'),
                longText: childText(el, 'longText'),
            });
        }
        for (const el of children(node, 'message')) {
            out.push({
                severity: severityOf(attr(el, 'type')),
                text: childText(el, 'shortText') ?? childText(el, 'text') ?? '',
                id: attr(el, 'id'),
                code: attr(el, 'code'),
                longText: childText(el, 'longText'),
            });
        }
        for (const childNode of node.children)
            walk(childNode);
    };
    walk(root);
    return out;
}
function parseCheckMessages(xml) {
    try {
        const root = parseXml(xml);
        return collectMessages(root);
    }
    catch {
        return [];
    }
}
// --- Async run helpers ------------------------------------------------------
function extractRunId(response) {
    // Location header (201) or a link/ID element in the body.
    const location = response.headers.get('location');
    if (location) {
        const match = /([0-9a-fA-F-]{8,})/.exec(location);
        if (match)
            return match[1];
    }
    try {
        const root = parseXml(response.text);
        const id = childText(root, 'id') ?? attr(root, 'id') ?? attr(root, 'runId');
        if (id)
            return id;
        // Atom link rel="self"/"status" with the id embedded in href.
        for (const link of children(root, 'link')) {
            const href = attr(link, 'href');
            if (!href)
                continue;
            const match = /([0-9a-fA-F-]{8,})/.exec(href);
            if (match)
                return match[1];
        }
    }
    catch {
        /* fall through */
    }
    throw new AdtError('ADT: could not extract run id from response', response.status, [], response.text);
}
function isUnitRunComplete(xml) {
    try {
        const root = parseXml(xml);
        const status = (attr(root, 'status') ?? childText(root, 'status') ?? '').toLowerCase();
        return status === 'completed' || status === 'complete' || status === 'done' || status === 'finished' ||
            (attr(root, 'completed') === 'true') || (attr(root, 'done') === 'true');
    }
    catch {
        return false;
    }
}
function extractDisplayId(xml) {
    try {
        const root = parseXml(xml);
        const display = childText(root, 'displayId') ?? attr(root, 'displayId');
        if (display)
            return display;
        for (const link of children(root, 'link')) {
            const rel = attr(link, 'rel') ?? '';
            if (rel.includes('result')) {
                const href = attr(link, 'href');
                if (href) {
                    const match = /([0-9a-fA-F-]{8,})/.exec(href);
                    if (match)
                        return match[1];
                }
            }
        }
        return undefined;
    }
    catch {
        return undefined;
    }
}
function isAtcRunComplete(xml) {
    try {
        const root = parseXml(xml);
        const state = (attr(root, 'state') ?? childText(root, 'state') ?? '').toLowerCase();
        if (state && (state.includes('completed') || state.includes('finished') || state.includes('done')))
            return true;
        const phases = children(root, 'phase');
        if (phases.length) {
            return phases.every((p) => (attr(p, 'state') ?? '').toLowerCase() === 'completed');
        }
        return false;
    }
    catch {
        return false;
    }
}
// --- Unit result (JUnit XML) ------------------------------------------------
function parseUnitRunResult(xml) {
    let root;
    try {
        root = parseXml(xml);
    }
    catch {
        return {
            success: false,
            overall: 'ABORTED',
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            errors: 0,
            durationMs: 0,
            classes: [],
        };
    }
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let errors = 0;
    let durationMs = 0;
    const classes = [];
    if (root.name === 'testsuites' || root.name === 'testsuite' || child(root, 'testsuite')) {
        // JUnit XML format.
        const suites = root.name === 'testsuites' ? children(root, 'testsuite') : [root];
        const attrNum = (el, key) => {
            const v = attr(el, key);
            return v ? Number(v) || 0 : 0;
        };
        durationMs = Math.round(attrNum(root, 'time') * 1000);
        for (const suite of suites) {
            const className = attr(suite, 'name') ?? '';
            const tests = [];
            for (const tc of children(suite, 'testcase')) {
                const methodName = attr(tc, 'name') ?? '';
                const time = attrNum(tc, 'time');
                const failure = child(tc, 'failure');
                const err = child(tc, 'error');
                const skip = child(tc, 'skipped');
                let status = 'PASSED';
                let message;
                let longText;
                if (failure) {
                    status = 'FAILED';
                    message = attr(failure, 'message');
                    longText = failure.text || undefined;
                }
                else if (err) {
                    status = 'ERROR';
                    message = attr(err, 'message');
                    longText = err.text || undefined;
                }
                else if (skip) {
                    status = 'SKIPPED';
                    message = attr(skip, 'message');
                }
                total++;
                if (status === 'PASSED')
                    passed++;
                else if (status === 'FAILED')
                    failed++;
                else if (status === 'SKIPPED')
                    skipped++;
                else
                    errors++;
                tests.push({
                    className,
                    methodName,
                    status,
                    durationMs: Math.round(time * 1000),
                    message,
                    longText,
                });
            }
            classes.push({ className, status: failed > 0 ? 'FAILED' : errors > 0 ? 'ERROR' : 'PASSED', tests });
        }
    }
    else {
        // Native ABAP Unit XML shape.
        for (const classEl of [...children(root, 'class'), ...children(root, 'testClass')]) {
            const className = attr(classEl, 'name') ?? '';
            const tests = [];
            for (const m of [...children(classEl, 'method'), ...children(classEl, 'test')]) {
                const status = (attr(m, 'status') ?? attr(m, 'result') ?? 'ERROR');
                const duration = attr(m, 'duration') ?? attr(m, 'runtime');
                const test = {
                    className,
                    methodName: attr(m, 'name') ?? '',
                    status,
                    durationMs: duration ? Number(duration) : 0,
                    message: childText(m, 'shortText') ?? childText(m, 'message') ?? undefined,
                    longText: childText(m, 'longText') ?? undefined,
                    line: attr(m, 'line') ? Number(attr(m, 'line')) : undefined,
                    offset: attr(m, 'offset') ? Number(attr(m, 'offset')) : undefined,
                };
                total++;
                if (status === 'PASSED')
                    passed++;
                else if (status === 'FAILED')
                    failed++;
                else if (status === 'SKIPPED' || status === 'DISABLED')
                    skipped++;
                else
                    errors++;
                tests.push(test);
            }
            classes.push({
                className,
                status: (attr(classEl, 'status') ?? 'ERROR'),
                tests,
            });
        }
    }
    const overall = errors > 0 ? 'ABORTED' : failed > 0 ? 'FAILED' : total > 0 ? 'SUCCESS' : 'ABORTED';
    return { success: overall === 'SUCCESS' && failed === 0 && errors === 0, overall, total, passed, failed, skipped, errors, durationMs, classes };
}
// --- ATC result (checkstyle XML) --------------------------------------------
function parseAtcResult(xml, variant) {
    const root = parseXml(xml);
    const findings = [];
    const counts = {
        INFO: 0,
        WARNING: 0,
        ERROR: 0,
        CRITICAL: 0,
        CATASTROPHIC: 0,
    };
    for (const file of children(root, 'file')) {
        const fileName = attr(file, 'name') ?? '';
        const objectName = fileName.split('/').pop()?.split('.')[0] ?? fileName;
        for (const err of children(file, 'error')) {
            const severity = severityFromCheckstyle(attr(err, 'severity'));
            counts[severity] = (counts[severity] ?? 0) + 1;
            findings.push({
                check: attr(err, 'source') ?? '',
                checkTitle: attr(err, 'source') ?? '',
                severity,
                message: attr(err, 'message') ?? '',
                objectName,
                uri: '',
                line: attr(err, 'line') ? Number(attr(err, 'line')) : undefined,
                offset: attr(err, 'column') ? Number(attr(err, 'column')) : undefined,
                messageId: attr(err, 'source'),
                longText: undefined,
            });
        }
    }
    const clean = counts.ERROR + counts.CRITICAL + counts.CATASTROPHIC === 0;
    return {
        success: true,
        clean,
        findings,
        counts,
        durationMs: 0,
        variant,
    };
}
function severityFromCheckstyle(value) {
    switch ((value ?? '').toLowerCase()) {
        case 'error':
            return 'ERROR';
        case 'warning':
            return 'WARNING';
        case 'info':
            return 'INFO';
        case 'critical':
            return 'CRITICAL';
        case 'catastrophic':
            return 'CATASTROPHIC';
        default:
            return 'INFO';
    }
}
function parseCreatedUri(xml) {
    try {
        const root = parseXml(xml);
        return attr(root, 'uri') ?? attr(root, 'href') ?? undefined;
    }
    catch {
        return undefined;
    }
}
// --- Transports -------------------------------------------------------------
function parseTransport(el) {
    const number = attr(el, 'number') ?? attr(el, 'request') ?? attr(el, 'requestId') ?? '';
    const status = attr(el, 'status') ?? attr(el, 'state') ?? '';
    const items = [];
    for (const item of [...children(el, 'item'), ...children(el, 'object')]) {
        items.push({
            uri: attr(item, 'uri') ?? '',
            type: attr(item, 'type') ?? '',
            name: attr(item, 'name') ?? '',
            description: attr(item, 'description') ?? '',
            action: attr(item, 'action') ?? '',
        });
    }
    return {
        number,
        description: attr(el, 'description') ?? '',
        status,
        category: attr(el, 'category') ?? attr(el, 'type') ?? '',
        owner: attr(el, 'owner') ?? attr(el, 'user') ?? '',
        system: attr(el, 'system') ?? '',
        client: attr(el, 'client') ?? '',
        createdAt: attr(el, 'createdAt'),
        target: attr(el, 'target'),
        modifiable: status !== 'R' && status !== 'L' && status !== 'released',
        items,
    };
}
//# sourceMappingURL=client.js.map