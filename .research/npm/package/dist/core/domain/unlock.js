"use strict";
/**
 * Domain unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockDomain = unlockDomain;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock domain
 * Must use same session and lock handle from lock operation
 *
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 */
async function unlockDomain(connection, domainName, lockHandle) {
    const domainNameEncoded = (0, internalUtils_1.encodeSapObjectName)(domainName.toLowerCase());
    const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
    });
}
