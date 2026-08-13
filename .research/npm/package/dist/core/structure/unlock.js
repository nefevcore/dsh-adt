"use strict";
/**
 * Structure unlock operations
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockStructure = unlockStructure;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock structure
 * Must use same session and lock handle from lock operation
 */
async function unlockStructure(connection, structureName, lockHandle) {
    const url = `/sap/bc/adt/ddic/structures/${(0, internalUtils_1.encodeSapObjectName)(structureName).toLowerCase()}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
    });
}
