"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockAccessControl = unlockAccessControl;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock access control
 * Must use same session and lock handle from lock operation
 */
async function unlockAccessControl(connection, accessControlName, lockHandle) {
    const accessControlNameEncoded = (0, internalUtils_1.encodeSapObjectName)(accessControlName.toLowerCase());
    const url = `/sap/bc/adt/acm/dcl/sources/${accessControlNameEncoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
}
