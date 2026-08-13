"use strict";
/**
 * Domain read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDomain = getDomain;
exports.getDomainTransport = getDomainTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get ABAP domain
 * @param connection - ABAP connection
 * @param domainName - Domain name
 * @param options - Optional read options
 * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
 *                                  Useful after create/activate operations to wait until object is ready
 */
async function getDomain(connection, domainName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(domainName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/domains/${encodedName}${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_DOMAIN,
        },
    });
}
/**
 * Get transport request for ABAP domain
 * @param connection - SAP connection
 * @param domainName - Domain name
 * @param options - Optional read options
 * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
 *                                  Useful after create/activate operations to wait until object is ready
 * @returns Transport request information
 */
async function getDomainTransport(connection, domainName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(domainName);
    let url = `/sap/bc/adt/ddic/domains/${encodedName}/transport`;
    if (options?.withLongPolling) {
        url += '?withLongPolling=true';
    }
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
