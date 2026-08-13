"use strict";
/**
 * Activate Metadata Extension (DDLX)
 *
 * Endpoint: POST /sap/bc/adt/activation?method=activate&preauditRequested=true
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateMetadataExtension = activateMetadataExtension;
const activationUtils_1 = require("../../utils/activationUtils");
/**
 * Activate a metadata extension
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param sessionId - Session ID for request tracking
 * @param preaudit - Request pre-audit before activation (default: true)
 * @returns Axios response with activation result
 *
 * @example
 * ```typescript
 * await activateMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', sessionId);
 * ```
 */
async function activateMetadataExtension(connection, name, preaudit = true) {
    const lowerName = name.toLowerCase();
    const objectUri = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}`;
    return (0, activationUtils_1.activateObjectInSession)(connection, objectUri, name.toUpperCase(), preaudit);
}
