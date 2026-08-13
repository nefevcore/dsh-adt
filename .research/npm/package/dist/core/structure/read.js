"use strict";
/**
 * Structure read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStructureMetadata = getStructureMetadata;
exports.getStructureSource = getStructureSource;
exports.getStructure = getStructure;
exports.getStructureTransport = getStructureTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const noopLogger_1 = require("../../utils/noopLogger");
const timeouts_1 = require("../../utils/timeouts");
const AdtUtils_1 = require("../shared/AdtUtils");
function getUtils(connection) {
    return new AdtUtils_1.AdtUtils(connection, noopLogger_1.noopLogger);
}
/**
 * Get ABAP structure metadata (without source code)
 */
async function getStructureMetadata(connection, structureName, options) {
    return getUtils(connection).readObjectMetadata('structure', structureName, undefined, options);
}
/**
 * Get ABAP structure source code
 */
async function getStructureSource(connection, structureName, version, options) {
    return getUtils(connection).readObjectSource('structure', structureName, undefined, version, options);
}
/**
 * Get ABAP structure (source code by default for backward compatibility)
 * @deprecated Use getStructureSource() or getStructureMetadata() instead
 */
async function getStructure(connection, structureName) {
    return getStructureSource(connection, structureName);
}
/**
 * Get transport request for ABAP structure
 * @param connection - SAP connection
 * @param structureName - Structure name
 * @returns Transport request information
 */
async function getStructureTransport(connection, structureName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(structureName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/structures/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
