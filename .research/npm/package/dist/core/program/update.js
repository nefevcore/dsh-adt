"use strict";
/**
 * Program update operations - low-level functions for AdtProgram
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProgramSource = uploadProgramSource;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Upload program source code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtProgram
 */
async function uploadProgramSource(connection, programName, sourceCode, lockHandle, _sessionId, corrNr) {
    let url = `/sap/bc/adt/programs/programs/${(0, internalUtils_1.encodeSapObjectName)(programName).toLowerCase()}/source/main?lockHandle=${encodeURIComponent(lockHandle)}`;
    if (corrNr) {
        url += `&corrNr=${corrNr}`;
    }
    const headers = {
        'Content-Type': contentTypes_1.CT_SOURCE,
        Accept: contentTypes_1.ACCEPT_SOURCE,
    };
    return await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: sourceCode,
        headers,
    });
}
