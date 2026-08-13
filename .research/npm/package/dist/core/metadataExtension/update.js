"use strict";
/**
 * Update Metadata Extension (DDLX) source code
 *
 * Endpoint: PUT /sap/bc/adt/ddic/ddlx/sources/{name}/source/main?lockHandle={lockHandle}
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMetadataExtension = updateMetadataExtension;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Update metadata extension source code
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param sourceCode - Metadata extension annotation source code
 * @param lockHandle - Lock handle from lockMetadataExtension
 * @returns Axios response
 *
 * @example
 * ```typescript
 * const sourceCode = `@Metadata.layer: #CUSTOMER
 * annotate entity ZDEMO_C_CDS_VIEW
 *   with
 * {
 *     @EndUserText.label: 'Field 1 Label'
 *     @UI.identification: [{ position: 10 }]
 *     Fld1;
 * }`;
 *
 * await updateMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', sourceCode, lockHandle);
 * ```
 */
async function updateMetadataExtension(connection, name, sourceCode, lockHandle, transportRequest) {
    const lowerName = name.toLowerCase();
    const corrNrParam = transportRequest ? `&corrNr=${transportRequest}` : '';
    const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_SOURCE,
        'Content-Type': contentTypes_1.CT_SOURCE,
    };
    return connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: sourceCode,
        headers,
    });
}
