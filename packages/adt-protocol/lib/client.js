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
import { parseStructure, patchStructureXml, structureMediaType } from './structure.js';
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
        this.destination = {
            ...destination,
            // Tolerate destinations without explicit auth (treat as unauthenticated).
            auth: destination.auth ?? { type: 'none' },
            strictSSL: destination.strictSSL ?? true,
            timeoutMs: destination.timeoutMs ?? 60_000,
        };
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
        const { method = 'GET', path, body, accept, contentType, headers, noCsrf, raw, timeoutMs, stateful, signal } = options;
        const needsCsrf = !noCsrf && method !== 'GET';
        let csrf = needsCsrf ? await this.ensureCsrfToken(signal) : undefined;
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
            // Link the caller's cooperative-cancellation signal: whichever fires
            // first (timeout or abort) cancels the fetch. Passing `signal` on the
            // listener options removes it again once the controller aborts, so a
            // long-lived caller signal never accumulates listeners across requests.
            if (signal) {
                if (signal.aborted)
                    controller.abort(signal.reason);
                else
                    signal.addEventListener('abort', () => controller.abort(signal.reason), {
                        once: true,
                        signal: controller.signal,
                    });
            }
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
                if (controller.signal.aborted && signal?.aborted) {
                    throw new AdtError(`ADT ${method} ${path} aborted: ${cause.message ?? cause}`);
                }
                if (controller.signal.aborted) {
                    throw new AdtError(`ADT ${method} ${path} timed out after ${timeoutMs ?? this.destination.timeoutMs ?? 60_000} ms`);
                }
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
                    csrf = await this.ensureCsrfToken(signal);
                    continue;
                }
                throw new AdtError(`ADT ${method} ${path} -> HTTP ${response.status}${detail ? `: ${detail}` : ''}`, response.status, messages, text);
            }
            return { status: response.status, headers: response.headers, text: await response.text().catch(() => '') };
        }
        throw new AdtError(`ADT ${method} ${path} -> CSRF retry exhausted`);
    }
    /** Fetch (and cache) the CSRF token via the standard discovery probe. */
    async ensureCsrfToken(signal) {
        if (this.csrfToken)
            return this.csrfToken;
        // The session and CSRF token must be bound to the destination client:
        // multi-client systems reject tokens issued against another client.
        const path = `${ENDPOINTS.discovery()}${toQuery(this.baseQuery({}))}`;
        const response = await this.request({
            method: 'GET',
            path,
            accept: 'application/atomsvc+xml, application/xml',
            noCsrf: true,
            headers: { 'X-CSRF-Token': 'fetch' },
            signal,
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
    async discover(options = {}) {
        const res = await this.request({
            path: ENDPOINTS.discovery(),
            accept: 'application/atomsvc+xml, application/xml',
            signal: options.signal,
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
    async systemInfo(options = {}) {
        let systemId = '';
        let userName = '';
        let client = '';
        let language = '';
        try {
            const res = await this.request({
                path: `${ADT_BASE_PATH}/core/http/systeminformation?sap-client=${encodeURIComponent(this.destination.client ?? '')}`,
                accept: 'application/vnd.sap.adt.core.http.systeminformation.v1+json',
                signal: options.signal,
            });
            const data = JSON.parse(res.text);
            systemId = data.systemID ?? '';
            userName = data.userName ?? '';
            client = data.client ?? '';
            language = data.language ?? '';
        }
        catch (error) {
            // A caller-initiated abort must not be swallowed by this fallback.
            if (options.signal?.aborted)
                throw error;
            // Endpoint unavailable → rely on discovery below.
        }
        const discovery = await this.discover({ signal: options.signal });
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
                signal: options.signal,
            });
            const parsed = parseSearchResult(res.text, query);
            // Some backends only match with a wildcard: a bare term is treated as an
            // exact token and returns zero hits (e.g. 'ZCL_MCP_TOOL' → 0, while
            // 'ZCL_MCP_TOOL*' → hits). Retry with a trailing '*' and say so.
            if (parsed.count === 0 && !/[*?]/.test(query)) {
                const wildcard = await this.search(`${query}*`, {
                    maxResults: options.maxResults,
                    objectType: options.objectType,
                    packageName: options.packageName,
                    operation: 'quickSearch',
                    signal: options.signal,
                });
                if (wildcard.count > 0) {
                    wildcard.note = `'${query}' matched nothing; retried as '${query}*' — this backend requires a wildcard for name search`;
                }
                return wildcard;
            }
            return parsed;
        }
        catch (error) {
            // A caller-initiated abort must not be retried as a degraded search.
            if (options.signal?.aborted)
                throw error;
            // Fall back to plain quickSearch when a narrowed operation is rejected
            // (500 on limited search providers; 400/404/405 on minimal profiles).
            if (error instanceof AdtError &&
                (error.status === 500 || error.status === 400 || error.status === 404 || error.status === 405) &&
                operation !== 'quickSearch') {
                const fallback = await this.search(query, {
                    maxResults: options.maxResults,
                    objectType: options.objectType,
                    packageName: options.packageName,
                    operation: 'quickSearch',
                    signal: options.signal,
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
    /**
     * Read the main source of an object by its ADT URI. `version` selects the
     * active or inactive representation (`?version=active|inactive`); without
     * it the backend returns the CURRENT source — the inactive version when
     * one exists, else the active one.
     */
    async readSource(objectUri, options = {}) {
        const uri = normalizeUri(objectUri);
        const attempts = uri.endsWith('/source/main') ? [uri] : [`${uri}/source/main`, uri];
        const withVersion = (path) => options.version ? `${path}${path.includes('?') ? '&' : '?'}version=${options.version}` : path;
        let lastError;
        for (const path of attempts) {
            try {
                const res = await this.request({ path: withVersion(path), accept: 'text/plain', signal: options.signal });
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
            // Strict backends negotiate the response of /source/main as text/plain;
            // an `Accept: application/xml` is rejected with HTTP 406 there.
            accept: 'text/plain',
            stateful: true,
            signal: options.signal,
        });
    }
    /**
     * Lock an object for editing. Returns the lock handle (required by write /
     * unlock) and the transport request the backend assigned (CORRNR).
     */
    async lock(objectUri, options = {}) {
        const uri = normalizeUri(objectUri);
        const query = this.baseQuery({ _action: 'LOCK', accessMode: 'MODIFY' });
        const res = await this.request({
            method: 'POST',
            path: `${uri}${toQuery(query)}`,
            accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
            stateful: true,
            signal: options.signal,
        });
        const handle = parseLockHandle(res.text) ?? res.headers.get('x-adt-lock-handle') ?? '';
        const transport = parseLockTransport(res.text);
        if (!handle)
            throw new AdtError('ADT: lock succeeded but no lock handle was returned', res.status, [], res.text);
        return { handle, transport };
    }
    /** Unlock an object previously locked with the given handle. */
    async unlock(objectUri, handle, options = {}) {
        const uri = normalizeUri(objectUri);
        const query = this.baseQuery({ _action: 'UNLOCK', lockHandle: handle });
        await this.request({
            method: 'POST',
            path: `${uri}${toQuery(query)}`,
            accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result',
            stateful: true,
            signal: options.signal,
        });
    }
    /**
     * Unlock with the given handle; when that fails (or no handle is known),
     * retry WITHOUT a handle. Some backends release the lock on a bare
     * `_action=UNLOCK` (same user), which lets `unlock_all` clean residual
     * locks whose handle was never returned (e.g. create-time auto locks).
     */
    async unlockBestEffort(objectUri, handle, options = {}) {
        const uri = normalizeUri(objectUri);
        if (handle) {
            try {
                await this.unlock(uri, handle, options);
                return { released: true };
            }
            catch (error) {
                // A caller-initiated abort must not be masked as a lock failure.
                if (options.signal?.aborted)
                    throw error;
                // fall through to the handle-less attempt
                if (error instanceof AdtError && error.status === 403) {
                    return { released: false, note: `lock held by another user: ${error.message}` };
                }
            }
        }
        try {
            await this.request({
                method: 'POST',
                path: `${uri}${toQuery(this.baseQuery({ _action: 'UNLOCK' }))}`,
                accept: 'application/xml',
                stateful: true,
                signal: options.signal,
            });
            return { released: true, note: handle ? 'released via handle-less unlock' : 'released (no lock handle was known)' };
        }
        catch (error) {
            return {
                released: false,
                note: `unlock failed${handle ? ` with handle ${handle}` : ''} (HTTP ${error.status ?? '?'}): ${error.message}`,
            };
        }
    }
    /** Lock → write → unlock in one step (safe even if write fails). */
    async updateSource(objectUri, source, options = {}) {
        const { handle } = await this.lock(objectUri, { signal: options.signal });
        try {
            await this.writeSource(objectUri, source, { lockHandle: handle, transport: options.transport, signal: options.signal });
        }
        finally {
            if (options.unlock !== false) {
                // Cleanup deliberately runs WITHOUT the caller signal: an aborted
                // write must still release the backend lock it acquired.
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
        const doActivate = async (path) => {
            const res = await this.request({
                method: 'POST',
                path,
                body,
                contentType: MEDIA.activation,
                accept: 'application/xml',
                stateful: true,
                timeoutMs: 300_000,
                signal: options.signal,
            });
            return parseActivationResult(res.text);
        };
        try {
            return await doActivate(`${ENDPOINTS.activation()}${toQuery(query)}`);
        }
        catch (error) {
            // A caller-initiated abort must not be retried on the compat route.
            if (options.signal?.aborted)
                throw error;
            // Compatibility-mode backends (older / restricted ADT profiles) register
            // the activation service under /sap/bc/adt/activation instead of
            // /sap/bc/adt/repository/activation. Retry there on 404/405.
            if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
                const compatQuery = { ...query, preauditRequested: 'false' };
                return await doActivate(`${ENDPOINTS.activationCompatibility()}${toQuery(compatQuery)}`);
            }
            throw error;
        }
    }
    /** Syntax/consistency check via the check-run service (no activation). */
    async check(objects, options = {}) {
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
            signal: options.signal,
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
        let start;
        try {
            start = await this.request({
                method: 'POST',
                path: `${ENDPOINTS.unitRuns()}${toQuery(query)}`,
                body,
                contentType: MEDIA.abapUnitRun,
                accept: MEDIA.abapUnitRunStatus,
                stateful: true,
                timeoutMs: 60_000,
                signal: options.signal,
            });
        }
        catch (error) {
            // Old / restricted backends (BASIS < 7.5x, e.g. NW 7.4x compatibility
            // profiles) never shipped the async run API — POST /abapunit/runs is a
            // plain 404 there. They only expose the synchronous /abapunit/testruns
            // service, exactly like the official ADT client's fallback. (Same
            // pattern as the activation compatibility path above.)
            if (error instanceof AdtError && error.status === 404) {
                return await this.runUnitTestsLegacy(objects, options.signal);
            }
            throw error;
        }
        const runId = extractRunId(start);
        const deadline = Date.now() + (options.timeoutMs ?? 300_000);
        for (;;) {
            const status = await this.request({
                path: `${ENDPOINTS.unitRuns()}/${encodeURIComponent(runId)}${toQuery(this.baseQuery({ withLongPolling: 'true' }))}`,
                accept: MEDIA.abapUnitRunStatus,
                timeoutMs: 60_000,
                signal: options.signal,
            });
            const done = isUnitRunComplete(status.text);
            if (done)
                break;
            if (Date.now() > deadline)
                throw new AdtError('ADT: ABAP Unit run timed out');
            await sleep(1500, options.signal);
        }
        const results = await this.request({
            path: `${ENDPOINTS.unitResults()}/${encodeURIComponent(runId)}${toQuery(this.baseQuery())}`,
            accept: MEDIA.abapUnitResult,
            timeoutMs: 60_000,
            signal: options.signal,
        });
        return parseUnitRunResult(results.text);
    }
    /**
     * Legacy synchronous ABAP Unit run (old backends, `POST
     * /abapunit/testruns`). The backend executes the run inside the POST and
     * answers with `aunit:runResult` — there is no run id and nothing to poll.
     */
    async runUnitTestsLegacy(objects, signal) {
        const body = buildUnitRunRequestLegacy(objects);
        const res = await this.request({
            method: 'POST',
            path: `${ENDPOINTS.unitTestRunsLegacy()}${toQuery(this.baseQuery({}))}`,
            body,
            contentType: 'application/xml',
            accept: 'application/xml',
            stateful: true,
            // The run executes synchronously; allow generous time for big suites.
            timeoutMs: 300_000,
            signal,
        });
        return parseUnitRunResult(res.text);
    }
    // ---------------------------------------------------------------------------
    // ATC (async run flow)
    // ---------------------------------------------------------------------------
    /** Run ABAP Test Cockpit checks; polls the async run until completion. */
    async runAtc(objects, options = {}) {
        const body = buildAtcRunRequest(objects, options.variant);
        // Some backends reject the start request unless clientWait=false is sent
        // explicitly (error: 'Only "false" is currently supported as
        // QueryParameter "ClientWait"').
        const query = this.baseQuery({ clientWait: 'false' });
        const start = await this.request({
            method: 'POST',
            path: `${ENDPOINTS.atcRuns()}${toQuery(query)}`,
            body,
            contentType: MEDIA.atcRunParameters,
            accept: MEDIA.atcRun,
            stateful: true,
            timeoutMs: 60_000,
            signal: options.signal,
        });
        const runId = extractRunId(start);
        const deadline = Date.now() + (options.timeoutMs ?? 600_000);
        let displayId = runId;
        for (;;) {
            const status = await this.request({
                path: `${ENDPOINTS.atcRuns()}/${encodeURIComponent(runId)}${toQuery(this.baseQuery())}`,
                accept: MEDIA.atcRun,
                timeoutMs: 60_000,
                signal: options.signal,
            });
            displayId = extractDisplayId(status.text) ?? runId;
            if (isAtcRunComplete(status.text))
                break;
            if (Date.now() > deadline)
                throw new AdtError('ADT: ATC run timed out');
            await sleep(2000, options.signal);
        }
        const results = await this.request({
            path: `${ENDPOINTS.atcResults()}/${encodeURIComponent(displayId)}${toQuery(this.baseQuery())}`,
            // Real on-prem backends reject the checkstyle media type here (406) and
            // serve the result with plain application/xml.
            accept: 'application/xml',
            timeoutMs: 60_000,
            signal: options.signal,
        });
        return parseAtcResultBody(results.text, displayId);
    }
    /**
     * List existing ATC runs (the results collection). The backend requires at
     * least one filter; when none is given the logged-on user is used.
     */
    async listAtcRuns(options = {}) {
        const params = this.baseQuery({
            ...(options.createdBy ?? (this.destination.auth.type === 'basic' ? this.destination.auth.username : undefined)
                ? { createdBy: options.createdBy ?? (this.destination.auth.type === 'basic' ? this.destination.auth.username : undefined) }
                : {}),
            ...(options.ageMin !== undefined ? { ageMin: options.ageMin } : {}),
            ...(options.ageMax !== undefined ? { ageMax: options.ageMax } : {}),
            ...(options.central ? { centralResult: 'true' } : {}),
            ...(options.active ? { activeResult: 'true' } : {}),
            ...(options.sysId ? { sysId: options.sysId } : {}),
            ...(options.contactPerson ? { contactPerson: options.contactPerson } : {}),
        });
        const res = await this.request({
            path: `${ENDPOINTS.atcResults()}${toQuery(params)}`,
            accept: 'application/xml',
            signal: options.signal,
        });
        return parseAtcResultList(res.text);
    }
    /**
     * Fetch one ATC run result by display id (checkstyle XML on on-prem
     * backends; the raw body is preserved when the format is unknown).
     */
    async getAtcResult(displayId, options = {}) {
        const params = this.baseQuery({
            ...(options.includeExemptedFindings ? { includeExemptedFindings: 'true' } : {}),
        });
        const res = await this.request({
            path: `${ENDPOINTS.atcResults()}/${encodeURIComponent(displayId)}${toQuery(params)}`,
            accept: 'application/xml',
            signal: options.signal,
        });
        return parseAtcResultBody(res.text, displayId);
    }
    // ---------------------------------------------------------------------------
    // Transports
    // ---------------------------------------------------------------------------
    /** List transport requests of the current user (or all users). */
    async listTransports(options = {}) {
        const params = this.baseQuery({
            ...(options.allUsers ? { user: '*' } : {}),
            ...(options.category ? { type: options.category } : {}),
            ...(options.status && options.status !== 'all' ? { status: options.status } : {}),
        });
        const res = await this.request({
            path: `${ENDPOINTS.transportRequests()}${toQuery(params)}`,
            accept: MEDIA.transportOrganizerTree,
            signal: options.signal,
        });
        const root = parseXml(res.text);
        const transports = [];
        // Real backends return a Transport Organizer Tree (tm:root → tm:workbench /
        // tm:customizing → tm:modifiable / tm:released → tm:request), while the mock
        // returns requests flat under the root. Walk the whole tree so both shapes work.
        const wantModifiable = options.status === 'modifiable' || options.status === 'D';
        const wantReleased = options.status === 'released' || options.status === 'R' || options.status === 'L';
        for (const el of collectTransportRequests(root)) {
            const parsed = parseTransport(el);
            if (wantModifiable && isReleasedStatus(parsed.status))
                continue;
            if (wantReleased && !isReleasedStatus(parsed.status))
                continue;
            transports.push(parsed);
        }
        return transports;
    }
    /** Get one transport request incl. its items. */
    async getTransport(number, options = {}) {
        const res = await this.request({
            path: `${ENDPOINTS.transportRequests()}/${encodeURIComponent(number)}${toQuery(this.baseQuery())}`,
            accept: MEDIA.transportOrganizer,
            signal: options.signal,
        });
        const root = parseXml(res.text);
        // Real backends wrap the request in a <tm:root> envelope (the root carries
        // adtcore metadata like type="RQRQ"); the mock returns the request element
        // itself as root. Accept both shapes.
        const el = isRequestElement(root) ? root : findRequestElement(root);
        if (!el) {
            throw new AdtError(`Transport response for ${number} did not contain a request element`, res.status, [], res.text);
        }
        return parseTransport(el);
    }
    /**
     * Version history (Atom feed) of a source object. Each version carries the
     * transport request (or open task) it was saved into — a read-only way to
     * map objects to transports without locking. Numbers that resolve via
     * `getTransport` are requests; a version whose transport number does not
     * resolve is an open task of an unreleased request.
     */
    async getVersions(objectUri, options = {}) {
        const uri = normalizeUri(objectUri);
        const res = await this.request({
            path: `${uri}/source/main/versions${toQuery(this.baseQuery())}`,
            accept: 'application/atom+xml;type=feed',
            signal: options.signal,
        });
        const root = parseXml(res.text);
        const versions = [];
        for (const entry of children(root, 'entry')) {
            const author = child(entry, 'author');
            const transportLink = children(entry, 'link').find((l) => attr(l, 'rel') === TRANSPORT_REQUEST_REL);
            versions.push({
                versionId: childText(entry, 'id') ?? '',
                author: (author ? childText(author, 'name') : undefined) || undefined,
                updatedAt: childText(entry, 'updated') || undefined,
                title: childText(entry, 'title') || undefined,
                contentUri: attr(child(entry, 'content') ?? entry, 'src') || undefined,
                transportRequest: transportLink ? attr(transportLink, 'name') || undefined : undefined,
                transportDescription: transportLink ? attr(transportLink, 'title') || undefined : undefined,
            });
        }
        return versions;
    }
    // ---------------------------------------------------------------------------
    // Where-used / impact analysis
    // ---------------------------------------------------------------------------
    /**
     * Find objects that reference or depend on the given object (where-used).
     * Hits the `/repository/informationsystem/usageReferences` collection with
     * the object URI. Parsing is tolerant of the `usagereferences:` prefix.
     */
    async getWhereUsed(objectUri, options = {}) {
        const uri = normalizeUri(objectUri);
        const params = this.baseQuery({ uri });
        if (options.enableAllTypes)
            params.enableAllTypes = true;
        const res = await this.request({
            path: ENDPOINTS.whereUsed(params),
            accept: 'application/xml',
            timeoutMs: 60_000,
            signal: options.signal,
        });
        return parseWhereUsed(res.text, uri);
    }
    // ---------------------------------------------------------------------------
    // Data preview (tables / CDS / freestyle SQL)
    // ---------------------------------------------------------------------------
    /** Preview rows of a DDIC entity (table/structure/view) or a CDS view. */
    async dataPreview(name, kind, options = {}) {
        const top = Math.min(Math.max(options.top ?? 100, 1), 5000);
        const params = this.baseQuery({ rowNumber: top });
        try {
            const res = await this.request({
                path: kind === 'cds' ? ENDPOINTS.dataPreviewCds(name, params) : ENDPOINTS.dataPreviewDdic(name, params),
                accept: 'application/vnd.sap.adt.datapreview.table.v1+xml',
                timeoutMs: 60_000,
                signal: options.signal,
            });
            return parseDataPreview(res.text, name);
        }
        catch (error) {
            // A caller-initiated abort must not fall through to the SQL route.
            if (options.signal?.aborted)
                throw error;
            // Older / restricted ADT profiles do not expose the ddic/cds preview
            // collection; fall back to the freestyle SQL endpoint.
            if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
                return this.runSqlQuery(`SELECT * FROM ${name} UP TO ${top} ROWS`, { top, signal: options.signal });
            }
            throw error;
        }
    }
    /** Execute a freestyle SQL SELECT via the data-preview API. */
    async runSqlQuery(sql, options = {}) {
        const top = Math.min(Math.max(options.top ?? 100, 1), 5000);
        const params = this.baseQuery({ sqlQuery: sql, rowNumber: top });
        try {
            const res = await this.request({
                path: ENDPOINTS.dataPreviewFreestyle(params),
                accept: 'application/vnd.sap.adt.datapreview.table.v1+xml',
                timeoutMs: 60_000,
                signal: options.signal,
            });
            return parseDataPreview(res.text, sql);
        }
        catch (error) {
            // A caller-initiated abort must not be retried via POST.
            if (options.signal?.aborted)
                throw error;
            // Compatibility-mode backends reject GET on /datapreview/freestyle (405)
            // and expect the SQL as the request body of a POST.
            if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
                const res = await this.request({
                    method: 'POST',
                    path: `${ENDPOINTS.dataPreviewFreestyle(this.baseQuery({ rowNumber: top }))}`,
                    body: sql,
                    contentType: 'text/plain; charset=utf-8',
                    accept: 'application/vnd.sap.adt.datapreview.table.v1+xml',
                    timeoutMs: 60_000,
                    signal: options.signal,
                });
                return parseDataPreview(res.text, sql);
            }
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // Version sources & lock state
    // ---------------------------------------------------------------------------
    /** Fetch the source of one object version by its content URI (from getVersions). */
    async getVersionSource(contentUri, options = {}) {
        const res = await this.request({ path: contentUri, accept: 'text/plain', signal: options.signal });
        return res.text;
    }
    /** Best-effort read of an object's lock state via its metadata. */
    async getObjectLock(objectUri, type, options = {}) {
        const uri = normalizeUri(objectUri);
        // Strict backends negotiate object metadata by the TYPE-specific media
        // type (e.g. application/vnd.sap.adt.oo.classes.v4+xml for a class) and
        // reject the generic object media type with HTTP 406; other backends (and
        // the mock) expose lock state only on the generic object representation.
        const attempts = [];
        const typed = metadataAccept(type);
        if (typed !== 'application/xml')
            attempts.push(typed);
        attempts.push(MEDIA.object, 'application/xml');
        for (const accept of attempts) {
            try {
                const res = await this.request({ path: uri, accept, signal: options.signal });
                const info = parseLockInfo(res.text);
                if (info.locked !== undefined || info.lockedBy) {
                    return { ...info, note: undefined };
                }
            }
            catch (error) {
                if (options.signal?.aborted)
                    throw error;
                if (error instanceof AdtError && (error.status === 406 || error.status === 404 || error.status === 405)) {
                    continue; // wrong media type / unsupported route → try the next
                }
                // A non-negotiation error (e.g. 401/403/500) is authoritative.
                if (error instanceof AdtError) {
                    return { locked: undefined, note: `could not read object metadata: ${error.message}` };
                }
                continue;
            }
        }
        // Metadata did not expose lock state → try the transports relationship
        // endpoints (some backends report LOCK_HANDLE/CORRNR there).
        const viaTransports = await this.lockStateViaTransports(uri, options.signal);
        if (viaTransports.locked !== undefined || viaTransports.lockedBy)
            return viaTransports;
        return {
            locked: undefined,
            note: 'backend does not expose lock state in object metadata',
        };
    }
    /**
     * Try the transports relationship endpoints for lock state. Some backends
     * answer `GET {objectUri}/transports` (or the repository
     * `objectproperties/transports?uri=` collection) with LOCK_HANDLE / CORRNR
     * data; both are probed read-only and failures degrade silently.
     */
    async lockStateViaTransports(objectUri, signal) {
        const candidates = [];
        const relation = `${objectUri}/transports`;
        if (relation.startsWith('/sap/bc/adt'))
            candidates.push(relation);
        candidates.push(`/sap/bc/adt/repository/informationsystem/objectproperties/transports?uri=${encodeURIComponent(objectUri)}`);
        for (const path of candidates) {
            try {
                const res = await this.request({ path, accept: 'application/xml', timeoutMs: 30_000, signal });
                // Element-shaped data: <LOCK_HANDLE>…</LOCK_HANDLE> / <CORRNR>…</CORRNR>.
                const lockHandle = localText(res.text, 'LOCK_HANDLE') ?? localText(res.text, 'lockHandle');
                const corr = localText(res.text, 'CORRNR') ?? localText(res.text, 'corrNr');
                if (lockHandle) {
                    return {
                        locked: true,
                        transport: corr || undefined,
                        note: `lock handle recoverable via ${path} — use adt_unlock_all to release`,
                    };
                }
            }
            catch {
                // endpoint not supported → keep probing / degrade below
            }
        }
        return { locked: undefined };
    }
    /** Release a transport request. */
    async releaseTransport(number, options = {}) {
        const res = await this.request({
            method: 'POST',
            path: `${ENDPOINTS.transportRequests()}/${encodeURIComponent(number)}/release${toQuery(this.baseQuery())}`,
            accept: MEDIA.transportOrganizer,
            stateful: true,
            timeoutMs: 120_000,
            signal: options.signal,
        });
        const root = parseXml(res.text);
        const el = isRequestElement(root) ? root : findRequestElement(root);
        if (!el) {
            throw new AdtError(`Release response for ${number} did not contain a request element`, res.status, [], res.text);
        }
        return parseTransport(el);
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
                signal: options.signal,
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
            signal: options.signal,
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
    async createObject(request, options = {}) {
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
            signal: options.signal,
        });
        // Some backends (e.g. minimal NetWeaver ADT profiles) return HTTP 200 with
        // an EMPTY body and no Location header — derive the URI by convention then.
        const uri = res.headers.get('location') ??
            parseCreatedUri(res.text) ??
            uriForCreated(request.type, request.name);
        const name = uri.split('/').pop()?.toUpperCase() ?? request.name;
        return {
            success: res.status === 201 || res.status === 200,
            uri,
            object: uri ? { uri, type: request.type, name, category } : undefined,
            messages: [],
        };
    }
    /**
     * Delete an object. Prefers the modern deletion service
     * (`POST /sap/bc/adt/deletion/delete`, response media type
     * `deletion.response.v1+xml`) and falls back to the legacy
     * `_action=DELETE` action on the object URI when the service is absent.
     */
    async deleteObject(objectUri, options = {}) {
        const uri = normalizeUri(objectUri);
        // 1) Modern deletion service (NW 7.5x+; strictly negotiated media types).
        try {
            const body = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${escapeXml(uri)}">
    ${options.transport ? `<del:transportNumber>${escapeXml(options.transport)}</del:transportNumber>` : '<del:transportNumber/>'}
  </del:object>
</del:deletionRequest>`;
            await this.request({
                method: 'POST',
                path: ENDPOINTS.deletion(this.baseQuery()),
                body,
                contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
                accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
                stateful: true,
                timeoutMs: 120_000,
                signal: options.signal,
            });
            return;
        }
        catch (error) {
            // A caller-initiated abort must not be retried on the legacy route.
            if (options.signal?.aborted)
                throw error;
            const unsupported = error instanceof AdtError && (error.status === 404 || error.status === 405 || error.status === 406);
            if (!unsupported)
                throw error;
            // 2) Legacy `_action=DELETE` action on the object URI.
            const query = this.baseQuery({ _action: 'DELETE', deleteOption: 'deleteAndLocalVersions' });
            try {
                await this.request({
                    method: 'POST',
                    path: `${uri}${toQuery(query)}`,
                    accept: 'application/xml',
                    stateful: true,
                    signal: options.signal,
                });
                return;
            }
            catch (legacyError) {
                throw new AdtError(`ADT: deletion service unavailable (${error.status}) and legacy ` +
                    `_action=DELETE failed (${legacyError.status ?? '?'}): ${legacyError.message}`, legacyError.status, legacyError.adtMessages, legacyError.responseBody);
            }
        }
    }
    // ---------------------------------------------------------------------------
    // Runtime dumps (ST22 short-dump analysis)
    // ---------------------------------------------------------------------------
    /**
     * List runtime dumps (the ST22 feed). `from`/`to` are `YYYYMMDDHHMMSS`
     * timestamps; `user` filters by the session user; `top`/`skip` page the
     * feed (server-side `$top`/`$skip`).
     */
    async listDumps(options = {}) {
        // The backend filters via the `$query` expression syntax, e.g.
        // `and( equals( user, X ) )`; it is combined with the time-range params.
        const query = options.user
            ? `and( equals( user, ${options.user.trim()} ) )`
            : undefined;
        const params = this.baseQuery({
            ...(query ? { $query: query } : {}),
            ...(options.from ? { from: options.from } : {}),
            ...(options.to ? { to: options.to } : {}),
            ...(options.top !== undefined ? { $top: options.top } : {}),
            ...(options.skip !== undefined ? { $skip: options.skip } : {}),
        });
        const res = await this.request({
            path: ENDPOINTS.runtimeDumps(params),
            accept: 'application/atom+xml;type=feed',
            timeoutMs: 60_000,
            signal: options.signal,
        });
        return parseDumpsFeed(res.text);
    }
    /**
     * Read one runtime dump. `view` selects the representation:
     *  - `default`   — structured XML (`runtime.dump.v1+xml`), parsed to sections
     *  - `summary`   — HTML summary (raw passthrough)
     *  - `formatted` — plain-text analysis view (raw passthrough)
     */
    async getDump(dumpId, options = {}) {
        const view = options.view ?? 'default';
        const id = dumpId.trim();
        if (!id || id.includes('/'))
            throw new AdtError(`ADT: invalid dump id '${dumpId}'`);
        const res = await this.request({
            path: ENDPOINTS.runtimeDump(id, view),
            accept: view === 'summary'
                ? 'text/html'
                : view === 'formatted'
                    ? 'text/plain'
                    : 'application/vnd.sap.adt.runtime.dump.v1+xml, application/xml',
            timeoutMs: 60_000,
            signal: options.signal,
        });
        if (view !== 'default') {
            return { id, sections: [], raw: res.text, view };
        }
        return parseDumpDetail(res.text, id);
    }
    // ---------------------------------------------------------------------------
    // Program / class execution
    // ---------------------------------------------------------------------------
    /**
     * Run an ABAP executable program (console output comes back as text).
     * Equivalent to F8 in ADT: the program runs synchronously in the session.
     */
    async runProgram(programName, options = {}) {
        const name = programName.trim().toUpperCase();
        if (!name)
            throw new AdtError('ADT: program name is required');
        const res = await this.request({
            method: 'POST',
            path: `${ENDPOINTS.programRun(name)}${toQuery(this.baseQuery({}))}`,
            accept: 'text/plain, application/xml',
            stateful: true,
            timeoutMs: 300_000,
            signal: options.signal,
        });
        return { kind: 'PROG', name, output: res.text, status: res.status };
    }
    /**
     * Run a class that implements `if_oo_adt_classrun` — its `main( )` executes
     * and the `out->write( )` output comes back as text. The standard agent
     * pattern for "run logic and capture output without building a program".
     */
    async runClass(className, options = {}) {
        const name = className.trim().toUpperCase();
        if (!name)
            throw new AdtError('ADT: class name is required');
        const res = await this.request({
            method: 'POST',
            path: `${ENDPOINTS.classRun(name)}${toQuery(this.baseQuery({}))}`,
            accept: 'text/plain, application/xml',
            stateful: true,
            timeoutMs: 300_000,
            signal: options.signal,
        });
        return { kind: 'CLAS', name, output: res.text, status: res.status };
    }
    // ---------------------------------------------------------------------------
    // Protocol-level $batch
    // ---------------------------------------------------------------------------
    /**
     * Execute several ADT requests in ONE HTTP round-trip via the `$batch`
     * multipart protocol (`POST /sap/bc/adt/$batch`). Every part carries an
     * embedded HTTP request (`GET/POST/PUT <path> HTTP/1.1`); the response is
     * a multipart with one embedded HTTP response per part, in order.
     *
     * The outer POST is state-changing (CSRF applies once, for all parts);
     * `sap-client`/`sap-language` are appended to every inner request path.
     */
    async batch(parts, options = {}) {
        if (parts.length === 0)
            throw new AdtError('ADT $batch: at least one request part is required');
        const boundary = `batch_${randomUUID()}`;
        const sections = parts.map((part) => {
            const headers = [`Accept:${part.accept ?? 'application/xml'}`];
            if (part.body !== undefined && part.contentType) {
                headers.push(`Content-Type:${part.contentType}`);
            }
            const request = [
                `${part.method} ${this.innerBatchPath(part.path)} HTTP/1.1`,
                ...headers,
                '',
                part.body ?? '',
            ].join('\r\n');
            return [`--${boundary}`, 'Content-Type: application/http', 'content-transfer-encoding: binary', '', request].join('\r\n');
        });
        const body = `${sections.join('\r\n')}\r\n--${boundary}--\r\n`;
        const res = await this.request({
            method: 'POST',
            path: `${ENDPOINTS.batch()}${toQuery(this.baseQuery({}))}`,
            body,
            contentType: `multipart/mixed; boundary=${boundary}`,
            accept: 'multipart/mixed',
            stateful: true,
            timeoutMs: 120_000,
            signal: options.signal,
        });
        const contentTypeHeader = res.headers.get('content-type') ?? '';
        const boundaryMatch = /boundary=([^;\s]+)/.exec(contentTypeHeader);
        return parseBatchResponseParts(res.text, boundaryMatch?.[1] ?? boundary);
    }
    // ---------------------------------------------------------------------------
    // Structured metadata (MSAG / DOMA / DTEL / TTYP)
    // ---------------------------------------------------------------------------
    /** Read the structured metadata of a DDIC object as typed JSON. */
    async readStructure(objectUri, kind, options = {}) {
        const uri = normalizeUri(objectUri);
        const res = await this.request({
            path: `${uri}${toQuery(this.baseQuery({}))}`,
            accept: structureMediaType(kind),
            signal: options.signal,
        });
        return parseStructure(res.text, kind);
    }
    /**
     * Read-modify-write the structured metadata of a DDIC object: lock → GET
     * current XML → patch only the provided fields → PUT → unlock. The
     * optional `onLocked` hook runs right after the lock (with the backend
     * transport the lock assigned) so callers can enforce policy and abort
     * BEFORE anything is written — a throw rolls the lock back and propagates.
     */
    async writeStructure(objectUri, kind, changes, options = {}) {
        const uri = normalizeUri(objectUri);
        const { handle, transport: assigned } = await this.lock(uri, { signal: options.signal });
        try {
            if (options.onLocked)
                options.onLocked(options.transport ? undefined : assigned);
            const current = await this.request({
                path: `${uri}${toQuery(this.baseQuery({}))}`,
                accept: structureMediaType(kind),
                signal: options.signal,
            });
            const patched = patchStructureXml(current.text, kind, changes);
            const query = this.baseQuery({
                lockHandle: handle,
                ...(options.transport ?? assigned ? { corrNr: options.transport ?? assigned } : {}),
            });
            await this.request({
                method: 'PUT',
                path: `${uri}${toQuery(query)}`,
                body: patched,
                contentType: structureMediaType(kind).split(',')[0].trim(),
                accept: structureMediaType(kind),
                stateful: true,
                signal: options.signal,
            });
            const effective = await this.request({
                path: `${uri}${toQuery(this.baseQuery({ withLongPolling: 'true' }))}`,
                accept: structureMediaType(kind),
                signal: options.signal,
            });
            return { success: true, data: parseStructure(effective.text, kind), transport: options.transport ?? assigned };
        }
        finally {
            // Cleanup deliberately runs WITHOUT the caller signal: an aborted write
            // must still release the backend lock it acquired.
            await this.unlock(uri, handle).catch(() => undefined);
        }
    }
    // ---------------------------------------------------------------------------
    // Diagnostics
    // ---------------------------------------------------------------------------
    /**
     * Inner `$batch` request path: the client/language query parameters of the
     * destination are appended (once) so every embedded request executes in the
     * right session context, exactly like the outer request would carry them.
     */
    innerBatchPath(path) {
        const [base, existingQuery = ''] = path.split('?');
        const normalized = normalizeUri(base ?? path);
        const present = new Set(existingQuery.split('&').filter(Boolean).map((kv) => kv.split('=')[0]));
        const extras = [];
        if (this.destination.client && !present.has('sap-client')) {
            extras.push(['sap-client', this.destination.client]);
        }
        if (this.destination.language && !present.has('sap-language')) {
            extras.push(['sap-language', this.destination.language]);
        }
        if (extras.length === 0)
            return existingQuery ? `${normalized}?${existingQuery}` : normalized;
        const extra = extras.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
        return existingQuery ? `${normalized}?${existingQuery}&${extra}` : `${normalized}?${extra}`;
    }
    /** Lightweight reachability + auth probe. */
    async ping(options = {}) {
        try {
            const discovery = await this.discover({ signal: options.signal });
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
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (!signal) {
            setTimeout(resolve, ms);
            return;
        }
        const sig = signal;
        if (sig.aborted) {
            reject(sig.reason ?? new Error('aborted'));
            return;
        }
        const timer = setTimeout(() => {
            sig.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        function onAbort() {
            clearTimeout(timer);
            reject(sig.reason instanceof Error ? sig.reason : new AdtError(`aborted: ${String(sig.reason)}`));
        }
        sig.addEventListener('abort', onAbort, { once: true });
    });
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
/**
 * Legacy run request (`aunit:runConfiguration`, namespace
 * `http://www.sap.com/adt/aunit`) for the synchronous `/abapunit/testruns`
 * service on old backends (BASIS < 7.5x). Objects travel as
 * `adtcore:objectReference` URIs inside an inclusive object set — the same
 * payload the official ADT client's `AbapUnitRequestContentHandlerV1`
 * serializes (verified live against a NW 7.4x system).
 */
function buildUnitRunRequestLegacy(objects) {
    const refs = objects
        .map((o) => `        <adtcore:objectReference adtcore:uri="${escapeXml(o.uri)}"/>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
  <external>
    <coverage active="false"/>
  </external>
  <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
    <objectSet kind="inclusive">
      <adtcore:objectReferences>
${refs}
      </adtcore:objectReferences>
    </objectSet>
  </adtcore:objectSets>
</aunit:runConfiguration>`;
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
        DOMA: 'application/vnd.sap.adt.domains.v2+xml',
        DTEL: 'application/vnd.sap.adt.dataelements.v2+xml',
        TTYP: 'application/vnd.sap.adt.tabletypes.v2+xml',
        MSAG: 'application/xml',
        DEVC: 'application/vnd.sap.adt.packages.v2+xml',
    };
    return map[cat] ?? 'application/xml';
}
/**
 * Negotiable metadata media type for an object type. Strict backends answer
 * `GET {objectUri}` only for the type-specific representation (e.g. classes
 * want `application/vnd.sap.adt.oo.classes.v4+xml`); the generic object media
 * type is rejected with HTTP 406 there.
 */
function metadataAccept(type) {
    const cat = (type ?? '').toUpperCase().split('/')[0];
    const map = {
        CLAS: 'application/vnd.sap.adt.oo.classes.v4+xml, application/vnd.sap.adt.oo.classes.v3+xml, application/vnd.sap.adt.oo.classes.v2+xml, application/vnd.sap.adt.oo.classes.v1+xml',
        INTF: 'application/vnd.sap.adt.oo.interfaces.v5+xml, application/vnd.sap.adt.oo.interfaces.v4+xml, application/vnd.sap.adt.oo.interfaces.v3+xml, application/vnd.sap.adt.oo.interfaces.v2+xml, application/vnd.sap.adt.oo.interfaces+xml',
        PROG: 'application/vnd.sap.adt.programs.programs.v2+xml, application/vnd.sap.adt.programs.programs.v1+xml',
        FUGR: 'application/vnd.sap.adt.functions.groups.v2+xml, application/vnd.sap.adt.functions.groups.v1+xml',
        DDLS: 'application/vnd.sap.adt.ddlSource.v2+xml, application/vnd.sap.adt.ddlSource+xml',
        TABL: 'application/vnd.sap.adt.tables.v2+xml, application/vnd.sap.adt.tables.v1+xml',
        STRU: 'application/vnd.sap.adt.structures.v2+xml, application/vnd.sap.adt.structures.v1+xml',
        DEVC: 'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
    };
    return map[cat] ?? 'application/xml';
}
function buildCreateObjectRequest(request) {
    const ns = createNamespace(request.type);
    const tag = createRootTag(request.type);
    const props = Object.entries(request.properties ?? {})
        .map(([k, v]) => `    <adtcore:property adtcore:name="${escapeXml(k)}" adtcore:value="${escapeXml(v)}"/>`)
        .join('\n');
    // The object name always travels as `adtcore:name` — including for classes
    // and interfaces. Older plugin versions emitted `class:name`/`intf:name`,
    // which strict backends reject with HTTP 400: "expected attribute
    // {http://www.sap.com/adt/core}name" (ExceptionInvalidData).
    return `<?xml version="1.0" encoding="UTF-8"?>
<${tag} xmlns:${ns}="http://www.sap.com/adt/${ns === 'class' ? 'oo/classes' : ns === 'intf' ? 'oo/interfaces' : ns === 'prog' ? 'programs/programs' : ns === 'fugr' ? 'functions/groups' : ns === 'ddls' ? 'ddl' : ns}" xmlns:adtcore="http://www.sap.com/adt/core"
       adtcore:description="${escapeXml(request.description)}" adtcore:language="EN" adtcore:name="${escapeXml(request.name)}"
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
/** Split an XML tag's attribute string into local-name → value (prefix-agnostic). */
function parseAttrs(attrs) {
    const out = {};
    for (const match of attrs.matchAll(/([\w-]+(?::[\w-]+)?)="([^"]*)"/g)) {
        const local = match[1].split(':').pop();
        out[local] = match[2];
    }
    return out;
}
/** Text content of the first element with the given local name (any namespace prefix). */
function localText(xml, local) {
    const re = new RegExp(`<(?:[\\w-]+:)?${local}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${local}>`);
    return re.exec(xml)?.[1];
}
/** Attribute map of every element with the given local name (any namespace prefix). */
function localAttrs(xml, local) {
    const re = new RegExp(`<(?:[\\w-]+:)?${local}\\b([^>]*)>`, 'g');
    const out = [];
    for (const match of xml.matchAll(re))
        out.push(parseAttrs(match[1] ?? ''));
    return out;
}
/** Tolerant where-used parser (usagereferences: namespace; attributes style). */
function parseWhereUsed(xml, objectUri) {
    const refs = localAttrs(xml, 'reference')
        .filter((a) => a.name)
        .map((a) => ({
        name: a.name,
        type: a.type ?? '',
        uri: a.uri ?? '',
        packageName: a.packageName || undefined,
        responsible: a.responsible || undefined,
        usageInformation: a.usageInformation || undefined,
    }));
    const declared = Number(localText(xml, 'totalReferences') ?? Number.NaN);
    return {
        objectUri,
        totalReferences: Number.isFinite(declared) ? declared : refs.length,
        references: refs,
    };
}
/** Data-preview parser: column-major `dataPreview:` XML → row-major records. */
function parseDataPreview(xml, name) {
    const totalRows = Number(localText(xml, 'totalRows') ?? 0) || 0;
    const queryExecutionTime = Number(localText(xml, 'queryExecutionTime') ?? Number.NaN);
    const columns = localAttrs(xml, 'metadata')
        .filter((a) => a.name)
        .map((a) => ({
        name: a.name,
        type: a.type ?? 'UNKNOWN',
        description: a.description || undefined,
        length: a.length !== undefined ? Number(a.length) || undefined : undefined,
    }));
    const sections = [...xml.matchAll(/<(?:[\w-]+:)?columns\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?columns>/g)];
    const byColumn = sections.map((s) => [...s[1].matchAll(/<(?:[\w-]+:)?data\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?data>/g)].map((d) => d[1].replace(/<[^>]+>/g, '').trim()));
    const rows = [];
    const maxRow = byColumn.reduce((max, col) => Math.max(max, col.length), 0);
    for (let r = 0; r < maxRow; r++) {
        const row = {};
        columns.forEach((c, i) => {
            row[c.name] = byColumn[i]?.[r] ?? null;
        });
        rows.push(row);
    }
    const parsed = {
        name,
        totalRows,
        queryExecutionTime: Number.isFinite(queryExecutionTime) ? queryExecutionTime : undefined,
        columns,
        rows,
    };
    if (columns.length === 0 && xml.trim().length > 0) {
        parsed.rawXml = xml.slice(0, 2000);
    }
    return parsed;
}
/** Lock-state parser: looks for lockedBy / lockOwner / lockIndicator on the object reference. */
function parseLockInfo(xml) {
    const attrs = localAttrs(xml, 'objectReference')[0] ?? parseAttrs(xml);
    const lockedBy = attrs.lockedBy || attrs.lockOwner || undefined;
    const indicator = attrs.lockIndicator ?? attrs.locked;
    let locked;
    if (indicator !== undefined) {
        const value = String(indicator).toLowerCase();
        locked = value === 'true' || value === '1' || value === 'x' || value === 'locked';
    }
    else if (lockedBy !== undefined) {
        locked = true;
    }
    return { locked, lockedBy, transport: attrs.corrnr || attrs.transport || undefined };
}
/** Depth-first search for the text of the first element with the given local name. */
function findTextDeep(root, name) {
    if (root.name === name || root.name.endsWith(`:${name}`)) {
        return root.text || undefined;
    }
    for (const child of root.children) {
        const value = findTextDeep(child, name);
        if (value)
            return value;
    }
    return undefined;
}
/**
 * Concatenated text of an element INCLUDING its descendants. ADT message
 * payloads nest the actual text, e.g.
 * `<chkl:shortText><chkl:txt>…</chkl:txt></chkl:shortText>`, where the outer
 * element has no direct character data — `childText()` alone yields ''.
 */
function deepText(node) {
    const parts = [];
    const walk = (n) => {
        if (n.text)
            parts.push(n.text);
        for (const child of n.children)
            walk(child);
    };
    walk(node);
    return parts.join('').trim();
}
function parseLockHandle(xml) {
    try {
        const root = parseXml(xml);
        // ABAP backends commonly nest the handle under <asx:abap><asx:values>
        // <LOCK_HANDLE>…</LOCK_HANDLE>, so search the whole tree (not only direct
        // children) and also accept an attribute on the root element.
        const nested = findTextDeep(root, 'LOCK_HANDLE') ?? findTextDeep(root, 'lockHandle');
        if (nested)
            return nested;
        const attr = root.attributes['lockHandle'] ?? root.attributes['LOCK_HANDLE'];
        return attr ?? undefined;
    }
    catch {
        return undefined;
    }
}
function parseLockTransport(xml) {
    try {
        const root = parseXml(xml);
        const nested = findTextDeep(root, 'CORRNR') ?? findTextDeep(root, 'corrNr');
        if (nested)
            return nested;
        const attr = root.attributes['corrNr'] ?? root.attributes['CORRNR'];
        return attr ?? undefined;
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
                text: deepText(child(msg, 'shortText') ?? child(msg, 'text') ?? msg) || '',
                id: attr(msg, 'id'),
                code: attr(msg, 'code'),
                longText: deepText(child(msg, 'longText') ?? msg) || undefined,
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
                text: deepText(child(el, 'shortText') ?? child(el, 'text') ?? el) || '',
                id: attr(el, 'id'),
                code: attr(el, 'code'),
                longText: deepText(child(el, 'longText') ?? el) || undefined,
            });
        }
        for (const el of children(node, 'message')) {
            out.push({
                severity: severityOf(attr(el, 'type')),
                text: deepText(child(el, 'shortText') ?? child(el, 'text') ?? el) || '',
                id: attr(el, 'id'),
                code: attr(el, 'code'),
                longText: deepText(child(el, 'longText') ?? el) || undefined,
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
        // Real backends use `status` ("Running"/"Completed"); tolerate `state`.
        const status = (attr(root, 'status') ?? attr(root, 'state') ?? childText(root, 'status') ?? '').toLowerCase();
        if (status) {
            if (status.includes('completed') || status.includes('finished') || status.includes('done'))
                return true;
            if (status.includes('running') || status.includes('in process'))
                return false;
        }
        const phases = children(root, 'phase');
        if (phases.length) {
            return phases.every((p) => {
                const s = (attr(p, 'status') ?? attr(p, 'state') ?? '').toLowerCase();
                return s === 'completed' || s === 'done' || s === 'finished';
            });
        }
        return false;
    }
    catch {
        return false;
    }
}
// --- Unit result (JUnit XML) ------------------------------------------------
/** All descendant elements with the given local name, in document order. */
function descendantsByName(root, name) {
    const out = [];
    const walk = (el) => {
        for (const c of el.children) {
            if (c.name === name)
                out.push(c);
            walk(c);
        }
    };
    walk(root);
    return out;
}
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
    else if (root.name === 'runResult') {
        // Legacy synchronous result (aunit:runResult, ns http://www.sap.com/adt/aunit,
        // BASIS < 7.5x): programs → testClasses → testMethods. A method's verdict
        // is carried by nested aunit:alert elements (kind/severity/title/text) —
        // no alerts means the method passed. Element/attribute names mirror the
        // official ADT client's AbapUnitResponseXmlDeserializer.
        for (const classEl of descendantsByName(root, 'testClass')) {
            const className = attr(classEl, 'name') ?? '';
            const tests = [];
            const methods = descendantsByName(classEl, 'testMethod');
            const methodAlerts = new Set();
            for (const m of methods) {
                for (const a of descendantsByName(m, 'alert'))
                    methodAlerts.add(a);
                const alerts = descendantsByName(m, 'alert');
                const failed = alerts.some((a) => {
                    const s = (attr(a, 'severity') ?? attr(a, 'kind') ?? '').toLowerCase();
                    return s === 'fatal' || s === 'critical' || s === 'error';
                });
                const first = alerts[0];
                const title = first ? attr(first, 'title') ?? '' : '';
                const body = first ? (first.text || attr(first, 'text') || '') : '';
                const message = [title, body].filter(Boolean).join(': ') || undefined;
                const durationRaw = attr(m, 'duration') ?? attr(m, 'executionTime');
                const unitAttr = (attr(m, 'unit') ?? '').toLowerCase();
                const durationNum = durationRaw ? Number(durationRaw) || 0 : 0;
                const durationMs = unitAttr.startsWith('sec') ? Math.round(durationNum * 1000) : Math.round(durationNum);
                tests.push({
                    className,
                    methodName: attr(m, 'name') ?? '',
                    status: failed ? 'FAILED' : 'PASSED',
                    durationMs,
                    message,
                });
            }
            // Alerts directly on the test class (e.g. syntax errors in the test
            // include) surface as an ERROR entry when no method could run.
            const classAlerts = descendantsByName(classEl, 'alert').filter((a) => !methodAlerts.has(a));
            if (classAlerts.length > 0 && methods.length === 0) {
                const first = classAlerts[0];
                const title = attr(first, 'title') ?? '';
                const body = first.text || attr(first, 'text') || '';
                tests.push({
                    className,
                    methodName: '(class alert)',
                    status: 'ERROR',
                    durationMs: 0,
                    message: [title, body].filter(Boolean).join(': ') || undefined,
                });
            }
            for (const t of tests) {
                total++;
                if (t.status === 'PASSED')
                    passed++;
                else if (t.status === 'SKIPPED' || t.status === 'DISABLED')
                    skipped++;
                else if (t.status === 'ERROR')
                    errors++;
                else
                    failed++;
            }
            classes.push({
                className,
                status: tests.some((t) => t.status === 'ERROR') ? 'ERROR' : tests.some((t) => t.status === 'FAILED') ? 'FAILED' : 'PASSED',
                tests,
            });
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
/**
 * Parse the ATC results collection (`atcresult:resultList`). Real backends use
 * child elements (`<atcresult:result><atcresult:displayId>...`) rather than
 * attributes; both shapes are tolerated, plus Atom feed fallback.
 */
function parseAtcResultList(xml) {
    const root = parseXml(xml);
    const runs = [];
    const emptyAggregates = () => ({ priority1: 0, priority2: 0, priority3: 0, priority4: 0, failures: 0 });
    for (const el of children(root, 'result')) {
        const displayId = childText(el, 'displayId') ?? attr(el, 'displayId') ?? attr(el, 'id');
        if (!displayId)
            continue;
        const agg = child(el, 'aggregates');
        const num = (key) => {
            const raw = agg ? childText(agg, key) : undefined;
            const n = raw !== undefined && raw !== '' ? Number(raw) : NaN;
            return Number.isFinite(n) ? n : 0;
        };
        const attributes = {};
        for (const [key, value] of Object.entries(el.attributes))
            attributes[key.replace(/^[^:]*:/, '')] = value;
        runs.push({
            displayId,
            title: childText(el, 'title') ?? undefined,
            checkVariant: childText(el, 'checkVariant') ?? undefined,
            createdAt: childText(el, 'createdAt') ?? attr(el, 'createdAt') ?? undefined,
            createdBy: childText(el, 'createdBy') ?? attr(el, 'createdBy') ?? attr(el, 'user'),
            status: childText(el, 'status') ?? attr(el, 'status') ?? attr(el, 'state'),
            kind: child(el, 'centralResult') ? 'central' : undefined,
            aggregates: agg
                ? {
                    priority1: num('numPrio1'),
                    priority2: num('numPrio2'),
                    priority3: num('numPrio3'),
                    priority4: num('numPrio4'),
                    failures: num('numFailure'),
                }
                : undefined,
            attributes,
        });
    }
    // Attribute-shaped entries (older mocks / minimal backends).
    for (const el of children(root, 'result')) {
        if (runs.some((r) => r.displayId === (attr(el, 'displayId') ?? attr(el, 'id'))))
            continue;
        const displayId = attr(el, 'displayId') ?? attr(el, 'id');
        if (!displayId)
            continue;
        runs.push({
            displayId,
            createdBy: attr(el, 'createdBy') ?? attr(el, 'user'),
            createdAt: attr(el, 'createdAt'),
            status: attr(el, 'status') ?? attr(el, 'state'),
            kind: attr(el, 'centralResult') ? 'central' : undefined,
            aggregates: undefined,
            attributes: {},
        });
    }
    // Atom feed entries carry the id in a child <id>/<link>.
    for (const entry of children(root, 'entry')) {
        const id = childText(entry, 'id');
        const link = children(entry, 'link').map((l) => attr(l, 'href') ?? '').find((h) => h.includes('/atc/results/'));
        const displayId = id ?? (link ? link.split('/').pop() : undefined);
        if (!displayId)
            continue;
        if (runs.some((r) => r.displayId === displayId.split('/').pop()))
            continue;
        runs.push({
            displayId: displayId.split('/').pop() ?? displayId,
            createdBy: childText(entry, 'author') ?? undefined,
            createdAt: childText(entry, 'updated') ?? undefined,
            status: attr(entry, 'status') ?? undefined,
            aggregates: undefined,
            attributes: {},
        });
    }
    return runs;
}
/** Map an ATC finding priority (1-4) to a severity. */
function severityFromPriority(priority) {
    switch (priority) {
        case 1:
            return 'CRITICAL';
        case 2:
            return 'ERROR';
        case 3:
            return 'WARNING';
        default:
            return 'INFO';
    }
}
function parseAggregatesNode(node) {
    if (!node)
        return undefined;
    const num = (key) => {
        const raw = childText(node, key);
        const n = raw !== undefined && raw !== '' ? Number(raw) : NaN;
        return Number.isFinite(n) ? n : 0;
    };
    return {
        priority1: num('numPrio1'),
        priority2: num('numPrio2'),
        priority3: num('numPrio3'),
        priority4: num('numPrio4'),
        failures: num('numFailure'),
    };
}
/**
 * Parse one ATC result body. Real on-prem backends return the
 * `atcresult:resultList` envelope with `atcfinding:finding` elements; older
 * mocks/BTP use checkstyle XML. Unknown formats preserve the raw body.
 */
function parseAtcResultBody(xml, displayId) {
    const emptyResult = () => ({
        success: true,
        clean: true,
        findings: [],
        counts: { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0, CATASTROPHIC: 0 },
        durationMs: 0,
        displayId,
        rawXml: xml,
    });
    const trimmed = xml.trimStart();
    if (!trimmed.startsWith('<'))
        return emptyResult();
    let root;
    try {
        root = parseXml(xml);
    }
    catch {
        return emptyResult();
    }
    if (root.name === 'checkstyle')
        return { ...parseAtcResult(xml), displayId };
    // atcresult envelope: resultList → result → objects → object → findings → finding
    const result = child(root, 'result') ?? root;
    if (result.name === 'resultList' || child(root, 'result') || child(result, 'displayId') || child(result, 'objects')) {
        const findings = [];
        const counts = {
            INFO: 0,
            WARNING: 0,
            ERROR: 0,
            CRITICAL: 0,
            CATASTROPHIC: 0,
        };
        const objectsNode = child(result, 'objects');
        for (const obj of children(objectsNode ?? result, 'object')) {
            const objectName = attr(obj, 'name') ?? '';
            const findingsNode = child(obj, 'findings');
            for (const finding of children(findingsNode ?? obj, 'finding')) {
                const priority = Number(attr(finding, 'priority') ?? 0);
                const severity = Number.isFinite(priority) ? severityFromPriority(priority) : 'INFO';
                const location = attr(finding, 'location') ?? '';
                const locMatch = /#start=(\d+)(?:,(\d+))?/.exec(location);
                counts[severity] = (counts[severity] ?? 0) + 1;
                findings.push({
                    check: attr(finding, 'checkId') ?? '',
                    checkTitle: attr(finding, 'checkTitle') ?? '',
                    severity,
                    message: attr(finding, 'messageTitle') ?? attr(finding, 'messageId') ?? '',
                    objectName,
                    uri: attr(finding, 'uri') ?? '',
                    line: locMatch ? Number(locMatch[1]) : undefined,
                    offset: locMatch && locMatch[2] ? Number(locMatch[2]) : undefined,
                    messageId: attr(finding, 'messageId'),
                    longText: childText(finding, 'longText') ?? undefined,
                });
            }
        }
        const clean = counts.ERROR + counts.CRITICAL + counts.CATASTROPHIC === 0;
        const aggregates = parseAggregatesNode(child(result, 'aggregates'));
        return {
            success: true,
            clean,
            findings,
            counts,
            durationMs: 0,
            displayId: displayId ?? childText(result, 'displayId') ?? undefined,
            title: childText(result, 'title') ?? undefined,
            checkVariant: childText(result, 'checkVariant') ?? undefined,
            aggregates,
        };
    }
    return emptyResult();
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
/** Object URI by convention for a freshly created object (fallback when the
 * backend returns no Location header / body, e.g. minimal ADT profiles). */
function uriForCreated(type, name) {
    const cat = type.split('/')[0];
    const map = {
        CLAS: '/sap/bc/adt/oo/classes/',
        INTF: '/sap/bc/adt/oo/interfaces/',
        PROG: '/sap/bc/adt/programs/programs/',
        FUNC: '/sap/bc/adt/fugr/',
        DDLS: '/sap/bc/adt/ddls/sources/',
        TABL: '/sap/bc/adt/ddic/tables/',
        STRU: '/sap/bc/adt/ddic/structures/',
        DOMA: '/sap/bc/adt/ddic/domains/',
        DTEL: '/sap/bc/adt/ddic/dataelements/',
        TTYP: '/sap/bc/adt/ddic/tabletypes/',
        MSAG: '/sap/bc/adt/msgclass/',
        DEVC: '/sap/bc/adt/packages/',
    };
    return `${map[cat] ?? '/sap/bc/adt/repository/objects/'}${name.toLowerCase()}`;
}
// --- Transports -------------------------------------------------------------
/**
 * Depth-first collection of transport request elements (local name `request`
 * or `transport`) anywhere in a Transport Organizer Tree. Task elements
 * (`task`, or `request` elements with type `T`) are skipped — only actual
 * requests are reported.
 */
function collectTransportRequests(root) {
    const found = [];
    const visit = (node) => {
        for (const child of node.children) {
            if ((child.name === 'request' || child.name.endsWith(':request')) &&
                attr(child, 'type') !== 'T' &&
                child.name !== 'task' &&
                !child.name.endsWith(':task')) {
                found.push(child);
            }
            visit(child);
        }
    };
    visit(root);
    return found;
}
/** `true` when the node itself is a transport request element. */
function isRequestElement(node) {
    return (node.name === 'request' ||
        node.name.endsWith(':request') ||
        node.name === 'transport' ||
        node.name.endsWith(':transport'));
}
/** Depth-first search for the first request/transport element anywhere. */
function findRequestElement(root) {
    if (isRequestElement(root))
        return root;
    for (const child of root.children) {
        const found = findRequestElement(child);
        if (found)
            return found;
    }
    return undefined;
}
/**
 * Collect the `abap_object` entries that belong to a request element. Real
 * single-request responses nest them under `<tm:all_objects>` while the tree
 * format lists them directly; task blocks repeat their parent request's
 * objects and are skipped to avoid duplicates.
 */
function collectAbapObjects(requestEl) {
    const found = [];
    const visit = (node) => {
        for (const child of node.children) {
            if (child.name === 'task' || child.name.endsWith(':task'))
                continue;
            if (child.name === 'abap_object' || child.name.endsWith(':abap_object'))
                found.push(child);
            visit(child);
        }
    };
    visit(requestEl);
    return found;
}
/** `true` when the request status means "already released" (not open/modifiable). */
function isReleasedStatus(status) {
    return status === 'R' || status === 'L' || /^released$/i.test(status);
}
/** Atom link relation marking the transport request a version was saved into. */
const TRANSPORT_REQUEST_REL = 'http://www.sap.com/adt/relations/transport/request';
function parseTransport(el) {
    const number = attr(el, 'number') ?? attr(el, 'request') ?? attr(el, 'requestId') ?? '';
    const status = attr(el, 'status') ?? attr(el, 'state') ?? '';
    const items = [];
    for (const item of [...children(el, 'item'), ...children(el, 'object'), ...collectAbapObjects(el)]) {
        items.push({
            uri: attr(item, 'uri') ?? '',
            type: attr(item, 'type') ?? '',
            name: attr(item, 'name') ?? '',
            description: attr(item, 'description') ?? attr(item, 'desc') ?? attr(item, 'obj_desc') ?? '',
            action: attr(item, 'action') ?? '',
        });
    }
    return {
        number,
        description: attr(el, 'description') ?? attr(el, 'desc') ?? '',
        status,
        category: attr(el, 'category') ?? attr(el, 'type') ?? '',
        owner: attr(el, 'owner') ?? attr(el, 'user') ?? '',
        system: attr(el, 'system') ?? '',
        client: attr(el, 'client') ?? '',
        createdAt: attr(el, 'createdAt') ?? attr(el, 'lastchanged_timestamp'),
        target: attr(el, 'target'),
        modifiable: !isReleasedStatus(status),
        items,
    };
}
// --- Runtime dumps (Atom feed) ----------------------------------------------
/** Derive the dump id from a feed entry (link href preferred, `<id>` fallback). */
function dumpIdFromEntry(entry) {
    for (const link of children(entry, 'link')) {
        const href = attr(link, 'href') ?? '';
        const match = /\/runtime\/dump\/([^/?]+)/.exec(href);
        if (match)
            return decodeURIComponent(match[1]);
    }
    const idText = childText(entry, 'id') ?? '';
    if (idText) {
        // Plain ids only — urn:/tag: forms carry no usable dump key.
        return /^[\w.-]+$/.test(idText) ? idText : undefined;
    }
    return undefined;
}
/** Parse the runtime-dumps Atom feed into summaries. */
function parseDumpsFeed(xml) {
    let root;
    try {
        root = parseXml(xml);
    }
    catch {
        return [];
    }
    const dumps = [];
    for (const entry of children(root, 'entry')) {
        const id = dumpIdFromEntry(entry);
        if (!id)
            continue;
        const category = children(entry, 'category').map((c) => attr(c, 'term') ?? c.text).find(Boolean);
        dumps.push({
            id,
            title: childText(entry, 'title') ?? '',
            category: category || undefined,
            user: childText(child(entry, 'author') ?? entry, 'name') || undefined,
            updatedAt: childText(entry, 'updated') || undefined,
            host: undefined,
        });
    }
    return dumps;
}
/** Tolerant structured-XML dump parser: every text-bearing child becomes a section. */
function parseDumpDetail(xml, id) {
    const sections = [];
    let title;
    try {
        const root = parseXml(xml);
        title = attr(root, 'type') ?? attr(root, 'name') ?? childText(root, 'name') ?? childText(root, 'title');
        const walk = (node) => {
            for (const c of node.children) {
                if (c.children.length === 0 && c.text) {
                    sections.push({ name: c.name, value: c.text });
                }
                else if (c.children.length > 0) {
                    // Composite nodes contribute a flattened key/value view.
                    for (const gc of c.children) {
                        if (gc.text)
                            sections.push({ name: `${c.name}.${gc.name}`, value: gc.text });
                    }
                    walk(c);
                }
            }
        };
        walk(root);
    }
    catch {
        // Non-XML body → keep raw.
        return { id, sections: [], raw: xml, view: 'default' };
    }
    return { id, title, sections, view: 'default' };
}
// --- $batch response parts ---------------------------------------------------
/** Parse a multipart `$batch` response body into embedded HTTP responses. */
function parseBatchResponseParts(body, boundary) {
    const parts = body
        .split(`--${boundary}`)
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && !p.startsWith('--'));
    const out = [];
    for (const raw of parts) {
        // Skip the MIME envelope headers; the embedded response starts at HTTP/.
        const httpStart = raw.search(/HTTP\/1\.[01]/);
        if (httpStart < 0) {
            out.push({ index: out.length, status: 0, statusText: 'Unparseable', headers: {}, body: raw });
            continue;
        }
        const http = raw.slice(httpStart);
        const split = http.indexOf('\r\n\r\n');
        const headerSection = split < 0 ? http : http.slice(0, split);
        const responseBody = split < 0 ? '' : http.slice(split + 4);
        const lines = headerSection.split('\r\n');
        const statusMatch = /^HTTP\/1\.[01]\s+(\d+)\s*(.*)$/.exec(lines[0] ?? '');
        const headers = {};
        for (let i = 1; i < lines.length; i++) {
            const colon = lines[i].indexOf(':');
            if (colon > 0)
                headers[lines[i].slice(0, colon).trim().toLowerCase()] = lines[i].slice(colon + 1).trim();
        }
        out.push({
            index: out.length,
            status: statusMatch ? Number(statusMatch[1]) : 0,
            statusText: statusMatch?.[2]?.trim() ?? '',
            headers,
            body: responseBody.trim(),
            contentType: headers['content-type'],
        });
    }
    return out;
}
//# sourceMappingURL=client.js.map