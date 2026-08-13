"use strict";
/**
 * Read Metadata Extension (DDLX)
 *
 * Endpoint: GET /sap/bc/adt/ddic/ddlx/sources/{name}
 * Source: GET /sap/bc/adt/ddic/ddlx/sources/{name}/source/main
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMetadataExtension = readMetadataExtension;
exports.readMetadataExtensionSource = readMetadataExtensionSource;
exports.getMetadataExtensionTransport = getMetadataExtensionTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Read metadata extension metadata
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @returns Axios response with metadata extension metadata
 *
 * @example
 * ```typescript
 * const metadata = await readMetadataExtension(connection, 'ZDEMO_C_CDS_MDE');
 * ```
 */
async function readMetadataExtension(connection, name, options, logger) {
    const lowerName = name.toLowerCase();
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}${query}`;
    const headers = {
        Accept: options?.accept ?? contentTypes_1.CT_METADATA_EXTENSION,
    };
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    }, { logger });
}
/**
 * Read metadata extension source code
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param version - Version to read ('active' or 'inactive', default 'active')
 * @returns Axios response with source code as string
 *
 * @example
 * ```typescript
 * const response = await readMetadataExtensionSource(connection, 'ZDEMO_C_CDS_MDE');
 * const sourceCode = response.data;
 * ```
 */
async function readMetadataExtensionSource(connection, name, version = 'active', options, logger) {
    const lowerName = name.toLowerCase();
    const versionQuery = version === 'inactive' ? '?version=inactive' : '';
    const longPollingQuery = options?.withLongPolling
        ? versionQuery
            ? '&withLongPolling=true'
            : '?withLongPolling=true'
        : '';
    const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}/source/main${versionQuery}${longPollingQuery}`;
    const headers = {
        Accept: options?.accept ?? contentTypes_1.ACCEPT_SOURCE,
    };
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    }, { logger });
}
/**
 * Get transport request for ABAP metadata extension
 * @param connection - SAP connection
 * @param name - Metadata extension name
 * @returns Transport request information
 */
async function getMetadataExtensionTransport(connection, name, options) {
    const lowerName = name.toLowerCase();
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}/transport${query}`;
    const headers = {
        Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
    };
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    });
}
