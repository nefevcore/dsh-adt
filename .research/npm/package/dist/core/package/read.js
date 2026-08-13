"use strict";
/**
 * Package read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPackage = getPackage;
exports.getPackageTransport = getPackageTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get ABAP package
 */
async function getPackage(connection, packageName, version = 'active', options, logger) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(packageName);
    const longPollingQuery = options?.withLongPolling
        ? '&withLongPolling=true'
        : '';
    const url = `/sap/bc/adt/packages/${encodedName}?version=${version}${longPollingQuery}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_PACKAGE,
        },
    }, { logger });
}
/**
 * Get transport request for ABAP package
 * @param connection - SAP connection
 * @param packageName - Package name
 * @returns Transport request information
 */
async function getPackageTransport(connection, packageName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(packageName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/packages/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
