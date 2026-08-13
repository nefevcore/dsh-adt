"use strict";
/**
 * FunctionGroup read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFunctionGroup = getFunctionGroup;
exports.getFunctionGroupTransport = getFunctionGroupTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get ABAP function group
 */
async function getFunctionGroup(connection, functionGroupName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(functionGroupName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/functions/groups/${encodedName}${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: options?.accept ?? '*/*' },
    });
}
/**
 * Get transport request for ABAP function group
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @returns Transport request information
 */
async function getFunctionGroupTransport(connection, functionGroupName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(functionGroupName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/functions/groups/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
