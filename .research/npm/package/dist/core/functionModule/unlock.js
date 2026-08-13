"use strict";
/**
 * FunctionModule unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockFunctionModule = unlockFunctionModule;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock function module
 */
async function unlockFunctionModule(connection, functionGroupName, functionModuleName, lockHandle) {
    const encodedGroupName = (0, internalUtils_1.encodeSapObjectName)(functionGroupName).toLowerCase();
    const encodedModuleName = (0, internalUtils_1.encodeSapObjectName)(functionModuleName).toLowerCase();
    const url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    const headers = {
        Accept: 'application/xml',
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    });
}
