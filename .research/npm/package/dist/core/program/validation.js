"use strict";
/**
 * Program validation
 * Uses ADT validation endpoint: /sap/bc/adt/programs/validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProgramName = validateProgramName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate program name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/programs/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
async function validateProgramName(connection, programName, description, packageName) {
    const url = `/sap/bc/adt/programs/validation`;
    const queryParams = new URLSearchParams({
        objname: programName,
        objtype: 'PROG/P',
    });
    if (packageName) {
        queryParams.append('packagename', packageName);
    }
    if (description) {
        queryParams.append('description', description);
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
