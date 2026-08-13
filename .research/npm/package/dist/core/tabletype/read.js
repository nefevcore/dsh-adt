"use strict";
/**
 * TableType read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTableTypeMetadata = getTableTypeMetadata;
exports.getTableTypeSource = getTableTypeSource;
exports.getTableType = getTableType;
exports.getTableTypeTransport = getTableTypeTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get ABAP table type metadata (without source code)
 */
async function getTableTypeMetadata(connection, tableTypeName, options, logger) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(tableTypeName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}${query}`;
    const acceptHeader = options?.accept ?? contentTypes_1.CT_TABLE_TYPE;
    try {
        return await (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
            url,
            method: 'GET',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers: {
                Accept: acceptHeader,
            },
        }, { logger });
    }
    catch (error) {
        const e = error;
        // Output full error response as-is for debugging
        const status = e.response?.status || 'unknown';
        const statusText = e.response?.statusText || '';
        const responseHeaders = JSON.stringify(e.response?.headers || {}, null, 2);
        const responseData = e.response?.data
            ? typeof e.response.data === 'string'
                ? e.response.data
                : JSON.stringify(e.response.data, null, 2)
            : e.message || 'No response data';
        const fullError = `getTableTypeMetadata failed for ${tableTypeName}
HTTP Status: ${status} ${statusText}
Response Headers: ${responseHeaders}
Response Data: ${responseData}
Request URL: ${url}
Request Headers: ${JSON.stringify({ Accept: acceptHeader }, null, 2)}`;
        logger?.error?.(fullError);
        throw error;
    }
}
/**
 * Get ABAP table type source code (DDL)
 */
async function getTableTypeSource(connection, tableTypeName, version, options, logger) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(tableTypeName);
    const versionParam = version ? `version=${version}` : '';
    const longPollingParam = options?.withLongPolling
        ? 'withLongPolling=true'
        : '';
    const queryParams = [versionParam, longPollingParam]
        .filter(Boolean)
        .join('&');
    const query = queryParams ? `?${queryParams}` : '';
    const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}/source/main${query}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_SOURCE,
        },
    }, { logger });
}
/**
 * Get ABAP table type (source code by default for backward compatibility)
 * @deprecated Use getTableTypeSource() or getTableTypeMetadata() instead
 */
async function getTableType(connection, tableTypeName) {
    return getTableTypeSource(connection, tableTypeName);
}
/**
 * Get transport request for ABAP table type
 * @param connection - SAP connection
 * @param tableTypeName - Table type name
 * @returns Transport request information
 */
async function getTableTypeTransport(connection, tableTypeName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(tableTypeName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
