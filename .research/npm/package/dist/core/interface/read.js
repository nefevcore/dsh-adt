"use strict";
/**
 * Interface read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInterfaceMetadata = getInterfaceMetadata;
exports.getInterfaceSource = getInterfaceSource;
exports.getInterface = getInterface;
exports.getInterfaceTransport = getInterfaceTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const noopLogger_1 = require("../../utils/noopLogger");
const timeouts_1 = require("../../utils/timeouts");
const AdtUtils_1 = require("../shared/AdtUtils");
function getUtils(connection) {
    return new AdtUtils_1.AdtUtils(connection, noopLogger_1.noopLogger);
}
/**
 * Get ABAP interface metadata (without source code)
 */
async function getInterfaceMetadata(connection, interfaceName, options) {
    return getUtils(connection).readObjectMetadata('interface', interfaceName, undefined, options);
}
/**
 * Get ABAP interface source code
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
async function getInterfaceSource(connection, interfaceName, version, options) {
    return getUtils(connection).readObjectSource('interface', interfaceName, undefined, version, options);
}
/**
 * Get ABAP interface (source code by default for backward compatibility)
 * @deprecated Use getInterfaceSource() or getInterfaceMetadata() instead
 */
async function getInterface(connection, interfaceName) {
    return getInterfaceSource(connection, interfaceName);
}
/**
 * Get transport request for ABAP interface
 * @param connection - SAP connection
 * @param interfaceName - Interface name
 * @returns Transport request information
 */
async function getInterfaceTransport(connection, interfaceName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(interfaceName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/oo/interfaces/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
