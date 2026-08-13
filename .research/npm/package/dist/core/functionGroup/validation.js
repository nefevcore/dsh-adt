"use strict";
/**
 * Function Group validation
 * Uses ADT validation endpoint: /sap/bc/adt/functions/validation
 * Matches Eclipse ADT behavior for on-premise and cloud systems
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFunctionGroupName = validateFunctionGroupName;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate function group name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/functions/validation
 * (same endpoint for both function groups and function modules)
 *
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> message (e.g., "Function group ... already exists")
 */
async function validateFunctionGroupName(connection, functionGroupName, packageName, description) {
    const url = `/sap/bc/adt/functions/validation`;
    const queryParams = new URLSearchParams({
        objtype: 'FUGR/F',
        objname: functionGroupName,
    });
    if (packageName) {
        queryParams.append('packagename', packageName);
    }
    // Description is limited to 60 characters in SAP ADT
    const limitedDescription = description
        ? (0, internalUtils_1.limitDescription)(description)
        : functionGroupName;
    if (description) {
        queryParams.append('description', limitedDescription);
    }
    return connection.makeAdtRequest({
        url: `${url}?${queryParams.toString()}`,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_VALIDATION,
        },
    });
}
