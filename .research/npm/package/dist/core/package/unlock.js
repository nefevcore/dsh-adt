"use strict";
/**
 * Package unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockPackage = unlockPackage;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock package
 * Must use same lock handle from lock operation
 *
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 */
async function unlockPackage(connection, packageName, lockHandle) {
    const url = `/sap/bc/adt/packages/${(0, internalUtils_1.encodeSapObjectName)(packageName.toLowerCase())}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
    });
}
