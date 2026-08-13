"use strict";
/**
 * Interface unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockInterface = unlockInterface;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock interface
 * Must use same session and lock handle from lock operation
 */
async function unlockInterface(connection, interfaceName, lockHandle) {
    const url = `/sap/bc/adt/oo/interfaces/${(0, internalUtils_1.encodeSapObjectName)(interfaceName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    try {
        const response = await connection.makeAdtRequest({
            url,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)(),
            data: '',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return response;
    }
    catch (error) {
        const e = error;
        // If response is not returned (e.g., object locked by another user, network error),
        // provide more context in the error message
        if (!e.response) {
            throw new Error(`Failed to unlock interface ${interfaceName}: No response from server. ` +
                `Lock handle: ${lockHandle} ` +
                `The interface may be locked by another user or session may be invalid.`);
        }
        // If we have a response, include its status and data in the error
        const status = e.response?.status;
        const statusText = status ? `HTTP ${status}` : 'HTTP ?';
        const errorData = e.response?.data
            ? typeof e.response.data === 'string'
                ? e.response.data
                : (0, internalUtils_1.safeStringify)(e.response.data)
            : e.message;
        throw new Error(`Failed to unlock interface ${interfaceName} (${statusText}): ${errorData}`);
    }
}
