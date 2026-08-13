"use strict";
/**
 * Class unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockClass = unlockClass;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock class
 * Must use same session and lock handle from lock operation
 *
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 */
async function unlockClass(connection, className, lockHandle) {
    const url = `/sap/bc/adt/oo/classes/${(0, internalUtils_1.encodeSapObjectName)(className).toLowerCase()}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
    });
}
