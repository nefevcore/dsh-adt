"use strict";
/**
 * Interface validation
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 * Same endpoint as class validation, but with objtype=INTF/OI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInterfaceName = validateInterfaceName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate interface name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/oo/validation/objectname
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
async function validateInterfaceName(connection, interfaceName, packageName, description) {
    // Build query parameters for interface validation (same format as class validation)
    const params = new URLSearchParams({
        objname: interfaceName,
        objtype: 'INTF/OI',
    });
    if (packageName) {
        params.append('packagename', packageName);
    }
    if (description) {
        params.append('description', description);
    }
    const url = `/sap/bc/adt/oo/validation/objectname?${params.toString()}`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_VALIDATION_CLASS_NAME,
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    });
}
