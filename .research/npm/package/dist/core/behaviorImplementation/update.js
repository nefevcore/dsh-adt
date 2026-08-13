"use strict";
/**
 * Behavior Implementation update operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBehaviorImplementation = updateBehaviorImplementation;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Update behavior implementation class implementations include source code (low-level function)
 * Requires class to be locked first
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function updateBehaviorImplementation(connection, className, sourceCode, lockHandle, transportRequest) {
    if (!sourceCode) {
        throw new Error('sourceCode is required');
    }
    if (!lockHandle) {
        throw new Error('lockHandle is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className).toLowerCase();
    let url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations?lockHandle=${encodeURIComponent(lockHandle)}`;
    if (transportRequest) {
        url += `&corrNr=${transportRequest}`;
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
