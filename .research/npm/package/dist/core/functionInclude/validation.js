"use strict";
/**
 * FunctionInclude (FUGR/I) "validation".
 *
 * FUGR/I has no dedicated validation endpoint — instead, probe the parent
 * function group's existence. A 404 here tells the caller the group is
 * missing before any create/update is attempted.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFunctionIncludeName = validateFunctionIncludeName;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
// Include both v3 (required on modern on-prem and cloud) and v2/v1 (older systems)
// so a single probe works across environments. Accept-negotiation will trim if needed.
const ACCEPT_FUNCTION_GROUP_ANY_VERSION = 'application/vnd.sap.adt.functions.groups.v3+xml, ' +
    'application/vnd.sap.adt.functions.groups.v2+xml, ' +
    'application/vnd.sap.adt.functions.groups.v1+xml';
async function validateFunctionIncludeName(connection, groupName, _includeName) {
    if (!groupName) {
        throw new Error('Function group name is required');
    }
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(groupName).toLowerCase();
    return connection.makeAdtRequest({
        method: 'GET',
        url: `/sap/bc/adt/functions/groups/${groupLower}`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: ACCEPT_FUNCTION_GROUP_ANY_VERSION },
    });
}
