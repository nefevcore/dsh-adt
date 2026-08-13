"use strict";
/**
 * Interface update operations - Low-level function
 * Use AdtInterface.update() for high-level operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = upload;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Low-level: Upload interface source code (PUT)
 * Requires lock handle - does NOT lock/unlock
 */
async function upload(connection, interfaceName, sourceCode, lockHandle, corrNr, sourceContentType) {
    let url = `/sap/bc/adt/oo/interfaces/${(0, internalUtils_1.encodeSapObjectName)(interfaceName)}/source/main?lockHandle=${encodeURIComponent(lockHandle)}`;
    if (corrNr) {
        url += `&corrNr=${corrNr}`;
    }
    const contentType = sourceContentType || contentTypes_1.CT_SOURCE;
    await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: sourceCode,
        headers: { 'Content-Type': contentType, Accept: contentTypes_1.ACCEPT_SOURCE },
    });
}
