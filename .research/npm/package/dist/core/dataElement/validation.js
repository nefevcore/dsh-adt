"use strict";
/**
 * Data Element validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/dataelements/validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDataElementName = validateDataElementName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate data element name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/dataelements/validation
 *
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> message
 */
async function validateDataElementName(connection, dataElementName, packageName, description) {
    const url = `/sap/bc/adt/ddic/dataelements/validation`;
    const queryParams = new URLSearchParams({
        objtype: 'dtel',
        objname: dataElementName,
    });
    if (packageName) {
        queryParams.append('packagename', packageName);
    }
    // Description is required for data element validation
    queryParams.append('description', description || '');
    return connection.makeAdtRequest({
        url: `${url}?${queryParams.toString()}`,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_VALIDATION,
        },
    });
}
