"use strict";
/**
 * AuthorizationField (SUSO / AUTH) unlock operation
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockAuthorizationField = unlockAuthorizationField;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock authorization field. Must use the same stateful session that owned
 * the lock and the exact lockHandle returned from lockAuthorizationField().
 */
async function unlockAuthorizationField(connection, name, lockHandle) {
    if (!name) {
        throw new Error('Authorization field name is required');
    }
    if (!lockHandle) {
        throw new Error('lockHandle is required');
    }
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toUpperCase());
    const url = `/sap/bc/adt/aps/iam/auth/${encoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
}
