"use strict";
/**
 * Performance Trace (ST05)
 *
 * Provides functions for managing ST05 performance traces:
 * - Get trace state
 * - Get trace directory
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSt05TraceState = getSt05TraceState;
exports.getSt05TraceDirectory = getSt05TraceDirectory;
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get ST05 trace state
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace state
 */
async function getSt05TraceState(connection) {
    const url = `/sap/bc/adt/st05/trace/state`;
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
 * Get ST05 trace directory
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace directory information
 */
async function getSt05TraceDirectory(connection) {
    const url = `/sap/bc/adt/st05/trace/directory`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
