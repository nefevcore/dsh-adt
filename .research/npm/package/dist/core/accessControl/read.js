"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessControl = getAccessControl;
exports.getAccessControlSource = getAccessControlSource;
exports.getAccessControlTransport = getAccessControlTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get access control metadata
 */
async function getAccessControl(connection, accessControlName, version = 'inactive', options, logger) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(accessControlName.toLowerCase());
    const queryParams = [];
    if (version) {
        queryParams.push(`version=${version}`);
    }
    if (options?.withLongPolling) {
        queryParams.push('withLongPolling=true');
    }
    const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    const url = `/sap/bc/adt/acm/dcl/sources/${encodedName}${query}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.CT_ACCESS_CONTROL,
        },
    }, { logger });
}
/**
 * Get access control source code
 */
async function getAccessControlSource(connection, accessControlName, version = 'inactive', options, logger) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(accessControlName.toLowerCase());
    const queryParams = [];
    if (version) {
        queryParams.push(`version=${version}`);
    }
    if (options?.withLongPolling) {
        queryParams.push('withLongPolling=true');
    }
    const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    const url = `/sap/bc/adt/acm/dcl/sources/${encodedName}/source/main${query}`;
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
 * Get access control transport info
 */
async function getAccessControlTransport(connection, accessControlName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(accessControlName.toLowerCase());
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/acm/dcl/sources/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
