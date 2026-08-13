"use strict";
/**
 * Delete Metadata Extension (DDLX)
 *
 * Endpoint: DELETE /sap/bc/adt/ddic/ddlx/sources/{name}
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMetadataExtension = deleteMetadataExtension;
const timeouts_1 = require("../../utils/timeouts");
/**
 * Delete a metadata extension
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param transportRequest - Transport request number (optional for local objects)
 * @param sessionId - Session ID for request tracking
 * @returns Axios response
 *
 * @example
 * ```typescript
 * await deleteMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', 'TRLK900123', sessionId);
 * ```
 */
async function deleteMetadataExtension(connection, name, transportRequest) {
    const lowerName = name.toLowerCase();
    const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}${transportRequest ? `?corrNr=${transportRequest}` : ''}`;
    const headers = {
        Accept: 'application/xml',
    };
    return connection.makeAdtRequest({
        method: 'DELETE',
        url,
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: undefined,
        headers,
    });
}
