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
    // Known severities pass through unchanged; anything else degrades to 'I'.
    return text === 'E' || text === 'W' || text === 'S' || text === 'A' ? text : 'I';
}
/** Parse an ADT message list from `<...:message>` / `<exc:exception>` elements. */
export function parseAdtMessages(root) {
    const messages = [];
    for (const el of children(root, 'message')) {
        messages.push({
            severity: severityOf(attr(el, 'type') ?? attr(el, 'severity')),
            // Real ADT error bodies put the human-readable text directly INSIDE the
            // <message> element (e.g. EU510 "user … is currently editing …" — the
            // whole reason a 403 is actionable at all). Older code only looked for
            // child <text>/<shortText> elements, so those messages surfaced as an
            // empty "E: " — losing the diagnosis.
            text: childText(el, 'text') ?? childText(el, 'shortText') ?? attr(el, 'shortText') ?? el.text ?? '',
            id: attr(el, 'id'),
            code: attr(el, 'code'),
            longText: childText(el, 'longText'),
            line: numAttr(el, 'line'),
            offset: numAttr(el, 'offset'),
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
/** Parse XML tolerantly: `undefined` instead of a throw on malformed input. */
function tryParseXml(xml) {
    try {
        return parseXml(xml);
    }
    catch {
        return undefined;
    }
}
/** Numeric attribute: truthy string → Number (NaN passes through), else undefined. */
function numAttr(node, key) {
    const v = attr(node, key);
    return v ? Number(v) : undefined;
}
/** Extract ADT messages from an error response body (best effort). */
function parseErrorBody(body) {
    const root = tryParseXml(body);
    return root ? parseAdtMessages(root) : [];
}
/**
 * Lazy singleton undici Agent with TLS verification disabled, used for
 * destinations with `strictSSL: false` (self-signed / private-CA SAP
 * front-ends). Dynamically imports the npm `undici` dependency (declared in
 * package.json) only when such a destination is first used; the default
 * (strictSSL) path stays dependency-free at runtime. On import failure the
 * promise resolves to `null` — equivalent to no dispatcher being attached.
 */
let insecureTlsPromise;
function getInsecureTlsDispatcher() {
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
    // The ADT base is `/sap/bc/adt` followed by a SEGMENT boundary — a bare
    // startsWith accepted foreign paths like `/sap/bc/adtillery` (audit P3).
    const base = '/sap/bc/adt';
    if (uri === base || uri.startsWith(`${base}/`))
        return uri;
    return `${base}${uri.startsWith('/') ? '' : '/'}${uri}`;
}
/**
 * An object's BASE URI: the content-subresource suffix `/source/main` is
 * stripped when present. Agents frequently copy SOURCE-form URIs from
 * read/search outputs (`…/programs/programs/zfoo/source/main`); object-level
 * endpoints (versions, lock, metadata, deletion, transport relations) answer
 * 404 on the suffixed form, so every object-level method normalizes through
 * here first.
 */
function objectBaseUri(objectUri) {
    const uri = normalizeUri(objectUri);
    return uri.endsWith('/source/main') ? uri.slice(0, -'/source/main'.length) : uri;
}
/**
 * Swap the message-class URI prefix to its alternate spelling: modern
 * profiles serve `/messageclass/`, older ones (and the bundled mock) only
 * `/msgclass/`. readStructure/writeStructure retry with this on 404.
 */
function msagAltUri(uri) {
    return uri.includes('/messageclass/') ? uri.replace('/messageclass/', '/msgclass/') : uri.replace('/msgclass/', '/messageclass/');
}
/** Is this 404 the message-class spelling duality that msagAltUri can retry? */
function msagNotFound(error, kind, uri) {
    return (error instanceof AdtError &&
        error.status === 404 &&
        kind === 'MSAG' &&
        /\/(messageclass|msgclass)\//.test(uri));
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
        // Fail fast on destinations that could never work (audit P3): a
        // non-http(s) URL used to surface much later as an obscure fetch error
        // (or, for absolute request paths, as an origin-check failure).
        try {
            const parsed = new URL(destination.url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                throw new Error(`protocol ${parsed.protocol}`);
            }
        }
        catch (error) {
            throw new AdtError(`ADT destination '${destination.name}': url '${destination.url}' is not a valid http(s) URL ` +
                `(${error.message})`);
        }
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
    /**
     * Absolute request URLs are tolerated ONLY when they are same-origin with
     * the destination: every request carries `Authorization` and the session
     * cookie, and backend-influenced URLs (version content URIs, search hits)
     * must never forward those credentials to a third-party host (audit M1).
     * fetch already strips credentials on cross-origin redirects; this closes
     * the initial-URL gap.
     */
    buildUrl(path) {
        if (/^https?:\/\//i.test(path)) {
            let target;
            let base;
            try {
                target = new URL(path);
            }
            catch {
                throw new AdtError(`ADT: invalid absolute request URL '${path}'`);
            }
            try {
                base = new URL(this.base);
            }
            catch {
                throw new AdtError(`ADT: cannot verify absolute URL '${path}' — destination url '${this.base}' is not a valid http(s) URL`);
            }
            if (target.origin !== base.origin) {
                throw new AdtError(`ADT: refusing to send credentials to ${target.origin} — destination '${this.destination.name}' is ` +
                    `${base.origin}. Cross-origin request URLs are rejected (credentials must never leave the destination host).`);
            }
            return path;
        }
        return `${this.base}${path}`;
    }
    cookieHeader() {
        const now = Date.now();
        const parts = [];
        for (const [key, entry] of this.cookies) {
            if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
                this.cookies.delete(key); // honor expiry instead of replaying stale cookies (audit P3)
                continue;
            }
            parts.push(`${key}=${entry.value}`);
        }
        return parts.join('; ');
    }
    storeCookies(headers) {
        const setCookie = headers.getSetCookie?.() ?? [];
        for (const raw of setCookie) {
            const segments = raw.split(';');
            const [pair] = segments;
            if (!pair)
                continue;
            const eq = pair.indexOf('=');
            if (eq <= 0)
                continue;
            const key = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();
            // Expires / Max-Age attributes (audit P3): previously ignored, so a
            // server-side session timeout kept replaying dead cookies.
            let expiresAt;
            for (const attr of segments.slice(1)) {
                const eq2 = attr.indexOf('=');
                const attrKey = (eq2 < 0 ? attr : attr.slice(0, eq2)).trim().toLowerCase();
                const attrValue = eq2 < 0 ? '' : attr.slice(eq2 + 1).trim();
                if (attrKey === 'max-age') {
                    const seconds = Number(attrValue);
                    if (Number.isFinite(seconds))
                        expiresAt = seconds <= 0 ? 0 : Date.now() + seconds * 1000;
                }
                else if (attrKey === 'expires') {
                    const at = Date.parse(attrValue);
                    if (!Number.isNaN(at))
                        expiresAt = at;
                }
            }
            if (expiresAt !== undefined && expiresAt <= Date.now()) {
                this.cookies.delete(key);
                continue;
            }
            // Never let the server force a different client into the context cookie.
            if (key === 'sap-usercontext' && this.destination.client) {
                this.cookies.set(key, { value: `sap-client=${this.destination.client}`, expiresAt });
            }
            else {
                this.cookies.set(key, { value, expiresAt });
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
            const timerMs = timeoutMs ?? this.destination.timeoutMs ?? 60_000;
            const timer = setTimeout(() => controller.abort(), timerMs);
            // Link the caller's cooperative-cancellation signal: whichever fires
            // first (timeout or abort) cancels the fetch. The listener is removed
            // EXPLICITLY once the request settles — on the success path the
            // caller's long-lived session signal never aborts, so neither `once`
            // nor the `signal` listener option would ever fire and the listener
            // (plus its closure) would accumulate on every request (audit H3).
            let unlinkCallerSignal;
            if (signal) {
                if (signal.aborted)
                    controller.abort(signal.reason);
                else {
                    const onCallerAbort = () => controller.abort(signal.reason);
                    signal.addEventListener('abort', onCallerAbort, { once: true });
                    unlinkCallerSignal = () => signal.removeEventListener('abort', onCallerAbort);
                }
            }
            // The timer and the caller-signal link stay armed until the response
            // BODY has been consumed (audit M8): previously they were torn down
            // right after the headers arrived, letting a slow body hang for
            // undici's default 300 s bodyTimeout regardless of `timeoutMs`.
            const cleanup = () => {
                clearTimeout(timer);
                unlinkCallerSignal?.();
                unlinkCallerSignal = undefined;
            };
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
                cleanup();
                if (controller.signal.aborted && signal?.aborted) {
                    throw new AdtError(`ADT ${method} ${path} aborted: ${cause.message ?? cause}`);
                }
                if (controller.signal.aborted) {
                    throw new AdtError(`ADT ${method} ${path} timed out after ${timerMs} ms`);
                }
                throw new AdtError(`ADT request failed: ${cause.message}`);
            }
            this.storeCookies(response.headers);
            if (!raw && !response.ok) {
                // Error bodies are read inside the same window too, but a read
                // failure degrades to an empty error body (as before) — the HTTP
                // status is the more useful signal.
                let text = '';
                try {
                    text = await response.text();
                }
                catch {
                    text = '';
                }
                cleanup();
                const messages = parseErrorBody(text);
                const detail = messages.map((m) => `${m.severity}: ${m.text}`).join(' | ');
                const csrfHint = (response.headers.get('x-csrf-token') ?? '').toLowerCase() === 'required';
                const csrfError = /csrf/i.test(text);
                const sessionLost = response.status === 401 && method !== 'GET';
                if ((csrfRequired(response.status, csrfHint, csrfError) || sessionLost) && attempt === 0) {
                    // Session/token was rejected; refresh and retry once. A failure of
                    // the refresh probe must NOT mask the original 401/403 (audit P3).
                    this.resetSession();
                    try {
                        csrf = await this.ensureCsrfToken(signal);
                    }
                    catch (refreshError) {
                        throw new AdtError(`ADT ${method} ${path} -> HTTP ${response.status} (session rejected; token refresh also failed: ` +
                            `${refreshError.message})`, response.status);
                    }
                    continue;
                }
                throw new AdtError(`ADT ${method} ${path} -> HTTP ${response.status}${detail ? `: ${detail}` : ''}`, response.status, messages, text);
            }
            // Success body — read inside the timeout window; a body that stalls
            // past `timerMs` (or a session abort) fails the whole request instead
            // of silently returning an empty source.
            let text;
            try {
                text = await response.text();
            }
            catch (cause) {
                if (controller.signal.aborted && signal?.aborted) {
                    throw new AdtError(`ADT ${method} ${path} aborted while reading the body: ${cause.message ?? cause}`);
                }
                if (controller.signal.aborted) {
                    throw new AdtError(`ADT ${method} ${path} timed out after ${timerMs} ms while reading the response body`);
                }
                throw new AdtError(`ADT ${method} ${path}: reading the response body failed: ${cause.message}`);
            }
            finally {
                cleanup();
            }
            return { status: response.status, headers: response.headers, text };
        }
        // Unreachable: every attempt returns or throws, and the only `continue`
        // (CSRF/session retry) is guarded by `attempt === 0` — kept purely so
        // the function's control flow type-checks.
        throw new Error('unreachable');
    }
    /** Fetch (and cache) the CSRF token via the standard discovery probe. */
    async ensureCsrfToken(signal) {
        if (this.csrfToken)
            return this.csrfToken;
        // The session and CSRF token must be bound to the destination client:
        // multi-client systems reject tokens issued against another client.
        const path = `${ENDPOINTS.discovery()}${toQuery(this.baseQuery())}`;
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
    /** Fetch the discovery document (AtomPub service doc; tolerant of simple XML).
     *
     * The destination's `sap-client`/`sap-language` ride along (audit P3):
     * multi-client systems answer discovery per client, and a client-less
     * probe could bind the session to the wrong client. */
    async discover(options = {}) {
        const res = await this.request({
            path: `${ENDPOINTS.discovery()}${toQuery(this.baseQuery())}`,
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
        let jsonRelease = '';
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
            jsonRelease = data.release ?? '';
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
        // Older on-prem backends expose the release under different feature keys
        // (or only in the systeminformation JSON) — probe all known spellings so
        // `release` is not left empty when the primary key is absent. `||` (not
        // `??`): an empty string from one source must not short-circuit the rest.
        const release = jsonRelease ||
            features['release'] ||
            features['SAP_SYSTEM_RELEASE'] ||
            features['SAP_BASIS_RELEASE'] ||
            features['SAP_SYSTEM_RELEASE_ID'] ||
            '';
        const abapCloud = Object.keys(features).some((k) => k.toLowerCase().includes('cloud'));
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
        // Options forwarded unchanged by both quickSearch retries below.
        const quickRetry = {
            maxResults: options.maxResults,
            objectType: options.objectType,
            packageName: options.packageName,
            operation: 'quickSearch',
            signal: options.signal,
        };
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
                const wildcard = await this.search(`${query}*`, quickRetry);
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
                const fallback = await this.search(query, quickRetry);
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
        for (let i = 0; i < attempts.length; i++) {
            const path = attempts[i];
            try {
                const res = await this.request({ path: withVersion(path), accept: 'text/plain', signal: options.signal });
                const parsed = parseSourceResponse(res.text, uri, res.headers.get('content-type') ?? '');
                // Bare-URI fallback hygiene (audit P3): an XML body WITHOUT a code
                // node is object METADATA, not a source — accepting it turned a
                // 404-on-/source/main into bogus success with an empty source. Only
                // the /source/main attempt may return whatever it returns.
                if (i > 0 &&
                    parsed.source.trim() === '' &&
                    !/<(?:[\w.-]+:)?code\b/.test(parsed.rawXml ?? '')) {
                    lastError = new AdtError(`ADT GET ${path} -> not a source representation (no code node, empty body)`, res.status);
                    continue;
                }
                return parsed;
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
        // Split off any query the caller's URI already carries (audit P3):
        // appending /source/main and then the parameter query used to produce
        // `…?a=b?lockHandle=…` for URIs that already had a `?`.
        const [bareUri, existingQuery = ''] = normalizeUri(objectUri).split('?');
        const path = bareUri.endsWith('/source/main') ? bareUri : `${bareUri}/source/main`;
        const query = this.baseQuery({
            ...Object.fromEntries(existingQuery
                .split('&')
                .filter(Boolean)
                .map((kv) => {
                const eq = kv.indexOf('=');
                return eq < 0 ? [kv, ''] : [kv.slice(0, eq), kv.slice(eq + 1)];
            })),
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
        const uri = objectBaseUri(objectUri);
        const query = this.baseQuery({ _action: 'LOCK', accessMode: 'MODIFY' });
        const res = await this.request({
            method: 'POST',
            path: `${uri}${toQuery(query)}`,
            accept: MEDIA.lockResult,
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
        const uri = objectBaseUri(objectUri);
        const query = this.baseQuery({ _action: 'UNLOCK', lockHandle: handle });
        await this.request({
            method: 'POST',
            path: `${uri}${toQuery(query)}`,
            accept: MEDIA.lockResult,
            stateful: true,
            signal: options.signal,
        });
    }
    /**
     * Unlock with the given handle; when that fails with anything but 403 (or
     * no handle is known), retry WITHOUT a handle — some backends release the
     * lock on a bare `_action=UNLOCK` (same user), which lets `unlock_all`
     * clean residual locks whose handle was never returned (e.g. create-time
     * auto locks). A 403 (lock held by another user) is final and reported
     * as-is: a handle-less unlock cannot succeed there either.
     */
    async unlockBestEffort(objectUri, handle, options = {}) {
        const uri = objectBaseUri(objectUri);
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
        const query = this.baseQuery();
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
            path: `${ENDPOINTS.unitTestRunsLegacy()}${toQuery(this.baseQuery())}`,
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
        const startedAt = Date.now();
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
        // The result body carries no runtime on most backends — report the
        // wall-clock time of the whole start→poll→fetch cycle instead of 0.
        return { ...parseAtcResultBody(results.text, displayId), durationMs: Date.now() - startedAt };
    }
    /**
     * List existing ATC runs (the results collection). Backends vary: many
     * require at least one filter (the logged-on user is sent as the default),
     * but subset implementations accept a PARAMETERLESS query only and reject
     * any filter with HTTP 400 — in that case the request is retried bare.
     */
    async listAtcRuns(options = {}) {
        const createdBy = options.createdBy
            ?? (this.destination.auth.type === 'basic' ? this.destination.auth.username : undefined);
        const params = this.baseQuery({
            ...(createdBy ? { createdBy } : {}),
            ...(options.ageMin !== undefined ? { ageMin: options.ageMin } : {}),
            ...(options.ageMax !== undefined ? { ageMax: options.ageMax } : {}),
            ...(options.central ? { centralResult: 'true' } : {}),
            ...(options.active ? { activeResult: 'true' } : {}),
            ...(options.sysId ? { sysId: options.sysId } : {}),
            ...(options.contactPerson ? { contactPerson: options.contactPerson } : {}),
        });
        let res;
        try {
            res = await this.request({
                path: `${ENDPOINTS.atcResults()}${toQuery(params)}`,
                accept: 'application/xml',
                signal: options.signal,
            });
        }
        catch (error) {
            // Subset ATC-results services reject every filter parameter (400) while
            // serving the parameterless collection fine. A caller-initiated abort
            // must not be retried.
            if (error instanceof AdtError && error.status === 400 && !options.signal?.aborted) {
                res = await this.request({
                    path: `${ENDPOINTS.atcResults()}${toQuery(this.baseQuery())}`,
                    accept: 'application/xml',
                    signal: options.signal,
                });
            }
            else {
                throw error;
            }
        }
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
        const backendStatus = options.status === 'modifiable'
            ? 'D'
            : options.status === 'released'
                ? 'R'
                : options.status && options.status !== 'all'
                    ? options.status
                    : undefined;
        const params = this.baseQuery({
            ...(options.allUsers ? { user: '*' } : {}),
            ...(options.category ? { type: options.category } : {}),
            ...(backendStatus ? { status: backendStatus } : {}),
        });
        let res;
        try {
            res = await this.request({
                path: `${ENDPOINTS.transportRequests()}${toQuery(params)}`,
                accept: MEDIA.transportOrganizerTree,
                signal: options.signal,
            });
        }
        catch (error) {
            // Backends without a server-side status parameter reject it outright
            // (HTTP 400) — retry unfiltered and rely on the client-side filter.
            // A caller-initiated abort must not be retried.
            if (error instanceof AdtError &&
                error.status === 400 &&
                backendStatus &&
                !options.signal?.aborted) {
                const unfiltered = this.baseQuery({
                    ...(options.allUsers ? { user: '*' } : {}),
                    ...(options.category ? { type: options.category } : {}),
                });
                res = await this.request({
                    path: `${ENDPOINTS.transportRequests()}${toQuery(unfiltered)}`,
                    accept: MEDIA.transportOrganizerTree,
                    signal: options.signal,
                });
            }
            else {
                throw error;
            }
        }
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
        // Object-level endpoint: tolerate source-form URIs (…/source/main) —
        // appending to them used to produce …/source/main/source/main/versions → 404.
        const uri = objectBaseUri(objectUri);
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
        const uri = objectBaseUri(objectUri);
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
            // collection; fall back to the freestyle SQL endpoint. The entity name
            // is INTERPOLATED into that statement, so only plain DDIC name
            // characters may enter (the primary route encodes the name; this one
            // could not — audit M3).
            if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
                if (!/^[A-Za-z0-9_/]+$/.test(name)) {
                    throw new AdtError(`ADT: refusing to build a SQL fallback for entity name '${name}' — unexpected characters ` +
                        '(only letters, digits, underscore and slash are allowed in DDIC entity names)');
                }
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
        const uri = objectBaseUri(objectUri);
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
                // A non-negotiation error (e.g. 401/403/500, or a network failure —
                // audit P3: non-AdtError used to be swallowed) is authoritative.
                return { locked: undefined, note: `could not read object metadata: ${error.message}` };
            }
        }
        // Metadata did not expose lock state → try the transports relationship
        // endpoints (some backends report LOCK_HANDLE/CORRNR there).
        const viaTransports = await this.lockStateViaTransports(uri, options.signal);
        if (viaTransports.locked !== undefined || viaTransports.lockedBy)
            return viaTransports;
        return {
            locked: undefined,
            note: 'backend does not expose lock state in object metadata — concurrent editors cannot be detected this way; ' +
                'after writing, confirm the change persisted (adt_edit_object/adt_write_object report a `persisted` flag ' +
                'from a post-write read-back)',
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
            catch (error) {
                // endpoint not supported → keep probing / degrade below; a caller
                // abort must still surface (audit P3).
                if (signal?.aborted)
                    throw error;
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
        // A 200 may still carry an error envelope in the body (audit P3): some
        // profiles answer exceptions with HTTP 200 — an E message means the
        // create did NOT happen.
        const envelopeMessages = parseErrorBody(res.text).filter((m) => m.severity === 'E' || m.severity === 'A');
        const created = (res.status === 201 || res.status === 200) && envelopeMessages.length === 0;
        return {
            success: created,
            uri: created ? uri : undefined,
            object: created && uri ? { uri, type: request.type, name, category } : undefined,
            // Some profiles answer the create with the transport the object was
            // recorded into (CORRNR in the response body) — surface it so callers
            // can policy-check backend auto-assignments (audit M7).
            transport: request.transport ?? parseCorrNr(res.text),
            messages: envelopeMessages.map((m) => ({
                severity: m.severity,
                text: m.text || `create answered HTTP ${res.status} with an error envelope`,
            })),
        };
    }
    /**
     * Delete an object. Prefers the modern deletion service
     * (`POST /sap/bc/adt/deletion/delete`, response media type
     * `deletion.response.v1+xml`) and falls back to the legacy
     * `_action=DELETE` action on the object URI when the service is absent.
     */
    async deleteObject(objectUri, options = {}) {
        const uri = objectBaseUri(objectUri);
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
        // The user value is INTERPOLATED into that expression, so only inert
        // username characters may enter (fail-closed, same shape as the SQL
        // entity-name whitelist, audit M3): `)` / `,` / quotes could alter the
        // predicate. The unquoted wire format is the field-verified one and is
        // provably safe once the charset is whitelisted.
        const user = options.user?.trim();
        if (user && !/^[A-Za-z0-9_.-]+$/.test(user)) {
            throw new AdtError(`ADT: refusing to build a dumps $query filter for user '${user}' — unexpected characters`);
        }
        const query = user ? `and( equals( user, ${user} ) )` : undefined;
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
    /** Shared console-run round trip of runProgram/runClass (stateful, 300s). */
    async runConsole(kind, rawName, endpoint, options) {
        const name = rawName.trim().toUpperCase();
        if (!name)
            throw new AdtError(`ADT: ${kind === 'PROG' ? 'program' : 'class'} name is required`);
        const res = await this.request({
            method: 'POST',
            path: `${endpoint(name)}${toQuery(this.baseQuery())}`,
            accept: 'text/plain, application/xml',
            stateful: true,
            timeoutMs: 300_000,
            signal: options.signal,
        });
        return { kind, name, output: res.text, status: res.status };
    }
    /**
     * Run an ABAP executable program (console output comes back as text).
     * Equivalent to F8 in ADT: the program runs synchronously in the session.
     */
    async runProgram(programName, options = {}) {
        return this.runConsole('PROG', programName, ENDPOINTS.programRun, options);
    }
    /**
     * Run a class that implements `if_oo_adt_classrun` — its `main( )` executes
     * and the `out->write( )` output comes back as text. The standard agent
     * pattern for "run logic and capture output without building a program".
     */
    async runClass(className, options = {}) {
        return this.runConsole('CLAS', className, ENDPOINTS.classRun, options);
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
            path: `${ENDPOINTS.batch()}${toQuery(this.baseQuery())}`,
            body,
            contentType: `multipart/mixed; boundary=${boundary}`,
            accept: 'multipart/mixed',
            stateful: true,
            timeoutMs: 120_000,
            signal: options.signal,
        });
        const contentTypeHeader = res.headers.get('content-type') ?? '';
        // Quoted boundary values (`boundary="batch_…"`) are legal — the old
        // pattern captured the quote character (audit P3).
        const boundaryMatch = /boundary="?([^";\s]+)"?/.exec(contentTypeHeader);
        return parseBatchResponseParts(res.text, boundaryMatch?.[1] ?? boundary);
    }
    // ---------------------------------------------------------------------------
    // Structured metadata (MSAG / DOMA / DTEL / TTYP)
    // ---------------------------------------------------------------------------
    /** Read the structured metadata of a DDIC object as typed JSON. */
    async readStructure(objectUri, kind, options = {}) {
        const uri = objectBaseUri(objectUri);
        const get = async (u) => {
            const res = await this.request({
                path: `${u}${toQuery(this.baseQuery())}`,
                accept: structureMediaType(kind),
                signal: options.signal,
            });
            return res.text;
        };
        let xml;
        try {
            xml = await get(uri);
        }
        catch (error) {
            // Message-class URI prefixes differ across releases: modern profiles
            // serve /sap/bc/adt/messageclass/<name>, older ones (and the bundled
            // mock) only /sap/bc/adt/msgclass/<name>. Retry the other spelling on
            // 404 instead of failing the read.
            if (msagNotFound(error, kind, uri)) {
                const alt = msagAltUri(uri);
                xml = await get(alt);
            }
            else {
                throw error;
            }
        }
        return parseStructure(xml, kind);
    }
    /**
     * Read-modify-write the structured metadata of a DDIC object: lock → GET
     * current XML → patch only the provided fields → PUT → unlock. The
     * optional `onLocked` hook runs right after the lock (with the backend
     * transport the lock assigned AND the lock handle) so callers can enforce
     * policy, register the lock in a ledger, or otherwise react BEFORE
     * anything is written — a throw rolls the lock back and propagates.
     */
    async writeStructure(objectUri, kind, changes, options = {}) {
        let uri = objectBaseUri(objectUri);
        // Same message-class prefix duality as readStructure: probe-locked on the
        // alternate spelling when the first LOCK misses the service (404).
        let lock;
        try {
            lock = await this.lock(uri, { signal: options.signal });
        }
        catch (error) {
            if (msagNotFound(error, kind, uri)) {
                uri = msagAltUri(uri);
                lock = await this.lock(uri, { signal: options.signal });
            }
            else {
                throw error;
            }
        }
        const { handle, transport: assigned } = lock;
        let outcome;
        let unlocked = false;
        try {
            if (options.onLocked)
                options.onLocked(options.transport ? undefined : assigned, handle);
            const current = await this.request({
                path: `${uri}${toQuery(this.baseQuery())}`,
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
            outcome = { success: true, data: parseStructure(effective.text, kind), transport: options.transport ?? assigned };
        }
        finally {
            // Cleanup deliberately runs WITHOUT the caller signal: an aborted write
            // must still release the backend lock it acquired.
            unlocked = await this.unlock(uri, handle).then(() => true, () => false);
        }
        return { ...outcome, unlocked };
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
            reject(new AdtError(`aborted: ${String(sig.reason?.message ?? sig.reason ?? 'aborted')}`));
            return;
        }
        const timer = setTimeout(() => {
            sig.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        function onAbort() {
            clearTimeout(timer);
            // Always reject with AdtError (audit P3): a raw caller-supplied reason
            // (e.g. a DOMException) used to escape and break the error contract.
            const reason = sig.reason;
            const detail = reason instanceof Error ? reason.message : String(reason ?? 'aborted');
            reject(new AdtError(`aborted: ${detail}`));
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
/** OSL flat object sets shared by the ABAP Unit and ATC run requests. */
function oslSets(objects) {
    return objects
        .map((o) => `    <osl:set xsi:type="osl:flatObjectSet"><osl:object name="${escapeXml(o.name)}" type="${escapeXml(o.type.split('/')[0] ?? 'CLAS')}"/></osl:set>`)
        .join('\n');
}
function buildUnitRunRequest(objects) {
    const sets = oslSets(objects);
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
    const sets = oslSets(objects);
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
    //
    // Message classes are the odd one out: their create handler wants the
    // MESSAGE-CLASS root element (<mc:messageClass>), not the generic
    // <adtcore:object> — strict backends answer 400 "expected element
    // {http://www.sap.com/adt/MessageClass}messageClass" otherwise
    // (verified on an S/4HANA sandbox).
    if (tag === 'mc:messageClass') {
        return `<?xml version="1.0" encoding="UTF-8"?>
<mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core"
       adtcore:description="${escapeXml(request.description)}" adtcore:name="${escapeXml(request.name)}" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="${escapeXml(request.packageName || '$TMP')}"/>
${props}
</mc:messageClass>`;
    }
    //
    // The element namespace is only declared for the types that have one
    // (audit P3): for the adtcore-defaulted types (TABL/DTEL/TTYP/DEVC)
    // the old code declared `xmlns:adtcore="http://www.sap.com/adt/adtcore"`
    // next to the real core namespace — a duplicate/bogus declaration strict
    // backends reject.
    const nsUri = ns === 'class'
        ? 'http://www.sap.com/adt/oo/classes'
        : ns === 'intf'
            ? 'http://www.sap.com/adt/oo/interfaces'
            : ns === 'prog'
                ? 'http://www.sap.com/adt/programs/programs'
                : ns === 'fugr'
                    ? 'http://www.sap.com/adt/functions/groups'
                    : ns === 'ddls'
                        ? 'http://www.sap.com/adt/ddl'
                        : undefined;
    const nsDecl = nsUri ? ` xmlns:${ns}="${nsUri}"` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<${tag}${nsDecl} xmlns:adtcore="http://www.sap.com/adt/core"
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
        case 'MSAG':
            return 'mc:messageClass';
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
            lineNumber: numAttr(el, 'lineNumber'),
        });
    }
    return { count: objects.length + sources.length, query, objects, sources };
}
function parseSourceResponse(xml, uri, contentType = '') {
    if (!xml.trimStart().startsWith('<')) {
        return { source: xml, mediaType: 'text/plain', uri, properties: [], rawXml: xml };
    }
    const root = tryParseXml(xml);
    if (!root) {
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
    // Node names are local-name only (xml.ts strips prefixes) — no `:name` form exists.
    if (root.name === name) {
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
/**
 * Shared LOCK-result field lookup: a nested `<UPPER>`/`<camel>` element first,
 * then an attribute on the root element. ABAP backends commonly nest the value
 * under `<asx:abap><asx:values><LOCK_HANDLE>…</LOCK_HANDLE>`, so the whole
 * tree is searched (not only direct children).
 */
function lockResponseField(xml, upper, camel) {
    const root = tryParseXml(xml);
    if (!root)
        return undefined;
    const nested = findTextDeep(root, upper) ?? findTextDeep(root, camel);
    if (nested)
        return nested;
    return root.attributes[camel] ?? root.attributes[upper];
}
function parseLockHandle(xml) {
    return lockResponseField(xml, 'LOCK_HANDLE', 'lockHandle');
}
function parseLockTransport(xml) {
    return lockResponseField(xml, 'CORRNR', 'corrNr');
}
/**
 * Best-effort CORRNR extraction from an object-creation response (audit M7):
 * some ADT profiles report the transport request the new object was recorded
 * into — as an attribute (`adtcore:corrNr="D01K961234"`) or as an element
 * (`<transportNumber>…</transportNumber>`). Returns `undefined` when the
 * response does not carry one.
 */
function parseCorrNr(text) {
    if (!text)
        return undefined;
    const patterns = [
        /corrNr\s*=\s*["']([A-Za-z][A-Za-z0-9]{4,19})["']/i,
        /<(?:[\w-]+:)?(?:transportNumber|corrNr|trkorr)>\s*([A-Za-z][A-Za-z0-9]{4,19})\s*<\/(?:[\w-]+:)?(?:transportNumber|corrNr|trkorr)>/i,
    ];
    for (const pattern of patterns) {
        const hit = pattern.exec(text);
        if (hit?.[1])
            return hit[1].toUpperCase();
    }
    return undefined;
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
        const objMessages = [];
        for (const msg of children(el, 'message')) {
            const severity = severityOf(attr(msg, 'type'));
            const parsed = {
                severity,
                text: deepText(child(msg, 'shortText') ?? child(msg, 'text') ?? msg) || '',
                id: attr(msg, 'id'),
                code: attr(msg, 'code'),
                longText: deepText(child(msg, 'longText') ?? msg) || undefined,
                line: numAttr(msg, 'line'),
                offset: numAttr(msg, 'offset'),
            };
            objMessages.push(parsed);
            if (severity === 'E')
                success = false;
        }
        // Audit P3: a GLOBAL E message (e.g. "object not found") used to mark
        // EVERY object ERROR — including ones whose own status says ACTIVATED.
        // The object's explicit status and its OWN messages are authoritative;
        // the global fallback applies only to objects reporting neither.
        const ownStatus = attr(el, 'status');
        const hasOwnErrors = objMessages.some((m) => m.severity === 'E');
        const status = ownStatus ?? (messageEls.length || hasOwnErrors ? 'ERROR' : 'ACTIVATED');
        if (status === 'ERROR')
            success = false;
        const failed = status === 'ERROR' || hasOwnErrors;
        items.push({
            uri,
            type: attr(el, 'type') ?? '',
            name: attr(el, 'name') ?? '',
            status,
            message: objMessages.map((m) => m.text).join('; ') || undefined,
            severity: failed ? 'E' : 'S',
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
        for (const name of ['msg', 'message']) {
            for (const el of children(node, name)) {
                out.push({
                    severity: severityOf(attr(el, 'type')),
                    text: deepText(child(el, 'shortText') ?? child(el, 'text') ?? el) || '',
                    id: attr(el, 'id'),
                    code: attr(el, 'code'),
                    longText: deepText(child(el, 'longText') ?? el) || undefined,
                });
            }
        }
        for (const childNode of node.children)
            walk(childNode);
    };
    walk(root);
    return out;
}
function parseCheckMessages(xml) {
    const root = tryParseXml(xml);
    return root ? collectMessages(root) : [];
}
// --- Async run helpers ------------------------------------------------------
function extractRunId(response) {
    // Prefer well-formed ids first (audit P3): a bare hex-char run also
    // matches hostname fragments like `deadbeef.example.com`, so the generic
    // pattern is only a guarded last resort.
    const UUID = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
    const LONG_HEX = /(?<![0-9A-Za-z.-])[0-9a-fA-F]{16,}(?![0-9A-Za-z.-])/;
    const GUARDED = /(?<![0-9A-Za-z.-])[0-9a-fA-F-]{8,}(?![0-9A-Za-z.-])/;
    const pick = (value) => UUID.exec(value)?.[0] ?? LONG_HEX.exec(value)?.[0] ?? GUARDED.exec(value)?.[0];
    // Location header (201) or a link/ID element in the body.
    const location = response.headers.get('location');
    if (location) {
        const match = pick(location);
        if (match)
            return match;
    }
    const root = tryParseXml(response.text);
    if (root) {
        const id = childText(root, 'id') ?? attr(root, 'id') ?? attr(root, 'runId');
        if (id)
            return id;
        // Atom link rel="self"/"status" with the id embedded in href.
        for (const link of children(root, 'link')) {
            const href = attr(link, 'href');
            if (!href)
                continue;
            const match = pick(href);
            if (match)
                return match;
        }
    }
    throw new AdtError('ADT: could not extract run id from response', response.status, [], response.text);
}
function isUnitRunComplete(xml) {
    const root = tryParseXml(xml);
    if (!root)
        return false;
    const status = (attr(root, 'status') ?? childText(root, 'status') ?? '').toLowerCase();
    return status === 'completed' || status === 'complete' || status === 'done' || status === 'finished' ||
        (attr(root, 'completed') === 'true') || (attr(root, 'done') === 'true');
}
function extractDisplayId(xml) {
    const root = tryParseXml(xml);
    if (!root)
        return undefined;
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
function isAtcRunComplete(xml) {
    const root = tryParseXml(xml);
    if (!root)
        return false;
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
    const root = tryParseXml(xml);
    if (!root) {
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
                const alerts = descendantsByName(m, 'alert');
                for (const a of alerts)
                    methodAlerts.add(a);
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
                    line: numAttr(m, 'line'),
                    offset: numAttr(m, 'offset'),
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
/** Fresh all-zero ATC severity tally (shared by every ATC parser branch). */
const EMPTY_ATC_COUNTS = {
    INFO: 0,
    WARNING: 0,
    ERROR: 0,
    CRITICAL: 0,
    CATASTROPHIC: 0,
};
function parseAtcResult(xml) {
    const root = parseXml(xml);
    const findings = [];
    const counts = { ...EMPTY_ATC_COUNTS };
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
                // The checkstyle file name is typically the object (include) URI —
                // keep it so line numbers stay attributable to the right source.
                uri: fileName,
                locationUri: fileName.startsWith('/') ? fileName : undefined,
                line: numAttr(err, 'line'),
                offset: numAttr(err, 'column'),
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
        variant: undefined,
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
    // Real backends put the id in child elements, older mocks in attributes —
    // both shapes resolve in one pass (childText first, attribute fallback).
    for (const el of children(root, 'result')) {
        const displayId = childText(el, 'displayId') ?? attr(el, 'displayId') ?? attr(el, 'id');
        if (!displayId)
            continue;
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
            aggregates: parseAggregatesNode(child(el, 'aggregates')),
            attributes,
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
        counts: { ...EMPTY_ATC_COUNTS },
        durationMs: 0,
        displayId,
        rawXml: xml,
    });
    const trimmed = xml.trimStart();
    if (!trimmed.startsWith('<'))
        return emptyResult();
    const root = tryParseXml(xml);
    if (!root)
        return emptyResult();
    if (root.name === 'checkstyle')
        return { ...parseAtcResult(xml), displayId };
    // atcresult envelope: resultList → result → objects → object → findings → finding
    const result = child(root, 'result') ?? root;
    if (result.name === 'resultList' || child(root, 'result') || child(result, 'displayId') || child(result, 'objects')) {
        const findings = [];
        const counts = { ...EMPTY_ATC_COUNTS };
        const objectsNode = child(result, 'objects');
        // Priority tally from the finding attributes — used to derive aggregates
        // when the result body carries no <aggregates> node (subset backends).
        let p1 = 0;
        let p2 = 0;
        let p3 = 0;
        let p4 = 0;
        for (const obj of children(objectsNode ?? result, 'object')) {
            const objectName = attr(obj, 'name') ?? '';
            const findingsNode = child(obj, 'findings');
            for (const finding of children(findingsNode ?? obj, 'finding')) {
                const priority = Number(attr(finding, 'priority') ?? 0);
                const severity = Number.isFinite(priority) && priority > 0 ? severityFromPriority(priority) : 'INFO';
                if (priority === 1)
                    p1++;
                else if (priority === 2)
                    p2++;
                else if (priority === 3)
                    p3++;
                else if (priority === 4)
                    p4++;
                const location = attr(finding, 'location') ?? '';
                const locMatch = /#start=(\d+)(?:,(\d+))?/.exec(location);
                // The location's URI part (before #start=…) points at the exact
                // object/include the line refers to — often an INCLUDE while
                // objectName stays the MAIN program name.
                const locationUri = location && !location.startsWith('#') ? location.split('#')[0] : undefined;
                counts[severity] = (counts[severity] ?? 0) + 1;
                findings.push({
                    check: attr(finding, 'checkId') ?? '',
                    checkTitle: attr(finding, 'checkTitle') ?? '',
                    severity,
                    message: attr(finding, 'messageTitle') ?? attr(finding, 'messageId') ?? '',
                    objectName,
                    uri: attr(finding, 'uri') ?? '',
                    locationUri,
                    line: locMatch ? Number(locMatch[1]) : undefined,
                    offset: locMatch && locMatch[2] ? Number(locMatch[2]) : undefined,
                    messageId: attr(finding, 'messageId'),
                    longText: childText(finding, 'longText') ?? undefined,
                });
            }
        }
        const clean = counts.ERROR + counts.CRITICAL + counts.CATASTROPHIC === 0;
        // Prefer the backend's aggregates node; derive P1-P4 from the findings
        // when absent so callers do not see all-zero counts on subset backends.
        const aggregates = parseAggregatesNode(child(result, 'aggregates')) ??
            (findings.length > 0 ? { priority1: p1, priority2: p2, priority3: p3, priority4: p4, failures: 0 } : undefined);
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
    const root = tryParseXml(xml);
    return root ? attr(root, 'uri') ?? attr(root, 'href') : undefined;
}
/** Object URI by convention for a freshly created object (fallback when the
 * backend returns no Location header / body, e.g. minimal ADT profiles). */
function uriForCreated(type, name) {
    const cat = type.split('/')[0];
    const base = ENDPOINTS.createByType[cat];
    return `${base ? base() : `${ADT_BASE_PATH}/repository/objects`}/${name.toLowerCase()}`;
}
// --- Transports -------------------------------------------------------------
/**
 * Depth-first collection of transport request elements (local name `request`
 * or `transport`) anywhere in a Transport Organizer Tree. Task elements
 * (`task`, or `request` elements with type `T`) are skipped — only actual
 * requests are reported. Node names are local names: xml.ts strips the
 * namespace prefix when parsing, so no prefixed spellings are checked.
 */
function collectTransportRequests(root) {
    const found = [];
    const visit = (node) => {
        for (const child of node.children) {
            if (child.name === 'request' && attr(child, 'type') !== 'T') {
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
    return node.name === 'request' || node.name === 'transport';
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
 * objects and are skipped to avoid duplicates. (Node names are local names —
 * xml.ts strips the prefix when parsing, see collectTransportRequests.)
 */
function collectAbapObjects(requestEl) {
    const found = [];
    const visit = (node) => {
        for (const child of node.children) {
            if (child.name === 'task')
                continue;
            if (child.name === 'abap_object')
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
    const root = tryParseXml(xml);
    if (!root)
        return [];
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
/**
 * Tolerant structured-XML dump parser: every text-bearing child becomes a
 * section. Additionally understands the METADATA-only shape served by
 * restricted ADT profiles (verified on an S/4HANA sandbox, S4C): the body is
 * a `<dump:dump>` element whose INFORMATION lives in root ATTRIBUTES
 * (error/exception/terminatedProgram/…) plus a `<dump:chapters>` index whose
 * entries only carry title/line pointers into the `/formatted` view — there
 * are no text-bearing leaf elements at all. Those attributes are surfaced as
 * sections so the caller can decide to fetch the formatted view.
 */
function parseDumpDetail(xml, id) {
    const sections = [];
    const root = tryParseXml(xml);
    if (!root) {
        // Non-XML body → keep raw.
        return { id, sections: [], raw: xml, view: 'default' };
    }
    const title = attr(root, 'title') ?? attr(root, 'type') ?? attr(root, 'name') ?? childText(root, 'name') ?? childText(root, 'title');
    // Root attributes first — the metadata-only profiles carry ALL diagnostics here.
    for (const key of ['error', 'exception', 'terminatedProgram', 'serverInstance', 'datetime', 'author']) {
        const value = attr(root, key);
        if (value)
            sections.push({ name: key, value });
    }
    const walk = (node) => {
        for (const c of node.children) {
            if (c.name === 'chapter')
                continue; // index metadata, not content
            if (c.children.length === 0 && c.text) {
                sections.push({ name: c.name, value: c.text });
            }
            else if (c.children.length > 0) {
                // Composite nodes contribute a flattened key/value view.
                for (const gc of c.children) {
                    if (gc.name === 'chapter')
                        continue;
                    if (gc.text)
                        sections.push({ name: `${c.name}.${gc.name}`, value: gc.text });
                }
                walk(c);
            }
        }
    };
    walk(root);
    // Chapter index of the metadata-only shape: "title (line …)" per chapter.
    const chapterTitles = [];
    const collectChapters = (node) => {
        for (const c of node.children) {
            if (c.name === 'chapter') {
                const chapterTitle = attr(c, 'title');
                const line = attr(c, 'line');
                if (chapterTitle)
                    chapterTitles.push(line ? `${chapterTitle} (line ${line})` : chapterTitle);
            }
            else {
                collectChapters(c);
            }
        }
    };
    collectChapters(root);
    if (chapterTitles.length > 0) {
        sections.push({ name: 'chapters', value: chapterTitles.join(' | ') });
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