"use strict";
/**
 * ABAP Profiler Traces
 *
 * Provides functions for managing and retrieving ABAP profiler traces:
 * - Trace files listing
 * - Trace parameters (general, callstack aggregation, AMDP)
 * - Trace requests
 * - Object types and process types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROFILER_TRACE_PARAMETERS = void 0;
exports.normalizeProfilerTraceId = normalizeProfilerTraceId;
exports.buildTraceParametersXml = buildTraceParametersXml;
exports.createTraceParameters = createTraceParameters;
exports.extractProfilerIdFromResponse = extractProfilerIdFromResponse;
exports.extractTraceIdFromTraceRequestsResponse = extractTraceIdFromTraceRequestsResponse;
exports.getTraceHitList = getTraceHitList;
exports.getTraceStatements = getTraceStatements;
exports.getTraceDbAccesses = getTraceDbAccesses;
exports.listTraceFiles = listTraceFiles;
exports.getTraceParameters = getTraceParameters;
exports.getTraceParametersForCallstack = getTraceParametersForCallstack;
exports.getTraceParametersForAmdp = getTraceParametersForAmdp;
exports.listTraceRequests = listTraceRequests;
exports.getTraceRequestsByUri = getTraceRequestsByUri;
exports.listObjectTypes = listObjectTypes;
exports.listProcessTypes = listProcessTypes;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
exports.DEFAULT_PROFILER_TRACE_PARAMETERS = {
    allMiscAbapStatements: false,
    allProceduralUnits: true,
    allInternalTableEvents: false,
    allDynproEvents: false,
    aggregate: false,
    explicitOnOff: false,
    withRfcTracing: true,
    allSystemKernelEvents: false,
    sqlTrace: true,
    allDbEvents: true,
    maxSizeForTraceFile: 30720,
    amdpTrace: true,
    maxTimeForTracing: 1800,
};
function escapeXmlAttr(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}
function toTraceId(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error('Trace ID is required');
    }
    const marker = '/sap/bc/adt/runtime/traces/abaptraces/';
    const markerIndex = trimmed.indexOf(marker);
    if (markerIndex >= 0) {
        const rest = trimmed.slice(markerIndex + marker.length);
        const slashIndex = rest.indexOf('/');
        const queryIndex = rest.indexOf('?');
        const hashIndex = rest.indexOf('#');
        let end = rest.length;
        for (const idx of [slashIndex, queryIndex, hashIndex]) {
            if (idx >= 0 && idx < end) {
                end = idx;
            }
        }
        const id = rest.slice(0, end).trim();
        if (id) {
            return id;
        }
    }
    return trimmed;
}
function normalizeProfilerTraceId(traceIdOrUri) {
    if (!traceIdOrUri) {
        throw new Error('Trace ID is required');
    }
    return toTraceId(String(traceIdOrUri));
}
function boolToQueryValue(value) {
    if (value === undefined) {
        return undefined;
    }
    return value ? 'true' : 'false';
}
function buildTraceParametersXml(options = {}) {
    const merged = {
        ...exports.DEFAULT_PROFILER_TRACE_PARAMETERS,
        ...options,
    };
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<trc:parameters xmlns:trc="http://www.sap.com/adt/runtime/traces/abaptraces">',
    ];
    const appendBoolean = (name, value) => {
        if (value === undefined) {
            return;
        }
        lines.push(`  <trc:${name} value="${value ? 'true' : 'false'}"/>`);
    };
    const appendNumber = (name, value) => {
        if (value === undefined || Number.isNaN(value)) {
            return;
        }
        lines.push(`  <trc:${name} value="${Math.trunc(value)}"/>`);
    };
    appendBoolean('allMiscAbapStatements', merged.allMiscAbapStatements);
    appendBoolean('allProceduralUnits', merged.allProceduralUnits);
    appendBoolean('allInternalTableEvents', merged.allInternalTableEvents);
    appendBoolean('allDynproEvents', merged.allDynproEvents);
    if (merged.description !== undefined) {
        lines.push(`  <trc:description value="${escapeXmlAttr(String(merged.description))}"/>`);
    }
    appendBoolean('aggregate', merged.aggregate);
    appendBoolean('explicitOnOff', merged.explicitOnOff);
    appendBoolean('withRfcTracing', merged.withRfcTracing);
    appendBoolean('allSystemKernelEvents', merged.allSystemKernelEvents);
    appendBoolean('sqlTrace', merged.sqlTrace);
    appendBoolean('allDbEvents', merged.allDbEvents);
    appendNumber('maxSizeForTraceFile', merged.maxSizeForTraceFile);
    appendBoolean('amdpTrace', merged.amdpTrace);
    appendNumber('maxTimeForTracing', merged.maxTimeForTracing);
    lines.push('</trc:parameters>');
    return lines.join('\n');
}
async function createTraceParameters(connection, options = {}) {
    const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;
    const data = buildTraceParametersXml(options);
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        data,
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_XML,
            'Content-Type': contentTypes_1.CT_TRACE_PARAMETERS,
        },
    });
}
function extractProfilerIdFromResponse(response) {
    const headers = response?.headers;
    const location = headers?.location ??
        headers?.Location ??
        headers?.['content-location'] ??
        headers?.['Content-Location'];
    if (typeof location !== 'string' || !location.trim()) {
        return undefined;
    }
    const value = location.trim();
    if (value.startsWith('/')) {
        return value;
    }
    try {
        const parsed = new URL(value);
        return `${parsed.pathname}${parsed.search}`;
    }
    catch {
        return value;
    }
}
const TRACE_ID_REGEX = /\/sap\/bc\/adt\/runtime\/traces\/abaptraces\/([A-Za-z0-9]{16,})(?=\/|[?&#"'\s]|$)/g;
function extractTraceIdFromTraceRequestsResponse(response) {
    const headers = response?.headers;
    const headerCandidates = [
        headers?.location,
        headers?.Location,
        headers?.['content-location'],
        headers?.['Content-Location'],
    ];
    for (const candidate of headerCandidates) {
        if (typeof candidate !== 'string') {
            continue;
        }
        const match = [...candidate.matchAll(TRACE_ID_REGEX)][0];
        if (match?.[1]) {
            return match[1];
        }
    }
    const body = typeof response?.data === 'string'
        ? response.data
        : JSON.stringify(response?.data ?? '');
    const match = [...body.matchAll(TRACE_ID_REGEX)][0];
    if (match?.[1]) {
        return match[1];
    }
    return undefined;
}
/**
 * Get profiler trace hitlist
 *
 * @param connection - ABAP connection
 * @param traceIdOrUri - Trace ID (or full trace URI)
 * @param options - Optional filters
 * @returns Axios response with trace hitlist
 */
async function getTraceHitList(connection, traceIdOrUri, options = {}) {
    const traceId = normalizeProfilerTraceId(traceIdOrUri);
    const params = new URLSearchParams();
    const withSystemEvents = boolToQueryValue(options.withSystemEvents);
    if (withSystemEvents !== undefined) {
        params.set('withSystemEvents', withSystemEvents);
    }
    const url = `/sap/bc/adt/runtime/traces/abaptraces/${encodeURIComponent(traceId)}/hitlist${params.toString() ? `?${params.toString()}` : ''}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_XML,
        },
    });
}
/**
 * Get profiler trace statements
 *
 * @param connection - ABAP connection
 * @param traceIdOrUri - Trace ID (or full trace URI)
 * @param options - Optional statement filters
 * @returns Axios response with trace statements
 */
async function getTraceStatements(connection, traceIdOrUri, options = {}) {
    const traceId = normalizeProfilerTraceId(traceIdOrUri);
    const params = new URLSearchParams();
    if (options.id !== undefined) {
        params.set('id', String(Math.trunc(options.id)));
    }
    const withDetails = boolToQueryValue(options.withDetails);
    if (withDetails !== undefined) {
        params.set('withDetails', withDetails);
    }
    if (options.autoDrillDownThreshold !== undefined) {
        params.set('autoDrillDownThreshold', String(Math.trunc(options.autoDrillDownThreshold)));
    }
    const withSystemEvents = boolToQueryValue(options.withSystemEvents);
    if (withSystemEvents !== undefined) {
        params.set('withSystemEvents', withSystemEvents);
    }
    const url = `/sap/bc/adt/runtime/traces/abaptraces/${encodeURIComponent(traceId)}/statements${params.toString() ? `?${params.toString()}` : ''}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_CALLTREE,
        },
    });
}
/**
 * Get profiler trace DB accesses
 *
 * @param connection - ABAP connection
 * @param traceIdOrUri - Trace ID (or full trace URI)
 * @param options - Optional filters
 * @returns Axios response with DB accesses
 */
async function getTraceDbAccesses(connection, traceIdOrUri, options = {}) {
    const traceId = normalizeProfilerTraceId(traceIdOrUri);
    const params = new URLSearchParams();
    const withSystemEvents = boolToQueryValue(options.withSystemEvents);
    if (withSystemEvents !== undefined) {
        params.set('withSystemEvents', withSystemEvents);
    }
    const url = `/sap/bc/adt/runtime/traces/abaptraces/${encodeURIComponent(traceId)}/dbAccesses${params.toString() ? `?${params.toString()}` : ''}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_XML,
        },
    });
}
/**
 * List trace files
 *
 * @param connection - ABAP connection
 * @param options - Optional filters (user)
 * @returns Axios response with list of trace files
 */
async function listTraceFiles(connection, options) {
    const params = new URLSearchParams();
    if (options?.user) {
        params.set('user', options.user);
    }
    const qs = params.toString();
    const url = `/sap/bc/adt/runtime/traces/abaptraces${qs ? `?${qs}` : ''}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_XML,
        },
    });
}
/**
 * Get trace parameters
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace parameters
 */
async function getTraceParameters(connection) {
    const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_XML,
        },
    });
}
/**
 * Get trace parameters for callstack aggregation
 *
 * @param connection - ABAP connection
 * @returns Axios response with callstack aggregation parameters
 */
async function getTraceParametersForCallstack(connection) {
    const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_XML,
        },
    });
}
/**
 * Get trace parameters for AMDP trace
 *
 * @param connection - ABAP connection
 * @returns Axios response with AMDP trace parameters
 */
async function getTraceParametersForAmdp(connection) {
    const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_XML,
        },
    });
}
/**
 * List trace requests
 *
 * @param connection - ABAP connection
 * @returns Axios response with list of trace requests
 */
async function listTraceRequests(connection) {
    const url = `/sap/bc/adt/runtime/traces/abaptraces/requests`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_FEED,
        },
    });
}
/**
 * Get trace requests filtered by URI
 *
 * @param connection - ABAP connection
 * @param uri - Object URI to filter by
 * @returns Axios response with filtered trace requests
 */
async function getTraceRequestsByUri(connection, uri) {
    if (!uri) {
        throw new Error('URI is required');
    }
    const url = `/sap/bc/adt/runtime/traces/abaptraces/requests?uri=${encodeURIComponent(uri)}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_FEED,
        },
    });
}
/**
 * List available object types for tracing
 *
 * @param connection - ABAP connection
 * @returns Axios response with list of object types
 */
async function listObjectTypes(connection) {
    const url = `/sap/bc/adt/runtime/traces/abaptraces/objecttypes`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_XML,
        },
    });
}
/**
 * List available process types for tracing
 *
 * @param connection - ABAP connection
 * @returns Axios response with list of process types
 */
async function listProcessTypes(connection) {
    const url = `/sap/bc/adt/runtime/traces/abaptraces/processtypes`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_TRACE_XML,
        },
    });
}
