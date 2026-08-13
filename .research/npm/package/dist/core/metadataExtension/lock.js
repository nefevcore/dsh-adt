"use strict";
/**
 * Lock Metadata Extension (DDLX) for editing
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=LOCK&accessMode=MODIFY
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockMetadataExtension = lockMetadataExtension;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock a metadata extension for modification
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param sessionId - Session ID for request tracking
 * @returns Lock handle string
 *
 * @example
 * ```typescript
 * const lockHandle = await lockMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', sessionId);
 * ```
 */
async function lockMetadataExtension(connection, name) {
    const lowerName = name.toLowerCase();
    const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}?_action=LOCK&accessMode=MODIFY`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_LOCK,
    };
    const response = await connection.makeAdtRequest({
        method: 'POST',
        url,
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: undefined,
        headers,
    });
    // Parse lock handle from XML response
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const result = parser.parse(response.data);
    const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    if (!lockHandle) {
        throw new Error('Failed to obtain lock handle from SAP. Metadata extension may be locked by another user.');
    }
    return lockHandle;
}
