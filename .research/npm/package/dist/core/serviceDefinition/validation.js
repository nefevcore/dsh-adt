"use strict";
/**
 * Service Definition validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/srvd/sources/validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateServiceDefinitionName = validateServiceDefinitionName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate service definition name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/srvd/sources/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <CHECK_RESULT/> or error response
 */
async function validateServiceDefinitionName(connection, serviceDefinitionName, description) {
    const url = `/sap/bc/adt/ddic/srvd/sources/validation`;
    const queryParams = new URLSearchParams({
        objtype: 'srvdsrv',
        objname: serviceDefinitionName,
    });
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
