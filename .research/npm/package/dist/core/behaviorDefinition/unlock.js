"use strict";
/**
 * Behavior Definition unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlock = unlock;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock behavior definition
 *
 * Endpoint: POST /sap/bc/adt/bo/behaviordefinitions/{name}?_action=UNLOCK&lockHandle={handle}
 *
 * Must use same session and lock handle from lock operation
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param lockHandle - Lock handle obtained from lock operation
 * @param sessionId - Session ID for request tracking
 * @returns Axios response
 *
 * @example
 * ```typescript
 * const lockHandle = await lock(connection, 'Z_MY_BDEF', sessionId);
 * // ... perform updates ...
 * await unlock(connection, 'Z_MY_BDEF', lockHandle, sessionId);
 * ```
 */
async function unlock(connection, name, lockHandle) {
    const url = `/sap/bc/adt/bo/behaviordefinitions/${(0, internalUtils_1.encodeSapObjectName)(name).toLowerCase()}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
}
