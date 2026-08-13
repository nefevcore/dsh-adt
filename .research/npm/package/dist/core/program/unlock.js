"use strict";
/**
 * Program unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockProgram = unlockProgram;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock program
 * Must use same session and lock handle from lock operation
 */
async function unlockProgram(connection, programName, lockHandle) {
    const url = `/sap/bc/adt/programs/programs/${(0, internalUtils_1.encodeSapObjectName)(programName).toLowerCase()}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
    });
}
