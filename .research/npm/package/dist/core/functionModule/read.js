"use strict";
/**
 * FunctionModule read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFunctionMetadata = getFunctionMetadata;
exports.getFunctionSource = getFunctionSource;
exports.getFunction = getFunction;
exports.getFunctionModuleTransport = getFunctionModuleTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const noopLogger_1 = require("../../utils/noopLogger");
const timeouts_1 = require("../../utils/timeouts");
const AdtUtils_1 = require("../shared/AdtUtils");
function getUtils(connection) {
    return new AdtUtils_1.AdtUtils(connection, noopLogger_1.noopLogger);
}
/**
 * Get ABAP function module metadata (without source code)
 */
async function getFunctionMetadata(connection, functionName, functionGroup, options) {
    return getUtils(connection).readObjectMetadata('functionmodule', functionName, functionGroup, options);
}
/**
 * Get ABAP function module source code
 * @param connection - SAP connection
 * @param functionName - Function module name
 * @param functionGroup - Function group name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
async function getFunctionSource(connection, functionName, functionGroup, version, options) {
    return getUtils(connection).readObjectSource('functionmodule', functionName, functionGroup, version, options);
}
/**
 * Get ABAP function module (source code by default for backward compatibility)
 * @deprecated Use getFunctionSource() or getFunctionMetadata() instead
 */
async function getFunction(connection, functionName, functionGroup, version = 'active') {
    return getFunctionSource(connection, functionName, functionGroup, version);
}
/**
 * Get transport request for ABAP function module
 * @param connection - SAP connection
 * @param functionName - Function module name
 * @param functionGroup - Function group name
 * @returns Transport request information
 */
async function getFunctionModuleTransport(connection, functionName, functionGroup, options) {
    const encodedGroup = (0, internalUtils_1.encodeSapObjectName)(functionGroup);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(functionName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
