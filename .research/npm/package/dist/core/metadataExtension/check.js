"use strict";
/**
 * Check Metadata Extension (DDLX) syntax
 *
 * Uses standard ABAP check run endpoint
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkMetadataExtension = checkMetadataExtension;
const checkRun_1 = require("../../utils/checkRun");
/**
 * Check metadata extension syntax
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check ('active' or 'inactive', default 'inactive')
 * @param sourceCode - Optional source code to validate before saving
 * @returns Axios response with check results
 *
 * @example
 * ```typescript
 * const checkResult = await checkMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', sessionId);
 * ```
 */
async function checkMetadataExtension(connection, name, version = 'inactive', sourceCode) {
    const objectType = 'DDLX/EX';
    // Pass just the name, getObjectUri will build the full URI
    const objectName = name;
    return (0, checkRun_1.runCheckRun)(connection, objectType, objectName, version, 'abapCheckRun', sourceCode);
}
