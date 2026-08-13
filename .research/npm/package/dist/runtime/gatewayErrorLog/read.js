"use strict";
/**
 * GatewayErrorLog - Low-level read functions
 *
 * Provides access to SAP Gateway error log (/IWFND/ERROR_LOG):
 * - List gateway errors with optional filtering
 * - Get individual error details by type and ID
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGatewayErrors = listGatewayErrors;
exports.getGatewayError = getGatewayError;
const timeouts_1 = require("../../utils/timeouts");
const read_1 = require("../feeds/read");
/**
 * List gateway errors
 *
 * @param connection - ABAP connection
 * @param options - Query options
 * @returns Axios response with gateway error log feed
 */
async function listGatewayErrors(connection, options) {
    const url = `/sap/bc/adt/gw/errorlog${(0, read_1.buildFeedQueryParams)(options, 'username')}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/atom+xml;type=feed',
        },
    });
}
/**
 * Get a single gateway error by type and ID
 *
 * @param connection - ABAP connection
 * @param errorType - Error type (e.g. 'Frontend Error')
 * @param errorId - Error transaction ID
 * @returns Axios response with gateway error details
 */
async function getGatewayError(connection, errorType, errorId) {
    const url = `/sap/bc/adt/gw/errorlog/${encodeURIComponent(errorType)}/${errorId}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
