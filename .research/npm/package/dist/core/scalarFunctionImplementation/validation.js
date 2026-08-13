"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateScalarFunctionImplementationName = validateScalarFunctionImplementationName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate DSFI name. Endpoint confirmed present in system discovery
 * (category dsfisfi/validation): POST /sap/bc/adt/ddic/dsfi/validation?objtype=dsfisfi
 */
async function validateScalarFunctionImplementationName(connection, name, description) {
    const queryParams = new URLSearchParams({
        objtype: 'dsfisfi',
        objname: name,
    });
    if (description)
        queryParams.append('description', description);
    return connection.makeAdtRequest({
        url: `/sap/bc/adt/ddic/dsfi/validation?${queryParams.toString()}`,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: contentTypes_1.ACCEPT_VALIDATION },
    });
}
