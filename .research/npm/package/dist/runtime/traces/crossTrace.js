"use strict";
/**
 * ABAP Cross Trace
 *
 * Provides functions for managing ABAP cross traces:
 * - List traces with filters
 * - Get trace details (with optional sensitive data)
 * - Get trace records
 * - Get record content
 * - Get trace activations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCrossTraces = listCrossTraces;
exports.getCrossTrace = getCrossTrace;
exports.getCrossTraceRecords = getCrossTraceRecords;
exports.getCrossTraceRecordContent = getCrossTraceRecordContent;
exports.getCrossTraceActivations = getCrossTraceActivations;
const timeouts_1 = require("../../utils/timeouts");
/**
 * List cross traces
 *
 * @param connection - ABAP connection
 * @param options - Optional filters
 * @returns Axios response with list of traces
 */
async function listCrossTraces(connection, options) {
    const url = `/sap/bc/adt/crosstrace/traces`;
    const params = {};
    if (options?.traceUser)
        params.traceUser = options.traceUser;
    if (options?.actCreateUser)
        params.actCreateUser = options.actCreateUser;
    if (options?.actChangeUser)
        params.actChangeUser = options.actChangeUser;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Get trace details
 *
 * @param connection - ABAP connection
 * @param traceId - Trace ID
 * @param includeSensitiveData - Whether to include sensitive data
 * @returns Axios response with trace details
 */
async function getCrossTrace(connection, traceId, includeSensitiveData) {
    const url = `/sap/bc/adt/crosstrace/traces/${traceId}`;
    const params = {};
    if (includeSensitiveData !== undefined)
        params.includeSensitiveData = includeSensitiveData;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Get trace records
 *
 * @param connection - ABAP connection
 * @param traceId - Trace ID
 * @returns Axios response with trace records
 */
async function getCrossTraceRecords(connection, traceId) {
    const url = `/sap/bc/adt/crosstrace/traces/${traceId}/records`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Get trace record content
 *
 * @param connection - ABAP connection
 * @param traceId - Trace ID
 * @param recordNumber - Record number
 * @returns Axios response with record content
 */
async function getCrossTraceRecordContent(connection, traceId, recordNumber) {
    const url = `/sap/bc/adt/crosstrace/traces/${traceId}/records/${recordNumber}/content`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Get trace activations
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace activations
 */
async function getCrossTraceActivations(connection) {
    const url = `/sap/bc/adt/crosstrace/activations`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
