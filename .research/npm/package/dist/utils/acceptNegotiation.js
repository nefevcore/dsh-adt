"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAcceptCache = clearAcceptCache;
exports.setAcceptCorrectionEnabled = setAcceptCorrectionEnabled;
exports.getAcceptCorrectionEnabled = getAcceptCorrectionEnabled;
exports.extractSupportedAccept = extractSupportedAccept;
exports.extractSupportedContentType = extractSupportedContentType;
exports.wrapConnectionAcceptNegotiation = wrapConnectionAcceptNegotiation;
exports.makeAdtRequestWithAcceptNegotiation = makeAdtRequestWithAcceptNegotiation;
const acceptCache = new Map();
const contentTypeCache = new Map();
const baseRequestMap = new WeakMap();
let acceptCorrectionOverride;
function clearAcceptCache() {
    acceptCache.clear();
    contentTypeCache.clear();
}
function setAcceptCorrectionEnabled(enabled) {
    acceptCorrectionOverride = enabled;
}
function getAcceptCorrectionEnabled() {
    if (acceptCorrectionOverride !== undefined) {
        return acceptCorrectionOverride;
    }
    return process.env.ADT_ACCEPT_CORRECTION !== 'false';
}
function extractSupportedAccept(error) {
    const types = new Set();
    const e = error;
    const headers = (e?.response?.headers || {});
    const headerCandidates = [
        headers.accept,
        headers['x-sap-adt-supported-accept'],
        headers['x-sap-adt-accept'],
        headers['supported-accept'],
        headers['accept-supported'],
    ];
    for (const value of headerCandidates) {
        if (typeof value === 'string') {
            value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
                .forEach((entry) => {
                types.add(entry);
            });
        }
    }
    const data = e?.response?.data;
    const text = typeof data === 'string' ? data : data ? JSON.stringify(data) : '';
    if (text) {
        const matches = text.match(/[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+(?:;[^,\s]+)?/g) || [];
        for (const match of matches) {
            types.add(match);
        }
    }
    return Array.from(types).filter(Boolean);
}
function extractSupportedContentType(error) {
    const e = error;
    if (e?.response?.status !== 415) {
        return [];
    }
    const types = new Set();
    const headers = (e?.response?.headers || {});
    const headerCandidates = [
        headers['content-type'],
        headers['x-sap-adt-supported-content-type'],
        headers['supported-content-type'],
    ];
    for (const value of headerCandidates) {
        if (typeof value === 'string') {
            value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
                .forEach((entry) => {
                types.add(entry);
            });
        }
    }
    const data = e?.response?.data;
    const text = typeof data === 'string' ? data : data ? JSON.stringify(data) : '';
    if (text) {
        const matches = text.match(/[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+(?:;[^,\s]+)?/g) || [];
        for (const match of matches) {
            types.add(match);
        }
    }
    return Array.from(types).filter(Boolean);
}
function buildCacheKey(request) {
    return `${request.method.toUpperCase()} ${request.url}`;
}
function getBaseRequest(connection) {
    return (baseRequestMap.get(connection) ?? connection.makeAdtRequest.bind(connection));
}
function wrapConnectionAcceptNegotiation(connection, logger) {
    if (baseRequestMap.has(connection)) {
        return;
    }
    const baseRequest = connection.makeAdtRequest.bind(connection);
    baseRequestMap.set(connection, baseRequest);
    connection.makeAdtRequest = async function makeAdtRequestWithNegotiation(request) {
        return makeAdtRequestWithAcceptNegotiation(connection, request, logger ? { logger } : undefined);
    };
}
async function makeAdtRequestWithAcceptNegotiation(connection, request, options) {
    const enableCorrection = options?.enableAcceptCorrection ?? getAcceptCorrectionEnabled();
    const logger = options?.logger;
    const cacheKey = buildCacheKey(request);
    const headers = { ...(request.headers || {}) };
    const cachedAccept = enableCorrection ? acceptCache.get(cacheKey) : undefined;
    if (cachedAccept) {
        headers.Accept = cachedAccept;
    }
    const cachedContentType = enableCorrection
        ? contentTypeCache.get(cacheKey)
        : undefined;
    if (cachedContentType) {
        headers['Content-Type'] = cachedContentType;
    }
    const baseRequest = getBaseRequest(connection);
    try {
        return await baseRequest({
            ...request,
            headers,
        });
    }
    catch (error) {
        const e = error;
        if (e.response?.status === 406) {
            const supported = extractSupportedAccept(error);
            if (supported.length > 0) {
                logger?.warn?.(`Accept not supported for ${request.url}. Supported Accept: ${supported.join(', ')}`);
            }
            if (enableCorrection && supported.length > 0) {
                const nextAccept = supported.join(', ');
                if (headers.Accept !== nextAccept) {
                    acceptCache.set(cacheKey, nextAccept);
                    logger?.warn?.(`Retrying ${request.url} with corrected Accept: ${nextAccept}`);
                    return await baseRequest({
                        ...request,
                        headers: { ...headers, Accept: nextAccept },
                    });
                }
            }
        }
        if (e.response?.status === 415) {
            const supported = extractSupportedContentType(error);
            if (supported.length > 0) {
                logger?.warn?.(`Content-Type not supported for ${request.url}. Supported Content-Type: ${supported.join(', ')}`);
            }
            if (enableCorrection && supported.length > 0) {
                const nextContentType = supported[0];
                if (headers['Content-Type'] !== nextContentType) {
                    contentTypeCache.set(cacheKey, nextContentType);
                    logger?.warn?.(`Retrying ${request.url} with corrected Content-Type: ${nextContentType}`);
                    return await baseRequest({
                        ...request,
                        headers: { ...headers, 'Content-Type': nextContentType },
                    });
                }
            }
        }
        throw error;
    }
}
