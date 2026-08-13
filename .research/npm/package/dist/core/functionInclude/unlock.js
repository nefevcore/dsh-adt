"use strict";
/**
 * FunctionInclude (FUGR/I) unlock operation.
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockFunctionInclude = unlockFunctionInclude;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock function include. Must use the same stateful session that owned
 * the lock and the exact lockHandle returned from lockFunctionInclude().
 */
async function unlockFunctionInclude(connection, groupName, includeName, lockHandle) {
    if (!groupName) {
        throw new Error('Function group name is required');
    }
    if (!includeName) {
        throw new Error('Include name is required');
    }
    if (!lockHandle) {
        throw new Error('lockHandle is required');
    }
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(groupName).toLowerCase();
    const encodedInclude = (0, internalUtils_1.encodeSapObjectName)(includeName.toUpperCase());
    const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
}
