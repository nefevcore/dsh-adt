"use strict";
/**
 * Table read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTableMetadata = getTableMetadata;
exports.getTableSource = getTableSource;
exports.getTable = getTable;
exports.getTableTransport = getTableTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const noopLogger_1 = require("../../utils/noopLogger");
const timeouts_1 = require("../../utils/timeouts");
const AdtUtils_1 = require("../shared/AdtUtils");
function getUtils(connection) {
    return new AdtUtils_1.AdtUtils(connection, noopLogger_1.noopLogger);
}
/**
 * Get ABAP table metadata (without source code)
 */
async function getTableMetadata(connection, tableName, options) {
    return getUtils(connection).readObjectMetadata('table', tableName, undefined, options);
}
/**
 * Get ABAP table source code (DDL)
 */
async function getTableSource(connection, tableName, version, options) {
    return getUtils(connection).readObjectSource('table', tableName, undefined, version, options);
}
/**
 * Get ABAP table (source code by default for backward compatibility)
 * @deprecated Use getTableSource() or getTableMetadata() instead
 */
async function getTable(connection, tableName) {
    return getTableSource(connection, tableName);
}
/**
 * Get transport request for ABAP table
 * @param connection - SAP connection
 * @param tableName - Table name
 * @returns Transport request information
 */
async function getTableTransport(connection, tableName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(tableName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/tables/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
