"use strict";
/**
 * Transport read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransport = getTransport;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get ABAP transport request
 */
async function getTransport(connection, transportNumber) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(transportNumber);
    const url = `/sap/bc/adt/cts/transportrequests/${encodedName}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {},
    });
}
