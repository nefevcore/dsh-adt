"use strict";
/**
 * Table validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/tables/validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTableName = validateTableName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate table name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/tables/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
async function validateTableName(connection, tableName, description) {
    const url = `/sap/bc/adt/ddic/tables/validation`;
    const queryParams = new URLSearchParams({
        objtype: 'tabldt',
        objname: tableName,
    });
    // Description is required for table validation
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
