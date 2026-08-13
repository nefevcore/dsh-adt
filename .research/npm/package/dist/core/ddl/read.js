"use strict";
/**
 * View read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDdlMetadata = getDdlMetadata;
exports.getDdlSource = getDdlSource;
exports.getDdl = getDdl;
exports.getDdlTransport = getDdlTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const noopLogger_1 = require("../../utils/noopLogger");
const timeouts_1 = require("../../utils/timeouts");
const AdtUtils_1 = require("../shared/AdtUtils");
function getUtils(connection) {
    return new AdtUtils_1.AdtUtils(connection, noopLogger_1.noopLogger);
}
/**
 * Get ABAP view metadata (without source code)
 */
async function getDdlMetadata(connection, ddlName, options) {
    return getUtils(connection).readObjectMetadata('view', ddlName, undefined, options);
}
/**
 * Get ABAP view source code
 */
async function getDdlSource(connection, ddlName, version, options) {
    return getUtils(connection).readObjectSource('view', ddlName, undefined, version, options);
}
/**
 * Get ABAP view (source code by default for backward compatibility)
 * @deprecated Use getDdlSource() or getDdlMetadata() instead
 */
async function getDdl(connection, ddlName) {
    return getDdlSource(connection, ddlName);
}
/**
 * Get transport request for ABAP view
 * @param connection - SAP connection
 * @param ddlName - View name
 * @returns Transport request information
 */
async function getDdlTransport(connection, ddlName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(ddlName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/ddl/sources/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
