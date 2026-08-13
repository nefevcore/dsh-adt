"use strict";
/**
 * Enhancement unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockEnhancement = unlockEnhancement;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const types_1 = require("./types");
/**
 * Unlock enhancement
 * Must use same session and lock handle from lock operation
 *
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @param lockHandle - Lock handle obtained from lockEnhancement
 * @returns Axios response
 */
async function unlockEnhancement(connection, enhancementType, enhancementName, lockHandle) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(enhancementName).toLowerCase();
    const url = `${(0, types_1.getEnhancementUri)(enhancementType, encodedName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
    });
}
