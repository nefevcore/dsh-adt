"use strict";
/**
 * TableType validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/tabletypes/validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTableTypeName = validateTableTypeName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate table type name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/tabletypes/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
async function validateTableTypeName(connection, tableTypeName, description) {
    const url = `/sap/bc/adt/ddic/tabletypes/validation`;
    const queryParams = new URLSearchParams({
        objtype: 'ttypda',
        objname: tableTypeName,
    });
    // Description is required for table type validation
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
